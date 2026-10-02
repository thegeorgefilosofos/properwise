// npx tsx lib/billing/e2Reconcile.test.ts
//
// Η ερώτηση δεν είναι «αφαιρεί σωστά» αλλά «λέει ψέματα;». Κάθε εύρημα πρέπει
// να κουβαλά τα δύο νούμερα και τη διαφορά και να λέει ΠΟΥ διορθώνεται. Και
// κανένα ζευγάρι γραμμών δεν φτιάχνεται στην τύχη.
import { reconcilePrefilled, appLinesOf, TOLERANCE, FIX_LABEL, type AppLeaseLine } from './e2Reconcile';
import { buildE2Row, type E2Property } from './e2';
import type { AadeE2Row } from '@/lib/tax/aadeE2';

let pass = 0, fail = 0;
function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) pass++; else { fail++; console.error(`✗ ${name}\n   got  ${g}\n   want ${w}`); }
}
function ok(name: string, cond: boolean) { if (cond) pass++; else { fail++; console.error(`✗ ${name}`); } }

const T1 = '123456783', T2 = '987654324', T3 = '111222336', BAD = '123456789';

const app = (o: Partial<AppLeaseLine> = {}): AppLeaseLine => ({
  key: 'p1:0', propertyId: 'p1', propertyName: 'Πατησίων', atak: '01234567890',
  tenantName: 'Παπαδόπουλος', tenantAfm: T1, months: 12, monthly: 600, ownershipPct: 100,
  gross: 7200, incomeColumn: 13, from: '2025-01-01', to: '2025-12-31',
  monthsFromRecords: true, estimated: false, shortTerm: false, declRef: null, ...o,
});
const aade = (o: Partial<AadeE2Row> = {}): AadeE2Row => ({
  rowNo: 1, atak: '01234567890', address: 'Πατησίων 10', category: null, tenantName: null, tenantAfm: T1,
  from: '2025-01-01', to: '2025-12-31', months: 12, monthlyRent: 600, ownershipPct: 100,
  gross: 7200, incomeColumn: 13, leaseDeclRef: null, ...o,
});
const kinds = (l: { findings: { kind: string }[] }) => l.findings.map(f => f.kind);

// ═══ ΧΩΡΙΣ ΠΡΟΣΥΜΠΛΗΡΩΜΕΝΟ ═══════════════════════════════════════════════
{
  const r = reconcilePrefilled([app()], []);
  eq('δεν ανέβηκε: κατάσταση', r.status, 'not_uploaded');
  eq('δεν ανέβηκε: καμία επικεφαλίδα', r.headline, null);
}

// ═══ ΣΥΜΦΩΝΙΑ ════════════════════════════════════════════════════════════
{
  const r = reconcilePrefilled([app()], [aade()]);
  eq('ίδια γραμμή: συμφωνεί', [r.status, r.differences, r.matched], ['matches', 0, 1]);
  eq('ταυτίστηκε με ΑΤΑΚ και ΑΦΜ', r.lines[0].matchedBy, 'atak_tenant');
  ok('η επικεφαλίδα λέει το ποσό', /7\.200,00€/.test(r.headline || ''));
  // Ενα ευρώ στρογγυλοποίησης δεν είναι διαφορά.
  eq('διαφορά εντός ανοχής', reconcilePrefilled([app({ gross: 7201 })], [aade()]).status, 'matches');
  ok('ένα ευρώ πάνω από την ανοχή φαίνεται', reconcilePrefilled([app({ gross: 7200 + TOLERANCE + 1 })], [aade()]).status === 'differences');
}

// ═══ ΔΙΑΦΟΡΑ ΑΚΑΘΑΡΙΣΤΟΥ ΜΕ ΜΗΝΕΣ ═════════════════════════════════════════
{
  // Η εφαρμογή μετρά 11 μήνες από τις ημερομηνίες της μίσθωσης, η ΑΑΔΕ 12.
  const r = reconcilePrefilled([app({ months: 11, gross: 6600, to: '2025-11-30' })], [aade()]);
  const l = r.lines[0];
  eq('μήνες και ποσό', kinds(l).sort(), ['gross', 'months']);
  const g = l.findings.find(f => f.kind === 'gross')!;
  ok('το εύρημα ποσού λέει και τα δύο νούμερα και τη διαφορά',
    /6\.600,00€/.test(g.text) && /7\.200,00€/.test(g.text) && /600,00€/.test(g.text));
  eq('η διαφορά με πρόσημο: εφαρμογή μείον ΑΑΔΕ', g.diff, -600);
  eq('εξηγείται από τους μήνες', g.reasons?.map(x => x.code), ['months']);
  eq('οι μήνες βγήκαν από ημερομηνίες: διόρθωση στο myAADE', g.fixIn, 'aade');
  ok('η ενέργεια ξεκινά με το πού', g.action.startsWith(FIX_LABEL.aade));
  const m = l.findings.find(f => f.kind === 'months')!;
  eq('μήνες: εφαρμογή, ΑΑΔΕ, διαφορά', [m.ours, m.theirs, m.diff], ['11', '12', -1]);
}
{
  // Ο ίδιος αριθμός μηνών αλλά εκτίμηση: διόρθωση στην εφαρμογή.
  const r = reconcilePrefilled([app({ gross: 6000, estimated: true })], [aade()]);
  const g = r.lines[0].findings.find(f => f.kind === 'gross')!;
  eq('εκτίμηση: η διόρθωση είναι στην εφαρμογή', g.fixIn, 'app');
  ok('και ο λόγος λέγεται', g.reasons!.some(x => x.code === 'ours_estimated'));
}

