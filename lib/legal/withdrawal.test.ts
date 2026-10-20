// npx tsx lib/legal/withdrawal.test.ts
//
// Η ΛΕΙΤΟΥΡΓΙΑ ΥΠΑΝΑΧΩΡΗΣΗΣ: προθεσμία, έλεγχος δήλωσης, αποδεικτικό.
// Πηγές: lib/legal/withdrawal.ts (άρθ. 11α Οδηγίας 2011/83/ΕΕ, άρθ. 3ζα ν. 2251/1994).
import { readFileSync } from 'node:fs'
import {
  validateWithdrawal, withdrawalLastDay, withinWithdrawalPeriod, withdrawalReference,
  WITHDRAWAL_DAYS, WITHDRAWAL_LABEL, WITHDRAWAL_CONFIRM_LABEL,
} from './withdrawal'
import { withdrawalAckEmail, withdrawalAlert, submittedLabel, sendWithdrawalMail, type WithdrawalRecord } from './withdrawalMail'
import { merchant } from '../billing/merchant'
import { IDENTITY } from './identity'

let pass = 0, fail = 0
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n) } }

// ── Η ΠΡΟΘΕΣΜΙΑ ────────────────────────────────────────────────────────────
// Καν. 1182/71 άρθ. 3: η ημέρα της σύναψης δεν μετρά, λήγει στο τέλος της 14ης.
ok('οι ημέρες είναι 14', WITHDRAWAL_DAYS === 14)
ok('αγορά 01/10/2026: τελευταία ημέρα 15/10/2026', withdrawalLastDay('2026-10-01') === '2026-10-15')
ok('γύρισμα μήνα: 25/10 → 08/11', withdrawalLastDay('2026-10-25') === '2026-11-08')
ok('γύρισμα χρονιάς: 25/12/2026 → 08/01/2027', withdrawalLastDay('2026-12-25') === '2027-01-08')
ok('δίσεκτο: 20/02/2028 → 05/03/2028', withdrawalLastDay('2028-02-20') === '2028-03-05')
// Ωρα Ελλάδας: 15/10 23:30 Αθήνα είναι 20:30 UTC (θερινή, UTC+3).
ok('την τελευταία ημέρα, αργά το βράδυ, εμπρόθεσμη', withinWithdrawalPeriod('2026-10-01', new Date('2026-10-15T20:30:00Z')) === true)
// 16/10 00:30 Αθήνα είναι 15/10 21:30 UTC: σε UTC θα φαινόταν ακόμη 15η.
ok('μετά τα μεσάνυχτα της Ελλάδας, εκπρόθεσμη, ενώ σε UTC είναι ακόμη 15η',
  withinWithdrawalPeriod('2026-10-01', new Date('2026-10-15T21:30:00Z')) === false)
ok('χωρίς ημερομηνία αγοράς: άγνωστο, όχι «εκπρόθεσμη»', withinWithdrawalPeriod(null) === null)

// ── Ο ΕΛΕΓΧΟΣ ΤΗΣ ΔΗΛΩΣΗΣ ──────────────────────────────────────────────────
const now = new Date('2026-10-20T10:00:00Z')
const good = validateWithdrawal({ name: '  Μαρία   Παπαδοπούλου ', email: 'Maria@Example.GR', contract: 'Συνδρομή «Ιδιοκτήτης», μηνιαία', purchaseDate: '05/10/2026' }, now)
ok('έγκυρη δήλωση περνά', good.ok)
if (good.ok) {
  ok('τα κενά μαζεύονται', good.value.name === 'Μαρία Παπαδοπούλου')
  ok('το email γίνεται πεζά', good.value.email === 'maria@example.gr')
  ok('η ημερομηνία γίνεται ISO', good.value.purchaseIso === '2026-10-05')
}
ok('χωρίς ημερομηνία περνά (δεν τη ζητά το άρθ. 11α)', validateWithdrawal({ name: 'Νίκος Π', email: 'n@x.gr', contract: 'Συνδρομή' }, now).ok)
ok('χωρίς όνομα κόβεται', !validateWithdrawal({ name: '', email: 'n@x.gr', contract: 'Συνδρομή' }, now).ok)
ok('χωρίς έγκυρο email κόβεται', !validateWithdrawal({ name: 'Νίκος', email: 'όχι-email', contract: 'Συνδρομή' }, now).ok)
ok('χωρίς σύμβαση κόβεται', !validateWithdrawal({ name: 'Νίκος', email: 'n@x.gr', contract: ' ' }, now).ok)
ok('ημερομηνία που δεν υπάρχει κόβεται', !validateWithdrawal({ name: 'Νίκος', email: 'n@x.gr', contract: 'Σ', purchaseDate: '31/02/2026' }, now).ok)
ok('μελλοντική ημερομηνία κόβεται', !validateWithdrawal({ name: 'Νίκος', email: 'n@x.gr', contract: 'Συνδρομή', purchaseDate: '21/10/2026' }, now).ok)
ok('πολύ μεγάλη σύμβαση κόβεται', !validateWithdrawal({ name: 'Νίκος', email: 'n@x.gr', contract: 'α'.repeat(501) }, now).ok)

