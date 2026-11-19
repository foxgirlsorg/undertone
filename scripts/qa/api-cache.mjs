/*
  Disk cache for the QA scripts, so repeated test runs don't hammer MetaBrainz servers.
  Every public GET to ListenBrainz / MusicBrainz / Cover Art Archive / Wikipedia is fetched
  once (serialised, at most ~2 requests per second), stored under .qa/api-cache/,
  and replayed from disk afterwards. Set QA_CACHE=refresh to refetch.
*/
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DIR = path.resolve(".qa/api-cache");
fs.mkdirSync(DIR, { recursive: true });
const HOSTS = /^(https:\/\/(api\.listenbrainz\.org|musicbrainz\.org|labs\.api\.listenbrainz\.org|[a-z]+\.wikipedia\.org|www\.wikidata\.org))\//;
const REFRESH = process.env.QA_CACHE === "refresh";
const MIN_GAP_MS = 550;

let chain = Promise.resolve();
let last = 0;

export const isCacheable = (url, method) => method === "GET" && HOSTS.test(url);

function file(url) {
  return path.join(DIR, crypto.createHash("sha1").update(url).digest("hex") + ".json");
}

/** Returns { status, contentType, body } for a URL, from disk or a paced live fetch. */
export function cachedGet(url) {
  const f = file(url);
  if (!REFRESH && fs.existsSync(f)) return Promise.resolve(JSON.parse(fs.readFileSync(f, "utf8")));
  const run = chain.then(async () => {
    if (!REFRESH && fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8"));
    const wait = last + MIN_GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
    let entry;
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Undertone-QA/0.1 (local test run)" } });
      entry = { status: res.status, contentType: res.headers.get("content-type") ?? "application/json", body: await res.text() };
    } catch (e) {
      entry = { status: 599, contentType: "text/plain", body: String(e) };
    }
    // Only keep good answers; rate-limit and network failures are retried next run.
    if ((entry.status >= 200 && entry.status < 300) || entry.status === 404) fs.writeFileSync(f, JSON.stringify(entry));
    return entry;
  });
  chain = run.catch(() => {});
  return run;
}

export const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "*",
};
