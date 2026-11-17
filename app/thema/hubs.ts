// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΚΟΜΒΟΙ ΘΕΜΑΤΟΣ: /thema/<θέμα>, ΓΡΑΜΜΕΝΟΙ ΜΙΑ ΦΟΡΑ (17/11/2026)
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΥΠΑΡΧΟΥΝ. Ο κόμβος /odigos χωρίζει τους οδηγούς σε τρία πλατιά θέματα
// και ο /ergaleia τους υπολογιστές στα ίδια. Ο ιδιοκτήτης όμως ψάχνει ΕΝΑ
// πράγμα («φορολογία ενοικίων», «ΕΝΦΙΑ», «βραχυχρόνια μίσθωση») και η απάντηση
// ήταν μοιρασμένη σε δύο κόμβους, τρεις οδηγούς και δύο υπολογιστές. Κάθε
// κόμβος θέματος μαζεύει ό,τι υπάρχει ήδη για ένα ερώτημα: οδηγούς,
// υπολογιστές, τη νομική βάση από το μητρώο ισχύος και τις συχνές ερωτήσεις.
// Δεν γράφει δικό του κανόνα· παραπέμπει.
//
// ΜΙΑ ΠΗΓΗ ΓΙΑ ΣΕΛΙΔΑ, ΧΑΡΤΗ ΚΑΙ /llms.txt. Τον κατάλογο τον διαβάζουν η σελίδα
// (app/thema/HubPage.tsx), ο σκελετός του χάρτη (app/siteCatalogCore.ts), το
// sitemap.xml (app/sitemap.ts) και, μέσω του σκελετού, το /llms.txt. Νέος
// κόμβος μπαίνει ΕΔΩ και φαίνεται παντού μαζί.
//
// ΚΑΝΕΝΑΣ ΑΡΙΘΜΟΣ ΕΔΩ. Ο κατάλογος είναι ελαφρύς επίτηδες: τον φορτώνει η
// συνάρτηση του /llms.txt, που έχει όριο βάρους (docs/perf/server.json). Τα
// ποσά, οι συντελεστές και οι ημερομηνίες μπαίνουν στη σελίδα, από τη μηχανή.
//
// ΧΩΡΙΣ ΔΙΚΗ ΤΟΥΣ ΣΥΝΑΡΤΗΣΗ. Το next.config.ts ξαναγράφει το /thema/<θέμα>
// στο `HUB_INTERNAL` του διανομέα του /en (app/en/[[...slug]]/page.tsx), όπως
// το /xartis. Ο διαμεσολαβητής βλέπει τη δημόσια διεύθυνση.
// ═══════════════════════════════════════════════════════════════════════════
import type { TopicId } from '@/lib/core/topics';

/** Η ρίζα των κόμβων θέματος. */
export const HUB_ROOT = '/thema';

/** Η εσωτερική ρίζα όπου τους ξαναγράφει το next.config.ts (δεν είναι σελίδα). */
export const HUB_INTERNAL = '/en/_thema';

export interface TopicHub {
  /** Το τελευταίο κομμάτι της διεύθυνσης: /thema/<slug>. */
  slug: string;
  /** Το σύντομο όνομα: στη διαδρομή, στον χάρτη και στις κάρτες. */
  label: string;
  /** Η επικεφαλίδα και ο τίτλος της σελίδας (έως 60 χαρακτήρες). */
  title: string;
  /** Η περιγραφή της σελίδας αποτελεσμάτων (70–160 χαρακτήρες, guard-meta-description). */
  desc: string;
  /** Το θέμα των δύο κόμβων (lib/core/topics.ts) όπου ανήκει. */
  topic: TopicId;
  /** Οι οδηγοί του, με τη σειρά που δείχνονται (app/odigos/guides.ts). */
  guides: readonly string[];
  /** Οι υπολογιστές του, με τη σειρά που δείχνονται (lib/core/publicTools.ts). */
  tools: readonly string[];
  /** Οι κανόνες του στο μητρώο ισχύος (lib/legal/validity.ts), για τη «Νομική βάση». */
  rules: readonly string[];
  /**
   * Η τελευταία ουσιαστική αλλαγή του ΔΙΚΟΥ του κειμένου (ISO). Η ημερομηνία
   * της σελίδας είναι η νεότερη από αυτήν και από τα μέλη του (`hubUpdated`,
   * app/thema/hubDates.ts), όπως του /odigos από τους οδηγούς του.
   */
  updated: string;
}

