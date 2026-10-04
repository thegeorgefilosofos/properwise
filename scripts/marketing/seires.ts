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
import { spawn } from 'node:child_process';
import { esc } from './igKit';
import { SERIES, SIZE, STORY_SAFE, cnt, shell, highlight, type Episode, type Format, type Palette, type SeriesKey, type Slide } from './seiresKit';
import { fe, feWhole, fp, fpRate } from '../../lib/core/format';
import { athensToday } from '../../lib/core/time';
import { compareShortVsLong, netByOccupancy, type ShortVsLongInput } from '../../lib/tools/shortVsLong';
import { SPEC as SVL } from '../../app/vraxyxronia-i-makroxronia/spec';
import { SPEC as RENT } from '../../app/ypologismos-forou-enoikion/spec';
import { SPEC as ENFIA } from '../../app/ypologismos-enfia/spec';
import { ENFIA_FLOOR_LABEL } from '../../lib/billing/enfiaFloors';
import { ico } from './igKit';
import {
  rentalIncomeTax, RENTAL_TAX_BRACKETS_2025, RENTAL_TAX_BRACKETS_2026, FIRST_YEAR_NEW_BRACKETS,
  FIRST_YEAR_BANK_RECEIPT, FIRST_MONTH_BANK_RECEIPT, isHighSeasonMonth, type TaxBracket,
} from '../../lib/billing/greekTax';
import { presumptiveDeductionRateForYear } from '../../lib/billing/presumptive';
import { ENFIA_AGE_BANDS, ENFIA_ZONE_TAX, zoneKeyFromPricePerSqm } from '../../lib/billing/enfia';
import { greekPropertyTaxObligations } from '../../lib/tax/greekTaxCalendar';
import { RENO_39B_TO } from '../../lib/accounting/renovation39b';
import { ASSISTANT_ACC, ASSISTANT_INITIAL, ASSISTANT_NAME } from '../../lib/assistant/identity';
import { billingWords } from '../../lib/legal/billingWords';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const { chromePath } = require('../lib/chrome.mjs');

const ROOT = process.cwd();

// ── ΤΟ ΒΙΝΤΕΟ ────────────────────────────────────────────────────────────
// Με `--video` κάθε καρέ story βγαίνει και ως MP4 (H.264, 30 καρέ/δ.), όπως το
// δέχεται το Instagram από το τηλέφωνο. Θέλει ffmpeg: από το FFMPEG, αλλιώς
// από το `ffmpeg-static` αν είναι εγκατεστημένο (npm i --no-save ffmpeg-static),
// αλλιώς από το PATH. Τα MP4 δεν μπαίνουν στο αποθετήριο (.gitignore).
const VIDEO = process.argv.includes('--video');
const FPS = 30;
const ffmpegPath = (): string => {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try { return require('ffmpeg-static') as string; } catch { return 'ffmpeg'; }
};
const OUT = join(ROOT, 'docs/marketing/instagram/seires');
const SITE = 'https://properwise.gr';

// ── Ο ΣΤΟΧΟΣ ΕΙΝΑΙ ΤΟ ΚΛΙΚ ───────────────────────────────────────────────
// Κάθε επεισόδιο στέλνει σε υπολογιστή ή οδηγό (επίσκεψη) και κλείνει με τη
// Νόα και την εγγραφή. Οι σύνδεσμοι κουβαλούν utm, ώστε η επίσκεψη και η
// εγγραφή να γράφονται στο Instagram (lib/analytics/signupFunnel.ts) και να
// φαίνεται ποιο επεισόδιο τις έφερε.
const utm = (path: string, campaign: string, medium: 'story' | 'carousel' = 'story') =>
  `${SITE}${path}?utm_source=instagram&utm_medium=${medium}&utm_campaign=${campaign}`;
/** Η δοκιμή, με τα λόγια του billingWords: η Νόα δεν είναι στο δωρεάν πακέτο. */
const TRIAL = billingWords().trialBadge;

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

/**
 * ΠΟΥ ΠΑΝΕ ΤΑ ΕΣΟΔΑ. Μία μπάρα ίση με τα έσοδα, κομμένη στα κομμάτια της. Από
 * κάτω κάθε κομμάτι με το ποσό και το μερίδιό του. Τα κομμάτια πρέπει να
 * αθροίζουν στα έσοδα και τα στρογγυλεμένα μερίδια στο 100%: αλλιώς η μηχανή
 * σταματά, γιατί ένα γράφημα που δεν κλείνει είναι λάθος, όχι λεπτομέρεια.
 */
type Part = { label: string; amount: number; color: string; net?: boolean };
function split(s: Palette, total: { label: string; amount: number }, parts: Part[], start = 1.0): string {
  const sum = parts.reduce((a, p) => a + p.amount, 0);
  if (Math.abs(sum - total.amount) > 0.5) throw new Error(`Τα κομμάτια (${sum}) δεν αθροίζουν στα έσοδα (${total.amount}).`);
  const shares = parts.map(p => Math.round(p.amount / total.amount * 100));
  if (shares.reduce((a, x) => a + x, 0) !== 100) throw new Error(`Τα μερίδια αθροίζουν ${shares.reduce((a, x) => a + x, 0)}%, όχι 100%.`);
  return `<div class="sp">
    <div class="sp-h"><span>${esc(total.label)}</span><b class="num">${cnt(total.amount, feWhole(total.amount), start - 0.5, feWhole)}</b></div>
    <div class="sp-bar">${parts.map(p => `<i style="flex:${p.amount};background:${p.color}"></i>`).join('')}</div>
    <div class="sp-rows">${parts.map((p, k) => {
      const sign = p.net ? '' : '−';
      return `<div class="sp-r${p.net ? ' net' : ''}"><i style="background:${p.color}"></i><span>${esc(p.label)}</span><em>${esc(fpRate(shares[k]))}</em><b class="num"${p.net ? ` style="color:${p.color}"` : ''}>${cnt(p.amount, `${sign}${feWhole(p.amount)}`, start + 0.7 + k * 0.28, x => `${sign}${feWhole(x)}`)}</b></div>`;
    }).join('')}</div>
  </div>`;
}
const SPLIT_CSS = (s: Palette) => `
  .sp-h{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:20px;font-size:var(--body);color:${s.muted}}
  .sp-h b{font-size:46px;font-weight:850;color:${s.ink};letter-spacing:-.03em}
  .sp-bar{display:flex;gap:6px;height:78px}
  .sp-bar i{display:block;border-radius:10px;min-width:8px}
  .sp-bar i:first-child{border-radius:18px 10px 10px 18px}
  .sp-bar i:last-child{border-radius:10px 18px 18px 10px}
  .sp-rows{margin-top:20px;display:flex;flex-direction:column}
  .sp-r{display:grid;grid-template-columns:20px 1fr 86px 170px;align-items:center;gap:16px;padding:14px 0;border-bottom:1.5px solid ${s.rule}99;font-size:var(--body);color:${s.muted}}
  .sp-r i{width:18px;height:18px;border-radius:6px}
  .sp-r em{font-style:normal;text-align:right;font-family:'Roboto Mono',monospace;font-size:22px;color:${s.faint}}
  .sp-r b{text-align:right;color:${s.ink};font-weight:700;font-size:calc(var(--body) + 2px)}
  .sp-r.net{border-bottom:0;padding-top:18px;color:${s.ink};font-weight:750}
  .sp-r.net b{font-size:44px;font-weight:850;letter-spacing:-.03em}`;

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

/**
 * Η κάρτα «Την επόμενη Τετάρτη»: αυτό που φέρνει τον θεατή πίσω. Χωρίς τη λέξη
 * «επεισόδιο», που στο story ακούγεται τηλεόραση· η μέρα λέει το ραντεβού.
 */
const nextCard = (s: Palette, day: string, title: string) => `
  <div class="next card"><small class="mono">ΤΗΝ ΕΠΟΜΕΝΗ ${esc(day.toLocaleUpperCase('el').normalize('NFD').replace(/[\u0301]/g, '').normalize('NFC'))}</small><b>${esc(title)}</b></div>`;
