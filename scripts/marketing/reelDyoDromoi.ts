// ═══════════════════════════════════════════════════════════════════════════
// INSTAGRAM · «ΙΔΙΟ ΔΙΑΜΕΡΙΣΜΑ, ΔΥΟ ΔΡΟΜΟΙ»: REEL, ΕΞΙ STORIES, ΕΞΩΦΥΛΛΟ
// ─────────────────────────────────────────────────────────────────────────
// ΧΡΗΣΗ:
//   npx tsx scripts/marketing/reelDyoDromoi.ts [--out=<φάκελος>] [--stills] [--fast] [--no-video]
//     --out        πού γράφονται βίντεο, εικόνες και texts.md (προεπιλογή docs/marketing/reels/ig-dyo-dromoi, έξω από το git)
//     --stills     και στιγμιότυπα κάθε σκηνής και κάθε περάσματος
//     --fast       χωρίς τον έλεγχο «σκασίματος» καρέ καρέ
//     --no-video   μόνο έλεγχοι, stories και εξώφυλλο
// Θέλει ffmpeg με libx264 (FFMPEG ή PATH).
//
// Κάθε αριθμός βγαίνει τη στιγμή της παραγωγής από το dyoDromoiFacts.ts. Πριν
// γραφτεί οτιδήποτε τρέχουν: οι αυτοέλεγχοι των γεγονότων, το «κανένα ψηφίο έξω
// από γεγονός» (σελίδα, stories, εξώφυλλο), το «καμία επανάληψη του χθεσινού»
// και οι έλεγχοι της μηχανής των shorts (στοίχιση, ζώνες, αντίθεση, χρώματα,
// ιχνηλασία, βρόχος, ήχος).
//
// ΕΞΟΔΟΣ: reel.mp4 · reel-upload.mp4 · cover.jpg (+ οι περικοπές 4:5 και 3:4) ·
// story-1.png … story-6.png · texts.md · contact-reel.png · contact-stories.png.
// Στο αποθετήριο, docs/marketing/instagram/reel-dyo-dromoi/: README.md,
// caption.md, stories.md και cover.jpg.
// ═══════════════════════════════════════════════════════════════════════════
import { mkdirSync, writeFileSync, copyFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { FPS, SERIES, plain } from './shorts/kit';
import { build, page } from './shorts/engine';
import { score, writeWav } from './shorts/sound';
import { renderTexts, storyboard, utmUrl } from './shorts/texts';
import { gateDigits, gateCopy, gateLengths, gateStory, gateDeadAir, gateRubric, browserGates, gateLoop, gateAudio, report, failed, type Gate } from './shorts/qa';
import { frames, master, upload, openBrowser, openPage, renderAt, FF } from './shorts/shoot';
import { validTo } from './shorts/facts';
import { TRANSITIONS } from './shorts/transitions';
import { DYO_DROMOI as SPEC } from './shorts/specs/ig-dyo-dromoi';
import { assertNoRepeat } from './dyoDromoiFacts';
import { stories, coverHtml, assertDigitsFromFacts, pageQa, type Story } from './storiesDyoDromoi';
import { fn } from '../../lib/core/format';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const flag = (k: string) => args.includes(`--${k}`);
const opt = (k: string) => args.find(a => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const OUT = opt('out') ?? join(ROOT, 'docs/marketing/reels/ig-dyo-dromoi');
const DOC = join(ROOT, 'docs/marketing/instagram/reel-dyo-dromoi');
const ff = (a: string[], what: string) => { const r = spawnSync(FF(), ['-y', '-hide_banner', '-loglevel', 'error', ...a], { stdio: 'inherit' }); if (r.status !== 0) throw new Error(`Το ffmpeg απέτυχε: ${what}.`); };
/** Το κείμενο μιας σελίδας χωρίς ετικέτες, στυλ και σενάρια: ό,τι διαβάζει ο θεατής. */
const textOf = (html: string) => html.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const dmy = (iso: string) => iso.split('-').reverse().join('/');

async function main() {
  const t0 = Date.now();
  mkdirSync(OUT, { recursive: true }); mkdirSync(DOC, { recursive: true });
  const b = build(SPEC), pg = page(b), f = b.f, tx = renderTexts(b);
  console.log(`■ ${SPEC.id} · ${b.dur.toFixed(1)}″ · ${b.scenes.length} σκηνές · ${pg.trs.map(x => x.name).join(' → ')}`);

  // ── 1 · Ψηφία μόνο από γεγονότα και καμία επανάληψη του χθεσινού ──────────
  pg.outs.forEach((o, k) => {
    assertDigitsFromFacts(`σκηνή ${k + 1}`, o.html, f);
    assertNoRepeat(`σκηνή ${k + 1}`, textOf(o.html), f);
  });
  const ST: Story[] = stories(f);
  ST.forEach(s => assertNoRepeat(`story ${s.n}`, textOf(s.html) + ' ' + s.alt + ' ' + JSON.stringify(s.sticker), f));
  const cover = coverHtml(f);
  for (const [k, v] of Object.entries({ 'λεζάντα Instagram': tx.igCaption, 'εναλλακτικό': tx.alt, 'YouTube': tx.ytDesc, 'TikTok': tx.ttCaption, 'καρφιτσωμένο': tx.pinned })) assertNoRepeat(k, v, f);
  console.log('  ✓ κάθε ψηφίο από γεγονός · καμία επανάληψη του χθεσινού');

  // ── 2 · Οι έλεγχοι της μηχανής χωρίς περιηγητή ───────────────────────────
  const textMap = { 'YouTube τίτλος': tx.ytTitle, 'YouTube περιγραφή': tx.ytDesc, 'Instagram λεζάντα': tx.igCaption, 'Εναλλακτικό': tx.alt, 'TikTok λεζάντα': tx.ttCaption, 'Καρφιτσωμένο': tx.pinned,
    ...Object.fromEntries(ST.map(s => [`story ${s.n}`, `${s.title}. ${s.alt} ${s.sticker.text}`])) };
  const pre: Gate[] = [gateDigits(SPEC), gateCopy(b, textMap), gateLengths({ ...tx }), gateStory(b, pg), gateDeadAir(b, pg), gateRubric(b)];
  console.log(report(pre).join('\n'));
  if (failed(pre)) throw new Error('Οι έλεγχοι χωρίς περιηγητή απέτυχαν.');

  // ── 3 · Περιηγητής: στιγμιότυπα, έλεγχοι σελίδας, stories, εξώφυλλο ───────
  const br = await openBrowser();
  let post: Gate[] = [];
  const storyFails: string[] = [];
  try {
    const p = await openPage(br, pg.html);
    if (flag('stills')) {
      const sd = join(OUT, 'stills'); mkdirSync(sd, { recursive: true });
      for (const [k, t] of pg.settle.entries()) { await renderAt(p, t); await p.screenshot({ path: join(sd, `scene${k + 1}.png`) }); }
      for (const [i, tr] of pg.trs.entries()) { await renderAt(p, tr.B + tr.post * .4); await p.screenshot({ path: join(sd, `tr${i + 1}-${tr.name}.png`) }); }
      for (const t of (opt('at') ?? '').split(',').filter(Boolean).map(Number)) { await renderAt(p, t); await p.screenshot({ path: join(sd, `at-${t}.png`) }); }
      console.log(`  ✓ στιγμιότυπα στο ${sd}`);
    }
    const r = await browserGates(p, b, pg, f, { pop: !flag('fast') });
    post = [...r.gates, await kickGaps(p, pg.html)];
    console.log(report(post).join('\n'));
    await p.close();

    // Τα stories: εικόνα μόνο αφού περάσει ο έλεγχος ψηφίων (μέσα στο stories()) και ο έλεγχος σελίδας.
    for (const s of ST) {
      const sp = await br.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
      await sp.setContent(s.html, { waitUntil: 'load' });
      await sp.evaluate(() => document.fonts.ready);
      await sp.evaluate('window.__seek(30)');
      storyFails.push(...await pageQa(sp, `story ${s.n}`, [250, 1580]));
      await sp.screenshot({ path: join(OUT, `story-${s.n}.png`) });
      await sp.close();
    }
    const cp = await br.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
    await cp.setContent(cover, { waitUntil: 'load' });
    await cp.evaluate(() => document.fonts.ready);
    // Το εξώφυλλο: ό,τι γράφει μέσα στο κεντρικό 4:5 (1080×1350), που είναι και μέσα στο 3:4.
    storyFails.push(...await pageQa(cp, 'εξώφυλλο', [(1920 - 1350) / 2 + 24, (1920 + 1350) / 2 - 24], 84));
    await cp.screenshot({ path: join(OUT, 'cover.jpg'), type: 'jpeg', quality: 92 });
    await cp.close();
  } finally { await br.close(); }
  const Sq: Gate = { name: 'Stories και εξώφυλλο: ζώνες 250/1580 (4:5 στο εξώφυλλο), ≥ 26px, αντίθεση, χρώματα K, επικαλύψεις', fails: storyFails };
  console.log(report([Sq]).join('\n'));
  ff(['-i', join(OUT, 'cover.jpg'), '-vf', 'crop=1080:1350:0:285', join(OUT, 'cover-4x5.jpg')], 'περικοπή 4:5');
  ff(['-i', join(OUT, 'cover.jpg'), '-vf', 'crop=1080:1440:0:240', join(OUT, 'cover-3x4.jpg')], 'περικοπή 3:4');
  ff(['-framerate', '1', '-start_number', '1', '-i', join(OUT, 'story-%d.png'), '-vf', 'scale=360:-1,tile=6x1:padding=12:margin=12:color=white', '-frames:v', '1', join(OUT, 'contact-stories.png')], 'φύλλο stories');
  if (failed(post) || failed([Sq])) throw new Error('Οι έλεγχοι σελίδας απέτυχαν.');

  // ── 4 · Βίντεο: καρέ, ήχος, κωδικοποίηση, βρόχος ─────────────────────────
  let fin: Gate[] = [], files: string[] = [];
  if (!flag('no-video')) {
    const fd = join(OUT, 'frames');
    await frames(pg.html, b.dur, fd, Number(opt('workers') ?? 4));
    const wav = join(OUT, 'sound.wav');
    const { peakDb } = writeWav(score(b, pg), wav);
    console.log(`  ✓ ήχος, κορυφή WAV ${peakDb.toFixed(2)} dBFS`);
    const mp4 = join(OUT, 'reel.mp4'), up = join(OUT, 'reel-upload.mp4');
    master(fd, wav, mp4);
    const u = upload(mp4, b.dur, up);
    const last = join(fd, `${String(Math.round(b.dur * FPS) - 1).padStart(5, '0')}.jpg`);
    fin = [gateLoop(join(fd, '00000.jpg'), last), gateAudio(mp4), gateAudio(up)];
    console.log(report(fin).join('\n'));
    // Φύλλο επαφής: ένα καρέ κάθε δύο δευτερόλεπτα, από το πρώτο.
    const n = Math.floor(b.dur / 2) + 1;
    ff(['-i', mp4, '-vf', `fps=1/2:start_time=0,scale=270:-1,tile=7x${Math.ceil(n / 7)}:padding=8:margin=8:color=white`, '-frames:v', '1', join(OUT, 'contact-reel.png')], 'φύλλο reel');
    files = [`reel.mp4: ${fn(statSync(mp4).size / 1e6, 1)} MB`, `reel-upload.mp4: ${fn(u.mb, 1)} MB`];
    if (failed(fin)) throw new Error('Οι έλεγχοι του αρχείου απέτυχαν.');
    if (!flag('keep-frames')) rmSync(fd, { recursive: true, force: true });
    rmSync(wav, { force: true });
  }

  // ── 5 · Κείμενα ───────────────────────────────────────────────────────────
  const gates = [...report(pre), ...report(post), ...report([Sq]), ...report(fin)];
  const sheet = storySheet(ST);
  writeFileSync(join(OUT, 'texts.md'), textsMd(b, pg, tx, sheet, gates, files));
  writeFileSync(join(DOC, 'caption.md'), `${tx.igCaption}\n`);
  writeFileSync(join(DOC, 'stories.md'), `# Stories · «${plain(SPEC.title, f)}»\n\n${sheet}`);
  writeFileSync(join(DOC, 'README.md'), readme(b));
  copyFileSync(join(OUT, 'cover.jpg'), join(DOC, 'cover.jpg'));
  console.log(`✓ ${OUT}\n✓ ${DOC}\n  σε ${fn((Date.now() - t0) / 60000, 1)}′`);
}

/**
 * ΚΕΝΟ ΓΥΡΩ ΑΠΟ ΤΗ ΛΕΞΗ-ΚΛΕΙΔΙ, ΣΕ ΚΑΘΕ ΚΑΡΕ ΤΗΣ ΚΙΝΗΣΗΣ ΤΗΣ. Η πρώτη έκδοση (08/10/2026)
 * φούσκωνε τη λέξη πλάγια και έτρωγε το κενό («πάγιαπερνούν»)· ο έλεγχος στοίχισης
 * έβλεπε μόνο καρέ όπου όλα έχουν κάτσει. Εδώ: πέντε καρέ μέσα σε κάθε `kick` και
 * σε καθένα το κενό ως τον προηγούμενο και τον επόμενο χαρακτήρα της ίδιας γραμμής ≥ 0,2em.
 */
async function kickGaps(p: import('playwright-core').Page, html: string): Promise<Gate> {
  const g: Gate = { name: 'Λέξη-κλειδί: κενό ≥ 0,2em δεξιά και αριστερά σε κάθε καρέ της κίνησης', fails: [] };
  const ks = [...html.matchAll(/kick,([\d.]+),([\d.]+)/g)].map(m => [Number(m[1]), Number(m[2])] as const);
  for (const [t0, d] of ks) for (const q of [.1, .3, .5, .7, .9]) {
    const t = t0 + d * q;
    await p.evaluate((x: number) => (window as unknown as { render: (t: number) => void }).render(x), t);
    const bad = (await p.evaluate(`(() => {
      const out = [], rg = document.createRange();
      const charRect = (node, i) => { rg.setStart(node, i); rg.setEnd(node, i + 1); return rg.getBoundingClientRect(); };
      for (const el of document.querySelectorAll('section .kw')) {
        const sec = el.closest('section'); if (!sec || sec.style.display === 'none' || Number(sec.style.opacity || 1) < .5) continue;
        const r = el.getBoundingClientRect(); if (!r.width) continue;
        const em = parseFloat(getComputedStyle(el).fontSize), same = q => Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top) > .5 * Math.min(r.height, q.height);
        const prev = el.previousSibling, next = el.nextSibling;
        if (prev && prev.nodeType === 3) { const s = prev.textContent; let i = s.length - 1; while (i >= 0 && /\\s/.test(s[i])) i--; if (i >= 0 && i < s.length - 1) { const c = charRect(prev, i); if (same(c) && r.left - c.right < .2 * em) out.push('«' + s.slice(Math.max(0, i - 8), i + 1) + '|' + el.textContent.slice(0, 12) + '» ' + (r.left - c.right).toFixed(1) + 'px'); } }
        if (next && next.nodeType === 3) { const s = next.textContent; let i = 0; while (i < s.length && /\\s/.test(s[i])) i++; if (i < s.length && i > 0) { const c = charRect(next, i); if (same(c) && c.left - r.right < .2 * em) out.push('«' + el.textContent.slice(-12) + '|' + s.slice(i, i + 8) + '» ' + (c.left - r.right).toFixed(1) + 'px'); } }
      }
      return out;
    })()`)) as string[];
    g.fails.push(...bad.map(x => `${t.toFixed(2)}″: ${x}`));
  }
  g.fails = [...new Set(g.fails)];
  g.info = `${ks.length} λέξεις × 5 καρέ`;
  return g;
}

/** Το φύλλο των stories: τίτλος, αυτοκόλλητο με τα κείμενά του, θέση, εναλλακτικό. */
function storySheet(ST: Story[]): string {
  return ST.map(s => [
    `## Story ${s.n} από ${ST.length} · «${s.title}»`,
    '',
    `- Αρχείο: \`story-${s.n}.png\` (1080×1920, τίποτα σημαντικό πάνω από τα 250px ή κάτω από τα 1580px)`,
    `- Αυτοκόλλητο: **${s.sticker.kind}**, ${s.sticker.where}`,
    `- Κείμενο αυτοκόλλητου: «${s.sticker.text}»`,
    ...(s.sticker.options ? [`- Επιλογές: ${s.sticker.options.map((o, i) => `«${o}»${s.sticker.answer === i ? ' (σωστή)' : ''}`).join(' · ')}`] : []),
    ...(s.sticker.url ? [`- Σύνδεσμος: ${s.sticker.url}`] : []),
    `- Εναλλακτικό κείμενο: ${s.alt}`,
    '',
  ].join('\n')).join('\n');
}

function textsMd(b: ReturnType<typeof build>, pg: ReturnType<typeof page>, tx: ReturnType<typeof renderTexts>, sheet: string, gates: string[], files: string[]): string {
  const { f } = b, s = SERIES[SPEC.series];
  const deaths = [...new Set(Object.values(f).map(x => x.validity).filter((x): x is string => !!x))].map(id => ({ id, to: validTo(id) }));
  const death = deaths.map(d => d.to).filter((x): x is string => !!x).sort()[0];
  const rows = Object.values(f).filter(x => x.text);
  return [
    `# Instagram reel ${dmy(SPEC.date)} ${SPEC.slot} · «${plain(SPEC.title, f)}»`,
    '',
    `Σειρά **${s.name}** · ${fn(b.dur, 1)}″ · ${b.scenes.length} σκηνές · ${s.bpm} χτύποι το λεπτό · 1080×1920, ${FPS} fps, H.264 · βρόχος χωρίς ραφή.`,
    `Σύνδεσμος: \`${SPEC.cta.path}\` · καμπάνια \`${SPEC.utm.campaign}\`.`,
    death ? `**Λήγει ${dmy(death)}** (${deaths.map(d => `\`${d.id}\` ως ${d.to ? dmy(d.to) : 'ανοιχτό'}`).join(', ')}, lib/legal/validity.ts). Μετά αποσύρεται ή ξαναβγαίνει. Το εξώφυλλο δεν γράφει αριθμό και δεν γερνά.` : '',
    '',
    `**Πρωταγωνιστές** (παραδείγματα, όχι υπαρκτά πρόσωπα): ${plain(SPEC.protagonist, f)}`,
    '',
    '## Σενάριο',
    '',
    `Αγκίστρι: «${plain(SPEC.hook, f)}». ${SPEC.hooks[SPEC.pick].why}`,
    '',
    ...storyboard(b, pg),
    '',
    `Περάσματα: ${pg.trs.map(x => TRANSITIONS[x.name as keyof typeof TRANSITIONS].label.toLocaleLowerCase('el')).join(' · ')}.`,
    '',
    '## Λεζάντα Instagram',
    '',
    tx.igCaption,
    '',
    `Αποθήκευση: «Κράτα το για όταν θα συγκρίνεις». Αποστολή: «Στείλ' το σε όποιον σκέφτεται να βάλει και το δεύτερο σπίτι στο Airbnb».`,
    '',
    `Εναλλακτικό κείμενο: ${tx.alt}`,
    '',
    `Σύνδεσμος στο προφίλ: ${utmUrl(SPEC.cta.path, SPEC.utm.campaign, 'instagram', SPEC.utm.medium)}`,
    '',
    '## Stories',
    '',
    sheet,
    '## Εξώφυλλο',
    '',
    'Χωρίς αριθμούς: δύο κορδέλες στην ίδια κλίμακα (η λιλά ανοίγει σε πέντε ρεύματα, η πράσινη τρέχει ως ένα), τίτλος και μικρός τίτλος. Όλα μέσα στο κεντρικό 1080×1350 (`cover-4x5.jpg`), άρα και στο 1080×1440 του πλέγματος (`cover-3x4.jpg`).',
    '',
    '## Από πού βγαίνει κάθε αριθμός',
    '',
    'Η πλευρά Airbnb με άλλα ενοίκια υπολογίζεται με τις ίδιες συναρτήσεις· ο υπολογιστής βραχυχρόνιας δεν έχει ακόμα πεδίο άλλων ενοικίων.',
    '',
    `Τα άλλα ενοίκια (${f['withEleni.otherGross'].text}) είναι τα ενοίκια του ακινήτου επίδειξης (rentFacts.yearAhead), το ίδιο ποσό με το short της 07/10 21:30. Μπαίνουν ΜΟΝΟ ως είσοδος («με άλλα ενοίκια …»), δίπλα σε κάθε αριθμό που εξαρτάται από αυτά (διαφορά, κλιμάκια, όριο ${f['withEleni.be'].text}), ώστε να μη διαβάζονται ως κανόνας για όλους. Τα καθαρά της Ελένης του χθεσινού short δεν ξαναγράφονται (assertNoRepeat).`,
    '',
    '| γεγονός | κείμενο | πηγή | λήγει |',
    '|---|---|---|---|',
    ...rows.map(x => `| \`${x.id}\` | ${x.text} | ${x.source} | ${x.validity ? dmy(validTo(x.validity) ?? '') || 'ανοιχτό' : ''} |`),
    '',
    '## Έλεγχοι',
    '',
    '```',
    ...gates,
    '```',
    ...(files.length ? ['', '## Αρχεία', '', ...files.map(x => `- ${x}`)] : []),
    '',
  ].join('\n');
}

