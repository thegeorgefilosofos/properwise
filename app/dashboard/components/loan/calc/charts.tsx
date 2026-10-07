'use client'
// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΓΡΑΦΗΜΑΤΑ ΤΟΥ ΥΠΟΛΟΓΙΣΤΗ ΔΑΝΕΙΟΥ: DONUT ΚΕΦΑΛΑΙΟΥ, ΣΤΗΛΕΣ ΑΠΟΣΒΕΣΗΣ,
// ΣΩΡΕΥΤΙΚΟΙ ΤΟΚΟΙ, ΑΓΟΡΑ Η ΕΝΟΙΚΙΑΣΗ, ΑΝΤΟΧΗ ΔΟΣΗΣ
// ─────────────────────────────────────────────────────────────────────────
// Χειροποίητα SVG με δικό τους δείκτη (ποντίκι ή δάχτυλο). Ζούσαν στο
// TabLoanCalculator.tsx· παίρνουν μόνο τα σημεία και τον μορφοποιητή τους.
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useRef } from 'react'
import { T } from '@/components/Theme'
import { axisGutter } from '../../LoanShared'
import { useChartWidth } from '@/app/hooks/useChartWidth'

// ── Bespoke SVG: donut κατανομής κεφαλαίου/τόκων (αισθητική «2050», μονόχρωμη) ──
// ΤΟ viewBox ΗΤΑΝ 136 ΚΑΙ ΤΟ ΠΛΑΤΟΣ 128: συντελεστής 0,94 χωρίς κανέναν λόγο,
// που έγραφε τη λέξη «ΚΕΦΑΛΑΙΟ» στα 10,3 αντί για 11. Οι δύο αριθμοί λένε τώρα
// το ίδιο πράγμα, οπότε κάθε μέγεθος μέσα στο donut είναι αυτό που γράφεται.
export function AmortDonut({principal,interest}:{principal:number;interest:number}) {
  const total = Math.max(1, principal+interest)
  const pFrac = principal/total
  const R=52, sw=15, C=2*Math.PI*R
  const pLen = C*pFrac
  return (
    <svg viewBox="0 0 136 136" width="136" height="136" role="img" aria-label={`Κατανομή: ${Math.round(pFrac*100)}% κεφάλαιο, ${Math.round((1-pFrac)*100)}% τόκοι`} style={{flexShrink:0}}>
      <defs>
        <linearGradient id="donutCap" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.95"/>
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.6"/>
        </linearGradient>
        <filter id="donutShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="var(--text-primary)" floodOpacity="0.15"/>
        </filter>
      </defs>
      <circle cx="68" cy="68" r={R} fill="none" stroke="var(--text-tertiary)" strokeOpacity="0.22" strokeWidth={sw}/>
      <circle cx="68" cy="68" r={R} fill="none" stroke="url(#donutCap)" strokeWidth={sw} strokeLinecap="round"
        strokeDasharray={`${pLen} ${C-pLen}`} transform="rotate(-90 68 68)" filter="url(#donutShadow)"/>
      <text x="68" y="63" textAnchor="middle" style={{fontSize:22,fontWeight:700,fontFamily: T.font.sans,fill:'var(--text-primary)'}}>{Math.round(pFrac*100)}%</text>
      <text x="68" y="80" textAnchor="middle" style={{fontSize: 'var(--fs-xs)',fontFamily: T.font.sans,fill:'var(--text-tertiary)',letterSpacing:'0.04em'}}>ΚΕΦΑΛΑΙΟ</text>
    </svg>
  )
}

