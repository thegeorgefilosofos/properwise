// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΟΔΗΓΟΙ, ΓΡΑΜΜΕΝΟΙ ΜΙΑ ΦΟΡΑ
// ─────────────────────────────────────────────────────────────────────────
// Ο κατάλογος τροφοδοτεί την κεντρική σελίδα /odigos, τον χάρτη ιστότοπου
// (ημερομηνία τροποποίησης), τους «Σχετικούς οδηγούς» και την ημερομηνία που
// τυπώνει και δηλώνει κάθε οδηγός. Ένας οδηγός που ενημερώνεται αλλάζει ΕΔΩ το
// `updated` και το βλέπουν μαζί ο αναγνώστης, η μηχανή αναζήτησης και ο χάρτης.
//
// Ο ΦΥΛΑΚΑΣ guard-guide-updated το δένει με το περιεχόμενο. Αλλαξες σελίδα
// οδηγού; Αλλαξε εδώ το `updated` και τρέξε `npm run guides:stamp`. Αν η
// αλλαγή δεν έχει ουσία για τον αναγνώστη (καλωδίωση, ύφος), κράτα την
// ημερομηνία με `npm run guides:stamp -- --keep-date=<οδηγός>` και γράψε στο
// PR γιατί.
//
// Το υποσέλιδο κρατά τη δική του λίστα επίτηδες: εκεί η σειρά ακολουθεί τη
// στήλη των υπολογισμών και το guard-public-routes διαβάζει τις διαδρομές του.
// ═══════════════════════════════════════════════════════════════════════════
import { RENO_39B_CAP, RENO_39B_YEARS, RENO_39B_TO } from '@/lib/accounting/renovation39b';

import { RENTAL_TAX_BRACKETS_2026, FIRST_YEAR_BANK_RECEIPT, FIRST_MONTH_BANK_RECEIPT } from '@/lib/billing/greekTax';
import { PRESUMPTIVE_DEDUCTION_RATE } from '@/lib/billing/presumptive';
import { feWhole, fpRate, grDateOf } from '@/lib/core/format';

// Η κλίμακα της περιγραφής βγαίνει από την κλίμακα που υπολογίζει: «15 / 25 /
// 35 / 45%», το όριο του τελευταίου κλιμακίου και η τεκμαρτή έκπτωση.
const RENT_SCALE = RENTAL_TAX_BRACKETS_2026.map(b => Math.round(b.rate * 100)).join(' / ') + '%';
const RENT_TOP_FROM = RENTAL_TAX_BRACKETS_2026[RENTAL_TAX_BRACKETS_2026.length - 1].from;

export type Guide = {
  href: string;
  kicker: string;
  title: string;
  desc: string;
  /** Ημέρα πρώτης δημοσίευσης (ISO), από το ιστορικό του αρχείου. */
  published: string;
  /** Ημέρα τελευταίας ουσιαστικής αλλαγής περιεχομένου (ISO). */
  updated: string;
  /**
   * Τα δημόσια εργαλεία (lib/core/publicTools) στα οποία ανήκει ο οδηγός. Από
   * εδώ βγαίνουν ΚΑΙ οι δύο κατευθύνσεις: το εργαλείο δείχνει τους οδηγούς του
   * (`guidesForTool`) και οι «Σχετικοί οδηγοί» προτιμούν όσους μοιράζονται
   * εργαλείο. Το guides.test.ts ελέγχει ότι κάθε εργαλείο έχει οδηγό.
   */
  tools: readonly string[];
};

