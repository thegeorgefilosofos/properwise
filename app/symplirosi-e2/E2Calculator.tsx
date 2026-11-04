'use client';
// ═══════════════════════════════════════════════════════════════════════════
// Ο ΔΙΑΔΡΑΣΤΙΚΟΣ ΟΔΗΓΟΣ ΤΟΥ Ε2. Όλο το περιεχόμενο των στηλών και ο κωδικός
// του Ε1 βγαίνουν από το `e2Guide` (lib/tools/e2Odigos.ts), δηλαδή από τη
// μηχανή Ε2 της πύλης του λογιστή. Εδώ μόνο τα πεδία και η παρουσίαση.
// ═══════════════════════════════════════════════════════════════════════════
import { useId, useMemo, type ReactNode } from 'react';
import { T } from '@/components/tokens';
import { fmtFor } from '@/lib/core/format';
import { parseAmount } from '@/lib/core/greek';
import { MONTHS_NOM } from '@/lib/core/months';
import { offeredIncomeYears } from '@/lib/core/declarationYear';
import { FIRST_YEAR_NEW_BRACKETS } from '@/lib/billing/greekTax';
import { e2Guide, E2_OWN_PAPERS, type E2Use } from '@/lib/tools/e2Odigos';
import { useToolState, ToolActions, ToolPaper, ToolPaperFoot } from '@/app/ToolShare';
import { ToolNumField, ToolFields, ToolSeg, ToolHero } from '@/app/ToolParts';
import { ToolSelect } from '@/app/ToolSelect';
import LiveResult from '@/components/LiveResult';
import { SPEC, PATH, PROP_TYPES } from './spec';
import { useToolDict, type ToolEn, NO_EN } from '@/lib/i18n/toolEn';
import { localHref } from '@/lib/i18n/paths';

const amount = (s: string): number => Math.max(0, parseAmount(s) ?? 0);
const pad = (n: number) => String(n).padStart(2, '0');
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

