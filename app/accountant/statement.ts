// ═══════════════════════════════════════════════════════════════════════════
// Η ΚΑΤΑΣΤΑΣΗ ΤΗΣ ΧΡΗΣΗΣ: ΕΝΑΣ ΥΠΟΛΟΓΙΣΜΟΣ, ΔΥΟ ΕΞΟΔΟΙ
// ─────────────────────────────────────────────────────────────────────────
// Η ΠΥΛΗ ΕΔΕΙΧΝΕ ΝΟΥΜΕΡΑ ΚΑΙ ΔΕΝ ΚΑΤΕΒΑΖΕ ΤΙΠΟΤΑ. Ο λογιστής διάβαζε την οθόνη
// και ξαναπληκτρολογούσε — σε επάγγελμα που δουλεύει με αρχεία. Το προϊόν είχε
// ήδη μηχανή εξαγωγής, αλλά μόνο στον πίνακα του ιδιοκτήτη· δηλαδή στα χέρια
// του ανθρώπου που ΔΕΝ συμπληρώνει το έντυπο.
//
// ΓΙΑΤΙ Ο ΥΠΟΛΟΓΙΣΜΟΣ ΕΦΥΓΕ ΑΠΟ ΤΗ ΣΕΛΙΔΑ. Αν το αρχείο υπολόγιζε μόνο του,
// θα υπήρχαν δύο αλήθειες για το ίδιο ποσό: μία στην οθόνη και μία στο .xlsx
// που κατεβαίνει από αυτήν. Θα απέκλιναν στην πρώτη αλλαγή και ο λογιστής θα
// έβλεπε το ένα και θα υπέβαλλε το άλλο — το ίδιο ακριβώς σφάλμα που είχε ήδη
// διορθωθεί όταν η πύλη έπαψε να αθροίζει το ωμό `total` των διαμονών.
//
// ΕΔΩ ΔΕΝ ΥΠΑΡΧΕΙ REACT. Είναι αριθμητική, άρα δοκιμάζεται χωρίς οθόνη.
// ═══════════════════════════════════════════════════════════════════════════
import { declarableGrossOrTotal, needsAmountReview, amountBasis, AMOUNT_BASIS_LABELS, collectedLevy, platformFee } from '@/lib/clients/stayAmounts';
import { yearShare, nightsSplit } from '@/lib/tax/shortTermTax';
import { collectionModeFromCounts, type RentCollectionMode } from '@/lib/tax/rentCollectionMode';
import { bankReceiptMatters, presumptiveDeductionRateForYear } from '@/lib/billing/consolidate';
import { rentalIncomeTax, rentalBracketsForYear } from '@/lib/billing/greekTax';
import { fpRate } from '@/lib/core/format';
import type { XlsxSheet } from '@/app/dashboard/components/exportXlsx';

export interface PortalExpense { category: string; amount: number; date: string }

export interface PortalStay {
  check_in: string | null; check_out: string | null; nights: number | null; total: number | null;
  gross_guest_paid?: number | null; climate_levy?: number | null;
  platform_fee?: number | null; amount_basis?: string | null;
}

export interface PortalProperty {
  name: string; atak: string | null; address: string | null; prop_type: string | null;
  /** Εμβαδόν και ποσοστό συνιδιοκτησίας: τα ζητά η γραμμή του Ε2. */
  sqm?: number | null; ownership?: number | null;
  /**
   * Ενοίκιο ΤΗΣ ΧΡΗΣΗΣ, όλες οι περίοδοι ανεξάρτητα από την είσπραξη: η βάση
   * του Ε2. Λείπει όταν απαντά βάση πριν το 20261001100000· τότε το
   * `rent_collected` είχε ακριβώς αυτή τη σημασία.
   */
  rent_due?: number | null;
  /** Οσα ΕΙΣΠΡΑΧΘΗΚΑΝ από τις περιόδους της χρήσης (`paid = true`). */
  rent_collected: number | null;
  /** Πόσους μήνες της χρήσης καλύπτουν οι περίοδοι. 0 = δεν καταχωρήθηκε τίποτα. */
  rent_months: number | null;
  /** Πληρωμένες περίοδοι της χρήσης με καταγεγραμμένο τρόπο είσπραξης. */
  rent_paid_with_method?: number | null;
  /** Από αυτές, πόσες σε μετρητά. */
  rent_paid_cash?: number | null;
  /** Η πρόθεση της τρέχουσας μίσθωσης (`e_payment`). Κενό χωρίς μισθωτή. */
  lease_via_bank?: boolean | null;
  /** Τι νοικιάζεται ΣΗΜΕΡΑ. Συμφραζόμενο, όχι έσοδο του έτους. */
  rent_monthly: number | null;
  expenses: PortalExpense[]; stays: PortalStay[];
}

