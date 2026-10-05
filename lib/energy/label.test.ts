// npx tsx lib/energy/label.test.ts
//
// Η ετικέτα ημερομηνίας που βλέπει ο χρήστης στη σύγκριση παρόχων ζει στον
// κατάλογο (lib/energy/catalogue.ts), ως σκέτη σταθερά. Η πηγή αλήθειας για το πότε ελέγχθηκαν πραγματικά
// οι τιμές ζει στο data/price-sources.json, που το διαβάζει το προγραμματισμένο
// workflow. Δύο σημεία, μία αλήθεια: αν αποκλίνουν, ο χρήστης βλέπει ημερομηνία
// που δεν αντιστοιχεί σε κανέναν έλεγχο.
//
// Ο συσχετισμός δεν γίνεται με import του JSON μέσα στο component επίτηδες: ένα
// σφάλμα interop σε module scope δεν χαλάει μία οθόνη, δεν αφήνει να φορτώσει
// ΟΛΗ η εφαρμογή. Η συνέπεια φυλάσσεται εδώ αντί να αγοραστεί με τέτοιο ρίσκο.

import { readFileSync } from 'node:fs';
import { TARIFFS_LABEL, TARIFFS_VERIFIED, TARIFFS_MAX_AGE_DAYS } from './catalogue';
import { GAS_VERIFIED, GAS_LABEL, GAS_MAX_AGE_DAYS } from './gas';
import { INSURANCE_VERIFIED, INSURANCE_MAX_AGE_DAYS } from '@/app/dashboard/components/insurance/catalog';
import { PRICE_FACTS, TELECOM_FACTS } from '@/lib/facts/prices';

let pass = 0, fail = 0;
function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; } else { fail++; console.error(`✗ ${name}\n   got  ${g}\n   want ${w}`); }
}
function ok(name: string, cond: boolean) {
  if (cond) { pass++; } else { fail++; console.error(`✗ ${name}`); }
}

const sources = JSON.parse(readFileSync('data/price-sources.json', 'utf8')) as {
  electricity: { label: string; checkedAt: string; maxAgeDays: number; sources: { name: string; url: string }[] };
  gas: { label: string; checkedAt: string; maxAgeDays: number; sources: { name: string; url: string }[] };
  insurance: { label: string; checkedAt: string; maxAgeDays: number; registryVerifiedAt: string | null };
  telecom: { providers: { name: string; url: string; checkedAt: string }[] };
};

// ΟΙ ΗΜΕΡΟΜΗΝΙΕΣ ΖΟΥΝ ΣΤΟΝ ΚΑΤΑΛΟΓΟ ΤΙΜΩΝ (lib/facts/prices.ts, 05.10.2026) ΚΑΙ ΟΙ
// ΣΤΑΘΕΡΕΣ ΤΟΥ lib/energy ΚΑΙ ΤΗΣ ΑΣΦΑΛΕΙΑΣ ΤΙΣ ΔΙΑΒΑΖΟΥΝ ΑΠΟ ΕΚΕΙ. Ο έλεγχος
// κοιτά τις ΤΙΜΕΣ που βλέπει ο χρήστης, όχι το κείμενο των αρχείων: η σταθερά
// δεν είναι πια γραμμένη ως συμβολοσειρά, άρα μια κανονική έκφραση δεν θα έβρισκε
// τίποτα και θα περνούσε για λάθος λόγο.
//
// Η ΔΕΥΤΕΡΗ ΗΜΕΡΟΜΗΝΙΑ, ΠΟΥ ΔΕΝ ΤΗΝ ΦΥΛΑΓΕ ΤΙΠΟΤΑ. Το `TARIFFS_VERIFIED` είχε μπει
// ως '2026-07-08' ενώ το `checkedAt` έλεγε '2026-07-29': απόκλιση είκοσι μιας
// ημερών, σιωπηλή, ενώ κρίνει αν η οθόνη ανακηρύσσει νικητή τιμολογίου.
eq('ρεύμα: η ετικέτα συμφωνεί με το data/price-sources.json', TARIFFS_LABEL, sources.electricity.label);
eq('ρεύμα: η ημερομηνία με το checkedAt', TARIFFS_VERIFIED, sources.electricity.checkedAt);
eq('ρεύμα: το κατώφλι με το maxAgeDays', TARIFFS_MAX_AGE_DAYS, sources.electricity.maxAgeDays);
eq('ασφάλεια: η ημερομηνία με το checkedAt', INSURANCE_VERIFIED, sources.insurance.checkedAt);
eq('ασφάλεια: το κατώφλι με το maxAgeDays', INSURANCE_MAX_AGE_DAYS, sources.insurance.maxAgeDays);
eq('ασφάλεια: η περίοδος με το label', PRICE_FACTS.insurance.period, sources.insurance.label);
eq('αέριο: η ημερομηνία με το checkedAt', GAS_VERIFIED, sources.gas.checkedAt);
eq('αέριο: η ετικέτα με το label', GAS_LABEL, sources.gas.label);
eq('αέριο: το κατώφλι με το maxAgeDays', GAS_MAX_AGE_DAYS, sources.gas.maxAgeDays);

