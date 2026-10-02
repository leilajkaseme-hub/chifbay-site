import { chromium } from "playwright";
const b = await chromium.launch();
const pages = [
  ["en", "/", "/posts/top-10-beaches-in-madeira.html"],
  ["fr", "/fr/index.html", "/fr/posts/cliff-jumping-in-madeira-guide.html"],
  ["de", "/de/index.html", "/de/posts/is-madeira-safe-guide.html"],
  ["es", "/es/index.html", "/es/posts/top-10-gardens-in-madeira.html"],
  ["it", "/it/index.html", "/it/posts/nikita-madeira-drink-guide.html"],
  ["pt", "/pt/index.html", "/pt/posts/pico-ruivo-madeira-guide.html"],
];
for (const [lang, ...urls] of pages) {
  for (const u of urls) {
    const p = await b.newPage({viewport:{width:1280,height:900}});
    const bad = [];
    p.on("response", r => { if (r.status() >= 400) bad.push(r.status()+" "+r.url().split("/").slice(3).join("/")); });
    await p.goto("http://localhost:8798"+u, {waitUntil:"networkidle"});
    await p.waitForTimeout(1500);
    const r = await p.evaluate(() => {
      const imgs = [...document.images];
      const broken = imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => i.currentSrc.split("/").pop());
      const nodims = imgs.filter(i => !i.getAttribute("width") && !/\.svg/i.test(i.src)).length;
      let ld = 0, ldBad = [];
      for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
        try { JSON.parse(s.textContent); ld++; } catch (e) { ldBad.push(e.message.slice(0,40)); }
      }
      const h1 = document.querySelectorAll("h1").length;
      const canon = document.querySelector('link[rel=canonical]')?.href || "-";
      const xdef = !!document.querySelector('link[hreflang="x-default"]');
      const webp = imgs.filter(i=>/\.webp/.test(i.currentSrc)).length;
      return {imgs: imgs.length, broken, nodims, ld, ldBad, h1, canon: canon.replace("https://chifbay.com",""), xdef, webp};
    });
    const ok = !bad.length && !r.broken.length && !r.ldBad.length && r.h1===1;
    console.log(`${lang} ${u.padEnd(48)} ${ok?"OK ":"!! "} images ${r.imgs} (webp ${r.webp}, cassees ${r.broken.length}, sans dim ${r.nodims})  json-ld ${r.ld} ok${r.ldBad.length?" +"+r.ldBad.length+" KO":""}  h1 ${r.h1}  x-default ${r.xdef?"oui":"non"}`);
    if (bad.length) console.log("      HTTP: " + bad.slice(0,3).join(" | "));
    if (r.broken.length) console.log("      images cassees: " + r.broken.slice(0,3).join(" | "));
    await p.close();
  }
}
await b.close();
