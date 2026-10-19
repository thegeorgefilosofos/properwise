// ═══════════════════════════════════════════════════════════════════════════
// ΣΑΡΩΜΕΝΟ ΜΙΣΘΩΤΗΡΙΟ: ΠΟΙΟΝ ΑΦΟΡΑ ΚΑΙ ΤΙ ΑΛΛΑΖΕΙ
// ─────────────────────────────────────────────────────────────────────────
// ΔΥΟ ΣΦΑΛΜΑΤΑ ΜΕ ΤΗΝ ΙΔΙΑ ΡΙΖΑ. Η καταχώρηση συνέκρινε το όνομα του χαρτιού
// με τον ΠΡΩΤΟ τρέχοντα ενοικιαστή γράμμα προς γράμμα. Μετά έγραφε ό,τι
// διάβασε πάνω του.
//
//   · Το μισθωτήριο γράφει «ΠΑΠΑΔΟΠΟΥΛΟΣ ΓΕΩΡΓΙΟΣ», η εφαρμογή «Γεώργιος
//     Παπαδόπουλος». Δεν ταίριαζαν, οπότε προστίθετο ΔΕΥΤΕΡΟΣ ενοικιαστής
//     χωρίς να ρωτηθεί κανείς. Το ακίνητο είχε πια δύο τρέχοντες μισθωτές και
//     διπλές δόσεις κάθε μήνα: στο ταμείο, στις οφειλές, στο Ε2. Το ΑΦΜ του
//     χαρτιού, που ταυτίζει τον άνθρωπο χωρίς αμφιβολία, δεν κοιταζόταν.
//
//   · Οταν ταίριαζαν, το ΠΑΛΙΟ μισθωτήριο που σαρωνόταν για αρχειοθέτηση
//     γύριζε πίσω το ενοίκιο μετά την αναπροσαρμογή, έβαζε λήξη στο παρελθόν
//     και κατέβαζε την έναρξη τρία χρόνια. Οι δόσεις γεννιόνταν από την παλιά
//     έναρξη: τριάντα έξι απλήρωτες, όλες ληξιπρόθεσμες.
//
// ΟΙ ΚΑΝΟΝΕΣ. Πρώτα το ΑΦΜ. Μετά το όνομα, ανεξάρτητα από σειρά λέξεων,
// τόνους και κεφαλαία. Οταν υπάρχει τρέχων ενοικιαστής και δεν ταιριάζει
// κανείς, η απάντηση είναι ΕΡΩΤΗΣΗ, όχι νέα γραμμή. Και οι όροι της μίσθωσης
// (ενοίκιο, ημερομηνίες, εγγύηση) αλλάζουν μόνο από ΝΕΟΤΕΡΟ χαρτί· το παλιό
// συμπληρώνει μόνο ό,τι λείπει, όπως το παλιό ασφαλιστήριο (`replaceIfNewer`).
//
// Καθαρή λογική, χωρίς βάση: τη διαβάζει η καταχώρηση (scanDoc.ts).
// ═══════════════════════════════════════════════════════════════════════════
import { afmDigits, isValidAfm } from '@/lib/core/greek';
import { fillOnlyEmpty, stripEmpty } from '@/lib/core/prefill';

/** Ο ενοικιαστής του ακινήτου, όσο χρειάζεται για το ταίριασμα και τη σύγκριση. */
export interface TenantOnFile {
  id: string;
  full_name?: string | null;
  afm?: string | null;
  monthly_rent?: number | null;
  rent_due_day?: number | null;
  lease_start?: string | null;
  lease_end?: string | null;
  deposit_amount?: number | null;
  notes?: string | null;
}

/**
 * Οι στήλες της μίας ανάγνωσης: όσες κρίνουν ποιος είναι και όσες μπορεί να
 * γράψει η σάρωση (`planDocSave`, μισθωτήριο), ώστε το «μόνο τα κενά» να ξέρει
 * τι υπάρχει.
 */
export const TENANT_MATCH_COLUMNS = 'id,full_name,afm,monthly_rent,rent_due_day,lease_start,lease_end,deposit_amount,notes';

/** Το όνομα ως σύνολο λέξεων: χωρίς τόνους, πεζά, «ς» ως «σ», σε σταθερή σειρά. */
export function nameKey(name: unknown): string {
  return String(name ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/ς/g, 'σ').split(/[^\p{L}\p{N}]+/u).filter(Boolean).sort().join(' ');
}

/** «ΠΑΠΑΔΟΠΟΥΛΟΣ ΓΕΩΡΓΙΟΣ» και «Γεώργιος Παπαδόπουλος» είναι το ίδιο όνομα. */
export function sameName(a: unknown, b: unknown): boolean {
  const x = nameKey(a);
  return !!x && x === nameKey(b);
}

export type TenantMatch<T extends TenantOnFile> =
  | { kind: 'same'; tenant: T; by: 'afm' | 'name' }
  | { kind: 'new' }
  | { kind: 'ask'; current: T[] };

/**
 * Ποιον από τους τρέχοντες ενοικιαστές αφορά το χαρτί.
 *
 * Το ίδιο όνομα με ΔΙΑΦΟΡΕΤΙΚΟ έγκυρο ΑΦΜ δεν είναι ο ίδιος άνθρωπος (πατέρας
 * και γιος, συνονόματοι): τότε ρωτάμε. Κανένας τρέχων: νέος ενοικιαστής, όπως
 * πάντα. Κανένα ταίριασμα με τρέχοντες: ερώτηση, γιατί μόνο ο ιδιοκτήτης ξέρει
 * αν άλλαξε μισθωτής ή αν η εφαρμογή γράφει αλλιώς το ίδιο όνομα.
 */
