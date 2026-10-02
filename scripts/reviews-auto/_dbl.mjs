import { chromium, devices } from "playwright";
const b = await chromium.launch();
for (const [lab,opt] of [["mobile",{...devices['iPhone 13']}],["desktop",{viewport:{width:1440,height:900}}]]) {
  const p = await b.newPage(opt);
  const got=[];
  p.on("response", r=>{ const u=r.url(); if(/hero|poster/.test(u)) got.push((r.headers()["content-length"]||"?")+"  "+u.split("/").pop()); });
  await p.goto("http://localhost:8798/",{waitUntil:"networkidle"});
  await p.waitForTimeout(3500);
  console.log(`  ${lab}:`); got.forEach(g=>console.log("     "+g));
  await p.close();
}
await b.close();
