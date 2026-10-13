#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΟΔΗΓΟΣ ΕΚΤΟΣ ΚΑΤΑΛΟΓΟΥ: ΚΑΜΙΑ ΑΛΛΗ ΣΕΛΙΔΑ ΔΕΝ ΤΟΥ ΔΙΝΕΙ ΣΥΝΔΕΣΜΟ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ, ΜΕΤΡΗΜΕΝΟ. Ο οδηγός /odigos/vraxyxronia-ama-prodiagrafes-2026
// θέλει την υπογραφή της Legal πριν ξαναπάρει εσωτερικό σύνδεσμο. Στον έλεγχο
// του live site στις 13/10/2026 τον έδειχναν ΕΠΤΑ σελίδες: ο οδηγός Airbnb
// (τρεις φορές), ο κόμβος /odigos, οι οδηγοί ανακαίνισης, τράπεζας, προθεσμιών
// και πλαφόν (κάρτες «Σχετικοί οδηγοί») και το εργαλείο /vraxyxronia-i-makroxronia
// (κάρτες οδηγών). Κανένας από αυτούς δεν ήταν γραμμένος με το χέρι: όλοι
// έβγαιναν από τον κατάλογο app/odigos/guides.ts από τρεις δρόμους, το
// `GUIDES.map` του κόμβου, το `relatedGuides` και το `guidesForTool`. Η ίδια
// ανάγκη είχε λυθεί μία φορά πριν (05.10.2026) με `exclude` σε ΜΙΑ σελίδα,
// ενώ οι άλλοι δρόμοι έμεναν ανοιχτοί.
//
// ΚΑΙ ΤΟ ΔΕΥΤΕΡΟ, ΙΔΙΑ ΜΕΡΑ. Ο αντίπαλος έλεγχος της πρώτης εκδοχής βρήκε
// πέντε δρόμους όπου ο φύλακας έμενε πράσινος πάνω από το σφάλμα, ο καθένας
// αποδεδειγμένος με μετάλλαξη: επανεξαγωγή του `GUIDES` από άλλο αρχείο, arrow
// function στον κατάλογο, συνάρτηση του καταλόγου χωρίς δηλωμένο τύπο
// επιστροφής, διαδρομή σε .json του lib/ και σε .mjs του supabase/functions/.
// Κλείνουν όλοι παρακάτω και ο καθένας έχει δικό του βήμα στη μετάλλαξη
// 'unlisted-guides' (scripts/lib/mutations.mjs).
//
// ΤΙ ΕΛΕΓΧΕΤΑΙ. Οι οδηγοί με `unlisted` στο app/odigos/guides.ts, διαβασμένοι
// από το δέντρο του TypeScript (όχι με εκτέλεση: ο κατάλογος εισάγει με `@/`).
//   (α) Η διαδρομή τους (το τελευταίο κομμάτι της, ώστε να πιάνεται και το
//       `/odigos/${…}` και το πλήρες URL) δεν υπάρχει σε συμβολοσειρά ή κείμενο
//       JSX κανενός .ts, .tsx, .mts, .cts, .js, .jsx, .mjs, .cjs ή .json του
//       app/, lib/, components/ και supabase/functions/: href, <Link>,
//       guideAt(), σύνδεσμος συχνής ερώτησης, υποσέλιδο, Νόα, email, δεδομένα
//       σελίδας. Ούτε σε κείμενο του public/.
//       ΕΞΑΙΡΟΥΝΤΑΙ: η σελίδα του ίδιου του οδηγού (app<href>/), η δική του
//       εγγραφή στον κατάλογο (ΜΟΝΟ αυτή: ο υπόλοιπος κατάλογος σαρώνεται), ο
//       χάρτης ιστότοπου (app/sitemap.ts) που τον κρατά επίτηδες και τα
//       ΠΑΡΑΓΟΜΕΝΑ του `GENERATED`, με τη γεννήτριά τους. Τα αγνοημένα του git
//       (.next/, node_modules/) δεν φτάνουν εδώ: τα κόβει το `projectFiles`.
//   (β) Το πλήρες `GUIDES` το εισάγουν μόνο ο χάρτης ιστότοπου και οι κάρτες
//       κοινοποίησης (app/og/share.ts: η εικόνα κάθε οδηγού, όχι σύνδεσμος).
//       Ό,τι δείχνει οδηγούς σε σελίδα παίρνει το `LISTED_GUIDES`. Κανένα
//       αρχείο, ούτε αυτοί οι δύο, δεν το ΕΠΑΝΕΞΑΓΕΙ: `export { GUIDES } from`,
//       `export *` και `export * as` προς τον κατάλογο, `export { GUIDES }`
//       αφού το εισαγάγει, `export const X = GUIDES`, `export default GUIDES`
//       ή εξαγόμενη συνάρτηση που κάνει `return GUIDES`.
//   (γ) Μέσα στον κατάλογο, κάθε εξαγόμενη δήλωση (function, const, arrow,
//       `export { … }`, `export default`) που διαβάζει το `GUIDES`, απευθείας
//       ή μέσα από βοηθητική μη εξαγόμενη δήλωση (`const ALL = GUIDES`), ή που
//       δηλώνει τύπο `Guide[]`, περνά από το `listed`. Ο δηλωμένος τύπος δεν
//       χρειάζεται: το σφάλμα είναι η ανάγνωση, όχι η υπογραφή. Το
//       `LISTED_GUIDES` υπάρχει και φιλτράρει με το `listed`.
// Τα σχόλια μένουν έξω (εκεί η διαδρομή είναι ιστορία) και οι δοκιμές με τα
// fixtures τους επίσης (εκεί είναι τεκμήριο). Το docs/ και το scripts/ δεν
// είναι σελίδες του site.
//
// ΤΙ ΔΕΝ ΠΙΑΝΕΙ, γραμμένο για να μη διαβαστεί το πράσινο ως «ελέγχθηκε»:
//   · δυναμικό `import()`, `require()` και `import X = require()` του καταλόγου
//     (το (β) βλέπει μόνο ES import/export)·
//   · διαδρομή που συντίθεται από κομμάτια (`'vraxyxronia-' + x`) και
//     `guideAt(μεταβλητή)` με τιμή που δεν είναι γραμμένη πουθενά·
//   · στον κατάλογο: `export class`, `export namespace`, αποδόμηση
//     (`export const [...A] = GUIDES`) και ψεύτικο πέρασμα από το `listed`
//     (`void LISTED_GUIDES; return GUIDES`): το (γ) κοιτά αν το όνομα
//     εμφανίζεται, όχι αν φιλτράρει·
//   · στους δύο αναγνώστες του πλήρους καταλόγου, επανεξαγωγή μέσα από
//     μετασχηματισμό (`export const X = GUIDES.slice()`)·
//   · τα αρχεία της ρίζας (next.config.ts, proxy.ts, vercel.json).
// Κανένα από αυτά δεν υπάρχει σήμερα στο αποθετήριο (git grep, 13/10/2026).
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { dirname, extname, join, normalize } from 'node:path'
import ts from 'typescript'
import { projectFiles } from './lib/git-files.mjs'
import { GUIDES_FILE as CATALOG, LEDGER } from './lib/guide-stamps.mjs'

