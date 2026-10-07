'use client';
// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΤΡΕΙΣ ΕΝΟΤΗΤΕΣ ΑΓΟΡΑΣ ΤΗΣ ΑΠΟΔΟΣΗΣ: Η ΠΕΡΙΟΧΗ ΣΟΥ, ΙΣΤΟΡΙΚΗ ΔΙΑΔΡΟΜΗ,
// ΣΥΓΚΡΙΣΗ ΜΕ ΕΝΑΛΛΑΚΤΙΚΕΣ ΕΠΕΝΔΥΣΕΙΣ
// ─────────────────────────────────────────────────────────────────────────
// Ζούσαν μέσα στο σώμα του TabRentROI. Δεν κρατούν δική τους κατάσταση: κάθε
// αριθμός και κάθε setter έρχεται από την καρτέλα, ώστε ο ορίζοντας που
// διαλέγεις εδώ να είναι ο ίδιος που διαβάζουν η αναφορά και η επενδυτική
// ανάλυση.
// ═══════════════════════════════════════════════════════════════════════════
import { T, fe, fp, ABSENT_SHORT, fixedCols, widestOf, Stat, Btn } from '@/components/Theme';
import { NumberInput, fieldLabelStyle, SegmentControl } from '../UIComponents';
import { TrendingUp, Landmark, Layers } from 'lucide-react';
import type { ComparisonRow, YieldBreakdown } from '@/lib/market/returns';
import {
  BENCHMARKS_ASOF, HISTORY_ANCHORS, GREECE_AVG_GROSS_YIELD, ATHENS_AVG_GROSS_YIELD, MARKET_DATA_ASOF,
  type RegionYield, type ShortTermStat,
} from '@/lib/market/greekMarket';
import { hy } from '@/components/Hyphen';
import { GLOSSARY as G } from '@/lib/market/glossary';
import { InfoHint } from '../InfoHint';
import { SANS, feC, Section, BarRow, TermInfo, yearOpts, type SetState } from './Bits';
import { AreaChart, LineChart } from './charts';

type CagrRef = { pct: number; fromYear: number; toYear: number; years: number };

