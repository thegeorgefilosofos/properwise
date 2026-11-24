// Απόδοση της ταινίας με τη συνταγή του kinisi (references/texniki.md).
//
//   CHROMIUM_PATH=… node render.mjs stills <916|45> <out.png> <t1,t2,…> [scale]
//       καρέ σε δευτερόλεπτα, σε φύλλο επαφής (για τον έλεγχο ανά χτύπο)
//   CHROMIUM_PATH=… node render.mjs draft <916|45> <out.mp4>
//       πρόχειρο 1×, ένα καρέ ανά καρέ, χωρίς θόλωμα κίνησης
//   CHROMIUM_PATH=… node render.mjs full <916|45> <out.mp4> [από καρέ] [ως καρέ]
//       λήψη 3×, 4 υποκαρέ, σ0,5 πριν από τη σμίκρυνση lanczos, x264 της συνταγής.
//       v8: το καρέ 0 είναι το αγκίστρι (render(0)). Το εξώφυλλο βγαίνει χωριστά, με το stills.
//
// Τα PNG δεν γράφονται στον δίσκο: περνούν από σωλήνα στο ffmpeg.
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const [mode, fmt = '916', out, a4, a5] = process.argv.slice(2);
const W = 1080, H = fmt === '45' ? 1350 : 1920;
// «s1» έως «s3» αποδίδουν τα stories teaser (9:16, film.html?s=N).
// «s1x» έως «s3x»: το ίδιο story χωρίς το σημάδι «N/5», για τη μέτρηση ότι τίποτα δεν το ακουμπά (v18).
const story = /^s[1-3]x?$/.test(fmt) ? fmt.slice(1, 2) : null, nomark = /x$/.test(fmt);

