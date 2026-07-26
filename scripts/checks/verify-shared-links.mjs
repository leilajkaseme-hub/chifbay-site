// Run with:  cd scripts/reviews-auto && node ../checks/verify-shared-links.mjs
// Verifies that mangled-but-valid URLs (wrong case, trailing slash, guessed
// aliases) still land on the right page via 404.html. Re-run after any change
// to 404.html, sitemap generation, or page filenames.

import { chromium } from 'playwright';
const CASES = [
  // [requested, expected final path]
  ['/About.html',                        '/about.html'],
  ['/ABOUT.HTML',                        '/about.html'],
  ['/about/',                            '/about.html'],
  ['/about',                             '/about.html'],
  ['/Reviews.html',                      '/reviews.html'],
  ['/reviews/',                          '/reviews.html'],
  ['/blog/',                             '/blog.html'],
  ['/Blog.html',                         '/blog.html'],
  ['/experiences/',                      '/experiences.html'],
  ['/Contact.html',                      '/contact.html'],
  ['/index.htm',                         '/'],
  ['/Sunset-Cruise.html',                '/sunset-cruise.html'],
  ['/sunset-cruise/',                    '/sunset-cruise.html'],
  ['/posts/madeira-food-guide/',         '/posts/madeira-food-guide.html'],
  ['/posts/Madeira-Food-Guide/',         '/posts/madeira-food-guide.html'],
  ['/posts/seafood-in-madeira-guide/',   '/posts/seafood-in-madeira-guide.html'],
  ['/FR/index.html',                     '/fr/index.html'],
  ['/FR/Experiences.html',               '/fr/experiences.html'],
  ['/de/about/',                         '/de/about.html'],
  ['/PT/Contact.html',                   '/pt/contact.html'],
  // guessed aliases
  ['/tours',                             '/experiences.html'],
  ['/booking',                           '/experiences.html'],
  ['/avis',                              '/reviews.html'],
  ['/journal',                           '/blog.html'],
  ['/home',                              '/'],
];
const b = await chromium.launch({headless:true});
const p = await (await b.newContext()).newPage();
let pass=0, fail=0;
for (const [req, want] of CASES) {
  try{
    await p.goto('https://chifbay.com'+req, {waitUntil:'domcontentloaded', timeout:30000});
    await p.waitForTimeout(2600);
    const got = new URL(p.url()).pathname;
    const ok = got === want || (want === '/' && (got === '/' || got === '/index.html'));
    console.log(`${ok?'PASS':'FAIL'}  ${req.padEnd(34)} -> ${got}${ok?'':'   (wanted '+want+')'}`);
    ok ? pass++ : fail++;
  }catch(e){ console.log(`ERR   ${req} : ${e.message.slice(0,60)}`); fail++; }
}
console.log(`\n${pass} passed, ${fail} failed, ${CASES.length} total`);
await b.close();
