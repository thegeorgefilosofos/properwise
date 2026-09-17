// npx tsx lib/email/ack.test.ts
import { replyAckEmail } from './ack';
import { siteUrl } from '@/lib/core/site';

let p = 0, f = 0;
const ok = (c: boolean, m: string) => { if (c) p++; else { f++; console.error('✗', m); } };

// ── Το θέμα, ακριβώς ───────────────────────────────────────────────────────
const withName = replyAckEmail('Νίκος');
ok(withName.subject === 'PROPERWISE | Λάβαμε το μήνυμά σου', 'το θέμα είναι ακριβώς αυτό');

// ── Η προσφώνηση, με όνομα και χωρίς ────────────────────────────────────────
ok(withName.html.includes('Γεια σου <b>Νίκος</b>,'), 'με όνομα, έντονη προσφώνηση');
const noName = replyAckEmail('');
ok(noName.html.includes('Γεια σου,'), 'χωρίς όνομα, σκέτη προσφώνηση');
ok(!noName.html.includes('Γεια σου <b>'), 'χωρίς όνομα, καμία κενή έντονη ετικέτα');
const blank = replyAckEmail('   ');
ok(blank.html.includes('Γεια σου,'), 'όνομα με μόνο κενά μετριέται ως άγνωστο');

// ── Το όνομα ΔΙΑΦΕΥΓΕΙ, ώστε να μη γίνει σήμανση ────────────────────────────
const evil = replyAckEmail('Α<script>x');
ok(evil.html.includes('Α&lt;script&gt;x'), 'το όνομα με αγκύλες διαφεύγει');
ok(!evil.html.includes('Α<script>x'), 'το ωμό όνομα δεν εμφανίζεται αυτούσιο');

// ── ΚΑΜΙΑ ΠΑΥΛΑ: ούτε μεγάλη ούτε μεσαία ────────────────────────────────────
ok(!withName.html.includes('—'), 'καμία μεγάλη παύλα (em-dash)');
ok(!withName.html.includes('–'), 'καμία μεσαία παύλα (en-dash)');

// ── Το λογότυπο και η διεύθυνση υποστήριξης ─────────────────────────────────
// Το λογότυπο βγαίνει από τη μία πηγή του site· σε παραγωγή είναι το
// properwise.gr/brand/…, στον έλεγχο η προεπιλογή. Ελέγχουμε την ίδια τιμή.
ok(withName.html.includes(siteUrl('/brand/properwise-logotypo-skouro.png')),
  'περιέχει το λογότυπο από τη μία πηγή του site');
ok(withName.html.includes('/brand/properwise-logotypo-skouro.png'),
  'το φιλοξενούμενο μονόγραμμα, στη σωστή διαδρομή');
ok(withName.html.includes('support@properwise.gr'), 'περιέχει τη διεύθυνση υποστήριξης');

// ── Το εγκεκριμένο κείμενο υπάρχει ──────────────────────────────────────────
ok(withName.html.includes('Λάβαμε το μήνυμά σου και σε ευχαριστούμε'), 'η πρώτη παράγραφος');
ok(withName.html.includes('Η ομάδα του PROPERWISE'), 'η υπογραφή');
ok(withName.html.includes('Αυτοματοποιημένη επιβεβαίωση παραλαβής'), 'η σημείωση του υποσέλιδου');

console.log(`\nemail/ack.ts — ${p} passed, ${f} failed`);
if (f > 0) process.exit(1);
console.log('όλα πέρασαν');
