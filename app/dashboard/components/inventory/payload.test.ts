// ═══════════════════════════════════════════════════════════════════════════
// Η ΧΕΙΡΟΚΙΝΗΤΗ ΚΑΤΑΧΩΡΗΣΗ ΑΝΤΙΚΕΙΜΕΝΟΥ, ΑΠΟ ΤΗ ΦΟΡΜΑ ΩΣ ΤΗΝ ΕΓΓΡΑΦΗ
// ─────────────────────────────────────────────────────────────────────────
// Δύο σπασίματα που δεν άφηναν ίχνος στη βάση (21/10/2026):
//   1. σε ακίνητο που δεν μισθώνεται η φόρμα άνοιγε χωρίς ούτε ένα πεδίο· η
//      «Αποθήκευση» απαντούσε «Το όνομα είναι υποχρεωτικό»·
//   2. η κατανάλωση σε κύκλους ή kWh τον χρόνο δεν στελνόταν ποτέ.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { formFields, INVENTORY_FIELDS, inventoryFormContext, type FieldContext } from '@/lib/property/fields'
import type { PropertyStatus } from '@/lib/property/status'
import { itemPayload } from './payload'

let passed = 0, failed = 0
function ok(name: string, cond: boolean) { if (cond) { passed++ } else { failed++; console.log('  ✗ ' + name) } }

// ── 1. Η φόρμα έχει πεδία σε ΚΑΘΕ κατάσταση ακινήτου ─────────────────────
const statuses: PropertyStatus[] = ['rent_long', 'rent_short', 'vacant', 'own_use', 'renovation', 'for_sale', 'disputed']
for (const status of statuses) {
  for (const furnished of [false, true]) {
    const tab: FieldContext = { status, business: false, doubleEntry: false, propertyCount: 1, furnished }
    const form = formFields(INVENTORY_FIELDS, inventoryFormContext(tab))
    const core = form.core.map(d => d.id)
    for (const id of ['inv.name', 'inv.category', 'inv.condition', 'inv.room', 'inv.value']) {
      ok(`${status}/${furnished ? 'επιπλωμένο' : 'γυμνό'}: η φόρμα δείχνει ${id}`, core.includes(id))
    }
    ok(`${status}: τα «Περισσότερα» υπάρχουν (κατανάλωση, σημείωση)`,
      form.more.some(d => d.id === 'inv.power_use') && form.more.some(d => d.id === 'inv.notes'))
  }
}
// Η καρτέλα κρατά το δικό της περιβάλλον: η μίσθωση του χρήστη δεν αλλάζει.
ok('βραχυχρόνια μένει βραχυχρόνια στη φόρμα',
  inventoryFormContext({ status: 'rent_short', business: false, doubleEntry: false, propertyCount: 1 }).status === 'rent_short')

// Η οθόνη ΠΡΕΠΕΙ να περνά το περιβάλλον της φόρμας, όχι το δικό της.
const tabSrc = readFileSync(join(process.cwd(), 'app/dashboard/components/TabInventory.tsx'), 'utf8')
ok('η TabInventory φτιάχνει το formCtx με inventoryFormContext', /const formCtx[^=]*=\s*inventoryFormContext\(/.test(tabSrc))
ok('η TabInventory γράφει με itemPayload', /itemPayload\(data\)/.test(tabSrc))

// ── 2. Το φορτίο κρατά ό,τι γράφει η φόρμα ───────────────────────────────
const washer = itemPayload({
  name: '  Πλυντήριο Bosch  ', category: 'Ηλεκτρικές Συσκευές',
  energy_mode: 'cycles', kwh_per_100_cycles: 52, cycles_per_month: 12,
})
ok('κύκλοι: ο τρόπος γράφεται', washer.energy_mode === 'cycles')
ok('κύκλοι: τα kWh/100 γράφονται', washer.kwh_per_100_cycles === 52)
ok('κύκλοι: οι κύκλοι τον μήνα γράφονται', washer.cycles_per_month === 12)
ok('το όνομα καθαρίζεται από κενά', washer.name === 'Πλυντήριο Bosch')

const fridge = itemPayload({ name: 'Ψυγείο', category: 'Ηλεκτρικές Συσκευές', energy_mode: 'annual', annual_kwh: 180.5 })
ok('ετήσια: τα kWh/έτος γράφονται', fridge.annual_kwh === 180.5 && fridge.energy_mode === 'annual')

const sofa = itemPayload({ name: 'Καναπές' })
ok('χωρίς κατηγορία: «Λοιπά», ποτέ κενό (NOT NULL)', sofa.category === 'Λοιπά')
ok('χωρίς τρόπο: null, που δέχεται ο έλεγχος της βάσης', sofa.energy_mode === null)
ok('κενές ημερομηνίες: null, όχι κενό κείμενο σε στήλη date', sofa.purchase_date === null && sofa.warranty_expiry === null)
ok('αριθμοί χωρίς τιμή: 0, όχι NaN', [sofa.purchase_value, sofa.power_watts, sofa.annual_kwh].every(n => n === 0))

ok('άγνωστος τρόπος δεν φτάνει στη βάση', itemPayload({ name: 'x', energy_mode: 'weekly' as never }).energy_mode === null)

console.log(`inventory/payload: ${passed} ✓ · ${failed} ✗`)
if (failed) process.exit(1)
