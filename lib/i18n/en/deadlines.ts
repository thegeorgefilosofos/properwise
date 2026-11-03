// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΠΡΟΘΕΣΜΙΕΣ ΤΟΥ ΙΔΙΟΚΤΗΤΗ ΣΤΑ ΑΓΓΛΙΚΑ (app/prothesmies, /en/tax-deadlines)
// ─────────────────────────────────────────────────────────────────────────
// Ιδιο φορολογικό ημερολόγιο (lib/tax/greekTaxCalendar.ts μέσω του
// lib/seo/prothesmies.ts): ίδιες ημερομηνίες, ίδιες επίσημες πηγές. Εδώ μόνο
// ο τίτλος κάθε υποχρέωσης ανά ΕΙΔΟΣ (`kind`) και η σειρά της δόσης από το
// αναγνωριστικό της· το ελληνικό κείμενο του ημερολογίου δεν διαβάζεται.
// ═══════════════════════════════════════════════════════════════════════════
import type { MonthDeadline } from '@/lib/seo/prothesmies';
import type { TaxObligation } from '@/lib/tax/greekTaxCalendar';
import { parseMonthKey } from '@/lib/seo/prothesmies';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;

/** «2026-11» → «November 2026». */
export const monthLabelEn = (key: string): string => {
  const p = parseMonthKey(key);
  return p ? `${MONTHS[p.month - 1]} ${p.year}` : key;
};

const ordinal = (n: number): string => {
  const t = n % 100;
  if (t >= 11 && t <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
};

/** Ο τίτλος της υποχρέωσης του μήνα, από το είδος της. */
export const deadlineTitleEn = (d: MonthDeadline): string => obligationTitleEn(d.obligation);

/** Ο τίτλος μιας υποχρέωσης του ημερολογίου, από το είδος της (όχι από το ελληνικό `title`). */
export function obligationTitleEn(o: TaxObligation): string {
  switch (o.kind) {
    case 'enfia-issue': return o.confidence === 'statutory' ? 'ENFIA: assessment notice issued' : 'ENFIA: assessment notice issued (expected)';
    case 'enfia-first': return 'ENFIA: 1st installment';
    case 'enfia-instalment': {
      const k = Number(o.id.split('-').pop());
      return Number.isFinite(k) ? `ENFIA: ${ordinal(k)} installment` : 'ENFIA: installment';
    }
    case 'enfia-last': return 'ENFIA: last installment';
    case 'e9': return 'Form E9: check or report changes to your properties';
    case 'income-autofile': return 'Check the pre-filled tax return before it is filed automatically';
    case 'income-decl': return 'Income tax return (forms E1 and E2 for property)';
    case 'str-registry': return 'Short-term rental stays: monthly filing (AADE registry)';
    case 'str-climate-fee': return 'Climate crisis resilience fee: payment';
  }
}

export const DEADLINES_EN = {
  hub: 'Tax deadlines for property owners in Greece',
  title: (a: string, b: string) => `Greek property tax deadlines: ${a} and ${b}`,
  description: (n: number, a: string, b: string) =>
    `The ${n} deadlines for property owners in Greece in ${a} and ${b}: ENFIA, short-term rentals and tax returns, each with its official source.`,
  intro: 'What falls due this month and next for anyone who owns property in Greece: ENFIA (the annual property tax), tax returns and, for short-term rentals, the monthly obligations. Dates come from the app’s tax calendar, with the official source next to each. AADE is the Greek tax authority; myAADE is its online portal.',
  none: 'The calendar has no owner deadline this month.',
  caption: (m: string) => `Deadlines in ${m}`,
  obligation: 'Obligation', by: 'Due',
  shortOnly: 'Short-term rentals only', everyone: 'Every owner',
  confidence: { statutory: 'Date set by law', announced: 'Last year’s date' } as Record<MonthDeadline['obligation']['confidence'], string>,
  source: 'Official source',
  fewer: 'If your amount is small, there are fewer installments; check your assessment notice.',
  ctaTitle: 'Reminders that come on their own',
  ctaBody: 'The app adds these deadlines to your property’s calendar and reminds you by email or phone notification, with the installment amount when it knows it.',
  more: ['What ENFIA comes to is worked out by the ', 'ENFIA calculator', ', and the tax on your rent by the ', 'rental income tax calculator', '.'] as const,
};
