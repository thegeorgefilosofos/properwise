'use client';
// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΦΙΛΤΡΑ ΤΟΥ ΑΡΧΕΙΟΥ: ΤΡΙΑ DROPDOWN ΑΝΤΙ ΓΙΑ ΤΡΕΙΣ ΣΕΙΡΕΣ CHIPS
// ─────────────────────────────────────────────────────────────────────────
// Οι όψεις (lib/archive/facets.ts) ήταν πάντα ορατές ως chips: Κατηγορία,
// Πάροχος, Χρονιά. Στο κινητό γίνονταν επτά σειρές πριν από τον πρώτο φάκελο
// και ο ιδιοκτήτης ζήτησε (04/11/2026) «dropdowns να μη μαζεύεται πολλή
// πληροφορία». Η λογική δεν άλλαξε· άλλαξε μόνο πού κάθεται:
//   ≥768   τρία κουμπιά «Είδος ▾ · Πάροχος ▾ · Έτος ▾», popover με checkbox,
//          πλήθος δεξιά και αναζήτηση μέσα στη λίστα πάνω από οκτώ επιλογές.
//   <768   ένα κουμπί «Φίλτρα (n)» που ανοίγει φύλλο από κάτω, με τις τρεις
//          όψεις σε accordion και «Εμφάνιση n αρχείων».
// Τα ενεργά φίλτρα φαίνονται ως μικρές ετικέτες σε μία γραμμή, με «×».
// Οι μετρητές λένε πόσα θα μείνουν αν πατήσεις την επιλογή (facets.ts).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useId, useRef, useState } from 'react';
import { fn } from '@/components/Theme';

export interface FilterOption { value: string; count: number; selected: boolean }
export interface FilterFacet { key: string; label: string; options: FilterOption[] }

interface Props {
  facets: FilterFacet[];
  onToggle: (key: string, value: string) => void;
  onClear: (key?: string) => void;
  /** Πόσα αρχεία μένουν με τα τρέχοντα φίλτρα. */
  resultCount: number;
}

const Chevron = () => (
  <svg aria-hidden="true" width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
);
const Check = () => (
  <svg aria-hidden="true" width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 10 17l9-10"/></svg>
);

/** «Πάροχος», «Πάροχος: ΔΕΗ» ή «Πάροχος · 2». */
const buttonLabel = (f: FilterFacet) => {
  const on = f.options.filter(o => o.selected);
  if (on.length === 0) return f.label;
  if (on.length === 1) return `${f.label}: ${on[0].value}`;
  return `${f.label} · ${on.length}`;
};

/** Η λίστα επιλογών μιας όψης· κοινή στο popover και στο φύλλο. */
function OptionList({ f, onToggle }: { f: FilterFacet; onToggle: Props['onToggle'] }) {
  const [q, setQ] = useState('');
  const id = useId();
  const shown = q.trim()
    ? f.options.filter(o => o.value.toLocaleLowerCase('el').includes(q.trim().toLocaleLowerCase('el')))
    : f.options;
  return (
    <div className="af-list-wrap">
      {f.options.length > 8 && (
        <input id={`${id}-q`} className="af-search" value={q} onChange={e => setQ(e.target.value)}
          placeholder={`Αναζήτηση σε ${f.label.toLocaleLowerCase('el')}`} aria-label={`Αναζήτηση: ${f.label}`}/>
      )}
      <ul className="af-list" role="group" aria-label={f.label}>
        {shown.map(o => (
          <li key={o.value}>
            <label className="af-opt">
              <input type="checkbox" className="af-check-input" checked={o.selected} onChange={() => onToggle(f.key, o.value)}/>
              <span className="af-check" aria-hidden="true">{o.selected && <Check/>}</span>
              <span className="af-opt-name">{o.value}</span>
              <span className="af-opt-count">{fn(o.count)}</span>
            </label>
          </li>
        ))}
        {shown.length === 0 && <li className="af-none">Καμία επιλογή για «{q}»</li>}
      </ul>
    </div>
  );
}

