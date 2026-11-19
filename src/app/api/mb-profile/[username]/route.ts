import type { MBProfile } from "@/lib/mb-profile";

/*
  Server-side read of a MusicBrainz editor page (musicbrainz.org/user/<name>). MusicBrainz sends no
  CORS header, so the browser cannot read it; this route is the only server request the app makes.

  Caching: the upstream fetch uses Next's data cache with revalidate = 1 day, so each user's page is
  stored on the server and refreshed at most daily. Concurrent requests for the same name share one
  in-flight upstream fetch. The email row is never read.
*/

const MB_USER_AGENT = "Undertone/0.1 ( https://foxgirls.org )";
const DAY_SECONDS = 86400;
const NAME_RE = /^[^/\\?#%\s]{1,64}$/u;

type Outcome = { kind: "ok"; profile: MBProfile } | { kind: "missing" } | { kind: "failed" };

const inflight = new Map<string, Promise<Outcome>>();

export async function GET(_request: Request, ctx: { params: Promise<{ username: string }> }) {
  const { username } = await ctx.params;
  if (!NAME_RE.test(username)) {
    return Response.json({ error: "invalid username" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  return respond(await load(username));
}

function load(name: string): Promise<Outcome> {
  const existing = inflight.get(name);
  if (existing) return existing;
  const pending = fetchProfile(name).finally(() => inflight.delete(name));
  inflight.set(name, pending);
  return pending;
}

function respond(outcome: Outcome) {
  if (outcome.kind === "missing") {
    return Response.json({ error: "not found" }, { status: 404, headers: { "Cache-Control": "public, s-maxage=3600" } });
  }
  if (outcome.kind === "failed") {
    return Response.json({ error: "upstream unavailable" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
  return Response.json(outcome.profile, {
    headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
  });
}

/** Never throws: every failure becomes an outcome, so the shared in-flight promise always resolves. */
async function fetchProfile(name: string): Promise<Outcome> {
  const url = `https://musicbrainz.org/user/${encodeURIComponent(name)}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": MB_USER_AGENT, Accept: "text/html" },
      next: { revalidate: DAY_SECONDS },
    });
  } catch {
    return { kind: "failed" };
  }
  if (res.status === 404) return { kind: "missing" };
  if (!res.ok) return { kind: "failed" };
  try {
    const html = await res.text();
    return { kind: "ok", profile: parseProfile(html, name) };
  } catch {
    return { kind: "failed" };
  }
}

/* ---------- parsing (regexes over the known MusicBrainz editor markup; every field is optional) ---------- */

const ENTITY_NAMES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
    if (body[0] === "#") {
      const isHex = body[1] === "x" || body[1] === "X";
      const code = isHex ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return ENTITY_NAMES[body.toLowerCase()] ?? match;
  });
}

/** Text of an HTML fragment: comments and tags removed, entities decoded, whitespace collapsed. */
function plainText(html: string): string {
  return decodeEntities(html.replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]*>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

const isAvatarHost = (host: string) => host === "gravatar.com" || host.endsWith(".gravatar.com") || host === "static.metabrainz.org";

function httpsUrl(raw: string, hostOk: (host: string) => boolean): string | undefined {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || !hostOk(url.hostname)) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

function httpUrl(raw: string): string | undefined {
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? raw : undefined;
  } catch {
    return undefined;
  }
}

/** The header avatar. The default MetaBrainz placeholder (class no-avatar, editor-*.svg) is dropped. */
function parseAvatar(html: string): string | undefined {
  for (const img of html.matchAll(/<img\b([^>]*)>/gi)) {
    const attrs = img[1];
    const cls = /\bclass="([^"]*)"/i.exec(attrs)?.[1] ?? "";
    if (!/\bavatar\b/.test(cls) || /\bno-avatar\b/.test(cls)) continue;
    const src = /\bsrc="([^"]*)"/i.exec(attrs)?.[1];
    if (!src || /\/editor-[^/]*\.svg$/i.test(src)) continue;
    const url = httpsUrl(decodeEntities(src), isAvatarHost);
    if (url) return url;
  }
  return undefined;
}

/** Rows of the "General information" table, keyed by lowercase label. The email row is skipped entirely. */
function profileRows(html: string): Array<{ label: string; cell: string }> {
  const table = /<table\b[^>]*class="profileinfo"[^>]*>([\s\S]*?)<\/table>/i.exec(html);
  if (!table) return [];
  const rows: Array<{ label: string; cell: string }> = [];
  for (const tr of table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const th = /<th\b[^>]*>([\s\S]*?)<\/th>/i.exec(tr[1]);
    const td = /<td\b[^>]*>([\s\S]*?)<\/td>/i.exec(tr[1]);
    if (!th || !td) continue;
    const label = plainText(th[1]).replace(/:$/, "").trim().toLowerCase();
    if (!label || label === "email") continue;
    rows.push({ label, cell: td[1] });
  }
  return rows;
}

function parseLocation(cell: string): string | undefined {
  // Area links carry the names; the parenthesised aliases live in <span class="comment"> and are not links.
  const names = [...cell.matchAll(/<a\b[^>]*href="\/area\/[^"]*"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((m) => plainText(m[1]))
    .filter((n, i, all) => n && n !== all[i - 1]);
  const text = names.length ? names.join(", ") : plainText(cell.replace(/<span class="comment">[\s\S]*?<\/span>/gi, ""));
  return text || undefined;
}

function parseUserTypes(cell: string): string[] | undefined {
  const linked = [...cell.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => plainText(m[1])).filter(Boolean);
  const types = linked.length ? linked : plainText(cell).split(/,|\band\b/).map((t) => t.trim()).filter(Boolean);
  return types.length ? types : undefined;
}

function parseLanguages(cell: string): Array<{ name: string; level: string }> | undefined {
  const langs = [...cell.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((m) => plainText(m[1]))
    .filter(Boolean)
    .map((text) => {
      const m = /^(.*?)\s*\(([^()]*)\)$/.exec(text);
      return m ? { name: m[1].trim(), level: m[2].trim() } : { name: text, level: "" };
    })
    .filter((l) => l.name);
  return langs.length ? langs : undefined;
}

function parseProfile(html: string, name: string): MBProfile {
  const profile: MBProfile = { name };

  const avatar = parseAvatar(html);
  if (avatar) profile.avatarUrl = avatar;

  for (const { label, cell } of profileRows(html)) {
    switch (label) {
      case "user type": {
        const types = parseUserTypes(cell);
        if (types) profile.userType = types;
        break;
      }
      case "location": {
        const location = parseLocation(cell);
        if (location) profile.location = location;
        break;
      }
      case "member since": {
        const since = plainText(cell);
        if (since) profile.memberSince = since;
        break;
      }
      case "homepage": {
        if (/class="deleted"/.test(cell)) {
          profile.homepageHidden = true;
          break;
        }
        const href = /<a\b[^>]*href="([^"]*)"/i.exec(cell)?.[1];
        const homepage = httpUrl(decodeEntities(href ?? plainText(cell)).trim());
        if (homepage) profile.homepage = homepage;
        break;
      }
      case "subscribers": {
        const count = /^(\d[\d,.]*)/.exec(plainText(cell));
        if (count) profile.subscribers = Number(count[1].replace(/[,.]/g, ""));
        break;
      }
      case "bio": {
        const bio = cell.trim();
        if (plainText(bio)) profile.bioHtml = bio;
        break;
      }
      case "languages": {
        const languages = parseLanguages(cell);
        if (languages) profile.languages = languages;
        break;
      }
      default:
        break;
    }
  }
  return profile;
}
