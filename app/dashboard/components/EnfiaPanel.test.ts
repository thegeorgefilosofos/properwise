// ═══════════════════════════════════════════════════════════════════════════
// Η ΜΕΙΩΣΗ ΕΝΦΙΑ ΤΗΣ ΑΣΦΑΛΙΣΜΕΝΗΣ ΚΑΤΟΙΚΙΑΣ ΘΕΛΕΙ ΤΡΕΙΣ ΚΑΛΥΨΕΙΣ ΜΑΖΙ
// ─────────────────────────────────────────────────────────────────────────
// Τρέξε: npx tsx app/dashboard/components/EnfiaPanel.test.ts
//
// ΤΟ ΣΦΑΛΜΑ, ΟΠΩΣ ΗΤΑΝ (12/10/2026). Ο πίνακας ΕΝΦΙΑ πρότεινε τη μείωση με
// `insCustomEarthquake || insCustomFlood`: η πυρκαγιά δεν μετρούσε, ένας από
// τους δύο κινδύνους αρκούσε και οι καλύψεις του προγράμματος αγνοούνταν. Από
// κάτω έγραφε «άρα δικαιούσαι μείωση ΕΝΦΙΑ». Ο κανόνας θέλει σεισμό, πυρκαγιά
// και πλημμύρα μαζί (Α.1005/2026· Συχνές ερωτήσεις ΑΑΔΕ 14/01/2026,
// https://www.aade.gr/sites/default/files/2026-01/FAQs_asfalismenwn_katoik2026.pdf).
//
// Το `old` πιο κάτω είναι ο παλιός κανόνας αυτούσιος: κάθε περίπτωση που ο
// παλιός έλεγε «ναι» και ο νέος «όχι» γράφεται ρητά, για να φαίνεται τι
// άλλαξε και να μη γυρίσει πίσω.
// ═══════════════════════════════════════════════════════════════════════════
import { insuranceCoversEnfiaPerils, ENFIA_INSURANCE_PERILS, ENFIA_INSURANCE_NOTE } from './EnfiaPanel'
import * as catalog from './insurance/catalog'
import { INSURANCE_COMPANIES, deriveCoverages } from './insurance/catalog'

let pass = 0, fail = 0
function ok(name: string, cond: boolean) { if (cond) { pass++ } else { fail++; console.error(`✗ ${name}`) } }

type S = Parameters<typeof insuranceCoversEnfiaPerils>[0]
const covers = (d: S) => insuranceCoversEnfiaPerils(d, catalog)
/** Ο κανόνας όπως ήταν ως τις 12/10/2026. */
const old = (d: S) => !!(d?.insCustomEarthquake || d?.insCustomFlood)

// Ένα πρόγραμμα του καταλόγου για κάθε συνδυασμό, βρισκόμενο από τις σημαίες
// του και όχι από κωδικό: αν ο κατάλογος αλλάξει, ο έλεγχος δεν μένει χωρίς
// παράδειγμα σιωπηλά. Τα παραδείγματα των κινδύνων είναι προγράμματα κατοικίας
// χωρίς `status`, ώστε το «όχι» τους να το λέει ο κανόνας των κινδύνων και όχι
// ο κανόνας της πηγής πιο κάτω.
//
// ΤΟ «ΝΑΙ» ΘΕΛΕΙ ΠΥΡΚΑΓΙΑ ΓΡΑΜΜΕΝΗ ΡΗΤΑ. Το `all3` ζητά «Πυρκαγιά» στις
// καλύψεις του προγράμματος και όχι μόνο πλακίδιο αναμμένο: μια συνολική φράση
// όπως το «Πλήρης Κάλυψη» ανάβει κι αυτή την πυρκαγιά, αλλά δεν λέει ποιους
// κινδύνους γράφει το ασφαλιστήριο. Παράδειγμα «ναι» είναι μόνο πρόγραμμα με
// τον κίνδυνο ονομασμένο· το «Πλήρης Κάλυψη» ελέγχεται πιο κάτω με καλύψεις
// του χρήστη.
const plans = INSURANCE_COMPANIES.flatMap(c => c.plans.map(p => ({ c: c.value, p })))
const verified = plans.filter(x => !x.p.status && x.p.kind === 'home')
const fire = (cv: string[] | undefined) => deriveCoverages(cv ?? [], false, false, false).find(x => x.label === 'Πυρκαγιά')!.ok
const has3 = (x: (typeof plans)[number]) => !!x.p.earthquake && !!x.p.flood && fire(x.p.covers)
const all3 = verified.find(x => has3(x) && (x.p.covers ?? []).some(s => /πυρκαγ|φωτι/i.test(s)))
const noQuake = verified.find(x => !x.p.earthquake && x.p.flood && fire(x.p.covers))
const fireOnly = verified.find(x => !x.p.earthquake && !x.p.flood && fire(x.p.covers)
  && !(x.p.covers ?? []).some(s => /πλημμ/i.test(s)))

