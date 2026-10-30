// npx tsx lib/metrics/funnel.test.ts
//
// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΧΩΝΙ ΤΩΝ ΠΕΝΤΕ ΒΗΜΑΤΩΝ: ΑΝΑΓΝΩΣΗ, ΠΟΣΟΣΤΑ, ΠΙΝΑΚΑΣ, ΜΕΤΑΝΑΣΤΕΥΣΗ
// ─────────────────────────────────────────────────────────────────────────
// Κλειδώνει ότι από τη βάση περνούν μόνο πλήθη, ότι το ποσοστό είναι από το
// προηγούμενο βήμα, ότι το μηδέν δεν γίνεται 0% και ότι η συνάρτηση της βάσης
// δίνει ακριβώς τις στήλες που διαβάζει η αναφορά, κλειστή στον περιηγητή.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync } from 'node:fs';
import { FUNNEL_STEPS, parseFunnelRows, funnelTotals, stepRate, biggestDrop, funnelTable, funnelText } from './funnel';
import { PRODUCT_EVENTS, PAID_VIA, paidProps } from '../analytics/events';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n) } };

// ── 1. Η ΜΕΤΑΝΑΣΤΕΥΣΗ ──────────────────────────────────────────────────────
const dir = 'supabase/migrations';
const file = readdirSync(dir).find(f => f.startsWith('20261031100000_'));
ok('υπάρχει η μετανάστευση του χωνιού', !!file);
const sql = file ? readFileSync(`${dir}/${file}`, 'utf8') : '';
{
  const ret = sql.match(/returns table \(([\s\S]*?)\)\s*language/)?.[1] ?? '';
  const cols = ret.split(',').map(c => c.trim().split(/\s+/)[0]).filter(Boolean);
  ok('οι στήλες της βάσης είναι τα βήματα του πίνακα', JSON.stringify(cols) === JSON.stringify(['week_start', ...FUNNEL_STEPS.map(s => s.key)]));
  ok('κλειστή στον περιηγητή', /revoke all on function public\.metrics_funnel\(integer\) from public, anon, authenticated/.test(sql));
  ok('ανοιχτή μόνο στον service_role', /grant execute on function public\.metrics_funnel\(integer\) to service_role/.test(sql));
  ok('έξω οι λογαριασμοί του app_admins', sql.includes('public.app_admins'));
  ok('ώρα Ελλάδας', (sql.match(/Europe\/Athens/g) ?? []).length >= 3);
  ok('το «Πλήρωσα» διαβάζει το γεγονός που γράφει η εφαρμογή', sql.includes(`e.event = '${PRODUCT_EVENTS.paid_marked}'`));
  ok('η επίσκεψη είναι το βήμα view του signup_funnel', sql.includes("f.step = 'view'"));
}

// ── 2. ΤΟ ΓΕΓΟΝΟΣ ──────────────────────────────────────────────────────────
ok('το όνομα περνά τον έλεγχο της log_event', /^[a-z][a-z0-9_]{2,47}$/.test(PRODUCT_EVENTS.paid_marked));
ok('φορτίο: μόνο η αφετηρία', JSON.stringify(paidProps('reminder')) === '{"via":"reminder"}' && JSON.stringify(paidProps('app')) === '{"via":"app"}');
ok('άγνωστη αφετηρία γίνεται app', paidProps('x' as unknown as (typeof PAID_VIA)[number]).via === 'app');
{
  const redeem = readFileSync('lib/reminders/payRedeem.ts', 'utf8');
  ok('το «Πλήρωσα» της υπενθύμισης γράφεται από τον διακομιστή', redeem.includes("rpc('log_event_for'") && redeem.includes('PRODUCT_EVENTS.paid_marked') && redeem.includes("paidProps('reminder')"));
  const cal = readFileSync('app/dashboard/components/TabCalendar.tsx', 'utf8');
  ok('το «Πλήρωσα» της εφαρμογής γράφεται σε όλα τα σημεία', (cal.match(/PRODUCT_EVENTS\.paid_marked, paidProps\('app'\)/g) ?? []).length === 3);
}

// ── 3. ΑΝΑΓΝΩΣΗ ────────────────────────────────────────────────────────────
{
  const rows = parseFunnelRows([
    { week_start: '2026-10-26', visits: 40, signups: 5, with_property: 3, reminded: 2, paid_marked: 1, email: 'x@y.gr' },
    { week_start: 'όχι', visits: 1 },
    { week_start: '2026-10-19', visits: '12', signups: -3, with_property: 1.5, reminded: null, paid_marked: 0 },
    null,
  ]);
  ok('μόνο γραμμές με ημερομηνία', rows.length === 2);
  ok('κανένα πεδίο εκτός από τα βήματα', !('email' in rows[0]) && Object.keys(rows[0]).length === 1 + FUNNEL_STEPS.length);
  ok('αριθμός-κείμενο διαβάζεται', rows[1].visits === 12);
  ok('αρνητικό, δεκαδικό και κενό γίνονται 0', rows[1].signups === 0 && rows[1].with_property === 0 && rows[1].reminded === 0);
  ok('όχι πίνακας → κενό', parseFunnelRows({}).length === 0);
  const t = funnelTotals(rows);
  ok('σύνολα', t.visits === 52 && t.signups === 5 && t.with_property === 3 && t.paid_marked === 1);
}

// ── 4. ΠΟΣΟΣΤΑ ΚΑΙ ΑΠΩΛΕΙΑ ─────────────────────────────────────────────────
ok('ποσοστό από το προηγούμενο', stepRate(3, 5) === '60%');
ok('μηδέν πριν → παύλα, όχι 0%', stepRate(0, 0) === '—');
ok('η μεγαλύτερη απώλεια', biggestDrop({ visits: 100, signups: 10, with_property: 8, reminded: 2, paid_marked: 1 }) === 'από «Ακίνητο» σε «Υπενθύμιση»');
ok('η επίσκεψη δεν συγκρίνεται με λογαριασμούς', biggestDrop({ visits: 1000, signups: 10, with_property: 9, reminded: 9, paid_marked: 8 }) === 'από «Εγγραφές» σε «Ακίνητο»');
ok('χωρίς εγγραφές, καμία απώλεια', biggestDrop({ visits: 30, signups: 0, with_property: 0, reminded: 0, paid_marked: 0 }) === '');

// ── 5. ΠΙΝΑΚΑΣ ─────────────────────────────────────────────────────────────
{
  const rows = parseFunnelRows([{ week_start: '2026-10-26', visits: 40, signups: 5, with_property: 3, reminded: 2, paid_marked: 1 }]);
  const tab = funnelTable(rows);
  ok('ελληνική ημερομηνία', tab.includes('26/10/2026'));
  ok('όλα τα βήματα στην κεφαλίδα', FUNNEL_STEPS.every(s => tab.split('\n')[0].includes(s.label)));
  ok('ποσοστό δίπλα στο πλήθος', tab.includes('3 (60%)') && tab.includes('1 (50%)'));
  ok('γραμμή συνόλου', /\nΣύνολο\s/.test(tab));
  const text = funnelText(rows);
  ok('λέει πού χάνονται', text.includes('Οι περισσότεροι χάνονται από «Εγγραφές» σε «Ακίνητο».'));
  ok('ορισμοί στην αναφορά', text.includes('από το ΠΡΟΗΓΟΥΜΕΝΟ βήμα') && text.includes('Vercel Analytics'));
  ok('άδειο διάστημα', funnelText([]).includes('Καμία εγγραφή ακόμη'));
}

console.log(`funnel: ${pass} ✓, ${fail} ✗`);
if (fail) process.exit(1);
