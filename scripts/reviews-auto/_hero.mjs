import { chromium, devices } from "playwright";
const S="/private/tmp/claude-502/-Users-Shared-Claude/766a363c-8b63-4f00-8ae6-451feb0ce2c0/scratchpad";
const b = await chromium.launch();
const p = await b.newPage({...devices['iPhone 13']});
await p.goto("https://chifbay.com/", {waitUntil:"networkidle"});
await p.waitForTimeout(6000);
console.log(JSON.stringify(await p.evaluate(()=>{
  const V=innerHeight, r=e=>{const b=e.getBoundingClientRect();return {top:Math.round(b.top),h:Math.round(b.height)}};
  const q=s=>document.querySelector(s);
  const hero=q('.hero');
  const out={viewport:V, hero:r(hero)};
  for (const [k,s] of [["bandeau",".topbar,.announce,.ann"],["nav","#nav"],["kicker",".hkick,.bkkick,.hbadge"],
      ["h1",".hero h1"],["sous-titre",".hsub"],["boutons",".hcta,.hbtns,.hero .btn"],["chiffres",".hmeta"],["scroll",".hscroll,.scroll"]]) {
    const e=q(s); if(e) out[k]=r(e);
  }
  const hov=q('.hov'); out.overlay = hov?getComputedStyle(hov).background.slice(0,90):null;
  return out;
}),null,1));
await p.screenshot({path:`${S}/hero-m.png`});
await b.close();
