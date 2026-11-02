'use client';
// Η γλώσσα της σελίδας στον περιηγητή: από τη διαδρομή, όπως και στη ρίζα
// (lib/i18n/locale.ts). Χωρίς Provider και χωρίς prop: η ίδια οθόνη ξέρει αν
// σερβίρεται κάτω από το /en.
import { usePathname } from 'next/navigation';
import { localeOfPath, type Locale } from './locale';

export function useLocale(): Locale {
  return localeOfPath(usePathname());
}
