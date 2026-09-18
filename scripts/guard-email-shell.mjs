#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΕΝΑ ΚΕΛΥΦΟΣ, ΚΑΙ ΚΑΝΕΝΑ ΔΕΥΤΕΡΟ ΓΡΑΜΜΕΝΟ ΣΤΟ ΧΕΡΙ
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΜΕΤΡΗΘΗΚΕ (14/09/2026). Το `emailShell` υποσχόταν «ΜΙΑ πηγή αλήθειας για
// ΟΛΑ τα emails» στην πρώτη γραμμή του αρχείου του. Καμία συνάρτηση άκρης δεν
// το καλούσε: επτά από αυτές έγραφαν δικό τους `<!DOCTYPE html>`, ΕΝΝΕΑ φορές
// συνολικά — και εισήγαγαν μόνο τα μικρά κομμάτια (ετικέτα, κεφαλίδα).
//
// ΤΙ ΚΟΣΤΙΣΕ. Τα εννέα αντίγραφα είχαν ξεφύγει σε πλάτος (560 ή 600), σε
// χρώμα κειμένου (#111 ή #202124), σε ραδιόσχημα κουμπιού (100px ή 8px) και
// σε υποσέλιδο. Και κανένα δεν είχε σκοτεινό θέμα ούτε τα υποθετικά σχόλια
// που χρειάζεται το Outlook: η αναβάθμιση του κελύφους δεν τα άγγιζε, γιατί
// δεν περνούσαν από εκεί.
//
// ΤΙ ΕΠΙΒΑΛΛΕΙ. Μέσα στο `supabase/functions`, ολόκληρο έγγραφο HTML το
// γράφει ΜΟΝΟ το κέλυφος. Οπου χρειάζεται καινούριο σχήμα, μπαίνει ως μπλοκ
// στο `emailTemplates.ts` και το μοιράζονται όλοι — αλλιώς το επόμενο
// αντίγραφο γεννιέται την επόμενη φορά που κάποιος βιάζεται.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = 'supabase/functions'
const SHELL = join(ROOT, '_shared', 'emailTemplates.ts')

const files = []
const walk = (d) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.ts$/.test(e.name) && p !== SHELL) files.push(p)
  }
}
walk(ROOT)

const hits = []
for (const f of files) {
  const src = readFileSync(f, 'utf8')
  src.split('\n').forEach((line, i) => {
    if (/<!DOCTYPE\s+html|<html[\s>]|<body[\s>]/i.test(line)) hits.push(`${f}:${i + 1}`)
  })
}

if (hits.length) {
  console.error(`✗ ${hits.length} χειρόγραφα κελύφη email έξω από το emailShell:\n`)
  for (const h of hits) console.error('  ' + h)
  console.error(`
  Το ολόκληρο έγγραφο το γράφει ΜΟΝΟ το ${SHELL}. Καλείς:

      emailShell({ bodyHtml: eyebrow(…) + h(…) + p(…) + button(…), preheader: '…' })

  Αν λείπει σχήμα, γράψε το ΕΚΕΙ ως μπλοκ και μοιράσου το. Δεύτερο κέλυφος
  σημαίνει δεύτερη παλέτα, δεύτερο πλάτος και email χωρίς σκοτεινό θέμα.
`)
  process.exit(1)
}
console.log(`✓ ${files.length} αρχεία συναρτήσεων, ένα κέλυφος: κανένα χειρόγραφο έγγραφο email`)
