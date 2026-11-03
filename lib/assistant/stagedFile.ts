// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΜΕΓΑΛΟ PDF ΠΕΡΝΑ ΑΠΟ ΤΟΝ ΧΩΡΟ ΑΡΧΕΙΩΝ, ΟΧΙ ΑΠΟ ΤΟ ΣΩΜΑ ΤΟΥ ΑΙΤΗΜΑΤΟΣ
// ─────────────────────────────────────────────────────────────────────────
// Το σώμα ενός αιτήματος προς τη συνάρτηση φτάνει έως 4,5 MB. Ενα PDF 4 MB σε
// base64 το ξεπερνά και κοβόταν πριν φτάσει εδώ: ο χρήστης διάβαζε «η υπηρεσία
// ανάγνωσης δεν είναι διαθέσιμη». Τώρα η εφαρμογή ανεβάζει το PDF στον δικό
// του φάκελο του χρήστη (`<uid>/scan-tmp/<uuid>.pdf`, bucket property-files,
// όριο 20 MB) και στέλνει μόνο τη διαδρομή. Ο διακομιστής το διαβάζει με τη
// συνεδρία του ίδιου χρήστη (RLS), το σβήνει αμέσως και το βάζει στο αίτημα
// ως base64· από εκεί και πέρα μετρητής και αποτύπωμα δουλεύουν όπως πριν.
//
// Η διαδρομή κρίνεται αυστηρά: μόνο ο φάκελος scan-tmp του ίδιου χρήστη, μόνο
// uuid.pdf. Καμία άλλη διαδρομή, κανένα URL από τον πελάτη.
// ═══════════════════════════════════════════════════════════════════════════

/** Ο φάκελος των προσωρινών PDF προς ανάγνωση. */
export const STAGE_DIR = 'scan-tmp';
/** Το bucket, το ίδιο με τον Φάκελο του ακινήτου (όριο 20 MB, δέχεται PDF). */
export const STAGE_BUCKET = 'property-files';
/** Το μεγαλύτερο PDF που διαβάζεται, ίσο με το όριο του bucket. */
export const STAGE_MAX_BYTES = 20 * 1024 * 1024;

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const PATH_RE = new RegExp(`^(${UUID})/${STAGE_DIR}/${UUID}\\.pdf$`);

/** Η προσωρινή διαδρομή ενός χρήστη για ένα νέο PDF. */
export const stagePathFor = (uid: string, id: string): string => `${uid}/${STAGE_DIR}/${id}.pdf`;

/** Αληθές μόνο για διαδρομή scan-tmp του ίδιου του χρήστη. */
export function stagedPathOk(path: unknown, uid: string): path is string {
  if (typeof path !== 'string') return false;
  const m = PATH_RE.exec(path);
  return !!m && m[1] === uid;
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
    const bytes = Buffer.from(await data.arrayBuffer());
    if (bytes.subarray(0, 5).toString('latin1') !== '%PDF-') return false;
    b.source = { type: 'base64', media_type: 'application/pdf', data: bytes.toString('base64') };
  }
  return true;
}