// ═══ ΟΙ ΤΡΕΙΣ ΚΙΝΔΥΝΟΙ ΥΠΑΡΧΟΥΝ ΣΤΑ ΠΛΑΚΙΔΙΑ ════════════════════════════
// Αν μετονομαστεί ένα πλακίδιο, ο κανόνας θα έβγαινε πάντα «όχι» χωρίς λέξη.
{
  const labels = deriveCoverages([], false, false, false).map(c => c.label)
  for (const p of ENFIA_INSURANCE_PERILS) ok(`το πλακίδιο «${p}» υπάρχει στο deriveCoverages`, labels.includes(p))
  ok('ο κανόνας έχει ακριβώς τρεις κινδύνους', ENFIA_INSURANCE_PERILS.length === 3)
}

// ═══ ΑΠΟ ΤΟ ΠΡΟΓΡΑΜΜΑ, ΧΩΡΙΣ ΧΕΙΡΟΚΙΝΗΤΗ ΕΠΕΞΕΡΓΑΣΙΑ ═════════════════════
{
  ok('ο κατάλογος έχει πρόγραμμα με σεισμό, πυρκαγιά και πλημμύρα', !!all3)
  ok('ο κατάλογος έχει πρόγραμμα με πυρκαγιά και πλημμύρα χωρίς σεισμό', !!noQuake)
  ok('ο κατάλογος έχει πρόγραμμα μόνο με πυρκαγιά', !!fireOnly)
  if (all3) {
    const d = { insProvider: all3.c, insPlanId: all3.p.id }
    ok(`${all3.p.id}: οι καλύψεις του προγράμματος μετρούν`, covers(d))
    ok(`${all3.p.id}: ο παλιός κανόνας δεν τις έβλεπε`, !old(d))
  }
  if (noQuake) ok(`${noQuake.p.id}: χωρίς σεισμό δεν πληροί`, !covers({ insProvider: noQuake.c, insPlanId: noQuake.p.id }))
  if (fireOnly) ok(`${fireOnly.p.id}: μόνο πυρκαγιά δεν πληροί`, !covers({ insProvider: fireOnly.c, insPlanId: fireOnly.p.id }))
}

// ═══ ΚΑΛΥΨΕΙΣ ΧΩΡΙΣ ΠΗΓΗ ΚΑΙ ΜΟΝΟ ΠΕΡΙΕΧΟΜΕΝΟ ΔΕΝ ΜΕΤΡΟΥΝ ΜΟΝΕΣ ΤΟΥΣ ══════
// Ο ΠΑΛΙΟΣ ΚΑΝΟΝΑΣ ΔΕΝ ΚΟΙΤΑΖΕ ΚΑΘΟΛΟΥ ΤΟ ΠΡΟΓΡΑΜΜΑ· Ο ΝΕΟΣ ΤΟ ΚΟΙΤΑΖΕΙ
// (12/10/2026). Χωρίς όριο, ένδεκα προγράμματα `legacy` ή `unverified` με
// «Πλήρης Κάλυψη + Σεισμός» χωρίς IPID θα έβγαζαν την πρόταση με «Εφαρμογή».
// Μετρούν μόνο όταν ο χρήστης πέρασε ο ίδιος τις καλύψεις. Το πρόγραμμα
// περιεχομένου δεν μετρά ποτέ: η μείωση είναι για την κατοικία.
{
  const byHand = (x: (typeof plans)[number]) => ({ insProvider: x.c, insPlanId: x.p.id, insEditCovers: true,
    insCustomCovers: [...(x.p.covers ?? []), 'Πυρκαγιά'].join(', '), insCustomEarthquake: true, insCustomFlood: true })
  for (const status of ['legacy', 'unverified'] as const) {
    const x = plans.find(y => y.p.status === status && y.p.kind === 'home' && has3(y))
    ok(`ο κατάλογος έχει πρόγραμμα ${status} με τους τρεις κινδύνους στις σημαίες`, !!x)
    if (!x) continue
    ok(`${x.p.id} (${status}): χωρίς δική του εκδοχή δεν μετρά`, !covers({ insProvider: x.c, insPlanId: x.p.id }))
    ok(`${x.p.id} (${status}): με τους τρεις περασμένους από τον χρήστη μετρά`, covers(byHand(x)))
  }
  const contents = plans.find(y => y.p.kind === 'contents')
  ok('ο κατάλογος έχει πρόγραμμα μόνο περιεχομένου', !!contents)
  if (contents) {
    ok(`${contents.p.id}: μόνο περιεχόμενο δεν μετρά`, !covers({ insProvider: contents.c, insPlanId: contents.p.id }))
    ok(`${contents.p.id}: ούτε με τους τρεις περασμένους από τον χρήστη`, !covers(byHand(contents)))
  }
}

