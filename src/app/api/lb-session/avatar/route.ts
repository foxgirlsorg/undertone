import { NextResponse, type NextRequest } from "next/server";
import { readAccount } from "@/lib/server/lb-session";
import { setAvatarShared } from "@/lib/server/avatar-store";
import { errorResponse, jarFrom, noStore, sameOrigin, withSession } from "../shared";

/**
 * POST { shared: boolean }: "Show my picture to others". Only the signed-in person can change it, and
 * the username comes from their own listenbrainz.org session, never from the request.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: noStore });
  const jar = jarFrom(req);
  if (!jar) return NextResponse.json({ error: "Sign in with your password to change this." }, { status: 401, headers: noStore });
  const body = (await req.json().catch(() => null)) as { shared?: unknown } | null;
  if (typeof body?.shared !== "boolean") {
    return NextResponse.json({ error: "Expected { shared: boolean }." }, { status: 400, headers: noStore });
  }
  try {
    const account = await readAccount(jar);
    await setAvatarShared(account.name, account.gravatarHash, body.shared);
    const avatarShared = body.shared && !!account.gravatarHash;
    return withSession(NextResponse.json({ ...account, avatarShared }, { headers: noStore }), jar, req);
  } catch (err) {
    return errorResponse(err);
  }
}

/** Reads from listenbrainz.org, which can be slow. */
export const maxDuration = 60;
