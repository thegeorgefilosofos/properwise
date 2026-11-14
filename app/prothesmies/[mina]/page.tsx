// ═══════════════════════════════════════════════════════════════════════════
// /prothesmies/yyyy-mm — οι προθεσμίες του ιδιοκτήτη ενός μήνα
// ─────────────────────────────────────────────────────────────────────────
// Χτίζονται οι δώδεκα επόμενοι μήνες που έχουν προθεσμία (`upcomingMonths`)·
// κάθε άλλος μήνας με προθεσμία στο ημερολόγιο χτίζεται την πρώτη φορά που
// ζητηθεί. Μήνας χωρίς καμία προθεσμία, ή κάτι που δεν είναι μήνας, δίνει 404:
// δεν υπάρχει άδεια σελίδα για να ευρετηριαστεί. Ξαναχτίζονται μία φορά την ημέρα.
// ═══════════════════════════════════════════════════════════════════════════
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { siteUrl } from '@/lib/core/site';
import { athensToday } from '@/lib/core/time';
import { PROTHESMIES_PATH, deadlinesOfMonth, monthKeyOf, monthLabel, monthLabelAcc, monthPath, parseMonthKey, upcomingMonths } from '@/lib/seo/prothesmies';
import { shareImage } from '../../og/share';
import { publicMetadata } from '../../publicMetadata';
import { ProthesmiesPage, prothesmiesJsonLd, HUB_NAME, H1_STYLE } from '../view';

export const revalidate = 86400;

export function generateStaticParams() {
  return upcomingMonths(athensToday()).map(mina => ({ mina }));
}

const titleOf = (m: string) => `${HUB_NAME} ${monthLabel(m)}: ΕΝΦΙΑ και δηλώσεις`;
const descOf = (m: string) =>
  `Οι ${deadlinesOfMonth(m).length} προθεσμίες ιδιοκτήτη ακινήτου τον ${monthLabelAcc(m)}: ΕΝΦΙΑ, βραχυχρόνια μίσθωση και δηλώσεις, με ημερομηνία και επίσημη πηγή.`;

const valid = (m: string) => !!parseMonthKey(m) && deadlinesOfMonth(m).length > 0;

/**
 * ΠΕΡΑΣΜΕΝΟΣ ΜΗΝΑΣ, ΕΚΤΟΣ ΕΥΡΕΤΗΡΙΟΥ (14/11/2026). Η σελίδα ενός μήνα που πέρασε
 * απαντά ακόμη σε όποιον έχει τη διεύθυνση, αλλά οι προθεσμίες της έχουν λήξει:
 * στην αναζήτηση θα έβγαινε ο Οκτώβριος σε όποιον ψάχνει τον Νοέμβριο. Ο χάρτης
 * δηλώνει ήδη μόνο τους επόμενους μήνες (`upcomingMonths`). Οι σύνδεσμοι
 * ακολουθούνται (`follow`), ώστε ο κόμβος και ο τρέχων μήνας να μη χάνουν τίποτα.
 *
 * ΧΩΡΙΣ canonical ΠΡΟΣ ΤΟΝ ΤΡΕΧΟΝΤΑ ΜΗΝΑ. Δεν είναι αντίγραφό του: άλλες
 * προθεσμίες, άλλη ημερομηνία. Ένα canonical σε άλλη σελίδα δίπλα σε `noindex`
 * είναι δύο αντικρουόμενα σήματα· όπως στο lib/seo/noindex.ts, το `alternates`
 * μένει κενό, ώστε να μην κληρονομηθεί και το canonical της ρίζας.
 */
const isPast = (m: string) => m < monthKeyOf(athensToday());

export async function generateMetadata({ params }: { params: Promise<{ mina: string }> }): Promise<Metadata> {
  const { mina } = await params;
  if (!valid(mina)) return {};
  const meta = publicMetadata({ title: titleOf(mina), description: descOf(mina), url: siteUrl(monthPath(mina)), image: shareImage('prothesmies') });
  return isPast(mina) ? { ...meta, robots: { index: false, follow: true }, alternates: {} } : meta;
}

export default async function Page({ params }: { params: Promise<{ mina: string }> }) {
  const { mina } = await params;
  if (!valid(mina)) notFound();
  return (
    <ProthesmiesPage
      heading={<h1 style={H1_STYLE}>{titleOf(mina)}</h1>}
      intro={<>Ό,τι λήγει τον {monthLabelAcc(mina)} για όποιον έχει ακίνητο, με σειρά ημερομηνίας. Οι ημερομηνίες
        είναι του φορολογικού ημερολογίου της εφαρμογής, με την επίσημη πηγή δίπλα σε κάθε μία.</>}
      months={[mina]} today={athensToday()} nav={mina}
      jsonLd={prothesmiesJsonLd({ name: titleOf(mina), description: descOf(mina), path: monthPath(mina), months: [mina],
        crumbs: [{ name: HUB_NAME, path: PROTHESMIES_PATH }, { name: monthLabel(mina), path: monthPath(mina) }] })} />
  );
}
