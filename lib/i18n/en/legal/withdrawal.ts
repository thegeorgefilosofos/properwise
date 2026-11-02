// ═══════════════════════════════════════════════════════════════════════════
// Η ΥΠΑΝΑΧΩΡΗΣΗ ΣΤΑ ΑΓΓΛΙΚΑ (app/ypanaxorisi, /en/withdrawal)
// ─────────────────────────────────────────────────────────────────────────
// Πιστή μετάφραση της σελίδας και της φόρμας, για διευκόλυνση· δεσμευτικό το
// ελληνικό (σημείωση στην κορυφή). Οι κανόνες μένουν στο lib/legal/withdrawal.ts:
// τα μηνύματα λάθους μεταφράζονται ΑΝΑ ΜΗΝΥΜΑ, με κλειδί το ίδιο το ελληνικό
// μήνυμα που επιστρέφει το `validateWithdrawal` για κάθε περίπτωση. Ετσι η
// αγγλική φόρμα δεν ξαναγράφει κανέναν κανόνα· αν αλλάξει κανόνας, αλλάζει
// και εδώ το μήνυμα που ταιριάζει.
// ═══════════════════════════════════════════════════════════════════════════
import { validateWithdrawal, WITHDRAWAL_DAYS } from '@/lib/legal/withdrawal';

const errOf = (raw: Parameters<typeof validateWithdrawal>[0]): string => {
  const r = validateWithdrawal(raw, new Date('2026-01-01T12:00:00Z'));
  return r.ok ? '' : r.error;
};
const OK = { name: 'Ab', email: 'a@b.cd', contract: 'Ab' };
const ERRORS_EN: Record<string, string> = {
  [errOf({ ...OK, name: '' })]: 'Enter your full name.',
  [errOf({ ...OK, name: 'x'.repeat(200) })]: 'The full name is too long.',
  [errOf({ ...OK, email: 'x' })]: 'Enter a valid email address: that is where you will receive the acknowledgement.',
  [errOf({ ...OK, contract: '' })]: 'Enter which contract this concerns, for example the plan or the receipt number.',
  [errOf({ ...OK, contract: 'x'.repeat(600) })]: 'The contract description is too long.',
  [errOf({ ...OK, purchaseDate: 'zz' })]: 'The purchase date can’t be read. Enter it as DD/MM/YYYY or leave it blank.',
  [errOf({ ...OK, purchaseDate: '01/01/2099' })]: 'The purchase date is in the future.',
};

export const WITHDRAWAL_EN = {
  error: (el: string): string => ERRORS_EN[el] ?? 'The declaration was not recorded. Try again or email us.',
  offline: 'There is no connection to the server. Try again or send the declaration by email.',
  confirm: 'Confirm withdrawal',
  done: 'Your declaration has been recorded.',
  reference: 'Reference',
  ackSent: 'We sent the acknowledgement to your email, with the same content, in Greek, the binding language. Keep it.',
  ackPending: 'The acknowledgement hasn’t gone out by email yet. The declaration is valid from the moment it was recorded; keep its reference and we will send it to you.',
  check: 'Check the declaration before you submit it',
  statement: 'Declaration', statementText: 'I withdraw from the contract.',
  name: 'Full name', email: 'Email for the acknowledgement', contract: 'Contract',
  purchaseDate: 'Date of purchase', notGiven: 'not given', lastDay: 'Last day of the withdrawal period',
  submitting: 'Submitting…', back: 'Back to edit',
  emailHintSignedIn: 'From your account. If you want the acknowledgement elsewhere, change it.',
  emailHintGuest: 'Preferably your account’s email, so that we can find the subscription right away.',
  whichContract: 'Which contract', contractPlaceholder: 'Plan or receipt number',
  dateOptional: 'Date of purchase (optional)', datePlaceholder: 'DD/MM/YYYY',
  website: 'Website', next: 'Continue',
};

export const WITHDRAWAL_PAGE_EN = {
  title: 'Withdraw from the contract',
  metaTitle: 'Withdraw from the contract · PROPERWISE',
  description: `Withdraw from your PROPERWISE contract within ${WITHDRAWAL_DAYS} days, with confirmation and an acknowledgement sent to your email.`,
  intro: (trade: string) => `From here you withdraw from your contract with ${trade}, whether or not you are signed in to your account.`,
  declaration: 'Your declaration',
  declarationLead: (confirm: string) => `Fill in or check the details and press “Continue”. In the next step you see the whole declaration and submit it with the “${confirm}” button. Nothing is sent before that.`,
  after: 'What happens next',
  afterItems: [
    'The declaration is recorded at the moment you confirm it, with date and time. That moment decides whether it is on time.',
    'You immediately receive by email an acknowledgement with the full content of the declaration and the date and time of submission.',
    'If you are signed in and have a subscription, we cancel it immediately so that it doesn’t renew. Without signing in, we find it from the details you entered.',
  ],
  forwardSeller: 'We forward the declaration to the seller of the subscription, who refunds the full amount by the same payment method.',
  forwardIfPaid: 'If you have paid for a subscription, we forward the declaration to its seller, who refunds the full amount by the same payment method.',
  deadline: 'The deadline and the money',
  deadlineText: `As a consumer you have ${WITHDRAWAL_DAYS} days from the conclusion of the contract to withdraw without giving a reason. The deadline is met if the declaration is submitted before it expires.`,
  late: 'The function also accepts the declaration after the deadline: the form doesn’t decide whether it is valid; we review it against the receipt.',
  other: 'Other ways',
  otherMail: 'You can also send the declaration to ',
  otherForm: 'The model withdrawal form is in the ',
  terms: 'Terms of use',
};
