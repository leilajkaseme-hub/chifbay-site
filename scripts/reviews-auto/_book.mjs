import { chromium, devices } from "playwright";
const S="/private/tmp/claude-502/-Users-Shared-Claude/766a363c-8b63-4f00-8ae6-451feb0ce2c0/scratchpad";
const b=await chromium.launch();
for (const [lab,opt] of [["desktop",{viewport:{width:1440,height:1100}}],["mobile",{...devices["iPhone 13"]}]]) {
  const p=await b.newPage(opt);
  const errs=[]; p.on("pageerror",e=>errs.push(e.message.slice(0,80)));
  await p.goto("https://chifstays.com/varanda-do-sol.html",{waitUntil:"networkidle"});
  await p.waitForTimeout(3500);
  const st=await p.evaluate(()=>{
    const r=document.getElementById('book');
    const days=[...r.querySelectorAll('.bk-day')];
    return {
      calendrierCharge: !r.querySelector('.bk-wait') && !r.querySelector('.bk-down'),
      jours: days.length,
      pris: days.filter(d=>d.classList.contains('is-taken')).length,
      passes: days.filter(d=>d.classList.contains('is-past')).length,
      libres: days.filter(d=>!d.disabled).length,
      mois: r.querySelector('.bk-head strong')?.textContent,
      tarif: r.querySelector('.bk-rate')?.textContent
    };
  });
  console.log(`  ${lab}: ${JSON.stringify(st)}${errs.length?" JS:"+errs.join("|"):""}`);
  await p.screenshot({path:`${S}/book-${lab}.png`, clip: lab==="desktop"?{x:940,y:120,width:440,height:700}:undefined, fullPage: lab!=="desktop"});
  await p.close();
}
await b.close();
