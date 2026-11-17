// ═══════════════════════════════════════════════════════════════════════════
// Ο ΚΟΜΒΟΣ ΘΕΜΑΤΟΣ: /thema/<θέμα> (17/11/2026)
// ─────────────────────────────────────────────────────────────────────────
// Μία σελίδα ανά ερώτημα, στο πλάτος της αρχικής (1140):
//
//   διαδρομή · [H1 · σύντομη απάντηση · εισαγωγή | σύνοψη · άλλα θέματα] ·
//   οδηγοί και υπολογιστές · νομική βάση | ερωτήσεις
//   (ΕΝΦΙΑ: νομική βάση και ερωτήσεις | προθεσμίες)
//
// Η κορυφή είναι δύο στήλες από τα 1024: αριστερά το κείμενο, δεξιά η σύνοψη
// με τους αριθμούς του θέματος και οι σύνδεσμοι στα άλλα θέματα και στη
// μεθοδολογία. Οι κάρτες και οι ερωτήσεις είναι πλέγματα (app/thema/parts.tsx).
//
// ΚΑΝΕΝΑΣ ΑΡΙΘΜΟΣ ΓΡΑΜΜΕΝΟΣ ΜΕ ΤΟ ΧΕΡΙ. Κλίμακα, έκπτωση, τέλος, δόσεις και
// ημερομηνίες έρχονται από τις σταθερές και τις συναρτήσεις που υπολογίζουν
// (lib/billing/**, lib/tax/**, app/odigos/*Text.ts), όπως στους οδηγούς. Η
// μόνη υπόθεση είναι το μηνιαίο ενοίκιο του παραδείγματος, το ίδιο με του
// οδηγού φορολογίας ενοικίων.
//
// ΟΙ ΣΥΧΝΕΣ ΕΡΩΤΗΣΕΙΣ ΕΙΝΑΙ ΟΙ ΟΡΑΤΕΣ. Το `FAQPage` του σχήματος παίρνει
// ακριβώς τις ίδιες ερωτήσεις και απαντήσεις που διαβάζει ο άνθρωπος. Οι
// απαντήσεις λένε ό,τι λένε ήδη οι οδηγοί του θέματος, πιο σύντομα.
//
// Server Component· οι κάρτες και οι ερωτήσεις είναι Server Components.
// ═══════════════════════════════════════════════════════════════════════════
import Link from 'next/link';
import type { ReactNode } from 'react';
import { T } from '@/components/tokens';
import { siteUrl } from '@/lib/core/site';
import { fe, feWhole, fpRate, grDate, grDateOf } from '@/lib/core/format';
import { athensToday } from '@/lib/core/time';
import {
  RENTAL_TAX_BRACKETS_2026, rentalIncomeTax, FIRST_YEAR_BANK_RECEIPT, FIRST_MONTH_BANK_RECEIPT,
  CLIMATE_LEVY_FROM_2025,
} from '@/lib/billing/greekTax';
import { PRESUMPTIVE_DEDUCTION_RATE } from '@/lib/billing/presumptive';
import { taxLimitAsOf, type TaxLimitGroup } from '@/lib/facts/taxLimits';
import { ENFIA_WEALTH_REDUCTION } from '@/lib/billing/enfia';
import { greekPropertyTaxObligations } from '@/lib/tax/greekTaxCalendar';
import { ENFIA_INSTALMENTS, ENFIA_MIN_INSTALMENT } from '@/lib/tools/enfiaSchedule';
import { CLIMATE_LEVY_AREA_SQM } from '@/lib/billing/climateLevyCategories';
import { ATHENS_STR_FREEZE as ATHENS, THESS_STR_FREEZE as THESS } from '@/lib/market/greekMarket';
import { AADE_DESTINATIONS } from '@/lib/tax/aade';
import { PUBLIC_TOOLS } from '@/lib/core/publicTools';
import { PROTHESMIES_PATH, upcomingMonths } from '@/lib/seo/prothesmies';
import { breadcrumbJsonLd } from '@/lib/seo/breadcrumbs';
import { organizationNode, ORG_REF } from '@/lib/seo/organization';
import { PublicHeader, PublicFooter, JsonLd, WRAP, WRAP_PAD } from '../PublicChrome';
import { HubLink } from '../HubParts';
import { GuideQuickAnswer } from '../odigos/GuideParts';
import { LISTED_GUIDES } from '../odigos/guides';
import { enfiaInstalmentRule, enfiaInstalmentDates } from '../odigos/enfiaText';
import { STR_MAX_PROPERTIES, STR_BUSINESS_PROPERTIES, STR_BUSINESS_PROPERTIES_OR_MORE } from '../odigos/strText';
import { MonthDeadlines } from '../prothesmies/MonthDeadlines';
import { RuleList } from './RuleList';
import { Crumbs, Section, Byline, TwoCol, FactCard, LinkBox, CardGrid, FaqGrid, Fold, rulesMeta, type CardItem, type Fact, type FaqItem } from './parts';
import { ruleRows } from './rules';
import { hubUpdated } from './hubDates';
import { HUBS, hubPath, METHOD_PATH, METHOD_LABEL, type TopicHub } from './hubs';

