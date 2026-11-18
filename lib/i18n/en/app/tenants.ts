// ═══════════════════════════════════════════════════════════════════════════
// Ο ΕΝΟΙΚΙΑΣΤΗΣ ΚΑΙ ΤΟ ΕΝΟΙΚΙΟ ΣΤΑ ΑΓΓΛΙΚΑ (φάση 4α)
// ─────────────────────────────────────────────────────────────────────────
// TabTenant (λίστα, σύνοψη, ντοσιέ, φόρμα), η είσπραξη (PaymentsView), η
// εγγύηση (DepositView), η επισκόπηση του ντοσιέ (DashboardView), το παράθυρο
// «Είσπραξη ενοικίου» της Επισκόπησης (RentReceived) και τα κοινά κομμάτια
// της καρτέλας. Οροι από το docs/i18n/GLOSSARY-EN.md §4.2.
//
// ΤΙ ΜΕΝΕΙ ΕΛΛΗΝΙΚΟ, ΕΠΙΤΗΔΕΣ. Ό,τι γράφεται στη βάση (τρόπος πληρωμής,
// τρόπος εγγύησης, τύπος εγγράφου, τίτλοι εγγράφων στο Αρχείο), ό,τι φεύγει
// προς τον ενοικιαστή (μηνύματα, απόδειξη, μηνιαία κατάσταση) και οι εξαγωγές
// Excel για τον λογιστή. Η οθόνη το λέει στα αγγλικά δίπλα στο κουμπί.
//
// Οι τιμές που γράφονται στη βάση στα ελληνικά (PAY_METHODS, ID_DOCS) έχουν
// εδώ ΠΙΝΑΚΑ ΜΕ ΤΗΝ ΙΔΙΑ ΣΕΙΡΑ, όχι χάρτη με ελληνικά κλειδιά: το αρχείο δεν
// επιτρέπεται να έχει ελληνικό γράμμα (scripts/guard-en-copy.mjs).
//
// Ποσά και ημερομηνίες με τους ίδιους μορφοποιητές με τα ελληνικά
// (lib/i18n/en/app/format.ts): «1.234,50€», «02/11/2026». Ποσοστά και
// ημερομηνίες έναρξης μέτρων από τις σταθερές τους, ποτέ με το χέρι.
// ═══════════════════════════════════════════════════════════════════════════
import { APP_FMT } from '@/lib/i18n/en/app/format';
import { MONTHS_EN } from '@/lib/i18n/en/dates';
import { lawEn, firstArticleEn } from '@/lib/i18n/en/guides/cite';
import { FIRST_MONTH_BANK_RECEIPT, FIRST_YEAR_BANK_RECEIPT } from '@/lib/billing/greekTax';
import { PRESUMPTIVE_DEDUCTION_RATE } from '@/lib/billing/presumptive';
import { COMMERCIAL_STAMP_DUTY } from '@/lib/billing/commercialLease';
import { PEA_LAW } from '@/lib/property/peaExpiry';
import { grDateOf } from '@/lib/core/format';

const f = APP_FMT;
const count = (n: number, one: string, many: string) => `${f.fn(n)} ${n === 1 ? one : many}`;
const days = (n: number) => count(n, 'day', 'days');
const ord = (n: number) => {
  const t = n % 100;
  const s = t >= 11 && t <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th';
  return `${n}${s}`;
};
const BANK_FROM = grDateOf(FIRST_YEAR_BANK_RECEIPT, FIRST_MONTH_BANK_RECEIPT);
const DEDUCTION = f.fpRate(PRESUMPTIVE_DEDUCTION_RATE * 100);
const PEA_REF = `${lawEn(PEA_LAW)}, ${firstArticleEn(PEA_LAW.split(',')[1] ?? '')}`;

/** Ενα παράθυρο επιβεβαίωσης στα αγγλικά (components/confirmBus.ts): τίτλος και κουμπιά, όχι οι ελληνικές προεπιλογές. */
const ask = (message: string, confirmLabel = 'Confirm', negative = false) => ({
  title: 'Confirm', message, confirmLabel, cancelLabel: 'Cancel',
  tone: (negative ? 'negative' : 'neutral') as 'negative' | 'neutral',
});

