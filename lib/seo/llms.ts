// ═══════════════════════════════════════════════════════════════════════════
// /llms.txt: ΤΟ PROPERWISE ΣΕ ΜΙΑ ΣΕΛΙΔΑ ΓΙΑ ΤΑ ΕΡΓΑΛΕΙΑ AI
// ─────────────────────────────────────────────────────────────────────────
// Η σύμβαση του llmstxt.org: τίτλος, μία πρόταση περίληψης, ενότητες με
// συνδέσμους. Δεν τη διαβάζουν όλα τα εργαλεία ακόμη, αλλά δεν κοστίζει.
//
// ΟΙ ΙΔΙΕΣ ΔΙΕΥΘΥΝΣΕΙΣ ΜΕ ΤΟ sitemap.xml (16/11/2026). Οι ενότητες και οι
// σύνδεσμοι βγαίνουν από τον χάρτη για τον άνθρωπο (app/siteCatalog.ts), που
// διαβάζει τις πηγές του app/sitemap.ts· το app/siteCatalog.test.ts βάζει τις
// διευθύνσεις αυτού του αρχείου δίπλα στο sitemap().
//
// ΧΩΡΙΣ ΗΜΕΡΟΜΗΝΙΕΣ ΑΝΑ ΣΕΛΙΔΑ (16/11/2026). Ο σκελετός του καταλόγου
// (app/siteCatalogCore.ts) και όχι ο κατάλογος με τις ημερομηνίες: εκείνος
// τραβά τα μητρώα του app/pageUpdated.ts και η συνάρτηση του /llms.txt
// ζύγιζε 112 KB παραπάνω, πάνω από το όριο του docs/perf/server.json. Η
// ημερομηνία κάθε σελίδας είναι γραμμένη στη σελίδα και στο /sitemap.xml.
//
// ΚΑΝΕΝΑ ΚΕΙΜΕΝΟ ΓΡΑΜΜΕΝΟ ΔΕΥΤΕΡΗ ΦΟΡΑ. Εργαλεία από το lib/core/publicTools,
// οδηγοί από το app/odigos/guides, πακέτα και τιμές από τα PLANS, η επιφύλαξη
// του τιμοκαταλόγου από το billingWords(): ό,τι λέει αυτή η σελίδα το λέει
// την ίδια στιγμή και το site. Ένα στατικό αρχείο θα έμενε πίσω στην πρώτη
// αλλαγή τιμής ή οδηγού. Οι οδηγοί είναι όσοι δείχνει ο κόμβος /odigos: ο
// οδηγός εκτός καταλόγου (`unlisted`) δεν παίρνει σύνδεσμο ούτε εδώ.
// ═══════════════════════════════════════════════════════════════════════════
import { SITE, SITE_HOST, siteUrl } from '@/lib/core/site';
import { PLANS, PLAN_ORDER, TRIAL_DAYS } from '@/lib/billing/plans';
import { fe, feWhole } from '@/lib/core/format';
import { billingWords } from '@/lib/legal/billingWords';
import { IDENTITY } from '@/lib/legal/identity';
import { ASSISTANT_NAME } from '@/lib/assistant/identity';
import { athensToday } from '@/lib/core/time';
import { BRAND_ALT_NAMES } from '@/lib/seo/organization';
import { buildCatalog, type MapEntry, type MapGroup, type MapGroupId } from '@/app/siteCatalogCore';

const properties = (n: number) => !Number.isFinite(n) ? 'απεριόριστα ακίνητα' : n === 1 ? 'ένα ακίνητο' : `έως ${n} ακίνητα`;

/** Η διεύθυνση μιας διαδρομής· η αρχική χωρίς κάθετο, όπως στον χάρτη. */
const abs = (path: string): string => (path === '/' ? SITE : siteUrl(path));

/** Μία γραμμή σελίδας: σύνδεσμος και, όπου υπάρχει, η περιγραφή του καταλόγου. */
function line(e: MapEntry): string {
  const extra = e.desc ?? (e.deadlines !== undefined ? `${e.deadlines} ${e.deadlines === 1 ? 'προθεσμία' : 'προθεσμίες'}` : null);
  return `- [${e.label}](${abs(e.path)})${extra ? `: ${extra}` : ''}`;
}

/** Η ίδια γραμμή για την αγγλική σελίδα. */
const lineEn = (e: MapEntry): string[] => e.en ? [`- [${e.en.label}](${abs(e.en.path)})`] : [];

