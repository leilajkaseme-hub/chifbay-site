import { chromium } from "playwright";
const b = await chromium.launch();
for (const w of [360, 390, 402, 430]) {
  const p = await b.newPage({viewport:{width:w,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await p.goto("http://localhost:8798/",{waitUntil:"networkidle"});
  await p.waitForTimeout(2500);
  await p.evaluate(()=>{const c=document.getElementById("cb-consent"); if(c) c.querySelectorAll("button")[1].click();});
  await p.waitForTimeout(500);
  const r = await p.evaluate(() => [...document.querySelectorAll(".hact .btn")].map(e=>{
    const rg=document.createRange(); rg.selectNodeContents(e);
    const t=rg.getBoundingClientRect(), pr=e.getBoundingClientRect();
    const ls=document.querySelector(".langsel").getBoundingClientRect();
    return {lab:e.textContent.trim().slice(0,20), pill:Math.round(pr.width), txt:Math.round(t.width),
      deborde: t.width > pr.width - 8, colle: pr.right > ls.left - 4};
  }));
  console.log(`${w}px : ` + r.map(x=>`${x.lab} pilule ${x.pill} texte ${x.txt}${x.deborde?" DEBORDE":""}${x.colle?" TOUCHE LA PASTILLE":""}`).join("  |  "));
  await p.close();
}
await b.close();
