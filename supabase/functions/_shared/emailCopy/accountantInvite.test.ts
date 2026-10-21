// Τρέξε: npx tsx supabase/functions/_shared/emailCopy/accountantInvite.test.ts
//
// ΤΟ ΑΙΤΗΜΑ ΠΡΟΣΒΑΣΗΣ ΦΕΥΓΕΙ ΑΠΟ ΤΟ ΔΙΚΟ ΜΑΣ DOMAIN ΠΡΟΣ ΑΓΝΩΣΤΟΥΣ (έλεγχος
// 21/10/2026, εύρημα A). Ο,τι ισχυρίζεται το μήνυμα το ισχυρίζεται εκ μέρους
// μας: δεν λέει «ο λογιστής σου», δείχνει την επιβεβαιωμένη διεύθυνση του
// αποστολέα, το όνομα μόνο ως «δηλώνει» και ποτέ στο θέμα. Εχει υποσέλιδο
// με πολιτική απορρήτου (εύρημα C).
import { readFileSync, readdirSync } from 'node:fs'
import { LIFECYCLE } from './lifecycle.ts'
import { ACCOUNTANT_INVITE_RETENTION_DAYS } from '../accountantInvite.ts'

let passed = 0, failed = 0
function ok(name: string, cond: boolean, got?: unknown) {
  if (cond) passed++; else { failed++; console.log(`  ✗ ${name}${got === undefined ? '' : `\n     πήρε ${JSON.stringify(got)}`}`) }
}

const ctx = { name: 'Μαρία', appUrl: 'https://properwise.gr', accountantEmail: 'g.pap@example.gr', accountantName: 'ΑΑΔΕ Τμήμα Ελέγχου' }
const out = LIFECYCLE.accountant_invite(ctx as never) as { subject: string; html: string }
const text = out.html.replace(/<[^>]+>/g, ' ')

ok('το θέμα έχει τη διεύθυνση, όχι το ελεύθερο όνομα', out.subject.includes('g.pap@example.gr') && !out.subject.includes('ΑΑΔΕ'), out.subject)
ok('κανένα «ο λογιστής σου» σε θέμα ή κείμενο', !/λογιστής σου/i.test(out.subject + text))
ok('το όνομα μόνο ως «δηλώνει»', text.includes('δηλώνει «ΑΑΔΕ Τμήμα Ελέγχου»'))
ok('«Δέξου μόνο αν γνωρίζεις τον αποστολέα»', text.includes('Δέξου μόνο αν γνωρίζεις τον αποστολέα'))
ok('λέει τι θα δει', text.includes('ΑΦΜ') && text.includes('μισθωτήρια'))
ok('σύνδεσμος πολιτικής απορρήτου', out.html.includes('https://properwise.gr/privacy') && text.includes('Πολιτική απορρήτου'))
ok('λέει πόσο κρατιέται η διεύθυνση, από τη σταθερά', text.includes(`${ACCOUNTANT_INVITE_RETENTION_DAYS} ημέρες`))
ok('νομική βάση: έννομο συμφέρον, άρθρο 6§1στ', text.includes('έννομο συμφέρον') && text.includes('6§1στ'))
ok('δικαίωμα εναντίωσης: το «Όχι» σταματά τις επόμενες', text.includes('αντιταχθείς') && text.includes('δεν ξαναπαίρνεις πρόσκληση'))

// ── Η ΙΔΙΑ ΔΙΑΡΚΕΙΑ ΣΤΟ ΜΗΝΥΜΑ ΚΑΙ ΣΤΗ ΒΑΣΗ ────────────────────────────────────
// Η τελευταία μετάβαση που ορίζει την `private.accountant_invite_retention()`.
{
  const dir = 'supabase/migrations'
  const head = 'create or replace function private.accountant_invite_retention()'
  const file = readdirSync(dir).filter(f => f.endsWith('.sql')).sort().reverse()
    .find(f => readFileSync(`${dir}/${f}`, 'utf8').includes(head))
  const sql = file ? readFileSync(`${dir}/${file}`, 'utf8') : ''
  const body = sql.slice(sql.indexOf(head), sql.indexOf('$$;', sql.indexOf(head)) + 3)
  const days = Number(/interval '(\d+) days'/.exec(body)?.[1])
  ok('η βάση και το μήνυμα λένε τις ίδιες ημέρες', days === ACCOUNTANT_INVITE_RETENTION_DAYS, { file, days })
  ok('καμία σκέτη διάρκεια 90 ημερών στις συναρτήσεις της πρόσκλησης', !/interval '90 days'/.test(sql.replace(body, '')), file)
}

const bare = LIFECYCLE.accountant_invite({ appUrl: 'https://properwise.gr' } as never) as { subject: string; html: string }
ok('χωρίς διεύθυνση: ουδέτερο θέμα', bare.subject === 'Αίτημα πρόσβασης στον φάκελό σου στο PROPERWISE', bare.subject)

const evil = LIFECYCLE.accountant_invite({ appUrl: 'https://properwise.gr', accountantEmail: 'x@y.gr', accountantName: '<a href="//evil">κλικ</a>' } as never) as { html: string }
ok('το όνομα διαφεύγει', !evil.html.includes('<a href="//evil">'))

console.log(failed ? `✗ accountantInvite: ${failed} απέτυχαν από ${passed + failed}` : `✓ accountantInvite: ${passed} έλεγχοι πέρασαν`)
if (failed) process.exit(1)
