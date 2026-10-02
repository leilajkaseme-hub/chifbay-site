import { chromium, webkit, devices } from "playwright";
const S="/private/tmp/claude-502/-Users-Shared-Claude/766a363c-8b63-4f00-8ae6-451feb0ce2c0/scratchpad";
for (const [en,eng] of [["chromium",chromium],["webkit",webkit]]) {
  const b = await eng.launch();
  for (const [lab,opt,shot] of [
    ["mobile 390",{...devices['iPhone 13']},null],
    ["mobile 430",{viewport:{width:430,height:932},deviceScaleFactor:3,isMobile:true,hasTouch:true},"liveD"],
    ["desktop   ",{viewport:{width:1440,height:900}},null],
  ]) {
    const p = await b.newPage(opt);
    await p.goto("https://chifbay.com/",{waitUntil:"networkidle"});
    await p.waitForTimeout(3000);
    await p.evaluate(()=>{const c=document.getElementById("cb-consent"); if(c) c.querySelectorAll("button")[1].click();});
    await p.waitForTimeout(700);
    const base = await p.evaluate(()=>{
      const ls=document.querySelector(".langsel");
      const flot=[...document.querySelectorAll("body *")].filter(e=>{
        const c=getComputedStyle(e); if(c.position!=="fixed") return false;
        const r=e.getBoundingClientRect();
        return r.height>0&&r.width>0&&r.top>innerHeight*0.6&&r.left>innerWidth*0.5;}).map(e=>"."+String(e.className).split(" ")[0]);
      return {n:document.querySelectorAll(".langsel").length, tiroir:!!ls.closest(".nl"),
        flottants:[...new Set(flot)].join(",")||"aucun"};
    });
    let extra="";
    if (lab.startsWith("mobile")) {
      await p.click(".navtoggle"); await p.waitForTimeout(700);
      await p.click(".langbtn"); await p.waitForTimeout(900);
      const m = await p.evaluate(()=>{
        const nl=document.querySelector(".nl"), f=nl.children[0].getBoundingClientRect();
        const mm=document.querySelector(".langmenu").getBoundingClientRect();
        return {liste:document.querySelectorAll(".langmenu a").length,
          listeVisible: mm.top>=0&&mm.bottom<=innerHeight,
          hautAtteignable: f.top>=0 || nl.scrollTop>0};});
      extra = ` | liste ${m.liste} langues, visible=${m.listeVisible}, haut du menu atteignable=${m.hautAtteignable}`;
      if (shot) await p.screenshot({path:`${S}/${shot}.png`});
    }
    console.log(`${en} ${lab} | copies=${base.n} dans le tiroir=${base.tiroir} | flottants bas-droite: ${base.flottants}${extra}`);
    await p.close();
  }
  await b.close();
}
