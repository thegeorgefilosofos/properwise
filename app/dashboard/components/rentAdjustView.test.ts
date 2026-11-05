// npx tsx app/dashboard/components/rentAdjustView.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// Η ΚΑΡΤΕΛΑ ΤΗΣ ΑΝΑΠΡΟΣΑΡΜΟΓΗΣ ΚΟΒΕΙ ΣΤΟ ΟΡΙΟ, ΟΠΩΣ ΚΑΙ Η ΕΙΔΟΠΟΙΗΣΗ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ (04/11/2026). Η `RentAdjustView` υπολόγιζε `rent*(1+pct/100)`
// χωρίς όριο: υφιστάμενη επαγγελματική των 1.500€ με ΔΤΚ 3,80% και ισχύ
// Νοέμβριο 2026 έδειχνε και τύπωνε 1.557,00€, ενώ το άρθρο 59 ν. 5255/2025
// επιτρέπει 1.545,00€. Το `adjustmentNoticeText` του παραθύρου έκοβε σωστά.
// Δύο οθόνες, δύο ποσά για την ίδια μίσθωση.
//
// Η δοκιμή αποδίδει την καρτέλα (renderToStaticMarkup, χωρίς βάση) και ζητά
// το ποσό που βγάζουν οι ίδιες συναρτήσεις με το παράθυρο. Μήνας ισχύος: ο
// πρώτος του 2026 με δείκτη ΠΑΝΩ από το όριο, από τα δεδομένα, όχι γραμμένος.
// ═══════════════════════════════════════════════════════════════════════════
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RentAdjustView } from './TabTenantMoney';
import { RENT_INDEX, rentIndexFor } from '@/lib/market/cpi';
import { computeRentAdjustment, adjustmentNoticeText, rentCapPct, COMMERCIAL_RENT_CAP_2026 } from '@/lib/documents/rentAdjustment';
import { fe } from '@/lib/core/format';
import type { Tenant } from './TabTenantTypes';

let passed = 0, failed = 0;
const ok = (name: string, cond: boolean, info?: unknown) => {
  if (cond) passed++; else { failed++; console.log('  ✗ ' + name + (info === undefined ? '' : ' — ' + JSON.stringify(info))); }
};
const textOf = (el: Parameters<typeof renderToStaticMarkup>[0]) =>
  renderToStaticMarkup(el).replace(/<[^>]+>/g, ' ').replace(/­/g, '').replace(/&amp;/g, '&')
    .replace(/\s+(?=,\d{2})/g, '').replace(/(\d)\s+€/g, '$1€').replace(/\s+/g, ' ');

const { pct: CAP, from, to } = COMMERCIAL_RENT_CAP_2026;
// Μήνας ισχύος μέσα στο 2026 με δείκτη πάνω από το όριο (ο δείκτης του μήνα ισχύος).
const months = Array.from({ length: 12 }, (_, i) => `${from.slice(0, 4)}-${String(i + 1).padStart(2, '0')}`)
  .filter(m => `${m}-01` >= from && `${m}-01` <= to);
const ym = months.find(m => (rentIndexFor(m)?.pct ?? 0) > CAP);
ok('υπάρχει μήνας του 2026 με ΔΤΚ πάνω από το όριο', !!ym, Object.keys(RENT_INDEX));

if (ym) {
  const idxPct = rentIndexFor(ym)!.pct;
  const base = { id: 't1', full_name: 'Γ. Παραδειγματίδης', monthly_rent: 1500, lease_start: '2024-03-01', lease_end: '2030-02-28' };
  const render = (lease_category: string | null) =>
    textOf(createElement(RentAdjustView, { userId: 'u1', initialYm: ym, tenant: { ...base, lease_category } as unknown as Tenant }));

  // Το ποσό του παραθύρου: ίδιες συναρτήσεις, ίδια ορίσματα.
  const capPct = rentCapPct({ leaseCategory: 'commercial', leaseStart: base.lease_start, effectiveDate: `${ym}-01` });
  const res = computeRentAdjustment({ currentRent: 1500, method: 'cpi', cpiPct: idxPct, capPct });
  const notice = adjustmentNoticeText({ effectiveDate: '01/11/2026', method: 'cpi', res });
  ok('το παράθυρο κόβει στο όριο', res.capped && res.pctApplied === CAP, res);

  const com = render('commercial');
  ok('επαγγελματική: η καρτέλα δείχνει το νέο μίσθωμα του ορίου', com.includes(`Νέο μίσθωμα ${fe(res.newRent)}`), com.slice(com.indexOf('Νέο μίσθωμα'), com.indexOf('Νέο μίσθωμα') + 40));
  ok('επαγγελματική: ίδιο ποσό με το adjustmentNoticeText', notice.includes(`διαμορφώνεται σε ${fe(res.newRent)}`));
  ok('επαγγελματική: λέει ΓΙΑΤΙ (δείκτης και όριο)', com.includes(`εφαρμόζεται το όριο ${CAP}%`) && com.includes(`αντί για ${fe(res.uncappedRent)}`));

  const resi = render('residential');
  const free = computeRentAdjustment({ currentRent: 1500, method: 'cpi', cpiPct: idxPct, capPct: null });
  ok('κατοικία: χωρίς όριο', resi.includes(`Νέο μίσθωμα ${fe(free.newRent)}`) && !resi.includes('εφαρμόζεται το όριο'));

  const unk = render(null);
  ok('άγνωστο είδος: δείχνει και τα δύο ποσά', unk.includes(fe(free.newRent)) && unk.includes(fe(res.newRent)));
  ok('άγνωστο είδος: ζητά τον τύπο μίσθωσης', unk.includes('Όρισε τον τύπο μίσθωσης'));
}

console.log(`rentAdjustView.test.ts: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
