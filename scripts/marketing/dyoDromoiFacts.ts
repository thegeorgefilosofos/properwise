// ═══════════════════════════════════════════════════════════════════════════
// «ΙΔΙΟ ΔΙΑΜΕΡΙΣΜΑ, ΔΥΟ ΔΡΟΜΟΙ»: ΤΑ ΓΕΓΟΝΟΤΑ, ΑΠΟ ΤΟΝ ΚΩΔΙΚΑ
// ─────────────────────────────────────────────────────────────────────────
// Ένα reel του Instagram και έξι stories που ενώνουν τα δύο shorts της
// 07/10/2026 («Πού πήγαν τα ενοίκια» και «Airbnb ή ενοικιαστής») σε μία ιστορία:
// η νύχτα πληρώνεται μόνο γεμάτη, η μέρα πάντα. Κάθε αριθμός βγαίνει ΕΔΩ από
// τις ίδιες συναρτήσεις που τρέχουν οι υπολογιστές του site:
//
//   · lib/tools/shortVsLong   το διαμέρισμα με τις προεπιλογές του υπολογιστή
//                             «Βραχυχρόνια ή μακροχρόνια» (seiresData.svlInput)
//   · lib/tools/apodosi       ο φόρος πάνω σε ενοίκιο που ήδη δηλώνεται
//   · lib/billing/greekTax    κλίμακα, οριακός και μέσος συντελεστής, τέλος παρεπιδημούντων
//   · rentFacts.yearAhead     τα ενοίκια της Ελένης (το ακίνητο επίδειξης)
//   · lib/legal/validity      ως πότε ισχύει κάθε ρυθμισμένο μέγεθος
//
// ΚΑΝΕΝΑ ΨΗΦΙΟ ΔΕΝ ΓΡΑΦΕΤΑΙ ΕΔΩ. Ό,τι η ιστορία υποθέτει (το καλοκαίρι γεμίζει
// πρώτο, ο Ιούνιος είναι ο μήνας που το Airbnb περνά μπροστά, το όριο είναι ζώνη)
// το ελέγχει ένας αυτοέλεγχος που ΣΤΑΜΑΤΑ την παραγωγή αν πάψει να ισχύει.
//
// ΤΙ ΔΕΝ ΞΑΝΑΛΕΓΕΤΑΙ. Τα χθεσινά shorts είπαν ήδη τα μερίδια ανά εκατό ευρώ, την
// τεκμαρτή έκπτωση, τα καθαρά της Ελένης, τον καταρράκτη του Airbnb, τη διαφορά
// του χρόνου, το όριο πληρότητας και την περίπτωση του μισού χρόνου. Το
// `assertNoRepeat` διαβάζει τα γεγονότα τους και σταματά όποιο κείμενο τα ξαναλέει.
// Τα ποσά που κρατούν τη γεωμετρία ενός γραφήματος χωρίς να τυπώνονται (το βασικό
// όριο, τα καθαρά της «σκιάς» στο dumbbell, οι νύχτες του παραδείγματος) έχουν
// ΚΕΝΟ κείμενο: δεν μπορούν να γραφτούν στην οθόνη ούτε κατά λάθος.
// ═══════════════════════════════════════════════════════════════════════════
import {
  compareShortVsLong, shortTermSide, longTermSide, breakEvenOccupancy, spreadNights,
  NIGHTS_PER_YEAR, HIGH_SEASON_NIGHTS, type ShortVsLongInput,
} from '../../lib/tools/shortVsLong';
import { marginalTaxOn, propertyYield } from '../../lib/tools/apodosi';
import {
  RENTAL_TAX_BRACKETS_2026, rentalBracketsForYear, marginalRate, effectiveRentalRate,
  municipalAccommodationTax, MUNICIPAL_ACCOM_TAX_RATE, isMunicipalTaxExempt, isHighSeasonMonth,
} from '../../lib/billing/greekTax';
import { PRESUMPTIVE_DEDUCTION_RATE, presumptiveDeductionRateForYear } from '../../lib/billing/presumptive';
import { fe, fn, fpRate } from '../../lib/core/format';
import { monthNom, monthAcc, monthShort } from '../../lib/core/months';
import { svlInput } from './seiresData';
import { yearAhead } from './rentFacts';
import { fact, type Fact, type Facts } from './shorts/kit';
import { validTo } from './shorts/facts';
import { enoikiaFacts, svlFacts } from './shorts/specs/2026-10-07';

const SRC_SVL = 'lib/tools/shortVsLong.ts (shortTermSide, longTermSide) με τις προεπιλογές του app/vraxyxronia-i-makroxronia/spec.ts';
const SRC_IN = 'app/vraxyxronia-i-makroxronia/spec.ts (SPEC) μέσω scripts/marketing/seiresData.ts (svlInput)';
const SRC_TAX = 'lib/billing/greekTax.ts (RENTAL_TAX_BRACKETS_2026, marginalRate, effectiveRentalRate)';
const SRC_APO = 'lib/tools/apodosi.ts (marginalTaxOn, propertyYield)';
const SRC_ELENI = 'scripts/marketing/rentFacts.ts (yearAhead: το ακίνητο επίδειξης, δώδεκα ενοίκια)';

