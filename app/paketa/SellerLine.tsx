// ═══════════════════════════════════════════════════════════════════════════
// ΑΠΟ ΠΟΙΟΝ ΑΓΟΡΑΖΕΙΣ, ΠΡΙΝ ΠΛΗΡΩΣΕΙΣ
// ─────────────────────────────────────────────────────────────────────────
// ΑΠΟΦΑΣΗ GEORGE 21/10/2026. Το ταμείο ανοίγει με πωλητή τον έμπορο (merchant
// of record), χωρίς τα στοιχεία του φορέα (lib/legal/checkout.ts). Ο αγοραστής
// πρέπει να βλέπει τον πωλητή και τους όρους του δίπλα στο κουμπί της αγοράς,
// όχι μόνο στους Όρους. Το κείμενο και ο σύνδεσμος έρχονται από το
// `billingWords().seller` (lib/legal/billingWords.ts)· εδώ μόνο η απόδοση.
// ═══════════════════════════════════════════════════════════════════════════
import { T } from '@/components/tokens';

export function SellerLine({ seller }: { seller: { line: string; termsUrl: string; termsLabel: string } | null }) {
  if (!seller) return null;
  return (
    <p className="po-seller" style={{ margin: `${T.sp.md}px 0 0`, fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)', textAlign: 'center' }}>
      {seller.line}{' '}
      <a href={seller.termsUrl} target="_blank" rel="noopener" style={{ color: 'inherit', textDecoration: 'underline' }}>{seller.termsLabel}</a>
    </p>
  );
}
