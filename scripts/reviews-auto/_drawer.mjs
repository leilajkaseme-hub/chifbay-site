import { chromium, webkit, devices } from "playwright";
const S="/private/tmp/claude-502/-Users-Shared-Claude/766a363c-8b63-4f00-8ae6-451feb0ce2c0/scratchpad";
for (const [en,eng] of [["chromium",chromium],["webkit",webkit]]) {
  const b = await eng.launch();
  for (const [lab,opt,shot] of [
    ["mobile 390",{...devices['iPhone 13']},null],
    ["mobile 430",{viewport:{width:430,height:932},deviceScaleFactor:3,isMobile:true,hasTouch:true},"drawer"],
    ["desktop   ",{viewport:{width:1440,height:900}},null],
  ]) {
    const p = await b.newPage(opt);
    await p.goto("http://localhost:8798/",{waitUntil:"networkidle"});
    await p.waitForTimeout(2500);
    await p.evaluate(()=>{const c=document.getElementById("cb-consent"); if(c) c.querySelectorAll("button")[1].click();});
    await p.waitForTimeout(600);
    const base = await p.evaluate(()=>{
      const ls=document.querySelector(".langsel");
      const n=document.querySelectorAll(".langsel").length;
      const cs=getComputedStyle(ls);
      const r=ls.getBoundingClientRect();
      return {n, dansTiroir: !!ls.closest(".nl"), pos:cs.position,
        visibleHorsMenu: r.width>0 && r.height>0 && cs.position!=="fixed",
        chevaucheHero: (()=>{const h=document.querySelector(".hact");if(!h)return null;
          const a=h.getBoundingClientRect(); return r.right>a.left&&r.left<a.right&&r.bottom>a.top&&r.top<a.bottom;})()};
    });
    let drawer=null;
    if (lab.startsWith("mobile")) {
      await p.click(".navtoggle"); await p.waitForTimeout(700);
      drawer = await p.evaluate(()=>{
        const ls=document.querySelector(".langsel"), r=ls.getBoundingClientRect();
        const nl=document.querySelector(".nl").getBoundingClientRect();
        return {visible:r.width>0&&r.height>0, dedans:r.left>=nl.left-1&&r.right<=nl.right+1&&r.top>=nl.top-1&&r.bottom<=nl.bottom+1,
          x:Math.round(r.left), w:Math.round(r.width)};
      });
      await p.click(".langbtn"); await p.waitForTimeout(500);
      const menu = await p.evaluate(()=>{
        const m=document.querySelector(".langmenu"), r=m.getBoundingClientRect();
        const nl=document.querySelector(".nl").getBoundingClientRect();
        return {ouvert:getComputedStyle(m).display!=="none", n:m.querySelectorAll("a").length,
          dansTiroir:r.left>=nl.left-1&&r.right<=nl.right+1, dansEcran:r.top>=0&&r.bottom<=innerHeight};
      });
      if (shot) await p.screenshot({path:`${S}/${shot}-${en}.png`});
      console.log(`${en} ${lab} | copies=${base.n} dans le tiroir=${base.dansTiroir} position=${base.pos} chevauche le hero=${base.chevaucheHero} | tiroir ouvert: visible=${drawer.visible} dedans=${drawer.dedans} | menu: ${JSON.stringify(menu)}`);
    } else {
      console.log(`${en} ${lab} | copies=${base.n} dans le tiroir=${base.dansTiroir} position=${base.pos} (attendu: false / static ou relative)`);
    }
    await p.close();
  }
  await b.close();
}
