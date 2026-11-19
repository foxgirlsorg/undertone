"use client";

import { LB_WEB_URL } from "./config";

/*
  Spotify playback uses the Spotify account you linked on listenbrainz.org (Settings > Music
  services), the same one listenbrainz.org's own player uses. Undertone has no Spotify app of its own.

  - The access token comes with your password sign-in (src/lib/server/lb-session.ts readAccount) and
    is held in memory in this tab only.
  - It lasts an hour. When it is about to run out, /api/lb-session/spotify asks listenbrainz.org for a
    fresh one; listenbrainz.org keeps the Spotify refresh token, Undertone never sees it.
  - Connecting, disconnecting and permissions are managed on listenbrainz.org.

  Playback uses the Spotify Web Playback SDK, which needs Spotify Premium and the "streaming" permission.
*/

export const SPOTIFY_SETTINGS_URL = `${LB_WEB_URL}/settings/music-services/details/`;

/** Spotify hands out tokens for an hour; renew a little before that. */
const TOKEN_LIFETIME_MS = 50 * 60 * 1000;

type Creds = { accessToken: string; permission: string[]; receivedAt: number };

let creds: Creds | null = null;
const listeners = new Set<() => void>();

/** Called by the auth provider whenever the signed-in account changes. */
export function setSpotifyCredentials(next: { accessToken: string; permission: string[] } | null) {
  creds = next ? { ...next, receivedAt: Date.now() } : null;
  listeners.forEach((fn) => fn());
}

export function subscribeSpotify(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Whether a Spotify account linked on ListenBrainz is available to play with. */
export function isSpotifyConnected(): boolean {
  return !!creds?.accessToken;
}

/** Whether the linked account allows playback here (ListenBrainz may hold a token without "streaming"). */
export function spotifyCanStream(): boolean {
  return !!creds && creds.permission.includes("streaming");
}

/** Kept for the player: Spotify can be used when the linked account allows streaming. */
export function spotifyConfigured(): boolean {
  return spotifyCanStream();
}

let refreshing: Promise<string | null> | null = null;

/** A valid access token, renewed through listenbrainz.org when it is about to expire. Null without one. */
export async function getSpotifyToken(): Promise<string | null> {
  const current = creds;
  if (!current) return null;
  if (Date.now() - current.receivedAt < TOKEN_LIFETIME_MS) return current.accessToken;
  refreshing ??= (async () => {
    try {
      const res = await fetch("/api/lb-session/spotify", { method: "POST", cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as { accessToken?: string };
      if (!res.ok || !body.accessToken) {
        // Revoked or disconnected on ListenBrainz: stop offering Spotify in this tab.
        if (res.status === 403 || res.status === 404 || res.status === 401) setSpotifyCredentials(null);
        return null;
      }
      setSpotifyCredentials({ accessToken: body.accessToken, permission: current.permission });
      return body.accessToken;
    } catch {
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/** Spotify is connected on listenbrainz.org; this opens that page. */
export async function connectSpotify(): Promise<void> {
  window.open(SPOTIFY_SETTINGS_URL, "_blank", "noopener,noreferrer");
}

/** Disconnecting also happens on listenbrainz.org. */
export function disconnectSpotify() {
  window.open(SPOTIFY_SETTINGS_URL, "_blank", "noopener,noreferrer");
}
