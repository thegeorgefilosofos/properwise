'use client'
// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΜΙΚΡΑ ΚΟΜΜΑΤΙΑ ΤΗΣ ΚΑΡΤΕΛΑΣ ΔΑΝΕΙΟΥ: ΠΑΝΕΛ, ΕΝΟΤΗΤΕΣ, ΓΡΑΜΜΕΣ, ΣΥΝΔΕΣΜΟΙ,
// ΤΟ ΔΙΑΓΡΑΜΜΑ ΤΟΥ EURIBOR
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useRef } from 'react'
import { fp } from '@/lib/core/format'
import { T } from '@/components/Theme'
import { hy } from '@/components/Hyphen'
import { panelStyle } from '../LoanShared'
import { MONTHS_SHORT } from '@/lib/core/months'
import { useChartWidth } from '@/app/hooks/useChartWidth'

// Επικεφαλίδα ενεργού φακού — ο τίτλος τον οποίο το LensBar έχει επιλέξει.
// ══ Ο ΤΙΤΛΟΣ ΤΟΥ ΦΑΚΟΥ ΓΡΑΦΟΤΑΝ ΔΥΟ ΦΟΡΕΣ, ΣΕ ΑΠΟΣΤΑΣΗ ΔΕΚΑ ΕΙΚΟΝΟΣΤΟΙΧΕΙΩΝ
//
// Η μπάρα από πάνω δείχνει ΗΔΗ ποιος φακός είναι ανοιχτός: το κουμπί είναι
// φωτισμένο, με έντονα γράμματα και δικό του φόντο. Αμέσως από κάτω το πάνελ
// ξανάγραφε τις ίδιες λέξεις ως επικεφαλίδα — «Το δάνειό σου» πάνω από «Το
// δάνειό σου», «Οδηγός» πάνω από «Οδηγός δανείου». Η επιλογή που μόλις έκανε ο
// χρήστης δεν χρειάζεται επιβεβαίωση σε δεύτερη γραμμή.
//
// Ο ΥΠΟΤΙΤΛΟΣ ΜΕΝΕΙ, ΓΙΑΤΙ ΛΕΕΙ ΚΑΤΙ ΑΛΛΟ: «Βάσει 148.000,00€ / 25 χρόνια, από
// τον Υπολογιστή» ή «7 τράπεζες, επιβεβαιωμένα 08/07/2026». Αυτό δεν το λέει η
// μπάρα και είναι ο λόγος που ο αναγνώστης εμπιστεύεται ό,τι ακολουθεί.
//
// Ο τίτλος μένει στον τύπο και πηγαίνει στον αναγνώστη οθόνης: η μπάρα δίνει
// `aria-pressed`, όχι επικεφαλίδα, οπότε χωρίς αυτόν η περιοχή θα ήταν ανώνυμη
// στην πλοήγηση ανά επικεφαλίδα.
export function LensPanel({title,subtitle,right,children}:{title:string;subtitle?:string;right?:React.ReactNode;children:React.ReactNode}) {
  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}} aria-label={title} role="group">
      {(subtitle||right)&&(
      <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:12,flexWrap:'wrap',padding:'2px 2px 0'}}>
        {subtitle
          ? <p style={{fontSize:12,color:'var(--text-tertiary)',fontFamily: T.font.sans,minWidth:0}}>{subtitle}</p>
          : <span/>}
        {right}
      </div>
      )}
      {children}
    </div>
  )
}

