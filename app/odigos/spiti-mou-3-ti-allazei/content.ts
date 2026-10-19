// ═══════════════════════════════════════════════════════════════════════════
// «ΣΠΙΤΙ ΜΟΥ ΙΙΙ: ΤΙ ΙΣΧΥΕ ΚΑΙ ΤΙ ΑΛΛΑΖΕΙ» — ΤΟ ΠΕΡΙΕΧΟΜΕΝΟ, ΑΠΟ ΣΤΑΘΕΡΕΣ
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΧΩΡΙΣΤΑ ΑΠΟ ΤΗ ΣΕΛΙΔΑ. Κάθε αριθμός του οδηγού βγαίνει από τις σταθερές
// του lib/loans/recommend.ts (SPITI_MOU_1, SPITI_MOU, SPITI_MOU_FUNDING,
// SPITI_MOU_3, SPITI_MOU_3_REPORTED) και από το DSTI_LIMIT. Μία αλλαγή εκεί
// αλλάζει μαζί τον πίνακα, τις ερωτήσεις και το δομημένο σχήμα. Η δοκιμή
// (content.test.ts) το διαβάζει χωρίς να αποδώσει τη σελίδα.
//
// ΤΡΙΑ ΕΙΔΗ ΚΕΛΙΟΥ ΓΙΑ ΤΟ ΙΙΙ. «official» μόνο από το SPITI_MOU_3· «reported»
// μόνο από το SPITI_MOU_3_REPORTED, που η σελίδα σημαδεύει «όχι ακόμη επίσημο»·
// «none» όταν δεν έχει ειπωθεί τίποτα. Όταν βγει η ΚΥΑ, τα όρια περνούν στο
// SPITI_MOU_3 και τα κελιά γίνονται «official» αλλάζοντας μία γραμμή εδώ.
//
// ΧΩΡΙΣ ΤΙΣ ΛΕΞΕΙΣ ΤΟΥ ΟΦΕΛΟΥΣ. Τα κελιά του κόστους γράφουν «χωρίς τόκο» και
// «μειωμένο επιτόκιο»: περιγράφουν πώς ήταν φτιαγμένο ένα κλειστό πρόγραμμα, δεν
// υπόσχονται τίποτα (scripts/guard-spiti-closed.mjs).
// ═══════════════════════════════════════════════════════════════════════════
import {
  SPITI_MOU, SPITI_MOU_1, SPITI_MOU_3, SPITI_MOU_3_REPORTED, SPITI_MOU_FUNDING, SPITI_MOU_INCOME_BEFORE_2025_11,
  SPITI_MOU_LEGAL, spitiMou3Line, spitiMou3ReportedCaveat, spitiMouClosedSentence,
} from '@/lib/loans/recommend';
import { DSTI_LIMIT } from '@/lib/loans/affordability';
import { programDateLabel } from '@/lib/loans/programStatus';
import { feWhole, fpRate, fn, grDate } from '@/lib/core/format';

/** Το όνομα του δεύτερου προγράμματος, όπως το γράφει η ΚΥΑ. */
export const NAME_2 = 'Σπίτι μου ΙΙ';

/** Οι τρεις στήλες του πίνακα, με τη σειρά τους. */
export const PROGRAM_NAMES = [SPITI_MOU_1.name, NAME_2, SPITI_MOU_3.name] as const;

export type CellKind = 'official' | 'reported' | 'none' | 'notfound';
export type Cell = { text: string; kind: CellKind };
export type CompareRow = { label: string; cells: readonly [Cell, Cell, Cell] };

const off = (text: string): Cell => ({ text, kind: 'official' });
const rep = (text: string): Cell => ({ text, kind: 'reported' });
const NONE: Cell = { text: 'Δεν έχει ανακοινωθεί', kind: 'none' };
const NOT_FOUND: Cell = { text: 'Δεν βρέθηκε σε επίσημη πηγή', kind: 'notfound' };

/** Μερίδιο 0–1 ως ποσοστό του νόμου: 0.75 → «75%». */
const share = (x: number) => fpRate(x * 100);
const date = programDateLabel;

const P1 = SPITI_MOU_1;
const P2 = SPITI_MOU;
const P3 = SPITI_MOU_3;
const R = SPITI_MOU_3_REPORTED;
const F2 = SPITI_MOU_FUNDING;

