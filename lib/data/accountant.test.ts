// npx tsx lib/data/accountant.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// Η ΣΤΗΛΗ «ΤΙ ΛΕΙΠΕΙ» ΔΙΑΒΑΖΕΤΑΙ ΑΠΟ ΑΝΘΡΩΠΟ ΠΟΥ ΒΙΑΖΕΤΑΙ
// ─────────────────────────────────────────────────────────────────────────
// Ο λογιστής ανοίγει τη λίστα με ογδόντα πελάτες τον Μάρτιο. Δεν διαβάζει
// παραγράφους: κοιτά μια στήλη και αποφασίζει ποιον θα πάρει τηλέφωνο. Άρα
// κάθε φράση πρέπει να στέκεται μόνη της, να είναι στον σωστό αριθμό και η
// σειρά να βάζει μπροστά αυτό που όντως εμποδίζει.
// ═══════════════════════════════════════════════════════════════════════════
import { gapsOf, readinessOf, aadeStateOf, aadeStateLabel, type ClientCounts, type ClientPack } from './accountant';

let pass = 0, fail = 0;
const fails: string[] = [];
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; fails.push(n); } };
const eq = (n: string, got: unknown, want: unknown) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) pass++; else { fail++; fails.push(`${n} — got ${g}, want ${w}`); }
};

const base: ClientCounts = {
  ownerId: 'o1', name: 'Δοκιμή', afm: '123456789', linkedAt: '2026-01-01', token: 'tok1',
  lastActivity: '2026-03-12T10:00:00Z', requests: [],
  properties: 2, expenses: 18, uncategorised: 0, noSupplierAfm: 0,
  rentsUnpaid: 0, stays: 8, staysNoFee: 0, openRequests: 0,
};

// ── Ο πλήρης φάκελος δεν παράγει θόρυβο ────────────────────────────────────
eq('τίποτα δεν λείπει', gapsOf(base).length, 0);
eq('και το λέει με μία λέξη', readinessOf(gapsOf(base)).label, 'Έτοιμος');

// ── Χωρίς ακίνητο, τα υπόλοιπα δεν λέγονται καν ────────────────────────────
// Ένας πελάτης που μόλις γράφτηκε θα έβγαζε πέντε γραμμές «λείπει», όλες
// συνέπειες του ίδιου πράγματος. Ο λογιστής θα διάβαζε πέντε φορές ότι ο
// λογαριασμός είναι άδειος.
{
  const empty = { ...base, properties: 0, expenses: 0, afm: null };
  eq('ένα ακίνητο λείπει, μία γραμμή', gapsOf(empty).length, 1);
  eq('και είναι η σωστή', gapsOf(empty)[0].key, 'no_properties');
  eq('μπλοκάρει', readinessOf(gapsOf(empty)).label, 'Δεν κλείνει');
}

// ── Οι αριθμοί συμφωνούν με τη γλώσσα ──────────────────────────────────────
{
  const one = gapsOf({ ...base, uncategorised: 1 }).find(g => g.key === 'uncategorised')!;
  const many = gapsOf({ ...base, uncategorised: 4 }).find(g => g.key === 'uncategorised')!;
  eq('ενικός', one.item, '1 δαπάνη χωρίς κατηγορία');
  eq('πληθυντικός', many.item, '4 δαπάνες χωρίς κατηγορία');

  const s1 = gapsOf({ ...base, staysNoFee: 1 }).find(g => g.key === 'stays_no_fee')!;
  const s2 = gapsOf({ ...base, staysNoFee: 3 }).find(g => g.key === 'stays_no_fee')!;
  eq('μία κράτηση', s1.item, '1 κράτηση πλατφόρμας χωρίς προμήθεια');
  eq('τρεις κρατήσεις', s2.item, '3 κρατήσεις πλατφόρμας χωρίς προμήθεια');

  const r1 = gapsOf({ ...base, rentsUnpaid: 1 }).find(g => g.key === 'rents_unpaid')!;
  eq('ένα μίσθωμα', r1.item, '1 ανείσπρακτο μίσθωμα');
}

// ── Ό,τι εμποδίζει, μπροστά ────────────────────────────────────────────────
{
  const messy = gapsOf({ ...base, uncategorised: 3, noSupplierAfm: 5, rentsUnpaid: 2, afm: null });
  const firstNonBlocking = messy.findIndex(g => !g.blocking);
  const lastBlocking = messy.map(g => g.blocking).lastIndexOf(true);
  ok('κανένα μπλοκαριστικό μετά από μη μπλοκαριστικό', lastBlocking < firstNonBlocking);
  eq('η κατάσταση το λέει', readinessOf(messy).label, 'Δεν κλείνει');
  eq('και μετρά πόσα', readinessOf(messy).blocking, 1);
}

