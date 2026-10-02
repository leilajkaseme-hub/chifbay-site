import { chromium, devices } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({...devices['iPhone 13']});
await p.goto("http://localhost:8798/", {waitUntil:"networkidle"});
await p.waitForTimeout(3000);
console.log(JSON.stringify(await p.evaluate(()=>{
  const h1=document.querySelector('.hero h1'), sub=document.querySelector('.hsub');
  const btns=[...document.querySelectorAll('.hact .btn')];
  const rules=(el)=>{const o=[];for(const sh of document.styleSheets){let rs;try{rs=sh.cssRules}catch{continue}
    for(const r of rs){if(!r.selectorText||!r.style||!r.style.textShadow)continue;
      try{if(el.matches(r.selectorText))o.push(r.selectorText+" ["+(sh.href||'inline').split('/').pop()+"]")}catch{}}}return o};
  return {
    h1Shadow:getComputedStyle(h1).textShadow,
    h1Rules:rules(h1),
    subShadow:getComputedStyle(sub).textShadow,
    subRules:rules(sub),
    boutons: btns.map(x=>({t:x.innerText.trim().slice(0,20), w:Math.round(x.getBoundingClientRect().width),
      scrollW:x.scrollWidth, deborde:x.scrollWidth>Math.ceil(x.getBoundingClientRect().width)})),
    metaH: Math.round(document.querySelector('.tour-meta').getBoundingClientRect().height),
  };
}),null,1));
await b.close();
