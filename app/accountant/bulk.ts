// ═══════════════════════════════════════════════════════════════════════════
// ΟΛΟΙ ΟΙ ΠΕΛΑΤΕΣ ΜΑΖΙ: ΤΑ ΠΟΣΑ ΤΟΥΣ ΚΑΙ ΤΑ ΑΡΧΕΙΑ ΤΟΥΣ
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΔΕΝ ΥΠΟΛΟΓΙΖΟΝΤΑΙ ΣΤΗ ΒΑΣΗ. Το έσοδο ενός ακινήτου δεν είναι άθροισμα
// στηλών: το ωμό `total` μιας διαμονής είναι άλλοτε ακαθάριστο και άλλοτε
// payout, ανάλογα με το `amount_basis`· το δηλωτέο ακαθάριστο βγαίνει μετά
// την αφαίρεση του τέλους ανθεκτικότητας, που δεν είναι έσοδο. Ο κανόνας ζει
// στο app/accountant/statement.ts, δοκιμασμένος. Μια δεύτερη γραφή του σε SQL
// θα έδινε δύο νούμερα για το ίδιο πράγμα και θα απέκλιναν την πρώτη φορά που
// άλλαζε ο ένας από τους δύο.
//
// Αρα η λίστα ζητά τις ΙΔΙΕΣ καταστάσεις που θα διάβαζε ο λογιστής ανοίγοντας
// τους πελάτες έναν έναν, περασμένες από τον ίδιο υπολογισμό.
//
// ΚΑΙ ΓΙΑΤΙ ΜΟΝΟ ΟΤΑΝ ΤΟ ΖΗΤΗΣΕΙ. Είναι ένα αίτημα ανά πελάτη. Ο λογιστής με
// ογδόντα πελάτες δεν πληρώνει ογδόντα αιτήματα κάθε φορά που ανοίγει τη
// λίστα: τα πληρώνει όταν πατήσει «Δείξε ποσά» ή «Κατέβασε τα όλα».
// ═══════════════════════════════════════════════════════════════════════════
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildZip, type ZipFile } from '@/lib/accounting/zip';
import { downloadFile, safeFilename } from '@/lib/core/download';
import { csvCell } from '@/lib/core/csv';
import { PACK_FILES } from '@/lib/accounting/meetingPack';
import {
  propertyLines, statementTotals, statementSheets, type PortalData, type PropertyLine,
} from './statement';

/** Η κατάσταση ενός πελάτη, όπως τη διαβάζει και η σελίδα του. */
export interface ClientStatement {
  ownerId: string;
  owner: string;
  lines: PropertyLine[];
  income: number;
  expenses: number;
  /** Καμία καταχώρηση: το μηδέν εδώ δεν είναι υπολογισμός, είναι απουσία. */
  hasEntries: boolean;
}

/**
 * ΠΟΣΑ ΑΙΤΗΜΑΤΑ ΤΡΕΧΟΥΝ ΜΑΖΙ.
 *
 * Τέσσερα: αρκετά για να μη σέρνεται μια λίστα ογδόντα πελατών, λίγα για να μη
 * μοιάζει η μαζική λήψη με επίθεση στη δική μας βάση.
 */
const LANES = 4;

async function inLanes<T, R>(items: readonly T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(LANES, items.length) }, async () => {
    for (let i = next++; i < items.length; i = next++) out[i] = await fn(items[i]);
  }));
  return out;
}

export interface BulkClient { ownerId: string; name: string; token: string | null }

/**
 * Οι καταστάσεις όλων των πελατών για μια χρήση.
 *
 * ΟΠΟΙΟΣ ΔΕΝ ΑΠΑΝΤΗΣΕ ΛΕΙΠΕΙ, ΔΕΝ ΜΗΔΕΝΙΖΕΤΑΙ. Ενας πελάτης του οποίου ο
 * σύνδεσμος ανακλήθηκε ή η κλήση απέτυχε δεν πρέπει να εμφανιστεί με «0,00€»:
 * το μηδέν διαβάζεται ως μέτρηση.
 */
export async function loadStatements(
  db: SupabaseClient, clients: readonly BulkClient[], year: number,
): Promise<Map<string, ClientStatement>> {
  const withToken = clients.filter(c => c.token);
  const results = await inLanes(withToken, async (c) => {
    const { data, error } = await db.rpc('get_accountant_data', { p_token: c.token, p_year: year });
    if (error || !data) return null;
    const d = data as PortalData;
    const lines = propertyLines(d.properties || [], year);
    const totals = statementTotals(lines);
    return {
      ownerId: c.ownerId,
      owner: d.owner || c.name,
      lines,
      income: totals.income,
      expenses: totals.expenses,
      hasEntries: totals.hasEntries,
    } as ClientStatement;
  });
  const map = new Map<string, ClientStatement>();
  for (const r of results) if (r) map.set(r.ownerId, r);
  return map;
}

