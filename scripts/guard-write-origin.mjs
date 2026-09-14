#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΚΑΘΕ ΔΙΑΔΡΟΜΗ ΠΟΥ ΓΡΑΦΕΙ ΜΕ ΣΥΝΕΔΡΙΑ ΡΩΤΑ ΚΑΙ ΑΠΟ ΠΟΥ ΗΡΘΕ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΣΦΑΛΜΑ, ΜΕΤΡΗΜΕΝΟ. `grep -ril csrf` σε ολόκληρο το αποθετήριο: ΜΗΔΕΝ
// αρχεία. Και η χειρότερη διαδρομή το έλεγε δομικά:
//
//     app/api/account/delete/route.ts    export async function POST() {
//
// Χωρίς παράμετρο αιτήματος, ο έλεγχος προέλευσης δεν ήταν ξεχασμένος —
// ήταν ΑΔΥΝΑΤΟΣ. Η διαδρομή ακυρώνει τη συνδρομή, σβήνει τα αρχεία και
// διαγράφει τον χρήστη. Δεν ζητά σώμα, δεν ζητά επικεφαλίδα, δεν ζητά
// τίποτα: μια ξένη σελίδα με `<form method="post">` προς αυτή τη διεύθυνση
// είναι ολόκληρη η επίθεση.
//
// ── ΔΥΟ ΚΑΝΟΝΕΣ, ΚΑΙ ΟΙ ΔΥΟ ΑΠΟ ΠΡΑΓΜΑΤΙΚΟ ΚΟΣΤΟΣ ──────────────────────
//
// 1. ΟΠΟΙΑ ΓΡΑΦΕΙ ΜΕ ΣΥΝΕΔΡΙΑ, ΕΛΕΓΧΕΙ ΠΡΟΕΛΕΥΣΗ. «Γράφει» σημαίνει ότι
//    εξάγει POST, PUT, PATCH ή DELETE. «Με συνεδρία» σημαίνει ότι κρίνει τον
//    καλούντα από το cookie (`auth.getUser`), δηλαδή από κάτι που ο περιηγητής
//    στέλνει ΜΟΝΟΣ ΤΟΥ, χωρίς να το ζητήσει η σελίδα που το προκάλεσε.
//
// 2. ΟΠΟΙΑ ΚΡΙΝΕΤΑΙ ΑΠΟ ΥΠΟΓΡΑΦΗ Η ΜΥΣΤΙΚΟ, ΔΕΝ ΕΛΕΓΧΕΙ ΠΡΟΕΛΕΥΣΗ. Το
//    webhook του εμπόρου και το εισερχόμενο ταχυδρομείο έρχονται από ΑΛΛΟΝ
//    διακομιστή: δεν υπάρχει περιηγητής, δεν υπάρχει `Origin`. Ενας έλεγχος
//    εκεί θα απέρριπτε κάθε γνήσια πληρωμή — ακριβώς το σφάλμα που περιγράφει
//    το proxy.ts όταν εξηγεί γιατί το /api/** μένει έξω από τον διαμεσολαβητή.
//    Ο κανόνας γράφεται ανάποδα επίτηδες, ώστε ο επόμενος που θα «σφίξει την
//    ασφάλεια παντού» να το μάθει εδώ και όχι από τον πίνακα της Lemon Squeezy.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, globSync } from 'node:fs';

const HELPER = 'lib/api/origin.ts';
const GUARD = 'scripts/guard-write-origin.mjs';
const CHECK = 'sameOrigin(';

/** Οι μέθοδοι που αλλάζουν κατάσταση. Το GET δεν γράφει και δεν κρίνεται εδώ. */
const WRITERS = /export\s+(?:async\s+)?function\s+(POST|PUT|PATCH|DELETE)\s*\(([^)]*)\)/g;

