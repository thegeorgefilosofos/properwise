// Ο πίνακας του λογαριασμού είναι `'use client'` και δεν μπορεί να δηλώσει
// μεταδεδομένα· το layout του διακομιστή τα δίνει. Χωρίς αυτό η σελίδα
// κληρονομούσε από τη ρίζα ευρετηρίαση και `canonical: "/"`. Ο λόγος και η μία
// δήλωση ζουν στο lib/seo/noindex.ts. Χωρίς τίτλο, επίτηδες: η καρτέλα μένει
// όπως ήταν.
//
// Η ΓΛΩΣΣΑ ΤΗΣ ΕΦΑΡΜΟΓΗΣ: ό,τι έγραψε το proxy.ts από την επιλογή του χρήστη
// (lib/i18n/locale.ts, appLocale), η ίδια ανάγνωση με το `<html lang>` της
// ρίζας. Ο πάροχος τη δίνει στο `useLocale()` και στο `useAppEn()`.
import { requestLocale } from '@/lib/i18n/serverLocale';
import { AppLocaleProvider } from '@/lib/i18n/appEn';

export { NOINDEX as metadata } from '@/lib/seo/noindex';

export default async function Layout({ children }: { children: React.ReactNode }) {
  return <AppLocaleProvider locale={await requestLocale()}>{children}</AppLocaleProvider>;
}
