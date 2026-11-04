'use client';
// ═══════════════════════════════════════════════════════════════════════════
// ΦΑΚΕΛΟΙ: ΣΤΗΛΕΣ ΣΤΟΝ ΥΠΟΛΟΓΙΣΤΗ, ΜΙΑ ΛΙΣΤΑ ΤΗ ΦΟΡΑ ΣΤΟ ΚΙΝΗΤΟ
// ─────────────────────────────────────────────────────────────────────────
// Ο ιδιοκτήτης ζήτησε (04/11/2026) τους φακέλους «πιο ποιοτικούς, πιο όμορφους
// και σε λογική macOS». Η λογική, όχι η εμφάνιση: κανένα εικονίδιο της Apple,
// δικά μας σχήματα με τα tokens της εφαρμογής.
//
//   ≥1024  Στήλες: Είδος | Πάροχος | Έτος | Αρχεία και προεπισκόπηση δεξιά.
//          Η επιλογή ανοίγει την επόμενη στήλη. Πληκτρολόγιο: ↑↓ μέσα στη
//          στήλη, → ή Enter μπαίνει, ← βγαίνει, Space ανοίγει την προεπισκόπηση.
//   ≥768   Λίστα: πίνακας με τρίγωνα ανοίγματος (Όνομα · Ποσό · Ημερομηνία ·
//          Μέγεθος). Διαθέσιμη και στον υπολογιστή, με τον διακόπτη.
//   <768   Μία λίστα τη φορά, «‹ Πίσω» με το όνομα του γονέα, μεγάλος τίτλος,
//          γραμμές 52 με υπότιτλο «12 αρχεία · 1.024,80€» και ›.
//
// Το δέντρο έρχεται έτοιμο από το lib/archive/tree.ts· εδώ ζει μόνο η θέα.
// Τα σχήματα ζουν στο globals.css (`.fb-*`): κουμπί με ενσωματωμένο style δεν
// παίρνει :hover ούτε :focus-visible.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Btn, fe, fd, fn, RuntimeImg } from '@/components/Theme';
import { fmtBytes } from '@/lib/core/bytes';
import { useRemembered } from '@/components/useRememberedFlag';
import { PHOTOS, type TreeInput, type TreeNode } from '@/lib/archive/tree';

/** Ό,τι χρειάζεται η θέα από ένα αρχείο. Δομικός τύπος: το Item του Αρχείου ταιριάζει. */
export interface BrowserFile extends TreeInput {
  fileName: string;
  title: string;
  date: string | null;
  isImage: boolean;
  url: string | null;
  downloadUrl: string | null;
  originalName: string | null;
  afm: string | null;
  sizeBytes: number | null;
  /** Η περίοδος όπως γράφεται («01/05/2026 – 30/06/2026»), αν υπάρχει. */
  periodLabel?: string | null;
}

// ── Το πλάτος: τρεις θέες, μία ερώτηση ─────────────────────────────────────
const subscribe = (q: string) => (cb: () => void) => {
  const m = window.matchMedia(q); m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
};
function useMedia(q: string): boolean {
  return useSyncExternalStore(subscribe(q), () => window.matchMedia(q).matches, () => false);
}

