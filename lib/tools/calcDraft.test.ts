// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΠΡΟΧΕΙΡΟ ΤΟΥ ΥΠΟΛΟΓΙΣΤΗ: ΣΧΗΜΑ, ΛΗΞΗ, ΜΙΑ ΑΝΑΓΝΩΣΗ
// ─────────────────────────────────────────────────────────────────────────
// Τρέξε: npx tsx lib/tools/calcDraft.test.ts
// ═══════════════════════════════════════════════════════════════════════════
import {
  encodeCalcDraft, decodeCalcDraft, saveCalcDraft, takeCalcDraft, clearCalcDraft, changedValues,
  CALC_DRAFT_TTL_MS, CALC_DRAFT_STORAGE,
} from './calcDraft'
import { SPEC as ENFIA } from './enfiaSpec'
import { SPEC as RENT } from './rentSpec'

let passed = 0, failed = 0
const fails: string[] = []
const ok = (name: string, cond: boolean) => { if (cond) passed++; else { failed++; fails.push(name) } }

const NOW = Date.UTC(2026, 10, 13, 10, 0, 0)
const HOUR = 60 * 60 * 1000

// ── ΚΩΔΙΚΟΠΟΙΗΣΗ ΚΑΙ ΑΝΑΓΝΩΣΗ ────────────────────────────────────────────────
{
  const raw = encodeCalcDraft('enfia', { tm: '120', zoni: '2100' }, NOW)
  const d = decodeCalcDraft(raw, NOW + HOUR)
  ok('πάει κι έρχεται ακέραιο', !!d && d.tool === 'enfia' && d.values.tm === '120' && d.values.zoni === '2100' && d.at === NOW)
  ok('ζητημένο εργαλείο ταιριάζει', decodeCalcDraft(raw, NOW, 'enfia') !== null)
  ok('άλλο εργαλείο → τίποτα', decodeCalcDraft(raw, NOW, 'rent') === null)

  const foreign = encodeCalcDraft('enfia', { tm: '90', next: '//kako.gr', email: 'a@b.gr' } as Record<string, string>, NOW)
  const f = decodeCalcDraft(foreign, NOW)
  ok('ξένα κλειδιά δεν γράφονται', !!f && Object.keys(f.values).join() === 'tm')
  ok('κλειδί άλλου εργαλείου δεν γράφεται', !Object.keys(decodeCalcDraft(encodeCalcDraft('rent', { tm: '90', enoikio: '700' }, NOW), NOW)?.values ?? {}).includes('tm'))
  ok('υπερβολικά μακριά τιμή → τίποτα', encodeCalcDraft('enfia', { tm: '9'.repeat(200) }, NOW) === null)
}

// ── ΛΗΞΗ ──────────────────────────────────────────────────────────────────────
{
  const raw = encodeCalcDraft('rent', { enoikio: '750' }, NOW)
  ok('μέσα στη διάρκεια ζωής', decodeCalcDraft(raw, NOW + CALC_DRAFT_TTL_MS - 1) !== null)
  ok('ληγμένο → τίποτα', decodeCalcDraft(raw, NOW + CALC_DRAFT_TTL_MS + 1) === null)
  ok('από το μέλλον (πειραγμένο) → τίποτα', decodeCalcDraft(raw, NOW - 2 * HOUR) === null)
  ok('ρολόι λίγο πίσω δεν το ακυρώνει', decodeCalcDraft(raw, NOW - 60 * 1000) !== null)
  ok('η διάρκεια ζωής είναι μία ημέρα', CALC_DRAFT_TTL_MS === 24 * HOUR)
}

// ── ΧΑΛΑΣΜΕΝΑ ΚΑΙ ΠΕΙΡΑΓΜΕΝΑ ─────────────────────────────────────────────────
{
  for (const [name, raw] of [
    ['κενό', ''], ['όχι JSON', '{nope'], ['πίνακας', '[1,2]'], ['null', 'null'],
    ['άλλη έκδοση', JSON.stringify({ v: 2, tool: 'enfia', values: { tm: '1' }, at: NOW })],
    ['άγνωστο εργαλείο', JSON.stringify({ v: 1, tool: 'loan', values: {}, at: NOW })],
    ['χρόνος κείμενο', JSON.stringify({ v: 1, tool: 'enfia', values: { tm: '1' }, at: String(NOW) })],
    ['τιμές πίνακας', JSON.stringify({ v: 1, tool: 'enfia', values: ['1'], at: NOW })],
    ['τιμή αριθμός', JSON.stringify({ v: 1, tool: 'enfia', values: { tm: 120 }, at: NOW })],
    ['__proto__', `{"v":1,"tool":"enfia","values":{"__proto__":{"tm":"1"}},"at":${NOW}}`],
  ] as const) ok(`χαλασμένο (${name}) → τίποτα ή καθαρό`, (() => {
    const d = decodeCalcDraft(raw, NOW)
    return d === null || Object.keys(d.values).length === 0
  })())
}

