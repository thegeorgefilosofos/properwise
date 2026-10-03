// ═══════════════════════════════════════════════════════════════════════════
// Η ΦΩΤΟΓΡΑΦΙΑ ΤΟΥ ΕΝΟΙΚΙΑΣΤΗ ΠΕΡΝΑ ΑΠΟ ΤΟΝ ΔΙΑΚΟΜΙΣΤΗ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΚΛΕΙΝΕΙ. Η πύλη ανέβαζε απευθείας στο ιδιωτικό bucket
// `maintenance-photos` με το δημόσιο κλειδί. Η μόνη πολιτική ρωτούσε «είναι
// ο πρώτος φάκελος ενεργό κουπόνι;» και τίποτα άλλο: ούτε τον κωδικό της
// πύλης ούτε πόσα αρχεία ανέβηκαν. Οποιος κρατούσε το κουπόνι χωρίς τον
// κωδικό ανέβαζε αρχεία δέκα MB το ένα χωρίς τέλος.
//
// ΤΙ ΓΙΝΕΤΑΙ ΤΩΡΑ, ΓΙΑ ΚΑΘΕ ΦΩΤΟΓΡΑΦΙΑ:
//   1. η σελίδα στέλνει κουπόνι, κωδικό, όνομα, τύπο και μέγεθος·
//   2. εδώ ελέγχεται το σχήμα τους και η `portal_upload_slot` κρίνει κουπόνι,
//      κωδικό (μετρά στο ίδιο κλείδωμα με την είσοδο) και ταβάνι είκοσι την
//      ώρα·
//   3. ο ρόλος υπηρεσίας υπογράφει διεύθυνση ανεβάσματος για ΜΙΑ διαδρομή
//      που διαλέγει ο διακομιστής, μέσα στον φάκελο του κουπονιού·
//   4. η σελίδα ανεβάζει εκεί. Το bucket κρατά τα όριά του (δέκα MB, μόνο
//      εικόνες) και η υπογραφή ισχύει για εκείνη τη διαδρομή μόνο.
//
// Η ΛΟΓΙΚΗ ΖΕΙ ΕΔΩ ΚΑΙ ΟΧΙ ΣΤΗ route.ts ώστε να δοκιμάζεται με ψεύτικο
// πελάτη, χωρίς Next και χωρίς δίκτυο.
// ═══════════════════════════════════════════════════════════════════════════

/** Το ιδιωτικό bucket των φωτογραφιών βλάβης. */
export const PHOTO_BUCKET = 'maintenance-photos';

/** Ίδια με τα όρια του bucket (20260724091000 και 20261003110000). */
export const PHOTO_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif'];
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;

/** Το κουπόνι γίνεται όνομα φακέλου: τίποτα που να σπάει τη διαδρομή. */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{16,128}$/;

/** Ο,τι ζητά η σελίδα για μία φωτογραφία. */
export interface UploadAsk { token: string; pin: string | null; name: string; type: string; size: number }

/** Διαβάζει το σώμα του αιτήματος. Επιστρέφει κείμενο λάθους όταν δεν στέκει. */
export function readUploadAsk(body: unknown): UploadAsk | { error: string } {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const token = typeof b.token === 'string' ? b.token : '';
  if (!TOKEN_SHAPE.test(token)) return { error: 'Ο σύνδεσμος της πύλης δεν είναι έγκυρος.' };
  const pin = typeof b.pin === 'string' && b.pin !== '' ? b.pin.slice(0, 64) : null;
  const type = typeof b.type === 'string' ? b.type.toLowerCase() : '';
  if (!PHOTO_TYPES.includes(type)) return { error: 'Επιτρέπονται μόνο φωτογραφίες JPEG, PNG, WEBP, HEIC ή GIF.' };
  const size = typeof b.size === 'number' && Number.isFinite(b.size) ? b.size : -1;
  if (size <= 0 || size > PHOTO_MAX_BYTES) return { error: 'Η φωτογραφία ξεπερνά τα 10 MB.' };
  const name = typeof b.name === 'string' ? b.name : '';
  return { token, pin, name, type, size };
}

/**
 * Η διαδρομή του αρχείου. Τη διαλέγει ο διακομιστής: πρώτος φάκελος το
 * κουπόνι (από εκεί κρίνει η πολιτική ανάγνωσης του ιδιοκτήτη), μετά χρόνος
 * και τυχαίο κομμάτι ώστε δύο ανεβάσματα να μη συγκρουστούν ποτέ.
 */
export function photoPath(token: string, name: string, now: number, rand: string): string {
  const cleaned = name.replace(/[^\w.-]+/g, '_').replace(/\.{2,}/g, '.').replace(/^\.+/, '').slice(-80);
  const safe = /[A-Za-z0-9]/.test(cleaned) ? cleaned : 'photo';
  return `${token}/${now}_${rand}_${safe}`;
}

/** Ο,τι χρειάζεται από τον πελάτη υπηρεσίας. */
export interface SlotClient {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>;
  storage: {
    from(bucket: string): {
      createSignedUploadUrl(path: string): Promise<
        { data: { signedUrl: string; token: string; path: string }; error: null } | { data: null; error: { message: string } }
      >;
    };
  };
}

/** Η απάντηση της διαδρομής, πριν γίνει HTTP. */
export interface SlotReply { status: number; body: Record<string, unknown> }

/** Οι λόγοι άρνησης της `portal_upload_slot` και ο κωδικός HTTP του καθενός. */
const REFUSAL: Record<string, number> = { notfound: 404, pin: 403, locked: 429, rate_limited: 429 };

/**
 * Κουπόνι, κωδικός και ταβάνι από τη βάση· μετά υπογραφή. Το όνομα είναι και
 * η απόδειξη ταυτότητας της διαδρομής για τον scripts/guard-api-auth.mjs.
 */
export async function grantPortalUpload(
  client: SlotClient, ask: UploadAsk, now: number, rand: string,
): Promise<SlotReply> {
  const { data, error } = await client.rpc('portal_upload_slot', { p_token: ask.token, p_pin: ask.pin });
  if (error) {
    console.info('[portal/upload-url] η άδεια δεν ρωτήθηκε:', error.code || '', error.message);
    return { status: 503, body: { error: 'Η αποστολή φωτογραφιών δεν είναι διαθέσιμη αυτή τη στιγμή.' } };
  }
  const slot = (data ?? {}) as { ok?: boolean; reason?: string };
  if (slot.ok !== true) {
    const reason = slot.reason && slot.reason in REFUSAL ? slot.reason : 'notfound';
    return { status: REFUSAL[reason], body: { reason } };
  }

  const path = photoPath(ask.token, ask.name, now, rand);
  const signed = await client.storage.from(PHOTO_BUCKET).createSignedUploadUrl(path);
  if (signed.error || !signed.data) {
    console.info('[portal/upload-url] η υπογραφή απέτυχε:', signed.error?.message);
    return { status: 502, body: { error: 'Η φωτογραφία δεν ανέβηκε. Δοκίμασε ξανά.' } };
  }
  return { status: 200, body: { path: signed.data.path || path, uploadToken: signed.data.token } };
}
