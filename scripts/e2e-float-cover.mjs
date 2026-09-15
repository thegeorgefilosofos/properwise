#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΚΑΝΕΝΑ ΠΛΩΤΟ ΔΕΝ ΚΑΘΕΤΑΙ ΠΑΝΩ ΣΕ ΧΕΙΡΙΣΤΗΡΙΟ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΣΦΑΛΜΑ, ΟΠΩΣ ΒΡΕΘΗΚΕ (15/09/2026, Chromium, 390×844 — το πιο κοινό
// τηλέφωνο). Το κουμπί «Σύνδεση» καθόταν στο 593 με ύψος 44· η ενημέρωση για
// cookies άνοιγε στο 610. Το `elementFromPoint` στο ΚΕΝΤΡΟ του κουμπιού
// επέστρεφε την ενημέρωση. Και η σελίδα σύνδεσης χωρά ολόκληρη στην οθόνη,
// άρα δεν κυλάει: δεν υπήρχε τρόπος να βγει το κουμπί από κάτω της. Οποιος
// δεν πατούσε πρώτα «Το κατάλαβα» ΔΕΝ μπορούσε να συνδεθεί, τελεία.
//
// ΓΙΑΤΙ ΔΕΝ ΤΟ ΕΙΔΕ ΚΑΝΕΝΑΣ ΑΠΟ ΤΟΥΣ ΟΚΤΩ ΣΑΡΩΤΕΣ. Ολοι καλούν πρώτα το
// `dismissConsent` — και το σχόλιο δίπλα του το γράφει κιόλας: «κλείνει τη
// συγκατάθεση cookies, που αλλιώς σκεπάζει τον πάτο κάθε σελίδας». Δηλαδή το
// ξέραμε, το παρακάμπταμε για να μετρήσουμε τα ΑΛΛΑ — και έτσι η μόνη οθόνη
// όπου το σκέπασμα ήταν ΜΟΙΡΑΙΟ δεν ελέγχθηκε ποτέ.
//
// ΤΙ ΕΛΕΓΧΕΙ. Με την ενημέρωση ΟΡΘΙΑ, σε κάθε δημόσια σελίδα και σε κάθε
// πλάτος: για κάθε ορατό χειριστήριο μέσα στο κάδρο, το `elementFromPoint`
// στο κέντρο του πρέπει να επιστρέφει ΤΟ ΙΔΙΟ. Το κέντρο και όχι η γωνία,
// γιατί εκεί πέφτει ο αντίχειρας — και μια επικάλυψη δύο εικονοστοιχείων στην
// άκρη δεν εμποδίζει κανέναν.
//
// ΚΑΙ ΜΕΤΡΑ ΤΗ ΔΙΕΞΟΔΟ. Οταν η σελίδα κυλάει, ένα σκεπασμένο κουμπί είναι
// ενόχληση: κατεβάζεις και το ξεσκεπάζεις. Οταν ΔΕΝ κυλάει, είναι αδιέξοδο.
// Το δεύτερο αναφέρεται ως «ΑΔΙΕΞΟΔΟ» και είναι ο λόγος που ο σαρωτής υπάρχει.
// ═══════════════════════════════════════════════════════════════════════════
import { launchEngine, engineLabel } from './lib/engine.mjs'
import { PUBLIC, SIZES, BASE } from './rendered/targets.mjs'
import { abortIfStyleless } from './lib/served-css.mjs'

const browser = await launchEngine()

try {
  const r = await fetch(BASE + '/', { redirect: 'manual' })
  if (!r.ok && r.status >= 500) throw new Error('HTTP ' + r.status)
} catch (e) {
  console.error(`✗ ο διακομιστής δεν απαντά στο ${BASE} (${e.message})\n  Τρέξε: npm run build && npm run start`)
  await browser.close()
  process.exit(2)
}
await abortIfStyleless(browser, BASE)

console.log(`  ${PUBLIC.length} δημόσιες σελίδες × ${SIZES.length} μεγέθη · μηχανή ${engineLabel()}`)

const findings = []
let controls = 0

