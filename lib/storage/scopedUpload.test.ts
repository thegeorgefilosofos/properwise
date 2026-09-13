// npx tsx lib/storage/scopedUpload.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// Η ΑΠΟΜΟΝΩΣΗ ΑΡΧΕΙΩΝ ΑΝΑ ΧΡΗΣΤΗ, ΕΛΕΓΜΕΝΗ
//
// ΟΛΗ η προστασία των κάδων στηρίζεται σε μία πρόταση: «το πρώτο κομμάτι του
// μονοπατιού είναι το uid του χρήστη». Η πολιτική RLS γράφει
// `(storage.foldername(name))[1] = auth.uid()::text` και δεν έχει άλλον τρόπο
// να κρίνει. Αν αυτή η πρόταση σπάσει, η πολιτική εγκρίνει την παράβαση.
//
// Το αρχείο δεν είχε ΚΑΝΕΝΑΝ έλεγχο. Δεν είναι λογιστική: είναι το σημείο όπου
// το αρχείο ενός χρήστη μπορεί να γραφτεί πάνω στον φάκελο άλλου.
// ═══════════════════════════════════════════════════════════════════════════
import { safeRelPath, uploadUserScoped, ESCAPE_MSG } from './scopedUpload';
import type { SupabaseClient } from '@supabase/supabase-js';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean) => { if (cond) { pass++ } else { fail++; console.error('✗ ' + name) } };
const eq = (name: string, got: unknown, want: unknown) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++ } else { fail++; console.error(`✗ ${name}\n   got  ${g}\n   want ${w}`) }
};

// ── ΤΑ ΚΑΝΟΝΙΚΑ ΠΕΡΝΟΥΝ ΑΝΕΠΑΦΑ ───────────────────────────────────────────
eq('απλό όνομα', safeRelPath('20260908-a1b2-logariasmos.pdf'), '20260908-a1b2-logariasmos.pdf');
eq('με φάκελο', safeRelPath('contact-files/42/1712.jpg'), 'contact-files/42/1712.jpg');
eq('ελληνικοί χαρακτήρες μένουν', safeRelPath('φάκελος/αρχείο.pdf'), 'φάκελος/αρχείο.pdf');

// ── ΙΣΟΠΕΔΩΣΗ ΤΟΥ ΑΘΩΟΥ ΘΟΡΥΒΟΥ ──────────────────────────────────────────
eq('διπλή κάθετος', safeRelPath('a//b.jpg'), 'a/b.jpg');
eq('τρέχων φάκελος', safeRelPath('a/./b.jpg'), 'a/b.jpg');
eq('αρχική κάθετος', safeRelPath('/a/b.jpg'), 'a/b.jpg');
eq('τελική κάθετος', safeRelPath('a/b.jpg/'), 'a/b.jpg');

// ── Η ΑΝΑΒΑΣΗ ΑΠΟΡΡΙΠΤΕΤΑΙ, ΔΕΝ «ΚΑΘΑΡΙΖΕΤΑΙ» ────────────────────────────
// Η αφαίρεση του «..» θα άφηνε ένα μονοπάτι που ο χρήστης ΔΕΝ ζήτησε, σε θέση
// που δεν περίμενε. Η άρνηση είναι η μόνη απάντηση που δεν κρύβει τίποτα.
eq('σκέτη ανάβαση', safeRelPath('../x.jpg'), null);
eq('ανάβαση στη μέση', safeRelPath('a/../../b.jpg'), null);
eq('ανάβαση σε φάκελο άλλου χρήστη', safeRelPath('../11111111-2222-3333-4444-555555555555/x.jpg'), null);
eq('ανάστροφη κάθετος', safeRelPath('..\\x.jpg'), null);
eq('μεικτοί διαχωριστές', safeRelPath('a\\..\\..\\b.jpg'), null);

// ── ΠΟΣΟΣΤΙΑΙΑ ΚΩΔΙΚΟΠΟΙΗΣΗ: ΤΟ ΙΔΙΟ ΠΡΑΓΜΑ, ΜΕ ΑΛΛΑ ΓΡΑΜΜΑΤΑ ────────────
// Ενας έλεγχος που ψάχνει σκέτες τελείες βλέπει «%2e%2e%2f» ως αθώο κείμενο.
eq('κωδικοποιημένη ανάβαση', safeRelPath('%2e%2e%2fx.jpg'), null);
eq('κωδικοποιημένη κάθετος', safeRelPath('a%2F..%2Fb.jpg'), null);
eq('διπλά κωδικοποιημένη', safeRelPath('%252e%252e%252fx.jpg'), null);
eq('σπασμένο ποσοστό δεν ανεβαίνει', safeRelPath('a%ZZb.jpg'), null);

