'use client';
// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΟΘΟΝΕΣ ΤΗΣ ΕΙΣΑΓΩΓΗΣ ΑΠΟ ΤΟ myAADE, ΜΕ ΤΑ ΜΟΤΙΒΑ ΤΗΣ ΥΠΟΛΟΙΠΗΣ ΕΦΑΡΜΟΓΗΣ
// ─────────────────────────────────────────────────────────────────────────
// Καθαρά components με props· η κατάσταση και οι εγγραφές ζουν στο
// MyaadeImport.tsx. Ο πάγκος διάταξης (scripts/perf-bench/mobile.tsx) αποδίδει
// τις ίδιες οθόνες και τις περνά από όλους τους σαρωτές.
//
// ΑΔΙΑΚΡΙΤΟ ΑΠΟ ΤΑ ΑΛΛΑ ΠΑΡΑΘΥΡΑ. Μετρημένα δίπλα στη «Σάρωση εγγράφου» και στο
// «Νέο ακίνητο» (30/10/2026):
//   · το πλακίδιο αρχείου είναι το `pick-tile` της Σάρωσης: ακτίνα κάρτας,
//     εικονίδιο 30 με γραμμή 1,5, τίτλος έντονος, λεζάντα μικρή·
//   · η επιτυχία είναι το «Καταχωρήθηκε» της Σάρωσης: κύκλος 56, τίτλος 20,
//     όλα στο κέντρο·
//   · οι εξηγήσεις ζουν πίσω από ⓘ (`InfoDot`, `labelInfo`) ή σε tooltip, όπως
//     στα πλακίδια KPI. Στην οθόνη μένει μία γραμμή, όχι παράγραφος.
// ═══════════════════════════════════════════════════════════════════════════
import { Fragment, useId, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, Info, Lock, AlertTriangle, XCircle } from 'lucide-react';
import { T, TT, Btn, Badge, fe, fp, SelectBox } from '@/components/Theme';
import type { Tone } from '@/components/tokens';
import { TextInput, NumberInput, CustomSelect, InfoDot } from './UIComponents';
import { Tooltip } from './calendar/Bits';
import { AADE_DESTINATIONS } from '@/lib/tax/aade';
import { atakDigits, isAtak, ATAK_DIGITS } from '@/lib/property/atak';
import { plural } from '@/lib/core/greek';
import { isNew, toNumber, type Draft } from '@/lib/myaade/review';
import type { KnownProperty } from '@/lib/myaade/match';

// Οι κανόνες που θέλουν media query. Ένα σημείο, με πρόθεμα `mya-`.
export const MYAADE_CSS = `
.mya-note{display:flex;align-items:center;flex-wrap:wrap;gap:${T.sp.md}px}
.mya-note-text{display:flex;align-items:center;gap:${T.sp.sm}px;flex:1 1 160px;min-width:0}
.mya-row{display:grid;grid-template-columns:18px minmax(0,1fr) auto;column-gap:${T.sp.md}px;row-gap:${T.sp.xs}px;align-items:start}
.mya-title{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
.mya-right{display:flex;flex-direction:column;align-items:flex-end;gap:${T.sp.xs}px;min-width:96px}
.mya-badge-wide{display:flex}
.mya-badge-narrow{display:none}
.mya-panel{grid-column:2/-1}
.mya-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:${T.sp.md}px}
.mya-fields-3{grid-template-columns:repeat(3,minmax(0,1fr))}
.mya-fields-3 > .mya-full{grid-column:1/-1}
.mya-fields-3 > .mya-two{grid-column:span 2}
.mya-tile{transition:background-color .2s,border-color .2s}
.mya-tile:hover,.mya-tile[data-drag="true"]{border-color:var(--accent)!important;background:var(--accent-dim)!important}
.po-btn.mya-disclose{padding-left:0!important;padding-right:0!important;background:transparent!important}
.po-btn.mya-disclose:hover{color:var(--accent)!important}
@media (max-width:560px){
  .mya-badge-wide{display:none}
  .mya-badge-narrow{display:flex}
  .mya-right{min-width:0}
  .mya-fields,.mya-fields.mya-fields-3{grid-template-columns:repeat(2,minmax(0,1fr))}
  .mya-fields > .mya-span{grid-column:1/-1}
  .mya-fields.mya-act{grid-template-columns:minmax(0,2fr) minmax(0,3fr);align-items:end}
}
/* ΣΤΑ 320 ΤΟ ΠΟΣΟ ΔΕΝ ΧΩΡΑ ΔΙΠΛΑ ΣΤΟ ΕΤΟΣ. Στο Safari (WebKit) το πεδίο του
   ποσού έμενε με 46px για τα 54px του «843,20»: ο σαρωτής διάταξης το έπιασε
   ως κομμένη τιμή. Κάτω από 380 τα πεδία της πράξης πάνε το ένα κάτω από το άλλο. */
@media (max-width:380px){
  .mya-fields.mya-act,.mya-fields.mya-act.mya-fields-3{grid-template-columns:minmax(0,1fr)}
}
`;

