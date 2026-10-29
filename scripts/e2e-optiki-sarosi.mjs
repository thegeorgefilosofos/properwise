#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΟΠΤΙΚΗ ΣΑΡΩΣΗ: Ο,ΤΙ ΒΡΙΣΚΕ Ο ΙΔΙΟΚΤΗΤΗΣ ΜΕ ΤΟ ΜΑΤΙ, ΤΩΡΑ ΤΟ ΒΡΙΣΚΕΙ ΜΗΧΑΝΗ
// ─────────────────────────────────────────────────────────────────────────
// Οι σαρωτές του έργου κρίνουν ο καθένας ΕΝΑ πράγμα (κομμένο κείμενο, στόχοι
// αφής, στήλες αριθμών, το κουμπί της Νόας). Ο ιδιοκτήτης βρήκε μέσα σε μία
// μέρα δεκατέσσερις ΑΛΛΕΣ κατηγορίες: λέξη ανά γραμμή σε στενή κάρτα, ⓘ πάνω
// σε τίτλο, ετικέτες άξονα η μία πάνω στην άλλη, τετράγωνο περίγραμμα γύρω από
// πιλούλα μετά από κλικ, ετικέτα που αλλάζει βάρος και σπρώχνει τις διπλανές,
// διπλά πλαίσια, «19 Οκτ» δίπλα σε «05/10/2026», γυμνά URL, εσωτερικές
// καταστάσεις στην οθόνη. Αυτός ο σαρωτής τις ρωτά ΟΛΕΣ μαζί, σε κάθε σκηνή
// του πάγκου (με τη Νόα ανοιχτή), σε κάθε υπο-καρτέλα της και σε κάθε δημόσια
// σελίδα, σε 320/390/768/1280 και στα δύο θέματα.
//
// ΕΠΤΑ ΚΑΤΗΓΟΡΙΕΣ (τα ονόματα είναι αυτά της αναφοράς):
//   1 επικάλυψη     κείμενο/εικονίδιο πάνω σε κείμενο, οτιδήποτε κάτω από τη Νόα
//   2 υπερχείλιση   κομμένο κείμενο, οριζόντια κύλιση σελίδας και ο υπαίτιος
//   3 αναδίπλωση    λέξη ανά γραμμή, τίτλος ≥3 γραμμές σε κάρτα, ετικέτα <140px
//                   που σπάει, λέξη σπασμένη στη μέση
//   4 αφή/εστίαση   στόχος <44 σε αφή, περίγραμμα εστίασης μετά από κλικ,
//                   περίγραμμα σε άλλο σχήμα, ετικέτα που αλλάζει πλάτος στο κλικ
//   5 στοίχιση      αριθμοί όχι δεξιά/tabular, στήλη αριθμών που χορεύει,
//                   αδελφές κάρτες με άλλο padding/ύψος, κείμενο κολλητά στο
//                   περίγραμμα κάρτας, αριστερά άκρα που αποκλίνουν
//   6 συνέπεια      ημερομηνίες εκτός ΗΗ/ΜΜ/ΕΕΕΕ, μικτά ποσοστά, μικτό «€»,
//                   γυμνά URL, αγγλικά, εσωτερικές καταστάσεις, «εκτίμηση» δίπλα
//                   σε επίσημο στοιχείο, γέμισμα ράβδων σε όλο το ύψος
//   7 διπλότυπο     ίδιο πλαίσιο/CTA/κείμενο δύο φορές στην ίδια σελίδα
//
// ΤΙ ΔΕΝ ΚΑΝΕΙ. Δεν σταματά το CI: είναι εργαλείο εύρεσης, όχι φύλακας. Πολλά
// από τα ευρήματα είναι ευρετικά (στοίχιση, συνέπεια) και θέλουν μάτι πριν
// γίνουν διόρθωση. Οταν μια κατηγορία καθαρίσει, το σωστό σπίτι της είναι
// ένας από τους στενούς σαρωτές με μηδενική ανοχή. Πάνω του κάθεται καστάνια
// (scripts/optiki-ratchet.mjs, scripts/optiki-baseline.json): κοκκινίζει μόνο
// όταν μια κατηγορία × σοβαρότητα ΑΝΕΒΕΙ και τρέχει στην εβδομαδιαία σάρωση
// (.github/workflows/weekly-quality.yml), όχι σε κάθε PR. Γιατί όχι σε κάθε
// PR το γράφει το ίδιο το workflow.
//
// ΤΑ ΤΕΣΣΕΡΑ ΨΕΥΔΩΣ ΘΕΤΙΚΑ ΠΟΥ ΕΦΥΓΑΝ (26/10/2026), με τα ονόματα της
// διαλογής της 21/10: αποσιωπητικά και line-clamp (F3), σώματα παραθύρων και
// πίνακες που κυλούν (F4), οπτικά κρυφό κείμενο (F5), αλλαγή γραμμής σε
// κάθετο, παύλα ή διεύθυνση (F6). Ο λόγος του καθενός είναι γραμμένος στη
// θέση όπου διορθώθηκε. Μετρημένο στο ίδιο δέντρο, πριν και μετά, πιο κάτω
// στην κεφαλίδα της καστάνιας.
//
// ΑΠΕΝΑΝΤΙ ΣΤΗΝ ΠΑΡΑΓΩΓΗ. `E2E_BASE=https://properwise.gr OPT_SITEMAP=1`
// σαρώνει τις δημόσιες σελίδες του χάρτη. Ο περιηγητής κόβει κάθε αίτημα που
// δεν είναι ανάγνωση (βλ. READ_ONLY πιο κάτω).
//
// ΧΑΡΤΟΓΡΑΦΗΣΗ ΣΕ ΑΡΧΕΙΟ. Η παραγωγική έκδοση δεν κρατά ονόματα component,
// οπότε κάθε εύρημα ψάχνει το ίδιο του το κείμενο (τη μεγαλύτερη σειρά λέξεων
// χωρίς αριθμούς) στον πηγαίο του app/, components/ και lib/ και γράφει το
// πρώτο αρχείο:γραμμή. Οταν δεν βρεθεί, δίνεται το component της σκηνής.
//
//     node scripts/perf-bench/build-mobile.mjs && node scripts/e2e-optiki-sarosi.mjs
//     E2E_BASE=http://localhost:3111 node scripts/e2e-optiki-sarosi.mjs
//
//   E2E_ONLY=overview,loan      μόνο αυτές οι σκηνές
//   OPT_WIDTHS=390,1280         άλλα πλάτη
//   OPT_THEMES=dark             ένα θέμα
//   OPT_PUBLIC=0 / OPT_BENCH=0  χωρίς δημόσιες / χωρίς πάγκο
//   OPT_SITEMAP=1               και οι σελίδες του /sitemap.xml της βάσης
//   OPT_OUT=dir                 πού γράφονται findings.json/.md, shots/ (προεπιλογή .perf-bench/optiki)
//   OPT_SHOTS=0                 χωρίς στιγμιότυπα · OPT_MAX_SHOTS=160
// ═══════════════════════════════════════════════════════════════════════════
import { launchEngine } from './lib/engine.mjs'
import { scenesToRun } from './lib/scenes.mjs'
import { benchUrl, repoRoot } from './lib/paths.mjs'
import { laneCount } from './lib/sweep.mjs'
import { SEED_CONSENT } from './lib/consent.mjs'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const env = process.env
const WIDTHS = (env.OPT_WIDTHS || '320,390,768,1280').split(',').map(Number)
const THEMES = (env.OPT_THEMES || 'dark,light').split(',')
const BASE = env.E2E_BASE || 'http://localhost:3000'
const OUT = env.OPT_OUT || join(repoRoot, '.perf-bench', 'optiki')
const SHOT_DIR = env.OPT_SHOT_DIR || join(OUT, 'shots')
const SHOTS = env.OPT_SHOTS !== '0'
const MAX_SHOTS = Number(env.OPT_MAX_SHOTS || 160)
const SUB_MAX = Number(env.OPT_SUB_MAX || 8)
mkdirSync(OUT, { recursive: true })
if (SHOTS) mkdirSync(SHOT_DIR, { recursive: true })

const PUBLIC = [
  '/', '/login', '/signup', '/paketa', '/trust', '/logistes',
  '/ypologismos-forou-enoikion', '/ypologismos-enfia', '/vraxyxronia-i-makroxronia',
  '/kathari-apodosi', '/ypologismos-stegastikou-daneiou', '/sygkrisi-timologion-revmatos',
  '/tameio', '/ypanaxorisi', '/odigos', '/odigos/forologia-enoikion-2026',
  '/odigos/enfia-2026-pliromi-doseis-pistopoiitiko',
]

// ═══ ΟΘΟΝΕΣ ΠΟΥ ΔΙΟΡΘΩΝΕΙ ΑΛΛΟ ΚΛΑΔΙ ════════════════════════════════════════
// Ενα εύρημα σημειώνεται «σε εξέλιξη αλλού» όταν η σκηνή ταιριάζει ΚΑΙ η
// ενότητα (επικεφαλίδα, αρχείο ή κείμενο) ταιριάζει. Αλλάζει όταν κλείσει εκείνο.
const ELSEWHERE = [
  { scene: /^overview/, re: /επόμενοι 12 μήνες|ForecastCard|fc-/i, label: 'Overview «Οι επόμενοι 12 μήνες»' },
  { scene: /^overview/, re: /Τι χρειάζεται τώρα|AgendaPanel|agenda/i, label: 'Overview «Τι χρειάζεται τώρα»' },
  { scene: /^calendar/, re: /popover|DaySheet|day-sheet|Επόμεν|Προσεχ|upcoming|calendar\//i, label: 'Calendar popover / λίστα επόμενων' },
  { scene: /^loan/, re: /Πιθανότητα έγκρισης/i, label: 'Loans «Πιθανότητα έγκρισης»' },
  { scene: /^loan/, re: /stress|αντοχ|charts\.tsx|Αν ανέβει/i, label: 'Loans stress chart' },
  { scene: /^loan/, re: /Euribor|επιτόκιο αγοράς|market|MARKET|rate-strip/i, label: 'Λωρίδα επιτοκίων αγοράς' },
  { scene: /^loan/, re: /Τράπεζ|BANKS|bank/i, label: 'Γραμμή κατάστασης τραπεζών' },
]

// Ο ΚΥΛΙΟΜΕΝΟΣ ΤΗΣ ΣΕΛΙΔΑΣ ΔΕΝ ΕΙΝΑΙ ΠΑΝΤΑ ΤΟ ΠΑΡΑΘΥΡΟ. Στον πίνακα ελέγχου
// κυλά το `.app-content` (overflow-y: auto) μέσα σε `.app-main` που κόβει: το
// `window.scrollTo` δεν κάνει τίποτα και κάθε «τέλος της κύλισης» θα ήταν η κορυφή.
const SCROLLER = () => {
  let best = null
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el)
    if (!/auto|scroll/.test(cs.overflowY) || el.scrollHeight <= el.clientHeight + 5) continue
    if (el.clientHeight < innerHeight * 0.5 || el.closest('[aria-modal="true"], .pa-panel')) continue
    if (!best || el.clientHeight > best.clientHeight) best = el
  }
  return best
}