// ═══ ΧΕΙΡΟΚΙΝΗΤΕΣ ΚΑΛΥΨΕΙΣ: ΜΕΤΡΟΥΝ ΜΟΝΟ ΟΤΑΝ ΙΣΧΥΟΥΝ ════════════════════
{
  const own = { insEditCovers: true }
  ok('σεισμός μόνο, χωρίς πλημμύρα και πυρκαγιά: όχι',
    !covers({ ...own, insCustomCovers: 'Κλοπή', insCustomEarthquake: true }))
  ok('…ο παλιός κανόνας έλεγε ναι', old({ ...own, insCustomCovers: 'Κλοπή', insCustomEarthquake: true }))
  ok('πλημμύρα μόνο: όχι', !covers({ ...own, insCustomCovers: 'Πυρκαγιά', insCustomFlood: true }))
  ok('…ο παλιός κανόνας έλεγε ναι', old({ ...own, insCustomCovers: 'Πυρκαγιά', insCustomFlood: true }))
  ok('σεισμός και πλημμύρα χωρίς πυρκαγιά: όχι',
    !covers({ ...own, insCustomCovers: 'Κλοπή', insCustomEarthquake: true, insCustomFlood: true }))
  ok('…ο παλιός κανόνας έλεγε ναι',
    old({ ...own, insCustomCovers: 'Κλοπή', insCustomEarthquake: true, insCustomFlood: true }))
  ok('και οι τρεις, δηλωμένοι από τον χρήστη: ναι',
    covers({ ...own, insCustomCovers: 'Πυρκαγιά, Κλοπή', insCustomEarthquake: true, insCustomFlood: true }))
  ok('η πλημμύρα μπορεί να είναι γραμμένη στη λίστα, όπως στα πλακίδια',
    covers({ ...own, insCustomCovers: 'Πυρκαγιά, Πλημμύρα', insCustomEarthquake: true }))
  // «Πλήρης Κάλυψη»: η πυρκαγιά εννοείται, όπως στα πλακίδια της Ασφάλειας.
  ok('«Πλήρης Κάλυψη» με σεισμό και πλημμύρα μετρά ως πυρκαγιά',
    covers({ ...own, insCustomCovers: 'Πλήρης Κάλυψη', insCustomEarthquake: true, insCustomFlood: true }))
  ok('«Πλήρης Κάλυψη» χωρίς σεισμό: όχι',
    !covers({ ...own, insCustomCovers: 'Πλήρης Κάλυψη', insCustomFlood: true }))
  // Τα κουτιά μιας παλιάς επεξεργασίας μένουν αποθηκευμένα όταν ο χρήστης
  // διαλέξει άλλο πρόγραμμα· η Ασφάλεια δεν τα διαβάζει πια και ούτε εδώ.
  if (noQuake) {
    const stale = { insProvider: noQuake.c, insPlanId: noQuake.p.id, insEditCovers: false,
      insCustomCovers: 'Πυρκαγιά', insCustomEarthquake: true, insCustomFlood: true }
    ok('ξεχασμένα κουτιά δεν προσθέτουν σεισμό σε πρόγραμμα που δεν τον έχει', !covers(stale))
    ok('…ο παλιός κανόνας τα μετρούσε', old(stale))
  }
  // Το αντίστροφο: ξεχασμένο κουτί ΠΛΗΜΜΥΡΑΣ σε πρόγραμμα με σεισμό και
  // πυρκαγιά χωρίς πλημμύρα. Ο κατάλογος δεν έχει σήμερα τέτοιο πρόγραμμα, οπότε
  // ο έλεγχος δίνει στον κανόνα συνθετικό κατάλογο (ο κανόνας τον παίρνει ως
  // όρισμα) αντί να μείνει χωρίς παράδειγμα.
  {
    const base = verified[0]
    const company = INSURANCE_COMPANIES.find(c => c.value === base.c)!
    const quakeNoFlood = { ...base.p, id: 'test_quake_no_flood', covers: ['Πυρκαγιά'], earthquake: true, flood: false, natural: false }
    const cat = { deriveCoverages, INSURANCE_COMPANIES: [{ ...company, value: 'test_company', plans: [quakeNoFlood] }] }
    const sel = { insProvider: 'test_company', insPlanId: 'test_quake_no_flood' }
    const stale = { ...sel, insEditCovers: false, insCustomCovers: 'Πυρκαγιά', insCustomEarthquake: true, insCustomFlood: true }
    ok('συνθετικό: σεισμός και πυρκαγιά χωρίς πλημμύρα: όχι', !insuranceCoversEnfiaPerils(sel, cat))
    ok('συνθετικό: ξεχασμένο κουτί πλημμύρας δεν προσθέτει πλημμύρα', !insuranceCoversEnfiaPerils(stale, cat))
    ok('συνθετικό: …με δική του εκδοχή το ίδιο κουτί μετρά', insuranceCoversEnfiaPerils({ ...stale, insEditCovers: true }, cat))
  }
}