// ── Μία γραμμή ειδοποίησης: εικονίδιο, κείμενο, ενέργεια στο ίδιο ύψος ────
const NOTE_ICON = { info: <Info size={16} />, warning: <AlertTriangle size={16} />, negative: <XCircle size={16} /> };

export function Note({ tone, children, info, action, id }: {
  tone: 'info' | 'warning' | 'negative';
  children: ReactNode;
  /** Η εξήγηση, πίσω από ⓘ. */
  info?: string;
  action?: { label: string; onClick: () => void };
  id?: string;
}) {
  return (
    <div id={id} className="mya-note" style={{
      background: `var(--${tone}-soft)`, border: `1px solid var(--${tone}-border)`, borderRadius: T.radius.inner,
      padding: `${T.sp.md}px ${T.sp.lg}px`,
    }}>
      <span className="mya-note-text">
        <span aria-hidden style={{ color: `var(--${tone}-on-container)`, display: 'flex', flexShrink: 0 }}>{NOTE_ICON[tone]}</span>
        <span style={{ ...TT.bodySm, color: 'var(--text-primary)', minWidth: 0 }}>{children}</span>
        {info && <InfoDot text={info} />}
      </span>
      {action && <Btn variant="secondary" onClick={action.onClick}>{action.label}</Btn>}
    </div>
  );
}

// ── Πρώτη οθόνη ──────────────────────────────────────────────────────────
const stepNo: React.CSSProperties = {
  width: 22, height: 22, borderRadius: T.radius.pill, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--accent-soft)', color: 'var(--accent)', fontFamily: T.font.num, fontSize: 'var(--fs-xs)', fontWeight: 600,
};

/** Τα τρία βήματα του myAADE. Η διαδρομή του μενού βγαίνει από το μητρώο (lib/tax/aade.ts). */
export function MyaadeSteps() {
  const d = AADE_DESTINATIONS.enfia;
  const crumbs = d.steps.slice(0, 3);
  const items: ReactNode[] = [
    <a key="login" href={d.url} target="_blank" rel="noopener noreferrer" className="po-tap-inline" style={{ color: 'var(--accent)', fontWeight: 600 }}>Σύνδεση με TAXISnet</a>,
    <span key="path" style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', columnGap: T.sp.xs }}>
      {crumbs.map((c, i) => (
        <Fragment key={c}>
          {i > 0 && <><ChevronRight size={14} aria-hidden style={{ color: 'var(--text-tertiary)' }} /><span className="sr-only">, </span></>}
          <span>{c}</span>
        </Fragment>
      ))}
    </span>,
    <span key="save">Αποθήκευση της πράξης ως PDF</span>,
  ];
  return (
    <ol aria-label="Πώς κατεβάζεις την πράξη" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: T.sp.sm }}>
      {items.map((c, i) => (
        <li key={i} style={{ display: 'flex', gap: T.sp.md, alignItems: 'center' }}>
          <span aria-hidden style={stepNo}>{i + 1}</span>
          <span style={{ ...TT.bodySm, color: 'var(--text-primary)', minWidth: 0 }}>{c}</span>
        </li>
      ))}
    </ol>
  );
}

