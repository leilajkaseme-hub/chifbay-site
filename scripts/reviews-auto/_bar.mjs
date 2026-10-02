import { chromium, devices } from "playwright";
const S="/private/tmp/claude-502/-Users-Shared-Claude/766a363c-8b63-4f00-8ae6-451feb0ce2c0/scratchpad";
const b = await chromium.launch();
for (const [lab,opt,shot] of [
  ["iPhone 13 390x664",{...devices['iPhone 13']},"bar-m1"],
  ["tall      430x932",{viewport:{width:430,height:932},deviceScaleFactor:3,isMobile:true,hasTouch:true},"bar-m2"],
  ["desktop  1440x900",{viewport:{width:1440,height:900}},"bar-d1"],
]) {
  const p = await b.newPage(opt);
  await p.goto("http://localhost:8798/",{waitUntil:"networkidle"});
  await p.waitForTimeout(4000);
  const probe = () => p.evaluate(() => {
    const hero=document.querySelector(".hero").getBoundingClientRect();
    const tm=document.querySelector(".tour-meta").getBoundingClientRect();
    const bar=document.getElementById("cb-consent");
    const br=bar?bar.getBoundingClientRect():null;
    return {bar:!!bar, h:getComputedStyle(document.documentElement).getPropertyValue("--consent-h").trim()||"(aucune)",
      cls:document.documentElement.classList.contains("has-consent-bar"),
      chevauche: br ? Math.round(Math.min(tm.bottom,br.bottom)-Math.max(tm.top,br.top)) : null,
      libreHaut: Math.round(document.querySelector(".hbadge").getBoundingClientRect().top),
      basHero: Math.round(hero.bottom-tm.bottom)};
  });
  const avant = await probe();
  console.log(`\n${lab}`);
  console.log(`  bandeau visible : classe=${avant.cls} --consent-h=${avant.h}`);
  console.log(`  chevauchement chiffres/bandeau : ${avant.chevauche}px (<=0 = pas de recouvrement)`);
  console.log(`  video libre en haut ${avant.libreHaut}px, espace sous les chiffres ${avant.basHero}px`);
  await p.screenshot({path:`${S}/${shot}.png`});
  await p.click("#cb-consent button:last-child");
  await p.waitForTimeout(900);
  const apres = await probe();
  console.log(`  apres Accept : bandeau=${apres.bar} classe=${apres.cls} --consent-h=${apres.h}`);
  console.log(`  video libre en haut ${apres.libreHaut}px, espace sous les chiffres ${apres.basHero}px`);
  await p.screenshot({path:`${S}/${shot}-apres.png`});
  await p.close();
}
await b.close();