// ═════════════════════════════════════════════════════════════════════════
// ΤΟ ΜΕΤΡΟ ΜΕΣΑ ΣΤΗ ΣΕΛΙΔΑ. Αυτοτελές: εκτελείται στον περιηγητή.
// ═════════════════════════════════════════════════════════════════════════
const PROBE = ({ fabSel, withTouch, scSrc }) => {
  const F = []
  const SCR = new Function('return (' + scSrc + ')')()()
  const scTop = () => SCR ? SCR.scrollTop : window.scrollY
  const scTo = (y) => { if (SCR) SCR.scrollTop = y; else window.scrollTo(window.scrollX, y) }
  const vis = (el) => el.checkVisibility?.({ visibilityProperty: true, opacityProperty: true }) ?? true
  const sx = window.scrollX, sy = scTop()
  const docRect = (r) => ({ x: r.left + sx, y: r.top + sy, w: r.width, h: r.height })
  const union = (a, b) => {
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y)
    return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y }
  }
  const sel = (el) => {
    const parts = []
    for (let n = el; n && n.nodeType === 1 && n !== document.body && parts.length < 4; n = n.parentElement) {
      let s = n.tagName.toLowerCase()
      if (n.id && !/^[:r]|radix|«/.test(n.id)) s += '#' + n.id
      else {
        const da = [...n.attributes].find(a => a.name.startsWith('data-') && !/^data-(mode|theme|opt|state)/.test(a.name))
        const cls = typeof n.className === 'string' ? n.className.trim().split(/\s+/).filter(c => c && c.length < 32 && !/^(css|sc|jsx)-/.test(c)).slice(0, 2) : []
        if (cls.length) s += '.' + cls.join('.')
        else if (da) s += `[${da.name}${da.value && da.value.length < 24 ? `="${da.value}"` : ''}]`
        else if (n.getAttribute('role')) s += `[role="${n.getAttribute('role')}"]`
        else if (n.getAttribute('aria-label')) s += `[aria-label="${n.getAttribute('aria-label').slice(0, 24)}"]`
      }
      parts.unshift(s)
    }
    return parts.join(' > ')
  }
  const isCard = (el) => {
    if (!(el instanceof HTMLElement)) return false
    const cs = getComputedStyle(el)
    const r = parseFloat(cs.borderTopLeftRadius) || 0
    const bw = parseFloat(cs.borderTopWidth) || 0
    const bg = cs.backgroundColor
    const hasBg = bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent'
    const b = el.getBoundingClientRect()
    return r >= 8 && (bw > 0 || hasBg) && b.width > 120 && b.height > 48 && !/^(BUTTON|A|INPUT|SELECT|TEXTAREA|LABEL)$/.test(el.tagName)
  }
  const cardOf = (el) => { for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) if (isCard(n)) return n; return null }
  // Η ΕΝΟΤΗΤΑ ΣΤΗΝ ΟΠΟΙΑ ΑΝΗΚΕΙ ΤΟ ΕΥΡΗΜΑ: η επικεφαλίδα της κάρτας, ή η
  // προηγούμενη επικεφαλίδα της σελίδας. Χρειάζεται για την αναφορά και για το
  // «το διορθώνει άλλο κλαδί».
  const heads = [...document.querySelectorAll('h1,h2,h3,h4,[class*="title"],[aria-label]')].filter(h => vis(h))
  const sectionOf = (el) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const al = n.getAttribute && n.getAttribute('aria-label')
      if (al && /^(SECTION|ASIDE|ARTICLE|DIV|NAV)$/.test(n.tagName) && al.length > 3) return al.slice(0, 60)
      if (isCard(n)) { const h = n.querySelector('h1,h2,h3,h4,[class*="title"]'); if (h && (h.textContent || '').trim()) return h.textContent.trim().slice(0, 60) }
    }
    let best = ''
    for (const h of heads) { if (!/^H\d$/.test(h.tagName)) continue; if (h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) best = (h.textContent || '').trim() }
    return best.slice(0, 60)
  }
  const add = (cls, sev, el, what, rect, extra = {}) => {
    F.push({ cls, sev, sel: el ? sel(el) : '', text: (extra.text ?? (el ? (el.textContent || el.getAttribute?.('aria-label') || '') : '')).replace(/\u00ad/g, '').replace(/\s+/g, ' ').trim().slice(0, 90), what, rect: rect || (el ? docRect(el.getBoundingClientRect()) : null), section: el ? sectionOf(el) : '', ...extra })
  }
  // ── ΤΟ ΟΠΤΙΚΑ ΚΡΥΦΟ ΔΕΝ ΕΙΝΑΙ ΚΕΙΜΕΝΟ ΣΤΗΝ ΟΘΟΝΗ ───────────────────────────
  // ΨΕΥΔΩΣ ΘΕΤΙΚΟ ΤΗΣ ΔΙΑΛΟΓΗΣ 21/10 (F5, 15 ευρήματα). Το `.sr-only` δεν είναι
  // ο μόνος τρόπος να κρυφτεί κείμενο από το μάτι και να μείνει στον αναγνώστη
  // οθόνης: το `.th-full` του υπολογιστή βραχυχρόνιας γράφει «Μακροχρόνια» σε
  // κουτί 1×1 με `clip-path: inset(50%)` δίπλα στο ορατό «Μακροχρ.» και ο
  // σαρωτής έβλεπε «κείμενο πάνω σε κείμενο» και «κομμένο κείμενο 87px». Το
  // ίδιο για περιγραφές `aria-describedby`, παγίδες για ρομπότ στα −9999px και
  // το παλιό `clip: rect(0 0 0 0)`. Κρίνεται το ΣΧΗΜΑ της απόκρυψης, όχι το
  // όνομα της κλάσης: ένα νέο όνομα για το ίδιο σχήμα δεν ξαναβγάζει εύρημα.
  const hidSelf = new Map()
  const hiddenSelf = (n) => {
    if (hidSelf.has(n)) return hidSelf.get(n)
    const cs = getComputedStyle(n)
    const b = n.getBoundingClientRect()
    const abs = cs.position === 'absolute' || cs.position === 'fixed'
    const v = /inset\(\s*(4\d|50|100)(\.\d+)?%/.test(cs.clipPath)
      || (abs && /^rect\(/.test(cs.clip) && /rect\(0(px)?,? 0(px)?,? 0(px)?,? 0(px)?\)/.test(cs.clip.replace(/\s+/g, ' ')))
      || ((b.width <= 1.5 || b.height <= 1.5) && /hidden|clip/.test(cs.overflowX + cs.overflowY))
      || (abs && (b.right <= -20 || b.bottom <= -20 - (document.scrollingElement?.scrollTop || 0)))
    hidSelf.set(n, v)
    return v
  }
  const visuallyHidden = (el) => { for (let n = el; n && n !== document.body; n = n.parentElement) if (hiddenSelf(n)) return true; return false }
  const skipEl = (el) => !!el.closest('.sr-only, [aria-live]:not([role="alert"]):not([role="status"]), .bench-topbar, script, style, noscript, [class*="skip"]') || visuallyHidden(el)

  // ── Τα φύλλα κειμένου: κόμβοι κειμένου με τα πραγματικά ορθογώνια γραμμής ──
  // ΤΟ ΚΟΜΜΕΝΟ ΑΠΟ ΠΡΟΓΟΝΟ ΔΕΝ ΦΑΙΝΕΤΑΙ. Κελί πίνακα έξω από το ορατό κομμάτι
  // ενός δοχείου που κυλά οριζόντια έχει ορθογώνια — αλλά κανείς δεν το βλέπει.
  // Κάθε ορθογώνιο κόβεται στην τομή των προγόνων που κόβουν.
  const clipCache = new Map()
  const clipOf = (el) => {
    if (clipCache.has(el)) return clipCache.get(el)
    let c = { left: -1e9, top: -1e9, right: 1e9, bottom: 1e9 }
    // ΤΟ ΚΟΨΙΜΟ ΞΕΚΙΝΑ ΑΠΟ ΤΟ ΙΔΙΟ ΤΟ ΣΤΟΙΧΕΙΟ, ΟΧΙ ΑΠΟ ΤΟΝ ΓΟΝΕΑ ΤΟΥ.
    // ΨΕΥΔΩΣ ΘΕΤΙΚΟ ΤΗΣ ΔΙΑΛΟΓΗΣ 21/10 (F3, 22 ευρήματα). Ενα `<span>` με
    // αποσιωπητικά ή `line-clamp` κόβει το δικό του κείμενο· τα ορθογώνια του
    // κόμβου κειμένου όμως συνεχίζουν πέρα από το κόψιμο, εκεί όπου δεν
    // ζωγραφίζεται τίποτα. Ο σαρωτής μετρούσε από τον γονέα και έβλεπε την
    // αόρατη ουρά του «Κατηγορία δαπάνης πολύ μακρύ όνομα» πάνω στο βελάκι
    // της λίστας, ή τη δεύτερη γραμμή ενός περιορισμένου τίτλου πάνω στην
    // ετικέτα από κάτω του.
    for (let n = el; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
      // Πέρα από τον κυλιόμενο, ό,τι κόβει κόβει το παράθυρο του κυλιόμενου:
      // το `.app-main` κρύβει ό,τι είναι κάτω από την οθόνη, αλλά ο χρήστης το
      // φτάνει κυλώντας.
      if (n === SCR) break
      const cs = getComputedStyle(n)
      // ΚΑΙ ΤΟ ΚΟΥΤΙ ΠΟΥ ΚΥΛΑ ΚΟΒΕΙ. ΨΕΥΔΩΣ ΘΕΤΙΚΟ ΤΗΣ ΔΙΑΛΟΓΗΣ 21/10 (F4, 16
      // ευρήματα). Η παλιά γραφή έλεγε «ένα δοχείο που κυλά δεν κρύβει, ο
      // χρήστης φτάνει το περιεχόμενο σέρνοντας». Το φτάνει, αλλά ΜΕΣΑ στο
      // δοχείο: η γραμμή του σώματος ενός παραθύρου που είναι κάτω από το
      // ορατό τμήμα δεν ζωγραφίζεται ποτέ πάνω στο «Άκυρο» του υποσέλιδου,
      // ούτε η όγδοη δόση του πίνακα με `maxHeight` πάνω στη λεζάντα του.
      // Οταν κυλήσει, φεύγει από κάτω της. Επικάλυψη ανάμεσα σε δύο κομμάτια
      // ΜΕΣΑ στο ίδιο δοχείο μετριέται κανονικά στο ορατό τμήμα του.
      if (n !== el && cs.position === 'fixed') break
      const anc = n !== el
      const hx = /hidden|clip/.test(cs.overflowX) || (anc && /auto|scroll/.test(cs.overflowX) && n.scrollWidth > n.clientWidth + 1)
      const hy = /hidden|clip/.test(cs.overflowY) || (anc && /auto|scroll/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 1)
      if (hx || hy) {
        const b = n.getBoundingClientRect()
        c = { left: hx ? Math.max(c.left, b.left) : c.left, top: hy ? Math.max(c.top, b.top) : c.top, right: hx ? Math.min(c.right, b.right) : c.right, bottom: hy ? Math.min(c.bottom, b.bottom) : c.bottom }
      }
    }
    clipCache.set(el, c)
    return c
  }
  const clipR = (el, r) => { const c = clipOf(el); const L = Math.max(r.left, c.left), T = Math.max(r.top, c.top), R = Math.min(r.right, c.right), B = Math.min(r.bottom, c.bottom); return R - L > 1.5 && B - T > 3 ? { left: L, top: T, right: R, bottom: B, width: R - L, height: B - T } : null }
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: (t) => (t.nodeValue || '').trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT })
  const texts = []
  for (let t; (t = tw.nextNode());) {
    const el = t.parentElement
    if (!el || skipEl(el) || !vis(el)) continue
    if (/^(OPTION|TITLE|TEXTAREA)$/.test(el.tagName)) continue
    const rg = document.createRange(); rg.selectNodeContents(t)
    const rects = [...rg.getClientRects()].map(r => clipR(el, r)).filter(Boolean)
    if (!rects.length) continue
    // Ο,τι κόβεται από πρόγονο (overflow hidden) δεν φαίνεται: κρατά μόνο το ορατό.
    texts.push({ t, el, rects, txt: t.nodeValue.replace(/\u00ad/g, '').trim(), svg: !!el.closest('svg') })
  }
  // Εικονίδια που στέκουν μόνα (ⓘ, βελάκια) — όχι διαγράμματα.
  const icons = []
  for (const s of document.querySelectorAll('svg, img')) {
    if (skipEl(s) || !vis(s)) continue
    if (s.parentElement?.closest('svg')) continue
    const r0 = s.getBoundingClientRect()
    if (r0.width < 6 || r0.height < 6 || r0.width > 32 || r0.height > 32) continue
    const r = clipR(s, r0)
    if (!r || r.width < 4) continue
    icons.push({ el: s, rects: [r], txt: '', icon: true })
  }

  // ═══ 1 ΕΠΙΚΑΛΥΨΗ ═════════════════════════════════════════════════════════
  // Δύο ορθογώνια που τέμνονται ΚΑΙ το ένα ζωγραφίζεται όντως πάνω στο άλλο
  // (elementFromPoint στο κέντρο της τομής δίνει έναν από τους δύο). Αν από
  // πάνω είναι τρίτο στοιχείο (παράθυρο, sticky κεφαλίδα) δεν κρίνεται εδώ.
  const items = []
  for (const x of texts) for (const r of x.rects) items.push({ ...x, r })
  for (const x of icons) items.push({ ...x, r: x.rects[0] })
  items.sort((a, b) => a.r.top - b.r.top)
  const fixedish = (el) => { for (let n = el; n && n !== document.body; n = n.parentElement) { const p = getComputedStyle(n).position; if (p === 'fixed' || p === 'sticky') return n } return null }
  const seenPair = new Set()
  for (let i = 0; i < items.length; i++) {
    const a = items[i]
    for (let j = i + 1; j < items.length; j++) {
      const c = items[j]
      if (c.r.top >= a.r.bottom) break
      if (a.el === c.el && !a.icon) continue
      if (a.el.contains(c.el) && a.icon) continue
      if (c.el.contains(a.el) && c.icon) continue
      if (a.icon && c.icon) continue
      const ox = Math.min(a.r.right, c.r.right) - Math.max(a.r.left, c.r.left)
      const oy = Math.min(a.r.bottom, c.r.bottom) - Math.max(a.r.top, c.r.top)
      // Τρία εικονοστοιχεία είναι γραμμή βάσης και ουρές γραμμάτων· πάνω από
      // αυτό είναι γράμματα πάνω σε γράμματα.
      if (ox <= 2.5 || oy <= Math.min(4, Math.min(a.r.height, c.r.height) * 0.3)) continue
      const fa = fixedish(a.el), fc = fixedish(c.el)
      if (fa !== fc) continue
      const px = (Math.max(a.r.left, c.r.left) + Math.min(a.r.right, c.r.right)) / 2
      const py = (Math.max(a.r.top, c.r.top) + Math.min(a.r.bottom, c.r.bottom)) / 2
      let top
      if (py < 0 || py > innerHeight - 1 || px < 0 || px > innerWidth - 1) {
        const dy = py - innerHeight / 2
        scTo(sy + dy)
        const moved = scTop() - sy
        top = (py - moved >= 0 && py - moved < innerHeight && px >= 0 && px < innerWidth) ? document.elementFromPoint(px, py - moved) : null
        scTo(sy)
        if (!top) continue
      } else top = document.elementFromPoint(px, py)
      const own = (x) => top && (x.el === top || x.el.contains(top) || top.contains(x.el) || (x.el.closest('svg') && x.el.closest('svg').contains(top)))
      if (top && !own(a) && !own(c)) continue
      const key = [a.el, c.el].map(sel).join('|')
      if (seenPair.has(key)) continue
      seenPair.add(key)
      const chart = a.svg && c.svg
      const what = chart ? `ετικέτες διαγράμματος η μία πάνω στην άλλη (${Math.round(ox)}×${Math.round(oy)}px)`
        : (a.icon || c.icon) ? `εικονίδιο πάνω σε κείμενο (${Math.round(ox)}×${Math.round(oy)}px)`
          : `κείμενο πάνω σε κείμενο (${Math.round(ox)}×${Math.round(oy)}px)`
      add('επικάλυψη', 'Υψηλό', (a.icon ? c : a).el, what, union(docRect(a.r), docRect(c.r)), { src: a.txt || c.txt, text: `«${(a.txt || a.el.getAttribute?.('aria-label') || 'εικονίδιο').slice(0, 40)}» × «${(c.txt || c.el.getAttribute?.('aria-label') || 'εικονίδιο').slice(0, 40)}»` })
    }
  }
  // Το πλωτό κουμπί της Νόας: τι σκεπάζει στο πρώτο κάδρο. (Στο τέλος της
  // κύλισης το μετρά ο καλών, με δεύτερη κλήση.)
  const fab = fabSel && document.querySelector(fabSel)
  if (fab && vis(fab)) {
    const f = fab.getBoundingClientRect()
    for (const x of [...texts, ...icons]) {
      if (x.el.closest('.pa-fab, .pa-fab-wrap, .pa-panel')) continue
      for (const r of x.rects) {
        const ox = Math.min(r.right, f.right) - Math.max(r.left, f.left)
        const oy = Math.min(r.bottom, f.bottom) - Math.max(r.top, f.top)
        if (ox > 3 && oy > 3) { add('επικάλυψη', window.__optEnd ? 'Υψηλό' : 'Μεσαίο', x.el, `το κουμπί «Ν» της Νόας σκεπάζει ${x.icon ? 'εικονίδιο' : 'κείμενο'} (${Math.round(ox)}×${Math.round(oy)}px)${window.__optEnd ? ' — και στο τέλος της κύλισης, άρα δεν ξεσκεπάζεται ποτέ' : ''}`, union(docRect(r), docRect(f)), { fab: true, dedupe: 'fab' }); break }
      }
    }
  }
  if (window.__optEnd) return F.filter(f => f.fab)

  // ═══ 2 ΥΠΕΡΧΕΙΛΙΣΗ ═══════════════════════════════════════════════════════
  const se = document.scrollingElement || document.documentElement
  if (se.scrollWidth > innerWidth + 1) {
    // Ο υπαίτιος: το ψηλότερο στοιχείο που περνά τη δεξιά άκρη χωρίς πρόγονο
    // που να κόβει ή να κυλά.
    const guilty = []
    for (const el of document.querySelectorAll('body *')) {
      const b = el.getBoundingClientRect()
      if (b.right <= innerWidth + 1 || b.width < 2 || !vis(el)) continue
      let held = false
      for (let n = el.parentElement; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
        if (/hidden|clip|auto|scroll/.test(getComputedStyle(n).overflowX)) { held = true; break }
      }
      if (held) continue
      if (guilty.some(g => g.contains(el))) continue
      guilty.push(el)
    }
    const g = guilty.filter(x => !guilty.some(y => y !== x && y.contains(x))).slice(0, 3)
    for (const el of g) add('υπερχείλιση', 'Υψηλό', el, `οριζόντια κύλιση σελίδας: ${se.scrollWidth - innerWidth}px πέρα από την οθόνη`)
    if (!g.length) add('υπερχείλιση', 'Υψηλό', document.body, `οριζόντια κύλιση σελίδας: ${se.scrollWidth - innerWidth}px`, null, { text: '' })
  }
  for (const el of document.querySelectorAll('body *')) {
    if (skipEl(el) || el.closest('.po-elide')) continue
    const cs = getComputedStyle(el)
    if (!/hidden|clip/.test(cs.overflowX) && cs.textOverflow !== 'ellipsis') continue
    if (!(el.textContent || '').trim() || !vis(el)) continue
    if (el.querySelector('svg, img, canvas, table') && !(el.textContent || '').trim()) continue
    if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
      // Μόνο όταν το κομμένο κομμάτι είναι κείμενο: κάθε κουτί με κρυμμένη
      // υπερχείλιση και ένα διακοσμητικό εκτός ορίων δεν είναι εύρημα.
      const leaf = [...el.querySelectorAll('*')].concat(el).some(n => {
        const tn = [...n.childNodes].some(c => c.nodeType === 3 && c.nodeValue.trim())
        if (!tn) return false
        const rg = document.createRange(); rg.selectNodeContents(n)
        const b = el.getBoundingClientRect()
        return [...rg.getClientRects()].some(r => r.right > b.right + 1 || r.left < b.left - 1)
      })
      if (leaf) add('υπερχείλιση', cs.textOverflow === 'ellipsis' ? 'Μεσαίο' : 'Υψηλό', el, `κομμένο κείμενο: ${el.scrollWidth - el.clientWidth}px δεν φαίνονται${cs.textOverflow === 'ellipsis' ? ' (αποσιωπητικά χωρίς .po-elide)' : ''}`)
    }
  }

  // ═══ 3 ΑΝΑΔΙΠΛΩΣΗ ════════════════════════════════════════════════════════
  const blocks = new Set()
  for (const x of texts) {
    if (x.svg) continue
    let b = x.el
    while (b.parentElement && /^inline/.test(getComputedStyle(b).display) && b.parentElement !== document.body) b = b.parentElement
    blocks.add(b)
  }
  // \u2500\u2500 \u03a0\u039f\u03a5 \u0391\u039a\u03a1\u0399\u0392\u03a9\u03a3 \u03a3\u03a0\u0391\u0395\u0399 \u0397 \u039b\u0395\u039e\u0397 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  // \u03a8\u0395\u03a5\u0394\u03a9\u03a3 \u0398\u0395\u03a4\u0399\u039a\u039f \u03a4\u0397\u03a3 \u0394\u0399\u0391\u039b\u039f\u0393\u0397\u03a3 21/10 (F6, 13 \u03b5\u03c5\u03c1\u03ae\u03bc\u03b1\u03c4\u03b1). \u039f \u03c3\u03b1\u03c1\u03c9\u03c4\u03ae\u03c2 \u03ad\u03b2\u03bb\u03b5\u03c0\u03b5 \u03b4\u03cd\u03bf
  // \u03b3\u03c1\u03b1\u03bc\u03bc\u03ad\u03c2 \u03bc\u03ad\u03c3\u03b1 \u03c3\u03b5 \u03bc\u03af\u03b1 \u00ab\u03bb\u03ad\u03be\u03b7\u00bb \u03c7\u03c9\u03c1\u03af\u03c2 \u03ba\u03b5\u03bd\u03cc \u03ba\u03b1\u03b9 \u03ad\u03b3\u03c1\u03b1\u03c6\u03b5 \u00ab\u03c3\u03c0\u03b1\u03c3\u03bc\u03ad\u03bd\u03b7 \u03c3\u03c4\u03b7 \u03bc\u03ad\u03c3\u03b7\u00bb. \u03a4\u03b1
  // \u00ab\u03951/\u03952\u00bb, \u00ab2025\u20132026\u00bb, \u00ab\u03b5\u03b9\u03c3\u03bf\u03b4\u03b7\u03bc\u03b1\u03c4\u03b9\u03ba\u03ac/\u03c0\u03b5\u03c1\u03b9\u03bf\u03c5\u03c3\u03b9\u03b1\u03ba\u03ac\u00bb, \u00ab75,00\u20ac/\u03bd\u03cd\u03c7\u03c4\u03b1\u00bb \u03ba\u03b1\u03b9 \u03ba\u03ac\u03b8\u03b5
  // \u03b4\u03b9\u03b5\u03cd\u03b8\u03c5\u03bd\u03c3\u03b7 \u03cc\u03bc\u03c9\u03c2 \u03c3\u03c0\u03ac\u03bd\u03b5 \u03b5\u03ba\u03b5\u03af \u03c0\u03bf\u03c5 \u03bf \u03ba\u03b1\u03bd\u03cc\u03bd\u03b1\u03c2 \u03b1\u03bb\u03bb\u03b1\u03b3\u03ae\u03c2 \u03b3\u03c1\u03b1\u03bc\u03bc\u03ae\u03c2 \u03c4\u03bf\u03c5 Unicode \u03c4\u03bf
  // \u03b5\u03c0\u03b9\u03c4\u03c1\u03ad\u03c0\u03b5\u03b9: \u03bc\u03b5\u03c4\u03ac \u03c4\u03b7\u03bd \u03ba\u03ac\u03b8\u03b5\u03c4\u03bf, \u03c4\u03b7\u03bd \u03c0\u03b1\u03cd\u03bb\u03b1, \u03c4\u03b7\u03bd \u03c4\u03b5\u03bb\u03b5\u03af\u03b1 \u03c4\u03b7\u03c2 \u03b4\u03b9\u03b5\u03cd\u03b8\u03c5\u03bd\u03c3\u03b7\u03c2. \u0395\u03ba\u03b5\u03af \u03bf
  // \u03b1\u03bd\u03b1\u03b3\u03bd\u03ce\u03c3\u03c4\u03b7\u03c2 \u03b2\u03bb\u03ad\u03c0\u03b5\u03b9 \u03b4\u03cd\u03bf \u03bb\u03ad\u03be\u03b5\u03b9\u03c2, \u03cc\u03c7\u03b9 \u03ba\u03bf\u03bc\u03bc\u03ad\u03bd\u03b7 \u03bb\u03ad\u03be\u03b7. \u039a\u03c1\u03af\u03bd\u03b5\u03c4\u03b1\u03b9 \u03bb\u03bf\u03b9\u03c0\u03cc\u03bd \u03bf \u03a7\u0391\u03a1\u0391\u039a\u03a4\u0397\u03a1\u0391\u03a3
  // \u03c0\u03ac\u03bd\u03c9 \u03c3\u03c4\u03bf\u03bd \u03bf\u03c0\u03bf\u03af\u03bf \u03ad\u03c0\u03b5\u03c3\u03b5 \u03b7 \u03b1\u03bb\u03bb\u03b1\u03b3\u03ae, \u03cc\u03c7\u03b9 \u03b7 \u03bb\u03ad\u03be\u03b7 \u03bf\u03bb\u03cc\u03ba\u03bb\u03b7\u03c1\u03b7. \u03a4\u03bf \u03c0\u03b1\u03bb\u03b9\u03cc \u00ab\u03b1\u03b3\u03bd\u03cc\u03b7\u03c3\u03b5 \u03ba\u03ac\u03b8\u03b5
  // \u03bb\u03ad\u03be\u03b7 \u03bc\u03b5 \u03c0\u03b1\u03cd\u03bb\u03b1\u00bb \u03ad\u03ba\u03c1\u03c5\u03b2\u03b5 \u03ba\u03b1\u03b9 \u03c4\u03b7\u03bd \u03b1\u03bb\u03b7\u03b8\u03b9\u03bd\u03ae \u03c0\u03b5\u03c1\u03af\u03c0\u03c4\u03c9\u03c3\u03b7, \u00ab\u039b\u03bf\u03b3\u03b1\u03c1\u03b9\u03b1-\u03c3\u03bc\u03bf\u03af\u00bb \u03c3\u03c0\u03b1\u03c3\u03bc\u03ad\u03bd\u03bf
  // \u03c3\u03c4\u03b7 \u03bc\u03ad\u03c3\u03b7 \u03b5\u03bd\u03ce \u03b7 \u03bb\u03ad\u03be\u03b7 \u03ad\u03c7\u03b5\u03b9 \u03c0\u03b1\u03cd\u03bb\u03b1 \u03b1\u03bb\u03bb\u03bf\u03cd.
  const LEGIT_AFTER = /[/\\\-\u2010\u2011\u2013\u2014_.,;:?&=+|\u00b7)\]}]/
  const LEGIT_BEFORE = /[\u2010\u2013\u2014]/
  const breakIsLegit = (t, start, word) => {
    const top0 = (() => { const r = document.createRange(); r.setStart(t, start); r.setEnd(t, start + 1); return r.getClientRects()[0]?.top })()
    if (top0 === undefined) return true
    for (let i = 1; i < word.length; i++) {
      const r = document.createRange(); r.setStart(t, start + i); r.setEnd(t, start + i + 1)
      // Το ΤΕΛΕΥΤΑΙΟ ορθογώνιο του χαρακτήρα: στην αλλαγή μετά από «­» (soft
      // hyphen) ο Chromium δίνει στον επόμενο χαρακτήρα ΔΥΟ ορθογώνια, την
      // παύλα στο τέλος της πάνω γραμμής και το γράμμα στην κάτω. Με το πρώτο
      // η αλλαγή φαινόταν ένα γράμμα αργότερα, στη μέση της συλλαβής.
      const q = [...r.getClientRects()].filter(x => x.width > 0.5).pop()
      if (!q || Math.abs(q.top - top0) <= 4) continue
      return LEGIT_AFTER.test(word[i - 1]) || LEGIT_BEFORE.test(word[i]) || word[i - 1] === '\u00ad'
    }
    return true
  }
  const wordTops = (el) => {
    const tops = [], words = []
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    for (let t; (t = w.nextNode());) {
      if (t.parentElement.closest('svg')) continue
      // \u039f\u03c0\u03c4\u03b9\u03ba\u03ac \u03ba\u03c1\u03c5\u03c6\u03cc \u03ba\u03b5\u03af\u03bc\u03b5\u03bd\u03bf \u03bc\u03ad\u03c3\u03b1 \u03c3\u03c4\u03bf \u03af\u03b4\u03b9\u03bf \u03bc\u03c0\u03bb\u03bf\u03ba (\u03c0\u03b5\u03c1\u03b9\u03b3\u03c1\u03b1\u03c6\u03ae \u03b3\u03b9\u03b1 \u03b1\u03bd\u03b1\u03b3\u03bd\u03ce\u03c3\u03c4\u03b7
      // \u03bf\u03b8\u03cc\u03bd\u03b7\u03c2) \u03b4\u03b5\u03bd \u03c0\u03b9\u03ac\u03bd\u03b5\u03b9 \u03b3\u03c1\u03b1\u03bc\u03bc\u03ad\u03c2 \u03ba\u03b1\u03b9 \u03b4\u03b5\u03bd \u00ab\u03c3\u03c0\u03ac\u03b5\u03b9\u00bb \u03bc\u03c0\u03c1\u03bf\u03c3\u03c4\u03ac \u03c3\u03b5 \u03ba\u03b1\u03bd\u03ad\u03bd\u03b1\u03bd.
      if (t.parentElement !== el && (skipEl(t.parentElement) || !vis(t.parentElement))) continue
      const s = t.nodeValue
      const re = /\S+/g
      for (let m; (m = re.exec(s));) {
        const rg = document.createRange(); rg.setStart(t, m.index); rg.setEnd(t, m.index + m[0].length)
        const r = rg.getClientRects()[0]
        if (!r || r.width < 1) continue
        tops.push(Math.round(r.top / 3)); words.push(m[0])
        const rr = [...rg.getClientRects()].filter(q => q.width > 1)
        // `hyphens: auto` (η στήλη των οδηγών, globals.css) συλλαβίζει σκόπιμα, με
        // παύλα που ζωγραφίζει ο περιηγητής. Το λεξικό συλλαβισμού υπάρχει στον
        // runner του GitHub και όχι σε κάθε τοπικό Chromium: χωρίς αυτή την
        // εξαίρεση η εβδομαδιαία σάρωση της 26/10 έβγαλε 180 ψεύτικα «σπασίματα».
        if (rr.length > 1 && m[0].length > 3 && Math.abs(rr[0].top - rr[rr.length - 1].top) > 4 && !t.parentElement.closest('.po-elide') && getComputedStyle(t.parentElement).hyphens !== 'auto' && !breakIsLegit(t, m.index, m[0])) words.broken = m[0]
      }
    }
    const lines = new Map()
    tops.forEach((t) => { const k = [...lines.keys()].find(k => Math.abs(k - t) <= 1) ?? t; lines.set(k, (lines.get(k) || 0) + 1) })
    return { words, lines: [...lines.values()], broken: words.broken }
  }
  for (const el of blocks) {
    if (!(el instanceof HTMLElement) || skipEl(el) || el.closest('svg')) continue
    const b = el.getBoundingClientRect()
    if (b.width < 8) continue
    const { words, lines, broken } = wordTops(el)
    const W = words.length, L = lines.length
    if (!W) continue
    const cs = getComputedStyle(el)
    const fsz = parseFloat(cs.fontSize)
    if (broken) add('αναδίπλωση', 'Υψηλό', el, `λέξη σπασμένη στη μέση της («${broken}»)`)
    const singles = lines.filter(n => n === 1).length
    if (W >= 3 && L >= 3 && singles >= L - 1 && Math.max(...lines) <= 2) {
      add('αναδίπλωση', L >= 4 ? 'Υψηλό' : 'Μεσαίο', el, `λέξη ανά γραμμή: ${W} λέξεις σε ${L} γραμμές, πλάτος ${Math.round(b.width)}px`)
      continue
    }
    const titleish = /^H[1-6]$/.test(el.tagName) || /title|head/i.test(String(el.className)) || ((parseInt(cs.fontWeight) >= 600) && fsz >= 15)
    if (titleish && L >= 3 && cardOf(el) && W >= 3) { add('αναδίπλωση', 'Μεσαίο', el, `τίτλος κάρτας σε ${L} γραμμές (πλάτος ${Math.round(b.width)}px)`); continue }
    if (b.width < 140 && W >= 2 && W <= 4 && L >= 2 && fsz <= 15) {
      const par = el.parentElement, pcs = par && getComputedStyle(par)
      if (pcs && /grid|flex/.test(pcs.display)) add('αναδίπλωση', 'Χαμηλό', el, `ετικέτες σπάνε στη μέση της φράσης σε στήλες <140px (π.χ. ${W} λέξεις σε ${L} γραμμές στα ${Math.round(b.width)}px)`, null, { dedupe: 'label-' + sel(par.parentElement || par).replace(/\[[^\]]*\]/g, '') })
    }
  }

  // ═══ 4 ΑΦΗ ═══════════════════════════════════════════════════════════════
  if (withTouch) {
    const inProse = (el) => {
      const par = el.parentElement
      if (!par || !/^(P|LI|SPAN|EM|STRONG|SMALL|LABEL|DD|DT|TD)$/.test(par.tagName)) return false
      if (!/^inline/.test(getComputedStyle(el).display)) return false
      return (par.textContent || '').trim().length > (el.textContent || '').trim().length + 12
    }
    for (const el of document.querySelectorAll('a[href], button, [role="button"], [role="tab"], [role="switch"], input[type="checkbox"], input[type="radio"], summary, select')) {
      if (skipEl(el) || !vis(el) || inProse(el) || el.closest('.po-tap-inline') || el.classList.contains('po-tap-inline')) continue
      let r = el.getBoundingClientRect(); let h = r.height, w = r.width
      if (el.type === 'checkbox' || el.type === 'radio') {
        const lab = el.id ? document.querySelector('label[for="' + CSS.escape(el.id) + '"]') : el.closest('label')
        if (lab) { const lr = lab.getBoundingClientRect(); h = Math.max(h, lr.height); w = Math.max(w, lr.width) }
      }
      for (const pe of ['::before', '::after']) {
        const c = getComputedStyle(el, pe)
        if (c.content === 'none' || c.position !== 'absolute') continue
        const grow = (p, q) => (parseFloat(p) < 0 ? -parseFloat(p) : 0) + (parseFloat(q) < 0 ? -parseFloat(q) : 0)
        h = Math.max(h, r.height + grow(c.top, c.bottom)); w = Math.max(w, r.width + grow(c.left, c.right))
      }
      const iconOnly = (el.textContent || '').trim().length <= 2
      if (Math.round(h) < 44 || (iconOnly && Math.round(w) < 44)) add('αφή/εστίαση', Math.round(Math.min(h, w)) < 32 ? 'Μεσαίο' : 'Χαμηλό', el, `στόχος αφής ${Math.round(w)}×${Math.round(h)}px (<44)`, null, { text: (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 40) })
    }
  }

  // ═══ 5 ΣΤΟΙΧΙΣΗ ══════════════════════════════════════════════════════════
  const NUM = /^[−–\-+]?\s?€?\s?\d[\d.\s  ]*(,\d+)?\s?(€|%|τ\.μ\.|m²|μ\.)?$/
  const numericText = (el) => { const t = (el.textContent || '').replace(/\s+/g, ' ').trim(); return t && t.length < 22 && NUM.test(t) }
  for (const tb of document.querySelectorAll('table')) {
    if (!vis(tb) || skipEl(tb)) continue
    const cols = new Map()
    for (const tr of tb.querySelectorAll('tbody tr, tr')) [...tr.children].forEach((td, i) => { if (td.tagName === 'TD' && numericText(td)) { if (!cols.has(i)) cols.set(i, []); cols.get(i).push(td) } })
    for (const [i, cells] of cols) {
      // Η πρώτη στήλη είναι ταυτότητα γραμμής (έτος, μήνας, α/α), όχι ποσό.
      if (cells.length < 2 || i === 0) continue
      // ΣΤΗΛΗ ΣΥΓΚΡΙΣΗΣ, ΟΧΙ ΣΤΗΛΗ ΠΟΣΩΝ. Οταν η ίδια στήλη έχει και σημάδια
      // (✓/✗ ως εικονίδιο, χωρίς ψηφία) και ΟΛΑ της τα κελιά είναι κεντραρισμένα,
      // είναι πίνακας σύγκρισης πακέτων: ο αριθμός στέκει στον άξονα του
      // σημαδιού από πάνω του και δεξιά στοίχιση θα τον έβγαζε από αυτόν. Ζητείται
      // ομοιόμορφο κέντρο και ίσα ψηφία, όχι δεξιά άκρη (29/10/2026).
      const all = [...tb.querySelectorAll('tbody tr')].map(tr => tr.children[i]).filter(td => td && td.tagName === 'TD')
      const marks = all.filter(td => !numericText(td) && td.querySelector('svg') && !/\d/.test(td.textContent || ''))
      if (marks.length && all.every(td => getComputedStyle(td).textAlign === 'center')
        && cells.every(td => /tabular/.test(getComputedStyle(td).fontVariantNumeric))) continue
      const bad = cells.filter(td => !/right|end/.test(getComputedStyle(td).textAlign))
      const tab = cells.every(td => /tabular/.test(getComputedStyle(td).fontVariantNumeric) || /tabular/.test(getComputedStyle(td.firstElementChild || td).fontVariantNumeric))
      if (bad.length) add('στοίχιση', 'Μεσαίο', bad[0], `στήλη ${i + 1}: ${bad.length}/${cells.length} αριθμητικά κελιά δεν είναι δεξιά στοιχισμένα${tab ? '' : ' και χωρίς tabular-nums'}`)
      else if (!tab) add('στοίχιση', 'Χαμηλό', cells[0], `στήλη ${i + 1}: αριθμοί χωρίς tabular-nums (τα ψηφία δεν πέφτουν το ένα κάτω από το άλλο)`)
    }
  }
  // Γραμμές «ετικέτα … ποσό» σε λίστα: το ποσό πρέπει να κλείνει στην ίδια δεξιά άκρη.
  for (const list of document.querySelectorAll('ul, ol, dl, [role="list"], div, section')) {
    const rows = [...list.children].filter(k => vis(k) && /flex|grid/.test(getComputedStyle(k).display) && k.children.length >= 2)
    if (rows.length < 3) continue
    const rb = rows.map(r => r.getBoundingClientRect())
    if (!rb.every((b, i) => Math.abs(b.left - rb[0].left) <= 2 && Math.abs(b.width - rb[0].width) <= 2 && (i === 0 || b.top >= rb[i - 1].bottom - 2))) continue
    const vals = rows.map(r => { const last = [...r.children].reverse().find(c => vis(c) && (c.textContent || '').trim()); return last && numericText(last) ? last : null })
    const nums = vals.filter(Boolean)
    if (nums.length < 3) continue
    const rights = nums.map(n => { const rg = document.createRange(); rg.selectNodeContents(n); const rr = [...rg.getClientRects()]; return rr.length ? Math.max(...rr.map(r => r.right)) : n.getBoundingClientRect().right })
    const spread = Math.max(...rights) - Math.min(...rights)
    if (spread > 3) add('στοίχιση', 'Μεσαίο', nums[rights.indexOf(Math.min(...rights))], `στήλη ποσών σε λίστα: οι δεξιές άκρες απέχουν έως ${Math.round(spread)}px (${nums.length} γραμμές)`, docRect(list.getBoundingClientRect()))
  }
  // Αδελφές κάρτες στην ίδια σειρά.
  const cardSeen = new Set()
  for (const g of document.querySelectorAll('body *')) {
    if (g.children.length < 2 || skipEl(g)) continue
    const gcs = getComputedStyle(g)
    if (!/grid|flex/.test(gcs.display) || /column/.test(gcs.flexDirection) && gcs.display.includes('flex')) continue
    const cards = [...g.children].filter(k => vis(k) && isCard(k))
    if (cards.length < 2) continue
    const rows = new Map()
    for (const c of cards) { const t = Math.round(c.getBoundingClientRect().top / 4); const k = [...rows.keys()].find(k => Math.abs(k - t) <= 1) ?? t; if (!rows.has(k)) rows.set(k, []); rows.get(k).push(c) }
    for (const row of rows.values()) {
      if (row.length < 2) continue
      const pad = row.map(c => { const s = getComputedStyle(c); return `${s.paddingTop} ${s.paddingRight} ${s.paddingBottom} ${s.paddingLeft}` })
      const hs = row.map(c => c.getBoundingClientRect().height)
      const k = sel(g)
      if (cardSeen.has(k)) continue
      if (new Set(pad).size > 1) { cardSeen.add(k); add('στοίχιση', 'Μεσαίο', g, `αδελφές κάρτες στην ίδια σειρά με διαφορετικό padding (${[...new Set(pad)].join(' / ')})`) }
      else if (Math.max(...hs) - Math.min(...hs) > 6) { cardSeen.add(k); add('στοίχιση', 'Χαμηλό', g, `αδελφές κάρτες στην ίδια σειρά με ύψη ${hs.map(Math.round).join('/')}px`) }
    }
  }
  // Κείμενο κολλητά στο περίγραμμα κάρτας (επικεφαλίδα χωρίς padding).
  const flushSeen = new Set()
  for (const x of texts) {
    if (x.svg) continue
    const card = cardOf(x.el)
    if (!card || flushSeen.has(card)) continue
    const cb = card.getBoundingClientRect(), r = x.rects[0]
    const cs = getComputedStyle(card)
    if (/auto|scroll/.test(cs.overflowX) || cb.width < 160) continue
    const bw = parseFloat(cs.borderLeftWidth) || 0
    const dl = r.left - cb.left - bw, dt = r.top - cb.top - (parseFloat(cs.borderTopWidth) || 0)
    if (dl >= -0.5 && dl < 6 && dt >= -0.5 && dt < 40) { flushSeen.add(card); add('στοίχιση', 'Μεσαίο', x.el, `κείμενο ${Math.round(dl)}px από το αριστερό περίγραμμα της κάρτας (χωρίς εσωτερικό περιθώριο)`, union(docRect(cb), docRect(r))) }
  }
  // Αριστερά άκρα αδελφών μπλοκ που αποκλίνουν λίγο (όχι εσοχή, λάθος).
  for (const g of document.querySelectorAll('.app-content, .app-content *, main, main *')) {
    const gcs = getComputedStyle(g)
    if (!(gcs.display === 'block' || (gcs.display.includes('flex') && /column/.test(gcs.flexDirection)))) continue
    const kids = [...g.children].filter(k => vis(k) && !/absolute|fixed/.test(getComputedStyle(k).position) && k.getBoundingClientRect().width > 200 && k.getBoundingClientRect().height > 20 && getComputedStyle(k).display !== 'inline')
    if (kids.length < 3) continue
    const lefts = kids.map(k => Math.round(k.getBoundingClientRect().left))
    const mode = lefts.sort((a, b) => lefts.filter(v => v === b).length - lefts.filter(v => v === a).length)[0]
    const off = kids.filter(k => { const d = Math.abs(Math.round(k.getBoundingClientRect().left) - mode); return d > 2 && d <= 12 && Math.abs(k.getBoundingClientRect().right - kids[0].parentElement.getBoundingClientRect().right) > 2 })
    for (const k of off.slice(0, 1)) add('στοίχιση', 'Χαμηλό', k, `αριστερή άκρη ${Math.round(k.getBoundingClientRect().left - mode)}px εκτός της στήλης των αδελφών του`)
  }

  // ═══ 6 ΣΥΝΕΠΕΙΑ ═════════════════════════════════════════════════════════
  const MON = '(?:Ιαν|Φεβ|Μαρ|Απρ|Μα[ΐι]|Ιουν|Ιουλ|Αυγ|Σεπ|Οκτ|Νο[εέ]|Δεκ)[α-ωάέήίόύώΐ]*\\.?'
  const DATE_BAD = [
    [new RegExp(`(^|[^\\d])\\d{1,2}\\s${MON}(\\s\\d{4})?`, 'u'), 'λεκτική/σύντομη'],
    [/(^|[^\d/])\d\/\d{1,2}\/\d{2,4}|(^|[^\d/])\d{1,2}\/\d\/\d{4}/, 'χωρίς μηδενικό'],
    [/\b20\d{2}-\d{2}-\d{2}\b/, 'ISO'],
    [/(^|[^\d.])\d{1,2}\.\d{1,2}\.20\d{2}\b/, 'με τελείες'],
    [/(^|[^\d/])\d{2}\/\d{2}\/\d{2}(?!\d)/, 'διψήφιο έτος'],
  ]
  const byCard = new Map()
  const euroVariants = new Map()
  const latinWords = new Map()
  const ALLOW = /^(PROPERWISE|Properwise|ProperWise|PDF|CSV|XLSX|Excel|Word|Airbnb|Booking|Google|Gmail|Apple|iPhone|iPad|Android|Viber|WhatsApp|IBAN|BIC|SWIFT|Euribor|EURIBOR|ECB|AMKA|KAEK|Ctrl|Cmd|Enter|Esc|Tab|Shift|PWA|WiFi|Wi-Fi|OK|Revolut|Visa|Mastercard|Stripe|Creem|myAADE|myAADEapp|myPROPERTY|TaxisNet|Taxisnet|gov|LinkedIn|Facebook|Instagram|TikTok|Reddit|Spitogatos|Chrome|Safari|Firefox|Edge|Windows|Mac|macOS|iOS|App|Store|Play|SEPA|VAT|EUR|PIN|QR|SMS|URL|API|AI|Claude|Anthropic|Vercel|Supabase|DEI|ΔΕΗ|Nova|Vodafone|Cosmote|Wind|Eurobank|Alpha|Piraeus|Attica|Optima|Euro|LTV|DSTI|DTI|HTML|ICS|iCal|Outlook|Calendar|email|e-mail|Email|online|Online|Pro|Solo|Agency|Free|Plus|Premium|Business|Team|ok|Office|Revenue|Microsoft|Notion|Dropbox|OneDrive|Drive|Docs|Sheets|PayPal|IRIS|Iris|Wolt|Efood|Uber|Ryanair|Aegean|XE|TAXIS|MyData|myDATA|Brevo|Resend|Sentry|Next|React|Noa|Hellenic|ESG|NBG|ΕΤΕ|JCC|Viva|Worldline|Cardlink|Nexi|Everypay|ID|CV|PV|LED|HVAC|kWh|MWh|iCal|TAXISnet|SoftOne|Epsilon|QuickBooks|Xero|Entersoft|Singular|Prosvasis|Oikonomiko|eToro|YouTube|iBank|winbank|myBusiness|myCAR|myAUTO|eGov)$/
  const INTERNAL = /\b(undefined|null|NaN|Infinity|\[object Object\]|TODO|FIXME|lorem|ipsum|pending|draft|loading|true|false|error)\b|\b[a-z]+_[a-z_]+\b|\b[a-z]+[A-Z][a-zA-Z]+\b/
  for (const x of texts) {
    const s = x.txt
    if (x.el.closest('code, kbd, pre, input, [contenteditable]')) continue
    const card = cardOf(x.el) || document.body
    if (!byCard.has(card)) byCard.set(card, { pcts: new Set(), pctEls: [], txt: '' })
    const bc = byCard.get(card); bc.txt += ' ' + s
    if (!x.svg) for (const [re, kind] of DATE_BAD) { const m = s.match(re); if (m) { add('συνέπεια', 'Χαμηλό', x.el, `ημερομηνία «${m[0].trim()}» (${kind}) αντί για ΗΗ/ΜΜ/ΕΕΕΕ`, null, { dedupe: 'date-' + kind }); break } }
    for (const m of s.matchAll(/\d+(?:,(\d+))?\s?%/g)) { bc.pcts.add(m[1] ? m[1].length : 0); bc.pctEls.push([x.el, m[0]]) }
    for (const m of s.matchAll(/(\d[\d.,]*)([\s  ]?)€|€([\s  ]?)(\d)/g)) {
      const v = m[3] !== undefined && m[4] ? (m[3] ? '€ 1' : '€1') : (m[2] ? (m[2] === ' ' ? '1 € (απλό κενό)' : '1 € (αδιάσπαστο)') : '1€')
      if (!euroVariants.has(v)) euroVariants.set(v, [x.el, m[0]])
    }
    const url = s.match(/https?:\/\/\S+|www\.[^\s]+|\b[a-z0-9-]+\.(?:gr|com|eu|org)\/\S*/i)
    if (url && !x.el.closest('a[href]') || url && x.el.closest('a[href]') && (x.el.closest('a').textContent || '').trim() === url[0]) add('συνέπεια', 'Μεσαίο', x.el, `γυμνό URL στο κείμενο: «${url[0].slice(0, 50)}»`)
    const ins = s.match(INTERNAL)
    if (ins && !x.svg && !ALLOW.test(ins[0]) && !(/^[a-z]+[A-Z]/.test(ins[0]) && ins[0].length < 7)) add('συνέπεια', 'Υψηλό', x.el, `εσωτερική κατάσταση/αναγνωριστικό στην οθόνη: «${ins[0]}»`)
    for (const w of s.match(/[A-Za-z][A-Za-z'-]{2,}/g) || []) {
      if (ALLOW.test(w) || /^[A-Z0-9]{2,5}$/.test(w)) continue
      if (/@|https?:|www\.|\.gr|\.com/.test(s)) continue
      if (!latinWords.has(w)) latinWords.set(w, x.el)
    }
  }
  for (const [card, bc] of byCard) {
    if (bc.pcts.size > 1 && bc.pctEls.length >= 2) {
      const ex = [...new Set(bc.pctEls.map(p => p[1]))].slice(0, 4).join(', ')
      add('συνέπεια', 'Χαμηλό', card === document.body ? bc.pctEls[0][0] : card, `μικτή μορφή ποσοστών στο ίδιο component: ${ex}`, null, { text: ex })
    }
    if (/εκτίμησ|εκτιμώμεν|εκτιμάται/i.test(bc.txt) && /ΕΝΦΙΑ|ΑΑΔΕ|επίσημ|ΦΕΚ|εκκαθαριστικ|Ε9\b/.test(bc.txt) && card !== document.body && card.getBoundingClientRect().height < 700) {
      add('συνέπεια', 'Μεσαίο', card, '«εκτίμηση» στο ίδιο component με επίσημο στοιχείο (ΕΝΦΙΑ/ΑΑΔΕ/ΦΕΚ) — να κριθεί αν το νούμερο είναι επίσημο', null, { text: (bc.txt.match(/.{0,30}εκτ[ιί]μ.{0,30}/i) || [''])[0] })
    }
  }
  if (euroVariants.size > 1) { const [el] = [...euroVariants.values()][0]; add('συνέπεια', 'Χαμηλό', el, `μικτή γραφή «€» στη σελίδα: ${[...euroVariants.entries()].map(([v, [, s]]) => `${v} «${s}»`).join(' · ')}`, null, { dedupe: 'euro', text: [...euroVariants.keys()].join(' · ') }) }
  if (latinWords.size) { const words = [...latinWords.keys()].slice(0, 12); add('συνέπεια', 'Χαμηλό', [...latinWords.values()][0], `αγγλικές λέξεις στο κείμενο χρήστη: ${words.join(', ')}`, null, { dedupe: 'latin', text: words.join(', ') }) }
  // Ραβδογράμματα «γεμάτα»: στο ίδιο διάγραμμα, ≥5 ράβδοι της ίδιας κλάσης,
  // όλες ίδιου ύψους και κοντά στο πλήρες ύψος του διαγράμματος. Είτε είναι
  // γέμισμα/placeholder είτε η κλίμακα δεν λέει τίποτα — και τα δύο θέλουν μάτι.
  const barSeen = new Set()
  for (const ch of document.querySelectorAll('figure, [role="img"], svg, [class*="chart" i], [class*="plot" i]')) {
    if (!vis(ch) || skipEl(ch) || [...barSeen].some(x => x.contains(ch) || ch.contains(x))) continue
    const cb = ch.getBoundingClientRect()
    if (cb.height < 60 || cb.width < 120) continue
    const groups = new Map()
    for (const el of ch.querySelectorAll('*')) {
      if (el.children.length || (el.textContent || '').trim()) continue
      if (el.tagName !== 'rect' && !(el instanceof HTMLElement)) continue
      const b = el.getBoundingClientRect()
      if (b.width < 2 || b.width > 48 || b.height < 12) continue
      const k = el.tagName + '|' + (el.getAttribute('class') || '') + '|' + (el.getAttribute('fill') || '')
      if (!groups.has(k)) groups.set(k, []); groups.get(k).push(b)
    }
    for (const [k, bs] of groups) {
      if (bs.length < 5) continue
      const hs = bs.map(b => b.height), mx = Math.max(...hs), mn = Math.min(...hs)
      const plot = Math.max(...bs.map(b => b.bottom)) - Math.min(...bs.map(b => b.top))
      if (mx - mn <= mx * 0.06 && mx >= Math.min(cb.height, plot + 1) * 0.6 && mx >= 40) {
        barSeen.add(ch)
        add('συνέπεια', 'Μεσαίο', ch, `${bs.length} ράβδοι (${k.split('|')[1] || k.split('|')[0]}) όλες στο ίδιο ύψος ~${Math.round(mx)}px — μοιάζουν με γέμισμα/placeholder, η κλίμακα δεν δείχνει διαφορά`, null, { text: sectionOf(ch) })
        break
      }
    }
  }

  // Στοιβαγμένες ράβδοι: κάθε στήλη έχει πολλά κομμάτια (πραγματικό +
  // αναμενόμενο + «λείπει»). Μετριέται το ύψος ΜΕΛΑΝΙΟΥ ανά στήλη.
  for (const g of document.querySelectorAll('body *')) {
    if (g.children.length < 5 || !vis(g) || skipEl(g) || [...barSeen].some(x => x.contains(g) || g.contains(x))) continue
    const cols = [...g.children].filter(k => !(k.textContent || '').trim() && k.getBoundingClientRect().width >= 3 && k.getBoundingClientRect().width <= 48)
    if (cols.length < 5 || cols.length < g.children.length - 2) continue
    const ink = cols.map(c => {
      const painted = (e) => { const cs = getComputedStyle(e); return (cs.backgroundColor && !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor)) || cs.borderTopStyle !== 'none' || e.tagName === 'rect' }
      const leaves = [...c.querySelectorAll('*')].filter(e => !e.children.length && painted(e)).map(e => e.getBoundingClientRect()).filter(b => b.height > 1 && b.width > 1)
      if (!leaves.length) return 0
      return Math.max(...leaves.map(b => b.bottom)) - Math.min(...leaves.map(b => b.top))
    })
    const colH = Math.max(...cols.map(c => c.getBoundingClientRect().height))
    const mx = Math.max(...ink)
    const near = ink.filter(h => h >= colH * 0.8)
    if (colH >= 60 && mx >= colH * 0.75 && near.length >= Math.max(5, cols.length * 0.75)) {
      barSeen.add(g)
      add('συνέπεια', 'Μεσαίο', g, `${near.length}/${cols.length} στήλες διαγράμματος γεμάτες ως το ~${Math.round(mx / colH * 100)}% του ύψους — μοιάζουν με γέμισμα/placeholder, δεν φαίνεται διαφορά από στήλη σε στήλη`, null, { text: sectionOf(g) })
    }
  }

  // ═══ 7 ΔΙΠΛΟΤΥΠΟ ═════════════════════════════════════════════════════════
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim()
  const bannerEls = [...document.querySelectorAll('[role="alert"], [role="status"], [role="note"], [class*="banner" i], [class*="notice" i], [class*="callout" i], [class*="alert" i]')]
    .filter(e => vis(e) && !skipEl(e) && norm(e.textContent).length > 15)
  const top = bannerEls.filter(e => !bannerEls.some(o => o !== e && o.contains(e)))
  const byText = new Map()
  for (const e of top) { const k = norm(e.textContent).slice(0, 120); if (!byText.has(k)) byText.set(k, []); byText.get(k).push(e) }
  for (const [k, els] of byText) if (els.length > 1) add('διπλότυπο', 'Μεσαίο', els[1], `το ίδιο πλαίσιο ${els.length} φορές στη σελίδα`, union(docRect(els[0].getBoundingClientRect()), docRect(els[1].getBoundingClientRect())), { text: k.slice(0, 80) })
  // Μεγάλα κομμάτια κειμένου που επαναλαμβάνονται (όχι σε επαναλαμβανόμενη λίστα).
  const para = new Map()
  for (const x of texts) {
    if (x.txt.length < 40 || x.svg) continue
    if (!para.has(x.txt)) para.set(x.txt, []); para.get(x.txt).push(x.el)
  }
  for (const [t, els] of para) {
    if (els.length < 2) continue
    const rep = els.every(e => e.closest('li, tr, [role="listitem"], [role="row"], [role="option"]'))
    if (rep || byText.has(norm(t).slice(0, 120))) continue
    add('διπλότυπο', 'Μεσαίο', els[1], `το ίδιο κείμενο ${els.length} φορές στη σελίδα`, union(docRect(els[0].getBoundingClientRect()), docRect(els[1].getBoundingClientRect())), { text: t.slice(0, 80) })
  }
  const cta = new Map()
  for (const e of document.querySelectorAll('a[href], button')) {
    if (!vis(e) || skipEl(e)) continue
    const t = norm(e.textContent)
    if (t.length < 10 || e.closest('nav, header, footer, li, tr, [role="listitem"], [role="tablist"], [role="menu"], [role="listbox"]')) continue
    if (!cta.has(t)) cta.set(t, []); cta.get(t).push(e)
  }
  for (const [t, els] of cta) if (els.length > 1) add('διπλότυπο', 'Χαμηλό', els[1], `το ίδιο κουμπί/CTA ${els.length} φορές`, union(docRect(els[0].getBoundingClientRect()), docRect(els[1].getBoundingClientRect())), { text: t.slice(0, 60) })
  return F
}

