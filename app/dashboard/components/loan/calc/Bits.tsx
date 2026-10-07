'use client'
// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΜΙΚΡΑ ΚΟΜΜΑΤΙΑ ΤΟΥ ΥΠΟΛΟΓΙΣΤΗ ΔΑΝΕΙΟΥ: ΕΤΙΚΕΤΑ ΟΜΑΔΑΣ, ΠΤΥΣΣΟΜΕΝΗ
// ΕΝΟΤΗΤΑ, ΥΠΟΛΟΓΙΣΜΕΝΟ ΜΕΓΕΘΟΣ
// ─────────────────────────────────────────────────────────────────────────
// Τα μοιράζονται η καρτέλα και οι φακοί του loan/calc/. Η ενότητα κρατά τη
// δική της κατάσταση «ανοιχτό/κλειστό», όπως όταν ζούσε στο TabLoanCalculator.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from 'react'
import { T, TT } from '@/components/Theme'
import { fieldLabelStyle } from '../../UIComponents'
import { panelStyle } from '../../LoanShared'

/** Ο setter μιας `useState` του υπολογιστή, όπως τον παίρνουν τα κομμάτια του loan/calc/. */
export type SetState<V> = React.Dispatch<React.SetStateAction<V>>

// ── MD3 tokens ────────────────────────────────────────────────────────────────
export const labelStyle: React.CSSProperties = { ...TT.label, display:'block', marginBottom:6 }
export const SectionLabel = ({label,right}:{label:string;right?:React.ReactNode}) => (
  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
    <p style={{fontSize: 'var(--fs-xs)',color:'var(--text-secondary)',textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:700,fontFamily: T.font.sans}}>{label}</p>
    {right}
  </div>
)

export function Section({title,sub,children,defaultOpen=false,badge}:{title:string;sub?:string;children:React.ReactNode;defaultOpen?:boolean;badge?:string}) {
  const [open,setOpen] = useState(defaultOpen)
  return (
    <div style={panelStyle}>
      <button onClick={()=>setOpen(o=>!o)} aria-expanded={open} className="acc-toggle acc-row acc-apart" style={{ '--acc-pad': '16px 16px' }}>
        <div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <p style={{fontSize:14,color:'var(--text-primary)',fontFamily: T.font.sans,fontWeight:600}}>{title}</p>
            {badge&&<span style={{fontSize: 'var(--fs-xs)',padding:'2px 7px',borderRadius: T.radius.chip,background:'var(--bg-surface)',color:'var(--text-secondary)',border:'1px solid var(--border-subtle)',fontFamily: T.font.sans,fontWeight:500}}>{badge}</span>}
          </div>
          {sub&&<p style={{fontSize:12,color:'var(--text-secondary)',marginTop: 4,lineHeight:1.4,fontFamily: T.font.sans}}>{sub}</p>}
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" aria-hidden="true" style={{transform:open?'rotate(180deg)':'none',transition:'transform 0.2s',flexShrink:0}}><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open&&<div style={{padding:'0 16px 16px'}}>{children}</div>}
    </div>
  )
}

// ═══ ΥΠΟΛΟΓΙΣΜΕΝΟ ΜΕΓΕΘΟΣ, ΟΧΙ ΠΕΔΙΟ ════════════════════════════════════════
// Η «Τιμή ανά τ.μ.» και η «Αμοιβή μεσίτη» ζωγραφίζονταν ως κουτιά πεδίου με
// δεξιά στοίχιση, ανάμεσα σε πραγματικά πεδία με αριστερή: έμοιαζαν με πεδίο
// που δεν πατιέται. Είναι αποτέλεσμα και φαίνονται ως αποτέλεσμα: ετικέτα και
// τιμή, στο ύψος των πεδίων ώστε η σειρά να μένει ευθεία.
export function ReadStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={fieldLabelStyle}>{label}</span>
      <div style={{height:T.h.lg,display:'flex',alignItems:'center'}}>
        <span style={{fontSize:14,fontFamily:T.font.sans,fontVariantNumeric:'tabular-nums',color:'var(--text-primary)',fontWeight:600}}>{value}</span>
      </div>
    </div>
  )
}
