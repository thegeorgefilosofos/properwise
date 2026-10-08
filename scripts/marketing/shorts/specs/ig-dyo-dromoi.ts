// ═══════════════════════════════════════════════════════════════════════════
// INSTAGRAM REEL · «ΙΔΙΟ ΔΙΑΜΕΡΙΣΜΑ, ΔΥΟ ΔΡΟΜΟΙ» (08/10/2026)
// ─────────────────────────────────────────────────────────────────────────
// Ενώνει τα δύο shorts της 07/10 (πού πάνε τα ενοίκια, Airbnb ή ενοικιαστής) σε
// μία υπόσχεση που ελέγχεται κομμάτι κομμάτι: «Η νύχτα πληρώνεται μόνο γεμάτη.
// Η μέρα, πάντα.» Τι αφήνει μια νύχτα, πώς λυγίζει ο φόρος με τις νύχτες, πότε
// έρχονται τα λεφτά μέσα στη χρονιά, ότι και η «πάντα» μέρα έχει τον άδειο της
// μήνα και τι γίνεται όταν έχεις ήδη ένα νοικιασμένο. Κλείνει σε ζώνη, όχι σε
// έναν αριθμό.
//
// Σειρά vraxy (108 χτύποι το λεπτό), 24 μέτρα, οκτώ σκηνές με επτά περάσματα.
// Δεν μπαίνει στο specs/index.ts: είναι reel του Instagram και το βγάζει το
// scripts/marketing/reelDyoDromoi.ts μαζί με τα stories και το εξώφυλλο, όχι
// η εντολή των shorts της ημέρας.
//
// ΚΑΝΕΝΑ ΨΗΦΙΟ ΕΔΩ: κάθε αριθμός είναι `{γεγονός}` του dyoDromoiFacts.ts.
// ═══════════════════════════════════════════════════════════════════════════
import type { ShortSpec } from '../spec';
import { K } from '../kit';
import { hookPair, flow, threshold, months12, dumbbell, calcCard, type HookPairP } from '../scenes';
import { dyoDromoiFacts } from '../../dyoDromoiFacts';

const PAIR: Omit<HookPairP, 'beats' | 'arc' | 'story' | 'cue'> = {
  eyebrow: 'Ίδιο διαμέρισμα · δύο δρόμοι',
  night: { label: 'Μία **νύχτα** Airbnb', value: 'nightNet', note: 'μέσος όρος · παράδειγμα: γεμίζει πρώτα {highFrom}–{highTo}', weights: 'series.highNightsByMonth', months: true },
  day: { label: 'Μία **μέρα** ενοικιαστή', value: 'tenantPerDay', note: 'μέσος όρος · πληρώνεται κάθε μέρα' },
  line: ['Η νύχτα πληρώνεται', 'μόνο **γεμάτη**.', 'Η μέρα, **πάντα**.'],
};
const TRACK_ENDS: [string, string] = ['άδειο', 'γεμάτο'];