// ── Πιλούλες και καρτέλες: εστίαση μετά από κλικ, αλλαγή πλάτους, υπο-όψεις ──
const MARK_TOGGLES = (max) => {
  const vis = (el) => el.checkVisibility?.({ visibilityProperty: true, opacityProperty: true }) ?? true
  const cands = [...document.querySelectorAll('[role="tab"], [aria-pressed], [role="radio"], [aria-selected]:not([role="option"]), [role="switch"]')]
    .filter(e => vis(e) && !e.closest('.bench-topbar, .pa-panel, .pa-fab-wrap, [aria-modal="true"] ~ *') && e.getBoundingClientRect().width > 4)
  cands.slice(0, max).forEach((e, i) => e.setAttribute('data-opt-t', String(i)))
  return Math.min(cands.length, max)
}
const TOGGLE_STATE = (i) => {
  const el = document.querySelector(`[data-opt-t="${i}"]`)
  if (!el) return null
  const grp = el.closest('[role="tablist"], [role="radiogroup"], [role="group"]') || el.parentElement
  const sibs = [...grp.querySelectorAll('[data-opt-t], [role="tab"], [aria-pressed], [role="radio"]')]
  const label = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40)
  return { label, sibs: sibs.map(s => { const b = s.getBoundingClientRect(); return [Math.round(b.left * 2) / 2, Math.round(b.width * 2) / 2, getComputedStyle(s).fontWeight] }), rect: (() => { const b = el.getBoundingClientRect(); return { x: b.left + scrollX, y: b.top + scrollY, w: b.width, h: b.height } })(), grpRect: (() => { const b = grp.getBoundingClientRect(); return { x: b.left + scrollX, y: b.top + scrollY, w: b.width, h: b.height } })(), role: el.getAttribute('role') || (el.hasAttribute('aria-pressed') ? 'pressed' : 'selected') }
}
const FOCUS_AFTER_CLICK = (i) => {
  const el = document.querySelector(`[data-opt-t="${i}"]`)
  const a = document.activeElement
  if (!el || !a || a === document.body) return null
  const cs = getComputedStyle(a)
  const ow = parseFloat(cs.outlineWidth) || 0
  const outline = cs.outlineStyle !== 'none' && ow > 0
  const ring = /\d+px \d+px 0px \d+(\.\d+)?px|0px 0px 0px [1-9]/.test(cs.boxShadow) && a.matches(':focus') && !a.matches(':focus-visible')
  if (!outline && !ring) return null
  const er = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0
  const ar = parseFloat(cs.borderTopLeftRadius) || 0
  const b = a.getBoundingClientRect()
  return { outline, ring, fv: a.matches(':focus-visible'), same: a === el || el.contains(a) || a.contains(el), er, ar, h: b.height, style: `${cs.outlineStyle} ${cs.outlineWidth} offset ${cs.outlineOffset}`, rect: { x: b.left + scrollX - 6, y: b.top + scrollY - 6, w: b.width + 12, h: b.height + 12 } }
}

