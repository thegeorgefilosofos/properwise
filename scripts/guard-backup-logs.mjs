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
//   1. `services:`: σε ροή που διαβάζει `secrets.` καθόλου, όποια κι αν είναι η
//      εικόνα ή η γραφή του YAML· αλλού όχι με Postgres. Το log ενός service
//      container το τυπώνει το GitHub και δεν κλείνει με καμία ρύθμιση.
//   2. Κάθε εκκίνηση container: `docker [container] run|create` θέλει
//      `--log-driver none`· με Postgres και `log_min_error_statement=panic`,
//      `log_statement=none`. Το `docker start`, το `docker compose up` και το
//      `supabase start` δεν παίρνουν οδηγό log: θέλουν ρητή εξαίρεση (κάτω).
//   3. psql / pg_restore / pg_dump / pg_dumpall και ό,τι τα καλεί: συνάρτηση-
//      περιτύλιγμα, μεταβλητή (`PSQL="psql …"; $PSQL …`), `bash -c '… psql …'`,
//      `su … -c "…"`. Το stderr πάει κάπου (`2>`, `&>`), το stdout σε
//      ανακατεύθυνση ή σε `$( )`. Και το stderr ΔΕΝ ΦΑΙΝΕΤΑΙ μετά:
//        · `2>&1 | …` μόνο προς μετρητή (`wc -l`, `grep -c`, `awk` που τυπώνει
//          μόνο έναν αριθμό)
//        · `2>αρχείο` και μετά `cat`/`tail`/`head`/`less`/`tee` του αρχείου
//        · `|| cat …` στην ίδια εντολή
//        · `x=$(psql … 2>&1)` και μετά `echo "$x"` ή `printf … "$x"`
//   4. Όχι xtrace σε καμία μορφή (`set -x`, `set -euxo`, `set -o xtrace`,
//      `bash -x`, `SHELLOPTS`), όχι `docker logs`, όχι `supabase --debug`, όχι
//      `pg_dump --verbose`.
//   5. Σενάριο JS/TS που καλεί μια ροή και τρέχει psql/pg_dump/pg_restore ή
//      `supabase db|start` ως υποδιεργασία: θέλει ρητή εξαίρεση.
//
// ΡΗΤΗ ΕΞΑΙΡΕΣΗ, ΜΕ ΛΟΓΟ. `# log-guard: allow — <γιατί>` (ή `//` σε JS) στην
// ίδια γραμμή ή στην αμέσως προηγούμενη ισχύει για τους κανόνες 2, 3 και 5.
// `# log-guard: synthetic-db — <γιατί>` στην αρχή ενός σεναρίου εξαιρεί όλο
// το αρχείο από τον κανόνα 3, ΜΟΝΟ αν δεν αγγίζει πραγματική βάση (κανένα
// `--linked`, `--db-url`, `--remote`, `PGPASSWORD`, `DATABASE_URL`,
// `SUPABASE_DB_PASSWORD`, `.supabase.co`, `secrets.`). Οι κανόνες 1 και 4 δεν
// εξαιρούνται ποτέ.
//
// Σχόλια (#) και κείμενα μέσα σε εισαγωγικά δεν μετρούν ως εντολές, εκτός από
// το όρισμα ενός `-c` (κανόνας 3).
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
const REAL_DB = /--linked\b|--db-url\b|--remote\b|\bPGPASSWORD\b|\bDATABASE_URL\b|\bSUPABASE_DB_PASSWORD\b|\.supabase\.co\b|\bsecrets\./
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

