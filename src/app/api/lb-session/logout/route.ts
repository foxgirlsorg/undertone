import { NextResponse, type NextRequest } from "next/server";
import { signOutSession } from "@/lib/server/lb-session";
import { jarFrom, noStore, sameOrigin, withoutSession } from "../shared";

/** Logs out on listenbrainz.org and deletes the session cookie from your browser. */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: noStore });
  const jar = jarFrom(req);
  if (jar) await signOutSession(jar);
  return withoutSession(NextResponse.json({ ok: true }, { headers: noStore }));
}