/** Το όνομα του βιβλίου ενός πελάτη μέσα στον φάκελο. */
export const bookName = (owner: string, year: number) =>
  `${safeFilename(`Κατάσταση χρήσης ${year} ${owner}`)}.xlsx`;

// ═══════════════════════════════════════════════════════════════════════════
// ΔΥΟ ΠΕΛΑΤΕΣ ΜΕ ΤΟ ΙΔΙΟ ΟΝΟΜΑ ΕΧΑΝΑΝ ΤΟ ΕΝΑ ΒΙΒΛΙΟ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΣΦΑΛΜΑ. Το όνομα του αρχείου βγαίνει από το ΟΝΟΜΑ του πελάτη. Δύο
// «Γεώργιος Παπαδόπουλος» —που σε φάκελο ογδόντα πελατών δεν είναι σπάνιο—
// έδιναν την ίδια διαδρομή μέσα στο zip. Τα εργαλεία αποσυμπίεσης κρατούν το
// ένα: ο λογιστής κατέβαζε «79 βιβλία» κι έβρισκε 78, χωρίς να του το πει
// τίποτα. Το χειρότερο δεν είναι το χαμένο αρχείο· είναι ότι το πλήθος που
// ανακοινώνει η οθόνη δεν συμφωνεί με το περιεχόμενο.
//
// Η ΣΥΓΚΡΟΥΣΗ ΚΡΙΝΕΤΑΙ ΣΤΗΝ ΤΕΛΙΚΗ ΔΙΑΔΡΟΜΗ, ΟΧΙ ΣΤΟ ΟΝΟΜΑ. Το `safeFilename`
// καθαρίζει χαρακτήρες, οπότε δύο ΔΙΑΦΟΡΕΤΙΚΑ ονόματα μπορούν να καταλήξουν
// στο ίδιο αρχείο («Α/Β Παπαδόπουλος» κι «Α Β Παπαδόπουλος»). Ελέγχεται ό,τι
// θα γραφτεί πράγματι.
//
// ΚΑΙ Η ΔΙΑΚΡΙΣΗ ΕΙΝΑΙ ΑΥΤΗ ΠΟΥ ΞΕΡΕΙ ΚΑΘΕ ΑΝΘΡΩΠΟΣ: «(2)», «(3)», όπως κάθε
// διαχειριστής αρχείων. Το αναγνωριστικό του πελάτη θα ήταν μοναδικό αλλά
// αδιάβαστο — κι αυτό το όνομα το διαβάζει άνθρωπος που ψάχνει φάκελο.
// ═══════════════════════════════════════════════════════════════════════════

/** Τα ονόματα των βιβλίων, ένα ανά πελάτη, ΕΓΓΥΗΜΕΝΑ διαφορετικά μεταξύ τους. */
export function bookNames(owners: readonly string[], year: number): string[] {
  const seen = new Map<string, number>();
  return owners.map(owner => {
    const base = bookName(owner, year);
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : base.replace(/\.xlsx$/, ` (${n}).xlsx`);
  });
}

/**
 * Κατεβάζει έναν φάκελο με ΕΝΑ βιβλίο ανά πελάτη.
 *
 * ΓΙΑΤΙ ΧΩΡΙΣΤΑ ΑΡΧΕΙΑ ΚΑΙ ΟΧΙ ΕΝΑ ΒΙΒΛΙΟ ΜΕ ΦΥΛΛΑ. Ο λογιστής αρχειοθετεί ανά
 * πελάτη: ένα βιβλίο με ογδόντα φύλλα θα έπρεπε να το σπάσει μόνος του, ένα
 * αρχείο τη φορά, για να το βάλει στον φάκελο του καθενός.
 *
 * @returns πόσα βιβλία μπήκαν. Μηδέν όταν δεν υπήρχε τίποτα να κατέβει.
 */
export async function downloadAll(
  statements: readonly ClientStatement[], year: number, issued: string,
): Promise<number> {
  if (!statements.length) return 0;
  // Η βιβλιοθήκη του Excel φορτώνεται ΜΕ ΤΟ ΠΑΤΗΜΑ. Είναι 2,5 MB και ο λογιστής
  // που μπαίνει για να δει ποιον να κυνηγήσει δεν την ανοίγει ποτέ.
  const { xlsxBytes } = await import('@/app/dashboard/components/sheets');
  // Τα ονόματα βγαίνουν ΟΛΑ ΜΑΖΙ, γιατί η μοναδικότητα είναι ιδιότητα του
  // συνόλου: ένα όνομα δεν μπορεί να ξέρει μόνο του αν συγκρούεται.
  const paths = bookNames(statements.map(s => s.owner), year);
  const files: ZipFile[] = [];
  for (const [i, s] of statements.entries()) {
    files.push({
      path: paths[i],
      data: await xlsxBytes(statementSheets({ owner: s.owner, year, issued, lines: s.lines })),
    });
  }
  downloadFile(new Blob([buildZip(files).slice().buffer], { type: 'application/zip' }),
    `${safeFilename(`Καταστάσεις πελατών ${year}`)}.zip`);
  return files.length;
}

