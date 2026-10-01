// ═══════════════════════════════════════════════════════════════════════════
// Ε2 — Αναλυτική Κατάσταση Μισθωμάτων Ακίνητης Περιουσίας (Πίνακας I).
// Καθαρή λογική (χωρίς I/O): μία γραμμή ανά μίσθωση του έτους. Καλείται από e2Export.ts.
// Σημασιολογία Ε2: το έντυπο υποβάλλεται ανά φορολογούμενο· κάθε συνιδιοκτήτης
// δηλώνει ΜΟΝΟ το ποσοστό του → «Ακαθάριστο Εισόδημα» = συνολικό μίσθωμα ×
// (ποσοστό/100). «Μήνες εκμίσθωσης» = τομή μισθωτηρίου με το φορολογικό έτος.
// Το ακαθάριστο είναι δεδουλευμένο (ανεξαρτήτως είσπραξης).
// ═══════════════════════════════════════════════════════════════════════════
import { shortTermYearSummary, nightsSplit, type TaxStay } from '@/lib/tax/shortTermTax';
import { readStatus, BY_KEY } from '@/lib/property/status';
import { fe } from '@/lib/core/format';
import { rentIncomeOf, servicesOf, hasRentSplit } from '@/lib/rent/split';
import { leaseEndOf } from '@/lib/data/tenants';

// Το `rental_mode` ΔΕΝ υπήρχε εδώ και γι' αυτό το έντυπο δεν μπορούσε να
// ξεχωρίσει βραχυχρόνια από μακροχρόνια όταν η κατάσταση ήταν «rented».
// Ακριβώς αυτό το ζευγάρι πεδίων περιγράφει το lib/property/status.ts ως πηγή
// ασυμφωνίας: «ακίνητο μπορούσε να είναι 'rented' με rental_mode 'short_term'».
export interface E2Property { id: string; name?: string | null; ama?: string | null; atak: string | null; address: string | null; postal_code: string | null; ownership: string | number | null; prop_type: string | null; status_detail: string | null; rental_mode?: string | null; target_rent: number | null; sqm?: number | null; floor?: string | number | null; }
// Το `id` και η αποχώρηση χρειάζονται για να μοιραστούν οι εισπράξεις στη σωστή
// μίσθωση και για να κλείσει η μίσθωση όταν ο μισθωτής έφυγε νωρίτερα.
export interface E2Tenant { id?: string | null; property_id: string; afm: string | null; monthly_rent: number | null; lease_start: string | null; lease_end: string | null; lease_type: string | null; full_name?: string | null; move_out_date?: string | null; status?: string | null; }
// Το `paid` δεν το χρειάζεται το ακαθάριστο του εντύπου (δεδουλευμένο, ανεξάρτητα
// είσπραξης) — το χρειάζεται ο ΕΛΕΓΧΟΣ του προσυμπληρωμένου, που εξηγεί τη διαφορά
// με τα ανείσπρακτα του έτους. Προαιρετικό: παλιοί καλούντες δεν αλλάζουν.
// `tenant_id` δένει τη δόση με τη μίσθωσή της· `base_rent`/`services_charge`
// χωρίζουν το μίσθωμα από τις υπηρεσίες της ίδιας δόσης (lib/rent/split.ts).
export interface E2Payment { property_id: string; amount: number | null; period_year: number; period_month: number; paid?: boolean | null; tenant_id?: string | null; base_rent?: number | null; services_charge?: number | null; }
/** Διαμονή βραχυχρόνιας (client_stays) — τα ΠΡΑΓΜΑΤΙΚΑ έσοδα ενός `seasonal` ακινήτου. */
export interface E2Stay extends TaxStay { property_id?: string | null }

// Είδος μίσθωσης (κωδικοί Ε2). Επιβεβαίωσε με το έντυπο του τρέχοντος έτους.
export const E2_LEASE_KIND: Record<string, { code: string; label: string }> = {
  rented: { code: '1', label: 'Εκμίσθωση' },
  seasonal: { code: '60', label: 'Βραχυχρόνια μίσθωση' },  // στήλη 17 Ε2: επιβεβαιωμένος
  own_use: { code: '17', label: 'Ιδιοχρησιμοποίηση' },
  vacant: { code: '39', label: 'Κενό (μη μισθωμένο)' },   // στήλη 17 Ε2: επιβεβαιωμένος
};
export function e2LeaseKind(status: string | null, rentalMode?: string | null): { code: string; label: string } {
  // Το `rental_mode` κρίνει ΠΡΩΤΟ, όπως και στο `readStatus`. Χωρίς αυτό, ακίνητο
  // αποθηκευμένο «rented» + «short_term» έπαιρνε κωδικό 1 (Εκμίσθωση) αντί για
  // 60 (Βραχυχρόνια μίσθωση) — λάθος κωδικός σε στήλη του εντύπου.
  const mode = (rentalMode ?? '').trim();
  if (mode === 'short_term') return E2_LEASE_KIND.seasonal;
  if (mode === 'long_term') return E2_LEASE_KIND.rented;
  return E2_LEASE_KIND[status || ''] || { code: '', label: '' }; // renovation/for_sale/disputed → χειροκίνητο
}

// Κατηγορία ακαθάριστου εισοδήματος (Ε2 → Ε1). Auto-ταξινόμηση, ΕΚΤΙΜΩΜΕΝΟ.
// Label-forward επίτηδες: οι αριθμητικοί κωδικοί Ε2/Ε1 αλλάζουν ανά έτος.
export function e2IncomeCategory(propType: string | null, status: string | null): string {
  if (status === 'seasonal') return 'Βραχυχρόνια μίσθωση';
  switch (propType) {
    case 'apartment': case 'studio': case 'house': case 'villa': case 'maisonette': return 'Κατοικία';
    case 'office': case 'shop': case 'warehouse': return 'Επαγγελματική στέγη';
    case 'land': return 'Γη / Αγρός';
    case 'parking': case 'storage': return 'Βοηθητικός χώρος';
    default: return 'Ακίνητο';
  }
}

