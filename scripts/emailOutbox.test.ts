// npx tsx scripts/emailOutbox.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// Η ΟΥΡΑ ΤΩΝ EMAIL ΔΕΝ ΓΡΑΦΕΙ «ΣΤΑΛΘΗΚΕ» ΠΡΙΝ ΤΟ ΜΑΘΕΙ
// ─────────────────────────────────────────────────────────────────────────
// Ως 10/11/2026 η drain_email_outbox έκανε `perform net.http_post` και αμέσως
// `status = 'sent'`. Κάθε 500, 502 και κάθε «skipped» της send-lifecycle-email
// καταγραφόταν ως αποστολή. Η δοκιμή διαβάζει τον ΤΕΛΕΥΤΑΙΟ ορισμό κάθε
// συνάρτησης στα migrations, γιατί αυτόν έχει η βάση: ένα μελλοντικό migration
// που ξαναγράφει τη drain με το παλιό μοτίβο κοκκινίζει εδώ.
// ═══════════════════════════════════════════════════════════════════════════
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { projectRef, outboxIdempotencyKey, resendErrorName } from '../supabase/functions/_shared/outboxKey';
import { outboxVerdict, OUTBOX_LIMITS } from '../supabase/functions/_shared/outboxHealth';

const DIR = 'supabase/migrations';
let pass = 0; const fails: string[] = [];
const ok = (n: string, c: boolean) => { if (c) pass++; else fails.push(n); };

/** Το σώμα του τελευταίου `create … function <schema>.<name>` στα migrations. */
function latest(name: string, schema = 'public'): string {
  let body = '';
  for (const f of readdirSync(DIR).filter(x => x.endsWith('.sql')).sort()) {
    const src = readFileSync(join(DIR, f), 'utf8');
    const re = new RegExp(`create\\s+(?:or\\s+replace\\s+)?function\\s+"?${schema}"?\\."?${name}"?\\s*\\(`, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      const tag = /\$[a-z_]*\$/i.exec(src.slice(m.index));
      if (!tag) continue;
      const a = src.indexOf(tag[0], m.index);
      const b = src.indexOf(tag[0], a + tag[0].length);
      body = src.slice(a, b === -1 ? undefined : b);
    }
  }
  return body;
}

const drain = latest('drain_email_outbox');
ok('η drain υπάρχει', drain.length > 0);
ok('η drain κρατά το αναγνωριστικό του αιτήματος', /:=\s*net\.http_post/i.test(drain) && /request_id\s*=/.test(drain));
ok("η drain γράφει 'dispatched', όχι 'sent'", /status\s*=\s*'dispatched'/.test(drain) && !/status\s*=\s*'sent'/.test(drain));
ok('χωρίς μυστικό σηκώνει σφάλμα αντί για σιωπηλό 0', /v_secret is null then\s*raise exception/i.test(drain));

ok('η drain περνά το outboxId στη function', /'outboxId',\s*r\.id/.test(drain));
ok('η drain δίνει 30″ στο pg_net', /timeout_milliseconds\s*:=\s*30000/.test(drain));

const fn = readFileSync('supabase/functions/send-lifecycle-email/index.ts', 'utf8');
ok('η function στέλνει Idempotency-Key με περιβάλλον, γραμμή και γενιά', /'Idempotency-Key':\s*outboxIdempotencyKey\(PROJECT_REF,\s*outboxId,\s*outboxGen\)/.test(fn));
ok('το περιβάλλον βγαίνει από το SUPABASE_URL', /PROJECT_REF\s*=\s*projectRef\(SUPABASE_URL\)/.test(fn));
ok('το staging και η παραγωγή δεν μοιράζονται κλειδί',
  outboxIdempotencyKey(projectRef('https://abcd1234.supabase.co'), '42', 0) !== outboxIdempotencyKey(projectRef('https://wxyz9876.supabase.co'), '42', 0));
