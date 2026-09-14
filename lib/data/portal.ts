// ═══════════════════════════════════════════════════════════════════════════
// Ο ΣΥΝΔΕΣΜΟΣ ΤΗΣ ΠΥΛΗΣ ΕΧΕΙ ΕΝΑ ΣΠΙΤΙ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΚΕΝΟ ΠΟΥ ΤΟ ΓΕΝΝΗΣΕ. Ο πίνακας `portal_links` διαβαζόταν και γραφόταν
// ΜΟΝΟ από την οθόνη κοινοποίησης — έξι κλήσεις μέσα σε ένα component. Οποια
// άλλη οθόνη ήθελε τον σύνδεσμο (και τον θέλει η οθόνη των ενοικίων, για να
// τον στείλει στον μισθωτή) θα έγραφε το δικό της ερώτημα, με τις δικές της
// στήλες και θα ξεχνούσε το `user_id` κάποια στιγμή.
//
// ── Η ΔΙΕΥΘΥΝΣΗ ΤΗΣ ΠΥΛΗΣ ΔΕΝ ΒΓΑΙΝΕΙ ΑΠΟ ΤΟΝ ΠΕΡΙΗΓΗΤΗ ──────────────────
// Ηταν `window.location.origin + '/portal/' + token`. Δουλεύει όσο ο σύνδεσμος
// μένει στην οθόνη — αλλά αυτός ο σύνδεσμος ΦΕΥΓΕΙ σε άλλον άνθρωπο. Ο
// ιδιοκτήτης που άνοιξε την εφαρμογή από διεύθυνση προεπισκόπησης θα έστελνε
// στον μισθωτή του διεύθυνση προεπισκόπησης, που αύριο δεν απαντά. Η κανονική
// διεύθυνση ζει στο lib/core/site.ts, μία φορά και έρχεται από το περιβάλλον.
// ═══════════════════════════════════════════════════════════════════════════
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PortalLinksRow } from '@/lib/supabase/tables';
import type { DbError } from '@/lib/supabase/writeResult';
import { readOne, type ReadOneResult } from './read';
import { siteUrl } from '@/lib/core/site';

const TABLE = 'portal_links';

export type Db = SupabaseClient;

/** Οι στήλες που χρειάζεται κάθε οθόνη που αγγίζει την πύλη. */
export const LINK_COLUMNS = 'token,payment_link,pin_hash,tenant_id,expires_at';

export type LinkRow = Pick<PortalLinksRow, 'token' | 'payment_link' | 'pin_hash' | 'tenant_id'>
  & { expires_at: string | null };

/** Η διεύθυνση που δίνεται στον μισθωτή. Κενό όταν δεν υπάρχει σύνδεσμος. */
export const portalUrl = (token: string | null | undefined): string =>
  token ? siteUrl(`/portal/${token}`) : '';

/** Ο σύνδεσμος αυτού του ακινήτου, ή τίποτα όταν δεν έχει ενεργοποιηθεί. */
export async function link(db: Db, propertyId: string, userId: string): Promise<ReadOneResult<LinkRow>> {
  return readOne<LinkRow>(db.from(TABLE).select(LINK_COLUMNS)
    .eq('property_id', propertyId).eq('user_id', userId).maybeSingle());
}

/** Η διεύθυνση πληρωμής που δείχνει η πύλη στον μισθωτή. */
export function savePaymentLink(
  db: Db, propertyId: string, userId: string, value: string,
): PromiseLike<{ error: DbError | null }> {
  return db.from(TABLE).update({ payment_link: value.trim() || null })
    .eq('property_id', propertyId).eq('user_id', userId);
}

/** Γέννηση συνδέσμου, δεμένου εξαρχής στον μισθωτή που μένει τώρα. */
export function create(
  db: Db, propertyId: string, userId: string, tenantId: string | null,
): PromiseLike<{ data: { token: string; tenant_id: string | null } | null; error: DbError | null }> {
  return db.from(TABLE).insert({ property_id: propertyId, user_id: userId, tenant_id: tenantId })
    .select('token, tenant_id').single();
}

/** Δέσιμο υπάρχοντος συνδέσμου σε μισθωτή που δεν είχε δεθεί ποτέ. */
export function bindTenant(
  db: Db, propertyId: string, userId: string, tenantId: string,
): PromiseLike<{ error: DbError | null }> {
  return db.from(TABLE).update({ tenant_id: tenantId })
    .eq('property_id', propertyId).eq('user_id', userId);
}

/**
 * Νέος σύνδεσμος για νέο μισθωτή.
 *
 * ΑΛΛΑΖΕΙ ΚΑΙ ΤΟ ΚΟΥΠΟΝΙ, ΟΧΙ ΜΟΝΟ Ο ΜΙΣΘΩΤΗΣ. Ο προηγούμενος έχει ήδη τη
 * διεύθυνση στο κινητό του· χωρίς νέο κουπόνι θα συνέχιζε να βλέπει την πύλη
 * ενός σπιτιού που δεν είναι πια δικό του.
 */