export interface PortalData { owner: string | null; year: number; properties: PortalProperty[] }

/** Η γραμμή ενός ακινήτου για τη χρήση, όπως τη διαβάζει ΚΑΙ η οθόνη ΚΑΙ το αρχείο. */
export interface PropertyLine {
  p: PortalProperty;
  /** Ενοίκιο της χρήσης όπως στο Ε2 (δεδουλευμένο). Αυτό μπαίνει στα έσοδα. */
  rentAnnual: number;
  /** Από αυτό, πόσο εισπράχθηκε. `null` όταν η βάση δεν το ξεχωρίζει ακόμη. */
  rentCollected: number | null;
  rentMonths: number;
  /** Δηλωτέο ακαθάριστο βραχυχρόνιας, με το μερίδιο νυχτών της χρήσης. */
  shortGross: number;
  /** Πόσες διαμονές μπήκαν με το ωμό ποσό τους, επειδή δεν δηλώνουν βάση. */
  staysUnresolved: number;
  income: number;
  expenses: number;
}

const sum = (a: number[]) => a.reduce((s, v) => s + (v || 0), 0);

const cents = (n: number) => Math.round(n * 100) / 100;

// ══ Η ΠΥΛΗ ΕΛΕΓΕ «ΕΙΣΠΡΑΞΕΙΣ» ΓΙΑ ΤΟ ΔΕΔΟΥΛΕΥΜΕΝΟ ═══════════════════════════
// ΤΟ ΣΦΑΛΜΑ. Το `rent_collected` της βάσης άθροιζε ΟΛΕΣ τις περιόδους της
// χρήσης, πληρωμένες ή όχι κι η οθόνη το τύπωνε ως «Εισπράξεις». Το ποσό ήταν
// σωστό για το Ε2 (δεδουλευμένα) αλλά λάθος για ό,τι έλεγε ότι είναι.
//
// Πλέον τα δύο έρχονται χωριστά: `rent_due` για το έντυπο και τα έσοδα,
// `rent_collected` για την είσπραξη. Βάση που δεν έχει ακόμη το `rent_due`
// στέλνει στο `rent_collected` το δεδουλευμένο, οπότε αυτό κρατιέται ως έχει
// και η είσπραξη μένει άγνωστη αντί να μαντευτεί.
//
// ══ Η ΔΙΑΜΟΝΗ ΠΟΥ ΠΕΡΝΑ ΤΗΝ ΠΡΩΤΟΧΡΟΝΙΑ ΜΟΙΡΑΖΕΤΑΙ ΜΕ ΤΙΣ ΝΥΧΤΕΣ ═════════════
// Ηταν κατά έτος άφιξης κι ολόκληρη. Το Ε2 τη μοιράζει με τις νύχτες
// (`yearShare`, lib/tax/shortTermTax.ts): η πύλη έδινε στον λογιστή άλλο ποσό
// από το έντυπο που θα υπέβαλλε. Ο κανόνας είναι πλέον ο ίδιος, από το ίδιο αρχείο.

