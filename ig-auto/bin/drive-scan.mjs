#!/usr/bin/env node
// drive-scan.mjs: look at, and cut from, the big videos on the Drive WITHOUT downloading them to a disk.
// Runs on GitHub Actions (workflow ig-auto-drive-scan.yml) with the same read-only service account as drive-sync.
// The MacBook disk is nearly full and the Drive app times out on files of 1 GB and more, so ffmpeg reads the file
// over HTTP (range requests) from the Drive API instead.
//
//   node bin/drive-scan.mjs list [regex]                     every video of the tree with id, size, size on the Drive
//   node bin/drive-scan.mjs sheets <regex> [seconds]         a contact sheet per matching video (one frame every N seconds, 4 by default)
//   node bin/drive-scan.mjs frames <name> <t0> <t1> [step]   a finer sheet of one window, 0.5 s by default
//   node bin/drive-scan.mjs windows <name>:<t0>-<t1>[@step] ...   a finer sheet per window
//   node bin/drive-scan.mjs cut <name> <start> <len> <out>   stream-copy one window into out/<out>.mp4 (a few MB to tens of MB)
//   node bin/drive-scan.mjs urls <file>                      a read-only token + every video's Drive id, into <file> (see below)
//
// Output goes to ./scan-out/ (the workflow uploads it as an artifact). Nothing is ever written to Drive.
import crypto from "node:crypto";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const OUT = "scan-out";
fs.mkdirSync(OUT, { recursive: true });
const FOLDER = process.env.DRIVE_PUBLISH_FOLDER_ID;
const VIDEO = /\.(mp4|mov|m4v)$/i;

