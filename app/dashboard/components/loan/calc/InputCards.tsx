'use client'
// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΔΥΟ ΚΑΡΤΕΣ ΠΕΔΙΩΝ ΤΟΥ ΥΠΟΛΟΓΙΣΤΗ: «ΑΚΙΝΗΤΟ ΚΑΙ ΣΚΟΠΟΣ», «ΔΑΝΕΙΟ, ΕΠΙΤΟΚΙΟ
// ΚΑΙ ΠΑΡΑΜΕΤΡΟΙ»
// ─────────────────────────────────────────────────────────────────────────
// Η κατάσταση των πεδίων μένει στο TabLoanCalculator, γιατί από αυτήν βγαίνουν
// η δόση, ο πίνακας και ό,τι ανεβαίνει στον γονέα (`onStateChange`). Εδώ μόνο
// ζωγραφίζονται και κάθε αλλαγή γυρίζει με τον ίδιο setter.
// ═══════════════════════════════════════════════════════════════════════════
import { CustomSelect, NumberInput, TextInput, DatePicker, InfoDot, ToggleField } from '../../UIComponents'
import { cardStyle } from '../../LoanShared'
import { T, fixedCols } from '@/components/Theme'
import { BORROWER_PROFILES, fmtEur, fmtPct, loanTaxNote, type LoanType, type RateType, type BorrowerType, type MarketRates } from '../../TabLoanData'
import { greekDay, MONTH_MEAN } from '@/lib/market/ecb'
import { NEW_BUILD_VAT_SUSPENDED_UNTIL } from '@/lib/accounting/transfer'
import { PROP_TYPE_OPTIONS, AREA_OPTIONS, LOAN_TYPE_OPTIONS, RATE_TYPE_OPTIONS, FIXED_PERIOD_OPTIONS, euriborPeriod } from './model'
import { SectionLabel, ReadStat, type SetState } from './Bits'

type Option = { value: string; label: string; description: string }

