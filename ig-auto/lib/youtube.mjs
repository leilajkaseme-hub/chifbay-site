// youtube.mjs: one finished short video onto the Chifbay YouTube channel (@chifbay) as a Short.
//
// The order matters (20 Oct 2026, another channel: an interrupted upload left an EMPTY entry that went public at
// its publish time). So: upload as PRIVATE with no publish time, wait until YouTube says "processed" and the
// duration is not zero, set the custom thumbnail and the playlist, and only then switch it to public.
// A failed upload deletes its own empty entry before anything is tried again.
//
// Needs YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN (the channel's own OAuth, scope youtube.force-ssl).

const API = "https://www.googleapis.com/youtube/v3";
const UPLOAD = "https://www.googleapis.com/upload/youtube/v3";
const sleep = (ms) => new Promise((r) => setTimeout(r, process.env.YT_TEST_FAST === "1" ? 1 : ms));

export async function ytToken(env = process.env) {
  if (!env.YT_REFRESH_TOKEN) throw new Error("YouTube is not connected (YT_REFRESH_TOKEN missing)");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env.YT_CLIENT_ID, client_secret: env.YT_CLIENT_SECRET,
      refresh_token: env.YT_REFRESH_TOKEN, grant_type: "refresh_token" }),
  });
  const j = await r.json().catch(() => ({}));
  if (!j.access_token) throw new Error(`YouTube token refused: ${j.error ?? r.status} ${j.error_description ?? ""}`.trim());
  return j.access_token;
}

async function yt(token, method, path, body, { query = {}, base = API, headers = {} } = {}) {
  const url = new URL(`${base}${path}`);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const r = await fetch(url, {
    method, headers: { Authorization: `Bearer ${token}`, ...(body && !headers["Content-Type"] ? { "Content-Type": "application/json" } : {}), ...headers },
    body: body == null ? undefined : (body instanceof Uint8Array || body instanceof ArrayBuffer ? body : JSON.stringify(body)),
    signal: AbortSignal.timeout(600_000),
  });
  const text = await r.text();
  let j = {};
  try { j = text ? JSON.parse(text) : {}; } catch { j = { raw: text.slice(0, 300) }; }
  if (!r.ok) throw new Error(`YouTube ${method} ${path} ${r.status}: ${j.error?.message ?? text.slice(0, 200)}`);
  return { json: j, headers: r.headers };
}

async function bytesOf(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(300_000) });
  if (!r.ok) throw new Error(`could not read ${url} (${r.status})`);
  return new Uint8Array(await r.arrayBuffer());
}

/** The playlist for the Shorts, made once and remembered in shorts/config.json by the caller. */
export async function ensurePlaylist(token, title, description) {
  const { json } = await yt(token, "GET", "/playlists", null, { query: { part: "snippet", mine: "true", maxResults: "50" } });
  const hit = (json.items ?? []).find((p) => p.snippet?.title === title);
  if (hit) return hit.id;
  const made = await yt(token, "POST", "/playlists", {
    snippet: { title, description, defaultLanguage: "en" }, status: { privacyStatus: "public" },
  }, { query: { part: "snippet,status" } });
  return made.json.id;
}

/**
 * Upload, wait, finish, publish. `v` = the plan entry (texts, render urls), `meta` = recording date and place.
 * Returns {id, url}. Throws with a plain reason; an empty entry left by a failed upload is deleted first.
 */
