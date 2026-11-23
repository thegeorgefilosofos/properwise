// ═══════════════════════════════════════════════════════════════════════════
// Η ΕΠΙΣΚΟΠΗΣΗ ΣΤΑ ΑΓΓΛΙΚΑ (app/dashboard/components/OverviewTab.tsx)
// ─────────────────────────────────────────────────────────────────────────
// Η κορυφή της Επισκόπησης: το ποσό της κεφαλίδας, το «Τι χρειάζεται τώρα»
// με ό,τι το γεμίζει (υποχρεώσεις, παρατηρήσεις, βήματα ρύθμισης), το Ταμείο
// και το «Από πού ξεκινάς». Οροι από το docs/i18n/GLOSSARY-EN.md.
//
// ΚΑΝΕΝΑ ΨΗΦΙΟ ΓΡΑΜΜΕΝΟ ΜΕ ΤΟ ΧΕΡΙ. Κάθε ποσό, ποσοστό και ημερομηνία φτάνει
// εδώ ως αριθμός από τον κώδικα που το υπολογίζει και γράφεται με το
// `APP_FMT` (lib/i18n/en/app/format.ts). Οι τίτλοι των φορολογικών υποχρεώσεων βγαίνουν από το ΕΙΔΟΣ
// τους (lib/i18n/en/deadlines.ts), όχι από το ελληνικό κείμενο.
//
// Φτάνει μόνο στα αγγλικά, με δυναμικό import() (lib/i18n/appEn.tsx).
// ═══════════════════════════════════════════════════════════════════════════
import { APP_FMT } from '@/lib/i18n/en/app/format';
import { athensParts, athensTime } from '@/lib/core/time';
import { obligationTitleEn } from '@/lib/i18n/en/deadlines';
import { categoryEn } from '@/lib/i18n/en/app/categories';
import { monthYearEn } from '@/lib/i18n/en/dates';
import type { TaxDeadlineRow } from '@/lib/onboarding/firstTax';
import type { TaxObligation } from '@/lib/tax/greekTaxCalendar';

// Ποσά «1.234,50€» και ημερομηνίες «02/11/2026», όπως στα ελληνικά (format.ts).
const f = APP_FMT;
const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

/** «today», «in 3 days», «3 days ago»: η προθεσμία σε λέξεις (lib/facts/deadlines.ts, dueText). */
export function dueTextEn(d: number | null | undefined): string | null {
  if (d == null || !Number.isFinite(d)) return null;
  if (d === 0) return 'today';
  if (d === 1) return 'tomorrow';
  if (d === -1) return 'yesterday';
  return d > 1 ? `in ${days(d)}` : `${days(-d)} ago`;
}

