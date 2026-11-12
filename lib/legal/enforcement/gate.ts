// ═══════════════════════════════════════════════════════════════════════════
// Η ΠΥΛΗ: ΚΑΝΕΝΑΣ ΚΑΝΟΝΑΣ ΔΕΝ ΦΤΑΝΕΙ ΣΤΗΝ ΟΘΟΝΗ ΧΩΡΙΣ ΔΥΟ ΠΗΓΕΣ
// ─────────────────────────────────────────────────────────────────────────
// Την καλεί η μηχανή ΜΕΣΑ στον υπολογισμό, όχι η οθόνη. Δεν υπάρχει δρόμος από
// κανόνα σε ημερομηνία που να την παρακάμπτει.
//
// Δύο βαθμίδες (απόφαση ιδιοκτήτη 12/11/2026):
//   · 'verified': επίσημη + ανεξάρτητη πηγή, verifier η ομάδα.
//   · 'lawyer':   επιπλέον υπογραφή δικηγόρου για ΑΥΤΗ την έκδοση του κανόνα.
// Υπογραφή χωρίς όνομα, χωρίς ημερομηνία ή για παλιότερη έκδοση δεν μετρά: ο
// κανόνας πέφτει στη βαθμίδα 'verified', δεν ανεβαίνει ποτέ χωρίς λόγο.
// ═══════════════════════════════════════════════════════════════════════════
import type { LegalRule } from './types';

export type Tier = 'verified' | 'lawyer';
export type GateResult =
  | { ok: true; tier: Tier }
  | { ok: false; reason: 'withheld' | 'sources' | 'verifier' | 'expired' | 'not-yet-in-force' };

/** Έχει ο κανόνας τουλάχιστον μία επίσημη και μία ανεξάρτητη πηγή, με απόσπασμα; */
export function hasTwoSources(r: LegalRule): boolean {
  const complete = r.sources.filter(s => s.url && s.title && s.checkedAt && s.snapshot && s.excerpt.length > 0 && s.excerpt.every(e => e.trim().length > 0));
  const official = complete.filter(s => s.kind === 'official');
  const independent = complete.filter(s => s.kind === 'independent');
  if (!official.length || !independent.length) return false;
  // Δύο ΔΙΑΦΟΡΕΤΙΚΑ έγγραφα: η ίδια διεύθυνση δύο φορές δεν είναι δεύτερη πηγή.
  return official.some(o => independent.some(i => i.url !== o.url));
}

/** Ισχύει η υπογραφή δικηγόρου; Ονομα, ημερομηνία και ίδια έκδοση, αλλιώς όχι. */
export function lawyerSigned(r: LegalRule): boolean {
  const l = r.lawyerReviewed;
  return !!l && l.reviewer.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(l.reviewedAt) && l.version === r.version;
}

export function displayable(r: LegalRule, today: string): GateResult {
  if (r.status !== 'verified') return { ok: false, reason: 'withheld' };
  if (r.verifier !== 'properwise-team') return { ok: false, reason: 'verifier' };
  if (!hasTwoSources(r)) return { ok: false, reason: 'sources' };
  if (r.validTo && today > r.validTo) return { ok: false, reason: 'expired' };
  if (today < r.validFrom) return { ok: false, reason: 'not-yet-in-force' };
  return { ok: true, tier: lawyerSigned(r) ? 'lawyer' : 'verified' };
}