/** Ο πίνακας σύγκρισης, ένα κριτήριο ανά γραμμή. */
export const COMPARISON: readonly CompareRow[] = [
  { label: 'Φορέας', cells: [
    off(P1.agency),
    off('Ελληνική Αναπτυξιακή Τράπεζα, με πόρους του Ταμείου Ανάκαμψης'),
    off(P3.channel),
  ] },
  { label: 'Ηλικία', cells: [
    off(`${P1.ageMin} έως ${P1.ageMax} ετών`),
    off(`${P2.ageMin} έως ${P2.ageMax} ετών`),
    off(`Έως ${P3.ageMax} ετών· η κατώτατη δεν έχει ανακοινωθεί`),
  ] },
  { label: 'Εισόδημα, άγαμος', cells: [
    off(`${feWhole(P1.incomeMin)} έως ${feWhole(P1.incomeSingle)}`),
    off(`${feWhole(P2.incomeMin)} έως ${feWhole(P2.incomeSingle)}`),
    rep(`Έως ${feWhole(R.incomeSingle)}`),
  ] },
  { label: 'Εισόδημα, ζευγάρι', cells: [
    off(`Έως ${feWhole(P1.incomeMarriedBase)}, συν ${feWhole(P1.incomePerChild)} ανά παιδί`),
    off(`Έως ${feWhole(P2.incomeMarriedBase)}, συν ${feWhole(P2.incomePerChild)} ανά παιδί`),
    rep(`Έως ${feWhole(R.incomeMarriedBase)}, συν ${feWhole(R.incomePerChild)} ανά παιδί`),
  ] },
  { label: 'Εισόδημα, μονογονεϊκή οικογένεια', cells: [
    NOT_FOUND,
    off(`Έως ${feWhole(P2.incomeSingleParentBase)}, συν ${feWhole(P2.incomePerChild)} ανά παιδί πέρα από το πρώτο`),
    rep(`Έως ${feWhole(R.incomeSingleParentBase)}`),
  ] },
  { label: 'Αξία ακινήτου', cells: [
    off(`Έως ${feWhole(P1.maxPropertyValue)}`),
    off(`Έως ${feWhole(P2.maxPropertyValue)}`),
    rep(`Έως ${feWhole(R.maxPropertyValue)}`),
  ] },
  { label: 'Εμβαδόν', cells: [
    off(`Έως ${P1.maxSqm} τ.μ.`),
    off(`Έως ${P2.maxSqm} τ.μ.`),
    rep(`${fn(R.sqmPerChildAboveFour)} τ.μ. επιπλέον για κάθε παιδί πέρα από το τέταρτο`),
  ] },
  { label: 'Παλαιότητα κτιρίου', cells: [
    off(`Τουλάχιστον ${P1.minBuildingAgeYears} ετών`),
    off(`Κατασκευή έως ${P2.maxYearBuilt}`),
    NONE,
  ] },
  { label: 'Ποσό δανείου', cells: [
    off(`Έως ${feWhole(P1.maxAmount)}`),
    off(`Έως ${feWhole(P2.maxAmount)}`),
    rep(`Έως ${feWhole(R.maxAmount)}`),
  ] },
  { label: 'Δάνειο προς αξία', cells: [
    off(`Έως ${fpRate(P1.maxLtv)}`),
    off(`Έως ${fpRate(P2.maxLtv)}`),
    rep(`Έως ${fpRate(R.maxLtvPct)}`),
  ] },
  { label: 'Διάρκεια', cells: [
    off(`Έως ${P1.maxYears} έτη`),
    off(`${P2.minYears} έως ${P2.maxYears} έτη`),
    NONE,
  ] },
  { label: 'Χρηματοδότηση', cells: [
    off(`${share(P1.interestFreeShare)} από τη ΔΥΠΑ χωρίς τόκο, ${share(1 - P1.interestFreeShare)} από την τράπεζα με το επιτόκιό της. Για τρίτεκνους και πολύτεκνους όλο χωρίς τόκο`),
    off(`${share(F2.interestFreeShare)} χωρίς τόκο, ${share(1 - F2.interestFreeShare)} από την τράπεζα με το επιτόκιό της. Με ${F2.largeFamilyChildren} παιδιά και πάνω το επιτόκιο της τράπεζας μειωμένο κατά ${share(F2.largeFamilyRateCut)}`),
    NONE,
  ] },
  { label: 'Αιτήσεις', cells: [
    off(`${date(P1.applicationsFrom)} έως ${date(P1.applicationsTo)}`),
    off(`Έως ${date(P2.applicationDeadline)}· υπογραφές έως ${date(P2.contractDeadline)}`),
    off(`Από ${P3.startLabel}, κατά την ΕΑΤ`),
  ] },
];