// ═══ ΣΥΝΙΔΙΟΚΤΗΣΙΑ ═══════════════════════════════════════════════════════
{
  // Η ΑΑΔΕ γράφει ολόκληρο το μίσθωμα με 100%, η εφαρμογή το 50%.
  const r = reconcilePrefilled([app({ ownershipPct: 50, gross: 3600 })], [aade({ gross: 7200, ownershipPct: 100 })]);
  const l = r.lines[0];
  ok('ποσό και ποσοστό', kinds(l).includes('gross') && kinds(l).includes('share'));
  const g = l.findings.find(f => f.kind === 'gross')!;
  eq('εξηγείται από τη συνιδιοκτησία', g.reasons?.[0].code, 'ownership');
  eq('ολόκληρο στο έντυπο: διόρθωση στο myAADE', g.fixIn, 'aade');
  ok('η ενέργεια λέει το μερίδιο', /3\.600,00€/.test(g.action) && /50,00%/.test(g.action));
  const s = l.findings.find(f => f.kind === 'share')!;
  eq('ποσοστό: τα δύο νούμερα', [s.ours, s.theirs], ['50,00%', '100,00%']);
}

// ═══ ΑΦΜ ΜΙΣΘΩΤΗ ═════════════════════════════════════════════════════════
{
  // Ιδιος ΑΤΑΚ, άλλος μισθωτής στην ΑΑΔΕ: ζευγάρι κατά ΑΤΑΚ, εύρημα ΑΦΜ.
  const r = reconcilePrefilled([app()], [aade({ tenantAfm: T2 })]);
  eq('ζευγάρι κατά ΑΤΑΚ', r.lines[0].matchedBy, 'atak');
  const f = r.lines[0].findings.find(x => x.kind === 'tenant_afm')!;
  eq('δύο έγκυρα ΑΦΜ: έλεγχος', f.fixIn, 'check');
  ok('λέει και τα δύο ΑΦΜ', f.text.includes(T1) && f.text.includes(T2));
}
{
  const r = reconcilePrefilled([app()], [aade({ tenantAfm: BAD })]);
  const f = r.lines[0].findings.find(x => x.kind === 'tenant_afm')!;
  eq('άκυρο ΑΦΜ στην ΑΑΔΕ: διόρθωση στο myAADE', f.fixIn, 'aade');
  ok('και το λέει άκυρο', /άκυρο/.test(f.text));
  const r2 = reconcilePrefilled([app({ tenantAfm: BAD })], [aade()]);
  eq('άκυρο ΑΦΜ στην εφαρμογή: διόρθωση στην εφαρμογή', r2.lines[0].findings.find(x => x.kind === 'tenant_afm')!.fixIn, 'app');
}

// ═══ ΑΡΙΘΜΟΣ ΔΗΛΩΣΗΣ ════════════════════════════════════════════════════
{
  // Χωρίς ΑΤΑΚ στην ΑΑΔΕ, ταύτιση με τον αριθμό δήλωσης.
  const r = reconcilePrefilled([app({ declRef: '45678912', tenantAfm: null })], [aade({ atak: null, tenantAfm: null, leaseDeclRef: '45678912' })]);
  eq('ζευγάρι κατά αριθμό δήλωσης', [r.lines[0].matchedBy, r.status], ['decl', 'matches']);
  const r2 = reconcilePrefilled([app({ declRef: '45678912' })], [aade({ leaseDeclRef: '45678999' })]);
  const f = r2.lines[0].findings.find(x => x.kind === 'decl_ref')!;
  eq('άλλος αριθμός δήλωσης: διόρθωση στην εφαρμογή', f.fixIn, 'app');
  ok('με τον σωστό αριθμό μέσα', f.action.includes('45678999'));
}

