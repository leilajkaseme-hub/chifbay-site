import { chromium, devices } from "playwright";
const S="/private/tmp/claude-502/-Users-Shared-Claude/766a363c-8b63-4f00-8ae6-451feb0ce2c0/scratchpad";
const b=await chromium.launch();
for(const [nom,url] of [["accueil","/"],["perla","/perla-do-oceano.html"],["varanda","/varanda-do-sol.html"]]){
  for(const [tag,opt] of [["desk",{viewport:{width:1440,height:1000}}],["mob",{...devices["iPhone 13"]}]]){
    const p=await b.newPage(opt);
    const bad=[],errs=[];
    p.on("response",r=>{if(r.status()>=400) bad.push(r.status()+" "+r.url().split("/").pop());});
    p.on("pageerror",e=>errs.push(e.message.slice(0,70)));
    await p.goto("http://localhost:8802"+url,{waitUntil:"networkidle"});
    await p.waitForTimeout(1800);
    await p.evaluate(()=>window.scrollTo(0,document.body.scrollHeight)); await p.waitForTimeout(1500);
    await p.evaluate(()=>window.scrollTo(0,0)); await p.waitForTimeout(800);
    const st=await p.evaluate(()=>({
      h1:document.querySelectorAll("h1").length,
      revCaches:[...document.querySelectorAll(".rv")].filter(e=>!e.classList.contains("in")).length,
      rvTotal:document.querySelectorAll(".rv").length,
      imgsCassees:[...document.images].filter(i=>i.complete&&i.naturalWidth===0).length,
      lightbox:!!document.querySelector(".lb")
    }));
    console.log(`  ${nom}/${tag}: ${JSON.stringify(st)}${bad.length?" HTTP:"+bad.join(","):""}${errs.length?" JS:"+errs.join("|"):""}`);
    await p.screenshot({path:`${S}/stay-${nom}-${tag}.png`, fullPage:tag==="desk"});
    await p.close();
  }
}
await b.close();
