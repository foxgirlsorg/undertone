"use client";

/*
  PlayerProvider — the one place playback happens.

  - Sources are tried in the order of the ListenBrainz BrainzPlayer settings (as saved in this tab,
    else the defaults; see player-prefs.ts). Nothing is stored in the browser. Only enabled sources Undertone can play
    are used: Spotify (when connected), YouTube and the Internet Archive. A source that cannot play a
    track is skipped.
  - The playback logic lives in a plain controller created once (no React in it). React state only
    holds a published snapshot of the controller, so event callbacks (YouTube events, audio events,
    Spotify events, timers) always see fresh state without stale closures.
  - The YouTube iframe is kept mounted in a small panel; the bar toggles whether it is visible
    (see player-video-context.ts).
  - Spotify uses the Web Playback SDK in this browser (spotify-player.ts). Its device is created the
    first time a Spotify track plays and kept for the session.
*/

import * as React from "react";
import YouTube, { type YouTubeEvent, type YouTubePlayer } from "react-youtube";
import { toast } from "@heroui/react";
import type APIService from "@/lib/api";
import { useAuth, type AuthUser } from "@/lib/auth";
import { getSpotifyToken, spotifyConfigured } from "@/lib/spotify";
import {
  getArtistMBIDs,
  getArtistName,
  getCoverArt,
  getDurationMs,
  getRecordingMBID,
  getReleaseGroupMBID,
  getReleaseMBID,
  getReleaseName,
  getTrackName,
} from "@/lib/listen";
import {
  readBrainzSettingsOrDefault,
  readEnabledPlaybackSources,
  readSubmitListens,
  readYoutubeApiKey,
  rememberBrainzSettings,
  type PlaybackSourceId,
} from "@/components/settings/player-prefs";
import {
  PlayerContext,
  type PlayerContextValue,
  type PlayerState,
} from "./player-context";
import { PlayerVideoContext, type PlayerVideoContextValue } from "./player-video-context";
import {
  connectSpotifyDevice,
  playSpotifyUri,
  searchSpotifyTrackUri,
  SpotifyError,
  SPOTIFY_PREMIUM_MESSAGE,
  spotifyUriFromInfo,
  type SpotifyDevice,
  type SpotifyState,
} from "./spotify-player";

/* ----------------------------------------------------------------------------
 * Constants and storage
 * ------------------------------------------------------------------------- */

type Source = PlaybackSourceId;

const TICK_MS = 500;
const SKIP_AFTER_ERROR_MS = 3000;
const RESTART_THRESHOLD_MS = 3000;
const YT_START_TIMEOUT_MS = 12000;
const AUDIO_START_TIMEOUT_MS = 15000;
const SPOTIFY_START_TIMEOUT_MS = 15000;
/** ListenBrainz counts a listen after half the track or four minutes, whichever is first. */
const SINGLE_MAX_MS = 4 * 60 * 1000;
const YT_STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2 } as const;
/** Stable object: react-youtube recreates the player whenever `opts` changes. */
const YT_OPTS = {
  width: 320,
  height: 180,
  playerVars: { autoplay: 1, controls: 0, playsinline: 1, rel: 0, modestbranding: 1 },
} as const;

const ERROR_NOT_FOUND = "Couldn't find this track on your enabled sources";
const ERROR_NO_SOURCE = "No playback source is enabled. Turn one on in the player settings.";
const ERROR_PLAYER_OFF = "The player is turned off. Turn it on in the player settings.";
const ERROR_SPOTIFY_NOT_CONNECTED = "Connect Spotify in the player settings to play through Spotify.";

/** Where a source's tracks come from, as ListenBrainz and Undertone label them. */
const SERVICE_META: Record<Source, { music_service: string; media_player: string }> = {
  youtube: { music_service: "youtube.com", media_player: "YouTube" },
  "internet-archive": { music_service: "archive.org", media_player: "Internet Archive" },
  spotify: { music_service: "spotify.com", media_player: "Spotify" },
};

const INITIAL_STATE: PlayerState = {
  queue: [],
  index: -1,
  current: undefined,
  isPlaying: false,
  source: "none",
  progressMs: 0,
  durationMs: 0,
  volume: 80,
  error: undefined,
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}


/* ----------------------------------------------------------------------------
 * YouTube helpers
 * ------------------------------------------------------------------------- */

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const YT_URL = /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|shorts\/))([A-Za-z0-9_-]{11})/;

