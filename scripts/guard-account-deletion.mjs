#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Η ΔΙΑΓΡΑΦΗ ΛΟΓΑΡΙΑΣΜΟΥ ΠΕΡΝΑΕΙ ΠΑΝΤΑ ΑΠΟ ΤΗΝ ΑΚΥΡΩΣΗ ΤΗΣ ΣΥΝΔΡΟΜΗΣ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΣΦΑΛΜΑ, ΟΠΩΣ ΗΤΑΝ. Η οθόνη του Λογαριασμού καλούσε κατευθείαν τη
// `delete_my_account`. Η συνάρτηση σβήνει κάθε γραμμή του χρήστη και τον ίδιο
// τον χρήστη — μαζί και το προφίλ χρέωσης, δηλαδή το ΜΟΝΟ σημείο όπου ζει το
// αναγνωριστικό της συνδρομής στον έμπορο.
//
// Αποτέλεσμα: ο λογαριασμός εξαφανιζόταν και η κάρτα συνέχιζε να χρεώνεται
// κάθε μήνα, χωρίς λογαριασμό απέναντι, χωρίς κουμπί ακύρωσης και χωρίς
// κανένα ίχνος στη βάση για να το βρει κανείς. Χρήματα από άνθρωπο που έφυγε
// είναι το χειρότερο σφάλμα που μπορεί να έχει μια συνδρομή.
//
// ── ΔΥΟ ΚΑΝΟΝΕΣ ─────────────────────────────────────────────────────────
//   1. Το `delete_my_account` καλείται ΜΟΝΟ από τη μία διαδρομή. Καθε άλλος
//      καλών παρακάμπτει την ακύρωση, εξ ορισμού.
//   2. Η διαδρομή αυτή ακυρώνει τη συνδρομή. Χωρίς τη γραμμή της ακύρωσης,
//      είναι απλώς ένα πιο μακρύ μονοπάτι προς το ίδιο σφάλμα.
//
// ΤΟ SQL ΕΞΑΙΡΕΙΤΑΙ: εκεί ΟΡΙΖΕΤΑΙ η συνάρτηση, δεν καλείται από πελάτη.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync } from 'node:fs';
import { projectFiles } from './lib/git-files.mjs';

