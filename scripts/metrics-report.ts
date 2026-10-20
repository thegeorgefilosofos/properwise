// ═══════════════════════════════════════════════════════════════════════════
// Ο ΕΒΔΟΜΑΔΙΑΙΟΣ ΠΙΝΑΚΑΣ ΤΗΣ ΕΠΙΧΕΙΡΗΣΗΣ · npm run metrics:report
// ─────────────────────────────────────────────────────────────────────────
// Τυπώνει ανά εβδομάδα τις εγγραφές, πόσοι έβαλαν ακίνητο, την επιστροφή
// D1/D7/D30, τους ενεργούς, τις σαρώσεις και τους νέους πληρωμένους. Από πάνω
// γράφει τη σημερινή εικόνα. Οι αριθμοί βγαίνουν από τη βάση (metrics_weekly,
// metrics_snapshot)· οι ορισμοί είναι στη μετανάστευση 20261020150000 και στο
// lib/metrics/weekly.ts.
//
// ΧΡΗΣΗ:  npm run metrics:report [-- --weeks 12] [--json]
//         με τις μεταβλητές του lib/supabase/service.ts στο περιβάλλον.
// ΕΞΟΔΟΣ: 0 μετρήθηκε · 2 ΔΕΝ ΜΕΤΡΗΘΗΚΕ (λείπουν μεταβλητές) · 1 σφάλμα της βάσης.
//
// Το κλειδί διαβάζεται μόνο από το περιβάλλον και δεν τυπώνεται ποτέ. Η έξοδος
// είναι πλήθη: κανένα αναγνωριστικό, κανένα email, κανένα ποσό.
// ═══════════════════════════════════════════════════════════════════════════
import { reportText } from '../lib/metrics/weekly';
import { loadMetrics, metricsUnavailable } from '../lib/metrics/source';
import { athensToday } from '../lib/core/time';

const args = process.argv.slice(2);
const opt = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const weeks = Math.max(1, Math.min(104, Number(opt('--weeks')) || 12));
const asJson = args.includes('--json');
const env = process.env as Record<string, string | undefined>;

const missing = metricsUnavailable(env);
if (missing) {
  console.error(`ΔΕΝ ΜΕΤΡΗΘΗΚΕ. ${missing}`);
  process.exit(2);
}

async function main() {
  const { rows, snapshot } = await loadMetrics(weeks, env);
  const today = athensToday();
  if (asJson) console.log(JSON.stringify({ date: today, snapshot, weeks: rows }, null, 2));
  else console.log(reportText(rows, snapshot, today.split('-').reverse().join('/')));
}

main().catch(err => { console.error(err instanceof Error ? err.message : err); process.exit(1); });
