'use client';
// ═══════════════════════════════════════════════════════════════════════════
// Ο ΥΠΟΛΟΓΙΣΤΗΣ ΤΗΣ ΕΚΠΤΩΣΗΣ ΑΝΑΚΑΙΝΙΣΗΣ (άρθρο 39Β ΚΦΕ)
// ─────────────────────────────────────────────────────────────────────────
// Όλη η αριθμητική είναι η `renovationCredit` του lib/accounting/
// renovation39b.ts, η ίδια που διαβάζουν ο οδηγός, η Συμβουλευτική και η Νόα.
// Εδώ μόνο τα πεδία και η παρουσίαση.
// ═══════════════════════════════════════════════════════════════════════════
import { useId, type ReactNode } from 'react';
import { T } from '@/components/tokens';
import { fn, fmtFor } from '@/lib/core/format';
import { parseAmount } from '@/lib/core/greek';
import {
  renovationCredit, RENO_39B_CAP, RENO_39B_YEARS, RENO_39B_MATERIALS_SHARE, RENO_39B_FROM, RENO_39B_TO,
} from '@/lib/accounting/renovation39b';
import { useToolState, ToolActions, ToolPaper, ToolPaperFoot } from '@/app/ToolShare';
import { ToolNumField, ToolFields, ToolHero, ToolLedger } from '@/app/ToolParts';
import LiveResult from '@/components/LiveResult';
import { useLocale } from '@/lib/i18n/useLocale';
import { localHref } from '@/lib/i18n/paths';
import { RENO_EN } from '@/lib/i18n/en/tools/reno';
import { SPEC, PATH, TAX_KEYS } from './spec';

const amount = (s: string): number => Math.max(0, parseAmount(s) ?? 0);
const typed = (s: string): number | null => (String(s ?? '').trim() === '' ? null : Math.max(0, parseAmount(s) ?? 0));