// 1) Η περιοχή σου
export function AreaSection({ term, y, stRef, reg, stBasis, verdictLabel, stExact, commStat }: {
  term: 'long' | 'short'; y: YieldBreakdown; stRef: ShortTermStat; reg: RegionYield | undefined;
  stBasis: 'bookings' | 'area' | 'own'; verdictLabel: string; stExact: ShortTermStat | undefined;
  commStat: { postal: string; count: number; median: number; p25: number; p75: number } | null;
}) {
  return (
    <Section icon={<Landmark size={15} />} title="Η περιοχή σου" sub={`Σύγκριση με τα δεδομένα της αγοράς (${MARKET_DATA_ASOF})`} defaultOpen>
      {term === 'short' ? (() => {
        const m = Math.max(y.grossYield, stRef.grossYield, reg?.grossYield || 5) * 1.1;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Όταν η πληρότητα και η τιμή είναι της περιοχής, η μπάρα δεν
                λέγεται «Το ακίνητό σου»: είναι η περιοχή με την αξία του. */}
            <BarRow label={stBasis === 'area' ? 'Με τα δεδομένα περιοχής' : 'Το ακίνητό σου'} value={y.grossYield} max={m} valueLabel={fp(y.grossYield)} tone="accent" hint="Μεικτή απόδοση βραχυχρόνιας" />
            <BarRow label="Τυπική βραχυχρόνια" value={stRef.grossYield} max={m} valueLabel={fp(stRef.grossYield)} tone="neutral" hint={stRef.note} />
            <BarRow label="Μακροχρόνια στην ίδια περιοχή" value={reg?.grossYield || 0} max={m} valueLabel={fp(reg?.grossYield || 0)} tone="muted" hint={reg?.note} />
          </div>
        );
      })() : (() => {
        const m = Math.max(y.grossYield, reg?.grossYield || 5, ATHENS_AVG_GROSS_YIELD) * 1.1;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <BarRow label="Το ακίνητό σου" value={y.grossYield} max={m} valueLabel={fp(y.grossYield)} tone="accent" />
            <BarRow label={reg?.label || 'Περιοχή'} value={reg?.grossYield || 0} max={m} valueLabel={fp(reg?.grossYield || 0)} tone="neutral" hint={reg?.note} />
            <BarRow label="Μέσος όρος Αθήνας" value={ATHENS_AVG_GROSS_YIELD} max={m} valueLabel={fp(ATHENS_AVG_GROSS_YIELD)} tone="muted" />
            <BarRow label="Εθνικός μέσος όρος" value={GREECE_AVG_GROSS_YIELD} max={m} valueLabel={fp(GREECE_AVG_GROSS_YIELD)} tone="muted" />
          </div>
        );
      })()}
      <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
        <p style={{ margin: 0, fontSize: 'var(--fs-base)', color: 'var(--text-primary)', fontFamily: SANS, fontWeight: 600 }}>{verdictLabel}</p>
        {/* ΤΗΣ ΒΡΑΧΥΧΡΟΝΙΑΣ Η ΣΗΜΕΙΩΣΗ ΤΗΣ ΒΡΑΧΥΧΡΟΝΙΑΣ. Κάτω από «Κοντά στην
            τυπική βραχυχρόνια» καθόταν η σημείωση της μακροχρόνιας («Κυψέλη
            5,4% έως 7,3%…»), δίπλα σε «Τυπική βραχυχρόνια 8,00%». */}
        {(() => {
          const note = term === 'short'
            ? (stExact?.note ?? (reg ? `Μακροχρόνια μίσθωση: ${reg.note}` : null))
            : reg?.note ?? null;
          return note ? <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-tertiary)', fontFamily: SANS, lineHeight: 1.5 }}>{note}</p> : null;
        })()}
      </div>
      {commStat && (
        <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-primary)', fontFamily: SANS, fontWeight: 600, display: 'flex', alignItems: 'center' }}>Δεδομένα κοινότητας PROPERWISE<TermInfo term="Δεδομένα κοινότητας" text={G.community} /></p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-tertiary)', fontFamily: SANS, lineHeight: 1.5 }}>
            Ταχυδρομικός κώδικας {commStat.postal}: διάμεση μεικτή απόδοση <strong style={{ color: 'var(--text-secondary)' }}>{fp(commStat.median)}</strong> (εύρος {fp(commStat.p25)} έως {fp(commStat.p75)}), από {commStat.count} πραγματικά ακίνητα χρηστών. Ανώνυμα και συγκεντρωτικά.
          </p>
        </div>
      )}
      {term === 'short' && (
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-secondary)', fontFamily: SANS, lineHeight: 1.55 }}>
          {/* ΟΙ ΔΥΟ ΑΠΟΔΟΣΕΙΣ ΗΤΑΝ ΗΔΗ ΣΤΙΣ ΜΠΑΡΕΣ ΑΠΟ ΠΑΝΩ. Η παράγραφος τις
              ξαναέγραφε («μεικτή 8,00% έναντι 5,00% στη μακροχρόνια»), δηλαδή
              έλεγε με λέξεις ό,τι μόλις είχε δείξει με σχήμα. Μένει ό,τι οι
              μπάρες ΔΕΝ λένε: πληρότητα, τιμή νύχτας και πόσο τρώνε τα έξοδα. */}
          {stExact
            // Η κόκκινη ζώνη δεν ξαναγράφεται εδώ ως γενική απαγόρευση: ισχύει
            // σε συγκεκριμένα δημοτικά διαμερίσματα και το λέει η σημείωση
            // της περιοχής από πάνω, από την ίδια πηγή δεδομένων.
            ? <>Δεδομένα αναφοράς περιοχής: πληρότητα περίπου {stExact.occupancy}%, μέση τιμή {fe(stExact.adr)} ανά νύχτα. </>
            : <>Στη βραχυχρόνια τα μεικτά έσοδα είναι συνήθως υψηλότερα, με έντονη όμως εποχικότητα. </>}
          {/* Η ΠΑΡΕΝΘΕΣΗ ΜΕ ΤΑ ΤΕΣΣΕΡΑ ΠΑΡΑΔΕΙΓΜΑΤΑ ΕΦΥΓΕ. Τρεις σειρές για μια
              πρόταση· τα «καθαρισμοί, διαχείριση, τέλος ανθεκτικότητας,
              κενές νύχτες» δεν αλλάζουν τίποτα στην απόφαση: ο αριθμός είναι
              το 40 έως 60%. */}
          Η καθαρή απόδοση είναι σημαντικά χαμηλότερη από τη μεικτή: τα λειτουργικά έξοδα απορροφούν 40 έως 60% των εσόδων.
        </div>
      )}
    </Section>
  );
}

