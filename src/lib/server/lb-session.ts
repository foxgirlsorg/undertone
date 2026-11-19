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

export class SessionError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: "credentials" | "captcha" | "consent" | "expired" | "upstream"
  ) {
    super(message);
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

/** fetch that follows redirects by hand, so cookies set on every hop are kept in the jar. */
async function go(jar: Jar, url: string, init: RequestInit = {}, maxHops = 10): Promise<Hop> {
  let current = url;
  let req: RequestInit = init;
  for (let i = 0; i <= maxHops; i++) {
    const headers = new Headers(req.headers);
    headers.set("User-Agent", UA);
    const cookie = cookieHeader(jar, current);
    if (cookie) headers.set("Cookie", cookie);
    else headers.delete("Cookie");
    const res = await fetch(current, { ...req, headers, redirect: "manual", cache: "no-store" });
    absorb(jar, current, res);
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      await res.body?.cancel();
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

/** Only the listenbrainz.org cookies leave this file, packed for the user's browser. */
export function packSession(jar: Jar): string {
  const lb: Record<string, string> = {};
  for (const [k, c] of jar) if (c.domain === LB_HOST || c.domain.endsWith(`.${LB_HOST}`)) lb[k.split("|")[1]] = c.value;
  return Buffer.from(JSON.stringify(lb)).toString("base64url");
}

export function unpackSession(packed: string | undefined): Jar | null {
  if (!packed) return null;
  try {
    const lb = JSON.parse(Buffer.from(packed, "base64url").toString("utf8")) as Record<string, unknown>;
    const jar: Jar = new Map();
    for (const [name, value] of Object.entries(lb)) {
      if (typeof value === "string" && /^[\w.-]+$/.test(name)) jar.set(keyOf(LB_HOST, name), { domain: LB_HOST, value });
    }
    return jar.size ? jar : null;
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
  const post = await fetch(`${MEB}/login`, {
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
  const lb = await go(jar, `${LB}/login/musicbrainz/`);
  if (new URL(lb.url).hostname.endsWith("metabrainz.org")) {
    await lb.res.body?.cancel();
    throw new SessionError(
      "MetaBrainz wants you to allow ListenBrainz first. Sign in once on listenbrainz.org, then try again here.",
      409,
      "consent"
    );
  }
  await lb.res.body?.cancel();

  // The MetaBrainz session is not needed any more.
  for (const [k, c] of jar) if (!c.domain.endsWith(LB_HOST)) jar.delete(k);
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
  brainzplayer: BrainzPlayerSettings | null;
  flair: unknown;
  timezone: string | null;
  troi: { export_to_spotify?: boolean } | null;
};

type GlobalProps = {
  current_user?: { name?: string; auth_token?: string };
  user_preferences?: BrainzPlayerSettings;
  flair?: unknown;
  musicbrainz?: { access_token?: string };
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
    postJson<{ user_timezone?: string }>(jar, "/settings/select_timezone/"),
    postJson<{ troi_prefs?: { export_to_spotify?: boolean } }>(jar, "/settings/troi/"),
    props?.musicbrainz?.access_token
      ? fetch(`${MEB}/oauth2/userinfo`, {
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
    troi: troi?.troi_prefs ?? null,
  };
}
