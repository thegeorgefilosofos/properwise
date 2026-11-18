// ═══════════════════════════════════════════════════════════════════════════
// Η ΦΟΡΜΑ ΤΟΥ ΝΕΟΥ ΕΝΟΙΚΙΑΣΤΗ: ΤΙ ΞΕΡΕΙ ΑΠΟ ΤΟ ΑΚΙΝΗΤΟ, ΠΟΙΟ ΠΕΔΙΟ ΦΤΑΙΕΙ
// ─────────────────────────────────────────────────────────────────────────
// Πριν (17/11/2026) η φόρμα ξεκινούσε άδεια και το σφάλμα δεν έλεγε πεδίο, άρα
// δεν μπορούσε να μπει δίπλα σε κανένα: έβγαινε στο τέλος της φόρμας, εκτός
// οθόνης. Τρέξε: npx tsx app/dashboard/components/TabTenantForm.test.ts
// ═══════════════════════════════════════════════════════════════════════════
import { tenantDefaults, tenantFormProblem, tenantFieldId, blank } from './TabTenantTypes'

let passed = 0, failed = 0
const fails: string[] = []
const ok = (name: string, cond: boolean) => { if (cond) passed++; else { failed++; fails.push(name) } }

// Κατοικία μόνο για τύπο κατοικίας σε μακροχρόνια μίσθωση.
ok('διαμέρισμα σε μακροχρόνια → Κατοικία', tenantDefaults({ propType: 'apartment', status: 'rent_long' }).lease_category === 'residential')
ok('μονοκατοικία σε μακροχρόνια → Κατοικία', tenantDefaults({ propType: 'house', status: 'rent_long' }).lease_category === 'residential')
ok('διαμέρισμα σε βραχυχρόνια → χωρίς πρόταση', tenantDefaults({ propType: 'apartment', status: 'rent_short' }).lease_category === undefined)
ok('γραφείο σε μακροχρόνια → χωρίς πρόταση', tenantDefaults({ propType: 'office', status: 'rent_long' }).lease_category === undefined)
ok('άγνωστος τύπος → χωρίς πρόταση', tenantDefaults({ propType: null, status: 'rent_long' }).lease_category === undefined)

// Το μίσθωμα από θετικό στόχο του ακινήτου.
ok('στόχος 650 → μίσθωμα «650»', tenantDefaults({ targetRent: 650 }).monthly_rent === '650')
ok('στόχος 0 → κενό', tenantDefaults({ targetRent: 0 }).monthly_rent === undefined)
ok('χωρίς στόχο → κενό', tenantDefaults({ targetRent: null }).monthly_rent === undefined)
ok('χωρίς ακίνητο → τίποτα', Object.keys(tenantDefaults(null)).length === 0)

// Η κενή φόρμα με τις προτάσεις: η μόνη αλλαγή είναι τα δύο πεδία.
{
  const f = { ...blank(), ...tenantDefaults({ propType: 'apartment', status: 'rent_long', targetRent: 650 }) }
  ok('η φόρμα ξεκινά με Κατοικία και 650', f.lease_category === 'residential' && f.monthly_rent === '650')
}

// Το σφάλμα λέει πεδίο, ώστε να γραφτεί δίπλα του.
ok('χωρίς όνομα → πεδίο ονοματεπώνυμου', tenantFormProblem({ full_name: '  ', lease_category: 'residential' })?.field === 'full_name')
ok('χωρίς τύπο → πεδίο τύπου μίσθωσης', tenantFormProblem({ full_name: 'Μαρία', lease_category: '' })?.field === 'lease_category')
ok('πλήρης → κανένα πρόβλημα', tenantFormProblem({ full_name: 'Μαρία', lease_category: 'commercial' }) === null)
ok('κάθε πεδίο έχει δικό του id', tenantFieldId('full_name') !== tenantFieldId('lease_category'))

console.log(`TabTenantForm.test.ts: ${passed} passed, ${failed} failed`)
if (failed) { console.log('FAILED:\n' + fails.map(f => '  ✗ ' + f).join('\n')); process.exit(1) }
