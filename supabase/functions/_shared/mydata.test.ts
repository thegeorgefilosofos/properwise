// npx tsx supabase/functions/_shared/mydata.test.ts
//
// Ο ΣΥΓΧΡΟΝΙΣΜΟΣ myDATA ΜΕΣΩ ΛΟΓΙΣΤΗ: ΟΣΑ ΚΡΙΝΟΥΝ, ΧΩΡΙΣ ΔΙΚΤΥΟ ΚΑΙ ΧΩΡΙΣ ΒΑΣΗ.
//
// Η συνάρτηση `mydata-sync` τρέχει σε Deno. Ο,τι αποφασίζει (ανάγνωση του XML,
// αντιστοίχιση σε δαπάνη, ακυρώσεις, σφάλματα της ΑΑΔΕ, ο κανόνας των 12 ωρών)
// ζει στο mydata.ts και δοκιμάζεται εδώ με τα δείγματα του mydataFixtures/.
//
// ΤΑ ΔΕΙΓΜΑΤΑ. Γραμμένα πάνω στο επίσημο σχήμα της ΑΑΔΕ (requestedInvoicesDoc
// v2.0.2, RequestedDoc / AadeBookInvoiceType / CancelledInvoiceType) και
// επικυρωμένα με `xmllint --schema requestedInvoicesDoc-v2.0.2.xsd` πριν
// μπουν εδώ. Τα ΑΦΜ είναι δοκιμαστικά με σωστό ψηφίο ελέγχου, κανένα πραγματικό.
import { readFileSync } from 'node:fs'
import {
  parseRequestedDoc, toInboxDoc, amountToCents, classifyHttp, retryDelayMs, shouldAutoSync,
  mydataBase, requestDocsUrl, aadeDate, firstWindowStart, maxMark, EXPENSE_TYPES, CREDIT_TYPES,
  MAX_XML_BYTES, safeErrorCode, probeUrl, aadeHeaders,
} from './mydata.ts'

let pass = 0, fail = 0
const ok = (name: string, cond: boolean) => { if (cond) pass++; else { fail++; console.error('✗ ' + name) } }
const fx = (f: string) => readFileSync(new URL(`./mydataFixtures/${f}`, import.meta.url), 'utf8')

const CLIENT = '099000013'

// ── 1. ΑΝΑΓΝΩΣΗ: ΤΑ ΔΕΙΓΜΑΤΑ ΤΟΥ ΣΧΗΜΑΤΟΣ ─────────────────────────────────────
const p1 = parseRequestedDoc(fx('page1.xml'))
ok('σελίδα 1: διαβάζεται', p1.ok)
if (p1.ok) {
  ok('σελίδα 1: δύο παραστατικά', p1.invoices.length === 2)
  ok('σελίδα 1: κανένα άκυρο', p1.invalid === 0)
  ok('σελίδα 1: συνέχεια με nextPartitionKey/nextRowKey', p1.next?.partitionKey === '099000013-2026-11' && p1.next?.rowKey === '400001000000102')
  const a = p1.invoices[0]
  ok('ΜΑΡΚ ως κείμενο, χωρίς απώλεια ψηφίων', a.mark === '400001000000101')
  ok('εκδότης: ΑΦΜ', a.issuerAfm === '099000037')
  ok('εκδότης: όνομα με οντότητα &amp;', a.issuerName === 'Ηλεκτρική Ενέργεια & Δίκτυα Α.Ε.')
  ok('λήπτης: ΑΦΜ', a.counterpartAfm === CLIENT)
  ok('τύπος 2.1', a.invoiceType === '2.1')
  ok('σειρά και αριθμός', a.series === 'Α' && a.aa === '101')
  ok('ημερομηνία έκδοσης όπως ήρθε', a.issueDate === '2026-11-02')
  ok('καθαρό σε λεπτά', a.netCents === 10000)
  ok('ΦΠΑ σε λεπτά', a.vatCents === 2400)
  ok('μικτό σε λεπτά', a.grossCents === 12400)
  const b = p1.invoices[1]
  ok('χωρίς όνομα εκδότη: null, όχι κενό κείμενο', b.issuerName === null)
  ok('88.5 γίνεται 8850 λεπτά (όχι 8849)', b.grossCents === 8850)
  ok('71.37 γίνεται 7137 λεπτά', b.netCents === 7137)
  ok('17.13 γίνεται 1713 λεπτά', b.vatCents === 1713)
  ok('το μικτό είναι της ΑΑΔΕ, όχι καθαρό + ΦΠΑ', b.grossCents === 8850 && b.netCents + b.vatCents === 8850)
}