// ── Bespoke SVG: στοιβαγμένες στήλες ανά έτος — κεφάλαιο (κάτω) / τόκοι (πάνω) ──
// Κάθε στήλη είναι η ετήσια δόση. Η αναλογία μετατοπίζεται σταδιακά από «κυρίως
// τόκοι» σε «κυρίως κεφάλαιο». Καθαρός διαχωρισμός, χωρίς αλληλοκαλύψεις.
export function AmortArea({data,fmt}:{data:{year:string;cap:number;int:number}[];fmt:(n:number)=>string}) {
  const [hi,setHi]=useState<number|null>(null)
  const wrapRef=useRef<HTMLDivElement>(null)
  const [svgRef,W]=useChartWidth(620)
  const H=228,padL=6,padT=16,padB=26
  const n=data.length
  if(n<1) return null
  const maxTotal=Math.max(...data.map(d=>d.cap+d.int),1)
  const gridLabels=[0,0.5,1].map(f=>fmt(maxTotal*f))
  const padR=axisGutter(gridLabels)
  const plotW=W-padL-padR, plotH=H-padT-padB
  const step=plotW/n
  const bw=Math.min(26, step*0.58)
  const cx=(i:number)=> padL + i*step + step/2
  const Y=(v:number)=> padT + (1 - v/maxTotal)*plotH
  const base=padT+plotH
  const r=Math.min(3, bw/2)
  const crossIdx=data.findIndex(d=>d.cap>=d.int)
  const grid=[0,0.5,1].map((f,i)=>({ y:padT+(1-f)*plotH, label:gridLabels[i] }))
  const tickEvery=Math.max(1, Math.ceil(n/8))
  const locate=(clientX:number)=>{
    const el=wrapRef.current; if(!el)return
    const r2=el.getBoundingClientRect()
    const xv=((clientX-r2.left)/r2.width)*W
    const i=Math.floor((xv-padL)/step)
    setHi(Math.max(0,Math.min(n-1,i)))
  }
  const leftPct=hi!=null?Math.max(13,Math.min(87,(cx(hi)/W)*100)):0
  return (
    <div ref={wrapRef} style={{position:'relative',width:'100%',touchAction:'pan-y',cursor:'crosshair'}}
      onMouseMove={e=>locate(e.clientX)} onMouseLeave={()=>setHi(null)}
      onTouchStart={e=>locate(e.touches[0].clientX)} onTouchMove={e=>locate(e.touches[0].clientX)} onTouchEnd={()=>setHi(null)}>
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{display:'block'}} role="img" aria-label="Κατανομή κεφαλαίου και τόκων ανά έτος">
      <defs>
        <linearGradient id="barCap" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="1"/>
          <stop offset="100%" stopColor="color-mix(in srgb, var(--accent) 78%, transparent)" stopOpacity="1"/>
        </linearGradient>
        <filter id="barLift" x="-30%" y="-20%" width="160%" height="140%"><feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="var(--text-primary)" floodOpacity="0.12"/></filter>
      </defs>
      {/* Γραμμές αναφοράς + ετικέτες αξόνων */}
      {grid.map((g,i)=>(
        <g key={i}>
          <line x1={padL} y1={g.y} x2={W-padR} y2={g.y} stroke="var(--border-subtle)" strokeWidth="1" strokeOpacity={i===0?0.9:0.45}/>
          <text x={W-2} y={g.y+3} textAnchor="end" style={{fontSize: 'var(--fs-xs)',fontFamily: T.font.sans,fill:'var(--text-tertiary)',fontVariantNumeric:'tabular-nums'}}>{g.label}</text>
        </g>
      ))}
      {/* Στοιβαγμένες στήλες — η δόση ανάβει μπλε στο πέρασμα του δείκτη/δαχτύλου */}
      {data.map((d,i)=>{
        const x=cx(i)-bw/2
        const yTot=Y(d.cap+d.int), yCap=Y(d.cap)
        const capH=Math.max(0,base-yCap)
        const active=hi===i
        return (
          <g key={i}>
            {active&&<rect x={cx(i)-step/2} y={padT} width={step} height={plotH} fill="var(--accent)" fillOpacity="0.06"/>}
            {/* τόκοι (πάνω· στο hover γίνονται πιο έντονο accent) */}
            <path d={`M ${x} ${yCap} L ${x} ${yTot+r} Q ${x} ${yTot} ${x+r} ${yTot} L ${x+bw-r} ${yTot} Q ${x+bw} ${yTot} ${x+bw} ${yTot+r} L ${x+bw} ${yCap} Z`} fill={active?'var(--accent)':'var(--text-tertiary)'} fillOpacity={active?0.4:0.26}/>
            {/* κεφάλαιο (κάτω, accent — πιο φωτεινό στο hover) */}
            {capH>0 && <rect x={x} y={yCap} width={bw} height={capH} fill={active?'var(--accent)':'url(#barCap)'} filter={(active||i===n-1)?'url(#barLift)':undefined}/>}
          </g>
        )
      })}
      <line x1={padL} y1={base} x2={W-padR} y2={base} stroke="var(--border-default)" strokeWidth="1"/>
      {/* Έτος τομής — όπου το κεφάλαιο ξεπερνά τους τόκους */}
      {crossIdx>0&&hi==null&&(
        <g>
          <line x1={cx(crossIdx)} y1={padT} x2={cx(crossIdx)} y2={base} stroke="var(--accent)" strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.55"/>
          <text x={cx(crossIdx)} y={padT-4} textAnchor="middle" style={{fontSize: 'var(--fs-xs)',fontFamily: T.font.sans,fill:'var(--accent)',fontWeight:600}}>έτος {data[crossIdx].year}</text>
        </g>
      )}
      {/* Άξονας x */}
      {data.map((d,i)=> (i%tickEvery===0 || i===n-1) ? (
        <text key={i} x={cx(i)} y={H-8} textAnchor="middle" style={{fontSize: 'var(--fs-xs)',fontFamily: T.font.sans,fill:hi===i?'var(--accent)':'var(--text-secondary)',fontWeight:hi===i?700:400}}>{d.year}</text>
      ) : null)}
    </svg>
    {hi!=null&&(
      <div style={{position:'absolute',top:0,left:`${leftPct}%`,transform:'translateX(-50%)',pointerEvents:'none',background:'var(--bg-surface)',border:'1px solid var(--border-default)',borderRadius:10,padding:'8px 11px',boxShadow:'var(--shadow-lg)',whiteSpace:'nowrap' as const}}>
        <p style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',marginBottom: 4,fontFamily: T.font.sans,textAlign:'center' as const}}>Έτος {data[hi].year}</p>
        <div style={{display:'flex',alignItems:'center',gap: 8,marginBottom: 4}}>
          <span style={{width:9,height:9,borderRadius:3,background:'var(--accent)',display:'inline-block'}}/>
          <span style={{fontSize:12,color:'var(--text-secondary)',fontFamily: T.font.sans}}>Κεφάλαιο</span>
          <span style={{fontSize:12,color:'var(--text-primary)',fontFamily: T.font.mono,fontVariantNumeric:'tabular-nums',fontWeight:600,marginLeft:'auto'}}>{fmt(data[hi].cap)}</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap: 8,marginBottom: 4}}>
          <span style={{width:9,height:9,borderRadius:3,background:'var(--text-tertiary)',opacity:0.5,display:'inline-block'}}/>
          <span style={{fontSize:12,color:'var(--text-secondary)',fontFamily: T.font.sans}}>Τόκοι</span>
          <span style={{fontSize:12,color:'var(--text-primary)',fontFamily: T.font.mono,fontVariantNumeric:'tabular-nums',fontWeight:600,marginLeft:'auto'}}>{fmt(data[hi].int)}</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:14,paddingTop: 4,marginTop:2,borderTop:'1px solid var(--border-subtle)'}}>
          <span style={{fontSize:12,color:'var(--text-secondary)',fontFamily: T.font.sans}}>Ετήσια δόση</span>
          <span style={{fontSize: 'var(--fs-base)',color:'var(--accent)',fontFamily: T.font.mono,fontVariantNumeric:'tabular-nums',fontWeight:700,marginLeft:'auto'}}>{fmt(data[hi].cap+data[hi].int)}</span>
        </div>
      </div>
    )}
    </div>
  )
}

