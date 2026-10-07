// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΜΟΝΤΕΛΟ ΤΗΣ ΑΠΟΔΟΣΗΣ: ΚΑΘΑΡΕΣ ΣΥΝΑΡΤΗΣΕΙΣ, ΧΩΡΙΣ REACT
// ─────────────────────────────────────────────────────────────────────────
// Ζούσαν μέσα στο TabRentROI.tsx, ανάμεσα σε κατάσταση, γραφήματα και
// αναφορές. Εδώ δεν ξέρουν τίποτα από οθόνη: παίρνουν αριθμούς και δίνουν
// αριθμούς ή κείμενο. Το roi/model.test.ts τα ελέγχει χωρίς περιηγητή.
// ═══════════════════════════════════════════════════════════════════════════
import { SHORT_TERM, HISTORY_INDEX, type ShortTermStat } from '@/lib/market/greekMarket';
import { leverage, propertyTotalReturn } from '@/lib/market/returns';

// Αντιστοίχιση περιοχής → πλησιέστερη αναφορά βραχυχρόνιας (τα δεδομένα ST είναι ανά
// ευρύτερη ζώνη, όχι ανά προάστιο). Δίνει ρεαλιστικά defaults (πληρότητα/τιμή) ανά περιοχή.
const ST_ALIAS: Record<string, string> = {
  ath_center: 'ath_center', ath_kolonaki: 'ath_center', ath_north: 'ath_center', ath_west: 'ath_center',
  ath_south: 'ath_riviera', east_attica: 'ath_riviera', piraeus: 'ath_center',
  thess_center: 'thess', thess_kalamaria: 'thess',
  heraklion: 'crete', chania: 'crete',
  mykonos: 'mykonos_santorini', santorini: 'mykonos_santorini', paros_naxos: 'paros_naxos', rhodes: 'rhodes', corfu: 'rhodes',
  patras: 'thess', larissa: 'thess', volos: 'thess', ioannina: 'thess',
  // Ηπειρωτικές πόλεις → προφίλ πόλης (Θεσσαλονίκη)
  tripoli: 'thess', corinth: 'thess', pyrgos: 'thess', lamia: 'thess', chalkida: 'thess',
  trikala: 'thess', karditsa: 'thess', katerini: 'thess', veroia: 'thess', kozani: 'thess',
  kastoria: 'thess', kavala: 'thess', serres: 'thess', drama: 'thess', xanthi: 'thess',
  komotini: 'thess', alexandroupoli: 'thess', agrinio: 'thess',
  sparti: 'thess', livadeia: 'thess', edessa: 'thess', florina: 'thess', grevena: 'thess',
  karpenisi: 'crete', igoumenitsa: 'thess',
  // Τουριστικοί προορισμοί → κοντινότερο νησιωτικό/παραθαλάσσιο προφίλ
  kalamata: 'crete', nafplio: 'crete', preveza: 'crete', halkidiki: 'crete',
  zakynthos: 'rhodes', kefalonia: 'rhodes', lesvos: 'crete', chios: 'crete', samos: 'crete',
  kos: 'rhodes', syros: 'paros_naxos', rethymno: 'crete', agios_nikolaos: 'crete',
  sporades: 'rhodes', limnos: 'crete', milos_ios: 'paros_naxos', andros: 'paros_naxos', karpathos: 'rhodes',
};
export const stRefFor = (regionKey: string): ShortTermStat =>
  SHORT_TERM.find(s => s.key === (ST_ALIAS[regionKey] || regionKey)) || SHORT_TERM[0];

// Ρεαλιστικό εύρος συνολικής ετήσιας απόδοσης για πολυετείς προβολές/σύγκριση: προστατεύει
// από ακραίες τιμές λόγω μη ρεαλιστικών εισόδων (π.χ. πολύ μικρή αξία με έσοδα βραχυχρόνιας).
// Δεν επηρεάζει τους δείκτες KPI — μόνο τον ανατοκισμό στα γραφήματα/μπάρες.
export const clampReturn = (r: number) => Math.max(-30, Math.min(35, isFinite(r) ? r : 0));
// Σύντομες, ολοκληρωμένες (χωρίς συντομογραφίες) ονομασίες εναλλακτικών για τα γραφήματα.
const BENCH_SHORT: Record<string, string> = {
  deposit: 'Κατάθεση', bond: 'Ομόλογο', gold: 'Χρυσός', athex: 'Χρηματιστήριο', sp500: 'S&P 500', inflation: 'Πληθωρισμός',
};
export const benchShort = (key: string, fallback: string) => BENCH_SHORT[key] || fallback;

