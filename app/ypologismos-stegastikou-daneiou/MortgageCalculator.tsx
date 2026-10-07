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
// επιτόκιο νέων στεγαστικών (ΕΚΤ, στοιχεία ΤτΕ), το πεδίο ξεκινά από εκεί και
// η βοήθεια από κάτω λέει από ποιον μήνα είναι. Αλλιώς ξεκινά άδειο και η
// σελίδα ζητά το επιτόκιο της προσφοράς. Ένα «3,50%» γραμμένο στον κώδικα θα
// ήταν τρέχον μόνο τη μέρα που γράφτηκε.
//
// ΜΙΑ ΠΗΓΗ ΓΙΑ ΤΗΝ ΑΡΙΘΜΗΤΙΚΗ: lib/tools/stegastiko.ts, που καλεί τις ίδιες
// συναρτήσεις δανείου με τον πίνακα ελέγχου. Η οθόνη δεν κάνει πράξεις.
// ═══════════════════════════════════════════════════════════════════════════
import { useId, useMemo, useState, type ReactNode } from 'react';
import { T } from '@/components/tokens';
import { Btn } from '@/components/Theme';
import { fe, fn, fp, fpRate } from '@/lib/core/format';
import { parseAmount } from '@/lib/core/greek';
import { DSTI_LIMIT } from '@/lib/loans/affordability';
import {
  parseRate, loanRate, mortgagePlan, borrowingCapacity, rateField, RATE_CAP, YEARS_CAP,
  type MortgageMarket, type RateKind,
} from '@/lib/tools/stegastiko';
import { useToolState, ToolActions, ToolPaper, ToolPaperFoot } from '@/app/ToolShare';
import { EstimateNote, ToolClampNote } from '@/app/ToolNotes';
import { ToolNumField, ToolFields, ToolSeg, ToolHero, ToolLedger, ToolStats } from '@/app/ToolParts';
import LiveResult from '@/components/LiveResult';

/**
 * Τα πεδία όπως ταξιδεύουν στη διεύθυνση. Τα επιτόκια ξεκινούν κενά: τα
 * συμπληρώνει η τιμή αγοράς (`fill`), οπότε ένας κοινοποιημένος σύνδεσμος
 * κουβαλά πάντα το επιτόκιο με το οποίο βγήκε το αποτέλεσμα, όχι το αυριανό.
 */
