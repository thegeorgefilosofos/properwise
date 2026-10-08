#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// GUARD: μία ταυτότητα, «Νόα» — και μόνο αυτή στο ορατό κείμενο.
// ─────────────────────────────────────────────────────────────────────────
// Σαρώνει app/, components/, supabase/functions/ (τα κείμενα των email ζουν
// εκεί) και lib/ (εκεί φτιάχνονται ορατά μηνύματα, όπως το assistantLockedMessage
// του lib/billing/aiLimits.ts) και κόβει τα ονόματα-ανταγωνιστές: «Βοηθός AI»,
// «AI Assistant», «Έξυπνες Προτάσεις», «ο/η βοηθός», καθώς και κάθε ετικέτα
// κολλημένη στο όνομα: «βοηθός Νόα», «Νόα, ο βοηθός σου», «δωρεάν Νόα».
// Από το lib/ μένουν έξω τα τεστ (lib/**/*.test.*) και το lib/assistant/identity.ts,
// που ορίζει τους κανόνες· ο λόγος γράφεται στο RULE_SOURCES πιο κάτω.
//
// ΤΟ ΑΡΘΡΟ ΣΤΟ ΟΝΟΜΑ ΕΠΙΤΡΕΠΕΤΑΙ (απόφαση κατόχου, 07/10/2026). Ως τότε ο
// κανόνας «gendered-noa» έκοβε κάθε «η Νόα» / «της Νόα» για να μη δοθεί γένος
// και έβγαζε προτάσεις που δεν στέκουν στα ελληνικά («Νόα μιλάει ελληνικά»,
// «Ραντεβού που προγραμμάτισε Νόα»). Γράφεται πλέον ό,τι χρειάζεται η
// πρόταση: «Η Νόα απαντά», «Ρώτα τη Νόα», «της Νόας». Ο κανόνας «noa-label»
// πήρε τη θέση του και φυλάει ό,τι μένει από την παλιά πρόθεση: η Νόα δεν
// λέγεται ποτέ «βοηθός» ούτε «δωρεάν».
//
// ΤΙ ΚΟΙΤΑΖΕΙ ΚΑΙ ΤΙ ΟΧΙ
// Μόνο ΟΡΑΤΟ κείμενο. Πριν από κάθε έλεγχο αφαιρούνται με μηχανή καταστάσεων
// τα σχόλια (// και /* */, με σωστό χειρισμό για συμβολοσειρές, template
// literals και regex literals) — ώστε ένα σχόλιο «ο βοηθός διαβάζει…» να μην
// μετράει, ενώ ένα <span>Ο βοηθός σου</span> να μετράει.
//
// Τα ΟΝΟΜΑΤΑ ΜΕΤΑΒΛΗΤΩΝ δεν πιάνονται, με δύο διαφορετικούς μηχανισμούς:
//  • Οι ελληνικοί κανόνες θέλουν ελληνικές λέξεις με κενό ή άρθρο. Κανένα
//    αναγνωριστικό εδώ δεν είναι ελληνικό, οπότε PropertyAssistant,
//    assistantPersona και role: 'assistant' περνούν καθαρά.
//  • Οι αγγλικοί όροι δεν αρκεί να έχουν όριο λέξης: το `const bot = 56`
//    (BillsBudget.tsx) είναι έγκυρος κώδικας και ΔΕΝ είναι κείμενο. Γι' αυτό ο
//    κανόνας «bot» απαιτεί ελληνικό γράμμα δίπλα του — το «bot» πιάνεται μόνο
//    μέσα σε ελληνική πρόταση («δεν είμαι bot»), όχι σε έκφραση κώδικα.
//
// ΤΙ ΔΕΝ ΕΠΙΒΑΛΛΕΤΑΙ ΕΔΩ (συνειδητά)
// Ο κανόνας «κανένα AI στο UI» ΔΕΝ επιβάλλεται για το σκέτο «AI»: η λέξη
// εμφανίζεται ~212 φορές και στη συντριπτική πλειονότητα είναι νομικά ουσιώδης
// (ποιος πάροχος επεξεργάζεται τα δεδομένα, στην Πολιτική Απορρήτου και στους
// Όρους) ή κείμενο marketing που αλλάζει με έγκριση. Ένας κανόνας που θα ζητούσε
// allowlist για 30 αρχεία δεν προστατεύει τίποτα. Πιάνουμε ό,τι ΟΝΟΜΑΤΙΖΕΙ τη
// Νόα ως τεχνολογία («AI Assistant», «AI βοηθός», «Βοηθός AI»).
//
// ΓΙΑΤΙ ΥΠΑΡΧΕΙ ALLOWLIST
// Η αφαίρεση σχολίων είναι αξιόπιστη· η διάκριση «ορατό κείμενο» από «κείμενο
// προς το μοντέλο» ΔΕΝ είναι — και υπάρχουν οθόνες (marketing, νομικά) που
// ανήκουν σε άλλους. Τα αρχεία στο ALLOWLIST έχουν ελεγχθεί με το χέρι, ο λόγος
// γράφεται δίπλα σε καθένα και τα ευρήματά τους τυπώνονται ως ΕΚΚΡΕΜΟΤΗΤΕΣ
// (χωρίς να ρίχνουν το build) ώστε να μη γίνουν αόρατα.
//
// Οι κανόνες είναι ΟΙ ΙΔΙΟΙ με το lib/assistant/identity.ts (ίδια id). Το
// lib/assistant/identity.test.ts ελέγχει ότι οι δύο λίστες δεν έχουν αποκλίνει.
//
// Τρέξε: node scripts/guard-assistant-name.mjs
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOTS = ['app', 'components', 'supabase/functions', 'lib']

