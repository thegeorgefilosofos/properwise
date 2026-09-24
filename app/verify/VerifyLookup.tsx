'use client';

// Η φόρμα του κωδικού για το /verify (βλ. page.tsx). Ο κωδικός γράφεται όπως
// είναι τυπωμένος και η σελίδα που ανοίγει είναι η ίδια με του QR.
import { T } from '@/components/tokens';
import { Btn } from '@/components/Theme';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function VerifyLookup() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // Κενά και πεζά της πληκτρολόγησης δεν αλλάζουν τον κωδικό: η γεννήτρια
    // (lib/documents/issue.ts) γράφει μόνο κεφαλαία και ψηφία.
    const id = code.replace(/\s+/g, '').toUpperCase();
    if (!id) { setError('Γράψε τον κωδικό όπως είναι τυπωμένος στο έγγραφο.'); return; }
    router.push(`/verify/${encodeURIComponent(id)}`);
  };

  return (
    <form onSubmit={submit} style={{ paddingTop: T.sp.xl }}>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 16px' }}>
        Ο κωδικός είναι τυπωμένος δίπλα στο QR του εγγράφου.
      </p>
      <label htmlFor="verify-code" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
        Κωδικός εγγράφου
      </label>
      <input id="verify-code" name="code" value={code} autoComplete="off" autoCapitalize="characters" spellCheck={false}
        onChange={e => { setCode(e.target.value); if (error) setError(''); }}
        placeholder="PO-…" aria-invalid={!!error || undefined} aria-describedby={error ? 'verify-code-err' : undefined}
        style={{ width: '100%', boxSizing: 'border-box', minHeight: T.h.lg, padding: '10px 16px', borderRadius: T.radius.btn, border: '1px solid var(--border-default)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 14, fontFamily: T.font.mono, letterSpacing: '0.02em' }} />
      {error && <p id="verify-code-err" role="alert" style={{ fontSize: 12, color: 'var(--negative-on-container)', margin: '6px 0 0', lineHeight: 1.5 }}>{error}</p>}
      <div style={{ marginTop: 16 }}><Btn variant="primary" type="submit">Έλεγχος</Btn></div>
    </form>
  );
}