/** A video id from `additional_info.youtube_id` or a YouTube `origin_url`, if there is one. */
function youtubeIdFromListen(l: Listen): string | undefined {
  const info = l.track_metadata?.additional_info;
  for (const raw of [info?.youtube_id, info?.origin_url]) {
    if (typeof raw !== "string" || !raw) continue;
    if (YT_ID.test(raw)) return raw;
    const m = YT_URL.exec(raw);
    if (m) return m[1];
  }
  return undefined;
}

/** In-memory cache so repeated plays of one track spend one search request. */
const ytSearchCache = new Map<string, string | null>();

async function searchYouTube(l: Listen, key: string): Promise<string | undefined> {
  const q = [getTrackName(l), getArtistName(l)].filter(Boolean).join(" ");
  if (!q) return undefined;
  const cached = ytSearchCache.get(q);
  if (cached !== undefined) return cached ?? undefined;
  const params = new URLSearchParams({
    part: "id",
    type: "video",
    maxResults: "1",
    videoEmbeddable: "true",
    q,
    key,
  });
  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
  if (!res.ok) return undefined; // not cached: a quota or key problem may clear up
  const body = (await res.json()) as { items?: Array<{ id?: { videoId?: string } }> };
  const videoId = body.items?.[0]?.id?.videoId ?? null;
  ytSearchCache.set(q, videoId);
  return videoId ?? undefined;
}

/* ----------------------------------------------------------------------------
 * Internet Archive helpers
 * ------------------------------------------------------------------------- */

async function fetchArchiveStreamUrl(api: APIService, l: Listen): Promise<string | undefined> {
  const params = new URLSearchParams({ artist: getArtistName(l), track: getTrackName(l) });
  const res = await fetch(`${api.APIBaseURI}/internet_archive/search?${params.toString()}`);
  if (!res.ok) return undefined;
  const body = (await res.json()) as { results?: Array<{ stream_urls?: string[] }> };
  return body.results?.[0]?.stream_urls?.[0];
}

/* ----------------------------------------------------------------------------
 * Listen submission
 * ------------------------------------------------------------------------- */

/** Track metadata for playing_now / single submissions, tagged as sent by Undertone. */
function listenPayload(l: Listen, src: Source): TrackMetadata | null {
  const artist = getArtistName(l);
  const track = getTrackName(l);
  if (!artist || !track) return null;
  const artistMBIDs = getArtistMBIDs(l);
  return {
    artist_name: artist,
    track_name: track,
    release_name: getReleaseName(l) || undefined,
    additional_info: {
      ...l.track_metadata?.additional_info,
      recording_mbid: getRecordingMBID(l) ?? undefined,
      release_mbid: getReleaseMBID(l) ?? undefined,
      release_group_mbid: getReleaseGroupMBID(l) ?? undefined,
      artist_mbids: artistMBIDs.length ? artistMBIDs : undefined,
      music_service: SERVICE_META[src].music_service,
      media_player: SERVICE_META[src].media_player,
      submission_client: "Undertone",
    },
  } as TrackMetadata;
}

/* ----------------------------------------------------------------------------
 * Controller
 * ------------------------------------------------------------------------- */

type ControllerDeps = {
  publish: (state: PlayerState) => void;
  api: APIService;
};

/** Live readers the controller needs; wired by connect() from an effect, never during render. */
type Connection = {
  getUser: () => AuthUser | null | undefined;
};

/** Mutable bookkeeping that is not published to React. */
type Internal = {
  /** Bumped whenever the track changes; async work checks it to stop being stale. */
  loadId: number;
  /** Resolves the attempt currently waiting for a source to start (see attempt()). */
  waiter: ((ok: boolean) => void) | null;
  yt: YouTubePlayer | null;
  audio: HTMLAudioElement | null;
  spotify: SpotifyDevice | null;
  spotifyConnecting: Promise<SpotifyDevice> | null;
  /** Spotify track URI of the track being played through Spotify. */
  spotifyUri: string | null;
  /** Load id whose Spotify end-of-track has already been handled. */
  spotifyEndedFor: number;
  /** Set after Spotify reported that the account has no Premium: Spotify is skipped from then on. */
  spotifyPremiumDenied: boolean;
  ticker: ReturnType<typeof setInterval> | null;
  skipTimer: ReturnType<typeof setTimeout> | null;
  /** Source that is currently loaded for this track, or null. */
  active: Source | null;
  /** True while sources are being tried for the current track. */
  loading: boolean;
  /** Why the sources failed for the current track, when there is a specific reason. */
  sourceError: string | null;
  /** Load id whose start has already been reported (playing_now sent). */
  startedFor: number;
  playingSource: Source | null;
  trackStartedAt: number;
  playedMs: number;
  submitted: boolean;
};

