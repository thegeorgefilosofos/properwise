'use client'
// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΜΙΚΡΑ ΚΟΜΜΑΤΙΑ ΤΗΣ ΛΟΓΙΣΤΙΚΗΣ: ΚΑΡΤΑ, ΠΤΥΣΣΟΜΕΝΗ ΕΝΟΤΗΤΑ, ΚΟΥΤΑΚΙ,
// ΠΛΑΚΙΔΙΟ, ΣΥΝΔΕΣΜΟΣ ΠΡΟΣ ΤΑ ΕΞΩ
// ═══════════════════════════════════════════════════════════════════════════
import { T, TT } from '@/components/Theme'
import { ChevronRight, ArrowUpRight } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════════
// Ο ΣΥΝΔΕΣΜΟΣ ΠΡΟΣ ΤΑ ΕΞΩ, ΓΡΑΜΜΕΝΟΣ ΜΙΑ ΦΟΡΑ
// ─────────────────────────────────────────────────────────────────────────
// ΗΤΑΝ ΓΡΑΜΜΕΝΟΣ ΔΥΟ ΦΟΡΕΣ, ΠΕΝΗΝΤΑ ΓΡΑΜΜΕΣ ΜΑΚΡΙΑ: μία στις ενέργειες
// («Περισσότερα») και μία στις αλλαγές του έτους («Πηγή»), με πανομοιότυπο
// ενσώματο στυλ. Ο σαρωτής ανέφερε στόχο αφής 18 εικονοστοιχείων και η
// διόρθωση έμπαινε στο ΕΝΑ αντίγραφο: η μέτρηση συνέχιζε να κοκκινίζει και το
// σφάλμα έμοιαζε άλυτο, ενώ απλώς διορθωνόταν λάθος σημείο. Δύο αντίγραφα του
// ίδιου στοιχείου σημαίνουν ότι κάθε διόρθωση έχει πενήντα τοις εκατό να πιάσει.
//
// ΤΟ `.tap-link` ΕΙΝΑΙ ΤΟ ΙΔΙΩΜΑ ΤΟΥ ΕΡΓΟΥ ΓΙ' ΑΥΤΗ ΤΗΝ ΠΕΡΙΠΤΩΣΗ: σύνδεσμος
// που ΔΕΝ ζει μέσα σε πρόταση παίρνει κανονικό ύψος 44 και κεντράρει το κείμενό
// του, μόνο σε οθόνη αφής. Στο ποντίκι η γραμμή μένει όσο ήταν.
// ═══════════════════════════════════════════════════════════════════════════
export function OutLink({ href, label }: { href: string; label: string }) {
  return (
    <a className="tap-link" href={href} target="_blank" rel="noreferrer"
      style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:12, color:'var(--accent)', textDecoration:'none', fontFamily: T.font.sans }}>
      {label}<ArrowUpRight size={12}/>
    </a>
  )
}

// Κάρτα λογιστικής: καθαρή, ανασηκωμένη με σκιά (3D) αλλά ΧΩΡΙΣ λευκό περίγραμμα/
// γυαλάδα (highlight-inset). Ήσυχο, Stripe/Apple αίσθηση, ομοιόμορφο σε όλο το tab.
// Κάρτα: ΚΑΜΙΑ ορατή περίμετρος (το «λευκό γύρω γύρω»). Το βάθος/ζωντάνια έρχεται
// αποκλειστικά από την ανασηκωμένη επιφάνεια + τη σκιά, όπως σε Apple/Stripe.
export const card:React.CSSProperties = { position:'relative', background:'var(--surface-raised)', border:'none', borderRadius: T.radius.card, padding:16, boxShadow:'var(--elev-1)' }
export const cardTitle:React.CSSProperties = { fontSize: 'var(--fs-base)', fontWeight:700, color:'var(--text-primary)', margin:'0 0 14px', fontFamily: T.font.sans, letterSpacing:'0.1px' }

