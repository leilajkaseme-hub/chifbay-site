import { chromium, webkit, devices } from "playwright";
const S="/private/tmp/claude-502/-Users-Shared-Claude/766a363c-8b63-4f00-8ae6-451feb0ce2c0/scratchpad";
for (const [en, eng] of [["chromium",chromium],["webkit",webkit]]) {
  const b = await eng.launch();
  for (const [lab,opt,url] of [
    ["mobile ", {...devices['iPhone 13']}, "https://chifbay.com/"],
    ["tall   ", {viewport:{width:430,height:932},deviceScaleFactor:3,isMobile:true,hasTouch:true}, "https://chifbay.com/"],
    ["desktop", {viewport:{width:1440,height:900}}, "https://chifbay.com/"],
    ["article", {...devices['iPhone 13']}, "https://chifbay.com/posts/top-10-beaches-in-madeira.html"],
  ]) {
    const p = await b.newPage(opt);
    await p.goto(url,{waitUntil:"networkidle"}); await p.waitForTimeout(5000);
    const r = await p.evaluate(() => {
      const v = document.querySelector("video.hvid"), hov = document.querySelector(".hov");
      const h1 = document.querySelector(".hero h1"), hact = document.querySelector(".hact");
      return {
        play: v ? (!v.paused && v.currentTime>0) : null,
        src: v ? (v.currentSrc||"").split("/").pop() : "-",
        ctrl: v ? v.controls : null, mute: v ? v.muted : null,
        top: hov ? getComputedStyle(hov).backgroundImage.match(/rgba?\([^)]*\)/)[0] : "-",
        sh: h1 ? getComputedStyle(h1).textShadow.slice(0,34) : "-",
        dir: hact ? getComputedStyle(hact).flexDirection : "-",
      };
    });
    console.log(`${en} ${lab}  video=${r.play} ${r.src} muet=${r.mute} controles=${r.ctrl} | haut du voile ${r.top} | h1 ${r.sh} | boutons ${r.dir}`);
    if (en==="chromium" && lab==="mobile ") await p.screenshot({path:`${S}/live-mobile.png`});
    await p.close();
  }
  await b.close();
}
