/*
  Feature walkthrough for Undertone — clicks through every interactive feature and checks
  that the right ListenBrainz API call is made with the right body.

    node scripts/qa/features.mjs [baseUrl] [--width=390] [--only=name]

  Runs in a MOCKED signed-in state as the public user "rob": the token is fake, validate-token
  is answered locally, and every non-GET request to the ListenBrainz API is intercepted,
  recorded and answered {status:"ok"} — no write ever reaches a real account. Public GETs pass
  through (with the fake Authorization header removed) so the screens show real data.
*/
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";
import { cachedGet, isCacheable, CORS } from "./api-cache.mjs";

const BASE = process.argv.find((a) => a.startsWith("http")) ?? "http://localhost:3124";
const WIDTH = Number((process.argv.find((a) => a.startsWith("--width=")) ?? "--width=1440").slice(8));
const ONLY = (process.argv.find((a) => a.startsWith("--only=")) ?? "").slice(7);
const OUT = path.resolve(".qa/features");
fs.mkdirSync(OUT, { recursive: true });
const feedEvents = JSON.parse(
  fs.readFileSync(path.resolve("../listenbrainz-server/frontend/js/tests/__mocks__/timelineProps.json"), "utf8")
).events;

const U = "rob";
const OTHER = "mr_monkey";
const PLAYLIST = "8357d30f-beac-4639-bdf3-b969d3a5c424";
const RELEASE = "1834eae1-741b-3c03-9ca5-0df3decb43ea";

const radioJSPF = await cachedGet(`https://api.listenbrainz.org/1/playlist/${PLAYLIST}`).then((e) => JSON.parse(e.body)).catch(() => null);

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--mute-audio", "--autoplay-policy=no-user-gesture-required"],
});

const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A mocked password session for tests of what only a full sign-in may do. No real account is involved. */
const sessionAccount = () => ({
  name: U, token: "test-token-undertone-qa", email: "qa@example.com", emailVerified: true, gravatarHash: null,
  brainzplayer: null, flair: null, timezone: "UTC", troi: { export_to_spotify: false },
  spotify: null, youtubeApiKey: null, avatarShared: false,
});

async function newPage({ signedIn = true, session = false } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: 900, isMobile: WIDTH < 700, hasTouch: WIDTH < 700 });
  page.writes = [];
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(String(e.message).slice(0, 200)));
  page.on("console", (m) => m.type() === "error" && !/429|Failed to load resource/.test(m.text()) && page.errors.push(m.text().slice(0, 200)));
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const u = req.url();
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "Authorization, Content-Type", "access-control-allow-methods": "GET, POST, DELETE, OPTIONS" };
    if (u.includes("api.listenbrainz.org")) {
      if (req.method() === "OPTIONS") return req.respond({ status: 204, headers: cors });
      if (u.includes("/validate-token")) {
        return req.respond({ status: 200, contentType: "application/json", headers: cors,
          body: JSON.stringify({ code: 200, valid: true, user_name: U, message: "Token valid." }) });
      }
      if (req.method() === "OPTIONS") return req.respond({ status: 204, headers: cors });
      if (req.method() !== "GET") {
        let body = req.postData() ?? "";
        try { body = JSON.parse(body); } catch { /* multipart or empty */ }
        page.writes.push({ method: req.method(), url: u.replace("https://api.listenbrainz.org/1", ""), body, auth: req.headers().authorization });
        let resp = { status: "ok" };
        if (u.includes("/playlist/create")) resp = { status: "ok", playlist_mbid: PLAYLIST };
        if (u.includes("/pin") && !u.includes("unpin") && !u.includes("delete")) resp = { status: "ok", data: { row_id: 1, recording_msid: "x", blurb_content: "qa", created: Date.now() / 1000, pinned_until: Date.now() / 1000 + 604800 } };
        if (u.includes("/copy")) resp = { status: "ok", playlist_mbid: PLAYLIST };
        if (u.includes("/export/") && !u.includes("delete")) resp = { export_id: 1, status: "waiting", type: "export_all_user_data", available_until: null, created: new Date().toISOString(), progress: "Waiting", filename: null };
        return req.respond({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(resp) });
      }
      if (u.includes("/explore/lb-radio") && radioJSPF) {
        return req.respond({ status: 200, contentType: "application/json", headers: cors,
          body: JSON.stringify({ payload: { jspf: radioJSPF, feedback: ["QA mock: playlist from a public ListenBrainz playlist"] } }) });
      }
      if (/\/user\/[^/]+\/feed\/events(\?|$)/.test(u)) {
        return req.respond({ status: 200, contentType: "application/json", headers: cors,
          body: JSON.stringify({ payload: { count: feedEvents.length, user_id: U, events: feedEvents } }) });
      }
    }
    if (page.sessionMock && u.startsWith(BASE + "/api/lb-session/")) {
      const m = page.sessionMock;
      const json = (status, body) => req.respond({ status, contentType: "application/json", body: JSON.stringify(body) });
      if (u.endsWith("/login")) {
        const body = JSON.parse(req.postData() ?? "{}");
        m.loginBodies.push(body);
        if (body.password !== m.password) return json(401, { error: "MetaBrainz says: Invalid password", code: "credentials" });
        m.signedIn = true;
        return json(200, m.account);
      }
      if (u.endsWith("/account")) return m.signedIn ? json(200, m.account) : req.respond({ status: 204, body: "" });
      if (u.endsWith("/logout")) { m.signedIn = false; return json(200, { ok: true }); }
    }
    if (isCacheable(u, req.method())) {
      return cachedGet(u).then((e) => req.respond({ status: e.status, contentType: e.contentType, headers: CORS, body: e.body })).catch(() => req.abort());
    }
    return req.continue();
  });
  if (session) {
    page.sessionMock = { password: "qa-fake-password", signedIn: true, loginBodies: [], account: sessionAccount() };
    await page.evaluateOnNewDocument(() => localStorage.clear());
  } else if (signedIn) await page.evaluateOnNewDocument(() => localStorage.setItem("undertone.token", "test-token-undertone-qa"));
  else await page.evaluateOnNewDocument(() => { if (!sessionStorage.getItem("qa-started")) { localStorage.clear(); sessionStorage.setItem("qa-started", "1"); } });
  return page;
}

