import { chromium } from "playwright";
const b = await chromium.launch();
async function jours(url){
  const p = await b.newPage({viewport:{width:1280,height:1000}});
  await p.goto("http://localhost:8798"+url,{waitUntil:"networkidle"});
  await p.waitForTimeout(4500);
  const r = await p.evaluate(()=>{
    const cal=document.querySelector("#bkcal");
    if(!cal) return {err:"pas de calendrier"};
    const on=[...cal.querySelectorAll(".bkday[data-date]")].map(e=>e.dataset.date);
    const off=[...cal.querySelectorAll(".bkday.off")].map(e=>e.textContent.trim());
    const mois=(cal.querySelector("strong")||{}).textContent;
    return {mois, ouverts:on, fermes:off};
  });
  await p.close();
  return r;
}
for (const [nom,url] of [["sunset","/book-sunset.html?v=cabo-girao"],["day-trip","/book-day.html?v=ribeira-brava"]]) {
  const r = await jours(url);
  if (r.err) { console.log(nom, r.err); continue; }
  const sept = r.ouverts.filter(d=>d.startsWith("2026-09"));
  const jours6a19 = [];
  for (let d=6; d<=19; d++){ const k=`2026-09-${String(d).padStart(2,"0")}`; jours6a19.push(`${d}${sept.includes(k)?"ouvert":"FERME"}`); }
  console.log(`\n${nom} (${r.mois})`);
  console.log("  6 au 19 septembre : " + jours6a19.join("  "));
  console.log("  premiers jours ouverts en septembre : " + sept.slice(0,6).join(", "));
}
await b.close();
