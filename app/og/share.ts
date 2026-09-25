// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΚΑΡΤΕΣ ΚΟΙΝΟΠΟΙΗΣΗΣ ΤΩΝ ΔΗΜΟΣΙΩΝ ΣΕΛΙΔΩΝ, ΣΕ ΕΝΑΝ ΚΑΤΑΛΟΓΟ
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΜΙΑ ΔΙΑΔΡΟΜΗ ΚΑΙ ΟΧΙ ΕΝΑ opengraph-image.tsx ΑΝΑ ΣΕΛΙΔΑ. Κάθε τέτοιο
// αρχείο γίνεται δική του συνάρτηση στον διακομιστή, με ~4,5 MB του Next μέσα
// της· κάθε συνάρτηση ανεβαίνει χωριστά σε κάθε ανάπτυξη. Εννέα κάρτες
// ανέβασαν το βάρος ανά ανάπτυξη από 207 σε 262 MB. Εδώ όλες βγαίνουν από το
// /og/<slug>: μία συνάρτηση, στατική, χτισμένη μία φορά στο build.
//
// ΤΟ ΑΡΧΕΙΟ ΔΕΝ ΦΕΡΝΕΙ ΤΟ next/og. Τον κατάλογο τον διαβάζουν και τα
// μεταδεδομένα των σελίδων· αν ζούσε μαζί με τη σχεδίαση της κάρτας, κάθε
// σελίδα θα κουβαλούσε τη μηχανή εικόνων στο ίχνος της.
// ═══════════════════════════════════════════════════════════════════════════
import { SHARE_IMAGE } from '@/lib/core/site';
import { GUIDES, guideSlug } from '../odigos/guides';
import { RENTAL_TAX_BRACKETS_2026, FIRST_YEAR_NEW_BRACKETS } from '@/lib/billing/greekTax';
import { fpRate } from '@/lib/core/format';

export type ShareCard = {
  kind: 'guide' | 'calc';
  over: string;
  title: string;
  /** Σύντομα γεγονότα της σελίδας για την κάρτα (app/og/frame.tsx). */
  chips: readonly string[];
  /** Η διαδρομή της σελίδας, γραμμένη στο κάτω μέρος της κάρτας. */
  path: string;
};

// ΤΑ ΓΕΓΟΝΟΤΑ ΤΗΣ ΚΑΡΤΑΣ ΕΡΧΟΝΤΑΙ ΑΠΟ ΤΙΣ ΠΗΓΕΣ ΤΟΥΣ. Οι συντελεστές από την
// κλίμακα του νόμου, η ημερομηνία από τον κατάλογο των οδηγών. Ποσά
// αποτελέσματος δεν μπαίνουν: η πλατφόρμα κρατά την εικόνα εβδομάδες.
const RENT_RATES = RENTAL_TAX_BRACKETS_2026.map(b => fpRate(b.rate * 100)).join(' · ');
const dotted = (iso: string) => iso.split('-').reverse().join('.');

export const SHARE_CARDS: Record<string, ShareCard> = {
  'ypologismos-enfia': { kind: 'calc', over: 'Υπολογιστής', title: 'Υπολόγισε τον ΕΝΦΙΑ του ακινήτου σου',
    chips: ['Τετραγωνικά', 'Τιμή ζώνης', 'Όροφος', 'Παλαιότητα'], path: '/ypologismos-enfia' },
  'ypologismos-forou-enoikion': { kind: 'calc', over: 'Υπολογιστής', title: 'Πόσο φόρο θα πληρώσεις για τα ενοίκιά σου',
    chips: [`Κλίμακα ${FIRST_YEAR_NEW_BRACKETS}`, RENT_RATES, 'Με το δικό σου ενοίκιο'], path: '/ypologismos-forou-enoikion' },
  'kathari-apodosi': { kind: 'calc', over: 'Υπολογιστής', title: 'Πόσο αποδίδει πραγματικά το ακίνητό σου',
    chips: ['Μεικτή και καθαρή', 'Φόρος στο κλιμάκιό σου', 'ΕΝΦΙΑ και δαπάνες'], path: '/kathari-apodosi' },
  'vraxyxronia-i-makroxronia': { kind: 'calc', over: 'Υπολογιστής', title: 'Βραχυχρόνια ή μακροχρόνια;',
    chips: ['Πληρότητα', 'ΤΑΚΚ', 'Προμήθεια', 'Φόρος'], path: '/vraxyxronia-i-makroxronia' },
  'odigos': { kind: 'guide', over: 'Οδηγοί', title: 'Οδηγοί φορολογίας ακινήτων',
    chips: GUIDES.map(g => g.kicker), path: '/odigos' },
  ...Object.fromEntries(GUIDES.map(g => [guideSlug(g), {
    kind: 'guide' as const, over: 'Οδηγός', title: g.title,
    chips: [g.kicker, `Ενημερώθηκε ${dotted(g.updated)}`, 'Με τις πηγές του νόμου'], path: g.href,
  }])),
};

export type ShareSlug = keyof typeof SHARE_CARDS;

/** Η εικόνα κοινοποίησης μιας σελίδας, για το `openGraph` και την κάρτα X. */
export function shareImage(slug: ShareSlug) {
  const c = SHARE_CARDS[slug];
  return { url: `/og/${slug}`, width: SHARE_IMAGE.width, height: SHARE_IMAGE.height, alt: c.title };
}