// ── ΧΑΡΑΚΤΗΡΕΣ ΠΟΥ ΔΕΝ ΕΧΟΥΝ ΘΕΣΗ ΣΕ ΟΝΟΜΑ ΑΝΤΙΚΕΙΜΕΝΟΥ ──────────────────
eq('NUL', safeRelPath('a\u0000b.jpg'), null);
eq('χαρακτήρας ελέγχου', safeRelPath('a\u000bb.jpg'), null);
eq('κενό μονοπάτι', safeRelPath(''), null);
eq('μόνο καθέτους', safeRelPath('///'), null);

async function main() {
  // ── ΚΑΙ Η ΙΔΙΑ Η ΣΥΝΑΡΤΗΣΗ ΑΝΕΒΑΣΜΑΤΟΣ ───────────────────────────────────
  const UID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const fakeClient = (user: { id: string } | null, sink: { path?: string } = {}) => ({
    auth: { getUser: async () => ({ data: { user } }) },
    storage: { from: () => ({ upload: async (p: string) => { sink.path = p; return { error: null } } }) },
  } as unknown as SupabaseClient);
  const file = { name: 'x.jpg' } as File;

  {
    const sink: { path?: string } = {};
    const r = await uploadUserScoped(fakeClient({ id: UID }, sink), 'inventory-photos', 'photos/a.jpg', file);
    eq('το μονοπάτι ξεκινά με το uid', r.path, `${UID}/photos/a.jpg`);
    eq('και ΑΥΤΟ ακριβώς πήγε στον κάδο', sink.path, `${UID}/photos/a.jpg`);
    ok('χωρίς σφάλμα', r.error === null);
  }
  {
    // ΤΟ ΚΡΙΣΙΜΟ: η απόπειρα δεν φτάνει ΚΑΝ στον κάδο.
    const sink: { path?: string } = {};
    const r = await uploadUserScoped(fakeClient({ id: UID }, sink), 'inventory-photos', '../other/a.jpg', file);
    eq('η ανάβαση απορρίπτεται', r.error?.message, ESCAPE_MSG);
    eq('και δεν έγινε καμία κλήση στον κάδο', sink.path, undefined);
    eq('ούτε επιστρέφεται μονοπάτι', r.path, '');
  }
  {
    const sink: { path?: string } = {};
    const r = await uploadUserScoped(fakeClient(null, sink), 'inventory-photos', 'a.jpg', file);
    ok('χωρίς σύνδεση δεν ανεβαίνει τίποτα', r.error !== null && sink.path === undefined);
  }
  {
    // ── Η ΚΑΤΑΛΗΞΗ ΠΟΥ ΕΡΧΕΤΑΙ ΩΜΗ ΑΠΟ ΤΟ ΟΝΟΜΑ ΑΡΧΕΙΟΥ ΤΟΥ ΧΡΗΣΤΗ ────────
    // Το μοτίβο που χρησιμοποιούσαν τα αρχεία επαφών: `1712.${ext}` με το
    // `ext` να βγαίνει από `file.name.split('.').pop()`.
    const sink: { path?: string } = {};
    const evil = { name: 'a.%2f%2e%2e%2fescaped' } as File;
    const ext = evil.name.split('.').pop();
    const r = await uploadUserScoped(fakeClient({ id: UID }, sink), 'contact-files', `contact-files/7/1712.${ext}`, evil);
    eq('κωδικοποιημένη ανάβαση μέσα από την κατάληξη', r.error?.message, ESCAPE_MSG);
    eq('και πάλι τίποτα στον κάδο', sink.path, undefined);
  }
  {
    // ΚΑΙ ΤΟ ΟΡΙΟ, ΓΡΑΜΜΕΝΟ. Το «%2e%2e%2f» χωρίς αρχική κάθετο δίνει
    // «1712.../escaped»: παράξενο όνομα φακέλου, ΟΧΙ ανάβαση. Περνά — το
    // μονοπάτι μένει κάτω από το uid. Ο έλεγχος το λέει ρητά ώστε να μη
    // «σφιχτεί» αύριο ο κανόνας σε κάτι που δεν είναι επίθεση.
    const sink: { path?: string } = {};
    const odd = { name: 'a.%2e%2e%2fescaped' } as File;
    const r = await uploadUserScoped(fakeClient({ id: UID }, sink), 'contact-files', `contact-files/7/1712.${odd.name.split('.').pop()}`, odd);
    eq('τρεις τελείες δεν είναι ανάβαση', r.path, `${UID}/contact-files/7/1712.../escaped`);
    ok('και μένει κάτω από το uid', (sink.path || '').startsWith(`${UID}/`));
  }
}

main().then(() => {
  console.log(fail === 0 ? `✓ scopedUpload: ${pass} έλεγχοι πέρασαν` : `✗ scopedUpload: ${fail} απέτυχαν από ${pass + fail}`);
  if (fail > 0) process.exit(1);
});
