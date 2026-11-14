// npx tsx lib/home/start.test.ts
//
// Ο πίνακας υποδοχής είναι το πρώτο πράγμα που βλέπει ο νέος χρήστης και το
// πρώτο που πρέπει να ΦΥΓΕΙ όταν τελειώσει η δουλειά του. Εδώ κλειδώνουν και τα
// δύο: τι δείχνει και πότε παύει να δείχνεται.
import { startSteps, startPanel, daysLabel, stepsLabel } from './start';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n); } };

const sig = (o: Partial<{ properties: number; documents: number; calendarLinked: boolean }> = {}) =>
  ({ properties: 0, documents: 0, calendarLinked: false, ...o });

// ── ΤΑ ΒΗΜΑΤΑ ─────────────────────────────────────────────────────────────
{
  const s = startSteps(sig());
  ok('τέσσερα βήματα', s.length === 4);
  ok('μοναδικά κλειδιά', new Set(s.map(x => x.key)).size === 4);
  ok('κανένα δεν είναι έτοιμο σε άδειο λογαριασμό', s.every(x => !x.done));
  ok('η σειρά είναι ακίνητο, βασικά, παραστατικό, προθεσμίες',
     s.map(x => x.key).join(',') === 'property,basics,document,deadlines');
  ok('κάθε βήμα έχει δικό του ρήμα, όχι «Άνοιγμα»', s.every(x => x.cta && x.cta !== 'Άνοιγμα') && new Set(s.map(x => x.cta)).size === s.length);
  ok('η σάρωση λέγεται «Σάρωση», η σύνδεση «Σύνδεση»', s.find(x => x.key === 'document')?.cta === 'Σάρωση' && s.find(x => x.key === 'deadlines')?.cta === 'Σύνδεση');
  ok('«Ημερολόγιο» με κεφαλαίο και χωρίς «μόνες τους»', s.every(x => !/ημερολόγιο|μόνες τους|μόνη της/.test(x.hint)));
  ok('τα βασικά χωρίς ακίνητο δεν έχουν κουμπί', s.find(x => x.key === 'basics')?.blocked === true);
  ok('κανένας τίτλος σε προστακτική',
     s.every(x => !/^(Πρόσθεσε|Δες|Κάνε|Σάρωσε|Άνοιξε|Συμπλήρωσε)/.test(x.title)));
  ok('καμία τελεία στο τέλος του τίτλου', s.every(x => !x.title.endsWith('.')));
  ok('κάθε υπόδειξη τελειώνει με τελεία', s.every(x => x.hint.endsWith('.')));
  ok('κάθε βήμα οδηγεί κάπου', s.every(x => x.nav.length > 0));
}

// ── ΤΑ ΣΗΜΑΤΑ ΟΡΙΖΟΥΝ ΤΟ «ΕΓΙΝΕ» ─────────────────────────────────────────
ok('ένα ακίνητο κλείνει το πρώτο βήμα',
   startSteps(sig({ properties: 1 })).find(s => s.key === 'property')?.done === true);
ok('ένα παραστατικό κλείνει το δεύτερο',
   startSteps(sig({ documents: 1 })).find(s => s.key === 'document')?.done === true);
ok('ημερολόγιο που διάβασε τη συνδρομή κλείνει το τρίτο',
   startSteps(sig({ calendarLinked: true })).find(s => s.key === 'deadlines')?.done === true);
// Οι προθεσμίες γράφονται μόνες τους με το πρώτο ακίνητο: το ακίνητο ΔΕΝ
// κλείνει το βήμα του κινητού, που θέλει ένα πάτημα του χρήστη.
ok('το ακίνητο ΔΕΝ κλείνει το βήμα του κινητού',
   startSteps(sig({ properties: 1 })).find(s => s.key === 'deadlines')?.done === false);
ok('το ακίνητο ΔΕΝ κλείνει τα βασικά του',
   startSteps(sig({ properties: 1 })).find(s => s.key === 'basics')?.done === false);
ok('διεύθυνση και εμβαδόν κλείνουν τα βασικά',
   startSteps({ ...sig({ properties: 1 }), basicsDone: true }).find(s => s.key === 'basics')?.done === true);
ok('με ακίνητο, τα βασικά έχουν κουμπί',
   startSteps(sig({ properties: 1 })).find(s => s.key === 'basics')?.blocked === false);
ok('χωρίς ακίνητο, τα βασικά δεν κλείνουν ούτε με σήμα',
   startSteps({ ...sig(), basicsDone: true }).find(s => s.key === 'basics')?.done === false);
ok('το ακίνητο ΔΕΝ κλείνει το παραστατικό',
   startSteps(sig({ properties: 5 })).find(s => s.key === 'document')?.done === false);

// ── ΠΟΤΕ ΦΑΙΝΕΤΑΙ ─────────────────────────────────────────────────────────
{
  const on = startPanel({ ...sig({ properties: 1 }), trialActive: true, daysLeft: 24 });
  ok('σε δοκιμή με ανοιχτά βήματα, φαίνεται', on.visible);
  ok('μετρά τα ανοιχτά', on.open === 3);
  ok('με ακίνητο, το παράδειγμα δεν χρειάζεται', on.hasProperty);
  ok('χωρίς ακίνητο, το παράδειγμα μένει', !startPanel({ ...sig(), trialActive: true, daysLeft: 24 }).hasProperty);
  ok('κρατά τις ημέρες', on.daysLeft === 24);

  const done = startPanel({ properties: 1, documents: 1, calendarLinked: true, basicsDone: true, trialActive: true, daysLeft: 24 });
  ok('με όλα κλειστά, φεύγει', !done.visible);
  ok('και δεν μένει τίποτα ανοιχτό', done.open === 0);

  const expired = startPanel({ ...sig(), trialActive: false, daysLeft: 0 });
  ok('χωρίς δοκιμή, δεν φαίνεται ούτε με ανοιχτά βήματα', !expired.visible);

  const negative = startPanel({ ...sig(), trialActive: true, daysLeft: -3 });
  ok('ημέρες ποτέ αρνητικές', negative.daysLeft === 0);
}

// ── ΤΑ ΛΕΚΤΙΚΑ ────────────────────────────────────────────────────────────
ok('πληθυντικός ημερών', daysLabel(24) === '24 ημέρες');
ok('ενικός ημέρας', daysLabel(1) === '1 ημέρα');
ok('μηδέν στον πληθυντικό', daysLabel(0) === '0 ημέρες');
ok('πληθυντικός βημάτων', stepsLabel(2) === '2 βήματα ακόμη');
ok('ενικός βήματος', stepsLabel(1) === '1 βήμα ακόμη');

console.log(`${pass} πέρασαν, ${fail} απέτυχαν`);
if (fail) process.exit(1);
