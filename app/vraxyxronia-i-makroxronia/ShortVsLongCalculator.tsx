'use client';
// ═══════════════════════════════════════════════════════════════════════════
// ΒΡΑΧΥΧΡΟΝΙΑ Ή ΜΑΚΡΟΧΡΟΝΙΑ — ο διαδραστικός πυρήνας
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΑΥΤΟΣ Ο ΤΡΙΤΟΣ ΥΠΟΛΟΓΙΣΤΗΣ ΚΑΙ ΟΧΙ ΚΑΠΟΙΟΣ ΑΛΛΟΣ. Είναι η ερώτηση που
// κάνει κάθε Έλληνας ιδιοκτήτης πριν βάλει ή βγάλει ενοικιαστή, η απάντηση
// υπάρχει ήδη δοκιμασμένη μέσα στην εφαρμογή και κανείς δεν τη δίνει σωστά:
// τα εργαλεία που κυκλοφορούν πολλαπλασιάζουν τιμή επί νύχτες και σταματούν
// εκεί, αγνοώντας το τέλος ανθεκτικότητας, την προμήθεια που δεν εκπίπτει, τα
// λειτουργικά και το ανέβασμα κλιμακίου.
//
// Η ΟΘΟΝΗ ΕΧΕΙ ΤΡΙΑ ΕΠΙΠΕΔΑ, ΜΕ ΑΥΤΗ ΤΗ ΣΕΙΡΑ:
//   1. Η ΕΤΥΜΗΓΟΡΙΑ σε μία πρόταση, με το ποσό της διαφοράς.
//   2. Η ΠΛΗΡΟΤΗΤΑ ΙΣΟΡΡΟΠΙΑΣ, που είναι το νούμερο που πραγματικά αποφασίζει:
//      δεν εξαρτάται από το πόσο αισιόδοξος ήταν ο χρήστης στην πρόβλεψή του.
//   3. Ο ΠΙΝΑΚΑΣ, όπου φαίνεται πού πήγαν τα χρήματα σε κάθε πλευρά.
//
// ΧΩΡΙΣ ΧΡΩΜΑ ΣΤΗΝ ΕΤΥΜΗΓΟΡΙΑ. Ούτε η βραχυχρόνια είναι «σωστή» ούτε η
// μακροχρόνια «λάθος»· είναι δύο νόμιμες επιλογές με διαφορετικό ρίσκο και
// διαφορετική δουλειά. Η έμφαση βγαίνει από μέγεθος και θέση.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useId } from 'react';
import { T, feAuto } from '@/components/tokens';
import { fe, fn, fpRate, feSigned, feWhole } from '@/lib/core/format';
import { parseAmount } from '@/lib/core/greek';
import { compareShortVsLong, netByOccupancy, HIGH_SEASON_NIGHTS, type SeasonSpread } from '@/lib/tools/shortVsLong';
import { climateLevyRates, CLIMATE_LEVY_FROM_2025, FIRST_YEAR_CURRENT_LEVY } from '@/lib/billing/greekTax';
import { REGULATORY_UPDATES_2026 } from '@/lib/accounting/updates2026';
import { useToolState, ToolActions, ToolPaper, ToolPaperFoot } from '@/app/ToolShare';
import { ToolCta, EstimateNote, ToolClampNote } from '@/app/PublicChrome';
import { ToolNumField, ToolSelect, ToolFields, ToolSeg, ToolHint, ToolHero } from '@/app/ToolParts';

import LiveResult from '@/components/LiveResult';
const amount = (s: string): number => Math.max(0, parseAmount(s) ?? 0);

/** Τα πεδία όπως ταξιδεύουν στη διεύθυνση, με τις προεπιλογές τους. */
const SPEC = {
  enoikio: '700', timi: '80', plirotita: '60', tm: '75', typos: 'flat',
  promitheia: '15', kostos: '12', pagia: '90', sezon: 'even',
} as const;

/** Ο κανόνας των «κόκκινων ζωνών», από τη μία πηγή κανόνων της εφαρμογής. */
const AMA_RULE = REGULATORY_UPDATES_2026.find(u => u.id === 'ama-red-zones');

const LEVY = CLIMATE_LEVY_FROM_2025;

/** Τα βήματα πληρότητας του πίνακα ευαισθησίας. */
const OCCUPANCY_STEPS = [30, 40, 50, 60, 70, 80, 90];
const PATH = '/vraxyxronia-i-makroxronia';

const TYPES = [
  { value: 'flat', label: 'Διαμέρισμα' },
  { value: 'house', label: 'Μονοκατοικία' },
];

/** Ακέραια ευρώ, με τυπογραφικό μείον όταν τα καθαρά βγαίνουν αρνητικά. */
const wholeSigned = (n: number) => (Math.round(n) < 0 ? `−${feWhole(-n)}` : feWhole(n));