const SITEMAP = 'app/sitemap.ts'
/** Όσοι διαβάζουν όλο τον κατάλογο χωρίς να δίνουν σύνδεσμο. */
const FULL_READERS = new Set([CATALOG, SITEMAP, 'app/og/share.ts'])

/**
 * ΠΑΡΑΓΟΜΕΝΑ ΜΕΣΑ ΣΤΟΥΣ ΦΑΚΕΛΟΥΣ ΤΗΣ ΣΑΡΩΣΗΣ, με τη γεννήτρια και το γιατί.
 * Τα γράφει σενάριο, όχι χέρι, οπότε η διόρθωση πάει στη γεννήτρια ή στην πηγή.
 */
const GENERATED = new Map([
  // Κλειδί κάθε εγγραφής είναι η διαδρομή ενός οδηγού, ακόμη και του κρυφού:
  // ο guard-guide-updated σφραγίζει όλους τους οδηγούς. Δεν το διαβάζει σελίδα.
  [LEDGER, 'npm run guides:stamp'],
])

const KIND = {
  '.ts': ts.ScriptKind.TS, '.mts': ts.ScriptKind.TS, '.cts': ts.ScriptKind.TS, '.tsx': ts.ScriptKind.TSX,
  '.js': ts.ScriptKind.JS, '.mjs': ts.ScriptKind.JS, '.cjs': ts.ScriptKind.JS, '.jsx': ts.ScriptKind.JSX,
  '.json': ts.ScriptKind.JSON,
}
const parse = (path, src) => ts.createSourceFile(path, src, ts.ScriptTarget.Latest, true, KIND[extname(path)] ?? ts.ScriptKind.TS)
const lineOf = (sf, node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1
const isTest = (f) => /\.test\.[cm]?[jt]sx?$/.test(f) || /(^|\/)fixtures\//.test(f)

// ── Ο κατάλογος ─────────────────────────────────────────────────────────────
const catalogSrc = readFileSync(CATALOG, 'utf8')
const catalog = parse(CATALOG, catalogSrc)
const prop = (obj, name) => obj.properties.find(p => ts.isPropertyAssignment(p) && p.name.getText(catalog) === name)

let entries = null
const findGuides = (n) => {
  if (entries) return
  if (ts.isVariableDeclaration(n) && n.name.getText(catalog) === 'GUIDES' && n.initializer) {
    let init = n.initializer
    while (ts.isAsExpression(init) || ts.isParenthesizedExpression(init)) init = init.expression
    if (ts.isArrayLiteralExpression(init)) entries = init.elements.filter(ts.isObjectLiteralExpression)
    return
  }
  ts.forEachChild(n, findGuides)
}
findGuides(catalog)
if (!entries) { console.error(`✗ δεν βρέθηκε ο πίνακας GUIDES στο ${CATALOG}`); process.exit(1) }

const hidden = entries.filter(o => prop(o, 'unlisted')).map(o => {
  const h = prop(o, 'href')
  const href = h && ts.isStringLiteralLike(h.initializer) ? h.initializer.text : null
  return { href, slug: href ? href.split('/').pop() : null, line: lineOf(catalog, o) }
})

const provlimata = []
for (const h of hidden) {
  if (!h.slug) provlimata.push({ pou: `${CATALOG}:${h.line}`, ti: 'οδηγός εκτός καταλόγου χωρίς href γραμμένο ως απλό κείμενο' })
}
const targets = hidden.filter(h => h.slug)

// ── (α) Η διαδρομή σε κώδικα, κείμενο ή δεδομένα ──────────────────────────
/** Οι συμβολοσειρές και το κείμενο JSX ενός αρχείου: ό,τι φτάνει στη σελίδα, όχι τα σχόλια. */
function texts(sf) {
  const out = []
  const walk = (n) => {
    if (ts.isStringLiteralLike(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n) || n.kind === ts.SyntaxKind.JsxText) {
      out.push({ text: n.text ?? n.getText(sf), line: lineOf(sf, n), pos: n.getStart(sf) })
    }
    ts.forEachChild(n, walk)
  }
  walk(sf)
  return out
}

const EXT = Object.keys(KIND).map(e => e.slice(1))
const DIRS = ['app', 'lib', 'components', 'supabase/functions']
const CODE = projectFiles(DIRS.flatMap(d => EXT.map(e => `'${d}/**/*.${e}'`)).join(' '))
  .filter(f => !isTest(f) && !f.endsWith('.d.ts') && !GENERATED.has(f))
const PUBLIC = projectFiles("'public/**/*.txt' 'public/**/*.html' 'public/**/*.xml' 'public/**/*.json' 'public/**/*.js'")

// Η εγγραφή κάθε κρυφού οδηγού στον κατάλογο: ΜΟΝΟ εκεί γράφεται η διαδρομή
// του. Ο υπόλοιπος κατάλογος σαρώνεται όπως κάθε αρχείο. Πριν, ο κατάλογος
// έμενε όλος έξω και ένα `guideAt('/odigos/…')` σε συνάρτηση χωρίς δηλωμένο
// τύπο περνούσε πράσινο (αντίπαλος έλεγχος, 13/10/2026).
const ownEntry = entries.filter(o => prop(o, 'unlisted')).map(o => [o.getStart(catalog), o.getEnd()])
const inOwnEntry = (pos) => ownEntry.some(([a, b]) => pos >= a && pos < b)
if (targets.length) {
  for (const f of CODE) {
    if (f === SITEMAP) continue
    const own = targets.filter(t => f.startsWith(`app${t.href}/`))
    const look = targets.filter(t => !own.includes(t))
    if (!look.length) continue
    const src = f === CATALOG ? catalogSrc : readFileSync(f, 'utf8')
    if (!look.some(t => src.includes(t.slug))) continue
    for (const { text, line, pos } of texts(f === CATALOG ? catalog : parse(f, src))) {
      if (f === CATALOG && inOwnEntry(pos)) continue
      for (const t of look) {
        if (text.includes(t.slug)) provlimata.push({ pou: `${f}:${line}`, ti: `σύνδεσμος προς ${t.href}, που είναι εκτός καταλόγου` })
      }
    }
  }
  for (const f of PUBLIC) {
    readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
      for (const t of targets) if (l.includes(t.slug)) provlimata.push({ pou: `${f}:${i + 1}`, ti: `σύνδεσμος προς ${t.href}, που είναι εκτός καταλόγου` })
    })
  }
}

