// ═══════════════════════════════════════════════════════════════════════════
// ΚΑΘΕ ΓΡΑΜΜΗ ΜΕ ΤΗ ΒΑΣΗ ΚΑΙ ΤΗΝ ΠΗΓΗ ΤΗΣ
// ─────────────────────────────────────────────────────────────────────────
// Η ανάλυση των εξόδων γράφει κάτω από κάθε ποσό από τι βγήκε και ποιο κείμενο
// το ορίζει, με σύνδεσμο στο ΦΕΚ. Ζει εδώ, χωρίς hooks, ώστε την ίδια ανάλυση
// να αποδίδουν και ο υπολογιστής και το λυμένο παράδειγμα της σελίδας.
//
// ΚΑΝΕΝΑ ΠΟΣΟΣΤΟ ΓΡΑΜΜΕΝΟ ΜΕ ΤΟ ΧΕΡΙ. Ο,τι γράφεται βγαίνει από τις σταθερές
// του lib/accounting/transfer.ts, τις ίδιες που υπολογίζουν (guard-tax-literals).
// ═══════════════════════════════════════════════════════════════════════════
import type { ReactNode } from 'react';
import { fe, feWhole, fpRate } from '@/lib/core/format';
import {
  TRANSFER_TAX_MAIN_RATE, MUNICIPAL_SURCHARGE_RATE, NEW_BUILD_VAT_RATE, SERVICES_VAT_RATE,
} from '@/lib/accounting/transfer';
import type { PurchaseLine, PurchaseResult, SourceKey } from '@/lib/tools/exodaAgoras';
import type { LedgerRow } from '../ToolParts';
import { LAW_5219_PDF, LAW_5144_PDF } from '../odigos/fek';

const SRC = { color: 'inherit', textDecoration: 'underline', textUnderlineOffset: 2 } as const;

export const MAIN_PCT = fpRate(TRANSFER_TAX_MAIN_RATE * 100);
export const MUNICIPAL_PCT = fpRate(MUNICIPAL_SURCHARGE_RATE * 100);
export const VAT_PCT = fpRate(NEW_BUILD_VAT_RATE * 100);
export const SERVICES_VAT_PCT = fpRate(SERVICES_VAT_RATE * 100);
/**
 * Το Κτηματολόγιο, για τα τέλη του. Ο υπολογιστής δεν βάζει ποσό: το 5‰ της
 * ΚΥΑ 2/2026 δεν επαληθεύτηκε στο ΦΕΚ (βλ. lib/tools/exodaAgoras.ts). Η αρχική
 * σελίδα, όπως και στον οδηγό δανείου (LoanGuide).
 */
export const CADASTRE_HOME = 'https://www.ktimatologio.gr';

/** Η επίσημη πηγή κάθε είδους γραμμής, σε λέξεις και σύνδεσμο. */
export const SOURCES: Record<Exclude<SourceKey, 'user'>, { text: string; href: string }> = {
  transferTax: { text: 'ν.5219/2025, άρθρα 25 και 27', href: LAW_5219_PDF },
  newBuildVat: { text: 'Κώδικας ΦΠΑ, άρθρα 24 και 26', href: LAW_5144_PDF },
  servicesVat: { text: 'Κώδικας ΦΠΑ, άρθρο 26', href: LAW_5144_PDF },
};

const LABEL: Record<PurchaseLine['key'], string> = {
  transferTax: 'Φόρος μεταβίβασης',
  vat: `ΦΠΑ νεόδμητου ${VAT_PCT}`,
  cadastre: 'Τέλη Κτηματολογίου',
  agent: 'Μεσιτική αμοιβή',
  notary: 'Συμβολαιογράφος',
  lawyer: 'Δικηγόρος',
  other: 'Λοιπά έξοδα',
};

/** Τα ονόματα όσων δεν συμπληρώθηκαν, για την πρόταση «δεν περιλαμβάνονται». */
const MISSING_NAME: Record<PurchaseResult['missing'][number], string> = {
  cadastre: 'τα τέλη του Κτηματολογίου', agent: 'η μεσιτική αμοιβή', notary: 'η αμοιβή του συμβολαιογράφου', lawyer: 'η αμοιβή του δικηγόρου',
};

/** «α, β και γ», χωρίς κόμμα πριν από το «και». */
export function listGr(items: readonly string[]): string {
  return items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} και ${items[items.length - 1]}`;
}

/** Η πρόταση για όσα έμειναν μηδέν, ή `null` όταν συμπληρώθηκαν όλα. */
export function missingSentence(r: PurchaseResult): string | null {
  if (!r.missing.length) return null;
  const names = listGr(r.missing.map(m => MISSING_NAME[m]));
  const verb = r.missing.length === 1 ? 'Δεν περιλαμβάνεται' : 'Δεν περιλαμβάνονται';
  return `${verb} ${names}: γράψε τα ποσά των προσφορών σου για να μπουν στο σύνολο.`;
}

function Source({ k }: { k: SourceKey }) {
  if (k === 'user') return <>Όπως το έγραψες.</>;
  const s = SOURCES[k];
  return <>Πηγή: <a href={s.href} target="_blank" rel="noopener noreferrer" className="lp-link" style={SRC}>{s.text}</a>.</>;
}

/** Από τι βγήκε το ποσό της γραμμής, με τους αριθμούς της. */
function basis(l: PurchaseLine, r: PurchaseResult, agentPct: number): ReactNode {
  switch (l.key) {
    case 'transferTax':
      return <>
        {MAIN_PCT} επί {fe(r.taxBase)}, της μεγαλύτερης από τίμημα και αντικειμενική
        {r.exemption > 0 ? <>, μετά την απαλλαγή πρώτης κατοικίας έως {feWhole(r.exemption)} (άρθρο 41)</> : null},
        {' '}συν {MUNICIPAL_PCT} του φόρου υπέρ των Δήμων.{' '}
      </>;
    case 'vat':
      return <>{VAT_PCT} επί του τιμήματος {fe(r.price)}, αντί για φόρο μεταβίβασης.{' '}</>;
    case 'cadastre':
    case 'agent':
      return <>{fpRate(agentPct)} του τιμήματος, {fe(l.net ?? 0)}, συν ΦΠΑ {SERVICES_VAT_PCT}. Το ποσοστό το συμφωνείς εσύ.{' '}</>;
    case 'notary':
    case 'lawyer':
      return <>{fe(l.net ?? 0)} χωρίς ΦΠΑ, όπως στην προσφορά, συν ΦΠΑ {SERVICES_VAT_PCT}.{' '}</>;
    case 'other':
      return null;
  }
}

/** Οι γραμμές της ανάλυσης, με το σύνολο στο τέλος. */
export function ledgerRows(r: PurchaseResult, agentPct: number): LedgerRow[] {
  return [
    ...r.lines.map(l => ({
      k: LABEL[l.key], v: fe(l.amount),
      sub: <>{basis(l, r, agentPct)}<Source k={l.source}/></>,
    })),
    { k: 'Σύνολο εξόδων αγοράς', v: fe(r.total), kind: 'total' as const },
  ];
}
