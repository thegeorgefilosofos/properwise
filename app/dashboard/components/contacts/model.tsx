'use client'
// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΜΟΝΤΕΛΟ ΤΩΝ ΕΠΑΦΩΝ: ΤΥΠΟΙ, ΟΜΑΔΕΣ ΡΟΛΩΝ, ΣΗΜΕΙΩΣΕΙΣ, ΗΜΕΡΟΜΗΝΙΕΣ
// ─────────────────────────────────────────────────────────────────────────
// Τι είναι μια επαφή, οι ομάδες και οι ρόλοι της, πώς διαβάζονται και
// γράφονται τα επιπλέον πεδία της μέσα στις σημειώσεις, η κενή φόρμα και
// τα παραστατικά του προμηθευτή. Τα διαβάζουν όλα τα κομμάτια των επαφών.
// ═══════════════════════════════════════════════════════════════════════════
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
// Οι επαφές έχουν ένα σπίτι: lib/data/contacts.
import * as contactStore from '@/lib/data/contacts'
import {
  Users, Building2, Wrench, Trees, UserCheck, Zap, Wifi, Landmark, Briefcase, Shield,
} from 'lucide-react'
import { localDay } from '@/components/Theme'
import type { ContactFile } from '@/lib/storage/contactFiles'
import { daysUntilOrNull } from '@/lib/core/time'
// Το Αρχείο έχει ένα σπίτι: lib/data/documents.
import * as documents from '@/lib/data/documents'

export const supabase = createSupabaseClient()

