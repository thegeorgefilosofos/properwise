// npx tsx lib/energy/gas.test.ts
//
// Ο ΕΛΕΓΧΟΣ ΠΟΥ ΚΑΝΕΙ ΤΗ ΜΕΤΑΓΡΑΦΗ ΑΠΟΔΕΙΞΙΜΗ
//
// Πενήντα επτά τιμολόγια αντιγράφηκαν με το χέρι από τον πίνακα της ΡΑΑΕΥ. Σε
// τέτοιο πλήθος ένα λάθος ψηφίο είναι βεβαιότητα, όχι πιθανότητα· δεν
// φαίνεται πουθενά: μια τιμή 0,06879 γραμμένη 0,06789 δείχνει απολύτως φυσιολογική
// στην οθόνη και βγάζει λάθος κατάταξη παρόχων για πάντα.
//
// Γι' αυτό κάθε γραμμή κουβαλά και το σύνολο που δημοσιεύει η ίδια η Αρχή για 100
// kWh. Ο έλεγχος το ξαναφτιάχνει από τα δύο νούμερα που χρησιμοποιεί η εφαρμογή.
// Δεν είναι ταυτολογία: το `raaey100` δεν βγαίνει από τα άλλα δύο πεδία, μπαίνει
// από τον πίνακα ως τρίτη ανεξάρτητη μέτρηση.
import { readFileSync } from 'node:fs';
import { GAS_PROVIDERS, GAS_VERIFIED, GAS_LABEL, GAS_MAX_AGE_DAYS, GAS_MONTH_GEN, GAS_PROVIDER_SOURCES, FAE_PRICES_2026_10, NETWORK_OPERATORS, gasSourceLine } from './gas';
import { RAAEY_READ_AT } from './raaeyCatalogue';
import { PRICE_FACTS, asOfDate } from '@/lib/facts/prices';

let pass = 0, fail = 0;
function ok(name: string, cond: boolean) {
  if (cond) { pass++; } else { fail++; console.error(`✗ ${name}`); }
}
function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; } else { fail++; console.error(`✗ ${name}\n   got  ${g}\n   want ${w}`); }
}

const all = GAS_PROVIDERS.flatMap(p => p.tariffs.map(t => ({ ...t, provider: p.label })));

// ── Η ΑΠΟΔΕΙΞΗ ΤΗΣ ΜΕΤΑΓΡΑΦΗΣ ──────────────────────────────────────────────
{
  // ΟΚΤΩΒΡΙΟΣ 2026: ο πίνακας της ΡΑΑΕΥ δεν δίνει πια σύνολο στις 100 kWh. Το
  // `raaey100` μένει στις τιμές Αυγούστου· οι τιμές του Οκτωβρίου κουβαλούν τη
  // γραμμή τους (`raaey`) και το raaey.test.ts τις ελέγχει κελί προς κελί.
  const aug = all.filter(t => t.raaey100 != null);
  const bad = aug.filter(t => Math.abs(t.fixed + (t.kwh ?? 0) * 100 - (t.raaey100 as number)) > 0.011);
  eq('κάθε γραμμή Αυγούστου ξαναδίνει το σύνολο της ΡΑΑΕΥ στις 100 kWh',
    bad.map(t => `${t.id}: ${t.fixed} + ${t.kwh}×100 = ${(t.fixed + (t.kwh ?? 0) * 100).toFixed(2)}, η ΡΑΑΕΥ λέει ${t.raaey100}`), []);
  // Η τιμή παρόχου έχει `raaey`, αλλά η γραμμή της ΡΑΑΕΥ δεν έχει τιμή να τη
  // συγκρίνει: ο έλεγχός της είναι το κελί του εγγράφου, πιο κάτω.
  eq('και κάθε τιμή έχει έλεγχο: σύνολο Αυγούστου, γραμμή του πίνακα ή κελί του τιμοκαταλόγου του παρόχου',
    all.filter(t => t.raaey100 == null && !(t.providerPrice ? t.providerPrice.cell : t.raaey)).map(t => t.id), []);
  eq('και οι τιμές Αυγούστου γράφουν τον μήνα τους', aug.filter(t => t.priceMonth !== 'Αυγούστου 2026').map(t => t.id), []);
}