/** Ποσό σε ευρώ: ακέραιο χωρίς «,00», αλλιώς με δύο δεκαδικά (ο μορφοποιητής της εφαρμογής). */
const eur = (x: number) => (Math.abs(x - Math.round(x)) < .005 ? fn(Math.round(x)) + '€' : fe(x));
/** Ποσό ανά νύχτα ή ημέρα: πάντα δύο δεκαδικά, ώστε η στήλη να στοιχίζεται. */
const eur2 = (x: number) => fe(x);
/** Ποσοστό ως ακέραιο προς τα πάνω, όπως το γράφει ο υπολογιστής («από 49%»). */
const pctCeil = (x: number) => `${fn(Math.ceil(x))}%`;
const rate = (r: number) => fpRate(r * 100);
const cents = (x: number) => Math.round(x * 100) / 100;
/**
 * Η ανοχή για k στρογγυλεύσεις σε λεπτά: k × 0,005€ συν ελάχιστο περιθώριο για την αριθμητική
 * κινητής υποδιαστολής. Ανοχή ίση με τη στρογγύλευση (0,005€ για μία) σταματούσε την
 * παραγωγή στο 0,005000000000109 (τιμή νύχτας 70€)· ανοχή 0,02€ για δώδεκα μήνες
 * σταματούσε με προμήθεια 3% (έλεγχος της 09/10/2026).
 */
const ROUNDING = (k: number) => k * .005 + 1e-9;
/** Τυπογραφικό μείον, σφιχτό (lib/core/format: feSigned). */
const MINUS = '−';

/** Τα αναγνωριστικά που έχουν κρατηθεί για άλλες αναρτήσεις: εδώ δεν γράφονται. */
export const BOOKED = ['be2025', 'diff2025', 'tax25Short', 'tax25Long', 'levyHigh', 'houseSame'];

/** Οι σειρές που τρέφουν γραφήματα: τιμή JSON, κείμενο κενό (δεν τυπώνονται ποτέ ως έχουν). */
export function series<T>(f: Facts, id: string): T { return JSON.parse(String(f[id]?.value ?? 'null')) as T; }

/**
 * `otherGross` (άλλο ποσό άλλων ενοικίων από της Ελένης) και `input` (άλλο διαμέρισμα από
 * τις προεπιλογές του υπολογιστή): ΜΟΝΟ για να δοκιμάζονται οι αυτοέλεγχοι
 * (scripts/marketing/dyoDromoi.test.ts). Η παραγωγή καλεί χωρίς αυτά.
 */
