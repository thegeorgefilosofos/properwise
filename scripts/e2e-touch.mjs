#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΣΕΡΝΕΤΑΙ Η ΝΟΑ ΜΕ ΤΟ ΔΑΧΤΥΛΟ;
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΚΛΕΙΝΕΙ: το πλωτό κουμπί του βοηθού σέρνεται με pointer
// events. Με ποντίκι δουλεύει. Με δάχτυλο ο περιηγητής κρίνει μόνος του,
// στην πρώτη κίνηση, αν η χειρονομία ανήκει στη σελίδα (κύλιση) ή στο
// στοιχείο. Οταν την πάρει η σελίδα, στέλνει `pointercancel` και ΣΤΑΜΑΤΑ να
// στέλνει `pointermove`: το κουμπί μένει κολλημένο εκεί που ήταν.
//
// ΓΙΑΤΙ CDP ΚΑΙ ΟΧΙ ΣΥΝΘΕΤΙΚΑ ΣΥΜΒΑΝΤΑ: ένα `new PointerEvent('pointerdown')`
// από JavaScript παρακάμπτει ολόκληρη τη μηχανή χειρονομιών του περιηγητή.
// Θα περνούσε πράσινο ακόμη και με το σφάλμα ζωντανό. Τα `Input.dispatchTouchEvent`
// είναι πραγματικά αγγίγματα: περνούν από τους κανόνες `touch-action`.
//
// ΟΤΙ ΔΕΝ ΕΙΝΑΙ ΚΕΝΟΣ, ΑΠΟΔΕΙΓΜΕΝΟ ΜΕ ΤΡΕΙΣ ΜΕΤΑΛΛΑΞΕΙΣ. Καθεμιά επαναφέρει
// ένα κομμάτι του σφάλματος και ο έλεγχος κοκκινίζει:
//
//   φεύγει το touch-action:none                  10 από 22 κόβουν
//   φεύγει το μηδένισμα του δείκτη στο pointerdown  4 από 22 κόβουν
//   φεύγει ο ακροατής του pointercancel             2 από 22 κόβουν
//   γυρίζει το κούμπωμα στο parseFloat του calc()   6 από 22 κόβουν
//
// ΚΑΙ ΕΝΑ ΚΕΝΟ, ΓΡΑΜΜΕΝΟ ΩΣΤΕ ΝΑ ΜΗ ΘΕΩΡΗΘΕΙ ΚΑΛΥΨΗ. Αν φύγει η σύλληψη του
// δείκτη (setPointerCapture), ο πάγκος μένει ΟΛΟΚΛΗΡΟΣ πράσινος: μετρήθηκε.
// Η σύλληψη μετράει μόνο σε γρήγορο σύρσιμο που προσπερνά το κουμπί, ενώ κάθε
// χειρονομία εδώ ξεκινά και μένει πάνω του. Οποιος τη σβήσει δεν θα το μάθει
// από εδώ.
//
// ── ΤΟ ΣΥΜΒΟΛΑΙΟ ΑΛΛΑΞΕ, ΚΑΙ Ο ΠΑΓΚΟΣ ΔΥΝΑΜΩΣΕ ─────────────────────────────
// Το κουμπί έμενε όπου το άφηνε το δάχτυλο. Σε ταμπλέτα αυτό σήμαινε «Ν» πάνω
// σε ποσά, σε κουμπιά και σε λεζάντες γραφημάτων: χώρο κρατά ΜΟΝΟ η κάτω άκρη
// της διάταξης, οπότε καμία άλλη θέση δεν είναι ασφαλής. Πλέον το σύρσιμο
// υπάρχει ΟΛΟ και ο προορισμός είναι μία από τις δύο κάτω γωνίες.
//
// ΤΙ ΔΕΝ ΧΑΘΗΚΕ ΑΠΟ ΤΟΝ ΕΛΕΓΧΟ. Το αρχικό σφάλμα ήταν «ο περιηγητής παίρνει τη
// χειρονομία και το κουμπί δεν ακολουθεί το δάχτυλο». Αυτό μετριέται ΟΣΟ το
// δάχτυλο είναι ακόμη κάτω, πριν το κούμπωμα — αλλιώς ένα κουμπί που δεν
// σέρνεται καθόλου θα περνούσε πράσινο, αφού καταλήγει στην ίδια γωνία.
//
// ΚΑΙ ΤΙ ΠΙΑΣΕ Η ΝΕΑ ΜΟΡΦΗ. Το κούμπωμα υπολόγιζε μόνο του την κάτω άκρη με
// parseFloat πάνω σε τιμή calc(): NaN, πτώση στα 24. Το κουμπί προσγειωνόταν
// 58 εικονοστοιχεία ΧΑΜΗΛΟΤΕΡΑ από το σπίτι του — πάνω στην κάτω πλοήγηση,
// δηλαδή ακριβώς το σφάλμα που το κούμπωμα ήρθε να λύσει. Γι' αυτό η γωνία δεν
// συγκρίνεται με τύπο (θα ήταν ταυτολογία με τον κώδικα) αλλά με τη ΘΕΣΗ ΠΟΥ
// ΕΙΧΕ ΤΟ ΚΟΥΜΠΙ ΠΡΙΝ ΤΟ ΑΓΓΙΞΕΙ ΚΑΝΕΙΣ, όπως την έβαλε το CSS.
//
//     npm run e2e:touch
// ═══════════════════════════════════════════════════════════════════════════
import { chromePath } from './lib/chrome.mjs'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
let pkg
try { pkg = require('playwright-core') }
catch { console.error('Λείπει το playwright-core. Τρέξε: npm i -D playwright-core'); process.exit(2) }
const { chromium } = pkg