// Πτυσσόμενη υπο-ενότητα — premium, διακριτική· ο τίτλος και προαιρετικά
// badges/meta μένουν ορατά, οι λεπτομέρειες ανοίγουν με κλικ (όχι ατέρμονες λίστες).
// ΕΛΕΓΧΟΜΕΝΗ Η ΑΥΤΟΝΟΜΗ. Οι περισσότερες ενότητες κρατούν μόνες τους το άνοιγμά
// τους· μία όμως πρέπει να ανοίγει και απο ΑΛΛΟΥ (ο «Οδηγός» στέλνει στα
// «Απαραίτητα έγγραφα», που ζουν μέσα στον Υπολογιστή). Οταν δίνεται `open`,
// η κατάσταση ανήκει στον γονέα — ίδιο ιδίωμα με το Foldable του ΕΝΦΙΑ.
export function MiniSection({title,badges,meta,defaultOpen,order,flat,open:openProp,onToggle,children}:{title:string;badges?:React.ReactNode;meta?:React.ReactNode;defaultOpen?:boolean;order?:number;flat?:boolean;open?:boolean;onToggle?:(v:boolean)=>void;children:React.ReactNode}) {
  const [openOwn,setOpenOwn] = useState(!!defaultOpen)
  const open = openProp ?? openOwn
  const setOpen = (fn:(o:boolean)=>boolean) => { const next = fn(open); if (onToggle) { onToggle(next) } else { setOpenOwn(next) } }
  // flat: χωρίς περίγραμμα/φόντο — για ένθετες ενότητες, ώστε να μη διπλασιάζεται το πλαίσιο.
  return (
    <div style={flat
      ? {order,borderTop:'1px solid var(--border-subtle)'}
      : {order,...panelStyle,border:`1px solid ${open?'var(--border-default)':'var(--border-raised)'}`,transition:'border-color 0.2s'}}>
      <button onClick={()=>setOpen(o=>!o)} aria-expanded={open} className="acc-toggle acc-row acc-apart" style={{ '--acc-pad': flat ? '12px 2px' : '16px 16px' }}>
        <div style={{display:'flex',alignItems:'center',gap:10,minWidth:0,flexWrap:'wrap'}}>
          <span style={{fontSize:flat?13:15,fontWeight:600,color:'var(--text-primary)',fontFamily: T.font.sans,letterSpacing:'-0.01em'}}>{title}</span>
          {badges}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
          {meta}
          <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" style={{transform:open?'rotate(180deg)':'none',transition:'transform 0.2s'}}><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </button>
      {open&&<div style={{padding:flat?'0 2px 6px':'0 18px 18px'}}>{children}</div>}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ΜΙΑ ΓΡΑΜΜΗ ΕΥΡΗΜΑΤΟΣ ΚΑΙ ΤΟ ΤΕΤΑΡΤΟ ΠΛΑΙΣΙΟ ΦΕΥΓΕΙ
// ─────────────────────────────────────────────────────────────────────────
// Τέσσερις λίστες αυτής της καρτέλας έλεγαν το ίδιο πράγμα με τέσσερα σχήματα:
// «Στρατηγική ανά προφίλ», «Τι βλέπω στο σενάριό σου», «Επιλεξιμότητα κρατικών
// προγραμμάτων» και «Τι μπορείς να βελτιώσεις». Καθεμιά έφτιαχνε ΔΙΚΟ ΤΗΣ κουτί
// μέσα στο κουτί της ενότητας, που ζει μέσα στο κουτί του φακού: τρία
// περιγράμματα για να διαβαστεί μία πρόταση.
//
// ΚΑΙ ΤΟ 3px ΑΡΙΣΤΕΡΟ ΠΕΡΙΘΩΡΙΟ ΔΕΝ ΣΗΜΑΙΝΕ ΤΙΠΟΤΑ. Ηταν στο ΙΔΙΟ χρώμα με το
// υπόλοιπο περίγραμμα, δηλαδή μια αριστερή ακμή λίγο πιο χοντρή — και μπήκε σε
// δύο από τις τέσσερις σειρές της ίδιας λίστας, όχι στις άλλες δύο. Οταν ένα
// στοιχείο ύφους εμφανίζεται άλλοτε ναι και άλλοτε όχι μέσα στην ίδια λίστα,
// δεν είναι έμφαση: είναι απροσεξία και τη βλέπει ο χρήστης.
//
// Μένει λεπτή γραμμή ανάμεσα, το ίδιο ιδίωμα με τα υπόλοιπα εργαλεία.
// ═══════════════════════════════════════════════════════════════════════════
export function FindingRow({lead,title,body,right,last}:{lead?:React.ReactNode;title:React.ReactNode;body?:React.ReactNode;right?:React.ReactNode;last?:boolean}) {
  return (
    <div style={{display:'flex',alignItems:'flex-start',gap:12,padding:'12px 0',borderBottom:last?'none':'1px solid var(--border-subtle)'}}>
      {lead}
      <div style={{flex:1,minWidth:0}}>
        <p style={{fontSize: 'var(--fs-base)',fontWeight:500,fontFamily: T.font.sans,color:'var(--text-primary)',lineHeight:1.45}}>{title}</p>
        {/* ΚΑΜΙΑ ΜΟΝΗ ΛΕΞΗ ΣΕ ΔΕΥΤΕΡΗ ΓΡΑΜΜΗ. Το κείμενο έσπαγε αφήνοντας το
            «τόκους.» ολομόναχο από κάτω: μια σχεδόν άδεια γραμμή που κάνει τη
            σειρά να φαίνεται δύο φορές ψηλότερη απ' όσο χρειάζεται. Το
            `pretty` μοιράζει τις τελευταίες δύο γραμμές ώστε να μη μένει
            ορφανή λέξη, χωρίς να κόψει τίποτα από το νόημα. */}
        {body&&<p className="po-prose po-just" style={{fontSize:12,color:'var(--text-secondary)',fontFamily: T.font.sans,marginTop: 4}}>{hy(<>{body}</>)}</p>}
      </div>
      {right}
    </div>
  )
}

// Ατομικά πτυσσόμενη σειρά — κλειστή δείχνει μόνο τον τίτλο με βέλος δεξιά·
// με κλικ αποκαλύπτεται η περιγραφή και ο σύνδεσμος. Ήσυχη, ομοιόμορφη,
// χωρίς γαλάζια διακόσμηση (το βέλος περιστρέφεται 180° στο άνοιγμα).
export function CatRow({title,desc,url,linkLabel,last}:{title:string;desc:string;url?:string|null;linkLabel:string;last?:boolean}) {
  const [open,setOpen] = useState(false)
  return (
    <div style={{borderBottom:last?'none':'1px solid var(--border-subtle)'}}>
      <button onClick={()=>setOpen(o=>!o)} aria-expanded={open} className="acc-toggle acc-row acc-apart" style={{ '--acc-pad': '12px 2px' }}>
        <span style={{fontSize: 'var(--fs-base)',fontWeight:600,fontFamily: T.font.sans,color:'var(--text-primary)',minWidth:0}}>{title}</span>
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" style={{flexShrink:0,transform:open?'rotate(180deg)':'none',transition:'transform 0.2s'}}><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open&&(
        <p className="po-prose po-just" style={{fontSize:12,color:'var(--text-secondary)',fontFamily: T.font.sans,padding:'0 2px 12px'}}>{hy(<>{desc}{url&&<> <InlineLink href={url}>{linkLabel}</InlineLink></>}</>)}</p>
      )}
    </div>
  )
}

