// npx tsx lib/legal/dpa.test.ts
import { dpaAccepted, ensureDpa, DPA_VERSION } from './dpa';

let p = 0, f = 0;
const ok = (c: boolean, m: string) => { if (c) p++; else { f++; console.error('✗', m); } };

const db = (meta: Record<string, unknown> | null, error: unknown = null) => ({
  auth: { getUser: async () => ({ data: { user: meta ? { user_metadata: meta } : null }, error }) },
});

(async () => {
  ok(dpaAccepted({ dpa_version: DPA_VERSION }), 'η τρέχουσα έκδοση μετρά ως αποδοχή');
  ok(!dpaAccepted({ dpa_version: '2020-01' }), 'παλιότερη έκδοση δεν μετρά');
  ok(await ensureDpa(db({ dpa_version: DPA_VERSION })), 'με αποδοχή, η αποθήκευση προχωρά χωρίς ερώτηση');
  // Χωρίς παράθυρο να ρωτήσει (εδώ δεν υπάρχει window), η απάντηση είναι όχι.
  ok(!(await ensureDpa(db({}))), 'χωρίς αποδοχή και χωρίς παράθυρο, τίποτα δεν αποθηκεύεται');

  console.log(`\nlegal/dpa.ts — ${p} passed, ${f} failed`);
  if (f > 0) process.exit(1);
  console.log('όλα πέρασαν');
})();
