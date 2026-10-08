// ═══════════════════════════════════════════════════════════════════════════
// ΑΝΑΓΝΩΣΗ ΠΟΥ ΑΠΕΤΥΧΕ ΔΕΝ ΕΙΝΑΙ ΜΗΔΕΝ.
// ─────────────────────────────────────────────────────────────────────────
// Η Επισκόπηση διαβάζει είκοσι πηγές με μία κίνηση. Ως τις 08/10/2026 κρατούσε
// μόνο τα `data` τους: όταν μία έπεφτε (δίκτυο, λήξη συνεδρίας, όριο χρόνου), η
// λίστα της γινόταν κενή και η οθόνη έγραφε «0€» στα ενοίκια ή «Δεν εκκρεμεί
// τίποτα» στις εκκρεμότητες. Ψέμα με σωστή μορφοποίηση, στην πρώτη οθόνη.
//
// Εδώ ζει μόνο η απόφαση: ποιες περιοχές απέτυχαν και αν ανάμεσά τους είναι
// κάποια που κρατά λεφτά. Αν ναι, η οθόνη δεν δείχνει κανένα σύνολο, γιατί ένα
// μισό σύνολο διαβάζεται σαν ολόκληρο.
// ═══════════════════════════════════════════════════════════════════════════

/** Μία ανάγνωση: η περιοχή όπως τη βλέπει ο χρήστης και το σφάλμα της, αν υπάρχει. */
export type ReadCheck = readonly [area: string, error: unknown]

/** Οι περιοχές που μπαίνουν σε ποσά της Επισκόπησης (ταμείο, απόδοση, σύνολα). */
export const MONEY_AREAS: readonly string[] = [
  'Δαπάνες', 'Λογαριασμοί', 'Ενοίκια', 'Ενοικιαστές', 'Δάνεια', 'Διαμονές', 'Ιδιοκτήτες',
]

/** Οι περιοχές που απέτυχαν, μία φορά η καθεμία, με τη σειρά που δόθηκαν. */
export function readFailures(checks: readonly ReadCheck[]): string[] {
  const out: string[] = []
  for (const [area, error] of checks) if (error && !out.includes(area)) out.push(area)
  return out
}

/** Αν λείπει έστω μία περιοχή με ποσά, κανένα σύνολο δεν είναι αληθινό. */
export function moneyIncomplete(failed: readonly string[]): boolean {
  return failed.some(a => MONEY_AREAS.includes(a))
}

/** «Δεν φορτώθηκαν: Δαπάνες, Ενοίκια και Δάνεια.» Κενό αν δεν απέτυχε τίποτα. */
export function failedSentence(failed: readonly string[]): string {
  if (failed.length === 0) return ''
  const list = failed.length === 1
    ? failed[0]
    : `${failed.slice(0, -1).join(', ')} και ${failed[failed.length - 1]}`
  return `Δεν φορτώθηκαν: ${list}.`
}

// ═══ ΚΑΙ ΤΟ ΑΝΤΙΣΤΡΟΦΟ: ΕΚΚΡΕΜΟΤΗΤΑ ΠΟΥ ΒΓΗΚΕ ΑΠΟ ΤΗΝ ΑΠΟΥΣΙΑ ═════════════
// Το κενό που γράφει «0€» έχει δίδυμο: το κενό που γεννά εκκρεμότητα. Με
// αποτυχημένη ανάγνωση ενοικιαστών η ατζέντα έλεγε «Πρόσθεσε ενοικιαστή», με
// αποτυχημένη ανάγνωση της δήλωσης μίσθωσης ξαναζητούσε δήλωση που είχε
// υποβληθεί και η πληρωμένη δόση ΕΝΦΙΑ ξαναγινόταν οφειλή. Βρέθηκε στον έλεγχο
// της 08/10/2026. Ό,τι στηρίζεται σε περιοχή που δεν διαβάστηκε δεν λέγεται.

/** Από αυτές κρίνεται αν μια προθεσμία ΕΚΛΕΙΣΕ, γι' αυτό έχουν δικό τους όνομα. */
export const LEASE_DECL_AREA = 'Δήλωση μίσθωσης'
export const TAX_DEADLINES_AREA = 'Φορολογικές προθεσμίες'

/** Ποιες περιοχές κρίνουν ότι ένα βήμα ρύθμισης «δεν έγινε». */
const STEP_SOURCES: Readonly<Record<string, readonly string[]>> = {
  details: ['Ενοικιαστές'],
  tenant: ['Ενοικιαστές'],
  expense: ['Δαπάνες'],
  bills: ['Λογαριασμοί'],
  pricing: ['Διαμονές'],
  inv: ['Εξοπλισμός'],
}

/** Ποιες περιοχές διαβάζει κάθε παρατήρηση του `lib/insights/engine.ts`. */
export const INSIGHT_SOURCES: Readonly<Record<string, readonly string[]>> = {
  'insurance-expired': [],
  'insurance-soon': [],
  'profile-incomplete': [],
  'lease-expired': ['Ενοικιαστές'],
  'lease-soon': ['Ενοικιαστές'],
  'bills-overdue': ['Λογαριασμοί'],
  'bills-unpaid': ['Λογαριασμοί'],
  'tasks-overdue': ['Εκκρεμότητες'],
  'chk-overdue': ['Εκκρεμότητες'],
  'warranty-soon': ['Εξοπλισμός'],
  'vacant': ['Ενοικιαστές', 'Ενοίκια'],
  'vacant-st': ['Ενοικιαστές'],
  'energy-review': ['Λογαριασμοί', 'Δαπάνες'],
  'spend-spike': ['Δαπάνες'],
  'no-expenses': ['Δαπάνες'],
  'stale': ['Δαπάνες'],
  'yield-strong': MONEY_AREAS,
  'yield-low': MONEY_AREAS,
  'loan-cash-negative': MONEY_AREAS,
  'loan-cash-positive': MONEY_AREAS,
}

/** Άγνωστη πηγή: όσο κάτι απέτυχε, δεν ξέρουμε αν ισχύει, οπότε δεν λέγεται. */
function trusted(sources: readonly string[] | undefined, failed: readonly string[]): boolean {
  if (failed.length === 0) return true
  if (!sources) return false
  return !sources.some(a => failed.includes(a))
}

/** Το βήμα ρύθμισης λέγεται μόνο αν διαβάστηκε ό,τι το κρίνει. */
export const trustedStep = (key: string, failed: readonly string[]): boolean =>
  trusted(STEP_SOURCES[key], failed)

/** Η παρατήρηση λέγεται μόνο αν διαβάστηκαν όλες οι περιοχές της. */
export const trustedInsight = (id: string, failed: readonly string[]): boolean =>
  trusted(INSIGHT_SOURCES[id], failed)

/**
 * Οι υποχρεώσεις βγαίνουν από ΠΑΡΟΥΣΙΑ δεδομένων (μίσθωση, ασφάλεια,
 * συντήρηση): μια αποτυχία τις κρύβει, δεν τις επινοεί. Εξαίρεση οι δύο που
 * σβήνουν όταν ΚΛΕΙΣΟΥΝ: η δήλωση μίσθωσης και οι φορολογικές προθεσμίες.
 */
export function trustedObligation(o: { id: string; category?: string }, failed: readonly string[]): boolean {
  if (o.category === 'tax') return !failed.includes(TAX_DEADLINES_AREA)
  if (o.id === 'lease_decl') return !failed.includes(LEASE_DECL_AREA)
  return true
}