for (const arxeio of files) {
  const raw = readFileSync(arxeio, 'utf8')
  const lines = raw.split('\n')
  const workflow = arxeio.startsWith('.github/')
  const allowed = i => ALLOW.test(lines[i] ?? '') || ALLOW.test(lines[i - 1] ?? '')

  // 5. JS/TS: υποδιεργασία που μιλά με βάση
  if (/\.(mjs|cjs|js|ts|mts)$/.test(arxeio)) {
    lines.forEach((l, i) => {
      if (/^\s*(\/\/|\*)/.test(l) || allowed(i)) return
      const spawnsDb = new RegExp(`(['"\`])\\s*(${DB_TOOLS.join('|')})(\\s|\\1)`).test(l) || /(['"`])supabase\1\s*,\s*\[\s*(['"`])(db|start)\2/.test(l)
      if (spawnsDb && /\b(exec|execSync|execFile|execFileSync|spawn|spawnSync|\$)\b|`/.test(l)) add(arxeio, i + 1, 'υποδιεργασία βάσης από σενάριο ροής χωρίς ρητή εξαίρεση')
    })
    continue
  }

  // 1. services:
  if (workflow) {
    const secretful = lines.some(l => !l.trim().startsWith('#') && /\bsecrets\./.test(l))
    lines.forEach((l, i) => {
      if (l.trim().startsWith('#') || !/(^|[\s{,])services\s*:/.test(bare(l))) return
      if (secretful) { add(arxeio, i + 1, 'services: σε ροή με secrets (το GitHub τυπώνει το log κάθε service container)'); return }
      let pg = /postgres/i.test(l)
      const base = indent(l)
      for (let j = i + 1; !pg && j < lines.length; j++) {
        if (lines[j].trim() === '' || lines[j].trim().startsWith('#')) continue
        if (indent(lines[j]) <= base) break
        pg = /postgres/i.test(lines[j])
      }
      if (pg) add(arxeio, i + 1, 'services: με Postgres (το GitHub τυπώνει το log του)')
    })
  }

  const synthetic = SYNTHETIC.test(raw) && !REAL_DB.test(raw)

  // Εντολές κελύφους: συνέχειες γραμμής (\) ενωμένες, σχόλια έξω.
  const cmds = []
  for (let i = 0; i < lines.length; i++) {
    const start = i
    let text = lines[i]
    while (/\\\s*$/.test(text) && i + 1 < lines.length) text = text.replace(/\\\s*$/, ' ') + lines[++i]
    if (text.trim().startsWith('#')) continue
    cmds.push({ line: start + 1, idx: start, text, code: bare(openDashC(text)) })
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

  const captured = new Set()
  const errFiles = new Set()

  for (const c of cmds) {
    const { code, text } = c
    const ok = allowed(c.idx)

    // 2. εκκίνηση container ή τοπικής στοίβας
    if (/\b(docker|podman)\s+(container\s+)?(run|create)\b/.test(code)) {
      if (!/--log-driver[ =]none\b/.test(code) && !ok) add(arxeio, c.line, 'docker run/create χωρίς --log-driver none')
      if (/postgres|PG_IMAGE/i.test(text)) {
        for (const g of ['log_min_error_statement=panic', 'log_statement=none']) {
          if (!text.includes(g)) add(arxeio, c.line, `Postgres χωρίς -c ${g}`)
        }
      }
    }
    if (!ok && (/\b(docker|podman)\s+(container\s+)?start\b/.test(code) || /\bdocker[\s-]compose\b[^;|&]*\bup\b/.test(code) || /\bsupabase\s+start\b/.test(code))) {
      add(arxeio, c.line, 'εκκίνηση container/στοίβας χωρίς οδηγό log: θέλει «log-guard: allow — λόγος»')
    }

    // 3. εργαλείο βάσης χωρίς σίγαση
    const isDef = /^\s*(?:function\s+)?[A-Za-z_][\w-]*\s*\(\)\s*\{/.test(code)
    const isAssign = /^\s*(?:export\s+|local\s+|readonly\s+)?[A-Za-z_]\w*=(["'(])/.test(text) && !/\$\(/.test(text)
    if (!isDef && !isAssign && tool.test(code)) {
      const what = code.match(tool)[2].replace(/\\/g, '')
      const merge = /2>&1|\|&/.exec(text)
      const piped = merge ? pipeSegments(openDashC(text).slice(merge.index)).slice(1) : []
      const cap = /([A-Za-z_]\w*)=\$\([^)]*(2>&1|\|&)/.exec(code)
      if (cap && !(piped.length && piped.every(counter))) captured.add(cap[1])
      for (const m of code.matchAll(/(?:^|[^0-9&])(?:2>|&>)\s*("?)([^\s"&;|)<>]+)\1/g)) if (m[2] !== '/dev/null') errFiles.add(m[2])
      const out2 = /(?:^|[\s;])1?>\s*("?)([^\s"&;|)<>]+)\1[^|;]*2>&1/.exec(code)
      if (out2 && out2[2] !== '/dev/null') errFiles.add(out2[2])
      if (!synthetic && !ok) {
        const err = /(^|[^0-9&>])(2>|&>)/.test(code) || /\|&/.test(code)
        const out = /\$\(/.test(code) || /(^|[\s;])(1?>|&>)\s*\S/.test(code.replace(/2>(&1|\s*\S+)/g, ''))
        if (!err || !out) add(arxeio, c.line, `${what} χωρίς ${!err ? 'stderr' : 'stdout'} σε ανακατεύθυνση`)
        if (piped.some(s => !counter(s))) add(arxeio, c.line, `${what}: το stderr ενώνεται σε σωλήνα που δεν είναι μετρητής`)
        if (/\|\|\s*\{?\s*(cat|tail|head|less|more)\b/.test(code)) add(arxeio, c.line, `${what}: «|| cat» τυπώνει την έξοδο σε αποτυχία`)
      }
    }
  }

  // 3β. ό,τι κρατήθηκε από εργαλείο βάσης και τυπώνεται μετά
  if (!synthetic) {
    for (const c of cmds) {
      if (allowed(c.idx)) continue
      for (const v of captured) {
        if (new RegExp(`\\b(echo|printf)\\b[^;|&]*\\$\\{?${v}\\b`).test(c.text)) add(arxeio, c.line, `η έξοδος σφάλματος του εργαλείου βάσης (${v}) τυπώνεται`)
      }
      for (const f of errFiles) {
        if (new RegExp(`\\b(cat|tail|head|less|more|tee)\\b[^;|&]*${esc(f)}|\\$\\(<\\s*"?${esc(f)}`).test(c.text)) add(arxeio, c.line, `το stderr του εργαλείου βάσης (${f}) τυπώνεται`)
      }
    }
  }

  // 4. ό,τι τυπώνει εντολές ή περιεχόμενο. Χωρίς εξαίρεση.
  for (const c of cmds) {
    const code = openDashC(c.code)
    if (/(^|[\s;&|(])set\b[^;&|]*?(\s-[a-wyzA-Z]*x[a-zA-Z]*\b|\bxtrace\b)/.test(` ${code}`)
      || /\b(ba|da|z)?sh\s+(-[a-zA-Z]*\s+)*(-[a-wyzA-Z]*x[a-zA-Z]*|-o\s+xtrace)\b/.test(code)
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
  pg_restore: stdout στο /dev/null (ή σε $( ) για ένα πλήθος), stderr στο
  /dev/null ή σε μετρητή· τίποτε από τα δύο δεν τυπώνεται μετά. Στο log
  μόνο πλήθη και ✓/✗. Αν κάτι πρέπει να μείνει όπως είναι: «# log-guard: allow —
  λόγος» στη γραμμή ή από πάνω της.\n`)
  process.exit(1)
}
console.log(`✓ καμία βάση δεν γράφει στο δημόσιο log (${files.length} αρχεία ροών και σεναρίων τους)`)