/**
 * Ο υπολογιστής όπως ανοίγει: τα πεδία με τις προεπιλογές του (spec.ts) και,
 * όπου το επεισόδιο τον έχει ήδη δείξει, το αποτέλεσμα. Στο κλικ ο θεατής
 * βλέπει ακριβώς αυτή την οθόνη και αλλάζει τα δικά του.
 */
function calcCard(s: Palette, path: string, fields: [string, string][], result: [string, string] | null, value?: number): string {
  return `<div class="calc card">
    <div class="cc-top"><span class="mono">properwise.gr${esc(path)}</span><span class="ex">ΧΩΡΙΣ ΕΓΓΡΑΦΗ</span></div>
    <div class="cc-grid">${fields.map(([l, v]) => `<div class="cc-f"><small>${esc(l)}</small><b class="num">${esc(v)}</b></div>`).join('')}</div>
    ${result
      ? `<div class="cc-res"><span>${esc(result[0])}</span><b class="num">${value == null ? esc(result[1]) : cnt(value, result[1], 1.6, n => `${result[1].startsWith('+') ? '+' : ''}${feWhole(n)}`)}</b></div>`
      : `<div class="cc-res"><span>Το αποτέλεσμα</span><b class="go">στον υπολογιστή ${ico.arrow(s.accent, 30)}</b></div>`}
  </div>`;
}
const ACTION_CSS = (s: Palette) => `
  .act h2{font-size:var(--h2)}
  .send{display:flex;align-items:center;gap:22px;padding:28px 32px;border-radius:30px;background:${s.accent};color:${s.onAccent};font-size:calc(var(--body) + 4px);font-weight:750;letter-spacing:-.01em;line-height:1.25}
  .send svg{flex:none}
  .next{padding:28px 32px;display:flex;flex-direction:column;gap:10px}
  .next small{font-size:19px;color:${s.faint};letter-spacing:.14em}
  .next b{font-size:calc(var(--body) + 6px);font-weight:750;letter-spacing:-.015em;line-height:1.2}
  .linkline{display:flex;align-items:center;gap:14px;font-size:var(--body);color:${s.muted}}
  .linkline b{color:${s.ink}}
  .calc{padding:24px 28px 26px;margin-top:40px}
  .cc-top{display:flex;align-items:center;justify-content:space-between;padding-bottom:18px;margin-bottom:18px;border-bottom:1.5px solid ${s.rule}}
  .cc-top .mono{font-size:19px;color:${s.muted};letter-spacing:.02em}
  .cc-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .cc-f{padding:14px 18px;border-radius:18px;background:#0a111d;border:1.5px solid ${s.rule}}
  .cc-f small{display:block;font-size:19px;color:${s.faint}}
  .cc-f b{display:block;font-size:31px;font-weight:750;margin-top:4px}
  .cc-res{display:flex;align-items:center;justify-content:space-between;margin-top:16px;padding:20px 22px;border-radius:20px;background:${s.accent}1a;border:1.5px solid ${s.accent}55}
  .cc-res span{font-size:var(--body);color:${s.muted}}
  .cc-res b{font-size:44px;font-weight:850;color:${s.accent};letter-spacing:-.03em}
  .cc-res b.go{display:flex;align-items:center;gap:10px;font-size:30px;font-weight:750;letter-spacing:-.01em}
  .chat{padding:26px 30px 30px;display:flex;flex-direction:column;gap:16px}
  .ch-top{display:flex;align-items:center;gap:16px;padding-bottom:16px;border-bottom:1.5px solid ${s.rule}}
  .ch-top b{display:block;font-size:28px;font-weight:750}
  .ch-top small{display:block;font-size:21px;color:${s.faint};margin-top:2px}
  .ch-top .ex{margin-left:auto}
  .ask{align-self:flex-end;max-width:86%;padding:18px 24px;border-radius:26px 26px 8px 26px;background:${s.accent};color:${s.onAccent};font-size:calc(var(--body) + 2px);font-weight:650;line-height:1.3}
  .ans{align-self:flex-start;max-width:94%;padding:20px 24px;border-radius:26px 26px 26px 8px;background:#0a111d;border:1.5px solid ${s.rule};font-size:var(--body);line-height:1.42;color:${s.ink}}
  .ans-w{position:relative}
  .typing{position:absolute;left:0;top:0;display:flex;gap:9px;padding:24px 26px;border-radius:26px 26px 26px 8px;background:#0a111d;border:1.5px solid ${s.rule}}
  .typing i{width:13px;height:13px;border-radius:50%;background:${s.faint}}
  .trial{margin-top:30px;font-size:calc(var(--body) + 2px);color:${s.muted}}
  .trial b{color:${s.accent};font-weight:800}`;

