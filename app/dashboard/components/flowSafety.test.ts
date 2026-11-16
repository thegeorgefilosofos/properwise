// ═══════════════════════════════════════════════════════════════════════════
// ΡΟΕΣ ΠΟΥ ΕΧΑΝΑΝ ΔΟΥΛΕΙΑ Ή ΕΒΓΑΖΑΝ ΣΕ ΑΔΙΕΞΟΔΟ
// ─────────────────────────────────────────────────────────────────────────
// Ενας έλεγχος ανά εύρημα του ελέγχου ροών (12.11.2026):
//   4. Η πρόσκληση λογιστή απαντιέται και χωρίς ακίνητο.
//   6. Τα σαρωμένα προσχέδια του Φακέλου επιβιώνουν από αλλαγή καρτέλας ή
//      ακινήτου (συμπεριφορά του καταστήματος + δομή της καρτέλας).
//   7. Η εξαγωγή και η ζώνη διαγραφής λένε ότι τα αρχεία δεν μπαίνουν στο JSON.
//  14. Μετονομασία και διόρθωση δεν καταπίνουν το σφάλμα της βάσης.
//  15. Η επεξεργασία επαναλαμβανόμενου δεν κλείνει το παράθυρο όταν δεν γράφτηκε τίποτα.
//  16. Το παράθυρο αναβάθμισης είναι πραγματικό dialog και το πεδίο φωτογραφιών
//      της πύλης ενοικιαστή φτάνει με πληκτρολόγιο.
//
// Τρέξε: npx tsx app/dashboard/components/flowSafety.test.ts
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createKeptStore, isWorking, anyKeptUnsaved } from './keptDrafts'
import { downloadInTurn } from './downloadInTurn'
import { hardNavigate } from '@/lib/core/navigate'
import { FILES_NOT_IN_EXPORT } from '@/lib/dataExport'

let passed = 0, failed = 0
const fails: string[] = []
const ok = (name: string, cond: boolean) => { if (cond) passed++; else { failed++; fails.push(name) } }

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..', '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

/** Το σώμα μιας συνάρτησης, από το όνομά της ως την επόμενη δήλωση στο ίδιο βάθος. */
const body = (src: string, start: string, end: string): string => {
  const i = src.indexOf(start)
  if (i < 0) return ''
  const j = src.indexOf(end, i + start.length)
  return src.slice(i, j < 0 ? undefined : j)
}

// ── 6. Το κατάστημα των προσχεδίων ──────────────────────────────────────────
{
  type D = { id: string; status: string }
  const store = createKeptStore<D>()
  let heard = 0
  const off = store.subscribe('p1', () => { heard++ })
  store.set('p1', [{ id: 'a', status: 'pending' }])
  ok('6: η εγγραφή ειδοποιεί όποιον ακούει', heard === 1)
  // Η καρτέλα ξεστήνεται: παύει να ακούει. Η σάρωση συνεχίζει και γράφει.
  off()
  store.set('p1', ds => ds.map(d => ({ ...d, status: 'ready' })))
  ok('6: ενημέρωση μετά το ξεστήσιμο δεν χάνεται', store.get('p1')[0]?.status === 'ready')
  ok('6: ο ξεστημένος δεν ειδοποιείται', heard === 1)
  // Αλλο ακίνητο, άλλα προσχέδια.
  ok('6: κάθε ακίνητο κρατά τα δικά του', store.get('p2').length === 0)
  store.set('p2', [{ id: 'b', status: 'ready' }])
  ok('6: το δεύτερο ακίνητο δεν αγγίζει το πρώτο', store.get('p1').length === 1 && store.get('p2')[0].id === 'b')
  // Σταθερή αναφορά όσο δεν αλλάζει τίποτα (useSyncExternalStore).
  ok('6: σταθερό στιγμιότυπο χωρίς αλλαγή', store.get('p1') === store.get('p1'))
  ok('6: σταθερό και το κενό', store.get('zz') === store.get('yy'))
  store.set('p1', [])
  ok('6: το «Απόρριψη» αδειάζει', store.get('p1').length === 0)

  const probe = createKeptStore<D>()
  const unsavedWith = (...st: string[]) => { probe.set('k', st.map((status, i) => ({ id: String(i), status }))); const u = probe.hasUnsaved(); probe.clear(); return u }
  ok('6: έτοιμο προσχέδιο = μη αποθηκευμένο', unsavedWith('ready'))
  ok('6: αποτυχία αποθήκευσης = μη αποθηκευμένο', unsavedWith('error'))
  ok('6: μόνο αποθηκευμένα/αποτυχημένα σαρώσεις = τίποτα να χαθεί', !unsavedWith('saved', 'failed'))
  ok('6: σάρωση σε εξέλιξη = δουλεύει', isWorking([{ status: 'scanning' }]) && isWorking([{ status: 'pending' }]) && isWorking([{ status: 'saving' }]))
  ok('6: έτοιμο ή λάθος δεν κλειδώνει τα κουμπιά', !isWorking([{ status: 'ready' }, { status: 'error' }, { status: 'failed' }]))
  ok('6: τα άδεια σύνολα ακροατών φεύγουν', store.listenedKeys() === 0)
}

