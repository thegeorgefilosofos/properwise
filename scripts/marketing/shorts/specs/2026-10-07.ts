// ═══════════════════════════════════════════════════════════════════════════
// ΤΕΤΑΡΤΗ 07/10/2026 · ΔΥΟ SHORTS
// ─────────────────────────────────────────────────────────────────────────
// 21:30 «Ένας αριθμός #01: Πού πήγαν τα ενοίκια;» (CALENDAR-2026Q4.md, θέση A).
// 22:30 «Βραχυχρόνια #01: Βραχυχρόνια ή μακροχρόνια;» (θέση B).
// Οι ώρες του ημερολογίου (13:00 και 20:00, μετά 12:30 και 19:30) πέρασαν:
// βγαίνουν το ίδιο βράδυ.
//
// ΚΑΝΕΝΑ ΨΗΦΙΟ ΣΤΙΣ ΠΡΟΔΙΑΓΡΑΦΕΣ. Ό,τι αριθμός φαίνεται είναι `{γεγονός}` από τις
// δύο συναρτήσεις γεγονότων παρακάτω, που ρωτούν τις ίδιες συναρτήσεις με την
// εφαρμογή και τους δημόσιους υπολογιστές:
//   · A: το ακίνητο επίδειξης (lib/demo/sample) μέσα από την incomeStatement,
//     για δώδεκα ενοίκια (rentFacts.yearAhead) και ο υπολογιστής καθαρής
//     απόδοσης (lib/tools/apodosi.propertyYield) που πρέπει να βγάζει το ίδιο.
//   · B: οι προεπιλογές του υπολογιστή «Βραχυχρόνια ή μακροχρόνια»
//     (app/vraxyxronia-i-makroxronia/spec.ts) μέσα από την compareShortVsLong.
// Οι πρωταγωνιστές είναι παραδείγματα, όχι πρόσωπα: η Ελένη έχει το ακίνητο
// επίδειξης, ο Πέτρος τις προεπιλογές του υπολογιστή.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ShortSpec } from '../spec';
import { fact, K, type Fact, type Facts } from '../kit';
import {
  hookStamp, hookCount, hookBar, quote, tileGrid, bigNumber, calcCard, endCard, waterfall,
} from '../scenes';
import { yearAhead, BR, S, SEG, eur, pct } from '../../rentFacts';
import { svlInput, OCC_STEPS } from '../../seiresData';
import { DEMO_PROPERTY } from '../../../../lib/demo/sample';
import { PRESUMPTIVE_DEDUCTION_RATE } from '../../../../lib/billing/presumptive';
import { rentalBracketsForYear, rentalIncomeTax } from '../../../../lib/billing/greekTax';
import { propertyYield } from '../../../../lib/tools/apodosi';
import { compareShortVsLong, netByOccupancy, NIGHTS_PER_YEAR } from '../../../../lib/tools/shortVsLong';
import { fn } from '../../../../lib/core/format';

const putter = (out: Facts) => (f: Fact) => { if (out[f.id]) throw new Error(`Διπλό γεγονός «${f.id}».`); out[f.id] = f; };