// ═══════════════════════════════════════════════════════════════════════════
// ΤΙ ΑΛΛΑΞΕ ΣΕ ΑΥΤΗ ΤΗΝ ΟΘΟΝΗ ΚΑΙ ΓΙΑΤΙ
//
// 1. ΑΠΟΡΡΗΤΟ. Το πεδίο διεύθυνσης έστελνε ΚΑΘΕ ΠΛΗΚΤΡΟΛΟΓΗΣΗ στο
//    nominatim.openstreetmap.org (debounce 450ms, κάθε είσοδος ≥4 χαρακτήρων).
//    Έφευγαν διευθύνσεις γραφείων ΤΡΙΤΩΝ ΠΡΟΣΩΠΩΝ εκτός της υποδομής μας, χωρίς
//    αναφορά στην Πολιτική απορρήτου, ενώ η ίδια εφαρμογή υπόσχεται στον χρήστη ότι
//    ξέρει ποιος βλέπει τα δεδομένα του. Επιπλέον η πολιτική του Nominatim
//    ΑΠΑΓΟΡΕΥΕΙ autocomplete και απαιτεί δικό User-Agent: σε παραγωγή θα
//    μπλοκαριζόταν σιωπηλά. → Απλό πεδίο κειμένου. Ο χάρτης δεν φορτώνεται πια
//    μόνος του σε iframe (που στέλνει τη διεύθυνση στην Google με το που ανοίγει το
//    ντοσιέ) αλλά ανοίγει με ΡΗΤΟ κλικ του χρήστη.
//
// 2. Η ΣΑΡΩΣΗ ΕΞΑΦΑΝΙΖΟΤΑΝ ΑΚΡΙΒΩΣ ΟΤΑΝ ΧΡΕΙΑΖΟΤΑΝ. Όλα τα κουμπιά της κεφαλίδας,
//    μαζί με το «Σάρωσε κάρτα», αποδίδονταν μόνο αν υπήρχε ΗΔΗ επαφή. Ο νέος
//    χρήστης δεν έβλεπε καθόλου τη σάρωση και ο μόνος δρόμος για την πρώτη επαφή
//    ήταν η φόρμα των 20 πεδίων. → «Φωτογράφισε κάρτα ή τιμολόγιο» ως κύριο CTA,
//    πάντα ορατό και στην κενή κατάσταση.
//
// 3. Ο ΚΥΚΛΟΣ ΠΑΡΑΣΤΑΤΙΚΟ ↔ ΕΠΑΦΗ ΗΤΑΝ ΣΠΑΣΜΕΝΟΣ. Οι δαπάνες ταίριαζαν με
//    `description.ilike.*όνομα*`: ο «Παπαδόπουλος Υδραυλικός» δεν έβρισκε τη δαπάνη
//    «Συντήρηση — Παπαδόπουλος». Το ΑΦΜ αποθηκευόταν, υπάρχει και στα σαρωμένα
//    έγγραφα και ποτέ δεν συνέδεε τα δύο. → Ταίριασμα με ΑΦΜ (contacts.afm ↔
//    property_documents.provider_afm) και «όλα τα παραστατικά αυτού του παρόχου».
//
// 4. ΕΞΙ ΠΕΔΙΑ ΧΩΡΙΣ ΚΑΜΙΑ ΕΝΕΡΓΕΙΑ έφυγαν (αριθμός μητρώου/άδειας, δεύτερος IBAN,
//    ωράριο, τελευταία επαφή, αξιολόγηση με αστέρια, «κατάσταση σχέσης» που κόλλαγε
//    την ετικέτα «Προβληματικός» πάνω σε όνομα ανθρώπου), μαζί με την «Υπενθύμιση
//    επικοινωνίας» που υποσχόταν ρυθμό και έδινε μία παγωμένη ημερομηνία και τις
//    δύο διαδρομές εισαγωγής αρχείου (.vcf/.csv) που η φωτογράφιση καλύπτει.
//    Ποια πεδία μένουν το ορίζει το lib/property/fields.ts (CONTACT_FIELDS).
// ═══════════════════════════════════════════════════════════════════════════

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ContactExtra {
  phone2?: string; whatsapp?: boolean; viber?: boolean; website?: string
  office_address?: string; afm?: string
  iban?: string; iris?: boolean
  preferred?: boolean
  next_appointment?: string; specialty?: string
  tags?: string[]; avatar_url?: string
  notes_log?: { id: string; text: string; ts: string }[]
  files?: ContactFile[]
  // ΠΑΛΙΑ ΠΕΔΙΑ, ΔΕΝ ΓΡΑΦΟΝΤΑΙ ΠΙΑ. Παραμένουν στον τύπο επειδή ζουν μέσα στο JSON
  // του `notes` παλιών επαφών — δεν σβήνουμε δεδομένα χρήστη, απλώς δεν τα ζητάμε
  // και δεν τα δείχνουμε: κανένα δεν προκαλούσε καμία ενέργεια στο app.
  license_number?: string; iban2?: string; schedule?: string
  rating?: number; last_contact?: string
  reminder_days?: number; reminder_set?: string
  status?: 'active' | 'pending' | 'inactive' | 'problematic'
  // Πεδίο εμβέλειας (μόνο για επαγγελματικό προφίλ). Αποθηκεύεται εντός του JSON `notes`
  // αφού δεν υπάρχει διαθέσιμη ειδική στήλη — βλ. σημείωση στην αναφορά.
  scope?: 'property' | 'portfolio'; scope_property_id?: string
  // Ο φάκελος του `notes` είναι ελεύθερος: τα δηλωμένα πεδία είναι όσα ΔΙΑΒΑΖΕΙ
  // η οθόνη, όχι όσα υπάρχουν. Παλιές επαφές κουβαλούν και άλλα.
  [key: string]: unknown
}
export interface Contact {
  id: string; property_id: string; user_id: string; role: string; full_name: string
  phone: string | null; email: string | null; notes: string | null; created_at?: string
  _extra?: ContactExtra; _freeNotes?: string
}
export interface TabContactsProps {
  propertyId: string; userId: string; embedded?: boolean
  profileType?: 'individual' | 'professional'
  properties?: { id: string; name: string }[]
}
export type SortMode = 'recent' | 'alpha'
export type ViewMode = 'cards' | 'compact'

