"""Shared helpers for the Chifbay short videos (Reels, Shorts, TikTok), run on GitHub Actions.

Why GitHub: both Macs are short of disk, and the trip footage on the Drive is 1 to 3.5 GB per drone file.
Here ffmpeg reads the files straight from the Drive API (read-only service account) and nothing big is kept.

Secrets come from the environment (GitHub secrets), never from files in this public repo:
  GOOGLE_SERVICE_ACCOUNT_JSON, DRIVE_PUBLISH_FOLDER_ID   read the footage
  GEMINI_API_KEY                                         free tier: pick moments, write texts, make music
  IG_SYNC_SECRET                                         write to the video store (chifbay-media Worker)
"""
import base64, json, os, pathlib, subprocess, sys, tempfile, time, urllib.error, urllib.parse, urllib.request

HERE = pathlib.Path(__file__).parent
SITE = HERE.parent
MOMENTS = HERE / "moments.json"
PLAN = HERE / "plan.json"
FONTS = HERE / "fonts"
MEDIA = os.environ.get("MEDIA_URL", "https://chifbay-media.chifandcopt.workers.dev")
VIDEO_EXT = (".mp4", ".mov", ".m4v")
# Newest first. A model that is busy (503) or out of free quota (429) hands over to the next one.
MODELS = ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash"]


def log(*a):
    print(*a, flush=True)