// ═══ ΛΕΙΠΕΙ ΑΠΟ ΤΗ ΜΙΑ ΠΛΕΥΡΑ ═════════════════════════════════════════════
{
  const r = reconcilePrefilled(
    [app(), app({ key: 'p2:0', propertyId: 'p2', propertyName: 'Ερμού', atak: '01234567891', tenantAfm: T2, gross: 4800 })],
    [aade(), aade({ atak: '01234567899', tenantAfm: T3, gross: 3000, months: 5 })],
  );
  eq('δύο διαφορές: μία από κάθε πλευρά', r.differences, 2);
  const inAade = r.lines.find(l => l.status === 'missing_in_aade')!;
  const inApp = r.lines.find(l => l.status === 'missing_in_app')!;
  eq('λείπει από την ΑΑΔΕ: διόρθωση στο myAADE', inAade.findings[0].fixIn, 'aade');
  ok('με το ποσό της εφαρμογής', /4\.800,00€/.test(inAade.findings[0].text));
  eq('λείπει από την εφαρμογή: καταχώρηση', inApp.findings[0].fixIn, 'app');
  ok('με το ποσό, τους μήνες και τον μισθωτή της ΑΑΔΕ', /3\.000,00€/.test(inApp.findings[0].text) && /5 μήνες/.test(inApp.findings[0].text) && inApp.findings[0].text.includes(T3));
  eq('πρώτα όσα λείπουν από την εφαρμογή', r.lines[0].status, 'missing_in_app');
  eq('σύνολα', [r.totalOurs, r.totalTheirs, r.totalDiff], [12000, 10200, 1800]);
  ok('η επικεφαλίδα λέει και τα δύο σύνολα', /10\.200,00€/.test(r.headline!) && /12\.000,00€/.test(r.headline!));
}
{
  // Κενό ακίνητο χωρίς γραμμή στην ΑΑΔΕ: δεν είναι διαφορά.
  const r = reconcilePrefilled([app({ gross: 0, tenantAfm: null, months: null })], [aade({ atak: '01234567891' })]);
  eq('κενό χωρίς ζευγάρι: πληροφορία', r.lines.find(l => l.app)?.status, 'vacant');
}

// ═══ ΔΥΟ ΜΙΣΘΩΣΕΙΣ ΣΤΟ ΙΔΙΟ ΑΚΙΝΗΤΟ ══════════════════════════════════════
{
  // Χωρίς ΑΦΜ στην ΑΑΔΕ: η ταύτιση γίνεται με την επικάλυψη διαστημάτων.
  const a1 = app({ key: 'p1:0', tenantAfm: null, months: 6, gross: 3600, from: '2025-01-01', to: '2025-06-30' });
  const a2 = app({ key: 'p1:1', tenantAfm: null, months: 6, gross: 4200, from: '2025-07-01', to: '2025-12-31' });
  const d1 = aade({ tenantAfm: null, months: 6, gross: 4200, from: '2025-07-01', to: '2025-12-31' });
  const d2 = aade({ tenantAfm: null, months: 6, gross: 3000, from: '2025-01-01', to: '2025-06-30' });
  const r = reconcilePrefilled([a1, a2], [d1, d2]);
  const first = r.lines.find(l => l.app?.key === 'p1:0')!;
  eq('η πρώτη μίσθωση ταιριάζει με το πρώτο εξάμηνο', first.aade?.gross, 3000);
  eq('και διαφέρει κατά 600', first.findings[0].diff, 600);
  eq('η δεύτερη συμφωνεί', r.lines.find(l => l.app?.key === 'p1:1')!.status, 'match');
  // Χωρίς ημερομηνίες: δεν μαντεύουμε.
  const r2 = reconcilePrefilled([{ ...a1, from: null, to: null }, { ...a2, from: null, to: null }], [{ ...d1, from: null, to: null }, { ...d2, from: null, to: null }]);
  eq('χωρίς ημερομηνίες: καμία ταύτιση στην τύχη', r2.lines.filter(l => l.matchedBy).length, 0);
}

// ═══ ΣΤΗΛΗ ═════════════════════════════════════════════════════════════════
{
  const r = reconcilePrefilled([app({ incomeColumn: 15 })], [aade()]);
  ok('ιδιοχρησιμοποίηση απέναντι σε εκμίσθωση: εύρημα στήλης', kinds(r.lines[0]).includes('column'));
}

