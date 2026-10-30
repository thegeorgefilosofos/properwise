'use client';
// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΟΘΟΝΕΣ ΤΗΣ ΕΙΣΑΓΩΓΗΣ ΑΠΟ ΤΟ myAADE, ΧΩΡΙΣ ΚΑΤΑΣΤΑΣΗ ΚΑΙ ΧΩΡΙΣ ΒΑΣΗ
// ─────────────────────────────────────────────────────────────────────────
// Ό,τι βλέπει ο χρήστης ζει εδώ, ως καθαρά components με props: η επιλογή
// αρχείου με τα βήματα του myAADE, η πρόοδος, η προεπισκόπηση με μία συμπαγή
// γραμμή ανά ακίνητο και η οθόνη «Έτοιμο». Η κατάσταση και οι εγγραφές ζουν στο
// MyaadeImport.tsx. Έτσι ο πάγκος διάταξης (scripts/perf-bench/mobile.tsx)
// αποδίδει ΤΙΣ ΙΔΙΕΣ οθόνες με συνθετικά δεδομένα και τις περνά από όλους τους
// σαρωτές (επικαλύψεις, υπερχείλιση, στόχοι αφής, αντίθεση).
//
// ΜΙΑ ΚΛΙΜΑΚΑ ΚΕΝΩΝ. Κάθε στήλη χωρίζεται με `T.sp.lg`, κάθε κάρτα έχει
// `T.sp.lg` γέμισμα και ακτίνα `T.radius.inner`, όπως οι υπόλοιπες κάρτες του
// παραθύρου. Τα callouts έχουν την ίδια ακτίνα και το ίδιο γέμισμα.
// ═══════════════════════════════════════════════════════════════════════════
import { Fragment, useId, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, FileUp, Info, XCircle } from 'lucide-react';
import { T, TT, Btn, Badge, formGrid, fe, fp, SelectBox } from '@/components/Theme';
import type { Tone } from '@/components/tokens';
import { TextInput, NumberInput, CustomSelect } from './UIComponents';
import { AADE_DESTINATIONS } from '@/lib/tax/aade';
import { atakDigits, isAtak, ATAK_DIGITS } from '@/lib/property/atak';
import { plural } from '@/lib/core/greek';
import { existingIdOf, isNew, toNumber, type Draft } from '@/lib/myaade/review';
import type { KnownProperty } from '@/lib/myaade/match';

// Οι κανόνες που θέλουν media query. Ένα σημείο, με πρόθεμα `mya-`.
export const MYAADE_CSS = `
.mya-callout{display:grid;grid-template-columns:${T.sp.xl}px minmax(0,1fr) auto;column-gap:${T.sp.md}px;row-gap:${T.sp.md}px;align-items:start}
.mya-callout-action{align-self:center}
.mya-row-top{display:flex;gap:${T.sp.sm}px;align-items:flex-start;justify-content:space-between}
.mya-badges{display:flex;gap:${T.sp.xs}px;flex-wrap:wrap;justify-content:flex-end;flex-shrink:0}
.mya-title{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
/* Το Btn γράφει το γέμισμά του inline· εδώ το κείμενο στοιχίζεται με την ευθεία του τίτλου. */
.po-btn.mya-disclose{padding-left:0!important;padding-right:0!important;background:transparent!important}
.po-btn.mya-disclose:hover{color:var(--accent)!important}
.mya-drop{transition:background-color .15s,border-color .15s}
.mya-drop:hover,.mya-drop[data-drag="true"]{border-color:var(--accent);background:var(--accent-soft)}
.mya-drop:focus-within{outline:2px solid var(--accent);outline-offset:2px}
@media (max-width:560px){
  .mya-callout{grid-template-columns:${T.sp.xl}px minmax(0,1fr)}
  .mya-callout-action{grid-column:1/-1}
  .mya-callout-action .po-btn{width:100%}
  .mya-row-top{flex-direction:column}
  .mya-badges{justify-content:flex-start}
}
`;