// ── Εικονογραφία ─────────────────────────────────────────────────────────
/** Το σύμβολο μέσα στον φάκελο του πρώτου επιπέδου. */
function KindGlyph({ kind }: { kind: string }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const k = kind;
  if (k === 'Ρεύμα') return <path {...p} d="M13 6l-4 6h4l-2 5"/>;
  if (k === 'Νερό') return <path {...p} d="M12 6.5c2 2.6 3 4.3 3 5.7a3 3 0 0 1-6 0c0-1.4 1-3.1 3-5.7z"/>;
  if (k === 'Φυσικό αέριο') return <path {...p} d="M12 6.5c.6 2 2.8 2.9 2.8 5.6a2.8 2.8 0 0 1-5.6 0c0-1.3.6-2.1 1.3-2.8.2 1 .8 1.5 1.5 1.5 0-1.6-.6-2.6 0-4.3z"/>;
  if (k === 'Μισθωτήριο' || k === 'Τίτλος ιδιοκτησίας' || k === 'Μισθωτής') return <path {...p} d="M8 12.5 12 9l4 3.5M9.3 11.5V16h5.4v-4.5"/>;
  if (['ΕΝΦΙΑ', 'Ε1', 'Ε2', 'Ε3', 'Ε9', 'Εκκαθαριστικό φόρου', 'Φορολογικά', 'Δημοτικά τέλη'].includes(k))
    return <g {...p}><circle cx="12" cy="10.5" r="2.3"/><path d="M10.6 12.5 10 16h4l-.6-3.5M8.5 16h7"/></g>;
  if (k === 'Internet' || k === 'Συνδρομές') return <g {...p}><path d="M8.5 11a5 5 0 0 1 7 0M10 12.6a2.8 2.8 0 0 1 4 0"/><circle cx="12" cy="14.6" r=".6"/></g>;
  if (k === 'Κοινόχρηστα') return <g {...p}><rect x="9" y="8" width="6" height="8" rx=".8"/><path d="M11 10.5h2M11 13h2"/></g>;
  if (k === 'Ασφαλιστήριο' || k === 'Ασφάλεια και φύλαξη') return <path {...p} d="M12 7.5l3.5 1.3v2.7c0 2.2-1.5 3.6-3.5 4.5-2-.9-3.5-2.3-3.5-4.5V8.8z"/>;
  if (k === 'Είσπραξη ενοικίου') return <g {...p}><circle cx="12" cy="12" r="3.6"/><path d="M12.9 10.6a1.4 1.4 0 0 0-2 .6c-.4 1 .2 2 1.1 2.1.9.1 1.4 1 1 1.8a1.4 1.4 0 0 1-2 .6M12 9.6v.6M12 14.5v.6"/></g>;
  if (k === 'Προμήθεια πλατφόρμας') return <g {...p}><path d="M9.5 15 14.5 9"/><circle cx="10" cy="9.8" r=".9"/><circle cx="14" cy="14.2" r=".9"/></g>;
  if (k === PHOTOS) return <g {...p}><rect x="8.5" y="9" width="7" height="6" rx="1"/><circle cx="12" cy="12" r="1.4"/></g>;
  if (k === 'Εξοπλισμός') return <g {...p}><rect x="8.5" y="8.5" width="7" height="7" rx="1"/><path d="M8.5 11h7"/></g>;
  if (['Συντήρηση ασανσέρ', 'Συντήρηση πισίνας', 'Ηλεκτρολόγος', 'Υδραυλικός', 'Κηπουρός', 'Καθαρισμός', 'Απεντόμωση', 'Κλιματισμός', 'Συντήρηση', 'Ανακαίνιση'].includes(k))
    return <path {...p} d="M14.6 8.2a2.4 2.4 0 0 0-3 3L8.6 14.2a1 1 0 0 0 1.4 1.4l3-3a2.4 2.4 0 0 0 3-3l-1.4 1.4-1.2-.2-.2-1.2z"/>;
  return <path {...p} d="M10 9.5h4M10 12h4M10 14.5h2.5"/>;
}

/** Ο φάκελος: σώμα με καρτέλα πάνω αριστερά, στο χρώμα της εφαρμογής, χαμηλή ένταση. */
function FolderIcon({ size = 20, kind }: { size?: number; kind?: string }) {
  return (
    <svg aria-hidden="true" className="fb-folder" width={size} height={size} viewBox="0 0 24 24">
      <path className="fb-folder-back" d="M2.5 6.2A1.7 1.7 0 0 1 4.2 4.5h4.6l1.9 1.9h9.1a1.7 1.7 0 0 1 1.7 1.7v1.2H2.5z"/>
      <path className="fb-folder-front" d="M2.5 8.6h19v9.7a1.7 1.7 0 0 1-1.7 1.7H4.2a1.7 1.7 0 0 1-1.7-1.7z"/>
      {kind && <g className="fb-folder-glyph" transform="translate(0 2.2)"><KindGlyph kind={kind}/></g>}
    </svg>
  );
}

/** Η σελίδα του αρχείου: γωνία διπλωμένη και ετικέτα τύπου. */
function FileIcon({ ext, size = 20 }: { ext: string; size?: number }) {
  const label = (ext || 'doc').toUpperCase().slice(0, 4);
  return (
    <span className="fb-file" style={{ width: size, height: size * 1.2 }} aria-hidden="true">
      <svg width={size} height={size * 1.2} viewBox="0 0 20 24">
        <path className="fb-file-page" d="M3 1.5h9.5L18 7v14a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 2 21V3a1.5 1.5 0 0 1 1-1.5z"/>
        <path className="fb-file-fold" d="M12.5 1.5V6a1 1 0 0 0 1 1H18"/>
      </svg>
      <span className="fb-file-tag" data-ext={label}>{label}</span>
    </span>
  );
}

