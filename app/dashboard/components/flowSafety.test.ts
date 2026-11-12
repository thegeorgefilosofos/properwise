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
import { createKeptStore, hasUnsaved, isWorking } from './keptDrafts'
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

  ok('6: έτοιμο προσχέδιο = μη αποθηκευμένο', hasUnsaved([{ status: 'ready' }]))
  ok('6: αποτυχία αποθήκευσης = μη αποθηκευμένο', hasUnsaved([{ status: 'error' }]))
  ok('6: μόνο αποθηκευμένα/αποτυχημένα σαρώσεις = τίποτα να χαθεί', !hasUnsaved([{ status: 'saved' }, { status: 'failed' }]))
  ok('6: σάρωση σε εξέλιξη = δουλεύει', isWorking([{ status: 'scanning' }]) && isWorking([{ status: 'pending' }]) && isWorking([{ status: 'saving' }]))
  ok('6: έτοιμο ή λάθος δεν κλειδώνει τα κουμπιά', !isWorking([{ status: 'ready' }, { status: 'error' }, { status: 'failed' }]))
}

// ── 6 και 14. Η δομή της καρτέλας Φακέλου ───────────────────────────────────
{
  const src = read('app/dashboard/components/TabDocuments.tsx')
  ok('6: τα προσχέδια δεν ζουν σε useState της καρτέλας', !/useState<Draft\[\]>/.test(src))
  ok('6: τα προσχέδια διαβάζονται από το κατάστημα', /useSyncExternalStore\(/.test(src) && /draftStore\.set\(propertyId/.test(src))
  ok('6: η ανανέωση με μη αποθηκευμένα ρωτά', /addEventListener\('beforeunload'/.test(src))
  ok('6: η σάρωση που πετά δεν μένει «σε εξέλιξη»', /try \{ r = await scanFile\(d\.file\); \} catch/.test(src))

  const upd = body(src, 'const updateDocs', 'const applyRename')
  ok('14: η ενημέρωση εγγράφων περνά από το saved', /saved\(/.test(upd))
  const ren = body(src, 'const applyRename', 'const applyFix')
  ok('14: η μετονομασία κλείνει μόνο μετά από επιτυχία', /if \(await updateDocs\([^;]*\)\) setRenameItem\(null\)/.test(ren))
  const fix = body(src, 'const applyFix', 'const toggleSel')
  ok('14: η διόρθωση μένει ανοιχτή στην αποτυχία', /!await updateDocs\(fixItems, p\)\) return/.test(fix))
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
}

// ── 16β. Πεδίο φωτογραφιών της πύλης ───────────────────────────────────────
{
  const src = read('app/portal/[token]/page.tsx')
  const input = src.match(/<input type="file"[\s\S]*?\/>/)?.[0] ?? ''
  ok('16β: βρέθηκε το πεδίο αρχείου', input.length > 0)
  ok('16β: δεν είναι display:none', !/display:\s*'none'/.test(input))
  ok('16β: κρύβεται μόνο οπτικά', /className="sr-only"/.test(input))
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
  const src = read('app/dashboard/components/TabSettings.tsx')
  ok('7: χρησιμοποιείται σε δύο θέσεις (εξαγωγή και διαγραφή)', (src.match(/\$\{FILES_NOT_IN_EXPORT\}/g) || []).length === 2)
  ok('7: η διαγραφή δεν λέει πια ότι η εξαγωγή αρκεί', !src.includes('προηγείται η εξαγωγή δεδομένων'))
}

console.log(`flowSafety: ${passed} ✓ · ${failed} ✗`)
if (failed) { for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
