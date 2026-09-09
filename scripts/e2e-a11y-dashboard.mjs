#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΠΡΟΣΒΑΣΙΜΟΤΗΤΑ ΣΤΟΝ ΠΙΝΑΚΑ ΕΛΕΓΧΟΥ
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΕΛΕΓΧΟΤΑΝ ΩΣ ΤΩΡΑ ΚΑΙ ΤΙ ΟΧΙ. Ο `e2e-a11y.mjs` οδηγεί τους πέντε δημόσιους
// υπολογιστές με πραγματικό περιηγητή: ζωντανή περιοχή, ανακοίνωση
// αποτελέσματος, ορατή εστίαση, γλώσσα εγγράφου. Ο `e2e-keyboard.mjs` πατά Tab
// σε οκτώ χειριστήρια. Ο `e2e-touch.mjs` μετρά στόχους αφής. Και οι τρεις μαζί
// δεν άγγιζαν ΚΑΜΙΑ από τις οθόνες του πίνακα ελέγχου, δηλαδή ό,τι βλέπει ο
// χρήστης ΑΦΟΥ πληρώσει.
//
// ΓΙΑΤΙ ΠΑΝΩ ΣΤΟΝ ΠΑΓΚΟ ΚΑΙ ΟΧΙ ΣΕ ΖΩΝΤΑΝΟ ΔΙΑΚΟΜΙΣΤΗ. Ο πίνακας ελέγχου θέλει
// λογαριασμό, συνεδρία και δεδομένα. Ο πάγκος αποδίδει τα ΙΔΙΑ components με
// ψεύτικα δεδομένα, χωρίς δίκτυο: ο έλεγχος τρέχει σε κάθε ώθηση, όχι μόνο όταν
// κάποιος θυμηθεί να σηκώσει περιβάλλον.
//
// ── ΓΙΑΤΙ ΤΟ ΔΕΝΤΡΟ ΤΟΥ CHROME ΚΑΙ ΟΧΙ ΔΙΚΟΙ ΜΑΣ ΚΑΝΟΝΕΣ ΠΑΝΩ ΣΤΟ DOM ──────
// Η πρώτη γραφή ρωτούσε το DOM: «έχει aria-label; έχει κείμενο;». Εβγαλε 186
// ευρήματα, από τα οποία τα περισσότερα ΔΕΝ ήταν ευρήματα: ένα κουμπί που
// παίρνει όνομα από το κείμενο ενός εγγονιού, ένα `svg` που ο Chrome ήδη
// αγνοεί, μια εστίαση που δεν φαινόταν επειδή το `element.focus()` ΔΕΝ ενεργοποιεί
// το `:focus-visible` όπως το Tab. Ενας έλεγχος που κράζει για πράγματα που
// στέκουν είναι χειρότερος από ανύπαρκτο: τον μαθαίνεις να τον αγνοείς.
//
// Το `Accessibility.getFullAXTree` του CDP δίνει ΑΚΡΙΒΩΣ ό,τι θα διαβάσει ο
// αναγνώστης οθόνης, με τον αλγόριθμο ονόματος του ίδιου του περιηγητή. Στην
// ίδια σκηνή τα ευρήματα έπεσαν από 186 σε 13· και τα δεκατρία ήταν αληθινά.
//
// ΤΙ ΜΕΤΡΑΕΙ, ΚΑΙ ΓΙΑΤΙ ΤΟ ΚΑΘΕΝΑ ΕΙΝΑΙ ΠΡΑΓΜΑΤΙΚΟ ΕΜΠΟΔΙΟ:
//
//   1. ΟΝΟΜΑ ΣΕ ΚΑΘΕ ΧΕΙΡΙΣΤΗΡΙΟ. Ενα κουμπί χωρίς όνομα ακούγεται «κουμπί»
//      και τίποτε άλλο. Δεν μαντεύεται: το προσπερνά κανείς.
//   2. ΤΟ ΟΝΟΜΑ ΔΕΝ ΕΙΝΑΙ Η ΤΙΜΗ. Ενας επιλογέας που ονομάζεται «Όλες οι
//      κατηγορίες» ακούγεται «Όλες οι κατηγορίες, σύνθετο πλαίσιο, Όλες οι
//      κατηγορίες»: η τιμή δύο φορές, η ερώτηση («ποια κατηγορία;») ποτέ.
//   3. ΤΑ ΔΙΑΚΟΣΜΗΤΙΚΑ ΣΧΗΜΑΤΑ ΕΙΝΑΙ ΚΡΥΦΑ. Ενα `svg` χωρίς `aria-hidden`
//      μπαίνει στο δέντρο ως ανώνυμη «εικόνα». Σε λίστα σαράντα γραμμών, ο
//      χρήστης ακούει σαράντα φορές «γραφικό» ανάμεσα στα δεδομένα του.
//   4. ΚΑΘΕ ΠΑΡΑΘΥΡΟ ΕΧΕΙ ΟΝΟΜΑ. Ενα `dialog` χωρίς όνομα ανακοινώνεται ως
//      «διάλογος» και ο χρήστης δεν ξέρει τι άνοιξε.
//   5. ΟΙ ΕΠΙΚΕΦΑΛΙΔΕΣ ΔΕΝ ΠΗΔΟΥΝ ΕΠΙΠΕΔΟ. Η πλοήγηση με πλήκτρο επικεφαλίδας
//      είναι ο κύριος τρόπος ανάγνωσης μιας πυκνής οθόνης.
//   6. Η ΕΣΤΙΑΣΗ ΦΑΙΝΕΤΑΙ, ΜΕ ΑΛΗΘΙΝΟ TAB. Ο δακτύλιος του `:focus-visible`
//      εμφανίζεται μόνο σε πλοήγηση πληκτρολογίου· γι' αυτό εδώ πατιέται Tab
//      και όχι `focus()`.
//   7. ΤΟ ΚΕΙΜΕΝΟ ΔΙΑΒΑΖΕΤΑΙ. Λόγος φωτεινότητας προς το φόντο κατά WCAG 2.2
//      AA: 4,5:1 για κανονικό κείμενο, 3:1 για μεγάλο (≥24px, ή ≥18,66px
//      έντονο). Ελειπε — και ήταν το μόνο από τα επτά που δεν μετριόταν
//      πουθενά στο έργο.
//
//      ΤΙ ΒΡΗΚΕ ΜΟΛΙΣ ΜΠΗΚΕ. Τα tokens του θέματος είναι όλα εντάξει (5,4:1 ώς
//      13,4:1 πάνω σε κάθε επιφάνεια). Το πρόβλημα ήταν η ΔΙΑΦΑΝΕΙΑ πάνω τους:
//      οι μετρητές των φίλτρων στο Αρχείο και στις Επαφές έγραφαν
//      `opacity: 0.6` και έπεφταν στο 3,46:1 στα 11px — δηλαδή το ΝΟΥΜΕΡΟ, που
//      είναι όλη η πληροφορία του φίλτρου, ήταν το λιγότερο ευανάγνωστο πράγμα
//      στη σειρά. Το σύμβολο του ευρώ στο Ημερολόγιο έβγαινε 4,13:1.
//
//      ΤΑ ΑΠΕΝΕΡΓΟΠΟΙΗΜΕΝΑ ΕΞΑΙΡΟΥΝΤΑΙ, ΚΑΙ ΤΟ ΛΕΕΙ ΤΟ ΠΡΟΤΥΠΟ. Το WCAG 1.4.3
//      εξαιρεί ρητά τα «inactive user interface components»: το ξεθώριασμα ΕΙΝΑΙ
//      το μήνυμα «δεν πατιέται τώρα». Χωρίς την εξαίρεση, ο έλεγχος θα ζητούσε
//      να γίνει ευανάγνωστο ακριβώς ό,τι πρέπει να φαίνεται ανενεργό.
//
//      Το ίδιο και το `.sr-only`: κείμενο ΓΙΑ τον αναγνώστη οθόνης, επίτηδες
//      αόρατο στο μάτι. Μετρήθηκε 1,3:1 — σωστή μέτρηση, λάθος ερώτηση.
//
// ΚΑΘΕ ΕΥΡΗΜΑ ΤΥΠΩΝΕΤΑΙ ΜΕ ΤΗ ΣΚΗΝΗ ΚΑΙ ΤΟ ΣΤΟΙΧΕΙΟ. Χωρίς ευρήματα δεν
// τυπώνεται τίποτα πέρα από τη σύνοψη: ο έλεγχος που γεμίζει την οθόνη με
// πράσινο δεν διαβάζεται.
// ═══════════════════════════════════════════════════════════════════════════
import { createRequire } from 'node:module'
import { chromePath } from './lib/chrome.mjs'
import { SCENES } from './lib/scenes.mjs'
import { benchUrl } from './lib/paths.mjs'