// ═══ ΧΩΡΙΣ ΔΗΛΩΜΕΝΗ ΑΣΦΑΛΕΙΑ ═══════════════════════════════════════════
ok('καμία ρύθμιση: όχι', !covers(null) && !covers(undefined) && !covers({}))
ok('άγνωστη εταιρεία: όχι', !covers({ insProvider: 'δεν υπάρχει', insPlanId: 'x' }))

// ═══ Η ΠΡΟΤΑΣΗ ΛΕΕΙ ΜΟΝΟ Ο,ΤΙ ΞΕΡΕΙ Η ΟΘΟΝΗ ═════════════════════════════
{
  const t = ENFIA_INSURANCE_NOTE
  ok('δεν βεβαιώνει δικαίωμα («δικαιούσαι»)', !/δικαιο[υύ]σαι/u.test(t))
  // Οι καλύψεις έρχονται από τον κατάλογο ή από τον χρήστη, όχι από το συμβόλαιο.
  ok('λέει ότι οι καλύψεις είναι όπως δηλώθηκαν στην Ασφάλεια', t.startsWith('Όπως είναι δηλωμένο στην Ασφάλεια'))
  ok('δεν βεβαιώνει ότι το ασφαλιστήριο πληροί τον κανόνα', !/πληρο[υύ]ν|πληρο[ιί]/u.test(t))
  ok('λέει και τους τρεις κινδύνους', /σεισμ/u.test(t) && /πυρκαγι/u.test(t) && /πλημμ[υύ]ρ/u.test(t))
  // Όχι διαδρομή μενού με «·»: δεν υπάρχει εγγραφή στο AADE_DESTINATIONS.
  ok('λέει πού γίνεται η αίτηση (στο myPROPERTY της ΑΑΔΕ)', t.includes('στο myPROPERTY της ΑΑΔΕ') && !t.includes('·'))
  ok('λέει το μητρώο της Τράπεζας της Ελλάδος', t.includes('Τράπεζας της Ελλάδος'))
  // Ο ΕΝΦΙΑ μετρά την ασφάλιση του προηγούμενου έτους, αναλογικά για λιγότερο
  // από ολόκληρο (Α.1005/2026· Συχνές ερωτήσεις ΑΑΔΕ 14/01/2026).
  ok('λέει «προηγούμενο έτος»', t.includes('προηγούμενο έτος'))
  ok('λέει ότι για λιγότερο από ολόκληρο το έτος δίνεται αναλογικά', t.includes('αναλογικά'))
  ok('λέει ότι η «Εφαρμογή» μετρά ολόκληρη τη μείωση', /Εφαρμογή/u.test(t) && t.includes('ολόκληρη'))
  ok('κανένα ψηφίο γραμμένο με το χέρι', !/\d/.test(t))
  ok('κανένα κόμμα πριν από «και»', !/,\s+κ(αι|ι)\s/u.test(t))
}

console.log(fail === 0 ? `✓ EnfiaPanel: ${pass} έλεγχοι πέρασαν` : `✗ EnfiaPanel: ${fail} απέτυχαν από ${pass + fail}`)
if (fail > 0) process.exit(1)