// ── ΜΟΝΟ ΟΣΑ ΑΛΛΑΞΑΝ ──────────────────────────────────────────────────────────
{
  ok('οι προεπιλογές δεν γράφονται', Object.keys(changedValues('enfia', ENFIA)).length === 0)
  const c = changedValues('enfia', { ...ENFIA, tm: '120' })
  ok('γράφεται μόνο το αλλαγμένο', Object.keys(c).join() === 'tm' && c.tm === '120')
  ok('ενοίκια: μόνο το αλλαγμένο', JSON.stringify(changedValues('rent', { ...RENT, enoikio: '750' })) === '{"enoikio":"750"}')
}

// ── Η ΣΥΣΚΕΥΗ: ΓΡΑΦΕΤΑΙ, ΔΙΑΒΑΖΕΤΑΙ ΜΙΑ ΦΟΡΑ ──────────────────────────────────
{
  const mem = new Map<string, string>()
  const fake = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => { mem.set(k, v) },
    removeItem: (k: string) => { mem.delete(k) },
  }
  ;(globalThis as { window?: unknown }).window = { localStorage: fake }

  ok('γράφεται', saveCalcDraft('enfia', { ...ENFIA, tm: '120', zoni: '2100' }, NOW))
  ok('…μόνο τα αλλαγμένα', JSON.parse(mem.get(CALC_DRAFT_STORAGE)!).values.orofos === undefined)
  ok('πρόχειρο άλλου εργαλείου δεν δίνεται', takeCalcDraft('rent', NOW) === null)
  ok('…και δεν σβήνεται', mem.has(CALC_DRAFT_STORAGE))
  const d = takeCalcDraft('enfia', NOW + HOUR)
  ok('δίνεται στο εργαλείο του', !!d && d.values.tm === '120')
  ok('…και σβήνεται: δεύτερη ανάγνωση κενή', !mem.has(CALC_DRAFT_STORAGE) && takeCalcDraft('enfia', NOW) === null)

  saveCalcDraft('rent', { ...RENT, enoikio: '800' }, NOW)
  ok('ληγμένο δεν δίνεται', takeCalcDraft('rent', NOW + CALC_DRAFT_TTL_MS + 1) === null)
  ok('…και σβήνεται', !mem.has(CALC_DRAFT_STORAGE))

  saveCalcDraft('rent', { ...RENT, enoikio: '800' }, NOW)
  clearCalcDraft()
  ok('το σβήσιμο σβήνει', !mem.has(CALC_DRAFT_STORAGE))

  // ΙΔΙΩΤΙΚΟ ΠΑΡΑΘΥΡΟ: η αποθήκευση πετά. Τίποτα δεν σπάει, απλώς δεν υπάρχει πρόχειρο.
  ;(globalThis as { window?: unknown }).window = {
    localStorage: { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') }, removeItem: () => { throw new Error('blocked') } },
  }
  ok('μπλοκαρισμένη αποθήκευση: η εγγραφή απαντά όχι', saveCalcDraft('enfia', { ...ENFIA, tm: '1' }, NOW) === false)
  ok('…και η ανάγνωση κενή, χωρίς εξαίρεση', takeCalcDraft('enfia', NOW) === null)
  delete (globalThis as { window?: unknown }).window
  ok('χωρίς περιηγητή: τίποτα', saveCalcDraft('enfia', { tm: '1' }, NOW) === false && takeCalcDraft('enfia', NOW) === null)
}

console.log(`lib/tools/calcDraft.test.ts: ${passed} passed, ${failed} failed`)
if (failed) { for (const f of fails) console.log('  ✗ ' + f); process.exit(1) }
