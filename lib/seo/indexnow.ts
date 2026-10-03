// ═══════════════════════════════════════════════════════════════════════════
// IndexNow: ΤΟ ΑΙΤΗΜΑ ΠΟΥ ΛΕΕΙ ΣΤΙΣ ΜΗΧΑΝΕΣ «ΑΥΤΕΣ ΟΙ ΣΕΛΙΔΕΣ ΑΛΛΑΞΑΝ»
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Ο χάρτης του ιστοτόπου περιμένει τη μηχανή να τον ξαναδιαβάσει
// όποτε εκείνη κρίνει· ένας νέος οδηγός μπορεί να μείνει αθέατος για μέρες. Το
// IndexNow το αντιστρέφει: ειδοποιούμε εμείς μία φορά και η ειδοποίηση
// μοιράζεται σε Bing, Yandex, Seznam και Naver.
//
// ΕΔΩ ΖΕΙ ΜΟΝΟ Η ΚΑΘΑΡΗ ΣΥΝΑΡΤΗΣΗ. Το σώμα του αιτήματος χτίζεται και
// ελέγχεται χωρίς δίκτυο (indexnow.test.ts)· την αποστολή την κάνει το
// scripts/indexnow.mjs, μόνο όταν του ζητηθεί ρητά με `--send`.
//
// ΤΙ ΚΟΒΕΤΑΙ ΚΑΙ ΓΙΑΤΙ. Το πρωτόκολλο απορρίπτει ΟΛΟ το αίτημα αν μία
// διεύθυνση ανήκει σε άλλον τομέα από τον `host` και δέχεται ως 10.000 ανά
// αίτημα (https://www.indexnow.org/documentation). Οι ξένες διευθύνσεις
// φεύγουν εδώ, οι διπλές μένουν μία και το υπερβολικό πλήθος σταματά πριν
// σταλεί, αντί να γυρίσει 422 από τον διακομιστή.
// ═══════════════════════════════════════════════════════════════════════════
import { SITE, INDEXNOW_KEY } from '@/lib/core/site';

/** Το κοινό σημείο του πρωτοκόλλου: το μοιράζει σε όλες τις μηχανές που το δέχονται. */
export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

/** Το ανώτατο πλήθος διευθύνσεων ανά αίτημα, κατά την τεκμηρίωση. */
const MAX_URLS = 10_000;

/** Το σώμα του αιτήματος, με τα ονόματα πεδίων του πρωτοκόλλου. */
export interface IndexNowPayload {
  host: string;
  key: string;
  keyLocation: string;
  urlList: string[];
}

/**
 * Χτίζει το σώμα του αιτήματος από τις διευθύνσεις του χάρτη.
 *
 * Το κλειδί θέλει 8 ως 128 χαρακτήρες από γράμματα, ψηφία και παύλα. Η
 * `keyLocation` δείχνει το αρχείο στη ρίζα του τομέα, εκεί όπου το σερβίρει το
 * public/. Ρίχνει σφάλμα όταν δεν μένει καμία διεύθυνση ή όταν περισσεύουν:
 * ένα αίτημα που ξέρουμε ότι θα απορριφθεί δεν φεύγει.
 */
export function indexNowPayload(urls: readonly string[], site: string = SITE, key: string = INDEXNOW_KEY): IndexNowPayload {
  if (!/^[A-Za-z0-9-]{8,128}$/.test(key)) throw new Error(`Άκυρο κλειδί IndexNow: «${key}»`);
  const origin = new URL(site).origin;
  // Η ΔΙΕΥΘΥΝΣΗ ΦΕΥΓΕΙ ΟΠΩΣ ΤΗ ΓΡΑΦΕΙ Ο ΧΑΡΤΗΣ. Η σύγκριση για διπλές γίνεται
  // στην κανονική της μορφή («…gr» και «…gr/» είναι η ίδια σελίδα).
  const seen = new Map<string, string>();
  for (const raw of urls) {
    const text = String(raw).trim();
    let u: URL;
    try { u = new URL(text); } catch { continue; }
    if (u.origin !== origin || seen.has(u.href)) continue;
    seen.set(u.href, text);
  }
  const urlList = [...seen.values()];
  if (!urlList.length) throw new Error(`Καμία διεύθυνση του ${origin} για ειδοποίηση.`);
  if (urlList.length > MAX_URLS) throw new Error(`${urlList.length} διευθύνσεις· το IndexNow δέχεται ως ${MAX_URLS} ανά αίτημα.`);
  return { host: new URL(site).host, key, keyLocation: `${origin}/${key}.txt`, urlList };
}
