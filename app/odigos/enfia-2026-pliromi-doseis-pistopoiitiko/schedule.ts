// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΔΟΣΕΙΣ ΤΟΥ ΕΝΦΙΑ ΕΝΟΣ ΕΤΟΥΣ, ΑΠΟ ΤΗ ΜΗΧΑΝΗ ΤΟΥ ΗΜΕΡΟΛΟΓΙΟΥ
// ─────────────────────────────────────────────────────────────────────────
// Ο οδηγός πληρωμής δεν γράφει καμία ημερομηνία. Η πρώτη και η τελευταία δόση
// έρχονται από το lib/tax/greekTaxCalendar.ts, το ίδιο που τροφοδοτεί την
// Επισκόπηση, το Ημερολόγιο και τον οδηγό προθεσμιών. Οι ενδιάμεσες βγαίνουν
// με τον κανόνα του ίδιου αρχείου (ν.4223/2013, άρθρο 6): κάθε δόση ως την
// τελευταία εργάσιμη του μήνα της, με την ίδια `lastWorkingDayOfMonth`.
//
// Το πλήθος των δόσεων δεν γράφεται ούτε αυτό: είναι οι μήνες από την πρώτη ως
// την τελευταία. Αν η ΑΑΔΕ αλλάξει τον μήνα έκδοσης, αλλάζει μόνο του.
//
// Χωρίς React, ώστε να ελέγχεται από δοκιμή (schedule.test.ts).
// ═══════════════════════════════════════════════════════════════════════════
import {
  greekPropertyTaxObligations, lastWorkingDayOfMonth, type TaxObligation, type TaxObligationKind,
} from '@/lib/tax/greekTaxCalendar'

/** Η υποχρέωση ενός είδους στο έτος. Κάθε έτος έχει όλα τα είδη του ιδιοκτήτη. */
export function obligationOf(year: number, kind: TaxObligationKind): TaxObligation {
  const o = greekPropertyTaxObligations(year, 'owner').find(x => x.kind === kind)
  if (!o) throw new Error(`Το ημερολόγιο δεν έχει ${kind} για το ${year}`)
  return o
}

/** Οι προθεσμίες όλων των δόσεων του ΕΝΦΙΑ του έτους, με τη σειρά (ISO). */
export function enfiaInstalments(year: number): string[] {
  const first = obligationOf(year, 'enfia-first').date
  const last = obligationOf(year, 'enfia-last').date
  const [y0, m0] = first.split('-').map(Number)
  const [y1, m1] = last.split('-').map(Number)
  const n = (y1 - y0) * 12 + (m1 - m0) + 1
  return Array.from({ length: n }, (_, i) => {
    const t = m0 - 1 + i
    return lastWorkingDayOfMonth(y0 + Math.floor(t / 12), t % 12)
  })
}

/**
 * Η ΝΟΜΙΚΗ ΒΑΣΗ ΤΟΥ ΕΚΚΑΘΑΡΙΣΤΙΚΟΥ, ΟΠΩΣ ΤΗ ΓΡΑΦΕΙ ΤΟ ΗΜΕΡΟΛΟΓΙΟ. Η πηγή κάθε
 * έτους ζει σε ιδιωτικό πίνακα του greekTaxCalendar.ts και φτάνει έξω μόνο
 * μέσα στις σημειώσεις της δόσης («Εκκαθαριστικό 2026: ΑΑΔΕ …· προθεσμίες
 * κατά το ν. 4223/2013, άρθρο 6.»). Διαβάζεται από εκεί, ώστε ο οδηγός να
 * παραθέτει την ίδια απόφαση με την εφαρμογή. Κενό όσο δεν έχει εκδοθεί.
 */
export function enfiaIssueBasis(year: number): { decision: string; law: string } | null {
  const notes = obligationOf(year, 'enfia-first').notes
  const m = /Εκκαθαριστικό \d{4}: (.+?)· προθεσμίες κατά το (ν\. [^.]+)\./.exec(notes)
  return m ? { decision: m[1], law: m[2] } : null
}

/** Πού βρίσκεται ο αναγνώστης μέσα στο πρόγραμμα: πόσες έμειναν και ποια είναι η επόμενη. */
export function instalmentStatus(dates: readonly string[], today: string): { left: number; next: string | null } {
  const upcoming = dates.filter(d => d >= today)
  return { left: upcoming.length, next: upcoming[0] ?? null }
}