// ── ΟΙ ΑΡΙΘΜΟΙ ΤΩΝ ΚΕΙΜΕΝΩΝ, ΑΠΟ ΤΗ ΜΗΧΑΝΗ ─────────────────────────────────────
const DEDUCTION = fpRate(PRESUMPTIVE_DEDUCTION_RATE * 100);
const BANK_FROM = grDateOf(FIRST_YEAR_BANK_RECEIPT, FIRST_MONTH_BANK_RECEIPT);

/** «15% έως 12.000€, 25% έως 24.000€, … και 45% πάνω από 36.000€», από τα κλιμάκια. */
export const RENT_SCALE = (() => {
  const parts = RENTAL_TAX_BRACKETS_2026.map(b => (b.to === Infinity
    ? `${fpRate(b.rate * 100)} πάνω από ${feWhole(b.from)}`
    : `${fpRate(b.rate * 100)} έως ${feWhole(b.to)}`));
  return `${parts.slice(0, -1).join(', ')} και ${parts[parts.length - 1]}`;
})();

/** Το παράδειγμα του οδηγού φορολογίας ενοικίων: η υπόθεση είναι μόνο το μηνιαίο ενοίκιο. */
const RENT_MONTHLY = 650;
const RENT_EX = (() => {
  const gross = RENT_MONTHLY * 12;
  const taxable = gross * (1 - PRESUMPTIVE_DEDUCTION_RATE);
  return { gross, taxable, tax: rentalIncomeTax(taxable, RENTAL_TAX_BRACKETS_2026), firstOnly: taxable <= RENTAL_TAX_BRACKETS_2026[0].to };
})();
const FIRST_RATE = fpRate(RENTAL_TAX_BRACKETS_2026[0].rate * 100);

/** Το έτος του εκκαθαριστικού που περιγράφει ο κόμβος ΕΝΦΙΑ, όπως ο οδηγός πληρωμής. */
const ENFIA_YEAR = 2026;
const WEALTH_MAX = fpRate(ENFIA_WEALTH_REDUCTION[0].pct);
const WEALTH_LAST = ENFIA_WEALTH_REDUCTION.filter(r => r.pct > 0).at(-1)!;
const ENFIA_PORTAL = AADE_DESTINATIONS.enfia.portal;
/** Η πρώτη και η τελευταία δόση του εκκαθαριστικού, από το φορολογικό ημερολόγιο (όπως το enfiaText). */
const ENFIA_ENDS = (() => {
  const obl = greekPropertyTaxObligations(ENFIA_YEAR, 'owner');
  const first = obl.find(o => o.kind === 'enfia-first')!;
  const last = obl.find(o => o.kind === 'enfia-last')!;
  return { first: first.date, last: last.date, issued: first.confidence === 'statutory' && last.confidence === 'statutory' };
})();

/** Ο σύνδεσμος που στέκεται μόνος του σε γραμμή: 44 ύψος στην αφή (`po-tap`). */
const TAP_LINK = { color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 } as const;

