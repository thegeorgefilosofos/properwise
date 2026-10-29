// ═══════════════════════════════════════════════════════════════════════════
// /plirosa/<διακριτικό> — Η ΕΠΙΒΕΒΑΙΩΣΗ ΤΟΥ «ΠΛΗΡΩΣΑ»
// ─────────────────────────────────────────────────────────────────────────
// Το άνοιγμα ΔΕΝ πληρώνει τίποτα: δείχνει ποια προθεσμία και ζητά πάτημα, που
// στέλνει POST στο /api/plirosa. Ετσι ο σαρωτής συνδέσμων του παρόχου email,
// που ανοίγει κάθε URL, δεν σημειώνει τίποτα. Χωρίς σύνδεση και χωρίς
// ευρετηρίαση (layout.tsx).
// ═══════════════════════════════════════════════════════════════════════════
import BrandMark from '@/components/BrandMark';
import { T } from '@/components/tokens';
import { fe } from '@/lib/core/format';
import { peekForPage } from '@/lib/reminders/payPage';
import { PAY_UNDO_HOURS } from '@/lib/reminders/payLink';
import { PayActions } from './PayActions';

export const dynamic = 'force-dynamic';

const BOX = { maxWidth: 480, margin: '0 auto', padding: 'clamp(28px,6vw,48px) 20px' } as const;

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const peek = await peekForPage(token, new Date());
  return (
    <div data-mode="dark" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', minHeight: '100vh', fontFamily: T.font.sans }}>
      <main style={BOX}>
        <div style={{ marginBottom: 28 }}><BrandMark /></div>
        {!peek.ok ? (
          <>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 10px' }}>
              {peek.kind === 'expired' ? 'Ο σύνδεσμος έληξε' : peek.kind === 'error' ? 'Δεν φορτώθηκε τώρα' : 'Ο σύνδεσμος δεν ισχύει'}
            </h1>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: 'var(--text-secondary)' }}>
              {peek.kind === 'error' ? 'Δοκίμασε ξανά σε λίγο. ' : ''}Μπορείς να σημειώσεις την πληρωμή και από το Ημερολόγιο του ακινήτου σου στην εφαρμογή.
            </p>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 10px', textWrap: 'balance' }}>{peek.title}</h1>
            {peek.amount != null && peek.amount > 0 && (
              <p style={{ margin: '0 0 14px', fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fe(peek.amount)}</p>
            )}
            <PayActions token={token} used={peek.used} undoable={peek.undoable} undoHours={PAY_UNDO_HOURS} expenseEligible={peek.expenseEligible} />
          </>
        )}
      </main>
    </div>
  );
}
