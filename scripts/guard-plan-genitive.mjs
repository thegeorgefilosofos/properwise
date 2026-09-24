#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΟΝΟΜΑ ΤΟΥ ΠΑΚΕΤΟΥ ΚΛΙΝΕΤΑΙ: «του «Ιδιοκτήτη»», ΟΧΙ «του «Ιδιοκτήτης»»
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΣΦΑΛΜΑ, ΟΠΩΣ ΦΑΙΝΟΤΑΝ. Οι κάρτες του τιμοκαταλόγου έγραφαν «Όλα του
// «Ιδιοκτήτης» και:» και τα ψιλά γράμματα «με τις δυνατότητες του
// «Ιδιοκτήτης+»»: άρθρο γενικής μπροστά σε όνομα στην ονομαστική, σε κάθε
// κάρτα και σε δύο σελίδες. Το `nameGen` υπήρχε ήδη στο lib/billing/plans.ts,
// γραμμένο ακριβώς γι' αυτό· απλώς κανείς δεν το θυμόταν τη στιγμή που
// έγραφε τη φράση.
//
// Ο ΚΑΝΟΝΑΣ. Στις δημόσιες σελίδες, ένα άρθρο γενικής (`του`, `της`) ακριβώς
// πριν από «${….name}» είναι λάθος πτώση. Γράφεται «${….nameGen}».
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { projectFiles } from './lib/git-files.mjs'

const files = projectFiles("'app/*.tsx' 'app/**/*.tsx' 'components/*.tsx' 'lib/billing/*.ts'")
  .filter(f => !/\/dashboard\//.test(f) && !/\.test\.tsx?$/.test(f))

// «του «${PLANS[x].name}» ή «του {prev.name}» μέσα σε JSX ή template literal.
const WRONG = /(?<![\p{L}])(?:του|της)\s+«?\s*(?:\$\{|\{)[^}]*\.name\s*\}/gu

const findings = []
for (const file of files) {
  const src = readFileSync(file, 'utf8')
  for (const m of src.matchAll(WRONG)) {
    const line = src.slice(0, m.index).split('\n').length
    findings.push(`  ${file}:${line}  ${m[0]}`)
  }
}

if (findings.length) {
  console.error(`\n✗ ${findings.length} ${findings.length === 1 ? 'όνομα πακέτου' : 'ονόματα πακέτων'} στην ονομαστική μετά από άρθρο γενικής:\n`)
  for (const f of findings) console.error(f)
  console.error('\n  Γράψε `nameGen` αντί για `name`: «Όλα του «Ιδιοκτήτη» και:».')
  process.exit(1)
}

console.log(`✓ κανένα όνομα πακέτου στην ονομαστική μετά από «του»/«της», σε ${files.length} αρχεία`)
