import { chromium, devices } from "playwright";
const S="/private/tmp/claude-502/-Users-Shared-Claude/766a363c-8b63-4f00-8ae6-451feb0ce2c0/scratchpad";
const b = await chromium.launch();
const p = await b.newPage({viewport:{width:430,height:932},deviceScaleFactor:3,isMobile:true,hasTouch:true});
await p.goto("http://localhost:8798/",{waitUntil:"networkidle"});
await p.waitForTimeout(3000);
await p.evaluate(()=>{const c=document.getElementById("cb-consent"); if(c) c.querySelectorAll("button")[1].click();});
await p.waitForTimeout(1200);
await p.screenshot({path:`${S}/final-mobile.png`});
// et le menu de langue ouvert, pour verifier qu'il tient a l'ecran
await p.click(".langbtn"); await p.waitForTimeout(500);
const m = await p.evaluate(()=>{const e=document.querySelector(".langmenu");const r=e.getBoundingClientRect();
  return {left:Math.round(r.left),right:Math.round(r.right),top:Math.round(r.top),bottom:Math.round(r.bottom),
          dansEcran:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight};});
console.log("menu langue:", JSON.stringify(m));
await p.screenshot({path:`${S}/final-menu.png`});
await b.close();