// ── (β) Ποιος διαβάζει όλο τον κατάλογο και ποιος τον ξαναδίνει ──────────
// Η εισαγωγή λύνεται σε διαδρομή του αποθετηρίου: './guides' από το
// app/odigos/, '../odigos/guides' από το app/og/, '@/app/odigos/guides' από το lib/.
const CATALOG_MODULE = CATALOG.replace(/\.ts$/, '')
const toCatalog = (from, spec) => {
  const bare = spec.replace(/\.[cm]?[jt]sx?$/, '')
  if (bare.startsWith('@/')) return bare.slice(2) === CATALOG_MODULE
  if (bare.startsWith('.')) return normalize(join(dirname(from), bare)) === CATALOG_MODULE
  return bare === CATALOG_MODULE
}
const nameOf = (el) => (el.propertyName ?? el.name).text
const LIST_HINT = 'πάρε το `LISTED_GUIDES`, που κρατά έξω τους οδηγούς εκτός καταλόγου'
for (const f of CODE) {
  if (f === CATALOG || f.endsWith('.json')) continue
  const src = readFileSync(f, 'utf8')
  if (!/guides(\.[cm]?[jt]sx?)?['"`]/.test(src)) continue
  const sf = parse(f, src)
  const isFullReader = FULL_READERS.has(f)
  /** Τα τοπικά ονόματα του πλήρους καταλόγου σε αυτό το αρχείο. */
  const bound = new Set()
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier) || !toCatalog(f, st.moduleSpecifier.text)) continue
    const b = st.importClause?.namedBindings
    if (b && ts.isNamespaceImport(b)) {
      bound.add(b.name.text)
      if (!isFullReader) provlimata.push({ pou: `${f}:${lineOf(sf, st)}`, ti: `εισάγει όλο τον κατάλογο (\`* as\`): πάρε ό,τι χρειάζεσαι με όνομα· για λίστα, ${LIST_HINT}` })
    } else if (b && ts.isNamedImports(b)) {
      for (const el of b.elements) {
        if (nameOf(el) !== 'GUIDES') continue
        bound.add(el.name.text)
        if (!isFullReader) provlimata.push({ pou: `${f}:${lineOf(sf, el)}`, ti: `εισάγει το πλήρες \`GUIDES\`, μαζί με τους οδηγούς εκτός καταλόγου: ${LIST_HINT}` })
      }
    }
  }
  for (const st of sf.statements) {
    if (!ts.isExportDeclaration(st) || st.isTypeOnly) continue
    const c = st.exportClause
    if (st.moduleSpecifier) {
      if (!ts.isStringLiteral(st.moduleSpecifier) || !toCatalog(f, st.moduleSpecifier.text)) continue
      if (!c || ts.isNamespaceExport(c)) {
        provlimata.push({ pou: `${f}:${lineOf(sf, st)}`, ti: `επανεξάγει όλο τον κατάλογο (\`export *\`), άρα και το πλήρες \`GUIDES\`: εξάγαγε με όνομα ό,τι χρειάζεται· για λίστα, ${LIST_HINT}` })
        continue
      }
      for (const el of c.elements) {
        if (nameOf(el) === 'GUIDES') provlimata.push({ pou: `${f}:${lineOf(sf, el)}`, ti: `επανεξάγει το πλήρες \`GUIDES\` και όποιος το εισάγει από εδώ περνά τον έλεγχο: ${LIST_HINT}` })
      }
    } else if (c && ts.isNamedExports(c)) {
      for (const el of c.elements) {
        if (bound.has(nameOf(el))) provlimata.push({ pou: `${f}:${lineOf(sf, el)}`, ti: `ξαναδίνει τον πλήρη κατάλογο που εισάγει: όποιος το εισάγει από εδώ περνά τον έλεγχο· ${LIST_HINT}` })
      }
    }
  }
  if (!bound.size) continue
  // Ο ίδιος πίνακας ξαναδοσμένος με δήλωση: `export const X = GUIDES`,
  // `export default GUIDES`, `export function f() { return GUIDES }`. Αφορά
  // στην πράξη τους δύο αναγνώστες του πλήρους καταλόγου, που μόνο αυτοί τον
  // εισάγουν χωρίς εύρημα (αντίπαλος έλεγχος, 13/10/2026).
  const unwrap = (e) => { while (e && (ts.isAsExpression(e) || ts.isParenthesizedExpression(e) || ts.isSatisfiesExpression(e))) e = e.expression; return e }
  const isBound = (e) => { const u = unwrap(e); return !!u && ts.isIdentifier(u) && bound.has(u.text) }
  const returnsBound = (fn) => {
    if (!fn.body) return false
    if (!ts.isBlock(fn.body)) return isBound(fn.body)
    let hit = false
    const walk = (n) => {
      if (hit || (n !== fn.body && ts.isFunctionLike(n))) return
      if (ts.isReturnStatement(n) && isBound(n.expression)) { hit = true; return }
      ts.forEachChild(n, walk)
    }
    walk(fn.body)
    return hit
  }
  const gives = (where, name) => provlimata.push({ pou: `${f}:${where}`, ti: `η εξαγόμενη \`${name}\` ξαναδίνει τον πλήρη κατάλογο: όποιος την εισάγει περνά τον έλεγχο· ${LIST_HINT}` })
  for (const st of sf.statements) {
    if (ts.isExportAssignment(st) && (isBound(st.expression) || ((ts.isArrowFunction(unwrap(st.expression)) || ts.isFunctionExpression(unwrap(st.expression))) && returnsBound(unwrap(st.expression))))) gives(lineOf(sf, st), 'default')
    if (!st.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) continue
    if (ts.isFunctionDeclaration(st) && returnsBound(st)) gives(lineOf(sf, st), st.name?.text ?? 'default')
    if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        const init = unwrap(d.initializer)
        if (!init) continue
        if (isBound(init) || ((ts.isArrowFunction(init) || ts.isFunctionExpression(init)) && returnsBound(init))) gives(lineOf(sf, d), d.name.getText(sf))
      }
    }
  }
}

