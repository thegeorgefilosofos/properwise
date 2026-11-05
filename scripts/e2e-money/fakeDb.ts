// ═══════════════════════════════════════════════════════════════════════════
// Η ΒΑΣΗ ΠΟΥ ΔΕΝ ΓΡΑΦΕΙ, ΑΛΛΑ ΘΥΜΑΤΑΙ ΤΙ ΤΗΣ ΖΗΤΗΘΗΚΕ
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΕΛΕΓΧΕΤΑΙ ΕΔΩ ΚΑΙ ΤΙ ΟΧΙ. Η πραγματική βάση ελέγχεται ήδη: 94
// μεταναστεύσεις ξανατρέχουν από το μηδέν και 33 έλεγχοι απομόνωσης κρίνουν
// τις πολιτικές της. Αυτό που ΔΕΝ ελεγχόταν πουθενά είναι το ενδιάμεσο: τι
// ΖΗΤΑΕΙ η οθόνη να γραφτεί όταν ο άνθρωπος πατήσει το κουμπί.
//
// Μια δαπάνη με λάθος ποσό, μια είσπραξη με λάθος τρόπο, μια δόση που δεν
// γράφτηκε καθόλου: κανένα από αυτά δεν είναι σφάλμα της βάσης. Ολα είναι
// σφάλματα της οθόνης και όλα κοστίζουν χρήματα ή φόρο.
//
// Ο διπλός εδώ δέχεται τις ίδιες αλυσίδες με το supabase-js, καταγράφει κάθε
// κλήση με τον πίνακα, την πράξη, το φορτίο και τα φίλτρα της και απαντά ό,τι
// του πει το σενάριο. Δεν προσποιείται ότι είναι βάση· προσποιείται ότι είναι
// ΑΥΤΙ.
// ═══════════════════════════════════════════════════════════════════════════

export interface DbCall {
  table: string;
  op: 'select' | 'insert' | 'update' | 'upsert' | 'delete';
  payload?: unknown;
  filters: Array<[string, string, unknown]>;
  /** `maybeSingle` και `single` αλλάζουν το σχήμα της απάντησης. */
  single?: boolean;
}

export type Answer = { data: unknown; error: unknown } | undefined;
/** Το σενάριο απαντά αντί για τη βάση. `undefined` σημαίνει «άδειο, χωρίς σφάλμα». */
export type Responder = (call: DbCall) => Answer;

const CHAINED = [
  'eq', 'neq', 'in', 'not', 'is', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike',
  'order', 'limit', 'range', 'contains', 'overlaps', 'filter', 'match', 'or',
];

/** Διπλός καναλιού με αλυσιδωτό `on`, όπως ο πραγματικός πελάτης. */
function channelDouble() {
  const ch = {
    on: () => ch,
    subscribe: () => ch,
    unsubscribe: async () => 'ok' as const,
  };
  return ch;
}