ok('το κλειδί έχει τη μορφή outbox-<ref>-<id>-<γενιά>', outboxIdempotencyKey(projectRef('https://abcd1234.supabase.co'), '42', 2) === 'outbox-abcd1234-42-2');
ok('ο κωδικός 409 του Resend διαβάζεται', resendErrorName('{"statusCode":409,"name":"invalid_idempotent_request"}') === 'invalid_idempotent_request' && resendErrorName('όχι json') === '');
ok('η function περνά τον κωδικό του 409', /resendCode:\s*resendErrorName\(/.test(fn));
ok('η σίγουρη αποτυχία του Resend σημαδεύεται definite', /error: 'send_failed', definite: true/.test(fn));
ok('το σφάλμα δικτύου ΔΕΝ σημαδεύεται definite', /error: 'send_error'(?![^}]*definite)/.test(fn));
ok('η function δέχεται μόνο αριθμητικό outboxId', /\^\\d\{1,19\}\$/.test(fn));
ok('το 409 του Resend φτάνει ως 409', /res\.status === 409/.test(fn));

const rec = latest('reconcile_email_outbox');
ok('το 409 γράφεται probably_sent, όχι failed', /status_code = 409 then\s*(--[^\n]*\n\s*)*update public\.email_outbox\s*set status = 'probably_sent'/.test(rec));
ok('το 409 concurrent ξαναπροσπαθεί με το ίδιο κλειδί', /concurrent_idempotent_requests' and v_same then\s*(--[^\n]*\n\s*)*update public\.email_outbox\s*set status = 'pending'(?![^;]*idem_gen)/.test(rec));
ok('η σίγουρη αποτυχία αλλάζει γενιά κλειδιού', /->>'definite'[^;]*then\s*(--[^\n]*\n\s*)*update public\.email_outbox[^;]*idem_gen = idem_gen \+ 1/.test(rec));
ok('νέα γενιά ΜΟΝΟ αν καμία προσπάθεια της γενιάς δεν ήταν αβέβαιη', /'true' and not r\.idem_uncertain then\s*(--[^\n]*\n\s*)*update public\.email_outbox[^;]*idem_gen = idem_gen \+ 1/.test(rec)
  && (rec.match(/idem_gen = idem_gen \+ 1/g) || []).length === 1);
ok('η αβέβαιη έκβαση σηκώνει τη σημαία', /'response_lost:retry'/.test(rec) && /idem_uncertain = true, last_error = 'response_lost:retry'/.test(rec)
  && /idem_uncertain = true, last_error = v_why/.test(rec) && /idem_uncertain = true, last_error = 'response_lost'\s/.test(rec));
ok('οι επαναλήψεις έχουν τυχαίο μέρος στην καθυστέρηση', /v_jitter\s*:=\s*make_interval\(secs => floor\(random\(\)/.test(rec)
  && (rec.match(/make_interval\(mins => 15 \* r\.attempts\) \+ v_jitter/g) || []).length === 3);
ok('η drain δεν στέλνει με το ίδιο κλειδί έξω από το παράθυρο', /if r\.idem_uncertain and [^\n]*< now\(\) - interval '20 hours' then\s*update public\.email_outbox set status = 'failed', last_error = 'idempotency_window'/.test(drain));
ok('η drain δεν κόβει με το όριο την επανάληψη ίδιου κλειδιού', /'marketing' and not r\.idem_uncertain and not public\.can_send_marketing/.test(drain));
ok('η drain περνά τη γενιά του κλειδιού', /'outboxGen',\s*r\.idem_gen/.test(drain));
ok('η drain κρατά την ώρα της πρώτης αποστολής με το κλειδί', /idem_since = coalesce\(idem_since, now\(\)\)/.test(drain));
const win = /v_window\s+constant\s+interval\s*:=\s*interval\s*'(\d+) hours'/.exec(rec);
ok('το παράθυρο του ίδιου κλειδιού είναι κάτω από τις 24 ώρες του Resend', !!win && Number(win[1]) < 24);
ok('η χαμένη απάντηση ξαναπροσπαθεί με το ίδιο κλειδί μέσα στο παράθυρο', /if v_same then\s*update public\.email_outbox\s*set status = 'pending'[^;]*'response_lost:retry'/.test(rec));
const upd = rec.match(/update public\.email_outbox[\s\S]*?;/g) || [];
ok('κάθε ενημέρωση της reconcile ρωτά ξανά αν η γραμμή είναι ακόμη dispatched', upd.length > 0 && upd.every(u => /status = 'dispatched'\s*;$/.test(u)));
const withdraw = latest('accountant_invite_withdraw');
ok('η απόσυρση πρόσκλησης ακυρώνει και τα dispatched', /status in \('pending', 'dispatched'\)/.test(withdraw));
const forget = latest('accountant_invites_forget_email', 'private');
ok('η διαγραφή αποστολέα ακυρώνει και τα dispatched', /status in \('pending', 'dispatched'\)/.test(forget));
const health = latest('email_outbox_health');
ok('η παρακολούθηση της ουράς υπάρχει', /group by o\.status/.test(health));
ok('η reconcile υπάρχει', rec.length > 0);
ok('διαβάζει το net._http_response', /net\._http_response/.test(rec));
ok("200 με sent:true γίνεται 'sent'", /'sent'/.test(rec) && /->>'sent'/.test(rec));
ok("το skipped κρατά τον λόγο", /'skipped:'/.test(rec));
ok('έχει όριο προσπαθειών', /v_max\s+constant\s+int\s*:=\s*\d+/.test(rec));
ok('χωρίς απάντηση δεν ξαναστέλνει', /response_lost/.test(rec));

const cap = latest('can_send_marketing');
ok('το όριο μάρκετινγκ μετρά και τα dispatched', /'dispatched'/.test(cap));
ok('το όριο μάρκετινγκ μετρά και τα probably_sent', /'probably_sent'/.test(cap));
ok('το όριο μάρκετινγκ μετρά και όσα ίσως έφυγαν', /idem_uncertain and status in \('pending', 'failed', 'expired'\)/.test(cap));

// ── Η παρακολούθηση: το health-check διαβάζει την ουρά ───────────────────
const hc = readFileSync('supabase/functions/health-check/index.ts', 'utf8');
ok('το health-check διαβάζει την email_outbox_health', /rpc\('email_outbox_health'\)/.test(hc));
ok('το health-check απαντά email_ok δίπλα στο ok', /email_ok:\s*email\.ok/.test(hc) && /return json\(\{ ok, feeds_ok/.test(hc));
ok('ήσυχη ουρά: εντάξει', outboxVerdict([{ status: 'sent', n: 120 }, { status: 'failed', n: 1 }], null).ok);
ok('failed πάνω από το κατώφλι: όχι εντάξει', !outboxVerdict([{ status: 'failed', n: OUTBOX_LIMITS.failed }], null).ok);
ok('probably_sent πάνω από το κατώφλι: όχι εντάξει', !outboxVerdict([{ status: 'probably_sent', n: OUTBOX_LIMITS.probably_sent }], null).ok);
ok('σφάλμα ανάγνωσης: όχι εντάξει', !outboxVerdict(null, { message: 'x' }).ok);

const all = readdirSync(DIR).filter(x => x.endsWith('.sql')).map(f => readFileSync(join(DIR, f), 'utf8')).join('\n');
ok('η reconcile τρέχει από cron', /cron\.schedule\('email-outbox-reconcile'/.test(all));

if (fails.length) { console.error(`✗ ουρά email: ${fails.length} αποτυχίες\n  ${fails.join('\n  ')}`); process.exit(1); }
console.log(`✓ ουρά email: ${pass} έλεγχοι πέρασαν`);
