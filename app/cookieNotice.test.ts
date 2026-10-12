// npx tsx app/cookieNotice.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΣΕΝΑΡΙΟ ΤΟΥ <head> ΚΑΙ ΤΟ ΠΛΑΙΣΙΟ ΑΠΟΦΑΣΙΖΟΥΝ ΤΟ ΙΔΙΟ
// ─────────────────────────────────────────────────────────────────────────
// Δύο κώδικες κρίνουν αν ο επισκέπτης έχει δει την ενημέρωση: το σενάριο που
// κρύβει το πλαίσιο πριν τη ζωγραφική και το CookieConsent μετά την ενυδάτωση.
// Αν διαφωνήσουν, είτε το πλαίσιο κρύβεται από όποιον δεν το έχει δει είτε
// εμφανίζεται για ένα καρέ και ξαναφεύγει. Το τεστ τρέχει το σενάριο όπως θα
// το έτρεχε ο περιηγητής, πάνω στις ίδιες εγγραφές με το `acknowledged`.
// ═══════════════════════════════════════════════════════════════════════════
import { POLICY_VERSION } from '@/lib/legal/identity';
import { COOKIE_NOTICE_KEY, acknowledged, cookieNoticeInitScript } from './cookieNotice';

let passed = 0, failed = 0;
const ok = (name: string, cond: boolean) => { if (cond) passed++; else { failed++; console.error('✗ ' + name); } };

/** Τρέχει το σενάριο με ένα localStorage και ένα <html> για δοκιμή. */
function runScript(stored: string | null, throws = false): boolean {
  const attrs = new Map<string, string>();
  const localStorage = { getItem: (k: string) => { if (throws) throw new Error('blocked'); return k === COOKIE_NOTICE_KEY ? stored : null; } };
  const document = { documentElement: { setAttribute: (k: string, v: string) => { attrs.set(k, v); } } };
  new Function('localStorage', 'document', cookieNoticeInitScript)(localStorage, document);
  return attrs.has('data-cookie-ok');
}

const CASES: [string, string | null][] = [
  ['καμία εγγραφή', null],
  ['κενή εγγραφή', ''],
  ['άκυρο JSON', '{oops'],
  ['JSON null', 'null'],
  ['χωρίς έκδοση', JSON.stringify({ ts: 'x' })],
  ['παλιά έκδοση', JSON.stringify({ v: '2000-01', ts: 'x' })],
  ['έκδοση ως αριθμός', JSON.stringify({ v: 1 })],
  ['η τρέχουσα έκδοση', JSON.stringify({ v: POLICY_VERSION, ts: 'x' })],
];
for (const [name, raw] of CASES) ok(`ίδια απόφαση: ${name}`, runScript(raw) === acknowledged(raw));

ok('μόνο η τρέχουσα έκδοση κρύβει το πλαίσιο', CASES.filter(([, raw]) => acknowledged(raw)).length === 1);
ok('μπλοκαρισμένος χώρος αποθήκευσης: το πλαίσιο φαίνεται', runScript(null, true) === false);
ok('το σενάριο διαβάζει το ίδιο κλειδί', cookieNoticeInitScript.includes(JSON.stringify(COOKIE_NOTICE_KEY)));

console.log(`app/cookieNotice.test.ts: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
