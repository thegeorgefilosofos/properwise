// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΔΥΟ ΑΝΑΦΟΡΕΣ ΤΗΣ ΑΠΟΔΟΣΗΣ: «PDF ΓΙΑ ΜΕΝΑ» ΚΑΙ «PDF ΜΕ QR»
// ─────────────────────────────────────────────────────────────────────────
// Ζούσαν μέσα στο TabRentROI.tsx ως δύο κλεισίματα πάνω σε σαράντα μεταβλητές
// της καρτέλας. Τώρα τις παίρνουν ρητά, ως ένα αντικείμενο `RoiReport`· το
// σώμα τους είναι το ίδιο γράμμα προς γράμμα: ίδιες γραμμές, ίδια σειρά,
// ίδιο HTML. Η καρτέλα κρατά μόνο το κουμπί και την κατάσταση «Δημιουργία…».
// ═══════════════════════════════════════════════════════════════════════════
import { fn, ABSENT } from '@/components/tokens';
import { YIELD_LABELS } from '@/lib/facts';
import type { ReportBranding } from '@/lib/reportBranding';
import type { YieldBreakdown, YieldGrade, DealResult, LeverageResult, ComparisonRow } from '@/lib/market/returns';
import { GREECE_AVG_GROSS_YIELD, ATHENS_AVG_GROSS_YIELD, MARKET_DATA_ASOF, MARKET_SOURCES, type RegionYield, type ShortTermStat } from '@/lib/market/greekMarket';
import { PRESUMPTIVE_DEDUCTION_RATE } from '@/lib/accounting/statement';
import type { ConsolidatedRentTax } from '@/lib/billing/consolidate';
import { reportHead, reportHeader, reportSection, reportRow, reportKpi, reportDisclaimer, openReport, rEur, rSigned, rPct, rEsc } from '../reportPdf';
import { generateReportPdf, pEur, pSigned, pPct, type PdfReportModel, type PdfSection, type PdfRow } from '@/lib/pdf/pdfReport';
import { issueDocument } from '@/lib/documents/issue';
import { INK_FAINT, INK_MUTED } from '@/lib/print/ink';
import { fpRate, grDateOf } from '@/lib/core/format';
import { FIRST_MONTH_BANK_RECEIPT, FIRST_YEAR_BANK_RECEIPT } from '@/lib/billing/greekTax';
import { breakEvenText, type SensitivityRow } from './model';

/** Ό,τι διαβάζουν οι δύο αναφορές από την καρτέλα, με τα ονόματα της καρτέλας. */
export interface RoiReport {
  branding: ReportBranding | null;
  pName: string; regimeLabel: string; term: 'long' | 'short';
  reg: RegionYield | undefined; pSqm: number | null; stRef: ShortTermStat;
  grossAnnual: number; effOpex: number; annualTax: number; nOpex: number;
  stCosts: number; stCostsLabel: string; netLabel: string; consolidated: boolean;
  y: YieldBreakdown; grade: YieldGrade; nAppr: number;
  canInvest: boolean; deal: DealResult; lev: LeverageResult; holdYears: string; scenarios: SensitivityRow[];
  breakEvenOcc: number | null; occEff: number; adrEff: number; nVal: number; nRent: number;
  apprTouched: boolean; apprRef: { pct: number; fromYear: number; toYear: number; years: number };
  rentsBank: boolean; levyToGuest: boolean; portfolioTax: ConsolidatedRentTax; opexPctOfRent: number;
  ltv: string; loanRate: string; nLoanYears: number; nSellCosts: number;
  cmpYears: string; compare: ComparisonRow[];
}