// ═══ ΓΕΓΟΝΟΤΑ A · τα ενοίκια της Ελένης ════════════════════════════════════
const SRC_Y = 'scripts/marketing/rentFacts.ts (yearAhead: incomeStatement του ακινήτου επίδειξης, lib/demo/sample, για δώδεκα ενοίκια)';
const SRC_P = 'lib/billing/presumptive.ts (PRESUMPTIVE_DEDUCTION_RATE)';
export function enoikiaFacts(date: string): Facts {
  const out: Facts = {}, put = putter(out);
  const Y = yearAhead();
  const year = Number(date.slice(0, 4));
  // Το παράδειγμα κρατά δώδεκα ενοίκια της κλεισμένης χρονιάς: ο φόρος τους πρέπει να είναι ίδιος με την κλίμακα της χρονιάς του short.
  if (Math.abs(rentalIncomeTax(Y.taxable, rentalBracketsForYear(year)) - Y.tax) > .005) throw new Error(`Η κλίμακα του ${year} δίνει άλλον φόρο από το παράδειγμα· το short θέλει νέα γωνία.`);
  const months = Y.gross / Y.monthly;
  if (!Number.isInteger(months)) throw new Error('Το ετήσιο ενοίκιο του παραδείγματος δεν είναι ακέραιοι μήνες.');
  // «Αφαιρείται ένα σταθερό 5%»: το φορολογητέο είναι ακριβώς το ενοίκιο μείον την τεκμαρτή έκπτωση.
  const presAmt = Math.round((Y.gross - Y.taxable) * 100) / 100;
  if (Math.abs(presAmt - Y.gross * PRESUMPTIVE_DEDUCTION_RATE) > .005) throw new Error('Το φορολογητέο του παραδείγματος δεν είναι «ενοίκιο μείον τεκμαρτή έκπτωση».');
  if (Y.taxable > BR[0].to) throw new Error('Το φορολογητέο περνά το πρώτο κλιμάκιο· το «φόρος {rate}» δεν στέκει.');
  // «Πρώτα τα έξοδα»: η μεγαλύτερη απώλεια είναι τα έξοδα, όχι ο φόρος.
  if (!(Y.other > Y.tax && Y.other > Y.enfia)) throw new Error('Τα έξοδα δεν είναι πια η μεγαλύτερη απώλεια· η σκηνή «Πρώτα τα έξοδα» δεν στέκει.');
  // Από κάθε 100€: τα μερίδια της shares() αθροίζουν στη βάση τους.
  const unit = Y.pTax + Y.pEnfia + Y.pOther + Y.pNet;
  const presOf100 = Math.round(PRESUMPTIVE_DEDUCTION_RATE * unit);
  if (Math.abs(presOf100 - PRESUMPTIVE_DEDUCTION_RATE * unit) > 1e-9) throw new Error('Η τεκμαρτή έκπτωση δεν είναι ακέραια τετράγωνα στα εκατό.');
  // Ο δημόσιος υπολογιστής (/kathari-apodosi) με τα ίδια πεδία πρέπει να βγάζει το ίδιο καθαρό.
  const calc = propertyYield({ value: 0, monthlyRent: Y.monthly, monthsRented: months, enfia: Y.enfia, expenses: Y.other, otherRentalIncome: 0, year, viaBank: true });
  if (Math.abs(calc.net - Y.net) > .005) throw new Error(`Ο υπολογιστής καθαρής απόδοσης βγάζει ${calc.net}, το παράδειγμα ${Y.net}.`);
  const presRef = /άρθρο \d+ §\d+ ΚΦΕ/.exec(readFileSync(join(process.cwd(), 'lib/billing/presumptive.ts'), 'utf8'))?.[0];
  if (!presRef) throw new Error('Το lib/billing/presumptive.ts δεν γράφει πια τη νομική βάση της τεκμαρτής έκπτωσης.');
  const [, place] = DEMO_PROPERTY.name.split(/,\s*/);
  if (!place) throw new Error('Το ακίνητο επίδειξης δεν έχει περιοχή στο όνομά του.');

  const R = { validity: 'rental-brackets' }, P = { validity: 'presumptive-deduction' };
  put(fact('place', place, place, 'lib/demo/sample.ts (DEMO_PROPERTY.name)', { kind: 'text' }));
  put(fact('monthly', Y.monthly, eur(Y.monthly), 'lib/demo/sample.ts (DEMO_PROPERTY.monthlyRent)', { kind: 'money' }));
  put(fact('months', months, fn(months), `${SRC_Y}: ετήσιο ενοίκιο / μηνιαίο`));
  put(fact('gross', Y.gross, eur(Y.gross), SRC_Y, { kind: 'money' }));
  put(fact('tax', Y.tax, eur(Y.tax), `${SRC_Y}: γραμμή incomeTax`, { ...R, kind: 'money' }));
  put(fact('enfia', Y.enfia, eur(Y.enfia), `${SRC_Y}: γραμμή enfia (το βιβλίο του ακινήτου επίδειξης)`, { kind: 'money' }));
  put(fact('other', Y.other, eur(Y.other), `${SRC_Y}: γραμμή otherCash (επισκευές, συσκευές, ασφάλεια και λοιπά)`, { kind: 'money' }));
  put(fact('net', Y.net, eur(Y.net), `${SRC_Y}: γραμμή netCash · ίδιο με lib/tools/apodosi.ts (propertyYield)`, { ...R, kind: 'money' }));
  put(fact('lost', Y.lost, eur(Y.lost), `${SRC_Y}: ενοίκιο μείον καθαρά`, { ...R, kind: 'money' }));
  put(fact('unit', unit, `${fn(unit)}€`, 'scripts/marketing/rentFacts.ts (shares: η βάση των μεριδίων)', { kind: 'money' }));
  put(fact('pTax', Y.pTax, `${fn(Y.pTax)}€`, `${SRC_Y}: μερίδιο φόρου ανά ${unit}€`, { ...R, kind: 'money' }));
  put(fact('pEnfia', Y.pEnfia, `${fn(Y.pEnfia)}€`, `${SRC_Y}: μερίδιο ΕΝΦΙΑ ανά ${unit}€`, { kind: 'money' }));
  put(fact('pOther', Y.pOther, `${fn(Y.pOther)}€`, `${SRC_Y}: μερίδιο εξόδων ανά ${unit}€`, { kind: 'money' }));
  put(fact('pNet', Y.pNet, `${fn(Y.pNet)}€`, `${SRC_Y}: καθαρά ανά ${unit}€`, { ...R, kind: 'money' }));
  put(fact('lostPer', unit - Y.pNet, `${fn(unit - Y.pNet)}€`, `${SRC_Y}: ${unit}€ μείον τα καθαρά ανά ${unit}€`, { ...R, kind: 'money' }));
  put(fact('pNetN', Y.pNet, fn(Y.pNet), 'ίδιο με pNet, χωρίς σύμβολο', R));
  put(fact('presOf100', presOf100, `${fn(presOf100)}€`, `${SRC_P} επί ${unit}€`, { ...P, kind: 'money' }));
  put(fact('taxedOf100', unit - presOf100, `${fn(unit - presOf100)}€`, `${SRC_P}: ${unit}€ μείον την έκπτωση`, { ...P, kind: 'money' }));
  put(fact('pres', PRESUMPTIVE_DEDUCTION_RATE, pct(PRESUMPTIVE_DEDUCTION_RATE), SRC_P, P));
  put(fact('taxedPct', 1 - PRESUMPTIVE_DEDUCTION_RATE, pct(1 - PRESUMPTIVE_DEDUCTION_RATE), `${SRC_P}: το υπόλοιπο του ενοικίου`, P));
  put(fact('presAmt', presAmt, eur(presAmt), `${SRC_Y}: ενοίκιο μείον φορολογητέο`, { ...P, kind: 'money' }));
  put(fact('presLaw', presRef, presRef, 'lib/billing/presumptive.ts (σχόλιο της PRESUMPTIVE_DEDUCTION_RATE)', { kind: 'text' }));
  put(fact('rate', BR[0].rate, pct(BR[0].rate), `lib/billing/greekTax.ts (rentalBracketsForYear(${S.year})[0], ίδιο με ${year})`, R));
  return out;
}

