'use client';
// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΤΡΕΙΣ ΕΝΟΤΗΤΕΣ ΤΟΥ ΠΑΚΕΤΟΥ «ΕΠΑΓΓΕΛΜΑΤΙΑΣ»: ΕΠΑΝΕΠΕΝΔΥΣΗ ΚΑΙ ΜΟΧΛΕΥΣΗ,
// ΕΠΕΝΔΥΤΙΚΗ ΑΝΑΛΥΣΗ (IRR/NPV/DSCR), ΑΝΑΛΥΣΗ ΕΥΑΙΣΘΗΣΙΑΣ
// ─────────────────────────────────────────────────────────────────────────
// Η κλειδαριά (`canInvest`) μένει στην καρτέλα· εδώ φτάνουν μόνο όταν ο
// χρήστης έχει και το πακέτο και το επιχειρηματικό προφίλ. Οι υπολογισμοί
// (μόχλευση, συναλλαγή, σενάρια) γίνονται επίσης στην καρτέλα, μία φορά, γιατί
// τους διαβάζουν και τα πλακίδια και οι δύο αναφορές.
// ═══════════════════════════════════════════════════════════════════════════
import { T, fe, fp, fn, fixedCols, Tile, widestOf, Btn } from '@/components/Theme';
import { NumberInput, fieldLabelStyle, SegmentControl } from '../UIComponents';
import { TrendingUp, Percent } from 'lucide-react';
import type { CompoundResult, DealResult, LeverageResult } from '@/lib/market/returns';
import { GLOSSARY as G } from '@/lib/market/glossary';
import { InfoHint } from '../InfoHint';
import type { SensitivityRow } from './model';
import {
  SANS, titleStyle, toolCard, toolNote, roiFoot, roiGrow, roiHead, roiFootLabel, roiFootValue,
  Section, TermInfo, Figure, yearOpts, type SetState,
} from './Bits';
import { CompoundBars } from './charts';

