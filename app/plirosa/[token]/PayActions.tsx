'use client';
// Τα δύο κουμπιά της σελίδας «Πλήρωσα»: πληρωμή και αναίρεση, με POST.
import { useState } from 'react';
import { Btn } from '@/components/Theme';

type Phase = 'ask' | 'paid' | 'undone' | 'failed' | 'used';

export function PayActions({ token, used, undoable, undoHours, expenseEligible, expenseDuplicate, expenseDefault }: {
  token: string; used: boolean; undoable: boolean; undoHours: number;
  expenseEligible: boolean; expenseDuplicate: boolean; expenseDefault: boolean;
}) {
  const [phase, setPhase] = useState<Phase>(used ? 'used' : 'ask');
  const [expense, setExpense] = useState(false);
  // Η δαπάνη είναι ΕΠΙΛΟΓΗ του χρήστη, ορατή πριν από το πάτημα. Τσεκαρισμένη
  // μόνο όταν ο διακομιστής ξέρει ότι δεν υπάρχει ήδη έξοδο για τη δόση.
  const [withExpense, setWithExpense] = useState(expenseDefault);
  const [busy, setBusy] = useState(false);

  async function send(action: 'pay' | 'undo') {
    setBusy(true);
    try {
      const res = await fetch('/api/plirosa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, action, ...(action === 'pay' && expenseEligible && withExpense ? { expense: true } : {}) }) });
      const out = await res.json().catch(() => ({ ok: false }));
      if (out.ok) { setExpense(!!out.expense); setPhase(action === 'pay' ? 'paid' : 'undone'); }
      else setPhase(out.kind === 'used' ? 'used' : 'failed');
    } catch { setPhase('failed'); }
    setBusy(false);
  }

  const P = { margin: '0 0 18px', fontSize: 15, lineHeight: 1.65, color: 'var(--text-secondary)' } as const;
  if (phase === 'ask') return (
    <>
      <p style={P}>Σημειώνεται ως πληρωμένη και σταματούν οι υπενθυμίσεις της.</p>
      {expenseEligible && (
        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', margin: '0 0 20px', fontSize: 15, lineHeight: 1.5, color: 'var(--text-primary)', cursor: 'pointer' }}>
          <input type="checkbox" checked={withExpense} onChange={e => setWithExpense(e.target.checked)} style={{ marginTop: 2, width: 18, height: 18, flexShrink: 0 }} />
          <span>
            Καταχώρησέ τη και στις δαπάνες του ακινήτου, ως ΕΝΦΙΑ
            {expenseDuplicate && (
              <span style={{ display: 'block', marginTop: 4, fontSize: 13, color: 'var(--text-tertiary)' }}>
                Υπάρχει ήδη καταχωρημένο έξοδο για αυτή τη δόση.
              </span>
            )}
          </span>
        </label>
      )}
      <Btn variant="primary" onClick={() => send('pay')} disabled={busy}>Πλήρωσα</Btn>
    </>
  );
  if (phase === 'paid') return (
    <>
      <p style={P}>{expense ? 'Σημειώθηκε ως πληρωμένη και καταχωρήθηκε στις δαπάνες του ακινήτου.' : 'Σημειώθηκε ως πληρωμένη.'} Οι υπενθυμίσεις της σταματούν.</p>
      <Btn onClick={() => send('undo')} disabled={busy}>Αναίρεση</Btn>
      <p style={{ ...P, margin: '14px 0 0', fontSize: 13, color: 'var(--text-tertiary)' }}>{`Η αναίρεση από εδώ ισχύει για ${undoHours} ώρες· μετά, από το Ημερολόγιο της εφαρμογής.`}</p>
    </>
  );
  if (phase === 'undone') return <p style={P}>Η προθεσμία άνοιξε ξανά{expense ? ' και η δαπάνη σβήστηκε' : ''}.</p>;
  if (phase === 'used') return (
    <>
      <p style={P}>Η προθεσμία έχει ήδη σημειωθεί ως πληρωμένη.</p>
      {undoable && <Btn onClick={() => send('undo')} disabled={busy}>Αναίρεση</Btn>}
    </>
  );
  return <p style={P}>Δεν έγινε τώρα. Δοκίμασε ξανά σε λίγο ή σημείωσέ την από το Ημερολόγιο της εφαρμογής.</p>;
}
