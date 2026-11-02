// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΚΕΙΜΕΝΑ ΤΩΝ ΜΙΚΡΩΝ ΑΓΓΛΙΚΩΝ ΣΕΛΙΔΩΝ: ΤΙΜΕΣ ΚΑΙ ΚΟΜΒΟΣ ΕΡΓΑΛΕΙΩΝ
// ─────────────────────────────────────────────────────────────────────────
// Ο κόμβος δείχνει μόνο υπολογισμούς με αγγλική σελίδα (lib/i18n/en/tools.ts).
// ═══════════════════════════════════════════════════════════════════════════
import { ASSISTANT_NAME_EN as NOA } from '@/lib/i18n/en/noa';
import type { TopicId } from '@/lib/core/topics';

export const PRICING_EN = {
  title: 'What each plan includes · PROPERWISE',
  description: `Prices and features for every plan, line by line: properties, questions to ${NOA}, document scanning, form E2 export, accounting journal and portfolio.`,
  crumb: 'Pricing',
  eyebrow: 'Plans',
  h1: 'What each plan includes',
  lede: `One property with no subscription, with every tax tool. The larger plans add properties, ${NOA} and team tools.`,
};

export const TOOLS_HUB_EN = {
  title: 'Calculators for property owners in Greece: tax, ENFIA, mortgage',
  description: (n: number) => `${n} calculators for owners of property in Greece, no sign-up needed: rental income tax, ENFIA, short-term lets, mortgages, yield and electricity.`,
  crumb: 'Tools',
  lede: 'Every calculation runs on your device, with your own figures and no sign-up. They are the same calculations the app uses: indicative, not an official document, and each one cites its sources. Each applies Greek tax law for the year it states.',
  kicker: 'Calculator',
  cta: 'Open the calculator',
  count: (n: number) => `${n} ${n === 1 ? 'calculator' : 'calculators'}`,
  other: 'Other calculators',
  ledes: {
    enoikia: 'Tax on rental income with the year’s brackets, and what a short-term let leaves you with next to a long-term one.',
    enfia: 'ENFIA, Greece’s annual property tax, for your own property, as an indicative amount.',
    agora: 'Your mortgage payment and how much your income allows, what rent leaves you after costs, and what you would pay for electricity on each tariff.',
  } satisfies Record<TopicId, string>,
};