// ═══ Η ΝΟΑ, ΣΕ ΚΑΘΕ ΕΠΕΙΣΟΔΙΟ ═══════════════════════════════════════════
// Το τελευταίο καρέ: η ίδια ερώτηση του επεισοδίου, όπως θα την έκανε κάποιος
// για το δικό του ακίνητο και η απάντηση με τα ίδια νούμερα. Από κάτω η
// δοκιμή και το επόμενο επεισόδιο. Η Νόα δεν έχει φύλο και δεν λέγεται
// «βοηθός» (lib/assistant/identity.ts)· μιλά σε πρώτο πρόσωπο χωρίς επίθετα.
function noaSlide(s: Palette, campaign: string, q: string, a: string, next: { day: string; title: string }): Slide {
  return {
    seconds: 9,
    alt: `${ASSISTANT_NAME}: ερώτηση «${q}» και απάντηση με τα ίδια νούμερα. Κάτω, πρόσκληση για δοκιμή και το επόμενο θέμα: ${next.title}.`,
    sticker: `Σύνδεσμος προς ${utm('/signup', campaign)} · κείμενο «Ρώτα ${ASSISTANT_ACC}»`,
    body: f => `<div class="act" style="display:flex;flex-direction:column;flex:1">
      <h2 style="margin-top:${f === 'story' ? 70 : 60}px">Και το δικό σου;<br><span class="acc">Ρώτα ${esc(ASSISTANT_ACC)}.</span></h2>
      <div class="chat card" style="margin-top:${f === 'story' ? 44 : 36}px">
        <div class="ch-top"><span class="noa-av" style="width:58px;height:58px;font-size:30px">${esc(ASSISTANT_INITIAL)}</span><div><b>${esc(ASSISTANT_NAME)}</b><small>Για τα ακίνητά σου</small></div><span class="ex">ΠΑΡΑΔΕΙΓΜΑ</span></div>
        <div class="ask">${esc(q)}</div>
        <div class="ans-w"><div class="typing"><i></i><i></i><i></i></div><div class="ans">${esc(a)}</div></div>
      </div>
      <div class="trial"><b>${esc(TRIAL)}</b>, στο properwise.gr.</div>
      ${f === 'story' ? slot(f, 130, 'LINK') : ''}
      <div style="margin-top:auto">${nextCard(s, next.day, next.title)}</div>
    </div>`,
  };
}

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
  const camp = 'vraxy-e01';
  const r = compareShortVsLong(svlInput);
  if (r.breakEvenPct == null || r.breakEvenNights == null) throw new Error('Η σύγκριση δεν έχει σημείο ισορροπίας.');
  const bePct = Math.floor(r.breakEvenPct);
  // Η λέξη για το πόσο μεγαλύτερα είναι τα έσοδα βγαίνει από τον λόγο, όχι από εντύπωση.
  const ratio = r.short.gross / r.long.gross;
  const grossWord = ratio >= 1.9 && ratio < 2.3 ? 'Διπλάσια' : ratio >= 1.4 && ratio < 1.9 ? 'Μιάμιση φορά' : null;
  if (!grossWord) throw new Error(`Ο λόγος εσόδων ${ratio.toFixed(2)} δεν έχει λέξη· το κείμενο θέλει αλλαγή.`);
  const kept = r.short.net / r.short.gross;
  if (kept < 0.4 || kept > 0.6) throw new Error(`Μένει το ${fp(kept * 100)} των εσόδων· το «τα μισά φεύγουν» δεν ισχύει.`);
  if (r.difference <= 0) throw new Error('Στο παράδειγμα κερδίζει η μακροχρόνια· η γωνία του επεισοδίου θέλει αλλαγή.');
  const novLow = !isHighSeasonMonth(10) && isHighSeasonMonth(9);
  if (!novLow) throw new Error('Η αλλαγή σεζόν του ΤΑΚΚ δεν είναι πια την 1η Νοεμβρίου· το «Επόμενο» θέλει αλλαγή.');
  const STEPS = [20, 30, 40, 50, 60, 70, 80, 90];
  if (!STEPS.includes(svlInput.occupancyPct)) throw new Error('Η πληρότητα του παραδείγματος δεν είναι σημείο της καμπύλης.');
  const curve = netByOccupancy(svlInput, STEPS);
  const link = { url: `${SITE}/vraxyxronia-i-makroxronia`, label: 'Βραχυχρόνια ή μακροχρόνια' };
  const SEND = 'Στείλ\' το σε όποιον ενδιαφέρεται να μισθώσει το ακίνητό του.';

  // ── Η ΚΑΜΠΥΛΗ ─────────────────────────────────────────────────────────
  // Τα καθαρά της βραχυχρόνιας ανά πληρότητα, απέναντι στη σταθερή γραμμή
  // της μακροχρόνιας. Αριστερά από το σημείο τομής η περιοχή είναι πράσινη
  // (αποφέρει περισσότερα η μακροχρόνια), δεξιά γαλάζια. Ο άξονας των ποσών
  // έχει στρογγυλά βήματα που καλύπτουν το μέγιστο· τίποτα δεν βγαίνει έξω.
  const chart = (f: Format) => {
    const W = f === 'story' ? 844 : 836, Hh = f === 'story' ? 540 : 470;
    const padL = 104, padR = 18, padT = 74, padB = 58;
    const maxNet = Math.max(...curve.map(c => c.net), r.long.net);
    const step = [1000, 2000, 2500, 5000, 10000].find(x => maxNet / x <= 4) ?? 10000;
    const top = Math.ceil(maxNet / step) * step;
    const ticks = Array.from({ length: top / step + 1 }, (_, k) => k * step);
    const xs = (p: number) => padL + (p - STEPS[0]) / (STEPS[STEPS.length - 1] - STEPS[0]) * (W - padL - padR);
    const ys = (v: number) => padT + (1 - v / top) * (Hh - padT - padB);
    const line = curve.map((c, k) => `${k ? 'L' : 'M'}${xs(c.pct).toFixed(1)},${ys(c.net).toFixed(1)}`).join(' ');
    const by = ys(r.long.net), bx = xs(r.breakEvenPct!);
    const band = `${line} L${xs(90).toFixed(1)},${by.toFixed(1)} L${xs(20).toFixed(1)},${by.toFixed(1)} Z`;
    const mine = curve.find(c => c.pct === svlInput.occupancyPct)!;
    const mx = xs(mine.pct), my = ys(mine.net);
    return `<svg width="${W}" height="${Hh}" viewBox="0 0 ${W} ${Hh}" style="display:block">
      <defs>
        <clipPath id="cl"><rect x="0" y="0" width="${bx.toFixed(1)}" height="${Hh}"/></clipPath>
        <clipPath id="cr"><rect x="${bx.toFixed(1)}" y="0" width="${(W - bx).toFixed(1)}" height="${Hh}"/></clipPath>
      </defs>
      ${ticks.map(v => `<line x1="${padL}" x2="${W - padR}" y1="${ys(v).toFixed(1)}" y2="${ys(v).toFixed(1)}" stroke="${s.rule}" stroke-width="${v ? 1.5 : 2.5}"/>
        <text x="${padL - 16}" y="${(ys(v) + 7).toFixed(1)}" text-anchor="end" fill="${s.faint}" font-family="Roboto Mono" font-size="20">${esc(feWhole(v))}</text>`).join('')}
      <path class="area" d="${band}" fill="${s.ok}" fill-opacity=".22" clip-path="url(#cl)"/>
      <path class="area" d="${band}" fill="${s.accent}" fill-opacity=".22" clip-path="url(#cr)"/>
      <line x1="${padL}" x2="${W - padR}" y1="${by.toFixed(1)}" y2="${by.toFixed(1)}" stroke="${s.ok}" stroke-width="4" stroke-dasharray="14 10"/>
      <path class="draw" pathLength="1" d="${line}" fill="none" stroke="${s.accent}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/>
      ${curve.map((c, k) => `<circle class="dot" style="animation-delay:${(1.3 + k * 0.2).toFixed(2)}s" cx="${xs(c.pct).toFixed(1)}" cy="${ys(c.net).toFixed(1)}" r="7" fill="${s.panel}" stroke="${s.accent}" stroke-width="4"/>`).join('')}
      <line class="callout" x1="${bx.toFixed(1)}" x2="${bx.toFixed(1)}" y1="${by.toFixed(1)}" y2="${ys(0).toFixed(1)}" stroke="${s.ink}" stroke-opacity=".55" stroke-width="2" stroke-dasharray="4 6"/>
      <circle class="dot" style="animation-delay:3.0s" cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="14" fill="${s.ink}"/>
      <circle class="dot" style="animation-delay:2.8s" cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="14" fill="${s.accent}" stroke="${s.panel}" stroke-width="4"/>
      <g class="callout">
        <rect x="${(mx - 92).toFixed(1)}" y="${(my - 100).toFixed(1)}" width="184" height="48" rx="24" fill="${s.accent}"/>
        <text x="${mx.toFixed(1)}" y="${(my - 67).toFixed(1)}" text-anchor="middle" fill="${s.onAccent}" font-family="Inter" font-size="24" font-weight="800">${esc(feWhole(mine.net))}</text>
        <rect x="${(bx - 92).toFixed(1)}" y="${(by + 26).toFixed(1)}" width="184" height="48" rx="24" fill="${s.ink}"/>
        <text x="${bx.toFixed(1)}" y="${(by + 59).toFixed(1)}" text-anchor="middle" fill="${s.ground}" font-family="Inter" font-size="24" font-weight="800">όριο ${bePct}%</text>
      </g>
      ${curve.map(c => `<text x="${xs(c.pct).toFixed(1)}" y="${Hh - 18}" text-anchor="middle" fill="${c.pct === mine.pct ? s.accent : s.faint}" font-family="Roboto Mono" font-size="20" font-weight="${c.pct === mine.pct ? 700 : 400}">${c.pct}%</text>`).join('')}
    </svg>`;
  };
  const legend = `<div class="lg"><span><i class="ln" style="background:${s.accent}"></i>Βραχυχρόνια</span><span><i class="ln dash" style="border-color:${s.ok}"></i>Μακροχρόνια ${esc(feWhole(r.long.net))}</span></div>`;

  const slides: Slide[] = [
    {
      alt: `Εξώφυλλο: «Βραχυχρόνια ή μακροχρόνια;». Το ίδιο διαμέρισμα ${svlInput.sqm} τ.μ., με ${feWhole(svlInput.monthlyRent)} τον μήνα ή ${feWhole(svlInput.nightlyPrice)} τη διανυκτέρευση.`,
      sticker: 'Quiz: «Ποιο είδος μίσθωσης αποφέρει περισσότερα;» · Βραχυχρόνια / Μακροχρόνια / Εξαρτάται από την πληρότητα (σωστό: το τρίτο)',
      body: f => `
        <h1 style="font-size:calc(var(--h1) - 16px);margin-top:${f === 'story' ? 80 : 70}px">Βραχυχρόνια<br><span class="acc" style="white-space:nowrap">ή μακροχρόνια;</span></h1>
        <p class="lead" style="margin-top:36px">Το ίδιο διαμέρισμα των ${svlInput.sqm} τ.μ. Ποιο είδος μίσθωσης αποφέρει περισσότερα;</p>
        ${slot(f, 300, 'QUIZ')}
        <div class="duo" style="margin-top:auto">
          <div class="card d"><small class="mono">ΜΑΚΡΟΧΡΟΝΙΑ</small><b class="num">${esc(feWhole(svlInput.monthlyRent))}</b><span>τον μήνα</span></div>
          <div class="vs mono">Ή</div>
          <div class="card d hot"><small class="mono">ΒΡΑΧΥΧΡΟΝΙΑ</small><b class="num">${esc(feWhole(svlInput.nightlyPrice))}</b><span>τη διανυκτέρευση</span></div>
        </div>`,
    },
    {
      alt: `Μακροχρόνια: ενοίκια ${feWhole(r.long.gross)} τον χρόνο, φόρος ${feWhole(r.long.tax)}, καθαρά ${feWhole(r.long.net)}. Δώδεκα μήνες με ${feWhole(svlInput.monthlyRent)} τον καθένα.`,
      body: f => `
        <h2 style="margin-top:${f === 'story' ? 80 : 70}px">Μακροχρόνια:<br><span class="ok num">${cnt(r.long.net, feWhole(r.long.net), 0.5, feWhole)}</span> καθαρά.</h2>
        <p class="lead" style="margin-top:32px">Ένας ενοικιαστής, ${esc(feWhole(svlInput.monthlyRent))} τον μήνα. Από τα έσοδα αφαιρείται μόνο ο φόρος.</p>
        <div class="mos">${Array.from({ length: 12 }, (_, k) => `<div class="mo"><small>${esc(elDate(`2026-${String(k + 1).padStart(2, '0')}-15`, { month: 'short' }).replace('.', ''))}</small><b class="num">${esc(feWhole(svlInput.monthlyRent))}</b></div>`).join('')}</div>
        <div class="card box" style="margin-top:auto">
          <div class="bx-h"><b>Η χρονιά σε αριθμούς</b><span class="ex">ΠΑΡΑΔΕΙΓΜΑ</span></div>
          ${split(s, { label: 'Ενοίκια', amount: r.long.gross }, [
            { label: 'Φόρος εισοδήματος', amount: r.long.tax, color: s.neg },
            { label: 'Καθαρά', amount: r.long.net, color: s.ok, net: true },
          ])}
        </div>`,
    },
    {
      alt: `Βραχυχρόνια με πληρότητα ${svlInput.occupancyPct}%: ${r.short.nights} διανυκτερεύσεις, έσοδα ${feWhole(r.short.gross)}. Προμήθεια ${feWhole(r.short.platformFee)}, καθαριότητα και πάγια ${feWhole(r.short.running)}, φόρος ${feWhole(r.short.tax)}, καθαρά ${feWhole(r.short.net)}.`,
      sticker: 'Δημοσκόπηση: «Ήξερες πόσο κοστίζει η προμήθεια της πλατφόρμας;» · Ναι / Όχι',
      body: f => `
        <h2 style="margin-top:${f === 'story' ? 80 : 70}px">Βραχυχρόνια:<br><span class="acc num">${cnt(r.short.net, feWhole(r.short.net), 0.5, feWhole)}</span> καθαρά.</h2>
        <p class="lead" style="margin-top:32px">${r.short.nights} διανυκτερεύσεις, πληρότητα ${svlInput.occupancyPct}%. ${grossWord} έσοδα, αλλά τα μισά φεύγουν σε τρία σημεία.</p>
        ${slot(f, 120, 'POLL')}
        <div class="card box" style="margin-top:auto">
          <div class="bx-h"><b>Η χρονιά σε αριθμούς</b><span class="ex">ΠΑΡΑΔΕΙΓΜΑ</span></div>
          ${split(s, { label: 'Έσοδα από διανυκτερεύσεις', amount: r.short.gross }, [
            { label: `Προμήθεια πλατφόρμας`, amount: r.short.platformFee, color: s.warm },
            { label: 'Καθαριότητα και πάγια', amount: r.short.running, color: s.other },
            { label: 'Φόρος εισοδήματος', amount: r.short.tax, color: s.neg },
            { label: 'Καθαρά', amount: r.short.net, color: s.accent, net: true },
          ])}
          <p class="src" style="margin-top:16px">Το τέλος ανθεκτικότητας (${esc(feWhole(r.short.levy))}) το πληρώνει ο επισκέπτης και το αποδίδεις εσύ.</p>
        </div>`,
    },
    {
      alt: `Καμπύλη: καθαρά της βραχυχρόνιας ανά πληρότητα, απέναντι στα ${feWhole(r.long.net)} της μακροχρόνιας. Η τομή είναι στο ${bePct}%, δηλαδή ${r.breakEvenNights} διανυκτερεύσεις τον χρόνο. Στο ${svlInput.occupancyPct}% η βραχυχρόνια αποφέρει ${feWhole(mineNet())}.`,
      sticker: 'Ερώτηση: «Τι πληρότητα έχει το δικό σου;»',
      body: f => `
        <h2 style="margin-top:${f === 'story' ? 80 : 70}px">Το όριο είναι<br>το <span class="acc num">${bePct}%</span>.</h2>
        <p class="lead" style="margin-top:32px">Κάτω από ${r.breakEvenNights} διανυκτερεύσεις τον χρόνο, η μακροχρόνια αποφέρει περισσότερα.</p>
        ${slot(f, 60, 'QUESTION')}
        <div class="card box" style="margin-top:auto;padding-bottom:20px">
          <div class="bx-h"><b>Καθαρά ανά πληρότητα</b><span class="ex">ΠΑΡΑΔΕΙΓΜΑ</span></div>
          ${legend}
          ${chart(f)}
        </div>`,
    },
    {
      alt: `«Βάλε τα δικά σου δεδομένα»: ο δωρεάν υπολογιστής με ενοίκιο ${feWhole(svlInput.monthlyRent)}, ${feWhole(svlInput.nightlyPrice)} τη διανυκτέρευση, πληρότητα ${svlInput.occupancyPct}% και προμήθεια ${svlInput.platformFeePct}%. Διαφορά υπέρ βραχυχρόνιας ${feWhole(r.difference)}. Κάτω, «${SEND}»`,
      sticker: `Σύνδεσμος προς ${utm(link.url.slice(SITE.length), camp)} · κείμενο «Κάνε τον λογαριασμό»`,
      body: f => `<div class="act" style="display:flex;flex-direction:column;flex:1">
        <h2 style="margin-top:${f === 'story' ? 80 : 70}px">Βάλε τα<br><span class="acc">δικά σου δεδομένα.</span></h2>
        <p class="lead" style="margin-top:28px">Τιμή, πληρότητα, προμήθεια. Δες ποιο είδος μίσθωσης αποφέρει περισσότερα.</p>
        ${calcCard(s, '/vraxyxronia-i-makroxronia', [
          ['Ενοίκιο τον μήνα', feWhole(svlInput.monthlyRent)], ['Τιμή διανυκτέρευσης', feWhole(svlInput.nightlyPrice)],
          ['Πληρότητα', fpRate(svlInput.occupancyPct)], ['Προμήθεια πλατφόρμας', fpRate(svlInput.platformFeePct)],
        ], ['Διαφορά υπέρ βραχυχρόνιας', `+${feWhole(r.difference)}`], r.difference)}
        ${slot(f, 130, 'LINK')}
        <div style="margin-top:auto"><div class="send">${ICON.send(s.onAccent, 40)}<span>${esc(SEND)}</span></div></div>
      </div>`,
    },
    noaSlide(s, camp, 'Ποιο είδος μίσθωσης μου αποφέρει περισσότερα;',
      `Με ${feWhole(svlInput.nightlyPrice)} τη διανυκτέρευση και πληρότητα ${svlInput.occupancyPct}%, η βραχυχρόνια αποφέρει ${feWhole(r.short.net)} καθαρά τον χρόνο, ${feWhole(r.difference)} περισσότερα από τη μακροχρόνια. Κάτω από ${bePct}% πληρότητα, αποφέρει περισσότερα η μακροχρόνια.`,
      { day: s.day, title: 'ΤΑΚΚ: τι αλλάζει την 1η Νοεμβρίου' }),
  ];
  function mineNet() { return curve.find(c => c.pct === svlInput.occupancyPct)!.net; }
  return {
    series: 'vraxy', no: 1, title: 'Βραχυχρόνια ή μακροχρόνια;', link, slides,
    caption: [
      'Βραχυχρόνια ή μακροχρόνια; Ποιο είδος μίσθωσης αποφέρει περισσότερα κρίνεται από ένα νούμερο: την πληρότητα.',
      '',
      `Το ίδιο διαμέρισμα των ${svlInput.sqm} τ.μ. Με ${feWhole(svlInput.monthlyRent)} τον μήνα, η μακροχρόνια αποφέρει ${feWhole(r.long.net)} καθαρά τον χρόνο. Με ${feWhole(svlInput.nightlyPrice)} τη διανυκτέρευση και πληρότητα ${svlInput.occupancyPct}%, η βραχυχρόνια αποφέρει ${feWhole(r.short.net)}, αφού αφαιρεθούν προμήθεια, καθαριότητα, πάγια και φόρος.`,
      '',
      `Το όριο είναι το ${bePct}%: κάτω από ${r.breakEvenNights} διανυκτερεύσεις τον χρόνο, αποφέρει περισσότερα η μακροχρόνια. Και ο χρόνος που απαιτεί η βραχυχρόνια δεν μπαίνει στον λογαριασμό.`,
      '',
      `Βάλε τα δικά σου δεδομένα στον δωρεάν υπολογιστή του properwise.gr, χωρίς εγγραφή. ${SEND}`,
      '',
      'Γράψε «ΥΠΟΛΟΓΙΣΤΗΣ» στα σχόλια και σου στέλνουμε τον σύνδεσμο σε μήνυμα. Είναι και στο βιογραφικό.',
      '',
      `Για το δικό σου ακίνητο, ρώτα ${ASSISTANT_ACC} μέσα στην εφαρμογή. Τη δοκιμάζεις από το properwise.gr.`,
      '',
      '#βραχυχρόνιαμίσθωση #airbnbgreece #ακίνητα #ενοίκιο #ιδιοκτήτες',
    ].join('\n'),
  };
}
const VRAXY_CSS = (s: Palette) => `
  .lg{display:flex;gap:28px;margin:-6px 0 14px;font-size:22px;color:${s.muted}}
  .lg span{display:flex;align-items:center;gap:10px}
  .ln{display:inline-block;width:34px;height:6px;border-radius:6px}
  .ln.dash{height:0;border-top:4px dashed;background:none}
  .mos{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-top:44px}
  .mo{display:flex;flex-direction:column;align-items:center;gap:2px;padding:14px 0;border-radius:18px;background:${s.ok}14;border:1.5px solid ${s.ok}40}
  .mo small{font-size:19px;color:${s.faint}}
  .mo b{font-size:23px;font-weight:750;color:${s.ok}}
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
  ${SPLIT_CSS(s)}${ACTION_CSS(s)}`;

