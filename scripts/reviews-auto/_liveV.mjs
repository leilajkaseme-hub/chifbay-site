import { chromium, webkit, devices } from "playwright";
const S="/private/tmp/claude-502/-Users-Shared-Claude/766a363c-8b63-4f00-8ae6-451feb0ce2c0/scratchpad";
for (const [en,eng] of [["chromium",chromium],["webkit",webkit]]) {
  const b = await eng.launch();
  for (const [lab,opt,shot] of [
    ["mobile 390",{...devices['iPhone 13']},null],
    ["mobile 430",{viewport:{width:430,height:932},deviceScaleFactor:3,isMobile:true,hasTouch:true},"liveV"],
    ["desktop   ",{viewport:{width:1440,height:900}},null],
  ]) {
    const p = await b.newPage(opt);
    const t0=Date.now();
    await p.goto("https://chifbay.com/",{waitUntil:"domcontentloaded"});
    let first=null;
    try{ await p.waitForFunction(()=>{const v=document.querySelector("video.hvid");return v&&!v.paused&&v.currentTime>0;},{timeout:20000}); first=Date.now()-t0; }catch{}
    const r = await p.evaluate(async ()=>{
      const v=document.querySelector("video.hvid");
      v.currentTime=Math.max(0,v.duration-0.25);
      const t=Date.now(); let looped=false;
      while(Date.now()-t<6000){ await new Promise(r=>setTimeout(r,100)); if(v.currentTime<1&&!v.paused){looped=true;break;} }
      return {src:(v.currentSrc||"").split("/").pop(), dur:+v.duration.toFixed(2), w:v.videoWidth, h:v.videoHeight,
        muted:v.muted, ctrl:v.controls, looped};
    });
    console.log(`${en} ${lab} | ${r.src} ${r.w}x${r.h} ${r.dur}s | 1re image ${first??"JAMAIS"}ms | boucle reelle=${r.looped} muet=${r.muted} controles=${r.ctrl}`);
    if (shot && en==="chromium") { await p.evaluate(()=>{const c=document.getElementById("cb-consent"); if(c) c.querySelectorAll("button")[1].click();});
      await p.evaluate(()=>{const v=document.querySelector("video.hvid"); v.currentTime=3.6;});
      await p.waitForTimeout(900); await p.screenshot({path:`${S}/${shot}.png`}); }
    await p.close();
  }
  await b.close();
}
