// ═══════════════════════════════════════════════════════════════════════════
// Ο ΚΑΤΑΛΟΓΟΣ ΤΟΥ ΧΑΡΤΗ ΜΕ ΤΙΣ ΗΜΕΡΟΜΗΝΙΕΣ ΤΟΥ (/xartis, /en/sitemap)
// ─────────────────────────────────────────────────────────────────────────
// Ο σκελετός ζει στο app/siteCatalogCore.ts· εδώ μπαίνει η ημερομηνία κάθε
// σελίδας, από τις ίδιες πηγές με το app/sitemap.ts: PAGE_UPDATED, ο κόμβος
// των εργαλείων και των οδηγών, το `updated` κάθε οδηγού, οι προθεσμίες.
// ═══════════════════════════════════════════════════════════════════════════
import { TOOLS_HUB } from '@/lib/core/publicTools';
import { PROTHESMIES_PATH, PROTHESMIES_UPDATED } from '@/lib/seo/prothesmies';
import { athensToday } from '@/lib/core/time';
import { LISTED_GUIDES, GUIDES_UPDATED } from './odigos/guides';
import { PAGE_UPDATED, TOOLS_UPDATED } from './pageUpdated';
import { XARTIS_UPDATED } from './xartisUpdated';
import { buildCatalog, XARTIS_PATH, type MapGroup } from './siteCatalogCore';
import { HUBS, hubPath, METHOD_PATH } from './thema/hubs';
import { hubUpdated, METHOD_UPDATED } from './thema/hubDates';

export { XARTIS_UPDATED };
export { XARTIS_PATH, XARTIS_INTERNAL, catalogEntries, catalogCounts, type MapEntry, type MapGroup, type MapGroupId } from './siteCatalogCore';

const GUIDE_DATE = new Map(LISTED_GUIDES.map(g => [g.href, g.updated]));
const HUB_DATE = new Map(HUBS.map(h => [hubPath(h), hubUpdated(h)]));

/** Η ημερομηνία κάθε σελίδας του χάρτη. Σελίδα χωρίς πηγή σπάει το χτίσιμο. */
function dateOf(path: string): string {
  if (path === TOOLS_HUB.href) return TOOLS_UPDATED;
  if (path === '/odigos') return GUIDES_UPDATED;
  if (path === PROTHESMIES_PATH || path.startsWith(`${PROTHESMIES_PATH}/`)) return PROTHESMIES_UPDATED;
  if (path === XARTIS_PATH) return XARTIS_UPDATED;
  if (path === METHOD_PATH) return METHOD_UPDATED;
  const hub = HUB_DATE.get(path);
  if (hub) return hub;
  const d = GUIDE_DATE.get(path) ?? (PAGE_UPDATED as Record<string, string>)[path];
  if (!d) throw new Error(`${path}: χωρίς ημερομηνία στο app/pageUpdated.ts`);
  return d;
}

/** Όλες οι ομάδες με τις ημερομηνίες τους. */
export const siteCatalog = (today: string = athensToday()): MapGroup[] => buildCatalog(today, dateOf);
