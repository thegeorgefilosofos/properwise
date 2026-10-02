'use client';

// Το παράθυρο αποδοχής της σύμβασης επεξεργασίας (βλ. lib/legal/dpa.ts). Ανοίγει
// μόνο όταν το ζητήσει μια αποθήκευση στοιχείων ενοικιαστή και απαντά σε εκείνη:
// «Αποδέχομαι» συνεχίζει την αποθήκευση, «Όχι τώρα» τη σταματά.

import { useEffect, useRef, useState } from 'react';
import { T, Btn, Modal } from '@/components/Theme';
import { createClient } from '@/lib/supabase/client';
import { logActivity } from '@/lib/activity';
import { DPA_EVENT, DPA_HREF, DPA_VERSION, type DpaRequestDetail } from '@/lib/legal/dpa';

export default function DpaModal() {
  const [open, setOpen] = useState(false);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const pending = useRef<((ok: boolean) => void)[]>([]);

  useEffect(() => {
    const onRequest = (e: Event) => {
      const detail = (e as CustomEvent<DpaRequestDetail>).detail;
      if (!detail) return;
      detail.handled = true;
      pending.current.push(detail.resolve);
      setErr('');
      setOpen(true);
    };
    window.addEventListener(DPA_EVENT, onRequest);
    return () => window.removeEventListener(DPA_EVENT, onRequest);
  }, []);

  const finish = (ok: boolean) => {
    const waiting = pending.current;
    pending.current = [];
    waiting.forEach(r => r(ok));
    setOpen(false);
    setAgree(false);
    setBusy(false);
  };

  const accept = async () => {
    setBusy(true);
    setErr('');
    const supabase = createClient();
    const at = new Date().toISOString();
    const { error } = await supabase.auth.updateUser({ data: { dpa_version: DPA_VERSION, dpa_accepted_at: at } });
    if (error) {
      setBusy(false);
      setErr('Η αποδοχή δεν καταγράφηκε. Δοκίμασε ξανά σε λίγο.');
      return;
    }
    await logActivity(supabase, 'dpa_accepted', 'legal', undefined, { version: DPA_VERSION, at });
    finish(true);
  };

  return (
    <Modal open={open} onClose={() => finish(false)} size="md"
      title="Σύμβαση επεξεργασίας για τα στοιχεία του ενοικιαστή"
      footer={<>
        <Btn variant="secondary" onClick={() => finish(false)}>Όχι τώρα</Btn>
        <Btn variant="primary" onClick={accept} disabled={!agree || busy}>Αποδέχομαι</Btn>
      </>}>
      <p style={{ margin: 0, fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', lineHeight: 1.6, fontFamily: T.font.sans }}>
        Τα στοιχεία του ενοικιαστή (όνομα, ΑΦΜ, μισθωτήριο) τα ανεβάζεις εσύ, ως υπεύθυνος επεξεργασίας.
        Το PROPERWISE τα επεξεργάζεται μόνο για λογαριασμό σου, με τους όρους του άρθρου 28 του GDPR.
        Η σύμβαση ζητείται μία φορά, πριν από την πρώτη αποθήκευση.
      </p>
      <p style={{ margin: 0, fontSize: 'var(--fs-base)', lineHeight: 1.6, fontFamily: T.font.sans }}>
        <a href={DPA_HREF} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecorationLine: 'underline', textUnderlineOffset: 2, fontWeight: 600 }}>Διάβασε τη σύμβαση στους Όρους</a>
      </p>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', minHeight: 44 }}>
        <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)}
          style={{ width: 16, height: 16, accentColor: 'var(--accent)', flexShrink: 0 }} />
        <span style={{ fontSize: 'var(--fs-base)', color: 'var(--text-primary)', fontFamily: T.font.sans }}>Αποδέχομαι τη σύμβαση επεξεργασίας (έκδοση {DPA_VERSION})</span>
      </label>
      {err && <p role="alert" style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--negative)', fontFamily: T.font.sans }}>{err}</p>}
    </Modal>
  );
}
