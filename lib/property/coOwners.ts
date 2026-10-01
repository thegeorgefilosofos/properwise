// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΣΥΝΙΔΙΟΚΤΗΤΕΣ ΕΝΟΣ ΑΚΙΝΗΤΟΥ, ΣΕ ΜΙΑ ΜΟΡΦΗ
// ─────────────────────────────────────────────────────────────────────────
// Η στήλη `user_properties.co_owners` (jsonb) κρατούσε σκέτα ονόματα, όσα
// έγραφε ο οδηγός ακινήτου. Η Κατανομή σε συνιδιοκτήτες (OwnerSplit) κρατούσε
// ονόματα, ΑΦΜ και ποσοστά ΜΟΝΟ στον περιηγητή. Το Ε2 όμως ζητά για κάθε
// συνιδιοκτήτη ονοματεπώνυμο, ΑΦΜ, διεύθυνση και ποσοστό (Συμπληρωματικά
// στοιχεία, πίνακας I, στήλες 7 έως 10, Φ-01.002/Έκδοση 2026).
//
// Μία μορφή λοιπόν, στη βάση: [{name, afm, pct, address}], οι ΑΛΛΟΙ
// συνιδιοκτήτες, όχι ο υπόχρεος. Η μετανάστευση 20261001130000 έκανε τα παλιά
// ονόματα αντικείμενα· εδώ διαβάζονται και τα δύο, για την περίπτωση γραμμής
// που γράφτηκε από παλιό πελάτη ανάμεσα στο deploy και στην ανανέωση σελίδας.
// ═══════════════════════════════════════════════════════════════════════════

export interface CoOwner {
  name: string;
  afm: string | null;
  /** Ποσοστό συνιδιοκτησίας, 0 έως 100. */
  pct: number | null;
  address: string | null;
}

const text = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '';
  return s || null;
};

const pctOf = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(',', '.')) : NaN;
  return Number.isFinite(n) && n > 0 && n <= 100 ? n : null;
};

/** Ό,τι κι αν κρατά η στήλη, επιστρέφει συνιδιοκτήτες με όνομα. */
export function readCoOwners(json: unknown): CoOwner[] {
  if (!Array.isArray(json)) return [];
  const out: CoOwner[] = [];
  for (const e of json) {
    if (typeof e === 'string') {
      const name = e.trim();
      if (name) out.push({ name, afm: null, pct: null, address: null });
      continue;
    }
    if (!e || typeof e !== 'object') continue;
    const o = e as Record<string, unknown>;
    const name = text(o.name);
    if (!name) continue;
    const afm = text(o.afm)?.replace(/\s+/g, '') || null;
    out.push({ name, afm, pct: pctOf(o.pct), address: text(o.address) });
  }
  return out;
}

/** Η μορφή που γράφεται στη στήλη. Κενά πεδία μένουν έξω από το αντικείμενο. */
export function writeCoOwners(list: readonly CoOwner[]): Record<string, string | number>[] {
  return list
    .filter(c => c.name.trim())
    .map(c => ({
      name: c.name.trim(),
      ...(c.afm ? { afm: c.afm.replace(/\s+/g, '') } : {}),
      ...(c.pct != null && c.pct > 0 && c.pct <= 100 ? { pct: c.pct } : {}),
      ...(c.address?.trim() ? { address: c.address.trim() } : {}),
    }));
}

/**
 * Ο οδηγός ακινήτου επεξεργάζεται μόνο ονόματα. Κατά την αποθήκευση τα ονόματα
 * ξαναζευγαρώνονται με ό,τι ήξερε ήδη η βάση για τον ίδιο άνθρωπο, ώστε μια
 * αλλαγή διεύθυνσης του ακινήτου να μη σβήνει ΑΦΜ και ποσοστά που έγραψε η
 * Κατανομή σε συνιδιοκτήτες. Ζευγάρι πρώτα με το ίδιο όνομα, αλλιώς με την
 * ίδια θέση όταν το όνομα απλώς διορθώθηκε.
 */
export function mergeCoOwnerNames(existing: readonly CoOwner[], names: readonly string[]): CoOwner[] {
  const free = existing.map((c, i) => ({ c, i }));
  const take = (pred: (x: { c: CoOwner; i: number }) => boolean) => {
    const k = free.findIndex(pred);
    return k >= 0 ? free.splice(k, 1)[0].c : null;
  };
  const clean = names.map(n => n.trim()).filter(Boolean);
  const byName = clean.map(n => take(x => x.c.name === n));
  return clean.map((name, i) => {
    const prior = byName[i] ?? take(x => x.i === i);
    return prior ? { ...prior, name } : { name, afm: null, pct: null, address: null };
  });
}

