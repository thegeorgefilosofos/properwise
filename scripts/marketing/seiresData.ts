// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΔΕΔΟΜΕΝΑ ΤΩΝ ΣΕΙΡΩΝ, ΜΙΑ ΦΟΡΑ
// ─────────────────────────────────────────────────────────────────────────
// Stories και carousel (seires.ts) και reels (reelSeires.ts) λένε τα ίδια
// νούμερα. Γραμμένα δύο φορές θα διαφωνούσαν στην πρώτη αλλαγή του νόμου.
// Κάθε ποσό βγαίνει από τη συνάρτηση της εφαρμογής· τα παραδείγματα είναι οι
// προεπιλογές των δημόσιων υπολογιστών (spec.ts).
// ═══════════════════════════════════════════════════════════════════════════
import { athensToday } from '../../lib/core/time';
import { compareShortVsLong, netByOccupancy, type ShortVsLongInput } from '../../lib/tools/shortVsLong';
import { SPEC as SVL } from '../../app/vraxyxronia-i-makroxronia/spec';
import { SPEC as RENT } from '../../app/ypologismos-forou-enoikion/spec';
import { rentalIncomeTax, RENTAL_TAX_BRACKETS_2025, RENTAL_TAX_BRACKETS_2026, FIRST_YEAR_NEW_BRACKETS } from '../../lib/billing/greekTax';
import { presumptiveDeductionRateForYear } from '../../lib/billing/presumptive';
import { ENFIA_ZONE_TAX } from '../../lib/billing/enfia';
import { greekPropertyTaxObligations } from '../../lib/tax/greekTaxCalendar';
import type { SeriesKey } from './seiresKit';

