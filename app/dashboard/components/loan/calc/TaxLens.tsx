'use client'
// ═══════════════════════════════════════════════════════════════════════════
// Ο ΦΑΚΟΣ «ΦΟΡΟΣ ΚΑΙ ΑΝΤΟΧΗ»: ΦΟΡΟΛΟΓΙΚΗ ΑΝΑΛΥΣΗ, ΑΝΤΟΧΗ ΣΕ ΑΝΟΔΟ ΕΠΙΤΟΚΙΟΥ,
// ΑΝΑΧΡΗΜΑΤΟΔΟΤΗΣΗ
// ─────────────────────────────────────────────────────────────────────────
// Ο φόρος μεταβίβασης, ο φόρος ενοικίων και τα σενάρια ανόδου υπολογίζονται στο
// TabLoanCalculator από τις μοναδικές πηγές (lib/accounting/transfer,
// lib/billing/greekTax)· εδώ ζωγραφίζονται.
// ═══════════════════════════════════════════════════════════════════════════
import { CustomSelect, NumberInput } from '../../UIComponents'
import { T, fixedCols, Tile, widestOf } from '@/components/Theme'
import { hy } from '@/components/Hyphen'
import { BORROWER_PROFILES, fmtEur, fmtPct, fmtPct1, taxableRental, type LoanType, type RateType, type BorrowerType } from '../../TabLoanData'
import { rentalRowsForYear } from '@/lib/billing/greekTax'
import { athensParts } from '@/lib/core/time'
import { PRESUMPTIVE_RULE } from '@/lib/billing/consolidate'
import { transferTaxOn, TRANSFER_TAX_RATE } from '@/lib/accounting/transfer'
import { MARITAL_OPTIONS, CHILDREN_OPTIONS } from './model'
import { Section, labelStyle, type SetState } from './Bits'
import { StressBars } from './charts'
import { fpRate } from '@/lib/core/format'

// Ο ΦΜΑ στο κείμενο βγαίνει από τη σταθερά που τον υπολογίζει, όχι γραμμένος δίπλα της.
const FMA_PCT = fpRate(TRANSFER_TAX_RATE * 100)