// Διακριτικός σύνδεσμος μέσα σε κείμενο: ουδέτερος, αποκτά χρώμα μόνο στο πέρασμα
// του κέρσορα/δαχτύλου. Καθαρό, premium, χωρίς μόνιμο γαλάζιο.
export function InlineLink({href,children}:{href:string;children:React.ReactNode}) {
  const [h,setH] = useState(false)
  return (
    <a href={href} target="_blank" rel="noreferrer"
      onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)} onFocus={()=>setH(true)} onBlur={()=>setH(false)}
      style={{color:h?'var(--accent)':'var(--text-secondary)',textDecoration:'none',fontWeight:500,borderBottom:`1px solid ${h?'var(--border-accent)':'var(--border-default)'}`,transition:'color 0.15s, border-color 0.15s'}}>{children}</a>
  )
}

// Κουμπί-σύνδεσμος επίσημης πηγής: ουδέτερο, αποκτά γαλάζιο μόνο στο πέρασμα του
// κέρσορα (ίδια λογική με τα υπόλοιπα· κανένα μόνιμο γαλάζιο).
export function SourceLinkPill({href,children}:{href:string;children:React.ReactNode}) {
  const [h,setH] = useState(false)
  return (
    <a href={href} target="_blank" rel="noreferrer"
      onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)} onFocus={()=>setH(true)} onBlur={()=>setH(false)}
      style={{display:'inline-flex',alignItems:'center',gap:6,padding:'0 16px',height:T.h.md,borderRadius: T.radius.modal,
        background:h?'var(--accent-dim)':'var(--bg-surface)',border:`1px solid ${h?'var(--border-accent)':'var(--border-subtle)'}`,
        color:h?'var(--accent)':'var(--text-secondary)',fontSize: 'var(--fs-base)',fontFamily: T.font.sans,textDecoration:'none',fontWeight:600,
        transition:'color 0.15s, background 0.15s, border-color 0.15s'}}>{children}</a>
  )
}

