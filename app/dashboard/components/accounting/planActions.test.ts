// ═══════════════════════════════════════════════════════════════════════════
// ΤΙ ΒΡΙΣΚΕΙ ΚΑΘΕ ΠΑΚΕΤΟ ΣΤΙΣ «ΑΝΑΦΟΡΕΣ ΚΑΙ ΕΝΕΡΓΕΙΕΣ» ΤΗΣ ΛΟΓΙΣΤΙΚΗΣ
// ─────────────────────────────────────────────────────────────────────────
// Η εισαγωγή κινήσεων τράπεζας ανοίγει από «Ιδιοκτήτης+» (απόφαση ιδιοκτήτη
// 24/11/2026) και ζει στη λογιστική του ιδιώτη, εκεί που ζουν τα ενοίκια και
// οι δαπάνες: δεν κρέμεται από τον επαγγελματικό τρόπο. Η σύνθεση αναφοράς και
// η κατανομή σε συνιδιοκτήτες μένουν στο «Επαγγελματίας».
// Τρέξε: npx tsx app/dashboard/components/accounting/planActions.test.ts
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { planActions } from './planActions'

let pass = 0, fail = 0
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n) } }
const src = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

// ── Ανά πακέτο ─────────────────────────────────────────────────────────────
ok('Ιδιοκτήτης: χωρίς εισαγωγή', planActions('free').bankImport === false)
ok('Ιδιοκτήτης με Νόα: χωρίς εισαγωγή', planActions('solo').bankImport === false)
ok('Ιδιοκτήτης+: με εισαγωγή', planActions('owner').bankImport === true)
ok('Ιδιοκτήτης+: χωρίς σύνθεση αναφοράς', planActions('owner').portfolioReport === false)
ok('Ιδιοκτήτης+: χωρίς κατανομή σε συνιδιοκτήτες', planActions('owner').ownerSplit === false)
ok('Ιδιοκτήτης+: χωρίς ημερολόγιο άρθρων', planActions('owner').journal === false)
for (const p of ['agency', 'office'] as const) {
  const a = planActions(p)
  ok(`${p}: όλα ανοιχτά`, a.bankImport && a.portfolioReport && a.ownerSplit && a.journal)
}

// ── Η οθόνη ρωτά ΜΟΝΟ το πακέτο ───────────────────────────────────────────
// Η γραμμή του μενού στη λογιστική κρέμεται από το `canBankImport` και από
// τίποτα άλλο: ούτε `mode === 'professional'` ούτε τύπο προφίλ.
{
  const tab = src('app/dashboard/components/TabAccounting.tsx')
  const at = tab.indexOf("key:'bank'")
  ok('η εισαγωγή υπάρχει στο μενού της λογιστικής', at > 0)
  const guard = tab.lastIndexOf('...(', at)
  ok('η γραμμή κρέμεται μόνο από το canBankImport', tab.slice(guard, at).replace(/\s+/g, '') === '...(canBankImport?[{')
  const hook = src('app/dashboard/components/accounting/useAccounting.ts')
  ok('η λογιστική παίρνει τα δικαιώματα από το planActions', /planActions\(plan\)/.test(hook))
}

console.log(fail ? `✗ planActions: ${fail} απέτυχαν από ${pass + fail}` : `✓ planActions: ${pass} έλεγχοι πέρασαν`)
if (fail) process.exit(1)
