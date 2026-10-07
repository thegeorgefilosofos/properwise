// ═══════════════════════════════════════════════════════════════════════════
// Η ΚΡΙΣΗ ΤΟΥ ΗΜΕΡΗΣΙΟΥ AUDIT — ΚΑΘΑΡΕΣ ΣΥΝΑΡΤΗΣΕΙΣ, ΧΩΡΙΣ ΔΙΚΤΥΟ
// ─────────────────────────────────────────────────────────────────────────
// Το scripts/audit-check.mjs τρέχει το `npm audit` και τυπώνει. Η απόφαση
// «περνά ή κοκκινίζει» ζει εδώ, ώστε να ελέγχεται με σταθερά δείγματα
// (scripts/fixtures/audit/) και όχι με ό,τι απαντήσει το μητρώο σήμερα.
//
// Πέντε λόγοι αποτυχίας, ο καθένας με δικό του `kind`:
//   schema      η λίστα εξαιρέσεων είναι κακογραμμένη
//   unlisted    high ή critical αδυναμία που δεν είναι στη λίστα
//   expired     εξαίρεση που έληξε
//   stale       εξαίρεση χωρίς ζωντανή αδυναμία πίσω της
//   production  εξαιρεμένη αδυναμία που έφτασε σε πακέτο παραγωγής
// ═══════════════════════════════════════════════════════════════════════════

/** Οι σοβαρότητες που κρίνουν. Το moderate σε εργαλείο ανάπτυξης δεν ανοίγει ζήτημα. */
export const SEVERE = ['high', 'critical']

/** Πόσο μακριά επιτρέπεται η λήξη από την προσθήκη. Ενα έτος, όχι «για πάντα». */
export const MAX_DAYS = 366

/** Πόσες μέρες πριν τη λήξη τυπώνεται προειδοποίηση (χωρίς αποτυχία). */
export const WARN_DAYS = 30

const GHSA = /^GHSA(-[23456789cfghjmpqrvwx]{4}){3}$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const DAY = 86_400_000

const days = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DAY)
const validDate = s => typeof s === 'string' && DATE.test(s) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s

/**
 * @typedef {{ id: string, package: string, severity: string, title: string, range: string, url: string, effects: string[] }} Advisory
 * @typedef {{ kind: string, id?: string, text: string }} Problem
 */

/** Σημερινή ημερομηνία UTC, όπως τη βλέπει ο δρομέας του GitHub. */
export const todayUtc = () => new Date().toISOString().slice(0, 10)

/**
 * Οι αδυναμίες μιας αναφοράς `npm audit --json` (έκδοση 2).
 *
 * Στη μορφή 2 κάθε πακέτο έχει `via`: αντικείμενο όταν η αδυναμία είναι ΔΙΚΗ
 * του, σκέτο όνομα όταν την κληρονομεί από εξάρτηση. Μετρούν μόνο τα
 * αντικείμενα: το micromatch, το fast-glob και το eslint-config-next φαίνονται
 * high μόνο επειδή κουβαλούν το braces. Αν η ρίζα εξαιρεθεί, η αλυσίδα πάει μαζί.
 *
 * Αναφορά που δεν διαβάζεται ΔΕΝ είναι καθαρή αναφορά: πετά σφάλμα.
 * @param {any} report
 * @returns {Advisory[]}
 */
export function advisoriesOf(report) {
  if (!report || typeof report !== 'object') throw new Error('η αναφορά του npm audit δεν είναι JSON αντικείμενο')
  if (report.error) {
    const e = report.error
    throw new Error(`το npm audit δεν ολοκληρώθηκε: ${e.code ?? ''} ${e.summary ?? e.message ?? ''}`.trim())
  }
  if (report.auditReportVersion !== 2) throw new Error(`άγνωστη μορφή αναφοράς (auditReportVersion=${report.auditReportVersion}), αναμενόταν 2`)
  const seen = new Map()
  for (const [name, v] of Object.entries(report.vulnerabilities ?? {})) {
    for (const via of v.via ?? []) {
      if (!via || typeof via !== 'object') continue
      const id = via.url?.match(/GHSA(-[a-z0-9]{4}){3}/i)?.[0] ?? `npm-${via.source}`
      const pkg = via.name ?? name
      const key = `${id} ${pkg}`
      if (!seen.has(key)) seen.set(key, { id, package: pkg, severity: via.severity, title: via.title ?? '', range: via.range ?? '', url: via.url ?? '', effects: v.effects ?? [] })
    }
  }
  return [...seen.values()].sort((a, b) => a.package.localeCompare(b.package) || a.id.localeCompare(b.id))
}

