// ═══════════════════════════════════════════════════════════════════════════
// ΚΑΝΕΝΑ null ΣΕ ΣΤΗΛΗ NOT NULL: Η ΠΡΟΕΠΙΛΟΓΗ ΤΗΣ ΒΑΣΗΣ ΓΡΑΦΕΤΑΙ ΕΔΩ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΡΟΒΛΗΜΑ. Το PostgREST στέλνει το ρητό `null` όπως είναι· την προεπιλογή
// της στήλης τη βάζει ΜΟΝΟ όταν το κλειδί λείπει. Σε στήλη `not null default …`
// το `null` δεν γίνεται προεπιλογή, γίνεται 23502 και η εγγραφή απορρίπτεται
// ολόκληρη. Δύο φορές σε έναν μήνα:
//
//   calendar_events.recurrence_exdates  κάθε εισαγωγή στο ημερολόγιο (#423)
//   user_properties.sqm                 «Το ακίνητο δεν αποθηκεύτηκε» όταν
//                                       έμενε κενό το εμβαδόν (PROPERWISE-9)
//
// ΚΑΙ ΤΟ ΜΑΖΙΚΟ INSERT ΕΧΕΙ ΔΙΚΗ ΤΟΥ ΠΑΓΙΔΑ. Με πίνακα γραμμών ο supabase-js
// στέλνει `columns=` την ένωση των κλειδιών όλων των γραμμών (defaultToNull):
// ένα κλειδί που λείπει από ΜΙΑ γραμμή, ή είναι `undefined`, φτάνει ως null.
// Το «παράλειψε το κλειδί» δουλεύει μόνο σε μία γραμμή· γι' αυτό εδώ η τιμή
// γράφεται ρητά, ΙΔΙΑ με την προεπιλογή της βάσης.
//
// ΑΠΟ ΠΟΥ ΒΓΑΙΝΟΥΝ ΟΙ ΤΙΜΕΣ. Από τα migrations, όχι από τη μνήμη μας: το
// lib/data/notNull.test.ts διαβάζει κάθε στήλη NOT NULL με σταθερή προεπιλογή
// (scripts/lib/pg-schema.mjs) και απαιτεί να είναι εδώ, με την ίδια τιμή.
// Νέα τέτοια στήλη σε πίνακα της λίστας σπάει το τεστ πριν σπάσει την οθόνη.
// ═══════════════════════════════════════════════════════════════════════════

/** Πίνακας → στήλη NOT NULL → η προεπιλογή της βάσης, ως τιμή JSON. */
export const NOT_NULL_DEFAULTS = {
  user_properties: { prop_type: 'Κατοικία', sqm: 0, ownership: 100 },
  calendar_events: { category: 'reminder', recurrence_exdates: [] as string[] },
  bills_settings: { data: {} as Record<string, unknown> },
  client_stays: { amount_basis: 'unknown' },
  property_documents: { kind: 'document' },
  accountant_packs: { missing_count: 0, missing_top: [] as string[] },
} as const;

export type DefaultedTable = keyof typeof NOT_NULL_DEFAULTS;

// Οι πίνακες/λίστες προεπιλογής δεν μοιράζονται: κάθε γραμμή παίρνει δικό της
// αντίγραφο, ώστε μια αλλαγή σε μία να μη φανεί σε όλες.
const fresh = (v: unknown): unknown =>
  Array.isArray(v) ? [] : v && typeof v === 'object' ? {} : v;

/**
 * ΕΙΣΑΓΩΓΗ: κάθε `null` ή `undefined` σε στήλη της λίστας γίνεται η προεπιλογή.
 * Κλειδί που λείπει μένει να λείπει (μία γραμμή → η βάση βάζει την προεπιλογή).
 */
export function forInsert<T extends object>(table: DefaultedTable, row: T): T {
  const defs = NOT_NULL_DEFAULTS[table] as Record<string, unknown>;
  const out = { ...row } as Record<string, unknown>;
  for (const k of Object.keys(defs)) if (k in out && out[k] == null) out[k] = fresh(defs[k]);
  return out as T;
}

/**
 * ΜΑΖΙΚΗ ΕΙΣΑΓΩΓΗ: όπως η `forInsert` και επιπλέον, όποια στήλη της λίστας
 * εμφανίζεται σε ΕΣΤΩ ΜΙΑ γραμμή γράφεται σε ΟΛΕΣ. Αλλιώς το `columns=` την
 * ζητά και για τις γραμμές που δεν την έχουν, ως null.
 */
export function forInsertMany<T extends object>(table: DefaultedTable, rows: readonly T[]): T[] {
  const defs = NOT_NULL_DEFAULTS[table] as Record<string, unknown>;
  const used = Object.keys(defs).filter(k => rows.some(r => k in (r as Record<string, unknown>)));
  return rows.map(r => {
    const out = { ...r } as Record<string, unknown>;
    for (const k of used) if (out[k] == null) out[k] = fresh(defs[k]);
    return out as T;
  });
}

/**
 * ΕΝΗΜΕΡΩΣΗ: το ρητό `null` («σβήσε το πεδίο») γίνεται η προεπιλογή, που είναι
 * ό,τι θα είχε μια γραμμή χωρίς την τιμή. Το `undefined` ΔΕΝ αγγίζεται: σε μία
 * γραμμή το JSON το πετά και η στήλη μένει όπως ήταν — αυτό σημαίνει.
 */
export function forUpdate<T extends object>(table: DefaultedTable, patch: T): T {
  const defs = NOT_NULL_DEFAULTS[table] as Record<string, unknown>;
  const out = { ...patch } as Record<string, unknown>;
  for (const k of Object.keys(defs)) if (k in out && out[k] === null) out[k] = fresh(defs[k]);
  return out as T;
}
