// npx tsx lib/inbound/replyAck.test.ts
//
// ═══════════════════════════════════════════════════════════════════════════
// Η ΑΠΟΦΑΣΗ ΤΗΣ ΑΥΤΟΜΑΤΗΣ ΕΠΙΒΕΒΑΙΩΣΗΣ, ΜΕ ΨΕΥΤΙΚΗ ΒΑΣΗ ΚΑΙ ΨΕΥΤΙΚΟ ΑΠΟΣΤΟΛΕΑ
// ─────────────────────────────────────────────────────────────────────────
// Η καθαρή λογική της διαδρομής reply_ack ζει στο handleReplyAck και δοκιμάζεται
// εδώ, όπως ακριβώς η anthropicRoute δοκιμάζει τη δική της καθαρή λογική μακριά
// από το next/server. Το κάτω μέρος του αρχείου φυλάει, με ανάγνωση της πηγής,
// ότι η διαδρομή είναι σωστά συνδεδεμένη με αυτή τη λογική.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { handleReplyAck } from './replyAck';
import type { AckInput, AckResult } from './sendAck';

let p = 0, f = 0;
const ok = (c: boolean, m: string) => { if (c) p++; else { f++; console.error('✗', m); } };

type RpcCall = { fn: string; args: Record<string, unknown> };