// ── Callout: εικονίδιο στην πρώτη γραμμή, κείμενο, ενέργεια ──────────────
const CALLOUT_ICON: Record<'info' | 'warning' | 'negative' | 'positive', ReactNode> = {
  info: <Info size={16} />, warning: <AlertTriangle size={16} />, negative: <XCircle size={16} />, positive: <CheckCircle2 size={16} />,
};
// Η ίδια συνταγή με τα σήματα του Theme (toneVars): χαρτί `-soft`, περίμετρος
// `-border` και μελάνι `-on-container`, που κρατά την αντίθεση AA πάνω στο χαρτί.
const toneOf = (t: 'info' | 'warning' | 'negative' | 'positive') =>
  ({ bg: `var(--${t}-soft)`, border: `var(--${t}-border)`, fg: `var(--${t}-on-container)` });

export function Callout({ tone, title, children, action, id }: {
  tone: 'info' | 'warning' | 'negative' | 'positive';
  title?: string;
  children?: ReactNode;
  action?: { label: string; onClick: () => void };
  id?: string;
}) {
  const v = toneOf(tone);
  return (
    <div id={id} className="mya-callout" role={tone === 'negative' ? 'alert' : undefined}
      style={{ background: v.bg, border: `1px solid ${v.border}`, borderRadius: T.radius.inner, padding: T.sp.lg }}>
      {/* Το εικονίδιο έχει το ύψος της πρώτης γραμμής (20): στοιχίζεται μαζί της. */}
      <span aria-hidden style={{ color: v.fg, height: 20, display: 'flex', alignItems: 'center' }}>{CALLOUT_ICON[tone]}</span>
      <div style={{ minWidth: 0 }}>
        {title && <div style={{ ...TT.bodySm, fontWeight: 600, color: 'var(--text-primary)', lineHeight: '20px' }}>{title}</div>}
        {children && <div style={{ ...TT.bodySm, color: 'var(--text-secondary)', lineHeight: '20px', marginTop: title ? T.sp.xs : 0 }}>{children}</div>}
      </div>
      {action && <div className="mya-callout-action"><Btn variant="secondary" onClick={action.onClick}>{action.label}</Btn></div>}
    </div>
  );
}

// ── Πρώτη οθόνη: τα βήματα του myAADE και η ζώνη του αρχείου ─────────────
const stepNo: React.CSSProperties = {
  width: 24, height: 24, borderRadius: T.radius.pill, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--accent-soft)', color: 'var(--accent)', fontFamily: T.font.num, fontSize: 'var(--fs-xs)', fontWeight: 600,
};

export function MyaadeSteps() {
  const d = AADE_DESTINATIONS.enfia;
  // Η διαδρομή βγαίνει από το μητρώο (lib/tax/aade.ts): τα τρία πρώτα βήματα
  // του μενού. Το τέταρτο του μητρώου λέει τι βρίσκεις εκεί.
  const crumbs = d.steps.slice(0, 3);
  const items: ReactNode[] = [
    <Fragment key="login"><span>Σύνδεση στο {d.portal} με τους κωδικούς TAXISnet. </span><a href={d.url} target="_blank" rel="noopener noreferrer" className="po-tap-inline" style={{ color: 'var(--accent)', fontWeight: 600 }}>Άνοιγμα του {d.portal}</a></Fragment>,
    <span key="path" style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', columnGap: T.sp.xs }}>
      {crumbs.map((c, i) => (
        <span key={c} style={{ display: 'inline-flex', alignItems: 'center', columnGap: T.sp.xs }}>
          {i > 0 && <><ChevronRight size={14} aria-hidden style={{ color: 'var(--text-tertiary)' }} /><span className="sr-only">, </span></>}
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c}</span>
        </span>
      ))}
    </span>,
    <span key="save">Διάλεξε το έτος και αποθήκευσε την πράξη ως PDF.</span>,
  ];
  return (
    <ol aria-label="Πώς κατεβάζεις την πράξη" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: T.sp.md }}>
      {items.map((c, i) => (
        <li key={i} style={{ display: 'flex', gap: T.sp.md, alignItems: 'flex-start' }}>
          <span aria-hidden style={stepNo}>{i + 1}</span>
          <span style={{ ...TT.bodySm, color: 'var(--text-secondary)', lineHeight: '24px', minWidth: 0 }}>{c}</span>
        </li>
      ))}
    </ol>
  );
}

