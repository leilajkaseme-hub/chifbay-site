import { chromium } from "playwright";
const b = await chromium.launch();
for (const [lab,js] of [["avec JS",true],["sans JS",false]]) {
  const ctx = await b.newContext({javaScriptEnabled:js, viewport:{width:1280,height:900}});
  const p = await ctx.newPage();
  await p.goto("http://localhost:8798/",{waitUntil:js?"networkidle":"domcontentloaded"});
  await p.waitForTimeout(js?3000:800);
  const t = await p.evaluate(()=>document.body.innerText.replace(/\s+/g," "));
  const m = t.match(/[^.]{0,60}\b(56|5\.0|5,0)\b[^.]{0,60}/g);
  console.log(`  ${lab}: ${m ? m.slice(0,3).join("  ||  ") : "le chiffre n'apparait pas"}`);
  await ctx.close();
}
await b.close();
