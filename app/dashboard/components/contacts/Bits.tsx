'use client'
// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΜΙΚΡΑ ΚΟΜΜΑΤΙΑ ΤΩΝ ΕΠΑΦΩΝ: ΠΕΔΙΑ, ΕΠΙΚΕΦΑΛΙΔΕΣ, ΕΤΙΚΕΤΕΣ, ΚΟΥΜΠΙΑ
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useContext, createContext, type ElementType } from 'react'
import { X, Copy } from 'lucide-react'
import { InfoDot } from '../UIComponents'
import { T, IconBtn } from '@/components/Theme'
import type { FieldDecision } from '@/lib/property/fields'

// ── Δομικά του ντοσιέ επαφής ──────────────────────────────────────────────
// ΣΕ MODULE SCOPE: ορισμένα μέσα στο DossierPanel, ξαναγεννιούνταν σε κάθε
// render του πάνελ. Ο React έβλεπε νέο τύπο component κάθε φορά, άρα
// αποσυναρμολογούσε και ξανάχτιζε ΟΛΟ το ντοσιέ — δεκαοκτώ κόμβοι, σε κάθε
// πληκτρολόγηση ή ανανέωση. Δεν είναι μόνο σπατάλη: ό,τι state ζει μέσα τους
// (scroll, focus, επιλογή κειμένου) χανόταν.
export const DossierRow = ({ icon: Ic, children, onCopy }: { icon: React.ComponentType<{ size?: number; color?: string; style?: React.CSSProperties }>; children: React.ReactNode; onCopy?: () => void }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
    <Ic size={14} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
    <span style={{ flex: 1, fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', minWidth: 0, wordBreak: 'break-word' }}>{children}</span>
    {onCopy && <IconBtn label="Αντιγραφή" title="Αντιγραφή" onClick={onCopy}><Copy size={13} /></IconBtn>}
  </div>
)
export const DossierSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.card, padding: '15px 16px', boxShadow: 'var(--elev-1)' }}>
    <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>{title}</div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
  </div>
)

// ─── Design System ────────────────────────────────────────────────────────────
export const iStyle: React.CSSProperties = {
  width: '100%', height: T.h.lg, padding: '10px 16px', borderRadius: T.radius.xs,
  border: '1px solid var(--border-default)', background: 'var(--bg-surface)',
  color: 'var(--text-primary)', fontSize: 14, letterSpacing: 0, outline: 'none',
  fontFamily: T.font.sans, boxSizing: 'border-box', transition: 'border-color 0.15s, box-shadow 0.15s',
}
// HTML-escape any dynamic value interpolated into printable/PDF HTML written via document.write.

// ─── Input primitives ─────────────────────────────────────────────────────────
// Το `min` περνά μέχρι το πεδίο: ποσό αμοιβής συνεργείου μείον πενήντα ευρώ
// δεν υπάρχει και το πεδίο δεν έχει λόγο να το δέχεται.
// Ο τύπος ΔΕΝ δέχεται 'date': οι ημερομηνίες αυτής της οθόνης περνούν από τον
// DatePicker, που τον χρησιμοποιεί ήδη τρεις φορές.
// ΤΟ ΟΝΟΜΑ ΤΟΥ ΠΕΔΙΟΥ ΤΟ ΞΕΡΕΙ ΗΔΗ Ο ΓΟΝΕΑΣ, ΚΑΙ ΔΕΝ ΕΦΤΑΝΕ ΠΟΤΕ ΣΤΟ ΠΕΔΙΟ.
// Το `CField` γράφει την ετικέτα («ΟΝΟΜΑ», «ΤΗΛΕΦΩΝΟ», «ΑΦΜ») ως ΑΔΕΛΦΟ του
// κουτιού, όχι συνδεδεμένη με αυτό. Ο βλέπων διαβάζει τη σειρά και καταλαβαίνει·
// ο αναγνώστης οθόνης ακούει «πλαίσιο κειμένου» δεκατέσσερις φορές στη σειρά.
// Το `placeholder` δεν σώζει: σβήνεται με τον πρώτο χαρακτήρα.
//
// ΓΙΑΤΙ ΣΥΜΦΡΑΖΟΜΕΝΑ ΚΑΙ ΟΧΙ ΙΔΙΟΤΗΤΑ ΣΕ ΚΑΘΕ ΚΛΗΣΗ. Οι κλήσεις είναι
// δεκαπέντε και η ετικέτα υπάρχει ΗΔΗ, μία φορά, στο μητρώο πεδίων. Γραμμένη
// ξανά σε κάθε `<Inp>` θα ήταν το ίδιο κείμενο δύο φορές, με τον γνωστό
// επόμενο βαθμό: τη μέρα που αλλάξει η μία και μείνει η άλλη.
const FieldName = createContext<string | undefined>(undefined);

