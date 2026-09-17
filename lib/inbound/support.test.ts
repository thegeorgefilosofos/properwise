// npx tsx lib/inbound/support.test.ts
import {
  SUPPORT_LOCALPARTS, senderAddress, supportRecipientKind, isAutomatedSender,
} from './support';

let p = 0, f = 0;
const ok = (c: boolean, m: string) => { if (c) p++; else { f++; console.error('✗', m); } };

const IN = 'in.properwise.gr';   // ο εισερχόμενος τομέας
const MAIN = 'properwise.gr';    // ο κύριος τομέας
const DOMS = [IN, MAIN];

// ── Η σκέτη διεύθυνση του αποστολέα ─────────────────────────────────────────
ok(SUPPORT_LOCALPARTS.length === 3, 'τρία τοπικά μέρη: support, privacy, security');
ok(senderAddress('maria@example.com') === 'maria@example.com', 'σκέτη διεύθυνση');
ok(senderAddress('Μαρία <Maria@Example.COM>') === 'maria@example.com', 'όνομα σε αγκύλες, πεζά');
ok(senderAddress('  <a@b.gr>  ') === 'a@b.gr', 'κενά και αγκύλες καθαρίζονται');
ok(senderAddress('') === '', 'κενό δεν είναι διεύθυνση');
ok(senderAddress('Μαρία χωρίς email') === '', 'κείμενο χωρίς διεύθυνση γίνεται κενό');
ok(senderAddress('a@') === '', 'χωρίς τομέα δεν είναι διεύθυνση');
ok(senderAddress('@b.gr') === '', 'χωρίς τοπικό μέρος δεν είναι διεύθυνση');

// ── Ποιας δημόσιας διεύθυνσης είναι παραλήπτης ──────────────────────────────
ok(supportRecipientKind([`support@${IN}`], DOMS) === 'support', 'support στον εισερχόμενο τομέα');
ok(supportRecipientKind([`support@${MAIN}`], DOMS) === 'support', 'support στον κύριο τομέα');
ok(supportRecipientKind([`privacy@${MAIN}`], DOMS) === 'privacy', 'privacy ταιριάζει');
ok(supportRecipientKind([`security@${IN}`], DOMS) === 'security', 'security ταιριάζει');
ok(supportRecipientKind([`SUPPORT@${MAIN.toUpperCase()}`], DOMS) === 'support', 'κεφαλαία και στα δύο μέρη');
ok(supportRecipientKind([`Ομάδα <support@${MAIN}>`], DOMS) === 'support', 'με όνομα σε αγκύλες');
ok(supportRecipientKind([`support+tag@${MAIN}`], DOMS) === 'support', 'η επέκταση με συν αγνοείται');

// Κουπόνια και άλλες διευθύνσεις δεν είναι δημόσιες διευθύνσεις μας.
ok(supportRecipientKind([`a3f19c7d0b2e4681@${MAIN}`], DOMS) === null, 'κουπόνι δεν είναι δημόσια διεύθυνση');
ok(supportRecipientKind([`info@${MAIN}`], DOMS) === null, 'άλλη ανθρώπινη διεύθυνση δεν μετρά');
ok(supportRecipientKind([`support@allo.gr`], DOMS) === null, 'support σε ξένο τομέα δεν μετρά');
ok(supportRecipientKind([`support@${MAIN}`], []) === null, 'χωρίς τομείς, κανείς');
ok(supportRecipientKind([], DOMS) === null, 'χωρίς παραλήπτες, κανείς');

// ── Το πιο ευαίσθητο νικά: security > privacy > support ─────────────────────
ok(supportRecipientKind([`support@${MAIN}`, `security@${MAIN}`], DOMS) === 'security',
  'security νικά το support');
ok(supportRecipientKind([`support@${MAIN}`, `privacy@${MAIN}`], DOMS) === 'privacy',
  'privacy νικά το support');
ok(supportRecipientKind([`privacy@${IN}`, `security@${MAIN}`], DOMS) === 'security',
  'security νικά το privacy, ανάμεικτοι τομείς');
ok(supportRecipientKind([`security@${MAIN}`, `support@${IN}`], DOMS) === 'security',
  'η σειρά δεν αλλάζει το αποτέλεσμα');

// ── Ποιος ΔΕΝ παίρνει ποτέ αυτόματη απάντηση ────────────────────────────────
ok(isAutomatedSender(`no-reply@example.com`) === true, 'no-reply δεν απαντιέται');
ok(isAutomatedSender(`noreply@example.com`) === true, 'noreply δεν απαντιέται');
ok(isAutomatedSender(`donotreply@example.com`) === true, 'donotreply δεν απαντιέται');
ok(isAutomatedSender(`newsletter+noreply@shop.gr`) === true, 'τοπικό που περιέχει noreply');
ok(isAutomatedSender(`mailer-daemon@mx.google.com`) === true, 'mailer-daemon δεν απαντιέται');
ok(isAutomatedSender(`postmaster@example.com`) === true, 'postmaster δεν απαντιέται');
ok(isAutomatedSender(`bounces@example.com`) === true, 'bounces δεν απαντιέται');
ok(isAutomatedSender(`notifications@github.com`) === true, 'notifications δεν απαντιέται');
ok(isAutomatedSender(`support@${MAIN}`) === true, 'ΔΙΚΗ ΜΑΣ ΔΙΕΥΘΥΝΣΗ ΔΕΝ ΑΠΑΝΤΙΕΤΑΙ ΠΟΤΕ');
ok(isAutomatedSender(`Ομάδα <hello@${MAIN}>`) === true, 'ο δικός μας τομέας κόβεται, όποιο και αν είναι το τοπικό');
ok(isAutomatedSender('') === true, 'κενός αποστολέας δεν απαντιέται');
ok(isAutomatedSender('χωρίς διεύθυνση') === true, 'μη αναγνωρίσιμος αποστολέας δεν απαντιέται');

// Ο κανονικός πελάτης ΠΑΙΡΝΕΙ απάντηση.
ok(isAutomatedSender(`maria@gmail.com`) === false, 'κανονικός πελάτης απαντιέται');
ok(isAutomatedSender(`Μαρία Παπά <maria.papa@outlook.com>`) === false, 'πελάτης με όνομα απαντιέται');
ok(isAutomatedSender(`support@allo.gr`) === false, 'support σε ΞΕΝΟ τομέα είναι κανονικός αποστολέας');

console.log(`\ninbound/support.ts — ${p} passed, ${f} failed`);
if (f > 0) process.exit(1);
console.log('όλα πέρασαν');
