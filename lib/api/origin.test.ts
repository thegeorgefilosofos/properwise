// npx tsx lib/api/origin.test.ts
//
// ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΓΕΝΝΑ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ. `grep -ril csrf` σε ολόκληρο το
// αποθετήριο: μηδέν αρχεία. Η διαδρομή που διαγράφει λογαριασμό δήλωνε
// `export async function POST()` χωρίς παράμετρο αιτήματος, δηλαδή ο έλεγχος
// προέλευσης ήταν δομικά αδύνατος. Καθε έλεγχος εδώ θα ΕΠΕΦΤΕ πριν.
import { sameOrigin, targetHost, ORIGIN_DENIED } from './origin'

let pass = 0, fail = 0
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n) } }

const SITE = 'properwise.gr'
const h = (v: Record<string, string>) => new Headers(v)

// ── ΤΟΠΙΚΗ ΑΝΑΠΤΥΞΗ: ΚΑΝΕΝΑ DOMAIN ΔΕΝ ΕΙΝΑΙ ΚΑΡΦΩΜΕΝΟ ────────────────────
ok('localhost προς localhost',
  sameOrigin(h({ origin: 'http://localhost:3000', host: 'localhost:3000' }), SITE))
ok('η θύρα μετράει: 3001 προς 3000 δεν περνά',
  !sameOrigin(h({ origin: 'http://localhost:3001', host: 'localhost:3000' }), SITE))

// ── PREVIEW DEPLOYMENT: ΤΥΧΑΙΟΣ ΥΠΟΤΟΜΕΑΣ, ΧΩΡΙΣ ΡΥΘΜΙΣΗ ──────────────────
// Ο υποτομέας αλλάζει σε κάθε προεπισκόπηση. Καμία λίστα δεν θα τον ήξερε.
ok('preview προς τον εαυτό του', sameOrigin(h({
  origin: 'https://property-git-claude-x1y2.vercel.app',
  'x-forwarded-host': 'property-git-claude-x1y2.vercel.app',
  host: 'iad1.func.internal',
}), SITE))
ok('άλλο preview της ίδιας πλατφόρμας ΔΕΝ περνά', !sameOrigin(h({
  origin: 'https://allo-ergo.vercel.app',
  'x-forwarded-host': 'property-git-claude-x1y2.vercel.app',
}), SITE))

// ΤΟ ΠΡΟΩΘΗΜΕΝΟ ΝΙΚΑΕΙ ΤΟ ΑΠΕΥΘΕΙΑΣ. Στο Vercel το `host` είναι ο εσωτερικός
// υπολογιστής της συνάρτησης: αν τον προτιμούσαμε, καμία γνήσια κλήση δεν θα
// περνούσε ποτέ στην παραγωγή.
ok('το x-forwarded-host κρίνει',
  targetHost(h({ 'x-forwarded-host': 'properwise.gr', host: 'iad1.func.internal' })) === 'properwise.gr')
ok('χωρίς προωθημένο, κρίνει το host',
  targetHost(h({ host: 'localhost:3000' })) === 'localhost:3000')
ok('χωρίς καμία από τις δύο, κενό', targetHost(h({})) === '')

// ── Η ΚΑΝΟΝΙΚΗ ΔΙΕΥΘΥΝΣΗ ΓΙΝΕΤΑΙ ΔΕΚΤΗ ΚΑΙ ΠΙΣΩ ΑΠΟ CDN ───────────────────
ok('η κανονική διεύθυνση περνά ακόμη κι όταν το host λέει αλλιώς',
  sameOrigin(h({ origin: 'https://properwise.gr', host: 'esoteriko.local' }), SITE))

// ── Η ΞΕΝΗ ΣΕΛΙΔΑ ────────────────────────────────────────────────────────
// Αυτό ακριβώς στέλνει ένα `<form method="post">` από άλλον τόπο.
ok('ξένη προέλευση δεν περνά',
  !sameOrigin(h({ origin: 'https://kako.gr', host: 'properwise.gr' }), SITE))
ok('υποτομέας που μοιάζει δικός μας δεν περνά',
  !sameOrigin(h({ origin: 'https://properwise.gr.kako.gr', host: 'properwise.gr' }), SITE))
ok('ίδιο όνομα με άλλη κατάληξη δεν περνά',
  !sameOrigin(h({ origin: 'https://properwise.gr.com', host: 'properwise.gr' }), SITE))
ok('το «null» ενός απομονωμένου πλαισίου δεν περνά',
  !sameOrigin(h({ origin: 'null', host: 'properwise.gr' }), SITE))
ok('προέλευση που δεν είναι διεύθυνση δεν περνά',
  !sameOrigin(h({ origin: 'oxi diefthynsi', host: 'properwise.gr' }), SITE))

// ── ΧΩΡΙΣ «Origin»: ΜΟΝΟ Η ΒΕΒΑΙΩΣΗ ΤΟΥ ΙΔΙΟΥ ΤΟΥ ΠΕΡΙΗΓΗΤΗ ───────────────
ok('sec-fetch-site: same-origin περνά',
  sameOrigin(h({ host: 'properwise.gr', 'sec-fetch-site': 'same-origin' }), SITE))
ok('sec-fetch-site: cross-site δεν περνά',
  !sameOrigin(h({ host: 'properwise.gr', 'sec-fetch-site': 'cross-site' }), SITE))
ok('sec-fetch-site: same-site δεν περνά',
  !sameOrigin(h({ host: 'properwise.gr', 'sec-fetch-site': 'same-site' }), SITE))
// ΤΟ ΚΛΕΙΣΤΟ ΕΙΝΑΙ ΕΠΙΛΟΓΗ: γυμνό αίτημα χωρίς καμία από τις δύο κεφαλίδες
// δεν το στέλνει περιηγητής, οπότε δεν χάνει τίποτα ο χρήστης.
ok('χωρίς καμία κεφαλίδα προέλευσης δεν περνά', !sameOrigin(h({ host: 'properwise.gr' }), SITE))

// ── ΤΑ ΚΕΦΑΛΑΙΑ ΔΕΝ ΕΙΝΑΙ ΔΙΑΦΟΡΑ ────────────────────────────────────────
ok('η σύγκριση αγνοεί πεζά και κεφαλαία',
  sameOrigin(h({ origin: 'https://PROPERWISE.GR', host: 'properwise.gr' }), SITE))

// ── ΤΟ ΜΗΝΥΜΑ ────────────────────────────────────────────────────────────
// Ενα μήνυμα, καμία διάκριση αιτίας: η διαφορά θα δίδασκε τον επιτιθέμενο.
ok('το μήνυμα άρνησης είναι ελληνικό και δεν λέει τον λόγο',
  ORIGIN_DENIED.length > 20 && !/origin|csrf|header/i.test(ORIGIN_DENIED))

console.log(fail === 0 ? `✓ api/origin: ${pass} έλεγχοι πέρασαν` : `✗ api/origin: ${fail} απέτυχαν από ${pass + fail}`)
if (fail > 0) process.exit(1)