const SPEC = {
  poso: '150000', eti: '25', typos: 'stathero', epitokio: '', euribor: '', perithorio: '',
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

export function MortgageCalculator({ market, today, cta }: {
  market: MortgageMarket; today: string;
  /** Η πρόσκληση του τέλους, αποδομένη στη σελίδα: βλ. `ToolCta` στο app/PublicChrome.tsx. */
  cta: ReactNode;
}) {
  // Η ΤΙΜΗ ΑΓΟΡΑΣ ΜΠΑΙΝΕΙ ΜΟΝΟ ΑΝ ΕΙΝΑΙ ΦΡΕΣΚΙΑ ΚΑΙ ΜΟΝΟ ΑΝ Η ΔΙΕΥΘΥΝΣΗ ΔΕΝ ΕΙΠΕ
  // ΑΛΛΗ. Παλιά τιμή δεν προτείνεται ως αφετηρία· γράφεται από κάτω με τη
  // δική της ημερομηνία, για αναφορά.
  const housing = market.housing && !market.housing.stale ? market.housing : null;
  const euribor = market.euribor && !market.euribor.stale ? market.euribor : null;
  const [v, set] = useToolState(SPEC, PATH, x => ({
    ...x,
    epitokio: x.epitokio || (housing ? rateField(housing.value) : ''),
    euribor: x.euribor || (euribor ? rateField(euribor.value) : ''),
  }));
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
  const rateHint = (typed: string, fact: typeof housing, label: string) => fact && typed === rateField(fact.value)
    ? `${label} ${fact.period}, ${fact.source}. Γράψε της προσφοράς σου.`
    : null;

  const schedule = plan?.schedule ?? [];

  return (
    <div style={{ fontFamily: T.font.sans }}>
      {/* ── ΤΟ ΔΑΝΕΙΟ ───────────────────────────────────────────────────── */}
      <Group title="Το δάνειο" first>
        <ToolFields>
          <ToolNumField id={ids.poso} label="Ποσό δανείου" value={v.poso} onChange={x => set('poso', x)} unit="€"/>
          <ToolNumField id={ids.eti} label="Διάρκεια" value={v.eti} onChange={x => set('eti', x)}
            mode="numeric" unit="έτη" unitPad={48}/>
          <ToolSeg label="Επιτόκιο" value={v.typos} onChange={x => set('typos', x)}
            options={[{ value: 'stathero', label: 'Σταθερό' }, { value: 'kymainomeno', label: 'Κυμαινόμενο' }]}/>
        </ToolFields>
        <div style={{ marginTop: T.sp.lg }}>
          <ToolFields>
            {kind === 'fixed' ? (
              <ToolNumField id={ids.epitokio} label="Σταθερό επιτόκιο" value={v.epitokio}
                onChange={x => set('epitokio', x)} unit="%" span={2}
                hint={rateHint(v.epitokio, housing, 'Μέσο επιτόκιο νέων στεγαστικών,')
                  ?? 'Το ονομαστικό επιτόκιο που γράφει η προσφορά της τράπεζας.'}/>
            ) : (<>
              <ToolNumField id={ids.euribor} label="Euribor" value={v.euribor}
                onChange={x => set('euribor', x)} unit="%"
                hint={rateHint(v.euribor, euribor, 'Euribor τριμήνου, μέσος όρος')
                  ?? 'Ο δείκτης της σύμβασης, συνήθως τριμήνου.'}/>
              <ToolNumField id={ids.perithorio} label="Περιθώριο τράπεζας" value={v.perithorio}
                onChange={x => set('perithorio', x)} unit="%"
                hint="Το περιθώριο που γράφει η προσφορά, πάνω από το Euribor."/>
            </>)}
          </ToolFields>
        </div>
        <ToolClampNote notes={[
          yearsTyped > YEARS_CAP && `Μέγιστη διάρκεια ${YEARS_CAP} έτη· υπολογίστηκε με ${YEARS_CAP}.`,
          typedRate !== null && typedRate > RATE_CAP && `Μέγιστο επιτόκιο ${fpRate(RATE_CAP)}· υπολογίστηκε με ${fpRate(RATE_CAP)}.`,
        ]}/>
      </Group>

      <ToolPaper title="Δόση στεγαστικού δανείου" on={today} inputs={[
        { k: 'Ποσό', v: fe(loan) },
        { k: 'Διάρκεια', v: `${fn(years)} έτη` },
        { k: kind === 'fixed' ? 'Σταθερό επιτόκιο' : 'Κυμαινόμενο', v: rate === null ? 'δεν δόθηκε' : fp(rate) },
        { k: 'Καθαρό εισόδημα', v: fe(income) },
        { k: 'Άλλες δόσεις', v: fe(debts) },
      ]}/>

      {/* ── Η ΔΟΣΗ ─────────────────────────────────────────────────────── */}
      <ResultCard>
        {!hasLoan ? (
          <Empty>Η δόση χρειάζεται ποσό και διάρκεια.</Empty>
        ) : !plan || rate === null ? (
          <Empty>
            {kind === 'fixed'
              ? 'Γράψε το επιτόκιο της προσφοράς σου για να βγει η δόση. Το βρίσκεις στην προσφορά της τράπεζας ή στο δελτίο επιτοκίων της.'
              : 'Γράψε το Euribor και το περιθώριο της τράπεζας για να βγει η δόση.'}
          </Empty>
        ) : (
          <>
            <ToolHero primary={{ label: 'Μηνιαία δόση', value: fe(plan.monthly) }}
              secondary={[
                { label: 'Σύνολο τόκων', value: fe(plan.totalInterest) },
                { label: 'Επιτόκιο', value: fp(rate) },
              ]}/>
            <LiveResult say={`Μηνιαία δόση ${fe(plan.monthly)}. Σύνολο τόκων ${fe(plan.totalInterest)}.`}/>
            {plus1 && (
              <p style={{ margin: '12px 0 0', fontSize: 13, lineHeight: 1.55, color: 'var(--text-tertiary)', textWrap: 'pretty' }}>
                Η δόση ισχύει όσο το Euribor μένει στο {fp(parseRate(v.euribor) ?? 0)}. Αν ανέβει μία μονάδα,
                γίνεται {fe(plus1.monthly)}.
              </p>
            )}

            <div style={{ height: 1, background: 'var(--border-subtle)', margin: '20px 0 16px' }}/>

            <ToolLedger rows={[
              { k: 'Κεφάλαιο', v: fe(loan) },
              { k: 'Τόκοι', v: fe(plan.totalInterest) },
              { k: `Σύνολο ${fn(plan.months)} δόσεων`, v: fe(plan.totalPaid), kind: 'total' },
            ]}/>
            {/* Ο ΠΡΩΤΟΣ ΧΡΟΝΟΣ ΕΙΝΑΙ ΤΟ ΝΟΥΜΕΡΟ ΠΟΥ ΞΑΦΝΙΑΖΕΙ: το μεγαλύτερο μέρος
                της δόσης είναι τόκος. Δύο ποσά και το μερίδιο, χωρίς σχόλιο. */}
            <ToolStats items={[
              { k: 'Τόκοι πρώτου έτους', v: fe(plan.firstYear.interest) },
              { k: 'Κεφάλαιο πρώτου έτους', v: fe(plan.firstYear.principal) },
              { k: 'Τόκος στη δόση', v: fp(plan.firstYear.interest + plan.firstYear.principal > 0
                ? (plan.firstYear.interest / (plan.firstYear.interest + plan.firstYear.principal)) * 100 : 0) },
            ]}/>
          </>
        )}
      </ResultCard>

      <ToolActions path={PATH} spec={SPEC} values={v}/>

      {/* ── Η ΑΠΟΣΒΕΣΗ ΑΝΑ ΕΤΟΣ ──────────────────────────────────────────
          Πέντε χρόνια στην οθόνη, όλα με ένα πάτημα και όλα στο χαρτί. Ο
          πίνακας κλείνει: τα κεφάλαια αθροίζουν στο ποσό του δανείου. */}
      {plan && schedule.length > 0 && (
        <div style={{ marginTop: T.sp.xxl }}>
          <div className="po-table-box">
           <div className="po-scroll-x" style={{ overflowX: 'auto' }}>
            <table className="po-table po-tool-table tbl-fixed" style={{ '--tbl-min': '300px' }}>
              <caption>Τόκοι και κεφάλαιο ανά έτος</caption>
              <colgroup>
                <col style={{ width: '16%' }} />
                <col style={{ width: '28%' }} />
                <col style={{ width: '28%' }} />
                <col style={{ width: '28%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">Έτος</th>
                  <th scope="col" className="num">Τόκοι</th>
                  <th scope="col" className="num">Κεφάλαιο</th>
                  <th scope="col" className="num">Υπόλοιπο</th>
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
                {allYears ? `Μόνο τα πρώτα ${YEARS_SHOWN} έτη` : `Όλα τα ${schedule.length} έτη`}
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
        <Group title="Πόσο δάνειο μπορώ να πάρω" first>
          <ToolFields>
            <ToolNumField id={ids.eisodima} label="Καθαρό εισόδημα τον μήνα" value={v.eisodima}
              onChange={x => set('eisodima', x)} unit="€"
              hint="Του νοικοκυριού, μετά από φόρους και εισφορές."/>
            <ToolNumField id={ids.doseis} label="Άλλες δόσεις τον μήνα" value={v.doseis}
              onChange={x => set('doseis', x)} unit="€"
              hint="Καταναλωτικά, κάρτες, άλλο στεγαστικό."/>
            <ToolSeg label="Δανείζεσαι πρώτη φορά;" value={v.proti} onChange={x => set('proti', x)}
              options={[{ value: 'nai', label: 'Ναι' }, { value: 'oxi', label: 'Όχι' }]}
              hint={`Η δόση μαζί με τις άλλες έως ${fpRate(DSTI_LIMIT.firstTimeBuyer * 100)} του καθαρού την πρώτη φορά, ${fpRate(DSTI_LIMIT.other * 100)} αν έχεις ήδη ακίνητο ή είχες στεγαστικό.`}/>
          </ToolFields>
        </Group>

        <ResultCard>
          {!cap || rate === null ? (
            <Empty>Το ανώτατο δάνειο βγαίνει με το επιτόκιο και τη διάρκεια από πάνω. Συμπλήρωσέ τα πρώτα.</Empty>
          ) : income <= 0 ? (
            <Empty>Γράψε το καθαρό μηνιαίο εισόδημα για να δεις ως πόσο δάνειο χωρά.</Empty>
          ) : (
            <>
              <ToolHero primary={{ label: 'Δάνειο έως', value: fe(cap.maxLoan) }}
                secondary={[{ label: 'Δόση έως', value: fe(cap.maxMonthly) }]}/>
              <LiveResult say={`Δάνειο έως ${fe(cap.maxLoan)}, με δόση έως ${fe(cap.maxMonthly)}.`}/>
              {plan && share !== null && loan > 0 && (
                <p style={{ margin: '14px 0 0', fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)', textWrap: 'pretty' }}>
                  {over <= 0.005
                    ? <>Το δάνειο των {fe(loan)} θέλει {fe(burden)} τον μήνα μαζί με τις άλλες δόσεις, δηλαδή το {fp(share)} του εισοδήματος: μέσα στο όριο του {fpRate(cap.limitPct * 100)}.</>
                    : <>Το δάνειο των {fe(loan)} θέλει {fe(burden)} τον μήνα μαζί με τις άλλες δόσεις, δηλαδή το {fp(share)} του εισοδήματος: ξεπερνά το όριο του {fpRate(cap.limitPct * 100)} κατά {fe(over)} τον μήνα.</>}
                </p>
              )}
              <p style={{ margin: '12px 0 0', fontSize: 13, lineHeight: 1.55, color: 'var(--text-tertiary)', textWrap: 'pretty' }}>
                Είναι το ανώτατο που επιτρέπει ο δείκτης δόσης προς εισόδημα, όχι έγκριση. Η τράπεζα
                ελέγχει και ίδια συμμετοχή, σταθερότητα εισοδήματος και ιστορικό πληρωμών.
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
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
          <strong style={{ color: 'var(--text-primary)' }}>Τι περιλαμβάνει και τι όχι.</strong>{' '}
          Η δόση βγαίνει με τον τύπο του τοκοχρεολυτικού δανείου, ίδια κάθε μήνα για όλη τη
          διάρκεια. Δεν περιλαμβάνει έξοδα φακέλου, εκτίμησης και υποθήκης, ασφάλιστρα ούτε
          αλλαγές του Euribor. Για να συγκρίνεις προσφορές, κοίτα το ΣΕΠΠΕ (συνολικό ετήσιο
          πραγματικό ποσοστό επιβάρυνσης) που γράφει κάθε προσφορά. <EstimateNote loan />
        </p>
      </div>

      <ToolPaperFoot path={PATH} spec={SPEC} values={v}/>

      {cta}
    </div>
  );
}
