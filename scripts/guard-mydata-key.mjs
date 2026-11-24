#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΚΛΕΙΔΙ myDATA ΤΟΥ ΛΟΓΙΣΤΗ ΔΕΝ ΒΓΑΙΝΕΙ ΠΟΤΕ: ΟΥΤΕ ΣΕ LOG, ΟΥΤΕ ΣΕ ΑΠΑΝΤΗΣΗ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ ΠΟΥ ΔΕΝ ΠΡΕΠΕΙ ΝΑ ΕΠΑΝΑΛΗΦΘΕΙ ΕΔΩ. Η ical-sync γράφει
// `error: ${String(err).slice(0, 200)}` στο `ical_feeds.last_status`, δηλαδή
// κείμενο εξαίρεσης σε στήλη που διαβάζει ο πελάτης. Για ένα ημερολόγιο είναι
// ενόχληση· για το myDATA θα ήταν διαρροή: το κείμενο ενός σφάλματος δικτύου
// μπορεί να κουβαλά τη διεύθυνση (με ΑΦΜ πελάτη) και μια βιβλιοθήκη που
// τυπώνει το αίτημα κουβαλά και τις κεφαλίδες, δηλαδή το
// `Ocp-Apim-Subscription-Key` του λογιστή, που ανοίγει τα παραστατικά ΟΛΩΝ
// των πελατών που τον έχουν εξουσιοδοτήσει στο myAADE. Απαίτηση ιδιοκτήτη
// (23/11/2026): «το κλειδί δεν επιστρέφει ποτέ, δεν καταγράφεται ποτέ, δεν
// μπαίνει σε μήνυμα σφάλματος».
//
// ΤΙ ΕΛΕΓΧΕΤΑΙ, ΑΚΡΙΒΩΣ.
//  1. Η κεφαλίδα `Ocp-Apim-Subscription-Key` χτίζεται σε ΕΝΑ σημείο, το
//     `aadeHeaders` του supabase/functions/_shared/mydata.ts. Εξαιρούνται ο
//     ψεύτικος διακομιστής (τη διαβάζει) και οι δοκιμές/probes (τη γράφουν ως
//     δεδομένο ελέγχου).
//  2. Στον κώδικα του myDATA (συνάρτηση, κοινά, lib, οθόνες), καμία γραμμή που
//     ΒΓΑΖΕΙ κάτι (console.*, reportEdgeError, json(, new Error(, notify,
//     JSON.stringify) δεν αναφέρει κλειδί, κεφαλίδες ή διαπιστευτήρια, ούτε
//     κείμενο εξαίρεσης τρίτου (`.message`, `String(e…)`). Οι συμβολοσειρές
//     αφαιρούνται πριν τον έλεγχο: το `reason: 'bad_key_shape'` είναι κωδικός.
//  3. Στις μεταναστεύσεις του myDATA, κανένα `raise` δεν περιέχει το κλειδί
//     (`p_key`, `v_key`, `api_key`, `decrypted_secret`).
//
// Ε2 (απόφαση ιδιοκτήτη 24/11/2026): ΤΟ ΚΛΕΙΔΙ ΔΕΝ ΦΥΛΑΣΣΕΤΑΙ ΠΟΥΘΕΝΑ. Ζει μόνο
// στη μνήμη της καρτέλας του λογιστή και στο σώμα κάθε κλήσης προς τη
// συνάρτηση άκρου. Γι' αυτό, επιπλέον:
//  4. Στον κώδικα του myDATA, καμία αποθήκευση του φυλλομετρητή
//     (`localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`).
//  5. Στον κώδικα του myDATA, καμία κλήση της βάσης (`.rpc(`, `.from(`,
//     `.insert(`, `.update(`, `.upsert(`) με κλειδί ή διαπιστευτήρια. Το
//     κλειδί πηγαίνει μόνο στο `functions.invoke` και από εκεί στις κεφαλίδες.
//  6. Στο τέλος των μεταναστεύσεων δεν ζει τίποτα που φυλάει ή διαβάζει κλειδί:
//     κάθε συνάρτηση που δέχτηκε ποτέ `p_key` (π.χ. `mydata_key_store`), οι
//     `mydata_key_read`, `mydata_key_remove`, `mydata_due_accountants` και ο
//     πίνακας `private.mydata_vault` έχουν σβηστεί ΜΕΤΑ την τελευταία φορά που
//     ορίστηκαν.
//  7. Καμία εργασία cron δεν καλεί τη `mydata-sync`: όποια προγραμματίστηκε
//     ποτέ έχει ξεπρογραμματιστεί μετά. Η άντληση γίνεται μόνο όταν την ξεκινά
//     ο λογιστής.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { projectFiles } from './lib/git-files.mjs'

