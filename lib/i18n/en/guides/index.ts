// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΟΔΗΓΟΙ ΣΤΑ ΑΓΓΛΙΚΑ: ΚΑΤΑΛΟΓΟΣ
// ─────────────────────────────────────────────────────────────────────────
// Ενας οδηγός ανά ελληνικό οδηγό που έχει αγγλική σελίδα (lib/i18n/paths.ts).
// Οι ημερομηνίες δημοσίευσης και ενημέρωσης είναι του ελληνικού οδηγού
// (app/odigos/guides.ts): η αγγλική απόδοση ακολουθεί το ίδιο περιεχόμενο.
// ═══════════════════════════════════════════════════════════════════════════
import type { TopicId } from '@/lib/core/topics';
import { enPathFor } from '@/lib/i18n/paths';

export interface EnGuide { el: string; title: string; desc: string; topic: TopicId }

const GUIDES_EN: readonly EnGuide[] = [
  {
    el: '/odigos/forologia-enoikion-2026', topic: 'enoikia',
    title: 'Greek rental income tax in 2026',
    desc: 'The new brackets, the standard deduction and the rule on collecting rent through a bank, with worked examples.',
  },
  {
    el: '/odigos/pos-ypologizetai-o-enfia', topic: 'enfia',
    title: 'How ENFIA is calculated',
    desc: 'Greece’s annual property tax, step by step: zone price, floor area, floor, age, reductions and surcharge.',
  },
  {
    el: '/odigos/kathari-apodosi-akinitou', topic: 'agora',
    title: 'Net rental yield on a Greek property',
    desc: 'From gross to net: income tax, ENFIA and running costs, and why the gap is larger than it looks.',
  },
  {
    el: '/odigos/enfia-2026-pliromi-doseis-pistopoiitiko', topic: 'enfia',
    title: 'ENFIA 2026: payment, instalments and the certificate',
    desc: 'When each instalment is due, where to pay on myAADE, how to get an ENFIA certificate for a sale and who finalizes it.',
  },
  {
    el: '/odigos/airbnb-takk-2026', topic: 'enoikia',
    title: 'Airbnb tax in Greece in 2026',
    desc: 'The climate resilience fee per night, what changes on November 1, how to file it on myAADE and how the income is taxed.',
  },
  {
    el: '/odigos/vraxyxronia-ama-prodiagrafes-2026', topic: 'enoikia',
    title: 'Short-term rentals in Greece: the AMA registry and requirements',
    desc: 'The freeze on new registrations in central Athens and Thessaloniki, why the AMA doesn’t transfer, safety requirements and fines.',
  },
];

/** Οι οδηγοί με αγγλική σελίδα, με τη διαδρομή της. */
export const enGuides = () => GUIDES_EN.flatMap(g => {
  const href = enPathFor(g.el);
  return href ? [{ ...g, href }] : [];
});

export const GUIDES_HUB_EN = {
  title: 'Guides to Greek property tax and costs',
  h1: 'Guides for property owners in Greece',
  description: 'Plain-English guides to Greek rental income tax, ENFIA property tax and net rental yield, with figures taken from the law and worked examples.',
  lede: 'What Greek law says about rent, property tax and yield, in plain English, with every figure from the same code our calculators use.',
  eyebrow: 'Guides',
  more: 'More guides are available in Greek.',
  greekHub: 'All guides (Greek)',
};

export const GUIDE_SHELL_EN = {
  eyebrow: 'Guide',
  updated: 'Last updated',
  sources: 'Sources',
  toc: 'In this guide',
  sourcesTitle: 'Legal basis and sources',
  faqOver: 'FAQ',
  calcOver: 'Calculate',
  calcNote: 'With your own figures, no sign-up.',
  related: 'More guides',
  disclaimer: 'This guide, like every linked calculator, is indicative. It is not an official AADE assessment, tax advice or a substitute for an accountant.',
  translated: 'Adapted in English from our Greek guide.',
  readGreek: 'Read the Greek version',
};
