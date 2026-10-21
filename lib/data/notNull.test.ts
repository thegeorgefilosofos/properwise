// Τεστ: κανένα null σε στήλη NOT NULL από το στρώμα δεδομένων.
// Τρέξε: npx tsx lib/data/notNull.test.ts
//
// ΤΙ ΚΛΕΙΔΩΝΕΙ ΕΔΩ. Το PostgREST στέλνει το ρητό null όπως είναι και δεν βάζει
// την προεπιλογή της στήλης. Δύο φορές σε έναν μήνα αυτό έκοψε ολόκληρη
// λειτουργία: κάθε εισαγωγή στο ημερολόγιο (#423) και κάθε ακίνητο χωρίς
// εμβαδόν (PROPERWISE-9). Το τεστ ρωτά ΤΗ ΒΑΣΗ, όχι τη μνήμη μας:
//
//   1. Διαβάζει από τα migrations κάθε στήλη NOT NULL με σταθερή προεπιλογή
//      στους πίνακες του lib/data/notNull.ts και απαιτεί να είναι εκεί, με
//      την ΙΔΙΑ τιμή. Νέα τέτοια στήλη σπάει εδώ, όχι στην οθόνη κάποιου.
//   2. Δίνει σε κάθε συνάρτηση εγγραφής του στρώματος γραμμές με null σε κάθε
//      τέτοια στήλη και ελέγχει τι φτάνει στον πελάτη: τίποτα null, τίποτα
//      undefined (στο μαζικό insert το undefined γίνεται κι αυτό null).
import { readSchema } from '../../scripts/lib/pg-schema.mjs'
import { NOT_NULL_DEFAULTS, type DefaultedTable } from './notNull'
import * as properties from './properties'
import * as calendar from './calendar'
import * as settings from './settings'
import * as stays from './stays'
import * as documents from './documents'
import * as e2 from './e2Prefilled'

let passed = 0, failed = 0
const fails: string[] = []
const ok = (name: string, cond: boolean) => { if (cond) passed++; else { failed++; if (fails.length < 80) fails.push(name) } }

type Col = { sql: string; notNull: boolean; rejectsNull: boolean; default: string | null }
const schema = readSchema() as Map<string, Map<string, Col>>

