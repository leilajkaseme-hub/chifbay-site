import { chromium } from "playwright";
const b = await chromium.launch();
for (const [nom,url] of [["sunset","https://chifbay.com/book-sunset.html?v=cabo-girao"],
                         ["day-trip","https://chifbay.com/book-day.html?v=ribeira-brava"]]) {
  const p = await b.newPage({viewport:{width:1280,height:1000}});
  await p.goto(url,{waitUntil:"networkidle"});
  await p.waitForTimeout(5000);
  const r = await p.evaluate(()=>{
    const cal=document.querySelector("#bkcal"); if(!cal) return {err:"pas de calendrier"};
    const on=[...cal.querySelectorAll(".bkday[data-date]")].map(e=>e.dataset.date);
    return {mois:(cal.querySelector("strong")||{}).textContent, on};
  });
  if (r.err) { console.log(nom, r.err); await p.close(); continue; }
  const l=[]; for(let d=4; d<=21; d++){const k=`2026-09-${String(d).padStart(2,"0")}`; l.push(`${d}${r.on.includes(k)?"·":"X"}`);}
  console.log(`\n${nom}  (${r.mois})\n  4 au 21 sept : ${l.join(" ")}      (· ouvert, X ferme)`);
  await p.close();
}
await b.close();
