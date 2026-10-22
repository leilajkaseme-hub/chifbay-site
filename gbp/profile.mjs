#!/usr/bin/env node
// profile.mjs: read the main profile and say what is missing or wrong; --apply writes the fixes from profile.json.
//
//   node gbp/profile.mjs            print the profile as Google holds it, and the gaps
//   node gbp/profile.mjs --apply    write the fields set in gbp/profile.json (description, website, phone, hours...)
//
// Only the fields listed in profile.json are touched, with an explicit updateMask: nothing else on the profile changes.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, api, record, where } from "./lib.mjs";

const BI = "https://mybusinessbusinessinformation.googleapis.com/v1";
const READ = "name,title,storeCode,categories,profile,websiteUri,phoneNumbers,regularHours,specialHours,serviceArea,openInfo,metadata,serviceItems,labels,storefrontAddress";

async function main() {
  const at = await where();
  const loc = await api("GET", `${BI}/${at.location}?readMask=${READ}`);
  const gaps = [];
  const desc = loc.profile?.description ?? "";
  if (desc.length < 500) gaps.push(`description is ${desc.length} characters (up to 750 allowed)`);
  if (!/chifbay\.com/.test(loc.websiteUri ?? "")) gaps.push(`website is "${loc.websiteUri ?? "none"}"`);
  if (!loc.regularHours?.periods?.length) gaps.push("no opening hours");
  if (!(loc.categories?.additionalCategories ?? []).length) gaps.push("no secondary categories");
  if (!(loc.serviceItems ?? []).length) gaps.push("no services listed");
  console.log(JSON.stringify({ ...loc, metadata: { mapsUri: loc.metadata?.mapsUri, newReviewUri: loc.metadata?.newReviewUri } }, null, 1));
  console.log(gaps.length ? `\nGAPS:\n- ${gaps.join("\n- ")}` : "\nno obvious gap");
  if (!process.argv.includes("--apply")) return;
  const f = join(ROOT, "profile.json");
  if (!existsSync(f)) throw new Error("gbp/profile.json is missing");
  const want = JSON.parse(readFileSync(f, "utf8"));
  const mask = Object.keys(want).filter((k) => !k.startsWith("_"));
  const body = Object.fromEntries(mask.map((k) => [k, want[k]]));
  const out = await api("PATCH", `${BI}/${at.location}?updateMask=${mask.join(",")}`, body);
  record({ kind: "profile", ok: true, fields: mask });
  console.log(`\nupdated: ${mask.join(", ")} (${out.title})`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
