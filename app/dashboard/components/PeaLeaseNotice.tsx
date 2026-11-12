'use client';

// ═══════════════════════════════════════════════════════════════════════════
// «ΧΡΕΙΑΖΕΤΑΙ ΠΕΑ ΣΕ ΙΣΧΥ»: Η ΗΠΙΑ ΕΙΔΟΠΟΙΗΣΗ ΤΗΣ ΜΙΣΘΩΣΗΣ
// ─────────────────────────────────────────────────────────────────────────
// Εμφανίζεται μόνο όταν το ακίνητο δεν έχει καταχωρημένη λήξη ΠΕΑ ή η λήξη
// πέφτει πριν από την έναρξη της μίσθωσης (lib/property/peaExpiry.ts). Τόνος
// πληροφορίας, όχι σφάλματος: δεν μπλοκάρει τίποτα και δεν αναφέρει πρόστιμα.
// Το μητρώο του ΥΠΕΝ μπαίνει μόνο ως αναφορά.
// ═══════════════════════════════════════════════════════════════════════════
import { InfoBanner } from '@/components/Theme';
import { athensToday } from '@/lib/core/time';
import { leasePeaNotice, PEA_REGISTRY_LABEL, PEA_REGISTRY_URL } from '@/lib/property/peaExpiry';

export function PeaLeaseNotice({ peaExpiry, propType, leaseStart }: {
  /** Η λήξη του ΠΕΑ του ακινήτου, όπως είναι στη βάση. */
  peaExpiry: string | null | undefined;
  /** Ο τύπος του ακινήτου: σε οικόπεδο, θέση στάθμευσης ή αποθήκη δεν φαίνεται. */
  propType: string | null | undefined;
  /** Η έναρξη της μίσθωσης. Χωρίς αυτή κρίνεται με τη σημερινή ημέρα. */
  leaseStart: string | null | undefined;
}) {
  const n = leasePeaNotice({ pea_expiry: peaExpiry, prop_type: propType }, leaseStart, athensToday());
  if (!n) return null;
  return (
    <InfoBanner tone="info">
      <strong style={{ color: 'var(--text-primary)' }}>{n.title}</strong>
      {' '}{n.body} {n.why} {n.action}
      {' '}Για αναφορά: <a href={PEA_REGISTRY_URL} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>{PEA_REGISTRY_LABEL}</a>.
    </InfoBanner>
  );
}