export function reissue(
  db: Db, propertyId: string, userId: string, tenantId: string, token: string,
): PromiseLike<{ error: DbError | null }> {
  return db.from(TABLE).update({ token, tenant_id: tenantId })
    .eq('property_id', propertyId).eq('user_id', userId);
}

// ═══════════════════════════════════════════════════════════════════════════
// Ο ΣΥΝΔΕΣΜΟΣ ΠΕΘΑΙΝΕ ΣΤΟΝ ΧΡΟΝΟ, ΚΑΙ ΚΑΝΕΙΣ ΔΕΝ ΤΟ ΕΛΕΓΕ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΣΦΑΛΜΑ. Η στήλη `expires_at` γεννιέται `now() + 365 ημέρες` κι ΟΛΕΣ οι
// συναρτήσεις της πύλης αρνούνται ληγμένο κουπόνι — σωστά: σύνδεσμος χωρίς
// συνθηματικό που ζει για πάντα είναι σύνδεσμος που κάποτε διαρρέει. Καμία
// όμως διαδρομή της εφαρμογής δεν τον ανανέωνε ποτέ.
//
// Η ελληνική μίσθωση κατοικίας είναι τριετής κατ' ελάχιστο. Στον δωδέκατο μήνα
// ο μισθωτής πατούσε τον σύνδεσμο που είχε στο κινητό του κι έβλεπε κενή
// σελίδα. Ο ιδιοκτήτης δεν μάθαινε τίποτα: καμία ειδοποίηση, κανένα σήμα στην
// οθόνη του — η πύλη φαινόταν ενεργή, με κουμπί αντιγραφής κι όλα.
//
// Η ΛΥΣΗ ΚΡΑΤΑ ΤΟΝ ΛΟΓΟ ΤΗΣ ΛΗΞΗΣ. Δεν καταργείται η λήξη· γίνεται ΚΥΛΙΟΜΕΝΗ.
// Οσο ο ιδιοκτήτης ανοίγει την οθόνη της πύλης —δηλαδή όσο η μίσθωση είναι
// ζωντανή κι τον απασχολεί— το παράθυρο ξαναγεμίζει. Λογαριασμός που δεν τον
// άγγιξε κανείς για έναν χρόνο αφήνει τον σύνδεσμό του να πεθάνει, που ήταν
// εξαρχής το ζητούμενο.
//
// ΚΑΙ Η ΗΜΕΡΟΜΗΝΙΑ ΓΡΑΦΕΤΑΙ ΣΤΗΝ ΟΘΟΝΗ. Ο,τι λήγει σιωπηλά είναι παγίδα, ακόμη
// κι όταν ανανεώνεται μόνο του: ο ιδιοκτήτης έχει δικαίωμα να ξέρει τι έχει
// δώσει στον μισθωτή του κι για πόσο.
// ═══════════════════════════════════════════════════════════════════════════

/** Ποσο ζει ένας σύνδεσμος από τη στιγμή που ανανεώνεται. */
export const LIFETIME_DAYS = 365;
/** Κάτω από πόσες ημέρες υπολοίπου ανανεώνεται μόνος του. */
export const RENEW_UNDER_DAYS = 90;

const DAY = 86_400_000;

/**
 * Πόσες ημέρες μένουν. `null` όταν δεν υπάρχει λήξη (παλιές γραμμές) — κι αυτό
 * ΔΕΝ σημαίνει «έληξε»: οι συναρτήσεις της βάσης δέχονται ρητά `expires_at is
 * null`. Αρνητικό σημαίνει ότι πέρασε.
 */
export function daysLeft(expiresAt: string | null | undefined, now: Date): number | null {
  if (!expiresAt) return null;
  const t = Date.parse(expiresAt);
  if (!Number.isFinite(t)) return null;
  return Math.floor((t - now.getTime()) / DAY);
}

/** Πρέπει να ανανεωθεί τώρα; Ναι κι όταν έχει ήδη λήξει: η οθόνη τον ξαναζωντανεύει. */
export function needsRenewal(expiresAt: string | null | undefined, now: Date): boolean {
  const d = daysLeft(expiresAt, now);
  return d !== null && d < RENEW_UNDER_DAYS;
}

/** Γεμίζει ξανά το παράθυρο ζωής του συνδέσμου. */
export function renew(
  db: Db, propertyId: string, userId: string, now: Date,
): PromiseLike<{ error: DbError | null }> {
  const until = new Date(now.getTime() + LIFETIME_DAYS * DAY).toISOString();
  return db.from(TABLE).update({ expires_at: until })
    .eq('property_id', propertyId).eq('user_id', userId);
}