/**
 * ΚΑΘΕ ΚΑΡΤΑ ΤΗΣ ΛΟΓΙΣΤΙΚΗΣ ΜΑΖΕΥΕΙ.
 *
 * ΤΙ ΕΛΕΙΠΕ, ΜΕΤΡΗΜΕΝΟ: δεκατρείς κάρτες στην οθόνη και μόνο ΤΕΣΣΕΡΙΣ με
 * χειριστήριο σύμπτυξης. Το Βιβλίο Εσόδων-Εξόδων, το Ισοζύγιο διπλογραφικής και
 * η Ενοποίηση χαρτοφυλακίου είναι πίνακες δεκάδων γραμμών ο καθένας: ο
 * ιδιοκτήτης που θέλει να δει τη Συμφωνία ενοικίων κυλούσε από πάνω τους κάθε
 * φορά, χωρίς τρόπο να τους κλείσει.
 *
 * ΚΑΙ ΤΑ ΤΕΣΣΕΡΑ ΠΟΥ ΥΠΗΡΧΑΝ ΗΤΑΝ ΓΡΑΜΜΕΝΑ ΤΕΣΣΕΡΙΣ ΦΟΡΕΣ, με το χέρι, με
 * μικρές διαφορές: δύο από αυτά ξέχασαν το `aria-expanded`, δηλαδή ο αναγνώστης
 * οθόνης δεν άκουγε αν η ενότητα είναι ανοιχτή ή κλειστή και καμία σάρωση δεν
 * μπορούσε να τα ανοίξει για να μετρήσει το περιεχόμενό τους.
 *
 * Εδώ γράφεται ΜΙΑ φορά: βελάκι που γυρίζει, τίτλος, προαιρετικό δεξί στοιχείο
 * που μένει ορατό και όταν η κάρτα είναι κλειστή (ένα σύνολο δεν χρειάζεται
 * άνοιγμα για να διαβαστεί).
 */
export function Fold({ open, onToggle, title, sub, right, children }: {
  open: boolean; onToggle: () => void; title: React.ReactNode;
  sub?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div style={card}>
      <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
        {/* ══ ΤΟ `minWidth: 0` ΕΠΙΤΡΕΠΕΙ ΑΠΕΡΙΟΡΙΣΤΗ ΣΥΝΘΛΙΨΗ ══════════════════
            ΜΕΤΡΗΜΕΝΟ ΣΤΑ 320 ΜΕ ΚΕΙΜΕΝΟ ×1,3: ο τίτλος «Συμφωνία ενοικίων»
            έμενε σε κουμπί ΕΙΚΟΣΙ εικονοστοιχείων. Η σειρά έχει `flexWrap`,
            άρα υπήρχε ο χώρος να κατέβει το δεξί μέρος από κάτω — αλλά με
            `flex:1` και `minWidth:0` το flexbox προτιμά να συνθλίψει το
            εύκαμπτο στοιχείο παρά να τυλίξει. Το κουμπί γινόταν στόχος αφής
            20px αντί για 44 και ο τίτλος ξεχείλιζε έξω από το κουτί του.
            Με βάση 190 (ποτέ πάνω από το πλάτος του γονέα) η σειρά τυλίγεται
            όπως σχεδιάστηκε. */}
        {/* ΜΕΝΕΙ ΧΕΙΡΟΠΟΙΗΤΟ: το `aria-expanded` δεν περνά σε κανένα πρωτογενές. Το
            ChipToggle λέει `aria-pressed` («πατημένο»), που είναι άλλη πληροφορία:
            ο αναγνώστης οθόνης θα έπαυε να ακούει αν η ενότητα είναι ανοιχτή. */}
        <button type="button" onClick={onToggle} aria-expanded={open} className="acc-toggle"
          style={{ display:'flex', alignItems:'center', gap: 8, flex:'1 1 190px', minWidth:'min(100%, 190px)', background:'none', border:'none', padding:0, cursor:'pointer', textAlign:'left', fontFamily: T.font.sans }}>
          <ChevronRight size={16} aria-hidden style={{ color:'var(--text-tertiary)', flexShrink:0, transform:open?'rotate(90deg)':'none', transition:'transform 0.18s' }}/>
          <span style={{ minWidth:0 }}>
            <span style={{ ...cardTitle, margin:0, display:'block' }}>{title}</span>
            {sub&&<span style={{ fontSize:12, color:'var(--text-tertiary)', fontFamily: T.font.sans, fontWeight:400, display:'block', marginTop: 4 }}>{sub}</span>}
          </span>
        </button>
        {right}
      </div>
      {open&&<div style={{ marginTop:14 }}>{children}</div>}
    </div>
  )
}

