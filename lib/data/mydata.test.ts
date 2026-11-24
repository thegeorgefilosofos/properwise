// npx tsx lib/data/mydata.test.ts
//
// Η ΔΑΠΑΝΗ ΑΠΟ ΤΟ ΠΑΡΑΣΤΑΤΙΚΟ: ποσά της ΑΑΔΕ και πληρωμή ΜΟΝΟ όπως την είπε ο
// χρήστης (θωράκιση 24/11/2026, Μ7 του λογιστικού ελέγχου). Η ημερομηνία
// έκδοσης δεν γίνεται ποτέ ημερομηνία πληρωμής.
import * as mydata from './mydata';
import { expenseFromDoc, type PendingDoc } from './mydata';
import { MYDATA_JOINT_VERSION } from '@/lib/legal/mydataJoint';
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

// ── Ε2: το κλειδί πηγαίνει ΜΟΝΟ στη συνάρτηση άκρου, στο σώμα της κλήσης ────
void (async () => {
  const calls: { kind: string; name: string; arg: unknown }[] = [];
  const db = {
    functions: { invoke: async (name: string, opts: unknown) => { calls.push({ kind: 'fn', name, arg: opts }); return { data: { ok: true, partial: false }, error: null }; } },
    rpc: async (name: string, arg: unknown) => { calls.push({ kind: 'rpc', name, arg }); return { data: { ok: true }, error: null }; },
  } as unknown as mydata.Db;
  const sync = (mydata as unknown as { sync?: (d: mydata.Db, c: { aadeUserId: string; key: string }) => Promise<unknown> }).sync;
  const KEY = 'abcdEFGH12345678abcdEFGH12345678';
  await sync?.(db, { aadeUserId: ' logistis1 ', key: ` ${KEY} ` });
  const fn = calls.find(c => c.kind === 'fn') as { arg: { body?: Record<string, unknown>; region?: string } } | undefined;
  ok('Ε2: «Φέρε τώρα» στέλνει user id και κλειδί στο σώμα', fn?.arg.body?.action === 'sync' && fn?.arg.body?.aadeUserId === 'logistis1' && fn?.arg.body?.key === KEY);
  ok('Κ-6: η κλήση ζητά εκτέλεση στη Φρανκφούρτη', fn?.arg.region === 'eu-central-1');
  ok('Ε2: το κλειδί δεν πηγαίνει σε καμία κλήση της βάσης', !calls.some(c => c.kind === 'rpc' && JSON.stringify(c.arg).includes(KEY)));
  ok('Ε2: δεν υπάρχει πια «Σύνδεση» που φυλάει ούτε «Αφαίρεση κλειδιού»', !('connect' in mydata) && !('removeKey' in mydata));
  const accept = (mydata as unknown as { acceptJoint?: (d: mydata.Db) => Promise<unknown> }).acceptJoint;
  await accept?.(db);
  const rpc = calls.find(c => c.kind === 'rpc' && c.name === 'mydata_joint_accept');
  ok('Ε-1: η αποδοχή στέλνει την τρέχουσα έκδοση της ρύθμισης', (rpc?.arg as { p_version?: string } | undefined)?.p_version === MYDATA_JOINT_VERSION);

  console.log(`mydata data: ${pass} ✓ · ${fail} ✗`);
  if (fail) process.exit(1);
})();
