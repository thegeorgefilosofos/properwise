'use client'
// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΔΥΟ ΦΑΚΟΙ ΤΗΣ ΑΠΟΣΒΕΣΗΣ: ΤΟ ΓΡΑΦΗΜΑ ΚΑΙ Ο ΠΙΝΑΚΑΣ ΜΕ ΤΑ ΕΓΓΡΑΦΑ
// ─────────────────────────────────────────────────────────────────────────
// Η απόσβεση υπολογίζεται μία φορά στο TabLoanCalculator (`calcAmortization`)
// και φτάνει εδώ έτοιμη. Ο φακός «Πίνακας και έγγραφα» κρατά και την πλήρη
// ανάλυση κόστους απόκτησης, όπως όταν ζούσε μέσα στην καρτέλα· η κατάσταση
// της γραμμής ή του πλακιδίου που εξετάζεις (`hoverRow`, `hoverCost`) μένει
// στην καρτέλα, ώστε να μη χάνεται όταν ο φακός κλείνει και ξανανοίγει.
// ═══════════════════════════════════════════════════════════════════════════
import { fe } from '@/lib/core/format'
import { cardStyle } from '../../LoanShared'
import DocChecklist from '../../DocChecklist'
import { T, fixedCols, Btn } from '@/components/Theme'
import { AADE_HOME } from '@/lib/tax/aade'
import { ShieldCheck } from 'lucide-react'
import { LOAN_TYPES, BORROWER_PROFILES, fmtEur, type AmortRow, type LoanType, type BorrowerType } from '../../TabLoanData'
import type { calcNotaryFees } from './model'
import { Section, SectionLabel, labelStyle, type SetState } from './Bits'
import { AmortDonut, AmortArea } from './charts'

export function AmortLens({ LA, totalInt, amortChart }: {
  LA: number; totalInt: number; amortChart: { year: string; Κεφάλαιο: number; Τόκοι: number }[];
}) {
  return (
    <Section title="Γράφημα αποπληρωμής" sub="Κεφάλαιο έναντι τόκων στη διάρκεια" defaultOpen>
      <div style={{display:'flex',gap:T.sp.lg,alignItems:'center',flexWrap:'wrap'}}>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10}}>
          <AmortDonut principal={LA} interest={totalInt}/>
          <div style={{display:'flex',gap:14}}>
            <span style={{display:'flex',alignItems:'center',gap:6,fontSize: 'var(--fs-xs)',color:'var(--text-secondary)',fontFamily: T.font.sans}}><span style={{width:9,height:9,borderRadius:3,background:'var(--accent)'}}/>Κεφάλαιο {fmtEur(LA)}</span>
            <span style={{display:'flex',alignItems:'center',gap:6,fontSize: 'var(--fs-xs)',color:'var(--text-secondary)',fontFamily: T.font.sans}}><span style={{width:9,height:9,borderRadius:3,background:'var(--text-tertiary)',opacity:0.5}}/>Τόκοι {fmtEur(totalInt)}</span>
          </div>
        </div>
        {/* ΤΟ ΔΑΠΕΔΟ ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΞΕΠΕΡΝΑ ΤΗ ΘΗΚΗ ΤΟΥ. Στα 320 η κάρτα
            δίνει λιγότερα από 260 εικονοστοιχεία, οπότε το `min-width: 260`
            έσπρωχνε το γράφημα και τη λεζάντα του 15 έξω από το πλαίσιο.
            Με `min(100%, 260px)` το δάπεδο ισχύει όσο υπάρχει χώρος και
            υποχωρεί όταν δεν υπάρχει — το ίδιο ιδίωμα με τις άλλες σειρές. */}
        <div style={{flex:1,minWidth:'min(100%, 260px)'}}>
          <AmortArea data={amortChart.map(d=>({year:d.year,cap:d.Κεφάλαιο,int:d.Τόκοι}))} fmt={fmtEur}/>
          <p style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',marginTop:6,lineHeight:1.5,fontFamily: T.font.sans}}>
            Κάθε στήλη είναι η ετήσια δόση. Στην αρχή πληρώνεις κυρίως τόκους· σταδιακά υπερισχύει το κεφάλαιο. Η διακεκομμένη γραμμή δείχνει το έτος όπου το κεφάλαιο ξεπερνά τους τόκους.
          </p>
        </div>
      </div>
    </Section>
  );
}

