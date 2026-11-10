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

const DIR = 'supabase/migrations';
let pass = 0; const fails: string[] = [];
const ok = (n: string, c: boolean) => { if (c) pass++; else fails.push(n); };

/** Το σώμα του τελευταίου `create … function public.<name>` στα migrations. */
function latest(name: string): string {
  let body = '';
  for (const f of readdirSync(DIR).filter(x => x.endsWith('.sql')).sort()) {
    const src = readFileSync(join(DIR, f), 'utf8');
    const re = new RegExp(`create\\s+(?:or\\s+replace\\s+)?function\\s+"?public"?\\."?${name}"?\\s*\\(`, 'gi');
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
ok('η function στέλνει Idempotency-Key ανά γραμμή της ουράς', /'Idempotency-Key':\s*`outbox-\$\{outboxId\}`/.test(fn));
ok('η function δέχεται μόνο αριθμητικό outboxId', /\^\\d\{1,19\}\$/.test(fn));
ok('το 409 του Resend φτάνει ως 409', /res\.status === 409/.test(fn));

const rec = latest('reconcile_email_outbox');
ok('το 409 γράφεται failed χωρίς επανάληψη', /status_code = 409 then\s*(--[^\n]*\n\s*)*update public\.email_outbox\s*set status = 'failed'/.test(rec));
ok('η reconcile υπάρχει', rec.length > 0);
ok('διαβάζει το net._http_response', /net\._http_response/.test(rec));
ok("200 με sent:true γίνεται 'sent'", /'sent'/.test(rec) && /->>'sent'/.test(rec));
ok("το skipped κρατά τον λόγο", /'skipped:'/.test(rec));
ok('έχει όριο προσπαθειών', /v_max\s+constant\s+int\s*:=\s*\d+/.test(rec));
ok('χωρίς απάντηση δεν ξαναστέλνει', /response_lost/.test(rec));

const cap = latest('can_send_marketing');
ok('το όριο μάρκετινγκ μετρά και τα dispatched', /'dispatched'/.test(cap));

const all = readdirSync(DIR).filter(x => x.endsWith('.sql')).map(f => readFileSync(join(DIR, f), 'utf8')).join('\n');
ok('η reconcile τρέχει από cron', /cron\.schedule\('email-outbox-reconcile'/.test(all));

if (fails.length) { console.error(`✗ ουρά email: ${fails.length} αποτυχίες\n  ${fails.join('\n  ')}`); process.exit(1); }
console.log(`✓ ουρά email: ${pass} έλεγχοι πέρασαν`);
