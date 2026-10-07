// ═══════════════════════════════════════════════════════════════════════════
// SHORTS · ΤΑ ΓΕΓΟΝΟΤΑ, ΑΠΟ ΤΟΝ ΚΩΔΙΚΑ
// ─────────────────────────────────────────────────────────────────────────
// Κάθε αριθμός, ημερομηνία και διαδρομή ενός short βγαίνει από ΕΔΩ. Και εδώ
// δεν γράφεται κανένας: όλα ρωτούν τις ίδιες συναρτήσεις που τρέχει η
// εφαρμογή και οι οδηγοί του site. Αν μια συνθήκη της ιστορίας πάψει να ισχύει
// (π.χ. η δόση δεν πέφτει πια πριν από Σαββατοκύριακο), η παραγωγή σταματά
// αντί να πει κάτι που δεν ισχύει.
// ═══════════════════════════════════════════════════════════════════════════
import { enfiaInstalments as enfiaDates, instalmentStatus, obligationOf } from '../../../app/odigos/enfia-2026-pliromi-doseis-pistopoiitiko/schedule';
import { SPLIT_APARTMENT, SPLIT_STAY, APARTMENT, LARGE_HOUSE, EXAMPLE_SQM } from '../../../app/odigos/airbnb-takk-2026/examples';
import { enfiaInstalments } from '../../../lib/tools/enfiaSchedule';
import { AADE_DESTINATIONS } from '../../../lib/tax/aade';
import { dailyPush, HORIZON_DAYS } from '../../../lib/push/message';
import { climateLevyForNights, isHighSeasonMonth } from '../../../lib/billing/greekTax';
import { CLIMATE_LEVY_AREA_SQM } from '../../../lib/billing/climateLevyCategories';
import { billingWords } from '../../../lib/legal/billingWords';
import { REGULATED } from '../../../lib/legal/validity';
import { fe, feWhole, fn } from '../../../lib/core/format';
import { monthNom, monthGen, monthAcc } from '../../../lib/core/months';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { enfiaExample } from '../seiresData';
import { fact, type Fact, type Facts } from './kit';

const DAY = 864e5;
const days = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / DAY);
const addDays = (iso: string, d: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + d * DAY).toISOString().slice(0, 10);
const WEEK = ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο'];
const weekday = (iso: string) => WEEK[new Date(`${iso}T12:00:00Z`).getUTCDay()];
/** «30/10»: ημέρα και μήνας χωρίς μηδενικά μπροστά, όπως γράφονται σε τίτλο. */
const dm = (iso: string) => `${Number(iso.slice(8, 10))}/${Number(iso.slice(5, 7))}`;
/** «26/2/2027». */
const dmy = (iso: string) => `${dm(iso)}/${iso.slice(0, 4)}`;
/** «29 Οκτωβρίου». */
const dLong = (iso: string) => `${Number(iso.slice(8, 10))} ${monthGen(Number(iso.slice(5, 7)) - 1)}`;
/** Ποσό: ακέραιο χωρίς «,00», αλλιώς με τα δεκαδικά του (ο μορφοποιητής της εφαρμογής). */
const eur = (x: number) => (Math.abs(x - Math.round(x)) < .005 ? feWhole(x) : fe(x));
/** Αύξων αριθμός: «8η». */
const ord = (k: number) => `${k}η`;

const put = (out: Facts, f: Fact) => { if (out[f.id]) throw new Error(`Διπλό γεγονός «${f.id}».`); out[f.id] = f; };

/** Ως πότε ισχύει ένα μέγεθος, από το μητρώο του lib/legal/validity.ts. */
export function validTo(id: string): string | null {
  const r = REGULATED.find(x => x.id === id);
  if (!r) throw new Error(`Το μητρώο ισχύος δεν έχει «${id}».`);
  return r.validTo;
}