// ─── ROLE GROUPS, Πλήρης Ελληνική Λίστα ─────────────────────────────────────
export const GROUPS = [
  // ΟΙ ΣΥΜΒΟΥΛΟΙ ΔΕΝ ΕΙΝΑΙ ΔΗΜΟΣΙΑ ΑΡΧΗ. Λογιστής, δικηγόρος και
  // συμβολαιογράφος κάθονταν κάτω από τις «Δημόσιες αρχές», δίπλα στη ΔΟΥ: η
  // λίστα έλεγε ότι ο λογιστής σου είναι υπηρεσία του κράτους. Οι τιμές
  // (`value`) μένουν ίδιες, οπότε καμία αποθηκευμένη επαφή δεν αλλάζει.
  {
    id: 'advisors', label: 'Σύμβουλοι', color: 'var(--accent)', Icon: Briefcase,
    roles: [
      { value: 'accountant', label: 'Λογιστής' },
      { value: 'lawyer', label: 'Δικηγόρος' },
      { value: 'notary', label: 'Συμβολαιογράφος' },
    ],
  },
  {
    id: 'authorities', label: 'Δημόσιες υπηρεσίες', color: 'var(--accent)', Icon: Building2,
    roles: [
      { value: 'doy', label: 'ΔΟΥ' },
      { value: 'ktimatologio', label: 'Κτηματολόγιο' },
      { value: 'dimos', label: 'Δήμος / Πολεοδομία' },
      { value: 'efka', label: 'ΕΦΚΑ' },
      { value: 'fire_dept', label: 'Πυροσβεστική' },
    ],
  },
  // ΝΕΡΟ ΚΑΙ ΔΙΚΤΥΟ ΔΕΝ ΕΙΝΑΙ «ΠΑΡΟΧΟΙ ΡΕΥΜΑΤΟΣ». Η ΕΥΔΑΠ και ο ΔΕΔΔΗΕ ήταν
  // μέσα σε ομάδα με αυτό το όνομα. Η ομάδα λέγεται πλέον όπως είναι· τα
  // `elec_*` μένουν ως τιμές για συμβατότητα με όσα έχουν αποθηκευτεί.
  {
    id: 'electricity', label: 'Ενέργεια και νερό', color: 'var(--accent)', Icon: Zap,
    roles: [
      { value: 'elec_dei', label: 'ΔΕΗ' },
      { value: 'elec_protergia', label: 'Protergia (Metlen)' },
      { value: 'elec_heron', label: 'Ήρων (Heron)' },
      { value: 'elec_elpedison', label: 'Elpedison' },
      { value: 'elec_nrg', label: 'NRG' },
      { value: 'elec_zenith', label: 'Zenith' },
      { value: 'elec_fysiko', label: 'Φυσικό αέριο Ελλάδος' },
      { value: 'elec_volterra', label: 'Volterra' },
      { value: 'elec_volton', label: 'Volton' },
      { value: 'elec_elin', label: 'Elin' },
      { value: 'elec_we', label: 'We Energy' },
      { value: 'elec_watt_volt', label: 'Watt+Volt' },
      { value: 'elec_eydap', label: 'ΕΥΔΑΠ (νερό)' },
      { value: 'elec_deddie', label: 'ΔΕΔΔΗΕ (δίκτυο)' },
      { value: 'elec_other', label: 'Άλλος πάροχος ρεύματος' },
    ],
  },
  {
    id: 'telecom', label: 'Τηλεφωνία και internet', color: 'var(--accent)', Icon: Wifi,
    roles: [
      { value: 'tel_ote', label: 'Telekom (πρώην Cosmote)' },
      { value: 'tel_vodafone', label: 'Vodafone' },
      { value: 'tel_nova', label: 'Nova' },
      { value: 'tel_inalan', label: 'Inalan' },
      { value: 'tel_other', label: 'Άλλος πάροχος internet / τηλεφωνίας' },
    ],
  },
  {
    id: 'banks', label: 'Τράπεζες και χρηματοδότηση', color: 'var(--accent)', Icon: Landmark,
    roles: [
      { value: 'bank_alpha', label: 'Alpha Bank' },
      { value: 'bank_eurobank', label: 'Eurobank' },
      { value: 'bank_piraeus', label: 'Τράπεζα Πειραιώς' },
      { value: 'bank_nbg', label: 'Εθνική Τράπεζα (ΕΤΕ)' },
      // Η Attica απορροφήθηκε από την CrediaBank. Η τιμή μένει για τις επαφές
      // που την έχουν ήδη· η ετικέτα λέει πού ανήκει σήμερα.
      { value: 'bank_attica', label: 'Attica Bank (πλέον CrediaBank)' },
      { value: 'bank_optima', label: 'Optima Bank' },
      { value: 'bank_credia', label: 'Credia Bank (πρώην Παγκρήτια)' },
      { value: 'bank_aegean', label: 'Aegean Baltic Bank' },
      { value: 'bank_revolut', label: 'Revolut' },
      { value: 'bank_ing', label: 'ING' },
      { value: 'bank_other', label: 'Άλλη τράπεζα / χρηματοδότης' },
    ],
  },
  {
    id: 'insurance', label: 'Ασφαλιστικές εταιρείες', color: 'var(--accent)', Icon: Shield,
    roles: [
      { value: 'ins_ethiniki', label: 'Εθνική Ασφαλιστική' },
      { value: 'ins_interamerican', label: 'Interamerican' },
      { value: 'ins_eurolife', label: 'Eurolife FFH' },
      { value: 'ins_allianz', label: 'Allianz Ελλάδα' },
      { value: 'ins_generali', label: 'Generali Ελλάδα' },
      { value: 'ins_ergo', label: 'ERGO Ασφαλιστική' },
      { value: 'ins_groupama', label: 'Groupama Ασφαλιστική' },
      { value: 'ins_nn', label: 'NN Hellas' },
      { value: 'ins_ydrogios', label: 'Υδρόγειος Ασφαλιστική' },
      { value: 'ins_interlife', label: 'Interlife' },
      { value: 'ins_agent', label: 'Ασφαλιστικός σύμβουλος / πράκτορας' },
      { value: 'ins_other', label: 'Άλλη ασφαλιστική εταιρεία' },
    ],
  },
  {
    id: 'real_estate', label: 'Μεσιτεία και αξιολόγηση', color: 'var(--accent)', Icon: Building2,
    roles: [
      { value: 'agent', label: 'Μεσίτης ακινήτων' },
      { value: 'appraiser', label: 'Εκτιμητής ακινήτων' },
      { value: 'prop_mgmt', label: 'Εταιρεία διαχείρισης' },
      { value: 'manager', label: 'Διαχειριστής πολυκατοικίας' },
      { value: 'concierge', label: 'Θυρωρός / Concierge' },
    ],
  },
  {
    id: 'technical', label: 'Τεχνικοί και μάστορες', color: 'var(--accent)', Icon: Wrench,
    roles: [
      { value: 'plumber', label: 'Υδραυλικός' },
      { value: 'electrician', label: 'Ηλεκτρολόγος' },
      { value: 'hvac', label: 'Ψυκτικός / Κλιματισμός' },
      { value: 'carpenter', label: 'Μαραγκός / Ξυλουργός' },
      { value: 'painter', label: 'Ελαιοχρωματιστής' },
      { value: 'tiles', label: 'Πλακάδες / Μαρμαράς' },
      { value: 'aluminum', label: 'Αλουμινάς / Κουφώματα' },
      { value: 'locksmith', label: 'Κλειδαράς' },
      { value: 'welder', label: 'Σιδεράς / Συγκολλητής' },
      { value: 'elevator', label: 'Ανελκυστήρας' },
      { value: 'solar', label: 'Ηλιακά / Φωτοβολταϊκά' },
      { value: 'insulation', label: 'Μονώσεις' },
      { value: 'roofing', label: 'Στέγη / Επιστεγάσεις' },
      { value: 'alarm', label: 'Συναγερμός / CCTV' },
      { value: 'network', label: 'Δίκτυα / Τηλεφωνία' },
      { value: 'general_tech', label: 'Γενικός τεχνίτης' },
    ],
  },
  {
    id: 'outdoor', label: 'Εξωτερικοί χώροι και υπηρεσίες', color: 'var(--accent)', Icon: Trees,
    roles: [
      { value: 'gardener', label: 'Κηπουρός' },
      { value: 'pool', label: 'Συντηρητής πισίνας' },
      { value: 'pest', label: 'Απεντόμωση / Μυοκτονία' },
      { value: 'cleaning', label: 'Καθαρισμός' },
      { value: 'cleaning_ext', label: 'Καθαρισμός εξωτερικών χώρων' },
      { value: 'security', label: 'Ασφάλεια / Φύλαξη' },
    ],
  },
  {
    id: 'tenants', label: 'Ενοικιαστές και γείτονες', color: 'var(--accent)', Icon: UserCheck,
    roles: [
      { value: 'tenant', label: 'Ενοικιαστής' },
      { value: 'prev_tenant', label: 'Πρώην ενοικιαστής' },
      { value: 'neighbor', label: 'Γείτονας' },
    ],
  },
  {
    id: 'others', label: 'Άλλοι', color: 'var(--accent)', Icon: Users,
    roles: [
      { value: 'other', label: 'Άλλο' },
    ],
  },
]