// ── ΠΟΤΕ ΒΓΑΙΝΕΙ ΚΑΘΕ ΣΕΙΡΑ ─────────────────────────────────────────────
// Η πρώτη Τετάρτη από σήμερα ανοίγει τις σειρές. Η Παρασκευή και η Δευτέρα
// ακολουθούν. Η ημερομηνία μετρά: το ΕΝΦΙΑ δείχνει τη δόση που λήγει μετά
// τη μέρα της δημοσίευσης, όχι μετά τη μέρα που τρέχει η μηχανή.
export const WEEKDAY: Record<SeriesKey, number> = { vraxy: 3, foroi: 5, makro: 1 };
export const addDays = (iso: string, d: number) => {
  const t = new Date(`${iso}T12:00:00Z`); t.setUTCDate(t.getUTCDate() + d); return t.toISOString().slice(0, 10);
};
const nextWeekday = (from: string, wd: number) => {
  for (let k = 1; k <= 7; k++) { const d = addDays(from, k); if (new Date(`${d}T12:00:00Z`).getUTCDay() === wd) return d; }
  throw new Error('nextWeekday');
};
export const START = nextWeekday(athensToday(), WEEKDAY.vraxy);
export const PUBLISH: Record<SeriesKey, string> = {
  vraxy: START,
  foroi: nextWeekday(START, WEEKDAY.foroi),
  makro: nextWeekday(nextWeekday(START, WEEKDAY.foroi), WEEKDAY.makro),
};
export const elDate = (iso: string, o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('el-GR', { ...o, timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`));

/** Οι δώδεκα δόσεις του ΕΝΦΙΑ του έτους που λήγει ΜΕΤΑ τη μέρα δημοσίευσης. */
const ENFIA_RUN = new Set(['enfia-first', 'enfia-instalment', 'enfia-last']);
export function enfiaRun(after: string) {
  const y = Number(after.slice(0, 4));
  for (const year of [y, y - 1]) {
    const run = greekPropertyTaxObligations(year, 'owner').filter(o => ENFIA_RUN.has(o.kind));
    const next = run.findIndex(o => o.date >= after);
    if (run.length === 12 && next >= 0) return { year, run, next };
  }
  throw new Error(`Το ημερολόγιο δεν έχει εκκαθαριστικό ΕΝΦΙΑ με δώδεκα δόσεις μετά τις ${after}.`);
}


/** Το παράδειγμα της βραχυχρόνιας: οι προεπιλογές του υπολογιστή. */
export const svlInput: ShortVsLongInput = {
  monthlyRent: Number(SVL.enoikio), nightlyPrice: Number(SVL.timi), occupancyPct: Number(SVL.plirotita),
  sqm: Number(SVL.tm), isHouse: (SVL.typos as string) === 'house', platformFeePct: Number(SVL.promitheia),
  costPerNight: Number(SVL.kostos), fixedPerMonth: Number(SVL.pagia), season: (SVL.sezon as string) === 'high' ? 'high' : 'even',
};

/** Βραχυχρόνια ή μακροχρόνια: η σύγκριση, το όριο και η καμπύλη. */
export const OCC_STEPS = [20, 30, 40, 50, 60, 70, 80, 90];
export function vraxyFacts() {
  const r = compareShortVsLong(svlInput);
  if (r.breakEvenPct == null || r.breakEvenNights == null) throw new Error('Η σύγκριση δεν έχει σημείο ισορροπίας.');
  if (r.difference <= 0) throw new Error('Στο παράδειγμα κερδίζει η μακροχρόνια· η γωνία θέλει αλλαγή.');
  if (!OCC_STEPS.includes(svlInput.occupancyPct)) throw new Error('Η πληρότητα του παραδείγματος δεν είναι σημείο της καμπύλης.');
  return { r, bePct: Math.floor(r.breakEvenPct), curve: netByOccupancy(svlInput, OCC_STEPS) };
}

/** Η νέα κλίμακα στα ενοίκια: το όφελος, το όριο έναρξης, το παράδειγμα. */
export function makroFacts() {
  const Y = FIRST_YEAR_NEW_BRACKETS;
  const ded = presumptiveDeductionRateForYear(Y, true);
  const save = (taxable: number) => rentalIncomeTax(taxable, RENTAL_TAX_BRACKETS_2025) - rentalIncomeTax(taxable, RENTAL_TAX_BRACKETS_2026);
  const lastEdge = Math.max(...[...RENTAL_TAX_BRACKETS_2025, ...RENTAL_TAX_BRACKETS_2026].map(b => b.from));
  const maxSave = save(lastEdge);
  if (Math.abs(save(lastEdge * 3) - maxSave) > 0.005) throw new Error('Η διαφορά των κλιμάκων δεν σταθεροποιείται πάνω από το τελευταίο όριο.');
  const firstEdge = RENTAL_TAX_BRACKETS_2026[0].to;
  if (RENTAL_TAX_BRACKETS_2025[0].to !== firstEdge || RENTAL_TAX_BRACKETS_2025[0].rate !== RENTAL_TAX_BRACKETS_2026[0].rate)
    throw new Error('Το πρώτο κλιμάκιο άλλαξε· η γωνία «κάτω από αυτό δεν αλλάζει τίποτα» δεν ισχύει.');
  const m = Number(RENT.enoikio), n = Number(RENT.mines);
  const gross = m * n, taxable = gross * (1 - ded);
  const tax = rentalIncomeTax(taxable, RENTAL_TAX_BRACKETS_2026);
  if (Math.abs(rentalIncomeTax(taxable, RENTAL_TAX_BRACKETS_2025) - tax) > 0.005) throw new Error('Στο παράδειγμα η κλίμακα αλλάζει τον φόρο· η γωνία θέλει αλλαγή.');
  const monthlyOf = (taxableY: number) => taxableY / (1 - ded) / 12;
  return {
    Y, ded, save, lastEdge, maxSave, firstEdge, m, n, gross, taxable, tax, monthlyOf,
    fromMonthly: Math.ceil(monthlyOf(firstEdge)),
    rate0: RENTAL_TAX_BRACKETS_2026[0].rate,
    b25: RENTAL_TAX_BRACKETS_2025, b26: RENTAL_TAX_BRACKETS_2026,
  };
}

/** Η επόμενη δόση του ΕΝΦΙΑ από τη μέρα δημοσίευσης και ο φόρος ανά ζώνη. */
export function foroiFacts(after: string) {
  const { year, run, next } = enfiaRun(after);
  const due = run[next];
  const law = due.notes.match(/ν\. \d+\/\d{4}, άρθρο \d+/)?.[0];
  if (!law) throw new Error(`Η ${due.id} δεν γράφει τη νομική βάση της.`);
  const daysLeft = Math.round((Date.parse(`${due.date}T12:00:00Z`) - Date.parse(`${after}T12:00:00Z`)) / 864e5);
  if (daysLeft > 45) throw new Error(`Η δόση απέχει ${daysLeft} ημέρες· δεν είναι επείγον.`);
  const zones = Object.entries(ENFIA_ZONE_TAX);
  const zMax = Math.max(...zones.map(([, v]) => v)), zMin = Math.min(...zones.map(([, v]) => v));
  const [, mm, dd] = due.date.split('-').map(Number);
  return { year, run, next, due, law, daysLeft, zones, zMax, zMin, mm, dd };
}
