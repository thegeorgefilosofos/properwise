// ═══════════════════════════════════════════════════════════════════════════
// Ο ΧΑΡΤΗΣ ΤΟΥ ΙΣΤΟΤΟΠΟΥ ΓΙΑ ΤΟΝ ΑΝΘΡΩΠΟ, ΑΠΟ ΤΙΣ ΙΔΙΕΣ ΠΗΓΕΣ ΜΕ ΤΟ sitemap.xml
// (ο σκελετός: σελίδες, ονόματα, ομάδες. Οι ημερομηνίες μπαίνουν στο
// app/siteCatalog.ts, ώστε το /llms.txt να μην κουβαλά τα μητρώα του
// app/pageUpdated.ts στη συνάρτησή του: docs/perf/server.json.)
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΕΙΝΑΙ (16/11/2026). Οι σελίδες του app/sitemap.ts σε ομάδες, με όνομα και
// ημερομηνία ενημέρωσης. Τις διαβάζουν η σελίδα /xartis (και η αγγλική της,
// /en/sitemap) και το /llms.txt (lib/seo/llms.ts).
//
// ΚΑΝΕΝΑΣ ΚΑΤΑΛΟΓΟΣ ΣΕΛΙΔΩΝ ΓΡΑΜΜΕΝΟΣ ΕΔΩ. Οι υπολογιστές έρχονται από το
// PUBLIC_TOOLS, οι οδηγοί από το LISTED_GUIDES, οι μήνες από το
// `upcomingMonths`, οι ημερομηνίες από το PAGE_UPDATED και το guides.ts: ό,τι
// διαβάζει και ο χάρτης. Με το χέρι μένει μόνο το ΟΝΟΜΑ των σελίδων που δεν
// έχουν κατάλογο (αρχική, πακέτα, νομικά), δεμένο με τη διαδρομή τους· νέα
// τέτοια σελίδα στον χάρτη χωρίς όνομα εδώ κόβεται από το
// app/siteCatalog.test.ts, που βάζει τις διευθύνσεις δίπλα στο sitemap().
// ═══════════════════════════════════════════════════════════════════════════
import { PUBLIC_TOOLS, TOOLS_HUB } from '@/lib/core/publicTools';
import { PROTHESMIES_PATH, deadlinesOfMonth, monthLabel, monthPath, upcomingMonths } from '@/lib/seo/prothesmies';
import { enPathFor } from '@/lib/i18n/paths';
import { enToolLabel } from '@/lib/i18n/en/tools';
import { enGuides } from '@/lib/i18n/en/guides';
import { LISTED_GUIDES } from './odigos/guides';

/** Η διαδρομή της σελίδας του χάρτη και της αγγλικής της (lib/i18n/paths.ts). */
export const XARTIS_PATH = '/xartis';

/**
 * Η εσωτερική διαδρομή όπου το next.config.ts ξαναγράφει το /xartis, μέσα στον
 * διανομέα του /en (χωρίς νέα συνάρτηση). Ο διαμεσολαβητής (proxy.ts) στέλνει
 * όποιον τη ζητήσει απευθείας στο /xartis.
 */
export const XARTIS_INTERNAL = '/en/_xartis';

export type MapGroupId = 'arxiki' | 'ergaleia' | 'odigoi' | 'prothesmies' | 'logistes' | 'logariasmos' | 'nomika';

/** Μία σελίδα του χάρτη, με τα δύο ονόματά της. */
export interface MapEntry {
  path: string;
  label: string;
  /** Η αγγλική σελίδα και το όνομά της, ή `null` όταν η σελίδα είναι μόνο ελληνική. */
  en: { path: string; label: string } | null;
  /** ISO· η ημερομηνία που δίνει και ο χάρτης (κενό όταν ο καλών δεν ζήτησε ημερομηνίες). */
  updated: string;
  /** Ο κόμβος της ομάδας («Όλα τα εργαλεία»). */
  hub?: true;
  /** Οι προθεσμίες του μήνα, μόνο για τους μήνες. */
  deadlines?: number;
  /** Η περιγραφή του καταλόγου, όπου υπάρχει (εργαλεία, οδηγοί). */
  desc?: string;
}

export interface MapGroup { id: MapGroupId; title: string; titleEn: string; entries: MapEntry[] }

