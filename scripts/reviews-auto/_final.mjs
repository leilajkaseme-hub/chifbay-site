import { chromium, devices } from "playwright";
const S="/private/tmp/claude-502/-Users-Shared-Claude/766a363c-8b63-4f00-8ae6-451feb0ce2c0/scratchpad";
const b = await chromium.launch();
const read = async (p) => p.evaluate(() => {
  const q = s => document.querySelector(s);
  const cs = s => { const e=q(s); return e ? getComputedStyle(e) : null; };
  const hov = cs(".hov"), h1 = cs(".hero h1"), sub = cs(".hsub"), bg = cs(".hbadge");
  const hact = q(".hact");
  const btns = [...document.querySelectorAll(".hact .btn")].map(e=>{
    const r=e.getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}`;});
  const tm = q(".tour-meta");
  return {
    hov: hov ? hov.backgroundImage.replace(/\s+/g," ").slice(0,68) : "-",
    h1sh: h1 ? h1.textShadow : "-",
    sub: sub ? sub.color : "-", subClamp: sub ? sub.webkitLineClamp : "-",
    kicker: bg ? bg.color : "-",
    dir: hact ? getComputedStyle(hact).flexDirection : "-", btns,
    tmH: tm ? Math.round(tm.getBoundingClientRect().height) : 0,
  };
});
const cases = [
  ["iPhone 13   390x664", {...devices['iPhone 13']}, "/"],
  ["tall phone  430x932", {viewport:{width:430,height:932},deviceScaleFactor:3,isMobile:true,hasTouch:true}, "/"],
  ["desktop    1440x900", {viewport:{width:1440,height:900}}, "/"],
  ["ARTICLE photo  mob ", {...devices['iPhone 13']}, "/posts/top-10-beaches-in-madeira.html"],
  ["ARTICLE photo  desk", {viewport:{width:1440,height:900}}, "/posts/top-10-beaches-in-madeira.html"],
  ["sunset-cruise  mob ", {...devices['iPhone 13']}, "/sunset-cruise.html"],
];
for (const [label, opt, url] of cases) {
  const p = await b.newPage(opt);
  await p.goto("http://localhost:8798"+url, {waitUntil:"networkidle"});
  await p.waitForTimeout(2500);
  const r = await read(p);
  console.log(`\n${label}  ${url}`);
  console.log(`  voile   ${r.hov}`);
  console.log(`  h1      ${r.h1sh}`);
  console.log(`  soustit ${r.sub}  clamp=${r.subClamp}`);
  console.log(`  surtitre ${r.kicker}`);
  console.log(`  boutons ${r.dir} ${r.btns.join(" ")}   chiffres ${r.tmH}px`);
  if (label.startsWith("iPhone")) await p.screenshot({path:`${S}/hero-fin.png`});
  await p.close();
}
await b.close();