async function go(page, route) {
  await page.goto(BASE + route, { waitUntil: "networkidle2", timeout: 45000 }).catch(() => {});
  await sleep(1200);
}

/** Click the first visible element matching css whose text or aria-label contains `text`. */
async function click(page, css, text, { nth = 0 } = {}) {
  const handles = await page.$$(css);
  const matches = [];
  for (const h of handles) {
    const ok = await h.evaluate((el, t) => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return false;
      const s = `${el.innerText || ""} ${el.getAttribute("aria-label") || ""} ${el.getAttribute("textValue") || ""}`;
      return !t || s.toLowerCase().includes(t.toLowerCase());
    }, text);
    if (ok) matches.push(h);
  }
  const h = matches[nth];
  if (!h) throw new Error(`no ${css} with "${text}"`);
  await h.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await h.click();
  await sleep(700);
}

async function typeInto(page, css, value) {
  const el = await page.waitForSelector(css, { visible: true, timeout: 8000 });
  await el.click({ clickCount: 3 });
  await el.type(value, { delay: 5 });
}

const wrote = (page, re) => page.writes.find((w) => re.test(w.url));

async function test(name, fn, opts) {
  if (ONLY && !name.includes(ONLY)) return;
  const page = await newPage(opts);
  let ok = true;
  let detail = "";
  try {
    detail = (await fn(page)) ?? "";
  } catch (e) {
    ok = false;
    detail = String(e.message).slice(0, 300);
  }
  if (page.errors.length) detail += ` | page errors: ${[...new Set(page.errors)].slice(0, 3).join(" / ")}`;
  await page.screenshot({ path: path.join(OUT, `${WIDTH}-${name.replace(/\W+/g, "_")}.png`) }).catch(() => {});
  results.push({ name, ok, detail, writes: page.writes.map((w) => `${w.method} ${w.url}`) });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
  await page.close();
}

const assert = (c, msg) => { if (!c) throw new Error(msg); };

/* ---------------- flows ---------------- */

await test("login with token", async () => {
  const page = await newPage({ signedIn: false });
  await go(page, "/login");
  await click(page, "[role='tab']", "Token");
  await typeInto(page, "input[autocomplete='off'][type=password]", "test-token-undertone-qa");
  await click(page, "button[type='submit']", "Sign in");
  await sleep(1500);
  const url = page.url();
  await page.close();
  assert(url.endsWith("/feed"), `expected /feed, got ${url}`);
});