const p2 = parseRequestedDoc(fx('page2.xml'))
ok('σελίδα 2: διαβάζεται', p2.ok)
if (p2.ok) {
  ok('σελίδα 2: τελευταία, χωρίς συνέχεια', p2.next === null)
  ok('σελίδα 2: τέσσερα παραστατικά', p2.invoices.length === 4)
  ok('σελίδα 2: μία ακύρωση', p2.cancellations.length === 1)
  ok('ακύρωση: ΜΑΡΚ ακυρωμένου', p2.cancellations[0]?.invoiceMark === '400001000000102')
  ok('ακύρωση: ΜΑΡΚ ακύρωσης', p2.cancellations[0]?.cancellationMark === '400001000000191')
  ok('ακύρωση: ημερομηνία', p2.cancellations[0]?.cancellationDate === '2026-11-22')
  ok('cancelledByMark διαβάζεται', p2.invoices[1].cancelledByMark === '400001000000190')
  ok('selfPricing διαβάζεται', p2.invoices[2].selfPricing === true)
  ok('οι τρόποι πληρωμής αγνοούνται (ελαχιστοποίηση)', !('payments' in (p2 as object)))
}

const pe = parseRequestedDoc(fx('empty.xml'))
ok('άδειο RequestedDoc: έγκυρο, μηδέν παραστατικά', pe.ok && pe.invoices.length === 0 && pe.cancellations.length === 0 && pe.next === null)

// ── 2. ΑΝΑΓΝΩΣΗ: ΟΤΙ ΔΕΝ ΕΙΝΑΙ RequestedDoc ΑΠΟΡΡΙΠΤΕΤΑΙ, ΧΩΡΙΣ ΝΑ ΣΚΑΣΕΙ ─────
const bad = (name: string, xml: string, code?: string) => {
  let r: ReturnType<typeof parseRequestedDoc> | null = null
  try { r = parseRequestedDoc(xml) } catch { ok(`${name}: δεν πετά εξαίρεση`, false); return }
  ok(`${name}: απορρίπτεται`, !!r && !r.ok)
  if (code && r && !r.ok) ok(`${name}: λόγος ${code}`, r.error === code)
}
bad('κενό κείμενο', '', 'empty')
bad('μόνο κενά', '   \n  ', 'empty')
bad('σπασμένο XML', '<RequestedDoc xmlns="http://www.aade.gr/myDATA/invoice/v1.0"><invoicesDoc>', 'malformed')
bad('σελίδα σφάλματος του CDN', '<H1>Access Denied</H1>', 'unexpected_root')
bad('ResponseDoc αντί RequestedDoc', fx('response-error.xml'), 'aade_error')
bad('ξένος χώρος ονομάτων', '<RequestedDoc xmlns="http://evil.example/ns"/>', 'unexpected_root')
bad('DOCTYPE (XXE / entity bomb)', '<?xml version="1.0"?><!DOCTYPE r [<!ENTITY a "aaaa">]><RequestedDoc xmlns="http://www.aade.gr/myDATA/invoice/v1.0"/>', 'doctype')
bad('άγνωστο στοιχείο στην κορυφή', '<RequestedDoc xmlns="http://www.aade.gr/myDATA/invoice/v1.0"><surprise/></RequestedDoc>', 'unknown_element')
bad('άγνωστη οντότητα', '<RequestedDoc xmlns="http://www.aade.gr/myDATA/invoice/v1.0"><continuationToken><nextPartitionKey>&foo;</nextPartitionKey><nextRowKey>x</nextRowKey></continuationToken></RequestedDoc>', 'malformed')
bad('υπερβολικό μέγεθος', '<RequestedDoc xmlns="http://www.aade.gr/myDATA/invoice/v1.0">' + ' '.repeat(MAX_XML_BYTES + 1) + '</RequestedDoc>', 'too_large')
bad('υπερβολικό βάθος', '<RequestedDoc xmlns="http://www.aade.gr/myDATA/invoice/v1.0">' + '<a>'.repeat(200) + '</a>'.repeat(200) + '</RequestedDoc>', 'malformed')
bad('ασυμφωνία ετικετών', '<RequestedDoc xmlns="http://www.aade.gr/myDATA/invoice/v1.0"><invoicesDoc></cancelledInvoicesDoc></RequestedDoc>', 'malformed')
bad('συνέχεια χωρίς nextRowKey', '<RequestedDoc xmlns="http://www.aade.gr/myDATA/invoice/v1.0"><continuationToken><nextPartitionKey>a</nextPartitionKey></continuationToken></RequestedDoc>', 'invalid_token')

