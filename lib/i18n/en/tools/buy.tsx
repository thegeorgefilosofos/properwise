// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΕΞΟΔΑ ΑΓΟΡΑΣ ΣΤΑ ΑΓΓΛΙΚΑ (/en/property-purchase-costs)
// ─────────────────────────────────────────────────────────────────────────
// Ο ίδιος υπολογισμός (lib/tools/exodaAgoras.ts) και οι ίδιες πηγές με το
// app/exoda-agoras-akinitou/lines.tsx· εδώ μόνο λέξεις και αγγλική γραφή αριθμών.
// ═══════════════════════════════════════════════════════════════════════════
import type { ReactNode } from 'react';
import { fmtFor } from '@/lib/core/format';
import {
  TRANSFER_TAX_MAIN_RATE, MUNICIPAL_SURCHARGE_RATE, NEW_BUILD_VAT_RATE, SERVICES_VAT_RATE,
} from '@/lib/accounting/transfer';
import type { PurchaseLine, PurchaseResult, SourceKey } from '@/lib/tools/exodaAgoras';
import type { LedgerRow } from '@/app/ToolParts';
import { SOURCES } from '@/app/exoda-agoras-akinitou/lines';

const f = fmtFor('en');
const SRC = { color: 'inherit', textDecoration: 'underline', textUnderlineOffset: 2 } as const;
export const MAIN_PCT_EN = f.fpRate(TRANSFER_TAX_MAIN_RATE * 100);
export const MUNICIPAL_PCT_EN = f.fpRate(MUNICIPAL_SURCHARGE_RATE * 100);
export const VAT_PCT_EN = f.fpRate(NEW_BUILD_VAT_RATE * 100);
export const SERVICES_VAT_PCT_EN = f.fpRate(SERVICES_VAT_RATE * 100);

// Οι ίδιες πηγές (SOURCES του lines.tsx), με τα ίδια άρθρα, στα αγγλικά.
const SOURCE_EN: Record<Exclude<SourceKey, 'user'>, string> = {
  transferTax: 'Law 5219/2025, Articles 25 and 27',
  newBuildVat: 'VAT Code, Articles 24 and 26',
  servicesVat: 'VAT Code, Article 26',
};

const LABEL: Record<PurchaseLine['key'], string> = {
  transferTax: 'Transfer tax',
  vat: `VAT on new build ${VAT_PCT_EN}`,
  cadastre: 'Land registry fees',
  agent: 'Agent’s fee',
  notary: 'Notary',
  lawyer: 'Lawyer',
  other: 'Other costs',
};

const MISSING_NAME: Record<PurchaseResult['missing'][number], string> = {
  cadastre: 'land registry fees', agent: 'the agent’s fee', notary: 'the notary’s fee', lawyer: 'the lawyer’s fee',
};

const listEn = (items: readonly string[]) =>
  items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

export function missingSentenceEn(r: PurchaseResult): string | null {
  if (!r.missing.length) return null;
  const names = listEn(r.missing.map(m => MISSING_NAME[m]));
  return `Not included: ${names}. Enter the amounts from your quotes to add them to the total.`;
}

function Source({ k }: { k: SourceKey }) {
  if (k === 'user') return <>As you entered it.</>;
  return <>Source: <a href={SOURCES[k].href} target="_blank" rel="noopener noreferrer" hrefLang="el" className="lp-link" style={SRC}>{SOURCE_EN[k]}</a> (Greek).</>;
}

function basis(l: PurchaseLine, r: PurchaseResult, agentPct: number): ReactNode {
  switch (l.key) {
    case 'transferTax':
      return <>
        {MAIN_PCT_EN} on {f.fe(r.taxBase)}, the higher of price and objective value
        {r.exemption > 0 ? <>, after the first-home exemption of up to {f.feWhole(r.exemption)} (Article 41)</> : null},
        {' '}plus {MUNICIPAL_PCT_EN} of the tax for municipalities.{' '}
      </>;
    case 'vat':
      return <>{VAT_PCT_EN} on the price of {f.fe(r.price)}, instead of transfer tax.{' '}</>;
    case 'cadastre':
    case 'agent':
      return <>{f.fpRate(agentPct)} of the price, {f.fe(l.net ?? 0)}, plus VAT {SERVICES_VAT_PCT_EN}. You agree the rate yourself.{' '}</>;
    case 'notary':
    case 'lawyer':
      return <>{f.fe(l.net ?? 0)} before VAT, as quoted, plus VAT {SERVICES_VAT_PCT_EN}.{' '}</>;
    case 'other':
      return null;
  }
}