// ── ΤΑ ΝΟΥΜΕΡΑ ΕΙΝΑΙ ΝΟΥΜΕΡΑ ───────────────────────────────────────────────
{
  // Άγνωστη τιμή είναι `null`, ποτέ μηδέν: και μόνο εκεί όπου η ΡΑΑΕΥ το γράφει.
  eq('καμία τιμή kWh δεν είναι μηδέν ή αρνητική', all.filter(t => t.kwh != null && !(t.kwh > 0)).map(t => t.id), []);
  eq('κάθε άγνωστη τιμή είναι γραμμή του πίνακα της ΡΑΑΕΥ', all.filter(t => t.kwh == null && !t.raaey).map(t => t.id), []);
  eq('κανένα πάγιο δεν είναι αρνητικό', all.filter(t => t.fixed < 0).map(t => t.id), []);
  // Το εύρος της αγοράς τον Αύγουστο 2026 ήταν 0,0398 έως 0,08699€/kWh. Το
  // κατώφλι δεν ελέγχει την αγορά, πιάνει το ολισθημένο δεκαδικό: 0,6879 αντί
  // 0,06879 περνά κάθε άλλο έλεγχο και δεκαπλασιάζει τον λογαριασμό.
  eq('καμία τιμή δεν έχει ολισθημένο δεκαδικό', all.filter(t => t.kwh != null && (t.kwh < 0.01 || t.kwh > 0.2)).map(t => t.id), []);
  eq('κανένα πάγιο πάνω από 20€ τον μήνα', all.filter(t => t.fixed > 20).map(t => t.id), []);
}

// ── ΤΑΥΤΟΤΗΤΕΣ ─────────────────────────────────────────────────────────────
{
  const ids = all.map(t => t.id);
  eq('κάθε ταυτότητα τιμολογίου είναι μοναδική', ids.length, new Set(ids).size);
  const pids = GAS_PROVIDERS.map(p => p.value);
  eq('κάθε ταυτότητα παρόχου είναι μοναδική', pids.length, new Set(pids).size);
  eq('κάθε πάροχος έχει τουλάχιστον ένα τιμολόγιο', GAS_PROVIDERS.filter(p => p.tariffs.length === 0).map(p => p.value), []);
  eq('κάθε πάροχος έχει επίσημη σελίδα', GAS_PROVIDERS.filter(p => !p.url.startsWith('https://')).map(p => p.value), []);
}

// ── Η ΣΗΜΑΝΣΗ ΣΥΜΦΩΝΕΙ ΜΕ ΤΟΝ ΤΥΠΟ ─────────────────────────────────────────
// ΜΠΛΕ σημαίνει σταθερή τιμή, ΚΙΤΡΙΝΟ κυμαινόμενη. Είναι ο κώδικας χρωμάτων της
// ΡΑΑΕΥ: αν το σήμα πει «σταθερό» σε κυμαινόμενο τιμολόγιο, ο ιδιοκτήτης δεσμεύεται
// νομίζοντας ότι κλείδωσε τιμή.
{
  eq('κάθε ΜΠΛΕ είναι σταθερό', all.filter(t => t.badge === 'ΜΠΛΕ' && t.type !== 'fixed').map(t => t.id), []);
  eq('κάθε ΚΙΤΡΙΝΟ είναι κυμαινόμενο', all.filter(t => t.badge === 'ΚΙΤΡΙΝΟ' && t.type !== 'variable').map(t => t.id), []);
}

