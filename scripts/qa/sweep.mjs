/*
  Layout + console sweep for Undertone.

    node scripts/qa/sweep.mjs [baseUrl] [--only=substring] [--widths=360,390]

  Loads every route at several widths, signed out and in a MOCKED signed-in state
  (fake token; validate-token is answered locally, every non-GET request to the
  ListenBrainz API is intercepted and answered with {status:"ok"} — nothing reaches a real
  account; the fake Authorization header is stripped from GETs so public data loads).

  Flags: horizontal page overflow, elements past the viewport edge, text spilling out of
  its box, buttons/pills whose label wraps, small tap targets on phones, console errors,
  page errors, failed requests. Writes screenshots + report to .qa/sweep/.
*/
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";
import { cachedGet, isCacheable, CORS } from "./api-cache.mjs";

const BASE = process.argv.find((a) => a.startsWith("http")) ?? "http://localhost:3124";
const ONLY = (process.argv.find((a) => a.startsWith("--only=")) ?? "").slice(7);
const WIDTHS = ((process.argv.find((a) => a.startsWith("--widths=")) ?? "").slice(9) || "360,390,768,1024,1440,1920")
  .split(",")
  .map(Number);
const MODES = ((process.argv.find((a) => a.startsWith("--modes=")) ?? "").slice(8) || "anon,auth").split(",");
const OUT = path.resolve(".qa/sweep");
fs.mkdirSync(OUT, { recursive: true });

const FEED_FIXTURE = path.resolve(
  "../listenbrainz-server/frontend/js/tests/__mocks__/timelineProps.json"
);
const feedEvents = fs.existsSync(FEED_FIXTURE) ? JSON.parse(fs.readFileSync(FEED_FIXTURE, "utf8")).events : [];

const U = "rob";
const ARTIST = "a74b1b7f-71a5-4011-9441-d0b5e4122711";
const ALBUM = "6e335887-60ba-38f0-95af-fae7774336bf";
const RELEASE = "1834eae1-741b-3c03-9ca5-0df3decb43ea";
const TRACK = "9e2ad5bc-c6f9-40d2-a36f-3122ee2072a3";
const PLAYLIST = "8357d30f-beac-4639-bdf3-b969d3a5c424";

const ROUTES = [
  "/", "/login", "/feed", "/feed/following", "/feed/similar",
  `/user/${U}`, `/user/${U}/listens`, `/user/${U}/stats`, `/user/${U}/stats?range=all_time`, `/user/${U}/stats/top-artists`, `/user/${U}/stats/top-albums`, `/user/${U}/stats/top-tracks`,
  `/user/${U}/taste`, `/user/${U}/playlists`, `/user/${U}/collaborations`, `/user/${U}/recommendations`,
  `/user/${U}/year-in-music`, `/user/${U}/year-in-music/2024`, `/user/${U}/year-in-music/2021`,
  `/recommended/tracks/${U}`, `/playlist/${PLAYLIST}`, "/playlist",
  "/statistics", "/statistics/top-artists", "/statistics/top-albums", "/statistics/top-tracks",
  `/artist/${ARTIST}`, `/album/${ALBUM}`, `/release/${RELEASE}`, `/track/${TRACK}`, `/recording/${TRACK}`,
  "/search", "/search?q=radiohead&type=artist", "/search?q=in%20rainbows&type=album", "/search?q=reckoner&type=track",
  "/search?q=jazz&type=playlist", "/search?q=rob&type=user",
  "/explore", "/explore/fresh-releases", "/explore/huesound", "/explore/huesound/eb743b", "/explore/lb-radio",
  "/explore/lb-radio?prompt=artist:(radiohead)&mode=easy", "/explore/similar-users", "/explore/music-neighborhood",
  "/explore/art-creator", "/explore/cover-art-collage",
  "/settings", "/settings/timezone", "/settings/recommendations", "/settings/player", "/settings/flair",
  "/settings/import", "/settings/export", "/settings/link-listens", "/settings/delete-listens",
  "/settings/music-services", "/settings/delete-account",
  "/about", "/current-status", "/data", "/donors", "/import-data", "/terms-of-service",
  `/player?playlist=${PLAYLIST}`, `/player/release/${RELEASE}`,
].filter((r) => !ONLY || r.includes(ONLY));

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--autoplay-policy=user-gesture-required", "--mute-audio"],
});

const report = [];

