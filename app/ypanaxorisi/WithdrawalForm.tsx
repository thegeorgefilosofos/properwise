'use client';

// ═══════════════════════════════════════════════════════════════════════════
// Η ΦΟΡΜΑ ΣΕ ΤΡΙΑ ΒΗΜΑΤΑ: ΔΗΛΩΣΗ, ΕΠΙΒΕΒΑΙΩΣΗ, ΑΠΟΔΕΙΚΤΙΚΟ
// ─────────────────────────────────────────────────────────────────────────
// Το άρθ. 11α της Οδηγίας 2011/83/ΕΕ (lib/legal/withdrawal.ts) θέλει δύο
// ξεχωριστές ενέργειες: τη δήλωση και το «Επιβεβαίωση υπαναχώρησης», ώστε
// κανείς να μην υπαναχωρεί κατά λάθος. Το πρώτο κουμπί ΔΕΝ στέλνει τίποτα·
// δείχνει ολόκληρη τη δήλωση όπως θα καταγραφεί. Μόνο το δεύτερο τη στέλνει.
//
// Ο ΕΛΕΓΧΟΣ ΓΙΝΕΤΑΙ ΚΑΙ ΕΔΩ ΚΑΙ ΣΤΟΝ ΔΙΑΚΟΜΙΣΤΗ, με την ΙΔΙΑ συνάρτηση: η
// οθόνη λέει αμέσως τι λείπει, ο διακομιστής δεν εμπιστεύεται την οθόνη.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from 'react';
import { T, Btn } from '@/components/Theme';
import { fmtFor } from '@/lib/core/format';
import { useToolEn, NO_EN, type ToolEn } from '@/lib/i18n/toolEn';
import { validateWithdrawal, withdrawalLastDay, WITHDRAWAL_CONFIRM_LABEL, type WithdrawalClean } from '@/lib/legal/withdrawal';

type Step = 'form' | 'confirm' | 'done';
type WithdrawalEn = NonNullable<ToolEn['withdrawal']>['E'];

const field: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
  borderRadius: T.radius.btn, padding: '10px 16px', minHeight: T.h.lg, color: 'var(--text-primary)', fontSize: 14, fontFamily: 'inherit',
};
const label: React.CSSProperties = {
  fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700, display: 'block', marginBottom: 8, fontFamily: T.font.sans,
};
const box: React.CSSProperties = {
  border: '1px solid var(--border-default)', borderRadius: T.radius.card, padding: 'clamp(16px,3vw,24px)', background: 'var(--bg-surface)', margin: '8px 0 0',
};

/**
 * Η δήλωση γραμμή προς γραμμή: ετικέτα πάνω, τιμή από κάτω.
 *
 * ΟΧΙ ΔΥΟ ΣΤΗΛΕΣ. Με πλέγμα «ετικέτα | τιμή» στα 390 η στήλη των ετικετών
 * έπαιρνε όλο το πλάτος και η τιμή έσπαγε ένα γράμμα ανά γραμμή (στιγμιότυπο
 * 20/10/2026). Η στοίβα διαβάζεται ίδια σε κάθε πλάτος.
 */
