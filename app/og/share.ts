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

export type ShareCard = { kind: 'guide' | 'calc'; over: string; title: string };

// ΧΩΡΙΣ «ω» ΣΤΟΥΣ ΤΙΤΛΟΥΣ ΤΩΝ ΥΠΟΛΟΓΙΣΤΩΝ: βλ. το shareCard στο
// app/opengraph-image.tsx, όπου η ενσωματωμένη γραμματοσειρά το χαλά.
export const SHARE_CARDS: Record<string, ShareCard> = {
  'ypologismos-enfia': { kind: 'calc', over: 'Υπολογιστής', title: 'Υπολόγισε τον ΕΝΦΙΑ του ακινήτου σου' },
  'ypologismos-forou-enoikion': { kind: 'calc', over: 'Υπολογιστής', title: 'Πόσο φόρο θα πληρώσεις για τα ενοίκιά σου' },
  'kathari-apodosi': { kind: 'calc', over: 'Υπολογιστής', title: 'Πόσο αποδίδει πραγματικά το ακίνητό σου' },
  'vraxyxronia-i-makroxronia': { kind: 'calc', over: 'Υπολογιστής', title: 'Βραχυχρόνια ή μακροχρόνια;' },
  'odigos': { kind: 'guide', over: 'Οδηγοί', title: 'Οδηγοί φορολογίας ακινήτων' },
  ...Object.fromEntries(GUIDES.map(g => [guideSlug(g), { kind: 'guide' as const, over: g.kicker, title: g.title }])),
};

export type ShareSlug = keyof typeof SHARE_CARDS;

/** Η εικόνα κοινοποίησης μιας σελίδας, για το `openGraph` και την κάρτα X. */
export function shareImage(slug: ShareSlug) {
  const c = SHARE_CARDS[slug];
  return { url: `/og/${slug}`, width: SHARE_IMAGE.width, height: SHARE_IMAGE.height, alt: c.title };
}
