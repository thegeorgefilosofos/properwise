'use client';

import { TextInput, Toggle, ToggleTrack, InfoDot } from './UIComponents';
import { T, fe, feAuto, fp, fn, ABSENT_SHORT, KPIGrid, Skeleton, SkeletonKPIs, pressable, Btn, IconBtn, ChipToggle, LinkBtn } from '@/components/Theme';
import { feSigned, fpSigned } from '@/lib/core/format';
import { monthGen } from '@/lib/core/months';
import { notify } from '@/components/Toast';
import { categoryStatus, RecurringCharge } from '@/lib/billing/budget';
import BudgetImport from './BudgetImport';
import { toggleIn } from '@/lib/core/toggleSet';
import {
  parseLocalDate, FIXED_CATS, PAYERS,
  type Props,
} from './budget/model'
import { Sparkline, MonthBars, Donut } from './budget/charts'
import { InlineNumber, InlineText } from './budget/Bits'
import { useBudget } from './budget/useBudget'

export default function BillsBudget({ propertyId, userId = '', profileType = 'individual' }: Props) {
  const {
    isPro, budgets, actuals, monthTotals, catMonth, income, incomeYtd, loanMonthly, rentalMode,
    propSqm, strNights, recurring, monthItems, catBreakdown, openCats, setOpenCats, invReturns,
    strPropCount, taxPctAuto, loading, saving, hoverCat, setHoverCat, delCatHover, setDelCatHover,
    newCatName, setNewCatName, hoverRec, setHoverRec, hoverWeek, setHoverWeek, coarse, exclAmtDraft,
    setExclAmtDraft, addingCat, setAddingCat, ledgerNoteSeen, dismissLedgerNote, showSettings,
    setShowSettings, demoBusy, setMonthOffset, collapsed, toggleCollapse, loadData, updateBudget,
    labelOverrides, activeCats, hiddenBaseCats, catBudget, masterBudget, persistCats, UNDO_MS,
    addCategory, removeCategory, restoreCategory, demoIds, seedDemo, removeDemo, renameCategory,
    excludedMap, excludedCount, excludeItem, unexcludeItem, patchExcl, exclAmountOf, _curYm,
    catForecast, forecastTotal, projectedOver, annual, catTrend, _sparkYms, catSpark, yearBars,
    catYtd, weekCats, weekTotalV, weekMax, rolloverOn, _prevYm, hasPrevMonth, carryIn, adjAvailable,
    _prevLabel, isCurMonth, viewYm, viewActuals, viewActualTotal, viewRecordedTotal, viewMonthLabel,
    viewItems, displayOver, canGoNewer, canGoOlder, committedBills, monthlyCost, hasIncome,
    insights, dismissSuggestion, targetSuggestions, notifyOn, isSTR, strPlatformPct, strMgmtPct,
    strTaxPct, waterfall, incomeDeductions, safeRaw, isShortfall,
  } = useBudget({ propertyId, userId, profileType })

  // Κεφαλίδα ενότητας — ΟΛΗ η γραμμή είναι clickable (άνοιγμα/κλείσιμο), όχι μόνο το βελάκι.
  // Το ⓘ σταματά τη διάδοση ώστε να δείχνει επεξήγηση χωρίς να κλείνει την ενότητα.
  const secHdr = (label: string, key?: string, right?: React.ReactNode, info?: React.ReactNode) => {
    const shut = !!key && collapsed.has(key);
    const clickable = !!key;
    return (
      <div
        onClick={clickable ? () => toggleCollapse(key!) : undefined}
        onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCollapse(key!); } } : undefined}
        role={clickable ? 'button' : undefined} tabIndex={clickable ? 0 : undefined} aria-expanded={clickable ? !shut : undefined}
        style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: shut ? 0 : 12, paddingBottom: shut ? 0 : 10, borderBottom: shut ? 'none' : '1px solid var(--border-subtle)', cursor: clickable ? 'pointer' : 'default', userSelect: 'none' }}>
        <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: T.font.sans }}>{label}</span>
        {info && <span onClick={e => e.stopPropagation()} style={{ display: 'inline-flex' }}>{info}</span>}
        <span style={{ flex: 1 }}/>
        {right}
        {key && (
          <span aria-hidden="true" style={{ display: 'flex', color: 'var(--text-tertiary)', padding: 4, margin: '-4px -4px -4px 0' }}>
            <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: shut ? 'rotate(-90deg)' : 'none', transition: 'transform 0.18s' }}><polyline points="6 9 12 15 18 9"/></svg>
          </span>
        )}
      </div>
    );
  };

  // Ενιαίος διακόπτης ρύθμισης (ίδιο idiom με τα toggles της εφαρμογής).
  // ΤΙ ΕΣΠΑΣΕ. Η κάρτα είναι η ίδια <button> που γυρίζει τη ρύθμιση, αλλά ο
  // βοηθός δεν είχε ΚΑΘΟΛΟΥ σημασιολογία διακόπτη: ούτε role="switch" ούτε
  // aria-checked. Και οι δύο ρυθμίσεις («Ειδοποίηση σε υπέρβαση», «Μεταφορά
  // υπολοίπου») ανακοινώνονταν ως απλά κουμπιά, δηλαδή ο αναγνώστης οθόνης δεν
  // έλεγε ποτέ αν είναι ανοιχτές. Ο δείκτης βαφόταν με ωμό #fff και η σκιά με
  // ωμό rgba — δύο παραβάσεις της παλέτας μέσα σε τρεις γραμμές. Δεν γίνεται
  // κοινό `Toggle`: το `Toggle` είναι <button> και <button> μέσα σε <button>
  // είναι άκυρο HTML.
  //
  // Η ΑΠΑΝΤΗΣΗ ΗΤΑΝ ΝΑ ΞΑΝΑΖΩΓΡΑΦΙΣΤΕΙ ΤΟ ΕΛΑΤΗΡΙΟ ΣΤΟ ΧΕΡΙ, δηλαδή δεύτερη
  // εμφάνιση για το ίδιο πράγμα — και είχε ήδη αποκλίνει: `borderRadius: 20`
  // αντί για το ύψος και δικό της `transition`. Τώρα η όψη έρχεται από το
  // `ToggleTrack`, που τη μοιράζεται με το κοινό `Toggle`: μία εμφάνιση, δύο
  // περιτυλίγματα, κανένα ένθετο κουμπί.
  const settingToggle = (settingKey: string, on: boolean, title: string, desc: string) => (
    <button type="button" role="switch" aria-checked={on} onClick={() => updateBudget(settingKey, on ? 'false' : 'true')}
      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg-elevated)', border: `1px solid ${on ? 'var(--border-accent)' : 'var(--border-subtle)'}`, borderRadius: T.radius.inner, cursor: 'pointer', textAlign: 'left', fontFamily: T.font.sans }}>
      <ToggleTrack on={on} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-primary)' }}>{title}</span>
        <span style={{ display: 'block', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>{desc}</span>
      </span>
    </button>
  );

  // Σκελετός αντί για spinner: το σχήμα (KPIs + κάρτες κατηγοριών) είναι σταθερό,
  // οπότε η διάταξη δεν «πηδά» μόλις φτάσουν τα δεδομένα.
  if (loading) return <><SkeletonKPIs n={4} />{[0, 1, 2].map(i => <Skeleton key={i} h={70} r={12} style={{ marginBottom: 10 }} />)}</>;

  return (
    <div style={{ fontFamily: T.font.sans, color: 'var(--text-primary)' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            {/* Η ΜΟΝΗ ΕΠΙΚΕΦΑΛΙΔΑ ΠΡΩΤΟΥ ΕΠΙΠΕΔΟΥ ΤΗΣ ΟΨΗΣ. Ήταν <div> κάτω από
                ένα κρυφό h1 «Δαπάνες»: η σελίδα ανακοινωνόταν με άλλο όνομα. */}
            <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em', margin: 0 }}>Προϋπολογισμός</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
            {/* Το κουτί είναι ο στόχος αφής, το βελάκι μένει 15: ό,τι κάνει η
                `.po-ico` για κάθε άλλο εικονοκουμπί της εφαρμογής. */}
            <IconBtn onClick={() => canGoOlder && setMonthOffset(o => o - 1)} disabled={!canGoOlder} label="Προηγούμενος μήνας">
              <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </IconBtn>
            <span style={{ minWidth: 96, textAlign: 'center', textTransform: 'capitalize' }}>{viewMonthLabel}</span>
            <IconBtn onClick={() => canGoNewer && setMonthOffset(o => o + 1)} disabled={!canGoNewer} label="Επόμενος μήνας">
              <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </IconBtn>
            {/* Δευτερεύον: έχει λεκτικό και περίγραμμα σε διάφανο φόντο. Το μελάνι
                γίνεται ουδέτερο, γιατί το χρώμα του ρόλου ζει πλέον στην `.po-btn`. */}
            {!isCurMonth && <Btn variant="secondary" onClick={() => setMonthOffset(0)}>Τρέχων</Btn>}
            {/* ΤΟ ΠΡΟΦΙΛ ΕΙΝΑΙ ΠΛΗΡΟΦΟΡΙΑ, ΟΧΙ ΦΙΛΤΡΟ. Ως τσιπ δίπλα στον μήνα
                έμοιαζε με κάτι που πατιέται· γράφεται πλέον ως κείμενο. */}
            <span style={{ marginLeft: 6, color: 'var(--text-tertiary)' }}>{isPro ? 'προφίλ επιχείρησης' : 'προφίλ ιδιώτη'}</span>
            {saving && <span style={{ marginLeft: 10, color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)' }}>· Αποθήκευση…</span>}
          </div>
        </div>
      </div>

      {/* Μία γραμμή, μία φορά. Τα σύνολα άλλαξαν και ο χρήστης δικαιούται να ξέρει
          γιατί — χωρίς πανό, χωρίς παράθυρο, χωρίς να ζητά κλικ για να συνεχίσει. */}
      {!ledgerNoteSeen && (monthItems.length > 0 || Object.keys(monthTotals).length > 0) && (
        /* ΤΟ ΚΟΥΜΠΙ ΔΕΝ ΣΠΑΕΙ ΣΕ ΔΥΟ ΓΡΑΜΜΕΣ. Χωρίς `nowrap` και `flexShrink: 0`
           το κείμενο έπαιρνε όλο τον χώρο και το «Το κατάλαβα» στριμωχνόταν σε
           δύο σειρές δίπλα του. Το κείμενο παίρνει ό,τι μένει και στοιχίζεται. */
        <div className="po-stack-sm" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12, padding: '8px 8px 8px 16px', border: '1px solid var(--border-subtle)', borderRadius: T.radius.card, background: 'var(--bg-surface)', fontFamily: T.font.sans, fontSize: 12, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
          <span className="po-just" style={{ flex: 1, minWidth: 0 }}>
            Τα σύνολα μετρούν λογαριασμούς και δαπάνες μαζί, στον μήνα της ημερομηνίας τους. Όσα δεν έχουν πληρωθεί μετρούν κι αυτά και σημειώνονται «εκκρεμεί».
          </span>
          {/* Ήσυχο και όχι δευτερεύον: η σημείωση δεν ζητά απόφαση, οπότε η
              απόρριψή της δεν παίρνει περίγραμμα. */}
          <Btn variant="ghost" onClick={dismissLedgerNote} className="po-btn-keep">
            Το κατάλαβα
          </Btn>
        </div>
      )}

      {/* «Δείξε μου» — δείγμα μήνα όταν ο προϋπολογισμός είναι άδειος */}
      {isCurMonth && demoIds.length === 0 && monthItems.length === 0 && Object.keys(monthTotals).length === 0 && (
        <div className="budget-rise" style={{ background: 'var(--bg-surface)', border: '1px dashed var(--border-default)', borderRadius: T.radius.card, padding: 16, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-primary)', fontFamily: T.font.sans, marginBottom: 4 }}>Δες πώς λειτουργεί σε 10 δευτερόλεπτα</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: T.font.sans, lineHeight: 1.5 }}>Θα προσθέσουμε ένα δείγμα δαπανών του μήνα, ώστε να ζωντανέψουν τα γραφήματα και οι κατηγορίες. Τα αφαιρείς με ένα άγγιγμα όποτε θέλεις.</div>
          </div>
          {/* Δευτερεύον και όχι κύριο: το γέμισμα ήταν απόχρωση του τονισμού με
              ορατό περίγραμμα, δηλαδή κουμπί με περίμετρο. Το ύψος T.h.md είναι
              ήδη το προεπιλεγμένο του Btn, οπότε η γραμμή δεν κουνιέται. */}
          <Btn variant="secondary" onClick={seedDemo} disabled={demoBusy}>
            {demoBusy ? 'Δημιουργία…' : 'Δείξε μου'}
          </Btn>
        </div>
      )}

      {/* Ενεργό δείγμα — διακριτική επισήμανση + αφαίρεση */}
      {demoIds.length > 0 && (
        <div className="budget-rise" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.card, padding: '11px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          <span style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)', fontFamily: T.font.sans }}>Εμφανίζονται δείγματα δεδομένων για επίδειξη.</span>
          {/* Ήσυχο: μέσα σε γραμμή ειδοποίησης, χωρίς φόντο και χωρίς περίγραμμα.
              Το μελάνι γίνεται ουδέτερο — ο τονισμός ανήκει στην κύρια ενέργεια. */}
          <Btn variant="ghost" onClick={removeDemo} disabled={demoBusy}>
            {demoBusy ? 'Αφαίρεση…' : 'Αφαίρεση δείγματος'}
          </Btn>
        </div>
      )}

      {/* «Ασφαλές διαθέσιμο» — έσοδα − δεσμευμένα − εισφορές (Monzo Left to Spend) */}
      {isCurMonth && (hasIncome || monthlyCost > 0) && (() => {
        const val = hasIncome ? safeRaw : monthlyCost;
        const seg = (v: number) => income > 0 ? Math.max(0, Math.min(100, (v / income) * 100)) : 0;
        // ── ΤΑ ΣΚΕΛΗ ΠΟΥ ΥΠΑΡΧΟΥΝ ΠΡΑΓΜΑΤΙΚΑ ────────────────────────────────
        // Η υποσημείωση έγραφε «λογαριασμοί και δόση» ΠΑΝΤΑ και τα σκέλη
        // γράφονταν ξανά από κάτω ως πλακίδια. Σε ακίνητο χωρίς δάνειο η φράση
        // υποσχόταν δόση που δεν υπάρχει και όταν το μόνο σκέλος ήταν τα πάγια
        // το πλακίδιο «ΠΑΓΙΑ 51,34€» καθόταν ακριβώς κάτω από το ίδιο 51,34€
        // του τίτλου: ο ίδιος αριθμός, δύο φορές, με απόσταση μιας ανάσας.
        //
        // Τώρα η σύνθεση γράφεται μία φορά, από τα ΙΔΙΑ τα δεδομένα και τα
        // πλακίδια εμφανίζονται μόνο όταν έχουν κάτι να σπάσουν.
        // ΟΙ ΣΥΝΔΡΟΜΕΣ ΕΙΝΑΙ ΗΔΗ ΜΕΣΑ ΣΤΟΥΣ ΛΟΓΑΡΙΑΣΜΟΥΣ. Το `FIXED_CATS` τις
        // περιέχει, άρα το `committedBills` τις έχει μετρήσει: γραμμένες και
        // χωριστά, τα σκέλη άθροιζαν παραπάνω από το ίδιο τους το σύνολο και η
        // πρόταση «πάγια, δόση δανείου και συνδρομές» υποσχόταν τρεις
        // προσθετέους που δεν προσθέτουν. Αφαιρούνται από τους λογαριασμούς
        // ώστε το άθροισμα των πλακιδίων να ΕΙΝΑΙ ο αριθμός από πάνω.
        const subsCost = actuals.subscriptions || 0;
        const parts = [
          // Η ΑΠΑΡΙΘΜΗΣΗ ΤΩΝ ΕΞΙ ΚΑΤΗΓΟΡΙΩΝ ΕΚΑΝΕ ΤΟ ΠΛΑΚΙΔΙΟ ΤΕΣΣΕΡΙΣ ΣΕΙΡΕΣ ΨΗΛΟ,
          // ΕΝΩ ΤΑ ΔΙΠΛΑΝΑ ΤΟΥ ΗΤΑΝ ΜΙΑ. Μετρημένο στην οθόνη του χρήστη: το πρώτο
          // από τα πέντε ξεκινούσε σαράντα εικονοστοιχεία ψηλότερα από τα άλλα
          // τέσσερα. Η λίστα απαντά «τι μετράει ως λογαριασμός», δηλαδή ορισμό:
          // πάει στο κυκλάκι, όπως κάθε ορισμός σε αυτή την εφαρμογή.
          // Η ΦΡΑΣΗ ΘΕΛΕΙ ΑΙΤΙΑΤΙΚΗ. Χτιζόταν από τις ετικέτες με πεζά και
          // έβγαινε «μετά από λογαριασμοί και δόση δανείου». Κάθε σκέλος
          // κρατά πλέον τη δική του μορφή για τη φράση (`acc`).
          { l: 'Κρατήσεις εσόδου', acc: 'κρατήσεις εσόδου', v: incomeDeductions, sub: 'προμήθεια, τέλος και φόρος',
            info: 'Προμήθεια πλατφόρμας, τέλος ανθεκτικότητας, διαχείριση και εκτίμηση φόρου. Η ανάλυση είναι στην κάρτα «Από μεικτό σε καθαρό».' },
          { l: 'Λογαριασμοί',  acc: 'λογαριασμούς',  v: committedBills - subsCost, sub: 'πάγια του μήνα',
            info: 'Ρεύμα, νερό, θέρμανση, τηλέφωνο, ασφάλεια και κοινόχρηστα.' },
          { l: 'Δόση δανείου', acc: 'δόση δανείου', v: loanMonthly,               sub: 'τοκοχρεολύσιο του μήνα' },
          { l: 'Συνδρομές',    acc: 'συνδρομές',    v: subsCost,                  sub: 'ό,τι χρεώνεται μόνο του' },
        ].filter(p => p.v !== 0);
        const listOf = (xs: string[]) => xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} και ${xs[xs.length - 1]}`;
        const composition = listOf(parts.map(p => p.acc));
        // Χωρίς έσοδα η σύνθεση στέκεται μόνη της, χωρίς πρόθεση: ονομαστική.
        const compositionNom = listOf(parts.map(p => p.l.toLowerCase()));
        return (
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.card, padding: 16, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div className="po-fig-card" tabIndex={0}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: T.font.sans }}>{hasIncome ? (isPro ? 'Διαθέσιμη ταμειακή ροή' : 'Διαθέσιμο μετά τις υποχρεώσεις') : 'Μηνιαίο κόστος ακινήτου'}</span>
                  {/* ΧΩΡΙΣ «ΑΣΦΑΛΕΙΑ» ΚΑΙ ΧΩΡΙΣ ΑΠΟΘΕΜΑΤΙΚΑ. Η εξήγηση υποσχόταν
                      αφαίρεση εισφορών σε αποθεματικά που δεν υπάρχουν πια και
                      «ποσό που μπορείς με ασφάλεια να αποσύρεις» για έναν αριθμό
                      που δεν ήξερε τον φόρο. Λέει πλέον ακριβώς τι αφαιρείται. */}
                  <InfoDot text={hasIncome
                    ? (waterfall
                      ? 'Έσοδα μετά την προμήθεια και την εκτίμηση φόρου, μείον λογαριασμούς και δόση δανείου. Ενδεικτικό.'
                      : 'Ενοίκιο του μήνα μείον λογαριασμούς και δόση δανείου, προ φόρου. Ενδεικτικό.')
                    : 'Το άθροισμα των πάγιων λογαριασμών του μήνα και της δόσης του δανείου. Δηλαδή τι σου κοστίζει το ακίνητο κάθε μήνα.'} />
                </div>
                <div className="po-fig" data-tone={hasIncome ? (safeRaw < 0 ? 'negative' : 'accent') : undefined} style={{ fontSize: 28, fontWeight: 700, fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums', lineHeight: 1, letterSpacing: '-0.02em', transition: 'color 0.15s' }}>{feSigned(val)}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 6, fontFamily: T.font.sans }}>
                  {hasIncome
                    ? (composition ? `μετά από ${composition}` : 'χωρίς δεσμευμένα έξοδα')
                    : (parts.length > 1 ? compositionNom : (parts[0]?.sub ?? ''))}
                </div>
              </div>
            </div>
            {/* ══════════════════════════════════════════════════════════════
                ΧΩΡΙΣ ΕΣΟΔΑ, ΤΟ ΚΟΥΤΙ ΕΙΧΕ ΕΝΑ ΝΟΥΜΕΡΟ ΚΑΙ ΤΡΙΑ ΤΕΤΑΡΤΑ ΚΕΝΟ.
                ────────────────────────────────────────────────────────────
                Η ανάλυση (μπάρα και σκέλη) εμφανιζόταν ΜΟΝΟ όταν είχε δηλωθεί
                εισόδημα, γιατί μοιράζει τα έσοδα. Ο ιδιοκτήτης που δεν έχει
                δηλώσει ενοίκιο έβλεπε «51,34€» και «λογαριασμοί και δόση» σε
                πλαίσιο εκατόν είκοσι εικονοστοιχείων: ένα νούμερο που δεν λέει
                ΑΠΟ ΤΙ βγήκε, σε χώρο που θα το χωρούσε τρεις φορές.

                Τα ίδια σκέλη υπάρχουν και χωρίς έσοδα — απλώς δεν αφαιρούνται
                από κάτι. Μπαίνουν ως πλακίδια και δίπλα τους η διαφορά από τον
                προηγούμενο μήνα: η μόνη σύγκριση που έχει νόημα όταν λείπει το
                εισόδημα, γιατί απαντά «ακρίβυνε ή έπεσε;».
                ══════════════════════════════════════════════════════════════ */}
            {!hasIncome && (() => {
              // ΟΜΟΙΑ ΜΕ ΟΜΟΙΑ. Το «Έναντι» αφαιρούσε από λογαριασμούς ΣΥΝ δόση
              // δανείου το σύνολο του προηγούμενου μήνα ΧΩΡΙΣ δόση: η δόση έμοιαζε
              // με αύξηση κόστους κάθε μήνα. Τώρα συγκρίνονται μόνο τα πάγια με
              // τα πάγια του προηγούμενου μήνα και η διαφορά γράφεται με πρόσημο.
              const prev  = FIXED_CATS.reduce((s, k) => s + (catMonth[_prevYm]?.[k] || 0), 0);
              const diff  = committedBills - prev;
              // ΤΟ «ΕΝΑΝΤΙ» ΘΕΛΕΙ ΓΕΝΙΚΗ ΚΑΙ Ο ΜΗΝΑΣ ΤΗΝ ΕΧΕΙ. Έγραφε «751,00€
              // τον Ιούλιος»: ονομαστική μετά από πρόθεση, από τα πιο ορατά λάθη
              // σε ελληνικό κείμενο. Η αιτιατική και η γενική υπάρχουν ήδη στο
              // lib/core/months.ts ακριβώς γι' αυτό — απλώς δεν είχαν κληθεί εδώ.
              // ΤΑ ΣΚΕΛΗ ΜΠΑΙΝΟΥΝ ΜΟΝΟ ΟΤΑΝ ΕΙΝΑΙ ΠΕΡΙΣΣΟΤΕΡΑ ΑΠΟ ΕΝΑ: με ένα
              // σκέλος, το πλακίδιο θα έγραφε ΤΟΝ ΙΔΙΟ αριθμό με την επικεφαλίδα
              // από πάνω του. Τότε όμως το κουτί έμενε με ένα μοναχικό πλακίδιο
              // σε πλάτος που χωρά τέσσερα — και ό,τι έλειπε δεν ήταν διάταξη,
              // ήταν πληροφορία.
              //
              // ΟΙ ΔΥΟ ΠΟΥ ΠΡΟΣΤΕΘΗΚΑΝ ΔΕΝ ΕΠΑΝΑΛΑΜΒΑΝΟΥΝ ΤΙΠΟΤΑ. Ο ετήσιος
              // ρυθμός είναι το νούμερο με το οποίο συγκρίνεις ένα ενοίκιο ή μια
              // ασφάλεια και το κόστος ανά τετραγωνικό είναι το μόνο που κάνει
              // δύο ακίνητα συγκρίσιμα. Κανένα από τα δύο δεν γράφεται αλλού.
              const tiles: { l: string; v: number; sub: string; info?: string; txt?: string }[] = [
                ...(parts.length > 1 ? parts : []),
                ...(monthlyCost > 0 ? [{ l: 'Τον χρόνο', v: monthlyCost * 12, sub: 'με τον ρυθμό του μήνα' }] : []),
                ...(monthlyCost > 0 && (propSqm || 0) > 0
                  ? [{ l: 'Ανά τετραγωνικό', v: monthlyCost / (propSqm as number), sub: `σε ${propSqm} τ.μ. τον μήνα` }] : []),
                ...(prev > 0 ? [{ l: `Λογαριασμοί έναντι ${monthGen(Number(_prevYm.slice(5, 7)) - 1)}`,
                  v: diff, txt: `${diff > 0 ? '+' : diff < 0 ? '−' : ''}${feAuto(Math.abs(diff))}`, sub: `από ${feAuto(prev)}` }] : []),
              ];
              if (tiles.length === 0) return null;
              // ΤΟ `style` ΣΒΗΝΕΙ ΟΛΟΚΛΗΡΟ ΤΟ `style` ΤΟΥ SPREAD ΚΑΙ ΤΟ ΕΣΒΗΝΕ.
              // Ο βοηθός `fixedCols` δίνει τις μεταβλητές των στηλών ΜΕΣΑ στο
              // `style`· γραμμένο σκέτο ένα `style={{ marginTop: 16 }}` από
              // δίπλα, τις έπαιρνε όλες μαζί του. Μετρημένο στα 430: το πλέγμα
              // δεν είχε καθόλου `--fc-sm`, έμενε σε δύο στήλες και πέντε
              // πλακίδια έβγαιναν 2+2+1, με το πέμπτο μισό και τρύπα δεξιά του.
              // Δεκατρία άλλα σημεία της εφαρμογής το γράφουν σωστά με άπλωμα·
              // αυτό ήταν το μόνο που το ξέχασε.
              //
              // ΚΑΙ ΤΟ ΤΑΒΑΝΙ ΤΩΝ ΤΕΣΣΑΡΩΝ ΕΦΤΙΑΧΝΕ ΟΡΦΑΝΟ. Με πέντε πλακίδια
              // και τέσσερις στήλες, το πέμπτο έμενε μόνο του με κενό όσο τρία
              // δεξιά του. Πέντε στήλες αφήνουν τον βοηθό να διαλέξει διαιρέτη
              // στα στενά: τρία και δύο στην ταμπλέτα, ένα ανά σειρά στο
              // τηλέφωνο. Καμία σειρά δεν τελειώνει με ένα.
              // ΤΟ ΠΛΑΚΙΔΙΟ ΗΤΑΝ ΓΡΑΜΜΕΝΟ ΜΕ ΤΟ ΧΕΡΙ, ΔΙΠΛΑ ΣΕ ΕΝΑ ΑΛΛΟ ΓΡΑΜΜΕΝΟ ΜΕ
              // ΤΟ ΧΕΡΙ. Η ίδια οθόνη είχε ΔΥΟ σειρές δεικτών με δύο διαφορετικά
              // πλακίδια και δύο διαφορετικά πλέγματα: εδώ `.kpi-card nested` μέσα
              // σε `fixedCols`, εκατόν πενήντα γραμμές πιο κάτω το `KPI` του
              // LoanShared μέσα σε `auto-fit minmax(128px)`. Διαφορετικό ύψος,
              // διαφορετικό μέγεθος αριθμού, διαφορετικά σπασίματα.
              //
              // Και οι δύο περνούν πλέον από το κοινό `KPIGrid`, στην ένθετη
              // εκδοχή του: ίδιο κουτί, ίδιος κανόνας στηλών σε τέσσερα σκαλιά,
              // ίδια κλιμάκωση αριθμού, ίδιο ύψος — το πλέγμα τεντώνει τα κελιά
              // του, οπότε τα πλακίδια είναι ΑΚΡΙΒΩΣ ίδια όσο κι αν διαφέρει το
              // κείμενό τους.
              return (
                <div style={{ marginTop: 16 }}>
                  <KPIGrid nested items={tiles.map(t => ({ label: t.l, value: t.txt ?? feAuto(t.v), sub: t.sub, title: t.info }))} />
                </div>
              );
            })()}
            {hasIncome && (
              <>
                <div style={{ display: 'flex', height: 8, borderRadius: T.radius.xs, overflow: 'hidden', marginTop: 16, marginBottom: 10, background: 'var(--bg-overlay)' }}>
                  {incomeDeductions > 0 && <div title="Κρατήσεις εσόδου" style={{ width: `${seg(incomeDeductions)}%`, background: 'color-mix(in srgb, var(--text-primary) 44%, transparent)' }}/>}
                  <div title="Λογαριασμοί" style={{ width: `${seg(committedBills)}%`, background: 'color-mix(in srgb, var(--text-primary) 32%, transparent)' }}/>
                  <div title="Δόση δανείου" style={{ width: `${seg(loanMonthly)}%`, background: 'color-mix(in srgb, var(--text-primary) 20%, transparent)' }}/>
                  <div title="Διαθέσιμο" style={{ flex: 1, background: safeRaw < 0 ? 'var(--negative)' : 'var(--accent)' }}/>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', fontFamily: T.font.sans }}>
                  {[
                    { l: 'Έσοδα', v: income },
                    { l: 'Κρατήσεις εσόδου', v: -incomeDeductions },
                    { l: 'Λογαριασμοί', v: -committedBills },
                    { l: 'Δόση δανείου', v: -loanMonthly },
                    { l: 'Διαθέσιμο', v: safeRaw },
                  ].filter(x => x.v !== 0).map(x => (
                    <span key={x.l} style={{ fontVariantNumeric: 'tabular-nums' }}>{x.l} <strong style={{ color: 'var(--text-primary)', fontFamily: T.font.num }}>{feSigned(x.v)}</strong></span>
                  ))}
                </div>
                {isShortfall && (
                  <div style={{ marginTop: 12, fontSize: 12, color: 'var(--negative)', fontFamily: T.font.sans }}>Οι υποχρεώσεις του μήνα ξεπερνούν τα έσοδα κατά {feAuto(-safeRaw)}.</div>
                )}
              </>
            )}
          </div>
        );
      })()}

      {/* Έσοδα / rent-roll — αναμενόμενα ή πραγματικά έσοδα ακινήτου (προσαρμόζεται στον τύπο μίσθωσης) */}
      {isCurMonth && income > 0 && (() => {
        const isSTRmode = rentalMode === 'short_term';
        const netFlow = safeRaw;
        return (
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.card, padding: 16, marginBottom: 12 }}>
            {/* Ο ΤΙΤΛΟΣ ΛΕΕΙ ΤΟ ΙΔΙΟ ΜΕ ΤΑ ΠΛΑΚΙΔΙΑ ΑΠΟ ΚΑΤΩ. Έλεγε «Έσοδα» και στους
                δύο τρόπους, πάνω από τρία διαφορετικά πράγματα: εισπράξεις από
                διαμονές, αναμενόμενο ενοίκιο και καθαρή ροή. Η λέξη «έσοδα» έχει
                φορολογικό νόημα και δεν είναι κανένα από τα τρία. */}
            {secHdr(isSTRmode ? 'Εισπράξεις' : 'Ενοίκιο', 'income', undefined,
              <InfoDot text={isSTRmode
                ? 'Ό,τι μπήκε στο ταμείο από τα καταλύματα: του μήνα, από την αρχή του έτους, διανυκτερεύσεις και μέση τιμή ανά βραδιά. Το ΔΗΛΩΤΕΟ ποσό είναι μεγαλύτερο, γιατί περιλαμβάνει την προμήθεια της πλατφόρμας: το βλέπεις στη Λογιστική ως «Μεικτά έσοδα».'
                : 'Αναμενόμενο ενοίκιο από τους ενεργούς μισθωτές: μηνιαίο, ετήσιο και η καθαρή ροή μετά τα μηνιαία κόστη. Είναι πρόβλεψη, όχι καταγεγραμμένες εισπράξεις· αυτές ζουν στους Μισθωτές και στη Λογιστική.'} />)}
            {!collapsed.has('income') && (
              <KPIGrid nested items={isSTRmode ? [
                /* ΕΙΣΠΡΑΞΕΙΣ, ΟΧΙ ΕΣΟΔΑ: εδώ αθροίζεται ό,τι μπήκε στο ταμείο από
                   τις διαμονές. Το ΔΗΛΩΤΕΟ ποσό είναι μεγαλύτερο, γιατί περιλαμβάνει
                   την προμήθεια της πλατφόρμας — και το λέει η Λογιστική, ως «Μεικτά
                   έσοδα». Δύο σωστά νούμερα για την ίδια διαμονή· η λέξη ξεχωρίζει
                   ποιο είναι ποιο. */
                { label: 'Εισπράξεις μήνα', value: feAuto(income), title: 'Ό,τι μπήκε στο ταμείο από διαμονές αυτόν τον μήνα. Το δηλωτέο ποσό είναι μεγαλύτερο: το βλέπεις στη Λογιστική ως «Μεικτά έσοδα».' },
                { label: 'Από την αρχή έτους', value: feAuto(incomeYtd), title: 'Εισπράξεις από διαμονές, από 1η Ιανουαρίου.' },
                { label: 'Διανυκτερεύσεις', value: String(strNights) },
                { label: 'Μέση τιμή ανά βραδιά', value: strNights > 0 ? feAuto(income / strNights) : fe(0) },
              ] : [
                { label: 'Μηνιαίο ενοίκιο', value: feAuto(income) },
                { label: 'Ετησίως', value: feAuto(income * 12) },
                { label: 'Αναμενόμενα φέτος', value: feAuto(incomeYtd), title: 'Μηνιαίο ενοίκιο × μήνες που πέρασαν φέτος (αναμενόμενα, όχι καταγεγραμμένες εισπράξεις).' },
                { label: 'Καθαρή ροή', value: feSigned(netFlow), title: 'Αναμενόμενο ενοίκιο μείον λογαριασμούς και δόση δανείου, προ φόρου. Πρόβλεψη, όχι εισπράξεις.' },
              ]}/>
            )}
          </div>
        );
      })()}

      {/* Waterfall εσόδου βραχυχρόνιας — από μεικτό σε καθαρό (μόνο short_term) */}
      {isCurMonth && isSTR && waterfall && (() => {
        const rows = [
          { l: 'Μεικτό έσοδο', v: waterfall.gross, sub: false },
          { l: 'Προμήθεια πλατφόρμας', v: -waterfall.platformFee, sub: true },
          ...(waterfall.climateFee != null ? [{ l: 'Τέλος ανθεκτικότητας', v: -waterfall.climateFee, sub: true }] : []),
          ...(waterfall.management > 0 ? [{ l: 'Διαχείριση', v: -waterfall.management, sub: true }] : []),
          { l: 'Κράτηση φόρου (εκτίμηση)', v: -waterfall.taxReserve, sub: true },
        ];
        return (
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.card, padding: 16, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: T.font.sans }}>Από μεικτό σε καθαρό</span>
              <InfoDot text="Ανάλυση του εσόδου βραχυχρόνιας μίσθωσης του μήνα: αφαιρούνται η προμήθεια της πλατφόρμας, το τέλος ανθεκτικότητας (ανά διανυκτέρευση), η τυχόν διαχείριση και η εκτιμώμενη κράτηση φόρου, για να δεις τι μένει πραγματικά. Πρόκειται για εκτίμηση· μπορείς να προσαρμόσεις τις παραδοχές στην επεξεργασία." />
              <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{strNights} διαν.</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rows.map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 'var(--fs-base)', fontFamily: T.font.sans, color: r.sub ? 'var(--text-secondary)' : 'var(--text-primary)', fontWeight: r.sub ? 400 : 600 }}>
                  <span>{r.l}</span>
                  <span style={{ fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums', color: r.v < 0 ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>{feSigned(r.v)}</span>
                </div>
              ))}
              {/* ΤΟ ΤΕΛΟΣ ΟΦΕΙΛΕΤΑΙ ΑΝΑ ΔΙΑΝΥΚΤΕΡΕΥΣΗ. Κρατήσεις με ποσό και
                  χωρίς νύχτες έδιναν «0,00€», σαν να μην οφείλεται τίποτα. Χωρίς
                  νύχτες το ποσό είναι άγνωστο και το καθαρό το λέει. */}
              {waterfall.climateFee == null && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, fontSize: 'var(--fs-base)', fontFamily: T.font.sans, color: 'var(--text-secondary)' }}>
                  <span>Τέλος ανθεκτικότητας</span>
                  <span style={{ color: 'var(--text-tertiary)', textAlign: 'right' }}>άγνωστο, λείπουν διανυκτερεύσεις</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', fontFamily: T.font.sans }}>{waterfall.climateFee == null ? 'Καθαρό (χωρίς το τέλος)' : 'Καθαρό'}</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums' }}>{feSigned(waterfall.net)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginTop: 12, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: T.font.sans }}>
              {waterfall.netPerNight != null
                ? <span>Καθαρό / διανυκτέρευση <strong style={{ color: 'var(--text-secondary)', fontFamily: T.font.num }}>{feSigned(waterfall.netPerNight)}</strong></span>
                : <span>Καθαρό / διανυκτέρευση: συμπλήρωσε τις διανυκτερεύσεις στις κρατήσεις</span>}
              <span>Περιθώριο <strong style={{ color: 'var(--text-secondary)', fontFamily: T.font.num }}>{fpSigned(waterfall.marginPct)}</strong></span>
            </div>
            {/* Παραδοχές — επιτόπου επεξεργασία (κλικ στο ποσοστό) */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-subtle)', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: T.font.sans }}>
              <span>Προμήθεια πλατφόρμας <InfoDot text="Το ποσοστό προμήθειας της πλατφόρμας κράτησης (π.χ. Airbnb, Booking) επί του μεικτού εσόδου." /> <InlineNumber raw={budgets.strPlatformPct ?? '15'} display={`${fn(strPlatformPct, 0)}%`} onCommit={v => updateBudget('strPlatformPct', v)} width={44} ariaLabel="Προμήθεια πλατφόρμας %" /></span>
              <span>Διαχείριση <InlineNumber raw={budgets.strMgmtPct ?? '0'} display={`${fn(strMgmtPct, 0)}%`} onCommit={v => updateBudget('strMgmtPct', v)} width={44} ariaLabel="Διαχείριση %" /></span>
              <span>Συντελεστής φόρου <InlineNumber raw={budgets.strTaxPct ?? String(taxPctAuto ?? 15)} display={`${fn(strTaxPct, 0)}%`} onCommit={v => updateBudget('strTaxPct', v)} width={44} ariaLabel="Συντελεστής φόρου %" /></span>
            </div>
          </div>
        );
      })()}

      {displayOver.length > 0 && (
        <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {displayOver.map(cat => {
            const budget = catBudget(cat.key);
            const actual = viewActuals[cat.key] || 0;
            return (
              <div key={cat.key} className="po-fig-card" tabIndex={0} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: T.radius.inner, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: T.font.sans }}>{cat.label}</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>υπέρβαση</span>
                <span className="po-fig" data-tone="negative" style={{ fontSize: 12, fontWeight: 700, fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums' }}>+{feAuto(actual - budget)}</span>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: T.font.sans }}>({feAuto(actual)} έναντι {feAuto(budget)})</span>
              </div>
            );
          })}
          {notifyOn && isCurMonth && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: T.font.sans, paddingLeft: 2 }}>
              <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
              Θα λάβεις υπενθύμιση μέσω email και στο Ημερολόγιο.
            </div>
          )}
        </div>
      )}

      {/* Προβλεπόμενη υπέρβαση — με τον τρέχοντα ρυθμό (προειδοποίηση, όχι ήδη υπέρβαση) */}
      {isCurMonth && projectedOver.length > 0 && (
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: T.radius.inner, padding: '10px 16px' }}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M23 6l-9.5 9.5-5-5L1 18"/><polyline points="17 6 23 6 23 12"/></svg>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: T.font.sans, lineHeight: 1.5 }}>
            Με τον τρέχοντα ρυθμό, θα ξεπεραστεί ο στόχος σε: <strong style={{ color: 'var(--text-primary)' }}>{projectedOver.map(c => c.label).join(', ')}</strong>
          </span>
        </div>
      )}

      {/* Όριο 3+ βραχυχρόνιων (ΜΟΝΟ ιδιώτης) — νομικό κατώφλι επιχειρηματικής δραστηριότητας */}
      {!isPro && strPropCount >= 3 && (
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: T.radius.inner, padding: '10px 16px' }}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: T.font.sans, lineHeight: 1.5 }}>
            Έχεις <strong style={{ color: 'var(--text-primary)' }}>{strPropCount} βραχυχρόνια ακίνητα</strong>. Από 3 και πάνω, η δραστηριότητα θεωρείται επιχειρηματική και προκύπτουν υποχρεώσεις ΦΠΑ, ΕΦΚΑ και προκαταβολής φόρου. Συμβουλέψου τη Λογιστική και τον λογιστή σου.
          </span>
        </div>
      )}

      {/* Ο μήνας — μετρικές + πρόοδος σε ΕΝΑ πλαίσιο (χωρίς διπλότυπη κάρτα «Σύνολο») */}
      <div className="po-fig-card" tabIndex={0} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.card, padding: 16, marginBottom: 12 }}>
        {/* Η ΔΕΥΤΕΡΗ ΣΕΙΡΑ ΔΕΙΚΤΩΝ ΤΗΣ ΙΔΙΑΣ ΟΘΟΝΗΣ ΕΙΧΕ ΑΛΛΟ ΠΛΑΚΙΔΙΟ ΚΑΙ ΑΛΛΟ
            ΠΛΕΓΜΑ. Πάνω της, τα σκέλη του μηνιαίου κόστους ήταν `.kpi-card nested`
            σε `fixedCols`· εδώ το `KPI` του LoanShared σε `auto-fit minmax(128px)`.
            Δύο συστήματα καρτών, δύο ύψη, δύο μεγέθη αριθμού, εκατόν πενήντα
            γραμμές απόσταση. Το κοινό `KPIGrid` τα κάνει ένα. */}
        <KPIGrid nested items={[
          { label: 'Στόχος τον μήνα', value: feAuto(masterBudget) },
          // ΔΥΟ ΚΑΡΤΕΛΕΣ, ΔΥΟ ΠΟΣΑ ΓΙΑ ΤΟΝ ΙΔΙΟ ΜΗΝΑ. Οι Δαπάνες γράφουν μόνο τα
          // καταχωρημένα, εδώ μετρούν και οι εκτιμήσεις παρόχων. Όταν υπάρχουν,
          // το πλακίδιο το λέει και δείχνει από κάτω το ποσό των Δαπανών.
          isCurMonth && viewActualTotal - viewRecordedTotal > 0.005
            ? { label: 'Με εκτιμήσεις παρόχων', value: feAuto(viewActualTotal), sub: `καταχωρημένα ${feAuto(viewRecordedTotal)}`, title: 'Καταχωρημένα του μήνα συν εκτιμήσεις παρόχων για πάγιες κατηγορίες που δεν έχουν χρεωθεί ακόμη.' }
            : { label: isCurMonth ? 'Καταχωρημένα' : 'Σύνολο μήνα', value: feAuto(viewActualTotal), title: isCurMonth ? 'Λογαριασμοί και δαπάνες του μήνα, πληρωμένα και απλήρωτα.' : 'Καταγεγραμμένες δαπάνες αυτού του μήνα από το ιστορικό.' },
          // Η ΠΡΟΒΛΕΨΗ ΜΠΑΙΝΕΙ ΜΟΝΟ ΟΤΑΝ ΛΕΕΙ ΚΑΤΙ ΑΛΛΟ. Όταν ο μήνας έχει μόνο
          // πάγια, η πρόβλεψη είναι το ίδιο ποσό με το διπλανό πλακίδιο: δύο
          // «70,08€» δίπλα δίπλα, με δύο ονόματα.
          ...(isCurMonth
            ? (Math.abs(forecastTotal - viewActualTotal) > 0.005 ? [{ label: 'Πρόβλεψη μήνα', value: feAuto(forecastTotal) }] : [])
            : [{ label: 'Έναντι στόχου', value: `${viewActualTotal <= masterBudget ? '−' : '+'}${feAuto(Math.abs(masterBudget - viewActualTotal))}` }]),
          // «ΜΕΝΕΙ ΑΠΟ ΤΟΝ ΣΤΟΧΟ», ΟΧΙ «ΔΙΑΘΕΣΙΜΟ». Η πρώτη κάρτα λέει ήδη
          // «Διαθέσιμο» για έσοδα μείον υποχρεώσεις· εδώ είναι στόχος μείον
          // δαπάνες. Ίδια λέξη, δύο ποσά, πεντακόσια εικονοστοιχεία απόσταση.
          { label: 'Μένει από τον στόχο', value: feAuto(Math.max(0, masterBudget - viewActualTotal)) },
        ]}/>
        {(() => {
          const pct    = masterBudget > 0 ? Math.min((viewActualTotal / masterBudget) * 100, 100) : 0;
          const isOver = viewActualTotal > masterBudget;
          const col    = isOver ? 'var(--negative)' : 'color-mix(in srgb, var(--text-primary) 34%, transparent)';
          return (
            <>
              <div style={{ height: 6, background: 'var(--bg-overlay)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ height: '100%', width: `${pct}%`, background: col, borderRadius: 3, transition: 'width 0.6s ease' }}/>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: T.font.sans }}>
                {/* Η ΡΑΒΔΟΣ ΜΕΤΡΑ ΚΑΙ ΤΙΣ ΕΚΤΙΜΗΣΕΙΣ ΚΑΙ ΤΟ ΛΕΕΙ. Έγραφε «χρησιμοποιήθηκε»
                    για ποσό που περιείχε λογαριασμούς που δεν έχουν έρθει ακόμη. */}
                <span style={{ color: 'var(--text-tertiary)', fontWeight: 700 }}>{fp(pct)} του στόχου{isCurMonth && viewActualTotal - viewRecordedTotal > 0.005 ? ', με τις εκτιμήσεις' : ''}</span>
                {/* Το «Μένει» φαίνεται ήδη στο πλακίδιο δίπλα, εδώ μόνο η υπέρβαση. */}
                <span className="po-fig" data-tone={isOver ? 'negative' : undefined}>{isOver ? `Υπέρβαση ${feAuto(viewActualTotal - masterBudget)}` : ''}</span>
              </div>
              {isCurMonth && rolloverOn && hasPrevMonth && carryIn !== 0 && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-subtle)', fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', fontFamily: T.font.sans }}>
                  Μεταφορά από τον {_prevLabel}: <strong className="po-fig" data-tone={carryIn > 0 ? undefined : 'negative'} style={{ fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums' }}>{carryIn > 0 ? '+' : ''}{feAuto(carryIn)}</strong>
                  {' · '}πραγματικά διαθέσιμα <strong className="po-fig" data-tone={adjAvailable < 0 ? 'negative' : undefined} style={{ fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums' }}>{feAuto(adjAvailable)}</strong>
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* Απόδοση επένδυσης — ΜΟΝΟ επαγγελματίας (NOI/cap rate/cash-on-cash), δίπλα στα βασικά νούμερα */}
      {isPro && invReturns && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.card, padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: T.font.sans }}>Απόδοση επένδυσης</span>
            <InfoDot text={`Καθαρό προ δόσης (καθαρό λειτουργικό έσοδο): έσοδα μείον λειτουργικές δαπάνες, χωρίς τη δόση. Ταμειακή ροή: αυτό μείον τη δόση. Απόδοση επί ${invReturns.onPurchase ? 'τιμής αγοράς' : 'αξίας'}: καθαρό προ δόσης / ${invReturns.onPurchase ? 'τιμή αγοράς' : 'αξία'}. Απόδοση ιδίων κεφαλαίων: ταμειακή ροή / ίδια κεφάλαια, όπου ίδια κεφάλαια = τιμή αγοράς μείον αρχικό δάνειο. Ενδεικτικά, σε ετήσια βάση.`} />
          </div>
          <KPIGrid nested items={[
            // ΜΙΑ ΓΡΑΜΜΗ ΣΤΑ 390, ΟΠΩΣ Η ΓΕΙΤΟΝΙΚΗ. Το «Καθαρό λειτουργικό έσοδο / έτος»
            // έπιανε δύο και το ποσό του έπεφτε χαμηλότερα από της «Ταμειακής ροής».
            // Ο όρος μένει ολόκληρος στην επεξήγηση, το «ετήσια» επίσης.
            { label: 'Καθαρό προ δόσης', value: feSigned(invReturns.noi) },
            { label: 'Ταμειακή ροή', value: feSigned(invReturns.preTaxCashFlow) },
            { label: invReturns.onPurchase ? 'Απόδοση επί τιμής αγοράς' : 'Απόδοση επί αξίας', value: fpSigned(invReturns.capRatePct) },
            invReturns.cashOnCashPct != null
              ? { label: 'Απόδοση ιδίων κεφαλαίων', value: fpSigned(invReturns.cashOnCashPct) }
              : { label: 'Απόδοση ιδίων κεφαλαίων', value: ABSENT_SHORT, sub: 'χρειάζεται τιμή αγοράς και προκαταβολή' },
          ]}/>
        </div>
      )}

      {/* Προτάσεις — προδραστικές, actionable (εφαρμογή με ένα άγγιγμα) */}
      {isCurMonth && targetSuggestions.length > 0 && (
        <div className="budget-rise" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-accent)', borderRadius: T.radius.card, padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid var(--border-subtle)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>
            <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: T.font.sans }}>Προτάσεις</span>
            <InfoDot text="Προτάσεις που προκύπτουν από το πραγματικό μοτίβο των δαπανών σου. Εφαρμόζεις με ένα άγγιγμα (με δυνατότητα αναίρεσης) ή τις απορρίπτεις για να μην ξαναεμφανιστούν." />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {targetSuggestions.map(s => (
              <div key={s.key} className="po-stack-sm" style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ fontSize: 'var(--fs-base)', lineHeight: 1.5, color: 'var(--text-secondary)', fontFamily: T.font.sans }}>{s.text}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {/* Δευτερεύον: ίδιο σχήμα με το «Δείξε μου», απόχρωση τονισμού με
                      περίγραμμα. Το ύψος 28 ανεβαίνει στο κοινό ύψος κουμπιού. */}
                  <Btn variant="secondary" onClick={s.apply}>
                    {s.cta}
                  </Btn>
                  <IconBtn onClick={() => dismissSuggestion(s.key)} label="Απόρριψη" title="Απόρριψη">
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </IconBtn>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Παρατηρήσεις — 2–3 έξυπνες προτάσεις πάνω από τα γραφήματα */}
      {isCurMonth && insights.length > 0 && (
        <div className="budget-rise" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.card, padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid var(--border-subtle)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2Z"/></svg>
            <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: T.font.sans }}>Παρατηρήσεις</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {insights.map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'color-mix(in srgb, var(--text-primary) 40%, transparent)', flexShrink: 0, marginTop: 8 }} />
                <span style={{ fontSize: 'var(--fs-base)', lineHeight: 1.5, color: 'var(--text-secondary)', fontFamily: T.font.sans }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ετήσια εικόνα — YTD και προβολή τέλους έτους από καταγεγραμμένες εγγραφές */}
      {(() => {
        const ytdPct = annual.ytdBudget > 0 ? Math.min((annual.ytdActual / annual.ytdBudget) * 100, 100) : 0;
        const ytdOver = annual.ytdActual > annual.ytdBudget;
        const ytdCol = ytdOver ? 'var(--negative)' : 'color-mix(in srgb, var(--text-primary) 34%, transparent)';
        const shut = collapsed.has('annual');
        const hasAnnualData = annual.ytdActual > 0 || Object.keys(monthTotals).length > 0;
        return (
          <div className="po-fig-card" tabIndex={0} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.card, padding: 16, marginBottom: 12 }}>
            {secHdr('Ετήσια εικόνα', 'annual')}
            {!shut && !hasAnnualData && (
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: T.font.sans, lineHeight: 1.6 }}>
                Μόλις καταγραφούν οι πρώτες δαπάνες, εδώ θα εμφανίζεται η προβολή τέλους έτους, η πορεία από την αρχή του έτους και η κατανομή ανά κατηγορία.
              </div>
            )}
            {!shut && hasAnnualData && (
              <>
                {/* Προβολή τέλους έτους — κύριος αριθμός */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                  <span className="po-fig" data-tone={annual.onTrack ? undefined : 'negative'} style={{ fontSize: 24, fontWeight: 700, fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums', lineHeight: 1, letterSpacing: '-0.02em' }}>{feAuto(annual.projectedYearEnd)}</span>
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: T.font.sans }}>προβολή τέλους έτους · στόχος <span style={{ fontFamily: T.font.num }}>{feAuto(annual.annualBudget)}</span></span>
                  <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-xs)', fontWeight: 700, padding: '3px 10px', borderRadius: T.radius.pill, fontFamily: T.font.sans, color: annual.onTrack ? 'var(--text-secondary)' : 'var(--negative)', background: annual.onTrack ? 'var(--bg-elevated)' : 'var(--negative-dim)', border: `1px solid ${annual.onTrack ? 'var(--border-subtle)' : 'var(--negative-border)'}` }}>{annual.onTrack ? 'Εντός στόχου' : 'Εκτός στόχου'}</span>
                </div>
                {/* YTD — από την αρχή του έτους */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', fontFamily: T.font.sans }}>
                  <span>Από την αρχή του έτους</span>
                  <span style={{ fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>{feAuto(annual.ytdActual)} <span style={{ color: 'var(--text-tertiary)' }}>/ {feAuto(annual.ytdBudget)}</span></span>
                </div>
                <div style={{ height: 8, background: 'var(--bg-overlay)', borderRadius: T.radius.xs, overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ height: '100%', width: `${ytdPct}%`, background: ytdCol, borderRadius: T.radius.xs, transition: 'width 0.6s ease' }}/>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: T.font.sans }}>
                  <span className="po-fig" data-tone={annual.variance > 0 ? 'negative' : undefined}>{annual.variance > 0 ? `Υπέρβαση ${feAuto(annual.variance)} έναντι στόχου` : `Εντός στόχου κατά ${feAuto(-annual.variance)}`}</span>
                  {/* Η ΤΑΣΗ ΤΟΥ ΤΡΙΜΗΝΟΥ ΔΕΝ ΕΙΝΑΙ ΕΤΗΣΙΑ ΕΙΚΟΝΑ ΚΑΙ ΓΡΑΦΟΤΑΝ ΗΔΗ.
                      Καθόταν στο δεξί άκρο μιας κάρτας που μιλά για ΤΟ ΕΤΟΣ («προβολή
                      τέλους έτους», «από την αρχή του έτους», «έξοδα ανά μήνα») και
                      έλεγε «−91% έναντι τριμήνου». Το ίδιο γεγονός το γράφει ήδη με
                      λέξεις η παρατήρηση από πάνω: «ο μήνας τρέχει 91% κάτω από τον
                      μέσο όρο του τριμήνου». Δύο φορές το ίδιο, σε δύο κάρτες, σε δύο
                      μορφές — και η μία από τις δύο εκτός θέματος. */}
                </div>
                {/* Ετήσιο εργαλείο: ράβδοι εξόδων ανά μήνα (με ήπια κατάσταση όταν δεν υπάρχει ιστορικό) */}
                <div style={{ marginTop: T.sp.lg, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, fontFamily: T.font.sans }}>Έξοδα ανά μήνα</div>
                  {yearBars.some(b => b.value > 0)
                    ? <MonthBars data={yearBars} activeYm={_curYm} />
                    : <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: T.font.sans, padding: '14px 0' }}>Μόλις καταγραφούν έξοδα, θα δεις εδώ την πορεία ανά μήνα.</div>}
                </div>
                {/* Ετήσιο εργαλείο: κατανομή δαπανών ανά κατηγορία */}
                {catYtd.length > 0 && (
                  <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, fontFamily: T.font.sans }}>Κατανομή ανά κατηγορία</div>
                    <Donut slices={catYtd} />
                  </div>
                )}
              </>
            )}
          </div>
        );
      })()}

      {/* Εβδομαδιαίο εργαλείο — δαπάνες αυτής της εβδομάδας ανά κατηγορία (μόνο τρέχων μήνας) */}
      {isCurMonth && weekTotalV > 0 && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.card, padding: 16, marginBottom: 12 }}>
          {secHdr('Αυτή την εβδομάδα', 'week', <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums' }}>{feAuto(weekTotalV)}</span>)}
          {!collapsed.has('week') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {weekCats.map(c => {
                const on = hoverWeek === c.label;
                return (
                <div key={c.label} onMouseEnter={() => setHoverWeek(c.label)} onMouseLeave={() => setHoverWeek(null)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 6px', margin: '0 -6px', borderRadius: T.radius.inner, background: on ? 'var(--bg-elevated)' : 'transparent', transition: 'background 0.15s' }}>
                  <span style={{ width: 120, flexShrink: 0, fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', fontFamily: T.font.sans, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</span>
                  <div style={{ flex: 1, height: 8, background: 'var(--bg-overlay)', borderRadius: T.radius.xs, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(c.value / weekMax) * 100}%`, background: `color-mix(in srgb, var(--accent) ${on ? 100 : 66}%, transparent)`, borderRadius: T.radius.xs, transition: 'width 0.5s ease, background 0.18s' }} />
                  </div>
                  <span style={{ minWidth: 62, textAlign: 'right', flexShrink: 0, fontSize: 'var(--fs-base)', fontWeight: 700, fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums', color: on ? 'var(--accent)' : 'var(--text-primary)', transition: 'color 0.15s' }}>{feAuto(c.value)}</span>
                </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Επιχειρηματικές υποχρεώσεις — ΜΟΝΟ επαγγελματίας (δεν αφορούν ιδιώτες) */}
      {/* ΙΔΙΟ ΣΧΗΜΑ, ΙΔΙΑ ΣΥΜΠΕΡΙΦΟΡΑ. Καθόταν ανάμεσα σε αναδιπλούμενες κάρτες
          ως στατική κάρτα με παράγραφο και χωρίς βελάκι· τώρα αναδιπλώνεται
          όπως οι γειτονικές της. */}
      {isPro && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.card, padding: 16, marginBottom: 12 }}>
          {secHdr('Επιχειρηματικές υποχρεώσεις', 'business')}
          {!collapsed.has('business') && (
          <span style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', fontFamily: T.font.sans, lineHeight: 1.55 }}>
            Εκτός από τον φόρο εισοδήματος, ως επιχείρηση βαρύνεσαι με τις μηνιαίες εισφορές <strong style={{ color: 'var(--text-secondary)' }}>ΕΦΚΑ</strong>, την <strong style={{ color: 'var(--text-secondary)' }}>προκαταβολή φόρου</strong> για την επόμενη χρήση και, εφόσον παρέχεις υπηρεσίες, τον <strong style={{ color: 'var(--text-secondary)' }}>ΦΠΑ</strong>. Τα ακριβή ποσά υπολογίζονται στη Λογιστική.
          </span>
          )}
        </div>
      )}

      {/* Επαναλαμβανόμενες χρεώσεις / συνδρομές — ανάλυση 12μηνου ιστορικού δαπανών */}
      {recurring.length > 0 && (() => {
        const monthlyTotal = recurring.reduce((s, r) => s + r.monthlyEquivalent, 0);
        const annualTotal  = recurring.reduce((s, r) => s + r.annualCost, 0);
        const cadLabel = (c: RecurringCharge['cadence']) => c === 'monthly' ? 'μηνιαία' : c === 'bimonthly' ? 'διμηνιαία' : c === 'quarterly' ? 'τριμηνιαία' : c === 'yearly' ? 'ετήσια' : 'ακανόνιστη';
        return (
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.card, padding: 16, marginBottom: 12 }}>
            {/* ΜΕ ΜΙΑ ΧΡΕΩΣΗ, ΤΟ ΑΘΡΟΙΣΜΑ ΕΙΝΑΙ Η ΧΡΕΩΣΗ. Η κεφαλίδα έγραφε τον
                μηνιαίο ισοδύναμο και το ετήσιο κόστος· η μοναδική γραμμή από
                κάτω τα ίδια δύο νούμερα, με την ίδια σειρά και τις ίδιες μονάδες,
                σε απόσταση σαράντα εικονοστοιχείων. Ενα σύνολο υπάρχει για να
                αθροίζει: χρειάζεται δύο προσθετέους για να πει κάτι. Ο ίδιος
                κανόνας ισχύει ήδη για τον μέσο όρο του δωδεκαμήνου στη σύγκριση
                δαπανών. */}
            {secHdr('Επαναλαμβανόμενες χρεώσεις', 'recurring',
              recurring.length > 1
                ? <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums' }}>{feAuto(monthlyTotal)}/μήνα · {feAuto(annualTotal)}/έτος</span>
                : undefined,
              <InfoDot text="Συνδρομές και πάγιες χρεώσεις που εντοπίζονται αυτόματα από τις καταγεγραμμένες δαπάνες σου, όταν ο ίδιος πάροχος επαναλαμβάνεται σε πολλούς μήνες. Δείχνει συχνότητα, τυπικό ποσό και ετήσιο κόστος, ώστε να εντοπίζεις εύκολα τις «κρυφές» συνδρομές." />)}
            {!collapsed.has('recurring') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {recurring.slice(0, 10).map(r => {
                  const hov = hoverRec === r.key;
                  return (
                    <div key={r.key} onMouseEnter={() => setHoverRec(r.key)} onMouseLeave={() => setHoverRec(null)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px', margin: '0 -8px', borderRadius: T.radius.inner, background: hov ? 'var(--bg-elevated)' : 'transparent', transition: 'background 0.15s' }}>
                      <div style={{ width: 3, height: 26, borderRadius: 3, background: 'color-mix(in srgb, var(--text-primary) 26%, transparent)', flexShrink: 0 }} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', fontFamily: T.font.sans, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</div>
                        <div className="po-subline" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: T.font.sans }}>{cadLabel(r.cadence)} · επόμενη {parseLocalDate(r.nextExpected).toLocaleDateString('el-GR', { day: 'numeric', month: 'short' })}</div>
                      </div>
                      <div style={{ textAlign: 'right', fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums' }}>
                        <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: hov ? 'var(--accent)' : 'var(--text-primary)', transition: 'color 0.15s' }}>{feAuto(r.monthlyEquivalent)}<span style={{ fontSize: 'var(--fs-xs)', fontWeight: 500, color: 'var(--text-tertiary)' }}>/μήνα</span></div>
                        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{feAuto(r.annualCost)}/έτος</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.card, padding: 16, marginBottom: 12 }}>
        {secHdr('Ανά Κατηγορία', 'cats', undefined,
          <InfoDot text="Κάθε κατηγορία δείχνει τι έχεις ξοδέψει έναντι του στόχου. Κάνε κλικ στον στόχο για να τον αλλάξεις επιτόπου, ή στο όνομα για μετονομασία. Οι στόχοι αποθηκεύονται αυτόματα." />)}
        {!(collapsed.has('cats')) &&
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {activeCats.map(cat => {
            const budget  = catBudget(cat.key);
            const actual  = viewActuals[cat.key] || 0;
            const pct     = budget > 0 ? Math.min((actual / budget) * 100, 100) : 0;
            const isOver  = actual > budget && actual > 0;
            const projOver = isCurMonth && !isOver && categoryStatus(budget, actual, catForecast(cat.key)) === 'projected_over';
            const isWarn  = !isOver && !projOver && pct > 80;
            // Ομοιόμορφες, μονόχρωμες ράβδοι για ΟΛΕΣ τις κατηγορίες — καμία κόκκινη
            // ράβδος στην υπέρβαση· το «πόσο πάνω» λέγεται διακριτικά με μικρό αριθμό.
            const col     = 'color-mix(in srgb, var(--text-primary) 34%, transparent)';
            const tr      = catTrend(cat.key);

            const hov = hoverCat === cat.key;
            const bdItems = isCurMonth ? (catBreakdown[cat.key] || []) : [];
            const hasBd = bdItems.length > 0;
            const openCat = openCats.has(cat.key);
            const toggleCat = () => setOpenCats(s => { return toggleIn(s, cat.key); });
            return (
              <div key={cat.key} className="po-fig-card" tabIndex={0}
                onMouseEnter={() => setHoverCat(cat.key)} onMouseLeave={() => setHoverCat(null)}
                style={{ borderRadius: T.radius.inner, padding: '6px 8px', margin: '0 -8px', background: hov ? 'var(--bg-elevated)' : 'transparent', transition: 'background 0.15s' }}>
                {/* Πατιέται ΜΟΝΟ όταν υπάρχει ανάλυση από κάτω. Χωρίς τη συνθήκη, η
                    γραμμή θα έμπαινε στη σειρά του Tab και θα ανακοινωνόταν ως κουμπί
                    ακόμη κι όταν το πάτημα δεν κάνει τίποτα — κενή υπόσχεση, που για
                    τον χρήστη πληκτρολογίου κοστίζει περισσότερο απ' ό,τι για τον
                    χρήστη ποντικιού: εκείνος τουλάχιστον βλέπει ότι δεν άνοιξε κάτι. */}
                <div {...(hasBd ? pressable(toggleCat) : {})} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, cursor: hasBd ? 'pointer' : 'default' }}>
                  <div style={{ width: 3, height: 26, borderRadius: 3, background: hov ? 'var(--accent)' : col, flexShrink: 0, transition: 'background 0.15s' }}/>
                  <span onClick={e => e.stopPropagation()} style={{ display: 'inline-flex' }}><InlineText value={cat.label} onCommit={v => renameCategory(cat.key, v)} ariaLabel={`Μετονομασία «${cat.label}»`} /></span>
                  {/* ═══ ΓΡΑΜΜΗ ΤΑΣΗΣ ΧΩΡΙΣ ΤΑΣΗ ΚΑΙ ΠΤΩΣΗ ΠΟΥ ΔΕΝ ΕΓΙΝΕ ═════════════
                      ΤΟ ΜΙΚΡΟΓΡΑΦΗΜΑ ΣΧΕΔΙΑΖΟΤΑΝ ΠΑΝΤΑ, ΑΚΟΜΗ ΚΑΙ ΜΕ ΕΝΑ ΝΟΥΜΕΡΟ.
                      Δώδεκα μήνες με δεδομένα σε έναν δεν είναι τάση: είναι μία
                      κορυφή πάνω σε ίσια γραμμή. Μετρημένο στην οθόνη του χρήστη:
                      τρεις από τις τέσσερις κατηγορίες έδειχναν πριόνι χωρίς νόημα.
                      Τρία σημεία είναι το ελάχιστο για να υπάρχει κατεύθυνση.

                      ΚΑΙ ΤΟ «−100%» ΕΛΕΓΕ ΠΤΩΣΗ ΠΟΥ ΔΕΝ ΕΧΕΙ ΣΥΜΒΕΙ. Στον τρέχοντα
                      μήνα, κατηγορία με μηδέν σημαίνει «δεν έχει καταχωρηθεί ακόμη»,
                      όχι «έπεσε στο μηδέν»: ο λογαριασμός του ρεύματος έρχεται στα
                      μέσα του μήνα. Η εφαρμογή δεν βγάζει συμπέρασμα από δεδομένα
                      που δεν έχουν φτάσει. */}
                  {catSpark(cat.key).filter(v => v > 0).length >= 3 && (
                    <span title="Τάση 12 μηνών"><Sparkline values={catSpark(cat.key)} activeIndex={_sparkYms.indexOf(viewYm)} /></span>
                  )}
                  {isCurMonth && actual > 0 && tr.avgPrior > 0 && tr.direction !== 'flat' && (
                    <span title={`Μέσος όρος τριμήνου: ${feAuto(tr.avgPrior)}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 'var(--fs-xs)', fontWeight: 700, fontFamily: T.font.num, color: 'var(--text-tertiary)' }}>
                      <svg aria-hidden="true" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: tr.direction === 'down' ? 'scaleY(-1)' : 'none' }}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                      {tr.deltaPct > 0 ? '+' : ''}{tr.deltaPct}%
                    </span>
                  )}
                  <span style={{ flex: 1 }}/>

                  <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                    {/* ΙΔΙΟ ΜΕΓΕΘΟΣ ΚΑΙ ΣΤΙΣ ΔΥΟ ΠΕΡΙΠΤΩΣΕΙΣ. Το «καμία δαπάνη» ήταν
                        παύλα σε 11 στιγμές δίπλα σε ποσό των 14: δύο διαφορετικά ύψη
                        στην ίδια στήλη, που δεν στοιχίζονται μεταξύ τους σε καμία
                        σειρά. Τώρα είναι ποσό, γράφεται 0,00€ και η απουσία λέγεται
                        από το χρώμα και το βάρος. */}
                    <span style={{ fontSize: 14, fontWeight: actual > 0 ? 700 : 500, fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums', color: actual > 0 ? (hov ? 'var(--accent)' : 'var(--text-primary)') : 'var(--text-tertiary)', transition: 'color 0.15s' }}>{feAuto(actual > 0 ? actual : 0)}</span>
                    {/* Στόχος — κλικ για επιτόπου αλλαγή */}
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums' }}>/ <InlineNumber raw={budgets[cat.key] ?? String(cat.default)} display={feAuto(budget)} onCommit={v => updateBudget(cat.key, v)} width={58} ariaLabel={`Στόχος «${cat.label}»`} /></span>
                    {isOver && <span className="po-fig" data-tone="negative" title="Υπέρβαση του στόχου" style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums' }}>+{feAuto(actual - budget)}</span>}
                    {projOver && <span title="Με τον τρέχοντα ρυθμό θα ξεπεράσει τον στόχο" style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-tertiary)', fontFamily: T.font.sans }}>προβλεπόμενη υπέρβαση</span>}
                    {isWarn && <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-tertiary)', fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums' }}>{fp(pct)}</span>}
                  </div>
                  {/* Αφαίρεση κατηγορίας — εμφανίζεται στο πέρασμα του κέρσορα */}
                  <button type="button" title="Αφαίρεση κατηγορίας" aria-label={`Αφαίρεση «${cat.label}»`}
                    onClick={e => { e.stopPropagation(); removeCategory(cat.key); }}
                    onMouseEnter={() => setDelCatHover(cat.key)} onMouseLeave={() => setDelCatHover(null)}
                    style={{ width: 22, height: 22, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: T.radius.xs, border: 'none', background: 'transparent', color: delCatHover === cat.key ? 'var(--negative)' : 'var(--text-tertiary)', cursor: 'pointer', transition: 'opacity 0.15s, color 0.15s', padding: 0, opacity: (hov || coarse) ? 1 : 0, pointerEvents: (hov || coarse) ? 'auto' : 'none' }}>
                    <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                  {hasBd && (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={hov ? 'var(--accent)' : 'var(--text-tertiary)'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transform: openCat ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s, stroke 0.15s' }} aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
                  )}
                </div>

                {(
                  <div style={{ marginLeft: 12 }}>
                    <div style={{ height: 4, background: 'var(--bg-overlay)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: hov ? 'var(--accent)' : col, borderRadius: 3, transition: 'width 0.5s ease, background 0.15s' }}/>
                    </div>
                  </div>
                )}

                {/* Ανάλυση κατηγορίας: πάροχος/περιγραφή, ποσό και ημερομηνία της κάθε πληρωμής */}
                {hasBd && openCat && (
                  <div style={{ marginLeft: 12, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {bdItems.map((it, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 8px', margin: '0 -8px', borderRadius: T.radius.inner }}>
                        <span style={{ width: 4, height: 4, borderRadius: '50%', background: it.paid ? 'color-mix(in srgb, var(--text-primary) 40%, transparent)' : 'var(--border-default)', flexShrink: 0 }} />
                        <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--text-secondary)', fontFamily: T.font.sans, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</span>
                        {!it.paid && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: T.font.sans }}>εκκρεμεί</span>}
                        {it.date && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{parseLocalDate(it.date).toLocaleDateString('el-GR', { day: 'numeric', month: 'short' })}</span>}
                        <span style={{ minWidth: 58, textAlign: 'right', flexShrink: 0, fontSize: 12, fontWeight: 700, fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>{feAuto(it.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>}

        {!collapsed.has('cats') && (() => {
          const sumCats = activeCats.reduce((s, c) => s + catBudget(c.key), 0);
          return (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
              {/* Σύνολο + ενέργειες (χωρίς λειτουργία επεξεργασίας — όλα επιτόπου) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', fontSize: 12, fontFamily: T.font.sans, color: 'var(--text-secondary)' }}>
                <span>Μηνιαίος στόχος <InlineNumber raw={budgets.total ?? String(Math.round(masterBudget))} display={feAuto(masterBudget)} onCommit={v => updateBudget('total', v)} width={70} ariaLabel="Συνολικός μηνιαίος στόχος" /></span>
                <span style={{ color: 'var(--text-tertiary)' }}>Άθροισμα κατηγοριών <strong style={{ fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>{feAuto(sumCats)}</strong></span>
                <span style={{ flex: 1 }} />
                {/* Σύνδεσμοι μέσα στη γραμμή του συνόλου, όχι κουμπιά: δεν έχουν
                    κουτί και ζουν ανάμεσα σε νούμερα. Ο ήσυχος τόνος κρατά τη
                    διάκριση «ανοιχτό ή κλειστό» που έδινε πριν το μελάνι. */}
                <LinkBtn tone={addingCat ? undefined : 'quiet'} onClick={() => setAddingCat(v => !v)}>{addingCat ? 'Κλείσιμο' : '+ Προσθήκη κατηγορίας'}</LinkBtn>
                <LinkBtn tone={showSettings ? undefined : 'quiet'} onClick={() => setShowSettings(v => !v)}>Ρυθμίσεις</LinkBtn>
              </div>

              {addingCat && (
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <TextInput label="Νέα κατηγορία" value={newCatName} onChange={setNewCatName} placeholder="Καθαριότητα, Φύλαξη…"
                      onKeyDown={e => { if (e.key === 'Enter' && newCatName.trim()) { addCategory(newCatName); setNewCatName(''); } }}/>
                  </div>
                  {/* Κύρια ενέργεια της σειράς: συμπαγές γέμισμα με ανεστραμμένο
                      μελάνι. Το χρώμα του γεμίσματος το δίνει πλέον η `.po-btn`. */}
                  <Btn variant="primary" disabled={!newCatName.trim()}
                    onClick={() => { addCategory(newCatName); setNewCatName(''); }}>
                    Προσθήκη
                  </Btn>
                </div>
              )}

              {hiddenBaseCats.length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-tertiary)', fontFamily: T.font.sans, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Επαναφορά</span>
                  {hiddenBaseCats.map(c => (
                    <button key={c.key} type="button" title="Επαναφορά κατηγορίας" onClick={() => restoreCategory(c.key)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: T.radius.pill, border: '1px dashed var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500, fontFamily: T.font.sans, cursor: 'pointer' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-accent)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}>
                      <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      {labelOverrides[c.key] ?? c.label}
                    </button>
                  ))}
                </div>
              )}

              {showSettings && (
                <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 10 }}>
                  {settingToggle('notifyOverspend', notifyOn, 'Ειδοποίηση σε υπέρβαση', 'Ειδοποίηση όταν μια κατηγορία ξεπεράσει τον στόχο, μέσω των προτιμήσεων ειδοποιήσεων και του Ημερολογίου.')}
                  {settingToggle('rollover', rolloverOn, 'Μεταφορά υπολοίπου', 'Το αδιάθετο ή η υπέρβαση του μήνα μεταφέρεται στον επόμενο, αντί για μηδενισμό κάθε μήνα.')}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Εξαιρέσεις: όσα δεν θέλεις να μετρούν στα στατιστικά/προϋπολογισμό (τα πληρώνει άλλος ή απλώς εκτός) */}
      {viewItems.length > 0 && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.card, padding: 16, marginBottom: 12 }}>
          {secHdr('Εξαιρέσεις', 'exclusions',
            excludedCount > 0 ? <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums' }}>{excludedCount} εκτός</span> : undefined,
            <InfoDot text="Απενεργοποίησε όσα δεν θέλεις να μετρούν στα στατιστικά και στον προϋπολογισμό. Εξαίρεσε ολόκληρη την εγγραφή ή μέρος του ποσού (π.χ. το μισό το πλήρωσε άλλος) και σημείωσε προαιρετικά τον λόγο." />)}
          {!collapsed.has('exclusions') && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {viewItems.map((it, idx) => {
                const ex = excludedMap[it.id];
                const isEx = !!ex;
                const full = it.amount;
                const excl = exclAmountOf(it.id, full);            // πόσο εξαιρείται
                const cnt  = Math.max(0, full - excl);             // πόσο μετρά
                const partial = isEx && ex?.amount != null && ex.amount > 0 && ex.amount < full;
                const amtVal = exclAmtDraft[it.id] ?? (ex?.amount != null ? String(ex.amount) : '');
                return (
                  <div key={it.id} style={{ padding: '11px 0', borderTop: idx === 0 ? 'none' : '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--fs-base)', fontWeight: 500, color: isEx ? 'var(--text-tertiary)' : 'var(--text-primary)', fontFamily: T.font.sans, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</span>
                      {/* Ποσό: συνολικό· όταν εξαιρείται μερικώς, δείχνουμε διακριτικά πόσο μετρά */}
                      <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.2 }}>
                        <span style={{ fontSize: 'var(--fs-base)', fontWeight: 700, fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums', color: isEx ? 'var(--text-tertiary)' : 'var(--text-primary)', textDecoration: isEx && !partial ? 'line-through' : 'none', textDecorationColor: 'var(--border-default)' }}>{feAuto(full)}</span>
                        {partial && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums' }}>μετρά {feAuto(cnt)}</span>}
                      </span>
                      {/* Διακόπτης «μετρά στον προϋπολογισμό» — off = εξαιρέθηκε.
                          ΓΙΑΤΙ ΜΕΝΕΙ ΧΕΙΡΟΓΡΑΦΟΣ. Το κοινό `Toggle` δένει την
                          aria-label με το ΟΡΑΤΟ κείμενο: `aria-label={label}` και
                          `{label && <span>{label}</span>}` στο ίδιο prop. Εδώ ο
                          διακόπτης επαναλαμβάνεται μία φορά ανά εγγραφή του μήνα
                          (δεκάδες γραμμές), οπότε το κοινό component θα τύπωνε
                          «Μετρά στον προϋπολογισμό» δίπλα σε ΚΑΘΕ γραμμή για να
                          κρατήσει την ετικέτα προσβασιμότητας. Η γεωμετρία και τα
                          χρώματα ευθυγραμμίστηκαν με το `Toggle size="sm"`
                          (36×20, δείκτης 12/16, περίγραμμα 2) ώστε να είναι
                          οπτικά ο ΙΔΙΟΣ διακόπτης· έφευγε πριν με ωμό #fff στον
                          δείκτη και ωμό rgba στη σκιά. */}
                      {/* ΤΟ ΑΝΤΙΓΡΑΦΟ ΕΦΥΓΕ. Το σχόλιο από πάνω παραδεχόταν ότι
                          ζωγράφιζε «οπτικά τον ΙΔΙΟ διακόπτη» με το χέρι: ίδια
                          νούμερα, γραμμένα δεύτερη φορά. Την επόμενη φορά που
                          θα αλλάξει το ελατήριο, αυτό εδώ θα έμενε πίσω. */}
                      <Toggle on={!isEx} ariaLabel="Μετρά στον προϋπολογισμό"
                        onChange={() => { if (isEx) { unexcludeItem(it.id); setExclAmtDraft(d => { const n = { ...d }; delete n[it.id]; return n; }); } else { const snap = budgets.__excluded; excludeItem(it.id); notify(`Εξαιρέθηκε «${it.label}»`, { duration: UNDO_MS, action: { label: 'Αναίρεση', onClick: () => persistCats({ __excluded: snap ?? '{}' }) } }); } }} />
                    </div>
                    {/* ═══ ΤΡΕΙΣ ΣΕΙΡΕΣ ΕΓΙΝΑΝ ΜΙΑ ══════════════════════════════════
                        Το πάνελ έπιανε τρεις σειρές με στήλη ετικετών 74
                        εικονοστοιχείων: «Λόγος», «Εξαιρείται», «Σημείωση». Ενα
                        κουτί ύψους εκατόν είκοσι για να πεις ότι τον λογαριασμό
                        τον πλήρωσε ο ενοικιαστής, ανοιγμένο κάτω από ΚΑΘΕ
                        εξαιρεμένη γραμμή του μήνα.

                        Τα τρία χειριστήρια χωρούν σε μία σειρά: τα πλακίδια του
                        λόγου, το ποσό των εκατόν οκτώ και η σημείωση που παίρνει
                        τον υπόλοιπο χώρο. Οι δύο ετικέτες που χρειάζονται μπαίνουν
                        μπροστά από το χειριστήριό τους αντί για δική τους στήλη· η
                        σημείωση δεν χρειάζεται καμία, γιατί το κείμενο υπόδειξης
                        είναι ολόκληρο παράδειγμα.

                        ΚΑΙ ΕΝΑ ΚΕΙΜΕΝΟ ΕΦΥΓΕ. Το «όλη η εγγραφή εξαιρείται» έλεγε
                        ό,τι λέει ήδη η διαγραμμένη τιμή στη γραμμή από πάνω· το
                        «μετρά 15,60€» της μερικής εξαίρεσης γράφεται κιόλας
                        εκεί, κάτω από το ποσό. */}
                    {isEx && (
                      <div style={{ marginTop: 8, padding: '9px 11px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.inner, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {/* Λόγος: γρήγορες επιλογές (προαιρετικό) */}
                        <span style={{ flexShrink: 0, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: T.font.sans }}>Λόγος</span>
                        {PAYERS.map(p => {
                            const sel = ex?.payer === p;
                          return (
                            // Σχήμα `chip` και όχι `seg`: τα πλακίδια κάθονται ελεύθερα
                            // μέσα στη γραμμή, χωρίς ράγα με δικό της περίγραμμα.
                            <ChipToggle key={p} on={sel} onClick={() => patchExcl(it.id, { payer: sel ? '' : p })}>
                              {p}
                            </ChipToggle>
                          );
                        })}
                        {/* Μερική εξαίρεση: πόσο από το ποσό να εξαιρεθεί (κενό = όλο)

                            ΤΟ ΕΥΡΩ ΓΡΑΦΟΤΑΝ ΔΥΟ ΦΟΡΕΣ ΚΑΙ Η ΠΑΡΕΝΘΕΣΗ ΚΟΒΟΤΑΝ. Το
                            κείμενο υπόδειξης ήταν «όλο (31,20€)» μέσα σε πεδίο 108
                            εικονοστοιχείων που κρατά 22 δεξιά για το δικό του «€»:
                            έμεναν 76 για δεκατρείς χαρακτήρες. Η οθόνη έγραφε «όλο
                            (31,20€ €», με κομμένη παρένθεση και δύο σύμβολα
                            νομίσματος στη σειρά. Το ποσό το λέει ήδη η ίδια η γραμμή,
                            διαγραμμένο στο δεξί άκρο· η υπόδειξη λέει μόνο τι σημαίνει
                            το κενό πεδίο. */}
                        <span style={{ flexShrink: 0, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: T.font.sans, marginLeft: 4 }}>Εξαιρείται</span>
                        <div style={{ position: 'relative', width: 92, flexShrink: 0 }}>
                          <input aria-label="Ποσό που εξαιρείται" inputMode="decimal" value={amtVal}
                            onChange={e => { const raw = e.target.value.replace(/[^\d.,]/g, ''); setExclAmtDraft(d => ({ ...d, [it.id]: raw })); const n = parseFloat(raw.replace(',', '.')); patchExcl(it.id, { amount: isFinite(n) && n > 0 ? n : undefined }); }}
                            placeholder="όλο"
                            style={{ width: '100%', height: 28, padding: '0 22px 0 10px', borderRadius: T.radius.xs, border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 12, fontWeight: 600, fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums', outline: 'none', transition: 'border-color 0.15s' }}
                            onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-accent)'; }}
                            onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }} />
                          <span style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: T.font.num, pointerEvents: 'none' }}>€</span>
                        </div>
                        {/* Σημείωση: ελεύθερο κείμενο (προαιρετικό). Χωρίς ετικέτα:
                            το κείμενο υπόδειξης είναι ολόκληρο παράδειγμα. */}
                        <input aria-label="Σημείωση εξαίρεσης" type="text" value={ex?.note ?? ''} maxLength={120}
                          onChange={e => patchExcl(it.id, { note: e.target.value })}
                          placeholder="το μισό το πλήρωσε ο συγκάτοικος"
                          style={{ flex: '1 1 180px', minWidth: 0, height: 28, padding: '0 10px', borderRadius: T.radius.xs, border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 12, fontFamily: T.font.sans, outline: 'none', transition: 'border-color 0.15s' }}
                          onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-accent)'; }}
                          onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ΕΝΑ ΚΛΙΚ ΛΙΓΟΤΕΡΟ. Το «Περισσότερα» έκρυβε δύο πράγματα: τα αποθεματικά
          και την εισαγωγή αρχείου. Τα αποθεματικά αφαιρέθηκαν από το προϊόν,
          οπότε έμεινε πτυσσόμενο πάνω από ΕΝΑ στοιχείο — δηλαδή ένα κλικ για να
          δεις κάτι που χωρούσε να φαίνεται. Η ίδια η ενότητα μαζεύει ήδη. */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.card, padding: 16, marginTop: 12 }}>
        {secHdr('Εισαγωγή δεδομένων', 'import', undefined,
          <InfoDot text="Ανέβασε τραπεζικό αντίγραφο ή λίστα εξόδων (CSV ή Excel) και το εργαλείο αναγνωρίζει αυτόματα ημερομηνία, ποσό και κατηγορία. Ελέγχεις και διορθώνεις πριν την καταχώρηση, ώστε οι δαπάνες να μπαίνουν στον σωστό μήνα και στη σωστή κατηγορία." />)}
            {!collapsed.has('import') && (
          <BudgetImport propertyId={propertyId} userId={userId} cats={activeCats.map(c => ({ key: c.key, label: c.label }))} onImported={loadData} />
        )}
      </div>

    </div>
  );
}