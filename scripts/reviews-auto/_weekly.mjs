import { chromium } from "playwright";
const FLATS = { perla: "1420093678403124003", varanda: "1397784964911656134" };
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36";
const add = (s,n)=>{const d=new Date(s+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};

// toutes les semaines de decembre a fevrier, puis un point par mois ensuite
const starts = [];
for (let d = "2026-12-01"; d < "2027-03-01"; d = add(d, 7)) starts.push(d);
["2027-03-08","2027-04-08","2027-05-08","2027-06-08","2027-07-08","2027-08-08","2027-08-22"].forEach(d=>starts.push(d));

const b = await chromium.launch();
for (const [name,id] of Object.entries(FLATS)) {
  console.log(`\n  ${name.toUpperCase()}`);
  for (const from of starts) {
    const to = add(from, 7);
    const p = await b.newPage({viewport:{width:1440,height:900},userAgent:UA,locale:"fr-FR"});
    let line = "indisponible";
    try {
      await p.goto(`https://www.airbnb.fr/rooms/${id}?check_in=${from}&check_out=${to}&adults=2`,
                   {waitUntil:"domcontentloaded",timeout:60000});
      await p.waitForTimeout(7500);
      const t = await p.evaluate(()=>document.body.innerText.replace(/[ \t]+/g," "));
      const q = t.match(/([\d\s]{3,8})€ au total/);
      if (q) { const tot=+q[1].replace(/\s/g,""); line = `${String(Math.round(tot/7)).padStart(3)} EUR/nuit  (${tot} EUR)`; }
    } catch {}
    await p.close();
    console.log(`    ${from}  ${line}`);
  }
}
await b.close();
