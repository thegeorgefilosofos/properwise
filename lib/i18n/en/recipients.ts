// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΣΕΛΙΔΕΣ ΤΟΥ ΠΑΡΑΛΗΠΤΗ ΣΤΑ ΑΓΓΛΙΚΑ (πύλη, check-in, «Πλήρωσα», απεγγραφή,
// επιβεβαίωση διεύθυνσης, επαλήθευση, χωρίς σύνδεση)
// ─────────────────────────────────────────────────────────────────────────
// Ιδια διεύθυνση και στις δύο γλώσσες (lib/i18n/locale.ts, isRecipientPath).
// Μόνο το κείμενο της οθόνης: ό,τι γράφει ο ιδιοκτήτης (όνομα ακινήτου,
// διεύθυνση, τίτλος προθεσμίας) και ό,τι στέλνεται στη βάση μένει όπως είναι.
// ΜΟΝΟ ΚΕΙΜΕΝΟ, ΧΩΡΙΣ ΣΥΝΑΡΤΗΣΕΙΣ, στα λεξικά που φτάνουν στον περιηγητή. Το
// διαβάζει το layout κάθε σελίδας στον διακομιστή και το περνά ως τιμή στον
// πάροχο (app/RecipientCopy.tsx): ταξιδεύει μέσα στο ωφέλιμο φορτίο της
// αγγλικής απόκρισης και ΠΟΤΕ σε αρχείο JavaScript. ΜΕΤΡΗΜΕΝΟ (03.11.2026): με
// πάροχο κάτω από το app/en, όπως στους υπολογιστές, το λεξικό κατέβαινε ως
// δικό του αρχείο και στην ελληνική πύλη ενοικιαστή, γιατί η διαδρομή είναι
// μία. Τα «{n}» τα γεμίζει η σελίδα. Ορολογία: docs/i18n/GLOSSARY-EN.md.
//
// ΓΙΑ ΝΟΜΙΚΟ ΕΛΕΓΧΟ. Η ενημέρωση και η συναίνεση της φόρμας check-in, η
// ενημέρωση του άρθρου 14 GDPR στην επιβεβαίωση διεύθυνσης και το «τι δεν
// βεβαιώνει» της επαλήθευσης είναι πιστή απόδοση του ελληνικού, που μένει το
// δεσμευτικό. Θέλουν ματιά δικηγόρου πριν στηριχτεί κανείς στα αγγλικά.
// ═══════════════════════════════════════════════════════════════════════════
import { fmtFor } from '@/lib/core/format';
import { MONTHS_EN } from './dates';

const f = fmtFor('en');

/** Η φόρτωση ενός συνδέσμου (lib/portal/linkLoad.ts). */
export const LINK_EN = {
  notFoundTitle: 'This link wasn’t found or has expired',
  offlineTitle: 'The page didn’t load',
  offlineBody: 'We got no response just now, so we don’t know yet whether the link is valid. Try again in a moment.',
  retry: 'Try again',
  loading: 'Loading…',
  sending: 'Sending…',
  noServer: 'We couldn’t reach the server. Check your connection and try again.',
  poweredBy: 'Powered by PROPERWISE',
  privacy: 'Privacy',
  privacyPolicy: 'Privacy policy',
};

