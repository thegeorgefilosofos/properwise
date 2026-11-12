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
import { signupCta, TRIAL_OFFER, TRIAL_POOL_LINE, trialOfferEn, TRIAL_POOL_LINE_EN } from './trialOffer';
import { TRIAL_LIMITS, TRIAL_SCANS_PER_MONTH, FREE_POOL_PER_MONTH } from './aiLimits';
import { fn, fmtFor } from '../core/format';
import { readFileSync } from 'node:fs';

let p = 0, f = 0;
const ok = (c: boolean, m: string) => { if (c) p++; else { f++; console.error('✗', m); } };

const FREE = 'Ξεκίνα χωρίς συνδρομή';
const TRIAL = 'Ξεκίνα τη δοκιμή';

// Χωρίς `?plan=` η εγγραφή ανοίγει λογαριασμό στο δωρεάν: το ίδιο λεκτικό.
ok(signupCta() === FREE, 'χωρίς πακέτο: «Ξεκίνα χωρίς συνδρομή»');
ok(signupCta(null) === FREE, 'με null: «Ξεκίνα χωρίς συνδρομή»');
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

// ── Η ΓΡΑΜΜΗ ΤΗΣ ΔΟΚΙΜΗΣ ΛΕΕΙ ΚΑΙ ΤΗΝ ΚΟΙΝΗ ΔΕΞΑΜΕΝΗ (έλεγχος 12/11/2026) ───
// Οι ερωτήσεις και οι σαρώσεις της δοκιμής κλείνουν για όλους όταν γεμίσει το
// FREE_POOL_PER_MONTH. Η αρχική και οι Όροι δεν το έλεγαν πουθενά.
ok(TRIAL_OFFER.includes(`${TRIAL_LIMITS.perMonth} ερωτήσεις`) && TRIAL_OFFER.includes(`${TRIAL_SCANS_PER_MONTH} σαρώσεις`), 'η δοκιμή λέει τα όριά της από τις σταθερές');
ok(TRIAL_POOL_LINE.includes(fn(FREE_POOL_PER_MONTH)), 'η δεξαμενή λέγεται με τον αριθμό της σταθεράς');
ok(TRIAL_OFFER.endsWith(TRIAL_POOL_LINE), 'η γραμμή της δοκιμής κλείνει με τη δεξαμενή');
ok(trialOfferEn('Owner+').endsWith(TRIAL_POOL_LINE_EN) && TRIAL_POOL_LINE_EN.includes(fmtFor('en').fn(FREE_POOL_PER_MONTH)), 'και στα αγγλικά');
// Οι Όροι §6 δανείζονται την ίδια πρόταση, όχι δική τους με «τις δυνατότητες του πακέτου».
const terms = readFileSync('app/terms/page.tsx', 'utf8');
// κυριολεκτικό-πρότυπο
ok(terms.includes('`${TRIAL_OFFER} Η δοκιμή δίνεται μία φορά ανά λογαριασμό.'), 'οι Όροι §6 λένε τη δοκιμή με το TRIAL_OFFER');
ok(!terms.includes('με τις δυνατότητες του πακέτου'), 'οι Όροι δεν υπόσχονται «τις δυνατότητες του πακέτου» χωρίς όρια');
const termsEn = readFileSync('lib/i18n/en/legal/terms.ts', 'utf8');
// κυριολεκτικό-πρότυπο
ok(termsEn.includes('`${trialOfferEn(name(TRIAL_PLAN))} The trial is given once per account.') && !termsEn.includes('with the features of the'), 'και οι αγγλικοί Όροι');

console.log(`\nbilling/trialOffer.ts — ${p} passed, ${f} failed`);
if (f > 0) process.exit(1);
console.log('όλα πέρασαν');
