'use client'

import { useState, useCallback, useMemo, useRef } from 'react'
import * as calendar from '@/lib/data/calendar'
// Οι επαφές έχουν ένα σπίτι: lib/data/contacts.
import * as contactStore from '@/lib/data/contacts';
import { inferRole } from '@/lib/contacts/roles'
import { ensureDpa } from '@/lib/legal/dpa'
import { alphaBucket, buildAlphaIndex, compareNames, initialsOf } from '@/lib/contacts/alpha'
import { Phone, Mail, X, Search, Globe, FileText, Users, Building2, Trash2, UserPlus, Camera, SearchX } from 'lucide-react'
import { DatePicker, CustomSelect, Toggle } from './UIComponents'
import { T, PageTitle, fieldRow, SecHdr, Btn, ChipToggle, LinkBtn, EmptyState, fn, Skeleton, SkeletonKPIs, SelectBox, Modal, pressable, pageShell, RuntimeImg } from '@/components/Theme'
import { showTool, SHOW_FROM } from '@/lib/ui/thresholds'
import { ActionMenu } from '@/components/ActionMenu'
import { notify, notifyOk, notifyError } from '@/components/Toast'
import { saved } from '@/components/dbWrite'
import { confirmDialog } from '@/components/confirmBus'
import { useReportBranding } from '@/lib/reportBranding'
import { removeFiles } from '@/lib/storage/contactFiles';
import { formFields, CONTACT_FIELDS, type FieldContext, type FieldDecision } from '@/lib/property/fields';
import { isoDate } from '@/lib/core/time';
import { downloadFile } from '@/lib/core/download';
import { MSG, SAY, failed } from '@/lib/core/dbError';
import { useLoad } from '@/app/hooks/useLoad';
import { toggleIn } from '@/lib/core/toggleSet';
import {
  supabase, type ContactExtra, type Contact, type TabContactsProps, type SortMode,
  type ViewMode, GROUPS, ROLE_META, roleMeta, ROLE_SELECT_OPTIONS, parseContact, serializeNotes,
  EMPTY_EXTRA, EMPTY_FORM, isOverdue, digitsOf,
} from './contacts/model'
import {
  iStyle, Inp, Txt, CField, SecHead, TagEditor,
  BulkBtn,
} from './contacts/Bits'
import { exportContactsExcel, exportContactsPDF } from './contacts/exports'
import {
  FileUploader, QRCodeModal, HistoryModal, QuickExpenseModal, QuickCalendarModal,
} from './contacts/modals'
import { contactRouteGrid, ContactActionTile, ContactDossier } from './contacts/ContactDossier'
import {
  ContactCard, CONTACT_ACTIONS_W, CONTACT_ROW_MIN, CompactRow, GroupDivider, AlphaRail,
} from './contacts/ContactCard'

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TabContacts({ propertyId, userId, embedded, profileType = 'individual', properties = [] }: TabContactsProps) {
  const isPro = profileType === 'professional'
  const branding = useReportBranding(userId)
  const [contacts, setContacts] = useState<Contact[]>([])
  // Ο ΔΕΙΚΤΗΣ ΦΟΡΤΩΣΗΣ ΔΕΝ ΕΙΝΑΙ ΞΕΧΩΡΙΣΤΗ ΚΑΤΑΣΤΑΣΗ, ΕΙΝΑΙ ΕΡΩΤΗΣΗ.
  // Ηταν `setLoading(true)` στην πρώτη γραμμή της φόρτωσης: σύγχρονη γραφή μέσα
  // σε effect, δηλαδή δεύτερη απόδοση πριν καν φύγει το αίτημα. Η ερώτηση που
  // ΟΝΤΩΣ απαντά είναι «τα δεδομένα που κρατώ είναι αυτού του ακινήτου;» και
  // απαντιέται κατά την απόδοση, χωρίς καμία γραφή. Με την αλλαγή ακινήτου
  // γίνεται αληθής ΑΜΕΣΩΣ, οπότε δεν υπάρχει καρέ με τα νούμερα του προηγούμενου.
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const loading = loadedFor !== propertyId
  const [showModal, setShowModal] = useState(false)
  const [editContact, setEditContact] = useState<Contact | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM, extra: { ...EMPTY_EXTRA } })
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterGroup, setFilterGroup] = useState('all')
  const [filterScope, setFilterScope] = useState<'all' | 'portfolio' | 'property'>('all')
  const [filterTag, setFilterTag] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('recent')
  const [letterFilter, setLetterFilter] = useState<string | null>(null)
  const [attention, setAttention] = useState<'overdue' | 'no-afm' | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [showMore, setShowMore] = useState(false)   // πτυσσόμενες προαιρετικές λεπτομέρειες στη φόρμα
  const [detailId, setDetailId] = useState<string | null>(null)   // ανοιχτό προφίλ (dossier), ζωντανό από τη λίστα
  const [scanning, setScanning] = useState(false)   // σάρωση κάρτας/τιμολογίου με AI
  const cardRef = useRef<HTMLInputElement>(null)
  const [dup, setDup] = useState<Contact | null>(null)   // υποψήφιο διπλότυπο (ίδιο τηλέφωνο/ΑΦΜ)
  const [roleOther, setRoleOther] = useState('')   // ελεύθερο κείμενο όταν επιλεγεί «Άλλο»
  const [error, setError] = useState<string | null>(null)
  const [quickExpense, setQuickExpense] = useState<Contact | null>(null)
  const [quickCalendar, setQuickCalendar] = useState<Contact | null>(null)
  const [historyContact, setHistoryContact] = useState<Contact | null>(null)
  const [qrContact, setQrContact] = useState<Contact | null>(null)
  const [bulkMode, setBulkMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dossierRefresh, setDossierRefresh] = useState(0)   // ανανεώνει τις πληρωμές στο dossier μετά από νέα δαπάνη

  // ─── Εμβέλεια επαφής (μόνο επαγγελματικό προφίλ) ──────────────────────────────
  const propName = (id?: string | null) => properties.find(p => p.id === id)?.name || ''
  const scopeIsPortfolio = (c: Contact) => c._extra?.scope === 'portfolio'
  const scopeLabelFor = (c: Contact): string | null => {
    if (!isPro) return null
    if (scopeIsPortfolio(c)) return 'Όλο το χαρτοφυλάκιο'
    return propName(c._extra?.scope_property_id || propertyId) || 'Αυτό το ακίνητο'
  }
  const fetchContacts = useCallback(async () => {
    // Φέρνουμε ΟΛΕΣ τις επαφές του χρήστη και δείχνουμε: αυτές του τρέχοντος ακινήτου
    // ΣΥΝ όσες έχουν οριστεί «όλο το χαρτοφυλάκιο» (ώστε οι επαγγελματικές επαφές
    // χαρτοφυλακίου να εμφανίζονται πραγματικά σε κάθε ακίνητο, όχι μόνο ως ετικέτα).
    const data = await contactStore.ofUser<Contact>(supabase, userId, '*', { orderBy: 'created_at', ascending: false })
    const parsed = data.map(parseContact)
    setContacts(parsed.filter(c => c.property_id === propertyId || c._extra?.scope === 'portfolio'))
    setLoadedFor(propertyId)
  }, [propertyId, userId])
  useLoad(fetchContacts)

  const isOtherRole = (r: string) => r === 'other' || r.endsWith('_other')
  const openAdd = () => { setEditContact(null); setForm({ ...EMPTY_FORM, extra: { ...EMPTY_EXTRA } }); setRoleOther(''); setError(null); setShowMore(false); setShowModal(true) }

  // Σάρωση επαγγελματικής κάρτας ή τιμολογίου με AI: εξάγει στοιχεία, προσυμπληρώνει
  // τη φόρμα και την ανοίγει για έλεγχο πριν την αποθήκευση (ο χρήστης επιβεβαιώνει).
  const runCardScan = async (file: File) => {
    setScanning(true)
    try {
      const dataUrl: string = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(file) })
      const base64 = dataUrl.split(',')[1]; const mime = file.type || 'image/jpeg'; const isPdf = mime === 'application/pdf'
      const contentPart = isPdf ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } } : { type: 'image', source: { type: 'base64', media_type: mime, data: base64 } }
      const sys = 'Είσαι βοηθός καταχώρησης επαφών για διαχείριση ακινήτων. Από επαγγελματική κάρτα ή τιμολόγιο, εξάγεις τα στοιχεία του επαγγελματία/εταιρείας. Σε τιμολόγιο, κράτα τον ΕΚΔΟΤΗ/προμηθευτή (όχι τον πελάτη). Απάντησε ΜΟΝΟ με έγκυρο JSON χωρίς επεξήγηση, με κλειδιά: full_name (string), role (μία λέξη στα αγγλικά που περιγράφει την ειδικότητα, π.χ. plumber, electrician, accountant, lawyer, notary, hvac· αλλιώς κενό), phone, phone2, email, website, address, afm (μόνο ψηφία), iban, specialty. Ό,τι δεν υπάρχει, κενή συμβολοσειρά.'
      const res = await fetch('/api/anthropic', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'scan', model: 'claude-sonnet-5', max_tokens: 900, system: sys, messages: [{ role: 'user', content: [contentPart, { type: 'text', text: 'Εξάγαγε τα στοιχεία επαφής από αυτό το έγγραφο.' }] }] }) })
      const data = await res.json()
      if (!res.ok || data?.error) { setScanning(false); notifyError(res.status === 429 && typeof data?.error === 'string' ? data.error : 'Η σάρωση δεν είναι διαθέσιμη τώρα'); return }
      const text = (data.content || []).find((c: { type: string }) => c.type === 'text')?.text || '{}'
      let d: Record<string, string> = {}
      try { d = JSON.parse(text.replace(/```json?|```/g, '').trim()) } catch { setScanning(false); notifyError('Δεν διάβασα καθαρά την κάρτα, δοκίμασε πάλι'); return }
      const roleVal = (d.role && ROLE_META[d.role.trim().toLowerCase()]) ? d.role.trim().toLowerCase() : inferRole([d.role, d.specialty, d.full_name].filter(Boolean).join(' ')) || 'other'
      const has = (v?: string) => (v || '').trim()
      setEditContact(null); setRoleOther('')
      setForm({
        full_name: has(d.full_name), role: roleVal, phone: has(d.phone), email: has(d.email), freeNotes: '',
        extra: { ...EMPTY_EXTRA, phone2: has(d.phone2), website: has(d.website), office_address: has(d.address), afm: has(d.afm).replace(/\D/g, ''), iban: has(d.iban).replace(/\s/g, '').toUpperCase(), specialty: has(d.specialty) },
      })
      setShowMore(!!(has(d.afm) || has(d.iban) || has(d.website) || has(d.address) || has(d.specialty)))
      setError(null); setScanning(false); setShowModal(true)
      notify(has(d.full_name) ? 'Έλεγξε τα στοιχεία και αποθήκευσε' : 'Συμπλήρωσε τα στοιχεία που λείπουν', { tone: 'info' })
    } catch { setScanning(false); notifyError('Παρουσιάστηκε σφάλμα στη σάρωση') }
  }
  // ΕΔΩ ΗΤΑΝ ΔΥΟ ΔΙΑΔΡΟΜΕΣ ΕΙΣΑΓΩΓΗΣ (~60 γραμμές): αρχείο .vcf/.csv και Contacts
  // Picker του κινητού. Έφυγαν και οι δύο. Η πρώτη έσπαγε σε κάθε πραγματικό CSV
  // (έκοβε σε «,» ή «;» χωρίς να σέβεται εισαγωγικά, οπότε ένα «Παπαδόπουλος, ΑΕ»
  // γινόταν δύο στήλες)· η δεύτερη δουλεύει σε ελάχιστα προγράμματα περιήγησης και
  // φέρνει ονόματα χωρίς ειδικότητα, χωρίς ΑΦΜ, χωρίς IBAN — δηλαδή επαφές που
  // πρέπει να ξανασυμπληρωθούν με το χέρι. Και τα δύο τα καλύπτει η ΦΩΤΟΓΡΑΦΙΑ της
  // κάρτας ή του τιμολογίου, που διαβάζει όνομα, ειδικότητα, τηλέφωνο, ΑΦΜ και IBAN
  // με μία κίνηση.

  // ── Εξαγωγή vCard ──
  const vcardFor = (c: Contact) => ['BEGIN:VCARD', 'VERSION:3.0', `FN:${c.full_name}`, c._extra?.specialty ? `TITLE:${c._extra.specialty}` : '', c.phone ? `TEL:${c.phone}` : '', c._extra?.phone2 ? `TEL:${c._extra.phone2}` : '', c.email ? `EMAIL:${c.email}` : '', c._extra?.website ? `URL:${c._extra.website}` : '', c._extra?.office_address ? `ADR:;;${c._extra.office_address};;;;` : '', 'END:VCARD'].filter(Boolean).join('\n')
  const downloadVcf = (list: Contact[], name: string) => {
    downloadFile(list.map(vcardFor).join('\n'), name, 'text/vcard;charset=utf-8')
  }

  const openEdit = (c: Contact) => { const known = !!ROLE_META[c.role]; setRoleOther(known ? '' : (c.role || '')); setEditContact(c); setForm({ full_name: c.full_name, role: known ? c.role : 'other', phone: c.phone || '', email: c.email || '', freeNotes: c._freeNotes || '', extra: { ...EMPTY_EXTRA, ...(c._extra || {}), tags: c._extra?.tags || [], notes_log: c._extra?.notes_log || [], files: c._extra?.files || [] } }); setError(null); setShowMore(!!(c._extra?.tags?.length || c._extra?.notes_log?.length || c._extra?.files?.length || c._extra?.iban || c._extra?.next_appointment)); setShowModal(true) }
  const closeModal = () => { setShowModal(false); setEditContact(null); setError(null) }
  // ── ΦΡΟΥΡΑ «ΜΗΝ ΚΛΕΙΣΕΙΣ ΟΣΟ ΑΠΟΘΗΚΕΥΕΙ» ────────────────────────────────
  // Το χειρόγραφο παράθυρο έκλεινε ΜΟΝΟ από το «×» και την «Ακύρωση». Το Modal
  // προσθέτει Escape και κλικ στο φόντο, δηλαδή δύο νέους τρόπους να φύγεις στη
  // μέση της αποθήκευσης. Αν φύγεις, η κλήση συνεχίζει· και αν αποτύχει, το
  // `setError` γράφει σε παράθυρο που δεν υπάρχει πια — ο χρήστης χάνει ό,τι
  // πληκτρολόγησε και δεν μαθαίνει ποτέ γιατί. Το `closeModal` μένει άθικτο για
  // το `persist`, που κλείνει ΜΕΤΑ από επιτυχία (και δεν βλέπει ακόμη το
  // setSaving(false) της ίδιας ριπής).
  const requestCloseModal = () => { if (!saving) closeModal() }
  const requestCloseDup = () => { if (!saving) setDup(null) }
  const setExtra = (key: keyof ContactExtra, value: unknown) => setForm(f => ({ ...f, extra: { ...f.extra, [key]: value } }))

  // ── Εντοπισμός διπλότυπου (ίδιο τηλέφωνο ≥8 ψηφία ή ίδιο ΑΦΜ) ──
  const onlyDigits = (s?: string | null) => (s || '').replace(/\D/g, '')
  const findDuplicate = (): Contact | null => {
    const ph = onlyDigits(form.phone); const afm = onlyDigits(form.extra.afm)
    return contacts.find(c => c.id !== editContact?.id && (
      (ph.length >= 8 && onlyDigits(c.phone) === ph) ||
      (afm.length >= 9 && onlyDigits(c._extra?.afm) === afm)
    )) || null
  }
  // Για συγχώνευση: κρατάμε μόνο τα «γεμάτα» πεδία του νέου (τα false/0/κενά δεν
  // σβήνουν υπάρχουσες τιμές, π.χ. προτιμώμενη/αξιολόγηση/WhatsApp της παλιάς επαφής).
  const cleanExtra = (e: ContactExtra): Partial<ContactExtra> => {
    const out: Record<string, unknown> = {}
    Object.entries(e).forEach(([k, v]) => { if (!v) return; if (Array.isArray(v) && v.length === 0) return; out[k] = v })
    return out as Partial<ContactExtra>
  }
  // Συγχρονισμός υπενθύμισης/ραντεβού επαφής στο ημερολόγιο, ώστε να στέλνεται ειδοποίηση.
  const syncContactReminder = async (contactId: string, name: string) => {
    const src = `contact:${contactId}:reminder`
    // ΜΟΝΟ το ραντεβού. Η «Υπενθύμιση επικοινωνίας» υποσχόταν ρυθμό (κάθε 30
    // ημέρες) και έγραφε μία παγωμένη ημερομηνία, υπολογισμένη μία φορά στο κλικ.
    const date = form.extra.next_appointment || ''
    await saved(MSG.reminder, calendar.replaceSource(supabase, { propertyId, userId }, { source: src },
      date ? [{ title: `Επικοινωνία: ${name}`, category: 'reminder', event_date: date, notes: form.extra.specialty || null }] : []))
  }

  const persist = async (mode: 'update' | 'insert' | 'merge', target?: Contact) => {
    setSaving(true); setError(null)
    const name = form.full_name.trim()
    const finalRole = isOtherRole(form.role) && roleOther.trim() ? roleOther.trim() : form.role
    if (mode === 'merge' && target) {
      const mergedExtra = { ...(target._extra || {}), ...cleanExtra(form.extra) }
      const mergedNotes = [target._freeNotes, form.freeNotes].filter(Boolean).join('\n').trim()
      const mergedRole = (finalRole && finalRole !== 'other') ? finalRole : target.role
      const { error: e } = await contactStore.update(supabase, target.id, { full_name: name || target.full_name, role: mergedRole, phone: form.phone.trim() || target.phone, email: form.email.trim() || target.email, notes: serializeNotes(mergedExtra, mergedNotes) })
      if (e) { setError(failed('Η επαφή δεν αποθηκεύτηκε', e)); setSaving(false); return }
      await syncContactReminder(target.id, name || target.full_name)
      setSaving(false); setDup(null); closeModal(); fetchContacts(); notifyOk('Οι επαφές συγχωνεύθηκαν'); return
    }
    const payload = { full_name: name, role: finalRole, phone: form.phone.trim() || null, email: form.email.trim() || null, notes: serializeNotes(form.extra, form.freeNotes) }
    if (mode === 'update' && editContact) {
      const { error: e } = await contactStore.update(supabase, editContact.id, payload)
      if (e) { setError(failed('Η επαφή δεν αποθηκεύτηκε', e)); setSaving(false); return }
      await syncContactReminder(editContact.id, name)
      setSaving(false); closeModal(); fetchContacts(); notifyOk('Επαφή ενημερώθηκε'); return
    }
    // Νέα επαφή: πρώτα η σύμβαση επεξεργασίας (lib/legal/dpa.ts). Οι Όροι
    // ονομάζουν «τους συνεργάτες σου». Η φόρμα μένει ανοιχτή με ό,τι γράφτηκε.
    if (!(await ensureDpa(supabase))) { setError('Η επαφή δεν αποθηκεύτηκε: χρειάζεται αποδοχή της σύμβασης επεξεργασίας.'); setSaving(false); return }
    const { data: ins, error: e } = await contactStore.addReturningId(supabase, propertyId, userId, payload)
    if (e) { setError(failed('Η επαφή δεν αποθηκεύτηκε', e)); setSaving(false); return }
    if (ins?.id) await syncContactReminder(ins.id, name)
    setSaving(false); setDup(null); closeModal(); fetchContacts(); notifyOk('Επαφή προστέθηκε')
  }

  const handleSave = async () => {
    if (!form.full_name.trim()) { setError(SAY.nameRequired); return }
    if (!editContact) { const d = findDuplicate(); if (d) { setDup(d); return } }
    await persist(editContact ? 'update' : 'insert')
  }

  const handleDelete = async (id: string) => {
    // ΤΑ ΑΡΧΕΙΑ ΦΕΥΓΟΥΝ ΠΡΩΤΑ, ΟΣΟ ΥΠΑΡΧΕΙ ΑΚΟΜΗ Η ΓΡΑΜΜΗ ΠΟΥ ΤΑ ΞΕΡΕΙ.
    // Διαγραμμένη η επαφή, τα μονοπάτια τους δεν είναι πουθενά γραμμένα.
    const gone = contacts.find(c => c.id === id)?._extra?.files ?? []
    if (gone.length) await removeFiles(supabase, gone)
    if (!await saved('Η επαφή δεν διαγράφηκε', contactStore.remove(supabase, id))) return
    await saved('Η υπενθύμιση της επαφής δεν καθαρίστηκε', calendar.clearSource(supabase, { propertyId, userId }, { source: `contact:${id}:reminder` }))
    fetchContacts(); notify('Επαφή διαγράφηκε')
  }
  // ΜΙΑ ΕΡΩΤΗΣΗ ΓΙΑ ΤΕΣΣΕΡΑ ΚΟΥΜΠΙΑ. Το «Διαγραφή» της κάρτας, της γραμμής
  // λίστας, του μενού «···» και του ντοσιέ άναβαν όλα την ίδια κατάσταση
  // `deleteId`, που υπήρχε αποκλειστικά για να εμφανίσει το χειρόγραφο παράθυρο.
  // Η ερώτηση είναι πλέον εδώ, σε μία γραμμή και η κατάσταση δεν χρειάζεται.
  const askDelete = async (c: Contact) => {
    // Η ΕΡΩΤΗΣΗ ΟΝΟΜΑΖΕΙ ΤΗΝ ΕΠΑΦΗ ΚΑΙ ΟΣΑ ΦΕΥΓΟΥΝ ΜΑΖΙ ΤΗΣ, όπως στον
    // Ενοικιαστή και στους Επισκέπτες. Σημειώσεις και αρχεία ζουν στη γραμμή
    // της επαφής· οι δαπάνες κρατούν τη δική τους γραμμή με `contact_id` κενό
    // (on delete set null, 20260824100000).
    if (!await confirmDialog({ title: `Διαγραφή «${c.full_name}»;`, message: 'Διαγράφονται μαζί οι σημειώσεις και τα αρχεία της επαφής. Οι δαπάνες που συνδέθηκαν μαζί της μένουν, χωρίς επαφή. Η διαγραφή δεν αναιρείται.', confirmLabel: 'Διαγραφή', tone: 'negative' })) return
    await handleDelete(c.id)
  }
  const toggleSelect = (id: string) => setSelected(p => { return toggleIn(p, id) })
  const bulkDelete = async () => {
    // Το στιγμιότυπο των ids παίρνεται ΠΡΙΝ την ερώτηση. Με το native confirm η
    // σελίδα πάγωνε, οπότε το `selected` δεν μπορούσε να αλλάξει όσο ρωτούσαμε.
    // Ο δικός μας διάλογος δεν παγώνει τίποτα: αν διαβάζαμε το `selected` μετά
    // το await, ο χρήστης θα μπορούσε να αλλάξει επιλογή και θα διαγράφονταν
    // ΑΛΛΕΣ επαφές από όσες ανέφερε το μήνυμα — και σε άλλο πλήθος από το `n`.
    const ids = [...selected]
    const n = ids.length
    if (!n || !(await confirmDialog(`Διαγραφή ${n} ${n === 1 ? 'επαφής' : 'επαφών'};`, { tone: 'negative', confirmLabel: 'Διαγραφή' }))) return
    if (!await saved(`${n === 1 ? 'Η επαφή δεν διαγράφηκε' : 'Οι επαφές δεν διαγράφηκαν'}`,
      contactStore.removeMany(supabase, ids))) return
    // Καθαρισμός των υπενθυμίσεων ημερολογίου (ισοτιμία με τη μεμονωμένη διαγραφή).
    await saved('Οι υπενθυμίσεις των επαφών δεν καθαρίστηκαν', calendar.clearSource(supabase, { propertyId, userId }, { sources: ids.map(id => `contact:${id}:reminder`) }))
    setSelected(new Set()); setBulkMode(false); fetchContacts(); notify(`${n} ${n === 1 ? 'επαφή διαγράφηκε' : 'επαφές διαγράφηκαν'}`)
  }
  const bulkEmail = () => { const emails = contacts.filter(c => selected.has(c.id) && c.email).map(c => c.email).join(','); if (emails) window.open('mailto:' + emails); else notify('Καμία από τις επιλεγμένες δεν έχει email', { tone: 'warning' }) }
  const bulkVcard = () => { const sel = contacts.filter(c => selected.has(c.id)); if (sel.length) downloadVcf(sel, 'epafes-epilogi.vcf') }
  // Το ραντεβού που κλείνεται από το προφίλ γράφεται και στην ΙΔΙΑ την επαφή
  // (πεδίο «επόμενο ραντεβού»), ώστε να ανάβει το badge/η παρακολούθηση ληξιπρόθεσμων.
  const linkAppointmentToContact = async (c: Contact | null, date: string) => {
    if (!c || !date) return
    const extra = { ...EMPTY_EXTRA, ...(c._extra || {}), next_appointment: date }
    if (!await saved('Το ραντεβού δεν γράφτηκε στην επαφή',
      contactStore.update(supabase, c.id, { notes: serializeNotes(extra, c._freeNotes || '') }))) return
    // Υπενθύμιση ημερολογίου μία ημέρα πριν (idempotent ανά επαφή).
    const src = `contact:${c.id}:reminder`
    const remind = new Date(date + 'T00:00:00'); remind.setDate(remind.getDate() - 1)
    await saved('Η υπενθύμιση ραντεβού δεν δημιουργήθηκε', calendar.replaceSource(supabase, { propertyId, userId }, { source: src },
      [{ title: `Υπενθύμιση ραντεβού: ${c.full_name}`, category: 'reminder', event_date: isoDate(remind) }]))
    fetchContacts()
  }

  // ─── Enhanced CSV Export ───────────────────────────────────────────────────

  // Το σύνολο ΠΡΙΝ από το γράμμα: πάνω σε αυτό χτίζεται η ράγα, ώστε τα πλήθη
  // της να ακολουθούν την αναζήτηση και τις κατηγορίες — αλλά να μη μηδενίζονται
  // από την ίδια της την επιλογή. Αν η ράγα μετρούσε το τελικό αποτέλεσμα, μόλις
  // πάταγες «Π» θα έμενε ΜΟΝΟ το «Π» και δεν θα υπήρχε δρόμος για το «Α».
  const scoped = useMemo(() => contacts.filter(c => {
    const matchGroup = filterGroup === 'all' || roleMeta(c.role).groupId === filterGroup
    const matchTag = !filterTag || (c._extra?.tags || []).includes(filterTag)
    const matchScope = !isPro || filterScope === 'all'
      || (filterScope === 'portfolio' ? scopeIsPortfolio(c) : !scopeIsPortfolio(c))
    const matchAttention = !attention || (attention === 'overdue'
      ? !!(c._extra?.next_appointment && isOverdue(c._extra.next_appointment))
      : digitsOf(c._extra?.afm).length !== 9)
    const q = search.toLowerCase(); const ex = c._extra || {}
    return matchGroup && matchTag && matchScope && matchAttention && (!q || c.full_name.toLowerCase().includes(q) || (c.phone || '').includes(q) || (c.email || '').toLowerCase().includes(q) || (ex.specialty || '').toLowerCase().includes(q) || (ex.afm || '').includes(q) || (ex.iban || '').includes(q) || (ex.tags || []).some((t: string) => t.toLowerCase().includes(q)))
  }), [contacts, search, filterGroup, filterTag, filterScope, attention, isPro])

  const alphaIndex = useMemo(() => buildAlphaIndex(scoped.map(c => c.full_name)), [scoped])

  // ── ΠΟΣΑ ΕΙΔΗ ΥΠΑΡΧΟΥΝ ΠΡΑΓΜΑΤΙΚΑ ─────────────────────────────────────────
  // Οι δύο αριθμοί που κρίνουν αν ένα φίλτρο έχει τι να φιλτράρει: πόσες ομάδες
  // επαφών υπάρχουν όντως και πόσα είδη εμβέλειας. Ένα φίλτρο με μία επιλογή
  // δεν είναι φίλτρο — είναι ετικέτα με περίγραμμα κουμπιού.
  const groupsPresent = useMemo(
    () => GROUPS.filter(g => contacts.some(c => roleMeta(c.role).groupId === g.id)),
    [contacts])
  const scopeKinds = useMemo(
    () => new Set(contacts.map(c => (c._extra?.scope === 'portfolio' ? 'portfolio' : 'property'))).size,
    [contacts])

  // Το γράμμα που δεν υπάρχει πια δεν επιτρέπεται να μείνει πατημένο: αν έσβηνες
  // την τελευταία επαφή στο «Π», η οθόνη θα έδειχνε κενό με ενεργό ένα γράμμα
  // που δεν φαίνεται πουθενά — αδιέξοδο χωρίς ορατή έξοδο.
  const letter = letterFilter && alphaIndex.some(e => e.letter === letterFilter) ? letterFilter : null

  const processed = useMemo(() => {
    const list = letter ? scoped.filter(c => alphaBucket(c.full_name) === letter) : [...scoped]
    // Με ενεργό γράμμα η σειρά είναι ΠΑΝΤΑ αλφαβητική — το «πιο πρόσφατες» μέσα
    // σε ένα γράμμα δεν απαντά καμία ερώτηση.
    if (sortMode === 'alpha' || letter) list.sort((a, b) => compareNames(a.full_name, b.full_name))
    return [...list.filter(c => c._extra?.preferred), ...list.filter(c => !c._extra?.preferred)]
  }, [scoped, sortMode, letter])

  const groupedFiltered: Record<string, Contact[]> = {}
  processed.forEach(c => { const gid = roleMeta(c.role).groupId; if (!groupedFiltered[gid]) groupedFiltered[gid] = []; groupedFiltered[gid].push(c) })
  const preferred = contacts.filter(c => c._extra?.preferred)
  const overdueContacts = contacts.filter(c => c._extra?.next_appointment && isOverdue(c._extra.next_appointment))
  const allTags = [...new Set(contacts.flatMap(c => c._extra?.tags || []))]
  // ΠΕΝΤΕ ΠΛΗΘΗ ΕΓΙΝΑΝ ΤΡΙΑ ΚΑΙ ΤΟ ΣΗΜΑ ΑΝΕΒΗΚΕ ΠΑΝΩ. Πριν, η μόνη γραμμή που
  // ζητούσε ενέργεια (ληγμένα ραντεβού) ήταν ΚΑΤΩ από πέντε μετρητές που δεν
  // ζητούν τίποτα. Ένα πλήθος δεν είναι κρίση: «4 τεχνικοί» δεν σε βάζει να κάνεις
  // κάτι. Το «λείπει ΑΦΜ» σε βάζει, γιατί χωρίς αυτό δεν δένουν τα παραστατικά.
  const missingAfm = contacts.filter(c => digitsOf(c._extra?.afm).length !== 9).length
  // Το ΑΦΜ δεν είναι γραφειοκρατία: χωρίς αυτό, ένα τιμολόγιο του συνεργάτη δεν
  // δένει με την επαφή του και η δαπάνη μένει ανώνυμη στο βιβλίο.
  const needsAttention = ([
    { id: 'overdue' as const, label: 'Ληγμένο ραντεβού', count: overdueContacts.length },
    { id: 'no-afm' as const, label: 'Χωρίς ΑΦΜ', count: missingAfm },
  ]).filter(a => a.count > 0)
  // Ποια πεδία βλέπει ΑΥΤΟΣ ο χρήστης. Η «εμβέλεια» π.χ. δεν έχει νόημα με ένα
  // ακίνητο, οπότε δεν υπάρχει καθόλου — δεν είναι ρύθμιση, είναι θόρυβος.
  const contactCtx: FieldContext = {
    status: 'rent_long', business: isPro, doubleEntry: false,
    propertyCount: Math.max(properties.length, 1),
  }
  const contactFields = formFields(CONTACT_FIELDS, contactCtx)
  const contactById = new Map<string, FieldDecision>([...contactFields.core, ...contactFields.more].map(d => [d.id, d]))
  const cf = (id: string) => contactById.get(id)
  const detail = detailId ? (contacts.find(c => c.id === detailId) || null) : null   // ζωντανό (ανανεώνεται μετά από edit/refresh)

  return (
    <div style={pageShell(1080)}>


      <input ref={cardRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) runCardScan(f); e.currentTarget.value = '' }} />
      {/* ── ΔΕΝ ΕΙΝΑΙ ΠΑΡΑΘΥΡΟ, ΕΙΝΑΙ ΠΡΟΟΔΟΣ: ΜΕΝΕΙ ΧΕΙΡΟΓΡΑΦΟ ──────────────
          Δεν ρωτά τίποτα και δεν προσφέρει καμία ενέργεια — ούτε πρέπει. Το
          Modal δίνει «×» και Escape, δηλαδή δύο τρόπους να το κλείσεις· όμως το
          κλείσιμο ΔΕΝ ακυρώνει την κλήση προς το μοντέλο, οπότε ο χρήστης θα
          έβλεπε τη φόρμα να ανοίγει μόνη της δευτερόλεπτα αφού «έφυγε» από τη
          σάρωση. Ένα υπόσχεση-ακύρωσης που δεν ακυρώνει είναι χειρότερη από την
          αναμονή. Ευθυγραμμίζονται μόνο scrim, ακτίνα και σκιά με τα tokens.
          Ο role="status" αντικαθιστά το role="dialog": ο αναγνώστης οθόνης
          ανακοινώνει την πρόοδο αντί να ψάχνει χειριστήρια που δεν υπάρχουν. */}
      {scanning && (
        <div role="status" aria-live="polite" aria-label="Ανάλυση κάρτας" style={{ position: 'fixed', inset: 0, background: T.scrim, zIndex: 2100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.modal, padding: '26px 32px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: 'var(--elev-3)' }}>
            <div style={{ width: 22, height: 22, border: '2.5px solid var(--border-default)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'contactsSpin 0.7s linear infinite' }} />
            <div><div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Ανάλυση κάρτας…</div><div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Εξάγω τα στοιχεία επαφής</div></div>
          </div>
          <style>{`@keyframes contactsSpin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {/* ΤΑ ΚΟΥΜΠΙΑ ΤΗΣ ΚΕΦΑΛΙΔΑΣ ΑΠΟΔΙΔΟΝΤΑΙ ΠΑΝΤΑ. Πριν, όλα μαζί — και η σάρωση —
          εμφανίζονταν ΜΟΝΟ αν υπήρχε ήδη επαφή: ο νέος χρήστης δεν έβλεπε ποτέ τη
          σάρωση και ο μόνος δρόμος για την πρώτη του επαφή ήταν η φόρμα. Το κύριο
          κουμπί είναι η ΦΩΤΟΓΡΑΦΙΑ, όχι η χειροκίνητη καταχώρηση. */}
      {/* ΕΝΘΕΤΟ: ΕΠΙΚΕΦΑΛΙΔΑ ΕΝΟΤΗΤΑΣ, ΟΧΙ ΔΕΥΤΕΡΟΣ ΤΙΤΛΟΣ ΣΕΛΙΔΑΣ.
          Μέσα στο Αρχείο υπήρχαν δύο τίτλοι πρώτου επιπέδου ο ένας κάτω από τον
          άλλο, με δύο υπότιτλους που έλεγαν την ίδια πρόταση με άλλες λέξεις.
          Οι ενέργειες είναι ΟΙ ΙΔΙΕΣ και στις δύο μορφές: γράφονται μία φορά. */}
      {(() => {
      // ── ΤΡΙΑ ΚΟΥΜΠΙΑ ΕΓΙΝΑΝ ΔΥΟ ────────────────────────────────────────────
      // Ήταν «Νέα επαφή», «Εξαγωγή ▾» και «Σάρωση κάρτας» σε μία σειρά: δύο από
      // τα τρία οδηγούν στο ΙΔΙΟ αποτέλεσμα (μια νέα επαφή) με διαφορετική
      // ταχύτητα και το τρίτο είναι εξαγωγή — ενέργεια που δεν κάνει κανείς
      // στην πρώτη του επίσκεψη και δεν αξίζει μόνιμη θέση δίπλα στη δημιουργία.
      //
      // Μένει ΜΙΑ κύρια ενέργεια, η γρήγορη: η φωτογραφία της κάρτας διαβάζει
      // όνομα, τηλέφωνο, email και ΑΦΜ μόνη της. Η χειροκίνητη καταχώρηση και οι
      // τρεις εξαγωγές πάνε στο κοινό μενού «Περισσότερα» — το ίδιο που
      // χρησιμοποιεί ήδη η Απογραφή, ώστε οι δύο οθόνες να διαβάζονται σαν μία.
      const actions = <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <ActionMenu label="Περισσότερα" items={[
            { key: 'add', label: 'Νέα επαφή χειροκίνητα', description: 'Χωρίς κάρτα: συμπληρώνεις εσύ τα πεδία.', onClick: openAdd },
            ...(contacts.length > 0 ? [
              { key: 'xlsx', label: 'Κατάλογος σε Excel', description: 'Όλα τα πεδία, για υπολογιστικό φύλλο.', onClick: () => exportContactsExcel(contacts) },
              { key: 'pdf', label: 'Κατάλογος σε PDF', description: 'Έτοιμος για εκτύπωση ή αποστολή.', onClick: () => exportContactsPDF(contacts, branding) },
              { key: 'vcf', label: 'Επαφές στο κινητό', description: 'Αρχείο vCard για το τηλεφωνικό σου ευρετήριο.', onClick: () => downloadVcf(contacts, 'epafes.vcf') },
            ] : []),
          ]} />
          {/* Η ΙΔΙΑ ΚΥΡΙΑ ΕΝΕΡΓΕΙΑ ΔΥΟ ΦΟΡΕΣ ΚΑΙ ΟΙ ΔΥΟ ΜΠΛΕ, ΣΤΗΝ ΙΔΙΑ ΟΘΟΝΗ.
              Με άδειο κατάλογο, ο χρήστης έβλεπε «Σάρωση κάρτας» πάνω δεξιά ΚΑΙ
              «Φωτογράφισε κάρτα» στο κέντρο — δύο γεμάτα γαλάζια κουμπιά που
              καλούν το ΙΔΙΟ `cardRef.current?.click()`. Το μάτι δεν ξέρει πού να
              πάει και το σχόλιο τρεις γραμμές πιο πάνω υπόσχεται ρητά «μένει
              ΜΙΑ κύρια ενέργεια».

              Όταν δεν υπάρχει τίποτα, η κενή κατάσταση ΕΙΝΑΙ η πρόσκληση: δίνει
              και τους δύο δρόμους, με εξήγηση τι διαβάζεται από την κάρτα. Το
              κουμπί της κεφαλίδας εμφανίζεται μόλις υπάρχει κατάλογος, όπου
              πραγματικά χρειάζεται συντόμευση. */}
          {contacts.length > 0 && (
            <Btn variant="primary" onClick={() => cardRef.current?.click()}>{scanning ? 'Σάρωση…' : 'Σάρωση κάρτας'}</Btn>
          )}
        </div>;
      return embedded
        ? <SecHdr label="Επαφές του ακινήτου" sub="Πάροχοι, τεχνικοί, τράπεζες, ασφαλιστές" right={actions}/>
        : <PageTitle title="Επαφές" sub="Συνεργάτες, πάροχοι και υπηρεσίες του ακινήτου" right={actions}/>;
      })()}

      {/* ══ ΤΙ ΧΡΕΙΑΖΕΤΑΙ ΠΡΟΣΟΧΗ ══════════════════════════════════════════
          Πριν εδώ υπήρχαν ΔΥΟ ζώνες που έλεγαν το ίδιο: τρία πλακίδια
          («ΛΗΓΜΕΝΑ ΡΑΝΤΕΒΟΥ 0 · ΧΩΡΙΣ ΑΦΜ 1 · ΣΥΝΟΛΟ ΕΠΑΦΩΝ 1») και από κάτω
          μια κορδέλα που ξανάλεγε τα ληγμένα ραντεβού ονομαστικά. Το σύνολο
          λεγόταν άλλες τρεις φορές παρακάτω — στη γραμμή πλήθους, στο chip της
          κατηγορίας και στον διαχωριστή της ομάδας.

          Ένα πλήθος δεν είναι ενέργεια: το «4 τεχνικοί» δεν σε βάζει να κάνεις
          τίποτα. Εδώ μένουν μόνο τα δύο που ΖΗΤΟΥΝ κάτι και είναι φίλτρα: το
          πάτημα σε πηγαίνει στις συγκεκριμένες επαφές αντί να σε αφήνει να τις
          ψάξεις. Όταν δεν υπάρχει τίποτα εκκρεμές, η ζώνη δεν υπάρχει — η
          απουσία προβλήματος δεν χρειάζεται ανακοίνωση. */}
      {!loading && needsAttention.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {needsAttention.map(a => {
            const on = attention === a.id
            return (
              <ChipToggle key={a.id} on={on} onClick={() => setAttention(on ? null : a.id)}>
                {a.label}
                {/* Ιδιο με τα φίλτρα του Αρχείου: η διαφάνεια έριχνε τον μετρητή στο
                    3,46:1. Το βάρος το δίνει το χρώμα, όχι το ξεθώριασμα. */}
                <span style={{ fontFamily: T.font.mono, fontVariantNumeric: 'tabular-nums', fontSize: 'var(--fs-xs)', color: on ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{fn(a.count)}</span>
              </ChipToggle>
            )
          })}
        </div>
      )}

      {bulkMode && (() => {
        const allOn = processed.length > 0 && processed.every(c => selected.has(c.id))
        const someOn = selected.size > 0 && !allOn
        const masterToggle = () => setSelected(allOn ? new Set() : new Set(processed.map(c => c.id)))
        const hasEmail = contacts.some(c => selected.has(c.id) && c.email)
        const none = selected.size === 0
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.card, padding: '11px 16px', marginBottom: T.sp.lg, flexWrap: 'wrap', boxShadow: 'var(--elev-1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <SelectBox checked={allOn} indeterminate={someOn} onChange={masterToggle} label="Επιλογή όλων" />
              <span style={{ fontSize: 14, fontWeight: 600, color: none ? 'var(--text-secondary)' : 'var(--text-primary)', fontFamily: T.font.sans, whiteSpace: 'nowrap' }}>
                {none ? `Επιλογή όλων (${processed.length})` : `${selected.size} ${selected.size === 1 ? 'επιλεγμένη' : 'επιλεγμένες'}`}
              </span>
            </div>
            <div style={{ width: 1, height: 22, background: 'var(--border-subtle)', flexShrink: 0 }} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <BulkBtn icon={Mail} label="Ηλεκτρονικό ταχυδρομείο" onClick={bulkEmail} disabled={!hasEmail} />
              <BulkBtn icon={FileText} label="Εξαγωγή vCard" onClick={bulkVcard} disabled={none} />
              <BulkBtn icon={Trash2} label="Διαγραφή" onClick={bulkDelete} disabled={none} danger />
            </div>
            {/* Το `marginLeft: auto` ζει στον γονέα: το Btn δεν παίρνει θέση, μόνο ρόλο. */}
            <div style={{ marginLeft: 'auto' }}>
              <Btn variant="ghost" onClick={() => { setBulkMode(false); setSelected(new Set()) }}><X size={14} />Τέλος</Btn>
            </div>
          </div>
        )
      })()}

      {preferred.length > 0 && (
        <div style={{ marginBottom: T.sp.xl, padding: '16px 20px', background: 'var(--bg-surface)', borderRadius: T.radius.card, border: '1px solid var(--border-subtle)' }}>
          <SecHdr label="Γρήγορη πρόσβαση" />
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {preferred.map(c => {
              const meta = roleMeta(c.role)
              const overdue = c._extra?.next_appointment && isOverdue(c._extra.next_appointment)
              const GroupIcon = meta.GroupIcon || Users
              return (
                <div key={c.id} {...pressable(() => openEdit(c))} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', borderRadius: T.radius.pill, background: 'var(--bg-elevated)', border: '1px solid ' + (overdue ? 'var(--negative-border)' : 'var(--accent-border)'), cursor: 'pointer', position: 'relative', maxWidth: '100%', minWidth: 0 }}>
                  {overdue && <span style={{ position: 'absolute', top: -4, right: -4, width: 12, height: 12, borderRadius: '50%', background: 'var(--negative)', border: '2px solid var(--bg-elevated)' }} />}
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--accent)', overflow: 'hidden', flexShrink: 0 }}>
                    {c._extra?.avatar_url ? <RuntimeImg src={c._extra.avatar_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} /> : initialsOf(c.full_name) || <GroupIcon size={14} />}
                  </div>
                  <div title={c.full_name} style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.full_name}</div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meta.label}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginLeft: 4, flexShrink: 0 }}>
                    {c.phone && <a href={'tel:' + c.phone} onClick={e => e.stopPropagation()} style={{ textDecoration: 'none', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', padding: 4 }}><Phone size={13} /></a>}
                    {c._extra?.whatsapp && c.phone && <a href={'https://wa.me/' + c.phone.replace(/\D/g, '')} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ textDecoration: 'none', fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-soft)', padding: '2px 5px', borderRadius: T.radius.xs }}>WA</a>}
                    {c._extra?.viber && c.phone && <a href={'viber://chat?number=' + c.phone.replace(/\D/g, '')} onClick={e => e.stopPropagation()} style={{ textDecoration: 'none', fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-soft)', padding: '2px 5px', borderRadius: T.radius.xs }}>VB</a>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!loading && contacts.length > 0 && (<>
      {/* ── ΤΑ ΕΡΓΑΛΕΙΑ ΕΜΦΑΝΙΖΟΝΤΑΙ ΟΤΑΝ ΤΑ ΔΙΚΑΙΟΛΟΓΕΙ ΤΟ ΠΛΗΘΟΣ ───────
          Με μία επαφή, αυτή η οθόνη έδειχνε δώδεκα χειριστήρια: αναζήτηση,
          ετικέτες, ταξινόμηση, προβολή, αλφαβητικό ευρετήριο, τρία κουμπιά
          εμβέλειας, chip ομάδας, πλήθος και μαζική επιλογή. Κανένα δεν είναι
          λάθος — όλα είναι λάθος ΕΚΕΙ: η αναζήτηση δεν λύνει τίποτα σε μία
          γραμμή, η ταξινόμηση δύο τιμών σε ένα στοιχείο δεν αλλάζει τίποτα,
          ένα ευρετήριο για τρία γράμματα δεν είναι ευρετήριο.
          Τα κατώφλια ζουν στο lib/ui/thresholds.ts, ένα για όλη την εφαρμογή. */}
      {(showTool('search', contacts.length) || showTool('sort', contacts.length)) && (
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {showTool('search', contacts.length) && (
        <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
          {/* Το γέμισμα κρατά το κείμενο έξω από το εικονίδιο: ξεκινά στα 13 με πλάτος 14. */}
          <input value={search} aria-label="Αναζήτηση επαφής" onChange={e => setSearch(e.target.value)} placeholder="Όνομα, τηλέφωνο, email, ΑΦΜ ή IBAN" style={{ ...iStyle, paddingLeft: 38 }} onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-dim)' }} onBlur={e => { e.target.style.borderColor = 'var(--border-default)'; e.target.style.boxShadow = 'none' }} />
        </div>
        )}
        {allTags.length > 0 && (
          <div style={{ minWidth: 170 }}>
            <CustomSelect ariaLabel="Ετικέτα" value={filterTag} onChange={setFilterTag} placeholder="Όλες οι ετικέτες"
              options={[{ value: '', label: 'Όλες οι ετικέτες' }, ...allTags.map(t => ({ value: t, label: t }))]} />
          </div>
        )}
        {/* Ταξινόμηση: δύο επιλογές, ορατές. Ένα αναδυόμενο μενού για δύο τιμές
            κρύβει τη μισή πληροφορία πίσω από ένα κλικ, χωρίς λόγο. */}
        {showTool('sort', contacts.length) && (
        <div style={{ display: 'flex', border: '1px solid var(--border-subtle)', borderRadius: T.radius.pill, overflow: 'hidden', background: 'var(--bg-elevated)', padding: 4, gap: 2 }}>
          {([['recent', 'Πρόσφατες'], ['alpha', 'Αλφαβητικά']] as const).map(([m, label]) => (
            /* `seg` επειδή η πίλλα γύρω έχει ήδη περίγραμμα: δεύτερο ανά πλακίδιο θα έδινε διπλή γραμμή. */
            <ChipToggle key={m} on={sortMode === m} onClick={() => setSortMode(m)} shape="seg">{label}</ChipToggle>
          ))}
        </div>
        )}
        {showTool('view', contacts.length) && (
        <div style={{ display: 'flex', border: '1px solid var(--border-subtle)', borderRadius: T.radius.pill, overflow: 'hidden', background: 'var(--bg-elevated)', padding: 4, gap: 2 }}>
          {(['cards', 'compact'] as ViewMode[]).map(v => (
            <ChipToggle key={v} on={viewMode === v} onClick={() => setViewMode(v)} shape="seg">{v === 'cards' ? 'Κάρτες' : 'Λίστα'}</ChipToggle>
          ))}
        </div>
        )}
      </div>
      )}

      {/* Ένα ευρετήριο έχει νόημα όταν τα γράμματα είναι λιγότερα από τις
          γραμμές. Με πέντε επαφές είναι απλώς δεύτερη λίστα από πάνω. */}
      {showTool('index', contacts.length) && (
        <AlphaRail entries={alphaIndex} active={letter} onPick={setLetterFilter} />
      )}

      {/* Η εμβέλεια είναι ερώτηση μόνο όταν υπάρχουν επαφές σε ΠΑΝΩ ΑΠΟ ΜΙΑ.
          Με όλες στο ίδιο ακίνητο, τα τρία κουμπιά δίνουν τρεις φορές την ίδια
          λίστα — και η ετικέτα «Εμβέλεια» δίπλα τους ονομάτιζε μια επιλογή που
          δεν υπήρχε. */}
      {isPro && scopeKinds > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Εμβέλεια</span>
          {([
            { id: 'all' as const, label: 'Όλες', Icon: Users },
            { id: 'portfolio' as const, label: 'Όλο το χαρτοφυλάκιο', Icon: Globe },
            { id: 'property' as const, label: 'Ανά ακίνητο', Icon: Building2 },
          ]).map(o => { const active = filterScope === o.id; const Ico = o.Icon; return (
            <ChipToggle key={o.id} on={active} onClick={() => setFilterScope(o.id)}>
              <Ico size={12} />{o.label}
            </ChipToggle>
          )})}
        </div>
      )}

      {/* Ένα chip φίλτρου που επιλέγει τα πάντα δεν φιλτράρει τίποτα: με μία
          μόνο ομάδα, η σειρά είναι ετικέτα μεταμφιεσμένη σε χειριστήριο. */}
      {groupsPresent.length >= SHOW_FROM.filter && (
      <div style={{ display: 'flex', gap: 8, marginBottom: T.sp.xl, flexWrap: 'wrap' }}>
        {groupsPresent.map(g => {
            const count = contacts.filter(c => roleMeta(c.role).groupId === g.id).length; const active = filterGroup === g.id; const GroupIcon = g.Icon
            return (
              <ChipToggle key={g.id} on={active} onClick={() => setFilterGroup(active ? 'all' : g.id)}>
                <GroupIcon size={12} />{g.label}<span style={{ background: active ? 'var(--border-raised)' : 'var(--bg-elevated)', color: active ? 'var(--text-primary)' : 'var(--text-secondary)', borderRadius: T.radius.pill, padding: '1px 7px', fontSize: 'var(--fs-xs)', fontWeight: 700 }}>{count}</span>
              </ChipToggle>
            )
          })}
      </div>
      )}

      {/* Η ΓΡΑΜΜΗ ΤΟΥ ΠΛΗΘΟΥΣ. Το δεύτερο κουμπί εξαγωγής που καθόταν εδώ έφυγε:
          η κεφαλίδα προσφέρει ήδη Excel, PDF και vCard — τρεις μορφές, ένα
          σημείο. Στη θέση του μπήκε η μαζική επιλογή, δηλαδή ό,τι αφορά ΑΥΤΕΣ
          τις επαφές, δίπλα στο πλήθος τους. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: T.font.sans }}>
          {processed.length === contacts.length
            ? `${fn(contacts.length)} ${contacts.length === 1 ? 'επαφή' : 'επαφές'}`
            : `${fn(processed.length)} από ${fn(contacts.length)}`}
        </span>
        {!bulkMode && showTool('bulk', processed.length) && (
          <LinkBtn onClick={() => { setBulkMode(true); setSelected(new Set()) }}>Επιλογή πολλαπλών</LinkBtn>
        )}
      </div>
      </>)}

      {loading ? (
        // Ο γυμνός Spinner δεν προδιέγραφε τίποτα: μόλις έρχονταν τα δεδομένα, τα
        // KPIs και η λίστα εμφανίζονταν μαζί και η σελίδα πηδούσε. Το σχήμα είναι
        // γνωστό (4 μετρικές + λίστα επαφών), άρα ο σκελετός κρατά το ύψος.
        <>
          <SkeletonKPIs n={4} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[0, 1, 2, 3, 4].map(i => <Skeleton key={i} h={54} r={10} />)}</div>
        </>
      ) : contacts.length === 0 ? (
        // Η βοήθεια έλεγε ΤΑ ΙΔΙΑ με τα δύο πλακίδια από κάτω, σε προστακτική και
        // με τη λίστα των πεδίων δύο φορές. Λέει τώρα ΜΟΝΟ αυτό που δεν λένε τα
        // πλακίδια: τι κάνει η σάρωση και ποιος αποφασίζει τελικά.
        // ΚΑΙ ΤΟ «ΤΟΥ» ΔΕΝ ΕΙΧΕ ΣΕ ΤΙ ΝΑ ΑΝΑΦΕΡΘΕΙ. Η υπόδειξη έλεγε «η κάρτα ή
        // ένα τιμολόγιό του», τρεις λέξεις κάτω από τον τίτλο «Καμία επαφή
        // ακόμη»: δεν έχει προηγηθεί κανένα πρόσωπο στην οθόνη. Ονομάζεται.
        // Ο υπότιτλος του πλακιδίου έλεγε πάλι «Κάρτα ή τιμολόγιο του
        // συνεργάτη», ακριβώς από κάτω· κρατά πια ό,τι ΔΕΝ λέει η υπόδειξη,
        // δηλαδή από πού έρχεται η φωτογραφία.
        <EmptyState
          icon={<Users size={20} />}
          title="Καμία επαφή ακόμη"
          hint="Η κάρτα ή ένα τιμολόγιο του συνεργάτη διαβάζεται και συμπληρώνει τα πεδία, μαζί με το IBAN. Τίποτα δεν αποθηκεύεται πριν το ελέγξεις."
          action={<div className="route-two" style={contactRouteGrid}>
            <ContactActionTile Icon={Camera} label="Σάρωσε" sub={scanning ? 'Ανάλυση…' : 'Με την κάμερα ή από αρχείο'} onClick={() => cardRef.current?.click()} primary />
            {/* «Τέσσερα πεδία» ήταν σωστό και αόριστο: τα πεδία ονομάζονται, όσα
                χωρούν σε μία γραμμή, ώστε ο χρήστης να ξέρει τι τον περιμένει. */}
            <ContactActionTile Icon={UserPlus} label="Καταχώρησε" sub="Όνομα, τηλέφωνο, ΑΦΜ" onClick={openAdd} />
          </div>}
        />
      ) : processed.length === 0 ? (
        <EmptyState icon={<SearchX size={20} />} title="Δεν βρέθηκαν επαφές"
          hint={letter ? `Καμία επαφή στο «${letter}» με τα ενεργά φίλτρα.` : 'Ο συνδυασμός αναζήτησης, κατηγορίας και φίλτρων δεν αφήνει καμία επαφή.'}
          action={<Btn variant="secondary" onClick={() => { setSearch(''); setFilterGroup('all'); setFilterTag(''); setLetterFilter(null); setAttention(null) }}>Καθαρισμός φίλτρων</Btn>} />
      ) : viewMode === 'compact' ? (
        <div style={{ background: 'var(--bg-surface)', borderRadius: T.radius.card, border: '1px solid var(--border-subtle)', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ minWidth: CONTACT_ROW_MIN }}>
          <div style={{ display: 'flex', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}>
            {bulkMode && <div style={{ width: 18, flexShrink: 0 }} />}
            <div style={{ width: 8, flexShrink: 0 }} />
            <div style={{ width: 200, minWidth: 120, flexShrink: 1, fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Όνομα</div>
            <div style={{ width: 140, minWidth: 100, flexShrink: 1, fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Τηλέφωνο</div>
            <div style={{ flex: 1, minWidth: 160, fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Ηλεκτρονικό ταχυδρομείο</div>
            <div style={{ width: 120, flexShrink: 0, fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Ετικέτες</div>
            <div style={{ width: 120, minWidth: 90, flexShrink: 1, fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>ΑΦΜ</div>
            {/* Η στήλη των ενεργειών υπάρχει και στην κεφαλίδα, αλλιώς όλες οι
                από πάνω της στέκονται 306 εικονοστοιχεία αριστερότερα από τα
                δεδομένα τους. Κενή, γιατί οι ενέργειες δεν έχουν όνομα. */}
            <div style={{ width: CONTACT_ACTIONS_W, flexShrink: 0 }} />
          </div>
          {processed.map(c => <CompactRow key={c.id} contact={c} onOpen={() => setDetailId(c.id)} onEdit={() => openEdit(c)} onDelete={() => askDelete(c)} selected={selected.has(c.id)} onSelect={() => toggleSelect(c.id)} bulkMode={bulkMode} scopePortfolio={isPro && scopeIsPortfolio(c)} />)}
          </div>
        </div>
      ) : letter || sortMode === 'alpha' ? (
        <div data-list style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 310px), 1fr))', gap: 14 }}>
          {processed.map(c => (
            <ContactCard key={c.id} contact={c} onOpen={() => setDetailId(c.id)} onEdit={() => openEdit(c)} onDelete={() => askDelete(c)} onQuickExpense={() => setQuickExpense(c)} onQuickCalendar={() => setQuickCalendar(c)} onShowHistory={() => setHistoryContact(c)} onShowQR={() => setQrContact(c)} selected={selected.has(c.id)} onSelect={() => toggleSelect(c.id)} bulkMode={bulkMode} branding={branding} scopeLabel={scopeLabelFor(c)} scopePortfolio={scopeIsPortfolio(c)} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
          {GROUPS.filter(g => groupedFiltered[g.id]?.length).map(g => (
            <div key={g.id}>
              <GroupDivider group={g} count={groupedFiltered[g.id].length} />
              <div data-list style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 310px), 1fr))', gap: 14 }}>
                {groupedFiltered[g.id].map(c => (
                  <ContactCard key={c.id} contact={c} onOpen={() => setDetailId(c.id)} onEdit={() => openEdit(c)} onDelete={() => askDelete(c)} onQuickExpense={() => setQuickExpense(c)} onQuickCalendar={() => setQuickCalendar(c)} onShowHistory={() => setHistoryContact(c)} onShowQR={() => setQrContact(c)} selected={selected.has(c.id)} onSelect={() => toggleSelect(c.id)} bulkMode={bulkMode} branding={branding} scopeLabel={scopeLabelFor(c)} scopePortfolio={scopeIsPortfolio(c)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Η ΣΕΙΡΑ ΤΟΥ DOM ΕΙΝΑΙ Η ΣΕΙΡΑ ΤΩΝ ΕΠΙΠΕΔΩΝ ────────────────────────
          Το ντοσιέ ήταν γραμμένο ΜΕΤΑ τα παράθυρα, όταν κουβαλούσε δικό του
          z-index 900 και τα παράθυρα 1000–1300: η αριθμητική το κρατούσε από
          κάτω ό,τι σειρά κι αν είχε. Τα κοινά Modal και SideSheet έχουν ΤΟ ΙΔΙΟ
          z-index (1000) — άρα κερδίζει όποιο έρχεται τελευταίο στο DOM και το
          ντοσιέ σκέπαζε τη φόρμα επεξεργασίας που άνοιγε το ίδιο του το κουμπί
          «Επεξεργασία». Ανεβαίνει εδώ, πριν από όσα ανοίγουν ΠΑΝΩ του. */}
      {detail && <ContactDossier contact={detail} propertyId={propertyId} branding={branding} onVcard={() => downloadVcf([detail], (detail.full_name || 'epafi').replace(/[^\w.\-]+/g, '_') + '.vcf')} onClose={() => setDetailId(null)}
        onEdit={() => openEdit(detail)}
        onDelete={() => askDelete(detail)}
        onQuickExpense={() => setQuickExpense(detail)}
        onQuickCalendar={() => setQuickCalendar(detail)}
        onShowHistory={() => setHistoryContact(detail)}
        onShowQR={() => setQrContact(detail)} refreshKey={dossierRefresh} />}

      {/* MODAL */}
      {showModal && (() => {
        // Το εικονίδιο της κατηγορίας μπαίνει στην υποδοχή `icon` του Modal, που
        // ήδη δίνει το τετράγωνο accent-soft — το χειρόγραφο 36×36 πλαίσιο ήταν
        // αντίγραφό του με άλλη ακτίνα.
        const formRole = ROLE_META[form.role]
        const RoleIcon = formRole?.GroupIcon || Users
        return (
        <Modal open onClose={requestCloseModal}
          title={editContact ? 'Επεξεργασία επαφής' : 'Νέα επαφή'}
          subtitle={editContact ? editContact.full_name : undefined}
          icon={formRole ? <RoleIcon size={17} /> : undefined}
          size="md"
          footer={<>
            <Btn onClick={requestCloseModal} disabled={saving}>Ακύρωση</Btn>
            <Btn variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Αποθήκευση…' : editContact ? 'Αποθήκευση αλλαγών' : 'Προσθήκη επαφής'}
            </Btn>
          </>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* ── Στοιχεία ──
                Ποια πεδία υπάρχουν εδώ το ορίζει το CONTACT_FIELDS και κάθε ένα
                δείχνει ΓΡΑΜΜΕΝΟ το γιατί το ζητάμε. Η φωτογραφία επαφής έφυγε:
                ένα πορτρέτο του υδραυλικού δεν κάνει τίποτα και ήταν το πρώτο
                πράγμα που έβλεπε ο χρήστης ανοίγοντας τη φόρμα. */}
            {/* ΤΟ ΜΕΓΕΘΟΣ ΤΟΥ ΚΟΥΤΙΟΥ ΕΙΝΑΙ ΥΠΟΣΧΕΣΗ ΓΙΑ ΤΟ ΠΕΡΙΕΧΟΜΕΝΟ ΤΟΥ.
                Ηταν τέσσερα κουτιά το ένα κάτω από το άλλο, καθένα 550
                εικονοστοιχεία σε ταμπλέτα: πεντακόσια πενήντα για δέκα ψηφία
                τηλεφώνου και άλλα τόσα για εννιά του ΑΦΜ. Η φόρμα διαβαζόταν
                σαν να ζητά κείμενο εκεί που ζητά αριθμό· χρειαζόταν και κύλιση
                για τέσσερα πεδία.

                Το όνομα κρατά ολόκληρο το πλάτος, γιατί όντως το θέλει. Τα
                τρία σύντομα μπαίνουν σε μία σειρά των 170: το κουτί λέει
                πλέον την αλήθεια για το τι χωρά και η φόρμα χωρά ολόκληρη σε
                μία οθόνη. Σε κινητό η σειρά σπάει μόνη της. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <CField d={cf('contact.name')} required>
                <Inp value={form.full_name} onChange={v => setForm(f => ({ ...f, full_name: v }))} placeholder="Γιώργος Παπαδόπουλος" />
              </CField>
              <div {...fieldRow(160, 16, { alignItems: 'start' })}>
                <CField d={cf('contact.role')}>
                  <CustomSelect ariaLabel="Ρόλος επαφής" value={form.role} onChange={v => setForm(f => ({ ...f, role: v }))}
                    options={ROLE_SELECT_OPTIONS.filter(o => !o.disabled).map(o => ({ value: o.value, label: o.label }))} />
                  {isOtherRole(form.role) && <div style={{ marginTop: 10 }}><Inp value={roleOther} onChange={setRoleOther} placeholder="Κατηγορία" /></div>}
                </CField>
                <CField d={cf('contact.phone')}>
                  <Inp value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} placeholder="2101234567" />
                </CField>
                {/* ΤΟ ΑΦΜ ΕΙΝΑΙ CORE. Είναι το μόνο πεδίο που συνδέει την επαφή με τα
                    παραστατικά της: χωρίς αυτό το ταίριασμα γίνεται με το όνομα και
                    αστοχεί σε κάθε «Συντήρηση — Παπαδόπουλος». */}
                <CField d={cf('contact.afm')}>
                  <Inp value={form.extra.afm || ''} onChange={v => setExtra('afm', v.replace(/\D/g, '').slice(0, 9))} placeholder="123456789" />
                </CField>
              </div>
            </div>

            {/* ── Πτυσσόμενες λεπτομέρειες ── */}
            {/* ΜΕΝΕΙ ΧΕΙΡΟΠΟΙΗΤΟ: ίδιος λόγος με τη ζώνη προσθήκης αρχείου — το
                διακεκομμένο περίγραμμα της αποκάλυψης δεν υπάρχει στο Btn. */}
            <button type="button" onClick={() => setShowMore(m => !m)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 0', border: '1px dashed var(--border-default)', borderRadius: T.radius.inner, background: 'transparent', color: 'var(--text-secondary)', fontSize: 'var(--fs-base)', fontWeight: 600, cursor: 'pointer', fontFamily: T.font.sans }}>
              {showMore ? 'Λιγότερες λεπτομέρειες' : 'Περισσότερες λεπτομέρειες'}
              <svg aria-hidden="true" width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showMore ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><path d="m6 9 6 6 6-6" /></svg>
            </button>

            {showMore && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <SecHead>Επικοινωνία και πληρωμές</SecHead>
                  <div {...fieldRow(190, 16, { alignItems: 'start' })}>
                    <CField d={cf('contact.email')}>
                      <Inp value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} placeholder="info@example.gr" />
                    </CField>
                    <CField d={cf('contact.mobile')}>
                      <Inp value={form.extra.phone2 || ''} onChange={v => setExtra('phone2', v)} placeholder="6941234567" />
                    </CField>
                  </div>
                  <CField d={cf('contact.messaging')}>
                    <div style={{ display: 'flex', gap: T.sp.xl, flexWrap: 'wrap', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-surface)', borderRadius: T.radius.inner, border: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Toggle on={!!form.extra.whatsapp} onChange={v => setExtra('whatsapp', v)} ariaLabel="WhatsApp" /><span style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-primary)' }}>WhatsApp</span></div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Toggle on={!!form.extra.viber} onChange={v => setExtra('viber', v)} ariaLabel="Viber" /><span style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-primary)' }}>Viber</span></div>
                    </div>
                  </CField>
                  <CField d={cf('contact.iban')}>
                    <Inp value={form.extra.iban || ''} onChange={v => setExtra('iban', v)} placeholder="GR16 0110 1250 0000 0001 2300 695" />
                  </CField>
                  <CField d={cf('contact.iris')}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-surface)', borderRadius: T.radius.inner, border: '1px solid var(--border-subtle)' }}>
                      <span style={{ fontSize: 'var(--fs-base)', color: 'var(--text-primary)' }}>Δέχεται πληρωμή με IRIS</span>
                      <Toggle on={!!form.extra.iris} onChange={v => setExtra('iris', v)} ariaLabel="Δέχεται πληρωμή με IRIS" />
                    </div>
                  </CField>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <SecHead>Στοιχεία συνεργάτη</SecHead>
                  <div {...fieldRow(190, 16, { alignItems: 'start' })}>
                    <CField d={cf('contact.specialty')}>
                      <Inp value={form.extra.specialty || ''} onChange={v => setExtra('specialty', v)} placeholder="Ειδικός σε κεντρική θέρμανση" />
                    </CField>
                    <CField d={cf('contact.website')}>
                      <Inp value={form.extra.website || ''} onChange={v => setExtra('website', v)} placeholder="www.example.gr" />
                    </CField>
                  </div>
                  {/* ΑΠΛΟ ΠΕΔΙΟ ΚΕΙΜΕΝΟΥ. Ήταν autocomplete που έστελνε κάθε
                      πληκτρολόγηση σε τρίτο εξυπηρετητή — διεύθυνση γραφείου
                      τρίτου προσώπου, εκτός της υποδομής μας. */}
                  <div {...fieldRow(190, 16, { alignItems: 'start' })}>
                    <CField d={cf('contact.address')}>
                      <Inp value={form.extra.office_address || ''} onChange={v => setExtra('office_address', v)} placeholder="Οδός, αριθμός, πόλη" />
                    </CField>
                    <CField d={cf('contact.next_appointment')}>
                      <DatePicker value={form.extra.next_appointment || ''} onChange={v => setExtra('next_appointment', v)} />
                    </CField>
                  </div>
                  <CField d={cf('contact.scope')}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {([{ v: 'property' as const, label: 'Συγκεκριμένο ακίνητο', Icon: Building2 }, { v: 'portfolio' as const, label: 'Όλο το χαρτοφυλάκιο', Icon: Globe }]).map(o => {
                        const active = (form.extra.scope || 'property') === o.v; const Ico = o.Icon; return (
                          <ChipToggle key={o.v} on={active} onClick={() => setExtra('scope', o.v)}>
                            <Ico size={14} />{o.label}
                          </ChipToggle>
                        )
                      })}
                    </div>
                    {(form.extra.scope || 'property') !== 'portfolio' && properties.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <CustomSelect ariaLabel="Ακίνητο" value={form.extra.scope_property_id || propertyId} onChange={v => setExtra('scope_property_id', v)}
                          options={properties.map(p => ({ value: p.id, label: p.name }))} />
                      </div>
                    )}
                  </CField>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-surface)', borderRadius: T.radius.inner, border: '1px solid var(--border-subtle)' }}>
                    <div><div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Προτιμώμενη επαφή</div><div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Ανεβαίνει στη γρήγορη πρόσβαση, για να τη βρίσκεις αμέσως</div></div>
                    <Toggle on={!!form.extra.preferred} onChange={v => setExtra('preferred', v)} ariaLabel="Προτιμώμενη επαφή" />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <SecHead>Σημειώσεις και αρχεία</SecHead>
                  <CField d={cf('contact.tags')}>
                    <TagEditor tags={form.extra.tags || []} onChange={v => setExtra('tags', v)} />
                  </CField>
                  <CField d={cf('contact.notes')}>
                    <Txt value={form.freeNotes} onChange={v => setForm(f => ({ ...f, freeNotes: v }))} placeholder="Ιστορικό, τιμές, συμφωνίες…" rows={4} />
                  </CField>
                  <CField d={cf('contact.files')}>
                    <FileUploader files={form.extra.files || []} onChange={v => setExtra('files', v)} contactId={editContact?.id} />
                  </CField>
                </div>
              </>
            )}
          </div>
          {error && <div style={{ background: 'var(--negative-soft)', border: '1px solid var(--negative-border)', borderRadius: T.radius.inner, padding: '11px 16px', color: 'var(--negative)', fontSize: 'var(--fs-base)' }}>{error}</div>}
        </Modal>
        )
      })()}

      {/* ΤΟ ΠΑΡΑΘΥΡΟ ΔΙΑΓΡΑΦΗΣ ΕΦΥΓΕ ΜΑΖΙ ΜΕ ΤΗΝ ΚΑΤΑΣΤΑΣΗ ΤΟΥ. Ήταν εικονίδιο,
          μία ερώτηση, μία πρόταση και δύο κουμπιά — ακριβώς ο ορισμός του
          confirmDialog. Η κατάσταση `deleteId` υπήρχε ΜΟΝΟ για να το ανοίγει,
          οπότε σβήστηκε και αυτή: η ερώτηση ζει τώρα μέσα στο `askDelete`. */}

      {dup && (
        <Modal open onClose={requestCloseDup} title="Υπάρχει ήδη παρόμοια επαφή" size="sm"
          footer={<>
            <Btn onClick={requestCloseDup} disabled={saving}>Ακύρωση</Btn>
            <Btn onClick={() => persist('insert')} disabled={saving}>Ξεχωριστή</Btn>
            <Btn variant="primary" onClick={() => persist('merge', dup)} disabled={saving}>{saving ? 'Συγχώνευση…' : 'Συγχώνευση'}</Btn>
          </>}>
          {/* ΔΕΝ ΕΙΝΑΙ ΕΡΩΤΗΣΗ ΝΑΙ/ΟΧΙ, ΑΡΑ ΔΕΝ ΕΙΝΑΙ confirmDialog: οι απαντήσεις
              είναι ΤΡΕΙΣ (ακύρωση, ξεχωριστή εγγραφή, συγχώνευση) και ανάμεσά
              τους στέκει η καρτέλα της επαφής που βρέθηκε — χωρίς αυτήν ο
              χρήστης δεν ξέρει ΜΕ ΠΟΙΑΝ θα συγχωνεύσει. */}
          <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 }}>Βρέθηκε επαφή με το ίδιο τηλέφωνο ή ΑΦΜ. Θέλεις να τη συγχωνεύσεις (να συμπληρωθούν τα νέα στοιχεία) ή να δημιουργήσεις ξεχωριστή εγγραφή;</p>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.inner, padding: '12px 14px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{dup.full_name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {dup.phone && <span style={{ fontFamily: T.font.mono }}>{dup.phone}</span>}
              {dup._extra?.afm && <span title="Αριθμός Φορολογικού Μητρώου">ΑΦΜ {dup._extra.afm}</span>}
            </div>
          </div>
        </Modal>
      )}

      {quickExpense && <QuickExpenseModal contact={quickExpense} propertyId={propertyId} userId={userId} onClose={() => setQuickExpense(null)} onSaved={() => { notifyOk('Δαπάνη αποθηκεύτηκε'); setDossierRefresh(x => x + 1) }} />}
      {quickCalendar && <QuickCalendarModal contact={quickCalendar} propertyId={propertyId} userId={userId} onClose={() => setQuickCalendar(null)} onSaved={(date) => { linkAppointmentToContact(quickCalendar, date); notifyOk('Ραντεβού προστέθηκε, καταχωρήθηκε και στην επαφή') }} />}
      {historyContact && <HistoryModal contact={historyContact} propertyId={propertyId} onClose={() => setHistoryContact(null)} />}
      {qrContact && <QRCodeModal contact={qrContact} onClose={() => setQrContact(null)} />}
    </div>
  )
}