// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΚΑΡΤΕΣ ΚΟΙΝΟΠΟΙΗΣΗΣ ΤΩΝ ΑΓΓΛΙΚΩΝ ΣΕΛΙΔΩΝ
// ─────────────────────────────────────────────────────────────────────────
// Ο σύνδεσμος μιας αγγλικής σελίδας σε LinkedIn ή WhatsApp δείχνει αγγλική
// κάρτα, από την ίδια διαδρομή (/og/<slug>) και το ίδιο πλαίσιο με τις
// ελληνικές. Κλειδί «en-…», ώστε να μη συγκρούεται ποτέ με ελληνικό slug.
// ═══════════════════════════════════════════════════════════════════════════
import type { ShareCard } from './share';
import { LANDING_EN } from '@/lib/i18n/en/landing';
import { enTools } from '@/lib/i18n/en/tools';

export const EN_SHARE_CARDS: Record<string, ShareCard> = {
  'en-home': { kind: 'calc', over: '', title: LANDING_EN.titleLines[0], accent: LANDING_EN.titleLines[1],
    chips: ['One property, no subscription', 'Income and expenses', 'Tax and ENFIA', 'Deadlines'], path: '/en' },
  'en-pricing': { kind: 'page', over: 'Pricing', title: 'What each plan includes',
    chips: ['Line by line', 'Questions to Noa', 'Document scanning', 'Form E2 export'], path: '/en/pricing' },
  'en-enfia-calculator': { kind: 'calc', over: 'Calculator', title: 'Estimate ENFIA on your Greek property',
    chips: ['Floor area', 'Zone price', 'Floor', 'Building age'], path: '/en/enfia-calculator' },
  'en-rental-income-tax-calculator': { kind: 'calc', over: 'Calculator', title: 'Tax on your rental income in Greece',
    chips: ['Monthly rent', 'Months rented', 'Income year', 'Standard deduction'], path: '/en/rental-income-tax-calculator' },
  'en-rental-yield-calculator': { kind: 'calc', over: 'Calculator', title: 'Net rental yield on a Greek property',
    chips: ['Property value', 'Rent', 'ENFIA', 'Expenses'], path: '/en/rental-yield-calculator' },
  'en-short-term-vs-long-term-rental': { kind: 'calc', over: 'Calculator', title: 'Short-term or long-term rental in Greece',
    chips: ['Nightly rate', 'Occupancy', 'Resilience fee', 'Break-even'], path: '/en/short-term-vs-long-term-rental' },
  'en-tools': { kind: 'calc', over: 'Tools', title: 'Calculators for property owners in Greece',
    chips: enTools().map(t => t.label).slice(0, 4), path: '/en/tools' },
};