await test("love and hate a listen", async (page) => {
  await go(page, `/user/${U}/listens`);
  await click(page, "button[aria-label='Love'], button[aria-label='Remove love']", "");
  const w = wrote(page, /feedback\/recording-feedback/);
  assert(w, "no feedback POST");
  assert(w.body.score === 1 || w.body.score === 0, `score ${w.body.score}`);
  assert(w.auth === "Token test-token-undertone-qa", "missing auth header");
  return `score=${w.body.score}`;
});

for (const [item, re, fill] of [
  ["Pin this track", /\/pin$/, async (p) => { await typeInto(p, "[role=dialog] textarea", "QA pin blurb"); await click(p, "[role=dialog] button", "Pin track"); }],
  ["Recommend to my followers", /timeline-event\/create\/recording/, async (p) => { await click(p, "[role=dialog] button", "Recommend"); }],
  ["Add to playlist", /\/item\/add|\/playlist\/create/, async (p) => { await sleep(2500); await click(p, "[role=dialog] button", "", { nth: 1 }).catch(async () => { await click(p, "[role=dialog] [role=button], [role=dialog] li button", ""); }); }],
  ["Inspect listen", null, async (p) => { await p.waitForSelector("[role=dialog] pre", { timeout: 5000 }); }],
  ["Delete listen", /delete-listen/, async (p) => { await click(p, "[role=dialog] button", "Delete listen"); }],
  ["Write a review", null, async (p) => { await p.waitForFunction(() => document.querySelector("[role=dialog]")?.innerText.includes("Open CritiqueBrainz"), { timeout: 5000 }); }],
  ["Personally recommend", null, async (p) => { await p.waitForSelector("[role=dialog]", { timeout: 5000 }); }],
]) {
  await test(`listen menu: ${item}`, async (page) => {
    await go(page, `/user/${U}/listens`);
    await click(page, "button[aria-label^='More actions']", "");
    await click(page, "[role=menuitem]", item);
    await page.waitForSelector("[role=dialog]", { visible: true, timeout: 6000 });
    await fill(page);
    await sleep(1200);
    if (re) assert(wrote(page, re), `no write matching ${re}; writes: ${page.writes.map((w) => w.url).join(", ")}`);
    return re ? JSON.stringify(wrote(page, re).body).slice(0, 120) : "dialog ok";
  });
}

await test("queue: play next / add to queue / player bar", async (page) => {
  await go(page, `/user/${U}/listens`);
  await click(page, "button[aria-label^='More actions']", "");
  await click(page, "[role=menuitem]", "Add to queue");
  await sleep(1500);
  const bar = await page.$$eval("button[aria-label='Next track'], button[aria-label='Play'], button[aria-label='Pause']", (b) => b.length);
  assert(bar > 0, "player bar did not appear");
});

