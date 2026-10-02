import { chromium, devices } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({...devices['iPhone 13']});
const errs=[]; p.on("console",m=>{if(m.type()==="error")errs.push(m.text());});
p.on("pageerror",e=>errs.push("PAGEERROR: "+e.message));
await p.goto("http://localhost:8798/",{waitUntil:"networkidle"});
await p.waitForTimeout(2500);
const r = await p.evaluate(()=>{
  const ls=document.querySelector(".langsel");
  const chain=[]; let e=ls;
  while(e && e!==document.body){ chain.push(e.tagName+(e.id?"#"+e.id:"")+(e.className?"."+String(e.className).split(" ").join("."):"")); e=e.parentElement; }
  return {n:document.querySelectorAll(".langsel").length, chaine:chain.slice(0,6),
    nlExiste:!!document.querySelector(".nl"),
    mq:matchMedia("(max-width:860px)").matches};
});
console.log("erreurs:", errs.length?errs:"aucune");
console.log(JSON.stringify(r,null,1));
await b.close();
