// npx tsx lib/support/form.test.ts
//
// Η φόρμα υποστήριξης: τι δέχεται και ότι η διαδρομή της ελέγχει χρήστη,
// δίνει την προτεραιότητα από τη βάση και δεν γράφει δεδομένα χρήστη σε logs.
import { readFileSync } from 'node:fs'
import { checkSupport, SUPPORT_MESSAGE_MIN, SUPPORT_MESSAGE_MAX, SUPPORT_SUBJECT_MAX } from './form'

let pass = 0, fail = 0
const ok = (name: string, cond: boolean) => { if (cond) pass++; else { fail++; console.error(`✗ ${name}`) } }

const good = checkSupport({ subject: ' Πρόβλημα\r\nBcc: x@y ', message: 'Δεν βλέπω τις δαπάνες του μήνα.' })
ok('δεκτό μήνυμα, θέμα σε μία γραμμή', good.ok && !/[\r\n]/.test(good.value.subject))
ok('χωρίς θέμα: προεπιλογή', (() => { const r = checkSupport({ message: 'Δεν βλέπω τις δαπάνες.' }); return r.ok && r.value.subject.length > 0 })())
ok('πολύ μικρό μήνυμα: όχι', !checkSupport({ message: 'x'.repeat(SUPPORT_MESSAGE_MIN - 1) }).ok)
ok('πολύ μεγάλο μήνυμα: όχι', !checkSupport({ message: 'x'.repeat(SUPPORT_MESSAGE_MAX + 1) }).ok)
ok('πολύ μεγάλο θέμα: όχι', !checkSupport({ subject: 'x'.repeat(SUPPORT_SUBJECT_MAX + 1), message: 'x'.repeat(20) }).ok)

const route = readFileSync('app/api/support/route.ts', 'utf8')
const code = route.replace(/^\s*\/\/.*$/gm, '')
ok('ίδια προέλευση', code.includes('if (!sameOrigin(request.headers))'))
ok('συνεδρία και δεύτερο βήμα πριν από οτιδήποτε άλλο',
  code.indexOf('auth.getUser()') > 0 && code.indexOf('requireSecondStep(') > code.indexOf('auth.getUser()')
  && code.indexOf('requireSecondStep(') < code.indexOf("rpc('support_submit'"))
ok('το πακέτο και η διεύθυνση έρχονται από τη βάση (support_submit, ρόλος υπηρεσίας, ρητός χρήστης)',
  code.includes("admin.rpc('support_submit', {") && code.includes('p_user_id: user.id') && code.includes('replyTo: saved.email')
  && !code.includes("supabase.rpc('support_submit'"))
ok('ίδιο μήνυμα: ίδιο κλειδί στη βάση και στον πάροχο, τίποτα δεύτερο αν έφυγε',
  code.includes("createHash('sha256')") && code.includes('p_dedupe: dedupe') && code.includes('key: forwardKey(`form/' + '$' + '{dedupe}`)')
  && code.includes('if (saved.duplicate && saved.forwarded) return'))
ok('αβέβαιη αποστολή: η γραμμή μένει (uncertain), δεν αποσύρεται',
  /if \(fwd\.uncertain\) \{[\s\S]*?forward_error: 'uncertain'[\s\S]*?return fallback/.test(code)
  && code.indexOf("forward_error: 'uncertain'") < code.indexOf("admin.rpc('support_withdraw'"))
ok('η προώθηση: θέμα επαληθευμένου, σπουδαιότητα μόνο όταν το δικαιούται', code.includes('subject: forwardSubject(checked.value.subject, priority, true)') && code.includes('urgent: priority.claimed'))
ok('όριο ρυθμού: 429', code.includes("'rate_limited'") && code.includes('status: 429'))
ok('μήνυμα που σίγουρα δεν έφυγε αποσύρεται, για να μη χρεώνεται στο όριο', code.includes("await admin.rpc('support_withdraw', { p_user_id: user.id, p_id: saved.id })"))
const logs = [...code.matchAll(/log\(([^;]*)\);/g)].map(m => m[1]).join(' ')
ok('κανένα δεδομένο χρήστη στα logs', !/email|subject|message|user\.|checked\.value|saved\./.test(logs))

console.log(`support/form: ${pass} ✓ · ${fail} ✗`)
if (fail) process.exit(1)