function Group({ title, children, first }: { title: string; children: ReactNode; first?: boolean }) {
  return (
    <fieldset className="po-tool-controls" style={{ border: 0, padding: 0, margin: first ? 0 : `${T.sp.xl}px 0 0`, minWidth: 0 }}>
      <legend style={{ padding: 0, margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{title}</legend>
      {children}
    </fieldset>
  );
}

const NOTE = { margin: '12px 0 0', fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)', textWrap: 'pretty' } as const;

/** Το κλάσμα των υλικών, ως λέξη: «το 1/3». */
const SHARE_TEXT = `το ${fn(1)}/${fn(Math.round(1 / RENO_39B_MATERIALS_SHARE))}`;

export function RenoCalculator({ today, cta }: { today: string; cta: ReactNode }) {
  // ── Η ΙΔΙΑ ΟΘΟΝΗ ΣΤΑ ΑΓΓΛΙΚΑ (/en/renovation-tax-credit-calculator) ───────
  const locale = useLocale(), en = locale === 'en', E = RENO_EN, path = localHref(locale, PATH);
  const { fe } = fmtFor(locale);
  const [v, set] = useToolState(SPEC, path);
  const ids = { ypiresies: useId(), ylika: useId(), f: [useId(), useId(), useId(), useId(), useId()] };

  const services = amount(v.ypiresies);
  const materials = amount(v.ylika);
  const taxes = TAX_KEYS.map(k => typed(v[k]));
  const anyTax = taxes.some(t => t !== null);
  const r = renovationCredit({ services, materials, yearTaxes: anyTax ? taxes.map(t => t ?? 0) : undefined });
  const ready = services > 0;
  const capped = r.eligible > RENO_39B_CAP;
  const materialsCut = materials > r.materialsCounted;

  return (
    <div style={{ fontFamily: T.font.sans }}>
      <Group title={en ? E.costs : 'Οι δαπάνες'} first>
        <ToolFields>
          <ToolNumField id={ids.ypiresies} label={en ? E.services : 'Υπηρεσίες (εργασία)'} value={v.ypiresies} onChange={x => set('ypiresies', x)} unit="€"
            hint={en ? E.servicesHint : 'Αμοιβές τεχνιτών και συνεργείων, με τιμολόγιο στο ΑΦΜ σου και ηλεκτρονική πληρωμή.'}/>
          <ToolNumField id={ids.ylika} label={en ? E.materials : 'Υλικά'} value={v.ylika} onChange={x => set('ylika', x)} unit="€"
            hint={en ? E.materialsHint : `Μετρούν έως ${SHARE_TEXT} της αξίας των υπηρεσιών.`}/>
        </ToolFields>
      </Group>

      <Group title={en ? E.taxes : `Ο φόρος σου στα ${fn(RENO_39B_YEARS)} έτη (προαιρετικό)`}>
        <ToolFields xs2>
          {TAX_KEYS.map((k, i) => (
            <ToolNumField key={k} id={ids.f[i]} label={en ? E.taxYear(i + 1) : `Φόρος έτους ${i + 1}`} value={v[k]} onChange={x => set(k, x)} unit="€"/>
          ))}
        </ToolFields>
        <p style={NOTE}>{en ? E.taxNote : <>Ο φόρος εισοδήματος κάθε έτους, όπως τον βγάζει το εκκαθαριστικό. Η μείωση δεν τον ξεπερνά και ό,τι περισσεύει δεν επιστρέφεται.</>}</p>
      </Group>

      <ToolPaper title={en ? E.paper : 'Έκπτωση φόρου ανακαίνισης'} on={today} inputs={en ? [
        { k: E.services, v: fe(services) },
        { k: E.materials, v: fe(materials) },
        ...taxes.map((t, i) => ({ k: E.taxYear(i + 1), v: t === null ? E.notGiven : fe(t) })),
      ] : [
        { k: 'Υπηρεσίες', v: fe(services) },
        { k: 'Υλικά', v: fe(materials) },
        ...taxes.map((t, i) => ({ k: `Φόρος έτους ${i + 1}`, v: t === null ? 'δεν δόθηκε' : fe(t) })),
      ]}/>

      <div className="po-tool-result" style={{ marginTop: 20, padding: 'clamp(18px, 4vw, 26px)', borderRadius: T.radius.card,
        background: 'var(--surface-raised)', border: '1px solid var(--border-raised)', boxShadow: 'var(--well-inset)' }}>
        {!ready ? (
          <p style={{ margin: 0, fontSize: 15, color: 'var(--text-secondary)' }}>{en ? E.needServices : 'Γράψε το ποσό των υπηρεσιών για να βγει η μείωση.'}</p>
        ) : (
          <>
            <ToolHero primary={{ label: en ? E.total : 'Μείωση φόρου συνολικά', value: fe(anyTax ? (r.applied ?? 0) : r.total) }}
              secondary={[{ label: en ? E.perYear : 'Τον χρόνο', value: fe(r.perYear) }, { label: en ? E.eligible : 'Επιλέξιμη δαπάνη', value: fe(Math.min(r.eligible, RENO_39B_CAP)) }]}/>
            <LiveResult say={en ? E.say(fe(anyTax ? (r.applied ?? 0) : r.total), fe(r.perYear)) : `Μείωση φόρου ${fe(anyTax ? (r.applied ?? 0) : r.total)}, ${fe(r.perYear)} τον χρόνο για ${fn(RENO_39B_YEARS)} έτη.`}/>
            <div style={{ marginTop: 20 }}>
              <ToolLedger rows={en ? [
                { k: E.services, v: fe(services) },
                { k: materialsCut ? E.counted : E.materials, v: fe(r.materialsCounted) },
                { k: E.eligible, v: fe(r.eligible) },
                capped && { k: E.cap, v: fe(RENO_39B_CAP), kind: 'param' as const },
                { k: E.equal, v: fe(r.total) },
                { k: E.shares, v: fe(r.perYear), kind: 'total' as const },
              ] : [
                { k: 'Υπηρεσίες', v: fe(services) },
                { k: materialsCut ? `Υλικά που μετρούν (έως ${SHARE_TEXT} των υπηρεσιών)` : 'Υλικά', v: fe(r.materialsCounted) },
                { k: 'Επιλέξιμη δαπάνη', v: fe(r.eligible) },
                capped && { k: `Ανώτατο όριο, για όλα τα έτη`, v: fe(RENO_39B_CAP), kind: 'param' as const },
                { k: 'Μείωση φόρου, ίση με τη δαπάνη', v: fe(r.total) },
                { k: `Ανά έτος, σε ${fn(RENO_39B_YEARS)} ίσα μερίδια`, v: fe(r.perYear), kind: 'total' as const },
              ]}/>
            </div>
            {anyTax && r.byYear && (
              <div className="po-table-box gd-table" style={{ marginTop: 20 }}>
                <div className="po-scroll-x" style={{ overflowX: 'auto' }}>
                  <table className="po-table po-stack" style={{ ['--tbl-min' as string]: '320px' }}>
                    <caption>{en ? E.byYear : 'Η μείωση κάθε έτους'}</caption>
                    <thead><tr><th scope="col">{en ? E.colYear : 'Έτος'}</th><th scope="col" className="num">{en ? E.colTax : 'Φόρος'}</th><th scope="col" className="num">{en ? E.colCredit : 'Μείωση'}</th></tr></thead>
                    <tbody>
                      {r.byYear.map((x, i) => (
                        <tr key={i}>
                          <th scope="row">{en ? E.year(i + 1) : `Έτος ${i + 1}`}</th>
                          <td className="num" data-label={en ? E.colTax : 'Φόρος'}>{taxes[i] === null ? (en ? E.notGiven : 'δεν δόθηκε') : fe(taxes[i] as number)}</td>
                          <td className="num" data-label={en ? E.colCredit : 'Μείωση'}>{fe(x)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <p style={NOTE}>
              {en ? <>{anyTax ? E.noteTax(fe(r.applied ?? 0), fe(r.total)) : E.noteNoTax}{E.window}</> : <>{anyTax
                ? `Στα έτη χωρίς φόρο η μείωση είναι μηδέν. Συνολικά ο φόρος μειώνεται κατά ${fe(r.applied ?? 0)} από τα ${fe(r.total)} που επιτρέπει η δαπάνη.`
                : `Κάθε έτος η μείωση δεν ξεπερνά τον φόρο του. Γράψε τον φόρο των ετών για να δεις πόσο θα δοθεί πράγματι.`}
              {' '}Ισχύει για δαπάνες από {RENO_39B_FROM} έως {RENO_39B_TO}.</>}
            </p>
          </>
        )}
      </div>
      <ToolActions path={path} spec={SPEC} values={v}/>
      {cta}
      <ToolPaperFoot path={path} spec={SPEC} values={v}/>
    </div>
  );
}