// Εξαγωγή επαγγελματικής αναφοράς PDF (μέσω παραθύρου εκτύπωσης· escape όλων των τιμών).
export function printRoiReport(r: RoiReport): void {
  const { branding, pName, regimeLabel, term, reg, pSqm, grossAnnual, effOpex, annualTax, y, nAppr, nOpex, stCosts, stCostsLabel, consolidated, netLabel, grade, stRef, canInvest, deal, lev, holdYears, scenarios, breakEvenOcc, occEff, adrEff, nVal, nRent, apprTouched, apprRef, rentsBank, levyToGuest, portfolioTax, opexPctOfRent, ltv, loanRate, nLoanYears, nSellCosts, cmpYears, compare } = r;
  const name = pName.trim() || 'Ακίνητο';
  const num2 = (n: number) => fn(n, 2);
  // Παράγωγα μεγέθη κατάστασης αποτελεσμάτων.
  const noi = grossAnnual - effOpex;            // καθαρά λειτουργικά έσοδα
  const afterTax = noi - annualTax;             // καθαρό αποτέλεσμα μετά τον φόρο
  const totalReturn = y.netYield + nAppr;       // ενδεικτική συνολική απόδοση

  const R = reportRow;

  const identity = [name, regimeLabel, term === 'short' ? 'Βραχυχρόνια μίσθωση' : 'Μακροχρόνια μίσθωση', reg?.label || '', pSqm ? `${pSqm} τ.μ.` : '']
    .filter(Boolean).map(x => rEsc(String(x))).join(' · ');

  // Ανάλυση εσόδων–εξόδων (ετήσια).
  const incRows = [
    R('Ακαθάριστα έσοδα (ετήσια)', rEur(grossAnnual)),
    R('Λειτουργικά έξοδα ακινήτου', rSigned(-nOpex)),
    ...(term === 'short' && stCosts > 0 ? [R(stCostsLabel, rSigned(-stCosts))] : []),
    R('Καθαρά λειτουργικά έσοδα (NOI)', rEur(noi), 'sub'),
    R(consolidated ? 'Μερίδιο φόρου εισοδήματος (προοδευτικός στο σύνολο των ακινήτων)' : 'Φόρος εισοδήματος', rSigned(-annualTax)),
    R('Καθαρό αποτέλεσμα μετά τον φόρο', rEur(afterTax), 'result'),
  ].join('');

  // Δείκτες απόδοσης.
  const yieldRows = [
    R('Μεικτή απόδοση', rPct(y.grossYield)),
    R(netLabel, rPct(y.netYield)),
    R(YIELD_LABELS.net_after_tax, rPct(y.netYieldAfterTax)),
    R('Εκτιμώμενη ετήσια ανατίμηση', rPct(nAppr)),
    R('Ενδεικτική συνολική απόδοση (καθαρή + ανατίμηση)', rPct(totalReturn), 'sub'),
    R('Βαθμός απόδοσης', `${grade.grade} · ${grade.score}/100`, 'sub'),
  ].join('');

  const regionRows = term === 'short'
    ? [['Το ακίνητό σου', rPct(y.grossYield)], ['Τυπική βραχυχρόνια περιοχής', rPct(stRef.grossYield)], ['Μακροχρόνια στην ίδια περιοχή', rPct(reg?.grossYield || 0)]]
    : [['Το ακίνητό σου', rPct(y.grossYield)], [reg?.label || 'Περιοχή', rPct(reg?.grossYield || 0)], ['Μέσος όρος Αθήνας', rPct(ATHENS_AVG_GROSS_YIELD)], ['Εθνικός μέσος όρος', rPct(GREECE_AVG_GROSS_YIELD)]];

  // Χρηματοδότηση & μόχλευση (μόνο επαγγελματικό προφίλ).
  const finBlock = canInvest ? reportSection('Χρηματοδότηση και μόχλευση') + `<table><tbody>
        ${R('Ίδια κεφάλαια', rEur(deal.equity))}
        ${R('Δάνειο', rEur(deal.loan))}
        ${R('Ετήσια δόση δανείου', rEur(deal.annualDebtService))}
        ${R('Δείκτης κάλυψης χρέους (DSCR)', Number.isFinite(deal.dscr) ? num2(deal.dscr) : '∞')}
        ${R('Απόδοση ιδίων κεφαλαίων (cash-on-cash)', rPct(lev.cashOnCash))}
        ${R('Ετήσια ταμειακή ροή', rEur(lev.cashFlow))}
        ${R('Εσωτερικός βαθμός απόδοσης (IRR)', Number.isFinite(deal.irrPct) ? rPct(deal.irrPct) : ABSENT)}
        ${R('Καθαρή παρούσα αξία (NPV)', rEur(deal.npv))}
        ${R('Πολλαπλασιαστής ιδίων κεφαλαίων', `${num2(deal.equityMultiple)}×`)}
        ${R('Ορίζοντας κατοχής', `${parseInt(holdYears)} έτη`, 'sub')}
      </tbody></table>` : '';

  // Ανάλυση ευαισθησίας (επαγγελματικό προφίλ).
  const sensBlock = canInvest ? reportSection('Ανάλυση ευαισθησίας') + `<table>
        <thead><tr><th>Σενάριο</th><th class="n">Συνολική απόδοση</th><th class="n">Απόδοση ιδίων</th><th class="n">Ταμειακή ροή</th></tr></thead>
        <tbody>${scenarios.map(sc => `<tr><td>${rEsc(sc.label)} <span class="muted" style="font-size: 11px">${rEsc(sc.note)}</span></td><td class="n">${rEsc(rPct(sc.totalReturn))}</td><td class="n">${rEsc(rPct(sc.roe))}</td><td class="n">${rEsc(rEur(sc.cashFlow))}</td></tr>`).join('')}</tbody>
      </table>` : '';

  // Νεκρό σημείο πληρότητας (βραχυχρόνια).
  const beBlock = (term === 'short' && breakEvenOcc !== null) ? reportSection('Νεκρό σημείο πληρότητας')
      + `<div class="note">Ελάχιστη πληρότητα ώστε η βραχυχρόνια να αποδώσει όσο η μακροχρόνια στην ίδια περιοχή: <strong>${rEsc(breakEvenText(breakEvenOcc, rPct))}</strong>. Εκτιμώμενη πληρότητα εργαλείου: ${rPct(occEff)} · τιμή/νύχτα ${rEsc(rEur(adrEff))}.</div>` : '';

  // Παραδοχές & μεθοδολογία.
  const asmpItems = [
    `Αξία ακινήτου: ${rEur(nVal)} (καταχώρηση ή εκτίμηση χρήστη)`,
    term === 'short' ? `Έσοδα: εκτιμώμενη πληρότητα ${rPct(occEff)} × τιμή/νύχτα ${rEur(adrEff)}` : `Έσοδα: μηνιαίο ενοίκιο ${rEur(nRent)}`,
    apprTouched
      ? `Ετήσια ανατίμηση: ${rPct(nAppr)}· υπόθεση του χρήστη (η τεκμηριωμένη τιμή είναι ${rPct(apprRef.pct)})`
      : `Ετήσια ανατίμηση: ${rPct(nAppr)}· δείκτης τιμών κατοικιών Τράπεζας της Ελλάδος, ${apprRef.fromYear} ως ${apprRef.toYear}`,
    `Φορολογικό καθεστώς: ${regimeLabel}`,
    `Είσπραξη ενοικίων μέσω τράπεζας: ${rentsBank ? 'ναι' : `όχι (η τεκμαρτή έκπτωση ${fpRate(PRESUMPTIVE_DEDUCTION_RATE * 100)} ισχύει· η προϋπόθεση τραπεζικής είσπραξης αρχίζει ${grDateOf(FIRST_YEAR_BANK_RECEIPT, FIRST_MONTH_BANK_RECEIPT)}, ν.5222/2025)`}`,
    // Η ΔΕΥΤΕΡΗ ΠΑΡΑΔΟΧΗ ΤΑΞΙΔΕΥΕΙ ΚΙ ΑΥΤΗ. Οποιος διαβάσει την αναφορά χωρίς
    // να έχει την οθόνη μπροστά του πρέπει να ξέρει ποιο σενάριο διαβάζει.
    ...(term === 'short'
      ? [`Τέλος ανθεκτικότητας: ${levyToGuest ? 'χρεώνεται στον επισκέπτη, δεν βαραίνει τα καθαρά' : 'δεν χρεώνεται στον επισκέπτη, βγαίνει από την τσέπη του ιδιοκτήτη'}`]
      : []),
    ...(consolidated ? [`Φόρος: μερίδιο από τον προοδευτικό φόρο ${portfolioTax.count} ακινήτων (σύνολο ενοικίων ${rEur(portfolioTax.totalAnnualRent)}, συνολικός φόρος ${rEur(portfolioTax.totalTax)})`] : []),
    `Λειτουργικά έξοδα: ${rPct(opexPctOfRent)} των εσόδων (${rEur(effOpex)})`,
    ...(canInvest ? [`Χρηματοδότηση: δάνειο ${rPct(parseFloat(ltv) || 0)} της αξίας, επιτόκιο ${rPct(parseFloat(loanRate) || 0)}, διάρκεια ${nLoanYears} έτη, ορίζοντας κατοχής ${parseInt(holdYears)} έτη, κόστη πώλησης ${rPct(nSellCosts)} (πλευρά πωλητή)`] : []),
    `Δεδομένα αναφοράς αγοράς: ${MARKET_DATA_ASOF}`,
  ].map(t => `<li>${rEsc(t)}</li>`).join('');

  const disclaimer = `Η παρούσα αναφορά αποτελεί ενημερωτικό εργαλείο εκτίμησης. Οι υπολογισμοί βασίζονται στα στοιχεία που καταχώρησες και σε ενδεικτικά δημόσια δεδομένα αγοράς και δεν συνιστούν επενδυτική, φορολογική ή νομική συμβουλή. Τα πραγματικά μεγέθη διαφέρουν ανά ακίνητο, όροφο, κατάσταση, θέση και συνθήκες αγοράς. Οι αποδόσεις των εναλλακτικών επενδύσεων είναι ιστορικές και δεν εγγυώνται μελλοντικά αποτελέσματα. Πριν από κάθε απόφαση, επιβεβαίωσε τα στοιχεία και συμβουλέψου εξειδικευμένο λογιστή ή σύμβουλο ακινήτων. Δεδομένα αγοράς: ${MARKET_DATA_ASOF}.`;

  const html = reportHead(`Αναφορά απόδοσης · ${name}`)
    + `<body><div class="page">`
    + reportHeader(branding, 'Αναφορά απόδοσης')
    + `<h1>Αναφορά απόδοσης ακινήτου</h1><div class="sub">${identity}</div>`
    + reportSection('Σύνοψη')
    + `<div class="kpis">`
      + reportKpi('Αξία ακινήτου', rEur(nVal))
      + reportKpi(term === 'short' ? 'Ετήσια έσοδα' : 'Μηνιαίο ενοίκιο', rEur(term === 'short' ? grossAnnual : nRent))
      + reportKpi(netLabel, rPct(y.netYield))
      + reportKpi('Βαθμός απόδοσης', `${grade.grade} · ${grade.score}/100`)
    + `</div>`
    + reportSection('Ανάλυση εσόδων και εξόδων (ετήσια)') + `<table><tbody>${incRows}</tbody></table>`
    + reportSection('Δείκτες απόδοσης') + `<table><tbody>${yieldRows}</tbody></table>`
    + reportSection('Σύγκριση με την αγορά') + `<table><tbody>${regionRows.map(r => R(r[0], r[1])).join('')}</tbody></table>`
    + finBlock
    + sensBlock
    + beBlock
    + reportSection(`Σύγκριση με εναλλακτικές επενδύσεις (${cmpYears} έτη, ονομαστικές αποδόσεις)`)
      + `<table><tbody>${compare.map(c => R(c.label, `${rEur(c.futureValue)} · ${rPct(c.annualReturnPct)} ετησίως`)).join('')}</tbody></table>`
    + reportSection('Παραδοχές και μεθοδολογία')
      + `<ul style="margin:4px 0 0;padding-left:18px;font-size:12px;color:${INK_MUTED};line-height:1.7">${asmpItems}</ul>`
      + `<div class="note" style="font-size: 11px;color:${INK_FAINT};margin-top:10px">Πηγές: ${MARKET_SOURCES.map(s => rEsc(s.label)).join(' · ')}</div>`
    + reportDisclaimer(disclaimer, branding)
    + `</div></body></html>`;
  openReport(html);
}

