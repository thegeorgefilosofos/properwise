// ═══════════════════════════════════════════════════════════════════════════
// scanDoc — Η ΡΟΗ «ΦΩΤΟΓΡΑΦΙΣΕ → ΚΑΤΑΧΩΡΗΘΗΚΕ», σε ένα σημείο.
//
// ΓΙΑΤΙ ΕΔΩ ΚΑΙ ΟΧΙ ΣΕ COMPONENT. Τρεις οθόνες σάρωναν έγγραφα με τρεις
// διαφορετικές διαδρομές: το DocumentScan έγραφε σε 8 πίνακες, το Αρχείο μόνο
// αρχειοθετούσε (και ξαναδιόρθωνε μόνο του τον φάκελο) και τα modals έκαναν
// μόνο prefill. Ο ίδιος λογαριασμός ΔΕΗ κατέληγε σε διαφορετικό φάκελο ανάλογα
// με το πού τον ανέβασες. Εδώ υπάρχει ΜΙΑ υλοποίηση, χωρίς React, ώστε κάθε
// οθόνη (Αρχείο, Λίστα ελέγχου, Επαφές, Ενοικιαστής) να καλεί το ίδιο πράγμα.
//
// ΔΗΜΟΣΙΑ ΥΠΟΓΡΑΦΗ — ΣΤΑΘΕΡΗ, τη καλούν άλλες οθόνες:
//   scanFile(file)                → τι είναι το χαρτί (έγγραφο ή φωτογραφία) + πεδία
//   commitScannedDoc(input)       → το γράφει σε ΟΛΟΥΣ τους σωστούς πίνακες
//   archiveScannedFile(input)     → μόνο αρχειοθέτηση (φωτογραφίες, μαζικό ανέβασμα)
//   scanDocument(file)            → μόνο ανάγνωση εγγράφου (auto-prefill σε φόρμες)
//
// Η καθαρή λογική (τι είδος είναι, τι λείπει, πού γράφεται, ποιον λογαριασμό
// εξοφλεί) ζει στο lib/billing/documents.ts και lib/billing/parse.ts και είναι
// 100% δοκιμασμένη. Εδώ μένουν μόνο οι κλήσεις δικτύου/βάσης.
// ═══════════════════════════════════════════════════════════════════════════
import { createClient } from '@/lib/supabase/client';
import { ensureDpa } from '@/lib/legal/dpa';
import * as properties from '@/lib/data/properties';
import * as billStore from '@/lib/data/bills';
import * as tenantStore from '@/lib/data/tenants';
import { syncInstalments } from './rentInstalments';
import type { Tenant } from './TabTenantTypes';
import * as expenses from '@/lib/data/expenses';
import * as calendar from '@/lib/data/calendar';
// Οι ρυθμίσεις ανά ενότητα έχουν ένα σπίτι: lib/data/settings.
import * as settings from '@/lib/data/settings';
import {
  classifyDocType, planDocSave, normalizeScannedDoc, archiveCategoryFor, isDocumentary,
  SCAN_NUM_KEYS, SCAN_MAX_LINES, PROPERTY_TARGET,
  type ScannedDoc, type ArchivePlan, type DocLine,
} from '@/lib/billing/documents';
import { SYSTEM_PROMPT, PHOTO_CATEGORIES, PHOTO_AI_CATEGORIES } from '@/lib/billing/scanPrompt';
import { atakDigits } from '@/lib/property/atak';
import { fillOnlyEmpty, stripEmpty } from '@/lib/core/prefill';
import { athensToday } from '@/lib/core/time';
import { saved, savedData } from '@/components/dbWrite';
import { uploadPath } from '@/lib/core/uploadPath';
// Το Αρχείο έχει ένα σπίτι: lib/data/documents.
import * as documents from '@/lib/data/documents';
import { navLabel } from '@/lib/nav/labels';
import { findDuplicates, duplicateNotice, withoutOpenBillDebts, type ExpenseLike } from '@/lib/expenses/duplicates';
import {
  matchScannedTenant, leaseUpdate, changedTerms, TENANT_MATCH_COLUMNS, type TenantOnFile, type TenantMatch,
} from '@/lib/tenant/scanMatch';
import { fe } from '@/lib/core/format';
import {
  matchPaymentToBills, providerFromBillName,
  type MatchCandidate, type MatchResult,
} from '@/lib/billing/parse';
import { MSG } from '@/lib/core/dbError';

// ── Το prompt αναγνώρισης (ΕΝΑ, κοινό) ─────────────────────────────────────
// Ζει στο lib/billing/scanPrompt.ts, χτισμένο από το ίδιο λεξιλόγιο με τη φόρμα
// (είδη, υποτύποι, κατηγορίες). Επανεξάγεται εδώ για τους ιστορικούς αναγνώστες.
export { SYSTEM_PROMPT };

// ── Φωτογραφία ακινήτου (vision) — δεν είναι έγγραφο, είναι τεκμηρίωση χώρου ──
// Οι κατηγορίες ζουν δίπλα στο prompt της ανάγνωσης (lib/billing/scanPrompt.ts),
// που τις ζητά πλέον κι αυτό· επανεξάγονται για τους αναγνώστες τους.
export { PHOTO_CATEGORIES };
export const PHOTO_SYSTEM_PROMPT = `Είσαι σύστημα ταξινόμησης φωτογραφιών ακινήτου. Εξέτασε τη φωτογραφία και επίστρεψε ΑΥΣΤΗΡΑ ΜΟΝΟ JSON, χωρίς άλλο κείμενο:
{"category":"<μία από: ${PHOTO_AI_CATEGORIES.join(' | ')}>","title":"<σύντομη ελληνική περιγραφή χώρου/θέματος, π.χ. Σαλόνι, Κουζίνα, Μπάνιο, Υπνοδωμάτιο, Μπαλκόνι>"}
Κανόνες κατηγορίας:
- Εμφανής φθορά/ζημιά/υγρασία/ρωγμή/σπασμένο → "Ζημιά / Φθορά".
- Εργασίες/ανακαίνιση σε εξέλιξη (μπάζα, εργαλεία, γυμνοί τοίχοι) → "Ανακαίνιση".
- Εξωτερικός χώρος/μπαλκόνι/κήπος/αυλή/πρόσοψη/πυλωτή → "Εξωτερικοί Χώροι".
- Κανονικός εσωτερικός χώρος σε καλή κατάσταση → "Κατάσταση Ακινήτου".
- Αν δεν σχετίζεται με ακίνητο → "Άλλο".`;

// ΤΟ ΟΡΙΟ ΤΟΥ ΠΕΛΑΤΗ ΗΤΑΝ ΜΕΓΑΛΥΤΕΡΟ ΑΠΟ ΤΟΥ ΔΙΑΚΟΜΙΣΤΗ ΚΑΙ ΤΟ ΜΗΝΥΜΑ ΕΛΕΓΕ
// ΛΑΘΟΣ ΑΙΤΙΑ. Το base64 φουσκώνει το αρχείο κατά ένα τρίτο: το ταβάνι των 12
// MiB στο σώμα του αιτήματος αντιστοιχεί σε 9,00 MiB αρχείου. Με όριο 10 στον
// πελάτη, κάθε φωτογραφία 9 ως 10 MB — δηλαδή μια συνηθισμένη λήψη σύγχρονου
// κινητού — περνούσε τον έλεγχο, γύριζε 413 από τον διακομιστή και ο χρήστης
// διάβαζε «η υπηρεσία σάρωσης δεν είναι διαθέσιμη» για αρχείο που ήταν απλώς
// μεγάλο. Ξαναδοκίμαζε το ίδιο αρχείο, στο άπειρο.
export const MAX_SCAN_MB = 8;

// Τα αριθμητικά κλειδιά ζουν δίπλα στο σχήμα (lib/billing/documents.ts:
// SCAN_NUM_KEYS), δεμένα στον τύπο του ScannedDoc: ένα λάθος όνομα σκάει στη
// μεταγλώττιση και το τεστ ελέγχει ότι περιέχουν κάθε αριθμό της φόρμας.

/** Η ημερομηνία του χαρτιού είναι παλαιότερη από ό,τι έχει ήδη η βάση. */
const isOlder = (next: string, cur: unknown): boolean =>
  typeof cur === 'string' && /^\d{4}-\d{2}-\d{2}/.test(cur) && next < cur.slice(0, 10);

// Ανθεκτική μετατροπή αριθμού (χειρίζεται «1.200,50», «1,234.56», «€», κενά).
const numify = (v: unknown): number | undefined => {
  if (typeof v === 'number') return isFinite(v) ? v : undefined;
  if (typeof v !== 'string') return undefined;
  const raw = v.replace(/[€\s]/g, '');
  if (!/\d/.test(raw)) return undefined;
  const clean = /,\d{1,2}$/.test(raw) ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
  const n = parseFloat(clean.replace(/[^0-9.\-]/g, ''));
  return isFinite(n) ? n : undefined;
};