/** Μια βάση που απαντά ό,τι της πούμε στις δύο RPC και θυμάται πώς κλήθηκε. */
function fakeDb(opts: {
  ack?: boolean; ackError?: string;
  name?: unknown; nameError?: string;
} = {}) {
  const calls: RpcCall[] = [];
  const db = {
    rpc(fn: string, args: Record<string, unknown>) {
      calls.push({ fn, args });
      if (fn === 'try_support_ack') {
        return Promise.resolve({
          data: opts.ackError ? null : (opts.ack ?? false),
          error: opts.ackError ? { message: opts.ackError } : null,
        });
      }
      if (fn === 'name_for_email') {
        return Promise.resolve({
          data: opts.nameError ? null : (opts.name ?? ''),
          error: opts.nameError ? { message: opts.nameError } : null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    },
  } as unknown as SupabaseClient;
  return { db, calls };
}

/** Ενας αποστολέας που θυμάται τι του ζητήθηκε να στείλει. */
function fakeSend(result: AckResult = { ok: true }) {
  const sent: AckInput[] = [];
  const send = async (input: AckInput) => { sent.push(input); return result; };
  return { send, sent };
}

const KEY = 're_test_key';
const HUMAN = 'Μαρία <maria@gmail.com>';

async function main() {
  // ── 1. Πελάτης + πρώτη επαφή → στέλνεται, 200 acked:true ──────────────────
  {
    const { db, calls } = fakeDb({ ack: true, name: 'George' });
    const sender = fakeSend({ ok: true });
    const out = await handleReplyAck(db, HUMAN, KEY, { send: sender.send });
    ok(out.status === 200, 'πελάτης: 200');
    ok(out.body.acked === true, 'πελάτης: acked true');
    ok(sender.sent.length === 1, 'στάλθηκε ΜΙΑ επιβεβαίωση');
    ok(sender.sent[0]?.to === 'maria@gmail.com', 'στη σκέτη διεύθυνση του αποστολέα');
    ok(sender.sent[0]?.name === 'George', 'με το πραγματικό όνομα από τον λογαριασμό');
    ok(sender.sent[0]?.apiKey === KEY, 'με το κλειδί του παρόχου');
    ok(calls.some(c => c.fn === 'try_support_ack' && c.args.p_email === 'maria@gmail.com'), 'ρωτήθηκε το try_support_ack με τη διεύθυνση');
    ok(calls.some(c => c.fn === 'name_for_email'), 'ρωτήθηκε το name_for_email');
    ok(out.logs.includes('στάλθηκε επιβεβαίωση παραλαβής'), 'το λέει στα αρχεία καταγραφής');
  }

  // ── 2. Αυτόματος αποστολέας → ΔΕΝ στέλνεται, καμία κλήση στη βάση ──────────
  {
    const { db, calls } = fakeDb({ ack: true, name: 'George' });
    const sender = fakeSend({ ok: true });
    const out = await handleReplyAck(db, 'no-reply@newsletter.com', KEY, { send: sender.send });
    ok(out.status === 200, 'αυτόματος: 200');
    ok(out.body.acked === false, 'αυτόματος: acked false');
    ok(sender.sent.length === 0, 'ΔΕΝ στάλθηκε τίποτα');
    ok(calls.length === 0, 'ΚΑΜΙΑ κλήση στη βάση: κόβεται πριν από κάθε ξόδεμα');
    ok(out.logs.includes('αυτόματος αποστολέας, καμία απάντηση'), 'ο λόγος γράφεται');
  }

  // ── 3. Περίοδος ησυχίας (send:false) → ΔΕΝ στέλνεται ──────────────────────
  {
    const { db, calls } = fakeDb({ ack: false });
    const sender = fakeSend({ ok: true });
    const out = await handleReplyAck(db, HUMAN, KEY, { send: sender.send });
    ok(out.status === 200, 'cooldown: 200');
    ok(out.body.acked === false, 'cooldown: acked false');
    ok(sender.sent.length === 0, 'ΔΕΝ στάλθηκε δεύτερη φορά');
    ok(calls.some(c => c.fn === 'try_support_ack'), 'ρωτήθηκε το try_support_ack');
    ok(!calls.some(c => c.fn === 'name_for_email'), 'δεν χρειάστηκε καν το όνομα');
    ok(out.logs.includes('ήδη απαντήθηκε πρόσφατα'), 'ο λόγος γράφεται');
  }

  // ── 4. Το όνομα δεν διαβάστηκε → στέλνεται ΧΩΡΙΣ όνομα, δεν μπλοκάρει ──────
  {
    const { db } = fakeDb({ ack: true, nameError: 'δίκτυο' });
    const sender = fakeSend({ ok: true });
    const out = await handleReplyAck(db, HUMAN, KEY, { send: sender.send });
    ok(out.body.acked === true, 'στάλθηκε παρά την αποτυχία ονόματος');
    ok(sender.sent[0]?.name === '', 'προσφώνηση χωρίς όνομα');
    ok(out.logs.some(l => l.includes('το όνομα δεν διαβάστηκε')), 'η αποτυχία ονόματος καταγράφεται');
  }

  // ── 5. Η βάση δεν απάντησε στο try_support_ack → 500 ─────────────────────
  {
    const { db } = fakeDb({ ackError: 'δεν διαβάστηκε' });
    const sender = fakeSend({ ok: true });
    const out = await handleReplyAck(db, HUMAN, KEY, { send: sender.send });
    ok(out.status === 500, 'σφάλμα βάσης: 500');
    ok(sender.sent.length === 0, 'δεν στάλθηκε τίποτα σε σφάλμα βάσης');
  }

  // ── 6. Ο πάροχος δεν δέχτηκε το μήνυμα → 502 ──────────────────────────────
  {
    const { db } = fakeDb({ ack: true, name: '' });
    const sender = fakeSend({ ok: false, reason: 'ο πάροχος απάντησε 500' });
    const out = await handleReplyAck(db, HUMAN, KEY, { send: sender.send });
    ok(out.status === 502, 'αποτυχία αποστολής: 502 ώστε να ξαναδοκιμάσει');
    ok(out.body.acked === undefined, 'το σώμα δεν λέει acked σε αποτυχία');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Η ΔΙΑΔΡΟΜΗ ΕΙΝΑΙ ΣΩΣΤΑ ΣΥΝΔΕΔΕΜΕΝΗ ΜΕ ΑΥΤΗ ΤΗ ΛΟΓΙΚΗ
  // ═══════════════════════════════════════════════════════════════════════════
  const HERE = dirname(fileURLToPath(import.meta.url));
  const ROUTE = readFileSync(join(HERE, '..', '..', 'app', 'api', 'inbound', 'route.ts'), 'utf8');

  ok(/import \{ supportRecipientKind \} from '@\/lib\/inbound\/support'/.test(ROUTE),
    'η διαδρομή εισάγει το supportRecipientKind');
  ok(/import \{ handleReplyAck \} from '@\/lib\/inbound\/replyAck'/.test(ROUTE),
    'η διαδρομή εισάγει το handleReplyAck');
  ok(/import \{ MAIL_DOMAIN \} from '@\/lib\/legal\/identity'/.test(ROUTE),
    'η διαδρομή εισάγει το MAIL_DOMAIN');
  ok(/supportRecipientKind\(\s*event\.recipients,\s*\[INBOUND_DOMAIN, MAIL_DOMAIN\]\.filter\(Boolean\)\s*\)/.test(ROUTE),
    'το είδος υπολογίζεται και στους δύο τομείς');
  ok(/handleReplyAck\(db, event\.from, process\.env\[KEY_ENV\]\)/.test(ROUTE),
    'η αυτόματη επιβεβαίωση καλείται με τον πελάτη υπηρεσίας και το κλειδί');

  // Ο πελάτης υπηρεσίας επικυρώνεται ΠΡΙΝ τη διακλάδωση, δηλαδή και για τους δύο δρόμους.
  const iService = ROUTE.indexOf('const missing = serviceClientError(process.env)');
  const iSupportBranch = ROUTE.indexOf('const outcome = await handleReplyAck(');
  const iCoupon = ROUTE.indexOf('inbound.mailboxOfToken(db,');
  ok(iService > 0 && iService < iSupportBranch, 'ο πελάτης υπηρεσίας επικυρώνεται πριν την επιβεβαίωση');
  ok(iService < iCoupon, 'ο ίδιος επικυρωμένος πελάτης εξυπηρετεί και τον δρόμο του κουπονιού');
  ok(/return NextResponse\.json\(outcome\.body, \{ status: outcome\.status \}\)/.test(ROUTE),
    'η διαδρομή επιστρέφει ό,τι αποφασίζει το handleReplyAck');
  ok(iCoupon > 0, 'ο δρόμος του κουπονιού μένει ανέπαφος');
}

void main().then(() => {
  console.log(`\ninbound/replyAck.ts — ${p} passed, ${f} failed`);
  if (f > 0) process.exit(1);
  console.log('όλα πέρασαν');
});