/**
 * Διαφορά σε ακέραια ευρώ με πρόσημο ΚΑΙ στο κέρδος: «+1.020€», «−330€».
 * Το `feSigned` σημαδεύει μόνο το αρνητικό, οπότε στη στήλη «Έναντι
 * μακροχρόνιας» το «−330,50€» καθόταν δίπλα σε σκέτο «1.020,00€» και το
 * κέρδος δεν διαβαζόταν ως κέρδος.
 */
const delta = (n: number) => {
  const c = Math.round(n * 100) / 100;
  return c > 0 ? `+${fe(c)}` : c < 0 ? `−${fe(-c)}` : fe(0);
};

export function ShortVsLongCalculator({ today }: { today: string }) {
  const [v, set] = useToolState(SPEC, PATH);
  const ids = {
    rent: useId(), price: useId(), occ: useId(), sqm: useId(),
    fee: useId(), cost: useId(), fixed: useId(),
  };

  // ΜΙΑ ΑΝΑΓΝΩΣΗ ΤΩΝ ΠΕΔΙΩΝ, ΤΡΕΙΣ ΧΡΗΣΕΙΣ. Η σύγκριση και ο πίνακας ευαισθησίας
  // πρέπει να τρέχουν πάνω στα ΙΔΙΑ δεδομένα· δύο αντίγραφα του ίδιου
  // αντικειμένου θα απέκλιναν με την πρώτη αλλαγή πεδίου.
  const input = useMemo(() => ({
    monthlyRent: amount(v.enoikio),
    nightlyPrice: amount(v.timi),
    occupancyPct: Math.min(100, amount(v.plirotita)),
    sqm: amount(v.tm),
    isHouse: v.typos === 'house',
    platformFeePct: Math.min(100, amount(v.promitheia)),
    costPerNight: amount(v.kostos),
    fixedPerMonth: amount(v.pagia),
    season: (v.sezon === 'high' ? 'high' : 'even') as SeasonSpread,
  }), [v]);
  const r = useMemo(() => compareShortVsLong(input), [input]);
  // Η ΔΙΚΗ ΣΟΥ ΠΛΗΡΟΤΗΤΑ ΜΠΑΙΝΕΙ ΣΤΟΝ ΠΙΝΑΚΑ. Ο αναγνώστης ψάχνει πρώτα τη
  // γραμμή του και μετά τις γειτονικές· όταν η πληρότητά του δεν είναι βήμα του
  // δέκα, η γραμμή του δεν υπήρχε καν.
  const mine = input.occupancyPct;
  const curve = useMemo(() => netByOccupancy(input,
    [...new Set([...OCCUPANCY_STEPS, mine])].filter(p => p > 0).sort((a, b) => a - b)), [input, mine]);
  const levyRates = climateLevyRates(amount(v.tm), v.typos === 'house');

  /** Πεδίο με μονάδα μέσα του, όπως και στους αδελφούς υπολογιστές. */
  const num = (id: string, key: keyof typeof SPEC, text: string, suffix: string, pad = 34) => (
    <ToolNumField id={id} label={text} value={v[key]} onChange={x => set(key, x)} unit={suffix} unitPad={pad}/>
  );

  // ΑΚΕΡΑΙΟ, ΠΡΟΣ ΤΑ ΠΑΝΩ. Το κατώφλι βγαίνει από μια πληρότητα που ο χρήστης
  // μαντεύει· το «52,45%» υπόσχεται ακρίβεια που η είσοδος δεν έχει. Προς τα
  // πάνω, ώστε το «από 53% και πάνω» να ισχύει και στο όριο.
  const be = r.breakEvenPct === null ? null : Math.ceil(r.breakEvenPct);
  const gap = Math.round(r.short.net) - Math.round(r.long.net);

  return (
    <div style={{ fontFamily: T.font.sans }}>
      {/* ── ΤΙ ΖΗΤΑΜΕ ΚΑΙ ΓΙΑΤΙ ΤΟΣΑ ────────────────────────────────────────
             Οκτώ πεδία είναι περισσότερα από τους άλλους δύο υπολογιστές και
             είναι τα ΛΙΓΟΤΕΡΑ που δίνουν τίμια απάντηση: χωρίς προμήθεια και
             λειτουργικά, η σύγκριση γέρνει ψευδώς προς τη βραχυχρόνια, που
             είναι ακριβώς το λάθος για το οποίο υπάρχει η σελίδα.

             ΟΚΤΩ ΠΕΔΙΑ ΣΕ ΔΥΟ ΣΤΗΛΕΣ ΕΙΝΑΙ ΤΕΣΣΕΡΙΣ ΣΕΙΡΕΣ ΚΑΙ ΦΑΙΝΟΝΤΑΝ.
             Στα 1440 το δοχείο μετρά 1044: με δύο στήλες κάθε πεδίο έπαιρνε 515
             εικονοστοιχεία —διπλάσια από όσα χρειάζεται ένα κουτί αριθμού— και
             η φόρμα κατέβαινε τέσσερις σειρές, σπρώχνοντας το αποτέλεσμα εκτός
             οθόνης. Τέσσερις στήλες δίνουν 4+4 σε δύο ζυγισμένες σειρές, με 250
             ανά πεδίο. Το `fc-roomy` κρατά δύο στήλες στη ζώνη 821–1000, όπου
             οι τέσσερις θα στένευαν τις μακριές ετικέτες
             («Μέση καθαριότητα ανά νύχτα»).

             ΚΑΙ Η ΣΤΟΙΧΙΣΗ ΠΑΕΙ ΣΤΟ ΚΑΤΩ ΑΚΡΟ. Στη ζώνη 1001–1060 το πεδίο
             πέφτει στα 216 και η «Μέση καθαριότητα ανά νύχτα» τυλίγεται:
             με στοίχιση στην αρχή κατέβαινε ΜΟΝΟ το δικό της κουτί κατά μία
             γραμμή, δηλαδή η σειρά έσπαγε σε τρεις στάθμες. Κανένα πεδίο εδώ
             δεν έχει σημείωση από κάτω.

             ΚΑΙ ΣΤΟ ΤΗΛΕΦΩΝΟ ΔΥΟ ΣΤΗΛΕΣ. Στα 390 τα οκτώ πεδία έπεφταν σε μία
             στήλη των 358 εικονοστοιχείων το καθένα (για ένα «60%» ή ένα «12€»)
             και η απάντηση άρχιζε 1.350 εικονοστοιχεία πιο κάτω. Δύο στήλες
             κάνουν τις οκτώ σειρές τέσσερις· κάτω από τα 340 τα ποσά δεν χωρούν
             δίπλα δίπλα και γίνονται πάλι μία. */}
      {/* ΣΤΟ ΚΟΙΝΟ ΠΛΕΓΜΑ ΤΩΝ ΤΕΣΣΑΡΩΝ (`ToolFields`): τέσσερις στήλες, δύο στην
          ταμπλέτα, δύο και στο τηλέφωνο (`xs2`), γιατί κάθε πεδίο εδώ κρατά
          ένα «60» ή ένα «12». Οι ετικέτες κόντυναν ώστε να χωρούν σε μία γραμμή
          και στα 360 («Καθαριότητα ανά διανυκτέρευση» έπιανε δύο και κατέβαζε
          το κουτί της)· η μονάδα μέσα στο πεδίο λέει το «ανά νύχτα».
          Η σειρά: πρώτα τα τέσσερα ποσά της σύγκρισης, μετά τα έξοδα και το
          ακίνητο, τελευταία η παραδοχή της εποχής με τη δική της εξήγηση. */}
      <ToolFields xs2>
        {num(ids.rent, 'enoikio', 'Μηνιαίο ενοίκιο', '€')}
        {num(ids.price, 'timi', 'Τιμή νύχτας', '€')}
        {num(ids.occ, 'plirotita', 'Πληρότητα', '%')}
        {num(ids.fee, 'promitheia', 'Προμήθεια', '%')}
        {num(ids.cost, 'kostos', 'Καθαριότητα', '€/νύχτα', 72)}
        {num(ids.fixed, 'pagia', 'Πάγια', '€/μήνα', 66)}
        {num(ids.sqm, 'tm', 'Τετραγωνικά', 'τ.μ.', 44)}
        <ToolSelect label="Τύπος ακινήτου" value={v.typos}
          onChange={x => set('typos', x)} options={TYPES}/>
        {/* ═══ ΠΟΤΕ ΓΕΜΙΖΕΙ ΤΟ ΑΚΙΝΗΤΟ ═══════════════════════════════════════
            ΔΕΝ ΕΙΝΑΙ ΛΕΠΤΟΜΕΡΕΙΑ. Το τέλος ανθεκτικότητας είναι ΤΕΤΡΑΠΛΑΣΙΟ από
            Απρίλιο ως Οκτώβριο. Με τις ίδιες νύχτες και την ίδια τιμή, το
            εξοχικό που γεμίζει μόνο το καλοκαίρι πληρώνει σχεδόν διπλάσιο τέλος
            από ένα διαμέρισμα πόλης που δουλεύει όλο τον χρόνο. Ιδια προδιαγραφή
            με την «Εισόδημα ποιας χρονιάς» του φόρου ενοικίων (`ToolSeg`). */}
        <ToolSeg label="Πότε γεμίζει" value={input.season} onChange={x => set('sezon', x)}
          options={[{ value: 'even', label: 'Όλο τον χρόνο' }, { value: 'high', label: 'Κυρίως το καλοκαίρι' }]}
          hint={input.season === 'high'
            ? `Οι κρατήσεις πέφτουν πρώτα στους επτά μήνες της υψηλής περιόδου, δηλαδή έως ${HIGH_SEASON_NIGHTS} διανυκτερεύσεις, όπου το τέλος είναι ${feWhole(levyRates.high)} τη διανυκτέρευση. Αλλάζει τι πληρώνει ο επισκέπτης, όχι τι κρατάς εσύ.`
            : `Οι κρατήσεις μοιράζονται ισομερώς στους δώδεκα μήνες. Το τέλος είναι ${feWhole(levyRates.high)} τη διανυκτέρευση από Απρίλιο ως Οκτώβριο και ${feWhole(levyRates.low)} τους υπόλοιπους.`}/>
        {/* ═══ Η ΤΙΜΗ ΤΗΣ ΑΙΧΜΗΣ ΕΙΝΑΙ Η ΠΙΟ ΣΥΝΗΘΗΣ ΑΥΤΟΕΞΑΠΑΤΗΣΗ ═══════════════
            Ο ιδιοκτήτης θυμάται την ΚΑΛΥΤΕΡΗ του βραδιά και τη γράφει εδώ. Το
            εργαλείο ζητά ρητά τον μέσο όρο. Κάθεται δίπλα στην εποχή, στο
            σημείο της φόρμας όπου διαβάζονται οι παραδοχές. */}
        <ToolHint span={2} flush>
          Η τιμή νύχτας είναι η δική σου, χωρίς το τέλος ανθεκτικότητας που πληρώνει ο
          επισκέπτης και αποδίδεις εσύ. Βάλε τον μέσο όρο που πιάνεις μέσα στη χρονιά, όχι
          την τιμή της αιχμής. Τα πάγια είναι ρεύμα, νερό και ίντερνετ, που στη μακροχρόνια τα
          πληρώνει ο ενοικιαστής.
        </ToolHint>
      </ToolFields>
      <ToolClampNote notes={[
        amount(v.plirotita) > 100 && 'Η πληρότητα φτάνει έως 100%· υπολογίστηκε με 100%.',
        amount(v.promitheia) > 100 && 'Η προμήθεια φτάνει έως 100%· υπολογίστηκε με 100%.',
      ]}/>

      {/* ── Η κεφαλίδα του χαρτιού, πάνω από το αποτέλεσμα ─────────────── */}
      <ToolPaper title="Σύγκριση βραχυχρόνιας και μακροχρόνιας" on={today} inputs={[
        { k: 'Μηνιαίο ενοίκιο', v: feAuto(amount(v.enoikio)) },
        { k: 'Τιμή διανυκτέρευσης', v: feAuto(amount(v.timi)) },
        { k: 'Πληρότητα', v: fpRate(amount(v.plirotita)) },
        { k: 'Ακίνητο', v: `${TYPES.find(t => t.value === v.typos)?.label ?? v.typos}, ${fn(amount(v.tm), Number.isInteger(amount(v.tm)) ? 0 : 2)} τ.μ.` },
        { k: 'Προμήθεια', v: fpRate(amount(v.promitheia)) },
        { k: 'Καθαριότητα', v: `${feAuto(amount(v.kostos))} τη νύχτα, κατά μέσο όρο` },
        { k: 'Πάγια', v: `${feAuto(amount(v.pagia))} τον μήνα` },
        { k: 'Πότε γεμίζει', v: input.season === 'high' ? 'κυρίως το καλοκαίρι' : 'όλο τον χρόνο' },
      ]}/>

      {/* ── Το αποτέλεσμα ──────────────────────────────────────────────── */}
      <div className="po-tool-result" style={{
        marginTop: 20, padding: 'clamp(18px, 4vw, 26px)', borderRadius: T.radius.card,
        background: 'var(--surface-raised)', border: '1px solid var(--border-raised)',
        boxShadow: 'var(--well-inset)',
      }}>
        {/* Η ΔΙΑΦΟΡΑ ΕΙΝΑΙ Η ΑΠΑΝΤΗΣΗ, ΑΡΑ ΕΙΝΑΙ ΤΟ ΜΕΓΑΛΟ ΝΟΥΜΕΡΟ. Ηταν πρόταση
            των 20 εικονοστοιχείων πάνω από δύο ισομεγέθη ποσά των 32: το μάτι
            πήγαινε στα ποσά και έκανε μόνο του την αφαίρεση για την οποία ήρθε.
            Τώρα η διαφορά οδηγεί και τα δύο καθαρά την πλαισιώνουν. Η ισοπαλία
            λέγεται ισοπαλία, δεν στρογγυλοποιείται προς κάποια πλευρά.
            ΑΚΕΡΑΙΑ ΕΥΡΩ: όλα εδώ κρέμονται από μια πληρότητα που μαντεύεται. Η
            διαφορά βγαίνει από τα ΣΤΡΟΓΓΥΛΑ ποσά δίπλα της, ώστε να είναι η
            αφαίρεση που θα κάνει ο αναγνώστης. Λεπτά κρατούν οι πίνακες. */}
        <ToolHero
          primary={{
            label: gap === 0 ? 'Διαφορά τον χρόνο' : `Υπέρ ${gap > 0 ? 'βραχυχρόνιας' : 'μακροχρόνιας'}, τον χρόνο`,
            value: gap === 0 ? feWhole(0) : `+${feWhole(Math.abs(gap))}`,
          }}
          secondary={[
            { label: 'Μακροχρόνια, καθαρά', value: wholeSigned(r.long.net) },
            { label: 'Βραχυχρόνια, καθαρά', value: wholeSigned(r.short.net) },
          ]}/>
        <LiveResult say={gap === 0
          ? 'Οι δύο επιλογές αφήνουν ουσιαστικά τα ίδια.'
          : `Η ${gap > 0 ? 'βραχυχρόνια' : 'μακροχρόνια'} αφήνει ${feWhole(Math.abs(gap))} περισσότερα τον χρόνο. Μακροχρόνια ${wholeSigned(r.long.net)}, βραχυχρόνια ${wholeSigned(r.short.net)} καθαρά.`} />

        <div style={{ height: 1, background: 'var(--border-subtle)', margin: '20px 0 16px' }}/>

        {/* ═══ ΤΟ ΝΟΥΜΕΡΟ ΠΟΥ ΑΠΟΦΑΣΙΖΕΙ ═══════════════════════════════════════
            Τα δύο ποσά από πάνω απαντούν για την πληρότητα που ΜΑΝΤΕΨΕ ο
            χρήστης — και ακριβώς αυτήν δεν την ξέρει· είναι η πιο αβέβαιη
            είσοδος ολόκληρης της σελίδας. Το κατώφλι δεν εξαρτάται από την
            πρόβλεψή του: το συγκρίνει με ό,τι ξέρει για τη γειτονιά του και
            απαντά μόνος του. */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
            color: 'var(--text-tertiary)', marginBottom: 8 }}>
            Πληρότητα ισορροπίας
          </div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: 'var(--text-secondary)' }}>
            {be === null
              ? 'Ούτε με πλήρη πληρότητα η βραχυχρόνια δεν φτάνει τη μακροχρόνια, με αυτά τα δεδομένα.'
              : be === 0
                ? 'Η βραχυχρόνια βγαίνει μπροστά από την πρώτη κιόλας κράτηση.'
                : <>Από <strong style={{ color: 'var(--text-primary)', fontFamily: T.font.num,
                    fontVariantNumeric: 'tabular-nums' }}>{fn(be)}%</strong> πληρότητα και πάνω η
                    βραχυχρόνια αφήνει περισσότερα, δηλαδή από{' '}
                    <strong style={{ color: 'var(--text-primary)', fontFamily: T.font.num,
                      fontVariantNumeric: 'tabular-nums' }}>{fn(r.breakEvenNights ?? 0)}</strong>{' '}
                    διανυκτερεύσεις τον χρόνο.</>}
          </p>
        </div>
      </div>

      {/* Οι δύο έξοδοι στην ΙΔΙΑ θέση και στους τέσσερις: αμέσως μετά την κάρτα. */}
      <ToolActions path={PATH} spec={SPEC} values={v}/>

      {/* ── Πού πήγαν τα χρήματα, στις δύο πλευρές ──────────────────────────
             Κάθε γραμμή εκτός από την τελευταία είναι χρήμα που ΦΕΥΓΕΙ, οπότε ο
             πίνακας διαβάζεται ως αφαίρεση που κλείνει: εισπράξεις μείον τα
             τέσσερα δίνουν ακριβώς τα καθαρά. Ένας πίνακας που δεν κλείνει
             μπροστά στον αναγνώστη είναι χειρότερος από κανέναν πίνακα. */}
      <div style={{ marginTop: T.sp.xxl }}>
        <div className="po-table-box">
         <div className="po-scroll-x" style={{ overflowX: 'auto' }}>
          <table className="po-table po-tool-table tbl-fixed" style={{ '--tbl-min': '300px' }}>
            <caption>Πού πάνε τα χρήματα, τον χρόνο</caption>
            {/* ΙΣΕΣ ΟΙ ΔΥΟ ΠΛΕΥΡΕΣ, ΜΕ ΡΗΤΑ ΠΛΑΤΗ. Οι κεφαλίδες γράφονταν με μαλακό
                ενωτικό («Μακρο-/χρόνια») για να χωρέσουν στα 360: ενωτικό σε
                κεφαλίδα στήλης διαβάζεται ως λάθος. Πλέον η στήλη των ετικετών
                δίνει χώρο, το γέμισμα στενεύει στο τηλέφωνο (`.po-tool-table`) και
                η λέξη χωρά ολόκληρη. */}
            <colgroup>
              <col style={{ width: '40%' }} />
              <col style={{ width: '30%' }} />
              <col style={{ width: '30%' }} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col"><span className="sr-only">Κατηγορία</span></th>
                <th scope="col" className="num"><ThLabel full="Μακροχρόνια" short="Μακροχρ." /></th>
                <th scope="col" className="num"><ThLabel full="Βραχυχρόνια" short="Βραχυχρ." /></th>
              </tr>
            </thead>
            <tbody>
              {/* ΟΙ ΕΚΡΟΕΣ ΓΡΑΦΟΝΤΑΙ ΜΕ ΜΕΙΟΝ, ΚΑΙ ΟΣΑ ΔΕΝ ΑΦΟΡΟΥΝ ΤΗ ΜΑΚΡΟΧΡΟΝΙΑ ΔΕΝ
                  ΓΡΑΦΟΝΤΑΙ «0,00€». Η μακροχρόνια δεν έχει τέλος, προμήθεια ή
                  καθαριότητα: το μηδέν εκεί διαβαζόταν ως ποσό που έτυχε μηδέν.
                  Ετικέτες δύο γραμμών το πολύ στα 360· η εξήγηση των εισπράξεων
                  πάει κάτω από τον πίνακα. */}
              <Line k="Εισπράξεις" a={r.long.gross} b={r.short.guestTotal} />
              <Line k="Τέλος ανθεκτικότητας" a={null} b={-r.short.levy} />
              <Line k="Φόρος εισοδήματος" a={-r.long.tax} b={-r.short.tax} />
              <Line k="Προμήθεια πλατφόρμας" a={null} b={-r.short.platformFee} />
              <Line k="Καθαριότητα και πάγια" a={null} b={-r.short.running} />
              <Line k="Καθαρά" a={r.long.net} b={r.short.net} strong />
            </tbody>
          </table>
         </div>
        </div>
        <p className="po-prose" style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>
          Στη βραχυχρόνια οι εισπράξεις περιλαμβάνουν το τέλος ανθεκτικότητας που πληρώνει ο
          επισκέπτης και αποδίδεις εσύ, γι’ αυτό αφαιρείται στην επόμενη γραμμή.
        </p>
      </div>

      {/* ═══ Η ΠΛΗΡΟΤΗΤΑ ΕΙΝΑΙ ΜΑΝΤΕΨΙΑ ΚΑΙ Ο ΠΙΝΑΚΑΣ ΤΟ ΠΑΡΑΔΕΧΕΤΑΙ ══════════
          Ολόκληρο το αποτέλεσμα κρέμεται από ένα νούμερο που ο χρήστης δεν
          ξέρει και το μαντεύει. Ένα εργαλείο που δίνει ΕΝΑ ποσό για ΜΙΑ
          μαντεψιά, χωρίς να δείξει πόσο ευαίσθητο είναι, δίνει βεβαιότητα που
          δεν υπάρχει. Επτά γραμμές δείχνουν τι κοστίζει να πέσει έξω κατά δέκα
          μονάδες — και δεν ζητούν τίποτα παραπάνω από τον χρήστη.
          Η γραμμή που περνά το κατώφλι σημειώνεται με την ίδια απαλή επιφάνεια
          που χρησιμοποιεί ο υπολογιστής φόρου για το ενεργό κλιμάκιο. */}
      <div style={{ marginTop: T.sp.xxl }}>
        <div className="po-table-box">
         <div className="po-scroll-x" style={{ overflowX: 'auto' }}>
          <table className="po-table po-tool-table tbl-fixed" style={{ '--tbl-min': '300px' }}>
            <caption>Αν πέσεις έξω στην πληρότητα</caption>
            {/* ΤΡΕΙΣ ΣΤΗΛΕΣ ΑΝΤΙ ΓΙΑ ΤΕΣΣΕΡΙΣ, Η ΠΡΩΤΗ ΑΡΙΣΤΕΡΑ. Η πληρότητα είναι η
                ταυτότητα της γραμμής, όχι ποσό, οπότε στοιχίζεται όπως κάθε
                ετικέτα· οι νύχτες πάνε από κάτω της. Ετσι τα ποσά παίρνουν
                πλάτος για λεπτά, όπως ο πίνακας από πάνω. Η δική σου πληρότητα
                σημειώνεται· το πρόσημο της διαφοράς έχει και χρώμα, αλλά το λέει
                πρώτα το «+» και το «−». */}
            <colgroup>
              <col style={{ width: '34%' }} />
              <col style={{ width: '33%' }} />
              <col style={{ width: '33%' }} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Πληρότητα</th>
                <th scope="col" className="num">Καθαρά<span className="sr-only"> βραχυχρόνιας</span></th>
                <th scope="col" className="num">Διαφορά<span className="sr-only"> έναντι μακροχρόνιας</span></th>
              </tr>
            </thead>
            <tbody>
              {curve.map(row => {
                const ahead = row.net >= r.long.net, isMine = row.pct === mine;
                const d = row.net - r.long.net;
                return (
                  <tr key={row.pct} className={[ahead && 'is-on', isMine && 'is-mine'].filter(Boolean).join(' ') || undefined}>
                    <th scope="row" style={{ fontWeight: isMine ? 600 : 400, color: 'var(--text-primary)' }}>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fpRate(row.pct)}</span>
                      {isMine && <span className="po-tool-tag">η δική σου</span>}
                      <span style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 400 }}>
                        {fn(row.nights)} νύχτες
                      </span>
                    </th>
                    <td className="num" style={{ fontWeight: ahead ? 600 : 400 }}>{feSigned(row.net)}</td>
                    <td className="num" style={{ color: Math.abs(d) < 0.005 ? undefined : d > 0 ? 'var(--positive)' : 'var(--negative)' }}>
                      {delta(d)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
         </div>
        </div>
      </div>

      {/* ── Τι ΔΕΝ περιλαμβάνει ──────────────────────────────────────────── */}
      {/* ΤΑ ΠΟΣΑ ΤΟΥ ΤΕΛΟΥΣ ΛΕΓΟΝΤΑΝ «ενδεικτικά του 2025» σε σελίδα που υπόσχεται
          2026. Ερχονται πλέον από τον πίνακα που κάνει και τον υπολογισμό
          (lib/billing/greekTax.ts), επιβεβαιωμένο εκεί για τη χρήση 2026. */}
      <div className="po-tool-note" style={{
        marginTop: T.sp.xl, padding: 'clamp(14px,2.6vw,18px)', borderRadius: T.radius.inner,
        background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
      }}>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
          {/* Το κουτί ξεκινά με όσα ΥΠΟΘΕΤΕΙ, οπότε ο τίτλος το λέει (όπως στην καθαρή απόδοση). */}
          <strong style={{ color: 'var(--text-primary)' }}>Τι υποθέτει και τι όχι.</strong>{' '}
          Υποθέτει <strong>φυσικό πρόσωπο με έως δύο ακίνητα</strong>, χωρίς υπηρεσίες πέρα από
          τα κλινοσκεπάσματα: τεκμαρτή έκπτωση 5%, τέλος παρεπιδημούντων μηδέν. Από{' '}
          <strong>τρία και πάνω</strong> η δραστηριότητα γίνεται επιχειρηματική: άλλη κλίμακα,
          καμία έκπτωση, συν τέλος παρεπιδημούντων 0,5%, ΦΠΑ 13% και βιβλία ΕΛΠ. Το τέλος
          ανθεκτικότητας υπολογίζεται με τα ποσά που ισχύουν από το {FIRST_YEAR_CURRENT_LEVY} και για το 2026:{' '}
          {feWhole(LEVY.small.high)} και {feWhole(LEVY.small.low)} τη διανυκτέρευση για
          διαμερίσματα, {feWhole(LEVY.large.high)} και {feWhole(LEVY.large.low)} για
          μονοκατοικίες άνω των 80 τ.μ., με υψηλή περίοδο Απρίλιο ως Οκτώβριο
          (ν.5162/2024). Απ’ έξω: ΕΝΦΙΑ, ασφάλιση, έπιπλα και εξοπλισμός, κενά
          ανακαίνισης, ο χρόνος σου. <EstimateNote />
        </p>
      </div>

      {/* ═══ Ο ΚΑΝΟΝΑΣ ΠΟΥ ΑΚΥΡΩΝΕΙ ΟΛΟΚΛΗΡΗ ΤΗ ΣΥΓΚΡΙΣΗ ═══════════════════════
          Ο υπολογισμός μπορεί να βγάζει τη βραχυχρόνια μπροστά κατά τρεις
          χιλιάδες ευρώ και να μην έχει καμία σημασία: αν το ακίνητο είναι σε
          περιοχή όπου δεν δίνεται νέος ΑΜΑ, η επιλογή δεν υπάρχει. Κανένα
          εργαλείο της αγοράς δεν το λέει αυτό δίπλα στο νούμερο και είναι το
          πρώτο που πρέπει να ελέγξει ο ιδιοκτήτης.

          ΤΟ ΚΕΙΜΕΝΟ ΔΕΝ ΞΑΝΑΓΡΑΦΕΤΑΙ ΕΔΩ. Έρχεται από τον ίδιο πίνακα κανόνων
          που διαβάζει η Συμβουλευτική και ο βοηθός μέσα στην εφαρμογή, με τη
          νομική βάση και την πηγή του: αλλιώς η δημόσια σελίδα και η εφαρμογή
          θα έλεγαν διαφορετικά πράγματα για τον ίδιο νόμο. */}
      {AMA_RULE && (
        <div style={{
          marginTop: 20, padding: 'clamp(14px,2.6vw,18px)', borderRadius: T.radius.inner,
          background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
            color: 'var(--text-tertiary)', marginBottom: 8 }}>
            Πριν αποφασίσεις
          </div>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
            {/* Ο τίτλος του κανόνα δεν έχει τελεία και κολλούσε στην πρόταση που
                ακολουθεί («…μη μεταβίβαση Νέες εγγραφές…»): δική του γραμμή. */}
            <strong style={{ display: 'block', marginBottom: 4, color: 'var(--text-primary)' }}>{AMA_RULE.title}</strong>
            {AMA_RULE.summary}
          </p>
          <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>
            {AMA_RULE.legalBasis} · ισχύς {AMA_RULE.effective}
            {AMA_RULE.sourceHref && <>{' · '}
              <a href={AMA_RULE.sourceHref} target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--accent)' }}>{AMA_RULE.sourceLabel}</a>
            </>}
          </p>
        </div>
      )}

      <ToolPaperFoot path={PATH} spec={SPEC} values={v}/>

      {/* Χωρίς λειτουργίες βραχυχρόνιας: δεν έχουν ανοίξει ακόμη και η
          πρόσκληση δεν υπόσχεται ό,τι δεν υπάρχει. */}
      <ToolCta
        title="Όποια κι αν διαλέξεις, τα έξοδα θέλουν τάξη."
        body="Το PROPERWISE κρατά ενοίκια, λογαριασμούς και δαπάνες ανά ακίνητο και ετοιμάζει τα στοιχεία του Ε2 για τον λογιστή σου."
      />
    </div>
  );
}

