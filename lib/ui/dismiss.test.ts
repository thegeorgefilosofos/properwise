// npx tsx lib/ui/dismiss.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// ΕΝΑ ΠΑΡΑΘΥΡΟ ΔΕΝ ΧΑΝΕΙ Ο,ΤΙ ΓΡΑΦΤΗΚΕ ΜΕΣΑ ΤΟΥ (έλεγχος 19/10/2026, #5)
// ─────────────────────────────────────────────────────────────────────────
// Α. Το φόντο: το σύρσιμο επιλογής κειμένου από πεδίο προς το φόντο δεν κλείνει.
// Β. Το πρόχειρο: γράφεται και διαβάζεται· ένας κλειδωμένος χώρος δεν σπάει τίποτα.
// Γ. Οι οθόνες: ο οδηγός και η σάρωση περνούν από το ίδιο «Να φύγουν οι αλλαγές;».
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import {
  backdropDismiss, readDraft, writeDraft, clearDraft, sameDraft, restoreDraft, draftKey, DRAFT_PREFIX,
  type DraftStore,
} from './dismiss'
import { PERSONAL_KEY_PREFIXES } from '../localPrivacy'

let passed = 0, failed = 0
function ok(name: string, cond: boolean) { if (cond) { passed++ } else { failed++; console.log('  ✗ ' + name) } }

// ═══ Α. ΤΟ ΦΟΝΤΟ ════════════════════════════════════════════════════════════
{
  const backdrop = { id: 'φόντο' }
  const field = { id: 'πεδίο «Όνομα»' }
  const on = (target: object) => ({ target, currentTarget: backdrop })

  // Η αναπαραγωγή του ελέγχου: πάτημα στο πεδίο, σύρσιμο, άφημα στο φόντο. Ο
  // περιηγητής στέλνει το click στον κοινό πρόγονο, δηλαδή στο φόντο.
  const g = backdropDismiss()
  g.down(on(field))
  ok('Α. σύρσιμο από πεδίο προς το φόντο: δεν κλείνει', g.click(on(backdrop)) === false)

  const g2 = backdropDismiss()
  g2.down(on(backdrop))
  ok('Α. πάτημα και άφημα στο φόντο: κλείνει', g2.click(on(backdrop)) === true)

  const g3 = backdropDismiss()
  g3.down(on(backdrop))
  ok('Α. πάτημα στο φόντο, click μέσα στο πλαίσιο: δεν κλείνει', g3.click(on(field)) === false)

  // Η μνήμη σβήνει μετά από κάθε click: ένα παλιό πάτημα στο φόντο δεν μετρά
  // σε επόμενο click που ήρθε χωρίς δικό του pointerdown.
  const g4 = backdropDismiss()
  g4.down(on(backdrop)); g4.click(on(field))
  ok('Α. click χωρίς νέο pointerdown: δεν κλείνει', g4.click(on(backdrop)) === false)

  const g5 = backdropDismiss()
  ok('Α. click χωρίς κανένα pointerdown: δεν κλείνει', g5.click(on(backdrop)) === false)
}

// ═══ Β. ΤΟ ΠΡΟΧΕΙΡΟ ═════════════════════════════════════════════════════════
class MemStore implements DraftStore {
  m = new Map<string, string>()
  getItem(k: string) { return this.m.get(k) ?? null }
  setItem(k: string, v: string) { this.m.set(k, v) }
  removeItem(k: string) { this.m.delete(k) }
}
const locked: DraftStore = {
  getItem() { throw new Error('SecurityError') },
  setItem() { throw new Error('QuotaExceededError') },
  removeItem() { throw new Error('SecurityError') },
}
{
  const st = new MemStore()
  const key = draftKey('property_wizard', 'u1')
  ok('Β. το κλειδί έχει το πρόθεμα που σβήνει η αποσύνδεση',
    key.startsWith(DRAFT_PREFIX) && (PERSONAL_KEY_PREFIXES as readonly string[]).includes(DRAFT_PREFIX))
  ok('Β. το κλειδί είναι ανά χρήστη', key !== draftKey('property_wizard', 'u2'))

  ok('Β. γράφεται', writeDraft(key, { name: 'Σπίτι Κυψέλη', step: 2 }, st) === true)
  const back = readDraft<{ name: string; step: number }>(key, st)
  ok('Β. διαβάζεται ίδιο', back?.name === 'Σπίτι Κυψέλη' && back.step === 2)
  clearDraft(key, st)
  ok('Β. σβήνει', readDraft(key, st) === null)

  st.setItem(key, '{χαλασμένο')
  ok('Β. χαλασμένο JSON: κανένα πρόχειρο', readDraft(key, st) === null)
  st.setItem(key, JSON.stringify({ v: 99, data: { name: 'x' } }))
  ok('Β. άλλη μορφή: αγνοείται', readDraft(key, st) === null)
  st.setItem(key, JSON.stringify({ v: 1, data: ['x'] }))
  ok('Β. πίνακας αντί για αντικείμενο: αγνοείται', readDraft(key, st) === null)

  let threw = false
  try {
    ok('Β. κλειδωμένος χώρος: η ανάγνωση δίνει null', readDraft(key, locked) === null)
    ok('Β. κλειδωμένος χώρος: η εγγραφή δίνει false', writeDraft(key, { a: 1 }, locked) === false)
    clearDraft(key, locked)
    ok('Β. χωρίς χώρο: null', readDraft(key, null) === null && writeDraft(key, {}, null) === false)
  } catch { threw = true }
  ok('Β. κλειδωμένος χώρος δεν πετά ποτέ', !threw)
}

