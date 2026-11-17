'use client';
// Το «Αποδέχομαι το δώρο» με το υποχρεωτικό «Είμαι άνω των 18». Το κουμπί
// μένει ανενεργό χωρίς τη δήλωση· η βάση την απαιτεί ξανά (adult_confirmed_at).
import { useId, useState } from 'react';
import { Btn } from '@/components/Theme';

type Phase = 'ask' | 'done' | 'used' | 'expired' | 'failed';

export function PrizeActions({ token, pkg, days }: { token: string; pkg: string; days: number }) {
  const id = useId();
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<Phase>('ask');

  async function accept() {
    if (!adult) return;
    setBusy(true);
    try {
      const res = await fetch('/api/doro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, adult: true }) });
      const out = await res.json().catch(() => ({ ok: false }));
      setPhase(out.ok ? 'done' : out.kind === 'used' ? 'used' : out.kind === 'expired' ? 'expired' : 'failed');
    } catch { setPhase('failed'); }
    setBusy(false);
  }

  const P = { margin: 0, fontSize: 15, lineHeight: 1.65, color: 'var(--text-secondary)' } as const;
  if (phase === 'done') return <p role="status" style={P}>{`Έγινε. Ο χρόνος «${pkg}» πιστώθηκε στον λογαριασμό σου και τον βλέπεις στη Συνδρομή.`}</p>;
  if (phase === 'used') return <p role="status" style={P}>{`Το δώρο έχει ήδη γίνει αποδεκτό. Ο χρόνος «${pkg}» είναι στον λογαριασμό σου.`}</p>;
  if (phase === 'expired') return <p role="status" style={P}>{`Πέρασαν οι ${days}\u00A0ημέρες για την αποδοχή και το δώρο κληρώθηκε ξανά, όπως ορίζουν οι Όροι.`}</p>;
  return (
    <>
      <label htmlFor={id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', margin: '0 0 18px', fontSize: 15, lineHeight: 1.5, color: 'var(--text-primary)', cursor: 'pointer' }}>
        <input id={id} type="checkbox" checked={adult} onChange={e => setAdult(e.target.checked)} style={{ marginTop: 2, width: 18, height: 18, flexShrink: 0 }} />
        <span>Είμαι άνω των 18</span>
      </label>
      <Btn variant="primary" onClick={accept} disabled={busy || !adult}>Αποδέχομαι το δώρο</Btn>
      {phase === 'failed' && <p role="alert" style={{ ...P, marginTop: 14 }}>Δεν ολοκληρώθηκε τώρα. Δοκίμασε ξανά σε λίγο.</p>}
    </>
  );
}
