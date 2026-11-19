/*
  MusicBrainz access for entity pages and search.
  MusicBrainz asks for at most one request per second per client, so every MB call made by Undertone
  goes through `mbQueued`, which runs tasks one at a time with a gap between them.
*/

import { MB_URL } from "@/lib/config";

/** An HTTP failure with its status, readable by errorStatus() in use-lb.ts. */
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const GAP_MS = 1100;
let queue: Promise<unknown> = Promise.resolve();
let lastStart = 0;

/** Run `task` after every earlier MB task, at least GAP_MS after the previous start. */
export function mbQueued<T>(task: () => Promise<T>): Promise<T> {
  const run = async () => {
    const wait = lastStart + GAP_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastStart = Date.now();
    return task();
  };
  const next = queue.then(run, run);
  queue = next.catch(() => undefined);
  return next;
}

/** Builds `?k=v&…`. `+` is kept literal because MusicBrainz reads it as the separator in `inc`. */
export function mbQuery(params: Record<string, string | number | undefined>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value)).replace(/%2B/g, "+")}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

/** GET a MusicBrainz WS/2 resource as JSON, queued. `path` is e.g. `artist/<mbid>` or `recording`. */
export function mbGet<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const url = `${MB_URL}/ws/2/${path}${mbQuery({ fmt: "json", ...params })}`;
  return mbQueued(async () => {
    // MusicBrainz answers 503 when busy: retry a few times, staying inside the queue.
    for (let attempt = 0; ; attempt += 1) {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (res.ok) return (await res.json()) as T;
      const retryable = res.status === 429 || res.status === 503;
      if (!retryable || attempt >= 2) {
        const body = await res.json().catch(() => null);
        const reason = (body && (body.error as string)) || res.statusText || "request failed";
        throw new HttpError(res.status, `MusicBrainz ${res.status}: ${reason}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
    }
  });
}

/** Artist-credit array (MusicBrainz) as the flat refs used by Listen.mbid_mapping. */
export type CreditRef = { artist_mbid: string; artist_credit_name: string; join_phrase: string };

export function creditsToRefs(
  credit: Array<{ name: string; joinphrase?: string; artist: { id: string; name?: string } }> | undefined
): CreditRef[] {
  return (credit ?? []).map((c) => ({
    artist_mbid: c.artist.id,
    artist_credit_name: c.name,
    join_phrase: c.joinphrase ?? "",
  }));
}

/** "Radiohead" / "Jay-Z & Kanye West" from credit refs. */
export const creditName = (refs: CreditRef[]) => refs.map((r) => `${r.artist_credit_name}${r.join_phrase}`).join("");
