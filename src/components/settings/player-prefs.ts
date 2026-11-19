/*
  Player preferences.

  The BrainzPlayer settings are ListenBrainz's own object (BrainzPlayerSettings). ListenBrainz has no
  way for other apps to read it and replaces the whole object on POST, so the settings page always
  sends the whole object. Nothing is stored in the browser or on Undertone's server: see below.
*/
import { isSpotifyConnected } from "@/lib/spotify";

export type BrainzSourceId = BrainzPlayerSettings["dataSourcesPriority"][number];

/** Every source ListenBrainz knows about, in ListenBrainz's default order. */
export const ALL_BRAINZ_SOURCE_IDS: BrainzSourceId[] = [
  "spotify",
  "youtube",
  "soundcloud",
  "appleMusic",
  "funkwhale",
  "navidrome",
  "internetArchive",
];

/** The sources Undertone can play. */
export type PlaybackSourceId = "spotify" | "youtube" | "internet-archive";

export const DEFAULT_BRAINZ_SETTINGS: BrainzPlayerSettings = {
  youtubeEnabled: true,
  spotifyEnabled: false,
  soundcloudEnabled: false,
  appleMusicEnabled: false,
  internetArchiveEnabled: true,
  funkwhaleEnabled: false,
  navidromeEnabled: false,
  brainzplayerEnabled: true,
  notificationsEnabled: true,
  dataSourcesPriority: [...ALL_BRAINZ_SOURCE_IDS],
};

export type SourceInfo = {
  id: BrainzSourceId;
  label: string;
  note: string;
  /** Whether Undertone can play this source. */
  playable: boolean;
  enabledKey:
    | "spotifyEnabled"
    | "youtubeEnabled"
    | "soundcloudEnabled"
    | "appleMusicEnabled"
    | "internetArchiveEnabled"
    | "funkwhaleEnabled"
    | "navidromeEnabled";
};

export const SOURCE_INFO: Record<BrainzSourceId, SourceInfo> = {
  spotify: {
    id: "spotify",
    label: "Spotify",
    note: "Plays through Spotify in this browser. Needs a Spotify Premium account and a connection (see Spotify below).",
    playable: true,
    enabledKey: "spotifyEnabled",
  },
  youtube: {
    id: "youtube",
    label: "YouTube",
    note: "Plays YouTube videos. Matches are often loose.",
    playable: true,
    enabledKey: "youtubeEnabled",
  },
  internetArchive: {
    id: "internetArchive",
    label: "Internet Archive",
    note: "A free, public-domain audio archive. Needs no account.",
    playable: true,
    enabledKey: "internetArchiveEnabled",
  },
  soundcloud: {
    id: "soundcloud",
    label: "SoundCloud",
    note: "Used by ListenBrainz's own player. Undertone can't play this yet.",
    playable: false,
    enabledKey: "soundcloudEnabled",
  },
  appleMusic: {
    id: "appleMusic",
    label: "Apple Music",
    note: "Used by ListenBrainz's own player. Undertone can't play this yet.",
    playable: false,
    enabledKey: "appleMusicEnabled",
  },
  funkwhale: {
    id: "funkwhale",
    label: "Funkwhale",
    note: "Used by ListenBrainz's own player. Undertone can't play this yet.",
    playable: false,
    enabledKey: "funkwhaleEnabled",
  },
  navidrome: {
    id: "navidrome",
    label: "Navidrome",
    note: "Used by ListenBrainz's own player. Undertone can't play this yet.",
    playable: false,
    enabledKey: "navidromeEnabled",
  },
};

/** Fills in anything missing or malformed, so an object from storage is always complete. */
export function normalizeBrainzSettings(input: Partial<BrainzPlayerSettings> | null | undefined): BrainzPlayerSettings {
  const base = DEFAULT_BRAINZ_SETTINGS;
  const pick = (key: keyof Omit<BrainzPlayerSettings, "dataSourcesPriority">) =>
    typeof input?.[key] === "boolean" ? (input[key] as boolean) : base[key];
  const seen = new Set<BrainzSourceId>();
  const priority: BrainzSourceId[] = [];
  for (const id of Array.isArray(input?.dataSourcesPriority) ? input.dataSourcesPriority : []) {
    if (ALL_BRAINZ_SOURCE_IDS.includes(id) && !seen.has(id)) {
      seen.add(id);
      priority.push(id);
    }
  }
  for (const id of ALL_BRAINZ_SOURCE_IDS) if (!seen.has(id)) priority.push(id);
  return {
    youtubeEnabled: pick("youtubeEnabled"),
    spotifyEnabled: pick("spotifyEnabled"),
    soundcloudEnabled: pick("soundcloudEnabled"),
    appleMusicEnabled: pick("appleMusicEnabled"),
    internetArchiveEnabled: pick("internetArchiveEnabled"),
    funkwhaleEnabled: pick("funkwhaleEnabled"),
    navidromeEnabled: pick("navidromeEnabled"),
    brainzplayerEnabled: pick("brainzplayerEnabled"),
    notificationsEnabled: pick("notificationsEnabled"),
    dataSourcesPriority: priority,
  };
}

/*
  In-memory state for this tab only. Nothing here is written to the browser or to Undertone's server.
  With a password sign-in the settings are read from listenbrainz.org when the tab opens; with a token
  ListenBrainz can't hand them back, so a fresh tab starts from the defaults until they are saved
  (saving replaces the whole object on ListenBrainz).
*/
let current: BrainzPlayerSettings | null = null;
let submitListens = true;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function subscribePlayerPrefs(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** The defaults for a fresh tab: Spotify starts enabled when this browser has a Spotify connection. */
export function defaultBrainzSettings(): BrainzPlayerSettings {
  return { ...DEFAULT_BRAINZ_SETTINGS, spotifyEnabled: isSpotifyConnected() };
}

/** True when the settings shown are the real ones: read from listenbrainz.org, or saved in this tab. */
export function hasSavedThisTab(): boolean {
  return current !== null;
}

/** The settings saved in this tab, or the defaults. */
export function readBrainzSettingsOrDefault(): BrainzPlayerSettings {
  return current ?? defaultBrainzSettings();
}

/** Remembers, for this tab, what ListenBrainz has: just read from it, or just sent to it. */
export function rememberBrainzSettings(settings: BrainzPlayerSettings) {
  current = normalizeBrainzSettings(settings);
  emit();
}

/** The sources Undertone can play, enabled in the settings, in priority order. */
export function readEnabledPlaybackSources(): PlaybackSourceId[] {
  const s = readBrainzSettingsOrDefault();
  if (!s.brainzplayerEnabled) return [];
  const out: PlaybackSourceId[] = [];
  for (const id of s.dataSourcesPriority) {
    if (!s[SOURCE_INFO[id].enabledKey]) continue;
    if (id === "spotify") out.push("spotify");
    else if (id === "youtube") out.push("youtube");
    else if (id === "internetArchive") out.push("internet-archive");
  }
  return out;
}

/** Whether played tracks are submitted as listens. This tab only; on by default. */
export function readSubmitListens(): boolean {
  return submitListens;
}

export function writeSubmitListens(on: boolean) {
  submitListens = on;
  emit();
}

/** YouTube Data API key for searching YouTube. Set by whoever deploys Undertone, never by the user. */
export function readYoutubeApiKey(): string {
  return process.env.NEXT_PUBLIC_YOUTUBE_API_KEY ?? "";
}