// 2) Ιστορική διαδρομή
/* ═══ ΤΕΣΣΕΡΙΣ ΕΠΙΛΟΓΕΙΣ ΟΡΙΖΟΝΤΑ ΣΕ ΜΙΑ ΟΘΟΝΗ, ΚΑΝΕΝΑΣ ΜΕ ΟΝΟΜΑ ══════
    Η καρτέλα έχει τέσσερα χειριστήρια ετών: το παράθυρο του ιστορικού,
    τον ορίζοντα της σύγκρισης, τον ορίζοντα του ανατοκισμού και τον
    ορίζοντα κατοχής. Τα δύο τελευταία έχουν ετικέτα· τα δύο πρώτα
    κάθονταν γυμνά και το ΜΟΝΟ ίχνος του τι κυβερνούν ήταν η τιμή τους
    ξαναγραμμένη μέσα στον τίτλο («Ιστορική διαδρομή 10ετίας», «πραγματικές
    αποδόσεις 10ετίας»), δέκα εικονοστοιχεία πιο πάνω από τον ίδιο τον
    διακόπτη. Δηλαδή ο τίτλος έκανε τη δουλειά της ετικέτας, λέγοντας
    δύο φορές το ίδιο νούμερο.

    Η ετικέτα του πρώτου διαβάζεται μαζί με την επιλογή του, «Τελευταία
    10 έτη»: μετρήθηκε ότι το «Παράθυρο γραφήματος» έσπαγε σε δύο σειρές
    στα 320 και στα 375 εικονοστοιχεία.

    Τώρα κάθε επιλογέας λέει ΤΙ ΚΥΒΕΡΝΑ, με τη δική του ετικέτα· ο
    τίτλος λέει τι είναι η ενότητα. Η τιμή γράφεται μία φορά, στον
    διακόπτη. */