/** Κρίνεται από cookie, δηλαδή από κάτι που ο περιηγητής στέλνει μόνος του. */
const BY_SESSION = /auth\.getUser\(/;

/** Κρίνεται από απόδειξη που ταξιδεύει ΜΕΣΑ στο αίτημα, όχι από cookie. */
const BY_PROOF = [
  { re: /verifySignature\(/, what: 'υπογραφή του αποστολέα' },
  { re: /\.verifyWebhook\(/, what: 'υπογραφή του εμπόρου' },
  { re: /cronSecretOk\(/, what: 'μυστικό χρονοδιαγράμματος' },
];

const problems = [];

// ── ΤΟ ΙΔΙΟ ΤΟ ΕΡΓΑΛΕΙΟ ΠΡΕΠΕΙ ΝΑ ΥΠΑΡΧΕΙ ────────────────────────────────
let helper = '';
try { helper = readFileSync(HELPER, 'utf8'); } catch {
  problems.push(`${HELPER}: λείπει. Χωρίς κοινό βοηθό, κάθε διαδρομή θα γράψει δικό της έλεγχο και θα αποκλίνουν.`);
}
if (helper && !helper.includes('export function sameOrigin')) {
  problems.push(`${HELPER}: δεν εξάγει την «sameOrigin». Οι διαδρομές καλούν κάτι που δεν υπάρχει.`);
}

// ══════════════════════════════════════════════════════════════════════════
// ΚΑΘΕ ΚΑΤΑΛΗΞΗ, ΚΑΙ ΤΟ ΠΛΗΘΟΣ ΕΠΑΛΗΘΕΥΕΤΑΙ
//
// Ιδιος έλεγχος με τον guard-api-auth και για τον ίδιο λόγο: εκεί μετρήθηκε
// ότι το πρότυπο `route.ts` άφηνε έξω ένα `route.tsx` — τη διαδρομή που κρατά
// το κλειδί του παρόχου AI. Ενας φύλακας που μετρά λάθος πλήθος δεν είναι
// φύλακας, είναι καθησυχασμός.
const routes = globSync('app/api/**/route.{ts,tsx,js,mjs}').sort();
const everyRouteFile = globSync('app/api/**/route.*').sort();
if (routes.length !== everyRouteFile.length) {
  const missed = everyRouteFile.filter(f => !routes.includes(f));
  console.error('✗ ΔΙΑΔΡΟΜΕΣ ΕΚΤΟΣ ΕΛΕΓΧΟΥ');
  console.error(`  Ο φύλακας βλέπει ${routes.length} από ${everyRouteFile.length} αρχεία διαδρομής.`);
  for (const f of missed) console.error(`  · ${f}`);
  console.error('  Πρόσθεσε την κατάληξη στο glob παραπάνω.');
  process.exit(1);
}
if (!routes.length) problems.push('δεν βρέθηκε καμία διαδρομή κάτω από app/api — ο έλεγχος δεν κοιτά τίποτα.');

let guarded = 0, exempt = 0;

for (const file of routes) {
  const src = readFileSync(file, 'utf8');
  const writers = [...src.matchAll(WRITERS)];
  if (!writers.length) continue;

  const methods = writers.map(m => m[1]).join(', ');
  const proof = BY_PROOF.find(p => p.re.test(src));
  const checks = src.includes(CHECK);

  if (proof) {
    exempt++;
    // Ο ΑΝΑΠΟΔΟΣ ΚΑΝΟΝΑΣ. Το webhook δεν έχει περιηγητή απέναντι: ένας
    // έλεγχος προέλευσης εδώ σημαίνει 403 σε κάθε γνήσιο γεγονός.
    if (checks) {
      problems.push(`${file}: κρίνεται από ${proof.what} και ΠΑΡΟΛΑ ΑΥΤΑ ελέγχει προέλευση. Καμία γνήσια κλήση τρίτου δεν στέλνει «Origin»: η διαδρομή θα απαντά 403 σε κάθε πραγματικό γεγονός.`);
    }
    continue;
  }

  if (!BY_SESSION.test(src)) {
    // Ταυτότητα δεν ζητά καθόλου. Το λέει ο guard-api-auth, δεν το
    // ξαναλέμε εδώ: δύο φύλακες για το ίδιο εύρημα βγάζουν διπλό θόρυβο.
    continue;
  }

  if (!checks) {
    const bare = writers.filter(m => !m[2].trim()).map(m => m[1]);
    const extra = bare.length
      ? ` Η ${bare.join(' και η ')} δηλώνεται ΧΩΡΙΣ παράμετρο αιτήματος, οπότε ο έλεγχος δεν είναι ξεχασμένος: είναι αδύνατος.`
      : '';
    problems.push(`${file}: γράφει (${methods}) με συνεδρία και δεν ελέγχει προέλευση.${extra}`);
    continue;
  }
  guarded++;
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} διαδρομές που γράφουν χωρίς σωστό έλεγχο προέλευσης:\n`);
  problems.forEach(p => console.error('  ' + p));
  console.error(`
  Η συνεδρία ζει σε cookie: ο περιηγητής το στέλνει ΜΟΝΟΣ ΤΟΥ, ακόμη κι όταν
  το αίτημα το προκάλεσε ξένη σελίδα. Γι' αυτό η διαδρομή ρωτά και ΑΠΟ ΠΟΥ:

      import { sameOrigin, ORIGIN_DENIED } from '@/lib/api/origin';
      if (!sameOrigin(request.headers)) {
        return NextResponse.json({ error: ORIGIN_DENIED }, { status: 403 });
      }

  Τα webhook και οι προγραμματισμένες εργασίες ΔΕΝ το κάνουν αυτό: κρίνονται
  από υπογραφή ή από κοινό μυστικό και δεν έχουν περιηγητή απέναντι.
  (Ο ίδιος ο φύλακας: ${GUARD})`);
  process.exit(1);
}
console.log(`✓ προέλευση: ${guarded} διαδρομές που γράφουν με συνεδρία την ελέγχουν, ${exempt} κρίνονται από υπογραφή ή μυστικό`);
