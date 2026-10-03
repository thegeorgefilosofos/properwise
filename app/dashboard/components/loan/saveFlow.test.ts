// ═══════════════════════════════════════════════════════════════════════════
// ΑΠΟΘΗΚΕΥΣΗ ΔΑΝΕΙΟΥ: ΤΟ ΜΗΝΥΜΑ ΛΕΕΙ ΤΙ ΕΓΙΝΕ (02.10.2026).
//
// Πριν: ο υπολογιστής έδειχνε «Το δάνειο αποθηκεύτηκε» και μετά από αποτυχία,
// και η αποθήκευση έλεγε «…και οι δόσεις προστέθηκαν στο Ημερολόγιο» και όταν
// οι δόσεις είχαν αποτύχει.
//
// Τρέξε: npx tsx app/dashboard/components/loan/saveFlow.test.ts
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { saveLoanFlow, loanSaveSuccessText, SCHEDULE_FAILED_AFTER_SAVE } from './saveFlow'

let pass = 0, fail = 0
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n) } }

;(async () => {
  const calls: string[] = []
  const add = (fails = false) => async () => { calls.push('add'); if (fails) throw new Error('insert') }
  const reload = async () => { calls.push('reload') }

  {
    calls.length = 0
    const r = await saveLoanFlow({ add: add(true), reload, schedule: async () => { calls.push('cal'); return true } })
    ok('αποτυχία δανείου: loan_failed', r.outcome === 'loan_failed' && r.error instanceof Error)
    ok('αποτυχία δανείου: ούτε φόρτωση ούτε δόσεις', calls.join() === 'add')
    ok('αποτυχία δανείου: κανένα μήνυμα επιτυχίας', loanSaveSuccessText(r.outcome) === null)
  }
  {
    const r = await saveLoanFlow({ add: add(), reload, schedule: async () => false })
    ok('αποτυχία δόσεων: schedule_failed', r.outcome === 'schedule_failed')
    ok('αποτυχία δόσεων: δεν λέει «προστέθηκαν»', loanSaveSuccessText(r.outcome) === null)
  }
  {
    const r = await saveLoanFlow({ add: add(), reload, schedule: async () => true })
    ok('όλα καλά: saved_with_schedule', r.outcome === 'saved_with_schedule')
    ok('όλα καλά: λέει και για τις δόσεις', /δόσεις προστέθηκαν/.test(loanSaveSuccessText(r.outcome) ?? ''))
  }
  {
    const r = await saveLoanFlow({ add: add(), reload, schedule: null })
    ok('ανενεργό δάνειο: saved', r.outcome === 'saved' && loanSaveSuccessText(r.outcome) === 'Το δάνειο αποθηκεύτηκε')
  }
  ok('το σφάλμα των δόσεων λέει ότι το δάνειο γράφτηκε', /δάνειο αποθηκεύτηκε/.test(SCHEDULE_FAILED_AFTER_SAVE))

  // ── Οι οθόνες δεν ξαναλένε το μήνυμα με δική τους φωνή ─────────────────────
  const calc = readFileSync(join(process.cwd(), 'app/dashboard/components/TabLoanCalculator.tsx'), 'utf8')
  const save = /async function handleSave\(\)\{[^\n]*/.exec(calc)?.[0] ?? ''
  ok('ο υπολογιστής βρέθηκε', save.length > 0)
  ok('ο υπολογιστής δεν λέει μόνος του «αποθηκεύτηκε»', !/notifyOk\(/.test(save))
  ok('ο υπολογιστής δεν λέει μόνος του «οι δόσεις προστέθηκαν»', !/onSaveToCalendar\([^)]*\);\s*notifyOk/.test(calc))
  const hook = readFileSync(join(process.cwd(), 'app/dashboard/components/loan/useLoan.ts'), 'utf8')
  ok('η αποθήκευση περνά από τη ροή', /saveLoanFlow\(/.test(hook))
  ok('οι δόσεις επιστρέφουν αν γράφτηκαν', /async function handleSaveCal\([^)]*\):Promise<boolean>/.test(hook))

  console.log(`\nsaveFlow.ts — ${pass} passed, ${fail} failed`)
  if (fail) process.exit(1)
})()