/** Τα όρια εισοδήματος του ΙΙ πριν και μετά την τροποποίηση του Νοεμβρίου 2025. */
export function incomeChangeLine(): string {
  const b = SPITI_MOU_INCOME_BEFORE_2025_11;
  return `Με την ${SPITI_MOU_LEGAL.incomeAmendment} τα ανώτατα όρια ανέβηκαν: `
    + `άγαμοι από ${feWhole(b.incomeSingle)} σε ${feWhole(P2.incomeSingle)}, `
    + `ζευγάρια από ${feWhole(b.incomeMarriedBase)} σε ${feWhole(P2.incomeMarriedBase)} `
    + `(ανά παιδί από ${feWhole(b.incomePerChild)} σε ${feWhole(P2.incomePerChild)}), `
    + `μονογονεϊκές από ${feWhole(b.incomeSingleParentBase)} σε ${feWhole(P2.incomeSingleParentBase)}. `
    + `Το κατώτατο έμεινε ${feWhole(P2.incomeMin)}.`;
}

/** Το όριο δόσης της Τράπεζας της Ελλάδος, που ισχύει με ή χωρίς πρόγραμμα. */
export function dstiLine(): string {
  return `Όλες οι δόσεις μαζί έως ${share(DSTI_LIMIT.firstTimeBuyer)} του καθαρού εισοδήματος αν `
    + `δανείζεσαι πρώτη φορά, ${share(DSTI_LIMIT.other)} αν έχεις ξαναπάρει στεγαστικό ή έχεις ήδη ακίνητο `
    + '(ΠΕΕ 227/1/08.03.2024 της Τράπεζας της Ελλάδος, από 01/01/2025). Το όριο ισχύει με ή χωρίς πρόγραμμα.';
}

/** Πότε ελέγχθηκαν τα επίσημα στοιχεία, για τη γραμμή κάτω από τον τίτλο. */
export function checkedLine(): string {
  return `Τα επίσημα στοιχεία για το ${P3.name} ελέγχθηκαν στις ${grDate(P3.checkedAt)}, `
    + `για το ${P1.name} και το ${NAME_2} στις ${grDate(SPITI_MOU_LEGAL.checkedAt)}. `
    + 'Ο οδηγός θα ενημερωθεί όταν δημοσιευτεί η ΚΥΑ του νέου προγράμματος.';
}

export type FaqItem = { q: string; a: string; link?: { href: string; label: string } };

/** Οι συχνές ερωτήσεις, ίδιες στη σελίδα και στο FAQPage. */
export function faq(today: string): FaqItem[] {
  const closed = spitiMouClosedSentence(today);
  return [
    {
      q: `Πότε ανοίγει το «${P3.name}»;`,
      a: `${spitiMou3Line()} Μέχρι τότε δεν υπάρχει τρόπος να ελέγξει κανείς αν είσαι επιλέξιμος.`,
    },
    {
      q: `Ισχύει ακόμη το «${NAME_2}»;`,
      a: closed
        ? `${closed} Ο νέος κύκλος είναι το «${P3.name}».`
        : `Δέχεται αιτήσεις έως ${date(P2.applicationDeadline)}, με τους όρους του φορέα του.`,
    },
    {
      q: `Είναι επίσημα τα ${feWhole(R.maxAmount)} δανείου και τα ${feWhole(R.maxPropertyValue)} αξίας;`,
      a: `Όχι ακόμη. ${spitiMou3ReportedCaveat()}`,
    },
    {
      q: 'Ποιο ήταν το όριο ηλικίας στα προηγούμενα προγράμματα;',
      a: `Στο «${P1.name}» ${P1.ageMin} έως ${P1.ageMax} ετών, στο «${NAME_2}» ${P2.ageMin} έως ${P2.ageMax}. `
        + `Για το «${P3.name}» η κυβερνητική εξειδίκευση των μέτρων της ΔΕΘ γράφει ανώτατη ηλικία ${P3.ageMax} ετών.`,
    },
    {
      q: `Τι άλλαξε στο εισόδημα του «${NAME_2}» τον Νοέμβριο 2025;`,
      a: incomeChangeLine(),
    },
    {
      q: 'Πόση δόση μπορώ να σηκώσω;',
      a: `${dstiLine()} Ο υπολογιστής δείχνει πόσο δάνειο αντιστοιχεί στο εισόδημά σου.`,
      link: { href: '/ypologismos-stegastikou-daneiou', label: 'Υπολογισμός δόσης στεγαστικού' },
    },
  ];
}
