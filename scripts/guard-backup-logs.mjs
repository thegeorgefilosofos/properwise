#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΚΑΜΙΑ ΒΑΣΗ ΣΤΙΣ ΡΟΕΣ ΔΕΝ ΓΡΑΦΕΙ ΣΤΟ ΔΗΜΟΣΙΟ LOG
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ (11/11/2026). Η πρώτη εκτέλεση της δοκιμής επαναφοράς
// (backup-restore-drill.yml, από το #521) έτρεχε τον Postgres ως `services:`
// container. Οι εντολές του auth/storage απέτυχαν σε γυμνό Postgres και ο
// διακομιστής έγραψε κάθε αποτυχημένη εντολή ολόκληρη στο log του. Το GitHub
// τυπώνει το log κάθε service container στο «Stop containers»· τα logs του
// αποθετηρίου είναι ΔΗΜΟΣΙΑ: στο log βγήκαν γραμμές του auth (συνεδρίες,
// δεύτεροι παράγοντες, διακριτικά μίας χρήσης, email, IP) και διαδρομές του
// storage. Η έξοδος του ΙΔΙΟΥ του psql πήγαινε σωστά σε αρχείο· η διαρροή ήταν
// από τον διακομιστή, εκεί που κανείς δεν κοίταζε. Τα logs σβήστηκαν με το χέρι.
//
// ΠΟΥ ΚΟΙΤΑ. Τα .github/workflows/*.yml, το scripts/backup/** και ΚΑΘΕ αρχείο
// του scripts/ που αναφέρει μια ροή: ένα σενάριο που καλεί μια ροή τυπώνει στο
// ίδιο δημόσιο log με τη ροή.
//
// ΤΙ ΕΛΕΓΧΕΤΑΙ
//   1. `services:` σε ροή με secrets εκτός του GITHUB_TOKEN ή με δείκτες
//      πραγματικής βάσης· και παντού όταν η εικόνα μοιάζει με Postgres, ή είναι
//      `${{ … }}` σε ροή με οποιοδήποτε secret. Το log ενός service container το
//      τυπώνει το GitHub και δεν κλείνει με καμία ρύθμιση.
//   2. Κάθε εκκίνηση container: `docker [container] run|create` θέλει
//      `--log-driver none`· με Postgres και `log_min_error_statement=panic`,
//      `log_statement=none`. Το `docker start`, το `docker compose up` και το
//      `supabase start` δεν παίρνουν οδηγό log: θέλουν ρητή εξαίρεση (κάτω).
//   3. psql / pg_restore / pg_dump / pg_dumpall και ό,τι τα καλεί: συνάρτηση-
//      περιτύλιγμα, μεταβλητή (`PSQL="psql …"; $PSQL …`), `bash -c '… psql …'`,
//      `su … -c "…"`, `eval "psql …"`, `node -e`/`python -c` που τα αναφέρουν.
//        · stderr ΜΟΝΟ στο /dev/null ή σε σωλήνα προς μετρητή (`wc -l`,
//          `grep -c`, `awk` που τυπώνει μόνο έναν αριθμό). Όχι σε αρχείο, όχι σε
//          μεταβλητή, όχι `|| cat`.
//        · stdout στο /dev/null, σε `$( )` ή σε αρχείο. Αρχείο που διαβάζεται
//          αργότερα από οτιδήποτε εκτός από μετρητή (`wc -l`, `grep -c`,
//          `test -s`) είναι διαρροή· μεταβλητή που τυπώνεται (`echo`, `printf`,
//          `cat <<<`, `tee`, `>&2`, `::notice::`, `$GITHUB_STEP_SUMMARY`,
//          `$GITHUB_OUTPUT`, `$GITHUB_ENV`) επίσης.
//        · Ελεύθερα: `--version`, `--help`, `which`, `command -v`.
//   4. Όχι xtrace σε καμία μορφή (`set -x`, `set -euxo`, `set -o xtrace`,
//      `bash -x script`, `shell: bash -x {0}`, `SHELLOPTS`), όχι `docker logs`,
//      όχι `supabase --debug`, όχι `pg_dump --verbose`. Το `set`/`bash` κρίνεται
//      μόνο ως λέξη-εντολή: `find -name *.sh -exec`, `git config set -x` δεν
//      μετρούν.
//   5. Σενάριο JS/TS που καλεί μια ροή και τρέχει psql/pg_dump/pg_restore ή
//      `supabase db|start` ως υποδιεργασία: θέλει ρητή εξαίρεση.
//
// ΡΗΤΗ ΕΞΑΙΡΕΣΗ, ΜΕ ΛΟΓΟ. `# log-guard: allow — <γιατί>` (ή `//` σε JS) στην
// ίδια γραμμή ή στην αμέσως προηγούμενη ισχύει για τους κανόνες 2, 3 και 5,
// ΠΟΤΕ για εντολή με δείκτη πραγματικής βάσης (REAL_DB). Το πλήθος τους
// τυπώνεται σε κάθε πράσινο.
// `# log-guard: synthetic-db — <γιατί>` στις 10 πρώτες γραμμές ενός σεναρίου
// εξαιρεί όλο το αρχείο από τον κανόνα 3, μόνο αν: το αρχείο δεν έχει κανέναν
// δείκτη πραγματικής βάσης ΚΑΙ καμία δουλειά ροής που το καλεί δεν έχει
// secret (πλην GITHUB_TOKEN) ή μεταβλητή PG*. Οι κανόνες 1 και 4 δεν
// εξαιρούνται ποτέ.
//
// Σχόλια (#) και κείμενα μέσα σε εισαγωγικά δεν μετρούν ως εντολές, εκτός από
// το όρισμα ενός `-c`, ένα `$( )` και ό,τι δίνεται σε `eval`.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from 'node:fs'
import { projectFiles } from './lib/git-files.mjs'