export function Inp({ value, onChange, placeholder, type = 'text', min, ariaLabel }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: 'text' | 'email' | 'tel' | 'url' | 'search' | 'number' | 'password'; min?: number; ariaLabel?: string }) {
  const named = useContext(FieldName);
  return <input type={type} min={min} value={value} aria-label={ariaLabel ?? named} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={iStyle} onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-dim)' }} onBlur={e => { e.target.style.borderColor = 'var(--border-default)'; e.target.style.boxShadow = 'none' }} />
}
export function Txt({ value, onChange, placeholder, rows = 4, ariaLabel }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; ariaLabel?: string }) {
  const named = useContext(FieldName);
  return <textarea value={value} onChange={e => onChange(e.target.value)} aria-label={ariaLabel ?? named} placeholder={placeholder} rows={rows} style={{ ...iStyle, height: 'auto', resize: 'vertical', lineHeight: 1.6 }} onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-dim)' }} onBlur={e => { e.target.style.borderColor = 'var(--border-default)'; e.target.style.boxShadow = 'none' }} />
}
// Πεδίο ΜΕ ΤΟ «ΓΙΑΤΙ» ΤΟΥ, από το μητρώο. Αν το πεδίο δεν αφορά αυτόν τον χρήστη,
// δεν αποδίδεται καθόλου — δεν κλειδώνεται και δεν εμφανίζεται γκριζαρισμένο.
// ═══ ΤΟ «ΓΙΑΤΙ» ΗΤΑΝ ΜΟΝΙΜΗ ΠΑΡΑΓΡΑΦΟΣ ΚΑΤΩ ΑΠΟ ΤΟ ΠΕΔΙΟ ══════════════════════
// Το ΑΦΜ της επαφής κουβαλούσε τέσσερις σειρές κειμένου κάτω από ένα κουτί δύο
// εκατοστών: «Συνδέει τα παραστατικά του με την επαφή. Χωρίς αυτό, το ταίριασμα
// γίνεται με το όνομα και αστοχεί.» Σωστό, χρήσιμο και διαβάζεται ΜΙΑ φορά στη
// ζωή του χρήστη — μετά είναι θόρυβος που ψηλώνει τη φόρμα και σπρώχνει τα
// επόμενα πεδία εκτός οθόνης. Και η ίδια η σειρά έσπαγε τη στοίχιση: το πεδίο
// δίπλα του τελείωνε τέσσερις σειρές ψηλότερα.
//
// Πάει στο κυκλάκι, όπως κάθε εξήγηση της εφαρμογής. Το κείμενο δεν χάνεται
// ούτε για τον αναγνώστη οθόνης: το `InfoDot` το γράφει σε κρυφό κόμβο που
// ανακοινώνεται με το κουμπί του.
export function CField({ d, required, children }: { d?: FieldDecision; required?: boolean; children: React.ReactNode }) {
  if (!d) return null
  return (
    <div>
      <FL>{d.label}{required || d.critical ? ' *' : ''}{!d.selfEvident && d.why ? <InfoDot text={d.why} /> : null}</FL>
      {/* Η ετικέτα που μόλις γράφτηκε ταξιδεύει και ΜΕΣΑ στο πεδίο, ως όνομα για
          τον αναγνώστη οθόνης. Το `why` δεν μπαίνει: είναι περιγραφή, όχι όνομα·
          ένα όνομα δύο προτάσεων ακούγεται σε κάθε εστίαση. */}
      <FieldName.Provider value={d.label}>{children}</FieldName.Provider>
    </div>
  )
}
export function FL({ children }: { children: React.ReactNode }) {
  return <label style={{ display: 'flex', alignItems: 'center', fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: T.font.sans }}>{children}</label>
}
// ΕΔΩ ΗΤΑΝ ΤΟ AddressAutocomplete (52 γραμμές). Έστελνε ΚΑΘΕ πληκτρολόγηση του
// χρήστη σε τρίτο εξυπηρετητή (nominatim.openstreetmap.org) για να προτείνει
// διευθύνσεις: δηλαδή διευθύνσεις γραφείων τρίτων προσώπων έφευγαν εκτός της
// υποδομής μας, χωρίς να αναφέρεται πουθενά στην Πολιτική απορρήτου, στην ίδια
// εφαρμογή που υπόσχεται στον χρήστη ότι ξέρει ποιος βλέπει τα δεδομένα του.
// Και η ίδια η πολιτική χρήσης του Nominatim απαγορεύει ρητά το autocomplete —
// σε παραγωγή η υπηρεσία θα μπλόκαρε και το πεδίο θα σταματούσε σιωπηλά.
// Το πεδίο είναι πλέον απλό κείμενο. Ο χάρτης ανοίγει με ρητό κλικ του χρήστη.