// ══════════════════════════════════════════════════════════════════════════
// ΤΙ ΔΙΑΒΑΖΕΤΑΙ, ΓΡΑΜΜΕΝΟ ΜΙΑ ΦΟΡΑ
//
// Ο πάροχος δέχεται εικόνα μόνο σε JPEG, PNG, GIF ή WEBP και έγγραφο μόνο σε
// PDF. Εδώ όμως ΚΑΘΕ αρχείο που δεν ήταν PDF έφευγε ως «εικόνα» με τον τύπο του
// (text/csv, Excel, image/heic): ο πάροχος απαντούσε 400 και ο χρήστης διάβαζε
// «Η υπηρεσία ανάγνωσης δεν είναι διαθέσιμη τώρα. Δοκίμασε ξανά σε λίγο» για
// αρχείο που δεν θα διαβαζόταν ποτέ. Και κάθε προσπάθεια μετρούσε σάρωση.
// Το πλακίδιο υποσχόταν «Excel», το πεδίο δεχόταν .ods που μετά απέρριπτε.
//
// Τώρα: η λίστα ζει εδώ, το `accept` του πεδίου τη διαβάζει από εδώ και ό,τι
// δεν είναι μέσα σταματά ΠΡΙΝ φύγει, με μήνυμα που λέει τι να κάνει.
//
// ΚΑΙ ΜΟΝΟ Ο,ΤΙ ΧΩΡΑΕΙ ΣΤΟΝ ΦΑΚΕΛΟ. Η σάρωση αρχειοθετεί το πρωτότυπο, οπότε
// ένας τύπος που διαβάζεται αλλά δεν αποθηκεύεται (GIF) θα έβγαζε κάθε φορά
// «Δεν ενημερώθηκε: Φάκελος». Η τομή των δύο λιστών: JPEG, PNG, WEBP, PDF.
export const SCAN_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
const SCAN_EXT: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf',
};
/** Το `accept` του πεδίου αρχείου: ό,τι δεν διαβάζεται δεν προσφέρεται καν. */
export const SCAN_ACCEPT = [...SCAN_TYPES, ...Object.keys(SCAN_EXT).map(e => `.${e}`)].join(',');

/**
 * ΤΙ ΚΡΑΤΑ Ο ΦΑΚΕΛΟΣ: ό,τι δέχεται ο κάδος `property-files`. Αντίγραφο του
 * `allowed_mime_types` (supabase/migrations/20260724091000_storage_upload_limits.sql,
 * επιβεβαιωμένο με SELECT στην παραγωγή στις 19/10/2026). Το Αρχείο υποσχόταν
 * «Word ή Excel» και το πεδίο τα δεχόταν: ο κάδος τα απέρριπτε και ο χρήστης
 * έβλεπε «Δεν αποθηκεύτηκε. Δοκίμασε ξανά.» σε κάθε προσπάθεια. Το HEIC δεν
 * διαβάζεται, αλλά αποθηκεύεται.
 */
export const FOLDER_TYPES = [...SCAN_TYPES, 'image/heic', 'image/heif'] as const;
const FOLDER_EXT: Record<string, string> = { ...SCAN_EXT, heic: 'image/heic', heif: 'image/heif' };
/** Το `accept` του πεδίου του Αρχείου. */
export const FOLDER_ACCEPT = [...FOLDER_TYPES, ...Object.keys(FOLDER_EXT).map(e => `.${e}`)].join(',');

const mimeIn = (types: readonly string[], ext: Record<string, string>) => (file: { type?: string; name?: string }): string => {
  const t = (file.type || '').toLowerCase();
  if (t === 'image/jpg') return 'image/jpeg';
  if (types.includes(t)) return t;
  // Χωρίς δηλωμένο τύπο (συμβαίνει σε αρχεία από κοινόχρηστους φακέλους) κρίνει η κατάληξη.
  if (t) return '';
  return ext[/\.([a-z0-9]+)$/i.exec(file.name || '')?.[1]?.toLowerCase() || ''] || '';
};

/** Ο τύπος με τον οποίο θα σταλεί το αρχείο, ή κενό αν δεν διαβάζεται. */
export const scanMime = mimeIn(SCAN_TYPES, SCAN_EXT);
/** Ο τύπος με τον οποίο θα αποθηκευτεί στον Φάκελο, ή κενό αν ο κάδος δεν τον δέχεται. */
export const folderMime = mimeIn(FOLDER_TYPES, FOLDER_EXT);

/** Γιατί δεν διαβάζεται και τι να κάνει ο χρήστης. Κενό όταν διαβάζεται. */
export function unreadableFormat(file: { type?: string; name?: string }): string {
  if (scanMime(file)) return '';
  if (/hei[cf]/i.test(`${file.type || ''} ${file.name || ''}`)) {
    return 'Οι φωτογραφίες HEIC δεν διαβάζονται ακόμη. Τράβηξέ τη από εδώ με την κάμερα ή αποθήκευσέ τη ως JPG.';
  }
  return 'Διαβάζονται φωτογραφίες JPG, PNG ή WEBP και αρχεία PDF.';
}

/** Γιατί δεν μπαίνει στον Φάκελο και τι να κάνει ο χρήστης. Κενό όταν μπαίνει. */
export function notForFolder(file: { type?: string; name?: string }): string {
  if (folderMime(file)) return '';
  return 'Ο Φάκελος κρατά φωτογραφίες και αρχεία PDF. Αποθήκευσε το αρχείο ως PDF και ανέβασέ το ξανά.';
}

function readFile(file: File): Promise<{ base64: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => { const dataUrl = String(r.result || ''); resolve({ base64: dataUrl.split(',')[1] || '', mime: scanMime(file) || 'image/jpeg' }); };
    r.onerror = () => reject(new Error('read'));
    r.readAsDataURL(file);
  });
}

// ══════════════════════════════════════════════════════════════════════════
// ΤΟ ΟΡΙΟ ΕΡΩΤΗΣΕΩΝ ΔΕΝ ΕΙΝΑΙ ΒΛΑΒΗ ΚΑΙ ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΛΕΓΕΤΑΙ ΕΤΣΙ
//
// Το /api/anthropic απαντά 429 με προσεγμένο ελληνικό μήνυμα («Εφτασες τις 7
// ερωτήσεις για σήμερα, το όριο ανανεώνεται τα μεσάνυχτα»). Η σάρωση όμως
// έλεγχε ΜΟΝΟ το 413 και έριχνε όλα τα υπόλοιπα στο 'service':
//
//     «Η υπηρεσία ανάγνωσης δεν απάντησε. Δοκίμασε ξανά σε λίγο.»
//
// Ο χρήστης δοκίμαζε ξανά και ξανά και δεν επρόκειτο να δουλέψει μέχρι τα
// μεσάνυχτα. Δεν μάθαινε ποτέ ότι υπάρχει όριο, ούτε ότι η αναβάθμιση το
// λύνει. Και συνέβαινε εύκολα: στη δοκιμή το πακέτο είναι επτά ερωτήσεις την
// ημέρα και μια θολή φωτογραφία κοστίζει ΔΥΟ (η δεύτερη είναι η επανάληψη
// με άλλη υπόδειξη) — τέσσερις θολές φωτογραφίες εξαντλούν τη μέρα.
//
// Την ίδια στιγμή ο βοηθός, οι υπενθυμίσεις και το πελατολόγιο περνούσαν
// σωστά το μήνυμα του διακομιστή. Η ασυνέπεια ήταν μέσα στην ίδια εφαρμογή.
//
// ΚΑΙ ΤΟ ΚΕΙΜΕΝΟ ΕΡΧΕΤΑΙ ΑΠΟ ΤΟΝ ΔΙΑΚΟΜΙΣΤΗ, ΔΕΝ ΞΑΝΑΓΡΑΦΕΤΑΙ ΕΔΩ. Το
// aiLimits.ts ξέρει ποιο από τα τρία όρια χτύπησε (ημέρα, μήνας, κοινή
// δεξαμενή), ποιο πακέτο έχει ο χρήστης και ότι σε agency και office η
// πρόταση αναβάθμισης είναι κοροϊδία. Ενα σταθερό κείμενο εδώ θα έλεγε σε
// πληρωμένο λογαριασμό «αναβάθμισε» χωρίς να υπάρχει πού.
// Το `format`: τύπος αρχείου που ο πάροχος δεν διαβάζει (βλ. SCAN_TYPES). Δεν
// είναι βλάβη και δεν λύνεται με επανάληψη.
export type ScanError = 'big' | 'service' | 'unreadable' | 'key_missing' | 'quota' | 'format';
/** Ο τύπος του σφάλματος και το κείμενο του διακομιστή όταν υπάρχει. */
export interface ScanFailure { error?: ScanError; errorText?: string }

// Κλήση του vision endpoint με χρονικό όριο, ώστε μια κολλημένη απόκριση να μη
// παγώνει την ουρά ανεβάσματος.
async function ask(body: unknown, timeoutMs = 45000): Promise<ScanFailure & { data?: { content?: { type: string; text?: string }[] } }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch('/api/anthropic', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      // ΚΑΘΕ ΚΛΗΣΗ ΑΠΟ ΕΔΩ ΕΙΝΑΙ ΣΑΡΩΣΗ: μετρά στον μετρητή σαρώσεων (5 τον
      // μήνα στο δωρεάν πακέτο, χωρίς όριο στα πληρωμένα), όχι στις ερωτήσεις της Νόας.
      body: JSON.stringify({ kind: 'scan', ...(body as object) }), signal: ctrl.signal,
    });
    const data = await res.json();
    if (!res.ok || data?.error) {
      // Το 413 έχει δική του, χρήσιμη απάντηση: «μίκρυνε το αρχείο», όχι
      // «χάλασε η υπηρεσία». Ο τύπος `big` υπήρχε ήδη και δεν τον έφτανε τίποτα.
      if (res.status === 413) return { error: 'big' };
      // 429: εξαντλημένο πακέτο ερωτήσεων. Δεν λύνεται με επανάληψη.
      if (res.status === 429) {
        return { error: 'quota', errorText: typeof data?.error === 'string' ? data.error : undefined };
      }
      return { error: String(data?.error || '').includes('ANTHROPIC_API_KEY') ? 'key_missing' : 'service' };
    }
    return { data };
  } catch { return { error: 'service' }; } finally { clearTimeout(timer); }
}