/** Τα κείμενα των παρατηρήσεων (lib/insights/engine.ts), ένα ανά αναγνωριστικό. */
export const INSIGHTS_EN = {
  /** Το όνομα της καρτέλας «Απόδοση», όπως στο μενού (lib/i18n/en/app/shell.ts). */
  tabRoi: 'Returns',
  insuranceExpired: (d: number) => ({ title: 'The property’s insurance has expired', detail: `It expired ${dueTextEn(d)}. Renew it so the property isn’t left uncovered.` }),
  insuranceSoon: (d: number) => ({ title: 'The insurance expires soon', detail: `In ${days(d)}. Renew it in time so the property isn’t left uncovered.` }),
  leaseExpired: (d: number) => ({ title: 'The lease has expired', detail: `It expired ${dueTextEn(d)}. Renew it or sign a new lease.` }),
  leaseSoon: (d: number) => ({ title: 'The lease ends soon', detail: `In ${days(d)}. A good time to talk to the tenant about renewing or adjusting the rent.` }),
  billsOverdue: (n: number, total: number) => ({ title: `${n} overdue ${n === 1 ? 'bill' : 'bills'}`, detail: 'The payment date has passed. Pay them to avoid surcharges or a supply cut-off.', metric: total > 0 ? f.fe(total) : undefined }),
  billsUnpaid: (n: number) => ({ title: `${n} unpaid ${n === 1 ? 'bill' : 'bills'}`, detail: 'Waiting for payment. Settle them while there is time.' }),
  tasksOverdue: (n: number) => ({ title: `${n} maintenance ${n === 1 ? 'task' : 'tasks'} overdue`, detail: 'Maintenance on time costs much less than a breakdown. See what is pending.' }),
  chkOverdue: (n: number) => ({ title: `${n} overdue ${n === 1 ? 'to-do' : 'to-dos'}`, detail: n === 1 ? 'Its deadline has passed.' : 'Their deadline has passed.' }),
  warrantySoon: (n: number, name: string | null, d: number) => ({
    title: n === 1 ? 'An appliance’s warranty is ending' : `${n} warranties are ending`,
    detail: `${name ? `“${name}”: ` : ''}${days(d)} of warranty left. If something isn’t right, the repair is covered now.`,
  }),
  vacant: (rent: number) => ({ title: 'The property is vacant', detail: `Each month without a tenant is about ${f.fe(rent)} of lost income. If you are looking, first see what rent your area gets.`, metric: `${f.fe(rent)}/month` }),
  vacantShort: () => ({ title: 'Open dates', detail: 'Gaps between bookings are normal. Before high season, review your price, photos and reviews.' }),
  energy: (total: number) => ({ title: 'Electricity takes a large share of your costs', detail: 'Electricity prices change often. Comparing providers shows whether a cheaper tariff fits your consumption.', metric: f.fe(total) }),
  spendSpike: (category: string, overPct: number, amount: number, usual: number, basedOn: number, more: number, excess: number) => ({
    title: `${categoryEn(category)}: ${f.fpRate(overPct)} above your usual`,
    detail: `Last month ${f.fe(amount)} against ${f.fe(usual)}, the median of the previous ${basedOn} months with spending in this category.`
      + (more > 0 ? ` ${more === 1 ? 'One more category' : `${more} more categories`} went over.` : '')
      + ' If it is a wrong charge, there is still time to raise it.',
    metric: `+${f.fe(excess)}`,
  }),
  yieldStrong: (y: number, tab: string) => ({ title: 'Strong return', detail: `From what you have recorded, the property returns ${f.fp(y)} net a year. The comparison with your area is in “${tab}”.`, metric: f.fp(y) }),
  yieldLow: (y: number, tab: string) => ({ title: 'There is room in the return', detail: `The net return is ${f.fp(y)}. See in “${tab}” what your area gets and which costs bring it down.`, metric: f.fp(y) }),
  loanNegative: (leased: boolean, rent: number, payment: number, short: number, cash: number) => ({
    title: 'The loan payment is more than the property leaves',
    detail: `With ${leased ? 'rent' : 'target rent'} of ${f.fe(rent)} and a loan payment of ${f.fe(payment)}, you are ${f.fe(short)} short each month after costs. Costs are this year’s monthly average.`,
    metric: `${f.feSigned(cash)}/month`,
  }),
  loanPositive: (leased: boolean, payment: number, cash: number) => ({
    title: leased ? 'The rent covers the loan payment' : 'The target rent covers the loan payment',
    detail: `After the loan payment of ${f.fe(payment)} and costs, ${f.fe(cash)} is left each month, based on this year’s average.`,
    metric: `${f.fe(cash)}/month`,
  }),
  /** Τα στοιχεία που λείπουν, με τη σειρά του κώδικα: αξία, εμβαδόν, ταχυδρομικός κώδικας. */
  profileIncomplete: (missing: readonly ('value' | 'sqm' | 'postal')[]) => {
    const words = missing.map(m => ({ value: 'the value', sqm: 'the floor area', postal: 'the postcode' })[m]);
    const list = words.length === 1 ? words[0] : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
    return { title: 'Property details are missing', detail: `Add ${list} so returns and comparisons come out right. It takes a minute.` };
  },
  noExpenses: () => ({ title: 'Start with one photo', detail: 'Take a photo of a bill or a receipt; the expense goes into the right category by itself.' }),
  stale: (n: number) => ({ title: 'It has been a while since you recorded anything', detail: `${days(n)} without a new entry. A photo of the next bill keeps the picture up to date.` }),
};
export type InsightsEn = typeof INSIGHTS_EN;

