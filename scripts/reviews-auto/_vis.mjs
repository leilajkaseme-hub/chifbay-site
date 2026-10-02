import { chromium } from "playwright";
const S="/private/tmp/claude-502/-Users-Shared-Claude/766a363c-8b63-4f00-8ae6-451feb0ce2c0/scratchpad";
const pages = [
  ["accueil","/"],
  ["article","/posts/top-10-beaches-in-madeira.html"],
  ["sortie","/hidden-coves-half-day.html"],
  ["avis","/reviews.html"],
  ["article-repare","/posts/funchal-city-day-2026.html"],
  ["fr-accueil","/fr/index.html"],
];
const b = await chromium.launch();
for (const [nom,url] of pages) {
  for (const [tag, base] of [["avant","https://chifbay.com"],["apres","http://localhost:8798"]]) {
    const p = await b.newPage({viewport:{width:1280,height:1000},deviceScaleFactor:1});
    const bad=[];
    p.on("response", r=>{ if(r.status()>=400 && !r.url().includes("workers.dev")) bad.push(r.status()+" "+r.url().split("/").slice(3).join("/")); });
    await p.goto(base+url,{waitUntil:"networkidle"}).catch(()=>{});
    await p.waitForTimeout(2500);
    await p.screenshot({path:`${S}/vis-${nom}-${tag}.png`});
    if (bad.length) console.log(`  ${nom} ${tag}: ERREURS ${bad.slice(0,3).join(" | ")}`);
    await p.close();
  }
}
await b.close(); console.log("captures faites");
