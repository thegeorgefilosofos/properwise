'use client'
// ΕΙΝΑΙ MODULE ΠΕΛΑΤΗ ΚΑΙ ΤΩΡΑ ΤΟ ΛΕΕΙ. Εξάγει ΜΟΝΟ hooks: τρέχει
// αποκλειστικά σε component πελάτη και όλοι οι καταναλωτές του δηλώνουν ήδη
// 'use client'. Χωρίς τη δήλωση, ο `check-server-imports` το έβλεπε ως Server
// Component που διαβάζει τιμή από module πελάτη (το `useLoad`) — εύρημα
// σωστό στη μορφή του, γιατί ένα module χωρίς τη δήλωση ΜΠΟΡΕΙ να αποδοθεί
// στον διακομιστή, όπου η τιμή θα ερχόταν undefined.
// src/hooks/useMarketData.ts
// Fetches live market data from Supabase (which gets it from ECB + ΤτΕ daily)
// Πέφτει σε σταθερές τιμές όταν η βάση δεν απαντά

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLoad } from '@/app/hooks/useLoad';
import { staleKeys, catalogEntry, greekWhen, MONTH_MEAN, ECB_SERIES, type Provenance, type MarketKey } from '@/lib/market/ecb'
import { athensToday } from '@/lib/core/time'
import { monthGen } from '@/lib/core/months'
import { failed } from '@/lib/core/dbError'
import { captureError } from '@/lib/observability/report'
import type { MarketRatesRow } from '@/lib/supabase/tables'

export interface LiveMarketRates {
  euribor_3m: number
  euribor_1m: number
  euribor_6m: number
  euribor_12m: number
  ecb_rate: number
  ecb_dfl: number
  /**
   * Μέσο επιτόκιο νέων στεγαστικών, ΜΟΝΟ από τη σειρά MIR A2C.A του καταλόγου.
   * `null` όσο η βάση δεν έχει μετρημένη A: η στήλη κρατούσε ως τις 18/10/2026
   * την τιμή της F (κυμαινόμενο ή σταθερό έως 1 έτος) και η λωρίδα την έγραφε
   * «ΤτΕ μέσο».
   */
  bog_housing_new: number | null
  bog_housing_stock: number // ΟΧΙ υπόλοιπα: νέα στεγαστικά με σταθερό >1 και ≤5 έτη, MIR A2C.I…N· το όνομα είναι της στήλης
  updated_at: string
  source_euribor: string
  source_bog: string
  rate_changed: boolean
  isLoading: boolean
  /**
   * ΗΡΘΕ Η ΓΡΑΜΜΗ ΤΗΣ ΒΑΣΗΣ Ή ΟΧΙ. `false` σημαίνει ότι η ανάγνωση απέτυχε και
   * οι τιμές είναι οι τελευταίες γνωστές του κώδικα (`RATES_FALLBACK`). Πριν, το
   * ίδιο το αντικείμενο της εφεδρείας με `isLoading: false` ήταν το μόνο σημάδι
   * και η λωρίδα το διάβαζε από την απουσία ταυτότητας: «εκτίμηση».
   */
  live: boolean
  /**
   * ΠΟΤΕ ΠΑΡΑΤΗΡΗΘΗΚΕ ΚΑΘΕ ΤΙΜΗ, ΠΟΙΟΣ ΤΗ ΛΕΕΙ ΚΑΙ ΤΙ ΜΕΤΡΑ.
   *
   * Πριν, η φρεσκάδα βγαινε από την `updated_at` της γραμμής — δηλαδή από το
   * πότε ΕΤΡΕΞΕ η πρωινή εργασία. Η εργασία έγραφε γραμμή κάθε μέρα ακόμη κι
   * όταν η ΕΚΤ δεν απαντούσε, οπότε η γραμμή ήταν πάντα σημερινή και ο δείκτης
   * παλαιότητας δεν μπορούσε να ενεργοποιηθεί ποτέ. Εδώ η ημερομηνία ανήκει
   * στην ΤΙΜΗ. Κενό μέχρι το πρώτο πέρασμα της νέας τροφοδοσίας.
   */
  provenance: Provenance
  /** Τα κλειδιά που έχουν παλιώσει, με το όριο του καθενός. */
  stale: MarketKey[]
  isStale: boolean
}