export function DropZone({ onFile, disabled, inputId }: { onFile: (f: File | undefined) => void; disabled: boolean; inputId: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  return (
    <div className="mya-drop" data-drag={drag ? 'true' : 'false'}
      onDragOver={e => { e.preventDefault(); if (!disabled) setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); if (!disabled) onFile(e.dataTransfer.files?.[0]); }}
      style={{
        border: '1.5px dashed var(--border-default)', borderRadius: T.radius.inner, background: 'var(--bg-elevated)',
        padding: T.sp.xxl, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: T.sp.md, textAlign: 'center',
      }}>
      <span aria-hidden style={{ color: 'var(--accent)', display: 'flex' }}><FileUp size={22} /></span>
      <label htmlFor={inputId} style={{ ...TT.body, fontWeight: 600 }}>{drag ? 'Άφησέ το εδώ' : 'Σύρε εδώ το PDF ή διάλεξε αρχείο'}</label>
      <input id={inputId} ref={ref} type="file" accept="application/pdf,.pdf" className="sr-only" disabled={disabled}
        onChange={e => { onFile(e.target.files?.[0]); e.currentTarget.value = ''; }} />
      <Btn variant="primary" onClick={() => ref.current?.click()} disabled={disabled}>Διάλεξε το PDF</Btn>
      <span style={{ ...TT.caption }}>Διαβάζεται στη συσκευή σου και δεν αποθηκεύεται. Αποθηκεύονται μόνο όσα επιβεβαιώσεις.</span>
    </div>
  );
}

/** Η πρόοδος της ανάγνωσης: γραμμή και πρόταση. Η πρόταση ανακοινώνεται από τον γονέα (aria-live). */
export function ReadProgress({ page, pages, label }: { page: number; pages: number; label: string }) {
  const pct = pages ? Math.round((page / pages) * 100) : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: T.sp.sm, padding: T.sp.lg, border: '1px solid var(--border-subtle)', borderRadius: T.radius.inner, background: 'var(--bg-elevated)' }}>
      <span style={{ ...TT.bodySm, color: 'var(--text-primary)' }}>{label}</span>
      <div role="progressbar" aria-label="Ανάγνωση του PDF" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}
        style={{ height: 6, borderRadius: T.radius.pill, background: 'var(--border-subtle)', overflow: 'hidden' }}>
        <div style={{ width: `${pages ? pct : 30}%`, height: '100%', background: 'var(--accent)', transition: 'width .2s' }} />
      </div>
    </div>
  );
}