// ── «Υπάρχουν αλλαγές;» και η επαναφορά με έλεγχο τύπου ─────────────────────
{
  ok('Β. ίδιο περιεχόμενο με άλλη σειρά κλειδιών: καμία αλλαγή',
    sameDraft({ a: '1', b: { x: '', y: '2' } }, { b: { y: '2', x: '' }, a: '1' }))
  ok('Β. ένα γράμμα αλλάζει: αλλαγή', !sameDraft({ name: 'Σπίτι' }, { name: 'Σπίτ' }))
  ok('Β. συνιδιοκτήτης προστέθηκε: αλλαγή', !sameDraft({ c: [''] }, { c: ['', ''] }))

  const base = { name: '', statusKey: null as string | null, coOwners: [''], settings: { owner_afm: '', notes: '' } }
  const r = restoreDraft(base, { name: 42, statusKey: 'rent_long', coOwners: ['Α', 7], settings: { owner_afm: '123456789', notes: 5, extra: 'x' }, other: 'y' } as never)
  ok('Β. αριθμός αντί για κείμενο: μένει η προεπιλογή', r.name === '')
  ok('Β. κατάσταση ως κείμενο: περνά', r.statusKey === 'rent_long')
  ok('Β. λίστα με μη κείμενο: μένει η προεπιλογή', r.coOwners.length === 1 && r.coOwners[0] === '')
  ok('Β. εμφωλευμένο: περνά μόνο ό,τι έχει σωστό τύπο', r.settings.owner_afm === '123456789' && r.settings.notes === '')
  ok('Β. άγνωστα κλειδιά δεν μπαίνουν', !('extra' in r.settings) && !('other' in r))
  ok('Β. χωρίς πρόχειρο: η βάση', restoreDraft(base, null) === base)
}

// ═══ Γ. ΟΙ ΟΘΟΝΕΣ ════════════════════════════════════════════════════════════
// Η συμπεριφορά ζει στις συναρτήσεις από πάνω. Εδώ ελέγχεται ότι οι οθόνες
// τις καλούν και ότι κανένα κοινό φόντο δεν ξαναγύρισε στο `onClick={onClose}`.
{
  const theme = readFileSync('components/Theme.tsx', 'utf8')
  ok('Γ. κανένα φόντο του Modal ή του SideSheet δεν κλείνει με σκέτο onClick',
    !/<div onClick=\{onClose\} role="dialog"/.test(theme))
  ok('Γ. το κέλυφος χρησιμοποιεί τον φύλακα του φόντου',
    /useState\(backdropDismiss\)/.test(theme) && (theme.match(/\{\.\.\.backdrop\} role="dialog"/g) ?? []).length === 2)

  const wiz = readFileSync('app/dashboard/components/AddPropertyWizard.tsx', 'utf8')
  const close = wiz.slice(wiz.indexOf('const requestClose = async'), wiz.indexOf('const requestClose = async') + 400)
  ok('Γ. ο οδηγός ρωτά πριν κλείσει με αλλαγές', /if \(dirty && !\(await confirmDiscard\(\)\)\) return;/.test(close))
  ok('Γ. ο οδηγός περνά το ίδιο κλείσιμο στο Modal', /<Modal open onClose=\{requestClose\}/.test(wiz))
  ok('Γ. το πρόχειρο σβήνει με την αποθήκευση', /clearDraft\(formKey\);\s*onSaved\(propertyId\)/.test(wiz))

  const dash = readFileSync('app/dashboard/components/shell/useDashboard.ts', 'utf8')
  const page = readFileSync('app/dashboard/page.tsx', 'utf8')
  ok('Γ. η σάρωση στο βήμα ελέγχου ρωτά πριν κλείσει', /scanDirty && !\(await confirmDiscard\(/.test(dash))
  ok('Γ. το παράθυρο της σάρωσης κλείνει μόνο από εκεί', /onClose=\{requestCloseQuickAdd\}/.test(page) && /onDirtyChange=\{setScanDirty\}/.test(page))
}

console.log(failed === 0 ? `✓ dismiss: ${passed} έλεγχοι πέρασαν` : `✗ dismiss: ${failed} απέτυχαν από ${passed + failed}`)
if (failed > 0) process.exit(1)
