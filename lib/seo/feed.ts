// ═══════════════════════════════════════════════════════════════════════════
// /odigos/feed.xml: Η ΡΟΗ RSS ΤΩΝ ΟΔΗΓΩΝ
// ─────────────────────────────────────────────────────────────────────────
// Οι οδηγοί του κόμβου (LISTED_GUIDES), ο νεότερος πρώτος. Η ημερομηνία κάθε
// στοιχείου είναι η τελευταία ουσιαστική αλλαγή του οδηγού (`updated`), η ίδια
// που τυπώνει ο οδηγός και δίνει ο χάρτης: ο αναγνώστης ροών βλέπει τον οδηγό
// ξανά όταν αλλάξει, όχι σε κάθε χτίσιμο. Ο οδηγός εκτός καταλόγου δεν μπαίνει.
//
// ΣΤΑΤΙΚΟ ΑΡΧΕΙΟ, ΟΧΙ ΔΙΑΔΡΟΜΗ: γράφεται στο public/odigos/feed.xml με
// `npm run machine-files`, για τον ίδιο λόγο με το lib/seo/humans.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { siteUrl } from '@/lib/core/site';
import { LISTED_GUIDES, GUIDES_UPDATED } from '@/app/odigos/guides';

export const FEED_PATH = '/odigos/feed.xml';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
const xml = (s: string): string => s.replace(/[&<>"']/g, c => ESC[c]);

/** Η ημέρα ISO ως ημερομηνία RFC 822, όπως τη θέλει το RSS 2.0. */
export const rfc822 = (iso: string): string => new Date(`${iso}T00:00:00Z`).toUTCString();

export function guidesFeed(): string {
  const items = [...LISTED_GUIDES].sort((a, b) => b.updated.localeCompare(a.updated) || a.href.localeCompare(b.href));
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '<channel>',
    '<title>PROPERWISE: Οδηγοί για ιδιοκτήτες ακινήτων</title>',
    `<link>${siteUrl('/odigos')}</link>`,
    `<atom:link href="${siteUrl(FEED_PATH)}" rel="self" type="application/rss+xml"/>`,
    '<description>Φορολογία ενοικίων, ΕΝΦΙΑ, βραχυχρόνια μίσθωση και αγορά ακινήτου, με τη νομική βάση κάθε κανόνα.</description>',
    '<language>el</language>',
    `<lastBuildDate>${rfc822(GUIDES_UPDATED)}</lastBuildDate>`,
    ...items.map(g => [
      '<item>',
      `<title>${xml(g.title)}</title>`,
      `<link>${siteUrl(g.href)}</link>`,
      `<guid isPermaLink="true">${siteUrl(g.href)}</guid>`,
      `<category>${xml(g.kicker)}</category>`,
      `<description>${xml(g.desc)}</description>`,
      `<pubDate>${rfc822(g.updated)}</pubDate>`,
      '</item>',
    ].join('')),
    '</channel>',
    '</rss>',
    '',
  ].join('\n');
}
