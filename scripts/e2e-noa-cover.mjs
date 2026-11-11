#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΤΙ ΣΚΕΠΑΖΕΙ ΤΟ ΠΛΩΤΟ ΚΟΥΜΠΙ ΤΗΣ ΝΟΑΣ
// ─────────────────────────────────────────────────────────────────────────
// Ο χρήστης το είδε σε δύο στιγμιότυπα: το κουμπί καθόταν πάνω σε τιμές. Το
// `.app-content` κρατά κάτω περιθώριο για το κουμπί, οπότε στο ΤΕΛΟΣ της κύλισης
// δεν σκεπάζει τίποτα — αλλά «στο τέλος της κύλισης» δεν είναι όλη η οθόνη και
// κανένας πάγκος δεν απέδιδε τη Νόα πάνω σε πραγματική σκηνή.
//
// ΤΙ ΜΕΤΡΑ. Για κάθε σκηνή, σε τρία πλάτη, στην κορυφή ΚΑΙ στο τέλος της
// κύλισης: το ορθογώνιο του κουμπιού και κάθε ορατό φύλλο κειμένου. Οπου
// τέμνονται πάνω από λίγα εικονοστοιχεία, το κείμενο είναι κρυμμένο. Στο τέλος
// της κύλισης ΔΕΝ επιτρέπεται καμία τομή: εκεί υπάρχει το περιθώριο ακριβώς γι'
// αυτό. Στην κορυφή αναφέρεται ό,τι σκεπάζεται, γιατί είναι το πρώτο κάδρο.
//
//     node scripts/perf-bench/build-mobile.mjs && node scripts/e2e-noa-cover.mjs
//
// ═══ ΤΙ ΔΕΝ ΕΠΙΑΝΕ ΚΑΙ ΓΙΑΤΙ (02/11/2026) ═══════════════════════════════
// Ο ιδιοκτήτης φωτογράφισε σε iPhone το «Ν» πάνω στο «Σήμερα» και στο «⋯» του
// Ημερολογίου και πάνω στο κείμενο του «Ο φάκελος για τον λογιστή». Ο έλεγχος
// ήταν πράσινος, για τέσσερις λόγους:
//   1. Πλάτη 360, 820, 1280. Κανένα iPhone (375 · 390 · 430): στα 360 η
//      πλοήγηση του Ημερολογίου παίρνει δική της σειρά, οπότε το «Σήμερα» δεν
//      έφτανε ποτέ στη γωνία που μετριόταν.
//   2. Μετρούσε μόνο ΦΥΛΛΑ ΚΕΙΜΕΝΟΥ. Το «⋯» είναι εικονίδιο χωρίς κείμενο και
//      δεν υπήρχε για τη σάρωση.
//   3. Στο πρώτο κάδρο η τομή ήταν καστάνια εμβαδού, όχι σφάλμα: ένα κουμπί
//      που σκέπαζε ολόκληρο χειριστήριο πρόσθετε λίγα εκατοστά px² σε σύνολο
//      πενήντα χιλιάδων.
//   4. Μόνο κορυφή και τέλος. Το κουμπί ξαναφαίνεται με την πρώτη κύλιση
//      προς τα πάνω, δηλαδή σε ΟΠΟΙΑΔΗΠΟΤΕ θέση: εκεί σκέπαζε τον φάκελο.
// ΤΟΤΕ (02/11): στο τηλέφωνο η στήλη του περιεχομένου τελείωνε πάνω από το
// κουμπί (μια λωρίδα, --fab-lane) και το κουμπί κρυβόταν στην κύλιση.
//
// ═══ Η ΛΩΡΙΔΑ ΕΓΙΝΕ ΝΕΚΡΗ ΖΩΝΗ (11/11/2026) ════════════════════════════
// Το #473 έκανε τη Νόα ξανά πάντα ορατή (χωρίς `data-away`). Ο κανόνας της
// λωρίδας ζητούσε `:not([data-away])`, που χωρίς το χαρακτηριστικό ισχύει
// ΠΑΝΤΑ: η λωρίδα έμεινε μόνιμα ανοιχτή. Ο ιδιοκτήτης φωτογράφισε σε iPhone
// το περιεχόμενο κομμένο σε σκληρή ακμή στη μέση ενός chip και από κάτω μια
// άδεια ζώνη ~64 σε όλο το πλάτος. Ο έλεγχος ήταν πράσινος: μετρούσε μόνο
// ότι ΤΙΠΟΤΑ δεν είναι κάτω από το κουμπί — και μια άδεια ζώνη το εγγυάται.
//
// ΤΩΡΑ: καμία λωρίδα. Το περιεχόμενο κυλά ώς κάτω, πίσω από την πλοήγηση· το
// κουμπί πλέει πάνω του σε μια γωνία. Ο κανόνας γίνεται «τίποτα ΜΟΝΙΜΑ από
// κάτω του» και μετριέται με τρία μηδενικά όρια στο τηλέφωνο:
//   · στο τέλος της κύλισης καμία τομή, με κείμενο Ή με χειριστήριο: το κάτω
//     γέμισμα κρατά το ύψος του κουμπιού, άρα κάθε σειρά βγαίνει από κάτω του
//     με κύλιση·
//   · η στήλη φτάνει ώς την πλοήγηση σε κορυφή, μέση και τέλος: καμία άδεια
//     ζώνη ανάμεσα (αυτό που φωτογραφήθηκε)·
//   · το μέγιστο της κύλισης είναι ίδιο σε κορυφή, μέση και τέλος: τίποτα
//     δεν ανοιγοκλείνει με την κύλιση (ο βρόχος του 02/11).
// Οσα σκεπάζει το κουμπί σε κορυφή και μέση ΤΥΠΩΝΟΝΤΑΙ χωρίς να μπλοκάρουν,
// όπως ήδη στον υπολογιστή· στο πρώτο κάδρο στα 360 μπαίνουν ξανά στην
// καστάνια εμβαδού (360 · 820 · 1280), που μόνο κατεβαίνει. Τα ΧΕΙΡΙΣΤΗΡΙΑ
// του τηλεφώνου σε κορυφή και μέση έχουν δική τους καστάνια, πλήθος και
// εμβαδόν (11/11/2026): χωρίς αυτήν το «Σύνδεσμος για τον λογιστή» κάθισε
// κάτω από το «Ν» και ο έλεγχος έμεινε πράσινος.
// ═══════════════════════════════════════════════════════════════════════════
import { chromePath } from './lib/chrome.mjs'
import { sweep } from './lib/sweep.mjs'
import { scenesToRun, PORTAL_SCENES } from './lib/scenes.mjs'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright-core')