// ═══ ΕΝΦΙΑ: η επόμενη δόση από τη μέρα δημοσίευσης ════════════════════════
const SRC_CAL = 'lib/tax/greekTaxCalendar.ts (greekPropertyTaxObligations) μέσω app/odigos/enfia-2026-pliromi-doseis-pistopoiitiko/schedule.ts';
export function enfiaFacts(date: string): Facts {
  const out: Facts = {};
  const V = { validity: 'enfia-instalments' };
  // Το εκκαθαριστικό που τρέχει τη μέρα του short: φετινό, ή το περσινό αν οι δόσεις του δεν τελείωσαν.
  const y0 = Number(date.slice(0, 4));
  const year = [y0, y0 - 1].find(y => instalmentStatus(enfiaDates(y), date).next);
  if (!year) throw new Error(`Καμία δόση ΕΝΦΙΑ δεν λήγει μετά τις ${date}.`);
  const D = enfiaDates(year), { left, next } = instalmentStatus(D, date);
  if (!next) throw new Error('Δεν υπάρχει επόμενη δόση.');
  const nextNo = D.indexOf(next) + 1, total = D.length, paid = nextNo - 1;
  const first = obligationOf(year, 'enfia-first');
  if (first.confidence !== 'statutory') throw new Error(`Ο ΕΝΦΙΑ ${year} δεν έχει εκδοθεί: οι ημερομηνίες είναι περυσινές και δεν λέγονται ως προθεσμία.`);
  const law = /ν\. \d+\/\d{4}, άρθρο \d+/.exec(first.notes)?.[0];
  if (!law) throw new Error('Το ημερολόγιο δεν γράφει τη νομική βάση των δόσεων.');
  // Η ιστορία στέκει ΜΟΝΟ αν το τέλος του μήνα είναι μη εργάσιμη και η δόση λήγει νωρίτερα.
  const [ny, nm] = next.split('-').map(Number);
  const monthEnd = new Date(Date.UTC(ny, nm, 0)).toISOString().slice(0, 10);
  if (monthEnd === next) throw new Error('Η δόση λήγει την τελευταία μέρα του μήνα: η ιστορία «λήγει νωρίτερα» δεν ισχύει αυτόν τον μήνα.');
  const daysLeft = days(date, next);
  if (daysLeft > 45 || daysLeft < 1) throw new Error(`Η δόση απέχει ${daysLeft} ημέρες: δεν είναι αντίστροφη μέτρηση.`);

  put(out, fact('enfiaYear', year, String(year), SRC_CAL, { ...V, kind: 'date' }));
  put(out, fact('nextNo', nextNo, ord(nextNo), SRC_CAL, V));
  put(out, fact('nextIso', next, next, SRC_CAL, { ...V, kind: 'date' }));
  put(out, fact('nextDM', next, dm(next), SRC_CAL, { ...V, kind: 'date' }));
  put(out, fact('nextLong', next, dLong(next), SRC_CAL, { ...V, kind: 'date' }));
  put(out, fact('nextWeekday', next, weekday(next), SRC_CAL, { ...V, kind: 'text' }));
  put(out, fact('monthEndIso', monthEnd, monthEnd, 'Ημερολόγιο: τελευταία μέρα του μήνα της δόσης', { kind: 'date' }));
  put(out, fact('monthEndDM', monthEnd, dm(monthEnd), 'Ημερολόγιο: τελευταία μέρα του μήνα της δόσης', { kind: 'date' }));
  put(out, fact('monthEndWeekday', monthEnd, weekday(monthEnd), 'Ημερολόγιο', { kind: 'text' }));
  put(out, fact('todayIso', date, date, 'Η μέρα δημοσίευσης', { kind: 'date' }));
  put(out, fact('daysLeft', daysLeft, String(daysLeft), `${SRC_CAL}: από ${date} ως ${next}`, V));
  put(out, fact('daysDots', daysLeft, String(daysLeft), 'ίδιο με daysLeft', V));
  put(out, fact('total', total, String(total), SRC_CAL, V));
  put(out, fact('paid', paid, String(paid), `${SRC_CAL} (instalmentStatus)`, V));
  put(out, fact('left', left, String(left), `${SRC_CAL} (instalmentStatus)`, V));
  put(out, fact('dates', D.join(','), D.join(','), SRC_CAL, { ...V, kind: 'date' }));
  put(out, fact('lastDMY', D[D.length - 1], dmy(D[D.length - 1]), SRC_CAL, { ...V, kind: 'date' }));
  put(out, fact('law', law, law, `${SRC_CAL}: σημειώσεις της enfia-first`, { ...V, kind: 'text' }));

  // Το παράδειγμα: οι προεπιλογές του δημόσιου υπολογιστή (app/ypologismos-enfia/spec.ts).
  const ex = enfiaExample();
  const inst = enfiaInstalments(ex.r.annual, year);
  if (inst.map(x => x.date).join() !== D.join()) throw new Error('Οι δόσεις του υπολογιστή και του ημερολογίου έχουν άλλες ημερομηνίες.');
  const rest = inst.slice(nextNo - 1), restSum = Math.round(rest.reduce((s, x) => s + x.amount, 0) * 100) / 100;
  const SRC_EX = 'lib/billing/enfia.ts (estimateENFIA) με τις προεπιλογές του app/ypologismos-enfia/spec.ts · lib/tools/enfiaSchedule.ts (enfiaInstalments)';
  put(out, fact('sqm', ex.sqm, fn(ex.sqm), 'app/ypologismos-enfia/spec.ts (SPEC.tm)'));
  put(out, fact('annual', ex.r.annual, eur(ex.r.annual), SRC_EX, { kind: 'money' }));
  put(out, fact('each', inst[0].amount, eur(inst[0].amount), SRC_EX, { kind: 'money' }));
  put(out, fact('lastAmount', inst[inst.length - 1].amount, eur(inst[inst.length - 1].amount), SRC_EX, { kind: 'money' }));
  put(out, fact('restSum', restSum, eur(restSum), `${SRC_EX}: άθροισμα από την ${ord(nextNo)} ως την ${ord(total)}`, { kind: 'money' }));
  // Όλες οι δόσεις που μένουν, μία μία: η λίστα του κινητού και η ανάλυση του ποσού.
  rest.forEach((x, i) => {
    put(out, fact(`row${i}No`, x.no, `${ord(x.no)} δόση`, SRC_EX));
    put(out, fact(`row${i}DM`, x.date, dm(x.date), SRC_EX, { kind: 'date' }));
    put(out, fact(`row${i}Amt`, x.amount, eur(x.amount), SRC_EX, { kind: 'money' }));
  });
  put(out, fact('restCount', rest.length, String(rest.length), SRC_EX));

  // Η υπενθύμιση: η ίδια συνάρτηση που γράφει την ειδοποίηση της εφαρμογής.
  const eve = addDays(next, -HORIZON_DAYS);
  const push = dailyPush([{ uid: `tax:enfia-instalment-${year}-${nextNo}`, date: next, title: `ΕΝΦΙΑ, ${ord(nextNo)} δόση` }], eve);
  if (!push) throw new Error('Η ειδοποίηση της εφαρμογής δεν βγαίνει για την παραμονή της δόσης.');
  const SRC_PUSH = 'lib/push/message.ts (dailyPush, HORIZON_DAYS)';
  put(out, fact('pushTitle', push.title, push.title, SRC_PUSH, { kind: 'text' }));
  put(out, fact('pushBody', push.body, push.body, SRC_PUSH, { kind: 'text' }));
  put(out, fact('pushDay', eve, `${weekday(eve)} ${dLong(eve)}`, SRC_PUSH, { kind: 'date' }));
  put(out, fact('pushEveWeekday', eve, weekday(eve), SRC_PUSH, { kind: 'text' }));

  // Η διαδρομή στο myAADE: από το μητρώο προορισμών.
  const P = AADE_DESTINATIONS.enfia;
  put(out, fact('portal', P.portal, P.portal, 'lib/tax/aade.ts (AADE_DESTINATIONS.enfia)', { kind: 'text' }));
  P.steps.forEach((s, i) => put(out, fact(`step${i}`, s, s, 'lib/tax/aade.ts (AADE_DESTINATIONS.enfia.steps)', { kind: 'text' })));
  // Η κάρτα τέλους λέει «δες κάθε δόση με ημερομηνία»: μόνο αν ο υπολογιστής τις δείχνει.
  const calc = readFileSync(join(process.cwd(), 'app/ypologismos-enfia/EnfiaCalculator.tsx'), 'utf8');
  if (!/enfiaInstalments\(annual, year\)/.test(calc)) throw new Error('Ο υπολογιστής ΕΝΦΙΑ δεν δείχνει πια τις δόσεις με ημερομηνία.');
  return out;
}