/** Μήνες του έτους που το ακίνητο ήταν μισθωμένο (τομή μισθωτηρίου με το έτος). */
export function monthsRentedInYear(leaseStart: string | null, leaseEnd: string | null, year: number, status: string | null): { months: number; estimated: boolean } {
  const missing = { months: (status === 'rented' || status === 'seasonal') ? 12 : 0, estimated: true };
  if (!leaseStart) return missing;
  const yStart = new Date(Date.UTC(year, 0, 1)); const yEnd = new Date(Date.UTC(year, 11, 31));
  const ls = new Date(leaseStart + 'T00:00:00Z');
  if (isNaN(ls.getTime())) return missing; // κατεστραμμένη ημερομηνία → αντιμετώπιση σαν να λείπει
  const le = leaseEnd ? new Date(leaseEnd + 'T00:00:00Z') : yEnd;
  const start = ls > yStart ? ls : yStart; const end = le < yEnd ? le : yEnd;
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return { months: 0, estimated: false };
  const m = (end.getUTCFullYear() * 12 + end.getUTCMonth()) - (start.getUTCFullYear() * 12 + start.getUTCMonth()) + 1;
  return { months: Math.max(0, Math.min(12, m)), estimated: false };
}

/**
 * Από πού ήρθε το ακαθάριστο. Κρίνει σε ΠΟΙΑ στήλη του επίσημου εντύπου
 * γράφεται και αποφασίζεται ΜΑΖΙ με το ποσό — όχι δεύτερη φορά, αλλού.
 *
 * ═══ ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΤΟ ΓΕΝΝΗΣΕ ΚΑΙ ΗΤΑΝ ΨΕΥΔΗΣ ΦΟΡΟΛΟΓΙΚΗ ΔΗΛΩΣΗ ═══════
 * Το ποσό υπολογιζόταν με την ΚΟΙΝΗ ανάγνωση κατάστασης (`readStatus`) και από
 * ΠΡΑΓΜΑΤΙΚΕΣ πληρωμές. Η στήλη όμως επιλεγόταν από το ωμό `status_detail`:
 *
 *     const rentLike = p.status_detail === 'rented' || p.status_detail === 'seasonal';
 *     const ownUse   = p.status_detail === 'own_use';
 *
 * Οι καταστάσεις «Κενό», «Ανακαίνιση», «Προς πώληση» και «Αμφισβητούμενο» δεν
 * είναι καμία από τις δύο. Το ποσό δεν έμπαινε σε ΚΑΜΙΑ στήλη.
 *
 * Το σενάριο δεν είναι ακραίο, είναι το πιο συνηθισμένο του χρόνου: διαμέρισμα
 * νοικιασμένο Ιανουάριο ως Ιούνιο, ο μισθωτής φεύγει, ο ιδιοκτήτης βάζει
 * «Κενό». Μετρημένο με τον πραγματικό κώδικα: γραμμή με ακαθάριστο 4.200€,
 * και στις τέσσερις στήλες ποσού κενό. Το φύλλο «Σύνοψη Ε1» του ΙΔΙΟΥ αρχείου,
 * που χτίζεται από το `buildE2Row`, έγραφε κανονικά 4.200€.
 *
 * Δηλαδή ο ιδιοκτήτης παρέδιδε στον λογιστή ένα βιβλίο εργασίας που
 * αυτοαναιρείται και το επίσημο έντυπο έλεγε μηδέν.
 */
export type E2IncomeSource = 'rent' | 'own_use' | 'none';

export interface E2Row { atak: string; address: string; ownerAfm: string; ownershipPct: number; leaseKind: string; months: number; incomeCategory: string; grossIncome: number; incomeSource: E2IncomeSource; flags: string[]; }

/**
 * Μία γραμμή του Πίνακα I: μία μίσθωση ενός ακινήτου μέσα στο έτος, ή μία
 * κατάσταση (κενό, βραχυχρόνια, ιδιοχρησιμοποίηση) όταν δεν υπάρχει μίσθωση.
 *
 * ΓΙΑΤΙ ΟΧΙ ΜΙΑ ΓΡΑΜΜΗ ΑΝΑ ΑΚΙΝΗΤΟ. Ακίνητο που άλλαξε μισθωτή μέσα στο έτος
 * έχει δύο μισθωτές, δύο ΑΦΜ και δύο διαστήματα. Με μία γραμμή, το έντυπο
 * έγραφε έναν μισθωτή δίπλα στο ενοίκιο και των δύο.
 */
export interface E2Line {
  /** Στ. 6 και 7. */
  tenantName: string;
  tenantAfm: string;
  /** Στ. 8 και 9, «ΗΗ/ΜΜ/ΕΕΕΕ», μέσα στο έτος. Κενό όταν δεν ορίζεται. */
  from: string;
  to: string;
  /** Στ. 10. Κενό όταν δεν ορίζεται. */
  months: number | '';
  /** Στ. 11. Κενό όταν δεν υπάρχει σταθερό μίσθωμα (βραχυχρόνια). */
  monthly: number | '';
  /** Στ. 17. */
  kind: { code: string; label: string };
  /** Ακαθάριστο του μεριδίου του υπόχρεου, στρογγυλεμένο. */
  gross: number;
  source: E2IncomeSource;
  /**
   * Το ακαθάριστο ΑΥΤΗΣ της γραμμής είναι εκτίμηση (μηνιαίο × μήνες ή στόχος),
   * όχι καταγραφή. Η σημαία του ακινήτου δεν φτάνει: ακίνητο με δύο μισθώσεις
   * μπορεί να έχει τη μία καταγεγραμμένη και την άλλη εκτιμώμενη. Η
   * σύγκριση με την ΑΑΔΕ λέει «διόρθωσε στην εφαρμογή» μόνο για τη δεύτερη.
   */
  estimated?: boolean;
  /** Οι μήνες της γραμμής δεν βγήκαν από ημερομηνίες ή διαμονές. */
  monthsEstimated?: boolean;
}

/** Η γραμμή του ακινήτου μαζί με τις γραμμές του εντύπου που τη συνθέτουν. */
export interface E2RowDetail extends E2Row {
  lines: E2Line[];
  /** Υπηρεσίες του έτους που χρεώθηκαν στον μισθωτή και ΔΕΝ μπήκαν στο ακαθάριστο (μερίδιο). */
  servicesExcluded: number;
  /** Ανείσπρακτο μίσθωμα του έτους, μετρημένο στη στ. 13 (μερίδιο). */
  unpaidRent: number;
}