/** Το μοναδικό σημείο όπου το ακίνητο γίνεται γραμμή χρήσης. */
export function propertyLines(props: readonly PortalProperty[], year: number): PropertyLine[] {
  return props.map(p => {
    const stays = (p.stays || []).filter(s => yearShare(s, year) > 0);
    // ΤΟ ΩΜΟ `total` ΔΕΝ ΑΘΡΟΙΖΕΤΑΙ. Είναι ακαθάριστο Η payout, ανάλογα με το
    // `amount_basis`· το Ε2 περνά από το δηλωτέο ακαθάριστο, δηλαδή τι πλήρωσε
    // ο επισκέπτης μείον το τέλος ανθεκτικότητας, που δεν είναι έσοδο.
    const shortGross = cents(sum(stays.map(s => declarableGrossOrTotal(s) * yearShare(s, year))));
    const hasDue = p.rent_due != null;
    const rentAnnual = Number(hasDue ? p.rent_due : p.rent_collected) || 0;
    return {
      p,
      rentAnnual,
      rentCollected: hasDue ? (Number(p.rent_collected) || 0) : null,
      rentMonths: p.rent_months || 0,
      shortGross,
      staysUnresolved: stays.filter(needsAmountReview).length,
      income: rentAnnual + shortGross,
      expenses: sum((p.expenses || []).map(e => e.amount || 0)),
    };
  });
}

/** Οι διαμονές της γραμμής που μετρούν στη χρήση, με το μερίδιό τους. */
export function staysOfYear(l: PropertyLine, year: number) {
  return (l.p.stays || [])
    .map(s => ({ s, share: yearShare(s, year), nights: nightsSplit(s, year).inYear }))
    .filter(x => x.share > 0);
}

/** Πόσα δηλώνονται από αυτή τη γραμμή, με το ποσοστό συνιδιοκτησίας. */
export const shareOf = (amount: number, ownership: number | null | undefined) => {
  const pct = Number(ownership);
  return Number.isFinite(pct) && pct > 0 && pct < 100 ? amount * (pct / 100) : amount;
};

/** Εχει έστω ένα ακίνητο ποσοστό μικρότερο του 100; */
export const hasCoOwnership = (lines: readonly PropertyLine[]): boolean =>
  lines.some(l => Number(l.p.ownership) > 0 && Number(l.p.ownership) < 100);

/** Τα σύνολα της χρήσης. */
export interface StatementTotals {
  income: number; expenses: number;
  // ══ ΤΟ ΜΕΡΙΔΙΟ ΥΠΟΛΟΓΙΖΕΤΑΙ ΕΔΩ, ΓΙΑΤΙ ΕΔΩ ΤΟ ΔΙΑΒΑΖΟΥΝ ΚΑΙ ΟΙ ΔΥΟ ═══════
  // ΤΟ ΣΦΑΛΜΑ. Η οθόνη του λογιστή έδειχνε τα σύνολα στο 100% κι υπολόγιζε τον
  // ενδεικτικό φόρο πάνω τους. Το αρχείο .xlsx που κατεβαίνει από ΤΗΝ ΙΔΙΑ
  // σελίδα είχε δικές του στήλες «Αναλογία», κομμένες στο ποσοστό, με σημείωση
  // που το εξηγεί. Ο συνιδιοκτήτης στο 50% διάβαζε 12.000€ στην οθόνη κι
  // 6.000€ στο αρχείο — κι ο φόρος της οθόνης ήταν υπολογισμένος στα 12.000.
  //
  // Η οθόνη μάλιστα ΤΥΠΩΝΕ «συνιδιοκτησία 50%» δίπλα στο νούμερο του 100%.
  //
  // Τα δύο μεγέθη μπαίνουν πλέον στα ίδια σύνολα, από την ΙΔΙΑ `shareOf`: δεν
  // υπάρχει τρόπος να αποκλίνουν, γιατί δεν υπάρχουν δύο υπολογισμοί.
  /** Το μερίδιο του ιδιοκτήτη. Ισο με το ολικό όταν δεν υπάρχει συνιδιοκτησία. */
  incomeShare: number; expensesShare: number;
  /** Υπάρχει έστω ένα ακίνητο με ποσοστό κάτω του 100; Τότε τα δύο διαφέρουν. */
  hasShare: boolean;
  /** Καμία καταχώρηση εσόδου ή δαπάνης: δεν υπολογίζεται τίποτα πάνω σε αυτό. */
  hasEntries: boolean;
  staysUnresolved: number;
}