/** Το τέλος ανθεκτικότητας: ακέραιο ποσό χωρίς λεπτά, όπως στον οδηγό Airbnb. */
const eur = (n: number) => (Number.isInteger(n) ? feWhole(n) : fe(n));
const LEVY = CLIMATE_LEVY_FROM_2025;
const LEVY_MIN = Math.min(LEVY.small.low, LEVY.large.low);
const LEVY_MAX = Math.max(LEVY.small.high, LEVY.large.high);
const SQM = CLIMATE_LEVY_AREA_SQM;

/** Η διαδρομή ενός υπολογιστή του καταλόγου· διαδρομή που δεν υπάρχει σταματά το χτίσιμο. */
const toolHref = (href: string): string => {
  if (!PUBLIC_TOOLS.some(t => t.href === href)) throw new Error(`Άγνωστος υπολογιστής: ${href}`);
  return href;
};

// ── ΤΟ ΚΕΙΜΕΝΟ ΚΑΘΕ ΚΟΜΒΟΥ ─────────────────────────────────────────────────────
interface HubCopy {
  /** Η σύντομη απάντηση στο ερώτημα του τίτλου. */
  answer: string;
  /** Η παράγραφος κάτω από την απάντηση: τι βρίσκεις εδώ. */
  lede: ReactNode;
  /** Η σύνοψη της πλαϊνής στήλης: οι αριθμοί του θέματος, από τη μηχανή. */
  facts: Fact[];
  /** Μια κλίμακα στην κορυφή της σύνοψης, σε μία σειρά, όπου το θέμα την έχει. */
  scale?: Fact[];
  /** Μία γραμμή κάτω από τη σύνοψη, όπου υπάρχει επιφύλαξη. */
  factsNote?: string;
  faq: FaqItem[];
  /** Οι προθεσμίες του επόμενου μήνα με προθεσμία, όπου το θέμα τις έχει. */
  deadlines?: true;
  /**
   * Η ομάδα ορίων του μητρώου (lib/facts/taxLimits.ts) που δείχνει η σελίδα: η
   * κεφαλίδα γράφει τον παλαιότερο ανθρώπινο έλεγχό της, όπως οι υπολογιστές.
   */
  limits: TaxLimitGroup;
}

