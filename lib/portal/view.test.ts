// npx tsx lib/portal/view.test.ts
//
// ΤΙ ΦΥΛΑΓΕΤΑΙ. Η πύλη ενοικιαστή λέει πρώτα ποιο σπίτι είναι, μετά πόσα
// χρωστά ΜΑΖΙ με το πώς πληρώνει, μετά το αίτημα. Ο σύνδεσμος πληρωμής δεν
// γίνεται κουμπί αν δεν είναι https. Μετά από ένα αίτημα ο ενοικιαστής μπορεί
// να στείλει δεύτερο χωρίς να ξαναφορτώσει τη σελίδα (και να ξαναγράψει τον
// κωδικό). Τα αγγλικά έχουν κάθε λέξη που χρησιμοποιεί η σελίδα.
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { payLink, groupIban, hasDue } from './view'
import { PORTAL_EN } from '../i18n/en/recipients'

let pass = 0, fail = 0
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n) } }

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
const src = readFileSync(join(ROOT, 'app/portal/[token]/page.tsx'), 'utf8')

// ── 1. Ο ΣΥΝΔΕΣΜΟΣ ΠΛΗΡΩΜΗΣ ─────────────────────────────────────────────────
ok('https: κουμπί', payLink('https://pay.example.com/x') === 'https://pay.example.com/x')
ok('http: όχι', payLink('http://pay.example.com') === null)
ok('javascript: όχι', payLink('javascript:alert(1)') === null)
ok('κενό: όχι', payLink('') === null && payLink(null) === null && payLink(42) === null)

// ── 2. Ο IBAN ──────────────────────────────────────────────────────────────
ok('τετράδες', groupIban('GR1601101250000000012300695') === 'GR16 0110 1250 0000 0001 2300 695')
ok('χωρίς κενό στο τέλος', groupIban('GR160110') === 'GR16 0110')
ok('ήδη με κενά: ίδιο αποτέλεσμα', groupIban('GR16 0110 1250') === 'GR16 0110 1250')
ok('η σελίδα αντιγράφει την αρχική τιμή, όχι τις τετράδες', /copyIban\(data\.tenant\.rent_iban as string\)/.test(src))
ok('η σελίδα δείχνει τις τετράδες', /groupIban\(/.test(src))

// ── 3. Η ΟΦΕΙΛΗ ────────────────────────────────────────────────────────────
ok('ποσό και μήνες: οφειλή', hasDue({ total_due: 650, due: [{}] }))
ok('μηδέν: όχι', !hasDue({ total_due: 0, due: [{}] }))
ok('χωρίς μήνες: όχι', !hasDue({ total_due: 650, due: [] }))

// ── 4. Η ΣΕΙΡΑ ΣΤΗ ΣΕΛΙΔΑ ───────────────────────────────────────────────────
// Ποιο σπίτι, πόσα και πώς, αίτημα· η μίσθωση για αναφορά τελευταία.
const PORTAL_ORDER = ['place', 'money', 'request', 'lease']
const at = (id: string) => src.indexOf(`data-section="${id}"`)
const marks = PORTAL_ORDER.map(at)
ok('κάθε ενότητα σημαδεμένη στη σελίδα', marks.every(i => i > 0))
ok('η σελίδα ακολουθεί τη σειρά', marks.every((v, i) => i === 0 || v > marks[i - 1]))
// Το «Πληρωμή τώρα» πριν από το «Δήλωσα την πληρωμή»: πρώτα πληρώνεις, μετά δηλώνεις.
const pay = src.indexOf("'Πληρωμή τώρα'") > 0 ? src.indexOf("'Πληρωμή τώρα'") : src.indexOf('Πληρωμή τώρα')
ok('πρώτα «Πληρωμή τώρα», μετά «Δήλωσα την πληρωμή»', pay > 0 && pay < src.indexOf("'Δήλωσα την πληρωμή'"))
ok('ένας τρόπος πληρωμής, όχι δύο αντίγραφα', (src.match(/payNowNote/g) || []).length === 1)

// ── 5. ΔΕΥΤΕΡΟ ΑΙΤΗΜΑ ──────────────────────────────────────────────────────
ok('μετά την αποστολή: «Νέο αίτημα»', /'Νέο αίτημα'/.test(src) && /E\.newRequest/.test(src))
ok('το «Νέο αίτημα» ξανανοίγει τη φόρμα', /const newRequest = \(\) => \{[^}]*setSent\(false\)/.test(src))
ok('η επιβεβαίωση ανακοινώνεται', /role="status"/.test(src))

// ── 6. ΤΟ ΤΗΛΕΦΩΝΟ ─────────────────────────────────────────────────────────
const phone = src.match(/<input id="portal-contact"[\s\S]*?\/>/)?.[0] ?? ''
ok('πληκτρολόγιο τηλεφώνου', /type="tel"/.test(phone) && /autoComplete="tel"/.test(phone))

// ── 7. ΤΑ ΑΓΓΛΙΚΑ ──────────────────────────────────────────────────────────
const used = new Set([...src.matchAll(/\bE\??\.(\w+)/g)].map(m => m[1]))
const missing = [...used].filter(k => !(k in PORTAL_EN))
ok(`κάθε E.x υπάρχει στο PORTAL_EN (λείπουν: ${missing.join(', ')})`, missing.length === 0)
const unused = Object.keys(PORTAL_EN).filter(k => !used.has(k))
ok(`καμία νεκρή λέξη στο PORTAL_EN (περισσεύουν: ${unused.join(', ')})`, unused.length === 0)

// ── 8. ΤΑ ΑΜΕΤΑΚΙΝΗΤΑ ───────────────────────────────────────────────────────
const layout = readFileSync(join(ROOT, 'app/portal/[token]/layout.tsx'), 'utf8')
ok('noindex μένει', /NOINDEX as metadata/.test(layout))
ok('ο κωδικός ταξιδεύει σε κάθε εγγραφή', (src.match(/okPin\)/g) || []).length >= 2 && /pin: okPin/.test(src))

console.log(`view: ${pass} ✓, ${fail} ✗`)
if (fail) process.exit(1)