// Ενα κακό παραστατικό δεν ρίχνει τη σελίδα: μετριέται ως άκυρο και δεν γράφεται.
const swap = (from: string, to: string) => fx('page1.xml').replace(from, to)
const badInv = (name: string, xml: string) => {
  const r = parseRequestedDoc(xml)
  ok(`${name}: η σελίδα διαβάζεται`, r.ok)
  if (r.ok) ok(`${name}: ένα άκυρο, ένα έγκυρο`, r.invalid === 1 && r.invoices.length === 1)
}
badInv('τρία δεκαδικά', swap('<totalGrossValue>124.00</totalGrossValue>', '<totalGrossValue>124.001</totalGrossValue>'))
badInv('αρνητικό ποσό', swap('<totalVatAmount>24.00</totalVatAmount>', '<totalVatAmount>-24.00</totalVatAmount>'))
badInv('ποσό με κόμμα', swap('<totalNetValue>100.00</totalNetValue>', '<totalNetValue>100,00</totalNetValue>'))
badInv('ποσό σε εκθετική μορφή', swap('<totalNetValue>100.00</totalNetValue>', '<totalNetValue>1e2</totalNetValue>'))
badInv('λείπει το μικτό', swap('<totalGrossValue>124.00</totalGrossValue>', ''))
badInv('ΜΑΡΚ με γράμματα', swap('<mark>400001000000101</mark>', '<mark>4000x1</mark>'))
badInv('λείπει ο ΜΑΡΚ', swap('<mark>400001000000101</mark>', ''))
badInv('ανύπαρκτη ημερομηνία', swap('<issueDate>2026-11-02</issueDate>', '<issueDate>2026-02-30</issueDate>'))
badInv('άγνωστος τύπος', swap('<invoiceType>2.1</invoiceType>', '<invoiceType>99.9</invoiceType>'))
badInv('διπλό μικτό', swap('<totalGrossValue>124.00</totalGrossValue>', '<totalGrossValue>124.00</totalGrossValue><totalGrossValue>1.00</totalGrossValue>'))

// H1: το άκυρο δεν πετιέται. Επιστρέφει ΜΑΡΚ (όταν διαβάζεται) και αιτία ως κωδικό.
{
  const q = (xml: string) => { const r = parseRequestedDoc(xml); return r.ok && Array.isArray(r.quarantine) ? r.quarantine : null }
  const t = q(swap('<invoiceType>2.1</invoiceType>', '<invoiceType>99.9</invoiceType>'))
  ok('H1 καραντίνα: άγνωστος τύπος με ΜΑΡΚ και αιτία', t !== null && t.length === 1 && t[0]?.mark === '400001000000101' && t[0]?.reason === 'invoice_type')
  const n = q(swap('<totalVatAmount>24.00</totalVatAmount>', '<totalVatAmount>-24.00</totalVatAmount>'))
  ok('H1 καραντίνα: αρνητικό ποσό', n !== null && n[0]?.mark === '400001000000101' && n[0]?.reason === 'total_vat_amount')
  const m = q(swap('<mark>400001000000101</mark>', '<mark>4000x1</mark>'))
  ok('H1 καραντίνα: ΜΑΡΚ που δεν διαβάζεται γίνεται null, όχι το κείμενό του', m !== null && m[0]?.mark === null && m[0]?.reason === 'mark')
  const d = q(swap('<totalGrossValue>124.00</totalGrossValue>', '<totalGrossValue>124.00</totalGrossValue><totalGrossValue>1.00</totalGrossValue>'))
  ok('H1 καραντίνα: διπλό στοιχείο', d !== null && d[0]?.reason === 'total_gross_value')
}

