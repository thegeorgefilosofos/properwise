// ═══════════════════════════════════════════════════════════════════════════
// ΕΝΑΣ ΧΑΡΤΗΣ: ΕΛΛΗΝΙΚΗ ΔΙΑΔΡΟΜΗ ↔ ΑΓΓΛΙΚΗ ΔΙΑΔΡΟΜΗ
// ─────────────────────────────────────────────────────────────────────────
// Από εδώ διαβάζουν ΟΛΟΙ: ο επιλογέας γλώσσας (σε ποια σελίδα πηγαίνει), οι
// ετικέτες hreflang (app/publicMetadata.ts), ο χάρτης του ιστότοπου
// (app/sitemap.ts), το proxy.ts (η πρόταση «View in English» και η μνήμη της
// επιλογής) και ο φύλακας scripts/guard-i18n-pairs.mjs, που ελέγχει ότι κάθε
// ζεύγος έχει ΚΑΙ τις δύο σελίδες.
//
// ΤΑ ΑΓΓΛΙΚΑ SLUGS ΕΙΝΑΙ ΑΓΓΛΙΚΑ. Ο Αμερικανός ψάχνει «enfia calculator», όχι
// «ypologismos enfia»· η διεύθυνση είναι κι αυτή κείμενο που διαβάζεται.
//
// ΝΕΑ ΑΓΓΛΙΚΗ ΣΕΛΙΔΑ = ΜΙΑ ΓΡΑΜΜΗ ΕΔΩ. Χωρίς αυτήν ο φύλακας κόβει: μια
// αγγλική σελίδα χωρίς ζεύγος δεν έχει hreflang και ο επιλογέας δεν ξέρει πού
// να γυρίσει.
// ═══════════════════════════════════════════════════════════════════════════
import { SITE } from '@/lib/core/site';
import { EN_PREFIX, isEnPath, type Locale } from './locale';

/** [ελληνική, αγγλική]. Η σειρά είναι η σειρά του χάρτη του ιστότοπου. */
export const PAGE_PAIRS = [
  ['/', EN_PREFIX],
  ['/paketa', '/en/pricing'],
  ['/ergaleia', '/en/tools'],
  ['/login', '/en/login'],
  ['/signup', '/en/signup'],
  ['/reset-password', '/en/reset-password'],
  ['/privacy', '/en/privacy'],
  ['/terms', '/en/terms'],
  ['/trust', '/en/trust'],
  ['/ypanaxorisi', '/en/withdrawal'],
  ['/ypologismos-enfia', '/en/enfia-calculator'],
  ['/ypologismos-forou-enoikion', '/en/rental-income-tax-calculator'],
  ['/kathari-apodosi', '/en/rental-yield-calculator'],
  ['/vraxyxronia-i-makroxronia', '/en/short-term-vs-long-term-rental'],
  ['/ypologismos-stegastikou-daneiou', '/en/mortgage-calculator'],
  ['/exoda-agoras-akinitou', '/en/property-purchase-costs'],
  ['/ypologismos-ekptosis-anakainisis', '/en/renovation-tax-credit-calculator'],
  ['/anaprosarmogi-enoikiou', '/en/rent-increase-calculator'],
  ['/symplirosi-e2', '/en/form-e2-guide'],
  ['/sygkrisi-timologion-revmatos', '/en/electricity-tariffs'],
  ['/prothesmies', '/en/tax-deadlines'],
  ['/odigos', '/en/guides'],
  ['/odigos/forologia-enoikion-2026', '/en/guides/greek-rental-income-tax-2026'],
  ['/odigos/pos-ypologizetai-o-enfia', '/en/guides/how-enfia-is-calculated'],
  ['/odigos/kathari-apodosi-akinitou', '/en/guides/net-rental-yield'],
  ['/odigos/airbnb-takk-2026', '/en/guides/airbnb-tax-greece-2026'],
  ['/odigos/vraxyxronia-ama-prodiagrafes-2026', '/en/guides/short-term-rental-registry-greece'],
  ['/odigos/enfia-2026-pliromi-doseis-pistopoiitiko', '/en/guides/enfia-payment-instalments-certificate'],
  ['/odigos/ekptosi-forou-anakainisis', '/en/guides/renovation-tax-credit-greece'],
  ['/odigos/enoikio-meso-trapezas', '/en/guides/rent-paid-through-a-bank'],
  ['/odigos/forologikes-prothesmies-idioktiton', '/en/guides/greek-property-tax-calendar'],
  ['/odigos/plafon-3-emporikes-misthoseis-2026', '/en/guides/commercial-rent-cap-greece-2026'],
  ['/odigos/spiti-mou-3-ti-allazei', '/en/guides/spiti-mou-3-greek-home-loan-program'],
  ['/logistes', '/en/for-accountants'],
] as const satisfies readonly (readonly [string, string])[];

