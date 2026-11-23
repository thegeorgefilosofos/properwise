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
//  4. Η `mydata_key_read` εκτελείται ΜΟΝΟ από τον ρόλο υπηρεσίας.
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

// ── 4. Ποιος διαβάζει το κλειδί ──────────────────────────────────────────────
let readGrant = false
for (const f of migs) {
  const src = readFileSync(f, 'utf8')
  for (const m of src.matchAll(/grant\s+execute\s+on\s+function([\s\S]*?)\bto\s+([^;]+);/gi)) {
    if (!/mydata_key_read/.test(m[1])) continue
    readGrant = true
    if (/\b(authenticated|anon|public)\b/i.test(m[2])) {
      const grammi = src.slice(0, m.index).split('\n').length
      provlimata.push({ arxeio: f, grammi, ti: `η mydata_key_read δίνεται σε «${m[2].trim()}»` })
    }
  }
}
if (migs.length && !readGrant) provlimata.push({ arxeio: 'supabase/migrations', grammi: 0, ti: 'καμία εκχώρηση της mydata_key_read: ο ρόλος υπηρεσίας δεν θα τη διάβαζε' })

if (provlimata.length) {
  console.error(`\n✗ ${provlimata.length} σημεία όπου το κλειδί myDATA μπορεί να βγει προς τα έξω:\n`)
  for (const p of provlimata.slice(0, 30)) console.error(`  ${p.arxeio}:${p.grammi}  «${p.ti}»`)
  if (provlimata.length > 30) console.error(`  … και ${provlimata.length - 30} ακόμη`)
  console.error(`\n  ΤΙ ΝΑ ΚΑΝΕΙΣ: στείλε ΚΩΔΙΚΟ από το ERROR_CODES (supabase/functions/_shared/mydata.ts),`)
  console.error(`  ποτέ κείμενο εξαίρεσης ή μεταβλητή με κλειδί. Η κεφαλίδα χτίζεται μόνο στο aadeHeaders.`)
  console.error(`  Η mydata_key_read εκχωρείται μόνο στον service_role.\n`)
  process.exit(1)
}
console.log(`✓ Το κλειδί myDATA δεν βγαίνει προς τα έξω (${all.filter(MYDATA).length} αρχεία myDATA, ${migs.length} μεταναστεύσεις)`)