/** Η πύλη του ενοικιαστή (app/portal/[token]). */
export const PORTAL_EN = {
  title: 'Tenant portal',
  askOwner: 'Ask the owner for an updated portal link.',
  pinTitle: 'Code required',
  pinBody: 'Ask the owner for the code.',
  pinPlaceholder: 'Code',
  pinLabel: 'Portal code',
  pinChecking: 'Checking…',
  pinEnter: 'Enter',
  pinWrong: 'That code doesn’t match. Check it and try again.',
  pinRateLimited: 'Too many failed attempts. Try again in a few minutes.',
  // Τα κοινά μηνύματα εγγραφής (lib/portal/writes.ts, PORTAL_SAY).
  writePin: 'The portal code wasn’t accepted. The owner may have changed it: reload the page and enter the new one.',
  writeLocked: 'Too many failed code attempts. Try again in 15 minutes.',
  declareLimit: 'You’ve sent a lot of payment notices in the last hour. Try again later.',
  requestLimit: 'You’ve sent a lot of requests in the last hour. Try again later, or call the owner.',
  photoLimit: 'A lot of photos were uploaded in the last hour. Send the rest later.',
  declareFailed: 'We couldn’t send your payment notice. Try again.',
  requestFailed: 'We couldn’t send your request. Try again.',
  due: 'Amount due',
  nothingDue: 'Nothing outstanding',
  dueTotal: 'Total outstanding',
  dueBy: 'Due',
  declared: 'Notice sent, waiting for the owner to confirm',
  declare: 'I’ve paid',
  payMethod: 'How to pay',
  payNow: 'Pay now',
  payNowNote: 'You pay through the owner’s payment provider.',
  ibanNote: 'Pay by bank transfer to this IBAN, then let the owner know with “I’ve paid”.',
  copied: 'Copied',
  copy: 'Copy',
  rent: 'Monthly rent',
  leaseStart: 'Lease start',
  leaseEnd: 'Lease end',
  deposit: 'Deposit',
  property: 'Property',
  noLease: 'The lease details haven’t been filled in yet.',
  requestTitle: 'Send a request to the owner',
  requestSub: 'A repair, a question or anything else you need. The owner sees it right away.',
  sent: 'Request sent. Thank you.',
  photosLostOne: 'One photo didn’t upload.',
  photosLostMany: '{n} photos didn’t upload.',
  photosLostNetOne: 'One photo didn’t upload, probably because of the connection.',
  photosLostNetMany: '{n} photos didn’t upload, probably because of the connection.',
  photosResend: 'Send a second request with the photos when you have a better signal.',
  subject: 'Subject',
  subjectPlaceholder: 'Leak in the bathroom',
  description: 'Description',
  descriptionPlaceholder: 'Describe the problem…',
  phone: 'Phone (optional)',
  photos: 'Photos (optional)',
  addPhotos: 'Add photos',
  photosLabel: 'Photos of the problem',
  photoPreview: 'Photo preview',
  removePhoto: 'Remove photo',
  maxPhotos: 'You can add up to {n} photos.',
  imagesOnly: 'Only images can be added.',
  tooLarge: 'Some images are over 8 MB and were left out.',
  send: 'Send request',
  noAmount: 'Not given',
  noDate: 'No date',
  months: [...MONTHS_EN] as string[],
};

/** Τα στοιχεία διαμονής του επισκέπτη (app/checkin/[token]). */
export const CHECKIN_EN = {
  title: 'Guest details',
  askHost: 'Ask your host for an updated link.',
  welcome: 'Welcome. Fill in your details for a quick check-in.',
  sentTitle: 'Thank you. Your details have been sent to your host.',
  sentSub: 'Have a good trip and enjoy your stay.',
  formTitle: 'Your details',
  formSub: 'Your host needs them for the stay declaration required by law. They stay private: only your host sees them.',
  fullName: 'Full name *',
  fullNamePlaceholder: 'As on your ID card or passport',
  idNumber: 'ID card or passport number',
  nationality: 'Nationality',
  nationalityPlaceholder: 'British',
  birthDate: 'Date of birth',
  arrival: 'Arrival date',
  phone: 'Phone (optional)',
  email: 'Email (optional)',
  guests: 'Number of guests',
  consentBefore: 'My identity details are requested by the host because the law requires them for the stay declaration. If I gave a phone number or email, I agree to them being used only to contact me about this booking. I have read the ',
  consentLink: 'Privacy policy',
  consentAfter: '.',
  refused: 'We couldn’t submit your details. Check them and try again.',
  send: 'Send details',
  footnote: 'Your details are sent encrypted and only your host sees them. You can ask for them to be deleted at any time.',
};

/** Η σελίδα «Πλήρωσα» των υπενθυμίσεων (app/plirosa/[token]). */
export const PAY_EN = {
  expired: 'This link has expired',
  error: 'This didn’t load just now',
  invalid: 'This link isn’t valid',
  tryAgain: 'Try again in a moment. ',
  fromApp: 'You can also mark the payment from your property’s Calendar in the app.',
  ask: 'It will be marked as paid and its reminders will stop.',
  withExpense: 'Also record it in the property’s expenses, as ENFIA',
  duplicate: 'An expense is already recorded for this installment.',
  paid: 'I’ve paid',
  paidDone: (expense: boolean) => `${expense ? 'Marked as paid and recorded in the property’s expenses.' : 'Marked as paid.'} Its reminders stop.`,
  undo: 'Undo',
  undoWindow: (h: number) => `You can undo it from here for ${h} hours; after that, from the Calendar in the app.`,
  undone: (expense: boolean) => `The deadline is open again${expense ? ' and the expense was deleted' : ''}.`,
  used: 'This deadline is already marked as paid.',
  failed: 'That didn’t work just now. Try again in a moment, or mark it from the Calendar in the app.',
  money: (n: number) => f.fe(n),
};

