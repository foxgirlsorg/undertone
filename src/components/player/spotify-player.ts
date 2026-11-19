"use client";

/*
  Spotify Web Playback SDK and Web API calls used by the player (see src/lib/spotify.ts for sign-in).
  This module knows nothing about React or the queue: the controller in player-provider.tsx drives it.
*/

const SDK_URL = "https://sdk.scdn.co/spotify-player.js";
const CONNECT_TIMEOUT_MS = 15000;
export const SPOTIFY_PREMIUM_MESSAGE = "Spotify playback needs a Premium account";

export type SpotifyState = {
  paused: boolean;
  position: number;
  duration: number;
  track_window: {
    current_track: { id: string | null; uri: string; name: string };
    previous_tracks: Array<{ id: string | null; uri: string }>;
  };
};

type Listener = (payload: unknown) => void;

/** The subset of the Web Playback SDK player that Undertone uses. */
export type SdkPlayer = {
  connect(): Promise<boolean>;
  disconnect(): void;
  addListener(event: string, cb: Listener): boolean;
  getCurrentState(): Promise<SpotifyState | null>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  setVolume(volume: number): Promise<void>;
};

declare global {
  interface Window {
    Spotify?: {
      Player: new (options: {
        name: string;
        volume?: number;
        getOAuthToken: (cb: (token: string) => void) => void;
      }) => SdkPlayer;
    };
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

export type SpotifyDevice = {
  player: SdkPlayer;
  /** Empty while the device is not ready (after "not_ready"). */
  deviceId: string;
};

export type SpotifyEvents = {
  state: (state: SpotifyState) => void;
  notReady: () => void;
  /** Premium is needed: the account cannot use the Web Playback SDK. */
  premium: () => void;
  /** A playback or authentication problem after the device was ready. */
  failure: (message: string) => void;
};

export class SpotifyError extends Error {
  premium: boolean;
  constructor(message: string, premium = false) {
    super(message);
    this.name = "SpotifyError";
    this.premium = premium;
  }
}

let sdkPromise: Promise<void> | null = null;

/** Loads the SDK script once per page. */
export function loadSpotifySdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new SpotifyError("Spotify needs a browser."));
  if (window.Spotify) return Promise.resolve();
  sdkPromise ??= new Promise<void>((resolve, reject) => {
    const previous = window.onSpotifyWebPlaybackSDKReady;
    window.onSpotifyWebPlaybackSDKReady = () => {
      previous?.();
      resolve();
    };
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_URL}"]`);
    if (!existing) {
      const script = document.createElement("script");
      script.src = SDK_URL;
      script.async = true;
      script.onerror = () => {
        sdkPromise = null;
        reject(new SpotifyError("The Spotify player could not be loaded. Check your connection or content blocker."));
      };
      document.body.appendChild(script);
    }
  });
  return sdkPromise;
}

const messageOf = (payload: unknown, fallback: string) => {
  const m = (payload as { message?: unknown } | null)?.message;
  return typeof m === "string" && m ? m : fallback;
};

/**
 * Creates the "Undertone" Spotify device and resolves once it is ready. Later events go to `events`.
 * Rejects with a SpotifyError when the device cannot start (for example no Premium account).
 */
export async function connectSpotifyDevice(
  getToken: () => Promise<string | null>,
  volume: number,
  events: SpotifyEvents
): Promise<SpotifyDevice> {
  await loadSpotifySdk();
  const Spotify = window.Spotify;
  if (!Spotify) throw new SpotifyError("The Spotify player did not load.");

  return new Promise<SpotifyDevice>((resolve, reject) => {
    const player = new Spotify.Player({
      name: "Undertone",
      volume: Math.min(1, Math.max(0, volume / 100)),
      getOAuthToken: (cb) => {
        getToken()
          .then((token) => cb(token ?? ""))
          .catch(() => cb(""));
      },
    });
    const device: SpotifyDevice = { player, deviceId: "" };
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      player.disconnect();
      reject(new SpotifyError("The Spotify player did not start. Try again."));
    }, CONNECT_TIMEOUT_MS);

    const fail = (message: string, premium: boolean) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        player.disconnect();
        reject(new SpotifyError(premium ? SPOTIFY_PREMIUM_MESSAGE : message, premium));
        return;
      }
      if (premium) events.premium();
      else events.failure(message);
    };

    player.addListener("ready", (payload) => {
      device.deviceId = (payload as { device_id?: string } | null)?.device_id ?? "";
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(device);
      }
    });
    player.addListener("not_ready", () => {
      device.deviceId = "";
      events.notReady();
    });
    player.addListener("player_state_changed", (payload) => {
      if (payload) events.state(payload as SpotifyState);
    });
    player.addListener("initialization_error", (p) => fail(messageOf(p, "Spotify could not start in this browser."), false));
    player.addListener("authentication_error", (p) => fail(messageOf(p, "Spotify sign-in expired. Connect again."), false));
    player.addListener("account_error", () => fail(SPOTIFY_PREMIUM_MESSAGE, true));
    player.addListener("playback_error", (p) => {
      if (settled) events.failure(messageOf(p, "Spotify playback failed."));
    });
    player.connect().then((ok) => {
      if (!ok) fail("Could not connect to Spotify.", false);
    }).catch((err: unknown) => fail(messageOf(err, "Could not connect to Spotify."), false));
  });
}

/** A Spotify track URI from a listen's metadata (`spotify_id` or an open.spotify.com origin_url). */
export function spotifyUriFromInfo(
  info: { spotify_id?: string | null; origin_url?: string | null } | undefined
): string | undefined {
  const candidates = [info?.spotify_id, info?.origin_url];
  for (const raw of candidates) {
    if (typeof raw !== "string" || !raw) continue;
    const m = /(?:open\.spotify\.com\/track\/|spotify:track:)([A-Za-z0-9]{22})/.exec(raw) ?? /^([A-Za-z0-9]{22})$/.exec(raw);
    if (m) return `spotify:track:${m[1]}`;
  }
  return undefined;
}

/** Finds the best Spotify track URI for a name and artist. Undefined when Spotify has no match. */
export async function searchSpotifyTrackUri(
  token: string,
  trackName: string,
  artistName: string
): Promise<string | undefined> {
  const q = artistName ? `track:${trackName} artist:${artistName}` : `track:${trackName}`;
  const params = new URLSearchParams({ type: "track", limit: "1", q });
  const res = await fetch(`https://api.spotify.com/v1/search?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new SpotifyError(`Spotify search failed (${res.status}).`);
  const body = (await res.json()) as { tracks?: { items?: Array<{ uri?: string }> } };
  return body.tracks?.items?.[0]?.uri;
}

export type PlayResult = "ok" | "premium" | "device" | "auth" | "error";

/** Starts a track on the Undertone device. */
export async function playSpotifyUri(token: string, deviceId: string, uri: string): Promise<PlayResult> {
  const params = new URLSearchParams({ device_id: deviceId });
  const res = await fetch(`https://api.spotify.com/v1/me/player/play?${params.toString()}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ uris: [uri] }),
  });
  if (res.ok) return "ok";
  if (res.status === 403) return "premium";
  if (res.status === 404) return "device";
  if (res.status === 401) return "auth";
  return "error";
}
