// npx tsx lib/assistant/chatError.test.ts
//
// ΤΟ ΠΑΚΕΤΟ ΧΩΡΙΣ ΤΗ ΝΟΑ ΔΕΝ ΕΙΝΑΙ ΒΛΑΒΗ.
// Εύρημα 11 του ελέγχου της 12.11.2026: το 403 `{ reason: 'plan' }` έπεφτε
// στη «βλάβη» και ο χρήστης διάβαζε «δοκίμασε ξανά σε λίγο».
import { readFileSync } from 'node:fs'
import { classifyChatError } from './chatError'
import { assistantLockedMessage } from '@/lib/billing/aiLimits'

let pass = 0, fail = 0
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n) } }

const LOCKED = assistantLockedMessage(true)

{
  const e = classifyChatError(403, { error: LOCKED, reason: 'plan', plan: 'free' })
  ok('403 του πακέτου: είδος «plan»', e.kind === 'plan')
  ok('και κρατά το μήνυμα του διακομιστή', e.message === LOCKED)
}
ok('403 χωρίς λόγο πακέτου: βλάβη', classifyChatError(403, { error: 'x' }).kind === 'service')
ok('403 βλάβης δεν δείχνει το κείμενό του', classifyChatError(403, { error: 'x' }).message === '')
ok('429: όριο, με το μήνυμα', classifyChatError(429, { error: 'Έφτασες το όριο.' }).kind === 'limit' && classifyChatError(429, { error: 'Έφτασες το όριο.' }).message === 'Έφτασες το όριο.')
ok('το κλειδί που λείπει', classifyChatError(500, { error: 'ANTHROPIC_API_KEY missing' }).kind === 'key')
ok('400: βλάβη με οδηγία', classifyChatError(400, { error: 'Πολύ μεγάλο.' }).message === 'Πολύ μεγάλο.')
ok('413: βλάβη με οδηγία', classifyChatError(413, { error: 'Πολύ μεγάλο.' }).kind === 'service')
ok('500: βλάβη χωρίς κείμενο', classifyChatError(500, { error: 'upstream' }).message === '')
ok('σώμα που δεν είναι αντικείμενο', classifyChatError(502, null).kind === 'service')

// ── Η ΣΥΝΟΜΙΛΙΑ ΚΑΙ ΤΟ ΠΑΝΕΛ ΤΟ ΧΡΗΣΙΜΟΠΟΙΟΥΝ ────────────────────────────
{
  const chat = readFileSync('app/dashboard/components/assistant/useAssistantChat.ts', 'utf8')
  const panel = readFileSync('app/dashboard/components/PropertyAssistant.tsx', 'utf8')
  ok('η συνομιλία κατατάσσει με το classifyChatError', chat.includes('classifyChatError(res.status, data)'))
  ok('το πάνελ έχει δικό του κλάδο για το πακέτο', panel.includes("err === 'plan'"))
  ok('και κουμπί προς τις Ρυθμίσεις', /err === 'plan' && \([\s\S]{0,200}onNavigate\('settings'\)/.test(panel))
}

console.log(fail === 0 ? `✓ chatError: ${pass} έλεγχοι πέρασαν` : `✗ chatError: ${fail} απέτυχαν από ${pass + fail}`)
if (fail > 0) process.exit(1)
