'use client'
// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΝΤΟΣΙΕ ΤΗΣ ΕΠΑΦΗΣ: ΟΙ ΕΝΕΡΓΕΙΕΣ ΚΑΙ ΟΛΑ ΟΣΑ ΞΕΡΟΥΜΕ ΓΙ' ΑΥΤΗΝ
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect } from 'react'
import * as expenseStore from '@/lib/data/expenses'
import { initialsOf } from '@/lib/contacts/alpha'
import {
  Phone, Mail, Globe, MapPin, FileText, QrCode, Printer, History, Receipt, CalendarPlus, Users,
  Landmark, Pencil, Trash2, MessageSquare,
} from 'lucide-react'
import { T, fe, SideSheet, RuntimeImg } from '@/components/Theme'
import { notify } from '@/components/Toast'
import type { ReportBranding } from '@/lib/reportBranding'
import { supabase, type Contact, roleMeta, fmtDate, isOverdue, digitsOf, fetchSupplierDocs } from './model'
import { DossierRow, DossierSection, CommButton } from './Bits'
import { printContactCard } from './exports'

// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΔΥΟ ΔΡΟΜΟΙ ΤΗΣ ΚΕΝΗΣ ΚΑΤΑΣΤΑΣΗΣ
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΔΕΝ ΠΗΓΑΙΝΕ. Το πλακίδιο είχε σταθερό πλάτος 150 και ελληνικούς τίτλους
// σε προστακτική: «Φωτογράφισε κάρτα» έσπαγε σε δύο σειρές και «Γράψ' την με
// το χέρι» άφηνε τη λέξη «χέρι» μόνη της στη δεύτερη. Δίπλα τους, ο ένας
// υπότιτλος έπιανε τρεις σειρές και ο άλλος μία, οπότε τα δύο πλακίδια είχαν
// ίδιο ύψος αλλά διαφορετική εσωτερική ισορροπία: ο τίτλος του ενός δεν
// βρισκόταν ποτέ στη γραμμή βάσης του άλλου.
//
// ΤΡΕΙΣ ΔΙΟΡΘΩΣΕΙΣ ΚΑΙ ΟΙ ΤΡΕΙΣ ΚΑΝΟΝΑΣ ΚΑΙ ΟΧΙ ΓΟΥΣΤΟ:
//
//   • ΙΣΕΣ ΣΤΗΛΕΣ. Το πλάτος δεν είναι καρφωτό· βγαίνει από πλέγμα δύο ίσων
//     στηλών (`contactRouteGrid`). Δύο επιλογές ισότιμης βαρύτητας πρέπει να
//     έχουν ίδιο εμβαδόν, αλλιώς η μία διαβάζεται ως δευτερεύουσα πριν καν
//     διαβαστεί το κείμενο.
//   • ΤΟ ΡΗΜΑ, ΟΧΙ Ο ΔΡΟΜΟΣ. Ηταν «Από φωτογραφία» και «Με το χέρι» — ονόμαζαν
//     τον ΤΡΟΠΟ, όχι το αποτέλεσμα και ο δεύτερος ήταν και μειωτικός για τη
//     μοναδική διαδρομή που δίνει πλήρη στοιχεία. «Σάρωσε» και «Καταχώρησε»
//     λένε ΤΙ γίνεται, με το ίδιο βάρος και στα δύο· ο υπότιτλος από κάτω λέει
//     ήδη τον τρόπο («Κάρτα ή τιμολόγιο», «Ονομα, ειδικότητα, τηλέφωνο, ΑΦΜ»),
//     οπότε ο τίτλος δεν χρειάζεται να τον ξαναπεί.
//   • ΣΤΑΘΕΡΗ ΓΡΑΜΜΗ ΒΑΣΗΣ. Ο υπότιτλος κρατά ύψος δύο σειρών σε κάθε
//     περίπτωση, οπότε ο τίτλος κάθεται στο ίδιο ύψος και στα δύο πλακίδια
//     ανεξάρτητα από το μήκος του κειμένου.
// ═══════════════════════════════════════════════════════════════════════════

