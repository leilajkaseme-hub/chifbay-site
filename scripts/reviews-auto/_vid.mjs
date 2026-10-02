import { chromium, webkit, devices } from "playwright";
async function test(browserType, label, opts){
  const b = await browserType.launch();
  const p = await b.newPage(opts);
  const errs=[], reqs=[];
  p.on("console", m => { if(m.type()==="error") errs.push(m.text().slice(0,90)); });
  p.on("response", r => { if(/\.mp4/.test(r.url())) reqs.push(r.status()+" "+r.url().split("/").pop()); });
  await p.goto("https://chifbay.com/", {waitUntil:"load"});
  await p.waitForTimeout(4000);
  const s = await p.evaluate(() => {
    const v = document.querySelector("video.hvid");
    if (!v) return {absent:true};
    return {
      paused: v.paused, currentTime: +v.currentTime.toFixed(2), readyState: v.readyState,
      networkState: v.networkState, muted: v.muted, autoplay: v.autoplay,
      playsinline: v.hasAttribute("playsinline"), controls: v.controls,
      sources: [...v.querySelectorAll("source")].map(x=>x.src.split("/").pop()),
      poster: (v.poster||"").split("/").pop(),
      err: v.error ? v.error.code+" "+v.error.message : null,
      w: v.videoWidth, h: v.videoHeight,
      display: getComputedStyle(v).display, opacity: getComputedStyle(v).opacity,
    };
  });
  console.log(`\n${label}`);
  console.log("  ", JSON.stringify(s));
  if (reqs.length) console.log("   mp4:", reqs.join(" | ")); else console.log("   mp4: AUCUNE REQUETE");
  if (errs.length) console.log("   erreurs:", errs.slice(0,3).join(" | "));
  await b.close();
}
await test(chromium, "Chromium desktop", {viewport:{width:1440,height:900}});
await test(chromium, "Chromium mobile (iPhone 13 UA)", {...devices["iPhone 13"]});
try { await test(webkit, "WebKit desktop (moteur Safari)", {viewport:{width:1440,height:900}}); } catch(e){ console.log("\nWebKit indisponible:", e.message.slice(0,60)); }
try { await test(webkit, "WebKit iPhone (Safari iOS)", {...devices["iPhone 13"]}); } catch(e){ console.log("WebKit iPhone indisponible"); }
