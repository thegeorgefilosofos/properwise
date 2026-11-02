// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΠΑΚΕΤΑ ΣΤΑ ΑΓΓΛΙΚΑ: ΟΝΟΜΑΤΑ ΚΑΙ ΓΡΑΜΜΕΣ, ΟΧΙ ΤΙΜΕΣ
// ─────────────────────────────────────────────────────────────────────────
// Τιμές, όρια και πλήθη ζουν ΜΟΝΟ στο lib/billing/plans.ts και διαβάζονται
// από εκεί. Εδώ ζει μόνο η διατύπωση. Κάθε λίστα γραμμών έχει το ίδιο μήκος
// και την ίδια σειρά με την ελληνική (lib/i18n/en/plans.test.ts), ώστε η
// γραμμή «σάρωση» να είναι η ίδια θέση και στις δύο γλώσσες.
// ═══════════════════════════════════════════════════════════════════════════
import { PLANS, FREE_SCANS_PER_MONTH, type PlanId } from '@/lib/billing/plans';
import type { Locale } from '@/lib/i18n/locale';

export interface PlanCopy { name: string; tagline: string; features: string[] }

const upTo = (n: number) => `Up to ${n} properties`;

export const PLAN_COPY_EN: Record<PlanId, PlanCopy> = {
  free: {
    name: 'Owner', tagline: 'One property, no subscription',
    features: [
      'E2 ready for your accountant',
      'Lease declaration check',
      'ENFIA and legal reductions',
      'Tenants and rent received',
      `Scans: ${FREE_SCANS_PER_MONTH} a month`,
    ],
  },
  solo: {
    name: 'Owner with Noa', tagline: 'Ask Noa, in Greek',
    features: ['Noa, in Greek', 'Unlimited scans'],
  },
  owner: {
    name: 'Owner+', tagline: `${upTo(PLANS.owner.maxProperties)}, one view`,
    features: [upTo(PLANS.owner.maxProperties), 'Yield comparison by property', 'Early access to new features'],
  },
  agency: {
    name: 'Professional', tagline: 'Team, roles and accountability',
    features: [
      upTo(PLANS.agency.maxProperties),
      'Clients and portfolio',
      'Team with roles, no limit',
      'Reports under your brand',
      'Accounting journal, bank',
      'IRR, NPV and DSCR analysis',
    ],
  },
  office: {
    name: 'Professional+', tagline: 'Professional portfolio',
    features: ['Unlimited properties', 'First in line for new releases', 'Priority email support'],
  },
};

/** Η διατύπωση ενός πακέτου στη γλώσσα της σελίδας. Τα ελληνικά: ό,τι λέει το plans.ts. */
export function planCopy(locale: Locale, id: PlanId): PlanCopy {
  if (locale === 'en') return PLAN_COPY_EN[id];
  const p = PLANS[id];
  return { name: p.name, tagline: p.tagline, features: p.features };
}
