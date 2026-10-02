'use client'
import { track, PRODUCT_EVENTS } from '@/lib/analytics/events';
import { collectionModeReason } from '@/lib/tax/rentCollectionMode';
import { T, Btn, IconBtn, ChipToggle, LinkBtn, Skeleton, SkeletonKPIs, fn } from '@/components/Theme'
import { hy } from '@/components/Hyphen'
import { ActionMenu } from '@/components/ActionMenu'
import { ChevronLeft, ChevronRight, Download, ArrowUpRight } from 'lucide-react'
import { InfoHint } from './InfoHint'
import BankImport from './BankImport'
import E2ReconcileCard from './E2ReconcileCard'
import { Landmark, Lock, Unlock } from 'lucide-react'
import { bracketsLabelForYear, BUSINESS_INCOME_BRACKETS_2026, CORPORATE_TAX_RATE_2026, ADVANCE_TAX_RATE_SOLE, ADVANCE_TAX_RATE_COMPANY, DIVIDEND_WITHHOLDING_RATE } from '@/lib/billing/greekTax'
import { PRESUMPTIVE_DEDUCTION_RATE } from '@/lib/accounting/statement'
import { FEATURE_MIN_PLAN, isTabPurchasable, planAtLeast, requiredPlanForTab } from '@/lib/billing/entitlements'
import { PLANS } from '@/lib/billing/plans'
import EnfiaPanel from './EnfiaPanel';
import AccountantDossier from './AccountantDossier'
import { UNCOLLECTED_RENT_RULE as UNCOLLECTED_RULE } from '@/lib/accounting/dossier'
import { readStatus, statusLabel, type StatusRow } from '@/lib/property/status'
// Το λογιστικό πρόσημο: τυπογραφικό μείον, όχι ενωτικό και ποτέ «−0,00€».
import { feSigned, fpRate } from '@/lib/core/format'
import { incomeEntry } from '@/lib/property/visibility'
import { printAccountingReport, downloadOfficialAccountingReport, type ReconLite } from './accountingReport'
import ReportBuilder from './ReportBuilder'
import JournalExport from './JournalExport'
import OwnerSplit from './OwnerSplit'
import RentAdjustmentModal from './RentAdjustmentModal'
import { AADE_CALENDAR_URL } from '@/lib/tax/greekTaxCalendar'
import { Printer, ShieldCheck } from 'lucide-react'
import { notifyError } from '@/components/Toast';
import { failed, MSG } from '@/lib/core/dbError';
import {
  eur, pct, athensYear, STATUS_META, toneStyle, statusInk,
} from './accounting/model'
import { card, cardTitle, Fold, Check, Kpi } from './accounting/Bits'
import { useAccounting, type AccountingProps } from './accounting/useAccounting'
import {
  TaxScaleCard, ConsolidationCard, AdvisoryCard, ChangesCard, TransferCostCard, CashFlowFold,
  TrialBalanceFold,
} from './accounting/AdvancedTools'

