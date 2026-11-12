// ─────────────────────────────────────────────────────────────────────────────
// Επέκταση επαναλαμβανόμενων γεγονότων σε μεμονωμένες εμφανίσεις μέσα σε ένα εύρος.
// Καθαρές συναρτήσεις με ακέραια αριθμητική ημερομηνίας (χωρίς σφάλματα ζώνης ώρας).
// Η βάση (base) κρατά το πραγματικό id/ημερομηνία· οι εικονικές εμφανίσεις παίρνουν
// _virtual + _seriesId ώστε το UI να ξέρει ότι ανήκουν σε σειρά.
// ─────────────────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0')
const isoU = (dt: Date) => `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`

// `yearly`: 02.10.2026. Η Φροντίδα μισθωτή (TabTenantHelpers) έγραφε
// `recurring_interval: 'yearly'` ενώ εδώ υπήρχε μόνο το `annual`. Η σειρά δεν
// αναπτυσσόταν καθόλου: φαινόταν μόνο η πρώτη εμφάνιση. Το συνώνυμο καλύπτει
// τις γραμμές που είναι ήδη αποθηκευμένες· οι νέες γράφονται ως `annual`.
const STEP_MONTHS: Record<string, number> = { monthly: 1, bimonthly: 2, quarterly: 3, biannual: 6, annual: 12, yearly: 12 }