// Τα πλάτη της καστάνιας εμβαδού: ΙΔΙΑ με όταν γράφτηκε η βάση, αλλιώς ο
// αριθμός δεν συγκρίνεται με τον εαυτό του.
const WIDTHS = [360, 820, 1280]
// Τα πλάτη τηλεφώνου όπου ο κανόνας είναι μηδέν: Galaxy A και τα τρία iPhone.
const PHONES = [360, 375, 390, 430]
const PHONE_MAX = 768

const PROBE = (where) => {
  const fab = document.querySelector('.pa-fab')
  // Ο ΒΟΗΘΟΣ ΑΠΟΣΥΡΕΤΑΙ ΜΠΡΟΣΤΑ ΣΕ ΠΑΡΑΘΥΡΟ, ΕΠΙΤΗΔΕΣ. Οσο υπάρχει ανοιχτό
  // `aria-modal`, το κουμπί δεν αποδίδεται (PropertyAssistant, overlayOpen):
  // αλλιώς θα καθόταν πάνω στο «Αποθήκευση» κάθε φόρμας. Οι σκηνές παραθύρου
  // (modal, select, wizard, scan) δεν είναι αποτυχία του πάγκου· είναι η
  // συμπεριφορά που ελέγχεται αλλού.
  if (!fab && document.querySelector('[aria-modal="true"]')) return { withdrawn: true }
  if (!fab) return { missing: true }
  // ΑΠΟΣΥΡΜΕΝΟ ΣΤΗΝ ΚΥΛΙΣΗ (data-away, αόρατο): δεν σκεπάζει τίποτα.
  if (getComputedStyle(fab.closest('.pa-fab-wrap') || fab).opacity === '0') return { hits: [], controls: [], frame: null }
  const f = fab.getBoundingClientRect()
  // Ο,ΤΙ ΠΕΡΝΑ ΠΙΣΩ ΑΠΟ ΤΗΝ ΚΑΤΩ ΠΛΟΗΓΗΣΗ Ή ΚΑΤΩ ΑΠΟ ΤΗΝ ΑΚΜΗ ΤΗΣ ΣΤΗΛΗΣ ΔΕΝ
  // ΦΑΙΝΕΤΑΙ ΟΥΤΩΣ Η ΑΛΛΩΣ: το περιεχόμενο κόβεται εκεί πριν μετρηθεί η τομή.
  const nav = document.querySelector('.bottom-nav')
  const navTop = nav && nav.checkVisibility?.() ? nav.getBoundingClientRect().top : Infinity
  const col = document.querySelector('.app-content')
  const colBottom = col ? col.getBoundingClientRect().bottom : Infinity
  const clip = Math.min(navTop, colBottom)
  // Για τους κανόνες της στήλης: πού τελειώνει, πού αρχίζει η πλοήγηση και
  // πόσο κυλά. Μια άδεια ζώνη ανάμεσα στη στήλη και την πλοήγηση είναι η
  // «λωρίδα» που φωτογραφήθηκε· το μέγιστο που αλλάζει με την κύλιση είναι
  // ο βρόχος του 02/11.
  const frame = { gap: Number.isFinite(navTop) ? Math.round(navTop - colBottom) : 0, max: col ? col.scrollHeight - col.clientHeight : 0 }
  const cut = (r) => ({ left: r.left, right: r.right, top: r.top, bottom: Math.min(r.bottom, clip) })
  const meet = (r) => {
    const w = Math.min(r.right, f.right) - Math.max(r.left, f.left)
    const h = Math.min(r.bottom, f.bottom) - Math.max(r.top, f.top)
    return [w, h]
  }
  const out = []
  for (const el of document.querySelectorAll('.app-content *')) {
    if (el.children.length || el.closest('.pa-fab, .pa-fab-wrap, .pa-panel')) continue
    const t = (el.textContent || '').trim(); if (!t) continue
    if (!el.checkVisibility?.()) continue
    const [w, h] = meet(cut(el.getBoundingClientRect()))
    // Τρία εικονοστοιχεία είναι στρογγυλοποίηση· δέκα είναι γράμματα.
    if (w > 3 && h > 3) out.push(`${where}: «${t.slice(0, 26)}» ${Math.round(w)}×${Math.round(h)}`)
  }
  // ΤΑ ΧΕΙΡΙΣΤΗΡΙΑ ΜΕΤΡΙΟΥΝΤΑΙ ΧΩΡΙΣΤΑ, ΜΕ Η ΧΩΡΙΣ ΚΕΙΜΕΝΟ. Ενα κουμπί κάτω
  // από άλλο κουμπί δεν πατιέται: αυτό δεν είναι θέμα πυκνότητας.
  const controls = []
  for (const el of document.querySelectorAll('.app-content :is(button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button])')) {
    if (el.closest('.pa-fab, .pa-fab-wrap, .pa-panel')) continue
    if (!el.checkVisibility?.()) continue
    const [w, h] = meet(cut(el.getBoundingClientRect()))
    if (w > 3 && h > 3) {
      const name = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || el.tagName).trim()
      controls.push(`${where}: χειριστήριο «${name.slice(0, 26)}» ${Math.round(w)}×${Math.round(h)}`)
    }
  }
  return { hits: out, controls, frame }
}