/** Το πλακίδιο του αρχείου: ίδιο σχήμα με το «Ανέβασε αρχείο» της Σάρωσης και με σύρσιμο. */
export function DropZone({ onFile, disabled, inputId }: { onFile: (f: File | undefined) => void; disabled: boolean; inputId: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const open = () => { if (!disabled) ref.current?.click(); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: T.sp.md }}>
      <div role="button" tabIndex={disabled ? -1 : 0} aria-disabled={disabled} aria-describedby={`${inputId}-hint`}
        onClick={open} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }}
        onDragOver={e => { e.preventDefault(); if (!disabled) setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); if (!disabled) onFile(e.dataTransfer.files?.[0]); }}
        className="pick-tile mya-tile" data-drag={drag ? 'true' : 'false'}
        style={{
          border: '1px solid var(--border-default)', borderRadius: T.radius.card, minHeight: 172, cursor: disabled ? 'default' : 'pointer',
          background: 'var(--bg-elevated)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: T.sp.lg,
        }}>
        <svg aria-hidden="true" width={30} height={30} viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: T.sp.md }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
        <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, marginBottom: T.sp.xs }}>{drag ? 'Άφησέ το εδώ' : 'Ανέβασε την πράξη'}</div>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>PDF από το myAADE</div>
      </div>
      <input id={inputId} ref={ref} type="file" accept="application/pdf,.pdf" className="sr-only" tabIndex={-1} aria-label="Η πράξη ΕΝΦΙΑ σε PDF"
        onChange={e => { onFile(e.target.files?.[0]); e.currentTarget.value = ''; }} />
      <div id={`${inputId}-hint`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: T.sp.xs, ...TT.caption }}>
        <Lock size={13} aria-hidden />
        <span>Διαβάζεται μόνο στη συσκευή σου</span>
        <InfoDot text="Το PDF διαβάζεται στον περιηγητή σου και δεν ανεβαίνει πουθενά. Δεν αποθηκεύεται. Κρατάμε μόνο ό,τι επιβεβαιώσεις: τα ακίνητα και το ποσό του ΕΝΦΙΑ. Το ΑΦΜ της πράξης δεν αποθηκεύεται." />
      </div>
    </div>
  );
}

/** Η πρόοδος της ανάγνωσης, στο κέντρο. */
export function ReadProgress({ page, pages, label }: { page: number; pages: number; label: string }) {
  const pct = pages ? Math.round((page / pages) * 100) : 0;
  return (
    <div style={{ minHeight: 172, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: T.sp.md, textAlign: 'center' }}>
      <span style={{ ...TT.bodySm, color: 'var(--text-primary)' }}>{label}</span>
      <div role="progressbar" aria-label="Ανάγνωση του PDF" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}
        style={{ width: 'min(280px, 100%)', height: 6, borderRadius: T.radius.pill, background: 'var(--border-subtle)', overflow: 'hidden' }}>
        <div style={{ width: `${pages ? pct : 20}%`, height: '100%', background: 'var(--accent)', transition: 'width .2s' }} />
      </div>
    </div>
  );
}