// ── Η προεπιλογή της βάσης ως τιμή JSON ────────────────────────────────────
// Μόνο σταθερές: `now()`, `gen_random_uuid()`, `auth.uid()` δεν είναι τιμές
// που γράφει ο πελάτης και μένουν έξω.
function literal(col: Col): { ok: true; value: unknown } | { ok: false } {
  const raw = (col.default ?? '').replace(/::[\w" \[\]]+$/g, '').trim()
  if (!raw || raw.includes('(')) return { ok: false }
  if (/^-?\d+(\.\d+)?$/.test(raw)) return { ok: true, value: Number(raw) }
  if (/^(true|false)$/i.test(raw)) return { ok: true, value: raw.toLowerCase() === 'true' }
  const q = /^'([\s\S]*)'$/.exec(raw)
  if (!q) return { ok: false }
  const text = q[1].replace(/''/g, "'")
  if (/^jsonb?$/i.test(col.sql)) return { ok: true, value: JSON.parse(text) }
  if (/\[\]$/.test(col.sql)) return { ok: true, value: text === '{}' ? [] : text }
  return { ok: true, value: text }
}

const tables = Object.keys(NOT_NULL_DEFAULTS) as DefaultedTable[]
const rejectsNull = (t: string) => [...(schema.get(t) ?? new Map<string, Col>())].filter(([, c]) => c.rejectsNull).map(([k]) => k)

// ── 1. Ο ΧΑΡΤΗΣ ΣΥΜΦΩΝΕΙ ΜΕ ΤΑ MIGRATIONS ──────────────────────────────────
ok('το σχήμα διαβάζεται (user_properties.sqm NOT NULL)', schema.get('user_properties')?.get('sqm')?.rejectsNull === true)
ok('οι στήλες του add column μετρούν (client_stays.amount_basis NOT NULL)', schema.get('client_stays')?.get('amount_basis')?.rejectsNull === true)
for (const t of tables) {
  const cols = schema.get(t)
  ok(`${t}: ο πίνακας υπάρχει στα migrations`, !!cols)
  if (!cols) continue
  const mine = NOT_NULL_DEFAULTS[t] as Record<string, unknown>
  for (const [name, col] of cols) {
    if (!col.rejectsNull) continue
    const lit = literal(col)
    if (!lit.ok) continue
    ok(`${t}.${name}: NOT NULL με προεπιλογή ${col.default}, λείπει από το NOT_NULL_DEFAULTS`, name in mine)
    if (name in mine) ok(`${t}.${name}: ίδια προεπιλογή με τη βάση (${col.default})`, JSON.stringify(mine[name]) === JSON.stringify(lit.value))
  }
  for (const name of Object.keys(mine)) ok(`${t}.${name}: στο NOT_NULL_DEFAULTS αλλά όχι NOT NULL στη βάση`, cols.get(name)?.rejectsNull === true)
}

// ── Ψεύτικος πελάτης: κρατά ό,τι θα έφευγε προς το PostgREST ───────────────
interface Sent { table: string; op: string; payload: unknown }
function fakeDb() {
  const sent: Sent[] = []
  const builder = (data: unknown = null): Record<string, unknown> => {
    const b: Record<string, unknown> = { then: (res: (v: unknown) => unknown) => Promise.resolve({ data, error: null }).then(res) }
    for (const f of ['eq', 'in', 'like', 'gt', 'gte', 'lte', 'order', 'limit', 'select', 'maybeSingle', 'single']) b[f] = () => b
    return b
  }
  const db = {
    from: (table: string) => ({
      select: () => builder([]),
      insert: (payload: unknown) => { sent.push({ table, op: 'insert', payload }); return builder({ id: 'x' }) },
      update: (payload: unknown) => { sent.push({ table, op: 'update', payload }); return builder() },
      upsert: (payload: unknown) => { sent.push({ table, op: 'upsert', payload }); return builder() },
      delete: () => builder(),
    }),
    storage: { from: () => ({ upload: async () => ({ data: {}, error: null }) }) },
  }
  return { db: db as never, sent }
}

/** Ό,τι στάλθηκε για τον πίνακα, ως γραμμές. Το JSON του αιτήματος, όχι το αντικείμενο: έτσι το βλέπει η βάση. */
const rowsOf = (sent: Sent[], table: string) =>
  sent.filter(s => s.table === table).flatMap(s => (Array.isArray(s.payload) ? s.payload : [s.payload]) as Record<string, unknown>[])

/**
 * Κανένα null και κανένα undefined σε στήλη NOT NULL. Για μία γραμμή το JSON
 * πετά το undefined (μένει η προεπιλογή)· σε πίνακα γραμμών το `columns=` του
 * supabase-js το κάνει null, οπότε εκεί μετρά και το «λείπει από μία γραμμή».
 */
function noNull(label: string, table: string, sent: Sent[]) {
  const req = sent.filter(s => s.table === table)
  ok(`${label}: έφτασε αίτημα`, req.length > 0)
  for (const s of req) {
    const many = Array.isArray(s.payload)
    const rows = (many ? s.payload : [s.payload]) as Record<string, unknown>[]
    const keys = new Set(rows.flatMap(r => Object.keys(r)))
    for (const c of rejectsNull(table)) {
      if (!keys.has(c)) continue
      for (const r of rows) {
        const v = r[c]
        if (many) ok(`${label}: ${c} δεν φτάνει null (μαζικό)`, v !== null && v !== undefined)
        else ok(`${label}: ${c} δεν φτάνει null`, v !== null)
      }
    }
  }
}

/** Γραμμή με null σε κάθε στήλη του χάρτη. */
const nulls = (t: DefaultedTable) => Object.fromEntries(Object.keys(NOT_NULL_DEFAULTS[t]).map(k => [k, null]))

async function main() {
  // ── 2α. user_properties: PROPERWISE-9 ──────────────────────────────────────
  {
    const { db, sent } = fakeDb()
    // Ο οδηγός: κενό εμβαδόν → `num('')` → null.
    await properties.add(db, { user_id: 'u1', name: 'Σπίτι', prop_type: 'apartment', sqm: null, ownership: 100 })
    noNull('properties.add (κενό εμβαδόν του οδηγού)', 'user_properties', sent)
    ok('properties.add: κενό εμβαδόν γράφεται 0, όπως η προεπιλογή', rowsOf(sent, 'user_properties')[0]?.sqm === 0)
    ok('properties.add: ο τύπος του χρήστη μένει', rowsOf(sent, 'user_properties')[0]?.prop_type === 'apartment')
  }
  {
    const { db, sent } = fakeDb()
    await properties.add(db, { user_id: 'u1', name: 'Σπίτι', ...nulls('user_properties') })
    noNull('properties.add (όλα null)', 'user_properties', sent)
  }
  {
    const { db, sent } = fakeDb()
    await properties.update(db, 'p1', { ...nulls('user_properties'), address: null }, 'u1')
    noNull('properties.update (σβήσιμο εμβαδού)', 'user_properties', sent)
    const r = rowsOf(sent, 'user_properties')[0]
    ok('properties.update: σβησμένο εμβαδόν γράφεται 0', r?.sqm === 0)
    ok('properties.update: nullable στήλη σβήνεται κανονικά', r?.address === null)
  }
  {
    const { db, sent } = fakeDb()
    await properties.update(db, 'p1', { sqm: undefined, name: 'Νέο' }, 'u1')
    ok('properties.update: undefined δεν γίνεται 0 (η στήλη μένει όπως ήταν)', rowsOf(sent, 'user_properties')[0]?.sqm === undefined)
  }

  // ── 2β. calendar_events ────────────────────────────────────────────────────
  const scope = { propertyId: 'p1', userId: 'u1' }
  const draft = { title: 'Δόση', category: 'financial', event_date: '2026-09-01' } as calendar.EventDraft
  {
    const { db, sent } = fakeDb()
    await calendar.add(db, scope, 'x', { ...draft, category: null as never, recurrence_exdates: null })
    noNull('calendar.add (κατηγορία null)', 'calendar_events', sent)
  }
  {
    const { db, sent } = fakeDb()
    const withNull = { ...calendar.row(scope, 'x', draft), ...nulls('calendar_events') } as calendar.EventRow
    const without = calendar.row(scope, 'x', draft) as Record<string, unknown>
    delete without.recurrence_exdates
    await calendar.insert(db, [withNull, without as calendar.EventRow])
    noNull('calendar.insert (μαζικό, κλειδί που λείπει από μία γραμμή)', 'calendar_events', sent)
  }
  {
    const { db, sent } = fakeDb()
    await calendar.insertOnce(db, [{ ...calendar.row(scope, 'x', draft), ...nulls('calendar_events') } as calendar.EventRow])
    noNull('calendar.insertOnce', 'calendar_events', sent)
  }
  {
    const { db, sent } = fakeDb()
    const patch = nulls('calendar_events') as never
    await calendar.update(db, 'e1', patch)
    await calendar.updateMany(db, ['e1', 'e2'], patch)
    await calendar.updateByBill(db, 'b1', patch)
    noNull('calendar.update/updateMany/updateByBill', 'calendar_events', sent)
  }
  // Η διόρθωση από τη φόρμα δεν σβήνει τις εξαιρέσεις της σειράς.
  {
    const edit = typeof calendar.editPatch === 'function' ? calendar.editPatch(calendar.row(scope, 'x', draft)) : null
    ok('calendar.editPatch: χωρίς recurrence_exdates', !!edit && !('recurrence_exdates' in edit))
    ok('calendar.editPatch: κρατά τα υπόλοιπα', edit?.title === 'Δόση')
  }

  // ── 2γ. bills_settings ─────────────────────────────────────────────────────
  {
    const { db, sent } = fakeDb()
    await settings.put(db, 'p1', 'u1', 'common', null as never)
    noNull('settings.put (data null)', 'bills_settings', sent)
  }

  // ── 2δ. client_stays ───────────────────────────────────────────────────────
  {
    const { db, sent } = fakeDb()
    await stays.add(db, [{ user_id: 'u1', client_id: 'c1', amount_basis: null }, { user_id: 'u1', client_id: 'c1' }])
    await stays.addBatched(db, [{ user_id: 'u1', client_id: 'c1', amount_basis: 'gross' }, { user_id: 'u1', client_id: 'c1', amount_basis: undefined }])
    await stays.update(db, 's1', { amount_basis: null })
    noNull('stays.add/addBatched/update', 'client_stays', sent)
  }

  // ── 2ε. property_documents ─────────────────────────────────────────────────
  {
    const { db, sent } = fakeDb()
    await documents.add(db, 'p1', 'u1', { file_path: 'a/b.pdf', ...nulls('property_documents') })
    await documents.update(db, ['d1'], nulls('property_documents'))
    noNull('documents.add/update', 'property_documents', sent)
  }

  // ── 2στ. accountant_packs ──────────────────────────────────────────────────
  {
    const { db, sent } = fakeDb()
    await e2.savePackStatus(db, 'u1', 2026, '123456789', { aadeDifferences: null })
    await e2.sharePack(db, 'u1', 2026, '123456789', new Uint8Array(1), { aadeDifferences: null, missingCount: null as never, missingTop: null as never })
    noNull('e2Prefilled.savePackStatus/sharePack', 'accountant_packs', sent)
  }
}

main().then(() => {
  console.log(`\ndata/notNull — ${passed} passed, ${failed} failed (σύνολο ${passed + failed})`)
  if (failed) { console.log('FAILED:\n' + fails.map(f => '  ✗ ' + f).join('\n')); process.exit(1) }
  console.log('όλα πέρασαν')
})
