import { chromium, devices } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({...devices['iPhone 13']});
await p.goto("http://localhost:8798/",{waitUntil:"networkidle"});
await p.waitForTimeout(2000);
await p.evaluate(()=>{const c=document.getElementById("cb-consent"); if(c) c.querySelectorAll("button")[1].click();});
await p.click(".navtoggle"); await p.waitForTimeout(800);
const r = await p.evaluate(()=>{
  const nl=document.querySelector(".nl");
  const kids=[...nl.children].map(e=>{const r=e.getBoundingClientRect();
    return `${e.tagName}.${(e.className||"").toString().slice(0,18)} ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`;});
  const btn=document.querySelector(".langbtn"), br=btn.getBoundingClientRect();
  const cx=br.left+br.width/2, cy=br.top+br.height/2;
  const at=document.elementFromPoint(cx,cy);
  const nlr=nl.getBoundingClientRect();
  return {kids, btn:`${Math.round(br.left)},${Math.round(br.top)} ${Math.round(br.width)}x${Math.round(br.height)}`,
    point:`${Math.round(cx)},${Math.round(cy)}`,
    sousLePoint: at ? at.tagName+"."+(at.className||"").toString().slice(0,26) : "rien",
    nl:`${Math.round(nlr.left)},${Math.round(nlr.top)} ${Math.round(nlr.width)}x${Math.round(nlr.height)}`,
    nlScroll:`scrollTop=${nl.scrollTop} scrollH=${nl.scrollHeight} clientH=${nl.clientHeight}`,
    fen:`${innerWidth}x${innerHeight}`};
});
console.log(JSON.stringify(r,null,1));
await b.close();
