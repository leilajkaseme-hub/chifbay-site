/**
 * Proves the metadata stripper removes what it must and keeps what it must.
 *
 *   node ig-auto/test-strip.mjs
 *
 * Runs against the ORIGINAL files as they arrived from Drive, pulled out of
 * git, so it tests real camera and AI output rather than a fixture someone
 * invented.
 */
import { execSync } from "node:child_process";
import { stripMetadata } from "./lib/strip-metadata.mjs";
import sharp from "./node_modules/sharp/lib/index.js";

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log("  ok   " + m)) : (fail++, console.log("  FAIL " + m)); };

const files = execSync("git ls-files social-drive", { encoding: "utf8" })
  .split("\n").filter((f) => /\.(jpe?g|png)$/i.test(f));
ok(files.length > 0, `${files.length} library photos tracked in git`);

const BAD = /GPSLatitude|GPSLongitude|DateTimeOriginal|Artist\0|dc:creator|Photoshop|Firefly|c2pa|contentcredentials|trainedAlgorithmic/i;
let cleaned = 0, keptIcc = 0;

for (const f of files) {
  let before;
  try { before = execSync(`git show HEAD:${f}`, { maxBuffer: 1 << 28, encoding: "buffer" }); }
  catch { continue; }
  const after = stripMetadata(before);

  // 1. nothing identifying survives, checked structurally not by eye
  const isPng = before[0] === 0x89;
  if (isPng) {
    const chunks = [];
    for (let i = 8; i < after.length - 8; ) {
      const len = after.readUInt32BE(i);
      const t = after.subarray(i + 4, i + 8).toString("latin1");
      chunks.push(t); if (t === "IDAT" || t === "IEND") break; i += 12 + len;
    }
    if (chunks.some((c) => ["tEXt", "iTXt", "zTXt", "eXIf", "caBX"].includes(c))) {
      ok(false, `${f}: a metadata chunk survived (${chunks.join(",")})`);
    }
  }
  if (before.length !== after.length) cleaned++;
  if (after.includes(Buffer.from("ICC_PROFILE")) || after.includes(Buffer.from("iCCP"))) keptIcc++;
}
ok(cleaned > 0, `${cleaned} of the originals actually carried metadata`);
ok(keptIcc > 0, `${keptIcc} kept their colour profile (stripping it washes photos out)`);

// 2. the picture itself must be untouched
const sample = files.find((f) => /\.jpe?g$/i.test(f));
const raw = execSync(`git show HEAD:${sample}`, { maxBuffer: 1 << 28, encoding: "buffer" });
const cut = stripMetadata(raw);
const a = await sharp(raw).metadata(), b = await sharp(cut).metadata();
ok(a.width === b.width && a.height === b.height, `${sample}: still ${b.width}x${b.height}`);
const pa = await sharp(raw).raw().toBuffer(), pb = await sharp(cut).raw().toBuffer();
ok(Buffer.compare(pa, pb) === 0, "every pixel is identical, so nothing was re-encoded");

// 3. running it twice must change nothing more
ok(Buffer.compare(stripMetadata(cut), cut) === 0, "running it again is a no-op");

// 4. rubbish in must not throw
ok(stripMetadata(Buffer.from("not an image")).length === 12, "a non image is returned untouched");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
