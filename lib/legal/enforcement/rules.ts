// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΜΗΤΡΩΟ ΚΑΝΟΝΩΝ ΤΗΣ ΠΡΟΣΤΑΣΙΑΣ ΙΔΙΟΚΤΗΤΗ
// ─────────────────────────────────────────────────────────────────────────
// Κάθε αριθμός ημερών, μηνών ή ποσοστού που φτάνει στην οθόνη ζει ΕΔΩ, στα
// `params`. Οι οθόνες τον διαβάζουν μέσω του copy.ts· ο φύλακας
// scripts/guard-legal-day-literals.mjs κόβει ψηφίο γραμμένο με το χέρι.
//
// ΔΥΟ ΒΑΘΜΙΔΕΣ, ΚΑΜΙΑ ΤΡΙΤΗ (απόφαση ιδιοκτήτη 12/11/2026):
//   · 'verified': δύο πηγές, η μία το κείμενο του ΦΕΚ και η άλλη ανεξάρτητη,
//     με αυτούσιο απόσπασμα που ο φύλακας βρίσκει στο στιγμιότυπο. Verifier
//     η ομάδα ('properwise-team'), όχι πρόσωπο, όχι δικηγόρος.
//   · `lawyerReviewed`: ΚΕΝΟ για όλους. Γεμίζει μόνο με την υπογραφή του
//     δικηγόρου στον κατάλογο ελέγχου, με ψευδώνυμο, ημερομηνία και έκδοση.
//
// ΟΣΑ ΔΕΝ ΕΠΑΛΗΘΕΥΤΗΚΑΝ ΜΕΝΟΥΝ ΕΔΩ ΩΣ 'withheld', με τον λόγο. Η μηχανή δεν
// βγάζει ποτέ ημερομηνία από αυτούς· η οθόνη γράφει «Επιβεβαίωσε με δικηγόρο».
// Είναι εδώ για να φαίνεται τι λείπει, όχι για να ξεχαστεί.
//
// Συμβάσεις υπολογισμού που ΔΕΝ επαληθεύτηκαν και γι' αυτό η μηχανή δίνει
// εύρος και όχι ημερομηνία: έναρξη την επομένη (C1), λήξη σε μη εργάσιμη (C2),
// ορισμός της εργάσιμης και τοπικές αργίες (C3), μέτρηση «Ν εργάσιμες πριν»
// (C5), εργάσιμες του Αυγούστου στις προθεσμίες προς τα πίσω (C6), μήνες στο
// τέλος του μήνα (C7). Βλ. κανόνες 'conv-144' και 'conv-workday'.
// ═══════════════════════════════════════════════════════════════════════════
import { SOURCES } from './sources';
import { grDate } from '@/lib/core/format';
import type { LegalRule } from './types';
import { DEBT_INSTALMENTS, SERVICER_DOCS_DAYS, SERVICER_PROPOSAL_MONTHS, SERVICER_RULES_FROM } from './numbers';

export type { LegalRule, RuleSource, Regime, LawyerReview, RuleParams } from './types';

const src = (id: string) => {
  const s = SOURCES[id];
  if (!s) throw new Error(`enforcement/rules: λείπουν οι πηγές του «${id}»`);
  return s;
};

const KPOLD_5221 = "ν. 5221/2025 (ΦΕΚ Α' 133/28.07.2025)";
const KPOLD_4842 = "ν. 4842/2021 (ΦΕΚ Α' 190/13.10.2021)";
const N5282 = "ν. 5282/2026 (ΦΕΚ Α' 30/27.02.2026)";
const N5354 = "ν. 5354/2026 (ΦΕΚ Α' 184/09.11.2026)";

const verified = (r: Omit<LegalRule, 'status' | 'verifier' | 'sources' | 'lawyerReviewed'>): LegalRule => ({
  ...r, status: 'verified', verifier: 'properwise-team', sources: src(r.id), lawyerReviewed: null,
});
const withheld = (r: Omit<LegalRule, 'status' | 'verifier' | 'sources' | 'lawyerReviewed' | 'params' | 'regime' | 'ambiguities'> & { withheldReason: string }): LegalRule => ({
  ...r, regime: 'any', params: {}, ambiguities: [], status: 'withheld', verifier: null, sources: [], lawyerReviewed: null,
});