export const DYO_DROMOI: ShortSpec = {
  id: '2026-10-08-ig-dyo-dromoi',
  date: '2026-10-08', slot: '21:00', series: 'vraxy',
  title: 'Ίδιο διαμέρισμα, δύο δρόμοι',
  hook: 'Η νύχτα πληρώνεται μόνο γεμάτη. Η μέρα, πάντα.',
  protagonist: 'Ένα διαμέρισμα με τις προεπιλογές του υπολογιστή: ενοικιαστής με {rent} τον μήνα ή Airbnb με {nightPrice} τη νύχτα. Και η Ελένη του χθεσινού short, που έχει ήδη ένα νοικιασμένο. Παραδείγματα, όχι υπαρκτά πρόσωπα.',
  cta: { path: '/vraxyxronia-i-makroxronia', label: 'Βάλε τους μήνες σου στον υπολογιστή «Βραχυχρόνια ή μακροχρόνια».' },
  utm: { campaign: 'ig-dyo-dromoi' },
  facts: dyoDromoiFacts,
  hooks: [{
    name: 'Νύχτα και μέρα',
    why: 'Δύο ποσά, ένα για τη νύχτα και ένα για τη μέρα, με τη μεγαλύτερη να έχει όρο. Η κορδέλα του χρόνου δείχνει τον όρο πριν διαβαστεί: η λιλά είναι άδεια τον χειμώνα. Η φράση δεν ρωτά, υπόσχεται κάτι που το reel ελέγχει.',
    scene: hookPair({
      ...PAIR, beats: 8, arc: 'hook',
      story: 'Πρώτο καρέ: «Μία νύχτα Airbnb {nightNet}» και «Μία μέρα ενοικιαστή {tenantPerDay}», με δύο κορδέλες του χρόνου. Η πράσινη γεμίζει μήνα μήνα, η λιλά μόνο από {highFrom} ως {highTo}. Αμέσως μετά: «Η νύχτα πληρώνεται μόνο γεμάτη. Η μέρα, πάντα.»',
      cue: 'Χαμηλό χτύπημα στο πρώτο καρέ, ένα τικ σε κάθε μήνα, αρπίσματα μόνο στους γεμάτους μήνες.',
    }),
  }],
  pick: 0,
  rubric: {
    signals: [
      { signal: 'hook', scene: 0, note: 'Νύχτα {nightNet} απέναντι σε μέρα {tenantPerDay}, με τον όρο «μόνο γεμάτη» ορατό στην κορδέλα.' },
      { signal: 'revelation', scene: 1, note: 'Από {nightPrice} σε σένα μένουν {nightNet}: η ροή δείχνει πού πάει το υπόλοιπο.' },
      { signal: 'conflict', scene: 2, note: 'Ο φόρος του Airbnb δεν είναι σταθερός: τείχη στις νύχτες {occ25.nights} και {occ35.nights}.' },
      { signal: 'revelation', scene: 3, note: 'Ίδιες νύχτες, ίδιο σύνολο ({cumCross.decShort}), άλλη χρονιά. Το Airbnb περνά μπροστά τον {cumCross.monthAcc}.' },
      { signal: 'story', scene: 5, note: 'Με ένα ενοίκιο ήδη η διαφορά πέφτει στα {withEleni.diff} και το όριο ανεβαίνει στο {withEleni.be}.' },
      { signal: 'quotable', scene: 5, note: '«Το όριο δεν είναι ένα. Είναι ζώνη.»' },
      { signal: 'practical', scene: 6, note: 'Ο υπολογιστής καθαρής απόδοσης με το πεδίο «Άλλα ενοίκια».' },
    ],
    score: 80,
    why: 'Παίρνει δύο απαντήσεις που ο θεατής ήδη ξέρει από χθες και τις κάνει εργαλείο: πότε, με τι φόρο και με τι άλλα ενοίκια αλλάζει η απόφαση. Η κάρτα με τα όρια αξίζει αποθήκευση.',
  },
  scenes: [
    flow({
      beats: 12, arc: 'stakes', in: 'matchCut', inOpts: { from: 'hpn0', to: 'fln1' },
      story: 'Ο αριθμός της νύχτας μικραίνει και γίνεται ο τελικός κόμβος της ροής. Από {nightPrice}: προμήθεια {nightFee}, καθαριότητα {nightClean}, πάγια {nightFixed}, φόρος {nightTax}, σε σένα {nightNet}. Από κάτω, στην ίδια κλίμακα, η μέρα του ενοικιαστή: ένα ρεύμα ως τα {tenantPerDay}.',
      cue: 'Ένα κατερχόμενο whoosh σε κάθε ρεύμα, ο φόρος σε χαμηλή νότα.',
      eyebrow: 'Τιμή {nightPrice} · παράδειγμα', title: ['Πού πάει', '**μία νύχτα**'],
      source: '**{nightPrice}** · μία γεμάτη νύχτα', sourceValue: 'nightPrice',
      parts: [
        { label: 'Προμήθεια', value: 'nightFee', color: `${K.ink}66` },
        { label: 'Καθαριότητα', value: 'nightClean', color: `${K.ink}4d` },
        { label: 'Πάγια ανά γεμάτη νύχτα', value: 'nightFixed', color: `${K.ink}33` },
        { label: 'Φόρος', value: 'nightTax', color: K.tax },
        { label: 'Σε σένα', value: 'nightNet', color: K.other, hero: true },
      ],
      other: { title: 'Ο ενοικιαστής: **ένα ρεύμα**.', gross: 'tenantGrossDay', net: 'tenantPerDay', sliver: 'tenantTaxDay', label: 'Κάθε μέρα', color: K.ok },
      footer: 'Μέσοι όροι ανά νύχτα και μέρα · Λήγει {validRental}',
    }),
    threshold({
      beats: 14, arc: 'turn', in: 'maskWipe', inOpts: { shape: 'circle', at: 'fln1' },
      story: 'Η μάσκα ανοίγει από τον κόμβο «σε σένα». Η πράσινη γραμμή του ενοικιαστή μένει ίσια στο {margLong}. Η λιλά καμπύλη του Airbnb λυγίζει προς τα πάνω και δύο σομόν τείχη κατεβαίνουν: {margShort} από τη νύχτα {occ25.nights}, {occ35.marg} από τη νύχτα {occ35.nights}. Στο παράδειγμα ο μέσος φόρος είναι {effShort}.',
      cue: 'Synth που ανεβαίνει μαζί με την καμπύλη, ένας γδούπος σε κάθε τείχος.',
      eyebrow: 'Κλίμακα {year} · παράδειγμα', title: ['Ο φόρος του Airbnb', '**ανεβαίνει**', 'με τις νύχτες'],
      curve: 'series.effCurve', nightsAxis: 'series.yearNights', steps: 'series.occSteps', grid: 'series.brackets', gridLabelsFact: 'margLong,margShort',
      flat: { value: 'margLong', label: 'ενοικιαστής' }, curveLabel: 'Airbnb, μέσος φόρος',
      walls: [{ nightsFact: 'occ25.nights', label: '{margShort} από τη νύχτα {occ25.nights}' }, { nightsFact: 'occ35.nights', label: '{occ35.marg} από τη νύχτα {occ35.nights}' }],
      dot: { nights: 'series.exNights', label: 'παράδειγμα', value: 'effShort' },
      ends: ['λίγες νύχτες', 'γεμάτο'],
      caption: 'Στο παράδειγμα **{effShort}** του φορολογητέου. Ο ενοικιαστής, {margLong}.',
      footer: 'Φόρος ως ποσοστό του φορολογητέου · Λήγει {validRental}',
    }),
    months12({
      beats: 14, arc: 'turn', in: 'zoomThrough', inOpts: { target: 'thd2' },
      story: 'Ζουμ μέσα από την τελεία του παραδείγματος. Μπάρες ταμείου ανά μήνα: {summerPeak} κάθε καλοκαιρινό μήνα, {winterSum} όλος ο χειμώνας. Διπλώνουν σε τρεις αθροιστικές γραμμές: το Airbnb περνά τον ενοικιαστή τον {cumCross.monthAcc} και «κυρίως καλοκαίρι» και «όλο τον χρόνο» τελειώνουν στο ίδιο {cumCross.decShort}.',
      cue: 'Ένα τικ ανά μήνα, αρπίσματα μόνο στους θετικούς μήνες, φούσκωμα στη διασταύρωση.',
      eyebrow: 'Ταμείο πριν τον φόρο · παράδειγμα', title: ['Τα λεφτά δεν', 'έρχονται **κάθε μήνα**'],
      footer: 'Μετά από προμήθεια, καθαριότητα και πάγια · πριν τον φόρο',
      flow: {
        bars: 'series.summer', band: { from: 'highFrom', to: 'highTo', label: 'υψηλή περίοδος' }, peak: 'summerPeak', low: '{winterSum} τον χειμώνα',
        lines: [
          { series: 'series.cumTenant', color: K.ok, label: 'ενοικιαστής' },
          { series: 'series.cumSummer', color: K.other, label: 'κυρίως καλοκαίρι' },
          { series: 'series.cumEven', color: K.other, dash: true, label: 'όλο τον χρόνο' },
        ],
        cross: { a: 'series.cumSummer', b: 'series.cumTenant' },
        ends: [{ value: 'cumCross.decShort', color: K.other }],
        captions: ['{negMonths} μήνες τα πάγια **περνούν τις κρατήσεις**', 'Ίδιες νύχτες, **ίδιο σύνολο**. Άλλη χρονιά.'],
      },
    }),
    months12({
      beats: 9, arc: 'turn', in: 'splitSwap', inOpts: { axis: 'x' },
      story: 'Η οθόνη σκίζεται. Δώδεκα πράσινα ενοίκια, ένα αδειάζει σε διακεκομμένο περίγραμμα: {vacancy1} λιγότερα, όχι {rent}, γιατί πέφτει και ο φόρος. Ο δείκτης πληρότητας γλιστρά από την αχνή γραμμή στο {be11.ceil}.',
      cue: 'Η μουσική πέφτει στο χαλί για ένα μέτρο και ξαναμπαίνει.',
      eyebrow: 'Ενοικιαστής · παράδειγμα', title: ['Και η μέρα έχει', '**τον άδειο της μήνα**'],
      footer: 'Ίδιο ενοίκιο, ίδια τιμή νύχτας · Λήγει {validRental}',
      vacancy: {
        bars: 'series.tenant', month: 8, loss: '−{vacancy1}',
        line: 'Ένας μήνας χωρίς ενοικιαστή: **{vacancy1}** λιγότερα', sub: 'όχι {rent}: πέφτει και ο φόρος',
        track: { ends: TRACK_ENDS, ghost: 'be.base', marks: [{ at: 'be11.exact', from: 'be.base', labelFact: 'be11.ceil', side: 'l' }] },
        after: 'Τότε το Airbnb κερδίζει από **{be11.ceil}**',
      },
    }),
    dumbbell({
      beats: 17, arc: 'payoff', in: 'whip', inOpts: { dir: 'right' },
      story: 'Whip. Πάνω μια αχνή σειρά χωρίς ποσά: μόνο αυτό το διαμέρισμα. Από κάτω, με ένα ενοίκιο ήδη, οι τελείες γλιστρούν: ενοικιαστής {withEleni.long}, Airbnb {withEleni.short}, διαφορά {withEleni.diff}. Ο δείκτης πληρότητας ξαναβγαίνει: ένα δεύτερο σημάδι πάει στο {withEleni.be} και μια μπλε αγκύλη ενώνει {be11.ceil} και {withEleni.be}. «Το όριο δεν είναι ένα. Είναι ζώνη.»',
      cue: 'Whoosh, βαθύ χτύπημα στη διαφορά, ζεστή συγχορδία στη «ζώνη».',
      eyebrow: 'Όπως η Ελένη του χθεσινού', title: ['Με ένα ενοίκιο ήδη,', 'η διαφορά **μικραίνει**'],
      ghost: { label: 'μόνο αυτό το διαμέρισμα', a: 'ghost.long', b: 'ghost.short' },
      row: { label: 'Με ένα **ενοίκιο ήδη**', a: 'withEleni.long', b: 'withEleni.short', chips: ['κλιμάκιο {withEleni.margLong}', 'κλιμάκιο {withEleni.margShort}'] },
      diff: { label: 'διαφορά τον χρόνο', value: 'withEleni.diff' },
      limit: 'Όριο πληρότητας: **{withEleni.be}**',
      track: {
        ends: TRACK_ENDS, ghost: 'be.base',
        marks: [{ at: 'be11.exact', labelFact: 'be11.ceil', side: 'l' }, { at: 'withEleni.beExact', from: 'be.base', labelFact: 'withEleni.be', side: 'r' }],
        bracket: { aFact: 'be11.exact', bFact: 'withEleni.beExact', left: 'αν λείψει ένας μήνας', right: 'αν έχεις ήδη ενοίκιο' },
      },
      zone: ['Το όριο δεν είναι ένα.', 'Είναι **ζώνη**.'],
      small: 'Παραδείγματα, όχι υπαρκτά πρόσωπα',
    }),
    calcCard({
      beats: 8, arc: 'action', in: 'cardFlip',
      story: 'Η κάρτα γυρίζει: ο υπολογιστής καθαρής απόδοσης. Ενοίκιο {rent}, μήνες {calc.months}, άλλα ενοίκια {withEleni.otherGross}. Βγάζει {withEleni.long}, το ίδιο ποσό με τη σκηνή της ζώνης.',
      cue: 'Ένα πλήκτρο σε κάθε πεδίο, χτύπημα στο αποτέλεσμα.',
      eyebrow: 'Βρες πού πέφτεις εσύ', title: ['Βάλε **και τα άλλα**', 'ενοίκιά σου'], name: 'Υπολογιστής καθαρής απόδοσης',
      fields: [{ label: 'Μηνιαίο ενοίκιο', value: 'rent' }, { label: 'Μήνες ενοικίασης', value: 'calc.months' }, { label: 'Άλλα ενοίκια', value: 'withEleni.otherGross' }],
      result: { label: 'Σου μένουν τον χρόνο', value: 'withEleni.long' }, path: '/kathari-apodosi',
      aside: 'Η πλευρά Airbnb με άλλα ενοίκια βγαίνει με τις ίδιες συναρτήσεις· ο υπολογιστής βραχυχρόνιας δεν έχει ακόμα αυτό το πεδίο.',
    }),
    hookPair({
      ...PAIR, beats: 14, arc: 'loop', in: 'rackFocus',
      end: { at: 4.6, text: ['Δεν μετράμε', 'τον χρόνο σου,', 'ζημιές ή εγγυήσεις.'], path: '/vraxyxronia-i-makroxronia', save: 'Κράτα το', send: 'Στείλ\' το' },
      story: 'Rack focus στη γραμμή ειλικρίνειας, το σήμα και ο σύνδεσμος. Μετά το ζευγάρι νύχτα και μέρα ξαναστήνεται στις θέσεις του πρώτου καρέ και το τελευταίο μισό δευτερόλεπτο είναι το πρώτο καρέ.',
      cue: 'Ο σφυγμός και το άρπισμα λύνονται στην πρώτη συγχορδία.',
    }),
  ],
  cover: 0,
  texts: {
    youtube: {
      title: 'Ίδιο διαμέρισμα, δύο δρόμοι: Airbnb ή ενοικιαστής #Shorts',
      description: [
        'Μία νύχτα στο Airbnb αφήνει {nightNet}, μόνο όταν γεμίσει. Μία μέρα με ενοικιαστή αφήνει {tenantPerDay}, κάθε μέρα.',
        '',
        'Ο φόρος του Airbnb ανεβαίνει με τις νύχτες: {margShort} από τη νύχτα {occ25.nights}, {occ35.marg} από τη νύχτα {occ35.nights}. Αν γεμίζει κυρίως το καλοκαίρι, περνά μπροστά τον {cumCross.monthAcc}. Ένας άδειος μήνας του ενοικιαστή ρίχνει το όριο στο {be11.ceil}. Με ένα ενοίκιο ήδη το ανεβάζει στο {withEleni.be}.',
        '',
        'Βάλε τα δικά σου: {ctaUrl}',
        '',
        'Παράδειγμα με τις προεπιλογές του υπολογιστή, όχι υπαρκτά πρόσωπα. Κλίμακα {year}, λήγει {validRental}. Για τη δική σου περίπτωση, ο λογιστής σου.',
      ].join('\n'),
      tags: ['Airbnb', 'βραχυχρόνια μίσθωση', 'μακροχρόνια μίσθωση', 'πληρότητα', 'φόρος ενοικίων', 'ιδιοκτήτες ακινήτων', 'PROPERWISE'],
    },
    instagram: {
      caption: [
        'Μία νύχτα στο Airbnb σού αφήνει {nightNet}, μόνο όταν γεμίσει. Μία μέρα με ενοικιαστή {tenantPerDay}, κάθε μέρα.',
        '',
        'Ο φόρος του Airbnb ανεβαίνει με τις νύχτες. Από τη νύχτα {occ25.nights} κάθε επόμενο ευρώ φορολογείται με {margShort} και από τη νύχτα {occ35.nights} με {occ35.marg}. Στο παράδειγμα ο μέσος φόρος είναι {effShort} του φορολογητέου. Του ενοικιαστή, {margLong}.',
        '',
        'Ίδιες νύχτες, ίδιο σύνολο, άλλη χρονιά. Αν το σπίτι γεμίζει κυρίως το καλοκαίρι, το Airbnb περνά μπροστά τον {cumCross.monthAcc}. {negMonths} μήνες τον χρόνο τα πάγια περνούν τις κρατήσεις.',
        '',
        'Και η μέρα έχει τον άδειο της μήνα. Ένας μήνας χωρίς ενοικιαστή σού στερεί {vacancy1} και τότε το Airbnb κερδίζει από {be11.ceil} πληρότητα.',
        '',
        'Αν έχεις ήδη ένα νοικιασμένο, το νέο εισόδημα φορολογείται ψηλότερα όποιον δρόμο κι αν πάρεις. Η διαφορά πέφτει στα {withEleni.diff} τον χρόνο και το όριο ανεβαίνει στο {withEleni.be}.',
        '',
        'Το όριο δεν είναι ένα. Είναι ζώνη, από {be11.ceil} ως {withEleni.be}.',
        '',
        'Δεν μετράμε τον χρόνο σου, ζημιές ή εγγυήσεις.',
        '',
        'Παράδειγμα, όχι υπαρκτά πρόσωπα: οι προεπιλογές του υπολογιστή ({rent} τον μήνα ή {nightPrice} τη νύχτα) και η Ελένη του χθεσινού βίντεο, το ακίνητο επίδειξης της εφαρμογής. Λήγει {validRental}.',
        '',
        'Κράτα το για όταν θα συγκρίνεις. Στείλ\' το σε όποιον σκέφτεται να βάλει και το δεύτερο σπίτι στο Airbnb.',
        '',
        'Ο υπολογιστής «Βραχυχρόνια ή μακροχρόνια»: σύνδεσμος στο προφίλ.',
      ].join('\n'),
      alt: 'Μία νύχτα Airbnb {nightNet} και μία μέρα ενοικιαστή {tenantPerDay}, με κορδέλες του χρόνου. Ροή της νύχτας: προμήθεια {nightFee}, καθαριότητα {nightClean}, πάγια {nightFixed}, φόρος {nightTax}. Καμπύλη μέσου φόρου με τείχη στις νύχτες {occ25.nights} και {occ35.nights}. Δώδεκα μήνες ταμείου και τρεις αθροιστικές γραμμές: «κυρίως καλοκαίρι» και «όλο τον χρόνο» τελειώνουν στο ίδιο {cumCross.decShort}. Ένας άδειος μήνας: {vacancy1}, όριο {be11.ceil}. Με ένα ενοίκιο ήδη: διαφορά {withEleni.diff}, όριο {withEleni.be}. Ζώνη από {be11.ceil} ως {withEleni.be}. Ο υπολογιστής καθαρής απόδοσης με τα άλλα ενοίκια.',
      hashtags: ['airbnb', 'ενοίκιο', 'βραχυχρόνιαμίσθωση', 'ακίνητα', 'PROPERWISE'],
    },
    tiktok: {
      caption: 'Μία νύχτα Airbnb αφήνει {nightNet}, μία μέρα με ενοικιαστή {tenantPerDay}. Το όριο δεν είναι ένα: είναι ζώνη από {be11.ceil} ως {withEleni.be}. Στείλ\' το σε όποιον σκέφτεται Airbnb.',
      hashtags: ['airbnb', 'ενοίκιο', 'ακίνητα', 'βραχυχρόνια', 'ελλάδα'],
    },
    pinned: 'Πόσο έμεινε άδειο το δικό σου ανάμεσα σε δύο ενοικιαστές; Βάλε τους μήνες σου στον υπολογιστή: {ctaUrl}',
  },
};