export function TableLens({
  Y, exportAmortPdf, officialAmort, genOfficial, exportAmortCsv, amort, hoverRow, setHoverRow, loanType, propTypeLabel,
  isNewBuilding, propertyId, borrower, SQM, areaLabel, fmaOwed, fmaSub, totalCosts, hasAgent, AGNT, agentPct,
  hoverCost, setHoverCost, notaryCosts, LA,
}: {
  Y: number; exportAmortPdf: () => void; officialAmort: () => Promise<void>; genOfficial: boolean; exportAmortCsv: () => void;
  amort: AmortRow[]; hoverRow: number | null; setHoverRow: SetState<number | null>; loanType: LoanType; propTypeLabel: string;
  isNewBuilding: boolean; propertyId: string; borrower: BorrowerType; SQM: number; areaLabel: string; fmaOwed: number;
  /** Πώς βγήκε ο φόρος: «Πρώτη κατοικία», «3,09% πάνω από 200.000€» ή «3,09% επί αξίας». */
  fmaSub: string;
  totalCosts: { tax: number; notary: number; landReg: number; legal: number; agent: number; other: number; total: number; downpayment: number; totalCash: number };
  hasAgent: boolean; AGNT: number; agentPct: string; hoverCost: number | null; setHoverCost: SetState<number | null>;
  notaryCosts: ReturnType<typeof calcNotaryFees>; LA: number;
}) {
  return (
    <>
      <Section title="Πίνακας αποπληρωμής" sub={`${Y*12} δόσεις αναλυτικά`} defaultOpen>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>
          <Btn variant="primary" onClick={exportAmortPdf}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Εκτύπωση / PDF
          </Btn>
          <Btn variant="primary" onClick={officialAmort} disabled={genOfficial} title="Επίσημο true-PDF με αριθμό εγγράφου και QR επαλήθευσης· κατάλληλο για τράπεζες, ΔΟΥ και φορείς">
            <ShieldCheck size={15}/>
            {genOfficial?'Δημιουργία…':'Επίσημο PDF'}
          </Btn>
          <Btn variant="secondary" onClick={exportAmortCsv}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Λήψη για Excel
          </Btn>
        </div>
        {/* Κύλιση με κολλημένη κεφαλίδα· ομοιόμορφοι λευκοί αριθμοί, γαλάζιο μόνο στη γραμμή που εξετάζεις */}
        {/* Ο ΤΕΛΕΥΤΑΙΟΣ ΧΕΙΡΟΠΟΙΗΤΟΣ ΠΙΝΑΚΑΣ ΤΟΥ ΤΑΜΠΛΟ. Εγραφε τη δική του
            κεφαλίδα, το δικό του κελί —έξι φορές το ίδιο `padding: 9px 14px`—
            και το δικό του κουτί με περίγραμμα. Παίρνει την `.po-table` με τη
            μεταλλαγή `tbl-sticky`, που κρατά την κεφαλίδα καρφωμένη όσο κυλούν
            οι τριακόσιες εξήντα δόσεις. Η γραμμή που αρχίζει νέο έτος κρατά το
            πιο σκούρο περίγραμμά της: είναι η μόνη πληροφορία που δεν βγαίνει
            από την κλάση. */}
        <div className="po-table-box" style={{maxHeight:268,overflow:'auto'}}>
          <table className="po-table tbl-sticky" style={{'--tbl-min':'480px'}}>
            <thead>
              <tr>
                {['Μήνας','Δόση','Κεφάλαιο','Τόκος','Υπόλοιπο','Συνολικοί τόκοι'].map(h=>(
                  <th key={h} scope="col" style={{textAlign:'right',borderBottom:'1px solid var(--border-default)',whiteSpace:'nowrap' as const}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {amort.map((row,i)=>{
                const on=hoverRow===i
                const yearStart=i>0&&row.month%12===1
                const cell:React.CSSProperties={color:on?'var(--accent)':'var(--text-primary)',borderTop:yearStart?'1px solid var(--border-default)':undefined,transition:'color 0.12s'}
                return (
                  <tr key={row.month}
                    onMouseEnter={()=>setHoverRow(i)} onMouseLeave={()=>setHoverRow(null)}
                    onTouchStart={()=>setHoverRow(i)} onTouchEnd={()=>setHoverRow(null)}
                    style={{background:on?'var(--bg-hover)':'transparent',transition:'background 0.12s'}}>
                    <td className="num" style={{...cell,fontWeight:on?600:400}}>{row.month}</td>
                    <td className="num" style={{...cell,fontWeight:on?700:600}}>{fmtEur(row.payment)}</td>
                    <td className="num" style={cell}>{fmtEur(row.principal)}</td>
                    <td className="num" style={cell}>{fmtEur(row.interest)}</td>
                    <td className="num" style={cell}>{fmtEur(row.balance)}</td>
                    <td className="num" style={cell}>{fmtEur(row.totalInterestPaid)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',marginTop:8,lineHeight:1.5,fontFamily: T.font.sans}}>Και οι {amort.length} δόσεις αναλυτικά. Κύλισε στον πίνακα· πέρασε τον δείκτη ή το δάχτυλο σε μια γραμμή για να δεις καθαρά τη δόση, το κεφάλαιο, τον τόκο, το υπόλοιπο και τους σωρευτικούς τόκους της.</p>
      </Section>

      <Section title="Απαραίτητα έγγραφα" sub={`${LOAN_TYPES[loanType].label} · ${propTypeLabel}`}>
        {/* ΔΥΟ ΣΤΗΛΕΣ ΠΟΥ ΔΕΝ ΜΠΟΡΟΥΣΑΝ ΝΑ ΖΥΓΙΣΟΥΝ, ΜΕΤΡΗΜΕΝΟ ΣΕ ΤΑΜΠΛΕΤΑ.
            Το πλέγμα ήταν `auto-fit` με ελάχιστο 240 εικονοστοιχεία. Στα 768 η
            ενότητα δίνει 712 εικονοστοιχεία περιεχομένου, δηλαδή ακριβώς ΔΥΟ
            ίσες στήλες των 350. Αριστερά η λίστα των γενικών δικαιολογητικών:
            κεφαλίδα, μπάρα προόδου και έξι σειρές που οι πέντε σηκώνουν δεύτερη
            γραμμή «Από:», περίπου 350 εικονοστοιχεία ύψος. Δεξιά δύο ως τρία
            μονόγραμμα πλακίδια του τύπου δανειολήπτη συν μια σημείωση φόρου
            μέσα σε κουτί, 145 ως 185. Δηλαδή 165 ως 205 εικονοστοιχεία κενά
            στο κάτω μισό της δεξιάς στήλης, σε κάθε τύπο δανείου.

            ΤΟ ΠΛΑΤΟΣ ΔΕΝ ΤΟ ΔΙΟΡΘΩΝΕΙ. Το ύψος μιας στήλης το ορίζει το ΠΛΗΘΟΣ
            των σειρών της, όχι τα εικονοστοιχεία της: όποια αναλογία κι αν
            πάρουν οι δύο στήλες, η μία μένει τεσσάρων ως εφτά σειρών και η
            άλλη δύο ως τριών. Ούτε ροή τύπου masonry, που θα έκοβε τη λίστα
            από την κεφαλίδα και την μπάρα προόδου της· και η σειρά του
            πληκτρολογίου θα άλλαζε στήλη στη μέση της λίστας. Ούτε μοίρασμα
            των στοιχείων ανά πλήθος: αριστερά είναι λίστα που τικάρεται και
            θυμάται, δεξιά είναι αναφορά που δεν τικάρεται. Ενα στοιχείο που
            αλλάζει πλευρά αλλάζει και τον παρονομαστή της προόδου.

            ΟΙ ΔΥΟ ΟΜΑΔΕΣ ΔΕΝ ΕΙΝΑΙ ΕΠΙΛΟΓΕΣ, ΕΙΝΑΙ ΣΤΑΔΙΑ: τα γενικά · κι
            επιπλέον όσα ζητά ο τύπος του δανειολήπτη. Μπαίνουν λοιπόν η μία
            κάτω από την άλλη σε ΟΛΟ το πλάτος, χωρισμένες με λεπτή γραμμή. Τα
            δύο ως τρία πλακίδια απλώνονται σε ευέλικτη ροή που μεγαλώνει: όσα
            χωρούν στη σειρά τη γεμίζουν και το τελευταίο πιάνει το υπόλοιπο
            πλάτος, οπότε δεν μένει τρύπα σε κανένα πλάτος οθόνης. Στα 712
            χωρούν και τα τρία σε μία σειρά και η ενότητα κλείνει γύρω στα 445
            χωρίς κανένα κενό.

            ΚΑΙ Η ΣΗΜΕΙΩΣΗ ΦΟΡΟΥ ΒΓΗΚΕ ΑΠΟ ΤΟ ΚΟΥΤΙ ΤΗΣ, όπως είχαν βγει και οι
            ασφάλειες παρακάτω: μία αράδα δεν χρειάζεται φόντο, περίγραμμα και
            γέμισμα. Πάει στη δεξιά άκρη της κεφαλίδας της ομάδας, εκεί ακριβώς
            που η λίστα από πάνω γράφει «3/6 έτοιμα». Δύο κεφαλίδες με την ίδια
            τυπογραφία, ετικέτα αριστερά και μετα-πληροφορία δεξιά· το κείμενο
            δεν άλλαξε λέξη. */}
        <DocChecklist
          compact
          docs={isNewBuilding
            ? [...LOAN_TYPES[loanType].docs, { name:'Άδεια οικοδομής και βεβαίωση ΦΠΑ', where:'Πολεοδομία' }]
            : LOAN_TYPES[loanType].docs}
          storageKey={`${propertyId}:calc:${loanType}${isNewBuilding?':new':''}`}
          title="Γενικά δικαιολογητικά"/>
        {(()=>{
          const borrowerDocs:string[] = borrower==='professional'?['Φορολογικές δηλώσεις δύο ετών','Βεβαίωση δραστηριότητας ΔΟΥ']
            : borrower==='company'?['Καταστατικό','Ισολογισμοί τριών ετών','Απόφαση διοικητικού συμβουλίου']
            : borrower==='military'?['Βεβαίωση υπηρεσίας','Μισθολογική κατάσταση']
            : borrower==='abroad'?['Αποδεικτικό κατοικίας εξωτερικού','Εισοδήματα ξένης χώρας','Επίσημες μεταφράσεις']
            : ['Μισθοδοτικές τριών μηνών','Εκκαθαριστικό σημείωμα']
          return (
            <div style={{marginTop:14,paddingTop:12,borderTop:'1px solid var(--border-subtle)'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap',marginBottom:10}}>
                <p style={{fontSize: 'var(--fs-xs)',fontWeight:700,color:'var(--text-secondary)',fontFamily: T.font.sans,textTransform:'uppercase',letterSpacing:'0.06em'}}>Ανά τύπο δανειολήπτη</p>
                <span style={{fontSize:12,color:'var(--text-tertiary)',fontFamily: T.font.sans,lineHeight:1.5}}>{BORROWER_PROFILES[borrower].tax_benefits}</span>
              </div>
              <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                {borrowerDocs.map((d,i)=>(
                  <div key={i} style={{flex:'1 1 220px',minWidth:0,display:'flex',alignItems:'center',gap:10,padding:'8px 11px',borderRadius:10,background:'var(--bg-surface)',border:'1px solid var(--border-subtle)'}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" style={{flexShrink:0}} aria-hidden="true"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span style={{fontSize: 'var(--fs-base)',color:'var(--text-primary)',fontFamily: T.font.sans,fontWeight:500}}>{d}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}
      </Section>

      <div style={cardStyle}>
        <SectionLabel label="Πλήρης ανάλυση κόστους απόκτησης" right={<span style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',fontFamily: T.font.sans}}>{propTypeLabel}{SQM>0?` · ${SQM}τ.μ.`:''} · {areaLabel}</span>}/>
        {/* ΟΚΤΩ ΚΟΣΤΗ, ΤΕΣΣΕΡΑ ΚΑΙ ΤΕΣΣΕΡΑ ΚΑΙ ΟΛΑ ΜΕ ΤΗΝ ΙΔΙΑ ΓΕΩΜΕΤΡΙΑ.
            Ήταν σειρές «ετικέτα αριστερά, ποσό δεξιά» με `space-between`: όταν η
            ετικέτα τύλιγε σε δεύτερη γραμμή, το ποσό κολλούσε πάνω της χωρίς
            κενό («Συμβολαιογραφικά2.128,00€») και κάθε πλακίδιο έβγαινε άλλο
            ύψος. Τα ποσά δεν ήταν ούτε σε κοινή κατακόρυφο: το μάτι τα διάβαζε
            ένα-ένα αντί να τα συγκρίνει.

            Στοιβαγμένο: ετικέτα, ποσό, εξήγηση. Οκτώ ίδια πλακίδια, οκτώ ποσά
            στην ίδια κατακόρυφο, καμία σύγκρουση όσο κι αν τυλίξει η ετικέτα. */}
        {/* ═══ ΕΞΙ ΚΟΣΤΗ ΚΑΙ ΔΥΟ ΑΘΡΟΙΣΜΑΤΑ ΕΙΧΑΝ ΤΟ ΙΔΙΟ ΣΧΗΜΑ, ΣΤΟ ΙΔΙΟ ΠΛΕΓΜΑ
            Οκτώ πανομοιότυπα πλακίδια σε δύο σειρές των τεσσάρων: τα έξι πρώτα
            είναι ΜΕΡΗ (φόρος, συμβολαιογραφικά, κτηματολόγιο, δικηγόρος, μεσίτης,
            λοιπά) και τα δύο τελευταία είναι το ΑΘΡΟΙΣΜΑ τους. Το «Σύνολο εξόδων
            αγοράς» καθόταν δίπλα στο «Λοιπά 120,00€» με την ίδια κορνίζα, το ίδιο
            φόντο και δύο εικονοστοιχεία διαφορά στο μέγεθος του αριθμού. Ενα
            άθροισμα που μοιάζει με προσθετέο δεν είναι ιεραρχία, είναι λίστα.

            Τα μέρη πάνε σε τρεις στήλες (τρία και τρία, καμία τρύπα) και τα δύο
            αθροίσματα σε δική τους σειρά κάτω από λεπτή γραμμή, με το φόντο της
            επιφάνειας αντί για ανασηκωμένο: διαβάζονται ως ΣΥΝΟΨΗ και όχι ως δύο
            ακόμη έξοδα. Και δεν σηκώνονται στο πέρασμα του δείκτη, γιατί δεν
            είναι στοιχεία που εξετάζεις ένα ένα. */}
        <div {...fixedCols(3, 8, 'stretch')} style={{...fixedCols(3, 8, 'stretch').style,marginBottom:12}}>
          {[
            {label:'Φόρος μεταβίβασης (ΦΜΑ)',value:fmaOwed===0?'Απαλλαγή':fmtEur(fmaOwed),sub:fmaSub},
            {label:'Συμβολαιογραφικά',value:fmtEur(totalCosts.notary),sub:'Κλιμακωτή αμοιβή'},
            {label:'Κτηματολόγιο και εγγραφή',value:fmtEur(totalCosts.landReg),sub:'0,475% επί αξίας'},
            {label:'Δικηγόρος ελέγχου τίτλων',value:fmtEur(totalCosts.legal),sub:'Έλεγχος + παρουσία'},
            {label:'Αμοιβή μεσίτη',value:hasAgent?fmtEur(AGNT):fe(0),sub:hasAgent?`${agentPct}%`:'Ανενεργό'},
            {label:'Λοιπά',value:fmtEur(totalCosts.other),sub:'Φόρος ενεγγύησης'},
          ].map((item,i:number)=>{
            const on=hoverCost===i
            return (
            <div key={item.label}
              onMouseEnter={()=>setHoverCost(i)} onMouseLeave={()=>setHoverCost(null)}
              onTouchStart={()=>setHoverCost(i)} onTouchEnd={()=>setHoverCost(null)}
              style={{display:'flex',flexDirection:'column',gap:6,padding:'12px 14px',borderRadius:T.radius.inner,background:'var(--bg-elevated)',border:`1px solid ${on?'var(--border-default)':'var(--border-subtle)'}`,transition:'border-color 0.15s, box-shadow 0.15s, transform 0.15s',transform:on?'translateY(-1px)':'none',
              boxShadow:on?'var(--elev-2)':'none'}}>
              <p style={{fontSize:12,color:'var(--text-secondary)',fontWeight:500,fontFamily: T.font.sans,lineHeight:1.35}}>{item.label}</p>
              <p style={{fontSize:15,fontFamily: T.font.sans,fontVariantNumeric:'tabular-nums',color:on?'var(--accent)':'var(--text-primary)',fontWeight:600,lineHeight:1,marginTop:'auto',transition:'color 0.15s'}}>{item.value}</p>
              <p style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',fontFamily: T.font.sans,lineHeight:1.35}}>{item.sub}</p>
            </div>
            )
          })}
        </div>
        <div {...fixedCols(2, 8, 'stretch')} style={{...fixedCols(2, 8, 'stretch').style,marginBottom:14,paddingTop:12,borderTop:'1px solid var(--border-subtle)'}}>
          {[
            {label:'Σύνολο εξόδων αγοράς',value:fmtEur(totalCosts.total),sub:'Εκτός δόσεων',strong:false},
            {label:'Απαιτούμενα ίδια κεφάλαια',value:fmtEur(totalCosts.totalCash),sub:'Προκαταβολή + έξοδα',strong:true},
          ].map(item=>(
            <div key={item.label} style={{display:'flex',flexDirection:'column',gap:6,padding:'12px 14px',borderRadius:T.radius.inner,background:'var(--bg-surface)',border:`1px solid ${item.strong?'var(--border-default)':'var(--border-subtle)'}`}}>
              <p style={{fontSize:12,color:'var(--text-secondary)',fontWeight:500,fontFamily: T.font.sans,lineHeight:1.35}}>{item.label}</p>
              <p style={{fontSize:item.strong?20:17,fontFamily: T.font.sans,fontVariantNumeric:'tabular-nums',color:'var(--text-primary)',fontWeight:700,lineHeight:1,marginTop:'auto'}}>{item.value}</p>
              <p style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',fontFamily: T.font.sans,lineHeight:1.35}}>{item.sub}</p>
            </div>
          ))}
        </div>
        {/* Πώς σπάει η αμοιβή του συμβολαιογράφου: ετικέτα αριστερά, ποσό στη
            δεξιά άκρη, ίδια κατακόρυφος με τα ποσά των πλακιδίων από πάνω. */}
        <div style={{padding:'12px 14px',background:'var(--bg-surface)',border:'1px solid var(--border-subtle)',borderRadius:T.radius.inner,marginBottom:10}}>
          <p style={{...labelStyle,marginBottom:8}}>Ανάλυση συμβολαιογραφικών</p>
          {notaryCosts.breakdown.map(line=>(
            <div key={line.l} style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:14,marginTop: 4}}>
              <span style={{fontSize:12,color:'var(--text-secondary)',lineHeight:1.5,fontFamily: T.font.sans}}>{line.l}</span>
              <span style={{fontSize:12,color:'var(--text-primary)',fontFamily: T.font.sans,fontVariantNumeric:'tabular-nums',fontWeight:600,whiteSpace:'nowrap' as const}}>{fmtEur(line.v)}</span>
            </div>
          ))}
        </div>
        {/* Οι ασφάλειες δεν είναι έξοδο αγοράς: τρέχουν κάθε χρόνο όσο ζει το
            δάνειο. Η παύλα του εύρους («100–300€») διαβαζόταν σαν αφαίρεση.

            ΚΑΙ ΤΟ ΚΟΥΤΙ ΤΟΥΣ ΕΦΥΓΕ. Μία πρόταση δεν χρειάζεται ανασηκωμένο φόντο,
            περίγραμμα και δεκατέσσερα εικονοστοιχεία περιθώριο: μέσα σε κάρτα που
            έχει ήδη οκτώ πλακίδια και έναν ένθετο πίνακα, το τέταρτο πλαίσιο δεν
            προσθέτει έμφαση — προσθέτει βάρος. Μένει γραμμή κειμένου, δίπλα στην
            αδελφή της που λέει την πηγή. */}
        <p style={{fontSize:12,color:'var(--text-secondary)',fontFamily: T.font.sans,lineHeight:1.7,marginBottom:6}}>Ετήσιο κόστος ασφαλειών · Κατοικίας, υποχρεωτική: από {fmtEur(100)} έως {fmtEur(300)} · Ζωής: περίπου {fmtEur(LA*0.001)}</p>
        <p style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',lineHeight:1.6,fontFamily: T.font.sans}}>
          Εκτιμήσεις βάσει δεδομένων χρήστη. Πηγή:{' '}
          <a href={AADE_HOME} target="_blank" rel="noreferrer" title="ΑΑΔΕ: Ανεξάρτητη Αρχή Δημοσίων Εσόδων" style={{color:'var(--accent)',textDecoration:'none',fontWeight:500}}>ΑΑΔΕ</a>
        </p>
      </div>
    </>
  );
}