/** Δύο ίσες στήλες, με ανώτατο πλάτος ώστε τα πλακίδια να μη διαλυθούν σε μεγάλη οθόνη. */
// ΚΑΤΩ ΑΠΟ ΤΑ 340 ΟΙ ΔΥΟ ΔΙΑΔΡΟΜΕΣ ΜΠΑΙΝΟΥΝ Η ΜΙΑ ΚΑΤΩ ΑΠΟ ΤΗΝ ΑΛΛΗ. Στα 320 οι
// δύο στήλες αφήνουν 90 εικονοστοιχεία στην καθεμία και η λέξη «Καταχώρησε»
// θέλει 99: κοβόταν το
// ίδιο το ρήμα που ονομάζει τη διαδρομή. Στοιβαγμένες, οι δύο κάρτες κρατούν το
// ίδιο εμβαδόν μεταξύ τους, που είναι ο λόγος που μπήκαν σε πλέγμα εξαρχής.
// Η στοίβαξη γράφεται στο globals.css, γιατί το ενσωματωμένο στυλ δεν έχει
// ερωτήματα μέσων.
export const contactRouteGrid: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: T.sp.md, maxWidth: 420, margin: `${T.sp.sm}px auto 0`, alignItems: 'stretch',
}

const SUB_LINE = 15   // ύψος γραμμής υποτίτλου· μία γραμμή, ίδια στα δύο πλακίδια

export function ContactActionTile({ Icon, label, sub, onClick, primary }: { Icon: React.ComponentType<{ size?: number }>; label: string; sub?: string; onClick: () => void; primary?: boolean }) {
  const [h, setH] = useState(false)
  return (
    <button type="button" onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: T.sp.md,
        width: '100%', padding: `${T.sp.xl}px ${T.sp.lg}px`, borderRadius: T.radius.card,
        cursor: 'pointer', fontFamily: T.font.sans, textAlign: 'center',
        background: primary ? 'var(--accent)' : 'var(--bg-surface)',
        color: primary ? 'var(--accent-text)' : 'var(--text-primary)',
        border: '1px solid ' + (primary ? 'transparent' : 'var(--border-subtle)'),
        boxShadow: h ? 'var(--elev-3)' : 'var(--elev-1)',
        transform: h ? 'translateY(-3px)' : 'none',
        transition: 'transform .2s cubic-bezier(.2,0,0,1), box-shadow .2s',
      }}>
      {/* Το γέμισμα του εικονιδίου βγαίνει από το ΜΕΛΑΝΙ του πλακιδίου, όχι από
          καρφωτό λευκό: στο σκούρο θέμα το `--accent` είναι ανοιχτό παστέλ και
          ένα λευκό 18% επάνω του ήταν πρακτικά αόρατο. */}
      <div style={{ width: 46, height: 46, borderRadius: T.radius.inner, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: primary ? 'color-mix(in srgb, var(--accent-text) 20%, transparent)' : 'var(--accent-soft)', color: primary ? 'var(--accent-text)' : 'var(--accent)' }}><Icon size={22} /></div>
      <div style={{ width: '100%' }}>
        <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.25, textWrap: 'balance' }}>{label}</div>
        {/* Ο υπότιτλος είχε `opacity: 0.75`. Μετρημένο: πάνω στο γεμάτο accent
            του φωτεινού θέματος έβγαινε 3,94:1, δηλαδή ΚΑΤΩ από το 4,5:1 που
            απαιτούν έντεκα εικονοστοιχεία. Η διαφάνεια είναι λάθος εργαλείο για
            υποβάθμιση πάνω σε κορεσμένο φόντο: για να περάσει χρειάζεται 0,90,
            που είναι οπτικά αδιάκριτο από το γεμάτο και άρα δεν υποβαθμίζει.
            Η ιεραρχία βγαίνει από την ΚΛΙΜΑΚΑ (14/700 έναντι 11/400) και το
            χρώμα από ΔΕΙΚΤΗ, έναν ανά ρόλο. Μετρημένο μετά: 5,74 και 9,00 στο
            κύριο, 6,05 και 5,43 στο δεύτερο. */}
        {/* ΜΙΑ ΓΡΑΜΜΗ (ιδιοκτήτης, 25.09.2026). Ο υπότιτλος κρατούσε ύψος δύο
            γραμμών και το ένα πλακίδιο έσπαγε σε δύο ενώ το άλλο έμενε σε μία:
            δύο ίδια κουμπιά με διαφορετικό σχήμα. Τα κείμενα κόπηκαν ώστε να
            χωρούν στο στενότερο πλακίδιο· το αποσιωπητικό είναι δίχτυ, όχι σχέδιο. */}
        <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 400, color: primary ? 'var(--accent-text)' : 'var(--text-secondary)', marginTop: 4, lineHeight: `${SUB_LINE}px`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
      </div>
    </button>
  )
}

