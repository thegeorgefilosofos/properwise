#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΣΤΟΙΧΕΙΑ ΤΡΙΤΟΥ ΔΕΝ ΓΡΑΦΟΝΤΑΙ ΧΩΡΙΣ ΤΗ ΣΥΜΒΑΣΗ ΕΠΕΞΕΡΓΑΣΙΑΣ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ (08/10/2026). Οι Όροι (/terms#epexergasia) λένε «Χωρίς
// αποδοχή τα στοιχεία δεν αποθηκεύονται». Το `ensureDpa` το τηρούσε σε τρία
// σημεία, όλα του ενοικιαστή (scanDoc, LeaseModal, TabTenant). ΕΞΙ άλλα
// έγραφαν όνομα, τηλέφωνο, ΑΦΜ ή έβγαζαν σύνδεσμο που ζητά αριθμό ταυτότητας
// χωρίς να ρωτήσουν: ο νέος επισκέπτης, η κράτηση από email, ο σύνδεσμος
// προ-άφιξης στην καρτέλα Πελατών· από τη Νόα, η καταχώρηση πελάτη και ο
// σύνδεσμος check-in. Η υπόσχεση ζούσε σε κείμενο· τώρα ζει εδώ.
//
// ΤΙ ΕΛΕΓΧΕΤΑΙ. Στα app/** και components/** (.ts/.tsx, όχι δοκιμές):
//   1. `.from('clients' | 'tenants').insert(` ή `.upsert(`
//   2. `<tenants>.add(` ή `<tenants>.addReturning(`, για όποιο όνομα πήρε στο
//      import το '@/lib/data/tenants'
//   3. `<checkinLink>.issue(`, για όποιο όνομα πήρε το '@/lib/data/checkinLink'
// Κάθε τέτοια γραμμή περνά αν το `ensureDpa(` γράφεται ΣΕ ΚΩΔΙΚΑ μέσα στις 40
// γραμμές πάνω της (τα σχόλια σβήνονται πρώτα, για να μη φτάνει ένα σχόλιο),
// ή αν μία από τις 3 γραμμές πάνω της λέει `dpa-exempt:` με αιτιολογία τουλάχιστον
// 10 χαρακτήρων (π.χ. ο συγκεντρωτικός επισκέπτης καναλιού, χωρίς πρόσωπο).
//
// ΤΙ ΔΕΝ ΒΛΕΠΕΙ. Τα ανεβάσματα εγγράφων (ταυτότητα, μισθωτήριο) περνούν από
// τον χώρο αποθήκευσης και δεν έχουν ένα σχήμα που να πιάνεται με ασφάλεια·
// εκεί φυλάνε μόνο οι κλήσεις του `ensureDpa` στα ίδια τα σημεία. Το
// supabase/functions μένει έξω: γράφει με ρόλο υπηρεσίας, χωρίς χρήστη να ρωτηθεί.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { projectFiles } from './lib/git-files.mjs'

const WINDOW = 40
const EXEMPT = /dpa-exempt:\s*(.{10,})/

/**
 * Σβήνει σχόλια κρατώντας τις αλλαγές γραμμής, ώστε οι αριθμοί γραμμών να
 * μένουν ίδιοι. Σέβεται τα αλφαριθμητικά: το 'https://' δεν είναι σχόλιο.
 */
function stripComments(src) {
  let out = ''
  let i = 0
  let quote = null
  while (i < src.length) {
    const c = src[i], n = src[i + 1]
    if (quote) {
      out += c
      if (c === '\\') { out += n ?? ''; i += 2; continue }
      if (c === quote) quote = null
      i++
      continue
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; out += c; i++; continue }
    if (c === '/' && n === '/') {
      while (i < src.length && src[i] !== '\n') i++
      continue
    }
    if (c === '/' && n === '*') {
      const end = src.indexOf('*/', i + 2)
      const stop = end === -1 ? src.length : end + 2
      out += src.slice(i, stop).replace(/[^\n]/g, '')
      i = stop
      continue
    }
    out += c
    i++
  }
  return out
}