// ═══ ΓΕΓΟΝΟΤΑ B · το Airbnb του Πέτρου ═════════════════════════════════════
const SRC_S = 'lib/tools/shortVsLong.ts (compareShortVsLong) με τις προεπιλογές του app/vraxyxronia-i-makroxronia/spec.ts';
const SRC_IN = 'app/vraxyxronia-i-makroxronia/spec.ts (SPEC)';
export function svlFacts(): Facts {
  const out: Facts = {}, put = putter(out);
  const I = svlInput, r = compareShortVsLong(I);
  if (r.breakEvenPct == null || r.breakEvenNights == null) throw new Error('Η σύγκριση δεν έχει σημείο ισορροπίας.');
  // Το όριο όπως το γράφει ο υπολογιστής: ακέραιο, προς τα πάνω («από 53% και πάνω»).
  const be = Math.ceil(r.breakEvenPct);
  if (!(I.occupancyPct > be)) throw new Error('Στο παράδειγμα η πληρότητα δεν περνά το όριο· η ιστορία «κερδίζει, αλλά λίγο» δεν στέκει.');
  const naive = I.nightlyPrice * NIGHTS_PER_YEAR;
  if (Math.abs(r.short.gross - r.short.nights * I.nightlyPrice) > .005) throw new Error('Ο τζίρος δεν είναι νύχτες επί τιμή.');
  if (r.short.municipalTax) throw new Error('Το παράδειγμα πληρώνει τέλος παρεπιδημούντων· ο καταρράκτης δεν το δείχνει.');
  const empty = naive - r.short.gross;
  if (Math.abs(naive - empty - r.short.platformFee - r.short.running - r.short.tax - r.short.net) > .01) throw new Error('Ο καταρράκτης δεν καταλήγει στα καθαρά της βραχυχρόνιας.');
  if (Math.abs(r.short.net - r.long.net - r.difference) > .01) throw new Error('Η διαφορά δεν είναι βραχυχρόνια μείον μακροχρόνια.');
  const months = r.long.gross / I.monthlyRent;
  if (!Number.isInteger(months)) throw new Error('Η μακροχρόνια δεν είναι ακέραιοι μήνες.');
  // Η κακή χρονιά: το πιο κοντινό βήμα της καμπύλης των σειρών (seiresData.OCC_STEPS) κάτω από το όριο.
  const beExact = r.breakEvenPct;
  const low = netByOccupancy(I, OCC_STEPS).filter(x => x.pct < beExact).pop();
  if (!low || !(low.net < r.long.net)) throw new Error('Κάτω από το όριο η βραχυχρόνια δεν χάνει· η σκηνή «κι αν πέσει» δεν στέκει.');
  const loss = Math.round((r.long.net - low.net) * 100) / 100;
  // Τα εκατό τετράγωνα είναι οι νύχτες του χρόνου σε ποσοστό: ως το όριο, το κέρδος, οι άδειες.
  const emptyPct = 100 - I.occupancyPct;

  const V = { validity: 'rental-brackets' };
  put(fact('sqm', I.sqm, fn(I.sqm), SRC_IN));
  put(fact('rent', I.monthlyRent, eur(I.monthlyRent), SRC_IN, { kind: 'money' }));
  put(fact('night', I.nightlyPrice, eur(I.nightlyPrice), SRC_IN, { kind: 'money' }));
  put(fact('occ', I.occupancyPct, `${fn(I.occupancyPct)}%`, SRC_IN));
  put(fact('fee', I.platformFeePct, `${fn(I.platformFeePct)}%`, SRC_IN));
  put(fact('yearNights', NIGHTS_PER_YEAR, fn(NIGHTS_PER_YEAR), 'lib/tools/shortVsLong.ts (NIGHTS_PER_YEAR)'));
  put(fact('naive', naive, eur(naive), `${SRC_IN}: τιμή ανά νύχτα επί NIGHTS_PER_YEAR (το λάθος που περιγράφει το lib/tools/shortVsLong.ts)`, { kind: 'money' }));
  put(fact('nights', r.short.nights, fn(r.short.nights), SRC_S));
  put(fact('shortGross', r.short.gross, eur(r.short.gross), SRC_S, { kind: 'money' }));
  put(fact('empty', empty, eur(empty), `${SRC_S}: ${fn(NIGHTS_PER_YEAR)} νύχτες μείον όσες γεμίζουν, επί την τιμή`, { kind: 'money' }));
  put(fact('platformFee', r.short.platformFee, eur(r.short.platformFee), SRC_S, { kind: 'money' }));
  put(fact('running', r.short.running, eur(r.short.running), `${SRC_S}: καθαριότητα ανά νύχτα και πάγια ανά μήνα`, { kind: 'money' }));
  put(fact('costs', r.short.platformFee + r.short.running, eur(r.short.platformFee + r.short.running), `${SRC_S}: προμήθεια πλατφόρμας συν καθαριότητα και πάγια`, { kind: 'money' }));
  put(fact('shortTax', r.short.tax, eur(r.short.tax), SRC_S, { ...V, kind: 'money' }));
  put(fact('shortNet', r.short.net, eur(r.short.net), SRC_S, { ...V, kind: 'money' }));
  put(fact('levy', r.short.levy, eur(r.short.levy), `${SRC_S}: τέλος ανθεκτικότητας που πληρώνει ο επισκέπτης`, { validity: 'climate-levy', kind: 'money' }));
  put(fact('months', months, fn(months), `${SRC_S}: μακροχρόνια = ενοίκιο επί μήνες`));
  put(fact('longGross', r.long.gross, eur(r.long.gross), SRC_S, { kind: 'money' }));
  put(fact('longTax', r.long.tax, eur(r.long.tax), SRC_S, { ...V, kind: 'money' }));
  put(fact('longNet', r.long.net, eur(r.long.net), SRC_S, { ...V, kind: 'money' }));
  put(fact('diff', r.difference, eur(r.difference), SRC_S, { ...V, kind: 'money' }));
  put(fact('diffMonth', r.difference / months, eur(r.difference / months), `${SRC_S}: διαφορά ανά μήνα`, { ...V, kind: 'money' }));
  put(fact('beCeil', be, `${fn(be)}%`, `${SRC_S} (breakEvenPct), προς τα πάνω όπως στον υπολογιστή`, V));
  put(fact('beNights', r.breakEvenNights, fn(r.breakEvenNights), `${SRC_S} (breakEvenNights)`, V));
  put(fact('gainSq', I.occupancyPct - be, `${fn(I.occupancyPct - be)}%`, `${SRC_IN}: πληρότητα μείον το όριο`, V));
  put(fact('emptySq', emptyPct, `${fn(emptyPct)}%`, `${SRC_IN}: οι νύχτες που μένουν άδειες`));
  put(fact('lowOcc', low.pct, `${fn(low.pct)}%`, 'lib/tools/shortVsLong.ts (netByOccupancy): το βήμα της καμπύλης κάτω από το όριο'));
  put(fact('lowNet', low.net, eur(low.net), 'lib/tools/shortVsLong.ts (netByOccupancy)', { ...V, kind: 'money' }));
  put(fact('lossLow', loss, eur(loss), 'lib/tools/shortVsLong.ts: καθαρά μακροχρόνιας μείον καθαρά βραχυχρόνιας στο βήμα αυτό', { ...V, kind: 'money' }));
  return out;
}

