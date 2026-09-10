#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Η ΣΥΝΑΙΝΕΣΗ ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΓΙΝΕΙ «ΝΑΙ» ΑΠΟ ΑΠΟΤΥΧΙΑ ΑΝΑΓΝΩΣΗΣ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΣΦΑΛΜΑ, ΔΥΟ ΦΟΡΕΣ, ΣΕ ΔΥΟ ΑΠΟΣΤΟΛΕΙΣ. Το ενημερωτικό δελτίο και η
// εβδομαδιαία ενημέρωση επιτοκίων διάβαζαν τον ίδιο πίνακα προτιμήσεων
// αγνοώντας το `error`:
//
//     const { data: prefs } = await supabase.from('email_marketing_prefs')…
//     const prefMap = new Map(((prefs || []) as PrefRow[]).map(…))
//     const recipients = users.filter(u => prefMap.get(u.id)?.product_news !== false)
//
// Μια αποτυχία γυρίζει `undefined`, το `|| []` φτιάχνει ΚΕΝΟ χάρτη — και το
// φίλτρο ρωτά `undefined !== false`, ΑΛΗΘΕΣ για ΚΑΘΕ χρήστη. Το μήνυμα
// έφευγε σε όλους, μαζί με όσους είχαν πατήσει απεγγραφή.
//
// ΚΑΙ Ο ΤΡΟΠΟΣ ΔΙΑΦΥΓΗΣ ΕΣΠΑΖΕ ΜΑΖΙ. Το `unsubscribe_token` έβγαινε από τον
// ΙΔΙΟ κενό χάρτη, οπότε ο σύνδεσμος γινόταν «/unsubscribe/undefined»: ο
// παραλήπτης που δεν ήθελε το μήνυμα δεν είχε ούτε τρόπο να το σταματήσει.
//
// ΓΙΑΤΙ ΔΙΚΟΣ ΤΟΥ ΦΥΛΑΚΑΣ ΚΑΙ ΟΧΙ Η ΚΑΣΤΑΝΙΑ ΤΩΝ ΣΙΩΠΗΛΩΝ ΑΝΑΓΝΩΣΕΩΝ. Εκείνη
// ΜΕΤΡΑΕΙ και επιτρέπει ένα υπόλοιπο· εδώ δεν υπάρχει αποδεκτό υπόλοιπο. Η
// διαφορά δεν είναι βαθμού: μια σιωπηλή ανάγνωση αλλού δίνει λάθος αριθμό σε
// οθόνη, εδώ στέλνει μήνυμα σε άνθρωπο που είπε όχι.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { projectFiles } from './lib/git-files.mjs';

/** Οι πίνακες που κρατούν συναίνεση. Ενας νέος μπαίνει εδώ. */
const CONSENT = ['email_marketing_prefs', 'notification_preferences'];

const problems = [];

for (const file of projectFiles("'supabase/functions/**/*.ts'")) {
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    const table = CONSENT.find(t => line.includes(`'${t}'`));
    if (!table) return;
    // Μόνο οι ΑΝΑΓΝΩΣΕΙΣ: το upsert που εξασφαλίζει γραμμή δεν κρίνει συναίνεση.
    if (!/\.select\(/.test(line) && !/\.select\(/.test(lines[i + 1] || '')) return;
    // Η δήλωση μπορεί να σπάει σε γραμμές· κοιτάμε το παράθυρο της ανάθεσης.
    const stmt = [lines[i - 1] || '', line, lines[i + 1] || ''].join(' ');
    if (/error\s*:/.test(stmt) || /\berror\b/.test(stmt)) return;
    problems.push(`${file}:${i + 1}  ${line.trim().slice(0, 90)}`);
  });
}

if (problems.length) {
  console.error(`✗ ${problems.length} αναγνώσεις συναίνεσης αγνοούν το σφάλμα:\n`);
  problems.forEach(p => console.error('  ' + p));
  console.error(`
  Οταν ο πίνακας προτιμήσεων δεν διαβάζεται, ΔΕΝ φεύγει τίποτα. Το
  \`const { data } = await …\` κάνει την αποτυχία να μοιάζει με κενό
  κατάλογο· ο κενός κατάλογος κάνει το φίλτρο «!== false» αληθές για
  όλους· και ο σύνδεσμος απεγγραφής γίνεται «/unsubscribe/undefined».

  ΔΙΟΡΘΩΣΗ: \`const { data, error } = await …\` και απάντηση 500 στο σφάλμα.`);
  process.exit(1);
}
console.log(`✓ συναίνεση: κάθε ανάγνωση προτιμήσεων ελέγχει το σφάλμα της`);