// ═══ ΑΠΟ ΤΟ ΠΡΑΓΜΑΤΙΚΟ buildE2Row ═════════════════════════════════════════
{
  const p: E2Property = { id: 'p1', name: 'Πατησίων', atak: '01234567890', address: 'Πατησίων 10', postal_code: '10434', ownership: 100, prop_type: 'apartment', status_detail: 'rented', target_rent: 600 };
  const tenants = [
    { id: 't1', property_id: 'p1', afm: T1, full_name: 'Α', monthly_rent: 500, lease_start: '2024-02-01', lease_end: '2025-05-31', lease_type: 'residential' },
    { id: 't2', property_id: 'p1', afm: T2, full_name: 'Β', monthly_rent: 650, lease_start: '2025-06-01', lease_end: '2027-05-31', lease_type: 'residential' },
  ];
  const payments = [1, 2, 3, 4, 5].map(m => ({ property_id: 'p1', tenant_id: 't1', amount: 500, base_rent: 500, period_year: 2025, period_month: m, paid: true }));
  const row = buildE2Row(p, tenants, payments, '094014201', 2025);
  const lines = appLinesOf(p, row, { declRef: '45678912' });
  eq('δύο μισθώσεις, δύο γραμμές', lines.map(l => [l.tenantAfm, l.gross, l.months, l.estimated]), [[T1, 2500, 5, false], [T2, 4550, 7, true]]);
  eq('ημερομηνίες σε ISO', [lines[0].from, lines[0].to, lines[1].from], ['2025-01-01', '2025-05-31', '2025-06-01']);
  eq('ο αριθμός δήλωσης πάει στην τρέχουσα μίσθωση', lines.map(l => l.declRef), [null, '45678912']);
  const r = reconcilePrefilled(lines, [
    aade({ tenantAfm: T1, months: 5, gross: 2500, from: '2025-01-01', to: '2025-05-31' }),
    aade({ tenantAfm: T2, months: 7, gross: 4550, from: '2025-06-01', to: '2025-12-31', leaseDeclRef: '45678912' }),
  ]);
  eq('ίδια με την ΑΑΔΕ: συμφωνούν και οι δύο', [r.status, r.matched], ['matches', 2]);
}

// ═══ ΣΤΗΛΕΣ 18 ΚΑΙ 19 (Φ-01.002/Έκδοση 2026), ΟΤΑΝ ΤΙΣ ΞΕΡΟΥΝ ΚΑΙ ΟΙ ΔΥΟ ═════
{
  const p: E2Property = { id: 'p1', name: 'Πατησίων', atak: '01234567890', address: 'Πατησίων 10', postal_code: '10434', ownership: 100, prop_type: 'apartment', status_detail: 'rented', target_rent: 600, power_supply_no: '123456789017' };
  const tenants = [
    { id: 't1', property_id: 'p1', afm: T1, full_name: 'Α', monthly_rent: 500, lease_start: '2024-02-01', lease_end: '2025-05-31', lease_type: 'residential', aade_lease_decl_ref: '11112222' },
    { id: 't2', property_id: 'p1', afm: T2, full_name: 'Β', monthly_rent: 650, lease_start: '2025-06-01', lease_end: '2027-05-31', lease_type: 'residential', aade_lease_decl_ref: '33334444' },
  ];
  const row = buildE2Row(p, tenants, [], '094014201', 2025);
  const lines = appLinesOf(p, row, { declRef: '99999999' });
  eq('στ. 19 ανά μίσθωση, όχι ένας ανά ακίνητο', lines.map(l => l.declRef), ['11112222', '33334444']);
  eq('στ. 18: τα 9 πρώτα ψηφία', lines.map(l => l.powerSupply), ['123456789', '123456789']);
  const same = reconcilePrefilled(lines, [
    aade({ tenantAfm: T1, months: 5, gross: 2500, from: '2025-01-01', to: '2025-05-31', leaseDeclRef: '11112222', powerSupplyNo: '123456789' }),
  ]);
  ok('ίδια παροχή και ίδιος αριθμός δήλωσης: κανένα εύρημα 18 ή 19', !same.lines.some(l => kinds(l).includes('power_supply') || kinds(l).includes('decl_ref')));
  const diff = reconcilePrefilled([app({ powerSupply: '123456789', declRef: '11112222' })], [aade({ powerSupplyNo: '223456789', leaseDeclRef: '11119999' })]);
  ok('διαφορετική παροχή: εύρημα με τα δύο νούμερα', diff.lines[0].findings.some(f => f.kind === 'power_supply' && f.ours === '123456789' && f.theirs === '223456789' && f.fixIn === 'check'));
  ok('διαφορετικός αριθμός δήλωσης: εύρημα', kinds(diff.lines[0]).includes('decl_ref'));
  const oneSide = reconcilePrefilled([app({ powerSupply: '123456789' })], [aade({ powerSupplyNo: null })]);
  ok('παροχή μόνο στη μία πλευρά: καμία σύγκριση', !kinds(oneSide.lines[0]).includes('power_supply'));
}

console.log(fail === 0 ? `✓ e2Reconcile: ${pass} έλεγχοι πέρασαν` : `✗ e2Reconcile: ${fail} απέτυχαν από ${pass + fail}`);
process.exit(fail ? 1 : 0);