// ΤΟ INTERNET ΕΛΕΓΧΕΤΑΙ ΑΝΑ ΠΑΡΟΧΟ: ίδιοι πάροχοι, ίδιες ημέρες, ίδιες σελίδες.
const telecom = sources.telecom.providers;
eq('internet: ίδιοι πάροχοι με ημερομηνία', Object.keys(TELECOM_FACTS).sort(), telecom.map(p => p.name.toLowerCase()).sort());
for (const p of telecom) {
  const f = TELECOM_FACTS[p.name.toLowerCase()];
  eq(`internet ${p.name}: ημερομηνία`, f?.checkedAt, p.checkedAt);
  eq(`internet ${p.name}: σελίδα`, f?.url, p.url);
}

// ΚΑΝΕΝΑ ΔΕΥΤΕΡΟ ΑΝΤΙΓΡΑΦΟ. Αν ένα αρχείο ξαναγράψει δική του ημερομηνία, ο
// έλεγχος από πάνω θα συνέχιζε να περνά ενώ η οθόνη θα έλεγε άλλη μέρα.
for (const f of ['lib/energy/catalogue.ts', 'lib/energy/gas.ts', 'app/dashboard/components/insurance/catalog.ts']) {
  ok(`${f}: δεν γράφει ημερομηνία με το χέρι`,
    !/export const (TARIFFS_VERIFIED|TARIFFS_LABEL|GAS_VERIFIED|GAS_LABEL|INSURANCE_VERIFIED) = '/.test(readFileSync(f, 'utf8')));
}
for (const f of ['app/dashboard/components/BillsElectricity.tsx', 'app/sygkrisi-timologion-revmatos/PowerCompare.tsx', 'lib/tools/revma.ts']) {
  const src = readFileSync(f, 'utf8');
  ok(`${f}: δεν γράφει δική του ημερομηνία καταλόγου`,
    !/const (TARIFFS_VERIFIED|TARIFFS_LABEL|TARIFFS_MAX_AGE_DAYS|LAST_UPDATED)\s*=/.test(src));
}

// Η ημερομηνία ελέγχου πρέπει να είναι πραγματική ημερομηνία, όχι κείμενο.
for (const key of ['electricity', 'gas', 'insurance'] as const) {
  const iso = sources[key].checkedAt;
  ok(`${key}: έγκυρη ημερομηνία ελέγχου`, /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(Date.parse(iso)));
  ok(`${key}: μη κενή ετικέτα`, sources[key].label.trim().length > 3);
}

ok('το ρεύμα έχει καταγεγραμμένες πηγές', sources.electricity.sources.length >= 3);
ok('το αέριο έχει καταγεγραμμένες πηγές', sources.gas.sources.length >= 1);
ok('κάθε πηγή έχει διεύθυνση',
  [...sources.electricity.sources, ...sources.gas.sources].every(s => /^https:\/\//.test(s.url)));

// Δεν δηλώνουμε επαλήθευση μητρώου που δεν έγινε. Όταν γίνει από άνθρωπο,
// μπαίνει ημερομηνία και αυτός ο έλεγχος τη δέχεται.
ok('η επαλήθευση μητρώου ασφαλιστικών είναι είτε κενή είτε πραγματική ημερομηνία',
  sources.insurance.registryVerifiedAt === null
  || /^\d{4}-\d{2}-\d{2}$/.test(sources.insurance.registryVerifiedAt));

console.log(fail === 0 ? `✓ label: ${pass} έλεγχοι πέρασαν` : `✗ label: ${fail} απέτυχαν από ${pass + fail}`);
if (fail > 0) process.exit(1);