// Ακίνητο και σκοπός — ενιαία κάρτα, ενιαίο πλέγμα πεδίων (χωρίς άνισα ύψη)
export function PropertyCard({
  propType, setPropType, setActivePreset, area, setArea, propValue, setPropValue, sqm, setSqm, loanType, setLoanType,
  borrower, setBorrower, borrowerOptions, sqmPrice, hasAgent, setHasAgent, agentPct, setAgentPct, AGNT,
  isNewBuilding, vatOwed, isCommercial,
}: {
  propType: string; setPropType: SetState<string>; setActivePreset: SetState<string | null>;
  area: string; setArea: SetState<string>; propValue: string; setPropValue: SetState<string>;
  sqm: string; setSqm: SetState<string>; loanType: LoanType; setLoanType: SetState<LoanType>;
  borrower: BorrowerType; setBorrower: SetState<BorrowerType>; borrowerOptions: Option[]; sqmPrice: number;
  hasAgent: boolean; setHasAgent: SetState<boolean>; agentPct: string; setAgentPct: SetState<string>; AGNT: number;
  isNewBuilding: boolean; vatOwed: number; isCommercial: boolean;
}) {
  return (
    <div style={cardStyle}>
      <SectionLabel label="Ακίνητο και σκοπός δανείου"/>
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        {/* Οκτώ κελιά, τέσσερα και τέσσερα. Ρητό πλήθος στηλών: το `auto-fit`
            έδινε τρεις σε οθόνη με zoom 125% και τέσσερις στο 100%. */}
        <div {...fixedCols(4)}>
          <CustomSelect label="Τύπος ακινήτου" value={propType} onChange={v=>{setPropType(v);setActivePreset(null)}} options={PROP_TYPE_OPTIONS}/>
          <CustomSelect label="Περιοχή" value={area} onChange={v=>{setArea(v);setActivePreset(null)}} options={AREA_OPTIONS}/>
          <NumberInput label="Τιμή αγοράς" value={propValue} onChange={v=>{setPropValue(v);setActivePreset(null)}} suffix="€"/>
          <NumberInput label="Εμβαδόν" value={sqm} onChange={v=>{setSqm(v);setActivePreset(null)}} suffix="τ.μ."/>
          <CustomSelect label="Σκοπός δανείου" labelInfo={loanTaxNote(loanType)?<InfoDot text={loanTaxNote(loanType)}/>:undefined} value={loanType} onChange={v=>{setLoanType(v as LoanType);setActivePreset(null)}} options={LOAN_TYPE_OPTIONS}/>
          <CustomSelect label="Τύπος δανειολήπτη" labelInfo={<InfoDot text={[BORROWER_PROFILES[borrower].tax_benefits,BORROWER_PROFILES[borrower].special].filter(Boolean).join(' · ')}/>} value={borrower} onChange={v=>{setBorrower(v as BorrowerType);setActivePreset(null)}} options={borrowerOptions}/>
          {/* Τιμή ανά τ.μ. — μέσα στο πλέγμα, δίπλα στον τύπο δανειολήπτη (πιο μαζεμένη κάρτα) */}
          {sqmPrice>0&&<ReadStat label="Τιμή ανά τ.μ." value={fmtEur(sqmPrice)}/>}
          {/* Η ΑΜΟΙΒΗ ΜΕΣΙΤΗ ΕΙΝΑΙ ΣΤΟΙΧΕΙΟ ΤΗΣ ΑΓΟΡΑΣ, ΟΧΙ ΠΑΡΑΡΤΗΜΑ. Κρεμόταν
              σε δική της γραμμή κάτω από το πλέγμα, δηλαδή διαβαζόταν ως κάτι
              που ήρθε μετά — ενώ είναι κόστος της ίδιας αγοράς με τον φόρο
              μεταβίβασης και τα συμβολαιογραφικά. Κελί του πλέγματος. */}
          <ToggleField label="Αμοιβή μεσίτη" on={hasAgent} onChange={setHasAgent}/>
          {hasAgent&&<NumberInput label="Ποσοστό μεσίτη" value={agentPct} onChange={setAgentPct} suffix="%"/>}
          {hasAgent&&<ReadStat label="Αμοιβή μεσίτη" value={fmtEur(AGNT)}/>}
        </div>
        {isNewBuilding&&<div style={{padding:'9px 12px',background:'var(--bg-surface)',border:'1px solid var(--border-subtle)',borderRadius:10}}><p title="ΦΠΑ: Φόρος Προστιθέμενης Αξίας · ΦΜΑ: Φόρος Μεταβίβασης Ακινήτου" style={{fontSize:12,color:'var(--text-secondary)',fontFamily: T.font.sans}}>Νεόδμητο: ο ΦΠΑ 24% ({fmtEur(vatOwed)}) είναι σε αναστολή έως {NEW_BUILD_VAT_SUSPENDED_UNTIL}, οπότε ο υπολογισμός κρατά ΦΜΑ 3,09%</p></div>}
        {isCommercial&&<div style={{padding:'9px 12px',background:'var(--bg-surface)',border:'1px solid var(--border-subtle)',borderRadius:10}}><p title="ΦΜΑ: Φόρος Μεταβίβασης Ακινήτου (3% συν 3% υπέρ δήμων επί του φόρου)" style={{fontSize:12,color:'var(--text-secondary)',fontFamily: T.font.sans}}>Επαγγελματικό: ΦΜΑ 3,09% + Ψηφιακό Τέλος Συναλλαγής 3,6% αν εκμισθωθεί</p></div>}
      </div>
    </div>
  );
}