function parseJson<T>(data?: { content?: { type: string; text?: string }[] }): T | null {
  const text = (data?.content || []).find(c => c.type === 'text')?.text || '';
  if (!text) return null;
  try { return JSON.parse(text.replace(/```json?|```/g, '').trim()) as T; } catch { return null; }
}

const contentPartOf = (base64: string, mime: string) => mime === 'application/pdf'
  ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
  : { type: 'image', source: { type: 'base64', media_type: mime, data: base64 } };

/** Σκανάρει ένα αρχείο ως ΕΓΓΡΑΦΟ και επιστρέφει το δομημένο παραστατικό. */
export async function scanDocument(file: File): Promise<ScanFailure & { doc?: ScannedDoc }> {
  if (file.size > MAX_SCAN_MB * 1024 * 1024) return { error: 'big' };
  if (!scanMime(file)) return { error: 'format', errorText: unreadableFormat(file) };
  let base64 = '', mime = 'image/jpeg';
  try { ({ base64, mime } = await readFile(file)); } catch { return { error: 'unreadable' }; }
  const part = contentPartOf(base64, mime);

  const attempt = async (hint: string): Promise<ScanFailure & { doc?: ScannedDoc }> => {
    const r = await ask({
      model: 'claude-sonnet-5', max_tokens: 1500, system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: [part, { type: 'text', text: `Αναγνώρισε και ανάλυσε αυτό το έγγραφο. ${hint}` }] }],
    });
    if (r.error) return { error: r.error, errorText: r.errorText };
    const doc = parseJson<ScannedDoc>(r.data);
    if (!doc || typeof doc !== 'object') return { error: 'unreadable' };
    return { doc };
  };

  let r = await attempt('Διάβασε κάθε στοιχείο με ακρίβεια.');
  // Δεύτερη προσπάθεια ΜΟΝΟ όταν δεν βγήκε δομημένη απάντηση (θολή/στραβή φωτό).
  if (r.error === 'unreadable') {
    r = await attempt('ΠΡΟΣΟΧΗ: η εικόνα ίσως είναι θαμπή ή στραβή. Κοίτα ξανά προσεκτικά και εντόπισε οπωσδήποτε τον τύπο του εγγράφου και τα βασικά στοιχεία.');
  }
  if (r.error || !r.doc) return { error: r.error || 'unreadable', errorText: r.errorText };

  const doc = r.doc;
  // Ντετερμινιστική εξομάλυνση: το AI μπορεί να δώσει αριθμούς ως strings.
  // Ο τύπος ανάγκασε να ειπωθεί κάτι που έμενε υπονοούμενο: όταν το κείμενο ΔΕΝ
  // είναι αριθμός («περίπου 300»), το πεδίο ΦΕΥΓΕΙ. Πριν του ανατίθετο
  // `undefined` — ίδιο αποτέλεσμα στην εκτέλεση, αλλά γραμμένο σαν να ήταν
  // αριθμός. Ένα αριθμητικό πεδίο που κρατά ακατέργαστο κείμενο είναι χειρότερο
  // από ένα που λείπει: το πρώτο μπαίνει στη βάση και δίνει NaN στην πρόσθεση.
  SCAN_NUM_KEYS.forEach(k => {
    if (doc[k] == null) return;
    const n = numify(doc[k]);
    if (n === undefined) delete doc[k]; else doc[k] = n;
  });
  // Οι γραμμές του Ε9 και του ΕΝΦΙΑ: ίδια εξομάλυνση αριθμών, ΑΤΑΚ μόνο ψηφία,
  // το πολύ όσες ζητά το prompt.
  if (Array.isArray(doc.lines)) {
    doc.lines = doc.lines.filter(l => l && typeof l === 'object').slice(0, SCAN_MAX_LINES).map((l): DocLine => {
      const out: DocLine = {};
      if (l.atak) out.atak = atakDigits(String(l.atak)) || undefined;
      if (l.address) out.address = String(l.address).trim() || undefined;
      if (l.floor != null) out.floor = String(l.floor).trim() || undefined;
      for (const k of ['sqm', 'storage_sqm', 'year_built', 'amount'] as const) {
        const n = numify(l[k]);
        if (n !== undefined) out[k] = n;
      }
      return out;
    });
  } else if (doc.lines != null) {
    delete doc.lines;
  }
  if (Array.isArray(doc.owners)) {
    doc.owners = doc.owners.map(o => ({
      name: o?.name || undefined,
      afm: o?.afm ? String(o.afm).replace(/\D/g, '') || undefined : undefined,
      pct: o?.pct != null ? numify(o.pct) : undefined,
    }));
  }
  doc.doc_type = classifyDocType(doc);
  // ΒΕΒΑΙΟΤΗΤΑ ΠΟΥ ΔΕΝ ΤΗΝ ΕΙΠΕ ΚΑΝΕΙΣ. Εδώ γραφόταν `confidence = 70` όποτε
  // το μοντέλο δεν έδινε αριθμό και η οθόνη τύπωνε «70% βεβαιότητα»: μέτρηση
  // με δύο ψηφία, χωρίς μετρητή από πίσω. Το ίδιο έσβηνε και πραγματική
  // απάντηση σε κείμενο («85») — έμπαινε 70 στη θέση του 85. Τώρα: ο αριθμός
  // όταν δόθηκε, στο 0-100· τίποτα όταν δεν δόθηκε. Η οθόνη σωπαίνει αντί να
  // μαντεύει. Μετρά τη βεβαιότητα για τον ΤΥΠΟ, όχι την ευκρίνεια της
  // ανάγνωσης: τη διαβάζει μόνο η ένδειξη «δεν είναι σίγουρη για τον τύπο»
  // του DocumentScan.
  const conf = numify(doc.confidence);
  if (conf === undefined) delete doc.confidence;
  else doc.confidence = Math.max(0, Math.min(100, Math.round(conf)));
  // ΑΦΜ σε ψηφία + περίοδος από κείμενο σε δύο ημερομηνίες (ποτέ μαντεψιά).
  return { doc: normalizeScannedDoc(doc) };
}

/** Ταξινόμηση φωτογραφίας ακινήτου (χώρος/θέμα + κατηγορία). */
export async function scanPhoto(file: File): Promise<ScanFailure & { photo?: { category: string; title: string | null } }> {
  if (file.size > MAX_SCAN_MB * 1024 * 1024) return { error: 'big' };
  const mimeOk = scanMime(file);
  if (!mimeOk.startsWith('image/')) return mimeOk ? { error: 'unreadable' } : { error: 'format', errorText: unreadableFormat(file) };
  let base64 = '', mime = 'image/jpeg';
  try { ({ base64, mime } = await readFile(file)); } catch { return { error: 'unreadable' }; }
  const r = await ask({
    model: 'claude-sonnet-5', max_tokens: 200, system: PHOTO_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: [contentPartOf(base64, mime), { type: 'text', text: 'Κατηγοριοποίησε αυτή τη φωτογραφία ακινήτου.' }] }],
  });
  if (r.error) return { error: r.error, errorText: r.errorText };
  const parsed = parseJson<{ category?: string; title?: string }>(r.data);
  if (!parsed) return { error: 'unreadable' };
  return {
    photo: {
      category: parsed.category && PHOTO_CATEGORIES.includes(parsed.category) ? parsed.category : 'Κατάσταση Ακινήτου',
      title: parsed.title?.trim() || null,
    },
  };
}

// ── Έγγραφο ή φωτογραφία; Το αποφασίζει το AI, όχι διακόπτης ────────────────
export interface ScanFileResult extends ScanFailure {
  kind: 'document' | 'photo';
  doc?: ScannedDoc;                                  // kind === 'document'
  photo?: { category: string; title: string | null }; // kind === 'photo'
}

/**
 * Η ΜΙΑ κλήση σάρωσης. Ο χρήστης δεν δηλώνει «έγγραφο ή φωτογραφία»:
 *   • PDF/έγγραφο → πάντα ανάγνωση παραστατικού.
 *   • Εικόνα → πρώτα ανάγνωση παραστατικού· ΑΝ δεν βρεθεί ΚΑΝΕΝΑ στοιχείο
 *     παραστατικού (ούτε πάροχος, ούτε ποσό, ούτε τίτλος, ούτε ημερομηνία),
 *     τότε είναι φωτογραφία χώρου και ταξινομείται ως τέτοια.
 * Ο κανόνας είναι ντετερμινιστικός και εξηγήσιμος — δεν «μαντεύει διάθεση».
 */
