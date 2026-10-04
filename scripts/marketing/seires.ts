// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΣΕΙΡΕΣ ΤΟΥ INSTAGRAM: ΕΠΕΙΣΟΔΙΑ, ΟΧΙ ΑΝΑΡΤΗΣΕΙΣ
// ─────────────────────────────────────────────────────────────────────────
// ΧΡΗΣΗ:  npx tsx scripts/marketing/seires.ts
// Γράφει στο docs/marketing/instagram/seires/ κάθε επεισόδιο δύο φορές (story
// 1080×1920 και carousel 1080×1440), τα εξώφυλλα των Highlights και ένα
// README με ημερομηνία, αυτοκόλλητα, λεζάντα και εναλλακτικό κείμενο.
//
// ΓΙΑΤΙ ΣΕΙΡΕΣ. Ένα story ζει μία μέρα. Μια σειρά είναι ραντεβού: την Τετάρτη
// έρχεται το επόμενο επεισόδιο των βραχυχρόνιων και ο θεατής το περιμένει.
// Το τελευταίο καρέ κάθε επεισοδίου λέει ποιο είναι το επόμενο. Τα Highlights
// κρατούν κάθε σειρά στο προφίλ για πάντα.
//
// ΤΙ ΑΝΤΑΜΕΙΒΕΙ ΤΟ INSTAGRAM ΚΑΙ ΠΩΣ ΤΟ ΥΠΗΡΕΤΕΙ ΚΑΘΕ ΕΠΕΙΣΟΔΙΟ.
//   · Αποστολές σε DM: το ισχυρότερο σήμα για να φτάσεις σε όσους δεν σε
//     ακολουθούν. Το τελευταίο καρέ ζητά ρητά «στείλ' το σε…».
//   · Διάλογος: οι απαντήσεις στα stories μετρούν. Κάθε εξώφυλλο έχει quiz,
//     κάθε επεισόδιο ερώτηση ή δημοσκόπηση· ο χώρος τους μένει άδειος εδώ.
//   · Αποθηκεύσεις: το carousel είναι πίνακας αναφοράς, κάτι που κρατάς.
//   · Πλέγμα 3:4: το carousel βγαίνει 1080×1440, όσο το δείχνει το προφίλ.
//
// ΚΑΝΕΝΑ ΝΟΥΜΕΡΟ ΔΕΝ ΓΡΑΦΕΤΑΙ ΕΔΩ. Κάθε ποσό, ποσοστό και ημερομηνία βγαίνει
// από τη συνάρτηση που τη βγάζει και στην εφαρμογή. Τα παραδείγματα είναι οι
// προεπιλογές των δημόσιων υπολογιστών (spec.ts δίπλα σε κάθε υπολογιστή):
// όποιος πατήσει τον σύνδεσμο βλέπει ακριβώς τα ίδια νούμερα.
// ═══════════════════════════════════════════════════════════════════════════
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { esc } from './igKit';
import { SERIES, SIZE, STORY_SAFE, shell, highlight, type Episode, type Format, type Palette, type SeriesKey, type Slide } from './seiresKit';
import { fe, feWhole } from '../../lib/core/format';
import { athensToday } from '../../lib/core/time';
import { compareShortVsLong, netByOccupancy, type ShortVsLongInput } from '../../lib/tools/shortVsLong';
import { SPEC as SVL } from '../../app/vraxyxronia-i-makroxronia/spec';
import { SPEC as RENT } from '../../app/ypologismos-forou-enoikion/spec';
import {
  rentalIncomeTax, RENTAL_TAX_BRACKETS_2025, RENTAL_TAX_BRACKETS_2026, FIRST_YEAR_NEW_BRACKETS,
  FIRST_YEAR_BANK_RECEIPT, FIRST_MONTH_BANK_RECEIPT, isHighSeasonMonth, type TaxBracket,
} from '../../lib/billing/greekTax';
import { presumptiveDeductionRateForYear } from '../../lib/billing/presumptive';
import { ENFIA_ZONE_TAX } from '../../lib/billing/enfia';
import { greekPropertyTaxObligations } from '../../lib/tax/greekTaxCalendar';
import { RENO_39B_TO } from '../../lib/accounting/renovation39b';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const { chromePath } = require('../lib/chrome.mjs');

const ROOT = process.cwd();
const OUT = join(ROOT, 'docs/marketing/instagram/seires');
const SITE = 'https://properwise.gr';

