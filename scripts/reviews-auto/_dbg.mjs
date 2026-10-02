import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
await p.goto("http://localhost:8798/",{waitUntil:"networkidle"});
await p.waitForTimeout(2500);
const r = await p.evaluate(()=>{
  const ls=document.querySelector(".langsel"), wa=document.querySelector(".wa");
  const c=getComputedStyle(ls);
  return {htmlClass:document.documentElement.className,
    right:c.right, left:c.left, pos:c.position, w:Math.round(ls.getBoundingClientRect().width),
    lsLeft:Math.round(ls.getBoundingClientRect().left),
    waRight:getComputedStyle(wa).right, waLeft:Math.round(wa.getBoundingClientRect().left),
    match:matchMedia("(max-width:400px)").matches};
});
console.log(r);
await b.close();
