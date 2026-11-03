// Σελίδα που ανοίγει με κρυπτογραφικό σύνδεσμο: εκτός ευρετηρίου, πάντα.
// Ο λόγος και η μία δήλωση ζουν στο lib/seo/noindex.ts.
//
// ΙΔΙΑ ΔΙΕΥΘΥΝΣΗ ΚΑΙ ΣΤΑ ΑΓΓΛΙΚΑ. Η γλώσσα του αιτήματος (lib/i18n/locale.ts,
// isRecipientPath) διαλέγει το κείμενο: στα αγγλικά η σελίδα τυλίγεται στον
// πάροχο του app/RecipientCopy.tsx με το λεξικό ως τιμή, στα ελληνικά μένει
// ακριβώς όπως ήταν.
import type { ReactNode } from 'react';
import { requestLocale } from '@/lib/i18n/serverLocale';
import { RECIPIENT_COPY_EN } from '@/lib/i18n/en/recipients';
import RecipientCopy from '@/app/RecipientCopy';
export { NOINDEX as metadata } from '@/lib/seo/noindex';

export default async function Layout({ children }: { children: ReactNode }) {
  return (await requestLocale()) === 'en' ? <RecipientCopy value={{ recipient: RECIPIENT_COPY_EN }}>{children}</RecipientCopy> : children;
}
