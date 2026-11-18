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
import { useAppEn } from '@/lib/i18n/appEn';
import { TenantSummary } from './components/TabTenant';
import { PaymentsView, DepositView } from './components/TabTenantMoney';
import { DashboardView } from './components/TabTenantCare';
import { PaymentBars, MissingCriticalBar, FilePickRow, leaseAlerts } from './components/TabTenantParts';
import { ServicesEditor } from './components/TabTenantHelpers';
import { PeaLeaseNotice } from './components/PeaLeaseNotice';
import RentReceived from './components/RentReceived';
import { TENANTS_EN } from '@/lib/i18n/en/app/tenants';
import { TENANT_FIELDS } from '@/lib/property/fields';
import { PAY_METHODS } from './components/TabTenantTypes';
import { ID_DOCS } from './components/TabTenantHelpers';
import type { Tenant, RentPayment } from './components/TabTenantTypes';
import type { FieldDecision } from '@/lib/property/fields';
import type { CashLine } from '@/lib/home/cash';
import type { SupabaseClient } from '@supabase/supabase-js';

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
// Ό,τι έγραψε ο χρήστης (όνομα ακινήτου, ενοικιαστή, σημείωση) μένει όπως το έγραψε.
const strip = (h: string) => noStyles(h).split('Ελληνικά').join('').split('Σπίτι Κηφισιά').join('').split('Μαρία Παπαδοπούλου').join('');

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

  await loadAppEn('shell');
  await loadAppEn('settings');
  await loadAppEn('overview');
  await loadAppEn('expenses');
  await loadAppEn('tenants');

  // ── Ο ενοικιαστής: οι τιμές της βάσης μένουν ελληνικές, η οθόνη τις λέει αγγλικά ──
  ok('κάθε τρόπος πληρωμής έχει αγγλικό όνομα', TENANTS_EN.payMethods.length === PAY_METHODS.length);
  ok('κάθε έγγραφο ταυτοποίησης έχει αγγλικό όνομα', TENANTS_EN.idDocs.length === ID_DOCS.length);
  ok('κάθε πεδίο ενοικιαστή του μητρώου έχει αγγλικό όνομα και «γιατί»', TENANT_FIELDS.filter(f => f.id.startsWith('tenant.')).every(f => !!TENANTS_EN.fields[f.id]?.[0] && !!TENANTS_EN.fields[f.id]?.[1]));
  ok('αγγλικό λεξικό ενοικιαστή χωρίς ελληνικό γράμμα', !GREEK.test(JSON.stringify(TENANTS_EN)));
  ok('τακτικό αριθμητικό της ημέρας πληρωμής', TENANTS_EN.form.dueDay(1) === '1st' && TENANTS_EN.form.dueDay(2) === '2nd' && TENANTS_EN.form.dueDay(11) === '11th' && TENANTS_EN.form.dueDay(23) === '23rd');
  ok('η γραμμή ενοικίου από τη δόση', TENANTS_EN.received.line(2026, 1) === 'Rent for January 2026');
  ok('το κουμπί καταχώρησης με το ποσό όπως στα ελληνικά', TENANTS_EN.received.recordLabel(2, '1.234,50€') === 'Record 2 installments · 1.234,50€');
  const tenantRow = {
    id: 't1', property_id: 'p1', user_id: 'u1', full_name: 'Μαρία Παπαδοπούλου', email: 'm@example.com', phone: '6900000000',
    profession: null, afm: null, id_doc_type: null, id_doc_number: null, iban: null, notes: null,
    lease_type: 'annual', lease_category: null, lease_start: '2026-01-01', lease_end: '2026-12-31', custom_lease_days: null,
    monthly_rent: 650, payment_frequency: 'monthly', pending_rent: null, pending_rent_from: null,
    deposit_amount: 1300, deposit_returned: false, deposit_return_date: null, e_payment: true, streaming: null, cleaning: null, extra_perks: null,
    parking_included: false, parking_extra: false, parking_extra_price: null, lease_doc_url: null, lease_doc_name: null, lease_doc_external_url: null,
    status: 'active', rent_due_day: 5, deposit_method: 'Τραπεζική κατάθεση', deposit_paid_on: '2026-01-01', move_out_date: null,
    furnishing: 'furnished', rent_iban: null, aade_lease_decl_ref: null, created_at: '2026-01-01',
  } as Tenant;
  const pay = (m: number, paid: boolean, late = 0, extra: Partial<RentPayment> = {}): RentPayment => ({
    id: `r${m}`, tenant_id: 't1', property_id: 'p1', user_id: 'u1', period_month: m, period_year: 2026, amount: 650,
    base_rent: 650, services_charge: null, paid, paid_date: paid ? `2026-${String(m).padStart(2, '0')}-0${5 + Math.min(late, 4)}` : null,
    days_late: late, notes: null, method: paid ? 'Μετρητά' : null, receipt_url: null, receipt_doc_id: null,
    due_date: `2026-${String(m).padStart(2, '0')}-05`, tenant_declared: null, tenant_declared_at: null, tenant_note: null, created_at: '2026-01-01', ...extra,
  });
  const payments = [pay(1, true), pay(2, true, 3), pay(3, false), pay(4, false, 0, { tenant_declared: true }), pay(5, false)];
  const enAlerts = leaseAlerts(payments, tenantRow, TENANTS_EN.alerts), elAlerts = leaseAlerts(payments, tenantRow);
  ok('ειδοποιήσεις μίσθωσης: ίδιο πλήθος και επίπεδα', enAlerts.map(a => a.level).join() === elAlerts.map(a => a.level).join() && elAlerts.length > 0);
  for (const a of enAlerts) ok(`ειδοποίηση μίσθωσης: χωρίς ελληνικό γράμμα (${a.text})`, !GREEK.test(a.text));
  const missingFields = TENANT_FIELDS.filter(f => f.id === 'tenant.afm' || f.id === 'tenant.rent_iban').map(f => ({ id: f.id, label: f.label })) as FieldDecision[];
  const Summary = () => { const E = useAppEn('tenants'); return createElement(TenantSummary, { rent: 1300, leases: 2, arrears: 650, arrearsCount: 1, deposits: 2600, past: 1, en: E?.summary }); };
  const Missing = () => { const E = useAppEn('tenants'); return createElement(MissingCriticalBar, { missing: missingFields, en: E ? { head: E.missing, fields: E.fields } : undefined }); };
  const Pick = () => { const E = useAppEn('tenants'); return createElement(FilePickRow, { label: E ? 'Signed lease' : 'Υπογεγραμμένο μισθωτήριο', busy: false, docs: [], onPick: () => {}, en: E?.file }); };
  const Services = () => { const E = useAppEn('tenants'); return createElement(ServicesEditor, { value: [{ name: '', cost: 20, payer: 'split' }], onChange: () => {}, en: E ? { ...E.services, payer: E.payer } : undefined }); };
  const Pea = () => { const E = useAppEn('tenants'); return createElement(PeaLeaseNotice, { peaExpiry: '2025-01-01', propType: 'apartment', leaseStart: '2026-12-01', en: E?.pea }); };
  const PeaMissing = () => { const E = useAppEn('tenants'); return createElement(PeaLeaseNotice, { peaExpiry: null, propType: 'apartment', leaseStart: '2026-12-01', en: E?.pea }); };
  const rentLines: CashLine[] = [
    { label: 'Ενοίκιο Σεπτεμβρίου 2026', amount: 650, due: '2026-09-05', daysLeft: -40, rent: { id: 'a', year: 2026, month: 9 } },
    { label: 'Ενοίκιο Οκτωβρίου 2026', amount: 650, due: '2026-10-05', daysLeft: -10, rent: { id: 'b', year: 2026, month: 10 } },
  ] as CashLine[];
  const supa = {} as SupabaseClient;

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
    ['σύνοψη ενοικιαστών', () => createElement(Summary)],
    ['τι λείπει για τη δήλωση', () => createElement(Missing)],
    ['ανέβασμα αρχείου', () => createElement(Pick)],
    ['υπηρεσίες', () => createElement(Services)],
    ['ΠΕΑ που έληξε', () => createElement(Pea)],
    ['ΠΕΑ που λείπει', () => createElement(PeaMissing)],
    ['γράφημα πληρωμών', () => createElement(PaymentBars, { payments })],
    ['άδειο γράφημα πληρωμών', () => createElement(PaymentBars, { payments: [] })],
    ['επισκόπηση ενοικιαστή', () => createElement(DashboardView, { tenant: tenantRow, payments, propertyCount: 1 })],
    ['είσπραξη ενοικίων', () => createElement(PaymentsView, { tenant: tenantRow, propertyId: 'p1', userId: 'u1', payments, onRefresh: nav, plan: 'agency' })],
    ['είσπραξη χωρίς δόσεις', () => createElement(PaymentsView, { tenant: tenantRow, propertyId: 'p1', userId: 'u1', payments: [], onRefresh: nav })],
    ['εγγύηση', () => createElement(DepositView, { tenant: tenantRow, payments, damages: [], onReturned: nav })],
    ['είσπραξη από την Επισκόπηση', () => createElement(RentReceived, { onClose: nav, lines: rentLines, supabase: supa, propertyId: 'p1', tenantId: 't1', leaseViaBank: false, today: '2026-10-15', onSaved: nav })],
    ['μία δόση από την Επισκόπηση', () => createElement(RentReceived, { onClose: nav, lines: rentLines.slice(0, 1), supabase: supa, propertyId: 'p1', tenantId: 't1', leaseViaBank: true, today: '2026-10-15', onSaved: nav })],
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
  const enPay = renderToStaticMarkup(createElement(AppLocaleProvider, { locale: 'en' }, createElement(PaymentsView, { tenant: tenantRow, propertyId: 'p1', userId: 'u1', payments, onRefresh: nav })));
  ok('είσπραξη στα αγγλικά: «650,00€» και ημερομηνία «05/03/2026»', enPay.includes('650,00€') && enPay.includes('05/03/2026') && !enPay.includes('€650'));
  ok('είσπραξη στα αγγλικά: ο τρόπος της βάσης γράφεται αγγλικά', enPay.includes('Cash'));
  const enRr = renderToStaticMarkup(createElement(AppLocaleProvider, { locale: 'en' }, more[more.length - 2][1]()));
  ok('είσπραξη από την Επισκόπηση: μήνας από τη δόση', enRr.includes('September 2026') || enRr.includes('Rent for September'));
  const lang = renderToStaticMarkup(createElement(AppLocaleProvider, { locale: 'en' }, createElement(LanguageSetting)));
  ok('ο επιλογέας λέει «Language»', lang.includes('Language'));

  if (failed) {
    console.error(`✗ ${failed} αποτυχίες:\n  ` + fails.join('\n  '));
    process.exit(1);
  }
  console.log(`✓ appLocale: ${passed} έλεγχοι`);
}
void main();