const workflows = projectFiles("'.github/workflows/*.yml' '.github/workflows/*.yaml'")
const referenced = new Set()
for (const wf of workflows) {
  for (const m of readFileSync(wf, 'utf8').matchAll(/\bscripts\/[\w./-]+\.(?:sh|bash|mjs|cjs|js|ts|mts)\b/g)) {
    if (existsSync(m[0])) referenced.add(m[0])
  }
}
const files = [...new Set([...workflows, ...projectFiles("'scripts/backup/**'"), ...referenced])]
  .filter(f => f !== 'scripts/guard-backup-logs.mjs').sort()

/** Τα εργαλεία που μιλούν με βάση και τυπώνουν εντολές ή τιμές σε σφάλμα. */
const DB_TOOLS = ['psql', 'pg_restore', 'pg_dump', 'pg_dumpall']

const provlimata = []
const add = (arxeio, grammi, ti) => provlimata.push({ arxeio, grammi, ti })

/** Το κλείσιμο ενός `$(` που ανοίγει στη θέση `i`, με εισαγωγικά και φωλιές. */
function closeParen(s, i) {
  let depth = 0
  for (let j = i; j < s.length; j++) {
    const c = s[j]
    if (c === '\\') { j++; continue }
    if (c === "'") { const e = s.indexOf("'", j + 1); if (e < 0) return s.length; j = e; continue }
    if (c === '"') {
      for (j++; j < s.length && s[j] !== '"'; j++) {
        if (s[j] === '\\') j++
        else if (s[j] === '$' && s[j + 1] === '(') j = closeParen(s, j + 1)
      }
      continue
    }
    if (c === '(') depth++
    else if (c === ')' && --depth === 0) return j
  }
  return s.length
}
/**
 * Το κείμενο χωρίς τα περιεχόμενα των εισαγωγικών: εντολές, όχι μηνύματα. Ένα
 * `$( … )` μέσα σε "…" ΜΕΝΕΙ: είναι εντολή (`x="$(psql …)"`).
 */
