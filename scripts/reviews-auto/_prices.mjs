import { chromium } from "playwright";
const FLATS = { perla: "1420093678403124003", varanda: "1397784964911656134" };
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36";
const iso = d => d.toISOString().slice(0,10);
const add = (s,n) => { const d = new Date(s+"T00:00:00Z"); d.setUTCDate(d.getUTCDate()+n); return iso(d); };

const b = await chromium.launch();
const out = {};
for (const [name,id] of Object.entries(FLATS)) {
  out[name] = {};
  for (let m = 0; m < 12; m++) {
    const base = new Date(Date.UTC(2026, 8 + m, 1));
    const y = base.getUTCFullYear(), mo = base.getUTCMonth();
    let got = null;
    for (const day of [8, 15, 22, 2]) {                 // on essaie plusieurs semaines du mois
      const from = iso(new Date(Date.UTC(y, mo, day)));
      if (from <= "2026-09-08") continue;               // trop proche, delai de reservation
      const to = add(from, 7);
      const p = await b.newPage({ viewport:{width:1440,height:900}, userAgent:UA, locale:"fr-FR" });
      try {
        await p.goto(`https://www.airbnb.fr/rooms/${id}?check_in=${from}&check_out=${to}&adults=2`,
                     { waitUntil:"domcontentloaded", timeout:60000 });
        await p.waitForTimeout(8000);
        const t = await p.evaluate(()=>document.body.innerText.replace(/[ \t]+/g," "));
        const q = t.match(/([\d\s]{3,8})€ au total/);
        if (q) { got = { from, total: +q[1].replace(/\s/g,""), nightly: Math.round(+q[1].replace(/\s/g,"")/7) }; }
      } catch {}
      await p.close();
      if (got) break;
    }
    const key = `${y}-${String(mo+1).padStart(2,"0")}`;
    out[name][key] = got;
    console.log(`  ${name.padEnd(8)} ${key}  ${got ? String(got.nightly).padStart(3)+" EUR/nuit  (semaine du "+got.from+", "+got.total+" EUR)" : "aucune semaine libre"}`);
  }
}
await b.close();
console.log("\nJSON:" + JSON.stringify(out));
