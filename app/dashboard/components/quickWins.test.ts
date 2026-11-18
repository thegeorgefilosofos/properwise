// ═══════════════════════════════════════════════════════════════════════════
// ΠΕΝΤΕ ΜΙΚΡΕΣ ΔΙΟΡΘΩΣΕΙΣ ΑΠΟ ΤΟΝ ΕΛΕΓΧΟ ΠΡΟΪΟΝΤΟΣ (17/11/2026)
// ─────────────────────────────────────────────────────────────────────────
// Κάθε έλεγχος εδώ κοκκινίζει στον παλιό κώδικα:
//   2. «Νέα δαπάνη» άνοιγε τον επιλογέα πριν από τη φόρμα (6 κλικ αντί για 5).
//   3. Ο σύνδεσμος για τον λογιστή ζούσε κρυμμένος στο «⋯»· η κάρτα της
//      Επισκόπησης και οι Ρυθμίσεις δεν είχαν δρόμο ως εκεί.
//   4. Η «ΕΝΦΙΑ, Nη δόση» χωρίς ποσό έστελνε στο Ημερολόγιο, όπου έλειπε ξανά.
//   5. Η μαζική μπάρα του γραφείου χανόταν με την κύλιση και το φίλτρο
//      «Με εκκρεμότητες» ήταν κλειστό ακόμη και με είκοσι πελάτες.
// (Το 1, η φόρμα του ενοικιαστή, ζει στο TabTenantForm.test.ts.)
// Τρέξε: npx tsx app/dashboard/components/quickWins.test.ts
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { attachAmounts, enfiaNeedsAmount, ENFIA_IMPORT_TAB, ENFIA_IMPORT_LABEL, type AgendaItem } from '@/lib/home/agenda'
import { defaultStatusFilter } from '@/lib/data/firms'
import { ACCOUNTANT_SEND_EVENT, ACCOUNTANT_SEND_LABEL, sendToAccountant } from './accountantSend'

let pass = 0, fail = 0
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n) } }
const src = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

// ── 2. «Νέα δαπάνη» → κατευθείαν η φόρμα ─────────────────────────────────
{
  const fin = src('app/dashboard/components/TabFinances.tsx')
  const page = src('app/dashboard/page.tsx')
  ok('η σελίδα δίνει onNewExpense που ανοίγει τη φόρμα', /onNewExpense=\{\(\)=>setManualExpense\(n=>n\+1\)\}/.test(page))
  ok('η κεφαλίδα των Δαπανών πατά onNewExpense πριν από το onScan', fin.includes("onClick={onNewExpense ?? onScan}>{E ? E.newExpense : 'Νέα δαπάνη'}"))
  ok('ο Προϋπολογισμός αλλάζει όψη και ανοίγει την ίδια φόρμα', fin.includes("onScan={onNewExpense ? () => { setView('expenses'); onNewExpense(); } : onScan}"))
  const ledger = src('app/dashboard/components/ExpenseLedger.tsx')
  ok('η φόρμα κρατά τη ζώνη «Φωτογράφισε ή ανέβασε αρχείο»', ledger.includes('Φωτογράφισε ή ανέβασε αρχείο'))
}

// ── 3. «Στείλε στον λογιστή σου» ορατό και με δρόμο από παντού ─────────────
{
  const dossier = src('app/dashboard/components/AccountantDossier.tsx')
  const acc = src('app/dashboard/components/TabAccounting.tsx')
  const notice = src('app/dashboard/components/PolicyNotice.tsx')
  const settings = src('app/dashboard/components/TabSettings.tsx')
  const page = src('app/dashboard/page.tsx')
  ok('ο φάκελος δείχνει κουμπί αποστολής δίπλα στον φάκελο', dossier.includes('{send && <span id={ACCOUNTANT_SEND_ID}><Btn variant="secondary"'))
  ok('η Λογιστική περνά το κουμπί', acc.includes('send={accountantSend}') && acc.includes('onClick: shareWithAccountant'))
  ok('ο σύνδεσμος δεν ζει πια στο «⋯»', !/key:'link'/.test(acc))
  ok('η κάρτα της Επισκόπησης έχει την ενέργεια', notice.includes('sendToAccountant(); }}>{O ? O.accountantSend : ACCOUNTANT_SEND_LABEL}</Btn>'))
  ok('οι Ρυθμίσεις έχουν την ενέργεια', settings.includes('onClick={sendToAccountant}>{O ? O.accountantSend : ACCOUNTANT_SEND_LABEL}</Btn>'))
  ok('η σελίδα ανοίγει τη Λογιστική με το γεγονός', page.includes("const go = () => { setNav('accounting'); focusAccountantSend(); };") && page.includes('ACCOUNTANT_SEND_EVENT, go'))
  ok('το λεκτικό', ACCOUNTANT_SEND_LABEL === 'Στείλε στον λογιστή σου')
  const seen: string[] = []
  const g = globalThis as unknown as { window?: EventTarget }
  const had = g.window
  g.window = new EventTarget()
  g.window.addEventListener(ACCOUNTANT_SEND_EVENT, e => seen.push(e.type))
  sendToAccountant()
  g.window = had
  ok('το sendToAccountant στέλνει το γεγονός', seen.length === 1)
}