export function matchScannedTenant<T extends TenantOnFile>(
  paper: { full_name?: unknown; afm?: unknown },
  current: readonly T[],
): TenantMatch<T> {
  if (!current.length) return { kind: 'new' };
  const afm = isValidAfm(String(paper.afm ?? '')) ? afmDigits(String(paper.afm)) : '';
  if (afm) {
    const byAfm = current.find(t => afmDigits(t.afm) === afm);
    if (byAfm) return { kind: 'same', tenant: byAfm, by: 'afm' };
  }
  const byName = current.find(t => sameName(t.full_name, paper.full_name)
    && !(afm && isValidAfm(t.afm) && afmDigits(t.afm) !== afm));
  if (byName) return { kind: 'same', tenant: byName, by: 'name' };
  return { kind: 'ask', current: [...current] };
}

/** Νεότερο, παλαιότερο ή ίδιο με τη μίσθωση που ήδη ισχύει; */
export type PaperAge = 'newer' | 'older' | 'same';

const day = (v: unknown): string => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : '');

/**
 * Η ηλικία του χαρτιού, από τις ημερομηνίες της μίσθωσης.
 *
 * Παλαιότερη έναρξη Ή παλαιότερη λήξη: παλιό χαρτί, ακόμη κι αν η άλλη
 * ημερομηνία είναι νεότερη (η αμφιβολία δεν αλλάζει ενοίκιο). Χωρίς
 * ημερομηνίες να συγκριθούν: «ίδιο», δηλαδή μόνο συμπλήρωση.
 */
export function leasePaperAge(
  paper: { lease_start?: unknown; lease_end?: unknown },
  cur: { lease_start?: unknown; lease_end?: unknown },
): PaperAge {
  const cmp = (a: string, b: string) => (!a || !b ? 0 : a < b ? -1 : a > b ? 1 : 0);
  const s = cmp(day(paper.lease_start), day(cur.lease_start));
  const e = cmp(day(paper.lease_end), day(cur.lease_end));
  if (s < 0 || e < 0) return 'older';
  if (s > 0 || e > 0) return 'newer';
  return 'same';
}

/** Οι όροι της μίσθωσης: αλλάζουν ΜΟΝΟ από νεότερο χαρτί. */
const LEASE_TERMS = ['monthly_rent', 'rent_due_day', 'lease_start', 'lease_end', 'deposit_amount'] as const;

export interface LeaseUpdate {
  /** Ό,τι γράφεται στον ενοικιαστή. Κενό: τίποτα δεν αλλάζει. */
  patch: Record<string, unknown>;
  age: PaperAge;
}

/**
 * Τι γράφει το σαρωμένο μισθωτήριο στον ΙΔΙΟ ενοικιαστή.
 *
 * Νεότερο χαρτί (ανανέωση, νέα σύμβαση): οι όροι του αντικαθιστούν τους
 * τρέχοντες, εκτός αν ο ιδιοκτήτης είπε να μείνουν (`keepTerms`). Κάθε άλλο
 * πεδίο —όνομα, ΑΦΜ, σημειώσεις— συμπληρώνεται μόνο αν λείπει: η εφαρμογή
 * γράφει το όνομα όπως το θέλει ο ιδιοκτήτης και οι σημειώσεις του δεν σβήνουν
 * από μια σάρωση. Παλαιότερο ή ίδιο: μόνο τα κενά. Οτι δεν αλλάζει τιμή δεν
 * γράφεται.
 */
export function leaseUpdate(
  paper: Record<string, unknown>, cur: Record<string, unknown>, opts: { keepTerms?: boolean } = {},
): LeaseUpdate {
  const read = stripEmpty(paper) as Record<string, unknown>;
  const age = leasePaperAge(read, cur);
  const patch: Record<string, unknown> = { ...fillOnlyEmpty(read, cur) };
  if (age === 'newer' && !opts.keepTerms) {
    for (const k of LEASE_TERMS) if (k in read) patch[k] = read[k];
  }
  for (const k of Object.keys(patch)) if (patch[k] === cur[k]) delete patch[k];
  return { patch, age };
}

/** Οι όροι από τους οποίους γεννιούνται τα χρήματα κάθε μήνα. */
const MONEY_TERMS = ['monthly_rent', 'lease_start'] as const;

/**
 * Ποιοι όροι που ΗΔΗ ισχύουν θα άλλαζαν: ενοίκιο ή έναρξη με τιμή στον
 * ενοικιαστή και άλλη τιμή στο χαρτί. Από αυτά γεννιούνται οι δόσεις, οπότε
 * δεν αλλάζουν από μια ανάγνωση χωρίς να το πει ο ιδιοκτήτης: μια λάθος
 * ανάγνωση της χρονιάς («2029» αντί για «2026») θα έκανε το παλιό χαρτί
 * «νεότερο». Η συμπλήρωση ενός κενού δεν είναι αλλαγή και δεν ρωτά.
 */
export function changedTerms(patch: Record<string, unknown>, cur: Record<string, unknown>): { key: (typeof MONEY_TERMS)[number]; from: unknown; to: unknown }[] {
  const filled = (v: unknown) => v != null && v !== '';
  return MONEY_TERMS.filter(k => k in patch && filled(cur[k])).map(k => ({ key: k, from: cur[k], to: patch[k] }));
}
