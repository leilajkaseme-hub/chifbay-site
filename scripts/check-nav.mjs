#!/usr/bin/env node
/**
 * Regression guard for the mobile nav drawer.
 *
 * The drawer (.nl) is a child of #nav. Any ancestor carrying backdrop-filter,
 * filter, transform or perspective becomes the containing block for its
 * position:fixed descendants — at which point `inset:0 0 0 auto` sizes the
 * drawer against the ~79px nav bar instead of the viewport. It collapses to a
 * stub, page content hit-tests above it, and every tap misses. #nav gains
 * backdrop-filter via .sc on scroll, so this only ever reproduced AFTER
 * scrolling, which is why it kept coming back looking random.
 *
 * This check opens each page at phone width, scrolls down, opens the drawer and
 * asserts that it still fills the viewport and still receives the taps.
 *
 *   node scripts/check-nav.mjs                 # against the local file server
 *   BASE=https://chifbay.com/ node scripts/check-nav.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE || 'http://127.0.0.1:8789/';
const PORT = 9401;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ROOT = path.resolve(import.meta.dirname, '..');

// Every page that renders the nav: root pages plus the five locales.
const LOCALES = ['', 'fr/', 'de/', 'pt/', 'es/', 'it/'];
const PAGES = [
  'index.html', 'experiences.html', 'about.html', 'contact.html',
  'hidden-coves-half-day.html', 'sunset-cruise.html', 'coastal-discovery-full-day.html',
];
// root-only, not in the i18n PAGES list
const EXTRA = ['reviews.html', 'blog.html', 'book.html', 'book-day.html', 'book-sunset.html'];

/* playwright-core is not a dependency of this site. Use whichever copy exists:
   a local install first, otherwise the one in the video-creation project. */
async function chromium() {
  const candidates = [
    path.join(ROOT, 'node_modules', 'playwright-core', 'index.mjs'),
    '/Users/Shared/Claude/video-creation/node_modules/playwright-core/index.mjs',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return (await import(c)).chromium;
  }
  console.error('playwright-core not found. Install it here, or run from a machine that has\n' +
                'the video-creation project checked out.');
  process.exit(2);
}

const urls = [];
for (const l of LOCALES) for (const p of PAGES) urls.push(l + p);
urls.push(...EXTRA);

const dir = path.join('/tmp', 'chifbay-navcheck-' + Date.now());
const child = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${dir}`,
  '--headless=new', '--no-first-run', '--no-default-browser-check', 'about:blank',
], { detached: true, stdio: 'ignore' });
child.unref();

for (let i = 0; i < 100; i++) {
  try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break; } catch {}
  await new Promise((r) => setTimeout(r, 300));
}

const browser = await (await chromium()).connectOverCDP(`http://127.0.0.1:${PORT}`);
const ctx = browser.contexts()[0];
const failures = [];
let checked = 0;

for (const url of urls) {
  const page = await ctx.newPage();
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    const res = await page.goto(BASE + url, { waitUntil: 'load', timeout: 45_000 });
    if (res && res.status() === 404) { await page.close(); continue; }
    await page.waitForTimeout(1200);

    // Scroll first: the bug only appears once #nav picks up .sc.
    await page.evaluate(() => window.scrollTo(0, Math.max(400, document.body.scrollHeight * 0.45)));
    await page.waitForTimeout(700);
    await page.evaluate(() => document.querySelector('.navtoggle')?.click());
    await page.waitForTimeout(700);

    const r = await page.evaluate(() => {
      const nl = document.querySelector('.nl');
      if (!nl) return { skip: true };
      const rect = nl.getBoundingClientRect();
      const cx = Math.round(rect.left + rect.width / 2);
      const hit = (y) => { const e = document.elementFromPoint(cx, y); return e ? e.closest('.nl') !== null : false; };
      return {
        height: Math.round(rect.height),
        viewport: window.innerHeight,
        // the drawer must own its top, middle and bottom, not just the middle
        ownsTop: hit(Math.round(rect.top + 60)),
        ownsMid: hit(Math.round(rect.top + rect.height / 2)),
        ownsBottom: hit(Math.round(rect.top + rect.height - 60)),
      };
    });

    if (r.skip) { await page.close(); continue; }
    checked++;
    const tallEnough = r.height >= r.viewport * 0.9;
    if (!tallEnough || !r.ownsTop || !r.ownsMid || !r.ownsBottom) {
      failures.push(`${url}: height ${r.height}/${r.viewport} taps[top=${r.ownsTop} mid=${r.ownsMid} bottom=${r.ownsBottom}]`);
      process.stdout.write(`  FAIL ${url}\n`);
    } else {
      process.stdout.write(`  ok   ${url}\n`);
    }
  } catch (err) {
    failures.push(`${url}: ${err.message.split('\n')[0]}`);
    process.stdout.write(`  ERR  ${url}\n`);
  }
  await page.close();
}

await browser.close();
fs.rmSync(dir, { recursive: true, force: true });

process.stdout.write(`\n${checked - failures.length}/${checked} pages OK\n`);
if (failures.length) {
  process.stdout.write(`\nMobile nav drawer is broken on:\n${failures.map((f) => '  - ' + f).join('\n')}\n`);
  process.exit(1);
}