// ── 3. ΠΟΣΑ: ΑΚΕΡΑΙΑ ΛΕΠΤΑ ΑΠΟ ΚΕΙΜΕΝΟ, ΠΟΤΕ ΑΠΟ ΚΙΝΗΤΗ ΥΠΟΔΙΑΣΤΟΛΗ ──────────────
ok('0 → 0', amountToCents('0') === 0)
ok('0.1 → 10', amountToCents('0.1') === 10)
ok('0.29 → 29 (όχι 28,999…)', amountToCents('0.29') === 29)
ok('1.005 → null (τρία δεκαδικά)', amountToCents('1.005') === null)
ok('9999999999999.99 → όριο του AmountType', amountToCents('9999999999999.99') === 999999999999999)
ok('14 ακέραια ψηφία → null (totalDigits 15)', amountToCents('99999999999999.9') === null)
ok('κενό → null', amountToCents('') === null)
ok('+5 → null', amountToCents('+5') === null)
ok('κενά γύρω επιτρέπονται (xs:decimal collapse)', amountToCents(' 12.40 ') === 1240)

// ── 4. ΑΝΤΙΣΤΟΙΧΙΣΗ ΣΕ ΔΑΠΑΝΗ ──────────────────────────────────────────────────
if (p1.ok && p2.ok) {
  const a = toInboxDoc(p1.invoices[0], CLIENT)
  ok('2.1 προς τον πελάτη: γίνεται δαπάνη', a.kind === 'doc')
  if (a.kind === 'doc') {
    ok('το μικτό μένει όπως το έδωσε η ΑΑΔΕ', a.grossCents === 12400 && a.vatCents === 2400 && a.netCents === 10000)
    ok('όχι πιστωτικό', a.credit === false)
    ok('όχι ακυρωμένο', a.cancelled === false)
    ok('αντισυμβαλλόμενος: ο εκδότης', a.counterpartAfm === '099000037' && a.counterpartName === 'Ηλεκτρική Ενέργεια & Δίκτυα Α.Ε.')
    ok('τίτλος με τύπο, σειρά και αριθμό', a.title === 'Τιμολόγιο Παροχής Υπηρεσιών Α 101')
  }
  const credit = toInboxDoc(p2.invoices[0], CLIENT)
  ok('5.1: πιστωτικό', credit.kind === 'doc' && credit.credit === true)
  ok('5.1: ποσά θετικά όπως στην ΑΑΔΕ, το πρόσημο το λέει η σημαία', credit.kind === 'doc' && credit.grossCents === 1240)
  const cancelled = toInboxDoc(p2.invoices[1], CLIENT)
  ok('cancelledByMark: σημειώνεται ακυρωμένο', cancelled.kind === 'doc' && cancelled.cancelled === true && cancelled.cancellationMark === '400001000000190')
  const self = toInboxDoc(p2.invoices[2], CLIENT)
  ok('αυτοτιμολόγηση από τον ίδιο τον πελάτη: όχι δαπάνη', self.kind === 'skip')
  const title = toInboxDoc(p2.invoices[3], CLIENT)
  ok('3.1 τίτλος κτήσης: όχι δαπάνη του πελάτη', title.kind === 'skip' && title.reason === 'type')
  const other = toInboxDoc(p1.invoices[0], '099000025')
  ok('παραστατικό άλλου λήπτη: ποτέ στον πελάτη', other.kind === 'skip' && other.reason === 'not_counterpart')
  const usd = toInboxDoc({ ...p1.invoices[0], currency: 'USD' }, CLIENT)
  ok('ξένο νόμισμα: δεν μπαίνει με λάθος ποσό', usd.kind === 'skip' && usd.reason === 'currency')
  const selfIssued = toInboxDoc({ ...p1.invoices[0], issuerAfm: CLIENT }, CLIENT)
  ok('εκδότης ο ίδιος ο πελάτης: όχι δαπάνη', selfIssued.kind === 'skip' && selfIssued.reason === 'self_issued')
}
// Πολλαπλοί συντελεστές ΦΠΑ: δύο γραμμές (24% και 13%). Η δαπάνη παίρνει τα
// ΣΥΝΟΛΑ του invoiceSummary όπως τα έγραψε ο εκδότης, όχι άθροισμα γραμμών.
{
  const two = fx('page1.xml').replace(
    `<invoiceDetails>
        <lineNumber>1</lineNumber>
        <netValue>100.00</netValue>
        <vatCategory>1</vatCategory>
        <vatAmount>24.00</vatAmount>
      </invoiceDetails>`,
    `<invoiceDetails>
        <lineNumber>1</lineNumber>
        <netValue>60.00</netValue>
        <vatCategory>1</vatCategory>
        <vatAmount>14.40</vatAmount>
      </invoiceDetails>
      <invoiceDetails>
        <lineNumber>2</lineNumber>
        <netValue>40.00</netValue>
        <vatCategory>2</vatCategory>
        <vatAmount>5.20</vatAmount>
      </invoiceDetails>`,
  ).replace('<totalVatAmount>24.00</totalVatAmount>', '<totalVatAmount>19.60</totalVatAmount>')
    .replace('<totalGrossValue>124.00</totalGrossValue>', '<totalGrossValue>119.60</totalGrossValue>')
  const r = parseRequestedDoc(two)
  ok('δύο συντελεστές ΦΠΑ: διαβάζεται', r.ok && r.invalid === 0)
  if (r.ok) ok('δύο συντελεστές ΦΠΑ: τα σύνολα της ΑΑΔΕ (19,60 / 119,60)', r.invoices[0].vatCents === 1960 && r.invoices[0].grossCents === 11960)
}
// Διορθωτικό: το συμπληρωματικό (1.6 / 2.4) προσθέτει, το πιστωτικό (5.x) αφαιρεί.
{
  const r = parseRequestedDoc(fx('page1.xml').replace('<invoiceType>2.1</invoiceType>', '<invoiceType>2.4</invoiceType>'))
  const d = r.ok ? toInboxDoc(r.invoices[0], CLIENT) : null
  ok('συμπληρωματικό 2.4: δαπάνη, όχι πιστωτικό', !!d && d.kind === 'doc' && d.credit === false)
}
// Αλλαγή έτους: παραστατικό της 31/12 που διαβιβάστηκε τον Ιανουάριο κρατά τη
// δική του ημερομηνία (xs:date, χωρίς ώρα και ζώνη), άρα πάει στη σωστή χρήση.
{
  const r = parseRequestedDoc(fx('page1.xml').replace('<issueDate>2026-11-02</issueDate>', '<issueDate>2025-12-31</issueDate>'))
  ok('31/12 μένει 31/12, χωρίς μετατόπιση ζώνης', r.ok && r.invoices[0].issueDate === '2025-12-31')
  ok('και χωρά στο πρώτο παράθυρο του Ιανουαρίου', firstWindowStart(new Date('2026-01-03T09:00:00Z')) <= '2025-12-31')
}

