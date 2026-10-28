'use client';
// ═══════════════════════════════════════════════════════════════════════════
// ΑΝΑΠΡΟΣΑΡΜΟΓΗ ΕΝΟΙΚΙΟΥ: ο διαδραστικός πυρήνας
// ─────────────────────────────────────────────────────────────────────────
// ΤΡΕΙΣ ΕΡΩΤΗΣΕΙΣ ΜΕ ΤΗ ΣΕΙΡΑ ΠΟΥ ΤΙΣ ΚΑΝΕΙ Ο ΙΔΙΟΚΤΗΤΗΣ. Πόσο θα γίνει το
// ενοίκιο στην επόμενη αναπροσαρμογή, πόσο σε μερικά χρόνια και τι φόρο θα
// πληρώσει με το νέο ποσό. Η τρίτη απαντιέται από τον υπολογιστή φόρου
// ενοικίων, με το νέο μίσθωμα ήδη γραμμένο στον σύνδεσμο.
//
// Ο ΔΤΚ ΔΕΝ ΓΡΑΦΕΤΑΙ ΑΠΟ ΤΟ ΧΕΡΙ ΜΑΣ. Για μήνα που η ΕΛΣΤΑΤ έχει ανακοινώσει,
// η γραμμή παίρνει τον δείκτη από το lib/market/cpi.ts με τον μήνα του. Για
// μήνα χωρίς ανακοίνωση, το ποσοστό είναι του χρήστη: το πεδίο ξεκινά από τον
// πιο πρόσφατο δημοσιευμένο δείκτη και η βοήθεια λέει ότι είναι υπόθεση.
//
// ΚΑΝΕΝΑΣ ΚΑΝΟΝΑΣ ΣΤΗΝ ΟΘΟΝΗ. Το πλαφόν, το 75% και οι στρογγυλοποιήσεις ζουν
// στο lib (lib/tools/anaprosarmogi.ts, που καλεί τον υπολογισμό της ειδοποίησης
// αναπροσαρμογής της εφαρμογής). Η οθόνη μόνο τα δείχνει.
// ═══════════════════════════════════════════════════════════════════════════
import { useId, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { T } from '@/components/tokens';
import { Btn } from '@/components/Theme';
import { fe, fn, fpRate, grDate } from '@/lib/core/format';
import { FIRST_YEAR_NEW_BRACKETS } from '@/lib/billing/greekTax';
import { COMMERCIAL_STAMP_DUTY } from '@/lib/billing/commercialLease';
import { COMMERCIAL_RENT_CAP_2026 as CAP } from '@/lib/documents/rentAdjustment';
import { offeredIncomeYears } from '@/lib/core/declarationYear';
import { parseAmount } from '@/lib/core/greek';
import { RENT_INDEX, RENT_INDEX_LATEST, indexMonthLabel } from '@/lib/market/cpi';
import { adjustPlan, officialIndex, clampYears, YEARS_MAX, type AdjustRow } from '@/lib/tools/anaprosarmogi';
import { parseRate } from '@/lib/tools/stegastiko';
import { toolQuery } from '@/lib/tools/permalink';
import { useToolState, ToolActions, ToolPaper, ToolPaperFoot } from '@/app/ToolShare';
import { ToolClampNote } from '@/app/ToolNotes';
import { ToolNumField, ToolFields, ToolSeg, ToolHero, ToolLedger, ToolStats } from '@/app/ToolParts';
import { ToolSelect } from '@/app/ToolSelect';
import { SPEC as RENT_SPEC } from '@/app/ypologismos-forou-enoikion/spec';
import LiveResult from '@/components/LiveResult';

/**
 * Τα πεδία όπως ταξιδεύουν στη διεύθυνση. Ο μήνας και ο ΔΤΚ ξεκινούν κενοί:
 * τους συμπληρώνει η σημερινή ημερομηνία και ο τελευταίος δείκτης (`fill`),
 * οπότε ένας κοινοποιημένος σύνδεσμος κουβαλά πάντα τις τιμές με τις οποίες
 * βγήκε το αποτέλεσμα.
 */
const SPEC = {
  enoikio: '800', misthosi: 'katoikia', yfistameni: 'nai', vasi: 'pososto', pososto: '3',
  dtk: '', meros: 'olo', apo: '', eti: '3',
} as const;
const PATH = '/anaprosarmogi-enoikiou';
const RENT_TAX = '/ypologismos-forou-enoikion';
const PLAFON_GUIDE = '/odigos/plafon-3-emporikes-misthoseis-2026';

const CAP_YEAR = Number(CAP.from.slice(0, 4));
const FIRST_MONTH = Object.keys(RENT_INDEX).sort()[0];
const LINK = { color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 } as const;

/** Πόσα έτη φαίνονται πριν ανοίξει ο πίνακας. */
const YEARS_SHOWN = 5;

const amount = (s: string): number => Math.max(0, parseAmount(s) ?? 0);

/** Οι μήνες του επιλογέα: από τον πρώτο δείκτη του πίνακα ως τον Δεκέμβριο του επόμενου έτους. */
function monthOptions(today: string): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const last = `${Number(today.slice(0, 4)) + 1}-12`;
  let [y, m] = FIRST_MONTH.split('-').map(Number);
  for (;;) {
    const ym = `${y}-${String(m).padStart(2, '0')}`;
    if (ym > last) break;
    out.push({ value: ym, label: indexMonthLabel(ym) });
    if (++m > 12) { m = 1; y++; }
  }
  return out;
}

