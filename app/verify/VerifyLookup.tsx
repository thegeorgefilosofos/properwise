'use client';

// Η φόρμα του κωδικού για το /verify (βλ. page.tsx). Ο κωδικός γράφεται όπως
// είναι τυπωμένος και η σελίδα που ανοίγει είναι η ίδια με του QR.
import { T } from '@/components/tokens';
import { Btn } from '@/components/Theme';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { normalizeVerifyCode } from '@/lib/documents/verifyCode';

export default function VerifyLookup() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // Κενά, πεζά, ελληνικό «ΡΟ» και «P0» δεν αλλάζουν τον κωδικό
    // (lib/documents/verifyCode.ts).
    const id = normalizeVerifyCode(code);
    if (!id) { setError('Γράψε τον κωδικό όπως είναι τυπωμένος στο έγγραφο.'); return; }
    router.push(`/verify/${encodeURIComponent(id)}`);
  };

  // ΕΝΑ ΠΑΡΑΔΕΙΓΜΑ ΠΟΥ ΜΟΙΑΖΕΙ ΜΕ ΑΛΗΘΙΝΟ ΚΩΔΙΚΟ (01.10.2026). Το «PO-…» στη
  // γραμματοσειρά σταθερού πλάτους διαβαζόταν «P0-…» και έμοιαζε σπασμένο
  // πεδίο. Η μορφή είναι αυτή της γεννήτριας (lib/documents/verifyCode.ts):
  // PO, ημερομηνία ΕΕΜΜΗΗ, οκτώ σύμβολα χωρίς 0/O και 1/I/L.
  return (
    <form onSubmit={submit} style={{ paddingTop: T.sp.md }}>
      <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 20px', textWrap: 'pretty' }}>
        Ο κωδικός είναι τυπωμένος δίπλα στο QR του εγγράφου.
      </p>
      {/* Ετικέτα σε πεζά 13, όπως στη σύνδεση και στην εγγραφή. */}
      <label htmlFor="verify-code" className="po-field-label">
        Κωδικός εγγράφου
      </label>
      <input id="verify-code" name="code" value={code} autoComplete="off" autoCapitalize="characters" spellCheck={false}
        onChange={e => { setCode(e.target.value); if (error) setError(''); }}
        placeholder="PO-260915-7KQ3MXNA" aria-invalid={!!error || undefined} aria-describedby={error ? 'verify-code-err' : undefined}
        style={{ width: '100%', boxSizing: 'border-box', minHeight: T.h.lg, padding: '10px 16px', borderRadius: T.radius.btn, border: '1px solid var(--border-default)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 14, fontFamily: T.font.mono, letterSpacing: '0.02em' }} />
      {error && <p id="verify-code-err" role="alert" style={{ fontSize: 13, color: 'var(--negative-on-container)', margin: '6px 0 0', lineHeight: 1.5 }}>{error}</p>}
      {/* Ολο το πλάτος, κάτω από το πεδίο, όπως η υποβολή κάθε άλλης φόρμας της
          δημόσιας πλευράς. Ηταν 36 ψηλό και όσο το λεκτικό, δίπλα σε πεδίο 40. */}
      <div style={{ marginTop: 16, display: 'grid' }}><Btn variant="primary" type="submit" field>Έλεγχος</Btn></div>
    </form>
  );
}
