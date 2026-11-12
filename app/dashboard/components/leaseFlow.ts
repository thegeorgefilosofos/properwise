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
import type { LeaseCategory } from './TabTenantHelpers';

// ── 1. Ο ΙΔΙΟΣ ΑΝΘΡΩΠΟΣ ────────────────────────────────────────────────────

const digits = (v: string | null | undefined) => String(v ?? '').replace(/\D+/g, '');

/** Όνομα για σύγκριση: χωρίς τόνους, πεζά, ένα κενό, τελικό σίγμα = σίγμα. */
export const normName = (v: string | null | undefined): string =>
  String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/ς/g, 'σ').replace(/\s+/g, ' ').trim();

export interface Person { name?: string | null; afm?: string | null }

/**
 * Το πρόσωπο του μισθωτηρίου είναι ο ίδιος με τον καταχωρημένο ενοικιαστή;
 *
 * Το ΑΦΜ αποφασίζει όταν το έχουν και οι δύο: ίδιο όνομα με άλλο ΑΦΜ είναι
 * άλλος άνθρωπος (συνωνυμία), άλλη ορθογραφία με ίδιο ΑΦΜ είναι ο ίδιος. Όταν
 * λείπει από τη μία πλευρά, κρίνει το ονοματεπώνυμο. Κενό όνομα δεν ταιριάζει
 * με τίποτα: η αμφιβολία πάει στην ερώτηση, όχι στην αντικατάσταση.
 */
export function samePerson(a: Person, b: Person): boolean {
  const afmA = digits(a.afm), afmB = digits(b.afm);
  if (afmA && afmB) return afmA === afmB;
  const nA = normName(a.name), nB = normName(b.name);
  return !!nA && nA === nB;
}

/** Η «Χρήση» του μισθωτηρίου γίνεται ο υποχρεωτικός τύπος μίσθωσης του ενοικιαστή. */
export const leaseCategoryOf = (use: 'residence' | 'professional'): LeaseCategory =>
  use === 'professional' ? 'commercial' : 'residential';

// ── 2. ΔΗΛΩΣΗ ΓΙΑ ΤΗΝ ΤΡΕΧΟΥΣΑ ΜΙΣΘΩΣΗ ────────────────────────────────────

export interface DeclRecord { at: string; tenantId?: string | null }
export interface CurrentLease { tenantId?: string | null; leaseStart?: string | null }

/**
 * Η καταγραμμένη δήλωση αφορά την τρέχουσα μίσθωση;
 *
 * Ο ΚΑΝΟΝΑΣ ΕΙΝΑΙ ΕΝΑΣ, γιατί τον ρωτούν δύο οθόνες: η Επισκόπηση (υπενθύμιση)
 * και η Δήλωση μίσθωσης (ένδειξη «καταγράφηκε»). Με δύο κανόνες, η μία έλεγε
 * «έγινε» και η άλλη «εκκρεμεί» για την ίδια μίσθωση.
 *
 *  - Καταγραφή για ΑΛΛΟΝ ενοικιαστή (όπου γράφτηκε το αναγνωριστικό) δεν μετρά.
 *  - Με ημερομηνία έναρξης: μετρά καταγραφή από την ίδια μέρα και μετά. Κάθε νέα
 *    μίσθωση θέλει νέα δήλωση.
 *  - Χωρίς ημερομηνία έναρξης: μετρά μόνο αν γράφτηκε για αυτόν ακριβώς τον
 *    ενοικιαστή.
 */
export function declaredForLease(rec: DeclRecord | null | undefined, lease: CurrentLease): boolean {
  if (!rec?.at) return false;
  if (rec.tenantId && lease.tenantId && rec.tenantId !== lease.tenantId) return false;
  const start = String(lease.leaseStart ?? '').slice(0, 10);
  if (start) return rec.at.slice(0, 10) >= start;
  return !!rec.tenantId && rec.tenantId === lease.tenantId;
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
