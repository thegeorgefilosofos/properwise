// ═══════════════════════════════════════════════════════════════════════════
// Η ΓΡΑΜΜΗ ΤΟΥ property_settings ΑΠΟ ΤΗ ΦΟΡΜΑ: ΤΟ ΚΕΝΟ ΓΙΝΕΤΑΙ null
// ─────────────────────────────────────────────────────────────────────────
// Ο οδηγός «Νέο ακίνητο» κρατά κάθε πεδίο ως κείμενο και το κενό ως ''. Ο
// πίνακας έχει όμως και στήλη ημερομηνίας (`insurance_expiry`): η Postgres
// απορρίπτει το '' ως ημερομηνία, οπότε όποιος συμπλήρωνε έστω μία επαφή και
// άφηνε κενή τη λήξη ασφάλισης έβλεπε «Το ακίνητο αποθηκεύτηκε, αλλά οι επαφές
// και οι σημειώσεις του δεν καταχωρήθηκαν» — κάθε φορά (αναφορά λογιστή,
// 06/11/2026). Και στο κείμενο το '' δεν λέει τίποτα παραπάνω από το null.
//
// Τα κενά και τα σκέτα κενά διαστήματα γίνονται null· το κείμενο κόβεται
// στις άκρες. Τίποτα άλλο δεν αλλάζει.
// ═══════════════════════════════════════════════════════════════════════════

/** Οι τιμές της φόρμας, με το κενό ως null, έτοιμες για insert/upsert. */
export function settingsRow<T extends { [K in keyof T]: string | null | undefined }>(form: T): { [K in keyof T]: string | null } {
  const out = {} as { [K in keyof T]: string | null };
  for (const k of Object.keys(form) as (keyof T)[]) {
    const v = form[k] as string | null | undefined;
    const t = typeof v === 'string' ? v.trim() : '';
    out[k] = t === '' ? null : t;
  }
  return out;
}

/** Υπάρχει κάτι να γραφτεί; Αλλιώς δεν φτιάχνουμε κενή γραμμή. */
export const hasAnySetting = <T extends { [K in keyof T]: string | null | undefined }>(form: T): boolean =>
  Object.values(settingsRow(form)).some(v => v !== null);