// ── ΟΙ ΕΝΔΕΙΞΕΙΣ ΤΟΥ ΝΟΜΟΥ ─────────────────────────────────────────────────
ok('η ένδειξη της λειτουργίας', WITHDRAWAL_LABEL === 'Υπαναχώρηση από τη σύμβαση εδώ')
ok('η ένδειξη της επιβεβαίωσης', WITHDRAWAL_CONFIRM_LABEL === 'Επιβεβαίωση υπαναχώρησης')
ok('ο κωδικός αναφοράς', withdrawalReference('3f2a9c1e-0000-4000-8000-000000000000') === 'ΥΠ-3F2A9C1E')

// ── ΤΟ ΑΠΟΔΕΙΚΤΙΚΟ ─────────────────────────────────────────────────────────
const at = new Date('2026-10-20T11:05:00Z') // 14:05 ώρα Ελλάδας
const rec: WithdrawalRecord = {
  reference: 'ΥΠ-3F2A9C1E', submittedAt: at, name: 'Μαρία <b>Π</b>', email: 'maria@example.gr',
  contract: 'Συνδρομή «Ιδιοκτήτης», μηνιαία', purchaseIso: '2026-10-08', within: true, cancel: 'cancelled', subscriptionId: 'sub_1',
}
ok('η ώρα υποβολής σε ώρα Ελλάδας, με την ημερομηνία', submittedLabel(at) === '20/10/2026, 14:05 (ώρα Ελλάδας)')
const mail = withdrawalAckEmail(rec)
ok('το θέμα έχει τον κωδικό', mail.subject.includes(rec.reference))
for (const part of ['20/10/2026, 14:05', rec.email, 'Συνδρομή', '08/10/2026', '22/10/2026', 'Υπαναχωρώ από τη σύμβαση']) {
  ok(`το αποδεικτικό (κείμενο) περιέχει «${part}»`, mail.text.includes(part))
}
ok('το όνομα διαφεύγει στο HTML', mail.html.includes('Μαρία &lt;b&gt;Π&lt;/b&gt;') && !mail.html.includes('<b>Π</b>'))
ok('ονομάζει ποιος επιστρέφει τα χρήματα: ο έμπορος', mail.text.includes(`την εκτελεί η ${merchant().name}`))
ok('λέει ότι η ανανέωση ακυρώθηκε', mail.text.includes('ακυρώθηκε'))
ok('καμία μεγάλη παύλα στο αποδεικτικό', !/—/.test(mail.text) && !/—/.test(mail.html))
const late = withdrawalAckEmail({ ...rec, within: false, cancel: 'not_signed_in' })
ok('εκπρόθεσμη: καταγράφεται και το λέει', late.text.includes('πέρα από την προθεσμία') && late.text.includes('καταγράφηκε'))
ok('χωρίς σύνδεση: δεν υπόσχεται αυτόματη ακύρωση', !late.text.includes('ακυρώθηκε στον έμπορο'))

const alert = withdrawalAlert(rec)
ok('η διαβίβαση λέει τι να γίνει στον έμπορο', alert.text.includes('Refund') && alert.text.includes('sub_1'))
ok('και μέσα σε πόσες ημέρες', alert.text.includes(`${WITHDRAWAL_DAYS} ημέρες`))

