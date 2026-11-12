import type { Metadata } from 'next';
import { siteUrl } from '@/lib/core/site';
import { POLICY_VERSION, POLICY_DATE } from '@/lib/legal/identity';
import { PRIVACY_EN, privacySectionsEn } from '@/lib/i18n/en/legal/privacy';
import { monthYearEn } from '@/lib/i18n/en/legal/ui';
import { LegalShell } from '../../legal-shell';
import { publicMetadata } from '../../publicMetadata';
import { TranslationNotice } from '../../TranslationNotice';

// Η Πολιτική απορρήτου στα αγγλικά: μετάφραση για διευκόλυνση, δεσμευτικό το
// ελληνικό (app/privacy/page.tsx). Ιδιο κέλυφος, ίδιες ενότητες, ίδιες πηγές.
export const metadata: Metadata = publicMetadata({ title: PRIVACY_EN.metaTitle, description: PRIVACY_EN.description, url: siteUrl('/en/privacy') });

export default function PrivacyPageEn() {
  return (
    <LegalShell
      locale="en"
      self="/en/privacy"
      notice={<TranslationNotice greekHref="/privacy" />}
      title={PRIVACY_EN.title}
      updated={monthYearEn(POLICY_DATE.slice(0, 7))}
      version={POLICY_VERSION}
      intro={PRIVACY_EN.intro}
      sections={privacySectionsEn()}
    />
  );
}