// ── Μία γραμμή ακινήτου: η σύνοψη πρώτα, τα πεδία μόνο όταν ζητηθούν ─────
export function PropertyRow({ row, index, overPlan, known, onToggle, onPatch, rowId }: {
  row: Draft; index: number; overPlan: boolean; known: readonly KnownProperty[];
  onToggle: () => void; onPatch: (p: Partial<Draft>) => void; rowId: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const target = row.match.status !== 'new' ? known.find(k => k.id === (row.match as { id: string }).id) : undefined;
  const atakBad = row.atak.trim() !== '' && !isAtak(row.atak);
  const title = row.address || `Ακίνητο ${index + 1}`;
  const tag: { tone: Tone; text: string } = row.match.status === 'exists' ? { tone: 'positive', text: 'Υπάρχει ήδη' }
    : row.match.status === 'maybe' ? { tone: 'warning', text: 'Ίσως υπάρχει' }
    : overPlan && !row.include ? { tone: 'neutral', text: 'Εκτός πακέτου' }
    : { tone: 'accent', text: 'Νέο' };
  const meta = [
    row.municipality,
    isAtak(row.atak) ? `ΑΤΑΚ ${row.atak}` : null,
    row.sqm ? `${row.sqm} τ.μ.` : null,
    toNumber(row.pct) != null ? fp(toNumber(row.pct) as number) : null,
    row.tax != null ? `φόρος ${fe(row.tax)}` : null,
  ].filter(Boolean).join(' · ');
  return (
    <li id={rowId} style={{
      display: 'flex', gap: T.sp.md, alignItems: 'flex-start', padding: T.sp.lg, borderRadius: T.radius.inner,
      border: `1px solid ${atakBad ? 'var(--negative-border)' : 'var(--border-subtle)'}`, background: 'var(--bg-elevated)',
    }}>
      {/* Το `po-box` απλώνει αόρατα την περιοχή αφής στα 44 × 44 (globals.css). Το
          ύψος 22 είναι της πρώτης γραμμής του τίτλου: το πλαίσιο στοιχίζεται μαζί της. */}
      <span style={{ height: 22, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <SelectBox checked={row.include} onChange={onToggle} label={`Να μπει: ${title}`} />
      </span>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: T.sp.sm, opacity: row.include ? 1 : 0.72 }}>
        <div className="mya-row-top">
          <span className="mya-title" style={{ ...TT.body, fontWeight: 600, minWidth: 0 }}>{title}</span>
          <span className="mya-badges">
            <Badge tone={tag.tone}>{tag.text}</Badge>
            {row.check && <Badge tone="warning">Έλεγξέ το</Badge>}
          </span>
        </div>
        {meta && <span style={{ ...TT.caption }}>{meta}</span>}
        {row.include && row.match.status === 'maybe' && (
          <div style={formGrid(200, 360)}>
            <CustomSelect label="Το έχεις ήδη στην εφαρμογή;" value={row.same === null ? '' : row.same ? 'same' : 'other'}
              onChange={v => onPatch({ same: v === 'same' ? true : v === 'other' ? false : null })}
              options={[{ value: 'same', label: `Ναι, είναι το «${target?.name ?? ''}»` }, { value: 'other', label: 'Όχι, είναι άλλο ακίνητο' }]} />
          </div>
        )}
        {row.include && existingIdOf(row) && <span style={{ ...TT.caption }}>{`Συμπληρώνονται μόνο τα κενά πεδία του «${target?.name ?? ''}».`}</span>}
        {atakBad && <span style={{ ...TT.caption, color: 'var(--negative)' }}>{`Ο ΑΤΑΚ είναι ${ATAK_DIGITS} ψηφία.`}</span>}
        {row.include && (
          <div style={{ display: 'flex' }}>
            <Btn variant="ghost" className="mya-disclose" onClick={() => setOpen(o => !o)} expanded={open} controls={panelId}>
              <ChevronDown size={15} aria-hidden style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
              {open ? 'Κλείσιμο' : 'Επεξεργασία'}
            </Btn>
          </div>
        )}
        {row.include && open && (
          <div id={panelId} style={formGrid(140, 220)}>
            {isNew(row) && <TextInput label="Όνομα" value={row.name} onChange={v => onPatch({ name: v })} />}
            <TextInput label="Διεύθυνση" value={row.address} onChange={v => onPatch({ address: v })} />
            <TextInput label="ΑΤΑΚ" value={row.atak} onChange={v => onPatch({ atak: atakDigits(v) })} placeholder={`${ATAK_DIGITS} ψηφία`} mono inputMode="numeric" />
            <NumberInput label="Επιφάνεια" suffix="τ.μ." value={row.sqm} onChange={v => onPatch({ sqm: v })} />
            <NumberInput label="Ποσοστό" suffix="%" value={row.pct} onChange={v => onPatch({ pct: v })} max={100} />
            <TextInput label="Όροφος" value={row.floor} onChange={v => onPatch({ floor: v })} />
          </div>
        )}
      </div>
    </li>
  );
}

/** «Επιλογή όλων» και μετρητής, πάνω από τη λίστα. */
export function SelectAll({ total, chosen, onAll }: { total: number; chosen: number; onAll: (on: boolean) => void }) {
  const all = chosen === total && total > 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: T.sp.md, justifyContent: 'space-between', flexWrap: 'wrap' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: T.sp.md, paddingLeft: T.sp.lg + 1 }}>
        <SelectBox checked={all} indeterminate={!all && chosen > 0} onChange={() => onAll(!all)} label="Επιλογή όλων" />
        <span aria-hidden style={{ ...TT.bodySm, fontWeight: 600 }}>Επιλογή όλων</span>
      </span>
      <span aria-live="polite" style={{ ...TT.caption, fontFamily: T.font.num }}>{`${chosen} από ${total} ${plural(total, 'επιλεγμένο', 'επιλεγμένα')}`}</span>
    </div>
  );
}

