'use client';

// ═══════════════════════════════════════════════════════════════════════════
// ΠΡΟΫΠΟΛΟΓΙΣΜΟΣ: ΜΙΑ ΕΡΩΤΗΣΗ ΑΝΑ ΟΘΟΝΗ (13/11/2026)
// ─────────────────────────────────────────────────────────────────────────
// Ο έλεγχος τον βαθμολόγησε 4/10. Η πρώτη οθόνη πήγαινε σε σημείωση και σε
// κάρτα ταμείου, ο μήνας έναντι σχεδίου ήταν κάτω από την πτυχή, κάθε ενότητα
// ξεκινούσε μαζεμένη και στα 375 η γραμμή κατηγορίας άνοιγε τη σελίδα στα 465.
//
// Τώρα η οθόνη απαντά «πώς πάει ο μήνας σε σχέση με το σχέδιό μου και τι με
// χρειάζεται τώρα»:
//   1. κεφαλίδα με μήνα και «Νέα δαπάνη»
//   2. «Ξόδεψες X από Y», με το πραγματικό ποσοστό
//   3. «Χρειάζονται εσένα»: ληξιπρόθεσμα, εκκρεμή, υπερβάσεις, με ένα πάτημα
//      στη φιλτραρισμένη λίστα των Δαπανών
//   4. οι κατηγορίες, πάντα ανοιχτές· πάτημα ανοίγει φύλλο με τις κινήσεις
//   5. όλα τα υπόλοιπα κάτω από ΕΝΑ «Περισσότερα»
// Στον υπολογιστή: 1.120 πλάτος, δύο στήλες (7 και 5).
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { NumberInput, TextInput, Toggle, ToggleTrack, InfoDot, CustomSelect } from './UIComponents';
import { T, TT, fd, feAuto, fn, ABSENT_SHORT, KPIGrid, Skeleton, Btn, IconBtn, LinkBtn, Card, Modal, ChipToggle } from '@/components/Theme';
import { feSigned, fpSigned, fpRate } from '@/lib/core/format';
import { notify } from '@/components/Toast';
import { categoryStatus, type RecurringCharge } from '@/lib/billing/budget';
import { parseLocalDate, PAYERS, type Props, type MonthItem } from './budget/model';
import { MonthBars, Donut } from './budget/charts';
import { useBudget } from './budget/useBudget';
import { progress, yearly, orderCats, suggestTarget, type Target } from './budget/plan';
import { overdueWord, pendingWord, overWord, sumCents } from '@/lib/expenses/attention';
import { STR_INDIVIDUAL_MAX_PROPERTIES } from '@/lib/billing/greekTax';
import { YIELD_SHORT_LABELS, YIELD_PRE_TAX_SUB } from '@/lib/facts/labels';

/** Από πόσα βραχυχρόνια και πάνω η εκμίσθωση είναι επιχειρηματική (39Α ΚΦΕ). */
const STR_BUSINESS_FROM = STR_INDIVIDUAL_MAX_PROPERTIES + 1;

// ── Η ΔΙΑΤΑΞΗ ΔΥΟ ΣΤΗΛΩΝ ΚΡΙΝΕΤΑΙ ΑΠΟ ΤΟ ΠΛΑΤΟΣ, ΜΙΑ ΦΟΡΑ ─────────────────────
// Η δεξιά στήλη δεν είναι αντίγραφο της αριστερής: εκεί ζουν το ετήσιο και οι
// επαναλαμβανόμενες, που στο τηλέφωνο μπαίνουν στο «Περισσότερα». Με CSS θα
// έπρεπε να αποδοθούν δύο φορές· εδώ αποδίδονται μία, στη σωστή θέση.
const WIDE = '(min-width: 1024px)';
const subWide = (cb: () => void) => {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const m = window.matchMedia(WIDE); m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
};
const useWide = () => useSyncExternalStore(subWide, () => !!window.matchMedia?.(WIDE).matches, () => false);

// Η ουδέτερη ράβδος: ήρεμη όσο δεν υπάρχει υπέρβαση. Η υπέρβαση παίρνει --negative.
const BAR_FILL = 'color-mix(in srgb, var(--text-primary) 42%, transparent)';

const NOTE = 'Τα σύνολα μετρούν λογαριασμούς και δαπάνες μαζί, στον μήνα της ημερομηνίας τους. Όσα δεν έχουν πληρωθεί μετρούν κι αυτά και σημειώνονται «εκκρεμεί».';

const Chevron = ({ dir = 'right', size = 16 }: { dir?: 'right' | 'left' | 'down'; size?: number }) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: dir === 'left' ? 'rotate(180deg)' : dir === 'down' ? 'rotate(90deg)' : 'none', transition: 'transform 0.18s', flexShrink: 0 }}>
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

