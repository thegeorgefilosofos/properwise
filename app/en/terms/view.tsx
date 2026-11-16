import type { Metadata } from 'next';
import { siteUrl } from '@/lib/core/site';
import { POLICY_VERSION, POLICY_DATE } from '@/lib/legal/identity';
import { TERMS_EN, termsSectionsEn, termsDisclaimerEn } from '@/lib/i18n/en/legal/terms';
import { monthYearEn } from '@/lib/i18n/en/legal/ui';
import { LegalShell } from '../../legal-shell';
import { publicMetadata } from '../../publicMetadata';
import { TranslationNotice } from '../../TranslationNotice';

// Οι Όροι χρήσης στα αγγλικά: μετάφραση για διευκόλυνση, δεσμευτικό το
// ελληνικό (app/terms/page.tsx). Ιδιο κέλυφος, ίδιες ενότητες, ίδιες πηγές.
export const metadata: Metadata = publicMetadata({ title: TERMS_EN.metaTitle, description: TERMS_EN.description, url: siteUrl('/en/terms') });

export default function TermsPageEn() {
  return (
    <LegalShell
      locale="en"
      self="/en/terms"
      notice={<TranslationNotice greekHref="/terms" />}
      title={TERMS_EN.title}
      updated={monthYearEn(POLICY_DATE.slice(0, 7))}
      version={POLICY_VERSION}
      intro={TERMS_EN.intro}
      sections={termsSectionsEn()}
      disclaimer={termsDisclaimerEn()}
    />
  );
}