// ── Κεντραρισμένη κατάσταση: επιτυχία, σφάλμα, όριο ──────────────────────
export function CenterState({ tone, title, info, children, action }: {
  tone: 'positive' | 'negative' | 'warning';
  title: string;
  info?: string;
  children?: ReactNode;
  action?: { label: string; onClick: () => void };
}) {
  const icon = tone === 'positive'
    ? <path d="M20 6L9 17l-5-5" />
    : tone === 'negative' ? <path d="M18 6L6 18M6 6l12 12" /> : <path d="M12 8v5M12 16h.01" />;
  return (
    <div style={{ textAlign: 'center', padding: `${T.sp.xxl}px ${T.sp.lg}px`, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: 56, height: 56, borderRadius: T.radius.pill, background: `var(--${tone}-soft)`, border: `1px solid var(--${tone}-border)`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: T.sp.xl }}>
        <svg aria-hidden="true" width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={`var(--${tone})`} strokeWidth="2.5" strokeLinecap="round">{icon}</svg>
      </div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: T.sp.xs, fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
        <span>{title}</span>{info && <InfoDot text={info} />}
      </div>
      {children && <div style={{ marginTop: T.sp.lg, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: T.sp.lg }}>{children}</div>}
      {action && <div style={{ marginTop: T.sp.xl }}><Btn variant="secondary" onClick={action.onClick}>{action.label}</Btn></div>}
    </div>
  );
}

// ── Μία γραμμή ακινήτου ──────────────────────────────────────────────────
/** Σήμα με εξήγηση σε tooltip: ανοίγει με αιώρηση και με εστίαση πληκτρολογίου. */
function TipBadge({ tone, text, tip }: { tone: Tone; text: string; tip?: string }) {
  const id = useId();
  if (!tip) return <Badge tone={tone}>{text}</Badge>;
  return (
    <Tooltip text={tip} content={<span style={{ ...TT.caption, color: 'var(--text-primary)' }}>{tip}</span>}>
      <span tabIndex={0} aria-describedby={id} className="po-tap-inline" style={{ display: 'inline-flex', cursor: 'help', borderRadius: T.radius.pill }}>
        <Badge tone={tone}>{text}</Badge>
        <span id={id} className="sr-only">{tip}</span>
      </span>
    </Tooltip>
  );
}