const EL_TO_EN = new Map<string, string>(PAGE_PAIRS.map(([el, en]) => [el, en]));
const EN_TO_EL = new Map<string, string>(PAGE_PAIRS.map(([el, en]) => [en, el]));

/** Χωρίς τελική κάθετο, χωρίς ερώτημα και άγκυρα. Η ρίζα μένει «/». */
const clean = (path: string): string => {
  const p = path.split(/[?#]/)[0] || '/';
  return p.length > 1 ? p.replace(/\/+$/, '') : p;
};

/** Η αγγλική διαδρομή μιας ελληνικής σελίδας, ή null αν δεν έχει. */
export const enPathFor = (elPath: string): string | null => EL_TO_EN.get(clean(elPath)) ?? null;

/** Η ελληνική διαδρομή μιας αγγλικής σελίδας, ή null αν δεν έχει. */
export const elPathFor = (enPath: string): string | null => EN_TO_EL.get(clean(enPath)) ?? null;

/**
 * Πού οδηγεί ο επιλογέας από τη σελίδα `path` προς τη γλώσσα `to`: στην
 * αντίστοιχη σελίδα, αλλιώς στην αρχική της γλώσσας. Ποτέ σε 404.
 */
export function pathIn(path: string, to: Locale): string {
  const p = clean(path);
  const here: Locale = isEnPath(p) ? 'en' : 'el';
  if (here === to) return p;
  return to === 'en' ? (enPathFor(p) ?? EN_PREFIX) : (elPathFor(p) ?? '/');
}

const abs = (path: string): string => (path === '/' ? SITE : SITE + path);

/**
 * Οι ετικέτες hreflang μιας σελίδας με ζεύγος, ΙΔΙΕΣ και στις δύο πλευρές:
 * el, en και x-default προς τα ελληνικά (η κύρια αγορά). Null αν η σελίδα
 * δεν έχει ζεύγος — τότε δεν τυπώνεται τίποτα.
 */
export function languageAlternates(path: string): Record<'el' | 'en' | 'x-default', string> | null {
  const p = clean(path);
  const el = isEnPath(p) ? elPathFor(p) : (enPathFor(p) ? p : null);
  const en = el ? enPathFor(el) : null;
  if (!el || !en) return null;
  return { el: abs(el), en: abs(en), 'x-default': abs(el) };
}

/**
 * Ο σύνδεσμος προς μια σελίδα, στη γλώσσα της τρέχουσας: γράφεται με την
 * ελληνική διαδρομή (π.χ. «/signup?plan=solo») και στα αγγλικά γίνεται η
 * αγγλική, με το ίδιο ερώτημα και την ίδια άγκυρα. Αν η σελίδα δεν έχει
 * ακόμη αγγλική, μένει η ελληνική: ποτέ σύνδεσμος σε σελίδα που δεν υπάρχει.
 */
export function localHref(locale: Locale, elHref: string): string {
  if (locale === 'el') return elHref;
  const m = /^([^?#]*)(.*)$/.exec(elHref);
  const en = enPathFor(m?.[1] || '/');
  return en ? en + (m?.[2] ?? '') : elHref;
}