// Τυποποιημένη κάρτα-σύνδεσμος για επίσημες πηγές: ενιαία στοίχιση, ήπιο βάθος,
// τίτλος και εικονίδιο αποκτούν χρώμα μόνο στο hover. Καμία «λίστα σούπερ μάρκετ».
/* ═══ Η ΚΑΡΤΑ ΠΗΓΗΣ ΕΚΟΒΕ ΤΑ ΔΙΚΑ ΤΗΣ ΛΟΓΙΑ ══════════════════════════════════
   Ο τίτλος και η επεξήγηση ήταν και οι δύο `nowrap` με αποσιωπητικά, μέσα σε
   πλέγμα που δίνει στήλη 300 εικονοστοιχείων. Μετρημένο στον σαρωτή διάταξης,
   σε είκοσι δύο πλάτη: «Κατάλογος αδειοδοτημένων ε…» με 157 εικονοστοιχεία
   κομμένα, «Ελληνική Αναπτυξιακή Τράπε…» με 13, «Ανεξάρτητη αρχή, εξωδικαστ…»
   με 7 — δεκαεπτά κάρτες συνολικά.

   ΤΑ ΑΠΟΣΙΩΠΗΤΙΚΑ ΕΙΝΑΙ ΓΙΑ ΔΕΔΟΜΕΝΑ ΤΟΥ ΧΡΗΣΤΗ, ΟΧΙ ΓΙΑ ΔΙΚΑ ΜΑΣ ΛΟΓΙΑ. Το
   όνομα ενός ανθρώπου ή ενός ακινήτου δεν έχει ταβάνι και κόβεται κομψά· αυτό
   το δηλώνει η κλάση `.po-elide`. Τα λεκτικά ΕΔΩ τα γράψαμε εμείς, ξέρουμε το
   μήκος τους και δεν έχουν λόγο να μη χωρούν: τυλίγονται σε δεύτερη γραμμή και
   διαβάζονται ολόκληρα. Οι κάρτες μιας σειράς τεντώνονται ήδη στο ίδιο ύψος.

   ΚΑΙ Η ΚΑΘΕΤΗ ΣΤΟΙΧΙΣΗ ΠΑΕΙ ΣΤΗΝ ΚΟΡΥΦΗ. Με κεντραρισμένη, μια κάρτα δύο
   γραμμών δίπλα σε μια κάρτα μιας γραμμής έβγαζε τους δύο τίτλους σε άλλο ύψος
   και η σειρά δεν διαβαζόταν οριζόντια. */
export function LinkCard({href,label,sub}:{href:string;label:string;sub?:string}) {
  const [h,setH] = useState(false)
  return (
    <a href={href} target="_blank" rel="noreferrer"
      onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)} onFocus={()=>setH(true)} onBlur={()=>setH(false)}
      style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,padding:'11px 14px',background:'var(--bg-surface)',
        border:`1px solid ${h?'var(--border-default)':'var(--border-subtle)'}`,borderRadius:10,textDecoration:'none',
        transition:'border-color 0.15s, box-shadow 0.15s',boxShadow:h?'0 1px 2px color-mix(in srgb, var(--text-primary) 7%, transparent)':'none'}}>
      <div style={{minWidth:0}}>
        <p style={{fontSize: 'var(--fs-base)',color:h?'var(--accent)':'var(--text-primary)',fontWeight:500,fontFamily: T.font.sans,lineHeight:1.4,transition:'color 0.15s'}}>{label}</p>
        {sub&&<p style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',marginTop:2,fontFamily: T.font.sans,lineHeight:1.45}}>{sub}</p>}
      </div>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={h?'var(--accent)':'var(--text-tertiary)'} strokeWidth="2" style={{flexShrink:0,marginTop:4,transition:'stroke 0.15s'}} aria-hidden="true"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
    </a>
  )
}

