'use client';
// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΠΛΑΚΙΔΙΟ ΑΡΧΕΙΟΥ ΤΗΣ ΕΦΑΡΜΟΓΗΣ, ΣΕ ΜΙΑ ΘΕΣΗ
// ─────────────────────────────────────────────────────────────────────────
// Το σχήμα είναι το «Ανέβασε αρχείο» της Σάρωσης (`pick-tile`): ακτίνα κάρτας,
// εικονίδιο 30 με γραμμή 1,5, τίτλος έντονος, λεζάντα μικρή, σύρσιμο αρχείου.
// Ζούσε μέσα στην εισαγωγή του myAADE με τα δικά της λεκτικά. Το «Παραστατικό»
// του λογιστικού γραφείου έδειχνε στη θέση του το γυμνό `<input type=file>` του
// περιηγητή: «Choose File · No file chosen», στα αγγλικά, γκρι κουμπί του
// λειτουργικού μέσα σε σκούρο παράθυρο (08/11/2026). Τώρα το ίδιο πλακίδιο
// εξυπηρετεί και τα δύο· το myAADE κρατά τα λεκτικά του (MyaadeSteps.tsx).
// ═══════════════════════════════════════════════════════════════════════════
import { useRef, useState, type ReactNode } from 'react';
import { T } from '@/components/Theme';

export function DropZone({ onFile, disabled, inputId, title, hint, accept, inputLabel, picked, foot }: {
  onFile: (f: File | undefined) => void;
  disabled: boolean;
  inputId: string;
  /** Το έντονο λεκτικό του πλακιδίου («Ανέβασε την πράξη»). */
  title: string;
  /** Η λεζάντα από κάτω: τι αρχεία δέχεται. */
  hint: string;
  accept: string;
  /** Το όνομα του κρυφού πεδίου για τον αναγνώστη οθόνης. */
  inputLabel: string;
  /** Το αρχείο που διαλέχτηκε: γίνεται ο τίτλος, ώστε να φαίνεται τι θα σταλεί. */
  picked?: string | null;
  /** Γραμμή κάτω από το πλακίδιο, συνδεδεμένη ως περιγραφή του. */
  foot?: ReactNode;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const open = () => { if (!disabled) ref.current?.click(); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: T.sp.md, minWidth: 0 }}>
      <style>{`.drop-tile{transition:background-color .2s,border-color .2s}.drop-tile:hover,.drop-tile[data-drag="true"]{border-color:var(--accent)!important;background:var(--accent-dim)!important}`}</style>
      <div role="button" tabIndex={disabled ? -1 : 0} aria-disabled={disabled} aria-describedby={foot ? `${inputId}-hint` : undefined}
        onClick={open} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }}
        onDragOver={e => { e.preventDefault(); if (!disabled) setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); if (!disabled) onFile(e.dataTransfer.files?.[0]); }}
        className="pick-tile drop-tile" data-drag={drag ? 'true' : 'false'}
        style={{
          border: `1px solid ${picked ? 'var(--accent-border)' : 'var(--border-default)'}`, borderRadius: T.radius.card, minHeight: 172, cursor: disabled ? 'default' : 'pointer',
          background: 'var(--bg-elevated)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: T.sp.lg, minWidth: 0,
        }}>
        <svg aria-hidden="true" width={30} height={30} viewBox="0 0 24 24" fill="none" stroke={picked ? 'var(--accent)' : 'var(--text-tertiary)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: T.sp.md, flexShrink: 0 }}>
          {picked
            ? <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="m9 15 2 2 4-4" /></>
            : <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />}
        </svg>
        <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, marginBottom: T.sp.xs, maxWidth: '100%', overflowWrap: 'anywhere' }}>{drag ? 'Άφησέ το εδώ' : picked || title}</div>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{picked ? 'Πάτα για άλλο αρχείο' : hint}</div>
      </div>
      <input id={inputId} ref={ref} type="file" accept={accept} className="sr-only" tabIndex={-1} aria-label={inputLabel}
        onChange={e => { onFile(e.target.files?.[0]); e.currentTarget.value = ''; }} />
      {foot && <div id={`${inputId}-hint`}>{foot}</div>}
    </div>
  );
}