/** Ενας σταθερός κωδικός QR για τον πάγκο: τρία σημάδια θέσης και σταθερός θόρυβος, όχι πραγματικός. */
const qrCell = (x: number, y: number) => {
  const finder = (fx: number, fy: number) => {
    const dx = x - fx, dy = y - fy;
    if (dx < 0 || dy < 0 || dx > 6 || dy > 6) return null;
    return Math.max(Math.abs(dx - 3), Math.abs(dy - 3)) !== 2;
  };
  const f = finder(0, 0) ?? finder(14, 0) ?? finder(0, 14);
  if (f !== null) return f;
  if ((x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12)) return false;
  return ((x * 73 + y * 151 + x * y * 7) % 11) < 5;
};
const FAKE_QR = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 23 23" shape-rendering="crispEdges"><rect x="-1" y="-1" width="23" height="23" fill="white"/>${
    Array.from({ length: 441 }, (_, i) => (qrCell(i % 21, Math.floor(i / 21)) ? `<rect x="${i % 21}" y="${Math.floor(i / 21)}" width="1" height="1"/>` : '')).join('')
  }</svg>`);

export function makeFakeDb(respond: Responder = () => undefined) {
  const calls: DbCall[] = [];

  const builder = (call: DbCall) => {
    const b: Record<string, unknown> = {};
    for (const m of CHAINED) {
      b[m] = (...args: unknown[]) => {
        call.filters.push([m, String(args[0] ?? ''), args[1]]);
        return b;
      };
    }
    b.select = () => b;
    b.single = () => { call.single = true; return b; };
    b.maybeSingle = () => { call.single = true; return b; };
    b.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
      // Η ΚΑΤΑΓΡΑΦΗ ΓΙΝΕΤΑΙ ΟΤΑΝ ΕΚΤΕΛΕΙΤΑΙ ΤΟ ΕΡΩΤΗΜΑ, ΟΧΙ ΟΤΑΝ ΧΤΙΖΕΤΑΙ.
      // Ενα ερώτημα που χτίστηκε και δεν εκτελέστηκε ποτέ δεν έγραψε τίποτα,
      // και δεν επιτρέπεται να μετρήσει σαν να έγραψε.
      calls.push(call);
      let answer: Answer;
      try { answer = respond(call); }
      catch (e) { return Promise.resolve().then(() => reject ? reject(e) : Promise.reject(e)); }
      const out = answer ?? { data: call.single ? null : [], error: null };
      return Promise.resolve(out).then(resolve, reject);
    };
    return b;
  };

  const from = (table: string) => ({
    select: (_cols?: string, opts?: { count?: string; head?: boolean }) =>
      builder({ table, op: 'select', payload: opts, filters: [] }),
    insert: (payload: unknown) => builder({ table, op: 'insert', payload, filters: [] }),
    update: (payload: unknown) => builder({ table, op: 'update', payload, filters: [] }),
    upsert: (payload: unknown, opts?: unknown) =>
      builder({ table, op: 'upsert', payload, filters: [['onConflict', String((opts as { onConflict?: string })?.onConflict ?? ''), null]] }),
    delete: () => builder({ table, op: 'delete', filters: [] }),
  });

  return {
    db: {
      from,
      auth: {
        getUser: async () => ({ data: { user: { id: 'u1', email: 'dokimi@example.com' } }, error: null }),
        // ΤΟ ΔΕΥΤΕΡΟ ΒΗΜΑ ΤΩΝ ΓΡΑΦΕΙΩΝ (app/accountant/workspace/SecondStep.tsx).
        // Χωρίς συσκευή· η εγγραφή δίνει σταθερό, ψεύτικο κωδικό QR, ώστε η
        // σκηνή να έχει το ίδιο ύψος σε κάθε μέτρηση.
        mfa: {
          listFactors: async () => ({ data: { totp: [], all: [] }, error: null }),
          enroll: async () => ({ data: { id: 'factor-1', totp: { qr_code: FAKE_QR, secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP', uri: '' } }, error: null }),
          unenroll: async () => ({ data: null, error: null }),
          challenge: async () => ({ data: { id: 'challenge-1' }, error: null }),
          verify: async () => ({ data: null, error: null }),
          getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: 'aal1', nextLevel: 'aal1' }, error: null }),
        },
      },
      // ΤΟ `on` ΕΠΙΣΤΡΕΦΕΙ ΤΟ ΙΔΙΟ ΤΟ ΚΑΝΑΛΙ, γιατί έτσι κάνει το Supabase και
      // έτσι το γράφει ο κώδικας: το PortfolioTab αλυσιδώνει πέντε `.on()`.
      // Η πρώτη εκδοχή επέστρεφε `{subscribe}`, οπότε το δεύτερο `.on()` έσκαγε
      // — σε component που καμία δοκιμή δεν είχε προσαρτήσει ποτέ.
      channel: () => channelDouble(),
      removeChannel: () => {},
      functions: { invoke: async () => ({ data: null, error: null }) },
      // ΟΙ ΣΥΝΑΡΤΗΣΕΙΣ ΤΗΣ ΒΑΣΗΣ. Χωρίς `rpc`, κάθε οθόνη που ρωτά τη βάση με
      // συνάρτηση (γραφεία, πύλη λογιστή) έσκαγε και η σκηνή έβγαινε κενή. Η
      // απάντηση ανά σκηνή έρχεται από το `window.__rpc`· χωρίς αυτό, κενό.
      rpc: async (fn: string, args?: unknown) =>
        ((globalThis as { __rpc?: (fn: string, args?: unknown) => Answer | undefined }).__rpc?.(fn, args)) ?? { data: null, error: null },
      // ═══ Ο ΑΠΟΘΗΚΕΥΤΙΚΟΣ ΧΩΡΟΣ ΕΛΕΙΠΕ ΚΑΙ ΕΡΙΧΝΕ ΟΛΟΚΛΗΡΗ ΤΗΝ ΟΘΟΝΗ ══════
      // Μόλις ο πάγκος απέκτησε έγγραφα, ο Φάκελος Ακινήτου έσκασε με «Cannot
      // read properties of undefined (reading 'from')»: ζητά υπογεγραμμένους
      // συνδέσμους από το `supabase.storage`, που ο διπλός δεν είχε καθόλου. Το
      // κείμενο της σκηνής έπεσε από 1.922 σε 439 χαρακτήρες, δηλαδή έμεινε
      // μόνο η κεφαλίδα· καμία μέτρηση δεν θα το είχε καταλάβει ως σφάλμα.
      //
      // Ο διπλός δεν ανεβάζει και δεν κατεβάζει τίποτα: επιστρέφει διαδρομές
      // αντί για συνδέσμους, ώστε η οθόνη να ακολουθήσει τον κανονικό της δρόμο.
      storage: {
        from: () => ({
          createSignedUrls: async (paths: string[]) =>
            ({ data: paths.map(path => ({ path, signedUrl: `blob:${path}`, error: null })), error: null }),
          createSignedUrl: async (path: string) => ({ data: { signedUrl: `blob:${path}` }, error: null }),
          getPublicUrl: (path: string) => ({ data: { publicUrl: `blob:${path}` } }),
          upload: async (path: string) => ({ data: { path }, error: null }),
          remove: async () => ({ data: [], error: null }),
        }),
      },
    },
    calls,
  };
}