// ── 4. ΕΝΦΙΑ χωρίς ποσό → η πράξη ──────────────────────────────────────────
{
  const row = (key: string, due: string): AgendaItem => ({ key, title: 'ΕΝΦΙΑ, 8η δόση', note: '', due, daysLeft: 10, action: { label: 'Ημερολόγιο', tab: 'calendar' }, origin: 'obligation', weight: 0 })
  const [none] = attachAmounts([row('tax:enfia-instalment-2026-10', '2026-10-31')], [])
  ok('χωρίς ποσό η ενέργεια ανοίγει την πράξη', none.action?.tab === ENFIA_IMPORT_TAB && none.action?.label === ENFIA_IMPORT_LABEL)
  ok('το λεκτικό ρωτά για το ποσό', ENFIA_IMPORT_LABEL === 'Ποσό; Ανέβασε την πράξη')
  const [withAmt] = attachAmounts([row('tax:enfia-instalment-2026-10', '2026-10-31')], [{ kind: 'enfia', date: '2026-10-31', amount: 41.5, certainty: 'actual' }])
  ok('με ποσό η ενέργεια μένει όπως ήταν', withAmt.action?.tab === 'calendar' && withAmt.amount?.value === 41.5)
  const [other] = attachAmounts([row('tax:e1-2027', '2027-07-15')], [])
  ok('άλλη προθεσμία δεν αλλάζει', other.action?.tab === 'calendar')
  ok('ημερολόγιο: δόση χωρίς ποσό', enfiaNeedsAmount('tax:enfia-last-2026-12', null))
  ok('ημερολόγιο: δόση με ποσό', !enfiaNeedsAmount('tax:enfia-last-2026-12', 85))
  ok('ημερολόγιο: χειροκίνητο γεγονός', !enfiaNeedsAmount('manual', null))
  const agenda = src('app/dashboard/components/AgendaPanel.tsx')
  ok('η ατζέντα ανοίγει την εισαγωγή', agenda.includes('it.action!.tab === ENFIA_IMPORT_TAB ? openMyaadeImport()'))
  const card = src('app/dashboard/components/calendar/EventCard.tsx')
  ok('η κάρτα του ημερολογίου ανοίγει την εισαγωγή', card.includes('enfiaNeedsAmount(event.source,event.amount)') && card.includes('onClick={()=>openMyaadeImport()}'))
}

// ── Τα αγγλικά της εφαρμογής (lib/i18n/en/app/overview.ts) ─────────────────
{
  const en = src('lib/i18n/en/app/overview.ts')
  ok('η δόση ΕΝΦΙΑ χωρίς ποσό έχει αγγλικό λεκτικό', en.includes("'enfia-import': 'Amount? Upload the assessment'"))
  ok('το «Στείλε στον λογιστή σου» έχει αγγλικό λεκτικό', en.includes("accountantSend: 'Send to your accountant'"))
}

// ── 5. Ο χώρος του γραφείου ──────────────────────────────────────────────
{
  ok('έξι πελάτες με εκκρεμότητα → «Με εκκρεμότητες»', defaultStatusFilter(6, 2) === 'blocked')
  ok('πέντε πελάτες → όλοι', defaultStatusFilter(5, 2) === 'all')
  ok('πολλοί χωρίς εκκρεμότητα → όλοι, όχι άδεια οθόνη', defaultStatusFilter(20, 0) === 'all')
  const ws = src('app/accountant/workspace/page.tsx')
  ok('η μαζική μπάρα κολλά στην κορυφή', ws.includes('className="po-noprint bulk-sticky"') && ws.includes('.bulk-sticky{position:sticky;'))
  ok('το φίλτρο παίρνει την αρχική του τιμή μία φορά', ws.includes('setStatus(defaultStatusFilter(shown.length,'))
}

console.log(`quickWins.test.ts: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
