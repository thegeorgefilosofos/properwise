'use client'
// ═══════════════════════════════════════════════════════════════════════════
// Η ΣΥΓΚΡΙΣΗ ΣΕΝΑΡΙΩΝ ΤΟΥ ΥΠΟΛΟΓΙΣΤΗ: ΠΙΝΑΚΑΣ ΜΕ ΕΠΕΞΕΡΓΑΣΙΑ ΚΑΙ ΜΠΑΡΕΣ ΤΟΚΩΝ
// ─────────────────────────────────────────────────────────────────────────
// Τα σενάρια και οι ενέργειές τους (προσθήκη, αλλαγή, εφαρμογή, διαγραφή) μένουν
// στο TabLoanCalculator· εδώ ζει μόνο η κάρτα που τα δείχνει.
// ═══════════════════════════════════════════════════════════════════════════
import { cardStyle } from '../../LoanShared'
import { T, Badge, IconBtn } from '@/components/Theme'
import { calcMonthly, fmtEur, fmtPct, type LoanScenario } from '../../TabLoanData'
import { SCEN_NAME } from './model'
import { SectionLabel, labelStyle, type SetState } from './Bits'

export function Scenarios({ scenarios, totalInt, editingId, setEditingId, updScen, applyScen, delScen, scenChart }: {
  scenarios: LoanScenario[]; totalInt: number; editingId: string | null; setEditingId: SetState<string | null>;
  updScen: <K extends keyof LoanScenario>(id: string, f: K, v: LoanScenario[K]) => void;
  applyScen: (s: LoanScenario) => void; delScen: (id: string) => void; scenChart: { name: string; Τόκοι: number }[];
}) {
  return (
    <div style={cardStyle}>
      <SectionLabel label="Σύγκριση σεναρίων"/>
      {/* Οκτώ στήλες, ίδιος κανόνας με τον πίνακα αντοχής: το όνομα του
          σεναρίου μένει ορατό όσο ο χρήστης σέρνει προς τη «Διαφορά». */}
      <div className="po-table-box" style={{marginBottom:16}}>
        <div className="po-scroll-x">
        <table className="po-table pin-1" style={{'--tbl-min':'760px','--row-bg':'var(--surface-raised)'}}>
          <thead><tr>{['Σενάριο','Ποσό','Επιτόκιο','Χρόνια','Δόση τον μήνα','Συνολικοί τόκοι','Διαφορά',''].map((h,i)=><th key={h} scope="col" style={{textAlign:i>=1&&i<=6?'right' as const:undefined}}>{h}</th>)}</tr></thead>
          <tbody>
            {scenarios.map(s=>{
              const m=calcMonthly(s.amount,s.rate,s.years),ti=m*s.years*12-s.amount,saved=totalInt-ti
              const isBest=scenarios.length>1&&saved===Math.max(...scenarios.map(x=>{const mx=calcMonthly(x.amount,x.rate,x.years);return totalInt-(mx*x.years*12-x.amount)}))
              const isEd=editingId===s.id
              const cell=(v:string,f:'label'|'amount'|'rate'|'years',w:number)=><input value={v} aria-label={SCEN_NAME[f]} onChange={e=>{ if(f==='label') updScen(s.id,'label',e.target.value); else updScen(s.id,f,Number(e.target.value)); }} style={{background:'var(--bg-surface)',border:'1px solid var(--accent)',borderRadius:10,padding:'5px 8px',color:'var(--text-primary)',fontSize:12,letterSpacing:0,outline:'none',width:w,fontFamily:f==='label'?"'Inter',sans-serif":"'Roboto Mono',monospace",fontVariantNumeric:'tabular-nums'}} type={f==='label'?'text':'number'} step={f==='rate'?0.05:1}/>
              return(
                <tr key={s.id} style={{'--row-bg':isBest?'var(--bg-surface)':'var(--surface-raised)',background:isBest?'var(--bg-surface)':'transparent'}}>
                  <td>{isEd?cell(s.label,'label',120):<div style={{display:'flex',alignItems:'center',gap: 8}}><span style={{color:'var(--text-primary)',fontFamily: T.font.sans,fontWeight:500}}>{s.label}</span>{isBest&&<Badge tone="accent">Βέλτιστο</Badge>}</div>}</td>
                  <td className="num">{isEd?cell(String(s.amount),'amount',90):<span style={{color:'var(--text-primary)',fontWeight:600}}>{fmtEur(s.amount)}</span>}</td>
                  <td className="num">{isEd?cell(String(s.rate),'rate',65):<span>{fmtPct(s.rate)}</span>}</td>
                  <td className="num">{isEd?cell(String(s.years),'years',55):<span>{s.years} έτη</span>}</td>
                  <td className="num" style={{color:'var(--text-primary)',fontWeight:600}}>{fmtEur(m)}</td>
                  <td className="num">{fmtEur(ti)}</td>
                  <td className="num" style={{color:saved>0?'var(--accent)':'var(--text-tertiary)',fontWeight:600}}>{saved>0?`-${fmtEur(saved)}`:`+${fmtEur(-saved)}`}</td>
                  <td>
                    <div style={{display:'flex',gap: 4,alignItems:'center'}}>
                      {isEd
                        ?<IconBtn onClick={()=>setEditingId(null)} label="Αποθήκευση σεναρίου" title="Αποθήκευση" tone="accent" style={{margin:-4}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg></IconBtn>
                        :<>
                          <IconBtn onClick={()=>setEditingId(s.id)} label="Επεξεργασία σεναρίου" title="Επεξεργασία" style={{margin:-4}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></IconBtn>
                          <button onClick={()=>applyScen(s)} style={{background:'var(--accent-dim)',border:'1px solid var(--border-accent)',borderRadius: T.radius.chip,cursor:'pointer',color:'var(--accent)',display:'flex',alignItems:'center',gap: 4,padding:'3px 7px',fontSize: 'var(--fs-xs)',fontFamily: T.font.sans,fontWeight:500}}>Εφαρμογή</button>
                        </>
                      }
                      <IconBtn onClick={()=>delScen(s.id)} label="Διαγραφή σεναρίου" title="Διαγραφή" style={{margin:-4}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg></IconBtn>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>
      {scenChart.length>0&&(()=>{
        const maxI=Math.max(...scenChart.map(s=>s.Τόκοι),1)
        const minI=Math.min(...scenChart.map(s=>s.Τόκοι))
        return (
        <div style={{display:'flex',flexDirection:'column',gap: 8}}>
          <p style={{...labelStyle,marginBottom:2}}>Συνολικοί τόκοι ανά σενάριο</p>
          {scenChart.map((s,i)=>{
            const best=scenChart.length>1&&s.Τόκοι===minI
            const w=Math.max(4,(s.Τόκοι/maxI)*100)
            return (
              <div key={i} style={{display:'flex',alignItems:'center',gap:12}}>
                <span style={{width:96,flexShrink:0,fontSize:12,color:'var(--text-secondary)',fontFamily: T.font.sans,whiteSpace:'nowrap' as const,overflow:'hidden',textOverflow:'ellipsis'}}>{s.name}</span>
                <div style={{flex:1,height:26,borderRadius: T.radius.chip,background:'var(--bg-surface)',overflow:'hidden',position:'relative'}}>
                  <div style={{width:`${w}%`,height:'100%',borderRadius: T.radius.chip,transition:'width 0.4s ease',
                    background:best?'linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 82%, transparent))':'color-mix(in srgb, var(--text-tertiary) 34%, transparent)'}}/>
                </div>
                <span style={{width:88,flexShrink:0,textAlign:'right' as const,fontSize: 'var(--fs-base)',fontFamily: T.font.num,fontVariantNumeric:'tabular-nums',color:best?'var(--accent)':'var(--text-primary)',fontWeight:600}}>{fmtEur(s.Τόκοι)}</span>
              </div>
            )
          })}
        </div>
        )
      })()}
    </div>
  );
}
