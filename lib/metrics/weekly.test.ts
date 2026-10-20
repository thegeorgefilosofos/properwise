// npx tsx lib/metrics/weekly.test.ts
//
// ═══════════════════════════════════════════════════════════════════════════
// Η ΕΒΔΟΜΑΔΙΑΙΑ ΜΕΤΡΗΣΗ: ΟΡΙΣΜΟΙ, ΑΝΑΓΝΩΣΗ, ΠΙΝΑΚΑΣ
// ─────────────────────────────────────────────────────────────────────────
// Κλειδώνει ότι η λεζάντα λέει τα ίδια παράθυρα με την SQL, ότι από τη βάση
// περνούν μόνο πλήθη, ότι ο μη μετρήσιμος δεν γίνεται 0% και ότι η μετανάστευση
// κρατά τη συνάρτηση κλειστή στον περιηγητή.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync } from 'node:fs';
import { RETENTION_WINDOWS, parseWeeklyRows, parseSnapshot, rate, weeklyTable, reportText, COLUMNS } from './weekly';
import { metricsUnavailable, loadMetrics } from './source';
import { URL_ENV, SERVICE_KEY_ENV } from '../supabase/service';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n) } };

// ── 1. ΙΔΙΑ ΠΑΡΑΘΥΡΑ ΜΕ ΤΗΝ SQL ────────────────────────────────────────────
const dir = 'supabase/migrations';
const file = readdirSync(dir).find(f => f.startsWith('20261020150000_'));
ok('υπάρχει η μετανάστευση της μέτρησης', !!file);
const sql = file ? readFileSync(`${dir}/${file}`, 'utf8') : '';
{
  const w = RETENTION_WINDOWS;
  ok('D1 στην SQL', sql.includes(`a.day = p.day0 + ${w.d1.from}`) && sql.includes(`c.day0 + ${w.d1.to} < v_today`));
  ok('D7 στην SQL', sql.includes(`between p.day0 + ${w.d7.from} and p.day0 + ${w.d7.to}`) && sql.includes(`c.day0 + ${w.d7.to} < v_today`));
  ok('D30 στην SQL', sql.includes(`between p.day0 + ${w.d30.from} and p.day0 + ${w.d30.to}`) && sql.includes(`c.day0 + ${w.d30.to} < v_today`));
  ok('ο ορισμός στο σχόλιο λέει τα ίδια', sql.includes(`μέρες ${w.d30.from} έως ${w.d30.to}`) && sql.includes(`μέρες ${w.d7.from} έως ${w.d7.to}`));
  ok('ώρα Ελλάδας', (sql.match(/Europe\/Athens/g) ?? []).length >= 6);
}

// ── 2. ΚΛΕΙΣΤΗ ΣΤΟΝ ΠΕΡΙΗΓΗΤΗ, ΑΝΟΙΧΤΗ ΜΟΝΟ ΣΤΟΝ ΔΙΑΚΟΜΙΣΤΗ ────────────────
for (const f of ['metrics_weekly(integer)', 'metrics_snapshot()']) {
  ok(`${f}: revoke από public, anon, authenticated`, sql.includes(`revoke all on function public.${f} from public, anon, authenticated;`));
  ok(`${f}: μόνο service_role`, sql.includes(`grant execute on function public.${f} to service_role;`));
  const esc = f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  ok(`${f}: κανένα grant στον περιηγητή`, !new RegExp(`grant execute on function public\\.${esc} to (anon|authenticated)`).test(sql));
}
ok('security definer με καρφωμένο search_path', (sql.match(/security definer\s+set search_path = public, pg_temp/g) ?? []).length === 2);
ok('οι διαχειριστές βγαίνουν έξω', (sql.match(/join public\.app_admins a on lower\(a\.email\) = lower\(u\.email\)/g) ?? []).length === 2);
// Η έξοδος είναι πλήθη: καμία στήλη αποτελέσματος δεν είναι uuid, email ή κείμενο.
for (const m of sql.matchAll(/returns table \(([\s\S]*?)\)\s*language/g)) {
  const cols = m[1].split(',').map(s => s.trim().split(/\s+/));
  ok(`η έξοδος είναι μόνο ημερομηνία και ακέραιοι (${cols.map(c => c[0]).join(', ')})`, cols.every(([, t]) => t === 'integer' || t === 'date'));
}

