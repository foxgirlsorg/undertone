import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";

/*
  The one thing Undertone's server keeps about a person: the Gravatar hash of someone who signed in
  with their password, so other people can see their picture on their profile.

  - It is written only after a successful password sign-in (or when that person opens Undertone
    again), and only for the account that signed in.
  - /api/avatar/<name> redirects to the Gravatar picture for that hash, so the picture itself is
    always loaded straight from Gravatar; the server stores and serves no images.
  - Turning "Show my picture to others" off in Account settings replaces the hash with an opt-out
    marker, which also stops it being written again.

  Where it is kept, one entry per lower-cased ListenBrainz username (the hash, or "off"):
  - Redis over HTTPS (Upstash, e.g. from the Vercel Marketplace) when UPSTASH_REDIS_REST_URL and
    UPSTASH_REDIS_REST_TOKEN are set (or Vercel KV's KV_REST_API_URL and KV_REST_API_TOKEN). Use
    this anywhere the disk doesn't persist, such as Vercel. Keys: `undertone:avatar:<name>`.
  - Otherwise one JSON file, `<UNDERTONE_DATA_DIR or .data>/avatars.json`, for running on your own
    machine or server.
*/

const HASH_RE = /^[0-9a-f]{64}$/;
const OFF = "off";
const keyOf = (name: string) => name.trim().toLowerCase();

type Backend = {
  get(name: string): Promise<string | null>;
  set(name: string, value: string): Promise<void>;
  del(name: string): Promise<void>;
};

/* ------------------------------------------------------------------ Redis (Upstash REST) */

function redisBackend(url: string, token: string): Backend {
  const base = url.replace(/\/+$/, "");
  const call = async (command: string[]) => {
    const res = await fetch(base, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(command),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    const body = (await res.json().catch(() => null)) as { result?: unknown; error?: string } | null;
    if (!res.ok || body?.error) throw new Error(`Redis: ${body?.error ?? res.status}`);
    return body?.result;
  };
  const k = (name: string) => `undertone:avatar:${keyOf(name)}`;
  return {
    async get(name) {
      const v = await call(["GET", k(name)]);
      return typeof v === "string" ? v : null;
    },
    async set(name, value) {
      await call(["SET", k(name), value]);
    },
    async del(name) {
      await call(["DEL", k(name)]);
    },
  };
}

/* ------------------------------------------------------------------ JSON file (self-hosted) */

function fileBackend(): Backend {
  const dir = process.env.UNDERTONE_DATA_DIR || path.join(process.cwd(), ".data");
  const file = path.join(dir, "avatars.json");
  let cache: Record<string, string> | null = null;
  let writing: Promise<void> = Promise.resolve();

  const load = async () => {
    if (cache) return cache;
    try {
      const parsed = JSON.parse(await fs.readFile(file, "utf8")) as Record<string, unknown>;
      cache = {};
      // Older files stored `false` for "opted out".
      for (const [k, v] of Object.entries(parsed ?? {})) {
        if (typeof v === "string") cache[k] = v;
        else if (v === false) cache[k] = OFF;
      }
    } catch {
      cache = {};
    }
    return cache;
  };
  // Writes are queued and atomic (temp file, then rename), so a crash never leaves half a file.
  const save = (store: Record<string, string>) => {
    writing = writing
      .catch(() => {})
      .then(async () => {
        await fs.mkdir(dir, { recursive: true });
        const tmp = `${file}.${process.pid}.tmp`;
        await fs.writeFile(tmp, JSON.stringify(store), "utf8");
        await fs.rename(tmp, file);
      });
    return writing;
  };
  return {
    async get(name) {
      return (await load())[keyOf(name)] ?? null;
    },
    async set(name, value) {
      const store = await load();
      store[keyOf(name)] = value;
      await save(store);
    },
    async del(name) {
      const store = await load();
      if (!(keyOf(name) in store)) return;
      delete store[keyOf(name)];
      await save(store);
    },
  };
}

let backend: Backend | null = null;
function store(): Backend {
  if (backend) return backend;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  backend = url && token ? redisBackend(url, token) : fileBackend();
  return backend;
}

/* ------------------------------------------------------------------ the store's API */

/** The stored hash for a username, or null (none, or opted out). */
export async function avatarHashFor(name: string): Promise<string | null> {
  const v = await store().get(name);
  return v && HASH_RE.test(v) ? v : null;
}

/** Whether this person has turned the shared picture off. */
export async function avatarOptedOut(name: string): Promise<boolean> {
  return (await store().get(name)) === OFF;
}

/** Records the hash after a sign-in, unless the person opted out. A null hash (no email) removes it. */
export async function rememberAvatar(name: string, hash: string | null) {
  const s = store();
  const current = await s.get(name);
  if (current === OFF) return;
  if (hash && HASH_RE.test(hash)) {
    if (current !== hash) await s.set(name, hash);
  } else if (current) {
    await s.del(name);
  }
}

/** "Show my picture to others": on stores the hash, off stores the opt-out marker instead. */
export async function setAvatarShared(name: string, hash: string | null, shared: boolean) {
  const s = store();
  if (!shared) await s.set(name, OFF);
  else if (hash && HASH_RE.test(hash)) await s.set(name, hash);
  else await s.del(name);
}