export function statementTotals(lines: readonly PropertyLine[]): StatementTotals {
  const income = sum(lines.map(l => l.income));
  const expenses = sum(lines.map(l => l.expenses));
  return {
    income, expenses,
    incomeShare: sum(lines.map(l => shareOf(l.income, l.p.ownership))),
    expensesShare: sum(lines.map(l => shareOf(l.expenses, l.p.ownership))),
    hasShare: hasCoOwnership(lines),
    hasEntries: income > 0 || expenses > 0,
    staysUnresolved: sum(lines.map(l => l.staysUnresolved)),
  };
}

// ── Ο ΕΝΔΕΙΚΤΙΚΟΣ ΦΟΡΟΣ ΚΑΙ Η ΤΕΚΜΑΡΤΗ ΕΚΠΤΩΣΗ ────────────────────────────
// ΤΟ ΣΦΑΛΜΑ. Η οθόνη εφάρμοζε ΠΑΝΤΑ την έκπτωση 5% (`presumptiveDeductionRate(true)`).
// Από τη χρήση 2027 η έκπτωση θέλει είσπραξη μέσω τραπέζης (ν.5222/2025) και η
// Λογιστική το κρίνει ανά ακίνητο από τις ίδιες τις εισπράξεις. Η πύλη έδινε
// στον λογιστή μικρότερο φόρο από τη Λογιστική του ίδιου πελάτη.
//
// Ο ΚΑΝΟΝΑΣ ΕΙΝΑΙ Ο ΙΔΙΟΣ. Η βάση στέλνει πλήθη (πόσες εισπράξεις έχουν τρόπο,
// πόσες σε μετρητά) και την πρόθεση της μίσθωσης· η κρίση γίνεται από την
// `collectionModeFromCounts`, δίπλα στη `rentCollectionMode` της Λογιστικής.
// Οπου η βάση δεν τα στέλνει, η έκπτωση δεν εφαρμόζεται και το λέμε.

/** Ο τρόπος είσπραξης ενός ακινήτου, ή `null` όταν η βάση δεν τον στέλνει. */
export function lineCollectionMode(p: PortalProperty): RentCollectionMode | null {
  if (p.rent_paid_with_method == null) return null;
  return collectionModeFromCounts(Number(p.rent_paid_with_method) || 0, Number(p.rent_paid_cash) || 0, p.lease_via_bank ?? null);
}

export interface IndicativeTax {
  tax: number;
  taxable: number;
  /** Μετρά ο τρόπος είσπραξης σε αυτή τη χρήση; (από το 2027) */
  bankMatters: boolean;
  /** Ακίνητα με έσοδο που ΔΕΝ παίρνουν την έκπτωση, με τον λόγο. */
  withoutDeduction: { name: string; why: string }[];
}

const NOT_VISIBLE = 'ο τρόπος είσπραξης δεν φαίνεται από αυτόν τον σύνδεσμο';

const modeWhy = (m: RentCollectionMode | null): string => {
  if (!m || m.basis === 'unknown') return NOT_VISIBLE;
  if (m.basis === 'payments') return `${m.cash} από ${m.withMethod} εισπράξεις σε μετρητά`;
  return 'η μίσθωση δεν δηλώνει είσπραξη μέσω τραπέζης';
};

/** Ο ενδεικτικός φόρος της χρήσης, στο μερίδιο του ιδιοκτήτη. */
export function indicativeTax(lines: readonly PropertyLine[], year: number): IndicativeTax {
  const bankMatters = bankReceiptMatters(year);
  const withoutDeduction: IndicativeTax['withoutDeduction'] = [];
  let taxable = 0;
  for (const l of lines) {
    const share = shareOf(l.income, l.p.ownership);
    if (!(share > 0)) continue;
    let viaBank = true;
    if (bankMatters) {
      const m = lineCollectionMode(l.p);
      viaBank = !!m && m.basis !== 'unknown' && m.viaBank;
      if (!viaBank) withoutDeduction.push({ name: l.p.name, why: modeWhy(m) });
    }
    taxable += share * (1 - presumptiveDeductionRateForYear(year, viaBank));
  }
  return { tax: rentalIncomeTax(taxable, rentalBracketsForYear(year)), taxable, bankMatters, withoutDeduction };
}

