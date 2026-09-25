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
import { T, feAuto, fixedCols } from '@/components/tokens';
import { ChipToggle } from '@/components/Theme';
import { fn, fpRate, feSigned, feWhole } from '@/lib/core/format';
import { parseAmount } from '@/lib/core/greek';
import { compareShortVsLong, netByOccupancy, NIGHTS_PER_YEAR, HIGH_SEASON_NIGHTS, type SeasonSpread } from '@/lib/tools/shortVsLong';
import { climateLevyRates, CLIMATE_LEVY_FROM_2025, FIRST_YEAR_CURRENT_LEVY } from '@/lib/billing/greekTax';
import { REGULATORY_UPDATES_2026 } from '@/lib/accounting/updates2026';
import { useToolState, ToolActions, ToolPaper, ToolPaperFoot } from '@/app/ToolShare';
import { ToolCta, EstimateNote, ToolClampNote } from '@/app/PublicChrome';
import { ToolNumField, ToolSelect, ToolFigure } from '@/app/ToolParts';

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
  const w = Math.round(n);
  return w > 0 ? `+${feWhole(w)}` : w < 0 ? `−${feWhole(-w)}` : feWhole(0);
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
  const curve = useMemo(() => netByOccupancy(input, OCCUPANCY_STEPS), [input]);
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
      {/* ── ΤΙ ΖΗΤΑΜΕ, ΚΑΙ ΓΙΑΤΙ ΤΟΣΑ ────────────────────────────────────────
             Οκτώ πεδία είναι περισσότερα από τους άλλους δύο υπολογιστές και
             είναι τα ΛΙΓΟΤΕΡΑ που δίνουν τίμια απάντηση: χωρίς προμήθεια και
             λειτουργικά, η σύγκριση γέρνει ψευδώς προς τη βραχυχρόνια, που
             είναι ακριβώς το λάθος για το οποίο υπάρχει η σελίδα.

             ΟΚΤΩ ΠΕΔΙΑ ΣΕ ΔΥΟ ΣΤΗΛΕΣ ΕΙΝΑΙ ΤΕΣΣΕΡΙΣ ΣΕΙΡΕΣ, ΚΑΙ ΦΑΙΝΟΝΤΑΝ.
             Στα 1440 το δοχείο μετρά 1044: με δύο στήλες κάθε πεδίο έπαιρνε 515
             εικονοστοιχεία —διπλάσια από όσα χρειάζεται ένα κουτί αριθμού— και
             η φόρμα κατέβαινε τέσσερις σειρές, σπρώχνοντας το αποτέλεσμα εκτός
             οθόνης. Τέσσερις στήλες δίνουν 4+4 σε δύο ζυγισμένες σειρές, με 250
             ανά πεδίο. Το `fc-roomy` κρατά δύο στήλες στη ζώνη 821–1000, όπου
             οι τέσσερις θα στένευαν τις μακριές ετικέτες
             («Καθαριότητα ανά διανυκτέρευση»).

             ΚΑΙ Η ΣΤΟΙΧΙΣΗ ΠΑΕΙ ΣΤΟ ΚΑΤΩ ΑΚΡΟ. Στη ζώνη 1001–1060 το πεδίο
             πέφτει στα 216 και η «Καθαριότητα ανά διανυκτέρευση» τυλίγεται:
             με στοίχιση στην αρχή κατέβαινε ΜΟΝΟ το δικό της κουτί κατά μία
             γραμμή, δηλαδή η σειρά έσπαγε σε τρεις στάθμες. Κανένα πεδίο εδώ
             δεν έχει σημείωση από κάτω.

             ΚΑΙ ΣΤΟ ΤΗΛΕΦΩΝΟ ΔΥΟ ΣΤΗΛΕΣ. Στα 390 τα οκτώ πεδία έπεφταν σε μία
             στήλη των 358 εικονοστοιχείων το καθένα (για ένα «60%» ή ένα «12€»)
             και η απάντηση άρχιζε 1.350 εικονοστοιχεία πιο κάτω. Δύο στήλες
             κάνουν τις οκτώ σειρές τέσσερις· κάτω από τα 340 τα ποσά δεν χωρούν
             δίπλα δίπλα και γίνονται πάλι μία. */}
      <div {...fixedCols(4, 14, 'end', 'po-tool-controls fc-roomy fc-xs-2 fc-xxs-1')}>
        {num(ids.rent, 'enoikio', 'Μηνιαίο ενοίκιο', '€')}
        {num(ids.price, 'timi', 'Τιμή ανά διανυκτέρευση', '€')}
        {num(ids.occ, 'plirotita', 'Πληρότητα', '%')}
        {num(ids.sqm, 'tm', 'Τετραγωνικά', 'τ.μ.', 44)}
        <ToolSelect label="Τύπος ακινήτου" value={v.typos}
          onChange={x => set('typos', x)} options={TYPES}/>
        {num(ids.fee, 'promitheia', 'Προμήθεια πλατφόρμας', '%')}
        {num(ids.cost, 'kostos', 'Καθαριότητα ανά διανυκτέρευση', '€')}
        {num(ids.fixed, 'pagia', 'Πάγια ανά μήνα', '€')}
      </div>
      <ToolClampNote notes={[
        amount(v.plirotita) > 100 && 'Η πληρότητα φτάνει έως 100%· υπολογίστηκε με 100%.',
        amount(v.promitheia) > 100 && 'Η προμήθεια φτάνει έως 100%· υπολογίστηκε με 100%.',
      ]}/>

      {/* ═══ Η ΤΙΜΗ ΤΗΣ ΑΙΧΜΗΣ ΕΙΝΑΙ Ο ΠΙΟ ΣΥΝΗΘΗΣ ΑΥΤΟΕΞΑΠΑΤΗΣΗ ═════════════════
          Η βραχυχρόνια δουλεύει με δυναμική τιμολόγηση: άλλη τιμή τον Αύγουστο,
          άλλη τον Νοέμβριο, άλλη το Σαββατοκύριακο. Ο ιδιοκτήτης θυμάται την
          ΚΑΛΥΤΕΡΗ του βραδιά και τη γράφει εδώ — και μετά τη διαβάζει
          πολλαπλασιασμένη επί τριακόσιες εξήντα πέντε. Το εργαλείο ζητά ρητά τον
          μέσο όρο, γιατί αλλιώς παράγει το ίδιο ακριβώς λάθος που υπάρχει για
          να διορθώσει. */}
      <p className="po-tool-controls po-prose" style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>
        Η τιμή είναι η δική σου ανά διανυκτέρευση· ο επισκέπτης πληρώνει επιπλέον το τέλος
        ανθεκτικότητας, που εσύ το αποδίδεις. Στη βραχυχρόνια η τιμή αλλάζει με την εποχή και τη
        ζήτηση: βάλε τον μέσο όρο που πιάνεις, όχι την τιμή της αιχμής. Τα πάγια είναι ρεύμα, νερό
        και ίντερνετ, που στη μακροχρόνια τα πληρώνει ο ενοικιαστής.
      </p>

      {/* ═══ ΠΟΤΕ ΓΕΜΙΖΕΙ ΤΟ ΑΚΙΝΗΤΟ ══════════════════════════════════════════
          ΔΕΝ ΕΙΝΑΙ ΛΕΠΤΟΜΕΡΕΙΑ. Το τέλος ανθεκτικότητας είναι ΤΕΤΡΑΠΛΑΣΙΟ από
          Απρίλιο ώς Οκτώβριο. Με τις ίδιες ακριβώς νύχτες και την ίδια τιμή, το
          ελληνικό εξοχικό που γεμίζει μόνο το καλοκαίρι πληρώνει σχεδόν
          διπλάσιο τέλος από ένα διαμέρισμα πόλης που δουλεύει όλο τον χρόνο.
          Η πρώτη εκδοχή μοίραζε πάντα ισομερώς και το έγραφε ως παραδοχή· ήταν
          τίμιο, αλλά ήταν και λάθος για τα μισά ελληνικά ακίνητα.

          ΔΕΝ ΕΙΝΑΙ ΠΕΔΙΟ ΤΟΥ ΠΛΕΓΜΑΤΟΣ, ΓΙΑΤΙ ΔΕΝ ΕΙΝΑΙ ΠΟΣΟ. Τα οκτώ από πάνω
          είναι μεγέθη που πληκτρολογείς· αυτό είναι παραδοχή του μοντέλου και
          χρειάζεται τη δική του σειρά για να εξηγηθεί. */}
      <div className="po-tool-controls" style={{
        marginTop: 14, padding: '12px 14px', borderRadius: T.radius.inner,
        border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16, flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: 230 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            Πότε γεμίζει
          </div>
          <p style={{ margin: '3px 0 0', fontSize: 13, lineHeight: 1.55, color: 'var(--text-tertiary)' }}>
            {input.season === 'high'
              ? `Οι κρατήσεις πέφτουν πρώτα στους επτά μήνες της υψηλής περιόδου, δηλαδή έως ${HIGH_SEASON_NIGHTS} διανυκτερεύσεις, όπου το τέλος είναι ${feWhole(levyRates.high)} τη διανυκτέρευση. Αλλάζει τι πληρώνει ο επισκέπτης, όχι τι κρατάς εσύ.`
              : `Οι κρατήσεις μοιράζονται ισομερώς στους δώδεκα μήνες. Το τέλος είναι ${feWhole(levyRates.high)} τη διανυκτέρευση από Απρίλιο ώς Οκτώβριο και ${feWhole(levyRates.low)} τους υπόλοιπους.`}
          </p>
        </div>
        {/* ── Η ΕΝΕΡΓΗ ΕΠΙΛΟΓΗ ΔΕΝ ΛΕΓΕΤΑΙ ΜΟΝΟ ΜΕ ΧΡΩΜΑ ─────────────────────
               Τα δύο κουμπιά δήλωναν ποιο είναι πατημένο αποκλειστικά με το
               φόντο του τοπικού στυλ. Μετρημένο σε πραγματικό Chromium,
               aria-pressed, aria-selected και aria-current ήταν και τα τρία
               κενά: ο αναγνώστης οθόνης άκουγε δύο ίδια κουμπιά και καμία
               κατάσταση, δηλαδή η παραδοχή που αλλάζει το τέλος ανθεκτικότητας
               ήταν αόρατη για όποιον δεν βλέπει το χρώμα.
               Ίδιο ιδίωμα με τον επιλογέα έτους στον φόρο ενοικίων: aria-pressed
               πάνω στο κουμπί, με την ΙΔΙΑ συνθήκη που δίνει και το χρώμα, ώστε
               τα δύο να μην μπορούν να ξεφύγουν το ένα από το άλλο. */}
        {/* ΤΑ ΔΥΟ ΛΕΚΤΙΚΑ ΔΕΝ ΧΩΡΑΝΕ ΔΙΠΛΑ ΣΤΑ 320. Μετρημένο σε πραγματικό
            Chromium: η σειρά πιάνει 286 μέσα σε κάρτα που της δίνει 250 και
            βγαίνει και ένα εικονοστοιχείο έξω από την οθόνη. Ούτε το λεκτικό
            κονταίνει ούτε το κουμπί σπάει σε δύο γραμμές: η σειρά αναδιπλώνεται
            και κάτω από τα 380 το κάθε κουμπί πιάνει ολόκληρη τη γραμμή του.
            Πάνω από εκεί τα δύο χωράνε δίπλα και τίποτα δεν αλλάζει. */}
        <div className="po-seg" style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: 4, background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)', borderRadius: T.radius.inner }}>
          {/* `seg` γιατί η ράγα από πάνω έχει ήδη δικό της περίγραμμα. Το aria-pressed
              το βάζει πλέον μόνο του το πρωτογενές, με την ίδια συνθήκη που δίνει το χρώμα. */}
          {/* `grow`: όταν η ράγα πέσει σε δική της γραμμή (κάτω από τα 600
              πιάνει όλο το πλάτος, globals.css) τα δύο μοιράζονται ίσα, όπως ο
              επιλογέας έτους στον φόρο ενοικίων. */}
          <ChipToggle shape="seg" grow on={input.season === 'even'} onClick={() => set('sezon', 'even')}>Όλο τον χρόνο</ChipToggle>
          <ChipToggle shape="seg" grow on={input.season === 'high'} onClick={() => set('sezon', 'high')}>Κυρίως το καλοκαίρι</ChipToggle>
        </div>
      </div>

      {/* ── Η κεφαλίδα του χαρτιού, πάνω από το αποτέλεσμα ─────────────── */}
      <ToolPaper title="Σύγκριση βραχυχρόνιας και μακροχρόνιας" on={today} inputs={[
        { k: 'Μηνιαίο ενοίκιο', v: feAuto(amount(v.enoikio)) },
        { k: 'Τιμή διανυκτέρευσης', v: feAuto(amount(v.timi)) },
        { k: 'Πληρότητα', v: fpRate(amount(v.plirotita)) },
        { k: 'Ακίνητο', v: `${TYPES.find(t => t.value === v.typos)?.label ?? v.typos}, ${fn(amount(v.tm), 2)} τ.μ.` },
        { k: 'Προμήθεια', v: fpRate(amount(v.promitheia)) },
        { k: 'Καθαριότητα', v: `${feAuto(amount(v.kostos))} τη διανυκτέρευση` },
        { k: 'Πάγια', v: `${feAuto(amount(v.pagia))} τον μήνα` },
        { k: 'Πότε γεμίζει', v: input.season === 'high' ? 'κυρίως το καλοκαίρι' : 'όλο τον χρόνο' },
      ]}/>

      {/* ── Το αποτέλεσμα ──────────────────────────────────────────────── */}
      <div className="po-tool-result" style={{
        marginTop: 20, padding: 'clamp(18px, 4vw, 26px)', borderRadius: T.radius.card,
        background: 'var(--surface-raised)', border: '1px solid var(--border-raised)',
        boxShadow: 'var(--well-inset)',
      }}>
        {/* Η ΕΤΥΜΗΓΟΡΙΑ ΣΕ ΜΙΑ ΠΡΟΤΑΣΗ. Χωρίς αυτήν, ο επισκέπτης βλέπει δύο
            ποσά και κάνει ο ίδιος την αφαίρεση — που είναι η μόνη πράξη για την
            οποία ήρθε. Η ισοπαλία λέγεται ισοπαλία, δεν στρογγυλοποιείται προς
            κάποια πλευρά. */}
        <p style={{
          margin: '0 0 18px', fontSize: 'clamp(16px, 2.2vw, 20px)', lineHeight: 1.4,
          fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-primary)', textWrap: 'balance',
        }}>
          {/* ΑΚΕΡΑΙΑ ΕΥΡΩ. Όλα εδώ κρέμονται από μια πληρότητα που μαντεύεται· το
              «8.223,00€» υπόσχεται λεπτά που η είσοδος δεν έχει. Η διαφορά της
              πρότασης βγαίνει από τα ΣΤΡΟΓΓΥΛΑ ποσά από κάτω, ώστε να είναι η
              αφαίρεση που θα κάνει ο αναγνώστης. Λεπτά κρατά μόνο ο πίνακας,
              που πρέπει να κλείνει στο λεπτό. */}
          {gap === 0
            ? 'Οι δύο επιλογές αφήνουν ουσιαστικά τα ίδια.'
            : `Η ${gap > 0 ? 'βραχυχρόνια' : 'μακροχρόνια'} αφήνει ${feWhole(Math.abs(gap))} περισσότερα τον χρόνο.`}
        </p>

        <div {...fixedCols(2, 24, 'start')}>
          {/* Τα καθαρά μπορεί να βγουν αρνητικά: τυπογραφικό μείον, σφιχτό. */}
          <ToolFigure label="Μακροχρόνια, καθαρά" value={wholeSigned(r.long.net)}/>
          <ToolFigure label="Βραχυχρόνια, καθαρά" value={wholeSigned(r.short.net)}/>
          <LiveResult say={`Μακροχρόνια ${wholeSigned(r.long.net)} καθαρά. Βραχυχρόνια ${wholeSigned(r.short.net)} καθαρά.`} />
        </div>

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
                      fontVariantNumeric: 'tabular-nums' }}>{fn(Math.ceil(be / 100 * NIGHTS_PER_YEAR))}</strong>{' '}
                    διανυκτερεύσεις τον χρόνο.</>}
          </p>
        </div>
      </div>

      {/* ── Πού πήγαν τα χρήματα, στις δύο πλευρές ──────────────────────────
             Κάθε γραμμή εκτός από την τελευταία είναι χρήμα που ΦΕΥΓΕΙ, οπότε ο
             πίνακας διαβάζεται ως αφαίρεση που κλείνει: εισπράξεις μείον τα
             τέσσερα δίνουν ακριβώς τα καθαρά. Ένας πίνακας που δεν κλείνει
             μπροστά στον αναγνώστη είναι χειρότερος από κανέναν πίνακα. */}
      <div style={{ marginTop: T.sp.xxl }}>
        <div className="po-table-box">
         <div className="po-scroll-x" style={{ overflowX: 'auto' }}>
          <table className="po-table" style={{ '--tbl-min': '320px', tableLayout: 'fixed' }}>
            <caption>
              Πού πάνε τα χρήματα, τον χρόνο
            </caption>
            {/* ΟΙ ΔΥΟ ΠΛΕΥΡΕΣ ΤΗΣ ΣΥΓΚΡΙΣΗΣ ΕΠΑΙΡΝΑΝ ΔΙΑΦΟΡΕΤΙΚΟ ΠΛΑΤΟΣ.
                Μετρημένο στα 1280: μακροχρόνια 298,8 και βραχυχρόνια 289,4. Ο
                περιηγητής μοιράζει το πλάτος κατά περιεχόμενο, οπότε η στήλη με
                το μακρύτερο ποσό έπαιρνε παραπάνω. Δύο στήλες που ο αναγνώστης
                τις βάζει δίπλα δίπλα δεν επιτρέπεται να διαφέρουν σε πλάτος:
                το μάτι διαβάζει τη διαφορά ως έμφαση που δεν υπάρχει.
                Το `fixed` με ρητά ποσοστά τις κάνει ίσες σε κάθε πλάτος. */}
            {/* 40/30/30: στα 390 το «−1.204,50€» θέλει 98 και το 28% έδινε 97. */}
            <colgroup>
              <col style={{ width: '40%' }} />
              <col style={{ width: '30%' }} />
              <col style={{ width: '30%' }} />
            </colgroup>
            <thead>
              <tr>
                {/* Η γωνία δεν λέει τίποτα στο μάτι· στον αναγνώστη οθόνης λέει τι είναι η στήλη. */}
                <th scope="col"><span className="sr-only">Κατηγορία</span></th>
                <th scope="col" className="num">Μακροχρόνια</th>
                <th scope="col" className="num">Βραχυχρόνια</th>
              </tr>
            </thead>
            <tbody>
              {/* Στη μακροχρόνια πληρώνει ενοικιαστής, όχι επισκέπτης· και μόνο στη
                  βραχυχρόνια το ποσό κουβαλά το τέλος που αφαιρείται από κάτω. */}
              {/* ΟΙ ΕΚΡΟΕΣ ΓΡΑΦΟΝΤΑΙ ΜΕ ΜΕΙΟΝ. Χωρίς πρόσημο, το «Φόρος εισοδήματος
                  2.961,00€» καθόταν κάτω από τις εισπράξεις σαν να ήταν κι αυτό
                  είσπραξη· με το μείον ο πίνακας διαβάζεται ως η αφαίρεση που είναι. */}
              <Line k="Εισπράξεις (με το τέλος για τη βραχυχρόνια)" a={r.long.gross} b={r.short.guestTotal} />
              <Line k="Τέλος ανθεκτικότητας (ΤΑΚΚ)" a={0} b={-r.short.levy} />
              <Line k="Φόρος εισοδήματος" a={-r.long.tax} b={-r.short.tax} />
              <Line k="Προμήθεια πλατφόρμας" a={0} b={-r.short.platformFee} />
              <Line k="Καθαριότητα και πάγια" a={0} b={-r.short.running} />
              <Line k="Καθαρά" a={r.long.net} b={r.short.net} strong />
            </tbody>
          </table>
         </div>
        </div>
      </div>

      {/* ═══ Η ΠΛΗΡΟΤΗΤΑ ΕΙΝΑΙ ΜΑΝΤΕΨΙΑ, ΚΑΙ Ο ΠΙΝΑΚΑΣ ΤΟ ΠΑΡΑΔΕΧΕΤΑΙ ══════════
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
          <table className="po-table" style={{ '--tbl-min': '320px', tableLayout: 'fixed' }}>
            <caption>Αν πέσεις έξω στην πληρότητα · διαφορά από τη μακροχρόνια</caption>
            {/* ΚΑΙ ΟΙ ΤΕΣΣΕΡΙΣ ΣΤΗΛΕΣ ΕΙΝΑΙ ΑΡΙΘΜΟΙ, ΑΡΑ ΙΣΕΣ ΚΑΙ ΔΕΞΙΑ.
                Μετρημένο στα 1280: 175,4 · 246 · 311,9 · 310,7. Τέσσερα
                διαφορετικά πλάτη για το ίδιο είδος περιεχομένου, με την
                πληρότητα να στοιχίζεται αριστερά ενώ τα υπόλοιπα νούμερα
                στοιχίζονται δεξιά. Ο αναγνώστης σαρώνει κάθετα και βρίσκει
                κάθε στήλη σε άλλη θέση. Τώρα τέσσερα ίσα τέταρτα, όλα δεξιά,
                όλα σε αριθμούς πίνακα. */}
            {/* ΚΑΙ ΧΩΡΑΕΙ ΣΤΟ ΚΙΝΗΤΟ. Με ελάχιστο 500 ο πίνακας έβγαινε 539 σε κουτί
                348 στα 390: τα καθαρά και η διαφορά, δηλαδή τα δύο νούμερα της
                απόφασης, ήταν έξω από την οθόνη. Οι κεφαλίδες γίνονται μία λέξη
                η καθεμιά (το πλήρες όνομα μένει για τον αναγνώστη οθόνης) και
                η στήλη των νυχτών, που κρατά τριψήφιο, δίνει λίγο στην πρώτη. */}
            <colgroup>
              <col style={{ width: '28%' }} />
              <col style={{ width: '22%' }} />
              <col style={{ width: '25%' }} />
              <col style={{ width: '25%' }} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col" className="num">Πληρότητα</th>
                <th scope="col" className="num">Νύχτες<span className="sr-only"> (διανυκτερεύσεις)</span></th>
                <th scope="col" className="num">Καθαρά<span className="sr-only"> βραχυχρόνιας</span></th>
                <th scope="col" className="num">Διαφορά<span className="sr-only"> έναντι μακροχρόνιας</span></th>
              </tr>
            </thead>
            <tbody>
              {curve.map(row => {
                const ahead = row.net >= r.long.net;
                return (
                  <tr key={row.pct} className={ahead ? 'is-on' : undefined}>
                    <td className="num" style={{ fontWeight: ahead ? 600 : 400 }}>{fpRate(row.pct)}</td>
                    <td className="num">{fn(row.nights)}</td>
                    <td className="num" style={{ fontWeight: ahead ? 600 : 400 }}>{wholeSigned(row.net)}</td>
                    {/* Η διαφορά των ΣΤΡΟΓΓΥΛΩΝ, ώστε να βγαίνει από τα ποσά που φαίνονται. */}
                    <td className="num">{delta(Math.round(row.net) - Math.round(r.long.net))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
         </div>
        </div>
      </div>

      <ToolActions path={PATH} spec={SPEC} values={v}/>

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
          μονοκατοικίες άνω των 80 τ.μ., με υψηλή περίοδο Απρίλιο ώς Οκτώβριο
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
function Line({ k, a, b, strong }: { k: string; a: number; b: number; strong?: boolean }) {
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
      <td className="num" style={{ fontWeight: weight, color: ink }}>{feSigned(a)}</td>
      <td className="num" style={{ fontWeight: weight, color: ink }}>{feSigned(b)}</td>
    </tr>
  );
}
