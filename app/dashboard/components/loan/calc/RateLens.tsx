'use client'
// ═══════════════════════════════════════════════════════════════════════════
// Ο ΦΑΚΟΣ «ΕΠΙΤΟΚΙΟ»: ΣΤΑΘΕΡΟ Ή ΚΥΜΑΙΝΟΜΕΝΟ · «ΣΠΙΤΙ ΜΟΥ ΙΙ» ΕΝΑΝΤΙ ΚΑΝΟΝΙΚΟΥ
// ─────────────────────────────────────────────────────────────────────────
// Τα επιτόκια αναφοράς (το χαμηλότερο σταθερό, το διάμεσο περιθώριο) βγαίνουν
// στο TabLoanCalculator από τις ίδιες τράπεζες που δείχνει η σύγκριση και
// φτάνουν εδώ έτοιμα, μαζί με την κρίση του προγράμματος (`spitiMouEstimate`).
// ═══════════════════════════════════════════════════════════════════════════
import { panelStyle } from '../../LoanShared'
import { T, fixedCols, widestOf, Stat } from '@/components/Theme'
import { fmtEur, fmtPct, type LoanType, type RateType, type MarketRates } from '../../TabLoanData'
import { SPITI_MOU } from '@/lib/loans/recommend'
import { Section, labelStyle } from './Bits'
import { DualLine, type SeriesPoint } from './charts'

