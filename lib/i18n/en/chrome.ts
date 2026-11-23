// ═══════════════════════════════════════════════════════════════════════════
// Η ΚΟΙΝΗ ΚΕΦΑΛΙΔΑ ΚΑΙ ΤΟ ΥΠΟΣΕΛΙΔΟ ΣΤΑ ΑΓΓΛΙΚΑ (app/PublicChrome.tsx)
// ─────────────────────────────────────────────────────────────────────────
// Οι σύνδεσμοι γράφονται με την ΕΛΛΗΝΙΚΗ διαδρομή και περνούν από το
// `enLinks`, που κρατά μόνο όσους έχουν αγγλική σελίδα. Ετσι μια σελίδα που
// δεν μεταφράστηκε ακόμη δεν εμφανίζεται, αντί να οδηγεί σε 404 ή σε
// ελληνικό κείμενο. Εμφανίζεται μόνη της τη μέρα που θα μπει στον χάρτη.
// ═══════════════════════════════════════════════════════════════════════════
import { enPathFor } from '@/lib/i18n/paths';

type L = [string, string];

/** Οι σύνδεσμοι με αγγλική σελίδα, με τη διαδρομή της. Η άγκυρα μένει. */
export function enLinks(links: readonly L[]): L[] {
  return links.flatMap(([el, text]) => {
    const [path, hash] = el.split('#');
    const en = enPathFor(path || '/');
    return en ? [[hash ? `${en}#${hash}` : en, text] as L] : [];
  });
}

export const CHROME_EN = {
  menu: 'Menu',
  nav: {
    guides: ['/odigos', 'Guides'] as L,
    pricing: ['/paketa', 'Pricing'] as L,
    about: ['/trust', 'About'] as L,
    login: ['/login', 'Log in'] as L,
    calcs: 'Calculators',
    allTools: 'All tools',
    start: 'Start',
  },
  foot: {
    about: ['Costs, taxes and deadlines for property in Greece.', 'For owners and professionals.'] as [string, string],
    product: 'Product', home: 'Home', pricing: 'Plans and pricing', accountants: 'For accountants', faq: 'FAQ',
    guides: 'Guides',
    // Τα ίδια τέσσερα θέματα με την ελληνική στήλη (app/PublicChrome.tsx,
    // FOOT_GUIDES): κανένας οδηγός που ξαναλέει υπολογισμό της διπλανής στήλης.
    guideLinks: [
      ['/odigos/airbnb-takk-2026', 'Airbnb tax in 2026'],
      ['/odigos/forologikes-prothesmies-idioktiton', 'Property tax calendar'],
      ['/odigos/plafon-3-emporikes-misthoseis-2026', 'Commercial rent cap'],
      ['/odigos/spiti-mou-3-ti-allazei', 'Spiti mou III home loans'],
    ] as L[],
    allGuides: 'All guides',
    allCalcs: 'All calculators',
    trust: 'Trust',
    trustLinks: [
      ['/trust', 'About us'],
      ['/privacy', 'Privacy'],
      ['/terms', 'Terms of use'],
      ['/trust#epikoinonia', 'Contact'],
    ] as L[],
    withdraw: 'Withdraw from your contract here',
    db: 'Database in the EU (Frankfurt)',
    siteMap: ['/xartis', 'Site map'] as L,
    social: (net: string, newTab: boolean) => newTab ? `PROPERWISE on ${net} (opens in a new tab)` : `PROPERWISE on ${net}`,
  },
};
