// npx tsx lib/accounting/taxisnetSheet.test.ts
//
// Το φύλλο κωδικών: οι κωδικοί έρχονται από τον πίνακα 4Δ2 με την πηγή του, τα
// ποσά από τις ίδιες γραμμές του Ε2 και κάθε γραμμή λέει αν ελέγχθηκε ή τι
// λείπει. Ελέγχεται ότι ένας κωδικός «στέκει» μόνο όταν στέκουν όλες οι γραμμές
// που τον γεμίζουν και ότι ό,τι υπάρχει μόνο στην ΑΑΔΕ δεν χάνεται.
import XLSX from 'xlsx-js-style';
import { buildE2Row, buildE1Summary, type E2Property, type E2Tenant, type E2Payment } from '@/lib/billing/e2';
import { appLinesOf, reconcilePrefilled } from '@/lib/billing/e2Reconcile';
import type { AadeE2Row } from '@/lib/tax/aadeE2';
import { E1_4D2 } from './e1Codes';
import { taxisnetSheet, sheetSummary } from './taxisnetSheet';
import { buildCodesWorkbook } from '@/app/dashboard/components/meetingPackExport';

let pass = 0, fail = 0;
function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) pass++; else { fail++; console.error(`✗ ${name}\n   got  ${g}\n   want ${w}`); }
}
function ok(name: string, cond: boolean) { if (cond) pass++; else { fail++; console.error(`✗ ${name}`); } }

const P = (o: Partial<E2Property> = {}): E2Property => ({
  id: 'p1', name: 'Πατησίων', atak: '01234567890', address: 'Πατησίων 10', postal_code: '10434', ownership: 100,
  prop_type: 'apartment', status_detail: 'rented', target_rent: 600, power_supply_no: '123456789', ...o,
});
const T = (o: Partial<E2Tenant> = {}): E2Tenant => ({
  property_id: 'p1', afm: '123456783', full_name: 'Α. Μισθωτής', monthly_rent: 600,
  lease_start: '2025-01-01', lease_end: null, lease_type: null, ...o,
});
const year12 = (pid: string, amount: number): E2Payment[] =>
  Array.from({ length: 12 }, (_, m) => ({ property_id: pid, amount, period_year: 2025, period_month: m + 1, paid: true }));
const aade = (o: Partial<AadeE2Row> = {}): AadeE2Row => ({
  rowNo: 1, atak: '01234567890', address: null, category: null, tenantName: null, tenantAfm: '123456783',
  from: '2025-01-01', to: '2025-12-31', months: 12, monthlyRent: 600, ownershipPct: 100, gross: 7200, incomeColumn: 13, leaseDeclRef: null, ...o,
});

const flat = P();
const shop = P({ id: 'p2', name: 'Κατάστημα', atak: '09876543210', prop_type: 'shop', target_rent: 1000 });
const rows = [
  buildE2Row(flat, T(), year12('p1', 600), '094014201', 2025),
  buildE2Row(shop, T({ property_id: 'p2', afm: '987654320', monthly_rent: 1000 }), year12('p2', 1000), '094014201', 2025),
];
const props = [flat, shop].map(p => ({ id: p.id, name: p.name!, atak: p.atak, power_supply_no: p.power_supply_no }));
const lines = [flat, shop].flatMap((p, i) => appLinesOf(p, rows[i]));

// ═══ ΟΛΑ ΣΥΜΦΩΝΟΥΝ ═════════════════════════════════════════════════════════
{
  const r = reconcilePrefilled(lines, [aade(), aade({ rowNo: 2, atak: '09876543210', tenantAfm: '987654320', monthlyRent: 1000, gross: 12000 })]);
  const s = taxisnetSheet({ year: 2025, ownerAfm: '094014201', properties: props, rows, reconciliation: r });
  const e1 = buildE1Summary(rows);
  eq('οι κωδικοί είναι του 4Δ2, με τη σειρά του εντύπου', s.e1.map(l => [l.code, l.spouseCode]), [
    [E1_4D2.lease.home!.code, E1_4D2.lease.home!.spouseCode], [E1_4D2.lease.business!.code, E1_4D2.lease.business!.spouseCode],
  ]);
  eq('τα ποσά του Ε1 είναι του buildE1Summary', s.e1.map(l => l.amount), e1.lines.map(l => l.amount));
  eq('κάθε γραμμή ελέγχθηκε', [...s.e1, ...s.e2].map(l => l.check.state), ['checked', 'checked', 'checked', 'checked']);
  eq('στ. 13 με το ακαθάριστο, οι άλλες κενές', s.e2.map(l => [l.col13, l.col14, l.col15, l.col16]), [[7200, '', '', ''], [12000, '', '', '']]);
  eq('η σύνοψη μετρά', sheetSummary(s), '4 γραμμές · Ελέγχθηκε: 4');
}

// ═══ ΧΩΡΙΣ ΠΡΟΣΥΜΠΛΗΡΩΜΕΝΟ: ΤΙΠΟΤΑ ΔΕΝ ΛΕΓΕΤΑΙ «ΕΛΕΓΧΘΗΚΕ» ═══════════════
{
  const s = taxisnetSheet({ year: 2025, ownerAfm: '094014201', properties: props, rows, reconciliation: reconcilePrefilled(lines, []) });
  ok('όλα «δεν ελέγχθηκε»', [...s.e1, ...s.e2].every(l => l.check.state === 'unchecked'));
}