export function TaxLens({
  isCommercial, marital, setMarital, childrenCount: children, setChildren, fmaOwed, fmaEx, PV, loanType, renInc,
  rentAssumptionText, rentsBank, setRentsBank, renTax, stress, INC, borrower, rateType, fixedPeriod, Y,
  remBal, setRemBal, remYears, setRemYears, curRate, setCurRate, newRate, setNewRate, xferCost, setXferCost,
  brkEven, currM, newM, refSav, mSav,
}: {
  isCommercial: boolean; marital: 'single' | 'married'; setMarital: SetState<'single' | 'married'>;
  /** Τα εξαρτώμενα τέκνα (το `children` της καρτέλας· εδώ το όνομα το κρατά το React). */
  childrenCount: string; setChildren: SetState<string>;
  fmaOwed: number; fmaEx: number; PV: number; loanType: LoanType; renInc: number; rentAssumptionText: string;
  rentsBank: boolean; setRentsBank: SetState<boolean>; renTax: number;
  stress: { label: string; rate: number; monthly: number }[]; INC: number; borrower: BorrowerType;
  rateType: RateType; fixedPeriod: string; Y: number;
  remBal: string; setRemBal: SetState<string>; remYears: string; setRemYears: SetState<string>;
  curRate: string; setCurRate: SetState<string>; newRate: string; setNewRate: SetState<string>;
  xferCost: string; setXferCost: SetState<string>; brkEven: number | null; currM: number; newM: number; refSav: number; mSav: number;
}) {
  return (
    <>
      <Section title="Φορολογική ανάλυση" sub="ΦΜΑ, απαλλαγές, ενοίκια, ΑΑΔΕ 2026" defaultOpen>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div style={{padding:'12px 14px',background:'var(--bg-surface)',border:'1px solid var(--border-subtle)',borderRadius:10}}>
            <p title="ΦΜΑ: Φόρος Μεταβίβασης Ακινήτου · ΦΠΑ: Φόρος Προστιθέμενης Αξίας" style={{...labelStyle,marginBottom:4}}>{isCommercial?`ΦΜΑ ${FMA_PCT} + Ψηφιακό Τέλος`:`ΦΜΑ ${FMA_PCT}`}</p>
            <p style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',marginBottom:12,lineHeight:1.5,fontFamily: T.font.sans}}>{isCommercial?'Φόρος Μεταβίβασης Ακινήτου και Ψηφιακό Τέλος Συναλλαγής μίσθωσης':'Φόρος Μεταβίβασης Ακινήτου'}</p>
            {!isCommercial&&(
              /* ══ ΤΑ ΠΕΔΙΑ ΣΤΟΙΧΙΖΟΝΤΑΙ ΜΕ ΤΑ ΠΛΑΚΙΔΙΑ ΠΟΥ ΥΠΟΛΟΓΙΖΟΥΝ ═══════
                  Δύο πεδία με `formGrid(200, 270)` πάνω από τρία πλακίδια με
                  `auto-fit` στα 150: τρία διαφορετικά πλάτη στηλών σε δύο
                  σειρές που ΣΧΕΤΙΖΟΝΤΑΙ, γιατί τα πεδία είναι η είσοδος και
                  τα πλακίδια το αποτέλεσμα. Καμία κάθετη ακμή δεν συνέπιπτε.

                  Ιδιο πλέγμα, τρεις στήλες και στις δύο σειρές. Η οικογενειακή
                  κατάσταση κάθεται πάνω από το όριο απαλλαγής που ορίζει, τα
                  τέκνα πάνω από τον φόρο που αναλογεί· και η τρίτη στήλη μένει
                  κενή γιατί η αξία του ακινήτου δεν ρυθμίζεται εδώ. */
              <div {...fixedCols(3, 10, 'end', '', 3)} style={{...fixedCols(3, 10, 'end', '', 3).style, marginBottom:12}}>
                <CustomSelect label="Οικογενειακή κατάσταση" value={marital} onChange={v=>setMarital(v === 'married' ? 'married' : 'single')} options={MARITAL_OPTIONS}/>
                <CustomSelect label="Εξαρτώμενα τέκνα" value={children} onChange={setChildren} options={CHILDREN_OPTIONS}/>
              </div>
            )}
            {/* Τρία πλακίδια, ο ίδιος κανόνας με τη Δανειοληπτική ικανότητα. */}
            {(()=>{ const a=isCommercial?fmtEur(fmaOwed):fmtEur(fmaEx), b=fmaOwed===0?'Απαλλαγή':fmtEur(fmaOwed), c=fmtEur(PV), w=widestOf(a,b,c); return (
            <div {...fixedCols(3, 10, 'end', '', 3)} style={{...fixedCols(3, 10, 'end', '', 3).style, marginBottom:10}}>
              <Tile label={isCommercial?`ΦΜΑ ${FMA_PCT}`:'Όριο απαλλαγής ΦΜΑ'} value={a} chars={w}/>
              <Tile label="ΦΜΑ που αναλογεί" value={b} chars={w}/>
              <Tile label="Αξία ακινήτου" value={c} chars={w}/>
            </div>) })()}
            {/* Η απαλλαγή αφαιρεί ποσό από τη βάση, δεν είναι κατώφλι: πάνω από το
                όριο φορολογείται μόνο το υπερβάλλον, οπότε η εξοικονόμηση μένει. */}
            {loanType==='first_home'&&!isCommercial&&<div style={{padding:'10px 14px',background:'var(--bg-elevated)',border:'1px solid var(--border-subtle)',borderRadius: T.radius.chip}}><p title="ΦΜΑ: Φόρος Μεταβίβασης Ακινήτου" style={{fontSize: 'var(--fs-base)',color:'var(--text-primary)',fontFamily: T.font.sans,fontWeight:500}}>{PV<=fmaEx
              ? `Δικαιούσαι πλήρη απαλλαγή ΦΜΑ: γλιτώνεις ${fmtEur(transferTaxOn(PV))}.`
              : `Η απαλλαγή καλύπτει τα πρώτα ${fmtEur(fmaEx)}: φόρο πληρώνεις μόνο για τα ${fmtEur(PV-fmaEx)} πάνω από αυτά και γλιτώνεις ${fmtEur(transferTaxOn(PV)-fmaOwed)}.`}</p></div>}
          </div>
          {loanType==='investment'&&(
            <div style={{padding:'12px 14px',background:'var(--bg-surface)',border:'1px solid var(--border-subtle)',borderRadius:10}}>
              {/* Η κλίμακα έρχεται από τη ΜΟΝΑΔΙΚΗ πηγή (lib/billing/greekTax), την
                  ίδια που κάνει τον υπολογισμό λίγες γραμμές παρακάτω. Πριν, ο
                  πίνακας διάβαζε ένα τοπικό αντίγραφο: μετά την πρώτη αλλαγή του
                  νόμου θα έδειχνε παλιά κλιμάκια πάνω από νέο ποσό. */}
              {/* Η ΧΡΟΝΙΑ ΔΕΝ ΓΡΑΦΕΤΑΙ ΜΕ ΤΟ ΧΕΡΙ. Ενα καρφωμένο «2026» στην
                  επικεφαλίδα θα έμενε εκεί ολόκληρο το 2027, πάνω από πίνακα
                  που θα είχε ήδη αλλάξει. */}
              <p style={{...labelStyle,marginBottom:12}}>Κλίμακα ενοικίων {athensParts().year}</p>
              {rentalRowsForYear(athensParts().year).map((b,i)=>(
                <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 14px',background:'var(--bg-elevated)',border:'1px solid var(--border-subtle)',borderRadius:10,marginBottom: 4}}>
                  <span style={{fontSize:12,color:'var(--text-secondary)',fontFamily: T.font.sans}}>{b.range}</span>
                  <span style={{fontSize:14,fontFamily: T.font.mono,fontVariantNumeric:'tabular-nums',color:'var(--text-primary)',fontWeight:700}}>{b.rate}</span>
                </div>
              ))}
              <div style={{marginTop:10,padding:'11px 12px',background:'var(--bg-elevated)',border:'1px solid var(--border-subtle)',borderRadius:10}}>
                {/* ΤΟ ΕΝΟΙΚΙΟ ΤΟΥ ΥΠΟΛΟΓΙΣΜΟΥ ΓΡΑΦΕΤΑΙ ΣΤΗΝ ΟΘΟΝΗ. */}
                <p style={{fontSize:12,color:'var(--text-secondary)',fontFamily: T.font.sans,lineHeight:1.6,marginBottom:10}}>
                  Υποθετικό ετήσιο ενοίκιο: <strong style={{color:'var(--text-primary)'}}>{fmtEur(renInc)}</strong>. {rentAssumptionText}
                </p>
                {/* Η έκπτωση 5% ΔΕΝ είναι «αυτόματη» — είναι όρος και ο όρος είναι
                    επιλογή του χρήστη με μετρήσιμη συνέπεια στον φόρο του. */}
                <label style={{display:'inline-flex',alignItems:'center',gap:8,cursor:'pointer',fontSize: 'var(--fs-base)',fontFamily: T.font.sans,color:'var(--text-primary)',fontWeight:600}}>
                  <input type="checkbox" checked={rentsBank} onChange={e=>setRentsBank(e.target.checked)} style={{width:15,height:15,accentColor:'var(--accent)',cursor:'pointer'}}/>
                  Τα ενοίκια θα εισπράττονται μέσω τράπεζας
                </label>
                <p className="po-prose po-just" style={{margin:'4px 0 0 23px',fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',fontFamily: T.font.sans}}>{hy(<>{PRESUMPTIVE_RULE}</>)}</p>
                <p style={{margin:'10px 0 0',fontSize:12,color:'var(--text-secondary)',fontFamily: T.font.sans,lineHeight:1.6}}>
                  Φορολογητέο {fmtEur(taxableRental(renInc, rentsBank))} · <strong style={{color:'var(--text-primary)'}}>εκτιμώμενος φόρος {fmtEur(renTax)} τον χρόνο</strong>. Ο φόρος ενοικίων είναι προοδευτικός στο σύνολο των ακινήτων σου: αν έχεις κι άλλα, δες το πραγματικό ποσό στη Λογιστική.
                </p>
              </div>
            </div>
          )}
        </div>
      </Section>

      <Section title="Αντοχή σε άνοδο επιτοκίου" sub="Αντοχή δόσης σε σενάρια ανόδου Euribor">
        <div style={{marginBottom:16}}>
          <StressBars stress={stress} limit={INC>0?INC*BORROWER_PROFILES[borrower].income_ratio:0} INC={INC} fmt={fmtEur} fmtPct={fmtPct} fmtPct1={fmtPct1}/>
        </div>
        {/* Η ΠΡΩΤΗ ΣΤΗΛΗ ΚΑΡΦΩΝΕΤΑΙ. Πέντε στήλες με «Δόση προς εισόδημα» στο τέλος
            δεν χωρούν σε τηλέφωνο: ο πίνακας κυλά και το «Τρέχον», το «+1%», το
            «+3%» —δηλαδή ΠΟΙΟ σενάριο διαβάζεις— φεύγουν αριστερά. Μένουν
            τέσσερις στήλες ποσών χωρίς να λένε ποιανού είναι. */}
        <div className="po-table-box">
         <div className="po-scroll-x">
          <table className="po-table pin-1" style={{'--tbl-min':'500px','--row-bg':'var(--surface-raised)'}}>
            <thead><tr>{['Σενάριο','Επιτόκιο','Δόση τον μήνα','Αύξηση','Δόση προς εισόδημα'].map((h,i)=><th key={h} scope="col" style={{textAlign:i?'right' as const:undefined}}>{h}</th>)}</tr></thead>
          <tbody>
            {stress.map((s,i)=>{
              const diff=s.monthly-stress[0].monthly,dti=(s.monthly/INC)*100
              return <tr key={i} style={{'--row-bg':i===0?'var(--bg-elevated)':'var(--surface-raised)',background:i===0?'var(--bg-elevated)':'transparent'}}>
                <td style={{color:'var(--text-primary)',fontWeight:i===0?600:400}}>{s.label}</td>
                <td className="num">{fmtPct(s.rate)}</td>
                <td className="num" style={{color:'var(--text-primary)',fontWeight:600}}>{fmtEur(s.monthly)}</td>
                <td className="num" style={{color:i===0?'var(--text-tertiary)':'var(--text-secondary)'}}>{i===0?fmtEur(0):diff>=0?`+${fmtEur(diff)}`:`-${fmtEur(-diff)}`}</td>
                <td className="num" style={{color:"var(--text-primary)",fontWeight:dti>40?700:500}}>{fmtPct1(dti)}</td>
              </tr>
            })}
          </tbody>
        </table>
         </div>
        </div>
        {rateType==='fixed'&&<div style={{marginTop:10,padding:'9px 12px',background:'var(--bg-surface)',border:'1px solid var(--border-subtle)',borderRadius:10}}><p style={{fontSize:12,color:'var(--text-secondary)',fontFamily: T.font.sans,fontWeight:500}}>Σταθερό για {fixedPeriod} χρόνια: ως τότε η δόση δεν αλλάζει με το Euribor{Number(fixedPeriod)<Y?'· μετά το επιτόκιο αλλάζει':''}.</p></div>}
      </Section>

      <Section title="Ανάλυση αναχρηματοδότησης" sub="Σημείο απόσβεσης, πότε αξίζει η μεταφορά">
        {/* ══ ΠΕΝΤΕ ΠΕΔΙΑ, ΜΙΑ ΕΥΘΕΙΑ ═══════════════════════════════════════════
            Το `formGrid` γεμίζει με `auto-fill` και ΚΟΒΕΙ κάθε στήλη στα 180:
            σε κάρτα 1.350 εικονοστοιχείων χωρούσαν τέσσερα και το πέμπτο
            έπεφτε μόνο του σε δεύτερη σειρά, με τρεις άδειες στήλες δεξιά
            του. Πέντε πεδία της ίδιας ερώτησης —τι δάνειο έχεις τώρα και τι
            σου προσφέρουν— διαβάζονται ως πέντε, όχι ως τέσσερα συν ένα.
            Το `fixedCols` γράφει το πλήθος αντί να το αφήνει στο πλάτος, με
            τρεις στήλες σε ταμπλέτα (το πέντε δεν έχει διαιρέτη που χωρά).

            ΚΑΙ Η ΤΑΜΠΛΕΤΑ ΞΕΚΙΝΑ ΝΩΡΙΤΕΡΑ ΓΙΑ ΠΕΔΙΑ ΠΟΣΩΝ. Το κοινό σπάσιμο των
            `.fixed-cols` είναι στα 820, οπότε στα 834 έμεναν πέντε στήλες: 752
            πλάτος διά πέντε δίνει κουτί 142 και μέσα του 78 για την τιμή. Το
            «100.000,00» θέλει 92 — μετρημένο, όχι εκτιμημένο — άρα ο χρήστης
            έβλεπε το υπόλοιπο του δανείου του κομμένο. Η `.fc-roomy` υπάρχει
            ακριβώς γι' αυτό: κατεβάζει στις τρεις στήλες ήδη από τα 1.000, εκεί
            που τα πεδία κρατούν ποσά και όχι διακόπτες. */}
        <div {...fixedCols(5, 10, 'end', 'fc-roomy', 3)} style={{...fixedCols(5, 10, 'end', 'fc-roomy', 3).style, marginBottom:14}}>
          <NumberInput label="Υπόλοιπο" value={remBal} onChange={setRemBal} suffix="€"/>
          <NumberInput label="Χρόνια που μένουν" value={remYears} onChange={setRemYears} suffix="έτη"/>
          <NumberInput label="Τρέχον επιτόκιο" value={curRate} onChange={setCurRate} suffix="%"/>
          <NumberInput label="Νέο επιτόκιο" value={newRate} onChange={setNewRate} suffix="%"/>
          <NumberInput label="Κόστος μεταφοράς" value={xferCost} onChange={setXferCost} suffix="€"/>
        </div>
        {(()=>{ const brk=brkEven?`${brkEven} μήνες`:'Δεν αποσβένεται', w=widestOf(fmtEur(currM), fmtEur(newM), fmtEur(Math.max(0,refSav)), brk); return (
        <div {...fixedCols(4, 8)}>
          <Tile label="Τρέχουσα δόση" value={fmtEur(currM)} chars={w}/>
          <Tile label="Νέα δόση" value={fmtEur(newM)} chars={w} sub={`${fmtEur(mSav)} τον μήνα`}/>
          <Tile label="Καθαρή εξοικονόμηση" value={fmtEur(Math.max(0,refSav))} chars={w} sub={refSav>0?'Αξίζει':'Δεν συμφέρει'}/>
          {/* Η σημείωση «Απόσβεση εξόδων μεταφοράς» έλεγε ξανά την ετικέτα με
              άλλα λόγια. Ο ορισμός ζει στο γλωσσάρι, μία φορά. */}
          <Tile label="Σημείο απόσβεσης" value={brk} chars={w}/>
        </div>) })()}
      </Section>
    </>
  );
}