// ΟΙ ΕΠΙΚΕΦΑΛΙΔΕΣ ΤΥΛΙΓΟΝΤΑΙ, ΓΙΑΤΙ ΟΙ ΣΤΗΛΕΣ ΕΙΝΑΙ ΠΛΕΟΝ ΣΤΑΘΕΡΕΣ.
// Με «nowrap» και σταθερές στήλες, το «Καθαρά βραχυχρόνιας» ζητούσε 161
// εικονοστοιχεία μέσα σε κελί 88 στα 390: ξεχυνόταν πάνω στη διπλανή στήλη.
// Μετρημένο: επτά κελιά ξεχείλιζαν στα 360. Δύο γραμμές επικεφαλίδας κοστίζουν
// λιγότερο από 250 εικονοστοιχεία οριζόντιας κύλισης.
function Line({ k, a, b, strong }: { k: string; a: number | null; b: number; strong?: boolean }) {
  const weight = strong ? 700 : 400;
  const ink = strong ? 'var(--text-primary)' : 'var(--text-secondary)';
  // ── Η ΕΤΙΚΕΤΑ ΤΗΣ ΓΡΑΜΜΗΣ ΕΙΝΑΙ ΚΕΦΑΛΙΔΑ, ΟΧΙ ΚΕΛΙ ─────────────────────────
  // Γραφόταν `<td>`. Δύο συνέπειες· κι οι δύο μετρημένες:
  //   · Ο αναγνώστης οθόνης διάβαζε σκέτο ποσό χωρίς να πει ΠΟΙΟΥ πράγματος.
  //     Ενα `<th scope="row">` το λέει μία φορά κι για κάθε κελί της σειράς.
  //   · Ο πίνακας κυλά οριζόντια σε στενή οθόνη — μετρημένο 102 εικονοστοιχεία
  //     στα 320. Ο κανόνας που καρφώνει την πρώτη στήλη πιάνει `th[scope="row"]`,
  //     οπότε το `td` γλιστρούσε έξω κι τα δύο ποσά έμεναν χωρίς όνομα. Ο σαρωτής
  //     διάταξης το ονόμασε «ΧΑΝΕΤΑΙ Η ΤΑΥΤΟΤΗΤΑ ΤΗΣ ΓΡΑΜΜΗΣ» σε εννέα πλάτη.
  // Η σωστή σημασιολογία κι η σωστή συμπεριφορά ήταν το ΙΔΙΟ πράγμα.
  return (
    <tr className={strong ? 'is-total' : undefined}>
      <th scope="row" style={{ fontWeight: strong ? 600 : 400, color: ink }}>{k}</th>
      {a === null
        ? <td className="num" style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>δεν ισχύει</td>
        : <td className="num" style={{ fontWeight: weight, color: ink }}>{feSigned(a)}</td>}
      <td className="num" style={{ fontWeight: weight, color: ink }}>{feSigned(b)}</td>
    </tr>
  );
}

/**
 * ΚΕΦΑΛΙΔΑ ΣΤΗΛΗΣ ΠΟΥ ΔΕΝ ΚΟΒΕΤΑΙ ΜΕ ΕΝΩΤΙΚΟ (01.10.2026). Οι κεφαλίδες είχαν
 * μαλακό ενωτικό μέσα τους για να χωρούν σε στήλη 78 εικονοστοιχείων στα 360·
 * σε κεφαλαία έβγαιναν «ΜΑΚΡΟ- / ΧΡΟΝΙΑ» και «ΠΛΗΡΟ- / ΤΗΤΑ», δηλαδή μισή λέξη
 * σε κάθε γραμμή του πιο στενού κελιού της σελίδας. Τώρα: ολόκληρη λέξη όπου
 * χωρά, συντομογραφία με τελεία κάτω από τα 420 (`.th-short`, globals.css). Ο
 * αναγνώστης οθόνης ακούει πάντα την πλήρη λέξη.
 */
function ThLabel({ full, short }: { full: string; short: string }) {
  return <><span className="th-full">{full}</span><span className="th-short" aria-hidden="true">{short}</span></>;
}
