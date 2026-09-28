// ═══════════════════════════════════════════════════════════════════════════
// emailCopy — Το ΠΕΡΙΕΧΟΜΕΝΟ (κείμενα) του email catalog, χωριστά από τη σχεδίαση.
//
// Κάθε καταχώρηση δέχεται το πλαίσιο του παραλήπτη (Personal: όνομα, πακέτο και
// μοναδικά δεδομένα του χρήστη) και επιστρέφει { subject, html } μέσα από το κοινό
// branded κέλυφος. Τα κείμενα μιλούν με τη φωνή του app: το tagline «Το ακίνητό
// σου, υπό έλεγχο.», τη δομή «εσύ …, το PROPERWISE κάνει τα υπόλοιπα», το CTA
// «Άνοιξε τον πίνακά σου», το «Ρώτα τη Νόα» και το «τα δεδομένα σου
// είναι δικά σου». Βαθιά εξατομικευμένα με ασφαλή fallback όταν λείπει δεδομένο.
//
// Γλώσσα: επιμελημένα ελληνικά, ζεστός αλλά επαγγελματικός τόνος, χωρίς παύλες,
// ουδέτερα ως προς το φύλο, με σωστούς εγκλιτικούς τόνους («το ακίνητό σου»).
// Δεκαέξι προγράμματα, 115 emails: 1) Onboarding 2) Engagement 3) Upsell
// 4) Εποχικά 5) Συστάσεις 6) Lifecycle/Νομικά/Συναλλαγές 7) Επανενεργοποίηση
// 8) Λειτουργικά ακινήτου 9) Βραχυχρόνια μίσθωση 10) Προϊόν & Εξέλιξη
// 11) Ενίσχυση μετατροπής 12) Συμμόρφωση 13) Συνδρομή & Χρέωση
// 14) Σχέσεις 15) Αξία & Εξοικονόμηση 16) Επικαιρότητα. Στρατηγική: docs/marketing/email-strategy.md.
// ═══════════════════════════════════════════════════════════════════════════
import type { CopyFn } from './emailCopy/kit.ts'
import { ONBOARDING } from './emailCopy/onboarding.ts'
import { ENGAGEMENT } from './emailCopy/engagement.ts'
import { UPSELL } from './emailCopy/upsell.ts'
import { SEASONAL } from './emailCopy/seasonal.ts'
import { REFERRAL } from './emailCopy/referral.ts'
import { LIFECYCLE } from './emailCopy/lifecycle.ts'
import { WINBACK } from './emailCopy/winback.ts'
import { OPERATIONS } from './emailCopy/operations.ts'
import { SHORTTERM } from './emailCopy/shortterm.ts'
import { PRODUCT } from './emailCopy/product.ts'
import { CONVERSION } from './emailCopy/conversion.ts'
import { COMPLIANCE } from './emailCopy/compliance.ts'
import { BILLING } from './emailCopy/billing.ts'
import { RELATIONSHIP } from './emailCopy/relationship.ts'
import { VALUE } from './emailCopy/value.ts'
import { NEWS } from './emailCopy/news.ts'

// Τα κείμενα ζουν ανά πρόγραμμα στον φάκελο emailCopy/· εδώ μένει το ευρετήριο
// που διαβάζουν οι συναρτήσεις (CATALOG, DIGESTS), στην ίδια διεύθυνση με πριν.
export { DIGESTS } from './emailCopy/digests.ts'

// ΕΝΙΑΙΟ ΕΥΡΕΤΗΡΙΟ: 116 μηνύματα, δεκαέξι προγράμματα.
//
// ΤΟ ΝΟΥΜΕΡΟ ΕΛΕΓΕ 106 ΚΑΙ ΗΤΑΝ 116. Δέκα μηνύματα προστέθηκαν χωρίς να αλλάξει
// το σχόλιο, δηλαδή το ίδιο το αρχείο έλεγε ψέματα για τον εαυτό του. Δεν είναι
// αθώο: όποιος διαβάζει «106» υποθέτει ότι τα ξέρει όλα. Το `npm run katalogos`
// γράφει το docs/KATALOGOS-MINYMATON.md από τον ΙΔΙΟ τον κώδικα και ο φύλακας
// message-catalog κοκκινίζει όταν τα δύο αποκλίνουν.
export const CATALOG: Record<string, CopyFn> = {
  ...ONBOARDING, ...ENGAGEMENT, ...UPSELL, ...SEASONAL, ...REFERRAL, ...LIFECYCLE, ...WINBACK,
  ...OPERATIONS, ...SHORTTERM, ...PRODUCT, ...CONVERSION, ...COMPLIANCE, ...BILLING, ...RELATIONSHIP,
  ...VALUE, ...NEWS,
}
