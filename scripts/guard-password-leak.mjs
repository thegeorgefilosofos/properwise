#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Ο ΕΛΕΓΧΟΣ ΔΙΑΡΡΟΗΣ ΠΡΕΠΕΙ ΝΑ ΦΤΑΝΕΙ ΩΣ ΤΗΝ ΥΠΟΒΟΛΗ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΕΚΛΕΙΣΕ ΚΑΙ ΓΙΑΤΙ ΗΤΑΝ ΤΟΣΟ ΔΥΣΚΟΛΟ ΝΑ ΤΟ ΔΕΙΣ. Ο έλεγχος
// διαρρευσάντων κωδικών ήταν γραμμένος πλήρως (`lib/auth/leakedPassword.ts`,
// k-anonymity με Have I Been Pwned), δηλωμένος στην CSP, με δικά του tests ΚΑΙ
// συνδεδεμένος στο `components/PasswordStrength.tsx`. Το μήνυμα εμφανιζόταν
// σωστά στην οθόνη.
//
// Και μετά ο χρήστης πατούσε «Εγγραφή» και ο κωδικός γινόταν δεκτός.
//
// Το εύρημα ζούσε ΜΟΝΟ μέσα στο component. Οι τρεις οθόνες που ορίζουν κωδικό
// κοιτούσαν αποκλειστικά την πολιτική ισχύος. Δηλαδή: όλα τα κομμάτια υπήρχαν,
// όλα δούλευαν και η προστασία ήταν μηδενική — το χειρότερο είδος σφάλματος,
// γιατί κάθε επιμέρους έλεγχος έδειχνε πράσινο.
//
// Ο κίνδυνος είναι το credential stuffing: ο επιτιθέμενος δεν μαντεύει,
// δοκιμάζει ζεύγη email/κωδικού που ήδη ξέρει από άλλη διαρροή. Απέναντι σε
// αυτό, προειδοποίηση που προσπερνιέται δεν κάνει τίποτα. Το NIST SP 800-63B
// το λέει ρητά: κωδικός σε γνωστό σύνολο διαρροών ΑΠΟΡΡΙΠΤΕΤΑΙ.
//
// ΤΙ ΕΛΕΓΧΕΤΑΙ: κάθε αρχείο που αποδίδει `<PasswordStrength …>` οφείλει
//   1. να περνά `onLeaked`, δηλαδή να ΑΚΟΥΕΙ το εύρημα και
//   2. να το χρησιμοποιεί κάπου αλλού στο ίδιο αρχείο — αλλιώς το ακούει και
//      το πετά, που είναι ακριβώς η κατάσταση από την οποία ήρθαμε·
//   3. να καλεί το `leakedAtSubmit` στην υποβολή. Ο έλεγχος του πεδίου τρέχει
//      450 ms μετά το τελευταίο πλήκτρο και περιμένει το δίκτυο: κωδικός που
//      επικολλήθηκε και υποβλήθηκε αμέσως περνούσε πριν έρθει η απάντηση
//      (10/11/2026).
//
// ΚΑΙ ΑΝΕΞΑΡΤΗΤΑ ΑΠΟ ΤΟ COMPONENT: κάθε κλήση `signUp(…)` ή `updateUser(…)` που
// στέλνει `password` πρέπει να έχει, ΣΤΗΝ ΙΔΙΑ ΣΥΝΑΡΤΗΣΗ και ΠΡΙΝ από αυτήν,
// `await leakedAtSubmit(…)` που το αποτέλεσμά του διαβάζεται (σε `if`,
// ανάθεση ή `return`). Μια οθόνη χωρίς το PasswordStrength ξέφευγε αλλιώς.
//
// ΓΙΑΤΙ ΜΕ ΤΟΝ ΑΝΑΛΥΤΗ ΤΟΥ TYPESCRIPT ΚΑΙ ΟΧΙ ΜΕ REGEX. Η πρώτη εκδοχή έψαχνε
// το κείμενο `leakedAtSubmit(`. Δεχόταν σχόλιο που το ανέφερε ή
// `void leakedAtSubmit(…)` που πετά την απάντηση. Και τα δύο δείχνουν
// προστασία χωρίς να προστατεύουν. Ο αναλυτής δεν βλέπει σχόλια και ξέρει
// πού καταλήγει η τιμή.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { findSources } from './lib/find-tests.mjs'


const PASSWORD_CALLS = new Set(['signUp', 'updateUser'])

