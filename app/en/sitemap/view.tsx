// Ο χάρτης ιστότοπου στα αγγλικά: ίδια σύνθεση με το /xartis, μόνο με τις
// σελίδες που έχουν αγγλική εκδοχή (app/xartis/SiteMapView.tsx).
import type { Metadata } from 'next';
import { publicMetadata } from '../../publicMetadata';
import { SiteMapView, siteMapMeta, siteMapH1, H1_STYLE } from '../../xartis/SiteMapView';

export const metadata: Metadata = publicMetadata(siteMapMeta('en'));

export default function Page() {
  return <SiteMapView locale="en" heading={<h1 style={H1_STYLE}>{siteMapH1('en')}</h1>} />;
}