const COPY: Record<string, HubCopy> = {
  'forologia-enoikion': {
    answer: `Το ενοίκιο φορολογείται χωριστά από τον μισθό, με δική του κλίμακα: ${RENT_SCALE}. `
      + `Πριν από την κλίμακα αφαιρείται τεκμαρτή έκπτωση ${DEDUCTION}, που για το ενοίκιο κατοικίας θέλει είσπραξη `
      + `μέσω τράπεζας από ${BANK_FROM}. Ενοίκιο ${feWhole(RENT_MONTHLY)} τον μήνα δίνει φόρο ${fe(RENT_EX.tax)} τον χρόνο.`,
    lede: <>
      Εδώ είναι μαζί ο κανόνας, η προϋπόθεση της τράπεζας, η δήλωση στο Ε2, η μείωση φόρου για ανακαίνιση και το όριο
      αναπροσαρμογής στις επαγγελματικές μισθώσεις. Κάθε οδηγός εξηγεί με παραδείγματα σε ευρώ και κάθε υπολογιστής
      βγάζει το ποσό στα δικά σου νούμερα. Η <HubLink href={METHOD_PATH}>μεθοδολογία</HubLink> λέει από πού έρχεται
      κάθε αριθμός.
    </>,
    limits: 'rent',
    scale: RENTAL_TAX_BRACKETS_2026.map(b => ({
      k: b.to === Infinity ? `άνω των ${feWhole(b.from)}` : `έως ${feWhole(b.to)}`,
      v: fpRate(b.rate * 100),
    })),
    facts: [
      { k: 'Τεκμαρτή έκπτωση', v: DEDUCTION },
      { k: 'Τράπεζα για την έκπτωση από', v: BANK_FROM },
      { k: `Φόρος για ${feWhole(RENT_MONTHLY)} τον μήνα`, v: fe(RENT_EX.tax) },
    ],
    faq: [
      {
        q: 'Με ποια κλίμακα φορολογούνται τα ενοίκια το 2026;',
        a: `Με δική τους κλίμακα, χωριστά από μισθούς και συντάξεις: ${RENT_SCALE}. Η κλίμακα εφαρμόζεται στο `
          + `φορολογητέο, δηλαδή στα ακαθάριστα μετά την τεκμαρτή έκπτωση ${DEDUCTION}.`,
        link: { href: '/odigos/forologia-enoikion-2026', label: 'Ο οδηγός φορολογίας ενοικίων 2026' },
      },
      {
        q: 'Τι αλλάζει αν το ενοίκιο εισπράττεται με μετρητά;',
        a: `Για ενοίκιο κατοικίας, από ${BANK_FROM} η τεκμαρτή έκπτωση ${DEDUCTION} δίνεται μόνο όταν το μίσθωμα `
          + 'εισπράττεται μέσω τράπεζας. Τα μετρητά δεν απαγορεύονται, αλλά τότε φορολογούνται ολόκληρα τα ακαθάριστα.',
        link: { href: '/odigos/enoikio-meso-trapezas', label: 'Ο οδηγός για το ενοίκιο μέσω τράπεζας' },
      },
      {
        q: 'Σε ποιο έντυπο δηλώνονται τα ενοίκια;',
        a: 'Στο Ε2, με κάθε ακίνητο σε δική του γραμμή, που υποβάλλεται μαζί με τη δήλωση Ε1. Τα σύνολα του Ε2 '
          + 'μεταφέρονται σε κωδικούς του Ε1.',
        link: { href: '/symplirosi-e2', label: 'Τι γράφεις σε κάθε στήλη του Ε2' },
      },
      {
        q: `Πόσο φόρο πληρώνω για ενοίκιο ${feWhole(RENT_MONTHLY)} τον μήνα;`,
        a: `Τα ακαθάριστα είναι ${fe(RENT_EX.gross)} τον χρόνο. Μετά την τεκμαρτή έκπτωση ${DEDUCTION} το φορολογητέο `
          + `είναι ${fe(RENT_EX.taxable)} και ο φόρος ${fe(RENT_EX.tax)}`
          + (RENT_EX.firstOnly ? `, όλος με ${FIRST_RATE}.` : '.'),
        link: { href: toolHref('/ypologismos-forou-enoikion'), label: 'Υπολόγισε τον φόρο στο δικό σου ενοίκιο' },
      },
    ],
  },
  enfia: {
    answer: 'Ο ΕΝΦΙΑ είναι φόρος κατοχής: τον πληρώνεις κάθε χρόνο επειδή έχεις το ακίνητο, είτε το νοικιάζεις είτε μένει κενό. '
      + 'Ο κύριος φόρος κάθε κτίσματος βγαίνει από τα τετραγωνικά, τον βασικό φόρο της ζώνης και τους συντελεστές '
      + `παλαιότητας και ορόφου και μειώνεται αυτόματα έως ${WEALTH_MAX} ανάλογα με τη συνολική αξία της περιουσίας. `
      + `Πληρώνεται εφάπαξ ή σε ${enfiaInstalmentRule(ENFIA_YEAR)}`,
    lede: <>
      Εδώ είναι μαζί ο τύπος του ΕΝΦΙΑ, οι δόσεις και το πιστοποιητικό του και οι προθεσμίες του ιδιοκτήτη μέσα στη
      χρονιά. {enfiaInstalmentDates(ENFIA_YEAR)} Όλες οι ημερομηνίες, μήνα με μήνα, είναι στις{' '}
      <HubLink href={PROTHESMIES_PATH}>προθεσμίες</HubLink> και η <HubLink href={METHOD_PATH}>μεθοδολογία</HubLink> λέει
      από πού έρχεται κάθε αριθμός.
    </>,
    deadlines: true,
    limits: 'enfia',
    facts: [
      { k: 'Δόσεις', v: `έως ${ENFIA_INSTALMENTS}` },
      { k: 'Ελάχιστη δόση', v: feWhole(ENFIA_MIN_INSTALMENT) },
      { k: `Πρώτη δόση ${ENFIA_YEAR}`, v: grDate(ENFIA_ENDS.first) },
      { k: 'Τελευταία δόση', v: grDate(ENFIA_ENDS.last) },
      { k: 'Μείωση κύριου φόρου', v: `έως ${WEALTH_MAX}` },
      { k: 'Για περιουσία έως', v: feWhole(WEALTH_LAST.limit) },
    ],
    factsNote: ENFIA_ENDS.issued ? undefined : 'Αναμενόμενες ημερομηνίες· τις ακριβείς τις γράφει το εκκαθαριστικό.',
    faq: [
      {
        q: 'Πώς υπολογίζεται ο ΕΝΦΙΑ;',
        a: 'Για κάθε κτίσμα: τετραγωνικά × βασικός φόρος ζώνης × συντελεστής παλαιότητας × συντελεστής ορόφου. Από '
          + `τον κύριο φόρο αφαιρείται αυτόματα μείωση έως ${WEALTH_MAX}, όταν η συνολική αξία της περιουσίας είναι έως `
          + `${feWhole(WEALTH_LAST.limit)}, μαζί με όσες απαλλαγές δικαιούσαι.`,
        link: { href: '/odigos/pos-ypologizetai-o-enfia', label: 'Ο οδηγός για το πώς υπολογίζεται ο ΕΝΦΙΑ' },
      },
      {
        q: `Σε πόσες δόσεις πληρώνεται ο ΕΝΦΙΑ ${ENFIA_YEAR};`,
        a: `Εφάπαξ ή σε ${enfiaInstalmentRule(ENFIA_YEAR)} ${enfiaInstalmentDates(ENFIA_YEAR)}`,
        link: { href: '/odigos/enfia-2026-pliromi-doseis-pistopoiitiko', label: 'Ο οδηγός πληρωμής, δόσεων και πιστοποιητικού' },
      },
      {
        q: 'Πώς βγάζω πιστοποιητικό ΕΝΦΙΑ;',
        a: `Ηλεκτρονικά, χωρίς κόστος, από το ${ENFIA_PORTAL}, με τον ΑΤΑΚ του ακινήτου. Δεν χρειάζεται να έχεις `
          + 'εξοφλήσει ληξιπρόθεσμες οφειλές ΕΝΦΙΑ για να το εκδώσεις.',
        link: { href: '/odigos/enfia-2026-pliromi-doseis-pistopoiitiko', label: 'Τα βήματα στο myAADE' },
      },
      {
        q: 'Ποιες άλλες προθεσμίες έχει ο ιδιοκτήτης;',
        a: 'Το Ε9 για κάθε αλλαγή στην περιουσία, τη δήλωση εισοδήματος με το Ε2, τη δήλωση κάθε μίσθωσης στην ΑΑΔΕ και, '
          + 'όπου υπάρχει βραχυχρόνια μίσθωση, τις μηνιαίες της δηλώσεις. Ο οδηγός προθεσμιών τις γράφει με ημερομηνία, '
          + 'υπεύθυνο και επίσημη πηγή.',
        link: { href: '/odigos/forologikes-prothesmies-idioktiton', label: 'Οι φορολογικές προθεσμίες του ιδιοκτήτη' },
      },
    ],
  },
  'vraxyxronia-misthosi': {
    answer: 'Για βραχυχρόνια μίσθωση χρειάζεσαι ΑΜΑ από το Μητρώο Ακινήτων Βραχυχρόνιας Διαμονής της ΑΑΔΕ, γραμμένο σε '
      + `κάθε αγγελία. Ανά διανυκτέρευση εισπράττεις τέλος ανθεκτικότητας, από ${eur(LEVY_MIN)} έως ${eur(LEVY_MAX)} ανάλογα `
      + `με την περίοδο και το ακίνητο. Το εισόδημα φορολογείται με την κλίμακα των ενοικίων όσο έχεις ${STR_MAX_PROPERTIES} `
      + `και δεν παρέχεις υπηρεσίες· με ${STR_BUSINESS_PROPERTIES_OR_MORE} γίνεται επιχειρηματικό.`,
    lede: <>
      Εδώ είναι μαζί η εγγραφή στο Μητρώο και οι περιοχές όπου έχει ανασταλεί, οι προδιαγραφές του ακινήτου, το τέλος
      ανθεκτικότητας με τις δύο περιόδους του και ο φόρος εισοδήματος. Αν διαλέγεις ανάμεσα σε βραχυχρόνια και
      μακροχρόνια, ο υπολογιστής τις βάζει δίπλα δίπλα στα δικά σου ποσά. Η{' '}
      <HubLink href={METHOD_PATH}>μεθοδολογία</HubLink> λέει από πού έρχεται κάθε αριθμός.
    </>,
    limits: 'short',
    facts: [
      { k: 'Κλίμακα ενοικίων με', v: STR_MAX_PROPERTIES },
      { k: 'Τεκμαρτή έκπτωση', v: DEDUCTION },
      { k: 'Νέοι ΑΜΑ, κέντρο Αθήνας', v: `όχι ως ${grDate(ATHENS.to)}` },
    ],
    scale: [
      { k: `τέλος ανά βράδυ, έως ${SQM} τ.μ.`, v: `${eur(LEVY.small.low)} έως ${eur(LEVY.small.high)}` },
      { k: `τέλος ανά βράδυ, άνω των ${SQM} τ.μ.`, v: `${eur(LEVY.large.low)} έως ${eur(LEVY.large.high)}` },
    ],
    faq: [
      {
        q: 'Χρειάζομαι ΑΜΑ για να νοικιάσω σε Airbnb;',
        a: 'Ναι. Κάθε ακίνητο βραχυχρόνιας μίσθωσης εγγράφεται στο Μητρώο Ακινήτων Βραχυχρόνιας Διαμονής της ΑΑΔΕ και ο '
          + `Αριθμός Μητρώου Ακινήτου (ΑΜΑ) αναγράφεται σε κάθε αγγελία. Στο ${ATHENS.area} δεν εκδίδονται νέοι ΑΜΑ έως `
          + `τις ${grDate(ATHENS.to)}. Το ίδιο ισχύει στην ${THESS.area} από ${grDate(THESS.from)} έως ${grDate(THESS.to)}.`,
        link: { href: '/odigos/vraxyxronia-ama-prodiagrafes-2026', label: 'Ο οδηγός για τον ΑΜΑ και τις προδιαγραφές' },
      },
      {
        q: 'Πόσο είναι το τέλος ανθεκτικότητας ανά διανυκτέρευση;',
        a: `Για διαμέρισμα βραχυχρόνιας ή μονοκατοικία έως ${SQM} τ.μ.: ${eur(LEVY.small.high)} από Απρίλιο έως Οκτώβριο `
          + `και ${eur(LEVY.small.low)} από Νοέμβριο έως Μάρτιο. Για μονοκατοικία άνω των ${SQM} τ.μ.: ${eur(LEVY.large.high)} `
          + `και ${eur(LEVY.large.low)} αντίστοιχα. Το πληρώνει ο επισκέπτης· ο οικοδεσπότης το εισπράττει και το αποδίδει στην ΑΑΔΕ.`,
        link: { href: '/odigos/airbnb-takk-2026', label: 'Ο οδηγός φορολογίας Airbnb 2026' },
      },
      {
        q: 'Πώς φορολογείται το εισόδημα από βραχυχρόνια μίσθωση;',
        a: `Χωρίς παροχή υπηρεσιών και με ${STR_MAX_PROPERTIES}, με την κλίμακα των ενοικίων (${RENT_SCALE}) μετά την `
          + `τεκμαρτή έκπτωση ${DEDUCTION}. Με ${STR_BUSINESS_PROPERTIES} το εισόδημα είναι επιχειρηματικό. Το τέλος `
          + 'ανθεκτικότητας δεν είναι φόρος εισοδήματος· μετρά χωριστά.',
        link: { href: '/odigos/airbnb-takk-2026', label: 'Πώς φορολογείται το εισόδημα από Airbnb' },
      },
      {
        q: 'Βραχυχρόνια ή μακροχρόνια: ποια αφήνει περισσότερα;',
        a: 'Εξαρτάται από την πληρότητα, την τιμή ανά βράδυ, την προμήθεια της πλατφόρμας και τα έξοδα καθαριότητας. Ο '
          + 'υπολογιστής «Βραχυχρόνια ή μακροχρόνια» τα βάζει δίπλα δίπλα, με φόρο και τέλος ανθεκτικότητας, στα δικά σου ποσά.',
        link: { href: toolHref('/vraxyxronia-i-makroxronia'), label: 'Σύγκρινε βραχυχρόνια και μακροχρόνια' },
      },
    ],
  },
};

