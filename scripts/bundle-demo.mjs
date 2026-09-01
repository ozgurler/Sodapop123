/**
 * Folds dist-demo/ into one self-contained HTML file: JS inlined, fonts as
 * data URIs. No network, no relative asset paths — it runs from a file:// URL,
 * an AirDrop, or a static host with equal indifference.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist-demo';
const FONTS = ['Baloo2-latin', 'Baloo2-latin-ext', 'Nunito-latin', 'Nunito-latin-ext'];

let html = readFileSync(join(DIST, 'index.html'), 'utf8');

for (const src of html.match(/src="[^"]+\.js"/g) ?? []) {
  const path = src.slice(5, -1);
  const code = readFileSync(join(DIST, path.replace(/^\.\//, '')), 'utf8');
  html = html.replace(
    `<script type="module" crossorigin ${src}></script>`,
    `<script type="module">\n${code}\n</script>`,
  );
}

for (const name of FONTS) {
  const b64 = readFileSync(join(DIST, 'fonts', `${name}.woff2`)).toString('base64');
  html = html.replaceAll(`./fonts/${name}.woff2`, `data:font/woff2;base64,${b64}`);
}

const leftovers = html.match(/"\.\/[^"]*\.(?:js|woff2)"/g);
if (leftovers) {
  console.error('Unresolved asset references remain:', leftovers);
  process.exit(1);
}

// demo/ is gitignored build output, so a fresh checkout won't have it yet.
mkdirSync('demo', { recursive: true });
writeFileSync('demo/index.html', html);
console.log(`demo/index.html — ${(html.length / 1024).toFixed(0)} kB, fully self-contained`);
