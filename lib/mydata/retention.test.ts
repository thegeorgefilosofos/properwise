// npx tsx lib/mydata/retention.test.ts
//
// Η Πολιτική απορρήτου λέει πόσο κρατιούνται τα δεδομένα myDATA με τις σταθερές
// του retention.ts· η βάση σβήνει με την `private.mydata_prune()`. Αν αλλάξει
// το ένα χωρίς το άλλο, η σελίδα υπόσχεται κάτι που δεν γίνεται.
import { readFileSync, readdirSync } from 'node:fs';
import { MYDATA_LOG_MONTHS, MYDATA_DECIDED_DAYS, MYDATA_PAUSE_DAYS, MYDATA_PENDING_DAYS, MYDATA_REVOKED_YEARS, MYDATA_QUARANTINE_DAYS } from './retention';

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
// Ε-8 (απόφαση ιδιοκτήτη 24/11/2026): 5 ΕΤΗ, όχι 1825 ημέρες (με τα δίσεκτα τα 5 έτη είναι 1826).
ok(`ανακλημένες άδειες: σβήνουν μετά από ${MYDATA_REVOKED_YEARS} έτη και στη βάση`, prune.includes(`revoked_at < now() - interval '${MYDATA_REVOKED_YEARS} years'`));
ok('ανακλημένες άδειες: όχι σε ημέρες', !/revoked_at < now\(\) - interval '\d+ days'/.test(prune));
// Κ-12: η καραντίνα έχει ανώτατο όριο.
ok(`καραντίνα: σβήνει μετά από ${MYDATA_QUARANTINE_DAYS} ημέρες και στη βάση`, prune.includes(`mydata_quarantine where seen_at < now() - interval '${MYDATA_QUARANTINE_DAYS} days'`));
// Κ-4: η επιβεβαίωση ΑΦΜ φεύγει με τη σύνδεση.
ok('επιβεβαίωση ΑΦΜ: σβήνει όταν η σύνδεση πεθάνει', /delete from public\.mydata_afm_confirmations[\s\S]*'dead'/.test(prune));
// N4: η παύση έχει όριο· η σελίδα λέει το ίδιο με τη βάση.
ok(`παύση: ανάκληση μετά από ${MYDATA_PAUSE_DAYS} ημέρες και στη βάση`, prune.includes(`paused_at < now() - interval '${MYDATA_PAUSE_DAYS} days'`) && prune.includes("'pause_expired'"));
const page = readFileSync('app/privacy/page.tsx', 'utf8');
ok('η σελίδα διαβάζει τις σταθερές', page.includes('MYDATA_LOG_MONTHS') && page.includes('MYDATA_DECIDED_DAYS'));
ok('N4: η σελίδα λέει το όριο της παύσης', page.includes('MYDATA_PAUSE_DAYS'));
// Κ-2: η Πολιτική διαβάζει ΟΛΕΣ τις διάρκειες από εδώ και το έτος απευθείας (όχι ημέρες/365).
for (const c of ['MYDATA_PENDING_DAYS', 'MYDATA_REVOKED_YEARS', 'MYDATA_QUARANTINE_DAYS']) ok(`η σελίδα διαβάζει το ${c}`, page.includes(c));
ok('καμία μετατροπή ημερών σε έτη', !/\/\s*365/.test(page) && !/\/\s*365/.test(readFileSync('lib/mydata/consentText.ts', 'utf8')));

console.log(`mydata retention: ${pass} ✓ · ${fail} ✗`);
if (fail) process.exit(1);
