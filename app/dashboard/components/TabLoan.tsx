'use client'
import { navLabel } from '@/lib/nav/labels';
import { fp, fe } from '@/lib/core/format'
import { ABSENT } from '@/components/tokens'
import { programDateLabel } from '@/lib/loans/programStatus'
import { spitiMouOpen } from '@/lib/loans/recommend'
import { athensToday } from '@/lib/core/time'
import { T, EmptyState, Btn, IconBtn, ChipToggle } from '@/components/Theme'
import { Gift } from 'lucide-react'
import TabLoanCalculator from './TabLoanCalculator'
import { greekWhen, MONTH_MEAN } from '@/lib/market/ecb'
import { monthGen } from '@/lib/core/months'
import { RATES_DISCLAIMER, calcMonthly, fmtEur, fmtPct, spreadRange } from './TabLoanData'
import { isOfficialSource } from '@/lib/loans/rateFeed'
import { hy } from '@/components/Hyphen'
import BankRatesAdmin from './BankRatesAdmin'
import { LensBar, labelStyle, cardStyle } from './LoanShared'
import { NO_RATE, programFacts, cellRate } from './loan/model'
import {
  LensPanel, MiniSection, SourceLinkPill,
} from './loan/Bits'
import { useLoan, type LoanProps, type LoanSection } from './loan/useLoan'
import { SavedLoans } from './loan/SavedLoans'
import { LoanAdvisor } from './loan/LoanAdvisor'
import { LoanGuide } from './loan/LoanGuide'

// Το `propertyRent` έφυγε από τα props: περνούσε από το page.tsx και δεν
// χρησιμοποιούνταν ποτέ — ένα νεκρό καλώδιο που έδινε την εντύπωση ότι ο
// Υπολογιστής ξέρει το ενοίκιο, ενώ αυτός υπολόγιζε «4% της αξίας». Πλέον ο
// Υπολογιστής διαβάζει ο ίδιος το πραγματικό ενοίκιο (rent_config) από τη βάση.
/**
 * «μέσος όρος Αυγούστου» δίπλα σε κάθε τιμή που είναι μέσος όρος μήνα.
 *
 * ΤΟ «Αυγ 2026» ΔΙΑΒΑΖΟΤΑΝ ΩΣ ΣΗΜΕΡΙΝΗ ΤΙΜΗ (28.09.2026). Το Euribor της ΕΚΤ
 * στη λωρίδα είναι ο μέσος όρος του προηγούμενου μήνα· γράφεται αυτό ακριβώς.
 * Οι σειρές που αλλάζουν σε συγκεκριμένη μέρα κρατούν την ημερομηνία τους.
 */
function periodOf(asOf: string, basis: string): string {
  const m = /^\d{4}-(\d{2})-\d{2}$/.exec(asOf || '');
  return m && basis === MONTH_MEAN ? `μέσος όρος ${monthGen(Number(m[1]) - 1)}` : greekWhen(asOf, basis);
}