export const GUIDES: readonly Guide[] = [
  {
    href: '/odigos/forologia-enoikion-2026',
    kicker: 'Ενοίκια',
    title: 'Φορολογία ενοικίων 2026',
    desc: `Η κλίμακα ${RENT_SCALE} (όριο ${feWhole(RENT_TOP_FROM)}), η τεκμαρτή έκπτωση ${fpRate(PRESUMPTIVE_DEDUCTION_RATE * 100)} και η `
        + 'προϋπόθεση της τραπεζικής είσπραξης, με παραδείγματα σε ευρώ.',
    published: '2026-09-21',
    updated: '2026-09-24',
    tools: ['/ypologismos-forou-enoikion', '/kathari-apodosi'],
  },
  {
    href: '/odigos/airbnb-takk-2026',
    kicker: 'Βραχυχρόνια',
    title: 'Φορολογία Airbnb 2026',
    // Η ΠΕΡΙΓΡΑΦΗ ΤΗΣ ΣΕΛΙΔΑΣ, ΙΔΙΑ ΚΑΙ ΣΤΗΝ ΚΑΡΤΑ (05.10.2026): το κείμενο v2
    // ανοίγει με το τέλος ανθεκτικότητας και την αλλαγή της 1ης Νοεμβρίου.
    desc: 'Πόσο είναι το τέλος ανθεκτικότητας ανά διανυκτέρευση το 2026, τι αλλάζει από 1η Νοεμβρίου, '
        + 'πώς δηλώνεται στο myAADE και πώς φορολογείται το Airbnb.',
    published: '2026-09-21',
    updated: '2026-10-05',
    tools: ['/vraxyxronia-i-makroxronia'],
  },
  {
    href: '/odigos/pos-ypologizetai-o-enfia',
    kicker: 'ΕΝΦΙΑ',
    title: 'Πώς υπολογίζεται ο ΕΝΦΙΑ',
    desc: 'Ο τύπος από την τιμή ζώνης επί τα τετραγωνικά, οι συντελεστές παλαιότητας '
        + 'και ορόφου, η αυτόματη μείωση ανά αξία και οι απαλλαγές.',
    published: '2026-09-21',
    updated: '2026-09-24',
    tools: ['/ypologismos-enfia'],
  },
  {
    href: '/odigos/kathari-apodosi-akinitou',
    kicker: 'Απόδοση',
    title: 'Καθαρή απόδοση ακινήτου',
    desc: 'Από τη μεικτή απόδοση αφαιρούνται ο φόρος στο δικό σου κλιμάκιο, ο ΕΝΦΙΑ '
        + 'και οι δαπάνες. Τι μένει καθαρό, με παράδειγμα σε ευρώ.',
    published: '2026-09-21',
    updated: '2026-09-24',
    tools: ['/kathari-apodosi', '/ypologismos-stegastikou-daneiou', '/sygkrisi-timologion-revmatos'],
  },
  // ── Δεύτερο κύμα (27.09.2026). Κάθε οδηγός γράφεται από δεδομένα που ήδη
  // τρέχουν στην εφαρμογή, με τη νομική βάση τους: lib/tax/greekTaxCalendar.ts
  // για τις προθεσμίες, lib/accounting/updates2026.ts για τις αλλαγές του 2026.
  {
    href: '/odigos/forologikes-prothesmies-idioktiton',
    kicker: 'Προθεσμίες',
    title: 'Φορολογικές προθεσμίες ιδιοκτήτη',
    desc: 'ΕΝΦΙΑ, Ε9, προσυμπληρωμένη δήλωση, Ε1 και Ε2 και οι μηνιαίες υποχρεώσεις '
        + 'της βραχυχρόνιας, με ημερομηνία, υπεύθυνο και επίσημη πηγή.',
    published: '2026-09-27',
    updated: '2026-09-27',
    tools: ['/ypologismos-enfia', '/ypologismos-forou-enoikion', '/vraxyxronia-i-makroxronia'],
  },
  {
    href: '/odigos/enoikio-meso-trapezas',
    kicker: 'Ενοίκια',
    title: 'Ενοίκιο μέσω τράπεζας',
    desc: `Από ${grDateOf(FIRST_YEAR_BANK_RECEIPT, FIRST_MONTH_BANK_RECEIPT)} το ενοίκιο κατοικίας εισπράττεται ηλεκτρονικά, αλλιώς χάνεται `
        + `η έκπτωση ${fpRate(PRESUMPTIVE_DEDUCTION_RATE * 100)}. Τι ισχύει για τα εισοδήματα 2025 και 2026.`,
    published: '2026-09-27',
    updated: '2026-09-27',
    tools: ['/ypologismos-forou-enoikion'],
  },
  {
    href: '/odigos/plafon-3-emporikes-misthoseis-2026',
    kicker: 'Επαγγελματικές μισθώσεις',
    title: 'Πλαφόν 3% στις επαγγελματικές μισθώσεις 2026',
    desc: 'Ποιες μισθώσεις αφορά το όριο αναπροσαρμογής, ποιες όχι, τι ισχύει στις νέες '
        + 'συμβάσεις και ποιοι εκμισθωτές εξαιρούνται.',
    published: '2026-09-27',
    updated: '2026-09-27',
    tools: ['/kathari-apodosi'],
  },
  {
    href: '/odigos/ekptosi-forou-anakainisis',
    kicker: 'Ανακαίνιση',
    title: 'Έκπτωση φόρου για ανακαίνιση',
    desc: `Η μείωση φόρου ισούται με τη δαπάνη, έως ${feWhole(RENO_39B_CAP)} σε ${RENO_39B_YEARS} έτη, `
        + `για δαπάνες έως ${RENO_39B_TO}. Προϋποθέσεις, πληρωμή, υλικά και παράδειγμα.`,
    published: '2026-09-27',
    updated: '2026-10-08',
    tools: ['/ypologismos-forou-enoikion', '/kathari-apodosi'],
  },
  {
    href: '/odigos/vraxyxronia-ama-prodiagrafes-2026',
    kicker: 'Βραχυχρόνια',
    title: 'Βραχυχρόνια 2026: ΑΜΑ και προδιαγραφές',
    desc: 'Η αναστολή νέων εγγραφών στο κέντρο της Αθήνας, γιατί ο ΑΜΑ δεν μεταβιβάζεται, '
        + 'οι προδιαγραφές ασφαλείας και τα πρόστιμα.',
    published: '2026-09-27',
    updated: '2026-10-09',
    tools: ['/vraxyxronia-i-makroxronia'],
  },
  // ── Τρίτο κύμα (03.10.2026). Από τα ερωτήματα αναζήτησης: ο κόσμος ψάχνει τι
  // ΚΑΝΕΙ με τον ΕΝΦΙΑ (πληρωμή, πιστοποιητικό, οριστικοποίηση), όχι πώς
  // υπολογίζεται. Οι δόσεις από το lib/tax/greekTaxCalendar.ts.
  {
    href: '/odigos/enfia-2026-pliromi-doseis-pistopoiitiko',
    kicker: 'ΕΝΦΙΑ',
    title: 'ΕΝΦΙΑ 2026: πληρωμή, δόσεις, πιστοποιητικό και οριστικοποίηση',
    desc: 'Πότε λήγει κάθε δόση, πού πατάς στο myAADE για να πληρώσεις, πώς βγάζεις '
        + 'πιστοποιητικό ΕΝΦΙΑ για πώληση και ποιος κάνει την οριστικοποίηση.',
    published: '2026-10-03',
    updated: '2026-10-03',
    tools: ['/ypologismos-enfia'],
  },
];

