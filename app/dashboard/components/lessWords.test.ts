// ═══════════════════════════════════════════════════════════════════════════
// ΑΞΙΟΛΟΓΗΣΗ ΣΧΕΔΙΑΣΗΣ 3, PR 2: ΛΙΓΟΤΕΡΑ ΛΟΓΙΑ (23/11/2026)
// ─────────────────────────────────────────────────────────────────────────
// Κάθε οθόνη λέει μόνο ό,τι δεν φαίνεται ήδη. Κάθε έλεγχος εδώ κοκκινίζει στον
// παλιό κώδικα: υπότιτλοι που ξαναλένε τον τίτλο, υποσημειώσεις αντί για ⓘ,
// σημείωση σε κάθε γραμμή των Εκκρεμοτήτων, το ίδιο όνομα ή ποσό δύο φορές, η
// γραμμή δοκιμής γραμμένη με το χέρι έξω από το billingWords και δύο λέξεις
// για τον ίδιο σύνδεσμο του λογιστή.
// Τρέξε: npx tsx app/dashboard/components/lessWords.test.ts
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import AgendaPanel from './AgendaPanel'
import type { AgendaItem } from '@/lib/home/agenda'
import { ACCOUNTANT_SEND_LABEL } from './accountantSend'

let pass = 0, fail = 0
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n) } }
const src = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

// ── 1. Ο τίτλος της σελίδας στέκεται μόνος του ─────────────────────────────
{
  const gone: [string, string][] = [
    ['app/dashboard/components/TabCalendar.tsx', 'Προθεσμίες, πληρωμές και ραντεβού'],
    ['app/dashboard/components/TabDocuments.tsx', 'Τα χαρτιά, οι επαφές και ο εξοπλισμός'],
    ['app/dashboard/components/TabSettings.tsx', 'Ό,τι αφορά εσένα και τα δεδομένα σου'],
    ['app/dashboard/components/TabContacts.tsx', 'Συνεργάτες, πάροχοι και υπηρεσίες του ακινήτου'],
    ['app/dashboard/components/TabPricing.tsx', 'Τι να ζητήσεις ανά νύχτα'],
    ['app/dashboard/components/TabFinances.tsx', 'Ό,τι πλήρωσες και ό,τι περιμένει πληρωμή'],
    ['app/dashboard/components/TabTenant.tsx', 'Τρέχουσες και παλαιότερες μισθώσεις'],
    ['app/dashboard/components/TabClients.tsx', 'Κρατήσεις, δηλωτέα ποσά και εκκρεμείς'],
    ['app/dashboard/components/TabComparison.tsx', 'Ποιο αποδίδει καλύτερα, με τα ίδια μέτρα'],
  ]
  for (const [f, s] of gone) ok(`χωρίς υπότιτλο: ${f.split('/').pop()}`, !src(f).includes(s))
}

// ── 2. Οι γραμμές των Εκκρεμοτήτων χωρίς σημείωση ──────────────────────────
{
  const items: AgendaItem[] = [
    { key: 'a', title: 'Φόρος εισοδήματος, 2η δόση', note: 'ΣΗΜΕΙΩΣΗ-ΓΡΑΜΜΗΣ', condition: 'ΠΡΟΫΠΟΘΕΣΗ-ΓΡΑΜΜΗΣ', due: '2026-11-20', daysLeft: -3, action: { label: 'Ημερολόγιο', tab: 'calendar' }, origin: 'obligation', weight: 5 } as AgendaItem,
    { key: 'b', title: 'Ταχυδρομικός κώδικας', note: 'ΣΗΜΕΙΩΣΗ-ΧΩΡΙΣ-ΗΜΕΡΟΜΗΝΙΑ', due: null, daysLeft: null, action: null, origin: 'setup', weight: 1 } as AgendaItem,
  ]
  // Το `<style jsx>` χωρίς τον μεταγλωττιστή του Next βγάζει προειδοποίηση για
  // το χαρακτηριστικό `jsx`· δεν αφορά τον έλεγχο, οπότε σωπαίνει μόνο αυτή.
  const err = console.error
  console.error = (...a: unknown[]) => { if (!String(a[0]).includes('non-boolean attribute')) err(...a) }
  const html = renderToStaticMarkup(createElement(AgendaPanel, { items, total: 2, onNavigate: () => {} }))
  console.error = err
  ok('η λίστα δείχνει τους τίτλους', html.includes('Φόρος εισοδήματος, 2η δόση') && html.includes('Ταχυδρομικός κώδικας'))
  ok('καμία σημείωση σε εκπρόθεσμη γραμμή', !html.includes('ΣΗΜΕΙΩΣΗ-ΓΡΑΜΜΗΣ'))
  ok('καμία προϋπόθεση', !html.includes('ΠΡΟΫΠΟΘΕΣΗ-ΓΡΑΜΜΗΣ'))
  ok('καμία σημείωση σε γραμμή χωρίς ημερομηνία', !html.includes('ΣΗΜΕΙΩΣΗ-ΧΩΡΙΣ-ΗΜΕΡΟΜΗΝΙΑ'))
}