/** Ένα dropdown: κουμπί και popover που κλείνει με Escape ή κλικ έξω. */
function Dropdown({ f, onToggle, onClear }: { f: FilterFacet; onToggle: Props['onToggle']; onClear: Props['onClear'] }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);
  const btn = useRef<HTMLButtonElement | null>(null);
  const id = useId();
  const active = f.options.some(o => o.selected);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); btn.current?.focus(); } };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open]);
  return (
    <div className="af-dd" ref={box}>
      <button ref={btn} type="button" className="af-btn" data-active={active || undefined}
        disabled={f.options.length === 0}
        aria-expanded={open} aria-controls={`${id}-pop`} onClick={() => setOpen(o => !o)}>
        <span className="af-btn-label">{buttonLabel(f)}</span>
        <Chevron/>
      </button>
      {open && (
        <div id={`${id}-pop`} className="af-pop" role="dialog" aria-label={f.label}>
          <OptionList f={f} onToggle={onToggle}/>
          {active && (
            <div className="af-pop-foot">
              <button type="button" className="af-link" onClick={() => onClear(f.key)}>Καθαρισμός</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Το φύλλο από κάτω στο κινητό. */
function Sheet({ facets, onToggle, onClear, resultCount, onClose }: Props & { onClose: () => void }) {
  const [openKey, setOpenKey] = useState<string | null>(facets[0]?.key ?? null);
  const panel = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', key);
    panel.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = prev; };
  }, [onClose]);
  const anyActive = facets.some(f => f.options.some(o => o.selected));
  return (
    <div className="af-sheet-scrim" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={panel} tabIndex={-1} className="af-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="af-sheet-grip" aria-hidden="true"/>
        <div className="af-sheet-head">
          <h3 id={titleId} className="af-sheet-title">Φίλτρα</h3>
          {anyActive && <button type="button" className="af-link" onClick={() => onClear()}>Καθαρισμός όλων</button>}
        </div>
        <div className="af-sheet-body">
          {facets.map(f => {
            const open = openKey === f.key;
            const on = f.options.filter(o => o.selected).length;
            return (
              <section key={f.key} className="af-acc">
                <button type="button" className="af-acc-head acc-toggle" aria-expanded={open} onClick={() => setOpenKey(open ? null : f.key)}>
                  <span className="af-acc-label">{f.label}</span>
                  {on > 0 && <span className="af-acc-on">{fn(on)}</span>}
                  <span className="af-acc-chev" aria-hidden="true"><Chevron/></span>
                </button>
                {open && <OptionList f={f} onToggle={onToggle}/>}
              </section>
            );
          })}
        </div>
        <div className="af-sheet-foot">
          <button type="button" className="af-primary" onClick={onClose}>
            Εμφάνιση {fn(resultCount)} {resultCount === 1 ? 'αρχείου' : 'αρχείων'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Τα κουμπιά των φίλτρων (υπολογιστής) ή το «Φίλτρα (n)» (κινητό). */
export function ArchiveFilters(props: Props) {
  const [sheet, setSheet] = useState(false);
  // Πλήθος επιλογών, όχι ποσό: μετριέται με μήκος λίστας.
  const active = props.facets.flatMap(f => f.options.filter(o => o.selected)).length;
  return (
    <>
      <div className="af-wide" role="group" aria-label="Φίλτρα">
        {props.facets.map(f => <Dropdown key={f.key} f={f} onToggle={props.onToggle} onClear={props.onClear}/>)}
      </div>
      <button type="button" className="af-btn af-narrow" data-active={active > 0 || undefined} onClick={() => setSheet(true)}>
        <svg aria-hidden="true" width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M7 12h10M10 18h4"/></svg>
        Φίλτρα{active > 0 ? ` (${fn(active)})` : ''}
      </button>
      {sheet && <Sheet {...props} onClose={() => setSheet(false)}/>}
    </>
  );
}

/** Τα ενεργά φίλτρα σε μία γραμμή, το καθένα αφαιρείται με «×». */
export function ActiveFilterTags({ facets, onToggle, onClear }: Omit<Props, 'resultCount'>) {
  const tags = facets.flatMap(f => f.options.filter(o => o.selected).map(o => ({ key: f.key, label: f.label, value: o.value })));
  if (!tags.length) return null;
  return (
    <div className="af-tags" aria-label="Ενεργά φίλτρα">
      {tags.map(t => (
        <span key={`${t.key}:${t.value}`} className="af-tag">
          <span className="af-tag-text">{t.value}</span>
          <button type="button" className="af-tag-x" aria-label={`Αφαίρεση φίλτρου ${t.label}: ${t.value}`} onClick={() => onToggle(t.key, t.value)}>
            <svg aria-hidden="true" width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </span>
      ))}
      <button type="button" className="af-link" onClick={() => onClear()}>Καθαρισμός</button>
    </div>
  );
}