export default function TabLoan({propertyId,userId,propertyValue,propertySqm,propertyYearBuilt,profileType='individual'}:LoanProps) {
  const {
    initValue, initAmount, FIXED_TERM_COLUMNS, openSec, setOpenSec, profile, calcRef,
    scrollToCalc, calcLens, setCalcLens, lensRef, calcOpen, setCalcOpen, openCalcDocs, applyBank,
    savedLoans, filterSpiti, setFS, selBank, setSelBank, appliedLoan, setAppliedLoan, recHover,
    setRecHover, scoreHover, setScoreHover, otherHover, setOtherHover, hoverBank, setHoverBank,
    hoverBankRow, setHoverBankRow, loadingSaved, market, liveBanks, banksLoading, feed, reloadBanks,
    isAdmin, feedHealth, BANKS, calcState, setCalcState, handleSaveLoan, handleSaveCal,
    handleSaveExp, deleteLoan, banksUpdStr, banksAgeDays, feedFresh, feedCheckedStr, banksStale,
    publishedRate, advType, advBorr, LA, Y, isSpitiMou2, stateOf, openPrograms, activePrograms,
    exportSavedLoans,
  } = useLoan({ propertyId, userId, propertyValue, propertySqm, propertyYearBuilt, profileType })

  const savedContent = (
    <SavedLoans savedLoans={savedLoans} exportSavedLoans={exportSavedLoans} deleteLoan={deleteLoan} />
  )

  return (
    <div style={{fontFamily: T.font.sans,color:'var(--text-primary)',display:'flex',flexDirection:'column',gap:16}}>
      {/* ── Η ΟΘΟΝΗ ΧΡΕΙΑΖΕΤΑΙ ΟΝΟΜΑ, ΚΑΙ ΑΣ ΜΗΝ ΤΟ ΔΕΙΧΝΕΙ ──────────────────
          Δώδεκα καρτέλες έχουν ορατό τίτλο μέσω `PageTitle`, δηλαδή `h1`. Αυτή
          δεν είχε ΚΑΝΕΝΑ: ο αναγνώστης οθόνης ανακοίνωνε τη σελίδα χωρίς όνομα,
          η πλοήγηση ανά επικεφαλίδα —ο βασικός τρόπος που διαβάζει κανείς μια
          άγνωστη οθόνη— ξεκινούσε από `h2` ή `h3` και η ιεραρχία δεν είχε
          κορυφή. Το όνομα έρχεται από το `lib/nav/labels.ts`, την ίδια πηγή με
          το μενού και τη Νόα: δεν επινοείται δεύτερο εδώ.
          Κρυφό ΟΠΤΙΚΑ, όχι από τον αναγνώστη — η οθόνη έχει ήδη τη δική της
          κεφαλίδα και δεν αλλάζει ούτε ένα εικονοστοιχείο. */}
      <h1 className="sr-only">{navLabel('loan')}</h1>

      {/* Header — compact, premium, ήσυχο */}
      <div style={{...cardStyle,padding:'13px 18px',display:'flex',alignItems:'center',gap:T.sp.lg,flexWrap:'wrap'}}>
        <div style={{minWidth:0}}>
          <p style={{fontSize:16,color:'var(--text-primary)',fontWeight:700,fontFamily: T.font.sans,letterSpacing:'-0.02em'}}>Στεγαστικό δάνειο</p>
          <p className="po-subline" style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',fontFamily: T.font.sans}}>Ελληνική αγορά · δεδομένα ΕΚΤ και Τράπεζας Ελλάδος</p>
        </div>
        {/* ══ ΤΕΣΣΕΡΑ ΕΠΙΤΟΚΙΑ ΑΝΑΦΟΡΑΣ ΔΕΝ ΕΙΝΑΙ ΤΕΣΣΕΡΙΣ ΔΕΙΚΤΕΣ ═══════════
            ΗΤΑΝ ΤΕΣΣΕΡΑ ΠΛΑΚΙΔΙΑ ΜΕ ΣΤΟΙΧΙΣΗ ΣΤΟ ΚΕΝΤΡΟ, ΕΤΙΚΕΤΑ ΠΑΝΩ ΚΑΙ
            ΑΡΙΘΜΟ 15 ΑΠΟ ΚΑΤΩ. Μετρημένο στα 390: 106 εικονοστοιχεία σε 2×2,
            με την κεφαλίδα να φτάνει τα 188 πριν αρχίσει η οθόνη. Ομως αυτά τα
            νούμερα δεν είναι δικά σου: είναι το Euribor και το επιτόκιο της
            ΕΚΤ, δηλαδή το κλίμα της αγοράς. Οταν φορούν το ίδιο ρούχο με το
            υπόλοιπο του δανείου σου, διεκδικούν την ίδια προσοχή με αυτό.

            Τώρα είναι μία ήσυχη λωρίδα, ετικέτα και τιμή στην ίδια γραμμή, με
            λεπτό διαχωριστικό ανάμεσα. Ιδια πληροφορία, καμία λιγότερη, στο
            μισό ύψος και χωρίς να μοιάζει με δείκτη απόδοσης.

            ΚΑΙ ΤΟ ΦΩΤΙΣΜΑ ΣΤΟ ΠΕΡΑΣΜΑ ΤΟΥ ΚΕΡΣΟΡΑ ΕΦΥΓΕ. Αλλαζε φόντο σε κάτι
            που δεν πατιέται και δεν ανοίγει τίποτα: κίνηση χωρίς προορισμό. */}
        <div style={{display:'flex',flexWrap:'wrap',alignItems:'baseline',gap:'6px 20px',marginLeft:'auto',minWidth:0}}>
          {[
            {l:'Euribor τριμήνου',v:market.euribor_3m,k:'euribor_3m' as const},
            {l:'Euribor μηνός',v:market.euribor_1m,k:'euribor_1m' as const},
            // ΤΟ ΕΠΙΤΟΚΙΟ ΠΟΥ ΑΝΑΚΟΙΝΩΝΕΙ Η ΕΚΤ ΕΙΝΑΙ ΤΟ ΤΗΣ ΑΠΟΔΟΧΗΣ ΚΑΤΑΘΕΣΕΩΝ.
            // Εδώ έγραφε σκέτο «ΕΚΤ» πάνω στο επιτόκιο κύριας αναχρηματοδότησης,
            // που είναι άλλη σειρά. Η λωρίδα δείχνει πλέον αυτό που λέγεται
            // «επιτόκιο της ΕΚΤ» και το ονομάζει.
            {l:'ΕΚΤ, καταθέσεις',v:market.ecb_dfl,k:'ecb_dfl' as const},
            ...(market.bog_housing_new?[{l:'ΤτΕ μέσο',v:market.bog_housing_new,k:'bog_housing_new' as const}]:[]),
          ].map(item=>(
            /* ΤΟ ΔΙΑΧΩΡΙΣΤΙΚΟ ΗΤΑΝ ΑΡΙΣΤΕΡΟ ΠΕΡΙΓΡΑΜΜΑ, ΚΑΙ ΣΤΟ ΤΥΛΙΓΜΑ ΕΠΕΦΤΕ ΣΤΗΝ
               ΑΡΧΗ ΤΗΣ ΓΡΑΜΜΗΣ. Μετρημένο στα 390: η λωρίδα σπάει σε 1+2+1 και
               δύο κάθετες γραμμούλες κάθονταν κολλητά στο αριστερό περιθώριο,
               χωρίς να χωρίζουν τίποτα. Ενα διαχωριστικό που δεν ξέρει πού
               τελειώνει η σειρά του δεν είναι διαχωριστικό. Χωρίζει το κενό: η
               ετικέτα είναι μικρή κεφαλαία και η τιμή έντονη, οπότε το ζευγάρι
               διαβάζεται ως μονάδα χωρίς βοήθεια. */
            /* ΚΑΙ Η ΗΜΕΡΟΜΗΝΙΑ ΤΗΣ ΚΑΘΕ ΤΙΜΗΣ, ΔΙΠΛΑ ΤΗΣ. Η λωρίδα έδειχνε
               τέσσερα νούμερα χωρίς να λέει πότε ισχύουν· και πιο κάτω μία
               κοινή ημερομηνία «ενημέρωσης» που ήταν η ώρα που έτρεξε η
               εργασία — όχι η ώρα της παρατήρησης. Τα τέσσερα νούμερα ΔΕΝ
               είναι της ίδιας μέρας: το Euribor βγαίνει κάθε εργάσιμη, το
               επιτόκιο της ΕΚΤ αλλάζει λίγες φορές τον χρόνο και το ελληνικό
               μέσο δημοσιεύεται μηνιαία με έξι εβδομάδες καθυστέρηση. Μία
               κοινή ημερομηνία για όλα ήταν λάθος και στα τέσσερα.

               Οταν η τιμή δεν έχει ταυτότητα (πριν από το πρώτο πέρασμα της
               τροφοδοσίας) δεν γράφεται τίποτα στη θέση της: ούτε παύλα ούτε
               «σήμερα». Η απουσία λέγεται με απουσία. */
            <span key={item.l} style={{display:'inline-flex',alignItems:'baseline',gap:6,whiteSpace:'nowrap' as const}}>
              <span style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',textTransform:'uppercase' as const,letterSpacing:'0.06em',fontWeight:600,fontFamily: T.font.sans}}>{item.l}</span>
              <span style={{fontSize: 'var(--fs-base)',fontFamily: T.font.sans,fontVariantNumeric:'tabular-nums',color:market.isLoading?'var(--border-default)':'var(--text-primary)',fontWeight:700,letterSpacing:'-0.01em'}}>
                {market.isLoading?'…':fmtPct(item.v)}
              </span>
              {!market.isLoading && market.provenance[item.k] && (
                <span title={`${market.provenance[item.k]!.basis}, ${market.provenance[item.k]!.source}${market.stale.includes(item.k)?'. Δεν ανανεώθηκε στον αναμενόμενο χρόνο':''}`}
                  style={{fontSize: 'var(--fs-xs)',fontFamily: T.font.sans,fontVariantNumeric:'tabular-nums',color:'var(--text-tertiary)',fontWeight:500,
                    borderBottom:market.stale.includes(item.k)?'1px dotted var(--text-tertiary)':undefined}}>
                  {periodOf(market.provenance[item.k]!.asOf, market.provenance[item.k]!.basis)}
                </span>
              )}
              {/* ΧΩΡΙΣ ΤΑΥΤΟΤΗΤΑ Η ΤΙΜΗ ΕΙΝΑΙ Η ΕΦΕΔΡΙΚΗ, ΚΑΙ ΤΟ ΛΕΕΙ. Γυμνή, μια
                  τιμή γραμμένη στον κώδικα έμοιαζε με σημερινή. Γράφεται ο
                  μήνας της τελευταίας γνωστής παρατήρησης, με διακεκομμένη
                  υπογράμμιση όπως κάθε παλιά τιμή της λωρίδας. */}
              {!market.isLoading && !market.provenance[item.k] && (
                <span title="Εφεδρική τιμή, όχι ζωντανή: η τροφοδοσία δεν έχει δώσει ακόμη νεότερη. Είναι η τελευταία γνωστή παρατήρηση."
                  style={{fontSize: 'var(--fs-xs)',fontFamily: T.font.sans,fontVariantNumeric:'tabular-nums',color:'var(--text-tertiary)',fontWeight:500,borderBottom:'1px dotted var(--text-tertiary)'}}>
                  εκτίμηση {greekWhen(market.updated_at.slice(0,10), 'μέσος όρος μήνα')}
                </span>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* ══ Η ΤΡΟΦΟΔΟΣΙΑ ΜΙΛΑ ΜΟΝΟ ΟΤΑΝ ΕΧΕΙ ΧΑΛΑΣΕΙ ═══════════════════════════
          ΣΙΩΠΗ ΟΤΑΝ ΟΛΑ ΔΟΥΛΕΥΟΥΝ. Ενα μόνιμο «όλα καλά» θα ήταν άλλη μια
          γραμμή που ο διαχειριστής μαθαίνει να προσπερνά — και ακριβώς τη μέρα
          που θα άλλαζε, δεν θα το πρόσεχε. Εμφανίζεται μόνο με πρόβλημα.

          ΚΑΙ ΜΟΝΟ ΣΤΟΝ ΔΙΑΧΕΙΡΙΣΤΗ. Ο ιδιοκτήτης βλέπει ήδη την αλήθεια: κάθε
          τιμή κουβαλά την ημερομηνία της και η παλιά υπογραμμίζεται
          διακεκομμένα. Δεν έχει τι να κάνει με το «η εργασία δεν έτρεξε» και
          δεν του χρωστάμε άγχος για κάτι που δεν ελέγχει. */}
      {isAdmin && feedHealth.checked && !feedHealth.ok && (
        <div style={{display:'flex',alignItems:'flex-start',gap:10,padding:'10px 13px',marginTop:-4,
          background:'var(--bg-surface)',border:'1px solid var(--border-default)',borderRadius:10}}>
          <svg aria-hidden="true" className="po-lead-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.9" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
          <p style={{fontSize:12,color:'var(--text-secondary)',lineHeight:1.55,fontFamily: T.font.sans}}>
            Η τροφοδοσία επιτοκίων χρειάζεται έλεγχο: {feedHealth.reason}. Οι τιμές που βλέπεις είναι οι τελευταίες που ήρθαν, με τη δική τους ημερομηνία η καθεμία.
          </p>
        </div>
      )}

      {/* ═══ ΤΟ ΔΑΝΕΙΟ ΣΟΥ — ΠΡΩΤΟ, ΠΑΝΤΑ ═══════════════════════════════════
          Ζούσε σε `MiniSection order={8}`, μέσα στον φακό «Μάθε περισσότερα»,
          ΚΑΤΩ ΑΠΟ ΤΙΣ «Επίσημες πηγές» — το σχόλιο του κώδικα το έγραφε ρητά.
          Δηλαδή ο ιδιοκτήτης που έχει δάνειο άνοιγε την καρτέλα Δάνειο και
          έβλεπε: υπολογιστή για δάνειο που δεν έχει πάρει, μετά σύσταση για
          δάνειο που δεν ψάχνει και για να δει ΤΟ ΔΙΚΟ ΤΟΥ έπρεπε να αλλάξει
          φάκο και να περάσει επτά πτυσσόμενες ενότητες με γλωσσάρι, ιστορικό
          Euribor και συνδέσμους της Τράπεζας Ελλάδος.

          Το υπόλοιπο, η δόση και η λήξη είναι ο λόγος που ανοίγει αυτή την
          οθόνη κάποιος που ΗΔΗ έχει δάνειο. Ο υπολογιστής είναι για όποιον
          ψάχνει — χρήσιμος, αλλά δεύτερος. ═══════════════════════════════ */}
      {!loadingSaved && savedLoans.length > 0 && (
        <div style={{display:'flex',flexDirection:'column',gap:12}}>{savedContent}</div>
      )}

      {/* ═══ ΥΠΟΛΟΓΙΣΤΗΣ ═══
          ΔΙΠΛΩΝΕΙ ΟΤΑΝ ΥΠΑΡΧΕΙ ΗΔΗ ΔΑΝΕΙΟ. Το σχόλιο απο πάνω το έγραφε ήδη —
          «ο υπολογιστής είναι για όποιον ψάχνει, χρήσιμος αλλά δεύτερος» — και
          η προηγούμενη διόρθωση άλλαξε μόνο τη ΣΕΙΡΑ. Ομως 1.596 γραμμές
          υπολογιστή αγοράς, ανοιχτές κάτω απο το δικό σου δάνειο, δεν είναι
          δεύτερες: είναι η μισή οθόνη. Μένει ένα πάτημα μακριά, δεν φεύγει.
          Οποιος ΔΕΝ έχει δάνειο τη βρίσκει ανοιχτή, όπως πάντα. */}
      <div ref={calcRef}>
        <MiniSection title="Υπολογιστής νέου δανείου"
          meta={<span style={{fontSize:12,color:'var(--text-tertiary)',fontFamily: T.font.sans,whiteSpace:'nowrap' as const}}>δόση, επιτόκια, δικαιολογητικά</span>}
          open={calcOpen} onToggle={setCalcOpen}>
        <TabLoanCalculator
          propertyId={propertyId} userId={userId}
          profile={profile}
          applied={appliedLoan}
          market={{euribor_3m:market.euribor_3m,euribor_1m:market.euribor_1m,ecb_rate:market.ecb_rate,updated_at:market.updated_at,
            euribor_asOf:market.provenance.euribor_3m?.asOf,euribor_basis:market.provenance.euribor_3m?.basis}}
          initial={{
            loanAmount:String(initAmount), propValue:String(initValue),
            sqm: propertySqm && propertySqm>0 ? String(Math.round(propertySqm)) : undefined,
          }}
          onSaveLoan={handleSaveLoan}
          onSaveToCalendar={handleSaveCal}
          onSaveToExpenses={handleSaveExp}
          onStateChange={setCalcState}
          lens={calcLens} onLens={setCalcLens} lensRef={lensRef}
        />
        </MiniSection>
      </div>

      {/* ═══ COCKPIT: εναλλαγή φακών επί τόπου — ένα πάνελ τη φορά ═══ */}
      {/* ΤΡΕΙΣ ΦΑΚΟΙ, ΟΧΙ ΤΕΣΣΕΡΙΣ.
          Η «Σύσταση» και το «Μάθε περισσότερα» ήταν και τα δύο συμβουλευτική,
          χωρισμένη σε δύο προορισμούς: στον πρώτο η ανάλυση του δικού σου
          σεναρίου, στον δεύτερο επτά ενότητες αναφοράς (γλωσσάρι, πώς
          λειτουργεί ένα στεγαστικό, γιατί απορρίπτεται μια αίτηση, ιστορικό
          Euribor, επίσημες πηγές). Ο χρήστης δεν έχει τρόπο να ξέρει σε ποιον
          από τους δύο ζει η απάντησή του — και το «Πώς λειτουργεί» έβγαινε από
          τον έναν και συνεχιζόταν στον άλλο.

          Τώρα είναι μία «Συμβουλευτική»: πρώτα η ανάλυση του σεναρίου σου, μετά
          η γνώση. Τα «Τράπεζες» και «Προγράμματα» μένουν χωριστά γιατί είναι
          ΔΕΔΟΜΕΝΑ (επιτόκια, κρατικά προγράμματα), όχι συμβουλή. */}
      <LensBar value={openSec} onChange={v=>setOpenSec(v as LoanSection)} items={[
        {id:'advisor',label:'Το δάνειό σου'},
        {id:'banks',label:'Τράπεζες'},
        {id:'programs',label:'Προγράμματα'},
        {id:'guide',label:'Οδηγός'},
      ]}/>

      {/* ═══ ΣΥΓΚΡΙΣΗ ΤΡΑΠΕΖΩΝ ═══ */}
      {openSec==='banks' && (<LensPanel title="Σύγκριση τραπεζών" subtitle={`${BANKS.length} τράπεζες · επιβεβαιωμένα ${banksUpdStr}${banksStale?' · χρήζουν επαλήθευσης':''}`}>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {/* Ο διαχειριστής αποθήκευε νέα επιτόκια και η οθόνη κρατούσε τα ΠΑΛΙΑ:
              το onSaved ήταν κενό, οπότε ο πίνακας σύγκρισης, οι κάρτες τραπεζών
              και η ημερομηνία επιβεβαίωσης έμεναν στις τιμές που είχε φέρει το
              useBankRates κατά την προσάρτηση. Το BankRatesAdmin ξαναδιάβαζε
              ΜΟΝΟ τον δικό του πίνακα, άρα ο διαχειριστής έβλεπε δύο διαφορετικά
              επιτόκια για την ίδια τράπεζα στην ίδια οθόνη. Το hook επιστρέφει
              πλέον `reload` και δένεται εδώ. */}
          {isAdmin && <BankRatesAdmin onSaved={reloadBanks}/>}
          {banksStale&&(
            <div style={{display:'flex',alignItems:'flex-start',gap:10,padding:'11px 14px',background:'var(--bg-surface)',border:'1px solid var(--border-default)',borderRadius:10}}>
              <svg aria-hidden="true" className="po-lead-ico" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.9" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
              <p style={{fontSize:12,color:'var(--text-secondary)',lineHeight:1.55,fontFamily: T.font.sans}}>{feed.checked && !feed.ok ? `Ο αυτόματος έλεγχος επιτοκίων δεν τρέχει (${feed.reason}). ` : ''}Τα επιτόκια επιβεβαιώθηκαν πριν από {banksAgeDays} ημέρες και ενδέχεται να έχουν αλλάξει. Για δεσμευτική προσφορά επιβεβαιώστε απευθείας με την τράπεζα ή στο <a href="https://vresdaneio.gr/epitokia/index.html" target="_blank" rel="noreferrer" style={{color:'var(--accent)',textDecoration:'none',fontWeight:500}}>vresdaneio.gr</a>.</p>
            </div>
          )}
          <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
            {/* Φίλτρο «τράπεζες του προγράμματος» έχει νόημα μόνο όσο το
                πρόγραμμα δέχεται αιτήσεις· μετά διαλέγει τράπεζες για κάτι που
                δεν μπορεί πια να ζητηθεί. */}
            {spitiMouOpen(athensToday()) && <ChipToggle on={filterSpiti} onClick={()=>setFS(f=>!f)}>
              Σπίτι μου ΙΙ
            </ChipToggle>}
            <p style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',marginLeft:'auto',fontFamily: T.font.sans}}>
              {banksLoading?'Φόρτωση…':feedFresh?`Ελέγχθηκαν ${feedCheckedStr} · επιβεβαιωμένα ${banksUpdStr}`:`Δελτία τραπεζών · ${banksUpdStr}`}
              {liveBanks.length>0&&!feedFresh&&<span style={{color:'var(--text-secondary)',marginLeft:6}}>Ενημερωμένα στοιχεία</span>}
              {feed.heldChanges>0&&<span style={{color:'var(--warning)',marginLeft:6}}>{feed.heldChanges} {feed.heldChanges===1?'μεταβολή περιμένει':'μεταβολές περιμένουν'} επιβεβαίωση</span>}
            </p>
          </div>

          {/* Επιλέξιμες συμπαγείς κάρτες — διάλεξε τράπεζα για λεπτομέρειες */}
          <p style={{...labelStyle,marginBottom:2}}>Διάλεξε τράπεζα για ανάλυση</p>
          {/* ΜΙΑ ΣΕΙΡΑ, ΟΧΙ ΔΥΟ. Το `auto-fit` έκοβε τις τράπεζες σε 4+2 — μία
              ορφανή δεύτερη σειρά που άλλαζε με το πλάτος και με το φίλτρο
              «Σπίτι μου ΙΙ». Τώρα οι κάρτες μπαίνουν σε ΜΙΑ οριζόντια σειρά: σε
              φαρδιά οθόνη μοιράζονται όλο το πλάτος (1fr) και δεν κυλά τίποτα·
              σε στενή γλιστρούν με το δάχτυλο, με στάση σε κάθε κάρτα, χωρίς
              ποτέ να σπάσουν σε δεύτερη σειρά. Το `data-list` μένει: το πλήθος
              το ορίζουν όσες τράπεζες δίνουν στεγαστικό, όχι ο σχεδιασμός. */}
          <div data-list className="po-scroll-x no-sbar" style={{display:'grid',gridAutoFlow:'column',gridAutoColumns:'minmax(250px, 1fr)',gap:10,scrollSnapType:'x proximity',minWidth:0,margin:'0 -1px',padding:'2px 1px'}}>
            {BANKS.filter(b=>!filterSpiti||b.spiti_mou).map(bank=>{
              const key = bank.id||bank.name
              const on = selBank===key
              const fixed5 = bank.fixed_5yr||bank.fixed_min||ABSENT
              const bankRate = publishedRate(bank)
            const myM = bankRate !== null && LA > 0 ? calcMonthly(LA, bankRate, Y) : null
              return (
                <button key={key} onClick={()=>setSelBank(on?null:key)} aria-pressed={on} onMouseEnter={()=>setHoverBank(key)} onMouseLeave={()=>setHoverBank(null)} onTouchStart={()=>setHoverBank(key)} onTouchEnd={()=>setHoverBank(null)} style={{scrollSnapAlign:'start' as const,display:'flex',flexDirection:'column',textAlign:'left' as const,cursor:'pointer',background:'var(--bg-elevated)',
                  border:`1px solid ${on?'var(--border-accent)':hoverBank===key?'var(--border-default)':'var(--border-subtle)'}`,borderRadius: T.radius.card,padding:'14px 15px',transition:'border-color 0.15s, box-shadow 0.15s',
                  boxShadow:on?'0 2px 4px color-mix(in srgb, var(--accent) 14%, transparent), 0 10px 24px -14px color-mix(in srgb, var(--accent) 40%, transparent)':hoverBank===key?'0 2px 4px color-mix(in srgb, var(--text-primary) 9%, transparent)':'0 1px 2px color-mix(in srgb, var(--text-primary) 6%, transparent)'}}>
                  {/* ΤΡΕΙΣ ΓΡΑΜΜΕΣ, Η ΚΑΘΕ ΜΙΑ ΤΗΣ: όνομα, επιτόκιο+ετικέτα, δόση+ετικέτα.
                      Το «Σπίτι μου ΙΙ» έφυγε από την κάρτα — μένει στο φίλτρο από πάνω
                      και στο πάνελ λεπτομερειών — ώστε το όνομα να χωρά σε ΜΙΑ γραμμή,
                      όσο μακρύ κι αν είναι («Τράπεζα Πειραιώς», «Εθνική Τράπεζα»). Οι
                      δύο μετρήσεις κάθονται κάθε μία σε δική της γραμμή, με την ετικέτα
                      δίπλα στην τιμή· το «…» είναι έσχατη εφεδρεία, δεν σκανδαλίζεται
                      στα ≥250 εικονοστοιχεία της κάρτας. */}
                  <span style={{fontSize:14,fontWeight:600,fontFamily: T.font.sans,color:'var(--text-primary)',lineHeight:1.3,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',display:'block'}}>{bank.name}</span>
                  <div style={{display:'flex',flexDirection:'column',gap:6,marginTop:'auto',paddingTop:12}}>
                    <div style={{display:'flex',alignItems:'baseline',gap:8,minWidth:0}}>
                      <span style={{fontSize:16,fontFamily: T.font.sans,fontVariantNumeric:'tabular-nums',color:'var(--text-primary)',fontWeight:700,lineHeight:1,letterSpacing:'-0.02em',whiteSpace:'nowrap',flexShrink:0}}>{cellRate(fixed5)===NO_RATE?NO_RATE:<>από <span style={{color:(on||hoverBank===key)?'var(--accent)':'var(--text-primary)',transition:'color 0.15s'}}>{cellRate(fixed5)}</span></>}</span>
                      <span style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',fontFamily: T.font.sans,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',minWidth:0}}>Σταθερό 5 ετών</span>
                    </div>
                    <div style={{display:'flex',alignItems:'baseline',gap:8,minWidth:0}}>
                      <span style={{fontSize:14,fontFamily: T.font.sans,fontVariantNumeric:'tabular-nums',color:'var(--text-primary)',fontWeight:600,lineHeight:1,whiteSpace:'nowrap',flexShrink:0}}>{myM!==null?fmtEur(myM):fe(0)}</span>
                      <span style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',fontFamily: T.font.sans,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',minWidth:0}}>{myM!==null?'δόση':'χωρίς δημοσιευμένο επιτόκιο'}{myM!==null&&bank.max_ltv?` · έως ${bank.max_ltv}%`:''}</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Λεπτομέρειες επιλεγμένης τράπεζας */}
          {(()=>{
            const bank = BANKS.filter(b=>!filterSpiti||b.spiti_mou).find(b=>(b.id||b.name)===selBank)
            if(!bank) return null
            // Ο ΔΕΙΚΤΗΣ ΤΗΣ ΤΡΑΠΕΖΑΣ, ΟΧΙ Ο ΙΔΙΟΣ ΓΙΑ ΟΛΕΣ. Η Πειραιώς τιμολογεί σε
            // Euribor μηνός· με το τριμήνου το «σήμερα» έβγαινε ψηλότερο απ' όσο είναι.
            const euribor = bank.rate_index==='1M' ? market.euribor_1m : market.euribor_3m
            const varRate = bank.variable_spread_min?fmtPct(euribor+bank.variable_spread_min):null
            const bankRate = publishedRate(bank)
            const myM = bankRate !== null && LA > 0 ? calcMonthly(LA, bankRate, Y) : null
            const terms = [['3 ετών','fixed_3yr'],['5 ετών','fixed_5yr'],['10 ετών','fixed_10yr'],['15 ετών','fixed_15yr'],['20 ετών','fixed_20yr']] as const
            return (
              <div style={{background:'var(--bg-elevated)',border:'1px solid var(--border-accent)',borderRadius: T.radius.card,padding:'18px 20px',boxShadow:'var(--shadow-sm)'}}>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,flexWrap:'wrap',marginBottom:16}}>
                  <div>
                    <p style={{fontSize:16,fontWeight:600,fontFamily: T.font.sans,color:'var(--text-primary)',letterSpacing:'-0.01em'}}>{bank.name}</p>
                    {bank.note&&<p style={{fontSize:12,color:'var(--text-tertiary)',marginTop: 4,fontFamily: T.font.sans}}>{bank.note}</p>}
                    {/* ΑΠΟ ΠΟΥ ΕΡΧΟΝΤΑΙ ΤΑ ΝΟΥΜΕΡΑ ΚΑΙ ΠΟΣΟ ΠΑΛΙΟ ΕΙΝΑΙ ΤΟ ΕΓΓΡΑΦΟ.
                        Το δελτίο της Optima είναι του Νοεμβρίου 2025· χωρίς την
                        ημερομηνία του, το «επιβεβαιωμένα» της κεφαλίδας θα το
                        έκανε να μοιάζει σημερινό. Και ο σύνδεσμος βγαίνει μόνο
                        όταν δείχνει στην ίδια την τράπεζα: ένας συγκριτικός
                        ιστότοπος δεν είναι δελτίο της. */}
                    <p style={{fontSize:12,color:'var(--text-tertiary)',marginTop: 4,fontFamily: T.font.sans}}>
                      {isOfficialSource(bank.id, bank.source_url)
                        ? <><a href={bank.source_url} target="_blank" rel="noreferrer" style={{color:'var(--accent)',textDecoration:'none',fontWeight:500}}>Δελτίο επιτοκίων της τράπεζας</a>{bank.source_doc_date ? ` · ισχύς ${bank.source_doc_date.split('-').reverse().join('/')}` : ' · χωρίς ημερομηνία δελτίου'}</>
                        : 'Δεν βρέθηκε επίσημο δελτίο επιτοκίων'}
                    </p>
                  </div>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    {bank.url&&<a href={bank.url} target="_blank" rel="noreferrer" style={{padding:'0 16px',height:T.h.md,borderRadius: T.radius.modal,border:'1px solid var(--border-default)',background:'none',color:'var(--text-secondary)',fontSize: 'var(--fs-base)',fontFamily: T.font.sans,textDecoration:'none',fontWeight:500,display:'flex',alignItems:'center'}}>Επίσκεψη</a>}
                    <Btn variant="primary" disabled={bankRate===null} title={bankRate===null?'Η τράπεζα δεν έχει δημοσιεύσει επιτόκιο· δεν υπάρχει τιμή να εφαρμοστεί':undefined} onClick={()=>{ if(bankRate!==null) applyBank(bankRate, 'fixed', bank.name) }}>Υπολόγισε τη δόση</Btn>
                    {/* ΤΟ ΠΑΝΕΛ ΑΝΟΙΓΕ ΚΑΙ ΔΕΝ ΕΚΛΕΙΝΕ ΑΠΟ ΠΟΥΘΕΝΑ. Η μόνη έξοδος
                        ήταν να ξαναβρεί ο χρήστης το πλακίδιο της τράπεζας ΠΑΝΩ από
                        το πάνελ και να το ξαναπατήσει — δηλαδή να κυλήσει προς τα
                        πάνω, να θυμηθεί ποιο από τα επτά ήταν, να μαντέψει ότι
                        το δεύτερο πάτημα κλείνει. Πεντακόσια εικονοστοιχεία
                        περιεχομένου χωρίς κουμπί κλεισίματος. Το «×» κάθεται εκεί
                        που κάθεται σε κάθε παράθυρο της εφαρμογής: δεξιά στην
                        κεφαλίδα, με ζώνη αφής 44. */}
                    <IconBtn size="md" onClick={()=>setSelBank(null)} label={`Κλείσιμο: ${bank.name}`}
                      style={{fontSize:18,lineHeight:1,fontFamily: T.font.sans}}>×</IconBtn>
                  </div>
                </div>
                <p style={{...labelStyle,marginBottom:10}}>Σταθερά επιτόκια «από», ανά διάρκεια</p>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(min(100%, 90px), 1fr))',gap:8,marginBottom:16}}>
                  {terms.map(([lab,k])=>(
                    <div key={k} style={{background:'var(--bg-surface)',border:'1px solid var(--border-subtle)',borderRadius:10,padding:'10px 12px'}}>
                      <p style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',fontFamily: T.font.sans,marginBottom: 4}}>{lab}</p>
                      <p style={{fontSize:16,fontFamily: T.font.sans,fontVariantNumeric:'tabular-nums',color:'var(--text-primary)',fontWeight:700,lineHeight:1}}>{cellRate(bank[k])}</p>
                    </div>
                  ))}
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',gap:8}}>
                  {[
                    {label:bank.rate_index?`Περιθώριο πάνω από Euribor ${bank.rate_index}`:'Κυμαινόμενο περιθώριο',value:bank.variable_spread_min!==undefined?spreadRange(bank):NO_RATE,sub:varRate?`≈ ${varRate} σήμερα`:null},
                    {label:'Εκτιμώμενη δόση',value: myM !== null ? fmtEur(myM) : fe(0),sub: myM !== null ? `${fmtEur(LA)} · ${Y} έτη` : bankRate === null ? 'Η τράπεζα δεν έχει δημοσιεύσει επιτόκιο' : 'Συμπλήρωσε ποσό δανείου για υπολογισμό'},
                    {label:'Μέγιστο δάνειο προς αξία',value:bank.max_ltv?fp(bank.max_ltv):NO_RATE,sub:bank.max_amount?`έως ${fmtEur(bank.max_amount)}`:null},
                    ...(spitiMouOpen(athensToday()) ? [{label:'Σπίτι μου ΙΙ',value:bank.spiti_mou?'Ναι':'Όχι',sub:bank.spiti_mou?'Συμμετέχει στο πρόγραμμα':'Δεν συμμετέχει'}] : []),
                  ].map(s=>(
                    <div key={s.label} style={{background:'var(--bg-surface)',border:'1px solid var(--border-subtle)',borderRadius:10,padding:'11px 13px'}}>
                      <p style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',textTransform:'uppercase' as const,letterSpacing:'0.05em',fontWeight:600,fontFamily: T.font.sans,marginBottom:6}}>{s.label}</p>
                      {/* ΤΙΜΗ ΚΑΙ ΒΑΣΗ ΤΗΣ ΣΤΗΝ ΙΔΙΑ ΓΡΑΜΜΗ, ΚΑΙ ΤΑ ΤΕΣΣΕΡΑ ΙΔΙΑ.
                          Το `flex-wrap` τα κρατά δίπλα όσο χωρούν και ρίχνει τη βάση
                          κάτω από την τιμή όταν το πλακίδιο στενέψει — καθαρά, χωρίς
                          κόψιμο, ομοιόμορφα σε όλα τα πλακίδια. */}
                      <div style={{display:'flex',alignItems:'baseline',gap:8,flexWrap:'wrap',rowGap:2}}>
                        <span style={{fontSize:16,fontFamily: T.font.sans,fontVariantNumeric:'tabular-nums',color:'var(--text-primary)',fontWeight:700,lineHeight:1.25}}>{s.value}</span>
                        {s.sub&&<span style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',fontFamily: T.font.sans,lineHeight:1.3}}>{s.sub}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* Πλήρης πίνακας επιτοκίων — πτυσσόμενος */}
          <MiniSection title="Πλήρης πίνακας επιτοκίων" meta={<span style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',fontFamily: T.font.sans}}>{banksUpdStr}</span>}>
            <div className="po-table-box">
              <div className="po-scroll-x">
              {/* Η ΠΡΩΤΗ ΣΤΗΛΗ ΚΑΡΦΩΝΕΤΑΙ, ΓΙΑΤΙ ΕΝΝΕΑ ΣΤΗΛΕΣ ΔΕΝ ΧΩΡΑΝΕ ΠΟΥΘΕΝΑ.
                  Ο πίνακας κυλά οριζόντια σε κάθε πλάτος κάτω από τα 1.100: ο
                  χρήστης σέρνει για να δει το «Δάνειο προς αξία» και το όνομα
                  της τράπεζας φεύγει από την οθόνη. Του μένει μια σειρά
                  ποσοστών χωρίς κάτοχο. Το `--row-bg` γράφεται μαζί με το φόντο
                  της γραμμής, ώστε το καρφωμένο κελί να μη μένει πίσω στο
                  πέρασμα του δείκτη και οι αριθμοί να μη φαίνονται από μέσα. */}
              <table className="po-table pin-1" style={{'--tbl-min':'900px','--row-bg':'var(--surface-raised)'}}>
                <thead>
                  <tr>
                    {([['Τράπεζα','left'],['3 έτη','right'],['5 έτη','right'],['10 έτη','right'],['15 έτη','right'],['20 έτη','right'],['Κυμαινόμενο περιθώριο','right'],['Δάνειο προς αξία','right'],['Σπίτι μου ΙΙ','left']] as const).map(([h,al])=>(
                      <th key={h} scope="col" style={{textAlign:al,whiteSpace:'nowrap' as const}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {BANKS.filter(b=>!filterSpiti||b.spiti_mou).map((bank,i)=>(
                    <tr key={bank.id||bank.name} onMouseEnter={()=>setHoverBankRow(i)} onMouseLeave={()=>setHoverBankRow(null)} onTouchStart={()=>setHoverBankRow(i)} onTouchEnd={()=>setHoverBankRow(null)} style={{'--row-bg':hoverBankRow===i?'var(--bg-hover)':'var(--surface-raised)',background:hoverBankRow===i?'var(--bg-hover)':'transparent',transition:'background 0.12s'}}>
                      <td>
                        <span style={{fontSize: 'var(--fs-base)',fontWeight:500,color:'var(--text-primary)'}}>{bank.name}</span>
                      </td>
                      {FIXED_TERM_COLUMNS.map(k=>(
                        <td key={k} className="num" style={{fontSize: 'var(--fs-base)',color:bank[k]?(hoverBankRow===i?'var(--accent)':'var(--text-primary)'):'var(--text-tertiary)',fontWeight:500,transition:'color 0.12s'}}>{cellRate(bank[k])}</td>
                      ))}
                      <td className="num" style={{fontSize: 'var(--fs-base)',color:hoverBankRow===i?'var(--accent)':'var(--text-primary)',transition:'color 0.12s'}}>{bank.variable_spread_min!==undefined?spreadRange(bank):NO_RATE}</td>
                      <td className="num" style={{fontSize: 'var(--fs-base)',color:bank.max_ltv?(hoverBankRow===i?'var(--accent)':'var(--text-primary)'):'var(--text-tertiary)',fontWeight:500,transition:'color 0.12s'}}>{bank.max_ltv?fp(bank.max_ltv):NO_RATE}</td>
                      <td>
                        {bank.spiti_mou
                          ?<span style={{fontSize:12,color:'var(--text-primary)',fontFamily: T.font.sans,fontWeight:500}}>Ναι</span>
                          :<span style={{fontSize:12,color:'var(--text-tertiary)'}}>Όχι</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
            <p style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',marginTop:12,lineHeight:1.6,fontFamily: T.font.sans}}>
              Εμφανίζονται τα χαμηλότερα («από») επιτόκια ανά διάρκεια. {RATES_DISCLAIMER} Επιβεβαιωμένα {banksUpdStr}. Πηγή:{' '}
              <a href="https://e-stegastiko.gr" target="_blank" rel="noreferrer" style={{color:'var(--accent)',textDecoration:'none',fontWeight:500}}>e-stegastiko.gr</a>
            </p>
          </MiniSection>
        </div>
      </LensPanel>)}

      {/* ═══ ΚΡΑΤΙΚΑ ΠΡΟΓΡΑΜΜΑΤΑ ═══ */}
      {openSec==='programs' && (<LensPanel title="Κρατικά προγράμματα" subtitle={openPrograms>0 ? `${openPrograms} ${openPrograms===1?'δέχεται αιτήσεις':'δέχονται αιτήσεις'} από ${activePrograms.length}` : `Κανένα από τα ${activePrograms.length} δεν δέχεται αιτήσεις σήμερα`}>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div style={{padding:'2px 2px 4px'}}>
            <p style={{fontSize:12,color:'var(--text-tertiary)',lineHeight:1.6,fontFamily: T.font.sans}}>
              Στοιχεία από επίσημες πηγές{' · '}
              <a href="https://greece20.gov.gr/home-loans/" target="_blank" rel="noreferrer" style={{color:'inherit',textDecoration:'none',fontWeight:500,borderBottom:'1px solid var(--border-default)'}}>greece20.gov.gr</a>{', '}
              {/* ΕΔΩ ΚΑΘΟΤΑΝ ΗΜΕΡΟΜΗΝΙΑ ΠΟΥ ΑΝΗΚΕ ΣΕ ΑΛΛΑ ΔΕΔΟΜΕΝΑ. Ηταν η
                  `market.updated_at`, δηλαδή η ώρα που έτρεξε η εργασία των
                  ΕΠΙΤΟΚΙΩΝ, τυπωμένη δίπλα σε δύο κυβερνητικούς συνδέσμους για
                  τα ΠΡΟΓΡΑΜΜΑΤΑ. Δεν έλεγε πότε ελέγχθηκε το greece20.gov.gr:
                  έλεγε πότε ρωτήθηκε η ΕΚΤ. Η προθεσμία κάθε προγράμματος
                  γράφεται στην κάρτα του, με τη δική της ημερομηνία. */}
              <a href="https://ypen.gov.gr" target="_blank" rel="noreferrer" style={{color:'inherit',textDecoration:'none',fontWeight:500,borderBottom:'1px solid var(--border-default)'}}>ypen.gov.gr</a>
            </p>
          </div>

          {activePrograms.map(prog=>{
            const st = stateOf(prog)
            // Η ημερομηνία που δείχνεται είναι αυτή που ΜΕΤΡΑΕΙ για τον χρήστη:
            // όσο δέχεται αιτήσεις, η προθεσμία αίτησης· αφού κλείσουν, η
            // προθεσμία υπογραφής, με το κείμενο να λέει ρητά ποιανού είναι.
            const deadStr = programDateLabel(
              st.acceptsApplications ? (prog.applicationDeadline || prog.deadline) : prog.deadline) || null
            // ΤΟ «ΕΩΣ» ΘΕΛΕΙ ΗΜΕΡΟΜΗΝΙΑ. Το πεδίο της προθεσμίας δέχεται και
            // κείμενο, για προγράμματα χωρίς ανακοινωμένη λήξη: τότε η κεφαλίδα
            // έγραφε «Αιτήσεις έως Χωρίς ανακοινωμένη λήξη», που δεν στέκει ως
            // ελληνικά και στα 320 ξέφευγε 14 έξω από την κάρτα. Οταν δεν είναι
            // ημερομηνία, λέγεται σκέτο.
            const deadIsDate = !!deadStr && /^\d{2}\/\d{2}\/\d{4}$/.test(deadStr)
            const closed = !st.acceptsApplications
            // ΤΟ `nowrap` ΕΒΓΑΖΕ ΤΗΝ ΠΡΟΘΕΣΜΙΑ ΕΞΩ ΑΠΟ ΤΗΝ ΚΑΡΤΑ. Μετρημένο στα
            // 320: το όνομα του προγράμματος και το «Αιτήσεις έως 31/05/2026» δεν
            // χωρούν στην ίδια γραμμή και η ημερομηνία ξέφευγε 14 εικονοστοιχεία.
            // Η προθεσμία επιτρέπεται να πέσει σε δεύτερη γραμμή· να βγει έξω από
            // την κάρτα δεν επιτρέπεται.
            return (
            <MiniSection key={prog.id} title={prog.name} defaultOpen={isSpitiMou2(prog.name) && st.acceptsApplications}
              badges={<>
                <span style={{fontSize: 'var(--fs-xs)',padding:'2px 8px',borderRadius: T.radius.chip,background:'var(--bg-surface)',border:'1px solid var(--border-subtle)',color:closed?'var(--text-tertiary)':'var(--text-primary)',fontWeight:closed?500:600,fontFamily: T.font.sans}}>{st.badge}</span>
              </>}
              meta={deadStr?<span style={{fontSize:12,color:'var(--text-tertiary)',fontFamily: T.font.sans}}>{deadIsDate?`${st.acceptsApplications?'Αιτήσεις έως':'Υπογραφές έως'} ${deadStr}`:deadStr}</span>:undefined}
            >
              {/* Η ΠΡΟΤΑΣΗ ΠΟΥ ΕΛΕΙΠΕ. Χωρίς αυτήν, δύο ημερομηνίες κάθονταν
                  δίπλα-δίπλα και ο χρήστης μάντευε ποια τον αφορά. */}
              {st.note&&<p className="po-prose po-just" style={{fontSize:12,color:'var(--text-secondary)',fontFamily: T.font.sans,marginBottom:12,padding:'9px 12px',background:'var(--bg-elevated)',border:'1px solid var(--border-subtle)',borderRadius:10}}>{hy(<>{st.note}</>)}</p>}
              {/* ΚΛΕΙΣΤΟ ΠΡΟΓΡΑΜΜΑ: Η ΚΑΤΑΣΤΑΣΗ ΚΑΙ Η ΠΗΓΗ, ΟΧΙ ΟΙ ΟΡΟΙ. Η κάρτα
                  έγραφε σήμα «Έκλεισε» και από κάτω «άτοκο 50%», κριτήρια,
                  τράπεζες και «εξοικονόμηση δεκάδων χιλιάδων €»: όροι για κάτι
                  που δεν μπορεί πια να ζητηθεί, που διαβάζονταν ως προσφορά.
                  Το «Επερχόμενο» κρατά την περιγραφή του: λέει το ίδιο ότι δεν
                  δέχεται αιτήσεις και γιατί. */}
              {!(st.state==='closed'||st.state==='applications-closed')&&(<>
              <p style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',marginBottom:10,fontWeight:600,fontFamily: T.font.sans,textTransform:'uppercase' as const,letterSpacing:'0.05em'}}>{prog.type}</p>
              <p className="po-prose po-just" style={{fontSize: 'var(--fs-base)',color:'var(--text-secondary)',fontFamily: T.font.sans,marginBottom:16}}>{hy(<>{prog.desc}</>)}</p>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',gap:14,marginBottom:12}}>
                <div>
                  <p style={{...labelStyle,marginBottom:10}}>Κριτήρια επιλεξιμότητας</p>
                  {prog.criteria.map((c,i)=>(
                    <div key={i} style={{display:'flex',alignItems:'flex-start',gap:8,marginBottom:6}}>
                      <span style={{width:5,height:5,borderRadius:'50%',background:'var(--border-subtle)',flexShrink:0,marginTop: 4}}/>
                      <span style={{fontSize:12,color:'var(--text-secondary)',lineHeight:1.4,fontFamily: T.font.sans}}>{c}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <p style={{...labelStyle,marginBottom:10}}>Βασικά στοιχεία</p>
                  <div style={{display:'flex',flexDirection:'column',gap:6}}>
                    {programFacts(prog).map((fact,idx,arr)=>(
                      <div key={fact.label} style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:16,padding:'6px 0',borderBottom:idx<arr.length-1?'1px solid var(--border-subtle)':'none'}}>
                        <span style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',fontFamily: T.font.sans,flexShrink:0}}>{fact.label}</span>
                        <span style={{fontSize:fact.size,fontFamily: T.font.sans,fontVariantNumeric:'tabular-nums',color:fact.color,fontWeight:fact.size>12?700:500,textAlign:'right' as const,lineHeight:1.35}}>{fact.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {(prog.howItWorks||prog.extra||prog.savingsExample)&&(
                <div style={{padding:'12px 14px',background:'var(--bg-surface)',border:'1px solid var(--border-subtle)',borderRadius:10,marginBottom:12,display:'flex',flexDirection:'column',gap: 8}}>
                  {prog.howItWorks&&<p style={{fontSize:12,color:'var(--text-secondary)',lineHeight:1.6,fontFamily: T.font.sans}}>{prog.howItWorks}</p>}
                  {prog.extra&&<p className="po-prose po-just" style={{fontSize:12,color:'var(--text-secondary)',fontFamily: T.font.sans}}>{hy(<>{prog.extra}</>)}</p>}
                  {prog.savingsExample&&<p style={{fontSize:12,color:'var(--text-secondary)',lineHeight:1.55,fontFamily: T.font.sans}}>{prog.savingsExample}</p>}
                </div>
              )}
              <div style={{display:'flex',gap: 4,flexWrap:'wrap',marginBottom:14}}>
                {prog.banks.map(b=><span key={b} style={{fontSize: 'var(--fs-xs)',padding:'3px 9px',borderRadius: T.radius.chip,background:'var(--bg-surface)',border:'1px solid var(--border-subtle)',color:'var(--text-secondary)',fontFamily: T.font.sans}}>{b}</span>)}
              </div>
              </>)}
              <SourceLinkPill href={prog.url}>Επίσημη σελίδα προγράμματος</SourceLinkPill>
            </MiniSection>
            )
          })}
          {activePrograms.length===0&&(
            <EmptyState
              icon={<Gift size={20}/>}
              title="Κανένα ενεργό πρόγραμμα"
              hint="Τα κρατικά προγράμματα στέγασης εμφανίζονται εδώ μόλις ανοίξει νέος κύκλος."
            />
          )}
        </div>
      </LensPanel>)}

      {/* ═══ ΣΥΣΤΑΣΗ ΚΑΙ ΑΝΑΛΥΣΗ ═══ */}
      {openSec==='advisor' && (<LoanAdvisor
                                 LA={LA} Y={Y} BANKS={BANKS} market={market} calcState={calcState}
                                 setAppliedLoan={setAppliedLoan} handleSaveLoan={handleSaveLoan}
                                 scrollToCalc={scrollToCalc} advType={advType} advBorr={advBorr}
                                 setScoreHover={setScoreHover} scoreHover={scoreHover}
                                 propertySqm={propertySqm} propertyYearBuilt={propertyYearBuilt}
                                 activePrograms={activePrograms} stateOf={stateOf} setRecHover={setRecHover}
                                 recHover={recHover} applyBank={applyBank} otherHover={otherHover}
                                 setOtherHover={setOtherHover} profile={profile}
                               />)}

      {/* ═══ Η ΓΝΩΣΗ ΕΓΙΝΕ ΔΙΚΟΣ ΤΗΣ ΦΑΚΟΣ ════════════════════════════════
          Η «Συμβουλευτική» κρατούσε ΔΕΚΑΟΚΤΩ πάνελ στην ίδια κύλιση: έντεκα
          για το δικό σου σενάριο και επτά εγκυκλοπαιδικά (πώς λειτουργεί ένα
          στεγαστικό, γιατί απορρίπτεται μια αίτηση, ειδικές κατηγορίες,
          ιστορικό Euribor, κόκκινα δάνεια, γλωσσάρι, πηγές). Οποιος ήθελε το
          γλωσσάρι περνούσε από τη βαθμολογία του δανείου του· όποιος ήθελε τη
          βαθμολογία δεν έβλεπε πού τελειώνει η σελίδα.

          ΓΙΑΤΙ ΤΩΡΑ ΔΟΥΛΕΥΕΙ ΕΝΩ ΤΟΤΕ ΟΧΙ. Ο παλιός χωρισμός ήταν «Σύσταση»
          και «Μάθε περισσότερα»: δύο ονόματα που και τα δύο υπόσχονται
          συμβουλή, οπότε κανείς δεν ήξερε πού ζει η απάντησή του. «Το δάνειό
          σου» και «Οδηγός» δεν συγχέονται: το ένα έχει τα ΝΟΥΜΕΡΑ σου, το
          άλλο ό,τι ισχύει για όλους. ═══════════════════════════════════ */}
      {openSec==='guide' && (<LoanGuide
                               advType={advType} openCalcDocs={openCalcDocs} market={market} profile={profile}
                             />)}

    </div>
  )
}