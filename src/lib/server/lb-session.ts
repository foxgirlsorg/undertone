import "server-only";
import crypto from "node:crypto";

/*
  Password sign-in, done the way a browser would do it on listenbrainz.org.

  Why on the server: listenbrainz.org's settings pages and metabrainz.org's login form send no CORS
  headers, and their cookies are HttpOnly and tied to their own domains, so a page on another site
  can neither log in there nor read the answers. This file does the same requests a browser would,
  and nothing more.

  What is kept, and where:
  - The password is used for one request to metabrainz.org/login and then dropped. It is never
    written anywhere, logged, or sent to any other host.
  - The metabrainz.org session from that login is dropped as soon as listenbrainz.org has logged in.
  - The listenbrainz.org session cookies are handed back to the user's own browser, in one HttpOnly
    cookie on this site (see SESSION_COOKIE). The server keeps no copy: every later request reads
    them from that cookie, uses them, and forgets them.
*/

export const SESSION_COOKIE = "undertone_lb_session";
export const UA = "Undertone/0.1 ( https://github.com/foxgirlsorg/undertone )";

const MEB = "https://metabrainz.org";
const LB = "https://listenbrainz.org";
const LB_HOST = "listenbrainz.org";
const MB = "https://musicbrainz.org";
const MB_HOST = "musicbrainz.org";
const onHost = (domain: string, host: string) => domain === host || domain.endsWith(`.${host}`);

export class SessionError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: "credentials" | "captcha" | "consent" | "expired" | "upstream"
  ) {
    super(message);
  }
}

/* ------------------------------------------------------------------ outgoing requests */

const TIMEOUT_MS = 15_000;
/** listenbrainz.org's sign-in callback trades the code for a token and updates the account before it answers. */
const SLOW_PATHS: Record<string, number> = { "/login/musicbrainz/post/": 60_000 };
/** Set LB_SESSION_DEBUG=1 to print each outgoing request's method, host and path (never queries, cookies or bodies). */
const DEBUG = process.env.LB_SESSION_DEBUG === "1";

/** fetch with a time limit, so a slow upstream fails with a message instead of hanging the sign-in. */
async function send(url: string, init: RequestInit, retry = (init.method ?? "GET") === "GET"): Promise<Response> {
  const u = new URL(url);
  const label = `${init.method ?? "GET"} ${u.host}${u.pathname}`;
  const started = Date.now();
  if (DEBUG) console.info(`[lb-session] -> ${label}`);
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(SLOW_PATHS[u.pathname] ?? TIMEOUT_MS) });
    if (DEBUG) console.info(`[lb-session] <- ${label} ${res.status} ${Date.now() - started}ms${res.headers.get("location") ? ` -> ${new URL(res.headers.get("location")!, url).host}${new URL(res.headers.get("location")!, url).pathname}` : ""}`);
    return res;
  } catch (err) {
    if (DEBUG) console.info(`[lb-session] !! ${label} ${(err as Error).name} ${Date.now() - started}ms`);
    if ((err as Error).name === "TimeoutError" || (err as Error).name === "AbortError") {
      throw new SessionError(`${u.host} didn't answer in time. Try again in a moment.`, 504, "upstream");
    }
    // A dropped connection (often a stale keep-alive socket) is worth one more try for a GET.
    if (retry) return send(url, init, false);
    throw new SessionError(`Couldn't reach ${u.host}. Try again in a moment.`, 502, "upstream");
  }
}

/* ------------------------------------------------------------------ cookie jar (one request only) */

type Cookie = { domain: string; value: string };
export type Jar = Map<string, Cookie>; // key: `${domain}|${name}`

const keyOf = (domain: string, name: string) => `${domain}|${name}`;

function absorb(jar: Jar, url: string, res: Response) {
  const host = new URL(url).hostname;
  for (const raw of res.headers.getSetCookie()) {
    const [pair, ...attrs] = raw.split(";");
    const eq = pair.indexOf("=");
    if (eq < 1) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    let domain = host;
    let expired = value === "";
    for (const a of attrs) {
      const [k, v = ""] = a.trim().split("=");
      const key = k.toLowerCase();
      if (key === "domain" && v) domain = v.replace(/^\./, "").toLowerCase();
      if (key === "max-age" && Number(v) <= 0) expired = true;
      if (key === "expires" && Date.parse(v) < Date.now()) expired = true;
    }
    if (expired) jar.delete(keyOf(domain, name));
    else jar.set(keyOf(domain, name), { domain, value });
  }
}

function cookieHeader(jar: Jar, url: string) {
  const host = new URL(url).hostname;
  const out: string[] = [];
  for (const [k, c] of jar) {
    if (host === c.domain || host.endsWith(`.${c.domain}`)) out.push(`${k.split("|")[1]}=${c.value}`);
  }
  return out.join("; ");
}

