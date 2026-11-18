// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΔΑΠΑΝΕΣ ΣΤΑ ΑΓΓΛΙΚΑ (TabFinances, ExpenseLedger, InboundInbox)
// ─────────────────────────────────────────────────────────────────────────
// Το βιβλίο δαπανών: μετρητές, φίλτρα, πάγια που λείπουν, αλλαγές τιμής,
// γραμμές, καταχώρηση και επεξεργασία. Οροι από το docs/i18n/GLOSSARY-EN.md.
// Ποσά και ημερομηνίες με το `APP_FMT` (lib/i18n/en/app/format.ts): «1.234,50€»,
// «02/11/2026», όπως στα ελληνικά. Φτάνει μόνο στα αγγλικά, με δυναμικό
// import() (lib/i18n/appEn.tsx).
// ═══════════════════════════════════════════════════════════════════════════
import { APP_FMT } from '@/lib/i18n/en/app/format';
import { CATEGORY_EN, categoryEn } from '@/lib/i18n/en/app/categories';
import { MONTHS_EN, monthYearEn } from '@/lib/i18n/en/dates';

const f = APP_FMT;
const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

/** Ο μήνας ενός κλειδιού «2026-11»: «November», ή «November 2025» όταν η χρονιά διαφέρει. */
const monthOf = (key: string, refYear?: number) => {
  const y = Number(key.slice(0, 4)), m = Number(key.slice(5, 7)) - 1;
  const name = MONTHS_EN[m] ?? key;
  return refYear !== undefined && y !== refYear ? `${name} ${y}` : name;
};

/** Η σάρωση εγγράφου (DocumentScan): η πρώτη οθόνη, τα μηνύματα και η επιτυχία. */
const SCAN_EN = {
  intro: 'Take a photo of a bill, receipt, lease, title deed, insurance policy or ENFIA notice (Greece’s annual property tax), or upload it. We suggest where it goes and you confirm.',
  introBulk: 'You don’t have a property yet to file a document under. From form E9 or the ENFIA assessment on myAADE, all your properties come in at once.',
  photo: ['Take a photo', 'With the device camera'],
  upload: ['Upload a file', 'JPG · PNG · PDF'],
  manual: ['Type it in', 'Without a receipt'],
  bank: ['Bank transactions', 'CSV or Excel'],
  bulk: ['Many properties from E9 or ENFIA', 'All at once, from myAADE'],
  privacyBulk: 'The myAADE PDF is read on your device; a photo is read with AI',
  privacy: 'Reading is done with AI. A myAADE PDF is checked on your device first: if it is recognized as form E9 or an ENFIA assessment, it is not sent to the AI provider',
  privacyTail: ['. The ', 'privacy policy', ' applies; the AI provider is bound by contract not to train models on your documents.'],
  tooBig: (size: string, max: number) => `The file is too large (${size}). The limit is ${max} MB.`,
  errors: {
    unreadable: ['I couldn’t read the document clearly', ['Take the photo in good light, straight, with the whole document in frame', 'If you have a PDF from the provider, upload it: it reads better']],
    quota: ['This month’s scans are used up', ['Fill in the fields by hand and save as usual']],
    key_missing: ['Automatic reading isn’t active yet', ['Fill in the fields by hand and save as usual', 'We switch automatic reading on; you don’t need to set anything']],
    save: ['Something went wrong while saving', ['Try again, your details are kept']],
    format: ['This file type can’t be read', ['Photos and PDF files can be read', 'Fill in the fields by hand and save as usual']],
    big: ['The file is too large to read', ['Upload a photo of the document or a smaller PDF', 'Fill in the fields by hand']],
    other: ['The reading service isn’t available right now', ['Try again in a moment', 'Fill in the fields by hand']],
  } as Record<string, readonly [string, readonly string[]]>,
  noKind: 'No document details were found in this image. Choose a type to file it or upload another file.',
  unsure: 'The scan isn’t sure about the type. Check it.',
  saved: 'Filed',
  savedSub: 'The related tabs were updated automatically.',
  scanNew: 'Scan a new document',
  bulkAll: 'File all the properties',
  openIn: (tab: string) => `Open in ${tab}`,
  otherFile: 'Another file',
  file: 'Document',
  openDoc: 'Open the document',
  doc: 'The document',
  filing: 'Filing…',
  fileIt: 'File it',
};

