// ═══════════════════════════════════════════════════════════════════════════
// leaseFlow — οι αποφάσεις της διαδρομής μίσθωσης, χωρίς React και χωρίς βάση.
//
// Τρεις ερωτήσεις που ζούσαν μέσα σε συστατικά και απαντιούνταν λάθος:
//
//   1. «Είναι ο ίδιος άνθρωπος;» Το μισθωτήριο για νέο πρόσωπο ΞΑΝΑΕΓΡΑΦΕ τη
//      γραμμή του τρέχοντος ενοικιαστή: ο Α γινόταν Β και οι πληρωμές του Α
//      φαίνονταν πλέον στο όνομα του Β.
//   2. «Δηλώθηκε η ΤΡΕΧΟΥΣΑ μίσθωση;» Η Δήλωση μίσθωσης έλεγε «υποβλήθηκε»
//      για πάντα ανά ακίνητο, ενώ η Επισκόπηση ζητούσε νέα δήλωση για κάθε νέα
//      μίσθωση. Ο χρήστης δεν είχε πού να την καταγράψει.
//   3. «Πού είναι το PDF του μισθωτηρίου;» Το ωμό όνομα αρχείου έμπαινε στο
//      κλειδί αποθήκευσης· ένα ελληνικό όνομα δεν ανέβαινε.
// ═══════════════════════════════════════════════════════════════════════════
import { uploadPath } from '@/lib/core/uploadPath';
import { athensToday } from '@/lib/core/time';
import type { LeaseCategory } from './TabTenantHelpers';

// ── 1. Ο ΙΔΙΟΣ ΑΝΘΡΩΠΟΣ ────────────────────────────────────────────────────

const digits = (v: string | null | undefined) => String(v ?? '').replace(/\D+/g, '');

/** Όνομα για σύγκριση: χωρίς τόνους, πεζά, ένα κενό, τελικό σίγμα = σίγμα. */
export const normName = (v: string | null | undefined): string =>
  String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/ς/g, 'σ').replace(/\s+/g, ' ').trim();

export interface Person { name?: string | null; afm?: string | null }

/** Λέξεις του ονόματος που ξεχωρίζουν πρόσωπο: χωρίς αρχικά («Γ.») και μόρια. */
const nameWords = (v: string | null | undefined): Set<string> =>
  new Set(normName(v).split(/[\s.,-]+/).filter(w => w.length > 2));

/**
 * Τα δύο ονόματα είναι ΣΑΦΩΣ άλλοι άνθρωποι; Ναι, όταν και τα δύο υπάρχουν και
 * δεν μοιράζονται καμία λέξη. «Γ. Παπαδοπουλος» και «Γιώργος Παπαδόπουλος» δεν
 * διαφέρουν σαφώς· «Μαρία Νικολάου» και «Γιώργος Παπαδόπουλος» διαφέρουν.
 */
export function namesClearlyDiffer(a: string | null | undefined, b: string | null | undefined): boolean {
  const A = nameWords(a), B = nameWords(b);
  if (!A.size || !B.size) return false;
  for (const w of A) if (B.has(w)) return false;
  return true;
}

/**
 * Το πρόσωπο του μισθωτηρίου είναι ο ίδιος με τον καταχωρημένο ενοικιαστή;
 *
 * Άλλο ΑΦΜ σημαίνει άλλος άνθρωπος ακόμη και με ίδιο όνομα (συνωνυμία). Ίδιο ΑΦΜ
 * σημαίνει ο ίδιος, ΕΚΤΟΣ αν τα ονόματα διαφέρουν σαφώς: το παράθυρο
 * μισθωτηρίου προσυμπληρώνει το ΑΦΜ του τρέχοντος ενοικιαστή, οπότε όποιος
 * έγραφε μόνο το όνομα του νέου άφηνε το ΑΦΜ του παλιού και το ΑΦΜ μόνο του
 * «αποφάσιζε» αντικατάσταση. Όταν λείπει ΑΦΜ από τη μία πλευρά, κρίνει το
 * ονοματεπώνυμο. Κάθε αμφιβολία πάει στην ερώτηση, όχι στην αντικατάσταση.
 */
