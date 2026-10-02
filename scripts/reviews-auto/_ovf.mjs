import { chromium, devices } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({...devices['iPhone 13']});
await p.goto("http://localhost:8798/",{waitUntil:"networkidle"});
await p.waitForTimeout(2200);
await p.evaluate(()=>{const c=document.getElementById("cb-consent"); if(c) c.querySelectorAll("button")[1].click();});
await p.click(".navtoggle"); await p.waitForTimeout(600);
await p.click(".langbtn"); await p.waitForTimeout(500);
const r = await p.evaluate(()=>{
  const nl=document.querySelector(".nl");
  const first=nl.children[0].getBoundingClientRect();
  const m=document.querySelector(".langmenu").getBoundingClientRect();
  const before=nl.scrollTop;
  nl.scrollTop = 99999; const maxDown = nl.scrollTop; nl.scrollTop = -99999; const maxUp = nl.scrollTop;
  nl.scrollTop = before;
  return {fen:innerHeight, nlH:Math.round(nl.getBoundingClientRect().height),
    scrollH:nl.scrollHeight, clientH:nl.clientHeight,
    premierLienTop:Math.round(first.top), menu:`${Math.round(m.top)}..${Math.round(m.bottom)}`,
    peutDescendre:maxDown, peutMonter:maxUp,
    coupeEnHaut: first.top < 0, coupeEnBas: m.bottom > innerHeight};
});
console.log(JSON.stringify(r,null,1));
await b.close();