// ── ΠΗΓΕΣ ΤΩΝ ΚΑΝΟΝΩΝ: ΑΝΑΦΕΡΟΥΝ ΕΠΙΤΗΔΕΣ ΤΙΣ ΑΠΑΓΟΡΕΥΜΕΝΕΣ ΛΕΞΕΙΣ ──────────
// Το lib/assistant/identity.ts ορίζει τους RULES και το PERSONA_BRIEF, οπότε
// γράφει τις απαγορευμένες διατυπώσεις για να τις απαγορεύσει. Τα ορατά του
// κείμενα (tagline, askCta, noKeyNotice και τα υπόλοιπα) τα ελέγχει το
// identity.test.ts με το identityProblems, ένα προς ένα (UI_STRINGS). ΠΡΟΣΟΧΗ:
// νέο ορατό κείμενο εκεί πρέπει να μπει και στο UI_STRINGS, αλλιώς δεν το
// ελέγχει κανείς από τους δύο.
//
// Τα τεστ του lib/ παραλείπονται για τον ίδιο λόγο: δοκιμάζουν τους κανόνες με
// τις απαγορευμένες φράσεις. Τα τεστ σε app/, components/ και supabase/functions/
// σαρώνονταν πάντα και συνεχίζουν να σαρώνονται.
const RULE_SOURCES = new Set(['lib/assistant/identity.ts'])
const isLibTest = rel => rel.startsWith('lib/') && /\.test\.m?[jt]sx?$/.test(rel)
const EXT = ['.ts', '.tsx', '.js', '.jsx', '.mjs']

