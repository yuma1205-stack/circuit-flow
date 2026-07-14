// Production build: pre-compile the in-browser JSX and inline React so the
// published page needs no CDN and no runtime Babel.
//
//   dev   : open index.html directly (CDN React + in-browser Babel)
//   build : npm run build  ->  dist/index.html (self-contained, minified)

const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');
const { minify } = require('terser');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'index.html');
const OUT_DIR = path.join(ROOT, 'dist');
const OUT = path.join(OUT_DIR, 'index.html');

async function main() {
  const html = fs.readFileSync(SRC, 'utf8');

  // 1. Extract the inline JSX program
  const openTag = '<script type="text/babel">';
  const start = html.indexOf(openTag);
  if (start < 0) throw new Error('Could not find <script type="text/babel"> in index.html');
  const codeStart = start + openTag.length;
  const codeEnd = html.indexOf('</script>', codeStart);
  if (codeEnd < 0) throw new Error('Unterminated babel script block');
  const jsx = html.slice(codeStart, codeEnd);

  // 2. JSX -> JS (classic runtime: uses the global React from the UMD bundle)
  const { code: compiled } = babel.transformSync(jsx, {
    presets: [['@babel/preset-react', { runtime: 'classic' }]],
    compact: false,
    babelrc: false,
    configFile: false,
  });

  // 3. Minify the app code
  const { code: appMin } = await minify(compiled, {
    ecma: 2020,
    compress: { passes: 2 },
    mangle: true,
  });

  // 4. Pull in React production UMD bundles
  const react = fs.readFileSync(
    path.join(ROOT, 'node_modules/react/umd/react.production.min.js'), 'utf8');
  const reactDom = fs.readFileSync(
    path.join(ROOT, 'node_modules/react-dom/umd/react-dom.production.min.js'), 'utf8');

  // Literal replace (split/join) — String.replace would interpret `$` patterns
  // inside the minified React source and corrupt it.
  const swap = (s, find, repl) => s.split(find).join(repl);

  // 5. Split around the babel block using indices from the ORIGINAL html,
  //    then mutate the head independently (avoids index drift).
  let pre = html.slice(0, start);
  const post = html.slice(codeEnd + '</script>'.length);

  pre = swap(pre,
    '<script src="https://unpkg.com/react@18/umd/react.development.js"></script>',
    '<script>' + react + '</script>');
  pre = swap(pre,
    '<script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>',
    '<script>' + reactDom + '</script>');
  pre = swap(pre,
    '<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>', '');

  // 6. Reassemble with the compiled, minified app program
  const out = pre + '<script>' + appMin + '</script>' + post;

  // 7. Emit
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT, out);

  // 8. Copy PWA assets (manifest, service worker, icon)
  for (const file of ['manifest.json', 'sw.js', 'icon.svg']) {
    const src = path.join(ROOT, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(OUT_DIR, file));
    }
  }

  const kb = n => (n / 1024).toFixed(1) + ' KB';
  console.log('Build OK -> dist/index.html');
  console.log('  source html : ' + kb(html.length));
  console.log('  app (jsx->min): ' + kb(jsx.length) + ' -> ' + kb(appMin.length));
  console.log('  output html : ' + kb(out.length) + ' (self-contained, no CDN, no Babel)');
  console.log('  PWA assets   : manifest.json, sw.js, icon.svg copied');
}

main().catch(e => { console.error(e); process.exit(1); });
