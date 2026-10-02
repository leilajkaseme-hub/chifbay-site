import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:390,height:844}, hasTouch:true });

// Reproduit fidelement iOS en mode economie d'energie : play() est rejete
// tant qu'aucun geste utilisateur n'a eu lieu, exactement comme Safari.
await p.addInitScript(() => {
  const real = HTMLMediaElement.prototype.play;
  window.__gesture = false;
  ['touchstart','pointerdown','keydown','scroll','click'].forEach(e =>
    addEventListener(e, () => { window.__gesture = true; }, {passive:true, capture:true}));
  let rejets = 0;
  Object.defineProperty(window, '__rejets', { get: () => rejets });
  HTMLMediaElement.prototype.play = function () {
    if (!window.__gesture) { rejets++; return Promise.reject(new DOMException('NotAllowedError')); }
    return real.apply(this, arguments);
  };
});

await p.goto("http://localhost:8791/", {waitUntil:"load"});
await p.waitForTimeout(2500);
const st = () => p.evaluate(()=>{const v=document.querySelector("video.hvid");
  return {paused:v.paused, t:+v.currentTime.toFixed(2), rejets:window.__rejets};});
console.log("  lecture refusee, avant tout geste :", JSON.stringify(await st()));

await p.evaluate(()=>window.dispatchEvent(new Event('scroll')));
await p.waitForTimeout(2000);
const after = await st();
console.log("  apres un defilement                :", JSON.stringify(after));

console.log(after.paused
  ? "\n  ECHEC : la video reste figee malgre le geste"
  : "\n  OK : refusee au depart, elle repart au premier geste");
await b.close();