export function samePerson(a: Person, b: Person): boolean {
  const afmA = digits(a.afm), afmB = digits(b.afm);
  if (afmA && afmB) return afmA === afmB && !namesClearlyDiffer(a.name, b.name);
  const nA = normName(a.name), nB = normName(b.name);
  return !!nA && nA === nB;
}

/** Ίδιο ΑΦΜ σε δύο διαφορετικά ονόματα: σχεδόν πάντα ξεχασμένη προσυμπλήρωση. */
export const sameAfm = (a: Person, b: Person): boolean =>
  !!digits(a.afm) && digits(a.afm) === digits(b.afm);

/** Η προηγούμενη μέρα μιας ημερομηνίας YYYY-MM-DD, χωρίς ζώνη ώρας. */
export function dayBefore(iso: string): string {
  const d = new Date(String(iso).slice(0, 10) + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Η «Χρήση» του μισθωτηρίου γίνεται ο υποχρεωτικός τύπος μίσθωσης του ενοικιαστή. */
export const leaseCategoryOf = (use: 'residence' | 'professional'): LeaseCategory =>
  use === 'professional' ? 'commercial' : 'residential';

// ── 2. ΔΗΛΩΣΗ ΓΙΑ ΤΗΝ ΤΡΕΧΟΥΣΑ ΜΙΣΘΩΣΗ ────────────────────────────────────

export interface DeclRecord { at: string; tenantId?: string | null; leaseStart?: string | null }

/** Η γραμμή του activity_log ως καταγραφή δήλωσης. Μία ανάγνωση για Επισκόπηση και Δήλωση. */
export function declRecordOf(row: { created_at?: unknown; metadata?: unknown } | null | undefined): DeclRecord | null {
  if (!row || typeof row.created_at !== 'string') return null;
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  return {
    at: row.created_at,
    tenantId: typeof meta.tenant_id === 'string' ? meta.tenant_id : null,
    leaseStart: typeof meta.lease_start === 'string' ? meta.lease_start : null,
  };
}
export interface CurrentLease { tenantId?: string | null; leaseStart?: string | null }

/**
 * Η καταγραμμένη δήλωση αφορά την τρέχουσα μίσθωση;
 *
 * Ο ΚΑΝΟΝΑΣ ΕΙΝΑΙ ΕΝΑΣ, γιατί τον ρωτούν δύο οθόνες: η Επισκόπηση (υπενθύμιση)
 * και η Δήλωση μίσθωσης (ένδειξη «καταγράφηκε»). Με δύο κανόνες, η μία έλεγε
 * «έγινε» και η άλλη «εκκρεμεί» για την ίδια μίσθωση.
 *
 *  - Καταγραφή με αναγνωριστικό ενοικιαστή: μετρά για τον ίδιο, ΑΣΧΕΤΩΣ
 *    ημερομηνίας. Η δήλωση υποβάλλεται συχνά στην υπογραφή, πριν την έναρξη·
 *    ο κανόνας «από την έναρξη και μετά» την έκρινε ανύπαρκτη, η οθόνη έβγαζε
 *    σφάλμα και ο χρήστης την ξανακατέγραφε. Αν η καταγραφή κράτησε και την
 *    έναρξη, άλλη έναρξη (ανανέωση με τον ίδιο) θέλει νέα δήλωση.
 *  - Για άλλον ενοικιαστή δεν μετρά.
 *  - Παλιές καταγραφές, χωρίς αναγνωριστικό: μετρά καταγραφή από την ημέρα
 *    έναρξης και μετά, με την ημέρα της ΑΘΗΝΑΣ (όχι UTC: δήλωση στις 01:30 της
 *    ημέρας έναρξης είναι ακόμη η προηγούμενη μέρα σε UTC).
 */
export function declaredForLease(rec: DeclRecord | null | undefined, lease: CurrentLease): boolean {
  if (!rec?.at) return false;
  const start = String(lease.leaseStart ?? '').slice(0, 10);
  if (rec.tenantId && lease.tenantId) {
    if (rec.tenantId !== lease.tenantId) return false;
    const recStart = String(rec.leaseStart ?? '').slice(0, 10);
    return !recStart || !start || recStart === start;
  }
  if (!start) return false;
  const t = new Date(rec.at);
  const day = isNaN(t.getTime()) ? rec.at.slice(0, 10) : athensToday(t);
  return day >= start;
}

// ── 3. ΤΟ PDF ΤΟΥ ΜΙΣΘΩΤΗΡΙΟΥ ──────────────────────────────────────────────

export interface LeaseDocRow { id: string; lease_doc_name?: string | null; lease_doc_url?: string | null }

/** Ο φάκελος του ενοικιαστή στο `lease-documents`. Τον σαρώνει και το delete_tenant. */
const folderOf = (userId: string, tenantId: string) => `${userId}/${tenantId}/`;

/** Νέο κλειδί αποθήκευσης: ασφαλές, μοναδικό, μέσα στον φάκελο του ενοικιαστή. */
export const leaseDocKey = (userId: string, tenantId: string, fileName: string, now?: Date): string =>
  uploadPath(fileName, folderOf(userId, tenantId), now);

/**
 * Πού βρίσκεται το PDF.
 *
 * ΝΕΑ ΑΡΧΕΙΑ: το κλειδί γράφεται στο `lease_doc_url` και το `lease_doc_name`
 * κρατά το όνομα όπως το διάλεξε ο χρήστης, για να το δείχνει η οθόνη.
 * ΠΑΛΙΑ ΑΡΧΕΙΑ: δεν έχουν `lease_doc_url`, το κλειδί ήταν φάκελος + όνομα.
 * Μόνο κλειδί μέσα στον φάκελο του ενοικιαστή γίνεται δεκτό.
 */
export function leaseDocPath(userId: string, t: LeaseDocRow): string | null {
  const folder = folderOf(userId, t.id);
  if (t.lease_doc_url && t.lease_doc_url.startsWith(folder)) return t.lease_doc_url;
  return t.lease_doc_name ? folder + t.lease_doc_name : null;
}

// ── 4. Η ΓΡΑΜΜΗ ΤΟΥ ΕΝΟΙΚΙΑΣΤΗ ΑΠΟ ΤΟ ΜΙΣΘΩΤΗΡΙΟ ──────────────────────────

export interface LeaseFacts {
  name: string; afm: string; use: 'residence' | 'professional';
  monthlyRent: number; deposit: number; start: string; end: string; paymentDay: number;
}

/**
 * Ό,τι γράφει το μισθωτήριο στην καρτέλα ενοικιαστή.
 *
 * ΙΔΙΟ ΣΧΗΜΑ ΜΕ ΤΟ TabTenant: ο τύπος μίσθωσης (υποχρεωτικός εκεί) από τη
 * «Χρήση» και η ημέρα πληρωμής στο `rent_due_day`, με το ίδιο όριο 1 έως 28.
 *
 * ΣΤΗΝ ΕΝΗΜΕΡΩΣΗ ΤΟ ΚΕΝΟ ΔΕΝ ΣΒΗΝΕΙ. Μισθωτήριο χωρίς ΑΦΜ ή χωρίς εγγύηση για
 * τον ίδιο ενοικιαστή έγραφε `null` πάνω στα στοιχεία που υπήρχαν ήδη.
 */
export function tenantPatchFromLease(f: LeaseFacts, mode: 'insert' | 'update') {
  const afm = f.afm.trim();
  const patch: {
    full_name: string; lease_category: LeaseCategory; monthly_rent: number;
    lease_start: string; lease_end: string; rent_due_day: number;
    afm?: string | null; deposit_amount?: number | null;
  } = {
    full_name: f.name.trim(), lease_category: leaseCategoryOf(f.use), monthly_rent: f.monthlyRent,
    lease_start: f.start, lease_end: f.end,
    rent_due_day: Math.min(Math.max(1, Math.round(f.paymentDay) || 1), 28),
  };
  if (afm || mode === 'insert') patch.afm = afm || null;
  if (f.deposit > 0 || mode === 'insert') patch.deposit_amount = f.deposit > 0 ? f.deposit : null;
  return patch;
}