// ═══ ΔΙΑΦΟΡΑ, ΕΛΛΕΙΨΗ ΚΑΙ ΓΡΑΜΜΗ ΜΟΝΟ ΣΤΗΝ ΑΑΔΕ ═══════════════════════════
{
  const noAfm = buildE2Row(shop, T({ property_id: 'p2', afm: null, monthly_rent: 1000 }), year12('p2', 1000), '094014201', 2025);
  const rr = [rows[0], noAfm];
  const ll = [appLinesOf(flat, rr[0]), appLinesOf(shop, rr[1])].flat();
  const r = reconcilePrefilled(ll, [
    aade({ gross: 6900 }),
    aade({ rowNo: 3, atak: '05555555555', tenantAfm: '111111118', gross: 3000, incomeColumn: 13 }),
  ]);
  const s = taxisnetSheet({ year: 2025, ownerAfm: '094014201', properties: props, rows: rr, reconciliation: r });
  eq('η κατοικία διαφέρει από την ΑΑΔΕ', s.e2[0].check.state, 'differs');
  eq('το κατάστημα: λείπει ΑΦΜ μισθωτή', [s.e2[1].check.state, /ΑΦΜ μισθωτή/.test(s.e2[1].check.detail)], ['missing', true]);
  const only = s.e2.find(l => l.atak === '05555555555');
  ok('η γραμμή που έχει μόνο η ΑΑΔΕ μπαίνει ως «λείπει», με το ποσό της', !!only && only.check.state === 'missing' && only.col13 === 3000);
  eq('ο κωδικός της κατοικίας παίρνει τη διαφορά', s.e1[0].check.state, 'differs');
  eq('ο κωδικός του καταστήματος παίρνει την έλλειψη', [s.e1[1].check.state, /Κατάστημα/.test(s.e1[1].check.detail)], ['missing', true]);
}

// ═══ ΑΝΕΙΣΠΡΑΚΤΑ: ΚΩΔΙΚΟΣ ΧΩΡΙΣ ΠΟΣΟ, ΓΙΑΤΙ ΛΕΙΠΕΙ Η ΤΕΚΜΗΡΙΩΣΗ ═══════════
{
  const pays = year12('p1', 600).map((x, i) => (i === 11 ? { ...x, paid: false } : x));
  const rr = [buildE2Row(flat, T(), pays, '094014201', 2025)];
  const s = taxisnetSheet({ year: 2025, ownerAfm: '094014201', properties: props.slice(0, 1), rows: rr, reconciliation: reconcilePrefilled(appLinesOf(flat, rr[0]), [aade()]) });
  const u = s.e1.find(l => l.code === E1_4D2.unpaid.home!.code);
  ok('ο κωδικός των ανείσπρακτων εμφανίζεται χωρίς ποσό για πληκτρολόγηση', !!u && u.amount === '' && u.check.state === 'missing' && /600,00€/.test(u.check.detail));
}

// ═══ ΑΓΝΩΣΤΟΣ ΤΥΠΟΣ: ΠΟΤΕ ΣΙΩΠΗΛΑ 103 ════════════════════════════════════
{
  const odd = P({ prop_type: 'spaceship' });
  const rr = [buildE2Row(odd, T(), year12('p1', 600), '094014201', 2025)];
  const s = taxisnetSheet({ year: 2025, ownerAfm: '094014201', properties: props.slice(0, 1), rows: rr, reconciliation: reconcilePrefilled(appLinesOf(odd, rr[0]), [aade()]) });
  eq('χωρίς κωδικό και «λείπει»', [s.e1[0].code, s.e1[0].check.state], ['', 'missing']);
}

// ═══ ΤΟ ΒΙΒΛΙΟ ═════════════════════════════════════════════════════════════
{
  const r = reconcilePrefilled(lines, [aade(), aade({ rowNo: 2, atak: '09876543210', tenantAfm: '987654320', monthlyRent: 1000, gross: 12000 })]);
  const wb = buildCodesWorkbook(taxisnetSheet({ year: 2025, ownerAfm: '094014201', properties: props, rows, reconciliation: r }), 'Γ. Παπαδόπουλος', new Date('2026-03-12T10:00:00Z'));
  eq('ένα φύλλο', wb.SheetNames, ['Κωδικοί Ε1 και Ε2']);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const cells = Object.values(ws).filter((c): c is XLSX.CellObject => !!c && typeof c === 'object' && 'v' in c);
  ok('τα ποσά είναι αριθμοί', cells.some(c => c.t === 'n' && c.v === 12000));
  ok('η στήλη ελέγχου γράφει «Ελέγχθηκε»', cells.some(c => c.v === 'Ελέγχθηκε'));
  ok('η πηγή των κωδικών τυπώνεται', cells.some(c => typeof c.v === 'string' && c.v.includes('4Δ2')));
}

console.log(fail === 0 ? `✓ taxisnetSheet: ${pass} έλεγχοι πέρασαν` : `✗ taxisnetSheet: ${fail} απέτυχαν από ${pass + fail}`);
if (fail > 0) process.exit(1);
