'use client';
// ═══════════════════════════════════════════════════════════════════════════
// Η ΚΑΡΤΑ «ΣΤΟΙΧΕΙΑ ΥΠΟΛΟΓΙΣΜΟΥ» ΤΗΣ ΑΠΟΔΟΣΗΣ
// ─────────────────────────────────────────────────────────────────────────
// Τα πεδία ζουν εδώ· η κατάστασή τους μένει στην καρτέλα (TabRentROI), που
// τα προσυμπληρώνει από τη βάση και τα αποθηκεύει τοπικά ανά ακίνητο. Το
// στοιχείο αυτό μόνο τα ζωγραφίζει και επιστρέφει κάθε αλλαγή με τον ίδιο
// setter που χρησιμοποιούσε όταν ήταν γραμμένο μέσα στην καρτέλα.
// ═══════════════════════════════════════════════════════════════════════════
import { T, fe, fp, fn, Btn } from '@/components/Theme';
import { NumberInput, CustomSelect } from '../UIComponents';
import { ChevronRight, Percent } from 'lucide-react';
import { MAX_ST_GROSS_YIELD_WARN } from '@/lib/market/shortTerm';
import { REGIONS, type RegionYield } from '@/lib/market/greekMarket';
import type { YieldBreakdown } from '@/lib/market/returns';
import type { TrailingStays } from '@/lib/clients/reports';
import { GLOSSARY as G } from '@/lib/market/glossary';
import { SANS, card, titleStyle, subStyle, TermInfo, g4, type SetState } from './Bits';

/* ═══ ΟΚΤΩ ΠΕΔΙΑ ΑΝΑΜΕΣΑ ΣΤΟΝ ΧΡΗΣΤΗ ΚΑΙ ΣΤΟ ΑΠΟΤΕΛΕΣΜΑ ══════════════════
    Η κάρτα των στοιχείων ήταν πάντα ανοιχτή: τέσσερα πεδία, μια γραμμή
    εκτίμησης, άλλα τέσσερα πεδία στη βραχυχρόνια και μετά δύο παράγραφοι
    φορολογίας. Ο χρήστης που άνοιγε τις Αποδόσεις για να δει την απόδοσή
    του κατέβαινε πρώτα ολόκληρη φόρμα που είχε ήδη συμπληρώσει.

    Τα πεδία είναι ρύθμιση, όχι περιεχόμενο. Μένουν στην κορυφή γιατί εκεί
    ανήκουν, αλλά μαζεμένα σε μία γραμμή που λέει τι ισχύει — και ανοίγουν
    με ένα κλικ. Όταν λείπουν στοιχεία, ανοίγουν μόνα τους: τότε ΕΙΝΑΙ το
    περιεχόμενο. */
