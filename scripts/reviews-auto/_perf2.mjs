import { chromium, devices } from "playwright";
const b = await chromium.launch();
async function mesure(base, lab, opt){
  const p = await b.newPage(opt);
  let bytes=0,n=0; const par={};
  p.on("response", async r=>{ try{ const t=r.request().resourceType();
    const h=r.headers()["content-length"]; const s=h?parseInt(h):0;
    if(!isNaN(s)){bytes+=s;n++;par[t]=(par[t]||0)+s;} }catch{} });
  await p.goto(base,{waitUntil:"load"});
  await p.waitForTimeout(3000);
  const m = await p.evaluate(()=>{const t=performance.getEntriesByType("navigation")[0]||{};
    return {ttfb:Math.round(t.responseStart||0), load:Math.round(t.loadEventEnd||0)};});
  console.log(`  ${lab.padEnd(22)} ${n} req  ${(bytes/1048576).toFixed(2)} Mo   TTFB ${m.ttfb}ms  charge ${m.load}ms`);
  console.log(`      ${Object.entries(par).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,v])=>`${k} ${(v/1024).toFixed(0)}ko`).join("  ")}`);
  await p.close();
}
await mesure("https://chifbay.com/", "AVANT desktop", {viewport:{width:1440,height:900}});
await mesure("http://localhost:8798/", "APRES desktop", {viewport:{width:1440,height:900}});
await mesure("https://chifbay.com/", "AVANT mobile", {...devices['iPhone 13']});
await mesure("http://localhost:8798/", "APRES mobile", {...devices['iPhone 13']});
await mesure("https://chifbay.com/posts/top-10-beaches-in-madeira.html", "AVANT article", {viewport:{width:1440,height:900}});
await mesure("http://localhost:8798/posts/top-10-beaches-in-madeira.html", "APRES article", {viewport:{width:1440,height:900}});
await b.close();