export function HistorySection({ histYears, setHistYears, hist, histStart, histEnd }: {
  histYears: '10' | '20'; setHistYears: SetState<'10' | '20'>; hist: { year: number; value: number }[];
  histStart: number; histEnd: number;
}) {
  return (
    <Section icon={<TrendingUp size={15} />} title="Ιστορική διαδρομή" sub="Πώς θα κινούνταν η αξία ενός ακινήτου όπως το δικό σου (δείκτης Τράπεζας της Ελλάδος)" info={G.hist_index}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <label style={{ ...fieldLabelStyle, margin: 0 }}>Τελευταία</label>
        <SegmentControl ariaLabel="Ορίζοντας ιστορικής διαδρομής" value={histYears} onChange={v => setHistYears(v as typeof histYears)} options={yearOpts(10, 20)} />
      </div>
      <AreaChart points={hist} />
      {/* ═══ ΛΕΖΑΝΤΑ ΜΟΝΟ ΓΙΑ ΣΗΜΑΔΙΑ ΠΟΥ ΥΠΑΡΧΟΥΝ ═══════════════════════
          Ηταν σταθερή τριάδα «Σήμερα · Κορυφή 2008 · Πυθμένας 2017». Στην
          προβολή δεκαετίας η καμπύλη ξεκινά το 2016, οπότε το `marks` του
          γραφήματος δεν βρίσκει το 2008 και δεν ζωγραφίζει κουκκίδα: η
          λεζάντα εξηγούσε σημάδι που δεν υπήρχε. Οι χρονιές έρχονται τώρα
          από τα HISTORY_ANCHORS, όχι γραμμένες στο χέρι δίπλα τους. */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
        {([['Σήμερα', 'var(--accent)'] as [string, string]]
          .concat(hist.some(p => p.year === HISTORY_ANCHORS.peakYear) ? [[`Κορυφή ${HISTORY_ANCHORS.peakYear}`, 'var(--text-tertiary)']] : [])
          .concat(hist.some(p => p.year === HISTORY_ANCHORS.troughYear) ? [[`Πυθμένας ${HISTORY_ANCHORS.troughYear}`, 'var(--text-tertiary)']] : [])
        ).map(([l, c]) => (
          <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: SANS }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: c }} />{l}</span>
        ))}
      </div>
      {/* ΤΡΙΤΗ ΓΡΑΦΗ ΤΗΣ ΙΔΙΑΣ ΓΡΑΜΜΗΣ, ΜΕ ΤΕΤΑΡΤΟ ΜΕΓΕΘΟΣ. Ετικέτα 11 με
          0,4px γράμμα και νούμερο σταθερά 15, ενώ δύο ενότητες πιο κάτω η
          ίδια πληροφορία γράφεται στα 16 και αλλού στα 24. Το `Stat` δίνει
          ένα μέγεθος ανά σειρά, από το μακρύτερο νούμερο. */}
      {(() => { const chg = histStart > 0 ? `${histEnd >= histStart ? '+' : ''}${fp(((histEnd - histStart) / histStart) * 100)}` : ABSENT_SHORT
        const row = [[String(hist[0]?.year ?? ''), fe(histStart)], ['Σήμερα', fe(histEnd)], ['Μεταβολή', chg]] as const
        const w = widestOf(...row.map(([, v]) => v))
        return (
          <div {...fixedCols(3, 16, 'start')} style={{ ...fixedCols(3, 16, 'start').style, marginTop: 12 }}>
            {row.map(([k, v]) => <Stat key={k} label={k} value={v} chars={w} />)}
          </div>
        ) })()}
      {/* Η μακρά ιστορία λέγεται μόνο όταν φαίνεται. Κάτω από γράφημα που
          ξεκινά το 2016, μια πρόταση για την κορυφή του 2008 ζητά από τον
          αναγνώστη να πιστέψει κάτι που δεν μπορεί να δει. */}
      {/* Η ΕΠΙΦΥΛΑΞΗ ΛΕΓΕΤΑΙ ΜΙΑ ΦΟΡΑ, ΣΤΗΝ ΚΑΡΤΑ ΤΩΝ ΠΗΓΩΝ. Ήταν γραμμένη
          εδώ με έντονα, στη σύγκριση εναλλακτικών και μέσα στο
          MARKET_DISCLAIMER: τρία αντίγραφα της ίδιας πρότασης σε μία
          καρτέλα. Όσο πιο συχνά γράφεται μια επιφύλαξη, τόσο λιγότερο
          διαβάζεται. Εδώ μένει το ιστορικό, που είναι μέτρηση. */}
      {/* ΜΑΚΡΙΑ ΓΡΑΜΜΗ ΘΕΛΕΙ ΑΕΡΑ. Στα 20 έτη η υποσημείωση παίρνει και τις
          δύο προτάσεις (κύκλος 2008 ως 2017 συν πρόσφατα), δηλαδή 115
          χαρακτήρες ανά γραμμή με ύψος γραμμής 1,5: το μάτι χάνει τη σειρά
          γυρίζοντας αριστερά. Ο σαρωτής το έπιασε σε δέκα οθόνες, μόλις ο
          κοινός επιλογέας ετών του επέτρεψε να φτάσει ως εκείνη την
          κατάσταση — με τον προηγούμενο, χειρόγραφο, δεν την είχε δει ποτέ. */}
      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', margin: '12px 0 0', fontFamily: SANS, lineHeight: 1.7 }}>{hist.some(p => p.year === HISTORY_ANCHORS.peakYear) ? `${HISTORY_ANCHORS.long} ${HISTORY_ANCHORS.recent}` : HISTORY_ANCHORS.recent}</p>
    </Section>
  );
}

