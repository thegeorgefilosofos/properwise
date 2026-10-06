'use client'
// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΔΑΝΕΙΟ ΣΟΥ: Ο ΣΥΜΒΟΥΛΟΣ ΠΟΥ ΒΑΘΜΟΛΟΓΕΙ, ΣΥΓΚΡΙΝΕΙ ΚΑΙ ΠΡΟΤΕΙΝΕΙ
// ═══════════════════════════════════════════════════════════════════════════
import { fp } from '@/lib/core/format'
import { programDateLabel } from '@/lib/loans/programStatus'
import { T, Btn } from '@/components/Theme'
import { RATES_DISCLAIMER, calcMonthly, fmtEur, fmtPct, MARKET_FALLBACK, rateTypeLabel } from '../TabLoanData'
import { ENERGY_PROGRAM_IDS, joinGreek } from '@/lib/loans/energyPrograms'
import { rankLoans, spitiMouEligibility, spitiMouOpen, spitiMouClosedLine, spitiMouClosedSentence, type UserLoanNeeds } from '@/lib/loans/recommend'
import { hy } from '@/components/Hyphen'
import { euriborInsight } from '@/lib/loans/affordability'
import LoanDocScan from '../LoanDocScan'
import SpitiMouPanel from '../SpitiMouPanel'
import ApprovalPanel from '../ApprovalPanel'
import EsisScanPanel from '../EsisScanPanel'
import { InfoDot } from '../UIComponents'
import { athensToday } from '@/lib/core/time'
import { LensPanel, MiniSection, FindingRow } from './Bits'
import type { LoanProps, LoanState } from './useLoan'
import { roundHalfUp } from '@/lib/core/money';

