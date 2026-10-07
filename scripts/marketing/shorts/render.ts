// ═══════════════════════════════════════════════════════════════════════════
// SHORTS · Η ΕΝΤΟΛΗ
// ─────────────────────────────────────────────────────────────────────────
// ΧΡΗΣΗ:
//   npx tsx scripts/marketing/shorts/render.ts <spec-id>              ολόκληρο
//   npx tsx scripts/marketing/shorts/render.ts --date 2026-10-08      όσα έχει η μέρα
//     --audit       μόνο οι έλεγχοι (χωρίς περιηγητή οι πρώτοι, με περιηγητή οι υπόλοιποι)
//     --stills      στιγμιότυπα: κάθε σκηνή όταν κάθεται, τα αγκίστρια στα 0 / 0,4 / 0,8″,
//                   κάθε πέρασμα στη μέση του. Γράφει και το texts.md με το σενάριο
//     --at=1,5.5    και αυτές τις στιγμές
//     --hook=1      με το δεύτερο αγκίστρι (για σύγκριση)
//     --workers=4   παράθυρα λήψης
//     --fast        χωρίς τον έλεγχο «σκασίματος» καρέ καρέ (για επαναλήψεις)
// Θέλει ffmpeg με libx264 και libwebp (FFMPEG ή PATH).
//
// ΕΞΟΔΟΣ, docs/marketing/shorts/out/<ημερομηνία>-<ώρα>/:
//   <id>.mp4            το πρωτότυπο (CRF 16, AAC 192k)
//   <id>-upload.mp4     για ανέβασμα, < 28 MB
//   cover.jpg           το εξώφυλλο
//   hook.webp           τα πρώτα 3″, κινούμενα
//   texts.md            σενάριο, κείμενα κάθε πλατφόρμας, πηγές
// Στο git μπαίνουν ΜΟΝΟ το texts.md και το cover.jpg (.gitignore).
// ═══════════════════════════════════════════════════════════════════════════
import { mkdirSync, writeFileSync, existsSync, statSync, copyFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { FPS } from './kit';
import { build, page } from './engine';
import { score, writeWav } from './sound';
import { renderTexts, textsMd } from './texts';
import {
  gateDigits, gateCopy, gateLengths, gateStory, gateDeadAir, gateRubric, browserGates, gateLoop, gateAudio, report, failed, type Gate,
} from './qa';
import { frames, master, upload, hookWebp, sheets, openBrowser, openPage, renderAt } from './shoot';
import { ALL } from './specs';
import type { ShortSpec } from './spec';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const flag = (k: string) => args.includes(`--${k}`);
const opt = (k: string) => args.find(a => a.startsWith(`--${k}=`))?.split('=')[1];
const outDir = (s: ShortSpec) => join(ROOT, 'docs/marketing/shorts/out', `${s.date}-${s.slot.replace(':', '')}`);

function pick(): ShortSpec[] {
  const di = args.indexOf('--date');
  if (di >= 0) { const d = args[di + 1]; const xs = ALL.filter(s => s.date === d); if (!xs.length) throw new Error(`Κανένα short για ${d}.`); return xs; }
  const id = args.find(a => !a.startsWith('--'));
  if (!id) throw new Error('Δώσε id προδιαγραφής ή --date ΕΕΕΕ-ΜΜ-ΗΗ.');
  const s = ALL.find(x => x.id === id || x.id.startsWith(id));
  if (!s) throw new Error(`Άγνωστο short «${id}». Υπάρχουν: ${ALL.map(x => x.id).join(', ')}`);
  return [s];
}

async function one(spec: ShortSpec) {
  const t0 = Date.now();
  const hook = opt('hook') ? Number(opt('hook')) : spec.pick;
  const b = build(spec, hook);
  const pg = page(b);
  const dir = outDir(spec);
  mkdirSync(dir, { recursive: true });
  const tx = renderTexts(b);
  console.log(`\n■ ${spec.id} · ${b.dur.toFixed(1)}″ · ${b.scenes.length} σκηνές · ${pg.trs.map(x => x.name).join(' → ')}`);

  // 1 · Οι έλεγχοι χωρίς περιηγητή.
  const textMap = { 'YouTube τίτλος': tx.ytTitle, 'YouTube περιγραφή': tx.ytDesc, 'Instagram λεζάντα': tx.igCaption, 'Εναλλακτικό': tx.alt, 'TikTok λεζάντα': tx.ttCaption, 'Καρφιτσωμένο': tx.pinned, 'Ετικέτες': tx.ytTags.join(', ') };
  const pre: Gate[] = [gateDigits(spec), gateCopy(b, textMap), gateLengths({ ...tx, ytTags: tx.ytTags, igTags: tx.igTags }), gateStory(b, pg), gateDeadAir(b, pg), gateRubric(b)];
  console.log(report(pre).join('\n'));
  if (failed(pre)) throw new Error(`${spec.id}: οι έλεγχοι χωρίς περιηγητή απέτυχαν.`);

  // 2 · Στιγμιότυπα (και τα δύο αγκίστρια).
  if (flag('stills')) {
    const sd = join(dir, 'stills'); mkdirSync(sd, { recursive: true });
    const br = await openBrowser();
    try {
      for (let h = 0; h < spec.hooks.length; h++) {
        const bh = build(spec, h), ph = page(bh), p = await openPage(br, ph.html);
        for (const t of [0, .4, .8]) { await renderAt(p, t); await p.screenshot({ path: join(sd, `hook${h + 1}-${t.toFixed(1)}.png`) }); }
        await p.close();
      }
      const p = await openPage(br, pg.html);
      for (const [k, t] of pg.settle.entries()) { await renderAt(p, t); await p.screenshot({ path: join(sd, `scene${k + 1}.png`) }); }
      for (const [i, tr] of pg.trs.entries()) for (const d of [-tr.pre * .5, 0, tr.post * .4]) { await renderAt(p, tr.B + d); await p.screenshot({ path: join(sd, `tr${i + 1}-${tr.name}-${d >= 0 ? '+' : ''}${d.toFixed(2)}.png`) }); }
      for (const t of (opt('at') ?? '').split(',').filter(Boolean).map(Number)) { await renderAt(p, t); await p.screenshot({ path: join(sd, `at-${t}.png`) }); }
    } finally { await br.close(); }
    writeFileSync(join(dir, 'texts.md'), textsMd(b, pg, tx));
    console.log(`  ✓ στιγμιότυπα στο ${sd}`);
    if (!flag('audit')) return;
  }

  // 3 · Οι έλεγχοι στη σελίδα.
  const br = await openBrowser();
  let post: Gate[];
  try {
    const p = await openPage(br, pg.html);
    const r = await browserGates(p, b, pg, b.f, { pop: !flag('fast') });
    post = r.gates;
    console.log('\n  σκηνή  στοιχεία  ακμή  κοινή  ρυθμός  κενά  εικον.  κέντρο  τίτλος→  χρήση  πάνω  κάτω(1536)');
    for (const { k, row } of r.layout) {
      const x = row as { n: number; edge: number; share: number; gap: number; cx: number; rhythm?: number; icon?: number; center?: number; top?: number; bottom?: number; hgap?: number; used?: number; ratio?: number; above?: number; below?: number; fails: string[] };
      console.log(`  ${String(k + 1).padStart(5)} ${String(x.n).padStart(9)} ${x.edge.toFixed(1).padStart(5)} ${x.share.toFixed(1).padStart(6)} ${(x.rhythm ?? 0).toFixed(1).padStart(7)} ${x.gap.toFixed(1).padStart(5)} ${(x.icon ?? 0).toFixed(1).padStart(6)} ${String(x.center ?? '').padStart(7)} ${String(x.hgap ?? '').padStart(8)} ${(x.ratio != null ? Math.round(x.ratio * 100) + '%' : '').padStart(6)} ${String(x.above ?? '').padStart(5)} ${String(x.below ?? '').padStart(11)}  ${x.fails.length ? '✗' : '✓'}`);
    }
    console.log(report(post).join('\n'));
    if (!flag('audit')) { const cv = pg.settle[spec.cover]; await renderAt(p, cv); await p.screenshot({ path: join(dir, 'cover.jpg'), type: 'jpeg', quality: 92 }); }
  } finally { await br.close(); }
  if (failed(post)) throw new Error(`${spec.id}: οι έλεγχοι στη σελίδα απέτυχαν.`);
  if (flag('audit')) { writeFileSync(join(dir, 'texts.md'), textsMd(b, pg, tx, { gates: [...report(pre), ...report(post)] })); return; }

  // 4 · Καρέ, ήχος, κωδικοποίηση.
  const fd = join(dir, 'frames');
  await frames(pg.html, b.dur, fd, Number(opt('workers') ?? 4));
  const wav = join(dir, 'sound.wav');
  const m = score(b, pg);
  const { peakDb } = writeWav(m, wav);
  console.log(`  ✓ ήχος, κορυφή WAV ${peakDb.toFixed(2)} dBFS`);
  const mp4 = join(dir, `${spec.id}.mp4`), up = join(dir, `${spec.id}-upload.mp4`);
  master(fd, wav, mp4);
  const u = upload(mp4, b.dur, up);
  hookWebp(mp4, join(dir, 'hook.webp'));
  const last = join(fd, `${String(Math.round(b.dur * FPS) - 1).padStart(5, '0')}.jpg`);
  const fin: Gate[] = [gateLoop(join(fd, '00000.jpg'), last), gateAudio(mp4), gateAudio(up)];
  console.log(report(fin).join('\n'));
  sheets(mp4, join(dir, 'qa'), pg.trs, b.dur);
  copyFileSync(join(fd, '00000.jpg'), join(dir, 'qa', 'first.jpg')); copyFileSync(last, join(dir, 'qa', 'last.jpg'));
  const files = [
    `\`${spec.id}.mp4\`: πρωτότυπο, ${(statSync(mp4).size / 1e6).toFixed(1)} MB (έξω από το git)`,
    `\`${spec.id}-upload.mp4\`: για ανέβασμα, ${u.mb.toFixed(1)} MB${u.kbps ? `, H.264 δύο περασμάτων ${u.kbps} kbps` : ', ίδιο με το πρωτότυπο (χωρά ήδη κάτω από 28 MB)'} (έξω από το git)`,
    '`cover.jpg`: εξώφυλλο', '`hook.webp`: τα πρώτα 3″ (έξω από το git)', '`qa/`: φύλλα ελέγχου κίνησης (έξω από το git)',
  ];
  writeFileSync(join(dir, 'texts.md'), textsMd(b, pg, tx, { files, gates: [...report(pre), ...report(post), ...report(fin)] }));
  if (failed(fin)) throw new Error(`${spec.id}: οι έλεγχοι του αρχείου απέτυχαν.`);
  if (!flag('keep-frames')) rmSync(fd, { recursive: true, force: true });
  console.log(`✓ ${mp4}\n✓ ${up} (${u.mb.toFixed(1)} MB)\n  σε ${((Date.now() - t0) / 60000).toFixed(1)}′`);
  void existsSync;
}

async function main() {
  for (const s of pick()) await one(s);
}
main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
