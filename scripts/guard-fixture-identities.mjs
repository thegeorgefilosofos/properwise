#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΚΑΝΕΝΑ ΠΡΑΓΜΑΤΙΚΟ ΑΦΜ, ΑΤΑΚ Ή RF ΣΤΑ ΔΕΔΟΜΕΝΑ ΔΟΚΙΜΗΣ ΤΗΣ ΕΙΣΑΓΩΓΗΣ myAADE
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ ΠΟΥ ΑΠΟΤΡΕΠΕΤΑΙ. Η εισαγωγή από το myAADE (30/10/2026) θα
// γραφτεί πάνω στα πραγματικά PDF του ιδιοκτήτη: την πράξη ΕΝΦΙΑ με το ΑΦΜ του,
// τους ΑΤΑΚ των ακινήτων του και την Ταυτότητα Οφειλής του. Ο φυσικός δρόμος
// για να γίνουν fixtures είναι να αντιγραφούν γραμμές τους σε ένα αρχείο
// δοκιμής. Το αποθετήριο είναι ΔΗΜΟΣΙΟ: μία αντιγραμμένη γραμμή είναι ΑΦΜ,
// περιουσία και κωδικός πληρωμής ενός ανθρώπου στο διαδίκτυο, για πάντα (το
// ιστορικό του git δεν ξεχνά). Το ίδιο έγινε ήδη μία φορά με διεύθυνση οδού σε
// δοκιμή και γράφτηκε ο guard-private-street.
//
// ΤΙ ΕΛΕΓΧΕΤΑΙ. Κάθε αρχείο κάτω από `lib/myaade/` και κάθε `*.test.ts` που
// εισάγει από εκεί:
//   1. Εννιαψήφιο που ΠΕΡΝΑ τον έλεγχο ψηφίου ΑΦΜ. Τα fixtures γράφουν ΑΦΜ που
//      αποτυγχάνει· όπου χρειάζεται έγκυρο, φτιάχνεται τη στιγμή της δοκιμής.
//      Ενα στα έντεκα τυχαία εννιαψήφια περνά τυχαία· ο κανόνας κοστίζει λίγο:
//      γράψε τον αριθμό αλλιώς.
//   2. Αναφορά RF (ISO 11649) με σωστό mod 97. Ίδια λογική: η έγκυρη φτιάχνεται
//      με `rfFor` όταν τρέχει η δοκιμή.
//   3. Ενδεκαψήφιο (θέση ΑΤΑΚ) που ΔΕΝ ξεκινά με `999`. Ο ΑΤΑΚ δεν έχει ψηφίο
//      ελέγχου, οπότε αυτό είναι ΣΥΜΒΑΣΗ του αποθετηρίου και όχι απόδειξη: γι'
//      αυτό συνοδεύεται από τους κανόνες 1 και 2.
//   4. Οποιοδήποτε `.pdf` κάτω από `lib/myaade/`. Τα PDF των δοκιμών
//      παράγονται όταν τρέχουν (lib/myaade/myaade.test.ts)· τα πραγματικά ζουν στο
//      `local-samples/`, που το αγνοεί το git.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { projectFiles } from './lib/git-files.mjs'

const ROOT = 'lib/myaade/'

const isValidAfm = (s) => {
  if (!/^\d{9}$/.test(s) || /^0+$/.test(s)) return false
  let sum = 0
  for (let i = 0; i < 8; i++) sum += Number(s[i]) * 2 ** (8 - i)
  return (sum % 11) % 10 === Number(s[8])
}

const isValidRf = (raw) => {
  const s = raw.replace(/\s+/g, '').toUpperCase()
  if (!/^RF\d{2}[0-9A-Z]{1,21}$/.test(s)) return false
  let rem = 0
  for (const ch of s.slice(4) + s.slice(0, 4)) {
    const v = ch >= 'A' && ch <= 'Z' ? String(ch.charCodeAt(0) - 55) : ch
    for (const d of v) rem = (rem * 10 + Number(d)) % 97
  }
  return rem === 1
}

const all = projectFiles()
const tests = all.filter(f => f.endsWith('.test.ts') && !f.startsWith(ROOT))
  .filter(f => /lib\/myaade|from '\.\/(?:enfiaAct|fixtures)'/.test(readFileSync(f, 'utf8')))
const files = [...all.filter(f => f.startsWith(ROOT)), ...tests]

const provlimata = []
for (const f of files) {
  if (/\.pdf$/i.test(f)) {
    provlimata.push({ arxeio: f, grammi: 1, ti: 'αρχείο PDF μέσα στο αποθετήριο' })
    continue
  }
  const lines = readFileSync(f, 'utf8').split('\n')
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/(?<!\d)\d{9}(?!\d)/g)) {
      if (isValidAfm(m[0])) provlimata.push({ arxeio: f, grammi: i + 1, ti: `έγκυρο ΑΦΜ ${m[0]}` })
    }
    for (const m of line.matchAll(/(?<!\d)\d{11}(?!\d)/g)) {
      if (!m[0].startsWith('999')) provlimata.push({ arxeio: f, grammi: i + 1, ti: `ΑΤΑΚ χωρίς το πρόθεμα 999: ${m[0]}` })
    }
    for (const m of line.matchAll(/RF\s?\d{2}(?:\s?[0-9A-Z]){1,21}/g)) {
      if (isValidRf(m[0])) provlimata.push({ arxeio: f, grammi: i + 1, ti: `έγκυρη Ταυτότητα Οφειλής ${m[0]}` })
    }
  })
}

if (provlimata.length) {
  console.error(`\n✗ ${provlimata.length} ταυτότητες που μοιάζουν πραγματικές στα δεδομένα δοκιμής της εισαγωγής myAADE:\n`)
  for (const p of provlimata.slice(0, 30)) console.error(`  ${p.arxeio}:${p.grammi}  «${p.ti}»`)
  if (provlimata.length > 30) console.error(`  … και ${provlimata.length - 30} ακόμη`)
  console.error(`\n  ΤΙ ΝΑ ΚΑΝΕΙΣ: χρησιμοποίησε τα ψεύτικα του lib/myaade/myaade.test.ts:`)
  console.error(`  FAKE_AFM (αποτυγχάνει τον έλεγχο), fakeAtak(n) (πρόθεμα 999), validTestAfm() και`)
  console.error(`  testRf() όταν χρειάζεται έγκυρο. Τα πραγματικά PDF πάνε στο local-samples/, ποτέ στο git.\n`)
  process.exit(1)
}
console.log(`✓ Κανένα πραγματικό ΑΦΜ, ΑΤΑΚ ή RF στα δεδομένα δοκιμής της εισαγωγής myAADE (${files.length} αρχεία)`)
