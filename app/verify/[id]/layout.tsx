// Σελίδα που ανοίγει με κρυπτογραφικό σύνδεσμο: εκτός ευρετηρίου, πάντα.
// Ο λόγος και η μία δήλωση ζουν στο lib/seo/noindex.ts.
//
// ΙΔΙΑ ΔΙΕΥΘΥΝΣΗ ΚΑΙ ΣΤΑ ΑΓΓΛΙΚΑ (lib/i18n/locale.ts, isRecipientPath).
import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { noindexPage } from '@/lib/seo/noindex';
import { requestLocale } from '@/lib/i18n/serverLocale';
import { VERIFY_EN , RECIPIENT_COPY_EN } from '@/lib/i18n/en/recipients';
import RecipientCopy from '@/app/RecipientCopy';

export async function generateMetadata(): Promise<Metadata> {
  return (await requestLocale()) === 'en'
    ? noindexPage(VERIFY_EN.title, VERIFY_EN.metaDescriptionId)
    : noindexPage('Επαλήθευση εγγράφου', 'Έλεγχος ότι ένα έγγραφο είναι καταχωρημένο στο μητρώο του PROPERWISE και δεν άλλαξε από την έκδοση.');
}

export default async function Layout({ children }: { children: ReactNode }) {
  return (await requestLocale()) === 'en' ? <RecipientCopy value={{ recipient: RECIPIENT_COPY_EN }}>{children}</RecipientCopy> : children;
}
