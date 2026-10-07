// ═══════════════════════════════════════════════════════════════════════════
// ΠΕΜΠΤΗ 08/10/2026 · ΔΥΟ SHORTS
// ─────────────────────────────────────────────────────────────────────────
// 12:30 «Προθεσμία» (Φόροι και προθεσμίες): η επόμενη δόση του ΕΝΦΙΑ.
// 19:30 «Βραχυχρόνια»: τι αλλάζει στο τέλος ανθεκτικότητας από την 1η του μήνα.
//
// Το ημερολόγιο (docs/marketing/shorts/CALENDAR-2026Q4.md) δεν υπήρχε όταν
// γράφτηκαν: οι δύο θέσεις είναι αυτές της παραγγελίας.
//
// ΚΑΝΕΝΑ ΨΗΦΙΟ ΕΔΩ. Ό,τι αριθμός φαίνεται είναι `{γεγονός}` από το facts.ts.
// Οι πρωταγωνιστές είναι παραδείγματα, όχι πρόσωπα: η Μαρία έχει το διαμέρισμα
// των προεπιλογών του υπολογιστή ΕΝΦΙΑ, ο Νίκος την κράτηση του οδηγού ΤΑΚΚ.
// ═══════════════════════════════════════════════════════════════════════════
import type { ShortSpec } from '../spec';
import { enfiaFacts, takkFacts } from '../facts';
import {
  hookCount, hookStamp, calendar, mythFact, track, bigNumber, checklist, phoneNotify, endCard,
  nights, beforeAfter, quote, receipts, noaChat,
} from '../scenes';