export interface LiveBankRate {
  bank_id: string
  bank_name: string
  color: string
  fixed_3yr: string
  fixed_5yr: string
  fixed_10yr: string
  fixed_15yr: string
  fixed_20yr: string
  variable_spread_min: number
  /** `null` όταν η τράπεζα δεν δημοσιεύει ανώτατο περιθώριο. */
  variable_spread_max: number | null
  fixed_min: number
  max_ltv: number
  max_years: number
  max_amount: number
  min_amount: number
  green_discount: number
  spiti_mou: boolean
  features: string[]
  programs: string[]
  fees: string
  note: string
  url: string
  source_url: string | null
  /** Ημερομηνία ισχύος του δελτίου της τράπεζας. Κενή όταν η πηγή δεν τη γράφει. */
  source_doc_date: string | null
  /** '1M' ή '3M': ο δείκτης του κυμαινόμενου. */
  rate_index: string | null
  verified_at: string
}

export interface LiveProgram {
  id: string
  program_id: string
  name: string
  icon: string
  color: string
  status: string
  type_label: string
  description: string
  how_it_works: string
  extra_info: string
  savings_example: string
  max_amount: number | null
  max_prop_value: number | null
  max_ltv: number | null
  max_sqm: number | null
  age_min: number | null
  age_max: number | null
  duration_label: string
  deadline: string | null
  deadline_label: string
  deadline_urgent: boolean
  total_budget: string
  criteria: string[]
  participating_banks: string[]
  source_url: string
}

// ΤΟ `new Date()` ΕΔΩ ΗΤΑΝ ΣΦΡΑΓΙΔΑ ΣΗΜΕΡΙΝΗ ΠΑΝΩ ΣΕ ΝΟΥΜΕΡΑ ΤΟΥ ΚΩΔΙΚΑ.
// Οταν η βάση δεν απαντούσε, ο πίνακας γύριζε αυτές τις χειρόγραφες τιμές με
// ημερομηνία «τώρα» και ο έλεγχος παλαιότητας των 48 ωρών έβρισκε πάντα
// φρέσκα δεδομένα. Σταθερή ημερομηνία, όση αξίζουν: είναι το τελευταίο σημείο
// που ξέρουμε, όχι μέτρηση της στιγμής. Η `provenance` μένει κενή επίτηδες και
// η λωρίδα γράφει δίπλα τους «τελευταία γνωστή τιμή ΕΚΤ» με τον μήνα αυτής της
// ημερομηνίας (`FALLBACK_NOTE`).
//
// ΚΑΙ ΤΑ ΝΟΥΜΕΡΑ ΗΤΑΝ ΛΑΘΟΣ, ΟΧΙ ΑΠΛΩΣ ΠΑΛΙΑ. Στην πρώτη αληθινή εκτέλεση της
// τροφοδοσίας, 01/09/2026, η ΕΚΤ έδωσε Euribor τριμήνου 2,51% εκεί που ο
// κώδικας έγραφε 2,18: τριάντα τρεις μονάδες βάσης κάτω, πάνω στο νούμερο που
// στηρίζει κάθε υπολογισμό κυμαινόμενου δανείου. Το ελληνικό μέσο υφιστάμενο
// έγραφε 3,50 και είναι 3,01. Αντικαταστάθηκαν με τις τιμές που επιστρέφει η
// πηγή, με την ημερομηνία της παρατήρησης και όχι με σφραγίδα «τώρα».
//
// ΤΑ ΕΠΙΤΟΚΙΑ ΤΗΣ ΕΚΤ ΕΙΝΑΙ ΤΑ ΤΡΕΧΟΝΤΑ: 2,65 κύριας αναχρηματοδότησης και
// 2,50 αποδοχής καταθέσεων από 16/09/2026 (απόφαση 10/09/2026,
// https://www.ecb.europa.eu/press/pr/date/2026/html/ecb.mp260910~314e508016.en.html).
// Εγραφαν 2,40 και 2,25, τις τιμές πριν από την απόφαση.
//
// 05/10/2026: ο μέσος όρος ΣΕΠΤΕΜΒΡΙΟΥ για το Euribor (1M 2,4143636, 3M
// 2,6350455, 6M 2,9215909, 12M 3,247) και ο ΑΥΓΟΥΣΤΟΣ για τα ελληνικά επιτόκια
// (νέα στεγαστικά 3,39, MIR.M.GR.B.A2C.F.R.A.2250.EUR.N· υπόλοιπα 2,90), ίδια
// με τη βάση. Εγραφαν τον Αύγουστο για το Euribor και τα νέα στεγαστικά 3,56
// του Ιουνίου. Μηνιαίοι μέσοι, όχι τιμή ημέρας.
//
// ΤΟ ΜΕΣΟ ΝΕΩΝ ΣΤΕΓΑΣΤΙΚΩΝ ΔΕΝ ΕΧΕΙ ΕΦΕΔΡΕΙΑ (19/10/2026). Από τις 13/10/2026 η
// στήλη `bog_housing_new` σημαίνει τη σειρά A2C.A, τον μέσο όρο. Το 3,39 που
// καθόταν εδώ ήταν της A2C.F (κυμαινόμενο ή σταθερό έως 1 έτος) και η καρτέλα
// Δάνειο το έγραφε «ΤτΕ μέσο». Μετρημένη τιμή A δεν υπάρχει ακόμη και νούμερο
// χωρίς πηγή δεν μπαίνει: `null`, οπότε η λωρίδα δεν το δείχνει. Και το
// «υπόλοιπα 2,90» είναι η A2C.I με N: νέες χορηγήσεις με σταθερό πάνω από 1 και
// έως 5 έτη, όχι υπόλοιπα.
const FALLBACK_AS_OF = '2026-09-01T00:00:00Z';