const ALL_ROLES = GROUPS.flatMap(g => g.roles.map(r => ({ ...r, groupId: g.id, groupColor: g.color, groupLabel: g.label, GroupIcon: g.Icon })))
export const ROLE_META: Record<string, typeof ALL_ROLES[0]> = Object.fromEntries(ALL_ROLES.map(r => [r.value, r]))
/**
 * Ο ρόλος μιας επαφής, με ΕΝΑΝ κανόνα για ετικέτες, φίλτρο, μετρητές και ενότητες.
 *
 * ΟΙ ΑΓΝΩΣΤΟΙ ΡΟΛΟΙ ΜΕΤΡΙΟΝΤΑΝ ΑΛΛΟΥ ΑΠΟ ΟΠΟΥ ΕΜΦΑΝΙΖΟΝΤΑΝ. Οι ενότητες τους
 * έριχναν στους «Ενοικιαστές», ενώ η ετικέτα της ομάδας και το φίλτρο τους
 * άφηναν απέξω: «Ενοικιαστές και γείτονες 1» πάνω από τρεις κάρτες. Και η
 * ετικέτα τους ήταν το ίδιο το κλειδί («cleaner»). Τώρα πάνε όλοι στους
 * «Άλλους». Το ελεύθερο κείμενο που γράφει ο χρήστης στο «Άλλο» μένει ως έχει·
 * κλειδί με λατινικά πεζά δεν είναι κείμενο χρήστη, οπότε λέγεται «Άλλο».
 */
