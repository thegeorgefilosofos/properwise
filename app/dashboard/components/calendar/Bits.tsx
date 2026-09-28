'use client'
// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΜΙΚΡΑ ΚΟΜΜΑΤΙΑ ΤΟΥ ΗΜΕΡΟΛΟΓΙΟΥ: ΣΥΜΒΟΥΛΗ ΚΑΙ ΤΕΛΕΙΑ ΚΑΤΑΣΤΑΣΗΣ
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { T } from '@/components/Theme'
import { type EventStatus, STATUSES } from './model'

// Google-style tooltip — portal ώστε να ΜΗΝ κόβεται από overflow (π.χ. στα κελιά του μήνα).
// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ `inline-flex` ΤΟΥ TOOLTIP ΕΙΝΑΙ ΠΟΥ ΕΣΠΑΣΕ ΤΙΣ ΜΠΑΡΕΣ ΔΙΑΜΟΝΗΣ
// ─────────────────────────────────────────────────────────────────────────
// Το περιτύλιγμα είναι σωστό για ό,τι τυλίγει μέχρι σήμερα: ένα εικονίδιο, ένα
// σήμα, ένα κουμπί — πράγματα που ΠΡΕΠΕΙ να έχουν το πλάτος του περιεχομένου
// τους. Για κάτι που πρέπει να ΓΕΜΙΣΕΙ τον χώρο του όμως, το `inline-flex`
// είναι παγίδα: το παιδί γίνεται στοιχείο ευέλικτου δοχείου και ένα
// `width:'100%'` επάνω του μετρά το 100% ΤΟΥ ΙΔΙΟΥ του περιεχομένου. Δηλαδή
// κυκλικά: πλάτος όσο το κείμενο, όσο μεγάλο κι αν είναι το δοχείο.
//
// Γι' αυτό η κράτηση τεσσάρων νυχτών φαινόταν σαν ένα χάπι, τρία κενά κελιά και
// μια γραμμούλα. Το `fill` το λύνει ρητά, χωρίς να αλλάξει τίποτα στις
// υπόλοιπες τριάντα χρήσεις.
export function Tooltip({ text, children, fill }: { text: string; children: React.ReactNode; fill?: boolean }) {
  const [show, setShow] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left:number; top:number; below:boolean }>({ left:0, top:0, below:false })
  const W = 280
  const place = () => { const el=ref.current; if(!el)return; const r=el.getBoundingClientRect(); const below=r.top<170; const cx=r.left+r.width/2; const left=Math.max(8+W/2, Math.min(cx, window.innerWidth-8-W/2)); setPos({ left, top: below?r.bottom+8:r.top-8, below }) }
  useEffect(()=>{ if(!show)return; place(); const s=()=>place(); window.addEventListener('scroll',s,true); window.addEventListener('resize',s); return ()=>{ window.removeEventListener('scroll',s,true); window.removeEventListener('resize',s) } },[show])
  return (
    <div ref={ref} style={fill?{ display:'flex', width:'100%', height:'100%' }:{ display:'inline-flex' }} onMouseEnter={()=>setShow(true)} onMouseLeave={()=>setShow(false)}>
      {children}
      {show && text && createPortal(
        <div style={{ position:'fixed', left:pos.left, top:pos.top, transform:`translate(-50%, ${pos.below?'0':'-100%'})`, background:'var(--bg-elevated)', border:'1px solid var(--border-default)', borderRadius: T.radius.chip, padding:'9px 13px', fontSize:12, lineHeight:1.5, color:'var(--text-primary)', fontFamily: T.font.sans, zIndex:3000, pointerEvents:'none', width:W, maxWidth:'calc(100vw - 16px)', whiteSpace:'pre-wrap' as const, boxShadow:'var(--elev-3)' }}>
          {text}
        </div>, document.body)}
    </div>
  )
}

export function StatusDot({ status }: { status: EventStatus }) {
  const s = STATUSES[status]
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:12, fontFamily: T.font.sans, color:s.color, letterSpacing:'0.25px' }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:s.color, display:'inline-block', flexShrink:0 }}/>
      {s.label}
    </span>
  )
}