// ── 6. Ο ένας φύλακας ανανέωσης και η αποσύνδεση ───────────────────────────
{
  // Ψεύτικο παράθυρο: μετράμε τους ακροατές beforeunload και την πλοήγηση.
  const added: string[] = [], removed: string[] = [], went: string[] = []
  ;(globalThis as unknown as { window: unknown }).window = {
    addEventListener: (t: string) => { added.push(t) },
    removeEventListener: (t: string) => { removed.push(t) },
    location: { assign: (p: string) => { went.push(p) } },
  }
  type D = { id: string; status: string }
  const a = createKeptStore<D>(), b = createKeptStore<D>()
  // Ο φύλακας είναι ενεργός όσο οι προσθήκες ξεπερνούν τις αφαιρέσεις.
  const isGuarding = () => added.length > removed.length
  ok('6: χωρίς προσχέδια, κανένας φύλακας', !isGuarding())
  a.set('u1:p1', [{ id: '1', status: 'ready' }])
  ok('6: ένα μη αποθηκευμένο ανάβει τον φύλακα', isGuarding() && added.length === 1)
  b.set('u1:p2', [{ id: '2', status: 'scanning' }])
  ok('6: ένας ακροατής για όλα τα κλειδιά και καταστήματα', added.length === 1)
  a.set('u1:p1', [{ id: '1', status: 'saved' }])
  ok('6: μένει όσο κάποιο άλλο κλειδί έχει μη αποθηκευμένα', isGuarding() && removed.length === 0)
  // Καθαρισμός τελειωμένων: δεν ειδοποιεί όταν δεν φεύγει τίποτα.
  let heard = 0
  const off = a.subscribe('u1:p1', () => { heard++ })
  a.prune('u1:p1', d => d.status !== 'saved' && d.status !== 'failed')
  ok('6: τα αποθηκευμένα καθαρίζονται', a.get('u1:p1').length === 0 && heard === 1)
  a.prune('u1:p1', () => true)
  ok('6: ο καθαρισμός χωρίς αλλαγή δεν ειδοποιεί', heard === 1)
  off()
  ok('6: η αποσύνδεση ξέρει ότι κάτι θα χαθεί', anyKeptUnsaved())
  // Η σκληρή πλοήγηση (μετά την αποσύνδεση) σβήνει τα πάντα ΠΡΙΝ φύγει.
  hardNavigate('/login')
  ok('6: η σκληρή πλοήγηση σβήνει τα προσχέδια', b.get('u1:p2').length === 0 && !anyKeptUnsaved())
  ok('6: και ρίχνει τον φύλακα πριν από την πλοήγηση', !isGuarding() && removed.length === 1 && went[0] === '/login')
}

