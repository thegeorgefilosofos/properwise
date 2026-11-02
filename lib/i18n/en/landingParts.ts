// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΜΕΡΗ ΤΗΣ ΑΓΓΛΙΚΗΣ ΑΡΧΙΚΗΣ ΠΟΥ ΦΤΑΝΟΥΝ ΚΑΙ ΣΤΟΝ BROWSER
// ─────────────────────────────────────────────────────────────────────────
// Ο app/LandingCalculator.tsx είναι client component. Αν διάβαζε το PARTS_EN
// από το ./landing, θα τραβούσε στο πακέτο πελάτη το billingWords και μαζί
// τον κώδικα του εμπόρου (επαλήθευση webhook). Το security:bundle το έπιασε.
// Εδώ μπαίνει μόνο ό,τι είναι ασφαλές για τον browser.
// ═══════════════════════════════════════════════════════════════════════════
import { TRIAL_DAYS } from '@/lib/billing/plans';
import { TRIAL_SCANS_PER_MONTH, TRIAL_LIMITS } from '@/lib/billing/aiLimits';
import { ASSISTANT_NAME_EN as NOA, AI_DISCLOSURE_EN } from '@/lib/i18n/en/noa';
import { PLAN_COPY_EN } from './plans';

const name = (id: keyof typeof PLAN_COPY_EN) => PLAN_COPY_EN[id].name;
const scanLine = (n: number | null): string => n === null ? 'unlimited scans' : `${n} scans a month`;
export const PARTS_EN = {
  perMonth: '/month',
  orYear: (amount: string) => `or ${amount} a year`,
  annual: (paid: number) => `Annual: pay for ${paid} months, not 12`,
  inherits: (prev: string) => `Everything in “${prev}”, plus:`,
  includes: 'Includes:',
  questions: (ai: number, day: number) => `${ai} questions a month, up to ${day} a day`,
  recommended: 'Recommended',
  without: `Without ${NOA}`,
  with: `With ${NOA}`,
  allTax: (props: number) => `${props === 1 ? 'One property' : `Up to ${props} properties`}, every tax tool`,
  scanLine,
  trialLine: () => `${TRIAL_DAYS}-day trial: ${TRIAL_LIMITS.perMonth} questions, up to ${TRIAL_LIMITS.perDay} a day · ${scanLine(TRIAL_SCANS_PER_MONTH)}`,
  noa: {
    over: 'In Greek',
    title: `Meet ${NOA}.`,
    name: NOA,
    lead: `Ask about your property in Greek and get answers from your own numbers. Everything you would ask your accountant, before you pick up the phone.`,
    does: [
      { t: 'Ask the way you talk', d: 'In writing or by voice, in Greek.' },
      { t: 'Answers from your data', d: 'Based on your records, not generic advice.' },
      { t: 'Takes you where you need to go', d: 'Opens the screen you need for the next step.' },
    ],
    cta: `Try ${NOA}`,
    noSub: `“${name('free')}” without ${NOA} needs no subscription.`,
    stage: `Example questions for ${NOA}`,
    sub: 'For your properties',
    asks: [
      'How much did I spend on building charges this year?',
      'Which tenant still owes me rent?',
      'What expires this month?',
    ],
    asksNote: `Shown in English. ${NOA} works in Greek.`,
    input: 'Ask something about your property…',
    disclosure: AI_DISCLOSURE_EN,
  },
  calc: {
    rent: 'Monthly rent', rentHint: 'The gross monthly rent',
    value: 'Property value', valueHint: 'Current market value, used for the yield',
    costs: 'Annual costs', costsHint: 'ENFIA, insurance, upkeep, owner’s building charges',
    amount: 'amount',
    scale: (y: number) => `${y} rental tax brackets`,
    taxable: 'taxable',
    netYield: 'Net yield, after tax',
    say: (y: string, m: string) => `Net yield after tax ${y}. Net per month ${m}.`,
    monthly: 'Net per month', gross: 'Gross yield', taxYear: 'Tax per year', taxShare: 'Tax as a share of rent',
    note: (y: number, deduction: string) => `An indicative estimate for one property with no other rental income, using the ${y} rental tax brackets (Law 5246/2025) and the ${deduction} standard deduction for expenses. It applies Greek tax law for ${y} and does not replace your accountant.`,
  },
};
