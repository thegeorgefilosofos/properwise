// npx tsx lib/billing/trialOffer.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΚΟΥΜΠΙ ΤΗΣ ΕΓΓΡΑΦΗΣ ΔΕΝ ΥΠΟΣΧΕΤΑΙ ΚΑΤΙ ΠΟΥ ΔΕΝ ΣΥΜΒΑΙΝΕΙ
// ─────────────────────────────────────────────────────────────────────────
// Ο έλεγχος κειμένων της 06.10.2026 βρήκε το δωρεάν πακέτο να οδηγεί σε κουμπί
// «Ξεκίνα τη δοκιμή» και πακέτα με τιμή να γράφουν «Ξεκίνα δωρεάν». Ο κανόνας
// ζει στο `signupCta`· εδώ κλειδώνεται απέναντι στις πηγές του, όχι σε λίστα
// ονομάτων, ώστε ένα νέο πακέτο να κρίνεται με τον ίδιο τρόπο.
// ═══════════════════════════════════════════════════════════════════════════
import { PLANS, PLAN_ORDER, isPayingPlan } from './plans';
import { TRIAL_PLAN, planAtLeast } from './entitlements';
import { signupCta } from './trialOffer';

let p = 0, f = 0;
const ok = (c: boolean, m: string) => { if (c) p++; else { f++; console.error('✗', m); } };

const FREE = 'Ξεκίνα δωρεάν';
const TRIAL = 'Ξεκίνα τη δοκιμή';

// Χωρίς `?plan=` η εγγραφή ανοίγει λογαριασμό στο δωρεάν: το ίδιο λεκτικό.
ok(signupCta() === FREE, 'χωρίς πακέτο: «Ξεκίνα δωρεάν»');
ok(signupCta(null) === FREE, 'με null: «Ξεκίνα δωρεάν»');
ok(signupCta('free') === signupCta(), 'το δωρεάν πακέτο και η γυμνή εγγραφή λένε το ίδιο');

for (const id of PLAN_ORDER) {
  const label = signupCta(id);
  const covered = PLANS[id].trialDays > 0 && planAtLeast(TRIAL_PLAN, id);
  if (!isPayingPlan(id)) {
    ok(label === FREE, `${id}: χωρίς τιμή γράφει «${FREE}» (γράφει «${label}»)`);
    continue;
  }
  // Πακέτο με τιμή δεν λέγεται ποτέ δωρεάν.
  ok(!label.includes('δωρεάν'), `${id}: πακέτο με τιμή δεν γράφει «δωρεάν» (γράφει «${label}»)`);
  // «Δοκιμή» μόνο όπου η δοκιμή δίνει όσα έχει το πακέτο.
  ok((label === TRIAL) === covered,
    `${id}: «${TRIAL}» μόνο αν η δοκιμή καλύπτει το πακέτο (γράφει «${label}»)`);
}

// Το ίδιο το TRIAL_PLAN έχει τιμή και η δοκιμή το καλύπτει: εκεί το κουμπί λέει δοκιμή.
ok(signupCta(TRIAL_PLAN) === TRIAL, 'το πακέτο της δοκιμής γράφει «Ξεκίνα τη δοκιμή»');

console.log(`\nbilling/trialOffer.ts — ${p} passed, ${f} failed`);
if (f > 0) process.exit(1);
console.log('όλα πέρασαν');