export async function scanFile(file: File): Promise<ScanFileResult> {
  if (file.size > MAX_SCAN_MB * 1024 * 1024) return { kind: 'document', error: 'big' };
  // Ούτε ανάγνωση εγγράφου ούτε ταξινόμηση φωτογραφίας: δύο κλήσεις για ένα «όχι».
  if (!scanMime(file)) return { kind: 'document', error: 'format', errorText: unreadableFormat(file) };
  const isImage = scanMime(file).startsWith('image/');
  const r = await scanDocument(file);
  if (r.doc) {
    const d = r.doc;
    if (isDocumentary(d) || !isImage) return { kind: 'document', doc: d };
    // ΜΙΑ ΚΛΗΣΗ, ΟΧΙ ΔΥΟ. Η ανάγνωση εγγράφου που είπε «δεν είναι έγγραφο»
    // δίνει και την κατηγορία της φωτογραφίας. Η δεύτερη κλήση πιο κάτω
    // μετρούσε δεύτερη σάρωση για την ίδια εικόνα· μένει μόνο ως εφεδρεία,
    // όταν η πρώτη απάντηση δεν έφερε έγκυρη κατηγορία.
    if (d.is_document === false && d.photo_category && PHOTO_AI_CATEGORIES.includes(d.photo_category)) {
      return { kind: 'photo', photo: { category: d.photo_category, title: (d.title || '').trim() || null } };
    }
  } else if (!isImage) {
    return { kind: 'document', error: r.error, errorText: r.errorText };
  }
  const p = await scanPhoto(file);
  if (p.photo) return { kind: 'photo', photo: p.photo };
  // Η φωτογραφία δεν ταξινομήθηκε: επιστρέφουμε ό,τι ξέρουμε, χωρίς να χαθεί τίποτα.
  return r.doc
    ? { kind: 'document', doc: r.doc }
    : { kind: 'photo', error: p.error || r.error, errorText: p.errorText || r.errorText };
}

// ── Αρχειοθέτηση: ανέβασμα + εγγραφή στο property_documents ─────────────────
export interface ArchiveInput {
  file: File;
  propertyId: string;
  userId: string;
  kind: 'document' | 'photo';
  category: string;
  title?: string;
  notes?: string | null;
  supplier?: string | null;
  doc_date?: string | null;
  amount?: number | null;
  provider_afm?: string | null;
  period_from?: string | null;
  period_to?: string | null;
  issue_date?: string | null;
}

/** Ανεβάζει το πρωτότυπο και γράφει τη γραμμή του Αρχείου. */
export async function archiveScannedFile(input: ArchiveInput): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  const { file, propertyId, userId, kind } = input;
  const path = uploadPath(file.name, `${userId}/${propertyId}/${kind}`);
  const { error: upErr } = await supabase.storage.from('property-files')
    .upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (upErr) return { ok: false, error: upErr.message };

  const base: Record<string, unknown> = {
    property_id: propertyId, user_id: userId, kind, category: input.category,
    title: (input.title || file.name).slice(0, 200), notes: input.notes ?? null,
    doc_date: input.doc_date || null, file_path: path, file_name: file.name,
    mime: file.type || null, size_bytes: file.size,
  };
  const payload: Record<string, unknown> = {
    ...base,
    supplier: input.supplier ?? null,
    amount: input.amount ?? null,
    provider_afm: input.provider_afm ?? null,
    period_from: input.period_from || null,
    period_to: input.period_to || null,
    issue_date: input.issue_date || null,
  };

  const { error } = await documents.add(supabase, propertyId, userId, payload);
  return error ? { ok: false, error: error.message ?? 'insert' } : { ok: true };
}

/** Από το σχέδιο αρχειοθέτησης (καθαρή λογική) στο input της βάσης. */
export function archiveInputFrom(plan: ArchivePlan, file: File, propertyId: string, userId: string, title?: string): ArchiveInput {
  return {
    file, propertyId, userId, kind: 'document',
    category: plan.category, title: title || file.name, notes: plan.note ?? null,
    supplier: plan.supplier ?? null, doc_date: plan.date ?? null,
    amount: plan.amount ?? null, provider_afm: plan.provider_afm ?? null,
    period_from: plan.period_from ?? null, period_to: plan.period_to ?? null,
    issue_date: plan.issue_date ?? null,
  };
}

// ── Η καταχώρηση: ένα έγγραφο → όλοι οι σωστοί πίνακες ─────────────────────

/**
 * Οι απαντήσεις του χρήστη στις ερωτήσεις της καταχώρησης.
 *
 * ΚΑΘΕ ΑΠΑΝΤΗΣΗ ΜΕΝΕΙ ΜΕΧΡΙ ΤΟ ΤΕΛΟΣ. Οι ερωτήσεις έρχονται μία μία: πρώτα
 * «μήπως το έχεις ήδη;», μετά «ποιον λογαριασμό εξοφλεί;». Η οθόνη έστελνε στη
 * δεύτερη απάντηση ΜΟΝΟ τη δεύτερη, οπότε ο έλεγχος διπλοεγγραφής ξανάτρεχε,
 * ξαναρωτούσε και το έγγραφο δεν καταχωρούνταν ποτέ: βρόχος χωρίς έξοδο. Οι
 * τρεις οθόνες (σάρωση, Αρχείο, Νόα) κρατούν πλέον ΕΝΑ αντικείμενο απαντήσεων
 * και το συμπληρώνουν με το `withAnswer`.
 */
export interface CommitAnswers {
  /**
   * «Το ξέρω ότι μοιάζει, γράψ' το». Ο έλεγχος διπλοεγγραφής ΔΕΝ σβήνει και δεν
   * αποφασίζει: σταματά και ρωτά. Μόνο ο χρήστης ξέρει αν πρόκειται για δύο
   * παροχές ρεύματος ή για την ίδια απόδειξη σαρωμένη δεύτερη φορά.
   */
  allowDuplicate?: boolean;
  /**
   * Απάντηση στην ερώτηση συμφωνίας:
   *   string → εξόφλησε ΑΥΤΟΝ τον λογαριασμό
   *   null   → κανέναν, δημιούργησε νέα εγγραφή
   *   undefined (προεπιλογή) → ρώτα εμένα αν δεν είσαι σίγουρος
   */
  reconcileChoice?: string | null;
  /**
   * Απάντηση στην ερώτηση του μισθωτηρίου:
   *   string → είναι ΑΥΤΟΣ ο τρέχων ενοικιαστής
   *   null   → νέος ενοικιαστής
   *   undefined → ρώτα αν το ΑΦΜ και το όνομα δεν τον βρίσκουν
   */
  tenantChoice?: string | null;
  /**
   * Απάντηση στην ερώτηση των όρων, όταν νεότερο μισθωτήριο αλλάζει ενοίκιο ή
   * έναρξη που ήδη ισχύουν:
   *   'update' → ισχύουν οι όροι του χαρτιού
   *   null     → μένουν οι τρέχοντες, το χαρτί συμπληρώνει μόνο ό,τι λείπει
   *   undefined → ρώτα
   */
  leaseChoice?: string | null;
}

export interface CommitInput extends CommitAnswers {
  doc: ScannedDoc;
  propertyId: string;
  userId: string;
  /** Το πρωτότυπο αρχείο. Χωρίς αυτό δεν γίνεται αρχειοθέτηση (μόνο καταχωρήσεις). */
  file?: File | null;
  today?: string;
  /**
   * Ράφι του Αρχείου, όταν ο χρήστης το διόρθωσε ρητά στην οθόνη επιβεβαίωσης.
   * Χωρίς αυτό ισχύει ό,τι αποφασίζει το archiveCategoryFor() — ένα σημείο.
   */
  archiveCategory?: string;
}

export interface ReconcileQuestion {
  /**
   * Τι ρωτάμε: ποιον λογαριασμό εξοφλεί η απόδειξη, ποιον ενοικιαστή αφορά το
   * μισθωτήριο ή αν οι όροι του νεότερου μισθωτηρίου αντικαθιστούν τους τρέχοντες.
   */
  about: 'bill' | 'tenant' | 'lease';
  question: string;
  /** Μία πρόταση κάτω από την ερώτηση: γιατί η εφαρμογή δεν διαλέγει μόνη της. */
  note: string;
  options: { id: string; label: string; reasons: string[] }[];
  /** Η τελευταία επιλογή, που δεν είναι κανένας από τους υποψηφίους. */
  none: { label: string; hint: string };
}

/**
 * Η ΤΕΛΕΥΤΑΙΑ ΕΠΙΛΟΓΗ ΤΗΣ ΕΡΩΤΗΣΗΣ ΣΥΜΦΩΝΙΑΣ, ΜΙΑ ΦΟΡΑ.
 * Η ίδια απόφαση εμφανιζόταν σε τρεις οθόνες με τρεις διατυπώσεις — «Κανέναν
 * από αυτούς», «Κανέναν, νέα ξεχωριστή εγγραφή», «Κανέναν, κράτησέ το ως νέα
 * εγγραφή» — και ο βοηθός παρέπεμπε σε ένα τέταρτο, σκέτο «Κανέναν». Ο χρήστης
 * που το συναντά δεύτερη φορά πρέπει να αναγνωρίσει το ίδιο κουμπί.
 */
export const RECONCILE_NONE_LABEL = 'Κανέναν από αυτούς';
export const RECONCILE_NONE_HINT = 'Θα καταχωρηθεί ως νέα, ξεχωριστή εγγραφή';

/** Η απάντηση σε μία ερώτηση, πάνω στις προηγούμενες: καμία δεν χάνεται. */
export function withAnswer(prev: CommitAnswers, q: ReconcileQuestion | 'duplicate', choice: string | null = null): CommitAnswers {
  if (q === 'duplicate') return { ...prev, allowDuplicate: true };
  if (q.about === 'tenant') return { ...prev, tenantChoice: choice };
  if (q.about === 'lease') return { ...prev, leaseChoice: choice };
  return { ...prev, reconcileChoice: choice };
}

