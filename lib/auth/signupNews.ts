// ═══════════════════════════════════════════════════════════════════════════
// ΔΥΟ ΣΥΓΚΑΤΑΘΕΣΕΙΣ ΣΤΗΝ ΕΓΓΡΑΦΗ, ΜΙΑ ΓΙΑ ΚΑΘΕ ΣΚΟΠΟ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΕΥΡΗΜΑ (νομικός έλεγχος 09/11/2026, Π-5). Ενα κουτί, «νέα της εφαρμογής
// και της αγοράς ακινήτων», για δύο σκοπούς που η σελίδα απεγγραφής ήδη
// χωρίζει. Η συγκατάθεση πρέπει να είναι ειδική για κάθε σκοπό (άρθρα 4 σημ.
// 11 και 7 ΓΚΠΔ). Τώρα είναι δύο κουτιά, ατσεκάριστα και προαιρετικά.
//
// ΧΩΡΙΣ ΝΕΑ ΣΤΗΛΗ ΚΑΙ ΧΩΡΙΣ ΜΕΤΑΝΑΣΤΕΥΣΗ. Ο πίνακας `email_marketing_prefs`
// έχει ήδη τις δύο στήλες (`product_news`, `market_news`, προεπιλογή true).
// Ο trigger `marketing_prefs_from_signup` (20260925120000) τις κλείνει ΚΑΙ
// ΤΙΣ ΔΥΟ όταν η γραμμή δημιουργείται για χρήστη με `marketing_opt_out` στο
// προφίλ. Αυτό μένει η ασφαλής βάση:
//
//   · και τα δύο τσεκαρισμένα: καμία σημαία, οι προεπιλογές της βάσης ισχύουν
//     (ίδια συμπεριφορά με το παλιό τσεκαρισμένο κουτί).
//   · οτιδήποτε άλλο: `marketing_opt_out: true`, άρα όποιος κι αν δημιουργήσει
//     τη γραμμή τη δημιουργεί κλειστή. Κανένα μήνυμα χωρίς συγκατάθεση, ακόμη
//     κι αν το επόμενο βήμα αποτύχει.
//   · ένα από τα δύο: το επόμενο βήμα, με συνεδρία (επιβεβαίωση email ή
//     επιστροφή από τη Google), ανοίγει ΜΟΝΟ τη στήλη που τσεκαρίστηκε και
//     σημειώνει `consent_news_applied_at`, ώστε να μη γραφτεί ποτέ ξανά πάνω σε
//     απεγγραφή του χρήστη.
//
// Η ΕΠΙΛΟΓΗ ΜΕΝΕΙ ΚΑΙ ΣΤΟ ΠΡΟΦΙΛ (`consent_news_product`, `consent_news_market`) ως απόδειξη
// συγκατάθεσης (άρθρο 7§1 ΓΚΠΔ), δίπλα στο `consent_terms_accepted_at`.
// Οι παλιοί λογαριασμοί δεν έχουν αυτά τα πεδία και δεν αγγίζονται.
// ═══════════════════════════════════════════════════════════════════════════
import type { SupabaseClient } from '@supabase/supabase-js'

export interface NewsChoice { product: boolean; market: boolean }

export const NO_NEWS: NewsChoice = { product: false, market: false }

/** Η επιλογή στη διεύθυνση επιστροφής της Google: «0», «p», «m» ή «pm». */
export function newsParam(c: NewsChoice): string {
  return `${c.product ? 'p' : ''}${c.market ? 'm' : ''}` || '0'
}

/** Αγνωστη ή απούσα τιμή σημαίνει «όχι»: συγκατάθεση δεν τεκμαίρεται. */
export function newsFromParam(v: string | null): NewsChoice {
  return v === 'p' || v === 'm' || v === 'pm' ? { product: v.includes('p'), market: v.includes('m') } : NO_NEWS
}

/** Τα πεδία του προφίλ για την επιλογή. */
export function newsMeta(c: NewsChoice): Record<string, unknown> {
  return {
    consent_news_product: c.product,
    consent_news_market: c.market,
    ...(c.product && c.market ? {} : { marketing_opt_out: true }),
  }
}

/** Εχει ήδη αποφασίσει ο λογαριασμός για τα ενημερωτικά; Οι παλιοί λογαριασμοί κρατούν ό,τι είχαν. */
export function newsDecided(meta: Record<string, unknown>): boolean {
  return meta.marketing_opt_out !== undefined || typeof meta.consent_news_product === 'boolean'
}

/** Η επιλογή που δεν έχει ακόμη γραφτεί στις προτιμήσεις, ή `null`. */
export function pendingNews(meta: Record<string, unknown>): NewsChoice | null {
  if (meta.consent_news_applied_at) return null
  if (typeof meta.consent_news_product !== 'boolean' || typeof meta.consent_news_market !== 'boolean') return null
  const c = { product: meta.consent_news_product, market: meta.consent_news_market }
  // Και τα δύο: οι προεπιλογές της βάσης λένε ήδη το ίδιο.
  return c.product && c.market ? null : c
}

/**
 * Γράφει την επιλογή στις προτιμήσεις του ίδιου του χρήστη και σημειώνει ότι
 * γράφτηκε. Η πρώτη εγγραφή μπορεί να τη μηδενίσει ο trigger· η ενημέρωση που
 * ακολουθεί δεν περνά από αυτόν. Επιστρέφει το σφάλμα, ποτέ σιωπηλά.
 */
export async function applyNews(db: SupabaseClient, userId: string, c: NewsChoice): Promise<unknown> {
  const { error: upsertError } = await db.from('email_marketing_prefs')
    .upsert({ user_id: userId, product_news: c.product, market_news: c.market }, { onConflict: 'user_id' })
  if (upsertError) return upsertError
  if (c.product || c.market) {
    const { error: updateError } = await db.from('email_marketing_prefs')
      .update({ product_news: c.product, market_news: c.market }).eq('user_id', userId)
    if (updateError) return updateError
  }
  const { error: markError } = await db.auth.updateUser({ data: { consent_news_applied_at: new Date().toISOString() } })
  return markError ?? null
}