ok('πιστωτικοί τύποι: 5.1, 5.2, 11.4', ['5.1', '5.2', '11.4'].every(t => CREDIT_TYPES.has(t)) && CREDIT_TYPES.size === 3)
ok('κάθε πιστωτικός τύπος είναι και τύπος δαπάνης', [...CREDIT_TYPES].every(t => EXPENSE_TYPES.has(t)))
ok('οι τίτλοι κτήσης και τα δελτία δεν είναι δαπάνη', !EXPENSE_TYPES.has('3.1') && !EXPENSE_TYPES.has('3.2') && !EXPENSE_TYPES.has('9.3'))

// ── 5. ΔΙΠΛΟΤΥΠΑ ΚΑΙ ΣΤΑΔΙΑΚΟΣ ΣΥΓΧΡΟΝΙΣΜΟΣ ────────────────────────────────────
if (p1.ok && p2.ok) {
  const all = [...p1.invoices, ...p1.invoices, ...p2.invoices]
  ok('ο μέγιστος ΜΑΡΚ με BigInt, όχι με λεξικογραφική σύγκριση', maxMark(['99', '100', '7']) === '100')
  ok('ο μέγιστος ΜΑΡΚ των σελίδων', maxMark(all.map(i => i.mark)) === '400001000000113')
  ok('ο μέγιστος ΜΑΡΚ μετρά και τις ακυρώσεις', maxMark([...all.map(i => i.mark), ...p2.cancellations.map(c => c.cancellationMark)]) === '400001000000191')
  ok('κανένας ΜΑΡΚ: μένει ο προηγούμενος', maxMark([], '42') === '42')
}