async function token() {
  const key = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = b64({ alg: "RS256", typ: "JWT" }) + "." + b64({ iss: key.client_email, scope: "https://www.googleapis.com/auth/drive.readonly",
    aud: "https://oauth2.googleapis.com/token", exp: now + 3600, iat: now });
  const sig = crypto.createSign("RSA-SHA256").update(unsigned).sign(key.private_key, "base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${sig}` }) });
  const j = await res.json();
  if (!j.access_token) throw new Error("no access token: " + JSON.stringify(j).slice(0, 200));
  return j.access_token;
}

async function walk(tok, id, path = "") {
  const out = [];
  let page = "";
  do {
    const p = new URLSearchParams({ q: `'${id}' in parents and trashed = false`, fields: "nextPageToken, files(id,name,mimeType,size,createdTime)",
      pageSize: "200", supportsAllDrives: "true", includeItemsFromAllDrives: "true" });
    if (page) p.set("pageToken", page);
    const r = await fetch(`https://www.googleapis.com/drive/v3/files?${p}`, { headers: { authorization: `Bearer ${tok}` } });
    if (!r.ok) throw new Error(`list ${r.status}`);
    const j = await r.json();
    for (const f of j.files || []) {
      if (f.mimeType === "application/vnd.google-apps.folder") out.push(...await walk(tok, f.id, `${path}${f.name}/`));
      else out.push({ ...f, path: `${path}${f.name}` });
    }
    page = j.nextPageToken || "";
  } while (page);
  return out;
}

const url = (f) => `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media&supportsAllDrives=true`;
const hdr = (tok) => ["-headers", `Authorization: Bearer ${tok}\r\n`];
const run = (cmd, args) => spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const safe = (s) => s.replace(/[^A-Za-z0-9._-]+/g, "_");
// a name with spaces cannot go through the workflow input (arguments are split on spaces): write "+" for each space
const byName = (n) => all.find((x) => x.name === n) || all.find((x) => x.name === n.replace(/\+/g, " "));

function probe(tok, f) {
  const r = run("ffprobe", ["-v", "error", ...hdr(tok), "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate:format=duration", "-of", "json", url(f)]);
  try { const j = JSON.parse(r.stdout); const s = j.streams?.[0] || {}; return { w: s.width, h: s.height, fps: s.r_frame_rate, dur: Number(j.format?.duration) || null }; }
  catch { return { error: (r.stderr || "").slice(0, 120) }; }
}

const [, , mode, ...rest] = process.argv;
const tok = await token();
const all = (await walk(tok, FOLDER)).filter((f) => VIDEO.test(f.name));

if (mode === "list") {
  const re = new RegExp(rest[0] || ".", "i");
  const rows = [];
  for (const f of all.filter((x) => re.test(x.path))) rows.push({ name: f.name, path: f.path, id: f.id, mb: Math.round((Number(f.size) || 0) / 1e6), day: f.createdTime?.slice(0, 10) });
  fs.writeFileSync(`${OUT}/list.json`, JSON.stringify(rows, null, 1));
  for (const r of rows) console.log(`${String(r.mb).padStart(5)} MB  ${r.day}  ${r.path}`);
} else if (mode === "sheets") {
  const re = new RegExp(rest[0], "i"), step = Number(rest[1] || 4);
  const index = [];
  for (const f of all.filter((x) => re.test(x.path) && Number(x.size) > 3e6)) {
    const info = probe(tok, f);
    const sheet = `${OUT}/${safe(f.name)}.jpg`;
    const r = run("ffmpeg", ["-v", "error", "-y", ...hdr(tok), "-i", url(f), "-vf", `fps=1/${step},scale=240:-1,tile=10x6`, "-frames:v", "1", sheet]);
    index.push({ name: f.name, path: f.path, mb: Math.round(Number(f.size) / 1e6), ...info, step, sheet: fs.existsSync(sheet) ? sheet : null, err: fs.existsSync(sheet) ? undefined : (r.stderr || "").slice(0, 160) });
    console.log(JSON.stringify(index.at(-1)));
  }
  fs.writeFileSync(`${OUT}/index.json`, JSON.stringify(index, null, 1));
} else if (mode === "frames") {
  const [name, t0, t1, step = "0.5"] = rest;
  const f = byName(name);
  if (!f) throw new Error(`no video named ${name}`);
  const sheet = `${OUT}/${safe(name)}_${t0}-${t1}.jpg`;
  const r = run("ffmpeg", ["-v", "error", "-y", ...hdr(tok), "-ss", t0, "-t", String(Number(t1) - Number(t0)), "-i", url(f), "-vf", `fps=1/${step},scale=240:-1,tile=10x6`, "-frames:v", "1", sheet]);
  console.log(fs.existsSync(sheet) ? sheet : (r.stderr || "").slice(0, 300));
} else if (mode === "windows") {
  // windows <name>:<t0>-<t1>[@step] ...   one finer sheet per window (60 tiles: 30 s at 0.5 s)
  for (const w of rest) {
    const m = /^(.+):(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)(?:@(\d+(?:\.\d+)?))?$/.exec(w);
    if (!m) { console.log(`bad window ${w}`); continue; }
    const [, name, t0, t1, step = "0.5"] = m;
    const f = byName(name);
    if (!f) { console.log(`no video named ${name}`); continue; }
    const sheet = `${OUT}/${safe(name)}_${t0}-${t1}.jpg`;
    const r = run("ffmpeg", ["-v", "error", "-y", ...hdr(tok), "-ss", t0, "-t", String(Number(t1) - Number(t0)), "-i", url(f), "-vf", `fps=1/${step},scale=240:-1,tile=10x6`, "-frames:v", "1", sheet]);
    console.log(fs.existsSync(sheet) ? sheet : (r.stderr || "").slice(0, 200));
  }
} else if (mode === "keyframes") {
  // keyframes <name>:<t> ...   the time of the last keyframe at or before t: where a stream-copied window cut at t really starts
  for (const w of rest) {
    const i = w.lastIndexOf(":"), name = w.slice(0, i), at = Number(w.slice(i + 1));
    const f = byName(name);
    if (!f) { console.log(`no video named ${name}`); continue; }
    const r = run("ffprobe", ["-v", "error", ...hdr(tok), "-select_streams", "v:0", "-read_intervals", `${Math.max(0, at - 4)}%${at + 0.05}`,
      "-show_entries", "packet=pts_time,flags", "-of", "csv=p=0", url(f)]);
    const keys = (r.stdout || "").split("\n").filter((l) => l.includes("K")).map((l) => Number(l.split(",")[0])).filter((x) => x <= at + 0.001);
    console.log(`KEY ${name}:${at} ${keys.length ? keys.at(-1).toFixed(3) : "none"}`);
  }
} else if (mode === "status") {
  // status <name> ...   Google's answer to a 1 KB read of each video: 206 = fine, else the reason (a quota, a rate limit)
  for (const name of rest) {
    const f = byName(name);
    if (!f) { console.log(`no video named ${name}`); continue; }
    const r = await fetch(url(f), { headers: { authorization: `Bearer ${tok}`, range: "bytes=0-1023" } });
    const body = r.ok ? "" : (await r.text()).replace(/\s+/g, " ").slice(0, 300);
    console.log(`STATUS ${name} ${r.status} ${body}`);
  }
} else if (mode === "urls") {
  // urls <file>   write {token, files: {name: {id, size}}} to <file> (outside scan-out: never uploaded), for tools that
  // stream the videos themselves (shorts/oldmoney). The token is a 1-hour read-only Drive token: never print it.
  const files = {};
  for (const f of all) if (!files[f.name]) files[f.name] = { id: f.id, size: Number(f.size) || 0, path: f.path };
  fs.writeFileSync(rest[0], JSON.stringify({ token: tok, files }), { mode: 0o600 });
  console.log(`${Object.keys(files).length} videos listed`);
} else if (mode === "cutmany") {
  // cutmany <name>:<start>:<len>:<out> ...   stream-copy several windows (cut points fall on the keyframe before start)
  for (const w of rest) {
    const [name, start, len, out] = w.split(":");
    const f = byName(name);
    if (!f) { console.log(`no video named ${name}`); continue; }
    const dest = `${OUT}/${safe(out)}.mp4`;
    const r = run("ffmpeg", ["-v", "error", "-y", ...hdr(tok), "-ss", start, "-t", len, "-i", url(f), "-c", "copy", "-avoid_negative_ts", "make_zero", dest]);
    console.log(fs.existsSync(dest) ? `${dest} ${(fs.statSync(dest).size / 1e6).toFixed(1)} MB` : (r.stderr || "").slice(0, 200));
  }
} else if (mode === "cutenc") {
  // cutenc <name>:<start>:<len>:<out> ...   like cutmany but re-encoded (1620p H.264 crf 24, no sound): small enough for this Mac disk
  for (const w of rest) {
    const [name, start, len, out] = w.split(":");
    const f = byName(name);
    if (!f) { console.log(`no video named ${name}`); continue; }
    const dest = `${OUT}/${safe(out)}.mp4`;
    const r = run("ffmpeg", ["-v", "error", "-y", ...hdr(tok), "-ss", start, "-t", len, "-i", url(f), "-an", "-vf", "scale=-2:1620", "-c:v", "libx264", "-preset", "veryfast", "-crf", "24", "-pix_fmt", "yuv420p", dest]);
    console.log(fs.existsSync(dest) ? `${dest} ${(fs.statSync(dest).size / 1e6).toFixed(1)} MB` : (r.stderr || "").slice(0, 200));
  }
} else if (mode === "cut") {
  const [name, start, len, out] = rest;
  const f = byName(name);
  if (!f) throw new Error(`no video named ${name}`);
  const dest = `${OUT}/${safe(out)}.mp4`;
  const r = run("ffmpeg", ["-v", "error", "-y", ...hdr(tok), "-ss", start, "-t", len, "-i", url(f), "-c", "copy", "-avoid_negative_ts", "make_zero", dest]);
  console.log(fs.existsSync(dest) ? `${dest} ${(fs.statSync(dest).size / 1e6).toFixed(1)} MB` : (r.stderr || "").slice(0, 300));
} else {
  console.error("modes: list | sheets | frames | windows | cutmany | cutenc | cut | urls");
  process.exit(2);
}