/** Τα πεδία του μητρώου (lib/property/fields.ts): όνομα και «γιατί το ζητάμε». */
const FIELDS: Record<string, readonly [string, string]> = {
  'tenant.full_name': ['Full name', 'It goes on the lease and on form E2.'],
  'tenant.afm': ['Tax number (AFM)', 'Form E2, the schedule of property income, asks for the tenant’s tax number. Without it the return can’t be completed.'],
  'tenant.phone': ['Phone', 'So you can reach them when you need to.'],
  'tenant.email': ['Email', 'So you can send them receipts and messages from the app yourself. The app never sends them anything on its own.'],
  'tenant.id_doc': ['ID document', 'The ID card or passport number goes on the lease. Without it the lease doesn’t identify the tenant.'],
  'tenant.iban': ['Tenant’s IBAN', 'So you can return the deposit without having to track them down after they move out.'],
  'tenant.profession': ['Occupation', 'For your own picture of the tenant. It goes on no return and nobody else sees it.'],
  'tenant.lease_category': ['Type of lease', `A commercial lease owes the Digital Transaction Duty of ${f.fpRate(COMMERCIAL_STAMP_DUTY * 100)} on the rent. A residential lease doesn’t.`],
  'tenant.lease_type': ['Length', 'The end date follows from the length. A residential lease is protected for at least three years, even if you agree on less.'],
  'tenant.lease_start': ['Lease start', 'This sets the deadline for declaring the lease on myAADE, AADE’s online portal: by the end of the month after the start.'],
  'tenant.aade_lease_decl_ref': ['Lease declaration number', 'AADE gives it to you when you file the lease declaration, and it goes in column 19 of form E2.'],
  'tenant.lease_end': ['Lease end', 'So we can remind you before it ends, not after.'],
  'tenant.rent': ['Monthly rent', 'The basis for form E2 and for the tax.'],
  'tenant.rent_iban': ['IBAN for rent', `From ${BANK_FROM} (Law 5222/2025), collecting rent through a bank decides whether you get the ${DEDUCTION} standard deduction.`],
  'tenant.rent_due_day': ['Payment day', 'It sets when an installment becomes overdue. Without it, the word “late” means nothing.'],
  'tenant.payment_frequency': ['How often rent is paid', 'Installments are created at this pace. Almost always monthly.'],
  'tenant.deposit': ['Deposit', 'It isn’t your income: you give it back. We keep it separate so it stays out of the tax.'],
  'tenant.deposit_method': ['How the deposit was paid', 'A cash deposit leaves no trace: in a dispute at move-out you can’t prove it was paid.'],
  'tenant.deposit_paid_on': ['Paid on', 'Together with the method, this is your proof that the amount came in and when.'],
  'tenant.deposit_returned': ['Deposit returned', 'Until it is returned, it is money you hold for someone else, shown separately in the totals.'],
  'tenant.furnishing': ['Furnishing', 'It decides whether there are any services or an equipment inventory. For an unfurnished home we ask for none of that.'],
  'tenant.services': ['What you pay and what the tenant pays', 'It settles disagreements before they start. Open lines: description, cost, who pays.'],
  'tenant.parking': ['Parking', 'If it is charged separately, the amount is added to the monthly installment and to your gross rent.'],
  'tenant.extra_perks': ['Extras', 'Storage room, garden, shared washing machine: whatever was agreed and doesn’t show in the amount.'],
  'tenant.lease_doc': ['Lease and other documents', 'Without the paper, the file for your accountant is incomplete and you end up searching for it in June.'],
  'tenant.notes': ['Notes', 'Anything you want to remember about this lease. It appears on no document.'],
};

