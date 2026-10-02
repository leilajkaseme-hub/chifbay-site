import { chromium, webkit, devices } from "playwright";
const S="/private/tmp/claude-502/-Users-Shared-Claude/766a363c-8b63-4f00-8ae6-451feb0ce2c0/scratchpad";
const b = await chromium.launch();
for (const [lab,vp,shot] of [["390x664",{width:390,height:664},"v3-a"],["430x932",{width:430,height:932},"v3-b"]]) {
  const p = await b.newPage({viewport:vp,deviceScaleFactor:3,isMobile:true,hasTouch:true});
  await p.goto("http://localhost:8798/",{waitUntil:"networkidle"});
  await p.waitForTimeout(3500);
  await p.evaluate(()=>{const c=document.getElementById("cb-consent"); if(c) c.querySelectorAll("button")[1].click();});
  await p.waitForTimeout(700);
  const r = await p.evaluate(() => {
    const g=s=>{const e=document.querySelector(s);return e?e.getBoundingClientRect():null;};
    const hero=g(".hero"), tm=g(".tour-meta"), wa=g(".wa"), ls=g(".langsel");
    const rows=new Set([...document.querySelectorAll(".tour-meta .tm")]
      .filter(e=>getComputedStyle(e).display!=="none").map(e=>Math.round(e.getBoundingClientRect().top)));
    const vis=[...document.querySelectorAll(".tour-meta .tm")]
      .filter(e=>getComputedStyle(e).display!=="none").map(e=>e.querySelector(".k").textContent);
    return {heroH:Math.round(hero.height), win:window.innerHeight,
      tmH:Math.round(tm.height), lignes:rows.size, visibles:vis,
      gapBas:Math.round(hero.bottom-tm.bottom),
      wa:wa?`${Math.round(wa.left)},${Math.round(wa.top)} ${Math.round(wa.width)}px`:"absent",
      lang:ls?`${Math.round(ls.left)},${Math.round(ls.top)}`:"absent",
      langAuDessus: (ls&&wa)? (ls.bottom<=wa.top+1 && Math.abs(ls.left-wa.left)<10) : null};
  });
  console.log(`\n${lab}  hero ${r.heroH}px / fenetre ${r.win}px`);
  console.log(`  chiffres: ${r.lignes} ligne(s), ${r.tmH}px, visibles = ${r.visibles.join(" / ")}`);
  console.log(`  espace sous les chiffres : ${r.gapBas}px`);
  console.log(`  WhatsApp ${r.wa} | langue ${r.lang} | langue au-dessus et alignee : ${r.langAuDessus}`);
  await p.screenshot({path:`${S}/${shot}.png`});
  await p.close();
}
await b.close();
