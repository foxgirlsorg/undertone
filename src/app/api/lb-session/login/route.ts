import { NextResponse, type NextRequest } from "next/server";
import { readAccount, signInWithPassword } from "@/lib/server/lb-session";
import { withAvatar, errorResponse, noStore, sameOrigin, withSession } from "../shared";

/*
  POST { username, password }. The password is used for one request to metabrainz.org and then
  forgotten: it is not stored, logged, or sent anywhere else. See src/lib/server/lb-session.ts.
*/
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: noStore });
  const body = (await req.json().catch(() => null)) as { username?: unknown; password?: unknown } | null;
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!username || !password || username.length > 256 || password.length > 1024) {
    return NextResponse.json({ error: "Enter your MetaBrainz username and password.", code: "credentials" }, { status: 400, headers: noStore });
  }
  try {
    const jar = await signInWithPassword(username, password);
    const account = await readAccount(jar);
    return withSession(NextResponse.json(await withAvatar(account), { headers: noStore }), jar, req);
  } catch (err) {
    return errorResponse(err);
  }
}

/** A password sign-in can take over half a minute: listenbrainz.org is slow to finish its own sign-in. */
export const maxDuration = 120;
