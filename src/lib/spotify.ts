"use client";

/*
  Spotify sign-in for playback (Authorization Code + PKCE, no client secret, runs in the browser).

  Setup for the site owner (one time):
  1. Create an app at https://developer.spotify.com/dashboard.
  2. Add the redirect URI `<site origin>/spotify-callback` for every origin the site runs on
     (for local development: http://localhost:3123/spotify-callback or the port you use).
  3. Set NEXT_PUBLIC_SPOTIFY_CLIENT_ID to the app's Client ID in the environment, for example in
     `.env.local`: NEXT_PUBLIC_SPOTIFY_CLIENT_ID=your_client_id
     The client ID is public by design. There is no client secret.

  Playback uses the Spotify Web Playback SDK, which needs a Spotify Premium account.
  Tokens are kept in this browser only (localStorage key `undertone.spotify`).
*/

const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ?? "";
const AUTH_URL = "https://accounts.spotify.com/authorize";
const TOKEN_URL = "https://accounts.spotify.com/api/token";
export const SPOTIFY_SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-modify-playback-state",
  "user-read-playback-state",
];
const STORE_KEY = "undertone.spotify";
const VERIFIER_KEY = "undertone.spotify.verifier";
const STATE_KEY = "undertone.spotify.state";
/** Refresh a little before the token really expires. */
const EXPIRY_SKEW_MS = 60_000;

export type SpotifyStored = {
  accessToken: string;
  refreshToken: string;
  /** Epoch milliseconds. */
  expiresAt: number;
};

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

/** True when the site owner has set NEXT_PUBLIC_SPOTIFY_CLIENT_ID. */
export function spotifyConfigured(): boolean {
  return CLIENT_ID.trim() !== "";
}

/** The redirect URI registered with Spotify for this origin. */
export function spotifyCallbackUrl(): string {
  return `${window.location.origin}/spotify-callback`;
}

function readStored(): SpotifyStored | null {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<SpotifyStored>;
    if (typeof v.accessToken === "string" && typeof v.refreshToken === "string" && typeof v.expiresAt === "number") {
      return { accessToken: v.accessToken, refreshToken: v.refreshToken, expiresAt: v.expiresAt };
    }
  } catch {
    /* unreadable: treated as not connected */
  }
  return null;
}

function writeStored(v: SpotifyStored) {
  window.localStorage.setItem(STORE_KEY, JSON.stringify(v));
}

/** Whether a Spotify account is connected in this browser. */
export function isSpotifyConnected(): boolean {
  return readStored() !== null;
}

function randomString(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

function base64UrlEncode(buf: ArrayBuffer): string {
  let bin = "";
  for (const b of new Uint8Array(buf)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function codeChallengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64UrlEncode(digest);
}

/** Starts the sign-in: stores the PKCE verifier and state, then leaves for accounts.spotify.com. */
export async function connectSpotify(): Promise<void> {
  if (!spotifyConfigured()) throw new Error("Spotify is not set up for this site yet.");
  const verifier = randomString(64);
  const state = randomString(16);
  window.sessionStorage.setItem(VERIFIER_KEY, verifier);
  window.sessionStorage.setItem(STATE_KEY, state);
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: spotifyCallbackUrl(),
    code_challenge_method: "S256",
    code_challenge: await codeChallengeFor(verifier),
    scope: SPOTIFY_SCOPES.join(" "),
    state,
  });
  window.location.href = `${AUTH_URL}?${params.toString()}`;
}

async function postToken(body: Record<string, string>): Promise<TokenResponse & { access_token: string }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT_ID, ...body }).toString(),
  });
  const json = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !json.access_token) {
    const err = new Error(json.error_description || json.error || `Spotify refused the request (${res.status}).`);
    (err as Error & { code?: string }).code = json.error;
    throw err;
  }
  return json as TokenResponse & { access_token: string };
}

/** Completes the sign-in started by connectSpotify(). Called by /spotify-callback. */
export async function handleSpotifyCallback(code: string, state?: string | null): Promise<void> {
  const verifier = window.sessionStorage.getItem(VERIFIER_KEY);
  const expectedState = window.sessionStorage.getItem(STATE_KEY);
  window.sessionStorage.removeItem(VERIFIER_KEY);
  window.sessionStorage.removeItem(STATE_KEY);
  if (!verifier) throw new Error("This Spotify sign-in expired. Connect Spotify again.");
  if (expectedState && state !== expectedState) {
    throw new Error("The Spotify sign-in could not be verified. Connect Spotify again.");
  }
  const token = await postToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: spotifyCallbackUrl(),
    code_verifier: verifier,
  });
  writeStored({
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? "",
    expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000,
  });
}

let refreshing: Promise<string | null> | null = null;

/**
 * A valid access token, refreshed when it is about to expire. Null when Spotify is not connected
 * or the connection was revoked (then the stored tokens are removed).
 */
export async function getSpotifyToken(): Promise<string | null> {
  const stored = readStored();
  if (!stored) return null;
  if (stored.expiresAt - EXPIRY_SKEW_MS > Date.now()) return stored.accessToken;
  if (!stored.refreshToken) {
    disconnectSpotify();
    return null;
  }
  refreshing ??= (async () => {
    try {
      const token = await postToken({ grant_type: "refresh_token", refresh_token: stored.refreshToken });
      writeStored({
        accessToken: token.access_token,
        refreshToken: token.refresh_token ?? stored.refreshToken,
        expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000,
      });
      return token.access_token;
    } catch (err) {
      if ((err as Error & { code?: string }).code === "invalid_grant") disconnectSpotify();
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/** Forgets the Spotify connection in this browser. */
export function disconnectSpotify() {
  window.localStorage.removeItem(STORE_KEY);
}