export const TENANTS_EN = {
  fields: FIELDS,
  /** Οι τιμές που μένουν ελληνικές στη βάση, με την ίδια σειρά (PAY_METHODS, DEPOSIT_METHODS). */
  payMethods: ['Cash', 'Bank transfer', 'Electronic payment', 'Card'] as readonly string[],
  /** ID_DOCS, με την ίδια σειρά. */
  idDocs: ['Police ID card', 'Passport', 'Military ID card', 'Student pass', 'Other'] as readonly string[],
  furnishing: { empty: 'Unfurnished', furnished: 'Furnished', turnkey: 'Turnkey (everything included)' } as Record<string, string>,
  leaseTypes: { monthly: 'Monthly', biannual: 'Six months', annual: 'One year', '18months': '18 months', '24months': '24 months', '36months': '36 months', custom: 'Custom' } as Record<string, string>,
  leaseCategories: { residential: 'Residential', commercial: 'Commercial' } as Record<string, string>,
  frequencies: { monthly: 'Monthly', bimonthly: 'Every two months', quarterly: 'Quarterly' } as Record<string, string>,
  /** Ποιος πληρώνει μια υπηρεσία (ServiceBySelect). */
  payer: { owner: 'Owner', tenant: 'Tenant', split: 'Half and half' } as Record<string, string>,
  status: { paid: 'Paid', overdue: 'Overdue', pending: 'Pending' } as Record<string, string>,
  month: (i0: number) => MONTHS_EN[i0] ?? '',
  monthShort: (i0: number) => (MONTHS_EN[i0] ?? '').slice(0, 3),
  noDate: 'No date',
  notSet: 'Not set',
  choose: 'Choose…',
  days,
  ask,
  closeError: 'Close error message',
  /** «Τι δεν έγινε» για τα σφάλματα της βάσης· ο λόγος από το `errors` (lib/i18n/en/app/errors.ts). */
  err: {
    depositNotRecorded: 'The deposit return wasn’t recorded',
    docNotFiled: 'The document wasn’t filed',
    docsNotLinked: 'The documents weren’t linked to the tenant',
    fileNotUploaded: 'The file wasn’t uploaded',
    installmentsNotCreated: 'The installments weren’t created',
    installmentsNotUpdated: 'The installments weren’t updated',
    leaseNotLinked: 'The lease was uploaded but wasn’t linked to the tenant',
    leaseNotUnlinked: 'The lease wasn’t removed',
    moveOutNotRecorded: 'The move-out wasn’t recorded',
    paymentNotDeleted: 'The payment wasn’t deleted',
    paymentNotRecorded: 'The payment wasn’t recorded',
    receiptNotRecorded: 'The payment wasn’t recorded',
    undoNotSaved: 'The undo wasn’t saved',
  } as Record<string, string>,

  // ── Η καρτέλα: τίτλος, λίστα, κάρτες ────────────────────────────────────
  sub: 'Current and past leases, with each tenant’s file',
  more: 'More',
  menu: {
    lease: ['Draft a lease', 'A private agreement, signed by both sides.'],
    decl: ['Lease declaration', 'The fields of the declaration to AADE, the Greek tax authority, checked and ready to copy.'],
    xlsx: ['Export to Excel', 'All tenants in a spreadsheet. The file is in Greek, as your accountant needs it.'],
  } as Record<string, readonly [string, string]>,
  newTenant: 'New tenant',
  searchLabel: 'Search tenants',
  searchHint: 'Name, tax number or phone',
  segLabel: 'Which tenants are shown',
  segs: { all: 'All', current: 'Current', past: 'Past' } as Record<string, string>,
  empty: ['No tenants yet', 'Add the tenant of this property to follow the lease, rent, deposit, damages and renewal in one place.'],
  noMatch: ['No tenants found', 'Change the filter or the search.'],
  openCard: (name: string) => `Open file: ${name}`,
  period: (from: string, to: string) => `${from} to ${to}`,
  noPeriod: 'no lease period',
  afm: (afm: string) => `AFM ${afm}`,
  badge: { overdue: 'Overdue', past: 'Past', ended: 'Ended', current: 'Current', declared: 'Payment reported' },
  actionsFor: (name: string) => `Actions for ${name}`,
  deleteTenant: 'Delete tenant',
  strip: { rent: 'Rent', deposit: 'Deposit', overdue: 'Overdue' },
  pendingRent: (amount: string, from: string) => `Rent goes to ${amount} from ${from}`,
  endsIn: (d: number) => `Lease ends in ${days(d)}`,
  history: ['Tenant history', 'Monthly rent for each lease'],

  // ── Η σύνοψη ────────────────────────────────────────────────────────────
  summary: {
    aria: 'Lease summary',
    rent: 'Monthly rent',
    leases: (n: number) => count(n, 'active lease', 'active leases'),
    overdue: 'Overdue',
    installments: (n: number) => count(n, 'installment', 'installments'),
    nothingOwed: 'nothing owed',
    deposits: 'Deposits held',
    past: 'Past tenants',
  },

  // ── Το ντοσιέ ───────────────────────────────────────────────────────────
  dossier: {
    aria: (name: string) => `Tenant file: ${name}`,
    edit: 'Edit',
    handover: 'Handover report',
    movedOut: 'Moved out',
    tabs: { overview: 'Overview', lease: 'Lease and deposit', condition: 'Damage and repairs', legal: 'Legal and tax', comm: 'Communication', docs: 'Documents' } as Record<string, string>,
    pastNote: (moveOut: string | null) => `Past tenant${moveOut ? `: moved out ${moveOut}` : ''}. The file is kept for the property’s history.`,
    dueDay: (day: number) => [`You expect the rent on the `, `${ord(day)}`, ` of each month. Monthly installments are created automatically from the lease start.`] as const,
    leasePdf: 'Lease (PDF)',
    uploaded: 'Uploaded lease',
    remove: 'Delete',
    openPdf: 'Open PDF',
    uploading: 'Uploading…',
    replacePdf: 'Replace PDF',
    uploadHint: 'Upload the lease as a PDF',
    pickPdf: 'Choose PDF',
    external: 'External link',
    openLink: 'Open link',
    noExternal: 'No external link yet. Add one from “Edit”, under “Documents” (Google Drive, Dropbox and so on).',
  },

  // ── Μηνύματα της καρτέλας ───────────────────────────────────────────────
  toast: {
    closeUnsaved: 'Close without saving? The details you entered will be lost.',
    docNeedsDpa: 'The document wasn’t uploaded: you need to accept the data processing agreement first.',
    docUploaded: 'Document uploaded',
    docFailed: 'The document wasn’t uploaded. Try again.',
    declRef: (err: string) => `Lease declaration number: ${err}`,
    saveNeedsDpa: 'The details weren’t saved: you need to accept the data processing agreement first.',
    ourSchema: (msg: string) => `Saving failed because of an error on our side, not something you did. What you entered is still on the screen. Technical detail: ${msg}`,
    ourRls: (msg: string) => `Saving failed because of a permissions error on our side. What you entered is still on the screen. Technical detail: ${msg}`,
    saveFailed: (msg: string) => `Saving failed: ${msg}`,
    unknown: 'Unknown error',
    noInstallments: (err: string) => `The tenant was saved, but the rent installments weren’t created. ${err}`,
    saved: 'Saved',
    added: 'Tenant added',
    moveOut: (name: string) => `Mark “${name}” as moved out? They move to past tenants.`,
    movedOut: 'The tenant moved to the history',
    del: (name: string) => `Delete “${name}” for good? Their payments, which count toward income, their damages and the uploaded lease are deleted with them.`,
    delLabel: 'Delete for good',
    deleted: 'Tenant deleted',
    notDeleted: 'The tenant wasn’t deleted',
    nothingDeleted: 'Nothing was deleted.',
    filesLeft: 'The tenant was deleted, but the lease wasn’t removed from the files',
    pdfUploaded: 'PDF uploaded',
    pdfNotOpened: 'The PDF didn’t open. Try again.',
    pdfDeleted: 'PDF deleted',
    purge: {
      tenant_not_found: 'The tenant wasn’t found. Maybe it was already deleted or you don’t have access to it. Nothing was deleted.',
      tenant_not_deletable: 'You don’t have permission to delete this tenant. Nothing was deleted.',
      payments_not_deletable: 'You don’t have permission to delete this tenant’s payments, so nothing was deleted. Ask the account owner to delete it.',
      damages_not_deletable: 'You don’t have permission to delete this tenant’s damage records, so nothing was deleted. Ask the account owner to delete it.',
    } as Record<string, string>,
  },

  // ── Η φόρμα ─────────────────────────────────────────────────────────────
  form: {
    edit: 'Edit tenant',
    add: 'New tenant',
    sub: 'We ask only for what matters for this lease. Each field says why.',
    cancel: 'Cancel',
    saving: 'Saving…',
    saveChanges: 'Save changes',
    addTenant: 'Add tenant',
    who: 'Who the tenant is',
    lease: 'The lease',
    duration: 'Length',
    dayUnit: (n: number) => (n === 1 ? 'day' : 'days'),
    rentTitle: 'The rent',
    dueDay: (day: number) => ord(day),
    viaBank: 'Through a bank',
    pending: (amount: string, from: string) => `A rent change to ${amount} from ${from} is pending, from a signed notice. Changing the rent here cancels it.`,
    cash: (rate: string) => `Collecting in cash loses the ${rate} standard deduction, and the tax is worked out on 100% of the gross rent.`,
    oldServices: (n: number) => `You have ${count(n, 'service line', 'service lines')} from an earlier setup. They don’t show for an unfurnished home but are kept; change the furnishing to “Furnished” to see them.`,
    externalLink: 'External link',
    signedLease: 'Signed lease',
    signedLeaseHint: 'PDF or image, stored with the property’s documents',
    moreFields: 'More fields',
    moreLabel: 'More',
    optional: (n: number) => (n === 1 ? 'optional field' : 'optional fields'),
    professionHint: 'Engineer',
    idDocType: 'Document type',
    idDocNumber: 'Document number',
    idScan: 'Scanned ID card or passport',
    idScanHint: 'PDF or image',
    returnDate: 'Return date',
    parkingIncluded: 'Included in the rent',
    parkingExtra: 'Charged separately',
    parkingPrice: 'Monthly price',
    perksHint: 'Storage room, garden…',
    errors: { full_name: 'The full name is required', lease_category: 'The type of lease (residential or commercial) is required' } as Record<string, string>,
  },

  /** Ο επεξεργαστής υπηρεσιών (ServicesEditor). */
  services: {
    intro: 'One line for each recurring cost you agreed on: cleaning, boiler service, TV subscription, internet. Whatever is charged to the tenant is added to the monthly installment automatically.',
    desc: 'Description',
    descHint: 'Boiler service',
    cost: 'Cost per month',
    who: 'Who pays',
    removeTitle: 'Remove line',
    remove: 'Remove',
    add: 'Add line',
    you: 'You pay / month',
    tenant: 'Tenant pays / month',
  },

  /** Η ειδοποίηση ΠΕΑ σε νέα μίσθωση (lib/property/peaExpiry.ts, leasePeaNotice). */
  pea: {
    title: 'A valid energy performance certificate (PEA) is needed',
    why: `For a new lease the PEA is shown and handed to the tenant, and its number goes on the lease declaration (${PEA_REF}).`,
    missing: 'We have no PEA expiry date on file for this property.',
    missingAction: 'If you already have one, add its number and expiry date in the property details or scan the certificate.',
    expiresBefore: (date: string) => `The PEA we have on file expires on ${date}, before the lease starts.`,
    expired: (date: string) => `The PEA we have on file expired on ${date}.`,
    expiredAction: 'If you already have a newer one, add the new expiry date in the property details or scan the certificate.',
    ref: 'For reference: ',
    registry: 'Building Inspection Registry (buildingcert.gr)',
  },

  // ── Κοινά κομμάτια (TabTenantParts) ─────────────────────────────────────
  missing: (n: number) => `${count(n, 'detail is', 'details are')} missing for the tax return:`,
  file: { uploading: 'Uploading…', pick: 'Choose file' },
  bars: {
    ontime: 'On time', late: 'Late', unpaid: 'Unpaid', paid: 'Paid',
    late_by: (n: number) => ` (late by ${days(n)})`,
    empty: ['No payments yet', 'Once the first payment is recorded, the 12-month chart fills in by itself.'],
  },
  alerts: {
    ended: 'The lease has ended: renew it or start the move-out',
    endsSoon: (d: number) => `The lease ends ${d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${days(d)}`}`,
    endsTalk: (d: number) => `The lease ends in ${days(d)}: start the renewal conversation`,
    ends: (d: number) => `The lease ends in ${days(d)}`,
    unpaid: (n: number) => `${f.fn(n)} unpaid rents`,
  },

  // ── Η επισκόπηση του ντοσιέ (DashboardView) ─────────────────────────────
  dash: {
    base: 'Base rent',
    total: 'Monthly total',
    ownerCosts: 'Owner costs',
    leaseEnd: 'Lease end',
    ended: 'Ended',
    open: 'Amounts owed',
    deposit: 'Deposit',
    howPays: 'How they pay',
    none: 'No installment has been recorded yet. Once the first payment is recorded, you’ll see here how many installments were paid and how late.',
    paidOf: (paid: number, all: number) => `${f.fn(paid)} of ${f.fn(all)}`,
    paidTail: ' installments paid',
    lateCount: ' late, average delay ',
    daysTail: ' days',
    noLate: 'never late',
    owes: 'owed ',
    history: 'Payment history, last 12 months',
    payments: 'Payments',
    rate: 'Paid in full',
    avgLate: 'Average delay',
    avgDays: (n: string) => `${n} days`,
    noDelay: 'None',
    received: 'Total received',
    analysis: 'Tenant finances',
    grossYear: 'Gross rent per year',
    costsYear: 'Owner costs per year',
    netYear: 'Net income per year',
    openTotal: 'Total owed',
  },

  // ── Η είσπραξη (PaymentsView) ───────────────────────────────────────────
  pay: {
    received: 'Received',
    overdue: 'Overdue',
    installments: (n: number) => count(n, 'installment', 'installments'),
    pending: 'Pending',
    count: 'Installments',
    title: 'Rent ledger',
    dueDay: 'Due day',
    scan: 'Scan a receipt',
    export: 'Export to Excel',
    exportTitle: 'Export to Excel (.xlsx), in Greek',
    generate: 'Create installments',
    close: 'Close',
    add: '+ Record',
    greekNote: 'Receipts, statements, messages to the tenant and the Excel file are in Greek, as the tenant and your accountant need them.',
    missing: (n: number) => `${count(n, 'monthly installment is', 'monthly installments are')} missing according to the lease. Press “Create installments” to fill them in automatically.`,
    declared: (n: number) => `${count(n, 'payment', 'payments')} reported by the tenant`,
    declaredBody: 'The tenant reported a payment through the tenant portal. Confirm you received it to record it as paid.',
    confirmReceipt: 'Confirm receipt',
    stale: (n: number, target: string, split: string) => `${count(n, 'pending installment doesn’t', 'pending installments don’t')} match the current amount (${target}${split}).`,
    split: (rent: string, services: string) => `: rent ${rent} + services ${services}`,
    updatePending: 'Update pending',
    month: 'Month',
    year: 'Year',
    amount: 'Amount',
    method: 'Payment method',
    paid: 'Paid',
    paidDate: 'Payment date',
    note: 'Note',
    optional: 'optional',
    cancel: 'Cancel',
    saving: 'Saving…',
    record: 'Record',
    empty: 'No installments yet',
    emptyReady: 'Press “Create installments” to fill them in from the lease.',
    emptyNeeds: 'Set the lease start and the monthly rent to create installments automatically.',
    cols: ['Period', 'Amount', 'Status', 'Method', 'Payment date', 'Due', 'Actions'] as readonly string[],
    rentPlus: (rent: string, services: string) => `rent ${rent} + services ${services}`,
    reportedByTenant: 'Reported by the tenant',
    markPaid: 'Paid',
    undo: 'Undo',
    request: 'Payment request',
    statement: 'Statement',
    receipt: 'Receipt',
    email: 'Email',
    del: 'Delete',
    delAsk: 'Delete this payment?',
    markTitle: 'Mark as paid',
    receiptLink: 'Receipt link (optional)',
    reqSub: (rent: string, services: string) => ` (rent ${rent} + services ${services})`,
    markSettled: 'Mark as paid',
    qrAlt: 'Payment QR code',
    qrHint: 'Scan with a banking app (SEPA/IRIS) to pre-fill the transfer.',
    iban: 'IBAN for payment',
    copied: 'Copied',
    copy: 'Copy',
    copyFail: 'The copy didn’t work. Select the IBAN and copy it by hand.',
    noIban: 'Add an IBAN for payment in the tenant’s details to create a QR code and pre-fill the transfer.',
    share: 'Share the request (in Greek)',
    copyText: 'Copy text',
    textCopied: 'Text copied',
    textCopyFail: 'The copy didn’t work. Select the text and copy it by hand.',
    scanTitle: 'Scan a receipt',
    analysing: 'Reading the document…',
    paymentReceipt: 'Payment receipt',
    docType: (t: string) => `Type: ${t}`,
    notReceipt: 'The document wasn’t recognized as a payment receipt. Choose an installment yourself before marking it.',
    noOpen: 'No open installment to match. The payment will be recorded as a new entry.',
    match: 'Match to installment',
    tooBig: (mb: number) => `The file is larger than ${mb} MB. Try a smaller photo.`,
    unreadable: 'This file can’t be read. Upload a photo (JPG, PNG) or a PDF.',
    scanFailed: 'The scan didn’t finish. Try again.',
    unclear: 'The document couldn’t be read. Try a clearer photo.',
    slow: 'The scan took too long. Check your connection and try again.',
    created: (n: number) => `Created ${count(n, 'installment', 'installments')}`,
    upToDate: 'The installments are up to date',
    synced: 'The pending installments were updated',
    markedPaid: 'Recorded as paid',
    fillAmount: 'Enter an amount',
    recorded: 'The payment was recorded',
  },

  // ── Η εγγύηση (DepositView) ─────────────────────────────────────────────
  deposit: {
    title: 'Deposit details',
    amount: 'Deposit amount',
    method: 'Paid by',
    paidOn: 'Paid on',
    status: 'Status',
    returned: 'Returned',
    held: 'Held',
    returnDate: 'Return date',
    markReturned: 'Mark as returned',
    notIncome: 'The deposit isn’t your income: it isn’t part of your gross rent and isn’t taxed. You hold it and give it back.',
    whenTitle: 'When and on what terms it is returned',
    when: ['The deposit is returned when the lease ends ', ', based on the move-out date', ' (no end or move-out date set)', ', after ', 'checking for damage', ' and ', 'settling anything still owed', '.'] as readonly string[],
    heldRow: 'Deposit held',
    unpaid: 'Unpaid rent',
    damages: 'Chargeable damage',
    net: 'Net to return (estimate)',
    netNote: 'An estimate based on unpaid rent and the damage you marked as chargeable to the tenant. The final settlement happens at handover.',
  },

  // ── «Είσπραξη ενοικίου» από την Επισκόπηση (RentReceived) ────────────────
  received: {
    title: (n: number) => (n === 1 ? 'Rent received' : 'Rents received'),
    footer: (tab: string) => `Record a partial payment or a different amount in the “${tab}” tab.`,
    cancel: 'Cancel',
    recording: 'Recording…',
    /** Η γραμμή «Ενοίκιο Ιανουαρίου 2026» (lib/home/cash.ts), από τη δόση και όχι από το ελληνικό κείμενο. */
    line: (year: number | null | undefined, month: number | null | undefined) => (month && month >= 1 && month <= 12
      ? `Rent for ${MONTHS_EN[month - 1]}${year ? ` ${year}` : ''}`
      : 'Rent'),
    due: (date: string) => `Due ${date}`,
    late: (n: number) => `${days(n)} late`,
    selectAll: (n: number) => `Select all (${n})`,
    clearAll: 'Clear all',
    group: 'Installments to record',
    date: 'Date received',
    method: 'How it was paid',
    cashWarning: (from: string, rate: string) => `From ${from} (Law 5222/2025), the ${rate} standard deduction will require rent to be collected through a bank or electronic payment; with cash it will be lost. For rent collected before then, the deduction applies as usual.`,
    /** lib/home/rentReceipt.ts: recordLabel, receiptNote. */
    recordLabel: (n: number, total: string) => (n === 0 ? 'Record' : n === 1 ? `Record · ${total}` : `Record ${n} installments · ${total}`),
    note: (done: number, asked: number) => (done === 0
      ? 'The payment wasn’t recorded'
      : done === asked
        ? (asked === 1 ? 'The payment was recorded' : `Recorded ${asked} installments`)
        : `Recorded ${done} of ${asked} installments. The rest stay open.`),
  },
};

/** Η μορφή του λεξικού. */
export type TenantsEn = typeof TENANTS_EN;