/** Επικεφαλίδα κάρτας: ίδιο ύψος, ίδιο κενό, ίδια γραμμή σε κάθε κάρτα της οθόνης. */
function CardHead({ title, info, right, level = 2 }: { title: string; info?: string; right?: ReactNode; level?: 2 | 3 }) {
  const H = level === 2 ? 'h2' : 'h3';
  return (
    <div className="bud-card-head">
      <H style={{ ...TT.label, color: 'var(--text-primary)', margin: 0, display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        {title}{info && <InfoDot text={info} />}
      </H>
      {right}
    </div>
  );
}

export default function BillsBudget({ propertyId, userId = '', profileType = 'individual', onScan, onOpenLedger }: Props) {
  const b = useBudget({ propertyId, userId, profileType });
  const {
    isPro, budgets, catMonth, income, loanMonthly, rentalMode, strNights, recurring, monthItems,
    invReturns, strPropCount, taxPctAuto, loading, saving,
    demoBusy, setMonthOffset, collapsed, toggleCollapse, updateBudget, labelOverrides, activeCats, hiddenBaseCats,
    catBudget, masterBudget, addCategory, removeCategory, restoreCategory, demoIds, demo, setDemo,
    removeDemo, renameCategory, excludedMap, excludeItem, unexcludeItem, patchExcl, exclAmountOf, catForecast,
    forecastTotal, yearBars, catYtd, weekCats, weekTotalV, weekMax, rolloverOn, hasPrevMonth, carryIn,
    adjAvailable, _prevLabel, isCurMonth, viewYm, viewActuals, viewActualTotal, viewRecordedTotal, viewMonthLabel, viewItems,
    displayOver, canGoNewer, canGoOlder, committedBills, monthlyCost, hasIncome, insights, dismissSuggestion,
    targetSuggestions, notifyOn, isSTR, strPlatformPct, strMgmtPct, strTaxPct, waterfall, incomeDeductions, safeRaw,
    isShortfall, loadError, attention, ytdActual, monthsElapsed, isOverCat, retry, exclAmtDraft, setExclAmtDraft,
    monthTotals,
  } = b;

  const wide = useWide();
  const [sheetKey, setSheetKey] = useState<string | null>(null);
  const [targetOpen, setTargetOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [showIdle, setShowIdle] = useState(false);
  const moreOpen = !collapsed.has('more');

  // ── ΣΚΕΛΕΤΟΣ: ΤΟ ΣΧΗΜΑ ΤΗΣ ΟΘΟΝΗΣ, ΟΧΙ ΣΠΙΝΕΡ ─────────────────────────────
  if (loading) {
    return (
      <div className="bud" aria-busy="true">
        <Skeleton h={36} w={240} r={8} style={{ marginBottom: T.sp.lg }} />
        <div className="bud-grid">
          <div className="bud-col"><Skeleton h={168} r={T.radius.card} /><Skeleton h={320} r={T.radius.card} /></div>
          <div className="bud-col"><Skeleton h={120} r={T.radius.card} /></div>
        </div>
        <BudgetStyles />
      </div>
    );
  }

  const newExpense = onScan ? <Btn variant="primary" size="lg" onClick={onScan}>Νέα δαπάνη</Btn> : null;

  // ── ΚΕΦΑΛΙΔΑ ───────────────────────────────────────────────────────────
  // Το «προφίλ ιδιώτη» έφυγε: δεν είναι πληροφορία προϋπολογισμού. Η σημείωση
  // των τριακοσίων εικονοστοιχείων έγινε ⓘ δίπλα στον τίτλο.
  const header = (
    <div className="bud-head">
      <h1 className="page-title" style={{ ...TT.display, margin: 0, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        Προϋπολογισμός<InfoDot text={NOTE} label="Πώς μετράμε" />
      </h1>
      {/* Ο ΜΗΝΑΣ ΑΡΙΣΤΕΡΑ, Η ΚΥΡΙΑ ΕΝΕΡΓΕΙΑ ΔΕΞΙΑ, ΣΤΗΝ ΙΔΙΑ ΣΕΙΡΑ. Στα 375 ο
          τίτλος και το κουμπί δεν χωρούσαν μαζί και το κουμπί έπεφτε μόνο του. */}
      <div className="bud-head-row">
        {!loadError ? (
          <div className="bud-month" role="group" aria-label="Μήνας">
            <IconBtn onClick={() => canGoOlder && setMonthOffset(o => o - 1)} disabled={!canGoOlder} label="Προηγούμενος μήνας"><Chevron dir="left" size={18} /></IconBtn>
            <span className="bud-month-label" aria-live="polite">{viewMonthLabel}</span>
            <IconBtn onClick={() => canGoNewer && setMonthOffset(o => o + 1)} disabled={!canGoNewer} label="Επόμενος μήνας"><Chevron size={18} /></IconBtn>
            {!isCurMonth && <LinkBtn tone="quiet" onClick={() => setMonthOffset(0)}>Σήμερα</LinkBtn>}
            {saving && <span style={{ ...TT.caption, marginLeft: T.sp.sm }}>Αποθήκευση…</span>}
          </div>
        ) : null}
        {newExpense}
      </div>
    </div>
  );

  // ── ΣΦΑΛΜΑ: ΚΑΝΕΝΑ ΜΗΔΕΝΙΚΟ, ΚΑΝΕΝΑ ΠΑΡΑΔΕΙΓΜΑ ───────────────────────────
  if (loadError) {
    return (
      <div className="bud">
        {header}
        <Card gap={false} style={{ maxWidth: 640 }}>
          <div role="alert" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: T.sp.md }}>
            <h2 style={{ ...TT.h2, margin: 0 }}>Δεν φορτώθηκε ο προϋπολογισμός</h2>
            <p style={{ ...TT.body, color: 'var(--text-secondary)', margin: 0 }}>
              Τα ποσά δεν είναι μηδέν, απλώς δεν τα βλέπουμε τώρα. Έλεγξε τη σύνδεσή σου και δοκίμασε ξανά.
            </p>
            <Btn variant="secondary" onClick={retry}>Δοκίμασε ξανά</Btn>
          </div>
        </Card>
        <BudgetStyles />
      </div>
    );
  }

  const hasHistory = monthItems.length > 0 || Object.keys(monthTotals).length > 0;
  const hasAnyTarget = masterBudget != null || activeCats.some(c => catBudget(c.key) != null);
  const isEmpty = !demo && !hasHistory && !hasAnyTarget;
  const priorTotals = [1, 2, 3].map(k => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - k); return monthTotals[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`] || 0; });
  const suggestedTotal = suggestTarget(priorTotals);

  // ── ΤΟ ΠΑΡΑΔΕΙΓΜΑ ΚΑΙ ΤΑ ΠΑΛΙΑ ΔΕΙΓΜΑΤΑ ────────────────────────────────────
  const demoBar = demo ? (
    <div className="bud-note" role="status">
      <span style={{ ...TT.bodySm, color: 'var(--text-secondary)', flex: '1 1 200px' }}>Βλέπεις ένα παράδειγμα. Δεν αποθηκεύεται τίποτα και δεν αγγίζει τις δαπάνες σου.</span>
      <Btn variant="secondary" onClick={() => setDemo(false)}>Κλείσιμο παραδείγματος</Btn>
    </div>
  ) : demoIds.length > 0 ? (
    <div className="bud-note">
      <span style={{ ...TT.bodySm, color: 'var(--text-secondary)', flex: '1 1 200px' }}>Υπάρχουν δαπάνες δείγματος από παλιότερη έκδοση της εφαρμογής.</span>
      <Btn variant="secondary" onClick={removeDemo} disabled={demoBusy}>{demoBusy ? 'Αφαίρεση…' : 'Αφαίρεση δείγματος'}</Btn>
    </div>
  ) : null;

  // ── ΚΕΝΗ ΚΑΤΑΣΤΑΣΗ: ΑΠΟ ΚΕΝΟ ΣΧΕΔΙΟ, ΧΩΡΙΣ ΕΦΕΥΡΕΜΕΝΟΥΣ ΣΤΟΧΟΥΣ ─────────────
  const emptyCard = (
    <Card gap={false}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: T.sp.md }}>
        <h2 style={{ ...TT.h2, margin: 0 }}>Ξεκίνα με έναν μηνιαίο στόχο</h2>
        <p style={{ ...TT.body, color: 'var(--text-secondary)', margin: 0 }}>
          Βάλε πόσα θέλεις να ξοδεύεις τον μήνα για το ακίνητο ή καταχώρησε την πρώτη δαπάνη με τη «Νέα δαπάνη». Θα βλέπεις εδώ πού πάνε τα χρήματα.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: T.sp.md, flexWrap: 'wrap' }}>
          <Btn variant="secondary" onClick={() => setTargetOpen(true)}>Βάλε μηνιαίο στόχο</Btn>
          <LinkBtn tone="quiet" onClick={() => setDemo(true)}>Δες ένα παράδειγμα</LinkBtn>
        </div>
      </div>
    </Card>
  );

  // ── 2. «ΞΟΔΕΨΕΣ X ΑΠΟ Y» ───────────────────────────────────────────────────
  const withEstimates = isCurMonth && viewActualTotal - viewRecordedTotal > 0.005;
  const prog = progress(viewActualTotal, masterBudget);
  const parts = [
    { l: 'κρατήσεις εσόδου', v: incomeDeductions },
    { l: 'πάγια', v: committedBills },
    { l: 'δόση δανείου', v: loanMonthly },
  ].filter(p => p.v > 0.004);
  const listOf = (xs: string[]) => xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} και ${xs[xs.length - 1]}`;
  const hero = (
    <Card gap={false}>
      <div className="bud-hero-top">
        <span style={{ ...TT.label }}>Ξόδεψες</span>
        {masterBudget != null && <LinkBtn tone="quiet" onClick={() => setTargetOpen(true)}>Αλλαγή στόχου</LinkBtn>}
      </div>
      <div className="bud-hero-fig">
        <span className="bud-big">{feAuto(viewActualTotal)}</span>
        <span style={{ ...TT.body, color: 'var(--text-secondary)' }}>{masterBudget != null ? <>από <span className="bud-num">{feAuto(masterBudget)}</span></> : 'χωρίς στόχο'}</span>
      </div>
      {prog ? (
        <>
          <div className="bud-bar bud-bar-lg" aria-hidden="true">
            <span style={{ width: `${prog.bar}%`, background: prog.over ? 'var(--negative)' : BAR_FILL }} />
          </div>
          <div className="bud-hero-cap">
            <span className="bud-num">{fpRate(prog.pct)} του στόχου{withEstimates ? ', με εκτιμήσεις παρόχων' : ''}</span>
            <span className="bud-num" style={{ color: prog.over ? 'var(--negative)' : 'var(--text-secondary)', fontWeight: 600 }}>
              {prog.over ? `Υπέρβαση ${feAuto(-prog.left)}` : `Μένουν ${feAuto(prog.left)}`}
            </span>
          </div>
        </>
      ) : (
        <div style={{ marginTop: T.sp.md }}>
          <Btn variant="secondary" onClick={() => setTargetOpen(true)}>Βάλε μηνιαίο στόχο</Btn>
        </div>
      )}
      {isCurMonth && Math.abs(forecastTotal - viewActualTotal) > 0.005 && (
        <div style={{ ...TT.caption, marginTop: T.sp.sm }}>Με τον ρυθμό ως τώρα, ο μήνας κλείνει στα <span className="bud-num">{feAuto(forecastTotal)}</span>.</div>
      )}
      {isCurMonth && rolloverOn && hasPrevMonth && carryIn !== 0 && (
        <div style={{ ...TT.caption, marginTop: T.sp.xs }}>
          Μεταφορά από τον {_prevLabel} <span className="bud-num">{carryIn > 0 ? '+' : ''}{feAuto(carryIn)}</span> · πραγματικά διαθέσιμα <span className="bud-num">{feAuto(adjAvailable)}</span>
        </div>
      )}
      {isCurMonth && (hasIncome || monthlyCost > 0) && (
        <div className="bud-hero-cash">
          <div style={{ minWidth: 0 }}>
            <div style={{ ...TT.bodySm, color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {hasIncome ? (isPro ? 'Διαθέσιμη ταμειακή ροή' : 'Διαθέσιμο μετά τις υποχρεώσεις') : 'Μηνιαίο κόστος ακινήτου'}
              <InfoDot text={hasIncome
                ? (waterfall ? 'Εισπράξεις μετά την προμήθεια και την εκτίμηση φόρου, μείον πάγια και δόση δανείου. Ενδεικτικό.' : 'Ενοίκιο του μήνα μείον πάγια και δόση δανείου, προ φόρου. Ενδεικτικό.')
                : 'Τα πάγια του μήνα (ρεύμα, νερό, θέρμανση, τηλέφωνο, ασφάλεια, συνδρομές, κοινόχρηστα) και η δόση του δανείου.'} />
            </div>
            <div style={{ ...TT.caption }}>
              {hasIncome
                ? `${rentalMode === 'short_term' ? 'Εισπράξεις' : 'Ενοίκιο'} ${feAuto(income)}${parts.length ? ` μείον ${listOf(parts.map(p => `${p.l} ${feAuto(p.v)}`))}` : ''}`
                : listOf(parts.map(p => `${p.l} ${feAuto(p.v)}`))}
            </div>
          </div>
          <span className="bud-num" style={{ ...TT.h2, fontFamily: T.font.num, color: hasIncome && safeRaw < 0 ? 'var(--negative)' : 'var(--text-primary)', whiteSpace: 'nowrap' }}>
            {feSigned(hasIncome ? safeRaw : monthlyCost)}
          </span>
        </div>
      )}
      {isShortfall && <div style={{ ...TT.caption, color: 'var(--negative)', marginTop: T.sp.sm }}>Οι υποχρεώσεις του μήνα ξεπερνούν τα έσοδα κατά {feAuto(-safeRaw)}.</div>}
    </Card>
  );

  // ── 3. «ΧΡΕΙΑΖΟΝΤΑΙ ΕΣΕΝΑ» ─────────────────────────────────────────────────
  // Τέσσερις στοιβαγμένες λωρίδες υπέρβασης έγιναν τσιπ. Κάθε τσιπ ανοίγει τις
  // Δαπάνες ήδη φιλτραρισμένες· τα ληξιπρόθεσμα είναι πια ένα πάτημα μακριά.
  const chips: { key: string; text: string; tone?: 'negative'; go: () => void }[] = [];
  if (attention.overdue.n > 0) chips.push({ key: 'overdue', tone: 'negative', text: `${overdueWord(attention.overdue.n)} · ${feAuto(attention.overdue.sum)}`, go: () => onOpenLedger?.({ kind: 'overdue' }) });
  if (attention.pending.n > 0) chips.push({ key: 'pending', text: `${pendingWord(attention.pending.n)} · ${feAuto(attention.pending.sum)}`, go: () => onOpenLedger?.({ kind: 'pending' }) });
  if (displayOver.length > 0) chips.push({ key: 'over', tone: 'negative', text: overWord(displayOver.length),
    go: () => onOpenLedger?.({ kind: 'buckets', buckets: displayOver.map(c => c.key), month: viewYm, label: displayOver.map(c => c.label).join(', ') }) });
  const attentionBlock = (chips.length > 0 || (!isPro && strPropCount >= STR_BUSINESS_FROM)) ? (
    <Card gap={false}>
    <section aria-label="Χρειάζονται εσένα" className="bud-attn">
      <CardHead title="Χρειάζονται εσένα" />
      {chips.length > 0 && (
        <ul className="bud-chips">
          {chips.map(c => (
            <li key={c.key}>
              <button type="button" className="bud-chip" onClick={c.go} disabled={!onOpenLedger}>
                <span aria-hidden="true" className="bud-dot" style={{ background: c.tone === 'negative' ? 'var(--negative)' : 'var(--text-tertiary)' }} />
                <span className="bud-num">{c.text}</span>
                <Chevron size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {notifyOn && isCurMonth && displayOver.length > 0 && <div style={{ ...TT.caption }}>Θα λάβεις υπενθύμιση με email και στο Ημερολόγιο.</div>}
      {!isPro && strPropCount >= STR_BUSINESS_FROM && (
        <p style={{ ...TT.bodySm, margin: 0 }}>
          Έχεις <strong style={{ color: 'var(--text-primary)' }}>{strPropCount} βραχυχρόνια ακίνητα</strong>. Από {STR_BUSINESS_FROM} και πάνω η δραστηριότητα θεωρείται επιχειρηματική, με υποχρεώσεις ΦΠΑ, ΕΦΚΑ και προκαταβολής φόρου. Δες τη Λογιστική ή ρώτα τον λογιστή σου.
        </p>
      )}
    </section>
    </Card>
  ) : null;

  // ── 4. ΟΙ ΚΑΤΗΓΟΡΙΕΣ, ΠΑΝΤΑ ΑΝΟΙΧΤΕΣ ───────────────────────────────────────
  const rows = activeCats.map(c => {
    const actual = viewActuals[c.key] || 0;
    const target = catBudget(c.key);
    const projectedOver = isCurMonth && target != null && target > 0 && !isOverCat(c.key, actual)
      && categoryStatus(target, actual, catForecast(c.key)) === 'projected_over';
    return { key: c.key, label: c.label, actual, target, projectedOver };
  });
  const { active, idle } = orderCats(rows);
  const catRow = (r: typeof rows[number]) => {
    const p = progress(r.actual, r.target);
    const over = !!p?.over;
    const status = over ? `υπέρβαση ${feAuto(r.actual - (r.target ?? 0))}` : r.projectedOver ? 'προβλεπόμενη υπέρβαση' : '';
    return (
      <li key={r.key}>
        <button type="button" className="bud-cat" aria-haspopup="dialog" onClick={() => setSheetKey(r.key)}>
          <span className="bud-cat-name">{r.label}</span>
          <span className="bud-cat-amt bud-num">
            <span style={{ color: r.actual > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: r.actual > 0 ? 600 : 400 }}>{feAuto(r.actual)}</span>
            {r.target != null && <span style={{ color: 'var(--text-tertiary)' }}> / {feAuto(r.target)}</span>}
          </span>
          <span className="bud-cat-chev" aria-hidden="true"><Chevron size={16} /></span>
          <span className="bud-cat-line">
            {p
              ? <span className="bud-bar" aria-hidden="true"><span style={{ width: `${p.bar}%`, background: over ? 'var(--negative)' : BAR_FILL }} /></span>
              : <span style={{ ...TT.caption }}>χωρίς στόχο</span>}
          </span>
          {status && <span className="bud-cat-status" style={{ color: over ? 'var(--negative)' : 'var(--text-tertiary)' }}>{status}</span>}
        </button>
      </li>
    );
  };
  const categories = (
    <Card gap={false}>
      <CardHead title="Ανά κατηγορία" info="Πάτησε μια κατηγορία για να δεις τις κινήσεις της, να αλλάξεις τον στόχο ή να εξαιρέσεις κάτι. Οι αλλαγές αποθηκεύονται μόνες τους." />
      <ul className="bud-cats">
        {active.map(catRow)}
        {showIdle && idle.map(catRow)}
      </ul>
      {active.length === 0 && !showIdle && <p style={{ ...TT.bodySm, margin: 0 }}>Καμία κίνηση αυτόν τον μήνα.</p>}
      <div className="bud-cats-foot">
        {idle.length > 0 && (
          <LinkBtn tone="quiet" onClick={() => setShowIdle(v => !v)}>
            {showIdle ? 'Λιγότερες' : `+${idle.length} χωρίς κινήσεις`}
          </LinkBtn>
        )}
        <LinkBtn onClick={() => setAddOpen(true)}>Νέα κατηγορία</LinkBtn>
      </div>
    </Card>
  );

  // ── Η ΚΑΤΗΓΟΡΙΑ ΣΕ ΦΥΛΛΟ ────────────────────────────────────────────────────
  const sheetCat = sheetKey ? activeCats.find(c => c.key === sheetKey) ?? null : null;
  const sheet = sheetCat && (() => {
    const key = sheetCat.key;
    const target = catBudget(key);
    const actual = viewActuals[key] || 0;
    const items = viewItems.filter(it => it.catKey === key).sort((a, z) => (a.date < z.date ? 1 : -1));
    const hist = [1, 2, 3].map(k => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - k); return catMonth[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`]?.[key] || 0; });
    const sug = suggestTarget(hist);
    return (
      <Modal open onClose={() => setSheetKey(null)} size="sm" title={sheetCat.label}
        subtitle={<span className="bud-num">{feAuto(actual)}{target != null ? ` από ${feAuto(target)}` : ', χωρίς στόχο'}</span>}
        footer={<>
          <Btn variant="ghost" onClick={() => { setSheetKey(null); removeCategory(key); }}>Αφαίρεση</Btn>
          <Btn variant="primary" onClick={() => setSheetKey(null)}>Τέλος</Btn>
        </>}>
        <div style={{ display: 'grid', gap: T.sp.md }}>
          <NumberInput label="Μηνιαίος στόχος" value={budgets[key] ?? ''} onChange={v => updateBudget(key, v)} suffix="€" optional min={0} />
          <div style={{ ...TT.caption, marginTop: -4 }}>
            Άφησε κενό για κατηγορία χωρίς στόχο.
            {sug != null && sug !== target && <> <LinkBtn onClick={() => updateBudget(key, String(sug))}>{`Βάλε τον μέσο όρο: ${feAuto(sug)}`}</LinkBtn></>}
          </div>
          <TextInput label="Όνομα" value={labelOverrides[key] ?? sheetCat.label} onChange={v => { if (v.trim()) renameCategory(key, v); }} />
        </div>
        <div>
          <h3 style={{ ...TT.label, color: 'var(--text-primary)', margin: 0 }}>Κινήσεις του μήνα</h3>
          <p style={{ ...TT.caption, margin: `2px 0 ${T.sp.sm}px` }}>Κλείσε τον διακόπτη σε ό,τι δεν θέλεις να μετρά, π.χ. αν το πλήρωσε άλλος.</p>
          {items.length === 0
            ? <p style={{ ...TT.bodySm, margin: 0 }}>Καμία κίνηση σε αυτή την κατηγορία.</p>
            : <ul className="bud-items">{items.map(it => itemRow(it))}</ul>}
        </div>
      </Modal>
    );
  })();

  function itemRow(it: MonthItem) {
    const ex = excludedMap[it.id];
    const isEx = !!ex;
    const excl = exclAmountOf(it.id, it.amount);
    const partial = isEx && ex?.amount != null && ex.amount > 0 && ex.amount < it.amount;
    const name = `${it.label} ${fd(it.date)}`;
    const amtVal = exclAmtDraft[it.id] ?? (ex?.amount != null ? String(ex.amount) : '');
    return (
      <li key={it.id} className="bud-item">
        <div className="bud-item-row">
          <div style={{ minWidth: 0 }}>
            <div className="bud-ellipsis" style={{ ...TT.bodySm, color: isEx ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>{it.label}</div>
            <div style={{ ...TT.caption }} className="bud-num">{fd(it.date)}{it.paid ? '' : ' · εκκρεμεί'}{isEx ? (partial ? ` · μετρά ${feAuto(Math.max(0, it.amount - excl))}` : ' · δεν μετρά') : ''}</div>
          </div>
          <span className="bud-num" style={{ ...TT.bodySm, fontWeight: 600, color: isEx ? 'var(--text-tertiary)' : 'var(--text-primary)', textDecoration: isEx && !partial ? 'line-through' : 'none', whiteSpace: 'nowrap' }}>{feAuto(it.amount)}</span>
          <Toggle on={!isEx} ariaLabel={`${name}: μετρά στον προϋπολογισμό`}
            onChange={() => {
              if (isEx) { unexcludeItem(it.id); setExclAmtDraft(d => { const n = { ...d }; delete n[it.id]; return n; }); }
              // Χωρίς μήνυμα: ο διακόπτης ΕΙΝΑΙ η αναίρεση και το μήνυμα σκέπαζε τη λίστα.
              else excludeItem(it.id);
            }} />
        </div>
        {isEx && (
          <div className="bud-item-excl">
            <CustomSelect label="Λόγος" value={ex?.payer ?? ''} onChange={v => patchExcl(it.id, { payer: v })}
              options={[{ value: '', label: 'Χωρίς λόγο' }, ...PAYERS.map(p => ({ value: p, label: `Πληρώνει: ${p}` }))]} />
            <NumberInput label="Ποσό που εξαιρείται" value={amtVal} suffix="€" optional min={0}
              onChange={v => { setExclAmtDraft(d => ({ ...d, [it.id]: v })); const n = Number(String(v).replace(',', '.')); patchExcl(it.id, { amount: Number.isFinite(n) && n > 0 ? n : undefined }); }} />
            <div style={{ ...TT.caption, gridColumn: '1 / -1' }}>Κενό ποσό: δεν μετρά καθόλου.</div>
          </div>
        )}
      </li>
    );
  }

  // ── ΣΤΟΧΟΣ ΜΗΝΑ ────────────────────────────────────────────────────────────
  const targetSheet = targetOpen && (
    <TargetSheet initial={budgets.total ?? (masterBudget != null ? String(masterBudget) : (suggestedTotal != null ? String(suggestedTotal) : ''))}
      suggested={suggestedTotal} hasExplicit={!!budgets.total} sumOfCats={(() => { const s = activeCats.map(c => catBudget(c.key)).filter((v): v is number => v != null); return s.length ? sumCents(s) : null; })()}
      onClose={() => setTargetOpen(false)}
      onSave={v => { updateBudget('total', v); setTargetOpen(false); notify(v ? 'Ο μηνιαίος στόχος αποθηκεύτηκε' : 'Ο συνολικός στόχος αφαιρέθηκε'); }} />
  );

  // ── ΝΕΑ ΚΑΤΗΓΟΡΙΑ ────────────────────────────────────────────────────────────
  const addSheet = addOpen && (
    <AddCategorySheet hidden={hiddenBaseCats.map(c => ({ key: c.key, label: labelOverrides[c.key] ?? c.label }))}
      onClose={() => setAddOpen(false)} onAdd={n => { addCategory(n); setAddOpen(false); }} onRestore={k => { restoreCategory(k); setAddOpen(false); }} />
  );

  // ── ΕΤΗΣΙΑ ΕΙΚΟΝΑ ────────────────────────────────────────────────────────────
  // ΜΙΑ ΣΤΡΟΓΓΥΛΟΠΟΙΗΣΗ: τα ποσά από το ίδιο άθροισμα σε λεπτά με τις Δαπάνες,
  // χωρίς το στρογγύλεμα σε ευρώ του πυρήνα (2.527,00 έναντι 2.526,89).
  const ytdTarget = masterBudget != null ? masterBudget * monthsElapsed : null;
  const ytdProg = progress(ytdActual, ytdTarget);
  const yearPace = monthsElapsed > 0 ? (ytdActual / monthsElapsed) * 12 : 0;
  const annualCard = (Object.keys(monthTotals).length > 0) && (
    <Card gap={false}>
      <CardHead title="Ετήσια εικόνα" right={<span className="bud-num" style={{ ...TT.caption }}>{String(new Date().getFullYear())}</span>} />
      <div className="bud-kv">
        <span>Από την αρχή του έτους</span>
        <span className="bud-num"><strong style={{ color: 'var(--text-primary)' }}>{feAuto(ytdActual)}</strong>{ytdTarget != null && <span style={{ color: 'var(--text-tertiary)' }}> / {feAuto(ytdTarget)}</span>}</span>
      </div>
      {ytdProg && <div className="bud-bar" style={{ margin: `${T.sp.sm}px 0` }} aria-hidden="true"><span style={{ width: `${ytdProg.bar}%`, background: ytdProg.over ? 'var(--negative)' : BAR_FILL }} /></div>}
      <div className="bud-kv">
        <span>Με αυτόν τον ρυθμό, το έτος κλείνει στα</span>
        <span className="bud-num" style={{ color: masterBudget != null && yearPace > yearly(masterBudget) ? 'var(--negative)' : 'var(--text-primary)', fontWeight: 600 }}>{feAuto(yearPace)}</span>
      </div>
      {masterBudget != null && <div className="bud-kv"><span>Στόχος έτους</span><span className="bud-num">{feAuto(yearly(masterBudget))}</span></div>}
      {yearBars.some(x => x.value > 0) && <div style={{ marginTop: T.sp.lg }}><MonthBars data={yearBars} activeYm={viewYm} /></div>}
      {!wide && catYtd.length > 0 && <div style={{ marginTop: T.sp.lg }}><Donut slices={catYtd} /></div>}
    </Card>
  );

  // ── ΕΠΑΝΑΛΑΜΒΑΝΟΜΕΝΕΣ ────────────────────────────────────────────────────────
  // Η κεφαλίδα λέει μόνο το μηνιαίο· το ετήσιο είναι ×12 του ΙΔΙΟΥ αθροίσματος,
  // όχι άθροισμα στρογγυλεμένων ετήσιων (1.728,00 έναντι 1.727,88).
  const cad = (c: RecurringCharge['cadence']) => c === 'monthly' ? 'Κάθε μήνα' : c === 'bimonthly' ? 'Κάθε δύο μήνες' : c === 'quarterly' ? 'Κάθε τρίμηνο' : c === 'yearly' ? 'Κάθε χρόνο' : 'Ακανόνιστα';
  const recMonthly = sumCents(recurring.map(r => r.monthlyEquivalent));
  const recurringCard = recurring.length > 0 && (
    <Card gap={false}>
      <CardHead title="Επαναλαμβανόμενες χρεώσεις" info="Συνδρομές και πάγια που εντοπίζονται από τις καταχωρημένες δαπάνες σου, όταν ο ίδιος πάροχος επαναλαμβάνεται σε πολλούς μήνες."
        right={<span className="bud-num" style={{ ...TT.caption }}>{feAuto(recMonthly)}/μήνα</span>} />
      <ul className="bud-list">
        {recurring.slice(0, wide ? 5 : 10).map(r => (
          <li key={r.key} className="bud-list-row">
            <div style={{ minWidth: 0 }}>
              <div className="bud-ellipsis" style={{ ...TT.bodySm, color: 'var(--text-primary)' }}>{r.label}</div>
              <div style={{ ...TT.caption }} className="bud-num">{cad(r.cadence)} · επόμενη {fd(parseLocalDate(r.nextExpected))}</div>
            </div>
            <div style={{ textAlign: 'right' }} className="bud-num">
              <div style={{ ...TT.bodySm, color: 'var(--text-primary)', fontWeight: 600 }}>{feAuto(r.monthlyEquivalent)}/μήνα</div>
              <div style={{ ...TT.caption }}>{feAuto(yearly(r.monthlyEquivalent))}/έτος</div>
            </div>
          </li>
        ))}
      </ul>
      {recurring.length > 1 && <div className="bud-kv" style={{ marginTop: T.sp.sm }}><span>Τον χρόνο, όλες μαζί</span><span className="bud-num" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{feAuto(yearly(recMonthly))}</span></div>}
    </Card>
  );

  // ── ΤΑ ΥΠΟΛΟΙΠΑ, ΚΑΤΩ ΑΠΟ ΤΟ «ΠΕΡΙΣΣΟΤΕΡΑ» ──────────────────────────────────
  const weekCard = isCurMonth && weekTotalV > 0 && (
    <Card gap={false}>
      <CardHead title="Αυτή την εβδομάδα" right={<span className="bud-num" style={{ ...TT.caption }}>{feAuto(weekTotalV)}</span>} />
      <ul className="bud-list">
        {weekCats.map(c => (
          <li key={c.label} className="bud-week-row">
            <span className="bud-ellipsis" style={{ ...TT.bodySm, color: 'var(--text-primary)' }}>{c.label}</span>
            <span className="bud-bar" aria-hidden="true"><span style={{ width: `${(c.value / weekMax) * 100}%`, background: BAR_FILL }} /></span>
            <span className="bud-num" style={{ ...TT.bodySm, color: 'var(--text-primary)', fontWeight: 600, textAlign: 'right' }}>{feAuto(c.value)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );

  const excludedHere = viewItems.filter(it => !!excludedMap[it.id]);
  const exclCard = excludedHere.length > 0 && (
    <Card gap={false}>
      <CardHead title={`Εξαιρέσεις (${excludedHere.length})`} info="Κινήσεις που δεν μετρούν στον προϋπολογισμό, π.χ. γιατί τις πλήρωσε άλλος. Εξαιρείς μια κίνηση από το φύλλο της κατηγορίας της." />
      <ul className="bud-list">
        {excludedHere.map(it => (
          <li key={it.id} className="bud-list-row">
            <div style={{ minWidth: 0 }} id={`bud-ex-${it.id}`}>
              <div className="bud-ellipsis" style={{ ...TT.bodySm, color: 'var(--text-primary)' }}>{it.label}</div>
              <div style={{ ...TT.caption }} className="bud-num">{fd(it.date)} · εξαιρούνται {feAuto(exclAmountOf(it.id, it.amount))} από {feAuto(it.amount)}{excludedMap[it.id]?.payer ? ` · ${excludedMap[it.id]?.payer}` : ''}</div>
            </div>
            <Btn variant="ghost" onClick={() => unexcludeItem(it.id)} describedBy={`bud-ex-${it.id}`}>Να μετρά</Btn>
          </li>
        ))}
      </ul>
    </Card>
  );

  const suggestionsCard = isCurMonth && (targetSuggestions.length > 0 || insights.length > 0) && (
    <Card gap={false}>
      <CardHead title="Παρατηρήσεις" />
      <ul className="bud-list">
        {insights.map((t, i) => <li key={`i${i}`} style={{ ...TT.bodySm, padding: `${T.sp.sm}px 0` }}>{t}</li>)}
        {targetSuggestions.map(s => (
          <li key={s.key} style={{ padding: `${T.sp.sm}px 0`, display: 'grid', gap: T.sp.sm }}>
            <span style={{ ...TT.bodySm }}>{s.text}</span>
            <span style={{ display: 'flex', gap: T.sp.sm, flexWrap: 'wrap' }}>
              <Btn variant="secondary" onClick={s.apply}>{s.cta}</Btn>
              <Btn variant="ghost" onClick={() => dismissSuggestion(s.key)}>Όχι τώρα</Btn>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );

  const strCard = isCurMonth && isSTR && waterfall && (
    <Card gap={false}>
      <CardHead title="Από μεικτό σε καθαρό" info="Το έσοδο βραχυχρόνιας του μήνα μείον προμήθεια πλατφόρμας, τέλος ανθεκτικότητας ανά διανυκτέρευση, διαχείριση και εκτίμηση φόρου. Εκτίμηση· αλλάζεις τις παραδοχές από κάτω."
        right={strNights > 0 ? <span className="bud-num" style={{ ...TT.caption }}>{strNights === 1 ? '1 διανυκτέρευση' : `${fn(strNights)} διανυκτερεύσεις`}</span> : undefined} />
      {[
        { l: 'Μεικτό έσοδο', v: waterfall.gross as number | null, sub: false },
        { l: 'Προμήθεια πλατφόρμας', v: -waterfall.platformFee, sub: true },
        { l: 'Τέλος ανθεκτικότητας', v: waterfall.climateFee == null ? null : -waterfall.climateFee, sub: true },
        ...(waterfall.management > 0 ? [{ l: 'Διαχείριση', v: -waterfall.management, sub: true }] : []),
        { l: 'Κράτηση φόρου (εκτίμηση)', v: -waterfall.taxReserve, sub: true },
      ].map(r => (
        <div key={r.l} className="bud-kv" style={{ color: r.sub ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
          <span>{r.l}</span>
          {r.v == null ? <span>Λείπουν οι νύχτες</span> : <span className="bud-num">{feSigned(r.v)}</span>}
        </div>
      ))}
      <div className="bud-kv" style={{ borderTop: '1px solid var(--border-subtle)', marginTop: T.sp.sm, paddingTop: T.sp.sm, color: 'var(--text-primary)', fontWeight: 600 }}>
        <span>{waterfall.climateFee == null ? 'Καθαρό (χωρίς το τέλος)' : 'Καθαρό'}</span><span className="bud-num">{feSigned(waterfall.net)}</span>
      </div>
      <div style={{ ...TT.caption, marginTop: T.sp.sm }}>
        {waterfall.netPerNight != null ? <>Καθαρό ανά διανυκτέρευση <span className="bud-num">{feSigned(waterfall.netPerNight)}</span> · </> : null}Περιθώριο <span className="bud-num">{fpSigned(waterfall.marginPct)}</span>
      </div>
      <div className="bud-assume">
        {([
          { l: 'Προμήθεια πλατφόρμας %', raw: budgets.strPlatformPct ?? '15', val: strPlatformPct, key: 'strPlatformPct' },
          { l: 'Διαχείριση %', raw: budgets.strMgmtPct ?? '0', val: strMgmtPct, key: 'strMgmtPct' },
          { l: 'Συντελεστής φόρου %', raw: budgets.strTaxPct ?? String(taxPctAuto ?? 15), val: strTaxPct, key: 'strTaxPct' },
        ]).map(a => <NumberInput key={a.key} label={a.l} value={a.raw} onChange={v => updateBudget(a.key, v)} suffix="%" min={0} max={100} />)}
      </div>
    </Card>
  );

  const proCard = isPro && invReturns && (
    <Card gap={false}>
      <CardHead title="Απόδοση επένδυσης" info={`Καθαρό προ δόσης: έσοδα μείον λειτουργικές δαπάνες, χωρίς τη δόση. Ταμειακή ροή: αυτό μείον τη δόση. Καθαρή απόδοση: καθαρό προ δόσης / ${invReturns.onPurchase ? 'τιμή αγοράς' : 'τρέχουσα αξία'}, πριν από τον φόρο. Απόδοση ιδίων κεφαλαίων: ταμειακή ροή / ίδια κεφάλαια. Ενδεικτικά, σε ετήσια βάση.`} />
      <KPIGrid nested items={[
        { label: 'Καθαρό προ δόσης', value: feSigned(invReturns.noi) },
        { label: 'Ταμειακή ροή', value: feSigned(invReturns.preTaxCashFlow) },
        { label: YIELD_SHORT_LABELS.net_pre_tax, value: fpSigned(invReturns.capRatePct), fact: invReturns.onPurchase ? undefined : 'yield-net-recorded',
          sub: `${invReturns.onPurchase ? 'επί τιμής αγοράς' : 'επί τρέχουσας αξίας'}, ${YIELD_PRE_TAX_SUB}` },
        invReturns.cashOnCashPct != null
          ? { label: 'Απόδοση ιδίων κεφαλαίων', value: fpSigned(invReturns.cashOnCashPct) }
          : { label: 'Απόδοση ιδίων κεφαλαίων', value: ABSENT_SHORT, sub: 'χρειάζεται τιμή αγοράς και προκαταβολή' },
      ]} />
    </Card>
  );

  const businessCard = isPro && (
    <Card gap={false}>
      <CardHead title="Επιχειρηματικές υποχρεώσεις" />
      <p style={{ ...TT.bodySm, margin: 0 }}>
        Εκτός από τον φόρο εισοδήματος, ως επιχείρηση έχεις τις μηνιαίες εισφορές ΕΦΚΑ, την προκαταβολή φόρου για την επόμενη χρήση και, αν παρέχεις υπηρεσίες, τον ΦΠΑ. Τα ακριβή ποσά είναι στη Λογιστική.
      </p>
    </Card>
  );

  const settingToggle = (settingKey: string, on: boolean, title: string, desc: string) => (
    <button type="button" role="switch" aria-checked={on} className="bud-setting" onClick={() => updateBudget(settingKey, on ? 'false' : 'true')}>
      <ToggleTrack on={on} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ ...TT.bodySm, display: 'block', color: 'var(--text-primary)', fontWeight: 600 }}>{title}</span>
        <span style={{ ...TT.caption, display: 'block' }}>{desc}</span>
      </span>
    </button>
  );
  const settingsCard = (
    <Card gap={false}>
      <CardHead title="Ρυθμίσεις" />
      <div style={{ display: 'grid', gap: T.sp.sm }}>
        {settingToggle('notifyOverspend', notifyOn, 'Ειδοποίηση σε υπέρβαση', 'Μήνυμα όταν μια κατηγορία περάσει τον στόχο, με email και στο Ημερολόγιο.')}
        {settingToggle('rollover', rolloverOn, 'Μεταφορά υπολοίπου', 'Ό,τι περισσέψει ή λείψει μεταφέρεται στον επόμενο μήνα.')}
      </div>
    </Card>
  );

  // Ο υπότιτλος λέει ΜΟΝΟ ό,τι υπάρχει από κάτω, με τη σειρά του.
  const moreList: [ReactNode, string][] = [
    [!wide && annualCard, 'ετήσια εικόνα'], [!wide && recurringCard, 'επαναλαμβανόμενες'],
    [wide && catYtd.length > 0 && <Card gap={false}><CardHead title="Κατανομή ανά κατηγορία" /><Donut slices={catYtd} /></Card>, 'κατανομή'],
    [suggestionsCard, 'παρατηρήσεις'], [weekCard, 'εβδομάδα'], [exclCard, 'εξαιρέσεις'], [strCard, 'μεικτό και καθαρό'],
    [proCard, 'απόδοση'], [businessCard, 'υποχρεώσεις'], [settingsCard, 'ρυθμίσεις'],
  ];
  const present = moreList.filter(([n]) => !!n);
  const moreItems = present.map(([n]) => n);
  const moreSummary = (() => { const w = present.map(([, l]) => l); const t = listOf(w); return t.charAt(0).toUpperCase() + t.slice(1); })();
  const more = (
    <div className="bud-col">
      <button type="button" className="bud-more" aria-expanded={moreOpen} aria-controls="bud-more-body" onClick={() => toggleCollapse('more')}>
        <span style={{ minWidth: 0 }}>
          <span style={{ ...TT.label, color: 'var(--text-primary)', display: 'block' }}>Περισσότερα</span>
          <span style={{ ...TT.caption, display: 'block' }}>{moreSummary}</span>
        </span>
        <Chevron dir={moreOpen ? 'down' : 'right'} />
      </button>
      {moreOpen && <div id="bud-more-body" className="bud-col">{moreItems.map((x, i) => <div key={i}>{x}</div>)}</div>}
    </div>
  );

  const left = (
    <div className="bud-col">
      {demoBar}
      {isEmpty ? emptyCard : <>{hero}{!wide && attentionBlock}{categories}</>}
    </div>
  );
  const right = (
    <div className="bud-col">
      {wide && attentionBlock}
      {wide && recurringCard}
      {wide && annualCard}
      {more}
    </div>
  );

  return (
    <div className="bud">
      {header}
      <div className="bud-grid">{left}{right}</div>
      {sheet}{targetSheet}{addSheet}
      <BudgetStyles />
    </div>
  );
}

// ── ΦΥΛΛΟ: Ο ΣΤΟΧΟΣ ΤΟΥ ΜΗΝΑ ───────────────────────────────────────────────────
function TargetSheet({ initial, suggested, hasExplicit, sumOfCats, onClose, onSave }: {
  initial: string; suggested: number | null; hasExplicit: boolean; sumOfCats: Target; onClose: () => void; onSave: (v: string) => void;
}) {
  const [v, setV] = useState(initial);
  return (
    <Modal open onClose={onClose} size="sm" title="Μηνιαίος στόχος"
      footer={<>
        {hasExplicit && <Btn variant="ghost" onClick={() => onSave('')}>Χωρίς συνολικό στόχο</Btn>}
        <Btn variant="primary" onClick={() => onSave(v.trim())} disabled={!v.trim()}>Αποθήκευση</Btn>
      </>}>
      <NumberInput label="Πόσα θέλεις να ξοδεύεις τον μήνα" value={v} onChange={setV} suffix="€" optional min={0} />
      <p style={{ ...TT.bodySm, margin: 0 }}>
        {suggested != null ? <>Ο μέσος όρος των τελευταίων μηνών είναι <span className="bud-num">{feAuto(suggested)}</span>. </> : null}
        {sumOfCats != null ? <>Οι στόχοι των κατηγοριών σου αθροίζουν <span className="bud-num">{feAuto(sumOfCats)}</span>. </> : null}
        Χωρίς συνολικό στόχο, μετράμε το άθροισμα των στόχων των κατηγοριών.
      </p>
    </Modal>
  );
}

// ── ΦΥΛΛΟ: ΝΕΑ ΚΑΤΗΓΟΡΙΑ ─────────────────────────────────────────────────────────
function AddCategorySheet({ hidden, onClose, onAdd, onRestore }: {
  hidden: { key: string; label: string }[]; onClose: () => void; onAdd: (name: string) => void; onRestore: (key: string) => void;
}) {
  const [name, setName] = useState('');
  return (
    <Modal open onClose={onClose} size="sm" title="Νέα κατηγορία"
      footer={<><Btn variant="ghost" onClick={onClose}>Ακύρωση</Btn><Btn variant="primary" disabled={!name.trim()} onClick={() => onAdd(name)}>Προσθήκη</Btn></>}>
      <TextInput label="Όνομα κατηγορίας" value={name} onChange={setName} placeholder="Καθαριότητα, φύλαξη"
        onKeyDown={e => { if (e.key === 'Enter' && name.trim()) onAdd(name); }} />
      {hidden.length > 0 && (
        <div>
          <h3 style={{ ...TT.label, color: 'var(--text-primary)', margin: `0 0 ${T.sp.sm}px` }}>Ή επανάφερε μία που αφαίρεσες</h3>
          <div style={{ display: 'flex', gap: T.sp.sm, flexWrap: 'wrap' }}>
            {hidden.map(h => <ChipToggle key={h.key} on={false} onClick={() => onRestore(h.key)}>{h.label}</ChipToggle>)}
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── ΤΟ ΣΤΥΛ ΤΗΣ ΟΘΟΝΗΣ, ΣΕ ΚΛΑΣΕΙΣ ──────────────────────────────────────────────
// Οι media queries και το :hover δεν γράφονται inline. Ενα σημείο για κάθε
// απόσταση: 16 ανάμεσα σε κάρτες, 12 μέσα σε κάρτα, 44 κάθε στόχος αφής.
function BudgetStyles() {
  return (
    <style>{`
      .bud { max-width: 1120px; font-family: ${T.font.sans}; color: var(--text-primary); }
      .bud-num { font-family: ${T.font.num}; font-variant-numeric: tabular-nums; }
      .bud-ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .bud-head { display: grid; gap: ${T.sp.md}px; margin-bottom: ${T.sp.xl}px; }
      .bud-head-row { display: flex; align-items: center; justify-content: space-between; gap: ${T.sp.md}px; flex-wrap: wrap; }
      .bud-head-row .po-link, .bud-hero-top .po-link { white-space: nowrap; }
      @media (max-width: 380px) { .bud-head-row > .po-btn { flex: 1 1 100%; } }
      .bud-month { display: flex; align-items: center; gap: ${T.sp.xs}px; margin-left: -8px; flex-wrap: wrap; min-width: 0; }
      .bud-month-label { min-width: 136px; text-align: center; font-size: var(--fs-base); font-weight: 600; color: var(--text-primary); }
      .bud-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: ${T.sp.lg}px; align-items: start; }
      @media (min-width: 1024px) { .bud-grid { grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); gap: ${T.sp.xxl}px; } }
      .bud-col { display: grid; gap: ${T.sp.lg}px; min-width: 0; }
      .bud-card-head > :last-child:not(h2):not(h3) { white-space: nowrap; flex-shrink: 0; }
      .bud-card-head { display: flex; align-items: center; justify-content: space-between; gap: ${T.sp.md}px; min-height: 24px; margin-bottom: ${T.sp.md}px; }
      .bud-hero-top { display: flex; align-items: baseline; justify-content: space-between; gap: ${T.sp.md}px; margin-bottom: ${T.sp.sm}px; }
            .bud-hero-fig { display: flex; align-items: baseline; gap: ${T.sp.sm}px; flex-wrap: wrap; }
      .bud-big { font-family: ${T.font.num}; font-variant-numeric: tabular-nums; font-size: 32px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.1; }
      .bud-bar { display: block; height: 4px; border-radius: ${T.radius.hair}px; background: var(--bg-overlay); overflow: hidden; width: 100%; }
      .bud-bar > span { display: block; height: 100%; border-radius: inherit; transition: width 0.5s ease; }
      .bud-bar-lg { height: 8px; border-radius: ${T.radius.pill}px; margin: ${T.sp.md}px 0 ${T.sp.sm}px; }
      .bud-hero-cap { display: flex; justify-content: space-between; gap: ${T.sp.md}px; flex-wrap: wrap; font-size: var(--fs-xs); color: var(--text-tertiary); line-height: 1.45; }
      .bud-hero-cash { display: flex; align-items: center; justify-content: space-between; gap: ${T.sp.md}px; margin-top: ${T.sp.lg}px; padding-top: ${T.sp.md}px; border-top: 1px solid var(--border-subtle); }
      .bud-attn { display: grid; gap: ${T.sp.sm}px; }
      .bud-attn > .bud-card-head { margin-bottom: ${T.sp.xs}px; }
      .bud-chips { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: ${T.sp.sm}px; }
      .bud-chip { display: inline-flex; align-items: center; gap: ${T.sp.sm}px; min-height: var(--h-md); padding: 0 ${T.sp.md}px; border-radius: ${T.radius.pill}px; border: 1px solid var(--border-subtle); background: var(--surface-raised); color: var(--text-primary); font: inherit; font-size: var(--fs-note); cursor: pointer; transition: background 0.15s, border-color 0.15s; }
      .bud-chip:hover { background: var(--bg-elevated); border-color: var(--border-default); }
      .bud-chip:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
      .bud-chip svg { color: var(--text-tertiary); }
      .bud-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
      .bud-cats, .bud-list, .bud-items { list-style: none; margin: 0; padding: 0; }
      .bud-cat { display: grid; grid-template-columns: minmax(0, 1fr) auto 16px; grid-template-rows: auto 16px auto; column-gap: ${T.sp.md}px; row-gap: 6px; align-items: center; width: calc(100% + 16px); margin: 0 -8px; padding: 10px 8px; min-height: 56px; border: 0; border-radius: ${T.radius.inner}px; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; transition: background 0.15s; }
      .bud-cats > li + li { border-top: 1px solid var(--border-subtle); }
      .bud-cat:hover { background: var(--bg-elevated); }
      .bud-cat:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
      .bud-cat-name { grid-column: 1; grid-row: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--fs-base); font-weight: 500; }
      .bud-cat-amt { grid-column: 2; grid-row: 1; white-space: nowrap; font-size: var(--fs-base); text-align: right; }
      .bud-cat-chev { grid-column: 3; grid-row: 1 / -1; color: var(--text-tertiary); display: inline-flex; }
      .bud-cat-line { grid-column: 1 / span 2; grid-row: 2; display: flex; align-items: center; min-width: 0; height: 16px; }
      .bud-cat-status { grid-column: 1 / span 2; grid-row: 3; font-size: var(--fs-xs); font-weight: 600; line-height: 1.45; margin-top: -2px; }
      .bud-cats-foot { display: flex; justify-content: space-between; align-items: center; gap: ${T.sp.sm}px ${T.sp.lg}px; flex-wrap: wrap; margin-top: ${T.sp.xs}px; padding-top: ${T.sp.md}px; border-top: 1px solid var(--border-subtle); }
      .bud-cats-foot > :only-child { margin-left: auto; }
      .bud-list > li + li, .bud-items > li + li { border-top: 1px solid var(--border-subtle); }
      .bud-list-row { display: flex; align-items: center; justify-content: space-between; gap: ${T.sp.md}px; padding: 10px 0; min-height: 56px; }
      .bud-week-row { display: grid; grid-template-columns: minmax(0, 140px) minmax(0, 1fr) 96px; gap: ${T.sp.md}px; align-items: center; padding: 10px 0; }
      .bud-kv { display: flex; justify-content: space-between; align-items: baseline; gap: ${T.sp.md}px; font-size: var(--fs-note); color: var(--text-secondary); padding: 4px 0; }
      .bud-item { padding: ${T.sp.sm}px 0; }
      .bud-item-row { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: ${T.sp.md}px; min-height: 48px; }
      .bud-item-excl { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: ${T.sp.sm}px ${T.sp.md}px; margin-top: ${T.sp.sm}px; padding: ${T.sp.md}px; border-radius: ${T.radius.inner}px; background: var(--bg-elevated); }
      @media (max-width: 420px) { .bud-item-excl { grid-template-columns: minmax(0, 1fr); } }
      .bud-note { display: flex; align-items: center; gap: ${T.sp.md}px; flex-wrap: wrap; padding: ${T.sp.md}px ${T.sp.lg}px; border-radius: ${T.radius.card}px; border: 1px solid var(--border-subtle); background: var(--bg-elevated); }
      .bud-more { display: flex; align-items: center; justify-content: space-between; gap: ${T.sp.md}px; width: 100%; min-height: 64px; padding: ${T.sp.md}px ${T.sp.lg}px; border-radius: ${T.radius.card}px; border: 1px solid var(--border-raised); background: var(--surface-raised); box-shadow: var(--highlight-inset), var(--elev-1); color: var(--text-tertiary); font: inherit; text-align: left; cursor: pointer; transition: background 0.15s; }
      .bud-more:hover { background: var(--bg-elevated); }
      .bud-more:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
      .bud-setting { width: 100%; display: flex; align-items: center; gap: ${T.sp.md}px; padding: ${T.sp.md}px; border-radius: ${T.radius.inner}px; border: 1px solid var(--border-subtle); background: var(--bg-elevated); color: inherit; font: inherit; text-align: left; cursor: pointer; }
      .bud-setting:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
      .bud-assume { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr)); gap: ${T.sp.md}px; margin-top: ${T.sp.md}px; padding-top: ${T.sp.md}px; border-top: 1px solid var(--border-subtle); }
      @media (max-width: 560px) { .bud-big { font-size: 28px; } .bud-month-label { min-width: 0; padding: 0 ${T.sp.xs}px; } }
    `}</style>
  );
}