export function PropertyRow({ row, index, known, onToggle, onPatch, rowId, forceOpen }: {
  row: Draft; index: number; known: readonly KnownProperty[];
  onToggle: () => void; onPatch: (p: Partial<Draft>) => void; rowId: string;
  /** Ανοίγει την «Επεξεργασία» απ' έξω, όταν η γραμμή θέλει απάντηση. */
  forceOpen?: boolean;
}) {
  const [openState, setOpen] = useState(false);
  const open = openState || !!forceOpen;
  const panelId = useId();
  const target = row.match.status !== 'new' ? known.find(k => k.id === (row.match as { id: string }).id) : undefined;
  const atakBad = row.atak.trim() !== '' && !isAtak(row.atak);
  const needsAnswer = row.include && row.match.status === 'maybe' && row.same === null;
  const title = row.address || `Ακίνητο ${index + 1}`;
  const tag: { tone: Tone; text: string; tip?: string } = row.match.status === 'exists'
    ? { tone: 'positive', text: 'Υπάρχει ήδη', tip: `Είναι το «${target?.name ?? ''}» (ίδιος ΑΤΑΚ). Συμπληρώνονται μόνο τα κενά του πεδία.` }
    : row.match.status === 'maybe'
      ? { tone: 'warning', text: 'Ίσως υπάρχει', tip: `Ίδια διεύθυνση με το «${target?.name ?? ''}», που δεν έχει ΑΤΑΚ. Πες μας αν είναι το ίδιο ακίνητο.` }
      : row.overPlan && !row.include ? { tone: 'neutral', text: 'Εκτός πακέτου', tip: 'Δεν χωρά στο πακέτο σου. Τσέκαρέ το αν ξετσεκάρεις άλλο.' }
      : { tone: 'accent', text: 'Νέο' };
  const pct = toNumber(row.pct);
  const meta = [
    row.municipality,
    isAtak(row.atak) ? `ΑΤΑΚ ${row.atak}` : null,
    toNumber(row.sqm) ? `${row.sqm} τ.μ.` : null,
    pct != null ? fp(pct) : null,
  ].filter(Boolean).join(' · ');
  const badges = (
    <>
      <TipBadge tone={tag.tone} text={tag.text} tip={tag.tip} />
      {row.check && <TipBadge tone="warning" text="Έλεγξέ το" tip="Κάποιο πεδίο διαβάστηκε από τη θέση του, όχι από επικεφαλίδα. Άνοιξε την Επεξεργασία." />}
    </>
  );
  return (
    <li id={rowId} className="mya-row" style={{
      padding: T.sp.lg, borderRadius: T.radius.inner, background: 'var(--bg-elevated)',
      border: `1px solid ${atakBad ? 'var(--negative-border)' : needsAnswer ? 'var(--warning-border)' : 'var(--border-subtle)'}`,
    }}>
      {/* Το `po-box` απλώνει αόρατα την περιοχή αφής στα 44 × 44. Το ύψος 20 είναι της πρώτης γραμμής. */}
      <span style={{ height: 20, display: 'flex', alignItems: 'center' }}>
        <SelectBox checked={row.include} onChange={onToggle} label={`Να μπει: ${title}`} />
      </span>
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: T.sp.xs, opacity: row.include ? 1 : 0.72 }}>
        <span className="mya-title" style={{ ...TT.bodySm, fontWeight: 600, color: 'var(--text-primary)', lineHeight: '20px' }}>{title}</span>
        {meta && <span style={{ ...TT.caption, fontVariantNumeric: 'tabular-nums' }}>{meta}</span>}
        <span className="mya-badge-narrow" style={{ gap: T.sp.xs, flexWrap: 'wrap' }}>{badges}</span>
        {row.include && (
          <span style={{ display: 'flex' }}>
            <Btn variant="ghost" className="mya-disclose" onClick={() => setOpen(o => !o)} expanded={open} controls={panelId}>
              <ChevronDown size={15} aria-hidden style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
              {needsAnswer ? 'Απάντησε' : open ? 'Κλείσιμο' : 'Επεξεργασία'}
            </Btn>
          </span>
        )}
      </div>
      <div className="mya-right" style={{ opacity: row.include ? 1 : 0.72 }}>
        <span className="mya-badge-wide" style={{ gap: T.sp.xs, flexWrap: 'wrap', justifyContent: 'flex-end' }}>{badges}</span>
        {row.tax != null && (
          <span style={{ ...TT.bodySm, fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)', textAlign: 'right', whiteSpace: 'nowrap' }}>
            <span className="sr-only">Φόρος ακινήτου </span>{fe(row.tax)}
          </span>
        )}
      </div>
      {row.include && open && (
        <div id={panelId} className="mya-panel" style={{ display: 'flex', flexDirection: 'column', gap: T.sp.md, paddingTop: T.sp.xs }}>
          {row.match.status === 'maybe' && (
            <CustomSelect label="Το έχεις ήδη στην εφαρμογή;" value={row.same === null ? '' : row.same ? 'same' : 'other'}
              onChange={v => onPatch({ same: v === 'same' ? true : v === 'other' ? false : null })}
              options={[{ value: 'same', label: `Ναι, είναι το «${target?.name ?? ''}»` }, { value: 'other', label: 'Όχι, είναι άλλο ακίνητο' }]} />
          )}
          <div className="mya-fields mya-fields-3">
            {isNew(row) && <div className="mya-span mya-full"><TextInput label="Όνομα" value={row.name} onChange={v => onPatch({ name: v })} /></div>}
            <div className="mya-span mya-two"><TextInput label="Διεύθυνση" value={row.address} onChange={v => onPatch({ address: v })} /></div>
            <div className="mya-span"><TextInput label="ΑΤΑΚ" value={row.atak} onChange={v => onPatch({ atak: atakDigits(v) })} placeholder={`${ATAK_DIGITS} ψηφία`} mono inputMode="numeric" /></div>
            <NumberInput label="Επιφάνεια" suffix="τ.μ." value={row.sqm} onChange={v => onPatch({ sqm: v })} />
            <NumberInput label="Ποσοστό" suffix="%" value={row.pct} onChange={v => onPatch({ pct: v })} max={100} />
            <TextInput label="Όροφος" value={row.floor} onChange={v => onPatch({ floor: v })} />
          </div>
          {atakBad && <span style={{ ...TT.caption, color: 'var(--negative)' }}>{`Ο ΑΤΑΚ είναι ${ATAK_DIGITS} ψηφία.`}</span>}
        </div>
      )}
    </li>
  );
}