// Η εμφάνιση `n` (0 = η ίδια η βάση) μιας «YYYY-MM-DD», ΠΑΝΤΑ από τη βάση, ή
// null αν το interval είναι άγνωστο.
//
// 02.10.2026: η ανάπτυξη αλυσόδενε κάθε εμφάνιση στην προηγούμενη, οπότε μια
// κλειδωμένη μέρα κολλούσε: μηνιαία από 31.1 έδινε 28.2, 28.3, 28.4 αντί για
// 28.2, 31.3, 30.4. Τώρα κάθε εμφάνιση είναι βάση + n βήματα, με κλείδωμα στο
// τέλος του μήνα σε κάθε μία χωριστά.
export function occurrenceAt(base: string, interval: string, n: number): string | null {
  const [y, m, d] = base.split('-').map(Number)
  if (interval === 'weekly') return isoU(new Date(Date.UTC(y, m - 1, d + 7 * n)))
  const step = STEP_MONTHS[interval]
  if (!step) return null
  const total = (m - 1) + step * n
  const ny = y + Math.floor(total / 12)
  const nm = ((total % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate() // τελευταία μέρα του μήνα-στόχου
  return `${ny}-${pad(nm + 1)}-${pad(Math.min(d, lastDay))}`
}

// Επόμενη εμφάνιση μιας «YYYY-MM-DD» για το δοσμένο interval, ή null αν άγνωστο.
export function nextOccurrence(date: string, interval: string): string | null {
  return occurrenceAt(date, interval, 1)
}

// ΔΕΧΕΤΑΙ ΤΗ ΓΡΑΜΜΗ ΤΗΣ ΒΑΣΗΣ ΟΠΩΣ ΕΙΝΑΙ (10/11/2026). Η send-reminders περνά
// `CalendarEventsRow`, όπου το `recurring` είναι `boolean | null` και τα
// `recurrence_exdates` είναι `Json`. Με στενότερο τύπο εδώ, ο έλεγχος Deno
// έπεφτε και η ανάπτυξη θα χρειαζόταν `as` στον καλούντα.
export interface Recurrable {
  id: string; event_date: string; recurring?: boolean | null; recurring_interval?: string | null
  recurrence_until?: string | null           // «YYYY-MM-DD» λήξη σειράς
  recurrence_count?: number | null           // μέγιστο πλήθος εμφανίσεων (base = 1η)
  /** Ημερομηνίες εξαίρεσης «YYYY-MM-DD». Στη βάση είναι jsonb, γι' αυτό `unknown`: ό,τι δεν είναι ημερομηνία αγνοείται. */
  recurrence_exdates?: unknown
  /** Η πηγή της γραμμής (`tax:…` για τις θεσμικές προθεσμίες). */
  source?: string | null
}

/** Οι ημερομηνίες εξαίρεσης, μόνο όσες είναι κείμενο. */
function exdatesOf(v: unknown): Set<string> {
  return new Set(Array.isArray(v) ? v.filter((d): d is string => typeof d === 'string') : [])
}

// Επιστρέφει όλες τις εμφανίσεις (base + εικονικές) που πέφτουν στο [rangeStart, rangeEnd]
// (συμπεριληπτικά, «YYYY-MM-DD»). Τηρεί recurrence_until (λήξη), recurrence_count (πλήθος,
// συμπεριλαμβανομένης της base) και recurrence_exdates (εξαιρέσεις — μετρούν στο count κατά
// iCal αλλά ΔΕΝ εμφανίζονται). Οι εικονικές έχουν event_date = ημερομηνία εμφάνισης,
// συνθετικό id «<id>__<date>», _virtual=true, _seriesId=<αρχικό id>.
export function expandRecurring<T extends Recurrable>(
  events: T[], rangeStart: string, rangeEnd: string, cap = 400
): (T & { _virtual?: boolean; _seriesId?: string })[] {
  const out: (T & { _virtual?: boolean; _seriesId?: string })[] = []
  for (const e of events) {
    const until = e.recurrence_until || null
    const count = (typeof e.recurrence_count === 'number' && e.recurrence_count > 0) ? e.recurrence_count : null
    const ex = exdatesOf(e.recurrence_exdates)
    let idx = 0
    // Θεωρεί μια εμφάνιση: ενημερώνει τον μετρητή, την εμφανίζει αν είναι εντός εύρους
    // και δεν εξαιρείται. Επιστρέφει false αν η σειρά έχει εξαντληθεί (until/count).
    const consider = (date: string, isBase: boolean): boolean => {
      if (until && date > until) return false
      if (count != null && idx >= count) return false
      if (date >= rangeStart && date <= rangeEnd && !ex.has(date)) {
        out.push(isBase ? e : { ...e, event_date: date, id: `${e.id}__${date}`, _virtual: true, _seriesId: e.id })
      }
      idx++
      return true
    }
    if (!consider(e.event_date, true)) continue
    if (!e.recurring || !e.recurring_interval) continue
    for (let n = 1; n <= cap; n++) {
      const cur = occurrenceAt(e.event_date, e.recurring_interval, n)
      if (!cur) break
      if (until && cur > until) break
      if (count != null && idx >= count) break
      if (cur > rangeEnd) break
      consider(cur, false)
    }
  }
  return out
}

// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΥΠΕΝΘΥΜΙΣΕΙΣ ΤΟΥ ΔΙΑΚΟΜΙΣΤΗ ΒΛΕΠΟΥΝ ΤΗ ΣΕΙΡΑ ΟΠΩΣ ΤΗ ΒΛΕΠΕΙ Ο ΧΡΗΣΤΗΣ
// ─────────────────────────────────────────────────────────────────────────
// Ως τις 10/11/2026 η send-reminders και το /api/push διάβαζαν μόνο τις
// αποθηκευμένες γραμμές. Μια μηνιαία σειρά είναι ΜΙΑ γραμμή (η βάση), οπότε
// υπενθύμιση έπαιρνε μόνο η πρώτη ημερομηνία· μετά η βάση έμενε `pending` με
// παλιά ημερομηνία και έφευγε κάθε μέρα και «ληξιπρόθεσμο» γι' αυτήν. Η οθόνη
// ρυθμίσεων όμως υπόσχεται υπενθυμίσεις «για τα γεγονότα του ημερολογίου σου»
// και το ημερολόγιο δείχνει κάθε εμφάνιση.
//
// Οι δύο συναρτήσεις εδώ δεν έχουν εισαγωγές, ώστε να τις διαβάζει και η Deno
// (supabase/functions/send-reminders) χωρίς δεύτερο αντίγραφο της λογικής.

/**
 * Ό,τι πρέπει να ελεγχθεί για υπενθύμιση: οι εμφανίσεις μέσα στο [today,
 * horizonEnd] με ακριβώς τους κανόνες της `expandRecurring` που δείχνει το
 * ημερολόγιο· επίσης τα ληξιπρόθεσμα. Ληξιπρόθεσμο είναι μόνο γεγονός ΧΩΡΙΣ
 * επανάληψη: η βάση μιας σειράς δεν «λήγει», συνεχίζει με την επόμενη εμφάνιση,
 * που υπενθυμίζεται κανονικά.
 */
export function reminderOccurrences<T extends Recurrable>(
  events: T[], today: string, horizonEnd: string,
): { upcoming: (T & { _virtual?: boolean; _seriesId?: string })[]; overdue: T[] } {
  return {
    upcoming: expandRecurring(events, today, horizonEnd),
    overdue: events.filter(e => e.event_date < today && !(e.recurring && e.recurring_interval) && !isIncomeInstalmentSource(e.source)),
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΔΟΣΕΙΣ ΤΟΥ ΦΟΡΟΥ ΕΙΣΟΔΗΜΑΤΟΣ: ΜΙΑ ΥΠΕΝΘΥΜΙΣΗ, ΠΟΤΕ «ΛΗΞΙΠΡΟΘΕΣΜΟ»
// ─────────────────────────────────────────────────────────────────────────
// Ο συγχρονισμός γράφει τις οκτώ δόσεις σε κάθε νοικιασμένο ακίνητο, αλλά η
// εφαρμογή δεν ξέρει αν ο χρήστης χρωστά φόρο (μηδέν, επιστροφή ή εφάπαξ τον
// Ιούλιο). Με τους κανόνες των άλλων γεγονότων θα έφευγαν ως οκτώ email
// «Ληξιπρόθεσμο» και ως τέσσερις υπενθυμίσεις ανά δόση τον χρόνο, σε όσους δεν
// χρωστούν τίποτα. Δύο κανόνες, εδώ, ώστε να τους διαβάζουν και το email (Deno)
// και η ειδοποίηση τηλεφώνου:
//   · περασμένη δόση δεν είναι ποτέ «ληξιπρόθεσμη» (`reminderOccurrences`)·
//   · μία υπενθύμιση ανά δόση, τρεις μέρες πριν (`reminderAllowed`)· καμία
//     στην ειδοποίηση τηλεφώνου, που ήδη υπενθυμίζει μόνο σήμερα και αύριο.
// Ο συγχρονισμός (lib/calendar/taxSync.ts) σβήνει επιπλέον την περασμένη δόση
// που ο χρήστης δεν άγγιξε.

/** Το πρόθεμα της πηγής των δόσεων. Το τεστ το δένει με το `taxEventSource`. */
export const INCOME_INSTALMENT_SOURCE_PREFIX = 'tax:income-instalment-'

/** Γραμμή δόσης φόρου εισοδήματος (από την πηγή της). */
export function isIncomeInstalmentSource(source: string | null | undefined): boolean {
  return typeof source === 'string' && source.startsWith(INCOME_INSTALMENT_SOURCE_PREFIX)
}

/** Ο μόνος τύπος υπενθύμισης για τις δόσεις του φόρου εισοδήματος. */
export const INCOME_INSTALMENT_REMINDER = '3days'

/** Επιτρέπεται υπενθύμιση αυτού του τύπου (`7days`, `3days`, `1day`, `today`) για τη γραμμή; */
export function reminderAllowed(e: { source?: string | null }, type: string): boolean {
  return !isIncomeInstalmentSource(e.source) || type === INCOME_INSTALMENT_REMINDER
}

/**
 * Το κλειδί του μητρώου απεσταλμένων (`notification_log`). Το `event_id` είναι
 * uuid, άρα μια εικονική εμφάνιση γράφεται με το id της βάσης και η ημερομηνία
 * μπαίνει στο είδος: «1day@2026-12-01». Τα μεμονωμένα γεγονότα κρατούν το
 * παλιό κλειδί, οπότε όσα έχουν ήδη σταλεί δεν ξαναφεύγουν.
 */
export function reminderKey(
  e: { id: string; event_date: string; _virtual?: boolean; _seriesId?: string }, type: string,
): { event_id: string; reminder_type: string } {
  return e._virtual && e._seriesId
    ? { event_id: e._seriesId, reminder_type: `${type}@${e.event_date}` }
    : { event_id: e.id, reminder_type: type }
}