// ── (γ) Μέσα στον κατάλογο: κάθε λίστα οδηγών περνά από το `listed` ─────────
// ΕΞΑΙΡΕΣΕΙΣ, με την αιτία τους. Ό,τι διαβάζει το `GUIDES` χωρίς να βγάζει
// λίστα οδηγών προς σελίδα:
const EXEMPT = new Map([
  ['GUIDES', 'ο ίδιος ο πίνακας· ποιος τον εισάγει το φυλάει το (β)'],
  ['guideAt', 'ένας οδηγός από ρητή διαδρομή, όχι λίστα: η σελίδα κάθε οδηγού διαβάζει τον εαυτό της· το `guideAt()` με τη διαδρομή κρυφού οδηγού από άλλο αρχείο το πιάνει το (α)'],
  ['GUIDES_UPDATED', 'μία ημερομηνία, το lastModified του κόμβου στον χάρτη, όχι λίστα'],
])
// Τα `listed`, `guideSlug` και `guideShareImageUrl` δεν διαβάζουν το `GUIDES`,
// οπότε ο κανόνας δεν τα αγγίζει χωρίς να χρειάζονται εξαίρεση. Το
// `LISTED_GUIDES` το διαβάζει και περνά επειδή φιλτράρει με το `listed`.
const isExported = (st) => !!st.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)
const GUIDE_LIST = /^(readonly\s+)?Guide\[\]$|^(Readonly)?Array<\s*Guide\s*>$/
const typed = (t) => !!t && GUIDE_LIST.test(t.getText(catalog).trim())

