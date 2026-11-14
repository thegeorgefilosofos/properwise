// ═══════════════════════════════════════════════════════════════════════════
// Ο ΟΡΓΑΝΙΣΜΟΣ ΣΤΟ ΔΟΜΗΜΕΝΟ ΣΧΗΜΑ, ΓΡΑΜΜΕΝΟΣ ΜΙΑ ΦΟΡΑ (14/11/2026)
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΚΕΝΟ. Επτά σελίδες έγραφαν τον δικό τους κόμβο `Organization` με το ίδιο
// `@id` και άλλα πεδία: η αρχική με λογότυπο 192 και παραλλαγές ονόματος, οι
// οδηγοί με λογότυπο 512, το /logistes με email και χωρίς προφίλ. Οι δημόσιοι
// υπολογιστές δήλωναν συντάκτη έναν ΔΕΥΤΕΡΟ οργανισμό χωρίς `@id` («Ομάδα
// Properwise») και εκδότη ένα μισό αντίγραφο του πρώτου. Για τη μηχανή
// αναζήτησης αυτά είναι αντικρουόμενες δηλώσεις για την ίδια οντότητα.
//
// ΤΩΡΑ. Κάθε σελίδα που αναφέρει τον οργανισμό βάζει ΕΝΑΝ κόμβο, τον
// `organizationNode()`. Κάθε `author`, `publisher` ή `about` δείχνει σε
// αυτόν με το `ORG_REF`. Κανένα στοιχείο ταυτότητας δεν προστίθεται: μόνο όσα
// έγραφε ήδη η αρχική (lib/legal/identity.ts, lib/core/site.ts).
// ═══════════════════════════════════════════════════════════════════════════
import { ORG_ID, SITE, SOCIAL_PROFILES, siteUrl } from '@/lib/core/site';
import { IDENTITY } from '@/lib/legal/identity';

/** Η αναφορά στον οργανισμό, για `author`, `publisher` και `about`. */
export const ORG_REF = { '@id': ORG_ID } as const;

/** Ο ένας κόμβος του οργανισμού, για το `@graph` κάθε σελίδας που τον αναφέρει. */
export function organizationNode() {
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: IDENTITY.tradeName,
    // Νόμιμες παραλλαγές γραφής της μάρκας (πεζά/κεφαλαία/κενό) ώστε η
    // Google να τις συνδέει με την ίδια οντότητα. ΟΧΙ ορθογραφικά λάθη.
    alternateName: ['Properwise', 'ProperWise', 'Proper Wise'],
    url: SITE,
    email: IDENTITY.supportEmail,
    logo: { '@type': 'ImageObject', url: siteUrl('/icons/icon-512.png'), width: 512, height: 512 },
    areaServed: 'GR',
    sameAs: [...SOCIAL_PROFILES],
  } as const;
}