export function dyoDromoiFacts(date: string, opts: { otherGross?: number; input?: ShortVsLongInput } = {}): Facts {
  const out: Facts = {};
  const put = (x: Fact) => { if (out[x.id]) throw new Error(`Διπλό γεγονός «${x.id}».`); out[x.id] = x; };
  const geo = (id: string, v: unknown, source: string) => put(fact(id, JSON.stringify(v), '', source, { kind: 'text' }));
  const year = Number(date.slice(0, 4));
  const I: ShortVsLongInput = opts.input ?? svlInput;

  // ── Η κλίμακα της χρονιάς πρέπει να είναι αυτή που χρησιμοποιεί ο υπολογιστής ──
  if (rentalBracketsForYear(year) !== RENTAL_TAX_BRACKETS_2026) throw new Error(`Το ${year} έχει άλλη κλίμακα από το lib/tools/shortVsLong· η ιστορία θέλει νέα γωνία.`);
  const PRES = PRESUMPTIVE_DEDUCTION_RATE;
  if (presumptiveDeductionRateForYear(year, true) !== PRES) throw new Error('Η τεκμαρτή έκπτωση του propertyYield διαφέρει από του shortVsLong.');

  const cmp = compareShortVsLong(I), S = cmp.short, L = cmp.long;
  if (cmp.breakEvenPct == null || cmp.breakEvenNights == null) throw new Error('Η σύγκριση δεν έχει σημείο ισορροπίας.');
  if (S.municipalTax) throw new Error('Το παράδειγμα πληρώνει τέλος παρεπιδημούντων· η ροή της νύχτας δεν το δείχνει.');
  const nights = S.nights;
  if (Math.abs(nights - I.occupancyPct / 100 * NIGHTS_PER_YEAR) > 1e-9) throw new Error('Οι νύχτες του παραδείγματος δεν είναι ακέραιες.');

  // ── 1 · Η νύχτα: πού πάει η τιμή της ─────────────────────────────────────
  const clean = I.costPerNight, fixedYear = 12 * I.fixedPerMonth;
  const nightFee = cents(S.platformFee / nights), nightClean = cents(clean), nightFixed = cents(fixedYear / nights);
  const nightTax = cents(S.tax / nights), nightNet = cents(S.net / nights);
  if (Math.abs(nightFee + nightClean + nightFixed + nightTax + nightNet - I.nightlyPrice) > .01) throw new Error('Τα κομμάτια της νύχτας δεν αθροίζουν στην τιμή της.');
  if (Math.abs(S.running - clean * nights - fixedYear) > .01) throw new Error('Τα λειτουργικά δεν είναι καθαριότητα ανά νύχτα και πάγια ανά μήνα.');

  // ── 2 · Η μέρα: τι αφήνει ο ενοικιαστής ─────────────────────────────────
  const tenantPerDay = cents(L.net / NIGHTS_PER_YEAR), tenantTaxDay = cents(L.tax / NIGHTS_PER_YEAR), tenantGrossDay = cents(L.gross / NIGHTS_PER_YEAR);
  if (Math.abs(tenantPerDay + tenantTaxDay - tenantGrossDay) > ROUNDING(3)) throw new Error('Ο φόρος της μέρας και τα καθαρά της δεν κάνουν το ενοίκιο της μέρας.');
  if (!(nightNet > tenantPerDay)) throw new Error('Η νύχτα δεν αφήνει πια περισσότερα από τη μέρα· το αγκίστρι δεν στέκει.');

  // ── 3 · Ο φόρος που λυγίζει: οριακός, μέσος, τα δύο τείχη ────────────────
  const taxableAt = (n: number) => n * I.nightlyPrice * (1 - PRES);
  const margLong = marginalRate(L.taxable), margShort = marginalRate(S.taxable), effShort = effectiveRentalRate(S.taxable);
  const B = RENTAL_TAX_BRACKETS_2026;
  const wallNight = (k: number) => Math.ceil(B[k].from / ((1 - PRES) * I.nightlyPrice) + 1e-9);
  const occ25 = wallNight(1), occ35 = wallNight(2);
  if (marginalRate(taxableAt(occ25 - 1)) !== margLong || marginalRate(taxableAt(occ25)) !== margShort) throw new Error('Ο οριακός δεν αλλάζει από τον συντελεστή του ενοικιαστή στον συντελεστή του παραδείγματος στο πρώτο τείχος.');
  if (marginalRate(taxableAt(occ35 - 1)) !== margShort || marginalRate(taxableAt(occ35)) !== B[2].rate) throw new Error('Ο οριακός δεν αλλάζει στο δεύτερο τείχος.');
  if (!(occ35 <= NIGHTS_PER_YEAR)) throw new Error('Το δεύτερο τείχος πέφτει έξω από τον χρόνο.');
  if (!(nights > occ25 && nights < occ35)) throw new Error('Το παράδειγμα δεν κάθεται ανάμεσα στα δύο τείχη.');
  const effCurve = Array.from({ length: NIGHTS_PER_YEAR }, (_, i) => +effectiveRentalRate(taxableAt(i + 1)).toFixed(5));
  const margCurve = Array.from({ length: NIGHTS_PER_YEAR }, (_, i) => marginalRate(taxableAt(i + 1)));

  // ── 4 · Ο χρόνος: πότε έρχονται τα λεφτά (ταμείο πριν τον φόρο) ──────────
  // ΤΟ ΑΘΡΟΙΣΜΑ ΕΛΕΓΧΕΤΑΙ ΣΤΑ ΑΚΡΙΒΗ ΠΟΣΑ. Η πρώτη έκδοση στρογγύλευε κάθε μήνα σε λεπτά
  // και σύγκρινε το άθροισμα με ανοχή 0,02€· δώδεκα στρογγυλεύσεις φτάνουν τα 0,06€, οπότε
  // μια προμήθεια 3% ή 17% σταματούσε την παραγωγή με λάθος διάγνωση («οι μήνες δεν
  // αθροίζουν») ενώ οι μήνες αθροίζουν ακριβώς. Εδώ: (α) οι ακριβείς μήνες κάνουν ακριβώς το
  // ακριβές ταμείο της χρονιάς (όλες οι νύχτες μοιράστηκαν)· (β) το ταμείο της
  // shortTermSide διαφέρει από αυτό μόνο κατά τις στρογγυλεύσεις του (τζίρος, προμήθεια,
  // λειτουργικά, διαφορά). Οι στρογγυλεμένοι μήνες είναι μόνο για εμφάνιση και γεωμετρία.
  const perNightCash = I.nightlyPrice * (1 - I.platformFeePct / 100) - clean;
  const rawMonths = (season: 'high' | 'even') => spreadNights(nights, season).map(n => n * perNightCash - I.fixedPerMonth);
  const total = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const rawSummer = rawMonths('high'), rawEven = rawMonths('even'), decExact = nights * perNightCash - fixedYear;
  if (Math.abs(total(rawSummer) - decExact) > 1e-6 || Math.abs(total(rawEven) - decExact) > 1e-6) throw new Error('Οι μήνες δεν αθροίζουν στο ταμείο της χρονιάς.');
  const decShort = cents(S.gross - S.platformFee - S.running);
  if (Math.abs(decShort - decExact) > ROUNDING(4)) throw new Error('Το ταμείο της shortTermSide δεν είναι τιμή μείον προμήθεια και καθαριότητα ανά νύχτα και πάγια.');
  const summerNights = spreadNights(nights, 'high');
  const summer = rawSummer.map(cents), even = rawEven.map(cents), tenant = Array.from({ length: 12 }, () => I.monthlyRent);
  const sum = (xs: number[]) => cents(total(xs));
  const cum = (xs: number[]) => xs.reduce<number[]>((a, x) => [...a, cents((a[a.length - 1] ?? 0) + x)], []);
  const cS = cum(summer), cE = cum(even), cT = cum(tenant);
  if (Math.abs(cS[11] - sum(summer)) > ROUNDING(1) || Math.abs(cE[11] - sum(even)) > ROUNDING(1)) throw new Error('Ο Δεκέμβριος του αθροιστικού δεν είναι το άθροισμα των μηνών.');
  if (cT[11] !== L.gross) throw new Error('Το αθροιστικό του ενοικιαστή δεν φτάνει το ενοίκιο της χρονιάς.');
  const cross = cS.findIndex((x, i) => x > cT[i]);
  if (cross < 1 || cS.slice(0, cross).some((x, i) => x > cT[i])) throw new Error('Το «κυρίως καλοκαίρι» δεν ξεκινά πίσω από τον ενοικιαστή.');
  if (cS.slice(cross).some((x, i) => x <= cT[cross + i])) throw new Error('Μετά τη διασταύρωση το Airbnb ξαναπέφτει πίσω.');
  const negMonths = summer.filter(x => x < 0).length;
  if (!negMonths) throw new Error('Κανένας μήνας δεν βγαίνει αρνητικός· η σκηνή «πάγια πάνω από τις κρατήσεις» δεν στέκει.');
  const peak = Math.max(...summer);
  if (summer.filter(x => x === peak).length !== 7) throw new Error('Το καλοκαίρι δεν είναι επτά ίσοι μήνες.');

  // ── 5 · Ο άδειος μήνας του ενοικιαστή ───────────────────────────────────
  const L11 = longTermSide(I.monthlyRent * 11 / 12);
  const vacancy1 = cents(L.net - L11.net);
  const be11 = breakEvenOccupancy(I, L11.net);
  if (be11 == null) throw new Error('Με έναν άδειο μήνα δεν βγαίνει όριο.');

  // ── 6 · Με ένα ενοίκιο ήδη: η Ελένη του χθεσινού short ───────────────────
  const Y = yearAhead();
  const otherGross = opts.otherGross ?? Y.gross, otherTaxable = otherGross * (1 - PRES);
  if (municipalAccommodationTax(S.gross, { individual: true, propertyCount: 2 })) throw new Error('Με δύο ακίνητα πληρώνεται τέλος παρεπιδημούντων· η πλευρά Airbnb της Ελένης θέλει και αυτό.');
  const calcMonths = L.gross / I.monthlyRent;
  if (!Number.isInteger(calcMonths)) throw new Error('Η μακροχρόνια δεν είναι ακέραιοι μήνες.');
  const pyLong = propertyYield({ value: 0, monthlyRent: I.monthlyRent, monthsRented: calcMonths, enfia: 0, expenses: 0, otherRentalIncome: otherGross, year, viaBank: true });
  const extraLong = marginalTaxOn(L.taxable, otherTaxable, year);
  const longNetE = cents(L.gross - extraLong);
  if (Math.abs(pyLong.net - longNetE) > .005) throw new Error(`Ο υπολογιστής καθαρής απόδοσης βγάζει ${pyLong.net}, η σύγκριση ${longNetE}.`);
  const shortNetWith = (occ: number) => { const s = shortTermSide(I, occ); return s.gross - s.platformFee - s.running - marginalTaxOn(s.taxable, otherTaxable, year); };
  const extraShort = marginalTaxOn(S.taxable, otherTaxable, year);
  // ΤΟ ΝΕΟ ΕΝΟΙΚΙΟ ΜΠΑΙΝΕΙ ΠΑΝΩ ΣΤΑ ΑΛΛΑ. Η λεζάντα λέει ότι ξεκινά από το κλιμάκιο όπου
  // σταματούν τα άλλα ενοίκια και ανεβαίνει ως τον οριακό που γράφει, με τον φόρο που
  // πραγματικά φέρνει. Η πρώτη έκδοση (08/10/2026) έγραφε «σε έχουν ήδη ανεβάσει κλιμάκιο…
  // κάθε νέο ευρώ πάει στο 25%», ενώ τα άλλα ενοίκια μόνα τους έμεναν στο πρώτο κλιμάκιο·
  // ο έλεγχος κοίταζε μόνο τον τελικό οριακό και δεν το έπιανε. Εδώ: ο οριακός των άλλων
  // είναι ΧΑΜΗΛΟΤΕΡΟΣ από τον τελικό και ο φόρος του νέου πέφτει ΑΝΑΜΕΣΑ στα δύο ποσοστά
  // (όχι όλος στον τελικό, όχι όλος στον αρχικό).
  const margOther = marginalRate(otherTaxable);
  const climbs = (taxable: number, extra: number) => {
    const top = marginalRate(otherTaxable + taxable);
    return top > margOther && extra > margOther * taxable && extra < top * taxable;
  };
  if (!climbs(L.taxable, extraLong) || !climbs(S.taxable, extraShort)) throw new Error('Το νέο ενοίκιο δεν ανεβαίνει κλιμάκιο πάνω από τα άλλα· η λεζάντα «ξεκινά από το κλιμάκιο όπου σταματούν εκείνα και ανεβαίνει» δεν στέκει.');
  const shortNetE = cents(S.gross - S.platformFee - S.running - extraShort);
  if (Math.abs(shortNetWith(I.occupancyPct) - shortNetE) > ROUNDING(1)) throw new Error('Η πλευρά Airbnb της Ελένης δεν είναι τζίρος μείον προμήθεια, λειτουργικά και ο επιπλέον φόρος.');
  const diffE = cents(shortNetE - longNetE);
  if (!(diffE > 0 && diffE < cmp.difference)) throw new Error('Με ένα ενοίκιο ήδη η διαφορά δεν μικραίνει· η σκηνή δεν στέκει.');
  const bisect = (f: (x: number) => number, target: number) => {
    if (f(100) < target) return null;
    let lo = 0, hi = 100;
    for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (f(mid) >= target) hi = mid; else lo = mid; }
    return hi;
  };
  const beE = bisect(shortNetWith, longNetE);
  if (beE == null) throw new Error('Με ένα ενοίκιο ήδη το Airbnb δεν φτάνει τον ενοικιαστή ούτε γεμάτο.');
  const margLongE = marginalRate(otherTaxable + L.taxable), margShortE = marginalRate(otherTaxable + S.taxable);
  if (margLongE !== margShort || margShortE !== B[2].rate) throw new Error('Οι οριακοί της Ελένης δεν είναι οι συντελεστές των δύο τειχών.');
  // Η ζώνη θέλει αυτή τη σειρά: άδειος μήνας < βασικό όριο < ήδη ενοίκιο.
  if (!(be11 < cmp.breakEvenPct && cmp.breakEvenPct < beE)) throw new Error('Τα τρία όρια δεν σχηματίζουν ζώνη.');
  if (!(Math.ceil(be11) < Math.ceil(beE))) throw new Error('Τα άκρα της ζώνης στρογγυλεύουν στο ίδιο ποσοστό.');

  // ── 7 · Από ποιο ενοίκιο το Airbnb δεν κερδίζει ούτε γεμάτο ─────────────
  const beAt = (rent: number) => breakEvenOccupancy({ ...I, monthlyRent: rent }, longTermSide(rent).net);
  let lo = I.monthlyRent, hi = I.monthlyRent;
  while (beAt(hi) != null) hi *= 2;
  while (hi - lo > 1) { const mid = Math.floor((lo + hi) / 2); if (beAt(mid) == null) hi = mid; else lo = mid; }
  const rentNever = hi;
  if (beAt(rentNever - 1) == null || beAt(rentNever + 1) != null) throw new Error('Το ενοίκιο-όριο δεν χωρίζει «υπάρχει όριο» από «δεν υπάρχει».');

  // ── 8 · Από πόσα ακίνητα βραχυχρόνιας αλλάζει το καθεστώς ──────────────────
  // ΑΛΛΑΖΕΙ ΤΟ ΚΑΘΕΣΤΩΣ, ΟΧΙ ΜΟΝΟ Ο ΣΥΝΤΕΛΕΣΤΗΣ (η συχνή ερώτηση για τα πολλά ακίνητα στο
  // app/vraxyxronia-i-makroxronia/page.tsx). Η πρώτη κάρτα αποθήκευσης (08/10/2026) έγραφε
  // το ποσό του τέλους παρεπιδημούντων στον τζίρο του παραδείγματος «από το Νο ακίνητο»:
  // έκανε το όριο ένα τέλος πάνω στο νέο ακίνητο, με χρώμα κόστους. Το όριο είναι ΠΛΗΘΟΣ: με τόσα ακίνητα το φυσικό πρόσωπο κάνει έναρξη εργασιών
  // για ΟΛΗ τη δραστηριότητα (ΦΠΑ, χωρίς τεκμαρτή έκπτωση, τέλος που βαραίνει τον επισκέπτη,
  // app/odigos/airbnb-takk-2026). Σε αυτό το κλαδί ο κώδικας κρατά το όριο μόνο στο
  // isMunicipalTaxExempt («έως τόσα ακίνητα χωρίς έναρξη εργασιών»)· από εκεί βγαίνει.
  const exempt = (n: number) => isMunicipalTaxExempt({ individual: true, propertyCount: n });
  let mFrom = 1;
  while (exempt(mFrom)) { mFrom++; if (mFrom > 50) throw new Error('Το φυσικό πρόσωπο δεν χάνει ποτέ την εξαίρεση· η γραμμή «από τόσα ακίνητα» δεν στέκει.'); }
  if (mFrom < 2) throw new Error('Ούτε ένα ακίνητο δεν εξαιρείται· η γραμμή «από τόσα ακίνητα» δεν στέκει.');
  // Ένα πλήθος για όλη τη δραστηριότητα: κάτω από αυτό εξαιρείται κάθε πλήθος, από αυτό και πάνω κανένα.
  if (!Array.from({ length: mFrom - 1 }, (_, i) => i + 1).every(exempt) || [mFrom, mFrom + 1, mFrom + 2].some(exempt)) throw new Error('Η εξαίρεση δεν κόβεται σε ένα πλήθος ακινήτων.');
  const munAmount = municipalAccommodationTax(S.gross, { individual: true, propertyCount: mFrom });
  if (Math.abs(munAmount - cents(S.gross * MUNICIPAL_ACCOM_TAX_RATE)) > .005) throw new Error('Το τέλος παρεπιδημούντων δεν είναι ο συντελεστής επί του τζίρου.');

  // ── 9 · Μόνο καλοκαίρι: πόσες από τις καλοκαιρινές νύχτες πρέπει να γεμίσουν ──
  const beNightsExact = cmp.breakEvenPct / 100 * NIGHTS_PER_YEAR;
  if (!(beNightsExact <= HIGH_SEASON_NIGHTS)) throw new Error('Το όριο δεν χωρά στο καλοκαίρι· η γραμμή «μόνο καλοκαίρι» δεν στέκει.');
  const beShareHigh = beNightsExact / HIGH_SEASON_NIGHTS * 100;

  // ═══ Τα γεγονότα ═════════════════════════════════════════════════════════
  const VR = { validity: 'rental-brackets' }, VM = { validity: 'municipal-accommodation-tax' };
  const vr = validTo('rental-brackets'), vm = validTo('municipal-accommodation-tax');
  if (!vr || !vm) throw new Error('Η κλίμακα ή το τέλος παρεπιδημούντων δεν έχει ημερομηνία λήξης στο μητρώο.');
  const dmy = (iso: string) => iso.split('-').reverse().join('/');
  put(fact('year', year, String(year), 'Η χρονιά της κλίμακας (lib/billing/greekTax.ts: rentalBracketsForYear)', { ...VR, kind: 'date' }));
  put(fact('validRental', vr, dmy(vr), 'lib/legal/validity.ts (rental-brackets.validTo)', { ...VR, kind: 'date' }));
  put(fact('validMun', vm, dmy(vm), 'lib/legal/validity.ts (municipal-accommodation-tax.validTo)', { ...VM, kind: 'date' }));

  put(fact('nightPrice', I.nightlyPrice, eur(I.nightlyPrice), SRC_IN, { kind: 'money' }));
  put(fact('rent', I.monthlyRent, eur(I.monthlyRent), SRC_IN, { kind: 'money' }));
  put(fact('nightFee', nightFee, eur2(nightFee), `${SRC_SVL}: προμήθεια πλατφόρμας / νύχτες`, { kind: 'money' }));
  put(fact('nightClean', nightClean, eur2(nightClean), `${SRC_IN}: καθαριότητα ανά νύχτα`, { kind: 'money' }));
  put(fact('nightFixed', nightFixed, eur2(nightFixed), `${SRC_SVL}: πάγια του χρόνου μοιρασμένα στις γεμάτες νύχτες`, { kind: 'money' }));
  put(fact('nightTax', nightTax, eur2(nightTax), `${SRC_SVL}: φόρος / νύχτες`, { ...VR, kind: 'money' }));
  put(fact('nightNet', nightNet, eur2(nightNet), `${SRC_SVL}: καθαρά / νύχτες (μέσος όρος)`, { ...VR, kind: 'money' }));
  put(fact('tenantPerDay', tenantPerDay, eur2(tenantPerDay), `${SRC_SVL}: καθαρά μακροχρόνιας / ${NIGHTS_PER_YEAR} ημέρες`, { ...VR, kind: 'money' }));
  put(fact('tenantTaxDay', tenantTaxDay, '', `${SRC_SVL}: φόρος μακροχρόνιας ανά ημέρα (μόνο το πλάτος της λωρίδας)`, VR));
  put(fact('tenantGrossDay', tenantGrossDay, '', `${SRC_SVL}: ενοίκιο ανά ημέρα (μόνο το ύψος του κόμβου)`));

  put(fact('margLong', margLong, rate(margLong), `${SRC_TAX}: οριακός του ενοικιαστή`, VR));
  put(fact('margShort', margShort, rate(margShort), `${SRC_TAX}: οριακός στο παράδειγμα`, VR));
  put(fact('effShort', effShort, `${fn(effShort * 100, 1)}%`, `${SRC_TAX}: φόρος / φορολογητέο στο παράδειγμα`, VR));
  put(fact('occ25.nights', occ25, fn(occ25), `${SRC_TAX}: η νύχτα που περνά το RENTAL_TAX_BRACKETS_2026[1].from`, VR));
  put(fact('occ25.pct', occ25 / NIGHTS_PER_YEAR * 100, '', `${SRC_TAX}: θέση του τείχους στον άξονα`, VR));
  put(fact('occ35.nights', occ35, fn(occ35), `${SRC_TAX}: η νύχτα που περνά το RENTAL_TAX_BRACKETS_2026[2].from`, VR));
  put(fact('occ35.pct', occ35 / NIGHTS_PER_YEAR * 100, '', `${SRC_TAX}: θέση του τείχους στον άξονα`, VR));
  put(fact('occ35.marg', B[2].rate, rate(B[2].rate), `${SRC_TAX}: RENTAL_TAX_BRACKETS_2026[2].rate`, VR));
  geo('series.effCurve', effCurve, `${SRC_TAX}: μέσος συντελεστής σε κάθε νύχτα από 1 ως ${NIGHTS_PER_YEAR}`);
  geo('series.margCurve', margCurve, `${SRC_TAX}: οριακός συντελεστής σε κάθε νύχτα`);
  // Οι γραμμές του πλέγματος: οι συντελεστές που φτάνει ο μέσος φόρος μέσα στον χρόνο (το τρίτο κλιμάκιο λέγεται στο τείχος του).
  const gridRates = B.map(b => b.rate).filter(r => r <= Math.max(...effCurve) + 1e-9 || r === margShort);
  geo('series.brackets', gridRates, SRC_TAX);
  geo('series.exNights', nights, `${SRC_SVL}: θέση του παραδείγματος στον άξονα (ποτέ τυπωμένη)`);
  geo('series.yearNights', NIGHTS_PER_YEAR, 'lib/tools/shortVsLong.ts (NIGHTS_PER_YEAR): το πλάτος του άξονα');
  geo('series.highNightsByMonth', summerNights, 'lib/tools/shortVsLong.ts (spreadNights, «κυρίως καλοκαίρι»)');
  geo('series.summer', summer, `${SRC_SVL}: ταμείο ανά μήνα, κυρίως καλοκαίρι`);
  geo('series.even', even, `${SRC_SVL}: ταμείο ανά μήνα, όλο τον χρόνο`);
  geo('series.tenant', tenant, `${SRC_IN}: ενοίκιο ανά μήνα`);
  geo('series.cumSummer', cS, 'αθροιστικό του series.summer');
  geo('series.cumEven', cE, 'αθροιστικό του series.even');
  geo('series.cumTenant', cT, 'αθροιστικό του series.tenant');

  put(fact('summerPeak', peak, eur(peak), `${SRC_SVL}: ένας καλοκαιρινός μήνας (spreadNights «high»)`, { kind: 'money' }));
  // Ο χειμώνας ως σύνολο: ο ένας μήνας μόνος του γράφεται ίδια με το «φεύγουν» του χθεσινού short.
  const winterSum = sum(summer.filter(x => x < 0));
  put(fact('winterSum', winterSum, `${MINUS}${eur(-winterSum)}`, `${SRC_SVL}: οι αρνητικοί μήνες μαζί (μία νύχτα τον μήνα και τα πάγια)`, { kind: 'money' }));
  put(fact('negMonths', negMonths, fn(negMonths), `${SRC_SVL}: μήνες με αρνητικό ταμείο, κυρίως καλοκαίρι`));
  put(fact('cumCross.month', cross, monthNom(cross), 'ο πρώτος μήνας που το αθροιστικό «κυρίως καλοκαίρι» περνά τον ενοικιαστή', { kind: 'text' }));
  put(fact('cumCross.monthAcc', cross, monthAcc(cross), 'ίδιο, σε αιτιατική', { kind: 'text' }));
  put(fact('cumCross.decShort', decShort, eur(decShort), `${SRC_SVL}: τζίρος μείον προμήθεια και λειτουργικά (πριν τον φόρο)`, { kind: 'money' }));
  put(fact('cumCross.decLong', L.gross, '', `${SRC_SVL}: ενοίκια της χρονιάς (πριν τον φόρο)· το είπε το χθεσινό short, μόνο γεωμετρία`, { kind: 'money' }));
  const high = Array.from({ length: 12 }, (_, m) => m).filter(isHighSeasonMonth);
  if (high.length < 2 || high.some((m, i) => i && m !== high[i - 1] + 1)) throw new Error('Η υψηλή περίοδος δεν είναι συνεχόμενοι μήνες.');
  if (summerNights.some((n, m) => (n > summerNights[0] + 1e-9) !== isHighSeasonMonth(m))) throw new Error('Το «κυρίως καλοκαίρι» δεν γεμίζει τους μήνες της υψηλής περιόδου.');
  put(fact('highFrom', high[0], monthShort(high[0]), 'lib/billing/greekTax.ts (isHighSeasonMonth)', { kind: 'text' }));
  put(fact('highTo', high[high.length - 1], monthShort(high[high.length - 1]), 'lib/billing/greekTax.ts (isHighSeasonMonth)', { kind: 'text' }));
  put(fact('highNights', HIGH_SEASON_NIGHTS, fn(HIGH_SEASON_NIGHTS), 'lib/tools/shortVsLong.ts (HIGH_SEASON_NIGHTS)'));
  put(fact('highPct', HIGH_SEASON_NIGHTS / NIGHTS_PER_YEAR * 100, '', 'θέση του τέλους του καλοκαιριού στον δείκτη του χρόνου (ποτέ τυπωμένη)'));
  put(fact('beShareHigh.exact', beShareHigh, '', 'ίδιο με beShareHigh, θέση του δείκτη στον δείκτη του καλοκαιριού'));
  put(fact('beShareHigh', beShareHigh, pctCeil(beShareHigh), `${SRC_SVL}: νύχτες του ορίου / HIGH_SEASON_NIGHTS, προς τα πάνω`, VR));
  put(fact('be.base', cmp.breakEvenPct, '', `${SRC_SVL} (breakEvenPct): μόνο ως αχνή γραμμή, ποτέ τυπωμένο`, VR));

  put(fact('vacancy1', vacancy1, eur(vacancy1), `${SRC_SVL}: καθαρά με δώδεκα ενοίκια μείον καθαρά με έντεκα`, { ...VR, kind: 'money' }));
  put(fact('be11.ceil', Math.ceil(be11), pctCeil(be11), `${SRC_SVL} (breakEvenOccupancy με έντεκα ενοίκια), προς τα πάνω`, VR));
  put(fact('be11.exact', be11, '', 'ίδιο, χωρίς στρογγύλευση (θέση του δείκτη)', VR));
  put(fact('be11.nights', Math.ceil(be11 / 100 * NIGHTS_PER_YEAR), fn(Math.ceil(be11 / 100 * NIGHTS_PER_YEAR)), `${SRC_SVL}: νύχτες του ορίου με έντεκα ενοίκια`, VR));

  put(fact('withEleni.otherGross', otherGross, eur(otherGross), `${SRC_ELENI}: τα άλλα ενοίκια, ως πεδίο του υπολογιστή`, { kind: 'money' }));
  put(fact('withEleni.long', longNetE, eur(longNetE), `${SRC_APO}: ίδιο με τον υπολογιστή /kathari-apodosi`, { ...VR, kind: 'money' }));
  put(fact('withEleni.short', shortNetE, eur(shortNetE), `${SRC_SVL} με ${SRC_APO} (marginalTaxOn)`, { ...VR, kind: 'money' }));
  put(fact('withEleni.diff', diffE, eur(diffE), 'withEleni.short μείον withEleni.long', { ...VR, kind: 'money' }));
  put(fact('withEleni.extra.long', cents(extraLong), eur(cents(extraLong)), `${SRC_APO} (marginalTaxOn): ο φόρος που φέρνει ο ενοικιαστής`, { ...VR, kind: 'money' }));
  put(fact('withEleni.extra.short', cents(extraShort), eur(cents(extraShort)), `${SRC_APO} (marginalTaxOn): ο φόρος που φέρνει το Airbnb`, { ...VR, kind: 'money' }));
  put(fact('withEleni.be', Math.ceil(beE), pctCeil(beE), `${SRC_SVL} με ${SRC_APO}: διχοτόμηση όπως η breakEvenOccupancy, προς τα πάνω`, VR));
  put(fact('withEleni.beExact', beE, '', 'ίδιο, χωρίς στρογγύλευση (θέση του δείκτη)', VR));
  put(fact('withEleni.margLong', margLongE, rate(margLongE), `${SRC_TAX}: οριακός με τα άλλα ενοίκια, ενοικιαστής`, VR));
  put(fact('withEleni.margShort', margShortE, rate(margShortE), `${SRC_TAX}: οριακός με τα άλλα ενοίκια, Airbnb`, VR));
  put(fact('ghost.long', L.net, '', `${SRC_SVL}: η αχνή σειρά του dumbbell (ποτέ τυπωμένη)`, VR));
  put(fact('ghost.short', S.net, '', `${SRC_SVL}: η αχνή σειρά του dumbbell (ποτέ τυπωμένη)`, VR));
  put(fact('calc.months', calcMonths, fn(calcMonths), `${SRC_SVL}: ενοίκια της χρονιάς / μηνιαίο`));
  put(fact('calc.zero', 0, eur(0), 'app/kathari-apodosi/ApodosiCalculator.tsx (SPEC: ΕΝΦΙΑ και δαπάνες στο μηδέν)', { kind: 'money' }));

  put(fact('rentNever', rentNever, eur(rentNever), `${SRC_SVL}: το μικρότερο ενοίκιο χωρίς όριο πληρότητας (διχοτόμηση στο ενοίκιο)`, { ...VR, kind: 'money' }));
  // Ποτέ ως ποσό: το τέλος δεν είναι το κόστος του ορίου (το βαραίνει ο επισκέπτης) και αλλάζει όλο το καθεστώς.
  put(fact('mun3.from', mFrom, `${fn(mFrom)}+`, 'lib/billing/greekTax.ts (isMunicipalTaxExempt): το πλήθος ακινήτων βραχυχρόνιας από το οποίο το φυσικό πρόσωπο χάνει την εξαίρεση και κάνει έναρξη εργασιών· μετρά όλη τη δραστηριότητα, όχι μόνο το νέο ακίνητο', VM));
  put(fact('mun3.rate', MUNICIPAL_ACCOM_TAX_RATE, rate(MUNICIPAL_ACCOM_TAX_RATE), 'lib/billing/greekTax.ts (MUNICIPAL_ACCOM_TAX_RATE)', VM));

  const q1 = [I.nightlyPrice * (1 - I.platformFeePct / 100), I.nightlyPrice * (1 - I.platformFeePct / 100) - clean, nightNet];
  q1.forEach((x, i) => put(fact(`quiz1.${i}`, x, eur2(x), i < 2 ? `${SRC_IN}: τιμή μείον ${i ? 'προμήθεια και καθαριότητα' : 'προμήθεια'}` : 'ίδιο με nightNet', { kind: 'money' })));
  const q3 = [cross - 2, cross - 1, cross, cross + 1];
  if (q3[0] < 0 || q3[3] > 11) throw new Error('Οι επιλογές του κουίζ βγαίνουν έξω από τον χρόνο.');
  q3.forEach((m, i) => put(fact(`quiz3.${i}`, m, monthNom(m), 'μήνες γύρω από το cumCross.month', { kind: 'text' })));

  for (const id of BOOKED) if (out[id]) throw new Error(`Το «${id}» είναι κρατημένο για άλλη ανάρτηση.`);
  return out;
}