// ═══════════════════════════════════════════════════════════════════════════
// ΟΛΟΙ ΟΙ ΦΑΚΕΛΟΙ ΤΗΣ ΧΡΗΣΗΣ, ΣΕ ΕΝΑ ZIP
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΥΠΗΡΧΕ. Το «Κατέβασε τα όλα» έδινε τα βιβλία εσόδων και δαπανών. Ο πλήρης
// φάκελος (Ε2, έλεγχος, παραστατικά, κωδικοί) κατέβαινε ένας ένας: ογδόντα
// πατήματα τον Ιούνιο.
//
// ΓΙΑΤΙ ΣΤΟΝ ΠΕΡΙΗΓΗΤΗ ΚΑΙ ΟΧΙ ΣΤΟΝ ΔΙΑΚΟΜΙΣΤΗ. Οι φάκελοι είναι ήδη έτοιμα zip
// που έστειλαν οι πελάτες· δεν υπάρχει τίποτα να υπολογιστεί, μόνο να μπουν
// μαζί. Μια συνάρτηση διακομιστή θα κουβαλούσε το ίδιο υλικό δύο φορές (από τον
// χώρο αρχείων σε αυτήν και από αυτήν στον λογιστή) και θα ανέβαζε το βάρος
// του docs/perf/server.json. Εδώ τα bytes περνούν μία φορά, με τα δικαιώματα
// του ίδιου του λογιστή: ό,τι δεν θα κατέβαζε ένα ένα, δεν κατεβαίνει ούτε μαζί.
//
// ΤΟ ΟΡΙΟ. Το zip χτίζεται στη μνήμη. Πάνω από `BUNDLE_MAX_BYTES` (με το μέγεθος
// που δήλωσε κάθε φάκελος) δεν στήνεται ένα αρχείο-τέρας που θα κρεμάσει την
// καρτέλα: οι φάκελοι κατεβαίνουν ένας ένας με τη σειρά και το λέμε.
// ═══════════════════════════════════════════════════════════════════════════

/** Πάνω από τόσα bytes συνολικά, οι φάκελοι κατεβαίνουν ένας ένας. */
export const BUNDLE_MAX_BYTES = 150_000_000;

/** Ένας φάκελος που έστειλε πελάτης, όπως τον ξέρει η λίστα. */
export interface PackRef {
  ownerId: string;
  name: string;
  afm: string;
  path: string;
  sizeBytes: number | null;
  /** Η κατάσταση του πελάτη, για τον κατάλογο: «Έτοιμος», «Δεν κλείνει»… */
  readiness: string;
  /** Η σύγκριση με το προσυμπληρωμένο, με τα λόγια της λίστας. */
  aade: string;
  missingCount: number;
  sharedAt: string | null;
}

export type BundleMode = 'one' | 'sequential';

/** Πόσο μετρά φάκελος χωρίς δηλωμένο μέγεθος (παλιά γραμμή): συντηρητικά, όσο ένας βαρύς. */
const UNKNOWN_PACK_BYTES = 10_000_000;

/** Ένα zip ή ένας ένας. */
export function bundleMode(refs: readonly PackRef[], max = BUNDLE_MAX_BYTES): BundleMode {
  return refs.reduce((s, r) => s + (r.sizeBytes ?? UNKNOWN_PACK_BYTES), 0) > max ? 'sequential' : 'one';
}

/** Οι διαδρομές μέσα στο zip, μία ανά φάκελο, εγγυημένα διαφορετικές. */
export function bundlePaths(refs: readonly PackRef[], year: number): string[] {
  const seen = new Map<string, number>();
  return refs.map(r => {
    const base = `${safeFilename(r.name)} · ${PACK_FILES.zip(year, r.afm)}`;
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : base.replace(/\.zip$/, ` (${n}).zip`);
  });
}

