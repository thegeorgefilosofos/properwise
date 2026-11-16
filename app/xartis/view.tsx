// Ο χάρτης ιστότοπου για τον άνθρωπο (app/xartis/SiteMapView.tsx). Η ίδια λίστα
// για τις μηχανές είναι το /sitemap.xml (app/sitemap.ts).
//
// ΧΩΡΙΣ ΔΙΚΗ ΤΟΥ ΣΥΝΑΡΤΗΣΗ (16/11/2026). Κάθε `page.tsx` ανεβαίνει ως χωριστή
// συνάρτηση (~6 MB, docs/perf/server.json) και η σελίδα δεν γίνεται στατική,
// γιατί η CSP θέλει nonce ανά αίτημα. Γι' αυτό είναι `view.tsx`: το /xartis το
// ξαναγράφει το next.config.ts στο `XARTIS_INTERNAL` του διανομέα του /en
// (app/en/[[...slug]]/page.tsx), που ήδη υπάρχει. Ο διαμεσολαβητής βλέπει τη
// διεύθυνση /xartis, οπότε γλώσσα, nonce και canonical μένουν της σελίδας.
import type { Metadata } from 'next';
import { publicMetadata } from '../publicMetadata';
import { SiteMapView, siteMapMeta, siteMapH1, H1_STYLE } from './SiteMapView';

export const metadata: Metadata = publicMetadata(siteMapMeta('el'));

export default function Page() {
  return <SiteMapView locale="el" heading={<h1 style={H1_STYLE}>{siteMapH1('el')}</h1>} />;
}
