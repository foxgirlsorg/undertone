/*
  Tests the password sign-in (src/lib/server/lb-session.ts) against a simulated metabrainz.org and
  listenbrainz.org. No real account or network is used.
    node scripts/qa/session.mjs
*/
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const OUT = fs.mkdtempSync(path.join(os.tmpdir(), "undertone-session-"));
try {
  execSync(`npx tsc src/lib/server/lb-session.ts --outDir "${OUT}" --module es2022 --target es2022 --moduleResolution bundler --skipLibCheck --types node`, { stdio: "ignore" });
} catch {
  /* type errors from ambient app types are fine; the JS is still emitted */
}
const js = fs.readFileSync(path.join(OUT, "lb-session.js"), "utf8").replace(/^import "server-only";\n/m, "");
fs.writeFileSync(path.join(OUT, "lb-session.mjs"), js);
import { pathToFileURL } from "node:url";
const modUrl = pathToFileURL(path.join(OUT, "lb-session.mjs")).href;

import assert from "node:assert/strict";
const calls = [];
const html = (id, obj) => `<html><script id="${id}" type="application/json">${JSON.stringify(obj)}</script></html>`;
const res = (status, { body = "", location, cookies = [], json } = {}) => {
  const h = new Headers();
  if (location) h.set("location", location);
  for (const c of cookies) h.append("set-cookie", c);
  if (json) { h.set("content-type", "application/json"); body = JSON.stringify(json); }
  return new Response(status >= 300 && status < 400 ? null : body, { status, headers: h });
};
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url); const m = init.method ?? "GET"; const cookie = new Headers(init.headers).get("cookie") ?? "";
  const auth = new Headers(init.headers).get("authorization");
  calls.push(`${m} ${u.host}${u.pathname} [${cookie}]`);
  const key = `${m} ${u.host}${u.pathname}`;
  switch (key) {
    case "GET metabrainz.org/login": return res(200, { body: html("page-react-props", { csrf_token: "C1", mtcaptcha_site_key: "" }), cookies: ["session=meb1; HttpOnly; Path=/"] });
    case "POST metabrainz.org/login": {
      assert.equal(cookie, "session=meb1"); const b = new URLSearchParams(init.body.toString());
      assert.equal(b.get("csrf_token"), "C1");
      if (b.get("password") !== "right") return res(200, { body: html("page-react-props", { csrf_token: "C2", initial_errors: { password: ["Invalid password"] } }) });
      return res(302, { location: "/", cookies: ["session=meb2; HttpOnly; Path=/", "remember_token=mebrt; Path=/"] });
    }
    case "GET listenbrainz.org/login/musicbrainz/": return res(302, { location: "https://metabrainz.org/oauth2/authorize?client_id=lb&state=S", cookies: ["session=lbtmp; HttpOnly; Path=/; SameSite=Lax"] });
    case "GET metabrainz.org/oauth2/authorize": assert.match(cookie, /session=meb2/); return res(302, { location: "https://listenbrainz.org/login/musicbrainz/post/?code=K&state=S" });
    case "GET listenbrainz.org/login/musicbrainz/post/": assert.equal(cookie, "session=lbtmp"); return res(302, { location: "/", cookies: ["session=lbauth; HttpOnly; Path=/", "remember_token=lbrt; Expires=Wed, 01 Jan 2031 00:00:00 GMT; Path=/"] });
    case "GET listenbrainz.org/": return res(200, { body: "home" });
    case "GET listenbrainz.org/settings/":
      if (!/session=lbauth/.test(cookie)) return res(302, { location: "/login/?next=/settings/" });
      return res(200, { body: html("global-react-props", { current_user: { name: "qa", auth_token: "T" }, user_preferences: { youtubeEnabled: false }, flair: "shine", musicbrainz: { access_token: "MBT" } }) });
    case "GET listenbrainz.org/login/": return res(200, { body: "login page" });
    case "POST listenbrainz.org/settings/select_timezone/": return res(200, { json: { user_timezone: "Europe/Berlin", pg_timezones: [] } });
    case "POST listenbrainz.org/settings/troi/": return res(200, { json: { troi_prefs: { export_to_spotify: true } } });
    case "GET metabrainz.org/oauth2/userinfo": assert.equal(auth, "Bearer MBT"); return res(200, { json: { email: " QA@Example.com ", email_verified: true } });
    case "GET listenbrainz.org/login/logout/": return res(302, { location: "/", cookies: ["session=; Max-Age=0; Path=/", "remember_token=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/"] });
  }
  throw new Error("unexpected " + key);
};
const s = await import(modUrl);
// wrong password
await assert.rejects(s.signInWithPassword("qa", "wrong"), (e) => e.code === "credentials" && /Invalid password/.test(e.message));
// right password
const jar = await s.signInWithPassword("qa", "right");
const packed = s.packSession(jar);
const lbOnly = JSON.parse(Buffer.from(packed, "base64url").toString());
assert.deepEqual(lbOnly, { session: "lbauth", remember_token: "lbrt" }, "only listenbrainz.org cookies handed back");
const acc = await s.readAccount(s.unpackSession(packed));
assert.equal(acc.name, "qa"); assert.equal(acc.token, "T"); assert.equal(acc.timezone, "Europe/Berlin");
assert.equal(acc.troi.export_to_spotify, true); assert.equal(acc.flair, "shine"); assert.equal(acc.email, "QA@Example.com");
assert.equal(acc.gravatarHash, (await import("node:crypto")).createHash("sha256").update("qa@example.com").digest("hex"));
// expired session
await assert.rejects(s.readAccount(s.unpackSession(Buffer.from(JSON.stringify({ session: "old" })).toString("base64url"))), (e) => e.code === "expired");
// tampered cookie
assert.equal(s.unpackSession("not base64 json"), null);
// logout clears
const j2 = s.unpackSession(packed); await s.signOutSession(j2); assert.equal(j2.size, 0);
console.log("all session tests passed;", calls.length, "mock requests");
