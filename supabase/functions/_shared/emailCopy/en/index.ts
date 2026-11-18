// ═══════════════════════════════════════════════════════════════════════════
// Ο ΑΓΓΛΙΚΟΣ ΚΑΤΑΛΟΓΟΣ: ΙΔΙΑ ΑΝΑΓΝΩΡΙΣΤΙΚΑ, ΙΔΙΑ ΓΕΓΟΝΟΤΑ
// ─────────────────────────────────────────────────────────────────────────
// Ενα δίδυμο ανά ελληνικό μήνυμα του emailCopy.ts. Ο έλεγχος
// emailCopyEn.test.ts κοκκινίζει όταν ένα αναγνωριστικό υπάρχει μόνο στη
// μία γλώσσα: νέο ελληνικό μήνυμα χωρίς αγγλικό δεν περνά. Οι αποστολείς
// διαλέγουν με `catalogFor(lang)`.
// ═══════════════════════════════════════════════════════════════════════════
import type { CopyFn } from '../kit.ts'
import { ONBOARDING } from './onboarding.ts'
import { ENGAGEMENT } from './engagement.ts'
import { UPSELL } from './upsell.ts'
import { SEASONAL } from './seasonal.ts'
import { REFERRAL } from './referral.ts'
import { LIFECYCLE } from './lifecycle.ts'
import { WINBACK } from './winback.ts'
import { OPERATIONS } from './operations.ts'
import { SHORTTERM } from './shortterm.ts'
import { PRODUCT } from './product.ts'
import { CONVERSION } from './conversion.ts'
import { COMPLIANCE } from './compliance.ts'
import { BILLING } from './billing.ts'
import { RELATIONSHIP } from './relationship.ts'
import { VALUE } from './value.ts'
import { NEWS } from './news.ts'

export { DIGESTS as DIGESTS_EN } from './digests.ts'

export const CATALOG_EN: Record<string, CopyFn> = {
  ...ONBOARDING, ...ENGAGEMENT, ...UPSELL, ...SEASONAL, ...REFERRAL, ...LIFECYCLE, ...WINBACK,
  ...OPERATIONS, ...SHORTTERM, ...PRODUCT, ...CONVERSION, ...COMPLIANCE, ...BILLING, ...RELATIONSHIP,
  ...VALUE, ...NEWS,
}
