// npx tsx app/dashboard/components/BillsProviders.test.ts
//
// Ο ΠΙΝΑΚΑΣ ΤΩΝ ΠΡΟΓΡΑΜΜΑΤΩΝ INTERNET: ΣΕΙΡΑ ΚΑΙ ΗΜΕΡΟΜΗΝΙΑ
//
// Δύο πράγματα φυλάγονται εδώ. Η ταξινόμηση κατά τιμή γίνεται σε αντίγραφο:
// το `.sort()` πάνω στο `INTERNET_PLANS` άλλαζε τη σταθερά της ενότητας μέσα
// στην απόδοση. Και η πρόταση κάτω από τη γραμμή «Τελευταία ενημέρωση» λέει
// ακριβώς πόσα προγράμματα καλύπτει η ημερομηνία του παρόχου: της Vodafone
// (04/10/2026, σελίδα fiber-to-the-home) φαινόταν να καλύπτει και δύο
// γραμμές της σελίδας τηλεόρασης χωρίς δική τους ημερομηνία.
import { INTERNET_PLANS, plansByPrice, planCaveat, planDateScope } from './BillsProviders';
import { TELECOM_FACTS, asOfDate } from '@/lib/facts/prices';

let pass = 0, fail = 0;
function ok(name: string, cond: boolean) {
  if (cond) { pass++; } else { fail++; console.error(`✗ ${name}`); }
}
function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; } else { fail++; console.error(`✗ ${name}\n   got  ${g}\n   want ${w}`); }
}

// ── Η ΣΕΙΡΑ ΚΑΤΑ ΤΙΜΗ ΔΕΝ ΑΓΓΙΖΕΙ ΤΗ ΣΤΑΘΕΡΑ ─────────────────────────────────
{
  const declared = Object.fromEntries(Object.entries(INTERNET_PLANS).map(([k, v]) => [k, v.map(p => p.id)]));
  // Χωρίς προγράμματα εκτός σειράς τιμής ο έλεγχος δεν θα έλεγε τίποτα.
  ok('ο κατάλογος έχει πάροχο δηλωμένο εκτός σειράς τιμής',
    Object.values(INTERNET_PLANS).some(v => v.some((p, i) => i > 0 && p.price < v[i - 1].price)));
  for (const provider of Object.keys(INTERNET_PLANS)) {
    const sorted = plansByPrice(provider);
    ok(`${provider}: από το φθηνότερο`, sorted.every((p, i) => i === 0 || sorted[i - 1].price <= p.price));
    eq(`${provider}: ίδια προγράμματα`, sorted.map(p => p.id).sort(), [...declared[provider]].sort());
    eq(`${provider}: η σταθερά κρατά τη σειρά της δήλωσης`, INTERNET_PLANS[provider].map(p => p.id), declared[provider]);
    // Δεύτερη απόδοση: ίδιο αποτέλεσμα, ίδια σταθερά.
    eq(`${provider}: δεύτερη κλήση, ίδια σειρά`, plansByPrice(provider).map(p => p.id), sorted.map(p => p.id));
  }
  eq('άγνωστος πάροχος: κανένα πρόγραμμα', plansByPrice('δεν υπάρχει'), []);
}

// ── Η ΗΜΕΡΟΜΗΝΙΑ ΤΟΥ ΠΑΡΟΧΟΥ ΚΑΛΥΠΤΕΙ ΜΟΝΟ ΟΣΑ ΔΕΝ ΕΧΟΥΝ ΕΝΔΕΙΞΗ ─────────────
{
  const date = asOfDate(TELECOM_FACTS.vodafone.checkedAt);
  const vf = plansByPrice('vodafone');
  const caveat = (id: string) => planCaveat(vf.find(p => p.id === id)?.note ?? '', date);
  for (const id of ['v_f100_tv', 'v_ff300p_tv']) {
    eq(`${id}: της σελίδας τηλεόρασης, χωρίς ημερομηνία ανάγνωσης`, caveat(id), 'χωρίς ημερομηνία ελέγχου');
  }
  // Η ημερομηνία της Vodafone είναι της σελίδας fiber-to-the-home: τα τρία
  // Full Fiber Plus χωρίς τηλεόραση. Κάθε άλλη γραμμή έχει ένδειξη.
  eq('Vodafone: χωρίς ένδειξη μένουν μόνο τα προγράμματα της σελίδας της ημερομηνίας',
    vf.filter(p => !planCaveat(p.note, date)).map(p => p.id).sort(), ['v_ff1g', 'v_ff300', 'v_ff500']);
  const scope = planDateScope(vf, date) ?? '';
  ok('Vodafone: η πρόταση λέει πόσα από όλα καλύπτει η ημερομηνία', scope.includes(`μόνο τα 3 από τα ${vf.length} προγράμματα`));

  for (const [provider, fact] of Object.entries(TELECOM_FACTS)) {
    const plans = plansByPrice(provider);
    const d = asOfDate(fact.checkedAt);
    const covered = plans.filter(p => !planCaveat(p.note, d)).length;
    const s = planDateScope(plans, d);
    if (covered === plans.length) ok(`${provider}: όλα καλυμμένα, καμία πρόταση`, s === null);
    else ok(`${provider}: η πρόταση μετρά ${covered} από ${plans.length}`, !!s && s.includes(`από τα ${plans.length} προγράμματα`) && (covered < 2 || s.includes(`μόνο τα ${covered} `)));
  }
  eq('κανένα καλυμμένο', planDateScope([{ note: 'Τιμή μη επαληθευμένη.' }, { note: 'Τιμή μη επαληθευμένη.' }], '12/10/2026'),
    'Η ημερομηνία αυτή δεν καλύπτει κανένα από τα 2 προγράμματα· η ένδειξη γράφει αν δεν επιβεβαιώθηκαν, πότε διαβάστηκαν ή ότι δεν έχουν ημερομηνία ελέγχου.');
  ok('ένα καλυμμένο: ενικός', (planDateScope([{ note: 'x' }, { note: 'Τιμή μη επαληθευμένη.' }], '12/10/2026') ?? '').includes('μόνο ένα από τα 2 προγράμματα, αυτό χωρίς ένδειξη'));
  ok('ανάγνωση την ίδια μέρα με του παρόχου: χωρίς ένδειξη', planCaveat('Από τη σελίδα, ανάγνωση 12/10/2026.', '12/10/2026') === null);
  ok('ανάγνωση άλλη μέρα: ένδειξη με τη μέρα', planCaveat('Από τη σελίδα, ανάγνωση 05/10/2026.', '12/10/2026') === 'ανάγνωση 05/10/2026');
}

console.log(fail === 0 ? `✓ προγράμματα internet: ${pass} έλεγχοι πέρασαν` : `✗ προγράμματα internet: ${fail} απέτυχαν από ${pass + fail}`);
if (fail > 0) process.exit(1);