/** Ομάδα πεδίων με τίτλο, όπως στους άλλους υπολογιστές. */
function Group({ title, children, first }: { title: string; children: ReactNode; first?: boolean }) {
  return (
    <fieldset className="po-tool-controls" style={{ border: 0, padding: 0, margin: first ? 0 : `${T.sp.xl}px 0 0`, minWidth: 0 }}>
      <legend style={{ padding: 0, margin: '0 0 12px', fontSize: 14, fontWeight: 600,
        color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{title}</legend>
      {children}
    </fieldset>
  );
}

/** Η κάρτα του αποτελέσματος, ίδια γεωμετρία με τους άλλους υπολογιστές. */
function ResultCard({ children }: { children: ReactNode }) {
  return (
    <div className="po-tool-result" style={{
      marginTop: 20, padding: 'clamp(18px, 4vw, 26px)', borderRadius: T.radius.card,
      background: 'var(--surface-raised)', border: '1px solid var(--border-raised)',
      boxShadow: 'var(--well-inset)',
    }}>{children}</div>
  );
}

const NOTE = { margin: '12px 0 0', fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)', textWrap: 'pretty' } as const;

/** Η σημείωση κάτω από το ποσοστό μιας γραμμής του πίνακα. */
function rowFlag(r: AdjustRow): string | null {
  if (r.capped) return `όριο ${CAP_YEAR}`;
  if (r.index && !r.index.official) return 'υπόθεση';
  if (r.index) return 'ΕΛΣΤΑΤ';
  return null;
}

export function AdjustCalculator({ today, cta }: {
  today: string;
  /** Η πρόσκληση του τέλους, αποδομένη στη σελίδα (`ToolCta`). */
  cta: ReactNode;
}) {
  const months = useMemo(() => monthOptions(today), [today]);
  const thisMonth = today.slice(0, 7);
  const [v, set] = useToolState(SPEC, PATH, x => ({
    ...x,
    apo: months.some(o => o.value === x.apo) ? x.apo : (months.some(o => o.value === thisMonth) ? thisMonth : months[months.length - 1].value),
    dtk: x.dtk || fn(RENT_INDEX[RENT_INDEX_LATEST], 1),
  }));
  const ids = { enoikio: useId(), pososto: useId(), dtk: useId(), eti: useId() };
  const [allYears, setAllYears] = useState(false);

  const commercial = v.misthosi === 'epaggelmatiki';
  const cpi = v.vasi === 'dtk';
  const share75 = v.meros === '75';
  const rent = amount(v.enoikio);
  const yearsTyped = amount(v.eti);
  const years = clampYears(yearsTyped);
  const typedPct = parseRate(cpi ? v.dtk : v.pososto);
  const startIndex = officialIndex(v.apo);

  const plan = useMemo(() => adjustPlan({
    rent, lease: commercial ? 'commercial' : 'residential', basis: cpi ? 'cpi' : 'percent',
    pct: typedPct ?? 0, share75, startYm: v.apo, years, existingLease: v.yfistameni !== 'oxi',
  }), [rent, commercial, cpi, typedPct, share75, v.apo, years, v.yfistameni]);

  const first = plan.rows[0];
  const ready = rent > 0 && !!first && (typedPct !== null || (cpi && plan.rows.every(r => r.index?.official)));
  const startLabel = indexMonthLabel(v.apo);

  // ΤΟ ΝΕΟ ΜΙΣΘΩΜΑ ΣΤΟΝ ΥΠΟΛΟΓΙΣΤΗ ΦΟΡΟΥ. Δώδεκα μήνες με το νέο ποσό· η χρονιά
  // μπαίνει μόνο αν είναι μία από όσες προσφέρει εκείνος σήμερα, αλλιώς
  // ανοίγει στη δική του.
  const taxYear = Number(v.apo.slice(0, 4));
  const taxHref = first ? RENT_TAX + toolQuery(RENT_SPEC, {
    ...RENT_SPEC, enoikio: fn(first.to, 2), mines: '12',
    etos: offeredIncomeYears(today, FIRST_YEAR_NEW_BRACKETS - 1).includes(taxYear) ? String(taxYear) : '',
  }) : RENT_TAX;

  const clauseRows = (r: AdjustRow) => [
    { k: 'Τρέχον μίσθωμα', v: fe(r.from) },
    r.index && { k: r.index.official
        ? `ΔΤΚ ${indexMonthLabel(r.ym)} (ΕΛΣΤΑΤ)`
        : 'ΔΤΚ (υπόθεση, χωρίς ανακοίνωση ακόμη)', v: fpRate(r.index.pct), kind: 'param' as const },
    r.index && share75 && { k: '75% της μεταβολής, στο δέκατο', v: fpRate(r.clausePct), kind: 'param' as const },
    !r.index && { k: 'Όρος της σύμβασης', v: fpRate(r.clausePct), kind: 'param' as const },
    r.capped && r.capPct !== null && { k: `Όριο ${CAP_YEAR}, επαγγελματική μίσθωση`, v: fpRate(r.capPct), kind: 'param' as const },
    { k: 'Αύξηση τον μήνα', v: fe(r.increase) },
    { k: `Νέο μίσθωμα από ${grDate(`${r.ym}-01`)}`, v: fe(r.to), kind: 'total' as const },
  ];

  return (
    <div style={{ fontFamily: T.font.sans }}>
      {/* ── Η ΜΙΣΘΩΣΗ ───────────────────────────────────────────────────── */}
      <Group title="Η μίσθωση" first>
        <ToolFields>
          <ToolNumField id={ids.enoikio} label="Τρέχον μίσθωμα" value={v.enoikio}
            onChange={x => set('enoikio', x)} unit="€"
            hint="Το μηνιαίο μίσθωμα πριν από την αναπροσαρμογή."/>
          <ToolSeg label="Τύπος μίσθωσης" value={v.misthosi} onChange={x => set('misthosi', x)}
            options={[{ value: 'katoikia', label: 'Κατοικία' }, { value: 'epaggelmatiki', label: 'Επαγγελματική' }]}
            hint={commercial
              ? `Το όριο ${fpRate(CAP.pct)} του ${CAP_YEAR} ισχύει μόνο σε υφιστάμενες επαγγελματικές μισθώσεις.`
              : 'Η κατοικία δεν έχει κρατικό όριο αναπροσαρμογής: εφαρμόζεται ο όρος της σύμβασης.'}/>
          {commercial && (
            <ToolSeg label={`Υπογράφηκε πριν από ${grDate(CAP.from)};`} value={v.yfistameni} onChange={x => set('yfistameni', x)}
              options={[{ value: 'nai', label: 'Ναι' }, { value: 'oxi', label: 'Όχι' }]}
              hint={`Σε μίσθωση που υπογράφηκε μέσα στο ${CAP_YEAR} το μίσθωμα διαμορφώνεται ελεύθερα.`}/>
          )}
        </ToolFields>
      </Group>

      {/* ── Ο ΟΡΟΣ ΑΝΑΠΡΟΣΑΡΜΟΓΗΣ ───────────────────────────────────────── */}
      <Group title="Ο όρος αναπροσαρμογής">
        <ToolFields>
          <ToolSeg label="Τι ορίζει η σύμβαση" value={v.vasi} onChange={x => set('vasi', x)}
            options={[{ value: 'pososto', label: 'Σταθερό ποσοστό' }, { value: 'dtk', label: 'ΔΤΚ ΕΛΣΤΑΤ' }]}/>
          {cpi ? (
            <ToolSeg label="Ποιο μέρος του ΔΤΚ" value={v.meros} onChange={x => set('meros', x)}
              options={[{ value: 'olo', label: 'Όλη η μεταβολή' }, { value: '75', label: '75% της μεταβολής' }]}
              hint="Η ΕΛΣΤΑΤ δημοσιεύει και τα δύο κάθε μήνα. Ισχύει ό,τι γράφει η σύμβαση."/>
          ) : (
            <ToolNumField id={ids.pososto} label="Ποσοστό ανά έτος" value={v.pososto}
              onChange={x => set('pososto', x)} unit="%" span={2}
              hint="Όπως το γράφει ο όρος της σύμβασης."/>
          )}
        </ToolFields>
        <div style={{ marginTop: T.sp.lg }}>
          <ToolFields>
            <ToolSelect label="Μήνας αναπροσαρμογής" value={v.apo} onChange={x => set('apo', x)} options={months}
              hint="Ο μήνας που ισχύει το νέο μίσθωμα. Τα επόμενα έτη, τον ίδιο μήνα."/>
            <ToolNumField id={ids.eti} label="Έτη" value={v.eti} onChange={x => set('eti', x)}
              mode="numeric" unit="έτη" unitPad={48}/>
            {cpi && (
              <ToolNumField id={ids.dtk} label="ΔΤΚ όπου δεν ανακοινώθηκε" value={v.dtk}
                onChange={x => set('dtk', x)} unit="%" span={2}
                hint={<>
                  {startIndex !== null
                    ? `Για τον μήνα ${startLabel} η ΕΛΣΤΑΤ ανακοίνωσε ${fpRate(startIndex)} και εφαρμόζεται αυτό. `
                    : `Για τον μήνα ${startLabel} η ΕΛΣΤΑΤ δεν έχει ανακοινώσει ακόμη δείκτη. `}
                  {`Για όποιο έτος δεν έχει ανακοινωθεί, ο υπολογισμός παίρνει αυτό το ποσοστό ως υπόθεση. Τελευταίος δημοσιευμένος: ${indexMonthLabel(RENT_INDEX_LATEST)}, ${fpRate(RENT_INDEX[RENT_INDEX_LATEST])}.`}
                </>}/>
            )}
          </ToolFields>
        </div>
        <ToolClampNote notes={[
          yearsTyped > YEARS_MAX && `Μέχρι ${YEARS_MAX} έτη· υπολογίστηκε με ${YEARS_MAX}.`,
        ]}/>
      </Group>

      <ToolPaper title="Αναπροσαρμογή ενοικίου" on={today} inputs={[
        { k: 'Τρέχον μίσθωμα', v: fe(rent) },
        { k: 'Μίσθωση', v: commercial ? `Επαγγελματική${v.yfistameni === 'oxi' ? `, νέα του ${CAP_YEAR}` : ''}` : 'Κατοικία' },
        { k: 'Όρος', v: cpi ? `ΔΤΚ ΕΛΣΤΑΤ${share75 ? ', 75%' : ''}` : (typedPct === null ? 'δεν δόθηκε' : `${fpRate(typedPct)} τον χρόνο`) },
        { k: 'Από', v: startLabel },
        { k: 'Έτη', v: fn(years) },
      ]}/>

      {/* ── ΤΟ ΝΕΟ ΜΙΣΘΩΜΑ ───────────────────────────────────────────────── */}
      <ResultCard>
        {!ready || !first ? (
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            {rent <= 0 ? 'Γράψε το τρέχον μηνιαίο μίσθωμα για να βγει το νέο.'
              : 'Γράψε το ποσοστό της αναπροσαρμογής για να βγει το νέο μίσθωμα.'}
          </p>
        ) : (
          <>
            <ToolHero primary={{ label: 'Νέο μίσθωμα', value: fe(first.to) }}
              secondary={[
                { label: 'Αύξηση τον μήνα', value: fe(first.increase) },
                plan.rows.length > 1
                  ? { label: `Σε ${fn(plan.rows.length)} έτη`, value: fe(plan.final) }
                  : { label: 'Ποσοστό', value: fpRate(first.appliedPct) },
              ]}/>
            <LiveResult say={`Νέο μίσθωμα ${fe(first.to)}, αύξηση ${fe(first.increase)} τον μήνα.`}/>

            {first.capped && (
              <p style={NOTE}>
                {`Ο όρος δίνει ${fe(first.uncapped)}. Από ${grDate(CAP.from)} έως ${grDate(CAP.to)} η αναπροσαρμογή υφιστάμενης επαγγελματικής μίσθωσης δεν ξεπερνά το ${fpRate(CAP.pct)} (άρθρο 59 ν.5255/2025), οπότε το μίσθωμα σταματά στα ${fe(first.to)}. `}
                <Link href={PLAFON_GUIDE} className="lp-link" style={LINK}>Ποιους αφορά το όριο</Link>
              </p>
            )}

            <div style={{ height: 1, background: 'var(--border-subtle)', margin: '20px 0 16px' }}/>

            <ToolLedger rows={clauseRows(first)}/>
            <ToolStats items={[
              { k: 'Ετήσιο μίσθωμα', v: fe(first.to * 12) },
              { k: 'Επιπλέον τον χρόνο', v: fe(first.increase * 12) },
              ...(commercial
                ? [{ k: `Ψηφιακό τέλος ${fpRate(COMMERCIAL_STAMP_DUTY * 100)} τον μήνα`, v: fe(first.to * COMMERCIAL_STAMP_DUTY) }]
                : []),
            ]}/>
          </>
        )}
      </ResultCard>

      <ToolActions path={PATH} spec={SPEC} values={v}/>

      {/* ── Ο ΦΟΡΟΣ ΜΕ ΤΟ ΝΕΟ ΜΙΣΘΩΜΑ ───────────────────────────────────── */}
      {ready && first && (
        <p className="po-noprint" style={{ ...NOTE, marginTop: T.sp.lg }}>
          {`Με ${fe(first.to)} τον μήνα το ενοίκιο φτάνει τα ${fe(first.to * 12)} τον χρόνο. `}
          <Link href={taxHref} className="lp-link po-tap" style={LINK}>Τι φόρο θα πληρώσεις με το νέο μίσθωμα</Link>
        </p>
      )}

      {/* ── Ο ΠΙΝΑΚΑΣ ΑΝΑ ΕΤΟΣ ──────────────────────────────────────────────
          Κάθε γραμμή ξεκινά από το μίσθωμα της προηγούμενης. Η σημείωση κάτω
          από το ποσοστό λέει από πού ήρθε: ΕΛΣΤΑΤ, υπόθεση ή όριο. */}
      {ready && plan.rows.length > 0 && (
        <div style={{ marginTop: T.sp.xxl }}>
          <div className="po-table-box">
           <div className="po-scroll-x" style={{ overflowX: 'auto' }}>
            <table className="po-table po-tool-table tbl-fixed" style={{ '--tbl-min': '300px' }}>
              <caption>Το μίσθωμα ανά έτος</caption>
              <colgroup>
                <col style={{ width: '28%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '26%' }} />
                <col style={{ width: '26%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">Από</th>
                  <th scope="col" className="num">Ποσοστό</th>
                  <th scope="col" className="num">Μηνιαίο</th>
                  <th scope="col" className="num">Ετήσιο</th>
                </tr>
              </thead>
              <tbody>
                {plan.rows.map((r, i) => {
                  const flag = rowFlag(r);
                  return (
                    <tr key={r.ym} className={allYears || i < YEARS_SHOWN ? undefined : 'po-row-more'}>
                      <th scope="row" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 400, color: 'var(--text-primary)' }}>{grDate(`${r.ym}-01`)}</th>
                      <td className="num">
                        {fpRate(r.appliedPct)}
                        {flag && <span style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)' }}>{flag}</span>}
                      </td>
                      <td className="num">{fe(r.to)}</td>
                      <td className="num">{fe(r.to * 12)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
           </div>
          </div>
          {plan.rows.length > YEARS_SHOWN && (
            <div className="po-noprint" style={{ marginTop: 10 }}>
              <Btn onClick={() => setAllYears(a => !a)} expanded={allYears}>
                {allYears ? `Μόνο τα πρώτα ${YEARS_SHOWN} έτη` : `Όλα τα ${plan.rows.length} έτη`}
              </Btn>
            </div>
          )}
          {plan.assumed && (
            <p style={{ ...NOTE, fontSize: 13, color: 'var(--text-tertiary)' }}>
              {`«Υπόθεση»: η ΕΛΣΤΑΤ δεν έχει ανακοινώσει ακόμη τον δείκτη αυτού του μήνα. Η γραμμή υπολογίστηκε με ${fpRate(typedPct ?? 0)}${share75 ? ', στο 75%' : ''}. Το πραγματικό ποσό θα βγει με τον δείκτη που θα ανακοινωθεί.`}
            </p>
          )}
        </div>
      )}

      {/* ── Τι ΔΕΝ περιλαμβάνει ───────────────────────────────────────── */}
      <div className="po-tool-note" style={{
        marginTop: T.sp.xl, padding: 'clamp(14px,2.6vw,18px)', borderRadius: T.radius.inner,
        background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
      }}>
        <p style={{ margin: 0, fontSize: 'var(--fs-base)', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
          <strong style={{ color: 'var(--text-primary)' }}>Τι περιλαμβάνει και τι όχι.</strong>{' '}
          Μία αναπροσαρμογή τον χρόνο, τον ίδιο μήνα, πάνω στο μίσθωμα που άφησε η προηγούμενη και
          στρογγυλή στο λεπτό. Δεν ξέρει αν ο εκμισθωτής ανήκει σε όσους εξαιρούνται από το όριο του{' '}
          {CAP_YEAR} ούτε ελέγχει τη διατύπωση του όρου. Είναι <strong>ενημερωτικό</strong>, όχι νομική συμβουλή.
        </p>
      </div>

      <ToolPaperFoot path={PATH} spec={SPEC} values={v}/>

      {cta}
    </div>
  );
}