// ═══ ΧΩΡΙΣ ΕΠΑΝΑΛΗΨΗ ΤΟΥ ΧΘΕΣΙΝΟΥ ══════════════════════════════════════════
/**
 * Τα κείμενα των γεγονότων των δύο shorts της 07/10/2026. Μόνο οι ΕΙΣΟΔΟΙ του
 * παραδείγματος ξαναφαίνονται: τιμή νύχτας, ενοίκιο, μήνες του υπολογιστή και τα
 * άλλα ενοίκια της Ελένης. Ο συντελεστής του πρώτου κλιμακίου επιτρέπεται μόνο ως
 * ετικέτα άξονα (η βάση από την οποία λυγίζει η καμπύλη), ΟΧΙ ως πρόταση.
 *
 * ΓΙΑΤΙ ΤΑ ΑΛΛΑ ΕΝΟΙΚΙΑ ΕΠΙΤΡΕΠΟΝΤΑΙ (έλεγχος της 08/10/2026). Το 56%, η διαφορά
 * ο φόρος και τα κλιμάκια του «με άλλα ενοίκια» ισχύουν ΜΟΝΟ για αυτό το ποσό· χωρίς
 * αυτό διαβάζονται ως κανόνας για κάθε ιδιοκτήτη. Ένα άλλο ποσό θα ήθελε άλλη πηγή
 * από τον κώδικα (ή ψηφίο γραμμένο με το χέρι). Γράφεται ως είσοδος («με άλλα ενοίκια
 * Χ»), ποτέ με τη χθεσινή γωνία «μένουν Υ από Χ»: τα καθαρά της Ελένης μένουν απαγορευμένα.
 */