// Επίσημο, τραπεζικού επιπέδου true-PDF (pdfmake): αριθμός εγγράφου, QR επαλήθευσης,
// per-page footer· καταχωρείται στο μητρώο εγγράφων ώστε να επαληθεύεται στο /verify/<id>.
// Καθρεφτίζει το περιεχόμενο της printReport σε PdfSection[].
// Το `genOfficial` και το μήνυμα αποτυχίας μένουν στην καρτέλα: εδώ μια
// αποτυχία πετά προς τα έξω, όπως πετούσε μέσα στο `try` της.
export async function officialRoiReport(supabase: Parameters<typeof issueDocument>[0], r: RoiReport): Promise<void> {
  const { branding, pName, regimeLabel, term, reg, pSqm, grossAnnual, effOpex, annualTax, y, nAppr, nOpex, stCosts, stCostsLabel, consolidated, netLabel, grade, stRef, canInvest, deal, lev, holdYears, scenarios, breakEvenOcc, occEff, adrEff, nVal, nRent, apprTouched, apprRef, rentsBank, levyToGuest, portfolioTax, opexPctOfRent, ltv, loanRate, nLoanYears, nSellCosts, cmpYears, compare } = r;
  const name = pName.trim() || 'Ακίνητο';
  const num2 = (n: number) => fn(n, 2);
  const noi = grossAnnual - effOpex;            // καθαρά λειτουργικά έσοδα
  const afterTax = noi - annualTax;             // καθαρό αποτέλεσμα μετά τον φόρο
  const totalReturn = y.netYield + nAppr;       // ενδεικτική συνολική απόδοση

  const identity = [name, regimeLabel, term === 'short' ? 'Βραχυχρόνια μίσθωση' : 'Μακροχρόνια μίσθωση', reg?.label || '', pSqm ? `${pSqm} τ.μ.` : '']
    .filter(Boolean).join(' · ');

  // Σύγκριση με την αγορά (ίδιες γραμμές με την printReport).
  const regionRows: PdfRow[] = term === 'short'
    ? [
        { label: 'Το ακίνητό σου', value: pPct(y.grossYield) },
        { label: 'Τυπική βραχυχρόνια περιοχής', value: pPct(stRef.grossYield) },
        { label: 'Μακροχρόνια στην ίδια περιοχή', value: pPct(reg?.grossYield || 0) },
      ]
    : [
        { label: 'Το ακίνητό σου', value: pPct(y.grossYield) },
        { label: reg?.label || 'Περιοχή', value: pPct(reg?.grossYield || 0) },
        { label: 'Μέσος όρος Αθήνας', value: pPct(ATHENS_AVG_GROSS_YIELD) },
        { label: 'Εθνικός μέσος όρος', value: pPct(GREECE_AVG_GROSS_YIELD) },
      ];

  // Παραδοχές & μεθοδολογία.
  const asmpItems = [
    `Αξία ακινήτου: ${pEur(nVal)} (καταχώρηση ή εκτίμηση χρήστη)`,
    term === 'short' ? `Έσοδα: εκτιμώμενη πληρότητα ${pPct(occEff)} × τιμή/νύχτα ${pEur(adrEff)}` : `Έσοδα: μηνιαίο ενοίκιο ${pEur(nRent)}`,
    apprTouched
      ? `Ετήσια ανατίμηση: ${pPct(nAppr)}· υπόθεση του χρήστη (η τεκμηριωμένη τιμή είναι ${pPct(apprRef.pct)})`
      : `Ετήσια ανατίμηση: ${pPct(nAppr)}· δείκτης τιμών κατοικιών Τράπεζας της Ελλάδος, ${apprRef.fromYear} ως ${apprRef.toYear}`,
    `Φορολογικό καθεστώς: ${regimeLabel}`,
    `Είσπραξη ενοικίων μέσω τράπεζας: ${rentsBank ? 'ναι' : `όχι (η τεκμαρτή έκπτωση ${fpRate(PRESUMPTIVE_DEDUCTION_RATE * 100)} ισχύει· η προϋπόθεση τραπεζικής είσπραξης αρχίζει ${grDateOf(FIRST_YEAR_BANK_RECEIPT, FIRST_MONTH_BANK_RECEIPT)}, ν.5222/2025)`}`,
  // Η ΔΕΥΤΕΡΗ ΠΑΡΑΔΟΧΗ ΤΑΞΙΔΕΥΕΙ ΚΙ ΑΥΤΗ. Οποιος διαβάσει την αναφορά χωρίς
  // να έχει την οθόνη μπροστά του πρέπει να ξέρει ποιο σενάριο διαβάζει.
  ...(term === 'short'
    ? [`Τέλος ανθεκτικότητας: ${levyToGuest ? 'χρεώνεται στον επισκέπτη, δεν βαραίνει τα καθαρά' : 'δεν χρεώνεται στον επισκέπτη, βγαίνει από την τσέπη του ιδιοκτήτη'}`]
    : []),
    ...(consolidated ? [`Φόρος: μερίδιο από τον προοδευτικό φόρο ${portfolioTax.count} ακινήτων (σύνολο ενοικίων ${pEur(portfolioTax.totalAnnualRent)}, συνολικός φόρος ${pEur(portfolioTax.totalTax)})`] : []),
    `Λειτουργικά έξοδα: ${pPct(opexPctOfRent)} των εσόδων (${pEur(effOpex)})`,
    ...(canInvest ? [`Χρηματοδότηση: δάνειο ${pPct(parseFloat(ltv) || 0)} της αξίας, επιτόκιο ${pPct(parseFloat(loanRate) || 0)}, διάρκεια ${nLoanYears} έτη, ορίζοντας κατοχής ${parseInt(holdYears)} έτη, κόστη πώλησης ${pPct(nSellCosts)} (πλευρά πωλητή)`] : []),
    `Δεδομένα αναφοράς αγοράς: ${MARKET_DATA_ASOF}`,
  ];

  const disclaimer = `Η παρούσα αναφορά αποτελεί ενημερωτικό εργαλείο εκτίμησης. Οι υπολογισμοί βασίζονται στα στοιχεία που καταχώρησες και σε ενδεικτικά δημόσια δεδομένα αγοράς και δεν συνιστούν επενδυτική, φορολογική ή νομική συμβουλή. Τα πραγματικά μεγέθη διαφέρουν ανά ακίνητο, όροφο, κατάσταση, θέση και συνθήκες αγοράς. Οι αποδόσεις των εναλλακτικών επενδύσεων είναι ιστορικές και δεν εγγυώνται μελλοντικά αποτελέσματα. Πριν από κάθε απόφαση, επιβεβαίωσε τα στοιχεία και συμβουλέψου εξειδικευμένο λογιστή ή σύμβουλο ακινήτων. Δεδομένα αγοράς: ${MARKET_DATA_ASOF}.`;

  const sections: PdfSection[] = [
    { type: 'kpis', title: 'Σύνοψη', items: [
      { label: 'Αξία ακινήτου', value: pEur(nVal) },
      { label: term === 'short' ? 'Ετήσια έσοδα' : 'Μηνιαίο ενοίκιο', value: pEur(term === 'short' ? grossAnnual : nRent) },
      { label: netLabel, value: pPct(y.netYield) },
      { label: 'Βαθμός απόδοσης', value: `${grade.grade} · ${grade.score}/100` },
    ] },
    { type: 'rows', title: 'Ανάλυση εσόδων και εξόδων (ετήσια)', rows: [
      { label: 'Ακαθάριστα έσοδα (ετήσια)', value: pEur(grossAnnual) },
      { label: 'Λειτουργικά έξοδα ακινήτου', value: pSigned(-nOpex) },
      ...(term === 'short' && stCosts > 0 ? [{ label: stCostsLabel, value: pSigned(-stCosts) }] : []),
      { label: 'Καθαρά λειτουργικά έσοδα (NOI)', value: pEur(noi), kind: 'sub' },
      { label: consolidated ? 'Μερίδιο φόρου εισοδήματος (προοδευτικός στο σύνολο των ακινήτων)' : 'Φόρος εισοδήματος', value: pSigned(-annualTax) },
      { label: 'Καθαρό αποτέλεσμα μετά τον φόρο', value: pEur(afterTax), kind: 'result' },
    ] },
    { type: 'rows', title: 'Δείκτες απόδοσης', rows: [
      { label: 'Μεικτή απόδοση', value: pPct(y.grossYield) },
      { label: netLabel, value: pPct(y.netYield) },
      { label: YIELD_LABELS.net_after_tax, value: pPct(y.netYieldAfterTax) },
      { label: 'Εκτιμώμενη ετήσια ανατίμηση', value: pPct(nAppr) },
      { label: 'Ενδεικτική συνολική απόδοση (καθαρή + ανατίμηση)', value: pPct(totalReturn), kind: 'sub' },
      { label: 'Βαθμός απόδοσης', value: `${grade.grade} · ${grade.score}/100`, kind: 'sub' },
    ] },
    { type: 'rows', title: 'Σύγκριση με την αγορά', rows: regionRows },
  ];

  if (canInvest) {
    sections.push({ type: 'rows', title: 'Χρηματοδότηση και μόχλευση', rows: [
      { label: 'Ίδια κεφάλαια', value: pEur(deal.equity) },
      { label: 'Δάνειο', value: pEur(deal.loan) },
      { label: 'Ετήσια δόση δανείου', value: pEur(deal.annualDebtService) },
      { label: 'Δείκτης κάλυψης χρέους (DSCR)', value: Number.isFinite(deal.dscr) ? num2(deal.dscr) : '∞' },
      { label: 'Απόδοση ιδίων κεφαλαίων (cash-on-cash)', value: pPct(lev.cashOnCash) },
      { label: 'Ετήσια ταμειακή ροή', value: pEur(lev.cashFlow) },
      { label: 'Εσωτερικός βαθμός απόδοσης (IRR)', value: Number.isFinite(deal.irrPct) ? pPct(deal.irrPct) : ABSENT },
      { label: 'Καθαρή παρούσα αξία (NPV)', value: pEur(deal.npv) },
      { label: 'Πολλαπλασιαστής ιδίων κεφαλαίων', value: `${num2(deal.equityMultiple)}×` },
      { label: 'Ορίζοντας κατοχής', value: `${parseInt(holdYears)} έτη`, kind: 'sub' },
    ] });
    sections.push({ type: 'table', title: 'Ανάλυση ευαισθησίας',
      head: ['Σενάριο', 'Συνολική απόδοση', 'Απόδοση ιδίων', 'Ταμειακή ροή'], align: ['l', 'r', 'r', 'r'],
      rows: scenarios.map(sc => [`${sc.label} ${sc.note}`, pPct(sc.totalReturn), pPct(sc.roe), pEur(sc.cashFlow)]) });
  }

  if (term === 'short' && breakEvenOcc !== null) {
    sections.push({ type: 'note', title: 'Νεκρό σημείο πληρότητας',
      text: `Ελάχιστη πληρότητα ώστε η βραχυχρόνια να αποδώσει όσο η μακροχρόνια στην ίδια περιοχή: ${breakEvenText(breakEvenOcc, pPct)}. Εκτιμώμενη πληρότητα εργαλείου: ${pPct(occEff)} · τιμή/νύχτα ${pEur(adrEff)}.` });
  }

  sections.push({ type: 'rows', title: `Σύγκριση με εναλλακτικές επενδύσεις (${cmpYears} έτη, ονομαστικές αποδόσεις)`,
    rows: compare.map(c => ({ label: c.label, value: `${pEur(c.futureValue)} · ${pPct(c.annualReturnPct)} ετησίως` })) });
  sections.push({ type: 'note', title: 'Παραδοχές και μεθοδολογία', text: asmpItems.map(t => `· ${t}`).join('\n') });
  sections.push({ type: 'note', text: `Πηγές: ${MARKET_SOURCES.map(s => s.label).join(' · ')}` });

  const issued = await issueDocument(supabase, {
    docType: 'Αναφορά απόδοσης',
    subject: name,
    period: term === 'short' ? 'Βραχυχρόνια μίσθωση' : 'Μακροχρόνια μίσθωση',
    summary: { value: nVal, grossYield: y.grossYield, netYield: y.netYield, grade: grade.grade },
  });

  const model: PdfReportModel = {
    branding, docType: 'Αναφορά απόδοσης', title: 'Αναφορά απόδοσης ακινήτου',
    subtitle: identity,
    meta: { id: issued.id, issuedAt: issued.issuedAt, verifyUrl: issued.verifyUrl, checksum: issued.checksum },
    sections, disclaimer,
  };
  await generateReportPdf(model, `Αναφορά_απόδοσης_${pName.trim() || 'ακίνητο'}`);
}