/** Οι υποχρεώσεις του ακινήτου (app/dashboard/components/obligations.ts). */
export const OBLIGATIONS_EN = {
  taxTitle: (o: TaxObligation) => obligationTitleEn(o),
  enfiaOwn: (annual: number) => `The ENFIA you recorded: ${f.fe(annual)} a year.`,
  insurance: (company: string | null) => ({ title: `Insurance expires${company ? `, ${company}` : ''}`, note: 'Renew the policy before it expires so the property isn’t left uncovered.' }),
  leaseEnd: { title: 'Lease ends', note: 'Start talking about renewal or a rent adjustment about two months before.' },
  leaseDecl: { title: 'Lease declaration (AADE)', note: 'Every new or changed lease is declared online to AADE, the Greek tax authority, by the end of the month after it starts.' },
  leaseTermination: { title: 'Declare the end of the lease to AADE', note: 'The tenant left before the lease ended. The end is declared online to AADE by the end of the month after they moved out, otherwise the lease stays active on myAADE.' },
  maintenance: (task: string, item: string | null, cost: number | null) => ({
    title: `Maintenance, ${task}${item ? `, ${item}` : ''}`,
    note: cost ? `Scheduled equipment maintenance. Estimated cost ${f.fe(cost)}.` : 'Scheduled equipment maintenance.',
  }),
};
export type ObligationsEn = typeof OBLIGATIONS_EN;