export const roleMeta = (role: string): typeof ALL_ROLES[0] => {
  const known = ROLE_META[role]
  if (known) return known
  return { ...ROLE_META.other, label: role && !/^[a-z0-9_]+$/.test(role) ? role : ROLE_META.other.label }
}
export const ROLE_SELECT_OPTIONS = GROUPS.flatMap(g => [
  { value: `__group_${g.id}`, label: `── ${g.label} ──`, disabled: true },
  ...g.roles.map(r => ({ value: r.value, label: r.label, disabled: false })),
])

// Οι έτοιμες ετικέτες έφυγαν. Ήταν «VIP», «Ακριβός», «Προσοχή», «Προβληματικός»:
// χαρακτηρισμοί ΠΡΟΣΩΠΩΝ που τους πρότεινε το ίδιο το app, δίπλα σε ονοματεπώνυμο
// και ΑΦΜ. Οι ετικέτες μένουν ως ελεύθερο κείμενο — τις γράφει ο χρήστης, για να
// φιλτράρει τη δική του λίστα και κανείς δεν του υποβάλλει κρίση για τρίτον.

// ─── Serialize / Parse ────────────────────────────────────────────────────────
export function parseContact(c: Contact): Contact {
  let extra: ContactExtra = {}; let freeNotes = c.notes || ''
  const decoded = contactStore.decodeNotes(c.notes)
  extra = decoded.extra as ContactExtra; freeNotes = decoded.notes
  return { ...c, _extra: extra, _freeNotes: freeNotes }
}
export const serializeNotes = (extra: ContactExtra, freeNotes: string): string =>
  contactStore.encodeNotes(extra, freeNotes)
export const EMPTY_EXTRA: ContactExtra = {
  phone2: '', whatsapp: false, viber: false, website: '', office_address: '',
  afm: '', iban: '', iris: false, preferred: false, next_appointment: '',
  specialty: '', tags: [], avatar_url: '', notes_log: [], files: [],
  scope: 'property', scope_property_id: '',
}
export const EMPTY_FORM = { full_name: '', role: 'other', phone: '', email: '', freeNotes: '', extra: { ...EMPTY_EXTRA } }

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function fmtDate(d: string) {
  if (!d) return ''
  try { return localDay(d).toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' }) } catch { return d }
}
// Η πολιτική «null όταν λείπει, 0 όταν είναι άκυρη» ζει στο lib/core/time.
export const daysUntil = daysUntilOrNull
export function isOverdue(d: string) { const n = daysUntil(d); return n !== null && n < 0 }

// ─── ΤΑΙΡΙΑΣΜΑ ΕΠΑΦΗΣ ↔ ΠΑΡΑΣΤΑΤΙΚΩΝ ─────────────────────────────────────────
// ΤΟ ΑΦΜ ΕΙΝΑΙ Ο ΣΥΝΔΕΣΜΟΣ. Το όνομα δεν είναι: ο «Παπαδόπουλος Υδραυλικός» δεν
// βρίσκει τη δαπάνη «Συντήρηση — Παπαδόπουλος» και η «ΔΕΗ Α.Ε.» δεν βρίσκει τη
// «ΔΕΗ». Το ΑΦΜ γράφεται μία φορά, είναι ένα και υπάρχει και στα σαρωμένα έγγραφα
// (property_documents.provider_afm). Το ταίριασμα με ελεύθερο κείμενο μένει ΜΟΝΟ
// ως εφεδρεία για παλιές δαπάνες που δεν έχουν contact_id.
export const digitsOf = (v?: string | null) => (v || '').replace(/\D/g, '')

/** Όλα τα παραστατικά αυτού του παρόχου, με ΑΦΜ. Αυτό ζητά ο λογιστής. */
export async function fetchSupplierDocs(afm: string, propertyId: string) {
  if (digitsOf(afm).length !== 9) return []
  // Αμυντικά: αν η στήλη δεν υπάρχει ακόμη στη βάση, γυρνάμε κενό αντί να σκάσουμε.
  return documents.ofSupplierAfm<SupplierDoc>(
    supabase, propertyId, digitsOf(afm), 'id,title,category,doc_date,issue_date,amount,file_path')
}
export interface SupplierDoc { id: string; title: string | null; category: string | null; doc_date: string | null; issue_date: string | null; amount: number | null; file_path: string }