function Group({ title, children, first }: { title: string; children: ReactNode; first?: boolean }) {
  return (
    <fieldset className="po-tool-controls" style={{ border: 0, padding: 0, margin: first ? 0 : `${T.sp.xl}px 0 0`, minWidth: 0 }}>
      <legend style={{ padding: 0, margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{title}</legend>
      {children}
    </fieldset>
  );
}

const NOTE = { margin: '12px 0 0', fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)', textWrap: 'pretty' } as const;
const monthOpts = (names: readonly string[]) => names.map((m, i) => ({ value: String(i + 1), label: m }));
const MONTH_OPTS = monthOpts(MONTHS_NOM);
type E2En = NonNullable<ToolEn['e2']>['E'];

export function E2Calculator({ today, cta }: { today: string; cta: ReactNode }) {
  // Τα αγγλικά από τον πάροχο του /en (lib/i18n/toolEn.ts)· εδώ δεν εισάγεται
  // κανένα αγγλικό λεξικό, ώστε να μην κατεβαίνει στα ελληνικά.
  const { en: X, locale } = useToolDict('e2'), en = X !== undefined, E = (X?.E ?? NO_EN) as E2En, path = localHref(locale, PATH);
  const { fe, fn } = fmtFor(locale);
  const monthNames: readonly string[] = en ? E.months : MONTHS_NOM;
  const months = en ? monthOpts(E.months) : MONTH_OPTS;
  const propTypes = en ? PROP_TYPES.map(p => ({ value: p.value, label: E.propType(p.value, p.label) })) : PROP_TYPES;
  const years = useMemo(() => offeredIncomeYears(today, FIRST_YEAR_NEW_BRACKETS - 1), [today]);
  const [v, set] = useToolState(SPEC, path, x => ({ ...x, etos: years.map(String).includes(x.etos) ? x.etos : String(years[0]) }));
  const ids = { enoikio: useId(), pososto: useId(), tm: useId() };
  const year = Number(v.etos);
  const use = (['lease', 'own_use', 'vacant'].includes(v.xrisi) ? v.xrisi : 'lease') as E2Use;
  const a = Math.min(12, Math.max(1, Number(v.apo) || 1)), b = Math.min(12, Math.max(a, Number(v.eos) || 12));
  const g = e2Guide({
    year, propType: v.typos, use, leaseCategory: v.misthosi === 'commercial' ? 'commercial' : 'residential',
    monthly: amount(v.enoikio), from: `${year}-${pad(a)}-01`, to: `${year}-${pad(b)}-${pad(lastDay(year, b))}`,
    ownershipPct: Math.min(100, amount(v.pososto) || 100), sqm: amount(v.tm) || undefined, floor: v.orofos || undefined,
  });
  const code = g.e1.lines[0];

  return (
    <div style={{ fontFamily: T.font.sans }}>
      <Group title={en ? E.property : 'Το ακίνητο'} first>
        <ToolFields>
          <ToolSelect label={en ? E.incomeYear : 'Έτος εισοδήματος'} value={v.etos} onChange={x => set('etos', x)} options={years.map(y => ({ value: String(y), label: String(y) }))}/>
          <ToolSelect label={en ? E.type : 'Τύπος'} value={v.typos} onChange={x => set('typos', x)} options={propTypes}/>
          <ToolNumField id={ids.tm} label={en ? E.area : 'Επιφάνεια'} value={v.tm} onChange={x => set('tm', x)} unit={en ? E.sqm : 'τ.μ.'} mode="numeric"/>
          <ToolNumField id={ids.pososto} label={en ? E.share : 'Ποσοστό συνιδιοκτησίας'} value={v.pososto} onChange={x => set('pososto', x)} unit="%"
            hint={en ? E.shareHint : 'Το ποσοστό σου, όπως στο Ε9. Ολόκληρο το ακίνητο: 100.'}/>
        </ToolFields>
      </Group>
      <Group title={en ? E.during : 'Τι έγινε μέσα στο έτος'}>
        <ToolFields>
          <ToolSeg label={en ? E.use : 'Χρήση'} value={use} onChange={x => set('xrisi', x)} options={[
            { value: 'lease', label: en ? E.leased : 'Μισθωμένο' }, { value: 'own_use', label: en ? E.ownUse : 'Το χρησιμοποιώ' }, { value: 'vacant', label: en ? E.vacant : 'Κενό' },
          ]}/>
          {use === 'lease' && <>
            <ToolSeg label={en ? E.lease : 'Μίσθωση'} value={v.misthosi === 'commercial' ? 'commercial' : 'residential'} onChange={x => set('misthosi', x)}
              options={[{ value: 'residential', label: en ? E.residential : 'Κατοικίας' }, { value: 'commercial', label: en ? E.commercial : 'Επαγγελματική' }]}/>
            <ToolNumField id={ids.enoikio} label={en ? E.rent : 'Μηνιαίο μίσθωμα'} value={v.enoikio} onChange={x => set('enoikio', x)} unit="€"
              hint={en ? E.rentHint : 'Όλο το μίσθωμα του ακινήτου, όχι μόνο το μερίδιό σου.'}/>
            <ToolSelect label={en ? E.from : 'Από'} value={String(a)} onChange={x => set('apo', x)} options={months}/>
            <ToolSelect label={en ? E.to : 'Έως'} value={String(b)} onChange={x => set('eos', x)} options={months.filter(o => Number(o.value) >= a)}/>
          </>}
        </ToolFields>
      </Group>

      <ToolPaper title={en ? E.paper : 'Ε2: συμπλήρωση εντύπου'} on={today} inputs={en ? [
        { k: E.year, v: String(year) },
        { k: E.type, v: propTypes.find(p => p.value === v.typos)?.label ?? '' },
        { k: E.use, v: use === 'lease' ? E.leased : use === 'own_use' ? E.ownUse : E.vacant },
        ...(use === 'lease' ? [{ k: E.rentShort, v: fe(amount(v.enoikio)) }, { k: E.period, v: E.periodOf(monthNames[a - 1], monthNames[b - 1]) }] : []),
      ] : [
        { k: 'Έτος', v: String(year) },
        { k: 'Τύπος', v: PROP_TYPES.find(p => p.value === v.typos)?.label ?? '' },
        { k: 'Χρήση', v: use === 'lease' ? 'Μισθωμένο' : use === 'own_use' ? 'Το χρησιμοποιώ' : 'Κενό' },
        ...(use === 'lease' ? [{ k: 'Μίσθωμα', v: fe(amount(v.enoikio)) }, { k: 'Διάστημα', v: `${MONTHS_NOM[a - 1]} έως ${MONTHS_NOM[b - 1]}` }] : []),
      ]}/>

      <div className="po-tool-result" style={{ marginTop: 20, padding: 'clamp(18px, 4vw, 26px)', borderRadius: T.radius.card,
        background: 'var(--surface-raised)', border: '1px solid var(--border-raised)', boxShadow: 'var(--well-inset)' }}>
        <ToolHero primary={{ label: en ? E.gross : 'Ακαθάριστο στο Ε2', value: fe(g.gross) }}
          secondary={[{ label: en ? E.monthsLabel : 'Μήνες', value: fn(g.months) }, { label: en ? E.code : 'Κωδικός Ε1', value: code ? `${code.code} / ${code.spouseCode}` : (en ? E.none : 'κανένας') }]}/>
        <LiveResult say={en ? E.say(fe(g.gross), fn(g.months), code?.code) : `Ακαθάριστο ${fe(g.gross)}, ${fn(g.months)} μήνες${code ? `, κωδικός Ε1 ${code.code}` : ''}.`}/>
        <div className="po-table-box gd-table" style={{ marginTop: 20 }}>
          <div className="po-scroll-x" style={{ overflowX: 'auto' }}>
            <table className="po-table po-stack" style={{ ['--tbl-min' as string]: '420px' }}>
              <caption>{en ? E.caption : 'Οι στήλες του Ε2, με τη σειρά του εντύπου'}</caption>
              <thead><tr><th scope="col">{en ? E.colHead : 'Στήλη'}</th><th scope="col" style={{ textAlign: 'right' }}>{en ? E.valueHead : 'Τι γράφεις'}</th></tr></thead>
              <tbody>
                {g.cells.filter(c => c.no !== 1).map(c => (
                  <tr key={c.no}>
                    <th scope="row"><span style={{ color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{`${c.no}. `}</span>{en ? E.column(c.no, c.label) : c.label}</th>
                    <td className="po-stack-full" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
                      {(c.value && (en ? E.cell(c.value) : c.value)) || (E2_OWN_PAPERS[c.no] && use === 'lease' ? <span style={{ color: 'var(--text-tertiary)' }}>{en ? E.ownPapers[c.no] : E2_OWN_PAPERS[c.no]}</span>
                        : E2_OWN_PAPERS[c.no] && c.no === 2 ? <span style={{ color: 'var(--text-tertiary)' }}>{en ? E.ownPapers[2] : E2_OWN_PAPERS[2]}</span>
                        : <span style={{ color: 'var(--text-tertiary)' }}>{en ? E.empty : 'κενό'}</span>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {en ? <p style={NOTE}>
          {code ? E.codeNote(code.code, code.spouseCode) : use === 'own_use' ? E.ownUseNote : E.vacantNote}
          {E.expenses}
        </p> : <p style={NOTE}>
          {code
            ? <>Το ποσό της στήλης 13 μεταφέρεται στο Ε1, πίνακας 4Δ2, στον κωδικό {code.code} ({code.spouseCode} για τον ή τη σύζυγο): {code.label}.</>
            : use === 'own_use' ? <>Η ιδιοχρησιμοποίηση κατοικίας δεν έχει ακαθάριστο ούτε κωδικό στον πίνακα 4Δ2: δηλώνεται μόνο στη στήλη 17.</>
            : <>Το κενό ακίνητο δηλώνεται με «ΚΕΝΟ» στη στήλη 17, χωρίς ποσό και χωρίς κωδικό στο Ε1.</>}
          {' '}Οι δαπάνες δεν έχουν στήλη στο Ε2: η τεκμαρτή έκπτωση εφαρμόζεται μόνη της στην εκκαθάριση.
        </p>}
        <p style={{ ...NOTE, fontSize: 13, color: 'var(--text-tertiary)' }}>{en ? E.e1Note : g.e1.note}</p>
      </div>
      <ToolActions path={path} spec={SPEC} values={v}/>
      {cta}
      <ToolPaperFoot path={path} spec={SPEC} values={v}/>
    </div>
  );
}