await test("play a listen (player starts a source lookup)", async (page) => {
  const seen = [];
  page.on("request", (r) => { if (/internet_archive|googleapis|youtube/.test(r.url())) seen.push(r.url().slice(0, 80)); });
  await go(page, `/user/${U}/listens`);
  await click(page, "button[aria-label^='Play ']", "");
  await sleep(5000);
  const status = await page.evaluate(() => document.body.innerText.match(/via YouTube|via Internet Archive|Couldn't find this track|Finding a source/)?.[0]);
  assert(status, "no player status shown");
  return `${status}; source requests: ${seen.length}`;
}, { session: true });

await test("queue sheet opens", async (page) => {
  await go(page, `/user/${U}/listens`);
  await click(page, "button[aria-label^='Play ']", "");
  await sleep(1500);
  if (WIDTH < 700) {
    const t = await page.$("button[aria-label='Open now playing']");
    await t.tap();
    await page.waitForFunction(() => [...document.querySelectorAll("[role=dialog]")].some((d) => /Now playing/.test(d.innerText)), { timeout: 5000 });
  } else {
    await click(page, "button", "queue");
    await page.waitForFunction(() => [...document.querySelectorAll("[role=dialog]")].some((d) => /Queue|Up next/i.test(d.innerText)), { timeout: 5000 });
  }
  await sleep(600);
});

await test("follow another user", async (page) => {
  await go(page, `/user/${OTHER}`);
  await click(page, "button", "Follow");
  await sleep(1000);
  assert(wrote(page, /\/user\/mr_monkey\/(follow|unfollow)/), "no follow POST");
});

await test("create playlist", async (page) => {
  await go(page, `/user/${U}/playlists`);
  await click(page, "button", "New playlist");
  await page.waitForSelector("[role=dialog]", { visible: true, timeout: 6000 });
  await typeInto(page, "[role=dialog] input", "QA playlist");
  await click(page, "[role=dialog] button", "Create");
  await sleep(1200);
  const w = wrote(page, /playlist\/create/);
  assert(w, "no create POST");
  return w.body?.playlist?.title;
});

await test("playlist detail: copy, move, remove, edit", async (page) => {
  await go(page, `/playlist/${PLAYLIST}`);
  await click(page, "button", "Save a copy");
  await sleep(800);
  assert(wrote(page, /\/copy/), "no copy POST");
  await click(page, "button[aria-label^='More actions']", "", { nth: 1 });
  await click(page, "[role=menuitem]", "Move up");
  await sleep(800);
  assert(wrote(page, /item\/move/), "no move POST");
  await click(page, "button[aria-label^='More actions']", "");
  await click(page, "[role=menuitem]", "Remove");
  await sleep(800);
  assert(wrote(page, /item\/delete/), "no delete-item POST");
  await click(page, "button", "Edit");
  await page.waitForSelector("[role=dialog]", { visible: true, timeout: 6000 });
  await click(page, "[role=dialog] button", "Save");
  await sleep(800);
  assert(wrote(page, /playlist\/edit/), "no edit POST");
  return page.writes.map((w) => w.url).join(", ");
});

await test("playlist add track via MusicBrainz search", async (page) => {
  await go(page, `/playlist/${PLAYLIST}`);
  const input = await page.$("main input[placeholder*='Add a track' i]");
  assert(input, "no add-track field");
  await input.type("Reckoner Radiohead");
  await page.waitForFunction(() => [...document.querySelectorAll("main button")].some((b) => b.innerText.trim() === "Add"), { timeout: 20000 }).catch(() => {});
  await click(page, "main button", "Add");
  await sleep(1200);
  assert(wrote(page, /item\/add/), "no add POST");
});

await test("recommendation feedback", async (page) => {
  await go(page, `/recommended/tracks/${U}`);
  await sleep(2500);
  await click(page, "button", "Rate");
  await click(page, "[role=menuitem], [role=option], [role=radio], button", "Like");
  await sleep(800);
  assert(wrote(page, /recommendation\/feedback\/submit/), "no rec feedback POST");
});

await test("feed: hide and thank", async (page) => {
  await go(page, "/feed");
  const text = await page.evaluate(() => document.body.innerText);
  assert(/recommended|pinned|following/i.test(text), "feed events not rendered");
  await click(page, "button", "Hide").catch(() => {});
  await click(page, "button", "Thank").catch(() => {});
  await sleep(1000);
  return page.writes.map((w) => w.url).join(", ") || "rendered (no hide/thank button on fixture events)";
});

await test("taste: loved list + pins", async (page) => {
  await go(page, `/user/${U}/taste`);
  const t = await page.evaluate(() => document.body.innerText);
  assert(/Loved/.test(t) && /Pins/.test(t), "taste panels missing");
});

await test("settings: timezone save", async (page) => {
  await go(page, "/settings/timezone");
  const input = await page.$("main input");
  await input.click({ clickCount: 3 });
  await page.keyboard.press("Backspace");
  await input.type("Europe/Ber");
  await sleep(800);
  if (WIDTH < 700) {
    const opt = await page.$("[role=option]");
    await opt.tap();
    await sleep(600);
  } else {
    await click(page, "[role=option]", "Berlin");
  }
  console.log("   tz after pick:", await page.evaluate(() => ({ value: document.querySelector("main input")?.value, bar: (document.querySelector("main")?.innerText.match(/No changes|Unsaved[^.]*|Saved[^.]*/) ?? [])[0] })));
  await click(page, "button", "Save");
  await sleep(1000);
  const w = wrote(page, /settings\/timezone/);
  assert(w, "no timezone POST");
  return JSON.stringify(w.body);
}, { session: true });

await test("settings: recommendations (troi) save", async (page) => {
  await go(page, "/settings/recommendations");
  await click(page, "main [data-slot=switch-content]", "Export daily");
  await click(page, "button", "Save");
  await sleep(1000);
  assert(wrote(page, /settings\/troi/), "no troi POST");
}, { session: true });

await test("settings: flair save", async (page) => {
  await go(page, "/settings/flair");
  await page.waitForFunction(() => !document.body.innerText.includes("Checking your flair"), { timeout: 20000 }).catch(() => {});
  await click(page, "main button", "No flair");
  await click(page, "[role=option]", "Wave");
  await click(page, "button", "Save");
  await sleep(1000);
  assert(wrote(page, /settings\/flair/), "no flair POST");
}, { session: true });

await test("settings: player syncs full BrainzPlayer object", async (page) => {
  await go(page, "/settings/player");
  await click(page, "button", "Move Internet Archive up");
  await click(page, "button", "Save");
  await sleep(1200);
  const w = wrote(page, /settings\/brainzplayer/);
  assert(w, "no brainzplayer POST");
  const keys = ["youtubeEnabled", "spotifyEnabled", "soundcloudEnabled", "appleMusicEnabled", "internetArchiveEnabled", "funkwhaleEnabled", "navidromeEnabled", "brainzplayerEnabled", "notificationsEnabled", "dataSourcesPriority"];
  const body = w.body.brainzplayer ?? w.body;
  const missing = keys.filter((k) => !(k in body));
  assert(!missing.length, `missing fields: ${missing.join(",")} in ${JSON.stringify(w.body).slice(0, 200)}`);
  // Settings must never be kept in the browser: only the sign-in token may be there.
  const stored = await page.evaluate(() => [...Object.keys(localStorage), ...Object.keys(sessionStorage)].filter((k) => k !== "qa-started"));
  assert(!stored.length, `settings left in browser storage: ${stored.join(",")}`);
  return JSON.stringify(body.dataSourcesPriority);
}, { session: true });

await test("token sign-in: settings and player locked", async (page) => {
  for (const route of ["/settings/player", "/settings/timezone", "/settings/recommendations", "/settings/flair"]) {
    await go(page, route);
    const t = await page.evaluate(() => document.querySelector("main")?.innerText ?? "");
    assert(/signed in with a token/i.test(t), `${route}: no token notice`);
    assert(!/\bSave\b/.test(t), `${route}: still offers Save`);
  }
  await go(page, `/user/${U}/listens`);
  await click(page, "button[aria-label^='Play ']", "");
  await sleep(1500);
  const msg = await page.evaluate(() => document.body.innerText.includes("needs a password sign-in"));
  assert(msg, "player didn't say it needs a password sign-in");
  await go(page, "/login");
  const onLogin = await page.evaluate(() => location.pathname === "/login" && document.body.innerText.includes("with a token"));
  assert(onLogin, "token user can't reach the sign-in page to upgrade");
});

await test("password sign-in: settings, email and avatar read from the session", async (page) => {
  // Everything below is mocked: no real account, password or network request is involved.
  page.sessionMock = {
    password: "qa-fake-password",
    signedIn: false,
    loginBodies: [],
    account: {
      name: U, token: "test-token-undertone-qa", email: "qa@example.com", emailVerified: true,
      gravatarHash: "0".repeat(64), brainzplayer: { youtubeEnabled: false, spotifyEnabled: false, soundcloudEnabled: false, appleMusicEnabled: false,
        internetArchiveEnabled: true, funkwhaleEnabled: false, navidromeEnabled: false, brainzplayerEnabled: true, notificationsEnabled: true,
        dataSourcesPriority: ["internetArchive", "youtube", "spotify", "soundcloud", "appleMusic", "funkwhale", "navidrome"] },
      flair: "shine", timezone: "Europe/Berlin", troi: { export_to_spotify: true },
    },
  };
  await go(page, "/login");
  await typeInto(page, "input[autocomplete='username']", "rob");
  await typeInto(page, "input[autocomplete='current-password']", "wrong");
  await click(page, "button[type='submit']", "Sign in");
  await sleep(800);
  const err = await page.$eval("[role='alert']", (e) => e.textContent).catch(() => "");
  assert(/Invalid password/.test(err), `wrong password not reported: ${err}`);
  await typeInto(page, "input[autocomplete='current-password']", "qa-fake-password");
  await click(page, "button[type='submit']", "Sign in");
  await page.waitForFunction(() => location.pathname === "/feed", { timeout: 10000 }).catch(async () => {
    const state = await page.evaluate(() => `${location.pathname} | ${document.querySelector("[role='alert']")?.textContent ?? ""} | pw=${document.querySelector("input[autocomplete='current-password']")?.value}`);
    throw new Error(`no redirect to /feed: ${state}; logins=${JSON.stringify(page.sessionMock.loginBodies)}`);
  });
  // The mock hash has no Gravatar, so the image 404s and the initials show; the request proves it was tried.
  await sleep(1000);
  const avatar = await page.evaluate(() => performance.getEntriesByType("resource").some((e) => e.name.includes("gravatar.com/avatar/" + "0".repeat(64))));
  assert(avatar, "the top bar didn't ask Gravatar for the avatar");
  const stored = await page.evaluate(() => [...Object.keys(localStorage), ...Object.keys(sessionStorage)].filter((k) => k !== "qa-started"));
  assert(!stored.length, `password sign-in left things in browser storage: ${stored.join(",")}`);

  await go(page, "/settings/timezone");
  const tz = await page.$eval("input[placeholder^='Search']", (i) => i.value).catch(() => "");
  assert(tz === "Europe/Berlin", `timezone not prefilled: ${tz}`);
  await go(page, "/settings/recommendations");
  const troi = await page.evaluate(() => document.body.innerText.includes("Currently set to export automatically"));
  assert(troi, "troi setting not prefilled");
  await go(page, "/settings/player");
  const firstSource = await page.evaluate(() => document.querySelector("ul li")?.innerText ?? "");
  assert(/Internet Archive/.test(firstSource), `player order not from session: ${firstSource.slice(0, 60)}`);
  const defaultsWarning = await page.evaluate(() => document.body.innerText.includes("these are the defaults"));
  assert(!defaultsWarning, "player page still says it shows defaults");
  await go(page, "/settings");
  const email = await page.evaluate(() => document.body.innerText.includes("qa@example.com"));
  assert(email, "email not shown on the account page");
  await click(page, "button", "Sign out");
  await sleep(800);
  assert(!page.sessionMock.signedIn, "sign out didn't end the session");
  return `login bodies: ${page.sessionMock.loginBodies.length}`;
}, { signedIn: false });

await test("close the player", async (page) => {
  await go(page, `/user/${U}/listens`);
  await click(page, "button[aria-label^='Play ']", "");
  await sleep(1500);
  await click(page, "button[aria-label='Close player']", "");
  await sleep(800);
  const left = await page.$$eval("button[aria-label='Close player']", (b) => b.filter((x) => x.getBoundingClientRect().height > 0).length);
  assert(left === 0, "player still visible");
});

await test("settings: start export", async (page) => {
  await go(page, "/settings/export");
  await click(page, "button", "export");
  await sleep(1200);
  assert(wrote(page, /\/export\/$/), "no export POST");
});

await test("search from top bar", async (page) => {
  await go(page, "/explore");
  if (WIDTH < 768) {
    await click(page, "a[aria-label='Search']", "");
    await typeInto(page, "main input", "radiohead");
    await page.keyboard.press("Enter");
  } else {
    await typeInto(page, "header input", "radiohead");
    await page.keyboard.press("Enter");
  }
  await sleep(3000);
  assert(page.url().includes("q=radiohead"), page.url());
  const t = await page.evaluate(() => document.body.innerText);
  assert(/Radiohead/.test(t), "no results");
});

await test("LB Radio generate + save", async (page) => {
  await go(page, "/explore/lb-radio?prompt=artist:(radiohead)&mode=easy");
  await sleep(6000);
  const t = await page.evaluate(() => document.body.innerText);
  assert(/Play all/i.test(t), "no generated playlist");
  await click(page, "button", "Save playlist");
  await sleep(1200);
  assert(wrote(page, /playlist\/create/), "no save POST");
});

await test("mobile menu navigates", async (page) => {
  if (WIDTH >= 768) return "skipped on desktop";
  await go(page, "/explore");
  await click(page, "button[aria-label='Open menu']", "");
  await click(page, "a", "Stats");
  await sleep(1500);
  assert(page.url().includes("/stats"), page.url());
});

await test("account menu sign out", async (page) => {
  await go(page, "/feed");
  await click(page, "button[aria-label^='Account']", "").catch(async () => {
    await click(page, "button[aria-label='Open menu']", "");
  });
  await click(page, "[role=menuitem], button", "Sign out");
  await sleep(1200);
  const token = await page.evaluate(() => localStorage.getItem("undertone.token"));
  assert(!token, "token still stored");
});

await test("release player route", async (page) => {
  await go(page, `/player/release/${RELEASE}`);
  await sleep(2500);
  await click(page, "button", "Play release");
  await sleep(1500);
  const bar = await page.$$eval("button[aria-label='Next track']", (b) => b.length);
  assert(bar > 0, "player did not load the release");
});

await browser.close();
fs.writeFileSync(path.join(OUT, `results-${WIDTH}.json`), JSON.stringify(results, null, 2));
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed at ${WIDTH}px`);
