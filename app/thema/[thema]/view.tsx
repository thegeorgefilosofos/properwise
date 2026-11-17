// Οι κόμβοι θέματος (app/thema/HubPage.tsx, κατάλογος στο app/thema/hubs.ts).
//
// ΧΩΡΙΣ ΔΙΚΗ ΤΟΥΣ ΣΥΝΑΡΤΗΣΗ (17/11/2026), όπως το /xartis. Κάθε `page.tsx`
// ανεβαίνει ως χωριστή συνάρτηση (~2 MB, docs/perf/server.json). Το
// next.config.ts ξαναγράφει το /thema/<θέμα> στο `HUB_INTERNAL` του διανομέα
// του /en (app/en/[[...slug]]/page.tsx), που καλεί το `hubView` για κάθε κόμβο
// του καταλόγου. Το `generateMetadata` με παράμετρο το διαβάζει ο φύλακας των
// περιγραφών (scripts/guard-meta-description.mjs), όπως τις δυναμικές σελίδες.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { siteUrl } from '@/lib/core/site';
import { publicMetadata } from '../../publicMetadata';
import { shareImage } from '../../og/share';
import { HubPage } from '../HubPage';
import { hubBySlug, hubPath, type TopicHub } from '../hubs';

const metaOf = (h: TopicHub): Metadata =>
  publicMetadata({ title: h.title, description: h.desc, url: siteUrl(hubPath(h)), image: shareImage(`thema-${h.slug}`) });

/** Η σελίδα και τα μεταδεδομένα ενός κόμβου, για τον κατάλογο του διανομέα. */
export function hubView(h: TopicHub) {
  return {
    default: function Page() { return <HubPage hub={h} />; },
    generateMetadata: (): Metadata => metaOf(h),
  };
}

export async function generateMetadata({ params }: { params: Promise<{ thema: string }> }): Promise<Metadata> {
  const h = hubBySlug((await params).thema);
  if (!h) notFound();
  return metaOf(h);
}
