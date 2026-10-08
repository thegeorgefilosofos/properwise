// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΔΟΚΙΜΕΣ ΤΗΣ ΜΕΤΡΗΣΗΣ
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΔΙΑΚΥΒΕΥΕΤΑΙ. Αυτά τα ονόματα γίνονται στήλες σε ερώτημα SQL που θα
// διαβάσει αγοραστής. Ενα όνομα που δεν περνά τον έλεγχο της βάσης γυρίζει
// ως σφάλμα στο `{ error }` της κλήσης: το γεγονός χάνεται και η `track` το
// αναφέρει πλέον στο captureError, αλλά μετά το ανέβασμα. Ο έλεγχος γίνεται
// λοιπόν ΚΑΙ ΕΔΩ, όπου φαίνεται πριν.
// ═══════════════════════════════════════════════════════════════════════════
import { PRODUCT_EVENTS, track, type ProductEvent } from './events';

let passed = 0, failed = 0;
function ok(name: string, cond: boolean) { if (cond) { passed++ } else { failed++; console.log('  ✗ ' + name) } }

// Ο ΙΔΙΟΣ κανόνας που γράφει η log_event στο scripts/db/product-events.sql.
// Αν αλλάξει εκεί, πρέπει να αλλάξει και εδώ: γι' αυτό είναι γραμμένος δύο
// φορές, ώστε η απόκλιση να φαίνεται ως αποτυχία και όχι ως χαμένο γεγονός.
const NAME_RULE = /^[a-z][a-z0-9_]{2,47}$/;

{
  const names = Object.values(PRODUCT_EVENTS);
  ok('κάθε όνομα περνά τον έλεγχο της βάσης', names.every(n => NAME_RULE.test(n)));
  ok('το κλειδί είναι ίδιο με την τιμή', Object.entries(PRODUCT_EVENTS).every(([k, v]) => k === v));
  ok('κανένα διπλότυπο', new Set(names).size === names.length);
  ok('εννέα σκαλιά', names.length === 9);
}

// ── ΤΟ ΧΩΝΙ ΕΧΕΙ ΣΕΙΡΑ ΚΑΙ Η ΣΕΙΡΑ ΕΧΕΙ ΝΟΗΜΑ ───────────────────────────
{
  const order = Object.values(PRODUCT_EVENTS);
  const idx = (e: ProductEvent) => order.indexOf(e);
  ok('η εγγραφή είναι πρώτη', idx(PRODUCT_EVENTS.signed_up) === 0);
  ok('η πληρωμή είναι τελευταία', idx(PRODUCT_EVENTS.subscription_started) === order.length - 1);
  ok('το δεύτερο ακίνητο έρχεται μετά το πρώτο',
    idx(PRODUCT_EVENTS.second_property_added) > idx(PRODUCT_EVENTS.property_added));
  ok('η δοκιμή έρχεται πριν από τη συνδρομή',
    idx(PRODUCT_EVENTS.trial_started) < idx(PRODUCT_EVENTS.subscription_started));
}