// Δάνειο, επιτόκιο και παράμετροι — ενιαία κάρτα, ενιαίο πλέγμα πεδίων
export function LoanCard({
  loanAmount, setLoanAmount, setActivePreset, years, setYears, startDate, setStartDate, bankId, setBankId, BANK_OPTIONS,
  customBank, setCustomBank, rateType, setRateType, fixedPeriod, setFixedPeriod, rate, setRate, market, R, effRate,
  extraPay, setExtraPay, extraSav, EP,
}: {
  loanAmount: string; setLoanAmount: SetState<string>; setActivePreset: SetState<string | null>;
  years: string; setYears: SetState<string>; startDate: string; setStartDate: SetState<string>;
  bankId: string; setBankId: SetState<string>; BANK_OPTIONS: Option[]; customBank: string; setCustomBank: SetState<string>;
  rateType: RateType; setRateType: SetState<RateType>; fixedPeriod: string; setFixedPeriod: SetState<string>;
  rate: string; setRate: SetState<string>; market: MarketRates; R: number; effRate: number;
  extraPay: string; setExtraPay: SetState<string>; extraSav: { savedMonths: number; savedInt: number } | null; EP: number;
}) {
  return (
    <div style={cardStyle}>
      <SectionLabel label="Δάνειο, επιτόκιο και παράμετροι"/>
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        {/* ΟΚΤΩ ΠΕΔΙΑ ΣΕ ΤΡΙΑ, ΤΡΙΑ ΚΑΙ ΔΥΟ. Ούτε το σταθερό μέγιστο στήλης ούτε
            το `auto-fit` το λύνουν: το πρώτο κρατούσε τρεις στήλες όσο πλατιά
            κι αν ήταν η κάρτα, το δεύτερο δίνει άλλο πλήθος σε κάθε επίπεδο
            zoom του περιηγητή. Τέσσερις στήλες, γραμμένες.
            ΣΤΟΙΧΙΣΗ ΣΤΗΝ ΚΟΡΥΦΗ: η «Τράπεζα» γεννά δεύτερο πεδίο από κάτω της
            όταν διαλέξεις «Άλλη τράπεζα». Με στοίχιση στο κάτω άκρο, ολόκληρη
            η σειρά κατέβαινε για να χωρέσει εκείνο το πεδίο και τα τρία
            διπλανά κουτιά έφευγαν από τη γραμμή τους. */}
        <div {...fixedCols(4, 12, 'start')}>
          {/* ═══ Η ΣΗΜΕΙΩΣΗ ΕΦΥΓΕ: ΗΤΑΝ ΤΟ ΤΕΤΑΡΤΟ ΠΛΑΚΙΔΙΟ, ΓΡΑΜΜΕΝΟ ΔΥΟ ΦΟΡΕΣ
              Κάτω από αυτό το πεδίο καθόταν «Δάνειο προς αξία 80,00% · ίδια
              κεφάλαια 30.000,00€», σε στήλη που δεν το χωρούσε, οπότε
              τσάκιζε σε δύο σειρές και ψήλωνε μόνο του τη σειρά των τεσσάρων
              πεδίων. Και ήταν ΑΚΡΙΒΩΣ τα ίδια δύο νούμερα με το τέταρτο
              πλακίδιο λίγο πιο κάτω στην ίδια οθόνη, με τις ίδιες λέξεις.

              Ενα υπολογισμένο μέγεθος ανήκει στα αποτελέσματα, όχι κάτω από
              το πεδίο που το τροφοδοτεί. Η εξήγηση του όρου πήγε στο πλακίδιο
              που τον γράφει, στο κυκλάκι του. */}
          <NumberInput label="Ποσό δανείου" value={loanAmount} onChange={v=>{setLoanAmount(v);setActivePreset(null)}} suffix="€"/>
          <NumberInput label="Διάρκεια" value={years} onChange={v=>{setYears(v);setActivePreset(null)}} suffix="χρόνια" min={3} max={35}/>
          <DatePicker label="Ημερομηνία έναρξης" value={startDate} onChange={setStartDate}/>
          <div>
            <CustomSelect label="Τράπεζα" value={bankId} onChange={setBankId} options={BANK_OPTIONS} placeholder="Επίλεξε τράπεζα"/>
            {bankId==='custom'&&<div style={{marginTop:8}}><TextInput label="Όνομα τράπεζας" value={customBank} onChange={setCustomBank} placeholder="Παράδειγμα: Παγκρήτια Τράπεζα"/></div>}
          </div>
          <CustomSelect label="Τύπος επιτοκίου" value={rateType} onChange={v=>{setRateType(v as RateType);setActivePreset(null)}} options={RATE_TYPE_OPTIONS}/>
          {/* «Διάρκεια σταθερής περιόδου» ήταν 25 χαρακτήρες και στα 900 η
              στήλη δεν τους χωρούσε: η ετικέτα τσάκιζε σε δεύτερη γραμμή ενώ
              οι τρεις διπλανές έμεναν σε μία, οπότε το κουτί της ξεκινούσε πιο
              χαμηλά. Η «Διάρκεια» περισσεύει, γιατί το πεδίο δίπλα λέει ήδη
              «Τύπος επιτοκίου» και η τιμή του είναι σε έτη. */}
          {(rateType==='fixed'||rateType==='mixed')&&<CustomSelect label="Σταθερή περίοδος" value={fixedPeriod} onChange={setFixedPeriod} options={FIXED_PERIOD_OPTIONS}/>}
          <div title={rateType==='variable'?'Περιθώριο τράπεζας πάνω από το Euribor':undefined}>
            <NumberInput label={rateType==='variable'?'Περιθώριο τράπεζας':'Ετήσιο επιτόκιο'} value={rate} onChange={v=>{setRate(v);setActivePreset(null)}} suffix="%"/>
            {rateType==='variable'&&(
              <div style={{marginTop: 8,padding:'9px 12px',background:'var(--bg-surface)',border:'1px solid var(--border-subtle)',borderRadius:10}}>
                <p style={{fontSize:12,fontFamily: T.font.mono,fontVariantNumeric:'tabular-nums',color:'var(--text-secondary)'}}><span title="Διατραπεζικό επιτόκιο ευρώ: βάση κυμαινόμενων δανείων">Euribor</span> {fmtPct(market.euribor_3m)} + {fmtPct(R)} = <strong>{fmtPct(effRate)}</strong></p>
                {/* Η ΛΕΖΑΝΤΑ ΔΙΑΒΑΖΕΤΑΙ, ΔΕΝ ΓΡΑΦΕΤΑΙ. Εδώ έλεγε «Αυτόματη ενημέρωση
                    από την ΕΚΤ κάθε πρωί» — υπόσχεση που η ΕΚΤ δεν δίνει: το Euribor
                    το δημοσιεύει μηνιαία, όχι ημερήσια (lib/market/ecb.ts). Τώρα λέει
                    ό,τι λέει η προέλευση της ίδιας της τιμής, με την ίδια συνάρτηση
                    που τη γράφει και η σύγκριση επιτοκίων. Χωρίς προέλευση παίζει η
                    εφεδρική τιμή και το λέει. */}
                <p style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',marginTop: 4,fontFamily: T.font.sans}}>
                  {market.euribor_asOf && market.euribor_basis
                    ? `Euribor 3 μηνών, ${euriborPeriod(market.euribor_asOf, market.euribor_basis)}${market.euribor_source ? `. Πηγή: ${market.euribor_source}` : ''}${market.euribor_fetchedAt ? `, λήψη ${greekDay(market.euribor_fetchedAt.slice(0,10))}` : ''}`
                    : 'εφεδρική τιμή, χωρίς ημερομηνία παρατήρησης'}
                </p>
                {/* Ο ΜΕΣΟΣ ΟΡΟΣ ΔΕΝ ΕΙΝΑΙ Η ΤΙΜΗ ΤΗΣ ΤΡΑΠΕΖΑΣ. Η τράπεζα εφαρμόζει
                    το Euribor μιας συγκεκριμένης ημέρας, της αναπροσαρμογής. Στον
                    Σεπτέμβριο 2026 ο μέσος όρος του εξαμήνου ήταν 2,922% και το
                    fixing της 30/09 3,074%: σε άνοδο, ο μέσος όρος βγάζει δόση
                    χαμηλότερη από αυτή που θα χρεωθεί ο ιδιοκτήτης. Δεν το κρύβουμε
                    πίσω από τη λέξη «σήμερα». */}
                {market.euribor_basis === MONTH_MEAN && (
                  <p style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',marginTop: 4,fontFamily: T.font.sans,lineHeight:1.5}}>
                    Η τράπεζα εφαρμόζει το Euribor της ημέρας αναπροσαρμογής, όχι τον μέσο όρο του μήνα. Όταν το Euribor ανεβαίνει, η δόση εδώ βγαίνει χαμηλότερη από αυτή που θα χρεωθείς. Για την ακριβή δόση, δες την τιμή στο ενημερωτικό της τράπεζας.
                  </p>
                )}
              </div>
            )}
          </div>
          <div>
            <NumberInput label="Έκτακτη μηνιαία πληρωμή" value={extraPay} onChange={setExtraPay} suffix="€" placeholder=""/>
            {extraSav&&EP>0&&(
              <div style={{marginTop:6,padding:'9px 12px',background:'var(--bg-elevated)',border:'1px solid var(--border-subtle)',borderRadius:10}}>
                <p style={{fontSize:12,color:'var(--text-secondary)',fontFamily: T.font.sans,fontWeight:500}}>Εξοικονομείς {Math.round(extraSav.savedMonths/12)} χρόνια και {fmtEur(extraSav.savedInt)} τόκους</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
