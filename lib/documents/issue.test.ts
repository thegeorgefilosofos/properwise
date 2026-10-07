// npx tsx lib/documents/issue.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// Η ΚΑΤΑΧΩΡΗΣΗ ΓΙΝΕΤΑΙ ΣΤΟΝ ΔΙΑΚΟΜΙΣΤΗ ΚΑΙ Η ΔΙΕΥΘΥΝΣΗ ΔΕΝ ΕΞΑΡΤΑΤΑΙ ΑΠΟ ΚΑΡΤΕΛΑ
// ─────────────────────────────────────────────────────────────────────────
// ΔΥΟ ΣΦΑΛΜΑΤΑ ΚΛΕΙΔΩΝΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ.
//
// 1. Ο ΠΕΡΙΗΓΗΤΗΣ ΕΓΡΑΦΕ ΤΟ ΜΗΤΡΩΟ. Αριθμό, ώρα και checksum τα έφτιαχνε ο
//    περιηγητής και τα έγραφε με `insert` στο `issued_documents`. Από την
//    20261007100000 η μόνη πόρτα είναι η RPC `issue_document`. Εδώ η ψεύτικη
//    βάση ΣΚΑΕΙ αν αγγιχτεί πίνακας· ελέγχεται επίσης ότι ο περιηγητής δεν στέλνει
//    ούτε αριθμό ούτε ώρα ούτε χρήστη: ό,τι τυπώνεται έρχεται από τον διακομιστή.
//
// 2. Η ΔΙΕΥΘΥΝΣΗ ΕΠΑΛΗΘΕΥΣΗΣ ΕΒΓΑΙΝΕ ΑΠΟ ΤΗΝ ΚΑΡΤΕΛΑ. Ο σύνδεσμος του QR
//    έβγαινε από `window.location.origin`: από ανάπτυξη `localhost`, από
//    προεπισκόπηση μια διεύθυνση Vercel που σβήνεται. Το χαρτί όμως μένει.
//
// ΚΑΙ ΟΙ ΔΥΟ ΚΑΤΑΛΟΓΟΙ ΤΥΠΩΝ ΣΥΜΦΩΝΟΥΝ. Η βάση αρνείται κάθε τύπο εκτός του
// καταλόγου της· αν η εφαρμογή αποκτήσει νέο τύπο χωρίς μετανάστευση, κάθε
// τέτοιο έγγραφο θα έβγαινε χωρίς επαλήθευση, σιωπηλά.
// ═══════════════════════════════════════════════════════════════════════════
import { readdirSync, readFileSync } from 'node:fs';
import { issueDocument, ISSUED_DOC_TYPES } from './issue';
import { fingerprintLabel } from './verifyCode';
import { SITE } from '@/lib/core/site';

let pass = 0, fail = 0;
const fails: string[] = [];
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; fails.push(n); } };

const SHA = 'a3f19c10b7e40d55' + '0'.repeat(48);
const SERVER = { id: 'PO-261007-ABCDEFGH', issued_at: '2026-10-07T11:22:33.456789+00:00', checksum: SHA };

/** Ψεύτικη βάση: καταγράφει τις κλήσεις RPC και σκάει σε κάθε απευθείας πίνακα. */
function fakeDb(reply: () => Promise<{ data: unknown; error: { message: string } | null }>) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const tables: string[] = [];
  const db = {
    rpc: (fn: string, args: Record<string, unknown>) => { calls.push({ fn, args }); return reply(); },
    from: (t: string) => { tables.push(t); throw new Error(`ο περιηγητής άγγιξε τον πίνακα ${t}`); },
  };
  return { db, calls, tables };
}