const provlimata = []
const HEADER = /ocp-apim-subscription-key/i
const HEADER_HOME = 'supabase/functions/_shared/mydata.ts'
const HEADER_OK = new Set([HEADER_HOME, 'scripts/mydata-fake/server.mjs', 'scripts/guard-mydata-key.mjs', 'scripts/lib/mutations.mjs'])
const isTest = (f) => /\.test\.tsx?$/.test(f) || f.startsWith('scripts/db/')

const all = projectFiles("'app/**/*.ts' 'app/**/*.tsx' 'lib/**/*.ts' 'lib/**/*.tsx' 'components/**/*.tsx' 'supabase/functions/**/*.ts' 'scripts/**/*.mjs' 'scripts/db/*.sql'")

// ── 1. Ενα σπίτι για την κεφαλίδα ──────────────────────────────────────────
for (const f of all) {
  if (HEADER_OK.has(f) || isTest(f)) continue
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    if (HEADER.test(line)) provlimata.push({ arxeio: f, grammi: i + 1, ti: 'η κεφαλίδα του κλειδιού χτίζεται έξω από το aadeHeaders' })
  })
}

// ── 2. Ο,τι βγαίνει δεν αναφέρει κλειδί ή κείμενο εξαίρεσης ───────────────────
const MYDATA = (f) => !isTest(f) && (
  f.startsWith('supabase/functions/mydata-sync/') || /^supabase\/functions\/_shared\/mydata[^/]*\.ts$/.test(f)
  || f.startsWith('lib/mydata/') || /\/[Mm]ydata[^/]*\.tsx?$/.test(f))
