// ═══════════════════════════════════════════════════════════════════════════
// Η ΑΠΟΔΟΧΗ ΤΟΥ ΔΩΡΟΥ ΤΗΣ ΚΛΗΡΩΣΗΣ ΑΞΙΟΛΟΓΗΣΗΣ
// ─────────────────────────────────────────────────────────────────────────
// Οι Όροι (app/terms, #klirosi): ο νικητής «ειδοποιείται με email … Αν δεν
// απαντήσει μέσα σε 14 ημέρες, το δώρο κληρώνεται εκ νέου». Η «απάντηση» είναι
// το «Αποδέχομαι το δώρο» με δήλωση «Είμαι άνω των 18» (απόφαση ιδιοκτήτη
// 10/11/2026). Η λογική ζει στη βάση (20261110133000): εδώ μόνο ό,τι
// χρειάζονται η σελίδα /doro/<διακριτικό> και η διαδρομή /api/doro.
// ═══════════════════════════════════════════════════════════════════════════
import type { SupabaseClient } from '@supabase/supabase-js';

/** Η σελίδα αποδοχής: /doro/<διακριτικό>. */
export const PRIZE_PATH = '/doro';

/** Ημέρες για την αποδοχή. Ίδιες με το `interval '14 days'` του migration και με τους Όρους. */
export const PRIZE_ACCEPT_DAYS = 14;

/** Μόνο ό,τι μοιάζει με δικό μας διακριτικό: 43 χαρακτήρες base64url (256 bit). */
export const isPrizeTokenShape = (t: unknown): t is string => typeof t === 'string' && /^[A-Za-z0-9_-]{43}$/.test(t);

export type PrizeFail = 'invalid' | 'expired' | 'used' | 'adult_required' | 'error';
export type PrizePeek = { ok: true; expiresAt: string } | { ok: false; kind: PrizeFail };
export type PrizeAccept = { ok: true } | { ok: false; kind: PrizeFail };

const KINDS: readonly PrizeFail[] = ['invalid', 'expired', 'used', 'adult_required'];
const kindOf = (v: unknown): PrizeFail => (KINDS as readonly unknown[]).includes(v) ? v as PrizeFail : 'error';

/** Τι δείχνει η σελίδα, χωρίς να αλλάζει τίποτα. Πελάτης υπηρεσίας. */
export async function peekPrize(db: SupabaseClient, token: string): Promise<PrizePeek> {
  if (!isPrizeTokenShape(token)) return { ok: false, kind: 'invalid' };
  const { data, error } = await db.rpc('peek_feedback_prize_token', { p_token: token });
  if (error || !data) return { ok: false, kind: 'error' };
  const d = data as { ok?: boolean; kind?: string; expires_at?: string };
  return d.ok && typeof d.expires_at === 'string' ? { ok: true, expiresAt: d.expires_at } : { ok: false, kind: kindOf(d.kind) };
}

/** Η αποδοχή από τον σύνδεσμο του email. Πελάτης υπηρεσίας. */
export async function acceptPrize(db: SupabaseClient, token: string, adult: boolean): Promise<PrizeAccept> {
  if (!isPrizeTokenShape(token)) return { ok: false, kind: 'invalid' };
  if (adult !== true) return { ok: false, kind: 'adult_required' };
  const { data, error } = await db.rpc('accept_feedback_prize_token', { p_token: token, p_adult: true });
  if (error || !data) return { ok: false, kind: 'error' };
  const d = data as { ok?: boolean; kind?: string };
  return d.ok ? { ok: true } : { ok: false, kind: kindOf(d.kind) };
}
