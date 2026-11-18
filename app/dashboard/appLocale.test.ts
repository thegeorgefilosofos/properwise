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
import { appLocale, isAppPath, metaLocale, msgLocale, LOCALE_META_KEY, MSG_LOCALE_META_KEY } from '@/lib/i18n/locale';
import { signupData } from '@/lib/auth/signupConsent';
import { SAY, dbReason, failed as failedEl } from '@/lib/core/dbError';
import { BY_CODE_EN, SAY_EN, failedEn } from '@/lib/i18n/en/app/errors';
import PropertySwitcher from './components/PropertySwitcher';
import { CommandPalette } from './components/CommandPalette';
import LanguageSetting from './components/LanguageSetting';
import MsgLanguageSetting from './components/MsgLanguageSetting';
import AgendaPanel from './components/AgendaPanel';
import CashHero from './components/CashHero';
import StartPanel from './components/StartPanel';
import ExpenseCompare from './components/ExpenseCompare';
import { CATEGORIES } from '@/lib/expenses/taxonomy';
import { CATEGORY_EN } from '@/lib/i18n/en/app/categories';
import { EXPENSES_EN } from '@/lib/i18n/en/app/expenses';
import type { Spend } from '@/lib/expenses/compare';
import { computeInsights, type InsightInput } from '@/lib/insights/engine';
import { computeObligations } from './components/obligations';
import { INSIGHTS_EN, OBLIGATIONS_EN } from '@/lib/i18n/en/app/overview';
import type { AgendaItem } from '@/lib/home/agenda';
import type { CashPosition } from '@/lib/home/cash';
import type { StartPanelState } from '@/lib/home/start';

let passed = 0, failed = 0;
const fails: string[] = [];
const ok = (name: string, cond: boolean) => { if (cond) passed++; else { failed++; fails.push(name); } };

const GREEK = /[\p{Script=Greek}]/u;
/**
 * Τα σχόλια μέσα στα <style> (CSS του component) δεν είναι κείμενο της οθόνης.
 * Σάρωση με θέσεις και όχι με regex, όπως το `noScripts` του app/thema/hubs.test.ts:
 * ένα regex που κόβει ετικέτες αφήνει πάντα κάποια περίπτωση πίσω (CodeQL).
 */
const noStyles = (html: string) => {
  let out = '', i = 0;
  const low = html.toLowerCase();
  for (;;) {
    const a = low.indexOf('<style', i);
    if (a < 0) return out + html.slice(i);
    const b = low.indexOf('</style', a);
    const c = b < 0 ? -1 : low.indexOf('>', b);
    out += html.slice(i, a) + ' ';
    if (c < 0) return out;
    i = c + 1;
  }
};
const strip = (h: string) => noStyles(h).split('Ελληνικά').join('').split('Σπίτι Κηφισιά').join('');

