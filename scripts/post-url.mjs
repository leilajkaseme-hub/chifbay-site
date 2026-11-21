import fs from 'node:fs';
import path from 'node:path';

// Preserve the URL already declared by each article. Every article uses the
// clean form (no ".html") since 21 Nov 2026 (scripts/clean-post-urls.mjs), and a
// new one gets it too; an old ".html" canonical is still accepted as it is.
export function postUrl(root, slug, lang = '') {
  if (!/^[a-z0-9-]+$/.test(slug) || !/^(fr|de|pt|es|it)?$/.test(lang)) {
    throw new Error('Invalid article slug or language');
  }
  const relative = `${lang ? lang + '/' : ''}posts/${slug}`;
  const fallback = `https://chifbay.com/${relative}`;
  const file = path.join(root, relative + '.html');
  if (!fs.existsSync(file)) return fallback;
  const html = fs.readFileSync(file, 'utf8');
  const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i)?.[1];
  if (canonical !== fallback && canonical !== fallback + '.html') {
    throw new Error(`Missing or unexpected canonical in ${file}`);
  }
  return canonical;
}
