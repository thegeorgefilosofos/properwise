// npx tsx lib/data/checkinLink.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// Ο ΣΥΝΔΕΣΜΟΣ ΠΡΟ-ΑΦΙΞΗΣ ΞΑΝΑΑΝΤΙΓΡΑΦΟΤΑΝ ΗΔΗ ΝΕΚΡΟΣ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΣΦΑΛΜΑ. Η `expires_at` γεννιέται `now() + 90 ημέρες` κι οι συναρτήσεις της
// βάσης αρνούνται ληγμένο κουπόνι. Το `upsert` όμως, σε σύγκρουση, γύριζε το
// ΥΠΑΡΧΟΝ κουπόνι χωρίς να αγγίξει τη λήξη του: πελάτης του περασμένου
// καλοκαιριού που ξαναρχόταν φέτος έπαιρνε σύνδεσμο ληγμένο πριν καν σταλεί.
// Η οθόνη έλεγε «Ο σύνδεσμος αντιγράφηκε» κι ο επισκέπτης έβλεπε κενή σελίδα.
//
// ΚΑΙ ΤΟ ΔΕΥΤΕΡΟ: η διεύθυνση χτιζόταν από `window.location.origin`, δηλαδή από
// ό,τι έτυχε να γράφει η μπάρα του ιδιοκτήτη.
// ═══════════════════════════════════════════════════════════════════════════
import { issue, checkinUrl, expiryFrom, LIFETIME_DAYS } from './checkinLink';
import { SITE } from '@/lib/core/site';

let pass = 0, fail = 0;
const fails: string[] = [];
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; fails.push(n); } };

const NOW = new Date('2026-09-10T12:00:00Z');

// ── Η ΔΙΕΥΘΥΝΣΗ ───────────────────────────────────────────────────────────
(globalThis as { window?: unknown }).window = { location: { origin: 'https://properwise-preview.vercel.app' } };
ok('βγαίνει από τη δηλωμένη διεύθυνση', checkinUrl('abc123') === `${SITE}/checkin/abc123`);
ok('ΚΑΙ ΟΧΙ ΑΠΟ ΤΗΝ ΚΑΡΤΕΛΑ', !checkinUrl('abc123').includes('preview'));
ok('χωρίς κουπόνι, καμία διεύθυνση', checkinUrl(null) === '' && checkinUrl('') === '');
delete (globalThis as { window?: unknown }).window;

// ── Η ΛΗΞΗ ────────────────────────────────────────────────────────────────
ok('ενενήντα ημέρες από τώρα',
  Date.parse(expiryFrom(NOW)) - NOW.getTime() === LIFETIME_DAYS * 86_400_000);
ok('κι η λήξη είναι στο μέλλον', Date.parse(expiryFrom(NOW)) > NOW.getTime());

// ── ΤΙ ΓΡΑΦΕΤΑΙ ───────────────────────────────────────────────────────────
void (async () => {
  let wrote: Record<string, unknown> | null = null;
  let conflict = '';
  const chain = {
    select: () => chain,
    maybeSingle: () => Promise.resolve({ data: { token: 'νέο-κουπόνι' }, error: null }),
  };
  const db = {
    from: () => ({
      upsert(row: Record<string, unknown>, opts: { onConflict: string }) {
        wrote = row; conflict = opts.onConflict;
        return chain;
      },
    }),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await issue(db as any, 'u1', 'c1', 'p1', NOW);
  const row = wrote as Record<string, unknown> | null;

  ok('γυρίζει το κουπόνι', data?.token === 'νέο-κουπόνι');
  ok('ΚΑΙ ΓΡΑΦΕΙ ΤΗ ΛΗΞΗ, ΠΟΥ ΗΤΑΝ ΟΛΟ ΤΟ ΣΦΑΛΜΑ', row?.expires_at === expiryFrom(NOW));
  ok('ο σύνδεσμος μένει ενεργός', row?.active === true);
  ok('δένεται σε χρήστη, πελάτη κι ακίνητο',
    row?.user_id === 'u1' && row?.client_id === 'c1' && row?.property_id === 'p1');
  ok('η σύγκρουση λύνεται σε χρήστη κι πελάτη', conflict === 'user_id,client_id');

  // Πελάτης χωρίς συνδεδεμένο ακίνητο: ο σύνδεσμος βγαίνει ούτως ή άλλως.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await issue(db as any, 'u1', 'c1', null, NOW);
  ok('χωρίς ακίνητο δεν σκάει', (wrote as unknown as Record<string, unknown>)?.property_id === null);

  console.log(fail === 0 ? `✓ checkinLink: ${pass} έλεγχοι πέρασαν` : `✗ checkinLink: ${fail} απέτυχαν από ${pass + fail}\n  ${fails.join('\n  ')}`);
  if (fail > 0) process.exit(1);
})();
