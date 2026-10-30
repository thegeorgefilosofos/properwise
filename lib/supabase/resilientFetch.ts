// ═══════════════════════════════════════════════════════════════════════════
// ΜΙΑ ΕΠΑΝΑΛΗΨΗ ΟΤΑΝ Η ΣΥΝΔΕΣΗ ΗΤΑΝ ΗΔΗ ΝΕΚΡΗ, ΜΟΝΟ ΓΙΑ ΑΝΑΓΝΩΣΕΙΣ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ. Τρία «TypeError: fetch failed» στην παραγωγή, 21–27/10/2026,
// σε τρεις χρήστες, στο / και στο /terms.rsc. Η αιτία κάθε φορά: SocketError
// «other side closed», UND_ERR_SOCKET, προς τη Cloudflare μπροστά από το
// *.supabase.co, με 819 bytes γραμμένα και 0 διαβασμένα. Το undici ξαναχρησιμο-
// ποίησε σύνδεση keep-alive που ο απέναντι είχε ήδη κλείσει: το αίτημα έφυγε
// σε νεκρό καλώδιο και δεν έφτασε ποτέ στον διακομιστή.
//
// Η κοινή κλήση των δύο διαδρομών είναι το `supabase.auth.getUser()` του
// proxy.ts (GET /auth/v1/user, μόνο για αίτημα με cookie sb-*). Το auth-js το
// πιάνει και επιστρέφει `user: null`, οπότε ο συνδεδεμένος χρήστης έβλεπε τη
// δημόσια σελίδα σαν ασύνδετος για εκείνο το ένα αίτημα· όχι σελίδα σφάλματος.
//
// ΤΙ ΕΠΑΝΑΛΑΜΒΑΝΕΤΑΙ ΚΑΙ ΤΙ ΟΧΙ.
//   · Μόνο GET και HEAD: δεν έχουν παρενέργειες, άρα μια δεύτερη αποστολή
//     δεν αλλάζει τίποτα ακόμη κι αν η πρώτη έφτασε. POST, PATCH, PUT, DELETE
//     και κάθε RPC (που στο PostgREST είναι POST) ΔΕΝ επαναλαμβάνονται ποτέ:
//     «0 bytes διαβασμένα» δεν σημαίνει «δεν γράφτηκε».
//   · Μόνο σφάλμα ΣΥΝΔΕΣΗΣ: TypeError «fetch failed» με cause.code
//     UND_ERR_SOCKET, ECONNRESET ή UND_ERR_CLOSED. Μια απάντηση HTTP, ακόμη
//     και 5xx, είναι απάντηση: επιστρέφεται όπως ήρθε.
//   · Μία φορά, χωρίς αναμονή. Η δεύτερη προσπάθεια ανοίγει νέα σύνδεση· αν
//     αποτύχει κι αυτή, το πρόβλημα δεν είναι το keep-alive και το σφάλμα
//     ανεβαίνει όπως πριν.
//   · Οχι αν το αίτημα ακυρώθηκε (signal.aborted): ο καλών δεν το θέλει πια.
// ═══════════════════════════════════════════════════════════════════════════

type Fetch = typeof fetch;

/** Οι κωδικοί του undici/Node που σημαίνουν «κόπηκε η σύνδεση», όχι «απάντησε». */
export const RETRYABLE_CONNECTION_CODES: ReadonlySet<string> = new Set([
  'UND_ERR_SOCKET',
  'ECONNRESET',
  'UND_ERR_CLOSED',
]);

const SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD']);

function methodOf(input: Parameters<Fetch>[0], init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (typeof Request !== 'undefined' && input instanceof Request) return input.method.toUpperCase();
  return 'GET';
}

function signalOf(input: Parameters<Fetch>[0], init?: RequestInit): AbortSignal | null | undefined {
  if (init?.signal) return init.signal;
  if (typeof Request !== 'undefined' && input instanceof Request) return input.signal;
  return undefined;
}

/** Σφάλμα επιπέδου σύνδεσης του undici: TypeError «fetch failed» με γνωστό cause.code. */
export function isDeadConnection(err: unknown): boolean {
  if (!(err instanceof TypeError) || err.message !== 'fetch failed') return false;
  const code = (err as { cause?: { code?: unknown } }).cause?.code;
  return typeof code === 'string' && RETRYABLE_CONNECTION_CODES.has(code);
}

/** Τυλίγει ένα fetch ώστε να ξαναδοκιμάζει ΜΙΑ φορά αναγνώσεις σε νεκρή σύνδεση. */
export function withConnectionRetry(base: Fetch): Fetch {
  return async (input, init) => {
    try {
      return await base(input, init);
    } catch (err) {
      if (!SAFE_METHODS.has(methodOf(input, init))) throw err;
      if (signalOf(input, init)?.aborted) throw err;
      if (!isDeadConnection(err)) throw err;
      return base(input, init);
    }
  };
}

/**
 * Το fetch για τους πελάτες Supabase του διακομιστή. Το `globalThis.fetch`
 * διαβάζεται τη στιγμή της κλήσης, ώστε να μένει όποιο fetch έχει στήσει ο Next.
 */
export const resilientFetch: Fetch = withConnectionRetry((input, init) => globalThis.fetch(input, init));