const browser = await chromium.launch({ executablePath: chromePath(), args: ['--no-sandbox'] })
// ΔΥΟ ΜΕΤΡΗΣΕΙΣ ΑΝΑ ΣΚΗΝΗ: στην κορυφή και στο τέλος της κύλισης. Ο βρόχος
// πλάτους × σκηνής, με τις παράλληλες θέσεις του, ζει στο scripts/lib/sweep.mjs.
const ALL_WIDTHS = [...new Set([...WIDTHS, ...PHONES])].sort((a, b) => a - b)
const swept = await sweep(browser, {
  widths: ALL_WIDTHS, height: (w) => (w < 700 ? 800 : 1000), scenes: scenesToRun().filter(s => !PORTAL_SCENES.has(s)),
  suffix: '&noa=1', settle: 400,
  visit: async (page, { width }) => {
    // ═══ ΠΕΡΙΜΕΝΕ ΤΟ ΚΟΥΜΠΙ, ΟΧΙ ΤΟΝ ΧΡΟΝΟ ══════════════════════════════════
    // Με σταθερή αναμονή 400ms ο έλεγχος περνούσε τοπικά και έπεφτε στο CI:
    // «σε 2 σκηνές δεν αποδόθηκε το κουμπί». Οι σκηνές ήταν μια χαρά — ο
    // δρομέας απλώς είναι πιο αργός και τρέχει τέσσερις σελίδες μαζί, οπότε
    // 400ms άλλοτε φτάνουν κι άλλοτε όχι. Αναμονή σε χιλιοστά είναι στοίχημα
    // στην ταχύτητα του μηχανήματος· αναμονή στο ΣΤΟΙΧΕΙΟ είναι ερώτηση με
    // απάντηση. Το «δεν αποδόθηκε» παραμένει σφάλμα — αλλά τώρα σημαίνει
    // πραγματικά «δεν ήρθε ποτέ» και όχι «δεν πρόλαβε».
    //
    // Η σκηνή με ανοιχτό παράθυρο ΔΕΝ έχει κουμπί επίτηδες (αποσύρεται), οπότε
    // η αναμονή δεν επιτρέπεται να σκάσει εκεί: το `catch` την προσπερνά και
    // ο ανιχνευτής από κάτω ξεχωρίζει «αποσύρθηκε» από «λείπει».
    await page.waitForSelector('.pa-fab', { timeout: 5000 }).catch(() => {})
    const top = await page.evaluate(PROBE, 'κορυφή')
    // ΟΤΑΝ ΤΟ ΚΟΥΜΠΙ ΑΠΟΣΥΡΘΗΚΕ Ή ΔΕΝ ΑΠΟΔΟΘΗΚΕ, ΔΕΝ ΜΕΤΡΑΕΙ ΤΙΠΟΤΑ. Ο ανιχνευτής
    // γυρίζει και τότε ό,τι πρόλαβε να δει· αν αυτά τα σημεία μπουν στο άθροισμα,
    // χρεώνονται στη Νόα τομές σε σκηνές όπου η Νόα δεν είναι καν εκεί.
    if (top.withdrawn) return { withdrawn: true }
    if (top.missing) return { missing: true }
    const scrollTo = (k) => page.evaluate((k) => { const c = document.querySelector('.app-content'); if (c) c.scrollTop = Math.round((c.scrollHeight - c.clientHeight) * k) }, k)
    // ΣΤΟ ΤΗΛΕΦΩΝΟ ΜΕΤΡΙΕΤΑΙ ΣΕ ΗΡΕΜΙΑ. Από το #473 το κουμπί δεν κρύβεται
    // στην κύλιση· αν ξαναγίνει ποτέ αποσυρόμενο, ο έλεγχος περιμένει να
    // φανεί ΟΛΟΚΛΗΡΟ (χωρίς data-away, αδιαφάνεια 1). Αν μετρούσε ενώ είναι
    // κρυμμένο θα έβγαινε πάντα πράσινος. Αν δεν φανεί, είναι σφάλμα — και στον
    // υπολογιστή: εκεί έμενε κρυμμένο ώς την κίνηση προς τα πάνω και ο
    // ιδιοκτήτης δεν έβρισκε τη Νόα πουθενά (03/11/2026).
    // Πρώτα 150 χιλιοστά ώστε να φτάσει το γεγονός κύλισης: αλλιώς η αναμονή
    // βλέπει το κουμπί ορατό ΠΡΙΝ φύγει και μετρά πάνω στη στιγμή που φεύγει.
    const atRest = () => page.waitForTimeout(150).then(() => page.waitForFunction(() => {
      const w = document.querySelector('.pa-fab-wrap')
      return w && !w.dataset.away && getComputedStyle(w).opacity === '1'
    }, null, { timeout: 4000 })).then(() => true, () => false)
    const mids = []
    const stuck = []
    if (width <= PHONE_MAX) for (const k of [1 / 3, 2 / 3]) {
      await scrollTo(k)
      if (!(await atRest())) { stuck.push('μέση'); continue }
      mids.push(await page.evaluate(PROBE, 'μέση'))
    }
    if (width > PHONE_MAX) {
      await scrollTo(1 / 2)
      if (!(await atRest())) stuck.push('μέση')
    }
    await scrollTo(1)
    if (width <= PHONE_MAX) { if (!(await atRest())) stuck.push('τέλος') } else await page.waitForTimeout(150)
    const end = await page.evaluate(PROBE, 'τέλος')
    const all = [top, ...mids, end]
    // ΚΑΝΟΝΕΣ ΤΗΣ ΣΤΗΛΗΣ, ΜΟΝΟ ΣΤΟ ΤΗΛΕΦΩΝΟ (εκεί υπάρχει κάτω πλοήγηση).
    const frames = width <= PHONE_MAX ? [['κορυφή', top], ...mids.map(m => ['μέση', m]), ['τέλος', end]].filter(([, r]) => r.frame) : []
    const lane = frames.filter(([, r]) => r.frame.gap > 1).map(([w, r]) => `${w}: άδεια ζώνη ${r.frame.gap}px ανάμεσα στη στήλη και την πλοήγηση`)
    const maxes = new Set(frames.map(([, r]) => r.frame.max))
    const jump = maxes.size > 1 ? [`το μέγιστο της κύλισης αλλάζει με την κύλιση: ${frames.map(([w, r]) => `${w} ${r.frame.max}`).join(' · ')}`] : []
    return { hits: all.flatMap(r => r.hits || []), controls: all.flatMap(r => r.controls || []), stuck, column: [...lane, ...jump] }
  },
  onError: (e) => ({ broke: String(e.message).slice(0, 60) }),
})
await browser.close()

