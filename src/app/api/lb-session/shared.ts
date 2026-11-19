import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { packSession, SESSION_COOKIE, SessionError, unpackSession, type Jar, type SessionAccount } from "@/lib/server/lb-session";
import { avatarOptedOut, rememberAvatar } from "@/lib/server/avatar-store";

/** listenbrainz.org keeps you signed in for a year; the cookie on this site matches that. */
const MAX_AGE = 365 * 24 * 60 * 60;

export const noStore = { "Cache-Control": "no-store" };

export function jarFrom(req: NextRequest): Jar | null {
  return unpackSession(req.cookies.get(SESSION_COOKIE)?.value);
}

/** Hands the listenbrainz.org session back to the user's browser. The server keeps no copy. */
export function withSession(res: NextResponse, jar: Jar, req: NextRequest) {
  res.cookies.set(SESSION_COOKIE, packSession(jar), {
    httpOnly: true,
    sameSite: "strict",
    secure: req.nextUrl.protocol === "https:",
    path: "/api/lb-session",
    maxAge: MAX_AGE,
  });
  return res;
}

export function withoutSession(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { path: "/api/lb-session", maxAge: 0 });
  return res;
}

export function errorResponse(err: unknown) {
  if (err instanceof SessionError) {
    const res = NextResponse.json({ error: err.message, code: err.code }, { status: err.status, headers: noStore });
    return err.code === "expired" ? withoutSession(res) : res;
  }
  return NextResponse.json(
    { error: "Couldn't reach ListenBrainz or MetaBrainz. Try again in a moment.", code: "upstream" },
    { status: 502, headers: noStore }
  );
}

/** Only accept calls from this site's own pages (no cross-site form posts). */
export function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  return !origin || origin === req.nextUrl.origin;
}

/**
 * Keeps the signed-in person's Gravatar hash for their public profile picture (the one thing the
 * server stores; see src/lib/server/avatar-store.ts) and says whether it is shown.
 */
export async function withAvatar(account: SessionAccount): Promise<SessionAccount> {
  try {
    await rememberAvatar(account.name, account.gravatarHash);
    return { ...account, avatarShared: !!account.gravatarHash && !(await avatarOptedOut(account.name)) };
  } catch {
    // A full disk or read-only host must not stop anyone signing in.
    return { ...account, avatarShared: false };
  }
}