export const OVERVIEW_EN = {
  insights: INSIGHTS_EN,
  obligations: OBLIGATIONS_EN,
  f,
  /** «Wednesday 18/11/2026, 02:45 (Athens time)»: ώρα Ελλάδας, όπως και στα ελληνικά. */
  athensNow: (now: Date = new Date()) => {
    const p = athensParts(now);
    const iso = `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
    return `${WEEKDAYS[p.weekday]} ${f.date(iso)}, ${athensTime(now)} (Athens time)`;
  },
  /**
   * Η γραμμή του ΕΝΦΙΑ κάτω από το ποσό (lib/onboarding/firstTax.ts, enfiaDeadline),
   * από την υποχρέωση και το ποσό που κουβαλά. `head` είναι το «ENFIA 2027» του
   * εκκαθαριστικού που δεν έχει εκδοθεί ακόμη.
   */
  enfiaRow: (row: TaxDeadlineRow, o: { paidOff?: boolean; single?: boolean; head?: number; monthOnly?: boolean }): string => {
    const ob = row.ob;
    if (!ob) return '';
    // Το εκκαθαριστικό που δεν έχει εκδοθεί λέγεται μόνο με μήνα, όπως και στα ελληνικά.
    const when = ob.confidence === 'statutory' && !o.monthOnly ? f.date(ob.date) : monthYearEn(ob.date);
    const title = o.head != null ? `ENFIA ${o.head}`
      : o.paidOff ? (o.single ? obligationTitleEn(ob as TaxObligation) : 'Last installment')
      : `${obligationTitleEn(ob as TaxObligation)} ${row.amount != null ? f.fe(row.amount) : ''}`.trim();
    return `${title} · ${when}`;
  },
  hero: {
    tax: (y: number) => `Rental income tax ${y}`,
    enfia: (y: number) => `ENFIA ${y}`,
    net: (y: number) => `Net ${y}, with what we know today`,
    expenses: (y: number) => `Expenses ${y}`,
    enfiaMissing: 'Enter the ENFIA from your assessment notice',
    rentMissing: 'The rent is missing',
    addRent: 'Add the rent',
    notLoaded: 'Didn’t load',
    taxLine: (y: number, v: string) => `Rental income tax ${y} · ${v}`,
    scan: 'Scan a document',
    pdf: 'PDF report',
    pdfTitle: 'The report is in Greek, as your accountant and AADE use it.',
    pdfWaiting: 'The report waits until all amounts have loaded',
  },
  failed: {
    sentence: (n: number) => `${n === 1 ? 'One part' : `${n} parts`} of this property’s data didn’t load.`,
    money: 'Until they load, we don’t show totals: they would be half.',
    partial: 'What you see below may not be complete.',
    retry: 'Try again',
    retrying: 'Loading…',
    allLoaded: 'Everything loaded.',
    notAll: 'The new attempt didn’t load everything.',
  },
  agenda: {
    title: 'To-dos',
    late: (n: number) => `${n} overdue`,
    none: 'Nothing is pending.',
    noneIncomplete: 'Not all to-dos loaded.',
    incomplete: 'The list may not be complete.',
    more: 'See the other to-dos',
    all: 'All to-dos',
    pending: 'pending',
    estimate: 'estimate',
    today: 'today', tomorrow: 'tomorrow', now: 'now',
    unit: (n: number, late: boolean) => (late ? (n === 1 ? 'day late' : 'days late') : (n === 1 ? 'day left' : 'days left')),
    /** Η κοινή προϋπόθεση των δόσεων του φόρου εισοδήματος (lib/home/agenda.ts, withCondition). */
    incomeCondition: 'Only if your tax return left tax to pay that you didn’t settle in one payment.',
    /** Ενέργειες που δεν είναι καρτέλα του μενού. */
    /** Ενέργειες που δεν είναι καρτέλα του μενού. Το `enfia-import` είναι η δόση
     *  ΕΝΦΙΑ χωρίς ποσό (lib/home/agenda.ts, ENFIA_IMPORT_ACTION). */
    actions: { edit: 'Property details', scan: 'Scan', 'enfia-import': 'Amount? Upload the assessment' } as Record<string, string>,
  },
  /** Τα βήματα ρύθμισης του ακινήτου που μπαίνουν στη λίστα. */
  setup: {
    details: ['Add the value and the rent', 'Market or objective value and monthly rent, for accurate returns'],
    tenant: ['Add a tenant and the rent', 'For returns and a reminder before the lease ends'],
    expense: ['Record your first expense', 'Track costs and tax deductions'],
    bills: ['Set up electricity and gas', 'Compare providers and find a cheaper tariff'],
    pricing: ['See your suggested price', 'Dynamic nightly price and the tax picture of short-term renting'],
    inv: ['Start the inventory', 'Equipment, warranties and depreciation'],
  } as Record<string, readonly [string, string]>,
  /** «Στείλε στον λογιστή σου» (accountantSend.ts): η κάρτα της Επισκόπησης και οι Ρυθμίσεις. */
  accountantSend: 'Send to your accountant',
  calendarFeed: 'Put the deadlines in your phone’s calendar. Once, then it updates by itself. Event titles are in Greek.',
  cash: {
    calm: 'Cash',
    owedToMe: 'Owed to you',
    owedByMe: 'You owe',
    openIn: (tab: string) => `Open in ${tab}`,
    rentIn: 'Rent received',
    nothingLate: 'Nothing overdue',
    nothingUnpaid: 'Nothing unpaid',
    /** Η σημείωση κάτω από το ποσό (lib/home/cash.ts, cashSideNote). */
    note: (kind: 'in' | 'out', count: number, firstDays: number | null | undefined, overdueCount: number, overdue: number) => {
      const items = kind === 'in' ? `${count} ${count === 1 ? 'installment' : 'installments'}` : `${count} unpaid`;
      const oldest = kind === 'in' ? 'the oldest' : 'the oldest';
      if (firstDays != null && firstDays < 0) {
        const tail = `${oldest} ${days(Math.abs(firstDays))} late`;
        return overdueCount > 0 && overdueCount < count ? `${items} · ${f.fe(overdue)} overdue, ${tail}` : `${items} · ${tail}`;
      }
      if (firstDays != null) return firstDays === 0 ? `${items} · the first is due today` : `${items} · the first in ${days(firstDays)}`;
      return items;
    },
  },
  start: {
    title: 'Where to start',
    open: 'Open',
    collapse: 'Collapse',
    left: (steps: number, d: number) => `${steps} ${steps === 1 ? 'step' : 'steps'} to go, ${days(Math.max(0, Math.round(d)))} left`,
    done: (done: number, total: number) => `${done} of ${total} steps done.`,
    example: 'See an example',
    tour: 'Short tour',
    exampleNote: 'The example is a property with a full year in PROPERWISE, so you can see what the app does.',
    steps: {
      property: ['Your first property', 'Type, status and rent. The tax comes out right away.', 'Add'],
      basics: ['The property basics', 'Address, ATAK (the property’s tax ID number), floor area and energy certificate.', 'Fill in'],
      document: ['One receipt, scanned', 'The expense is recorded automatically by tax number and category.', 'Scan'],
      deadlines: ['Deadlines on your phone', 'Connect the Calendar once with Google or Apple.', 'Connect'],
    } as Record<string, readonly [string, string, string]>,
  },
};

export type OverviewEn = typeof OVERVIEW_EN;