const RATES_FALLBACK: LiveMarketRates = {
  euribor_3m: 2.635, euribor_1m: 2.414, euribor_6m: 2.922, euribor_12m: 3.247,
  ecb_rate: 2.65, ecb_dfl: 2.50, bog_housing_new: null, bog_housing_stock: 2.90,
  updated_at: FALLBACK_AS_OF, source_euribor: 'fallback', source_bog: 'fallback',
  rate_changed: false, isLoading: true, live: false, provenance: {}, stale: [], isStale: false,
}

/** Η εφεδρεία όπως τη βλέπει η οθόνη όταν η ανάγνωση απέτυχε: έτοιμη, όχι ζωντανή. */
export const RATES_UNREAD: LiveMarketRates = { ...RATES_FALLBACK, isLoading: false }

/**
 * Η γραμμή του `market_rates` όπως τη δείχνει η καρτέλα Δάνειο.
 *
 * ΧΩΡΙΣΤΑ ΑΠΟ ΤΟ HOOK ΓΙΑ ΝΑ ΔΟΚΙΜΑΖΕΤΑΙ ΜΕ ΤΗ ΓΡΑΜΜΗ ΤΗΣ ΠΑΡΑΓΩΓΗΣ. Ο
 * έλεγχος app/hooks/marketRates.test.ts της δίνει τη γραμμή της 21/10/2026.
 */