const require = createRequire(import.meta.url)
let pkg
try { pkg = require('playwright-core') }
catch { console.error('Λείπει το playwright-core. Τρέξε: npm i -D playwright-core'); process.exit(2) }
const { chromium } = pkg

// Οι ίδιες σκηνές με τη σάρωση διάταξης. Γραμμένες ρητά, ώστε μια σκηνή που
// προστίθεται στον πάγκο να μπαίνει ΣΥΝΕΙΔΗΤΑ και εδώ.

const ONLY = process.env.E2E_ONLY ? process.env.E2E_ONLY.split(',') : null
const RUN = ONLY ? SCENES.filter(s => ONLY.includes(s)) : SCENES

/** Οι ρόλοι που ο χρήστης ΧΕΙΡΙΖΕΤΑΙ. Χωρίς όνομα, δεν χειρίζονται. */
const INTERACTIVE = new Set(['button', 'link', 'combobox', 'textbox', 'checkbox', 'switch',
  'tab', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'searchbox', 'slider', 'spinbutton', 'radio'])

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || chromePath(),
  args: ['--no-sandbox'],
})

const LABELS = {
  anonymous: 'χειριστήριο χωρίς όνομα',
  selfNamed: 'επιλογέας που λέει την τιμή του αντί για την ερώτηση',
  loudImage: 'σχήμα που μπαίνει στο δέντρο χωρίς να λέει κάτι',
  namelessDialog: 'παράθυρο χωρίς όνομα',
  headingJump: 'επικεφαλίδα που πηδά επίπεδο',
  blindFocus: 'εστίαση που δεν φαίνεται με Tab',
  lowContrast: 'κείμενο κάτω από την αντίθεση WCAG AA',
}

