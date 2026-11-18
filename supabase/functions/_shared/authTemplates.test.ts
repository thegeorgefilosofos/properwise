// npx tsx supabase/functions/_shared/authTemplates.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ EMAIL ΤΗΣ ΣΥΝΔΕΣΗΣ (Supabase) ΣΕ ΔΥΟ ΓΛΩΣΣΕΣ
// ─────────────────────────────────────────────────────────────────────────
// Η γεννήτρια (scripts/build-auth-templates.ts) γράφει σε κάθε αρχείο μια
// επιλογή γλώσσας (Go template) και δύο ολόκληρα έγγραφα. Εδώ φυλάγεται ότι:
//   · το ελληνικό έγγραφο είναι ΙΔΙΟ ως το byte με το αρχείο πριν από τα
//     αγγλικά (αποτύπωμα sha256 του προηγούμενου αρχείου)·
//   · το αγγλικό δεν έχει ελληνικό γράμμα στο ορατό κείμενο και κρατά την ίδια
//     μεταβλητή της Supabase (`{{ .ConfirmationURL }}`, `{{ .NewEmail }}`, `{{ .Token }}`)·
//   · η επιλογή διαβάζει πρώτα το `msg_locale` και μετά το `app_locale`.
// Η απόδοση με την ίδια τη μηχανή της Go έγινε τοπικά (OWNER-STEPS.md)· εδώ
// ελέγχεται η δομή, που είναι αυτή που μπορεί να ξεφύγει σε μια αλλαγή.
// ═══════════════════════════════════════════════════════════════════════════
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { TEMPLATE_FILES, greekDoc, englishDoc, bilingual, subjectsOf, LANG_PICK } from '../../../scripts/build-auth-templates.ts'

let pass = 0, fail = 0
const ok = (name: string, cond: boolean) => { if (cond) pass++; else { fail++; console.error('✗ ' + name) } }
const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 16)
const GREEK = /[\p{Script=Greek}]/u

/** Τα ελληνικά αρχεία όπως ήταν πριν από τα αγγλικά (χωρίς την τελική αλλαγή γραμμής). */
const EL_SHA: Record<string, string> = {
  'confirm-signup.html': '2e5ecb6c8db0bb1f',
  'reset-password.html': '6423b4e5a5013bd2',
  'change-email.html': '8466a70f78609826',
  'invite.html': '25699813b2922c9f',
  'magic-link.html': '2dfbd5deb95e7b8e',
  'reauthentication.html': '1fc28ca6f84bf971',
}

const cut = (html: string, open: string, close: string) => {
  let res = '', i = 0
  for (;;) {
    const a = html.indexOf(open, i)
    if (a < 0) return res + html.slice(i)
    const b = html.indexOf(close, a + open.length)
    res += html.slice(i, a) + ' '
    if (b < 0) return res
    i = b + close.length
  }
}
const visible = (html: string) => cut(cut(cut(html, '<style', '</style>'), '<!--', '-->'), '<', '>')
const vars = (s: string) => (s.match(/\{\{ \.[A-Za-z]+ \}\}/g) || []).sort().join()

ok('έξι πρότυπα', TEMPLATE_FILES.length === 6)
ok('η επιλογή: πρώτα το app_locale, μετά το msg_locale από πάνω του', LANG_PICK.indexOf('.Data.app_locale') < LANG_PICK.indexOf('.Data.msg_locale') && LANG_PICK.includes('{{ $en = eq .Data.msg_locale "en" }}'))
for (const f of TEMPLATE_FILES) {
  const el = greekDoc(f), en = englishDoc(f)
  ok(`${f}: τα ελληνικά ίδια ως το byte`, sha(el) === EL_SHA[f])
  ok(`${f}: το αρχείο είναι η επιλογή και τα δύο έγγραφα`, readFileSync(`supabase/auth-templates/${f}`, 'utf8') === bilingual(en, el) + '\n')
  ok(`${f}: αγγλικά χωρίς ελληνικό γράμμα`, !GREEK.test(visible(en).replace(/\{\{[^}]*\}\}/g, '')))
  ok(`${f}: <html lang="en">`, en.includes('<html lang="en"'))
  ok(`${f}: ίδιες μεταβλητές της Supabase`, vars(en) === vars(el) && vars(el).length > 0)
  const s = subjectsOf(f)
  ok(`${f}: αγγλικό θέμα χωρίς ελληνικό γράμμα`, !!s.en && !GREEK.test(s.en))
}
const themata = readFileSync('supabase/auth-templates/THEMATA.txt', 'utf8')
for (const f of TEMPLATE_FILES) ok(`${f}: το θέμα και στις δύο γλώσσες στο THEMATA.txt`, themata.includes(bilingual(subjectsOf(f).en, subjectsOf(f).el)))

console.log(`authTemplates: ${pass} ✓ · ${fail} ✗`)
if (fail) process.exit(1)
