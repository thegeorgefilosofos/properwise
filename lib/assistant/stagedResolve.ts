// ═══════════════════════════════════════════════════════════════════════════
// Η ΠΛΕΥΡΑ ΤΟΥ ΔΙΑΚΟΜΙΣΤΗ ΓΙΑ ΤΟ ΠΡΟΣΩΡΙΝΟ PDF
// ─────────────────────────────────────────────────────────────────────────
// Χωριστά από το stagedFile.ts, που το διαβάζει και η σάρωση στον περιηγητή:
// το pdf-lib (~0,5 MB) έμπαινε αλλιώς και στη σελίδα του πίνακα ελέγχου και ο
// έλεγχος βάρους του διακομιστή κοκκίνιζε. Εδώ το φορτώνει μόνο το
// /api/anthropic.
// ═══════════════════════════════════════════════════════════════════════════
import { STAGE_BUCKET, STAGE_MAX_BYTES, stagedPathOk } from './stagedFile';

// ── ΤΟ ΠΟΛΥΣΕΛΙΔΟ PDF ΚΡΑΤΑ ΤΙΣ ΠΡΩΤΕΣ ΣΕΛΙΔΕΣ ─────────────────────────────
// Ο πάροχος δέχεται έως 100 σελίδες ανά αίτημα και κάθε σελίδα διαβάζεται ως
// εικόνα· ένα σκαναρισμένο αρχείο 300 σελίδων δεν θα απαντούσε ποτέ μέσα στο
// χρονικό όριο της συνάρτησης. Ό,τι χρειάζεται η ανάγνωση (εκδότης, ποσό,
// περίοδος, ΑΤΑΚ, ο πίνακας του Ε9) βρίσκεται στις πρώτες σελίδες. Πάνω από
// SCAN_MAX_PAGES κρατάμε αυτές και ο χρήστης δεν βλέπει σφάλμα.
export const SCAN_MAX_PAGES = 30;

/** Τα πρώτα `max` φύλλα του PDF. Αν δεν ανοίγει (κρυπτογραφημένο, χαλασμένο), επιστρέφει το αρχικό. */
export async function firstPages(bytes: Uint8Array, max = SCAN_MAX_PAGES): Promise<{ bytes: Uint8Array; pages: number | null; trimmed: boolean }> {
  try {
    const { PDFDocument } = await import('pdf-lib');
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
    const pages = src.getPageCount();
    if (pages <= max) return { bytes, pages, trimmed: false };
    const out = await PDFDocument.create();
    const copied = await out.copyPages(src, Array.from({ length: max }, (_, i) => i));
    copied.forEach(p => out.addPage(p));
    return { bytes: await out.save(), pages, trimmed: true };
  } catch {
    return { bytes, pages: null, trimmed: false };
  }
}

type Source = { type?: unknown; path?: unknown; media_type?: unknown; data?: unknown };
type Block = { type?: unknown; source?: Source };

/** Τα μπλοκ εγγράφου που δείχνουν σε προσωρινό αρχείο. */
export function stagedBlocks(messages: unknown): Block[] {
  if (!Array.isArray(messages)) return [];
  const out: Block[] = [];
  for (const m of messages) {
    const content = (m as { content?: unknown })?.content;
    if (!Array.isArray(content)) continue;
    for (const c of content as Block[]) if (c?.type === 'document' && c.source?.type === 'staged') out.push(c);
  }
  return out;
}

type Storage = {
  from: (bucket: string) => {
    download: (path: string) => PromiseLike<{ data: Blob | null; error: { message: string } | null }>;
    remove: (paths: string[]) => PromiseLike<unknown>;
  };
};

/**
 * Αντικαθιστά κάθε προσωρινό PDF με το περιεχόμενό του σε base64. `false` αν
 * μια διαδρομή δεν ανήκει στον χρήστη ή δεν διαβάζεται: το αίτημα απορρίπτεται
 * πριν από κάθε χρέωση. Το αρχείο σβήνεται μόλις διαβαστεί.
 */
export async function resolveStaged(body: { messages?: unknown }, uid: string, storage: Storage): Promise<boolean> {
  const blocks = stagedBlocks(body.messages);
  for (const b of blocks) {
    const path = b.source?.path;
    if (!stagedPathOk(path, uid)) return false;
    const bucket = storage.from(STAGE_BUCKET);
    const { data, error } = await bucket.download(path);
    void Promise.resolve(bucket.remove([path])).catch(() => {});
    if (error || !data || data.size === 0 || data.size > STAGE_MAX_BYTES) return false;
    const raw = Buffer.from(await data.arrayBuffer());
    if (raw.subarray(0, 5).toString('latin1') !== '%PDF-') return false;
    const { bytes } = await firstPages(raw);
    b.source = { type: 'base64', media_type: 'application/pdf', data: Buffer.from(bytes).toString('base64') };
  }
  return true;
}
