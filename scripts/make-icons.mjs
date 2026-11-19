// Renders src/app/icon.svg to src/app/apple-icon.png (180px) and src/app/favicon.ico (16, 32 and 48px PNGs).
// Run after changing the icon: node scripts/make-icons.mjs (needs a local Chrome).
import fs from "node:fs";
import puppeteer from "puppeteer-core";

const svg = fs.readFileSync("src/app/icon.svg", "utf8");
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const page = await browser.newPage();

async function png(size) {
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  // One circular icon everywhere; iOS fills the transparent corners of the Apple icon itself.
  const body = svg;
  await page.setContent(`<html><body style="margin:0;background:transparent">${body.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`);
  return page.screenshot({ type: "png", omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}

fs.writeFileSync("src/app/apple-icon.png", await png(180));

// An .ico file may hold PNG images: a 6-byte header, a 16-byte entry per image, then the images.
const sizes = [16, 32, 48];
const images = [];
for (const s of sizes) images.push(await png(s));
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((s, i) => {
  const e = 6 + 16 * i;
  header.writeUInt8(s, e);
  header.writeUInt8(s, e + 1);
  header.writeUInt16LE(1, e + 4);
  header.writeUInt16LE(32, e + 6);
  header.writeUInt32LE(images[i].length, e + 8);
  header.writeUInt32LE(offset, e + 12);
  offset += images[i].length;
});
fs.writeFileSync("src/app/favicon.ico", Buffer.concat([header, ...images]));
await browser.close();
console.log("wrote src/app/apple-icon.png and src/app/favicon.ico");