// ═══ ΦΟΡΟΙ ΚΑΙ ΠΡΟΘΕΣΜΙΕΣ · Ε01 · Η ΕΠΟΜΕΝΗ ΔΟΣΗ ΤΟΥ ΕΝΦΙΑ ═════════════════
// Η γωνία: μια ημερομηνία που πλησιάζει και ένα αυτοκόλλητο αντίστροφης
// μέτρησης, που ο θεατής πατά για να του τη θυμίσει το ίδιο το Instagram.
// Μετά ο κανόνας (τελευταία εργάσιμη) και μια απάντηση στο «γιατί ο δικός
// μου είναι τόσος»: ο φόρος ανά τ.μ. ανά ζώνη, από τον πίνακα του νόμου.
function foroi01(): Episode {
  const s = SERIES.foroi;
  const camp = 'foroi-e01';
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
        <p class="lead" style="margin-top:28px">Σε ${daysLeft} ημέρες. Πάτα «Υπενθύμιση» και θα σου τη θυμίσει το Instagram.</p>
        ${slot(f, 230, 'COUNTDOWN')}`,
    },
    {
      alt: `Οι δώδεκα δόσεις του ΕΝΦΙΑ ${year}, η καθεμία την τελευταία εργάσιμη του μήνα της. Οι περασμένες σβησμένες, η ${next + 1}η φωτισμένη. Πηγή: ${law}.`,
      body: f => `
        <h2 style="margin-top:${f === 'story' ? 80 : 70}px">Τελευταία εργάσιμη<br><span class="acc">κάθε μήνα.</span></h2>
        <p class="lead" style="margin-top:32px">Δώδεκα δόσεις, από τον Μάρτιο ως τον Φεβρουάριο. Αν ο μήνας κλείνει με αργία ή Σαββατοκύριακο, η δόση λήγει νωρίτερα.</p>
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
        <h2 style="margin-top:${f === 'story' ? 80 : 70}px">Ίδια τετραγωνικά,<br><span class="acc">${Math.floor(zMax / zMin)} φορές</span> ο φόρος.</h2>
        <p class="lead" style="margin-top:32px">Ο ΕΝΦΙΑ ξεκινά από την τιμή ζώνης: από ${esc(fe(zMin))} έως ${esc(fe(zMax))} το τετραγωνικό, πριν από τους συντελεστές ορόφου και παλαιότητας.</p>
        ${slot(f, 160, 'QUESTION')}
        <div class="card bars" style="margin-top:auto">
          <div class="c-head"><b>Φόρος ανά τ.μ.</b><span class="mono">ΤΙΜΗ ΖΩΝΗΣ €/Τ.Μ.</span></div>
          ${zones.map(([k, v]) => `<div class="br${k === zoneKeyFromPricePerSqm(Number(ENFIA.zoni)) ? ' ex-z' : ''}"><span class="mono">${esc(zLabel(k))}</span><div class="bt"><i style="width:${pc((v / zMax * 100))}"></i></div><b class="num">${esc(fe(v))}</b></div>`).join('')}
        </div>`,
    },
    {
      alt: 'Τελευταίο καρέ: «Υπολόγισε τον δικό σου ΕΝΦΙΑ» στον δωρεάν υπολογιστή, πρόσκληση να σταλεί σε όποιον πληρώνει σε δόσεις και το επόμενο θέμα: η έκπτωση φόρου ανακαίνισης.',
      sticker: `Σύνδεσμος προς ${utm(link.url.slice(SITE.length), camp)} · κείμενο «Υπολόγισε τον ΕΝΦΙΑ»`,
      body: f => `<div class="act" style="display:flex;flex-direction:column;flex:1">
        <h2 style="margin-top:${f === 'story' ? 80 : 70}px">Πόσος είναι<br><span class="acc">ο δικός σου;</span></h2>
        <p class="lead" style="margin-top:28px">Βάλε τα στοιχεία του ακινήτου σου. Ο&nbsp;υπολογιστής εφαρμόζει και τις μειώσεις του νόμου.</p>
        ${calcCard(s, '/ypologismos-enfia', [
          ['Τετραγωνικά', `${ENFIA.tm} τ.μ.`], ['Τιμή ζώνης', `${feWhole(Number(ENFIA.zoni))}/τ.μ.`],
          ['Όροφος', ENFIA_FLOOR_LABEL[ENFIA.orofos]], ['Παλαιότητα', ENFIA_AGE_BANDS.find(b => b.key === ENFIA.palaiotita)!.label],
        ], null)}
        ${slot(f, 130, 'LINK')}
        <div style="margin-top:auto;display:flex;flex-direction:column;gap:18px">
          <div class="send">${ICON.send(s.onAccent, 40)}<span>Στείλ' το σε όποιον πληρώνει ΕΝΦΙΑ σε δόσεις.</span></div>
        </div></div>`,
    },
    noaSlide(s, camp, 'Πότε λήγει η επόμενη δόση του ΕΝΦΙΑ;',
      `${weekday} ${elDate(due.date, { day: 'numeric', month: 'long' })}. Είναι η ${next + 1}η από τις ${run.length}· μετά μένουν ${run.length - next - 1}, ως τις ${elDate(run[run.length - 1].date, { day: 'numeric', month: 'long', year: 'numeric' })}.`,
      { day: s.day, title: `Ανακαίνιση: η έκπτωση φόρου για δαπάνες ως ${RENO_39B_TO}` }),
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
      'Γράψε «ΥΠΟΛΟΓΙΣΤΗΣ» στα σχόλια και σου στέλνουμε τον σύνδεσμο σε μήνυμα. Είναι και στο βιογραφικό.',
      '',
      `Για το δικό σου ακίνητο, ρώτα ${ASSISTANT_ACC} μέσα στην εφαρμογή. Τη δοκιμάζεις από το properwise.gr.`,
      '',
      '#ΕΝΦΙΑ #ακίνητα #φόροι #ιδιοκτήτες #ΑΑΔΕ',
    ].join('\n'),
  };
}
const FOROI_CSS = (s: Palette) => `
  .stampbox{align-self:flex-start;display:flex;flex-direction:column;align-items:center;padding:30px 54px 34px;border:7px solid ${s.warm};border-radius:28px;
    color:${s.warm};transform:rotate(-4deg);background:${s.warm}12;box-shadow:0 0 120px -20px ${s.warm}55}
  .stampbox small{font-size:30px;letter-spacing:.4em;font-weight:700;margin-left:.4em}
  .stampbox b{font-size:240px;font-weight:900;letter-spacing:-.06em;line-height:.9;margin-top:6px}
  .stampbox span{font-size:34px;font-weight:700;letter-spacing:.02em;margin-top:6px}
  .cal,.bars{padding:28px 30px 26px}
  .c-head{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:22px}
  .c-head b{font-size:calc(var(--body) + 2px);font-weight:800}
  .c-head span{font-size:18px;color:${s.faint};letter-spacing:.12em}
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
  .t{display:flex;flex-direction:column;align-items:center;padding:14px 0 12px;border-radius:20px;background:#0a111d;border:1.5px solid ${s.rule}}
  .t small{font-size:18px;color:${s.faint};font-weight:600}
  .t b{font-size:30px;font-weight:800;letter-spacing:-.01em}
  .t span{font-size:22px;color:${s.muted}}
  .t.past > *{opacity:.4}
  .t.now{background:${s.warm};border-color:${s.warm};color:${s.onAccent};box-shadow:0 0 0 5px ${s.warm}33}
  .t.now small,.t.now span{color:${s.onAccent}}
  .br{display:grid;grid-template-columns:230px 1fr 112px;align-items:center;gap:18px;padding:7px 0}
  .br span{font-size:19px;color:${s.faint};letter-spacing:.02em}
  .bt{height:20px;border-radius:6px;background:#ffffff0a}
  .bt i{display:block;height:100%;border-radius:6px;background:${s.warm}}
  .br:last-child .bt i{background:${s.neg}}
  .br b{text-align:right;font-size:25px;font-weight:750}
  .br.ex-z span,.br.ex-z b{color:${s.ink};font-weight:800}
  .br.ex-z .bt{box-shadow:0 0 0 2px ${s.accent}}
  ${ACTION_CSS(s)}`;

// ═══ ΜΑΚΡΟΧΡΟΝΙΑ · Ε01 · Η ΝΕΑ ΚΛΙΜΑΚΑ ΣΤΑ ΕΝΟΙΚΙΑ ════════════════════════
// Η γωνία: «έως τόσα λιγότερα» τραβά, αλλά η τίμια απάντηση είναι ότι στο
// συνηθισμένο ενοίκιο δεν αλλάζει τίποτα. Το επεισόδιο λέει και τα δύο: ποιος
// κερδίζει και από ποιο ενοίκιο και πάνω. Αυτό δεν το λέει η είδηση.
function makro01(): Episode {
  const s = SERIES.makro;
  const camp = 'makro-e01';
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
    const tone = (rate: number) => ({ 0.15: s.ok, 0.25: s.accent, 0.35: s.warm, 0.45: s.neg }[rate as 0.15] ?? s.muted);
    const row = (label: string, br: TaxBracket[]) => `<div class="sc"><small class="mono">${label}</small><div class="sb">${br.map(b => {
      const a = b.from / end * 100, w = (Math.min(b.to, end) - b.from) / end * 100;
      return `<i style="left:${pc(a)};width:${pc(w)};background:${tone(b.rate)}"><em>${pctR(b.rate)}</em></i>`;
    }).join('')}</div></div>`;
    // Μόνο τα όρια της νέας κλίμακας: της παλιάς έπεφταν πάνω τους.
    const ticks = RENTAL_TAX_BRACKETS_2026.map(b => b.from).filter(x => x > 0);
    return `${row(`ΕΩΣ ${Y - 1}`, RENTAL_TAX_BRACKETS_2025)}${row(`ΑΠΟ ${Y}`, RENTAL_TAX_BRACKETS_2026)}
      <div class="ticks">${ticks.map(t => `<span style="left:${pc((t / end * 100))}">${esc(feWhole(t))}</span>`).join('')}</div>`;
  };
  // ── ΤΟ ΟΦΕΛΟΣ ΑΝΑ ΕΝΟΙΚΙΟ ─────────────────────────────────────────────
  // Η διαφορά των δύο κλιμάκων για κάθε μηνιαίο ενοίκιο, με την ίδια τεκμαρτή
  // έκπτωση που εφαρμόζει ο υπολογιστής. Τρία σημεία με όνομα: το ενοίκιο του
  // παραδείγματος (μηδέν), το όριο από το οποίο αρχίζει το όφελος, το ανώτατο.
  const savings = (f: Format) => {
    const W = f === 'story' ? 844 : 836, Hh = f === 'story' ? 430 : 420;
    const padL = 92, padR = 22, padT = 64, padB = 56;
    const monthlyOf = (taxableY: number) => taxableY / (1 - ded) / 12;
    const xMax = Math.ceil(monthlyOf(lastEdge) / 1000) * 1000 + 500;
    const yStep = [250, 500, 1000].find(x => maxSave / x <= 3) ?? 1000;
    const yTop = Math.ceil(maxSave / yStep) * yStep;
    const xs = (mo: number) => padL + mo / xMax * (W - padL - padR);
    const ys = (v: number) => padT + (1 - v / yTop) * (Hh - padT - padB);
    const pts: string[] = [];
    for (let mo = 0; mo <= xMax; mo += 10) pts.push(`${xs(mo).toFixed(1)},${ys(save(mo * 12 * (1 - ded))).toFixed(1)}`);
    const line = `M${pts.join(' L')}`;
    const area = `${line} L${xs(xMax).toFixed(1)},${ys(0).toFixed(1)} L${xs(0).toFixed(1)},${ys(0).toFixed(1)} Z`;
    const xTicks = Array.from({ length: Math.floor(xMax / 1000) + 1 }, (_, k) => k * 1000);
    const yTicks = Array.from({ length: yTop / yStep + 1 }, (_, k) => k * yStep);
    const ex = xs(m), th = xs(fromMonthly), pk = xs(monthlyOf(lastEdge));
    return `<svg width="${W}" height="${Hh}" viewBox="0 0 ${W} ${Hh}" style="display:block">
      <defs><linearGradient id="sv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.accent}" stop-opacity=".38"/><stop offset="1" stop-color="${s.accent}" stop-opacity="0"/></linearGradient></defs>
      ${yTicks.map(v => `<line x1="${padL}" x2="${W - padR}" y1="${ys(v).toFixed(1)}" y2="${ys(v).toFixed(1)}" stroke="${s.rule}" stroke-width="${v ? 1.5 : 2.5}"/>
        <text x="${padL - 14}" y="${(ys(v) + 7).toFixed(1)}" text-anchor="end" fill="${s.faint}" font-family="Roboto Mono" font-size="20">${esc(feWhole(v))}</text>`).join('')}
      ${xTicks.map(v => `<text x="${xs(v).toFixed(1)}" y="${Hh - 16}" text-anchor="middle" fill="${s.faint}" font-family="Roboto Mono" font-size="20">${esc(feWhole(v))}</text>`).join('')}
      <path class="area" d="${area}" fill="url(#sv)"/>
      <path class="draw" pathLength="1" d="${line}" fill="none" stroke="${s.accent}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/>
      <line class="callout" x1="${th.toFixed(1)}" x2="${th.toFixed(1)}" y1="${padT - 6}" y2="${ys(0).toFixed(1)}" stroke="${s.ink}" stroke-opacity=".5" stroke-width="2" stroke-dasharray="4 6"/>
      <circle class="dot" style="animation-delay:2.6s" cx="${ex.toFixed(1)}" cy="${ys(0).toFixed(1)}" r="13" fill="${s.ok}" stroke="${s.panel}" stroke-width="4"/>
      <circle class="dot" style="animation-delay:3.0s" cx="${pk.toFixed(1)}" cy="${ys(maxSave).toFixed(1)}" r="13" fill="${s.accent}" stroke="${s.panel}" stroke-width="4"/>
      <g class="callout">
        <rect x="${(ex - 70).toFixed(1)}" y="${(ys(0) - 68).toFixed(1)}" width="140" height="44" rx="22" fill="${s.ok}"/>
        <text x="${ex.toFixed(1)}" y="${(ys(0) - 38).toFixed(1)}" text-anchor="middle" fill="${s.onAccent}" font-family="Inter" font-size="22" font-weight="800">${esc(feWhole(m))}: 0€</text>
        <text x="${(th + 12).toFixed(1)}" y="${(padT - 26).toFixed(1)}" fill="${s.ink}" font-family="Inter" font-size="22" font-weight="700">από ${esc(feWhole(fromMonthly))}</text>
        <rect x="${(pk - 92).toFixed(1)}" y="${(ys(maxSave) - 70).toFixed(1)}" width="184" height="44" rx="22" fill="${s.accent}"/>
        <text x="${pk.toFixed(1)}" y="${(ys(maxSave) - 40).toFixed(1)}" text-anchor="middle" fill="${s.onAccent}" font-family="Inter" font-size="22" font-weight="800">έως ${esc(feWhole(maxSave))}</text>
      </g>
    </svg>`;
  };
  const slides: Slide[] = [
    {
      alt: `Εξώφυλλο: νέα κλίμακα στα ενοίκια από το ${Y}, έως ${feWhole(maxSave)} λιγότερος φόρος τον χρόνο.`,
      sticker: `Quiz: «Τι φόρο έχουν τα πρώτα ${feWhole(firstEdge)};» · ${pctR(rate0)} / ${pctR(RENTAL_TAX_BRACKETS_2026[1].rate)} / ${pctR(RENTAL_TAX_BRACKETS_2026[2].rate)} (σωστό: ${pctR(rate0)})`,
      body: f => `
        <h1 style="font-size:var(--h1);margin-top:${f === 'story' ? 80 : 70}px">Νέα κλίμακα<br><span class="acc">στα ενοίκια.</span></h1>
        <p class="lead" style="margin-top:36px">Για ενοίκια από 1/1/${Y}, με τη δήλωση του ${Y + 1}.</p>
        ${slot(f, 300, 'QUIZ')}
        <div class="big" style="margin-top:auto"><small class="mono">ΕΩΣ</small><b class="num acc">${cnt(maxSave, feWhole(maxSave), 0.9, feWhole)}</b><span>λιγότερος φόρος τον χρόνο</span></div>`,
    },
    {
      alt: `Οι δύο κλίμακες στην ίδια ευθεία: έως ${Y - 1} ${RENTAL_TAX_BRACKETS_2025.map(b => pctR(b.rate)).join(', ')}· από ${Y} ${RENTAL_TAX_BRACKETS_2026.map(b => pctR(b.rate)).join(', ')}. Νέο ενδιάμεσο κλιμάκιο ${pctR(RENTAL_TAX_BRACKETS_2026[1].rate)}.`,
      body: f => `
        <h2 style="margin-top:${f === 'story' ? 80 : 70}px">Νέο κλιμάκιο:<br><span class="acc">${pctR(RENTAL_TAX_BRACKETS_2026[1].rate)}</span> στη μέση.</h2>
        <p class="lead" style="margin-top:32px">Κάθε συντελεστής φορολογεί μόνο το κομμάτι του εισοδήματος που πέφτει στο κλιμάκιό του.</p>
        <div class="card box" style="margin-top:auto">
          <div class="bx-h"><b>Φορολογητέο ενοίκιο τον χρόνο</b></div>
          ${scale(f)}
          <p class="src" style="margin-top:30px">ν.5246/2025 · ισχύει για εισόδημα από ${Y}</p>
        </div>`,
    },
    {
      alt: `Γράφημα: πόσο λιγότερος φόρος τον χρόνο ανά μηνιαίο ενοίκιο. Μηδέν ως ${feWhole(fromMonthly)} τον μήνα, ανεβαίνει ως ${feWhole(maxSave)} και μένει εκεί. Με ${feWhole(m)} τον μήνα ο φόρος είναι ${feWhole(tax26)} και με τις δύο κλίμακες.`,
      sticker: 'Δημοσκόπηση: «Το ενοίκιό σου είναι πάνω από αυτό;» · Ναι / Όχι',
      body: f => `
        <h2 style="margin-top:${f === 'story' ? 80 : 70}px">Με ${esc(feWhole(m))} τον μήνα,<br><span class="acc">δεν αλλάζει τίποτα.</span></h2>
        <p class="lead" style="margin-top:32px">Όλο το φορολογητέο μένει στο ${pctR(rate0)}. Το όφελος αρχίζει πάνω από ${esc(feWhole(fromMonthly))} τον μήνα.</p>
        ${slot(f, 120, 'POLL')}
        <div class="card box" style="margin-top:auto;padding-bottom:20px">
          <div class="bx-h"><b>Λιγότερος φόρος τον χρόνο</b><span class="mono ax">ΑΝΑ ΜΗΝΙΑΙΟ ΕΝΟΙΚΙΟ</span></div>
          ${savings(f)}
          <p class="src" style="margin-top:14px">Με ${esc(feWhole(m))} τον μήνα ο φόρος είναι ${esc(feWhole(tax26))} τον χρόνο (${esc(fp(tax26 / gross * 100))} του ενοικίου) και με τις δύο κλίμακες.</p>
        </div>`,
    },
    {
      alt: `«Βάλε το δικό σου ενοίκιο»: ο δωρεάν υπολογιστής με ${feWhole(m)} τον μήνα για ${n} μήνες, φόρος ${feWhole(tax26)} τον χρόνο. Κάτω, πρόσκληση να σταλεί σε όποιον ενδιαφέρεται να μισθώσει το ακίνητό του.`,
      sticker: `Σύνδεσμος προς ${utm(link.url.slice(SITE.length), camp)} · κείμενο «Πόσος είναι ο φόρος μου;»`,
      body: f => `<div class="act" style="display:flex;flex-direction:column;flex:1">
        <h2 style="margin-top:${f === 'story' ? 80 : 70}px">Βάλε το<br><span class="acc">δικό σου ενοίκιο.</span></h2>
        <p class="lead" style="margin-top:28px">Ο υπολογιστής εφαρμόζει τη σωστή κλίμακα για κάθε χρονιά δήλωσης.</p>
        ${calcCard(s, '/ypologismos-forou-enoikion', [
          ['Ενοίκιο τον μήνα', feWhole(m)], ['Μήνες', String(n)],
          ['Χρονιά εισοδήματος', String(Y)], ['Μέσω τράπεζας', RENT.trapeza === '1' ? 'Ναι' : 'Όχι'],
        ], ['Φόρος τον χρόνο', feWhole(tax26)], tax26)}
        ${slot(f, 130, 'LINK')}
        <div style="margin-top:auto;display:flex;flex-direction:column;gap:18px">
          <div class="send">${ICON.send(s.onAccent, 40)}<span>Στείλ' το σε όποιον ενδιαφέρεται να μισθώσει το ακίνητό του.</span></div>
        </div></div>`,
    },
    noaSlide(s, camp, 'Πόσο φόρο θα πληρώσω για το ενοίκιο;',
      `Για ${feWhole(m)} τον μήνα, ${feWhole(tax26)} τον χρόνο, δηλαδή το ${fp(tax26 / gross * 100)} του ενοικίου. Η νέα κλίμακα δεν τον αλλάζει, γιατί όλο το ποσό μένει στο ${pctR(rate0)}.`,
      { day: s.day, title: `Ενοίκιο μέσω τράπεζας: τι αλλάζει από 1/${FIRST_MONTH_BANK_RECEIPT}/${FIRST_YEAR_BANK_RECEIPT}` }),
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
      'Βάλε το δικό σου ενοίκιο στον δωρεάν υπολογιστή, στο properwise.gr. Στείλ\' το σε όποιον ενδιαφέρεται να μισθώσει το ακίνητό του.',
      '',
      'Γράψε «ΥΠΟΛΟΓΙΣΤΗΣ» στα σχόλια και σου στέλνουμε τον σύνδεσμο σε μήνυμα. Είναι και στο βιογραφικό.',
      '',
      `Για το δικό σου ακίνητο, ρώτα ${ASSISTANT_ACC} μέσα στην εφαρμογή. Τη δοκιμάζεις από το properwise.gr.`,
      '',
      '#ενοίκιο #φορολογίαενοικίων #ακίνητα #ιδιοκτήτες #φόροι',
    ].join('\n'),
  };
}
const MAKRO_CSS = (s: Palette) => `
  .big{display:flex;flex-direction:column;gap:4px}
  .big > small{font-size:24px;color:${s.faint};letter-spacing:.2em}
  .big b{font-size:230px;font-weight:900;letter-spacing:-.065em;line-height:.9}
  .big > span{font-size:38px;color:${s.muted};letter-spacing:-.01em}
  .box{padding:30px 34px}
  .bx-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:26px}
  .bx-h b{font-size:calc(var(--body) + 2px);font-weight:750}
  .sc{margin-bottom:22px}
  .sc small{display:block;font-size:19px;color:${s.faint};letter-spacing:.14em;margin-bottom:10px}
  .sb{position:relative;height:70px;border-radius:14px;overflow:hidden;background:#ffffff08}
  .sb i{position:absolute;top:0;bottom:0;display:flex;align-items:center;justify-content:center;border-right:3px solid ${s.panel}}
  .sb em{font-style:normal;font-weight:800;font-size:26px;color:${s.onAccent}}
  .ticks{position:relative;height:28px}
  .ticks span{position:absolute;transform:translateX(-50%);font-family:'Roboto Mono',monospace;font-size:19px;color:${s.faint}}
  ${SPLIT_CSS(s)}${ACTION_CSS(s)}`;

// ═══ HIGHLIGHTS ════════════════════════════════════════════════════════
// Ένα σύμβολο ανά σειρά, στο γαλάζιο της μάρκας. Χωρίς λέξεις: το όνομα του
// Highlight το γράφει από κάτω το ίδιο το Instagram. Η Νόα έχει δικό της.
const HIGHLIGHTS: { key: string; name: string; glyph: string }[] = [
  { key: 'makroxronia', name: SERIES.makro.name, glyph: SERIES.makro.glyph },
  { key: 'vraxyxronia', name: SERIES.vraxy.name, glyph: SERIES.vraxy.glyph },
  { key: 'foroi', name: 'Φόροι', glyph: SERIES.foroi.glyph },
  { key: 'ypologistes', name: 'Υπολογιστές', glyph: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8"/><path d="M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/>' },
  { key: 'noa', name: ASSISTANT_NAME, glyph: `<rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><text x="12" y="16.6" text-anchor="middle" font-family="Inter" font-size="11" font-weight="800" fill="currentColor" stroke="none">${ASSISTANT_INITIAL}</text>` },
];

const EPISODES: { ep: Episode; css: string }[] = [
  { ep: vraxy01(), css: VRAXY_CSS(SERIES.vraxy) },
  { ep: foroi01(), css: FOROI_CSS(SERIES.foroi) },
  { ep: makro01(), css: MAKRO_CSS(SERIES.makro) },
];

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: chromePath(), args: ['--no-sandbox'] });
  const shot = async (html: string, w: number, h: number, path: string, f: Format | null, video?: { path: string; seconds: number }) => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    // Η εικόνα είναι το τελευταίο καρέ του βίντεο: όλα έχουν κάτσει.
    const seek = (t: number) => page.evaluate((x: number) => (window as unknown as { __seek?: (t: number) => void }).__seek?.(x), t);
    await seek(60);
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
        // ΤΙΤΛΟΣ ΩΣ ΔΥΟ ΓΡΑΜΜΕΣ, ΥΠΟΤΙΤΛΟΣ ΩΣ ΤΡΕΙΣ. Ο κανόνας του ιδιοκτήτη, μετρημένος
        // εδώ και όχι στο μάτι: μια λέξη που σπάει σε τρίτη γραμμή χαλά τη ζύγιση.
        for (const [sel, max] of [['h1', 2], ['h2', 2], ['.lead', 3]] as const) {
          for (const el of Array.from(document.querySelectorAll(`.wrap ${sel}`))) {
            const lh = parseFloat(getComputedStyle(el).lineHeight);
            const lines = Math.round((el as HTMLElement).getBoundingClientRect().height / lh);
            if (lines > max) out.push(`${sel} σε ${lines} γραμμές: ${(el.textContent || '').trim().slice(0, 40)}`);
          }
        }
        // Και τίποτα να μην πατά πάνω στο άλλο: η κάρτα στη λωρίδα του αυτοκόλλητου.
        const wrap = document.querySelector('.wrap') as HTMLElement;
        if (wrap.scrollHeight > wrap.clientHeight + 1) out.push(`ξεχειλίζει κατά ${wrap.scrollHeight - wrap.clientHeight}px`);
        return out;
      }, lim);
      if (bad.length) throw new Error(`${path}: εκτός ζώνης: ${bad.slice(0, 4).join(' | ')}`);
    }
    await page.screenshot({ path });
    if (video) {
      const ff = spawn(ffmpegPath(), ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-crf', '18', '-preset', 'medium', '-movflags', '+faststart', video.path],
        { stdio: ['pipe', 'inherit', 'inherit'] });
      const done = new Promise<void>((ok, fail) => { ff.on('error', fail); ff.on('close', c => (c === 0 ? ok() : fail(new Error(`ffmpeg: ${c}`)))); });
      for (let k = 0; k < video.seconds * FPS; k++) {
        await seek(k / FPS);
        const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
        if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      }
      ff.stdin.end();
      await done;
    }
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
          const video = VIDEO && f === 'story' ? { path: join(dir, 'story', `${i + 1}.mp4`), seconds: sl.seconds ?? 7 } : undefined;
          await shot(shell(f, s, ep, i, slides.length, sl.body(f), css), w, h, join(dir, f === 'story' ? 'story' : 'carousel', `${i + 1}.png`), f, video);
        }
      }
      console.log(`  ✓ ${ep.series}-e${String(ep.no).padStart(2, '0')}  (${PUBLISH[ep.series]})`);
    }
    mkdirSync(join(OUT, 'highlights'), { recursive: true });
    for (const hl of HIGHLIGHTS) await shot(highlight(hl.glyph), 1080, 1920, join(OUT, 'highlights', `${hl.key}.png`), null);
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
    'Τα βίντεο βγαίνουν με `--video` και θέλουν ffmpeg (`npm i --no-save ffmpeg-static`).',
    'Δεν μπαίνουν στο αποθετήριο.',
    '',
    ...order.flatMap(({ ep }) => {
      const s = SERIES[ep.series];
      const dir = `${ep.series}-e${String(ep.no).padStart(2, '0')}`;
      const day = elDate(PUBLISH[ep.series], { weekday: 'long', day: 'numeric', month: 'long' });
      return [
        `## ${s.name} · Ε${String(ep.no).padStart(2, '0')} · ${ep.title}`,
        '',
        `**Πότε:** ${day}. Story το μεσημέρι (13:00-14:00), carousel το βράδυ (19:00-21:00).`,
        `**Καταλήγει:** ${ep.link.url}. Στο story με σήμανση: ${utm(ep.link.url.slice(SITE.length), dir)}`,
        `**Εγγραφή (καρέ της Νόας):** ${utm('/signup', dir)}`,
        '',
        '### Story, καρέ καρέ',
        '',
        'Ανεβαίνει το βίντεο (`.mp4`, με κίνηση) όπου υπάρχει· η εικόνα (`.png`) είναι το τελευταίο του καρέ.',
        '',
        ...ep.slides.filter(sl => sl.only !== 'feed').map((sl, i) => `${i + 1}. \`${dir}/story/${i + 1}.mp4\` (${sl.seconds ?? 7} δ.) ή \`.png\`${sl.sticker ? `. **Αυτοκόλλητο:** ${sl.sticker}. Μπαίνει στην άδεια λωρίδα.` : ''}`),
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