/** Η φράση για την έκπτωση κάτω από τον φόρο. Μία, δοκιμασμένη. */
export function deductionNote(t: IndicativeTax, year: number): string {
  const pct = fpRate(presumptiveDeductionRateForYear(year, true) * 100);
  if (!t.bankMatters) return `Με τεκμαρτή έκπτωση ${pct}.`;
  if (!t.withoutDeduction.length) return `Με τεκμαρτή έκπτωση ${pct}: οι εισπράξεις της χρήσης έγιναν μέσω τραπέζης.`;
  return `Τεκμαρτή έκπτωση ${pct} μόνο όπου η είσπραξη έγινε μέσω τραπέζης. Χωρίς έκπτωση: `
    + t.withoutDeduction.map(w => `${w.name} (${w.why})`).join(', ') + '.';
}

// ── ΤΙ ΛΕΙΠΕΙ ──────────────────────────────────────────────────────────────
// ΗΤΑΝ ΓΡΑΜΜΕΝΟ ΩΣ ΠΡΟΤΑΣΗ ΠΟΥ ΕΛΕΓΕ ΤΟ ΑΝΤΙΘΕΤΟ ΑΠΟ ΟΣΑ ΕΝΝΟΟΥΣΕ:
// «Κανένα ακίνητο χωρίς καταχωρημένη είσπραξη: Διαμέρισμα Παγκράτι, Στούντιο
// Κουκάκι». Διαβάζεται «κανένα δεν είναι χωρίς», δηλαδή «όλα εντάξει» — και
// από κάτω ακολουθεί η λίστα αυτών που ΔΕΝ είναι εντάξει. Σε επαγγελματία που
// υπογράφει δήλωση, μια πρόταση που μπορεί να διαβαστεί ανάποδα δεν είναι
// θέμα ύφους. Οι προτάσεις παράγονται πλέον εδώ, μία φορά και δοκιμάζονται.
export interface Gap { key: string; text: string; blocking: boolean }

const listOf = (names: readonly string[]) => names.join(', ');

export function statementGaps(lines: readonly PropertyLine[]): Gap[] {
  const total = lines.length;
  if (total === 0) return [];
  const silent = lines.filter(l => l.income === 0).map(l => l.p.name);
  const noExpenses = lines.filter(l => l.expenses === 0).map(l => l.p.name);
  const noAtak = lines.filter(l => !l.p.atak).map(l => l.p.name);
  // ΤΟ «ΔΕΝ ΤΟ ΣΤΕΛΝΕΙ Η ΒΑΣΗ» ΔΕΝ ΕΙΝΑΙ «ΔΕΝ ΤΟ ΕΧΕΙ Ο ΙΔΙΟΚΤΗΤΗΣ».
  // Το εμβαδόν μπήκε στη `get_accountant_data` με τη μετανάστευση 20260818110000.
  // Οσο εκείνη δεν έχει τρέξει, το πεδίο λείπει από ΟΛΑ τα ακίνητα — και μια
  // οθόνη που γράφει τότε «Χωρίς εμβαδόν: όλα» κατηγορεί τον ιδιοκτήτη για κάτι
  // που έχει καταχωρήσει. Απουσία πεδίου: σιωπή. Πεδίο με μηδέν: εκκρεμότητα.
  const noSqm = lines.filter(l => l.p.sqm !== undefined && !(Number(l.p.sqm) > 0)).map(l => l.p.name);
  const out: Gap[] = [];
  if (silent.length) out.push({
    key: 'income', blocking: true,
    text: silent.length === total
      ? `Κανένα ακίνητο δεν έχει καταχωρημένη είσπραξη: ${listOf(silent)}`
      : `${silent.length} από ${total} ακίνητα χωρίς καταχωρημένη είσπραξη: ${listOf(silent)}`,
  });
  if (noExpenses.length) out.push({
    key: 'expenses', blocking: false,
    text: noExpenses.length === total
      ? `Καμία δαπάνη σε κανένα ακίνητο: ${listOf(noExpenses)}`
      : `Καμία δαπάνη σε: ${listOf(noExpenses)}`,
  });
  if (noAtak.length) out.push({ key: 'atak', blocking: true, text: `Χωρίς ΑΤΑΚ: ${listOf(noAtak)}` });
  if (noSqm.length) out.push({ key: 'sqm', blocking: true, text: `Χωρίς εμβαδόν: ${listOf(noSqm)}` });
  return out;
}

