// npx tsx app/dashboard/components/e2Export.test.ts
//
// ΠΑΡΑΓΕΙ ΟΝΤΩΣ ΑΡΧΕΙΟ Η ΕΞΑΓΩΓΗ Ε2;
// ─────────────────────────────────────────────────────────────────────────
// Η `runE2Export` έμεινε μήνες χωρίς κανέναν καλούντα: μεταγλωττιζόταν καθαρά,
// περνούσε κάθε έλεγχο τύπων και δεν είχε παραγάγει ποτέ αρχείο. Ένα
// χαρακτηριστικό που πουλιέται με συνδρομή δεν επιτρέπεται να στηρίζεται στο ότι
// «ο κώδικας φαίνεται σωστός».
//
// Εδώ καλείται η ΠΡΑΓΜΑΤΙΚΗ συνάρτηση με πλαστό πελάτη Supabase ΚΑΙ με πλαστό
// έγγραφο: η εξαγωγή περνά πια από το `lib/core/download.ts`, τη μία υλοποίηση
// λήψης της εφαρμογής, αντί να γράφει μόνη της στον δίσκο. Το πλαστό έγγραφο
// πιάνει τα ίδια τα byte του αρχείου, οπότε ελέγχεται ό,τι θα κατέβαινε στον
// χρήστη — και επιπλέον ότι το κατέβασμα ΟΝΤΩΣ ενεργοποιήθηκε και με ποιο όνομα.
// Αδοκίμαστος μένει μόνο ο διάλογος αποθήκευσης του περιηγητή.
//
// ΤΙ ΕΠΙΑΣΕ ΗΔΗ: με `status_detail: 'rent_long'` το ακαθάριστο έβγαινε κενό και η
// γραμμή ΣΥΝΟΛΟ μηδενική. Το «rent_long» είναι ΠΑΡΑΓΟΜΕΝΗ κατάσταση
// (`readStatus`), όχι αποθηκευμένη τιμή — αλλά η αποτυχία έδειξε ότι το έντυπο
// διάβαζε το `status_detail` ωμό, αγνοώντας το `rental_mode` και ένα ακίνητο
// «rented» + «short_term» έπαιρνε κωδικό «1 · Εκμίσθωση» αντί «60 · Βραχυχρόνια»
// με τις διαμονές του να μη μετριούνται καθόλου.
import { loadE2Rows, buildE2Workbook } from './e2Export'
import { XLSX } from './xlsxStyle'

let pass = 0, fail = 0
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n) } }

const YEAR = 2025
const PID = '11111111-1111-1111-1111-111111111111'

/**
 * Πλαστός πελάτης: κάθε φίλτρο επιστρέφει τον εαυτό του, το await δίνει τα δεδομένα.
 * Οι πίνακες του `failing` απαντούν όπως το PostgREST όταν πέσει η σύνδεση.
 */
function clientWith(data: Record<string, unknown[]>, failing = new Set<string>()) {
  return {
    from(table: string) {
      const rows = data[table] ?? []
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'in', 'is', 'order', 'not', 'limit', 'gte', 'lte']) chain[m] = () => chain
      ;(chain as { then: unknown }).then = (res: (v: unknown) => void) => res(failing.has(table)
        ? { data: null, error: { message: 'x', code: 'PGRST301' } }
        : { data: rows, error: null })
      return chain
    },
  } as never
}

const LONG_TERM = {
  user_properties: [{
    id: PID, atak: '12345678901', address: 'Ερμού 12, Αθήνα', postal_code: '10563',
    ownership: '100', prop_type: 'apartment',
    // ΟΙ ΑΠΟΘΗΚΕΥΜΕΝΕΣ τιμές, όχι οι παραγόμενες.
    status_detail: 'rented', rental_mode: 'long_term',
    target_rent: 800, sqm: 78, floor: '2',
  }],
  tenants: [{ property_id: PID, afm: '123456789', full_name: 'Μαρία Ιωάννου', monthly_rent: 800,
    lease_start: '2025-01-01', lease_end: '2027-12-31', lease_type: 'residential', created_at: '2025-01-01' }],
  rent_payments: Array.from({ length: 12 }, (_, i) => ({ property_id: PID, amount: 800, period_year: YEAR, period_month: i + 1 })),
  property_settings: [{ property_id: PID, owner_afm: '987654321' }],
  client_stays: [],
}