const URL_BENCH = pathToFileURL(join(process.cwd(), '.perf-bench/touch.html')).href

/** Οι συσκευές αφής που κρίνουν: τηλέφωνο και ταμπλέτα, κάθετα. */
const DEVICES = [
  { name: 'iPhone SE 375', viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { name: 'iPad 820', viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
]

let pass = 0, fail = 0
const ok = (n, c) => { if (c) pass++; else { fail++; console.log('  ✗ ' + n) } }

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || chromePath(),
  args: ['--no-sandbox'],
})

/**
 * Ενα ΑΛΗΘΙΝΟ σύρσιμο με το δάχτυλο, βήμα βήμα, όπως το κάνει ο άνθρωπος.
 *
 * Τα ενδιάμεσα βήματα δεν είναι διακοσμητικά: ο περιηγητής αποφασίζει ΠΟΙΟΣ
 * παίρνει τη χειρονομία στην πρώτη ή δεύτερη κίνηση. Ενα μοναδικό άλμα από την
 * αρχή στο τέλος δεν του δίνει ποτέ την ευκαιρία να τη διεκδικήσει, δηλαδή
 * κρύβει ακριβώς το σφάλμα που ψάχνουμε.
 */
async function fingerHold(cdp, from, to, steps = 12) {
  const pt = (x, y) => [{ x: Math.round(x), y: Math.round(y), radiusX: 12, radiusY: 12, force: 1 }]
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(from.x, from.y) })
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: pt(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t),
    })
  }
}

/** Το δάχτυλο φεύγει από το τζάμι. Εδώ — και μόνο εδώ — κουμπώνει το κουμπί. */
const fingerLift = (cdp) => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })

async function fingerDrag(cdp, from, to, steps = 12) {
  await fingerHold(cdp, from, to, steps)
  await fingerLift(cdp)
}

/**
 * ΤΟ `window.scrollY` ΔΕΝ ΚΙΝΕΙΤΑΙ ΕΔΩ ΚΑΙ ΘΑ ΗΤΑΝ ΚΕΝΟΣ ΕΛΕΓΧΟΣ. Το κέλυφος
 * κυλά μέσα στο `.app-content`, όχι στο παράθυρο: ένας έλεγχος που κοιτούσε
 * μόνο το παράθυρο θα περνούσε πράσινος ενώ η σελίδα από κάτω κυλούσε κανονικά.
 * Το άθροισμα ΚΑΘΕ κύλισης της σελίδας είναι το μόνο μέγεθος που λέει αλήθεια.
 */
const SCROLLED = () => {
  window.scrolled = () => {
    let t = window.scrollY
    for (const el of document.querySelectorAll('*')) t += el.scrollTop
    return t
  }
}