// ── «Έτοιμο» ─────────────────────────────────────────────────────────────
export interface DoneSummary {
  created: number;
  filled: number;
  enfia: { year: number; total: number; instalments: number } | null;
  leftOut: number;
  /** «dd/mm/yyyy HH:MM», ως πότε αναιρείται· `null` όταν δεν αναιρείται. */
  undoUntil: string | null;
}

export function DoneView({ s, onUpgrade, onUndo, busy }: { s: DoneSummary; onUpgrade: () => void; onUndo: () => void; busy: boolean }) {
  const lines = [
    s.created ? `${s.created} ${plural(s.created, 'νέο ακίνητο', 'νέα ακίνητα')}` : null,
    s.filled ? `${s.filled} ${plural(s.filled, 'υπάρχον συμπληρώθηκε', 'υπάρχοντα συμπληρώθηκαν')}` : null,
    s.enfia ? `ΕΝΦΙΑ ${s.enfia.year}: ${fe(s.enfia.total)} σε ${s.enfia.instalments} ${plural(s.enfia.instalments, 'δόση', 'δόσεις')} στο ημερολόγιο` : null,
  ].filter((x): x is string => !!x);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: T.sp.lg }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: T.sp.md }}>
        <span aria-hidden style={{ padding: T.sp.sm, borderRadius: T.radius.pill, background: 'var(--positive-soft)', color: 'var(--positive)', display: 'flex', flexShrink: 0 }}>
          <CheckCircle2 size={24} />
        </span>
        <h3 style={{ ...TT.h2, margin: 0 }}>Η εισαγωγή ολοκληρώθηκε</h3>
      </div>
      {lines.length ? (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: T.sp.sm }}>
          {lines.map(l => (
            <li key={l} style={{ display: 'flex', gap: T.sp.sm, alignItems: 'flex-start', ...TT.body }}>
              <span aria-hidden style={{ color: 'var(--positive)', height: 22, display: 'flex', alignItems: 'center' }}><CheckCircle2 size={16} /></span>
              <span>{l}</span>
            </li>
          ))}
        </ul>
      ) : <p style={{ ...TT.body, margin: 0 }}>Όλα ήταν ήδη στην εφαρμογή. Δεν άλλαξε τίποτα.</p>}
      {s.leftOut > 0 && (
        <Callout tone="info" action={{ label: 'Δες τα πακέτα', onClick: onUpgrade }}>
          {`${s.leftOut} ${plural(s.leftOut, 'ακίνητο δεν μπήκε, γιατί το πακέτο σου δεν το χωρά', 'ακίνητα δεν μπήκαν, γιατί το πακέτο σου δεν τα χωρά')}.`}
        </Callout>
      )}
      {s.undoUntil && (
        <div style={{ display: 'flex', alignItems: 'center', gap: T.sp.md, flexWrap: 'wrap', justifyContent: 'space-between', paddingTop: T.sp.lg, borderTop: '1px solid var(--border-subtle)' }}>
          <span style={{ ...TT.caption }}>{`Η αναίρεση ισχύει έως ${s.undoUntil}.`}</span>
          <Btn variant="ghost" className="mya-disclose" onClick={onUndo} disabled={busy}>Αναίρεση εισαγωγής</Btn>
        </div>
      )}
    </div>
  );
}
