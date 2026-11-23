// ═══════════════════════════════════════════════════════════════════════════
// myDATA ΜΕΣΩ ΛΟΓΙΣΤΗ: Ο,ΤΙ ΚΡΙΝΕΙ, ΧΩΡΙΣ ΔΙΚΤΥΟ ΚΑΙ ΧΩΡΙΣ ΒΑΣΗ
// ─────────────────────────────────────────────────────────────────────────
// Η συνάρτηση `mydata-sync` (Deno) μιλά με την ΑΑΔΕ και με τη βάση. Ολα όσα
// ΑΠΟΦΑΣΙΖΟΥΝ ζουν εδώ και τρέχουν ίδια σε Deno και σε Node (mydata.test.ts).
// Εισάγει μόνο τις διευθύνσεις του myDATA και τον κανόνα των 12 ωρών.
//
// ΠΗΓΕΣ (ΑΑΔΕ, myDATA REST API, τεκμηρίωση για χρήστες ERP v2.0.2, 09/2026):
//   · §4.2 «Μέθοδοι λήψης»: RequestDocs. Επιστρέφει όσα παραστατικά,
//     ακυρώσεις και χαρακτηρισμούς έχουν διαβιβάσει ΑΛΛΟΙ και αφορούν την
//     οντότητα, δηλαδή τα εισερχόμενα (έξοδα) του πελάτη. Παράμετροι: mark
//     (υποχρεωτική· επιστρέφονται ΜΑΡΚ μεγαλύτερα από αυτόν), entityVatNumber
//     (όταν καλεί τρίτος, «όπως εκπρόσωπος Ν.Π. ή λογιστής»), dateFrom /
//     dateTo (dd/MM/yyyy), maxMark, nextPartitionKey / nextRowKey.
//   · §4.1 Κεφαλίδες αυθεντικοποίησης: `aade-user-id` και
//     `Ocp-Apim-Subscription-Key`, του χρήστη που καλεί (εδώ: του λογιστή).
//   · Σχήμα απάντησης: requestedInvoicesDoc-v2.0.2.xsd (RequestedDoc,
//     continuationToken, invoicesDoc/invoice: AadeBookInvoiceType,
//     cancelledInvoicesDoc/cancelledInvoice: CancelledInvoiceType) και
//     InvoicesDoc-v2.0.2.xsd / SimpleTypes-v2.0.2.xsd (AmountType: xs:decimal,
//     fractionDigits 2, minInclusive 0, totalDigits 15· InvoiceType: ο κατάλογος
//     του Παραρτήματος 8.1).
//   · Διευθύνσεις: δοκιμαστικό `https://mydataapidev.aade.gr/`, παραγωγή
//     `https://mydatapi.aade.gr/myDATA/`.
//
// ΤΙ ΔΕΝ ΚΑΝΕΙ ΠΟΤΕ. Δεν ξαναϋπολογίζει ποσό: καθαρό, ΦΠΑ και μικτό είναι όσα
// γράφει η ΑΑΔΕ, μετατρεπόμενα από ΚΕΙΜΕΝΟ σε ακέραια λεπτά χωρίς να περάσουν
// από κινητή υποδιαστολή. Δεν κρατά ό,τι δεν χρειάζεται (τρόποι πληρωμής,
// χαρακτηρισμοί, διευθύνσεις): ελαχιστοποίηση, άρθρο 5§1(γ) ΓΚΠΔ.
// ═══════════════════════════════════════════════════════════════════════════

import { MYDATA_API_DEV, MYDATA_API_PROD, MYDATA_INVOICE_NS } from '../../../lib/tax/aade.ts'
import { shouldAutoSync, AUTO_SYNC_HOURS } from '../../../lib/mydata/autoSync.ts'

/** Ο χώρος ονομάτων του σχήματος παραστατικών της ΑΑΔΕ (lib/tax/aade.ts). */
export const INV_NS = MYDATA_INVOICE_NS

/** Ανώτατο μέγεθος απάντησης που διαβάζουμε. Μία σελίδα της ΑΑΔΕ είναι πολύ μικρότερη. */
export const MAX_XML_BYTES = 5 * 1024 * 1024

/**
 * Η έκδοση του αναγνώστη. Ανέβα την όταν αλλάζει τι δέχεται η ανάγνωση (νέος
 * τύπος, νέο πεδίο): οι πελάτες σε καραντίνα ξαναζητούνται αμέσως, αντί να
 * περιμένουν τη μία φορά την εβδομάδα (mydata_sync_targets).
 */
export const PARSER_VERSION = 'erp-2.0.2-r1'
const MAX_DEPTH = 64
const MAX_ELEMENTS = 250_000

