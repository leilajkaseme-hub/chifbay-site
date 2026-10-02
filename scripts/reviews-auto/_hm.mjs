import { chromium, devices } from "playwright";
const S="/private/tmp/claude-502/-Users-Shared-Claude/766a363c-8b63-4f00-8ae6-451feb0ce2c0/scratchpad";
const b = await chromium.launch();
const p = await b.newPage({...devices['iPhone 13']});
await p.goto("http://localhost:8798/", {waitUntil:"networkidle"});
await p.waitForTimeout(6000);
console.log(JSON.stringify(await p.evaluate(()=>{
  const V=innerHeight, q=s=>document.querySelector(s);
  const r=e=>e?{top:Math.round(e.getBoundingClientRect().top),h:Math.round(e.getBoundingClientRect().height)}:null;
  const hc=q('.hc'); const meta=q('.tour-meta');
  return {viewport:V, blocContenu:r(hc),
    videoLibre: Math.round(V - (hc?hc.getBoundingClientRect().height:0)),
    sousTitre:r(q('.hsub')), boutons:r(q('.hact')), chiffres:r(meta),
    boutonsCoteACote: q('.hact') ? getComputedStyle(q('.hact')).flexDirection : null,
    ombre: getComputedStyle(q('.hero h1')).textShadow.slice(0,48)};
}),null,1));
await p.screenshot({path:`${S}/hero-m2.png`});
await b.close();
