'use client';
// ═══════════════════════════════════════════════════════════════════════════
// ΥΠΟΛΟΓΙΣΜΟΣ ΔΟΣΗΣ ΣΤΕΓΑΣΤΙΚΟΥ: ο διαδραστικός πυρήνας
// ─────────────────────────────────────────────────────────────────────────
// ΔΥΟ ΕΡΩΤΗΣΕΙΣ, ΜΕ ΤΗ ΣΕΙΡΑ ΠΟΥ ΤΙΣ ΚΑΝΕΙ ΚΑΝΕΙΣ. Πρώτα «πόσο θα πληρώνω τον
// μήνα για αυτό το δάνειο», μετά «πόσο δάνειο μου επιτρέπει ο μισθός μου». Η
// δεύτερη ξαναχρησιμοποιεί το επιτόκιο και τη διάρκεια της πρώτης: ο επισκέπτης
// δεν τα γράφει δύο φορές και τα δύο νούμερα δεν μπορούν να διαφωνήσουν.
//
// ΤΟ ΕΠΙΤΟΚΙΟ ΔΕΝ ΓΡΑΦΕΤΑΙ ΑΠΟ ΤΟ ΧΕΡΙ ΜΑΣ. Αν ο διακομιστής διάβασε το μέσο
// σταθερό πάνω από 1 έτος των νέων στεγαστικών (ΕΚΤ, στοιχεία ΤτΕ, σειρά MIR
// A2C.K), το πεδίο «Σταθερό επιτόκιο» ξεκινά από εκεί και η βοήθεια από κάτω
// λέει ποια τιμή είναι και από ποιον μήνα. Αλλιώς ξεκινά άδειο και η σελίδα
// ζητά το επιτόκιο της προσφοράς. Ένα «3,50%» γραμμένο στον κώδικα θα ήταν
// τρέχον μόνο τη μέρα που γράφτηκε.
//
// ΠΟΤΕ ΑΠΟ ΤΟΝ ΜΕΣΟ ΟΡΟ Ή ΑΠΟ ΤΟ ΚΥΜΑΙΝΟΜΕΝΟ. Ως τις 13/10/2026 το πεδίο ξεκινούσε
// από τη σειρά A2C.F, δηλαδή από το κυμαινόμενο ή σταθερό έως 1 έτος. Η
// αφετηρία ζει πλέον στην `startRates` και ελέγχεται στο stegastiko.test.ts.
//
// ΧΩΡΙΣ ΣΤΑΘΕΡΟ, ΑΝΟΙΓΕΙ ΣΤΟ «ΚΥΜΑΙΝΟΜΕΝΟ» ΜΕ ΔΟΣΗ (19/10/2026). Η σειρά K δεν
// ήρθε ποτέ και η σελίδα άνοιγε χωρίς δόση. Ο τύπος της διεύθυνσης ξεκινά κενός
// («αυτόματος»): η `startRates` διαλέγει. Παλιός σύνδεσμος με επιτόκιο και
// χωρίς τύπο ανοίγει στο «Σταθερό», όπως όταν δημιουργήθηκε.
//
// ΜΙΑ ΠΗΓΗ ΓΙΑ ΤΗΝ ΑΡΙΘΜΗΤΙΚΗ: lib/tools/stegastiko.ts, που καλεί τις ίδιες
// συναρτήσεις δανείου με τον πίνακα ελέγχου. Η οθόνη δεν κάνει πράξεις.
// ═══════════════════════════════════════════════════════════════════════════
import { useId, useMemo, useState, type ReactNode } from 'react';
import { T } from '@/components/tokens';
import { Btn } from '@/components/Theme';
import { fmtFor } from '@/lib/core/format';
import { parseAmount } from '@/lib/core/greek';
import { DSTI_LIMIT } from '@/lib/loans/affordability';
import {
  parseRate, loanRate, mortgagePlan, borrowingCapacity, rateField, freshFact, startRates, spreadHint, RATE_CAP, YEARS_CAP,
  type MortgageMarket, type RateKind,
} from '@/lib/tools/stegastiko';
import { useToolState, ToolActions, ToolPaper, ToolPaperFoot } from '@/app/ToolShare';
import { EstimateNote, ToolClampNote } from '@/app/ToolNotes';
import { ToolNumField, ToolFields, ToolSeg, ToolHero, ToolLedger, ToolStats } from '@/app/ToolParts';
import LiveResult from '@/components/LiveResult';
import { useLocale } from '@/lib/i18n/useLocale';
import { localHref } from '@/lib/i18n/paths';
import { MORTGAGE_EN } from '@/lib/i18n/en/tools/mortgage';

