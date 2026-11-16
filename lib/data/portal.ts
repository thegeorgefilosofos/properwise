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
// Ο ΣΥΝΔΕΣΜΟΣ ΠΕΘΑΙΝΕ ΣΤΟΝ ΧΡΟΝΟ ΚΑΙ ΚΑΝΕΙΣ ΔΕΝ ΤΟ ΕΛΕΓΕ
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

// ═══════════════════════════════════════════════════════════════════════════
// ΚΩΔΙΚΟΣ PIN ΑΠΟ ΠΡΟΕΠΙΛΟΓΗ (απόφαση ιδιοκτήτη 10/11/2026)
// ─────────────────────────────────────────────────────────────────────────
// Ο έλεγχος ασφάλειας της 10/11/2026 βρήκε ότι κανένας από τους ενεργούς
// συνδέσμους δεν είχε PIN, ενώ η get_portal_data δίνει όνομα μισθωτή,
// διεύθυνση, IBAN πληρωμής, εγγύηση και οφειλές σε όποιον έχει τον σύνδεσμο,
// για έως 365 ημέρες. Ο σύνδεσμος ταξιδεύει σε μηνύματα και προωθείται.
//
// Γι' αυτό κάθε νέα πύλη γεννιέται με τυχαίο PIN, που ο ιδιοκτήτης το βλέπει
// ΜΙΑ φορά και το δίνει στον μισθωτή. Μπορεί να το κλείσει συνειδητά. Στη
// βάση πάει μόνο το bcrypt της set_portal_pin· το καθαρό PIN δεν γράφεται
// πουθενά. Έξι ψηφία αντί για τέσσερα: 10^6 συνδυασμοί, με το όριο
// προσπαθειών που ήδη έχει ο έλεγχος της πύλης.
// ═══════════════════════════════════════════════════════════════════════════

/** Πόσα ψηφία έχει το τυχαίο PIN που προτείνεται. */
export const PIN_DIGITS = 6;

/**
 * Τυχαίο PIN από κρυπτογραφική πηγή, ομοιόμορφο ανά ψηφίο. Η απόρριψη των
 * τιμών ≥ 250 κρατά τα δέκα ψηφία ισοπίθανα (το 256 δεν διαιρείται με το 10).
 */
export function newPin(rand: (buf: Uint8Array) => Uint8Array = b => crypto.getRandomValues(b)): string {
  let out = '';
  while (out.length < PIN_DIGITS) {
    for (const v of rand(new Uint8Array(PIN_DIGITS * 2))) {
      if (v < 250 && out.length < PIN_DIGITS) out += String(v % 10);
    }
  }
  return out;
}

// ── ΧΩΡΙΣ ΔΕΥΤΕΡΟ ΒΗΜΑ, ΤΟ PIN ΔΕΝ ΓΡΑΦΕΤΑΙ ─────────────────────────────────
// Η set_portal_pin απαιτεί private.mfa_satisfied() και σηκώνει 42501
// `mfa_required` όταν η συνεδρία δεν έχει περάσει τον έλεγχο δύο βημάτων.
// Το γενικό «δεν ορίστηκε» δεν λέει στον ιδιοκτήτη τι να κάνει· αυτό λέει.

/** Αρνήθηκε η βάση επειδή λείπει η επαλήθευση δύο βημάτων; */
export const isMfaDenied = (e: { code?: string | null; message?: string | null } | null | undefined): boolean =>
  !!e && (e.code === '42501' || /mfa_required/i.test(e.message || ''));

/** Η φράση της οθόνης όταν λείπει το δεύτερο βήμα. */
export const MFA_PIN_SAY =
  'Για να οριστεί κωδικός πύλης χρειάζεται επαλήθευση δύο βημάτων. Ενεργοποίησέ την στον Λογαριασμό, στην ενότητα «Ασφάλεια» και δοκίμασε ξανά.';

export type PinWrite = 'ok' | 'none' | 'mfa' | 'error';

/**
 * Γράφει ή σβήνει το PIN μέσω της set_portal_pin (bcrypt στη βάση). `none`:
 * καμία δική σου γραμμή με αυτό το token. Το σφάλμα επιστρέφεται για μήνυμα.
 */
export async function writePin(
  db: Db, token: string, pin: string,
): Promise<{ result: PinWrite; error: DbError | null }> {
  try {
    const { data, error } = await db.rpc('set_portal_pin', { p_token: token, p_pin: pin });
    if (error) return { result: isMfaDenied(error) ? 'mfa' : 'error', error };
    return { result: data ? 'ok' : 'none', error: null };
  } catch (e) {
    return { result: 'error', error: { message: e instanceof Error ? e.message : 'Σφάλμα δικτύου' } as DbError };
  }
}
