// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΔΗΜΟΣΙΟΙ ΥΠΟΛΟΓΙΣΜΟΙ ΣΤΑ ΑΓΓΛΙΚΑ: ΟΝΟΜΑ ΚΑΙ ΜΙΑ ΓΡΑΜΜΗ
// ─────────────────────────────────────────────────────────────────────────
// Ενα κλειδί ανά ελληνική διαδρομή του lib/core/publicTools.ts. Στη βιτρίνα
// φαίνονται ΜΟΝΟ όσοι έχουν ήδη αγγλική σελίδα (lib/i18n/paths.ts): ποτέ
// σύνδεσμος από αγγλική σελίδα προς ελληνική.
// ═══════════════════════════════════════════════════════════════════════════
import { PUBLIC_TOOLS } from '@/lib/core/publicTools';
import type { TopicId } from '@/lib/core/topics';
import { enPathFor } from '@/lib/i18n/paths';

const TOOL_EN: Record<string, { label: string; desc: string }> = {
  '/ypologismos-enfia': {
    label: 'ENFIA property tax',
    desc: 'The annual ENFIA on a Greek property, from its size, zone price, floor and age.',
  },
  '/ypologismos-ekptosis-anakainisis': {
    label: 'Renovation tax credit',
    desc: 'How much renovation services reduce your Greek income tax, year by year and in total, within each year’s cap.',
  },
  '/ypologismos-forou-enoikion': {
    label: 'Rental income tax',
    desc: 'Greek tax on rental income, with the year’s brackets and the standard deduction.',
  },
  '/kathari-apodosi': {
    label: 'Net rental yield',
    desc: 'Gross and net yield after tax, ENFIA and running costs.',
  },
  '/vraxyxronia-i-makroxronia': {
    label: 'Short-term or long-term',
    desc: 'What a short-term and a long-term let leave you with, after tax, the climate resilience fee and platform commission.',
  },
  '/anaprosarmogi-enoikiou': {
    label: 'Rent increase',
    desc: 'The new rent with a fixed rate or ELSTAT’s consumer price index, year by year, with the cap on commercial leases where it applies.',
  },
  '/symplirosi-e2': {
    label: 'Form E2, line by line',
    desc: 'What goes in each column of form E2 for a property, and which E1 code each amount feeds.',
  },
  '/exoda-agoras-akinitou': {
    label: 'Buying costs',
    desc: 'Transfer tax, VAT on new builds, fees and how much cash you need on top of the loan, with the source of every amount.',
  },
  '/ypologismos-stegastikou-daneiou': {
    label: 'Mortgage payment',
    desc: 'Monthly payment, interest and how large a mortgage your income allows.',
  },
  '/sygkrisi-timologion-revmatos': {
    label: 'Electricity tariffs',
    desc: 'What you would pay each month on every residential electricity tariff, with the date prices were checked.',
  },
};

export interface EnTool { href: string; label: string; desc: string; topic?: TopicId }

/** Οι υπολογισμοί με αγγλική σελίδα, στη σειρά του ελληνικού καταλόγου. */
export function enTools(): EnTool[] {
  return PUBLIC_TOOLS.flatMap(t => {
    const href = enPathFor(t.href);
    const copy = TOOL_EN[t.href];
    return href && copy ? [{ href, label: copy.label, desc: copy.desc, topic: t.topic }] : [];
  });
}

/** Οι ενότητες του κόμβου, στα αγγλικά. */
export const TOPIC_EN: Record<TopicId, string> = {
  enoikia: 'Rent, leases and short-term lets',
  enfia: 'ENFIA, deadlines and renovation',
  agora: 'Buying, mortgages and yield',
};