// ═════════════════════════════════════════════════════════════════════════
// ΧΑΡΤΟΓΡΑΦΗΣΗ ΚΕΙΜΕΝΟΥ → ΑΡΧΕΙΟ:ΓΡΑΜΜΗ
// ═════════════════════════════════════════════════════════════════════════
const SRC = []
const walk = (d) => {
  for (const n of readdirSync(d)) {
    if (n === 'node_modules' || n.startsWith('.')) continue
    const p = join(d, n)
    const st = statSync(p)
    if (st.isDirectory()) walk(p)
    else if (/\.(tsx?|mjs)$/.test(n) && !/\.test\./.test(n)) SRC.push({ file: relative(repoRoot, p), lines: readFileSync(p, 'utf8').split('\n') })
  }
}
for (const d of ['app', 'components', 'lib']) if (existsSync(join(repoRoot, d))) walk(join(repoRoot, d))
const classFiles = new Map()
const findSource = (text, cssSel, scene) => {
  const comp = SCENE_COMP[scene] || ''
  const compDir = comp.replace(/\.tsx$/, '').replace(/Tab/, '').toLowerCase()
  const pref = (f) => f === comp ? 0 : (compDir && f.toLowerCase().includes(compDir.split('/').pop())) ? 1 : (scene.startsWith('/') ? !f.startsWith('app/dashboard') : f.startsWith('app/dashboard')) ? 2 : 3
  const tries = []
  const runs = (text || '').replace(/[«»"“”]/g, ' ').split(/[\d€%×|/·()]+/).map(s => s.trim()).filter(s => s.length >= 8 && /[α-ωΑ-ΩάέήίόύώΆΈΉΊΌΎΏϊϋΐΰA-Za-z]{3}/.test(s))
  runs.sort((a, b) => b.length - a.length)
  for (const r of runs.slice(0, 3)) { tries.push(r.slice(0, 40)); tries.push(r.split(' ').slice(0, 3).join(' ')) }
  // Κλάση μόνο όταν ανήκει σε λίγα αρχεία: το «kpi-card» είναι παντού και
  // δείχνει τυχαίο αρχείο.
  for (const c of ((cssSel || '').split(' > ').pop().match(/\.([a-zA-Z][\w-]{3,})/g) || []).concat((cssSel || '').match(/\.([a-zA-Z][\w-]{3,})/g) || [])) {
    const k = c.slice(1)
    if (!classFiles.has(k)) classFiles.set(k, SRC.filter(s => s.lines.some(l => l.includes(k))).length)
    if (classFiles.get(k) <= 2) tries.push(k)
  }
  for (const t of tries) {
    if (!t || t.length < 4) continue
    const hits = []
    for (const s of SRC) {
      if (s.file.startsWith('lib/') && !t.includes(' ')) continue
      const i = s.lines.findIndex(l => l.includes(t))
      if (i >= 0) hits.push([pref(s.file), `${s.file}:${i + 1}`])
    }
    if (hits.length) return hits.sort((a, b) => a[0] - b[0])[0][1]
  }
  return null
}
// Το component κάθε σκηνής, από το ίδιο το mobile.tsx.
const SCENE_COMP = (() => {
  const src = readFileSync(join(repoRoot, 'scripts/perf-bench/mobile.tsx'), 'utf8')
  const imp = new Map()
  for (const m of src.matchAll(/import\s+(?:\{\s*)?(\w+)(?:\s*\})?\s+from\s+'@\/([^']+)'/g)) imp.set(m[1], m[2])
  const out = {}
  for (const m of src.matchAll(/^\s*'?([\w-]+)'?:\s*\(\)\s*=>\s*(?:\(\s*)?<(\w+)/gm)) if (imp.has(m[2])) out[m[1]] = imp.get(m[2]) + '.tsx'
  return out
})()

// ═════════════════════════════════════════════════════════════════════════
// Ο ΒΡΟΧΟΣ
// ═════════════════════════════════════════════════════════════════════════
const browser = await launchEngine()
let publicOk = env.OPT_PUBLIC !== '0'
if (publicOk) {
  try { const r = await fetch(BASE + '/'); publicOk = r.ok } catch { publicOk = false }
  if (!publicOk) console.log(`· οι δημόσιες σελίδες παραλείπονται: δεν απαντά το ${BASE}`)
}
// ═══ ΟΙ ΣΕΛΙΔΕΣ ΤΟΥ ΧΑΡΤΗ, ΟΧΙ ΜΟΝΟ Η ΛΙΣΤΑ ΠΙΟ ΠΑΝΩ ════════════════════════
// Με `OPT_SITEMAP=1` η λίστα των δημόσιων γίνεται η ένωση του PUBLIC με ό,τι
// δηλώνει το ίδιο το site στο /sitemap.xml. Ενας νέος οδηγός μπαίνει στη
// σάρωση τη μέρα που μπαίνει στον χάρτη, χωρίς να τον θυμηθεί κανείς εδώ. Ο
// χάρτης γράφει απόλυτες διευθύνσεις του δημόσιου domain· κρατιέται μόνο η
// διαδρομή, ώστε ο ίδιος χάρτης να σαρώνεται και τοπικά.
let pages = env.OPT_PAGES ? env.OPT_PAGES.split(',') : PUBLIC
// Ο χάρτης ζητήθηκε ρητά, άρα και οι δημόσιες σελίδες: αν η βάση δεν απαντά,
// η σιωπηλή παράλειψη θα έβγαζε την καστάνια πράσινη πάνω μόνο στον πάγκο.
if (env.OPT_SITEMAP === '1' && !publicOk && env.OPT_PUBLIC !== '0') {
  console.error(`✗ Ζητήθηκε ο χάρτης του ${BASE} αλλά η βάση δεν απαντά. Η σάρωση δεν έγινε.`)
  process.exit(2)
}
if (publicOk && env.OPT_SITEMAP === '1' && !env.OPT_PAGES) {
  try {
    const xml = await (await fetch(BASE + '/sitemap.xml', { signal: AbortSignal.timeout(20000) })).text()
    const paths = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => { try { return new URL(m[1]).pathname.replace(/\/+$/, '') || '/' } catch { return null } }).filter(Boolean)
    if (!paths.length) throw new Error('χωρίς <loc>')
    pages = [...new Set([...PUBLIC, ...paths])]
  } catch (e) {
    console.error(`✗ Ο χάρτης ${BASE}/sitemap.xml δεν διαβάστηκε (${e.message}).`)
    process.exit(2)
  }
}

// ═══ ΑΠΕΝΑΝΤΙ ΣΤΗΝ ΠΑΡΑΓΩΓΗ, ΜΟΝΟ ΑΝΑΓΝΩΣΗ — ΚΑΙ ΑΥΤΟ ΤΟ ΕΠΙΒΑΛΛΕΙ Ο ΠΕΡΙΗΓΗΤΗΣ
// Ο σαρωτής πατά καρτέλες και κουμπιά επιλογής για να δει τις υπο-όψεις. Σε
// τοπικό διακομιστή αυτό δεν πειράζει κανέναν· απέναντι στο properwise.gr ένα
// κλικ σε λάθος κουμπί θα μπορούσε να στείλει φόρμα. Η υπόσχεση «δεν γράφει
// τίποτα» δεν μένει στη σειρά των κλικ: κάθε αίτημα που δεν είναι GET, HEAD ή
// OPTIONS κόβεται πριν φύγει από τον περιηγητή. Κόβονται και τα μετρητικά
// επισκεψιμότητας (`/_vercel/insights`, `/_vercel/speed-insights`), ώστε η
// εβδομαδιαία σάρωση να μη φουσκώνει τα νούμερα επισκεπτών του ιδιοκτήτη.
const READ_ONLY = async (ctx) => {
  await ctx.route('**/*', (route) => {
    const req = route.request()
    if (!/^(GET|HEAD|OPTIONS)$/.test(req.method()) || /\/_vercel\/(insights|speed-insights)\//.test(req.url())) return route.abort()
    return route.continue()
  })
}

const targets = []
if (env.OPT_BENCH !== '0') {
  if (!existsSync(join(repoRoot, '.perf-bench', 'mobile.html'))) { console.error('Λείπει ο πάγκος: node scripts/perf-bench/build-mobile.mjs'); process.exit(2) }
  for (const s of scenesToRun()) targets.push({ kind: 'bench', name: s })
}
if (publicOk) for (const p of pages) targets.push({ kind: 'public', name: p })

const jobs = []
for (const t of targets) for (const w of WIDTHS) for (const th of THEMES) jobs.push({ ...t, width: w, theme: th, sub: th === THEMES[0], toggles: th === THEMES[0] && (w === 390 || w === 1280 || !WIDTHS.includes(390)) })

const raw = []
const shotFor = new Map()
let shotN = 0
const keyOf = (f) => [f.target, f.cls, f.what.replace(/ — και στο τέλος.*$/, '').replace(/\d+(\.\d+)?/g, '#').replace(/«[^»]*»/g, '«»'), f.dedupe && f.dedupe !== 'fab' ? '' : f.sel.replace(/:nth-child\(\d+\)/g, ''), f.dedupe && f.dedupe !== 'fab' ? f.dedupe : (f.text || '').replace(/\d+/g, '#').slice(0, 50)].join(' ¦ ')

const record = async (page, list, at) => {
  for (const f of list) {
    const r = { ...f, target: at.target, view: at.view, width: at.width, theme: at.theme }
    r.key = keyOf(r)
    raw.push(r)
    if (SHOTS && !shotFor.has(r.key) && shotN < MAX_SHOTS && f.rect && f.rect.w > 0) {
      shotFor.set(r.key, null)
      const pad = 16
      // Ο κυλιόμενος φέρνει το εύρημα στην οθόνη· το στιγμιότυπο είναι του
      // παραθύρου, γιατί το fullPage δεν βλέπει μέσα σε `.app-content`.
      const [cur, vw, vh] = await page.evaluate(([y, src, fixed]) => {
        const sc = new Function('return (' + src + ')')()()
        const now = sc ? sc.scrollTop : window.scrollY
        if (!fixed) { const t = Math.max(0, y - 60); if (sc) sc.scrollTop = t; else window.scrollTo(window.scrollX, t) }
        return [sc ? sc.scrollTop : window.scrollY, innerWidth, innerHeight, now]
      }, [f.rect.y, SCROLLER.toString(), !!f.fab])
      const rel = f.rect.y - cur
      const x = Math.max(0, f.rect.x - pad), y = Math.max(0, rel - pad)
      const clip = { x, y, width: Math.min(f.rect.w + pad * 2, 900, vw - x), height: Math.min(f.rect.h + pad * 2, 520, vh - y) }
      if (clip.width < 4 || clip.height < 4) continue
      const name = `${String(++shotN).padStart(3, '0')}-${at.target.replace(/[^\w-]+/g, '_').slice(0, 30)}-${at.width}-${at.theme}.jpg`
      try { await page.waitForTimeout(60); await page.screenshot({ path: join(SHOT_DIR, name), clip, type: 'jpeg', quality: 55 }); shotFor.set(r.key, join(SHOT_DIR, name)) } catch { /* εκτός σελίδας */ }
    }
  }
}

const probe = async (page, at, fabSel, withTouch) => {
  const scSrc = SCROLLER.toString()
  const list = await page.evaluate(PROBE, { fabSel, withTouch, scSrc })
  await record(page, list, at)
  if (fabSel) {
    const end = await page.evaluate(([fs, src]) => {
      if (!document.querySelector(fs)) return false
      const sc = new Function('return (' + src + ')')()()
      if (sc) sc.scrollTop = sc.scrollHeight; else window.scrollTo(0, document.documentElement.scrollHeight)
      window.__optEnd = true; return true
    }, [fabSel, scSrc])
    if (end) {
      await page.waitForTimeout(200)
      await record(page, await page.evaluate(PROBE, { fabSel, withTouch, scSrc }), at)
      await page.evaluate((src) => { window.__optEnd = false; const sc = new Function('return (' + src + ')')()(); if (sc) sc.scrollTop = 0; else window.scrollTo(0, 0) }, scSrc)
      await page.waitForTimeout(100)
    }
  }
}

const open = async (ctx, job) => {
  const page = await ctx.newPage()
  if (job.kind === 'bench') {
    await page.goto(benchUrl(job.name) + '&noa=1', { waitUntil: 'networkidle', timeout: 30000 })
    await page.evaluate((m) => document.documentElement.setAttribute('data-mode', m), job.theme)
    await page.waitForFunction(() => (document.querySelector('.app-content')?.innerText || '').trim().length > 120, { timeout: 8000 }).catch(() => {})
  } else {
    await page.goto(BASE + job.name, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => page.goto(BASE + job.name, { waitUntil: 'load' }))
  }
  // ΤΟ content-visibility: auto ΚΡΥΒΕΙ ΑΠΟ ΤΟΝ ΜΕΤΡΗΤΗ Ο,ΤΙ ΕΙΝΑΙ ΚΑΤΩ ΑΠΟ ΤΗΝ
  // ΟΘΟΝΗ. Οι ενότητες της Επισκόπησης δεν αποδίδονται ώσπου να πλησιάσει η
  // κύλιση: χωρίς αυτό, η μισή σελίδα δεν είχε ούτε ορθογώνια ούτε ευρήματα.
  await page.addStyleTag({ content: '*, *::before, *::after { content-visibility: visible !important; }' }).catch(() => {})
  await page.evaluate(() => document.fonts?.ready).catch(() => {})
  await page.waitForTimeout(450)
  return page
}

const lanes = laneCount(jobs.length)
let done = 0
const t0 = Date.now()
let next = 0
await Promise.all(Array.from({ length: lanes }, async () => {
  for (;;) {
    const i = next++
    if (i >= jobs.length) return
    const job = jobs[i]
    const touch = job.width <= 768
    const ctx = await browser.newContext({ viewport: { width: job.width, height: job.width < 700 ? 800 : 1000 }, hasTouch: touch, isMobile: touch && job.width < 700, locale: 'el-GR', colorScheme: job.theme === 'light' ? 'light' : 'dark', reducedMotion: 'reduce' })
    await ctx.addInitScript((m) => { try { localStorage.setItem('pos_mode', m) } catch { /* κλειστή αποθήκη */ } }, job.theme)
    await ctx.addInitScript(SEED_CONSENT)
    // Και τοπικά, όχι μόνο απέναντι στην παραγωγή: η βάση της καστάνιας
    // μετριέται τοπικά και πρέπει να έχει δει την ΙΔΙΑ σελίδα με την εβδομαδιαία.
    if (job.kind === 'public') await READ_ONLY(ctx)
    const target = job.kind === 'bench' ? job.name : job.name
    const fabSel = job.kind === 'bench' ? '.pa-fab' : '.pa-fab'
    try {
      const page = await open(ctx, job)
      await probe(page, { target, view: '', width: job.width, theme: job.theme }, fabSel, touch)
      if (job.sub) {
        const n = await page.evaluate(MARK_TOGGLES, SUB_MAX)
        const seenGroups = new Set()
        for (let k = 0; k < n; k++) {
          const before = await page.evaluate(TOGGLE_STATE, k)
          if (!before) continue
          const loc = page.locator(`[data-opt-t="${k}"]`)
          try { await loc.scrollIntoViewIfNeeded({ timeout: 1000 }); await loc.click({ timeout: 1500 }) } catch { continue }
          await page.waitForTimeout(300)
          // Μετά το κλικ μπορεί να άνοιξε παράθυρο ή να άλλαξε σελίδα.
          if (job.kind === 'public' && !page.url().startsWith(BASE + job.name)) { await page.close(); break }
          const after = await page.evaluate(TOGGLE_STATE, k)
          if (job.toggles) {
            const foc = await page.evaluate(FOCUS_AFTER_CLICK, k)
            if (foc) {
              const what = foc.same
                ? `περίγραμμα εστίασης (${foc.ring ? 'δαχτυλίδι box-shadow' : foc.style}) μένει μετά από κλικ με ποντίκι${foc.fv ? '' : ' — ο κανόνας είναι :focus, όχι :focus-visible'}${foc.outline && foc.er >= foc.h / 2 - 1 && foc.ar < foc.er - 4 ? ' · και είναι τετράγωνο γύρω από πιλούλα' : ''}`
                : `μετά το κλικ η εστίαση πάει σε περιέχον στοιχείο με άλλο σχήμα (ακτίνα ${Math.round(foc.ar)} αντί ${Math.round(foc.er)})`
              await record(page, [{ cls: 'αφή/εστίαση', sev: 'Μεσαίο', sel: '', text: before.label, what, rect: foc.rect, section: '' }], { target, view: '', width: job.width, theme: job.theme })
            }
            if (after && before.sibs.length === after.sibs.length && before.sibs.length > 1) {
              const moved = before.sibs.some((s, j) => Math.abs(s[0] - after.sibs[j][0]) > 0.5 || Math.abs(s[1] - after.sibs[j][1]) > 0.5)
              const wchg = before.sibs.some((s, j) => s[2] !== after.sibs[j][2])
              if (moved) await record(page, [{ cls: 'αφή/εστίαση', sev: 'Μεσαίο', sel: '', text: before.label, what: `η επιλογή «${before.label}» μετακινεί τις διπλανές${wchg ? ' — αλλάζει το βάρος της γραμματοσειράς' : ''} (reflow στο κλικ)`, rect: before.grpRect, section: '' }], { target, view: '', width: job.width, theme: job.theme })
            }
          }
          // Υπο-όψη: μόνο καρτέλες/κουμπιά επιλογής, μία φορά ανά ετικέτα.
          if (seenGroups.has(before.label)) continue
          seenGroups.add(before.label)
          await page.evaluate(() => { document.activeElement?.blur?.() })
          await probe(page, { target, view: before.label, width: job.width, theme: job.theme }, fabSel, touch)
        }
      }
      if (!page.isClosed()) await page.close()
    } catch (err) {
      raw.push({ cls: 'σφάλμα', sev: 'Υψηλό', target, width: job.width, theme: job.theme, what: 'η σελίδα δεν φόρτωσε: ' + String(err.message).slice(0, 120), sel: '', text: '', key: 'err ' + target })
    }
    await ctx.close()
    done++
    if (done % 20 === 0) console.log(`  ${done}/${jobs.length} · ${Math.round((Date.now() - t0) / 1000)}s`)
  }
}))
await browser.close()

// ═════════════════════════════════════════════════════════════════════════
// ΣΥΓΧΩΝΕΥΣΗ: ίδιο component + ίδιο σφάλμα σε άλλα πλάτη/θέματα = ΕΝΑ εύρημα
// ═════════════════════════════════════════════════════════════════════════
const SEV = { 'Υψηλό': 3, 'Μεσαίο': 2, 'Χαμηλό': 1 }
const merged = new Map()
for (const r of raw) {
  let m = merged.get(r.key)
  if (!m) { m = { ...r, widths: new Set(), themes: new Set(), views: new Set(), n: 0 }; merged.set(r.key, m) }
  m.widths.add(r.width); m.themes.add(r.theme); if (r.view) m.views.add(r.view); m.n++
  if (SEV[r.sev] > SEV[m.sev]) { m.sev = r.sev; m.what = r.what }
}
const findings = [...merged.values()].map(m => {
  const scene = m.target
  const file = findSource(m.src || m.text, m.sel, scene) || (SCENE_COMP[scene] ? SCENE_COMP[scene] + ' (σκηνή)' : null)
  const hay = `${m.section} ${m.text} ${m.sel} ${file} ${[...m.views].join(' ')}`
  const elsewhere = ELSEWHERE.find(e => e.scene.test(scene) && e.re.test(hay))?.label || null
  return { target: scene, kind: scene.startsWith('/') ? 'δημόσια' : 'ταμπλό', cls: m.cls, sev: m.sev, what: m.what, text: m.text, sel: m.sel, section: m.section, file, views: [...m.views], widths: [...m.widths].sort((a, b) => a - b), themes: [...m.themes], hits: m.n, shot: shotFor.get(m.key) || null, elsewhere }
}).sort((a, b) => a.target.localeCompare(b.target) || SEV[b.sev] - SEV[a.sev] || a.cls.localeCompare(b.cls))

writeFileSync(join(OUT, 'findings.json'), JSON.stringify(findings, null, 1))
// ΤΙ ΣΑΡΩΘΗΚΕ, ΔΙΠΛΑ ΣΤΟ ΤΙ ΒΡΕΘΗΚΕ. Η καστάνια (scripts/optiki-ratchet.mjs)
// συγκρίνει μόνο σαρώσεις με τα ΙΔΙΑ πλάτη και θέματα: με λιγότερα πλάτη ένα
// εύρημα μπορεί να βγει με χαμηλότερη σοβαρότητα και να φανεί ψεύτικη άνοδος
// στη διπλανή κατηγορία.
writeFileSync(join(OUT, 'run.json'), JSON.stringify({ base: BASE, widths: WIDTHS, themes: THEMES, targets: targets.map(t => t.name), seconds: Math.round((Date.now() - t0) / 1000), detections: raw.length }, null, 1))
const CLS = ['επικάλυψη', 'υπερχείλιση', 'αναδίπλωση', 'αφή/εστίαση', 'στοίχιση', 'συνέπεια', 'διπλότυπο', 'σφάλμα']
const count = (arr, f) => arr.reduce((o, x) => { o[f(x)] = (o[f(x)] || 0) + 1; return o }, {})
const bySev = count(findings, x => x.sev), byCls = count(findings, x => x.cls)
const md = []
md.push(`# Οπτική σάρωση · ${new Date().toISOString().slice(0, 10)}`, '')
md.push(`Πλάτη ${WIDTHS.join('/')} · θέματα ${THEMES.join('/')} · ${targets.length} οθόνες · ${raw.length} ανιχνεύσεις → **${findings.length} ευρήματα** μετά τη συγχώνευση.`, '')
md.push(`Σοβαρότητα: Υψηλό ${bySev['Υψηλό'] || 0} · Μεσαίο ${bySev['Μεσαίο'] || 0} · Χαμηλό ${bySev['Χαμηλό'] || 0}`, '')
md.push('| Κατηγορία | Υψηλό | Μεσαίο | Χαμηλό | Σύνολο |', '|---|---:|---:|---:|---:|')
for (const c of CLS) { const xs = findings.filter(f => f.cls === c); if (xs.length) md.push(`| ${c} | ${xs.filter(f => f.sev === 'Υψηλό').length} | ${xs.filter(f => f.sev === 'Μεσαίο').length} | ${xs.filter(f => f.sev === 'Χαμηλό').length} | ${xs.length} |`) }
md.push('')
const groups = new Map()
for (const f of findings) { if (!groups.has(f.target)) groups.set(f.target, []); groups.get(f.target).push(f) }
for (const [t, fs] of groups) {
  const cc = count(fs, x => x.cls)
  md.push(`## ${t}${SCENE_COMP[t] ? ` — ${SCENE_COMP[t]}` : ''}`, '', `${fs.length} ευρήματα · ${Object.entries(cc).map(([k, v]) => `${k} ${v}`).join(' · ')}`, '')
  for (const f of fs) {
    md.push(`- **[${f.sev}] ${f.cls}** — ${f.what}${f.elsewhere ? ` · 🔧 *σε εξέλιξη αλλού: ${f.elsewhere}*` : ''}`)
    if (f.text) md.push(`  - κείμενο: «${f.text.replace(/\|/g, '/')}»`)
    md.push(`  - πού: ${f.section ? `ενότητα «${f.section}» · ` : ''}${f.views.length ? `υπο-όψη ${f.views.slice(0, 3).map(v => `«${v}»`).join(', ')} · ` : ''}\`${f.sel || '—'}\`${f.file ? ` · ${f.file}` : ''}`)
    md.push(`  - πλάτη ${f.widths.join('/')} · ${f.themes.join('+')}${f.shot ? ` · στιγμιότυπο ${f.shot}` : ''}`)
  }
  md.push('')
}
writeFileSync(join(OUT, 'findings.md'), md.join('\n'))
console.log(`\n${findings.length} ευρήματα (${raw.length} ανιχνεύσεις) · Υψηλό ${bySev['Υψηλό'] || 0} · Μεσαίο ${bySev['Μεσαίο'] || 0} · Χαμηλό ${bySev['Χαμηλό'] || 0}`)
console.log(Object.entries(byCls).map(([k, v]) => `  ${k}: ${v}`).join('\n'))
console.log(`→ ${join(OUT, 'findings.md')}`)
