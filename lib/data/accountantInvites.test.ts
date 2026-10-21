// npx tsx lib/data/accountantInvites.test.ts
//
// Η λίστα του λογιστή έρχεται από όπου έρχεται: επικόλληση από Excel, CSV του
// λογιστικού προγράμματος, «Όνομα <διεύθυνση>» από το ταχυδρομείο. Κρατιέται ό,τι
// μοιάζει με διεύθυνση· τα διπλά και τα άκυρα τα λέει η βάση γραμμή γραμμή.
import type { SupabaseClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'node:fs';
import { parseEmailList, uniqueCount, INVITE_STATUS_LABEL, INVITE_BATCH, INVITE_LIMITS, invitesLeft, allowanceLine, refusalOf, inviteSender, withdrawInvite, inviteClients } from './accountantInvites';

let pass = 0, fail = 0;
function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) pass++; else { fail++; console.error(`✗ ${name}\n   got  ${g}\n   want ${w}`); }
}

eq('μία ανά γραμμή', parseEmailList('a@x.gr\nb@y.gr\r\n\nc@z.gr'), ['a@x.gr', 'b@y.gr', 'c@z.gr']);
eq('κόμμα και ερωτηματικό', parseEmailList('a@x.gr, b@y.gr;c@z.gr'), ['a@x.gr', 'b@y.gr', 'c@z.gr']);
eq('CSV με ΑΦΜ και όνομα: μόνο η διεύθυνση', parseEmailList('ΑΦΜ;Όνομα;Email\n094014201;Γ. Παπαδόπουλος;gp@x.gr\n123456783;"Μ. Ιωάννου";mi@y.gr'), ['gp@x.gr', 'mi@y.gr']);
eq('«Όνομα <διεύθυνση>» και mailto:', parseEmailList('Γιώργος <g@x.gr>, mailto:m@y.gr.'), ['g@x.gr', 'm@y.gr']);
eq('τα διπλά μένουν, τα κρίνει η βάση', parseEmailList('a@x.gr A@X.gr'), ['a@x.gr', 'A@X.gr']);
eq('μοναδικές χωρίς διάκριση πεζών', uniqueCount(['a@x.gr', 'A@X.gr', 'b@x.gr']), 2);
eq('άδειο', parseEmailList(''), []);
eq('κάθε κατάσταση έχει λόγια', Object.values(INVITE_STATUS_LABEL).every(s => s.length > 3), true);
eq('το όριο ανά λίστα στο κείμενο', INVITE_STATUS_LABEL.over_limit.includes(String(INVITE_BATCH)), true);

// ── ΠΟΙΟΣ ΡΩΤΑ: Η ΔΙΕΥΘΥΝΣΗ, ΟΧΙ ΤΟ ΟΝΟΜΑ (έλεγχος 21/10/2026, εύρημα A) ────
eq('η διεύθυνση πρώτα, το όνομα ως «δηλώνει»', inviteSender({ name: 'ΑΑΔΕ', email: 'x@y.gr' }), { who: 'x@y.gr', claimed: 'ΑΑΔΕ' });
eq('χωρίς όνομα', inviteSender({ name: '', email: 'x@y.gr' }), { who: 'x@y.gr', claimed: '' });
eq('όνομα ίδιο με τη διεύθυνση: όχι δύο φορές', inviteSender({ name: 'X@y.gr', email: 'x@y.gr' }), { who: 'x@y.gr', claimed: '' });

// ── Η ΑΡΝΗΣΗ ΕΧΕΙ ΟΝΟΜΑ ─────────────────────────────────────────────────────
eq('plan_required → πακέτο', refusalOf({ message: 'plan_required', code: '42501' }), 'plan');
eq('email_unverified → διεύθυνση', refusalOf({ message: 'email_unverified', code: '42501' }), 'unverified');
eq('άλλο → σφάλμα', refusalOf({ message: 'timeout' }), 'error');

