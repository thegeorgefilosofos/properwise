'use client';
// ═══════════════════════════════════════════════════════════════════════════
// «ΓΡΑΨΕ ΜΑΣ»: ΜΙΑ ΦΟΡΜΑ ΜΕ ΔΥΟ ΑΠΑΝΤΗΣΕΙΣ (Μ17, αξιολόγηση 23/11/2026)
// ─────────────────────────────────────────────────────────────────────────
// Οι Ρυθμίσεις τελείωναν με δύο φόρμες κειμένου στη σειρά, «Υποστήριξη» και
// «Κάνε το PROPERWISE καλύτερο», με δύο κουμπιά «Αποστολή». Ο χρήστης έπρεπε
// να μαντέψει σε ποια γράφει. Τώρα διαλέγει τι θέλει να πει και η φόρμα
// ακολουθεί. Οι δύο δρόμοι μένουν όπως ήταν: το πρόβλημα φτάνει στην
// υποστήριξη με απάντηση στο email (app/api/support), η ιδέα στη γνώμη με την
// κλήρωσή της (Feedback.tsx). Καμία λέξη χρέωσης ή κλήρωσης δεν γράφεται εδώ.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { T } from '@/components/Theme';
import { SegmentControl } from './UIComponents';
import SupportForm from './SupportForm';
import Feedback from './Feedback';
import type { PlanId } from '@/lib/billing/plans';

type Kind = 'problem' | 'idea';

export default function WriteToUs({ plan, en }: {
  plan?: PlanId;
  /** Τίτλος και επιλογές στα αγγλικά (settings.ts)· οι φόρμες μένουν ως έχουν. */
  en?: { title: string; problem: string; idea: string };
}) {
  const [kind, setKind] = useState<Kind>('problem');
  return (
    <div>
      <div className="set-head">
        <span className="set-head-ico" aria-hidden="true"><MessageSquare size={15} /></span>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: T.font.sans, letterSpacing: '-0.01em' }}>
          {en ? en.title : 'Γράψε μας'}
        </span>
      </div>
      <div style={{ marginTop: 12 }}>
        <SegmentControl ariaLabel={en ? en.title : 'Γράψε μας'} value={kind} onChange={v => setKind(v as Kind)}
          options={[{ value: 'problem', label: en ? en.problem : 'Πρόβλημα' }, { value: 'idea', label: en ? en.idea : 'Ιδέα' }]} />
      </div>
      {kind === 'problem' ? <SupportForm plan={plan} bare /> : <Feedback target="general" embedded />}
    </div>
  );
}