// ── Οι κωδικοί σφάλματος που επιτρέπεται να γραφτούν στη βάση ───────────────
// Κλειστός κατάλογος. Ποτέ κείμενο απάντησης της ΑΑΔΕ ή εξαίρεσης: εκεί μπορεί
// να βρίσκεται ΑΦΜ, όνομα ή κομμάτι της κεφαλίδας με το κλειδί.
export const ERROR_CODES = [
  'auth', 'forbidden', 'rate', 'server', 'empty', 'bad_request', 'http', 'network', 'timeout',
  'parse', 'aade_error', 'no_key', 'no_afm', 'not_linked', 'config', 'unknown', 'quarantine',
] as const
export type ErrorCode = typeof ERROR_CODES[number]
export function safeErrorCode(v: unknown): ErrorCode {
  return (ERROR_CODES as readonly string[]).includes(String(v)) ? v as ErrorCode : 'unknown'
}

// ── Οι τύποι παραστατικών (Παράρτημα 8.1, SimpleTypes InvoiceType) ─────────
const INVOICE_TYPES = new Set([
  '1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '2.1', '2.2', '2.3', '2.4', '3.1', '3.2', '4', '5.1', '5.2',
  '6.1', '6.2', '7.1', '8.1', '8.2', '8.4', '8.5', '8.6', '9.1', '9.2', '9.3', '10.1', '10.2',
  '11.1', '11.2', '11.3', '11.4', '11.5', '12', '13.1', '13.2', '13.3', '13.4', '13.30', '13.31',
  '14.1', '14.2', '14.3', '14.4', '14.5', '14.30', '14.31', '15.1', '16.1', '17.1', '17.2', '17.3',
  '17.4', '17.5', '17.6',
])

/**
 * Οι τύποι που, όταν τους εκδίδει ΑΛΛΟΣ προς τον πελάτη, είναι δαπάνη του.
 *
 * ΕΚΤΟΣ ΚΑΙ ΓΙΑΤΙ: 3.1/3.2 (τίτλος κτήσης: τον εκδίδει ο αγοραστής, άρα για τον
 * λήπτη είναι έσοδο)· 1.5 (εκκαθάριση πωλήσεων τρίτων: το μικτό δεν είναι η
 * δαπάνη του εντολέα, θέλει λογιστή)· 6.x (αυτοπαράδοση)· 8.2 (τέλος διαμονής
 * που εισπράττει ο ίδιος)· 9.x (δελτία χωρίς αξία)· 13.x–17.x (τα εκδίδει ή τα
 * καταχωρεί ο ίδιος ο λήπτης, άρα δεν επιστρέφονται ως «εισερχόμενα»).
 */
export const EXPENSE_TYPES = new Set([
  '1.1', '1.2', '1.3', '1.4', '1.6', '2.1', '2.2', '2.3', '2.4', '5.1', '5.2', '7.1', '8.1',
  '11.1', '11.2', '11.3', '11.4', '11.5',
])

/** Πιστωτικά: τα ποσά έρχονται θετικά (AmountType ≥ 0) και ΑΦΑΙΡΟΥΝΤΑΙ. */
export const CREDIT_TYPES = new Set(['5.1', '5.2', '11.4'])

/** Το όνομα κάθε τύπου όπως το γράφει το Παράρτημα 8.1, για τον τίτλο της γραμμής. */
const TYPE_NAME: Record<string, string> = {
  '1.1': 'Τιμολόγιο Πώλησης', '1.2': 'Τιμολόγιο Πώλησης (ενδοκοινοτικό)', '1.3': 'Τιμολόγιο Πώλησης (τρίτη χώρα)',
  '1.4': 'Τιμολόγιο Πώλησης για λογαριασμό τρίτων', '1.6': 'Συμπληρωματικό Τιμολόγιο Πώλησης',
  '2.1': 'Τιμολόγιο Παροχής Υπηρεσιών', '2.2': 'Τιμολόγιο Παροχής (ενδοκοινοτικό)', '2.3': 'Τιμολόγιο Παροχής (τρίτη χώρα)',
  '2.4': 'Συμπληρωματικό Τιμολόγιο Παροχής', '5.1': 'Πιστωτικό Τιμολόγιο', '5.2': 'Πιστωτικό Τιμολόγιο',
  '7.1': 'Συμβόλαιο', '8.1': 'Απόδειξη Ενοικίου', '11.1': 'Απόδειξη Λιανικής', '11.2': 'Απόδειξη Παροχής Υπηρεσιών',
  '11.3': 'Απλοποιημένο Τιμολόγιο', '11.4': 'Πιστωτικό Λιανικής', '11.5': 'Απόδειξη Λιανικής για λογαριασμό τρίτων',
}

