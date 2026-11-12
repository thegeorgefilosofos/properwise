#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΚΑΝΕΝΑΣ ΚΑΝΟΝΑΣ ΕΚΤΕΛΕΣΗΣ ΧΩΡΙΣ ΔΥΟ ΠΗΓΕΣ, ΚΑΜΙΑ ΥΠΟΓΡΑΦΗ ΔΙΚΗΓΟΡΟΥ ΠΟΥ ΔΕΝ ΔΟΘΗΚΕ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ, ΜΕΤΡΗΜΕΝΟ (12/11/2026). Η έρευνα για την Προστασία ιδιοκτήτη
// βρήκε στον ίδιο τον κώδικα κείμενο που είχε πάψει να ισχύει («πρόταση
// ρύθμισης πριν από κάθε πλειστηριασμό», ενώ ο ν. 5354/2026 τη θέλει μία φορά)
// και ένα λάθος που θα έδινε πλειστηριασμό ακινήτου δύο μήνες νωρίτερα (954 §2ε
// των κινητών αντί για 993 §2). Σε εργαλείο που δίνει προθεσμίες σε ανθρώπους
// που κινδυνεύουν να χάσουν το σπίτι τους, ένα απόσπασμα «διορθωμένο» με το χέρι
// ή μια σήμανση «ελέγχθηκε από δικηγόρο» χωρίς δικηγόρο είναι ζημία, όχι ύφος.
//
// ΤΙ ΕΛΕΓΧΕΤΑΙ, ΑΚΡΙΒΩΣ (απόφαση ιδιοκτήτη 12/11/2026, δύο βαθμίδες):
//   1. Κάθε κανόνας 'verified' του lib/legal/enforcement/rules.ts έχει τουλάχιστον
//      μία επίσημη και μία ανεξάρτητη πηγή, σε διαφορετικές διευθύνσεις, με
//      title, url, checkedAt, snapshot και απόσπασμα· verifier 'properwise-team'.
//   2. Κάθε τμήμα αποσπάσματος βρίσκεται αυτούσιο (μετά από κανονικοποίηση κενών
//      και εισαγωγικών) στο στιγμιότυπο της πηγής του.
//   3. `lawyerReviewed`: ή null ή {reviewer μη κενό, reviewedAt ΕΕΕΕ-ΜΜ-ΗΗ,
//      version ίσο με του κανόνα}. Και κανένα αρχείο έξω από το rules.ts δεν
//      γράφει τιμή στο `lawyerReviewed` (οι δοκιμές εξαιρούνται: φτιάχνουν
//      αντίγραφα για να ελέγξουν την πύλη).
//   4. Κάθε `rule('…')` σε οθόνη ή στη μηχανή δείχνει σε κανόνα που υπάρχει.
//   6. Κάθε αριθμός των `params` (count, countTo, percent, was) βρίσκεται, με
//      ψηφία ή ολογράφως, στο απόσπασμα μιας επίσημης ΚΑΙ μιας ανεξάρτητης
//      πηγής· κάθε `date` ως «Η.Μ.ΕΕΕΕ» στο απόσπασμα· κάθε `since` ως ημερομηνία
//      ΦΕΚ στο `amendedBy`. Ο έλεγχος 12/11/2026 άλλαξε το 70% της ελεύθερης
//      πώλησης σε 60% και τις 120 δόσεις σε 100: ο φύλακας έμεινε πράσινος.
//   5. Οι δύο σημάνσεις («Επαληθευμένο από επίσημες πηγές…», «Ελέγχθηκε από
//      δικηγόρο») γράφονται ΜΟΝΟ στο lib/legal/enforcement/badges.ts, η πρώτη
//      ακριβώς όπως την ενέκρινε ο ιδιοκτήτης· η οθόνη εισάγει τις σταθερές.
// ═══════════════════════════════════════════════════════════════════════════
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { gunzipSync } from 'node:zlib'
import { projectFiles } from './lib/git-files.mjs'