// Bespoke minimal γράφημα Euribor — καθαρή περιοχή/γραμμή, σημεία υψηλού/χαμηλού
// και τρέχοντος, χωρίς βιβλιοθήκη. Επαγγελματικό, ήσυχο, χωρίς θόρυβο.
const euFmtDate=(d:string)=>{ const [y,m]=d.split('-'); return `${MONTHS_SHORT[(Number(m)||1)-1]} ${y}` }
export function EuriborArea({data}:{data:{date:string;val:number}[]}) {
  const [hi,setHi]=useState<number|null>(null)
  const wrapRef=useRef<HTMLDivElement>(null)
  const [svgRef,W]=useChartWidth(620)
  const H=160,padL=6,padR=10,padT=18,padB=22
  const n=data.length
  if(n<2) return null
  const vals=data.map(d=>d.val)
  const maxV=Math.max(...vals), minRaw=Math.min(...vals), minV=Math.min(minRaw,0)
  const range=(maxV-minV)||1
  const X=(i:number)=> padL+(i/(n-1))*(W-padL-padR)
  const Y=(v:number)=> padT+(1-(v-minV)/range)*(H-padT-padB)
  const line=data.map((d,i)=>`${i===0?'M':'L'} ${X(i).toFixed(1)} ${Y(d.val).toFixed(1)}`).join(' ')
  const area=`M ${X(0).toFixed(1)} ${Y(minV).toFixed(1)} `+data.map((d,i)=>`L ${X(i).toFixed(1)} ${Y(d.val).toFixed(1)}`).join(' ')+` L ${X(n-1).toFixed(1)} ${Y(minV).toFixed(1)} Z`
  const maxI=vals.indexOf(maxV), minI=vals.indexOf(minRaw)
  const seen=new Set<string>(); const yearTicks:{i:number;yr:string}[]=[]
  data.forEach((d,i)=>{ const yr=d.date.slice(0,4); if(!seen.has(yr)){seen.add(yr); yearTicks.push({i,yr})} })
  const locate=(clientX:number)=>{
    const el=wrapRef.current; if(!el)return
    const r=el.getBoundingClientRect()
    const xv=((clientX-r.left)/r.width)*W
    setHi(Math.max(0,Math.min(n-1,Math.round((xv-padL)/((W-padL-padR)/(n-1))))))
  }
  const leftPct=hi!=null?Math.max(12,Math.min(88,(X(hi)/W)*100)):0
  return (
    <div ref={wrapRef} style={{position:'relative',width:'100%',touchAction:'pan-y',cursor:'crosshair'}}
      onMouseMove={e=>locate(e.clientX)} onMouseLeave={()=>setHi(null)}
      onTouchStart={e=>locate(e.touches[0].clientX)} onTouchMove={e=>locate(e.touches[0].clientX)} onTouchEnd={()=>setHi(null)}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{display:'block'}} role="img" aria-label="Ιστορική πορεία Euribor τριμήνου, διαδραστικό">
        <defs>
          <linearGradient id="euriborFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.2"/>
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0"/>
          </linearGradient>
        </defs>
        {minV<0&&<line x1={padL} y1={Y(0)} x2={W-padR} y2={Y(0)} stroke="var(--border-default)" strokeWidth="1" strokeDasharray="3 3"/>}
        <path d={area} fill="url(#euriborFill)"/>
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
        {hi==null&&(<>
          <circle cx={X(maxI)} cy={Y(maxV)} r="3" fill="var(--accent)" stroke="var(--bg-elevated)" strokeWidth="1.5"/>
          <text x={X(maxI)} y={Y(maxV)-7} textAnchor="middle" style={{fontSize: 'var(--fs-xs)',fontFamily: T.font.sans,fill:'var(--text-secondary)',fontWeight:600}}>{fp(maxV)}</text>
          <circle cx={X(minI)} cy={Y(minRaw)} r="3" fill="var(--text-tertiary)" stroke="var(--bg-elevated)" strokeWidth="1.5"/>
          <text x={X(minI)} y={Y(minRaw)+13} textAnchor="middle" style={{fontSize: 'var(--fs-xs)',fontFamily: T.font.sans,fill:'var(--text-tertiary)'}}>{fp(minRaw)}</text>
        </>)}
        {/* Τρέχον σημείο (ζωντανό) */}
        <circle cx={X(n-1)} cy={Y(vals[n-1])} r="4" fill="var(--accent)" stroke="var(--bg-elevated)" strokeWidth="2"/>
        {hi!=null&&(<g>
          <line x1={X(hi)} y1={padT-6} x2={X(hi)} y2={Y(minV)} stroke="var(--accent)" strokeWidth="1" strokeOpacity="0.5"/>
          <circle cx={X(hi)} cy={Y(vals[hi])} r="4.5" fill="var(--accent)" stroke="var(--bg-elevated)" strokeWidth="2"/>
        </g>)}
        {yearTicks.map(t=>(<text key={t.yr} x={X(t.i)} y={H-6} textAnchor={t.i===0?'start':'middle'} style={{fontSize: 'var(--fs-xs)',fontFamily: T.font.sans,fill:hi!=null&&data[hi].date.slice(0,4)===t.yr?'var(--accent)':'var(--text-tertiary)',fontWeight:hi!=null&&data[hi].date.slice(0,4)===t.yr?700:400}}>{t.yr}</text>))}
      </svg>
      {hi!=null&&(
        <div style={{position:'absolute',top:0,left:`${leftPct}%`,transform:'translateX(-50%)',pointerEvents:'none',background:'var(--bg-surface)',border:'1px solid var(--border-default)',borderRadius:10,padding:'7px 12px',boxShadow:'var(--shadow-lg)',whiteSpace:'nowrap' as const,textAlign:'center' as const}}>
          <p style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',marginBottom: 4,fontFamily: T.font.sans}}>{euFmtDate(data[hi].date)}</p>
          <p style={{fontSize:15,color:'var(--accent)',fontFamily: T.font.sans,fontVariantNumeric:'tabular-nums',fontWeight:700,lineHeight:1}}>{fp(vals[hi])}</p>
        </div>
      )}
    </div>
  )
}
