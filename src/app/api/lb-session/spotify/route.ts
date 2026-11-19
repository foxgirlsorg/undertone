import { NextResponse, type NextRequest } from "next/server";
import { refreshSpotify } from "@/lib/server/lb-session";
import { errorResponse, jarFrom, noStore, sameOrigin, withSession } from "../shared";

/**
 * POST: a fresh access token for the Spotify account linked on listenbrainz.org. listenbrainz.org
 * keeps the Spotify refresh token; Undertone only passes the hour-long access token to your browser.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: noStore });
  const jar = jarFrom(req);
  if (!jar) return NextResponse.json({ error: "Sign in with your password to play through Spotify." }, { status: 401, headers: noStore });
  try {
    const accessToken = await refreshSpotify(jar);
    return withSession(NextResponse.json({ accessToken }, { headers: noStore }), jar, req);
  } catch (err) {
    return errorResponse(err);
  }
}

/** Reads from listenbrainz.org, which can be slow. */
export const maxDuration = 60;