function bare(s) {
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '\\') { out += s.slice(i, i + 2); i++; continue }
    if (c === "'") { const e = s.indexOf("'", i + 1); out += "''"; i = e < 0 ? s.length : e; continue }
    if (c === '"') {
      out += '"'
      for (i++; i < s.length && s[i] !== '"'; i++) {
        if (s[i] === '\\') { i++; continue }
        if (s[i] === '$' && s[i + 1] === '(') { const e = closeParen(s, i + 1); out += `$(${bare(s.slice(i + 2, e))})`; i = e }
      }
      out += '"'
      continue
    }
    out += c
  }
  return out
}
/** Το όρισμα ενός `bash -c '…'` / `su x -c "…"` ανοίγει: είναι κι αυτό εντολή. */
const openDashC = s => s.replace(/(\b(?:ba|da|z)?sh\b[^'"\n]*?\s-[a-z]*c|\bsu\b[^'"\n]*?\s-c)\s+(['"])((?:\\.|(?!\2).)*)\2/g, (_, pre, _q, body) => `${pre} ${body}`)
const indent = s => s.length - s.trimStart().length
const ALLOW = /log-guard:\s*allow\s*[—–-]+\s*\S/
const SYNTHETIC = /log-guard:\s*synthetic-db\s*[—–-]+\s*\S/
/** Δείκτες ότι μια εντολή ή ένα αρχείο αγγίζει πραγματική βάση. */
const REAL_DB = /--linked\b|--db-url\b|--remote\b|\bPG(HOST|PASSWORD|SERVICE|USER|DATABASE)\b|DATABASE_URL|_DB_URL\b|\bSUPABASE_DB_PASSWORD\b|supabase\.com?\b|pooler\.supabase|postgres(ql)?:\/\/|\bsecrets\.(?!GITHUB_TOKEN\b)/
/** Secret εκτός του GITHUB_TOKEN, ή μεταβλητή PG*: η δουλειά μιλά με αληθινή βάση. */
const SECRETISH = /\bsecrets\.(?!GITHUB_TOKEN\b)\w|^\s*PG[A-Z]+\s*:/m
const DB_TOOLS_RE = '\\b(psql|pg_restore|pg_dump|pg_dumpall)\\b|\\bsupabase\\s+(db|migration)\\b'
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Τα κομμάτια ενός σωλήνα, έξω από εισαγωγικά, χωρίς να σπάει το `||`. */
function pipeSegments(s) {
  const out = []
  let cur = '', q = null
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (q) { if (c === q && s[i - 1] !== '\\') q = null; cur += c; continue }
    if (c === '"' || c === "'") { q = c; cur += c; continue }
    if (c === '|' && s[i + 1] !== '|' && s[i - 1] !== '|') { out.push(cur); cur = ''; if (s[i + 1] === '&') i++; continue }
    cur += c
  }
  out.push(cur)
  return out
}
/** Μετρητής: τυπώνει έναν αριθμό, ποτέ τη γραμμή που διάβασε. */
const counter = seg => /^\s*wc\s+-l\b/.test(seg) || /^\s*grep\s+-[a-zA-Z]*c/.test(seg)
  || (/^\s*awk\s+'([^']*)'/.test(seg) && (() => {
    const prog = /^\s*awk\s+'([^']*)'/.exec(seg)[1]
    const prints = prog.match(/\bprint[f]?\b[^;}]*/g) ?? []
    return !/\$\d|\$NF|\$0/.test(prog) && prints.length > 0 && prints.every(p => /^print\s+[A-Za-z_]\w*\s*(\+\s*0)?\s*$/.test(p.trim()))
  })())

/** Λέξη-εντολή: αρχή γραμμής (και `run:` του YAML), μετά από ; & | ( ` $( ή από exec/sudo/env/time/nohup. */
const CMD = String.raw`(?:^\s*(?:-\s+)?(?:run:\s*)?|[;&|(\x60]\s*|\$\(\s*|\b(?:exec|sudo|env|time|nohup|command)\s+)`
// Το `set` κρατά όλα του τα ορίσματα ως το `--`· ένα shell μόνο τις επιλογές
// πριν από το σενάριο (`sh ./install.sh -x` δεν είναι xtrace).
const XTRACE_SET = new RegExp(`${CMD}set\\b([^;&|]*)`, 'g')
const XTRACE_SH = new RegExp(`${CMD}(?:\\/usr)?(?:\\/bin\\/)?(?:ba|da|z)?sh((?:\\s+[-+][a-zA-Z]*o\\s+\\w+|\\s+[-+][a-zA-Z]+)*)`, 'g')
const traces = opts => {
  const o = opts.split(/\s--(\s|$)/)[0]
  return /(^|\s)-[a-wyzA-Z]*x/.test(o) || /(^|\s)-[a-zA-Z]*o\s+xtrace\b/.test(o)
}

