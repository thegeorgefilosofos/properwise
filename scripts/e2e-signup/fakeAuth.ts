// Ο ΠΕΛΑΤΗΣ ΤΑΥΤΟΤΗΤΑΣ, ΨΕΥΤΙΚΟΣ. Το μόνο ψεύτικο κομμάτι του πάγκου: όλα τα
// υπόλοιπα είναι ο κώδικας της παραγωγής. Η εγγραφή πετυχαίνει πάντα, γιατί
// αυτό που δοκιμάζεται εδώ είναι τι κάνει η ΟΘΟΝΗ μετά την επιτυχία.
type Ok = { error: null }
type Funnel = { __funnel?: Record<string, unknown>[] }
export async function authClient() {
  return {
    // Το χωνί της εγγραφής: κάθε κλήση μένει στο `window.__funnel` για να τη
    // διαβάσει ο πάγκος.
    rpc: async (fn: string, args: Record<string, unknown>): Promise<Ok> => {
      ((window as Funnel).__funnel ??= []).push({ fn, ...args })
      return { error: null }
    },
    auth: {
      // Μετριέται: χωρίς συνεδρία η σελίδα δεν επιτρέπεται να ρωτήσει καθόλου.
      getUser: async () => {
        const w = window as { __getUser?: number }
        w.__getUser = (w.__getUser ?? 0) + 1
        return { data: { user: null } }
      },
      getSession: async () => ({ data: { session: null } }),
      // Κάθε εγγραφή μετριέται: δύο πατήματα δεν επιτρέπεται να δώσουν δύο.
      signUp: async (): Promise<Ok> => {
        const w = window as { __signups?: number }
        w.__signups = (w.__signups ?? 0) + 1
        return { error: null }
      },
      resend: async (): Promise<Ok> => ({ error: null }),
      updateUser: async (): Promise<Ok> => ({ error: null }),
      signInWithOAuth: async (): Promise<Ok> => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  }
}

// Προεπιλογή «ίσως»: ο πάγκος περνά από τον ψεύτικο `getUser()` όπως πριν, ώστε
// να ελέγχεται και η διαδρομή «είσαι ήδη συνδεδεμένος». Με
// `window.__mayHaveSession = false` ελέγχεται η διαδρομή του ανώνυμου επισκέπτη,
// όπου ο πελάτης δεν φορτώνει καθόλου. Η πραγματική απόφαση (cookie και
// διεύθυνση) ελέγχεται στο lib/supabase/lazy.test.ts.
export function mayHaveSession(): boolean {
  return (window as { __mayHaveSession?: boolean }).__mayHaveSession !== false
}
