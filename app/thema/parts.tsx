// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΚΟΙΝΑ ΚΟΜΜΑΤΙΑ ΤΩΝ ΚΟΜΒΩΝ ΘΕΜΑΤΟΣ ΚΑΙ ΤΗΣ ΜΕΘΟΔΟΛΟΓΙΑΣ (17/11/2026)
// ─────────────────────────────────────────────────────────────────────────
// Η ορατή διαδρομή, η γραμμή της υπογραφής και η ενότητα με εισαγωγή. Ίδια
// μεγέθη και αποστάσεις με τους δύο κόμβους (app/HubParts.tsx) και τους
// οδηγούς (`GuideUpdated`), ώστε οι νέες σελίδες να μη φαίνονται άλλο είδος.
// Server Components.
// ═══════════════════════════════════════════════════════════════════════════
import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import { T } from '@/components/tokens';
import { grDate } from '@/lib/core/format';
import { SectionHead, READING } from '../PublicChrome';

/** Η υπογραφή, η ίδια με των οδηγών και των υπολογιστών. Δεν λέει ότι έλεγξε δικηγόρος ή λογιστής. */
export const AUTHOR = 'Ομάδα Properwise';

const crumbLink = { color: 'var(--text-secondary)', textDecoration: 'none' } as const;

/**
 * Η ΟΡΑΤΗ ΔΙΑΔΡΟΜΗ: Αρχική › … › τρέχουσα. Η ίδια με το `BreadcrumbList` του
 * σχήματος. Στο κινητό τυλίγεται σε δεύτερη γραμμή αντί να κόβεται.
 */
export function Crumbs({ trail, current }: { trail: readonly { href: string; label: string }[]; current: string }) {
  const sep = <li aria-hidden="true" style={{ color: 'var(--text-tertiary)' }}>›</li>;
  return (
    <nav aria-label="Διαδρομή" style={{ marginBottom: T.sp.lg }}>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center',
        gap: T.sp.sm, fontSize: 13, color: 'var(--text-tertiary)' }}>
        <li><Link href="/" className="lp-link po-tap-inline" style={crumbLink}>Αρχική</Link></li>
        {trail.map(c => (
          <Fragment key={c.href}>
            {sep}
            <li><Link href={c.href} className="lp-link po-tap-inline" style={crumbLink}>{c.label}</Link></li>
          </Fragment>
        ))}
        {sep}
        <li aria-current="page" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{current}</li>
      </ol>
    </nav>
  );
}

/** «Κείμενο · Τελευταία ενημέρωση · άγκυρα», όπως η κεφαλίδα των οδηγών (ηη/μμ/εεεε). */
export function Byline({ updated, checked, anchor }: {
  updated: string;
  /** Ο παλαιότερος ανθρώπινος έλεγχος των ορίων που δείχνει η σελίδα· χωρίς αυτόν δεν γράφεται. */
  checked?: string | null;
  anchor?: { href: string; label: string };
}) {
  return (
    <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-tertiary)', margin: `0 0 ${T.sp.xl}px` }}>
      {`Κείμενο: ${AUTHOR}`}{' · '}
      <span style={{ whiteSpace: 'nowrap' }}>Τελευταία ενημέρωση: <time dateTime={updated}>{grDate(updated)}</time></span>
      {checked && <>
        {'\u00a0· '}
        <span style={{ whiteSpace: 'nowrap' }}>Έλεγχος ορίων: <time dateTime={checked}>{grDate(checked)}</time></span>
      </>}
      {anchor && <>
        {' · '}
        <a href={anchor.href} className="lp-link" style={{ color: 'var(--accent)', textDecoration: 'none', whiteSpace: 'nowrap' }}>{anchor.label}</a>
      </>}
    </p>
  );
}

/** Μια ενότητα με «πάνω», τίτλο H2 και εισαγωγή στο μέτρο ανάγνωσης, όπως το `HubSection`. */
export function Section({ id, over, title, lede, children }: {
  id: string; over: string; title: string; lede?: ReactNode; children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-h`} id={id} style={{ marginTop: 'clamp(40px,5vw,60px)', scrollMarginTop: 80 }}>
      <div id={`${id}-h`}><SectionHead over={over} title={title} /></div>
      {lede && (
        <p style={{ fontSize: 15, lineHeight: 1.65, color: 'var(--text-secondary)', margin: '-6px 0 clamp(18px,2.4vw,24px)', maxWidth: READING, textWrap: 'pretty' }}>
          {lede}
        </p>
      )}
      {children}
    </section>
  );
}
