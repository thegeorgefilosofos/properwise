// ═══════════════════════════════════════════════════════════════════════════
// Η ΗΜΕΡΟΜΗΝΙΑ ΚΑΘΕ ΚΟΜΒΟΥ ΘΕΜΑΤΟΣ ΚΑΙ ΤΗΣ ΜΕΘΟΔΟΛΟΓΙΑΣ
// ─────────────────────────────────────────────────────────────────────────
// Χωριστά από τον κατάλογο (app/thema/hubs.ts), όπως το app/siteCatalog.ts από
// τον σκελετό του: οι ημερομηνίες τραβούν τα μητρώα του app/pageUpdated.ts και
// ο κατάλογος μένει ελαφρύς για το /llms.txt. Τις διαβάζουν η σελίδα («Τελευταία
// ενημέρωση»), ο χάρτης (`lastModified`) και ο χάρτης για τον άνθρωπο: μία πηγή.
// ═══════════════════════════════════════════════════════════════════════════
import { LISTED_GUIDES } from '../odigos/guides';
import { PAGE_UPDATED } from '../pageUpdated';
import type { TopicHub } from './hubs';

/**
 * Η ΤΕΛΕΥΤΑΙΑ ΟΥΣΙΑΣΤΙΚΗ ΑΛΛΑΓΗ ΤΗΣ ΜΕΘΟΔΟΛΟΓΙΑΣ (ISO), με το χέρι: αλλάζει
 * μαζί με το κείμενο της σελίδας, ποτέ με το χτίσιμο. Ο πίνακας του μητρώου
 * ισχύος που δείχνει η σελίδα έχει την ημερομηνία ελέγχου σε κάθε γραμμή.
 */
export const METHOD_UPDATED = '2026-11-17';

// Μόνο οι οδηγοί του καταλόγου: κόμβος δεν δείχνει οδηγό εκτός καταλόγου.
const GUIDE_DATE = new Map(LISTED_GUIDES.map(g => [g.href, g.updated]));

/** Η ημερομηνία ενός μέλους του κόμβου. Μέλος χωρίς ημερομηνία σπάει το χτίσιμο. */
function memberDate(href: string): string {
  const d = GUIDE_DATE.get(href) ?? (PAGE_UPDATED as Record<string, string>)[href];
  if (!d) throw new Error(`${href}: μέλος κόμβου θέματος χωρίς ημερομηνία (guides.ts ή pageUpdated.ts)`);
  return d;
}

/** Η νεότερη από το κείμενο του κόμβου και τους οδηγούς και υπολογιστές του. */
export function hubUpdated(h: TopicHub): string {
  return [h.updated, ...h.guides.map(memberDate), ...h.tools.map(memberDate)].sort().at(-1)!;
}