const OUTPUT = /\b(console\.\w+|reportEdgeError|json|notify|notifyError|JSON\.stringify)\s*\(|\bnew Error\s*\(/
const SECRET = /\b(subscriptionKey|apiKey|api_key|creds|credentials|headers|secret|key)\b(?!\s*:)|\.message\b|\bString\(\s*(e|err|error)\b/
const stripStrings = (l) => l
  .replace(/\/\/.*$/, '')
  .replace(/'(?:\\.|[^'\\])*'/g, "''")
  .replace(/"(?:\\.|[^"\\])*"/g, '""')
  .replace(/`(?:\\.|[^`\\$]|\$(?!\{))*`/g, '``')
for (const f of all.filter(MYDATA)) {
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    const code = stripStrings(line)
    if (OUTPUT.test(code) && SECRET.test(code)) {
      provlimata.push({ arxeio: f, grammi: i + 1, ti: line.trim().slice(0, 120) })
    }
  })
}

// ── 3. Τα raise των μεταναστεύσεων ─────────────────────────────────────────
const migs = projectFiles("'supabase/migrations/*.sql'").filter(f => readFileSync(f, 'utf8').includes('mydata_'))
for (const f of migs) {
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    if (/\braise\b/i.test(line) && /\b(p_key|v_key|api_key|decrypted_secret)\b/i.test(line)) {
      provlimata.push({ arxeio: f, grammi: i + 1, ti: 'το κλειδί μέσα σε raise' })
    }
  })
}

// ── 4. Καμία αποθήκευση του φυλλομετρητή στον κώδικα του myDATA ──────────────
const STORAGE = /\b(localStorage|sessionStorage|indexedDB)\b|\bdocument\.cookie\b/
// ── 5. Καμία κλήση της βάσης με κλειδί ────────────────────────────────────────
const DB_CALL = /\.(rpc|from|insert|update|upsert)\s*\(/
const KEYISH = /\b(subscriptionKey|apiKey|api_key|p_key|creds|credentials|key)\b/
for (const f of all.filter(MYDATA)) {
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    const code = stripStrings(line)
    if (STORAGE.test(code)) provlimata.push({ arxeio: f, grammi: i + 1, ti: `αποθήκευση φυλλομετρητή: ${line.trim().slice(0, 100)}` })
    if (DB_CALL.test(code) && KEYISH.test(code)) provlimata.push({ arxeio: f, grammi: i + 1, ti: `κλειδί σε κλήση της βάσης: ${line.trim().slice(0, 100)}` })
  })
}

// ── 6 και 7. Στο τέλος των μεταναστεύσεων: καμία φύλαξη, κανένα cron ──────────
// Θέση = (σειρά αρχείου, θέση μέσα στο αρχείο). Αυτό που ορίστηκε τελευταίο
// πρέπει να έχει σβηστεί μετά.
const allMigs = projectFiles("'supabase/migrations/*.sql'").sort()
const lastAt = (re) => {
  let best = null
  allMigs.forEach((f, fi) => {
    const src = readFileSync(f, 'utf8')
    for (const m of src.matchAll(re)) best = { fi, at: m.index, arxeio: f, grammi: src.slice(0, m.index).split('\n').length }
  })
  return best
}
const after = (a, b) => !!a && !!b && (b.fi > a.fi || (b.fi === a.fi && b.at > a.at))
const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const keyFns = new Set(['public.mydata_key_store', 'public.mydata_key_read', 'public.mydata_key_remove', 'public.mydata_due_accountants'])
for (const f of allMigs) {
  const src = readFileSync(f, 'utf8')
  for (const m of src.matchAll(/create\s+(?:or\s+replace\s+)?function\s+([a-z_]+\.[a-z0-9_]+)\s*\(([^)]*)\)/gi)) {
    if (/\b(p_key|p_api_key|p_secret|p_subscription_key)\b/i.test(m[2])) keyFns.add(m[1].toLowerCase())
  }
}
for (const fn of keyFns) {
  const made = lastAt(new RegExp(`create\\s+(?:or\\s+replace\\s+)?function\\s+${esc(fn)}\\s*\\(`, 'gi'))
  if (!made) continue
  const gone = lastAt(new RegExp(`drop\\s+function\\s+(?:if\\s+exists\\s+)?${esc(fn)}\\s*\\(`, 'gi'))
  if (!after(made, gone)) provlimata.push({ arxeio: made.arxeio, grammi: made.grammi, ti: `η ${fn} φυλάει κλειδί ή τρέχει χωρίς τον λογιστή και ζει στο τέλος των μεταναστεύσεων` })
}
{
  const made = lastAt(/create\s+table\s+(?:if\s+not\s+exists\s+)?private\.mydata_vault\b/gi)
  const gone = lastAt(/drop\s+table\s+(?:if\s+exists\s+)?private\.mydata_vault\b/gi)
  if (made && !after(made, gone)) provlimata.push({ arxeio: made.arxeio, grammi: made.grammi, ti: 'ο πίνακας private.mydata_vault ζει στο τέλος των μεταναστεύσεων' })
}
const jobs = new Set()
for (const f of allMigs) {
  const src = readFileSync(f, 'utf8')
  // Το σώμα μιας εργασίας: από το `cron.schedule(` ως την επόμενη αναφορά στο
  // `cron.` (επόμενη εργασία ή έλεγχος), όπου μέσα ζει η διεύθυνση της συνάρτησης.
  for (const m of src.matchAll(/cron\.schedule\(\s*'([^']+)'/gi)) {
    const rest = src.slice(m.index + m[0].length)
    const next = rest.search(/\bcron\./)
    if ((next < 0 ? rest : rest.slice(0, next)).includes('/functions/v1/mydata-sync')) jobs.add(m[1])
  }
}
for (const job of jobs) {
  const made = lastAt(new RegExp(`cron\\.schedule\\(\\s*'${esc(job)}'`, 'gi'))
  const gone = lastAt(new RegExp(`cron\\.unschedule\\(\\s*'${esc(job)}'`, 'gi'))
  if (!after(made, gone)) provlimata.push({ arxeio: made.arxeio, grammi: made.grammi, ti: `η εργασία cron «${job}» καλεί τη mydata-sync χωρίς τον λογιστή` })
}

if (provlimata.length) {
  console.error(`\n✗ ${provlimata.length} σημεία όπου το κλειδί myDATA μπορεί να βγει προς τα έξω:\n`)
  for (const p of provlimata.slice(0, 30)) console.error(`  ${p.arxeio}:${p.grammi}  «${p.ti}»`)
  if (provlimata.length > 30) console.error(`  … και ${provlimata.length - 30} ακόμη`)
  console.error(`\n  ΤΙ ΝΑ ΚΑΝΕΙΣ: στείλε ΚΩΔΙΚΟ από το ERROR_CODES (supabase/functions/_shared/mydata.ts),`)
  console.error(`  ποτέ κείμενο εξαίρεσης ή μεταβλητή με κλειδί. Η κεφαλίδα χτίζεται μόνο στο aadeHeaders.`)
  console.error(`  Ε2: το κλειδί δεν φυλάσσεται πουθενά (βάση, Vault, αποθήκευση φυλλομετρητή) και`)
  console.error(`  καμία εργασία cron δεν καλεί τη mydata-sync. Σβήσε ό,τι φυλάει ή προγραμματίζει.\n`)
  process.exit(1)
}
console.log(`✓ Το κλειδί myDATA δεν βγαίνει προς τα έξω και δεν φυλάσσεται (${all.filter(MYDATA).length} αρχεία myDATA, ${migs.length} μεταναστεύσεις, ${jobs.size} εργασίες cron σβησμένες)`)