/**
 * Οι απαντήσεις της Νόας για το παραστατικό που περιμένει καταχώρηση.
 *
 * Η ΑΠΑΝΤΗΣΗ ΑΝΗΚΕΙ ΣΤΟ ΧΑΡΤΙ ΠΟΥ ΡΩΤΗΘΗΚΕ. Στη συνομιλία η κάρτα της ερώτησης
 * και τα κουμπιά των παλιών μηνυμάτων μένουν όταν φτάνει νέα φωτογραφία. Η
 * επιλογή «ισχύουν οι όροι του νέου μισθωτηρίου» για το πρώτο χαρτί άλλαζε
 * σιωπηλά το ενοίκιο με τους όρους του δεύτερου, που ο χρήστης δεν είδε ποτέ.
 * Και το «ούτως ή άλλως» ενός παλιού μηνύματος παρέκαμπτε τον έλεγχο
 * διπλοεγγραφής ενός χαρτιού που δεν είχε ελεγχθεί. Μετρούν μόνο όταν το ίδιο
 * το χαρτί έχει την ερώτηση (`ask`) ή την παρόμοια δαπάνη (`duplicate`).
 */
export function pendingAnswers(
  p: { answers?: CommitAnswers; ask?: ReconcileQuestion; duplicate?: boolean },
  choice?: string | null,
  allowDuplicate = false,
): CommitAnswers {
  let a: CommitAnswers = p.answers || {};
  if (choice !== undefined && p.ask) a = withAnswer(a, p.ask, choice);
  if (allowDuplicate && p.duplicate) a = withAnswer(a, 'duplicate');
  return a;
}

export interface CommitResult {
  /** Τι ενημερώθηκε ΠΡΑΓΜΑΤΙΚΑ (ονόματα καρτελών, για ειλικρινή αναφορά). */
  saved: string[];
  /**
   * Τι ΔΕΝ γράφτηκε ενώ έπρεπε. Η οθόνη επιτυχίας έλεγε «Ενημερώθηκαν αυτόματα
   * οι σχετικές καρτέλες» αρκεί να είχε πετύχει ΕΝΑ βήμα: ο Φάκελος που δεν
   * ανέβηκε, ο λογαριασμός που δεν γράφτηκε, οι δόσεις που απέτυχαν χάνονταν
   * χωρίς λέξη. Λείπει όταν δεν απέτυχε τίποτα.
   */
  failed?: string[];
  /** Όταν υπάρχει, ΤΙΠΟΤΑ δεν γράφτηκε: πρέπει πρώτα να απαντήσει ο χρήστης. */
  ask?: ReconcileQuestion;
  /**
   * Πιθανή διπλοεγγραφή. Και εδώ ΤΙΠΟΤΑ δεν γράφτηκε: η πρόταση λέει τι βρέθηκε
   * και γιατί μοιάζει και ο χρήστης είτε ακυρώνει είτε ξαναστέλνει με
   * `allowDuplicate`.
   */
  duplicate?: string;
  error?: 'save';
}

/**
 * Η πρόταση για ό,τι δεν γράφτηκε, ίδια σε σάρωση, Αρχείο και Νόα. Κενή όταν
 * δεν απέτυχε τίποτα.
 */
export function failedNotice(failed?: readonly string[]): string {
  if (!failed?.length) return '';
  return `${failed.length === 1 ? 'Δεν ενημερώθηκε' : 'Δεν ενημερώθηκαν'}: ${failed.join(', ')}. Δοκίμασε ξανά από την αντίστοιχη καρτέλα.`;
}

/**
 * Ποια κάρτα ερώτησης μένει ανοιχτή μετά από μια απάντηση της καταχώρησης.
 * ΜΙΑ ΚΑΘΕ ΦΟΡΑ: όταν ερχόταν η ερώτηση συμφωνίας, η κάρτα διπλοεγγραφής
 * έμενε από κάτω και ο χρήστης έβλεπε δύο ερωτήσεις για μία απόφαση.
 */
export function openQuestion(r: CommitResult): { ask: ReconcileQuestion | null; duplicate: string } {
  if (r.ask) return { ask: r.ask, duplicate: '' };
  return { ask: null, duplicate: r.duplicate || '' };
}

const nrm = (s?: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
/** Οι εκκρεμείς λογαριασμοί ενός ακινήτου, σε μορφή υποψηφίου ταιριάσματος. */
async function pendingCandidates(propertyId: string, userId: string): Promise<MatchCandidate[]> {
  const supabase = createClient();
  const data = await billStore.ofProperty(supabase, propertyId, 'id,category,amount,due_date,created_at,name,period', userId, { paid: false });
  return (data || []).map(b => ({
    id: String(b.id),
    amount: typeof b.amount === 'number' ? b.amount : parseFloat(String(b.amount ?? 0)),
    category: (b.category as string) ?? null,
    due_date: (b.due_date as string) ?? null,
    created_at: (b.created_at as string) ?? null,
    // Ο πάροχος δεν έχει δική του στήλη στους λογαριασμούς: γράφεται στο `name`
    // ως «Πάροχος — Περίοδος» (planDocSave). Το ΑΦΜ παρόχου δεν υπάρχει καθόλου
    // στο `bills` — άρα μένει άγνωστο, δηλαδή δεν δίνει και δεν αφαιρεί μονάδες.
    provider: providerFromBillName(b.name as string),
    period: (b.period as string) ?? null,
  }));
}

/** Η ερώτηση προς τον χρήστη, με τους λόγους κάθε υποψηφίου. */
function toQuestion(r: MatchResult<MatchCandidate>): ReconcileQuestion {
  return {
    about: 'bill',
    question: r.question || 'Ποιον λογαριασμό εξοφλεί αυτή η απόδειξη;',
    note: 'Δεν επιλέγεται αυτόματα: αν εξοφληθεί ο λάθος, θα δεις πληρωμένο κάτι που χρωστάς.',
    options: r.candidates.map(c => ({
      id: c.bill.id,
      label: [c.bill.provider || 'Λογαριασμός', c.bill.period, c.bill.due_date ? `λήξη ${c.bill.due_date}` : '']
        .filter(Boolean).join(' · '),
      reasons: c.reasons.filter(x => x.ok).map(x => x.detail),
    })),
    none: { label: RECONCILE_NONE_LABEL, hint: RECONCILE_NONE_HINT },
  };
}

/** «01/01/2026» από «2026-01-01». */
const dmy = (iso?: string | null): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
};

/**
 * ΤΟ ΜΙΣΘΩΤΗΡΙΟ ΔΕΝ ΤΑΙΡΙΑΖΕΙ ΜΕ ΚΑΝΕΝΑΝ ΤΡΕΧΟΝΤΑ: ΡΩΤΑΜΕ.
 * Πριν γινόταν σιωπηλά νέος ενοικιαστής δίπλα στον τρέχοντα, με δόσεις για
 * κάθε μήνα από την έναρξη: δύο μισθωτές και διπλό αναμενόμενο ενοίκιο.
 */
function tenantQuestion(name: unknown, current: readonly TenantOnFile[]): ReconcileQuestion {
  const who = String(name ?? '').trim();
  return {
    about: 'tenant',
    question: who
      ? `Το μισθωτήριο αφορά «${who}». Είναι κάποιος από τους τρέχοντες ενοικιαστές;`
      : 'Το μισθωτήριο δεν ταιριάζει με τρέχοντα ενοικιαστή. Είναι κάποιος από αυτούς;',
    note: 'Δεν επιλέγεται αυτόματα: ένας δεύτερος ενοικιαστής κατά λάθος διπλασιάζει τις δόσεις κάθε μήνα.',
    options: current.map(t => ({
      id: t.id,
      label: (t.full_name || '').trim() || 'Ενοικιαστής χωρίς όνομα',
      reasons: [
        t.monthly_rent ? `${fe(t.monthly_rent)} τον μήνα` : '',
        t.lease_start ? `από ${dmy(t.lease_start)}` : '',
        t.afm ? `ΑΦΜ ${t.afm}` : '',
      ].filter(Boolean),
    })),
    none: {
      label: 'Νέος ενοικιαστής',
      hint: `Θα προστεθεί χωρίς να κλείσει καμία τρέχουσα μίσθωση. Αν ο προηγούμενος έφυγε, σημείωσε την αποχώρησή του στους ${navLabel('tenant')}.`,
    },
  };
}

/**
 * ΝΕΟΤΕΡΟ ΜΙΣΘΩΤΗΡΙΟ ΜΕ ΑΛΛΟ ΕΝΟΙΚΙΟ Ή ΑΛΛΗ ΕΝΑΡΞΗ: ΡΩΤΑΜΕ ΠΡΙΝ ΑΛΛΑΞΟΥΝ.
 * Από αυτά τα δύο γεννιούνται οι δόσεις κάθε μήνα· μια λάθος ανάγνωση της
 * χρονιάς θα τα άλλαζε σιωπηλά. Οι λόγοι λένε τι ισχύει και τι γράφει το χαρτί.
 */
