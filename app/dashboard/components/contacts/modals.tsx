'use client'
// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΠΑΡΑΘΥΡΑ ΤΩΝ ΕΠΑΦΩΝ: ΑΡΧΕΙΑ, QR, ΙΣΤΟΡΙΚΟ, ΓΡΗΓΟΡΗ ΔΑΠΑΝΗ Ή ΓΕΓΟΝΟΣ
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect, useRef } from 'react'
import { qrDataUrl } from '@/lib/qr'
import * as expenseStore from '@/lib/data/expenses'
import * as calendar from '@/lib/data/calendar'
import { X, FileText, QrCode, History, Receipt, CalendarPlus } from 'lucide-react'
import { DatePicker } from '../UIComponents'
import {
  T, Btn, IconBtn, EmptyState, fe, Skeleton, SkeletonKPIs, ABSENT_SHORT, Modal, RuntimeImg,
} from '@/components/Theme'
import { notifyError } from '@/components/Toast'
import { saved } from '@/components/dbWrite'
import { uploadUserScoped } from '@/lib/storage/scopedUpload'
import { uploadPath } from '@/lib/core/uploadPath'
import { CONTACT_BUCKET, removeFiles, linkFor, type ContactFile } from '@/lib/storage/contactFiles'
import { athensToday, isoDate } from '@/lib/core/time'
import { supabase, type Contact, fmtDate, digitsOf, fetchSupplierDocs, type SupplierDoc } from './model'
import { Inp, FL } from './Bits'

// ─── Notes Log ────────────────────────────────────────────────────────────────
// Το «ανέβασμα φωτογραφίας επαφής» έφυγε από τη φόρμα: ήταν το ΠΡΩΤΟ πράγμα που
// έβλεπε ο χρήστης όταν καταχωρούσε υδραυλικό και δεν κάνει τίποτα. Όσες επαφές
// έχουν ήδη φωτογραφία συνεχίζουν να τη δείχνουν στην κάρτα και στο ντοσιέ.

