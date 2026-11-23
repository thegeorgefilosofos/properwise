'use client'
// ═══════════════════════════════════════════════════════════════════════════
// Η ΕΠΑΦΗ ΣΤΗ ΛΙΣΤΑ: ΓΡΑΜΜΗ, ΓΡΑΜΜΗ ΠΙΝΑΚΑ, ΔΙΑΧΩΡΙΣΤΙΚΟ ΟΜΑΔΑΣ, ΑΛΦΑΒΗΤΟ
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from 'react'
import { useCoarsePointer } from '@/components/useCoarsePointer'
import { displayPhone } from '@/lib/core/greek'
import { initialsOf, type AlphaEntry } from '@/lib/contacts/alpha'
import { Phone, Mail, Globe, Users } from 'lucide-react'
import { T, ChipToggle, SelectBox, ABSENT, pressable, RuntimeImg } from '@/components/Theme'
import { type Contact, GROUPS, roleMeta, isOverdue } from './model'

// ─── Contact Row ──────────────────────────────────────────────────────────────
// ═══ ΓΡΑΜΜΗ ΛΙΣΤΑΣ 56, ΟΧΙ ΚΑΡΤΑ 230 (αξιολόγηση σχεδίασης 3) ════════════════
// Κάθε επαφή ήταν κάρτα με αρχικά 50, ετικέτα, τηλέφωνο, email, ΑΦΜ και ραντεβού
// σε δικές τους σειρές: με πέντε επαφές χωρούσαν δύο στην οθόνη του τηλεφώνου.
// Ο,τι ψάχνει κανείς σε μια λίστα επαφών είναι το όνομα και η κλήση. Τώρα, όπως
// στο Mercury Recipients: όνομα, ρόλος από κάτω, κλήση δεξιά. Ολα τα υπόλοιπα
// (στοιχεία, ενέργειες, ιστορικό, QR, διαγραφή) ζουν στο ντοσιέ που ανοίγει η
// γραμμή. Το ληγμένο ραντεβού μένει ορατό, γιατί ζητά κίνηση.
export const CONTACT_ROW_H = 56
/** Τα αρχικά της επαφής: μικρότερα από τη γραμμή, ώστε το όνομα να κρατά το βάρος. */
const AVATAR = 32

export function ContactRow({ contact, onOpen, selected, onSelect, bulkMode, scopePortfolio }: {
  contact: Contact; onOpen: () => void
  selected?: boolean; onSelect?: () => void; bulkMode?: boolean; scopePortfolio?: boolean
}) {
  const meta = roleMeta(contact.role)
  const extra = contact._extra || {}
  const overdue = !!extra.next_appointment && isOverdue(extra.next_appointment)
  const GroupIcon = meta.GroupIcon || Users
  const name = contact.full_name || 'Χωρίς όνομα'
  return (
    <li className="ct-row" data-selected={selected ? '' : undefined}
      style={{ display: 'flex', alignItems: 'center', gap: 4, minHeight: CONTACT_ROW_H, borderTop: '1px solid var(--border-subtle)', background: selected ? 'var(--accent-soft)' : undefined }}>
      {bulkMode && <SelectBox checked={!!selected} onChange={() => onSelect?.()} label={`Επιλογή ${name}`} />}
      <button type="button" className="ct-row-main" onClick={bulkMode ? onSelect : onOpen}
        aria-label={bulkMode ? `Επιλογή ${name}` : undefined}
        style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, minHeight: CONTACT_ROW_H, padding: '8px 4px', border: 0, background: 'transparent', color: 'inherit', textAlign: 'left', cursor: 'pointer', font: 'inherit' }}>
        {extra.avatar_url
          ? <RuntimeImg src={extra.avatar_url} alt="" style={{ width: AVATAR, height: AVATAR, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
          : <span aria-hidden="true" style={{ width: AVATAR, height: AVATAR, borderRadius: '50%', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>{initialsOf(contact.full_name) || <GroupIcon size={14} />}</span>}
        <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="po-elide" title={name} style={{ fontSize: 'var(--fs-md)', fontWeight: 600, lineHeight: 1.3, color: 'var(--text-primary)' }}>{name}</span>
          <span className="po-elide" style={{ fontSize: 'var(--fs-xs)', lineHeight: 1.3, color: overdue ? 'var(--negative)' : 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
            {scopePortfolio && <Globe size={10} aria-label="Όλο το χαρτοφυλάκιο" style={{ flexShrink: 0 }} />}
            {[extra.specialty || meta.label || contact.role, overdue ? 'Ληγμένο ραντεβού' : null].filter(Boolean).join(' · ')}
          </span>
        </span>
      </button>
      {contact.phone && !bulkMode && (
        <a href={'tel:' + contact.phone} aria-label={`Κλήση ${name}`} title={displayPhone(contact.phone)}
          className="ct-row-call"
          style={{ width: T.h.lg, height: T.h.lg, flexShrink: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', textDecoration: 'none' }}>
          <Phone size={17} aria-hidden="true" />
        </a>
      )}
    </li>
  )
}

/** Το περίβλημα της λίστας: μία κάρτα, γραμμές με λεπτό διαχωριστικό. */
export function ContactList({ children }: { children: React.ReactNode }) {
  return (
    <ul data-list className="ct-list" style={{ listStyle: 'none', margin: 0, padding: 0, background: 'var(--surface-raised)', border: '1px solid var(--border-raised)', borderRadius: T.radius.card, boxShadow: 'var(--highlight-inset), var(--elev-1)', overflow: 'hidden' }}>
      <style>{`.ct-row{padding:0 8px 0 12px}.ct-list>.ct-row:first-child{border-top:0}.ct-row-main:focus-visible,.ct-row-call:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}@media (hover:hover){.ct-row:hover{background:var(--bg-hover)}.ct-row-call:hover{background:var(--accent-soft)}}`}</style>
      {children}
    </ul>
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
      <div style={{ width: 140, minWidth: 100, flexShrink: 1, fontSize: 12, color: 'var(--text-secondary)', fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{contact.phone || ABSENT}</div>
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
      <div style={{ width: 120, minWidth: 90, flexShrink: 1, fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{extra.afm ? 'ΑΦΜ ' + extra.afm : ''}</div>
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
// Χωρίς μετρητή: το πλήθος της ομάδας το λέει ήδη το chip της από πάνω
// (αξιολόγηση σχεδίασης 3). Ο ίδιος αριθμός δύο φορές σε 100 εικονοστοιχεία.
export function GroupDivider({ group }: { group: typeof GROUPS[0] }) {
  const GroupIcon = group.Icon
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <div style={{ width: 30, height: 30, borderRadius: T.radius.chip, background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <GroupIcon size={15} color="var(--accent)" />
      </div>
      <span style={{ fontSize: 'var(--fs-base)', fontWeight: 600, lineHeight: 1.3, color: 'var(--accent)', fontFamily: T.font.sans }}>{group.label}</span>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, var(--accent-border), transparent)' }} />
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