export async function postShort(v, { token, playlist = null, location = null, recordedOn = null, log = console.log } = {}) {
  const t = v.texts;
  const video = await bytesOf(v.render.video);
  const snippet = {
    title: t.yt_title.slice(0, 100), description: t.yt_description.slice(0, 4900),
    tags: (t.yt_tags ?? []).slice(0, 25), categoryId: "19", defaultLanguage: "en", defaultAudioLanguage: "en",
  };
  const status = { privacyStatus: "private", selfDeclaredMadeForKids: false, containsSyntheticMedia: false,
    embeddable: true, publicStatsViewable: true, license: "youtube" };
  const recordingDetails = {
    ...(recordedOn ? { recordingDate: `${recordedOn}T12:00:00Z` } : {}),
    ...(location ? { location: { latitude: location.lat, longitude: location.lng, altitude: 0 }, locationDescription: location.name } : {}),
  };
  const start = await fetch(`${UPLOAD}/videos?uploadType=resumable&part=snippet,status,recordingDetails`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": "video/mp4", "X-Upload-Content-Length": String(video.byteLength) },
    body: JSON.stringify({ snippet, status, recordingDetails }),
  });
  const session = start.headers.get("location");
  if (!start.ok || !session) throw new Error(`YouTube upload start ${start.status}: ${(await start.text()).slice(0, 200)}`);
  let id = null;
  try {
    const put = await fetch(session, { method: "PUT", headers: { "Content-Type": "video/mp4", "Content-Length": String(video.byteLength) },
      body: video, signal: AbortSignal.timeout(600_000) });
    const j = await put.json().catch(() => ({}));
    if (!put.ok || !j.id) throw new Error(`YouTube upload ${put.status}: ${JSON.stringify(j).slice(0, 200)}`);
    id = j.id;
    log(`  youtube: uploaded ${id} as private, waiting for processing`);
    let processed = false;
    for (let i = 0; i < 60 && !processed; i++) {
      await sleep(15_000);
      const { json } = await yt(token, "GET", "/videos", null, { query: { part: "status,contentDetails,processingDetails", id } });
      const it = json.items?.[0];
      if (!it) continue;
      if (it.status?.uploadStatus === "failed" || it.status?.uploadStatus === "rejected") {
        throw new Error(`YouTube ${it.status.uploadStatus}: ${it.status.failureReason ?? it.status.rejectionReason ?? ""}`);
      }
      processed = it.status?.uploadStatus === "processed" && it.contentDetails?.duration && it.contentDetails.duration !== "P0D";
    }
    if (!processed) throw new Error("YouTube did not finish processing in 15 minutes");
  } catch (err) {
    if (id) {
      await yt(token, "DELETE", "/videos", null, { query: { id } }).catch(() => {});
      log(`  youtube: deleted the unfinished entry ${id}`);
    }
    throw err;
  }
  // the designed thumbnail (needs a phone-verified channel: @chifbay is); a refusal is not worth losing the post
  try {
    const thumb = await bytesOf(v.render.thumb);
    await yt(token, "POST", "/thumbnails/set", thumb, { base: UPLOAD, query: { videoId: id }, headers: { "Content-Type": "image/jpeg" } });
  } catch (err) { log(`  youtube: thumbnail not set (${err.message})`); }
  if (playlist) {
    await yt(token, "POST", "/playlistItems", { snippet: { playlistId: playlist, resourceId: { kind: "youtube#video", videoId: id } } },
      { query: { part: "snippet" } }).catch((err) => log(`  youtube: playlist not set (${err.message})`));
  }
  await yt(token, "PUT", "/videos", { id, status: { ...status, privacyStatus: "public" } }, { query: { part: "status" } });
  return { id, url: `https://www.youtube.com/shorts/${id}` };
}

/** Was this plan entry already uploaded? Matches the title among the channel's last uploads (a timeout can hide a success). */
export async function findShort(token, title) {
  const ch = await yt(token, "GET", "/channels", null, { query: { part: "contentDetails", mine: "true" } });
  const uploads = ch.json.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) return null;
  const { json } = await yt(token, "GET", "/playlistItems", null, { query: { part: "snippet", playlistId: uploads, maxResults: "15" } });
  const hit = (json.items ?? []).find((i) => i.snippet?.title === title.slice(0, 100));
  return hit ? hit.snippet.resourceId.videoId : null;
}
