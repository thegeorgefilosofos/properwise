// npx tsx lib/data/accountantLink.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// Η ΑΝΑΚΛΗΣΗ ΠΡΟΣΒΑΣΗΣ ΕΙΝΑΙ ΑΜΕΤΑΚΛΗΤΗ, Η ΔΕΝ ΕΙΝΑΙ ΑΝΑΚΛΗΣΗ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΚΛΕΙΔΩΝΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ. Η `revoke` έγραφε ΜΟΝΟ
// `active = false` κι άφηνε το token ανέπαφο· η `issue` έγραφε `active = true`
// χωρίς να αγγίξει το token. Ο ιδιοκτήτης έδιωχνε τον λογιστή, διάβαζε «Καμία
// ενεργή πρόσβαση» — δύο εβδομάδες μετά πατούσε «Ζωντανή πύλη λογιστή» για
// τον ΝΕΟ του λογιστή: ο ΠΑΛΙΟΣ ξαναέβλεπε τα πάντα από το bookmark του.
//
// ΓΙΑΤΙ ΔΟΚΙΜΗ ΚΑΙ ΟΧΙ ΜΟΝΟ ΔΙΟΡΘΩΣΗ. Η ανάκληση είναι η μόνη πράξη που ο
// ιδιοκτήτης θεωρεί ασφαλή. Μια μελλοντική «απλοποίηση» της `issue` που
// ξαναβάζει το `upsert` θα ξανάνοιγε την πόρτα χωρίς να το δει κανείς — δεν
// σπάει καμία οθόνη, δεν κοκκινίζει κανένας σαρωτής. Εδώ σπάει.
// ═══════════════════════════════════════════════════════════════════════════
import { issue, revoke } from './accountantLink';

let pass = 0, fail = 0;
const fails: string[] = [];
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; fails.push(n); } };
const eq = (n: string, got: unknown, want: unknown) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) pass++; else { fail++; fails.push(`${n} — πήρα ${g}, ήθελα ${w}`); }
};

type Row = { user_id: string; token: string; active: boolean; expires_at: string | null };

/**
 * Ψεύτικη βάση με ΜΙΑ γραμμή: όσο χρειάζεται για να δει κανείς αν το token
 * επιβιώνει της ανάκλησης. Το `upsert` συμπεριφέρεται όπως η Postgres —
 * συγχωνεύει ΜΟΝΟ τα πεδία που του δίνονται, αφήνοντας τα υπόλοιπα ως έχουν.
 * Ακριβώς αυτή η συμπεριφορά ήταν που ανάσταινε το παλιό κλειδί.
 */
function fakeDb(initial: Row | null) {
  let row: Row | null = initial ? { ...initial } : null;
  const api = {
    get row() { return row; },
    from() { return api; },
    select() { return api; },
    eq() { return api; },
    maybeSingle() { return Promise.resolve({ data: row, error: null }); },
    upsert(patch: Partial<Row>) {
      row = row ? { ...row, ...patch } : { user_id: 'u1', token: 'γεννημένο', active: true, expires_at: null, ...patch } as Row;
      return api;
    },
    update(patch: Partial<Row>) {
      if (row) row = { ...row, ...patch };
      return { eq: () => Promise.resolve({ error: null }) };
    },
  };
  return api;
}

void (async () => {
  const LIVE: Row = { user_id: 'u1', token: 'παλιό-κλειδί', active: true, expires_at: '2027-03-08T00:00:00Z' };

  // ── ΤΟ ΣΕΝΑΡΙΟ ΤΟΥ ΣΦΑΛΜΑΤΟΣ, ΑΚΡΙΒΩΣ ────────────────────────────────────
  // Διώξε τον λογιστή, μετά ζήτα πύλη για τον επόμενο. Ο πρώτος ΔΕΝ επιστρέφει.
  {
    const db = fakeDb(LIVE);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = db as any;

    ok('η ανάκληση πετυχαίνει', await revoke(client, 'u1'));
    ok('και σβήνει την πρόσβαση', db.row?.active === false);
    ok('ΚΑΙ ΤΟ ΚΛΕΙΔΙ ΔΕΝ ΕΙΝΑΙ ΠΙΑ ΤΟ ΠΑΛΙΟ', db.row?.token !== 'παλιό-κλειδί');

    const again = await issue(client, 'u1');
    ok('η νέα πύλη βγαίνει', again !== null);
    ok('ΚΑΙ ΔΕΝ ΔΙΝΕΙ ΤΟ ΠΑΛΙΟ ΚΛΕΙΔΙ', again?.token !== 'παλιό-κλειδί');
    ok('ο νέος σύνδεσμος είναι ζωντανός', again?.live === true);
  }

  // ── ΚΑΙ Η ΔΕΥΤΕΡΗ ΠΛΕΥΡΑ ΜΟΝΗ ΤΗΣ ────────────────────────────────────────
  // Ακόμη κι αν κάποια άλλη διαδρομή αφήσει γραμμή ανενεργή ΜΕ το παλιό κλειδί
  // —παλιά δεδομένα, χειροκίνητη επέμβαση, μελλοντικό σφάλμα— η `issue` δεν
  // επιτρέπεται να την αναστήσει ως έχει.
  {
    const db = fakeDb({ ...LIVE, active: false });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const link = await issue(db as any, 'u1');
    ok('ανενεργή γραμμή δεν ανασταίνεται με το ίδιο κλειδί', link?.token !== 'παλιό-κλειδί');
  }

  // ── Η ΚΑΝΟΝΙΚΗ ΔΙΑΔΡΟΜΗ ΔΕΝ ΑΛΛΑΞΕ ───────────────────────────────────────
  // Ζωντανός σύνδεσμος που απλώς ανανεώνεται: ΚΡΑΤΑ το κλειδί του, αλλιώς κάθε
  // πάτημα «Ζωντανή πύλη» θα έσπαγε τον σύνδεσμο που ο λογιστής έχει ήδη.
  {
    const db = fakeDb(LIVE);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const link = await issue(db as any, 'u1');
    eq('ενεργός σύνδεσμος κρατά το κλειδί του', link?.token, 'παλιό-κλειδί');
    ok('και μένει ζωντανός', link?.live === true);
  }

  console.log(fail === 0 ? `✓ accountantLink: ${pass} έλεγχοι πέρασαν` : `✗ accountantLink: ${fail} απέτυχαν από ${pass + fail}\n  ${fails.join('\n  ')}`);
  if (fail > 0) process.exit(1);
})();
