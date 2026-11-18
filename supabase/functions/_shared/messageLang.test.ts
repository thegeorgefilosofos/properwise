// npx tsx supabase/functions/_shared/messageLang.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΜΗΝΥΜΑΤΑ ΣΕ ΔΥΟ ΓΛΩΣΣΕΣ: ΤΑ ΕΛΛΗΝΙΚΑ ΜΕΝΟΥΝ ΙΔΙΑ ΩΣ ΤΟ BYTE
// ─────────────────────────────────────────────────────────────────────────
// Κάθε πρότυπο αποδίδεται με σταθερά δεδομένα δύο φορές:
//   · στα ελληνικά το αποτύπωμα (sha256) πρέπει να είναι ΑΚΡΙΒΩΣ αυτό που
//     έδινε ο κώδικας πριν μπουν τα αγγλικά (καταγράφηκε πάνω στο main πριν
//     αλλάξει γραμμή)·
//   · στα αγγλικά το ορατό κείμενο δεν έχει ελληνικό γράμμα, εκτός από τα
//     κύρια ονόματα που εξηγούνται δίπλα τους (ΕΝΦΙΑ κ.λπ.) και ό,τι έγραψε ο
//     ίδιος ο χρήστης (τίτλος γεγονότος, όνομα ακινήτου).
// Αν αλλάξει σκόπιμα ελληνικό κείμενο, το αποτύπωμα ξαναγράφεται στο ίδιο PR
// και η αλλαγή φαίνεται στη διαφορά.
// ═══════════════════════════════════════════════════════════════════════════
import { createHash } from 'node:crypto'
import { FIXTURES } from './messageFixtures.ts'
import { emailShell, button } from './emailTemplates.ts'

let pass = 0, fail = 0
const ok = (name: string, cond: boolean) => { if (cond) pass++; else { fail++; console.error('✗ ' + name) } }
const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 16)

/** Τα αποτυπώματα των ελληνικών, από τον κώδικα πριν από τα αγγλικά. */
const EL_SHA: Record<string, string> = {
  'shell-default': '9e388bc251e41e01',
  'shell-unsub': '132a1c48fc98f7c4',
  'shell-footer': '22a4ec8a7d501cf9',
  'reminder-7days-1': '4acba30a0f7f085e',
  'reminder-7days-3': '9b5aaf8c1e8f55c8',
  'reminder-3days-1': '3f0cb23d3063191c',
  'reminder-3days-3': 'fe5e55eb67e3dddd',
  'reminder-1day-1': 'fdb5721f0a01cbda',
  'reminder-1day-3': 'fcc5b0a1344c5ab4',
  'reminder-today-1': '5838f741a4bef5ea',
  'reminder-today-3': 'c6d847e7c20f9324',
  'reminder-overdue-1': '21d3a1c94db3816c',
  'reminder-overdue-3': '3d5c4b7312f8e061',
  'dunning-1': '961b5ccb41d8f991',
  'dunning-2': 'd703ef3148a431f8',
  'dunning-3': '96fe596151c03257',
  'welcome-free': '25efdf2d1a3f97e8',
  'welcome-individual': '39b25fb6dcc05614',
  'welcome-professional': 'a5837f83c96fa5ac',
  'upgraded-solo': '8f68137f7f7081ce',
  'upgraded-owner': 'ee99725b1e98b902',
  'upgraded-agency': '8a8c9a408e5b38d6',
  'upgraded-office': 'bb60c91150b78913',
  'downgraded-free': '7f681cc779145366',
  'downgraded-owner': '6ebf7fba3188f1b8',
  'new-property': 'dc2e343ce7535787',
  'feedback': '4b7f0fd00f57328a',
  'mobile-launch': '65230bf96fdd4a8f',
  'referral': '5e895832e4aed51d',
  'upsell': 'd8dabc288181f470',
  'upsell-disc': '8ec84efad51b75f6',
  'legislation': 'b302f9dbd1b232c4',
  'seasonal': 'bb6bda879beef15e',
  'client-message': '19afea448e61dc7d',
  'client-message-anon': '413822d91f3f9bfc',
}

if (process.argv.includes('--print')) {
  for (const f of FIXTURES) console.log(`  '${f.name}': '${sha(f.el())}',`)
  process.exit(0)
}

for (const f of FIXTURES) ok(`ελληνικά ίδια: ${f.name}`, EL_SHA[f.name] === sha(f.el()))

// ── Τα αγγλικά: ορατό κείμενο χωρίς ελληνικό γράμμα ──────────────────────
// Ορατό = ό,τι μένει χωρίς <style>, σχόλια (υποθετικά του Outlook) και ετικέτες.
// Σάρωση με θέσεις, όχι με regex που κόβει ετικέτες (CodeQL).
const GREEK = /[\p{Script=Greek}]/u
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
/** Κύρια ονόματα που μένουν ελληνικά και εξηγούνται δίπλα τους. Κανένα ακόμη στα πρότυπα αυτά. */
const GLOSSED: string[] = []
const english = FIXTURES.filter(f => f.en)
ok('υπάρχουν αγγλικά πρότυπα', english.length >= 14)
for (const f of english) {
  const en = f.en!()
  let text = visible(en)
  for (const g of GLOSSED) text = text.split(g).join('')
  const m = GREEK.exec(text)
  ok(`αγγλικά χωρίς ελληνικό γράμμα: ${f.name}${m ? ` («${text.slice(Math.max(0, m.index - 30), m.index + 30).trim()}»)` : ''}`, !m)
  ok(`αγγλικά διαφέρουν: ${f.name}`, en !== f.el())
  // Ολόκληρο έγγραφο (το κέλυφος, με τα xmlns του Outlook): δηλώνει τη γλώσσα του.
  if (en.includes('xmlns:v=')) ok(`lang="en": ${f.name}`, en.includes('lang="en" dir="ltr"'))
}

// ── Τα γεγονότα μένουν ίδια: ποσά και ημερομηνίες σε ελληνική μορφή ───────
const r3 = FIXTURES.find(f => f.name === 'reminder-7days-3')!
ok('ίδια ποσά και στις δύο γλώσσες', ['123,45€', '1.234,50€', '1.357,95€', '30/11/2026', '01/12/2026'].every(x => r3.el().includes(x) && r3.en!().includes(x)))
ok('η φορολογική προθεσμία παίρνει τίτλο από το είδος της', r3.en!().includes('ENFIA: 4th installment'))
ok('ο τίτλος του χρήστη μένει όπως τον έγραψε', r3.en!().includes('Boiler service'))
const d2 = FIXTURES.find(f => f.name === 'dunning-2')!.en!()
ok('η όχληση λέει τη σειρά της', d2.includes('Second reminder') && d2.includes('notice no. 2') && d2.includes('1.650,50€'))

// ── Τιμή σε ιδιότητα: κανένα εισαγωγικό δεν σπάει το href (CodeQL) ─────
const evil = emailShell({ bodyHtml: button('x', 'https://a.example/"onmouseover="x'), unsubUrl: 'https://a.example/u"><script>' })
ok('το εισαγωγικό στο href διαφεύγεται', !evil.includes('"onmouseover') && evil.includes('&quot;onmouseover') && !evil.includes('<script>'))
ok('απεγγραφή μόνο https/mailto', !emailShell({ bodyHtml: '', unsubUrl: 'javascript:alert(1)' }).includes('javascript:'))

console.log(`messageLang: ${pass} ✓ · ${fail} ✗`)
if (fail) process.exit(1)