// ── «Σχεδόν έτοιμος» υπάρχει και δεν είναι το ίδιο με «έτοιμος» ───────────
{
  const soft = gapsOf({ ...base, rentsUnpaid: 1 });
  eq('μόνο μαλακές εκκρεμότητες', readinessOf(soft).label, 'Σχεδόν έτοιμος');
  eq('χωρίς μπλοκαριστικά', readinessOf(soft).blocking, 0);
}

// ── Κάθε φράση στέκεται μόνη της ───────────────────────────────────────────
// Καμία δεν ξεκινά με μικρό γράμμα σαν συνέχεια άλλης πρότασης και καμία δεν
// τελειώνει με τελεία: μπαίνει σε κελί στήλης, όχι σε παράγραφο.
{
  const all = gapsOf({ ...base, properties: 1, expenses: 0, uncategorised: 2, noSupplierAfm: 2, rentsUnpaid: 2, staysNoFee: 2, afm: null });
  const bad = all.filter(g => /\.$/.test(g.item) || g.item.trim() !== g.item);
  eq('καμία φράση με τελεία ή κενά στις άκρες', bad.map(g => g.key).join(', '), '');
  const dup = new Set(all.map(g => g.key));
  eq('κάθε κλειδί μία φορά', dup.size, all.length);
}

// ── Το προσυμπληρωμένο Ε2 και ο φάκελος ────────────────────────────────────
// Ο λογιστής βλέπει ΠΛΗΘΗ: πόσες διαφορές, αν ανέβηκε, αν στάλθηκε φάκελος.
// Ενα παλιό «συμφωνεί» μετά από νέο ανέβασμα δεν επιτρέπεται να μείνει.
{
  const pack = (o: Partial<ClientPack> = {}): ClientPack => ({
    ownerAfm: '094014201', differences: 0, checkedAt: '2026-03-10T10:00:00Z', missingCount: 0, missingTop: [],
    filePath: 'o1/accountant-pack/2025/094014201.zip', sizeBytes: 2048, sharedAt: '2026-03-10T10:00:00Z', ...o,
  });
  eq('δεν ανέβηκε', aadeStateOf({ aadeRows: 0, aadeChangedAt: null, packs: [] }).kind, 'not_uploaded');
  eq('χωρίς απάντηση της νέας βάσης: τίποτα δεν λέγεται', gapsOf(base).length, 0);
  eq('ανέβηκε, χωρίς σύγκριση: εκκρεμεί', aadeStateOf({ aadeRows: 3, aadeChangedAt: '2026-03-11T10:00:00Z', packs: [] }).kind, 'pending');
  eq('συμφωνεί', aadeStateOf({ aadeRows: 3, aadeChangedAt: '2026-03-09T10:00:00Z', packs: [pack()] }).kind, 'matches');
  eq('νέο ανέβασμα μετά τη σύγκριση: εκκρεμεί, όχι «συμφωνεί»',
    aadeStateOf({ aadeRows: 3, aadeChangedAt: '2026-03-12T10:00:00Z', packs: [pack()] }).kind, 'pending');
  const two = aadeStateOf({ aadeRows: 5, aadeChangedAt: '2026-03-09T10:00:00Z', packs: [pack({ differences: 2 }), pack({ ownerAfm: '123456783', differences: 1 })] });
  eq('διαφορές από δύο ΑΦΜ αθροίζονται', two, { kind: 'differences', count: 3 });
  eq('η φράση λέει το πλήθος', aadeStateLabel(two), '3 διαφορές με το προσυμπληρωμένο Ε2');
  const g = gapsOf({ ...base, e2: { aadeRows: 5, aadeChangedAt: '2026-03-09T10:00:00Z', packs: [pack({ differences: 2, filePath: null })] } });
  ok('οι διαφορές μπλοκάρουν', g.some(x => x.key === 'aade_diff' && x.blocking));
  ok('φάκελος που δεν στάλθηκε: λέγεται', g.some(x => x.key === 'pack' && !x.blocking));
  const none = gapsOf({ ...base, e2: { aadeRows: 0, aadeChangedAt: null, packs: [] } });
  ok('το προσυμπληρωμένο που λείπει λέγεται', none.some(x => x.key === 'aade_e2'));
  eq('έτοιμος πελάτης: σύγκριση που συμφωνεί και φάκελος', gapsOf({ ...base, e2: { aadeRows: 2, aadeChangedAt: '2026-03-09T10:00:00Z', packs: [pack()] } }).length, 0);
}

console.log(`\naccountant: ${fail === 0 ? `✓ ${pass} έλεγχοι` : `✗ ${fail} απέτυχαν από ${pass + fail}`}`);
if (fail) { console.log(fails.map(f => '  ✗ ' + f).join('\n')); process.exit(1); }