function Lines({ rows }: { rows: [string, string][] }) {
  return (
    <dl style={{ display: 'grid', gap: 10, margin: '0 0 16px' }}>
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{k}</dt>
          <dd style={{ margin: '2px 0 0', fontSize: 14, color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function WithdrawalForm({ signedIn, prefill }: {
  signedIn: boolean;
  prefill: { name: string; email: string; contract: string };
}) {
  // Τα αγγλικά από τον πάροχο του /en/withdrawal (lib/i18n/toolEn.ts)· εδώ δεν
  // εισάγεται κανένα αγγλικό λεξικό, ώστε να μην κατεβαίνει στα ελληνικά.
  const X = useToolEn()?.withdrawal, en = X !== undefined, E = (X?.E ?? NO_EN) as WithdrawalEn;
  const grDate = fmtFor(en ? 'en' : 'el').date;
  const [step, setStep] = useState<Step>('form');
  const [name, setName] = useState(prefill.name);
  const [email, setEmail] = useState(prefill.email);
  const [contract, setContract] = useState(prefill.contract);
  const [purchaseDate, setPurchaseDate] = useState('');
  const [website, setWebsite] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [clean, setClean] = useState<WithdrawalClean | null>(null);
  const [done, setDone] = useState<{ reference: string; lines: [string, string][]; ackSent: boolean } | null>(null);

  const next = () => {
    const r = validateWithdrawal({ name, email, contract, purchaseDate });
    if (!r.ok) { setError(en ? E.error(r.error) : r.error); return; }
    setError(''); setClean(r.value); setStep('confirm');
  };

  const confirm = async () => {
    if (!clean) return;
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/withdrawal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, contract, purchaseDate, website }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) { setError(en ? E.error(String(j.error || '')) : String(j.error || 'Η δήλωση δεν καταγράφηκε. Δοκίμασε ξανά ή γράψε μας με email.')); return; }
      // Στα αγγλικά οι γραμμές γράφονται από τη δήλωση που μόλις ελέγχθηκε· ο
      // διακομιστής τις επιστρέφει στα ελληνικά, όπως και το αποδεικτικό.
      setDone({ reference: j.reference, lines: en ? [[E.reference, String(j.reference ?? '')], ...confirmRows()] : j.lines, ackSent: !!j.ackSent });
      setStep('done');
    } catch {
      setError(en ? E.offline : 'Δεν υπάρχει σύνδεση με τον διακομιστή. Δοκίμασε ξανά ή στείλε τη δήλωση με email.');
    } finally {
      setBusy(false);
    }
  };

  function confirmRows(): [string, string][] {
    if (!clean) return [];
    return en ? [
      [E.statement, E.statementText],
      [E.name, clean.name],
      [E.email, clean.email],
      [E.contract, clean.contract],
      [E.purchaseDate, clean.purchaseIso ? grDate(clean.purchaseIso) : E.notGiven],
      ...(clean.purchaseIso ? [[E.lastDay, grDate(withdrawalLastDay(clean.purchaseIso))] as [string, string]] : []),
    ] : [
      ['Δήλωση', 'Υπαναχωρώ από τη σύμβαση.'],
      ['Ονοματεπώνυμο', clean.name],
      ['Ηλεκτρονικό ταχυδρομείο για το αποδεικτικό', clean.email],
      ['Σύμβαση', clean.contract],
      ['Ημερομηνία αγοράς', clean.purchaseIso ? grDate(clean.purchaseIso) : 'δεν δηλώθηκε'],
      ...(clean.purchaseIso ? [['Τελευταία ημέρα προθεσμίας', grDate(withdrawalLastDay(clean.purchaseIso))] as [string, string]] : []),
    ];
  }

  const err = error && <p role="alert" style={{ color: 'var(--negative)', fontSize: 14, margin: '12px 0 0' }}>{error}</p>;

  if (step === 'done' && done) {
    return (
      <div style={box} aria-live="polite">
        <p style={{ fontSize: 18, fontWeight: 600, margin: '0 0 12px', color: 'var(--text-primary)' }}>{en ? E.done : 'Η δήλωσή σου καταγράφηκε.'}</p>
        <Lines rows={done.lines} />
        <p className="lg-p" style={{ margin: 0 }}>
          {en ? (done.ackSent ? E.ackSent : E.ackPending) : done.ackSent
            ? 'Σου στείλαμε το αποδεικτικό στο email σου, με το ίδιο περιεχόμενο. Κράτησέ το.'
            : 'Το αποδεικτικό δεν έφυγε ακόμη με email. Η δήλωση ισχύει από τη στιγμή που καταγράφηκε· κράτησε τον κωδικό της και θα σου το στείλουμε.'}
        </p>
      </div>
    );
  }

  if (step === 'confirm' && clean) {
    const rows = confirmRows();
    return (
      <div style={box}>
        <p style={{ fontSize: 16, fontWeight: 600, margin: '0 0 12px', color: 'var(--text-primary)' }}>{en ? E.check : 'Έλεγξε τη δήλωση πριν την υποβάλεις'}</p>
        <Lines rows={rows} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <Btn variant="primary" onClick={confirm} disabled={busy}>{en ? (busy ? E.submitting : E.confirm) : busy ? 'Υποβολή…' : WITHDRAWAL_CONFIRM_LABEL}</Btn>
          <Btn variant="secondary" onClick={() => setStep('form')} disabled={busy}>{en ? E.back : 'Πίσω για διόρθωση'}</Btn>
        </div>
        {err}
      </div>
    );
  }

  return (
    <form style={box} onSubmit={e => { e.preventDefault(); next(); }} noValidate>
      <div style={{ display: 'grid', gap: 16 }}>
        <div>
          <label htmlFor="wd-name" style={label}>{en ? E.name : 'Ονοματεπώνυμο'}</label>
          <input id="wd-name" name="name" autoComplete="name" value={name} onChange={e => setName(e.target.value)} style={field} required />
        </div>
        <div>
          <label htmlFor="wd-email" style={label}>{en ? E.email : 'Ηλεκτρονικό ταχυδρομείο για το αποδεικτικό'}</label>
          <input id="wd-email" name="email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} style={field} required
            aria-describedby="wd-email-hint" />
          <p id="wd-email-hint" style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '6px 0 0' }}>
            {en ? (signedIn ? E.emailHintSignedIn : E.emailHintGuest) : signedIn ? 'Από τον λογαριασμό σου. Αν θέλεις το αποδεικτικό αλλού, άλλαξέ το.' : 'Κατά προτίμηση αυτό του λογαριασμού σου, ώστε να βρούμε αμέσως τη συνδρομή.'}
          </p>
        </div>
        <div>
          <label htmlFor="wd-contract" style={label}>{en ? E.whichContract : 'Ποια σύμβαση'}</label>
          <input id="wd-contract" name="contract" value={contract} onChange={e => setContract(e.target.value)} style={field} required
            placeholder={en ? E.contractPlaceholder : 'Πακέτο ή αριθμός παραστατικού'} />
        </div>
        <div>
          <label htmlFor="wd-date" style={label}>{en ? E.dateOptional : 'Ημερομηνία αγοράς (προαιρετικό)'}</label>
          <input id="wd-date" name="purchase-date" inputMode="numeric" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} style={field}
            placeholder={en ? E.datePlaceholder : 'ΗΗ/ΜΜ/ΕΕΕΕ'} />
        </div>
        {/* Το κρυφό πεδίο: το γεμίζουν μόνο ρομπότ. Εκτός ροής και εκτός αναγνωστών οθόνης. */}
        <div aria-hidden="true" style={{ position: 'absolute', left: -10000, width: 1, height: 1, overflow: 'hidden' }}>
          <label htmlFor="wd-website">{en ? E.website : 'Ιστότοπος'}</label>
          <input id="wd-website" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} />
        </div>
        <div>
          <Btn variant="primary" type="submit">{en ? E.next : 'Συνέχεια'}</Btn>
        </div>
      </div>
      {err}
    </form>
  );
}
