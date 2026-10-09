// ═══════════════════════════════════════════════════════════════════════════
// Η ΣΦΡΑΓΙΔΑ ΤΟΥ ΠΕΡΙΕΧΟΜΕΝΟΥ ΚΑΘΕ ΟΔΗΓΟΥ
// ─────────────────────────────────────────────────────────────────────────
// Το `updated` του app/odigos/guides.ts είναι η «Τελευταία ενημέρωση» που
// διαβάζει ο αναγνώστης, το `dateModified` της μηχανής αναζήτησης, το
// `lastModified` του χάρτη και το «Ενημερώθηκε» της κάρτας κοινοποίησης. Το
// γράφει το χέρι και τίποτα δεν το έδενε με το περιεχόμενο.
//
// Εδώ βγαίνει ένα αποτύπωμα ανά οδηγό από τα ΣΥΜΒΟΛΑ του κώδικα, όχι από τα
// bytes: σχόλια (μαζί και τα JSDoc), εσοχές, κενές γραμμές και σχόλια JSX δεν
// το αλλάζουν. Μια λέξη του κειμένου, ένας αριθμός ή ένα νέο στοιχείο το
// αλλάζουν. Το αποτύπωμα ΔΕΝ κρίνει αν η αλλαγή είναι ουσιαστική· κάνει την
// απόφαση ορατή στο diff (app/odigos/guideStamps.json).
//
// ΤΙ ΜΕΤΡΑ ΣΤΟ ΑΠΟΤΥΠΩΜΑ ΕΝΟΣ ΟΔΗΓΟΥ:
//   · κάθε .ts/.tsx (όχι τεστ) κάτω από το app<href>/
//   · ό,τι αυτά εισάγουν με σχετική διαδρομή μέσα στο app/odigos/, μεταβατικά
//     (π.χ. το ../taxText που μοιράζονται τρεις οδηγοί)
//   · ο τίτλος και η περιγραφή του από το guides.ts
// Εξω μένουν τα κοινά guides.ts, GuideParts.tsx και ToolGuides.tsx: μια αλλαγή
// εκεί αγγίζει όλους τους οδηγούς και δεν λέει ποιος άλλαξε ουσιαστικά.
//
// ΤΙ ΔΕΝ ΜΕΤΡΑ. Η περιγραφή μετρά τα σύμβολα της έκφρασης (π.χ. `${RENT_SCALE}`),
// όχι την τιμή τους. Το ίδιο για κάθε σταθερά του lib/: αλλαγή συντελεστή στο
// lib/billing/greekTax.ts αλλάζει το κείμενο του οδηγού χωρίς να αλλάξει
// αποτύπωμα. Εκεί η ημερομηνία μένει απόφαση του ανθρώπου που αλλάζει τον νόμο.
//
// ΑΝΑΒΑΘΜΙΣΗ TYPESCRIPT. Μετράει μόνο το κείμενο των συμβόλων, όχι τα ονόματα
// των ειδών τους, που αλλάζουν από έκδοση σε έκδοση. Αν παρ' όλα αυτά μια
// αναβάθμιση αλλάξει όλα τα αποτυπώματα μαζί: `npm run guides:stamp` με όλους
// τους οδηγούς στο --keep-date, με αιτία «αναβάθμιση typescript» στο PR.
// ═══════════════════════════════════════════════════════════════════════════
import ts from 'typescript'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, dirname, normalize } from 'node:path'

export const GUIDES_FILE = 'app/odigos/guides.ts'
export const LEDGER = 'app/odigos/guideStamps.json'
const ROOT = 'app/odigos/'
const SHARED = new Set([GUIDES_FILE, 'app/odigos/GuideParts.tsx', 'app/odigos/ToolGuides.tsx'])

const parse = (path, src) => ts.createSourceFile(path, src, ts.ScriptTarget.Latest, true,
  path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)

const isJsDoc = (n) => ts.isJSDoc(n) || (n.kind >= ts.SyntaxKind.FirstJSDocNode && n.kind <= ts.SyntaxKind.LastJSDocNode)

/** Το κείμενο JSX όπως το αποδίδει η React: γραμμές κομμένες, κενές έξω. */
function jsxText(raw) {
  const lines = raw.split(/\r?\n/)
  const kept = lines.map((l, i) => {
    let t = l
    if (i > 0) t = t.replace(/^\s+/, '')
    if (i < lines.length - 1) t = t.replace(/\s+$/, '')
    return t
  }).filter(Boolean)
  return kept.join(' ').replace(/\s+/g, ' ')
}