export function LoanAdvisor({
  LA, Y, BANKS, market, calcState, setAppliedLoan, handleSaveLoan, scrollToCalc, advType, advBorr,
  setScoreHover, scoreHover, propertySqm, propertyYearBuilt, activePrograms, stateOf, setRecHover,
  recHover, applyBank, otherHover, setOtherHover, profile,
}: Pick<LoanProps & LoanState,
  'LA' | 'Y' | 'BANKS' | 'market' | 'calcState' | 'setAppliedLoan' | 'handleSaveLoan' |
  'scrollToCalc' | 'advType' | 'advBorr' | 'setScoreHover' | 'scoreHover' | 'propertySqm' |
  'propertyYearBuilt' | 'activePrograms' | 'stateOf' | 'setRecHover' | 'recHover' | 'applyBank' |
  'otherHover' | 'setOtherHover' | 'profile'
>) {
  return (
    <LensPanel title="Το δάνειό σου" subtitle={`Βάσει ${fmtEur(LA)} / ${Y} χρόνια · από τον υπολογιστή`}>
      <LoanDocScan
        banks={BANKS}
        euribor={market.euribor_3m || MARKET_FALLBACK.euribor_3m}
        defaultPropertyValue={calcState.propertyValue}
        onApply={a=>setAppliedLoan(a)}
        onSaveLoan={handleSaveLoan}
        onOpenCalculator={scrollToCalc}
      />
      {(()=>{
      const cs = calcState
      const ltv = cs.propertyValue>0?(cs.loanAmount/cs.propertyValue)*100:0
      const totalCost = cs.monthly*cs.years*12
      const interestRatio = cs.loanAmount>0?cs.totalInterest/cs.loanAmount:0
      const stressMonthly2 = calcMonthly(cs.loanAmount,cs.effectiveRate+2,cs.years)
      // «Σπίτι μου ΙΙ»: 50% άτοκο + 50% με το επιτόκιο του δανειολήπτη (δύο σκέλη).
      const spitiMonthly = calcMonthly(cs.loanAmount*0.5,0,cs.years)+calcMonthly(cs.loanAmount*0.5,cs.effectiveRate,cs.years)
      const shortMonthly20 = cs.years>20?calcMonthly(cs.loanAmount,cs.effectiveRate,20):0
      const savedByShortening = cs.years>20?(cs.monthly*cs.years*12)-(shortMonthly20*20*12):0
      const extraPay100Saving = (()=>{
        let bal=cs.loanAmount,months=0
        while(bal>0&&months<cs.years*12){bal=bal*(1+cs.effectiveRate/100/12)-(cs.monthly+100);months++}
        return Math.max(0,(cs.years*12-months)/12)
      })()
      // ── Σύσταση καλύτερου δανείου (recommender) ──────────────────────────────
      const needs: UserLoanNeeds = {
        amount: LA, propertyValue: calcState.propertyValue || 0, years: Y,
        purpose: advType, ratePreference: calcState.rateType,
      }
      const euribor = market.euribor_3m || MARKET_FALLBACK.euribor_3m
      const today = athensToday()
      const ranked = rankLoans(needs, BANKS, euribor, today)
      const spiti = spitiMouEligibility(needs, today)
      // Η μία γραμμή που λέει ότι το πρόγραμμα δεν δέχεται αιτήσεις. Κενή όσο
      // δέχεται. Από εδώ κρίνεται κάθε σήμα και κάθε κείμενο οφέλους παρακάτω.
      const spitiClosed = spitiMouClosedLine(today)
      // Το πλήρες πάνελ «Σπίτι μου ΙΙ» εμφανίζεται μόνο όταν αφορά· τότε αποφεύγουμε
      // να επαναλάβουμε την ίδια πληροφορία στη σύνοψη πιο κάτω (ενιαία πηγή).
      const spitiPanelShown = advType==='first_home'||advBorr==='young'||advBorr==='family'
      const bestRankIdx = ranked.findIndex(r=>r.eligible)
      let score=100; const issues:string[]=[]
      if(ltv>85){score-=20;issues.push('LTV')}
      if(cs.effectiveRate>4){score-=15;issues.push('Επιτόκιο')}
      if(cs.rateType==='variable'){score-=10;issues.push('Κυμαινόμενο')}
      if(cs.years>25){score-=10;issues.push('Διάρκεια')}
      if(interestRatio>0.6){score-=15;issues.push('Τόκοι')}
      const scoreLabel=score>=80?'Υγιές δάνειο':score>=60?'Αποδεκτό, υπάρχει περιθώριο βελτίωσης':'Προσοχή, αξίζει επανεξέταση'
      const insight = euriborInsight({ euribor3m: euribor, loanAmount: cs.loanAmount, ratePct: cs.effectiveRate, years: cs.years, rateType: cs.rateType })
      // Κορυφαία πρόταση + λοιπές επιλογές (για πτυσσόμενη εμφάνιση, όχι «σούπερ μάρκετ»).
      const topRec = ranked[bestRankIdx>=0?bestRankIdx:0]
      const otherRecs = ranked.filter((_,i)=>i!==(bestRankIdx>=0?bestRankIdx:0)).slice(0,4)
      // ══ ΔΥΟ ΥΠΟΛΟΓΙΣΜΟΙ ΓΙΑ ΤΟ «ΚΑΛΥΤΕΡΟ ΔΑΝΕΙΟ», ΣΤΗΝ ΙΔΙΑ ΣΥΝΑΡΤΗΣΗ ═════
      //
      // Η ανάγνωση του σεναρίου έλεγε «Καλύτερο σταθερό της αγοράς: Χ% από ΤΡΑΠΕΖΑ»
      // από δική της ταξινόμηση: `BANKS.sort(fixed_min)[0]`. Δηλαδή το φθηνότερο
      // ΔΙΑΦΗΜΙΖΟΜΕΝΟ επιτόκιο, αγνοώντας αν ο δανειολήπτης είναι επιλέξιμος,
      // αγνοώντας το «Σπίτι μου ΙΙ», αγνοώντας την πράσινη έκπτωση και
      // ταξινομώντας με το επιτόκιο αντί για το ΣΥΝΟΛΙΚΟ κόστος. Τριάντα γραμμές
      // πιο κάτω, η κάρτα «Σύσταση καλύτερου δανείου» απαντούσε το ίδιο ερώτημα
      // με τον κανονικό ταξινομητή, που τα λαμβάνει όλα υπόψη.
      //
      // Δύο απαντήσεις στην ίδια ερώτηση, στην ίδια οθόνη· και μπορούσαν να
      // ονομάζουν ΑΛΛΗ τράπεζα. Μένει ο ταξινομητής, που είναι και ο σωστός.
      const bestMonthly = topRec ? topRec.monthlyPayment : cs.monthly
      const savingVsBest = (cs.monthly-bestMonthly)*cs.years*12
      // Παράγοντες που μειώνουν τη βαθμολογία, με αναγνώσιμη περιγραφή.
      const FACTOR:Record<string,{label:string;d:number}> = {
        LTV:{label:'Υψηλό δάνειο προς αξία',d:20}, 'Επιτόκιο':{label:'Υψηλό επιτόκιο',d:15},
        'Κυμαινόμενο':{label:'Κυμαινόμενο επιτόκιο',d:10}, 'Διάρκεια':{label:'Μεγάλη διάρκεια',d:10}, 'Τόκοι':{label:'Υψηλοί συνολικοί τόκοι',d:15},
      }

      return (
        <div style={{display:'flex',flexDirection:'column',gap:12}}>

          {/* ══════════════════════════════════════════════════════════════
              Η ΣΕΙΡΑ: ΠΡΩΤΑ ΤΟ ΔΙΚΟ ΣΟΥ, ΜΕΤΑ ΤΟ ΓΕΝΙΚΟ
              ─────────────────────────────────────────────────────────────
              Το προσωπικό και το γενικό εναλλάσσονταν: στρατηγική (γενική),
              ανάλυση (δική σου), οδηγός (γενικός), τι βλέπω (δικό σου),
              επιλεξιμότητα (δική σου). Ο αναγνώστης άλλαζε ύψος πτήσης πέντε
              φορές σε μία οθόνη.

              Η σειρά τώρα ακολουθεί τις ερωτήσεις με τη σειρά που γίνονται:
              είναι καλό αυτό το δάνειο (βαθμολογία, ανάγνωση, τι να αλλάξεις),
              θα εγκριθώ, υπάρχει κάτι καλύτερο (Σπίτι μου ΙΙ, προγράμματα,
              τράπεζες) και τέλος τι πρέπει να ξέρω (οδηγός, στρατηγική).
          ══════════════════════════════════════════════════════════════ */}
          {/* ── Insight της ημέρας ── */}
          {insight&&(
            <div style={{display:'flex',alignItems:'flex-start',gap: 12,padding:'12px 16px',background:'var(--bg-elevated)',border:'1px solid var(--border-subtle)',borderLeft:'3px solid var(--border-default)',borderRadius: T.radius.popup}}>
              <svg aria-hidden="true" className="po-lead-ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 00-4 12.7c.6.5 1 1.3 1 2.1v.2h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0012 2z"/></svg>
              <p style={{fontSize: 'var(--fs-base)',color:'var(--text-primary)',lineHeight:1.55,fontFamily: T.font.sans}}>{insight}</p>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              ΤΡΙΑ ΠΑΝΕΛ ΕΛΕΓΑΝ ΤΑ ΙΔΙΑ ΝΟΥΜΕΡΑ ΜΕ ΤΡΕΙΣ ΔΙΑΤΥΠΩΣΕΙΣ
              ─────────────────────────────────────────────────────────────
              «Ανάλυση δανείου», «Τι βλέπω στο σενάριό σου» και «Τι μπορείς
              να βελτιώσεις» ήταν τρεις κάρτες, η μία κάτω από την άλλη, για
              τον ίδιο ακριβώς έλεγχο. Το ίδιο εύρημα γραφόταν τρεις φορές:

                · η μπάρα «Τι μειώνει τη βαθμολογία» έβγαζε πλακίδιο
                  «Κυμαινόμενο επιτόκιο −10»·
                · η ανάγνωση από κάτω έγραφε «Αν ανέβει δύο μονάδες, η δόση
                  γίνεται 780,12€, δηλαδή 123,60€ παραπάνω τον μήνα»·
                · και η βελτίωση, τρίτη κάρτα, έγραφε «Με το Euribor δύο
                  μονάδες ψηλότερα η δόση γίνεται 780,12€, δηλαδή 123,60€
                  παραπάνω τον μήνα».

              Δύο προτάσεις με τα ΙΔΙΑ δύο ποσά, σε απόσταση μιας κύλισης.
              Το ίδιο και για τη διάρκεια: «Σε 20 χρόνια η δόση γίνεται …
              και γλιτώνεις … τόκους» γραφόταν και στους τόκους και στις
              βελτιώσεις.

              ΤΩΡΑ ΕΙΝΑΙ ΕΝΑ ΠΑΝΕΛ ΚΑΙ ΜΙΑ ΓΡΑΜΜΗ ΑΝΑ ΕΥΡΗΜΑ: τι ισχύει,
              πόσο κοστίζει στη βαθμολογία (δεξιά) και τι κάνεις γι' αυτό
              (τελευταία πρόταση). Οποιο εύρημα δεν κοστίζει βαθμούς δεν
              έχει αριθμό δεξιά και δεν ζητά κίνηση.
          ══════════════════════════════════════════════════════════════ */}
          {(()=>{
            const c = score>=80?'var(--accent)':'var(--text-primary)'
            // Το κόστος κάθε ευρήματος στη βαθμολογία, από την ΙΔΙΑ πηγή που
            // το αφαίρεσε. Οταν δεν υπάρχει, η γραμμή είναι απλή διαπίστωση.
            const cost = (k:string)=> issues.includes(k)
              ? <span style={{fontSize:12,fontFamily: T.font.sans,fontVariantNumeric:'tabular-nums',color:'var(--text-secondary)',fontWeight:700,whiteSpace:'nowrap' as const}}>−{FACTOR[k].d}</span>
              : null
            // Η κίνηση μπαίνει στο ΤΕΛΟΣ της ίδιας γραμμής, όχι σε δική της
            // κάρτα: «τι ισχύει» και «τι κάνω» είναι μία σκέψη.
            const ltvFix = issues.includes('LTV') ? ' Με προκαταβολή που ρίχνει τον δείκτη κάτω από 80% παίρνεις χαμηλότερο επιτόκιο και ευκολότερη αποδοχή.' : ''
            // ΣΤΑΘΕΡΟ ΓΙΑ ΛΙΓΟΤΕΡΑ ΧΡΟΝΙΑ ΑΠΟ ΤΗ ΔΙΑΡΚΕΙΑ ΔΕΝ ΕΙΝΑΙ ΠΡΟΣΤΑΣΙΑ. Η
            // ανάλυση έλεγε «Euribor 2,51%, από το οποίο είσαι προστατευμένος»
            // σε δάνειο 25 ετών με σταθερή περίοδο 5 ετών, ενώ ο ίδιος ο
            // υπολογιστής από πάνω έγραφε ότι μετά τα 5 χρόνια το επιτόκιο αλλάζει.
            const fixedYears = cs.fixedPeriod ?? cs.years
            const fixedAll = cs.rateType==='variable' ? false : fixedYears >= cs.years
            const fixedNote = fixedAll
              ? `Σταθερή δόση για όλη τη διάρκεια. Euribor τριμήνου ${fmtPct(market.euribor_3m)}, από το οποίο είσαι προστατευμένος.`
              : `Σταθερό για ${fixedYears} χρόνια. Μετά ακολουθεί το Euribor (σήμερα ${fmtPct(market.euribor_3m)} τριμήνου), οπότε η δόση μπορεί να αλλάξει.`
            const rateFix = issues.includes('Επιτόκιο') ? ` Ζήτησε γραπτές προσφορές από τρεις τράπεζες: μειώσεις ${fp(0.10)} έως ${fp(0.25)} είναι συνηθισμένες.` : ''
            const varFix = issues.includes('Κυμαινόμενο') ? ' Το σταθερό επιτόκιο κλειδώνει τη δόση για όσα χρόνια ορίζει η σύμβαση.' : ''
            return (
            <MiniSection title="Ανάλυση δανείου" defaultOpen meta={<span style={{fontSize:12,color:'var(--text-secondary)',fontFamily: T.font.sans,fontWeight:600,whiteSpace:'nowrap' as const}}>{scoreLabel}</span>}>
              <div style={{display:'flex',alignItems:'center',gap:T.sp.xl,flexWrap:'wrap'}}>
                <div onMouseEnter={()=>setScoreHover(true)} onMouseLeave={()=>setScoreHover(false)}
                  onTouchStart={()=>setScoreHover(true)} onTouchEnd={()=>setScoreHover(false)}
                  style={{display:'flex',alignItems:'baseline',gap: 4,flexShrink:0,cursor:'default'}}>
                  <span style={{fontSize:28,fontWeight:700,color:scoreHover?'var(--accent)':'var(--text-primary)',fontFamily: T.font.sans,letterSpacing:'-0.04em',fontVariantNumeric:'tabular-nums',lineHeight:1,transition:'color 0.15s'}}>{score}</span>
                  <span style={{fontSize:15,color:'var(--text-tertiary)',fontFamily: T.font.sans,fontWeight:600}}>/ 100</span>
                </div>
                <div style={{flex:1,minWidth:220}}>
                  <div style={{position:'relative',height:10,borderRadius: T.radius.xs,background:'var(--bg-surface)',border:'1px solid var(--border-subtle)',overflow:'hidden'}}>
                    <div style={{width:`${score}%`,height:'100%',borderRadius: T.radius.xs,background:c,transition:'width 0.4s ease'}}/>
                    <div style={{position:'absolute',left:'60%',top:0,bottom:0,width:0,borderLeft:'1px dashed var(--text-tertiary)',opacity:0.5}}/>
                    <div style={{position:'absolute',left:'80%',top:0,bottom:0,width:0,borderLeft:'1px dashed var(--text-tertiary)',opacity:0.5}}/>
                  </div>
                  <p style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',marginTop: 8,fontFamily: T.font.sans}}>Όρια: αποδεκτό 60 · υγιές 80. Βάσει {fmtEur(cs.loanAmount)} · {cs.years} χρόνια · {fmtPct(cs.effectiveRate)} {rateTypeLabel(cs.rateType).toLowerCase()}.</p>
                </div>
              </div>

              <div style={{marginTop:16}}>
                <FindingRow
                  right={cost('LTV')}
                  // Η ΛΕΞΗ ΑΚΟΛΟΥΘΕΙ ΤΟ ΟΡΙΟ ΤΗΣ ΒΑΘΜΟΛΟΓΙΑΣ (85). Το «μέτριο» πάνω από
                  // 70 καθόταν δίπλα σε «100 / 100 · Υγιές δάνειο», χωρίς πόντο να λείπει.
                  // Και πάνω από 70 η λέξη δεν είναι μομφή: η βαθμολογία δεν
                  // αφαιρεί τίποτα ως το 85, άρα η γραμμή λέει «εντός ορίων».
                  title={`Δάνειο προς αξία ${fp(ltv)}: ${ltv>85?'υψηλό, απαιτεί προσοχή':ltv>70?'εντός ορίων':'χαμηλό'}`}
                  body={ltv>85
                    ? `Χρηματοδοτείς το ${fp(ltv)} της αξίας. Οι τράπεζες είναι επιφυλακτικές πάνω από 80%.${ltvFix}`
                    : `Ίδια κεφάλαια ${fmtEur(cs.propertyValue-cs.loanAmount)}, δηλαδή ${fp(100-ltv)} της αξίας. ${ltv>70?'Εντός αποδεκτών ορίων.':'Ενισχύει τη διαπραγματευτική σου θέση.'}`}
                />

                <FindingRow
                  right={cost('Επιτόκιο') ?? cost('Κυμαινόμενο')}
                  title={<>Επιτόκιο {fmtPct(cs.effectiveRate)}, {rateTypeLabel(cs.rateType).toLowerCase()}
                    {cs.rateType==='variable'&&<span title="Διατραπεζικό επιτόκιο ευρώ, βάση κυμαινόμενων δανείων" style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',marginLeft:8,fontWeight:400}}>εκτεθειμένο σε Euribor</span>}</>}
                  body={cs.rateType==='variable'
                    ? `Τρέχον Euribor τριμήνου ${fmtPct(market.euribor_3m)}. Αν ανέβει δύο μονάδες, η δόση γίνεται ${fmtEur(stressMonthly2)}, δηλαδή ${fmtEur(stressMonthly2-cs.monthly)} παραπάνω τον μήνα.${varFix}${rateFix}`
                    : topRec&&savingVsBest>0
                    // Η ΤΡΑΠΕΖΑ ΟΝΟΜΑΖΕΤΑΙ ΜΙΑ ΦΟΡΑ ΣΤΟΝ ΦΑΚΟ. Εδώ γραφόταν
                    // «2,40% από Eurobank, δόση 656,52€» και τρία πάνελ πιο
                    // κάτω η «Σύσταση καλύτερου δανείου» έγραφε τα ίδια τρία
                    // μεγέθη ξανά, με το κουμπί που τα εφαρμόζει. Η διάγνωση
                    // κρατά αυτό που είναι δικό της (πόσο χάνεις)· το όνομα,
                    // το επιτόκιο και η δόση ζουν εκεί που πατιούνται.
                    ? `Υπάρχει φθηνότερο επιτόκιο για το προφίλ σου: θα γλίτωνες ${fmtEur(savingVsBest)} στη διάρκεια.${rateFix}`
                    : topRec
                    ? `Καμία τράπεζα του πίνακα δεν δίνει φθηνότερο. ${fixedNote}`
                    : fixedNote}
                />

                <FindingRow last
                  right={cost('Τόκοι') ?? cost('Διάρκεια')}
                  title={`Συνολικοί τόκοι ${fmtEur(cs.totalInterest)}, ${fp(interestRatio*100)} επί του κεφαλαίου`}
                  body={<>Για {fmtEur(cs.loanAmount)} αποπληρώνεις συνολικά {fmtEur(totalCost)}.
                    {cs.years>20&&savedByShortening>0
                      ? ` Σε 20 χρόνια η δόση γίνεται ${fmtEur(shortMonthly20)}, δηλαδή ${fmtEur(shortMonthly20-cs.monthly)} παραπάνω, με ${fmtEur(savedByShortening)} λιγότερους τόκους.`
                      : ` Έκτακτη πληρωμή 100€ τον μήνα κόβει ${extraPay100Saving.toFixed(1).replace('.',',')} χρόνια από τη διάρκεια.`}</>}
                />
              </div>
              {/* ΤΟ «ΑΡΙΣΤΟ ΠΡΟΦΙΛ ΔΑΝΕΙΟΥ» ΕΦΥΓΕ. Η ίδια ετυμηγορία γραφόταν
                  τρεις φορές μέσα σε δεκαπέντε εικονοστοιχεία: το σήμα δεξιά
                  έλεγε «Υγιές δάνειο», ο αριθμός έλεγε «100 / 100» με γεμάτη
                  μπάρα και από κάτω μια πρόταση το ξανάλεγε με τρίτη
                  διατύπωση. Η απουσία επισημάνσεων ΕΙΝΑΙ το μήνυμα. */}
            </MiniSection>
            )
          })()}
          {/* ── Θα εγκριθώ; — διαδραστική εκτίμηση πιθανότητας έγκρισης ── */}
          {/* ΤΟ ΣΗΜΑ «ΝΕΟ» ΔΕΝ ΕΙΧΕ ΗΜΕΡΟΜΗΝΙΑ, ΑΡΑ ΔΕΝ ΕΛΗΓΕ ΠΟΤΕ. Δύο πάνελ
              το φορούσαν μόνιμα, χωρίς να ξέρει κανείς νέο από πότε και νέο
              για ποιον: ο χρήστης που ανοίγει σήμερα την εφαρμογή δεν έχει
              δει παλαιότερη έκδοση, οπότε το σήμα δεν του λέει τίποτα· και σε
              έξι μήνες θα λέει ψέματα. Το «καινούργιο» είναι ανακοίνωση με
              ημερομηνία λήξης· χωρίς αυτήν είναι διακόσμηση. */}
          <MiniSection title="Πιθανότητα έγκρισης" meta={<span style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',fontFamily: T.font.sans,whiteSpace:'nowrap' as const}}>Δανειοληπτικό προφίλ</span>}>
            <ApprovalPanel
              amount={LA} years={Y} ratePct={cs.effectiveRate} propertyValue={cs.propertyValue}
              incomeMonthly={calcState.incomeMonthly} borrowerType={advBorr}
              firstTimeBuyerDefault={advType==='first_home'} fmtEur={fmtEur}
            />
          </MiniSection>

          {/* ── Σπίτι μου ΙΙ, για σένα — όταν αφορά (πρώτη κατοικία ή νέος/οικογένεια) ── */}
          {spitiPanelShown && (
            // Το σήμα οφέλους μπαίνει ΜΟΝΟ όσο το πρόγραμμα δέχεται αιτήσεις:
            // «50% άτοκο» δίπλα σε κλειστό πρόγραμμα διαβάζεται ως «προλαβαίνεις».
            <MiniSection title={spitiClosed ? 'Σπίτι μου ΙΙ' : 'Σπίτι μου ΙΙ, για σένα'} badges={spitiMouOpen(today) ? <span style={{fontSize: 'var(--fs-xs)',padding:'2px 8px',borderRadius: T.radius.chip,background:'var(--accent-dim)',border:'1px solid var(--border-accent)',color:'var(--accent)',fontWeight:600,fontFamily: T.font.sans}}>50% άτοκο</span> : undefined}>
              <SpitiMouPanel
                amount={LA} propertyValue={cs.propertyValue} years={Y} bankRatePct={cs.effectiveRate}
                incomeMonthly={calcState.incomeMonthly} marital={calcState.marital} childCount={calcState.children}
                sqm={calcState.sqm ?? propertySqm} yearBuilt={propertyYearBuilt}
                banks={BANKS} euribor={euribor} fmtEur={fmtEur} fmtPct={fmtPct} onOpenCalculator={scrollToCalc}
              />
            </MiniSection>
          )}

          {/* ═══ Η ΕΠΙΛΕΞΙΜΟΤΗΤΑ ΒΓΑΙΝΕΙ ΑΠΟ ΤΗ ΜΗΧΑΝΗ, ΟΧΙ ΑΠΟ ΔΥΟ ΜΕΝΟΥ ═══
              ΤΟ ΣΦΑΛΜΑ. Η λίστα έκρινε το «Σπίτι μου ΙΙ» επιλέξιμο όταν ο
              χρήστης είχε διαλέξει «Πρώτη κατοικία» και τύπο δανειολήπτη «νέος»
              ή «οικογένεια» — και τίποτε άλλο. Τριάντα γραμμές πιο πάνω, στο
              ΙΔΙΟ σκοπευτικό πεδίο, καθόταν το `spiti` της `spitiMouEligibility`,
              που ελέγχει ηλικία, εισόδημα, αξία, εμβαδόν, έτος κατασκευής ΚΑΙ τις
              δύο προθεσμίες. Η οθόνη το αγνοούσε.

              Στις 19/08/2026 αυτό σήμαινε: «Πληροίς τα κριτήρια, δόση από …»
              για πρόγραμμα του οποίου οι αιτήσεις έκλεισαν στις 31/05/2026. Ο
              χρήστης διάβαζε ότι προλαβαίνει· δεν προλάβαινε.

              ΚΑΙ ΟΙ ΠΡΟΘΕΣΜΙΕΣ ΗΤΑΝ ΓΡΑΜΜΕΝΕΣ ΜΕ ΤΟ ΧΕΡΙ μέσα στις ετικέτες
              («προθεσμία 31/08/2026», δύο φορές), ενώ ζουν στα δεδομένα του
              προγράμματος. Το lib/loans/programStatus.ts γράφτηκε ακριβώς για να
              μην ξανασυμβεί αυτό και εδώ είχε ξανασυμβεί.

              ΤΩΡΑ: η κατάσταση κάθε προγράμματος έρχεται από την ημερομηνία, το
              «Σπίτι μου ΙΙ» ρωτά τη μηχανή και όσα ισχύουν ανεβαίνουν πάνω. ═══ */}
{(()=>{
            // ══ Ο ΚΑΤΑΛΟΓΟΣ ΤΩΝ ΠΡΟΓΡΑΜΜΑΤΩΝ ΗΤΑΝ ΓΡΑΜΜΕΝΟΣ ΔΕΥΤΕΡΗ ΦΟΡΑ ΕΔΩ ══
            //
            // Ο φακός «Προγράμματα» δείχνει τον κανονικό κατάλογο, με πηγή,
            // προθεσμίες και κριτήρια. Αυτή η κάρτα έγραφε τη ΔΙΚΗ της λίστα με
            // πέντε χειρόγραφες γραμμές· και οι δύο λίστες δεν συμφωνούσαν:
            //
            //   · Τρία υπαρκτά προγράμματα έλειπαν εντελώς από εδώ (Εξοικονομώ
            //     2025, Εξοικονομώ 2026, Ανακαινίζω και Νοικιάζω), δηλαδή η κάρτα
            //     που υπόσχεται «ποια σε αφορούν» δεν τα εξέταζε καν.
            //   · Δύο γραμμές δεν ήταν κρατικά προγράμματα: το «Πράσινο δάνειο»
            //     είναι έκπτωση περιθωρίου της τράπεζας, που ο ταξινομητής την
            //     εφαρμόζει ήδη· και το «ΑΟΟΑ» δεν έχει ούτε προθεσμία ούτε
            //     κριτήρια ούτε σύνδεσμο, δηλαδή τίποτα να επαληθευτεί.
            //   · Η «Γέφυρα 3» εμφανιζόταν κάτω από τίτλο «κρατικών
            //     προγραμμάτων» ενώ η ίδια της η περιγραφή λέει ότι είναι
            //     πρωτοβουλία των τραπεζών.
            //   · Η προθεσμία που έδειχνε ήταν πάντα η ημερομηνία ΥΠΟΓΡΑΦΗΣ. Ο
            //     φακός το κάνει σωστά: όσο δέχεται αιτήσεις, δείχνει την
            //     προθεσμία ΑΙΤΗΣΗΣ. Στις 31/08/2026 η κάρτα έγραφε «Σπίτι μου ΙΙ,
            //     προθεσμία 31/08/2026» ενώ οι αιτήσεις είχαν κλείσει στις 31/05.
            //
            // Τώρα η λίστα βγαίνει από τον ΙΔΙΟ κατάλογο. Το «αν με αφορά» το
            // κρίνει, ανά πρόγραμμα, ό,τι λέει το ίδιο το πρόγραμμα για τον εαυτό
            // του: η μηχανή του «Σπίτι μου ΙΙ», ο σκοπός του δανείου για τα
            // ενεργειακά και την ανακαίνιση, ο τύπος επιτοκίου για τη Γέφυρα.
            const rows = activePrograms.map(prog=>{
              const st = stateOf(prog)
              const open = st.acceptsApplications
              // Η ημερομηνία που μετράει για τον χρήστη, όπως και στον φακό.
              const when = programDateLabel(open ? (prog.applicationDeadline || prog.deadline) : prog.deadline)
              const shut = open ? null : (st.note || 'Οι αιτήσεις έκλεισαν')
              if (prog.id==='spiti_mou_2') return {
                id: prog.id, l: prog.name, when, url: prog.url,
                el: open && spiti.eligible && advType==='first_home',
                reason: shut ?? (advType!=='first_home' ? 'Αφορά πρώτη και κύρια κατοικία'
                  : spiti.eligible ? `Πληροίς τα κριτήρια. Δόση από ${fmtEur(spitiMonthly)} τον μήνα`
                  : (spiti.reasons.find(r=>/έκλεισ|κλείσ|εκτός|Απαιτείται|>|</.test(r)) || 'Δεν πληρούνται τα κριτήρια')),
                badge: open && spiti.eligible && advType==='first_home' ? `−${fmtEur(cs.monthly-spitiMonthly)} τον μήνα` : null,
              }
              if (prog.id==='anavathmizo') return {
                id: prog.id, l: prog.name, when, url: prog.url,
                el: open && advType==='energy',
                reason: shut ?? (advType==='energy'
                  ? `Κατάλληλο. Δάνειο έως ${fmtEur(prog.maxAmount ?? 25000)} χωρίς τόκο για τον δανειολήπτη`
                  : 'Επίλεξε «Ενεργειακή αναβάθμιση» στον υπολογιστή'),
                badge: open && advType==='energy' ? 'Χωρίς τόκο' : null,
              }
              if (prog.id.startsWith('exoikonomo')) return {
                id: prog.id, l: prog.name, when, url: prog.url,
                el: open && advType==='energy',
                reason: shut ?? (advType==='energy' ? 'Επιδότηση ενεργειακής αναβάθμισης, δες τα κριτήρια'
                  : 'Επίλεξε «Ενεργειακή αναβάθμιση» στον υπολογιστή'),
                badge: null,
              }
              if (prog.id==='anakainizo_noikazo') return {
                id: prog.id, l: prog.name, when, url: prog.url,
                el: open && advType==='renovation',
                reason: shut ?? (advType==='renovation'
                  ? 'Επιδότηση ανακαίνισης και εγγυημένο ενοίκιο από τον ΟΠΕΚΑ'
                  : 'Επίλεξε «Ανακαίνιση» στον υπολογιστή'),
                badge: null,
              }
              if (prog.id==='gefyra_3') return {
                id: prog.id, l: prog.name, when, url: prog.url,
                el: open && cs.rateType==='variable',
                reason: shut ?? (cs.rateType==='variable'
                  ? 'Πρωτοβουλία των τραπεζών, όχι κρατική επιδότηση. Απαιτείται βεβαίωση ευάλωτου οφειλέτη'
                  : 'Αφορά μόνο κυμαινόμενα επιτόκια'),
                badge: null,
              }
              // Πρόγραμμα που ο κατάλογος γνωρίζει αλλά δεν έχει κανόνα εδώ: δεν
              // λέμε «όχι», λέμε ότι δεν το κρίναμε.
              return { id: prog.id, l: prog.name, when, url: prog.url, el: false,
                reason: shut ?? 'Δες τα κριτήρια του προγράμματος', badge: null }
            })
            // Οσα ισχύουν, πρώτα. Μια λίστα που ξεκινά με «όχι» διαβάζεται ως
            // άρνηση· η ίδια λίστα ταξινομημένη διαβάζεται ως ευκαιρία.
            const sorted = [...rows].sort((a,b)=>Number(b.el)-Number(a.el))
            const yes = sorted.filter(r=>r.el).length
            return (
            <MiniSection title="Επιλεξιμότητα προγραμμάτων"
              meta={<span style={{fontSize:12,color:'var(--text-secondary)',fontFamily: T.font.sans,fontWeight:600,whiteSpace:'nowrap' as const}}>{yes>0?`${yes} από ${sorted.length} σε ισχύ για σένα`:'κανένα αυτή τη στιγμή'}</span>}>
              <div>
                {sorted.map((item,i)=>(
                  <FindingRow key={item.id} last={i===sorted.length-1}
                    lead={<span className="po-lead-ico" style={{width:20,height:20,borderRadius:'50%',background:item.el?'var(--accent-dim)':'var(--bg-elevated)',border:item.el?'none':'1px solid var(--border-subtle)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                      {item.el
                        ?<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                        :<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2.5" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
                    </span>}
                    title={<span style={{color:item.el?'var(--text-primary)':'var(--text-secondary)',fontWeight:item.el?500:400}}>
                      {item.l}{item.when?<span style={{color:'var(--text-tertiary)',fontWeight:400}}>, {item.when}</span>:null}
                    </span>}
                    body={<span style={{color:'var(--text-tertiary)'}}>{item.reason}</span>}
                    right={item.badge?<span style={{fontSize: 'var(--fs-xs)',fontFamily: T.font.sans,fontVariantNumeric:'tabular-nums',color:'var(--accent)',background:'var(--accent-dim)',padding:'2px 8px',borderRadius: T.radius.chip,whiteSpace:'nowrap' as const}}>{item.badge}</span>:null}
                  />
                ))}
              </div>
            </MiniSection>
            )
          })()}

          {/* ── Σύσταση καλύτερου δανείου — premium, πτυσσόμενη ── */}
          {/* Η ΚΛΕΙΣΤΗ ΓΡΑΜΜΗ ΕΔΙΝΕ ΤΑ ΔΕΔΟΜΕΝΑ, ΟΧΙ ΤΗΝ ΑΠΑΝΤΗΣΗ. Το `meta`
              έγραφε «120.000€ / 25 έτη», δηλαδή ό,τι έβαλε ο ίδιος ο χρήστης
              στον Υπολογιστή δύο οθόνες πιο πάνω. Ο κανόνας του αρχείου είναι
              ότι η κλειστή ενότητα λέει ΤΙ ΥΠΑΡΧΕΙ χωρίς να την ανοίξεις: εδώ
              αυτό είναι το όνομα της τράπεζας και το επιτόκιό της. */}
          <MiniSection title="Τράπεζες για το σενάριό σου" meta={<span style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',fontFamily: T.font.sans,fontVariantNumeric:'tabular-nums',whiteSpace:'nowrap' as const}}>{topRec ? `${topRec.bankName} · ${fmtPct(topRec.effectiveRatePct)}` : `${fmtEur(LA)} / ${Y} χρόνια`}</span>}>
            {topRec && (
              <div onMouseEnter={()=>setRecHover(true)} onMouseLeave={()=>setRecHover(false)}
                onTouchStart={()=>setRecHover(true)} onTouchEnd={()=>setRecHover(false)}
                style={{position:'relative',overflow:'hidden',borderRadius: T.radius.card,padding:'13px 16px',marginBottom:10,
                background:'var(--bg-surface)',
                border:`1px solid ${recHover?'var(--border-default)':'var(--border-subtle)'}`,
                boxShadow:recHover?'0 2px 4px color-mix(in srgb, var(--text-primary) 9%, transparent), 0 10px 22px -14px color-mix(in srgb, var(--text-primary) 22%, transparent)':'0 1px 2px color-mix(in srgb, var(--text-primary) 6%, transparent)',transition:'border-color 0.15s, box-shadow 0.15s'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:14,flexWrap:'wrap'}}>
                  <div style={{minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom: 4}}>
                      <span style={{fontSize: 'var(--fs-xs)',padding:'2px 8px',borderRadius: T.radius.chip,background:'var(--bg-elevated)',border:'1px solid var(--border-subtle)',color:'var(--text-secondary)',fontWeight:600,fontFamily: T.font.sans,letterSpacing:'0.02em'}}>Καλύτερη επιλογή</span>
                      {topRec.spitiMouApplied&&<span style={{fontSize: 'var(--fs-xs)',padding:'2px 8px',borderRadius: T.radius.chip,background:'var(--bg-elevated)',border:'1px solid var(--border-subtle)',color:'var(--text-secondary)',fontWeight:500,fontFamily: T.font.sans}}>Σπίτι μου ΙΙ</span>}
                    </div>
                    {/* Η ΕΝΕΡΓΕΙΑ ΔΙΠΛΑ ΣΤΟ ΟΝΟΜΑ ΤΗΣ ΤΡΑΠΕΖΑΣ. Από κάτω, μετά την
                        αιτιολόγηση, το κουμπί άνοιγε τρίτη σειρά και η κάρτα
                        ψήλωνε χωρίς λόγο· δίπλα στο όνομα διαβάζεται ως «αυτή,
                        βάλ' τη στον υπολογιστή». Σε στενή οθόνη τυλίγει από κάτω. */}
                    <div style={{display:'flex',alignItems:'center',gap:'6px 12px',flexWrap:'wrap'}}>
                      <p style={{fontSize:16,fontWeight:700,color:'var(--text-primary)',fontFamily: T.font.sans,letterSpacing:'-0.02em',lineHeight:1.1}}>{topRec.bankName}</p>
                      {topRec.eligible&&(
                        <Btn variant="secondary" className="po-btn-keep" onClick={()=>applyBank(topRec.nominalRatePct, topRec.rateType, topRec.bankName)}>
                          <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                          Εφαρμογή στον υπολογιστή
                        </Btn>
                      )}
                    </div>
                    <p className="po-just" style={{fontSize:12,color:'var(--text-secondary)',marginTop: 6,lineHeight:1.5,fontFamily: T.font.sans}}>{topRec.eligible?topRec.why:topRec.blockers.join(' · ')}</p>
                  </div>
                  <div style={{textAlign:'right' as const,flexShrink:0}}>
                    <p style={{fontSize:22,fontWeight:700,color:recHover?'var(--accent)':'var(--text-primary)',fontFamily: T.font.sans,fontVariantNumeric:'tabular-nums',lineHeight:1,letterSpacing:'-0.03em',transition:'color 0.15s'}}>{fmtPct(topRec.effectiveRatePct)}</p>
                    <p style={{fontSize: 'var(--fs-base)',color:'var(--text-primary)',marginTop: 4,fontFamily: T.font.sans,fontVariantNumeric:'tabular-nums',fontWeight:600}}>{fmtEur(topRec.monthlyPayment)} τον μήνα</p>
                    <p style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',marginTop:2,fontFamily: T.font.sans,fontVariantNumeric:'tabular-nums'}}>Σύνολο {fmtEur(topRec.totalCost)}</p>
                  </div>
                </div>
              </div>
            )}
            {/* Σύνοψη «Σπίτι μου ΙΙ» — μόνο όταν ΔΕΝ δείχνεται το πλήρες πάνελ πιο πάνω
                (αποφυγή διπλής εμφάνισης της ίδιας πληροφορίας στη ροή πρώτης κατοικίας). */}
            {!spitiPanelShown && (
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',marginBottom:otherRecs.length?12:0,background:'var(--bg-surface)',border:'1px solid var(--border-subtle)',borderRadius:10}}>
              <div style={{minWidth:0}}>
                {spitiClosed ? (<>
                <p style={{fontSize: 'var(--fs-base)',fontWeight:600,fontFamily: T.font.sans,color:'var(--text-primary)'}}>Σπίτι μου ΙΙ</p>
                <p className="po-prose po-just" style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',marginTop:2,fontFamily: T.font.sans}}>{hy(<>{spitiClosed}</>)}</p>
                </>) : (<>
                <p style={{fontSize: 'var(--fs-base)',fontWeight:600,fontFamily: T.font.sans,color:'var(--text-primary)'}}>Σπίτι μου ΙΙ: {spiti.eligible?'πιθανώς επιλέξιμο':'μη επιλέξιμο'} {spitiMouOpen(today)&&<span style={{color:'var(--text-secondary)',fontWeight:400}}>· {Math.round(spiti.interestFreeShare*100)}% άτοκο</span>}</p>
                <p className="po-prose po-just" style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',marginTop:2,fontFamily: T.font.sans}}>{hy(<>{spiti.reasons.slice(0,3).join(' · ')}. Ενδεικτικό, επιβεβαίωσε στην πύλη.</>)}</p>
                </>)}
              </div>
            </div>
            )}
            {otherRecs.length>0 && (
              <MiniSection flat title={`Άλλες επιλογές (${otherRecs.length})`}>
                <div style={{display:'flex',flexDirection:'column',gap: 8}}>
                  {otherRecs.map(r=>{
                    const on=otherHover===r.bankId
                    return (
                    <div key={r.bankId}
                      onMouseEnter={()=>setOtherHover(r.bankId)} onMouseLeave={()=>setOtherHover(null)}
                      onTouchStart={()=>setOtherHover(r.bankId)} onTouchEnd={()=>setOtherHover(null)}
                      onClick={r.eligible?()=>applyBank(r.nominalRatePct, r.rateType, r.bankName):undefined}
                      role={r.eligible?'button':undefined} title={r.eligible?'Εφαρμογή επιτοκίου στον υπολογιστή':undefined}
                      /* Η ΣΕΙΡΑ ΤΥΛΙΓΕΤΑΙ, ΤΟ ΟΝΟΜΑ ΔΕΝ ΚΟΒΕΤΑΙ. Ονομα τράπεζας, σήμα
                         προγράμματος, δόση και επιτόκιο δεν χωρούν σε μία γραμμή σε
                         τηλέφωνο: μετρημένο, «Τράπεζα Πειραιώς» έχανε 16 εικονοστοιχεία
                         στα 375 και 67 στα 320, δηλαδή διαβαζόταν «Τράπεζα Πειρ…». Το
                         όνομα το γράφει ο κατάλογός μας και είναι δύο λέξεις· τα
                         αποσιωπητικά ανήκουν σε δεδομένα του χρήστη, όχι εδώ. Με
                         `flex-wrap` τα νούμερα κατεβαίνουν σε δεύτερη γραμμή, δεξιά
                         στοιχισμένα από το `margin-left: auto` που έχουν ήδη. */
                      style={{display:'flex',alignItems:'center',flexWrap:'wrap',gap: 8,padding:'10px 13px',background:'var(--bg-surface)',border:`1px solid ${on?'var(--border-default)':'var(--border-subtle)'}`,borderRadius:10,opacity:r.eligible?1:0.6,transition:'border-color 0.15s',cursor:r.eligible?'pointer':'default'}}>
                      <span style={{fontSize: 'var(--fs-base)',fontWeight:600,fontFamily: T.font.sans,color:'var(--text-primary)',minWidth:0}}>{r.bankName||'Τράπεζα'}</span>
                      {r.spitiMouApplied&&<span style={{flexShrink:0,fontSize: 'var(--fs-xs)',padding:'2px 7px',borderRadius: T.radius.chip,background:'var(--bg-elevated)',border:'1px solid var(--border-subtle)',color:'var(--text-secondary)',fontWeight:500,fontFamily: T.font.sans}}>Σπίτι μου ΙΙ</span>}
                      <div style={{marginLeft:'auto',flexShrink:0,display:'flex',alignItems:'baseline',gap:12}}>
                        <span style={{fontSize:12,color:'var(--text-tertiary)',fontFamily: T.font.sans,fontVariantNumeric:'tabular-nums',whiteSpace:'nowrap' as const}}>{fmtEur(r.monthlyPayment)}/μήνα</span>
                        <span style={{fontSize:14,fontFamily: T.font.sans,fontVariantNumeric:'tabular-nums',color:on?'var(--accent)':'var(--text-primary)',fontWeight:700,lineHeight:1,transition:'color 0.15s',minWidth:52,textAlign:'right' as const}}>{fmtPct(r.effectiveRatePct)}</span>
                        {!r.eligible && <InfoDot text={r.blockers.join(' · ')}/>}
                      </div>
                    </div>
                    )
                  })}
                </div>
              </MiniSection>
            )}
            <p style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',marginTop:12,lineHeight:1.6,fontFamily: T.font.sans}}>{RATES_DISCLAIMER}</p>
          </MiniSection>

          {/* ── Ανάλυση προσφοράς ESIS — τεχνικό εργαλείο, μόνο σε λειτουργία επαγγελματία ── */}
          {profile==='business' && (
          <MiniSection title="Ανάλυση προσφοράς ESIS" meta={<span style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',fontFamily: T.font.sans,whiteSpace:'nowrap' as const}}>Πραγματικό κόστος, ΣΕΠΠΕ</span>}>
            <EsisScanPanel
              defaultAmount={LA} defaultYears={Y}
              benchmarkAprc={topRec?roundHalfUp((topRec.effectiveRatePct+0.3), 2):undefined}
              fmtEur={fmtEur}
            />
          </MiniSection>
          )}


          {/* ── Στρατηγική ανά προφίλ: φυσικό vs νομικό πρόσωπο ── */}
          {(()=>{
            const isLegal = profile==='business'
            const isCompany = advBorr==='company'
            const kindLabel = !isLegal ? 'Ιδιώτης' : isCompany ? 'Νομικό πρόσωπο' : 'Επαγγελματίας'
            // Ασπίδα φόρου: οι τόκοι επιχειρηματικού δανείου εκπίπτουν. Για νομικό
            // πρόσωπο ο συντελεστής είναι 22% (σταθερός) — δίνουμε πραγματικό νούμερο.
            const taxShieldCompany = Math.round(cs.totalInterest * 0.22)
            const intro = isLegal
              ? (isCompany
                  ? 'Ως νομικό πρόσωπο το δάνειο αξιολογείται με βάση τους ισολογισμούς και την ταμειακή ροή, όχι το προσωπικό εισόδημα. Η βασική διαφορά είναι φορολογική: οι τόκοι εκπίπτουν.'
                  : 'Ως επαγγελματίας κρίνεσαι με τον μέσο όρο των φορολογικών δηλώσεων της τελευταίας διετίας. Οι τόκοι δανείου επαγγελματικού σκοπού εκπίπτουν από τα ακαθάριστα έσοδα.')
              : 'Ως φυσικό πρόσωπο η έγκριση βασίζεται στο εισόδημα και στον Τειρεσία. Στόχος: χαμηλότερο κόστος, σταθερότητα δόσης και αξιοποίηση κρατικών προγραμμάτων για πρώτη κατοικία και αναβάθμιση.'
            const rows = isLegal ? [
              {t:'Φορολογική ασπίδα των τόκων', b: isCompany
                ? `Οι τόκοι εκπίπτουν πλήρως. Με συντελεστή 22% το έμμεσο όφελος στη διάρκεια εκτιμάται περίπου ${fmtEur(taxShieldCompany)}, δηλαδή το πραγματικό κόστος δανεισμού είναι χαμηλότερο από το ονομαστικό επιτόκιο.`
                : 'Οι τόκοι δανείου επαγγελματικού σκοπού εκπίπτουν από τα ακαθάριστα έσοδα. Το όφελος εξαρτάται από τον οριακό σου συντελεστή· επιβεβαίωσέ το με τον λογιστή σου.'},
              {t:'Απόσβεση κτιρίου', b:'Το κτιριακό μέρος (όχι το οικόπεδο) αποσβένεται και μειώνει το φορολογητέο αποτέλεσμα κάθε χρόνο. Συνδυασμένο με τους τόκους, βελτιώνει ουσιαστικά την καθαρή απόδοση.'},
              {t:'Χρηματοδότηση και εξασφαλίσεις', b:'Τυπικό δάνειο προς αξία 60–70%. Ζητούνται ισολογισμοί τριετίας, απόφαση διοίκησης και συνήθως προσωπική εγγύηση. Προετοίμασε ενημερότητες ΑΑΔΕ και ΕΦΚΑ έγκαιρα.'},
              {t:'Ανάπτυξη χαρτοφυλακίου με μόχλευση', b:'Η μόχλευση επιταχύνει την ανάπτυξη μόνο όταν η καθαρή απόδοση του ακινήτου υπερβαίνει το κόστος δανεισμού. Κράτα απόθεμα ρευστότητας για κενές περιόδους και συντήρηση.'},
            ] : [
              // Το «ΑΟΟΑ» καθόταν στη λίστα «Επιλεξιμότητα κρατικών προγραμμάτων»
              // χωρίς προθεσμία, χωρίς κριτήρια και χωρίς σύνδεσμο: τίποτα να
              // επαληθευτεί, δίπλα σε προγράμματα με πηγή. Είναι υπόδειξη προς
              // φορέα, όχι πρόγραμμα με όρους· και ζει εκεί που δίνονται οι
              // υποδείξεις ανά προφίλ.
              ...(advBorr==='military' ? [{t:'Ταμεία των Ενόπλων Δυνάμεων', b:'Ο ΑΟΟΑ και το Ταμείο Παρακαταθηκών δίνουν στεγαστικά με δικούς τους όρους, συχνά ευνοϊκότερους από την αγορά. Ζήτησέ τους γραπτή προσφορά και σύγκρινέ την με τις τράπεζες του πίνακα.'}] : []),
              // Η ΣΥΜΒΟΥΛΗ ΕΛΕΓΕ «ΜΕΙΩΝΕΙ ΔΡΑΣΤΙΚΑ ΤΟ ΚΟΣΤΟΣ» ΤΕΣΣΕΡΙΣ ΜΗΝΕΣ ΜΕΤΑ
              // ΤΟ ΚΛΕΙΣΙΜΟ. Γραμμένη με το χέρι, δεν ήξερε ποια μέρα είναι.
              {t:'Αξιοποίηση κρατικών προγραμμάτων', b: spitiMouOpen(today)
                ? 'Για πρώτη κατοικία, το «Σπίτι μου ΙΙ» μειώνει δραστικά το κόστος (50% άτοκο). Έλεγξε την επιλεξιμότητα πριν επιλέξεις τράπεζα· δεν επιτρέπονται ταυτόχρονες αιτήσεις.'
                : `${spitiMouClosedSentence(today)} Για πρώτη κατοικία σύγκρινε τις τράπεζες με βάση το συνολικό κόστος και δες στα «Κρατικά προγράμματα» ποια δέχονται αιτήσεις σήμερα.`},
              {t:'Πειθαρχία στον δείκτη δόσης', b:'Όρια της Τράπεζας της Ελλάδος από 01/01/2025 (ΠΕΕ 227/1/2024): δόση έως 50% του εισοδήματος για όσους δανείζονται για πρώτη φορά, 40% για τους υπόλοιπους. Το κριτήριο είναι ο πρωτοαγοραστής, όχι η πρώτη κατοικία: όποιος έχει ήδη ακίνητο ή προηγούμενο στεγαστικό μετρά στο 40%.'},
              // Το ίδιο με το «Σπίτι μου ΙΙ» πιο πάνω: η συμβουλή πρότεινε
              // «Εξοικονομώ» και «Αναβαθμίζω» ενώ ο φακός των προγραμμάτων τα
              // έδειχνε κλειστά. Ονομάζει μόνο όσα δέχονται αίτηση σήμερα.
              {t:'Αύξηση αξίας με ενεργειακή αναβάθμιση', b:(()=>{
                const open = activePrograms.filter(p=>ENERGY_PROGRAM_IDS.includes(p.id) && stateOf(p).acceptsApplications).map(p=>`«${p.name}»`)
                if(!open.length) return 'Η ενεργειακή αναβάθμιση ανεβάζει την κλάση, την αξία και το ενοίκιο. Κανένα κρατικό πρόγραμμα δεν δέχεται αιτήσεις σήμερα· ρώτα την τράπεζα για πράσινο στεγαστικό με μειωμένο περιθώριο και δες στα «Κρατικά προγράμματα» τι έρχεται.'
                return `Προγράμματα όπως ${joinGreek(open)} ανεβάζουν την ενεργειακή κλάση, την αξία και το ενοίκιο, με επιδοτούμενο επιτόκιο ή επιχορήγηση.`
              })()},
              // ══ Η ΓΡΑΜΜΗ ΕΛΕΓΕ ΣΕ ΣΤΑΘΕΡΟ ΔΑΝΕΙΟ ΟΤΙ Η ΔΟΣΗ ΤΟΥ ΘΑ ΑΝΕΒΕΙ ══
              //
              // Το κείμενο ήταν ένα και το ίδιο για τους δύο τύπους επιτοκίου:
              // «Το σταθερό επιτόκιο προστατεύει από αυξήσεις. Στο τρέχον
              // σενάριο, αύξηση Euribor +2% θα ανέβαζε τη δόση κατά 123,60€
              // τον μήνα.» Οι δύο προτάσεις αναιρούν η μία την άλλη: αν το
              // δάνειο είναι σταθερό, η δόση ΔΕΝ ανεβαίνει με το Euribor. Ο
              // κάτοχος σταθερού διάβαζε ότι κινδυνεύει ενώ δεν κινδυνεύει.
              //
              // Και ήταν η ΤΡΙΤΗ γραφή του ίδιου ποσού στην ίδια οθόνη, μετά
              // την ανάγνωση του σεναρίου και τις βελτιώσεις. Πλέον το ποσό
              // γράφεται μία φορά, στην Ανάλυση· και εδώ μόνο όταν δεν το
              // έχει ήδη πει: δηλαδή στα σταθερά, ως υποθετικό.
              {t:'Σταθερότητα δόσης', b: cs.rateType==='variable'
                ? 'Η δόση σου ακολουθεί το Euribor: κάθε αναπροσαρμογή την αλλάζει. Το σταθερό επιτόκιο κλειδώνει το ποσό για όλη τη διάρκεια και το κόστος της προστασίας είναι η διαφορά των δύο επιτοκίων σήμερα.'
                : `Η δόση σου είναι κλειδωμένη: αύξηση του Euribor δεν την αγγίζει. Αν είχες κυμαινόμενο, δύο μονάδες πάνω θα την ανέβαζαν κατά ${fmtEur(calcMonthly(cs.loanAmount,cs.effectiveRate+2,cs.years)-cs.monthly)} τον μήνα.`},
            ]
            return (
              <MiniSection title="Στρατηγική ανά προφίλ" meta={<span style={{fontSize: 'var(--fs-xs)',padding:'2px 10px',borderRadius: T.radius.chip,background:'var(--bg-surface)',border:'1px solid var(--border-subtle)',color:'var(--text-secondary)',fontWeight:600,fontFamily: T.font.sans}}>{kindLabel}</span>}>
                <p style={{fontSize: 'var(--fs-base)',color:'var(--text-secondary)',lineHeight:1.65,fontFamily: T.font.sans,marginBottom:14}}>{intro}</p>
                <div>
                  {rows.map((r,i)=>(<FindingRow key={r.t} title={r.t} body={r.b} last={i===rows.length-1}/>))}
                </div>
                <p style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',marginTop:12,lineHeight:1.6,fontFamily: T.font.sans}}>Ρύθμισε τον τύπο δανειολήπτη στον υπολογιστή για να προσαρμοστεί η στρατηγική. Ενημερωτικές πληροφορίες, όχι φορολογική ή νομική συμβουλή.</p>
              </MiniSection>
            )
          })()}

        </div>
      )
    })()}
    </LensPanel>
  )
}
