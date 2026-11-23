// npx tsx lib/mydata/retention.test.ts
//
// Η Πολιτική απορρήτου λέει πόσο κρατιούνται τα δεδομένα myDATA με τις σταθερές
// του retention.ts· η βάση σβήνει με την `private.mydata_prune()`. Αν αλλάξει
// το ένα χωρίς το άλλο, η σελίδα υπόσχεται κάτι που δεν γίνεται.
import { readFileSync } from 'node:fs';
import { MYDATA_LOG_MONTHS, MYDATA_DECIDED_DAYS, MYDATA_PAUSE_DAYS } from './retention';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean) => { if (cond) pass++; else { fail++; console.error('✗ ' + name); } };

const sql = readFileSync('supabase/migrations/20261123100000_o_logistis_fernei_ta_parastatika_apo_to_mydata.sql', 'utf8');
const prune = sql.slice(sql.indexOf('function private.mydata_prune()'), sql.indexOf('revoke all on function private.mydata_prune()'));
ok('η συνάρτηση καθαρισμού βρέθηκε', prune.length > 50);
ok(`αρχείο πρόσβασης: ${MYDATA_LOG_MONTHS} μήνες και στη βάση`, prune.includes(`interval '${MYDATA_LOG_MONTHS} months'`));
ok(`κριμένα παραστατικά: ${MYDATA_DECIDED_DAYS} ημέρες και στη βάση`, prune.includes(`interval '${MYDATA_DECIDED_DAYS} days'`));
ok('τα εκκρεμή δεν σβήνονται', /status <> 'pending'/.test(prune));
// N4: η παύση έχει όριο· η σελίδα λέει το ίδιο με τη βάση.
ok(`παύση: ανάκληση μετά από ${MYDATA_PAUSE_DAYS} ημέρες και στη βάση`, prune.includes(`paused_at < now() - interval '${MYDATA_PAUSE_DAYS} days'`) && prune.includes("'pause_expired'"));
const page = readFileSync('app/privacy/page.tsx', 'utf8');
ok('η σελίδα διαβάζει τις σταθερές', page.includes('MYDATA_LOG_MONTHS') && page.includes('MYDATA_DECIDED_DAYS'));
ok('N4: η σελίδα λέει το όριο της παύσης', page.includes('MYDATA_PAUSE_DAYS'));

console.log(`mydata retention: ${pass} ✓ · ${fail} ✗`);
if (fail) process.exit(1);