/** Οι δηλώσεις του αρχείου: όνομα, κόμβος, αν εξάγεται, αν δηλώνει λίστα οδηγών. */
const decls = []
/** `export { a as b }` χωρίς from: τοπικό όνομα → εξαγόμενο όνομα. */
const exportList = []
for (const st of catalog.statements) {
  if (ts.isFunctionDeclaration(st) && st.body) {
    const name = st.name?.text ?? 'default'
    decls.push({ name, node: st, self: st.name, exported: isExported(st), typed: typed(st.type), line: lineOf(catalog, st) })
  } else if (ts.isVariableStatement(st)) {
    for (const d of st.declarationList.declarations) {
      if (!ts.isIdentifier(d.name) || !d.initializer) continue
      const fn = ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer) ? d.initializer : null
      decls.push({ name: d.name.text, node: d, self: d.name, exported: isExported(st), typed: typed(d.type) || typed(fn?.type), line: lineOf(catalog, d) })
    }
  } else if (ts.isExportAssignment(st)) {
    decls.push({ name: 'default', node: st.expression, self: null, exported: true, typed: false, line: lineOf(catalog, st) })
  } else if (ts.isExportDeclaration(st) && !st.moduleSpecifier && !st.isTypeOnly && st.exportClause && ts.isNamedExports(st.exportClause)) {
    for (const el of st.exportClause.elements) exportList.push({ local: nameOf(el), as: el.name.text, line: lineOf(catalog, el) })
  }
}
for (const d of decls) if (exportList.some(e => e.local === d.name)) d.exported = true

