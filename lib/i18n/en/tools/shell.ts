// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΚΕΛΥΦΟΣ ΤΩΝ ΥΠΟΛΟΓΙΣΤΩΝ ΣΤΑ ΑΓΓΛΙΚΑ: ΕΙΣΑΓΩΓΗ, ΠΗΓΕΣ, ΠΡΟΣΚΛΗΣΗ
// ─────────────────────────────────────────────────────────────────────────
// Τα ίδια μέρη με το app/PublicChrome.tsx (ToolLede, ToolSources, ToolCta).
// Οι πηγές λένε τους ίδιους νόμους με τα ίδια νούμερα· οι νόμοι λέγονται με
// τον αριθμό τους («Law 5246/2025»), χωρίς επινοημένο αγγλικό όνομα.
// ═══════════════════════════════════════════════════════════════════════════
import { TRIAL_DAYS } from '@/lib/billing/plans';
import { FIRST_YEAR_NEW_BRACKETS, FIRST_YEAR_BANK_RECEIPT, FIRST_MONTH_BANK_RECEIPT } from '@/lib/billing/greekTax';
import { PRESUMPTIVE_DEDUCTION_RATE } from '@/lib/billing/presumptive';
import { ELECTRICITY_VAT_PCT } from '@/lib/energy/tariff';
import { COMMERCIAL_RENT_CAP_2026 } from '@/lib/documents/rentAdjustment';
import { COMMERCIAL_STAMP_DUTY } from '@/lib/billing/commercialLease';
import { TRANSFER_TAX_MAIN_RATE, MUNICIPAL_SURCHARGE_RATE, NEW_BUILD_VAT_RATE } from '@/lib/accounting/transfer';
import { fmtFor } from '@/lib/core/format';
import { regulated } from '@/lib/legal/validity';

const f = fmtFor('en');
const pct = (n: number) => f.fpRate(n);
const firstOf = (y: number, m: number) => f.date(`${y}-${String(m).padStart(2, '0')}-01`);

export const TOOL_SHELL_EN = {
  eyebrow: 'Calculator',
  lede: 'The calculation runs on your device, with your own figures and no sign-up.',
  same: 'The same calculations as the PROPERWISE app. Indicative, not an official document.',
  law: (year: number) => `It applies Greek tax law for ${year}.`,
  sourcesLabel: 'Legal basis and sources',
  badge: 'Legal basis', badgeSources: 'Sources',
  checked: (d: string) => `Limits checked ${d}`,
  updated: (d: string) => `Last updated ${d}`,
  trialLine: `No subscription for one property, with Noa for the first ${TRIAL_DAYS} days.`,
  faqTitle: 'What people ask before they calculate',
  faqOver: 'FAQ',
  privacy: {
    q: 'Is my data stored?',
    a: 'No. The calculation runs on your device and we keep no amount in an account or database. Amounts go into the page address only so that you can share it; you need neither an email nor an account.',
  },
  byline: 'Text and examples: the Properwise team.',
};

/** Οι πηγές κάθε υπολογιστή (TOOL_SOURCES του PublicChrome), στα αγγλικά. */
export const TOOL_SOURCES_EN = {
  // Ο ίδιος νόμος και η ίδια υπουργική απόφαση με το RENO_39B_LAW / RENO_39B_KYA (lib/accounting/renovation39b.ts).
  reno: 'Article 39B of the Income Tax Code (Law 4172/2013), as replaced by Law 5073/2023 · Joint Ministerial Decision A.1153/2025 (Government Gazette B 5933/05.11.2025)',
  e2: 'Form E2 and the E1 codes it feeds, as applied by the app’s E2 engine',
  enfia: 'ENFIA: Article 4 of Law 4223/2013, as amended by Law 4916/2022 and codified in Law 5219/2025 · AADE objective values',
  rent: `Rental income brackets: Article 40 of the Income Tax Code (Law 4172/2013), new brackets from ${firstOf(FIRST_YEAR_NEW_BRACKETS, 1)} under Law 5246/2025 · `
    + `standard deduction ${pct(PRESUMPTIVE_DEDUCTION_RATE * 100)}: Article 39(3) of the Income Tax Code · collection through a bank: Article 210 of Law 5222/2025 (penalty from ${firstOf(FIRST_YEAR_BANK_RECEIPT, FIRST_MONTH_BANK_RECEIPT)})`,
  short: 'Climate crisis resilience fee: Law 5162/2024 · tax on rental income: Articles 39–40 of the Income Tax Code, brackets of Law 5246/2025 · short-term rental registry (AMA): AADE',
  yield: `Rental income brackets ${FIRST_YEAR_NEW_BRACKETS}: Law 5246/2025 · standard deduction ${pct(PRESUMPTIVE_DEDUCTION_RATE * 100)}: Article 39(3) of the Income Tax Code · ENFIA: Law 4223/2013, as in force and codified in Law 5219/2025`,
  loan: 'Debt-service-to-income limit: Bank of Greece, Executive Committee Act 227/1/08.03.2024 (in force from 1 Jan 2025) · '
    + 'average rate on new mortgages and Euribor: European Central Bank, with Bank of Greece data',
  buy: `Transfer tax ${pct(TRANSFER_TAX_MAIN_RATE * 100)} and municipal surcharge ${pct(MUNICIPAL_SURCHARGE_RATE * 100)}, first-home exemption: `
    + `Law 5219/2025, Articles 24 to 27 and 40 to 44 · VAT on new builds ${pct(NEW_BUILD_VAT_RATE * 100)}: VAT Code (Government Gazette A 162/2024), Articles 24 and 26, `
    + `suspended until ${f.date(regulated('new-build-vat-suspension').validTo)} (Article 70, Law 5246/2025)`,
  power: 'Prices: providers’ tariffs, cross-checked with the comparison tool of the energy regulator RAAEY (energycost.gr) · '
    + `ETMEAR levy: Law 4001/2011 · VAT ${pct(ELECTRICITY_VAT_PCT)} on electricity: VAT Code (Law 2859/2000)`,
  adjust: `Cap of ${pct(COMMERCIAL_RENT_CAP_2026.pct)} on rent increases in existing commercial leases (Presidential Decree 34/1995), `
    + `${f.date(COMMERCIAL_RENT_CAP_2026.from)} to ${f.date(COMMERCIAL_RENT_CAP_2026.to)}: Article 59 of Law 5255/2025 · Article 96 of Law 5007/2022 · `
    + 'CPI: ELSTAT announcement on rent adjustment (12-month change and 75% of it) · '
    + `Digital Transaction Duty ${pct(COMMERCIAL_STAMP_DUTY * 100)}: Article 6 of Law 5177/2025`,
};
