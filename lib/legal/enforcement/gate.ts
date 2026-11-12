// ═══════════════════════════════════════════════════════════════════════════
// Η ΠΥΛΗ: ΚΑΝΕΝΑΣ ΚΑΝΟΝΑΣ ΔΕΝ ΦΤΑΝΕΙ ΣΤΗΝ ΟΘΟΝΗ ΧΩΡΙΣ ΔΥΟ ΠΗΓΕΣ
// ─────────────────────────────────────────────────────────────────────────
// Την καλεί η μηχανή ΜΕΣΑ στον υπολογισμό, όχι η οθόνη. Δεν υπάρχει δρόμος από
// κανόνα σε ημερομηνία που να την παρακάμπτει.
//
// Τρεις βαθμίδες (απόφαση ιδιοκτήτη 12/11/2026):
//   · 'tool':     επίσημη + ανεξάρτητη πηγή, αλλά την αντιπαραβολή την έκανε
//                 μόνο εργαλείο· καμία εγγραφή του μητρώου ισχύος για τους
//                 κανόνες εκτέλεσης δεν έχει ανθρώπινο `checkedAt`. Η οθόνη
//                 δείχνει «Επιβεβαίωσε με δικηγόρο», ΟΧΙ «Επαληθευμένο».
//   · 'verified': το ίδιο συν άνθρωπο της ομάδας που έχει γράψει `checkedAt`
//                 στο lib/legal/validity.ts τους τελευταίους 12 μήνες.
//   · 'lawyer':   επιπλέον υπογραφή δικηγόρου για ΑΥΤΗ την έκδοση του κανόνα.
// Υπογραφή χωρίς όνομα, χωρίς ημερομηνία ή για παλιότερη έκδοση δεν μετρά: ο
// κανόνας πέφτει στη βαθμίδα 'verified', δεν ανεβαίνει ποτέ χωρίς λόγο.
// ═══════════════════════════════════════════════════════════════════════════
import type { LegalRule } from './types';
import { REGULATED, humanChecked } from '@/lib/legal/validity';

export type Tier = 'tool' | 'verified' | 'lawyer';
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

/** Οι εγγραφές του μητρώου ισχύος που φυλάνε τα αρχεία των κανόνων εκτέλεσης. */
export const ENFORCEMENT_REGISTRY = REGULATED.filter(x => x.where.startsWith('lib/legal/enforcement/'));

/**
 * Τις πηγές των κανόνων τις έχει δει ΑΝΘΡΩΠΟΣ; Ναι μόνο όταν ΚΑΘΕ εγγραφή του
 * μητρώου ισχύος για lib/legal/enforcement/ έχει `checkedAt` έως 12 μηνών. Μία
 * εγγραφή με `checkedAt: null` (μόνο `toolReadAt`) αρκεί για το «όχι»: ο
 * κανόνας διαβάζει και τα τρία αρχεία (κανόνες, πηγές, αριθμοί).
 */
export function sourcesHumanChecked(today: string): boolean {
  return ENFORCEMENT_REGISTRY.length > 0 && ENFORCEMENT_REGISTRY.every(x => humanChecked(x, today));
}

/**
 * `humanSeen` δίνεται από έξω μόνο από τα τεστ· η μηχανή και η οθόνη παίρνουν
 * πάντα την προεπιλογή, δηλαδή το μητρώο ισχύος.
 */
export function displayable(r: LegalRule, today: string, humanSeen: boolean = sourcesHumanChecked(today)): GateResult {
  if (r.status !== 'verified') return { ok: false, reason: 'withheld' };
  if (r.verifier !== 'properwise-team') return { ok: false, reason: 'verifier' };
  if (!hasTwoSources(r)) return { ok: false, reason: 'sources' };
  if (r.validTo && today > r.validTo) return { ok: false, reason: 'expired' };
  if (today < r.validFrom) return { ok: false, reason: 'not-yet-in-force' };
  // Η υπογραφή δικηγόρου είναι κι αυτή ανθρώπινος έλεγχος· χωρίς αυτήν, χωρίς
  // ανθρώπινο `checkedAt` στο μητρώο, ο κανόνας μένει στη βαθμίδα του εργαλείου.
  return { ok: true, tier: lawyerSigned(r) ? 'lawyer' : humanSeen ? 'verified' : 'tool' };
}