// Επικεφαλίδα ενότητας φόρμας — διακριτική, premium, με λεπτή γραμμή.
export function SecHead({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0 2px' }}>
      <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: T.font.sans, whiteSpace: 'nowrap' }}>{children}</span>
      <span style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
    </div>
  )
}
// Τα αστέρια αξιολόγησης και το «badge κατάστασης σχέσης» έφυγαν: ένα σκορ και μια
// ετικέτα «Προβληματικός» πάνω σε άνθρωπο, χωρίς καμία ενέργεια πίσω τους. Ό,τι
// χρειάζεται ο χρήστης το λένε τα γεγονότα — πληρωμές, παραστατικά, ραντεβού.

// ─── Quick action button (calm, uniform, hover-revealed) ──────────────────────
export function QuickAct({ as, href, target, rel, onClick, title, label, children }: {
  as: 'a' | 'button'; href?: string; target?: string; rel?: string; onClick?: () => void
  title: string; label?: string; children?: React.ReactNode
}) {
  const base: React.CSSProperties = {
    width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    textDecoration: 'none', border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)',
    color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 'var(--fs-xs)', fontWeight: 700, flexShrink: 0,
    transition: 'border-color 0.15s, color 0.15s, background 0.15s', boxShadow: 'var(--elev-1)',
  }
  const enter = (e: React.MouseEvent<HTMLElement>) => { const s = e.currentTarget.style; s.borderColor = 'var(--accent-border)'; s.color = 'var(--accent)'; s.background = 'var(--accent-soft)' }
  const leave = (e: React.MouseEvent<HTMLElement>) => { const s = e.currentTarget.style; s.borderColor = 'var(--border-subtle)'; s.color = 'var(--text-secondary)'; s.background = 'var(--bg-elevated)' }
  const content = children ?? label
  // ΤΟ ΣΤΡΟΓΓΥΛΟ ΤΩΝ 30 ΜΕΝΕΙ 30, Ο ΣΤΟΧΟΣ ΓΙΝΕΤΑΙ 56. Το δάπεδο των 44 του
  // globals.css πιάνει `button`, `select` και `input`: ο σύνδεσμος έμενε στα 30
  // και το κουμπί γινόταν 30 επί 44, δηλαδή δύο ΔΙΑΦΟΡΕΤΙΚΟΙ στόχοι για δύο
  // κουμπιά που φαίνονται ίδια. Το `po-box` τα εξισώνει και στα δύο, χωρίς να
  // πειραχτεί ο κύκλος: αόρατη ζώνη −13 γύρω γύρω.
  // ΜΕΝΕΙ ΧΕΙΡΟΠΟΙΗΤΟ, ΓΙΑ ΔΥΟ ΛΟΓΟΥΣ. Το ίδιο σχήμα βγαίνει άλλοτε <a> άλλοτε
  // <button> με ΤΑΥΤΟΣΗΜΗ όψη — το IconBtn ξέρει μόνο <button>, οπότε η μία από
  // τις δύο μορφές θα άλλαζε. Και ο κύκλος εδώ είναι τονικός (bg-elevated +
  // περίγραμμα + elev-1) ενώ η `.po-ico` είναι διάφανη χωρίς περίγραμμα.
  if (as === 'a') return <a className="po-box" href={href} target={target} rel={rel} title={title} aria-label={title} style={base} onMouseEnter={enter} onMouseLeave={leave}>{content}</a>
  return <button type="button" className="po-box" onClick={onClick} title={title} aria-label={title} style={base} onMouseEnter={enter} onMouseLeave={leave}>{content}</button>
}

