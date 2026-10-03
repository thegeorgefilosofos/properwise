// ═══════════════════════════════════════════════════════════════════════════
// /llms.txt: ΤΟ PROPERWISE ΣΕ ΜΙΑ ΣΕΛΙΔΑ ΓΙΑ ΤΑ ΕΡΓΑΛΕΙΑ AI
// ─────────────────────────────────────────────────────────────────────────
// Η σύμβαση του llmstxt.org: τίτλος, μία πρόταση περίληψης, ενότητες με
// συνδέσμους. Δεν τη διαβάζουν όλα τα εργαλεία ακόμη, αλλά δεν κοστίζει.
//
// ΚΑΝΕΝΑ ΚΕΙΜΕΝΟ ΓΡΑΜΜΕΝΟ ΔΕΥΤΕΡΗ ΦΟΡΑ. Εργαλεία από το lib/core/publicTools,
// οδηγοί από το app/odigos/guides, πακέτα και τιμές από τα PLANS, η επιφύλαξη
// του τιμοκαταλόγου από το billingWords(): ό,τι λέει αυτή η σελίδα το λέει
// την ίδια στιγμή και το site. Ένα στατικό αρχείο θα έμενε πίσω στην πρώτη
// αλλαγή τιμής ή οδηγού.
// ═══════════════════════════════════════════════════════════════════════════
import { siteUrl } from '@/lib/core/site';
import { PUBLIC_TOOLS } from '@/lib/core/publicTools';
import { GUIDES } from '@/app/odigos/guides';
import { PLANS, PLAN_ORDER, TRIAL_DAYS } from '@/lib/billing/plans';
import { fe } from '@/lib/core/format';
import { billingWords } from '@/lib/legal/billingWords';
import { IDENTITY } from '@/lib/legal/identity';
import { ASSISTANT_NAME } from '@/lib/assistant/identity';

const properties = (n: number) => !Number.isFinite(n) ? 'απεριόριστα ακίνητα' : n === 1 ? 'ένα ακίνητο' : `έως ${n} ακίνητα`;

export function llmsText(): string {
  const notice = billingWords().pricingNotice;
  const plans = PLAN_ORDER.map(id => {
    const p = PLANS[id];
    const price = p.priceMonthly > 0 ? `${fe(p.priceMonthly)} τον μήνα ή ${fe(p.priceAnnual)} τον χρόνο` : 'δωρεάν';
    return `- ${p.name}: ${price}, ${properties(p.maxProperties)}`;
  });
  return [
    '# PROPERWISE',
    '',
    `> Ελληνική εφαρμογή διαχείρισης ακινήτων για ιδιοκτήτες και επαγγελματίες: ενοίκια, δαπάνες, προθεσμίες, φόρος ενοικίων, Ε2 και ΕΝΦΙΑ, με τεχνητή νοημοσύνη (${ASSISTANT_NAME}) και φάκελο για τον λογιστή.`,
    '',
    'Το PROPERWISE είναι στα ελληνικά και εφαρμόζει τους ελληνικούς φορολογικούς κανόνες, με την πηγή δίπλα σε κάθε συντελεστή. Ο ιδιοκτήτης φωτογραφίζει μισθωτήρια και λογαριασμούς, η εφαρμογή τα καταχωρεί ανά ακίνητο και ο λογιστής λαμβάνει έναν σύνδεσμο με το Ε2 ανά ΑΦΜ. Οι υπολογιστές και οι οδηγοί είναι δωρεάν και χωρίς εγγραφή.',
    '',
    '## Δωρεάν υπολογιστές',
    '',
    ...PUBLIC_TOOLS.map(t => `- [${t.label}](${siteUrl(t.href)}): ${t.desc}`),
    '',
    '## Οδηγοί',
    '',
    ...GUIDES.map(g => `- [${g.title}](${siteUrl(g.href)}): ${g.desc}`),
    '',
    '## Πακέτα',
    '',
    ...plans,
    `- Κάθε νέος λογαριασμός ξεκινά με δοκιμή ${TRIAL_DAYS} ημερών.`,
    ...(notice ? [`- ${notice.title}`] : []),
    `- Αναλυτικά: [Τι περιλαμβάνει κάθε πακέτο](${siteUrl('/paketa')})`,
    '',
    '## Για επαγγελματίες',
    '',
    `- [Για λογιστές](${siteUrl('/logistes')}): τι βλέπει ο λογιστής και πώς λαμβάνει τον φάκελο του πελάτη.`,
    '',
    '## Σχετικά',
    '',
    `- [Ποιοι είμαστε](${siteUrl('/trust')})`,
    `- [Όροι χρήσης](${siteUrl('/terms')})`,
    `- [Πολιτική απορρήτου](${siteUrl('/privacy')})`,
    `- Επικοινωνία: ${IDENTITY.supportEmail}`,
    '',
  ].join('\n');
}