export function RateLens({
  fixedRefRate, fixedRefMonthly, varShownRate, varShownMonthly, Y, LA, rateType, market, R, bankFixedMins, banksVerified,
  effRate, refVarSpread, fvChartData, spitiClosed, spitiEligible, spitiR, spitiM, monthly, totalInt, spitiSv,
  loanType, PV, isNewBuilding, isCommercial,
}: {
  fixedRefRate: number; fixedRefMonthly: number; varShownRate: number; varShownMonthly: number; Y: number; LA: number;
  rateType: RateType; market: MarketRates; R: number; bankFixedMins: number[]; banksVerified: string; effRate: number;
  refVarSpread: { pct: number; count: number }; fvChartData: SeriesPoint[]; spitiClosed: string | null;
  spitiEligible: boolean; spitiR: number; spitiM: number; monthly: number; totalInt: number; spitiSv: number;
  loanType: LoanType; PV: number; isNewBuilding: boolean; isCommercial: boolean;
}) {
  return (
    <>
      <Section title="Σταθερό ή κυμαινόμενο επιτόκιο" sub="Ανάλυση κόστους σε πραγματικό χρόνο" badge="Ζωντανά" defaultOpen>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',gap:12,marginBottom:14}}>
          {[
            {label:'Σταθερό επιτόκιο',rate:fixedRefRate,m:fixedRefMonthly,pros:['Γνωστή δόση, χωρίς εκπλήξεις','Προστασία από άνοδο Euribor','Ιδανικό αν το Euribor αναμένεται να ανέβει'],cons:['Αρχικά υψηλότερο επιτόκιο','Ποινή πρόωρης αποπληρωμής'],c:'var(--text-primary)',bg:'var(--bg-surface)',border:'var(--border-subtle)'},
            {label:'Κυμαινόμενο επιτόκιο',rate:varShownRate,m:varShownMonthly,pros:[varShownMonthly<fixedRefMonthly?'Σήμερα χαμηλότερη δόση από το σταθερό':'Χαμηλότερη δόση αν υποχωρήσει το Euribor','Ωφελείσαι αν πέσει το Euribor','Χωρίς ποινή πρόωρης αποπληρωμής'],cons:['Κίνδυνος ανόδου Euribor','Αβεβαιότητα δόσης'],c:'var(--text-primary)',bg:'var(--bg-surface)',border:'var(--border-subtle)'},
          ].map(item=>(
            <div key={item.label} style={{background:item.bg,border:`1px solid ${item.border}`,borderRadius:10,padding:14}}>
              <p style={{fontSize: 'var(--fs-base)',color:item.c,fontWeight:500,fontFamily: T.font.sans,marginBottom:12}}>{item.label}</p>
              {/* ═══ ΤΡΙΑ ΝΟΥΜΕΡΑ ΠΟΥ ΤΥΛΙΓΟΝΤΑΙ, ΟΧΙ ΤΡΙΑ ΠΟΥ ΞΕΦΕΥΓΟΥΝ ═══════════
                  Ηταν `flex` με κενό 16. Στα 320 η κάρτα δίνει 236 και τα
                  «75.280,61€» θέλουν 92 το καθένα: μετρημένο, ο τίτλος
                  «Συνολικοί τόκοι» και τα δύο ποσά έβγαιναν 6 εικονοστοιχεία
                  έξω από την κάρτα.

                  ΚΑΙ ΟΧΙ `auto-fit`: δοκιμάστηκε πρώτο και έδωσε δύο πάνω, ένα
                  κάτω, δηλαδή ακριβώς το ορφανό πλακίδιο που ο έλεγχος διάταξης
                  κυνηγά· το έπιασε στα 320, στα 360×640 και στα 360×800. Η
                  `fixedCols` κρατά τον κανόνα του έργου: τρία σε στενή οθόνη
                  γίνονται τρεις γεμάτες σειρές, όχι 2+1. */}
              {/* Η ίδια γραμμή στοιχείων με όλη την εφαρμογή: ένα μέγεθος για τα
                  τρία, από το μακρύτερο· και ετικέτα που κρατά δύο γραμμές όταν
                  η στήλη στενεύει. Ηταν γραμμένη εδώ με δικό της μέγεθος 16 και
                  δικό της letter-spacing, οπότε σε tablet τα τρία νούμερα
                  κάθονταν σε τρία ύψη. */}
              {(()=>{ const st=[['Επιτόκιο',fmtPct(item.rate)],['Δόση τον μήνα',fmtEur(item.m)],['Συνολικοί τόκοι',fmtEur(item.m*Y*12-LA)]] as const
                const w=widestOf(...st.map(([,v])=>v)); return (
              <div {...fixedCols(3, 12, 'start')} style={{...fixedCols(3, 12, 'start').style, marginBottom:12}}>
                {st.map(([k,v])=>(<Stat key={k} label={k} value={v} chars={w}/>))}
              </div>) })()}
              {item.pros.map((p,i)=><div key={i} style={{display:'flex',gap:6,marginBottom: 4}}><span style={{color:'var(--text-tertiary)',flexShrink:0,fontWeight:600}}>+</span><p style={{fontSize: 'var(--fs-xs)',color:'var(--text-secondary)',lineHeight:1.4,fontFamily: T.font.sans}}>{p}</p></div>)}
              {item.cons.map((c,i)=><div key={i} style={{display:'flex',gap:6,marginBottom: 4}}><span style={{color:'var(--text-tertiary)',flexShrink:0,fontWeight:600}}>−</span><p style={{fontSize: 'var(--fs-xs)',color:'var(--text-secondary)',lineHeight:1.4,fontFamily: T.font.sans}}>{c}</p></div>)}
            </div>
          ))}
        </div>
        <div style={{padding:'10px 13px',background:'var(--bg-elevated)',border:'1px solid var(--border-subtle)',borderLeft:'3px solid var(--border-default)',borderRadius:10,marginBottom:14}}>
          <p style={{fontSize: 'var(--fs-base)',color:'var(--text-primary)',lineHeight:1.55,fontFamily: T.font.sans}}>
            {varShownMonthly<fixedRefMonthly
              ? `Σήμερα το κυμαινόμενο έχει χαμηλότερη δόση κατά ${fmtEur(fixedRefMonthly-varShownMonthly)} τον μήνα, όμως η δόση μεταβάλλεται με το Euribor.`
              : varShownMonthly>fixedRefMonthly
              ? `Σήμερα το σταθερό έχει χαμηλότερη δόση κατά ${fmtEur(varShownMonthly-fixedRefMonthly)} τον μήνα και εξασφαλίζει σταθερότητα σε όλη τη διάρκεια.`
              : 'Σήμερα οι δύο επιλογές έχουν παρόμοια δόση· το σταθερό προσφέρει σταθερότητα, το κυμαινόμενο ευελιξία.'}
          </p>
        </div>
        {/* ΑΠΟ ΠΟΥ ΒΓΑΙΝΟΥΝ ΤΑ ΔΥΟ ΕΠΙΤΟΚΙΑ ΤΗΣ ΣΥΓΚΡΙΣΗΣ. Το περιθώριο αναφοράς
            ήταν σταθερά 1,5 χωρίς πηγή και έκρινε μόνο του ποια επιλογή «κερδίζει».
            Τώρα προκύπτει από τα ίδια επιτόκια τραπεζών που δείχνει η καρτέλα. */}
        <p style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',lineHeight:1.6,marginBottom:14,fontFamily: T.font.sans}}>
          {rateType==='variable'
            ? <>Το κυμαινόμενο είναι το δικό σου: Euribor 3 μηνών {fmtPct(market.euribor_3m)} συν περιθώριο {fmtPct(R)}. Το σταθερό αναφοράς είναι το χαμηλότερο καταχωρημένο σταθερό επιτόκιο {bankFixedMins.length} τραπεζών ({fmtPct(fixedRefRate)}, επιβεβαιωμένα {banksVerified}).</>
            : <>Το σταθερό είναι το δικό σου ({fmtPct(effRate)}). Κυμαινόμενο αναφοράς: Euribor 3 μηνών {fmtPct(market.euribor_3m)} συν <strong style={{color:'var(--text-secondary)'}}>διάμεσο περιθώριο {fmtPct(refVarSpread.pct)}</strong>: ο διάμεσος των ελάχιστων περιθωρίων {refVarSpread.count} τραπεζών, από τα ίδια καταχωρημένα επιτόκια της σύγκρισης τραπεζών (επιβεβαιωμένα {banksVerified}), όχι στρογγυλή υπόθεση. Το δικό σου περιθώριο εξαρτάται από το προφίλ σου· μπορεί να είναι υψηλότερο.</>}
        </p>
        <p style={{...labelStyle,marginBottom:10}}>Σωρευτικοί τόκοι στη διάρκεια</p>
        <DualLine data={fvChartData} keyA="Σταθερό" keyB="Κυμαινόμενο" fmt={fmtEur}/>
        <div style={{display:'flex',gap:16,marginTop:8}}>
          <span style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'var(--text-secondary)',fontFamily: T.font.sans}}><span style={{width:14,height:2.4,borderRadius:3,background:'var(--accent)',display:'inline-block'}}/>Σταθερό</span>
          <span style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'var(--text-secondary)',fontFamily: T.font.sans}}><span style={{width:14,height:0,borderTop:'2px dashed var(--text-tertiary)',display:'inline-block'}}/>Κυμαινόμενο</span>
        </div>
      </Section>

      {/* Όσο το πρόγραμμα δεν δέχεται αιτήσεις, μία γραμμή: ούτε δόση ούτε
          επιτόκιο ούτε εξοικονόμηση. Αναδιπλούμενη ενότητα με κρυμμένη μέσα
          τη μόνη πρόταση θα έκρυβε ακριβώς αυτό που πρέπει να διαβαστεί. */}
      {spitiClosed ? (
        <div style={{...panelStyle,padding:'14px 16px'}}>
          <p style={{fontSize:14,color:'var(--text-primary)',fontFamily: T.font.sans,fontWeight:600}}>Σπίτι μου ΙΙ</p>
          <p style={{fontSize:12,color:'var(--text-secondary)',marginTop: 4,lineHeight:1.5,fontFamily: T.font.sans}}>{spitiClosed}</p>
        </div>
      ) : (
      <Section title="Σπίτι μου ΙΙ έναντι κανονικού δανείου" sub={spitiEligible?'Εκτίμηση εξοικονόμησης':'Κριτήρια ένταξης'}>
        {spitiEligible?(<>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',gap:12,marginBottom:14}}>
          {[
            {label:'Σπίτι μου ΙΙ (εκτίμηση)',rate:spitiR,m:spitiM,ti:spitiM*Y*12-LA,c:'var(--text-primary)',bg:'var(--bg-surface)',border:'var(--border-subtle)'},
            {label:'Κανονικό δάνειο',rate:effRate,m:monthly,ti:totalInt,c:'var(--text-primary)',bg:'var(--bg-surface)',border:'var(--border-subtle)'},
          ].map(item=>(
            <div key={item.label} style={{background:item.bg,border:`1px solid ${item.border}`,borderRadius:10,padding:14}}>
              <p style={{fontSize: 'var(--fs-base)',color:item.c,fontWeight:500,fontFamily: T.font.sans,marginBottom:12}}>{item.label}</p>
              {[['Επιτόκιο',fmtPct(item.rate)],['Δόση τον μήνα',fmtEur(item.m)],['Συνολικοί τόκοι',fmtEur(item.ti)],['Σύνολο',fmtEur(item.m*Y*12)]].map(([k,v])=>(
                <div key={k} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                  <span style={{fontSize:12,color:'var(--text-secondary)',fontFamily: T.font.sans}}>{k}</span>
                  <span style={{fontSize:12,fontFamily: T.font.sans,fontVariantNumeric:'tabular-nums',color:item.c,fontWeight:600}}>{v}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{background:'var(--accent-dim)',border:'1px solid var(--border-accent)',borderRadius:10,padding:'14px 18px',textAlign:'center' as const}}>
          <p style={{fontSize:12,color:'var(--text-secondary)',marginBottom:4,fontFamily: T.font.sans}}>Εκτιμώμενη συνολική εξοικονόμηση</p>
          <p style={{fontSize:28,fontFamily: T.font.sans,fontVariantNumeric:'tabular-nums',color:'var(--accent)',fontWeight:700}}>{fmtEur(spitiSv)}</p>
          <p style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',marginTop:6,fontFamily: T.font.sans}}>{fmtEur(spitiSv/Math.max(Y*12,1))} τον μήνα εξοικονόμηση</p>
        </div>
        <p style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',marginTop:10,lineHeight:1.6,fontFamily: T.font.sans}}>Εκτίμηση βάσει μέσου επιδοτούμενου επιτοκίου. <a href="https://greece20.gov.gr/home-loans/" target="_blank" rel="noreferrer" style={{color:'var(--accent)',textDecoration:'none',fontWeight:500}}>greece20.gov.gr</a></p>
        </>):(
        <div style={{background:'var(--bg-surface)',border:'1px solid var(--border-subtle)',borderRadius:10,padding:'16px 18px'}}>
          <p style={{fontSize: 'var(--fs-base)',color:'var(--text-secondary)',fontFamily: T.font.sans,lineHeight:1.7,marginBottom:12}}>Το πρόγραμμα «Σπίτι μου ΙΙ» αφορά αποκλειστικά την αγορά πρώτης κατοικίας. Με τα τρέχοντα στοιχεία δεν πληρούνται τα βασικά κριτήρια, οπότε δεν εμφανίζεται εκτίμηση εξοικονόμησης για να μη σου δώσουμε παραπλανητικό νούμερο.</p>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {[
              {ok:loanType==='first_home',t:'Σκοπός: αγορά πρώτης κατοικίας'},
              {ok:PV<=SPITI_MOU.maxPropertyValue,t:`Αξία ακινήτου έως ${fmtEur(SPITI_MOU.maxPropertyValue)}`},
              {ok:LA<=SPITI_MOU.maxAmount,t:`Ποσό δανείου έως ${fmtEur(SPITI_MOU.maxAmount)}`},
              {ok:Y<=SPITI_MOU.maxYears,t:`Διάρκεια έως ${SPITI_MOU.maxYears} έτη`},
              {ok:!isNewBuilding,t:'Υφιστάμενο ακίνητο (όχι νεόδμητο)'},
              {ok:!isCommercial,t:'Κατοικία (όχι επαγγελματικό ακίνητο)'},
            ].map(c=>(
              <div key={c.t} style={{display:'flex',alignItems:'center',gap:10}}>
                <span style={{width:18,height:18,borderRadius:'50%',flexShrink:0,border:`1.5px solid ${c.ok?'var(--border-accent)':'var(--border-default)'}`,background:c.ok?'var(--accent-dim)':'transparent',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize: 'var(--fs-xs)',color:c.ok?'var(--accent)':'var(--text-tertiary)',fontWeight:700}}>{c.ok?'✓':''}</span>
                <span style={{fontSize: 'var(--fs-base)',color:c.ok?'var(--text-primary)':'var(--text-tertiary)',fontFamily: T.font.sans}}>{c.t}</span>
              </div>
            ))}
          </div>
          <p style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',marginTop:14,lineHeight:1.6,fontFamily: T.font.sans}}>Αναλυτικά κριτήρια και δικαιολογητικά <a href="https://greece20.gov.gr/home-loans/" target="_blank" rel="noreferrer" style={{color:'var(--accent)',textDecoration:'none',fontWeight:500}}>greece20.gov.gr</a></p>
        </div>
        )}
      </Section>
      )}
    </>
  );
}