// Ο διακομιστής: public/ ως ρίζα (για τα /fonts), το app/globals.css ως /globals.css, ο φάκελος της ταινίας στο /.
const TYPES = { '.svg': 'image/svg+xml', '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.js': 'text/javascript' };
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let f;
  if (p === '/globals.css') f = join(root, 'app/globals.css');
  else if (p.startsWith('/fonts/') || p.startsWith('/brand/')) f = join(root, 'public', p);
  else f = join(here, p);
  if (!f.startsWith(root) || !existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/film.html?f=${story ? '916' : fmt}${story ? '&s=' + story : ''}${nomark ? '&nomark=1' : ''}${process.env.QA ? '&qa=1' : ''}`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--disable-dev-shm-usage'] });   // μεγάλες εικόνες: όχι στο μικρό /dev/shm
async function openPage(dsf) {
  const pg = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: dsf });
  pg.on('pageerror', (e) => console.error('σφάλμα σελίδας:', e.message));
  await pg.goto(url, { waitUntil: 'networkidle' });
  await pg.evaluate(() => window.ready());
  const cdp = await pg.context().newCDPSession(pg);
  return { pg, cdp };
}
async function grab({ pg, cdp }, t) {
  await pg.evaluate((t) => window.render(t), t);
  await pg.evaluate(() => document.fonts.ready);
  // Η λήψη αποτυγχάνει σπάνια με «Unable to capture screenshot»: ξαναδοκίμασε στο ίδιο t.
  for (let k = 0; ; k++) {
    try { const r = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true }); return Buffer.from(r.data, 'base64'); }
    catch (e) { if (k >= 4) throw e; await new Promise((ok) => setTimeout(ok, 400)); await pg.evaluate((t) => window.render(t), t); }
  }
}
const run = (args, input) => new Promise((ok, no) => {
  const p = spawn('ffmpeg', args, { stdio: [input ? 'pipe' : 'ignore', 'inherit', 'inherit'] });
  p.on('exit', (c) => (c === 0 ? ok() : no(new Error('ffmpeg ' + c))));
  if (input) input(p.stdin);
});
const write = (stdin, buf) => new Promise((r) => (stdin.write(buf) ? r() : stdin.once('drain', r)));

const X264 = ['-c:v', 'libx264', '-crf', '12', '-preset', 'slow', '-tune', 'stillimage', '-profile:v', 'high', '-level', '4.2',
  '-x264-params', 'keyint=300:min-keyint=30:scenecut=40:deblock=-2,-2:aq-mode=3:psy-rd=1.0,0',
  '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];

// Η φόρτωση των μεγάλων εικόνων ρίχνει καμιά φορά τη σελίδα: ξαναδοκίμασε σε νέα σελίδα.
let s;
for (let k = 0; ; k++) {
  try { s = await openPage(mode === 'full' ? 3 : 1); break; }
  catch (e) { if (k >= 3) throw e; console.error('νέα προσπάθεια φόρτωσης:', e.message.split('\n')[0]); }
}
const TL = await s.pg.evaluate(() => window.TL);
const FPS = TL.fps, N = Math.round(TL.dur * FPS);

if (mode === 'stills') {
  const ts = a4.split(',').map(Number), scale = Number(a5 || 0.25);
  const cols = Math.min(8, ts.length), rows = Math.ceil(ts.length / cols);
  await run(['-y', '-v', 'error', '-f', 'image2pipe', '-c:v', 'png', '-i', '-',
    '-vf', `scale=${Math.round(W * scale)}:-1,tile=${cols}x${rows}:padding=6:color=gray`, '-frames:v', '1', out], async (stdin) => {
    for (const t of ts) await write(stdin, await grab(s, t));
    stdin.end();
  });
} else if (mode === 'draft') {
  await run(['-y', '-v', 'error', '-framerate', String(FPS), '-f', 'image2pipe', '-c:v', 'png', '-i', '-',
    '-vf', 'format=yuv420p', '-c:v', 'libx264', '-crf', '20', '-preset', 'veryfast', out], async (stdin) => {
    for (let i = 0; i < N; i++) await write(stdin, await grab(s, i / FPS));
    stdin.end();
  });
} else if (mode === 'crisp') {
  // v5: ένα δείγμα ανά καρέ (κανένα θόλωμα κίνησης), λήψη 3× και σμίκρυνση lanczos (κανένα gblur),
  // x264 -crf 14 -tune animation με όριο 14 Mbps. Το καρέ 0 είναι το αγκίστρι.
  const from = Number(a4 || 0), to = Number(a5 || N);
  const t0 = Date.now();
  await run(['-y', '-v', 'error', '-framerate', String(FPS), '-f', 'image2pipe', '-c:v', 'png', '-i', '-',
    '-vf', `scale=${W}:${H}:flags=lanczos+accurate_rnd+full_chroma_int,format=yuv420p`,
    '-r', String(FPS), '-c:v', 'libx264', '-crf', '14', '-preset', 'slow', '-tune', 'animation', '-profile:v', 'high', '-level', '4.2',
    '-maxrate', '14M', '-bufsize', '28M', '-x264-params', 'keyint=300:min-keyint=30:scenecut=40',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-an', out], async (stdin) => {
    for (let i = from; i < to; i++) {
      await write(stdin, await grab(s, i / FPS));
      if (i % 60 === 0) console.log(`καρέ ${i}/${to} · ${((Date.now() - t0) / 1000).toFixed(0)}″`);
    }
    stdin.end();
  });
} else if (mode === 'full') {
  const from = Number(a4 || 0), to = Number(a5 || N);
  if (from % 1 || to % 1) throw new Error('ακέραια καρέ');
  let shots = 0;
  const t0 = Date.now();
  await run(['-y', '-v', 'error', '-framerate', '120', '-f', 'image2pipe', '-c:v', 'png', '-i', '-',
    '-vf', `gblur=sigma=0.5,scale=${W}:${H}:flags=lanczos,tmix=frames=4:weights='1 1 1 1',select='eq(mod(n\\,4)\\,3)',setpts=N/(30*TB),format=yuv420p`,
    '-r', '30', ...X264, '-an', out], async (stdin) => {
    for (let i = from; i < to; i++) {
      // Υποκαρέ γύρω από τον χρόνο του καρέ: (k − 1,5)/120. Το καρέ 0 είναι το εξώφυλλο.
      const base = i / FPS;
      const ts = [0, 1, 2, 3].map((k) => base + (k - 1.5) / 120);
      // Αν τίποτα δεν κινείται ανάμεσα στα υποκαρέ, μία λήψη αρκεί για τα τέσσερα.
      const sigs = await s.pg.evaluate((ts) => ts.map((t) => window.render(t)), ts);
      if (sigs.every((x) => x === sigs[0])) {
        const b = await grab(s, ts[0]); shots++;
        for (let k = 0; k < 4; k++) await write(stdin, b);
      } else {
        for (const t of ts) { await write(stdin, await grab(s, t)); shots++; }
      }
      if (i % 60 === 0) console.log(`καρέ ${i}/${to} · λήψεις ${shots} · ${((Date.now() - t0) / 1000).toFixed(0)}″`);
    }
    stdin.end();
  });
}
await browser.close();
server.close();
process.exit(0);