// ─── File Uploader ────────────────────────────────────────────────────────────
export function FileUploader({ files, onChange, contactId }: { files: ContactFile[]; onChange: (f: ContactFile[]) => void; contactId?: string }) {
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return; setUploading(true)
    // ΙΔΙΩΤΙΚΟΣ ΚΑΔΟΣ, ΚΑΙ ΑΠΟΘΗΚΕΥΕΤΑΙ ΤΟ ΜΟΝΟΠΑΤΙ ΑΝΤΙ ΓΙΑ ΤΗ ΔΙΕΥΘΥΝΣΗ. Ο
    // «avatars» είναι δηλωμένος δημόσιος: το μισθωτήριο και το τιμολόγιο με το
    // ΑΦΜ κατέβαιναν από οποιονδήποτε ήξερε τη διεύθυνση.
    // ΤΟ ΜΟΝΟΠΑΤΙ ΒΓΑΙΝΕΙ ΑΠΟ ΤΗΝ ΙΔΙΑ ΣΥΝΑΡΤΗΣΗ ΜΕ ΤΑ ΑΛΛΑ ΔΥΟ ΣΗΜΕΙΑ. Ηταν
    // γραμμένο εδώ με το χέρι, παίρνοντας την ΚΑΤΑΛΗΞΗ ωμή από το όνομα που
    // διάλεξε ο χρήστης (`file.name.split('.').pop()`) — δηλαδή κείμενο του
    // χρήστη μέσα σε μονοπάτι αποθήκευσης, στο μόνο από τα τρία σημεία που δεν
    // περνούσε από το `uploadPath()`. Το `uploadPath` μεταγράφει τα ελληνικά,
    // κόβει τα «..», κρατά μοναδικό επίθεμα και δίνει ΟΛΟΚΛΗΡΟ το όνομα αντί
    // για μια χρονοσφραγίδα: ο λογιστής που κατεβάζει τον φάκελο βλέπει
    // «μισθωτήριο.pdf» και όχι «1757386421.pdf».
    const { path, error } = await uploadUserScoped(supabase, CONTACT_BUCKET, uploadPath(file.name, `contact-files/${contactId || 'new'}`), file, { upsert: true, contentType: file.type || undefined })
    if (error) notifyError('Το αρχείο δεν ανέβηκε')
    else onChange([...files, { name: file.name, url: '', path, size: file.size > 1048576 ? `${(file.size / 1048576).toFixed(1)} MB` : `${(file.size / 1024).toFixed(0)} KB`, uploaded: new Date().toISOString() }])
    setUploading(false); if (fileRef.current) fileRef.current.value = ''
  }

  // ΤΟ «Χ» ΣΒΗΝΕΙ ΚΑΙ ΤΟ ΑΡΧΕΙΟ, ΟΧΙ ΜΟΝΟ ΤΗ ΓΡΑΜΜΗ. Πριν, το αντικείμενο
  // έμενε στον κάδο για πάντα και ο χρήστης δεν είχε πια τρόπο να το βρει.
  const drop = async (i: number) => {
    const gone = files[i]
    onChange(files.filter((_, j) => j !== i))
    const failed = await removeFiles(supabase, [gone])
    if (failed) notifyError('Η γραμμή αφαιρέθηκε αλλά το αρχείο δεν σβήστηκε')
  }

  // Ο σύνδεσμος υπογράφεται τη στιγμή που τον ζητά ο χρήστης και ζει μία ώρα.
  const open = async (f: ContactFile) => {
    const href = await linkFor(supabase, f)
    if (href) window.open(href, '_blank', 'noopener')
    else notifyError('Το αρχείο δεν άνοιξε')
  }
  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {/* ΤΕΣΣΕΡΑ ΚΕΙΜΕΝΑ ΓΙΑ ΝΑ ΠΕΙ ΚΑΝΕΙΣ «ΑΝΕΒΑΣΕ ΕΝΑ ΑΡΧΕΙΟ». Με άδεια λίστα, η
            οθόνη έγραφε τίτλο («Κανένα αρχείο ακόμη»), υπότιτλο («Ανέβασε συμβόλαια,
            τιμολόγια ή φωτογραφίες που αφορούν αυτή την επαφή»), το κουμπί
            («+ Προσθήκη Αρχείου») και από κάτω μια τέταρτη σειρά με το «γιατί» του
            μητρώου. Το κουμπί λέει ήδη και τι κάνει και τι δέχεται· τα άλλα τρία
            ήταν εκατόν είκοσι εικονοστοιχεία για να το επαναλάβουν. Μένει το κουμπί. */}
        {files.map((f, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg-surface)', borderRadius: T.radius.inner, border: '1px solid var(--border-subtle)' }}>
            <FileText size={16} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: T.font.mono }}>{f.size} · {new Date(f.uploaded).toLocaleDateString('el-GR')}</div>
            </div>
            <Btn variant="ghost" onClick={() => open(f)}>Άνοιγμα</Btn>
            <IconBtn label={`Αφαίρεση αρχείου: ${f.name}`} title="Αφαίρεση" onClick={() => drop(i)}><X size={15} /></IconBtn>
          </div>
        ))}
      </div>
      {/* ΜΕΝΕΙ ΧΕΙΡΟΠΟΙΗΤΟ: το διακεκομμένο περίγραμμα είναι η «ζώνη προσθήκης» —
          δεν υπάρχει σε καμία παραλλαγή του Btn ούτε περνά className. */}
      <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 16px', borderRadius: T.radius.inner, border: '1px dashed var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 'var(--fs-base)', width: '100%' }}>
        {uploading ? 'Ανέβασμα…' : '+ Προσθήκη Αρχείου (PDF, DOC, JPG, Excel)'}
      </button>
      <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.xls,.csv" onChange={handleFile} style={{ display: 'none' }} />
    </div>
  )
}