/** Το κείμενο ενός κόμβου. Κόμβος του καταλόγου χωρίς κείμενο σπάει το χτίσιμο. */
export function hubCopy(h: TopicHub): HubCopy {
  const c = COPY[h.slug];
  if (!c) throw new Error(`${hubPath(h)}: κόμβος χωρίς κείμενο στο app/thema/HubPage.tsx`);
  return c;
}

/** Οι κάρτες των οδηγών του κόμβου, από τον κατάλογο (οδηγός εκτός καταλόγου σπάει το χτίσιμο). */
function guideCards(h: TopicHub): CardItem[] {
  return h.guides.map(href => {
    const g = LISTED_GUIDES.find(x => x.href === href);
    if (!g) throw new Error(`${hubPath(h)}: ο ${href} δεν είναι οδηγός του καταλόγου`);
    return { href: g.href, title: g.title, desc: g.desc, kind: 'guide' as const, cta: 'Διάβασε τον οδηγό' };
  });
}

/** Οι κάρτες των υπολογιστών του κόμβου, από το PUBLIC_TOOLS. */
function toolCards(h: TopicHub): CardItem[] {
  return h.tools.map(href => {
    const t = PUBLIC_TOOLS.find(x => x.href === href);
    if (!t) throw new Error(`${hubPath(h)}: ο ${href} δεν είναι δημόσιος υπολογιστής`);
    return { href: t.href, title: t.label, desc: t.desc, kind: 'tool' as const, cta: 'Άνοιξε τον υπολογισμό' };
  });
}

