// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΜΕΣΟ ΕΠΙΤΟΚΙΟ ΤΗΣ ΑΓΟΡΑΣ, ΔΙΑΒΑΣΜΕΝΟ ΣΤΟΝ ΔΙΑΚΟΜΙΣΤΗ
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΣΤΟΝ ΔΙΑΚΟΜΙΣΤΗ ΚΑΙ ΟΧΙ ΣΤΟΝ ΠΕΡΙΗΓΗΤΗ. Η σελίδα είναι δημόσια: ο
// επισκέπτης δεν κατεβάζει τον πελάτη της βάσης για να δει ένα νούμερο και η
// μηχανή αναζήτησης βρίσκει την τιμή στο HTML. Ο πίνακας `market_rates`
// διαβάζεται από τον ανώνυμο ρόλο (πολιτική `market_rates_read`) και η απάντηση
// κρατιέται μία ημέρα (`next.revalidate` του αιτήματος), όχι ανά επίσκεψη. Οι
// τιμές της ΕΚΤ είναι μηνιαίες, οπότε η ημέρα περισσεύει.
//
// ΟΤΑΝ Η ΒΑΣΗ ΔΕΝ ΑΠΑΝΤΑ, Η ΣΕΛΙΔΑ ΔΕΝ ΜΑΝΤΕΥΕΙ. Χωρίς ρυθμίσεις (τοπικό build),
// με σφάλμα δικτύου ή με απάντηση που δεν διαβάζεται, επιστρέφεται κενό και η
// σελίδα ζητά από τον επισκέπτη το επιτόκιο της προσφοράς του. Η αποτυχία
// γράφεται στο αρχείο καταγραφής: δεν μοιάζει με «δεν υπάρχει τιμή».
// ═══════════════════════════════════════════════════════════════════════════
import { cache } from 'react'
import { mortgageMarket, NO_MARKET, type MortgageMarket } from '@/lib/tools/stegastiko'
import type { Provenance } from '@/lib/market/ecb'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase/env'

/** Μία μέρα: όσο κρατά και η σελίδα. */
const DAY = 86400

/**
 * ΜΙΑ ΑΝΑΓΝΩΣΗ ΑΝΑ ΑΙΤΗΜΑ. Τη ζητούν η περιγραφή (`generateMetadata`) και η
 * σελίδα. Το `fetch` με `signal` δεν ενοποιείται αυτόματα από τον Next
 * (dedupe-fetch: «If we're passed a signal… opts out»), οπότε η `cache` του
 * React κρατά την απάντηση για το ίδιο αίτημα: δύο αναγνώσεις θα μπορούσαν να
 * δώσουν στην περιγραφή άλλο νούμερο από τη σελίδα.
 */
export const readMortgageMarket = cache(async (today: string): Promise<MortgageMarket> => {
  const base = SUPABASE_URL
  const key = SUPABASE_ANON_KEY
  if (!base || !key) return NO_MARKET
  try {
    const res = await fetch(
      `${base.replace(/\/+$/, '')}/rest/v1/market_rates?select=provenance&order=updated_at.desc&limit=1`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        next: { revalidate: DAY },
        signal: AbortSignal.timeout(5000),
      },
    )
    if (!res.ok) {
      console.error(`[stegastiko] τα επιτόκια αγοράς δεν διαβάστηκαν: HTTP ${res.status}`)
      return NO_MARKET
    }
    const rows = (await res.json()) as { provenance?: Provenance | null }[]
    return mortgageMarket(Array.isArray(rows) ? rows[0]?.provenance : null, today)
  } catch (e) {
    console.error('[stegastiko] τα επιτόκια αγοράς δεν διαβάστηκαν:', e)
    return NO_MARKET
  }
})