const box = (p, sel) => p.evaluate(s => {
  const el = document.querySelector(s)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }
}, sel)

for (const d of DEVICES) {
  console.log(`\n${d.name}`)
  const ctx = await browser.newContext({ ...d, locale: 'el-GR' })
  await ctx.addInitScript(SCROLLED)
  const p = await ctx.newPage()
  const cdp = await ctx.newCDPSession(p)
  await p.goto(URL_BENCH, { waitUntil: 'load' })
  await p.waitForSelector('.pa-fab', { timeout: 8000 })

  // ── 1. ΤΟ `touch-action` ΤΟΥ ΚΟΥΜΠΙΟΥ ΔΕΝ ΑΦΗΝΕΙ ΤΗ ΣΕΛΙΔΑ ΝΑ ΤΟ ΠΑΡΕΙ ──
  const ta = await p.evaluate(() => getComputedStyle(document.querySelector('.pa-fab')).touchAction)
  ok(`το κουμπί δηλώνει touch-action:none (είναι «${ta}»)`, ta === 'none')

  // ── 2. ΤΟ ΚΑΘΕΤΟ ΣΥΡΣΙΜΟ ΤΟ ΜΕΤΑΚΙΝΕΙ, ΔΕΝ ΚΥΛΑ ΤΗ ΣΕΛΙΔΑ ──────────────
  // Το κάθετο είναι το χειρότερο: ακριβώς η κατεύθυνση που διεκδικεί η σελίδα.
  // Η ΘΕΣΗ ΤΟΥ CSS, ΠΡΙΝ Η JAVASCRIPT ΤΟΠΟΘΕΤΗΣΕΙ ΟΤΙΔΗΠΟΤΕ. Είναι το μέτρο με
  // το οποίο κρίνεται κάθε προσγείωση παρακάτω.
  const home = await box(p, '.pa-fab')
  const view = await p.evaluate(() => ({ vw: innerWidth, vh: innerHeight }))
  const before = home
  const scrollBefore = await p.evaluate(() => scrolled())
  await fingerHold(cdp, { x: before.cx, y: before.cy }, { x: before.cx, y: before.cy - 220 })
  await p.waitForTimeout(60)
  // ΟΣΟ ΤΟ ΔΑΧΤΥΛΟ ΕΙΝΑΙ ΑΚΟΜΗ ΚΑΤΩ: εδώ κρίνεται αν ο περιηγητής άφησε τη
  // χειρονομία στο κουμπί ή την πήρε η σελίδα.
  const held = await box(p, '.pa-fab')
  const scrollAfter = await p.evaluate(() => scrolled())
  const moved = before.y - held.y
  ok(`το κάθετο σύρσιμο μετακινεί το κουμπί (μετακινήθηκε ${Math.round(moved)}px από 220)`, moved > 180)
  ok(`και ΔΕΝ κυλά τη σελίδα (κύλησε ${Math.round(scrollAfter - scrollBefore)}px)`, Math.abs(scrollAfter - scrollBefore) < 4)

  // ── 2β. ΚΑΙ ΜΟΛΙΣ ΦΥΓΕΙ ΤΟ ΔΑΧΤΥΛΟ, ΚΟΥΜΠΩΝΕΙ ΣΤΟ ΣΠΙΤΙ ΤΟΥ ────────────
  await fingerLift(cdp)
  await p.waitForTimeout(150)
  const parked = await box(p, '.pa-fab')
  ok(`το σήκωμα του δαχτύλου το γυρίζει στην κάτω δεξιά γωνία (${Math.round(parked.x)},${Math.round(parked.y)} έναντι ${Math.round(home.x)},${Math.round(home.y)})`,
    Math.abs(parked.x - home.x) < 3 && Math.abs(parked.y - home.y) < 3)

  // ── 2γ. Η ΓΩΝΙΑ ΤΗ ΔΙΑΛΕΓΕΙ Ο ΧΡΗΣΤΗΣ, ΑΛΛΙΩΣ ΤΟ ΣΥΡΣΙΜΟ ΕΙΝΑΙ ΨΕΥΤΙΚΟ ──
  // Χωρίς αυτόν τον έλεγχο, ένα κουμπί που αγνοεί εντελώς το σύρσιμο και
  // επιστρέφει πάντα στην ίδια γωνία θα περνούσε τον 2β πράσινο.
  const pk = await box(p, '.pa-fab')
  await fingerDrag(cdp, { x: pk.cx, y: pk.cy }, { x: 40, y: pk.cy - 120 })
  await p.waitForTimeout(150)
  const left = await box(p, '.pa-fab')
  const leftMargin = view.vw - (home.x + home.w)
  ok(`σύρσιμο στο αριστερό μισό το κουμπώνει αριστερά (${Math.round(left.x)},${Math.round(left.y)} έναντι ${Math.round(leftMargin)},${Math.round(home.y)})`,
    Math.abs(left.x - leftMargin) < 3 && Math.abs(left.y - home.y) < 3)

  // Και πίσω δεξιά, ώστε οι επόμενοι έλεγχοι να ξεκινούν από γνωστή θέση.
  const lb = await box(p, '.pa-fab')
  await fingerDrag(cdp, { x: lb.cx, y: lb.cy }, { x: view.vw - 40, y: lb.cy })
  await p.waitForTimeout(150)

  // ── 3. ΤΟ ΣΥΡΣΙΜΟ ΔΕΝ ΑΝΟΙΓΕΙ ΤΟΝ ΒΟΗΘΟ ────────────────────────────────
  ok('το σύρσιμο δεν άνοιξε το παράθυρο', !(await p.$('.pa-panel')))

  // ── 4. ΚΑΙ ΜΕΤΑ ΤΟ ΣΥΡΣΙΜΟ, ΤΟ ΑΠΛΟ ΑΓΓΙΓΜΑ ΑΝΟΙΓΕΙ ────────────────────
  // Η ΠΑΥΣΗ ΔΕΝ ΕΙΝΑΙ ΓΙΑ ΤΟΝ ΚΩΔΙΚΑ ΜΑΣ. Ο ίδιος ο περιηγητής καταπίνει το
  // πάτημα που έρχεται αμέσως μετά από χειρονομία (μισό δευτερόλεπτο περίπου),
  // ώστε ένα δεύτερο άγγιγμα να μη μετρήσει ως διπλό. Ο άνθρωπος που σέρνει και
  // μετά πατά κάνει πολύ μεγαλύτερη παύση από αυτήν.
  await p.waitForTimeout(600)
  const at = await box(p, '.pa-fab')
  await p.touchscreen.tap(Math.round(at.cx), Math.round(at.cy))
  await p.waitForTimeout(200)
  ok('το άγγιγμα μετά το σύρσιμο ανοίγει τον βοηθό', !!(await p.$('.pa-panel')))

  // ── 5. ΤΟ ΚΟΥΜΠΙ ΚΛΕΙΣΙΜΑΤΟΣ ΣΕΡΝΕΤΑΙ ΚΙ ΑΥΤΟ ──────────────────────────
  const cb = await box(p, '.pa-fab-close')
  if (cb) {
    await fingerHold(cdp, { x: cb.cx, y: cb.cy }, { x: cb.cx - 140, y: cb.cy })
    await p.waitForTimeout(60)
    const cbHeld = await box(p, '.pa-fab-close')
    ok(`και το κλείσιμο σέρνεται (${Math.round(cb.x - cbHeld.x)}px από 140)`, cb.x - cbHeld.x > 110)
    // ΚΑΙ ΚΟΥΜΠΩΝΕΙ ΚΙ ΑΥΤΟ, ΣΤΗ ΓΩΝΙΑ ΤΟΥ ΜΙΣΟΥ ΟΠΟΥ ΤΟ ΑΦΗΣΕ ΤΟ ΔΑΧΤΥΛΟ.
    // Τα 140 δεν περνούν τη μέση της οθόνης σε καμία από τις δύο συσκευές, άρα
    // η σωστή γωνία είναι η ΔΕΞΙΑ — και το πλάτος του είναι το μικρό (μόνο το
    // σήμα), οπότε η γωνία του δεν είναι η γωνία του ανοιχτού κουμπιού.
    await fingerLift(cdp)
    await p.waitForTimeout(150)
    const cbParked = await box(p, '.pa-fab-close')
    const side = view.vw - (home.x + home.w)
    const closeRight = view.vw - cbParked.w - side
    ok(`και μετά κουμπώνει κι αυτό (${Math.round(cbParked.x)},${Math.round(cbParked.y)} έναντι ${Math.round(closeRight)},${Math.round(home.y)})`,
      Math.abs(cbParked.x - closeRight) < 3 && Math.abs(cbParked.y - home.y) < 3)
  } else { ok('το κουμπί κλεισίματος υπάρχει', false); await ctx.close(); continue }

  // ── 6. ΤΟ ΣΥΡΣΙΜΟ ΔΕΝ ΑΦΗΝΕΙ ΤΟ ΚΟΥΜΠΙ ΚΟΛΛΗΜΕΝΟ ΣΕ ΚΑΤΑΣΤΑΣΗ ─────────
  // Χειρονομία που ο περιηγητής ακυρώνει (δεύτερο δάχτυλο, εισερχόμενη κλήση)
  // στέλνει `pointercancel`. Χωρίς ακροατή, το κουμπί έμενε «σε σύρσιμο» για
  // πάντα: κάθε επόμενη κίνηση του δαχτύλου κάπου αλλού το τραβούσε μαζί.
  const c0 = await box(p, '.pa-fab-close')
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: Math.round(c0.cx), y: Math.round(c0.cy), radiusX: 12, radiusY: 12, force: 1 }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: Math.round(c0.cx) + 30, y: Math.round(c0.cy), radiusX: 12, radiusY: 12, force: 1 }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
  await p.waitForTimeout(80)
  const c1 = await box(p, '.pa-fab-close')
  // Δεύτερο άγγιγμα ΜΑΚΡΙΑ από το κουμπί: αν είχε μείνει κολλημένο, θα το ακολουθούσε.
  await fingerDrag(cdp, { x: 40, y: 300 }, { x: 40, y: 120 }, 6)
  await p.waitForTimeout(120)
  const c2 = await box(p, '.pa-fab-close')
  ok(`η ακυρωμένη χειρονομία δεν αφήνει το κουμπί κολλημένο (μετακινήθηκε ${Math.round(Math.hypot(c2.x - c1.x, c2.y - c1.y))}px χωρίς να το αγγίξει κανείς)`,
    Math.hypot(c2.x - c1.x, c2.y - c1.y) < 4)

  // ── 7. Η ΘΕΣΗ ΜΕΤΑ ΑΠΟ ΑΚΥΡΩΜΕΝΗ ΧΕΙΡΟΝΟΜΙΑ ΦΥΛΑΣΣΕΤΑΙ ─────────────────
  // Ο δείκτης «σέρνεται» κρατά τη γραφή στη μνήμη του περιηγητή, ώστε να μη
  // γράφεται σε κάθε καρέ. Αν δεν κλείσει ποτέ, η νέα θέση δεν αποθηκεύεται:
  // ο χρήστης έσυρε το κουμπί, τον διέκοψε μια κλήση και στην επόμενη επίσκεψη
  // το βρίσκει πάλι στη γωνία.
  await p.evaluate(() => localStorage.removeItem('pa_fab_pos'))
  const s0 = await box(p, '.pa-fab-close')
  const finger = (x, y) => [{ x: Math.round(x), y: Math.round(y), radiusX: 12, radiusY: 12, force: 1 }]
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: finger(s0.cx, s0.cy) })
  for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: finger(s0.cx, s0.cy - 90 * i / 8) })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
  await p.waitForTimeout(150)
  const saved = await p.evaluate(() => { try { return JSON.parse(localStorage.getItem('pa_fab_pos') || 'null') } catch { return null } })
  const s1 = await box(p, '.pa-fab-close')
  ok('η ακυρωμένη χειρονομία αποθηκεύει τη θέση που άφησε', !!saved && Math.abs(saved.y - s1.y) < 2 && Math.abs(saved.x - s1.x) < 2)

  await ctx.close()
}

await browser.close()
console.log(`\nαφή — ${pass} πέρασαν, ${fail} απέτυχαν`)
if (fail) process.exit(1)
console.log('✓ η Νόα σέρνεται με το δάχτυλο')