// ═══ Α · 12:30 · «Προθεσμία» ═════════════════════════════════════════════
export const PROTHESMIA: ShortSpec = {
  id: '2026-10-08-1230-prothesmia',
  date: '2026-10-08', slot: '12:30', series: 'foroi',
  title: 'ΕΝΦΙΑ: η {nextNo} δόση λήγει {nextDM}, όχι {monthEndDM}',
  hook: 'Η {nextNo} δόση του ΕΝΦΙΑ λήγει σε {daysLeft} μέρες. Και η Μαρία μετρά λάθος.',
  protagonist: 'Η Μαρία έχει ένα διαμέρισμα {sqm} τ.μ. και πληρώνει τον ΕΝΦΙΑ σε δόσεις.',
  cta: { path: '/ypologismos-enfia', label: 'Υπολόγισε τον ΕΝΦΙΑ σου και δες κάθε δόση με ημερομηνία.' },
  utm: { campaign: 'short-2026-10-08-prothesmia' },
  facts: enfiaFacts,
  note: 'Παράδειγμα: οι προεπιλογές του υπολογιστή ΕΝΦΙΑ του site',
  hooks: [
    {
      name: 'Αντίστροφη μέτρηση',
      why: 'Ο μεγάλος αριθμός διαβάζεται πριν από κάθε λέξη και οι μέρες ανάβουν από το πρώτο καρέ. Το «μετρά λάθος» ανοίγει ερώτηση που κλείνει μόνο αν μείνεις.',
      scene: hookCount({
        beats: 10, arc: 'hook',
        story: 'Πρώτο καρέ: «{daysLeft} ΜΕΡΕΣ» για την {nextNo} δόση, οι μέρες ανάβουν μία μία, «Και η Μαρία μετρά λάθος».',
        cue: 'Χτύπημα και μπάσο στο πρώτο καρέ, ένα τικ ανά μέρα, κρούση στο «λάθος».',
        eyebrow: 'ΕΝΦΙΑ {enfiaYear}', lines: ['Η **{nextNo}** δόση', 'λήγει σε'], valueFact: 'daysLeft', unit: 'μέρες', dotsFact: 'daysDots',
        punch: 'Και η Μαρία **μετρά λάθος**.',
      }),
    },
    {
      name: 'Σφραγίδα «Αργά»',
      why: 'Δυνατή σύγκρουση, αλλά στο πρώτο καρέ η σφραγίδα δεν έχει πέσει ακόμη και το «{monthEndDM}» δεν λέει τίποτα σε όποιον δεν ξέρει ότι είναι Σάββατο: θέλει δεύτερη ανάγνωση.',
      scene: hookStamp({
        beats: 10, arc: 'hook',
        story: 'Πρώτο καρέ: «Η Μαρία πληρώνει την {nextNo} δόση στις {monthEndDM}». Σφραγίδα «ΑΡΓΑ».',
        cue: 'Χτύπημα στο πρώτο καρέ, σφραγίδα με μπάσο και παλαμάκι.',
        eyebrow: 'ΕΝΦΙΑ {enfiaYear}', lines: ['Η Μαρία θα', 'πληρώσει την {nextNo}', 'δόση στις **{monthEndDM}**.'], stamp: 'Αργά.',
        sub: 'Ο ΕΝΦΙΑ δεν περιμένει το Σαββατοκύριακο.',
      }),
    },
  ],
  pick: 0,
  rubric: {
    signals: [
      { signal: 'hook', scene: 0, note: '«{daysLeft} ΜΕΡΕΣ» για την {nextNo} δόση, ορατό από το πρώτο καρέ.' },
      { signal: 'conflict', scene: 0, note: '«Και η Μαρία μετρά λάθος»: ερώτηση που κλείνει μόνο αν μείνεις.' },
      { signal: 'revelation', scene: 1, note: 'Το {monthEndDM} είναι {monthEndWeekday}: η δόση λήγει {nextWeekday} {nextDM}.' },
      { signal: 'opinion', scene: 2, note: 'Ο μύθος της Δευτέρας διαγράφεται: νωρίτερα, όχι αργότερα.' },
      { signal: 'quotable', scene: 2, note: '«Νωρίτερα, όχι αργότερα.»' },
      { signal: 'story', scene: 4, note: 'Το ποσό της Μαρίας: {restSum} ως τις {lastDMY}.' },
      { signal: 'practical', scene: 5, note: 'Τα τρία βήματα στο {portal}, με την ταυτότητα οφειλής.' },
      { signal: 'practical', scene: 6, note: 'Η υπενθύμιση της εφαρμογής την παραμονή.' },
    ],
    score: 78,
    why: 'Μια πραγματική αντίστροφη μέτρηση με ανατροπή για όποιον πληρώνει σε δόσεις. Η λύση έρχεται σε τρία βήματα.',
  },
  scenes: [
    calendar({
      beats: 14, arc: 'stakes', in: 'zoomThrough', inOpts: { target: 'hz0' },
      story: 'Ζουμ μέσα στον αριθμό: ο Οκτώβριος. Οι μέρες ως την προθεσμία γεμίζουν, το {monthEndDM} διαγράφεται, το {nextDM} σε κύκλο.',
      cue: 'Σάρωμα που ανεβαίνει στο ζουμ, τικ ανά μέρα, δύο γρατζουνιές στο Χ, καμπάνα στον κύκλο.',
      eyebrow: 'Η ΠΡΟΘΕΣΜΙΑ', title: ['Το {monthEndDM} είναι', '**{monthEndWeekday}**.'],
      todayFact: 'todayIso', targetFact: 'nextIso', strikeFact: 'monthEndIso', strikeLabel: 'Όχι {monthEndDM}', caption: 'Λήγει {nextWeekday} {nextDM}.',
    }),
    mythFact({
      beats: 13, arc: 'turn', in: 'splitSwap',
      story: 'Η οθόνη σκίζεται: «Μύθος» διαγράφεται, «Γεγονός»: τελευταία εργάσιμη, νωρίτερα, όχι αργότερα.',
      cue: 'Σκίσιμο με βαθύ χτύπημα, σάρωμα στη διαγραφή, καμπάνα στο γεγονός.',
      eyebrow: 'ΤΙ ΙΣΧΥΕΙ', myth: 'Αν το τέλος του μήνα πέσει Σαββατοκύριακο, πληρώνεις τη Δευτέρα.',
      fact: 'Η δόση λήγει την **τελευταία εργάσιμη** του μήνα. Νωρίτερα, όχι αργότερα.', source: '{law}',
    }),
    track({
      beats: 12, arc: 'stakes', in: 'maskWipe', inOpts: { shape: 'circle' },
      story: 'Οι δόσεις της Μαρίας: {paid} πράσινες, η {nextNo} πάλλεται, μένουν {left}.',
      cue: 'Κύκλος που ανοίγει με νότα, κλικ ανά δόση, δύο νότες στα σύνολα.',
      eyebrow: 'ΟΙ ΔΟΣΕΙΣ ΤΗΣ ΜΑΡΙΑΣ', title: ['{total} δόσεις,', 'μία **κάθε μήνα**.'], datesFact: 'dates', nextFact: 'nextNo',
      labels: ['πληρωμένες', 'μένουν'], paidFact: 'paid', leftFact: 'left',
    }),
    bigNumber({
      beats: 13, arc: 'payoff', in: 'matchCut', inOpts: { from: 'tk3n', to: 'bn4' }, note: true,
      story: 'Η δόση που πάλλεται γίνεται το ποσό: {restSum} μένουν ως τις {lastDMY}, {each} τον μήνα.',
      cue: 'Κλικ που μετρούν, βαθύ χτύπημα και καμπάνα στο ποσό.',
      eyebrow: 'ΤΙ ΜΕΝΕΙ ΓΙΑ ΤΗ ΜΑΡΙΑ', title: ['Ως τις **{lastDMY}**:'], valueFact: 'restSum',
      caption: '**{each}** τον μήνα για διαμέρισμα **{sqm} τ.μ.** Η τελευταία δόση **{lastAmount}**.',
      rows: [0, 1, 2, 3, 4].map(i => ({ label: `{row${i}No} · {row${i}DM}`, value: `{row${i}Amt}` })),
      chips: ['Ετήσιος ΕΝΦΙΑ {annual}'],
    }),
    checklist({
      beats: 14, arc: 'action', in: 'whip',
      story: 'Whip: πώς πληρώνει ως {nextWeekday}. Τρία βήματα τσεκάρονται.',
      cue: 'Whoosh και κλικ στο κόψιμο, νότα που ανεβαίνει σε κάθε τσεκ.',
      eyebrow: 'ΠΩΣ ΠΛΗΡΩΝΕΙΣ ΩΣ {nextDM}', title: ['Τρία βήματα', 'στο **{portal}**.'],
      items: [
        { text: 'Μπαίνεις στο {portal}', small: 'Με τους κωδικούς TAXISnet.' },
        { text: 'Ανοίγεις «{step2}»', small: '{step0} › {step1} › {step2}' },
        { text: 'Πληρώνεις με την ταυτότητα οφειλής', small: 'Από το web banking της τράπεζάς σου.' },
      ],
    }),
    phoneNotify({
      beats: 15, arc: 'action', in: 'cardFlip',
      story: 'Η κάρτα γυρίζει: οθόνη κλειδώματος, {pushEveWeekday}. «{pushTitle} · {pushBody}». Από κάτω οι επόμενες δόσεις.',
      cue: 'Γύρισμα χαρτιού, διπλό κλικ ειδοποίησης, δύο καμπάνες.',
      eyebrow: 'Η ΥΠΕΝΘΥΜΙΣΗ', title: ['Το PROPERWISE', 'σου το **θυμίζει**.'], dateLine: '{pushDay}',
      push: { title: '{pushTitle}', body: '{pushBody}' }, rowsTitle: 'Οι επόμενες δόσεις',
      rows: [0, 1, 2, 3, 4].map(i => ({ label: `{row${i}No}`, value: `{row${i}DM}`, on: i === 0 })),
    }),
    endCard({
      beats: 13, arc: 'loop', in: 'lightLeak',
      story: 'Διαρροή φωτός: σήμα, «Πόσος είναι ο δικός σου ΕΝΦΙΑ;», ο σύνδεσμος. Το τελευταίο μισό δευτερόλεπτο ξαναστήνει το πρώτο καρέ.',
      cue: 'Ζεστό σάρωμα και συγχορδία από καμπάνες, η πρώτη συγχορδία στο τέλος για να δέσει ο βρόχος.',
      title: ['Πόσος είναι ο', '**δικός σου** ΕΝΦΙΑ;'], path: '/ypologismos-enfia', action: 'Υπολόγισε το ποσό και δες κάθε δόση με ημερομηνία.',
    }),
  ],
  cover: 0,
  texts: {
    youtube: {
      title: 'ΕΝΦΙΑ: η {nextNo} δόση λήγει {nextDM}, όχι {monthEndDM} #Shorts',
      description: [
        'Η {nextNo} δόση του ΕΝΦΙΑ {enfiaYear} λήγει {nextWeekday} {nextDM}. Το {monthEndDM} είναι {monthEndWeekday} και η δόση λήγει την τελευταία εργάσιμη του μήνα: νωρίτερα, όχι αργότερα ({law}).',
        '',
        'Το παράδειγμα: διαμέρισμα {sqm} τ.μ. με τις προεπιλογές του υπολογιστή. Ετήσιος ΕΝΦΙΑ {annual}, {each} τον μήνα. Από την {nextNo} ως την τελευταία μένουν {restSum}, ως τις {lastDMY}.',
        '',
        'Πληρώνεις από το {portal}: {step0}, {step1}, {step2}. Με την ταυτότητα οφειλής από το web banking.',
        '',
        'Ο δικός σου ΕΝΦΙΑ και κάθε δόση με ημερομηνία: {ctaUrl}',
      ].join('\n'),
      tags: ['ΕΝΦΙΑ', 'ΕΝΦΙΑ {enfiaYear}', 'δόσεις ΕΝΦΙΑ', 'προθεσμία ΕΝΦΙΑ', 'myAADE', 'φόροι ακινήτων', 'ιδιοκτήτες ακινήτων', 'PROPERWISE'],
    },
    instagram: {
      caption: [
        'Η {nextNo} δόση του ΕΝΦΙΑ λήγει {nextWeekday} {nextDM}, όχι {monthEndDM}.',
        '',
        'Το {monthEndDM} είναι {monthEndWeekday}. Όταν το τέλος του μήνα πέφτει Σαββατοκύριακο ή αργία, η δόση λήγει την προηγούμενη εργάσιμη: νωρίτερα, όχι αργότερα.',
        '',
        'Στο παράδειγμα (διαμέρισμα {sqm} τ.μ., οι προεπιλογές του υπολογιστή) μένουν {left} δόσεις, {restSum} ως τις {lastDMY}.',
        '',
        'Το PROPERWISE βάζει κάθε δόση στο ημερολόγιό σου και σου τη θυμίζει την παραμονή.',
        '',
        'Υπολόγισε τον δικό σου ΕΝΦΙΑ: σύνδεσμος στο bio.',
      ].join('\n'),
      alt: 'Αντίστροφη μέτρηση {daysLeft} ημερών για την {nextNo} δόση του ΕΝΦΙΑ. Ημερολόγιο Οκτωβρίου: το {monthEndDM} είναι {monthEndWeekday}, η δόση λήγει {nextWeekday} {nextDM}. Μύθος και γεγονός για την προθεσμία. Μένουν {left} από {total} δόσεις, {restSum} στο παράδειγμα. Τα βήματα στο {portal} και η ειδοποίηση της εφαρμογής.',
      hashtags: ['ΕΝΦΙΑ', 'ακίνητα', 'φόροι', 'ιδιοκτήτες', 'PROPERWISE'],
    },
    tiktok: {
      caption: 'Η {nextNo} δόση του ΕΝΦΙΑ λήγει {nextDM}, όχι {monthEndDM}. Το {monthEndDM} είναι {monthEndWeekday}. Αποθήκευσέ το πριν την πληρώσεις.',
      hashtags: ['ΕΝΦΙΑ', 'ακίνητα', 'φόροι', 'ελλάδα', 'οικονομικά'],
    },
    pinned: 'Εσύ πληρώνεις τον ΕΝΦΙΑ εφάπαξ ή σε δόσεις; Η {nextNo} λήγει {nextWeekday} {nextDM}. Ο δικός σου, με κάθε δόση: {ctaUrl}',
  },
};