// ── ΠΟΤΕ ΒΓΑΙΝΕΙ ΚΑΘΕ ΣΕΙΡΑ ─────────────────────────────────────────────
// Η πρώτη Τετάρτη από σήμερα ανοίγει τις σειρές. Η Παρασκευή και η Δευτέρα
// ακολουθούν. Η ημερομηνία μετρά: το ΕΝΦΙΑ δείχνει τη δόση που λήγει μετά
// τη μέρα της δημοσίευσης, όχι μετά τη μέρα που τρέχει η μηχανή.
const WEEKDAY: Record<SeriesKey, number> = { vraxy: 3, foroi: 5, makro: 1 };
const addDays = (iso: string, d: number) => {
  const t = new Date(`${iso}T12:00:00Z`); t.setUTCDate(t.getUTCDate() + d); return t.toISOString().slice(0, 10);
};
const nextWeekday = (from: string, wd: number) => {
  for (let k = 1; k <= 7; k++) { const d = addDays(from, k); if (new Date(`${d}T12:00:00Z`).getUTCDay() === wd) return d; }
  throw new Error('nextWeekday');
};
const START = nextWeekday(athensToday(), WEEKDAY.vraxy);
const PUBLISH: Record<SeriesKey, string> = {
  vraxy: START,
  foroi: nextWeekday(START, WEEKDAY.foroi),
  makro: nextWeekday(nextWeekday(START, WEEKDAY.foroi), WEEKDAY.makro),
};
const elDate = (iso: string, o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('el-GR', { ...o, timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`));
/** Θέση ή πλάτος σε ποσοστό του κουτιού, για το CSS. Δεν είναι ποσό για ανάγνωση. */
const pc = (x: number) => `${Math.round(x * 100) / 100}%`;
const pct = (r: number) => `${String(Math.round(r * 10000) / 100).replace('.', ',')}%`;

// ── ΜΙΚΡΑ ΚΟΜΜΑΤΙΑ ΠΟΥ ΕΠΑΝΑΛΑΜΒΑΝΟΝΤΑΙ ─────────────────────────────────
const ICON = {
  send: (c: string, px: number) => `<svg width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/></svg>`,
  link: (c: string, px: number) => `<svg width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>`,
  save: (c: string, px: number) => `<svg width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`,
};

/** Η λωρίδα όπου μπαίνει το αυτοκόλλητο. Μόνο στο story· στο carousel δεν υπάρχει. */
const slot = (f: Format, h: number, label: string) =>
  f === 'story' ? `<div class="slot" style="height:${h}px;display:flex;align-items:center;justify-content:center"><span class="mono" style="font-size:18px;opacity:.0">${esc(label)}</span></div>` : '';

/** Καταρράκτης: από τα έσοδα στα καθαρά, μία γραμμή ανά αφαίρεση. */
function waterfall(s: Palette, rows: { label: string; amount: number; kind: 'in' | 'out' | 'net' }[]): string {
  const top = Math.max(...rows.map(r => r.amount));
  let level = 0;
  return `<div class="wf">${rows.map(r => {
    const w = r.amount / top * 100;
    let left = 0;
    if (r.kind === 'in') { left = 0; level = r.amount; }
    else if (r.kind === 'out') { level -= r.amount; left = level / top * 100; }
    else { left = 0; }
    const color = r.kind === 'out' ? s.neg : r.kind === 'net' ? s.accent : s.muted;
    const sign = r.kind === 'out' ? '−' : '';
    return `<div class="wr ${r.kind}">
      <div class="wl"><span>${esc(r.label)}</span><b class="num" style="color:${r.kind === 'in' ? s.ink : color}">${sign}${esc(feWhole(r.amount))}</b></div>
      <div class="wt"><i style="left:${pc(left)};width:${pc(Math.max(w, 0.8))};background:${color}${r.kind === 'in' ? '66' : ''}"></i></div>
    </div>`;
  }).join('')}</div>`;
}
const WF_CSS = (s: Palette) => `
  .wf{display:flex;flex-direction:column;gap:18px}
  .wl{display:flex;justify-content:space-between;align-items:baseline;font-size:var(--body);color:${s.muted};margin-bottom:8px}
  .wl b{font-weight:700;font-size:calc(var(--body) + 2px)}
  .wr.net .wl{color:${s.ink};font-weight:700}
  .wr.net .wl b{font-size:calc(var(--body) + 16px);font-weight:800}
  .wt{position:relative;height:22px;border-radius:8px;background:${s.light ? s.ground2 : '#ffffff0a'}}
  .wt i{position:absolute;top:0;bottom:0;border-radius:8px}
  .wr.net .wt{height:30px}`;

/** Οι δώδεκα δόσεις του ΕΝΦΙΑ του έτους που λήγει ΜΕΤΑ τη μέρα δημοσίευσης. */
const ENFIA_RUN = new Set(['enfia-first', 'enfia-instalment', 'enfia-last']);
function enfiaRun(after: string) {
  const y = Number(after.slice(0, 4));
  for (const year of [y, y - 1]) {
    const run = greekPropertyTaxObligations(year, 'owner').filter(o => ENFIA_RUN.has(o.kind));
    const next = run.findIndex(o => o.date >= after);
    if (run.length === 12 && next >= 0) return { year, run, next };
  }
  throw new Error(`Το ημερολόγιο δεν έχει εκκαθαριστικό ΕΝΦΙΑ με δώδεκα δόσεις μετά τις ${after}.`);
}

/** Η κάρτα «Επόμενο επεισόδιο»: αυτό που φέρνει τον θεατή πίσω. */
const nextCard = (s: Palette, day: string, title: string) => `
  <div class="next card"><small class="mono">ΕΠΟΜΕΝΟ ΕΠΕΙΣΟΔΙΟ · ${esc(day.toLocaleUpperCase('el').normalize('NFD').replace(/[́]/g, '').normalize('NFC'))}</small><b>${esc(title)}</b></div>`;
const ACTION_CSS = (s: Palette) => `
  .act h2{font-size:var(--h2)}
  .send{display:flex;align-items:center;gap:22px;padding:28px 32px;border-radius:30px;background:${s.accent};color:${s.onAccent};font-size:calc(var(--body) + 4px);font-weight:750;letter-spacing:-.01em;line-height:1.25}
  .send svg{flex:none}
  .next{padding:28px 32px;display:flex;flex-direction:column;gap:10px}
  .next small{font-size:19px;color:${s.faint};letter-spacing:.14em}
  .next b{font-size:calc(var(--body) + 6px);font-weight:750;letter-spacing:-.015em;line-height:1.2}
  .linkline{display:flex;align-items:center;gap:14px;font-size:var(--body);color:${s.muted}}
  .linkline b{color:${s.ink}}`;

// ═══ ΒΡΑΧΥΧΡΟΝΙΑ · Ε01 · ΒΡΑΧΥΧΡΟΝΙΑ Η ΜΑΚΡΟΧΡΟΝΙΑ; ════════════════════════
// Η γωνία: η απάντηση δεν είναι «η βραχυχρόνια βγάζει περισσότερα». Είναι ότι
// κρίνεται από μία μεταβλητή, την πληρότητα και ότι υπάρχει σημείο κάτω από
// το οποίο η μακροχρόνια κερδίζει. Αυτό δεν το λέει κανείς με αριθμό.
const svlInput: ShortVsLongInput = {
  monthlyRent: Number(SVL.enoikio), nightlyPrice: Number(SVL.timi), occupancyPct: Number(SVL.plirotita),
  sqm: Number(SVL.tm), isHouse: (SVL.typos as string) === 'house', platformFeePct: Number(SVL.promitheia),
  costPerNight: Number(SVL.kostos), fixedPerMonth: Number(SVL.pagia), season: (SVL.sezon as string) === 'high' ? 'high' : 'even',
};
function vraxy01(): Episode {
  const s = SERIES.vraxy;
  const r = compareShortVsLong(svlInput);
  if (r.breakEvenPct == null || r.breakEvenNights == null) throw new Error('Η σύγκριση δεν έχει σημείο ισορροπίας.');
  const bePct = Math.floor(r.breakEvenPct);
  // Η λέξη για το πόσο μεγαλύτερα είναι τα έσοδα βγαίνει από τον λόγο, όχι από εντύπωση.
  const ratio = r.short.gross / r.long.gross;
  const grossWord = ratio >= 1.9 && ratio < 2.3 ? 'διπλάσια' : ratio >= 1.4 && ratio < 1.9 ? 'μιάμιση φορά' : null;
  if (!grossWord) throw new Error(`Ο λόγος εσόδων ${ratio.toFixed(2)} δεν έχει λέξη· το κείμενο θέλει αλλαγή.`);
  const kept = r.short.net / r.short.gross;
  if (kept < 0.4 || kept > 0.6) throw new Error(`Μένει ${pct(kept)} των εσόδων· το «τα μισά φεύγουν» δεν ισχύει.`);
  const curve = netByOccupancy(svlInput, [20, 30, 40, 50, 60, 70, 80, 90]);
  if (r.difference <= 0) throw new Error('Στο παράδειγμα κερδίζει η μακροχρόνια· η γωνία του επεισοδίου θέλει αλλαγή.');
  const novLow = !isHighSeasonMonth(10) && isHighSeasonMonth(9);
  if (!novLow) throw new Error('Η αλλαγή σεζόν του ΤΑΚΚ δεν είναι πια την 1η Νοεμβρίου· το «Επόμενο» θέλει αλλαγή.');
  const link = { url: `${SITE}/vraxyxronia-i-makroxronia`, label: 'Βραχυχρόνια ή μακροχρόνια' };

  // Η καμπύλη: καθαρά της βραχυχρόνιας ανά πληρότητα, απέναντι στη σταθερή
  // γραμμή της μακροχρόνιας. Το σημείο τομής είναι όλο το επεισόδιο.
  const chart = (f: Format) => {
    const W = 900, Hh = f === 'story' ? 410 : 440, padL = 0, padB = 54, padT = 30;
    const xs = (p: number) => padL + (p - 20) / 70 * (W - padL - 10);
    const max = Math.max(...curve.map(c => c.net)) * 1.08;
    const ys = (v: number) => padT + (1 - v / max) * (Hh - padB - padT);
    const path = curve.map((c, k) => `${k ? 'L' : 'M'}${xs(c.pct).toFixed(1)},${ys(c.net).toFixed(1)}`).join(' ');
    const area = `${path} L${xs(90).toFixed(1)},${ys(0).toFixed(1)} L${xs(20).toFixed(1)},${ys(0).toFixed(1)} Z`;
    const bx = xs(r.breakEvenPct!), by = ys(r.long.net);
    const mine = curve.find(c => c.pct === svlInput.occupancyPct)!;
    return `<svg width="${W}" height="${Hh}" viewBox="0 0 ${W} ${Hh}" style="display:block;overflow:visible">
      <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.accent}" stop-opacity=".32"/><stop offset="1" stop-color="${s.accent}" stop-opacity="0"/></linearGradient></defs>
      ${[0.25, 0.5, 0.75].map(t => `<line x1="0" x2="${W}" y1="${(padT + t * (Hh - padB - padT)).toFixed(1)}" y2="${(padT + t * (Hh - padB - padT)).toFixed(1)}" stroke="${s.rule}" stroke-width="1.5"/>`).join('')}
      <path d="${area}" fill="url(#g)"/>
      <line x1="0" x2="${W}" y1="${by.toFixed(1)}" y2="${by.toFixed(1)}" stroke="${s.accent2}" stroke-width="4" stroke-dasharray="14 10"/>
      <text x="${W}" y="${(by - 16).toFixed(1)}" text-anchor="end" fill="${s.accent2}" font-family="Inter" font-size="24" font-weight="700">Μακροχρόνια ${esc(feWhole(r.long.net))}</text>
      <path d="${path}" fill="none" stroke="${s.accent}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/>
      ${curve.map(c => `<circle cx="${xs(c.pct).toFixed(1)}" cy="${ys(c.net).toFixed(1)}" r="7" fill="${s.ground}" stroke="${s.accent}" stroke-width="4"/>`).join('')}
      <line x1="${bx.toFixed(1)}" x2="${bx.toFixed(1)}" y1="${by.toFixed(1)}" y2="${ys(0).toFixed(1)}" stroke="${s.ink}" stroke-opacity=".5" stroke-width="2"/>
      <circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="16" fill="${s.ink}"/>
      <circle cx="${xs(mine.pct).toFixed(1)}" cy="${ys(mine.net).toFixed(1)}" r="13" fill="${s.accent}"/>
      ${curve.map(c => `<text x="${xs(c.pct).toFixed(1)}" y="${Hh - 12}" text-anchor="middle" fill="${s.faint}" font-family="Roboto Mono" font-size="21">${c.pct}%</text>`).join('')}
    </svg>`;
  };

  const slides: Slide[] = [
    {
      alt: `Εξώφυλλο: «Βραχυχρόνια ή μακροχρόνια;». Το ίδιο διαμέρισμα ${svlInput.sqm} τ.μ., με ${feWhole(svlInput.monthlyRent)} τον μήνα ή ${feWhole(svlInput.nightlyPrice)} το βράδυ.`,
      sticker: 'Quiz: «Ποια αφήνει περισσότερα;» · Βραχυχρόνια / Μακροχρόνια / Εξαρτάται (σωστό: Εξαρτάται)',
      body: f => `
        <h1 style="font-size:calc(var(--h1) - 16px);margin-top:${f === 'story' ? 80 : 70}px">Βραχυχρόνια<br><span class="acc" style="white-space:nowrap">ή μακροχρόνια;</span></h1>
        <p class="lead" style="margin-top:36px;max-width:880px">Το ίδιο διαμέρισμα των ${svlInput.sqm} τ.μ. Δύο δρόμοι. Ποιος αφήνει περισσότερα στο τέλος της χρονιάς;</p>
        ${slot(f, 300, 'QUIZ')}
        <div class="duo" style="margin-top:auto">
          <div class="card d"><small class="mono">ΜΑΚΡΟΧΡΟΝΙΑ</small><b class="num">${esc(feWhole(svlInput.monthlyRent))}</b><span>τον μήνα</span></div>
          <div class="vs mono">Ή</div>
          <div class="card d hot"><small class="mono">ΒΡΑΧΥΧΡΟΝΙΑ</small><b class="num">${esc(feWhole(svlInput.nightlyPrice))}</b><span>το βράδυ</span></div>
        </div>`,
    },
    {
      alt: `Μακροχρόνια: ενοίκια ${feWhole(r.long.gross)} τον χρόνο, φόρος ${feWhole(r.long.tax)}, καθαρά ${feWhole(r.long.net)}.`,
      body: f => `
        <h2 style="font-size:var(--h2);margin-top:${f === 'story' ? 80 : 70}px">Μακροχρόνια:<br><span class="acc2 num">${esc(feWhole(r.long.net))}</span> καθαρά.</h2>
        <p class="lead" style="margin-top:32px">Ένας ενοικιαστής, ${esc(feWhole(svlInput.monthlyRent))} τον μήνα, δώδεκα μήνες. Αφαιρείς μόνο τον φόρο.</p>
        <div class="card box" style="margin-top:auto">
          <div class="bx-h"><b>Η χρονιά σε αριθμούς</b><span class="ex">ΠΑΡΑΔΕΙΓΜΑ</span></div>
          ${waterfall(s, [
            { label: 'Ενοίκια', amount: r.long.gross, kind: 'in' },
            { label: 'Φόρος εισοδήματος', amount: r.long.tax, kind: 'out' },
            { label: 'Καθαρά', amount: r.long.net, kind: 'net' },
          ])}
        </div>`,
    },
    {
      alt: `Βραχυχρόνια με πληρότητα ${svlInput.occupancyPct}%: ${r.short.nights} βράδια, έσοδα ${feWhole(r.short.gross)}, προμήθεια ${feWhole(r.short.platformFee)}, λειτουργία ${feWhole(r.short.running)}, φόρος ${feWhole(r.short.tax)}, καθαρά ${feWhole(r.short.net)}.`,
      sticker: 'Δημοσκόπηση: «Η προμήθεια της πλατφόρμας σε ξάφνιασε;» · Ναι / Την ήξερα',
      body: f => `
        <h2 style="font-size:var(--h2);margin-top:${f === 'story' ? 80 : 70}px">Βραχυχρόνια:<br><span class="acc num">${esc(feWhole(r.short.net))}</span> καθαρά.</h2>
        <p class="lead" style="margin-top:32px">${r.short.nights} βράδια, πληρότητα ${svlInput.occupancyPct}%. Τα έσοδα ${grossWord}, αλλά τα μισά φεύγουν σε τρία σημεία.</p>
        ${slot(f, 160, 'POLL')}
        <div class="card box" style="margin-top:auto">
          <div class="bx-h"><b>Η χρονιά σε αριθμούς</b><span class="ex">ΠΑΡΑΔΕΙΓΜΑ</span></div>
          ${waterfall(s, [
            { label: 'Έσοδα από βράδια', amount: r.short.gross, kind: 'in' },
            { label: `Προμήθεια πλατφόρμας ${svlInput.platformFeePct}%`, amount: r.short.platformFee, kind: 'out' },
            { label: 'Καθαριότητα, πάγια', amount: r.short.running, kind: 'out' },
            { label: 'Φόρος εισοδήματος', amount: r.short.tax, kind: 'out' },
            { label: 'Καθαρά', amount: r.short.net, kind: 'net' },
          ])}
          <p class="src" style="margin-top:20px">Το τέλος ανθεκτικότητας (${esc(feWhole(r.short.levy))}) το πληρώνει ο επισκέπτης· εσύ το αποδίδεις.</p>
        </div>`,
    },
    {
      alt: `Καμπύλη: καθαρά της βραχυχρόνιας ανά πληρότητα απέναντι στα ${feWhole(r.long.net)} της μακροχρόνιας. Κάτω από ${bePct}% πληρότητα, δηλαδή ${r.breakEvenNights} βράδια, κερδίζει η μακροχρόνια.`,
      sticker: 'Ερώτηση: «Πόση πληρότητα πιάνεις εσύ;»',
      body: f => `
        <h2 style="font-size:var(--h2);margin-top:${f === 'story' ? 80 : 70}px">Κάτω από <span class="acc num">${bePct}%</span>,<br>κερδίζει η μακροχρόνια.</h2>
        <p class="lead" style="margin-top:32px">Δηλαδή κάτω από ${r.breakEvenNights} βράδια τον χρόνο. Στο ${svlInput.occupancyPct}% η βραχυχρόνια αφήνει ${esc(feWhole(r.difference))} περισσότερα, πριν μετρήσεις τον χρόνο σου.</p>
        ${slot(f, 150, 'QUESTION')}
        <div class="card box" style="margin-top:auto;padding-bottom:22px">
          <div class="bx-h"><b>Καθαρά ανά πληρότητα</b><span class="ex">ΠΑΡΑΔΕΙΓΜΑ</span></div>
          ${chart(f)}
        </div>`,
    },
    {
      alt: `Τελευταίο καρέ: «Βάλε τα δικά σου νούμερα» στον δωρεάν υπολογιστή, πρόσκληση να σταλεί σε όποιον σκέφτεται βραχυχρόνια και το επόμενο επεισόδιο: ΤΑΚΚ, τι αλλάζει την 1η Νοεμβρίου.`,
      sticker: `Σύνδεσμος προς ${link.url} · κείμενο «Κάνε τον λογαριασμό»`,
      body: f => `<div class="act" style="display:flex;flex-direction:column;flex:1">
        <h2 style="margin-top:${f === 'story' ? 80 : 70}px">Βάλε τα<br><span class="acc">δικά σου νούμερα.</span></h2>
        <p class="lead" style="margin-top:32px">Τιμή, πληρότητα, προμήθεια. Ο υπολογιστής δείχνει ποια σου αφήνει περισσότερα. Χωρίς εγγραφή.</p>
        ${f === 'story' ? slot(f, 150, 'LINK') : `<div class="linkline" style="margin-top:40px">${ICON.link(s.accent, 34)}<span><b>properwise.gr</b>/vraxyxronia-i-makroxronia</span></div>`}
        <div style="margin-top:auto;display:flex;flex-direction:column;gap:18px">
          <div class="send">${ICON.send(s.onAccent, 40)}<span>Στείλ' το σε όποιον σκέφτεται να το δώσει σε Airbnb.</span></div>
          ${nextCard(s, SERIES.vraxy.day, 'Ε02 · ΤΑΚΚ: τι αλλάζει την 1η Νοεμβρίου')}
        </div></div>`,
    },
  ];
  return {
    series: 'vraxy', no: 1, title: 'Βραχυχρόνια ή μακροχρόνια;', link, slides,
    caption: [
      'Βραχυχρόνια ή μακροχρόνια; Η απάντηση κρίνεται από μία μεταβλητή: την πληρότητα.',
      '',
      `Το ίδιο διαμέρισμα των ${svlInput.sqm} τ.μ. Με ${feWhole(svlInput.monthlyRent)} τον μήνα, η μακροχρόνια αφήνει ${feWhole(r.long.net)} καθαρά τον χρόνο. Με ${feWhole(svlInput.nightlyPrice)} το βράδυ και πληρότητα ${svlInput.occupancyPct}%, η βραχυχρόνια αφήνει ${feWhole(r.short.net)}, αφού φύγουν προμήθεια, καθαριότητα, πάγια και φόρος.`,
      '',
      `Κάτω από ${bePct}% πληρότητα (${r.breakEvenNights} βράδια) κερδίζει η μακροχρόνια. Και ο χρόνος που θέλει η βραχυχρόνια δεν μπαίνει στον λογαριασμό.`,
      '',
      'Βάλε τα δικά σου νούμερα στον δωρεάν υπολογιστή, στο properwise.gr, χωρίς εγγραφή. Στείλ\' το σε όποιον σκέφτεται να δώσει το σπίτι σε Airbnb.',
      '',
      '#βραχυχρόνιαμίσθωση #airbnbgreece #ακίνητα #ενοίκιο #ιδιοκτήτες',
    ].join('\n'),
  };
}
const VRAXY_CSS = (s: Palette) => `
  .duo{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:22px}
  .d{padding:34px 34px 30px;display:flex;flex-direction:column;gap:6px}
  .d small{font-size:19px;color:${s.faint};letter-spacing:.14em}
  .d b{font-size:96px;font-weight:850;letter-spacing:-.05em;line-height:1}
  .d span{font-size:26px;color:${s.muted}}
  .d.hot{border-color:${s.accent}80;box-shadow:0 0 0 6px ${s.accent}14, 0 50px 120px -40px #000000c0}
  .d.hot b{color:${s.accent}}
  .vs{font-size:26px;color:${s.faint}}
  .box{padding:30px 34px}
  .bx-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}
  .bx-h b{font-size:calc(var(--body) + 2px);font-weight:750}
  ${WF_CSS(s)}${ACTION_CSS(s)}`;

// ═══ ΦΟΡΟΙ ΚΑΙ ΠΡΟΘΕΣΜΙΕΣ · Ε01 · Η ΕΠΟΜΕΝΗ ΔΟΣΗ ΤΟΥ ΕΝΦΙΑ ═════════════════
// Η γωνία: μια ημερομηνία που πλησιάζει και ένα αυτοκόλλητο αντίστροφης
// μέτρησης, που ο θεατής πατά για να του τη θυμίσει το ίδιο το Instagram.
// Μετά ο κανόνας (τελευταία εργάσιμη) και μια απάντηση στο «γιατί ο δικός
// μου είναι τόσος»: ο φόρος ανά τ.μ. ανά ζώνη, από τον πίνακα του νόμου.
function foroi01(): Episode {
  const s = SERIES.foroi;
  const { year, run, next } = enfiaRun(PUBLISH.foroi);
  const due = run[next];
  const law = due.notes.match(/ν\. \d+\/\d{4}, άρθρο \d+/)?.[0];
  if (!law) throw new Error(`Η ${due.id} δεν γράφει τη νομική βάση της.`);
  const [, mm, dd] = due.date.split('-').map(Number);
  const daysLeft = Math.round((Date.parse(`${due.date}T12:00:00Z`) - Date.parse(`${PUBLISH.foroi}T12:00:00Z`)) / 864e5);
  // Ο κανόνας του αποθετηρίου: μετρητής πάνω από 45 ημέρες δεν πιέζει κανέναν.
  if (daysLeft > 45) throw new Error(`Η δόση απέχει ${daysLeft} ημέρες· το επεισόδιο δεν είναι επείγον.`);
  const zones = Object.entries(ENFIA_ZONE_TAX);
  const zMax = Math.max(...zones.map(([, v]) => v));
  const zMin = Math.min(...zones.map(([, v]) => v));
  const zLabel = (k: string) => {
    if (k.startsWith('over_')) return `πάνω από ${feWhole(Number(k.slice(5)))}`;
    const [a, b] = k.split('_').map(Number);
    return `${a.toLocaleString('el-GR')}–${feWhole(b)}`;
  };
  const link = { url: `${SITE}/ypologismos-enfia`, label: 'Υπολογισμός ΕΝΦΙΑ' };
  const weekday = elDate(due.date, { weekday: 'long' });
  const tiles = run.map((o, i) => `
    <div class="t${i < next ? ' past' : ''}${i === next ? ' now' : ''}">
      <small>${i + 1}η</small><b>${esc(elDate(o.date, { month: 'short' }).replace('.', ''))}</b><span class="num">${esc(elDate(o.date, { day: 'numeric' }))}</span>
    </div>`).join('');
  const slides: Slide[] = [
    {
      alt: `Εξώφυλλο: η ${next + 1}η δόση του ΕΝΦΙΑ ${year} λήγει ${weekday} ${dd}/${mm}, σε σφραγίδα «Λήγει».`,
      sticker: `Αντίστροφη μέτρηση: «${next + 1}η δόση ΕΝΦΙΑ», λήξη ${elDate(due.date, { day: 'numeric', month: 'long' })} 23:59. Ο θεατής πατά «Υπενθύμιση».`,
      body: f => `
        <div class="stampbox" style="margin-top:${f === 'story' ? 90 : 70}px"><small class="mono">ΛΗΓΕΙ</small><b class="num">${dd}/${mm}</b><span>${esc(weekday)}</span></div>
        <h1 style="font-size:var(--h2);margin-top:${f === 'story' ? '60px' : 'auto'}">Η ${next + 1}η δόση<br><span class="acc">του ΕΝΦΙΑ.</span></h1>
        <p class="lead" style="margin-top:28px">Σε ${daysLeft} ημέρες. Πάτα την υπενθύμιση και θα σου τη θυμίσει το Instagram.</p>
        ${slot(f, 230, 'COUNTDOWN')}`,
    },
    {
      alt: `Οι δώδεκα δόσεις του ΕΝΦΙΑ ${year}, η καθεμία την τελευταία εργάσιμη του μήνα της. Οι περασμένες σβησμένες, η ${next + 1}η φωτισμένη. Πηγή: ${law}.`,
      body: f => `
        <h2 style="font-size:var(--h2);margin-top:${f === 'story' ? 80 : 70}px">Τελευταία εργάσιμη<br><span class="acc">κάθε μήνα.</span></h2>
        <p class="lead" style="margin-top:32px">Δώδεκα δόσεις, από τον Μάρτιο ώς τον Φεβρουάριο. Αν η τελευταία μέρα πέφτει Σάββατο, λήγει την Παρασκευή.</p>
        <div class="card cal" style="margin-top:auto">
          <div class="c-head"><b>ΕΝΦΙΑ ${year}</b><span class="mono">${run.length - next - 1} ΜΕΤΑ ΑΠΟ ΑΥΤΗ</span></div>
          <div class="grid">${tiles}</div>
          <div class="src" style="margin-top:18px">${esc(law)}</div>
        </div>`,
    },
    {
      alt: `Ο φόρος ανά τετραγωνικό του ΕΝΦΙΑ ανά τιμή ζώνης, από ${fe(zMin)} έως ${fe(zMax)}: ${zones.length} κλιμάκια σε ραβδόγραμμα.`,
      sticker: 'Ερώτηση: «Τι θες να μάθεις για τον ΕΝΦΙΑ σου;»',
      body: f => `
        <h2 style="font-size:var(--h2);margin-top:${f === 'story' ? 80 : 70}px">Ίδια τ.μ.,<br><span class="acc">${Math.round(zMax / zMin)} φορές</span> ο φόρος.</h2>
        <p class="lead" style="margin-top:32px">Ο ΕΝΦΙΑ ξεκινά από την τιμή ζώνης. Κάθε τετραγωνικό πληρώνει από ${esc(fe(zMin))} έως ${esc(fe(zMax))}, πριν από όροφο και παλαιότητα.</p>
        ${slot(f, 160, 'QUESTION')}
        <div class="card bars" style="margin-top:auto">
          <div class="c-head"><b>Φόρος ανά τ.μ.</b><span class="mono">ΤΙΜΗ ΖΩΝΗΣ €/Τ.Μ.</span></div>
          ${zones.map(([k, v]) => `<div class="br"><span class="mono">${esc(zLabel(k))}</span><div class="bt"><i style="width:${pc((v / zMax * 100))}"></i></div><b class="num">${esc(fe(v))}</b></div>`).join('')}
        </div>`,
    },
    {
      alt: 'Τελευταίο καρέ: «Υπολόγισε τον δικό σου ΕΝΦΙΑ» στον δωρεάν υπολογιστή, πρόσκληση να σταλεί σε όποιον πληρώνει σε δόσεις και το επόμενο επεισόδιο: η έκπτωση φόρου ανακαίνισης.',
      sticker: `Σύνδεσμος προς ${link.url} · κείμενο «Υπολόγισε τον ΕΝΦΙΑ»`,
      body: f => `<div class="act" style="display:flex;flex-direction:column;flex:1">
        <h2 style="margin-top:${f === 'story' ? 80 : 70}px">Πόσος είναι<br><span class="acc">ο δικός σου;</span></h2>
        <p class="lead" style="margin-top:32px">Τετραγωνικά, ζώνη, όροφος, παλαιότητα. Ο υπολογιστής βγάζει τον ΕΝΦΙΑ με τις μειώσεις του νόμου. Χωρίς εγγραφή.</p>
        ${f === 'story' ? slot(f, 150, 'LINK') : `<div class="linkline" style="margin-top:40px">${ICON.link(s.accent, 34)}<span><b>properwise.gr</b>/ypologismos-enfia</span></div>`}
        <div style="margin-top:auto;display:flex;flex-direction:column;gap:18px">
          <div class="send">${ICON.send(s.onAccent, 40)}<span>Στείλ' το σε όποιον πληρώνει τον ΕΝΦΙΑ σε δόσεις.</span></div>
          ${nextCard(s, SERIES.foroi.day, `Ε02 · Ανακαίνιση: η έκπτωση φόρου για δαπάνες ως ${RENO_39B_TO}`)}
        </div></div>`,
    },
  ];
  return {
    series: 'foroi', no: 1, title: `Η ${next + 1}η δόση του ΕΝΦΙΑ`, link, slides,
    caption: [
      `Η ${next + 1}η δόση του ΕΝΦΙΑ λήγει ${weekday} ${elDate(due.date, { day: 'numeric', month: 'long' })}.`,
      '',
      `Κάθε δόση λήγει την τελευταία εργάσιμη του μήνα της (${law}). Δώδεκα δόσεις, από τον Μάρτιο ώς τον Φεβρουάριο του επόμενου έτους.`,
      '',
      `Γιατί δύο σπίτια με τα ίδια τετραγωνικά πληρώνουν άλλο ΕΝΦΙΑ; Ο φόρος ανά τ.μ. ξεκινά από ${fe(zMin)} και φτάνει τα ${fe(zMax)}, ανάλογα με την τιμή ζώνης.`,
      '',
      'Υπολόγισε τον δικό σου στο properwise.gr, χωρίς εγγραφή. Αποθήκευσε το ημερολόγιο για τις επόμενες δόσεις.',
      '',
      '#ΕΝΦΙΑ #ακίνητα #φόροι #ιδιοκτήτες #ΑΑΔΕ',
    ].join('\n'),
  };
}
const FOROI_CSS = (s: Palette) => `
  .stampbox{align-self:flex-start;display:flex;flex-direction:column;align-items:center;padding:30px 54px 34px;border:7px solid ${s.accent};border-radius:28px;
    color:${s.accent};transform:rotate(-4deg);background:${s.accent}0d}
  .stampbox small{font-size:30px;letter-spacing:.4em;font-weight:700;margin-left:.4em}
  .stampbox b{font-size:240px;font-weight:900;letter-spacing:-.06em;line-height:.9;margin-top:6px}
  .stampbox span{font-size:34px;font-weight:700;letter-spacing:.02em;margin-top:6px}
  .cal,.bars{padding:28px 30px 26px}
  .c-head{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:22px}
  .c-head b{font-size:calc(var(--body) + 2px);font-weight:800}
  .c-head span{font-size:18px;color:${s.faint};letter-spacing:.12em}
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
  .t{display:flex;flex-direction:column;align-items:center;padding:14px 0 12px;border-radius:20px;background:${s.ground};border:1.5px solid ${s.rule}}
  .t small{font-size:18px;color:${s.faint};font-weight:600}
  .t b{font-size:30px;font-weight:800;letter-spacing:-.01em}
  .t span{font-size:22px;color:${s.muted}}
  .t.past{opacity:.4}
  .t.now{background:${s.accent};border-color:${s.accent};color:${s.onAccent}}
  .t.now small,.t.now span{color:${s.onAccent}}
  .br{display:grid;grid-template-columns:230px 1fr 112px;align-items:center;gap:18px;padding:7px 0}
  .br span{font-size:19px;color:${s.faint};letter-spacing:.02em}
  .bt{height:20px;border-radius:6px;background:${s.ground2}}
  .bt i{display:block;height:100%;border-radius:6px;background:${s.accent2}}
  .br:last-child .bt i{background:${s.accent}}
  .br b{text-align:right;font-size:25px;font-weight:750}
  ${ACTION_CSS(s)}`;

// ═══ ΜΑΚΡΟΧΡΟΝΙΑ · Ε01 · Η ΝΕΑ ΚΛΙΜΑΚΑ ΣΤΑ ΕΝΟΙΚΙΑ ════════════════════════
// Η γωνία: «έως τόσα λιγότερα» τραβά, αλλά η τίμια απάντηση είναι ότι στο
// συνηθισμένο ενοίκιο δεν αλλάζει τίποτα. Το επεισόδιο λέει και τα δύο: ποιος
// κερδίζει και από ποιο ενοίκιο και πάνω. Αυτό δεν το λέει η είδηση.
function makro01(): Episode {
  const s = SERIES.makro;
  const Y = FIRST_YEAR_NEW_BRACKETS;
  const ded = presumptiveDeductionRateForYear(Y, true);
  const save = (taxable: number) => rentalIncomeTax(taxable, RENTAL_TAX_BRACKETS_2025) - rentalIncomeTax(taxable, RENTAL_TAX_BRACKETS_2026);
  // Η μέγιστη διαφορά: πάνω από το τελευταίο όριο οι δύο κλίμακες τρέχουν
  // παράλληλα, άρα αρκεί να μετρηθεί εκεί. Επιβεβαιώνεται και ψηλότερα.
  const lastEdge = Math.max(...[...RENTAL_TAX_BRACKETS_2025, ...RENTAL_TAX_BRACKETS_2026].map(b => b.from));
  const maxSave = save(lastEdge);
  if (Math.abs(save(lastEdge * 3) - maxSave) > 0.005) throw new Error('Η διαφορά των κλιμάκων δεν σταθεροποιείται πάνω από το τελευταίο όριο.');
  const firstEdge = RENTAL_TAX_BRACKETS_2026[0].to;
  if (RENTAL_TAX_BRACKETS_2025[0].to !== firstEdge || RENTAL_TAX_BRACKETS_2025[0].rate !== RENTAL_TAX_BRACKETS_2026[0].rate)
    throw new Error('Το πρώτο κλιμάκιο άλλαξε· η γωνία «κάτω από αυτό δεν αλλάζει τίποτα» δεν ισχύει.');
  const rate0 = RENTAL_TAX_BRACKETS_2026[0].rate;
  const fromMonthly = Math.ceil(firstEdge / (1 - ded) / 12);
  // Το παράδειγμα: η προεπιλογή του υπολογιστή.
  const m = Number(RENT.enoikio), n = Number(RENT.mines);
  const gross = m * n, deduction = gross * ded, taxable = gross - deduction;
  const tax26 = rentalIncomeTax(taxable, RENTAL_TAX_BRACKETS_2026);
  const tax25 = rentalIncomeTax(taxable, RENTAL_TAX_BRACKETS_2025);
  if (Math.abs(tax25 - tax26) > 0.005) throw new Error('Στο παράδειγμα του υπολογιστή η κλίμακα αλλάζει τον φόρο· η γωνία θέλει αλλαγή.');
  const link = { url: `${SITE}/ypologismos-forou-enoikion`, label: 'Φόρος ενοικίων' };
  const pctR = (r: number) => `${Math.round(r * 100)}%`;

  // Δύο κλίμακες στην ίδια ευθεία: το ίδιο εισόδημα, άλλα χρώματα ανά συντελεστή.
  const scale = (f: Format) => {
    const end = lastEdge * 4 / 3;
    const tone = (rate: number) => ({ 0.15: s.accent2 + '99', 0.25: s.accent, 0.35: s.neg + 'aa', 0.45: s.neg }[rate as 0.15] ?? s.muted);
    const row = (label: string, br: TaxBracket[]) => `<div class="sc"><small class="mono">${label}</small><div class="sb">${br.map(b => {
      const a = b.from / end * 100, w = (Math.min(b.to, end) - b.from) / end * 100;
      return `<i style="left:${pc(a)};width:${pc(w)};background:${tone(b.rate)}"><em>${pctR(b.rate)}</em></i>`;
    }).join('')}</div></div>`;
    // Μόνο τα όρια της νέας κλίμακας: της παλιάς έπεφταν πάνω τους.
    const ticks = RENTAL_TAX_BRACKETS_2026.map(b => b.from).filter(x => x > 0);
    return `${row(`ΕΩΣ ${Y - 1}`, RENTAL_TAX_BRACKETS_2025)}${row(`ΑΠΟ ${Y}`, RENTAL_TAX_BRACKETS_2026)}
      <div class="ticks">${ticks.map(t => `<span style="left:${pc((t / end * 100))}">${esc(feWhole(t))}</span>`).join('')}</div>`;
  };
  const slides: Slide[] = [
    {
      alt: `Εξώφυλλο: νέα κλίμακα στα ενοίκια από το ${Y}, έως ${feWhole(maxSave)} λιγότερος φόρος τον χρόνο.`,
      sticker: `Quiz: «Τι φόρο έχουν τα πρώτα ${feWhole(firstEdge)};» · ${pctR(rate0)} / ${pctR(RENTAL_TAX_BRACKETS_2026[1].rate)} / ${pctR(RENTAL_TAX_BRACKETS_2026[2].rate)} (σωστό: ${pctR(rate0)})`,
      body: f => `
        <h1 style="font-size:var(--h1);margin-top:${f === 'story' ? 80 : 70}px">Νέα κλίμακα<br><span class="acc">στα ενοίκια.</span></h1>
        <p class="lead" style="margin-top:36px;max-width:900px">Για ενοίκια από 1/1/${Y}. Φαίνεται στη δήλωση του ${Y + 1}.</p>
        ${slot(f, 300, 'QUIZ')}
        <div class="big" style="margin-top:auto"><small class="mono">ΕΩΣ</small><b class="num acc">${esc(feWhole(maxSave))}</b><span>λιγότερος φόρος τον χρόνο</span></div>`,
    },
    {
      alt: `Οι δύο κλίμακες στην ίδια ευθεία: έως ${Y - 1} ${RENTAL_TAX_BRACKETS_2025.map(b => pctR(b.rate)).join(', ')}· από ${Y} ${RENTAL_TAX_BRACKETS_2026.map(b => pctR(b.rate)).join(', ')}. Νέο ενδιάμεσο κλιμάκιο ${pctR(RENTAL_TAX_BRACKETS_2026[1].rate)}.`,
      body: f => `
        <h2 style="font-size:var(--h2);margin-top:${f === 'story' ? 80 : 70}px">Μπαίνει<br>ένα <span class="acc">${pctR(RENTAL_TAX_BRACKETS_2026[1].rate)}</span> στη μέση.</h2>
        <p class="lead" style="margin-top:32px">Ο φόρος πέφτει ανά κομμάτι: κάθε συντελεστής πιάνει μόνο το κομμάτι του εισοδήματος που του αναλογεί.</p>
        <div class="card box" style="margin-top:auto">
          <div class="bx-h"><b>Φορολογητέο ενοίκιο τον χρόνο</b></div>
          ${scale(f)}
          <p class="src" style="margin-top:30px">ν.5246/2025 · ισχύει για εισόδημα από ${Y}</p>
        </div>`,
    },
    {
      alt: `Παράδειγμα: ${feWhole(m)} τον μήνα, ${feWhole(gross)} τον χρόνο, έκπτωση ${pctR(ded)}, φόρος ${feWhole(tax26)} και με τις δύο κλίμακες. Η αλλαγή αφορά ενοίκια πάνω από ${feWhole(fromMonthly)} τον μήνα.`,
      sticker: 'Δημοσκόπηση: «Το ενοίκιό σου είναι πάνω από αυτό;» · Ναι / Όχι',
      body: f => `
        <h2 style="font-size:var(--h2);margin-top:${f === 'story' ? 80 : 70}px">Με ${esc(feWhole(m))} τον μήνα,<br><span class="acc">δεν αλλάζει τίποτα.</span></h2>
        <p class="lead" style="margin-top:32px">Όλο το ποσό μένει στο πρώτο κλιμάκιο, στο ${pctR(rate0)}. Κερδίζει όποιος εισπράττει πάνω από ${esc(feWhole(fromMonthly))} τον μήνα.</p>
        ${slot(f, 190, 'POLL')}
        <div class="card box" style="margin-top:auto">
          <div class="bx-h"><b>Ενοίκιο ${esc(feWhole(m))} × ${n}</b><span class="ex">ΠΑΡΑΔΕΙΓΜΑ</span></div>
          ${waterfall(s, [
            { label: 'Ενοίκια', amount: gross, kind: 'in' },
            { label: `Έκπτωση ${pctR(ded)} για επισκευές`, amount: deduction, kind: 'out' },
            { label: `Φόρος ${pctR(rate0)}`, amount: tax26, kind: 'out' },
            { label: 'Καθαρά', amount: gross - tax26, kind: 'net' },
          ])}
          <p class="src" style="margin-top:20px">Ο φόρος είναι ${pct(tax26 / gross)} του ενοικίου, ίδιος με πέρσι.</p>
        </div>`,
    },
    {
      alt: 'Τελευταίο καρέ: «Βάλε το δικό σου ενοίκιο» στον δωρεάν υπολογιστή, πρόσκληση να σταλεί σε όποιον νοικιάζει σπίτι και το επόμενο επεισόδιο: ενοίκιο μέσω τράπεζας.',
      sticker: `Σύνδεσμος προς ${link.url} · κείμενο «Πόσος είναι ο φόρος μου;»`,
      body: f => `<div class="act" style="display:flex;flex-direction:column;flex:1">
        <h2 style="margin-top:${f === 'story' ? 80 : 70}px">Βάλε το<br><span class="acc">δικό σου ενοίκιο.</span></h2>
        <p class="lead" style="margin-top:32px">Ποσό, μήνες, χρονιά. Ο υπολογιστής βγάζει τον φόρο με τη σωστή κλίμακα για κάθε δήλωση. Χωρίς εγγραφή.</p>
        ${f === 'story' ? slot(f, 150, 'LINK') : `<div class="linkline" style="margin-top:40px">${ICON.link(s.accent, 34)}<span><b>properwise.gr</b>/ypologismos-forou-enoikion</span></div>`}
        <div style="margin-top:auto;display:flex;flex-direction:column;gap:18px">
          <div class="send">${ICON.send(s.onAccent, 40)}<span>Στείλ' το σε όποιον νοικιάζει σπίτι.</span></div>
          ${nextCard(s, SERIES.makro.day, `Ε02 · Ενοίκιο μέσω τράπεζας: τι αλλάζει από 1/${FIRST_MONTH_BANK_RECEIPT}/${FIRST_YEAR_BANK_RECEIPT}`)}
        </div></div>`,
    },
  ];
  return {
    series: 'makro', no: 1, title: 'Η νέα κλίμακα στα ενοίκια', link, slides,
    caption: [
      `Νέα κλίμακα στα ενοίκια από το ${Y}: έως ${feWhole(maxSave)} λιγότερος φόρος τον χρόνο. Αλλά όχι για όλους.`,
      '',
      `Μπαίνει ενδιάμεσο κλιμάκιο ${pctR(RENTAL_TAX_BRACKETS_2026[1].rate)}. Τα πρώτα ${feWhole(firstEdge)} φορολογητέου μένουν στο ${pctR(rate0)}, όπως πριν.`,
      '',
      `Με ${feWhole(m)} τον μήνα ο φόρος είναι ${feWhole(tax26)} τον χρόνο και με τις δύο κλίμακες. Κερδίζει όποιος εισπράττει πάνω από ${feWhole(fromMonthly)} τον μήνα. Η αλλαγή φαίνεται στη δήλωση του ${Y + 1}.`,
      '',
      'Βάλε το δικό σου ενοίκιο στον δωρεάν υπολογιστή, στο properwise.gr. Στείλ\' το σε όποιον νοικιάζει σπίτι.',
      '',
      '#ενοίκιο #φορολογίαενοικίων #ακίνητα #ιδιοκτήτες #φόροι',
    ].join('\n'),
  };
}
const MAKRO_CSS = (s: Palette) => `
  .big{display:flex;flex-direction:column;gap:4px}
  .big small{font-size:24px;color:${s.faint};letter-spacing:.2em}
  .big b{font-size:230px;font-weight:900;letter-spacing:-.065em;line-height:.9}
  .big span{font-size:38px;color:${s.muted};letter-spacing:-.01em}
  .box{padding:30px 34px}
  .bx-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:26px}
  .bx-h b{font-size:calc(var(--body) + 2px);font-weight:750}
  .sc{margin-bottom:22px}
  .sc small{display:block;font-size:19px;color:${s.faint};letter-spacing:.14em;margin-bottom:10px}
  .sb{position:relative;height:70px;border-radius:14px;overflow:hidden;background:#ffffff08}
  .sb i{position:absolute;top:0;bottom:0;display:flex;align-items:center;justify-content:center;border-right:3px solid ${s.card}}
  .sb em{font-style:normal;font-weight:800;font-size:26px;color:${s.onAccent}}
  .ticks{position:relative;height:28px}
  .ticks span{position:absolute;transform:translateX(-50%);font-family:'Roboto Mono',monospace;font-size:19px;color:${s.faint}}
  ${WF_CSS(s)}${ACTION_CSS(s)}`;

// ═══ HIGHLIGHTS ════════════════════════════════════════════════════════
// Ένα σύμβολο ανά σειρά, στο χρώμα της. Χωρίς λέξεις: το όνομα του Highlight
// γράφεται από κάτω από το ίδιο το Instagram.
const G = (c: string, d: string) => `<svg width="520" height="520" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const HIGHLIGHTS: { key: string; name: string; s: Palette; glyph: string }[] = [
  { key: 'makroxronia', name: 'Μακροχρόνια', s: SERIES.makro, glyph: G(SERIES.makro.accent, '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>') },
  { key: 'vraxyxronia', name: 'Βραχυχρόνια', s: SERIES.vraxy, glyph: G(SERIES.vraxy.accent, '<rect x="5" y="7" width="14" height="13" rx="2"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M5 12h14"/>') },
  { key: 'foroi', name: 'Φόροι', s: { ...SERIES.foroi }, glyph: G(SERIES.foroi.accent, '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M16 3v4M8 3v4M4 10h16"/><path d="M9 15l2 2 4-4"/>') },
  { key: 'ypologistes', name: 'Υπολογιστές', s: SERIES.vraxy, glyph: G(SERIES.vraxy.accent2, '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8"/><path d="M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/>') },
];

const EPISODES: { ep: Episode; css: string }[] = [
  { ep: vraxy01(), css: VRAXY_CSS(SERIES.vraxy) },
  { ep: foroi01(), css: FOROI_CSS(SERIES.foroi) },
  { ep: makro01(), css: MAKRO_CSS(SERIES.makro) },
];

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: chromePath(), args: ['--no-sandbox'] });
  const shot = async (html: string, w: number, h: number, path: string, f: Format | null) => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    if (f) {
      // ΤΙΠΟΤΑ ΕΞΩ ΑΠΟ ΤΟ ΚΑΔΡΟ ΚΑΙ, ΣΤΟ STORY, ΤΙΠΟΤΑ ΣΤΙΣ ΖΩΝΕΣ ΤΟΥ INSTAGRAM.
      const lim = f === 'story' ? [STORY_SAFE.top, STORY_SAFE.bottom, STORY_SAFE.side] : [40, h - 40, 40];
      const bad = await page.evaluate(([top, bottom, side]: number[]) => {
        const out: string[] = [];
        for (const el of Array.from(document.querySelectorAll('.wrap *, .foot *'))) {
          const r = (el as HTMLElement).getBoundingClientRect();
          if (!r.width || !r.height) continue;
          if (r.left < side - 0.5 || r.right > innerWidth - side + 0.5 || r.top < top || r.bottom > bottom) out.push(`${(el.textContent || el.tagName).trim().slice(0, 30)} [${Math.round(r.top)}–${Math.round(r.bottom)}]`);
        }
        // Και τίποτα να μην πατά πάνω στο άλλο: η κάρτα στη λωρίδα του αυτοκόλλητου.
        const wrap = document.querySelector('.wrap') as HTMLElement;
        if (wrap.scrollHeight > wrap.clientHeight + 1) out.push(`ξεχειλίζει κατά ${wrap.scrollHeight - wrap.clientHeight}px`);
        return out;
      }, lim);
      if (bad.length) throw new Error(`${path}: εκτός ζώνης: ${bad.slice(0, 4).join(' | ')}`);
    }
    await page.screenshot({ path });
    await page.close();
  };
  try {
    for (const { ep, css } of EPISODES) {
      const s = SERIES[ep.series];
      const dir = join(OUT, `${ep.series}-e${String(ep.no).padStart(2, '0')}`);
      mkdirSync(join(dir, 'story'), { recursive: true });
      mkdirSync(join(dir, 'carousel'), { recursive: true });
      for (const f of ['story', 'feed'] as Format[]) {
        const slides = ep.slides.filter(sl => !sl.only || sl.only === f);
        for (const [i, sl] of slides.entries()) {
          const { w, h } = SIZE[f];
          await shot(shell(f, s, ep, i, slides.length, sl.body(f), css), w, h, join(dir, f === 'story' ? 'story' : 'carousel', `${i + 1}.png`), f);
        }
      }
      console.log(`  ✓ ${ep.series}-e${String(ep.no).padStart(2, '0')}  (${PUBLISH[ep.series]})`);
    }
    mkdirSync(join(OUT, 'highlights'), { recursive: true });
    for (const hl of HIGHLIGHTS) await shot(highlight(hl.s, hl.glyph), 1080, 1920, join(OUT, 'highlights', `${hl.key}.png`), null);
    console.log('  ✓ highlights');
  } finally {
    await browser.close();
  }
  writeFileSync(join(OUT, 'README.md'), readme());
  console.log('✓ docs/marketing/instagram/seires/');
}

