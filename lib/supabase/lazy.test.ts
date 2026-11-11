// npx tsx lib/supabase/lazy.test.ts
//
// ΓΙΑΤΙ ΓΡΑΦΤΗΚΕ. Η εγγραφή και η σύνδεση δεν φορτώνουν πια τον πελάτη της
// βάσης όταν είναι βέβαιο ότι δεν υπάρχει συνεδρία. Το λάθος που φοβόμαστε
// είναι το ψευδώς «όχι»: συνδεδεμένος χρήστης, ή επιστροφή από την Google με
// `?code=`, που δεν θα έβλεπε ποτέ το «είσαι ήδη συνδεδεμένος» ή δεν θα
// ολοκλήρωνε τη σύνδεσή του. Γι' αυτό οι περισσότεροι έλεγχοι εδώ ζητούν «ίσως».
import { mayHaveSession } from './lazy'

let pass = 0, fail = 0
const ok = (name: string, cond: boolean) => { if (cond) pass++; else { fail++; console.error('✗ ' + name) } }

// ── Η ΣΥΝΕΔΡΙΑ ΣΤΟ COOKIE (μορφή @supabase/ssr) ─────────────────────────────
ok('cookie συνεδρίας → ίσως', mayHaveSession('sb-abcd1234-auth-token=base64-xyz', ''))
ok('κομματιασμένο cookie (.0) → ίσως', mayHaveSession('theme=dark; sb-abcd1234-auth-token.0=base64-a; sb-abcd1234-auth-token.1=b', ''))
ok('cookie στη μέση της λίστας → ίσως', mayHaveSession('a=1; sb-abcd1234-auth-token=x; b=2', ''))
ok('επαληθευτής PKCE της Google → ίσως', mayHaveSession('sb-abcd1234-auth-token-code-verifier=v', ''))

// ── Η ΣΥΝΕΔΡΙΑ ΣΤΗ ΔΙΕΥΘΥΝΣΗ ────────────────────────────────────────────────
ok('επιστροφή Google με ?code= → ίσως', mayHaveSession('', '?oauth=1&code=abc'))
ok('code ως πρώτη παράμετρος → ίσως', mayHaveSession('', '?code=abc'))
ok('σύνδεσμος με #access_token → ίσως', mayHaveSession('', '#access_token=t&type=signup'))
ok('token_hash από email → ίσως', mayHaveSession('', '?token_hash=h&type=email'))
ok('σφάλμα επιστροφής → ίσως', mayHaveSession('', '?error=access_denied'))
ok('σφάλμα στο hash → ίσως', mayHaveSession('', '#error=server_error'))
ok('oauth=login χωρίς code → ίσως', mayHaveSession('', '?oauth=login'))

// ── ΒΕΒΑΙΑ ΧΩΡΙΣ ΣΥΝΕΔΡΙΑ: εδώ γλιτώνονται τα 45 KB ─────────────────────────
ok('κανένα cookie, καμία παράμετρος → όχι', !mayHaveSession('', ''))
ok('άσχετα cookies → όχι', !mayHaveSession('theme=dark; pos-cookie-consent=1', ''))
ok('πακέτο και κωδικός συνεργάτη στη διεύθυνση → όχι', !mayHaveSession('', '?plan=pro&cycle=year&ref=AB12CD'))
ok('άλλο cookie που απλώς περιέχει «auth» → όχι', !mayHaveSession('myauth-token=1; sb_session=2', ''))
ok('παράμετρος που απλώς τελειώνει σε code → όχι', !mayHaveSession('', '?promocode=X'))
// ΕΠΙΤΗΔΕΣ «όχι»: η αποτυχημένη επιβεβαίωση (app/auth/callback → /login?confirm=failed)
// έρχεται χωρίς cookie και η σελίδα λέει τι πήγε στραβά ΧΩΡΙΣ τον πελάτη. Το
// μήνυμα τρέχει πριν από την πρόωρη έξοδο (app/login/page.tsx, `noSession`) και
// το ελέγχει ο πάγκος (scripts/e2e-signup.mjs, «ανώνυμος, ?confirm=failed»).
ok('?confirm=failed χωρίς cookie → όχι (το μήνυμα δεν θέλει πελάτη)', !mayHaveSession('', '?confirm=failed'))
ok('?next=… χωρίς cookie → όχι (διαβάζεται μετά την είσοδο, όχι εδώ)', !mayHaveSession('', '?next=/accountant/workspace'))

ok('έξω από browser, χωρίς ορίσματα → ίσως', mayHaveSession())

console.log(fail === 0 ? `✓ mayHaveSession: ${pass} έλεγχοι πέρασαν` : `✗ mayHaveSession: ${fail} απέτυχαν από ${pass + fail}`)
if (fail) process.exitCode = 1
