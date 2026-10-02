import { chromium, webkit, devices } from "playwright";
const pages = ["/", "/fr/", "/de/", "/experiences.html", "/reviews.html", "/contact.html"];
for (const [name, eng] of [["chromium", chromium], ["webkit", webkit]]) {
  const b = await eng.launch();
  for (const dev of [{...devices['iPhone 13']}, {viewport:{width:1440,height:900}}]) {
    const p = await b.newPage(dev);
    const label = dev.isMobile ? "mobile " : "desktop";
    for (const u of pages) {
      const r = await p.goto("http://localhost:8798" + u, {waitUntil:"domcontentloaded"});
      if (!r || r.status() >= 400) { console.log(`${name} ${label} ${u.padEnd(20)} HTTP ${r?r.status():"?"}`); continue; }
      await p.waitForTimeout(3500);
      const v = await p.evaluate(() => {
        const el = document.querySelector("video.hvid");
        if (!el) return null;
        const cs = getComputedStyle(el);
        return { playing: !el.paused && el.currentTime > 0, ct: +el.currentTime.toFixed(1),
                 src: (el.currentSrc||"").split("/").pop(), muted: el.muted,
                 w: Math.round(el.getBoundingClientRect().width), controls: el.controls,
                 vis: cs.visibility !== "hidden" && cs.opacity !== "0" };
      });
      if (!v) { console.log(`${name} ${label} ${u.padEnd(20)} pas de video`); continue; }
      const ok = v.playing && v.muted && !v.controls && v.vis;
      console.log(`${name} ${label} ${u.padEnd(20)} ${ok?"OK ":"!! "} ${v.src} t=${v.ct}s muted=${v.muted} controls=${v.controls} ${v.w}px`);
    }
    await p.close();
  }
  await b.close();
}
