// ═══════════════════════════════════════════════════════════════════════════
// ΤΙ ΓΡΑΦΕΤΑΙ ΣΤΗ ΒΑΣΗ ΟΤΑΝ ΑΠΟΘΗΚΕΥΕΤΑΙ ΕΝΑ ΑΝΤΙΚΕΙΜΕΝΟ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΦΟΡΤΙΟ ΗΤΑΝ ΓΡΑΜΜΕΝΟ ΜΕΣΑ ΣΤΗΝ ΟΘΟΝΗ ΚΑΙ ΕΙΧΕ ΜΕΙΝΕΙ ΠΙΣΩ ΑΠΟ ΤΗ ΦΟΡΜΑ.
// Η φόρμα ρωτά «Πώς μετριέται» και, ανάλογα, kWh ανά 100 κύκλους, κύκλους τον
// μήνα ή kWh τον χρόνο· το μητρώο EPREL τα συμπληρώνει μόνο του. Η γραμμή που
// έφτιαχνε την εγγραφή όμως είχε γραφτεί πριν από τους τρεις τρόπους και ήξερε
// μόνο Watt και ώρες. Ο χρήστης έγραφε 52 kWh/100 κύκλους, πατούσε
// «Αποθήκευση» και το αντικείμενο ερχόταν πίσω χωρίς κατανάλωση — κανένα
// σφάλμα, απλώς τα πεδία δεν είχαν σταλεί ποτέ.
//
// Καθαρή συνάρτηση, σε δικό της αρχείο, ώστε ο έλεγχος να τη διαβάζει χωρίς
// να φορτώσει την οθόνη.
// ═══════════════════════════════════════════════════════════════════════════
import type { InventoryItem } from './model'

const ENERGY_MODES = ['cycles', 'annual', 'hours'] as const

/** Αριθμός ή μηδέν: ποτέ NaN, ποτέ αρνητικό, ποτέ κείμενο προς τη στήλη numeric. */
const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''))
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * Η εγγραφή για εισαγωγή ή ενημέρωση. Γράφονται ΜΟΝΟ τα πεδία που ζητάει πλέον
 * η φόρμα· οι παλιές στήλες (provenance, discount_pct, smart_device,
 * standby_watts…) δεν αγγίζονται, ώστε τα παλιά δεδομένα να μένουν ακέραια.
 *
 * Το `name` και η `category` είναι NOT NULL χωρίς προεπιλογή στη βάση: δεν
 * φεύγουν ποτέ κενά ή null.
 */
export function itemPayload(data: Partial<InventoryItem>) {
  const mode = ENERGY_MODES.includes(data.energy_mode as typeof ENERGY_MODES[number]) ? data.energy_mode! : null
  return {
    name: (data.name || '').trim(),
    category: data.category || 'Λοιπά',
    room: data.room || '',
    brand: data.brand || '',
    model: data.model || '',
    serial_number: data.serial_number || '',
    condition: data.condition || 'Καλή',
    notes: data.notes || '',
    photo_url: data.photo_url || '',
    photos: data.photos || [],
    purchase_value: num(data.purchase_value),
    purchase_date: data.purchase_date || null,
    warranty_expiry: data.warranty_expiry || null,
    energy_class: data.energy_class || '',
    energy_mode: mode,
    power_watts: num(data.power_watts),
    daily_hours_use: num(data.daily_hours_use),
    kwh_per_100_cycles: num(data.kwh_per_100_cycles),
    cycles_per_month: num(data.cycles_per_month),
    annual_kwh: num(data.annual_kwh),
    replacement_cost: num(data.replacement_cost),
    receipt_doc_url: data.receipt_doc_url || null,
    receipt_doc_name: data.receipt_doc_name || null,
  }
}