const scenes = swept.length
const withdrawn = swept.filter(r => r.value.withdrawn).length
const missing = swept.filter(r => r.value.missing).length
const stuck = swept.flatMap(({ scene, width, value }) => (value.stuck || []).map(w => `${scene}@${width}  ${w}: το κουμπί δεν ξαναφάνηκε σε ηρεμία`))
const findings = swept.flatMap(({ scene, width, value }) =>
  value.broke ? [`${scene}@${width}  δεν φόρτωσε: ${value.broke}`]
              : (value.hits || []).map(h => `${scene}@${width}  ${h}`))
const isPhone = (f) => Number(f.match(/@(\d+)/)?.[1]) <= PHONE_MAX
const column = swept.flatMap(({ scene, width, value }) => (value.column || []).map(c => `${scene}@${width}  ${c}`))
const allControls = swept.flatMap(({ scene, width, value }) => (value.controls || []).map(h => `${scene}@${width}  ${h}`))
// Χειριστήρια: μηδέν στο ΤΕΛΟΣ της κύλισης, σε κάθε πλάτος — εκεί το γέμισμα
// υπάρχει ακριβώς γι' αυτό. Σε κορυφή και μέση το κουμπί πλέει σε γωνία πάνω
// από τη στήλη, σε κάθε πλάτος· ό,τι σκεπάζει εκεί το βγάζει μια μικρή κύλιση,
// οπότε ΤΥΠΩΝΕΤΑΙ ώστε να φαίνεται. Στο τηλέφωνο μετριέται και σε καστάνια
// (maxPhoneControls, maxPhoneControlArea): μπορεί μόνο να πέσει.
const controls = allControls.filter(f => f.includes('τέλος:'))
const floatControls = allControls.filter(f => !f.includes('τέλος:'))