// ── Η ΑΠΟΣΤΟΛΗ ΔΕΝ ΠΕΤΑ ────────────────────────────────────────────────────
async function sends() {
  const calls: { url: string; body: Record<string, unknown> }[] = []
  const fake = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) })
    return new Response('{}', { status: 200 })
  }) as unknown as typeof fetch
  const sent = await sendWithdrawalMail({ to: rec.email, subject: mail.subject, html: mail.html, text: mail.text }, 'κλειδί', fake)
  ok('στέλνεται με κλειδί', sent && calls.length === 1)
  ok('από την υποστήριξη, με απάντηση στην υποστήριξη', String(calls[0]?.body.from).includes(IDENTITY.supportEmail) && calls[0]?.body.reply_to === IDENTITY.supportEmail)
  ok('χωρίς κλειδί δεν στέλνεται και δεν πετά', !(await sendWithdrawalMail({ to: 'a@b.gr', subject: 's', text: 't' }, '', fake)))
  const boom = (async () => { throw new Error('δίκτυο') }) as unknown as typeof fetch
  ok('σφάλμα δικτύου: false, όχι εξαίρεση', !(await sendWithdrawalMail({ to: 'a@b.gr', subject: 's', text: 't' }, 'κ', boom)))
}

// ── Η ΔΙΑΔΡΟΜΗ ΚΑΙ Ο ΠΙΝΑΚΑΣ, ΔΟΜΙΚΑ ────────────────────────────────────────
// Η route.ts φορτώνει το next/headers και δεν τρέχει εκτός Next (βλ.
// app/api/account/delete/deleteRoute.test.ts). Φυλάγεται η ΣΕΙΡΑ της.
{
  const SRC = readFileSync('app/api/withdrawal/route.ts', 'utf8')
  const i = (s: string) => SRC.indexOf(s)
  ok('προέλευση πρώτα', i('sameOrigin(') > 0 && i('sameOrigin(') < i('validateWithdrawal('))
  ok('καταγραφή πριν από κάθε email', i(".insert(") > 0 && i('.insert(') < i('sendWithdrawalMail('))
  ok('καταγραφή πριν από την ακύρωση στον έμπορο', i('.insert(') < i('mor.cancel('))
  ok('η συνδρομή βρίσκεται μόνο με πλήρη συνεδρία', /const trusted = !!user && !halfSession/.test(SRC) && /requireSecondStep\(supabase, user\)/.test(SRC) && /if \(trusted && user\)/.test(SRC))
  ok('η ακύρωση δεν περνά από τη συνθήκη πώλησης', !/checkoutIsLive|checkoutState/.test(SRC.replace(/\/\/.*$/gm, '')))
  ok('κάθε αποτυχία καταγραφής δίνει δρόμο με email', /fallback\(502/.test(SRC) && /fallback\(503/.test(SRC) && /fallback\(429/.test(SRC))

  const SQL = readFileSync('supabase/migrations/20261020120000_i_ypanaxorisi_echei_koumpi.sql', 'utf8')
  ok('ο πίνακας έχει RLS', /alter table public\.withdrawal_requests enable row level security/.test(SQL))
  ok('ο χρήστης διαβάζει μόνο τις δικές του', /for select to authenticated\s+using \(account_id = \(select auth\.uid\(\)\)\)/.test(SQL))
  ok('κανένας πελάτης δεν γράφει', /revoke all on table public\.withdrawal_requests from public, anon, authenticated/.test(SQL)
    && !/grant (insert|update|delete|all)[^;]*to (anon|authenticated)/.test(SQL))
  ok('με τη διαγραφή λογαριασμού η δήλωση μένει χωρίς δεσμό', /account_id\s+uuid references auth\.users\(id\) on delete set null/.test(SQL))
  // Η erase_account σβήνει κάθε πίνακα με στήλη user_id: εδώ δεν πρέπει να υπάρχει.
  ok('καμία στήλη user_id που θα τη έσβηνε η erase_account', !/^\s*user_id\s/m.test(SQL))
}

sends().then(() => {
  console.log(fail === 0 ? `✓ withdrawal: ${pass} έλεγχοι πέρασαν` : `✗ withdrawal: ${fail} απέτυχαν από ${pass + fail}`)
  if (fail > 0) process.exit(1)
})