function createController({ publish, api }: ControllerDeps) {
  const st: PlayerState = { ...INITIAL_STATE };
  let getUser: Connection["getUser"] = () => null;
  /** Callers waiting for the react-youtube player to report ready (see ensureYouTube). */
  let ytWaiters: Array<(player: YouTubePlayer) => void> = [];
  const s: Internal = {
    loadId: 0,
    waiter: null,
    yt: null,
    audio: null,
    spotify: null,
    spotifyConnecting: null,
    spotifyUri: null,
    spotifyEndedFor: -1,
    spotifyPremiumDenied: false,
    ticker: null,
    skipTimer: null,
    active: null,
    loading: false,
    sourceError: null,
    startedFor: -1,
    playingSource: null,
    trackStartedAt: 0,
    playedMs: 0,
    submitted: false,
  };

  function commit(patch: Partial<PlayerState>) {
    Object.assign(st, patch);
    st.current = st.queue[st.index];
    publish({ ...st });
  }

  function currentListen(): Listen | undefined {
    return st.queue[st.index];
  }

  /* ---- progress ticker (only while playing) ---- */

  function startTicker() {
    if (s.ticker === null) s.ticker = setInterval(tick, TICK_MS);
  }

  function stopTicker() {
    if (s.ticker !== null) {
      clearInterval(s.ticker);
      s.ticker = null;
    }
  }

  /** Current position and duration of the active source. The YouTube and Spotify getters are async. */
  async function readTimes(): Promise<{ progressMs: number; durationMs: number }> {
    try {
      if (s.active === "youtube" && s.yt) {
        const [pos, dur] = await Promise.all([s.yt.getCurrentTime(), s.yt.getDuration()]);
        return {
          progressMs: Math.round(pos * 1000),
          durationMs: dur > 0 ? Math.round(dur * 1000) : 0,
        };
      }
      if (s.active === "internet-archive" && s.audio) {
        const d = s.audio.duration;
        return {
          progressMs: Math.round(s.audio.currentTime * 1000),
          durationMs: Number.isFinite(d) && d > 0 ? Math.round(d * 1000) : 0,
        };
      }
      if (s.active === "spotify" && s.spotify) {
        const state = await s.spotify.player.getCurrentState();
        if (state && state.track_window.current_track.uri === s.spotifyUri) {
          return { progressMs: state.position, durationMs: state.duration > 0 ? state.duration : 0 };
        }
      }
    } catch {
      /* player not ready yet */
    }
    return { progressMs: st.progressMs, durationMs: 0 };
  }

  function singleThreshold(l: Listen, durationMs: number): number {
    const total = durationMs || getDurationMs(l) || 0;
    return total > 0 ? Math.min(total / 2, SINGLE_MAX_MS) : SINGLE_MAX_MS;
  }

  function tick() {
    const listen = currentListen();
    const loadId = s.loadId;
    s.playedMs += TICK_MS;
    void readTimes().then(({ progressMs, durationMs: liveDuration }) => {
      // The track changed while the read was in flight: its numbers no longer apply.
      if (loadId !== s.loadId) return;
      const durationMs = liveDuration || st.durationMs;
      if (
        listen &&
        !s.submitted &&
        s.playingSource &&
        s.trackStartedAt &&
        s.playedMs >= singleThreshold(listen, durationMs)
      ) {
        s.submitted = true;
        submitSingle(listen, s.playingSource, s.trackStartedAt);
      }
      commit({ progressMs, durationMs });
    });
  }

  /* ---- listen submission ---- */

  function submitPlayingNow(l: Listen, src: Source) {
    const user = getUser();
    if (!user || !readSubmitListens()) return;
    const payload = listenPayload(l, src);
    if (!payload) return;
    api
      .submitListens(user.token, "playing_now", [{ listened_at: 0, track_metadata: payload }])
      .catch(() => {});
  }

  function submitSingle(l: Listen, src: Source, startedAt: number) {
    const user = getUser();
    if (!user || !readSubmitListens()) return;
    const payload = listenPayload(l, src);
    if (!payload) return;
    api
      .submitListens(user.token, "single", [
        { listened_at: Math.floor(startedAt / 1000), track_metadata: payload },
      ])
      .catch(() => {});
  }

  /* ---- state transitions reported by the sources ---- */

  function markPlaying(src: Source) {
    const listen = currentListen();
    if (!listen) return;
    const wasLoading = s.loading;
    s.loading = false;
    s.playingSource = src;
    // The user paused while the source was still loading: honour that and keep it paused.
    if (wasLoading && !st.isPlaying) {
      pauseActive();
      commit({ source: src, error: undefined });
      return;
    }
    if (s.startedFor !== s.loadId) {
      s.startedFor = s.loadId;
      s.trackStartedAt = Date.now();
      s.playedMs = 0;
      s.submitted = false;
      submitPlayingNow(listen, src);
    }
    startTicker();
    commit({ source: src, isPlaying: true, error: undefined });
  }

  function onPaused() {
    stopTicker();
    commit({ isPlaying: false });
  }

  /** A source failed after it had started: retry the track without that source. */
  function failMidTrack(src: Source) {
    loadCurrent([src]);
  }

  function onYtState(code: number) {
    if (s.active !== "youtube") return;
    if (code === YT_STATE.PLAYING) {
      s.waiter?.(true);
      markPlaying("youtube");
      return;
    }
    if (code === YT_STATE.ENDED) {
      if (!s.loading) next();
      return;
    }
    if (code === YT_STATE.PAUSED && !s.loading) onPaused();
  }

  function onYtError() {
    if (s.active !== "youtube") return;
    if (s.waiter) s.waiter(false);
    else failMidTrack("youtube");
  }

  /** Resolves with the player once react-youtube has created it, or rejects after the timeout. */
  function ensureYouTube(): Promise<YouTubePlayer> {
    if (s.yt) return Promise.resolve(s.yt);
    return new Promise<YouTubePlayer>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("The YouTube player is not ready.")),
        YT_START_TIMEOUT_MS
      );
      ytWaiters.push((player) => {
        clearTimeout(timer);
        resolve(player);
      });
    });
  }

  /** Event handlers for the <YouTube> element that the provider renders. */
  const youtube = {
    onReady: (e: YouTubeEvent) => {
      const player = e.target;
      s.yt = player;
      try {
        void player.setVolume(st.volume);
      } catch {
        /* volume is re-applied on the next change */
      }
      const waiters = ytWaiters;
      ytWaiters = [];
      for (const wake of waiters) wake(player);
    },
    onStateChange: (e: YouTubeEvent<number>) => {
      // ENDED is routed through onEnd so it is handled once.
      if (e.data !== YT_STATE.ENDED) onYtState(e.data);
    },
    onEnd: () => onYtState(YT_STATE.ENDED),
    onError: () => onYtError(),
  };

  function ensureAudio(): HTMLAudioElement {
    if (s.audio) return s.audio;
    const a = new Audio();
    a.preload = "auto";
    a.addEventListener("playing", () => {
      if (s.active !== "internet-archive") return;
      s.waiter?.(true);
      markPlaying("internet-archive");
    });
    a.addEventListener("pause", () => {
      if (s.active === "internet-archive" && !s.loading && !a.ended) onPaused();
    });
    a.addEventListener("ended", () => {
      if (s.active === "internet-archive") next();
    });
    a.addEventListener("error", () => {
      if (s.active !== "internet-archive" || !a.getAttribute("src")) return;
      if (s.waiter) s.waiter(false);
      else failMidTrack("internet-archive");
    });
    s.audio = a;
    return a;
  }

  /* ---- Spotify ---- */

  function handleSpotifyPremium() {
    s.spotifyPremiumDenied = true;
    s.sourceError = SPOTIFY_PREMIUM_MESSAGE;
    commit({ error: SPOTIFY_PREMIUM_MESSAGE });
  }

  function onSpotifyState(state: SpotifyState) {
    if (s.active !== "spotify" || !s.spotifyUri) return;
    if (state.track_window.current_track.uri !== s.spotifyUri) return;
    if (s.waiter && !state.paused) {
      s.waiter(true);
      markPlaying("spotify");
      return;
    }
    if (!s.loading) {
      if (!state.paused && !st.isPlaying) markPlaying("spotify");
      else if (state.paused && st.isPlaying) onPaused();
    }
    // The Web Playback SDK reports a finished track as paused at 0 with the track in previous_tracks.
    const finished =
      state.paused &&
      state.position === 0 &&
      state.track_window.previous_tracks.some((t) => t.uri === s.spotifyUri);
    if (finished && s.spotifyEndedFor !== s.loadId) {
      s.spotifyEndedFor = s.loadId;
      next();
    }
  }

  function onSpotifyFailure() {
    if (s.active !== "spotify") return;
    if (s.waiter) s.waiter(false);
    else failMidTrack("spotify");
  }

  /** Creates the Undertone Spotify device on first use; later calls reuse it. */
  function ensureSpotifyDevice(): Promise<SpotifyDevice> {
    if (s.spotify) return Promise.resolve(s.spotify);
    s.spotifyConnecting ??= connectSpotifyDevice(getSpotifyToken, st.volume, {
      state: onSpotifyState,
      notReady: () => {
        if (s.spotify) s.spotify.deviceId = "";
      },
      premium: () => {
        handleSpotifyPremium();
        if (s.active === "spotify") {
          if (s.waiter) s.waiter(false);
          else failMidTrack("spotify");
        }
      },
      failure: () => onSpotifyFailure(),
    })
      .then((device) => {
        s.spotify = device;
        return device;
      })
      .finally(() => {
        s.spotifyConnecting = null;
      });
    return s.spotifyConnecting;
  }

  /** Finds the Spotify track for a listen: its own Spotify link first, then a search. */
  async function resolveSpotifyUri(l: Listen, token: string): Promise<string | undefined> {
    const direct = spotifyUriFromInfo(l.track_metadata?.additional_info);
    if (direct) return direct;
    const track = getTrackName(l);
    if (!track) return undefined;
    return await searchSpotifyTrackUri(token, track, getArtistName(l)).catch(() => undefined);
  }

  async function trySpotify(l: Listen, id: number): Promise<boolean> {
    if (!spotifyConfigured()) return false;
    if (s.spotifyPremiumDenied) {
      handleSpotifyPremium();
      return false;
    }
    const token = await getSpotifyToken();
    if (id !== s.loadId) return false;
    if (!token) {
      s.sourceError = ERROR_SPOTIFY_NOT_CONNECTED;
      return false;
    }
    const uri = await resolveSpotifyUri(l, token);
    if (id !== s.loadId || !uri) return false;
    let device: SpotifyDevice;
    try {
      device = await ensureSpotifyDevice();
    } catch (err) {
      if (id !== s.loadId) return false;
      if (err instanceof SpotifyError && err.premium) handleSpotifyPremium();
      else s.sourceError = err instanceof Error ? err.message : "Spotify could not start.";
      return false;
    }
    if (id !== s.loadId) return false;
    s.active = "spotify";
    s.spotifyUri = uri;
    const ok = await attempt(() => {
      void startSpotifyTrack(device, uri, id);
    }, SPOTIFY_START_TIMEOUT_MS);
    if (ok) return true;
    if (id === s.loadId) {
      void s.spotify?.player.pause().catch(() => {});
      s.active = null;
    }
    return false;
  }

  /** Asks Spotify to start the track on the Undertone device. Failures resolve the waiter. */
  async function startSpotifyTrack(device: SpotifyDevice, uri: string, id: number) {
    const token = await getSpotifyToken();
    if (id !== s.loadId) return;
    if (!token) {
      s.waiter?.(false);
      return;
    }
    const result = device.deviceId ? await playSpotifyUri(token, device.deviceId, uri) : "device";
    if (id !== s.loadId || result === "ok") return;
    if (result === "premium") handleSpotifyPremium();
    s.waiter?.(false);
  }

  /* ---- Spotify / YouTube / Internet Archive: start one track ---- */

  /** Resolves a YouTube id from the listen's own link, or by searching with the saved API key. */
  async function resolveYouTubeId(l: Listen): Promise<string | undefined> {
    const direct = youtubeIdFromListen(l);
    if (direct) return direct;
    const key = readYoutubeApiKey().trim();
    if (!key) return undefined;
    try {
      return await searchYouTube(l, key);
    } catch {
      return undefined;
    }
  }

  /**
   * Starts something and waits for the source to report playing (or fail / time out).
   * `setup` must start playback; the waiter is resolved by the source's event handlers.
   */
  function attempt(setup: () => void, timeoutMs: number): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      const finish = (ok: boolean) => {
        if (timer !== null) clearTimeout(timer);
        if (s.waiter === finish) s.waiter = null;
        resolve(ok);
      };
      s.waiter = finish;
      timer = setTimeout(() => finish(false), timeoutMs);
      try {
        setup();
      } catch {
        finish(false);
      }
    });
  }

  async function tryYouTube(l: Listen, id: number): Promise<boolean> {
    const videoId = await resolveYouTubeId(l);
    if (id !== s.loadId || !videoId) return false;
    const yt = await ensureYouTube().catch(() => null);
    if (id !== s.loadId || !yt) return false;
    s.active = "youtube";
    const ok = await attempt(() => yt.loadVideoById(videoId), YT_START_TIMEOUT_MS);
    if (ok) return true;
    if (id === s.loadId) {
      try {
        yt.pauseVideo();
      } catch {
        /* nothing loaded */
      }
      s.active = null;
    }
    return false;
  }

  async function tryInternetArchive(l: Listen, id: number): Promise<boolean> {
    const streamUrl = await fetchArchiveStreamUrl(api, l).catch(() => undefined);
    if (id !== s.loadId || !streamUrl) return false;
    const audio = ensureAudio();
    s.active = "internet-archive";
    const ok = await attempt(() => {
      audio.src = streamUrl;
      audio.volume = st.volume / 100;
      audio.play().catch(() => {
        if (id === s.loadId) s.waiter?.(false);
      });
    }, AUDIO_START_TIMEOUT_MS);
    if (ok) return true;
    if (id === s.loadId) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      s.active = null;
    }
    return false;
  }

  /** Tries each enabled source in order for one track. */
  async function runLoad(l: Listen, id: number, exclude: Source[]) {
    // A Premium problem found earlier still explains a failure in this session.
    s.sourceError = s.spotifyPremiumDenied ? SPOTIFY_PREMIUM_MESSAGE : null;
    if (!readBrainzSettingsOrDefault().brainzplayerEnabled) {
      s.loading = false;
      s.active = null;
      commit({ isPlaying: false, source: "none", error: ERROR_PLAYER_OFF });
      return;
    }
    const configured = readEnabledPlaybackSources();
    const order = configured.filter((src) => !exclude.includes(src));
    for (const src of order) {
      const ok =
        src === "youtube"
          ? await tryYouTube(l, id)
          : src === "spotify"
            ? await trySpotify(l, id)
            : await tryInternetArchive(l, id);
      if (id !== s.loadId) return;
      if (ok) return;
    }
    if (id !== s.loadId) return;
    s.loading = false;
    s.active = null;
    if (!configured.length) {
      commit({ isPlaying: false, source: "none", error: ERROR_NO_SOURCE });
      return;
    }
    commit({ isPlaying: false, source: "none", error: s.sourceError ?? ERROR_NOT_FOUND });
    if (st.index < st.queue.length - 1) {
      s.skipTimer = setTimeout(() => {
        s.skipTimer = null;
        if (id === s.loadId) next();
      }, SKIP_AFTER_ERROR_MS);
    }
  }

  /* ---- controlling playback ---- */

  function pauseActive() {
    try {
      if (s.active === "youtube") s.yt?.pauseVideo();
      else if (s.active === "internet-archive") s.audio?.pause();
      else if (s.active === "spotify") void s.spotify?.player.pause().catch(() => {});
    } catch {
      /* ignore: the source is gone */
    }
  }

  function playActive() {
    try {
      if (s.active === "youtube") s.yt?.playVideo();
      else if (s.active === "internet-archive") {
        s.audio?.play().catch(() => onPaused());
      } else if (s.active === "spotify") {
        void s.spotify?.player.resume().catch(() => onPaused());
      }
    } catch {
      onPaused();
    }
  }

  /** Stops whatever is playing and cancels pending work. Does not change the queue. */
  function stopPlayback() {
    if (s.skipTimer !== null) {
      clearTimeout(s.skipTimer);
      s.skipTimer = null;
    }
    stopTicker();
    const w = s.waiter;
    s.waiter = null;
    w?.(false);
    try {
      s.yt?.pauseVideo();
    } catch {
      /* not created yet */
    }
    if (s.audio) {
      s.audio.pause();
      s.audio.removeAttribute("src");
      s.audio.load();
    }
    void s.spotify?.player.pause().catch(() => {});
    s.active = null;
    s.loading = false;
    s.playingSource = null;
    s.submitted = false;
    s.trackStartedAt = 0;
    s.playedMs = 0;
  }

  /** Invalidates every in-flight load and stops playback. */
  function invalidate() {
    s.loadId += 1;
    stopPlayback();
  }

  /** Stops and reports the given state. */
  function halt(patch: Partial<PlayerState> = {}) {
    invalidate();
    commit({ isPlaying: false, source: "none", progressMs: 0, durationMs: 0, ...patch });
  }

  /** Loads and plays the track at the current index. */
  function loadCurrent(exclude: Source[] = []) {
    const listen = currentListen();
    invalidate();
    if (!listen) {
      commit({ isPlaying: false, source: "none", progressMs: 0, durationMs: 0, error: undefined });
      return;
    }
    const id = s.loadId;
    s.loading = true;
    commit({
      isPlaying: true,
      source: "none",
      progressMs: 0,
      durationMs: getDurationMs(listen) ?? 0,
      error: undefined,
    });
    void runLoad(listen, id, exclude);
  }

  function playListen(listen: Listen, context?: Listen[]) {
    const list = context && context.length ? [...context] : [listen];
    const index = Math.max(0, list.indexOf(listen));
    st.queue = list.includes(listen) ? list : [listen];
    st.index = list.includes(listen) ? index : 0;
    loadCurrent();
  }

  function playQueue(listens: Listen[], startIndex = 0) {
    if (!listens.length) {
      clearQueue();
      return;
    }
    st.queue = [...listens];
    st.index = clamp(startIndex, 0, listens.length - 1);
    loadCurrent();
  }

  function addToQueue(listens: Listen | Listen[], after = false) {
    const list = Array.isArray(listens) ? listens : [listens];
    if (!list.length) return;
    const queue = [...st.queue];
    if (after && st.index >= 0) queue.splice(st.index + 1, 0, ...list);
    else queue.push(...list);
    if (st.index < 0) {
      commit({ queue, index: 0 });
      loadCurrent();
      return;
    }
    commit({ queue });
  }

  function removeFromQueue(i: number) {
    if (i < 0 || i >= st.queue.length) return;
    const queue = st.queue.filter((_, j) => j !== i);
    if (!queue.length) {
      clearQueue();
      return;
    }
    if (i < st.index) {
      commit({ queue, index: st.index - 1 });
      return;
    }
    if (i > st.index) {
      commit({ queue });
      return;
    }
    // The playing track was removed: the one after it takes its place.
    if (i < queue.length) {
      commit({ queue, index: i });
      loadCurrent();
      return;
    }
    // It was the last track: stop, leaving the previous one selected.
    commit({ queue, index: queue.length - 1 });
    halt();
  }

  /** Stops playback, empties the queue and hides the bar. */
  function clearQueue() {
    commit({ queue: [], index: -1 });
    halt({ error: undefined });
  }

  function toggle() {
    if (!currentListen()) return;
    if (s.loading) {
      commit({ isPlaying: !st.isPlaying });
      return;
    }
    if (!s.active) {
      // Stopped or failed: (re)try the track.
      loadCurrent();
      return;
    }
    if (st.isPlaying) {
      pauseActive();
      onPaused();
    } else {
      playActive();
      commit({ isPlaying: true });
    }
  }

  function next() {
    const i = st.index + 1;
    if (i < st.queue.length) {
      commit({ index: i });
      loadCurrent();
      return;
    }
    // End of the queue: stop on the last track.
    invalidate();
    commit({ isPlaying: false });
  }

  function previous() {
    if (st.progressMs > RESTART_THRESHOLD_MS || st.index <= 0) {
      seek(0);
      return;
    }
    commit({ index: st.index - 1 });
    loadCurrent();
  }

  function seek(ms: number) {
    const max = st.durationMs > 0 ? st.durationMs : Number.POSITIVE_INFINITY;
    const target = clamp(ms, 0, max);
    try {
      if (s.active === "youtube" && s.yt) s.yt.seekTo(target / 1000, true);
      else if (s.active === "internet-archive" && s.audio) s.audio.currentTime = target / 1000;
      else if (s.active === "spotify" && s.spotify) void s.spotify.player.seek(target).catch(() => {});
      else return;
    } catch {
      return;
    }
    commit({ progressMs: target });
  }

  function setVolume(v: number) {
    const volume = clamp(Math.round(v), 0, 100);
    try {
      s.yt?.setVolume(volume);
    } catch {
      /* applied on ready */
    }
    if (s.audio) s.audio.volume = volume / 100;
    void s.spotify?.player.setVolume(volume / 100).catch(() => {});
    commit({ volume });
  }

  function dispose() {
    invalidate();
    if (s.audio) s.audio.pause();
    s.spotify?.player.disconnect();
    s.spotify = null;
  }

  return {
    getState: () => st,
    connect: (conn: Connection) => {
      getUser = conn.getUser;
    },
    youtube,
    playListen,
    playQueue,
    addToQueue,
    removeFromQueue,
    clearQueue,
    toggle,
    next,
    previous,
    seek,
    setVolume,
    dispose,
  };
}