// ═══ 1. ΕΝΑΣ ΑΥΣΤΗΡΟΣ ΑΝΑΓΝΩΣΤΗΣ XML ═══════════════════════════════════════
// Το Deno δεν έχει DOMParser στις συναρτήσεις άκρου και μια βιβλιοθήκη θα ήταν
// εξάρτηση μόνο γι' αυτό. Ο αναγνώστης δέχεται ΜΟΝΟ ό,τι χρειάζεται ένα
// RequestedDoc και απορρίπτει τα υπόλοιπα:
//   · DOCTYPE: ποτέ (κλείνει XXE και «billion laughs» εξ ορισμού)
//   · οντότητες: μόνο οι πέντε προκαθορισμένες και οι αριθμητικές
//   · βάθος, πλήθος στοιχείων και μέγεθος με ταβάνι
//   · κάθε πρόθεμα χώρου ονομάτων πρέπει να έχει δηλωθεί
// Δεν πετά ποτέ προς τα έξω: κάθε αποτυχία γίνεται `{ ok: false, error }`.

interface XNode { ns: string; local: string; children: XNode[]; text: string }

class XmlError extends Error { constructor(public code: ParseError) { super(code) } }

const NAME = /^[A-Za-z_][\w.\-]*(?::[A-Za-z_][\w.\-]*)?$/

function decodeEntities(s: string): string {
  if (!s.includes('&')) return s
  return s.replace(/&([^;\s]{0,12});|&/g, (m, body: string | undefined) => {
    if (body === undefined) throw new XmlError('malformed')
    switch (body) {
      case 'lt': return '<'
      case 'gt': return '>'
      case 'amp': return '&'
      case 'quot': return '"'
      case 'apos': return "'"
    }
    const num = /^#x([0-9a-fA-F]{1,6})$/.exec(body) ?? /^#([0-9]{1,7})$/.exec(body)
    if (!num) throw new XmlError('malformed')
    const cp = parseInt(num[1], body[1] === 'x' ? 16 : 10)
    if (!(cp === 0x9 || cp === 0xA || cp === 0xD || (cp >= 0x20 && cp <= 0xD7FF) || (cp >= 0xE000 && cp <= 0x10FFFF) && !(cp >= 0xFFFE && cp <= 0xFFFF))) {
      throw new XmlError('malformed')
    }
    return String.fromCodePoint(cp)
  })
}