export const RULES: readonly LegalRule[] = [
  // ── Καθεστώς και γενικοί κανόνες ────────────────────────────────────────
  verified({
    id: 'regime-126-7', version: 1,
    label: 'Ποιο καθεστώς εκτέλεσης ισχύει',
    provision: 'ν. 5221/2025 άρθρο 126 §7', amendedBy: KPOLD_5221,
    regime: 'any', params: { date: '2026-01-01' },
    ambiguities: ['Τι γίνεται με νέα επιταγή μετά τις 01/01/2026 σε εκτέλεση που ξεκίνησε πριν.'],
    validFrom: '2026-01-01', validTo: null,
  }),
  verified({
    // ΤΟ ΠΑΛΙΟ ΚΑΘΕΣΤΩΣ ΕΧΕΙ ΚΙ ΑΥΤΟ ΑΡΧΗ (έλεγχος 13/11/2026). Οι κανόνες του
    // ν. 4842/2021 ισχύουν για επιταγές από 01/01/2022 (άρθρα 116 §6γ και 120).
    // Για παλιότερη επιταγή η μηχανή δεν δίνει ημερομηνία.
    id: 'regime-4842-2022', version: 1,
    label: 'Από πότε ισχύουν οι διατάξεις του ν. 4842/2021 για την εκτέλεση',
    provision: 'ν. 4842/2021 άρθρα 116 §6γ και 120', amendedBy: KPOLD_4842,
    regime: 'any', params: { date: '2022-01-01' },
    ambiguities: ['Το 116 §6γ λέει «μετά από την έναρξη ισχύος του παρόντος νόμου»· το άρθρο 120 βάζει τα άρθρα 116 και το Μέρος Α΄ σε ισχύ την 01/01/2022, ενώ ο νόμος δημοσιεύθηκε 13/10/2021. Η εφαρμογή παίρνει τη συντηρητική ανάγνωση.'],
    validFrom: '2022-01-01', validTo: null,
  }),
  verified({
    id: 'aug-147-2', version: 1,
    label: 'Ο Αύγουστος δεν μετρά σε ορισμένες προθεσμίες',
    provision: 'ΚΠολΔ 147 §2', amendedBy: N5282,
    regime: 'any', params: {},
    ambiguities: ['Για προθεσμίες που μετρούν προς τα πίσω από τον πλειστηριασμό (938 §4, 954 §4), που δεν είναι στη λίστα, δεν είναι σαφές αν οι εργάσιμες του Αυγούστου μετρούν.'],
    validFrom: '2026-02-27', validTo: null,
  }),

  // ── Ανακοπή κατά της εκτέλεσης ──────────────────────────────────────────
  verified({
    id: 'an-934a-new', version: 1,
    label: 'Ανακοπή κατά της εκτέλεσης μετά την κατάσχεση',
    provision: "ΚΠολΔ 934 §1 στοιχ. α'", amendedBy: `${KPOLD_5221}, άρθρο 105`,
    regime: 'new', params: { count: 45, unit: 'calendar' },
    ambiguities: [
      'Έναρξη την επομένη της κατάσχεσης (σύμβαση C1, όχι επαληθευμένη).',
      'Λήξη σε μη εργάσιμη: μεταφορά στην επόμενη εργάσιμη (σύμβαση C2, όχι επαληθευμένη).',
    ],
    validFrom: '2026-01-01', validTo: null,
  }),

  // ── Κατάσχεση ακινήτου και ημέρα πλειστηριασμού ─────────────────────────
  verified({
    id: 'ka-993-window', version: 1,
    label: 'Πότε ορίζεται ο πλειστηριασμός ακινήτου',
    provision: 'ΚΠολΔ 993 §2', amendedBy: `${KPOLD_4842}, άρθρο 76`,
    regime: 'any', params: { count: 7, countTo: 8, unit: 'months' },
    ambiguities: [
      'Αν η προθεσμία πέφτει τον Αύγουστο, ο νόμος λέει ότι «λαμβάνεται υπόψη ο επόμενος μήνας»· δεν είναι σαφές αν μετατοπίζεται και το όριο των οκτώ μηνών.',
      'Δεν βρέθηκε τροποποίηση του 993 §2 στα ΦΕΚ των ν. 5221/2025, 5282/2026 και 5354/2026· αυτό δεν αποκλείει τροποποίηση σε άλλον νόμο.',
    ],
    validFrom: '2022-01-01', validTo: null,
  }),
  verified({
    // Στο μητρώο ΜΟΝΟ για να μη μπερδευτεί με το 993 §2: αφορά κινητά. Η μηχανή
    // αρνείται να το εφαρμόσει σε ακίνητο (engine.ts, auctionWindow).
    id: 'ka-954-2e-movable', version: 1,
    label: 'Πότε ορίζεται ο πλειστηριασμός κινητού (όχι ακινήτου)',
    provision: "ΚΠολΔ 954 §2 στοιχ. ε'", amendedBy: `${N5282}, άρθρο 37`,
    regime: 'any', params: { count: 5, countTo: 6, unit: 'months' },
    ambiguities: [],
    validFrom: '2026-02-27', validTo: null,
  }),
  verified({
    id: 'ka-954-4-new', version: 1,
    label: 'Ανακοπή για διόρθωση της έκθεσης ή της τιμής πρώτης προσφοράς',
    provision: 'ΚΠολΔ 954 §4 (για ακίνητα μέσω του 993 §2)', amendedBy: `${KPOLD_5221}, άρθρο 111`,
    regime: 'new', params: { count: 30, unit: 'working' },
    ambiguities: ['Μέτρηση «το αργότερο Ν εργάσιμες πριν» (σύμβαση C5).', 'Εργάσιμες του Αυγούστου (σύμβαση C6).', 'Τοπικές αργίες (σύμβαση C3).'],
    validFrom: '2026-01-01', validTo: null,
  }),
  verified({
    id: 'ka-954-4-old', version: 1,
    label: 'Ανακοπή για διόρθωση της έκθεσης ή της τιμής πρώτης προσφοράς',
    provision: 'ΚΠολΔ 954 §4 (για ακίνητα μέσω του 993 §2)', amendedBy: `${KPOLD_4842}, άρθρο 63`,
    regime: 'old', params: { count: 15, unit: 'working' },
    ambiguities: ['Μέτρηση «το αργότερο Ν εργάσιμες πριν» (σύμβαση C5).', 'Εργάσιμες του Αυγούστου (σύμβαση C6).', 'Τοπικές αργίες (σύμβαση C3).'],
    validFrom: '2022-01-01', validTo: null,
  }),

  // ── Αναστολή πλειστηριασμού ─────────────────────────────────────────────
  verified({
    id: 'as-938-4-new', version: 1,
    label: 'Αίτηση αναστολής πλειστηριασμού',
    provision: 'ΚΠολΔ 938 §4', amendedBy: `${KPOLD_5221}, άρθρο 107`,
    regime: 'new', params: { count: 15, unit: 'working' },
    ambiguities: ['Μέτρηση «το αργότερο Ν εργάσιμες πριν» (σύμβαση C5).', 'Εργάσιμες του Αυγούστου (σύμβαση C6).', 'Τοπικές αργίες (σύμβαση C3).'],
    validFrom: '2026-01-01', validTo: null,
  }),
  verified({
    id: 'as-938-4-old', version: 1,
    label: 'Αίτηση αναστολής πλειστηριασμού',
    provision: 'ΚΠολΔ 938 §4', amendedBy: KPOLD_4842,
    regime: 'old', params: { count: 5, unit: 'working' },
    ambiguities: ['Μέτρηση «το αργότερο Ν εργάσιμες πριν» (σύμβαση C5).', 'Εργάσιμες του Αυγούστου (σύμβαση C6).', 'Τοπικές αργίες (σύμβαση C3).'],
    validFrom: '2022-01-01', validTo: null,
  }),

  // ── Ο πλειστηριασμός ────────────────────────────────────────────────────
  verified({
    id: 'ka-998-2', version: 1,
    label: 'Πλειστηριασμός δεν γίνεται τον Αύγουστο',
    provision: 'ΚΠολΔ 998 §2', amendedBy: `${KPOLD_5221}, άρθρο 119`,
    regime: 'new', params: {},
    ambiguities: ['Η ίδια διάταξη εξαιρεί και την εβδομάδα πριν και μετά από εκλογές· η εφαρμογή δεν ξέρει ημερομηνίες εκλογών.'],
    validFrom: '2026-01-01', validTo: null,
  }),
  verified({
    id: 'ka-998-6', version: 1,
    label: 'Ελεύθερη πώληση με άδεια του δικαστηρίου',
    provision: 'ΚΠολΔ 998 §6', amendedBy: `${KPOLD_5221}, άρθρο 119`,
    regime: 'new', params: { percent: 70 },
    ambiguities: [],
    validFrom: '2026-01-01', validTo: null,
  }),
  verified({
    id: 'as-973-window', version: 1,
    label: 'Νέα ημέρα πλειστηριασμού μετά από δήλωση συνέχισης',
    provision: 'ΚΠολΔ 973 §1', amendedBy: `${KPOLD_5221}, άρθρο 115`,
    regime: 'new', params: { count: 2, countTo: 3, unit: 'months' },
    ambiguities: ['Το 973 είναι στη λίστα του 147 §2· δεν είναι σαφές πώς παραλείπεται ο Αύγουστος σε προθεσμία μηνών.'],
    validFrom: '2026-01-01', validTo: null,
  }),

  // ── Εξωδικαστικός ───────────────────────────────────────────────────────
  verified({
    id: 'ex-18-cutoff', version: 1,
    discrepancy: 'Το αρχικό ΦΕΚ γράφει «από την ημερομηνία υποβολής»· η κωδικοποίηση γράφει «οριστικής υποβολής». Την τροποποιητική διάταξη δεν τη βρήκαμε.',
    label: 'Ο εξωδικαστικός δεν αναστέλλει πλειστηριασμό που είναι κοντά',
    provision: 'ν. 4738/2020 άρθρο 18', amendedBy: "ν. 4738/2020 (ΦΕΚ Α' 207/27.10.2020), όπως ισχύει",
    regime: 'any', params: { count: 3, unit: 'months' },
    ambiguities: [
      'Το αρχικό ΦΕΚ γράφει «από την ημερομηνία υποβολής»· η κωδικοποίηση γράφει «οριστικής υποβολής». Η τροποποιητική διάταξη δεν εντοπίστηκε.',
      'Στην οριακή ημέρα το «εντός τριών μηνών» είναι αμφίσημο.',
    ],
    validFrom: '2021-06-01', validTo: null,
  }),
  verified({
    id: 'ex-3pct', version: 1,
    label: 'Σταθερό επιτόκιο στον εξωδικαστικό',
    provision: 'ν. 4738/2020 άρθρο 14 §3Α', amendedBy: `${N5354}, άρθρο 366`,
    regime: 'any', params: { percent: 3, date: '2026-12-01' },
    ambiguities: ['Ισχύει για ευάλωτους ή επιλέξιμους οφειλέτες, κατά τους όρους της διάταξης.'],
    validFrom: SERVICER_RULES_FROM, validTo: null,
  }),

  // ── Servicers ───────────────────────────────────────────────────────────
  verified({
    id: 'sv-37a', version: 1,
    label: 'Ο servicer δίνει έγγραφα και ανάλυση της οφειλής',
    provision: 'ν. 5072/2023 άρθρο 37Α', amendedBy: `${N5354}, άρθρο 13`,
    regime: 'any', params: { count: SERVICER_DOCS_DAYS, unit: 'calendar' },
    ambiguities: ['Έναρξη την επομένη του αιτήματος και λήξη σε μη εργάσιμη (συμβάσεις C1 και C2).'],
    validFrom: SERVICER_RULES_FROM, validTo: null,
  }),
  verified({
    id: 'sv-37g', version: 1,
    label: 'Απαγόρευση ενεργειών είσπραξης κατά συνεπούς οφειλέτη',
    provision: 'ν. 5072/2023 άρθρο 37Γ', amendedBy: `${N5354}, άρθρο 15`,
    regime: 'any', params: {},
    ambiguities: ['Ποιος είναι «συνεπής» οφειλέτης ορίζεται στη διάταξη· η εφαρμογή δεν το κρίνει.'],
    validFrom: SERVICER_RULES_FROM, validTo: null,
  }),
  verified({
    id: 'sv-182', version: 1,
    label: 'Πρόταση ρύθμισης πριν από τον πρώτο πλειστηριασμό',
    provision: 'ν. 5193/2025 άρθρο 182', amendedBy: `${N5354}, άρθρο 17`,
    regime: 'any', params: { count: SERVICER_PROPOSAL_MONTHS, unit: 'months' },
    ambiguities: [
      'Το «μετά από την ισχύ του παρόντος νόμου» μπορεί να σημαίνει τον ν. 5193/2025 ή τον ν. 5354/2026.',
      'Η υποχρέωση δεν υπάρχει αν ο οφειλέτης δεν έχει εγγραφεί στο σύστημα πληροφόρησης του servicer.',
    ],
    validFrom: SERVICER_RULES_FROM, validTo: null,
  }),
  verified({
    id: 'sv-63a', version: 1,
    label: 'Ειδική διμερής διαδικασία ρύθμισης με τον servicer',
    provision: 'ν. 5072/2023 άρθρα 63Α επ.', amendedBy: `${N5354}, άρθρα 19 και 392 §2`,
    regime: 'any', params: { count: 3, unit: 'months', since: SERVICER_RULES_FROM },
    ambiguities: ['Ο νόμος λέει «τρεις μήνες από τη δημοσίευση»· η ημερομηνία 09/02/2027 είναι δικός μας υπολογισμός.'],
    validFrom: '2027-02-09', validTo: null,
  }),

  // ── Οφειλές στο Δημόσιο: μόνο ρυθμίσεις, κανένας υπολογισμός προθεσμίας ──
  verified({
    id: 'ds-120-aade', version: 1,
    label: 'Ρύθμιση οφειλών στην ΑΑΔΕ σε δόσεις',
    provision: 'ν. 5313/2026 άρθρο 19', amendedBy: `${N5354}, άρθρο 35`,
    regime: 'any', params: { count: DEBT_INSTALMENTS.count, was: DEBT_INSTALMENTS.was, date: DEBT_INSTALMENTS.applyBy },
    ambiguities: ['Προϋποθέσεις υπαγωγής (π.χ. οφειλές ληξιπρόθεσμες έως 31/12/2024 που δεν είναι σε ρύθμιση) ορίζονται στη διάταξη.'],
    validFrom: SERVICER_RULES_FROM, validTo: DEBT_INSTALMENTS.applyBy,
  }),
  verified({
    id: 'ds-120-efka', version: 1,
    label: 'Ρύθμιση οφειλών στον e-ΕΦΚΑ σε δόσεις',
    provision: 'ν. 5313/2026 άρθρο 22', amendedBy: `${N5354}, άρθρο 36`,
    regime: 'any', params: { count: DEBT_INSTALMENTS.count, was: DEBT_INSTALMENTS.was, date: DEBT_INSTALMENTS.applyBy },
    ambiguities: ['Προϋποθέσεις υπαγωγής ορίζονται στη διάταξη.'],
    validFrom: SERVICER_RULES_FROM, validTo: DEBT_INSTALMENTS.applyBy,
  }),

  // ── ΔΕΝ ΕΠΑΛΗΘΕΥΤΗΚΑΝ: καμία ημερομηνία, μόνο «Επιβεβαίωσε με δικηγόρο» ──
  withheld({
    id: 'dp-632', version: 1,
    label: 'Ανακοπή κατά διαταγής πληρωμής',
    provision: 'ΚΠολΔ 632 §2', amendedBy: '',
    withheldReason: 'Το ισχύον κείμενο του 632 §2 δεν επιβεβαιώθηκε σε δύο πηγές: διαβάστηκε μόνο στη διατύπωση του ν. 4335/2015 και μεταγενέστερη τροποποίηση δεν αποκλείεται.',
    validFrom: '2026-01-01', validTo: null,
  }),
  withheld({
    id: 'as-1000', version: 1,
    label: 'Αναστολή πλειστηριασμού με καταβολή μέρους του κεφαλαίου',
    provision: 'ΚΠολΔ 1000', amendedBy: '',
    withheldReason: 'Το ισχύον κείμενο του 1000 δεν επιβεβαιώθηκε σε δύο πηγές: διαβάστηκε μόνο στη διατύπωση του ν. 4335/2015.',
    validFrom: '2026-01-01', validTo: null,
  }),
  withheld({
    id: 'ep-926', version: 1,
    label: 'Χρόνος από την επιταγή έως την κατάσχεση',
    provision: 'ΚΠολΔ 926', amendedBy: '',
    withheldReason: 'Το κείμενο του 926 δεν βρέθηκε σε καμία πηγή.',
    validFrom: '2026-01-01', validTo: null,
  }),
  withheld({
    id: 'an-934a-old', version: 1,
    label: 'Ανακοπή κατά της εκτέλεσης μετά την κατάσχεση (επιταγή πριν από 01/01/2026)',
    provision: "ΚΠολΔ 934 §1 στοιχ. α'", amendedBy: '',
    withheldReason: 'Για το παλιό καθεστώς το κείμενο διαβάστηκε μόνο σε μία πηγή· το ΦΕΚ του ν. 4335/2015 δεν αποδίδει αναγνώσιμο κείμενο.',
    validFrom: '2026-01-01', validTo: null,
  }),
  withheld({
    id: 'conv-144', version: 1,
    label: 'Πώς μετριέται μια προθεσμία (έναρξη, λήξη, ώρα)',
    provision: 'ΚΠολΔ 144 έως 146', amendedBy: '',
    withheldReason: 'Το κείμενο των 144 έως 146 δεν βρέθηκε. Γι\' αυτό κάθε προθεσμία δίνεται ως εύρος και ποτέ ως μία ημερομηνία.',
    validFrom: '2026-01-01', validTo: null,
  }),
  withheld({
    id: 'conv-workday', version: 1,
    label: 'Τι μετρά ως εργάσιμη ημέρα',
    provision: 'ΚΠολΔ (ορισμός εργάσιμης)', amendedBy: '',
    withheldReason: 'Ο ορισμός της εργάσιμης και οι τοπικές αργίες δεν επαληθεύτηκαν. Η εφαρμογή μετρά Δευτέρα έως Παρασκευή χωρίς τις εθνικές αργίες και δίνει πάντα εύρος.',
    validFrom: '2026-01-01', validTo: null,
  }),
  withheld({
    id: 'an-141', version: 1,
    label: 'Επαναπροσδιορισμός εκκρεμών ανακοπών',
    provision: 'ν. 5221/2025 άρθρα 129 έως 141', amendedBy: '',
    withheldReason: 'Δεν επαληθεύτηκε αν εκδόθηκε η υπουργική απόφαση του άρθρου 141 που κινεί την προθεσμία.',
    validFrom: '2026-01-01', validTo: null,
  }),
  withheld({
    id: 'public-debt-route', version: 1,
    label: 'Ανακοπή για οφειλές στο Δημόσιο',
    provision: 'ΚΕΔΕ και ΚΔΔ 216 επ.', amendedBy: '',
    withheldReason: 'Για οφειλές στο Δημόσιο οι οδοί είναι δύο (διοικητικά ή πολιτικά δικαστήρια) και οι προθεσμίες τους δεν επαληθεύτηκαν. Η εφαρμογή δεν υπολογίζει.',
    validFrom: '2026-01-01', validTo: null,
  }),
  withheld({
    id: 'faep-219', version: 1,
    label: 'Φορέας Απόκτησης και Επαναμίσθωσης',
    provision: 'ν. 4738/2020 άρθρο 219', amendedBy: '',
    withheldReason: 'Ο Φορέας δεν λειτουργεί ακόμη. Καμία προθεσμία δεν υπολογίζεται μέχρι να λειτουργήσει.',
    validFrom: '2026-01-01', validTo: null,
  }),
];

/** Ο κανόνας με αυτό το αναγνωριστικό· πετά αν δεν υπάρχει (ποτέ `undefined`). */
export function rule(id: string): LegalRule {
  const r = RULES.find(x => x.id === id);
  if (!r) throw new Error(`enforcement/rules: άγνωστος κανόνας «${id}»`);
  return r;
}

/**
 * «ΦΕΚ 09/11/2026»: η δημοσίευση από την οποία μετρά κανόνας με `since`. Ζει
 * εδώ, στο αρχείο που φυλάει το μητρώο ισχύος, ώστε τα κείμενα (copy.ts) να μη
 * γράφουν παραπομπή σε ΦΕΚ με το χέρι.
 */
export function publishedLabel(id: string): string {
  const since = rule(id).params.since;
  if (!since) throw new Error(`enforcement/rules: ο κανόνας «${id}» δεν έχει since`);
  return `ΦΕΚ ${grDate(since)}`;
}

/** Η πιο πρόσφατη ημερομηνία αντιπαραβολής, για το υποσέλιδο της οθόνης. */
export const RULES_CHECKED_AT: string = RULES
  .flatMap(r => r.sources.map(s => s.checkedAt))
  .reduce((a, b) => (b > a ? b : a), '');