export interface E2RowOptions {
  /**
   * Το ακίνητο έχει καταχωρημένους μισθωτές, έστω και σε άλλα έτη. Χωρίς
   * καμία μίσθωση μέσα στο έτος, ήταν κενό εκείνο το έτος.
   */
  hasLeaseHistory?: boolean;
}

const isoDay = (v: string | null | undefined): string | null => {
  const s = String(v ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z')) ? s : null;
};
const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/** Οι μήνες (1 έως 12) του έτους που αγγίζει ένα διάστημα. */
function monthsTouched(start: string, end: string | null, year: number): number[] {
  const ys = `${year}-01-01`, ye = `${year}-12-31`;
  const s = start > ys ? start : ys, e = end && end < ye ? end : ye;
  if (e < s) return [];
  const out: number[] = [];
  for (let m = Number(s.slice(5, 7)); m <= Number(e.slice(5, 7)); m++) out.push(m);
  return out;
}

/**
 * Πρώτη και τελευταία μέρα με διαμονή μέσα στο έτος. Διαμονή που περνά την
 * αλλαγή του χρόνου κόβεται στα όρια του έτους.
 */
function stayWindowInYear(stays: readonly E2Stay[], year: number): { from: string; to: string } {
  const ys = `${year}-01-01`, ye = `${year}-12-31`;
  let first = '', last = '';
  for (const s of stays) {
    const ci = isoDay(s.check_in);
    if (!ci || nightsSplit(s, year).inYear <= 0) continue;
    const co = isoDay(s.check_out) || ci;
    const a = ci < ys ? ys : ci, b = co > ye ? ye : co;
    if (!first || a < first) first = a;
    if (!last || b > last) last = b;
  }
  return first ? { from: dmy(first), to: dmy(last) } : { from: '', to: '' };
}

/** Κοινή οδηγία για κάθε γραμμή βραχυχρόνιας με διαμονές. */
export const E2_SHORT_TERM_NOTE = 'Βραχυχρόνια: στη στ. 10 οι μήνες με διανυκτερεύσεις, στις στ. 8 και 9 η πρώτη και η τελευταία διαμονή του έτους. Η στ. 11 μένει κενή γιατί δεν υπάρχει σταθερό μηνιαίο μίσθωμα· το ακαθάριστο είναι το άθροισμα των διαμονών.';

/**
 * Το ακίνητο για το έτος: μία γραμμή ανά μίσθωση που το καλύπτει. Το `stays`
 * είναι οι διαμονές ΑΥΤΟΥ του ακινήτου (όπως το `payments`, ομαδοποιημένες από
 * τον καλούντα)· χρησιμοποιείται μόνο στη βραχυχρόνια.
 *
 * ΤΙ ΕΒΓΑΖΕ ΛΑΘΟΣ ΠΡΙΝ: στα ακίνητα βραχυχρόνιας το ακαθάριστο έβγαινε από το
 * «μηνιαίο μίσθωμα» × μήνες — δηλαδή από το `target_rent`, έναν ΣΤΟΧΟ που έβαλε
 * ο χρήστης στην καρτέλα του ακινήτου, ή από 0 όταν δεν τον είχε βάλει. Οι
 * καταγεγραμμένες διαμονές, που είναι τα πραγματικά έσοδα, δεν διαβάζονταν ΠΟΤΕ.
 *
 * Το άθροισμα ΔΕΝ ξαναγράφεται εδώ: περνά από την ίδια `shortTermYearSummary`
 * που δίνει τα ακαθάριστα στην καρτέλα Φορολογίας — αλλιώς οι δύο οθόνες θα
 * έλεγαν άλλο νούμερο για την ίδια χρονιά.
 *
 * ΟΙ ΜΙΣΘΩΣΕΙΣ ΕΙΝΑΙ ΟΣΕΣ ΚΑΛΥΠΤΟΥΝ ΤΟ ΕΤΟΣ, ΟΧΙ Ο ΣΗΜΕΡΙΝΟΣ ΜΙΣΘΩΤΗΣ
 * (`tenantStore.inYearByProperty`). Οι εισπράξεις μοιράζονται στις μισθώσεις
 * με το `tenant_id` τους· όπου λείπει, με τον μήνα της περιόδου.
 *
 * ΤΟ ΑΚΑΘΑΡΙΣΤΟ ΕΙΝΑΙ ΤΟ ΜΙΣΘΩΜΑ, ΟΧΙ Η ΔΟΣΗ. Η δόση περιέχει και υπηρεσίες
 * που μετακυλίονται στον μισθωτή· μετρά μόνο το `base_rent` (lib/rent/split.ts).
 */
export function buildE2Row(
  p: E2Property, tenants: E2Tenant | readonly E2Tenant[] | null, payments: E2Payment[], ownerAfm: string,
  year: number, stays: E2Stay[] = [], opts: E2RowOptions = {},
): E2RowDetail {
  const flags: string[] = [];
  const flag = (f: string) => { if (!flags.includes(f)) flags.push(f); };
  const on = typeof p.ownership === 'string' ? parseFloat(p.ownership) : p.ownership;
  const ownershipPct = (on == null || isNaN(on as number)) ? 100 : (on as number);
  const share = (n: number) => Math.round(n * ownershipPct / 100); // μερίδιο συνιδιοκτήτη
  const statusKind = e2LeaseKind(p.status_detail, p.rental_mode);
  const leases: readonly E2Tenant[] = tenants == null ? [] : Array.isArray(tenants) ? tenants as readonly E2Tenant[] : [tenants as E2Tenant];
  const yearRows = payments.filter(x => x.period_year === year);
  const sumRent = (rows: readonly E2Payment[]) => rows.reduce((s, x) => s + rentIncomeOf(x), 0);
  // ΜΙΑ ΑΝΑΓΝΩΣΗ ΚΑΤΑΣΤΑΣΗΣ, Η ΚΟΙΝΗ. Ήταν `status_detail === 'seasonal'` — που
  // αγνοεί το `rental_mode`. Ακίνητο αποθηκευμένο ως «rented» με mode
  // «short_term» (το `readStatus` το λέει ρητά βραχυχρόνιο) περνούσε εδώ για
  // μακροχρόνιο: οι διαμονές του ΔΕΝ μετριούνταν καθόλου και το ακαθάριστο
  // έβγαινε από μισθώματα ή από τον στόχο ενοικίου — σε φορολογικό έντυπο.
  const status = readStatus(p);
  const shortTerm = status === 'rent_short';
  // ΑΜΥΝΑ: ΚΡΑΤΑΜΕ ΜΟΝΟ ΤΙΣ ΔΙΑΜΟΝΕΣ ΑΥΤΟΥ ΤΟΥ ΑΚΙΝΗΤΟΥ. Ένας καλών που θα
  // περνούσε τις διαμονές ΟΛΟΥ του χαρτοφυλακίου θα δήλωνε σε ΚΑΘΕ ακίνητο τα
  // έσοδα όλων. Διαμονή χωρίς property_id θεωρείται δική του: είναι ιστορική
  // γραμμή πριν μπει η στήλη.
  const ownStays = stays.filter(st => st.property_id == null || st.property_id === p.id);

  const lines: E2Line[] = [];
  const monthSet = new Set<number>();
  let estimatedMonths = 0;
  let grossEstimated = false;
  /** Οι δόσεις που μετρήθηκαν στο ακαθάριστο. */
  let counted: E2Payment[] = [];
  const line = (o: Partial<E2Line> & Pick<E2Line, 'kind' | 'gross'>): E2Line => ({
    tenantName: '', tenantAfm: '', from: '', to: '', months: '', monthly: '',
    source: o.gross > 0 ? 'rent' : 'none', ...o,
  });

  if (shortTerm) {
    // ── ΒΡΑΧΥΧΡΟΝΙΑ: ΜΙΑ ΓΡΑΜΜΗ, ΑΠΟ ΤΙΣ ΔΙΑΜΟΝΕΣ ─────────────────────────
    // Ήταν 12 μήνες, 01/01 έως 31/12 και μηνιαίο μίσθωμα ο στόχος, δίπλα σε
    // ακαθάριστο από διαμονές: μια γραμμή που έμοιαζε με ετήσιο μισθωτήριο.
    const stayYear = shortTermYearSummary(ownStays, year);
    if (stayYear.grossRevenue > 0) {
      // Ιστορικές γραμμές που δεν ξέρουμε αν είναι ακαθάριστα ή payout: το ποσό
      // μπαίνει, αλλά ο χρήστης οφείλει να το δει πριν το δώσει στον λογιστή.
      if (stayYear.unresolvedCount > 0) flag(`Ακαθάριστο βραχυχρόνιας: ${stayYear.unresolvedCount} ${stayYear.unresolvedCount === 1 ? 'διαμονή' : 'διαμονές'} χωρίς ρητή βάση ποσού (ακαθάριστο ή payout)· επιβεβαίωσέ τες`);
      stayYear.nightsByMonth.forEach((n, i) => { if (n > 0) monthSet.add(i + 1); });
      lines.push(line({ ...stayWindowInYear(ownStays, year), months: monthSet.size || '', kind: statusKind, gross: share(stayYear.grossRevenue) }));
      flag(E2_SHORT_TERM_NOTE);
    } else if (yearRows.length) {
      counted = yearRows;
      yearRows.forEach(x => monthSet.add(x.period_month));
      lines.push(line({ months: monthSet.size || '', kind: statusKind, gross: share(sumRent(yearRows)) }));
    } else {
      // Καμία διαμονή, καμία είσπραξη: ο στόχος επιτρέπεται ως ΡΗΤΗ εκτίμηση
      // του ακαθαρίστου. Μήνες, ημερομηνίες και μηνιαίο μένουν κενά: δεν
      // υπάρχει τίποτα από το οποίο να βγουν.
      const lead = leases[leases.length - 1] ?? null;
      const mm = monthsRentedInYear(lead?.lease_start ?? null, lead ? leaseEndOf(lead) : null, year, p.status_detail);
      if (mm.estimated && mm.months > 0) flag('Μήνες εκμίσθωσης: εκτίμηση');
      const g = (lead?.monthly_rent ?? p.target_rent ?? 0) * mm.months;
      estimatedMonths = mm.months;
      grossEstimated = g > 0;
      lines.push(line({ kind: statusKind, gross: share(g), estimated: g > 0, monthsEstimated: true }));
    }
  } else {
    // ── ΜΑΚΡΟΧΡΟΝΙΑ: ΜΙΑ ΓΡΑΜΜΗ ΑΝΑ ΜΙΣΘΩΣΗ ΤΟΥ ΕΤΟΥΣ ─────────────────────
    const ids = leases.map(l => l.id ?? null);
    const withIds = ids.some(Boolean);
    const covered = leases.map(l => {
      const s = isoDay(l.lease_start);
      return s ? new Set(monthsTouched(s, leaseEndOf(l), year)) : null;
    });
    const byLease = leases.map(() => [] as E2Payment[]);
    const loose: E2Payment[] = [];
    for (const x of yearRows) {
      const i = x.tenant_id && withIds ? ids.indexOf(x.tenant_id)
        : leases.length === 1 ? 0
        : covered.findIndex(ms => ms == null || ms.has(x.period_month));
      if (i >= 0) byLease[i].push(x); else loose.push(x);
    }
    counted = yearRows;
    leases.forEach((l, i) => {
      const end = leaseEndOf(l);
      const mm = monthsRentedInYear(l.lease_start, end, year, p.status_detail);
      if (mm.estimated && mm.months > 0) flag('Μήνες εκμίσθωσης: εκτίμηση');
      const cov = covered[i];
      if (cov) cov.forEach(m => monthSet.add(m)); else estimatedMonths = Math.max(estimatedMonths, mm.months);
      const monthly = l.monthly_rent ?? p.target_rent ?? 0;
      let full: number;
      if (byLease[i].length) full = sumRent(byLease[i]);
      else { full = monthly * mm.months; if (full > 0) grossEstimated = true; }
      const win = leaseWindowInYear(l.lease_start, end, year, p.status_detail);
      lines.push(line({
        estimated: !byLease[i].length && full > 0, monthsEstimated: mm.estimated,
        tenantName: l.full_name || '', tenantAfm: l.afm || '', from: win.from, to: win.to,
        months: mm.months || '', monthly: monthly ? Number(monthly) : '',
        kind: E2_LEASE_KIND.rented, gross: share(full),
      }));
    });
    if (loose.length) {
      // Είσπραξη χωρίς μίσθωση που να καλύπτει το έτος. Το ποσό ΔΕΝ χάνεται
      // (είναι εισόδημα), αλλά ο μισθωτής του δεν μαντεύεται.
      const g = sumRent(loose);
      const ms = new Set(loose.map(x => x.period_month));
      ms.forEach(m => monthSet.add(m));
      lines.push(line({ months: ms.size || '', kind: leases.length ? E2_LEASE_KIND.rented : statusKind, gross: share(g) }));
      flag(`Εισπράξεις ${fe(share(g))} του ${year} χωρίς μίσθωση που να καλύπτει το έτος: συμπλήρωσε μισθωτή, ΑΦΜ και ημερομηνίες μίσθωσης (στ. 6 έως 9).`);
    }
    if (!lines.length) {
      if (opts.hasLeaseHistory && status !== 'own_use') {
        // Το ακίνητο έχει μισθωτές σε άλλα έτη και κανέναν σε αυτό: ήταν κενό.
        // Πριν, ο ΣΗΜΕΡΙΝΟΣ μισθωτής (π.χ. νέα μίσθωση του επόμενου έτους)
        // έμπαινε στη γραμμή με μήνες 0 και κενές ημερομηνίες.
        lines.push(line({ kind: E2_LEASE_KIND.vacant, gross: 0 }));
        flag(`Καμία μίσθωση δεν καλύπτει το ${year}: η γραμμή δηλώνεται ΚΕΝΟ. Αν υπήρξε μίσθωση, καταχώρησέ τη με ημερομηνίες.`);
      } else {
        // Χωρίς καμία καταγραφή, η κατάσταση του ακινήτου κρίνει (ΚΕΝΟ για όλο
        // το έτος, ή εκτίμηση από τον στόχο για «μισθωμένο» χωρίς στοιχεία).
        const mm = monthsRentedInYear(null, null, year, p.status_detail);
        if (mm.estimated && mm.months > 0) flag('Μήνες εκμίσθωσης: εκτίμηση');
        estimatedMonths = mm.months;
        const g = (p.target_rent ?? 0) * mm.months;
        grossEstimated = g > 0;
        const win = leaseWindowInYear(null, null, year, p.status_detail);
        lines.push(line({
          from: win.from, to: win.to, months: mm.months || '', monthly: p.target_rent ? Number(p.target_rent) : '',
          estimated: g > 0, monthsEstimated: mm.estimated,
          kind: statusKind, gross: share(g),
          // ΤΟ ΧΡΗΜΑ ΠΟΥ ΕΙΣΠΡΑΧΘΗΚΕ ΕΙΝΑΙ ΠΑΝΤΑ ΜΙΣΘΩΜΑ. Μόνο μια εκτίμηση πάνω
          // σε ιδιοχρησία, χωρίς καμία είσπραξη, είναι ιδιοχρησιμοποίηση.
          source: g <= 0 ? 'none' : status === 'own_use' ? 'own_use' : 'rent',
        }));
      }
    }
  }

  if (grossEstimated) {
    // ΤΟ ΜΗΝΥΜΑ ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΙΣΧΥΡΙΖΕΤΑΙ ΠΕΡΙΣΣΟΤΕΡΑ ΑΠ' ΟΣΑ ΚΟΙΤΑΞΕ.
    // «Κοίταξα και δεν βρήκα» λέγεται μόνο όταν ΟΝΤΩΣ δόθηκαν διαμονές.
    // Αλλιώς λέμε ό,τι ισχύει: ότι είναι εκτίμηση.
    flag(shortTerm
      ? (ownStays.length > 0
          ? 'Ακαθάριστο βραχυχρόνιας: εκτίμηση από τον στόχο μισθώματος· καμία καταγεγραμμένη διαμονή για το έτος'
          : 'Ακαθάριστο βραχυχρόνιας: εκτίμηση από τον στόχο μισθώματος· οι καταγεγραμμένες διαμονές ΔΕΝ ελήφθησαν υπόψη')
      : 'Ακαθάριστο εισόδημα: εκτίμηση (μηνιαίο × μήνες)');
  }

  // ── ΥΠΗΡΕΣΙΕΣ, ΠΑΛΙΕΣ ΓΡΑΜΜΕΣ, ΑΝΕΙΣΠΡΑΚΤΑ ──────────────────────────────
  const servicesExcluded = share(counted.reduce((s, x) => s + servicesOf(x), 0));
  if (servicesExcluded > 0) flag(`Υπηρεσίες ${fe(servicesExcluded)} (ίντερνετ, συνδρομές, καθαρισμός, στάθμευση) χρεώθηκαν στον μισθωτή μαζί με το ενοίκιο και ΔΕΝ μπήκαν στη στ. 13: δεν είναι μίσθωμα.`);
  const legacy = counted.filter(x => !hasRentSplit(x) && (x.amount || 0) > 0).length;
  if (legacy) flag(`${legacy} ${legacy === 1 ? 'δόση' : 'δόσεις'} χωρίς χωριστό ενοίκιο (παλιές γραμμές): στη στ. 13 μετρήθηκε ολόκληρο το ποσό. Αν περιέχει υπηρεσίες, αφαίρεσέ τες.`);
  // ΣΤΗΛΗ 16. Η νομική διεκδίκηση των ανείσπρακτων (άρθρο 39 ΚΦΕ) ΔΕΝ
  // αποθηκεύεται: στη Λογιστική είναι τσεκ της οθόνης που χάνεται με την
  // αλλαγή ακινήτου. Χωρίς καταγραφή, το έντυπο δεν μεταφέρει μόνο του ποσό
  // από τη 13 στη 16· το λέει. Το `paid` που λείπει από το ερώτημα σημαίνει
  // «δεν ξέρουμε», όχι «απλήρωτο».
  const unpaidRent = share(counted.filter(x => x.paid === false || x.paid === null).reduce((s, x) => s + rentIncomeOf(x), 0));
  if (unpaidRent > 0) flag(`Ανείσπρακτο μίσθωμα ${fe(unpaidRent)} μετρήθηκε στη στ. 13. Αν έχει εκδοθεί διαταγή πληρωμής ή ασκηθεί αγωγή (άρθρο 39 ΚΦΕ), το ποσό μεταφέρεται στη στ. 16· η εφαρμογή δεν το καταγράφει.`);

  const grossIncome = lines.reduce((s, l) => s + l.gross, 0);
  const incomeSource: E2IncomeSource =
    lines.some(l => l.source === 'rent' && l.gross > 0) ? 'rent'
      : lines.some(l => l.source === 'own_use' && l.gross > 0) ? 'own_use'
      : 'none';
  // ΚΑΙ Η ΑΝΤΙΦΑΣΗ ΛΕΓΕΤΑΙ, ΑΝΤΙ ΝΑ ΤΑΞΙΔΕΨΕΙ ΣΙΩΠΗΛΑ. Ακίνητο «Κενό» με
  // εισπράξεις μέσα στη χρονιά και ΚΑΜΙΑ μίσθωση που να τις εξηγεί. Με μίσθωση
  // μέσα στο έτος δεν υπάρχει αντίφαση: η κατάσταση περιγράφει το σήμερα.
  if (incomeSource === 'rent' && !leases.length && !(status === 'rent_long' || status === 'rent_short')) {
    // Η ΕΤΙΚΕΤΑ ΒΓΑΙΝΕΙ ΑΠΟ ΤΟ ΜΗΤΡΩΟ ΚΑΤΑΣΤΑΣΕΩΝ, όχι το ωμό κλειδί της βάσης.
    flag(`Η κατάσταση λέει «${BY_KEY[status].label}» αλλά υπάρχει εισόδημα ${fe(grossIncome)}: το έντυπο το δηλώνει ως εκμίσθωση (στ. 13). Διόρθωσε την κατάσταση ή το είδος μίσθωσης.`);
  }
  if (lines.some(l => !l.kind.code)) flag('Χρειάζεται χειροκίνητος καθορισμός είδους μίσθωσης');
  const address = [p.address, p.postal_code].filter(Boolean).join(', ');
  if (!p.atak) flag('Λείπει ΑΤΑΚ');
  if (!ownerAfm) flag('Λείπει ΑΦΜ ιδιοκτήτη');
  if (ownershipPct < 100) flag('Συνιδιοκτησία < 100%: πρόσθεσε ΑΦΜ λοιπών συνιδιοκτητών');
  const lead = lines.find(l => l.gross > 0) ?? lines[0];
  return {
    atak: p.atak || '', address, ownerAfm: ownerAfm || '', ownershipPct,
    leaseKind: lead?.kind.code ? `${lead.kind.code} ${lead.kind.label}` : '',
    months: Math.min(12, Math.max(monthSet.size, estimatedMonths)),
    incomeCategory: e2IncomeCategory(p.prop_type, shortTerm ? 'seasonal' : p.status_detail),
    grossIncome, incomeSource, flags, lines, servicesExcluded, unpaidRent,
  };
}

export function e2RowToCells(r: E2Row, index: number): (string | number)[] {
  const dec = (n: number) => n.toFixed(2).replace('.', ',');
  return [index, r.atak, r.address, r.ownerAfm, dec(r.ownershipPct), r.leaseKind, r.months, r.incomeCategory, String(Math.round(r.grossIncome))];
}

// ── Σύνοψη Ε1 (Πίνακας 4Δ, ακίνητη περιουσία): ακαθάριστο εκμίσθωσης ανά κωδικό ──
// Το Ε2 τροφοδοτεί το Ε1: τα ακαθάριστα ανά κατηγορία μεταφέρονται σε συγκεκριμένους
// κωδικούς. Οι αριθμοί παρακάτω είναι αυτοί που χρησιμοποιούσε πάντα η εφαρμογή
// (103 κατοικίες, 105 επαγγελματική στέγη, 109 γαίες/γήπεδα). ΔΕΝ υπάρχει εδώ
// επίσημη πηγή που να τους επιβεβαιώνει, ούτε για τον υποπίνακα του 4Δ: το
// σχόλιο έλεγε «4Δ2» και το φύλλο «4Δ1». Το φύλλο λέει πια μόνο «4Δ» και η
// σημείωση ζητά επιβεβαίωση κωδικών από τον λογιστή.
//
// ΤΙ ΔΕΝ ΜΠΑΙΝΕΙ ΣΤΟΝ ΚΩΔΙΚΟ ΕΚΜΙΣΘΩΣΗΣ:
// · η ιδιοχρησιμοποίηση (Ε2 στ. 15): δεν είναι μίσθωμα· φαίνεται χωριστά.
// · η κατηγορία χωρίς αντιστοίχιση: γινόταν σιωπηλά 103. Τώρα βγαίνει γραμμή
//   χωρίς κωδικό, σημασμένη, για να τη συμπληρώσει άνθρωπος.
export const E1_CODE_MAP: Record<string, { code: string; label: string }> = {
  'Κατοικία': { code: '103', label: 'Ακαθάριστο εισόδημα από εκμίσθωση κατοικιών' },
  'Βραχυχρόνια μίσθωση': { code: '103', label: 'Εισόδημα βραχυχρόνιας μίσθωσης (μεταφορά από Ε2, ανά τύπο ακινήτου)' },
  'Επαγγελματική στέγη': { code: '105', label: 'Ακαθάριστο εισόδημα από εκμίσθωση επαγγελματικής στέγης' },
  'Γη / Αγρός': { code: '109', label: 'Ακαθάριστο εισόδημα από εκμίσθωση γαιών / γηπέδων' },
  'Βοηθητικός χώρος': { code: '103', label: 'Ακαθάριστο εισόδημα από εκμίσθωση κατοικιών (βοηθητικοί χώροι)' },
}

/** Η περιγραφή της γραμμής που δεν βρήκε κωδικό. */
export const E1_UNMAPPED_LABEL = 'Χωρίς αντιστοίχιση κωδικού Ε1: όρισε τον τύπο του ακινήτου ή συμπλήρωσε τον κωδικό με τον λογιστή'

export interface E1CodeLine { code: string; label: string; category: string; amount: number; unmapped?: boolean }
export interface E1Summary {
  /** Ακαθάριστο ΕΚΜΙΣΘΩΣΗΣ ανά κωδικό μαζί με όσα δεν βρήκαν κωδικό (`unmapped`). */
  lines: E1CodeLine[];
  /** Σύνολο εκμίσθωσης, μαζί με τις γραμμές χωρίς κωδικό (είναι μίσθωμα, απλώς χωρίς θέση). */
  totalGross: number;
  /** Ιδιοχρησιμοποίηση (Ε2 στ. 15). Εκτός του συνόλου εκμίσθωσης. */
  ownUse: number;
  note: string;
}

export const E1_CODES_NOTE = 'Οι κωδικοί Ε1 είναι ενδεικτικοί: ο υποπίνακας του 4Δ και οι κωδικοί επιβεβαιώνονται από τον λογιστή στο έντυπο του τρέχοντος έτους (myAADE).'

/** Ομαδοποιεί τα ακαθάριστα εκμίσθωσης του Ε2 στους κωδικούς του Ε1 (Πίνακας 4Δ). */
export function buildE1Summary(rows: E2Row[]): E1Summary {
  const byCode = new Map<string, E1CodeLine>()
  let ownUse = 0
  for (const r of rows) {
    if (!(r.grossIncome > 0)) continue
    if (r.incomeSource === 'own_use') { ownUse += r.grossIncome; continue }
    if (r.incomeSource !== 'rent') continue
    const map = E1_CODE_MAP[r.incomeCategory]
    const key = (map ? map.code : 'χωρίς') + '|' + r.incomeCategory
    const existing = byCode.get(key)
    if (existing) existing.amount += r.grossIncome
    else byCode.set(key, map
      ? { code: map.code, label: map.label, category: r.incomeCategory, amount: r.grossIncome }
      : { code: '', label: E1_UNMAPPED_LABEL, category: r.incomeCategory, amount: r.grossIncome, unmapped: true })
  }
  const lines = [...byCode.values()].map(l => ({ ...l, amount: Math.round(l.amount) })).sort((a, b) => b.amount - a.amount)
  const totalGross = lines.reduce((s, l) => s + l.amount, 0)
  return { lines, totalGross, ownUse: Math.round(ownUse), note: E1_CODES_NOTE }
}

export const E1_HEADERS = ['Κωδικός Ε1', 'Περιγραφή', 'Κατηγορία', 'Ακαθάριστο Εισόδημα']
export function e1LineToCells(l: E1CodeLine): (string | number)[] {
  return [l.code, l.label, l.category, String(Math.round(l.amount))]
}

// ═══════════════════════════════════════════════════════════════════════════
// Ε2 — πλήρης δομή επίσημου εντύπου (Πίνακας I), για προσυμπληρωμένο Excel που
// αντιγράφεται στο myAADE. Οι στήλες ακολουθούν την επίσημη αρίθμηση της ΑΑΔΕ.
// ═══════════════════════════════════════════════════════════════════════════
const E2_CATEGORY: Record<string, string> = {
  apartment: 'Διαμέρισμα', studio: 'Διαμέρισμα (studio)', house: 'Μονοκατοικία', villa: 'Μονοκατοικία',
  maisonette: 'Μεζονέτα', office: 'Γραφείο', shop: 'Κατάστημα', warehouse: 'Αποθήκη',
  land: 'Γη / Αγρός', parking: 'Χώρος στάθμευσης', storage: 'Αποθήκη', other: '',
};
export function e2CategoryLabel(propType: string | null): string { return E2_CATEGORY[propType || ''] || ''; }

/** Διάστημα μίσθωσης εντός του έτους (στήλες 8/9), ως «ΗΗ/ΜΜ/ΕΕΕΕ». */
export function leaseWindowInYear(leaseStart: string | null, leaseEnd: string | null, year: number, status: string | null): { from: string; to: string } {
  const fmt = (d: Date) => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
  const yStart = new Date(Date.UTC(year, 0, 1)), yEnd = new Date(Date.UTC(year, 11, 31));
  const full = (status === 'rented' || status === 'seasonal');
  if (!leaseStart) return full ? { from: fmt(yStart), to: fmt(yEnd) } : { from: '', to: '' };
  const ls = new Date(leaseStart + 'T00:00:00Z');
  if (isNaN(ls.getTime())) return full ? { from: fmt(yStart), to: fmt(yEnd) } : { from: '', to: '' };
  const le = leaseEnd ? new Date(leaseEnd + 'T00:00:00Z') : yEnd;
  const start = ls > yStart ? ls : yStart, end = le < yEnd ? le : yEnd;
  if (isNaN(end.getTime()) || end < start) return { from: '', to: '' };
  return { from: fmt(start), to: fmt(end) };
}

// Επικεφαλίδες πίνακα I με την επίσημη αρίθμηση στηλών (για αντιστοίχιση στο myAADE).
export const E2_OFFICIAL_HEADERS = [
  'α/α',
  'Τοποθεσία · Οδός/Αριθ./Πόλη/Τ.Κ. (στ. 2)',
  'Θέση · όροφος (στ. 3)',
  'Κατηγορία ακινήτου (στ. 4)',
  'Επιφάνεια τ.μ. (στ. 5)',
  'Είδος μίσθωσης / χρήση (στ. 17)',
  'Αρ. παροχής ρεύματος (στ. 18)',
  'Ενοικιαστής · Ονοματεπώνυμο/Επωνυμία (στ. 6)',
  'ΑΦΜ ενοικιαστή (στ. 7)',
  'Αρ. δήλωσης μίσθωσης (στ. 19)',
  'Έναρξη μίσθωσης (στ. 8)',
  'Λήξη μίσθωσης (στ. 9)',
  'Μήνες (στ. 10)',
  'Μηνιαίο μίσθωμα € (στ. 11)',
  'Ποσοστό συνιδ/σίας % (στ. 12)',
  'Ακαθάριστο: Εκμίσθωση € (στ. 13)',
  'Ακαθάριστο: Δωρεάν παραχώρηση € (στ. 14)',
  'Ακαθάριστο: Ιδιοχρησιμοποίηση € (στ. 15)',
  'Ακαθάριστο: Ανείσπρακτα € (στ. 16)',
];
// Ποιες στήλες (0-based) είναι αριθμητικές, για μορφοποίηση/άθροισμα.
export const E2_NUM_COLS = { sqm: 4, months: 12, monthly: 13, pct: 14, gross13: 15, gross14: 16, gross15: 17, gross16: 18 };

/**
 * Οι γραμμές του Πίνακα I για ένα ακίνητο, από ΗΔΗ χτισμένη γραμμή
 * (`buildE2Row`): μία ανά μίσθωση του έτους, με α/α από το `index` και μετά.
 *
 * Η ΣΤΗΛΗ ΒΓΑΙΝΕΙ ΑΠΟ ΤΗ ΓΡΑΜΜΗ, ΟΧΙ ΑΠΟ ΔΕΥΤΕΡΗ ΑΝΑΓΝΩΣΗ ΤΗΣ ΚΑΤΑΣΤΑΣΗΣ.
 * Βλ. το σχόλιο του `E2IncomeSource`: εδώ γεννήθηκε το κενό έντυπο.
 */
export function e2OfficialRows(p: E2Property, row: E2RowDetail, index: number): (string | number)[][] {
  const loc = [p.address, p.postal_code].filter(Boolean).join(', ');
  return row.lines.map((l, i) => [
    index + i,
    loc,
    p.floor != null && p.floor !== '' ? String(p.floor) : '',
    e2CategoryLabel(p.prop_type),
    p.sqm != null ? p.sqm : '',
    l.kind.code ? `${l.kind.code} · ${l.kind.label}` : '',
    '',                                   // στ.18 αρ. παροχής ρεύματος: δεν αντλείται
    l.tenantName,
    l.tenantAfm,
    '',                                   // στ.19 αρ. δήλωσης μίσθωσης: δεν αντλείται
    l.from,
    l.to,
    l.months,
    l.monthly,
    row.ownershipPct,
    l.source === 'rent' && l.gross > 0 ? l.gross : '',      // στ.13 εκμίσθωση
    '',                                                      // στ.14 δωρεάν παραχώρηση
    l.source === 'own_use' && l.gross > 0 ? l.gross : '',   // στ.15 ιδιοχρησιμοποίηση
    '',                                   // στ.16 ανείσπρακτα: βλ. `unpaidRent` στο `buildE2Row`
  ]);
}

// Οδηγίες συμπλήρωσης εντύπου Ε2 (σύμφωνα με την επίσημη περίληψη της ΑΑΔΕ).
export const E2_INSTRUCTIONS = [
  '1. Υπόχρεος για τα εισοδήματα από ακίνητη περιουσία είναι ο ιδιοκτήτης, ο νομέας, ο επικαρπωτής ή εκείνος που έχει δικαίωμα οίκησης με οριστικό συμβόλαιο, δικαστική απόφαση ή χρησικτησία, καθώς και όποιος αποκτά εισόδημα από εκμίσθωση, υπεκμίσθωση, δωρεάν παραχώρηση ή ιδιοχρησιμοποίηση.',
  '2. Καταχωρούνται όλα τα οικοδομημένα ακίνητα κάθε υπόχρεου (ακόμη και όσα δεν απέφεραν εισόδημα) και τα μη οικοδομημένα που απέφεραν εισόδημα. Ακίνητο που παρέμεινε κενό όλο το έτος δηλώνεται με την ένδειξη «ΚΕΝΟ».',
  '3. Υποβάλλεται χωριστό Ε2 για κάθε σύζυγο/μέρος συμφώνου συμβίωσης, ακόμη και αν το ακίνητο είναι κοινό. Το εισόδημα ανήλικων τέκνων δηλώνεται στο Ε2 του γονέα που έχει τη γονική μέριμνα.',
  '4. Τα νομικά πρόσωπα και οι νομικές οντότητες συνυποβάλλουν το Ε2 μαζί με τη δήλωση φορολογίας εισοδήματός τους.',
  '5. Σε συνιδιοκτησία, στη στήλη «Ακαθάριστο Εισόδημα» γράφεται μόνο το ποσό που αναλογεί στον υπόχρεο βάσει του ποσοστού συνιδιοκτησίας (στήλη 12).',
  '6. Η στήλη 1 (α/α) αριθμεί με αύξουσα σειρά τις εγγραφές. Στη στήλη 4 συμπληρώνεται η κατηγορία του ακινήτου βάσει περιουσιολογίου (Κατοικία, Μονοκατοικία, Διαμέρισμα, Επαγγελματική στέγη, Γη κ.λπ.).',
  '7. Στη στήλη 17 συμπληρώνεται υποχρεωτικά το είδος της μίσθωσης και η χρήση του μισθίου (π.χ. εκμίσθωση κατοικίας, βραχυχρόνια μίσθωση, δωρεάν παραχώρηση, ιδιοχρησιμοποίηση).',
  '8. Στη στήλη 18 συμπληρώνεται ο αριθμός παροχής ρεύματος (ΔΕΗ) του ακινήτου· για μη ηλεκτροδοτούμενο ακίνητο σημειώνεται η αντίστοιχη ένδειξη.',
  '9. Στη στήλη 19 συμπληρώνεται ο αριθμός της «Δήλωσης Πληροφοριακών Στοιχείων Μίσθωσης Ακίνητης Περιουσίας».',
  '10. Στις στήλες 13, 14 και 15 αναγράφεται το ακαθάριστο εισόδημα ανάλογα με το είδος μίσθωσης/χρήσης (εκμίσθωση, δωρεάν παραχώρηση, ιδιοχρησιμοποίηση). Στη στήλη 16 αναγράφονται τυχόν ανείσπρακτα εισοδήματα.',
  '11. Τα «Συμπληρωματικά Στοιχεία Ακίνητης Περιουσίας» (συνιδιοκτήτες, υπεκμισθώσεις, μεταβιβάσεις) συμπληρώνονται όταν συντρέχει τέτοια περίπτωση, με τα αντίστοιχα στοιχεία και ΑΦΜ ανά συνιδιοκτήτη.',
  '12. Αν δεν επαρκεί μία αναλυτική κατάσταση για όλα τα ακίνητα, χρησιμοποιούνται περισσότερα έντυπα Ε2.',
];