function parseXml(input: string): XNode {
  let s = input
  if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1)
  const n = s.length
  let i = 0
  let root: XNode | null = null
  let count = 0
  const stack: { node: XNode; qname: string; scope: Map<string, string> }[] = []
  const rootScope = new Map<string, string>([['xml', 'http://www.w3.org/XML/1998/namespace']])

  const scopeOf = () => (stack.length ? stack[stack.length - 1].scope : rootScope)
  const resolve = (qname: string, scope: Map<string, string>, isElement: boolean): [string, string] => {
    const c = qname.indexOf(':')
    if (c < 0) return [isElement ? (scope.get('') ?? '') : '', qname]
    const prefix = qname.slice(0, c)
    const uri = scope.get(prefix)
    if (uri === undefined) throw new XmlError('malformed')
    return [uri, qname.slice(c + 1)]
  }

  while (i < n) {
    const lt = s.indexOf('<', i)
    const textEnd = lt < 0 ? n : lt
    if (textEnd > i) {
      const raw = s.slice(i, textEnd)
      if (stack.length) stack[stack.length - 1].node.text += decodeEntities(raw)
      else if (raw.trim()) throw new XmlError('malformed')
      i = textEnd
      continue
    }
    if (s.startsWith('<?', i)) {
      const end = s.indexOf('?>', i + 2)
      if (end < 0) throw new XmlError('malformed')
      const target = s.slice(i + 2, end).trim().split(/\s/)[0]
      // Μόνο η δήλωση XML και μόνο στην αρχή.
      if (target !== 'xml' || i !== 0) throw new XmlError('malformed')
      i = end + 2
      continue
    }
    if (s.startsWith('<!--', i)) {
      const end = s.indexOf('-->', i + 4)
      if (end < 0) throw new XmlError('malformed')
      i = end + 3
      continue
    }
    if (s.startsWith('<![CDATA[', i)) {
      const end = s.indexOf(']]>', i + 9)
      if (end < 0 || !stack.length) throw new XmlError('malformed')
      stack[stack.length - 1].node.text += s.slice(i + 9, end)
      i = end + 3
      continue
    }
    if (s.startsWith('<!', i)) {
      if (/^<!DOCTYPE/i.test(s.slice(i, i + 9))) throw new XmlError('doctype')
      throw new XmlError('malformed')
    }
    if (s.startsWith('</', i)) {
      const end = s.indexOf('>', i + 2)
      if (end < 0) throw new XmlError('malformed')
      const qname = s.slice(i + 2, end).trim()
      const top = stack.pop()
      if (!top || top.qname !== qname) throw new XmlError('malformed')
      i = end + 1
      continue
    }
    // Ετικέτα ανοίγματος. Οι τιμές ιδιοτήτων δεν περιέχουν «>» χωρίς οντότητα
    // στο XML της ΑΑΔΕ· αν περιέχουν, ο αναγνώστης το βρίσκει παρακάτω ως σφάλμα.
    let end = i + 1
    let quote = ''
    while (end < n) {
      const ch = s[end]
      if (quote) { if (ch === quote) quote = '' }
      else if (ch === '"' || ch === "'") quote = ch
      else if (ch === '>') break
      end++
    }
    if (end >= n) throw new XmlError('malformed')
    let body = s.slice(i + 1, end)
    const selfClose = body.endsWith('/')
    if (selfClose) body = body.slice(0, -1)
    const m = /^([^\s/>]+)([\s\S]*)$/.exec(body)
    if (!m || !NAME.test(m[1])) throw new XmlError('malformed')
    const qname = m[1]
    const attrs: [string, string][] = []
    const rest = m[2]
    const attrRe = /\s+([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/y
    let pos = 0
    while (pos < rest.length) {
      if (/^\s*$/.test(rest.slice(pos))) break
      attrRe.lastIndex = pos
      const a = attrRe.exec(rest)
      if (!a || !NAME.test(a[1])) throw new XmlError('malformed')
      attrs.push([a[1], decodeEntities(a[2] ?? a[3] ?? '')])
      pos = attrRe.lastIndex
    }
    const scope = new Map(scopeOf())
    for (const [k, v] of attrs) {
      if (k === 'xmlns') scope.set('', v)
      else if (k.startsWith('xmlns:')) scope.set(k.slice(6), v)
    }
    const [ns, local] = resolve(qname, scope, true)
    const node: XNode = { ns, local, children: [], text: '' }
    if (++count > MAX_ELEMENTS) throw new XmlError('malformed')
    if (stack.length) stack[stack.length - 1].node.children.push(node)
    else if (root) throw new XmlError('malformed')
    else root = node
    if (!selfClose) {
      stack.push({ node, qname, scope })
      if (stack.length > MAX_DEPTH) throw new XmlError('malformed')
    }
    i = end + 1
  }
  if (stack.length || !root) throw new XmlError('malformed')
  return root
}

// ═══ 2. ΑΠΟ ΤΟ ΔΕΝΤΡΟ ΣΤΑ ΠΑΡΑΣΤΑΤΙΚΑ ══════════════════════════════════════

export type ParseError =
  | 'empty' | 'too_large' | 'malformed' | 'doctype' | 'unexpected_root' | 'aade_error'
  | 'unknown_element' | 'invalid_token'

export interface ParsedInvoice {
  /** ΜΑΡΚ ως κείμενο: xs:long, δεκαπέντε ψηφία σήμερα, χωρίς απώλεια. */
  mark: string
  cancelledByMark: string | null
  issuerAfm: string
  issuerName: string | null
  counterpartAfm: string | null
  series: string
  aa: string
  issueDate: string
  invoiceType: string
  currency: string | null
  selfPricing: boolean
  netCents: number
  vatCents: number
  grossCents: number
}

export interface ParsedCancellation { invoiceMark: string; cancellationMark: string; cancellationDate: string }

export interface ContinuationToken { partitionKey: string; rowKey: string }

/**
 * Ενα παραστατικό που η αυστηρή ανάγνωση δεν δέχτηκε. Δεν πετιέται: πηγαίνει σε
 * καραντίνα με τον ΜΑΡΚ του (όταν ο ίδιος ο ΜΑΡΚ διαβάζεται) και την αιτία ως
 * κωδικό `[a-z_]`. Ο ΜΑΡΚ της άδειας σταματά πριν από αυτό.
 */
export interface InvalidDoc { mark: string | null; reason: string }

export type ParseResult =
  | { ok: true; invoices: ParsedInvoice[]; cancellations: ParsedCancellation[]; invalid: number; quarantine: InvalidDoc[]; next: ContinuationToken | null }
  | { ok: false; error: ParseError; aadeCodes?: string[] }

const TOP = new Set(['continuationToken', 'invoicesDoc', 'cancelledInvoicesDoc', 'incomeClassificationsDoc', 'expensesClassificationsDoc', 'paymentMethodsDoc'])

const MARK_RE = /^[1-9][0-9]{0,18}$/
// Χωρίς λεκτικό `…n`: η εφαρμογή μεταγλωττίζεται και για στόχο κάτω από ES2020.
const MAX_LONG = BigInt('9223372036854775807')
const isMark = (v: string): boolean => MARK_RE.test(v) && BigInt(v) <= MAX_LONG

/**
 * Ποσό xs:decimal της ΑΑΔΕ σε ακέραια λεπτά, από το ΚΕΙΜΕΝΟ.
 *
 * Το «88.5» δεν περνά ποτέ από `parseFloat(…) * 100`, που για αρκετές τιμές
 * δίνει 8849,999… Ακέραιο και δεκαδικό μέρος διαβάζονται χωριστά. Ο,τι δεν
 * ταιριάζει στο AmountType (αρνητικό, τρία δεκαδικά, εκθετική μορφή, κόμμα,
 * πάνω από 15 ψηφία) είναι null: άκυρο, όχι στρογγυλεμένο.
 */
export function amountToCents(raw: string): number | null {
  const v = String(raw ?? '').trim()
  const m = /^([0-9]+)(?:\.([0-9]{1,2}))?$/.exec(v)
  if (!m) return null
  const int = m[1].replace(/^0+(?=\d)/, '')
  const frac = (m[2] ?? '').padEnd(2, '0')
  if (int.length + 2 > 15) return null
  return Number(int) * 100 + Number(frac)
}

const isIsoDate = (v: string): boolean => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  if (!m) return false
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3]
}