/** Το κοινό όνομα με σημεία αλλαγής γραμμής μετά από κάθε «_»: αλλιώς σε
 *  στενό πλάτος έσπαγε μέσα στη λέξη («Ασφάλειε|ς»). */
function Breakable({ name }: { name: string }) {
  const parts = name.split('_');
  return <>{parts.map((p, i) => <span key={i}>{p}{i < parts.length - 1 ? <>_<wbr/></> : null}</span>)}</>;
}

const extOfFile = (f: BrowserFile) => (f.fileName.match(/\.([a-z0-9]{2,5})$/i)?.[1] || '').toLowerCase();
const files = (n: number) => `${fn(n)} ${n === 1 ? 'αρχείο' : 'αρχεία'}`;
const subtitle = (n: TreeNode<BrowserFile>) => [files(n.count), n.total ? fe(n.total) : null].filter(Boolean).join(' · ');

// ── Η διαδρομή: κλειδιά των επιλεγμένων κόμβων ────────────────────────────
type Path = string[];
const parsePath = (raw: string | null): Path => { try { const v = JSON.parse(raw || '[]'); return Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(0, 3) : []; } catch { return []; } };
const savePath = (p: Path) => JSON.stringify(p);
const parseLayout = (raw: string | null): 'columns' | 'list' => (raw === 'list' ? 'list' : 'columns');
const saveLayout = (v: 'columns' | 'list') => v;
const parseOpen = (raw: string | null): Record<string, boolean> => { try { const v = JSON.parse(raw || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } };
const saveOpen = (v: Record<string, boolean>) => JSON.stringify(v);
const parseGrid = (raw: string | null): boolean => raw !== 'list';
const saveGrid = (v: boolean) => (v ? 'grid' : 'list');

/** Οι κόμβοι κατά μήκος της διαδρομής· σταματά όπου ένα κλειδί δεν υπάρχει πια. */
function walk(nodes: TreeNode<BrowserFile>[], path: Path): TreeNode<BrowserFile>[] {
  const out: TreeNode<BrowserFile>[] = [];
  let level = nodes;
  for (const k of path) {
    const n = level.find(x => x.key === k);
    if (!n) break;
    out.push(n); level = n.children;
  }
  return out;
}

/** Η αυτόματη διαδρομή: ένα μόνο είδος ή ενεργό φίλτρο ανοίγει ως τα αρχεία του πρώτου έτους. */
function autoPath(nodes: TreeNode<BrowserFile>[]): Path {
  const p: Path = []; let level = nodes;
  while (level.length && p.length < 3) { p.push(level[0].key); level = level[0].children; }
  return p;
}

interface FolderBrowserProps<F extends BrowserFile> {
  nodes: TreeNode<F>[];
  /** Ενεργή αναζήτηση ή φίλτρο: ανοίγει ως τα αρχεία. */
  focused: boolean;
  /** Ο τίτλος της ρίζας στη γραμμή διαδρομής. */
  rootLabel: string;
  onOpen: (f: F) => void;
  onUpload: () => void;
}

export function FolderBrowser<F extends BrowserFile>(props: FolderBrowserProps<F>) {
  const desktop = useMedia('(min-width: 1024px)');
  const phone = useMedia('(max-width: 767px)');
  const [layout, setLayout] = useRemembered<'columns' | 'list'>('pw.archive.layout', parseLayout, saveLayout, 'columns');
  const nodes = props.nodes as unknown as TreeNode<BrowserFile>[];

  if (nodes.length === 0) {
    return (
      <div className="fb-empty">
        <FolderIcon size={40}/>
        <p className="fb-empty-title">Κανένα αρχείο εδώ</p>
        <p className="fb-empty-hint">Ό,τι καταχωρείς μπαίνει μόνο του στον φάκελο του είδους και του παρόχου του, με το κοινό όνομα.</p>
        <Btn variant="primary" onClick={props.onUpload}>Καταχώρηση αρχείου</Btn>
      </div>
    );
  }
  if (phone) return <FilesPhone {...props} nodes={nodes} onOpen={props.onOpen as (f: BrowserFile) => void}/>;
  const columns = desktop && layout === 'columns';
  // Ο διακόπτης ζει στην κεφαλίδα της ίδιας κάρτας, δεξιά της διαδρομής.
  const tools = desktop ? (
    <div role="group" aria-label="Προβολή φακέλων" className="fb-seg">
      {(['columns', 'list'] as const).map(k => (
        <button key={k} type="button" className="fb-seg-btn" aria-pressed={layout === k} onClick={() => setLayout(k)}>
          {k === 'columns' ? 'Στήλες' : 'Λίστα'}
        </button>
      ))}
    </div>
  ) : null;
  return columns
    ? <Columns {...props} nodes={nodes} tools={tools} onOpen={props.onOpen as (f: BrowserFile) => void}/>
    : <ListTable {...props} nodes={nodes} tools={tools} onOpen={props.onOpen as (f: BrowserFile) => void}/>;
}

type Inner = Omit<FolderBrowserProps<BrowserFile>, 'nodes'> & { nodes: TreeNode<BrowserFile>[]; tools?: React.ReactNode };

/** Η διαδρομή που θυμάται η συσκευή, ή η αυτόματη όταν χρειάζεται. */
function usePath(nodes: TreeNode<BrowserFile>[], focused: boolean): [Path, (p: Path) => void] {
  const [saved, setSaved] = useRemembered<Path>('pw.archive.path', parsePath, savePath, []);
  const [touched, setTouched] = useState(false);
  const auto = (focused || nodes.length === 1) && !touched;
  const path = auto ? autoPath(nodes) : walk(nodes, saved).map(n => n.key);
  return [path, (p: Path) => { setTouched(true); setSaved(p); }];
}

// ═══ ΣΤΗΛΕΣ ═════════════════════════════════════════════════════════════
function Columns({ nodes, focused, rootLabel, onOpen, tools }: Inner) {
  const [path, setPath] = usePath(nodes, focused);
  const trail = walk(nodes, path);
  const [fileId, setFileId] = useState<string | null>(null);
  const [preview, setPreview] = useState(true);
  const year = trail.length === 3 ? trail[2] : null;
  const file = year?.items.find(f => f.id === fileId) ?? null;
  const box = useRef<HTMLDivElement | null>(null);

  const levels: { label: string; nodes: TreeNode<BrowserFile>[] }[] = [
    { label: 'Είδος', nodes },
    ...(trail[0] ? [{ label: trail[0].label === PHOTOS ? 'Κατηγορία' : 'Πάροχος', nodes: trail[0].children }] : []),
    ...(trail[1] ? [{ label: 'Έτος', nodes: trail[1].children }] : []),
  ];

  const choose = (depth: number, key: string) => { setPath([...path.slice(0, depth), key]); setFileId(null); };
  // Η εστίαση ακολουθεί την επιλογή: μετά από κάθε κίνηση με το πληκτρολόγιο,
  // στη στήλη `focusTo` εστιάζεται η επιλεγμένη γραμμή (ή η πρώτη).
  // Κάθε αίτημα έχει δικό του αύξοντα αριθμό, ώστε το ίδιο «στήλη 2» δύο
  // φορές στη σειρά να ξαναεστιάζει.
  const [focusReq, setFocusReq] = useState<{ col: number; seq: number } | null>(null);
  useEffect(() => {
    if (!focusReq) return;
    const col = box.current?.querySelectorAll<HTMLElement>('.fb-col')[focusReq.col];
    (col?.querySelector<HTMLElement>('[aria-selected="true"]') ?? col?.querySelector<HTMLElement>('[role="option"]'))?.focus();
  }, [focusReq]);

  const onKey = (depth: number, opts: { key: string }[], current: number) => (e: React.KeyboardEvent) => {
    const focusCol = (i: number) => setFocusReq(r => ({ col: i, seq: (r?.seq ?? 0) + 1 }));
    const go = (i: number) => {
      const k = opts[Math.max(0, Math.min(opts.length - 1, i))]?.key; if (!k) return;
      if (depth < 3) choose(depth, k); else setFileId(k);
      focusCol(depth);
    };
    if (e.key === 'ArrowDown') { e.preventDefault(); go(current + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); go(current - 1); }
    else if ((e.key === 'ArrowRight' || e.key === 'Enter') && depth < 3) {
      e.preventDefault();
      if (current < 0) go(0);
      const n = levels[depth]?.nodes[Math.max(0, current)];
      if (n && depth < 2) { setPath([...path.slice(0, depth), n.key, n.children[0]?.key].filter(Boolean) as Path); focusCol(depth + 1); }
      else if (n && depth === 2) { setFileId(n.items[0]?.id ?? null); focusCol(3); }
    } else if (e.key === 'ArrowLeft' && depth > 0) { e.preventDefault(); focusCol(depth - 1); }
    else if (e.key === ' ' && depth === 3) { e.preventDefault(); setPreview(v => !v); }
    else if (e.key === 'Enter' && depth === 3 && file) { e.preventDefault(); onOpen(file); }
  };

  return (
    <div className="fb-columns-wrap">
      <div className="fb-head">
        <Breadcrumb rootLabel={rootLabel} trail={trail} onGo={i => { setPath(path.slice(0, i)); setFileId(null); }}/>
        {tools}
      </div>
      <div ref={box} className="fb-columns" data-preview={!!file && preview}>
        {levels.map((lv, depth) => {
          const current = lv.nodes.findIndex(n => n.key === path[depth]);
          return (
            <div key={depth} className="fb-col" role="listbox" aria-label={lv.label}
              onKeyDown={onKey(depth, lv.nodes, current)}>
              <p className="fb-col-head">{lv.label}</p>
              {lv.nodes.map((n, i) => {
                const on = n.key === path[depth];
                return (
                  <div key={n.key} role="option" aria-selected={on} tabIndex={on || (current < 0 && i === 0) ? 0 : -1}
                    className="fb-row" onClick={() => choose(depth, n.key)} title={n.label}>
                    {depth === 2
                      ? <span className="fb-year-dot" aria-hidden="true"/>
                      : <FolderIcon size={18} kind={depth === 0 ? n.label : undefined}/>}
                    <span className="fb-row-name">{n.label}</span>
                    <span className="fb-count" aria-label={files(n.count)}>{fn(n.count)}</span>
                    {n.total ? <span className="fb-row-sum">{fe(n.total)}</span> : <span className="fb-row-sum"/>}
                    <svg aria-hidden="true" className="fb-row-chev" width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6"/></svg>
                  </div>
                );
              })}
            </div>
          );
        })}
        {year && (
          <div className="fb-col fb-col-files" role="listbox" aria-label="Αρχεία"
            onKeyDown={onKey(3, year.items.map(f => ({ key: f.id })), year.items.findIndex(f => f.id === fileId))}>
            <p className="fb-col-head">Αρχεία</p>
            {year.items.map((f, i) => {
              const on = f.id === fileId;
              return (
                <div key={f.id} role="option" aria-selected={on} tabIndex={on || (!fileId && i === 0) ? 0 : -1}
                  className="fb-row fb-file-row" onClick={() => { setFileId(f.id); setPreview(true); }} onDoubleClick={() => onOpen(f)} title={f.fileName}>
                  {f.isImage && f.url
                    ? <RuntimeImg src={f.url} alt="" className="fb-thumb-sm"/>
                    : <FileIcon ext={extOfFile(f)} size={16}/>}
                  <span className="fb-row-name">{f.fileName}</span>
                  <span className="fb-row-sum">{f.value != null ? fe(f.value) : ''}</span>
                  <span className="fb-row-date">{f.date ? fd(f.date) : ''}</span>
                </div>
              );
            })}
          </div>
        )}
        {file && preview && <Preview f={file} onOpen={onOpen}/>}
      </div>
    </div>
  );
}

function Breadcrumb({ rootLabel, trail, onGo }: { rootLabel: string; trail: TreeNode<BrowserFile>[]; onGo: (i: number) => void }) {
  return (
    <nav aria-label="Διαδρομή φακέλου" className="fb-crumbs">
      {[{ label: rootLabel }, ...trail].map((n, i, all) => (
        <span key={i} className="fb-crumb-wrap">
          {i < all.length - 1
            ? <button type="button" className="fb-crumb" onClick={() => onGo(i)}>{n.label}</button>
            : <span className="fb-crumb" aria-current="location">{n.label}</span>}
          {i < all.length - 1 && <span aria-hidden="true" className="fb-crumb-sep">›</span>}
        </span>
      ))}
    </nav>
  );
}

function Preview({ f, onOpen }: { f: BrowserFile; onOpen: (f: BrowserFile) => void }) {
  const rows: [string, string | null][] = [
    ['Είδος', f.kind],
    ['Πάροχος', f.provider],
    ['ΑΦΜ', f.afm],
    ['Περίοδος', f.periodLabel ?? null],
    ['Ημερομηνία', f.date ? fd(f.date) : null],
    ['Ποσό', f.value != null ? fe(f.value) : null],
    ['Μέγεθος', f.sizeBytes ? fmtBytes(f.sizeBytes) : null],
    ['Περιγραφή', f.title !== f.fileName ? f.title : null],
    ['Αρχικό', f.originalName],
  ];
  return (
    <aside className="fb-preview" aria-label="Προεπισκόπηση">
      <div className="fb-preview-media">
        {f.isImage && f.url ? <RuntimeImg src={f.url} alt={f.title} className="fb-preview-img"/> : <FileIcon ext={extOfFile(f)} size={56}/>}
      </div>
      <p className="fb-preview-name"><Breakable name={f.fileName}/></p>
      <dl className="fb-preview-dl">
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="fb-preview-row"><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
      <div className="fb-preview-actions">
        {f.url && <Btn variant="secondary" onClick={() => onOpen(f)}>Άνοιγμα</Btn>}
        {f.downloadUrl && <Btn variant="primary" href={f.downloadUrl} newTab>Λήψη</Btn>}
      </div>
    </aside>
  );
}

// ═══ ΛΙΣΤΑ ΜΕ ΤΡΙΓΩΝΑ ═══════════════════════════════════════════════════
function ListTable({ nodes, focused, rootLabel, onOpen, tools }: Inner) {
  const [saved, setSaved] = useRemembered<Record<string, boolean>>('pw.archive.open', parseOpen, saveOpen, {});
  const auto = focused || nodes.length === 1;
  const isOpen = (k: string) => saved[k] ?? auto;
  const flip = (k: string) => setSaved({ ...saved, [k]: !isOpen(k) });
  const rows: React.ReactNode[] = [];
  const add = (n: TreeNode<BrowserFile>, depth: number, top: string) => {
    const open = isOpen(n.key);
    rows.push(
      <div key={n.key} role="row" className="fb-tr" data-depth={depth}>
        <div role="gridcell" className="fb-td-name">
          <button type="button" className="fb-disclose acc-toggle" aria-expanded={open} onClick={() => flip(n.key)}
            aria-label={`${n.label}, ${files(n.count)}`}>
            <svg aria-hidden="true" className="fb-tri" width={10} height={10} viewBox="0 0 10 10"><path d="M3 1.5 7.5 5 3 8.5z" fill="currentColor"/></svg>
            {depth < 2 ? <FolderIcon size={18} kind={depth === 0 ? top : undefined}/> : <span className="fb-year-dot" aria-hidden="true"/>}
            <span className="fb-row-name" title={n.label}>{n.label}</span>
            <span className="fb-count" aria-label={files(n.count)}>{fn(n.count)}</span>
          </button>
        </div>
        <div role="gridcell" className="fb-td-num">{n.total ? fe(n.total) : ''}</div>
        <div role="gridcell" className="fb-td-date"/>
        <div role="gridcell" className="fb-td-size"/>
      </div>,
    );
    if (!open) return;
    n.children.forEach(c => add(c, depth + 1, top));
    if (depth === 2) n.items.forEach(f => rows.push(
      <div key={f.id} role="row" className="fb-tr fb-tr-file" data-depth={3} onDoubleClick={() => onOpen(f)}>
        <div role="gridcell" className="fb-td-name">
          <button type="button" className="fb-file-open" onClick={() => onOpen(f)} title={f.fileName} disabled={!f.url}>
            <FileIcon ext={extOfFile(f)} size={14}/>
            <span className="fb-row-name">{f.fileName}</span>
          </button>
        </div>
        <div role="gridcell" className="fb-td-num">{f.value != null ? fe(f.value) : ''}</div>
        <div role="gridcell" className="fb-td-date">{f.date ? fd(f.date) : ''}</div>
        <div role="gridcell" className="fb-td-size">{f.sizeBytes ? fmtBytes(f.sizeBytes) : ''}</div>
      </div>,
    ));
  };
  nodes.forEach(n => add(n, 0, n.label));
  return (
    <div className="fb-card">
    <div className="fb-head">
      <span className="fb-crumb" aria-current="location">{rootLabel}</span>
      {tools}
    </div>
    <div role="treegrid" aria-label="Φάκελοι" className="fb-table">
      <div role="row" className="fb-tr fb-th">
        <div role="columnheader" className="fb-td-name">Όνομα</div>
        <div role="columnheader" className="fb-td-num">Ποσό</div>
        <div role="columnheader" className="fb-td-date">Ημερομηνία</div>
        <div role="columnheader" className="fb-td-size">Μέγεθος</div>
      </div>
      {rows}
    </div>
    </div>
  );
}

// ═══ ΚΙΝΗΤΟ: ΜΙΑ ΛΙΣΤΑ ΤΗ ΦΟΡΑ ═══════════════════════════════════════════
function FilesPhone({ nodes, focused, rootLabel, onOpen }: Inner) {
  const [path, setPath] = usePath(nodes, focused);
  const trail = walk(nodes, path);
  const [dir, setDir] = useState<'in' | 'out'>('in');
  const [grid, setGrid] = useRemembered<boolean>('pw.archive.phoneGrid', parseGrid, saveGrid, true);
  const here = trail[trail.length - 1];
  const list = here ? here.children : nodes;
  const parentLabel = trail.length >= 2 ? trail[trail.length - 2].label : rootLabel;
  const showFiles = trail.length === 3;
  const key = path.join('/') || 'root';
  const enter = (k: string) => { setDir('in'); setPath([...path, k]); };
  const back = () => { setDir('out'); setPath(path.slice(0, -1)); };
  const yearItems = useMemo(() => (showFiles && here ? here.items : []), [showFiles, here]);

  return (
    <div className="fb-phone">
      {here && (
        <button type="button" className="fb-back" onClick={back}>
          <svg aria-hidden="true" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 6-6 6 6 6"/></svg>
          {parentLabel}
        </button>
      )}
      <div key={key} className="fb-phone-pane" data-dir={dir}>
        <div className="fb-phone-head">
          <h3 className="fb-phone-title">{here ? here.label : rootLabel}</h3>
          {here && <p className="fb-phone-sub">{subtitle(here)}</p>}
        </div>
        {!showFiles && (
          <ul className="fb-phone-list">
            {list.map(n => (
              <li key={n.key}>
                <button type="button" className="fb-phone-row" onClick={() => enter(n.key)}>
                  {trail.length === 2 ? <span className="fb-year-dot" aria-hidden="true"/> : <FolderIcon size={28} kind={trail.length === 0 ? n.label : undefined}/>}
                  <span className="fb-phone-text">
                    <span className="fb-phone-name">{n.label}</span>
                    <span className="fb-phone-meta">{subtitle(n)}</span>
                  </span>
                  <svg aria-hidden="true" className="fb-row-chev" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6"/></svg>
                </button>
              </li>
            ))}
          </ul>
        )}
        {showFiles && (
          <>
            <div role="group" aria-label="Εμφάνιση αρχείων" className="fb-seg fb-seg-small">
              <button type="button" className="fb-seg-btn" aria-pressed={grid} onClick={() => setGrid(true)}>Πλέγμα</button>
              <button type="button" className="fb-seg-btn" aria-pressed={!grid} onClick={() => setGrid(false)}>Λίστα</button>
            </div>
            {grid ? (
              <ul className="fb-phone-grid" data-list>
                {yearItems.map(f => (
                  <li key={f.id}>
                    <button type="button" className="fb-phone-tile" onClick={() => onOpen(f)} disabled={!f.url} title={f.fileName}>
                      <span className="fb-phone-thumb">
                        {f.isImage && f.url ? <RuntimeImg src={f.url} alt="" className="fb-preview-img"/> : <FileIcon ext={extOfFile(f)} size={30}/>}
                      </span>
                      <span className="fb-phone-tile-name"><Breakable name={f.fileName}/></span>
                      <span className="fb-phone-meta">{[f.value != null ? fe(f.value) : null, f.date ? fd(f.date) : null].filter(Boolean).join(' · ')}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="fb-phone-list">
                {yearItems.map(f => (
                  <li key={f.id}>
                    <button type="button" className="fb-phone-row" onClick={() => onOpen(f)} disabled={!f.url} title={f.fileName}>
                      <FileIcon ext={extOfFile(f)} size={22}/>
                      <span className="fb-phone-text">
                        <span className="fb-phone-name fb-wrap"><Breakable name={f.fileName}/></span>
                        <span className="fb-phone-meta">{[f.value != null ? fe(f.value) : null, f.date ? fd(f.date) : null].filter(Boolean).join(' · ')}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