/** «Επιλογή όλων» και μετρητής, πάνω από τη λίστα. */
export function SelectAll({ total, chosen, onAll }: { total: number; chosen: number; onAll: (on: boolean) => void }) {
  const all = chosen === total && total > 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: T.sp.md, justifyContent: 'space-between', paddingLeft: T.sp.lg + 1, paddingRight: T.sp.lg + 1 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: T.sp.md }}>
        <SelectBox checked={all} indeterminate={!all && chosen > 0} onChange={() => onAll(!all)} label="Επιλογή όλων" />
        <span aria-hidden style={{ ...TT.caption, fontWeight: 600, color: 'var(--text-secondary)' }}>Επιλογή όλων</span>
      </span>
      <span aria-live="polite" style={{ ...TT.caption, fontVariantNumeric: 'tabular-nums' }}>{`${chosen} από ${total} ${plural(total, 'επιλεγμένο', 'επιλεγμένα')}`}</span>
    </div>
  );
}

// ── «Έτοιμο» ─────────────────────────────────────────────────────────────
export interface DoneSummary {
  created: number;
  filled: number;
  enfia: { year: number; total: number; instalments: number } | null;
  leftOut: number;
}

export function DoneView({ s, onUpgrade }: { s: DoneSummary; onUpgrade: () => void }) {
  const lines = [
    s.created ? `${s.created} ${plural(s.created, 'νέο ακίνητο', 'νέα ακίνητα')}` : null,
    s.filled ? `${s.filled} ${plural(s.filled, 'υπάρχον ενημερώθηκε', 'υπάρχοντα ενημερώθηκαν')}` : null,
    s.enfia ? `ΕΝΦΙΑ ${s.enfia.year}: ${fe(s.enfia.total)} σε ${s.enfia.instalments} ${plural(s.enfia.instalments, 'δόση', 'δόσεις')}` : null,
  ].filter((x): x is string => !!x);
  return (
    <CenterState tone="positive" title={lines.length ? 'Καταχωρήθηκε' : 'Τίποτα καινούργιο'}
      info={lines.length ? undefined : 'Όλα όσα έχει η πράξη υπάρχουν ήδη στην εφαρμογή με τα ίδια στοιχεία.'}>
      {lines.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'inline-flex', flexDirection: 'column', gap: T.sp.sm, textAlign: 'left' }}>
          {lines.map(l => (
            <li key={l} style={{ display: 'flex', gap: T.sp.sm, alignItems: 'center', ...TT.bodySm, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
              <CheckCircle2 size={16} aria-hidden style={{ color: 'var(--positive)', flexShrink: 0 }} />
              <span>{l}</span>
            </li>
          ))}
        </ul>
      )}
      {s.leftOut > 0 && (
        <div style={{ width: '100%', textAlign: 'left' }}>
          <Note tone="info" action={{ label: 'Δες τα πακέτα', onClick: onUpgrade }}>
            {`${s.leftOut} ${plural(s.leftOut, 'ακίνητο δεν χωρά', 'ακίνητα δεν χωρούν')} στο πακέτο σου.`}
          </Note>
        </div>
      )}
    </CenterState>
  );
}