function readme(b: ReturnType<typeof build>): string {
  const { f } = b;
  return [
    `# Reel «${plain(SPEC.title, f)}»`,
    '',
    'Ενώνει τα δύο shorts της προηγούμενης μέρας (πού πάνε τα ενοίκια, Airbnb ή ενοικιαστής) σε μία ιστορία: η νύχτα πληρώνεται μόνο γεμάτη, η μέρα πάντα. Ροή της νύχτας, καμπύλη του φόρου, δώδεκα μήνες ταμείου, ο άδειος μήνας του ενοικιαστή και το όριο ως ζώνη.',
    '',
    '    npx tsx scripts/marketing/reelDyoDromoi.ts',
    '',
    'Βίντεο, stories και φύλλα ελέγχου βγαίνουν στο `docs/marketing/reels/ig-dyo-dromoi/`, έξω από το git. Εδώ μένουν η λεζάντα (`caption.md`), το φύλλο των stories (`stories.md`) και το εξώφυλλο (`cover.jpg`, χωρίς αριθμούς).',
    '',
    `Σύνδεσμος: ${utmUrl(SPEC.cta.path, SPEC.utm.campaign, 'instagram', SPEC.utm.medium)}`,
    '',
    'Κάθε αριθμός από το `scripts/marketing/dyoDromoiFacts.ts` (lib/tools/shortVsLong, lib/tools/apodosi, lib/billing/greekTax).',
    '',
  ].join('\n');
}

main().catch(e => { console.error(e instanceof Error ? e.stack ?? e.message : e); process.exit(1); });
