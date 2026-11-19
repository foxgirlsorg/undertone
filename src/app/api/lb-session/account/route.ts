import { NextResponse, type NextRequest } from "next/server";
import { readAccount } from "@/lib/server/lb-session";
import { withAvatar, errorResponse, jarFrom, noStore, withSession } from "../shared";

/** Reads your own settings and email from listenbrainz.org with the session cookie your browser sent. */
export async function GET(req: NextRequest) {
  const jar = jarFrom(req);
  // No password session is the normal case (token sign-in or signed out): answer quietly.
  if (!jar) return new NextResponse(null, { status: 204, headers: noStore });
  try {
    const account = await readAccount(jar);
    // listenbrainz.org may refresh its cookies; pass the fresh ones back to the browser.
    return withSession(NextResponse.json(await withAvatar(account), { headers: noStore }), jar, req);
  } catch (err) {
    return errorResponse(err);
  }
}

/** Reads from listenbrainz.org, which can be slow. */
export const maxDuration = 60;