for (const [label, w, h] of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 1024, isMobile: w < 1024 })
  const page = await ctx.newPage()
  for (const path of PUBLIC) {
    await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 30000 })
    // ΚΑΜΙΑ ΑΠΟΡΡΙΨΗ ΣΥΓΚΑΤΑΘΕΣΗΣ: αυτό ΕΙΝΑΙ ο έλεγχος.
    await page.waitForTimeout(350)
    const res = await page.evaluate(() => {
      const out = { hits: [], n: 0, scrolls: document.documentElement.scrollHeight > window.innerHeight + 2 }
      const SEL = 'button, a[href], input, select, textarea, [role="button"], [role="link"], [tabindex]:not([tabindex="-1"])'
      for (const el of document.querySelectorAll(SEL)) {
        const s = getComputedStyle(el)
        if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity < 0.05 || s.pointerEvents === 'none') continue
        const r = el.getBoundingClientRect()
        if (r.width < 6 || r.height < 6) continue
        if (r.bottom <= 0 || r.top >= window.innerHeight || r.right <= 0 || r.left >= window.innerWidth) continue
        out.n++
        const cx = Math.min(window.innerWidth - 1, Math.max(0, r.left + r.width / 2))
        const cy = Math.min(window.innerHeight - 1, Math.max(0, r.top + r.height / 2))
        const top = document.elementFromPoint(cx, cy)
        if (!top || top === el || el.contains(top) || top.contains(el)) continue
        // Ποιος το σκεπάζει; Και είναι πλωτό;
        let f = top, pos = ''
        while (f && f !== document.body) {
          const ps = getComputedStyle(f).position
          if (ps === 'fixed' || ps === 'sticky') { pos = ps; break }
          f = f.parentElement
        }
        if (!pos) continue
        const name = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 34)
          || el.getAttribute('aria-label') || el.getAttribute('name') || el.tagName.toLowerCase()
        const by = (f.getAttribute('aria-label') || f.className.toString().split(' ').filter(Boolean)[0] || f.tagName.toLowerCase())
        out.hits.push({ name, by, pos, tag: el.tagName.toLowerCase() })
      }
      return out
    })
    controls += res.n
    for (const hit of res.hits) {
      findings.push({ label, w, h, path, ...hit, dead: !res.scrolls })
    }
  }
  await ctx.close()
  const bad = findings.filter(f => f.w === w && f.h === h).length
  console.log(`   ${String(w).padStart(4)}×${String(h).padEnd(4)} ${label.padEnd(14)} ${bad ? `✗ ${bad}` : '·'}`)
}

await browser.close()

// ΤΟ ΚΑΤΩΦΛΙ ΕΙΝΑΙ Η ΔΙΕΞΟΔΟΣ, ΟΧΙ Η ΕΠΙΚΑΛΥΨΗ. Σε σελίδα που κυλάει, ένα
// χειριστήριο κάτω από την ενημέρωση ξεσκεπάζεται με μισή κίνηση του δαχτύλου:
// έτσι δουλεύει κάθε μπάρα cookies στον κόσμο και δεν είναι σφάλμα. Σφάλμα
// είναι όταν ΔΕΝ υπάρχει κύλιση, γιατί τότε δεν υπάρχει και κίνηση που να το
// σώσει. Σαρωτής που κράζει και για τα δύο μαθαίνει τον αναγνώστη να τον
// αγνοεί — και την επόμενη φορά που θα κράξει για αδιέξοδο, δεν θα τον ακούσει.
const dead = findings.filter(f => f.dead)
const soft = findings.length - dead.length

if (dead.length) {
  console.error(`\n✗ ${dead.length} χειριστήρια ΑΠΡΟΣΙΤΑ: σκεπασμένα από πλωτό στοιχείο σε σελίδα που δεν κυλάει\n`)
  for (const f of dead.slice(0, 40)) {
    console.error(`  ${String(f.w).padStart(4)}×${String(f.h).padEnd(4)} ${f.path.padEnd(28)} «${f.name}» ← ${f.by} (${f.pos})`)
  }
  if (dead.length > 40) console.error(`  … και άλλα ${dead.length - 40}`)
  console.error(`
  Το πλωτό στοιχείο δημοσιεύει τη ΖΩΝΗ που πιάνει και η διάταξη τη βγάζει από
  το ύψος της — όπως κάνει το «--cookie-h» (app/CookieConsent.tsx, globals.css).
  Σταθερός αριθμός γραμμένος στο χέρι είναι λάθος: η ζώνη αλλάζει με το πλάτος.
  Και γέμισμα δεν αρκεί: σε δοχείο που κεντράρει, μετακινεί κατά το ΜΙΣΟ.
`)
  process.exit(1)
}
console.log(`\nΠλωτά και χειριστήρια — κανένα από τα ${controls} δεν είναι απρόσιτο, με την ενημέρωση για cookies ΟΡΘΙΑ`)
if (soft) console.log(`   (${soft} σκεπασμένα σε σελίδες που κυλούν: ξεσκεπάζονται με κύλιση, δεν είναι αδιέξοδο)`)
