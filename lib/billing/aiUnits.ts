// ═══════════════════════════════════════════════════════════════════════════
// Η ΜΟΝΑΔΑ ΤΗΣ ΝΟΑΣ ΚΑΙ ΤΗΣ ΣΑΡΩΣΗΣ: ΠΟΙΟΣ ΜΕΤΡΗΤΗΣ, ΠΟΤΕ, ΜΕ ΠΟΙΟ ΚΛΕΙΔΙ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΚΛΕΙΝΕΙ (05.10.2026). Τον μετρητή τον διάλεγε το σώμα του
// αιτήματος (`kind: 'scan'`), τα όρια ταξίδευαν ως ορίσματα προς τη βάση, η
// επανάχρηση αρχείου ζούσε στη μνήμη κάθε στιγμιοτύπου και η επιστροφή
// αφαιρούσε «μία» χωρίς να ξέρει ποια. Η 20261005150000 μεταφέρει την κρίση στη
// βάση (`take_ai_unit`, `take_scan_unit`, `refund_ai_unit`, μόνο για τον ρόλο
// υπηρεσίας). Εδώ μένει ό,τι κρίνει ο διακομιστής της εφαρμογής:
//
//   · ΠΟΙΟΣ ΜΕΤΡΗΤΗΣ. Απόφαση CEO 05.10.2026: σάρωση ΜΟΝΟ όταν το σώμα έχει
//     πραγματικό αρχείο (εικόνα ή PDF σε base64) στο σχήμα της σάρωσης
//     (lib/assistant/scanShape.ts). Αλλιώς ερώτηση στη Νόα. Το `kind` του
//     πελάτη ΔΕΝ διαβάζεται: ούτε μια ερώτηση που λέει «σάρωση» περνά χωρίς
//     μέτρημα, ούτε μια σάρωση που δεν το λέει χρεώνεται ως ερώτηση.
//   · ΤΟ ΚΛΕΙΔΙ. Το φτιάχνει ο διακομιστής, ένα ανά αίτημα. Με αυτό γίνεται η
//     επιστροφή, μία φορά.
//   · ΤΟ ΑΠΟΤΥΠΩΜΑ ΤΟΥ ΑΡΧΕΙΟΥ, για την επανάχρηση (έως τρεις χρήσεις μέσα
//     σε πέντε λεπτά μετρούν μία σάρωση· ο κανόνας ζει στη βάση).
//
// ΓΙΑΤΙ ΣΤΟ lib/. Το κλειδί υπηρεσίας εισάγεται μόνο από lib/ ή route.ts
// (scripts/guard-service-role.mjs) και η διαδρομή λέγεται route.tsx. Ο πελάτης
// της βάσης περνά ως όρισμα, ώστε ο έλεγχος να δοκιμάζει την ΑΛΗΘΙΝΗ
// συνάρτηση με ψεύτικη βάση (aiUnits.test.ts).
// ═══════════════════════════════════════════════════════════════════════════
import { createHash, randomUUID } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/service';
import { scanShapeError } from '@/lib/assistant/scanShape';
import { refundOutcome, REFUND_LOG } from './aiRefund';

export type Meter = 'scan' | 'ai';

type Block = { type?: unknown; source?: { type?: unknown; media_type?: unknown; data?: unknown } };

/** Οι δομές αρχείου του αιτήματος, όπου κι αν βρίσκονται. */
function fileBlocks(messages: unknown): Block[] {
  if (!Array.isArray(messages)) return [];
  const out: Block[] = [];
  for (const m of messages) {
    const content = (m as { content?: unknown })?.content;
    if (!Array.isArray(content)) continue;
    for (const c of content as Block[]) if (c?.type === 'image' || c?.type === 'document') out.push(c);
  }
  return out;
}

/** Πραγματικό αρχείο: base64 με περιεχόμενο, εικόνα ή PDF. */
function isRealFile(b: Block): boolean {
  const s = b.source;
  if (!s || s.type !== 'base64' || typeof s.data !== 'string' || s.data.length === 0) return false;
  if (typeof s.media_type !== 'string') return false;
  return b.type === 'image' ? s.media_type.startsWith('image/') : s.media_type === 'application/pdf';
}

/**
 * Ποιος μετρητής χρεώνεται. Το `kind` του πελάτη αγνοείται πλήρως: σάρωση
 * είναι ό,τι έχει το σχήμα της σάρωσης ΚΑΙ μόνο πραγματικά αρχεία μέσα.
 */
export function meterKind(body: { messages?: unknown; system?: unknown }): Meter {
  if (scanShapeError(body)) return 'ai';
  const files = fileBlocks(body.messages);
  return files.length > 0 && files.every(isRealFile) ? 'scan' : 'ai';
}

/** Το αποτύπωμα του πρώτου αρχείου (sha256, hex), ή `null` χωρίς αρχείο. */
export function fileHash(body: { messages?: unknown }): string | null {
  for (const b of fileBlocks(body.messages)) {
    const data = b.source?.data;
    if (typeof data === 'string' && data.length) return createHash('sha256').update(data).digest('hex');
  }
  return null;
}

/** Νέο κλειδί αιτήματος. Ποτέ από τον πελάτη. */
export const newRequestId = (): string => randomUUID();

/** Η απάντηση της `take_ai_unit` / `take_scan_unit`. */
export type Unit = {
  allowed?: boolean; reason?: string; rank?: number; reuse?: boolean;
  month?: number; month_limit?: number | null; day?: number; day_limit?: number;
};

type Rpc = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> };

/**
 * Χρεώνει μία μονάδα ΠΡΙΝ από την κλήση στον πάροχο. `null` σημαίνει ότι η
 * βάση δεν απάντησε: ο καλών κλείνει (503), δεν ανοίγει.
 */
export async function takeUnit(
  meter: Meter, userId: string, requestId: string, hash: string | null,
  db: Rpc = createServiceClient(),
): Promise<Unit | null> {
  try {
    const { data, error } = meter === 'scan'
      ? await db.rpc('take_scan_unit', { p_uid: userId, p_request_id: requestId, p_file_hash: hash })
      : await db.rpc('take_ai_unit', { p_uid: userId, p_request_id: requestId });
    if (error || data == null) {
      if (error) console.error('[aiUnits] η χρέωση δεν απάντησε:', error.message);
      return null;
    }
    return data as Unit;
  } catch (err) {
    console.error('[aiUnits] η χρέωση δεν απάντησε:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Γυρίζει ό,τι χρέωσε ΑΥΤΟ το αίτημα. Μία φορά: δεύτερη κλήση με το ίδιο
 * κλειδί δεν κάνει τίποτα στη βάση. Δεν πετά ποτέ (καλείται μέσα σε χειρισμό
 * σφάλματος). `true` μόνο αν η βάση όντως επέστρεψε μονάδα.
 *
 * @param pool αν πιστώνεται και η κοινή δεξαμενή· η βάση την πιστώνει μόνο
 *   αν το αίτημα τη χρέωσε (lib/assistant/upstream.ts κρίνει το `pool`).
 */
export async function refundUnit(
  userId: string, requestId: string, pool: boolean,
  db: Rpc = createServiceClient(),
): Promise<boolean> {
  try {
    return refundOutcome(await db.rpc('refund_ai_unit', { p_uid: userId, p_request_id: requestId, p_pool: pool }));
  } catch (err) {
    console.error(REFUND_LOG, err instanceof Error ? err.message : err);
    return false;
  }
}