def read_json(path, default):
    try:
        return json.loads(pathlib.Path(path).read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def write_json(path, data):
    tmp = pathlib.Path(str(path) + ".tmp")
    tmp.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n")
    tmp.replace(path)


def run(args, **kw):
    r = subprocess.run(args, capture_output=True, text=kw.pop("text", True), stdin=subprocess.DEVNULL, **kw)
    if r.returncode:
        err = r.stderr if isinstance(r.stderr, str) else r.stderr.decode("utf8", "replace")
        raise RuntimeError(f"{args[0]} failed: {err[-800:]}")
    return r.stdout


def http(url, data=None, headers=None, method=None, timeout=120):
    """(status, headers, body bytes). Never raises on an HTTP error status; a timeout or a dropped link is status 0."""
    # Cloudflare answers 403 (error 1010) to Python's default User-Agent, before our Worker even runs.
    req = urllib.request.Request(url, data=data, headers={"User-Agent": "chifbay-shorts/1.0", **(headers or {})}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, dict(r.headers), r.read()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers or {}), e.read()
    except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as e:
        return 0, {}, str(e).encode()


# ---- Drive (read only) ------------------------------------------------------------------------

_token = {"value": None, "exp": 0}


def drive_token():
    """Service-account token, signed with openssl so no Google library is needed."""
    if _token["value"] and time.time() < _token["exp"] - 300:
        return _token["value"]
    key = json.loads(os.environ["GOOGLE_SERVICE_ACCOUNT_JSON"])
    b64 = lambda o: base64.urlsafe_b64encode(json.dumps(o, separators=(",", ":")).encode()).rstrip(b"=").decode()
    now = int(time.time())
    unsigned = b64({"alg": "RS256", "typ": "JWT"}) + "." + b64({
        "iss": key["client_email"], "scope": "https://www.googleapis.com/auth/drive.readonly",
        "aud": "https://oauth2.googleapis.com/token", "exp": now + 3600, "iat": now})
    with tempfile.NamedTemporaryFile("w", suffix=".pem", delete=False) as f:
        f.write(key["private_key"])
        pem = f.name
    try:
        sig = subprocess.run(["openssl", "dgst", "-sha256", "-sign", pem], input=unsigned.encode(),
                             capture_output=True, check=True).stdout
    finally:
        os.unlink(pem)
    jwt = unsigned + "." + base64.urlsafe_b64encode(sig).rstrip(b"=").decode()
    st, _, body = http("https://oauth2.googleapis.com/token", urllib.parse.urlencode({
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": jwt}).encode(),
        {"content-type": "application/x-www-form-urlencoded"})
    j = json.loads(body)
    if "access_token" not in j:
        raise RuntimeError(f"Drive token refused ({st}): {body[:200]}")
    _token.update(value=j["access_token"], exp=now + int(j.get("expires_in", 3600)))
    return _token["value"]


def drive_videos():
    """Every video under the PUBLISH folder, with its path. Same file in two folders = one entry (first path)."""
    out, seen = [], set()

    def walk(folder, path):
        page = ""
        while True:
            q = {"q": f"'{folder}' in parents and trashed = false", "pageSize": "200",
                 "fields": "nextPageToken, files(id,name,mimeType,size,createdTime,videoMediaMetadata)",
                 "supportsAllDrives": "true", "includeItemsFromAllDrives": "true"}
            if page:
                q["pageToken"] = page
            st, _, body = http("https://www.googleapis.com/drive/v3/files?" + urllib.parse.urlencode(q),
                               headers={"authorization": f"Bearer {drive_token()}"})
            if st != 200:
                raise RuntimeError(f"Drive list {st}: {body[:200]}")
            j = json.loads(body)
            for f in j.get("files", []):
                if f["mimeType"] == "application/vnd.google-apps.folder":
                    walk(f["id"], f"{path}{f['name']}/")
                elif f["name"].lower().endswith(VIDEO_EXT):
                    k = (f["name"], f.get("size"))
                    if k not in seen:
                        seen.add(k)
                        out.append({**f, "path": path + f["name"], "size": int(f.get("size") or 0)})
            page = j.get("nextPageToken")
            if not page:
                break

    walk(os.environ["DRIVE_PUBLISH_FOLDER_ID"], "")
    return out


def drive_input(file_id):
    """ffmpeg input arguments that stream a Drive file over HTTP (range requests, no download to disk)."""
    return ["-headers", f"Authorization: Bearer {drive_token()}\r\n",
            "-i", f"https://www.googleapis.com/drive/v3/files/{file_id}?alt=media&supportsAllDrives=true"]


def probe_drive(file_id):
    args = ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
            "stream=width,height,r_frame_rate:stream_side_data=rotation:format=duration", "-of", "json"]
    args += drive_input(file_id)
    # ffprobe takes the URL as a plain argument, not after -i
    args = [a for a in args if a != "-i"]
    j = json.loads(run(args))
    s = j["streams"][0]
    w, h = s["width"], s["height"]
    rot = next((abs(int(d.get("rotation", 0))) for d in s.get("side_data_list", []) if "rotation" in d), 0)
    if rot in (90, 270):
        w, h = h, w
    num, den = s["r_frame_rate"].split("/")
    return {"w": w, "h": h, "fps": round(float(num) / float(den), 2), "dur": round(float(j["format"]["duration"]), 2)}


# ---- Gemini (free tier) -----------------------------------------------------------------------

def gemini_key():
    k = os.environ.get("GEMINI_API_KEY")
    if not k:
        sys.exit("GEMINI_API_KEY is not set")
    return k


def gemini_upload(path, mime="video/mp4"):
    """Upload a file to the Gemini File API; returns its uri once it is ACTIVE."""
    size = os.path.getsize(path)
    st, hd, body = http(f"https://generativelanguage.googleapis.com/upload/v1beta/files?key={gemini_key()}",
                        json.dumps({"file": {"display_name": pathlib.Path(path).name}}).encode(),
                        {"X-Goog-Upload-Protocol": "resumable", "X-Goog-Upload-Command": "start",
                         "X-Goog-Upload-Header-Content-Length": str(size),
                         "X-Goog-Upload-Header-Content-Type": mime, "Content-Type": "application/json"})
    up = {k.lower(): v for k, v in hd.items()}.get("x-goog-upload-url")
    if st != 200 or not up:
        raise RuntimeError(f"Gemini upload start {st}: {body[:200]}")
    st, _, body = http(up, pathlib.Path(path).read_bytes(),
                       {"X-Goog-Upload-Command": "upload, finalize", "X-Goog-Upload-Offset": "0",
                        "Content-Length": str(size)}, timeout=600)
    f = json.loads(body).get("file", {})
    if st != 200 or not f.get("uri"):
        raise RuntimeError(f"Gemini upload {st}: {body[:200]}")
    for _ in range(90):
        if f.get("state") == "ACTIVE":
            return f["uri"], f["name"]
        if f.get("state") == "FAILED":
            raise RuntimeError(f"Gemini could not read {path}")
        time.sleep(4)
        st, _, body = http(f"https://generativelanguage.googleapis.com/v1beta/{f['name']}?key={gemini_key()}")
        f = json.loads(body)
    raise RuntimeError("Gemini file never became ACTIVE")


def gemini_delete(name):
    http(f"https://generativelanguage.googleapis.com/v1beta/{name}?key={gemini_key()}", method="DELETE")


_spent = set()


class QuotaGone(RuntimeError):
    """Every model is out of free quota for today: stop and let tomorrow's run continue."""


def gemini(parts, *, schema_hint=True, temperature=0.4, media_low=False, models=None, timeout=300):
    """One generateContent call that returns parsed JSON. Busy or out-of-quota models hand over to the next."""
    cfg = {"temperature": temperature}
    if schema_hint:
        cfg["responseMimeType"] = "application/json"
    if media_low:
        cfg["mediaResolution"] = "MEDIA_RESOLUTION_LOW"
    body = json.dumps({"contents": [{"role": "user", "parts": parts}], "generationConfig": cfg}).encode()
    quota_out = 0
    tried = [m for m in (models or MODELS) if m not in _spent] or (models or MODELS)
    for attempt in range(3):
        for m in tried:
            if m in _spent:
                continue
            st, _, raw = http(f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={gemini_key()}",
                              body, {"content-type": "application/json"}, timeout=timeout)
            if st == 200:
                j = json.loads(raw)
                try:
                    text = "".join(p.get("text", "") for p in j["candidates"][0]["content"]["parts"] if not p.get("thought"))
                except (KeyError, IndexError):
                    log(f"  {m}: empty answer ({str(j)[:160]})")
                    continue
                if not schema_hint:
                    return text, m
                try:
                    return json.loads(text.strip().removeprefix("```json").removesuffix("```").strip()), m
                except json.JSONDecodeError:
                    log(f"  {m}: answer was not JSON, next model")
                    continue
            msg = raw[:160].decode("utf8", "replace")
            log(f"  {m}: HTTP {st} {msg.splitlines()[0] if msg else ''}")
            if st == 429:
                quota_out += 1
                if b"PerDay" in raw:
                    _spent.add(m)       # the free tier gives 20 calls a day per model: do not ask again today
        if all(m in _spent for m in tried) or quota_out >= len(tried):
            raise QuotaGone("all Gemini models are out of free quota")
        time.sleep(30 * (attempt + 1))
    raise RuntimeError("no Gemini model answered")


# ---- the video store (Cloudflare Worker chifbay-media) -----------------------------------------

def media_put(name, path, ctype):
    """Upload a finished file; returns its public URL. Instagram, Facebook and Threads fetch videos by URL."""
    secret = os.environ["IG_SYNC_SECRET"]
    data = pathlib.Path(path).read_bytes()
    for attempt in range(4):
        st, _, body = http(f"{MEDIA}/m/{name}", data, {"Authorization": f"Bearer {secret}", "Content-Type": ctype},
                           method="PUT", timeout=300)
        if st == 200:
            return f"{MEDIA}/m/{name}"
        log(f"  media store {st}: {body[:120]}")
        time.sleep(10 * (attempt + 1))
    raise RuntimeError(f"could not store {name}")


def notify(title, message, inbox=False):
    cfg = read_json(SITE / "ig-auto" / "config.json", {})
    url = (cfg.get("ntfy") or {}).get("inbox" if inbox else "alerts")
    if url:
        http(url, message.encode(), {"Title": title.encode("ascii", "replace").decode()}, timeout=30)


def workers_ai(prompt, temperature=0.7):
    """Text from Cloudflare Workers AI (free daily allowance), when Gemini's free calls are spent for the day."""
    acct, tok = os.environ.get("CF_ACCOUNT_ID"), os.environ.get("CF_WORKERS_AI_TOKEN")
    if not acct or not tok:
        raise RuntimeError("Workers AI is not configured (CF_ACCOUNT_ID, CF_WORKERS_AI_TOKEN)")
    model = "@cf/meta/llama-3.3-70b-instruct-fp8-fast"
    body = json.dumps({"messages": [{"role": "system", "content": "You answer with one JSON object and nothing else."},
                                    {"role": "user", "content": prompt}],
                       "max_tokens": 2500, "temperature": temperature}).encode()
    st, _, raw = http(f"https://api.cloudflare.com/client/v4/accounts/{acct}/ai/run/{model}", body,
                      {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}, timeout=120)
    if st != 200:
        raise RuntimeError(f"Workers AI {st}: {raw[:160]}")
    out = json.loads(raw).get("result", {}).get("response", "")
    if isinstance(out, dict):
        return out, model
    a, b = out.find("{"), out.rfind("}")
    return json.loads(out[a:b + 1]), model


def write_json_ai(prompt, temperature=0.7, timeout=90):
    """JSON text from Gemini, or from Workers AI when Gemini is out of free calls or not answering."""
    try:
        return gemini([{"text": prompt}], temperature=temperature, timeout=timeout)
    except (QuotaGone, RuntimeError) as e:
        log(f"  Gemini unavailable ({e}), using Workers AI")
        return workers_ai(prompt, temperature)
