'use client'
// ═══════════════════════════════════════════════════════════════════════════
// Η ΕΠΙΤΟΠΙΑ ΕΠΕΞΕΡΓΑΣΙΑ: ΑΡΙΘΜΟΣ ΚΑΙ ΚΕΙΜΕΝΟ ΠΟΥ ΑΛΛΑΖΟΥΝ ΜΕ ΕΝΑ ΠΑΤΗΜΑ
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect, useRef } from 'react'
import { T } from '@/components/Theme'

// ── Επιτόπου επεξεργασία αριθμού (κλικ στο νούμερο → το αλλάζεις) ─────────────
// Δείχνει τη διαμορφωμένη τιμή· με κλικ γίνεται πεδίο, εστιάζει και επιλέγει το
// κείμενο. Enter/έξοδος εστίασης αποθηκεύει, Esc ακυρώνει. Ίδιο idiom παντού.
export function InlineNumber({ raw, display, onCommit, width = 66, align = 'right', ariaLabel, big = false }: {
  raw: string; display: string; onCommit: (v: string) => void; width?: number; align?: 'left' | 'right'; ariaLabel?: string; big?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [hov, setHov] = useState(false);
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => { if (editing) { ref.current?.focus(); ref.current?.select(); } }, [editing]);
  if (editing) {
    return (
      <span onClick={e => e.stopPropagation()} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <input ref={ref} value={draft} inputMode="decimal" aria-label={ariaLabel}
          onChange={e => setDraft(e.target.value.replace(/[^\d.,]/g, ''))}
          onKeyDown={e => { if (e.key === 'Enter') { onCommit(draft.trim().replace(',', '.')); setEditing(false); } else if (e.key === 'Escape') setEditing(false); }}
          onBlur={() => { onCommit(draft.trim().replace(',', '.')); setEditing(false); }}
          /* ΤΟ ΠΕΔΙΟ ΔΕΝ ΣΥΡΡΙΚΝΩΝΕΤΑΙ ΚΑΤΩ ΑΠΟ ΤΟΝ ΑΡΙΘΜΟ ΤΟΥ. Το «width» είναι
             αρχικό μέγεθος, όχι όριο: μέσα σε flex το πεδίο έπεφτε στα 29
             εικονοστοιχεία στα 320 και έμεναν 17 ωφέλιμα για το «250», δηλαδή
             ο χρήστης διόρθωνε ποσό που δεν έβλεπε. Ο σαρωτής σε WebKit το
             μέτρησε 31 σε 17· σε Chromium ήταν 21 σε 17, οριακά κάτω από το
             κατώφλι, γι' αυτό δεν είχε αναφερθεί ποτέ. Ηταν σπασμένο και στα
             δύο — απλώς ο ένας μετρητής δεν το έλεγε. */
          style={{ width, flexShrink: 0, height: big ? 30 : 22, padding: '0 6px', textAlign: align, borderRadius: T.radius.xs, border: '1px solid var(--border-accent)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: big ? 18 : 12, fontWeight: 700, fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums', outline: 'none' }} />
      </span>
    );
  }
  return (
    <button type="button" aria-label={ariaLabel}
      onClick={e => { e.stopPropagation(); setDraft(raw ?? ''); setEditing(true); }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'text', font: 'inherit', color: hov ? 'var(--accent)' : 'inherit', borderBottom: `1px dashed ${hov ? 'var(--border-accent)' : 'transparent'}`, transition: 'color 0.15s, border-color 0.15s', fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums' }}>
      {display}
    </button>
  );
}

// Επιτόπου επεξεργασία κειμένου (μετονομασία κατηγορίας).
export function InlineText({ value, onCommit, ariaLabel }: { value: string; onCommit: (v: string) => void; ariaLabel?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [hov, setHov] = useState(false);
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => { if (editing) { ref.current?.focus(); ref.current?.select(); } }, [editing]);
  if (editing) {
    return (
      <input ref={ref} value={draft} aria-label={ariaLabel} maxLength={40}
        onChange={e => setDraft(e.target.value)}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => { if (e.key === 'Enter') { const v = draft.trim(); if (v) onCommit(v); setEditing(false); } else if (e.key === 'Escape') setEditing(false); }}
        onBlur={() => { const v = draft.trim(); if (v && v !== value) onCommit(v); setEditing(false); }}
        style={{ width: 160, height: 26, padding: '0 7px', borderRadius: T.radius.xs, border: '1px solid var(--border-accent)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 12, fontWeight: 600, fontFamily: T.font.sans, outline: 'none' }} />
    );
  }
  return (
    <button type="button" aria-label={ariaLabel}
      onClick={e => { e.stopPropagation(); setDraft(value); setEditing(true); }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'text', fontSize: 12, fontWeight: 500, fontFamily: T.font.sans, color: 'var(--text-primary)', borderBottom: `1px dashed ${hov ? 'var(--border-accent)' : 'transparent'}`, transition: 'border-color 0.15s' }}>
      {value}
    </button>
  );
}