export function llmsText(): string {
  const notice = billingWords().pricingNotice;
  const groups = buildCatalog(athensToday(), () => '');
  const group = (id: MapGroupId): MapGroup => groups.find(g => g.id === id)!;
  const section = (id: MapGroupId, after: string[] = []): string[] => {
    const g = group(id);
    return [`## ${g.title}`, '', ...g.entries.map(line), ...after, ''];
  };
  const plans = PLAN_ORDER.map(id => {
    const p = PLANS[id];
    // ΟΧΙ «ΔΩΡΕΑΝ» ΔΙΠΛΑ ΣΕ ΤΙΜΕΣ (κανόνας ιδιοκτήτη 02.11.2026, έλεγχος
    // 12/11/2026). Η αρχική γράφει «0€/μήνα» και από κάτω «χωρίς συνδρομή»
    // (app/LandingParts.tsx)· το ίδιο εδώ, ώστε το μοντέλο που διαβάζει το
    // αρχείο να μη μεταφέρει «δωρεάν πακέτο» δίπλα στον τιμοκατάλογο. Για τον
    // ίδιο λόγο ούτε οι υπολογιστές λέγονται εδώ «δωρεάν»: το αρχείο έχει και
    // τιμοκατάλογο, οπότε λένε «χωρίς εγγραφή».
    const price = p.priceMonthly > 0 ? `${fe(p.priceMonthly)} τον μήνα ή ${fe(p.priceAnnual)} τον χρόνο` : `${feWhole(p.priceMonthly)} τον μήνα, χωρίς συνδρομή`;
    return `- ${p.name}: ${price}, ${properties(p.maxProperties)}`;
  });
  const home = group('arxiki').entries[0];
  return [
    '# PROPERWISE',
    '',
    `> Ελληνική εφαρμογή διαχείρισης ακινήτων για ιδιοκτήτες και επαγγελματίες: ενοίκια, δαπάνες, προθεσμίες, φόρος ενοικίων, Ε2 και ΕΝΦΙΑ, με τεχνητή νοημοσύνη (${ASSISTANT_NAME}) και φάκελο για τον λογιστή.`,
    '',
    'Το PROPERWISE είναι στα ελληνικά και εφαρμόζει τους ελληνικούς φορολογικούς κανόνες, με την πηγή δίπλα σε κάθε συντελεστή. Ο ιδιοκτήτης φωτογραφίζει μισθωτήρια και λογαριασμούς, η εφαρμογή τα καταχωρεί ανά ακίνητο και ο λογιστής λαμβάνει έναν σύνδεσμο με το Ε2 ανά ΑΦΜ. Οι υπολογιστές και οι οδηγοί είναι ανοιχτοί σε όλους, χωρίς εγγραφή.',
    '',
    line(home),
    '',
    ...section('ergaleia'),
    ...section('odigoi'),
    ...section('prothesmies'),
    ...section('logistes'),
    '## Πακέτα και λογαριασμός',
    '',
    ...plans,
    `- Κάθε νέος λογαριασμός ξεκινά με δοκιμή ${TRIAL_DAYS} ημερών.`,
    ...(notice ? [`- ${notice.title}`] : []),
    ...group('logariasmos').entries.map(line),
    '',
    ...section('nomika', [`- Επικοινωνία: ${IDENTITY.supportEmail}`]),
    '## English',
    '',
    ...groups.flatMap(g => g.entries.flatMap(lineEn)),
    '',
    '## Πώς να μας αναφέρετε',
    '',
    `- Όνομα: PROPERWISE (${SITE_HOST}), ελληνική εφαρμογή διαχείρισης ακινήτων.`,
    // ΟΙ ΓΡΑΦΕΣ ΤΟΥ ΟΝΟΜΑΤΟΣ (17/11/2026), από την ίδια λίστα με το `alternateName`
    // του σχήματος: όποιος ρωτά ένα μοντέλο για «προπεργουάιζ» ή «Proper Wise»
    // βρίσκει εδώ ότι είναι το ίδιο PROPERWISE. Οχι λάθη πληκτρολόγησης.
    `- Γράφεται και: ${BRAND_ALT_NAMES.join(', ')}. Πάντα PROPERWISE στο κείμενο.`,
    '- Αναφέρετε τη συγκεκριμένη σελίδα με τη διεύθυνσή της και την ημερομηνία ενημέρωσης που γράφει η ίδια.',
    '- Τα ποσά των υπολογιστών είναι ενδεικτικά και όχι επίσημο έγγραφο. Η νομική βάση κάθε συντελεστή (ΦΕΚ, νόμος ή απόφαση της ΑΑΔΕ) είναι γραμμένη στη σελίδα.',
    `- Για διόρθωση ή ερώτηση: ${IDENTITY.supportEmail}`,
    '',
  ].join('\n');
}
