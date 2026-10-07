'use client'
// ═══════════════════════════════════════════════════════════════════════════
// Ο ΦΑΚΟΣ «ΙΚΑΝΟΤΗΤΑ»: ΔΑΝΕΙΟΛΗΠΤΙΚΗ ΙΚΑΝΟΤΗΤΑ ΚΑΙ ΕΝΟΙΚΙΑΣΗ Ή ΑΓΟΡΑ
// ─────────────────────────────────────────────────────────────────────────
// Οι δύο υπολογισμοί (`affordability`, `rentVsBuy`) τρέχουν κατά την απόδοση,
// όπως έτρεχαν μέσα στην καρτέλα· το εισόδημα και το ενοίκιο σύγκρισης είναι
// κατάσταση του TabLoanCalculator, γιατί τα διαβάζει και ο φακός αντοχής.
// ═══════════════════════════════════════════════════════════════════════════
import { NumberInput } from '../../UIComponents'
import { fp } from '@/lib/core/format'
import { T, fixedCols, Tile, widestOf, LinkBtn } from '@/components/Theme'
import { affordability, rentVsBuy } from '@/lib/loans/affordability'
import { fmtEur, fmtPct, fmtPct1, type LoanType } from '../../TabLoanData'
import { Section, type SetState } from './Bits'
import { RentBuyChart } from './charts'

