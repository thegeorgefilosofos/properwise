// ═══════════════════════════════════════════════════════════════════════════
// /prothesmies — οι προθεσμίες του ιδιοκτήτη για τον τρέχοντα και τον επόμενο μήνα
// ─────────────────────────────────────────────────────────────────────────
// Ξαναχτίζεται μία φορά την ημέρα (`revalidate`): την 1η του μήνα ο «τρέχων»
// αλλάζει μόνος του, χωρίς νέα έκδοση. Ολο το περιεχόμενο από το φορολογικό
// ημερολόγιο (lib/seo/prothesmies.ts).
// ═══════════════════════════════════════════════════════════════════════════
import type { Metadata } from 'next';
import { siteUrl } from '@/lib/core/site';
import { athensToday } from '@/lib/core/time';
import { PROTHESMIES_PATH, deadlinesOfMonth, monthKeyOf, monthLabel, monthLabelAcc, shiftMonth } from '@/lib/seo/prothesmies';
import { shareImage } from '../og/share';
import { publicMetadata } from '../publicMetadata';
import { ProthesmiesPage, prothesmiesJsonLd, HUB_NAME, H1_STYLE } from './view';

export const revalidate = 86400;

const months = (today: string) => [monthKeyOf(today), shiftMonth(monthKeyOf(today), 1)];
const titleOf = (today: string) => `${HUB_NAME}: ${monthLabel(months(today)[0])} και ${monthLabel(months(today)[1])}`;
const descOf = (today: string) => {
  const [a, b] = months(today);
  const n = deadlinesOfMonth(a).length + deadlinesOfMonth(b).length;
  return `Οι ${n} προθεσμίες ιδιοκτήτη ακινήτου για ${monthLabelAcc(a)} και ${monthLabelAcc(b)}: ΕΝΦΙΑ, βραχυχρόνια μίσθωση και δηλώσεις, με την επίσημη πηγή της καθεμιάς.`;
};

export function generateMetadata(): Metadata {
  const today = athensToday();
  return publicMetadata({ title: titleOf(today), description: descOf(today), url: siteUrl(PROTHESMIES_PATH), image: shareImage('prothesmies') });
}

export default function Page() {
  const today = athensToday();
  const ms = months(today);
  return (
    <ProthesmiesPage
      heading={<h1 style={H1_STYLE}>{titleOf(today)}</h1>}
      intro={<>Ό,τι λήγει αυτόν και τον επόμενο μήνα για όποιον έχει ακίνητο: ΕΝΦΙΑ, δηλώσεις και, όπου υπάρχει
        βραχυχρόνια μίσθωση, οι μηνιαίες της υποχρεώσεις. Οι ημερομηνίες είναι του φορολογικού ημερολογίου της
        εφαρμογής, με την επίσημη πηγή δίπλα σε κάθε μία.</>}
      months={ms} today={today}
      jsonLd={prothesmiesJsonLd({ name: titleOf(today), description: descOf(today), path: PROTHESMIES_PATH, months: ms,
        crumbs: [{ name: HUB_NAME, path: PROTHESMIES_PATH }] })} />
  );
}
