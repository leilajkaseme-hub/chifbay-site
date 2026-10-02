import { chromium, webkit, devices } from "playwright";
const S="/private/tmp/claude-502/-Users-Shared-Claude/766a363c-8b63-4f00-8ae6-451feb0ce2c0/scratchpad";
for (const [en,eng] of [["chromium",chromium],["webkit",webkit]]) {
  const b = await eng.launch();
  for (const [lab,opt,shot] of [
    ["mobile 390",{...devices['iPhone 13']},null],
    ["mobile 430",{viewport:{width:430,height:932},deviceScaleFactor:3,isMobile:true,hasTouch:true},"fin-hero"],
    ["desktop   ",{viewport:{width:1440,height:900}},"fin-desk"],
  ]) {
    const p = await b.newPage(opt);
    await p.goto("http://localhost:8798/",{waitUntil:"networkidle"});
    await p.waitForTimeout(3000);
    await p.evaluate(()=>{const c=document.getElementById("cb-consent"); if(c) c.querySelectorAll("button")[1].click();});
    await p.waitForTimeout(700);
    const r = await p.evaluate(()=>{
      const flot=[...document.querySelectorAll("body *")].filter(e=>{
        const c=getComputedStyle(e); if(c.position!=="fixed") return false;
        const r=e.getBoundingClientRect();
        return r.height>0 && r.width>0 && r.top>innerHeight*0.6 && r.left>innerWidth*0.5;
      }).map(e=>e.tagName+"."+String(e.className).split(" ")[0]);
      const ls=document.querySelector(".langsel");
      const btn=[...document.querySelectorAll(".hact .btn")].map(e=>{
        const rg=document.createRange(); rg.selectNodeContents(e);
        return {p:Math.round(e.getBoundingClientRect().width), t:Math.round(rg.getBoundingClientRect().width)};});
      return {flottantsBasDroite:[...new Set(flot)], langDansNav:!!ls.closest("#nav"),
        langDansTiroir:!!ls.closest(".nl"), boutons:btn};
    });
    console.log(`${en} ${lab} | flottants en bas a droite: ${r.flottantsBasDroite.join(", ")||"aucun"} | langue dans #nav=${r.langDansNav} dans le tiroir=${r.langDansTiroir} | boutons ${r.boutons.map(x=>x.p+"/"+x.t).join(" ")}`);
    if (shot) await p.screenshot({path:`${S}/${shot}-${en}.png`});
    await p.close();
  }
  await b.close();
}