/**
 * Τα πεδία όπως ταξιδεύουν στη διεύθυνση. Τα επιτόκια ξεκινούν κενά: τα
 * συμπληρώνει η τιμή αγοράς (`fill`), οπότε ένας κοινοποιημένος σύνδεσμος
 * κουβαλά πάντα το επιτόκιο με το οποίο βγήκε το αποτέλεσμα, όχι το αυριανό.
 */
const SPEC = {
  poso: '150000', eti: '25', typos: '', epitokio: '', euribor: '', perithorio: '',
  eisodima: '2000', doseis: '0', proti: 'nai',
} as const;
const PATH = '/ypologismos-stegastikou-daneiou';

/** Πόσα έτη φαίνονται πριν ανοίξει ο πίνακας. */
const YEARS_SHOWN = 5;

const amount = (s: string): number => Math.max(0, parseAmount(s) ?? 0);

/** Ομάδα πεδίων με τίτλο, όπως στον υπολογιστή καθαρής απόδοσης. */
function Group({ title, children, first }: { title: string; children: React.ReactNode; first?: boolean }) {
  return (
    <fieldset className="po-tool-controls" style={{ border: 0, padding: 0, margin: first ? 0 : `${T.sp.xl}px 0 0`, minWidth: 0 }}>
      <legend style={{ padding: 0, margin: '0 0 12px', fontSize: 14, fontWeight: 600,
        color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{title}</legend>
      {children}
    </fieldset>
  );
}

/** Η κάρτα του αποτελέσματος, ίδια γεωμετρία με τους άλλους υπολογιστές. */
function ResultCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="po-tool-result" style={{
      marginTop: 20, padding: 'clamp(18px, 4vw, 26px)', borderRadius: T.radius.card,
      background: 'var(--surface-raised)', border: '1px solid var(--border-raised)',
      boxShadow: 'var(--well-inset)',
    }}>{children}</div>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => (
  <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: 'var(--text-secondary)' }}>{children}</p>
);