// Minimal, premium checkbox (Google-level): μικρό, καθαρό, με ήπιο animation.
export function Check({ checked, onChange, label, hint, align='center' }:{ checked:boolean; onChange:(v:boolean)=>void; label:React.ReactNode; hint?:string; align?:'center'|'start' }){
  // ΜΕΝΕΙ ΧΕΙΡΟΠΟΙΗΤΟ: `role="checkbox"` με `aria-checked`. Το μόνο πρωτογενές με
  // κατάσταση είναι το ChipToggle · λέει `aria-pressed`, δηλαδή «πατημένο» αντί για
  // «επιλεγμένο» · κι έχει δικό του κουτί αντί για το ζωγραφισμένο τετραγωνάκι.
  return (
    <button type="button" role="checkbox" aria-checked={checked} onClick={()=>onChange(!checked)} title={hint}
      style={{ display:'inline-flex', alignItems:align==='start'?'flex-start':'center', gap: 8, background:'none', border:'none', padding:0, cursor:'pointer', fontSize: 'var(--fs-base)', color:'var(--text-secondary)', fontFamily: T.font.sans, textAlign:'left', lineHeight:1.5 }}>
      <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:17, height:17, borderRadius: T.radius.xs, border:`1.5px solid ${checked?'var(--accent)':'var(--border-default)'}`, background:checked?'var(--accent)':'var(--bg-surface)', transition:'border-color 0.14s, background 0.14s', flexShrink:0, marginTop:align==='start'?1:0 }}>
        {checked&&<svg aria-hidden="true" width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2.5 6.3l2.2 2.2L9.5 3.6" stroke="var(--accent-text)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      </span>
      <span>{label}</span>
    </button>
  )
}

// ═══ ΕΝΑΣ ΑΡΙΘΜΟΣ· Ο ΜΟΝΟΣ ΠΟΥ ΔΕΝ ΓΡΑΦΕΤΑΙ ΑΛΛΟΥ ═══════════════════════════
// ΠΕΝΤΕ, ΜΕΤΑ ΤΡΙΑ, ΜΕΤΑ ΔΥΟ, ΤΩΡΑ ΕΝΑΣ. Και κάθε φορά ο λόγος ήταν ο ίδιος:
// τα πλακίδια έγραφαν νούμερα που η Κατάσταση Αποτελεσμάτων γράφει από κάτω
// τους. «Μεικτά έσοδα», «Φόρος εισοδήματος», «Καθαρό αποτέλεσμα» και τελευταίο
// το «Ταμειακό υπόλοιπο»: ο ίδιος αριθμός, δύο φορές, σε απόσταση μιας ανάσας.
//
// Ο ΦΟΡΟΣ ΜΕΝΕΙ ΓΙΑΤΙ ΕΙΝΑΙ ΑΘΡΟΙΣΜΑ ΠΟΥ ΔΕΝ ΤΟ ΚΑΝΕΙ ΚΑΝΕΙΣ ΑΛΛΟΣ. Η Κατάσταση
// δείχνει φόρο εισοδήματος, ΕΝΦΙΑ και τέλη ως ΞΕΧΩΡΙΣΤΕΣ γραμμές και δεν τις
// αθροίζει ποτέ. Και είναι το μόνο νούμερο της οθόνης που κοιτάζει μπροστά.
//
// ΧΩΡΙΣ `tone`: το πλακίδιο ήταν χρωματιστό όταν το ταμείο έβγαινε αρνητικό.
// Ο φόρος δεν είναι ποτέ αρνητικός, οπότε η ιδιότητα δεν είχε πια καλούντα.
export function Kpi({ label, value, note, hot, onHover }:{
  label:string; value:string; note:React.ReactNode; hot:boolean; onHover:(v:boolean)=>void
}){
  return (
    <div onMouseEnter={()=>onHover(true)} onMouseLeave={()=>onHover(false)}
      style={{ ...card, padding:'18px 20px', minWidth:0, borderColor:hot?'var(--border-default)':undefined, transition:'border-color 0.15s' }}>
      <p style={{ ...TT.label, color:'var(--text-tertiary)', margin:0 }}>{label}</p>
      <p style={{ ...TT.kpi, fontSize:24, color:hot?'var(--accent)':'var(--text-primary)', margin:'11px 0 0', transition:'color 0.15s' }}>{value}</p>
      <p style={{ fontSize:12, color:'var(--text-tertiary)', margin:'9px 0 0', fontFamily: T.font.sans, lineHeight:1.5 }}>{note}</p>
    </div>
  )
}
