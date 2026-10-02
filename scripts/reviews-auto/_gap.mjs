import { chromium, devices } from "playwright";
const b = await chromium.launch();
for (const [lab,vp] of [["390x664",{width:390,height:664}],["402x874",{width:402,height:874}],["430x932",{width:430,height:932}]]) {
  const p = await b.newPage({viewport:vp,deviceScaleFactor:3,isMobile:true,hasTouch:true});
  await p.goto("http://localhost:8798/",{waitUntil:"networkidle"});
  await p.waitForTimeout(3500);
  await p.evaluate(()=>{const c=document.getElementById("cb-consent"); if(c) c.querySelectorAll("button")[1].click();});
  await p.waitForTimeout(700);
  const r = await p.evaluate(() => {
    const g=s=>{const e=document.querySelector(s);return e?e.getBoundingClientRect():null;};
    const hero=g(".hero"), hc=g(".hc"), tm=g(".tour-meta"), cue=g(".hcue");
    const cs=getComputedStyle(document.querySelector(".hc"));
    const kids=[...document.querySelector(".hc").children].map(e=>`${e.className||e.tagName} ${Math.round(e.getBoundingClientRect().height)}px`);
    const tms=[...document.querySelectorAll(".tour-meta .tm")].map(e=>{const r2=e.getBoundingClientRect();return `${e.querySelector(".k").textContent}@${Math.round(r2.left)}..${Math.round(r2.right)} y${Math.round(r2.top)}`;});
    return {heroH:Math.round(hero.height), vh:window.innerHeight,
      hcH:Math.round(hc.height), pb:cs.paddingBottom, pt:cs.paddingTop,
      tmBottom:Math.round(tm.bottom), gapBas:Math.round(hero.bottom-tm.bottom),
      cue: cue?`${Math.round(cue.height)}px @${Math.round(cue.top)}`:"absent",
      kids, tms};
  });
  console.log(`\n${lab}  hero ${r.heroH}px, fenetre ${r.vh}px`);
  console.log(`  .hc hauteur ${r.hcH}px  padding haut ${r.pt} bas ${r.pb}`);
  console.log(`  bas de la ligne chiffres a ${r.tmBottom}px, il reste ${r.gapBas}px sous elle`);
  console.log(`  .hcue (SCROLL): ${r.cue}`);
  console.log(`  enfants de .hc: ${r.kids.join(" | ")}`);
  console.log(`  chiffres: ${r.tms.join("  ")}`);
  await p.close();
}
await b.close();