/** «1 οδηγός», «3 οδηγοί»: το πλήθος από τον κατάλογο. */
const guidesLabel = (n: number) => `${n} ${n === 1 ? 'οδηγός' : 'οδηγοί'}`;
const toolsLabel = (n: number) => `${n} ${n === 1 ? 'υπολογιστής' : 'υπολογιστές'}`;

/** Το δομημένο σχήμα: οργανισμός, συλλογή με τα μέλη της, διαδρομή και οι ορατές ερωτήσεις. */
export function hubJsonLd(h: TopicHub) {
  const url = siteUrl(hubPath(h));
  const items = [...guideCards(h), ...toolCards(h)];
  const c = hubCopy(h);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      organizationNode(),
      {
        '@type': 'CollectionPage',
        '@id': `${url}#page`,
        url,
        name: h.title,
        description: h.desc,
        inLanguage: 'el',
        dateModified: hubUpdated(h),
        publisher: ORG_REF,
        author: ORG_REF,
        isPartOf: { '@type': 'WebSite', url: siteUrl('/'), publisher: ORG_REF },
        breadcrumb: { '@id': `${url}#breadcrumb` },
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, url: siteUrl(it.href), name: it.title })),
        },
      },
      { '@id': `${url}#breadcrumb`, ...breadcrumbJsonLd([{ name: 'Οδηγοί', path: '/odigos' }, { name: h.label, path: hubPath(h) }]) },
      {
        '@type': 'FAQPage',
        mainEntity: c.faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      },
    ],
  };
}