// ── ALLOWLIST: αρχεία ελεγμένα με το χέρι, με τον λόγο τους ─────────────────
// Κάθε γραμμή είναι χρέος, όχι εξαίρεση για πάντα.
const ALLOWLIST = {
  // Άλλοι agents δουλεύουν ΤΩΡΑ σε αυτά τα αρχεία. Οι παραβιάσεις τους είναι
  // καταγεγραμμένες και θα διορθωθούν από τον κάτοχο του κάθε αρχείου. Κάποια
  // είναι αυτή τη στιγμή καθαρά και παραμένουν επίτηδες: γράφονται παράλληλα και
  // δεν θέλουμε ένα κοινό build να πέφτει σε αλλαγή που δεν ελέγχει αυτός εδώ.
  // «Σάρωση Απόδειξης με AI» (γρ. 344): σκέτο «AI», που ο guard δεν επιβάλλει
  // (δες παραπάνω). Μένει καταγεγραμμένο ως χρέος του κατόχου του αρχείου.
  'app/dashboard/components/TabBills.tsx': 'ξένο αρχείο (άλλος agent)',
  'app/dashboard/components/BillsDashboard.tsx': 'ξένο αρχείο (άλλος agent)',
  'app/dashboard/components/BillsCommon.tsx': 'ξένο αρχείο (άλλος agent)',
  'app/dashboard/components/BillsElectricity.tsx': 'ξένο αρχείο (άλλος agent)',
  'app/dashboard/components/BillsGas.tsx': 'ξένο αρχείο (άλλος agent)',
  'app/dashboard/components/BillsInsurance.tsx': 'ξένο αρχείο (άλλος agent)',
  'app/dashboard/components/BillsProviders.tsx': 'ξένο αρχείο (άλλος agent)',
  'app/dashboard/components/BillsServices.tsx': 'ξένο αρχείο (άλλος agent)',
  'app/dashboard/components/BillsBudget.tsx': 'ξένο αρχείο (άλλος agent)',
  'app/dashboard/components/BillsPDFExport.tsx': 'ξένο αρχείο (άλλος agent)',
  'app/dashboard/components/BillsSettings.tsx': 'ξένο αρχείο (άλλος agent)',
  'app/dashboard/components/ExpenseLedger.tsx': 'ξένο αρχείο (άλλος agent)',
  'app/dashboard/components/ExpenseAnalytics.tsx': 'ξένο αρχείο (άλλος agent)',
  'app/dashboard/components/BudgetVaults.tsx': 'ξένο αρχείο (άλλος agent)',
  'app/dashboard/components/TabAccounting.tsx': 'ξένο αρχείο (άλλος agent)',

  // Η αρχική, τα πάνελ της και η σελίδα εμπιστοσύνης βγήκαν από εδώ: λένε πλέον
  // «Νόα» παντού και ο φύλακας τις κρατά έτσι.
  // Δημόσιες σελίδες & νομικά κείμενα: αλλάζουν με έγκριση marketing/νομικών,
  // όχι με refactor. Το «AI» εκεί είναι νομικά ουσιώδες (ποιος επεξεργάζεται
  // τα δεδομένα), δεν είναι ονομασία προϊόντος.
  'app/AuthAside.tsx': 'οθόνη σύνδεσης — κείμενο marketing',
  'app/privacy/page.tsx': 'πολιτική απορρήτου — νομικό κείμενο, αλλάζει με έγκριση',
  'app/terms/page.tsx': 'όροι χρήσης — νομικό κείμενο, αλλάζει με έγκριση',
  'app/about/page.tsx': 'ποιοι είμαστε — κείμενο marketing',

  // Κείμενο ΠΡΟΣ ΤΟ ΜΟΝΤΕΛΟ, όχι προς τον χρήστη: το system prompt και τα τεστ
  // του αναφέρουν επίτηδες τις απαγορευμένες λέξεις για να τις απαγορεύσουν.
  'app/dashboard/components/assistantPersona.test.ts': 'τεστ: αναφέρει επίτηδες απαγορευμένες διατυπώσεις',
}

// ── ΟΙ ΚΑΝΟΝΕΣ (ίδια id με lib/assistant/identity.ts) ───────────────────────
// Τρέχουν πάνω σε κανονικοποιημένο κείμενο: πεζά ΧΩΡΙΣ τόνους. Χωρίς αυτό, το
// «ΒΟΗΘΟΣ» σε κεφαλαία (που χάνει τον τόνο) ξεφεύγει από κάθε /βοηθός/i.
const GENDERED_ARTICLE = '(?:ο|η|τον|την|του|της|στον|στην|στου|στης)'
const HELPER_NOUN = 'βοηθ(?:ος|ο|ου|οι|ους|ων)(?![\\p{L}])'
const NOA = '(?<![\\p{L}])νοας?(?![\\p{L}])'
const GAP = '[\\s,:·–—-]+'
const GREEK = '\\p{Script=Greek}'