/**
 * Ελεγχος της ίδιας της λίστας: κάθε εγγραφή πλήρης, λογική και μοναδική.
 * @param {any} list
 * @returns {Problem[]}
 */
export function schemaProblems(list) {
  const out = []
  const entries = list?.advisories
  if (!Array.isArray(entries)) return [{ kind: 'schema', text: 'λείπει ο πίνακας «advisories»' }]
  const keys = new Set()
  entries.forEach((e, i) => {
    const at = `εγγραφή ${i + 1}${e?.id ? ` (${e.id})` : ''}`
    const bad = text => out.push({ kind: 'schema', id: e?.id, text: `${at}: ${text}` })
    if (!e || typeof e !== 'object') return bad('δεν είναι αντικείμενο')
    if (!GHSA.test(e.id ?? '')) bad('το «id» πρέπει να είναι αναγνωριστικό GHSA, π.χ. GHSA-vfj7-8cjw-p6xm')
    if (!e.package || typeof e.package !== 'string') bad('λείπει το «package»')
    if (e.scope !== 'dev') bad('το «scope» πρέπει να είναι "dev": αδυναμία σε πακέτο παραγωγής δεν εξαιρείται, διορθώνεται')
    if (typeof e.reason !== 'string' || e.reason.trim().length < 40) bad('ο «reason» λείπει ή είναι πολύ σύντομος για να κριθεί από τρίτον')
    if (typeof e.owner !== 'string' || !e.owner.trim()) bad('λείπει ο «owner», δηλαδή ποιος αποφάσισε')
    if (!validDate(e.added)) bad('το «added» πρέπει να είναι ημερομηνία ΕΕΕΕ-ΜΜ-ΗΗ')
    if (!validDate(e.expires)) bad('το «expires» πρέπει να είναι ημερομηνία ΕΕΕΕ-ΜΜ-ΗΗ')
    if (validDate(e.added) && validDate(e.expires)) {
      const span = days(e.added, e.expires)
      if (span <= 0) bad('το «expires» είναι πριν ή πάνω στο «added»')
      else if (span > MAX_DAYS) bad(`η λήξη απέχει ${span} ημέρες από την προσθήκη· το όριο είναι ${MAX_DAYS}`)
    }
    const k = `${e.id} ${e.package}`
    if (keys.has(k)) bad('διπλή εγγραφή')
    keys.add(k)
  })
  return out
}

/**
 * Η απόφαση.
 * @param {{ full: any, prod: any, allowlist: any, today: string }} input
 *   full: `npm audit --json` · prod: `npm audit --omit=dev --json`
 * @returns {{ problems: Problem[], allowed: (Advisory & { entry: Record<string, string> })[], warnings: string[], severe: Advisory[] }}
 */
export function decide({ full, prod, allowlist, today }) {
  const problems = schemaProblems(allowlist)
  const warnings = []
  const entries = Array.isArray(allowlist?.advisories) ? allowlist.advisories.filter(e => e && typeof e === 'object') : []
  const live = advisoriesOf(full)
  const inProd = advisoriesOf(prod)
  const severe = live.filter(a => SEVERE.includes(a.severity))
  const match = (a, e) => a.id === e.id && a.package === e.package

  const allowed = []
  for (const a of severe) {
    const e = entries.find(x => match(a, x))
    if (!e) problems.push({ kind: 'unlisted', id: a.id, text: `${a.severity} ${a.id} στο ${a.package} ${a.range}: ${a.title}` })
    else allowed.push({ ...a, entry: e })
  }

  for (const e of entries) {
    if (validDate(e.expires) && today > e.expires) {
      problems.push({ kind: 'expired', id: e.id, text: `${e.id} (${e.package}) έληξε στις ${e.expires}· την αποφάσισε ${e.owner ?? 'κανείς'}` })
    } else if (validDate(e.expires)) {
      const left = days(today, e.expires)
      if (left <= WARN_DAYS) warnings.push(`${e.id} (${e.package}) λήγει σε ${left} ${left === 1 ? 'ημέρα' : 'ημέρες'}, στις ${e.expires}`)
    }
    if (!severe.some(a => match(a, e))) {
      problems.push({ kind: 'stale', id: e.id, text: `${e.id} (${e.package}): καμία ζωντανή high ή critical αδυναμία με αυτό το αναγνωριστικό` })
    }
    const p = inProd.find(a => a.id === e.id)
    if (p) problems.push({ kind: 'production', id: e.id, text: `${e.id} (${p.package}) εμφανίζεται στο npm audit --omit=dev: έφτασε σε πακέτο παραγωγής` })
  }
  return { problems, allowed, warnings, severe }
}