// 3) Σύγκριση με εναλλακτικές
export function CompareSection({
  nVal, apprId, apprShown, setAppreciation, setApprTouched, apprTouched, apprRef, cmpYears, setCmpYears,
  longIsOther, apprLong, projSeries, compare, compMax,
}: {
  nVal: number; apprId: string; apprShown: string; setAppreciation: SetState<string>; setApprTouched: SetState<boolean>;
  apprTouched: boolean; apprRef: CagrRef; cmpYears: '10' | '20'; setCmpYears: SetState<'10' | '20'>;
  longIsOther: boolean; apprLong: CagrRef;
  projSeries: { label: string; color: string; points: { year: number; value: number }[] }[];
  compare: ComparisonRow[]; compMax: number;
}) {
  return (
    <Section icon={<Layers size={15} />} title="Σύγκριση με εναλλακτικές επενδύσεις" sub={`Ίδιο ποσό (${fe(nVal)}) με τις ονομαστικές τους αποδόσεις`} info={G.total_return}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 12 }}>
        {/* Η ΟΜΑΔΑ ΤΥΛΙΓΕΤΑΙ ΚΙ ΑΥΤΗ, ΟΧΙ ΜΟΝΟ Ο ΓΟΝΕΑΣ ΤΗΣ. Ετικέτα 148,
            πεδίο 120 και σήμα ΤτΕ 76 δένονταν σε ένα αδιαίρετο κομμάτι 272:
            μετρημένο σε 320, η κάρτα δίνει 258 και το σήμα έβγαινε
            δεκατέσσερα έξω. Ο γονέας τύλιγε ήδη, αλλά τύλιγε ολόκληρη την
            ομάδα σε δική της σειρά, όπου πάλι δεν χωρούσε. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, rowGap: 6, flexWrap: 'wrap' }}>
          <label htmlFor={apprId} style={{ ...fieldLabelStyle, margin: 0, alignItems: 'center' }}>Ετήσια ανατίμηση ακινήτου</label>
          {/* ΤΑ 90 ΔΕΝ ΧΩΡΟΥΣΑΝ ΤΗΝ ΤΙΜΗ. Το επίθεμα «%» παίρνει 33, το
              γέμισμα του πεδίου 28 και το περίγραμμα 2: μένουν 22 για τον
              αριθμό, που ζητά 29 για το «6,8». Μετρημένο σε Chromium και
              στα οκτώ πλάτη. Τα 120 αφήνουν 52, δηλαδή χωρούν και το
              «10,5» με περιθώριο. */}
          <div style={{ width: 120 }}><NumberInput id={apprId} value={apprShown} onChange={v => { setAppreciation(v); setApprTouched(true); }} suffix="%" max={20} /></div>
          {/* Το ίδιο σήμα με δύο λεκτικά· το στυλ γραφόταν δύο φορές. */}
          <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontFamily: SANS, border: '1px solid var(--border-default)', borderRadius: T.radius.chip, padding: '3px 7px' }}>{apprTouched ? 'δική σου υπόθεση' : 'δείκτης ΤτΕ'}</span>
          {apprTouched && (
            <Btn variant="secondary" onClick={() => { setAppreciation(''); setApprTouched(false); }}>
              Επαναφορά στο τεκμηριωμένο ({fp(apprRef.pct)})
            </Btn>
          )}
        </div>
        {/* ═══ ΔΥΟ ΟΜΑΔΕΣ ΣΕ ΜΙΑ ΣΕΙΡΑ ΚΑΙ ΦΑΙΝΟΤΑΝ ΜΙΑ ═════════════════
            Η σειρά έτρεχε «Ετήσια ανατίμηση ακινήτου [6,80 %] ΔΕΙΚΤΗΣ ΤΤΕ
            Ορίζοντας σύγκρισης [10 έτη][20 έτη]» χωρίς τίποτα να δείχνει
            πού τελειώνει το ένα χειριστήριο και πού αρχίζει το άλλο: το
            σήμα της ΤτΕ καθόταν ανάμεσα στο πεδίο και στην επόμενη ετικέτα,
            οπότε το μάτι δεν ήξερε σε ποιο από τα δύο ανήκει.

            ΚΑΙ ΟΙ ΔΥΟ ΕΤΙΚΕΤΕΣ ΕΙΧΑΝ ΑΛΛΟ ΒΑΡΟΣ: η πρώτη γραμμένη με το
            χέρι (12, δεύτερη βαθμίδα), η δεύτερη με την κοινή
            `fieldLabelStyle` (12, βάρος 500). Ιδια σειρά, δύο ιδιώματα.

            Τώρα η κάθε ομάδα είναι δικό της κουτί με το δικό της κενό, μια
            τρίχα τις χωρίζει και οι δύο ετικέτες διαβάζουν την ίδια πηγή.
            Οταν η σειρά τυλίγεται, η τρίχα εξαφανίζεται μαζί με τη σειρά. */}
        <span aria-hidden style={{ width: 1, alignSelf: 'stretch', minHeight: 24, background: 'var(--border-subtle)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, rowGap: 6, flexWrap: 'wrap' }}>
          <label style={{ ...fieldLabelStyle, margin: 0, alignItems: 'center' }}>Ορίζοντας σύγκρισης</label>
          <SegmentControl ariaLabel="Ορίζοντας σύγκρισης" value={cmpYears} onChange={v => setCmpYears(v as typeof cmpYears)} options={yearOpts(10, 20)} />
        </div>
      </div>
      {/* ═══ ΑΠΟ ΠΟΥ ΒΓΑΙΝΕΙ Η ΠΡΟΕΠΙΛΟΓΗ ΚΑΙ ΔΥΟ ΨΕΜΑΤΑ ΠΟΥ ΕΦΥΓΑΝ ══════
          Ηταν «3%» χωρίς πηγή, δηλαδή ο αριθμός που αποφάσιζε μόνος του το
          συμπέρασμα της σύγκρισης. Μετρήθηκε. Η πρόταση όμως που τον
          εξηγούσε έλεγε δύο πράγματα που δεν ίσχυαν πάντα:

          1. «ΓΙΑ ΣΥΓΚΡΙΣΗ, Η ΜΑΚΡΑ ΠΕΡΙΟΔΟΣ…» ΗΤΑΝ Η ΙΔΙΑ ΠΕΡΙΟΔΟΣ. Στα
             «20 έτη» το `apprRef` και το `apprLong` είναι κυριολεκτικά η
             ίδια κλήση `historyPriceCagr(20)`. Ο δείκτης ΤτΕ ξεκινά το
             2007, οπότε και τα δύο μετρούν 2007 ως 2026. Η οθόνη τύπωνε
             ίδιο ζεύγος χρονιών και ίδιο ποσοστό δύο φορές και εισήγαγε το
             δεύτερο ως αντίλογο του πρώτου.

          2. «Ο ΙΔΙΟΣ ΟΡΙΖΟΝΤΑΣ ΜΕ ΤΙΣ ΕΝΑΛΛΑΚΤΙΚΕΣ» ΔΕΝ ΕΙΝΑΙ Ο ΙΔΙΟΣ.
             Ζητώντας 20 έτη ο δείκτης δίνει 19 (2007 ως 2026), ενώ οι
             εναλλακτικές τρέχουν με πραγματική 20ετία. Ο ισχυρισμός
             γράφεται πλέον μόνο όταν τα δύο νούμερα συμπίπτουν. */}
      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', margin: '0 0 12px', fontFamily: SANS, lineHeight: 1.55 }}>
        {/* Μένει Η ΠΗΓΗ του νούμερου, που είναι ο λόγος να το εμπιστευτείς.
            Τα υπόλοιπα τετρακόσια είναι επιχειρηματολογία: γιατί άλλη
            περίοδος δίνει άλλο νούμερο και τι σημαίνει αν το αλλάξεις. */}
        Προεπιλογή <strong style={{ color: 'var(--text-secondary)' }}>{fp(apprRef.pct)}</strong>: μέση ετήσια μεταβολή του δείκτη τιμών κατοικιών της Τράπεζας της Ελλάδος, {apprRef.fromYear} ως {apprRef.toYear}.{' '}
        <InfoHint label="Από πού βγαίνει η προεπιλογή ανατίμησης">
          <span style={{ display: 'block' }}>Είναι {apprRef.years} έτη{apprRef.years === parseInt(cmpYears) ? ', ο ίδιος ορίζοντας με τις εναλλακτικές παρακάτω' : ''}.{longIsOther ? ` Για σύγκριση, η μακρά περίοδος από το ${apprLong.fromYear} ως το ${apprLong.toYear} δίνει ${fp(apprLong.pct)}, επειδή περιλαμβάνει την κρίση.` : ''}</span>
          <span style={{ display: 'block', marginTop: 8 }}>{longIsOther ? 'Καμία από τις δύο δεν είναι πρόβλεψη' : 'Δεν είναι πρόβλεψη'}· αν βάλεις άλλο νούμερο, είναι δική σου υπόθεση και βαραίνει όσο και το υπόλοιπο της σελίδας.</span>
        </InfoHint>
      </p>
      {/* Προβολή-γραμμή: ακίνητο vs κορυφαία εναλλακτική στον χρόνο */}
      {projSeries.length === 0 ? (
        <div style={{ padding: '18px 16px', borderRadius: T.radius.popup, border: '1px dashed var(--border-default)', background: 'var(--bg-elevated)', marginBottom: 12 }}>
          <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', margin: 0, fontFamily: SANS, lineHeight: 1.55 }}>
            Συμπλήρωσε την <strong style={{ color: 'var(--text-primary)' }}>αξία του ακινήτου</strong> για να συγκριθεί με τις εναλλακτικές επενδύσεις.
            Χωρίς αυτήν δεν υπάρχει ποσό να προβληθεί και ένα νούμερο βγαλμένο από το πουθενά θα διάβαζε σαν δικό σου.
          </p>
        </div>
      ) : <LineChart series={projSeries} />}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '2px 0 14px' }}>
        {projSeries.map(s => (
          <span key={s.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: SANS }}><span style={{ width: 12, height: 2.5, borderRadius: 3, background: s.color }} />{s.label}</span>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {compare.map(c => (
          (() => {
            const m = /^(.*?)\s*\((.*)\)$/.exec(c.label);
            const name = m ? m[1] : c.label;
            return <BarRow key={c.key} label={name} sub={m?.[2]} valueSub={`${fp(c.annualReturnPct)} τον χρόνο`} value={c.futureValue} max={compMax} valueLabel={feC(c.futureValue)} tone={c.key === 'property' ? 'accent' : 'neutral'} hint={`${fp(c.annualReturnPct)} ετησίως · ${c.totalReturnPct >= 0 ? '+' : ''}${fp(c.totalReturnPct)} συνολικά`} />;
          })()

        ))}
      </div>
      {/* ═══ ΕΝΝΙΑΚΟΣΙΟΙ ΧΑΡΑΚΤΗΡΕΣ ΚΑΤΩ ΑΠΟ ΤΕΣΣΕΡΙΣ ΜΠΑΡΕΣ ══════════════════
          Η παράγραφος ήταν μονίμως ορατή και έλεγε πέντε πράγματα μαζί: τι
          δείχνουν οι μπάρες, τι έγινε στην κρίση, γιατί το ακίνητο δεν είναι
          ρευστό, πόσο κοστίζει η αγοραπωλησία και μια νομική επιφύλαξη.
          Μετρημένο στον πάγκο, στα 1440: έπιανε 537 εικονοστοιχεία μέσα σε
          κάρτα 1.392 και άφηνε 855 κενά δεξιά της.

          ΟΡΑΤΟ ΜΕΝΕΙ ΤΟ ΤΙ ΔΕΙΧΝΟΥΝ ΟΙ ΜΠΑΡΕΣ, γιατί χωρίς αυτό οι μπάρες
          δεν διαβάζονται. Ολα τα υπόλοιπα είναι απάντηση στο «γιατί όχι
          απλώς να πουλήσω και να τα βάλω αλλού», δηλαδή δεύτερη ερώτηση. Πάνε
          πίσω από το κυκλάκι αυτούσια, χωρίς να χαθεί ούτε ένα νούμερο.

          Η ΕΠΙΦΥΛΑΞΗ ΔΕΝ ΚΡΥΒΕΤΑΙ, ΦΕΥΓΕΙ ΩΣ ΔΙΠΛΟΤΥΠΙΑ. Το «Παρελθούσες
          αποδόσεις δεν εγγυώνται μελλοντικές» γραφόταν ΤΡΕΙΣ φορές στην ίδια
          καρτέλα: εδώ, στο ιστορικό των τιμών πιο πάνω και στο MARKET_DISCLAIMER
          της κάρτας πηγών στο τέλος. Μένει στην κάρτα πηγών, που είναι το
          σημείο της και είναι ορατή χωρίς πάτημα.

          ΚΑΙ Η ΚΡΙΣΗ ΑΝΑΦΕΡΕΤΑΙ ΜΟΝΟ ΟΤΑΝ ΕΙΝΑΙ ΜΕΣΑ ΣΤΟΝ ΟΡΙΖΟΝΤΑ. Η
          πρόταση για τη 20ετία γραφόταν και με επιλεγμένη τη 10ετία, δηλαδή
          περιέγραφε γράφημα που ο χρήστης δεν έβλεπε. */}
      <p className="po-prose po-just" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', margin: '12px 0 0', fontFamily: SANS }}>
        {hy(<>Οι εναλλακτικές τρέχουν με τη <strong style={{ color: 'var(--text-secondary)' }}>μέση ετήσια ονομαστική απόδοσή τους της τελευταίας {cmpYears}ετίας</strong>, ως συνολική απόδοση σε ευρώ από επίσημες πηγές, με ορίζοντα {BENCHMARKS_ASOF}. Το ακίνητο τρέχει με τη δική σου καθαρή απόδοση συν ανατίμηση. Όλα προ φόρου εισοδήματος.{' '}
        <InfoHint label="Τι δεν δείχνει η σύγκριση">
          <span style={{ display: 'block' }}>Τα νούμερα είναι μετρημένα, όχι εξομαλυμένες υποθέσεις. Ονομαστικά και τα δύο σκέλη, χωρίς αφαίρεση πληθωρισμού: γι’ αυτό ο πληθωρισμός στέκει ως δική του γραμμή αναφοράς παραπάνω.{cmpYears === '20' ? ' Η 20ετία περιλαμβάνει την κρίση: το Χρηματιστήριο Αθηνών και το ομόλογο είναι σχεδόν μηδενικά.' : ''}</span>
          <span style={{ display: 'block', marginTop: 8 }}>Οι εναλλακτικές είναι <strong>παθητικές και ρευστές</strong>, ενώ το ακίνητο απαιτεί χρόνο, συγκεντρώνει τον κίνδυνο σε ένα περιουσιακό στοιχείο και κοστίζει για να μπεις και να βγεις: μια πλήρης διαδρομή αγοράς και πώλησης είναι τυπικά 4 έως 10% της αξίας, δηλαδή φόρος μεταβίβασης 3% και συμβολαιογραφικά στην αγορά, μεσιτική αμοιβή και νομικός έλεγχος στην πώληση.</span>
          <span style={{ display: 'block', marginTop: 8 }}>Στην ενότητα «Επενδυτική ανάλυση» παρακάτω μπαίνει μόνο το σκέλος του <strong>πωλητή</strong> και το βλέπεις και το αλλάζεις.</span>
        </InfoHint></>)}
      </p>
    </Section>
  );
}
