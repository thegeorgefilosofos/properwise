// npx tsx lib/data/portal.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// Ο ΣΥΝΔΕΣΜΟΣ ΤΗΣ ΠΥΛΗΣ ΠΕΘΑΙΝΕ ΣΤΟΝ ΔΩΔΕΚΑΤΟ ΜΗΝΑ ΜΙΑΣ ΤΡΙΕΤΟΥΣ ΜΙΣΘΩΣΗΣ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΣΦΑΛΜΑ. Η `expires_at` γεννιέται `now() + 365 ημέρες` κι όλες οι
// συναρτήσεις της βάσης αρνούνται ληγμένο κουπόνι — σωστά. Καμία όμως διαδρομή
// της εφαρμογής δεν το ανανέωνε. Η ελληνική μίσθωση κατοικίας είναι τριετής
// κατ' ελάχιστο: στον δωδέκατο μήνα ο μισθωτής πατούσε ό,τι είχε στο κινητό
// του κι έβλεπε κενή σελίδα, χωρίς τίποτα να το πει στον ιδιοκτήτη.
//
// ΓΙΑΤΙ ΔΟΚΙΜΗ ΚΑΙ ΟΧΙ ΜΟΝΟ ΔΙΟΡΘΩΣΗ. Το `null` σημαίνει ΔΕΝ ΛΗΓΕΙ, όχι
// «έληξε» — οι συναρτήσεις της βάσης το δέχονται ρητά (`expires_at is null`).
// Μια μελλοντική «αυστηροποίηση» που θα το γύριζε σε «έληξε» θα έκοβε κάθε
// παλιά γραμμή, σιωπηλά, από την πλευρά του μισθωτή. Εδώ σπάει.
// ═══════════════════════════════════════════════════════════════════════════
import { daysLeft, needsRenewal, renew, LIFETIME_DAYS, RENEW_UNDER_DAYS, newPin, PIN_DIGITS, writePin, isMfaDenied, MFA_PIN_SAY } from './portal';
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const fails: string[] = [];
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; fails.push(n); } };

const NOW = new Date('2026-09-10T12:00:00Z');
const inDays = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();