// ── ΤΟ ΑΡΧΕΙΟ ──────────────────────────────────────────────────────────────
// Τέσσερα φύλλα, με τη σειρά που τα ανοίγει ο λογιστής: πρώτα η γραμμή ανά
// ακίνητο (εκεί πάει το Ε2), μετά οι δαπάνες, μετά οι διαμονές, τελευταίο τι
// λείπει. Ο,τι λείπει ταξιδεύει ΜΕΣΑ στο αρχείο: ένα .xlsx που κυκλοφορεί με
// email χωρίς τις επιφυλάξεις του είναι αριθμοί χωρίς συμφραζόμενα.

/** Κενό κελί, όχι παύλα: η παύλα σε στήλη τιμών διαβάζεται ως τιμή. */
const BLANK = '';

export interface StatementFileInput {
  owner: string;
  year: number;
  /** Ημερομηνία έκδοσης σε ISO, δίνεται απ' έξω ώστε η συνάρτηση να μένει καθαρή. */
  issued: string;
  lines: readonly PropertyLine[];
}

export function statementSheets(inp: StatementFileInput): XlsxSheet[] {
  const { owner, year, issued, lines } = inp;
  const subtitle = `${owner} · χρήση 01/01/${year} έως 31/12/${year} · έκδοση ${issued}`;
  const totals = statementTotals(lines);
  const gaps = statementGaps(lines);

  // ΟΙ ΕΠΙΦΥΛΑΞΕΙΣ ΤΑΞΙΔΕΥΟΥΝ ΜΕ ΤΟΥΣ ΑΡΙΘΜΟΥΣ, ΣΕ ΚΑΘΕ ΦΥΛΛΟ ΠΟΥ ΤΙΣ ΑΦΟΡΑ.
  const notes: string[] = [
    'Ποσά όπως τα καταχώρησε ο ιδιοκτήτης. Καμία ταυτότητα μισθωτή, επισκέπτη ή προμηθευτή: ο σύνδεσμος δεν τις μεταφέρει.',
    'Για τη γραμμή του Ε2 λείπει το ΑΦΜ του μισθωτή, που το έχει ο ιδιοκτήτης.',
    'Τα ενοίκια χρήσης είναι δεδουλευμένα, όπως στο Ε2: όλες οι περίοδοι της χρήσης ανεξάρτητα από την είσπραξη. Η διπλανή στήλη δείχνει πόσα από αυτά εισπράχθηκαν.',
  ];
  // ΟΤΑΝ ΥΠΑΡΧΕΙ ΣΥΝΙΔΙΟΚΤΗΣΙΑ, ΛΕΓΕΤΑΙ. Δύο στήλες με το ίδιο ακίνητο και
  // διαφορετικό ποσό είναι ερώτηση, όχι πληροφορία, αν δεν εξηγηθεί.
  if (hasCoOwnership(lines)) {
    notes.push('Οι στήλες «Αναλογία» δείχνουν το μερίδιο του ιδιοκτήτη, στα έσοδα ΚΑΙ στις δαπάνες, με το ποσοστό συνιδιοκτησίας του ακινήτου. Δαπάνη δηλωμένη ρητά ως μοιρασμένη ή πληρωμένη από τρίτον δεν ξεχωρίζει σε αυτό το φύλλο.');
  }
  if (totals.staysUnresolved > 0) {
    notes.push(totals.staysUnresolved === 1
      ? 'Μία διαμονή δεν δηλώνει αν το ποσό της είναι ακαθάριστο ή καθαρή είσπραξη· μπήκε όπως καταχωρήθηκε.'
      : `${totals.staysUnresolved} διαμονές δεν δηλώνουν αν το ποσό τους είναι ακαθάριστο ή καθαρή είσπραξη· μπήκαν όπως καταχωρήθηκαν.`);
  }

  const perProperty: XlsxSheet = {
    name: 'Ανά ακίνητο',
    title: `Κατάσταση χρήσης ${year}`,
    subtitle,
    columns: [
      { header: 'Ακίνητο', kind: 'text' },
      { header: 'ΑΤΑΚ', kind: 'text' },
      { header: 'Διεύθυνση', kind: 'text' },
      { header: 'Είδος', kind: 'text' },
      { header: 'Εμβαδόν (τ.μ.)', kind: 'num' },
      { header: 'Ποσοστό', kind: 'pct' },
      { header: 'Ενοίκια χρήσης (δεδουλευμένα)', kind: 'eur' },
      { header: 'Από αυτά εισπράχθηκαν', kind: 'eur' },
      { header: 'Μήνες μίσθωσης', kind: 'int' },
      { header: 'Βραχυχρόνια, δηλωτέο ακαθάριστο', kind: 'eur' },
      { header: 'Σύνολο εσόδων', kind: 'eur' },
      { header: 'Αναλογία εσόδων ιδιοκτήτη', kind: 'eur' },
      { header: 'Δαπάνες χρήσης', kind: 'eur' },
      // ══════════════════════════════════════════════════════════════════════
      // ΤΟ ΠΟΣΟΣΤΟ ΙΣΧΥΕΙ ΚΑΙ ΣΤΙΣ ΔΥΟ ΠΛΕΥΡΕΣ, ΑΛΛΙΩΣ ΔΕΝ ΙΣΧΥΕΙ ΠΟΥΘΕΝΑ.
      //
      // Η στήλη των εσόδων περνούσε από το ποσοστό συνιδιοκτησίας· η στήλη των
      // δαπανών όχι. Δίπλα δίπλα, ο λογιστής διάβαζε έσοδα στο 33,33% και
      // δαπάνες στο 100% για το ίδιο ακίνητο, χωρίς τίποτα να το λέει. Σε
      // ακίνητο τριών αδελφών με 6.000€ έσοδα και 2.400€ δαπάνες, η γραμμή
      // έδειχνε 2.000€ έναντι 2.400€: ζημιά που δεν υπάρχει.
      { header: 'Αναλογία δαπανών ιδιοκτήτη', kind: 'eur' },
    ],
    rows: lines.map(l => [
      l.p.name,
      l.p.atak || BLANK,
      l.p.address || BLANK,
      l.p.prop_type || BLANK,
      Number(l.p.sqm) > 0 ? Number(l.p.sqm) : null,
      Number(l.p.ownership) > 0 ? Number(l.p.ownership) : null,
      l.rentAnnual,
      l.rentCollected,
      l.rentMonths,
      l.shortGross,
      l.income,
      shareOf(l.income, l.p.ownership),
      l.expenses,
      shareOf(l.expenses, l.p.ownership),
    ]),
    totalCols: [6, 7, 9, 10, 11, 12, 13],
    notes,
  };

  const expenseRows = lines.flatMap(l =>
    (l.p.expenses || []).map(e => [l.p.name, e.date ? new Date(e.date) : null, e.category || 'Χωρίς κατηγορία', e.amount || 0]));
  const expenses: XlsxSheet = {
    name: 'Δαπάνες',
    title: `Δαπάνες χρήσης ${year}`,
    subtitle,
    columns: [
      { header: 'Ακίνητο', kind: 'text' },
      { header: 'Ημερομηνία', kind: 'date' },
      { header: 'Κατηγορία', kind: 'text' },
      { header: 'Ποσό', kind: 'eur' },
    ],
    rows: expenseRows,
    totalCols: [3],
    notes: ['Χωρίς ΑΦΜ προμηθευτή και χωρίς παραστατικό: τα κρατά ο ιδιοκτήτης στον φάκελό του.'],
  };

  // ΜΕ ΤΟ ΜΕΡΙΔΙΟ ΤΗΣ ΧΡΗΣΗΣ, ΟΠΩΣ ΣΤΟ Ε2. Η διαμονή που περνά την Πρωτοχρονιά
  // γράφεται με τις νύχτες και τα ποσά που ανήκουν σε αυτή τη χρονιά.
  const stayRows = lines.flatMap(l => staysOfYear(l, year).map(({ s, share, nights }) => [
    l.p.name,
    s.check_in ? new Date(s.check_in) : null,
    s.check_out ? new Date(s.check_out) : null,
    nights,
    cents(declarableGrossOrTotal(s) * share),
    cents(collectedLevy(s) * share),
    cents(platformFee(s) * share),
    AMOUNT_BASIS_LABELS[amountBasis(s)],
  ]));
  const crossing = lines.reduce((n, l) => n + staysOfYear(l, year).filter(x => x.share < 1).length, 0);
  const stays: XlsxSheet = {
    name: 'Διαμονές',
    title: `Βραχυχρόνιες διαμονές ${year}`,
    subtitle,
    columns: [
      { header: 'Ακίνητο', kind: 'text' },
      { header: 'Άφιξη', kind: 'date' },
      { header: 'Αναχώρηση', kind: 'date' },
      { header: 'Νύχτες στη χρήση', kind: 'int' },
      { header: 'Δηλωτέο ακαθάριστο', kind: 'eur' },
      { header: 'Τέλος ανθεκτικότητας', kind: 'eur' },
      { header: 'Προμήθεια πλατφόρμας', kind: 'eur' },
      { header: 'Βάση ποσού', kind: 'text' },
    ],
    rows: stayRows,
    totalCols: [4, 5, 6],
    notes: [
      'Το τέλος ανθεκτικότητας το εισπράττει ο ιδιοκτήτης για λογαριασμό του Δημοσίου: δεν είναι έσοδό του και δεν μπαίνει στο δηλωτέο ακαθάριστο.',
      ...(crossing > 0 ? [crossing === 1
        ? 'Μία διαμονή περνά την αλλαγή του έτους: μπαίνει με τις νύχτες της χρήσης και το αντίστοιχο μέρος των ποσών, όπως στο Ε2.'
        : `${crossing} διαμονές περνούν την αλλαγή του έτους: μπαίνουν με τις νύχτες της χρήσης και το αντίστοιχο μέρος των ποσών, όπως στο Ε2.`] : []),
    ],
  };

  const missing: XlsxSheet = {
    name: 'Τι λείπει',
    title: `Τι λείπει από τη χρήση ${year}`,
    subtitle,
    columns: [
      { header: 'Εκκρεμότητα', kind: 'text', width: 70 },
      { header: 'Εμποδίζει το κλείσιμο', kind: 'text' },
    ],
    rows: gaps.length
      ? gaps.map(g => [g.text, g.blocking ? 'Ναι' : 'Όχι'])
      : [['Καμία εκκρεμότητα από όσα βλέπει αυτός ο σύνδεσμος.', 'Όχι']],
    notes: ['Σημαίνει ότι δεν καταχωρήθηκε, όχι ότι δεν υπάρχει.'],
  };

  // Φύλλο χωρίς γραμμές δεν μπαίνει: ο παραλήπτης που ανοίγει «Διαμονές» και
  // βρίσκει μόνο επικεφαλίδες δεν ξέρει αν δεν υπήρξαν ή αν χάθηκαν.
  return [perProperty, ...(expenseRows.length ? [expenses] : []), ...(stayRows.length ? [stays] : []), missing];
}