/** Η δουλειά (job) μιας ροής που περιέχει τη γραμμή `i`: από τον τίτλο της ως την επόμενη. */
function jobBlock(lines, i) {
  const jobsAt = lines.findIndex(l => /^jobs:\s*$/.test(l))
  if (jobsAt < 0 || i < jobsAt) return lines.join('\n')
  let start = i
  while (start > jobsAt && !/^ {2}[\w-]+:\s*$/.test(lines[start])) start--
  let end = i + 1
  while (end < lines.length && !/^ {2}[\w-]+:\s*$/.test(lines[end]) && !/^\S/.test(lines[end])) end++
  const top = lines.slice(0, jobsAt).join('\n')
  return `${top}\n${lines.slice(start, end).join('\n')}`
}

/** Οι ροές που καλούν ένα σενάριο: έχει κάποια από αυτές secret ή PG* στη δουλειά της; */
function calledWithSecrets(script) {
  for (const wf of workflows) {
    const lines = readFileSync(wf, 'utf8').split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(script) && !lines[i].trim().startsWith('#') && SECRETISH.test(jobBlock(lines, i))) return `${wf}:${i + 1}`
    }
  }
  return null
}

const allows = new Set()

for (const arxeio of files) {
  const raw = readFileSync(arxeio, 'utf8')
  const lines = raw.split('\n')
  const workflow = arxeio.startsWith('.github/')
  // Η εξαίρεση δεν ισχύει ποτέ για εντολή με δείκτη πραγματικής βάσης.
  const allowed = (i, text = lines[i] ?? '') => {
    const hit = (ALLOW.test(lines[i] ?? '') || ALLOW.test(lines[i - 1] ?? '')) && !REAL_DB.test(text.replace(/#.*$/, ''))
    if (hit) allows.add(`${arxeio}:${ALLOW.test(lines[i] ?? '') ? i : i - 1}`)
    return hit
  }

  // 5. JS/TS: υποδιεργασία που μιλά με βάση
  if (/\.(mjs|cjs|js|ts|mts)$/.test(arxeio)) {
    lines.forEach((l, i) => {
      if (/^\s*(\/\/|\*)/.test(l)) return
      const spawnsDb = new RegExp(`(['"\`])\\s*(${DB_TOOLS.join('|')})(\\s|\\1)`).test(l) || /(['"`])supabase\1\s*,\s*\[\s*(['"`])(db|start)\2/.test(l)
      if (spawnsDb && /\b(exec|execSync|execFile|execFileSync|spawn|spawnSync|\$)\b|`/.test(l) && !allowed(i)) add(arxeio, i + 1, 'υποδιεργασία βάσης από σενάριο ροής χωρίς ρητή εξαίρεση')
    })
    continue
  }

  // 1. services:
  if (workflow) {
    const code = lines.filter(l => !l.trim().startsWith('#')).join('\n')
    const secretful = REAL_DB.test(code)
    const anySecret = /\bsecrets\./.test(code)
    lines.forEach((l, i) => {
      if (l.trim().startsWith('#') || !/(^|[\s{,])services\s*:/.test(bare(l))) return
      let block = l
      const base = indent(l)
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim() === '' || lines[j].trim().startsWith('#')) continue
        if (indent(lines[j]) <= base) break
        block += '\n' + lines[j]
      }
      if (/postgres|postgis|timescale|pgvector|supabase\/postgres|\bpg\b/i.test(block)) add(arxeio, i + 1, 'services: με Postgres (το GitHub τυπώνει το log του)')
      else if (secretful) add(arxeio, i + 1, 'services: σε ροή με secrets ή πραγματική βάση (το GitHub τυπώνει το log κάθε service container)')
      else if (anySecret && /image\s*:\s*['"]?\$\{\{/.test(block)) add(arxeio, i + 1, 'services: με εικόνα ${{ … }} σε ροή με secrets')
    })
  }

  let synthetic = false
  if (SYNTHETIC.test(raw)) {
    const at = lines.findIndex(l => SYNTHETIC.test(l))
    const caller = calledWithSecrets(arxeio)
    if (at >= 10) add(arxeio, at + 1, 'synthetic-db πέρα από τις 10 πρώτες γραμμές: δεν ισχύει')
    else if (REAL_DB.test(raw)) add(arxeio, at + 1, 'synthetic-db σε αρχείο με δείκτη πραγματικής βάσης: δεν ισχύει')
    else if (caller) add(arxeio, at + 1, `synthetic-db, αλλά το καλεί δουλειά με secret ή PG* (${caller})`)
    else synthetic = true
  }

  // Εντολές κελύφους: συνέχειες γραμμής (\) ενωμένες, σχόλια έξω.
  // Σε ροή, κάθε βήμα είναι δικό του κέλυφος: μια μεταβλητή δεν περνά στο επόμενο.
  const cmds = []
  let step = 0
  for (let i = 0; i < lines.length; i++) {
    const start = i
    let text = lines[i]
    if (workflow && /^\s*-\s+[\w-]+\s*:/.test(text)) step++
    while (/\\\s*$/.test(text) && i + 1 < lines.length) text = text.replace(/\\\s*$/, ' ') + lines[++i]
    if (text.trim().startsWith('#')) continue
    cmds.push({ line: start + 1, idx: start, step, text, code: bare(openDashC(text)) })
  }

  // Τα ονόματα που καλούν εργαλείο βάσης: τα ίδια, μεταβλητές που τα κρατούν,
  // συναρτήσεις που τα τυλίγουν. Δύο περάσματα: περιτύλιγμα πάνω σε περιτύλιγμα.
  const names = [...DB_TOOLS.map(esc)]
  const toolRe = () => new RegExp(`(^|[\\s;|&(\`])(${names.join('|')})(?=\\s|$|;|\\))`)
  for (const c of cmds) {
    const m = /^\s*(?:export\s+|local\s+|readonly\s+|declare\s+\S+\s+)?([A-Za-z_]\w*)=(?:"([^"]*)"|'([^']*)'|\(([^)]*)\)|([^\s$;]+))/.exec(c.text)
    const value = m ? (m[2] ?? m[3] ?? m[4] ?? m[5] ?? '') : ''
    if (m && new RegExp(`(^|[\\s'"])(${DB_TOOLS.join('|')})(\\s|$|['"])`).test(value)) names.push(`\\$\\{?${m[1]}\\}?`, `"\\$\\{?${m[1]}\\}?"`, `"\\$\\{${m[1]}\\[@\\]\\}"`)
  }
  for (let pass = 0; pass < 2; pass++) {
    for (const c of cmds) {
      const m = /^\s*(?:function\s+)?([A-Za-z_][\w-]*)\s*\(\)\s*\{(.*)$/.exec(c.code)
      if (m && toolRe().test(m[2]) && !names.includes(esc(m[1]))) names.push(esc(m[1]))
    }
  }
  const tool = toolRe()

  const captured = new Map()
  const outFiles = new Map()

  for (const c of cmds) {
    const { code, text } = c

    // 2. εκκίνηση container ή τοπικής στοίβας
    if (/\b(docker|podman)\s+(container\s+)?(run|create)\b/.test(code)) {
      if (!/--log-driver[ =]none\b/.test(code) && !allowed(c.idx, text)) add(arxeio, c.line, 'docker run/create χωρίς --log-driver none')
      if (/postgres|PG_IMAGE/i.test(text)) {
        for (const g of ['log_min_error_statement=panic', 'log_statement=none']) {
          if (!text.includes(g)) add(arxeio, c.line, `Postgres χωρίς -c ${g}`)
        }
      }
    }
    if ((/\b(docker|podman)\s+(container\s+)?start\b/.test(code) || /\bdocker[\s-]compose\b[^;|&]*\bup\b/.test(code) || /\bsupabase\s+start\b/.test(code)) && !allowed(c.idx, text)) {
      add(arxeio, c.line, 'εκκίνηση container/στοίβας χωρίς οδηγό log: θέλει «log-guard: allow — λόγος»')
    }

    if (synthetic) continue

    // 3α. eval / node -e / python -c με εργαλείο βάσης: δεν κρίνονται, απαγορεύονται.
    const dbIn = new RegExp(DB_TOOLS_RE)
    if (/(^|[\s;&|(])eval\s/.test(code) && dbIn.test(text) && !allowed(c.idx, text)) add(arxeio, c.line, 'eval με εργαλείο βάσης: δεν ελέγχεται τι τυπώνει')
    if (/\b(node|deno|bun)\s+(-e|--eval|-p|--print)\b|\bpython3?\s+-c\b|\bperl\s+-e\b|\bruby\s+-e\b/.test(code) && dbIn.test(text) && !allowed(c.idx, text)) add(arxeio, c.line, 'εργαλείο βάσης μέσα σε node -e / python -c: δεν ελέγχεται τι τυπώνει')

    // 3. εργαλείο βάσης
    const isDef = /^\s*(?:function\s+)?[A-Za-z_][\w-]*\s*\(\)\s*\{/.test(code)
    const isAssign = /^\s*(?:export\s+|local\s+|readonly\s+)?[A-Za-z_]\w*=(["'(])/.test(text) && !/\$\(/.test(text)
    const harmless = new RegExp(`\\b(which|command\\s+-[vV]|type(\\s+-[a-zA-Z]+)?)\\s+(${DB_TOOLS.join('|')})\\b|(${DB_TOOLS.join('|')})\\s+(--version|-V|--help|-\\?)\\s*($|[;&|)])`).test(code)
    if (!isDef && !isAssign && !harmless && tool.test(code) && !allowed(c.idx, text)) {
      const what = code.match(tool)[2].replace(/\\/g, '')
      const merge = /2>&1|\|&/.exec(text)
      const piped = merge ? pipeSegments(openDashC(text).slice(merge.index)).slice(1) : []
      const counted = piped.length > 0 && piped.every(counter)
      const cap = /([A-Za-z_]\w*)=\$\(/.exec(code)
      const errTo = [...code.matchAll(/(?:^|[^0-9&>])(?:2>|&>)\s*("?)([^\s"&;|)<>]+)\1/g)].map(m => m[2]).filter(f => f !== '&1')
      const errOk = /(^|[^0-9&>])(2>|&>)\s*\/dev\/null\b/.test(code) || (merge && counted)
      // stderr: μόνο /dev/null ή μετρητής
      if (!errOk) {
        if (errTo.some(f => f !== '/dev/null')) add(arxeio, c.line, `${what}: stderr σε αρχείο (μόνο /dev/null ή μετρητής)`)
        else if (merge && cap && !piped.length) add(arxeio, c.line, `${what}: stderr σε μεταβλητή (μόνο /dev/null ή μετρητής)`)
        else if (merge && piped.length) add(arxeio, c.line, `${what}: το stderr ενώνεται σε σωλήνα που δεν είναι μετρητής`)
        else if (merge) {
          const o = /(?:^|[\s;])1?>\s*("?)([^\s"&;|)<>]+)\1/.exec(code.replace(/2>&1/g, ''))
          if (!o || o[2] !== '/dev/null') add(arxeio, c.line, `${what}: stderr ενωμένο με stdout που δεν πάει στο /dev/null`)
        } else add(arxeio, c.line, `${what} χωρίς stderr σε ανακατεύθυνση`)
      }
      // stdout: /dev/null, $( ) ή αρχείο που δεν διαβάζεται μετά
      const stripped = code.replace(/(?:^|[^0-9&>])(2>|&>)(&1|\s*\S+)/g, ' ')
      const o = /(?:^|[\s;])1?>>?\s*("?)([^\s"&;|)<>]+)\1/.exec(stripped)
      const outOk = /\$\(/.test(code) || !!o || /&>/.test(code) || (merge && counted)
      if (!outOk) add(arxeio, c.line, `${what} χωρίς stdout σε ανακατεύθυνση`)
      if (o && o[2] !== '/dev/null' && !o[2].startsWith('&')) outFiles.set(o[2], c.idx)
      if (cap && !(merge && counted)) captured.set(`${c.step}:${cap[1]}`, cap[1])
      if (/\|\|\s*\{?\s*(cat|tail|head|less|more)\b/.test(code)) add(arxeio, c.line, `${what}: «|| cat» τυπώνει την έξοδο σε αποτυχία`)
    }
  }

  // 3β. ό,τι κρατήθηκε από εργαλείο βάσης και τυπώνεται ή διαβάζεται μετά
  if (!synthetic) {
    const PRINTS = /\b(echo|printf|cat|tee)\b|<<<|::(notice|warning|error|debug|group)::|GITHUB_STEP_SUMMARY|GITHUB_OUTPUT|GITHUB_ENV|>&2/
    const toPlainFile = t => { const m = />>?\s*"?([^\s"&;|)]+)"?\s*$/.exec(t.trim()); return m && !/GITHUB_|^&|\/dev\/std/.test(m[1]) }
    for (const c of cmds) {
      for (const [key, v] of captured) {
        if (!key.startsWith(`${c.step}:`)) continue
        if (new RegExp(`\\$\\{?${v}\\b`).test(c.text) && PRINTS.test(c.text) && !toPlainFile(c.text) && !allowed(c.idx, c.text)) add(arxeio, c.line, `η έξοδος του εργαλείου βάσης ($${v}) τυπώνεται`)
      }
      for (const [f, at] of outFiles) {
        if (c.idx === at) continue
        const t = c.text.replace(new RegExp(`>>?\\s*"?${esc(f)}"?`, 'g'), ' ').replace(new RegExp(`\\brm\\s+(-[a-z]+\\s+)*[^;&|]*${esc(f)}`, 'g'), ' ')
        if (!new RegExp(`(^|[\\s"'=<(/])${esc(f)}($|[\\s"';)|&])`).test(t)) continue
        const counterRead = new RegExp(`\\b(wc\\s+-l|grep\\s+-[a-zA-Z]*c[a-zA-Z]*\\b[^;&|]*|test\\s+-s|\\[\\s+-s)\\s*<?\\s*"?${esc(f)}`).test(t)
        if (!counterRead && !allowed(c.idx, c.text)) add(arxeio, c.line, `η έξοδος του εργαλείου βάσης (${f}) διαβάζεται ξανά`)
      }
    }
  }

  // 4. ό,τι τυπώνει εντολές ή περιεχόμενο. Χωρίς εξαίρεση.
  for (const c of cmds) {
    const code = openDashC(c.code)
    const sets = [...code.matchAll(XTRACE_SET), ...code.matchAll(XTRACE_SH)].some(m => traces(m[1]))
    if (sets || /^\s*shell\s*:\s*(ba|da|z)?sh\b[^#\n]*\s-[a-wyzA-Z]*x/.test(code)
      || /\bSHELLOPTS=[^\s;]*xtrace|\bBASH_XTRACEFD\b/.test(c.text)) add(arxeio, c.line, 'xtrace τυπώνει κάθε εντολή με τις τιμές της')
    if (/\b(docker|podman)\s+(container\s+)?logs\b|\bdocker[\s-]compose\b[^;|&]*\blogs\b/.test(code)) add(arxeio, c.line, 'docker logs')
    if (/\bsupabase\b[^;|&]*\s--debug\b/.test(code)) add(arxeio, c.line, 'supabase --debug τυπώνει τις εντολές SQL')
    if (/\bpg_dump(all)?\b[^;|&]*\s(-v|--verbose)\b/.test(code)) add(arxeio, c.line, 'pg_dump --verbose')
  }
}

if (provlimata.length) {
  console.error(`\n✗ ${provlimata.length} σημεία όπου μια βάση μπορεί να γράψει στο δημόσιο log:\n`)
  for (const p of provlimata.slice(0, 30)) console.error(`  ${p.arxeio}:${p.grammi}  «${p.ti}»`)
  if (provlimata.length > 30) console.error(`  … και ${provlimata.length - 30} ακόμη`)
  console.error(`
  ΤΙ ΝΑ ΚΑΝΕΙΣ: ο Postgres μιας ροής τρέχει με \`docker run -d --log-driver none
  --network none\` και \`-c log_min_error_statement=panic -c log_statement=none\`
  (δες το backup-restore-drill.yml), ποτέ ως \`services:\`. Κάθε psql/pg_dump/
  pg_restore: stderr ΜΟΝΟ στο /dev/null ή σε μετρητή· stdout στο /dev/null, σε
  $( ) ή σε αρχείο· τίποτε από αυτά δεν τυπώνεται ούτε ξαναδιαβάζεται μετά.
  Στο log μόνο πλήθη και ✓/✗. Αν κάτι πρέπει να μείνει όπως είναι: «# log-guard:
  allow — λόγος» στη γραμμή ή από πάνω της (όχι σε εντολή με πραγματική βάση).\n`)
  process.exit(1)
}
console.log(`✓ καμία βάση δεν γράφει στο δημόσιο log (${files.length} αρχεία ροών και σεναρίων τους, ${allows.size} ρητές εξαιρέσεις)`)