// ─── Tag Editor ───────────────────────────────────────────────────────────────
export function TagEditor({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState('')
  const add = (t: string) => { const v = t.trim(); if (v && !tags.includes(v)) onChange([...tags, v]); setInput('') }
  return (
    <div>
      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {tags.map(t => (
            <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 11px', borderRadius: T.radius.pill, background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', fontSize: 12, color: 'var(--accent)', fontWeight: 500 }}>
              {/* ΜΕΝΕΙ ΧΕΙΡΟΠΟΙΗΤΟ ΓΙΑ ΤΗ ΓΕΩΜΕΤΡΙΑ ΤΟΥ ΠΛΑΚΙΔΙΟΥ. Το πλακίδιο είναι ~24
                  ψηλό (12px, γέμισμα 4×11): ένα κουτί T.h.sm των 32 μέσα του θα το
                  φούσκωνε στα 40 σε κάθε ετικέτα. */}
              {t}<button type="button" onClick={() => onChange(tags.filter(x => x !== t))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', display: 'flex', alignItems: 'center', padding: 0 }}><X size={12} /></button>
            </span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={input} aria-label="Νέα ετικέτα" onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add(input))} placeholder="Νέα ετικέτα…" style={{ ...iStyle, flex: 1 }} />
        {/* `size="md"` γιατί κάθεται δίπλα σε πεδίο· το «+» δεν έχει λεκτικό, οπότε το όνομα το δίνει το `label`. */}
        <IconBtn label="Προσθήκη ετικέτας" title="Προσθήκη ετικέτας" tone="accent" size="md" onClick={() => add(input)}>
          <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1 }}>+</span>
        </IconBtn>
      </div>
    </div>
  )
}

// ─── Select Box ───────────────────────────────────────────────────────────────
// Premium custom checkbox (αντικαθιστά το browser default). Υποστηρίζει
// indeterminate για το «κύριο» κουτί επιλογής όλων.
// ─── Bulk Action Button ───────────────────────────────────────────────────────
// Ουδέτερο κουμπί (Google-clean) που αποκαλύπτει accent —ή κόκκινο για διαγραφή—
// μόνο στο hover. Γίνεται ανενεργό/ξεθωριασμένο όταν δεν υπάρχει επιλογή.
// ΜΕΝΕΙ ΧΕΙΡΟΠΟΙΗΤΟ: η «Διαγραφή» ανάβει ΚΟΚΚΙΝΗ στην αιώρηση. Οι τρεις ρόλοι
// του Btn δεν έχουν καταστροφικό τόνο, οπότε η μετάβαση θα έσβηνε το μόνο σημάδι
// που ξεχωρίζει τη διαγραφή από τις άλλες δύο μαζικές ενέργειες.
export function BulkBtn({ icon: Icon, label, onClick, disabled, danger }: { icon: ElementType; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  const [hov, setHov] = useState(false)
  const active = hov && !disabled
  return (
    <button type="button" disabled={disabled} onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 13px', borderRadius: T.radius.chip, fontSize: 'var(--fs-base)', fontWeight: 600, fontFamily: T.font.sans, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1,
        border: '1px solid ' + (active ? (danger ? 'var(--negative-border)' : 'var(--accent-border)') : 'var(--border-subtle)'),
        background: active ? (danger ? 'var(--negative-soft)' : 'var(--accent-soft)') : 'var(--bg-elevated)',
        color: active ? (danger ? 'var(--negative)' : 'var(--accent)') : 'var(--text-secondary)',
        transition: 'background .15s, border-color .15s, color .15s' }}>
      <Icon size={14} />{label}
    </button>
  )
}

// ─── Κουμπί επικοινωνίας (ανάγλυφο, με hover-lift) ──────────────────────────────
export function CommButton({ label, Icon, href, target, accent }: { label: string; Icon: React.ComponentType<{ size?: number }>; href: string; target?: string; accent?: boolean }) {
  const [h, setH] = useState(false)
  return (
    <a href={href} target={target} rel={target ? 'noopener noreferrer' : undefined}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '13px 6px', borderRadius: T.radius.card, cursor: 'pointer', textDecoration: 'none', fontFamily: T.font.sans, background: accent ? 'var(--accent)' : 'var(--bg-surface)', color: accent ? 'var(--accent-text)' : 'var(--text-primary)', border: '1px solid ' + (accent ? 'transparent' : 'var(--border-subtle)'), boxShadow: h ? 'var(--elev-2)' : 'var(--elev-1)', transform: h ? 'translateY(-3px)' : 'none', transition: 'transform .18s cubic-bezier(.2,0,0,1), box-shadow .18s' }}>
      <Icon size={19} /><span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600 }}>{label}</span>
    </a>
  )
}
