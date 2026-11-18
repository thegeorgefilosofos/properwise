'use client';
// Η γλώσσα της σελίδας στον περιηγητή: από τη διαδρομή, όπως και στη ρίζα
// (lib/i18n/locale.ts). Χωρίς Provider και χωρίς prop: η ίδια οθόνη ξέρει αν
// σερβίρεται κάτω από το /en.
//
// Η ΜΙΑ ΕΞΑΙΡΕΣΗ ΕΙΝΑΙ Η ΕΦΑΡΜΟΓΗ. Ο πίνακας κρατά τη διεύθυνσή του και η
// γλώσσα του έρχεται από την επιλογή του χρήστη (lib/i18n/locale.ts,
// appLocale). Το layout του τη δηλώνει εδώ, ώστε κάθε κοινό component
// (`fmtFor(useLocale())`) να ακολουθεί χωρίς να ξέρει πού βρίσκεται.
import { createContext, useContext } from 'react';
import { usePathname } from 'next/navigation';
import { localeOfPath, type Locale } from './locale';

/** Η γλώσσα που δηλώνει μια σελίδα χωρίς ζεύγος /en (η εφαρμογή). */
export const LocaleOverrideContext = createContext<Locale | null>(null);

export function useLocale(): Locale {
  const override = useContext(LocaleOverrideContext);
  const path = usePathname();
  return override ?? localeOfPath(path);
}