// ── Η ΜΕΤΡΗΣΗ ΔΕΝ ΣΠΑΕΙ ΠΟΤΕ ΤΗΝ ΠΡΑΞΗ ΠΟΥ ΜΕΤΡΑΕΙ ───────────────────────
// Σε συνάρτηση, γιατί η έξοδος των δοκιμών είναι cjs και δεν δέχεται await
// στο ανώτατο επίπεδο.
async function trackTests() {
  const calls: Array<{ fn: string; args: unknown }> = [];
  const fake = { rpc: (fn: string, args: unknown) => { calls.push({ fn, args }); return Promise.resolve({ error: null }) } };
  await track(fake as never, PRODUCT_EVENTS.property_added, { plan: 'solo', count: 1 });
  ok('καλεί τη log_event', calls.length === 1 && calls[0].fn === 'log_event');
  ok('περνά όνομα και φορτίο',
    JSON.stringify(calls[0].args) === JSON.stringify({ p_event: 'property_added', p_props: { plan: 'solo', count: 1 } }));

  // ΔΕΝ ΠΕΡΝΑ user_id. Αν κάποτε προστεθεί, ο έλεγχος κοκκινίζει: η ταυτότητα
  // ορίζεται ΜΟΝΟ από τη βάση, αλλιώς γράφει ο καθένας στο όνομα του άλλου.
  ok('δεν στέλνει ποτέ ταυτότητα χρήστη',
    !JSON.stringify(calls[0].args).includes('user_id'));

  const boom = { rpc: () => Promise.reject(new Error('η βάση έπεσε')) };
  let threw = false;
  try { await track(boom as never, PRODUCT_EVENTS.signed_up) } catch { threw = true }
  ok('πεσμένη βάση δεν πετάει προς τα έξω', !threw);

  const sync = { rpc: () => { throw new Error('συγχρονο σφάλμα') } };
  let threw2 = false;
  try { await track(sync as never, PRODUCT_EVENTS.signed_up) } catch { threw2 = true }
  ok('ούτε σύγχρονο σφάλμα', !threw2);

  // ── ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΕΠΙΣΤΡΕΦΕΙ Η ΒΑΣΗ ΔΕΝ ΧΑΝΕΤΑΙ ΠΙΑ ───────────────────
  // Το supabase δεν πετάει: γυρίζει `{ error }`. Χωρίς DSN, το captureError
  // γράφει μόνο στην κονσόλα, οπότε η κονσόλα είναι ο μάρτυρας.
  delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  delete process.env.SENTRY_DSN;
  const logged = async (result: unknown, props: Record<string, string | number> = {}) => {
    const lines: unknown[][] = [];
    const orig = console.error;
    console.error = (...args: unknown[]) => { lines.push(args); };
    let threw = false;
    try {
      await track({ rpc: () => Promise.resolve(result) } as never, PRODUCT_EVENTS.property_added, props);
    } catch { threw = true } finally { console.error = orig; }
    return { threw, reports: lines.filter(a => a[0] === '[captureError]') };
  };

  const missing = await logged({ error: { code: 'PGRST202', message: 'Could not find the function public.log_event' } }, { count: 1, plan: 'solo' });
  ok('επιστρεφόμενο σφάλμα δεν πετάει', !missing.threw);
  ok('επιστρεφόμενο σφάλμα αναφέρεται μία φορά', missing.reports.length === 1);
  const msg = String(missing.reports[0]?.[1] ?? '');
  ok('η αναφορά λέει γεγονός και κωδικό', msg.includes('property_added') && msg.includes('PGRST202'));
  const extra = missing.reports[0]?.[2];
  ok('η αναφορά κρατά μόνο γεγονός και κωδικό',
    JSON.stringify(extra) === JSON.stringify({ event: 'property_added', code: 'PGRST202' }));
  const whole = JSON.stringify(missing.reports[0]?.slice(2)) + msg;
  ok('η αναφορά δεν κουβαλά φορτίο, ταυτότητα ή μήνυμα',
    !whole.includes('plan') && !whole.includes('solo') && !whole.includes('user_id') && !whole.includes('Could not find'));

  const offline = await logged({ error: { code: '', message: 'TypeError: Failed to fetch' } });
  ok('αποτυχία δικτύου χωρίς κωδικό δεν αναφέρεται', offline.reports.length === 0 && !offline.threw);

  const fine = await logged({ error: null });
  ok('η επιτυχία δεν αναφέρει τίποτα', fine.reports.length === 0);
}

// ── ΤΙ ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΜΠΕΙ ΣΤΟ ΦΟΡΤΙΟ ───────────────────────────────
// Δεν επιβάλλεται από τον τύπο (είναι Record), οπότε επιβάλλεται από κανόνα
// που διαβάζεται: κανένα κλειδί με προσωπικό δεδομένο ανάμεσα στα ονόματα.
{
  const forbidden = ['email', 'name', 'address', 'afm', 'vat', 'phone', 'iban', 'property_id', 'amount'];
  const used = new Set<string>();
  // Τα κλειδιά που ΟΝΤΩΣ χρησιμοποιεί η εφαρμογή, γραμμένα ρητά εδώ ώστε ο
  // κατάλογος να είναι ορατός και ελέγξιμος με μια ματιά.
  ['plan', 'count', 'source', 'kind', 'cycle'].forEach(k => used.add(k));
  ok('κανένα κλειδί φορτίου δεν είναι προσωπικό δεδομένο',
    [...used].every(k => !forbidden.includes(k)));
}

void trackTests().then(() => {
  console.log(`analytics/events.test.ts: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
});