/** Τα ονόματα με τα οποία το αρχείο φέρνει ένα module (namespace ή επώνυμα). */
function aliasesOf(code, mod) {
  const ns = []
  const named = []
  // Το `[^'"]` κρατά κάθε ταίριασμα μέσα σε ΕΝΑ import: χωρίς ερωτηματικά στο
  // τέλος των γραμμών, ένα `[^;]` θα κατάπινε όλα τα imports του αρχείου.
  for (const m of code.matchAll(/import\s+(?:type\s+)?([^'"]*?)\s+from\s+(['"])([^'"]+)\2/g)) {
    if (!m[3].endsWith(`lib/data/${mod}`)) continue
    const what = m[1]
    const star = what.match(/\*\s+as\s+(\w+)/)
    if (star) ns.push(star[1])
    const braces = what.match(/\{([^}]*)\}/)
    if (braces) {
      for (const part of braces[1].split(',')) {
        const [orig, as] = part.trim().split(/\s+as\s+/)
        if (orig) named.push({ orig: orig.trim(), name: (as || orig).trim() })
      }
    }
  }
  return { ns, named }
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const files = projectFiles("'app/**/*.ts' 'app/**/*.tsx' 'components/**/*.ts' 'components/**/*.tsx'")
  .filter(f => !/\.test\.tsx?$/.test(f))

const provlimata = []
let elegxthikan = 0
for (const arxeio of files) {
  const raw = readFileSync(arxeio, 'utf8')
  const code = stripComments(raw)
  const rawLines = raw.split('\n')
  const codeLines = code.split('\n')

  const patterns = [
    { re: /\.from\(\s*['"](clients|tenants)['"]\s*\)\s*\.(insert|upsert)\(/g, ti: (m) => `.from('${m[1]}').${m[2]}(` },
  ]
  const ten = aliasesOf(code, 'tenants')
  for (const a of ten.ns) patterns.push({ re: new RegExp(String.raw`\b${esc(a)}\.(add|addReturning)\(`, 'g'), ti: (m) => `${a}.${m[1]}(` })
  for (const a of ten.named.filter(x => x.orig === 'add' || x.orig === 'addReturning')) {
    patterns.push({ re: new RegExp(String.raw`(?<![.\w])${esc(a.name)}\(`, 'g'), ti: () => `${a.name}(` })
  }
  const ck = aliasesOf(code, 'checkinLink')
  for (const a of ck.ns) patterns.push({ re: new RegExp(String.raw`\b${esc(a)}\.issue\(`, 'g'), ti: () => `${a}.issue(` })
  for (const a of ck.named.filter(x => x.orig === 'issue')) {
    patterns.push({ re: new RegExp(String.raw`(?<![.\w])${esc(a.name)}\(`, 'g'), ti: () => `${a.name}(` })
  }

  for (const { re, ti } of patterns) {
    for (const m of code.matchAll(re)) {
      elegxthikan++
      const line = code.slice(0, m.index).split('\n').length // 1-based
      const from = Math.max(0, line - 1 - WINDOW)
      const gated = codeLines.slice(from, line).some(l => l.includes('ensureDpa('))
      const exempt = rawLines.slice(Math.max(0, line - 1 - 3), line).some(l => EXEMPT.test(l))
      if (!gated && !exempt) provlimata.push({ arxeio, grammi: line, ti: ti(m) })
    }
  }
}

if (provlimata.length) {
  console.error(`\n✗ ${provlimata.length} εγγραφές στοιχείων τρίτου χωρίς τη σύμβαση επεξεργασίας:\n`)
  for (const p of provlimata.slice(0, 30)) console.error(`  ${p.arxeio}:${p.grammi}  «${p.ti}»`)
  if (provlimata.length > 30) console.error(`  … και άλλες ${provlimata.length - 30}`)
  console.error(`
  ΤΙ ΝΑ ΚΑΝΕΙΣ: πριν από την εγγραφή, \`if (!(await ensureDpa(supabase))) { …μήνυμα…; return; }\`
  (lib/legal/dpa.ts). Οι Όροι (/terms#epexergasia) υπόσχονται ότι χωρίς αποδοχή
  τα στοιχεία δεν αποθηκεύονται. Αν η γραμμή δεν γράφει στοιχεία προσώπου, γράψε
  από πάνω της \`// dpa-exempt: <γιατί>\`.\n`)
  process.exit(1)
}
console.log(`✓ ${elegxthikan} εγγραφές στοιχείων τρίτου, όλες πίσω από τη σύμβαση επεξεργασίας, σε ${files.length} αρχεία`)
