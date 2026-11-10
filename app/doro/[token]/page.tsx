// ═══════════════════════════════════════════════════════════════════════════
// /doro/<διακριτικό>: Η ΑΠΟΔΟΧΗ ΤΟΥ ΔΩΡΟΥ ΤΗΣ ΚΛΗΡΩΣΗΣ ΑΞΙΟΛΟΓΗΣΗΣ
// ─────────────────────────────────────────────────────────────────────────
// Ο σύνδεσμος φτάνει με το email `feedback_prize_won`. Οι Όροι (#klirosi)
// θέλουν «απάντηση» σε 14 ημέρες· εδώ είναι το «Αποδέχομαι το δώρο», με
// υποχρεωτικό «Είμαι άνω των 18». ΠΟΤΕ 500: χωρίς ρυθμίσεις ή με πεσμένη βάση
// η σελίδα λέει «Δεν φορτώθηκε τώρα» και δείχνει τον δρόμο μέσα από την εφαρμογή.
// ═══════════════════════════════════════════════════════════════════════════
import BrandMark from '@/components/BrandMark';
import { T } from '@/components/tokens';
import { grDate } from '@/lib/core/format';
import { peekPrizeForPage } from '@/lib/feedback/prizePage';
import { PRIZE_ACCEPT_DAYS } from '@/lib/feedback/prize';
import { PLANS } from '@/lib/billing/plans';
import { PrizeActions } from './PrizeActions';

export const dynamic = 'force-dynamic';

const BOX = { maxWidth: 480, margin: '0 auto', padding: 'clamp(28px,6vw,48px) 20px' } as const;
const P = { margin: '0 0 14px', fontSize: 15, lineHeight: 1.65, color: 'var(--text-secondary)' } as const;

/** Η ημερομηνία λήξης σε dd/mm/yyyy, ώρα Αθήνας. */
const athensDay = (iso: string): string =>
  grDate(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Athens', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso)));

const FAIL_TITLE = { invalid: 'Ο σύνδεσμος δεν ισχύει', expired: 'Ο σύνδεσμος έληξε', used: 'Το δώρο έχει ήδη γίνει αποδεκτό', error: 'Δεν φορτώθηκε τώρα', adult_required: 'Ο σύνδεσμος δεν ισχύει' } as const;

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const out = await peekPrizeForPage(token);
  const pkg = PLANS.agency.name;
  return (
    <div data-mode="dark" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', minHeight: '100vh', fontFamily: T.font.sans }}>
      <main style={BOX}>
        <div style={{ marginBottom: 28 }}><BrandMark /></div>
        {!out.ok ? (
          <>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 10px' }}>{FAIL_TITLE[out.kind]}</h1>
            <p style={{ ...P, margin: 0 }}>
              {out.kind === 'used' ? `Ο χρόνος «${pkg}» είναι ήδη στον λογαριασμό σου.`
                : out.kind === 'expired' ? `Πέρασαν οι ${PRIZE_ACCEPT_DAYS}\u00A0ημέρες για την αποδοχή και το δώρο κληρώθηκε ξανά, όπως ορίζουν οι Όροι.`
                : out.kind === 'error' ? 'Δοκίμασε ξανά σε λίγο, ή αποδέξου το δώρο μέσα στην εφαρμογή, από τη φόρμα «Η γνώμη σου».'
                : 'Αν κέρδισες στην κλήρωση, μπορείς να αποδεχτείς το δώρο μέσα στην εφαρμογή, από τη φόρμα «Η γνώμη σου».'}
            </p>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 10px', textWrap: 'balance' }}>{`Κέρδισες έναν χρόνο «${pkg}»`}</h1>
            <p style={P}>{`Ο χρόνος πιστώνεται στον λογαριασμό σου τη στιγμή της αποδοχής. Ο σύνδεσμος ισχύει ως τις ${athensDay(out.expiresAt)}.`}</p>
            <PrizeActions token={token} pkg={pkg} days={PRIZE_ACCEPT_DAYS} />
            <p style={{ ...P, margin: '18px 0 0', fontSize: 13, color: 'var(--text-tertiary)' }}>
              Το δώρο δεν εξαργυρώνεται σε μετρητά και δεν μεταβιβάζεται. <a href="/terms#klirosi" style={{ color: 'inherit' }}>Όροι κλήρωσης</a>
            </p>
          </>
        )}
      </main>
    </div>
  );
}