// ─── Contact Dossier (πλήρες προφίλ επαφής, slide-in) ───────────────────────────
// Το `notify` ΔΕΝ είναι πλέον prop: ερχόταν από τον γονέα ως τοπικό showToast και
// σκίαζε το κοινό `notify` του '@/components/Toast'. Επειδή το όνομα είναι ίδιο,
// αν έμενε το prop ο κώδικας θα μεταγλωττιζόταν κανονικά ενώ θα συνέχιζε να καλεί
// τον παλιό, ιδιωτικό υποδοχέα — σιωπηλή αποτυχία της ενοποίησης.
export function ContactDossier({ contact, propertyId, onClose, onEdit, onDelete, onQuickExpense, onQuickCalendar, onShowHistory, onShowQR, onVcard, branding, refreshKey }: {
  contact: Contact; propertyId: string; onClose: () => void; onEdit: () => void; onDelete: () => void
  onQuickExpense: () => void; onQuickCalendar: () => void; onShowHistory: () => void; onShowQR: () => void; onVcard: () => void
  branding?: ReportBranding | null; refreshKey?: number
}) {
  const meta = roleMeta(contact.role)
  const extra = contact._extra || {}
  const initials = initialsOf(contact.full_name)
  const GroupIcon = meta.GroupIcon || Users
  const digits = (p?: string | null) => { const d = (p || '').replace(/\D/g, ''); return d.length === 10 ? '30' + d : d }
  const site = extra.website ? (/^https?:\/\//.test(extra.website) ? extra.website : 'https://' + extra.website) : ''
  const mapLink = extra.office_address ? 'https://maps.google.com/maps?q=' + encodeURIComponent(extra.office_address) : ''
  const copy = (t: string, label: string) => { try { navigator.clipboard.writeText(t); notify(label + ' αντιγράφηκε') } catch { /* ignore */ } }
  const overdue = extra.next_appointment && isOverdue(extra.next_appointment)
  // Σύνδεση με δαπάνες: σύνολο + πλήθος πληρωμών προς αυτόν τον επαγγελματία.
  const [exp, setExp] = useState<{ total: number; count: number; docs: number }>({ total: 0, count: 0, docs: 0 })
  const afm = digitsOf(extra.afm)
  useEffect(() => {
    let live = true
    // Ταιριάζει με contact_id (νέες δαπάνες) ή με το όνομα στην περιγραφή (παλιές),
    // ΚΑΙ με το ΑΦΜ για τα σαρωμένα παραστατικά του ίδιου παρόχου.
    const nm = (contact.full_name || '').replace(/[,()*%\\]/g, ' ').trim()
    const filter = nm.length >= 3 ? `contact_id.eq.${contact.id},description.ilike.*${nm}*` : `contact_id.eq.${contact.id}`
    Promise.all([
      expenseStore.ledger<{ amount: number }>(supabase, propertyId, { columns: 'amount', or: filter }),
      fetchSupplierDocs(afm, propertyId),
    ]).then(([rows, docs]) => {
      if (!live) return
      setExp({ total: rows.reduce((s, e) => s + (e.amount || 0), 0), count: rows.length, docs: docs.length })
    })
    return () => { live = false }
  }, [contact.id, contact.full_name, propertyId, refreshKey, afm])
  // Ο ΤΟΠΙΚΟΣ ΑΚΡΟΑΤΗΣ ESCAPE ΕΦΥΓΕ: το SideSheet τον έχει ήδη (useOverlayShell),
  // μαζί με δύο πράγματα που ΕΛΕΙΠΑΝ εδώ — εστίαση μέσα στο πάνελ και επιστροφή
  // της στο σημείο εκκίνησης και κλείδωμα της κύλισης του φόντου (το σύρσιμο
  // πάνω στο σκοτεινό φόντο κυλούσε τη λίστα από πίσω).

  return (
    <SideSheet open onClose={onClose} ariaLabel="Καρτέλα επαφής" size="sm"
      header={<>
        <div style={{ display: 'flex', alignItems: 'center', gap: T.sp.lg }}>
          {extra.avatar_url
            ? <RuntimeImg src={extra.avatar_url} alt="" style={{ width: 68, height: 68, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--accent-border)', flexShrink: 0 }} />
            : <div style={{ width: 68, height: 68, borderRadius: '50%', background: 'var(--accent-soft)', border: '3px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>{initials || <GroupIcon size={26} />}</div>}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', lineHeight: 1.15 }}>{contact.full_name}</div>
            <div style={{ fontSize: 'var(--fs-base)', color: 'var(--accent)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}><GroupIcon size={13} />{meta.label || contact.role}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {extra.preferred && <span style={{ fontSize: 'var(--fs-xs)', padding: '2px 8px', borderRadius: T.radius.pill, background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', color: 'var(--accent)', fontWeight: 700 }}>Προτιμώμενη</span>}
            </div>
          </div>
        </div>
        {extra.specialty && <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', marginTop: 12, lineHeight: 1.5 }}>{extra.specialty}</div>}
      </>}>
      <style>{`.dsr-act:hover{border-color:var(--accent-border);background:var(--accent-soft);color:var(--accent)} .dsr-del{border:1px solid var(--border-subtle);background:var(--bg-elevated);color:var(--text-secondary)} .dsr-del:hover{border-color:var(--negative);color:var(--negative);background:var(--negative-soft)}`}</style>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(78px,1fr))', gap: 8 }}>
        {contact.phone && <CommButton label="Κλήση" Icon={Phone} href={'tel:' + contact.phone} accent />}
        {contact.phone && <CommButton label="WhatsApp" Icon={MessageSquare} href={'https://wa.me/' + digits(contact.phone)} target="_blank" />}
        {contact.phone && <CommButton label="Viber" Icon={Phone} href={'viber://chat?number=' + digits(contact.phone)} />}
        {contact.email && <CommButton label="Ηλεκτρονικό ταχυδρομείο" Icon={Mail} href={'mailto:' + contact.email} />}
        {site && <CommButton label="Ιστοσελίδα" Icon={Globe} href={site} target="_blank" />}
      </div>

      {(exp.count > 0 || exp.docs > 0) && (
        <button type="button" onClick={onShowHistory} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.card, padding: '14px 16px', cursor: 'pointer', textAlign: 'left', boxShadow: 'var(--elev-1)', fontFamily: T.font.sans }}>
          <div>
            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Πληρωμές</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>{fe(exp.total)}</div>
            <div className="po-subline" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{exp.count} {exp.count === 1 ? 'καταχώρηση' : 'καταχωρήσεις'}{exp.docs > 0 ? ` · ${exp.docs} ${exp.docs === 1 ? 'παραστατικό' : 'παραστατικά'} με το ΑΦΜ του` : ''}</div>
          </div>
          <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, whiteSpace: 'nowrap' }}>Πλήρες ιστορικό ›</span>
        </button>
      )}

      {(contact.phone || extra.phone2 || contact.email || extra.office_address) && (
        <DossierSection title="Στοιχεία επικοινωνίας">
          {contact.phone && <DossierRow icon={Phone} onCopy={() => copy(contact.phone!, 'Το τηλέφωνο')}><span style={{ fontFamily: T.font.num }}>{contact.phone}</span></DossierRow>}
          {extra.phone2 && <DossierRow icon={Phone} onCopy={() => copy(extra.phone2!, 'Το τηλέφωνο')}><span style={{ fontFamily: T.font.num }}>{extra.phone2}</span> <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)' }}>δεύτερο</span></DossierRow>}
          {contact.email && <DossierRow icon={Mail} onCopy={() => copy(contact.email!, 'Το email')}>{contact.email}</DossierRow>}
          {extra.office_address && <DossierRow icon={MapPin}>{extra.office_address}</DossierRow>}
        </DossierSection>
      )}

      {/* Ο χάρτης ΔΕΝ φορτώνεται μόνος του. Το iframe έστελνε τη διεύθυνση
          γραφείου τρίτου προσώπου στην Google με το που άνοιγε το ντοσιέ, χωρίς
          ο χρήστης να ζητήσει χάρτη. Τώρα ανοίγει με ρητό κλικ, σε νέα καρτέλα. */}
      {mapLink && (
        <a href={mapLink} target="_blank" rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.card, padding: '13px 16px', color: 'var(--text-secondary)', fontSize: 'var(--fs-base)', boxShadow: 'var(--elev-1)' }}>
          <MapPin size={15} color="var(--accent)" style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 0 }}>Άνοιγμα διεύθυνσης στον χάρτη</span>
          <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>›</span>
        </a>
      )}

      {(extra.afm || extra.iban) && (
        <DossierSection title="Επαγγελματικά και πληρωμές">
          {extra.afm && <DossierRow icon={FileText} onCopy={() => copy(extra.afm!, 'Το ΑΦΜ')}><span title="Αριθμός Φορολογικού Μητρώου">ΑΦΜ</span> <span style={{ fontFamily: T.font.mono }}>{extra.afm}</span></DossierRow>}
          {extra.iban && <DossierRow icon={Landmark} onCopy={() => copy(extra.iban!, 'Το IBAN')}><span style={{ fontFamily: T.font.mono, fontSize: 12 }}>{extra.iban}</span>{extra.iris && <span title="Σύστημα άμεσων πληρωμών σε πραγματικό χρόνο (IRIS)" style={{ marginLeft: 6, fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--accent)' }}>IRIS</span>}</DossierRow>}
        </DossierSection>
      )}

      {extra.next_appointment && (
        <DossierSection title="Παρακολούθηση">
          <DossierRow icon={CalendarPlus}><span style={{ color: overdue ? 'var(--negative)' : 'var(--text-secondary)' }}>Επόμενο ραντεβού: {fmtDate(extra.next_appointment)}{overdue ? ' (ληξιπρόθεσμο)' : ''}</span></DossierRow>
        </DossierSection>
      )}

      {(extra.tags || []).length > 0 && (
        <DossierSection title="Ετικέτες">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(extra.tags || []).map(t => <span key={t} style={{ fontSize: 'var(--fs-xs)', padding: '3px 10px', borderRadius: T.radius.pill, background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', color: 'var(--accent)' }}>{t}</span>)}
          </div>
        </DossierSection>
      )}

      {(contact._freeNotes || (extra.notes_log || []).length > 0) && (
        <DossierSection title="Σημειώσεις">
          {contact._freeNotes && <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{contact._freeNotes}</div>}
          {(extra.notes_log || []).map(n => (
            <div key={n.id} style={{ borderLeft: '2px solid var(--border-default)', paddingLeft: 12 }}>
              <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text-primary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{n.text}</div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>{fmtDate(n.ts)}</div>
            </div>
          ))}
        </DossierSection>
      )}

      {(extra.files || []).length > 0 && (
        <DossierSection title="Αρχεία">
          {(extra.files || []).map((f, i) => (
            <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'var(--text-secondary)', fontSize: 'var(--fs-base)' }}>
              <FileText size={14} color="var(--text-tertiary)" />{f.name}
            </a>
          ))}
        </DossierSection>
      )}

      {/* Το `marginTop: 2` έφυγε: το σώμα του SideSheet είναι ήδη flex column με
          gap, οπότε πρόσθετε δεύτερο κενό πάνω από τη γραμμή διαχωρισμού. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
        {[
          { Icon: Pencil, label: 'Επεξεργασία', onClick: onEdit },
          { Icon: Receipt, label: 'Δαπάνη', onClick: onQuickExpense },
          { Icon: CalendarPlus, label: 'Ραντεβού', onClick: onQuickCalendar },
          { Icon: History, label: 'Ιστορικό', onClick: onShowHistory },
          { Icon: QrCode, label: 'QR', onClick: onShowQR },
          { Icon: FileText, label: 'vCard', onClick: onVcard },
          { Icon: Printer, label: 'Εκτύπωση', onClick: () => printContactCard(contact, branding) },
        ].map((a, i) => (
          <button key={i} type="button" onClick={a.onClick} className="dsr-act" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 62, padding: '10px 4px', borderRadius: T.radius.popup, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', fontSize: 'var(--fs-xs)', fontWeight: 600, cursor: 'pointer', fontFamily: T.font.sans, transition: 'background .15s, border-color .15s, color .15s' }}>
            <a.Icon size={17} /><span style={{ whiteSpace: 'nowrap' }}>{a.label}</span>
          </button>
        ))}
        <button type="button" onClick={onDelete} className="dsr-del" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 62, padding: '10px 4px', borderRadius: T.radius.popup, fontSize: 'var(--fs-xs)', fontWeight: 600, cursor: 'pointer', fontFamily: T.font.sans, transition: 'background .15s, border-color .15s, color .15s' }}>
          <Trash2 size={17} /><span style={{ whiteSpace: 'nowrap' }}>Διαγραφή</span>
        </button>
      </div>
    </SideSheet>
  )
}