const ALLOWED_ALWAYS = ['nightPrice', 'rent', 'margLong', 'calc.months', 'withEleni.otherGross'];
let YESTERDAY: { id: string; text: string }[] | null = null;
function yesterday() {
  if (YESTERDAY) return YESTERDAY;
  const all = [...Object.values(enoikiaFacts('2026-10-07')), ...Object.values(svlFacts())];
  YESTERDAY = all.filter(x => /\d/.test(x.text)).map(x => ({ id: x.id, text: x.text }));
  return YESTERDAY;
}
const tokenRe = (s: string) => new RegExp(`(?<![\\d.,])${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\d]|[.,]\\d)`, 'u');
/** Σταματά αν το κείμενο της επιφάνειας ξαναλέει αριθμό των χθεσινών shorts. */
export function assertNoRepeat(surface: string, text: string, f: Facts, extra: string[] = []) {
  const ok = new Set([...ALLOWED_ALWAYS, ...extra].map(id => { const x = f[id]; if (!x) throw new Error(`Άγνωστο γεγονός «${id}» στη λίστα επιτρεπτών.`); return x.text; }));
  const bad = yesterday().filter(y => !ok.has(y.text) && tokenRe(y.text).test(text));
  if (bad.length) throw new Error(`${surface}: ξαναλέει τα χθεσινά ${bad.map(b => `«${b.text}» (${b.id})`).join(', ')}.`);
}
