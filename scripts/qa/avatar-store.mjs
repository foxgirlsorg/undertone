/*
  Tests the Gravatar key store (src/lib/server/avatar-store.ts) with a simulated Upstash Redis and with
  the JSON-file fallback. No real database or network is used.
    node scripts/qa/avatar-store.mjs
*/
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const OUT = fs.mkdtempSync(path.join(os.tmpdir(), "undertone-avatars-"));
try {
  execSync(`npx tsc src/lib/server/avatar-store.ts --outDir "${OUT}" --module es2022 --target es2022 --moduleResolution bundler --skipLibCheck --types node`, { stdio: "ignore" });
} catch {
  /* ambient app types may not resolve; the JS is still emitted */
}
const js = fs.readFileSync(path.join(OUT, "avatar-store.js"), "utf8").replace(/^import "server-only";\n/m, "");
const load = (tag) => {
  const file = path.join(OUT, `avatar-store-${tag}.mjs`);
  fs.writeFileSync(file, js);
  return import(pathToFileURL(file).href);
};

const HASH = "a".repeat(64);
const HASH2 = "b".repeat(64);

async function exercise(s) {
  assert.equal(await s.avatarHashFor("Someone"), null, "unknown user has a key");
  await s.rememberAvatar("Someone", HASH);
  assert.equal(await s.avatarHashFor("someone"), HASH, "names should match regardless of case");
  await s.rememberAvatar("Someone", HASH2);
  assert.equal(await s.avatarHashFor("Someone"), HASH2, "a changed email should replace the key");
  await s.setAvatarShared("Someone", HASH2, false);
  assert.equal(await s.avatarHashFor("Someone"), null, "turning sharing off should hide the key");
  assert.equal(await s.avatarOptedOut("Someone"), true);
  await s.rememberAvatar("Someone", HASH2);
  assert.equal(await s.avatarHashFor("Someone"), null, "a sign-in must not undo opting out");
  await s.setAvatarShared("Someone", HASH2, true);
  assert.equal(await s.avatarHashFor("Someone"), HASH2, "turning sharing back on should store the key");
  await s.rememberAvatar("Someone", null);
  assert.equal(await s.avatarHashFor("Someone"), null, "no email should remove the key");
  await s.rememberAvatar("Other", "not-a-hash");
  assert.equal(await s.avatarHashFor("Other"), null, "malformed keys must not be stored");
}

// 1. Redis over HTTPS (Upstash's REST API), simulated.
const redis = new Map();
const calls = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  assert.equal(url, "https://qa-redis.example");
  assert.equal(new Headers(init.headers).get("authorization"), "Bearer qa-token");
  const [cmd, key, value] = JSON.parse(init.body);
  calls.push(`${cmd} ${key}`);
  assert.match(key, /^undertone:avatar:[a-z]+$/, "keys are namespaced and lower-cased");
  let result = null;
  if (cmd === "GET") result = redis.get(key) ?? null;
  else if (cmd === "SET") { redis.set(key, value); result = "OK"; }
  else if (cmd === "DEL") result = redis.delete(key) ? 1 : 0;
  else throw new Error("unexpected command " + cmd);
  return new Response(JSON.stringify({ result }), { status: 200, headers: { "content-type": "application/json" } });
};
process.env.KV_REST_API_URL = "https://qa-redis.example/";
process.env.KV_REST_API_TOKEN = "qa-token";
await exercise(await load("redis"));
globalThis.fetch = realFetch;
delete process.env.KV_REST_API_URL;
delete process.env.KV_REST_API_TOKEN;

// 2. JSON file fallback, in a temporary folder.
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "undertone-data-"));
process.env.UNDERTONE_DATA_DIR = dataDir;
await exercise(await load("file"));
await new Promise((r) => setTimeout(r, 100));
const saved = JSON.parse(fs.readFileSync(path.join(dataDir, "avatars.json"), "utf8"));
assert.deepEqual(saved, {}, "the file should be empty after the last removal");

console.log(`avatar store tests passed; ${calls.length} Redis commands`);