async function check(route, width, mode) {
  const page = await browser.newPage();
  const height = width < 700 ? 800 : 900;
  await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: width < 700, hasTouch: width < 700 });
  const consoleErrors = [];
  const failed = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200));
  });
  page.on("pageerror", (e) => consoleErrors.push(`PAGEERROR ${String(e.message).slice(0, 200)}`));
  page.on("response", (r) => {
    const u = r.url();
    if (r.status() >= 400 && !u.includes("youtube") && !u.includes("googleapis")) failed.push(`${r.status()} ${u.slice(0, 140)}`);
  });

  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const u = req.url();
    if (mode === "auth" && u.includes("api.listenbrainz.org")) {
      // Preflight first: Authorization must be named explicitly, "*" doesn't cover it.
      if (req.method() === "OPTIONS") {
        return req.respond({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "Authorization, Content-Type", "access-control-allow-methods": "GET, POST, DELETE, OPTIONS" } });
      }
      if (u.includes("/validate-token")) {
        return req.respond({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" },
          body: JSON.stringify({ code: 200, message: "Token valid.", valid: true, user_name: U }) });
      }
      if (req.method() !== "GET") {
        return req.respond({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ status: "ok" }) });
      }
      if (/\/user\/[^/]+\/feed\/events(\?|$)/.test(u)) {
        return req.respond({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" },
          body: JSON.stringify({ payload: { count: feedEvents.length, user_id: U, events: feedEvents } }) });
      }
    }
    if (isCacheable(u, req.method())) {
      return cachedGet(u).then((e) => req.respond({ status: e.status, contentType: e.contentType, headers: CORS, body: e.body })).catch(() => req.abort());
    }
    return req.continue();
  });

  if (mode === "auth") {
    await page.evaluateOnNewDocument(() => localStorage.setItem("undertone.token", "test-token-undertone-qa"));
  }

  let navError;
  try {
    await page.goto(BASE + route, { waitUntil: "networkidle2", timeout: 45000 });
  } catch (e) {
    navError = String(e.message).slice(0, 120);
  }
  await new Promise((r) => setTimeout(r, 1500));

  const issues = await page.evaluate((vw) => {
    const out = [];
    const doc = document.documentElement;
    if (doc.scrollWidth > vw + 1) out.push(`page scrolls sideways: ${doc.scrollWidth}px > ${vw}px`);
    const describe = (el) => {
      const cls = (el.className && typeof el.className === "string" ? el.className : "").split(/\s+/).slice(0, 4).join(".");
      const t = (el.innerText || el.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 40);
      return `<${el.tagName.toLowerCase()}${cls ? "." + cls : ""}> "${t}"`;
    };
    const clipped = (el) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) return true;
      }
      return false;
    };
    const all = Array.from(document.body.querySelectorAll("*"));
    let off = 0, spill = 0, wrap = 0, small = 0;
    for (const el of all) {
      const s = getComputedStyle(el);
      if (s.display === "none" || s.visibility === "hidden" || s.position === "fixed") continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // past the viewport edge
      if ((r.right > vw + 1 || r.left < -1) && !clipped(el) && off < 6) {
        off++; out.push(`off-screen (${Math.round(r.left)}→${Math.round(r.right)}): ${describe(el)}`);
      }
      // text spilling out of its own box (not intentionally truncated)
      if (el.children.length === 0 && el.scrollWidth > el.clientWidth + 2 && s.overflowX === "visible" && s.textOverflow !== "ellipsis" && el.clientWidth > 0 && !clipped(el) && spill < 6) {
        spill++; out.push(`text spills (${el.scrollWidth}>${el.clientWidth}): ${describe(el)}`);
      }
      // buttons / pills / tabs whose label wraps
      const isCtl = el.matches("button, [role=button], a.rounded-full, .pill, [role=tab], [role=radio]");
      if (isCtl && s.whiteSpace !== "nowrap" && s.flexDirection !== "column" && !el.dataset.multiline) {
        const lh = parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.3;
        const text = (el.innerText || "").trim();
        if (text && text.length > 2 && r.height > lh * 1.9 + parseFloat(s.paddingTop) + parseFloat(s.paddingBottom) && wrap < 6) {
          wrap++; out.push(`label wraps (${Math.round(r.height)}px): ${describe(el)}`);
        }
      }
      // small tap targets on phones
      const inlineText = s.display === "inline" || (el.tagName === "A" && el.parentElement && getComputedStyle(el.parentElement).display !== "flex" && el.parentElement.innerText.trim().length > el.innerText.trim().length + 2);
      const inRow = el.closest("[data-row], .group");
      if (vw < 700 && el.matches("button, a, [role=button], input, select") && !inlineText && !inRow && (r.height < 32 || r.width < 24) && small < 6) {
        small++; out.push(`small tap target ${Math.round(r.width)}x${Math.round(r.height)}: ${describe(el)}`);
      }
    }
    const h1 = document.querySelectorAll("h1").length;
    if (h1 !== 1) out.push(`h1 count = ${h1}`);
    return out;
  }, width);

  const name = `${mode}-${width}-${route.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home"}`;
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true, captureBeyondViewport: true });
  await page.close();
  const entry = { route, width, mode, issues, consoleErrors: [...new Set(consoleErrors)].slice(0, 5), failed: [...new Set(failed)].slice(0, 5), navError, shot: `${name}.png` };
  report.push(entry);
  const n = issues.length + entry.consoleErrors.length + (navError ? 1 : 0);
  process.stdout.write(`${n ? "!!" : "ok"} ${mode} ${width} ${route}${n ? `  (${n})` : ""}\n`);
}

const jobs = [];
for (const mode of MODES) for (const route of ROUTES) for (const w of WIDTHS) jobs.push([route, w, mode]);
const CONC = Number(process.env.CONC || 2);
let i = 0;
await Promise.all(
  Array.from({ length: CONC }, async () => {
    while (i < jobs.length) {
      const j = jobs[i++];
      try {
        await check(...j);
      } catch (e) {
        report.push({ route: j[0], width: j[1], mode: j[2], fatal: String(e).slice(0, 200) });
        process.stdout.write(`FATAL ${j.join(" ")} ${String(e).slice(0, 100)}\n`);
      }
    }
  })
);
await browser.close();
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
const bad = report.filter((r) => r.fatal || r.navError || r.issues?.length || r.consoleErrors?.length);
console.log(`\n${report.length} checks, ${bad.length} with findings. Report: ${path.join(OUT, "report.json")}`);
