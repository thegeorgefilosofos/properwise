// ═══════════════════════════════════════════════════════════════════════════
// SHORTS · Η ΛΗΨΗ ΚΑΙ Η ΚΩΔΙΚΟΠΟΙΗΣΗ
// ─────────────────────────────────────────────────────────────────────────
// Η λήψη του reelKit (shoot) κάνει ό,τι χρειάζεται ένα reel, αλλά ξεκινά από
// την αρχή κάθε φορά: ένα short θέλει ~25 λεπτά και το container μπορεί να
// ξαναξεκινήσει στη μέση. Εδώ τα καρέ γράφονται ως JPEG (q95) στον φάκελο
// `frames/` και κάθε τρέξιμο φωτογραφίζει ΜΟΝΟ όσα λείπουν ή κόπηκαν. Το
// reelKit δεν αγγίζεται.
// ═══════════════════════════════════════════════════════════════════════════
import { existsSync, mkdirSync, openSync, readSync, closeSync, statSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { FPS, H, W } from './kit';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const { chromePath } = require('../../lib/chrome.mjs');
type Pg = import('playwright-core').Page;
type Browser = import('playwright-core').Browser;

export const FF = () => process.env.FFMPEG || 'ffmpeg';
const ff = (args: string[], what: string) => {
  const r = spawnSync(FF(), ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`Το ffmpeg απέτυχε: ${what}.`);
};

export async function openBrowser(): Promise<Browser> {
  return chromium.launch({ executablePath: chromePath(), args: ['--no-sandbox', '--disable-gpu', '--font-render-hinting=none'] });
}
export async function openPage(b: Browser, html: string): Promise<Pg> {
  const pg = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await pg.setContent(html, { waitUntil: 'load' });
  await pg.evaluate(() => document.fonts.ready);
  await pg.evaluate('window.render(0)');
  return pg;
}
export const renderAt = (pg: Pg, t: number) => pg.evaluate((x: number) => (window as unknown as { render: (t: number) => void }).render(x), t);

/** Ολόκληρο JPEG: τελειώνει σε FF D9. Ό,τι κόπηκε στη μέση ξαναφωτογραφίζεται. */
function whole(path: string): boolean {
  if (!existsSync(path)) return false;
  const sz = statSync(path).size; if (sz < 1000) return false;
  const fd = openSync(path, 'r'), buf = Buffer.alloc(2); readSync(fd, buf, 0, 2, sz - 2); closeSync(fd);
  return buf[0] === 0xff && buf[1] === 0xd9;
}

/** Τα καρέ: μόνο όσα λείπουν, μοιρασμένα σε `workers` παράθυρα. */
export async function frames(html: string, dur: number, dir: string, workers = 4, log = (s: string) => console.log(s)): Promise<number> {
  mkdirSync(dir, { recursive: true });
  const N = Math.round(dur * FPS);
  const todo = Array.from({ length: N }, (_, i) => i).filter(i => !whole(join(dir, `${String(i).padStart(5, '0')}.jpg`)));
  log(`  καρέ: ${N - todo.length}/${N} υπάρχουν, ${todo.length} για λήψη (${workers} παράθυρα)`);
  if (!todo.length) return N;
  const browser = await openBrowser();
  const t0 = Date.now();
  let done = 0;
  try {
    await Promise.all(Array.from({ length: workers }, async (_, w) => {
      const pg = await openPage(browser, html);
      for (let j = w; j < todo.length; j += workers) {
        const i = todo[j];
        await renderAt(pg, i / FPS);
        await pg.screenshot({ path: join(dir, `${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 95 });
        if (++done % 150 === 0) { const s = (Date.now() - t0) / 1000; log(`  καρέ ${done}/${todo.length} · ${(s / done).toFixed(2)}″ το καρέ · απομένουν ~${Math.round((todo.length - done) * s / done / 60)}′`); }
      }
    }));
  } finally { await browser.close(); }
  writeFileSync(join(dir, 'TIME.txt'), `${todo.length} καρέ σε ${((Date.now() - t0) / 1000).toFixed(0)}″ με ${workers} παράθυρα\n`);
  return N;
}

const X264 = ['-c:v', 'libx264', '-profile:v', 'high', '-level:v', '4.1', '-pix_fmt', 'yuv420p', '-g', '60', '-keyint_min', '60', '-sc_threshold', '0',
  '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];

/** Το πρωτότυπο: CRF 16, με τον ήχο. */
export function master(dir: string, wav: string, out: string) {
  ff(['-framerate', String(FPS), '-i', join(dir, '%05d.jpg'), '-i', wav, '-map', '0:v', '-map', '1:a', ...X264, '-preset', 'slow', '-crf', '16', '-maxrate', '14M', '-bufsize', '20M',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-shortest', '-movflags', '+faststart', out], 'πρωτότυπο');
}

/** Το αντίγραφο για ανέβασμα, κάτω από 28 MB: H.264 δύο περασμάτων, AAC 192k (όπως το reelKathara). */
export function upload(src: string, dur: number, out: string) {
  // Αν το πρωτότυπο χωρά ήδη, το αντίγραφο είναι το ίδιο (αντιγραφή ροών): κανένα δεύτερο πέρασμα κωδικοποίησης.
  const src0 = statSync(src).size / 1e6;
  if (src0 < 27.5) { ff(['-i', src, '-c', 'copy', '-movflags', '+faststart', out], 'αντίγραφο'); return { mb: statSync(out).size / 1e6, kbps: 0 }; }
  const log = join(out.replace(/[^/]+$/, ''), 'x264pass');
  const kbps = Math.min(9000, Math.floor((27.5e6 * 8 / dur - 192e3 - 30e3) / 1000));
  const v = [...X264, '-preset', 'slow', '-b:v', `${kbps}k`, '-maxrate', '12M', '-bufsize', '16M', '-passlogfile', log];
  ff(['-i', src, ...v, '-pass', '1', '-an', '-f', 'mp4', '/dev/null'], 'πρώτο πέρασμα');
  ff(['-i', src, '-map', '0:v', '-map', '0:a', ...v, '-pass', '2', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', out], 'δεύτερο πέρασμα');
  for (const f of readdirSync(out.replace(/[^/]+$/, ''))) if (f.startsWith('x264pass')) rmSync(join(out.replace(/[^/]+$/, ''), f));
  const mb = statSync(out).size / 1e6;
  if (mb >= 28) throw new Error(`Το αντίγραφο είναι ${mb.toFixed(1)} MB.`);
  return { mb, kbps };
}

/** Τα πρώτα τρία δευτερόλεπτα ως κινούμενο WebP: η προεπισκόπηση του αγκιστριού. */
export function hookWebp(src: string, out: string) {
  ff(['-t', '3', '-i', src, '-vf', 'fps=15,scale=540:-1:flags=lanczos', '-c:v', 'libwebp_anim', '-quality', '80', '-loop', '0', '-an', out], 'WebP');
}

/** Φύλλα ελέγχου: ένα καρέ κάθε δευτερόλεπτο και καρέ καρέ γύρω από κάθε πέρασμα. */
export function sheets(src: string, dir: string, trs: { name: string; B: number; pre: number; post: number }[], dur: number) {
  mkdirSync(dir, { recursive: true });
  const n = Math.ceil(dur);
  // Ένα καρέ στο μέσο κάθε δευτερολέπτου, δέκα ανά γραμμή (το ffmpeg-static δεν έχει drawtext: η θέση λέει τον χρόνο).
  ff(['-ss', '0.5', '-i', src, '-vf', `fps=1,scale=270:-1,tile=10x${Math.ceil(n / 10)}:padding=4:color=white`, '-frames:v', '1', join(dir, 'ana-1s.jpg')], 'φύλλο ανά δευτερόλεπτο');
  trs.forEach((tr, i) => {
    const a = Math.max(0, tr.B - tr.pre - 2 / FPS), len = tr.pre + tr.post + 4 / FPS, cnt = Math.round(len * FPS);
    ff(['-ss', a.toFixed(3), '-t', len.toFixed(3), '-i', src, '-vf', `scale=270:-1,tile=${Math.min(8, cnt)}x${Math.ceil(cnt / 8)}`, '-frames:v', '1', join(dir, `perasma-${i + 1}-${tr.name}.jpg`)], `φύλλο περάσματος ${tr.name}`);
  });
}