// ── 3. Οι υποσημειώσεις γίνονται ⓘ ────────────────────────────────────────
{
  const fc = src('app/dashboard/components/ForecastCard.tsx')
  ok('Πρόβλεψη: χωρίς υπότιτλο', !fc.includes('className="fc-sub"'))
  ok('Πρόβλεψη: η εξήγηση στο ⓘ του τίτλου', /<InfoHint[^>]*>\s*\{FORECAST_NOTE\}/.test(fc) && !/<p className="fc-note">\s*\{/.test(fc))
  const ov = src('app/dashboard/components/OverviewTab.tsx')
  ok('Επισκόπηση: «Πώς βγαίνει ο φόρος» δεν είναι παράγραφος', !ov.includes('Πώς βγαίνει ο φόρος.</strong>'))
  ok('Επισκόπηση: το ⓘ δίπλα στο «Μερίδιο φόρου»', ov.includes('hint: income && taxNote ? taxNote : undefined') && ov.includes('<InfoHint label={k.label}>{k.hint}</InfoHint>'))
  const pr = src('app/dashboard/components/TabPricing.tsx')
  ok('Τιμές: χωρίς το πλαίσιο «οι τιμές είναι προτάσεις»', !pr.includes('Οι τιμές είναι <strong>προτάσεις</strong>'))
  ok('Τιμές: χωρίς υπότιτλο στις κενές νύχτες', !pr.includes('Διαστήματα χωρίς κράτηση, με προτεινόμενη τιμή'))
  ok('Τιμές: χωρίς υπότιτλο στο ημερολόγιο τιμών', !pr.includes('sub="Όσο πιο έντονο'))
  ok('Τιμές: η ανατομία της τιμής στο ⓘ', /info=\{<InfoHint[^>]*>\{priceAnatomy\}<\/InfoHint>\}/.test(pr))
  ok('Τιμές: η σημείωση φόρου στο ⓘ', /info=\{<InfoHint[^>]*>\{taxBasisNote\}<\/InfoHint>\}/.test(pr))
  const ws = src('app/accountant/workspace/page.tsx')
  ok('Πύλη: «Ποιους βλέπεις» δεν είναι ενότητα στο τέλος', !ws.includes('>Ποιους βλέπεις</p>'))
  ok('Πύλη: «Ποιους βλέπεις» στο ⓘ του τίτλου', ws.includes('info={<InfoHint label="Ποιους βλέπεις">'))
}

// ── 4. Το ίδιο όνομα ή ποσό μία φορά ──────────────────────────────────────
{
  const ws = src('app/accountant/workspace/page.tsx')
  ok('Πύλη: η χρήση γράφεται μόνο στον επιλογέα', !ws.includes('Χρήση 01/01/{year} έως 31/12/{year}'))
  ok('Πύλη: το πλήθος πελατών όχι ως eyebrow', !/<PortalTitle over=\{`\$\{rows/.test(ws))
  const inbox = src('app/dashboard/components/InboundInbox.tsx')
  ok('Εισερχόμενα: χωρίς πρόταση για το ακίνητο', !inbox.includes('Η καταχώρηση γράφεται στο ακίνητο'))
  ok('Εισερχόμενα: χωρίς πρόταση για το συνημμένο', !inbox.includes('συνημμένο, στο αρχικό email'))
  const docs = src('app/dashboard/components/TabDocuments.tsx')
  ok('Έγγραφα: η πηγή μία φορά δίπλα στον φάκελο', docs.includes('<OriginTag i={i} hide={a.showFolder ? FOLDER_LABEL[i.folder] : undefined}/>'))
  const bill = src('app/dashboard/components/Billing.tsx')
  ok('Συνδρομή: η τιμή δεν ξαναγράφεται κάτω από τον επιλογέα', bill.includes('{!running && <div style={{ fontFamily: T.font.num, fontSize: 28'))
}

// ── 5. Λέξεις χρέωσης μόνο από το billingWords ────────────────────────────
{
  const pc = src('app/PublicChrome.tsx')
  ok('η γραμμή δοκιμής δεν γράφεται με το χέρι', !pc.includes('export const TRIAL_LINE ='))
  ok('η γραμμή δοκιμής έρχεται από το billingWords', pc.includes("from '@/lib/legal/billingWords'") && pc.includes('TRIAL_LINE_EN : TRIAL_LINE).many'))
  const shell = src('lib/i18n/en/tools/shell.ts')
  ok('ούτε στα αγγλικά με το χέρι', !shell.includes('trialLine'))
}

// ── 6. Ένα όνομα για τον σύνδεσμο του λογιστή ──────────────────────────────
{
  ok('το λεκτικό είναι αυτό του κουμπιού', ACCOUNTANT_SEND_LABEL === 'Σύνδεσμος για τον λογιστή')
  const acc = src('app/dashboard/components/TabAccounting.tsx')
  ok('το κουμπί της Λογιστικής διαβάζει την ίδια σταθερά', acc.includes(": ACCOUNTANT_SEND_LABEL, onClick: shareWithAccountant"))
}

// ── 7. Επαφές: γραμμές λίστας αντί για κάρτες ──────────────────────────────
{
  const tc = src('app/dashboard/components/TabContacts.tsx')
  const cc = src('app/dashboard/components/contacts/ContactCard.tsx')
  ok('καμία κάρτα επαφής', !/<ContactCard\b/.test(tc) && !cc.includes('export function ContactCard'))
  ok('γραμμή λίστας', /<ContactRow\b/.test(tc) && cc.includes('export function ContactRow'))
  ok('η γραμμή κρατά 56', cc.includes('export const CONTACT_ROW_H = 56'))
}

console.log(`lessWords.test.ts: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