// ── 6. ΣΦΑΛΜΑΤΑ ΤΗΣ ΑΑΔΕ ────────────────────────────────────────────────────────
const e401 = classifyHttp(401, '')
ok('401: κλειδί που δεν ισχύει, χωρίς επανάληψη', e401.code === 'auth' && !e401.retry && e401.fatal)
const e403 = classifyHttp(403, '')
ok('403: ο πελάτης δεν έχει εξουσιοδοτήσει τον λογιστή στο myAADE', e403.code === 'forbidden' && !e403.retry && !e403.fatal)
const e429 = classifyHttp(429, '')
ok('429: όριο ρυθμού, με επανάληψη', e429.code === 'rate' && e429.retry)
for (const s of [500, 502, 503, 504]) {
  const e = classifyHttp(s, '<h1>oops</h1>')
  ok(`${s}: σφάλμα διακομιστή, με επανάληψη`, e.code === 'server' && e.retry)
}
const eEmpty = classifyHttp(200, '')
ok('200 με κενό σώμα: δεν είναι «κανένα παραστατικό»', eEmpty.code === 'empty' && eEmpty.retry)
ok('200 με σώμα: εντάξει', classifyHttp(200, '<RequestedDoc/>').code === 'ok')
ok('400: λάθος αίτημα, χωρίς επανάληψη', classifyHttp(400, fx('response-error.xml')).code === 'bad_request')
ok('άγνωστος κωδικός: όχι επιτυχία', classifyHttp(418, '').code === 'http')

ok('αναμονή: 1, 2, 4 δευτερόλεπτα', retryDelayMs(0, null, 0) === 1000 && retryDelayMs(1, null, 0) === 2000 && retryDelayMs(2, null, 0) === 4000)
ok('αναμονή: ταβάνι 30 δευτερόλεπτα', retryDelayMs(10, null, 0) === 30000)
ok('Retry-After σε δευτερόλεπτα', retryDelayMs(0, '7', 0) === 7000)
ok('Retry-After: ταβάνι 60 δευτερόλεπτα', retryDelayMs(0, '3600', 0) === 60000)
ok('Retry-After σκουπίδι: εκθετική', retryDelayMs(1, 'soon', 0) === 2000)
ok('τυχαία διασπορά έως 250ms', retryDelayMs(0, null, 0.999) >= 1000 && retryDelayMs(0, null, 0.999) < 1250)

// Τα σφάλματα που γράφονται στη βάση είναι ΚΩΔΙΚΟΙ από κλειστό κατάλογο, ποτέ
// κείμενο απάντησης: εκεί μπορεί να βρίσκεται ΑΦΜ, όνομα ή κομμάτι κλειδιού.
ok('γνωστός κωδικός περνά', safeErrorCode('rate') === 'rate')
ok('ελεύθερο κείμενο γίνεται «unknown»', safeErrorCode('Ocp-Apim-Subscription-Key abc123 invalid') === 'unknown')

// ── 7. Ο ΚΑΝΟΝΑΣ ΤΩΝ 12 ΩΡΩΝ ────────────────────────────────────────────────────
const now = new Date('2026-11-23T10:00:00Z')
ok('ποτέ συγχρονισμένο: τρέχει', shouldAutoSync(null, now))
ok('πριν 11 ώρες και 59 λεπτά: όχι', !shouldAutoSync('2026-11-22T22:01:00Z', now))
ok('πριν ακριβώς 12 ώρες: τρέχει', shouldAutoSync('2026-11-22T22:00:00Z', now))
ok('πριν 3 ημέρες: τρέχει', shouldAutoSync('2026-11-20T10:00:00Z', now))
ok('ημερομηνία στο μέλλον (ρολόι): όχι', !shouldAutoSync('2026-11-23T11:00:00Z', now))
ok('σκουπίδι: τρέχει (καλύτερα ένας συγχρονισμός παραπάνω)', shouldAutoSync('not-a-date', now))

