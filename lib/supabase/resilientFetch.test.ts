// npx tsx lib/supabase/resilientFetch.test.ts
//
// ΜΙΑ ΕΠΑΝΑΛΗΨΗ, ΜΟΝΟ ΓΙΑ ΑΝΑΓΝΩΣΗ, ΜΟΝΟ ΣΕ ΚΟΜΜΕΝΗ ΣΥΝΔΕΣΗ. Τρία «fetch failed»
// με UND_ERR_SOCKET στο / και στο /terms.rsc (21–27/10/2026): νεκρή σύνδεση
// keep-alive προς το *.supabase.co. Εδώ κλειδώνει ότι το GET ξαναδοκιμάζεται
// μία φορά, ενώ το POST και η απάντηση 5xx δεν ξαναστέλνονται ποτέ.
import { readFileSync } from 'node:fs';
import { withConnectionRetry, isDeadConnection } from './resilientFetch';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra = '') => {
  if (cond) pass++; else { fail++; console.error(`✗ ${name}${extra ? ` (${extra})` : ''}`); }
};

const socketError = (code = 'UND_ERR_SOCKET') => {
  const cause = Object.assign(new Error('other side closed'), { code });
  return new TypeError('fetch failed', { cause });
};

/** Ψεύτικο fetch: παίζει τη σειρά απαντήσεων και μετρά τις κλήσεις. */
function script(...steps: Array<Error | Response>) {
  let calls = 0;
  const f = (async () => {
    const s = steps[Math.min(calls++, steps.length - 1)];
    if (s instanceof Error) throw s;
    return s;
  }) as typeof fetch;
  return { f, calls: () => calls };
}

const URL_USER = 'https://x.supabase.co/auth/v1/user';

async function main() {
  // 1. GET με UND_ERR_SOCKET: μία επανάληψη που επιστρέφει τη δεύτερη απάντηση.
  {
    const s = script(socketError(), new Response('{"id":"u"}', { status: 200 }));
    const res = await withConnectionRetry(s.f)(URL_USER, { method: 'GET' });
    ok('GET + UND_ERR_SOCKET: δύο κλήσεις', s.calls() === 2, String(s.calls()));
    ok('GET + UND_ERR_SOCKET: επιστρέφει την απάντηση της δεύτερης', res.status === 200);
  }
  // Χωρίς method σημαίνει GET (έτσι καλεί το auth-js το /user).
  {
    const s = script(socketError('ECONNRESET'), new Response('ok'));
    await withConnectionRetry(s.f)(URL_USER);
    ok('χωρίς method + ECONNRESET: μία επανάληψη', s.calls() === 2, String(s.calls()));
  }
  // Μόνο ΜΙΑ: αν αποτύχει και η δεύτερη, το σφάλμα ανεβαίνει.
  {
    const s = script(socketError(), socketError());
    let threw = false;
    try { await withConnectionRetry(s.f)(URL_USER, { method: 'HEAD' }); } catch (e) { threw = isDeadConnection(e); }
    ok('δεύτερη αποτυχία: πετά και δεν ξαναδοκιμάζει', threw && s.calls() === 2, String(s.calls()));
  }

  // 2. POST (και RPC, που είναι POST): καμία επανάληψη.
  for (const method of ['POST', 'PATCH', 'PUT', 'DELETE', 'post']) {
    const s = script(socketError(), new Response('ok'));
    let threw = false;
    try { await withConnectionRetry(s.f)('https://x.supabase.co/rest/v1/rpc/f', { method, body: '{}' }); } catch { threw = true; }
    ok(`${method}: καμία επανάληψη`, threw && s.calls() === 1, String(s.calls()));
  }
  {
    const s = script(socketError(), new Response('ok'));
    let threw = false;
    try { await withConnectionRetry(s.f)(new Request('https://x.supabase.co/rest/v1/t', { method: 'POST', body: '{}' })); } catch { threw = true; }
    ok('Request με POST: καμία επανάληψη', threw && s.calls() === 1, String(s.calls()));
  }

  // 3. HTTP 5xx είναι απάντηση, όχι κομμένη σύνδεση: επιστρέφεται όπως ήρθε.
  {
    const s = script(new Response('bad gateway', { status: 502 }), new Response('ok'));
    const res = await withConnectionRetry(s.f)(URL_USER, { method: 'GET' });
    ok('GET + 502: μία κλήση, επιστρέφει το 502', s.calls() === 1 && res.status === 502, `${s.calls()} ${res.status}`);
  }

  // Αλλα σφάλματα: όχι επανάληψη.
  {
    const s = script(socketError('ENOTFOUND'), new Response('ok'));
    let threw = false;
    try { await withConnectionRetry(s.f)(URL_USER); } catch { threw = true; }
    ok('άγνωστος κωδικός (ENOTFOUND): καμία επανάληψη', threw && s.calls() === 1);
  }
  {
    const ac = new AbortController(); ac.abort();
    const s = script(socketError(), new Response('ok'));
    let threw = false;
    try { await withConnectionRetry(s.f)(URL_USER, { signal: ac.signal }); } catch { threw = true; }
    ok('ακυρωμένο αίτημα: καμία επανάληψη', threw && s.calls() === 1);
  }
  ok('Error χωρίς TypeError δεν είναι νεκρή σύνδεση', !isDeadConnection(Object.assign(new Error('fetch failed'), { cause: { code: 'UND_ERR_SOCKET' } })));

  // Οι δύο πελάτες του διακομιστή το χρησιμοποιούν.
  for (const f of ['lib/supabase/server.ts', 'proxy.ts']) {
    ok(`${f}: global.fetch = resilientFetch`, /global:\s*\{\s*fetch:\s*resilientFetch\s*\}/.test(readFileSync(f, 'utf8')));
  }

  console.log(fail ? `✗ resilientFetch: ${fail} απέτυχαν από ${pass + fail}` : `✓ resilientFetch: ${pass} έλεγχοι πέρασαν`);
  if (fail) process.exit(1);
}

main();
