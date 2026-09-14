// npx tsx lib/auth/password.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΚΑΝΟΝΕΣ ΤΟΥ ΚΩΔΙΚΟΥ, ΕΛΕΓΜΕΝΟΙ
//
// ΤΡΕΙΣ ΟΘΟΝΕΣ ΔΙΑΒΑΖΟΥΝ ΤΟ ΙΔΙΟ ΑΠΟΤΕΛΕΣΜΑ: εγγραφή, επαναφορά κωδικού και
// αλλαγή από τις Ρυθμίσεις. Το `ok` κρίνει αν φεύγει το αίτημα, το `checks`
// ζωγραφίζει τη λίστα προϋποθέσεων και το `score` τη μπάρα δύναμης. Μια χαλαρή
// συνθήκη εδώ δεν φαίνεται πουθενά: ο χρήστης απλώς περνά με κωδικό που δεν θα
// έπρεπε — ή, χειρότερα, κόβεται με κωδικό που έπρεπε να περάσει και δεν
// καταλαβαίνει γιατί, γιατί η λίστα του δείχνει όλα πράσινα.
// ═══════════════════════════════════════════════════════════════════════════
import { checkPassword, PASSWORD_MIN_LENGTH, PASSWORD_MIN_LABEL, PASSWORD_MSG } from './password';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean) => { if (cond) { pass++ } else { fail++; console.error('✗ ' + name) } };
const eq = (name: string, got: unknown, want: unknown) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++ } else { fail++; console.error(`✗ ${name}\n   got  ${g}\n   want ${w}`) }
};
const keys = (pw: string) => checkPassword(pw).checks.filter(c => !c.ok).map(c => c.key);

// ── ΤΟ ΚΑΤΩΦΛΙ ΕΙΝΑΙ ΑΥΤΟ ΠΟΥ ΛΕΕΙ Η ΟΘΟΝΗ ───────────────────────────────
// Η ετικέτα παράγεται από τον αριθμό. Αν κάποιος αλλάξει τον έναν και ξεχάσει
// τον άλλο, ο χρήστης διαβάζει «τουλάχιστον 10» και απορρίπτεται στα 10.
ok('η ετικέτα περιέχει το πραγματικό ελάχιστο', PASSWORD_MIN_LABEL.includes(String(PASSWORD_MIN_LENGTH)));
ok('το ελάχιστο είναι τουλάχιστον 8', PASSWORD_MIN_LENGTH >= 8);

// ── ΚΑΘΕ ΠΡΟΫΠΟΘΕΣΗ ΚΟΒΕΙ ΜΟΝΗ ΤΗΣ ──────────────────────────────────────
// Ο ελεγχος γράφεται ΑΝΑ ΚΑΝΟΝΑ: αλλιώς ένα «όλα μαζί» θα έμενε πράσινο ακόμη
// κι αν δύο κανόνες είχαν συγχωνευτεί κατά λάθος σε έναν.
eq('χωρίς μήκος', keys('Aa1!aaa'), ['len']);
eq('χωρίς πεζό', keys('AAAA1111!A'), ['lower']);
eq('χωρίς κεφαλαίο', keys('aaaa1111!a'), ['upper']);
eq('χωρίς αριθμό', keys('AaaaAAaa!a'), ['digit']);
eq('χωρίς σύμβολο', keys('Aaaa1111aa'), ['symbol']);
eq('κωδικός που τα έχει όλα', keys('Xk9!perito'), []);

// ── ΤΟ `ok` ΕΙΝΑΙ Η ΠΥΛΗ, ΚΑΙ ΘΕΛΕΙ ΟΛΑ ΤΑ ΠΕΝΤΕ ────────────────────────
ok('πλήρης κωδικός περνά', checkPassword('Xk9!perito').ok);
// «Xk9peritos»: δέκα χαρακτήρες, κεφαλαίο, πεζό, αριθμός — λείπει ΜΟΝΟ το
// σύμβολο. Τέσσερα στα πέντε — δεν περνά: η πύλη θέλει και τα πέντε.
ok('τέσσερα στα πέντε ΔΕΝ περνά', !checkPassword('Xk9peritos').ok);
eq('το score μετρά πόσα πληρούνται', checkPassword('Xk9peritos').score, 4);
eq('κενός κωδικός: μηδέν', checkPassword('').score, 0);

// ── ΟΙ ΠΡΟΦΑΝΕΙΣ ΚΟΒΟΝΤΑΙ ΑΚΟΜΗ ΚΙ ΑΝ ΠΕΡΝΟΥΝ ΤΟΥΣ ΚΑΝΟΝΕΣ ──────────────
// Ενας κωδικός της λίστας που κατά τύχη πληροί τα πέντε δεν πρέπει να περνά:
// η λίστα υπάρχει γιατί οι κανόνες μορφής δεν βλέπουν το προφανές.
{
  const r = checkPassword('password123');
  ok('«password123» σημειώνεται ως προφανής', r.common);
  ok('και ΔΕΝ περνά', !r.ok);
}
ok('η αναγνώριση δεν κοιτά πεζά-κεφαλαία', checkPassword('PassWord123').common);
ok('κωδικός εκτός λίστας δεν σημειώνεται', !checkPassword('Xk9!perito').common);

// ── ΚΑΙ ΤΑ ΔΥΟ ΜΗΝΥΜΑΤΑ ΥΠΑΡΧΟΥΝ ΣΕ ΕΝΑ ΣΗΜΕΙΟ ─────────────────────────
ok('μήνυμα διαρροής', PASSWORD_MSG.leaked.length > 20);
ok('μήνυμα αδυναμίας', PASSWORD_MSG.weak.length > 20);
ok('η διαρροή λέει «διαρροή»', PASSWORD_MSG.leaked.includes('διαρροή'));
ok('η αδυναμία λέει «προϋποθέσεις»', PASSWORD_MSG.weak.includes('προϋποθέσεις'));

// ── ΤΟ ΜΗΚΟΣ ΜΕΤΡΙΕΤΑΙ ΣΤΟ ΟΡΙΟ, ΟΧΙ ΓΥΡΩ ΑΠΟ ΑΥΤΟ ─────────────────────
{
  const at = 'Aa1!' + 'x'.repeat(PASSWORD_MIN_LENGTH - 4);
  const under = 'Aa1!' + 'x'.repeat(PASSWORD_MIN_LENGTH - 5);
  eq('ακριβώς στο όριο: περνά', at.length, PASSWORD_MIN_LENGTH);
  ok('ακριβώς στο όριο πληροί το μήκος', checkPassword(at).checks.find(c => c.key === 'len')?.ok === true);
  ok('έναν λιγότερο: δεν πληροί', checkPassword(under).checks.find(c => c.key === 'len')?.ok === false);
}

// ── ΚΑΘΕ ΠΡΟΫΠΟΘΕΣΗ ΕΧΕΙ ΛΕΚΤΙΚΟ ΠΟΥ ΔΙΑΒΑΖΕΤΑΙ ────────────────────────
// Η λίστα εμφανίζεται αυτούσια στην οθόνη· ένα κενό label είναι κενή γραμμή.
for (const c of checkPassword('').checks) ok(`«${c.key}» έχει λεκτικό`, c.label.trim().length > 3);

console.log(fail === 0 ? `✓ password: ${pass} έλεγχοι πέρασαν` : `✗ password: ${fail} απέτυχαν από ${pass + fail}`);
if (fail > 0) process.exit(1);