async function main() {
  // ── Ο κανόνας της γλώσσας ──────────────────────────────────────────────
  ok('το /dashboard είναι σελίδα εφαρμογής', isAppPath('/dashboard') && isAppPath('/dashboard/x') && !isAppPath('/dashboards'));
  ok('αγγλικά μόνο με ρητή επιλογή', appLocale('en') === 'en' && appLocale('el') === 'el' && appLocale(undefined) === 'el' && appLocale('fr') === 'el');
  ok('η επιλογή του λογαριασμού διαβάζεται από το δικό μας κλειδί', metaLocale({ [LOCALE_META_KEY]: 'en' }) === 'en');
  ok('το «locale» της Google ΔΕΝ είναι επιλογή', metaLocale({ locale: 'en' }) === null);
  ok('η αγγλική εγγραφή γράφει τη γλώσσα', signupData({ news: 'no' as never, locale: 'en' })[LOCALE_META_KEY] === 'en');
  ok('η ελληνική εγγραφή δεν γράφει τίποτα', !(LOCALE_META_KEY in signupData({ news: 'no' as never })));
  // ── Η γλώσσα των μηνυμάτων: επιλογή, αλλιώς γλώσσα εφαρμογής, αλλιώς ελληνικά ──
  ok('μηνύματα: η ρητή επιλογή κερδίζει', msgLocale({ [MSG_LOCALE_META_KEY]: 'el', [LOCALE_META_KEY]: 'en' }) === 'el' && msgLocale({ [MSG_LOCALE_META_KEY]: 'en' }) === 'en');
  ok('μηνύματα: χωρίς επιλογή, η γλώσσα της εφαρμογής', msgLocale({ [LOCALE_META_KEY]: 'en' }) === 'en');
  ok('μηνύματα: χωρίς τίποτα, ελληνικά', msgLocale({}) === 'el' && msgLocale(null) === 'el' && msgLocale({ [MSG_LOCALE_META_KEY]: 'fr', locale: 'en' }) === 'el');

  // ── Τα σφάλματα: ίδια αναγνώριση, αγγλική εξήγηση ─────────────────────
  ok('σφάλματα: ίδια πλήρη μηνύματα', Object.keys(SAY).sort().join() === Object.keys(SAY_EN).sort().join());
  for (const code of Object.keys(BY_CODE_EN)) ok(`σφάλμα ${code}: γνωστό και στα ελληνικά`, dbReason({ code }) !== null);
  for (const e of [{ code: '23505' }, { message: 'Failed to fetch' }, { message: 'new row violates row-level security' }, { message: 'plan_required' }, {}]) {
    const en = failedEn('The change didn’t save', e);
    ok(`σφάλμα στα αγγλικά χωρίς ελληνικό γράμμα: ${JSON.stringify(e)}`, !GREEK.test(en) && en.startsWith('The change didn’t save. '));
    ok(`σφάλμα: ο ίδιος λόγος αναγνωρίζεται και στις δύο γλώσσες: ${JSON.stringify(e)}`, (failedEl('x', e) === 'x. Δοκίμασε ξανά.') === en.endsWith(' Try again.') || 'code' in e);
  }
  for (const v of Object.values(SAY_EN)) ok(`πλήρες μήνυμα χωρίς ελληνικό γράμμα: ${v}`, !GREEK.test(v));

  await loadAppEn('shell');
  await loadAppEn('settings');
  await loadAppEn('overview');
  await loadAppEn('expenses');

  // ── Οι δαπάνες: κάθε κατηγορία της ταξινομίας έχει αγγλικό όνομα ────────
  ok('κάθε κατηγορία έχει αγγλικό όνομα', CATEGORIES.every(c => !!CATEGORY_EN[c.slug]));
  ok('προθεσμία δαπάνης στα αγγλικά', EXPENSES_EN.due(-3).text === 'overdue by 3 days' && EXPENSES_EN.due(-3).late && EXPENSES_EN.due(4).text === 'due in 4 days');
  ok('συχνότητα στα αγγλικά', EXPENSES_EN.cadence(2) === 'every two months' && EXPENSES_EN.cadence(5) === 'every 5 months');
  const spend = (month: string, category: string, amount: number): Spend => ({ date: `${month}-10`, category, amount } as Spend);
  const spends: Spend[] = [
    spend('2026-08', 'electricity', 60), spend('2026-08', 'water', 20),
    spend('2026-09', 'electricity', 140), spend('2026-09', 'water', 25),
    spend('2026-10', 'electricity', 70), spend('2026-10', 'water', 20),
  ];

  // ── Οι παρατηρήσεις: ίδιοι κανόνες, ίδιο πλήθος, αγγλικό κείμενο ────────
  const NOW = new Date('2026-07-06T10:00:00').getTime();
  const inDays = (n: number) => new Date(NOW + n * 86400000).toISOString().slice(0, 10);
  const inp: InsightInput = {
    now: NOW,
    property: { status_detail: 'vacant', insurance_expiry: inDays(-3) },
    tenant: null, rent: 700, propValue: 200000, grossYield: 4, netYield: 2, expensesYTD: 3000,
    expenses: [], loanPayment: 900,
    bills: [{ category: 'electricity', amount: 900, paid: false, due_date: inDays(-4) }],
    tasks: [{ due_date: inDays(-2) }], checklist: [{ due_date: inDays(-2), status: 'open' }],
    inventory: [{ warranty_expiry: inDays(10), name: 'Boiler' }],
  };
  const elIns = computeInsights(inp), enIns = computeInsights(inp, INSIGHTS_EN);
  ok('παρατηρήσεις: ίδια σειρά και ίδια αναγνωριστικά', elIns.map(i => i.id).join() === enIns.map(i => i.id).join() && elIns.length >= 8);
  ok('παρατηρήσεις: τα ελληνικά δεν άλλαξαν', JSON.stringify(computeInsights(inp, undefined)) === JSON.stringify(elIns));
  for (const i of enIns) ok(`παρατήρηση ${i.id}: χωρίς ελληνικό γράμμα`, !GREEK.test(`${i.title} ${i.detail} ${i.metric ?? ''}`));

  // ── Οι υποχρεώσεις: αγγλικοί τίτλοι, ίδιες ημερομηνίες ────────────────
  const prop = { id: 'p', status_detail: 'rented', rental_mode: 'long', insurance_expiry: '2026-12-01', enfia: 300 };
  const ten = { id: 't', lease_start: '2026-11-01', lease_end: '2027-10-31' };
  const now = new Date('2026-11-17T10:00:00Z');
  const elObl = computeObligations(prop as never, ten as never, [{ task: 'Boiler service', next_due: '2026-12-10' }], now, 'long_term');
  const enObl = computeObligations(prop as never, ten as never, [{ task: 'Boiler service', next_due: '2026-12-10' }], now, 'long_term', {}, [], OBLIGATIONS_EN);
  ok('υποχρεώσεις: ίδιες ημερομηνίες', elObl.map(o => `${o.id}@${o.date}`).join() === enObl.map(o => `${o.id}@${o.date}`).join() && elObl.length > 3);
  for (const o of enObl) ok(`υποχρέωση ${o.id}: χωρίς ελληνικό γράμμα`, !GREEK.test(`${o.title} ${o.note}`));

  // ── Η λίστα, το Ταμείο και το «Από πού ξεκινάς» ──────────────────────
  const agenda: AgendaItem[] = [
    { key: 'a', title: 'X', note: '', due: '2026-11-20', daysLeft: 3, action: { label: 'Δάνειο', tab: 'loan' }, origin: 'insight', weight: 5, amount: { value: 35.66, estimate: true } } as AgendaItem,
    { key: 'b', title: 'Y', note: '', due: null, daysLeft: -2, action: null, origin: 'obligation', weight: 5 } as AgendaItem,
  ];
  const sideOf = (n: number) => ({ total: n * 10, count: n, overdue: n * 5, overdueCount: n ? 1 : 0, lines: n ? [{ daysLeft: -4 }] : [] });
  const cash = { owedToMe: sideOf(2), owedByMe: sideOf(3) } as unknown as CashPosition;
  const start = { visible: true, open: 2, daysLeft: 12, hasProperty: false, steps: [
    { key: 'property', title: 'Τ', hint: 'Η', nav: 'add', cta: 'Κ', done: true },
    { key: 'document', title: 'Τ', hint: 'Η', nav: 'scan', cta: 'Κ', done: false },
  ] } as unknown as StartPanelState;
  const nav = () => {};
  const more: [string, () => ReactElement][] = [
    ['λίστα', () => createElement(AgendaPanel, { items: agenda, total: 4, onNavigate: nav })],
    ['άδεια λίστα', () => createElement(AgendaPanel, { items: [], total: 0, onNavigate: nav, incomplete: true })],
    ['ταμείο', () => createElement(CashHero, { cash, showIncome: true, onNavigate: nav, onRecordRent: nav })],
    ['ήσυχο ταμείο', () => createElement(CashHero, { cash: { owedToMe: sideOf(0), owedByMe: sideOf(0) } as unknown as CashPosition, showIncome: false, onNavigate: nav, onRecordRent: null })],
    ['από πού ξεκινάς', () => createElement(StartPanel, { state: start, collapsed: false, onToggle: nav, onNavigate: nav, onPreview: nav })],
    ['σύγκριση μηνών', () => createElement(ExpenseCompare, { spends, today: new Date('2026-11-17T10:00:00Z') })],
    ['από πού ξεκινάς, κλειστό', () => createElement(StartPanel, { state: start, collapsed: true, onToggle: nav, onNavigate: nav, onPreview: nav })],
  ];

  const items = [{ id: 'p1', name: 'Σπίτι Κηφισιά', status: '', address: null }];
  const screens: [string, () => ReactElement][] = [
    ['επιλογέας ακινήτου', () => createElement(PropertySwitcher, { items, activeId: 'p1', onSelect: () => {}, onAdd: () => {} })],
    ['κενός επιλογέας', () => createElement(PropertySwitcher, { items: [], activeId: null as unknown as string, onSelect: () => {}, onAdd: () => {} })],
    ['αναζήτηση', () => createElement(CommandPalette, { open: true, onClose: () => {}, items: [{ id: 'a', label: 'x', action: () => {} }] })],
    ['γλώσσα', () => createElement(LanguageSetting)],
    ['γλώσσα μηνυμάτων', () => createElement(MsgLanguageSetting)],
    ...more,
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
  // ── Τα ποσά στα αγγλικά γράφονται όπως στα ελληνικά (απόφαση ιδιοκτήτη, lib/i18n/en/app/format.ts) ──
  const enAgenda = renderToStaticMarkup(createElement(AppLocaleProvider, { locale: 'en' }, more[0][1]()));
  ok('ποσό στα αγγλικά: «35,66€», όχι «€35.66»', enAgenda.includes('35,66€') && !enAgenda.includes('€35'));
  const enCash = renderToStaticMarkup(createElement(AppLocaleProvider, { locale: 'en' }, more[2][1]()));
  ok('ταμείο στα αγγλικά: «30,00€»', enCash.includes('30,00€'));
  ok('παρατήρηση στα αγγλικά: ποσά με ελληνική γραφή', enIns.some(i => /\d,\d{2}€/.test(`${i.detail} ${i.metric ?? ''}`)) && !enIns.some(i => /€\d/.test(`${i.detail} ${i.metric ?? ''}`)));
  const lang = renderToStaticMarkup(createElement(AppLocaleProvider, { locale: 'en' }, createElement(LanguageSetting)));
  ok('ο επιλογέας λέει «Language»', lang.includes('Language'));

  if (failed) {
    console.error(`✗ ${failed} αποτυχίες:\n  ` + fails.join('\n  '));
    process.exit(1);
  }
  console.log(`✓ appLocale: ${passed} έλεγχοι`);
}
void main();
