import { avatarHashFor } from "@/lib/server/avatar-store";

/*
  GET /api/avatar/<username>?s=<size>: redirects to the Gravatar picture of someone who signed in to
  Undertone with their password and left "Show my picture to others" on, so the picture loads straight
  from Gravatar. 204 (no content) otherwise: the page then shows the initial, and the browser doesn't
  log a failed request for every profile without a picture.
*/

const NAME_RE = /^[^/\\?#%\s]{1,64}$/u;

export async function GET(request: Request, ctx: { params: Promise<{ username: string }> }) {
  const { username } = await ctx.params;
  if (!NAME_RE.test(username)) return new Response(null, { status: 400 });

  const hash = await avatarHashFor(username).catch(() => null);
  // Short caches, so a picture appears (or goes) soon after its owner changes the setting.
  if (!hash) return new Response(null, { status: 204, headers: { "Cache-Control": "public, max-age=300" } });

  const requested = Number(new URL(request.url).searchParams.get("s")) || 128;
  const size = Math.min(512, Math.max(16, Math.round(requested)));
  // d=404: Gravatar answers 404 when the email has no picture, and the page falls back to the initial.
  return new Response(null, {
    status: 302,
    headers: {
      Location: `https://www.gravatar.com/avatar/${hash}?s=${size}&d=404`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