/** Διαβάζει ο κόμβος κάποιο από τα ονόματα; Όχι ως όνομα ιδιότητας (`x.GUIDES`) ή ως το δικό του όνομα. */
const reads = (node, names, self) => {
  let hit = false
  const walk = (n) => {
    if (hit) return
    if (ts.isIdentifier(n) && n !== self && names.has(n.text)
      && !(n.parent && ts.isPropertyAccessExpression(n.parent) && n.parent.name === n)
      && !(n.parent && ts.isPropertyAssignment(n.parent) && n.parent.name === n)) { hit = true; return }
    ts.forEachChild(n, walk)
  }
  walk(node)
  return hit
}
const LISTED = new Set(['listed', 'LISTED_GUIDES'])

// Ό,τι φτάνει σε λίστα οδηγών χωρίς το `listed`, μεταβατικά από τις μη
// εξαγόμενες βοηθητικές: `const ALL = GUIDES` και μετά `() => ALL.filter(…)`.
const unfiltered = new Set(['GUIDES'])
for (let grew = true; grew;) {
  grew = false
  for (const d of decls) {
    if (d.exported || unfiltered.has(d.name) || reads(d.node, LISTED, d.self)) continue
    if (!d.typed && !reads(d.node, unfiltered, d.self)) continue
    unfiltered.add(d.name)
    grew = true
  }
}
for (const d of decls) {
  if (!d.exported || EXEMPT.has(d.name) || reads(d.node, LISTED, d.self)) continue
  if (!d.typed && !reads(d.node, unfiltered, d.self)) continue
  provlimata.push({ pou: `${CATALOG}:${d.line}`, ti: `η εξαγόμενη \`${d.name}\` δίνει οδηγούς χωρίς να περάσει από το \`listed\`: φίλτραρε με \`listed\` ή ξεκίνα από το \`LISTED_GUIDES\`` })
}
for (const e of exportList) {
  if (unfiltered.has(e.local) && e.as !== e.local) provlimata.push({ pou: `${CATALOG}:${e.line}`, ti: `εξάγει το πλήρες \`${e.local}\` ως \`${e.as}\`, που δεν το φυλάει το (β): εξάγαγε λίστα που περνά από το \`listed\`` })
}
const listedDecl = decls.find(d => d.name === 'LISTED_GUIDES')
if (!listedDecl) provlimata.push({ pou: CATALOG, ti: 'λείπει το `LISTED_GUIDES`, η λίστα που δείχνουν ο κόμβος και τα «Όλοι οι οδηγοί»' })
else if (!/\blisted\b/.test((listedDecl.node.initializer ?? listedDecl.node).getText(catalog))) {
  provlimata.push({ pou: `${CATALOG}:${listedDecl.line}`, ti: 'το `LISTED_GUIDES` δεν φιλτράρεται με το `listed`' })
}

