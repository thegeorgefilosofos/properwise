// npx tsx lib/documents/issue.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// Η ΔΙΕΥΘΥΝΣΗ ΕΠΑΛΗΘΕΥΣΗΣ ΤΥΠΩΝΕΤΑΙ ΣΕ ΧΑΡΤΙ, ΑΡΑ ΔΕΝ ΕΞΑΡΤΑΤΑΙ ΑΠΟ ΚΑΡΤΕΛΑ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΚΛΕΙΔΩΝΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ. Ο σύνδεσμος του κωδικού QR βγαίνει
// από `window.location.origin`, δηλαδή από τη διεύθυνση της στιγμής: από
// ανάπτυξη έβγαινε `localhost`, από προεπισκόπηση μια διεύθυνση Vercel που
// σβήνεται. Το χαρτί όμως μένει στα χέρια λογιστή ή συνιδιοκτήτη κι ο κωδικός
// δεν ανοίγει πουθενά.
//
// ΓΙΑΤΙ ΔΟΚΙΜΗ. Η μία γραμμή που το διορθώνει είναι κι η ευκολότερη να
// «απλοποιηθεί» πίσω: το `window.location.origin` μοιάζει πιο σωστό σε όποιον
// δεν ξέρει ότι το αποτέλεσμα τυπώνεται. Εδώ σπάει.
// ═══════════════════════════════════════════════════════════════════════════
import { issueDocument } from './issue';
import { SITE } from '@/lib/core/site';

let pass = 0, fail = 0;
const fails: string[] = [];
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; fails.push(n); } };

/** Βάση που δέχεται την καταχώρηση: μας ενδιαφέρει ΜΟΝΟ η διεύθυνση που γυρίζει. */
const okDb = { from: () => ({ insert: () => Promise.resolve({ error: null }) }) };
/** Και βάση που την απορρίπτει: το έγγραφο ΔΕΝ επιτρέπεται να υπόσχεται επαλήθευση. */
const badDb = { from: () => ({ insert: () => Promise.resolve({ error: { message: 'RLS' } }) }) };

void (async () => {
  // Το `window` υπάρχει κι δείχνει ΑΛΛΟΥ: ακριβώς το σενάριο της προεπισκόπησης.
  (globalThis as { window?: unknown }).window = { location: { origin: 'https://properwise-9x2k77-preview.vercel.app' } };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = await issueDocument(okDb as any, { userId: 'u1', docType: 'Κατάσταση κατανομής', subject: 'Αλεξάνδρας 12' });

  ok('η διεύθυνση επαλήθευσης βγαίνει από τη δηλωμένη διεύθυνση', doc.verifyUrl.startsWith(SITE + '/verify/'));
  ok('ΚΑΙ ΟΧΙ ΑΠΟ ΤΗΝ ΚΑΡΤΕΛΑ ΤΗΣ ΣΤΙΓΜΗΣ', !doc.verifyUrl.includes('preview.vercel.app'));
  ok('ο αριθμός εγγράφου κλείνει τη διεύθυνση', doc.verifyUrl.endsWith(doc.id));
  ok('ο αριθμός έχει τη μορφή του μητρώου', /^PO-\d{6}-[A-Z2-9]{8}$/.test(doc.id));
  ok('καμία διπλή κάθετος', !doc.verifyUrl.replace('https://', '').includes('//'));

  // Δύο εκδόσεις δεν παίρνουν ποτέ τον ίδιο αριθμό.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const other = await issueDocument(okDb as any, { userId: 'u1', docType: 'Κατάσταση κατανομής' });
  ok('ο αριθμός δεν επαναλαμβάνεται', other.id !== doc.id);

  // ΑΠΟΤΥΧΙΑ ΚΑΤΑΧΩΡΗΣΗΣ: το έγγραφο εκδίδεται, αλλά ΧΩΡΙΣ υπόσχεση επαλήθευσης.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orphan = await issueDocument(badDb as any, { userId: 'u1', docType: 'Βεβαίωση ενοικίου' });
  ok('χωρίς γραμμή στο μητρώο, καμία διεύθυνση επαλήθευσης', orphan.verifyUrl === '');
  ok('ο αριθμός κι το checksum υπάρχουν πάντα', !!orphan.id && !!orphan.checksum);

  delete (globalThis as { window?: unknown }).window;

  console.log(fail === 0 ? `✓ issue: ${pass} έλεγχοι πέρασαν` : `✗ issue: ${fail} απέτυχαν από ${pass + fail}\n  ${fails.join('\n  ')}`);
  if (fail > 0) process.exit(1);
})();