export function CapacityLens({
  loanType, INC, LA, effRate, Y, income, setIncome, rentTouched, monthlyRent, rentRef, PV, totalCosts,
  setMonthlyRent, setRentTouched, rentAssumptionText,
}: {
  loanType: LoanType; INC: number; LA: number; effRate: number; Y: number; income: string; setIncome: SetState<string>;
  rentTouched: boolean; monthlyRent: string; rentRef: { monthly: number; source: 'actual' | 'region' }; PV: number;
  totalCosts: { total: number }; setMonthlyRent: SetState<string>; setRentTouched: SetState<boolean>; rentAssumptionText: string;
}) {
  return (
    <>
      {(()=>{
        // ΤΑ ΟΡΙΑ ΤΗΣ ΤτΕ ΚΡΙΝΟΝΤΑΙ ΑΠΟ ΤΟΝ ΠΡΩΤΟΑΓΟΡΑΣΤΗ, ΟΧΙ ΑΠΟ ΤΗΝ ΠΡΩΤΗ
        // ΚΑΤΟΙΚΙΑ (ΠΕΕ 227/1/2024). Ο υπολογιστής δεν ρωτά αν δανείζεσαι για
        // πρώτη φορά — θα ήταν έβδομο πεδίο σε οθόνη που ζητά ήδη έξι — οπότε το
        // εικάζει από τον σκοπό και ΤΟ ΓΡΑΦΕΙ. Η ακριβής ερώτηση γίνεται στην
        // «Πιθανότητα έγκρισης», που έχει ούτως ή άλλως τη φόρμα της.
        const firstTimeBuyer = loanType==='first_home'
        const aff = affordability({ incomeMonthly:INC, firstTimeBuyer, desiredAmount:LA, ratePct:effRate, years:Y })
        return (
      <Section title="Δανειοληπτική ικανότητα" sub="Μέγιστο δάνειο βάσει εισοδήματος και ορίων Τράπεζας Ελλάδος" defaultOpen>
        <div style={{marginBottom:16}}><NumberInput label="Μηνιαίο καθαρό εισόδημα" value={income} onChange={setIncome} suffix="€"/></div>
        {/* ═══ ΠΕΜΠΤΗ ΓΡΑΦΗ ΤΟΥ ΠΛΑΚΙΔΙΟΥ ΚΑΙ Η ΠΙΟ ΑΚΡΙΒΗ ═══════════════════════
            Ζωγράφιζε δικό της κουτί, δική της ανύψωση με κατάσταση React και
            τέσσερις ακροατές, ετικέτα 700 με 0,06em αντί για την 600 με 0,08em
            του βιβλίου· και νούμερο ΣΤΑΘΕΡΟ στα 28. Ο χρήστης το φωτογράφισε σε
            tablet: «ΜΕΓΙΣΤΗ ΔΟΣΗ ΤΟΝ ΜΗΝΑ» σε δύο γραμμές, «ΜΕΓΙΣΤΟ ΔΑΝΕΙΟ» σε
            μία, τρία νούμερα σε τρία ύψη — και το «800,00€» ίδιο μέγεθος με το
            «159.801,00€», που το δεύτερο χρειαζόταν διπλάσιο χώρο.

            Τρία πλακίδια σε δύο στήλες αφήνουν το τρίτο μόνο του: μετρημένο στα
            375 και στα 430, «2+1» με τρύπα δίπλα. Οι μεταβλητές του `.kpi-row`
            κρατούν μία στήλη στα στενά πλάτη, που είναι ζυγισμένη. */}
        <div className="kpi-row" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',gap:12,marginBottom:16,'--kpi-lg':3,'--kpi-md':3,'--kpi-sm':1} as React.CSSProperties}>
          {(()=>{ const cap=[
            {k:'Μέγιστη δόση τον μήνα',v:fmtEur(aff.maxMonthly),s:`${fp(aff.limitPct*100)} του εισοδήματος${firstTimeBuyer?', ως πρωτοαγοραστής':''}`},
            {k:'Μέγιστο δάνειο',v:fmtEur(aff.maxLoan),s:`με ${fmtPct(effRate)} · ${Y} έτη`},
            {k:'Δείκτης δόσης προς εισόδημα',v:INC>0?fmtPct1(aff.dstiUsedPct):fp(0),s:`όριο ${Math.round(aff.limitPct*100)}%`},
          ]; const w=widestOf(...cap.map(t=>t.v));
            return cap.map(t=>(<Tile key={t.k} label={t.k} value={t.v} sub={t.s} chars={w}/>)) })()}
        </div>
        {/* Οπτικός μετρητής: πού βρίσκεται η δόση σου σε σχέση με το όριο */}
        {INC>0&&(()=>{
          const limitPct=aff.limitPct*100, usedPct=aff.dstiUsedPct, over=usedPct>limitPct
          const scaleMax=Math.max(limitPct*1.35, usedPct*1.08, 1)
          const usedW=Math.min(100,(usedPct/scaleMax)*100), limitX=Math.min(100,(limitPct/scaleMax)*100)
          return (
            <div style={{marginBottom:14}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom: 8}}>
                <span style={{fontSize: 'var(--fs-base)',color:'var(--text-secondary)',fontFamily: T.font.sans}}>Η δόση ως ποσοστό του εισοδήματος</span>
                <span style={{fontSize: 'var(--fs-base)',color:'var(--text-primary)',fontFamily: T.font.mono,fontVariantNumeric:'tabular-nums',fontWeight:600}}>{fmtPct1(usedPct)} <span style={{color:'var(--text-tertiary)'}}>από {Math.round(limitPct)}%</span></span>
              </div>
              <div style={{position:'relative',height:T.h.md,borderRadius: T.radius.popup,background:'var(--bg-surface)',border:'1px solid var(--border-subtle)',overflow:'hidden'}}>
                <div style={{position:'absolute',left:0,top:0,bottom:0,width:`${usedW}%`,borderRadius:'12px 0 0 12px',transition:'width 0.4s ease',
                  background:over?'linear-gradient(90deg, color-mix(in srgb, var(--text-secondary) 55%, transparent), var(--text-secondary))':'linear-gradient(90deg, color-mix(in srgb, var(--accent) 78%, transparent), var(--accent))'}}/>
                <div style={{position:'absolute',left:`${limitX}%`,top:0,bottom:0,width:0,borderLeft:'2px dashed var(--text-secondary)'}}/>
                {/* ═══ Η ΕΤΙΚΕΤΑ ΚΑΘΕΤΑΙ ΣΤΗΝ ΠΛΕΥΡΑ ΠΟΥ ΕΧΕΙ ΧΩΡΟ ══════════════
                    Ηταν πάντα ΔΕΞΙΑ της διακεκομμένης, με σταθερό «left». Οταν το
                    όριο πέφτει πέρα από τη μέση —ή όταν η μπάρα είναι στενή, όπως
                    στα 320— το «Όριο 40%» δεν χωρούσε και ξέφευγε από την μπάρα,
                    που έχει overflow hidden: το κείμενο κοβόταν στη μέση.
                    Πέρα από τη μέση αγκυρώνεται ΔΕΞΙΑ και μπαίνει αριστερά της
                    γραμμής. Η πληροφορία είναι η ίδια· αλλάζει μόνο η πλευρά. */}
                <span style={{position:'absolute',
                  ...(limitX > 50 ? { right: `calc(${100 - limitX}% + 6px)` } : { left: `calc(${limitX}% + 6px)` }),
                  top:'50%',transform:'translateY(-50%)',fontSize: 'var(--fs-xs)',color:'var(--text-secondary)',fontFamily: T.font.sans,fontWeight:600,whiteSpace:'nowrap' as const}}>Όριο {Math.round(limitPct)}%</span>
              </div>
            </div>
          )
        })()}
        {!aff.affordable
          ? <div style={{padding:'11px 14px',background:'var(--bg-elevated)',border:'1px solid var(--border-default)',borderRadius:10}}><p style={{fontSize: 'var(--fs-base)',color:'var(--text-primary)',lineHeight:1.5,fontFamily: T.font.sans}}>Η δόση υπερβαίνει το όριο κατά {fmtEur(aff.gapMonthly)} τον μήνα. Μείωσε το ποσό έως {fmtEur(aff.maxLoan)} ή αύξησε τη διάρκεια.</p></div>
          : <div style={{padding:'11px 14px',background:'var(--bg-elevated)',border:'1px solid var(--border-subtle)',borderLeft:'3px solid var(--border-default)',borderRadius:10}}><p style={{fontSize: 'var(--fs-base)',color:'var(--text-primary)',lineHeight:1.5,fontFamily: T.font.sans}}>Η δόση καλύπτεται άνετα. Απομένει περιθώριο έως {fmtEur(aff.maxMonthly-aff.requestedMonthly)} τον μήνα, που αντιστοιχεί σε επιπλέον δάνειο έως {fmtEur(aff.maxLoan-LA)}.</p></div>
        }
      </Section>
        )
      })()}

      {(()=>{
        // Ενοικίαση ή αγορά — απλό, έντιμο TCO σε βάθος ετών.
        // Το ενοίκιο σύγκρισης ακολουθεί το ενοίκιο-αναφορά (πραγματικό ή
        // τεκμηριωμένο ανά περιοχή) όσο ο χρήστης δεν το έχει αλλάξει ο ίδιος.
        const rentShown = rentTouched ? monthlyRent : String(rentRef.monthly || '')
        const rent = rentTouched ? (parseFloat(monthlyRent)||0) : rentRef.monthly
        const horizon = Math.min(Math.max(Y,5),20)
        // totalCosts.total = φόροι + συμβολαιογραφικά + μεσιτικά (έξοδα συναλλαγής,
        // ΧΩΡΙΣ την προκαταβολή). Η προκαταβολή περνά χωριστά ως downPayment.
        const rvb = rentVsBuy({ price:PV, downPayment:PV-LA, ratePct:effRate, years:Y, monthlyRent:rent, purchaseCosts:totalCosts.total, horizonYears:horizon })
        const buys = rvb.advantageAtHorizon>0
        return (
      <Section title="Ενοικίαση ή αγορά" sub={`Σύγκριση συνολικού κόστους σε ${horizon} έτη`}>
        <div style={{marginBottom:6,maxWidth:280}}><NumberInput label="Μηνιαίο ενοίκιο αντίστοιχου ακινήτου" value={rentShown} onChange={v=>{setMonthlyRent(v);setRentTouched(true)}} suffix="€"/></div>
        <p style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',marginBottom:12,lineHeight:1.55,fontFamily: T.font.sans}}>
          {rentTouched ? 'Δική σου υπόθεση.' : rentAssumptionText}
          {rentTouched && <> <LinkBtn onClick={()=>{setMonthlyRent('');setRentTouched(false)}}>Επαναφορά στο τεκμηριωμένο ({fmtEur(rentRef.monthly)})</LinkBtn></>}
        </p>
        {/* Ενα μέγεθος για όλη τη σειρά: το μακρύτερο ποσό δίνει τον ρυθμό.

            ΚΑΙ ΤΡΙΑ ΠΛΑΚΙΔΙΑ, ΟΧΙ «ΟΣΑ ΧΩΡΑΝΕ». Το `auto-fit` έδινε δύο στήλες
            σε κάθε πλάτος από 412 ως 440 και το τρίτο πλακίδιο έμενε μόνο του
            με τρύπα δεξιά του — δεκαέξι φορές στη σάρωση διάταξης. Το
            `fixedCols(3)` ξέρει ότι τα πλακίδια είναι τρία: τρεις στήλες όσο
            χωρούν, ΜΙΑ όταν δεν χωρούν, ποτέ δύο. Ο διαιρέτης δεν αφήνει
            ορφανό. */}
        {(()=>{ const w=widestOf(fmtEur(rvb.buyNetAtHorizon), fmtEur(rvb.rentAtHorizon), fmtEur(Math.abs(rvb.advantageAtHorizon))); return (
        <div {...fixedCols(3, 8, 'stretch')} style={{...fixedCols(3, 8, 'stretch').style, marginBottom:14}}>
          <Tile label="Καθαρό κόστος αγοράς" value={fmtEur(rvb.buyNetAtHorizon)} chars={w} sub={`σε ${horizon} έτη, μετά την περιουσία`}/>
          <Tile label="Κόστος ενοικίασης" value={fmtEur(rvb.rentAtHorizon)} chars={w} sub={`σε ${horizon} έτη`}/>
          <Tile label={buys?'Πλεονέκτημα αγοράς':'Πλεονέκτημα ενοικίασης'} value={fmtEur(Math.abs(rvb.advantageAtHorizon))} chars={w} sub={rvb.breakEvenYear?`ισοσκελισμός στο έτος ${rvb.breakEvenYear}`:'χωρίς ισοσκελισμό στον ορίζοντα'}/>
        </div>) })()}
        <RentBuyChart buy={rvb.buyNetCostByYear} rent={rvb.rentCostByYear} horizon={horizon} breakEvenYear={rvb.breakEvenYear} fmt={fmtEur}/>
        <div style={{display:'flex',gap:16,marginTop:8}}>
          <span style={{display:'flex',alignItems:'center',gap:6,fontSize: 'var(--fs-xs)',color:'var(--text-secondary)',fontFamily: T.font.sans}}><span style={{width:14,height:2.4,background:'var(--accent)',display:'inline-block'}}/>Αγορά (καθαρό)</span>
          <span style={{display:'flex',alignItems:'center',gap:6,fontSize: 'var(--fs-xs)',color:'var(--text-secondary)',fontFamily: T.font.sans}}><span style={{width:14,height:2,borderTop:'2px dashed var(--text-tertiary)',display:'inline-block'}}/>Ενοικίαση</span>
        </div>
        <p style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',marginTop:10,lineHeight:1.6,fontFamily: T.font.sans}}>«Καθαρό κόστος αγοράς» = κόστος μείον περιουσία (αξία μείον υπόλοιπο δανείου). Από αυτό, <strong style={{color:'var(--text-secondary)',fontFamily:T.font.num}}>{fmtEur(rvb.interestAtHorizon)}</strong> είναι τόκοι: το μέρος που πληρώνεις χωρίς να γίνεται περιουσία σου, δηλαδή το αντίστοιχο του ενοικίου. Υποθέτει ήπια ανατίμηση ~2% · αύξηση ενοικίου ~2% τον χρόνο. Ενδεικτικό.</p>
      </Section>
        )
      })()}
    </>
  );
}
