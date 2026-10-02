#!/usr/bin/env node
// Read-only by default. --fix aligns sitemap/hreflang to existing canonicals;
// it never changes canonical choices, copy, bookings or review data.
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../..');
const fix = process.argv.includes('--fix');
const dirs = ['', 'posts', ...['fr','de','pt','es','it'].flatMap(l => [l, `${l}/posts`])];
const files = dirs.flatMap(d => fs.readdirSync(path.join(root,d)).filter(f => f.endsWith('.html')).map(f => path.join(root,d,f)));
const pages = new Map(files.map(file => {
 const html = fs.readFileSync(file,'utf8');
 return [file, {html, canonical:html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i)?.[1]}];
}));
function target(url) {
 const u = new URL(url);
 if (u.origin !== 'https://chifbay.com' || u.search || u.hash) throw new Error(`Unexpected SEO URL: ${url}`);
 let p = decodeURIComponent(u.pathname).slice(1);
 p = !p || p.endsWith('/') ? p+'index.html' : p.endsWith('.html') ? p : p+'.html';
 const page = pages.get(path.join(root,p));
 if (!page?.canonical) throw new Error(`Missing canonical target: ${url}`);
 if (/<meta[^>]+content="[^"]*noindex/i.test(page.html)) throw new Error(`Non-indexable target: ${url}`);
 return page;
}
let mismatches=0, changed=0, alternates=0, documents=0;
const writes=[];
for (const [file,page] of pages) {
 let html=page.html;
 for (const ld of html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) JSON.parse(ld[1]);
 html=html.replace(/<link\s+rel="alternate"\s+hreflang="([^"]+)"\s+href="([^"]+)"[^>]*>/g,(tag,lang,url)=>{
  alternates++;
  const canonical=target(url).canonical;
  if (url===canonical) return tag;
  mismatches++;
  return tag.replace(url,canonical);
 });
 if(html!==page.html && fix){writes.push([file,html]);changed++;}
 if(page.canonical) documents++;
}
const sitemap=path.join(root,'sitemap.xml');
const before=fs.readFileSync(sitemap,'utf8');
const seen=new Set();
const after=before.replace(/^[ \t]*<url>\s*<loc>([^<]+)<\/loc>[\s\S]*?<\/url>/gm,(tag,url)=>{
 const canonical=target(url).canonical;
 if(seen.has(canonical)){mismatches++;return '';}
 seen.add(canonical);
 if(url!==canonical)mismatches++;
 return tag.replace(`<loc>${url}</loc>`, `<loc>${canonical}</loc>`);
});
if(after!==before && fix){writes.push([sitemap,after]);changed++;}
// Reciprocal language sets are compared by their resolved canonical targets,
// so this check also works during a --fix run with the original in-memory HTML.
for(const [file,page] of pages){
 const links=[...page.html.matchAll(/<link\s+rel="alternate"\s+hreflang="([^"]+)"\s+href="([^"]+)"[^>]*>/g)];
 if(!links.length)continue;
 const expected=links.map(m=>`${m[1]}:${target(m[2]).canonical}`).sort().join('\n');
 for(const m of links){
  const other=target(m[2]);
  const actual=[...other.html.matchAll(/<link\s+rel="alternate"\s+hreflang="([^"]+)"\s+href="([^"]+)"[^>]*>/g)].map(n=>`${n[1]}:${target(n[2]).canonical}`).sort().join('\n');
  if(actual!==expected)throw new Error(`Non-reciprocal hreflang: ${file} -> ${m[2]}`);
 }
}
for(const [file,content] of writes)fs.writeFileSync(file,content);
console.log(`${documents} canonical documents; ${seen.size} sitemap URLs; ${alternates} hreflang links; JSON-LD parsed; reciprocal language sets checked.`);
console.log(fix ? `${mismatches} mismatches repaired in ${changed} files.` : `${mismatches} canonical mismatches.`);
if(mismatches && !fix)process.exitCode=1;
