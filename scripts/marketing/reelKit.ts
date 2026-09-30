// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΕΡΓΑΣΤΗΡΙΟ ΤΩΝ REELS
// ─────────────────────────────────────────────────────────────────────────
// Ό,τι χρειάζεται κάθε reel και δεν αλλάζει από το ένα στο άλλο:
//   • η βάση της σελίδας (γραμματοσειρές, κόκκος, βινιέτα, μάσκες),
//   • οι βοηθοί κίνησης μέσα στη σελίδα (καμπύλες, ελατήριο, μάσκα),
//   • ο έλεγχος των ζωνών του Instagram,
//   • η λήψη: τέσσερα παράθυρα, 60 καρέ το δευτερόλεπτο, ένωση ανά δύο σε 30
//     με θόλωμα κίνησης, κωδικοποίηση H.264.
//
// Η σελίδα κάθε reel ορίζει μόνο μία συνάρτηση, την `window.render(t)`, που
// στήνει την κατάσταση της στιγμής t. Κανένα κινούμενο σχέδιο δεν παίζει
// μόνο του: ίδιο αποτέλεσμα σε κάθε τρέξιμο, κανένα χαμένο καρέ.
// ═══════════════════════════════════════════════════════════════════════════
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { C, FACES, MONO_FACES, GRAIN } from './igKit';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
type Page = import('playwright-core').Page;
const { chromePath } = require('../lib/chrome.mjs');

export const W = 1080, H = 1920;

/** Η βάση κάθε σελίδας reel. */
export const BASE_CSS = `${FACES}${MONO_FACES}
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:${W}px;height:${H}px;overflow:hidden;background:${C.ground}}
  body{font-family:Inter,system-ui,sans-serif;color:${C.ink};position:relative;-webkit-font-smoothing:antialiased;
    font-feature-settings:"cv11","ss01";font-variant-numeric:tabular-nums}
  #bg{position:absolute;inset:0}
  .grain{position:absolute;inset:0;background-image:${GRAIN};opacity:.07;mix-blend-mode:overlay;pointer-events:none}
  .vig{position:absolute;inset:0;background:radial-gradient(130% 90% at 50% 45%, transparent 55%, #000000a0 100%);pointer-events:none}
  section{position:absolute;inset:0;opacity:0}
  .mono{font-family:'Roboto Mono',monospace;letter-spacing:.14em;font-weight:500}
  .L{position:absolute;left:90px}
  .mk{overflow:hidden;padding-bottom:.1em;margin-bottom:-.1em}
  .mi{will-change:transform}
  .acc{color:${C.accent}}`;

/** Το ίδιο φόντο σε κάθε reel: δύο λάμψεις που δεν στέκονται ποτέ στο ίδιο σημείο. */
export const BG_JS = `
  const bgPaint = t => {
    const gx = 76 + Math.sin(t * .3) * 10, gy = 10 + Math.cos(t * .27) * 5;
    document.getElementById('bg').style.background =
      'radial-gradient(900px 760px at ' + gx + '% ' + gy + '%, ${C.accent}30, transparent 70%),' +
      'radial-gradient(1100px 900px at ' + (10 + Math.sin(t * .22) * 8) + '% 70%, #3d5fa026, transparent 72%),' +
      'linear-gradient(180deg, #0b1322 0%, ${C.ground} 58%)';
  };`;

/** Οι βοηθοί κίνησης, μέσα στη σελίδα. Το `T` είναι η τρέχουσα στιγμή. */
export const MOTION_JS = `
  const $ = id => document.getElementById(id);
  const cl = x => Math.max(0, Math.min(1, x));
  const p = (t, a, b) => cl((t - a) / (b - a));
  const eo = x => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));          // εκθετική έξοδος: γρήγορη αρχή, βελούδινο τέλος
  const ei = x => x * x * x;
  const eio = x => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const spring = x => (x <= 0 ? 0 : 1 - Math.exp(-6 * x) * Math.cos(8.5 * x));   // με μικρή υπερακόντιση
  const lerp = (a, b, k) => a + (b - a) * k;
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, k) => { const x = hex(a), y = hex(b); return 'rgb(' + x.map((v, i) => Math.round(v + (y[i] - v) * k)).join(',') + ')'; };
  const tf = (el, s) => { el.style.transform = s; };
  const op = (el, o) => { el.style.opacity = o; };
  let T = 0;
  // Μάσκα: μπαίνει από κάτω, βγαίνει προς τα πάνω.
  const rev = (id, tin, tout, dur) => {
    const el = $(id), d = dur || .6;
    const a = eo(p(T, tin, tin + d));
    const b = tout == null ? 0 : ei(p(T, tout, tout + .3));
    tf(el, 'translateY(' + (110 * (1 - a) - 110 * b) + '%)');
    op(el, a > 0 && b < 1 ? 1 : 0);
  };`;

/** Κείμενο που βγαίνει από μάσκα: το εξωτερικό κόβει, το εσωτερικό ανεβαίνει. */
export const mask = (id: string, inner: string, cls = '') => `<div class="mk ${cls}"><div class="mi" id="${id}">${inner}</div></div>`;

