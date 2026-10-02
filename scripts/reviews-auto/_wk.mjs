import { webkit, devices } from "playwright";
const b = await webkit.launch();
const p = await b.newPage({...devices['iPhone 13']});
await p.goto("https://chifbay.com/",{waitUntil:"networkidle"});
await p.waitForTimeout(2500);
await p.evaluate(()=>{const c=document.getElementById("cb-consent"); if(c) c.querySelectorAll("button")[1].click();});
await p.click(".navtoggle"); await p.waitForTimeout(700);
const before = await p.evaluate(()=>document.querySelector(".nl").scrollTop);
await p.click(".langbtn");
for (const t of [300, 900, 2000, 3500]) {
  await p.waitForTimeout(t===300?300:t-(t===900?300:t===2000?900:2000));
  const r = await p.evaluate(()=>{
    const nl=document.querySelector(".nl");
    const m=document.querySelector(".langmenu").getBoundingClientRect();
    return {scrollTop:Math.round(nl.scrollTop), max:nl.scrollHeight-nl.clientHeight,
      menu:`${Math.round(m.top)}..${Math.round(m.bottom)}`, fen:innerHeight,
      visible:m.top>=0&&m.bottom<=innerHeight};});
  console.log(`+${t}ms  scrollTop=${r.scrollTop}/${r.max}  menu ${r.menu} (fenetre ${r.fen})  entierement visible=${r.visible}`);
}
console.log("scrollTop avant ouverture:", before);
await b.close();