const RULES = [
  {
    id: 'smart-suggestions',
    // \w είναι ASCII-only: για ελληνικές καταλήξεις χρειάζεται \p{L}.
    re: /εξυπν\p{L}*\s+προτασ\p{L}*/gu,
    why: '«Έξυπνες Προτάσεις»: δεύτερο brand για το ίδιο πράγμα.',
    instead: 'suggestionsTitle() από lib/assistant/identity.ts → «Νόα · Προτάσεις»',
  },
  {
    id: 'ai-assistant',
    re: new RegExp(`(?:\\bai\\s+assistant\\b|\\bai\\s+${HELPER_NOUN}|${HELPER_NOUN}\\s+ai\\b|\\bassistant\\s+ai\\b)`, 'gu'),
    why: '«AI Assistant» / «Βοηθός AI»: τεχνολογία στη θέση της ταυτότητας.',
    instead: 'ASSISTANT_NAME → «Νόα»',
  },
  {
    id: 'gendered-assistant',
    re: new RegExp(`(?:(?<![\\p{L}])${GENDERED_ARTICLE}\\s+${HELPER_NOUN}|${HELPER_NOUN}\\s+(?:σου|σας|μου|μας)(?![\\p{L}]))`, 'gu'),
    why: 'Το «ο/η βοηθός» δίνει γένος και σβήνει το όνομα.',
    instead: 'ASSISTANT_NAME ή askCta() → «Ρώτα τη Νόα»',
  },
  {
    // Το «χωρίς τη Νόα ... δωρεάν» ΔΕΝ πιάνεται: το δωρεάν πακέτο ΕΙΝΑΙ χωρίς
    // τη Νόα και αυτό το λένε οι Όροι, η τιμολόγηση και τα email. Ούτε το
    // «βοηθά/βοηθάει»: ρήμα, όχι ουσιαστικό.
    id: 'noa-label',
    re: new RegExp([
      `(?<![\\p{L}])${HELPER_NOUN}${GAP}(?:(?:η|τη|την|της)\\s+)?${NOA}`,
      `${NOA}${GAP}(?:\\p{L}+\\s+){0,3}?${HELPER_NOUN}`,
      `(?<![\\p{L}])δωρεαν\\s+(?:(?:η|τη|την|της)\\s+)?${NOA}`,
      `(?<!χωρις\\s+(?:(?:τη|την)\\s+)?)${NOA}\\s+(?:ειναι\\s+)?δωρεαν(?![\\p{L}])`,
    ].join('|'), 'gu'),
    why: 'Η Νόα δεν λέγεται «βοηθός» και δεν λέγεται «δωρεάν»: το όνομα είναι όλη η ταυτότητα.',
    instead: 'σκέτο το όνομα: «Νόα», «Η Νόα απαντά», «τη Νόα»',
  },
  {
    id: 'robot-talk',
    // Το «bot» ΕΙΝΑΙ και έγκυρο όνομα μεταβλητής (`const bot = 56` υπάρχει στο
    // BillsBudget.tsx), οπότε το όριο λέξης δεν αρκεί: απαιτούμε ελληνικό κείμενο
    // δίπλα του — αυτό ξεχωρίζει την πρόταση από τον κώδικα.
    re: new RegExp(`(?:${GREEK}[^\\p{L}]{0,3}bots?(?![\\p{L}])|(?<![\\p{L}])bots?[^\\p{L}]{0,3}${GREEK}|ρομποτ(?![\\p{L}]))`, 'gu'),
    why: '«bot» / «ρομπότ» στο ορατό κείμενο ακυρώνει την ταυτότητα.',
    instead: 'Νόα',
  },
]

// ── Αφαίρεση σχολίων ────────────────────────────────────────────────────────
// Μηχανή καταστάσεων αντί για regex: ένα /* μέσα σε συμβολοσειρά ή ένα // μέσα
// σε URL δεν είναι σχόλιο και ένα regex literal μπορεί να περιέχει εισαγωγικά.
// Τα σχόλια αντικαθίστανται με κενά ΙΔΙΟΥ ΜΗΚΟΥΣ, ώστε οι αριθμοί γραμμής να
// μένουν ακριβείς (το invariant ελέγχεται: μήκος εισόδου == μήκος εξόδου).
//
// ΠΡΟΣΟΧΗ ΣΤΟ ΑΠΟΣΤΡΟΦΟ: σε JSX το κείμενο ΔΕΝ είναι σε εισαγωγικά και τα
// ελληνικά έχουν αποστρόφους («κάν' το», «γι' αυτό»). Αν το ' θεωρηθεί αρχή
// συμβολοσειράς, η μηχανή αποσυγχρονίζεται για δεκάδες γραμμές και παύει να
// βλέπει τα επόμενα σχόλια. Γι' αυτό τα ' και " ΔΕΝ περνούν αλλαγή γραμμής:
// αν δεν κλείσουν στην ίδια γραμμή, το σύμβολο ήταν απόστροφος, όχι εισαγωγικό.
const REGEX_MAY_START_AFTER = '(,=:[!&|?{};+-*%^~<>'

