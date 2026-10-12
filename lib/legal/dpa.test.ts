// npx tsx lib/legal/dpa.test.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

  // ΤΟ ΠΑΡΑΘΥΡΟ ΔΕΝ ΥΠΟΣΧΕΤΑΙ ΚΑΛΥΨΗ ΠΟΥ ΔΕΝ ΓΡΑΦΕΙ Η ΣΥΜΒΑΣΗ. Το άρθρο 28§3
  // θέλει τις κατηγορίες υποκειμένων στη σύμβαση. Το παράθυρο έλεγε «ενοικιαστών
  // και επισκεπτών», ενώ οι Όροι (/terms#epexergasia) γράφουν μόνο ενοικιαστές
  // και συνεργάτες: η αποδοχή καταγραφόταν για κείμενο που δεν τους καλύπτει.
  {
    const flat = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8');
    const terms = flat(read('app', 'terms', 'page.tsx'));
    const subjects = terms.match(/κατηγοριες υποκειμενων ειναι ([^·;.]+)/)?.[1] ?? '';
    ok(subjects.length > 0, 'οι Όροι γράφουν κατηγορίες υποκειμένων');
    const modal = read('app', 'dashboard', 'components', 'DpaModal.tsx');
    const copy = flat([...modal.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map(m => m[1]).join(' '));
    // Τα πρόσωπα που μπορεί να ονομάσει ένα παράθυρο αποδοχής σε αυτή την εφαρμογή.
    const PEOPLE = ['ενοικιαστ', 'συνεργατ', 'επισκεπτ', 'φιλοξενουμεν', 'ταξιδιωτ', 'συνταξιδιωτ'];
    const named = PEOPLE.filter(w => copy.includes(w));
    ok(named.length > 0, 'το παράθυρο λέει ποιων τα στοιχεία καλύπτει');
    for (const w of named) ok(subjects.includes(w), `το παράθυρο ονομάζει «${w}…» που δεν είναι στις κατηγορίες υποκειμένων των Όρων`);
  }

  console.log(`\nlegal/dpa.ts — ${p} passed, ${f} failed`);
  if (f > 0) process.exit(1);
  console.log('όλα πέρασαν');
})();
