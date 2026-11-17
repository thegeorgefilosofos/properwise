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
//
// ΚΑΙ Ο ΙΣΤΟΤΟΠΟΣ ΚΑΙ Η ΕΦΑΡΜΟΓΗ, ΜΙΑ ΦΟΡΑ (17/11/2026). Η αρχική και το /en
// έγραφαν η καθεμιά δικό της `SoftwareApplication` χωρίς `@id`, με άλλη
// διεύθυνση (/ και /en): δύο εφαρμογές για τη μηχανή. Το `WebSite` υπήρχε μόνο
// στην αρχική και χωρίς εναλλακτικά ονόματα, ενώ από αυτό διαβάζει η Google το
// όνομα του ιστότοπου που δείχνει πάνω από το αποτέλεσμα.
// ═══════════════════════════════════════════════════════════════════════════
import { ORG_ID, SITE, SITE_HOST, SOCIAL_PROFILES, siteUrl } from '@/lib/core/site';
import { IDENTITY } from '@/lib/legal/identity';

/** Η αναφορά στον οργανισμό, για `author`, `publisher` και `about`. */
export const ORG_REF = { '@id': ORG_ID } as const;

/** Ο ιστότοπος· το `isPartOf` κάθε σελίδας δείχνει εδώ. */
export const WEBSITE_ID = `${SITE}/#website`;

/** Η εφαρμογή, ίδια οντότητα από όποια γλώσσα κι αν τη δηλώνει μια σελίδα. */
export const APP_ID = `${SITE}/#app`;

/**
 * ΟΙ ΓΡΑΦΕΣ ΤΟΥ ΟΝΟΜΑΤΟΣ, ΟΧΙ ΤΑ ΛΑΘΗ ΤΟΥ.
 *
 * Πεζά, κεφαλαία, με κενό και η ελληνική γραφή, όπως την πληκτρολογεί όποιος
 * άκουσε το όνομα: με «γου» και με «ου», γιατί και οι δύο είναι σωστή απόδοση
 * του αγγλικού «wise». Τα λάθη πληκτρολόγησης (properwize, propewise, prop
 * wise) ΔΕΝ μπαίνουν: λίστα λαθών μέσα στο σχήμα είναι keyword stuffing και
 * τα διορθώνει μόνη της η Google όταν η μάρκα αναζητείται (skill seo-onoma).
 * Τις ίδιες γραφές διαβάζει το /llms.txt.
 */
export const BRAND_ALT_NAMES = ['Properwise', 'ProperWise', 'Proper Wise', 'Προπεργουάιζ', 'Προπερουάιζ'] as const;

/**
 * ΤΙ ΕΙΝΑΙ ΤΟ PROPERWISE, ΣΕ ΜΙΑ ΠΡΟΤΑΣΗ ΑΝΑ ΓΛΩΣΣΑ.
 *
 * Η αρχική έλεγε τι κάνει η εφαρμογή, η «Ποιοι είμαστε» πού πάνε τα δεδομένα·
 * καμία σελίδα δεν έλεγε με μία πρόταση ΤΙ ΕΙΝΑΙ, ούτε στον άνθρωπο ούτε στη
 * μηχανή. Μπαίνει στην πρώτη ερώτηση της αρχικής και του /en, στην αρχή της
 * «Ποιοι είμαστε» και στο `description` του οργανισμού. Μόνο όσα ισχύουν ήδη:
 * καμία έδρα, γιατί η διεύθυνση του φορέα δεν έχει δημοσιευθεί (IDENTITY).
 */
export const BRAND_ABOUT = {
  el: `Το ${IDENTITY.tradeName} είναι ελληνική διαδικτυακή εφαρμογή διαχείρισης ακινήτων για ιδιοκτήτες, διαχειριστές και λογιστές. Κρατά ενοίκια, δαπάνες, ενοικιαστές, προθεσμίες, φόρο ενοικίων, Ε2 και ΕΝΦΙΑ για κάθε ακίνητο στην Ελλάδα, στο ${SITE_HOST}.`,
  en: `${IDENTITY.tradeName} is a web app for managing property in Greece, built for owners, property managers and accountants. It keeps rent, expenses, tenants, deadlines, rental income tax, form E2 and ENFIA for every property, at ${SITE_HOST}.`,
} as const;

/** Ο ένας κόμβος του οργανισμού, για το `@graph` κάθε σελίδας που τον αναφέρει. */
export function organizationNode() {
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: IDENTITY.tradeName,
    alternateName: [...BRAND_ALT_NAMES],
    description: BRAND_ABOUT.el,
    url: SITE,
    email: IDENTITY.supportEmail,
    logo: { '@type': 'ImageObject', url: siteUrl('/icons/icon-512.png'), width: 512, height: 512 },
    areaServed: 'GR',
    sameAs: [...SOCIAL_PROFILES],
  } as const;
}

/**
 * Ο ιστότοπος, με το όνομα και τις γραφές του. Χωρίς `SearchAction`: το
 * sitelinks searchbox θέλει πραγματική αναζήτηση σε σελίδα που απαντά σε
 * `?q=`, που ο ιστότοπος δεν έχει· ψεύτικη δήλωση αγνοείται ή κοστίζει.
 */
export function websiteNode() {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: SITE,
    name: IDENTITY.tradeName,
    alternateName: [...BRAND_ALT_NAMES],
    inLanguage: ['el', 'en'],
    publisher: ORG_REF,
  } as const;
}

/**
 * Η εφαρμογή. Μία διεύθυνση (η αρχική), ένα `@id`· η περιγραφή στη γλώσσα της
 * σελίδας που τη δηλώνει. Η εφαρμογή είναι στα ελληνικά και από το /en.
 * Ούτε `aggregateRating` ούτε `offers`: βλ. το σχόλιο στο app/page.tsx.
 */
export function appNode(description: string) {
  return {
    '@type': 'SoftwareApplication',
    '@id': APP_ID,
    name: IDENTITY.tradeName,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: SITE,
    inLanguage: 'el',
    description,
    publisher: ORG_REF,
  } as const;
}