// ── Η ΤΙΜΗ ΤΟΥ ΠΑΡΟΧΟΥ ΛΕΕΙ ΑΠΟ ΠΟΥ ΗΡΘΕ ──────────────────────────────────
// 12/10/2026: η ΡΑΑΕΥ δεν έχει ακόμη τιμή Οκτωβρίου για τη ΦΑΕ και ο πάροχος
// τη γράφει σε δικό του τιμοκατάλογο. Η οθόνη έλεγε ότι και τα N τιμολόγια
// είναι «όπως τα δημοσιεύει η ΡΑΑΕΥ»: με τιμή παρόχου χωρίς σήμανση η πρόταση
// θα ήταν ψευδής. Εδώ φυλάγεται ότι η τιμή του παρόχου μπαίνει μόνο όπου η
// ΡΑΑΕΥ σιωπά, με έγγραφο, ημέρα και κελί. Και ότι η οθόνη έχει από πού να
// τη μετρήσει και να την πει.
{
  const own = all.filter(t => t.providerPrice);
  ok('υπάρχει τιμή παρόχου στον κατάλογο', own.length > 0);
  eq('τιμή παρόχου μόνο σε γραμμή όπου η ΡΑΑΕΥ δεν έχει τιμή',
    own.filter(t => !(t.raaeyUnknown && t.raaey)).map(t => t.id), []);
  eq('το έγγραφο του παρόχου είναι σε https',
    own.filter(t => !/^https:\/\/[^/\s]+\/\S+$/.test(t.providerPrice!.url)).map(t => t.id), []);
  eq('η ημέρα ανάγνωσης είναι πραγματική ημέρα',
    own.filter(t => !/^\d{4}-\d{2}-\d{2}$/.test(t.providerPrice!.readAt) || Number.isNaN(Date.parse(t.providerPrice!.readAt))).map(t => t.id), []);
  // Τιμή του παρόχου διαβασμένη πριν από τον πίνακα θα ήταν παλιότερη από ό,τι
  // λέει η ΡΑΑΕΥ για τον ίδιο μήνα: δεν αντικαθιστά τίποτα.
  eq('διαβάστηκε όχι πριν από τον πίνακα της ΡΑΑΕΥ',
    own.filter(t => t.providerPrice!.readAt < RAAEY_READ_AT).map(t => t.id), []);
  eq('η σημείωση λέει ότι η τιμή είναι του τιμοκαταλόγου του παρόχου και πότε διαβάστηκε',
    own.filter(t => !/τιμοκατάλογο του παρόχου/.test(t.desc ?? '') || !(t.desc ?? '').includes(asOfDate(t.providerPrice!.readAt))).map(t => t.id), []);
  eq('είναι τιμή του μήνα του πίνακα', own.filter(t => t.priceMonth !== GAS_MONTH_GEN).map(t => t.id), []);
  eq('χωρίς σύνολο της ΡΑΑΕΥ στις 100 kWh: δεν είναι δική της τιμή', own.filter(t => t.raaey100 != null).map(t => t.id), []);

  // Η οθόνη μετρά από το GAS_PROVIDER_SOURCES: κανένα δεν λείπει, κανένα δεν περισσεύει.
  eq('οι πηγές της οθόνης είναι ακριβώς τα τιμολόγια με τιμή παρόχου',
    GAS_PROVIDER_SOURCES.flatMap(s => s.ids).sort(), own.map(t => t.id).sort());
  eq('και τα ονόματά τους', GAS_PROVIDER_SOURCES.flatMap(s => s.names).sort(), own.map(t => t.name).sort());

  // ΤΟ ΚΕΛΙ ΤΟΥ ΕΓΓΡΑΦΟΥ ΕΙΝΑΙ Ο ΕΛΕΓΧΟΣ ΤΗΣ ΤΙΜΗΣ. Η γραμμή της ΡΑΑΕΥ δεν έχει
  // τιμή και το raaey.test.ts δεν συγκρίνει το `kwh` με τίποτα: χωρίς το κελί,
  // 0,08278 αντί για 0,08728 θα περνούσε κάθε έλεγχο.
  const cellNum = (c: string) => (/^\d+,\d+$/.test(c) ? Number(c.replace(',', '.')) : NaN);
  eq('το `kwh` είναι ο αριθμός του κελιού του εγγράφου',
    own.filter(t => t.kwh !== cellNum(t.providerPrice!.cell)).map(t => `${t.id}: ${t.kwh} ≠ ${t.providerPrice!.cell}`), []);
  eq('η σημείωση λέει την κατηγορία του εγγράφου',
    own.filter(t => !t.providerPrice!.category.trim() || !(t.desc ?? '').includes(`«${t.providerPrice!.category}»`)).map(t => t.id), []);

  // Η ΠΗΓΗ ΖΕΙ ΚΑΙ ΣΤΟ data/price-sources.json. Το lib/facts/prices.ts το λέει:
  // ημερομηνίες και πηγές αλλάζουν εκεί και εδώ μαζί.
  const sources = JSON.parse(readFileSync('data/price-sources.json', 'utf8')) as { gas: { checkedAt: string; sources: { name: string; url: string }[] } };
  eq('κάθε έγγραφο παρόχου είναι στις πηγές του αερίου στο data/price-sources.json',
    GAS_PROVIDER_SOURCES.filter(s => !sources.gas.sources.some(x => x.url === s.url)).map(s => s.url), []);
  eq('και η ημερομηνία ελέγχου του αερίου μένει του πίνακα της ΡΑΑΕΥ', sources.gas.checkedAt, RAAEY_READ_AT);

  // Η ΓΡΑΜΜΗ ΕΝΗΜΕΡΩΣΗΣ ΑΡΧΙΖΕΙ ΑΠΟ ΤΗΝ ΗΜΕΡΑ ΤΗΣ ΡΑΑΕΥ. Από αυτήν μετρά η πύλη
  // παλαιότητας (`GAS_VERIFIED`) και αυτήν έχουν όλα εκτός από τα τιμολόγια
  // του παρόχου· η ημέρα του παρόχου μπαίνει μετά, με το πλήθος.
  const line = gasSourceLine(all);
  ok('η γραμμή ενημέρωσης αρχίζει από την ημέρα της ΡΑΑΕΥ, την ίδια με της πύλης παλαιότητας',
    asOfDate(GAS_VERIFIED) === asOfDate(RAAEY_READ_AT) && line.startsWith(`Τελευταία ενημέρωση ΡΑΑΕΥ: ${asOfDate(RAAEY_READ_AT)}. Πηγή: ${PRICE_FACTS.gas.source}· `));
  ok('και πόσα τιμολόγια είναι του παρόχου', line.includes(`για ${own.length} από τα ${all.length} τιμολόγια τιμοκατάλογος του παρόχου`));
  ok('και την ημέρα του τιμοκαταλόγου του παρόχου, μετά από της ΡΑΑΕΥ',
    own.every(t => line.indexOf(`ανάγνωση ${asOfDate(t.providerPrice!.readAt)}`) > line.indexOf(asOfDate(RAAEY_READ_AT))));
  eq('χωρίς τιμή παρόχου είναι η γραμμή του πίνακα, ίδια με πριν',
    gasSourceLine(all.filter(t => !t.providerPrice)), `Τελευταία ενημέρωση: ${asOfDate(RAAEY_READ_AT)}. Πηγή: ${PRICE_FACTS.gas.source}`);
  eq('ένα τιμολόγιο του παρόχου μόνο του λέει μόνο τον πάροχο',
    gasSourceLine(own.slice(0, 1)), `Τελευταία ενημέρωση: ${asOfDate(own[0].providerPrice!.readAt)}. Πηγή: τιμοκατάλογος του παρόχου`);

  // Για το «Πλήρες Extra» δεν βρέθηκε τιμή Οκτωβρίου στο ίδιο έγγραφο: μένει στον
  // Αύγουστο, εκτός σειράς και η σημείωση το λέει μη επαληθευμένο.
  const extra = all.find(t => t.id === 'fae_extra');
  eq('«Πλήρες Extra»: Αύγουστος, χωρίς τιμή παρόχου, άγνωστο στη ΡΑΑΕΥ',
    [extra?.priceMonth, extra?.providerPrice, extra?.raaeyUnknown], ['Αυγούστου 2026', undefined, true]);
  ok('«Πλήρες Extra»: η σημείωση το λέει μη επαληθευμένο', /μη επαληθευμένη/.test(extra?.desc ?? ''));
  // Ο ΜΗΝΑΣ ΤΗΣ ΣΗΜΕΙΩΣΗΣ ΕΙΝΑΙ ΤΟΥ ΕΓΓΡΑΦΟΥ ΚΑΙ ΤΟ ΕΓΓΡΑΦΟ ΕΙΝΑΙ ΤΟΥ ΜΗΝΑ ΤΟΥ
  // ΠΙΝΑΚΑ. Με πίνακα της ΡΑΑΕΥ άλλου μήνα ο έλεγχος κοκκινίζει και ζητά νέα
  // ανάγνωση του τιμοκαταλόγου, αντί η σημείωση να μιλά για παλιό μήνα.
  eq('ο τιμοκατάλογος του παρόχου είναι του μήνα του πίνακα', FAE_PRICES_2026_10.month, GAS_MONTH_GEN);
  ok('«Πλήρες Extra»: η σημείωση λέει τον μήνα και την ημέρα ανάγνωσης του εγγράφου',
    (extra?.desc ?? '').includes(`Στον τιμοκατάλογο ${GAS_MONTH_GEN} του παρόχου (ανάγνωση ${asOfDate(FAE_PRICES_2026_10.readAt)}) δεν βρέθηκε`));
  const MONTHS_GEN = /(Ιανουαρίου|Φεβρουαρίου|Μαρτίου|Απριλίου|Μαΐου|Ιουνίου|Ιουλίου|Αυγούστου|Σεπτεμβρίου|Οκτωβρίου|Νοεμβρίου|Δεκεμβρίου) \d{4}/gu;
  eq('σημείωση της ΦΑΕ που λέει μήνα λέει τον μήνα του πίνακα',
    all.filter(t => t.id.startsWith('fae_')).flatMap(t => [...(t.desc ?? '').matchAll(MONTHS_GEN)].map(m => m[0]).filter(m => m !== GAS_MONTH_GEN).map(m => `${t.id}: ${m}`)), []);
}