/** Ο κατάλογος του zip: ποιος, ποιο ΑΦΜ, πόσο έτοιμος και τι λείπει. */
export function bundleIndex(refs: readonly PackRef[], paths: readonly string[], failed: ReadonlySet<number> = new Set()): string {
  const head = ['Πελάτης', 'ΑΦΜ', 'Κατάσταση', 'Σύγκριση με το προσυμπληρωμένο Ε2', 'Τι λείπει', 'Στάλθηκε', 'Αρχείο'];
  const day = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');
  const rows = refs.map((r, i) => [
    r.name, r.afm, r.readiness, r.aade, String(r.missingCount), day(r.sharedAt),
    failed.has(i) ? 'Δεν κατέβηκε: ζήτησε νέο σύνδεσμο ή κατέβασέ τον από τη λίστα' : paths[i],
  ]);
  return [head, ...rows].map(cols => cols.map(c => csvCell(c)).join(';')).join('\r\n');
}

export interface BundleResult { mode: BundleMode; done: number; failed: string[] }

/**
 * Κατεβάζει τους φακέλους. `fetchPack` είναι η ίδια ανάγνωση με το κουμπί
 * κάθε πελάτη (`fileBytes`): αν ο πελάτης ανακάλεσε τον σύνδεσμο, ο φάκελός
 * του δεν κατεβαίνει ούτε εδώ.
 */
export async function downloadPacks(
  refs: readonly PackRef[], year: number,
  fetchPack: (path: string) => Promise<Uint8Array | null>,
  onProgress?: (done: number, total: number) => void,
  save: (blob: Blob, name: string) => void = (blob, name) => { downloadFile(blob, name, 'application/zip'); },
): Promise<BundleResult> {
  const mode = bundleMode(refs);
  const paths = bundlePaths(refs, year);
  const failed = new Set<number>();
  const files: ZipFile[] = [];
  // ΕΝΑΣ ΕΝΑΣ ΚΑΙ ΟΧΙ ΣΕ ΛΩΡΙΔΕΣ. Κάθε φάκελος είναι μεγάλος· τέσσερις μαζί στη
  // μνήμη δεν κερδίζουν χρόνο, μόνο αυξάνουν το ύψος της κορυφής.
  for (const [i, r] of refs.entries()) {
    const bytes = await fetchPack(r.path);
    onProgress?.(i + 1, refs.length);
    if (!bytes) { failed.add(i); continue; }
    if (mode === 'one') files.push({ path: paths[i], data: bytes });
    else save(new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'application/zip' }), paths[i]);
  }
  if (mode === 'one' && files.length) {
    files.unshift({ path: `00 Κατάλογος φακέλων ${year}.csv`, data: '\uFEFF' + bundleIndex(refs, paths, failed) });
    save(new Blob([buildZip(files).slice().buffer], { type: 'application/zip' }), `${safeFilename(`Φάκελοι πελατών ${year}`)}.zip`);
  }
  return { mode, done: refs.length - failed.size, failed: [...failed].map(i => refs[i].name) };
}

// ═══════════════════════════════════════════════════════════════════════════
// ΠΟΤΕ ΚΙΝΗΘΗΚΕ ΤΕΛΕΥΤΑΙΑ ΦΟΡΑ Ο ΦΑΚΕΛΟΣ
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΦΡΑΣΗ ΚΑΙ ΟΧΙ ΗΜΕΡΟΜΗΝΙΑ. Ο λογιστής δεν ρωτά «ποια μέρα», ρωτά «είναι
// ζωντανός ο φάκελος;». Το «12/03/2026» τον βάζει να μετρήσει· το «πριν από 5
// μήνες» απαντά μόνο του. Η ακριβής ημερομηνία μπαίνει δίπλα από ένα σημείο
// και μετά, όπου η φράση παύει να είναι αρκετή.
// ═══════════════════════════════════════════════════════════════════════════

const DAY = 86400000;

/** Πόσο παλιά είναι η τελευταία καταχώρηση, με λόγια. */
export function lastMove(iso: string | null, now: number = Date.now()): string {
  const t = iso ? Date.parse(iso) : NaN;
  // ΚΑΜΙΑ ΚΑΤΑΧΩΡΗΣΗ ΔΕΝ ΕΙΝΑΙ «ΠΡΙΝ ΑΠΟ ΠΟΛΥ ΚΑΙΡΟ». Ο πελάτης που δεν
  // καταχώρησε ΠΟΤΕ τίποτα είναι άλλη περίπτωση από εκείνον που σταμάτησε.
  if (!isFinite(t)) return 'Καμία καταχώρηση ακόμη';
  const days = Math.floor((now - t) / DAY);
  const when = days <= 0 ? 'σήμερα'
    : days === 1 ? 'χθες'
      : days < 30 ? `πριν από ${days} ημέρες`
        : days < 60 ? 'πριν από έναν μήνα'
          : days < 365 ? `πριν από ${Math.floor(days / 30)} μήνες`
            : days < 730 ? 'πριν από έναν χρόνο'
              : `πριν από ${Math.floor(days / 365)} χρόνια`;
  return `Τελευταία καταχώρηση ${when}`;
}
