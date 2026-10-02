import { chromium, devices } from "playwright";
const S="/private/tmp/claude-502/-Users-Shared-Claude/766a363c-8b63-4f00-8ae6-451feb0ce2c0/scratchpad";
const b = await chromium.launch();
for (const [o,n] of [[{...devices['iPhone 13']},"m3"],[{viewport:{width:1440,height:900},deviceScaleFactor:2},"d3"]]) {
  const p = await b.newPage(o);
  await p.goto("http://localhost:8798/", {waitUntil:"networkidle"});
  await p.waitForTimeout(6500);
  await p.screenshot({path:`${S}/hero-${n}.png`});
  await p.close();
}
await b.close(); console.log("ok");
