import { chromium, devices } from "playwright";
const S="/private/tmp/claude-502/-Users-Shared-Claude/766a363c-8b63-4f00-8ae6-451feb0ce2c0/scratchpad";
const b = await chromium.launch();
for (const [n,u] of [["fin-video","/"],["fin-photo","/posts/top-10-beaches-in-madeira.html"]]) {
  const p = await b.newPage({...devices['iPhone 13']});
  await p.goto("http://localhost:8798"+u,{waitUntil:"networkidle"});
  await p.waitForTimeout(5000);
  await p.screenshot({path:`${S}/${n}.png`});
  await p.close();
}
await b.close(); console.log("ok");