let findings = 0

for (const scene of RUN) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'el-GR' })
  const page = await ctx.newPage()
  await page.goto(benchUrl(scene), { waitUntil: 'load' })
  await page.waitForTimeout(1800)

  const found = { anonymous: [], selfNamed: [], loudImage: [], namelessDialog: [], headingJump: [], blindFocus: [], lowContrast: [] }

  // ── ΑΝΤΙΘΕΣΗ ────────────────────────────────────────────────────────────
  // Το φόντο βρίσκεται ανεβαίνοντας τους προγόνους ώσπου να πάψει να είναι
  // διάφανο· αλλιώς κάθε στοιχείο θα φαινόταν να κάθεται σε λευκό.
  found.lowContrast.push(...await page.evaluate(() => {
    const lum = c => { const [r, g, b] = c.map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
    const rgba = s => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null
      const p = m[1].split(',').map(x => parseFloat(x)); return { c: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 } }
    const over = (f, b) => f.c.map((v, i) => v * f.a + b[i] * (1 - f.a))
    const bgOf = el => {
      let n = el, acc = null
      while (n && n !== document.documentElement) {
        const b = rgba(getComputedStyle(n).backgroundColor)
        if (b && b.a > 0) { acc = acc ? over({ c: acc, a: 1 }, over(b, [255, 255, 255])) : over(b, [255, 255, 255]); if (b.a === 1) return acc }
        n = n.parentElement
      }
      const root = rgba(getComputedStyle(document.documentElement).backgroundColor)
      return acc || (root && root.a > 0 ? over(root, [255, 255, 255]) : [255, 255, 255])
    }
    const skip = new Set(document.querySelectorAll('[aria-hidden="true"], [aria-hidden="true"] *, .skeleton, .skeleton *, .sr-only, .sr-only *'))
    const out = []
    for (const el of document.querySelectorAll('body *')) {
      if (skip.has(el)) continue
      if (el.closest('[disabled], [aria-disabled="true"]')) continue
      const r = el.getBoundingClientRect()
      if (!(r.width > 0 && r.height > 0) || getComputedStyle(el).visibility === 'hidden') continue
      // Μόνο στοιχεία με ΔΙΚΟ τους κείμενο: αλλιώς κάθε πρόγονος κρίνεται ξανά.
      const own = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()).map(n => n.textContent.trim()).join(' ')
      if (!own) continue
      const cs = getComputedStyle(el)
      if (cs.opacity === '0') continue
      const f = rgba(cs.color); if (!f) continue
      const bg = bgOf(el)
      const fg = over({ c: f.c, a: f.a * parseFloat(cs.opacity || '1') }, bg)
      const L1 = lum(fg), L2 = lum(bg)
      const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
      const px = parseFloat(cs.fontSize), bold = Number(cs.fontWeight) >= 700
      const need = px >= 24 || (bold && px >= 18.66) ? 3 : 4.5
      if (ratio < need - 0.05) out.push(`«${own.slice(0, 26)}» ${Math.round(ratio * 100) / 100}:1 (θέλει ${need}, ${Math.round(px)}px)`)
    }
    return [...new Set(out)]
  }))

  // ── ΤΟ ΔΕΝΤΡΟ ΟΠΩΣ ΤΟ ΒΛΕΠΕΙ Ο ΑΝΑΓΝΩΣΤΗΣ ────────────────────────────────
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Accessibility.enable')
  const { nodes } = await cdp.send('Accessibility.getFullAXTree')
  const live = nodes.filter(n => !n.ignored)
  const roleOf = n => n.role?.value
  const nameOf = n => (n.name?.value || '').trim()

  // Το `where` λύνει τον κόμβο σε πραγματικό στοιχείο, ώστε το εύρημα να λέει
  // ΠΟΥ είναι και όχι μόνο ότι υπάρχει.
  const where = async (n) => {
    try {
      const { object } = await cdp.send('DOM.resolveNode', { backendNodeId: n.backendDOMNodeId })
      const { result } = await cdp.send('Runtime.callFunctionOn', {
        objectId: object.objectId, returnByValue: true,
        functionDeclaration: `function(){
          const cls = typeof this.className === 'string' && this.className ? '.' + this.className.trim().split(/\\s+/)[0] : '';
          const near = (this.parentElement ? (this.parentElement.innerText || '') : '').replace(/\\s+/g,' ').trim().slice(0, 42);
          return this.tagName.toLowerCase() + cls + (near ? ' («' + near + '»)' : '');
        }`,
      })
      return result.value || roleOf(n)
    } catch { return roleOf(n) }
  }

  for (const n of live) {
    const role = roleOf(n)
    if (INTERACTIVE.has(role) && !nameOf(n)) found.anonymous.push(await where(n))
    if (role === 'image' && !nameOf(n)) found.loudImage.push(await where(n))
    if (role === 'dialog' && !nameOf(n)) found.namelessDialog.push(await where(n))
  }

  // Επίπεδα επικεφαλίδων, με τη σειρά που τα συναντά ο χρήστης.
  let prev = 0
  for (const n of live.filter(x => roleOf(x) === 'heading')) {
    const lvl = Number((n.properties || []).find(p => p.name === 'level')?.value?.value || 0)
    if (prev && lvl > prev + 1) found.headingJump.push(`h${prev} → h${lvl} («${nameOf(n).slice(0, 40)}»)`)
    if (lvl) prev = lvl
  }

  // ── Ο ΕΠΙΛΟΓΕΑΣ ΠΟΥ ΛΕΕΙ ΤΗΝ ΤΙΜΗ ΤΟΥ ────────────────────────────────────
  // Αυτό ΔΕΝ φαίνεται στο δέντρο ως λάθος: το όνομα υπάρχει. Φαίνεται μόνο αν
  // συγκρίνεις το όνομα με ό,τι είναι γραμμένο ΜΕΣΑ στο χειριστήριο.
  found.selfNamed.push(...await page.evaluate(() => {
    const out = []
    for (const el of document.querySelectorAll('[role="combobox"]')) {
      const label = (el.getAttribute('aria-label') || '').trim()
      const shown = (el.innerText || '').replace(/\s+/g, ' ').trim()
      if (label && shown && label === shown) {
        const near = (el.parentElement?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 42)
        out.push(`${el.tagName.toLowerCase()} («${near}») → «${label}»`)
      }
    }
    return out
  }))

  // ── Η ΕΣΤΙΑΣΗ, ΜΕ ΑΛΗΘΙΝΟ TAB ────────────────────────────────────────────
  // Ογδόντα πατήματα φτάνουν και για την πιο πυκνή σκηνή. Σε κάθε στάση
  // ζητείται ΟΡΑΤΟ σημάδι: δακτύλιος ή σκιά. Η ίδια η στάση καταγράφεται μία
  // φορά ανά στοιχείο, ώστε ένα χειριστήριο σε λίστα να μη μετρηθεί σαράντα.
  // ΤΟ ΣΗΜΑΔΙ ΤΗΣ ΕΣΤΙΑΣΗΣ ΜΕΤΡΙΕΤΑΙ ΩΣ ΔΙΑΦΟΡΑ, ΟΧΙ ΩΣ ΚΑΝΟΝΑΣ.
  // Πρώτη γραφή ρωτούσε το ίδιο το στοιχείο αν έχει περίγραμμα· δεύτερη ρωτούσε
  // το φύλλο στυλ αν υπάρχει κανόνας `:focus-visible`. Και οι δύο έπεφταν έξω:
  // ο διακόπτης ακινήτου ζωγραφίζει το δαχτυλίδι στο ΠΑΙΔΙ του· ο πάγκος
  // φορτώνει το φύλλο από `file://`, όπου ο περιηγητής ΑΠΑΓΟΡΕΥΕΙ την ανάγνωση
  // των κανόνων (SecurityError) — δηλαδή ο έλεγχος τύφλωνε τον εαυτό του.
  //
  // Η ΕΡΩΤΗΣΗ ΠΟΥ ΕΧΕΙ ΝΟΗΜΑ ΕΙΝΑΙ ΟΠΤΙΚΗ: αλλάζει ΚΑΤΙ στην όψη του στοιχείου
  // ή των παιδιών του όταν φτάσει σε αυτό το Tab; Κρατιέται η υπογραφή του
  // αεστίαστου (περίγραμμα, σκιά, περίγραμμα πλαισίου, φόντο, χρώμα) πριν από
  // τον περίπατο και συγκρίνεται με την υπογραφή του εστιασμένου.
  // ΤΟ ΔΑΧΤΥΛΙΔΙ ΜΠΟΡΕΙ ΝΑ ΖΩΓΡΑΦΙΖΕΤΑΙ ΚΑΙ ΣΤΟΝ ΓΟΝΕΑ. Το αριθμητικό πεδίο
  // (`po-field-inner`) είναι ένα `input` μέσα σε κουτί που κρατά το περίγραμμα
  // και τη σκιά: εστιάζεται το παιδί, αλλάζει όψη ο γονέας. Χωρίς τους δύο
  // προγόνους στην υπογραφή, ο έλεγχος ανέφερε ως τυφλά έξι πεδία που στην
  // πραγματικότητα ανάβουν κανονικά.
  const SIG = `function(){
    const one = (e) => { const c = getComputedStyle(e);
      return [c.outline, c.boxShadow, c.borderColor, c.backgroundColor, c.color].join('|') };
    const up = [];
    let a = this.parentElement;
    for (let i = 0; i < 2 && a; i++, a = a.parentElement) up.push(a);
    return [...up, this, ...this.querySelectorAll('*')].slice(0, 10).map(one).join('#');
  }`
  await page.evaluate(() => {
    const sel = 'a[href], button, input:not([type=hidden]), select, textarea, [tabindex]:not([tabindex="-1"]), [role="button"], [role="combobox"], [role="switch"]'
    document.querySelectorAll(sel).forEach((el, i) => { el.setAttribute('data-a11y-idx', String(i)) })
  })
  // Η ΦΩΤΟΓΡΑΦΙΑ ΤΟΥ ΑΕΣΤΙΑΣΤΟΥ ΠΡΕΠΕΙ ΝΑ ΕΙΝΑΙ ΟΝΤΩΣ ΑΕΣΤΙΑΣΤΗ. Οταν μια οθόνη
  // εστιάζει μόνη της ένα πεδίο (αναζήτηση, πρώτο πεδίο φόρμας), η υπογραφή του
  // «πριν» γραφόταν ΜΕ την εστίαση επάνω και η σύγκριση έβγαινε ίδια: ο έλεγχος
  // ανέφερε ως τυφλό ένα πεδίο που δείχνει κανονικά την εστίασή του.
  await page.evaluate(() => (document.activeElement)?.blur?.())
  const before = await page.evaluate((sigSrc) => {
    const fn = new Function('return ' + sigSrc)()
    const out = {}
    document.querySelectorAll('[data-a11y-idx]').forEach(el => { out[el.getAttribute('data-a11y-idx')] = fn.call(el) })
    return out
  }, SIG)

  await page.evaluate(() => (document.activeElement)?.blur?.())
  const seen = new Set()
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press('Tab')
    const stop = await page.evaluate((sigSrc) => {
      const el = document.activeElement
      if (!el || el === document.body) return null
      const fn = new Function('return ' + sigSrc)()
      const idx = el.getAttribute('data-a11y-idx')
      const t = (el.innerText || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 40)
      const cls = typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/)[0] : ''
      return { idx, sig: fn.call(el), key: el.tagName.toLowerCase() + cls + t,
        label: `${el.tagName.toLowerCase()}${cls}${t ? ` («${t}»)` : ''}` }
    }, SIG)
    if (!stop) break
    if (seen.has(stop.key)) continue
    seen.add(stop.key)
    // Χωρίς καταγεγραμμένη υπογραφή (στοιχείο που γεννήθηκε στην πορεία) δεν
    // βγαίνει συμπέρασμα: ο έλεγχος σιωπά αντί να μαντέψει.
    if (stop.idx != null && before[stop.idx] && before[stop.idx] === stop.sig) found.blindFocus.push(stop.label)
  }

  const lines = []
  for (const [key, list] of Object.entries(found)) {
    const uniq = [...new Set(list)]
    if (!uniq.length) continue
    findings += uniq.length
    lines.push(`   ${LABELS[key]}: ${uniq.length}`)
    for (const u of uniq.slice(0, 6)) lines.push(`      · ${u}`)
    if (uniq.length > 6) lines.push(`      · και άλλα ${uniq.length - 6}`)
  }
  if (lines.length) { console.log(` ${scene}`); console.log(lines.join('\n')) }
  await ctx.close()
}

await browser.close()
console.log('')
console.log(findings === 0
  ? 'Προσβασιμότητα πίνακα ελέγχου — κάθε χειριστήριο έχει όνομα, κάθε εστίαση φαίνεται, κάθε κείμενο διαβάζεται, κανένα σχήμα δεν μιλά χωρίς λόγο'
  : `Προσβασιμότητα πίνακα ελέγχου — ${findings} ευρήματα`)
process.exit(findings === 0 ? 0 : 1)
