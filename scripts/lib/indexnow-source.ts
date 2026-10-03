// ═══════════════════════════════════════════════════════════════════════════
// Η ΠΗΓΗ ΤΟΥ scripts/indexnow.mjs: Ο ΙΔΙΟΣ Ο ΧΑΡΤΗΣ, ΟΧΙ ΑΝΤΙΓΡΑΦΟ ΤΟΥ
// ─────────────────────────────────────────────────────────────────────────
// Οι διευθύνσεις έρχονται από το app/sitemap.ts, το ίδιο που σερβίρεται ως
// /sitemap.xml· μια δεύτερη λίστα εδώ θα έμενε πίσω την πρώτη φορά που
// μπαίνει νέα σελίδα. Το αρχείο είναι TypeScript επειδή ο χάρτης και ο
// κατασκευαστής του αιτήματος είναι TypeScript με εισαγωγές «@/…»· το
// σενάριο το φορτώνει μέσω tsx, χωρίς βήμα μεταγλώττισης.
// ═══════════════════════════════════════════════════════════════════════════
import sitemap from '../../app/sitemap';
import { SITE, INDEXNOW_KEY } from '../../lib/core/site';
import { indexNowPayload, INDEXNOW_ENDPOINT, type IndexNowPayload } from '../../lib/seo/indexnow';

/** Οι διευθύνσεις του χάρτη, με τη σειρά του. */
export function sitemapUrls(): string[] {
  return sitemap().map(r => r.url);
}

export { SITE, INDEXNOW_KEY, indexNowPayload, INDEXNOW_ENDPOINT, type IndexNowPayload };
