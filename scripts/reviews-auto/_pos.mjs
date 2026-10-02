import { chromium, devices } from "playwright";
const S="/private/tmp/claude-502/-Users-Shared-Claude/766a363c-8b63-4f00-8ae6-451feb0ce2c0/scratchpad";
const b = await chromium.launch();
for (const [lab,opt,shot] of [
  ["iPhone 13  390x664",{...devices['iPhone 13']},"pos-m1"],
  ["tall       430x932",{viewport:{width:430,height:932},deviceScaleFactor:3,isMobile:true,hasTouch:true},"pos-m2"],
]) {
  const p = await b.newPage(opt);
  await p.goto("http://localhost:8798/",{waitUntil:"networkidle"});
  await p.evaluate(()=>{const c=document.querySelector(".ck,.cookie,[class*=cookie]");if(c)c.style.display="none";});
  await p.waitForTimeout(5000);
  const r = await p.evaluate(() => {
    const hero=document.querySelector(".hero").getBoundingClientRect();
    const bd=document.querySelector(".hbadge").getBoundingClientRect();
    const tm=document.querySelector(".tour-meta").getBoundingClientRect();
    const btn=[...document.querySelectorAll(".hact .btn")];
    return {heroH:Math.round(hero.height), topLibre:Math.round(bd.top),
      basLibre:Math.round(hero.bottom-tm.bottom),
      just:getComputedStyle(btn[0]).justifyContent,
      b:btn.map(e=>{const r2=e.getBoundingClientRect();
        const t=e.childNodes[0].textContent.trim();
        const rg=document.createRange(); rg.selectNodeContents(e);
        const tr=rg.getBoundingClientRect();
        return `${t.slice(0,16)} pilule[${Math.round(r2.left)}-${Math.round(r2.right)}] texte[${Math.round(tr.left)}-${Math.round(tr.right)}] margeG=${Math.round(tr.left-r2.left)} margeD=${Math.round(r2.right-tr.right)}`;})};
  });
  console.log(`\n${lab}  hero ${r.heroH}px`);
  console.log(`  video libre en haut : ${r.topLibre}px   espace sous les chiffres : ${r.basLibre}px`);
  console.log(`  justify-content = ${r.just}`);
  r.b.forEach(x=>console.log("  "+x));
  await p.screenshot({path:`${S}/${shot}.png`});
  await p.close();
}
await b.close();
