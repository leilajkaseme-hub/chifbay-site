#!/usr/bin/env node
// whoami.mjs — setup helper. Run it once with a token to find IG_USER_ID.
//
//   IG_ACCESS_TOKEN=EAAG... node bin/whoami.mjs
//
// Meta's own UI buries this id, and it is not the number in your profile URL.
// It is the "Instagram Business Account" id hanging off the Facebook Page.
import { GRAPH } from "../lib/publish.mjs";

const token = process.env.IG_ACCESS_TOKEN;
if (!token) {
  console.error("Set IG_ACCESS_TOKEN first:  IG_ACCESS_TOKEN=EAAG... node bin/whoami.mjs");
  process.exit(1);
}

const url = new URL(`${GRAPH}/me/accounts`);
url.searchParams.set("fields", "name,instagram_business_account{id,username}");
url.searchParams.set("access_token", token);

const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
const json = await res.json().catch(() => ({}));

if (json.error) {
  console.error(`Meta says: ${json.error.message}`);
  console.error("\nUsually this means the token is missing the pages_show_list permission,");
  console.error("or the System User has not been given access to the Page.");
  process.exit(1);
}

const pages = json.data ?? [];
if (!pages.length) {
  console.error("No Facebook Pages are visible to this token.");
  console.error("Check that the System User has been assigned the Chifbay Page in Business Settings.");
  process.exit(1);
}

console.log("Pages this token can see:\n");
let found = false;
for (const p of pages) {
  const ig = p.instagram_business_account;
  console.log(`  ${p.name}`);
  if (ig) {
    found = true;
    console.log(`    Instagram : @${ig.username}`);
    console.log(`    IG_USER_ID: ${ig.id}   <-- put this in the GitHub secret`);
  } else {
    console.log("    (no Instagram business account linked to this Page)");
  }
  console.log("");
}

if (!found) {
  console.error("None of these Pages has an Instagram business account linked.");
  console.error("Link @chifbay to the Page in Instagram: Settings -> Account type and tools.");
  process.exit(1);
}
