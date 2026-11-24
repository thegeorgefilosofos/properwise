// ═══════════════════════════════════════════════════════════════════════════
// ΑΞΙΟΛΟΓΗΣΗ ΣΧΕΔΙΑΣΗΣ 3, PR 3: ΠΡΩΤΑ Η ΑΠΑΝΤΗΣΗ, ΛΙΓΟΤΕΡΑ ΠΑΤΗΜΑΤΑ (23/11/2026)
// ─────────────────────────────────────────────────────────────────────────
// Κάθε έλεγχος κοκκινίζει στον παλιό κώδικα:
//   · Επισκόπηση: «Πληρώθηκε» από τη γραμμή της Εκκρεμότητας (3 → 1).
//   · Ημερολόγιο: μία γραμμή με τα πλήθη, πάτημα σε κενή μέρα ανοίγει τη φόρμα (4 → 2).
//   · Εισερχόμενα: «Καταχώρηση όλων» με αναίρεση (10 → 3).
//   · Τιμές: πρώτα οι κενές νύχτες, οι ρυθμίσεις διπλωμένες.
//   · Ρυθμίσεις: η Συνδρομή μία γραμμή.
// Τρέξε: npx tsx app/dashboard/components/fewerTaps.test.ts
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import AgendaPanel from './AgendaPanel'
import type { AgendaItem } from '@/lib/home/agenda'
import { doneLabel } from '@/lib/home/markDone'
import { alertLine, dayTapOpensForm } from './calendar/alerts'

let pass = 0, fail = 0
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n) } }
const src = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const quiet = <T>(f: () => T): T => {
  const err = console.error
  console.error = (...a: unknown[]) => { if (!String(a[0]).includes('non-boolean attribute')) err(...a) }
  try { return f() } finally { console.error = err }
}

// ── 1. Επισκόπηση: «Πληρώθηκε» στη γραμμή ─────────────────────────────────
{
  ok('δόση ΕΝΦΙΑ → «Πληρώθηκε»', doneLabel('tax:enfia-instalment-2026-11') === 'Πληρώθηκε')
  ok('δόση φόρου εισοδήματος → «Πληρώθηκε»', doneLabel('tax:income-instalment-2026-11') === 'Πληρώθηκε')
  ok('τέλος ανθεκτικότητας → «Πληρώθηκε»', doneLabel('tax:str-climate-fee-2026-q4') === 'Πληρώθηκε')
  ok('δήλωση → «Έγινε»', doneLabel('tax:income-decl-2027') === 'Έγινε' && doneLabel('tax:str-registry-2026') === 'Έγινε')
  ok('η έκδοση του ΕΝΦΙΑ δεν είναι πράξη του ιδιοκτήτη', doneLabel('tax:enfia-issue-2026') === null)
  ok('ό,τι δεν είναι θεσμική προθεσμία δεν κλείνει από εδώ', doneLabel('setup:afm') === null && doneLabel('insight:loan') === null)

  const items: AgendaItem[] = [
    { key: 'tax:enfia-instalment-2026-11', title: 'ΕΝΦΙΑ, 9η δόση', note: '', due: '2026-11-30', daysLeft: 6, action: { label: 'Ημερολόγιο', tab: 'calendar' }, origin: 'obligation', weight: 5, amount: { value: 17.83 } } as AgendaItem,
    { key: 'setup:afm', title: 'ΑΦΜ', note: '', due: null, daysLeft: null, action: { label: 'Ρυθμίσεις', tab: 'settings' }, origin: 'setup', weight: 1 } as AgendaItem,
  ]
  const withDone = quiet(() => renderToStaticMarkup(createElement(AgendaPanel, { items, total: 2, onNavigate: () => {}, onDone: () => {} })))
  ok('η γραμμή της δόσης έχει «Πληρώθηκε»', withDone.includes('>Πληρώθηκε</button>'))
  ok('το κουμπί λέει ποια γραμμή κλείνει', withDone.includes('aria-label="Πληρώθηκε: ΕΝΦΙΑ, 9η δόση"'))
  ok('μόνο μία γραμμή το έχει', withDone.split('>Πληρώθηκε</button>').length === 2)
  const without = quiet(() => renderToStaticMarkup(createElement(AgendaPanel, { items, total: 2, onNavigate: () => {} })))
  ok('χωρίς χειριστή δεν εμφανίζεται', !without.includes('Πληρώθηκε'))
  const ov = src('app/dashboard/components/OverviewTab.tsx')
  ok('η Επισκόπηση δίνει τον χειριστή', /onDone=\{markAgendaDone\}/.test(ov))
  ok('με αναίρεση', ov.includes("{ label: 'Αναίρεση', onClick"))
}

