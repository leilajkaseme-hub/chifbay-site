import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({viewport:{width:1280,height:900}});
const seen=[];
p.on("response", async r=>{ if(r.url().includes("/v1/")) { let t=""; try{t=(await r.text()).slice(0,1500);}catch{} seen.push({u:r.url(), s:r.status(), t}); }});
await p.goto("https://chifbay.com/book-sunset.html",{waitUntil:"networkidle"});
await p.waitForTimeout(4000);
for (const s of seen) { console.log("\n"+s.u+"  ->  "+s.s); console.log(s.t); }
if(!seen.length) console.log("aucun appel /v1/ observe");
await b.close();