function readme(): string {
  const order = [...EPISODES].sort((a, b) => PUBLISH[a.ep.series].localeCompare(PUBLISH[b.ep.series]));
  return [
    '# Instagram: οι σειρές',
    '',
    'Παράγονται από το `npx tsx scripts/marketing/seires.ts`. Μην τα φτιάξεις με το χέρι:',
    'κάθε αριθμός βγαίνει από τη συνάρτηση που τον βγάζει και στην εφαρμογή. Η στρατηγική',
    'είναι στο `docs/marketing/instagram/SEIRES.md`.',
    '',
    'Ξαναπαράγεται το πρωί κάθε δημοσίευσης: οι ημερομηνίες μετρούν από τη μέρα που τρέχει.',
    '',
    ...order.flatMap(({ ep }) => {
      const s = SERIES[ep.series];
      const dir = `${ep.series}-e${String(ep.no).padStart(2, '0')}`;
      const day = elDate(PUBLISH[ep.series], { weekday: 'long', day: 'numeric', month: 'long' });
      return [
        `## ${s.name} · Ε${String(ep.no).padStart(2, '0')} · ${ep.title}`,
        '',
        `**Πότε:** ${day}. Story το μεσημέρι (13:00-14:00), carousel το βράδυ (19:00-21:00).`,
        `**Καταλήγει:** ${ep.link.url}`,
        '',
        '### Story, καρέ καρέ',
        '',
        ...ep.slides.filter(sl => sl.only !== 'feed').map((sl, i) => `${i + 1}. \`${dir}/story/${i + 1}.png\`${sl.sticker ? `. **Αυτοκόλλητο:** ${sl.sticker}. Μπαίνει στην άδεια λωρίδα.` : ''}`),
        '',
        '### Carousel (1080×1440)',
        '',
        '```',
        ep.caption,
        '```',
        '',
        '### Εναλλακτικό κείμενο',
        '',
        ...ep.slides.filter(sl => sl.only !== 'story').map((sl, i) => `${i + 1}. ${sl.alt}`),
        '',
      ];
    }),
    '## Highlights',
    '',
    'Εξώφυλλα 1080×1920 με το σύμβολο στο κέντρο, μέσα στον κύκλο που κόβει το Instagram:',
    '',
    ...HIGHLIGHTS.map(h => `- \`highlights/${h.key}.png\`: «${h.name}»`),
    '',
  ].join('\n');
}

main().catch(e => { console.error(e); process.exit(1); });