// ── Bespoke SVG: δύο σωρευτικές γραμμές, διαδραστικές (δείκτης ή άγγιγμα) ──
// Περιηγήσου πάνω στο γράφημα με τον κέρσορα ή το δάχτυλο για να δεις κάθε έτος.
// Σημείο γραφήματος: ένα κλειδί άξονα και δύο αριθμητικές σειρές με ονόματα που
// δίνει ο καλών. Ήταν `any[]`, δηλαδή ένα λάθος `keyA` δεν θα φαινόταν ποτέ.
export type SeriesPoint = Record<string, string | number>;
export function DualLine({data,keyA,keyB,fmt}:{data:SeriesPoint[];keyA:string;keyB:string;fmt:(n:number)=>string}) {
  const [hi,setHi]=useState<number|null>(null)
  const wrapRef=useRef<HTMLDivElement>(null)
  const [svgRef,W]=useChartWidth(620)
  const H=200,padL=8,padT=18,padB=28
  const n=data.length
  if(n<2) return null
  // Οι δύο σειρές είναι αριθμητικές· η ετικέτα του άξονα είναι κείμενο. Η
  // ανάγνωση περνά από εδώ ώστε το συμβόλαιο να λέγεται μία φορά.
  const v=(d:SeriesPoint,k:string)=>Number(d[k])||0
  const vals=data.flatMap(d=>[v(d,keyA),v(d,keyB)])
  const maxV=Math.max(...vals,1)
  const padR=axisGutter([0,0.5,1].map(f=>fmt(maxV*f)))
  const X=(i:number)=> padL + (i/(n-1))*(W-padL-padR)
  const Y=(v:number)=> padT + (1 - v/maxV)*(H-padT-padB)
  const path=(k:string)=> data.map((d,i)=>`${i===0?'M':'L'} ${X(i)} ${Y(v(d,k))}`).join(' ')
  const areaA=`M ${X(0)} ${Y(0)} `+data.map((d,i)=>`L ${X(i)} ${Y(v(d,keyA))}`).join(' ')+` L ${X(n-1)} ${Y(0)} Z`
  const grid=[0,0.5,1].map(f=>({y:Y(maxV*f),label:fmt(maxV*f)}))
  const locate=(clientX:number)=>{
    const el=wrapRef.current; if(!el)return
    const r=el.getBoundingClientRect()
    const xv=((clientX-r.left)/r.width)*W
    const i=Math.round((xv-padL)/((W-padL-padR)/(n-1)))
    setHi(Math.max(0,Math.min(n-1,i)))
  }
  const leftPct=hi!=null?Math.max(11,Math.min(89,(X(hi)/W)*100)):0
  return (
    <div ref={wrapRef} style={{position:'relative',width:'100%',touchAction:'pan-y',cursor:'crosshair'}}
      onMouseMove={e=>locate(e.clientX)} onMouseLeave={()=>setHi(null)}
      onTouchStart={e=>locate(e.touches[0].clientX)} onTouchMove={e=>locate(e.touches[0].clientX)} onTouchEnd={()=>setHi(null)}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{display:'block'}} role="img" aria-label="Σύγκριση σωρευτικών τόκων στη διάρκεια">
        <defs>
          <linearGradient id="dualAreaA" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.16"/>
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0"/>
          </linearGradient>
        </defs>
        {grid.map((g,i)=>(<g key={i}><line x1={padL} y1={g.y} x2={W-padR} y2={g.y} stroke="var(--border-subtle)" strokeWidth="1" strokeOpacity={i===0?0.9:0.4}/><text x={W-2} y={g.y+3} textAnchor="end" style={{fontSize: 'var(--fs-xs)',fontFamily: T.font.sans,fill:'var(--text-tertiary)',fontVariantNumeric:'tabular-nums'}}>{g.label}</text></g>))}
        <path d={areaA} fill="url(#dualAreaA)"/>
        <path d={path(keyB)} fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeDasharray="5 4" strokeLinejoin="round" strokeLinecap="round" strokeOpacity="0.85"/>
        <path d={path(keyA)} fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round"/>
        {hi!=null&&(
          <g>
            <line x1={X(hi)} y1={padT-4} x2={X(hi)} y2={Y(0)} stroke="var(--accent)" strokeWidth="1" strokeOpacity="0.5"/>
            <circle cx={X(hi)} cy={Y(v(data[hi],keyB))} r="4" fill="var(--bg-surface)" stroke="var(--text-tertiary)" strokeWidth="2"/>
            <circle cx={X(hi)} cy={Y(v(data[hi],keyA))} r="4.5" fill="var(--accent)" stroke="var(--bg-surface)" strokeWidth="2"/>
          </g>
        )}
        {hi==null&&<circle cx={X(n-1)} cy={Y(v(data[n-1],keyA))} r="4" fill="var(--accent)" stroke="var(--bg-surface)" strokeWidth="2"/>}
        {data.map((d,i)=> (i===0||i===n-1||i===Math.floor(n/2)) ? (<text key={i} x={X(i)} y={H-8} textAnchor={i===0?'start':i===n-1?'end':'middle'} style={{fontSize: 'var(--fs-xs)',fontFamily: T.font.sans,fill:'var(--text-secondary)'}}>{d.year}</text>) : null)}
      </svg>
      {hi!=null&&(
        <div style={{position:'absolute',top:0,left:`${leftPct}%`,transform:'translateX(-50%)',pointerEvents:'none',
          background:'var(--bg-surface)',border:'1px solid var(--border-default)',borderRadius:10,padding:'8px 11px',boxShadow:'var(--shadow-lg)',whiteSpace:'nowrap' as const}}>
          <p style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',marginBottom: 4,fontFamily: T.font.sans,textAlign:'center' as const}}>{data[hi].year}</p>
          <div style={{display:'flex',alignItems:'center',gap: 8,marginBottom: 4}}>
            <span style={{width:12,height:2.4,borderRadius:3,background:'var(--accent)',display:'inline-block'}}/>
            <span style={{fontSize:12,color:'var(--text-secondary)',fontFamily: T.font.sans}}>Σταθερό</span>
            <span style={{fontSize:12,color:'var(--text-primary)',fontFamily: T.font.mono,fontVariantNumeric:'tabular-nums',fontWeight:600,marginLeft:'auto'}}>{fmt(v(data[hi],keyA))}</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap: 8}}>
            <span style={{width:12,height:0,borderTop:'2px dashed var(--text-tertiary)',display:'inline-block'}}/>
            <span style={{fontSize:12,color:'var(--text-secondary)',fontFamily: T.font.sans}}>Κυμαινόμενο</span>
            <span style={{fontSize:12,color:'var(--text-primary)',fontFamily: T.font.mono,fontVariantNumeric:'tabular-nums',fontWeight:600,marginLeft:'auto'}}>{fmt(v(data[hi],keyB))}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Bespoke SVG: αγορά vs ενοικίαση, διαδραστικό (δείκτης ή άγγιγμα) ──
// Περιηγήσου πάνω στη γραμμή για να δεις το καθαρό κόστος κάθε έτους.
export function RentBuyChart({buy,rent,horizon,breakEvenYear,fmt}:{buy:number[];rent:number[];horizon:number;breakEvenYear?:number|null;fmt:(n:number)=>string}) {
  const [hi,setHi]=useState<number|null>(null)
  const wrapRef=useRef<HTMLDivElement>(null)
  const [svgRef,W]=useChartWidth(560)
  const H=170,padL=6,padT=14,padB=22, n=horizon+1
  if(n<2) return null
  const maxV=Math.max(...buy,...rent,1)
  const minV=Math.min(...buy,0)
  const padR=axisGutter([0,0.5,1].map(f=>fmt(minV+(maxV-minV)*f)))
  const X=(i:number)=>padL+(i/(n-1))*(W-padL-padR)
  const Yv=(v:number)=>padT+(1-(v-minV)/(maxV-minV||1))*(H-padT-padB)
  const buyLine=buy.map((v,i)=>`${i===0?'M':'L'} ${X(i)} ${Yv(v)}`).join(' ')
  const rentLine=rent.map((v,i)=>`${i===0?'M':'L'} ${X(i)} ${Yv(v)}`).join(' ')
  const grid=[0,0.5,1].map(f=>{const v=minV+(maxV-minV)*f;return{y:Yv(v),label:fmt(v)}})
  const locate=(clientX:number)=>{
    const el=wrapRef.current; if(!el)return
    const r=el.getBoundingClientRect()
    const xv=((clientX-r.left)/r.width)*W
    setHi(Math.max(0,Math.min(n-1,Math.round((xv-padL)/((W-padL-padR)/(n-1))))))
  }
  const leftPct=hi!=null?Math.max(13,Math.min(87,(X(hi)/W)*100)):0
  const diff=hi!=null?buy[hi]-rent[hi]:0
  return (
    <div ref={wrapRef} style={{position:'relative',width:'100%',touchAction:'pan-y',cursor:'crosshair'}}
      onMouseMove={e=>locate(e.clientX)} onMouseLeave={()=>setHi(null)}
      onTouchStart={e=>locate(e.touches[0].clientX)} onTouchMove={e=>locate(e.touches[0].clientX)} onTouchEnd={()=>setHi(null)}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{display:'block'}} role="img" aria-label="Σύγκριση κόστους αγοράς και ενοικίασης, διαδραστικό">
        {grid.map((g,i)=>(<g key={i}><line x1={padL} y1={g.y} x2={W-padR} y2={g.y} stroke="var(--border-subtle)" strokeWidth="1" strokeOpacity={i===0?0.9:0.4}/><text x={W-2} y={g.y+3} textAnchor="end" style={{fontSize: 'var(--fs-xs)',fontFamily: T.font.sans,fill:'var(--text-tertiary)',fontVariantNumeric:'tabular-nums'}}>{g.label}</text></g>))}
        <line x1={padL} y1={H-padB} x2={W-padR} y2={H-padB} stroke="var(--border-default)" strokeWidth="1"/>
        <path d={rentLine} fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeDasharray="4 3" strokeLinejoin="round"/>
        <path d={buyLine} fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinejoin="round"/>
        {breakEvenYear!=null&&hi==null&&<line x1={X(breakEvenYear)} y1={padT} x2={X(breakEvenYear)} y2={H-padB} stroke="var(--border-accent)" strokeWidth="1" strokeDasharray="3 3"/>}
        {hi!=null&&(<g>
          <line x1={X(hi)} y1={padT-4} x2={X(hi)} y2={H-padB} stroke="var(--accent)" strokeWidth="1" strokeOpacity="0.5"/>
          <circle cx={X(hi)} cy={Yv(rent[hi])} r="3.5" fill="var(--text-tertiary)" stroke="var(--bg-surface)" strokeWidth="1.5"/>
          <circle cx={X(hi)} cy={Yv(buy[hi])} r="4.5" fill="var(--accent)" stroke="var(--bg-surface)" strokeWidth="2"/>
        </g>)}
        {[0,Math.round(horizon/2),horizon].map(i=><text key={i} x={X(i)} y={H-6} textAnchor={i===0?'start':i===horizon?'end':'middle'} style={{fontSize: 'var(--fs-xs)',fontFamily: T.font.sans,fill:hi===i?'var(--accent)':'var(--text-secondary)',fontWeight:hi===i?700:400}}>έτος {i}</text>)}
      </svg>
      {hi!=null&&(
        <div style={{position:'absolute',top:0,left:`${leftPct}%`,transform:'translateX(-50%)',pointerEvents:'none',background:'var(--bg-surface)',border:'1px solid var(--border-default)',borderRadius:10,padding:'8px 11px',boxShadow:'var(--shadow-lg)',whiteSpace:'nowrap' as const,minWidth:150}}>
          <p style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',marginBottom: 4,fontFamily: T.font.sans,textAlign:'center' as const}}>Έτος {hi}</p>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom: 4}}>
            <span style={{width:9,height:9,borderRadius:3,background:'var(--accent)',display:'inline-block'}}/>
            <span style={{fontSize:12,color:'var(--text-secondary)',fontFamily: T.font.sans}}>Αγορά</span>
            <span style={{fontSize:12,color:'var(--text-primary)',fontFamily: T.font.mono,fontVariantNumeric:'tabular-nums',fontWeight:600,marginLeft:'auto'}}>{fmt(buy[hi])}</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={{width:9,height:2.5,background:'var(--text-tertiary)',display:'inline-block'}}/>
            <span style={{fontSize:12,color:'var(--text-secondary)',fontFamily: T.font.sans}}>Ενοικίαση</span>
            <span style={{fontSize:12,color:'var(--text-primary)',fontFamily: T.font.mono,fontVariantNumeric:'tabular-nums',fontWeight:600,marginLeft:'auto'}}>{fmt(rent[hi])}</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:14,paddingTop: 4,marginTop: 4,borderTop:'1px solid var(--border-subtle)'}}>
            <span style={{fontSize:12,color:'var(--text-secondary)',fontFamily: T.font.sans}}>{diff<0?'Υπέρ αγοράς':'Υπέρ ενοικίασης'}</span>
            <span style={{fontSize: 'var(--fs-base)',color:'var(--accent)',fontFamily: T.font.mono,fontVariantNumeric:'tabular-nums',fontWeight:700,marginLeft:'auto'}}>{fmt(Math.abs(diff))}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Bespoke SVG: αντοχή δόσης σε άνοδο επιτοκίου, διαδραστικό ──
export function StressBars({stress,limit,INC,fmt,fmtPct,fmtPct1}:{stress:{label:string;rate:number;monthly:number}[];limit:number;INC:number;fmt:(n:number)=>string;fmtPct:(n:number)=>string;fmtPct1:(n:number)=>string}) {
  const [hi,setHi]=useState<number|null>(null)
  const wrapRef=useRef<HTMLDivElement>(null)
  const [svgRef,W]=useChartWidth(620)
  const H=176,padL=8,padT=18,padB=28
  const maxV=Math.max(...stress.map(s=>s.monthly), limit, 1)*1.14
  const padR=axisGutter((limit>0?[0,limit,maxV/1.14]:[0,maxV/2/1.14,maxV/1.14]).map(v=>fmt(v)))
  const plotW=W-padL-padR, plotH=H-padT-padB, base=padT+plotH
  const step=plotW/stress.length, bw=Math.min(42, step*0.56)
  const Y=(v:number)=> padT+(1-v/maxV)*plotH
  const cx=(i:number)=> padL+i*step+step/2
  const grid=limit>0?[0,limit,maxV/1.14]:[0,maxV/2/1.14,maxV/1.14]
  const locate=(clientX:number)=>{
    const el=wrapRef.current; if(!el)return
    const r=el.getBoundingClientRect()
    const xv=((clientX-r.left)/r.width)*W
    setHi(Math.max(0,Math.min(stress.length-1,Math.floor((xv-padL)/step))))
  }
  const leftPct=hi!=null?Math.max(15,Math.min(80,(cx(hi)/W)*100)):0
  return (
    <div ref={wrapRef} style={{position:'relative',width:'100%',touchAction:'pan-y',cursor:'crosshair'}}
      onMouseMove={e=>locate(e.clientX)} onMouseLeave={()=>setHi(null)}
      onTouchStart={e=>locate(e.touches[0].clientX)} onTouchMove={e=>locate(e.touches[0].clientX)} onTouchEnd={()=>setHi(null)}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{display:'block'}} role="img" aria-label="Αντοχή δόσης σε άνοδο επιτοκίου, διαδραστικό">
        <defs>
          <linearGradient id="stressBar" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity="1"/><stop offset="100%" stopColor="color-mix(in srgb, var(--accent) 76%, transparent)"/></linearGradient>
          <linearGradient id="stressOver" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--text-tertiary)" stopOpacity="1"/><stop offset="100%" stopColor="color-mix(in srgb, var(--text-tertiary) 74%, transparent)"/></linearGradient>
          <filter id="stressLift" x="-40%" y="-20%" width="180%" height="140%"><feDropShadow dx="0" dy="1.5" stdDeviation="2.5" floodColor="var(--text-primary)" floodOpacity="0.14"/></filter>
        </defs>
        {grid.map((gv,i)=>(<g key={i}><line x1={padL} y1={Y(gv)} x2={W-padR} y2={Y(gv)} stroke="var(--border-subtle)" strokeWidth="1" strokeOpacity={i===0?0.9:0.4}/><text x={W-2} y={Y(gv)+3} textAnchor="end" style={{fontSize: 'var(--fs-xs)',fontFamily: T.font.sans,fill:'var(--text-tertiary)',fontVariantNumeric:'tabular-nums'}}>{fmt(gv)}</text></g>))}
        {stress.map((s,i)=>{
          const over=limit>0&&s.monthly>limit
          const active=hi===i
          const x=cx(i)-bw/2, y=Y(s.monthly), r=Math.min(4,bw/2)
          return (
            <g key={i}>
              {active&&<rect x={cx(i)-step/2} y={padT} width={step} height={plotH} fill="var(--accent)" fillOpacity="0.06"/>}
              <path d={`M ${x} ${y+r} Q ${x} ${y} ${x+r} ${y} L ${x+bw-r} ${y} Q ${x+bw} ${y} ${x+bw} ${y+r} L ${x+bw} ${base} L ${x} ${base} Z`} fill={over?'url(#stressOver)':'url(#stressBar)'} filter={active?'url(#stressLift)':undefined}/>
              {/* ΤΑ ΑΚΡΑΙΑ ΛΕΚΤΙΚΑ ΑΓΚΙΣΤΡΩΝΟΝΤΑΙ ΠΡΟΣ ΤΑ ΜΕΣΑ. Κεντραρισμένα κάτω
                  από τη στήλη τους, στα 320 το «Τρέχον» έβγαινε 2 εικονοστοιχεία
                  αριστερά από το ίδιο το γράφημα και κοβόταν: το κέντρο της
                  πρώτης στήλης απέχει από την άκρη λιγότερο από το μισό της
                  λέξης. Το πρώτο λεκτικό ξεκινά από την αριστερή άκρη του
                  σχεδίου και το τελευταίο τελειώνει στη δεξιά· τα ενδιάμεσα
                  μένουν κεντραρισμένα, όπως πρέπει. */}
              <text x={i===0?padL:i===stress.length-1?W-padR:cx(i)} y={H-9}
                textAnchor={i===0?'start':i===stress.length-1?'end':'middle'}
                style={{fontSize: 'var(--fs-xs)',fontFamily: T.font.sans,fill:active||i===0?'var(--accent)':'var(--text-secondary)',fontWeight:active||i===0?600:400}}>{s.label}</text>
            </g>
          )
        })}
        {limit>0&&(<g>
          <line x1={padL} y1={Y(limit)} x2={W-padR} y2={Y(limit)} stroke="var(--text-secondary)" strokeWidth="1.4" strokeDasharray="5 4"/>
          <text x={padL+2} y={Y(limit)-5} style={{fontSize: 'var(--fs-xs)',fontFamily: T.font.sans,fill:'var(--text-secondary)',fontWeight:600}}>Όριο δόσης</text>
        </g>)}
        <line x1={padL} y1={base} x2={W-padR} y2={base} stroke="var(--border-default)" strokeWidth="1"/>
      </svg>
      {hi!=null&&(()=>{
        const s=stress[hi], diff=s.monthly-stress[0].monthly, dti=INC>0?(s.monthly/INC)*100:0, over=limit>0&&s.monthly>limit
        return (
          <div style={{position:'absolute',top:0,left:`${leftPct}%`,transform:'translateX(-50%)',pointerEvents:'none',background:'var(--bg-surface)',border:'1px solid var(--border-default)',borderRadius:10,padding:'8px 11px',boxShadow:'var(--shadow-lg)',whiteSpace:'nowrap' as const,minWidth:150}}>
            <p style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',marginBottom: 4,fontFamily: T.font.sans,textAlign:'center' as const}}>{s.label} · {fmtPct(s.rate)}</p>
            <div style={{display:'flex',alignItems:'center',gap:14,marginBottom: 4}}>
              <span style={{fontSize:12,color:'var(--text-secondary)',fontFamily: T.font.sans}}>Δόση τον μήνα</span>
              <span style={{fontSize: 'var(--fs-base)',color:'var(--text-primary)',fontFamily: T.font.mono,fontVariantNumeric:'tabular-nums',fontWeight:700,marginLeft:'auto'}}>{fmt(s.monthly)}</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:14,marginBottom: 4}}>
              <span style={{fontSize:12,color:'var(--text-secondary)',fontFamily: T.font.sans}}>Αύξηση</span>
              <span style={{fontSize:12,color:'var(--text-primary)',fontFamily: T.font.mono,fontVariantNumeric:'tabular-nums',fontWeight:600,marginLeft:'auto'}}>{hi===0?fmt(0):diff>=0?`+${fmt(diff)}`:`-${fmt(-diff)}`}</span>
            </div>
            {/* ══ ΤΟ «ΠΑΝΩ ΑΠΟ ΤΟ ΟΡΙΟ» ΥΠΟΛΟΓΙΖΟΤΑΝ ΚΑΙ ΔΕΝ ΦΑΙΝΟΤΑΝ ═════════
                Το `over` (δόση > όριο αντοχής) υπολογιζόταν σε κάθε άγγιγμα και
                δεν το διάβαζε καμία γραμμή. Το γράφημα ζωγραφίζει διακεκομμένη
                «Όριο δόσης» — άρα το όριο ΕΧΕΙ νόημα — αλλά το πλαίσιο έδειχνε το
                σενάριο που το ξεπερνά με το ίδιο ακριβώς χρώμα με ένα που δεν
                το ξεπερνά. Ο χρήστης έσερνε το δάχτυλο πάνω σε τέσσερα σενάρια
                επιτοκίου για να δει ΑΚΡΙΒΩΣ αυτό: πού σπάει. */}
            <div style={{display:'flex',alignItems:'center',gap:14,paddingTop: 4,marginTop:2,borderTop:'1px solid var(--border-subtle)'}}>
              <span style={{fontSize:12,color:'var(--text-secondary)',fontFamily: T.font.sans}}>Δόση προς εισόδημα</span>
              <span style={{fontSize: 'var(--fs-base)',color:over?'var(--negative)':'var(--text-primary)',fontFamily: T.font.mono,fontVariantNumeric:'tabular-nums',fontWeight:700,marginLeft:'auto'}}>{fmtPct1(dti)}</span>
            </div>
            {over&&(
              <p style={{fontSize: 'var(--fs-xs)',color:'var(--negative)',fontFamily: T.font.sans,marginTop:6,fontWeight:600,textAlign:'center' as const}}>Πάνω από το όριο δόσης</p>
            )}
          </div>
        )
      })()}
    </div>
  )
}
