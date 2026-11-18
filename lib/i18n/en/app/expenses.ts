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

export const EXPENSES_EN = {
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