export default function TabAccounting({ propertyId, userId, profileType='individual', legalForm='individual', plan='free', status='rent_long', onNavigate, onAddExpense }: AccountingProps & {
  /** Ανοίγει τη φόρμα νέας δαπάνης στις Δαπάνες, όχι μόνο την καρτέλα. */
  onAddExpense?: () => void
}) {
  const {
    supabase, branding, reportBuilderOpen, setReportBuilderOpen, journalOpen, setJournalOpen,
    splitOpen, setSplitOpen, adjustOpen, setAdjustOpen, genOfficial, setGenOfficial,
    genOfficialCert, loading, readFailed, year, setYear, mode, elpForm, setElp, elp, age, ekfa,
    firstYears, updateFirstYears, distribution, setDistribution, claimedUncollected,
    setClaimedUncollected, rentsBankOverride, setRentsBankOverride, xferSide, setXferSide,
    xferPrice, setXferPrice, xferFirstHome, setXferFirstHome, xferAgent, setXferAgent, openAdvisory,
    setOpenAdvisory, advisoryOpen, setAdvisoryOpen, changesOpen, setChangesOpen, reconOpen,
    setReconOpen, ledgerOpen, setLedgerOpen, consolOpen, setConsolOpen, balanceOpen, setBalanceOpen,
    openChange, setOpenChange, advisoryRef, changesRef, showBankImport, setShowBankImport,
    setRefreshKey, hoverBracket, setHoverBracket, taxHot, setTaxHot, xferOpen, setXferOpen,
    cashOpen, setCashOpen, canJournal, journalPlanName, canAccountantPortal, canBankImport,
    canPortfolioReport, canOwnerSplit, advancedOpen, setAdvancedOpen, acctCopied, setAcctCopied,
    acctBusy, acctLink, acctRevoked, acctUntil, updateAge, updateEkfa, rent, stays, prop, allRent,
    allStays, isShort, regime, ownPct, isCoOwned, enfiaLoading, enfiaNow, enfia, enfiaSource,
    enfiaEstimated, enfiaState, enfiaBlock, rentAccruedYear, collection, bankMatters, rentsBank,
    expensesYear, billsYear, expensesTotal, deductibleTotal, loanInterestYear, businessMode,
    inventoryDepr, grossIncome, uncollectedRent, consolidation, myTaxShare, portfolio, minNetIncome,
    taxRows, statement, advisory, relevantChanges, xferEffectivePrice, xfer, provMonth, provision,
    cash, book, recentLedger, trial, jTotals, recon, rs, maxCash, dossierProps, dossier,
    doubleEntry, dossierExport, closing, lockErr, closingErr, printCertificate,
    officialRentCertificate, drift, lockYear, unlockYear, shareWithAccountant, revokeAccountantLink,
    exportBundle,
  } = useAccounting({ propertyId, userId, profileType, legalForm, plan, status, onNavigate })

  // Το σκαλί της εξόδου: ο χρήστης πήρε κάτι που δίνεται σε τρίτον. Μετριέται
  // ΠΟΙΟ είδος αναφοράς, όχι το περιεχόμενό της.
  function printReport(){
    void track(supabase, PRODUCT_EVENTS.report_generated, { kind: 'accounting' });
    const reconLite:ReconLite[] = recon.map(r=>{ const m=STATUS_META[r.status]; return { label:r.expected.label||'', paid:r.paidAmount, expected:r.expected.amount, statusLabel:m.label, statusColor:statusInk(r.status) } })
    printAccountingReport({
      propName: prop?.name||'Ακίνητο', address: prop?.address??undefined, year, regimeLabel,
      statement, provision, reconciliation: reconLite,
      expectedTotal: rs.expectedTotal, collectedTotal: rs.collectedTotal, outstanding: rs.outstanding,
      enfiaEstimated,
      branding,
    })
  }

  async function officialReport(){
    void track(supabase, PRODUCT_EVENTS.report_generated, { kind: 'official' });
    if(genOfficial) return
    const reconLite:ReconLite[] = recon.map(r=>{ const m=STATUS_META[r.status]; return { label:r.expected.label||'', paid:r.paidAmount, expected:r.expected.amount, statusLabel:m.label, statusColor:statusInk(r.status) } })
    setGenOfficial(true)
    try {
      await downloadOfficialAccountingReport({
        propName: prop?.name||'Ακίνητο', address: prop?.address??undefined, year, regimeLabel,
        statement, provision, reconciliation: reconLite,
        expectedTotal: rs.expectedTotal, collectedTotal: rs.collectedTotal, outstanding: rs.outstanding,
        enfiaEstimated,
        branding,
      }, { supabase, userId })
    } catch { notifyError(failed(MSG.pdf)) }
    finally { setGenOfficial(false) }
  }

  // Ξέρουμε το σχήμα της οθόνης (σειρά μετρικών + πίνακας λογιστικής), οπότε
  // δείχνουμε το σχήμα αντί για κυκλικό δείκτη: η διάταξη δεν «πηδά» όταν
  // φτάσουν τα δεδομένα.
  // Και ο ΕΝΦΙΑ: χωρίς αυτόν η Κατάσταση θα ζωγράφιζε πρώτα την εκτίμηση και
  // μετά το περσινό ποσό, δηλαδή λάθος πρόβλεψη για ένα καρέ.
  if(loading || enfiaLoading) return (<><SkeletonKPIs n={1} /><Skeleton h={280} r={14} /></>)

  // Η ΕΤΙΚΕΤΑ ΛΕΕΙ ΤΗΝ ΚΑΤΑΣΤΑΣΗ, ΟΧΙ ΤΟ ΚΑΘΕΣΤΩΣ. Το `regime` είναι
  // μακροχρόνιο για κάθε ακίνητο που δεν είναι βραχυχρόνιο, οπότε ένα κενό
  // ακίνητο έβγαινε «Μακροχρόνια μίσθωση» και στο PDF του λογιστή.
  const regimeLabel = businessMode ? 'Επιχείρηση (ΕΛΠ)' : statusLabel(prop as StatusRow)
  // Στον υπότιτλο το σκέτο «Κενό» διαβαζόταν ως «Κενό · έσοδα, φόρος…», δηλαδή
  // σαν να είναι άδεια τα έσοδα. Το ουσιαστικό λέει ότι είναι το ακίνητο.
  const subjectLabel = !businessMode && readStatus(prop as StatusRow)==='vacant' ? 'Κενό ακίνητο' : regimeLabel
  // Έχει το έτος πραγματική κίνηση; Αν όχι, αντί για τοίχο από «0€» δείχνουμε μια
  // ήρεμη, καθοδηγητική αφετηρία (τι θα ξεκλειδώσει μόλις μπουν δεδομένα).
  const hasActivity = grossIncome>0 || expensesTotal>0 || rentAccruedYear>0 || book.length>0
  // ── «ΤΟ ΒΓΑΖΟΥΜΕ ΗΔΗ» ΘΕΛΕΙ ΔΕΔΟΜΕΝΑ ΑΠΟ ΤΑ ΟΠΟΙΑ ΝΑ ΒΓΕΙ ────────────────
  // Ο φάκελος μετρούσε κάθε γραμμή που φτιάχνει η εφαρμογή ως έτοιμη· σε
  // άδεια χρονιά έγραφε «Τα 4 από τα 14 τα βγάζουμε ήδη από τα δεδομένα σου»
  // ακριβώς πάνω από το «Ξεκίνα τη λογιστική σου». Κάθε γραμμή μετρά πλέον
  // μόνο όταν υπάρχει αυτό από το οποίο βγαίνει, στο χαρτοφυλάκιο της χρονιάς.
  const yearKey = String(year)
  const rentThisYear = allRent.some(r=>r.period_year===year) || rent.some(r=>r.period_year===year)
  const staysThisYear = allStays.some(st=>String(st.check_in||'').slice(0,4)===yearKey) || stays.some(st=>String(st.check_in||'').slice(0,4)===yearKey)
  const costsThisYear = expensesYear.length>0 || billsYear.length>0
  const appReady = (id:string):boolean =>
    id==='expenses' ? costsThisYear
    : id==='e2' || id==='lease_contract' ? rentThisYear
    : id==='e2_short' ? staysThisYear
    : rentThisYear || staysThisYear || costsThisYear

  // Πού γράφεται το έσοδο αυτού του ακινήτου, από τη ΜΙΑ πηγή που ξέρει και την
  // ορατότητα των καρτελών. Δοκιμή τα σταυρώνει: ό,τι προτείνεται εδώ είναι
  // ορατό· όπου δεν υπάρχει έσοδο δεν προτείνεται καρτέλα εσόδου.
  // Ο ιδιώτης δεν φτάνει τους «Επισκέπτες» με κανένα πακέτο του: εκεί η
  // πρόταση δείχνει τη «Βραχυχρόνια», που τη φτάνει.
  const income = incomeEntry(status, {
    guestsReachable: isTabPurchasable(profileType, 'clients') || planAtLeast(plan, requiredPlanForTab('clients')),
  })
  // Η περίληψη των προχωρημένων λέει ΤΙ κρύβει, ώστε κανείς να μη χρειαστεί να
  // το ανοίξει «μήπως». Το ισοζύγιο αναφέρεται μόνο σε όποιον όντως το έχει.
  const advancedSummary = [
    'Κλείσιμο χρήσης', 'φορολογική κλίμακα', 'ταμειακές ροές', 'κόστος αγοράς και πώλησης',
    ...(mode==='professional' && elp==='personal' ? ['ενοποίηση χαρτοφυλακίου'] : []),
    ...(canJournal && doubleEntry ? ['ισοζύγιο διπλογραφικής'] : []),
  ].join(', ') + '.'

  // ── ΤΑ ΚΟΥΜΠΙΑ ΠΟΥ ΦΕΥΓΟΥΝ ΠΡΟΣ ΤΟΝ ΛΟΓΙΣΤΗ ────────────────────────────
  // Πηγαίνουν μέσα στην κάρτα του φακέλου, γιατί απαντούν την ίδια ερώτηση.
  // Ο φάκελος είναι το κύριο κουμπί και μένει εκεί· εδώ κάθονται τα τρία που
  // δεν είναι ο φάκελος: το σκέτο Excel (για όποιον θέλει μόνο τα νούμερα),
  // η ζωντανή πύλη και το ημερολόγιο άρθρων όπου υπάρχει.
  // ΤΟ `title` ΖΕΙ ΣΤΟ ΠΕΡΙΤΥΛΙΓΜΑ ΚΑΙ ΟΧΙ ΣΤΟ ΚΟΥΜΠΙ. Το `Btn` δέχεται `title`,
  // όμως η ζωντανή πύλη απενεργοποιείται όσο δημιουργείται ο σύνδεσμος και το
  // απενεργοποιημένο στοιχείο δεν δέχεται γεγονότα ποντικιού σε κάθε περιηγητή:
  // η εξήγηση θα χανόταν ακριβώς την ώρα της αναμονής. Στο περιτύλιγμα φαίνεται
  // πάντα· ο περιηγητής δείχνει το `title` του πλησιέστερου γονέα, οπότε ο
  // χρήστης βλέπει ό,τι έβλεπε — και οι τρεις της σειράς γράφονται ίδια.
  const accountantActions = (
    <>
      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
        <span style={{ display:'inline-flex' }} title="Μόνο τα νούμερα: αναλυτικές κινήσεις και κατάσταση αποτελεσμάτων σε ένα αρχείο Excel. Περιέχεται ήδη μέσα στον φάκελο.">
          <Btn variant="secondary" onClick={exportBundle}><Download size={13}/>Μόνο το Excel</Btn>
        </span>
        {/* Το accent περίγραμμα του «έτοιμη» ήταν ΚΑΤΑΣΤΑΣΗ και όχι ρόλος: τη λένε
            πλέον μόνο το εικονίδιο και το λεκτικό, όπως και η αναμονή. */}
        {/* «Ζωντανή πύλη λογιστή» δεν έλεγε τι παίρνει ο λογιστής. Παίρνει έναν
            σύνδεσμο που ανοίγει χωρίς κωδικούς· αυτό λέει τώρα το κουμπί. Το
            πακέτο ονομάζεται από το μητρώο, ποτέ γραμμένο με το χέρι. */}
        <span style={{ display:'inline-flex' }} title={canAccountantPortal ? "Σύνδεσμος για τον λογιστή σου, χωρίς κωδικούς και χωρίς email. Καλύπτει όλα τα ακίνητά σου: διεύθυνση, ΑΤΑΚ, μίσθωμα, έσοδα και δαπάνες της χρονιάς. Μόνο για ανάγνωση." : `Ο σύνδεσμος για τον λογιστή περιλαμβάνεται από το πακέτο «${PLANS[FEATURE_MIN_PLAN.e2_export].name}» και πάνω, όπως και η εξαγωγή Ε2.`}>
          <Btn variant="secondary" onClick={shareWithAccountant} disabled={acctBusy}>
          {canAccountantPortal
            ? <svg aria-hidden="true" width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M16 6l-4-4-4 4M12 2v13"/></svg>
            : <svg aria-hidden="true" width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}
          {acctBusy?'Δημιουργία…':acctLink?'Ο σύνδεσμος είναι έτοιμος':'Σύνδεσμος για τον λογιστή'}
          </Btn>
        </span>
        {/* ΤΟ ΚΛΕΙΔΩΜΕΝΟ ΦΑΙΝΕΤΑΙ ΕΚΕΙ ΠΟΥ ΠΑΤΙΕΤΑΙ. Ίδιος κανόνας με τη διπλανή
            πύλη λογιστή: το λουκέτο μπαίνει στη θέση του εικονιδίου, το κουμπί
            πάει στα πακέτα. Μόνο σε όποιον κρατά διπλογραφικά βιβλία, δηλαδή
            σε όποιον το ημερολόγιο άρθρων του χρησιμεύει. */}
        {doubleEntry && (
        <span style={{ display:'inline-flex' }} title={canJournal?"Πλήρες ημερολόγιο άρθρων και εξαγωγή CSV (SoftOne/Epsilon/QuickBooks/Xero)":`Το ημερολόγιο άρθρων και το ισοζύγιο διπλογραφικής περιλαμβάνονται από το πακέτο «${journalPlanName}» και πάνω.`}>
          <Btn variant="secondary" onClick={()=>{ if(!canJournal){ onNavigate?.('settings'); return } setJournalOpen(true) }}>
          {canJournal
            ? <svg aria-hidden="true" width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16v16H4z"/><path d="M4 10h16M10 4v16"/></svg>
            : <svg aria-hidden="true" width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}
          Ημερολόγιο άρθρων
          </Btn>
        </span>
        )}
      </div>
      {acctLink && (
        <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:10, padding:'8px 8px 8px 12px', borderRadius:T.radius.inner, background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', flexWrap:'wrap' }}>
          <span style={{ display:'inline-flex', width:24, height:24, borderRadius: T.radius.chip, background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', alignItems:'center', justifyContent:'center', color:'var(--text-tertiary)', flexShrink:0 }}>
            <svg aria-hidden="true" width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>
          </span>
          <input aria-label="Σύνδεσμος λογιστή" readOnly value={acctLink} onFocus={e=>e.currentTarget.select()} style={{ flex:1, minWidth:150, border:'none', background:'transparent', color:'var(--text-secondary)', fontSize:12, fontFamily: T.font.sans, outline:'none', textOverflow:'ellipsis' }} />
          {/* ΜΕΝΕΙ ΧΕΙΡΟΠΟΙΗΤΟ: κάθεται σε σειρά με το «Άνοιγμα πύλης» των T.h.sm
              και το minHeight T.h.md του Btn θα ψήλωνε μόνο αυτό, σπάζοντας τη
              στοίχιση της γραμμής. */}
          <button onClick={()=>{ try{ navigator.clipboard?.writeText(acctLink); setAcctCopied(true); setTimeout(()=>setAcctCopied(false),2000) }catch{ /* ignore */ } }} style={{ height:T.h.sm, padding:'0 12px', borderRadius:T.radius.pill, border:'1px solid var(--border-default)', background:'var(--bg-surface)', color:acctCopied?'var(--positive)':'var(--text-secondary)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily: T.font.sans, whiteSpace:'nowrap' }}>{acctCopied?'Αντιγράφηκε':'Αντιγραφή'}</button>
          <a href={acctLink} target="_blank" rel="noreferrer" style={{ display:'inline-flex', alignItems:'center', gap: 4, height:T.h.sm, padding:'0 13px', borderRadius:T.radius.pill, background:'var(--accent)', color:'var(--accent-text)', fontSize:12, fontWeight:600, textDecoration:'none', fontFamily: T.font.sans, whiteSpace:'nowrap' }}>Άνοιγμα πύλης<ArrowUpRight size={13}/></a>
          <div style={{ width:'100%', display:'flex', alignItems:'center', gap:10, marginTop:2, paddingLeft:2 }}>
            {/* Η ΕΜΒΕΛΕΙΑ ΛΕΓΕΤΑΙ ΕΚΕΙ ΠΟΥ ΠΑΙΡΝΕΤΑΙ Η ΑΠΟΦΑΣΗ. Ο πίνακας
                accountant_links δεν έχει στήλη ακινήτου: ο σύνδεσμος είναι ΑΝΑ
                ΧΡΗΣΤΗ και ο RPC επιστρέφει κάθε ακίνητο του κατόχου, με
                διεύθυνση, ΑΤΑΚ και μίσθωμα. Το κουμπί όμως ζει μέσα στην καρτέλα
                ΕΝΟΣ ακινήτου, οπότε η φυσική ανάγνωση ήταν «μοιράζομαι αυτό
                εδώ». Η μόνη ένδειξη ήταν σε tooltip που δεν ανοίγει σε κινητό. */}
            <span style={{ fontSize: 'var(--fs-xs)', color:acctRevoked?'var(--positive)':'var(--text-tertiary)', fontFamily: T.font.sans }}>{acctRevoked?'Ο παλιός σύνδεσμος ακυρώθηκε και ο λογιστής βγήκε.':`Πρόσβαση μόνο για ανάγνωση, σε ΟΛΑ τα ακίνητά σου, όχι μόνο σε αυτό.${acctUntil?` Ισχύει ${acctUntil}.`:''}`}</span>
            {/* LinkBtn και όχι Btn ghost: η ενέργεια κάθεται στο τέλος μιας
                πρότασης χωρίς κουτί, οπότε το γέμισμα ενός κουμπιού θα
                μετακινούσε τη γραμμή. Ο τόνος `danger` κρατά το κόκκινο που
                έδινε η χειροκίνητη αιώρηση: η ανάκληση σβήνει τον σύνδεσμο. */}
            <span style={{ marginLeft:'auto' }}>
              <LinkBtn tone="danger" onClick={revokeAccountantLink} disabled={acctBusy} title="Ακυρώνει τον τρέχοντα σύνδεσμο και δημιουργεί καινούριο· ο παλιός παύει αμέσως να λειτουργεί και όποιος λογιστής τον είχε ήδη ανοίξει χάνει την πρόσβαση">Ανάκληση</LinkBtn>
            </span>
          </div>
        </div>
      )}
    </>
  )

  // ══ ΟΤΑΝ Η ΑΝΑΓΝΩΣΗ ΑΠΕΤΥΧΕ, Η ΟΘΟΝΗ ΔΕΝ ΠΑΡΙΣΤΑΝΕΙ ΤΗΝ ΠΛΗΡΗ ═══════════
  // Το προηγούμενο σφάλμα αυτής της οθόνης, γραμμένο στα σχόλιά της, ήταν
  // «μηδέν έσοδα, μηδέν φόρος, μηδέν πρόβλεψη — σε PDF με αριθμό εγγράφου και
  // κωδικό QR επαλήθευσης». Ο δρόμος προς εκείνο το PDF περνούσε από τρεις
  // αναγνώσεις που γυρίζουν άδεια λίστα και όταν αποτύχουν.
  //
  // Δεν κρύβεται η οθόνη: ο ιδιοκτήτης μπορεί να θέλει να δει ό,τι φόρτωσε.
  // Λέγεται όμως, πάνω από όλα, ότι η εικόνα ΔΕΝ είναι πλήρης — πριν πατήσει
  // «Φάκελος λογιστή».
  if(readFailed) return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div role="alert" style={{ padding:'14px 16px', borderRadius:T.radius.card, background:'var(--bg-elevated)', border:'1px solid var(--border-default)' }}>
        <p style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)', fontFamily:T.font.sans, margin:0 }}>
          Τα οικονομικά δεδομένα δεν διαβάστηκαν
        </p>
        <p style={{ fontSize: 'var(--fs-base)', lineHeight:1.6, color:'var(--text-secondary)', fontFamily:T.font.sans, margin:'6px 0 0' }}>
          Τα έσοδα, οι δαπάνες και οι διαμονές δεν φορτώθηκαν. Μην εξαγάγεις Ε2,
          βεβαίωση ενοικίου ή φάκελο λογιστή πριν φορτωθούν: θα έβγαιναν με
          μηδενικά. Τα δεδομένα σου δεν έχουν χαθεί.
        </p>
        <div style={{ marginTop:12 }}>
          <Btn variant="secondary" onClick={()=>setRefreshKey(k=>k+1)}>Δοκίμασε ξανά</Btn>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* Κεφαλίδα: τίτλος, διακόπτης όψης και έτος */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
        <div style={{ minWidth:0 }}>
          {/* `h1` ΚΑΙ ΟΧΙ `h2`: ΕΙΝΑΙ Ο ΤΙΤΛΟΣ ΤΗΣ ΟΘΟΝΗΣ. Ως `h2` άφηνε την
              ιεραρχία χωρίς κορυφή και η πλοήγηση ανά επικεφαλίδα ξεκινούσε από
              το δεύτερο επίπεδο. Η εμφάνιση δεν αλλάζει: ίδιο μέγεθος, ίδιο
              βάρος, ίδια απόσταση — αλλάζει μόνο τι ακούει ο αναγνώστης οθόνης. */}
          <h1 style={{ fontFamily: T.font.sans, fontSize:20, fontWeight:700, color:'var(--text-primary)', margin:0, letterSpacing:'0.1px' }}>Λογιστική</h1>
          <p style={{ fontSize: 'var(--fs-base)', color:'var(--text-secondary)', margin:'4px 0 0', fontFamily: T.font.sans }}>{subjectLabel} · έσοδα, φόρος και καθαρό αποτέλεσμα, με βάση τα πραγματικά σου δεδομένα.</p>
          {/* ══════════════════════════════════════════════════════════════
              Ο ΣΥΝΙΔΙΟΚΤΗΤΗΣ ΠΡΕΠΕΙ ΝΑ ΞΕΡΕΙ ΤΙ ΚΟΙΤΑΖΕΙ

              Τα ποσά κόβονται πλέον στο μερίδιό του — αλλά ένας αριθμός που
              άλλαξε σιωπηλά είναι δεύτερη έκπληξη μετά την πρώτη. Η γραμμή
              λέει ΤΙ βλέπει και ΓΙΑΤΙ, ώστε να μπορεί να το διασταυρώσει με
              το μισθωτήριο και με τα αδέρφια του.

              Δεν εμφανίζεται σε πλήρη ιδιοκτησία: εκεί δεν λέει τίποτα.
              ══════════════════════════════════════════════════════════════ */}
          {isCoOwned && (
            <p style={{ fontSize: 'var(--fs-base)', color:'var(--text-secondary)', margin:'6px 0 0', fontFamily: T.font.sans }}>
              Συνιδιοκτησία {fn(ownPct, 2)}%: κάθε ποσό εδώ είναι το ΔΙΚΟ σου μερίδιο, όχι το σύνολο του ακινήτου. Οι δαπάνες που δήλωσες μοιρασμένες κρατούν το δικό τους ποσοστό.
            </p>
          )}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
          {/* ΜΙΑ ΕΡΩΤΗΣΗ, ΟΧΙ ΔΥΟ. Δίπλα σε αυτή ζούσε δεύτερη, «Ατομική ή
              νομικό πρόσωπο», που είναι η νομική μορφή: δηλώθηκε στην υποδοχή
              και δεν ξαναρωτιέται. Αυτή εδώ είναι διαφορετικό ερώτημα και δεν
              συμπεραίνεται: αν το ΑΚΙΝΗΤΟ ανήκει στην επιχείρηση. Το ενοίκιο
              φυσικού προσώπου φορολογείται με το άρθρο 40, ακόμη κι όταν ο
              ιδιοκτήτης έχει επιχείρηση για κάτι άλλο. */}
          {mode==='professional'&&(
            <div style={{ display:'flex', background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:10, padding:2, gap:2 }}>
              {/* `seg` και όχι `chip`: η ράγα από πάνω έχει ήδη δικό της περίγραμμα. */}
              {([['personal','Ενοίκια ιδιώτη'],['business','Μέσω επιχείρησης']] as [typeof elp,string][]).map(([e,label])=>(
                <ChipToggle key={e} on={elp===e} shape="seg" onClick={()=>setElp(e)}
                  title={e==='personal'?'Άρθρο 40: δική του κλίμακα, με τεκμαρτή έκπτωση 5%':'Άρθρο 15 ή εταιρικός συντελεστής, όταν το ακίνητο ανήκει στην επιχείρηση'}>
                  {label}
                </ChipToggle>
              ))}
            </div>
          )}
          {/* «Επίσημη» έλεγε ότι το έγγραφο το εκδίδει αρχή. Το PDF φέρει αριθμό
              εγγράφου και QR για να ελέγξει ο λογιστής ότι δεν άλλαξε· αυτό
              λέει και το όνομά του. Η αναπροσαρμογή ενοικίου εμφανίζεται μόνο
              όπου υπάρχει μισθωτής να ειδοποιηθεί. */}
          <ActionMenu label="Αναφορές και ενέργειες" icon={<Printer size={14}/>} items={[
            { key:'print', label:'Λογιστική αναφορά', description:'Σύνοψη εσόδων, φόρου και καθαρού σε PDF, έτοιμη για τον λογιστή σου', icon:<Printer size={16}/>, onClick:printReport },
            { key:'official', label:'Αναφορά με επαλήθευση', description:'PDF με αριθμό εγγράφου και QR για να ελέγξει ο λογιστής ότι δεν άλλαξε', icon:<ShieldCheck size={16}/>, onClick:officialReport, busy:genOfficial },
            ...(status==='rent_long' ? [
              { key:'adjust', label:'Αναπροσαρμογή ενοικίου', description:'Νόμιμη ειδοποίηση προς τον μισθωτή, με ηλεκτρονική υπογραφή', icon:<svg aria-hidden="true" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>, onClick:()=>setAdjustOpen(true) },
            ] : []),
            ...(canPortfolioReport ? [
              { key:'builder', label:'Σύνθεση αναφοράς', description:'Προσαρμοσμένη αναφορά για όλο το χαρτοφυλάκιο', icon:<svg aria-hidden="true" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></svg>, onClick:()=>setReportBuilderOpen(true) },
            ] : []),
            ...(canBankImport ? [
              { key:'bank', label:'Εισαγωγή από τράπεζα', description:'Ανέβασε κίνηση λογαριασμού και αντιστοίχισε αυτόματα τις εισπράξεις', icon:<Landmark size={16}/>, onClick:()=>setShowBankImport(true) },
            ] : []),
            ...(canOwnerSplit ? [
              { key:'split', label:'Κατανομή σε ιδιοκτήτες', description:'Καθαρό ανά συνιδιοκτήτη, με διαχειριστική αμοιβή', icon:<svg aria-hidden="true" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/></svg>, onClick:()=>setSplitOpen(true) },
            ] : []),
          ]}/>
          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
            <IconBtn label="Προηγούμενο έτος" onClick={()=>setYear(y=>y-1)}><ChevronLeft size={17}/></IconBtn>
            <span style={{ fontSize:16, fontWeight:700, color:'var(--text-primary)', fontFamily: T.font.sans, minWidth:60, textAlign:'center', fontVariantNumeric:'tabular-nums' }}>{year}</span>
            <IconBtn label="Επόμενο έτος" onClick={()=>setYear(y=>y+1)}><ChevronRight size={17}/></IconBtn>
          </div>
        </div>
      </div>

      {/* Αφετηρία — όταν δεν υπάρχει καμία κίνηση για το έτος. Πρώτη, πριν από
          τον φάκελο: είναι η μόνη ενέργεια που έχει νόημα σε άδεια χρονιά. */}
      {!hasActivity && (
        <div style={{ ...card, padding:'26px 24px' }}>
          <div style={{ display:'flex', alignItems:'flex-start', gap:16, flexWrap:'wrap' }}>
            <span style={{ width:44, height:44, borderRadius: T.radius.popup, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', color:'var(--text-secondary)' }}>
              <svg aria-hidden="true" width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>
            </span>
            <div style={{ flex:1, minWidth:240 }}>
              <p style={{ fontSize:16, fontWeight:700, color:'var(--text-primary)', margin:0, fontFamily: T.font.sans, letterSpacing:'0.1px' }}>Ξεκίνα τη λογιστική σου για το {year}</p>
              <p style={{ fontSize: 'var(--fs-base)', color:'var(--text-secondary)', margin:'6px 0 0', lineHeight:1.6, fontFamily: T.font.sans, maxWidth:520 }}>{income
                ? `Καταχώρησε ${income.noun} και δαπάνες. Από αυτά βγαίνουν ο φόρος, το ταμειακό υπόλοιπο και οι αναφορές για τον λογιστή σου.`
                : 'Καταχώρησε τις δαπάνες του ακινήτου. Από αυτά βγαίνουν το ταμειακό υπόλοιπο και οι αναφορές για τον λογιστή σου.'}</p>
              <div style={{ display:'flex', alignItems:'center', gap:16, margin:'14px 0 0', flexWrap:'wrap' }}>
                {/* ΤΑ ΟΝΟΜΑΤΑ ΕΙΝΑΙ ΤΑ ΟΝΟΜΑΤΑ ΠΟΥ ΘΑ ΔΕΙ. Η κενή οθόνη υποσχόταν «Καθαρό
                    ταμείο», ταμπέλα που δεν υπάρχει σε καμία γεμάτη οθόνη: εκεί η
                    γραμμή λέγεται «Ταμειακό υπόλοιπο». Οποιος το ψάχνει μετά την
                    πρώτη καταχώρηση δεν το βρίσκει με το όνομα που του δόθηκε. */}
                {['Έσοδα και πρόβλεψη φόρου','Ταμειακό υπόλοιπο','Αναφορές και PDF'].map(t=>(
                  <span key={t} style={{ display:'inline-flex', alignItems:'center', gap: 8, fontSize:12, color:'var(--text-tertiary)', fontFamily: T.font.sans }}>
                    <span style={{ width:5, height:5, borderRadius:'50%', background:'var(--border-default)', flexShrink:0 }}/>{t}
                  </span>
                ))}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:10, margin:'18px 0 0', flexWrap:'wrap' }}>
                {/* ═══ ΤΟ ΚΟΥΜΠΙ ΠΗΓΑΙΝΕ ΣΕ ΚΑΡΤΕΛΑ ΠΟΥ ΔΕΝ ΥΠΑΡΧΕΙ ═══════════
                    Το κύριο κουμπί έλεγε πάντα «Καταχώρηση ενοικίου» και καλούσε
                    `onNavigate('tenant')`. Ομως ο Ενοικιαστής είναι ορατός ΜΟΝΟ
                    σε μακροχρόνια μίσθωση: σε βραχυχρόνια, κενό, ιδιοχρησία,
                    ανακαίνιση, προς πώληση και νομική εκκρεμότητα κρύβεται με
                    γραμμένο λόγο. Η Λογιστική όμως φαίνεται και στις επτά.
                    Το `navSafe` της σελίδας ρίχνει σιωπηλά στην Επισκόπηση
                    όποιον ζητήσει αόρατη καρτέλα, άρα σε έξι στις επτά
                    καταστάσεις το κύριο, μπλε κουμπί της κενής οθόνης πετούσε
                    τον χρήστη αλλού χωρίς λέξη εξήγησης.

                    Τώρα η κενή οθόνη προτείνει ό,τι ΥΠΑΡΧΕΙ για αυτό το ακίνητο:
                    ενοίκιο στη μακροχρόνια, διαμονή στη βραχυχρόνια· όπου
                    δεν υπάρχει έσοδο, κύρια ενέργεια γίνεται το έξοδο — που
                    είναι και η μόνη καρτέλα ορατή σε κάθε κατάσταση. */}
                {income && (
                  <Btn variant="primary" onClick={()=>onNavigate?.(income.tab)}>{income.label}</Btn>
                )}
                {/* Το έξοδο γίνεται κύρια ενέργεια μόνο όταν δεν υπάρχει έσοδο δίπλα του. */}
                {/* Ανοίγει τη φόρμα και όχι μόνο την καρτέλα· λέγεται όπως το
                    κουμπί των Δαπανών. */}
                <Btn variant={income?'secondary':'primary'} onClick={()=>onAddExpense ? onAddExpense() : onNavigate?.('finances')}>Νέα δαπάνη</Btn>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ο ΦΑΚΕΛΟΣ, ΜΠΡΟΣΤΑ ΑΠΟ ΟΛΑ. Είναι η ερώτηση που έχει ο ιδιοκτήτης πριν
          από κάθε άλλη — «τι πρέπει να πάω στον λογιστή και τι μου λείπει;» —
          και μαζί του, στην ΙΔΙΑ κάρτα, ό,τι άλλο φεύγει προς τον λογιστή. */}
      {/* ΧΩΡΙΣ ΚΙΝΗΣΗ, Ο ΦΑΚΕΛΟΣ ΜΑΖΕΥΕΙ ΣΤΗΝ ΚΑΡΤΑ ΤΟΥ. Η αφετηρία καθόταν κάτω
          από 1.700 εικονοστοιχεία καταλόγου: ο χρήστης που δεν έχει γράψει
          ακόμη τίποτα έβλεπε πρώτα τι θα ζητήσει ο λογιστής και μετά πώς να
          ξεκινήσει. Τώρα ξεκινά από το «ξεκίνα» και ο κατάλογος ανοίγει με ένα
          πάτημα. */}
      <AccountantDossier userId={userId} state={dossier} year={year} properties={dossierProps} exportSource={dossierExport} actions={accountantActions}
        compact={!hasActivity} appReady={appReady} />

      {hasActivity && (<>
      {/* ═══════════════════════════════════════════════════════════════════
          ΕΝΑΣ ΑΡΙΘΜΟΣ ΣΤΗΝ ΚΟΡΥΦΗ· ΕΙΝΑΙ Ο ΜΟΝΟΣ ΠΟΥ ΔΕΝ ΛΕΕΙ Η ΚΑΤΑΣΤΑΣΗ

          ΗΤΑΝ ΔΥΟ ΠΛΑΚΙΔΙΑ ΜΕ ΔΥΟ ΔΙΑΦΟΡΕΤΙΚΕΣ ΜΟΝΑΔΕΣ ΧΡΟΝΟΥ, ΔΙΠΛΑ ΔΙΠΛΑ,
          ΙΔΙΟ ΜΕΓΕΘΟΣ. «Καθαρό ταμείο · 2026» και «Πρόβλεψη φόρου · μήνα». Ο
          χρήστης έβαζε το μάτι του σε δύο αριθμούς που ΔΕΝ συγκρίνονται· ο
          δεύτερος γύριζε στο έτος μέσα στη δική του υποσημείωση («σύνολο … τον
          χρόνο»). Ηταν η πρώτη εικόνα της οθόνης.

          ΚΑΙ ΤΟ ΠΡΩΤΟ ΗΤΑΝ ΗΔΗ ΓΡΑΜΜΕΝΟ ΤΕΣΣΕΡΑ ΕΚΑΤΟΣΤΑ ΠΙΟ ΚΑΤΩ. Το
          `statement.netCash` είναι η ΤΕΛΕΥΤΑΙΑ γραμμή της Κατάστασης
          Αποτελεσμάτων, «Ταμειακό υπόλοιπο», με δική της γραμμή από πάνω, δικό
          της βάρος και δικό της τόνο. Το ίδιο νούμερο, δύο φορές, σε μια ανάσα.
          Το σχόλιο του `Kpi` κατέγραφε ήδη ότι ΤΡΙΑ πλακίδια είχαν φύγει για
          ακριβώς αυτόν τον λόγο· αυτό είχε μείνει πίσω.

          ΜΕΝΕΙ Ο ΦΟΡΟΣ, ΓΙΑΤΙ ΕΙΝΑΙ ΤΟ ΜΟΝΟ ΑΘΡΟΙΣΜΑ ΠΟΥ ΔΕΝ ΥΠΑΡΧΕΙ ΑΛΛΟΥ.
          Το `annualTaxTotal` είναι φόρος εισοδήματος συν φόρος μερισμάτων συν
          φόροι και τέλη ακινήτου. Η Κατάσταση τα δείχνει ως ΞΕΧΩΡΙΣΤΕΣ γραμμές
          και δεν τα αθροίζει ποτέ: κανείς δεν σου λέει «τόσα θα δώσεις φέτος».
          Και είναι το μόνο νούμερο της οθόνης που κοιτάζει ΜΠΡΟΣΤΑ.

          Ο ΜΗΝΑΣ ΓΙΝΕΤΑΙ ΑΝΑΓΝΩΣΗ ΤΟΥ ΕΤΟΥΣ, ΟΧΙ ΑΝΤΑΓΩΝΙΣΤΗΣ ΤΟΥ. Δεν είναι
          δεύτερο μέγεθος, είναι ο ίδιος αριθμός διά δώδεκα. Πάει στη γραμμή
          υποστήριξης, όπου ανήκει κάθε παράγωγη ανάγνωση. Για το ΤΡΕΧΟΝ έτος
          όμως φεύγει: εκεί το μηνιαίο ποσό το λέει το «Πώς βγαίνει ο φόρος»
          (ως τον Δεκέμβριο) και δύο διαφορετικά «τον μήνα» στην ίδια οθόνη
          δεν λένε στον χρήστη πόσα να βάλει στην άκρη.
          ═══════════════════════════════════════════════════════════════════ */}
      {/* Η ΕΤΙΚΕΤΑ ΛΕΕΙ ΤΙ ΑΘΡΟΙΖΕΙ. Έγραφε «Πρόβλεψη φόρου» πάνω σε φόρο
          εισοδήματος ΣΥΝ ΕΝΦΙΑ ΣΥΝ ΤΑΚΚ, ενώ ο φάκελος του λογιστή στην ίδια
          σελίδα λέει για το ΤΑΚΚ ότι δεν είναι έσοδο του ιδιοκτήτη. Το σύνολο
          μένει (δεν το γράφει κανείς άλλος), με όνομα που το περιγράφει και με
          τον φόρο εισοδήματος ξεχωριστά στη γραμμή από κάτω. */}
      <Kpi label={provision.propertyTaxes>0 ? `Φόροι και τέλη ${year}` : `Φόρος εισοδήματος ${year}`} value={eur(provision.annualTaxTotal)}
        hot={taxHot} onHover={setTaxHot}
        note={<>
          {provision.propertyTaxes>0
            ? (provision.annualTaxTotal-provision.propertyTaxes>0
              ? `Φόρος εισοδήματος ${eur(provision.annualTaxTotal-provision.propertyTaxes)} και ${eur(provision.propertyTaxes)} φόροι και τέλη ακινήτου. `
              : 'Χωρίς φόρο εισοδήματος: όλο το ποσό είναι φόροι και τέλη ακινήτου. ')
            : ''}
          {year===athensYear() ? 'Ενδεικτικά.' : `Ενδεικτικά. Το ένα δωδέκατο είναι ${eur(provision.monthly)} τον μήνα.`}
          {/* ΕΝΑΣ ΦΟΡΟΛΟΓΟΥΜΕΝΟΣ, ΓΡΑΜΜΕΝΟ (28.09.2026). Η κλίμακα εφαρμόζεται στο
              σύνολο των ακινήτων του λογαριασμού. Σε λογαριασμό με πολλούς
              πελάτες αυτό δεν είναι ο φόρος κανενός τους· ως τον υπολογισμό ανά
              πελάτη, η παραδοχή λέγεται δίπλα στο νούμερο. */}
          {' Ο φόρος υπολογίζεται για έναν φορολογούμενο.'}
        </>} />

      {/* Κατάσταση Αποτελεσμάτων + Πρόβλεψη φόρου */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap:16 }}>
        <div className="po-fig-card" style={card}>
          <p style={cardTitle}>Κατάσταση αποτελεσμάτων</p>
          <div style={{ display:'flex', flexDirection:'column' }}>
            {statement.lines.map((l)=>{
              const strong = l.kind==='subtotal'||l.kind==='result'
              return (
                <div key={l.key} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderTop:l.kind==='result'?'1px solid var(--border-subtle)':'none' }}>
                  {/* Η ετικέτα παίρνει το ΙΔΙΟ μέγεθος με το ποσό της ίδιας γραμμής. Ηταν
                      13,5 δίπλα σε ποσό 14: το τελευταίο μέγεθος της εφαρμογής που
                      δεν ανήκε σε καμία κλίμακα· προσπαθούσε να πει «σχεδόν 14».
                      Την έμφαση τη λέει ήδη το βάρος, 600 έναντι 400. */}
                  <span style={{ flex:1, fontSize:strong?14:13, fontFamily: T.font.sans, fontWeight:strong?600:400, color:l.kind==='result'?'var(--text-primary)':'var(--text-secondary)' }}>{l.label}</span>
                  <span className="po-fig" data-tone={l.kind==='result'?(l.amount>=0?'accent':'negative'):undefined} style={{ fontSize:strong?14:13, fontFamily: T.font.sans, fontVariantNumeric:'tabular-nums', fontWeight:strong?700:500 }}>{/* Μηδενικός φόρος γράφεται «0,00€», όχι «−0,00€»: το μείον λέει «αφαιρείται κάτι». */}{feSigned(l.negative && l.amount ? -l.amount : l.amount)}</span>
                </div>
              )
            })}
          </div>
          {/* ── ΟΙ ΔΥΟ ΠΑΡΑΔΟΧΕΣ, ΔΙΠΛΑ ΣΤΙΣ ΓΡΑΜΜΕΣ ΠΟΥ ΑΛΛΑΖΟΥΝ ────────────
              Η τραπεζική είσπραξη ζούσε σε ΔΙΚΗ ΤΗΣ κάρτα, μακριά από την
              «Τεκμαρτή έκπτωση 5%» που ενεργοποιεί ή σβήνει. Ο χρήστης έβλεπε
              έναν διακόπτη χωρίς αποτέλεσμα και ένα αποτέλεσμα χωρίς αιτία,
              με μια ολόκληρη κάρτα ανάμεσά τους. Μια παράμετρος διαβάζεται
              μόνο δίπλα στο νούμερο που κουνάει. */}
          {!businessMode && ((regime==='individual_longterm' && bankMatters) || uncollectedRent>0) && (
            <div style={{ marginTop:12, paddingTop:12, borderTop:'1px solid var(--border-subtle)', display:'flex', flexDirection:'column', gap:10 }}>
              {/* Η ΕΡΩΤΗΣΗ ΔΕΝ ΜΠΑΙΝΕΙ ΟΠΟΥ ΔΕΝ ΑΛΛΑΖΕΙ ΤΙΠΟΤΑ. Για χρήσεις ως το
                  2025 η έκπτωση δινόταν ανεξάρτητα από τον τρόπο είσπραξης: ένα
                  κουτάκι που δεν κουνάει κανένα νούμερο διδάσκει τον χρήστη ότι
                  οι ερωτήσεις μας δεν αλλάζουν τίποτα. */}
              {regime==='individual_longterm' && bankMatters && (
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap: 8, flexWrap:'wrap' }}>
                    <Check checked={rentsBank} onChange={v=>setRentsBankOverride(v===collection.viaBank?null:v)} label={<span style={{ fontSize:12, color:'var(--text-secondary)' }}>Τα ενοίκια εισπράττονται <strong style={{ color:'var(--text-primary)' }}>μέσω τράπεζας</strong>.</span>}/>
                    <InfoHint>Από 1.7.2027 (ν.5222/2025, άρθρο 210· έναρξη με την απόφαση ΑΑΔΕ Α.1187/2026) τα μισθώματα κατοικίας θα πρέπει να εισπράττονται με τραπεζικό ή ηλεκτρονικό μέσο (κατάθεση, IRIS, έμβασμα). Με μετρητά θα χάνεται η τεκμαρτή έκπτωση 5% και θα φορολογείσαι στο 100% του ενοικίου. Για τις χρήσεις 2025-2026 η έκπτωση δίνεται ανεξάρτητα από τον τρόπο είσπραξης.</InfoHint>
                  </div>
                  {/* ΑΠΟ ΠΟΥ ΤΟ ΞΕΡΕΙ. Χωρίς αυτή τη γραμμή, ο χρήστης βλέπει ένα
                      τσεκαρισμένο κουτάκι και δεν έχει λόγο να το ελέγξει — που
                      είναι ακριβώς πώς περνά απαρατήρητος ένας μικρότερος φόρος. */}
                  {/* Οι δύο γραμμές κρέμονται κάτω από την ετικέτα: κουτάκι 17 συν το κενό της σειράς. */}
                  <p style={{ margin:'4px 0 0', paddingLeft: 17 + T.sp.sm, fontSize: 'var(--fs-xs)', color:'var(--text-tertiary)', fontFamily: T.font.sans, lineHeight:1.5 }}>
                    {collectionModeReason(collection)}
                    {rentsBankOverride !== null && ' Το άλλαξες εσύ· μετράει η δική σου απάντηση.'}
                  </p>
                  {!rentsBank && <p style={{ margin:'4px 0 0', paddingLeft: 17 + T.sp.sm, fontSize:12, color:'var(--negative)', fontFamily: T.font.sans }}>Χωρίς τραπεζική είσπραξη ο φόρος υπολογίζεται στο 100% των ενοικίων.</p>}
                </div>
              )}
              {uncollectedRent>0 && (
                <Check align="start" checked={claimedUncollected} onChange={setClaimedUncollected}
                  hint={UNCOLLECTED_RULE}
                  label={<span style={{ fontSize:12, color:'var(--text-secondary)' }}>Τα ανείσπρακτα ({eur(uncollectedRent)}) έχουν <strong style={{ color:'var(--text-primary)' }}>διεκδικηθεί νομικά</strong>, να μη φορολογηθούν φέτος.</span>} />
              )}
            </div>
          )}
        </div>

        {/* ΤΙ ΔΕΝ ΛΕΕΙ ΗΔΗ Ο ΑΡΙΘΜΟΣ ΑΠΟ ΠΑΝΩ. Η κάρτα έλεγε ξανά το ετήσιο
            σύνολο και το φορολογητέο — δύο μεγέθη που κάθονται πλέον κάτω από
            τον ίδιο τους τον τίτλο, στο πλακίδιο του φόρου. Εδώ μένει μόνο ό,τι
            δεν χωρά σε πλακίδιο: από πού βγαίνει, τι μέρος του είναι φόροι
            ακινήτου και τι πληρώνεται πότε. Και η επιφύλαξη, που ήταν
            ΞΕΧΩΡΙΣΤΗ ΚΑΡΤΑ για μία πρόταση, έγινε το υποσέλιδό της. */}
        <div className="po-fig-card" style={{ ...card, display:'flex', flexDirection:'column' }}>
          <p style={cardTitle}>Πώς βγαίνει ο φόρος</p>
          {/* ΠΕΡΑ ΠΕΡΑ, ΟΧΙ ΡΙΓΜΕΝΗ ΔΕΞΙΑ ΑΚΡΗ. Με όλες τις προτάσεις παρούσες η
              εξήγηση βγαίνει 283 χαρακτήρες σε κουτί 510 — δύο στήλες του
              πλέγματος μείον το γέμισμα της κάρτας — δηλαδή τέσσερις γραμμές
              που τελείωναν η καθεμιά αλλού. Η στοίχιση ΜΟΝΗ ΤΗΣ όμως τεντώνει
              τα κενά: μετρημένο σε 195 κενά, διάμεσο 5,5 έναντι φυσικού 4,2.
              Πάνε μαζί — `po-just` στο κουτί που κρατά το κείμενο, `hy()` γύρω
              από το κείμενο. */}
          <p className="po-just" style={{ fontSize: 'var(--fs-base)', color:'var(--text-secondary)', margin:0, fontFamily: T.font.sans, lineHeight:1.6 }}>
            {hy(<>
            {businessMode
              ? (elpForm==='company' ? <>Σταθερός συντελεστής <strong style={{ color:'var(--text-primary)' }}>22%</strong> στα καθαρά κέρδη, μετά από εκπιπτόμενα έξοδα, αποσβέσεις και τόκους.</> : <>Κλίμακα άρθρου 15 στα καθαρά κέρδη, μετά από εκπιπτόμενα έξοδα, εισφορές ΕΦΚΑ, αποσβέσεις και τόκους.</>)
              : (regime==='individual_longterm'
                  ? <>Τεκμαρτή έκπτωση 5% και προοδευτική {bracketsLabelForYear(year)}{!businessMode&&myTaxShare!=null&&(consolidation?.count??0)>1?<>, στο σύνολο των ενοικίων σου όπως στο Ε1: ο φόρος εδώ είναι <strong style={{ color:'var(--text-primary)' }}>το μερίδιο αυτού του ακινήτου</strong></>:''}.</>
                  // ΤΟ ΜΕΡΙΔΙΟ ΛΕΓΕΤΑΙ ΚΑΙ ΕΔΩ. Ο φόρος της βραχυχρόνιας είναι κι
                  // αυτός κομμάτι του ενός φόρου στο σύνολο των ενοικίων: χωρίς
                  // τη φράση, όποιος έκανε 15% επί του φορολογητέου έβρισκε άλλο
                  // ποσό και συμπέραινε ότι ο φόρος είναι λάθος. Τα τέλη έφυγαν
                  // από την πρόταση: δεν είναι μέρος αυτού του φόρου.
                  : <>Τεκμαρτή έκπτωση 5% και προοδευτική {bracketsLabelForYear(year)} στα μεικτά{myTaxShare!=null&&(consolidation?.count??0)>1?<>, στο σύνολο των ενοικίων σου όπως στο Ε1: ο φόρος εδώ είναι <strong style={{ color:'var(--text-primary)' }}>το μερίδιο αυτού του ακινήτου</strong></>:''}. Οι πραγματικές δαπάνες δεν εκπίπτουν.</>)}
            {/* Ο «μέσος συντελεστής» του statement.ts είναι φόρος ΠΡΟΣ ΜΕΙΚΤΑ
                (effRate = incomeTax / gross), όχι προς το φορολογητέο. Γραμμένα
                στην ίδια πρόταση, τα δύο μεγέθη διαβάζονταν ως πολλαπλασιασμός
                που δεν βγαίνει: 14,25% επί 11.400 δεν κάνει 1.710. Ο ιδιοκτήτης
                που κάνει τον έλεγχο συμπεραίνει ότι ο φόρος είναι λάθος. */}
            {statement.incomeTax>0?<> Ο φόρος εισοδήματος βγαίνει {eur(statement.incomeTax)} σε φορολογητέο {eur(statement.taxableIncome)}, δηλαδή {pct(statement.effectiveRate)} των μεικτών εσόδων.</>:''}
            {/* ΕΝΑ ΜΗΝΙΑΙΟ ΠΟΣΟ ΓΙΑ ΤΟ ΤΡΕΧΟΝ ΕΤΟΣ. Ο δείκτης από πάνω δεν γράφει
                πια το ένα δωδέκατο: δίπλα σε αυτό ο χρήστης δεν ήξερε ποιο να
                βάλει στην άκρη. Ο ΕΝΦΙΑ μένει έξω (βλ. taxProvision). */}
            {year===athensYear()&&provision.perRemainingMonth>0?<> Για τον φόρο εισοδήματος, <strong style={{ color:'var(--text-primary)' }}>{eur(provision.perRemainingMonth)} τον μήνα</strong> ως τον Δεκέμβριο.{enfia>0?' Ο ΕΝΦΙΑ πληρώνεται χωριστά, εφάπαξ ή σε δόσεις ως τον Φεβρουάριο.':''}</>:''}
            {provision.advanceTax>0?<> Συν προκαταβολή {eur(provision.advanceTax)}, που πιστώνεται τον επόμενο χρόνο: σύνολο πρώτου έτους {eur(provision.firstYearTotal)}.</>:''}
            </>)}
          </p>
          <div style={{ flex:1 }}/>
          <p style={{ fontSize:12, color:'var(--text-tertiary)', margin:'14px 0 0', paddingTop:12, borderTop:'1px solid var(--border-subtle)', fontFamily: T.font.sans, lineHeight:1.55 }}>
            Ενδεικτικά ποσά. Το τελικό ποσό το επιβεβαιώνει ο λογιστής σου ή το εκκαθαριστικό στο <a href={AADE_CALENDAR_URL} target="_blank" rel="noreferrer" style={{ color:'var(--accent)', textDecoration:'none' }}>myAADE</a>.
            <InfoHint>
              {businessMode
                ? (elpForm==='company' ? `Νομικό πρόσωπο: ${fpRate(CORPORATE_TAX_RATE_2026*100)} επί των καθαρών κερδών (μετά από εκπιπτόμενα έξοδα, αποσβέσεις κτιρίου και εξοπλισμού, καθώς και τόκους), συν προκαταβολή φόρου ${fpRate(ADVANCE_TAX_RATE_COMPANY*100)} και ${fpRate(DIVIDEND_WITHHOLDING_RATE*100)} φόρος στη διανομή μερίσματος.` : `Ατομική επιχείρηση: κλίμακα άρθρου 15 (${fpRate(BUSINESS_INCOME_BRACKETS_2026[0].rate*100)} έως ${fpRate(BUSINESS_INCOME_BRACKETS_2026[BUSINESS_INCOME_BRACKETS_2026.length-1].rate*100)}) επί των καθαρών κερδών, μετά από εκπιπτόμενα έξοδα, ΕΦΚΑ, αποσβέσεις και τόκους, με τεκμαρτό ελάχιστο καθαρό εισόδημα ${eur(minNetIncome.amount)}${minNetIncome.sourceYear!==year?` (ποσό ${minNetIncome.sourceYear}: για το ${year} δεν έχει ανακοινωθεί κατώτατος μισθός)`:''} και προκαταβολή φόρου ${fpRate(ADVANCE_TAX_RATE_SOLE*100)}.`)
                : (regime==='individual_longterm' ? `Μακροχρόνια μίσθωση φυσικού προσώπου: το εισόδημα φορολογείται κατά το άρθρο 40, με τεκμαρτή έκπτωση ${fpRate(PRESUMPTIVE_DEDUCTION_RATE*100)} για επισκευές και συντήρηση. Οι λοιπές δαπάνες, ο ΕΝΦΙΑ και οι τόκοι δανείου δεν εκπίπτουν.` : `Βραχυχρόνια μίσθωση φυσικού προσώπου: εισόδημα ακινήτων, με τεκμαρτή έκπτωση ${fpRate(PRESUMPTIVE_DEDUCTION_RATE*100)} στα μεικτά (άρθρο 39 ΚΦΕ). Οι πραγματικές δαπάνες δεν εκπίπτουν. Επιπλέον το τέλος ανθεκτικότητας ανά διανυκτέρευση και το τέλος παρεπιδημούντων όπου ισχύει.`)}
              {/* Η πρόταση απαριθμούσε ΔΥΟ στοιχεία («αξία και τ.μ.»)
                  ενώ η εκτίμηση διαβάζει πλέον ΤΕΣΣΕΡΑ. Ο ιδιοκτήτης που
                  συμπλήρωσε έτος κατασκευής ή όροφο έβλεπε το νούμερο να
                  αλλάζει χωρίς να λέει τίποτα η οθόνη από πού ήρθε. */}
              {enfiaEstimated&&provision.propertyTaxes>0?` Ο ΕΝΦΙΑ (${eur(enfia)}) είναι εκτίμηση${enfiaNow.estimateFrom==='facts'?' από τα καταχωρημένα στοιχεία του ακινήτου: αξία, τ.μ., έτος κατασκευής και όροφος':' από τη φόρμα του Υπολογισμού ΕΝΦΙΑ'}. Γράψε το περσινό ή το φετινό ποσό στον Υπολογισμό ΕΝΦΙΑ, πιο κάτω.`:''}
              {enfiaSource==='lastYear'&&provision.propertyTaxes>0?` Ο ΕΝΦΙΑ (${eur(enfia)}) είναι το περσινό ποσό που έγραψες. Μόλις βγει το φετινό εκκαθαριστικό, γράψε το στον Υπολογισμό ΕΝΦΙΑ.`:''}
              {/* Ο ΕΝΦΙΑ ΠΟΥ ΛΕΙΠΕΙ ΛΕΓΕΤΑΙ. Η πρόβλεψη χωρίς αυτόν είναι
                  μικρότερη από την πραγματική και ο ιδιοκτήτης δεν είχε τρόπο
                  να δει γιατί το ποσό δεν εμφανίστηκε ποτέ. */}
              {enfiaBlock?` ${enfiaBlock} Το ποσό λείπει από την πρόβλεψη ώσπου να το γράψεις στον Υπολογισμό ΕΝΦΙΑ, πιο κάτω.`:''}
            </InfoHint>
          </p>
        </div>
      </div>
      </>)}

      {/* ═══════════════════════════════════════════════════════════════════
          Η ΠΑΡΑΜΕΤΡΟΣ ΔΙΑΒΑΖΕΤΑΙ ΔΙΠΛΑ ΣΤΟ ΝΟΥΜΕΡΟ ΠΟΥ ΚΟΥΝΑΕΙ
          ─────────────────────────────────────────────────────────────────
          ΗΤΑΝ ΠΑΝΩ ΑΠΟ ΟΛΑ, ΠΡΙΝ ΑΠΟ ΚΑΘΕ ΑΡΙΘΜΟ. Ο χρήστης άνοιγε τη Λογιστική
          και το πρώτο που του ζητούσε η οθόνη ήταν να συμπληρώσει εισφορές
          ΕΦΚΑ, ηλικία και ποσοστό διανομής κερδών, χωρίς να έχει δει ούτε έναν
          αριθμό από αυτούς που τα τρία αυτά αλλάζουν. Είσοδος πριν από έξοδο.

          ΤΟΝ ΚΑΝΟΝΑ ΤΟΝ ΓΡΑΦΕΙ ΗΔΗ ΤΟ ΙΔΙΟ ΑΡΧΕΙΟ, για το κουτάκι της τραπεζικής
          είσπραξης: «Μια παράμετρος διαβάζεται μόνο δίπλα στο νούμερο που
          κουνάει». Εκεί εφαρμόστηκε, εδώ όχι.

          Και τα τρία πεδία κουνούν τα ΙΔΙΑ νούμερα: οι εισφορές είναι έκπτωση
          της Κατάστασης, η ηλικία διαλέγει κλίμακα, το ποσοστό διανομής γεννά
          τον φόρο μερισμάτων. Κάθονται λοιπόν από κάτω τους.
          ═══════════════════════════════════════════════════════════════════ */}
      {businessMode&&(
        <div style={{ ...card, display:'flex', gap:14, flexWrap:'wrap', alignItems:'stretch' }}>
          {elpForm==='sole'&&(
            <div style={{ display:'flex', flexDirection:'column', gap: 4, minWidth:150 }}>
              <span style={{ fontSize:12, color:'var(--text-secondary)', fontFamily: T.font.sans, fontWeight:500 }}>Εισφορές ΕΦΚΑ / έτος</span>
              <input aria-label="Εισφορές ΕΦΚΑ ανά έτος" type="number" inputMode="numeric" min={0} value={ekfa} onChange={e=>updateEkfa(e.target.value===''?'':Math.max(0,Number(e.target.value)))} placeholder=""
                onFocus={e=>e.currentTarget.style.borderColor='var(--accent)'} onBlur={e=>e.currentTarget.style.borderColor='var(--border-default)'}
                style={{ width:110, height:T.h.lg, padding:'10px 16px', borderRadius:10, border:'1px solid var(--border-default)', background:'var(--bg-elevated)', color:'var(--text-primary)', fontSize:14, fontFamily: T.font.sans, fontVariantNumeric:'tabular-nums', textAlign:'right', outline:'none', transition:'border-color 0.14s' }}/>
              <span style={{ fontSize: 'var(--fs-xs)', color:'var(--text-tertiary)', fontFamily: T.font.sans }}>Εκπίπτουν και μειώνουν το ταμείο.</span>
            </div>
          )}
          {elpForm==='sole'&&(
            <div style={{ display:'flex', flexDirection:'column', gap: 4, minWidth:150 }}>
              <span style={{ fontSize:12, color:'var(--text-secondary)', fontFamily: T.font.sans, fontWeight:500 }}>Ηλικία</span>
              <input aria-label="Ηλικία" type="number" inputMode="numeric" min={16} max={99} value={age} onChange={e=>updateAge(e.target.value===''?'':Math.max(0,Number(e.target.value)))} placeholder="Παράδειγμα: 30"
                title="Προαιρετικό. Ενεργοποιεί τη μειωμένη κλίμακα νέων (ν.5246/2025) στην ατομική επιχείρηση."
                onFocus={e=>e.currentTarget.style.borderColor='var(--accent)'} onBlur={e=>e.currentTarget.style.borderColor='var(--border-default)'}
                style={{ width:90, height:T.h.lg, padding:'10px 16px', borderRadius:10, border:'1px solid var(--border-default)', background:'var(--bg-elevated)', color:'var(--text-primary)', fontSize:14, fontFamily: T.font.sans, fontVariantNumeric:'tabular-nums', textAlign:'right', outline:'none', transition:'border-color 0.14s' }}/>
              <span style={{ fontSize: 'var(--fs-xs)', color:'var(--text-tertiary)', fontFamily: T.font.sans }}>Μειωμένη κλίμακα νέων (έως 30 ετών).</span>
            </div>
          )}
          {elpForm==='company'&&(
            <div style={{ display:'flex', flexDirection:'column', gap: 4, minWidth:150 }}>
              <span style={{ fontSize:12, color:'var(--text-secondary)', fontFamily: T.font.sans, fontWeight:500 }}>Διανομή κερδών</span>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <input aria-label="Διανομή κερδών σε ποσοστό" type="number" inputMode="numeric" min={0} max={100} value={distribution} onChange={e=>setDistribution(e.target.value===''?'':Math.min(100,Math.max(0,Number(e.target.value))))} placeholder=""
                  onFocus={e=>{ e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.boxShadow='0 0 0 3px var(--accent-soft)' }} onBlur={e=>{ e.currentTarget.style.borderColor='var(--border-control)'; e.currentTarget.style.boxShadow='none' }}
                  style={{ width:74, height:T.h.lg, padding:'10px 16px', borderRadius:10, border:'1px solid var(--border-control)', background:'var(--bg-elevated)', color:'var(--text-primary)', fontSize:14, fontFamily: T.font.sans, fontVariantNumeric:'tabular-nums', textAlign:'right', outline:'none', transition:'border-color 0.14s' }}/>
                <span style={{ color:'var(--text-tertiary)', fontSize:14 }}>%</span>
              </div>
              <span style={{ fontSize: 'var(--fs-xs)', color:'var(--text-tertiary)', fontFamily: T.font.sans }}>Το μέρισμα φορολογείται επιπλέον με 5%.</span>
            </div>
          )}
          <div style={{ display:'flex', flexDirection:'column', gap:6, justifyContent:'center', paddingLeft:14, borderLeft:'1px solid var(--border-subtle)', minWidth:220 }}>
            <Check checked={firstYears} onChange={updateFirstYears} label={<span style={{ fontWeight:500, color:'var(--text-primary)' }}>Νέα επιχείρηση (πρώτη τριετία)</span>} align="start" />
            {/* Κρέμασμα κάτω από την ετικέτα: κουτάκι 17 συν το κενό της σειράς. */}
            <span style={{ fontSize:12, color:'var(--text-tertiary)', fontFamily: T.font.sans, lineHeight:1.5, paddingLeft: 17 + T.sp.sm }}>Τα πρώτα 3 έτη δραστηριότητας: 1ο κλιμάκιο 4,5% (αντί 9%) και προκαταβολή φόρου μειωμένη κατά 50%.</span>
          </div>
        </div>
      )}

      {/* ══ Η ΣΥΜΦΩΝΙΑ ΕΝΟΙΚΙΩΝ ΔΕΝ ΑΦΟΡΑ ΤΗ ΒΡΑΧΥΧΡΟΝΙΑ ══════════════════════
          Η κάρτα αποδιδόταν ΠΑΝΤΑ. Σε βραχυχρόνιο ακίνητο δεν υπάρχουν «ενοίκια
          του μήνα» να συμφωνήσουν με τίποτα — υπάρχουν κρατήσεις και αυτές τις
          δείχνει η διπλανή στήλη. Το αποτέλεσμα ήταν μια κάρτα με ΜΙΑ πρόταση
          μέσα («Δεν υπάρχουν καταχωρημένα ενοίκια για το 2026»), τεντωμένη στο
          ύψος της διπλανής λίστας: ~700 εικονοστοιχεία κενού, στη μισή οθόνη,
          για ένα πράγμα που δεν πρόκειται ποτέ να γεμίσει.

          ΚΑΙ ΤΟ ΤΕΝΤΩΜΑ ΦΕΥΓΕΙ ΚΑΙ ΓΙΑ ΤΗ ΜΑΚΡΟΧΡΟΝΙΑ. Οι δύο κάρτες δεν είναι
          ισότιμα πλακίδια σειράς — είναι δύο ανεξάρτητα πάνελ, το ένα σύνοψη και
          το άλλο λίστα. Το `alignItems: 'start'` αφήνει την καθεμιά στο ύψος του
          περιεχομένου της. (Ο κανόνας «ίδιο ύψος» ισχύει για ΣΕΙΡΑ ομοειδών
          καρτών, όχι για δύο διαφορετικά πράγματα δίπλα-δίπλα.) */}
      {/* ═══ ΤΟ ΚΑΘΟΛΙΚΟ ΘΕΛΕΙ ΠΛΑΤΟΣ, ΟΧΙ ΜΙΣΗ ΚΑΡΤΑ ══════════════════════════
          ΤΙ ΜΕΤΡΗΘΗΚΕ (05/09/2026, 768). Το πλέγμα έσπαγε σε δύο στήλες των 352
          και το καθολικό είναι ΤΕΤΡΑΣΤΗΛΟ: ημερομηνία, περιγραφή, χρέωση,
          πίστωση. Στην περιγραφή έμεναν 72 εικονοστοιχεία για κείμενο που ζητά
          152 — «Συντήρηση καυστήρα» γινόταν «Συντήρη…».

          Το 320 ήταν σωστό για κάρτες με μία στήλη αριθμών· εδώ οι στήλες είναι
          τέσσερις. Στα 430 το καθολικό παίρνει ολόκληρο το πλάτος ως τα 876 και
          σπάει σε δύο μόνο όταν υπάρχει πραγματικά χώρος και για τις δύο.

          ΑΛΛΑΖΕΙ ΜΟΝΟ ΑΥΤΟ ΤΟ ΠΛΕΓΜΑ. Τα άλλα τρία της καρτέλας μένουν στα 320:
          κρατούν κάρτες με λίγες στήλες, όπου δύο δίπλα δίπλα διαβάζονται μια
          χαρά και η αλλαγή θα τους έτρωγε χώρο χωρίς λόγο. */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(min(100%, 430px), 1fr))', gap:16, alignItems:'start' }}>
        {!isShort && (
          <Fold open={reconOpen} onToggle={()=>setReconOpen(o=>!o)} title="Συμφωνία ενοικίων"
            right={<span style={{ fontSize:12, color:'var(--text-secondary)', fontFamily: T.font.sans }}>Εισπράχθηκαν <strong style={{ color:'var(--text-primary)' }}>{eur(rs.collectedTotal)}</strong> / {eur(rs.expectedTotal)}</span>}>
          {recon.length===0?(
            <p style={{ fontSize: 'var(--fs-base)', color:'var(--text-tertiary)', fontFamily: T.font.sans, padding:'12px 0' }}>Δεν υπάρχουν καταχωρημένα ενοίκια για το {year}.</p>
          ):(
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {recon.map((r,i)=>{ const m=STATUS_META[r.status]; return (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:10, background:'var(--bg-surface)', border:'1px solid var(--border-subtle)' }}>
                  {/* Η κουκκίδα έφυγε: έλεγε με χρώμα ό,τι λέει η λέξη δίπλα της. */}
                  <span style={{ flex:1, fontSize: 'var(--fs-base)', fontWeight:m.strong?600:400, color:'var(--text-primary)', fontFamily: T.font.sans }}>{r.expected.label}</span>
                  <span style={{ fontSize: 'var(--fs-base)', color:'var(--text-secondary)', fontVariantNumeric:'tabular-nums', fontFamily: T.font.sans }}>{eur(r.paidAmount)} / {eur(r.expected.amount)}</span>
                  <span style={{ fontSize: 'var(--fs-xs)', fontWeight:600, ...toneStyle(m.tone), borderRadius: T.radius.modal, padding:'2px 9px', fontFamily: T.font.sans, minWidth:78, textAlign:'center' }}>{m.label}</span>
                </div>
              )})}
            </div>
          )}
          {rs.collectedTotal>0&&(
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginTop:12 }}>
              {/* Το `title` κάθε βεβαίωσης λέει ΤΙ ακριβώς βγαίνει και για ποιον·
                  ζει στο περιτύλιγμα γιατί το «Επίσημο PDF» απενεργοποιείται όσο
                  ετοιμάζεται το αρχείο και το απενεργοποιημένο κουμπί δεν δείχνει
                  παντού το δικό του tooltip. */}
              <span style={{ display:'inline-flex' }} title="Ετήσια βεβαίωση καταβληθέντων ενοικίων (PDF) για τον μισθωτή">
                <Btn variant="secondary" onClick={printCertificate}><Printer size={13}/>Βεβαίωση ενοικίου</Btn>
              </span>
              <span style={{ display:'inline-flex' }} title="Η βεβαίωση ενοικίου σε PDF με αριθμό εγγράφου και QR, για να ελέγξει όποιος τη λάβει ότι δεν άλλαξε">
                <Btn variant="secondary" onClick={officialRentCertificate} disabled={genOfficialCert}><ShieldCheck size={14}/>{genOfficialCert?'Δημιουργία…':'PDF με επαλήθευση'}</Btn>
              </span>
            </div>
          )}
          </Fold>
        )}

        <Fold open={ledgerOpen} onToggle={()=>setLedgerOpen(o=>!o)} title={mode==='professional'?'Βιβλίο εσόδων-εξόδων':'Πρόσφατες κινήσεις'}>
          {recentLedger.length===0?(
            <p style={{ fontSize: 'var(--fs-base)', color:'var(--text-tertiary)', fontFamily: T.font.sans, padding:'8px 0' }}>Καμία κίνηση για το {year}.</p>
          ):(
            <div style={{ display:'flex', flexDirection:'column' }}>
                {/* ═══ Η ΧΡΟΝΙΑ ΕΙΝΑΙ ΛΙΠΟΣ ΣΕ ΚΑΡΤΕΛΑ ΠΟΥ ΕΧΕΙ ΗΔΗ ΧΡΟΝΙΑ ══════════════
                    ΤΙ ΜΕΤΡΗΘΗΚΕ (05/09/2026, 768). Η γραμμή είναι τέσσερις στήλες μέσα σε
                    320 εικονοστοιχεία: ημερομηνία 74, ετικέτα, δύο ποσά 172. Στην ετικέτα
                    έμεναν 44 και το «Συντήρηση καυστήρα» ζητούσε 141 — έχανε το 71% του.
                    Δίπλα του το «Συντήρηση κλιματιστικού» θα έδειχνε το ίδιο στέλεχος.

                    Το `book` βγαίνει από το `buildLedger(yearEntries)`: η καρτέλα ΕΙΝΑΙ ήδη
                    μιας χρήσης, με τον επιλογέα έτους από πάνω. Το «/2026» σε δεκατέσσερις
                    σειρές δεν προσθέτει τίποτα — απλώς κρατά 28 εικονοστοιχεία που τα
                    χρειάζεται η μόνη στήλη που ΛΕΕΙ κάτι.

                    Και η ετικέτα αποκτά δάπεδο οκτώ χαρακτήρων, ώστε να μη γίνει ξανά
                    στέλεχος αν προστεθεί κάποτε πέμπτη στήλη. */}
              {/* Κεφαλίδα μόνο στο βιβλίο: εκεί η μεσαία στήλη είναι το ΥΠΟΛΟΙΠΟ μετά
                  την κίνηση και χωρίς όνομα διαβαζόταν ως δεύτερο ποσό. */}
              {mode==='professional'&&(
                <div aria-hidden style={{ display:'flex', alignItems:'center', gap:10, padding:'4px 0 6px', borderBottom:'1px solid var(--border-subtle)', fontSize:'var(--fs-xs)', color:'var(--text-tertiary)', fontFamily: T.font.sans }}>
                  <span style={{ width:46, flexShrink:0 }}>Ημ/νία</span>
                  <span style={{ flex:1, minWidth:'8ch' }}>Περιγραφή</span>
                  {/* Πρώτα το ποσό, μετά το υπόλοιπο που αφήνει: η σειρά κάθε βιβλίου. */}
                  <span style={{ width:92, textAlign:'right' }}>Ποσό</span>
                  <span style={{ width:80, textAlign:'right' }}>Υπόλοιπο</span>
                </div>
              )}
              {(mode==='professional'?book.slice(-14).reverse():recentLedger).map((e,i,arr)=>(
                <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:i<arr.length-1?'1px solid var(--border-subtle)':'none' }}>
                  <span style={{ fontSize:12, color:'var(--text-tertiary)', fontFamily: T.font.sans, fontVariantNumeric:'tabular-nums', width:46, flexShrink:0 }}>{e.date.slice(8,10)}/{e.date.slice(5,7)}</span>
                  <span className="po-elide" style={{ flex:1, minWidth:'8ch', fontSize: 'var(--fs-base)', color:'var(--text-primary)', fontFamily: T.font.sans }}>{e.description}</span>
                  <span style={{ fontSize: 'var(--fs-base)', fontWeight:600, color:'var(--text-primary)', fontVariantNumeric:'tabular-nums', fontFamily: T.font.sans, width:92, textAlign:'right' }}>{e.type==='income'?'+':'−'}{eur(e.amount)}</span>
                  {mode==='professional'&&<span title="Υπόλοιπο μετά την κίνηση" style={{ fontSize:12, color:'var(--text-tertiary)', fontFamily: T.font.sans, fontVariantNumeric:'tabular-nums', width:80, textAlign:'right' }}><span className="sr-only">Υπόλοιπο μετά την κίνηση </span>{feSigned(e.balance)}</span>}
                </div>
              ))}
            </div>
          )}
        </Fold>
      </div>

      {/* ΟΙ ΔΥΟ ΦΟΡΟΙ ΠΟΥ ΕΧΟΥΝ ΔΙΚΟ ΤΟΥΣ ΕΝΤΥΠΟ. Ο ΕΝΦΙΑ και ο έλεγχος του
          προσυμπληρωμένου Ε2 στέκονταν σε αντίθετες άκρες της καρτέλας: ο ένας
          τρίτος από πάνω, πριν ο χρήστης δει έναν αριθμό της χρονιάς του, ο
          άλλος τελευταίος, πίσω από κάθε τι άλλο και με ένα ορφανό κενό από
          πάνω του. Μπαίνουν μαζί, μετά την εικόνα της χρήσης: πρώτα «πόσα
          βγάζω και τι φόρο», μετά «τι λέει το κάθε έντυπο». */}
      <EnfiaPanel propertyId={propertyId} userId={userId} year={year} enfia={enfiaState} />
      <E2ReconcileCard userId={userId} year={year} plan={plan} onUpgrade={()=>onNavigate?.('settings')} />

      {/* ── ΠΡΟΧΩΡΗΜΕΝΑ ───────────────────────────────────────────────────────
          Ο απλός ιδιοκτήτης θέλει τέσσερα πράγματα: έσοδα, έξοδα, φόρους και τι
          πάει στον λογιστή. Τα υπόλοιπα εργαλεία δεν είναι περιττά — είναι απλώς
          δεύτερα. Ζουν εδώ, ένα κλικ μακριά, αντί να γεμίζουν την πρώτη ματιά
          του ανθρώπου που θέλει μόνο να ξέρει πού βρίσκεται. */}
      <div style={card}>
        <button onClick={()=>setAdvancedOpen(o=>!o)} aria-expanded={advancedOpen} className="acc-toggle acc-row">
          <ChevronRight size={16} style={{ color:'var(--text-tertiary)', flexShrink:0, transform:advancedOpen?'rotate(90deg)':'none', transition:'transform 0.18s' }}/>
          <div style={{ flex:1, minWidth:0 }}>
            <p style={{ ...cardTitle, margin:0 }}>Προχωρημένα εργαλεία</p>
            <p style={{ fontSize:12, color:'var(--text-tertiary)', margin:'3px 0 0', fontFamily: T.font.sans, lineHeight:1.5 }}>{advancedSummary}</p>
          </div>
        </button>
        {advancedOpen && (
        <div style={{ display:'flex', flexDirection:'column', gap:16, marginTop:16 }}>

        {/* Κλείσιμο χρήσης, premium κατάσταση με σαφή ένδειξη ανοιχτό/κλειστό */}
        {(()=>{ const isCurrent = year===athensYear()
          const isFuture = year>athensYear()
          const st = closingErr?'unknown':drift?'drift':closing?'locked':'open'
          const meta = { open:{ c:isCurrent?'var(--accent)':'var(--text-tertiary)', label:'ΑΝΟΙΧΤΟ' }, locked:{ c:'var(--positive)', label:'ΚΛΕΙΣΜΕΝΟ' }, drift:{ c:'var(--warning)', label:'ΑΠΟΚΛΙΣΗ' }, unknown:{ c:'var(--text-tertiary)', label:'ΑΓΝΩΣΤΗ ΚΑΤΑΣΤΑΣΗ' } }[st]
          return (
          <div style={{ ...card, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap', borderColor: st==='drift'?'var(--warning)':'var(--border-subtle)' }}>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6, height:26, padding:'0 10px', borderRadius: T.radius.chip, background: st==='drift' ? `color-mix(in srgb, var(--warning) 12%, transparent)` : 'var(--bg-elevated)', color: st==='drift' ? 'var(--warning)' : 'var(--text-secondary)', fontSize: 'var(--fs-xs)', fontWeight:700, letterSpacing:'0.5px', fontFamily: T.font.sans }}>
              {st==='unknown'?<Unlock size={12}/>:st==='open'?(isCurrent?<span className="live-dot" style={{ width:7, height:7, borderRadius:'50%', background:'var(--accent)', flexShrink:0 }}/>:<Unlock size={12}/>):<Lock size={12}/>}{meta.label}
            </span>
            <span style={{ fontSize: 'var(--fs-base)', color:'var(--text-secondary)', fontFamily: T.font.sans }}>
              {st==='unknown'?<>Δεν μπορέσαμε να διαβάσουμε αν η χρήση {year} είναι κλειδωμένη. Δεν εμφανίζεται κουμπί κλειδώματος: αν είναι ήδη κλειδωμένη, ένα νέο κλείδωμα θα έσβηνε το αρχικό στιγμιότυπο. Ανανέωσε τη σελίδα.</>:st==='open'?(isCurrent?<>Χρήση {year} σε εξέλιξη · μήνας {provMonth} από 12.</>:isFuture?<>Η χρήση {year} δεν έχει ξεκινήσει ακόμη.</>:<>Χρήση {year} ολοκληρωμένη, έτοιμη για κλείδωμα.</>):st==='drift'?<>Η χρήση {year} κλειδώθηκε, αλλά τα δεδομένα άλλαξαν έκτοτε.</>:<>Χρήση {year}, κλειδωμένη στις {new Date(closing!.locked_at).toLocaleDateString('el-GR')}.</>}
              <InfoHint>Το κλείδωμα κρατά αμετάβλητο στιγμιότυπο των αριθμών του έτους (χρήσιμο μετά την υποβολή στην ΑΑΔΕ). Αν αργότερα αλλάξεις ενοίκια ή έξοδα, εμφανίζεται προειδοποίηση απόκλισης, χωρίς να χαθεί το αρχικό κλείδωμα.</InfoHint>
              {lockErr && <span style={{ display:'block', marginTop:4, color:'var(--negative)', fontSize:12 }}>Το κλείδωμα δεν αποθηκεύτηκε: {lockErr}. Έλεγξε ότι έχει εφαρμοστεί το migration book_closings στη βάση.</span>}
              {closingErr && <span style={{ display:'block', marginTop:4, color:'var(--negative)', fontSize:12 }}>{closingErr}</span>}
            </span>
            <div style={{ flex:1 }}/>
            {st==='unknown' ? null : st==='open'
              ? (isFuture ? null : <Btn variant="secondary" onClick={lockYear}><Lock size={13}/>Κλείδωμα έτους</Btn>)
              : <>
                  {/* ΜΕΝΕΙ ΧΕΙΡΟΠΟΙΗΤΟ: το περίγραμμα και το κείμενο είναι --warning
                      και ο τόνος προειδοποίησης δεν είναι ρόλος του Btn· ως secondary
                      θα έχανε τη μόνη ένδειξη ότι τα δεδομένα άλλαξαν μετά το κλείδωμα. */}
                  {st==='drift'&&<button onClick={lockYear} style={{ height:T.h.sm, padding:'0 13px', borderRadius: T.radius.card, border:'1px solid var(--warning)', background:'transparent', color:'var(--warning)', fontSize: 'var(--fs-base)', fontWeight:500, cursor:'pointer', fontFamily: T.font.sans }}>Ενημέρωση</button>}
                  {/* `ghost`: ήταν ήδη διάφανο και χωρίς περίγραμμα, δίπλα στο
                      «Ενημέρωση» που κρατά τον τόνο της προειδοποίησης. */}
                  <Btn variant="ghost" onClick={unlockYear}><Unlock size={13}/>Ξεκλείδωμα</Btn>
                </>}
          </div>
        )})()}

        {/* Η κλίμακα, με έμφαση στο κλιμάκιο του χρήστη. Ο ΤΙΤΛΟΣ ΛΕΕΙ ΧΡΟΝΙΑ
            ΜΟΝΟ ΣΤΗΝ ΕΠΙΧΕΙΡΗΜΑΤΙΚΗ ΚΑΙ ΕΙΝΑΙ ΣΚΟΠΙΜΟ: τα κλιμάκια των ενοικίων
            βγαίνουν από το `rentalRowsForYear(year)` και ακολουθούν τον επιλογέα,
            οπότε η χρονιά λέγεται ήδη εκεί. Τα επιχειρηματικά βγαίνουν από τη
            σταθερή `BUSINESS_INCOME_ROWS_2026`, που ΔΕΝ τον ακολουθεί: εκεί το
            «2026» δεν είναι επανάληψη, είναι η μόνη προειδοποίηση ότι ο πίνακας
            δείχνει άλλη χρονιά από αυτήν που διάλεξε ο χρήστης. */}
        {!(businessMode&&elpForm==='company') ? (
          <TaxScaleCard
            businessMode={businessMode} taxRows={taxRows} statement={statement} hoverBracket={hoverBracket}
            setHoverBracket={setHoverBracket}
          />
        ) : (
          <div style={{ ...card, display:'flex', alignItems:'center', justifyContent:'space-between', gap:20, flexWrap:'wrap' }}>
            <div style={{ minWidth:0, flex:1 }}>
              <p style={{ ...cardTitle, margin:0 }}>Νομικό πρόσωπο</p>
              {/* ΙΔΙΟ ΣΧΗΜΑ ΜΕ ΤΗΝ ΕΞΗΓΗΣΗ ΤΟΥ ΦΟΡΟΥ, ΙΔΙΑ ΔΟΥΛΕΙΑ. 190 χαρακτήρες
                  σε κουτί 560 —το `maxWidth` της ίδιας γραμμής— βγάζουν τρεις
                  γραμμές στον υπολογιστή· στα 430 το κουτί πέφτει κοντά στα 380
                  κι οι γραμμές γίνονται τέσσερις. Στοίχιση πέρα πέρα με μαλακά
                  ενωτικά από κάτω: χωριστά, η μία τεντώνει τα κενά κι ο άλλος
                  δεν έχει τι να κλείσει. */}
              <p className="po-just" style={{ fontSize: 'var(--fs-base)', color:'var(--text-secondary)', margin:'7px 0 0', fontFamily: T.font.sans, lineHeight:1.6, maxWidth:560 }}>{hy(<>Σταθερός φόρος <strong style={{ color:'var(--text-primary)' }}>22%</strong> επί των καθαρών κερδών, ανεξαρτήτως ύψους εισοδήματος (ΑΕ, ΕΠΕ, ΙΚΕ, ΟΕ, ΕΕ). Στη διανομή μερίσματος προστίθεται φόρος 5% και ισχύει προκαταβολή φόρου για το επόμενο έτος.</>)}</p>
            </div>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minWidth:104, height:76, borderRadius: T.radius.popup, background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', flexShrink:0 }}>
              <span style={{ fontSize:28, fontWeight:700, color:'var(--text-primary)', fontFamily: T.font.sans, fontVariantNumeric:'tabular-nums', lineHeight:1 }}>22%</span>
              <span style={{ fontSize: 'var(--fs-xs)', color:'var(--text-tertiary)', letterSpacing:'0.5px', textTransform:'uppercase', fontFamily: T.font.sans, marginTop: 4 }}>Συντελεστής</span>
            </div>
          </div>
        )}

        {/* Επαγγελματίας: ενοποίηση χαρτοφυλακίου + εκπιπτόμενα */}
        {/* ΔΥΟ ΣΤΗΛΕΣ ΜΟΝΟ ΟΤΑΝ Η ΚΑΘΕΜΙΑ ΠΑΙΡΝΕΙ ΟΣΟ ΔΙΝΕΙ ΤΟ ΤΗΛΕΦΩΝΟ.
            ΜΕΤΡΗΜΕΝΟ ΣΤΗ ΣΚΗΝΗ accounting-pro. Το πλέγμα είναι φωλιασμένο στην
            κάρτα των προχωρημένων: στα 430 η .app-content κρατά 12 δεξιά
            αριστερά (αφήνει 406) και η κάρτα άλλα 16, οπότε το πλέγμα πιάνει
            374 και βγάζει μία στήλη των 374. Με ελάχιστο 320 έσπαγε σε δύο
            στήλες ήδη στα 768, δηλαδή 336 η καθεμιά: 38 ΛΙΓΟΤΕΡΑ ΑΠΟ ΤΟ
            ΤΗΛΕΦΩΝΟ. Εκεί το «75.600,00€» ζητούσε 96 σε κουτί 91 (κομμένο) ·
            τα ονόματα των ακινήτων 73 σε 62 (με αποσιωπητικά). Στα 834 έβγαζε
            369, πάλι κάτω από το τηλέφωνο. Με ελάχιστο 380 οι δύο στήλες
            ξεκινούν στα 856 του παραθύρου με 380 η καθεμιά, δηλαδή ποτέ
            στενότερες από το τηλέφωνο. Χαμηλότερο ελάχιστο δεν κάνει: στα 800
            το εσωτερικό κελί βγαίνει ακριβώς 96 για τιμή που ζητά 96.
            ΚΟΣΤΟΣ, ΜΕΤΡΗΜΕΝΟ: στα 768 η ενότητα ψηλώνει από 582 σε 698 · στα
            834 από 564 σε 698. Στα 430 και από τα 1024 κι επάνω δεν αλλάζει
            τίποτα. */}
        {mode==='professional'&&(
          <ConsolidationCard
            elp={elp} consolOpen={consolOpen} setConsolOpen={setConsolOpen} portfolio={portfolio} year={year}
            propertyId={propertyId} deductibleTotal={deductibleTotal} expensesTotal={expensesTotal}
            inventoryDepr={inventoryDepr} loanInterestYear={loanInterestYear}
          />
        )}

        {/* Συμβουλευτική, καθαρές, στοχευμένες προτάσεις με αξία (ανοιγοκλείνει ομοιόμορφα) */}
        {advisory.length>0 && (
        <AdvisoryCard
          advisoryRef={advisoryRef} setAdvisoryOpen={setAdvisoryOpen} setOpenAdvisory={setOpenAdvisory}
          advisoryOpen={advisoryOpen} advisory={advisory} openAdvisory={openAdvisory}
        />
        )}

        {/* «Τι άλλαξε» — επίκαιροι κανόνες 2026 σχετικοί με το προφίλ (διακριτικό) */}
        {relevantChanges.length>0 && (
        <ChangesCard
          changesRef={changesRef} setChangesOpen={setChangesOpen} setOpenChange={setOpenChange}
          changesOpen={changesOpen} relevantChanges={relevantChanges} openChange={openChange}
        />
        )}

        {/* Κόστος αγοράς & πώλησης, δομημένη εκτίμηση μεταβίβασης */}
        <TransferCostCard
          xferOpen={xferOpen} setXferOpen={setXferOpen} xferSide={xferSide} setXferSide={setXferSide}
          xferPrice={xferPrice} setXferPrice={setXferPrice} prop={prop} xferFirstHome={xferFirstHome}
          setXferFirstHome={setXferFirstHome} xferAgent={xferAgent} setXferAgent={setXferAgent}
          xferEffectivePrice={xferEffectivePrice} xfer={xfer}
        />

        {/* Ταμειακές ροές */}
        <CashFlowFold cashOpen={cashOpen} setCashOpen={setCashOpen} cash={cash} year={year} maxCash={maxCash} />

        {/* ── ΤΟ ΙΣΟΖΥΓΙΟ ΚΑΙ ΜΟΝΟ ΑΥΤΟ ────────────────────────────────────
            Εδώ καθόταν ολόκληρη κάρτα «Για τον λογιστή»: Excel, ζωντανή πύλη,
            ημερολόγιο άρθρων και ισοζύγιο, διπλωμένα μέσα σε άλλο δίπλωμα, στο
            τέλος της καρτέλας. Δηλαδή η ερώτηση «τι δίνω στον λογιστή μου;»
            απαντιόταν ΔΥΟ φορές — μία στην κορυφή, με τον φάκελο και μία εδώ
            κάτω με το ίδιο ακριβώς Excel που ήδη περιέχει ο φάκελος. Τα κουμπιά
            ανέβηκαν στην κάρτα του φακέλου, όπου ανήκουν.
            ΜΕΝΕΙ ΤΟ ΙΣΟΖΥΓΙΟ, γιατί είναι πίνακας και όχι ενέργεια και ΜΟΝΟ
            στα διπλογραφικά: ένας ιδιοκτήτης με ένα διαμέρισμα δεν πρέπει να δει
            ποτέ τη λέξη· μια ΙΚΕ πρέπει να τη δει με έμφαση. Ποιος έχει τι, το
            ξέρει ο φάκελος (dossier.ts) — εδώ απλώς υπακούμε στην απάντησή του. */}
        {canJournal && doubleEntry && (
        <TrialBalanceFold
          balanceOpen={balanceOpen} setBalanceOpen={setBalanceOpen} trial={trial} year={year}
          jTotals={jTotals}
        />
        )}

        </div>
        )}
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          Η ΚΑΡΤΑ ΠΟΥ ΠΟΥΛΟΥΣΕ ΤΟ ΠΑΚΕΤΟ ΣΤΟ ΤΕΛΟΣ ΤΗΣ ΛΟΓΙΣΤΙΚΗΣ ΕΦΥΓΕ.
          ───────────────────────────────────────────────────────────────────
          Καθόταν κάτω από όλα, σε πλήρες πλάτος, με δικό της τίτλο, παράγραφο
          και έγχρωμο κουμπί: την τελευταία εικόνα που έπαιρνε ο χρήστης από τη
          Λογιστική του δεν την έδιναν τα νούμερά του, την έδινε μια διαφήμιση.
          Και τη διάβαζε ΚΑΘΕ μη συνδρομητής του «Επαγγελματία», ακόμη κι ο
          ιδιοκτήτης ενός διαμερίσματος που δεν θα κρατήσει ποτέ διπλογραφικά.

          Ό,τι έλεγε λέγεται ήδη σε δύο σημεία που τα ζητά ο χρήστης: η σύγκριση
          πακέτων στις Ρυθμίσεις έχει τη γραμμή «Λογιστικό ημερολόγιο» με το
          σκαλί της· το ίδιο το κουμπί «Ημερολόγιο άρθρων» πιο πάνω δείχνει
          πλέον λουκέτο αντί να κρύβεται. Η πληροφορία μένει· η διαφήμιση φεύγει.
          ═════════════════════════════════════════════════════════════════════ */}

      {showBankImport&&<BankImport propertyId={propertyId} userId={userId} year={year} onClose={()=>setShowBankImport(false)} onDone={()=>setRefreshKey(k=>k+1)} />}
      <ReportBuilder open={reportBuilderOpen} onClose={()=>setReportBuilderOpen(false)} userId={userId} supabase={supabase} branding={branding} />
      <JournalExport open={journalOpen} onClose={()=>setJournalOpen(false)} userId={userId} supabase={supabase} />
      <OwnerSplit open={splitOpen} onClose={()=>setSplitOpen(false)} userId={userId} supabase={supabase} branding={branding} />
      <RentAdjustmentModal open={adjustOpen} onClose={()=>setAdjustOpen(false)} userId={userId} supabase={supabase} branding={branding} />
    </div>
  )
}