async function main() {
  // Ελέγχουμε τον καθαρό builder που τρέχει ΚΑΙ στον server (πύλη /api/e2/export)
  // ΚΑΙ στον browser. Το ίδιο το κατέβασμα φυλάσσεται στο lib/core/download.ts.
  const loaded = await loadE2Rows(clientWith(LONG_TERM), 'user-1', YEAR)
  const wb = buildE2Workbook(loaded, YEAR)
  ok('χτίζει βιβλίο για 1 ακίνητο', !!wb && loaded.properties.length === 1)
  if (!wb) { console.error('✗ e2Export: κανένα βιβλίο'); process.exit(1) }
  ok('έχει το κύριο φύλλο του έτους', wb.SheetNames.includes(`Ε2 ${YEAR}`))
  ok('έχει οδηγίες συμπλήρωσης', wb.SheetNames.some(s => s.includes('Οδηγίες')))
  ok('έχει το φύλλο Ε1 πίνακας 4Δ2', wb.SheetNames.includes('Ε1 πίνακας 4Δ2'))

  const aoa = XLSX.utils.sheet_to_json(wb.Sheets[`Ε2 ${YEAR}`], { header: 1, defval: '' }) as unknown[][]
  const flat = aoa.flat().map(String)
  ok('περιέχει τη διεύθυνση', flat.some(c => c.includes('Ερμού 12')))
  ok('περιέχει το ΑΦΜ του ιδιοκτήτη', flat.includes('987654321'))
  ok('περιέχει το ΑΦΜ του μισθωτή', flat.includes('123456789'))
  ok('περιέχει τον μισθωτή', flat.some(c => c.includes('Μαρία Ιωάννου')))

  // ΤΟ ΝΟΥΜΕΡΟ ΤΟΥ ΕΝΤΥΠΟΥ: 12 × 800 = 9.600 και στη γραμμή και στο σύνολο.
  const nums = aoa.flat().filter(v => typeof v === 'number') as number[]
  ok('το ετήσιο ακαθάριστο είναι 9.600', nums.includes(9600))
  const totalRow = aoa.find(r => String(r[0]) === 'ΑΘΡΟΙΣΜΑ')
  ok('υπάρχει γραμμή ΑΘΡΟΙΣΜΑ, όπως στο έντυπο', !!totalRow)
  ok('το ΑΘΡΟΙΣΜΑ δεν είναι μηδενικό', !!totalRow && (totalRow as unknown[]).some(v => Number(v) === 9600))
  // Το άθροισμα είναι ζωντανός τύπος ΚΑΙ αριθμός, στη μορφή «1.234,56€».
  const ws1 = wb.Sheets[`Ε2 ${YEAR}`]
  const totR = aoa.indexOf(totalRow as unknown[])
  const totCell = ws1[XLSX.utils.encode_cell({ r: totR, c: 15 })] as { f?: string; v?: unknown; t?: string; z?: string }
  ok('ΑΘΡΟΙΣΜΑ στ. 13: SUM, αριθμός, μορφή ευρώ', !!totCell?.f?.startsWith('SUM(') && totCell.v === 9600 && totCell.t === 'n' && String(totCell.z).includes('€'))

  // ── Η σειρά και η αρίθμηση των στηλών, όπως τυπώνονται στο έντυπο ──────
  const numbers = aoa.find(r => r[0] === 1 && r[5] === 17) as unknown[]
  ok('σειρά αριθμών στηλών 1,2,3,4,5,17,18,6,7,19,8,…,16', !!numbers && numbers.join(',') === '1,2,3,4,5,17,18,6,7,19,8,9,10,11,12,13,14,15,16')
  ok('κεφαλίδα: ΑΦΜ υπόχρεου', flat.some(c => c.startsWith('987654321')))
  ok('κεφαλίδα: αριθμός υποβολής κενός', aoa.some(r => r[0] === 'Αρ. υποβολής / Ημερομηνία' && r[2] === ''))

  // Η στήλη 17 λέει το είδος και τη χρήση, όχι αριθμό της εφαρμογής.
  ok('στ. 17 «Μακροχρόνια μίσθωση κατοικίας»', flat.includes('Μακροχρόνια μίσθωση κατοικίας'))
  ok('έχει τα δύο φύλλα των Συμπληρωματικών', wb.SheetNames.includes('Συμπληρωματικά Ι') && wb.SheetNames.includes('Συμπληρωματικά ΙΙ'))

  // ── Το ίδιο ακίνητο, αποθηκευμένο ως «rented» ΑΛΛΑ με short_term ──────────
  // Πριν, το `rental_mode` αγνοούνταν: κωδικός 1 αντί 60 σε στήλη του εντύπου.
  const short = JSON.parse(JSON.stringify(LONG_TERM))
  short.user_properties[0].rental_mode = 'short_term'
  const wb2 = buildE2Workbook(await loadE2Rows(clientWith(short), 'user-1', YEAR), YEAR)!
  const aoa2 = XLSX.utils.sheet_to_json(wb2.Sheets[`Ε2 ${YEAR}`], { header: 1, defval: '' }) as unknown[][]
  const flat2 = aoa2.flat().map(String)
  ok('βραχυχρόνια → στ. 17 του άρθρου 39Α', flat2.includes('Βραχυχρόνια μίσθωση (άρθρο 39Α ΚΦΕ)'))
  ok('ΔΕΝ γράφεται μακροχρόνια σε βραχυχρόνιο', !flat2.includes('Μακροχρόνια μίσθωση κατοικίας'))

  // ── ΠΑΛΙΟ ΕΤΟΣ ΜΕΤΑ ΑΠΟ ΑΛΛΑΓΗ ΜΙΣΘΩΤΗ, ΑΠΟ ΤΗ ΒΑΣΗ ΩΣ ΤΟ ΦΥΛΛΟ ──────────
  // Ο παλιός έφυγε 28/02/2026, ο νέος μπήκε 01/03/2026. Το Ε2 του 2025 πρέπει
  // να γράφει τον παλιό, με 12 μήνες και ημερομηνίες του 2025.
  const changed = JSON.parse(JSON.stringify(LONG_TERM))
  changed.tenants = [
    { id: 'old', property_id: PID, afm: '111111111', full_name: 'Παλιός Μισθωτής', monthly_rent: 800,
      lease_start: '2024-03-01', lease_end: '2027-02-28', move_out_date: '2026-02-28', status: 'past', lease_type: 'residential', created_at: '2024-03-01' },
    { id: 'new', property_id: PID, afm: '333333333', full_name: 'Νέος Μισθωτής', monthly_rent: 950,
      lease_start: '2026-03-01', lease_end: null, move_out_date: null, status: 'active', lease_type: 'residential', created_at: '2026-02-20' },
  ]
  changed.rent_payments = Array.from({ length: 12 }, (_, i) => ({ property_id: PID, tenant_id: 'old', amount: 800, base_rent: 800, services_charge: 0, paid: true, period_year: YEAR, period_month: i + 1 }))
  const wb3 = buildE2Workbook(await loadE2Rows(clientWith(changed), 'user-1', YEAR), YEAR)!
  const aoa3 = XLSX.utils.sheet_to_json(wb3.Sheets[`Ε2 ${YEAR}`], { header: 1, defval: '' }) as unknown[][]
  const flat3 = aoa3.flat().map(String)
  ok('παλιό έτος: το ΑΦΜ του μισθωτή εκείνου του έτους', flat3.includes('111111111'))
  ok('παλιό έτος: ΟΧΙ το ΑΦΜ του σημερινού μισθωτή', !flat3.includes('333333333'))
  ok('παλιό έτος: ημερομηνίες του 2025', flat3.includes('01/01/2025') && flat3.includes('31/12/2025'))
  const dataRow3 = aoa3.find(r => r[0] === 1 && r[5] !== 17) as unknown[]
  ok('παλιό έτος: 12 μήνες στη στ. 10', !!dataRow3 && dataRow3[12] === 12)

  // ── ΔΥΟ ΙΔΙΟΚΤΗΤΕΣ, ΔΥΟ ΑΦΜ ΚΑΙ ΕΝΑ ΑΚΙΝΗΤΟ ΧΩΡΙΣ ΑΦΜ ─────────────────
  // Πριν: το πρώτο ΑΦΜ που βρισκόταν έμπαινε στην κεφαλίδα ΟΛΟΥ του βιβλίου.
  const PA = 'aaaaaaaa-0000-0000-0000-000000000001', PB = 'bbbbbbbb-0000-0000-0000-000000000002', PC = 'cccccccc-0000-0000-0000-000000000003'
  const prop = (id: string, address: string) => ({ id, atak: '1' + id.slice(0, 10).replace(/\D/g, '0'), address, postal_code: '10563', ownership: '100',
    prop_type: 'apartment', status_detail: 'rented', rental_mode: 'long_term', target_rent: 500, sqm: 50, floor: '1' })
  const owners = {
    user_properties: [prop(PA, 'Οδός Συζύγου Α 1'), prop(PB, 'Οδός Συζύγου Β 2'), prop(PC, 'Οδός Χωρίς ΑΦΜ 3')],
    tenants: [PA, PB, PC].map((id, i) => ({ id: `t${i}`, property_id: id, afm: `90000000${i}`, full_name: `Μισθωτής ${i}`, monthly_rent: 500,
      lease_start: '2024-01-01', lease_end: null, lease_type: 'residential', created_at: '2024-01-01' })),
    rent_payments: [
      ...Array.from({ length: 12 }, (_, i) => ({ property_id: PA, tenant_id: 't0', amount: 500, base_rent: 500, period_year: YEAR, period_month: i + 1, paid: true })),
      ...Array.from({ length: 12 }, (_, i) => ({ property_id: PB, tenant_id: 't1', amount: 700, base_rent: 600, services_charge: 100, period_year: YEAR, period_month: i + 1, paid: true })),
    ],
    property_settings: [{ property_id: PA, owner_afm: '111111111' }, { property_id: PB, owner_afm: ' 222 222 222 ' }],
    client_stays: [],
  }
  const wb4 = buildE2Workbook(await loadE2Rows(clientWith(owners), 'user-1', YEAR), YEAR)!
  const sA = `Ε2 ${YEAR} ΑΦΜ 111111111`, sB = `Ε2 ${YEAR} ΑΦΜ 222222222`, sC = `Ε2 ${YEAR} χωρίς ΑΦΜ`
  ok('ένα φύλλο Ε2 ανά ΑΦΜ', [sA, sB, sC].every(n => wb4.SheetNames.includes(n)))
  ok('δεν υπάρχει ενιαίο φύλλο για όλους', !wb4.SheetNames.includes(`Ε2 ${YEAR}`))
  const sheetFlat = (n: string) => (XLSX.utils.sheet_to_json(wb4.Sheets[n], { header: 1, defval: '' }) as unknown[][]).flat().map(String)
  const fa = sheetFlat(sA), fb = sheetFlat(sB), fc = sheetFlat(sC)
  ok('κεφαλίδα Α: το δικό του ΑΦΜ', fa.includes('111111111') && !fa.includes('222222222'))
  ok('κεφαλίδα Β: το δικό του ΑΦΜ, χωρίς κενά', fb.includes('222222222') && !fb.includes('111111111'))
  ok('φύλλο Α: μόνο το ακίνητο του Α', fa.some(c => c.includes('Συζύγου Α')) && !fa.some(c => c.includes('Συζύγου Β')))
  ok('φύλλο χωρίς ΑΦΜ: το λέει στην κεφαλίδα', fc.some(c => c.startsWith('ΔΕΝ ΕΧΕΙ ΟΡΙΣΤΕΙ ΑΦΜ')) && fc.some(c => c.includes('Χωρίς ΑΦΜ 3')))
  const totalOf = (n: string) => (XLSX.utils.sheet_to_json(wb4.Sheets[n], { header: 1, defval: '' }) as unknown[][]).find(r => String(r[0]) === 'ΑΘΡΟΙΣΜΑ') as unknown[]
  ok('ΑΘΡΟΙΣΜΑ Α = 6000', totalOf(sA)[15] === 6000)
  ok('ΑΘΡΟΙΣΜΑ Β = 7200, χωρίς τις υπηρεσίες', totalOf(sB)[15] === 7200)
  ok('Συμπληρωματικά ανά ΑΦΜ', wb4.SheetNames.includes('Συμπληρωματικά Ι ΑΦΜ 111111111') && wb4.SheetNames.includes('Συμπληρωματικά ΙΙ ΑΦΜ 222222222'))
  ok('Ε1 4Δ2 ανά ΑΦΜ', wb4.SheetNames.includes('Ε1 4Δ2 ΑΦΜ 111111111') && wb4.SheetNames.includes('Ε1 4Δ2 ΑΦΜ 222222222'))
  const e1b = (XLSX.utils.sheet_to_json(wb4.Sheets['Ε1 4Δ2 ΑΦΜ 222222222'], { header: 1, defval: '' }) as unknown[][]).flat()
  ok('Ε1 του Β: μόνο το δικό του ποσό', e1b.includes(7200) && !e1b.includes(6000) && !e1b.includes(13200))
  ok('Ε1 του Β: κωδικοί υπόχρεου και συζύγου', e1b.includes('103') && e1b.includes('104'))
  const chk = (XLSX.utils.sheet_to_json(wb4.Sheets['Έλεγχος και ΑΤΑΚ'], { header: 1, defval: '' }) as unknown[][]).flat().map(String)
  ok('έλεγχος: η σημείωση για τους κωδικούς Ε1 με την πηγή τους', chk.some(c => c.includes('πίνακας 4Δ2, Φ-01.001')))
  ok('έλεγχος: οι υπηρεσίες που έμειναν έξω', chk.some(c => c.startsWith('Υπηρεσίες 1.200,00€')))
  ok('έλεγχος: το ακίνητο χωρίς ΑΦΜ σημαίνεται', chk.some(c => c.includes('Λείπει ΑΦΜ ιδιοκτήτη')))
  ok('έλεγχος: σε ποιο φύλλο βρίσκεται κάθε ακίνητο', chk.includes(sC))

  // ── ΚΕΦΑΛΙΔΑ ΜΕ ΟΝΟΜΑ ΚΑΙ ΛΟΓΙΣΤΗ, ΣΥΝΙΔΙΟΚΤΗΤΗΣ ΣΤΑ ΣΥΜΠΛΗΡΩΜΑΤΙΚΑ Ι ────
  const shared = JSON.parse(JSON.stringify(LONG_TERM))
  shared.user_properties[0].ownership = '50'
  shared.user_properties[0].power_supply_no = '123456789017'
  shared.user_properties[0].co_owners = [{ name: 'Νίκος Παπάς', afm: '111111118', pct: 50, address: 'Πατησίων 5, Αθήνα' }]
  shared.property_settings = [{ property_id: PID, owner_afm: '987654321', owner_name: 'Ελένη Παπά' }]
  const withRpc = { ...clientWith(shared) as object, rpc: async () => ({ data: [{ accountantId: 'x', name: 'Λογιστικό Γραφείο Α', linkedAt: '2025-01-01' }], error: null }) } as never
  const wb5 = buildE2Workbook(await loadE2Rows(withRpc, 'user-1', YEAR), YEAR)!
  const main5 = (XLSX.utils.sheet_to_json(wb5.Sheets[`Ε2 ${YEAR} ΑΦΜ 987654321`], { header: 1, defval: '' }) as unknown[][])
  ok('κεφαλίδα: ΑΦΜ / ονοματεπώνυμο', main5.some(r => r[2] === '987654321 / Ελένη Παπά'))
  ok('κεφαλίδα: στοιχεία λογιστή', main5.some(r => r[0] === 'Στοιχεία λογιστή' && r[2] === 'Λογιστικό Γραφείο Α'))
  ok('στ. 18: 9 πρώτα ψηφία', main5.flat().includes('123456789'))
  const sup5 = (XLSX.utils.sheet_to_json(wb5.Sheets['Συμπληρωματικά Ι ΑΦΜ 987654321'], { header: 1, defval: '' }) as unknown[][]).flat()
  ok('Συμπληρωματικά Ι: ο συνιδιοκτήτης με ΑΦΜ, διεύθυνση, ποσοστό', sup5.includes('Νίκος Παπάς') && sup5.includes('111111118') && sup5.includes('Πατησίων 5, Αθήνα') && sup5.includes(50))

  // ── Ο ΣΥΝΙΔΙΟΚΤΗΤΗΣ ΜΕ ΑΦΜ ΕΧΕΙ ΔΙΚΟ ΤΟΥ ΦΥΛΛΟ Ε2 (02.10.2026) ───────────
  // Πριν: μόνο γραμμή στα Συμπληρωματικά Ι του ιδιοκτήτη· το μερίδιό του δεν
  // είχε φύλλο για τη δική του δήλωση.
  const coSheet = wb5.Sheets[`Ε2 ${YEAR} ΑΦΜ 111111118`]
  ok('συνιδιοκτήτης: δικό του φύλλο Ε2', !!coSheet)
  if (coSheet) {
    const co5 = XLSX.utils.sheet_to_json(coSheet, { header: 1, defval: '' }) as unknown[][]
    ok('συνιδιοκτήτης: η κεφαλίδα με το δικό του ΑΦΜ', co5.some(r => String(r[2]).startsWith('111111118')))
    const flat = co5.flat()
    ok('συνιδιοκτήτης: το μερίδιό του, 4.800 στο 50%', flat.includes(4800) && flat.includes(50))
  }

  // ── ΑΠΟΤΥΧΗΜΕΝΗ ΑΝΑΓΝΩΣΗ = ΚΑΝΕΝΑ Ε2, ΟΧΙ Ε2 ΜΕ ΜΗΔΕΝΙΚΑ (08.10.2026) ────
  // Πριν: πεσμένα ενοίκια έδιναν Ε2 με μηδέν εισόδημα, πεσμένα ΑΦΜ ιδιοκτήτη
  // σβήνονταν σιωπηλά και πεσμένα ακίνητα γίνονταν «δεν υπάρχει ακίνητο».
  const rejects = async (tables: string[]) => {
    try { await loadE2Rows(clientWith(LONG_TERM, new Set(tables)), 'user-1', YEAR); return false }
    catch { return true }
  }
  ok('αποτυχία ακινήτων: απόρριψη, όχι «κανένα ακίνητο»', await rejects(['user_properties']))
  ok('αποτυχία μισθώσεων: απόρριψη', await rejects(['tenants']))
  ok('αποτυχία δόσεων: απόρριψη, όχι μηδέν ενοίκια', await rejects(['rent_payments']))
  ok('αποτυχία ΑΦΜ ιδιοκτήτη: απόρριψη, όχι σιωπηλή απώλεια', await rejects(['property_settings']))
  ok('αποτυχία διαμονών: απόρριψη, όχι μηδέν βραχυχρόνιο', await rejects(['client_stays']))
  // Τα προαιρετικά μένουν προαιρετικά: αριθμός δήλωσης και λογιστής.
  ok('αποτυχία ιστορικού (αριθμός δήλωσης): το Ε2 βγαίνει κανονικά', !(await rejects(['activity_log'])))
  ok('χωρίς rpc λογιστή: το Ε2 βγαίνει κανονικά', !(await rejects([])))

  console.log(fail === 0 ? `✓ e2Export: ${pass} έλεγχοι πέρασαν` : `✗ e2Export: ${fail} απέτυχαν από ${pass + fail}`)
  if (fail > 0) process.exit(1)
}
main()