/** Τα φύλλα του δέντρου ενός κόμβου, χωρίς σχόλια, εσοχές και είδη συμβόλων. */
function leaves(sf, node) {
  const out = []
  const walk = (n) => {
    if (isJsDoc(n)) return
    if (n.kind === ts.SyntaxKind.EndOfFileToken) return
    if (n.kind === ts.SyntaxKind.JsxExpression && !n.expression) return
    const kids = n.getChildren(sf)
    if (kids.length) { kids.forEach(walk); return }
    if (n.kind === ts.SyntaxKind.JsxText) { const t = jsxText(n.getText(sf)); if (t) out.push(t); return }
    // Το είδος των εισαγωγικών δεν είναι περιεχόμενο.
    if (n.kind === ts.SyntaxKind.StringLiteral) { out.push(JSON.stringify(n.text)); return }
    const t = n.getText(sf)
    if (t) out.push(t)
  }
  walk(node)
  return out.join('\u0001')
}

const prop = (obj, name) => obj.properties.find(p => ts.isPropertyAssignment(p) && p.name.getText() === name)

/**
 * Οι οδηγοί του καταλόγου, διαβασμένοι από το δέντρο του guides.ts (όχι με
 * εκτέλεση: ο κατάλογος εισάγει το lib/ με τα ψευδώνυμα `@/`).
 * @returns {{ href: string, slug: string, published: string|null, updated: string|null, line: number, meta: string }[]}
 */
export function readGuides(src = readFileSync(GUIDES_FILE, 'utf8')) {
  const sf = parse(GUIDES_FILE, src)
  let arr = null
  const find = (n) => {
    if (arr) return
    if (ts.isVariableDeclaration(n) && n.name.getText(sf) === 'GUIDES' && n.initializer) {
      let init = n.initializer
      while (ts.isAsExpression(init) || ts.isSatisfiesExpression?.(init) || ts.isParenthesizedExpression(init)) init = init.expression
      if (ts.isArrayLiteralExpression(init)) arr = init
      return
    }
    ts.forEachChild(n, find)
  }
  find(sf)
  if (!arr) throw new Error(`δεν βρέθηκε ο πίνακας GUIDES στο ${GUIDES_FILE}`)
  const str = (obj, name) => {
    const p = prop(obj, name)
    return p && ts.isStringLiteralLike(p.initializer) ? p.initializer.text : null
  }
  return arr.elements.filter(ts.isObjectLiteralExpression).map(obj => {
    const href = str(obj, 'href')
    const meta = ['title', 'desc'].map(k => { const p = prop(obj, k); return p ? leaves(sf, p.initializer) : '' }).join('\0')
    return {
      href, slug: href ? href.split('/').pop() : '', published: str(obj, 'published'), updated: str(obj, 'updated'),
      line: sf.getLineAndCharacterOfPosition(obj.getStart(sf)).line + 1, meta,
    }
  })
}

function resolveRel(from, spec) {
  const base = normalize(join(dirname(from), spec))
  for (const p of [base, base + '.ts', base + '.tsx', base + '/index.ts', base + '/index.tsx']) {
    if (existsSync(p) && statSync(p).isFile()) return p
  }
  return null
}

const isSource = (f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && !f.endsWith('.d.ts')

function walkDir(dir) {
  const out = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`
    if (e.isDirectory()) out.push(...walkDir(p))
    else if (isSource(p)) out.push(p)
  }
  return out
}

/** Τα αρχεία περιεχομένου ενός οδηγού, ταξινομημένα. */
export function contentFiles(href) {
  const dir = 'app' + href
  if (!existsSync(dir)) return []
  const seen = new Set()
  const queue = walkDir(dir)
  while (queue.length) {
    const f = queue.shift()
    if (seen.has(f)) continue
    seen.add(f)
    const sf = parse(f, readFileSync(f, 'utf8'))
    for (const st of sf.statements) {
      const spec = (ts.isImportDeclaration(st) || ts.isExportDeclaration(st)) && st.moduleSpecifier && ts.isStringLiteral(st.moduleSpecifier)
        ? st.moduleSpecifier.text : null
      if (!spec || !spec.startsWith('.')) continue
      const r = resolveRel(f, spec)
      if (r && r.startsWith(ROOT) && !SHARED.has(r) && isSource(r)) queue.push(r)
    }
  }
  return [...seen].sort()
}

/** Το αποτύπωμα ενός οδηγού: 16 δεκαεξαδικά ψηφία. */
export function guideHash(guide) {
  const h = createHash('sha256')
  for (const f of contentFiles(guide.href)) {
    const sf = parse(f, readFileSync(f, 'utf8'))
    h.update(`${f}\0${leaves(sf, sf)}\0`)
  }
  h.update(`meta\0${guide.meta}\0`)
  return h.digest('hex').slice(0, 16)
}

/** Οι σφραγίδες όπως είναι ΤΩΡΑ το περιεχόμενο: href → { updated, hash }. */
export function currentStamps(guides = readGuides()) {
  return Object.fromEntries(guides.map(g => [g.href, { updated: g.updated, hash: guideHash(g) }]))
}

/** Το αρχείο σφραγίδων, ή κενό αν δεν υπάρχει ακόμη. */
export function readLedger() {
  if (!existsSync(LEDGER)) return {}
  return JSON.parse(readFileSync(LEDGER, 'utf8')).guides ?? {}
}