/** Περιέχει το όρισμα αντικείμενο με πεδίο `password` (και μέσα σε τριαδικό); */
function sendsPassword(node) {
  let found = false
  const visit = n => {
    if (found || ts.isFunctionLike(n)) return
    if (ts.isObjectLiteralExpression(n)) {
      for (const p of n.properties) {
        if ((ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) && p.name && p.name.getText() === 'password') { found = true; return }
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(node)
  return found
}

/** Η συνάρτηση που περιέχει τον κόμβο (ή το αρχείο). */
function enclosing(node) {
  let n = node.parent
  while (n && !ts.isFunctionLike(n) && !ts.isSourceFile(n)) n = n.parent
  return n
}

/** Διαβάζεται η τιμή του `await leakedAtSubmit(…)`; */
function resultUsed(call) {
  let n = call.parent
  if (!n || !ts.isAwaitExpression(n)) return false
  for (let child = n, p = n.parent; p; child = p, p = p.parent) {
    if (ts.isParenthesizedExpression(p) || ts.isPrefixUnaryExpression(p)) continue
    if (ts.isBinaryExpression(p)) {
      const op = p.operatorToken.kind
      if (op === ts.SyntaxKind.AmpersandAmpersandToken || op === ts.SyntaxKind.BarBarToken) continue
      return op === ts.SyntaxKind.EqualsToken && p.right === child
    }
    if (ts.isIfStatement(p)) return p.expression === child
    if (ts.isConditionalExpression(p)) return p.condition === child
    if (ts.isVariableDeclaration(p)) return p.initializer === child
    if (ts.isReturnStatement(p)) return true
    return false
  }
  return false
}

/** Οι κλήσεις που μετρούν: η πύλη με αποτέλεσμα που διαβάζεται και οι κλήσεις κωδικού. */
function scan(file, src) {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const gates = [], sets = [], ignored = []
  const visit = n => {
    if (ts.isCallExpression(n)) {
      const callee = n.expression
      const name = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : null
      if (name === 'leakedAtSubmit') (resultUsed(n) ? gates : ignored).push(n)
      else if (name && PASSWORD_CALLS.has(name) && ts.isPropertyAccessExpression(callee) && n.arguments[0] && sendsPassword(n.arguments[0])) sets.push(n)
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  const line = n => sf.getLineAndCharacterOfPosition(n.getStart()).line + 1
  return { gates, sets, ignored, line }
}

const COMPONENT = 'components/PasswordStrength.tsx'
const findings = []

for (const file of findSources()) {
  if (file.includes('.test.') || file.endsWith(COMPONENT) || file.startsWith('supabase/') || file.startsWith('scripts/')) continue
  const src = readFileSync(file, 'utf8')
  const renders = file.endsWith('.tsx') && /<PasswordStrength\b/.test(src)
  if (!renders && !/\b(signUp|updateUser)\s*\(/.test(src)) continue
  const { gates, sets, ignored, line } = scan(file, src)

  for (const n of ignored) {
    findings.push({ file, line: line(n), why: 'το αποτέλεσμα του `leakedAtSubmit` δεν διαβάζεται: γράψε `if (await leakedAtSubmit(…))` ή ανάθεση' })
  }
  // Κάθε κλήση που ορίζει κωδικό: πύλη στην ίδια συνάρτηση, πριν από αυτήν.
  for (const call of sets) {
    const fn = enclosing(call)
    if (!gates.some(g => enclosing(g) === fn && g.getStart() < call.getStart())) {
      findings.push({ file, line: line(call), why: `το \`${call.expression.name.text}\` στέλνει κωδικό χωρίς \`await leakedAtSubmit(…)\` πριν από αυτό, στην ίδια συνάρτηση` })
    }
  }
  if (!renders) continue
  if (!gates.length) {
    findings.push({ file, line: src.slice(0, src.search(/<PasswordStrength\b/)).split('\n').length, why: 'η υποβολή δεν καλεί `await leakedAtSubmit(…)`: κωδικός που επικολλάται και υποβάλλεται αμέσως περνά πριν απαντήσει το πεδίο' })
  }

  // Κάθε απόδοση του component, με το άνοιγμα της ετικέτας της.
  for (const m of src.matchAll(/<PasswordStrength\b[^>]*\/?>/g)) {
    const line = src.slice(0, m.index).split('\n').length
    if (!/\bonLeaked=/.test(m[0])) {
      findings.push({ file, line, why: 'δεν περνά `onLeaked`: το εύρημα δεν φτάνει ποτέ στην οθόνη' })
      continue
    }
    // Ποιο state δέχεται το εύρημα;
    const setter = /onLeaked=\{\s*([A-Za-z0-9_$]+)\s*\}/.exec(m[0])?.[1]
    if (!setter) {
      findings.push({ file, line, why: 'το `onLeaked` δεν είναι σταθερή αναφορά (setter του useState)' })
      continue
    }
    // Το state που γεμίζει ο setter, κατά τη σύμβαση `const [x, setX] = useState`.
    const stateName = /^set([A-Z])(.*)$/.exec(setter)
    if (!stateName) {
      findings.push({ file, line, why: `το \`${setter}\` δεν ακολουθεί τη σύμβαση setΌνομα` })
      continue
    }
    const state = stateName[1].toLowerCase() + stateName[2]
    // Χρησιμοποιείται πουθενά ΕΚΤΟΣ από τη δήλωσή του και το πέρασμά του;
    const uses = [...src.matchAll(new RegExp(`\\b${state}\\b`, 'g'))].length
    if (uses < 2) {
      findings.push({ file, line, why: `το \`${state}\` δηλώνεται και δεν το διαβάζει κανείς: η φραγή δεν εφαρμόζεται` })
    }
  }
}

if (findings.length) {
  console.error('✗ Ο έλεγχος διαρροής δεν φτάνει ως την υποβολή:\n')
  for (const f of findings) console.error(`  ${f.file}:${f.line}\n    ${f.why}`)
  console.error('\n  Το σχήμα, ίδιο και στις τρεις οθόνες που ορίζουν κωδικό:')
  console.error('    const [leakedPw, setLeakedPw] = useState<string | null>(null)')
  console.error('    const leaked = leakedPw !== null && leakedPw === password')
  console.error('    <PasswordStrength password={password} onLeaked={setLeakedPw} />')
  console.error('    …και το `leaked` μπαίνει ΚΑΙ στο disabled ΚΑΙ στον έλεγχο της υποβολής,')
  console.error('    και η υποβολή καλεί `await leakedAtSubmit(password)` πριν στείλει τον κωδικό.')
  process.exit(1)
}
console.log('✓ κάθε οθόνη και κάθε κλήση που ορίζει κωδικό περνά από τον έλεγχο διαρροής')