/** Έχει η βάση κάτι παραπάνω από ονόματα; Τότε ο οδηγός δεν το σβήνει. */
export const hasCoOwnerDetails = (list: readonly CoOwner[]): boolean =>
  list.some(c => !!c.afm || c.pct != null || !!c.address);

// ── Η ΚΑΤΑΝΟΜΗ ΣΕ ΣΥΝΙΔΙΟΚΤΗΤΕΣ ΔΙΑΒΑΖΕΙ ΚΑΙ ΓΡΑΦΕΙ ΤΗΝ ΙΔΙΑ ΣΤΗΛΗ ──────────
// Η οθόνη δείχνει ΟΛΟΥΣ τους ιδιοκτήτες, μαζί με τον υπόχρεο του ακινήτου
// (όνομα και ΑΦΜ από τις ρυθμίσεις του, ποσοστό από το `ownership`), γιατί τα
// ποσοστά πρέπει να κλείνουν στο 100. Στη στήλη `co_owners` γράφονται μόνο οι
// ΑΛΛΟΙ: ο υπόχρεος έχει ήδη το δικό του πεδίο και στο Ε2 δεν είναι
// συνιδιοκτήτης του εαυτού του.

/** Μια γραμμή της Κατανομής, όπως την επεξεργάζεται η οθόνη (κείμενα). */
export interface SplitRow { name: string; pct: string; afm: string; address: string; self?: boolean }

export interface OwnerOfRecord { name: string | null; afm: string | null; ownership: number | string | null }

const numText = (n: number | null) => (n == null ? '' : String(n).replace('.', ','));
const sameAfm = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && a.replace(/\s+/g, '') === b.replace(/\s+/g, '');

/**
 * Οι γραμμές της οθόνης από τη βάση, ή null όταν η βάση δεν ξέρει κανέναν
 * συνιδιοκτήτη (τότε η οθόνη πέφτει σε ό,τι κρατούσε ο περιηγητής).
 */
export function splitRowsFromRecord(owner: OwnerOfRecord, coOwnersJson: unknown): SplitRow[] | null {
  const co = readCoOwners(coOwnersJson);
  if (!co.length) return null;
  const own = Number(String(owner.ownership ?? '').replace(',', '.'));
  const self: SplitRow = {
    name: (owner.name || '').trim() || 'Ιδιοκτήτης', afm: (owner.afm || '').replace(/\s+/g, ''),
    pct: Number.isFinite(own) && own > 0 ? numText(own) : '', address: '', self: true,
  };
  const others = co
    .filter(c => !sameAfm(c.afm, owner.afm))
    .map(c => ({ name: c.name, afm: c.afm ?? '', pct: numText(c.pct), address: c.address ?? '' }));
  return [self, ...others];
}

/**
 * Ό,τι γράφεται πίσω: οι ΑΛΛΟΙ συνιδιοκτήτες και, όταν υπάρχει γραμμή του
 * υπόχρεου με έγκυρο ποσοστό, το νέο του ποσοστό. Υπόχρεος είναι η γραμμή
 * `self`, αλλιώς η γραμμή με το ΑΦΜ του, αλλιώς με το όνομά του (παλιές
 * διατάξεις από τον περιηγητή). Χωρίς τέτοια γραμμή, το ποσοστό δεν αγγίζεται.
 */
export function recordFromSplitRows(rows: readonly SplitRow[], owner: Pick<OwnerOfRecord, 'name' | 'afm'>): { coOwners: CoOwner[]; ownership: number | null } {
  const named = rows.filter(r => r.name.trim());
  const flagged = named.findIndex(r => r.self);
  const byAfm = named.findIndex(r => sameAfm(r.afm, owner.afm));
  const nm = (owner.name || '').trim();
  const selfAt = flagged >= 0 ? flagged : byAfm >= 0 ? byAfm : nm ? named.findIndex(r => r.name.trim() === nm) : -1;
  return {
    coOwners: named.filter((_, i) => i !== selfAt).map(r => ({
      name: r.name.trim(), afm: r.afm.replace(/\s+/g, '') || null, pct: pctOf(r.pct), address: r.address.trim() || null,
    })),
    ownership: selfAt >= 0 ? pctOf(named[selfAt].pct) : null,
  };
}