export const HUBS: readonly TopicHub[] = [
  {
    slug: 'forologia-enoikion',
    label: 'Φορολογία ενοικίων',
    title: 'Φορολογία ενοικίων 2026: κλίμακα, έκπτωση και Ε2',
    desc: 'Πώς φορολογείται το ενοίκιο το 2026: η κλίμακα, η τεκμαρτή έκπτωση και η τράπεζα, το Ε2 και η αναπροσαρμογή, με οδηγούς, υπολογιστές και πηγές.',
    topic: 'enoikia',
    guides: [
      '/odigos/forologia-enoikion-2026',
      '/odigos/enoikio-meso-trapezas',
      '/odigos/ekptosi-forou-anakainisis',
      '/odigos/plafon-3-emporikes-misthoseis-2026',
    ],
    tools: ['/ypologismos-forou-enoikion', '/symplirosi-e2', '/anaprosarmogi-enoikiou', '/ypologismos-ekptosis-anakainisis', '/kathari-apodosi'],
    rules: ['rental-brackets', 'presumptive-deduction', 'vacant-rental-exemption', 'lease-declaration', 'rent-adjustment-cap', 'renovation-39b'],
    updated: '2026-11-17',
  },
  {
    slug: 'enfia',
    label: 'ΕΝΦΙΑ και προθεσμίες',
    title: 'ΕΝΦΙΑ 2026: υπολογισμός, δόσεις και προθεσμίες',
    desc: 'Πώς βγαίνει ο ΕΝΦΙΑ, πότε λήγει κάθε δόση, πώς εκδίδεται το πιστοποιητικό και ποιες προθεσμίες έχει ο ιδιοκτήτης, με οδηγούς, υπολογιστή και πηγές.',
    topic: 'enfia',
    guides: [
      '/odigos/pos-ypologizetai-o-enfia',
      '/odigos/enfia-2026-pliromi-doseis-pistopoiitiko',
      '/odigos/forologikes-prothesmies-idioktiton',
    ],
    tools: ['/ypologismos-enfia'],
    rules: ['enfia-coefficients', 'enfia-thresholds', 'enfia-relief-criteria', 'enfia-instalments', 'income-tax-instalments'],
    updated: '2026-11-17',
  },
  {
    slug: 'vraxyxronia-misthosi',
    label: 'Βραχυχρόνια μίσθωση',
    title: 'Βραχυχρόνια μίσθωση 2026: ΑΜΑ, τέλη και φόρος',
    desc: 'Τι χρειάζεται η βραχυχρόνια μίσθωση το 2026: ΑΜΑ, προδιαγραφές, τέλος ανθεκτικότητας και φόρος εισοδήματος, με οδηγούς, υπολογιστή και πηγές.',
    topic: 'enoikia',
    guides: ['/odigos/airbnb-takk-2026', '/odigos/vraxyxronia-ama-prodiagrafes-2026'],
    tools: ['/vraxyxronia-i-makroxronia', '/ypologismos-forou-enoikion'],
    rules: ['str-registry', 'str-freeze', 'climate-levy', 'municipal-accommodation-tax', 'rental-brackets'],
    updated: '2026-11-17',
  },
];

/** Η δημόσια διεύθυνση ενός κόμβου. */
export const hubPath = (h: Pick<TopicHub, 'slug'>): string => `${HUB_ROOT}/${h.slug}`;

/** Η εσωτερική διεύθυνση ενός κόμβου στον διανομέα του /en. */
export const hubInternal = (h: Pick<TopicHub, 'slug'>): string => `${HUB_INTERNAL}/${h.slug}`;

/** Ο κόμβος ενός slug, ή `undefined`. */
export const hubBySlug = (slug: string): TopicHub | undefined => HUBS.find(h => h.slug === slug);

/** Οι κόμβοι στους οποίους ανήκει ένας οδηγός, για τον σύνδεσμο «Θέμα» στην κεφαλίδα του. */
export const hubsOfGuide = (href: string): TopicHub[] => HUBS.filter(h => h.guides.includes(href));

// ═══ Η ΜΕΘΟΔΟΛΟΓΙΑ: ΠΩΣ ΒΓΑΙΝΟΥΝ ΟΙ ΑΡΙΘΜΟΙ ═════════════════════════════════
// Ζει δίπλα στους κόμβους γιατί αποδίδεται με τον ίδιο τρόπο (επανεγγραφή στον
// διανομέα του /en) και τη διαβάζουν οι ίδιοι αναγνώστες: χάρτης και /llms.txt.

/** Η δημόσια διεύθυνση της σελίδας μεθοδολογίας. */
export const METHOD_PATH = '/methodologia';

/** Η εσωτερική της διεύθυνση στον διανομέα του /en (next.config.ts). */
export const METHOD_INTERNAL = '/en/_methodologia';

/** Το όνομά της στον χάρτη, στο υποσέλιδο και στη διαδρομή. */
export const METHOD_LABEL = 'Πώς υπολογίζουμε';