function stripComments(src) {
  let out = ''
  let i = 0
  const n = src.length
  let prevSignificant = ''   // τελευταίο μη-κενό σύμβολο, για τα regex literals
  while (i < n) {
    const c = src[i], next = src[i + 1]
    // γραμμικό σχόλιο
    if (c === '/' && next === '/') {
      while (i < n && src[i] !== '\n') { out += ' '; i++ }
      continue
    }
    // μπλοκ σχόλιο (κρατά τις αλλαγές γραμμής, ώστε να μη μετακινηθούν οι γραμμές)
    if (c === '/' && next === '*') {
      out += '  '; i += 2
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { out += src[i] === '\n' ? '\n' : ' '; i++ }
      if (i < n) { out += '  '; i += 2 }
      continue
    }
    // template literal: το μόνο που επιτρέπεται να περνά γραμμές
    if (c === '`') {
      out += c; i++
      while (i < n) {
        if (src[i] === '\\') { out += src[i] + (src[i + 1] ?? ''); i += 2; continue }
        if (src[i] === '`') { out += src[i]; i++; break }
        out += src[i]; i++
      }
      prevSignificant = '`'
      continue
    }
    // '…' και "…": μόνο μέσα στην ίδια γραμμή (αλλιώς ήταν απόστροφος)
    if (c === '"' || c === "'") {
      let j = i + 1, closed = false
      while (j < n && src[j] !== '\n') {
        if (src[j] === '\\') { j += 2; continue }
        if (src[j] === c) { closed = true; j++; break }
        j++
      }
      if (closed) { out += src.slice(i, j); i = j; prevSignificant = c; continue }
      // δεν έκλεισε στη γραμμή → απλός χαρακτήρας κειμένου
    }
    // regex literal: μόνο εκεί που μπορεί συντακτικά να ξεκινήσει
    if (c === '/' && (prevSignificant === '' || REGEX_MAY_START_AFTER.includes(prevSignificant))) {
      let j = i + 1, inClass = false, closed = false
      while (j < n && src[j] !== '\n') {
        const ch = src[j]
        if (ch === '\\') { j += 2; continue }
        if (ch === '[') inClass = true
        else if (ch === ']') inClass = false
        else if (ch === '/' && !inClass) { j++; closed = true; break }
        j++
      }
      if (closed) { out += src.slice(i, j); i = j; prevSignificant = '/'; continue }
      // δεν ήταν regex — συνέχισε κανονικά
    }
    if (!/\s/.test(c)) prevSignificant = c
    out += c
    i++
  }
  return out
}

const normalize = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

function walk(dir, out) {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry === '.git') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (EXT.some(e => entry.endsWith(e))) out.push(full)
  }
}

const files = []
for (const r of ROOTS) walk(r, files)
files.sort()

const failures = []   // παραβιάσεις που ρίχνουν το build
const pending = []    // παραβιάσεις σε αρχεία του ALLOWLIST

let skipped = 0
for (const file of files) {
  const rel = file.split('\\').join('/')
  if (RULE_SOURCES.has(rel) || isLibTest(rel)) { skipped++; continue }
  const src = readFileSync(file, 'utf8')
  const code = stripComments(src)
  // Αν σπάσει αυτό, οι αριθμοί γραμμής ψεύδονται — προτιμότερο να σκάσει τώρα.
  if (code.length !== src.length) {
    console.error(`guard: εσωτερικό σφάλμα — μετατόπιση γραμμών στο ${file}`)
    process.exit(2)
  }
  const rawLines = src.split('\n')
  const lines = code.split('\n')
  for (let li = 0; li < lines.length; li++) {
    const norm = normalize(lines[li])
    if (!norm.trim()) continue
    for (const rule of RULES) {
      rule.re.lastIndex = 0
      const m = rule.re.exec(norm)
      if (!m) continue
      const hit = { file: rel, line: li + 1, match: m[0], rule, text: (rawLines[li] || '').trim().slice(0, 160) }
      if (ALLOWLIST[rel]) pending.push(hit)
      else failures.push(hit)
    }
  }
}

const RESET = '\x1b[0m', RED = '\x1b[31m', DIM = '\x1b[2m', BOLD = '\x1b[1m', YEL = '\x1b[33m'

if (pending.length) {
  console.log(`${YEL}⚠ ${pending.length} γνωστές εκκρεμότητες σε αρχεία του allowlist (δεν ρίχνουν το build):${RESET}`)
  for (const p of pending) {
    console.log(`  ${DIM}${p.file}:${p.line}${RESET}  «${p.match}»  ${DIM}[${p.rule.id}] — ${ALLOWLIST[p.file]}${RESET}`)
  }
  console.log('')
}

if (failures.length) {
  console.error(`${RED}${BOLD}✗ Η ταυτότητα του βοηθού είναι μία: Νόα. ${failures.length} ${failures.length === 1 ? 'παραβίαση' : 'παραβιάσεις'}:${RESET}\n`)
  for (const f of failures) {
    console.error(`  ${BOLD}${f.file}:${f.line}${RESET}  «${f.match}»`)
    console.error(`     ${DIM}${f.text}${RESET}`)
    console.error(`     ${f.rule.why}`)
    console.error(`     → Γράψε: ${f.rule.instead}\n`)
  }
  console.error(`${DIM}Τα σταθερά κείμενα βγαίνουν από lib/assistant/identity.ts. Μη γράφεις το όνομα με το χέρι.${RESET}`)
  process.exit(1)
}

console.log(`✓ Νόα: ${files.length - skipped} αρχεία σε ${ROOTS.join('/ και ')}/ — καμία παραβίαση ταυτότητας.`)
if (pending.length) console.log(`${DIM}  (${pending.length} εκκρεμότητες σε ${new Set(pending.map(p => p.file)).size} αρχεία του allowlist)${RESET}`)