function leaseQuestion(t: TenantOnFile, changes: ReturnType<typeof changedTerms>): ReconcileQuestion {
  const who = (t.full_name || '').trim();
  const show = (k: string, v: unknown) => (k === 'monthly_rent' ? fe(Number(v)) : dmy(String(v ?? '')));
  const label: Record<string, string> = { monthly_rent: 'Ενοίκιο', lease_start: 'Έναρξη' };
  return {
    about: 'lease',
    question: who
      ? `Το μισθωτήριο του ενοικιαστή «${who}» είναι νεότερο από αυτό που ισχύει. Να αλλάξουν οι όροι της μίσθωσης;`
      : 'Το μισθωτήριο είναι νεότερο από αυτό που ισχύει. Να αλλάξουν οι όροι της μίσθωσης;',
    note: 'Δεν αλλάζουν αυτόματα: από το ενοίκιο και την έναρξη γεννιούνται οι δόσεις κάθε μήνα.',
    options: [{
      id: 'update',
      label: 'Ναι, ισχύουν οι όροι του νέου μισθωτηρίου',
      reasons: changes.map(c => `${label[c.key]} από ${show(c.key, c.from)} σε ${show(c.key, c.to)}`),
    }],
    none: {
      label: 'Όχι, μένουν οι τρέχοντες όροι',
      hint: 'Το μισθωτήριο μπαίνει στον Φάκελο και συμπληρώνει μόνο ό,τι λείπει.',
    },
  };
}

// Οι ετικέτες της αναφοράς: ίδιες με τη λίστα «Θα ενημερωθούν» της φόρμας.
const BILLS = 'Λογαριασμοί';
const EXPENSES = navLabel('finances');
const CALENDAR = navLabel('calendar');
const TENANTS = navLabel('tenant');
const INSTALMENTS = 'Δόσεις ενοικίου';
const COMMON = 'Κοινόχρηστα';
const FOLDER = navLabel('documents');
/** Τα πεδία του ενοικιαστή από τα οποία γεννιούνται οι δόσεις. */
const INSTALMENT_KEYS = ['monthly_rent', 'rent_due_day', 'lease_start', 'lease_end'];

/**
 * ΤΟ ΣΗΜΕΙΟ ΕΙΣΟΔΟΥ ΓΙΑ ΚΑΘΕ ΟΘΟΝΗ. Παίρνει το σαρωμένο (και τυχόν διορθωμένο
 * από τον χρήστη) έγγραφο και το γράφει σε όλους τους σωστούς πίνακες. Δεν κάνει
 * ΠΟΤΕ σιωπηλή εξόφληση: όταν η βεβαιότητα ταιριάσματος είναι χαμηλή, επιστρέφει
 * `ask` χωρίς να γράψει τίποτα και η οθόνη ρωτά τον χρήστη.
 */