// ── 8. ΤΟ ΠΕΡΙΒΑΛΛΟΝ ΚΑΙ ΤΟ ΑΙΤΗΜΑ ──────────────────────────────────────────────
ok('χωρίς ρύθμιση: δοκιμαστικό, ποτέ παραγωγή', mydataBase(undefined, undefined) === 'https://mydataapidev.aade.gr')
ok('dev', mydataBase('dev', undefined) === 'https://mydataapidev.aade.gr')
ok('prod μόνο ρητά', mydataBase('prod', undefined) === 'https://mydatapi.aade.gr/myDATA')
ok('fake μόνο σε localhost', mydataBase('fake', 'http://127.0.0.1:8787') === 'http://127.0.0.1:8787')
ok('fake σε ξένο host: αρνείται', mydataBase('fake', 'https://evil.example') === null)
ok('άγνωστη τιμή: αρνείται', mydataBase('staging', undefined) === null)

ok('ημερομηνία ΑΑΔΕ dd/MM/yyyy', aadeDate('2026-01-05') === '05/01/2026')
ok('πρώτο παράθυρο: 1 Ιανουαρίου της προηγούμενης χρονιάς (Αθήνα)', firstWindowStart(new Date('2026-01-01T00:30:00+02:00')) === '2025-01-01')
const u = new URL(requestDocsUrl('https://mydataapidev.aade.gr', {
  mark: '400001000000101', entityVatNumber: CLIENT, dateFrom: '2025-01-01', dateTo: '2026-11-23',
  next: { partitionKey: 'p k', rowKey: 'r&k' },
}))
ok('RequestDocs: διαδρομή', u.pathname === '/RequestDocs')
ok('RequestDocs: mark', u.searchParams.get('mark') === '400001000000101')
ok('RequestDocs: entityVatNumber', u.searchParams.get('entityVatNumber') === CLIENT)
ok('RequestDocs: ημερομηνίες dd/MM/yyyy', u.searchParams.get('dateFrom') === '01/01/2025' && u.searchParams.get('dateTo') === '23/11/2026')
ok('RequestDocs: συνέχεια κωδικοποιημένη', u.searchParams.get('nextPartitionKey') === 'p k' && u.searchParams.get('nextRowKey') === 'r&k')
ok('RequestDocs: στην παραγωγή κάτω από /myDATA', new URL(requestDocsUrl('https://mydatapi.aade.gr/myDATA', { mark: '0', entityVatNumber: CLIENT, dateFrom: '2026-01-01', dateTo: '2026-01-02' })).pathname === '/myDATA/RequestDocs')
let threw = false
try { requestDocsUrl('https://mydataapidev.aade.gr', { mark: '0', entityVatNumber: '12345', dateFrom: '2026-01-01', dateTo: '2026-01-02' }) } catch { threw = true }
ok('RequestDocs: άκυρο ΑΦΜ δεν φεύγει ποτέ προς την ΑΑΔΕ', threw)

const pu = new URL(probeUrl('https://mydataapidev.aade.gr/', '2026-11-23'))
ok('έλεγχος κλειδιού: χωρίς ΑΦΜ πελάτη', !pu.searchParams.has('entityVatNumber'))
ok('έλεγχος κλειδιού: ΜΑΡΚ στο ανώτατο, μία ημέρα', pu.searchParams.get('mark') === '9223372036854775806' && pu.searchParams.get('dateFrom') === '23/11/2026' && pu.searchParams.get('dateTo') === '23/11/2026')
ok('έλεγχος κλειδιού: χωρίς διπλή κάθετο', pu.pathname === '/RequestDocs')
const h = aadeHeaders('logistis1', 'K')
ok('κεφαλίδες §4.1', h['aade-user-id'] === 'logistis1' && h['Ocp-Apim-Subscription-Key'] === 'K' && Object.keys(h).length === 3)

