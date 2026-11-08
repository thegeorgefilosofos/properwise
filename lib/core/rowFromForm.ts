// ═══════════════════════════════════════════════════════════════════════════
// Η ΓΡΑΜΜΗ ΑΠΟ ΤΗ ΦΟΡΜΑ: ΤΟ ΚΕΝΟ ΓΙΝΕΤΑΙ null ΠΡΙΝ ΦΤΑΣΕΙ ΣΤΗ ΒΑΣΗ
// ─────────────────────────────────────────────────────────────────────────
// Οι φόρμες κρατούν κάθε πεδίο ως κείμενο και το κενό ως ''. Για τη στήλη
// κειμένου το '' είναι απλώς άχρηστο· για τη στήλη ημερομηνίας, αριθμού ή uuid
// είναι ΣΦΑΛΜΑ (Postgres 22007 / 22P02) και πέφτει ολόκληρη η γραμμή.
//
// Συνέβη στις 06/11/2026: λογιστής συμπλήρωσε τις επαφές ενός νέου ακινήτου,
// άφησε κενή τη λήξη ασφάλισης και είδε «Το ακίνητο αποθηκεύτηκε, αλλά οι
// επαφές και οι σημειώσεις του δεν καταχωρήθηκαν». Η σάρωση που ακολούθησε βρήκε το
// ίδιο σχήμα σε επισκευές, συντηρήσεις, εισπράξεις και δάνεια.
//
// Ο ΚΑΝΟΝΑΣ: κείμενο κόβεται στις άκρες και το κενό γίνεται null· αριθμός που
// δεν είναι πεπερασμένος (NaN από `parseFloat('')`) γίνεται null. Τίποτα άλλο
// δεν αλλάζει — boolean, πίνακες, αντικείμενα και null περνούν όπως είναι· το
// `undefined` μένει `undefined` (το JSON το πετά: η στήλη δεν αγγίζεται).
//
// Ο φύλακας scripts/guard-form-spread-write.mjs απαιτεί να περνά από εδώ (ή
// από τη settingsRow) κάθε κατάσταση φόρμας που απλώνεται σε insert/upsert/update.
// ═══════════════════════════════════════════════════════════════════════════

type Clean<V> =
  V extends string ? string | null :
  V extends number ? number | null :
  V;

export type FormRow<T> = { [K in keyof T]: Clean<T[K]> };

/** Μία τιμή φόρμας, όπως πρέπει να φτάσει σε στήλη. */
export function cleanValue<V>(v: V): Clean<V> {
  if (typeof v === 'string') {
    const t = v.trim();
    return (t === '' ? null : t) as Clean<V>;
  }
  if (typeof v === 'number') return (Number.isFinite(v) ? v : null) as Clean<V>;
  return v as Clean<V>;
}

/** Οι τιμές της φόρμας με το κενό ως null, έτοιμες για insert/upsert/update. */
export function rowFromForm<T extends object>(form: T): FormRow<T> {
  const out = {} as FormRow<T>;
  for (const k of Object.keys(form) as (keyof T)[]) out[k] = cleanValue(form[k]) as FormRow<T>[keyof T];
  return out;
}
