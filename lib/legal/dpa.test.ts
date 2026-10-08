// npx tsx lib/legal/dpa.test.ts
import { dpaAccepted, ensureDpa, DPA_VERSION, DPA_EVENT, type DpaRequestDetail } from './dpa';

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

  // ΤΟ ΣΥΜΒΟΛΑΙΟ ΠΟΥ ΣΤΗΡΙΖΟΥΝ ΟΙ ΚΛΗΣΕΙΣ ΤΩΝ ΠΕΛΑΤΩΝ ΚΑΙ ΤΗΣ ΝΟΑΣ. Με window,
  // η απάντηση είναι ό,τι πει το παράθυρο· χωρίς κανέναν να το αναλάβει, όχι.
  const g = globalThis as unknown as { window?: EventTarget };
  g.window = new EventTarget();
  const answer = (yes: boolean) => (e: Event) => {
    const d = (e as CustomEvent<DpaRequestDetail>).detail;
    d.handled = true;
    d.resolve(yes);
  };
  const accept = answer(true);
  g.window.addEventListener(DPA_EVENT, accept);
  ok(await ensureDpa(db({})), 'με «Αποδέχομαι» στο παράθυρο, η αποθήκευση προχωρά');
  g.window.removeEventListener(DPA_EVENT, accept);
  const decline = answer(false);
  g.window.addEventListener(DPA_EVENT, decline);
  ok(!(await ensureDpa(db({}))), 'με «Όχι τώρα», τίποτα δεν αποθηκεύεται');
  g.window.removeEventListener(DPA_EVENT, decline);
  ok(!(await ensureDpa(db({}))), 'χωρίς κανέναν να αναλάβει το αίτημα, τίποτα δεν αποθηκεύεται');
  // Σφάλμα δικτύου στο getUser: ακόμη κι όποιος έχει αποδεχτεί ξαναρωτιέται.
  let asked = 0;
  const count = answer(true);
  const seen = (e: Event) => { asked++; count(e); };
  g.window.addEventListener(DPA_EVENT, seen);
  await ensureDpa(db({ dpa_version: DPA_VERSION }, new Error('net')));
  ok(asked === 1, 'με σφάλμα στο getUser, το παράθυρο ξαναρωτά');
  g.window.removeEventListener(DPA_EVENT, seen);
  delete g.window;

  console.log(`\nlegal/dpa.ts — ${p} passed, ${f} failed`);
  if (f > 0) process.exit(1);
  console.log('όλα πέρασαν');
})();
