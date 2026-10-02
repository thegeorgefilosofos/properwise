'use client'
// ═══════════════════════════════════════════════════════════════════════════
// Η ΕΠΑΦΗ ΣΤΗ ΛΙΣΤΑ: ΚΑΡΤΑ, ΣΥΜΠΑΓΗΣ ΓΡΑΜΜΗ, ΔΙΑΧΩΡΙΣΤΙΚΟ ΟΜΑΔΑΣ, ΑΛΦΑΒΗΤΟ
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect, useRef } from 'react'
import { useCoarsePointer } from '@/components/useCoarsePointer'
import { displayPhone } from '@/lib/core/greek'
import { initialsOf, type AlphaEntry } from '@/lib/contacts/alpha'
import {
  Phone, Mail, Globe, MapPin, QrCode, Printer, History, Receipt, CalendarPlus, Users, Building2,
  Pencil, Trash2,
} from 'lucide-react'
import { T, ChipToggle, SelectBox, ABSENT, pressable, RuntimeImg } from '@/components/Theme'
import type { ReportBranding } from '@/lib/reportBranding'
import { type Contact, GROUPS, roleMeta, fmtDate, daysUntil, isOverdue } from './model'
import { QuickAct } from './Bits'
import { printContactCard } from './exports'

// ─── Contact Card ─────────────────────────────────────────────────────────────
export function ContactCard({ contact, onOpen, onEdit, onDelete, onQuickExpense, onQuickCalendar, onShowHistory, onShowQR, selected, onSelect, bulkMode, branding, scopeLabel, scopePortfolio }: {
  contact: Contact; onOpen?: () => void; onEdit: () => void; onDelete: () => void
  onQuickExpense: () => void; onQuickCalendar: () => void; onShowHistory: () => void; onShowQR: () => void
  selected?: boolean; onSelect?: () => void; bulkMode?: boolean; branding?: ReportBranding | null
  scopeLabel?: string | null; scopePortfolio?: boolean
}) {
  const meta = roleMeta(contact.role)
  const extra = contact._extra || {}
  const initials = initialsOf(contact.full_name)
  const [hov, setHov] = useState(false); const [showActions, setShowActions] = useState(false)
  // Εστίαση πληκτρολογίου μέσα στην κάρτα: κρατά τις ενέργειες ορατές.
  const [kbd, setKbd] = useState(false)
  // ΣΕ ΟΘΟΝΗ ΑΦΗΣ ΔΕΝ ΥΠΑΡΧΕΙ hover, ΑΡΑ ΔΕΝ ΥΠΗΡΧΑΝ ΚΑΙ ΟΙ ΕΝΕΡΓΕΙΕΣ. Κλήση,
  // WhatsApp, Viber, email και ολόκληρο το μενού «···» (Επεξεργασία, Νέα δαπάνη,
  // Ραντεβού, Ιστορικό, QR, Εκτύπωση, Διαγραφή) εμφανίζονταν μόνο με ποντίκι.
  // Δηλαδή σε κινητό — που είναι η πλειονότητα των χρηστών — η καρτέλα Επαφές
  // ήταν λίστα ονομάτων χωρίς καμία ενέργεια. Η εφαρμογή έχει ήδη τη λύση δύο
  // φορές: το `useCoarsePointer` και ένα `@media (hover: none)` στο φύλλο στυλ.
  const coarse = useCoarsePointer()
  const actionsRef = useRef<HTMLDivElement>(null)
  // Κλείσιμο του μενού «···» με κλικ εκτός ή με Escape (χωρίς μετατόπιση διάταξης).
  useEffect(() => {
    if (!showActions) return
    const onDown = (e: MouseEvent) => { if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) setShowActions(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowActions(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [showActions])
  const overdue = extra.next_appointment && isOverdue(extra.next_appointment)
  const dueDays = extra.next_appointment ? daysUntil(extra.next_appointment) : null
  const GroupIcon = meta.GroupIcon || Users

  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      onFocus={e => { if (e.target instanceof HTMLElement && e.target.matches(':focus-visible')) setKbd(true) }}
      onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setKbd(false) }}
      onClick={bulkMode ? onSelect : undefined}
      /* ═══ Η ΚΑΡΤΑ ΕΠΑΦΗΣ ΑΝΑΠΑΥΕΤΑΙ ΟΠΟΥ ΚΑΙ Η ΚΑΡΤΑ ΠΕΛΑΤΗ ══════════════════
         ΜΕΤΡΗΜΕΝΟ ΣΤΟΝ ΠΑΓΚΟ, 22 ΟΘΟΝΕΣ: πέντε κάρτες επαφής ήταν οι μόνες της
         οθόνης χωρίς βάθος, ενώ δίπλα τους οι κάρτες ενότητας ανασηκώνονται.
         Το `boxShadow` πήγαινε από το ΤΙΠΟΤΑ κατευθείαν στο `elev-2` με το
         ποντίκι, δηλαδή η κάρτα δεν ανέβαινε ένα σκαλί, εμφανιζόταν.

         Η `.client-card` του globals.css λέει ήδη πώς αναπαύεται μια κάρτα
         περιεχομένου σε πλέγμα: `surface-raised` με `border-raised` και
         `highlight-inset, elev-1`. Στο hover παίρνει `highlight-inset-strong` με
         `elev-2`. Η κάρτα επαφής είναι το ίδιο πράγμα και παίρνει τα ίδια.

         ΚΑΙ ΤΟ ΠΕΡΙΓΡΑΜΜΑ ΓΙΝΕΤΑΙ ΕΝΟΣ ΕΙΚΟΝΟΣΤΟΙΧΕΙΟΥ. Το 1,5 ήταν το μόνο
         της εφαρμογής: κάθε άλλη κάρτα, εδώ και παντού, γράφει 1. */
      style={{ background: selected ? 'color-mix(in srgb, var(--accent) 6%, var(--surface-raised))' : 'var(--surface-raised)', border: '1px solid ' + (selected ? 'var(--accent)' : hov ? 'var(--accent-border)' : overdue ? 'var(--negative-border)' : 'var(--border-raised)'), borderLeft: overdue && !bulkMode ? '3px solid var(--negative)' : undefined, borderRadius: T.radius.card, padding: bulkMode ? '18px 18px 16px 46px' : '18px 18px 16px', position: 'relative', boxShadow: selected ? '0 0 0 3px var(--accent-soft)' : hov ? 'var(--highlight-inset-strong), var(--elev-2)' : 'var(--highlight-inset), var(--elev-1)', transition: 'border-color 0.2s, box-shadow 0.2s, background 0.2s', cursor: bulkMode ? 'pointer' : 'default' }}>
      {/* Η ΑΡΙΣΤΕΡΗ ΛΩΡΙΔΑ ΕΓΙΝΕ ΠΕΡΙΓΡΑΜΜΑ. Ηταν απόλυτο κουτί τριών
          εικονοστοιχείων μέσα σε κάρτα με περίγραμμα ενός, με δική του
          καμπύλη: άφηνε σκούρα εγκοπή στη γωνία σε ΚΑΘΕ κάρτα· και χωρίς
          ληγμένο ραντεβού δεν σήμαινε τίποτα. Τώρα υπάρχει μόνο όταν σημαίνει. */}
      {bulkMode && <div style={{ position: 'absolute', top: 17, left: 15, zIndex: 2 }}><SelectBox checked={!!selected} onChange={() => onSelect?.()} label={`Επιλογή ${contact.full_name}`} /></div>}
      {overdue && <div style={{ position: 'absolute', top: 0, right: 0, background: 'var(--negative)', color: 'var(--text-inverse)', fontSize: 'var(--fs-xs)', fontWeight: 700, padding: '3px 10px', borderRadius: '0 16px 0 8px', }}>Ληγμένο ραντεβού</div>}
      {/* ΟΙ ΕΝΕΡΓΕΙΕΣ ΑΠΟΔΙΔΟΝΤΑΙ ΠΑΝΤΑ, ΚΡΥΒΕΤΑΙ ΜΟΝΟ Η ΟΨΗ ΤΟΥΣ. Οσο υπήρχαν
          μόνο με το ποντίκι από πάνω, το πληκτρολόγιο δεν τις έφτανε ποτέ στην
          οθόνη γραφείου. Τώρα φαίνονται με αιώρηση, με εστίαση πληκτρολογίου
          μέσα στην κάρτα και πάντα σε αφή. */}
      {!bulkMode && (
        <div ref={actionsRef} style={{ position: 'absolute', top: 28, right: 18, zIndex: 20, opacity: (hov || showActions || coarse || kbd) ? 1 : 0, transition: 'opacity 0.15s' }}>
          {/* ═══ ΟΙ ΕΝΕΡΓΕΙΕΣ ΔΕΝ ΗΤΑΝ ΣΤΟ ΥΨΟΣ ΤΗΣ ΓΡΑΜΜΗΣ ΠΟΥ ΑΦΟΡΟΥΝ ═══════
            Μετρημένο στα 390: η γραμμή του ονόματος πιάνει 601→651, δηλαδή
            κέντρο στο 626. Τα κουμπιά κάθονταν 595→625, κέντρο 610 — δεκαέξι
            εικονοστοιχεία πιο ψηλά από αυτό που χειρίζονται, σε κάθε κάρτα
            επαφής. Και το `right: 12` τα έσπρωχνε έξι πιο δεξιά από τη στήλη
            του περιεχομένου, δηλαδή έβγαιναν από τη στοίχιση της κάρτας.

            Τα νούμερα δεν είναι διάλεγμα ματιού: η εσωτερική απόσταση της
            κάρτας είναι 18, το πλακίδιο του αρχικού 50 ψηλό και το κουμπί 30 —
            18 + (50−30)/2 = 28. Το `right: 18` ισοφαρίζει την ίδια απόσταση,
            οπότε η δεξιά άκρη των κουμπιών πέφτει ΑΚΡΙΒΩΣ πάνω στη δεξιά άκρη
            του κειμένου από κάτω. Ο σαρωτής ανέφερε τη διαφορά ως σύγκρουση
            στόχων σε τέσσερα πλάτη: το σφάλμα ήταν η στοίχιση, όχι η στρώση. */}
          {/* Ορατές μόνο οι πιο συχνές ενέργειες — όλες οι υπόλοιπες μπαίνουν στο «···» */}
          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
            {contact.phone && <QuickAct as="a" href={'tel:' + contact.phone} title="Κλήση"><Phone size={13} /></QuickAct>}
            {extra.whatsapp && contact.phone && <QuickAct as="a" href={'https://wa.me/' + contact.phone.replace(/\D/g, '')} target="_blank" rel="noreferrer" title="WhatsApp" label="WA" />}
            {extra.viber && contact.phone && <QuickAct as="a" href={'viber://chat?number=' + contact.phone.replace(/\D/g, '')} title="Viber" label="VB" />}
            {contact.email && <QuickAct as="a" href={'mailto:' + contact.email} title="Ηλεκτρονικό ταχυδρομείο"><Mail size={13} /></QuickAct>}
            <QuickAct as="button" onClick={() => setShowActions(s => !s)} title="Περισσότερες ενέργειες"><span style={{ fontSize: 16, fontWeight: 700, lineHeight: 0, marginTop: -4 }}>···</span></QuickAct>
          </div>
          {showActions && (
            <div role="menu" style={{ position: 'absolute', top: 38, right: 0, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.inner, padding: '6px', minWidth: 210, boxShadow: 'var(--elev-3)' }}>
              {[
                { Icon: Pencil, label: 'Επεξεργασία', onClick: onEdit, color: 'var(--text-secondary)' },
                { Icon: Receipt, label: 'Νέα δαπάνη', onClick: onQuickExpense, color: 'var(--text-secondary)' },
                { Icon: CalendarPlus, label: 'Νέο ραντεβού', onClick: onQuickCalendar, color: 'var(--text-secondary)' },
                { Icon: History, label: 'Ιστορικό συνεργασίας', onClick: onShowHistory, color: 'var(--text-secondary)' },
                { Icon: QrCode, label: 'Κωδικός QR', onClick: onShowQR, color: 'var(--accent)' },
                { Icon: Printer, label: 'Εκτύπωση κάρτας', onClick: () => printContactCard(contact, branding), color: 'var(--text-secondary)' },
              ].map((a, i) => (
                /* ΜΕΝΟΥΝ ΧΕΙΡΟΠΟΙΗΤΕΣ ΚΑΙ ΟΙ ΔΥΟ ΓΡΑΜΜΕΣ. Το Btn δεν προωθεί ούτε
                   `role="menuitem"` —που το ζητά το role="menu" από πάνω— ούτε
                   className, δηλαδή θα έχανε την `.po-hov-fill` με τον δικό της
                   τόνο ανά γραμμή. Και η γραμμή μενού είναι πλήρους πλάτους με
                   αριστερή στοίχιση ενώ το Btn κεντράρει. */
                <button className="po-hov-fill" key={i} type="button" role="menuitem" onClick={() => { a.onClick(); setShowActions(false) }} style={{ '--hov-fill': 'var(--bg-surface)', display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 12px', borderRadius: T.radius.badge, border: 'none', cursor: 'pointer', fontSize: 'var(--fs-base)', color: 'var(--text-primary)', textAlign: 'left' }} >
                  <a.Icon size={14} color={a.color} style={{ flexShrink: 0 }} />{a.label}
                </button>
              ))}
              <div style={{ height: 1, background: 'var(--border-subtle)', margin: '5px 8px' }} />
              <button className="po-hov-fill" type="button" role="menuitem" onClick={() => { onDelete(); setShowActions(false) }} style={{ '--hov-fill': 'color-mix(in srgb, var(--negative) 8%, transparent)', display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 12px', borderRadius: T.radius.badge, border: 'none', cursor: 'pointer', fontSize: 'var(--fs-base)', color: 'var(--negative)', textAlign: 'left' }} >
                <Trash2 size={14} color="var(--negative)" style={{ flexShrink: 0 }} />Διαγραφή
              </button>
            </div>
          )}
        </div>
      )}
      <div style={{ paddingLeft: 10, pointerEvents: bulkMode ? 'none' : undefined }}>
        <div {...pressable(() => onOpen && !bulkMode && onOpen())} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, paddingRight: bulkMode ? 0 : 100, cursor: onOpen && !bulkMode ? 'pointer' : 'default' }}>
          {extra.avatar_url ? <RuntimeImg src={extra.avatar_url} alt="" style={{ width: 50, height: 50, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-border)', flexShrink: 0 }} />
            : <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'var(--accent-soft)', border: '2px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>{initials || <GroupIcon size={20} />}</div>}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: T.font.sans, marginBottom: 1 }}>{contact.full_name}</div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><GroupIcon size={11} style={{ flexShrink: 0 }} />{meta.label || contact.role}</div>
            {extra.specialty && <div className="po-subline" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{extra.specialty}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          {extra.preferred && <span style={{ fontSize: 'var(--fs-xs)', padding: '2px 8px', borderRadius: T.radius.pill, background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', color: 'var(--accent)', fontWeight: 700 }}>Προτιμώμενη</span>}
          {scopeLabel && (
            <span title={scopePortfolio ? 'Ισχύει για όλο το χαρτοφυλάκιο' : 'Ανήκει σε συγκεκριμένο ακίνητο'} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--fs-xs)', padding: '2px 8px', borderRadius: T.radius.pill, background: scopePortfolio ? 'var(--accent-soft)' : 'var(--bg-elevated)', border: '1px solid ' + (scopePortfolio ? 'var(--accent-border)' : 'var(--border-subtle)'), color: scopePortfolio ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: 500, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {scopePortfolio ? <Globe size={10} style={{ flexShrink: 0 }} /> : <Building2 size={10} style={{ flexShrink: 0 }} />}{scopeLabel}
            </span>
          )}
        </div>
        {(extra.tags || []).length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
            {(extra.tags || []).map(t => <span key={t} style={{ fontSize: 'var(--fs-xs)', padding: '2px 8px', borderRadius: T.radius.pill, background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', color: 'var(--accent)' }}>{t}</span>)}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
          {contact.phone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Phone size={12} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
              <a href={'tel:' + contact.phone} className="po-tap" style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', fontFamily: T.font.sans, fontVariantNumeric: 'tabular-nums', textDecoration: 'none' }}>{displayPhone(contact.phone)}</a>
              {extra.whatsapp && <a href={'https://wa.me/' + contact.phone.replace(/\D/g, '')} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', fontSize: 'var(--fs-xs)', color: 'var(--accent)', fontWeight: 700, background: 'var(--accent-soft)', padding: '1px 5px', borderRadius: T.radius.xs }}>WA</a>}
              {extra.viber && <a href={'viber://chat?number=' + contact.phone.replace(/\D/g, '')} style={{ textDecoration: 'none', fontSize: 'var(--fs-xs)', color: 'var(--accent)', fontWeight: 700, background: 'var(--accent-soft)', padding: '1px 5px', borderRadius: T.radius.xs }}>VB</a>}
            </div>
          )}
          {extra.phone2 && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Phone size={12} color="var(--text-tertiary)" style={{ flexShrink: 0 }} /><a href={'tel:' + extra.phone2} className="po-tap" style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: T.font.sans, fontVariantNumeric: 'tabular-nums', textDecoration: 'none' }}>{displayPhone(extra.phone2)}</a><span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>2ο</span></div>}
          {contact.email && <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}><Mail size={12} color="var(--text-tertiary)" style={{ flexShrink: 0 }} /><span style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{contact.email}</span></div>}
          {extra.website && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Globe size={12} color="var(--text-tertiary)" style={{ flexShrink: 0 }} /><span style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{extra.website}</span></div>}
          {extra.office_address && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><MapPin size={12} color="var(--text-tertiary)" style={{ flexShrink: 0 }} /><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{extra.office_address}</span></div>}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
          {extra.afm && <span title="Αριθμός Φορολογικού Μητρώου" style={{ fontSize: 'var(--fs-xs)', padding: '2px 8px', borderRadius: T.radius.pill, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontFamily: T.font.mono }}>ΑΦΜ {extra.afm}</span>}
          {extra.iban && <span title="Διεθνής Αριθμός Τραπεζικού Λογαριασμού (IBAN)" style={{ fontSize: 'var(--fs-xs)', padding: '2px 8px', borderRadius: T.radius.pill, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontFamily: T.font.mono }}>IBAN ···{extra.iban.slice(-4)}{extra.iris && <span title="Σύστημα άμεσων πληρωμών σε πραγματικό χρόνο (IRIS)" style={{ color: 'var(--text-secondary)', fontWeight: 700, marginLeft: 4 }}>IRIS</span>}</span>}
          {extra.next_appointment && <span style={{ fontSize: 'var(--fs-xs)', padding: '2px 8px', borderRadius: T.radius.pill, background: overdue ? 'var(--negative-soft)' : 'var(--accent-soft)', border: '1px solid ' + (overdue ? 'var(--negative-border)' : 'var(--accent-border)'), color: overdue ? 'var(--negative)' : 'var(--accent)' }}>{overdue ? `Ραντεβού ${Math.abs(dueDays || 0)} ημέρες πριν` : `Ραντεβού ${fmtDate(extra.next_appointment)}`}</span>}
          {(extra.notes_log || []).length > 0 && <span style={{ fontSize: 'var(--fs-xs)', padding: '2px 8px', borderRadius: T.radius.pill, background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', color: 'var(--accent)' }}>{(extra.notes_log || []).length} σημειώσεις</span>}
          {(extra.files || []).length > 0 && <span style={{ fontSize: 'var(--fs-xs)', padding: '2px 8px', borderRadius: T.radius.pill, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>{(extra.files || []).length} αρχεία</span>}
        </div>
        {contact._freeNotes && <div style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-elevated)', borderRadius: T.radius.badge, padding: '7px 11px', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{contact._freeNotes}</div>}
      </div>
    </div>
  )
}

// ─── Compact Row ──────────────────────────────────────────────────────────────
/** Πλάτος της στήλης ενεργειών. Σταθερό ώστε επαφές με και χωρίς
 *  WhatsApp/Viber να δίνουν την ΙΔΙΑ γεωμετρία γραμμής και η κεφαλίδα να
 *  μπορεί να κρατήσει την ίδια στήλη. Μετρήθηκε 294,2 με τα δύο και 227
 *  χωρίς — δηλαδή κάθε γραμμή στοίχιζε αλλού. */
export const CONTACT_ACTIONS_W = 300
export const CONTACT_ROW_MIN = 8 + 120 + 100 + 160 + 120 + 90 + CONTACT_ACTIONS_W + 12 * 6 + 32

export function CompactRow({ contact, onOpen, onEdit, onDelete, selected, onSelect, bulkMode, scopePortfolio }: { contact: Contact; onOpen?: () => void; onEdit: () => void; onDelete: () => void; selected?: boolean; onSelect?: () => void; bulkMode?: boolean; scopePortfolio?: boolean }) {
  const meta = roleMeta(contact.role)
  const extra = contact._extra || {}; const [hov, setHov] = useState(false)
  // Η γραμμή της λίστας ήταν χειρότερη από την κάρτα: `opacity: 0` χωρίς
  // `pointerEvents: none`, άρα «Επεξεργασία» και «Διαγραφή» ήταν ΑΟΡΑΤΕΣ αλλά
  // πατιόνταν. Σε κινητό ο χρήστης διέγραφε επαφή χωρίς να δει τι πάτησε.
  const coarse = useCoarsePointer()
  const overdue = extra.next_appointment && isOverdue(extra.next_appointment)
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      onClick={bulkMode ? onSelect : undefined}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', background: selected ? 'var(--accent-soft)' : hov ? 'var(--bg-elevated)' : 'transparent', transition: 'background 0.15s', borderBottom: '1px solid var(--border-subtle)', cursor: bulkMode ? 'pointer' : 'default' }}>
      {bulkMode && <SelectBox checked={!!selected} onChange={() => onSelect?.()} label={`Επιλογή ${contact.full_name}`} />}
      {/* Η κουκκίδα σημαίνει ΕΝΑ πράγμα: ληξιπρόθεσμο ραντεβού. Πριν έδειχνε
          «κατάσταση σχέσης» — τέσσερα χρώματα για μια επιλογή χωρίς συνέπεια. */}
      {/* Το χρώμα και το title δεν φτάνουν στον αναγνώστη οθόνης· το κρυφό
          κείμενο ναι. */}
      <div title={overdue ? 'Ληξιπρόθεσμο ραντεβού' : undefined} style={{ width: 8, height: 8, borderRadius: '50%', background: overdue ? 'var(--negative)' : 'var(--border-default)', flexShrink: 0 }}>
        {overdue && <span className="sr-only">Ληξιπρόθεσμο ραντεβού</span>}
      </div>
      <div {...pressable(() => onOpen && !bulkMode && onOpen())} style={{ width: 200, minWidth: 120, flexShrink: 1, cursor: onOpen && !bulkMode ? 'pointer' : 'default' }}>
        <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{contact.full_name}</div>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>{meta.label}{scopePortfolio && <span title="Όλο το χαρτοφυλάκιο" style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--accent)' }}><Globe size={10} /></span>}</div>
      </div>
      <div style={{ width: 140, minWidth: 100, flexShrink: 1, fontSize: 12, color: 'var(--text-secondary)', fontFamily: T.font.mono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{contact.phone || ABSENT}</div>
      <div title={contact.email || undefined} style={{ flex: 1, minWidth: 160, fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{contact.email || ABSENT}</div>
      {/* ΤΟ maxWidth ΔΕΝ ΕΙΝΑΙ ΠΛΑΤΟΣ. Η κεφαλίδα δίνει στις «Ετικέτες» στήλη
          120, η γραμμή όμως έδινε `maxWidth:160` χωρίς `width` — δηλαδή πλάτος
          όσο το περιεχόμενο. Επαφή χωρίς ετικέτες κατέληγε 0 πλάτος και η
          στήλη ΑΦΜ ανέβαινε 120 εικονοστοιχεία αριστερά από την επικεφαλίδα
          της· επαφή με δύο ετικέτες την έσπρωχνε δεξιά. Η ίδια στήλη άλλαζε
          θέση σε κάθε γραμμή. Σταθερό πλάτος, ίδιο με την κεφαλίδα. */}
      <div title={(extra.tags || []).join(', ') || undefined} style={{ display: 'flex', alignItems: 'center', gap: 4, width: 120, flexShrink: 0, overflow: 'hidden', whiteSpace: 'nowrap' }}>
        {(extra.tags || []).slice(0, 1).map(t => <span key={t} style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 'var(--fs-xs)', padding: '2px 7px', borderRadius: T.radius.pill, background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}>{t}</span>)}
        {(extra.tags || []).length > 1 && <span style={{ flexShrink: 0, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>+{(extra.tags || []).length - 1}</span>}
      </div>
      <div style={{ width: 120, minWidth: 90, flexShrink: 1, fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', fontFamily: T.font.mono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{extra.afm ? 'ΑΦΜ ' + extra.afm : ''}</div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', width: CONTACT_ACTIONS_W, opacity: bulkMode ? 0 : (hov || coarse) ? 1 : 0, pointerEvents: bulkMode || !(hov || coarse) ? 'none' : undefined, transition: 'opacity 0.15s', flexShrink: 0 }}>
        {contact.phone && <a href={'tel:' + contact.phone} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', padding: 4, color: 'var(--text-secondary)' }}><Phone size={14} /></a>}
        {extra.whatsapp && contact.phone && <a href={'https://wa.me/' + contact.phone.replace(/\D/g, '')} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', padding: '4px 6px', fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-soft)', borderRadius: T.radius.xs }}>WA</a>}
        {extra.viber && contact.phone && <a href={'viber://chat?number=' + contact.phone.replace(/\D/g, '')} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', padding: '4px 6px', fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-soft)', borderRadius: T.radius.xs }}>VB</a>}
        {contact.email && <a href={'mailto:' + contact.email} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', padding: 4, color: 'var(--text-secondary)' }}><Mail size={14} /></a>}
        {/* ΜΕΝΟΥΝ ΧΕΙΡΟΠΟΙΗΤΑ ΓΙΑ ΤΗ ΓΕΩΜΕΤΡΙΑ ΤΗΣ ΓΡΑΜΜΗΣ. Είναι ~26 ψηλά μέσα σε
            ζώνη σταθερού πλάτους CONTACT_ACTIONS_W: τα 36 —44 στο δάχτυλο— του Btn
            θα ψήλωναν κάθε γραμμή της λίστας ενώ το γέμισμα 9×18 θα ξεχείλιζε τη ζώνη. */}
        <button type="button" onClick={onEdit} style={{ fontSize: 12, padding: '4px 10px', borderRadius: T.radius.badge, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>Επεξεργασία</button>
        <button type="button" onClick={onDelete} style={{ fontSize: 12, padding: '4px 10px', borderRadius: T.radius.badge, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>Διαγραφή</button>
      </div>
    </div>
  )
}

// ─── Group Divider ────────────────────────────────────────────────────────────
export function GroupDivider({ group, count }: { group: typeof GROUPS[0]; count: number }) {
  const GroupIcon = group.Icon
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <div style={{ width: 30, height: 30, borderRadius: T.radius.chip, background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <GroupIcon size={15} color="var(--accent)" />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent)', fontFamily: T.font.sans }}>{group.label}</span>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, var(--accent-border), transparent)' }} />
      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', background: 'var(--bg-surface)', padding: '2px 10px', borderRadius: T.radius.pill, border: '1px solid var(--border-subtle)' }}>{count}</span>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Η ΑΛΦΑΒΗΤΙΚΗ ΡΑΓΑ
// ─────────────────────────────────────────────────────────────────────────
// Δύο αλφάβητα, γιατί ένα ελληνικό ευρετήριο δεν βρίσκει το «Booking.com» και
// ένα λατινικό δεν βρίσκει τον «Παπαδόπουλο». Χωρίζονται με λεπτή κάθετη
// γραμμή — όχι με ετικέτα «Ελληνικά»/«Αγγλικά», που θα ήταν δύο λέξεις για κάτι
// που φαίνεται.
//
// ΜΟΝΟ ΤΑ ΓΡΑΜΜΑΤΑ ΠΟΥ ΥΠΑΡΧΟΥΝ. Πενήντα ένα γράμματα εκ των οποίων τα σαράντα
// οκτώ νεκρά δεν είναι ευρετήριο· είναι διακόσμηση που κοστίζει δύο σειρές
// οθόνης. Το πλήθος κάθε γράμματος ζει στο tooltip και όχι δίπλα στο γράμμα:
// στη ράγα μετράει η ταχύτητα του ματιού, όχι η αναφορά.
// ═══════════════════════════════════════════════════════════════════════════
export function AlphaRail({ entries, active, onPick }: {
  entries: AlphaEntry[]; active: string | null; onPick: (letter: string | null) => void
}) {
  if (entries.length < 2) return null   // Ένα γράμμα δεν είναι ευρετήριο.
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', marginBottom: T.sp.lg }}>
      {entries.map((e, i) => {
        const on = active === e.letter
        // Η αλλαγή αλφαβήτου σημαδεύεται μία φορά, στο σημείο που συμβαίνει.
        const boundary = i > 0 && entries[i - 1].script !== e.script
        return (
          <span key={e.letter} style={{ display: 'contents' }}>
            {boundary && <span aria-hidden style={{ width: 1, height: 14, background: 'var(--border-default)', margin: '0 7px', flexShrink: 0 }} />}
            {/* `chip` επειδή η ράγα δεν έχει δικό της περίγραμμα: κάθε γράμμα στέκεται μόνο του. */}
            <ChipToggle on={on} onClick={() => onPick(on ? null : e.letter)}
              title={`${e.count} ${e.count === 1 ? 'επαφή' : 'επαφές'}`}>
              {e.letter}
            </ChipToggle>
          </span>
        )
      })}
    </div>
  )
}