// ═══ Β · 19:30 · «Βραχυχρόνια» ═══════════════════════════════════════════
export const VRAXYXRONIA: ShortSpec = {
  id: '2026-10-08-1930-vraxyxronia',
  date: '2026-10-08', slot: '19:30', series: 'vraxy',
  title: 'Airbnb: από {lowDM} το τέλος ανά νύχτα πέφτει στα {aptLow}',
  hook: 'Ο Νίκος χρεώνει {levyWrong} τέλος. Λάθος.',
  protagonist: 'Ο Νίκος νοικιάζει ένα διαμέρισμα στο Airbnb. Κράτηση {arrDM}–{depDM}.',
  cta: { path: '/odigos/airbnb-takk-2026', label: 'Όλος ο οδηγός για το τέλος ανθεκτικότητας, με πηγές.' },
  utm: { campaign: 'short-2026-10-08-vraxyxronia' },
  facts: takkFacts,
  note: 'Παράδειγμα: η κράτηση του οδηγού για το Airbnb',
  hooks: [
    {
      name: 'Σφραγίδα «Λάθος»',
      why: 'Ένα ποσό και μια λέξη: «{levyWrong} τέλος. ΛΑΘΟΣ.» Ο ιδιοκτήτης στο Airbnb αναγνωρίζει αμέσως ότι μπορεί να είναι ο ίδιος και μένει για τη σωστή απάντηση.',
      scene: hookStamp({
        beats: 9, arc: 'hook',
        story: 'Πρώτο καρέ: «Ο Νίκος χρεώνει {levyWrong} τέλος» για κράτηση {arrDM}–{depDM}. Σφραγίδα «ΛΑΘΟΣ».',
        cue: 'Χτύπημα στο πρώτο καρέ, σφραγίδα με μπάσο και παλαμάκι.',
        eyebrow: 'ΚΡΑΤΗΣΗ {arrDM}–{depDM}', lines: ['Ο Νίκος **χρεώνει**', '**{levyWrong}** τέλος.'], hero: 1, stamp: 'Λάθος.',
        chip: 'Διαμέρισμα στο Airbnb',
      }),
    },
    {
      name: 'Αντίστροφη μέτρηση',
      why: 'Καθαρός αριθμός, αλλά «σε {toLow} μέρες» είναι είδηση χωρίς πρόσωπο: δεν λέει ακόμη τι κοστίζει σε εσένα.',
      scene: hookCount({
        beats: 9, arc: 'hook',
        story: 'Πρώτο καρέ: «{toLow} ΜΕΡΕΣ» ως την αλλαγή του τέλους, οι μέρες ανάβουν.',
        cue: 'Χτύπημα στο πρώτο καρέ, ένα τικ ανά μέρα.',
        eyebrow: 'ΤΕΛΟΣ ΑΝΘΕΚΤΙΚΟΤΗΤΑΣ', lines: ['Το τέλος ανά νύχτα', 'αλλάζει σε'], valueFact: 'toLow', unit: 'μέρες', dotsFact: 'toLow',
        punch: 'Και ο Νίκος έχει ήδη κράτηση.',
      }),
    },
  ],
  pick: 0,
  rubric: {
    signals: [
      { signal: 'hook', scene: 0, note: '«{levyWrong} τέλος. ΛΑΘΟΣ.» στο πρώτο καρέ.' },
      { signal: 'conflict', scene: 0, note: 'Ο Νίκος χρεώνει λάθος ποσό σε κράτηση που πέφτει πάνω στην αλλαγή.' },
      { signal: 'revelation', scene: 2, note: 'Από {lowDM} το διαμέρισμα πληρώνει {aptLow} τη νύχτα, όχι {aptHigh}.' },
      { signal: 'quotable', scene: 4, note: '«Ένα στοιχείο για κάθε μήνα.»' },
      { signal: 'story', scene: 4, note: 'Το σωστό ποσό: {levyTotal}, όχι {levyWrong}.' },
      { signal: 'practical', scene: 5, note: 'Οι δύο προθεσμίες απόδοσης, {octDeadline} και {novDeadline}.' },
    ],
    score: 74,
    why: 'Ένα λάθος που ο οικοδεσπότης μπορεί να κάνει σε κράτηση αυτών των ημερών, διορθωμένο με τον λογαριασμό του οδηγού.',
  },
  scenes: [
    nights({
      beats: 12, arc: 'stakes', in: 'whip', note: true,
      story: 'Whip: οι {nightsAll} νύχτες της κράτησης ως πλακίδια. Η γραμμή «Από {lowDM}» τις χωρίζει στα δύο.',
      cue: 'Whoosh στο κόψιμο, κλικ ανά πλακίδιο, βαθύ χτύπημα στη γραμμή.',
      eyebrow: 'ΜΙΑ ΚΡΑΤΗΣΗ', title: ['{nightsAll} νύχτες,', 'δύο **ποσά**.'],
      nights: [0, 1, 2, 3, 4, 5, 6, 7].map(i => ({ dayFact: `n${i}d`, rateFact: `n${i}r`, high: i < 4 })),
      months: ['{octMonth}', '{novMonth}'], splitLabel: 'Από {lowDM}', caption: 'Σε **{toLow} μέρες** αλλάζει το τέλος ανά νύχτα.',
    }),
    beforeAfter({
      beats: 12, arc: 'stakes', in: 'typeSlam', inOpts: { word: 'Από {lowDM}', sub: 'το τέλος ανά νύχτα' },
      story: 'Η λέξη «ΑΠΟ {lowDM}» πέφτει στην οθόνη. Διαμέρισμα από {aptHigh} σε {aptLow}, μονοκατοικία από {houseHigh} σε {houseLow}.',
      cue: 'Σάρωμα, χτύπημα με παλαμάκι στη λέξη, δύο κρούσεις στα νέα ποσά.',
      eyebrow: 'ΤΟ ΤΕΛΟΣ ΑΝΑ ΝΥΧΤΑ', title: ['Χαμηλή περίοδος', 'από **{lowDM}**.'], heads: ['Ως {lastHighDM}', 'Από {lowDM}'],
      rows: [
        { label: 'Διαμέρισμα, όσα τ.μ. κι αν έχει', before: 'aptHigh', after: 'aptLow' },
        { label: 'Μονοκατοικία άνω των {houseSqm} τ.μ.', before: 'houseHigh', after: 'houseLow' },
      ],
    }),
    quote({
      beats: 12, arc: 'turn', in: 'rackFocus',
      story: 'Rack focus: η συχνή ερώτηση γράφεται γράμμα γράμμα. Απάντηση: {docs} ειδικά στοιχεία, ένα ανά μήνα.',
      cue: 'Σάρωμα που κατεβαίνει, πλήκτρα, καμπάνα στην απάντηση.',
      label: 'Συχνή ερώτηση', question: 'Κράτηση από {octMonthAcc} σε {novMonthAcc}: πόσες αποδείξεις εκδίδω;', source: '{faqRef}',
      answer: '**{docs} ειδικά στοιχεία**, ένα ανά μήνα.',
    }),
    receipts({
      beats: 14, arc: 'payoff', in: 'matchCut', inOpts: { from: 'qa3', to: 'rsum4' }, note: true,
      story: 'Η απάντηση γίνεται το σύνολο: {octNights} × {octRate} = {octLevy} και {novNights} × {novRate} = {novLevy}. Σύνολο {levyTotal}, όχι {levyWrong}.',
      cue: 'Δύο αποδείξεις που σκίζουν τον αέρα, βαθύ χτύπημα και καμπάνα στο σύνολο, σάρωμα στη διαγραφή.',
      eyebrow: 'ΤΟ ΤΕΛΟΣ ΤΟΥ ΝΙΚΟΥ', title: ['Ένα στοιχείο', 'για **κάθε μήνα**.'],
      slips: [
        { head: '{octMonth}', lines: [['Νύχτες', '{octNights}'], ['Ανά νύχτα', '{octRate}']], total: 'octLevy' },
        { head: '{novMonth}', lines: [['Νύχτες', '{novNights}'], ['Ανά νύχτα', '{novRate}']], total: 'novLevy' },
      ],
      sumLabel: 'Σύνολο κράτησης', sum: 'levyTotal', wrong: 'levyWrong', wrongLabel: 'Όχι {levyWrong}: οι νύχτες του {novMonthGen} έχουν το χαμηλό ποσό.',
    }),
    noaChat({
      beats: 18, arc: 'action', in: 'zoomThrough', inOpts: { target: 'rsv4' },
      story: 'Ζουμ μέσα στο σύνολο: ο Νίκος ρωτά τη Νόα πότε το αποδίδει. Απάντηση με τις {docs} προθεσμίες.',
      cue: 'Σάρωμα στο ζουμ, πλήκτρα, τελείες που χτυπούν, νότα στην απάντηση.',
      eyebrow: 'ΚΑΙ Η ΔΗΛΩΣΗ', title: ['Πότε το αποδίδεις;', 'Ρώτα **τη Νόα**.'],
      question: 'Πότε αποδίδω το τέλος αυτής της κράτησης;',
      answer: '{docs} δηλώσεις: για το στοιχείο του {octMonthGen} ως {octDeadline}, για του {novMonthGen} ως {novDeadline}.',
      trial: '{trial}',
    }),
    endCard({
      beats: 11, arc: 'loop', in: 'lightLeak',
      story: 'Διαρροή φωτός: σήμα, «Όλος ο οδηγός για το Airbnb», ο σύνδεσμος. Ο βρόχος ξαναστήνει το πρώτο καρέ.',
      cue: 'Ζεστό σάρωμα, καμπάνες, η πρώτη συγχορδία στο τέλος.',
      title: ['Όλος ο οδηγός', 'για το **Airbnb**.'], path: '/odigos/airbnb-takk-2026', action: 'Ποσά, δηλώσεις και φόρος εισοδήματος, με πηγές.',
    }),
  ],
  cover: 0,
  texts: {
    youtube: {
      title: 'Airbnb: από {lowDM} το τέλος ανά νύχτα πέφτει στα {aptLow} #Shorts',
      description: [
        'Το τέλος ανθεκτικότητας για διαμέρισμα βραχυχρόνιας πέφτει από {aptHigh} σε {aptLow} τη νύχτα από {lowDM}. Μονοκατοικία άνω των {houseSqm} τ.μ.: από {houseHigh} σε {houseLow}.',
        '',
        'Κράτηση {arrDM}–{depDM}: {octNights} νύχτες {octMonthGen} × {octRate} = {octLevy} και {novNights} νύχτες {novMonthGen} × {novRate} = {novLevy}. Σύνολο {levyTotal}, όχι {levyWrong}. {docs} ειδικά στοιχεία, ένα ανά μήνα ({faqRef}).',
        '',
        'Δηλώσεις απόδοσης: για το στοιχείο του {octMonthGen} ως {octDeadline}, για του {novMonthGen} ως {novDeadline}.',
        '',
        'Όλος ο οδηγός, με πηγές: {ctaUrl}',
      ].join('\n'),
      tags: ['Airbnb', 'τέλος ανθεκτικότητας', 'ΤΑΚΚ', 'βραχυχρόνια μίσθωση', 'Booking', 'ΑΑΔΕ', 'ιδιοκτήτες ακινήτων', 'PROPERWISE'],
    },
    instagram: {
      caption: [
        'Από {lowDM} το τέλος ανθεκτικότητας για διαμέρισμα πέφτει από {aptHigh} σε {aptLow} τη νύχτα.',
        '',
        'Και μια κράτηση που περνά τον μήνα θέλει {docs} ειδικά στοιχεία, ένα ανά μήνα. Στο παράδειγμα ({arrDM}–{depDM}): {octLevy} για τις νύχτες του {octMonthGen}, {novLevy} για του {novMonthGen}. Σύνολο {levyTotal}, όχι {levyWrong}.',
        '',
        'Αποδίδεις το καθένα με τη δική του δήλωση: ως {octDeadline} και ως {novDeadline}.',
        '',
        'Όλος ο οδηγός με πηγές: σύνδεσμος στο bio.',
      ].join('\n'),
      alt: 'Κράτηση {arrDM}–{depDM} σε διαμέρισμα Airbnb. {nightsAll} πλακίδια νυχτών: {octNights} με {octRate} και {novNights} με {novRate} από {lowDM}. Πριν και μετά: διαμέρισμα {aptHigh} σε {aptLow}, μονοκατοικία {houseHigh} σε {houseLow}. Δύο αποδείξεις, {octLevy} και {novLevy}, σύνολο {levyTotal}. Η Νόα απαντά για τις δηλώσεις.',
      hashtags: ['airbnb', 'βραχυχρόνιαμίσθωση', 'ακίνητα', 'ιδιοκτήτες', 'PROPERWISE'],
    },
    tiktok: {
      caption: 'Κράτηση {arrDM}–{depDM} στο Airbnb: τέλος {levyTotal}, όχι {levyWrong}. Από {lowDM} το διαμέρισμα πληρώνει {aptLow} τη νύχτα. Στείλ\' το σε όποιον έχει Airbnb.',
      hashtags: ['airbnb', 'ακίνητα', 'ελλάδα', 'βραχυχρόνια', 'οικονομικά'],
    },
    pinned: 'Έχεις κράτηση που περνά από {octMonthAcc} σε {novMonthAcc}; Κόβεις {docs} ειδικά στοιχεία, ένα ανά μήνα. Ο οδηγός: {ctaUrl}',
  },
};

export const SPECS = [PROTHESMIA, VRAXYXRONIA];