// Ως κείμενο: το tsx ντύνει τις ονομασμένες συναρτήσεις με έναν βοηθό (__name)
// που μέσα στον περιηγητή δεν υπάρχει.
const SAFE_CHECK = `(() => {
  const out = [];
  const visible = el => { for (let e = el; e; e = e.parentElement) if (Number(getComputedStyle(e).opacity) < .5) return false; return true; };
  for (const el of Array.from(document.querySelectorAll('section *'))) {
    // Διακόσμηση και ψηφία κοντέρ: τα κρύβει το παράθυρό τους, όχι η διαφάνεια.
    if (el.closest('.deco') || el.closest('.strip')) continue;
    const own = Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim());
    if (!own || !visible(el)) continue;
    const r = el.getBoundingClientRect();
    const right = r.bottom > 1100 ? 940 : 1000;
    if (r.left < 80 || r.right > right || r.top < 250 || r.bottom > 1500)
      out.push(el.textContent.trim().slice(0, 28) + ' [' + Math.round(r.left) + ',' + Math.round(r.top) + '–' + Math.round(r.right) + ',' + Math.round(r.bottom) + ']');
  }
  return out;
})()`;

export interface Shoot {
  html: string;
  dur: number;
  /** Φάκελος του βίντεο (έξω από το git). */
  outDir: string;
  /** Όνομα του σιωπηλού βίντεο. */
  file: string;
  /** Στιγμές στις οποίες ελέγχονται οι ζώνες του Instagram. */
  checkAt: number[];
  /** Εξώφυλλο: στιγμή, διαδρομή και προαιρετικό JS που στήνει το καρέ για το πλέγμα. */
  cover?: { t: number; path: string; prep?: string };
}

/**
 * Φωτογραφίζει το reel καρέ καρέ και το κωδικοποιεί.
 * REEL_PREVIEW=0.5,4,11 → μόνο στιγμιότυπα, για να κριθεί η σύνθεση πριν από τα καρέ.
 */
export async function shoot(s: Shoot): Promise<void> {
  const FFMPEG = process.env.FFMPEG || 'ffmpeg';
  mkdirSync(s.outDir, { recursive: true });
  const browser = await chromium.launch({ executablePath: chromePath(), args: ['--no-sandbox'] });
  try {
    const open = async () => {
      const pg = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
      await pg.setContent(s.html, { waitUntil: 'load' });
      await pg.evaluate(() => document.fonts.ready);
      return pg;
    };
    const page = await open();
    const at = (pg: Page, t: number) => pg.evaluate((x: number) => (window as unknown as { render: (t: number) => void }).render(x), t);

    if (process.env.REEL_PREVIEW) {
      for (const t of process.env.REEL_PREVIEW.split(',').map(Number)) {
        await at(page, t);
        await page.screenshot({ path: join(s.outDir, `preview-${t}.png`) });
      }
      if (s.cover) {
        await at(page, s.cover.t);
        if (s.cover.prep) await page.evaluate(s.cover.prep);
        await page.screenshot({ path: join(s.outDir, 'preview-cover.png') });
      }
      return;
    }

    const bad: string[] = [];
    for (const t of s.checkAt) { await at(page, t); bad.push(...((await page.evaluate(SAFE_CHECK)) as string[]).map(m => `${t}s: ${m}`)); }
    if (bad.length) throw new Error(`Έξω από τις ζώνες:\n  ${bad.slice(0, 30).join('\n  ')}`);

    if (s.cover) {
      await at(page, s.cover.t);
      if (s.cover.prep) await page.evaluate(s.cover.prep);
      await page.screenshot({ path: s.cover.path, type: 'jpeg', quality: 94 });
      // Το εξώφυλλο στήνεται στην ίδια σελίδα: ξαναφορτώνεται καθαρή για τα καρέ.
      if (s.cover.prep) { await page.setContent(s.html, { waitUntil: 'load' }); await page.evaluate(() => document.fonts.ready); }
    }

    const CAPTURE = 60, frames = Math.round(s.dur * CAPTURE);
    const dir = join(s.outDir, 'frames');
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const WORKERS = 4;
    let done = 0;
    await Promise.all(Array.from({ length: WORKERS }, async (_, w) => {
      const pg = w === 0 ? page : await open();
      for (let f = w; f < frames; f += WORKERS) {
        await at(pg, f / CAPTURE);
        await pg.screenshot({ path: join(dir, `${String(f).padStart(5, '0')}.png`) });
        if (++done % 200 === 0) console.log(`  καρέ ${done}/${frames}`);
      }
    }));
    const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-framerate', String(CAPTURE), '-i', join(dir, '%05d.png'),
      '-vf', "tmix=frames=2:weights='1 1',fps=30",
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
      '-movflags', '+faststart', join(s.outDir, s.file)], { stdio: 'inherit' });
    if ((await new Promise<number>(r => ff.on('close', r))) !== 0) throw new Error('Το ffmpeg απέτυχε.');
    rmSync(dir, { recursive: true, force: true });
    console.log(`✓ ${join(s.outDir, s.file)}`);
  } finally {
    await browser.close();
  }
}
