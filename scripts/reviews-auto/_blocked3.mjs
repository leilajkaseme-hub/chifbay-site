import { chromium } from "playwright";
async function run(page_url, label){
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{width:390,height:844} });
  await p.addInitScript(() => {
    const real = HTMLMediaElement.prototype.play;
    window.__g=false; window.__try=0; window.__ok=0;
    ['touchstart','pointerdown','keydown','scroll','click'].forEach(e =>
      addEventListener(e, ()=>{window.__g=true;}, {passive:true,capture:true}));
    HTMLMediaElement.prototype.play = function(){
      window.__try++;
      if(!window.__g) return Promise.reject(new DOMException('NotAllowedError'));
      window.__ok++; return real.apply(this,arguments);
    };
    // empeche aussi la lecture automatique native, pour isoler le script
    document.addEventListener('DOMContentLoaded',()=>{
      const v=document.querySelector('video.hvid'); if(v) v.removeAttribute('autoplay');
    });
  });
  await p.goto(page_url,{waitUntil:"load"});
  await p.waitForTimeout(2500);
  const a = await p.evaluate(()=>({paused:document.querySelector('video.hvid').paused, t:window.__try, ok:window.__ok}));
  await p.evaluate(()=>window.dispatchEvent(new Event('scroll')));
  await p.waitForTimeout(2000);
  const c = await p.evaluate(()=>({paused:document.querySelector('video.hvid').paused,
    t:window.__try, ok:window.__ok, time:+document.querySelector('video.hvid').currentTime.toFixed(2)}));
  console.log(`${label}`);
  console.log(`   refusee  : tentatives ${a.t}, reussies ${a.ok}, en pause ${a.paused}`);
  console.log(`   apres geste: tentatives ${c.t}, reussies ${c.ok}, en pause ${c.paused}, temps ${c.time}s`);
  console.log(c.paused ? "   ECHEC\n" : "   OK, elle joue\n");
  await b.close();
}
await run("http://localhost:8791/", "APRES correctif (main modifie)");
