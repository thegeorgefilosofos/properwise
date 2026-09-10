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
import { daysLeft, needsRenewal, renew, LIFETIME_DAYS, RENEW_UNDER_DAYS } from './portal';

let pass = 0, fail = 0;
const fails: string[] = [];
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; fails.push(n); } };

const NOW = new Date('2026-09-10T12:00:00Z');
const inDays = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();

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

  console.log(fail === 0 ? `✓ portal: ${pass} έλεγχοι πέρασαν` : `✗ portal: ${fail} απέτυχαν από ${pass + fail}\n  ${fails.join('\n  ')}`);
  if (fail > 0) process.exit(1);
})();