if (missing) { console.error(`✗ σε ${missing} σκηνές δεν αποδόθηκε το κουμπί της Νόας: ο πάγκος δεν τη φόρτωσε`); process.exit(1) }
// ΤΕΣΣΕΡΙΣ ΚΑΝΟΝΕΣ ΜΗΔΕΝ ΚΑΙ ΔΥΟ ΚΑΣΤΑΝΙΕΣ (πρώτο κάδρο, χειριστήρια τηλεφώνου).
//   · Στο τέλος της κύλισης υπάρχει περιθώριο ακριβώς για το κουμπί: καμία
//     τομή, με κείμενο ή χειριστήριο, σε κανένα πλάτος.
//   · Στο τηλέφωνο η στήλη φτάνει ώς την πλοήγηση: καμία άδεια ζώνη.
//   · Στο τηλέφωνο το μέγιστο της κύλισης δεν αλλάζει με την κύλιση.
//   · Το κουμπί ΠΡΕΠΕΙ να φαίνεται όταν σταματά η κύλιση.
//   · Στο πρώτο κάδρο του υπολογιστή ένα πλωτό κουμπί σε γωνία κάθεται εξ
//     ορισμού πάνω σε ό,τι φτάνει στη γωνία· εκεί μετριέται και ΔΕΝ επιτρέπεται
//     να χειροτερέψει (καστάνια, scripts/noa-cover-baseline.json). Πρώτη
//     μέτρηση 83366 px² σε 64 σημεία με την πρόσκληση ανοιχτή παντού.
const BASE = JSON.parse(readFileSync(new URL('./noa-cover-baseline.json', import.meta.url), 'utf8'))
const atEnd = findings.filter(f => f.includes('τέλος:'))
// Ο,τι σκεπάζει το κουμπί σε κορυφή και μέση στο τηλέφωνο: τυπώνεται.
const onPhone = findings.filter(f => isPhone(f) && !f.includes('δεν φόρτωσε') && !f.includes('τέλος:'))
const atTop = findings.filter(f => f.includes('κορυφή:') && WIDTHS.includes(Number(f.match(/@(\d+)/)?.[1])))
const broken = findings.filter(f => f.includes('δεν φόρτωσε'))
// ΕΜΒΑΔΟΝ, ΟΧΙ ΠΛΗΘΟΣ. Οταν η πρόσκληση μαζεύτηκε στο σήμα, τα σημεία έμειναν
// 64 → 62 ενώ το κρυμμένο κείμενο έπεσε κατά τρία τέταρτα: ένα κουμπί σε γωνία
// ακουμπά ΚΑΤΙ σχεδόν πάντα, αλλά το αν κρύβει λέξη ή ξύνει ένα γράμμα το λέει
// το εμβαδόν. Ο χρήστης βλέπει εικονοστοιχεία, όχι σημεία.
const topArea = atTop.reduce((n, f) => { const m = f.match(/(\d+)×(\d+)$/); return n + (m ? Number(m[1]) * Number(m[2]) : 0) }, 0)
// ═══ ΜΙΑ ΚΑΣΤΑΝΙΑ ΧΩΡΙΣ ΑΝΟΧΗ ΣΕ ΘΟΡΥΒΩΔΗ ΜΕΤΡΗΣΗ ΕΙΝΑΙ ΑΣΤΑΘΕΣ ΤΕΣΤ ══════
// ΤΙ ΕΓΙΝΕ. Το όριο γράφτηκε ΑΚΡΙΒΩΣ πάνω στη μέτρηση του CI (48339) και η
// επόμενη εκτέλεση, ΧΩΡΙΣ καμία αλλαγή στον κώδικα, μέτρησε 48350: έντεκα
// τετραγωνικά εικονοστοιχεία, ίδια 67 σημεία, ίδιες σκηνές. Το CI κοκκίνισε
// για τη ραστεροποίηση των γραμματοσειρών σε άλλον δρομέα.
//
// ΓΙΑΤΙ 1% ΚΑΙ ΟΧΙ ΣΤΑΘΕΡΟΣ ΑΡΙΘΜΟΣ. Το 1% εδώ είναι ~483 px², πάνω από τον
// μετρημένο θόρυβο και σαφώς ΚΑΤΩ από την πιο μικρή πραγματική μεταβολή που
// έχει καταγραφεί (1.069 px², 2,3%). Ποσοστό και όχι σταθερά, ώστε η ανοχή να
// μένει η ίδια όσο κι αν αλλάξει η βάση με τον καιρό.
const TOLERANCE = 0.01
const areaCeiling = Math.round(BASE.maxTopArea * (1 + TOLERANCE))
// ═══ ΧΕΙΡΙΣΤΗΡΙΑ ΚΑΤΩ ΑΠΟ ΤΟ ΚΟΥΜΠΙ ΣΤΟ ΤΗΛΕΦΩΝΟ: ΚΑΣΤΑΝΙΑ (11/11/2026) ═══
// Από τη στιγμή που έφυγε η λωρίδα, ό,τι σκεπάζει το κουμπί σε κορυφή και μέση
// στο τηλέφωνο μόνο τυπωνόταν. Ετσι πέρασε απαρατήρητο το «Σύνδεσμος για τον
// λογιστή» κάτω από το «Ν» στο πρώτο κάδρο της Λογιστικής (360 · 375 · 390),
// ενώ ο ιδιοκτήτης το είχε ήδη φωτογραφίσει στις 02/11. Ενα πλωτό κουμπί σε
// γωνία ακουμπά πάντα κάτι, οπότε μηδέν δεν γίνεται· γίνεται όμως να μη
// ΧΕΙΡΟΤΕΡΕΨΕΙ: πλήθος και εμβαδόν, μόνο προς τα κάτω. Μια αλλαγή που φέρνει
// νέο κουμπί στη γωνία ανεβάζει και τα δύο και κοκκινίζει εδώ, με όνομα.
// Το εμβαδόν έχει την ίδια ανοχή 1% με το πρώτο κάδρο (ραστεροποίηση)· το
// πλήθος καμία: ένα χειριστήριο παραπάνω είναι ένα χειριστήριο παραπάνω.
const phoneControls = floatControls.filter(isPhone)
const areaOf = (f) => { const m = f.match(/(\d+)×(\d+)$/); return m ? Number(m[1]) * Number(m[2]) : 0 }
const phoneControlArea = phoneControls.reduce((n, f) => n + areaOf(f), 0)
const ctlCeiling = Math.round(BASE.maxPhoneControlArea * (1 + TOLERANCE))
const ctlWorse = phoneControls.length > BASE.maxPhoneControls || phoneControlArea > ctlCeiling
if (stuck.length || atEnd.length || column.length || controls.length || broken.length || topArea > areaCeiling || ctlWorse) {
  console.error(`\n✗ Το κουμπί της Νόας: ${stuck.length} θέσεις όπου δεν φάνηκε σε ηρεμία (όριο 0), ${atEnd.length} τομές με κείμενο στο τέλος της κύλισης (όριο 0), ${controls.length} χειριστήρια από κάτω του στο τέλος (όριο 0), ${column.length} παραβάσεις της στήλης στο τηλέφωνο (όριο 0), ${topArea} px² κρυμμένα στο πρώτο κάδρο σε ${atTop.length} σημεία (όριο ${BASE.maxTopArea} px² + 1% ανοχή = ${areaCeiling}), ${phoneControls.length} χειριστήρια σε κορυφή/μέση στο τηλέφωνο (όριο ${BASE.maxPhoneControls}) με ${phoneControlArea} px² (όριο ${BASE.maxPhoneControlArea} + 1% = ${ctlCeiling}), ${broken.length} σκηνές δεν φόρτωσαν:\n`)
  for (const f of [...stuck, ...column, ...atEnd, ...broken, ...controls, ...atTop, ...(ctlWorse ? phoneControls : [])]) console.error('  ' + f)
  console.error(`
  Στο τέλος της κύλισης δεν επιτρέπεται τομή: το .app-content κρατά κάτω
  γέμισμα με το ύψος του κουμπιού (--fab-lane) ακριβώς γι' αυτό. Στο τηλέφωνο
  (≤${PHONE_MAX}) η στήλη φτάνει ώς την πλοήγηση: άδεια ζώνη σημαίνει ότι
  ξαναγύρισε κάποια «λωρίδα» (margin-bottom στο .app-content)· μέγιστο που
  αλλάζει σημαίνει ότι το γέμισμα εξαρτάται από την κύλιση. Στο πρώτο κάδρο
  ο αριθμός μόνο κατεβαίνει: αν ανέβηκε, κάτι μεγάλωσε το κουμπί ή έφερε
  κείμενο στη γωνία. Το ίδιο για τα χειριστήρια του τηλεφώνου σε κορυφή και
  μέση: αν ανέβηκαν, ένα κουμπί ήρθε στη γωνία του «Ν»· βγάλ' το από εκεί (π.χ.
  στοίβα με πλάτος του μεγαλύτερου λεκτικού, όπως στις ενέργειες του φακέλου).`)
  process.exit(1)
}
if (onPhone.length || floatControls.length) {
  console.log(`   ⓘ Σε κορυφή/μέση το πλωτό κουμπί σκεπάζει ${onPhone.length} φύλλα κειμένου στο τηλέφωνο και ${floatControls.length} χειριστήρια σε όλα τα πλάτη· τα βγάζει μια μικρή κύλιση (δεν μπλοκάρει):`)
  for (const f of floatControls) console.log('     ' + f)
}
if (phoneControls.length < BASE.maxPhoneControls || phoneControlArea < BASE.maxPhoneControlArea) console.log(`   ↓ Χειριστήρια τηλεφώνου σε κορυφή/μέση: ${phoneControls.length} (όριο ${BASE.maxPhoneControls}), ${phoneControlArea} px² (όριο ${BASE.maxPhoneControlArea}). Κατέβασε τα "maxPhoneControls" / "maxPhoneControlArea" στο scripts/noa-cover-baseline.json.`)
if (topArea < BASE.maxTopArea) console.log(`   ↓ Πρώτο κάδρο: ${topArea} px² < όριο ${BASE.maxTopArea}. Κατέβασε το "maxTopArea" στο scripts/noa-cover-baseline.json με μέτρηση του CI.`)
console.log(`✅ Το κουμπί της Νόας δεν σκεπάζει τίποτα μόνιμα: μηδέν τομές στο τέλος της κύλισης· στο τηλέφωνο (${PHONES.join(' · ')}) η στήλη φτάνει ώς την πλοήγηση με σταθερό μέγιστο κύλισης, σε ${scenes - withdrawn} σκηνές (${withdrawn} με ανοιχτό παράθυρο, όπου αποσύρεται επίτηδες).`)
