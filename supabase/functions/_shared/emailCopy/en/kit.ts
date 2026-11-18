// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΚΟΙΝΑ ΤΩΝ ΑΓΓΛΙΚΩΝ ΚΕΙΜΕΝΩΝ ΤΟΥ ΚΑΤΑΛΟΓΟΥ
// ─────────────────────────────────────────────────────────────────────────
// Κάθε αγγλικό μήνυμα είναι δίδυμο του ελληνικού με το ίδιο αναγνωριστικό
// (emailCopy/<πρόγραμμα>.ts): ίδια γεγονότα, ίδιοι αριθμοί από τον κώδικα,
// ποσά και ημερομηνίες σε ελληνική μορφή. Οι φράσεις χρέωσης είναι ΑΚΡΙΒΩΣ οι
// αγγλικές του lib/legal/billingWords.ts (το Deno δεν φτάνει εκεί· τις
// συγκρίνει ο έλεγχος emailCopyEn.test.ts). Η Νόα λέγεται με το όνομά της.
// ═══════════════════════════════════════════════════════════════════════════
import { emailShell, greeting, p } from '../../emailTemplates.ts'
import { pctRate } from '../../format.ts'

/** Το κέλυφος, στα αγγλικά. */
export const shell = (o: Parameters<typeof emailShell>[0]): string => emailShell({ ...o, lang: 'en' })
/** «Hi Maria,» */
export const hi = (c: { name?: string }): string => greeting(c.name, 'en')
/** «1 property», «3 properties». Αριθμός με ελληνική γραφή, όπως παντού. */
export const plural = (n: number, one: string, many: string) => `${n.toLocaleString('el-GR')} ${n === 1 ? one : many}`

/** «20%», «12,5%»: το ποσοστό με τον μορφοποιητή, όπως στα ελληνικά. */
export const percent = (n: number): string => pctRate(n)

/** Τα ονόματα των πακέτων, όπως στο lib/i18n/en/plans.ts (το ελέγχει ο έλεγχος). */
export const PACKAGE_NAME_EN = {
  solo: 'Owner with Noa', owner: 'Owner+', agency: 'Professional', office: 'Professional+',
} as const
/** Το πακέτο χωρίς συνδρομή. */
export const FREE_PLAN_EN = 'Owner'

/** Το όνομα του πακέτου αν το πεδίο κρατά ΠΑΚΕΤΟ· τύπος προφίλ δεν αρκεί. */
export const packageNameEn = (v: unknown): string => {
  const k = String(v ?? '')
  return k in PACKAGE_NAME_EN ? PACKAGE_NAME_EN[k as keyof typeof PACKAGE_NAME_EN] : ''
}

export const NOTE = {
  reply: 'Reply to this message. We read it.',
  dataOwn: 'Your data is yours.',
  ahead: 'A minute now saves you running around later.',
  official: 'Every document carries a number and a QR verification code.',
  autolog: 'This was recorded automatically. You don’t need to do anything.',
  aade: 'For information, from official sources. Confirm with your accountant or on myAADE, the tax authority’s portal.',
  /** = CANCEL_ANYTIME_EN του lib/legal/billingWords.ts. */
  cancel: 'Cancel whenever you like.',
  legal: 'For information. For how it applies to you, confirm with your accountant or legal adviser.',
}

export const codeLine = (o: { code: string }) => p(`Enter the code <b>${o.code}</b> at checkout and the discount is applied to the charge.`)

/** Η σημείωση για ό,τι πηγαίνει στην ΑΑΔΕ ή στον λογιστή: μένει στα ελληνικά. */
export const GREEK_DOCS = 'Documents for AADE (the Greek tax authority) and for your accountant stay in Greek, as the authorities require.'
