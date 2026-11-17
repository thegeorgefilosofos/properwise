// ═══════════════════════════════════════════════════════════════════════════
// Η ΝΟΜΙΚΗ ΒΑΣΗ ΜΙΑΣ ΣΕΛΙΔΑΣ, ΑΠΟ ΤΟ ΜΗΤΡΩΟ ΙΣΧΥΟΣ (17/11/2026)
// ─────────────────────────────────────────────────────────────────────────
// Οι κόμβοι θέματος, οι οδηγοί και η μεθοδολογία λένε στον αναγνώστη ΑΠΟ ΠΟΥ
// βγαίνει κάθε κανόνας και ΠΟΤΕ τον κοίταξε άνθρωπος. Τίποτα από αυτά δεν
// γράφεται εδώ: ετικέτα, πηγή και ημερομηνίες είναι του lib/legal/validity.ts,
// το όνομα της πηγής του `sourceName` (lib/facts/taxLimits.ts), που το γράφουν
// ήδη οι υπολογιστές.
//
// ΤΟ `checkedAt` ΕΙΝΑΙ ΑΝΘΡΩΠΟΣ. Κανόνας που τον διάβασε μόνο εργαλείο
// (`toolReadAt`) δεν παρουσιάζεται ως «ελεγμένος»: η σελίδα το λέει όπως είναι.
//
// Χωρίς React: το διαβάζουν σελίδες διακομιστή και δοκιμές.
// ═══════════════════════════════════════════════════════════════════════════
import { REGULATED, regulated, type Regulated } from '@/lib/legal/validity';
import { sourceName } from '@/lib/facts/taxLimits';

export interface RuleRow {
  id: string;
  label: string;
  /** Η επίσημη διεύθυνση του κανόνα (ΦΕΚ, ΑΑΔΕ ή άλλη δημόσια πηγή). */
  href: string;
  /** Το όνομα της πηγής όπως το διαβάζει ο άνθρωπος: «ΦΕΚ Α΄ 198/2025», «ΑΑΔΕ», «stegasi.gov.gr». */
  source: string;
  /** Πότε τον κοίταξε άνθρωπος (ISO), ή `null`. */
  checkedAt: string | null;
  /** Πότε τον διάβασε μόνο εργαλείο (ISO), όταν δεν τον έχει δει άνθρωπος. */
  toolReadAt: string | null;
}

/**
 * Το όνομα της πηγής. Το `sourceName` ξέρει ΦΕΚ και ΑΑΔΕ· για κάθε άλλη επίσημη
 * σελίδα λέει «ΑΑΔΕ ή ΦΕΚ», που εδώ θα ήταν λάθος (το Σπίτι μου, η ΕΛΣΤΑΤ). Τότε
 * γράφεται ο ίδιος ο ιστότοπος, όπως είναι στη διεύθυνση.
 */
export function ruleSource(url: string): string {
  const named = sourceName(url);
  if (named !== sourceName(undefined)) return named;
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host === 'et.gr' ? 'Εθνικό Τυπογραφείο' : host;
  } catch {
    return named;
  }
}

const row = (r: Regulated): RuleRow => ({
  id: r.id, label: r.label, href: r.source, source: ruleSource(r.source),
  checkedAt: r.checkedAt, toolReadAt: r.toolReadAt ?? null,
});

/** Οι κανόνες μιας σελίδας, με τη σειρά που τους δίνει. Άγνωστο id σπάει το χτίσιμο (`regulated`). */
export const ruleRows = (ids: readonly string[]): RuleRow[] => ids.map(id => row(regulated(id)));

/** Όλο το μητρώο, για τη μεθοδολογία. */
export const allRuleRows = (): RuleRow[] => REGULATED.map(row);

/**
 * Ο ΠΑΛΑΙΟΤΕΡΟΣ ανθρώπινος έλεγχος των κανόνων μιας σελίδας, ή `null` αν κανένας
 * δεν έχει ελεγχθεί από άνθρωπο. Τόσο φρέσκια είναι η σελίδα όσο το πιο παλιό
 * της νούμερο (ίδιος κανόνας με το `taxLimitAsOf`).
 */
export function oldestCheck(rows: readonly RuleRow[]): string | null {
  const dates = rows.map(r => r.checkedAt).filter((d): d is string => !!d).sort();
  return dates[0] ?? null;
}

/** Οι πηγές χωρίς διπλά, με τη σειρά που εμφανίζονται: ένα όνομα, μία διεύθυνση. */
export function distinctSources(rows: readonly RuleRow[]): { source: string; href: string }[] {
  const seen = new Set<string>();
  const out: { source: string; href: string }[] = [];
  for (const r of rows) {
    if (seen.has(r.source)) continue;
    seen.add(r.source);
    out.push({ source: r.source, href: r.href });
  }
  return out;
}
