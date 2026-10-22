#!/usr/bin/env node
// connect.mjs: one-time consent as the profile owner, to get the refresh token the robot keeps.
//
//   node gbp/connect.mjs <client_id> <client_secret>
//   node gbp/connect.mjs            wait for the client to be POSTed to 127.0.0.1:8765/creds by the Cloud console page
//                                   (so the secret never passes through a chat or a shell history)
//
// Opens a local page on 127.0.0.1:8765, prints the Google consent link; after "Allow" (chifandcopt@gmail.com) the
// refresh token is saved to .credentials/chifbay-gbp-oauth.json (mode 600) and set as the repo's GitHub secrets.
// Nothing is printed of the token itself.
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import { chmodSync, writeFileSync } from "node:fs";

let [id, secret] = process.argv.slice(2);
const REDIRECT = "http://127.0.0.1:8765/";
const CONSOLE = "https://console.cloud.google.com";
function consentLink() {
  const url = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
    client_id: id, redirect_uri: REDIRECT, response_type: "code", access_type: "offline", prompt: "consent",
    scope: "https://www.googleapis.com/auth/business.manage", login_hint: "chifandcopt@gmail.com",
  });
  console.log(`open this link and tap Allow:\n${url}`);
}
if (id && secret) consentLink(); else console.log("waiting for the client on http://127.0.0.1:8765/creds");

const cors = { "Access-Control-Allow-Origin": CONSOLE, "Access-Control-Allow-Methods": "POST",
               "Access-Control-Allow-Headers": "content-type", "Access-Control-Allow-Private-Network": "true" };

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204, cors); res.end(); return; }
  if (req.method === "POST" && req.url === "/creds") {
    let body = "";
    for await (const c of req) body += c;
    // JSON from fetch, or a plain form POST (the console's own rules can block fetch to 127.0.0.1, not a form)
    const j = body.trim().startsWith("{") ? JSON.parse(body) : Object.fromEntries(new URLSearchParams(body));
    if (!/\.apps\.googleusercontent\.com$/.test(j.id ?? "") || !j.secret) { res.writeHead(400, cors); res.end("bad client"); return; }
    [id, secret] = [j.id, j.secret];
    res.writeHead(200, { ...cors, "Content-Type": "text/plain" }); res.end("client received, you can close this tab");
    consentLink();
    return;
  }
  const code = new URL(req.url, REDIRECT).searchParams.get("code");
  if (!code) { res.end("waiting for Google"); return; }
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: id, client_secret: secret, redirect_uri: REDIRECT, grant_type: "authorization_code" }),
  });
  const j = await r.json();
  if (!j.refresh_token) { res.end("no refresh token: " + (j.error ?? r.status)); console.error("no refresh token", j.error); process.exit(1); }
  const f = "/Users/Shared/Claude/.credentials/chifbay-gbp-oauth.json";
  writeFileSync(f, JSON.stringify({ client_id: id, client_secret: secret, refresh_token: j.refresh_token, scope: j.scope, saved: new Date().toISOString() }, null, 1));
  chmodSync(f, 0o600);
  for (const [k, v] of [["GBP_CLIENT_ID", id], ["GBP_CLIENT_SECRET", secret], ["GBP_REFRESH_TOKEN", j.refresh_token]]) {
    execFileSync("gh", ["secret", "set", k, "--repo", "leilajkaseme-hub/chifbay-site"], { input: v });
  }
  res.end("Chifbay Google Business Profile connected. You can close this tab.");
  console.log(`connected: token saved in ${f} and in the GitHub secrets`);
  server.close();
});
server.listen(8765, "127.0.0.1");
