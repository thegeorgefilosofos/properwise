// npx tsx lib/mydata/retention.test.ts
//
// Η Πολιτική απορρήτου λέει πόσο κρατιούνται τα δεδομένα myDATA με τις σταθερές
// του retention.ts· η βάση σβήνει με την `private.mydata_prune()`. Αν αλλάξει
// το ένα χωρίς το άλλο, η σελίδα υπόσχεται κάτι που δεν γίνεται.
import { readFileSync, readdirSync } from 'node:fs';
import { MYDATA_LOG_MONTHS, MYDATA_DECIDED_DAYS, MYDATA_PAUSE_DAYS, MYDATA_PENDING_DAYS, MYDATA_REVOKED_DAYS } from './retention';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean) => { if (cond) pass++; else { fail++; console.error('✗ ' + name); } };

// Η ισχύουσα `mydata_prune` είναι της τελευταίας μετανάστευσης που την ορίζει.
const dir = 'supabase/migrations';
const sql = readdirSync(dir).filter(f => f.endsWith('.sql')).sort().reverse()
  .map(f => readFileSync(`${dir}/${f}`, 'utf8')).find(t => t.includes('function private.mydata_prune()')) ?? '';
const prune = sql.slice(sql.indexOf('function private.mydata_prune()'), sql.indexOf('revoke all on function private.mydata_prune()'));
ok('η συνάρτηση καθαρισμού βρέθηκε', prune.length > 50);
ok(`αρχείο πρόσβασης: ${MYDATA_LOG_MONTHS} μήνες και στη βάση`, prune.includes(`interval '${MYDATA_LOG_MONTHS} months'`));
ok(`κριμένα παραστατικά: ${MYDATA_DECIDED_DAYS} ημέρες και στη βάση`, prune.includes(`interval '${MYDATA_DECIDED_DAYS} days'`));
// Θωράκιση 24/11/2026 (Κ2, Σ3 νομικού): τα εκκρεμή δεν μένουν επ' αόριστον,
// και οι ανακλημένες άδειες έχουν κι αυτές όριο.
ok(`εκκρεμή: σβήνουν μετά από ${MYDATA_PENDING_DAYS} ημέρες και στη βάση`, /status = 'pending'/.test(prune) && prune.includes(`interval '${MYDATA_PENDING_DAYS} days'`));
ok(`ανακλημένες άδειες: σβήνουν μετά από ${MYDATA_REVOKED_DAYS} ημέρες και στη βάση`, prune.includes(`revoked_at < now() - interval '${MYDATA_REVOKED_DAYS} days'`));
// N4: η παύση έχει όριο· η σελίδα λέει το ίδιο με τη βάση.
ok(`παύση: ανάκληση μετά από ${MYDATA_PAUSE_DAYS} ημέρες και στη βάση`, prune.includes(`paused_at < now() - interval '${MYDATA_PAUSE_DAYS} days'`) && prune.includes("'pause_expired'"));
const page = readFileSync('app/privacy/page.tsx', 'utf8');
ok('η σελίδα διαβάζει τις σταθερές', page.includes('MYDATA_LOG_MONTHS') && page.includes('MYDATA_DECIDED_DAYS'));
ok('N4: η σελίδα λέει το όριο της παύσης', page.includes('MYDATA_PAUSE_DAYS'));

console.log(`mydata retention: ${pass} ✓ · ${fail} ✗`);
if (fail) process.exit(1);