// ── ΚΑΙ ΤΑ ΔΥΟ ΤΜΗΜΑΤΑ ΕΧΟΥΝ ΕΠΙΛΟΓΕΣ ──────────────────────────────────────
// Η οθόνη έχει διακόπτη «Οικιακό / Επιχειρηματικό». Ενα τμήμα χωρίς τιμολόγια
// δίνει άδειο πίνακα σύγκρισης χωρίς καμία εξήγηση.
{
  const res = all.filter(t => t.segment === 'residential');
  const biz = all.filter(t => t.segment === 'business');
  ok('υπάρχουν οικιακά τιμολόγια', res.length >= 10);
  ok('υπάρχουν επαγγελματικά τιμολόγια', biz.length >= 5);
  eq('κάθε τιμολόγιο ανήκει σε ένα από τα δύο', all.length, res.length + biz.length);
}

// ── ΚΑΘΕ ΤΙΜΟΛΟΓΙΟ ΛΕΕΙ ΤΙ ΕΙΝΑΙ ───────────────────────────────────────────
{
  eq('κάθε τιμολόγιο έχει όνομα', all.filter(t => !t.name.trim()).map(t => t.id), []);
  // Οπου υπάρχει σημείωση της ΡΑΑΕΥ, έχει περιεχόμενο. Οπου δεν υπάρχει, λείπει
  // ολόκληρη: κενή συμβολοσειρά θα τύπωνε άδεια γραμμή στην οθόνη.
  eq('καμία κενή σημείωση', all.filter(t => t.desc !== undefined && !t.desc.trim()).map(t => t.id), []);
  ok('οι περισσότερες γραμμές φέρουν σημείωση της ΡΑΑΕΥ', all.filter(t => t.desc).length >= 50);
  eq('καμία σημείωση δεν υπόσχεται τελικό λογαριασμό',
    all.filter(t => /τελικ\w* λογαριασμ/i.test(t.desc ?? '')).map(t => t.id), []);
}