// ── 6 και 14. Η δομή της καρτέλας Φακέλου ───────────────────────────────────
{
  const src = read('app/dashboard/components/TabDocuments.tsx')
  ok('6: τα προσχέδια δεν ζουν σε useState της καρτέλας', !/useState<Draft\[\]>/.test(src))
  ok('6: τα προσχέδια διαβάζονται από το κατάστημα', /useSyncExternalStore\(/.test(src) && /draftStore\.set\(draftKey/.test(src))
  // κυριολεκτικό-πρότυπο: ψάχνουμε το κείμενο του κώδικα, όχι την τιμή του.
  ok('6: κλειδί χρήστη και ακινήτου', src.includes('const draftKey = `${userId}:${propertyId}`'))
  ok('6: κανένας φύλακας ανανέωσης μέσα στην καρτέλα (ζει στο κατάστημα)', !/beforeunload/.test(src))
  ok('6: στο άνοιγμα καθαρίζονται μόνο τα αποθηκευμένα', /draftStore\.prune\(draftKey, d => d\.status !== 'saved'\)/.test(src))
  ok('6: τα αποτυχημένα ανοίγουν την κάρτα για να φανούν', /useState\(\(\) => draftStore\.get\(draftKey\)\.some\(d => d\.status !== 'saved'\)\)/.test(src))
  // κυριολεκτικό-πρότυπο: ψάχνουμε το κείμενο του κώδικα.
  ok('B: το μήνυμα λέει «Ξεκίνησε η λήψη»', src.includes('Ξεκίνησε η λήψη ${r.ok} αρχείων'))
  const bulk = body(src, 'const bulkDownload', '/* ──')
  ok('3: η μαζική λήψη δεν ανοίγει παράθυρο ανά αρχείο', bulk.length > 0 && !/window\.open/.test(bulk) && /downloadInTurn\(/.test(bulk))
  ok('6: η σάρωση που πετά δεν μένει «σε εξέλιξη»', /try \{ r = await scanFile\(d\.file\); \} catch/.test(src))

  const upd = body(src, 'const updateDocs', 'const applyRename')
  ok('14: η ενημέρωση εγγράφων περνά από το saved', /saved\(/.test(upd))
  const ren = body(src, 'const applyRename', 'const applyFix')
  ok('14: η μετονομασία κλείνει μόνο μετά από επιτυχία', /if \(await updateDocs\([^;]*\)\) setRenameItem\(null\)/.test(ren))
  const fix = body(src, 'const applyFix', 'const toggleSel')
  ok('14: η διόρθωση μένει ανοιχτή στην αποτυχία', /!await updateDocs\(fixItems, p\)\) return/.test(fix))
}

// ── 1. Η αποσύνδεση ρωτά πριν λήξει η συνεδρία ────────────────────────────
{
  const src = read('app/dashboard/components/shell/useDashboard.ts')
  const so = body(src, 'const signOut = async', 'return {')
  const ask = so.indexOf('anyKeptUnsaved()')
  const end = so.indexOf('endSession(supabase)')
  ok('1: η ερώτηση για τις σαρώσεις έρχεται πριν από το endSession', ask > 0 && end > ask)
  ok('A: κουμπιά «Αποσύνδεση χωρίς καταχώρηση» και «Συνέχεια»', so.includes("confirmLabel: 'Αποσύνδεση χωρίς καταχώρηση', cancelLabel: 'Συνέχεια'"))
  ok('A: η καρτέλα με το όνομα του μενού', so.includes("navLabel('documents')"))
  const nav = read('lib/core/navigate.ts')
  ok('1: η σκληρή πλοήγηση καθαρίζει πριν από το assign', /for \(const fn of beforeLeave\)[\s\S]*window\.location\.assign/.test(nav))
}

// ── 15. Επαναλαμβανόμενο γεγονός ───────────────────────────────────────────
{
  const src = read('app/dashboard/components/TabCalendar.tsx')
  const scope = body(src, 'async function applyEditScope', 'async function toggleStatus')
  ok('15: βρέθηκε η applyEditScope', scope.length > 0)
  ok('15: κανένα σιωπηλό catch{}', !/catch\s*\{\s*\}/.test(scope))
  const guard = scope.indexOf('if(!wrote) return')
  const close = scope.indexOf('setShowModal(false)')
  ok('15: το παράθυρο κλείνει μόνο αφού γραφτεί κάτι', guard > 0 && close > guard)
}

// ── 16α. Το παράθυρο αναβάθμισης ───────────────────────────────────────────
{
  const src = read('app/dashboard/components/UpgradeModal.tsx')
  ok('16α: πάνω στο κοινό Modal', /import \{[^}]*\bModal\b[^}]*\} from '@\/components\/Theme'/.test(src) && /<Modal open/.test(src))
  ok('16α: κανένα χειροποίητο πέπλο', !src.includes('md-scrim'))
  ok('16α: τα κουμπιά κρατούν το μέγεθος lg', (src.match(/<Btn [^>]*size="lg"/g) || []).length === 4)
  ok('16α: το σχόλιο της στοίχισης δεν μιλά για 520', !src.includes('520 πλάτος'))
}

// ── 16β. Πεδίο φωτογραφιών της πύλης ───────────────────────────────────────
{
  const src = read('app/portal/[token]/page.tsx')
  const input = src.match(/<input type="file"[\s\S]*?\/>/)?.[0] ?? ''
  ok('16β: βρέθηκε το πεδίο αρχείου', input.length > 0)
  ok('16β: δεν είναι display:none', !/display:\s*'none'/.test(input))
  ok('16β: κρύβεται μόνο οπτικά', /className="sr-only"/.test(input))
  const css = read('app/globals.css')
  ok('16β: εναλλακτικό :focus-within μόνο για περιηγητές χωρίς :has', /@supports not selector\(:has\(\*\)\) \{\s*\.po-file-pick:focus-within/.test(css))
}

// ── 4. Πρόσκληση λογιστή χωρίς ακίνητο ─────────────────────────────────────
{
  ok('4: τα αιτήματα έχουν δικό τους αρχείο', existsSync(join(HERE, 'AccountantInvites.tsx')))
  const page = read('app/dashboard/page.tsx')
  // Ο κλάδος «κανένα ακίνητο» ξεκινά στο «Ξεκίνα από ένα ακίνητο» και τελειώνει
  // πριν από το δίχτυ των καρτελών.
  const empty = body(page, 'Ξεκίνα από ένα ακίνητο', '<TabBoundary')
  ok('4: η πρώτη οθόνη δείχνει τα αιτήματα', /<AccountantInvites userId=\{user\.id\}/.test(empty))
  const dossier = read('app/dashboard/components/AccountantDossier.tsx')
  ok('4: η Λογιστική τα δείχνει ακόμη', /<AccountantInvites userId=\{userId\}/.test(dossier) && /from '\.\/AccountantInvites'/.test(dossier))
}

// ── 7. Τα αρχεία δεν μπαίνουν στην εξαγωγή και λέγεται ──────────────────────
{
  ok('7: η πρόταση λέει ότι τα αρχεία δεν περιλαμβάνονται', FILES_NOT_IN_EXPORT.includes('όχι τα ίδια τα αρχεία'))
  ok('7: και πώς κατεβαίνουν', FILES_NOT_IN_EXPORT.includes('«Λήψη»'))
  ok('7: «από την καρτέλα «…»»', FILES_NOT_IN_EXPORT.includes('από την καρτέλα «Φάκελος ακινήτου»'))
  ok('7: το μισθωτήριο με το πραγματικό κουμπί', FILES_NOT_IN_EXPORT.includes('«Άνοιγμα PDF»') && read('app/dashboard/components/TabTenant.tsx').includes('>Άνοιγμα PDF<'))
  const src = read('app/dashboard/components/TabSettings.tsx')
  ok('7: χρησιμοποιείται σε δύο θέσεις (εξαγωγή και διαγραφή)', (src.match(/\$\{FILES_NOT_IN_EXPORT\}/g) || []).length === 2)
  ok('7: η διαγραφή δεν λέει πια ότι η εξαγωγή αρκεί', !src.includes('προηγείται η εξαγωγή δεδομένων'))
}

// ── 3. Μαζική λήψη ένα ένα ─────────────────────────────────────────────────
const inTurn = async () => {
  const order: string[] = []
  const saved: string[] = []
  const r = await downloadInTurn([
    { url: 'u1', name: 'a.pdf' }, { url: 'u2', name: 'b.pdf' }, { url: 'u3', name: 'c.pdf' }, { url: 'u4', name: 'd.pdf' },
  ], {
    fetch: async (u) => {
      order.push(u)
      if (u === 'u3') throw new Error('δίκτυο')
      return { ok: u !== 'u2', blob: async () => new Blob([u]) }
    },
    save: (_b, n) => { saved.push(n); return true },
    wait: async () => { order.push('wait') },
  })
  ok('3: ένα ένα, με παύση ανάμεσα', order.join(',') === 'u1,wait,u2,wait,u3,wait,u4')
  ok('3: όσα κατέβηκαν αποθηκεύτηκαν με το όνομά τους', saved.join(',') === 'a.pdf,d.pdf' && r.ok === 2)
  ok('3: αποτυχία ή σφάλμα δικτύου μετριούνται με όνομα', r.failed.join(',') === 'b.pdf,c.pdf')

  // E: ο σύνδεσμος που έληξε υπογράφεται ξανά, μία φορά.
  const tried: string[] = []
  let resigned = 0
  const r2 = await downloadInTurn([
    { url: 'old', name: 'x.pdf', resign: async () => { resigned++; return 'new' } },
    { url: 'dead', name: 'y.pdf', resign: async () => { resigned++; return 'dead2' } },
  ], {
    fetch: async (u) => { tried.push(u); return { ok: u === 'new', blob: async () => new Blob([u]) } },
    save: () => true,
    wait: async () => {},
  })
  ok('E: ο ληγμένος σύνδεσμος ξαναϋπογράφεται και κατεβαίνει', r2.ok === 1 && tried.join(',') === 'old,new,dead,dead2')
  ok('E: μία νέα υπογραφή ανά αρχείο, όχι βρόχος', resigned === 2 && r2.failed.join(',') === 'y.pdf')
}

inTurn().then(() => {
  console.log(`flowSafety: ${passed} ✓ · ${failed} ✗`)
  if (failed) { for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
})