// ═══ Α · 21:30 · «Πού πήγαν τα ενοίκια;» ═══════════════════════════════════
export const ENOIKIA: ShortSpec = {
  id: '2026-10-07-2130-enoikia',
  date: '2026-10-07', slot: '21:30', series: 'makro',
  title: 'Πού πήγαν τα {lost} από τα ενοίκια;',
  hook: 'Από κάθε {unit} ενοικίου φεύγουν {lostPer}. Πού;',
  protagonist: 'Η Ελένη νοικιάζει διαμέρισμα στο {place} με {monthly} τον μήνα: {gross} τον χρόνο.',
  cta: { path: '/kathari-apodosi', label: 'Ο υπολογιστής καθαρής απόδοσης, με τα δικά σου νούμερα.' },
  utm: { campaign: 'arithmos-e01' },
  facts: enoikiaFacts,
  note: 'Παράδειγμα: το ακίνητο επίδειξης της εφαρμογής',
  hooks: [
    {
      name: 'Σφραγίδα «Πού;»',
      why: 'Το ποσό διαβάζεται πριν από κάθε λέξη και η σφραγίδα κάνει την ερώτηση που έχει ήδη ο θεατής. Το «δεν τα παίρνει μόνο ο φόρος» χαλά την πρώτη του απάντηση και τον κρατά.',
      scene: hookStamp({
        beats: 11, arc: 'hook',
        story: 'Πρώτο καρέ: «Από κάθε {unit}, {lostPer} φεύγουν». Σφραγίδα «ΠΟΥ;» και από κάτω «Δεν τα παίρνει μόνο ο φόρος».',
        cue: 'Χτύπημα στο πρώτο καρέ, σφραγίδα με μπάσο και παλαμάκι.',
        eyebrow: 'Το ενοίκιο της Ελένης', lines: ['Από κάθε **{unit}**', '**{lostPer}** φεύγουν.'], hero: 1, stamp: 'Πού;',
        sub: 'Δεν τα παίρνει **μόνο ο φόρος**.',
      }),
    },
    {
      name: 'Αντίστροφη μέτρηση',
      why: 'Καθαρός αριθμός, αλλά το «σου μένουν» απαντά ήδη την ερώτηση: η περιέργεια κλείνει πριν αρχίσει η ιστορία.',
      scene: hookCount({
        beats: 11, arc: 'hook',
        story: 'Πρώτο καρέ: «{pNetN} ΕΥΡΩ» από κάθε {unit}, δώδεκα μπάρες ανάβουν, «Τα άλλα πού πήγαν;».',
        cue: 'Χτύπημα και μπάσο στο πρώτο καρέ, ένα τικ ανά μπάρα.',
        eyebrow: 'Το ενοίκιο της Ελένης', lines: ['Από κάθε **{unit}**', 'της μένουν'], valueFact: 'pNetN', unit: 'ευρώ', dotsFact: 'months',
        punch: 'Τα άλλα **πού πήγαν**;',
      }),
    },
  ],
  pick: 0,
  rubric: {
    signals: [
      { signal: 'hook', scene: 0, note: '«{lostPer} φεύγουν» από κάθε {unit}, ορατό από το πρώτο καρέ.' },
      { signal: 'conflict', scene: 0, note: 'Η σφραγίδα «Πού;» και το «δεν τα παίρνει μόνο ο φόρος».' },
      { signal: 'revelation', scene: 1, note: 'Πρώτα τα έξοδα: {other}, πάνω από τον φόρο ({tax}).' },
      { signal: 'opinion', scene: 2, note: 'Τα πραγματικά έξοδα δεν μειώνουν το φορολογητέο: μετρά ένα σταθερό {pres}.' },
      { signal: 'quotable', scene: 3, note: '«Φόρος στα έσοδα, όχι στα καθαρά.»' },
      { signal: 'story', scene: 4, note: 'Στην Ελένη μένουν {net} από {gross}.' },
      { signal: 'practical', scene: 5, note: 'Ο υπολογιστής καθαρής απόδοσης με τα δικά σου νούμερα.' },
    ],
    score: 76,
    why: 'Ένας αριθμός που κάθε ιδιοκτήτης θέλει να ελέγξει στο δικό του ενοίκιο. Η απάντηση έχει έκπληξη (πρώτα τα έξοδα) και κανόνα που λίγοι ξέρουν.',
  },
  scenes: [
    hookBar({
      beats: 14, arc: 'stakes', in: 'zoomThrough', inOpts: { target: 'hz0' }, note: true,
      story: 'Ζουμ μέσα στη σφραγίδα: τα {lost} της χρονιάς σε μία μπάρα, που σπάει σε φόρο, ΕΝΦΙΑ και έξοδα. «Πρώτα τα έξοδα.»',
      cue: 'Σάρωμα που ανεβαίνει στο ζουμ, ένα κλικ ανά κομμάτι.',
      eyebrow: 'Η Ελένη · {gross} ενοίκια', title: ['Έφυγαν', '**{lost}**.'],
      parts: [
        { label: 'Φόρος', value: 'tax', color: SEG.tax },
        { label: 'ΕΝΦΙΑ', value: 'enfia', color: SEG.enfia },
        { label: 'Έξοδα', value: 'other', color: SEG.other },
      ],
      question: 'Πρώτα **τα έξοδα**.',
    }),
    quote({
      beats: 14, arc: 'turn', in: 'cardFlip',
      story: 'Η κάρτα γυρίζει: η ερώτηση της Ελένης γράφεται γράμμα γράμμα. Απάντηση: μετρά μόνο ένα σταθερό {pres}.',
      cue: 'Γύρισμα χαρτιού, πλήκτρα, καμπάνα στην απάντηση.',
      label: 'Η ερώτηση της Ελένης', question: 'Έδωσα {other} για το σπίτι. Μειώνουν το φορολογητέο;', source: '{presLaw}',
      answer: 'Όχι. Μετρά μόνο ένα σταθερό **{pres}**.',
    }),
    tileGrid({
      beats: 12, arc: 'stakes', in: 'typeSlam', inOpts: { word: '{pres}', sub: 'μόνο αυτό αφαιρείται' },
      story: 'Η λέξη «{pres}» πέφτει στην οθόνη. Εκατό τετράγωνα: τα {presOf100} χωρίς φόρο, τα {taxedOf100} με φόρο {rate}.',
      cue: 'Σάρωμα, χτύπημα με παλαμάκι στη λέξη, κλικ στα τετράγωνα.',
      eyebrow: 'Φόρος στα έσοδα, όχι στα καθαρά', title: ['Φορολογούνται', '**{taxedOf100}** στα {unit}.'],
      counts: [
        { n: 'presOf100', color: K.accent, label: 'Έκπτωση' },
        { n: 'taxedOf100', color: SEG.tax, label: 'Με φόρο' },
      ],
    }),
    bigNumber({
      beats: 14, arc: 'payoff', in: 'lightLeak', note: true,
      story: 'Διαρροή φωτός: το ποσό που μένει στην Ελένη μετρά ως τα {net}. Από κάτω έξοδα, φόρος και ΕΝΦΙΑ.',
      cue: 'Ζεστό σάρωμα στο κόψιμο, κλικ που μετρούν, βαθύ χτύπημα και καμπάνα στο ποσό.',
      eyebrow: 'Τι μένει στην Ελένη', title: ['Από τα **{gross}**', 'της μένουν:'], valueFact: 'net',
      caption: '**{pNet}** από κάθε {unit} ενοικίου.',
      rows: [
        { label: 'Έξοδα', value: '{other}' },
        { label: 'Φόρος {rate}', value: '{tax}' },
        { label: 'ΕΝΦΙΑ', value: '{enfia}' },
      ],
      chips: ['Φόρος στα {taxedPct} του ενοικίου'],
    }),
    calcCard({
      beats: 15, arc: 'action', in: 'maskWipe', inOpts: { shape: 'diag' },
      story: 'Διαγώνια μάσκα: ο υπολογιστής καθαρής απόδοσης. Τα πεδία γεμίζουν με τα νούμερα της Ελένης και βγάζουν τα ίδια {net}.',
      cue: 'Whoosh με νότα στη μάσκα, πλήκτρα σε κάθε πεδίο.',
      eyebrow: 'Το δικό σου ακίνητο', title: ['Τώρα με τα δικά', 'σου **νούμερα**.'], name: 'Υπολογιστής καθαρής απόδοσης',
      fields: [
        { label: 'Μηνιαίο ενοίκιο', value: 'monthly' }, { label: 'Μήνες ενοικίασης', value: 'months' },
        { label: 'ΕΝΦΙΑ τον χρόνο', value: 'enfia' }, { label: 'Δαπάνες τον χρόνο', value: 'other' },
      ],
      result: { label: 'Σου μένουν', value: 'net' }, path: '/kathari-apodosi',
    }),
    endCard({
      beats: 13, arc: 'loop', in: 'rackFocus',
      story: 'Rack focus: σήμα, «Πόσα μένουν σε εσένα;», ο σύνδεσμος. Το τελευταίο μισό δευτερόλεπτο ξαναστήνει το πρώτο καρέ.',
      cue: 'Σάρωμα που κατεβαίνει, συγχορδία από καμπάνες, η πρώτη συγχορδία στο τέλος για να δέσει ο βρόχος.',
      title: ['Πόσα μένουν', 'σε **εσένα**;'], path: '/kathari-apodosi', action: 'Βάλε ενοίκιο, μήνες, ΕΝΦΙΑ και δαπάνες. Δες τι σου μένει.',
    }),
  ],
  cover: 0,
  texts: {
    youtube: {
      title: 'Πού πήγαν τα {lost} από τα ενοίκια; #Shorts',
      description: [
        'Η Ελένη νοικιάζει διαμέρισμα στο {place} με {monthly} τον μήνα: {gross} τον χρόνο. Καθαρά της μένουν {net}.',
        '',
        'Πού πήγαν τα {lost}; Έξοδα {other}, φόρος {tax}, ΕΝΦΙΑ {enfia}.',
        '',
        'Ο φόρος μπαίνει στα έσοδα, όχι στα καθαρά. Στη μακροχρόνια μίσθωση το φορολογητέο είναι το ενοίκιο μείον ένα σταθερό {pres} ({presAmt}), όσα κι αν ξόδεψες στην πράξη ({presLaw}). Στο υπόλοιπο {taxedPct} πληρώνεις φόρο {rate}.',
        '',
        'Από κάθε {unit} ενοικίου σου μένουν {pNet}.',
        '',
        'Ο υπολογιστής καθαρής απόδοσης, με τα δικά σου νούμερα: {ctaUrl}',
        '',
        'Παράδειγμα με το ακίνητο επίδειξης της εφαρμογής: φυσικό πρόσωπο, μακροχρόνια μίσθωση, {months} ενοίκια. Για τη δική σου περίπτωση, ο λογιστής σου.',
      ].join('\n'),
      tags: ['ενοίκια', 'φόρος ενοικίων', 'ΕΝΦΙΑ', 'καθαρή απόδοση', 'μακροχρόνια μίσθωση', 'τεκμαρτή έκπτωση', 'ιδιοκτήτες ακινήτων', 'PROPERWISE'],
    },
    instagram: {
      caption: [
        '{gross} ενοίκια τον χρόνο. Στην Ελένη μένουν {net}.',
        '',
        'Πού πήγαν τα {lost}; Πρώτα τα έξοδα ({other}), μετά ο φόρος ({tax}) και ο ΕΝΦΙΑ ({enfia}).',
        '',
        'Φόρος στα έσοδα, όχι στα καθαρά: από το ενοίκιο αφαιρείται μόνο ένα σταθερό {pres}, όσα κι αν ξόδεψες. Στο υπόλοιπο {taxedPct} πληρώνεις φόρο.',
        '',
        'Από κάθε {unit} ενοικίου σου μένουν {pNet}.',
        '',
        'Ο υπολογιστής καθαρής απόδοσης: σύνδεσμος στο bio. Αποθήκευσέ το για τη φορολογική δήλωση.',
        '',
        'Παράδειγμα: το ακίνητο επίδειξης της εφαρμογής, φυσικό πρόσωπο, μακροχρόνια μίσθωση.',
      ].join('\n'),
      alt: 'Σφραγίδα «Πού;» πάνω από τα {lostPer} που φεύγουν από κάθε {unit} ενοικίου. Μπάρα με τα {lost} της χρονιάς: έξοδα {other}, φόρος {tax}, ΕΝΦΙΑ {enfia}. Η ερώτηση της Ελένης για τα έξοδα και η απάντηση: μετρά μόνο ένα σταθερό {pres}. Εκατό τετράγωνα: {presOf100} χωρίς φόρο, {taxedOf100} με φόρο {rate}. Της μένουν {net}. Ο υπολογιστής καθαρής απόδοσης με τα πεδία του.',
      hashtags: ['ενοίκια', 'φόροςενοικίων', 'ΕΝΦΙΑ', 'ιδιοκτήτες', 'PROPERWISE'],
    },
    tiktok: {
      caption: 'Από κάθε {unit} ενοικίου μένουν {pNet}. Πού πάνε τα άλλα; Έξοδα, φόρος και ΕΝΦΙΑ σε ένα λεπτό. Στείλ\' το σε όποιον νοικιάζει το σπίτι του.',
      hashtags: ['ενοίκια', 'φόροςενοικίων', 'ΕΝΦΙΑ', 'ιδιοκτήτες', 'ακίνητα'],
    },
    pinned: 'Εσύ πόσα κρατάς από κάθε {unit} ενοικίου; Γράψε το δικό σου νούμερο. Ο υπολογιστής: {ctaUrl}',
  },
};