// ── ΟΙ ΔΕΣΜΕΥΣΕΙΣ ΕΙΝΑΙ ΠΡΑΓΜΑΤΙΚΕΣ ΔΙΑΡΚΕΙΕΣ ──────────────────────────────
{
  const withM = all.filter(t => t.contract_months !== undefined);
  eq('κάθε διάρκεια δέσμευσης είναι από τις γνωστές του κλάδου',
    withM.filter(t => ![12, 18, 24].includes(t.contract_months as number)).map(t => t.id), []);
  ok('υπάρχουν και τιμολόγια χωρίς δέσμευση', all.length > withM.length);
}

// ── ΤΟ ΔΙΚΤΥΟ ──────────────────────────────────────────────────────────────
{
  eq('τρεις διαχειριστές δικτύου, όσοι και στην Ελλάδα', NETWORK_OPERATORS.length, 3);
  const vs = NETWORK_OPERATORS.map(n => n.value);
  eq('με μοναδικές ταυτότητες', vs.length, new Set(vs).size);
}

// ── Η ΗΜΕΡΟΜΗΝΙΑ ΕΠΑΛΗΘΕΥΣΗΣ ───────────────────────────────────────────────
{
  ok('η ημερομηνία επαλήθευσης είναι πραγματική ημέρα', !Number.isNaN(new Date(`${GAS_VERIFIED}T00:00:00`).getTime()));
  ok('και η ετικέτα της οθόνης δεν είναι κενή', GAS_LABEL.trim().length > 0);
  ok('το κατώφλι παλαιότητας είναι θετικό', GAS_MAX_AGE_DAYS > 0);
}

console.log(fail === 0 ? `✓ κατάλογος αερίου: ${pass} έλεγχοι πέρασαν` : `✗ κατάλογος αερίου: ${fail} απέτυχαν από ${pass + fail}`);
if (fail > 0) process.exit(1);
