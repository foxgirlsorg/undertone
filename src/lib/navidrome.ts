"use client";

/*
  Navidrome playback, with the Navidrome server you connected on listenbrainz.org (Settings > Music
  services). listenbrainz.org hands its own player the server address, your Navidrome username and a
  Subsonic token (md5 of your Navidrome password plus a random salt; the password itself never leaves
  listenbrainz.org). Undertone gets the same from your password sign-in and keeps it in memory only.

  Tracks are found with the Subsonic search3 call and played from the stream URL in an <audio> element.
  If Undertone runs on https and your Navidrome on plain http, the browser blocks the stream.
*/

export type NavidromeCreds = { instanceUrl: string; username: string; token: string; salt: string };

let creds: NavidromeCreds | null = null;

export function setNavidromeCredentials(next: NavidromeCreds | null) {
  creds = next;
}

export function isNavidromeConnected() {
  return !!creds;
}

function apiUrl(method: string, params: Record<string, string>) {
  if (!creds) throw new Error("Navidrome isn't connected");
  const qs = new URLSearchParams({
    u: creds.username,
    t: creds.token,
    s: creds.salt,
    v: "1.16.1",
    c: "Undertone",
    f: "json",
    ...params,
  });
  return `${creds.instanceUrl.replace(/\/+$/, "")}/rest/${method}?${qs.toString()}`;
}

type SubsonicSong = { id: string; title?: string; artist?: string; album?: string; duration?: number };

const norm = (s: string | undefined) =>
  (s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s*[([].*?[)\]]\s*/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** A stream URL for the best match in your Navidrome library, or undefined when there is none. */
export async function findNavidromeStream(title: string, artist: string, album?: string): Promise<string | undefined> {
  if (!creds || !title) return undefined;
  const res = await fetch(apiUrl("search3", { query: `${title} ${artist}`.trim(), songCount: "20", artistCount: "0", albumCount: "0" }));
  if (!res.ok) return undefined;
  const body = (await res.json().catch(() => null)) as {
    "subsonic-response"?: { status?: string; searchResult3?: { song?: SubsonicSong[] } };
  } | null;
  const songs = body?.["subsonic-response"]?.status === "ok" ? body["subsonic-response"].searchResult3?.song ?? [] : [];
  const t = norm(title);
  const a = norm(artist);
  const scored = songs
    .map((song) => {
      let score = 0;
      if (norm(song.title) === t) score += 4;
      else if (norm(song.title).includes(t) || t.includes(norm(song.title))) score += 2;
      if (a && (norm(song.artist).includes(a) || a.includes(norm(song.artist)))) score += 3;
      if (album && norm(song.album) === norm(album)) score += 1;
      return { song, score };
    })
    .filter((x) => x.score >= 5)
    .sort((x, y) => y.score - x.score);
  const best = scored[0]?.song;
  return best ? apiUrl("stream", { id: best.id }) : undefined;
}