// ── ΤΑ ΟΝΟΜΑΤΑ ΤΩΝ ΣΕΛΙΔΩΝ ΧΩΡΙΣ ΚΑΤΑΛΟΓΟ ────────────────────────────────────
// Ίδια με το υποσέλιδο (app/PublicChrome.tsx, lib/i18n/en/chrome.ts).
const NAMED = {
  '/': ['Αρχική', 'Home'],
  [TOOLS_HUB.href]: ['Όλα τα εργαλεία', 'All tools'],
  '/odigos': ['Όλοι οι οδηγοί', 'All guides'],
  [PROTHESMIES_PATH]: ['Όλες οι προθεσμίες', 'Tax deadlines'],
  '/logistes': ['Για λογιστές', 'For accountants'],
  '/paketa': ['Πακέτα και τιμές', 'Plans and pricing'],
  '/signup': ['Εγγραφή', 'Sign up'],
  '/trust': ['Ποιοι είμαστε', 'About us'],
  '/privacy': ['Πολιτική απορρήτου', 'Privacy policy'],
  '/terms': ['Όροι χρήσης', 'Terms of use'],
  [XARTIS_PATH]: ['Χάρτης ιστότοπου', 'Site map'],
} as const satisfies Record<string, readonly [string, string]>;
type Named = keyof typeof NAMED;

/** Η ημερομηνία μιας σελίδας από τη διαδρομή της· τη δίνει ο καλών. */
export type DateOf = (path: string) => string;

const named = (path: Named, dateOf: DateOf, hub?: true): MapEntry => {
  const [label, labelEn] = NAMED[path];
  const en = enPathFor(path);
  return { path, label, en: en ? { path: en, label: labelEn } : null, updated: dateOf(path), ...(hub && { hub }) };
};

const EN_GUIDE = new Map(enGuides().map(g => [g.el, g]));

/** Οι ομάδες χωρίς τη σελίδα του χάρτη: από αυτές βγαίνει και η ημερομηνία της. */
function contentGroups(today: string, dateOf: DateOf): MapGroup[] {
  return [
    // Η ΡΙΖΑ: η σελίδα τη δείχνει πάνω από τις ομάδες, ως αρχή του δέντρου.
    { id: 'arxiki', title: 'Αρχική', titleEn: 'Home', entries: [named('/', dateOf)] },
    {
      id: 'ergaleia', title: 'Εργαλεία', titleEn: 'Tools',
      entries: [
        named(TOOLS_HUB.href, dateOf, true),
        ...PUBLIC_TOOLS.map(t => {
          const en = enPathFor(t.href);
          return { path: t.href, label: t.label, desc: t.desc, updated: dateOf(t.href), en: en ? { path: en, label: enToolLabel(t.href) } : null };
        }),
      ],
    },
    {
      id: 'odigoi', title: 'Οδηγοί', titleEn: 'Guides',
      entries: [
        named('/odigos', dateOf, true),
        ...LISTED_GUIDES.map(g => {
          const en = EN_GUIDE.get(g.href);
          return { path: g.href, label: g.title, desc: g.desc, updated: dateOf(g.href), en: en ? { path: en.href, label: en.title } : null };
        }),
      ],
    },
    {
      id: 'prothesmies', title: 'Προθεσμίες ανά μήνα', titleEn: 'Tax deadlines',
      entries: [
        named(PROTHESMIES_PATH, dateOf, true),
        ...upcomingMonths(today).map(m => ({ path: monthPath(m), label: monthLabel(m), updated: dateOf(monthPath(m)), deadlines: deadlinesOfMonth(m).length, en: null })),
      ],
    },
    { id: 'logistes', title: 'Για λογιστές', titleEn: 'For accountants', entries: [named('/logistes', dateOf)] },
    {
      id: 'logariasmos', title: 'Λογαριασμός', titleEn: 'Account',
      entries: [named('/paketa', dateOf), named('/signup', dateOf)],
    },
    {
      id: 'nomika', title: 'Νομικά και εμπιστοσύνη', titleEn: 'Legal and trust',
      entries: [named('/trust', dateOf), named('/privacy', dateOf), named('/terms', dateOf)],
    },
  ];
}

/** Όλες οι ομάδες, με τον ίδιο τον χάρτη στα «Νομικά και εμπιστοσύνη». */
export function buildCatalog(today: string, dateOf: DateOf): MapGroup[] {
  return contentGroups(today, dateOf).map(g => g.id === 'nomika' ? { ...g, entries: [...g.entries, named(XARTIS_PATH, dateOf)] } : g);
}

/** Η ελληνική εκδοχή κάθε ομάδας: όλες οι σελίδες. */
export const catalogEntries = (groups: readonly MapGroup[]): MapEntry[] => groups.flatMap(g => g.entries);

/** Πόσες σελίδες έχει ο χάρτης σε κάθε γλώσσα. */
export function catalogCounts(groups: readonly MapGroup[]): { el: number; en: number } {
  const all = catalogEntries(groups);
  return { el: all.length, en: all.filter(e => e.en).length };
}
