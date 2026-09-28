'use client'
// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΑΠΟΘΗΚΕΥΜΕΝΑ ΔΑΝΕΙΑ: ΛΙΣΤΑ, ΚΑΤΑΝΟΜΗ, ΕΞΑΓΩΓΗ
// ═══════════════════════════════════════════════════════════════════════════
import { fp, fe } from '@/lib/core/format'
import { fdLong } from '@/components/tokens'
import { loanProgress } from '@/lib/loans/progress'
import { T, ExportButton, fixedCols, Bar, Tile, widestOf, IconBtn } from '@/components/Theme'
import { LOAN_TYPES, calcMonthly, fmtEur, fmtPct, LoanType, rateTypeLabel } from '../TabLoanData'
import { labelStyle } from '../LoanShared'
import { athensToday } from '@/lib/core/time'
import { cents } from '@/lib/core/money'
import { shareTone } from './model'
import type { LoanProps, LoanState } from './useLoan'

export function SavedLoans({ savedLoans, exportSavedLoans, deleteLoan }: Pick<LoanProps & LoanState, 'savedLoans' | 'exportSavedLoans' | 'deleteLoan'>) {
  return (
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
        {/* «1 δάνεια». Ο σωστός πληθυντικός γραφόταν ήδη στην εξαγωγή Excel
            δέκα γραμμές πιο πάνω· εδώ και στη σύνοψη είχε ξεχαστεί. */}
        <span style={{fontSize:12,color:'var(--text-tertiary)',fontFamily: T.font.sans}}>{savedLoans.length} {savedLoans.length===1?'δάνειο':'δάνεια'}</span>
        <ExportButton disabled={savedLoans.length===0} onClick={exportSavedLoans}/>
      </div>

      {/* ═══ Η ΣΥΝΟΨΗ ΕΛΕΓΕ «ΥΠΟΛΟΙΠΟ» ΚΑΙ ΕΔΕΙΧΝΕ ΤΟ ΑΡΧΙΚΟ ΠΟΣΟ ══════════
          ΤΟ ΣΦΑΛΜΑ. Το πλακίδιο «Συνολικό υπόλοιπο» άθροιζε το `l.amount`,
          δηλαδή το ποσό της πρώτης μέρας. Διακόσια εικονοστοιχεία πιο κάτω η
          κάρτα του ίδιου δανείου έγραφε «Υπόλοιπο σήμερα» με το ΠΡΑΓΜΑΤΙΚΟ
          υπόλοιπο, από τη `loanProgress`. Μετρημένο στο δάνειο του πάγκου:
          120.000,00€ η σύνοψη, 107.143,80€ η κάρτα. Δώδεκα χιλιάδες
          οκτακόσια πενήντα έξι ευρώ διαφορά, για το ίδιο χρέος, στην ίδια
          οθόνη — και η σύνοψη ήταν αυτή που έλεγε ψέματα.

          Η ίδια ρίζα και στο επιτόκιο: το «μέσο σταθμισμένο» σταθμιζόταν με
          το αρχικό ποσό. Οταν δύο δάνεια έχουν προχωρήσει διαφορετικά, ο
          μέσος όρος που πληρώνεις σήμερα βγαίνει από το ΤΡΕΧΟΝ υπόλοιπο.

          ΚΑΙ ΜΕ ΕΝΑ ΔΑΝΕΙΟ Η ΣΥΝΟΨΗ ΕΙΝΑΙ Η ΚΑΡΤΑ. Τέσσερα πλακίδια με τα
          νούμερα που ξαναγράφονται αυτούσια αμέσως από κάτω. Το ίδιο το
          μπλοκ το ήξερε ήδη: η κατανομή δόσης ανά δάνειο εμφανιζόταν μόνο
          από δύο και πάνω. Τώρα το ξέρει ολόκληρο. ═══════════════════ */}
      {savedLoans.length>1&&(()=>{
        const rows = savedLoans.map(l=>{
          const prog = loanProgress({ amount:l.amount, annualRatePct:l.rate, years:l.years,
            startDate: l.start_date || null, today: athensToday() })
          const m = prog ? prog.monthly : calcMonthly(l.amount,l.rate,l.years)
          // Χωρίς ημερομηνία έναρξης το δάνειο δεν έχει αρχίσει να πληρώνεται:
          // υπόλοιπο το αρχικό ποσό, τόκοι όλοι όσοι θα τρέξουν.
          //
          // ΣΤΡΟΓΓΥΛΑ ΣΕ ΛΕΠΤΑ ΠΡΙΝ ΑΠΟ ΤΟ ΑΘΡΟΙΣΜΑ. Οι κάρτες από κάτω γράφουν
          // κάθε ποσό σε λεπτά· το σύνολο που άθροιζε τα άστρογγυλα έβγαινε ένα
          // λεπτό διαφορετικό από το άθροισμα των καρτών (58.545,22 έναντι 23).
          return { l, m: cents(m), balance: cents(prog ? prog.balance : l.amount),
            ti: cents(prog ? prog.interestRemaining : m*l.years*12-l.amount) }
        })
        const totalBalance = rows.reduce((s,r)=>s+r.balance,0)
        const totalMonthly = rows.reduce((s,r)=>s+r.m,0)
        const totalInterest = rows.reduce((s,r)=>s+r.ti,0)
        // Όλα τα δάνεια της σελίδας είναι του ίδιου ακινήτου: ο δείκτης που μετρά
        // είναι το ΣΥΝΟΛΟ τους προς την αξία, όχι το καθένα μόνο του.
        const propValue = Math.max(0, ...rows.map(r=>Number(r.l.property_value)||0))
        const combinedLtv = propValue>0 ? (totalBalance/propValue)*100 : 0
        const blended = totalBalance>0 ? rows.reduce((s,r)=>s+r.balance*r.l.rate,0)/totalBalance : 0
        const tiles = [
          { k:'Συνολικό υπόλοιπο', v:fmtEur(totalBalance) },
          { k:'Συνολική δόση τον μήνα', v:fmtEur(totalMonthly) },
          { k:'Σταθμισμένο επιτόκιο', v:fmtPct(blended) },
          { k:'Τόκοι που μένουν', v:fmtEur(totalInterest) },
        ]
        // Ενα μέγεθος για όλη τη σειρά: το μακρύτερο ποσό δίνει τον ρυθμό.
        const tilesWidest = widestOf(...tiles.map(t=>t.v))
        return (
          <div style={{background:'var(--bg-surface)',border:'1px solid var(--border-subtle)',borderRadius: T.radius.card,padding:'16px 18px'}}>
            {/* «2 δάνεια» γραφόταν και στη γραμμή από πάνω, δίπλα στην εξαγωγή.
                Ο τίτλος της σύνοψης δεν χρειάζεται να το ξαναπεί. */}
            <p style={{...labelStyle,marginBottom:12}}>Ενιαίο δάνειο, συνολική εικόνα</p>
            {/* ══ ΤΟ ΠΟΣΟ ΔΕΝ ΧΩΡΑΓΕ ΣΤΟ ΠΛΑΚΙΔΙΟ ΤΟΥ ══════════════════════════
                Μετρημένο στα 375 έως 768: το «123.186,65€» στα 24 θέλει 171
                εικονοστοιχεία και το πλακίδιο έδινε 118 έως 145. Το ευρώ έβγαινε
                έξω από την κάρτα σε ΚΑΘΕ πλάτος από 375 και πάνω· ο χρήστης
                διάβαζε «123.186,65» χωρίς νόμισμα, ή και κομμένο.

                Το κατώφλι 150 γράφτηκε για τετραψήφια ποσά. Το 205 είναι το
                μετρημένο πλάτος του μεγαλύτερου ποσού συν το περιθώριο του
                πλακιδίου: εξαψήφιο υπόλοιπο με λεπτά και σύμβολο. ══════ */}
            {/* ΤΟ `auto-fit` ΕΒΓΑΖΕ ΤΡΕΙΣ ΣΤΗΛΕΣ ΚΑΙ ΑΦΗΝΕ ΤΟ ΤΕΤΑΡΤΟ ΜΟΝΟ ΤΟΥ.
                Μετρημένο στα 768, 820 και 900: «3+1», με τους τόκους να κάθονται
                αριστερά και τρύπα δύο στηλών δεξιά τους. Το πλήθος εδώ το όρισε ο
                σχεδιαστής (τέσσερα αθροίσματα, πάντα τα ίδια), οπότε το ορφανό
                διορθώνεται: τέσσερις στήλες όπου χωρούν τα ποσά, δύο παντού
                αλλού, ποτέ τρεις.

                ΚΑΙ ΤΑ ΠΛΑΚΙΔΙΑ ΕΓΙΝΑΝ ΤΟ ΚΟΙΝΟ `KPI`. Είχαν δικό τους κουτί με
                σταθερό αριθμό στα 24, οπότε σε δύο στήλες κινητού το
                «123.186,65€» κοβόταν. Το κοινό `KPI` του Δανείου κλιμακώνει τον
                αριθμό με το πλάτος της στήλης, δηλαδή το πρόβλημα ήταν ήδη
                λυμένο και εδώ γραφόταν δεύτερη φορά με άλλο ιδίωμα.

                ΕΔΩ ΜΕΝΟΥΝ ΠΛΑΚΙΔΙΑ, ΣΤΗΝ ΚΑΡΤΑ ΟΧΙ. Αυτά τα τέσσερα είναι τα
                ΑΘΡΟΙΣΜΑΤΑ: ο μόνος τόπος όπου υπάρχει το συνολικό υπόλοιπο, άρα
                είναι το περιεχόμενο της σύνοψης. Στην κάρτα κάθε δανείου ο ήρωας
                είναι το δικό της υπόλοιπο και τα υπόλοιπα μεγέθη κατεβαίνουν σε
                γραμμή στοιχείων. */}
            <div {...fixedCols(4, 10, 'stretch', 'fc-xs-2 fc-roomy fc-xxs-1')} style={{...fixedCols(4, 10, 'stretch', 'fc-xs-2 fc-roomy fc-xxs-1').style, marginBottom:16}}>
              {tiles.map(t=>(<Tile key={t.k} label={t.k} value={t.v} chars={tilesWidest}/>))}
            </div>
            {/* ══ ΤΟ ΥΠΟΜΝΗΜΑ ΞΑΝΑΕΓΡΑΦΕ ΤΙΣ ΚΑΡΤΕΣ ΠΟΥ ΑΚΟΛΟΥΘΟΥΝ ═══════════════
                Καθε γραμμή του έλεγε τράπεζα, επιτόκιο και δόση — τα ίδια τρία
                που γράφει, με μεγαλύτερα γράμματα, η κάρτα του κάθε δανείου
                αμέσως από κάτω. Δύο δάνεια, έξι νούμερα γραμμένα δύο φορές μέσα
                σε μία οθόνη.

                Η ΜΠΑΡΑ ΜΕΝΕΙ, ΓΙΑΤΙ ΛΕΕΙ ΚΑΤΙ ΠΟΥ ΟΙ ΚΑΡΤΕΣ ΔΕΝ ΛΕΝΕ: την
                αναλογία. Το υπόμνημα κρατά μόνο αυτό — όνομα και ποσοστό, σε μία
                γραμμή που τυλίγεται. Το επιτόκιο και η δόση ζουν στην κάρτα
                τους, όπου έχουν και το μέγεθος που τους αξίζει. */}
            {/* ══ Η ΜΠΑΡΑ ΛΕΕΙ ΤΙ ΜΟΙΡΑΖΕΙ ═══════════════════════════════════════
                Καθόταν κάτω από το «Συνολικό υπόλοιπο» και μοίραζε τη ΔΟΣΗ: το
                71,58% ήταν μερίδιο στη μηνιαία δόση, ενώ στο υπόλοιπο το ίδιο
                δάνειο είναι 87,08%. Τώρα μοιράζει το υπόλοιπο και το λέει.

                ΚΑΙ ΟΙ ΤΟΝΟΙ ΞΕΧΩΡΙΖΟΥΝ. Ήταν accent στο 100% και στο 86%: δύο
                σχεδόν ίδια μπλε, αδιάκριτα και στα δύο θέματα. Τα σκαλιά των 45
                μονάδων (100, 55, 30…) χωρίζουν τα γειτονικά κομμάτια. */}
            {rows.length>1&&(<>
              <p style={{...labelStyle,marginBottom:6}}>Μερίδιο στο υπόλοιπο</p>
              <Bar height={10} style={{borderRadius: T.radius.pill,border:'1px solid var(--border-subtle)',marginBottom: 8}}
                parts={rows.map((r,i)=>({
                  pct: totalBalance>0?(r.balance/totalBalance)*100:0,
                  tone: shareTone(i),
                  title: `${r.l.bank}: ${fmtEur(r.balance)} υπόλοιπο`,
                }))}/>
              <div style={{display:'flex',flexWrap:'wrap',gap:'4px 16px'}}>
                {rows.map((r,i)=>(
                  <span key={r.l.id} style={{display:'inline-flex',alignItems:'center',gap: 8,minWidth:0}}>
                    <span style={{width:8,height:8,borderRadius: T.radius.hair,flexShrink:0,background:shareTone(i)}}/>
                    <span style={{fontSize:12,color:'var(--text-secondary)',fontFamily: T.font.sans,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{r.l.bank||'Δάνειο'}</span>
                    <span style={{fontSize:12,color:'var(--text-tertiary)',fontFamily: T.font.sans,fontVariantNumeric:'tabular-nums'}}>{fp(totalBalance>0?(r.balance/totalBalance)*100:0)}</span>
                  </span>
                ))}
              </div>
              {combinedLtv>0&&(
                <p style={{fontSize:12,color:'var(--text-secondary)',fontFamily: T.font.sans,marginTop:10}}>
                  Συνολικό δάνειο προς αξία σήμερα <strong style={{color:'var(--text-primary)',fontVariantNumeric:'tabular-nums'}}>{fp(combinedLtv)}</strong>
                </p>
              )}
            </>)}
          </div>
        )
      })()}
      {/* Η κατάσταση φόρτωσης και η κενή κατάσταση έφυγαν από εδώ: το μπλοκ
          αποδίδεται πλέον ΜΟΝΟ όταν υπάρχουν δάνεια, οπότε καμία από τις δύο δεν
          μπορούσε να εμφανιστεί. Και η κενή κατάσταση έστελνε «άνοιξε τον
          Υπολογιστή Δανείου» — ο οποίος είναι τώρα ακριβώς από κάτω. */}
      {savedLoans.map(loan=>{
        // ═══ Η ΘΕΣΗ ΤΟΥ ΔΑΝΕΙΟΥ ΣΗΜΕΡΑ ═══════════════════════════════════════
        // Η κάρτα έδειχνε πέντε πλακίδια ίδιου βάρους, με πρώτο το «Ποσό» — το
        // ΑΡΧΙΚΟ κεφάλαιο, δηλαδή τον αριθμό που ίσχυε την ημέρα της υπογραφής
        // και ποτέ ξανά. Όποιος πληρώνει οκτώ χρόνια διάβαζε ακόμη το ποσό της
        // πρώτης μέρας σαν να ήταν το χρέος του, ενώ το ΥΠΟΛΟΙΠΟ — ο λόγος που
        // ανοίγει κανείς αυτή την οθόνη — δεν υπήρχε πουθενά.
        //
        // Η ιεραρχία τώρα λέει μία πρόταση: ΧΡΩΣΤΑΩ ΤΟΣΑ, πληρώνω τόσα τον μήνα,
        // τελειώνω τότε. Ό,τι δεν αλλάζει ποτέ (αρχικό ποσό, επιτόκιο, LTV)
        // κατεβαίνει σε ήσυχη γραμμή στοιχείων· δεν είναι λιγότερο αληθινό,
        // είναι λιγότερο επείγον.
        const prog = loanProgress({
          amount: loan.amount, annualRatePct: loan.rate, years: loan.years,
          startDate: loan.start_date || null, today: athensToday(),
        })
        const m = prog ? prog.monthly : calcMonthly(loan.amount,loan.rate,loan.years)
        // ΤΟ ΣΗΜΕΡΙΝΟ ΥΠΟΛΟΙΠΟ, ΟΧΙ ΤΟ ΑΡΧΙΚΟ ΠΟΣΟ. Ο δείκτης έγραφε 63,16%
        // (120.000 προς 190.000) δίπλα στο «Υπόλοιπο σήμερα 106.876,46€», που
        // κάνει 56,25%. Χωρίς ημερομηνία έναρξης δεν υπάρχει «σήμερα» και ο
        // δείκτης λέει ρητά ότι είναι της έναρξης.
        const ltv = loan.property_value>0?((prog ? prog.balance : loan.amount)/loan.property_value)*100:0
        return(
          <div key={loan.id} style={{background:'var(--bg-surface)',border:'1px solid var(--border-subtle)',borderRadius: T.radius.card,padding:T.sp.lg}}>

            {/* Ταυτότητα: τράπεζα, κατάσταση, είδος. */}
            <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,marginBottom:16}}>
              <div style={{minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:4}}>
                  <p style={{fontSize:15,fontWeight:700,fontFamily:T.font.sans,color:'var(--text-primary)',letterSpacing:'-0.01em'}}>{loan.bank}</p>
                  {/* ΤΟ ΣΗΜΑ ΕΓΡΑΦΕ «mortgage» ΣΕ ΕΛΛΗΝΙΚΗ ΟΘΟΝΗ. Η εφεδρεία ήταν
                      «αν δεν ξέρω την ετικέτα, τύπωσε το κλειδί»: ένας αγγλικός
                      κωδικός βάσης, δίπλα στο όνομα της τράπεζας. Η στήλη είναι
                      απλό `text` χωρίς περιορισμό, οπότε αρκεί μία παλιά ή
                      χειροκίνητη εγγραφή για να βγει στην επιφάνεια. Κωδικός που
                      δεν λέει τίποτα στον χρήστη δεν είναι πληροφορία: το σήμα
                      εμφανίζεται μόνο όταν υπάρχει ελληνική ετικέτα. */}
                  {LOAN_TYPES[loan.loan_type as LoanType]&&<span style={{fontSize: 'var(--fs-xs)',padding:'2px 8px',borderRadius: T.radius.chip,background:'var(--bg-elevated)',border:'1px solid var(--border-subtle)',color:'var(--text-secondary)',fontFamily:T.font.sans}}>{LOAN_TYPES[loan.loan_type as LoanType].label}</span>}
                  {loan.status!=='active'&&<span style={{fontSize: 'var(--fs-xs)',padding:'2px 8px',borderRadius: T.radius.chip,background:'var(--bg-elevated)',color:'var(--text-tertiary)',fontFamily:T.font.sans}}>Ανενεργό</span>}
                </div>
                {loan.notes&&<p style={{fontSize:12,color:'var(--text-secondary)',fontFamily:T.font.sans}}>{loan.notes}</p>}
              </div>
              {/* Ήταν «×» — το σύμβολο του κλεισίματος, πάνω δεξιά, εκεί ακριβώς
                  όπου ο χρήστης το πατά για να ΦΥΓΕΙ. Διέγραφε το δάνειο. */}
              <IconBtn onClick={()=>deleteLoan(loan.id)} label="Διαγραφή δανείου" title="Διαγραφή δανείου" style={{margin:-4}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>
              </IconBtn>
            </div>

            {prog ? (<>
              {/* Ο ΕΝΑΣ ΑΡΙΘΜΟΣ. Μεγαλύτερος από όλα τα υπόλοιπα, μόνος στη σειρά του.
                  ΚΑΙ ΣΤΟΙΧΙΖΕΤΑΙ ΑΠΟ ΠΑΝΩ, ΟΧΙ ΑΠΟ ΚΑΤΩ. Με `flex-end` έδεναν τα
                  κάτω άκρα, οπότε τα δύο νούμερα κάθονταν σε διαφορετικό ύψος —
                  μετρημένο σε tablet, οκτώ εικονοστοιχεία διαφορά — και η σκόπιμη
                  ιεραρχία μεγέθους διαβαζόταν ως αστοχία στοίχισης. Με τις δύο
                  ετικέτες στην ίδια γραμμή, τα νούμερα ξεκινούν στο ίδιο ύψος και
                  διαφέρουν ΜΟΝΟ σε μέγεθος, που είναι το ζητούμενο. */}
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:20,flexWrap:'wrap',marginBottom:14}}>
                <div>
                  <p style={{...labelStyle,marginBottom:4}}>Υπόλοιπο σήμερα</p>
                  <p style={{fontSize:28,fontWeight:700,letterSpacing:'-0.025em',lineHeight:1.05,color:'var(--text-primary)',fontFamily:T.font.sans}}>{fe(prog.balance)}</p>
                  <p style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',marginTop:4,fontFamily:T.font.sans}}>
                    από {fe(loan.amount)} · εκτίμηση με σταθερή δόση
                  </p>
                </div>
                <div className="pole-right">
                  <p style={{...labelStyle,marginBottom:4}}>Δόση τον μήνα</p>
                  <p style={{fontSize:20,fontWeight:600,color:'var(--text-primary)',fontFamily:T.font.sans,lineHeight:1.1}}>{fe(m)}</p>
                  <p style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',marginTop:4,fontFamily:T.font.sans}}>
                    {prog.remainingMonths} {prog.remainingMonths===1?'δόση ακόμη':'δόσεις ακόμη'}
                  </p>
                </div>
              </div>

              {/* Η πρόοδος, ως μήκος και όχι ως χρώμα. Δείχνει αυτό που δεν
                  φαίνεται αλλού: στα πρώτα χρόνια πληρώνεις κυρίως τόκους, οπότε
                  η μπάρα υπολείπεται πάντα του χρόνου που πέρασε. */}
              <div style={{marginBottom:14}}>
                <Bar pct={prog.percentRepaid} label="Ποσοστό αποπληρωμής" track="var(--bg-elevated)" style={{borderRadius: T.radius.pill,border:'1px solid var(--border-subtle)'}}/>
                <div className="po-stack-sm" style={{display:'flex',justifyContent:'space-between',gap:12,marginTop:6}}>
                  <span style={{fontSize: 'var(--fs-xs)',color:'var(--text-secondary)',fontFamily:T.font.sans}}>
                    Εξοφλήθηκε {fp(prog.percentRepaid)} του κεφαλαίου σε {prog.paidMonths} από {prog.totalMonths} δόσεις, με {fe(prog.interestPaid)} τόκους ως τώρα
                  </span>
                  {prog.endDate&&<span style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',fontFamily:T.font.sans,whiteSpace:'nowrap'}}>Λήξη {fdLong(prog.endDate)}</span>}
                </div>
              </div>

            </>) : (
              // Χωρίς ημερομηνία έναρξης δεν υπάρχει «σήμερα»: δεν τυπώνεται
              // υπόλοιπο-εικασία, λέγεται τι λείπει για να υπολογιστεί.
              <div style={{marginBottom:14}}>
                <p style={{...labelStyle,marginBottom:4}}>Δόση τον μήνα</p>
                <p style={{fontSize:28,fontWeight:700,letterSpacing:'-0.02em',color:'var(--text-primary)',fontFamily:T.font.sans,lineHeight:1.1}}>{fe(m)}</p>
                <p style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',marginTop: 4,fontFamily:T.font.sans}}>
                  Συμπλήρωσε ημερομηνία έναρξης για να υπολογιστεί το υπόλοιπο και η λήξη.
                </p>
              </div>
            )}

            {/* ══ ΜΙΑ ΚΑΡΤΑ ΔΑΝΕΙΟΥ, ΕΝΑΣ ΗΡΩΑΣ ΚΑΙ ΜΙΑ ΓΡΑΜΜΗ ΣΤΟΙΧΕΙΩΝ ═════════
                ΤΙ ΕΦΥΓΕ ΑΠΟ ΤΗ ΓΡΑΜΜΗ. Είχε πέντε στοιχεία και τα δύο γράφονταν
                ήδη πιο πάνω: το «Αρχικό ποσό 120.000,00€» κάθεται δύο εκατοστά
                ψηλότερα ως «από 120.000,00€», ακριβώς κάτω από το υπόλοιπο, όπου
                έχει και νόημα· και η «Διάρκεια 25 έτη» γράφεται από τη μπάρα ως
                «σε 53 από 300 δόσεις», με τη λήξη σε ημερομηνία δίπλα της.
                Τριακόσιες δόσεις ΕΙΝΑΙ εικοσιπέντε έτη.

                ΤΙ ΗΡΘΕ ΜΕΣΑ ΤΗΣ. Οι δύο τόκοι ήταν πλακίδια `KPI` σε δύο στήλες:
                στα 1.280 αυτό σημαίνει δύο κουτιά των 940 εικονοστοιχείων που
                κρατούν από ένα ποσό το καθένα, δηλαδή ένα νούμερο με το βάρος
                του υπολοίπου χωρίς να είναι το υπόλοιπο. Ο ήρωας της κάρτας
                είναι ΕΝΑΣ, το υπόλοιπο· τα υπόλοιπα είναι στοιχεία και ζουν στη
                γραμμή στοιχείων. Ιδια πληροφορία, μισό ύψος, μία ιεραρχία. */}
            {/* ΤΕΣΣΕΡΑ ΣΤΟΙΧΕΙΑ ΣΕ ΣΤΑΘΕΡΟ ΠΛΕΓΜΑ. Ήταν πέντε σε σειρά που τύλιγε
                όπου έβρισκε: στα 820 έβγαινε 4+1, με τους «Τόκους που
                απομένουν» μόνους στη δεύτερη σειρά. Οι τόκοι που πληρώθηκαν
                πήγαν στη λεζάντα της προόδου, όπου ανήκουν. */}
            {(()=>{
              const meta:[string,React.ReactNode,boolean?][] = [
                ['Επιτόκιο', `${fp(loan.rate)} · ${rateTypeLabel(loan.rate_type).toLowerCase()}`],
                // Η ΣΤΙΓΜΗ ΠΑΕΙ ΣΤΗΝ ΤΙΜΗ, ΟΠΩΣ ΤΟ ΕΙΔΟΣ ΣΤΟ ΕΠΙΤΟΚΙΟ. Ως ετικέτα, το
                // «Δάνειο προς αξία σήμερα» έπιανε δύο γραμμές στα 390 δίπλα σε
                // μονόγραμμο «Επιτόκιο» και οι δύο τιμές δεν στοιχίζονταν.
                ...(ltv>0 ? [['Δάνειο προς αξία', `${fp(ltv)} · ${prog ? 'σήμερα' : 'στην έναρξη'}`] as [string,React.ReactNode]] : []),
                ...(loan.start_date ? [['Έναρξη', fdLong(loan.start_date)] as [string,React.ReactNode]] : []),
                ...(prog ? [['Τόκοι που μένουν', fe(prog.interestRemaining), true] as [string,React.ReactNode,boolean]] : []),
              ]
              const grid = fixedCols(meta.length, T.sp.lg, 'start', 'fc-xs-2')
              return (
                <div className={grid.className} style={{...grid.style,paddingTop:12,borderTop:'1px solid var(--border-subtle)'}}>
                  {meta.map(([k,v,strong])=>(
                    <div key={k} style={{minWidth:0}}>
                      <p style={{...labelStyle,marginBottom:2}}>{k}</p>
                      <p style={{fontSize:12,color:strong?'var(--text-primary)':'var(--text-secondary)',fontWeight:strong?600:400,fontFamily:T.font.sans,fontVariantNumeric:'tabular-nums'}}>{v}</p>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        )
      })}
    </div>
  )
}