type Controller = ReturnType<typeof createController>;

/* ----------------------------------------------------------------------------
 * Provider
 * ------------------------------------------------------------------------- */

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const { api, user, account } = useAuth();

  // With a password sign-in, the real ListenBrainz player settings are known (held in memory only).
  React.useEffect(() => {
    if (account?.brainzplayer) rememberBrainzSettings(account.brainzplayer);
  }, [account]);
  const userRef = React.useRef<AuthUser | null | undefined>(user);
  const [snapshot, setSnapshot] = React.useState<PlayerState>(INITIAL_STATE);
  const [ctrl] = React.useState<Controller>(() => createController({ publish: setSnapshot, api }));
  const [expanded, setExpanded] = React.useState(false);

  React.useEffect(() => {
    ctrl.connect({
      getUser: () => userRef.current,
    });
  }, [ctrl]);

  React.useEffect(() => {
    userRef.current = user;
  }, [user]);

  React.useEffect(() => {
    return () => ctrl.dispose();
  }, [ctrl]);

  /* Playback problems: a notice, when the ListenBrainz setting "Show notifications" is on. */
  // The bar already shows the error inline; a toast is extra, so at most one a minute (auto-skips
  // through a queue of unplayable tracks would otherwise stack a toast per track).
  const { error } = snapshot;
  const lastToastAt = React.useRef(0);
  React.useEffect(() => {
    if (!error) return;
    if (!readBrainzSettingsOrDefault().notificationsEnabled) return;
    const now = Date.now();
    if (now - lastToastAt.current < 60_000) return;
    lastToastAt.current = now;
    toast.danger("Couldn't play this track", { description: error });
  }, [error]);

  /* Media Session: lock-screen / headset controls and track metadata. */
  const { current, isPlaying } = snapshot;
  React.useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    if (!current) {
      navigator.mediaSession.metadata = null;
      return;
    }
    const cover = getCoverArt(current, 500);
    navigator.mediaSession.metadata = new MediaMetadata({
      title: getTrackName(current),
      artist: getArtistName(current),
      album: getReleaseName(current),
      artwork: cover ? [{ src: cover, sizes: "500x500", type: "image/jpeg" }] : [],
    });
  }, [current]);

  React.useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = current ? (isPlaying ? "playing" : "paused") : "none";
  }, [current, isPlaying]);

  React.useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    const set = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try {
        ms.setActionHandler(action, handler);
      } catch {
        /* action not supported by this browser */
      }
    };
    set("play", () => {
      if (!ctrl.getState().isPlaying) ctrl.toggle();
    });
    set("pause", () => {
      if (ctrl.getState().isPlaying) ctrl.toggle();
    });
    set("nexttrack", () => ctrl.next());
    set("previoustrack", () => ctrl.previous());
    set("seekto", (details) => {
      if (typeof details.seekTime === "number") ctrl.seek(details.seekTime * 1000);
    });
    return () => {
      set("play", null);
      set("pause", null);
      set("nexttrack", null);
      set("previoustrack", null);
      set("seekto", null);
    };
  }, [ctrl]);

  const value = React.useMemo<PlayerContextValue>(
    () => ({
      ...snapshot,
      playListen: ctrl.playListen,
      playQueue: ctrl.playQueue,
      addToQueue: ctrl.addToQueue,
      removeFromQueue: ctrl.removeFromQueue,
      clearQueue: ctrl.clearQueue,
      toggle: ctrl.toggle,
      next: ctrl.next,
      previous: ctrl.previous,
      seek: ctrl.seek,
      setVolume: ctrl.setVolume,
    }),
    [snapshot, ctrl]
  );

  const videoValue = React.useMemo<PlayerVideoContextValue>(
    () => ({ expanded, setExpanded }),
    [expanded]
  );

  const showVideo = expanded && snapshot.source === "youtube";

  return (
    <PlayerContext.Provider value={value}>
      <PlayerVideoContext.Provider value={videoValue}>
        {children}
        {/* The YouTube iframe lives here for the whole session. Hidden unless the bar expands it. */}
        <div
          aria-hidden={!showVideo}
          aria-label="YouTube video"
          role={showVideo ? "region" : undefined}
          className={
            showVideo
              ? "fixed bottom-[96px] right-4 z-40 w-[320px] overflow-hidden rounded-[12px] bg-black sm:right-[max(1.5rem,calc(50%-576px))]"
              : "pointer-events-none fixed left-0 top-0 h-px w-px overflow-hidden opacity-0"
          }
        >
          {/* videoId stays empty: the controller loads each video imperatively (see tryYouTube). */}
          <YouTube
            videoId=""
            opts={YT_OPTS}
            onReady={ctrl.youtube.onReady}
            onStateChange={ctrl.youtube.onStateChange}
            onEnd={ctrl.youtube.onEnd}
            onError={ctrl.youtube.onError}
          />
        </div>
      </PlayerVideoContext.Provider>
    </PlayerContext.Provider>
  );
}

