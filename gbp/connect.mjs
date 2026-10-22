#!/usr/bin/env node
// connect.mjs: one-time consent as the profile owner, to get the refresh token the robot keeps.
//
//   node gbp/connect.mjs <client_id> <client_secret>
//
// Opens a local page on 127.0.0.1:8765, prints the Google consent link; after "Allow" (chifandcopt@gmail.com) the
// refresh token is saved to .credentials/chifbay-gbp-oauth.json (mode 600) and set as the repo's GitHub secrets.
// Nothing is printed of the token itself.
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import { chmodSync, writeFileSync } from "node:fs";

const [id, secret] = process.argv.slice(2);
if (!id || !secret) { console.error("usage: node gbp/connect.mjs <client_id> <client_secret>"); process.exit(2); }
const REDIRECT = "http://127.0.0.1:8765/";
const url = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
  client_id: id, redirect_uri: REDIRECT, response_type: "code", access_type: "offline", prompt: "consent",
  scope: "https://www.googleapis.com/auth/business.manage", login_hint: "chifandcopt@gmail.com",
});
console.log(`open this link and tap Allow:\n${url}`);

const server = createServer(async (req, res) => {
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