// ── Α2: ΤΑ ΣΥΝΟΛΑ ΚΛΕΙΝΟΥΝ ΟΠΩΣ ΤΑ ΔΙΝΕΙ Η ΑΑΔΕ ─────────────────────────────────
// totalGrossValue = καθαρό + ΦΠΑ − παρακρατήσεις + τέλη + χαρτόσημο + λοιποί φόροι
// − κρατήσεις (InvoiceSummaryType). Ο έλεγχος δεν ξαναϋπολογίζει ποσό: μόνο λέει
// αν τα οκτώ σύνολα συμφωνούν, για να μη γίνει αυτόματα κάτι που δεν κλείνει.
{
  const first = (xml: string) => {
    const r = parseRequestedDoc(xml)
    if (!r.ok) return null
    const m = toInboxDoc(r.invoices[0], CLIENT)
    return m.kind === 'doc' ? m : null
  }
  ok('Α2: το δείγμα κλείνει (100,00 + 24,00 = 124,00)', first(fx('page1.xml'))?.amountsClose === true)
  const off = fx('page1.xml').replace('<totalGrossValue>124.00</totalGrossValue>', '<totalGrossValue>125.00</totalGrossValue>')
  ok('Α2: μικτό ένα ευρώ πάνω: δεν κλείνει', first(off)?.amountsClose === false)
  const taxed = off.replace('<totalOtherTaxesAmount>0.00</totalOtherTaxesAmount>', '<totalOtherTaxesAmount>1.00</totalOtherTaxesAmount>')
  ok('Α2: με λοιπούς φόρους 1,00 κλείνει ξανά', first(taxed)?.amountsClose === true)
  const withheld = fx('page1.xml').replace('<totalWithheldAmount>0.00</totalWithheldAmount>', '<totalWithheldAmount>4.00</totalWithheldAmount>')
    .replace('<totalGrossValue>124.00</totalGrossValue>', '<totalGrossValue>120.00</totalGrossValue>')
  ok('Α2: η παρακράτηση αφαιρείται', first(withheld)?.amountsClose === true)
  ok('Α2: το μικτό μένει όπως το έδωσε η ΑΑΔΕ', first(off)?.grossCents === 12500)
}

// ── ΘΩΡΑΚΙΣΗ 24/11/2026: ΤΟ ΠΙΣΤΩΤΙΚΟ ΔΕΝΕΤΑΙ ΜΕ ΤΟ ΑΡΧΙΚΟ ──────────────────────
// InvoiceHeaderType, `correlatedInvoices` (xs:long, 0..ν): οι ΜΑΡΚ των
// συσχετιζόμενων παραστατικών (Παράρτημα 8.1, 5.1 «Πιστωτικό Τιμολόγιο /
// Συσχετιζόμενο»). Κρατιέται ο πρώτος έγκυρος· άκυρη τιμή αγνοείται, δεν
// στέλνει το παραστατικό σε καραντίνα (είναι προαιρετικό στοιχείο).
{
  const withCorr = (vals: string[]) => fx('page1.xml').replace('<currency>EUR</currency>',
    '<currency>EUR</currency>' + vals.map(v => `<correlatedInvoices>${v}</correlatedInvoices>`).join(''))
  const one = parseRequestedDoc(withCorr(['400001000000090', '400001000000091']))
  ok('συσχετιζόμενο: διαβάζεται ο πρώτος ΜΑΡΚ', one.ok && one.invoices[0].correlatedMark === '400001000000090')
  ok('συσχετιζόμενο: χωρίς στοιχείο, null', one.ok && one.invoices[1].correlatedMark === null)
  const bad = parseRequestedDoc(withCorr(['abc']))
  ok('συσχετιζόμενο: άκυρη τιμή αγνοείται, όχι καραντίνα', bad.ok && bad.invalid === 0 && bad.invoices[0].correlatedMark === null)
  if (one.ok) {
    const m = toInboxDoc({ ...one.invoices[0], invoiceType: '5.1' }, CLIENT)
    ok('συσχετιζόμενο: φτάνει στη γραμμή των Εισερχομένων', m.kind === 'doc' && m.correlatedMark === '400001000000090')
  }
}

console.log(`mydata: ${pass} ✓ · ${fail} ✗`)
if (fail) process.exit(1)
