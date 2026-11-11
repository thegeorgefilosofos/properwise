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
// ΤΙ ΕΛΕΓΧΕΤΑΙ, στα .github/workflows/*.yml και στο scripts/backup/**:
//   1. κανένα `services:` με Postgres. Το log του το τυπώνει το GitHub και δεν
//      κλείνει με καμία ρύθμιση της ροής
//   2. κάθε `docker run` έχει `--log-driver none`. Όταν τρέχει Postgres, ο
//      διακομιστής ξεκινά και με `log_min_error_statement=panic` και
//      `log_statement=none`: δεύτερο τείχος, αν κάποτε χαθεί το πρώτο
//   3. κάθε κλήση psql / pg_restore (και κάθε συνάρτηση-περιτύλιγμα που τις
//      καλεί) στέλνει το stderr κάπου (`2>`, `&>`) και το stdout είτε σε
//      ανακατεύθυνση είτε σε `$( )`
//   4. όχι `set -x` / `xtrace` / `bash -x`, όχι `docker logs`, όχι `--debug`
//      στο supabase CLI, όχι `pg_dump --verbose`
// Σχόλια (#) και κείμενα μέσα σε εισαγωγικά δεν μετρούν ως εντολές.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { projectFiles } from './lib/git-files.mjs'

const files = projectFiles("'.github/workflows/*.yml' '.github/workflows/*.yaml' 'scripts/backup/**'")
const provlimata = []
const add = (arxeio, grammi, ti) => provlimata.push({ arxeio, grammi, ti })

/** Το κείμενο χωρίς τα περιεχόμενα των εισαγωγικών: εντολές, όχι μηνύματα. */
const bare = s => s.replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/'[^']*'/g, "''")
const indent = s => s.length - s.trimStart().length

for (const arxeio of files) {
  const lines = readFileSync(arxeio, 'utf8').split('\n')
  const workflow = arxeio.startsWith('.github/')

  // 1. services: με Postgres
  if (workflow) {
    lines.forEach((l, i) => {
      if (!/^\s*services:\s*(#.*)?$/.test(l)) return
      const base = indent(l)
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim() === '' || lines[j].trim().startsWith('#')) continue
        if (indent(lines[j]) <= base) break
        if (/postgres/i.test(lines[j])) { add(arxeio, i + 1, 'services: με Postgres (το GitHub τυπώνει το log του)'); break }
      }
    })
  }

  // Εντολές κελύφους: συνέχειες γραμμής (\) ενωμένες, σχόλια έξω.
  const cmds = []
  for (let i = 0; i < lines.length; i++) {
    const start = i
    let text = lines[i]
    while (/\\\s*$/.test(text) && i + 1 < lines.length) text = text.replace(/\\\s*$/, ' ') + lines[++i]
    if (text.trim().startsWith('#')) continue
    cmds.push({ line: start + 1, text, code: bare(text) })
  }

  // Συναρτήσεις που τυλίγουν psql / pg_restore: οι κλήσεις τους κρίνονται ίδια.
  const wrappers = cmds.map(c => /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(\)\s*\{(.*)$/.exec(c.code))
    .filter(m => m && /(^|[\s;|&(])(psql|pg_restore)(\s|$)/.test(m[2])).map(m => m[1])
  const tool = new RegExp(`(^|[\\s;|&(])(${['psql', 'pg_restore', ...wrappers].join('|')})(\\s|$)`)

  for (const c of cmds) {
    const { code } = c
    // 2. docker run
    if (/\bdocker\s+run\b/.test(code)) {
      if (!/--log-driver[ =]none\b/.test(code)) add(arxeio, c.line, 'docker run χωρίς --log-driver none')
      if (/postgres|PG_IMAGE/i.test(c.text)) {
        for (const g of ['log_min_error_statement=panic', 'log_statement=none']) {
          if (!c.text.includes(g)) add(arxeio, c.line, `Postgres χωρίς -c ${g}`)
        }
      }
    }
    // 3. psql / pg_restore χωρίς σίγαση
    const isDef = /^\s*[A-Za-z_][A-Za-z0-9_]*\s*\(\)\s*\{/.test(code)
    if (!isDef && tool.test(code)) {
      const err = /(^|[^0-9&])(2>|&>)/.test(code)
      const out = /\$\(/.test(code) || /(^|[\s;])(1?>|&>)\s*\S/.test(code.replace(/2>(&1|\s*\S+)/g, ''))
      if (!err || !out) add(arxeio, c.line, `${code.match(tool)[2]} χωρίς ${!err ? 'stderr' : 'stdout'} σε ανακατεύθυνση`)
    }
    // 4. ό,τι τυπώνει εντολές ή περιεχόμενο
    if (/(^|[\s;])set\s+(-[a-z]*x[a-z]*|-o\s+xtrace)\b/.test(code) || /\bbash\s+-[a-z]*x[a-z]*\b/.test(code)) add(arxeio, c.line, 'set -x / xtrace τυπώνει κάθε εντολή με τις τιμές της')
    if (/\bdocker\s+logs\b/.test(code)) add(arxeio, c.line, 'docker logs')
    if (/\bsupabase\b.*\s--debug\b/.test(code)) add(arxeio, c.line, 'supabase --debug τυπώνει τις εντολές SQL')
    if (/\bpg_dump\b.*\s(-v|--verbose)\b/.test(code)) add(arxeio, c.line, 'pg_dump --verbose')
  }
}

if (provlimata.length) {
  console.error(`\n✗ ${provlimata.length} σημεία όπου μια βάση μπορεί να γράψει στο δημόσιο log:\n`)
  for (const p of provlimata.slice(0, 30)) console.error(`  ${p.arxeio}:${p.grammi}  «${p.ti}»`)
  if (provlimata.length > 30) console.error(`  … και ${provlimata.length - 30} ακόμη`)
  console.error(`
  ΤΙ ΝΑ ΚΑΝΕΙΣ: ο Postgres μιας ροής τρέχει με \`docker run -d --log-driver none
  --network none\` και \`-c log_min_error_statement=panic -c log_statement=none\`
  (δες το backup-restore-drill.yml), ποτέ ως \`services:\`. Κάθε psql/pg_restore:
  stdout στο /dev/null (ή σε $( ) για ένα πλήθος), stderr στο /dev/null ή σε
  μετρητή. Στο log μόνο πλήθη και ✓/✗.\n`)
  process.exit(1)
}
console.log(`✓ καμία βάση δεν γράφει στο δημόσιο log (${files.length} αρχεία ροών και αντιγράφων)`)