/**
 * ΟΙ ΟΔΗΓΟΙ ΕΝΟΣ ΕΡΓΑΛΕΙΟΥ, με τη σειρά του καταλόγου. Μέχρι τις 05/10/2026
 * κάθε εργαλείο έγραφε με το χέρι έναν σύνδεσμο το πολύ και δύο κανέναν· οι
 * έξι από τους δέκα οδηγούς είχαν ένα ως τρία εσωτερικά λινκ.
 */
export function guidesForTool(tool: string): Guide[] {
  return GUIDES.filter(g => g.tools.includes(tool));
}

/**
 * ΟΙ «ΣΧΕΤΙΚΟΙ ΟΔΗΓΟΙ» ΤΟΥ ΚΑΘΕΝΟΣ. Πρώτα έως δύο που μοιράζονται εργαλείο
 * ή θέμα (`kicker`) και ό,τι μένει κυκλικά από τον επόμενο στον κατάλογο. Η κυκλική σειρά μοιράζει τους συνδέσμους: με «οι πρώτοι του
 * καταλόγου» οι τελευταίοι οδηγοί δεν τους έπαιρνε σχεδόν κανείς.
 *
 * ΤΟ `exclude` ΚΡΑΤΑ ΕΞΩ ΟΔΗΓΟ ΠΟΥ ΔΕΝ ΠΡΕΠΕΙ ΝΑ ΠΡΟΤΑΘΕΙ ΑΠΟ ΑΥΤΗ ΤΗ ΣΕΛΙΔΑ
 * (05.10.2026). Πρώτη χρήση: ο οδηγός Airbnb δεν έδειχνε τον οδηγό ΑΜΑ όσο
 * εκείνος είχε ανοιχτό P0· έκλεισε στις 07/10/2026 και η εξαίρεση έφυγε. Η
 * θέση που αδειάζει γεμίζει από τον επόμενο του κύκλου, οπότε η κάρτα δεν
 * λείπει. Η σελίδα που εξαιρεί το γράφει με την αιτία της.
 */
export function relatedGuides(current: Guide, max: number, exclude: readonly string[] = []): Guide[] {
  const i = GUIDES.findIndex(g => g.href === current.href);
  const ring = [...GUIDES.slice(i + 1), ...GUIDES.slice(0, Math.max(0, i))]
    .filter(g => g.href !== current.href && !exclude.includes(g.href));
  // Δύο το πολύ από το ίδιο εργαλείο: με όλους, ο οδηγός με τρία εργαλεία
  // έπαιρνε οκτώ συνδέσμους και δύο άλλοι από δύο.
  const near = ring.filter(g => g.tools.some(t => current.tools.includes(t)) || g.kicker === current.kicker).slice(0, 2);
  return [...near, ...ring.filter(g => !near.includes(g))].slice(0, max);
}

/** Ο οδηγός μιας διαδρομής. Άγνωστη διαδρομή είναι σφάλμα γραφής, όχι κενό. */
export function guideAt(href: string): Guide {
  const g = GUIDES.find(x => x.href === href);
  if (!g) throw new Error(`Άγνωστος οδηγός: ${href}`);
  return g;
}

/**
 * Η τελευταία ουσιαστική αλλαγή σε οποιονδήποτε οδηγό: η ημερομηνία του κόμβου
 * /odigos στον χάρτη, που αλλάζει όταν αλλάζει κάτι από όσα δείχνει.
 */
export const GUIDES_UPDATED: string = GUIDES.map(g => g.updated).sort().at(-1)!;

/** Το όνομα της κάρτας κοινοποίησης του οδηγού στο /og/<slug> (app/og/share.ts). */
export function guideSlug(g: Guide): string {
  return `odigos-${g.href.split('/').pop()}`;
}

/**
 * Η εικόνα κοινοποίησης του οδηγού. Τη διαβάζει το δομημένο σχήμα, ώστε το
 * άρθρο να δείχνει την ίδια κάρτα με την κοινοποίηση.
 */
export function guideShareImageUrl(g: Guide): string {
  return `/og/${guideSlug(g)}`;
}