class InvalidInvoice extends Error {}

/** Το ένα και μοναδικό παιδί με αυτό το όνομα· δύο είναι άκυρο, κανένα `undefined`. */
function one(node: XNode, local: string): XNode | undefined {
  let found: XNode | undefined
  for (const c of node.children) {
    if (c.ns === INV_NS && c.local === local) {
      if (found) throw new InvalidInvoice(local)
      found = c
    }
  }
  return found
}
const text = (node: XNode | undefined): string | undefined => node === undefined ? undefined : node.text.trim()
function need(node: XNode, local: string): string {
  const v = text(one(node, local))
  if (v === undefined || v === '') throw new InvalidInvoice(local)
  return v
}
function cents(node: XNode, local: string): number {
  const c = amountToCents(need(node, local))
  if (c === null) throw new InvalidInvoice(local)
  return c
}
const cleanName = (v: string | undefined): string | null => {
  const s = (v ?? '').replace(/\s+/g, ' ').trim().slice(0, 200)
  return s ? s : null
}

function parseInvoice(inv: XNode): ParsedInvoice {
  const mark = need(inv, 'mark')
  if (!isMark(mark)) throw new InvalidInvoice('mark')
  const cbm = text(one(inv, 'cancelledByMark'))
  if (cbm !== undefined && !isMark(cbm)) throw new InvalidInvoice('cancelledByMark')

  const issuer = one(inv, 'issuer')
  if (!issuer) throw new InvalidInvoice('issuer')
  const issuerAfm = need(issuer, 'vatNumber')
  if (issuerAfm.length > 30) throw new InvalidInvoice('issuer')
  const counterpart = one(inv, 'counterpart')
  const counterpartAfm = counterpart ? need(counterpart, 'vatNumber') : null

  const header = one(inv, 'invoiceHeader')
  if (!header) throw new InvalidInvoice('invoiceHeader')
  const series = need(header, 'series')
  const aa = need(header, 'aa')
  if (series.length > 50 || aa.length > 50) throw new InvalidInvoice('aa')
  const issueDate = need(header, 'issueDate')
  if (!isIsoDate(issueDate)) throw new InvalidInvoice('issueDate')
  const invoiceType = need(header, 'invoiceType')
  if (!INVOICE_TYPES.has(invoiceType)) throw new InvalidInvoice('invoiceType')
  const currency = text(one(header, 'currency')) || null
  if (currency !== null && !/^[A-Z]{3}$/.test(currency)) throw new InvalidInvoice('currency')
  const sp = text(one(header, 'selfPricing'))
  if (sp !== undefined && !['true', 'false', '1', '0'].includes(sp)) throw new InvalidInvoice('selfPricing')

  const summary = one(inv, 'invoiceSummary')
  if (!summary) throw new InvalidInvoice('invoiceSummary')
  // Ολα τα οκτώ σύνολα του InvoiceSummaryType είναι υποχρεωτικά στο σχήμα και
  // ελέγχονται όλα· κρατιούνται μόνο τα τρία που χρειάζεται η δαπάνη.
  for (const k of ['totalWithheldAmount', 'totalFeesAmount', 'totalStampDutyAmount', 'totalOtherTaxesAmount', 'totalDeductionsAmount']) cents(summary, k)

  return {
    mark, cancelledByMark: cbm ?? null,
    issuerAfm, issuerName: cleanName(text(one(issuer, 'name'))),
    counterpartAfm,
    series, aa, issueDate, invoiceType, currency,
    selfPricing: sp === 'true' || sp === '1',
    netCents: cents(summary, 'totalNetValue'),
    vatCents: cents(summary, 'totalVatAmount'),
    grossCents: cents(summary, 'totalGrossValue'),
  }
}

function parseCancellation(c: XNode): ParsedCancellation {
  const invoiceMark = need(c, 'invoiceMark')
  const cancellationMark = need(c, 'cancellationMark')
  const cancellationDate = need(c, 'cancellationDate')
  if (!isMark(invoiceMark) || !isMark(cancellationMark) || !isIsoDate(cancellationDate)) throw new InvalidInvoice('cancellation')
  return { invoiceMark, cancellationMark, cancellationDate }
}

/** Οι αριθμητικοί κωδικοί σφάλματος ενός ResponseDoc, χωρίς το κείμενό τους. */
function responseCodes(root: XNode): string[] {
  const out: string[] = []
  const walk = (x: XNode) => {
    if (x.local === 'code' && /^\d{1,6}$/.test(x.text.trim())) out.push(x.text.trim())
    x.children.forEach(walk)
  }
  walk(root)
  return out.slice(0, 10)
}