// ── ΠΑΡΑΔΟΧΕΣ ΠΟΥ ΔΕΝ ΦΑΙΝΟΝΤΑΝ ΠΟΥΘΕΝΑ ─────────────────────────────────────
// Οι τιμές αυτές έμπαιναν σιωπηλά στη μηχανή (leverage/dealAnalysis) και έβγαζαν
// IRR, NPV και DSCR που ο χρήστης διάβαζε ως γεγονός. Τώρα είναι πεδία που
// φαίνονται και αλλάζουν, με προεπιλογές που λέγονται ρητά:
//   • Διάρκεια δανείου 25 έτη — η συνηθέστερη ελληνική στεγαστική διάρκεια.
//   • Κόστη πώλησης 3% — πλευρά ΠΩΛΗΤΗ (μεσιτική αμοιβή ~2% + ΦΠΑ, νομικός/
//     συμβολαιογραφικός έλεγχος). Ο φόρος μεταβίβασης 3% βαρύνει τον ΑΓΟΡΑΣΤΗ,
//     γι’ αυτό το συνολικό κόστος μιας πλήρους συναλλαγής (αγορά + πώληση) που
//     αναφέρεται παρακάτω είναι μεγαλύτερο. Δύο διαφορετικά πράγματα, δύο νούμερα.
export const DEFAULT_LOAN_YEARS = '25';
export const DEFAULT_SELL_COSTS_PCT = '3';

// Πόσες νύχτες στους τελευταίους δώδεκα μήνες αρκούν για να μιλούν οι
// κρατήσεις αντί για τον μέσο όρο της περιοχής: ένας μήνας γεμάτος.
export const MIN_BOOKED_NIGHTS = 30;
// «Κοντά» στην τυπική απόδοση της περιοχής σημαίνει ως 10% κάτω από αυτήν.
export const NEAR_REFERENCE = 0.9;

// Ιστορική διαδρομή: πώς θα κινούνταν η αξία σου τα τελευταία 10/20 έτη.
export const historyPath = (nVal: number, histYears: '10' | '20'): { year: number; value: number }[] => {
  const base = HISTORY_INDEX.filter(p => p.year >= (histYears === '20' ? 2007 : 2016));
  const latest = HISTORY_INDEX[HISTORY_INDEX.length - 1].price;
  return base.map(p => ({ year: p.year, value: nVal > 0 ? Math.round(nVal * p.price / latest) : Math.round(p.price) }));
};

// Ανάλυση ευαισθησίας (pro): απόδοση ιδίων & συνολική απόδοση σε δυσμενές/βασικό/ευνοϊκό
// σενάριο (μεταβολή επιτοκίου & ετήσιας ανατίμησης). Δείχνει την αντοχή της επένδυσης.
export type SensitivityRow = { key: string; label: string; note: string; totalReturn: number; roe: number; cashFlow: number };
export function sensitivityScenarios({ nVal, ltv, loanRate, nLoanYears, grossYieldExact, opexPctOfRent, ifree, netYield, nAppr }: {
  nVal: number; ltv: string; loanRate: string; nLoanYears: number; grossYieldExact: number;
  opexPctOfRent: number; ifree: string; netYield: number; nAppr: number;
}): SensitivityRow[] {
  const rows: SensitivityRow[] = [];
  const defs = [
    { key: 'bad', label: 'Δυσμενές', note: 'επιτόκιο +1,50% · ανατίμηση −2,00%', appr: -2, rate: +1.5 },
    { key: 'base', label: 'Βασικό', note: 'τρέχουσες παραδοχές', appr: 0, rate: 0 },
    { key: 'good', label: 'Ευνοϊκό', note: 'επιτόκιο −1,00% · ανατίμηση +2,00%', appr: +2, rate: -1 },
  ];
  for (const d of defs) {
    const l = leverage({ price: nVal, ltvPct: parseFloat(ltv) || 0, loanRatePct: Math.max(0, (parseFloat(loanRate) || 0) + d.rate), loanYears: nLoanYears, grossYieldPct: grossYieldExact, opexPctOfRent, interestFreePct: parseFloat(ifree) || 0 });
    rows.push({ key: d.key, label: d.label, note: d.note, totalReturn: clampReturn(propertyTotalReturn(netYield, nAppr + d.appr)), roe: l.cashOnCash, cashFlow: l.cashFlow });
  }
  return rows;
}

// ΤΟ ΑΝΕΦΙΚΤΟ ΔΕΝ ΓΡΑΦΕΤΑΙ «100%».
// Εδώ γραφόταν `Math.min(100, breakEvenOcc)`. Ένα ακίνητο με χαμηλή τιμή ανά
// νύχτα και υψηλό μακροχρόνιο ενοίκιο χρειάζεται π.χ. 334% πληρότητα για να
// ισοφαρίσει — δηλαδή ΔΕΝ ισοφαρίζει ποτέ. Η αναφορά όμως τύπωνε «100%», που
// διαβάζεται ως «βγαίνει, αν το γεμίζεις κάθε βράδυ». Ο ιδιοκτήτης έβγαζε τον
// ενοικιαστή του με βάση αυτόν τον αριθμό.
//
// Η στρογγυλοποίηση δεν είναι ίδια με το ψέμα: κάτω από 100 δείχνουμε το
// ποσοστό, πάνω από 100 λέμε ΓΙΑΤΙ δεν φτάνει.
export const breakEvenText = (breakEvenOcc: number | null, pct: (n: number) => string): string =>
  breakEvenOcc === null ? ''
    : !isFinite(breakEvenOcc) ? 'μη εφικτή με αυτά τα στοιχεία'
    : breakEvenOcc > 100 ? `δεν επιτυγχάνεται ούτε με πλήρη πληρότητα (θα χρειαζόταν ${pct(breakEvenOcc)})`
    : pct(breakEvenOcc);
