// ═══════════════════════════════════════════════════════════════════════════
// ΑΡΧΕΙΟ: ΦΑΚΕΛΟΣ → ΥΠΟΦΑΚΕΛΟΣ → ΕΤΟΣ
// ─────────────────────────────────────────────────────────────────────────
// Οι όψεις (facets.ts) απαντούν σε ερωτήσεις που κόβουν κάθετα («όλα του 2025»).
// Ο ιδιοκτήτης ζήτησε ΚΑΙ τη συνηθισμένη θέα ενός φακέλου στον υπολογιστή του:
// Ρεύμα → ΔΕΗ → 2026 → τα αρχεία, με το κοινό όνομα (naming.ts). Είναι δεύτερη
// προβολή του ΙΔΙΟΥ φιλτραρισμένου συνόλου, όχι δεύτερη ταξινομία: το είδος
// και ο πάροχος έρχονται από το naming.ts, τα φίλτρα και η αναζήτηση ισχύουν.
//
// Οι φωτογραφίες χώρων δεν έχουν πάροχο: Φωτογραφίες → κατηγορία → έτος.
// Καθαρή λογική, χωρίς React.
// ═══════════════════════════════════════════════════════════════════════════
import { foldKey } from './naming';

export const NO_PROVIDER = 'Χωρίς πάροχο';
export const NO_YEAR = 'Χωρίς έτος';
export const PHOTOS = 'Φωτογραφίες';

/** Ό,τι χρειάζεται ένα αρχείο για να μπει στο δέντρο. */
export interface TreeInput {
  id: string;
  /** Το είδος (Ρεύμα, Ε9, Μισθωτήριο…)· στις φωτογραφίες η κατηγορία τους. */
  kind: string;
  /** Ο καθαρισμένος πάροχος ή null. */
  provider: string | null;
  /** ISO ημερομηνία του ονόματος (περίοδος → έκδοση → ημερομηνία εγγράφου). */
  nameDate: string | null;
  value: number | null;
  isPhoto?: boolean;
}

export interface TreeNode<T> {
  /** Μοναδικό κλειδί διαδρομής, π.χ. «ρευμα/δεη/2026». */
  key: string;
  label: string;
  count: number;
  /** Άθροισμα ποσών· null όταν κανένα αρχείο δεν έχει ποσό. */
  total: number | null;
  children: TreeNode<T>[];
  /** Μόνο στο τελευταίο επίπεδο (έτος): τα αρχεία, πιο πρόσφατο πρώτο. */
  items: T[];
}

const sumOf = (xs: readonly TreeInput[]): number | null => {
  const vs = xs.map(x => x.value).filter((v): v is number => v != null && Number.isFinite(v));
  return vs.length ? Math.round(vs.reduce((a, b) => a + b, 0) * 100) / 100 : null;
};

/** Ταξινόμηση ετικετών: αλφαβητικά στα ελληνικά, τα «Χωρίς …» και οι φωτογραφίες τελευταία. */
const LAST = new Set([NO_PROVIDER, NO_YEAR, PHOTOS, 'Λοιπά', 'Έγγραφο']);
const byLabel = (a: string, b: string) =>
  Number(LAST.has(a)) - Number(LAST.has(b)) || a.localeCompare(b, 'el', { sensitivity: 'base' });
const byYear = (a: string, b: string) =>
  Number(a === NO_YEAR) - Number(b === NO_YEAR) || b.localeCompare(a);

/** Ομαδοποιεί με κλειδί χωρίς τόνους και πεζά· ετικέτα η πιο συχνή γραφή. */
function groupBy<T>(xs: readonly T[], label: (x: T) => string): { label: string; key: string; items: T[] }[] {
  const m = new Map<string, { items: T[]; spell: Map<string, number> }>();
  for (const x of xs) {
    const l = label(x); const k = foldKey(l);
    const e = m.get(k) ?? { items: [] as T[], spell: new Map<string, number>() };
    e.items.push(x); e.spell.set(l, (e.spell.get(l) ?? 0) + 1);
    m.set(k, e);
  }
  return [...m.entries()].map(([key, e]) => ({
    key, items: e.items,
    label: [...e.spell.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'el'))[0][0],
  }));
}

const newestFirst = (a: TreeInput, b: TreeInput) =>
  (b.nameDate || '').localeCompare(a.nameDate || '') || a.id.localeCompare(b.id);

/** Το δέντρο Είδος → Πάροχος → Έτος → αρχεία. Κενά επίπεδα δεν υπάρχουν. */
export function folderTree<T extends TreeInput>(items: readonly T[]): TreeNode<T>[] {
  const top = groupBy(items, i => (i.isPhoto ? PHOTOS : i.kind || 'Έγγραφο'));
  return top
    .map(t => {
      const second = groupBy(t.items, i => (i.isPhoto ? (i.kind || 'Άλλο') : (i.provider || NO_PROVIDER)));
      const children = second.map(s => {
        const years = groupBy(s.items, i => (i.nameDate ? i.nameDate.slice(0, 4) : NO_YEAR));
        const yearNodes: TreeNode<T>[] = years
          .map(y => ({
            key: `${t.key}/${s.key}/${y.key}`, label: y.label, count: y.items.length,
            total: sumOf(y.items), children: [], items: [...y.items].sort(newestFirst),
          }))
          .sort((a, b) => byYear(a.label, b.label));
        return { key: `${t.key}/${s.key}`, label: s.label, count: s.items.length, total: sumOf(s.items), children: yearNodes, items: [] };
      }).sort((a, b) => byLabel(a.label, b.label));
      return { key: t.key, label: t.label, count: t.items.length, total: sumOf(t.items), children, items: [] };
    })
    .sort((a, b) => byLabel(a.label, b.label));
}