type Hop = { res: Response; url: string };

/**
 * fetch that follows redirects by hand, so cookies set on every hop are kept in the jar.
 * `stopAfter` ends the chain once a response from a matching URL has been read (its cookies kept).
 */
async function go(jar: Jar, url: string, init: RequestInit = {}, maxHops = 10, stopAfter?: (url: URL) => boolean): Promise<Hop> {
  let current = url;
  let req: RequestInit = init;
  for (let i = 0; i <= maxHops; i++) {
    const headers = new Headers(req.headers);
    headers.set("User-Agent", UA);
    const cookie = cookieHeader(jar, current);
    if (cookie) headers.set("Cookie", cookie);
    else headers.delete("Cookie");
    const res = await send(current, { ...req, headers, redirect: "manual", cache: "no-store" });
    absorb(jar, current, res);
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      await res.body?.cancel();
      if (stopAfter?.(new URL(current))) return { res, url: current };
      current = new URL(location, current).toString();
      req = { method: "GET" }; // a redirect after a POST is a GET
      continue;
    }
    return { res, url: current };
  }
  throw new SessionError("Too many redirects while signing in.", 502, "upstream");
}

/** Reads <script id="..." type="application/json"> from a page. */
function scriptJson<T>(html: string, id: string): T | null {
  const m = html.match(new RegExp(`<script[^>]*id="${id}"[^>]*>([\\s\\S]*?)</script>`));
  if (!m) return null;
  try {
    return JSON.parse(m[1]) as T;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ the cookie we hand back */

/**
 * Only the listenbrainz.org and musicbrainz.org cookies leave this file, packed for the user's browser.
 * The musicbrainz.org ones let a signed-in viewer see what musicbrainz.org shows only to logged-in people
 * (homepages of new editors, which it hides from anonymous visitors against spam).
 */
export function packSession(jar: Jar): string {
  const lb: Record<string, string> = {};
  const mb: Record<string, string> = {};
  for (const [k, c] of jar) {
    if (onHost(c.domain, LB_HOST)) lb[k.split("|")[1]] = c.value;
    else if (onHost(c.domain, MB_HOST)) mb[k.split("|")[1]] = c.value;
  }
  return Buffer.from(JSON.stringify({ lb, mb })).toString("base64url");
}

export function unpackSession(packed: string | undefined): Jar | null {
  if (!packed) return null;
  try {
    const raw = JSON.parse(Buffer.from(packed, "base64url").toString("utf8")) as Record<string, unknown>;
    // Older cookies held only the listenbrainz.org cookies, flat.
    const parts = raw && typeof raw.lb === "object" ? { lb: raw.lb, mb: raw.mb } : { lb: raw, mb: {} };
    const jar: Jar = new Map();
    for (const [host, group] of [[LB_HOST, parts.lb], [MB_HOST, parts.mb]] as const) {
      if (!group || typeof group !== "object") continue;
      for (const [name, value] of Object.entries(group as Record<string, unknown>)) {
        if (typeof value === "string" && /^[\w.-]+$/.test(name)) jar.set(keyOf(host, name), { domain: host, value });
      }
    }
    return [...jar.values()].some((c) => c.domain === LB_HOST) ? jar : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ sign in */

type LoginPageProps = { csrf_token?: string; mtcaptcha_site_key?: string; initial_errors?: Record<string, string[] | string> };

/** Logs in on metabrainz.org, then on listenbrainz.org. Returns a jar holding the listenbrainz.org session. */
export async function signInWithPassword(username: string, password: string): Promise<Jar> {
  const jar: Jar = new Map();

  // 1. The MetaBrainz login form, for its anti-forgery token.
  const form = await go(jar, `${MEB}/login`);
  const formProps = scriptJson<LoginPageProps>(await form.res.text(), "page-react-props");
  if (!formProps?.csrf_token) throw new SessionError("MetaBrainz's login page changed, so password sign-in can't work right now. Use a token instead.", 502, "upstream");
  if (formProps.mtcaptcha_site_key) {
    throw new SessionError("MetaBrainz is asking for a captcha, which only its own site can show. Sign in with your token instead.", 409, "captcha");
  }

  // 2. Submit it. Success is a redirect; failure re-renders the form with errors.
  const body = new URLSearchParams({ username, password, remember_me: "y", csrf_token: formProps.csrf_token });
  const headers = { "Content-Type": "application/x-www-form-urlencoded", Origin: MEB, Referer: `${MEB}/login` };
  const cookie = cookieHeader(jar, `${MEB}/login`);
  const post = await send(`${MEB}/login`, {
    method: "POST",
    body,
    headers: { ...headers, "User-Agent": UA, ...(cookie ? { Cookie: cookie } : {}) },
    redirect: "manual",
    cache: "no-store",
  });
  absorb(jar, `${MEB}/login`, post);
  if (!(post.status >= 300 && post.status < 400)) {
    const again = scriptJson<LoginPageProps>(await post.text(), "page-react-props");
    if (again?.mtcaptcha_site_key) throw new SessionError("MetaBrainz is asking for a captcha, which only its own site can show. Sign in with your token instead.", 409, "captcha");
    const first = Object.values(again?.initial_errors ?? {}).flat()[0];
    throw new SessionError(
      typeof first === "string" && first ? `MetaBrainz says: ${first}` : "MetaBrainz didn't accept that username and password.",
      401,
      "credentials"
    );
  }
  await post.body?.cancel();

  // 3. listenbrainz.org's own "Sign in with MetaBrainz", which ends back on listenbrainz.org.
  // Stop once its callback has answered: the session cookie is set there, and loading the homepage it
  // redirects to only adds seconds.
  const lb = await go(jar, `${LB}/login/musicbrainz/`, {}, 10, (u) => u.hostname === LB_HOST && u.pathname === "/login/musicbrainz/post/");
  if (new URL(lb.url).hostname.endsWith("metabrainz.org")) {
    await lb.res.body?.cancel();
    throw new SessionError(
      "MetaBrainz wants you to allow ListenBrainz first. Sign in once on listenbrainz.org, then try again here.",
      409,
      "consent"
    );
  }
  await lb.res.body?.cancel();

  // 4. musicbrainz.org's own "Log in" (also through MetaBrainz). Optional: it only lets signed-in viewers
  // see homepages musicbrainz.org hides from anonymous visitors, so a failure here is ignored.
  try {
    const mb = await go(jar, `${MB}/login`, {}, 10, (u) => u.hostname === MB_HOST && u.pathname.startsWith("/metabrainz/oauth2/callback"));
    await mb.res.body?.cancel();
  } catch {
    /* sign-in still succeeds without it */
  }

  // The MetaBrainz session is not needed any more.
  for (const [k, c] of jar) if (!onHost(c.domain, LB_HOST) && !onHost(c.domain, MB_HOST)) jar.delete(k);
  return jar;
}

/** Logs out on listenbrainz.org, so the session stops working there too. */
export async function signOutSession(jar: Jar) {
  try {
    const r = await go(jar, `${LB}/login/logout/`, {}, 3);
    await r.res.body?.cancel();
  } catch {
    /* the cookie is dropped on our side either way */
  }
}

/* ------------------------------------------------------------------ what the session can read */

export type SessionAccount = {
  name: string;
  token: string;
  email: string | null;
  emailVerified: boolean;
  /** SHA-256 of the trimmed, lower-cased email, for Gravatar. */
  gravatarHash: string | null;
  /** Whether other people see this Gravatar on the profile (see avatar-store.ts). Filled in by the routes. */
  avatarShared?: boolean;
  brainzplayer: BrainzPlayerSettings | null;
  flair: unknown;
  timezone: string | null;
  /** ListenBrainz's own list of timezone names (PostgreSQL's), so the picker offers exactly what it accepts. */
  timezones: string[];
  troi: { export_to_spotify?: boolean } | null;
  /**
   * The Spotify account linked on listenbrainz.org (Settings > Music services), exactly as
   * listenbrainz.org hands it to its own player. The token lasts an hour; refreshSpotify() renews it.
   */
  spotify: { accessToken: string; permission: string[] } | null;
  /** The YouTube Data API key listenbrainz.org's own player uses for search. */
  youtubeApiKey: string | null;
  /** The Navidrome server linked on listenbrainz.org, with a Subsonic token (never the password). */
  navidrome: { instanceUrl: string; username: string; token: string; salt: string } | null;
};

type GlobalProps = {
  current_user?: { name?: string; auth_token?: string };
  user_preferences?: BrainzPlayerSettings;
  flair?: unknown;
  musicbrainz?: { access_token?: string };
  spotify?: { access_token?: string; permission?: string[] };
  youtube?: { api_key?: string };
  navidrome?: { instance_url?: string; username?: string; md5_auth_token?: string; salt?: string };
};

async function postJson<T>(jar: Jar, path: string): Promise<T | null> {
  const r = await go(jar, `${LB}${path}`, { method: "POST", headers: { Accept: "application/json" } }, 2);
  if (!r.res.ok || new URL(r.url).pathname !== path) {
    await r.res.body?.cancel();
    return null;
  }
  return (await r.res.json().catch(() => null)) as T | null;
}

/** Reads the signed-in user's own account data with the session in `jar` (the jar may be refreshed). */
export async function readAccount(jar: Jar): Promise<SessionAccount> {
  const page = await go(jar, `${LB}/settings/`, {}, 4);
  const html = await page.res.text();
  const props = scriptJson<GlobalProps>(html, "global-react-props");
  const name = props?.current_user?.name;
  const token = props?.current_user?.auth_token;
  if (!name || !token || new URL(page.url).pathname.startsWith("/login")) {
    throw new SessionError("Your ListenBrainz session has ended. Sign in again.", 401, "expired");
  }

  const [tz, troi, profile] = await Promise.all([
    postJson<{ user_timezone?: string; pg_timezones?: Array<[string, unknown] | string> }>(jar, "/settings/select_timezone/"),
    postJson<{ troi_prefs?: { export_to_spotify?: boolean } }>(jar, "/settings/troi/"),
    props?.musicbrainz?.access_token
      ? send(`${MEB}/oauth2/userinfo`, {
          headers: { Authorization: `Bearer ${props.musicbrainz.access_token}`, "User-Agent": UA },
          cache: "no-store",
        })
          .then((r) => (r.ok ? (r.json() as Promise<{ email?: string; email_verified?: boolean }>) : null))
          .catch(() => null)
      : Promise.resolve(null),
  ]);

  const email = profile?.email?.trim() || null;
  return {
    name,
    token,
    email,
    emailVerified: profile?.email_verified === true,
    gravatarHash: email ? crypto.createHash("sha256").update(email.toLowerCase()).digest("hex") : null,
    brainzplayer: props?.user_preferences ?? null,
    flair: props?.flair ?? null,
    timezone: tz?.user_timezone ?? null,
    timezones: Array.isArray(tz?.pg_timezones)
      ? tz.pg_timezones.map((z) => (Array.isArray(z) ? z[0] : z)).filter((z): z is string => typeof z === "string")
      : [],
    troi: troi?.troi_prefs ?? null,
    spotify: props?.spotify?.access_token
      ? { accessToken: props.spotify.access_token, permission: Array.isArray(props.spotify.permission) ? props.spotify.permission : [] }
      : null,
    youtubeApiKey: props?.youtube?.api_key || null,
    navidrome:
      props?.navidrome?.instance_url && props.navidrome.username && props.navidrome.md5_auth_token && props.navidrome.salt
        ? {
            instanceUrl: props.navidrome.instance_url,
            username: props.navidrome.username,
            token: props.navidrome.md5_auth_token,
            salt: props.navidrome.salt,
          }
        : null,
  };
}

/** A fresh Spotify access token from listenbrainz.org, which keeps the Spotify refresh token itself. */
export async function refreshSpotify(jar: Jar): Promise<string> {
  const path = "/settings/music-services/spotify/refresh/";
  const r = await go(jar, `${LB}${path}`, { method: "POST", headers: { Accept: "application/json" } }, 2);
  if (new URL(r.url).pathname !== path || r.res.status === 401) {
    await r.res.body?.cancel();
    throw new SessionError("Your ListenBrainz session has ended. Sign in again.", 401, "expired");
  }
  const body = (await r.res.json().catch(() => null)) as { access_token?: string; error?: string } | null;
  if (!r.res.ok || !body?.access_token) {
    const status = r.res.status === 404 || r.res.status === 403 ? r.res.status : 502;
    throw new SessionError(
      status === 404
        ? "Spotify isn't connected on ListenBrainz. Connect it in ListenBrainz's music services settings."
        : status === 403
          ? "Spotify access was revoked. Connect Spotify again in ListenBrainz's music services settings."
          : body?.error ?? "Couldn't refresh the Spotify connection. Try again in a moment.",
      status,
      "upstream"
    );
  }
  return body.access_token;
}

/* ------------------------------------------------------------------ musicbrainz.org, as the viewer */

/**
 * The homepage on a musicbrainz.org editor page, read with the viewer's own musicbrainz.org session.
 * musicbrainz.org hides new editors' homepages from anonymous visitors only; logged-in people see them.
 * Null when there is none, or when the viewer's musicbrainz.org session has ended.
 */
export async function readMusicBrainzHomepage(jar: Jar, name: string): Promise<string | null> {
  if (![...jar.values()].some((c) => c.domain === MB_HOST)) return null;
  const r = await go(jar, `${MB}/user/${encodeURIComponent(name)}`, { headers: { Accept: "text/html" } }, 2);
  if (!r.res.ok || new URL(r.url).hostname !== MB_HOST) {
    await r.res.body?.cancel();
    return null;
  }
  const html = await r.res.text();
  const row = /<tr>\s*<th>\s*Homepage:?\s*<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/i.exec(html);
  if (!row || /class="deleted"/.test(row[1])) return null;
  const href = /<a\b[^>]*href="([^"]+)"/i.exec(row[1])?.[1] ?? row[1].replace(/<[^>]*>/g, "").trim();
  const url = href.replace(/&amp;/g, "&").trim();
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}
