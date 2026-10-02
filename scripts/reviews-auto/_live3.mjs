import { chromium, webkit, devices } from "playwright";
const S="/private/tmp/claude-502/-Users-Shared-Claude/766a363c-8b63-4f00-8ae6-451feb0ce2c0/scratchpad";
for (const [en,eng] of [["chromium",chromium],["webkit",webkit]]) {
  const b = await eng.launch();
  for (const [lab,opt,shot] of [
    ["mobile 390",{...devices['iPhone 13']},null],
    ["mobile 430",{viewport:{width:430,height:932},deviceScaleFactor:3,isMobile:true,hasTouch:true},"live3"],
    ["desktop   ",{viewport:{width:1440,height:900}},null],
  ]) {
    const p = await b.newPage(opt);
    const t0=Date.now();
    await p.goto("https://chifbay.com/",{waitUntil:"domcontentloaded"});
    let first=null;
    try{ await p.waitForFunction(()=>{const v=document.querySelector("video.hvid");return v&&!v.paused&&v.currentTime>0;},{timeout:20000}); first=Date.now()-t0; }catch{}
    await p.evaluate(()=>{const c=document.getElementById("cb-consent"); if(c) c.querySelectorAll("button")[1].click();});
    await p.waitForTimeout(900);
    const r = await p.evaluate(()=>{
      const v=document.querySelector("video.hvid"), tm=document.querySelector(".tour-meta");
      const ls=document.querySelector(".langsel").getBoundingClientRect();
      const wa=document.querySelector(".wa").getBoundingClientRect();
      const btn=[...document.querySelectorAll(".hact .btn")].map(e=>e.getBoundingClientRect());
      const vis=[...document.querySelectorAll(".tour-meta .tm")].filter(e=>getComputedStyle(e).display!=="none");
      const rows=new Set(vis.map(e=>Math.round(e.getBoundingClientRect().top)));
      const guests=[...document.querySelectorAll(".tour-meta .v")].map(e=>e.textContent.trim()).find(t=>/^(Up to|Jusqu|Bis|Hasta|Fino|Até)/.test(t));
      return {src:(v.currentSrc||"").split("/").pop(), dur:+v.duration.toFixed(2), loop:v.loop,
        lignes:rows.size, guests,
        collision: btn.some(r2=>r2.right>ls.left && r2.bottom>ls.top && r2.top<ls.bottom),
        langAuDessus: ls.bottom<=wa.top+1 && Math.abs(ls.left-wa.left)<8,
        bas: Math.round(document.querySelector(".hero").getBoundingClientRect().bottom - tm.getBoundingClientRect().bottom)};
    });
    console.log(`${en} ${lab} | ${r.src} ${r.dur}s loop=${r.loop} 1re image ${first??"JAMAIS"}ms | chiffres ${r.lignes} ligne(s) "${r.guests}" | bas ${r.bas}px | collision boutons/pastille: ${r.collision} | langue au-dessus: ${r.langAuDessus}`);
    if (shot) await p.screenshot({path:`${S}/${shot}-${en}.png`});
    await p.close();
  }
  await b.close();
}
