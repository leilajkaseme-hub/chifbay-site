import { chromium, webkit, devices } from "playwright";
const S="/private/tmp/claude-502/-Users-Shared-Claude/766a363c-8b63-4f00-8ae6-451feb0ce2c0/scratchpad";
for (const [en,eng] of [["chromium",chromium],["webkit",webkit]]) {
  const b = await eng.launch();
  for (const [lab,opt,shot] of [
    ["mobile 390x664",{...devices['iPhone 13']},"live-bar"],
    ["tall   430x932",{viewport:{width:430,height:932},deviceScaleFactor:3,isMobile:true,hasTouch:true},null],
    ["desktop  1440  ",{viewport:{width:1440,height:900}},null],
  ]) {
    const p = await b.newPage(opt);
    await p.goto("https://chifbay.com/",{waitUntil:"networkidle"});
    await p.waitForTimeout(5000);
    const probe = () => p.evaluate(() => {
      const tm=document.querySelector(".tour-meta").getBoundingClientRect();
      const bar=document.getElementById("cb-consent");
      const br=bar?bar.getBoundingClientRect():null;
      const btn=document.querySelector(".hact .btn");
      const rg=document.createRange(); rg.selectNodeContents(btn);
      const tr=rg.getBoundingClientRect(), pr=btn.getBoundingClientRect();
      const v=document.querySelector("video.hvid");
      return {cls:document.documentElement.classList.contains("has-consent-bar"),
        h:getComputedStyle(document.documentElement).getPropertyValue("--consent-h").trim()||"-",
        chev: br?Math.round(Math.min(tm.bottom,br.bottom)-Math.max(tm.top,br.top)):null,
        haut: Math.round(document.querySelector(".hbadge").getBoundingClientRect().top),
        margeG:Math.round(tr.left-pr.left), margeD:Math.round(pr.right-tr.right),
        just:getComputedStyle(btn).justifyContent,
        play: v?(!v.paused&&v.currentTime>0):null};
    });
    const a = await probe();
    if (shot) await p.screenshot({path:`${S}/${shot}-${en}.png`});
    await p.click("#cb-consent button:last-child"); await p.waitForTimeout(900);
    const z = await probe();
    console.log(`${en} ${lab} | video=${a.play} | bandeau: classe=${a.cls} h=${a.h} chevauchement=${a.chev}px | bouton ${a.just} margeG=${a.margeG} margeD=${a.margeD} | haut libre ${a.haut}->${z.haut}px | apres: classe=${z.cls}`);
    await p.close();
  }
  await b.close();
}