/** Η απεγγραφή από τα ενημερωτικά email (app/unsubscribe/[token]). */
export const UNSUB_EN = {
  title: 'Unsubscribe from newsletters',
  notFound: 'This link isn’t valid or has expired. You can change your preferences under “Account” in the app.',
  error: 'We couldn’t read your preferences. The link wasn’t checked, so it may well be valid.',
  ifNot: ['If that doesn’t work, write to ', ' and we’ll unsubscribe you ourselves.'] as const,
  failed: 'The unsubscribe didn’t go through. Try again in a moment, or send us a message and we’ll remove you ourselves.',
  expired: 'This link is no longer valid. Use the link in the latest email, or “Account” in the app.',
  doneAll: 'You’ve unsubscribed from all newsletters.',
  doneProduct: 'You’ve unsubscribed from product news.',
  doneMarket: 'You’ve unsubscribed from market data.',
  choose: 'Choose what to unsubscribe from. Service emails (reminders, statements) aren’t affected.',
  product: 'Unsubscribe from product news',
  market: 'Unsubscribe from market data',
  all: 'Unsubscribe from everything',
  none: 'You’ve unsubscribed from all newsletters.',
};

/** Η επιβεβαίωση της διεύθυνσης υπενθυμίσεων (app/epivevaiosi-email/[token]). */
export const CONFIRM_EMAIL_EN = {
  title: 'Confirm your reminder address',
  metaTitle: 'Confirm address',
  metaDescription: 'Confirm the address for PROPERWISE reminders.',
  ask: 'Do you want to receive PROPERWISE reminders at this address?',
  whyBefore: 'A PROPERWISE user set this address to receive reminders. See the ',
  whyLink: 'Privacy policy',
  yes: 'Yes, confirm',
  notYou: 'If you didn’t ask for this, close the page. You won’t receive anything.',
  confirming: 'Confirming…',
  done: 'Address confirmed.',
  doneBody: 'From now on, reminders for bills, rent and calendar events will reach this address. To stop them, the address can be changed or removed from the account that set it.',
  invalid: 'This link isn’t valid, has expired or has already been used. A new confirmation can be sent from the account that set this address, under Notifications.',
  offline: 'We got no response, so the link wasn’t checked. It may be valid.',
};

/** Η επαλήθευση εγγράφου (app/verify, app/verify/[id]). */
export const VERIFY_EN = {
  title: 'Verify a document',
  metaDescription: 'Check that a document is registered with PROPERWISE, using its number.',
  metaDescriptionId: 'Check that a document is registered with PROPERWISE and hasn’t changed since it was issued.',
  printed: 'The code is printed next to the QR code on the document.',
  codeLabel: 'Document code',
  codeMissing: 'Enter the code exactly as it is printed on the document.',
  check: 'Check',
  checking: 'Checking the document…',
  notFound: 'No document found with this code',
  notFoundBody: ['The code ', ' doesn’t match any document registered with PROPERWISE. Check that the QR code was scanned correctly, or ask the issuer for a new copy.'] as const,
  error: 'The check didn’t complete',
  errorBody: ['We got no response for the code ', '. That says nothing about the document: we didn’t get to check it.'] as const,
  retry: 'Try again',
  absent: 'Not given',
  intact: 'Registered document, unchanged since it was issued',
  changed: 'The record doesn’t match its fingerprint',
  legacy: 'Registered document, older format',
  issuedOn: 'Issued through PROPERWISE on {date} by the issuer “{issuer}”, as they declared themselves. ',
  issuedNoDate: 'Issued through PROPERWISE by the issuer “{issuer}”, as they declared themselves. ',
  intactBody: 'The record hasn’t changed since then. Compare the fingerprint below with the one printed at the bottom of the document.',
  changedBody: 'The details in the record no longer match the fingerprint written when it was issued. Don’t rely on this document without confirmation from the issuer.',
  legacyBody: 'It was registered before the registry had a server-side fingerprint, so we can’t confirm it hasn’t changed since.',
  docType: 'Document type',
  subject: 'Subject',
  period: 'Period',
  issuedAt: 'Date issued',
  issuer: 'Issuer, as declared',
  number: 'Document number',
  fingerprint: 'Fingerprint',
  fine: 'The document’s content and the issuer’s name are the issuer’s own statements. PROPERWISE records the issue and doesn’t vouch for the accuracy of the details or the identity of the issuer. This page shows no amounts or sensitive details: if the paper you hold shows amounts, confirm them with the issuer.',
};

/** Η σελίδα χωρίς σύνδεση (app/offline). */
export const OFFLINE_EN = {
  metaTitle: 'Offline',
  metaDescription: 'There’s no internet connection. Try again when it’s back.',
  title: 'You’re offline',
  body: 'Your device can’t see the network right now. Your data is safe; as soon as the connection is back, everything shows up as normal.',
  retry: 'Try again',
};

/**
 * Ό,τι φτάνει στον περιηγητή, σε ένα αντικείμενο: το περνά το layout κάθε
 * σελίδας στον πάροχο (app/RecipientCopy.tsx). Μόνο κείμενο και πίνακες.
 */
export const RECIPIENT_COPY_EN = {
  link: LINK_EN, portal: PORTAL_EN, checkin: CHECKIN_EN,
  unsub: UNSUB_EN, confirm: CONFIRM_EMAIL_EN, verify: VERIFY_EN,
};