function asProvenance(raw: unknown): Provenance {
  // Jsonb γραμμένο ως κείμενο φτάνει ως συμβολοσειρά· διαβάζεται, δεν πετιέται.
  if (typeof raw === 'string') { try { raw = JSON.parse(raw) } catch { return {} } }
  return (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Provenance
}

export function marketFromRow(row: MarketRatesRow, today: string): LiveMarketRates {
  // Η ΠΑΛΑΙΟΤΗΤΑ ΒΓΑΙΝΕΙ ΑΠΟ ΤΙΣ ΤΙΜΕΣ, ΟΧΙ ΑΠΟ ΤΗ ΓΡΑΜΜΗ. Και κάθε
  // είδος έχει δικό του όριο: το Euribor βγαίνει κάθε εργάσιμη, το
  // επιτόκιο πολιτικής λίγες φορές τον χρόνο. Το παλιό «48 ώρες για
  // όλα» θα φώναζε ψέματα στο δεύτερο ακόμη κι αν δούλευε.
  const provenance = asProvenance(row.provenance)
  const stale = staleKeys(provenance, today)
  return {
    euribor_3m:        row.euribor_3m        ?? RATES_FALLBACK.euribor_3m,
    euribor_1m:        row.euribor_1m        ?? RATES_FALLBACK.euribor_1m,
    euribor_6m:        row.euribor_6m        ?? RATES_FALLBACK.euribor_6m,
    euribor_12m:       row.euribor_12m       ?? RATES_FALLBACK.euribor_12m,
    ecb_rate:          row.ecb_rate          ?? RATES_FALLBACK.ecb_rate,
    ecb_dfl:           row.ecb_dfl           ?? RATES_FALLBACK.ecb_dfl,
    // Η ΣΕΙΡΑ ΚΡΙΝΕΙ, ΟΧΙ Η ΣΤΗΛΗ: τιμή άλλης σειράς δεν περνά με αυτό το όνομα.
    bog_housing_new:   catalogEntry(provenance, 'bog_housing_new')?.value ?? null,
    bog_housing_stock: row.bog_housing_stock ?? RATES_FALLBACK.bog_housing_stock,
    updated_at:        row.updated_at,
    source_euribor:    row.source_euribor    ?? 'fallback',
    source_bog:        row.source_bog        ?? 'fallback',
    rate_changed:      row.rate_changed      ?? false,
    isLoading: false,
    live: true,
    provenance, stale,
    isStale: stale.length > 0,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Η ΛΕΖΑΝΤΑ ΔΙΠΛΑ ΣΕ ΚΑΘΕ ΤΙΜΗ ΤΗΣ ΛΩΡΙΔΑΣ
// ─────────────────────────────────────────────────────────────────────────
// ΤΑ ΣΤΟΙΧΕΙΑ ΤΗΣ ΕΚΤ ΔΕΝ ΕΙΝΑΙ ΕΚΤΙΜΗΣΗ (21/10/2026). Η λωρίδα της καρτέλας
// Δάνειο έγραφε «EURIBOR ΤΡΙΜΗΝΟΥ 2,64% εκτίμηση Σεπ 2026», «ΕΚΤ, ΚΑΤΑΘΕΣΕΙΣ
// 2,50% εκτίμηση Σεπ 2026», χωρίς «ΤτΕ μέσο». Το «εκτίμηση» έβγαινε όποτε έλειπε
// η ταυτότητα της τιμής, δηλαδή όποτε η ανάγνωση του `market_rates` είχε
// αποτύχει και το hook είχε κρατήσει σιωπηλά την εφεδρεία. Και τότε όμως τα
// νούμερα είναι επίσημα: ο μέσος όρος Σεπτεμβρίου της ΕΚΤ και το επιτόκιο που
// ισχύει. Δεν τα εκτιμήσαμε εμείς· απλώς δεν τα διαβάσαμε φρέσκα.
//
// Τρεις περιπτώσεις, καμία «εκτίμηση»:
//   · ζωντανή γραμμή με ταυτότητα: η περίοδος της τιμής («μέσος όρος
//     Σεπτεμβρίου», ή η ημερομηνία για ό,τι αλλάζει με απόφαση)
//   · εφεδρεία, επειδή η ανάγνωση απέτυχε: «τελευταία γνωστή τιμή ΕΚΤ, Σεπ
//     2026», με διακεκομμένη υπογράμμιση
//   · ζωντανή γραμμή χωρίς ταυτότητα για αυτό το κλειδί: τίποτα. Η απουσία
//     λέγεται με απουσία.
// ═══════════════════════════════════════════════════════════════════════════

/** Η λεζάντα της εφεδρείας: τι είναι η τιμή και από πότε. */
export const FALLBACK_NOTE = `τελευταία γνωστή τιμή ΕΚΤ, ${greekWhen(FALLBACK_AS_OF.slice(0, 10), MONTH_MEAN)}`

export interface RateNote {
  text: string
  title: string
  /** Διακεκομμένη υπογράμμιση: παλιά ή εφεδρική τιμή. */
  dotted: boolean
}

/**
 * «μέσος όρος Σεπτεμβρίου» δίπλα σε κάθε τιμή που είναι μέσος όρος μήνα.
 *
 * ΤΟ «Αυγ 2026» ΔΙΑΒΑΖΟΤΑΝ ΩΣ ΣΗΜΕΡΙΝΗ ΤΙΜΗ (28.09.2026). Το Euribor της ΕΚΤ
 * στη λωρίδα είναι ο μέσος όρος του προηγούμενου μήνα· γράφεται αυτό ακριβώς.
 * Οι σειρές που αλλάζουν σε συγκεκριμένη μέρα κρατούν την ημερομηνία τους.
 */
function periodOf(asOf: string, basis: string): string {
  const m = /^\d{4}-(\d{2})-\d{2}$/.exec(asOf || '')
  return m && basis === MONTH_MEAN ? `μέσος όρος ${monthGen(Number(m[1]) - 1)}` : greekWhen(asOf, basis)
}

/** Τι γράφεται δίπλα στην τιμή `key`. `null`: τίποτα. */
export function rateNote(market: LiveMarketRates, key: MarketKey): RateNote | null {
  if (market.isLoading) return null
  if (!market.live) return {
    text: FALLBACK_NOTE,
    title: 'Η ανάγνωση των επιτοκίων απέτυχε. Είναι η τελευταία γνωστή τιμή της ΕΚΤ, όχι η σημερινή ανάγνωση.',
    dotted: true,
  }
  const p = market.provenance[key]
  if (!p) return null
  const stale = market.stale.includes(key)
  return {
    text: periodOf(p.asOf, p.basis),
    title: `${p.basis}, ${p.source}${stale ? '. Δεν ανανεώθηκε στον αναμενόμενο χρόνο' : ''}`,
    dotted: stale,
  }
}

/** Πόσες φορές δοκιμάζεται η ανάγνωση και πόσο περιμένει πριν από κάθε νέα. */
const READ_RETRIES_MS = [800, 2500] as const

export function useMarketRates() {
  const [data, setData] = useState<LiveMarketRates>(RATES_FALLBACK)
  const supabase = createClient()

  useEffect(() => {
    let alive = true
    // ΜΙΑ ΑΠΟΤΥΧΙΑ ΑΝΑΓΝΩΣΗΣ ΚΡΑΤΟΥΣΕ ΤΗΝ ΕΦΕΔΡΕΙΑ ΓΙΑ ΟΛΗ ΤΗ ΖΩΗ ΤΗΣ ΚΑΡΤΕΛΑΣ
    // (21/10/2026). Η γραμμή της βάσης ήταν σωστή και πλήρης· το hook τη δίνει
    // σωστά στη λωρίδα (app/hooks/marketRates.test.ts, με τη γραμμή της
    // παραγωγής). Ομως ό,τι κι αν χαλούσε στον πελάτη — σφάλμα στο `error`,
    // κενό `row`, εξαίρεση — κατέληγε στο ίδιο: `isLoading: false` πάνω στην
    // εφεδρεία, μία φορά, χωρίς δεύτερη δοκιμή. Το σφάλμα πήγαινε μόνο στην
    // κονσόλα και η εξαίρεση πουθενά (`catch {}`), οπότε κανείς δεν το μάθαινε
    // και η λωρίδα έγραφε «εκτίμηση» σε επίσημα νούμερα.
    //
    // Τώρα: δύο ακόμη δοκιμές. Αν αποτύχουν και αυτές, η εφεδρεία βγαίνει
    // με `live: false`, λέει τι είναι («τελευταία γνωστή τιμή») και η αποτυχία
    // ταξιδεύει στο Sentry με τον λόγο της.
    async function readOnce(): Promise<{ row: MarketRatesRow | null; reason: string }> {
      try {
        const { data: row, error } = await supabase
          .from('market_rates')
          .select('*')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (error) return { row: null, reason: `${error.code || 'χωρίς κωδικό'}: ${error.message}` }
        if (!row) return { row: null, reason: 'καμία γραμμή' }
        return { row, reason: '' }
      } catch (e) {
        return { row: null, reason: e instanceof Error ? `${e.name}: ${e.message}` : String(e) }
      }
    }
    async function load() {
      const reasons: string[] = []
      for (let attempt = 0; attempt <= READ_RETRIES_MS.length; attempt++) {
        if (attempt > 0) await new Promise(r => setTimeout(r, READ_RETRIES_MS[attempt - 1]))
        if (!alive) return
        const { row, reason } = await readOnce()
        if (!alive) return
        if (row) {
          try {
            setData(marketFromRow(row, athensToday()))
            return
          } catch (e) {
            reasons.push(`η γραμμή δεν διαβάστηκε: ${e instanceof Error ? e.message : String(e)}`)
            break
          }
        }
        reasons.push(reason)
      }
      if (!alive) return
      console.error('[useMarketRates] τα επιτόκια δεν διαβάστηκαν, δείχνεται η τελευταία γνωστή τιμή:', reasons)
      captureError(new Error('market_rates: η ανάγνωση απέτυχε, η λωρίδα δείχνει την εφεδρεία'), {
        attempts: reasons.length, reasons: reasons.join(' | '),
      })
      setData(RATES_UNREAD)
    }
    load()
    return () => { alive = false }
  }, [supabase])

  return data
}

// ΓΙΑΤΙ ΕΠΙΣΤΡΕΦΕΙ `reload`.
// Ο διαχειριστής αποθήκευε νέα επιτόκια από το BankRatesAdmin και η οθόνη
// κρατούσε τα ΠΑΛΙΑ: το hook φόρτωνε μία φορά, μέσα σε useEffect με κενές
// εξαρτήσεις και δεν έδινε τίποτα να ξανακληθεί. Το BankRatesAdmin ξαναδιάβαζε
// ΜΟΝΟ τον δικό του πίνακα, οπότε στην ίδια οθόνη φαίνονταν δύο διαφορετικά
// επιτόκια για την ίδια τράπεζα — το νέο στον πίνακα του διαχειριστή, το παλιό
// στις κάρτες σύγκρισης από κάτω. Και η ημερομηνία «επιβεβαιώθηκε» έμενε πίσω.
// ═══════════════════════════════════════════════════════════════════════════
// Η ΚΑΤΑΣΤΑΣΗ ΤΗΣ ΤΡΟΦΟΔΟΣΙΑΣ, ΓΙΑ ΟΠΟΙΟΝ ΤΗ ΣΥΝΤΗΡΕΙ
// ─────────────────────────────────────────────────────────────────────────
// ΜΑΘΑΜΕ ΓΙΑ ΣΠΑΣΜΕΝΗ ΕΡΓΑΣΙΑ ΕΠΕΙΔΗ ΕΤΥΧΕ ΝΑ ΚΟΙΤΑΞΟΥΜΕ. Δύο εργασίες έτρεχαν
// χαλασμένες επί μήνες: η μία αποτύγχανε κάθε μέρα με ανυποκατάστατη διεύθυνση,
// η άλλη έγραφε παλιά επιτόκια πάνω από τα σωστά. Καμία δεν ειδοποίησε κανέναν.
//
// Ο ΟΡΙΣΜΟΣ ΤΟΥ «ΧΑΛΑΣΕ» ΔΕΝ ΓΡΑΦΕΤΑΙ ΕΔΩ. Ζει στη `market_feed_health()` της
// βάσης, όπου τον διαβάζει και ο νυχτερινός φύλακας. Δύο ορισμοί θα απέκλιναν
// ακριβώς τη μέρα που θα άλλαζε ο ένας.
//
// ΤΙ ΔΕΝ ΚΑΝΕΙ: δεν το βλέπει ο απλός χρήστης. Εκείνος βλέπει ήδη την αλήθεια —
// κάθε τιμή κουβαλά την ημερομηνία της και η παλιά υπογραμμίζεται. Αυτό εδώ
// είναι για όποιον μπορεί να το ΔΙΟΡΘΩΣΕΙ.
export interface FeedHealth {
  ok: boolean;
  reason: string;
  hoursSilent: number | null;
  valuesPresent: number;
  valuesExpected: number;
  /** Οσο είναι false, δεν ξέρουμε τίποτα και δεν λέμε τίποτα. */
  checked: boolean;
}

export function useMarketFeedHealth(enabled: boolean) {
  const [health, setHealth] = useState<FeedHealth>({
    ok: true, reason: '', hoursSilent: null, valuesPresent: 0, valuesExpected: ECB_SERIES.length, checked: false,
  })
  const supabase = createClient()

  useEffect(() => {
    if (!enabled) return
    let alive = true
    async function check() {
      try {
        const { data, error } = await supabase.rpc('market_feed_health')
        // ΣΦΑΛΜΑ ΑΝΑΓΝΩΣΗΣ ΔΕΝ ΕΙΝΑΙ «ΟΛΑ ΚΑΛΑ». Αν η κλήση αποτύχει — η
        // συνάρτηση δεν έχει ανέβει ακόμη, η βάση δεν απαντά — το `data` έρχεται
        // κενό. Χωρίς αυτόν τον έλεγχο, το κενό θα διαβαζόταν ως «καμία ένδειξη
        // προβλήματος» και η γραμμή δεν θα εμφανιζόταν ΠΟΤΕ, ακριβώς όπως οι
        // εργασίες που αποτύγχαναν σιωπηλά επί μήνες. Μένει `checked: false`:
        // δεν ξέρουμε, άρα δεν λέμε τίποτα· αυτό είναι διαφορετικό από
        // «ελέγχθηκε και είναι εντάξει».
        if (error) return
        const row = Array.isArray(data) ? data[0] : data
        if (!alive || !row) return
        setHealth({
          ok: !!row.ok,
          reason: row.reason ?? '',
          hoursSilent: row.hours_silent == null ? null : Number(row.hours_silent),
          valuesPresent: row.values_present ?? 0,
          valuesExpected: row.values_expected ?? ECB_SERIES.length,
          checked: true,
        })
      } catch { /* σιωπή: μια αποτυχία ελέγχου δεν είναι αποτυχία τροφοδοσίας */ }
    }
    check()
    return () => { alive = false }
  }, [enabled, supabase])

  return health
}

// ═══ Η ΥΓΕΙΑ ΤΗΣ ΤΡΟΦΟΔΟΣΙΑΣ ΕΠΙΤΟΚΙΩΝ ΤΡΑΠΕΖΩΝ ═══════════════════════════
// Ο ορισμός ζει στη `bank_feed_health()` της βάσης, όπως και για την ΕΚΤ.
// Εδώ διαβάζεται μόνο, ώστε η οθόνη να μπορεί να πει «ελέγχθηκαν σήμερα,
// αμετάβλητα από …» αντί να μετρά ημέρες από το `verified_at` και να
// υποθέτει ότι κανείς δεν κοίταξε.
export interface BankFeedHealth {
  ok: boolean;
  reason: string;
  /** Πότε έτρεξε τελευταία η τροφοδοσία, ό,τι κι αν βρήκε. */
  lastCheck: string | null;
  /** Πότε έτρεξε τελευταία ΚΑΙ πέτυχε. */
  lastOk: string | null;
  hoursSilent: number | null;
  /** Η παλαιότερη επιβεβαίωση ανάμεσα στις ενεργές τράπεζες. */
  verifiedAt: string | null;
  /** Μεταβολές που περιμένουν δεύτερη επιβεβαίωση. */
  heldChanges: number;
  /** Οσο είναι false, δεν ξέρουμε τίποτα και δεν λέμε τίποτα. */
  checked: boolean;
}

const NO_BANK_HEALTH: BankFeedHealth = {
  ok: true, reason: '', lastCheck: null, lastOk: null, hoursSilent: null, verifiedAt: null, heldChanges: 0, checked: false,
}

export function useBankRates() {
  const [banks, setBanks] = useState<LiveBankRate[]>([])
  const [loading, setLoading] = useState(true)
  const [verifiedAt, setVerifiedAt] = useState<string>('')
  const [health, setHealth] = useState<BankFeedHealth>(NO_BANK_HEALTH)
  const [error, setError] = useState('')
  const supabase = createClient()

  const reload = useCallback(async () => {
    // ΚΕΝΟΣ ΚΑΤΑΛΟΓΟΣ ΤΡΑΠΕΖΩΝ ΔΕΝ ΕΙΝΑΙ «ΚΑΜΙΑ ΠΡΟΣΦΟΡΑ». Χωρίς το `error`, μια
    // αποτυχία ανάγνωσης άφηνε το `banks` άδειο και η σύγκριση δανείων έδειχνε
    // κενή σελίδα — δηλαδή έλεγε στον χρήστη ότι δεν υπάρχουν προσφορές, ενώ
    // απλώς δεν διαβάστηκαν. Το `error` βγαίνει τώρα στον καλούντα.
    const { data, error: err } = await supabase
      .from('bank_rates')
      .select('*')
      .eq('is_active', true)
      .order('fixed_min', { ascending: true })

    if (err) {
      console.error('[useBankRates] τα επιτόκια τραπεζών δεν διαβάστηκαν:', err)
      setError(failed('Τα επιτόκια των τραπεζών δεν διαβάστηκαν', err))
    } else {
      setError('')
      if (data?.length) {
        setBanks(data)
        setVerifiedAt(data[0].verified_at)
      }
    }
    setLoading(false)
    // Σφάλμα ανάγνωσης δεν είναι «όλα καλά»: μένει `checked: false` και η
    // οθόνη πέφτει στην παλιά της γλώσσα, τις ημέρες από το verified_at.
    try {
      const { data: h, error } = await supabase.rpc('bank_feed_health')
      const row = Array.isArray(h) ? h[0] : h
      if (!error && row) setHealth({
        ok: !!row.ok, reason: row.reason ?? '', lastCheck: row.last_check ?? null, lastOk: row.last_ok ?? null,
        hoursSilent: row.hours_silent == null ? null : Number(row.hours_silent),
        verifiedAt: row.verified_at ?? null, heldChanges: Number(row.held_changes ?? 0), checked: true,
      })
    } catch { /* μια αποτυχία ελέγχου δεν είναι αποτυχία τροφοδοσίας */ }
  }, [supabase])

  // Η αποτυχία σβήνει τον δείκτη φόρτωσης· και τα δύο συμβαίνουν στην απάντηση.
  const boot = useCallback(() => reload().catch(() => setLoading(false)), [reload])
  useLoad(boot)

  return { banks, loading, verifiedAt, health, reload, error }
}

// Ελέγχει αν ο συνδεδεμένος χρήστης ανήκει στη λίστα διαχειριστών (app_admins).
// Η ίδια λίστα ελέγχεται και από την πολιτική RLS του bank_rates, ώστε UI και
// βάση να συμφωνούν από μία και μόνη πηγή αλήθειας — χωρίς email στον κώδικα.
export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [checked, setChecked] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function check() {
      try {
        // ΑΠΟΤΥΓΧΑΝΕΙ ΚΛΕΙΣΤΑ ΚΑΙ ΕΤΣΙ ΠΡΕΠΕΙ: αποτυχία ανάγνωσης δεν δίνει
        // δικαιώματα διαχειριστή. Ηταν όμως ΚΑΙ αόρατη — ένας διαχειριστής
        // έχανε τα εργαλεία του χωρίς να μάθει ποτέ γιατί.
        const { data: { user }, error: userErr } = await supabase.auth.getUser()
        if (userErr) console.error('[useIsAdmin] η ταυτότητα δεν διαβάστηκε:', userErr)
        const email = user?.email
        if (email) {
          const { data, error: adminErr } = await supabase
            .from('app_admins')
            .select('email')
            .eq('email', email)
            .maybeSingle()
          if (adminErr) console.error('[useIsAdmin] ο κατάλογος διαχειριστών δεν διαβάστηκε:', adminErr)
          setIsAdmin(!!data)
        }
      } catch (err) { console.error('[useIsAdmin] ο έλεγχος διαχειριστή απέτυχε:', err) }
      setChecked(true)
    }
    check()
  }, [supabase])

  return { isAdmin, checked }
}

export function useLoanPrograms() {
  const [programs, setPrograms] = useState<LiveProgram[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      try {
        // Χρησιμοποιεί την όψη της βάσης, που φιλτράρει μόνη της τα ληγμένα προγράμματα
        const { data, error: err } = await supabase
          .from('active_loan_programs')
          .select('*')

        // Ιδιο μοτίβο με τις τράπεζες: «δεν τρέχει κανένα πρόγραμμα» και «δεν
        // διαβάστηκαν τα προγράμματα» έδιναν την ίδια κενή οθόνη.
        if (err) { console.error('[useLoanPrograms] τα προγράμματα δεν διαβάστηκαν:', err); setError(failed('Τα προγράμματα δανείων δεν διαβάστηκαν', err)) }
        else { setError(''); if (data?.length) setPrograms(data) }
      } catch (err) { setError(failed('Τα προγράμματα δανείων δεν διαβάστηκαν', err)) }
      setLoading(false)
    }
    load()
    // Ανανέωση κάθε τριάντα λεπτά
    const interval = setInterval(load, 30 * 60 * 1000)
    return () => clearInterval(interval)
  }, [supabase])

  return { programs, loading, error }
}