if (provlimata.length) {
  console.error(`\n✗ ${provlimata.length} ${provlimata.length === 1 ? 'δρόμος' : 'δρόμοι'} προς οδηγό εκτός καταλόγου:\n`)
  for (const p of provlimata.slice(0, 30)) console.error(`  ${p.pou}  ${p.ti}`)
  if (provlimata.length > 30) console.error(`  … και ${provlimata.length - 30} ακόμη`)
  console.error(`
  ΤΙ ΝΑ ΚΑΝΕΙΣ. Ο οδηγός με \`unlisted\` στο ${CATALOG} μένει δημοσιευμένος και στον
  χάρτη, αλλά καμία άλλη σελίδα δεν τον δείχνει ώσπου να φύγει η σημαία (π.χ. με
  την υπογραφή της Legal για τον οδηγό ΑΜΑ).
  · Σύνδεσμος γραμμένος σε σελίδα ή σε δεδομένα: βγάλ' τον ή στείλε στην επίσημη
    πηγή (lib/tax/aade.ts για την ΑΑΔΕ).
  · Λίστα οδηγών: πάρε το \`LISTED_GUIDES\`, το \`guidesForTool\` ή το \`relatedGuides\`,
    όχι το \`GUIDES\`. Μην το επανεξάγεις από άλλο αρχείο.
  · Νέα εξαγωγή στον κατάλογο που διαβάζει το \`GUIDES\`: φίλτραρε με το \`listed\`.
    Αν δεν δίνει λίστα οδηγών (όπως το \`guideAt\`), πρόσθεσέ τη στο \`EXEMPT\` του
    φύλακα με την αιτία.
`)
  process.exit(1)
}
const names = targets.map(t => t.slug).join(', ') || 'κανένας τώρα'
console.log(`✓ οδηγοί εκτός καταλόγου (${names}): κανένας σύνδεσμος από ${CODE.length + PUBLIC.length} αρχεία, οι λίστες περνούν από το listed`)