const RULES_FILE = 'lib/legal/enforcement/rules.ts'
const BADGES_FILE = 'lib/legal/enforcement/badges.ts'
const UI_DIR = 'app/dashboard/components/prostasia/'
const OWNER_BADGE = 'Επαληθευμένο από επίσημες πηγές · δεν αποτελεί νομική συμβουλή'
const BADGE_PHRASES = ['Επαληθευμένο από επίσημες πηγές', 'Ελέγχθηκε από δικηγόρο']

const provlimata = []
const add = (arxeio, grammi, ti) => provlimata.push({ arxeio, grammi, ti })

/** Ιδια κανονικοποίηση με το εργαλείο που έγραψε τα στιγμιότυπα. */
function norm(s) {
  return s.normalize('NFC')
    .replace(/­/g, '')
    .replace(/(\p{L})-\s*\n\s*(\p{L})/gu, '$1$2')
    .replace(/[‘’ʼ΄´'`]/g, "'")
    .replace(/[“”«»"]/g, '"')
    .replace(/[–—‒]/g, '-')
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(').replace(/\s+\)/g, ')')
    .replace(/(\d)\s*η\s*\.\s*(\d)/g, '$1η.$2')
    .trim()
}

// ── 1 έως 3: το μητρώο, όπως το βλέπει η μηχανή ─────────────────────────
// ΕΞΩ ΑΠΟ ΤΟ ΑΠΟΘΕΤΗΡΙΟ: οι φύλακες τρέχουν παράλληλα και ένα προσωρινό αρχείο
// μέσα στο scripts/ το έβλεπε άλλος φύλακας και έσπαγε όταν αυτό έσβηνε.
const probe = `
import { RULES } from ${JSON.stringify(resolve('lib/legal/enforcement/rules.ts'))}
process.stdout.write(JSON.stringify(RULES))
`
const dir = mkdtempSync(join(tmpdir(), 'enforcement-probe-'))
const tmp = join(dir, 'probe.ts')
let rules
try {
  writeFileSync(tmp, probe)
  rules = JSON.parse(execFileSync('npx', ['--yes', 'tsx', tmp], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }))
} catch (e) {
  console.error('✗ το μητρώο κανόνων δεν διαβάζεται:\n' + (e.stderr || e.message))
  process.exit(1)
} finally {
  try { unlinkSync(tmp); rmSync(dir, { recursive: true, force: true }) } catch {}
}

const ISO = /^\d{4}-\d{2}-\d{2}$/
/** Τα αριθμητικά όπως τα γράφει ο νόμος, σε όποια πτώση φτάνει στα αποσπάσματα. */
const WORDS = {
  1: ['ένα', 'μία', 'μιας'], 2: ['δύο'], 3: ['τρεις', 'τρία', 'τριών'], 4: ['τέσσερις', 'τεσσάρων'], 5: ['πέντε'],
  6: ['έξι'], 7: ['επτά'], 8: ['οκτώ'], 9: ['εννέα'], 10: ['δέκα'], 15: ['δεκαπέντε'], 20: ['είκοσι'],
  30: ['τριάντα'], 45: ['σαράντα πέντε'], 60: ['εξήντα'], 70: ['εβδομήντα'], 72: ['εβδομήντα δύο'], 120: ['εκατόν είκοσι'],
}
const hasNumber = (text, n) => new RegExp(`(?<!\\d)${n}(?!\\d)`).test(text)
  || (WORDS[n] ?? []).some(w => new RegExp(`(?<![\\p{L}])${w}(?![\\p{L}])`, 'u').test(text))
const hasDate = (text, iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new RegExp(`(?<!\\d)0?${d}\\S{0,3}\\.0?${m}\\.${y}(?!\\d)`).test(text)
}
const snapshots = new Map()
for (const r of rules) {
  const where = `${RULES_FILE} [${r.id}]`
  if (r.lawyerReviewed !== null) {
    const l = r.lawyerReviewed
    if (!l || typeof l.reviewer !== 'string' || !l.reviewer.trim()) add(where, 0, 'lawyerReviewed χωρίς όνομα ή κωδικό δικηγόρου')
    if (!l || !ISO.test(l.reviewedAt ?? '')) add(where, 0, 'lawyerReviewed χωρίς ημερομηνία ΕΕΕΕ-ΜΜ-ΗΗ')
    if (!l || l.version !== r.version) add(where, 0, `lawyerReviewed για έκδοση ${l?.version}, ο κανόνας είναι στην ${r.version}`)
  }
  if (r.status !== 'verified') continue
  if (r.verifier !== 'properwise-team') add(where, 0, `verifier «${r.verifier}» αντί για 'properwise-team'`)
  const off = r.sources.filter(s => s.kind === 'official')
  const ind = r.sources.filter(s => s.kind === 'independent')
  if (!off.length || !ind.length) add(where, 0, 'επαληθευμένος χωρίς επίσημη ΚΑΙ ανεξάρτητη πηγή')
  else if (!off.some(o => ind.some(i => i.url !== o.url))) add(where, 0, 'οι δύο πηγές έχουν την ίδια διεύθυνση')
  // 6: οι αριθμοί των params στα αποσπάσματα (μία επίσημη ΚΑΙ μία ανεξάρτητη)
  const texts = kind => r.sources.filter(s => s.kind === kind).map(s => norm((s.excerpt ?? []).join(' ')))
  const inBoth = test => texts('official').some(test) && texts('independent').some(test)
  for (const k of ['count', 'countTo', 'percent', 'was']) {
    const n = r.params?.[k]
    if (typeof n === 'number' && !inBoth(t => hasNumber(t, n))) add(where, 0, `ο αριθμός ${k}=${n} δεν βρίσκεται στο απόσπασμα επίσημης και ανεξάρτητης πηγής`)
  }
  if (r.params?.date && !inBoth(t => hasDate(t, r.params.date))) add(where, 0, `η ημερομηνία ${r.params.date} δεν βρίσκεται στο απόσπασμα επίσημης και ανεξάρτητης πηγής`)
  if (r.params?.since) {
    const [y, m, d] = r.params.since.split('-')
    if (!r.amendedBy.includes(`${d}.${m}.${y}`)) add(where, 0, `το since ${r.params.since} δεν είναι η ημερομηνία του ΦΕΚ στο amendedBy`)
  }
  for (const s of r.sources) {
    for (const k of ['title', 'url', 'snapshot', 'checkedAt']) if (!s[k]) add(where, 0, `πηγή χωρίς ${k}`)
    if (s.url && !/^https:\/\//.test(s.url)) add(where, 0, `πηγή χωρίς https: ${s.url}`)
    if (!Array.isArray(s.excerpt) || !s.excerpt.length) { add(where, 0, `πηγή χωρίς απόσπασμα: ${s.title}`); continue }
    if (!s.snapshot || !existsSync(s.snapshot)) { add(where, 0, `λείπει το στιγμιότυπο ${s.snapshot}`); continue }
    if (!snapshots.has(s.snapshot)) {
      const buf = readFileSync(s.snapshot)
      const raw = (s.snapshot.endsWith('.gz') ? gunzipSync(buf) : buf).toString('utf8')
      const body = raw.includes('\n---\n') ? raw.slice(raw.indexOf('\n---\n') + 5) : raw
      snapshots.set(s.snapshot, norm(body))
    }
    const hay = snapshots.get(s.snapshot)
    for (const seg of s.excerpt) {
      if (!hay.includes(norm(seg))) add(where, 0, `το απόσπασμα «${seg.slice(0, 60)}…» δεν βρίσκεται στο ${s.snapshot}`)
    }
  }
}

// ── 3: καμία υπογραφή δικηγόρου γραμμένη έξω από το μητρώο ─────────────
const code = projectFiles("'app/**/*.ts' 'app/**/*.tsx' 'lib/**/*.ts' 'lib/**/*.tsx' 'components/**/*.tsx' 'components/**/*.ts' 'scripts/**/*.mjs'")
  .filter(f => !/\.test\.tsx?$/.test(f) && f !== 'scripts/guard-enforcement-rules.mjs' && f !== 'scripts/lib/mutations.mjs')
const ALLOWED_REVIEW = new Set([RULES_FILE, 'lib/legal/enforcement/types.ts'])
for (const f of code) {
  const lines = readFileSync(f, 'utf8').split('\n')
  lines.forEach((line, n) => {
    const t = line.trim()
    if (t.startsWith('//') || t.startsWith('*')) return
    if (!ALLOWED_REVIEW.has(f) && /lawyerReviewed\s*(?::(?!\s*(?:LawyerReview|null)\b)|=(?!=))/.test(line)) add(f, n + 1, 'γράφει τιμή στο lawyerReviewed έξω από το rules.ts')
    if (f !== BADGES_FILE) for (const p of BADGE_PHRASES) if (line.includes(p)) add(f, n + 1, `η σήμανση «${p}» γραμμένη με το χέρι· εισήγαγε τη σταθερά από το badges.ts`)
  })
}
// Στο ίδιο το rules.ts, κάθε `lawyerReviewed:` είναι null ή αντικείμενο που
// έλεγξε το 1–3 παραπάνω· ο έλεγχος γίνεται στην τιμή, όχι στο κείμενο.

// ── 4: κάθε rule('…') δείχνει σε κανόνα που υπάρχει ─────────────────────
const ids = new Set(rules.map(r => r.id))
for (const f of code.filter(f => f.startsWith(UI_DIR) || f.startsWith('lib/legal/enforcement/'))) {
  readFileSync(f, 'utf8').split('\n').forEach((line, n) => {
    for (const m of line.matchAll(/\brule\('([a-z0-9-]+)'\)/g)) if (!ids.has(m[1])) add(f, n + 1, `άγνωστος κανόνας «${m[1]}»`)
  })
}

// ── 5: οι σημάνσεις ─────────────────────────────────────────────────────
if (!existsSync(BADGES_FILE)) add(BADGES_FILE, 0, 'λείπει το αρχείο των σημάνσεων')
else {
  const b = readFileSync(BADGES_FILE, 'utf8')
  const m = /export const VERIFIED_BADGE = '([^']*)'/.exec(b)
  if (!m || m[1] !== OWNER_BADGE) add(BADGES_FILE, 0, `το VERIFIED_BADGE δεν είναι η διατύπωση που ενέκρινε ο ιδιοκτήτης («${OWNER_BADGE}»)`)
}
const ui = code.filter(f => f.startsWith(UI_DIR) && f.endsWith('.tsx'))
// Η οθόνη δείχνει τη σήμανση είτε απευθείας είτε μέσω των itemBadge/cardBadge
// του badges.ts, που διαλέγουν ανάμεσα στις τρεις σταθερές κατά βαθμίδα (12/11/2026).
if (!ui.some(f => /\bVERIFIED_BADGE\b|\bitemBadge\(|\bcardBadge\(/.test(readFileSync(f, 'utf8')))) add(UI_DIR, 0, 'καμία οθόνη της Προστασίας δεν δείχνει το VERIFIED_BADGE')

if (provlimata.length) {
  console.error(`\n✗ ${provlimata.length} προβλήματα στους κανόνες της Προστασίας ιδιοκτήτη:\n`)
  for (const p of provlimata.slice(0, 30)) console.error(`  ${p.arxeio}:${p.grammi}  «${p.ti}»`)
  if (provlimata.length > 30) console.error(`  … και ${provlimata.length - 30} ακόμη`)
  console.error('\n  ΤΙ ΝΑ ΚΑΝΕΙΣ: κανόνας χωρίς δύο πηγές γίνεται status \'withheld\' (καμία ημερομηνία)·')
  console.error('  απόσπασμα που δεν βρίσκεται: ξανακατέβασε την πηγή, μην το διορθώνεις με το χέρι·')
  console.error('  υπογραφή δικηγόρου: μόνο στο rules.ts, με κωδικό, ημερομηνία και την έκδοση του κανόνα·')
  console.error('  σημάνσεις: εισήγαγε VERIFIED_BADGE / LAWYER_BADGE από το lib/legal/enforcement/badges.ts.\n')
  process.exit(1)
}
const verified = rules.filter(r => r.status === 'verified').length
console.log(`✓ ${verified} επαληθευμένοι κανόνες με δύο πηγές και αυτούσια αποσπάσματα, ${rules.length - verified} χωρίς ημερομηνία· καμία υπογραφή δικηγόρου χωρίς όνομα και ημερομηνία`)