export function ledgerRowsEn(r: PurchaseResult, agentPct: number): LedgerRow[] {
  return [
    ...r.lines.map(l => ({
      k: LABEL[l.key], v: f.fe(l.amount),
      sub: <>{basis(l, r, agentPct)}<Source k={l.source}/></>,
    })),
    { k: 'Total buying costs', v: f.fe(r.total), kind: 'total' as const },
  ];
}

export const BUY_EN = {
  yes: 'Yes', no: 'No',
  property: 'The property', price: 'Price', priceHint: 'The amount on the contract.',
  objective: 'Objective value',
  objectiveHint: 'If it is higher than the price, tax is calculated on it. Leave blank: same as the price.',
  newBuild: 'New build from a developer?',
  suspended: 'Is the developer under VAT suspension?',
  suspendedHint: (until: string) => `The suspension is granted at the developer’s request and applies until ${until}: in that case you pay transfer tax. Without suspension you pay VAT of ${VAT_PCT_EN} on the price. Ask the seller which applies.`,
  firstHome: 'First home', exemption: 'First-home exemption?',
  exemptionHint: 'There are conditions, including not already owning a home that meets your needs and keeping the property for five years.',
  married: 'Married or in a civil partnership?', children: 'Children',
  fees: 'Fees and charges',
  cadastre: 'Land registry',
  cadastreHint: ['The amount given by the ', 'Hellenic Cadastre', ' or the notary. The calculator does not add an amount of its own.'] as const,
  agent: 'Agent’s fee', agentHint: `Percentage of the price before VAT; VAT of ${SERVICES_VAT_PCT_EN} is added. Zero without an agent.`,
  notary: 'Notary', notaryHint: 'The quoted amount before VAT. The calculator does not add an amount of its own.',
  lawyer: 'Lawyer', lawyerHint: 'Before VAT. Zero if you do not hire a lawyer.',
  other: 'Other costs', otherHint: 'Certificates, engineer, valuation, as you pay them.',
  finance: 'Financing', loan: 'Loan', loanHint: 'Zero if you are buying with cash.',
  paper: 'Property buying costs',
  pBase: 'Tax base', pKind: 'Type', used: 'Resale', newSuspended: 'New build, VAT suspended', newVat: 'New build, with VAT',
  costs: 'Buying costs', needPrice: 'Enter the price to see the costs.',
  share: 'Of the price', cash: 'Cash on top of the loan',
  say: (t: string, c: string) => `Buying costs ${t}. Cash on top of the loan ${c}.`,
  downPayment: 'Down payment', cashNeeded: 'Cash you need',
  cashNote: 'The calculation assumes the loan covers only the price and that the costs are paid from your own money. It does not include loan costs (application, valuation, lien registration).',
  cashMortgage: (loan: string) => [`The monthly payment on ${loan} is shown by the `, 'mortgage calculator', '.'] as const,
  notLead: 'What it includes and what it doesn’t.',
  not: 'Transfer tax and VAT on new builds come from the statutory rates, with the source under each line. Land registry fees and the agent’s, notary’s and lawyer’s fees go in as you enter them. Exemption limits for disability and the purchase of land are not included.',
};

export const BUY_PAGE_EN = {
  title: 'Property buying costs in Greece: transfer tax, VAT and fees',
  h1: 'What it costs to buy a property in Greece, on top of the price',
  description: 'Transfer tax, VAT on new builds, notary, agent and land registry fees, and how much cash you need on top of the loan. With the source of every amount.',
  lede: 'Transfer tax or VAT, fees and how much cash you need besides the loan, with the legal source under every line.',
  ctaTitle: 'Want the costs, the loan and the property kept together?',
  ctaBody: 'PROPERWISE keeps the purchase costs with the property and the loan, so your yield starts from what you actually paid.',
};

export function buyFaqEn(x: { vatUntil: string }) {
  return [
    {
      q: 'What is the transfer tax on a property in Greece?',
      a: `${MAIN_PCT_EN} on the higher of the price and the objective value, plus ${MUNICIPAL_PCT_EN} of that tax for municipalities (Law 5219/2025). A first-home exemption applies under conditions.`,
    },
    {
      q: 'Do new builds pay VAT?',
      a: `New builds sold by a developer are subject to VAT of ${VAT_PCT_EN}. At the developer’s request, VAT is suspended until ${x.vatUntil} and you pay transfer tax instead (Article 70, as amended by Law 5246/2025). Ask the seller whether the suspension applies.`,
    },
    {
      q: 'What is the objective value?',
      a: 'The value the Greek state sets for each property from the zone price, size and features. Transfer tax is calculated on it when it is higher than the agreed price.',
    },
    {
      q: 'Why are notary and land registry fees not filled in?',
      a: 'Because they depend on the quote and the specific property. The calculator uses only what you enter, so the total never includes a guessed amount.',
    },
  ];
}