export function MortgageCalculator({ market, today, cta, exampleRate }: {
  market: MortgageMarket; today: string;
  /**
   * Το επιτόκιο του λυμένου παραδείγματος της σελίδας (`EX.rate`, page.tsx).
   * ΔΕΝ γεμίζει το πεδίο μόνο του: όταν η αγορά δεν διαβάστηκε, η κάρτα το
   * προσφέρει με ένα πάτημα και η βοήθεια λέει ότι είναι παράδειγμα.
   */
  exampleRate?: number;
  /** Η πρόσκληση του τέλους, αποδομένη στη σελίδα: βλ. `ToolCta` στο app/PublicChrome.tsx. */
  cta: ReactNode;
}) {
  // Η ΤΙΜΗ ΑΓΟΡΑΣ ΜΠΑΙΝΕΙ ΜΟΝΟ ΑΝ ΕΙΝΑΙ ΦΡΕΣΚΙΑ ΚΑΙ ΜΟΝΟ ΑΝ Η ΔΙΕΥΘΥΝΣΗ ΔΕΝ ΕΙΠΕ
  // ΑΛΛΗ. Παλιά τιμή δεν προτείνεται ως αφετηρία· γράφεται από κάτω με τη
  // δική της ημερομηνία, για αναφορά.
  // ── Η ΙΔΙΑ ΟΘΟΝΗ ΣΤΑ ΑΓΓΛΙΚΑ (/en/mortgage-calculator) ────────────────────
  const locale = useLocale(), en = locale === 'en', E = MORTGAGE_EN, path = localHref(locale, PATH);
  const { fe, fn, fp, fpRate } = fmtFor(locale);
  const fixed = freshFact(market.fixed);
  const euribor = freshFact(market.euribor);
  const start = startRates(market);
  const [v, set] = useToolState(SPEC, path, x => {
    // Ο,τι διαφέρει από την προεπιλογή ήρθε από τη διεύθυνση: ένας παλιός
    // σύνδεσμος χωρίς `typos` εννοούσε «Σταθερό», την τότε προεπιλογή.
    const fromLink = (Object.keys(SPEC) as (keyof typeof SPEC)[]).some(k => x[k] !== SPEC[k]);
    return {
      ...x,
      typos: x.typos || (!fromLink && start.kind === 'floating' ? 'kymainomeno' : 'stathero'),
      epitokio: x.epitokio || start.fixed,
      euribor: x.euribor || start.euribor,
      perithorio: x.perithorio || start.spread,
    };
  });
  const marketSpreadHint = en ? E.marginMarket(market) : spreadHint(market);
  const ids = {
    poso: useId(), eti: useId(), epitokio: useId(), euribor: useId(), perithorio: useId(),
    eisodima: useId(), doseis: useId(),
  };
  const [allYears, setAllYears] = useState(false);

  const kind: RateKind = v.typos === 'kymainomeno' ? 'floating' : 'fixed';
  const loan = amount(v.poso);
  const yearsTyped = amount(v.eti);
  const years = Math.min(YEARS_CAP, yearsTyped);
  const typedRate = loanRate({ kind, fixed: parseRate(v.epitokio), euribor: parseRate(v.euribor), spread: parseRate(v.perithorio) });
  const rate = typedRate === null ? null : Math.min(RATE_CAP, typedRate);

  const plan = useMemo(() => (rate === null ? null : mortgagePlan(loan, rate, years)), [loan, rate, years]);
  // ΤΟ ΚΥΜΑΙΝΟΜΕΝΟ ΜΕ ΜΙΑ ΜΟΝΑΔΑ ΠΑΡΑΠΑΝΩ: όχι πρόβλεψη, ένα «τι αν» με
  // στρογγυλό βήμα, ώστε η αβεβαιότητα να φαίνεται σε ευρώ και όχι σε επίθετα.
  const plus1 = useMemo(() => (kind === 'floating' && rate !== null ? mortgagePlan(loan, rate + 1, years) : null), [kind, loan, rate, years]);

  const income = amount(v.eisodima);
  const debts = amount(v.doseis);
  const firstTime = v.proti !== 'oxi';
  const cap = useMemo(() => (rate === null || years <= 0 ? null : borrowingCapacity({
    incomeMonthly: income, firstTimeBuyer: firstTime, existingMonthlyDebt: debts,
    desiredAmount: loan, ratePct: rate, years,
  })), [income, firstTime, debts, loan, rate, years]);
  // ΤΟ ΜΕΡΙΔΙΟ ΒΓΑΙΝΕΙ ΑΠΟ ΤΗ ΔΟΣΗ ΠΟΥ ΔΕΙΧΝΕΙ Η ΚΑΡΤΑ ΑΠΟ ΠΑΝΩ, ΟΧΙ ΑΠΟ
  // ΣΤΡΟΓΓΥΛΕΜΕΝΗ. Αλλιώς δύο κάρτες, ένα δάνειο, δύο δόσεις.
  const burden = plan ? plan.monthly + debts : 0;
  const share = income > 0 && plan ? (burden / income) * 100 : null;
  const over = cap ? burden - cap.maxMonthly : 0;

  const hasLoan = loan > 0 && years > 0;
  const rateHint = (typed: string, fact: typeof fixed, label: string, enHint?: (f: NonNullable<typeof fixed>) => string) => fact && typed === rateField(fact.value)
    ? (en && enHint ? enHint(fact) : `${label} ${fact.period}, ${fact.source}. Αν η προσφορά σου γράφει άλλο, γράψε εκείνο.`)
    : null;

  const schedule = plan?.schedule ?? [];
  // ΚΑΜΙΑ ΚΕΝΗ ΚΑΡΤΑ (02.11.2026). Χωρίς τιμή αγοράς το πεδίο ξεκινά άδειο και
  // η κάρτα της δόσης έμενε σκέτη πρόταση. Τώρα προσφέρει το επιτόκιο του
  // παραδείγματος της σελίδας με ένα πάτημα, ονομασμένο ως παράδειγμα.
  const exampleField = exampleRate != null ? rateField(exampleRate) : null;

  return (
    <div style={{ fontFamily: T.font.sans }}>
      {/* ── ΤΟ ΔΑΝΕΙΟ ───────────────────────────────────────────────────── */}
      <Group title={en ? E.loan : 'Το δάνειο'} first>
        <ToolFields>
          <ToolNumField id={ids.poso} label={en ? E.amount : 'Ποσό δανείου'} value={v.poso} onChange={x => set('poso', x)} unit="€"/>
          <ToolNumField id={ids.eti} label={en ? E.term : 'Διάρκεια'} value={v.eti} onChange={x => set('eti', x)}
            mode="numeric" unit={en ? E.years : 'έτη'} unitPad={48}/>
          <ToolSeg label={en ? E.rate : 'Επιτόκιο'} value={v.typos} onChange={x => set('typos', x)}
            options={en ? [{ value: 'stathero', label: E.fixed }, { value: 'kymainomeno', label: E.floating }]
              : [{ value: 'stathero', label: 'Σταθερό' }, { value: 'kymainomeno', label: 'Κυμαινόμενο' }]}/>
        </ToolFields>
        <div style={{ marginTop: T.sp.lg }}>
          <ToolFields>
            {kind === 'fixed' ? (
              <ToolNumField id={ids.epitokio} label={en ? E.fixedRate : 'Σταθερό επιτόκιο'} value={v.epitokio}
                onChange={x => set('epitokio', x)} unit="%" span={2}
                hint={rateHint(v.epitokio, fixed, `${fixed?.label ?? ''}, μέσος όρος νέων στεγαστικών`, E.fixedMarket)
                  ?? (exampleField && v.epitokio === exampleField
                    ? 'Επιτόκιο του παραδείγματος, όχι τιμή αγοράς. Γράψε αυτό της προσφοράς σου.'
                    : en ? E.fixedHint : 'Το ονομαστικό επιτόκιο που γράφει η προσφορά της τράπεζας.')}/>
            ) : (<>
              <ToolNumField id={ids.euribor} label="Euribor" value={v.euribor}
                onChange={x => set('euribor', x)} unit="%"
                hint={rateHint(v.euribor, euribor, 'Euribor τριμήνου, μέσος όρος', E.euriborMarket)
                  ?? (en ? E.euriborHint : 'Ο δείκτης της σύμβασης, συνήθως τριμήνου.')}/>
              <ToolNumField id={ids.perithorio} label={en ? E.margin : 'Περιθώριο τράπεζας'} value={v.perithorio}
                onChange={x => set('perithorio', x)} unit="%"
                hint={(marketSpreadHint && v.perithorio === start.spread ? marketSpreadHint : null)
                  ?? (en ? E.marginHint : 'Το περιθώριο που γράφει η προσφορά, πάνω από το Euribor.')}/>
            </>)}
          </ToolFields>
        </div>
        <ToolClampNote notes={[
          yearsTyped > YEARS_CAP && en && E.clampYears(YEARS_CAP),
          typedRate !== null && typedRate > RATE_CAP && en && E.clampRate(fpRate(RATE_CAP)),
          yearsTyped > YEARS_CAP && !en && `Μέγιστη διάρκεια ${YEARS_CAP} έτη· υπολογίστηκε με ${YEARS_CAP}.`,
          typedRate !== null && typedRate > RATE_CAP && !en && `Μέγιστο επιτόκιο ${fpRate(RATE_CAP)}· υπολογίστηκε με ${fpRate(RATE_CAP)}.`,
        ]}/>
      </Group>

      <ToolPaper title={en ? E.paper : 'Δόση στεγαστικού δανείου'} on={today} inputs={en ? [
        { k: E.pAmount, v: fe(loan) },
        { k: E.term, v: E.yearsOf(fn(years)) },
        { k: kind === 'fixed' ? E.fixedRate : E.pFloating, v: rate === null ? E.notGiven : fp(rate) },
        { k: E.pIncome, v: fe(income) },
        { k: E.pDebts, v: fe(debts) },
      ] : [
        { k: 'Ποσό', v: fe(loan) },
        { k: 'Διάρκεια', v: `${fn(years)} έτη` },
        { k: kind === 'fixed' ? 'Σταθερό επιτόκιο' : 'Κυμαινόμενο', v: rate === null ? 'δεν δόθηκε' : fp(rate) },
        { k: 'Καθαρό εισόδημα', v: fe(income) },
        { k: 'Άλλες δόσεις', v: fe(debts) },
      ]}/>

      {/* ── Η ΔΟΣΗ ─────────────────────────────────────────────────────── */}
      <ResultCard>
        {!hasLoan ? (
          <Empty>{en ? E.needLoan : 'Η δόση χρειάζεται ποσό και διάρκεια.'}</Empty>
        ) : !plan || rate === null ? (
          <>
            <Empty>
              {en ? (kind === 'fixed' ? E.needFixed : E.needFloating) : kind === 'fixed'
                ? 'Γράψε το επιτόκιο της προσφοράς σου για να βγει η δόση. Το βρίσκεις στην προσφορά της τράπεζας ή στο δελτίο επιτοκίων της.'
                : 'Γράψε το Euribor και το περιθώριο της τράπεζας για να βγει η δόση.'}
            </Empty>
            {kind === 'fixed' && exampleRate != null && exampleField && (
              <div className="po-noprint" style={{ marginTop: 14 }}>
                <Btn variant="secondary" onClick={() => set('epitokio', exampleField)}>
                  {en ? `See an example at ${fp(exampleRate)}` : `Δες ένα παράδειγμα με ${fp(exampleRate)}`}
                </Btn>
              </div>
            )}
          </>
        ) : (
          <>
            <ToolHero primary={{ label: en ? E.monthly : 'Μηνιαία δόση', value: fe(plan.monthly) }}
              secondary={[
                { label: en ? E.totalInterest : 'Σύνολο τόκων', value: fe(plan.totalInterest) },
                { label: en ? E.rate : 'Επιτόκιο', value: fp(rate) },
              ]}/>
            <LiveResult say={en ? E.say(fe(plan.monthly), fe(plan.totalInterest)) : `Μηνιαία δόση ${fe(plan.monthly)}. Σύνολο τόκων ${fe(plan.totalInterest)}.`}/>
            {plus1 && (
              <p style={{ margin: '12px 0 0', fontSize: 13, lineHeight: 1.55, color: 'var(--text-tertiary)', textWrap: 'pretty' }}>
                {en ? E.plus1(fp(parseRate(v.euribor) ?? 0), fe(plus1.monthly)) : <>Η δόση ισχύει όσο το Euribor μένει στο {fp(parseRate(v.euribor) ?? 0)}. Αν ανέβει μία μονάδα,
                γίνεται {fe(plus1.monthly)}.</>}
              </p>
            )}

            <div style={{ height: 1, background: 'var(--border-subtle)', margin: '20px 0 16px' }}/>

            <ToolLedger rows={en ? [
              { k: E.principal, v: fe(loan) },
              { k: E.interest, v: fe(plan.totalInterest) },
              { k: E.total(fn(plan.months)), v: fe(plan.totalPaid), kind: 'total' },
            ] : [
              { k: 'Κεφάλαιο', v: fe(loan) },
              { k: 'Τόκοι', v: fe(plan.totalInterest) },
              { k: `Σύνολο ${fn(plan.months)} δόσεων`, v: fe(plan.totalPaid), kind: 'total' },
            ]}/>
            {/* Ο ΠΡΩΤΟΣ ΧΡΟΝΟΣ ΕΙΝΑΙ ΤΟ ΝΟΥΜΕΡΟ ΠΟΥ ΞΑΦΝΙΑΖΕΙ: το μεγαλύτερο μέρος
                της δόσης είναι τόκος. Δύο ποσά και το μερίδιο, χωρίς σχόλιο. */}
            <ToolStats items={[
              { k: en ? E.y1Interest : 'Τόκοι πρώτου έτους', v: fe(plan.firstYear.interest) },
              { k: en ? E.y1Principal : 'Κεφάλαιο πρώτου έτους', v: fe(plan.firstYear.principal) },
              { k: en ? E.y1Share : 'Μερίδιο τόκου πρώτου έτους', v: fp(plan.firstYear.interest + plan.firstYear.principal > 0
                ? (plan.firstYear.interest / (plan.firstYear.interest + plan.firstYear.principal)) * 100 : 0) },
            ]}/>
          </>
        )}
      </ResultCard>

      <ToolActions path={path} spec={SPEC} values={v}/>

      {/* ── Η ΑΠΟΣΒΕΣΗ ΑΝΑ ΕΤΟΣ ──────────────────────────────────────────
          Πέντε χρόνια στην οθόνη, όλα με ένα πάτημα και όλα στο χαρτί. Ο
          πίνακας κλείνει: τα κεφάλαια αθροίζουν στο ποσό του δανείου. */}
      {plan && schedule.length > 0 && (
        <div style={{ marginTop: T.sp.xxl }}>
          <div className="po-table-box">
           <div className="po-scroll-x" style={{ overflowX: 'auto' }}>
            <table className="po-table po-tool-table tbl-fixed" style={{ '--tbl-min': '300px' }}>
              <caption>{en ? E.schedule : 'Τόκοι και κεφάλαιο ανά έτος'}</caption>
              <colgroup>
                <col style={{ width: '16%' }} />
                <col style={{ width: '28%' }} />
                <col style={{ width: '28%' }} />
                <col style={{ width: '28%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">{en ? E.colYear : 'Έτος'}</th>
                  <th scope="col" className="num">{en ? E.colInterest : 'Τόκοι'}</th>
                  <th scope="col" className="num">{en ? E.colPrincipal : 'Κεφάλαιο'}</th>
                  <th scope="col" className="num">{en ? E.colBalance : 'Υπόλοιπο'}</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((row, i) => (
                  <tr key={row.year} className={allYears || i < YEARS_SHOWN ? undefined : 'po-row-more'}>
                    <th scope="row" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 400, color: 'var(--text-primary)' }}>{row.year}</th>
                    <td className="num">{fe(row.interest)}</td>
                    <td className="num">{fe(row.principal)}</td>
                    <td className="num">{fe(row.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
           </div>
          </div>
          {schedule.length > YEARS_SHOWN && (
            <div className="po-noprint" style={{ marginTop: 10 }}>
              <Btn onClick={() => setAllYears(a => !a)} expanded={allYears}>
                {en ? (allYears ? E.onlyFirst(YEARS_SHOWN) : E.allYears(schedule.length)) : allYears ? `Μόνο τα πρώτα ${YEARS_SHOWN} έτη` : `Όλα τα ${schedule.length} έτη`}
              </Btn>
            </div>
          )}
        </div>
      )}

      {/* ── ΠΟΣΟ ΔΑΝΕΙΟ ΜΠΟΡΩ ΝΑ ΠΑΡΩ ─────────────────────────────────────
          Ο κανόνας ζει στο lib/loans/affordability.ts (`DSTI_LIMIT`, Τράπεζα της
          Ελλάδος): η βοήθεια τον διαβάζει από εκεί, ώστε η σελίδα να μη λέει
          άλλο ποσοστό από αυτό που εφαρμόζει. */}
      <div style={{ marginTop: T.sp.xxl }}>
        <Group title={en ? E.howMuch : 'Πόσο δάνειο μπορώ να πάρω'} first>
          <ToolFields>
            <ToolNumField id={ids.eisodima} label={en ? E.income : 'Καθαρό εισόδημα τον μήνα'} value={v.eisodima}
              onChange={x => set('eisodima', x)} unit="€"
              hint={en ? E.incomeHint : 'Του νοικοκυριού, μετά από φόρους και εισφορές.'}/>
            <ToolNumField id={ids.doseis} label={en ? E.debts : 'Άλλες δόσεις τον μήνα'} value={v.doseis}
              onChange={x => set('doseis', x)} unit="€"
              hint={en ? E.debtsHint : 'Καταναλωτικά, κάρτες, άλλο στεγαστικό.'}/>
            <ToolSeg label={en ? E.first : 'Δανείζεσαι πρώτη φορά;'} value={v.proti} onChange={x => set('proti', x)}
              options={en ? [{ value: 'nai', label: E.yes }, { value: 'oxi', label: E.no }] : [{ value: 'nai', label: 'Ναι' }, { value: 'oxi', label: 'Όχι' }]}
              hint={en ? E.firstHint(fpRate(DSTI_LIMIT.firstTimeBuyer * 100), fpRate(DSTI_LIMIT.other * 100)) : `Όλες οι δόσεις μαζί έως ${fpRate(DSTI_LIMIT.firstTimeBuyer * 100)} του καθαρού εισοδήματος την πρώτη φορά· έως ${fpRate(DSTI_LIMIT.other * 100)} αν έχεις ήδη ακίνητο ή είχες στεγαστικό.`}/>
          </ToolFields>
        </Group>

        <ResultCard>
          {!cap || rate === null ? (
            <Empty>{en ? E.capNeedRate : 'Το ανώτατο δάνειο βγαίνει με το επιτόκιο και τη διάρκεια από πάνω. Συμπλήρωσέ τα πρώτα.'}</Empty>
          ) : income <= 0 ? (
            <Empty>{en ? E.capNeedIncome : 'Γράψε το καθαρό μηνιαίο εισόδημα για να δεις ως πόσο δάνειο χωρά.'}</Empty>
          ) : (
            <>
              <ToolHero primary={{ label: en ? E.upTo : 'Δάνειο έως', value: fe(cap.maxLoan) }}
                secondary={[{ label: en ? E.payUpTo : 'Δόση έως', value: fe(cap.maxMonthly) }]}/>
              <LiveResult say={en ? E.sayCap(fe(cap.maxLoan), fe(cap.maxMonthly)) : `Δάνειο έως ${fe(cap.maxLoan)}, με δόση έως ${fe(cap.maxMonthly)}.`}/>
              {plan && share !== null && loan > 0 && (
                <p style={{ margin: '14px 0 0', fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)', textWrap: 'pretty' }}>
                  {en ? (over <= 0.005 ? E.within(fe(loan), fe(burden), fp(share), fpRate(cap.limitPct * 100))
                    : E.overBy(fe(loan), fe(burden), fp(share), fpRate(cap.limitPct * 100), fe(over)))
                  : over <= 0.005
                    ? <>Το δάνειο των {fe(loan)} θέλει {fe(burden)} τον μήνα μαζί με τις άλλες δόσεις, δηλαδή το {fp(share)} του εισοδήματος: μέσα στο όριο του {fpRate(cap.limitPct * 100)}.</>
                    : <>Το δάνειο των {fe(loan)} θέλει {fe(burden)} τον μήνα μαζί με τις άλλες δόσεις, δηλαδή το {fp(share)} του εισοδήματος: ξεπερνά το όριο του {fpRate(cap.limitPct * 100)} κατά {fe(over)} τον μήνα.</>}
                </p>
              )}
              <p style={{ margin: '12px 0 0', fontSize: 13, lineHeight: 1.55, color: 'var(--text-tertiary)', textWrap: 'pretty' }}>
                {en ? E.capNote : <>Είναι το ανώτατο που επιτρέπει ο δείκτης δόσης προς εισόδημα, όχι έγκριση. Η τράπεζα
                ελέγχει και ίδια συμμετοχή, σταθερότητα εισοδήματος και ιστορικό πληρωμών.</>}
              </p>
            </>
          )}
        </ResultCard>
      </div>

      {/* ── Τι ΔΕΝ περιλαμβάνει ───────────────────────────────────────── */}
      <div className="po-tool-note" style={{
        marginTop: T.sp.xl, padding: 'clamp(14px,2.6vw,18px)', borderRadius: T.radius.inner,
        background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
      }}>
        <p style={{ margin: 0, fontSize: 'var(--fs-base)', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
          {en ? <><strong style={{ color: 'var(--text-primary)' }}>{E.notLead}</strong>{' '}{E.not} <EstimateNote loan en /></> : <>
          <strong style={{ color: 'var(--text-primary)' }}>Τι περιλαμβάνει και τι όχι.</strong>{' '}
          Η δόση βγαίνει με τον τύπο του τοκοχρεολυτικού δανείου, ίδια κάθε μήνα για όλη τη
          διάρκεια. Δεν περιλαμβάνει έξοδα φακέλου, εκτίμησης και προσημείωσης, ασφάλιστρα ούτε
          αλλαγές του Euribor. Για να συγκρίνεις προσφορές, κοίτα το ΣΕΠΠΕ (συνολικό ετήσιο
          πραγματικό ποσοστό επιβάρυνσης) που γράφει κάθε προσφορά. <EstimateNote loan /></>}
        </p>
      </div>

      <ToolPaperFoot path={path} spec={SPEC} values={v}/>

      {cta}
    </div>
  );
}
