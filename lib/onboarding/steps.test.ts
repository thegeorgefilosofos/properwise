// npx tsx lib/onboarding/steps.test.ts
//
// Ο ΔΡΟΜΟΣ ΩΣ ΤΟΝ ΠΡΩΤΟ ΦΟΡΟ ΕΙΝΑΙ ΕΝΑΣ. Η υποδοχή και ο οδηγός διαβάζουν τον
// ίδιο πίνακα· εδώ κλειδώνουν ο αριθμός, η σειρά, η γραφή των ονομάτων και το
// ότι οι δύο οθόνες πράγματι τον εισάγουν αντί να γράφουν δικά τους ονόματα.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ONBOARDING_STEPS, PRIMARY_TYPES, MORE_TYPES, PRIMARY_STATUSES, MORE_STATUSES,
  typeNeedsMore, statusNeedsMore, defaultPropertyName,
} from './steps';
import { PROPERTY_TYPES } from '@/lib/property/types';
import { STATUSES } from '@/lib/property/status';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n); } };

ok('τρία βήματα', ONBOARDING_STEPS.length === 3);
ok('η σειρά: τύπος, μίσθωμα, φόρος', ONBOARDING_STEPS.map(s => s.id).join() === 'type,rent,tax');
ok('ο φόρος είναι ο προορισμός, το τελευταίο βήμα', ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1].id === 'tax');
const labels = ONBOARDING_STEPS.map(s => s.label);
ok('μοναδικά ονόματα', new Set(labels).size === labels.length);
ok('ονοματικές φράσεις ως τρεις λέξεις', labels.every(l => l.split(/\s+/).length <= 3));
ok('πρώτο γράμμα κεφαλαίο, τα υπόλοιπα όχι (sentence case)', labels.every(l => /^\p{Lu}/u.test(l) && !/\s\p{Lu}/u.test(l)));
ok('χωρίς τελεία, κόμμα ή παύλα', labels.every(l => !/[.,—–]/.test(l)));
ok('κανένας αριθμός στα ονόματα', labels.every(l => !/\d/.test(l)));

ok('έξι τύποι πρώτοι', PRIMARY_TYPES.length === 6);
ok('τέσσερις καταστάσεις πρώτες', PRIMARY_STATUSES.length === 4);
ok('κάθε τύπος υπάρχει ακριβώς μία φορά', [...PRIMARY_TYPES, ...MORE_TYPES].sort().join() === [...PROPERTY_TYPES].sort().join());
ok('κάθε κατάσταση υπάρχει ακριβώς μία φορά', [...PRIMARY_STATUSES, ...MORE_STATUSES].sort().join() === STATUSES.map(s => s.key).sort().join());
ok('η μακροχρόνια μίσθωση είναι η πρώτη κατάσταση', PRIMARY_STATUSES[0] === 'rent_long');
ok('το διαμέρισμα είναι ο πρώτος τύπος', PRIMARY_TYPES[0] === 'apartment');
ok('οικόπεδο: ανοίγει η λίστα των υπολοίπων', typeNeedsMore('land'));
ok('διαμέρισμα: η λίστα μένει κλειστή', !typeNeedsMore('apartment') && !typeNeedsMore(null));
ok('ανακαίνιση: ανοίγει η λίστα των υπολοίπων', statusNeedsMore('renovation'));
ok('κενό: η λίστα μένει κλειστή', !statusNeedsMore('vacant') && !statusNeedsMore(null));

ok('όνομα: η διεύθυνση όταν υπάρχει', defaultPropertyName('Διαμέρισμα', ' Σόλωνος 12 ') === 'Σόλωνος 12');
ok('όνομα: ο τύπος χωρίς διεύθυνση', defaultPropertyName('Διαμέρισμα', '') === 'Διαμέρισμα' && defaultPropertyName('Μονοκατοικία') === 'Μονοκατοικία');

// ΟΙ ΔΥΟ ΟΘΟΝΕΣ ΔΙΑΒΑΖΟΥΝ ΤΟΝ ΠΙΝΑΚΑ. Αν κάποια ξαναγράψει τα ονόματα με το
// χέρι, τα δύο θα αποκλίνουν την πρώτη φορά που αλλάξει το ένα.
const root = process.cwd();
const welcome = readFileSync(join(root, 'app/dashboard/components/WelcomeOnboarding.tsx'), 'utf8');
const wizard = readFileSync(join(root, 'app/dashboard/components/AddPropertyWizard.tsx'), 'utf8');
ok('η υποδοχή εισάγει τα βήματα', /ONBOARDING_STEPS/.test(welcome));
ok('ο οδηγός εισάγει τα βήματα', /ONBOARDING_STEPS/.test(wizard));
for (const l of labels) {
  ok(`η υποδοχή δεν γράφει με το χέρι «${l}»`, !welcome.includes(`'${l}'`));
  ok(`ο οδηγός δεν γράφει με το χέρι «${l}»`, !wizard.includes(`'${l}'`));
}

console.log(`${pass} πέρασαν, ${fail} απέτυχαν`);
if (fail) process.exit(1);
