import { chromium } from "playwright";
// --autoplay-policy=user-gesture-required reproduit ce que fait iOS en mode
// economie d'energie: play() est rejete tant qu'aucun geste n'a eu lieu.
const b = await chromium.launch({ args: ["--autoplay-policy=user-gesture-required"] });
const p = await b.newPage({ viewport:{width:390,height:844}, hasTouch:true });
await p.goto("http://localhost:8791/", {waitUntil:"load"});
await p.waitForTimeout(2500);
const before = await p.evaluate(()=>{const v=document.querySelector("video.hvid");
  return {paused:v.paused, t:+v.currentTime.toFixed(2), poster:v.poster||"(aucun)"};});
console.log("  avant tout geste :", JSON.stringify(before));

await p.mouse.wheel(0, 120);            // un simple defilement
await p.waitForTimeout(1800);
const afterScroll = await p.evaluate(()=>{const v=document.querySelector("video.hvid");
  return {paused:v.paused, t:+v.currentTime.toFixed(2)};});
console.log("  apres un defilement :", JSON.stringify(afterScroll));

await p.touchscreen.tap(200, 400);
await p.waitForTimeout(1800);
const afterTap = await p.evaluate(()=>{const v=document.querySelector("video.hvid");
  return {paused:v.paused, t:+v.currentTime.toFixed(2)};});
console.log("  apres une tape :", JSON.stringify(afterTap));

const verdict = !afterScroll.paused || !afterTap.paused;
console.log(verdict ? "\n  OK: la lecture demarre au premier geste" : "\n  ECHEC: la video reste figee");
await b.close();