const RPC = 'delete_my_account';
const ROUTE = 'app/api/account/delete/route.ts';
const MIGDIR = 'supabase/migrations';
// Η ΑΚΥΡΩΣΗ ΜΕΤΑ ΤΗ ΘΥΡΑ ΤΟΥ ΕΜΠΟΡΟΥ. Λεγόταν «cancelSubscription» όσο η
// διαδρομή μιλούσε κατευθείαν στον πάροχο. Τώρα λέγεται «mor.cancel(» και ο
// φύλακας δέχεται και τα δύο: το παλιό μένει δεκτό γιατί εξακολουθεί να
// ακυρώνει, όχι για συμβατότητα χάριν συμβατότητας.
const CANCEL = /\bcancelSubscription\b|\.cancel\(/;

const problems = [];

for (const file of projectFiles("'app/**/*.ts' 'app/**/*.tsx' 'lib/**/*.ts' 'lib/**/*.tsx'")) {
  if (file === ROUTE) continue;
  // Τα τεστ ΔΙΑΒΑΖΟΥΝ την πηγή, δεν καλούν το RPC: το deleteRoute.test.ts
  // αναφέρει το όνομα σε συμβολοσειρές ελέγχου, όχι σε μονοπάτι εκτέλεσης.
  if (/\.test\.tsx?$/.test(file)) continue;
  const src = readFileSync(file, 'utf8');
  let inBlock = false;
  src.split('\n').forEach((line, i) => {
    // Το σχόλιο επιτρέπεται να ΑΝΑΦΕΡΕΙ τη συνάρτηση· ο κώδικας όχι.
    let code = line;
    const open = line.indexOf('/*');
    const close = line.indexOf('*/');
    if (inBlock) {
      if (close >= 0) { code = line.slice(close + 2); inBlock = false; } else { code = ''; }
    } else if (open >= 0) {
      if (close > open) code = line.slice(0, open) + line.slice(close + 2);
      else { code = line.slice(0, open); inBlock = true; }
    }
    code = code.replace(/\/\/.*$/, '');
    if (code.includes(RPC)) {
      problems.push(`${file}:${i + 1}: καλεί το ${RPC} έξω από το ${ROUTE}. Η συνδρομή θα έμενε ζωντανή και η κάρτα θα χρεωνόταν για πάντα.`);
    }
  });
}

let route = '';
try { route = readFileSync(ROUTE, 'utf8'); } catch {
  problems.push(`${ROUTE}: λείπει. Η διαγραφή λογαριασμού δεν έχει πια πού να ακυρώσει τη συνδρομή.`);
}
if (route && !route.match(CANCEL)) {
  problems.push(`${ROUTE}: δεν ακυρώνει τη συνδρομή (${CANCEL}). Η κάρτα θα χρεώνεται μετά τη διαγραφή.`);
}
if (route && !route.includes(RPC)) {
  problems.push(`${ROUTE}: δεν διαγράφει τον λογαριασμό (${RPC}). Ο έλεγχος θα ήταν κενός.`);
}

// ═══════════════════════════════════════════════════════════════════════════
// ΚΑΙ Η ΔΙΑΓΡΑΦΗ ΘΕΛΕΙ ΔΕΥΤΕΡΟ ΠΑΡΑΓΟΝΤΑ, ΣΕ ΔΥΟ ΕΠΙΠΕΔΑ
// ─────────────────────────────────────────────────────────────────────────
// Ο διαμεσολαβητής εξαιρεί ΟΛΟ το /api/**, οπότε μια συνεδρία «aal1» με
// δηλωμένη συσκευή φτάνει στη διαγραφή χωρίς τον δεύτερο παράγοντα. Δύο πόρτες
// την κλείνουν και καμία δεν επιτρέπεται να λείψει σιωπηλά:
//
//   · η ΒΑΣΗ — η τελευταία `delete_my_account` σηκώνει 42501 όταν το «aal»
//     δεν είναι «aal2» ενώ υπάρχει επαληθευμένος παράγοντας. Ισχύει όποιος
//     κι αν καλέσει τη συνάρτηση, ακόμη κι αν παρακαμφθεί το route·
//   · το ROUTE — κόβει με 403 ΠΡΙΝ την κλήση, ώστε να μην ακυρωθεί συνδρομή
//     ούτε να σβηστεί αρχείο για μια συνεδρία που θα απορριπτόταν έτσι κι
//     αλλιώς.
// ═══════════════════════════════════════════════════════════════════════════

// Η βάση: ποια μετανάστευση ορίζει ΤΕΛΕΥΤΑΙΑ την `delete_my_account`; Εκείνη
// είναι που ισχύει, οπότε εκεί ζητιέται η πύλη.
const defining = readdirSync(MIGDIR)
  .filter(f => f.endsWith('.sql'))
  .filter(f => readFileSync(`${MIGDIR}/${f}`, 'utf8')
    .includes(`create or replace function public.${RPC}`))
  .sort();
const lastMig = defining[defining.length - 1];
if (!lastMig) {
  problems.push(`${MIGDIR}: καμία μετανάστευση δεν ορίζει την ${RPC}. Δεν υπάρχει πύλη 2FA στη βάση.`);
} else {
  const mig = readFileSync(`${MIGDIR}/${lastMig}`, 'utf8');
  const hasAal     = /is distinct from 'aal2'/.test(mig);
  const hasFactors = /auth\.mfa_factors/.test(mig) && /status\s*=\s*'verified'/.test(mig);
  const hasCode    = /42501/.test(mig);
  if (!(hasAal && hasFactors && hasCode)) {
    problems.push(`${MIGDIR}/${lastMig}: η τελευταία ${RPC} δεν έχει την πύλη 2FA (aal2 + auth.mfa_factors status='verified' που σηκώνει 42501). Μια συνεδρία aal1 θα έσβηνε λογαριασμό κατευθείαν από τη βάση.`);
  }
}

// Το route: κόβει με 403 μέσω sessionNeedsSecondStep ΠΡΙΝ φτάσει στην κλήση.
// Το `RPC` σκέτο εμφανίζεται ΚΑΙ στο σχόλιο κεφαλής, οπότε η θέση μετριέται
// από την ΚΛΗΣΗ `rpc('…')`, όχι από την πρώτη αναφορά του ονόματος.
if (route) {
  const iGate = route.indexOf('sessionNeedsSecondStep(');
  const iRpc  = route.indexOf(`rpc('${RPC}')`);
  const gates403First = iGate >= 0 && iRpc >= 0 && iGate < iRpc
    && /403/.test(route.slice(iGate, iRpc));
  if (!gates403First) {
    problems.push(`${ROUTE}: δεν κόβει με 403 μέσω sessionNeedsSecondStep ΠΡΙΝ την ${RPC}. Μια συνεδρία aal1 με δηλωμένη συσκευή θα διέγραφε λογαριασμό.`);
  }
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} διαδρομές διαγραφής χωρίς ακύρωση συνδρομής:\n`);
  problems.forEach(p => console.error('  ' + p));
  process.exit(1);
}
console.log(`✓ διαγραφή λογαριασμού: μία διαδρομή και ακυρώνει πρώτα τη συνδρομή`);