// ═══ ΤΑΚΚ: τι αλλάζει την 1η του πρώτου μήνα χαμηλής περιόδου ═════════════
const SRC_LEVY = 'lib/billing/greekTax.ts (CLIMATE_LEVY_FROM_2025, climateLevyRates, isHighSeasonMonth, climateLevyForNights)';
const SRC_EXAMPLES = 'app/odigos/airbnb-takk-2026/examples.ts (SPLIT_STAY, levyByMonth)';
export function takkFacts(date: string): Facts {
  const out: Facts = {};
  const V = { validity: 'climate-levy' };
  // Ο πρώτος μήνας χαμηλής περιόδου μετά τη μέρα του short.
  let y = Number(date.slice(0, 4)), m = Number(date.slice(5, 7)) - 1;
  if (!isHighSeasonMonth(m)) throw new Error('Το short μιλά για την αλλαγή σε χαμηλή περίοδο, αλλά είμαστε ήδη σε χαμηλή.');
  while (isHighSeasonMonth(m)) { m++; if (m > 11) { m = 0; y++; } }
  const lowIso = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const lastHigh = addDays(lowIso, -1);
  const toLow = days(date, lowIso);
  if (toLow > 45 || toLow < 1) throw new Error(`Η αλλαγή απέχει ${toLow} ημέρες.`);
  put(out, fact('lowIso', lowIso, lowIso, SRC_LEVY, { ...V, kind: 'date' }));
  put(out, fact('lowDM', lowIso, dm(lowIso), SRC_LEVY, { ...V, kind: 'date' }));
  put(out, fact('lastHighDM', lastHigh, dm(lastHigh), SRC_LEVY, { ...V, kind: 'date' }));
  put(out, fact('lowMonth', m, monthNom(m), SRC_LEVY, { kind: 'text' }));
  put(out, fact('toLow', toLow, String(toLow), `${SRC_LEVY}: από ${date} ως ${lowIso}`, V));
  put(out, fact('aptHigh', APARTMENT.high, eur(APARTMENT.high), SRC_LEVY, { ...V, kind: 'money' }));
  put(out, fact('aptLow', APARTMENT.low, eur(APARTMENT.low), SRC_LEVY, { ...V, kind: 'money' }));
  put(out, fact('houseHigh', LARGE_HOUSE.high, eur(LARGE_HOUSE.high), SRC_LEVY, { ...V, kind: 'money' }));
  put(out, fact('houseLow', LARGE_HOUSE.low, eur(LARGE_HOUSE.low), SRC_LEVY, { ...V, kind: 'money' }));
  put(out, fact('houseSqm', CLIMATE_LEVY_AREA_SQM, fn(CLIMATE_LEVY_AREA_SQM), 'lib/billing/climateLevyCategories.ts (CLIMATE_LEVY_AREA_SQM)', V));
  put(out, fact('exSqm', EXAMPLE_SQM, fn(EXAMPLE_SQM), SRC_EXAMPLES));

  // Η κράτηση του οδηγού: άφιξη, αναχώρηση, νύχτες ανά μήνα, τέλος ανά μήνα.
  const [O, N] = SPLIT_APARTMENT.months;
  if (!O || !N || SPLIT_APARTMENT.months.length !== 2) throw new Error('Η κράτηση του οδηγού δεν περνά πια από δύο μήνες.');
  if (`${O.year}-${String(N.month0 + 1).padStart(2, '0')}-01` !== lowIso) throw new Error('Η κράτηση του οδηγού δεν περνά την αλλαγή που λέει το short.');
  const nightsAll = O.nights + N.nights;
  const wrong = climateLevyForNights(Array.from({ length: 12 }, (_, i) => (i === O.month0 ? nightsAll : 0)), EXAMPLE_SQM, false);
  put(out, fact('arrDM', SPLIT_STAY.arrival, dm(SPLIT_STAY.arrival), SRC_EXAMPLES, { kind: 'date' }));
  put(out, fact('depDM', SPLIT_STAY.departure, dm(SPLIT_STAY.departure), SRC_EXAMPLES, { kind: 'date' }));
  put(out, fact('nightsAll', nightsAll, String(nightsAll), SRC_EXAMPLES));
  put(out, fact('octNights', O.nights, String(O.nights), SRC_EXAMPLES));
  put(out, fact('novNights', N.nights, String(N.nights), SRC_EXAMPLES));
  put(out, fact('octLevy', O.levy, eur(O.levy), SRC_EXAMPLES, { ...V, kind: 'money' }));
  put(out, fact('novLevy', N.levy, eur(N.levy), SRC_EXAMPLES, { ...V, kind: 'money' }));
  put(out, fact('levyTotal', SPLIT_APARTMENT.total, eur(SPLIT_APARTMENT.total), SRC_EXAMPLES, { ...V, kind: 'money' }));
  put(out, fact('levyWrong', wrong, eur(wrong), `${SRC_LEVY}: όλες οι νύχτες με το ποσό της υψηλής περιόδου`, { ...V, kind: 'money' }));
  put(out, fact('octMonth', O.month0, monthNom(O.month0), SRC_EXAMPLES, { kind: 'text' }));
  put(out, fact('novMonth', N.month0, monthNom(N.month0), SRC_EXAMPLES, { kind: 'text' }));
  put(out, fact('octMonthAcc', O.month0, monthAcc(O.month0), SRC_EXAMPLES, { kind: 'text' }));
  put(out, fact('novMonthAcc', N.month0, monthAcc(N.month0), SRC_EXAMPLES, { kind: 'text' }));
  put(out, fact('octMonthGen', O.month0, monthGen(O.month0), SRC_EXAMPLES, { kind: 'text' }));
  put(out, fact('novMonthGen', N.month0, monthGen(N.month0), SRC_EXAMPLES, { kind: 'text' }));
  put(out, fact('octDeadline', O.deadline, dm(O.deadline), 'lib/billing/climateLevyCategories.ts (levyReturnDeadline)', { ...V, kind: 'date' }));
  put(out, fact('novDeadline', N.deadline, dm(N.deadline), 'lib/billing/climateLevyCategories.ts (levyReturnDeadline)', { ...V, kind: 'date' }));
  put(out, fact('docs', SPLIT_APARTMENT.months.length, String(SPLIT_APARTMENT.months.length), `${SRC_EXAMPLES}: ένα ειδικό στοιχείο ανά μήνα (FAQ ΑΑΔΕ ερ. 7)`));
  // Οι νύχτες μία μία, για τα πλακίδια.
  let k = 0;
  for (const M of SPLIT_APARTMENT.months) for (let d = M.firstNight; d <= M.lastNight; d++, k++) {
    put(out, fact(`n${k}d`, d, String(d), SRC_EXAMPLES, { kind: 'date' }));
    put(out, fact(`n${k}r`, M.rate, eur(M.rate), SRC_LEVY, { ...V, kind: 'money' }));
  }
  put(out, fact('octRate', O.rate, eur(O.rate), SRC_LEVY, { ...V, kind: 'money' }));
  put(out, fact('novRate', N.rate, eur(N.rate), SRC_LEVY, { ...V, kind: 'money' }));
  // Η πηγή του «ένα στοιχείο ανά μήνα», όπως τη γράφει ο οδηγός.
  const guide = readFileSync(join(process.cwd(), 'app/odigos/airbnb-takk-2026/page.tsx'), 'utf8');
  const faq = /FAQ ΑΑΔΕ, ερ\. \d+(?=· Α\.1202\/2024\)\.'\})/.exec(guide)?.[0];
  if (!faq || !/για κάθε μήνα ξεχωριστά/.test(guide)) throw new Error('Ο οδηγός ΤΑΚΚ δεν γράφει πια το «ένα στοιχείο για κάθε μήνα» με την πηγή του.');
  put(out, fact('faqRef', faq, faq, 'app/odigos/airbnb-takk-2026/page.tsx (ενότητα «Από 1η Νοεμβρίου»)', { kind: 'text' }));
  put(out, fact('trial', billingWords().trialBadge, billingWords().trialBadge, 'lib/legal/billingWords.ts (trialBadge)', { kind: 'text' }));
  return out;
}
