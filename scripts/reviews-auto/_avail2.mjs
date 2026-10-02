import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({viewport:{width:1280,height:1000}});
const seen=[];
p.on("response", async r=>{ if(r.url().includes("/v1/availability")) { let t=""; try{t=await r.text();}catch{} seen.push({u:r.url(), s:r.status(), t}); }});
await p.goto("https://chifbay.com/book-sunset.html?v=cabo-girao",{waitUntil:"networkidle"});
await p.waitForTimeout(5000);
if(!seen.length){
  // pousser la selection si besoin
  const btns = await p.$$("#bkbox button, #bkbox .opt, #bkbox a");
  console.log("boutons trouves:", btns.length);
  for (const el of btns.slice(0,6)) { try{ await el.click({timeout:1500}); await p.waitForTimeout(1500); }catch{} if(seen.length) break; }
}
for (const s of seen) { console.log("\n"+decodeURIComponent(s.u)+"  ->  "+s.s); console.log(s.t.slice(0,2200)); }
if(!seen.length) console.log("toujours aucun appel /v1/availability");
await b.close();