/** Η απάντηση της RequestDocs, διαβασμένη αυστηρά. Δεν πετά ποτέ. */
export function parseRequestedDoc(xml: string): ParseResult {
  const raw = String(xml ?? '')
  if (new TextEncoder().encode(raw).length > MAX_XML_BYTES) return { ok: false, error: 'too_large' }
  if (!raw.trim()) return { ok: false, error: 'empty' }
  let root: XNode
  try { root = parseXml(raw.trim()) } catch (e) {
    return { ok: false, error: e instanceof XmlError ? e.code : 'malformed' }
  }
  if (root.local === 'ResponseDoc') return { ok: false, error: 'aade_error', aadeCodes: responseCodes(root) }
  if (root.local !== 'RequestedDoc' || root.ns !== INV_NS) return { ok: false, error: 'unexpected_root' }

  const seen = new Set<string>()
  for (const c of root.children) {
    if (c.ns !== INV_NS || !TOP.has(c.local) || seen.has(c.local)) return { ok: false, error: 'unknown_element' }
    seen.add(c.local)
  }

  let next: ContinuationToken | null = null
  const tok = root.children.find(c => c.local === 'continuationToken')
  if (tok) {
    try {
      const partitionKey = need(tok, 'nextPartitionKey')
      const rowKey = need(tok, 'nextRowKey')
      if (partitionKey.length > 512 || rowKey.length > 512) return { ok: false, error: 'invalid_token' }
      next = { partitionKey, rowKey }
    } catch { return { ok: false, error: 'invalid_token' } }
  }

  const invoices: ParsedInvoice[] = []
  const cancellations: ParsedCancellation[] = []
  const quarantine: InvalidDoc[] = []
  const invDoc = root.children.find(c => c.local === 'invoicesDoc')
  for (const c of invDoc?.children ?? []) {
    if (c.ns !== INV_NS || c.local !== 'invoice') return { ok: false, error: 'unknown_element' }
    try { invoices.push(parseInvoice(c)) } catch (e) { quarantine.push(invalidDoc(c, 'mark', 'invoice', e)) }
  }
  const canDoc = root.children.find(c => c.local === 'cancelledInvoicesDoc')
  for (const c of canDoc?.children ?? []) {
    if (c.ns !== INV_NS || c.local !== 'cancelledInvoice') return { ok: false, error: 'unknown_element' }
    try { cancellations.push(parseCancellation(c)) } catch (e) { quarantine.push(invalidDoc(c, 'cancellationMark', 'cancellation', e)) }
  }
  return { ok: true, invoices, cancellations, invalid: quarantine.length, quarantine, next }
}

/** «invoiceType» → «invoice_type»: η αιτία γράφεται στη βάση μόνο ως κωδικός. */
const reasonCode = (v: string): string => {
  const s = v.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase().replace(/[^a-z_]/g, '').slice(0, 40)
  return s || 'unknown'
}

/** Ο ΜΑΡΚ του άκυρου (μόνο αν διαβάζεται σωστά) και η αιτία, ποτέ άλλο πεδίο. */
function invalidDoc(node: XNode, markField: string, fallback: string, e: unknown): InvalidDoc {
  let mark: string | null = null
  try {
    const v = text(one(node, markField))
    if (v !== undefined && isMark(v)) mark = v
  } catch { mark = null }
  return { mark, reason: reasonCode(e instanceof InvalidInvoice && e.message ? e.message : fallback) }
}

// ═══ 3. ΑΠΟ ΤΟ ΠΑΡΑΣΤΑΤΙΚΟ ΣΤΗ ΓΡΑΜΜΗ ΤΩΝ ΕΙΣΕΡΧΟΜΕΝΩΝ ═════════════════════

export type SkipReason = 'not_counterpart' | 'self_issued' | 'self_pricing' | 'type' | 'currency'

export type InboxDoc =
  | { kind: 'skip'; reason: SkipReason }
  | {
      kind: 'doc'
      mark: string
      counterpartAfm: string
      counterpartName: string | null
      docType: string
      series: string
      aa: string
      issueDate: string
      title: string
      netCents: number
      vatCents: number
      grossCents: number
      credit: boolean
      cancelled: boolean
      cancellationMark: string | null
    }

/**
 * Γίνεται το παραστατικό δαπάνη του πελάτη; Και αν ναι, με ποια στοιχεία.
 *
 * ΜΟΝΟ όταν ο πελάτης είναι ο ΛΗΠΤΗΣ (counterpart) και ΟΧΙ ο εκδότης. Η
 * αυτοτιμολόγηση (selfPricing) σημαίνει ότι τον εκδότη τον ορίζει ο αγοραστής,
 * άρα για τον λήπτη είναι έσοδο. Ξένο νόμισμα: δεν μπαίνει, γιατί δεν θα
 * ξέραμε με βεβαιότητα αν τα ποσά είναι σε ευρώ.
 */