export async function commitScannedDoc(input: CommitInput): Promise<CommitResult> {
  const supabase = createClient();
  const { propertyId, userId, file } = input;
  const today = input.today || athensToday();
  const doc = normalizeScannedDoc(input.doc);
  const plan = planDocSave(doc, today);
  // Ονομάζεται `written` και όχι `saved`: το `saved` είναι πια ο βοηθός που
  // ελέγχει αν το γράψιμο πέτυχε και δύο πράγματα δεν μοιράζονται ένα όνομα.
  const written: string[] = [];
  const failed: string[] = [];
  const add = (s: string) => { if (!written.includes(s)) written.push(s); };
  const fail = (s: string) => { if (!failed.includes(s)) failed.push(s); };

  try {
    // ══ 0) ΟΙ ΕΡΩΤΗΣΕΙΣ, ΠΡΙΝ ΓΡΑΦΤΕΙ ΟΤΙΔΗΠΟΤΕ ══════════════════════════
    // Μια μισή καταχώρηση είναι χειρότερη από καμία: διπλοεγγραφή, συμφωνία
    // και ενοικιαστής κρίνονται ΟΛΑ πριν από την πρώτη εγγραφή.

    // Οταν το χαρτί είναι απόδειξη πληρωμής: οι εκκρεμείς λογαριασμοί και το
    // ταίριασμα της απόδειξης με αυτούς. Τα χρειάζονται και ο έλεγχος
    // διπλοεγγραφής και η συμφωνία: μία ανάγνωση, ένας υπολογισμός.
    const cands = plan.reconcile && doc.amount ? await pendingCandidates(propertyId, userId) : [];
    const match = plan.reconcile && doc.amount ? matchPaymentToBills({
      amount: doc.amount,
      date: doc.issue_date || today,
      category: (plan.bill?.category as string) || undefined,
      provider: doc.provider,
      provider_afm: doc.provider_afm,
      period_from: doc.period_from,
      period_to: doc.period_to,
      period: doc.period,
    }, cands) : null;
    // Οι λογαριασμοί που μπορεί να εξοφλεί: όσους βρήκε το ταίριασμα και όποιον
    // διάλεξε ο χρήστης. ΜΟΝΟ αυτών το χρέος βγαίνει από τον έλεγχο
    // διπλοεγγραφής. Ενας λογαριασμός που το ταίριασμα απορρίπτει (άλλος
    // πάροχος, άλλη κατηγορία) δεν θα κλείσει από αυτή την απόδειξη, άρα η
    // δαπάνη του μένει μέσα και η ομοιότητα λέγεται.
    const payable = [
      ...(match?.candidates.map(c => c.bill.id) ?? []),
      ...(typeof input.reconcileChoice === 'string' ? [input.reconcileChoice] : []),
    ];

    // ── 0α) ΜΗΠΩΣ ΕΙΝΑΙ ΗΔΗ ΜΕΣΑ; ────────────────────────────────────────
    // Ο ιδιοκτήτης φωτογραφίζει τον λογαριασμό τη Δευτέρα και τον καταχωρεί με
    // το χέρι την Πέμπτη. Ή σαρώνει δεύτερη φορά την ίδια απόδειξη επειδή η
    // πρώτη βγήκε θολή. Και οι δύο γραμμές είναι σωστές από μόνες τους — ίδιος
    // πάροχος, ίδιο ποσό, λογικές ημερομηνίες — οπότε κανένα άθροισμα δεν
    // φωνάζει. Απλώς ο μήνας βγαίνει ακριβότερος και η δήλωση κουβαλά δαπάνη
    // που δεν υπάρχει.
    //
    // Η ΑΠΟΔΕΙΞΗ ΔΕΝ ΕΙΝΑΙ ΔΙΠΛΟΤΥΠΟ ΤΟΥ ΛΟΓΑΡΙΑΣΜΟΥ ΠΟΥ ΕΞΟΦΛΕΙ. Η απλήρωτη
    // δαπάνη ενός εκκρεμούς λογαριασμού την κλείνει η ίδια η συμφωνία πιο κάτω.
    // Μέχρι τώρα ο έλεγχος τη μετρούσε ως «ίδια δαπάνη» και όποιος άκουγε τη
    // συμβουλή «μην την καταχωρήσεις δεύτερη φορά» άφηνε τον λογαριασμό
    // απλήρωτο (withoutOpenBillDebts, με τους λογαριασμούς του `payable`).
    if (plan.expense && !input.allowDuplicate) {
      const window = 5;
      const around = (d: string, delta: number) => {
        const [y, m, dd] = d.split('-').map(Number);
        const t = new Date(Date.UTC(y || 1970, (m || 1) - 1, (dd || 1) + delta));
        return t.toISOString().slice(0, 10);
      };
      // Το σχέδιο δαπάνης είναι χαλαρά τυπωμένο (`Record<string, unknown>`),
      // οπότε τα τρία πεδία που χρειάζεται ο έλεγχος διαβάζονται ρητά.
      const exp = plan.expense as { description?: string; amount?: number; category?: string; date?: string };
      const on = exp.date || today;
      const near = await expenses.inRangeOfProperty(
        supabase, propertyId, around(on, -window), around(on, window),
        'id,description,amount,category,date,store_vendor,bill_id,paid') as ExpenseLike[];
      const pool = withoutOpenBillDebts(near, payable);
      const hits = findDuplicates({
        description: exp.description ?? null,
        amount: Number(exp.amount) || 0,
        category: exp.category ?? null,
        date: on,
        store_vendor: doc.provider || null,
      }, pool, { days: window });
      if (hits.length) return { saved: [], duplicate: duplicateNotice(hits) };
    }

    // ── 0β) Συμφωνία απόδειξης με εκκρεμή λογαριασμό — με τα πέντε πεδία.
    let payOff: string | null = null;
    if (plan.reconcile && doc.amount) {
      if (input.reconcileChoice !== undefined) {
        payOff = input.reconcileChoice;
      } else if (match) {
        if (match.verdict === 'ask') return { saved: [], ask: toQuestion(match) };
        payOff = match.verdict === 'confident' && match.best ? match.best.bill.id : null;
      }
    }

    // ── 0γ) Ποιον ενοικιαστή αφορά το μισθωτήριο (lib/tenant/scanMatch.ts).
    // Ο ΤΡΕΧΩΝ, ΟΧΙ Ο ΤΕΛΕΥΤΑΙΑ ΕΝΗΜΕΡΩΜΕΝΟΣ — και ΟΛΟΙ οι τρέχοντες, όχι ο
    // πρώτος: σε συγκατοίκηση το χαρτί μπορεί να αφορά τον δεύτερο. Πρώτα το
    // ΑΦΜ, μετά το όνομα σε οποιαδήποτε σειρά. Οταν δεν ταιριάζει κανείς,
    // ερώτηση. Αποτυχημένη ανάγνωση δεν σημαίνει «κανένας ενοικιαστής»: τότε
    // δεν γράφεται ενοικιαστής καθόλου, γιατί θα γινόταν δεύτερος.
    type TenantStep = { mode: 'unknown' } | { mode: 'add' } | { mode: 'update'; id: string; patch: Record<string, unknown>; older: boolean };
    let tenantStep: TenantStep | null = null;
    if (plan.tenant) {
      const { rows: current, error: tReadErr } = await tenantStore.currentAllWithError<TenantOnFile>(
        supabase, propertyId, TENANT_MATCH_COLUMNS, userId);
      if (tReadErr) tenantStep = { mode: 'unknown' };
      else {
        const chosen = typeof input.tenantChoice === 'string' ? current.find(t => t.id === input.tenantChoice) : undefined;
        const m: TenantMatch<TenantOnFile> = input.tenantChoice === null ? { kind: 'new' }
          : chosen ? { kind: 'same', tenant: chosen, by: 'name' }
          : matchScannedTenant(plan.tenant, current);
        if (m.kind === 'ask') return { saved: [], ask: tenantQuestion(plan.tenant.full_name, m.current) };
        if (m.kind === 'new') tenantStep = { mode: 'add' };
        else {
          // ΤΟ ΠΑΛΙΟ ΧΑΡΤΙ ΔΕΝ ΓΥΡΙΖΕΙ ΠΙΣΩ ΤΗ ΜΙΣΘΩΣΗ. Ενοίκιο, έναρξη, λήξη και
          // εγγύηση αλλάζουν μόνο από νεότερο μισθωτήριο· το παλαιότερο
          // συμπληρώνει μόνο ό,τι λείπει, άρα δεν γεννά δόσεις πριν από την
          // έναρξη που ήδη ισχύει. Και το νεότερο δεν αλλάζει ενοίκιο ή έναρξη
          // που ήδη ισχύουν χωρίς ρητό «ναι» (leaseChoice).
          const onFile = m.tenant as unknown as Record<string, unknown>;
          const full = leaseUpdate(plan.tenant, onFile);
          const changes = changedTerms(full.patch, onFile);
          if (changes.length && input.leaseChoice === undefined) {
            return { saved: [], ask: leaseQuestion(m.tenant, changes) };
          }
          const { patch, age } = changes.length && input.leaseChoice !== 'update'
            ? leaseUpdate(plan.tenant, onFile, { keepTerms: true })
            : full;
          tenantStep = { mode: 'update', id: m.tenant.id, patch, older: age === 'older' };
        }
      }
    }

    // ── Ο ΦΡΟΥΡΟΣ ΤΟΥ ΠΕΑ: η λήξη που ήδη ξέρει το ημερολόγιο.
    const evGuard = plan.replaceIfNewerEvent;
    let eventUnknown = false, eventOlder = false, eventSame = false;
    if (evGuard) {
      const { rows: dates, error: evErr } = await calendar.datesWithError(supabase, propertyId, { title: evGuard.title });
      eventUnknown = !!evErr;
      eventOlder = dates.some(d => d.slice(0, 10) > evGuard.value);
      // Η ίδια λήξη υπάρχει ήδη: η δεύτερη σάρωση του ίδιου ΠΕΑ δεν φέρνει δεύτερη υπενθύμιση.
      eventSame = dates.some(d => d.slice(0, 10) === evGuard.value);
    }

    // ══ ΟΙ ΕΓΓΡΑΦΕΣ ═════════════════════════════════════════════════════
    let billId: string | undefined;
    let reconciled = false;

    if (payOff) {
      // Η απόδειξη ΔΕΝ γίνεται δεύτερος λογαριασμός, ούτε όταν η σήμανση αποτύχει.
      reconciled = true;
      if (await saved('Ο λογαριασμός δεν σημειώθηκε εξοφλημένος', billStore.markPaid(supabase, payOff))) {
        add('Λογαριασμός εξοφλήθηκε');
        const updExp = await savedData<{ id: string }[]>('Η συνδεδεμένη δαπάνη δεν σημειώθηκε πληρωμένη',
          expenses.markBillPaid(supabase, payOff));
        if (updExp === null) fail(EXPENSES);
        // Αν ο εξοφλημένος λογαριασμός δεν είχε συνδεδεμένο έξοδο, δημιούργησέ το
        // τώρα ώστε η πληρωμή να φαίνεται στις Δαπάνες.
        else if (!updExp.length && plan.expense) {
          const { error: expErr } = await expenses.insert(supabase, [expenses.row({ propertyId, userId }, { ...(plan.expense as unknown as expenses.ExpenseDraft), bill_id: payOff, paid: true })]);
          if (expErr) fail(EXPENSES); else add(EXPENSES);
        } else add(EXPENSES);
        if (!(await saved(MSG.calendarEvent, calendar.updateByBill(supabase, payOff, { status: 'paid' })))) fail(CALENDAR);
      } else fail(BILLS);
    }

    // ── 1) Λογαριασμός → bills. Παραλείπεται αν έγινε συμφωνία.
    if (plan.bill && !reconciled) {
      const { data: billRow, error: billErr } = await billStore.addReturning(supabase, propertyId, userId, plan.bill);
      if (billErr) fail(BILLS); else { billId = billRow?.id as string | undefined; add(BILLS); }
    }

    // ── 2) Έξοδο → expenses (σύνδεση bill_id), με προστασία διπλοεγγραφής.
    if (plan.expense && !reconciled) {
      const amt = plan.expense.amount as number;
      const cat = plan.expense.category as string;
      const d = plan.expense.date as string;
      const desc = plan.expense.description as string;
      const dup = await expenses.similar(supabase, propertyId, cat, amt, d);
      const isDup = dup.some(x => nrm(x.description as string) === nrm(desc));
      if (isDup) { add('Δαπάνες (υπάρχει ήδη)'); }
      else {
        // ═══ ΜΕΣΩ ΤΟΥ ΣΤΡΩΜΑΤΟΣ, ΟΧΙ ΜΕ ΩΜΟ ΑΝΤΙΚΕΙΜΕΝΟ ══════════════════
        // Εδώ γραφόταν η γραμμή στο χέρι, παρακάμπτοντας το `expenses.row()`.
        // Έλειπαν δύο πεδία που το στρώμα συμπληρώνει πάντα: το `paid` (που
        // έμενε NULL και διαβαζόταν ως «πληρωμένο», άρα ο σαρωμένος
        // λογαριασμός φαινόταν εξοφλημένος) και το `expense_group` (χωρίς το
        // οποίο η δαπάνη δεν εκπίπτει ποτέ). Δύο σφάλματα από μία παράκαμψη.
        const { error: expErr } = await expenses.insert(supabase, [expenses.row({ propertyId, userId }, { ...(plan.expense as unknown as expenses.ExpenseDraft), bill_id: billId })]);
        if (expErr) fail(EXPENSES); else add(EXPENSES);
      }
    }

    // ── 3) Ημερολόγιο → calendar_events. Ενα παλαιότερο ΠΕΑ δεν φέρνει δεύτερη
    // υπενθύμιση λήξης δίπλα στη λήξη του ισχύοντος, ούτε το ίδιο ΠΕΑ δεύτερη φορά.
    if (plan.calendar && !reconciled) {
      if (eventUnknown) fail(CALENDAR);
      else if (!eventOlder && !eventSame) {
        const { error: cErr } = await calendar.insert(supabase,
          plan.calendar.map(ev => calendar.row({ propertyId, userId }, 'scan', { ...ev, bill_id: billId })));
        if (cErr) fail(CALENDAR); else add(CALENDAR);
      }
    }

    // ── 4) Ενοικιαστής → tenants.
    // Η ΓΡΑΜΜΗ ΕΠΙΣΤΡΕΦΕΙ, ΓΙΑΤΙ ΑΠΟ ΑΥΤΗΝ ΓΕΝΝΙΟΥΝΤΑΙ ΤΑ ΧΡΗΜΑΤΑ. Ενα σαρωμένο
    // μισθωτήριο με έναρξη και ενοίκιο περιέχει όλα όσα χρειάζονται οι δόσεις·
    // χωρίς αυτές, η σάρωση έλεγε «Ενοικιαστής ✓» και η ταμειακή θέση έμενε
    // στο μηδέν μέχρι να ανοίξει κάποιος την καρτέλα των εισπράξεων.
    if (plan.tenant && tenantStep) {
      const syncFrom = async (row: unknown) => {
        if (!row) return;
        const { requested, error } = await syncInstalments(supabase, row as Tenant, propertyId, userId);
        // Το σφάλμα του upsert δεν πετιέται: η ετικέτα μπαίνει μόνο αν γράφτηκαν.
        if (error) fail(INSTALMENTS); else if (requested) add(INSTALMENTS);
      };
      if (tenantStep.mode === 'unknown') fail(TENANTS);
      else if (tenantStep.mode === 'update') {
        const { id, patch, older } = tenantStep;
        if (!Object.keys(patch).length) {
          // Τίποτα να αλλάξει: το χαρτί μένει στον Φάκελο και η αναφορά το λέει.
          if (older) add(`${TENANTS} (ισχύει νεότερο μισθωτήριο)`);
        } else {
          const { data: tRow, error: tErr } = await tenantStore.updateReturning(supabase, id, patch);
          if (tErr) fail(TENANTS);
          else {
            add(TENANTS);
            if (INSTALMENT_KEYS.some(k => k in patch)) await syncFrom(tRow);
          }
        }
      } else {
        // Νέος ενοικιαστής: πρώτα η σύμβαση επεξεργασίας (lib/legal/dpa.ts).
        // Χωρίς αποδοχή ο ενοικιαστής δεν γράφεται· τα υπόλοιπα της σάρωσης ναι.
        if (!(await ensureDpa(supabase))) fail(TENANTS);
        else {
          const { data: tRow, error: tErr } = await tenantStore.addReturning(supabase, propertyId, userId, stripEmpty(plan.tenant));
          if (tErr) fail(TENANTS); else { add(TENANTS); await syncFrom(tRow); }
        }
      }
    }

    // ── 5) Στοιχεία ακινήτου → user_properties (ΜΟΝΟ ασφαλείς στήλες).
    // Διαβάζουμε πρώτα τι υπάρχει: η σάρωση συμπληρώνει κενά, δεν σβήνει ό,τι
    // έγραψε ο χρήστης (fillOnlyEmpty — lib/billing/documents.ts). Χωρίς
    // ανάγνωση δεν ξέρουμε τι είναι κενό, άρα δεν γράφουμε.
    if (plan.property) {
      const cols = Object.keys(plan.property);
      const cur = await properties.oneWithError<Record<string, unknown>>(supabase, propertyId, cols.join(','), userId);
      if (cur.error) fail(PROPERTY_TARGET);
      else {
        const patch = fillOnlyEmpty(plan.property, cur.row);
        if (Object.keys(patch).length) {
          const { error: pErr } = await properties.update(supabase, propertyId, patch, userId);
          if (pErr) fail(PROPERTY_TARGET); else add(PROPERTY_TARGET);
        }
      }
    }
    // ── 5β) Ό,τι ΑΝΑΝΕΩΝΕΤΑΙ (ασφάλιση, κατηγορία ΠΕΑ) γράφεται με αντικατάσταση:
    // η νέα λήξη πρέπει να περάσει, η μη αναγνωρισμένη να μη σβήσει την παλιά.
    // ΚΑΙ ΜΟΝΟ ΑΝ ΤΟ ΧΑΡΤΙ ΕΙΝΑΙ ΝΕΟΤΕΡΟ (`replaceIfNewer`, `replaceIfNewerEvent`):
    // η αρχειοθέτηση του περσινού ασφαλιστηρίου δεν γυρίζει πίσω τη λήξη που
    // διαβάζουν οι προθεσμίες, η Νόα και τα email λήξης.
    const guard = plan.replaceIfNewer;
    if (plan.propertyReplace) {
      const patch = stripEmpty(plan.propertyReplace);
      if (Object.keys(patch).length) {
        // Χωρίς ανάγνωση δεν ξέρουμε αν το χαρτί είναι νεότερο: δεν αντικαθιστούμε.
        const cur = guard
          ? await properties.oneWithError<Record<string, unknown>>(supabase, propertyId, guard.column, userId)
          : null;
        const unknown = !!cur?.error || eventUnknown;
        const stale = (!!guard && isOlder(guard.value, cur?.row?.[guard.column])) || eventOlder;
        if (unknown) fail(PROPERTY_TARGET);
        else if (!stale) {
          const { error: pErr } = await properties.update(supabase, propertyId, patch, userId);
          if (pErr) fail(PROPERTY_TARGET); else add(PROPERTY_TARGET);
        }
      }
    }

    // ── 6) Ασφάλεια και πάροχοι → property_settings.
    //
    // ══ Η ΣΑΡΩΣΗ ΕΓΡΑΦΕ `null` ΠΑΝΩ ΑΠΟ ΟΣΑ ΕΙΧΕ ΓΡΑΨΕΙ Ο ΙΔΙΟΚΤΗΤΗΣ ══════════
    // ΤΟ ΣΦΑΛΜΑ. Το `plan.settings` της ασφάλισης έχει ΠΑΝΤΑ κι τα τρία κλειδιά
    // —εταιρεία, αριθμός συμβολαίου, ημερομηνία λήξης— με `null` όπου η
    // αναγνώριση δεν βρήκε τίποτα. Το `upsert` τα έστελνε όλα, οπότε μια σάρωση
    // που διάβασε μόνο την εταιρεία έσβηνε τον αριθμό συμβολαίου κι τη λήξη που
    // ο χρήστης είχε πληκτρολογήσει. Μαζί έφευγε κι η υπενθύμιση ανανέωσης, που
    // γεννιέται μόνο όταν υπάρχει ημερομηνία λήξης: το ασφαλιστήριο έληγε
    // αθόρυβα.
    //
    // ΤΟ ΣΩΣΤΟ ΕΡΓΑΛΕΙΟ ΕΙΝΑΙ ΤΟ `stripEmpty`, ΟΧΙ ΤΟ `fillOnlyEmpty`. Η
    // διπλανή διαδρομή του ακινήτου (βήμα 5) χρησιμοποιεί το δεύτερο, γιατί
    // εκεί μια θολή αναγνώριση ΔΕΝ πρέπει να διορθώσει τετραγωνικά που ξέρει ο
    // ιδιοκτήτης. Η ασφάλιση όμως ΑΝΑΝΕΩΝΕΤΑΙ κάθε χρόνο: το `fillOnlyEmpty` θα
    // κρατούσε για πάντα την περσινή λήξη κι το νέο ασφαλιστήριο δεν θα
    // περνούσε ποτέ. Ο κανόνας που θέλει αυτό το βήμα είναι «γράψε ό,τι ΔΙΑΒΑΣΕΣ,
    // μη σβήνεις ό,τι δεν διάβασες» — ακριβώς ό,τι κάνει το `stripEmpty`.
    // ΚΑΙ ΟΙ ΠΑΡΟΧΟΙ ΓΡΑΦΟΥΝ ΕΔΩ, ΜΕ ΤΟΝ ΑΝΤΙΘΕΤΟ ΚΑΝΟΝΑ. Ο πάροχος ρεύματος
    // συμπληρώνεται από τον πρώτο λογαριασμό (`settingsFill`, μόνο κενά): ένας
    // παλιός λογαριασμός δεν ξαναγράφει πάροχο που ο ιδιοκτήτης άλλαξε. Γι' αυτό
    // και η ετικέτα έρχεται από το σχέδιο· ήταν πάντα «Ασφάλεια».
    const settingsTarget = plan.settingsLabel || PROPERTY_TARGET;
    let settingsPatch: Record<string, unknown> = plan.settings ? stripEmpty(plan.settings) : {};
    if (guard && Object.keys(settingsPatch).length) {
      const { data: curIns, error: gErr } = await supabase.from('property_settings')
        .select(guard.column).eq('property_id', propertyId).maybeSingle();
      // Χωρίς ανάγνωση δεν ξέρουμε αν το χαρτί είναι νεότερο: δεν αντικαθιστούμε.
      if (gErr) fail(settingsTarget);
      if (gErr || isOlder(guard.value, (curIns as unknown as Record<string, unknown> | null)?.[guard.column])) settingsPatch = {};
    }
    if (plan.settingsFill) {
      const cols = Object.keys(plan.settingsFill);
      const { data: curSet, error: rErr } = await supabase.from('property_settings')
        .select(cols.join(',')).eq('property_id', propertyId).maybeSingle();
      // Χωρίς ανάγνωση δεν ξέρουμε τι υπάρχει, άρα «μόνο τα κενά» σημαίνει τίποτα.
      if (rErr) fail(settingsTarget);
      else Object.assign(settingsPatch, fillOnlyEmpty(plan.settingsFill, curSet as unknown as Record<string, unknown> | null));
    }
    if (Object.keys(settingsPatch).length) {
      const { error: sErr } = await supabase.from('property_settings')
        .upsert({ property_id: propertyId, user_id: userId, ...settingsPatch }, { onConflict: 'property_id' });
      if (sErr) fail(settingsTarget); else add(settingsTarget);
    }

    // ── 7) Κοινόχρηστα → bills_settings section 'common'. Στον μήνα του
    // ΧΑΡΤΙΟΥ (planDocSave: commonMonthOf), όχι της σάρωσης. Χωρίς ανάγνωση της
    // ενότητας δεν γράφουμε: η εγγραφή θα έσβηνε τους άλλους έντεκα μήνες.
    if (plan.commonMonthAmount != null || plan.commonMillesimi != null) {
      const { data: cur, error: kReadErr } = await settings.sectionWithError(supabase, propertyId, 'common', userId);
      if (kReadErr) fail(COMMON);
      else {
        const dd = cur || {};
        const history = Array.isArray(dd.history) ? [...(dd.history as string[])] : Array(12).fill('');
        if (plan.commonMonthAmount != null && plan.commonMonthIndex != null) history[plan.commonMonthIndex] = String(plan.commonMonthAmount);
        const nextData = { ...dd, history, ...(plan.commonMillesimi != null && !dd.millesimi ? { millesimi: String(plan.commonMillesimi) } : {}) };
        const { error: kErr } = await settings.put(supabase, propertyId, userId, 'common', nextData);
        if (kErr) fail(COMMON); else add(COMMON);
      }
    }

    // ── 8) Αρχειοθέτηση του πρωτότυπου, πάντα, με ΟΛΑ τα νούμερα πάνω του.
    if (plan.archive && file) {
      const archivePlan = input.archiveCategory
        ? { ...plan.archive, category: input.archiveCategory }
        : plan.archive;
      const r = await archiveScannedFile(
        archiveInputFrom(archivePlan, file, propertyId, userId, archivePlan.title || doc.provider));
      if (r.ok) add(FOLDER); else fail(FOLDER);
    }

    if (!written.length) return { saved: [], error: 'save', ...(failed.length ? { failed } : {}) };
    return { saved: written, ...(failed.length ? { failed } : {}) };
  } catch { return { saved: [], error: 'save' }; }
}

/** Επανεξαγωγή ώστε οι οθόνες να παίρνουν τον φάκελο από ΕΝΑ σημείο. */
export { archiveCategoryFor };