// 4) Εργαλεία & μοχλοί
export function ToolsSection({
  compRate, setCompRate, compYears, setCompYears, comp, nVal, grossAnnual, effOpex, annualTax, savedLoan, value,
  setLtv, setLoanRate, setIfree, ltv, loanRate, loanYears, setLoanYears, ifree, lev, opexPctOfRent, nLoanYears,
}: {
  compRate: string; setCompRate: SetState<string>; compYears: '10' | '20'; setCompYears: SetState<'10' | '20'>;
  comp: CompoundResult; nVal: number; grossAnnual: number; effOpex: number; annualTax: number;
  savedLoan: { amount: number; rate: number; property_value: number; loan_type: string } | null; value: string;
  setLtv: SetState<string>; setLoanRate: SetState<string>; setIfree: SetState<string>;
  ltv: string; loanRate: string; loanYears: string; setLoanYears: SetState<string>; ifree: string;
  lev: LeverageResult; opexPctOfRent: number; nLoanYears: number;
}) {
  return (
    <Section icon={<Percent size={15} />} title="Επανεπένδυση και μόχλευση" sub="Ανατοκισμός επανεπένδυσης και μόχλευση ιδίων κεφαλαίων">
      {/* ΔΥΟ ΚΑΡΤΕΣ, ΙΔΙΑ ΓΕΩΜΕΤΡΙΑ, ΙΔΙΟ ΥΨΟΣ.
          Η αριστερή είχε τα πεδία της σε flex με χειρόγραφο πλάτος 150 και
          ετικέτα που τύλιγε σε δύο σειρές δίπλα σε μία σειρά, άρα τα δύο
          κουτιά κάθονταν σε άλλη γραμμή βάσης. Η δεξιά είχε τέσσερα πεδία
          σε στήλη, το ένα κάτω από το άλλο. Και οι δύο άφηναν τα νούμερά
          τους σε flex-wrap, δηλαδή σε άλλη κατακόρυφο η καθεμία.

          Τώρα: πεδία σε δύο στήλες, νούμερα σε δικό τους πλέγμα, σημείωση
          στο κάτω άκρο. Ό,τι διαβάζεις αριστερά το βρίσκεις δεξιά. */}
      {/* ══ ΣΤΗΝ ΤΑΜΠΛΕΤΑ ΟΙ ΔΥΟ ΚΑΡΤΕΣ ΕΠΑΙΡΝΑΝ ΛΙΓΟΤΕΡΟ ΠΛΑΤΟΣ ΑΠΟ ΤΟ ΤΗΛΕΦΩΝΟ
          Μετρημένο στον πάγκο, σκηνή «roi-pro», με ανοιχτά τα «Εργαλεία
          απόδοσης»: στα 430 η κάρτα παίρνει 364 εικονοστοιχεία και κάθε
          πεδίο της 334. Στα 481 πέφτει στα 199,5 με πεδίο 78,8· στα 600
          στα 259 με πεδίο 108,5· στα 768 στα 331 με πεδίο 144,5. Η
          μεγαλύτερη οθόνη έδινε ΛΙΓΟΤΕΡΟ πλάτος ανά κάρτα από το τηλέφωνο,
          επειδή το `fixed-cols` κρατά δύο στήλες σε κάθε πλάτος πάνω από
          τα 480 ενώ κάθε κάρτα κουβαλά μέσα της φωλιασμένο πλέγμα πεδίων.
          Και κοβόταν: ο επιλογέας «10 έτη · 20 έτη» ζητά 159 εικονοστοιχεία
          και έπαιρνε 78,8 στα 481, 108,5 στα 600, 144,5 στα 768. Στα 481
          κόβονταν μαζί του το «335.343,55€» (106 σε 76,8) · το «έτη»
          (99 σε 78,8) · το «%» (92 σε 78,8).

          ΤΟ ΚΑΤΩΦΛΙ ΕΙΝΑΙ ΟΣΟ ΔΙΝΕΙ ΤΟ ΤΗΛΕΦΩΝΟ. Δύο κάρτες δίπλα δίπλα
          μόνο όταν η καθεμία παίρνει τα 364 που δίνει η οθόνη των 430. Με
          η κοινή `.po-panelrow` βγάζει το σπάσιμο χωρίς media query: κάτω από 744 διαθέσιμα εικονοστοιχεία —
          δύο φορές 364 συν το κενό 16 — οι κάρτες στοιβάζονται.

          ΔΟΚΙΜΑΣΤΗΚΕ ΠΡΩΤΑ ΜΕ `.field-row` ΚΑΙ ΗΤΑΝ ΛΑΘΟΣ ΚΛΑΣΗ. Η
          `.field-row` δηλώνει ΣΕΙΡΑ ΠΕΔΙΩΝ· ο σαρωτής διάταξης απαιτεί
          σωστά τα κουτιά γραφής της να ξεκινούν στην ίδια γραμμή. Εδώ
          μέσα κάθονται ΔΥΟ ΟΛΟΚΛΗΡΕΣ ΚΑΡΤΕΣ με δικά τους φωλιασμένα πεδία,
          οπότε ο έλεγχος έβρισκε τα πεδία της μιας 7 ως 44 εικονοστοιχεία
          πιο ψηλά από της άλλης: 12 ευρήματα σε 834, 1.180, 1.280, 1.366
          και 1.440. Το πλέγμα λέει το ίδιο πράγμα χωρίς να υπόσχεται
          στοίχιση πεδίων που δεν ανήκουν στην ίδια σειρά.

          Μετρημένο ξανά:
          από τα 481 ως τα 833 μία στήλη χωρίς τίποτα κομμένο, με πεδίο
          186,5 ως 350,5· από τα 834 δύο στήλες των 364 όπως πριν· στα 1024
          δύο των 459· στα 1280 δύο των 587. Στα 430 τίποτα δεν αλλάζει.

          ΤΟ ΤΙΜΗΜΑ ΕΙΝΑΙ ΥΨΟΣ ΣΤΗ ΖΩΝΗ 481 ΩΣ 833: η ενότητα ψηλώνει από
          593,4 σε 730,8 στα 768 · από 675,4 σε 828,2 στα 481. ══ */}
      <div className="po-panelrow" style={{ '--panel-min': '364px' } as React.CSSProperties}>
        {/* Ανατοκισμός */}
        <div className="po-fig-card" tabIndex={0} style={toolCard}>
          <div style={roiHead}>
            <p style={{ ...titleStyle, margin: 0, display: 'flex', alignItems: 'center' }}>Ανατοκισμός επανεπένδυσης<TermInfo term="Ανατοκισμός επανεπένδυσης" text={G.compound} /></p>
          </div>
          <div {...fixedCols(2, 12)}>
            <NumberInput label="Απόδοση επανεπένδυσης" value={compRate} onChange={setCompRate} suffix="%" />
            <div><label style={fieldLabelStyle}>Ορίζοντας ανατοκισμού</label><SegmentControl ariaLabel="Ορίζοντας ανατοκισμού" value={compYears} onChange={v => setCompYears(v as typeof compYears)} options={yearOpts(10, 20)} /></div>
          </div>
          {/* Ενα μέγεθος για τη σειρά, από το μακρύτερο νούμερο: αλλιώς
              το «335.343,55€» και το «123.313,55€» βγαίνουν σε δύο
              μεγέθη δίπλα δίπλα και το μάτι το διαβάζει ως σημασία. */}
          <div {...fixedCols(2, 16, 'start')} style={{ ...fixedCols(2, 16, 'start').style, marginTop: 14 }}>
            <Figure label="Τελική αξία" value={fe(comp.futureValue)} chars={widestOf(fe(comp.futureValue), fe(comp.totalGrowth))} />
            <Figure label="Κέρδος ανατοκισμού" value={fe(comp.totalGrowth)} chars={widestOf(fe(comp.futureValue), fe(comp.totalGrowth))} />
          </div>
          {/* Ητανε 84 χαρακτήρες και τσάκιζε σε δεύτερη γραμμή μέσα στη
              στήλη του εργαλείου. Η ίδια πρόταση χωρίς τα γεμίσματα: το
              «ετήσια» το λέει το «τον χρόνο» στο τέλος και η «καθαρή
              ταμειακή ροή» είναι ό,τι ακριβώς δείχνει το ποσό δίπλα της. */}
          {/* ΤΟ ΙΔΙΟ ΚΑΤΩ ΑΚΡΟ ΜΕ ΤΗ ΔΙΠΛΑΝΗ ΚΑΡΤΑ. Η πρόταση «Αρχική αξία
              συν επανεπένδυση…» έκλεινε την κάρτα στη μέση του ύψους της
              και άφηνε από κάτω άδειο χώρο, ενώ η μόχλευση δίπλα κατέβαινε
              ως κάτω. Τώρα και οι δύο κλείνουν με τις παραδοχές τους, στην
              ίδια γραμμή, κολλημένες στη βάση της κάρτας. */}
          {/* Η ΑΞΙΑ ΑΝΑ ΕΤΟΣ, ΟΧΙ ΚΕΝΟΣ ΧΩΡΟΣ. Η κάρτα είναι όσο ψηλή η
              μόχλευση δίπλα της· ο χώρος που περίσσευε δείχνει τώρα πώς
              χτίζεται η τελική αξία: κεφάλαιο και εισφορές από κάτω, κέρδος
              ανατοκισμού από πάνω, μία στήλη ανά έτος. Το διάγραμμα παίρνει
              όσο ύψος μένει, με ελάχιστο 96. */}
          <CompoundBars perYear={comp.perYear} />
          <div style={roiFoot}>
            <div>
              <p style={roiFootLabel}>Αρχική αξία</p>
              <p style={roiFootValue}>{fe(nVal)}</p>
            </div>
            <div>
              <p style={roiFootLabel}>Επανεπένδυση ροής</p>
              <p style={roiFootValue}>{fe(Math.max(0, grossAnnual - effOpex - annualTax))} τον χρόνο</p>
            </div>
          </div>
        </div>
        {/* Μόχλευση */}
        <div className="po-fig-card" tabIndex={0} style={toolCard}>
          <div style={roiHead}>
            <p style={{ ...titleStyle, margin: 0, display: 'flex', alignItems: 'center' }}>Μόχλευση (δανεισμός)<TermInfo term="Μόχλευση" text={G.leverage} /></p>
            {savedLoan && savedLoan.amount > 0 && (
              <Btn variant="secondary"
                onClick={() => {
                  const base = (savedLoan.property_value || parseFloat(value) || 0);
                  if (base > 0) setLtv(String(Math.min(100, Math.round((savedLoan.amount / base) * 100))));
                  setLoanRate(String(savedLoan.rate));
                  // «Πρώτη κατοικία» ΔΕΝ σημαίνει «Σπίτι μου ΙΙ». Εδώ έμπαινε 50%
                  // άτοκο σε κάθε αποθηκευμένο δάνειο πρώτης κατοικίας, δηλαδή
                  // μισός τόκος και φουσκωμένη απόδοση για δάνειο με κανονικό
                  // επιτόκιο, σε πρόγραμμα κλειστό για αιτήσεις. Το άτοκο σκέλος
                  // το δηλώνει ο χρήστης, αν το έχει.
                  setIfree('0');
                }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 12a9 9 0 11-6.2-8.5"/><polyline points="21 3 21 9 15 9"/></svg>
                Χρησιμοποίησε το πραγματικό μου δάνειο
              </Btn>
            )}
          </div>
          <div {...fixedCols(2, 12)}>
            <NumberInput label="Δάνειο (% αξίας)" value={ltv} onChange={setLtv} suffix="%" max={100} />
            <NumberInput label="Επιτόκιο" value={loanRate} onChange={setLoanRate} suffix="%" />
            {/* Η διάρκεια ήταν καρφωμένη στα 25 έτη μέσα στη κλήση της
                μηχανής: καθόριζε δόση, ταμειακή ροή, DSCR και IRR χωρίς να
                φαίνεται πουθενά. Τώρα είναι πεδίο, με την προεπιλογή ρητή. */}
            <NumberInput label="Διάρκεια δανείου" value={loanYears} onChange={setLoanYears} suffix="έτη" max={40} />
            {/* Η παρένθεση «(Σπίτι μου ΙΙ)» έκανε την ετικέτα 27 χαρακτήρες και σε
                μισή κάρτα τσάκιζε σε δεύτερη γραμμή, ενώ η «Διάρκεια δανείου»
                δίπλα της έμενε σε μία. Δεν είναι μέρος του ονόματος: είναι ο
                λόγος που υπάρχει το πεδίο, δηλαδή επεξήγηση. */}
            <NumberInput label="Άτοκο μέρος" labelInfo="Το ποσοστό του δανείου που δεν τοκίζεται, αν το δάνειό σου έχει τέτοιο σκέλος. Αλλιώς άφησε 0." value={ifree} onChange={setIfree} suffix="%" max={100} />
          </div>
          {/* ΣΤΑ 768 Η ΚΑΡΤΑ ΕΙΝΑΙ ΜΙΣΗ ΚΑΙ ΟΙ ΤΡΕΙΣ ΣΤΗΛΕΣ ΔΙΝΟΥΝ 100. Η
              ετικέτα «Απόδοση ιδίων» θέλει 105 στα 11 με την αραίωσή της,
              οπότε τσάκιζε σε δεύτερη γραμμή ενώ οι διπλανές της έμεναν σε
              μία: η τιμή από κάτω της έπεφτε δεκαοκτώ εικονοστοιχεία πιο
              χαμηλά. Κάτω από τα 820 τα τρία μεγέθη πάνε το ένα κάτω από
              το άλλο, όπου η ετικέτα έχει όλο το πλάτος της κάρτας. */}
          <div {...fixedCols(3, 16, 'start', '', 1)} style={{ ...fixedCols(3, 16, 'start', '', 1).style, marginTop: 14 }}>
            <Figure label="Ίδια κεφάλαια" value={fe(lev.equity)} chars={widestOf(fe(lev.equity), fp(lev.cashOnCash), fe(lev.cashFlow))} />
            <Figure label="Απόδοση ιδίων" value={fp(lev.cashOnCash)} chars={widestOf(fe(lev.equity), fp(lev.cashOnCash), fe(lev.cashFlow))} />
            <Figure label="Ετήσια ροή" value={fe(lev.cashFlow)} chars={widestOf(fe(lev.equity), fp(lev.cashOnCash), fe(lev.cashFlow))} />
          </div>
          {/* ══ ΔΥΟ ΓΚΡΙΖΕΣ ΠΑΡΑΓΡΑΦΟΙ ΓΙΑ ΜΙΑ ΕΤΥΜΗΓΟΡΙΑ ΚΑΙ ΤΕΣΣΕΡΑ ΜΕΓΕΘΗ
              Το κουτί έκλεινε με δύο μπλοκ κειμένου στο ίδιο μέγεθος και
              σχεδόν στο ίδιο χρώμα, που τύλιγαν σε τρεις και τέσσερις
              σειρές. Μέσα τους κρύβονταν πράγματα διαφορετικού είδους: μία
              ΚΡΙΣΗ («αρνητική μόχλευση»), δύο ΜΕΓΕΘΗ που τη στηρίζουν
              (κόστος δανείου έναντι καθαρής απόδοσης) και δύο ΠΑΡΑΔΟΧΕΣ
              (λειτουργικά έξοδα, διάρκεια). Ο αναγνώστης έπρεπε να τα
              ξεχωρίσει μόνος του μέσα από τη σύνταξη.

              Τώρα: η ετυμηγορία με λέξεις, τα δύο μεγέθη που τη βγάζουν
              δίπλα της, οι παραδοχές σε ήσυχη γραμμή στοιχείων από κάτω.
              Ιδιο ιδίωμα με την κάρτα δανείου: όνομα πάνω, μέγεθος κάτω. */}
          {/* Η ΕΤΥΜΗΓΟΡΙΑ ΩΣ ΣΥΓΚΡΙΣΗ, ΟΧΙ ΩΣ ΣΕΙΡΑ ΛΕΞΕΩΝ. Τρία κομμάτια σε
              flex-wrap τύλιγαν όπου έβρισκαν και τα δύο ποσοστά κάθονταν σε
              άλλη κατακόρυφο το καθένα. Τώρα: η κρίση πάνω, από κάτω οι δύο
              αριθμοί που τη βγάζουν, ετικέτα αριστερά και τιμή δεξιά, στην
              ίδια στήλη ώστε να συγκρίνονται με μια ματιά. */}
          <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: T.radius.popup, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
            <p style={{ margin: 0, fontSize: 'var(--fs-base)', fontWeight: 700, fontFamily: SANS, color: 'var(--text-primary)' }}>
              {lev.positiveCarry ? 'Θετική μόχλευση' : 'Αρνητική μόχλευση'}
            </p>
            <dl style={{ margin: '6px 0 0', display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 2, columnGap: 16, fontSize: 12, fontFamily: SANS, fontVariantNumeric: 'tabular-nums' }}>
              <dt style={{ color: 'var(--text-secondary)' }}>Καθαρή απόδοση ακινήτου</dt>
              <dd style={{ margin: 0, textAlign: 'right', color: 'var(--text-primary)', fontWeight: 600 }}>{fp(lev.unleveredYield)}</dd>
              <dt style={{ color: 'var(--text-secondary)' }}>Κόστος δανείου</dt>
              <dd style={{ margin: 0, textAlign: 'right', color: 'var(--text-primary)', fontWeight: 600 }}>{fp(lev.effectiveLoanRate)}</dd>
            </dl>
          </div>
          {lev.positiveCarry && (
            <p style={{ ...toolNote, marginTop: 6 }}>Η ετήσια ροή μπορεί να είναι αρνητική λόγω χρεολυσίου, αυξάνεις όμως τα ίδια κεφάλαιά σου.</p>
          )}
          {/* Το ποσοστό λειτουργικών εξόδων έμπαινε στη μηχανή σιωπηλά (με
              εφεδρικό 20% όταν έλειπαν έσοδα). Δεν είναι υπόθεση: βγαίνει από
              τα «Ετήσια έξοδα» που έγραψε ο χρήστης. Άρα λέγεται. */}
          <div aria-hidden="true" style={roiGrow} />
          <div style={roiFoot}>
            <div>
              <p style={roiFootLabel}>Λειτουργικά έξοδα</p>
              <p style={roiFootValue}>{fp(opexPctOfRent)} των εσόδων · {fe(effOpex)} σε {fe(grossAnnual)}</p>
            </div>
            <div>
              <p style={roiFootLabel}>Διάρκεια δανείου</p>
              <p style={roiFootValue}>{nLoanYears} έτη</p>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

// Επενδυτική ανάλυση IRR/NPV/DSCR
export function DealSection({
  holdYears, setHoldYears, rentGrowth, setRentGrowth, discountRate, setDiscountRate, sellCosts, setSellCosts,
  deal, nAppr, apprTouched, apprRef, opexPctOfRent, ltv, loanRate, nLoanYears, nSellCosts,
}: {
  holdYears: '5' | '10' | '20'; setHoldYears: SetState<'5' | '10' | '20'>;
  rentGrowth: string; setRentGrowth: SetState<string>; discountRate: string; setDiscountRate: SetState<string>;
  sellCosts: string; setSellCosts: SetState<string>; deal: DealResult; nAppr: number; apprTouched: boolean;
  apprRef: { pct: number; fromYear: number; toYear: number; years: number };
  opexPctOfRent: number; ltv: string; loanRate: string; nLoanYears: number; nSellCosts: number;
}) {
  return (
    <Section icon={<Percent size={15} />} title="Επενδυτική ανάλυση" sub="IRR / NPV / DSCR: αγορά, κατοχή και πώληση στον ορίζοντα">
      {/* ΤΕΣΣΕΡΑ ΧΕΙΡΙΣΤΗΡΙΑ ΜΕ ΤΡΙΑ ΧΕΙΡΟΓΡΑΦΑ ΠΛΑΤΗ (128, 158, 148) ΚΑΙ
          ΕΝΑ ΧΩΡΙΣ. Η ετικέτα «Επιτόκιο προεξόφλησης» δεν χωρούσε στα 158
          και τύλιγε σε δύο σειρές, οπότε το πεδίο της κατέβαινε και έσπαγε
          τη γραμμή. Τέσσερις ίσες στήλες, μία γραμμή βάσης. */}
      <div {...fixedCols(4, 12)} style={{ ...fixedCols(4, 12).style, marginBottom: 14 }}>
        <div><label style={fieldLabelStyle}>Ορίζοντας κατοχής</label><SegmentControl ariaLabel="Ορίζοντας κατοχής" value={holdYears} onChange={v => setHoldYears(v as typeof holdYears)} options={yearOpts(5, 10, 20)} /></div>
        <NumberInput label="Αύξηση ενοικίου" value={rentGrowth} onChange={setRentGrowth} suffix="%" />
        <NumberInput label="Επιτόκιο προεξόφλησης" value={discountRate} onChange={setDiscountRate} suffix="%" labelInfo={<TermInfo term="Επιτόκιο προεξόφλησης" text={G.npv} />} />
        {/* Τα κόστη πώλησης ήταν σταθερά 3% μέσα στην κλήση: αφαιρούνταν από
            το προϊόν της πώλησης και άρα από το IRR, χωρίς να φαίνονται. */}
        <NumberInput label="Κόστη πώλησης" value={sellCosts} onChange={setSellCosts} suffix="%" max={15}
          labelInfo={<TermInfo term="Κόστη πώλησης" text="Κόστη που βαρύνουν τον πωλητή στην έξοδο: μεσιτική αμοιβή, τυπικά περίπου 2% συν ΦΠΑ, νομικός και συμβολαιογραφικός έλεγχος, τεχνικά πιστοποιητικά. Ο φόρος μεταβίβασης 3% βαρύνει τον αγοραστή, γι’ αυτό δεν περιλαμβάνεται εδώ. Προεπιλογή 3%· άλλαξέ το αν γνωρίζεις τα δικά σου κόστη." />} />
      </div>
      {/* Τέσσερις δείκτες με πολύ διαφορετικό μήκος — ποσοστό, ποσό, λόγος
          και πολλαπλασιαστής. Ενα μέγεθος για όλη τη σειρά, από το
          μακρύτερο: αλλιώς το «1,35» θα γραφόταν μεγαλύτερο από την
          καθαρή παρούσα αξία επειδή είναι απλώς κοντύτερο. */}
      {(()=>{ const irr=Number.isFinite(deal.irrPct) ? fp(deal.irrPct) : fp(0), npv=fe(deal.npv),
                    dscr=Number.isFinite(deal.dscr) ? fn(deal.dscr, 2) : '∞', em=`${fn(deal.equityMultiple, 2)}×`,
                    w=widestOf(irr, npv, dscr, em); return (
      <div {...fixedCols(4, 12, 'stretch')}>
        <Tile nested label="IRR" value={irr} chars={w} info={<TermInfo term="IRR" text={G.irr} />} />
        <Tile nested label="Καθαρή παρούσα αξία" value={npv} chars={w} info={<TermInfo term="Καθαρή παρούσα αξία" text={G.npv} />} />
        <Tile nested label="DSCR" value={dscr} chars={w} info={<TermInfo term="DSCR" text={G.dscr} />} />
        <Tile nested label="Πολλαπλασιαστής ιδίων" value={em} chars={w} info={<TermInfo term="Πολλαπλασιαστής ιδίων" text={G.equity_multiple} />} />
      </div>) })()}
      {/* ΜΙΑ ΠΑΡΑΓΡΑΦΟΣ ΠΟΥ ΕΚΡΥΒΕ ΕΝΑΝ ΠΙΝΑΚΑ. Οι έξι παραδοχές ήταν σε
          τρέχον κείμενο, χωρισμένες με κόμματα, ανάμεσα σε δύο εξηγήσεις:
          για να βρεις με ποιο επιτόκιο υπολογίστηκε η NPV έπρεπε να
          διαβάσεις πενήντα λέξεις. Ό,τι είναι ζευγάρι «όνομα, τιμή» δεν
          είναι πρόταση, είναι γραμμή. */}
      <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: T.radius.popup, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
        <p style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: SANS, margin: '0 0 10px' }}>Οι παραδοχές του υπολογισμού</p>
        <div {...fixedCols(3, 14, 'start')}>
          {[
            ['Ανατίμηση ακινήτου', fp(nAppr), apprTouched ? 'δική σου υπόθεση' : `δείκτης ΤτΕ ${apprRef.fromYear} ως ${apprRef.toYear}`],
            ['Αύξηση ενοικίου', fp(parseFloat(rentGrowth) || 0), 'τον χρόνο'],
            ['Λειτουργικά έξοδα', fp(opexPctOfRent), 'των εσόδων'],
            ['Δάνειο', fp(parseFloat(ltv) || 0), `της αξίας, με επιτόκιο ${fp(parseFloat(loanRate) || 0)}`],
            ['Διάρκεια δανείου', `${nLoanYears} έτη`, `ορίζοντας κατοχής ${holdYears} έτη`],
            ['Επιτόκιο προεξόφλησης', fp(parseFloat(discountRate) || 0), 'για την καθαρή παρούσα αξία'],
          ].map(([l, v, sub]) => (
            <div key={l}>
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0, fontFamily: SANS }}>{l}</p>
              <p className="po-fig" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '2px 0 0', fontFamily: SANS, fontVariantNumeric: 'tabular-nums' }}>{v}</p>
              <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', margin: '1px 0 0', fontFamily: SANS, lineHeight: 1.4 }}>{sub}</p>
            </div>
          ))}
        </div>
      </div>
      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', margin: '12px 0 0', fontFamily: SANS, lineHeight: 1.55 }}>
        {/* Μένουν τα τρία ποσά που χαρακτηρίζουν τους δείκτες από πάνω.
            Ο ορισμός του IRR και η επιφύλαξη «όχι επενδυτική συμβουλή»
            έφυγαν: η δεύτερη γραφόταν ΤΕΤΑΡΤΗ φορά στην ίδια καρτέλα και
            ζει στην κάρτα των πηγών. */}
        Πώληση στο τέλος του ορίζοντα: καθαρό προϊόν {fe(deal.saleProceeds)}, μετά τα κόστη πώλησης {fp(nSellCosts)} και το υπόλοιπο του δανείου {fe(deal.loanBalanceAtExit)}.{' '}
        <InfoHint label="Τι μετρά το IRR">
          <span style={{ display: 'block' }}>Το IRR ενσωματώνει τη χρονική αξία του χρήματος και την έξοδο: ένα ευρώ σήμερα δεν είναι ίδιο με ένα ευρώ στο τέλος του ορίζοντα και η πώληση μετρά όσο και τα ενοίκια.</span>
        </InfoHint>
      </p>
    </Section>
  );
}