// ── ΤΑ ΟΡΙΑ ΤΗΣ ΟΘΟΝΗΣ ΕΙΝΑΙ ΤΑ ΟΡΙΑ ΤΗΣ ΒΑΣΗΣ ──────────────────────────────
// Η τελευταία μετάβαση που ορίζει τη `send_quota_rule` είναι η ισχύουσα.
{
  const dir = 'supabase/migrations';
  const head = 'create or replace function public.send_quota_rule';
  const file = readdirSync(dir).filter(f => f.endsWith('.sql')).sort().reverse()
    .find(f => readFileSync(`${dir}/${f}`, 'utf8').includes(head));
  const sql = file ? readFileSync(`${dir}/${file}`, 'utf8') : '';
  const body = sql.slice(sql.indexOf(head), sql.indexOf('$$;', sql.indexOf(head)));
  const rule = (kind: string) => Number(new RegExp(`\\('${kind}',\\s*(\\d+),`).exec(body)?.[1]);
  eq('όριο επαγγελματία: ίδιο με τη βάση', rule('accountant_invite'), INVITE_LIMITS.paidPerDay);
  eq('όριο ημέρας στη δοκιμή: ίδιο με τη βάση', rule('accountant_invite_trial_day'), INVITE_LIMITS.trialPerDay);
  eq('όριο δοκιμής συνολικά: ίδιο με τη βάση', rule('accountant_invite_trial_total'), INVITE_LIMITS.trialTotal);
}

// ── ΠΟΣΑ ΕΜΕΙΝΑΝ ─────────────────────────────────────────────────────────────
eq('δοκιμή: η μικρότερη από ημέρα και σύνολο', invitesLeft({ mode: 'trial', perDay: 10, usedToday: 3, total: 25, usedTotal: 20 }), 5);
eq('δοκιμή: ημέρα γεμάτη', invitesLeft({ mode: 'trial', perDay: 10, usedToday: 10, total: 25, usedTotal: 10 }), 0);
eq('επαγγελματίας: μόνο η ημέρα', invitesLeft({ mode: 'paid', perDay: 50, usedToday: 12, total: null, usedTotal: null }), 38);
eq('χωρίς τρόπο: τίποτα', invitesLeft({ mode: null, perDay: null, usedToday: 0, total: null, usedTotal: null }), 0);
eq('η γραμμή της δοκιμής λέει όρια και υπόλοιπο',
  allowanceLine({ mode: 'trial', perDay: 10, usedToday: 3, total: 25, usedTotal: 20 }),
  'Στη δοκιμή: έως 10 προσκλήσεις τη μέρα και 25 συνολικά. Απομένουν 7 σήμερα και 5 συνολικά, άρα μπορείς να στείλεις ακόμη 5.');

async function asyncChecks() {
  // Η ΑΠΟΣΥΡΣΗ ΠΕΡΝΑ ΑΠΟ ΤΗ ΣΥΝΑΡΤΗΣΗ, ΠΟΤΕ ΑΠΟ ΔΙΑΓΡΑΦΗ (εύρημα B). Η απευθείας
  // διαγραφή έσβηνε και το «όχι» του πελάτη.
  const calls: string[] = [];
  const db = {
    rpc: async (fn: string, args: unknown) => { calls.push(`rpc:${fn}:${JSON.stringify(args)}`); return fn === 'accountant_invite_withdraw' ? { data: { ok: true }, error: null } : { data: null, error: { message: 'plan_required' } }; },
    from: (t: string) => { calls.push(`from:${t}`); return { delete: () => ({ eq: async () => ({ error: null }) }) }; },
  } as unknown as SupabaseClient;
  eq('απόσυρση: πέτυχε', await withdrawInvite(db, 'i1'), true);
  eq('απόσυρση: μόνο η συνάρτηση, κανένα DELETE', calls, ['rpc:accountant_invite_withdraw:{"p_id":"i1"}']);
  const r = await inviteClients(db, ['a@x.gr']);
  eq('αποστολή χωρίς πακέτο: λέει γιατί', [r.failed, r.refusal], [true, 'plan']);
}

asyncChecks().then(() => {
  console.log(fail === 0 ? `✓ accountantInvites: ${pass} έλεγχοι πέρασαν` : `✗ accountantInvites: ${fail} απέτυχαν από ${pass + fail}`);
  if (fail > 0) process.exit(1);
});
