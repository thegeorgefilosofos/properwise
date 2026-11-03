// Σελίδα που ανοίγει με κρυπτογραφικό σύνδεσμο: εκτός ευρετηρίου, πάντα.
// Ο λόγος και η μία δήλωση ζουν στο lib/seo/noindex.ts.
//
// ΙΔΙΑ ΔΙΕΥΘΥΝΣΗ ΚΑΙ ΣΤΑ ΑΓΓΛΙΚΑ (lib/i18n/locale.ts, isRecipientPath).
import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { noindexPage } from '@/lib/seo/noindex';
import { requestLocale } from '@/lib/i18n/serverLocale';
import { CONFIRM_EMAIL_EN , RECIPIENT_COPY_EN } from '@/lib/i18n/en/recipients';
import RecipientCopy from '@/app/RecipientCopy';

export async function generateMetadata(): Promise<Metadata> {
  return (await requestLocale()) === 'en'
    ? noindexPage(CONFIRM_EMAIL_EN.metaTitle, CONFIRM_EMAIL_EN.metaDescription)
    : noindexPage('Επιβεβαίωση διεύθυνσης', 'Επιβεβαίωση της διεύθυνσης για τις υπενθυμίσεις του PROPERWISE.');
}

export default async function Layout({ children }: { children: ReactNode }) {
  return (await requestLocale()) === 'en' ? <RecipientCopy value={{ recipient: RECIPIENT_COPY_EN }}>{children}</RecipientCopy> : children;
}
