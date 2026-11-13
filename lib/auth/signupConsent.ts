// Η ΑΠΟΔΕΙΞΗ ΣΥΓΚΑΤΑΘΕΣΗΣ ΤΗΣ ΕΓΓΡΑΦΗΣ, ΚΑΘΑΡΗ ΚΑΙ ΕΛΕΓΞΙΜΗ (13.11.2026).
//
// Η αποδοχή των Όρων δίνεται με το πάτημα του κουμπιού (email ή Google), με τη
// γραμμή ορατή δίπλα σε κάθε κουμπί. Ό,τι μένει στο προφίλ είναι ΠΟΤΕ και ΠΟΙΑ
// έκδοση. Τα δύο σημεία που το γράφουν ζουν εδώ, ώστε το
// lib/auth/signupConsent.test.ts να κοκκινίζει αν χαθεί κάποιο πεδίο.
import { POLICY_VERSION as CONSENT_VERSION } from '@/lib/legal/identity'
import { newsDecided, newsFromParam, newsMeta, type NewsChoice } from '@/lib/auth/signupNews'
import { planFromParam, cycleFromParam } from '@/lib/billing/entitlements'
import type { PlanId, BillingCycle } from '@/lib/billing/plans'

/** Η σφραγίδα: πότε και ποια έκδοση Όρων και Πολιτικής. */
export function consentStamp(now: Date = new Date()) {
  return { consent_terms_accepted_at: now.toISOString(), consent_policy_version: CONSENT_VERSION }
}

/** Τα `data` της `signUp` με email: η σφραγίδα, τα ενημερωτικά, πρόσκληση, πακέτο. */
export function signupData(o: {
  firm?: Record<string, unknown> | null
  news: NewsChoice
  refCode?: string
  plan?: PlanId | null
  cycle?: BillingCycle
}, now: Date = new Date()): Record<string, unknown> {
  return {
    ...(o.firm ?? {}),
    ...consentStamp(now),
    ...newsMeta(o.news),
    ...(o.refCode ? { referred_by: o.refCode } : {}),
    ...(o.plan ? { chosen_plan: o.plan, chosen_cycle: o.cycle } : {}),
  }
}

/**
 * Ό,τι λείπει από το προφίλ μετά την επιστροφή από την Google (`oauth=1`): η
 * απόδειξη συγκατάθεσης, η πρόσκληση και το πακέτο. Συμπληρώνει ΜΟΝΟ ό,τι
 * λείπει: η απόδειξη που μετράει είναι η ΠΡΩΤΗ, όχι η σημερινή.
 */
export function oauthPatch(meta: Record<string, unknown>, q: URLSearchParams, news: NewsChoice = newsFromParam(q.get('news')), now: Date = new Date()): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  // Η επιλογή των ενημερωτικών ταξιδεύει όπως το πακέτο, στη διεύθυνση
  // επιστροφής· γράφεται μόνο για λογαριασμό που δεν έχει ακόμη ούτε
  // συγκατάθεση ούτε απόφαση. Υπάρχων χρήστης κρατά τις προτιμήσεις του.
  if (!meta.consent_terms_accepted_at && !newsDecided(meta)) Object.assign(patch, newsMeta(news))
  if (!meta.consent_terms_accepted_at) Object.assign(patch, consentStamp(now))
  const r = q.get('ref'); if (r && !meta.referred_by) patch.referred_by = r
  const p = planFromParam(q.get('plan'))
  if (p && !meta.chosen_plan) { patch.chosen_plan = p; patch.chosen_cycle = cycleFromParam(q.get('cycle')) }
  return patch
}