export const EXPENSES_EN = {
  scan: SCAN_EN,
  /** Η σύγκριση μηνών (ExpenseCompare). */
  compare: {
    monthOf,
    short: (m0: number) => (MONTHS_EN[m0] ?? '').slice(0, 3),
    vs: (key: string) => `${monthOf(key)} compared with`,
    flat: 'No real change.',
    spread: 'The difference is spread out: no category stands out.',
    where: 'Where the difference went',
    less: '− less', more: '+ more',
    isNew: 'new', stopped: 'stopped',
    rest: 'Other',
    noData: 'No expenses recorded in this period.',
    fromLastYear: 'from last year',
    twelve: 'Twelve months',
    average: 'average',
    overMonths: (n: number) => ` over ${n} months with expenses`,
    oneOff: (dir: 'up' | 'down', name: string, baseKey: string) => (dir === 'up'
      ? `The increase is mostly a one-off expense: ${name}.`
      : `The decrease is mostly a one-off expense in ${monthOf(baseKey)}: ${name}.`),
  },
  f,
  categoryEn,
  categories: CATEGORY_EN,
  monthYear: monthYearEn,
  tabs: { budget: 'Budget', contracts: 'Contracts' },
  sub: 'What you paid and what is waiting to be paid, for this property.',
  newExpense: 'New expense',
  /** «due in 4 days», «overdue by 3 days» (ExpenseLedger, dueText). */
  due: (d: number): { text: string; late: boolean } =>
    d < 0 ? { text: d === -1 ? 'overdue since yesterday' : `overdue by ${days(-d)}`, late: true }
      : d === 0 ? { text: 'due today', late: true }
      : d === 1 ? { text: 'due tomorrow', late: false }
      : { text: `due in ${days(d)}`, late: false },
  unpaid: (n: number) => `${n} unpaid`,
  /** «Expenses in November», «Expenses 2026». Ο μήνας από το 0. */
  monthStat: (m0: number) => `Expenses in ${MONTHS_EN[m0] ?? ''}`,
  yearStat: (y: string) => `Expenses ${y}`,
  unpaidStat: 'Unpaid expenses',
  overdueTail: (n: number) => `, ${n} overdue`,
  excluded: (v: number) => `${f.fe(v)} left out of statistics`,
  filter: 'Filter expenses',
  all: 'All',
  overdue: (n: number) => `Overdue ${n}`,
  pending: (n: number) => `Pending ${n}`,
  clearFilter: 'Clear filter',
  overBudget: (label: string) => `Over budget: ${label}`,
  missingTitle: (n: number) => (n === 1 ? 'One recurring expense hasn’t been recorded yet' : `${n} recurring expenses haven’t been recorded yet`),
  cadence: (m: number) => (m === 1 ? 'every month' : m === 2 ? 'every two months' : m === 3 ? 'every three months' : m === 6 ? 'every six months' : m === 12 ? 'every year' : `every ${m} months`),
  missingLine: (name: string, typical: number, cadence: string, expected: string) => `${name}, usually ${f.fe(typical)} ${cadence} · expected ${expected}`,
  record: 'Record',
  andMore: (n: number) => `and ${n} more`,
  changedTitle: (n: number) => (n === 1 ? 'One charge changed amount' : `${n} charges changed amount`),
  /** Η πρόταση της αλλαγής τιμής (lib/expenses/priceChange.ts), από τους ίδιους αριθμούς. */
  changedLine: (name: string, flatRate: boolean, previous: number, current: number, deltaEur: number, deltaPctExact: number) => {
    const up = deltaEur > 0;
    return flatRate
      ? `${name}: ${up ? 'went up' : 'got cheaper'} from ${f.fe(previous)} to ${f.fe(current)}, ${up ? '+' : '−'}${f.fe(Math.abs(deltaEur))} a month.`
      : `${name}: ${f.fe(current)} instead of the ${f.fe(previous)} you usually paid, ${up ? '+' : '−'}${f.fp(Math.abs(deltaPctExact))}. It may be the consumption or the price.`;
  },
  andOthers: (n: number) => ` And ${n} more.`,
  cancel: 'Cancel',
  search: 'Description or provider',
  searchLabel: 'Search expenses',
  photo: 'Take a photo or upload a file',
  photoSub: 'A receipt, a bill or a PDF: it fills itself in',
  needsEye: (n: number) => (n === 1 ? '1 line needs a look' : `${n} lines need a look`),
  needsEyeSub: 'Either they have no category or they look like duplicates. Nothing is lost, but until they are sorted they don’t count correctly in the Budget.',
  none: 'No expenses yet',
  noMatch: 'No expenses found',
  noMatchQ: (q: string) => `No entry matches “${q}”.`,
  noMatchFilter: 'No entry matches the filter.',
  clear: 'Clear',
  less: 'Less',
  more: 'More',
  older: (n: string) => `${n} older`,
  recurring: 'recurring',
  outOfStats: 'left out of statistics',
  working: 'Working…',
  paid: 'Paid',
  actionsFor: (name: string, amount: number) => `Actions for ${name}, ${f.fe(amount)}`,
  edit: 'Edit',
  delete: 'Delete expense',
  deleteConfirm: {
    title: (amount: number) => `Delete the ${f.fe(amount)} expense?`,
    message: (name: string, date: string) => `“${name}” of ${date}.\nThe line is removed for good from the Budget, Accounting and your accountant’s file. This can’t be undone.`,
    confirm: 'Delete',
    cancel: 'Cancel',
    confirmTitle: 'Confirm',
  },
  deleted: 'Expense deleted',
  markedPaid: 'Marked as paid',
  notSaved: 'It wasn’t saved. Try again.',
  savedOk: 'Saved',
  afm: {
    label: 'Supplier tax number (AFM)',
    why: 'Why the tax number is asked',
    hint: 'Optional. Without it, your accountant matches receipts by name.',
    placeholder: 'Nine digits',
    bad: 'That isn’t a valid tax number. Nine digits, as on the receipt.',
  },
  form: {
    editTitle: 'Edit expense',
    save: 'Save',
    record: 'Record',
    what: 'Description',
    whatPlaceholder: 'electricity bill, plumber',
    amount: 'Amount',
    date: 'Date',
    dueDate: 'Due date',
    category: 'Category',
    categoryLabel: 'Expense category',
    noCategory: 'No category',
    counts: 'Counts in statistics',
    countsHint: 'Counts in the year’s total, stays out of the month comparison and the averages.',
    paid: 'Paid',
    needWhat: 'Needs a description.',
    needAmount: 'Needs an amount above zero.',
    needDate: 'Needs a date.',
    fillDate: 'Fill in a date.',
    moreOpen: 'Less',
    moreClosed: (paid: boolean) => `More: who pays${paid ? ', supplier tax number' : ''}`,
    whoPays: 'Who pays',
    paidBy: { owner: 'Only me', co_owner: 'With a co-owner', tenant: 'Tenant', family: 'With family', parents: 'With parents', split: 'Half and half', company: 'Company' } as Record<string, string>,
    myShare: 'My share',
    paidNote: 'It goes into the expenses of the month you chose.',
    unpaidNote: 'It goes into unpaid items and shows in the Calendar until it is paid.',
    recorded: 'Recorded',
    recordedPending: 'Recorded as a pending payment',
  },
};

export type ExpensesEn = typeof EXPENSES_EN;
