// npx tsx lib/billing/checkoutDiagnosis.test.ts
//
// ΓΙΑΤΙ ΕΙΝΑΙ ΚΛΕΙΣΤΟ ΤΟ ΤΑΜΕΙΟ, ΧΩΡΙΣ ΝΑ ΔΙΑΒΑΣΤΕΙ ΤΙΜΗ (έλεγχος ετοιμότητας
// πληρωμών 12/11/2026, «Λείπει (κώδικας)» 5). Η διάγνωση πρέπει να λέει το
// ίδιο με το κουμπί αγοράς, να ονομάζει κάθε εμπόδιο και να μην αφήνει ποτέ
// να φανεί κλειδί, μυστικό ή αναγνωριστικό προϊόντος. Η διαδρομή πρέπει να
// ρωτά συνεδρία, δεύτερο βήμα και κατάλογο διαχειριστών ΠΡΙΝ απαντήσει.
import { readFileSync } from 'node:fs';
import { checkoutDiagnosis } from './checkoutDiagnosis';
import { creemPort } from './merchant/creem';
import { checkoutIsLive } from '@/lib/legal/checkout';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n); } };

const FULL = 'prod_a:solo:monthly,prod_b:solo:annual,prod_c:owner:monthly,prod_d:owner:annual,'
  + 'prod_e:agency:monthly,prod_f:agency:annual,prod_g:office:monthly,prod_h:office:annual';
const LIVE = { CREEM_API_KEY: 'creem_LIVEVAL', CREEM_PRODUCTS: FULL, CREEM_WEBHOOK_SECRET: 'whsec_HOOKVAL', VERCEL_ENV: 'production' };

const cases: Record<string, Record<string, string>> = {
  'όλα εντάξει': LIVE,
  'χωρίς κλειδί': { ...LIVE, CREEM_API_KEY: '' },
  'δοκιμαστικό κλειδί στην παραγωγή': { ...LIVE, CREEM_API_KEY: 'creem_test_TESTVAL' },
  'διακόπτης δοκιμής': { ...LIVE, CREEM_TEST_MODE: 'yes' },
  'μισός χάρτης': { ...LIVE, CREEM_PRODUCTS: 'prod_a:solo:monthly,prod_b:solo:annual' },
  'χαλασμένος χάρτης': { ...LIVE, CREEM_PRODUCTS: `${FULL},prod_zz:ufo:weekly,σκέτο` },
  'χωρίς χάρτη': { ...LIVE, CREEM_PRODUCTS: '' },
  'χωρίς μυστικό webhook': { ...LIVE, CREEM_WEBHOOK_SECRET: '' },
};

for (const [name, env] of Object.entries(cases)) {
  const d = checkoutDiagnosis(env, creemPort);
  ok(`${name}: ίδια απάντηση με το κουμπί αγοράς`, d.live === checkoutIsLive(env, undefined, creemPort));
  ok(`${name}: κλειστό ⇔ υπάρχει εμπόδιο`, d.live || d.problems.length > 0);
  const text = JSON.stringify(d);
  ok(`${name}: καμία τιμή μεταβλητής`, !/LIVEVAL|TESTVAL|HOOKVAL|prod_[a-z]|ufo|σκέτο|whsec/.test(text));
}
{
  ok('όλα εντάξει: ανοιχτό, κανένα εμπόδιο', checkoutDiagnosis(LIVE, creemPort).live && checkoutDiagnosis(LIVE, creemPort).problems.length === 0);
  const p = (n: string) => checkoutDiagnosis(cases[n], creemPort).problems.join(' ');
  ok('χωρίς κλειδί: το λέει', /Λείπει το κλειδί/.test(p('χωρίς κλειδί')));
  ok('δοκιμαστικό στην παραγωγή: το λέει', /δοκιμαστικό κλειδί μέσα στο Production/.test(p('δοκιμαστικό κλειδί στην παραγωγή')));
  ok('διακόπτης δοκιμής: το λέει', /CREEM_TEST_MODE/.test(p('διακόπτης δοκιμής')));
  ok('μισός χάρτης: ονομάζει τα ζεύγη', /agency:monthly/.test(p('μισός χάρτης')) && /owner:annual/.test(p('μισός χάρτης'))
     && !/solo:monthly/.test(p('μισός χάρτης')));
  ok('χαλασμένος χάρτης: μετρά τις γραμμές', /2 γραμμές/.test(p('χαλασμένος χάρτης')));
  ok('χωρίς χάρτη: το λέει, χωρίς κατάλογο οκτώ ζευγών', /Λείπει ο χάρτης/.test(p('χωρίς χάρτη')) && !/ζεύγη/.test(p('χωρίς χάρτη')));
  ok('χωρίς μυστικό webhook: κλειστό και το λέει',
     !checkoutDiagnosis(cases['χωρίς μυστικό webhook'], creemPort).live && /CREEM_WEBHOOK_SECRET/.test(p('χωρίς μυστικό webhook')));
}

// ── Η ΔΙΑΔΡΟΜΗ: ΣΥΝΕΔΡΙΑ, ΔΕΥΤΕΡΟ ΒΗΜΑ, ΔΙΑΧΕΙΡΙΣΤΗΣ, ΜΕ ΑΥΤΗ ΤΗ ΣΕΙΡΑ ───────
// Η route.ts φορτώνει το next/headers και δεν τρέχει σε Node· φυλάγεται η
// σειρά, όπως στο checkoutGate.test.ts.
{
  const SRC = readFileSync('app/api/billing/diagnostic/route.ts', 'utf8');
  const iUser = SRC.indexOf('auth.getUser(');
  const iStep = SRC.indexOf('requireSecondStep(');
  const iAdmin = SRC.indexOf(".from('app_admins')");
  const iForbid = SRC.indexOf('status: 403');
  const iDiag = SRC.indexOf('checkoutDiagnosis(process.env)');
  ok('συνεδρία', iUser > 0);
  ok('δεύτερο βήμα μετά τη συνεδρία', iStep > iUser);
  ok('κατάλογος διαχειριστών μετά το δεύτερο βήμα', iAdmin > iStep);
  ok('403 για όποιον δεν είναι διαχειριστής, πριν από τη διάγνωση', iForbid > iAdmin && iDiag > iForbid);
  ok('ο κατάλογος διαβάζεται με τον πελάτη του χρήστη, όχι με κλειδί υπηρεσίας', !/createServiceClient/.test(SRC));
  ok('χωρίς cache', /no-store/.test(SRC));
  ok('μόνο GET', /export async function GET\(/.test(SRC) && !/export async function (POST|PUT|PATCH|DELETE)/.test(SRC));
}

console.log(fail === 0 ? `✓ checkoutDiagnosis: ${pass} έλεγχοι πέρασαν` : `✗ checkoutDiagnosis: ${fail} απέτυχαν από ${pass + fail}`);
if (fail > 0) process.exit(1);