// ═══ Β · 22:30 · «Βραχυχρόνια ή μακροχρόνια;» ══════════════════════════════
export const VRAXY_MAKRO: ShortSpec = {
  id: '2026-10-07-2230-vraxyxronia',
  date: '2026-10-07', slot: '22:30', series: 'vraxy',
  title: 'Airbnb ή ενοικιαστής; Το κρίνει η πληρότητα',
  hook: 'Airbnb με {night} τη νύχτα, γεμάτο για {yearNights} νύχτες. Και βγάζει {naive}.',
  protagonist: 'Ο Πέτρος έχει διαμέρισμα {sqm} τ.μ. Ενοικιαστής με {rent} τον μήνα ή Airbnb με {night} τη νύχτα;',
  cta: { path: '/vraxyxronia-i-makroxronia', label: 'Ο υπολογιστής «Βραχυχρόνια ή μακροχρόνια», με τα δικά σου.' },
  utm: { campaign: 'vraxy-e01' },
  facts: () => svlFacts(),
  note: 'Παράδειγμα: οι προεπιλογές του υπολογιστή',
  hooks: [
    {
      name: 'Αντίστροφη μέτρηση',
      why: 'Ο μεγάλος αριθμός διαβάζεται πριν από κάθε λέξη. Όποιος έχει σκεφτεί Airbnb έχει κάνει αυτόν ακριβώς τον πολλαπλασιασμό: βλέπει τον εαυτό του και μένει για να μάθει πού είναι το λάθος.',
      scene: hookCount({
        beats: 10, arc: 'hook',
        story: 'Πρώτο καρέ: «Airbnb με {night}, γεμάτο για {yearNights} ΝΥΧΤΕΣ». Δώδεκα μπάρες, μία για κάθε μήνα, ανάβουν. «Και βγάζει {naive}. Πού είναι το λάθος;»',
        cue: 'Χτύπημα και μπάσο στο πρώτο καρέ, ένα τικ ανά μήνα.',
        eyebrow: 'Ο λογαριασμός του Πέτρου', lines: ['Airbnb με **{night}**,', 'γεμάτο για'], valueFact: 'yearNights', unit: 'νύχτες', dotsFact: 'months',
        punch: 'Και βγάζει **{naive}**.', tag: 'Πού είναι **το λάθος**;',
      }),
    },
    {
      name: 'Σφραγίδα «Όριο»',
      why: 'Λέει την απάντηση από το πρώτο καρέ: σωστό, αλλά όποιος δεν ξέρει τι είναι η πληρότητα ισορροπίας δεν έχει λόγο να μείνει.',
      scene: hookStamp({
        beats: 10, arc: 'hook',
        story: 'Πρώτο καρέ: «Το Airbnb, {beCeil} και πάνω». Σφραγίδα «ΟΡΙΟ».',
        cue: 'Χτύπημα στο πρώτο καρέ, σφραγίδα με μπάσο και παλαμάκι.',
        eyebrow: 'Airbnb ή ενοικιαστής', lines: ['Το **Airbnb**', '**{beCeil}** και πάνω.'], hero: 1, stamp: 'Όριο.',
        sub: 'Από κάτω κερδίζει **ο ενοικιαστής**.',
      }),
    },
  ],
  pick: 0,
  rubric: {
    signals: [
      { signal: 'hook', scene: 0, note: '«{yearNights} ΝΥΧΤΕΣ» και «{naive}» στο πρώτο καρέ.' },
      { signal: 'conflict', scene: 0, note: 'Ο λογαριασμός του Πέτρου είναι λάθος: κανένα σπίτι δεν γεμίζει κάθε νύχτα.' },
      { signal: 'revelation', scene: 1, note: 'Τα {naive} γίνονται {shortNet}.' },
      { signal: 'revelation', scene: 2, note: 'Ο ενοικιαστής αφήνει {longNet}: η διαφορά είναι {diff} τον χρόνο, {diffMonth} τον μήνα.' },
      { signal: 'story', scene: 3, note: 'Με {lowOcc} πληρότητα κερδίζει ο ενοικιαστής, κατά {lossLow}.' },
      { signal: 'quotable', scene: 4, note: '«Πληρότητα ισορροπίας: {beCeil}.»' },
      { signal: 'practical', scene: 5, note: 'Ο υπολογιστής με τα δικά σου νούμερα και το δικό σου όριο.' },
    ],
    score: 77,
    why: 'Ο πολλαπλασιασμός του αγκιστριού είναι αυτός που κάνει όποιος σκέφτεται Airbnb. Η διόρθωση έρχεται βήμα βήμα και καταλήγει σε έναν αριθμό που ο θεατής ελέγχει για το δικό του σπίτι.',
  },
  scenes: [
    waterfall({
      beats: 14, arc: 'stakes', in: 'maskWipe', inOpts: { shape: 'circle', at: 'hz0' }, note: true,
      story: 'Η μάσκα ανοίγει από το {yearNights}: ο καταρράκτης. Από {naive} φεύγουν οι άδειες νύχτες ({empty}), προμήθεια με καθαριότητα και πάγια ({costs}) και ο φόρος ({shortTax}). Μένουν {shortNet}.',
      cue: 'Whoosh με νότα στη μάσκα, μία μπάρα ανά χτύπο.',
      eyebrow: 'Με πληρότητα {occ}', title: ['Από **{naive}**', 'σε {shortNet}.'],
      start: { label: 'Γεμάτο', value: 'naive' },
      steps: [
        { label: 'Άδειες', value: 'empty', color: K.muted },
        { label: 'Κόστη', value: 'costs', color: SEG.enfia },
        { label: 'Φόρος', value: 'shortTax', color: SEG.tax },
      ],
      end: { label: 'Μένουν', value: 'shortNet' },
    }),
    bigNumber({
      beats: 13, arc: 'turn', in: 'whip', inOpts: { dir: 'right' }, note: true,
      story: 'Whip: και ο ενοικιαστής; Η διαφορά μετρά ως τα {diff} τον χρόνο, {diffMonth} τον μήνα.',
      cue: 'Whoosh στο κόψιμο, κλικ που μετρούν, βαθύ χτύπημα και καμπάνα στο ποσό.',
      eyebrow: 'Με ενοικιαστή στα {rent} τον μήνα', title: ['Το Airbnb αφήνει', '**παραπάνω** μόνο:'], valueFact: 'diff',
      caption: 'Τον χρόνο, με πληρότητα **{occ}**.',
      rows: [
        { label: 'Airbnb, καθαρά', value: '{shortNet}' },
        { label: 'Ενοικιαστής, καθαρά', value: '{longNet}' },
      ],
      chips: ['{diffMonth} τον μήνα'],
    }),
    quote({
      beats: 13, arc: 'stakes', in: 'splitSwap', inOpts: { axis: 'x' },
      story: 'Η οθόνη σκίζεται κάθετα: η ερώτηση του Πέτρου γράφεται. Απάντηση: με {lowOcc} κερδίζει ο ενοικιαστής.',
      cue: 'Σκίσιμο με χτύπημα, πλήκτρα, καμπάνα στην απάντηση.',
      label: 'Η ερώτηση του Πέτρου', question: 'Κι αν η πληρότητα πέσει στο {lowOcc};',
      answer: 'Τότε κερδίζει **ο ενοικιαστής**, κατά {lossLow} τον χρόνο.',
    }),
    tileGrid({
      beats: 13, arc: 'payoff', in: 'zoomThrough', inOpts: { target: 'qa3' },
      story: 'Ζουμ μέσα στην απάντηση: εκατό τετράγωνα, οι νύχτες του χρόνου. Τα {beCeil} φέρνουν τα ίδια με τον ενοικιαστή, τα {gainSq} είναι το κέρδος, τα {emptySq} μένουν άδεια.',
      cue: 'Σάρωμα που ανεβαίνει στο ζουμ, κλικ στα τετράγωνα.',
      eyebrow: 'Το όριο: {beNights} νύχτες τον χρόνο', title: ['Πληρότητα', 'ισορροπίας: **{beCeil}**'],
      counts: [
        { n: 'beCeil', color: SEG.other, label: 'Το όριο' },
        { n: 'gainSq', color: K.ok, label: 'Κέρδος' },
        { n: 'emptySq', color: K.faint, label: 'Άδειες' },
      ],
    }),
    calcCard({
      beats: 14, arc: 'action', in: 'cardFlip',
      story: 'Η κάρτα γυρίζει: ο υπολογιστής «Βραχυχρόνια ή μακροχρόνια». Τα πεδία του Πέτρου γεμίζουν και βγάζουν το όριο, {beCeil}.',
      cue: 'Γύρισμα χαρτιού, πλήκτρα σε κάθε πεδίο, χτύπημα στο αποτέλεσμα.',
      eyebrow: 'Το δικό σου σπίτι', title: ['Βάλε τα', '**δικά σου**.'], name: 'Βραχυχρόνια ή μακροχρόνια',
      fields: [
        { label: 'Ενοίκιο τον μήνα', value: 'rent' }, { label: 'Τιμή τη νύχτα', value: 'night' },
        { label: 'Πληρότητα', value: 'occ' }, { label: 'Προμήθεια', value: 'fee' },
      ],
      result: { label: 'Πληρότητα ισορροπίας', value: 'beCeil' }, path: '/vraxyxronia-i-makroxronia',
    }),
    endCard({
      beats: 12, arc: 'loop', in: 'lightLeak',
      story: 'Διαρροή φωτός: σήμα, «Airbnb ή ενοικιαστής;», ο σύνδεσμος. Ο βρόχος ξαναστήνει το πρώτο καρέ.',
      cue: 'Ζεστό σάρωμα, καμπάνες, η πρώτη συγχορδία στο τέλος.',
      title: ['Airbnb ή', '**ενοικιαστής**;'], path: '/vraxyxronia-i-makroxronia', action: 'Βάλε ενοίκιο, τιμή και πληρότητα. Δες το δικό σου όριο.',
    }),
  ],
  cover: 0,
  texts: {
    youtube: {
      title: 'Airbnb ή ενοικιαστής; Το κρίνει η πληρότητα #Shorts',
      description: [
        'Ο Πέτρος βάζει το διαμέρισμά του ({sqm} τ.μ.) στο Airbnb με {night} τη νύχτα. Γεμάτο για {yearNights} νύχτες θα έβγαζε {naive}. Κανένα σπίτι όμως δεν γεμίζει κάθε νύχτα.',
        '',
        'Με πληρότητα {occ} ({nights} νύχτες) ο τζίρος είναι {shortGross}. Φεύγουν προμήθεια πλατφόρμας {platformFee}, καθαριότητα και πάγια {running}, φόρος {shortTax}. Μένουν {shortNet}.',
        '',
        'Με ενοικιαστή στα {rent} τον μήνα μένουν {longNet}: φεύγει μόνο ο φόρος ({longTax}). Η διαφορά είναι {diff} τον χρόνο, {diffMonth} τον μήνα.',
        '',
        'Το όριο είναι {beCeil} πληρότητα, {beNights} νύχτες τον χρόνο. Από κάτω αφήνει περισσότερα η μακροχρόνια: με {lowOcc} ο ενοικιαστής κερδίζει κατά {lossLow}.',
        '',
        'Το τέλος ανθεκτικότητας ({levy} στο παράδειγμα) το πληρώνει ο επισκέπτης πάνω από την τιμή σου και εσύ το αποδίδεις: δεν είναι έσοδό σου.',
        '',
        'Βάλε τα δικά σου: {ctaUrl}',
        '',
        'Παράδειγμα με τις προεπιλογές του υπολογιστή: φυσικό πρόσωπο με ένα ακίνητο. Για τη δική σου περίπτωση, ο λογιστής σου.',
      ].join('\n'),
      tags: ['Airbnb', 'βραχυχρόνια μίσθωση', 'μακροχρόνια μίσθωση', 'πληρότητα', 'φόρος Airbnb', 'τέλος ανθεκτικότητας', 'ιδιοκτήτες ακινήτων', 'PROPERWISE'],
    },
    instagram: {
      caption: [
        'Airbnb ή ενοικιαστής; Το κρίνει ένα νούμερο: η πληρότητα.',
        '',
        'Ο Πέτρος μετρά {night} τη νύχτα επί {yearNights} νύχτες: {naive}. Με πληρότητα {occ} όμως, μετά από προμήθεια, καθαριότητα, πάγια και φόρο, του μένουν {shortNet}.',
        '',
        'Με ενοικιαστή στα {rent} τον μήνα θα του έμεναν {longNet}. Η διαφορά: {diff} τον χρόνο.',
        '',
        'Το όριο είναι {beCeil} πληρότητα ({beNights} νύχτες τον χρόνο). Από κάτω αφήνει περισσότερα η μακροχρόνια.',
        '',
        'Βάλε τα δικά σου στον υπολογιστή: σύνδεσμος στο bio. Στείλ\' το σε όποιον σκέφτεται Airbnb.',
      ].join('\n'),
      alt: '{yearNights} νύχτες και {naive}: ο λογαριασμός του Πέτρου. Καταρράκτης από {naive} σε {shortNet}: άδειες νύχτες {empty}, προμήθεια με καθαριότητα και πάγια {costs}, φόρος {shortTax}. Η διαφορά από τον ενοικιαστή, {diff} τον χρόνο. Με {lowOcc} πληρότητα κερδίζει ο ενοικιαστής. Εκατό τετράγωνα: {beCeil} ως το όριο, {gainSq} κέρδος, {emptySq} άδειες νύχτες. Ο υπολογιστής «Βραχυχρόνια ή μακροχρόνια».',
      hashtags: ['airbnb', 'βραχυχρόνιαμίσθωση', 'ακίνητα', 'ενοίκιο', 'PROPERWISE'],
    },
    tiktok: {
      caption: 'Airbnb ή ενοικιαστής; Με {night} τη νύχτα το όριο είναι {beCeil} πληρότητα. Από κάτω κερδίζει ο ενοικιαστής. Στείλ\' το σε όποιον σκέφτεται Airbnb.',
      hashtags: ['airbnb', 'βραχυχρόνια', 'ακίνητα', 'ενοίκιο', 'ελλάδα'],
    },
    pinned: 'Τι πληρότητα είχες φέτος; Γράψε το ποσοστό σου και δες στον υπολογιστή αν βγήκες πάνω ή κάτω από το όριο: {ctaUrl}',
  },
};

export const SPECS = [ENOIKIA, VRAXY_MAKRO];