// ─── QR Modal ─────────────────────────────────────────────────────────────────
export function QRCodeModal({ contact, onClose }: { contact: Contact; onClose: () => void }) {
  const vcard = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${contact.full_name}`, contact.phone ? `TEL:${contact.phone}` : '', contact.email ? `EMAIL:${contact.email}` : '', contact._extra?.website ? `URL:${contact._extra.website}` : '', 'END:VCARD'].filter(Boolean).join('\n')
  // QR τοπικά: η κάρτα επαφής (όνομα, τηλέφωνο, email) δεν φεύγει από τη συσκευή.
  const qrUrl = qrDataUrl(vcard, { size: 240 })
  return (
    <Modal open onClose={onClose} title="QR Επαφής" subtitle="Σάρωσε για να αποθηκεύσεις τα στοιχεία"
      icon={<QrCode size={17} />} size="sm" footer={<Btn onClick={onClose}>Κλείσιμο</Btn>}>
      <div style={{ textAlign: 'center' }}>
        {/* ΤΟ ΜΟΝΟ ΚΥΡΙΟΛΕΚΤΙΚΟ ΛΕΥΚΟ ΤΟΥ ΑΡΧΕΙΟΥ, ΚΑΙ ΜΕ ΛΟΓΟ: ο κώδικας QR
            διαβάζεται από τη ΔΙΑΦΟΡΑ φωτεινότητας. Με token επιφάνειας, στο
            σκούρο θέμα το πλαίσιο γίνεται σκούρο και η κάμερα δεν βρίσκει τα
            τρία τετράγωνα εντοπισμού — ο κώδικας παύει να σαρώνεται. */}
        <div style={{ padding: T.sp.md, background: 'var(--qr-paper)', borderRadius: T.radius.card, border: '1px solid var(--border-subtle)', display: 'inline-block' }}>
          <RuntimeImg src={qrUrl} alt="QR" style={{ width: 190, height: 190, borderRadius: T.radius.xs, display: 'block' }} />
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginTop: T.sp.lg }}>{contact.full_name}</div>
        {contact.phone && <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: T.font.mono, marginTop: 4 }}>{contact.phone}</div>}
      </div>
    </Modal>
  )
}

// ─── History Modal ────────────────────────────────────────────────────────────
export function HistoryModal({ contact, propertyId, onClose }: { contact: Contact; propertyId: string; onClose: () => void }) {
  const [expenses, setExpenses] = useState<{ id: string; description: string; amount: number; date: string }[]>([])
  const [docs, setDocs] = useState<SupplierDoc[]>([])
  const [loading, setLoading] = useState(true)
  const afm = digitsOf(contact._extra?.afm)
  useEffect(() => {
    async function load() {
      setLoading(true)
      // 1) contact_id: το σωστό, για ό,τι καταχωρήθηκε μέσα από την επαφή.
      // 2) όνομα: εφεδρεία για παλιές δαπάνες, γι' αυτό και δεν είναι μόνη της.
      const nm = (contact.full_name || '').replace(/[,()*%\\]/g, ' ').trim()
      const filter = nm.length >= 3 ? `contact_id.eq.${contact.id},description.ilike.*${nm}*` : `contact_id.eq.${contact.id}`
      const [data, d] = await Promise.all([
        expenseStore.ledger<{ id: string; description: string; amount: number; date: string }>(supabase, propertyId, { columns: 'id,description,amount,date', or: filter, order: { column: 'date', ascending: false }, limit: 20 }),
        fetchSupplierDocs(afm, propertyId),
      ])
      setExpenses(data || []); setDocs(d); setLoading(false)
    }
    load()
  }, [contact.id, propertyId, contact.full_name, afm])
  const notesLog = contact._extra?.notes_log || []
  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0)
  const docsTotal = docs.reduce((s, d) => s + (d.amount || 0), 0)
  const timeline = [
    ...expenses.map(e => ({ date: e.date, title: e.description, sub: fe(e.amount ?? 0), color: 'var(--text-secondary)' })),
    ...docs.map(d => ({ date: (d.issue_date || d.doc_date || '').slice(0, 10), title: d.title || d.category || 'Παραστατικό', sub: d.amount ? fe(d.amount) : 'Παραστατικό', color: 'var(--accent)' })),
    ...notesLog.map(n => ({ date: n.ts.split('T')[0], title: n.text, sub: 'Σημείωση', color: 'var(--accent)' })),
  ].filter(x => x.date).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20)
  return (
    <Modal open onClose={onClose} title="Ιστορικό συνεργασίας" subtitle={contact.full_name} icon={<History size={17} />} size="md">
      {loading ? (
        <div><SkeletonKPIs n={3} />{[0, 1, 2].map(i => <Skeleton key={i} h={48} r={10} style={{ marginBottom: 12 }} />)}</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 10 }}>
            {[{ label: 'Συνολικές Δαπάνες', value: totalExpenses > 0 ? fe(totalExpenses) : fe(0), color: 'var(--text-primary)' },
              { label: 'Παραστατικά με το ΑΦΜ του', value: docs.length > 0 ? `${docs.length}${docsTotal > 0 ? ' · ' + fe(docsTotal) : ''}` : (afm.length === 9 ? '0' : ABSENT_SHORT), color: 'var(--text-primary)' },
              { label: 'Σημειώσεις', value: notesLog.length > 0 ? `${notesLog.length}` : '0', color: 'var(--text-primary)' }].map(s => (
              <div key={s.label} style={{ background: 'var(--bg-surface)', borderRadius: T.radius.inner, padding: '14px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: s.color, fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums', marginBottom: 4 }}>{s.value}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
              </div>
            ))}
          </div>
          {afm.length !== 9 && (
            <div style={{ padding: '11px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.inner, fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              Χωρίς ΑΦΜ, τα παραστατικά αυτού του παρόχου δεν συνδέονται με την επαφή: το ταίριασμα γίνεται με το όνομα και αστοχεί. Συμπλήρωσέ το μία φορά στην επεξεργασία της επαφής.
            </div>
          )}
          {timeline.length === 0 ? <EmptyState icon={<History size={20} />} title="Καμία κίνηση ακόμη" hint="Δαπάνες, παραστατικά με το ΑΦΜ του και σημειώσεις εμφανίζονται εδώ χρονολογικά." /> : (
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 15, top: 0, bottom: 0, width: 1, background: 'var(--border-subtle)' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {timeline.map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'color-mix(in srgb, ' + item.color + ' 14%, transparent)', border: '1px solid color-mix(in srgb, ' + item.color + ' 34%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} /></div>
                    <div style={{ flex: 1, background: 'var(--bg-surface)', borderRadius: T.radius.inner, padding: '9px 13px', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text-primary)', fontWeight: 500, marginBottom: 2 }}>{item.title}</div>
                      <div style={{ display: 'flex', gap: 10 }}><span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: T.font.mono }}>{fmtDate(item.date)}</span><span style={{ fontSize: 'var(--fs-xs)', color: item.color, fontWeight: 600 }}>{item.sub}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  )
}

// ─── Quick Modals ─────────────────────────────────────────────────────────────
export function QuickExpenseModal({ contact, propertyId, userId, onClose, onSaved }: { contact: Contact; propertyId: string; userId: string; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState(''); const [description, setDescription] = useState(contact.full_name); const [saving, setSaving] = useState(false)
  // ΦΡΟΥΡΑ ΚΛΕΙΣΙΜΑΤΟΣ. Το χειρόγραφο παράθυρο ΔΕΝ έκλεινε ούτε με Escape ούτε
  // με κλικ στο φόντο — το Modal δίνει και τα δύο. Χωρίς φρουρά, ένα Escape στη
  // μέση της εγγραφής ξεφορτώνει τη φόρμα ενώ η καταχώρηση συνεχίζει.
  const close = () => { if (!saving) onClose() }
  const save = async () => {
    if (!amount) return
    setSaving(true)
    const ok = await saved('Η δαπάνη δεν αποθηκεύτηκε', expenseStore.insert(supabase, [expenseStore.row({ propertyId, userId }, { contact_id: contact.id, amount: parseFloat(amount), description, date: athensToday(), category: 'Αμοιβές Συνεργατών' })]))
    setSaving(false)
    if (!ok) return
    onSaved(); onClose()
  }
  return (
    <Modal open onClose={close} title="Νέα δαπάνη" subtitle={contact.full_name} icon={<Receipt size={17} />} size="sm"
      footer={<>
        <Btn onClick={close} disabled={saving}>Ακύρωση</Btn>
        <Btn variant="primary" onClick={save} disabled={saving || !amount}>{saving ? 'Αποθήκευση…' : 'Αποθήκευση δαπάνης'}</Btn>
      </>}>
      <div><FL>Ποσό (€)</FL><Inp value={amount} onChange={setAmount} placeholder="Παράδειγμα: 150" type="number" min={0} /></div>
      <div><FL>Περιγραφή</FL><Inp value={description} onChange={setDescription} placeholder="Περιγραφή εργασίας" /></div>
    </Modal>
  )
}
export function QuickCalendarModal({ contact, propertyId, userId, onClose, onSaved }: { contact: Contact; propertyId: string; userId: string; onClose: () => void; onSaved: (date: string) => void }) {
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
  const [title, setTitle] = useState('Ραντεβού με ' + contact.full_name); const [date, setDate] = useState(isoDate(tomorrow)); const [saving, setSaving] = useState(false)
  // Ίδια φρουρά με τη «Νέα δαπάνη»: Escape και κλικ στο φόντο δεν κλείνουν όσο
  // η καταχώρηση είναι στον αέρα.
  const close = () => { if (!saving) onClose() }
  const save = async () => {
    if (!title || !date) return
    setSaving(true)
    const ok = await saved('Το ραντεβού δεν αποθηκεύτηκε', calendar.insert(supabase, [calendar.row({ propertyId, userId }, 'manual', { title, event_date: date, category: 'tenant' })]))
    setSaving(false)
    if (!ok) return
    onSaved(date); onClose()
  }
  return (
    <Modal open onClose={close} title="Νέο ραντεβού" subtitle={contact.full_name} icon={<CalendarPlus size={17} />} size="sm"
      footer={<>
        <Btn onClick={close} disabled={saving}>Ακύρωση</Btn>
        <Btn variant="primary" onClick={save} disabled={saving}>{saving ? 'Αποθήκευση…' : 'Προσθήκη στο Ημερολόγιο'}</Btn>
      </>}>
      <div><FL>Τίτλος</FL><Inp value={title} onChange={setTitle} placeholder="Τίτλος ραντεβού" /></div>
      <div><FL>Ημερομηνία</FL><DatePicker value={date} onChange={v => setDate(v)} /></div>
    </Modal>
  )
}
