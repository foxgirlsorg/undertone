import { NextResponse, type NextRequest } from "next/server";
import { readMusicBrainzHomepage } from "@/lib/server/lb-session";
import { jarFrom, noStore, withSession } from "../../shared";

const NAME_RE = /^[^/\?#%\s]{1,64}$/u;

/**
 * GET: an editor's homepage as musicbrainz.org shows it to logged-in people, read with the viewer's own
 * musicbrainz.org session. Answers { homepage: null } when there is none or the viewer can't see it.
 * Nothing is cached: what a logged-in viewer sees is not shared with anyone else.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ username: string }> }) {
  const { username } = await ctx.params;
  if (!NAME_RE.test(username)) return NextResponse.json({ homepage: null }, { status: 400, headers: noStore });
  const jar = jarFrom(req);
  if (!jar) return NextResponse.json({ homepage: null }, { headers: noStore });
  try {
    const homepage = await readMusicBrainzHomepage(jar, username);
    return withSession(NextResponse.json({ homepage }, { headers: noStore }), jar, req);
  } catch {
    return NextResponse.json({ homepage: null }, { headers: noStore });
  }
}

/** Reads from listenbrainz.org, which can be slow. */
export const maxDuration = 60;