export function HubPage({ hub }: { hub: TopicHub }) {
  const c = hubCopy(hub);
  const guides = guideCards(hub);
  const tools = toolCards(hub);
  const rules = ruleRows(hub.rules);
  const updated = hubUpdated(hub);
  const others = HUBS.filter(h => h.slug !== hub.slug);
  // Ο πρώτος μήνας με προθεσμία από σήμερα (lib/seo/prothesmies.ts): ο ίδιος που ανοίγει ως σελίδα.
  const month = c.deadlines ? upcomingMonths(athensToday())[0] : undefined;

  const aside = <>
    <FactCard title="Με μια ματιά" scale={c.scale} facts={c.facts} note={c.factsNote} />
    <LinkBox title="Συνέχισε με" links={[
      ...others.map(h => ({ href: hubPath(h), label: h.label })),
      { href: METHOD_PATH, label: METHOD_LABEL },
    ]} />
  </>;

  const legal = (
    <Section id="nomiki-vasi" over="Νομική βάση" title="Από πού βγαίνουν οι κανόνες">
      {/* Κλειστή, όπως το μητρώο της μεθοδολογίας: η γραμμή λέει πόσοι κανόνες και πόσοι ελεγμένοι. */}
      <div className="th-folds">
        <Fold title="Οι κανόνες και οι πηγές τους" meta={rulesMeta(rules)}>
          <RuleList label={`Νομική βάση: ${hub.label}`} rows={rules} />
        </Fold>
      </div>
      <p style={{ margin: `${T.sp.md}px 0 0`, fontSize: 13, lineHeight: 1.6, color: 'var(--text-tertiary)', textWrap: 'pretty' }}>
        {'Τα ποσά είναι ενδεικτικά και δεν αντικαθιστούν το εκκαθαριστικό της ΑΑΔΕ ή τον λογιστή σου. '}
        <Link href={METHOD_PATH} className="lp-link po-tap-inline" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>{METHOD_LABEL}</Link>
      </p>
    </Section>
  );

  return (
    <div className="po-tool-page" data-mode="dark" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', minHeight: '100vh', fontFamily: T.font.sans }}>
      <JsonLd data={hubJsonLd(hub)} />
      <PublicHeader current="odigos" />

      {/* `data-nohy`: κανένα μαλακό ενωτικό, όπως στους δύο κόμβους και στους οδηγούς. */}
      <main data-nohy="" style={{ ...WRAP, padding: `clamp(24px,3.4vw,40px) ${WRAP_PAD} clamp(40px,5vw,56px)` }}>
        <Crumbs trail={[{ href: '/odigos', label: 'Οδηγοί' }]} current={hub.label} />
        <TwoCol asideLabel={`Σύνοψη: ${hub.label}`} aside={aside} main={<>
          <h1 style={{ fontSize: 'clamp(28px,4.4vw,42px)', fontWeight: T.weight.bold, letterSpacing: '-0.035em',
            lineHeight: 1.1, margin: '0 0 14px', textWrap: 'balance' }}>
            {hub.title}
          </h1>
          <Byline updated={updated} checked={taxLimitAsOf(c.limits).checkedAt} anchor={{ href: '#nomiki-vasi', label: 'Νομική βάση' }} />
          <GuideQuickAnswer>{c.answer}</GuideQuickAnswer>
          <p style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0, textWrap: 'pretty' }}>{c.lede}</p>
        </>} />

        <Section id="odigoi" over={`${guidesLabel(guides.length)} · ${toolsLabel(tools.length)}`} title="Οδηγοί και υπολογιστές">
          <CardGrid items={[...guides, ...tools]} />
        </Section>

        {month ? <>
          {/* ΕΝΦΙΑ: αριστερά νομική βάση και ερωτήσεις, δεξιά οι προθεσμίες του μήνα. */}
          <div className="th-split">
            <div>
              {legal}
              <FaqGrid id="syxnes-erotiseis" title={hub.label} faq={c.faq} />
            </div>
            <Section id="prothesmies" over="Προθεσμίες" title="Τι λήγει στη συνέχεια">
              <MonthDeadlines month={month} heading="h3" linkTitle flush />
              <p style={{ margin: `${T.sp.sm}px 0 0`, fontSize: 15 }}>
                <Link href={PROTHESMIES_PATH} className="lp-link po-tap" style={TAP_LINK}>Όλες οι προθεσμίες, μήνα με μήνα</Link>
              </p>
            </Section>
          </div>
        </> : (
          // Νομική βάση και ερωτήσεις δίπλα δίπλα από τα 1024: δύο στήλες μίας λίστας.
          <div className="th-split">
            {legal}
            <FaqGrid id="syxnes-erotiseis" title={hub.label} faq={c.faq} />
          </div>
        )}
      </main>

      <PublicFooter />
    </div>
  );
}