export function InputsCard({
  inputsOpen, setInputsPinned, empty, term, nVal, stOcc, stBasis, rent, stAdr, opex, stCosts, reg,
  value, setValue, setRent, setScenario, setOpex, setOpexYear, setOpexCats, region, setRegion, opexYear,
  showEstValue, pSqm, estValue, fromBookings, booked, setStOcc, setStAdr, stClean, setStClean, stFee, setStFee, y,
}: {
  inputsOpen: boolean; setInputsPinned: SetState<boolean | null>; empty: boolean; term: 'long' | 'short';
  nVal: number; stOcc: string; stBasis: 'bookings' | 'area' | 'own'; rent: string; stAdr: string; opex: string;
  stCosts: number; reg: RegionYield | undefined;
  value: string; setValue: SetState<string>; setRent: SetState<string>; setScenario: SetState<boolean>;
  setOpex: SetState<string>; setOpexYear: SetState<number | null>; setOpexCats: SetState<string[]>;
  region: string; setRegion: SetState<string>; opexYear: number | null;
  showEstValue: boolean; pSqm: number | null; estValue: number; fromBookings: boolean; booked: TrailingStays | null;
  setStOcc: SetState<string>; setStAdr: SetState<string>; stClean: string; setStClean: SetState<string>;
  stFee: string; setStFee: SetState<string>; y: YieldBreakdown;
}) {
  return (
    <div style={card}>
      <button onClick={() => setInputsPinned(!inputsOpen)} aria-expanded={inputsOpen} className="acc-toggle acc-row">
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: T.radius.chip, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', flexShrink: 0 }}><Percent size={15} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={titleStyle}>Στοιχεία υπολογισμού</p>
          {/* ΟΤΑΝ ΕΙΝΑΙ ΟΔΗΓΙΑ, ΔΙΑΒΑΖΕΤΑΙ ΟΛΟΚΛΗΡΗ. Η ίδια γραμμή έχει δύο ρόλους:
              άδεια λέει ΤΙ ΝΑ ΣΥΜΠΛΗΡΩΣΕΙΣ, γεμάτη ανακεφαλαιώνει. Με μία κοινή
              αποκοπή σε μία γραμμή, στα 390 εικονοστοιχεία έγραφε «Συμπλήρωσε
              αξία ακινήτου και μηνιαίο μίσθ…» — έκοβε ακριβώς την οδηγία. */}
          {/* Η γεμάτη ανακεφαλαίωση είναι δεδομένα του χρήστη σε μία γραμμή —
              πέντε ποσά που ο ίδιος έγραψε και βλέπει ολόκληρα με ένα πάτημα
              από κάτω. Μήκος που δεν ορίζει το προϊόν: `.po-elide`, ώστε ο
              σαρωτής να ξέρει ότι η αποκοπή είναι απόφαση και όχι ατύχημα. */}
          <p className={empty ? undefined : 'po-elide-lines'} style={subStyle}>
            {empty
              ? (term === 'short' ? 'Συμπλήρωσε αξία, πληρότητα και τιμή ανά νύχτα' : 'Συμπλήρωσε αξία ακινήτου και μηνιαίο μίσθωμα')
              // ΑΠΟ ΠΟΥ ΕΙΝΑΙ ΤΑ ΝΟΥΜΕΡΑ ΚΑΙ ΤΙ ΑΛΛΟ ΑΦΑΙΡΕΙΤΑΙ. Η λωρίδα έγραφε
              // «1.152,00€ έξοδα τον χρόνο» ενώ η καθαρή απόδοση αφαιρούσε
              // περίπου 6.600€: προμήθειες, καθαρισμοί και τέλη ήταν αόρατα.
              : [
                  `Αξία ${fe(nVal)}`,
                  term === 'short'
                    ? `${fp(Number(stOcc) || 0)} πληρότητα ${stBasis === 'bookings' ? 'από τις κρατήσεις 12 μηνών' : stBasis === 'area' ? 'αναφοράς περιοχής' : ''}`.trim()
                    : `${fe(Number(rent) || 0)} τον μήνα`,
                  term === 'short' ? `${fe(Number(stAdr) || 0)} ανά νύχτα` : null,
                  `${fe(Number(opex) || 0)} έξοδα τον χρόνο`,
                  term === 'short' && stCosts > 0 ? `εκτίμηση κόστους βραχυχρόνιας ${fe(stCosts)}` : null,
                  reg?.label || null,
                ].filter(Boolean).join(' · ')}
          </p>
        </div>
        <ChevronRight size={17} style={{ color: 'var(--text-tertiary)', flexShrink: 0, transform: inputsOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.18s' }} />
      </button>
      {inputsOpen && (<div style={{ marginTop: 16 }}>
      <div {...g4}>
        <NumberInput label="Αξία ακινήτου" value={value} onChange={setValue} suffix="€" />
        {/* Η ΜΟΝΑΔΑ ΧΡΟΝΟΥ ΔΕΝ ΦΕΥΓΕΙ ΑΠΟ ΤΗΝ ΕΤΙΚΕΤΑ ΟΤΑΝ ΑΛΛΑΖΕΙ Ο ΤΡΟΠΟΣ.
            Σε βραχυχρόνια η ετικέτα γινόταν σκέτο «Ενοίκιο μακροχρόνιας» και
            καθόταν δίπλα στα «Ετήσια έξοδα»: δύο πεδία, ένα με μονάδα και ένα
            χωρίς, ενώ το ποσό είναι μηνιαίο και πολλαπλασιάζεται επί δώδεκα. */}
        {/* Στη βραχυχρόνια η μονάδα πάει στο επίθεμα: το «Μηνιαίο ενοίκιο
            μακροχρόνιας» έπιανε δύο γραμμές δίπλα σε τρεις ετικέτες μίας. */}
        <NumberInput label={term === 'short' ? 'Ενοίκιο μακροχρόνιας' : 'Μηνιαίο ενοίκιο'} value={rent} onChange={v => { setRent(v); setScenario(true); }} suffix={term === 'short' ? '€/μήνα' : '€'} />
        <NumberInput label="Ετήσια έξοδα" value={opex} onChange={v => { setOpex(v); setOpexYear(null); setOpexCats([]); }} suffix="€" />
        <CustomSelect label="Περιοχή" value={region} onChange={setRegion} options={REGIONS.map((r, i) => ({ value: r.key, label: r.label, header: r.region !== REGIONS[i - 1]?.region ? r.region : undefined }))} />
      </div>
      {opexYear !== null && (
        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', margin: '10px 0 0', fontFamily: SANS, lineHeight: 1.55 }}>
          Τα «Ετήσια έξοδα» προσυμπληρώθηκαν με όσα έξοδα του {opexYear} έχεις καταχωρήσει. Η χρονιά δεν έχει κλείσει, οπότε το ετήσιο ποσό μπορεί να είναι μεγαλύτερο.
        </p>
      )}
      {showEstValue && (
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 'var(--fs-base)', fontFamily: SANS, color: 'var(--text-secondary)' }}>
          <span>Ενδεικτική εκτίμηση αξίας για την περιοχή{pSqm ? ` (${pSqm} τ.μ.)` : ''}: <strong style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{fe(estValue)}</strong></span>
          <TermInfo term="Ενδεικτική εκτίμηση αξίας" text={`Ενδεικτικός υπολογισμός: μέση τιμή ανά τετραγωνικό μέτρο στην περιοχή, επί τα τ.μ. και τον συντελεστή τύπου του ακινήτου. Δεν υποκαθιστά την αντικειμενική αξία ούτε την εκτίμηση πιστοποιημένου εκτιμητή. Χρησιμοποίησέ την ως αφετηρία και προσάρμοσέ την στην πραγματική κατάσταση, τον όροφο και τη θέση του ακινήτου.`} />
          {/* Ο τόνος accent δεν ταξιδεύει: η όψη ζει στο `.po-btn` και το κουμπί
              είναι δευτερεύουσα ενέργεια, όχι η κύρια της κάρτας. Το ύψος 28
              ανεβαίνει στην κοινή κλίμακα, που σε δάχτυλο γίνεται στόχος αφής. */}
          <Btn variant="secondary" onClick={() => setValue(String(estValue))}>Χρήση</Btn>
        </div>
      )}
      {term === 'short' && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: SANS }}>Παράμετροι βραχυχρόνιας</span>
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: SANS }}>
              {fromBookings && booked
                ? `· πληρότητα και τιμή από ${fn(booked.nights, 0)} νύχτες των τελευταίων 12 μηνών`
                : `· προσυμπληρωμένες από τα δεδομένα αναφοράς της περιοχής${pSqm ? `, για ${pSqm} τ.μ.` : ''}`}
            </span>
          </div>
          <div {...g4}>
            <NumberInput label="Ετήσια πληρότητα" value={stOcc} onChange={v => { setStOcc(v); setScenario(true); }} suffix="%" max={100} labelInfo={<TermInfo term="Ετήσια πληρότητα" text={G.occupancy} />} />
            <NumberInput label="Μέση τιμή ανά νύχτα" value={stAdr} onChange={v => { setStAdr(v); setScenario(true); }} suffix="€" labelInfo={<TermInfo term="Μέση τιμή ανά νύχτα" text={G.adr} />} />
            <NumberInput label="Καθαρισμός ανά διαμονή" value={stClean} onChange={setStClean} suffix="€" />
            <NumberInput label="Προμήθεια πλατφόρμας" value={stFee} onChange={setStFee} suffix="%" max={100} labelInfo={<TermInfo term="Προμήθεια πλατφόρμας" text={G.platform_fee} />} />
          </div>
          {!empty && y.grossYield > MAX_ST_GROSS_YIELD_WARN && (
            <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', fontFamily: SANS, lineHeight: 1.5 }}>
                Η μεικτή απόδοση προκύπτει <strong style={{ color: 'var(--text-primary)' }}>{fp(y.grossYield)}</strong>, ασυνήθιστα υψηλή. Σε ισχυρές τουριστικές αγορές μπορεί να είναι πραγματική· διαφορετικά έλεγξε την αξία και τη μέση τιμή ανά νύχτα.
              </p>
            </div>
          )}
        </div>
      )}
      </div>)}
      {/* Η άδεια κατάσταση έλεγε με εικονίδιο και τίτλο ό,τι λέει ήδη ο
          υπότιτλος της ενότητας από πάνω, δύο εκατοστά πιο ψηλά. */}
    </div>
  );
}
