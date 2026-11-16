// Ο χάρτης ιστότοπου για τον άνθρωπο (app/xartis/SiteMapView.tsx). Η ίδια λίστα
// για τις μηχανές είναι το /sitemap.xml (app/sitemap.ts).
import type { Metadata } from 'next';
import { publicMetadata } from '../publicMetadata';
import { SiteMapView, siteMapMeta, siteMapH1, H1_STYLE } from './SiteMapView';

export const metadata: Metadata = publicMetadata(siteMapMeta('el'));

export default function Page() {
  return <SiteMapView locale="el" heading={<h1 style={H1_STYLE}>{siteMapH1('el')}</h1>} />;
}