// ── 3. ΑΝΑΓΝΩΣΗ ΑΠΟ ΤΗ ΒΑΣΗ ──────────────────────────────────────────────────
{
  const rows = parseWeeklyRows([
    { week_start: '2026-10-12', signups: 3, activated: 1, d1_eligible: 3, d1_active: 1, d7_eligible: 0, d7_active: 0, d30_eligible: 0, d30_active: 0, active_users: 4, scans: 2, new_paying: 0, email: 'x@y.gr' },
    { week_start: 'όχι ημερομηνία', signups: 9 },
    { week_start: '2026-10-05', signups: '2', activated: -1, d1_eligible: 1.5 },
    null,
  ]);
  ok('μόνο γραμμές με εβδομάδα', rows.length === 2);
  ok('καμία ξένη στήλη (email) δεν περνά', !('email' in rows[0]));
  ok('αριθμός από κείμενο διαβάζεται', rows[1].signups === 2);
  ok('αρνητικό ή δεκαδικό γίνεται 0', rows[1].activated === 0 && rows[1].d1_eligible === 0);
  ok('ό,τι λείπει γίνεται 0', rows[1].scans === 0);
  ok('μη πίνακας: κενό', parseWeeklyRows({ error: 'x' }).length === 0);
  const snap = parseSnapshot([{ users: 8, activated: 2, active_7d: 3, active_30d: 5, paying_now: 0 }]);
  ok('η στιγμή διαβάζεται', snap?.users === 8 && snap.paying_now === 0);
  ok('η στιγμή χωρίς γραμμή: null', parseSnapshot([]) === null);
}

// ── 4. ΠΟΣΟΣΤΑ ΚΑΙ ΠΙΝΑΚΑΣ ───────────────────────────────────────────────────
ok('κανείς μετρήσιμος: παύλα, όχι 0%', rate(0, 0) === '—');
ok('1 στους 2: 50%', rate(1, 2) === '1/2 · 50%');
ok('2 στους 3: στρογγυλό', rate(2, 3) === '2/3 · 67%');
{
  const rows = parseWeeklyRows([
    { week_start: '2026-10-12', signups: 1, activated: 0, d1_eligible: 1, d1_active: 0, d7_eligible: 0, d7_active: 0, d30_eligible: 0, d30_active: 0, active_users: 0, scans: 0, new_paying: 0 },
    { week_start: '2026-09-07', signups: 2, activated: 1, d1_eligible: 2, d1_active: 1, d7_eligible: 2, d7_active: 2, d30_eligible: 2, d30_active: 1, active_users: 2, scans: 1, new_paying: 0 },
  ]);
  const t = weeklyTable(rows);
  const lines = t.split('\n');
  ok('κεφαλίδα με όλες τις στήλες', COLUMNS.every(c => lines[0].includes(c)));
  ok('μία γραμμή ανά εβδομάδα', lines.length === 4);
  ok('η εβδομάδα με ελληνική γραφή', lines[2].startsWith('12/10/2026'));
  ok('D30 της παλιάς εβδομάδας', lines[3].includes('1/2 · 50%'));
  ok('η νέα εβδομάδα δεν δείχνει D30', /—/.test(lines[2]));
  const txt = reportText(rows, { users: 3, activated: 1, active_7d: 1, active_30d: 2, paying_now: 0 }, '20/10/2026');
  ok('η αναφορά έχει τη στιγμή', txt.includes('3 χρήστες') && txt.includes('0 πληρώνουν τώρα'));
  ok('η αναφορά λέει τα παράθυρα', txt.includes(`μέρες ${RETENTION_WINDOWS.d30.from} έως ${RETENTION_WINDOWS.d30.to}`));
  ok('η αναφορά αθροίζει την επιστροφή 30 ημερών', txt.includes('επιστροφή 30 ημερών 1/2 · 50%'));
  ok('κανένα «undefined» ή «NaN»', !/undefined|NaN/.test(txt));
  ok('κανένα @ (email) στην αναφορά', !txt.includes('@'));
}

// ── 5. ΧΩΡΙΣ ΜΕΤΑΒΛΗΤΕΣ ΔΕΝ ΜΕΤΡΙΕΤΑΙ ΤΙΠΟΤΑ ─────────────────────────────────
// Το scripts/metrics-report.ts βγαίνει με 2 «ΔΕΝ ΜΕΤΡΗΘΗΚΕ» όταν λείπουν. Κανένα
// κλειδί δεν τυπώνεται: το μήνυμα λέει ΠΟΙΑ μεταβλητή λείπει, όχι την τιμή της.
async function source() {
  const why = metricsUnavailable({});
  ok('κενό περιβάλλον: λέει τι λείπει', why.length > 0 && why.includes(URL_ENV) && why.includes(SERVICE_KEY_ENV));
  ok('πλήρες περιβάλλον: τίποτα δεν λείπει', metricsUnavailable({ [URL_ENV]: 'https://x.supabase.co', [SERVICE_KEY_ENV]: 'κλειδί-δοκιμής' }) === '');
  let threw = '';
  try { await loadMetrics(4, {}); } catch (e) { threw = e instanceof Error ? e.message : String(e); }
  ok('η ανάγνωση χωρίς μεταβλητές πετά πριν από κάθε κλήση', threw.includes('δεν δημιουργήθηκε'));
}

source().catch(err => { fail++; console.error('✗ η ανάγνωση έριξε απρόσμενο σφάλμα:', err) }).finally(() => {
  console.log(fail === 0 ? `✓ metrics/weekly: ${pass} έλεγχοι πέρασαν` : `✗ metrics/weekly: ${fail} απέτυχαν από ${pass + fail}`);
  if (fail > 0) process.exit(1);
});