void (async () => {
  // Το `window` υπάρχει κι δείχνει ΑΛΛΟΥ: ακριβώς το σενάριο της προεπισκόπησης.
  (globalThis as { window?: unknown }).window = { location: { origin: 'https://properwise-9x2k77-preview.vercel.app' } };

  // ── Η ΕΠΙΤΥΧΙΑ: ό,τι τυπώνεται το γράφει ο διακομιστής ─────────────────
  const good = fakeDb(() => Promise.resolve({ data: SERVER, error: null }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = await issueDocument(good.db as any, {
    docType: 'Κατάσταση κατανομής', subject: 'Αλεξάνδρας 12', period: 'Χρήση 2025', summary: { gross: 1200 },
  });

  ok('μία κλήση, στην issue_document', good.calls.length === 1 && good.calls[0].fn === 'issue_document');
  ok('κανένας πίνακας δεν αγγίζεται απευθείας', good.tables.length === 0);
  const sent = good.calls[0]?.args ?? {};
  ok('στέλνει ΜΟΝΟ τύπο, αντικείμενο, περίοδο και σύνοψη',
    JSON.stringify(Object.keys(sent).sort()) === JSON.stringify(['p_doc_type', 'p_period', 'p_subject', 'p_summary']));
  ok('ο τύπος περνά αυτούσιος', sent.p_doc_type === 'Κατάσταση κατανομής');
  ok('η σύνοψη περνά αυτούσια', JSON.stringify(sent.p_summary) === JSON.stringify({ gross: 1200 }));

  ok('ο αριθμός είναι του διακομιστή', doc.id === SERVER.id);
  ok('η ώρα είναι του διακομιστή', doc.issuedAt === SERVER.issued_at);
  ok('το αποτύπωμα είναι του διακομιστή', doc.checksum === SHA);
  ok('η διεύθυνση επαλήθευσης βγαίνει από τη δηλωμένη διεύθυνση', doc.verifyUrl.startsWith(SITE + '/verify/'));
  ok('ΚΑΙ ΟΧΙ ΑΠΟ ΤΗΝ ΚΑΡΤΕΛΑ ΤΗΣ ΣΤΙΓΜΗΣ', !doc.verifyUrl.includes('preview.vercel.app'));
  ok('ο αριθμός εγγράφου κλείνει τη διεύθυνση', doc.verifyUrl.endsWith(doc.id));
  ok('καμία διπλή κάθετος', !doc.verifyUrl.replace('https://', '').includes('//'));

  // Χωρίς αντικείμενο, περίοδο και σύνοψη: κενά, όχι undefined που χάνεται στο JSON.
  const bare = fakeDb(() => Promise.resolve({ data: SERVER, error: null }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await issueDocument(bare.db as any, { docType: 'Βεβαίωση ενοικίου' });
  const b = bare.calls[0]?.args ?? {};
  ok('τα κενά πεδία φεύγουν ως κενά', b.p_subject === '' && b.p_period === '' && JSON.stringify(b.p_summary) === '{}');

  // ── Η ΑΠΟΤΥΧΙΑ: το έγγραφο εκδίδεται, χωρίς αριθμό και χωρίς υπόσχεση ──
  const refused = fakeDb(() => Promise.resolve({ data: null, error: { message: 'mfa_required' } }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orphan = await issueDocument(refused.db as any, { docType: 'Βεβαίωση ενοικίου' });
  ok('άρνηση της βάσης: καμία διεύθυνση επαλήθευσης', orphan.verifyUrl === '');
  ok('άρνηση της βάσης: κανένας αριθμός που δεν υπάρχει στο μητρώο', orphan.id === '');
  ok('άρνηση της βάσης: κανένα αποτύπωμα', orphan.checksum === '');
  ok('άρνηση της βάσης: η ημερομηνία του PDF υπάρχει', !Number.isNaN(Date.parse(orphan.issuedAt)));

  const offline = fakeDb(() => Promise.reject(new Error('Failed to fetch')));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lost = await issueDocument(offline.db as any, { docType: 'Βεβαίωση ενοικίου' });
  ok('πεσμένο δίκτυο: καμία διεύθυνση επαλήθευσης', lost.verifyUrl === '' && lost.id === '');

  // Απάντηση χωρίς αριθμό ή αποτύπωμα δεν τυπώνεται σαν να ήταν καταχώρηση.
  const odd = fakeDb(() => Promise.resolve({ data: { id: SERVER.id, issued_at: SERVER.issued_at }, error: null }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const half = await issueDocument(odd.db as any, { docType: 'Βεβαίωση ενοικίου' });
  ok('μισή απάντηση: καμία διεύθυνση επαλήθευσης', half.verifyUrl === '' && half.id === '');

  delete (globalThis as { window?: unknown }).window;

  // ── ΤΟ ΑΠΟΤΥΠΩΜΑ ΣΤΟ ΧΑΡΤΙ ΚΑΙ ΣΤΗΝ /verify ──────────────────────────────
  ok('αποτύπωμα: 16 κεφαλαία σε τετράδες', fingerprintLabel(SHA) === 'A3F1 9C10 B7E4 0D55');
  ok('αποτύπωμα: το checksum του περιηγητή δεν δίνει αποτύπωμα', fingerprintLabel('0ABCDEF') === '');
  ok('αποτύπωμα: κενό δίνει κενό', fingerprintLabel('') === '' && fingerprintLabel(undefined) === '');

  // ── Ο ΚΑΤΑΛΟΓΟΣ ΤΗΣ ΕΦΑΡΜΟΓΗΣ ΕΙΝΑΙ Ο ΚΑΤΑΛΟΓΟΣ ΤΗΣ ΒΑΣΗΣ ──────────────
  // Η ΤΕΛΕΥΤΑΙΑ μετανάστευση που ορίζει την `issue_document` είναι αυτή που
  // ισχύει· από εκεί διαβάζεται ο πίνακας `c_types`.
  const DIR = 'supabase/migrations';
  const defining = readdirSync(DIR).filter(f => f.endsWith('.sql')).sort()
    .filter(f => /create\s+or\s+replace\s+function\s+public\.issue_document\s*\(/i.test(readFileSync(`${DIR}/${f}`, 'utf8')));
  const latest = defining.length ? readFileSync(`${DIR}/${defining[defining.length - 1]}`, 'utf8') : '';
  const block = /c_types\s+constant\s+text\[\]\s*:=\s*array\[([\s\S]*?)\];/.exec(latest)?.[1] ?? '';
  const inDb = [...block.matchAll(/'((?:[^']|'')*)'/g)].map(m => m[1].replace(/''/g, "'"));
  ok('βρέθηκε ο κατάλογος της βάσης', inDb.length > 0);
  ok(`οι δύο κατάλογοι ταυτίζονται (βάση: ${inDb.length}, εφαρμογή: ${ISSUED_DOC_TYPES.length})`,
    JSON.stringify([...inDb].sort()) === JSON.stringify([...ISSUED_DOC_TYPES].sort()));

  console.log(fail === 0 ? `✓ issue: ${pass} έλεγχοι πέρασαν` : `✗ issue: ${fail} απέτυχαν από ${pass + fail}\n  ${fails.join('\n  ')}`);
  if (fail > 0) process.exit(1);
})();