export function toInboxDoc(inv: ParsedInvoice, entityAfm: string): InboxDoc {
  if (inv.counterpartAfm !== entityAfm) return { kind: 'skip', reason: 'not_counterpart' }
  if (inv.issuerAfm === entityAfm) return { kind: 'skip', reason: 'self_issued' }
  if (inv.selfPricing) return { kind: 'skip', reason: 'self_pricing' }
  if (!EXPENSE_TYPES.has(inv.invoiceType)) return { kind: 'skip', reason: 'type' }
  if (inv.currency !== null && inv.currency !== 'EUR') return { kind: 'skip', reason: 'currency' }
  return {
    kind: 'doc',
    mark: inv.mark,
    counterpartAfm: inv.issuerAfm,
    counterpartName: inv.issuerName,
    docType: inv.invoiceType,
    series: inv.series,
    aa: inv.aa,
    issueDate: inv.issueDate,
    title: `${TYPE_NAME[inv.invoiceType] ?? 'Παραστατικό'} ${inv.series} ${inv.aa}`.slice(0, 300),
    netCents: inv.netCents,
    vatCents: inv.vatCents,
    grossCents: inv.grossCents,
    credit: CREDIT_TYPES.has(inv.invoiceType),
    cancelled: inv.cancelledByMark !== null,
    cancellationMark: inv.cancelledByMark,
  }
}

/** Ο μεγαλύτερος ΜΑΡΚ, με BigInt: «100» > «99», που λεξικογραφικά δεν ισχύει. */
export function maxMark(marks: string[], prev = '0'): string {
  let best = BigInt(MARK_RE.test(prev) || prev === '0' ? prev : '0')
  for (const m of marks) if (isMark(m) && BigInt(m) > best) best = BigInt(m)
  return best.toString()
}

// ═══ 4. ΤΑ ΣΦΑΛΜΑΤΑ ΤΗΣ ΑΑΔΕ ════════════════════════════════════════════════

export interface HttpVerdict {
  code: 'ok' | ErrorCode
  /** Αξίζει νέα προσπάθεια με αναμονή. */
  retry: boolean
  /** Σταματά ολόκληρος ο συγχρονισμός του λογιστή (όχι μόνο ο πελάτης). */
  fatal: boolean
}

/**
 * Τι σημαίνει η απάντηση. Το 200 με κενό σώμα ΔΕΝ είναι «κανένα παραστατικό»:
 * το άδειο αποτέλεσμα της ΑΑΔΕ είναι `<RequestedDoc/>`. Κενό σώμα σημαίνει ότι
 * κάτι κόπηκε στη διαδρομή, οπότε δεν προχωρά ο ΜΑΡΚ και ξαναδοκιμάζεται.
 */
export function classifyHttp(status: number, body: string): HttpVerdict {
  if (status === 200) return String(body ?? '').trim() ? { code: 'ok', retry: false, fatal: false } : { code: 'empty', retry: true, fatal: false }
  if (status === 401) return { code: 'auth', retry: false, fatal: true }
  if (status === 403) return { code: 'forbidden', retry: false, fatal: false }
  if (status === 429) return { code: 'rate', retry: true, fatal: false }
  if (status >= 500 && status <= 599) return { code: 'server', retry: true, fatal: false }
  if (status === 400) return { code: 'bad_request', retry: false, fatal: false }
  return { code: 'http', retry: false, fatal: false }
}

/**
 * Πόση αναμονή πριν την επόμενη προσπάθεια. Τηρεί το Retry-After της ΑΑΔΕ
 * (σε δευτερόλεπτα, ως 60)· αλλιώς 1, 2, 4… δευτερόλεπτα ως 30, με μικρή
 * τυχαία διασπορά ώστε δύο λογιστές να μην ξαναχτυπούν στο ίδιο χιλιοστό.
 */
export function retryDelayMs(attempt: number, retryAfter: string | null, rand = Math.random()): number {
  const jitter = Math.floor(Math.max(0, Math.min(0.999, rand)) * 250)
  if (retryAfter !== null && /^\d{1,6}$/.test(retryAfter.trim())) return Math.min(Number(retryAfter.trim()), 60) * 1000 + jitter
  return Math.min(1000 * 2 ** Math.max(0, attempt), 30_000) + jitter
}

// ═══ 5. Ο ΚΑΝΟΝΑΣ ΤΩΝ 12 ΩΡΩΝ ═══════════════════════════════════════════════
// Ζει στο lib/mydata/autoSync.ts, γιατί τον ρωτά και η οθόνη του λογιστή.
export { shouldAutoSync, AUTO_SYNC_HOURS }

// ═══ 6. ΠΕΡΙΒΑΛΛΟΝ, ΗΜΕΡΟΜΗΝΙΕΣ, ΑΙΤΗΜΑ ═════════════════════════════════════

export const MYDATA_DEV = MYDATA_API_DEV
export const MYDATA_PROD = MYDATA_API_PROD

