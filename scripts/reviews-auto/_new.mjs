import { chromium, devices } from "playwright";
const S="/private/tmp/claude-502/-Users-Shared-Claude/766a363c-8b63-4f00-8ae6-451feb0ce2c0/scratchpad";
const b = await chromium.launch();
const p = await b.newPage({viewport:{width:430,height:932},deviceScaleFactor:3,isMobile:true,hasTouch:true});
await p.goto("http://localhost:8798/",{waitUntil:"networkidle"});
await p.waitForTimeout(2500);
await p.evaluate(()=>{const c=document.getElementById("cb-consent"); if(c) c.querySelectorAll("button")[1].click();});
// une image au poster (t=0) et une en pleine action
await p.evaluate(()=>{const v=document.querySelector("video.hvid"); v.pause(); v.currentTime=0;});
await p.waitForTimeout(600); await p.screenshot({path:`${S}/new-t0.png`});
await p.evaluate(()=>{const v=document.querySelector("video.hvid"); v.currentTime=1.4;});
await p.waitForTimeout(600); await p.screenshot({path:`${S}/new-t1.png`});
await p.evaluate(()=>{const v=document.querySelector("video.hvid"); v.currentTime=3.6; v.play();});
await p.waitForTimeout(600); await p.screenshot({path:`${S}/new-t2.png`});
console.log("captures faites");
await b.close();