// ── 2. Ημερολόγιο ─────────────────────────────────────────────────────────
{
  ok('δύο πλήθη σε μία γραμμή', alertLine(10, 1) === '10 ληξιπρόθεσμα · 1 λήγει')
  ok('ενικός', alertLine(1, 0) === '1 ληξιπρόθεσμο')
  ok('μόνο λήξεις, πληθυντικός', alertLine(0, 2) === '2 λήγουν')
  ok('τίποτα → καμία γραμμή', alertLine(0, 0) === null)
  ok('κενή μέρα → φόρμα', dayTapOpensForm(0) === true)
  ok('μέρα με γεγονότα → η λίστα της', dayTapOpensForm(2) === false)
  const cal = src('app/dashboard/components/TabCalendar.tsx')
  ok('η κάρτα συγχρονισμού κάτω από το πλέγμα', cal.indexOf('<CalendarQuickAdd userId={userId} framed />') > cal.indexOf('<MonthView '))
  ok('ούτε δεύτερο πλαίσιο για τις λήξεις', !cal.includes('συμβόλαι{expiring.length===1'))
  ok('η γραμμή των πληθών υπάρχει', cal.includes('alertLine(overdue.length, expiring.length)'))
  ok('το πάτημα σε μέρα ρωτά τον κανόνα', cal.includes('dayTapOpensForm('))
}

// ── 3. Εισερχόμενα ───────────────────────────────────────────────────────
{
  const inbox = src('app/dashboard/components/InboundInbox.tsx')
  ok('κουμπί «Καταχώρηση όλων»', inbox.includes('bulkLabel(ready.length)'))
  ok('η αναίρεση ξεκαταχωρεί', inbox.includes('inbound.unfile('))
  ok('η γραμμή λέει τον μήνα του λογαριασμού', inbox.includes('billMonth('))
}

// ── 4. Τιμές: πρώτα η απάντηση ───────────────────────────────────────────
{
  const pr = src('app/dashboard/components/TabPricing.tsx')
  const gaps = pr.indexOf('label="Κενές νύχτες για κράτηση"')
  const cal = pr.indexOf('label="Ημερολόγιο τιμών"')
  const kpis = pr.indexOf('<KPIGrid items={kpis}')
  const fields = pr.indexOf('label="Βασική τιμή ανά νύχτα"')
  ok('οι κενές νύχτες πριν από το ημερολόγιο τιμών', gaps > 0 && gaps < cal)
  ok('το ημερολόγιο πριν από τους δείκτες', cal > 0 && cal < kpis)
  ok('τα πεδία τιμής μέσα στις διπλωμένες ρυθμίσεις', fields > pr.indexOf('{settingsShown && ('))
  ok('οι ρυθμίσεις τιμών διπλωμένες όταν υπάρχει τιμή', pr.includes('const settingsShown = settingsOpen ?? (!loading && base <= 0)') && pr.includes('setSettingsOpen(o => o ?? true)'))
}

// ── 5. Ρυθμίσεις: η Συνδρομή μία γραμμή ──────────────────────────────────
{
  const st = src('app/dashboard/components/TabSettings.tsx')
  ok('χωρίς τη σκάλα των πακέτων', !st.includes('className="plan-ladder"'))
  ok('πακέτο και ακίνητα σε μία γραμμή', st.includes('className="set-plan-line"'))
}

console.log(`fewerTaps.test.ts: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
