'use client'
// ═══════════════════════════════════════════════════════════════════════════
// Ο ΟΔΗΓΟΣ ΔΑΝΕΙΟΥ: ΠΩΣ ΔΟΥΛΕΥΕΙ, ΤΙ ΧΡΕΙΑΖΕΤΑΙ, ΤΙ ΠΡΟΣΕΧΕΙΣ
// ═══════════════════════════════════════════════════════════════════════════
import { fp } from '@/lib/core/format'
import { AADE_HOME } from '@/lib/tax/aade'
import { T, fixedCols, Btn } from '@/components/Theme'
import { greekWhen, seriesPage, ECB_SERIES } from '@/lib/market/ecb'
import { LOAN_TYPES, rateRange, GLOSSARY, EURIBOR_HISTORY, SERVICERS_GUIDE, fmtPct } from '../TabLoanData'
import { hy } from '@/components/Hyphen'
import Glossary from '../Glossary'
import { InfoDot, InfoChip } from '../UIComponents'
import { labelStyle } from '../LoanShared'
import { LensPanel, MiniSection, CatRow, InlineLink, LinkCard, EuriborArea } from './Bits'
import type { LoanProps, LoanState } from './useLoan'

export function LoanGuide({ advType, openCalcDocs, market, profile }: Pick<LoanProps & LoanState, 'advType' | 'openCalcDocs' | 'market' | 'profile'>) {
  return (
    <LensPanel title="Οδηγός δανείου" subtitle="Πώς λειτουργεί η αγορά, τι ζητά η τράπεζα και πού βρίσκεις την πηγή">
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        {/* Ο οδηγός του τύπου δανείου καθόταν ΜΕΣΑ στην ανάλυση, με τίτλο
            «Οδηγός, …» — δηλαδή ένα πάνελ ονόματι «Οδηγός» μέσα σε φακό που
            δεν λεγόταν έτσι, ενώ ο φακός «Οδηγός» υπάρχει. Είναι αναφορά, όχι
            ανάγνωση του σεναρίου σου: τυπικό επιτόκιο αγοράς, ανώτατο δάνειο
            προς αξία, φορολογικά και δικαιολογητικά. Πρώτο εδώ, γιατί είναι
            το μόνο κομμάτι της γνώσης που αλλάζει με τον τύπο του δανείου. */}
        {/* ═══ Ο ΟΔΗΓΟΣ ΤΟΥ ΤΥΠΟΥ ΔΑΝΕΙΟΥ ═══════════════════════════════
            ΤΡΙΑ ΙΔΙΑ ΚΟΥΤΙΑ ΓΙΑ ΤΡΕΙΣ ΔΙΑΦΟΡΕΤΙΚΕΣ ΔΟΥΛΕΙΕΣ. Δύο αριθμοί
            και μια νομική σημείωση φορούσαν το ίδιο ακριβώς πλαίσιο, το
            ίδιο φόντο και την ίδια ακτίνα: η κάρτα διαβαζόταν ως τρία
            όμοια πράγματα, ενώ είναι μια αγορά, ένα όριο και ένας φόρος.
            Τώρα είναι ΜΙΑ κατάσταση στοιχείων — ετικέτα πάνω, τιμή κάτω,
            λεπτή γραμμή ανάμεσα. Το πλαίσιο φεύγει, η ιεραρχία μένει.

            ΚΑΙ Η ΠΑΡΑΠΟΜΠΗ ΗΤΑΝ ΚΕΙΜΕΝΟ. Η τελευταία γραμμή έλεγε πού
            βρίσκονται τα δικαιολογητικά· δεν πήγαινε εκεί. Τώρα ανοίγει
            τον φακό «Πίνακας και έγγραφα» του Υπολογιστή και κυλά ως εκεί
            και ο τίτλος του κουμπιού είναι το όνομα του προορισμού. ═══ */}
        {(()=>{ const info=LOAN_TYPES[advType]; const facts=[
          {k:'Τυπικό επιτόκιο αγοράς',v:rateRange(info)},
          {k:'Δάνειο προς αξία έως',  v:fp(info.typical_ltv)},
        ]; return (
          <MiniSection title={info.label} meta={<span style={{fontSize:12,color:'var(--text-tertiary)',fontFamily: T.font.sans,whiteSpace:'nowrap' as const}}>{info.docs.length} δικαιολογητικά</span>}>
            <p className="po-prose po-just" style={{fontSize: 'var(--fs-base)',color:'var(--text-secondary)',fontFamily: T.font.sans,margin:'0 0 4px'}}>{hy(<>{info.desc}. {info.notes}.</>)}</p>
            {/* Ευέλικτη ροή, όχι πλέγμα auto-fit: σε φαρδιά κάρτα το auto-fit
                θα άνοιγε τρίτη κενή στήλη και η γραμμή θα σταματούσε στη μέση. */}
            <div style={{display:'flex',flexWrap:'wrap'}}>
              {facts.map(f=>(
                <div key={f.k} style={{flex:'1 1 190px',minWidth:0,padding:'13px 22px 13px 0',borderTop:'1px solid var(--border-subtle)'}}>
                  <div style={{...labelStyle,marginBottom:6}}>{f.k}</div>
                  <div style={{fontSize:18,fontWeight:600,color:'var(--text-primary)',fontFamily: T.font.num,fontVariantNumeric:'tabular-nums',letterSpacing:'-0.02em'}}>{f.v}</div>
                </div>
              ))}
              <div style={{flex:'1 1 100%',padding:'13px 0 15px',borderTop:'1px solid var(--border-subtle)'}}>
                <div style={{...labelStyle,marginBottom:6}}>Φορολογικά και νομικά</div>
                <p style={{fontSize: 'var(--fs-base)',color:'var(--text-secondary)',lineHeight:1.55,fontFamily: T.font.sans}}>{info.tax_note}</p>
              </div>
            </div>
            <Btn variant="secondary" onClick={openCalcDocs}>
              Απαραίτητα έγγραφα
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            </Btn>
          </MiniSection>
        ); })()}
        {/* Ο ΠΑΡΑΓΡΑΦΟΣ ΠΟΥ ΕΔΕΙΧΝΕ ΤΟ ΑΜΕΣΩΣ ΑΠΟ ΚΑΤΩ ΕΦΥΓΕ. Ελεγε «Δες πρώτα
            "Πώς λειτουργεί" και "Γιατί απορρίπτεται μια αίτηση"» — δύο τίτλους
            που ο αναγνώστης είχε ήδη μπροστά του, στη σειρά που τους ανέφερε.
            Και η επιφύλαξη «όχι νομική συμβουλή» γραφόταν ήδη στο τέλος της
            Στρατηγικής. Οδηγίες ανάγνωσης για μια λίστα δέκα σειρών είναι
            θόρυβος· η σειρά των τίτλων είναι η οδηγία. */}
        <MiniSection title="Πώς λειτουργεί ένα στεγαστικό δάνειο στην Ελλάδα">
          {[
            {step:1,title:'Προεπιλογή και προετοιμασία',time:'1 έως 2 εβδομάδες',desc:'Υπολόγισε πόσο αντέχεις και μάζεψε τα οικονομικά σου στοιχεία πριν μιλήσεις σε τράπεζα. Το «Σπίτι μου ΙΙ» έκλεισε για νέες αιτήσεις στις 31/05/2026.',tip:'Ξεκίνα από τη δόση που αντέχεις, όχι από το ποσό που θέλεις: η τράπεζα κρίνει με τον δείκτη δόσης προς εισόδημα.',warning:'Οι οφειλές σε ΔΟΥ ή ΕΦΚΑ δεν μπλοκάρουν αυτόματα την έγκριση. Η ενημερότητα ζητείται στο συμβόλαιο, κυρίως από τον πωλητή και εκδίδεται ακόμη και με οφειλές με παρακράτηση από το τίμημα.',url:null},
            {step:2,title:'Συλλογή εγγράφων',time:'1 έως 3 εβδομάδες',desc:'Εκκαθαριστικά, μισθοδοτικές 3 μηνών, Ε9, πιστοποιητικό οικογενειακής κατάστασης. Ελεύθεροι επαγγελματίες: φορολογικές 2 ετών.',tip:'Ζήτησε κάθε έγγραφο εκ των προτέρων, η τράπεζα συχνά ζητά επιπλέον κατά τη διαδικασία.',warning:'Τα Ε1/Ε9 από ΑΑΔΕ, βεβαιώσου ότι είναι ενημερωμένα.',url:null},
            {step:3,title:'Αίτηση στην τράπεζα',time:'1 ημέρα',desc:'Κατάθεσε αίτηση σε δύο ή τρεις τράπεζες και σύγκρινε γραπτές προσφορές, όχι προφορικές.',tip:'Ζήτησε το τυποποιημένο ευρωπαϊκό δελτίο πληροφοριών (ΕΣΔΠ, ESIS) γραπτώς. Ο ν.4438/2016 προβλέπει προθεσμία μελέτης ανάμεσα στη δεσμευτική προσφορά και την υπογραφή: μη δεσμευτείς αυθημερόν.',warning:'Μην υπογράφεις τίποτα την πρώτη μέρα. Μελέτησε το τυποποιημένο ευρωπαϊκό δελτίο πληροφοριών (ESIS).',url:'https://www.bankofgreece.gr'},
            {step:4,title:'Εκτίμηση ακινήτου και νομικός έλεγχος',time:'1 έως 3 εβδομάδες',desc:'Πιστοποιημένος εκτιμητής (RICS ή ΤΕΕ) αξιολογεί το ακίνητο. Νομικός έλεγχος τίτλων στο Κτηματολόγιο.',tip:'Αν η εκτίμηση είναι χαμηλότερη από την τιμή αγοράς, το δάνειο προς αξία υπολογίζεται επί αυτής, ενδέχεται να χρειαστείς επιπλέον κεφάλαια.',warning:'Αυθαίρετα (κλεισμένοι ημιυπαίθριοι, αλλαγές χωρίς άδεια) εμποδίζουν τη μεταβίβαση: ο ν.4495/2017 απαιτεί βεβαίωση μηχανικού επί ποινή ακυρότητας. Δεν είναι οριστικό εμπόδιο, τακτοποιούνται πρώτα. Ζήτησε τεχνικό έλεγχο.',url:'https://www.ktimatologio.gr'},
            {step:5,title:'Έγκριση δανείου',time:'3 έως 10 εργάσιμες',desc:'Η τράπεζα αξιολογεί εισόδημα, Τειρεσία, εκτίμηση και νομικά. Η διάρκεια ισχύος της έγκρισης δεν είναι ενιαία, την ορίζει κάθε τράπεζα: ρώτησε την ημέρα που θα την πάρεις.',tip:'Σε απόρριψη ζήτησε γραπτώς τον λόγο. Επανεξέτασε μετά από έξι μήνες ή άλλαξε τράπεζα.',warning:'Σφραγισμένη επιταγή που δεν εξοφλήθηκε μέσα σε 30 ημέρες καταχωρείται στον Τειρεσία, όπως και ανεξόφλητες οφειλές πάνω από 1.000€.',url:'https://www.tiresias.gr'},
            {step:6,title:'Συμβόλαιο και εκταμίευση',time:'1 έως 2 εβδομάδες',desc:'Αγοραπωλητήριο ενώπιον συμβολαιογράφου. Η εκταμίευση γίνεται αφού εγγραφεί η προσημείωση υποθήκης και μεταγραφεί το συμβόλαιο στο Κτηματολόγιο.',tip:'Νεόδμητα: απαιτείται ΠΕΑ για τη μεταβίβαση.',warning:'Η φορολογική ενημερότητα ισχύει δύο μήνες, ή έναν με ρυθμισμένες οφειλές. Η ασφαλιστική ισχύει έξι μήνες, ή δύο με ρύθμιση. Συντόνισε την έκδοση με την ημέρα υπογραφής.',url:null},
          ].map((step,i,arr)=>(
            <div key={i} style={{display:'flex',gap:16,alignItems:'flex-start',paddingBottom:20,borderBottom:i<arr.length-1?'1px solid var(--border-subtle)':'none',marginBottom:i<arr.length-1?20:0}}>
              <div style={{width:32,height:32,borderRadius:'50%',background:'var(--bg-surface)',border:'1px solid var(--border-default)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <span style={{fontSize: 'var(--fs-base)',fontFamily: T.font.sans,fontVariantNumeric:'tabular-nums',color:'var(--text-secondary)',fontWeight:600}}>{step.step}</span>
              </div>
              <div style={{flex:1,minWidth:0}}>
                {/* Η ΣΥΜΒΟΥΛΗ ΗΤΑΝ ΓΡΑΜΜΕΝΗ ΚΑΙ ΔΕΝ ΕΜΠΑΙΝΕ ΠΟΥΘΕΝΑ. Έξι
                    συμβουλές, μία ανά βήμα, καμία στην οθόνη: ο κώδικας τις
                    κουβαλούσε και ο χρήστης δεν τις έβλεπε. Ζουν πίσω από την
                    κουκκίδα του τίτλου, χωρίς να προσθέτουν ύψος στη σειρά. */}
                <div style={{display:'flex',alignItems:'center',gap: 8,marginBottom:6,flexWrap:'wrap'}}>
                  <p style={{fontSize:14,fontWeight:600,fontFamily: T.font.sans,color:'var(--text-primary)',letterSpacing:'-0.01em'}}>{step.title}</p>
                  <span style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',background:'var(--bg-surface)',padding:'2px 8px',borderRadius: T.radius.chip,border:'1px solid var(--border-subtle)',fontFamily: T.font.sans,fontWeight:500,whiteSpace:'nowrap' as const}}>{step.time}</span>
                  <InfoDot text={step.tip}/>
                </div>
                <p className="po-prose po-just" style={{fontSize: 'var(--fs-base)',color:'var(--text-secondary)',fontFamily: T.font.sans}}>{hy(<>{step.desc}</>)}</p>
                {/* Η ΠΡΟΕΙΔΟΠΟΙΗΣΗ ΔΙΑΒΑΖΟΤΑΝ ΣΑΝ ΔΕΥΤΕΡΗ ΠΡΟΤΑΣΗ ΤΗΣ
                    ΠΕΡΙΓΡΑΦΗΣ. Ίδιο γκρι, ίδια στοίχιση, ένα εικονοστοιχείο
                    διαφορά στο μέγεθος: τίποτα δεν έλεγε ότι εδώ μπλοκάρει η
                    αίτηση. Μία λέξη μπροστά κάνει τη διαφορά. */}
                <p style={{fontSize:12,color:'var(--text-tertiary)',lineHeight:1.55,marginTop:6,fontFamily: T.font.sans}}><strong style={{color:'var(--text-secondary)',fontWeight:600}}>Προσοχή:</strong> {step.warning}{step.url&&<> · <InlineLink href={step.url}>πηγή</InlineLink></>}</p>
              </div>
            </div>
          ))}
        </MiniSection>

        <MiniSection title="Γιατί απορρίπτεται μια αίτηση">
          <div style={{display:'flex',flexDirection:'column'}}>
            {[
              {title:'Δυσμενή στοιχεία στον Τειρεσία',desc:'Στο αρχείο αθέτησης υποχρεώσεων καταχωρείται σφραγισμένη επιταγή που δεν εξοφλήθηκε μέσα σε 30 ημέρες και ανεξόφλητες οφειλές πάνω από 1.000€. Η καθυστέρηση δόσης δεν καταχωρείται από μόνη της: τα δάνεια περνούν στο αρχείο συγκέντρωσης κινδύνων, που βλέπουν οι τράπεζες ούτως ή άλλως. Τακτοποίησε τις οφειλές πριν την αίτηση.',url:'https://www.tiresias.gr'},
              {title:'Χαμηλό εισόδημα ή υψηλός δείκτης δόσης',desc:'Όρια της Τράπεζας της Ελλάδος (ΠΕΕ 227/1/2024, ισχύς από 1/1/2025): δόση έως 50% του εισοδήματος για όσους δανείζονται για πρώτη φορά, 40% για τους υπόλοιπους.',url:'https://www.bankofgreece.gr'},
              {title:'Αυθαίρετα στο ακίνητο',desc:'Αλλαγές χωρίς άδεια (βεράντα, πατάρι, αλλαγή χρήσης) μπλοκάρουν τη μεταβίβαση ή μειώνουν την εκτίμηση.',url:'https://www.ktimatologio.gr'},
              {title:'Προβλήματα τίτλων',desc:'Ακαθόριστοι τίτλοι, αδήλωτα σε Ε9, εκκρεμείς κληρονομιές. Ο νομικός έλεγχος διαρκεί εβδομάδες.',url:null},
              {title:'Χρέη σε ΔΟΥ ή ΕΦΚΑ',desc:'Απαιτείται φορολογική και ασφαλιστική ενημερότητα για υπογραφή συμβολαίου.',url:AADE_HOME},
              {title:'Δείκτης δανείου προς αξία πάνω από το όριο',desc:'Όρια της Τράπεζας της Ελλάδος: έως 90% της αξίας για όσους δανείζονται για πρώτη φορά, έως 80% για τους υπόλοιπους. Δεν είναι προνόμιο κρατικού προγράμματος, ισχύει σε κάθε στεγαστικό. Χρειάζεσαι ίδια κεφάλαια για τη διαφορά και για τα έξοδα.',url:'https://www.bankofgreece.gr'},
            ].sort((a,b)=>a.title.localeCompare(b.title,'el')).map((item,i,a)=>(
              <CatRow key={item.title} title={item.title} desc={item.desc} url={item.url} linkLabel="έλεγχος" last={i===a.length-1}/>
            ))}
          </div>
        </MiniSection>

        {/* Ειδικές κατηγορίες δανειοληπτών, σε συμπτυγμένη μορφή */}
        <MiniSection title="Ειδικές κατηγορίες δανειοληπτών">
          <div style={{display:'flex',flexDirection:'column'}}>
            {[
              {title:'Ένοπλες Δυνάμεις',desc:'Στεγαστική υποστήριξη σε εν ενεργεία στελέχη δίνουν ο Αυτόνομος Οικοδομικός Οργανισμός Αξιωματικών (ΑΟΟΑ) και το Ταμείο Παρακαταθηκών και Δανείων, με δικούς τους όρους. Το σταθερό εισόδημα βοηθά και στην τραπεζική αξιολόγηση.',url:'https://www.aooa.gr'},
              {title:'Κάτοικοι εξωτερικού',desc:'Δάνειο έως 55% ή 70% της αξίας. Επίσημες μεταφράσεις, αποδεικτικό κατοικίας, εισοδήματα ξένης χώρας.',url:'https://www.nbg.gr/el/idiwtes/daneia/stegastika-daneia'},
              {title:'Νέοι 25 έως 50 ετών',desc:'Σπίτι μου ΙΙ: το μισό δάνειο άτοκο. Εισόδημα έως 25.000,00€ για άγαμο και 35.000,00€ για έγγαμους, συν 5.000,00€ ανά τέκνο. Ακίνητο έως 150 τ.μ.',url:'https://greece20.gov.gr/home-loans/'},
              {title:'Ελεύθεροι επαγγελματίες',desc:'Μέσος όρος εισοδήματος διετίας. Δάνειο έως 65–70% της αξίας. Συνέπεια στις δηλώσεις.',url:AADE_HOME},
              {title:'Πολύτεκνοι και τρίτεκνοι',desc:'+50% επιδότηση επιτοκίου στο Σπίτι μου ΙΙ. Εισόδημα έως 45.000€ (2 παιδιά) ή 50.000€ (3+).',url:'https://greece20.gov.gr/home-loans/'},
              {title:'Εταιρείες και επαγγελματικά',desc:'Ισολογισμοί 3 ετών, απόφαση διοίκησης, προσωπική εγγύηση. Πλήρης έκπτωση τόκων.',url:'https://www.nbg.gr/el/epixeiriseis'},
            ].sort((a,b)=>a.title.localeCompare(b.title,'el')).map((cat,i,a)=>(
              <CatRow key={cat.title} title={cat.title} desc={cat.desc} url={cat.url} linkLabel="περισσότερα" last={i===a.length-1}/>
            ))}
          </div>
        </MiniSection>

        <MiniSection title="Ιστορικό Euribor τριμήνου, 2020 έως σήμερα" meta={/* Ο ΣΥΝΔΕΣΜΟΣ ΗΤΑΝ 13 ΕΙΚΟΝΟΣΤΟΙΧΕΙΑ ΨΗΛΟΣ. Κείμενο 11 σε γραμμή
                  χωρίς ύψος: στο κινητό ο στόχος αφής ήταν το ένα τρίτο των 44
                  που ζητά ο κανόνας· και δίπλα του κάθεται το βέλος που ανοίγει
                  την ενότητα — δηλαδή η αστοχία δεν ήταν «δεν άνοιξε», ήταν
                  «άνοιξε κάτι άλλο». Το ύψος έρχεται από την κλίμακα, που στο
                  κινητό γίνεται 44 από μόνη της· το κείμενο δεν μετακινείται,
                  γιατί η κεφαλίδα είναι ήδη ψηλότερη. */
                <a href="https://data.ecb.europa.eu" target="_blank" rel="noreferrer" style={{display:'inline-flex',alignItems:'center',minHeight:T.h.md,fontSize: 'var(--fs-xs)',color:'var(--accent)',textDecoration:'none',fontFamily: T.font.sans,fontWeight:500}}>Πηγή: Ευρωπαϊκή Κεντρική Τράπεζα</a>}>
          <EuriborArea data={EURIBOR_HISTORY}/>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(min(100%, 130px), 1fr))',gap:10,marginTop:14}}>
            {[
              {l:'Ιστορικό χαμηλό',v:fmtPct(Math.min(...EURIBOR_HISTORY.map(p=>p.val))),s:'2021'},
              {l:'Ιστορικό υψηλό',v:fmtPct(Math.max(...EURIBOR_HISTORY.map(p=>p.val))),s:'Οκτώβριος 2023'},
              {l:'Τρέχον',v:fmtPct(market.euribor_3m),s:market.provenance.euribor_3m?greekWhen(market.provenance.euribor_3m.asOf,market.provenance.euribor_3m.basis):'χωρίς ημερομηνία'},
              {l:'Μείωση από το ανώτατο',v:`-${fmtPct(Math.max(...EURIBOR_HISTORY.map(p=>p.val))-market.euribor_3m)}`,s:'από το 2023'},
            ].map(item=>(
              <div key={item.l} style={{background:'var(--bg-surface)',border:'1px solid var(--border-subtle)',borderRadius:10,padding:'11px 13px'}}>
                <p style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',textTransform:'uppercase' as const,letterSpacing:'0.05em',fontWeight:600,fontFamily: T.font.sans,marginBottom:6}}>{item.l}</p>
                <p style={{fontSize:16,fontFamily: T.font.sans,fontVariantNumeric:'tabular-nums',color:'var(--text-primary)',fontWeight:700,lineHeight:1}}>{item.v}</p>
                <p style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',marginTop:4,fontFamily: T.font.sans}}>{item.s}</p>
              </div>
            ))}
          </div>
          <p style={{fontSize:12,color:'var(--text-tertiary)',lineHeight:1.6,fontFamily: T.font.sans,marginTop:14}}>
            Δάνεια που δόθηκαν το 2021 με Euribor -0,55% έχουν σήμερα πραγματικό επιτόκιο περίπου {fmtPct(market.euribor_3m+1.5)}. Η Ευρωπαϊκή Κεντρική Τράπεζα μείωσε το επιτόκιο 8 φορές από τον Ιούνιο 2024.
          </p>
        </MiniSection>

        {/* Γλωσσάρι — σωστά ελληνικά, καθαρή λίστα ορισμών, ανάλογα με το προφίλ */}
        {/* ── Διαχειριστές (servicers) & κόκκινα δάνεια ── */}
        <MiniSection title="Δάνεια σε διαχειριστές και κόκκινα δάνεια">
          <p className="po-prose po-just" style={{fontSize:15,color:'var(--text-primary)',fontFamily: T.font.sans,fontWeight:500,letterSpacing:'-0.01em',marginBottom:8}}>{hy(<>{SERVICERS_GUIDE.lead}</>)}</p>
          <p className="po-prose po-just" style={{fontSize: 'var(--fs-base)',color:'var(--text-secondary)',lineHeight:1.7,fontFamily: T.font.sans,marginBottom:16}}>{hy(<>{SERVICERS_GUIDE.intro}</>)}</p>

          {/* Μαζεμένες σειρές· η επεξήγηση κρύβεται πίσω από ⓘ (όχι κατεβατό). */}
          <p style={{...labelStyle,marginBottom:10}}>Τα δικαιώματά σου</p>
          {/* Τέσσερα δικαιώματα, μία σειρά. Το `auto-fit` έβγαζε τρία και ένα
              σε οθόνη με zoom, γιατί το πλήθος στηλών του το ορίζει το
              διαθέσιμο πλάτος και όχι η λίστα. */}
          {/* ΙΣΟ ΥΨΟΣ, ΟΧΙ ΙΣΟ ΚΕΙΜΕΝΟ. Με στοίχιση στο κάτω άκρο, ένα δικαίωμα
              μιας γραμμής κάθεται χαμηλότερα από το διπλανό του των δύο και
              τα τέσσερα πλακίδια διαβάζονται σαν σκαλοπάτια. Τεντωμένα στο ίδιο
              ύψος, το κείμενο κεντράρεται και η σειρά είναι μία ευθεία. */}
          <div {...fixedCols(4, 8, 'stretch')} style={{...fixedCols(4, 8, 'stretch').style, marginBottom:T.sp.lg}}>
            {SERVICERS_GUIDE.rights.map(r=>(
              <InfoChip key={r.t} label={r.t} detail={r.d}
                icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>}/>
            ))}
          </div>

          <p style={{...labelStyle,marginBottom:10}}>Εργαλεία ρύθμισης και προστασίας</p>
          {/* Τρία εργαλεία, τρεις στήλες ίδιου ύψους: οι τρεις σύνδεσμοι
              «Επίσημη πηγή» κάθονται στην ίδια γραμμή βάσης, όσο άνισο κι αν
              είναι το κείμενο από πάνω τους. */}
          <div {...fixedCols(3, 12, 'stretch')} style={{...fixedCols(3, 12, 'stretch').style, marginBottom:T.sp.lg}}>
            {SERVICERS_GUIDE.tools.map(t=>(
              <div key={t.name} style={{background:'var(--bg-surface)',border:'1px solid var(--border-subtle)',borderRadius:T.radius.inner,padding:14,display:'flex',flexDirection:'column'}}>
                {/* Τίτλος κάρτας σε βάρος τίτλου. Στο 500 διαβαζόταν ίδιος με
                    το κείμενο από κάτω και οι τρεις κάρτες έμοιαζαν με τρεις
                    παραγράφους χωρίς επικεφαλίδα. */}
                <p style={{fontSize: 'var(--fs-base)',fontWeight:600,fontFamily: T.font.sans,color:'var(--text-primary)',lineHeight:1.4,marginBottom:6}}>{t.name}</p>
                {/* ΟΡΙΣΜΟΣ ΘΕΣΜΟΥ ΜΕΣΑ ΣΕ ΣΤΗΛΗ, ΜΕ ΡΙΓΜΕΝΗ ΑΚΡΗ. Τρεις στήλες
                    με κενό 12 κι γέμισμα κάρτας 14: στα 1440 το κείμενο πέφτει
                    περίπου στα 335. Ο Εξωδικαστικός γράφει 218 χαρακτήρες στα
                    12 — τέσσερις γραμμές, τρεις ακόμη κι στα 1920. Η στοίχιση
                    κλείνει τη δεξιά άκρη και στις τρεις κάρτες μαζί· το `hy()`
                    μπαίνει εδώ, στην απόδοση, ώστε ο ορισμός στο TabLoanData
                    να μείνει καθαρό κείμενο. */}
                <p className="po-just" style={{fontSize:12,color:'var(--text-secondary)',lineHeight:1.55,fontFamily: T.font.sans,marginBottom:10}}>{hy(t.d)}</p>
                <div style={{display:'flex',flexDirection:'column',gap: 4,marginBottom:10}}>
                  {t.facts.map((f,i)=>(
                    <div key={i} style={{display:'flex',alignItems:'flex-start',gap: 8}}>
                      <span style={{width:5,height:5,borderRadius:'50%',background:'var(--border-default)',flexShrink:0,marginTop:6}}/>
                      <span style={{fontSize:12,color:'var(--text-secondary)',lineHeight:1.5,fontFamily: T.font.sans}}>{f}</span>
                    </div>
                  ))}
                </div>
                <span style={{marginTop:'auto',fontSize:12,fontFamily: T.font.sans}}><InlineLink href={t.url}>Επίσημη πηγή</InlineLink></span>
              </div>
            ))}
          </div>

          <p style={{...labelStyle,marginBottom:10}}>Προσοχή στα ψιλά γράμματα</p>
          <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:16}}>
            {SERVICERS_GUIDE.redFlags.map((f,i)=>(
              <div key={i} style={{display:'flex',gap:10,padding:'10px 14px',background:'var(--bg-surface)',border:'1px solid var(--border-subtle)',borderLeft:'3px solid var(--border-default)',borderRadius: T.radius.chip}}>
                <svg aria-hidden="true" className="po-lead-ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <p style={{fontSize:12,color:'var(--text-secondary)',lineHeight:1.55,fontFamily: T.font.sans}}>{f}</p>
              </div>
            ))}
          </div>

          {/* ΟΙ ΕΠΙΣΗΜΕΣ ΠΗΓΕΣ ΗΤΑΝ ΣΕ ΔΥΟ ΣΗΜΕΙΑ ΤΗΣ ΙΔΙΑΣ ΟΘΟΝΗΣ: πέντε εδώ,
              δεκαέξι σε δική τους κάρτα λίγο πιο κάτω, με τον ίδιο τίτλο. Ο
              χρήστης δεν ξέρει ποια από τις δύο λίστες είναι «οι πηγές» και
              σε ποια να ψάξει. Μαζεύτηκαν όλες στη μία κάρτα, ταξινομημένες,
              με τη ρύθμιση οφειλών πρώτη ενότητα. */}
          <p style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',lineHeight:1.6,fontFamily: T.font.sans}}>Ενημερωτικές πληροφορίες με βάση το ισχύον πλαίσιο (Ιούλιος 2026), όχι νομική ή χρηματοοικονομική συμβουλή. Για την περίπτωσή σου συμβουλέψου δικηγόρο ή πιστοποιημένο σύμβουλο αναδιάρθρωσης.</p>
        </MiniSection>

        <MiniSection title="Γλωσσάρι όρων" meta={<span style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',fontFamily: T.font.sans}}>{profile==='business'?'Πλήρες':'Βασικοί όροι'}</span>}>
          <Glossary items={[...GLOSSARY.filter(g=>profile==='business'||g.level==='basic')].sort((a,b)=>a.term.localeCompare(b.term,'el'))}/>
          {profile!=='business'&&(
            <p style={{fontSize:12,color:'var(--text-tertiary)',marginTop:14,lineHeight:1.55,fontFamily: T.font.sans}}>
              Περισσότεροι, πιο εξειδικευμένοι όροι εμφανίζονται στη λειτουργία «Επαγγελματίας», από τις Ρυθμίσεις.
            </p>
          )}
        </MiniSection>

        {/* ΜΙΑ ΚΑΡΤΑ ΠΗΓΩΝ, ΜΕ ΣΕΙΡΑ ΠΟΥ ΒΓΑΙΝΕΙ ΑΠΟ ΤΟ ΤΙ ΨΑΧΝΕΙ Ο ΧΡΗΣΤΗΣ.
            Πρώτα ό,τι λύνει πρόβλημα που ΗΔΗ έχει (ρύθμιση οφειλών), μετά ό,τι
            δίνει χρήματα (κρατικά προγράμματα), μετά ό,τι συγκρίνει (τράπεζες
            και επιτόκια), μετά ό,τι ελέγχεται (φορολογικά και τίτλοι) και
            τελευταία τα υπόλοιπα εργαλεία. */}
        <MiniSection title="Επίσημες πηγές">
          {[
            {category:'Ρύθμιση οφειλών και διαχειριστές',links:SERVICERS_GUIDE.sources.map(x=>({label:x.label,sub:x.sub,url:x.url}))},
            {category:'Κρατικά προγράμματα',links:[
              {label:'Σπίτι μου ΙΙ · επίσημη σελίδα',sub:'Κριτήρια και όροι του προγράμματος',url:'https://greece20.gov.gr/home-loans/'},
              {label:'Αναβαθμίζω το Σπίτι μου',sub:'Ελληνική Αναπτυξιακή Τράπεζα, επίσημη πλατφόρμα',url:'https://hdb.gr/anavathmizo-to-spiti-mou/'},
              {label:'Εξοικονομώ 2025',sub:'Επιδότηση ενεργειακής αναβάθμισης',url:'https://exoikonomo2025.gov.gr/'},
              {label:'Ανακαινίζω και Νοικιάζω · ΟΠΕΚΑ',sub:'40% επιδότηση και εγγυημένο ενοίκιο',url:'https://www.opeka.gr'},
              {label:'Γέφυρα 3 · κάλυψη αύξησης δόσης',sub:'Πρωτοβουλία τραπεζών για ευάλωτους οφειλέτες',url:'https://gefyra3.gr'},
            ]},
            {category:'Τράπεζες και επιτόκια',links:[
              {label:'Τράπεζα Ελλάδος · επιτόκια',sub:'Επίσημα μέσα επιτόκια αγοράς',url:'https://www.bankofgreece.gr/el/statistiki/nomismatiki-kai-trapeziki-statistiki/epitokia-katatheseon-kai-daneion'},
              {label:'Σύγκριση επιτοκίων τραπεζών',sub:'Ενημερωμένη σύγκριση όλων των τραπεζών',url:'https://vresdaneio.gr/epitokia/index.html'},
              {label:'e-stegastiko · πλατφόρμα Τράπεζας Ελλάδος',sub:'Επίσημη πλατφόρμα στεγαστικών',url:'https://e-stegastiko.gr'},
              {label:'Τειρεσίας · έλεγχος πιστοληπτικής',sub:'Έλεγξε αν έχεις εγγραφές πριν αιτηθείς',url:'https://www.tiresias.gr'},
            ]},
            {category:'Φορολογικά και τίτλοι',links:[
              {label:'ΑΑΔΕ · φορολογικά ακινήτων',sub:'Φόρος μεταβίβασης, ΕΝΦΙΑ, εισοδήματα ενοικίων',url:AADE_HOME},
              {label:'Κτηματολόγιο · έλεγχος τίτλων',sub:'Ηλεκτρονικός έλεγχος εγγράφων',url:'https://www.ktimatologio.gr'},
              {label:'Επιλεξιμότητα Σπίτι μου ΙΙ · gov.gr',sub:'Ηλεκτρονικός έλεγχος με κωδικούς Taxisnet',url:'https://www.gov.gr/ipiresies/periousia-kai-phorologia/akinhta/elegkhos-epile3imotetas-programmatos-spiti-mou-ii'},
            ]},
            {category:'Χρήσιμα εργαλεία',links:[
              {label:'Ελληνική Αναπτυξιακή Τράπεζα',sub:'Διαχείριση κρατικών προγραμμάτων δανείων',url:'https://hdb.gr'},
              {label:'Υπουργείο Περιβάλλοντος και Ενέργειας',sub:'Ενεργειακά προγράμματα, παρατάσεις, ανακοινώσεις',url:'https://ypen.gov.gr'},
              {label:'Ταμείο Αλληλοβοηθείας Στρατού',sub:'Στεγαστικά για στελέχη Ενόπλων Δυνάμεων',url:'https://www.tap.gr'},
              /* Ο ΣΥΝΔΕΣΜΟΣ ΕΒΓΑΖΕ ΣΕ ΣΕΙΡΑ ΠΟΥ ΔΕΝ ΤΡΟΦΟΔΟΤΕΙ ΤΙΠΟΤΑ. Ηταν γραμμένο με το
               χέρι το ΠΑΛΙΟ κλειδί («RT0»), το ίδιο που χρησιμοποιούσε η εργασία
               πριν διορθωθεί: ο χρήστης πατούσε «Επίσημα δεδομένα» και έφτανε σε
               άλλη σειρά από αυτήν που δείχνει η οθόνη του. Παράγεται πλέον από
               τον κατάλογο, οπότε δεν μπορεί να αποκλίνει. */
            {label:'Ευρωπαϊκή Κεντρική Τράπεζα · Euribor',sub:'Η σειρά που τροφοδοτεί την εφαρμογή',url:seriesPage(ECB_SERIES.find(x=>x.key==='euribor_3m')!.candidates[0])},
            ]},
          ].map(group=>(
            <div key={group.category} style={{marginBottom:16}}>
              <p style={{...labelStyle,marginBottom:8}}>{group.category}</p>
              {/* ΟΧΙ `auto-fit`: ΟΡΦΑΝΕΥΕ ΤΗΝ ΤΕΛΕΥΤΑΙΑ ΚΑΡΤΑ. Οι ομάδες έχουν
                  πέντε, πέντε, τέσσερις, τρεις και τέσσερις συνδέσμους· με
                  «όσες στήλες χωρέσουν» έβγαινε 4+1 στα φαρδιά και 2+2+1 στα
                  μεσαία, δηλαδή μία κάρτα μόνη της με τρύπα δεξιά της, έξι
                  φορές στη σάρωση. Η `.card-row` είναι η κλάση του έργου
                  ακριβώς γι' αυτό: τρεις στήλες, δύο σε ταμπλέτα, μία σε
                  τηλέφωνο — και το τελευταίο ορφανό απλώνεται σε όλο το
                  πλάτος αντί να αφήσει κενό. */}
              <div className="card-row" style={{gap:8}}>
                {group.links.map(link=>(
                  <LinkCard key={link.url} href={link.url} label={link.label} sub={link.sub}/>
                ))}
              </div>
            </div>
          ))}
          <div style={{padding:'10px 14px',background:'var(--bg-surface)',border:'1px solid var(--border-subtle)',borderRadius: T.radius.chip}}>
            <p style={{fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',lineHeight:1.6,fontFamily: T.font.sans}}>
              Ενημερωτικές πληροφορίες, δεν αποτελούν χρηματοοικονομική, νομική ή φορολογική συμβουλή.
            </p>
          </div>
        </MiniSection>

      </div>
    </LensPanel>
  )
}
