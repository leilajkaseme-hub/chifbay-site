import { chromium, devices } from "playwright";
const S="/private/tmp/claude-502/-Users-Shared-Claude/766a363c-8b63-4f00-8ae6-451feb0ce2c0/scratchpad";
const b = await chromium.launch();
for (const [n,vp] of [["drw-390",{width:390,height:664}],["drw-430",{width:430,height:932}]]) {
  const p = await b.newPage({viewport:vp,deviceScaleFactor:3,isMobile:true,hasTouch:true});
  await p.goto("http://localhost:8798/",{waitUntil:"networkidle"});
  await p.waitForTimeout(2200);
  await p.evaluate(()=>{const c=document.getElementById("cb-consent"); if(c) c.querySelectorAll("button")[1].click();});
  await p.click(".navtoggle"); await p.waitForTimeout(700);
  await p.screenshot({path:`${S}/${n}-ferme.png`});
  await p.click(".langbtn"); await p.waitForTimeout(900);
  const v = await p.evaluate(()=>{const m=document.querySelector(".langmenu").getBoundingClientRect();
    const nl=document.querySelector(".nl"); const f=nl.children[0].getBoundingClientRect();
    return {menuVisible: m.top>=0 && m.bottom<=innerHeight, premierLien:Math.round(f.top), atteignable:f.top>=0||nl.scrollTop>0};});
  console.log(`${n}: liste entierement visible=${v.menuVisible}, premier lien a ${v.premierLien}px, atteignable=${v.atteignable}`);
  await p.screenshot({path:`${S}/${n}-ouvert.png`});
  await p.close();
}
await b.close();