// ── PIN ΑΠΟ ΠΡΟΕΠΙΛΟΓΗ (απόφαση ιδιοκτήτη 10/11/2026) ──────────────────────
{
  const p = newPin();
  ok('το PIN έχει PIN_DIGITS ψηφία', p.length === PIN_DIGITS && /^\d+$/.test(p));
  ok('έξι ψηφία, όχι τέσσερα', PIN_DIGITS === 6);
  // Οι τιμές ≥ 250 απορρίπτονται: με πηγή που δίνει μόνο 255 και μετά 3,
  // το αποτέλεσμα είναι μόνο τριάρια.
  let calls = 0;
  const skewed = (b: Uint8Array) => { b.fill(calls++ === 0 ? 255 : 3); return b; };
  ok('η απόρριψη κρατά τα ψηφία ισοπίθανα', newPin(skewed) === '333333' && calls === 2);
  const seen = new Set(Array.from({ length: 200 }, () => newPin()));
  ok('δεν επαναλαμβάνεται το ίδιο PIN', seen.size > 190);
  const ui = readFileSync('app/dashboard/components/PortalShare.tsx', 'utf8');
  ok('η πύλη γεννιέται με PIN από προεπιλογή', ui.includes('const [withPin, setWithPin] = useState(true);') && ui.includes('if (withPin) await addRandomPin(data.token)'));
  ok('το «Χωρίς κωδικό» λέει τι εκτίθεται', ui.includes('όποιος έχει τον σύνδεσμο βλέπει το IBAN πληρωμής και τα στοιχεία της μίσθωσης'));
  ok('ο παλιός σύνδεσμος χωρίς PIN παίρνει σύσταση με κουμπί', ui.includes('>Πρόσθεσε PIN</Btn>'));
  const data = readFileSync('lib/data/portal.ts', 'utf8');
  ok('το καθαρό PIN πάει μόνο στη set_portal_pin', !/pin_hash\s*:/.test(ui) && data.includes("db.rpc('set_portal_pin'"));
  ok('«Αντιγράφηκε» μόνο αφού το δεχτεί το πρόχειρο', ui.includes('await navigator.clipboard.writeText(freshPin)') && ui.includes("setPinCopy('failed')") && ui.includes('Δεν αντιγράφηκε, σημείωσέ το.'));
  ok('το PIN μένει επιλέξιμο ως κείμενο', ui.includes("userSelect: 'all'"));
  ok('νέος ενοικιαστής, νέο PIN', /if \(pinSet\) \{\s*if \(await addRandomPin\(t\)\)/.test(ui));
  ok('χωρίς δεύτερο βήμα, το μήνυμα λέει πού ανοίγει', ui.includes('notifyError(portalStore.MFA_PIN_SAY)') && MFA_PIN_SAY.includes('«Ασφάλεια»'));
  ok('42501 είναι άρνηση δεύτερου βήματος', isMfaDenied({ code: '42501', message: 'x' }) && isMfaDenied({ message: 'mfa_required' }) && !isMfaDenied({ code: '23505' }) && !isMfaDenied(null));
}


// ── ΠΟΣΕΣ ΗΜΕΡΕΣ ΜΕΝΟΥΝ ────────────────────────────────────────────────────
ok('εκατό ημέρες μπροστά', daysLeft(inDays(100), NOW) === 100);
ok('μία ημέρα μπροστά', daysLeft(inDays(1), NOW) === 1);
ok('περασμένη λήξη δίνει αρνητικό', (daysLeft(inDays(-5), NOW) ?? 0) < 0);
ok('ΧΩΡΙΣ ΛΗΞΗ ΔΕΝ ΣΗΜΑΙΝΕΙ ΕΛΗΞΕ', daysLeft(null, NOW) === null);
ok('ούτε το κενό κείμενο', daysLeft('', NOW) === null);
ok('ούτε σκουπίδι σε ημερομηνία', daysLeft('χθες', NOW) === null);

// ── ΠΟΤΕ ΑΝΑΝΕΩΝΕΤΑΙ ───────────────────────────────────────────────────────
ok('φρέσκος σύνδεσμος δεν αγγίζεται', !needsRenewal(inDays(LIFETIME_DAYS), NOW));
ok('ακριβώς στο κατώφλι δεν αγγίζεται', !needsRenewal(inDays(RENEW_UNDER_DAYS), NOW));
ok('μία ημέρα κάτω από το κατώφλι ανανεώνεται', needsRenewal(inDays(RENEW_UNDER_DAYS - 1), NOW));
ok('ΚΑΙ Ο ΗΔΗ ΛΗΓΜΕΝΟΣ ΞΑΝΑΖΩΝΤΑΝΕΥΕΙ', needsRenewal(inDays(-30), NOW));
ok('γραμμή χωρίς λήξη μένει ήσυχη', !needsRenewal(null, NOW));

// ── ΤΙ ΓΡΑΦΕΤΑΙ ────────────────────────────────────────────────────────────
void (async () => {
  let wrote: Record<string, unknown> | null = null;
  const where: string[] = [];
  const db = {
    from: () => ({
      update(patch: Record<string, unknown>) {
        wrote = patch;
        const chain = { eq: (_c: string, v: string) => { where.push(v); return chain } };
        return chain as unknown as { eq: (c: string, v: string) => unknown };
      },
    }),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await renew(db as any, 'prop-1', 'user-1', NOW);
  const patch = wrote as { expires_at?: string } | null;
  ok('γράφεται ΜΟΝΟ η λήξη', !!patch && Object.keys(patch).length === 1 && 'expires_at' in patch);
  ok('κι το παράθυρο ξαναγεμίζει ολόκληρο', daysLeft(patch?.expires_at ?? null, NOW) === LIFETIME_DAYS);
  ok('η γραφή δένεται σε ακίνητο ΚΑΙ χρήστη', where.includes('prop-1') && where.includes('user-1'));

  const fake = (res: { data?: unknown; error?: unknown }, thrown = false) => ({
    rpc: async () => { if (thrown) throw new Error('δίκτυο'); return res; },
  });
  const w = (f: unknown) => writePin(f as Parameters<typeof writePin>[0], 't', '123456');
  ok('PIN γράφτηκε', (await w(fake({ data: true, error: null }))).result === 'ok');
  ok('καμία δική σου γραμμή', (await w(fake({ data: false, error: null }))).result === 'none');
  ok('χωρίς δεύτερο βήμα', (await w(fake({ data: null, error: { code: '42501', message: 'mfa_required' } }))).result === 'mfa');
  ok('άλλο σφάλμα', (await w(fake({ data: null, error: { code: '23505', message: 'x' } }))).result === 'error');
  ok('δίκτυο που πέφτει', (await w(fake({}, true))).result === 'error');
  console.log(fail === 0 ? `✓ portal: ${pass} έλεγχοι πέρασαν` : `✗ portal: ${fail} απέτυχαν από ${pass + fail}\n  ${fails.join('\n  ')}`);
  if (fail > 0) process.exit(1);
})();