/**
 * Η βάση των κλήσεων. ΧΩΡΙΣ ρύθμιση: το δοκιμαστικό, ποτέ η παραγωγή. Η
 * παραγωγή θέλει ρητό `MYDATA_ENV=prod`. Ο ψεύτικος διακομιστής των δοκιμών
 * (`MYDATA_ENV=fake`) δέχεται ΜΟΝΟ localhost, ώστε ένα λάθος περιβάλλον να μη
 * στείλει ποτέ κλειδί λογιστή σε ξένη διεύθυνση. Οτιδήποτε άλλο: null.
 */
export function mydataBase(env: string | undefined, fakeUrl: string | undefined): string | null {
  const e = (env ?? '').trim().toLowerCase()
  if (e === '' || e === 'dev') return MYDATA_DEV
  if (e === 'prod') return MYDATA_PROD
  if (e === 'fake') {
    try {
      const u = new URL(String(fakeUrl ?? ''))
      if ((u.protocol === 'http:' || u.protocol === 'https:') && ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname)) {
        return u.origin
      }
    } catch { /* άκυρη διεύθυνση: όχι */ }
  }
  return null
}

/** «2026-01-05» → «05/01/2026», η μορφή που ζητά η ΑΑΔΕ στις dateFrom/dateTo. */
export function aadeDate(iso: string): string {
  if (!isIsoDate(iso)) throw new Error('bad_date')
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
}

/** Η σημερινή ημερομηνία στην Αθήνα, ISO. */
export function athensIso(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Athens', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

/**
 * Από πότε φέρνει ο ΠΡΩΤΟΣ συγχρονισμός: 1 Ιανουαρίου της προηγούμενης
 * χρονιάς, ώρα Αθήνας. Αρκεί για τη δήλωση που τρέχει (κλείνει τον Ιούλιο) και
 * όχι παραπάνω: ελαχιστοποίηση. Οι επόμενοι φέρνουν μόνο ΜΑΡΚ μετά τον τελευταίο.
 */
export function firstWindowStart(now: Date = new Date()): string {
  return `${Number(athensIso(now).slice(0, 4)) - 1}-01-01`
}

const afmOk = (s: string): boolean => {
  if (!/^\d{9}$/.test(s) || /^0+$/.test(s)) return false
  let sum = 0
  for (let i = 0; i < 8; i++) sum += Number(s[i]) * 2 ** (8 - i)
  return (sum % 11) % 10 === Number(s[8])
}

export interface RequestDocsParams {
  mark: string
  entityVatNumber: string
  dateFrom: string
  dateTo: string
  next?: ContinuationToken | null
}

/**
 * Η διεύθυνση της RequestDocs. Ελέγχει ό,τι φεύγει: ΑΦΜ με ψηφίο ελέγχου,
 * ΜΑΡΚ αριθμός, ημερομηνίες ISO. Κανένα αίτημα για ΑΦΜ που δεν είναι ΑΦΜ.
 */
export function requestDocsUrl(base: string, p: RequestDocsParams): string {
  if (!afmOk(p.entityVatNumber)) throw new Error('bad_afm')
  if (!/^\d{1,19}$/.test(p.mark)) throw new Error('bad_mark')
  const q = new URLSearchParams({
    mark: p.mark,
    entityVatNumber: p.entityVatNumber,
    dateFrom: aadeDate(p.dateFrom),
    dateTo: aadeDate(p.dateTo),
  })
  if (p.next) {
    q.set('nextPartitionKey', p.next.partitionKey)
    q.set('nextRowKey', p.next.rowKey)
  }
  return `${base.replace(/\/+$/, '')}/RequestDocs?${q.toString()}`
}

/**
 * Ο έλεγχος του κλειδιού στη «Σύνδεση», ΧΩΡΙΣ ΑΦΜ πελάτη: χωρίς entityVatNumber
 * η RequestDocs ψάχνει για τον ΑΦΜ του ίδιου του χρήστη (§4.2). Με ΜΑΡΚ στο
 * ανώτατο xs:long και ένα μόνο σημερινό εύρος, η σωστή απάντηση είναι άδειο
 * RequestedDoc· το λάθος κλειδί δίνει 401. Κανένα δεδομένο κανενός δεν ζητείται.
 */
export function probeUrl(base: string, todayIso: string): string {
  const d = aadeDate(todayIso)
  const q = new URLSearchParams({ mark: '9223372036854775806', dateFrom: d, dateTo: d })
  return `${base.replace(/\/+$/, '')}/RequestDocs?${q.toString()}`
}

/** Οι δύο κεφαλίδες της §4.1. Το κλειδί δεν περνά από καμία άλλη συνάρτηση. */
export function aadeHeaders(aadeUserId: string, subscriptionKey: string): Record<string, string> {
  return { 'aade-user-id': aadeUserId, 'Ocp-Apim-Subscription-Key': subscriptionKey, Accept: 'application/xml' }
}
