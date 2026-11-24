// npx tsx lib/data/mydata.test.ts
//
// Η ΔΑΠΑΝΗ ΑΠΟ ΤΟ ΠΑΡΑΣΤΑΤΙΚΟ: ποσά της ΑΑΔΕ και πληρωμή ΜΟΝΟ όπως την είπε ο
// χρήστης (θωράκιση 24/11/2026, Μ7 του λογιστικού ελέγχου). Η ημερομηνία
// έκδοσης δεν γίνεται ποτέ ημερομηνία πληρωμής.
import { expenseFromDoc, type PendingDoc } from './mydata';
import { paymentFields } from '@/lib/mydata/review';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean) => { if (cond) pass++; else { fail++; console.error('✗ ' + name); } };

const doc: PendingDoc = {
  id: 'd1', mark: 400001000000101, counterpart_afm: '099000037', counterpart_name: null, doc_type: '2.1',
  issue_date: '2026-11-02', title: 'Τιμολόγιο Παροχής Υπηρεσιών Α 101', net_cents: 10000, vat_cents: 2400,
  gross_cents: 12400, is_credit: false,
};
const scope = { propertyId: 'p0', userId: 'u1' };

{
  const r = expenseFromDoc(doc, scope, 'Ρεύμα', 'ΔΕΗ', paymentFields('bank', ''));
  ok('τράπεζα χωρίς ημερομηνία: πληρωμένη', r.paid === true && r.payment_method === 'Ηλεκτρονική πληρωμή');
  ok('τράπεζα χωρίς ημερομηνία: ημερομηνία πληρωμής κενή', r.paid_on === null);
  ok('η ημερομηνία της δαπάνης είναι της έκδοσης', r.date === '2026-11-02');
  ok('το ποσό της ΑΑΔΕ: 124,00', r.amount === 124);
}
{
  const r = expenseFromDoc(doc, scope, 'Ρεύμα', 'ΔΕΗ', paymentFields('cash', '2026-11-28'));
  ok('μετρητά με ημερομηνία του χρήστη', r.paid === true && r.payment_method === 'Μετρητά' && r.paid_on === '2026-11-28');
}
{
  const r = expenseFromDoc(doc, scope, 'Ρεύμα', 'ΔΕΗ', paymentFields('unpaid', '2026-11-28'));
  ok('δεν πληρώθηκε: όχι πληρωμένη, χωρίς τρόπο και ημερομηνία', r.paid === false && r.payment_method === null && r.paid_on === null);
}
{
  const r = expenseFromDoc(doc, scope, 'Ρεύμα', 'ΔΕΗ');
  ok('χωρίς ερώτηση: όχι πληρωμένη', r.paid === false && r.paid_on === null);
}

console.log(`mydata data: ${pass} ✓ · ${fail} ✗`);
if (fail) process.exit(1);
