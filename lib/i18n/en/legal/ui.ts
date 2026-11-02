// Οι λέξεις του νομικού κελύφους (app/legal-shell.tsx) στα αγγλικά. Και η
// σημείωση της μετάφρασης που μπαίνει στην κορυφή κάθε αγγλικής νομικής σελίδας.
import { fmtFor } from '@/lib/core/format';

const EN_MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;

/** «October 2026» από «2026-10». */
export const monthYearEn = (ym: string): string => {
  const [y, m] = ym.split('-').map(Number);
  return `${EN_MONTHS_LONG[m - 1]} ${y}`;
};

export const LEGAL_UI_EN = {
  eyebrow: 'Legal',
  contents: 'Contents',
  // Ιδια σειρά με το TRUST_PAGES του κελύφους: «Ποιοι είμαστε», «Πολιτική απορρήτου», «Όροι χρήσης».
  pages: ['About us', 'Privacy Policy', 'Terms of use'] as const,
  updated: (when: string) => `Last updated: ${when}`,
  version: (iso: string, when: string) => `Version ${fmtFor('en').date(iso)} · Last updated: ${when}`,
  notice: 'This translation is provided for convenience. The Greek version is the legally binding text.',
  greekLink: 'Read the Greek version',
};