// Ανάλυση ευαισθησίας & αντοχή
export function SensitivitySection({ scenarios, term, breakEvenOcc }: {
  scenarios: SensitivityRow[]; term: 'long' | 'short'; breakEvenOcc: number | null;
}) {
  return (
    <Section icon={<TrendingUp size={15} />} title="Ανάλυση ευαισθησίας" sub="Πώς αντέχει η επένδυση σε μεταβολές επιτοκίου και ανατίμησης" info={G.sensitivity}>
      {/* ═══ ΠΙΝΑΚΑΣ, ΟΧΙ ΠΛΕΓΜΑ ΑΠΟ divs ══════════════════════════════════
          ΤΙ ΗΤΑΝ. Τρία σενάρια επί τρία μεγέθη, χτισμένα με δύο `display:
          grid` — ένα για την κεφαλίδα, ένα ανά γραμμή — και το ΙΔΙΟ
          `1.6fr 1fr 1fr 1fr` γραμμένο δύο φορές. Δεκαέξι κελιά που
          ΜΟΙΑΖΑΝ πίνακας χωρίς να είναι: ο αναγνώστης οθόνης τα διάβαζε
          ως δεκαέξι ασύνδετα κείμενα, χωρίς «Δυσμενές, Απόδοση ιδίων».
          ΤΩΡΑ. Οι δύο δηλώσεις πλάτους έγιναν ΕΝΑ `<colgroup>` με
          `.tbl-fixed`· το χειρόγραφο `overflowX: auto` με `minWidth: 460`
          έγινε `.po-scroll-x` με `--tbl-min`. Η ίδια πληροφορία ήταν ήδη
          πίνακας στην αναφορά HTML κι στο PDF — μόνο η οθόνη έμενε πίσω.
          Το `.po-fig-card` κρατά την αποκάλυψη του τόνου στην αιώρηση κι
          κάθεται πάνω στο ΙΔΙΟ το κουτί: σε εσωτερικό στοιχείο το
          `overflow: hidden` της `.po-table-box` θα έκοβε το δαχτυλίδι
          εστίασης του πληκτρολογίου. */}
      <div className="po-table-box po-fig-card" tabIndex={0}>
        <div className="po-scroll-x">
          {/* Η ΡΟΗ ΘΕΛΕΙ ΤΗ ΦΑΡΔΙΑ ΣΤΗΛΗ. Ενα αρνητικό ποσό τεσσάρων ψηφίων
              («−3.060,33€») δεν χωρούσε στα 100 εικονοστοιχεία του 21,8%
              και ξεχείλιζε, χάνοντας τη δεξιά στοίχιση με τις διπλανές. */}
          <table className="po-table tbl-fixed" style={{ '--tbl-min': '480px' }}>
            {/* Ο τίτλος γράφεται ήδη από το `Section` ακριβώς από πάνω:
                ορατή ταινία τίτλου εδώ θα τον έλεγε δεύτερη φορά. Η λεζάντα
                μένει για όποιον ακούει τον πίνακα αντί να τον βλέπει. */}
            <caption className="sr-only">Ανάλυση ευαισθησίας</caption>
            <colgroup>
              <col style={{ width: '32%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '28%' }} />
            </colgroup>
            <thead>
              <tr>
                {['Σενάριο', 'Συνολική απόδοση', 'Απόδοση ιδίων', 'Ετήσια ροή'].map((h, i) => (
                  <th key={h} scope="col" className={i === 0 ? undefined : 'num'}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scenarios.map(s => (
                /* Η γραμμή του βασικού σεναρίου κρατά ΤΟ ΙΔΙΟ φόντο που είχε.
                   Η `tr.is-on` θα την έβαφε με τον τόνο της επιλογής, που εδώ
                   λέει ψέματα: κανείς δεν την επέλεξε — είναι το σενάριο των
                   τρεχουσών παραδοχών. */
                <tr key={s.key} style={{ background: s.key === 'base' ? 'var(--bg-elevated)' : undefined }}>
                  <th scope="row">
                    <p style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-primary)', margin: 0, fontFamily: SANS }}>{s.label}</p>
                    <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', margin: '1px 0 0', fontFamily: SANS }}>{s.note}</p>
                  </th>
                  {/* Η κεφαλίδα της γραμμής πιάνει δύο γραμμές, το ποσό μία:
                      με στοίχιση στην κορυφή —την προεπιλογή του `.po-table`—
                      το ποσό θα κάθεται δίπλα στο «Δυσμενές» κι όχι στη μέση
                      της γραμμής, όπως το είχε το `alignItems: center`. */}
                  <td className="num" style={{ verticalAlign: 'middle' }}>
                    <span className="po-fig" style={{ fontSize: 'var(--fs-base)', fontWeight: 600, fontFamily: SANS }}>{fp(s.totalReturn)}</span>
                  </td>
                  <td className="num" style={{ verticalAlign: 'middle' }}>
                    <span className="po-fig" data-tone={s.roe >= 0 ? undefined : 'negative'} style={{ fontSize: 'var(--fs-base)', fontWeight: 600, fontFamily: SANS }}>{fp(s.roe)}</span>
                  </td>
                  <td className="num" style={{ verticalAlign: 'middle' }}>
                    <span className="po-fig" data-tone={s.cashFlow >= 0 ? undefined : 'negative'} style={{ fontSize: 'var(--fs-base)', fontWeight: 600, fontFamily: SANS }}>{fe(s.cashFlow)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {term === 'short' && breakEvenOcc !== null && (
        <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
          <p style={{ margin: 0, fontSize: 'var(--fs-base)', color: 'var(--text-primary)', fontFamily: SANS, fontWeight: 600, display: 'flex', alignItems: 'center' }}>
            Πληρότητα ισοσκελισμού: {isFinite(breakEvenOcc) ? fp(Math.min(100, breakEvenOcc)) : 'μη εφικτή'}<TermInfo term="Πληρότητα ισοσκελισμού" text={G.break_even} />
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-tertiary)', fontFamily: SANS, lineHeight: 1.5 }}>
            {isFinite(breakEvenOcc) && breakEvenOcc <= 100
              ? `Πάνω από αυτό το ποσοστό πληρότητας, τα καθαρά έσοδα της βραχυχρόνιας ξεπερνούν τα καθαρά της μακροχρόνιας μίσθωσης (προ φόρου).`
              : `Με τα τρέχοντα δεδομένα, η βραχυχρόνια δύσκολα ξεπερνά τη μακροχρόνια: η μακροχρόνια μίσθωση φαίνεται προτιμότερη.`}
          </p>
        </div>
      )}
    </Section>
  );
}
