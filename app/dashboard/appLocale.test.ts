// ═══════════════════════════════════════════════════════════════════════════
// Η ΕΦΑΡΜΟΓΗ ΣΕ ΔΥΟ ΓΛΩΣΣΕΣ: ΤΑ ΕΛΛΗΝΙΚΑ ΜΕΝΟΥΝ ΙΔΙΑ, ΤΑ ΑΓΓΛΙΚΑ ΕΙΝΑΙ ΑΓΓΛΙΚΑ
// ─────────────────────────────────────────────────────────────────────────
// Αποδίδει κομμάτια του κελύφους (lib/i18n/appEn.tsx) τρεις φορές: χωρίς
// πάροχο (όπως πριν), με πάροχο «el» και με πάροχο «en». Οι δύο πρώτες
// πρέπει να είναι ΙΔΙΕΣ ως το byte· η τρίτη να μην έχει ελληνικό γράμμα
// έξω από ό,τι έγραψε ο χρήστης και το «Ελληνικά» του επιλογέα.
// ═══════════════════════════════════════════════════════════════════════════
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppLocaleProvider, loadAppEn } from '@/lib/i18n/appEn';
import { appLocale, isAppPath, metaLocale, LOCALE_META_KEY } from '@/lib/i18n/locale';
import { signupData } from '@/lib/auth/signupConsent';
import PropertySwitcher from './components/PropertySwitcher';
import { CommandPalette } from './components/CommandPalette';
import LanguageSetting from './components/LanguageSetting';

let passed = 0, failed = 0;
const fails: string[] = [];
const ok = (name: string, cond: boolean) => { if (cond) passed++; else { failed++; fails.push(name); } };

const GREEK = /[\p{Script=Greek}]/u;
const strip = (h: string) => h.replace(/Ελληνικά/g, '').replace(/Σπίτι Κηφισιά/g, '');

async function main() {
  // ── Ο κανόνας της γλώσσας ──────────────────────────────────────────────
  ok('το /dashboard είναι σελίδα εφαρμογής', isAppPath('/dashboard') && isAppPath('/dashboard/x') && !isAppPath('/dashboards'));
  ok('αγγλικά μόνο με ρητή επιλογή', appLocale('en') === 'en' && appLocale('el') === 'el' && appLocale(undefined) === 'el' && appLocale('fr') === 'el');
  ok('η επιλογή του λογαριασμού διαβάζεται από το δικό μας κλειδί', metaLocale({ [LOCALE_META_KEY]: 'en' }) === 'en');
  ok('το «locale» της Google ΔΕΝ είναι επιλογή', metaLocale({ locale: 'en' }) === null);
  ok('η αγγλική εγγραφή γράφει τη γλώσσα', signupData({ news: 'no' as never, locale: 'en' })[LOCALE_META_KEY] === 'en');
  ok('η ελληνική εγγραφή δεν γράφει τίποτα', !(LOCALE_META_KEY in signupData({ news: 'no' as never })));

  await loadAppEn('shell');
  await loadAppEn('settings');

  const items = [{ id: 'p1', name: 'Σπίτι Κηφισιά', status: '', address: null }];
  const screens: [string, () => ReactElement][] = [
    ['επιλογέας ακινήτου', () => createElement(PropertySwitcher, { items, activeId: 'p1', onSelect: () => {}, onAdd: () => {} })],
    ['κενός επιλογέας', () => createElement(PropertySwitcher, { items: [], activeId: null as unknown as string, onSelect: () => {}, onAdd: () => {} })],
    ['αναζήτηση', () => createElement(CommandPalette, { open: true, onClose: () => {}, items: [{ id: 'a', label: 'x', action: () => {} }] })],
    ['γλώσσα', () => createElement(LanguageSetting)],
  ];
  for (const [name, el] of screens) {
    const before = renderToStaticMarkup(el());
    const greek = renderToStaticMarkup(createElement(AppLocaleProvider, { locale: 'el' }, el()));
    const english = renderToStaticMarkup(createElement(AppLocaleProvider, { locale: 'en' }, el()));
    ok(`${name}: τα ελληνικά ίδια ως το byte`, before === greek);
    ok(`${name}: τα ελληνικά είναι ελληνικά`, GREEK.test(strip(greek)));
    ok(`${name}: τα αγγλικά χωρίς ελληνικό γράμμα`, !GREEK.test(strip(english)));
    ok(`${name}: τα αγγλικά διαφέρουν`, english !== greek);
  }
  const lang = renderToStaticMarkup(createElement(AppLocaleProvider, { locale: 'en' }, createElement(LanguageSetting)));
  ok('ο επιλογέας λέει «Language»', lang.includes('Language'));

  if (failed) {
    console.error(`✗ ${failed} αποτυχίες:\n  ` + fails.join('\n  '));
    process.exit(1);
  }
  console.log(`✓ appLocale: ${passed} έλεγχοι`);
}
void main();
