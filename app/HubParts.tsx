// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΚΟΙΝΑ ΚΟΜΜΑΤΙΑ ΤΩΝ ΔΥΟ ΚΟΜΒΩΝ: /odigos ΚΑΙ /ergaleia (27.10.2026)
// ─────────────────────────────────────────────────────────────────────────
// Ο κόμβος των εργαλείων γεννήθηκε με την ίδια σύνθεση με τον κόμβο των
// οδηγών: τίτλος, εισαγωγή, θέματα με πλήθος, παράγραφο και κάρτες. Γραμμένη
// δύο φορές, η κάρτα θα απέκλινε στην πρώτη διόρθωση (ύψος, επικεφαλίδα,
// όνομα συνδέσμου). Εδώ ζει μία φορά και οι δύο σελίδες δίνουν μόνο το
// περιεχόμενο. Server Components, καμία εξάρτηση από 'use client'.
// ═══════════════════════════════════════════════════════════════════════════
import Link from 'next/link';
import type { ReactNode } from 'react';
import { T } from '@/components/tokens';
import { SectionHead, READING } from './PublicChrome';

/** Μία κάρτα κόμβου: ετικέτα, τίτλος, περιγραφή και η ένδειξη της ενέργειας. */
export interface HubItem { href: string; kicker: string; title: string; desc: string }

/**
 * Ένα θέμα του κόμβου: πλήθος, τίτλος H2, εισαγωγή και οι κάρτες του.
 *
 * Η εισαγωγή ΟΧΙ ως `sub` του SectionHead: εκείνο περνά από το `hy()` και οι
 * κόμβοι δεν έχουν μαλακά ενωτικά (app/odigos/softHyphens.test.ts).
 */
export function HubSection({ id, over, title, lede, items, cta }: {
  id: string; over: string; title: string; lede?: ReactNode; items: readonly HubItem[]; cta: string;
}) {
  return (
    <section aria-labelledby={id} style={{ marginTop: 'clamp(32px,4.4vw,48px)' }}>
      <div id={id}>
        <SectionHead over={over} title={title} />
      </div>
      {lede && (
        <p className="po-just" style={{ fontSize: 15, lineHeight: 1.65, color: 'var(--text-secondary)', margin: '-6px 0 clamp(18px,2.4vw,24px)', maxWidth: READING }}>
          {lede}
        </p>
      )}
      <HubCards items={items} cta={cta} />
    </section>
  );
}

/**
 * ΟΙ ΚΑΡΤΕΣ ΕΝΟΣ ΘΕΜΑΤΟΣ.
 *
 * ΚΑΘΕ ΚΑΡΤΑ ΕΧΕΙ ΕΠΙΚΕΦΑΛΙΔΑ ΚΑΙ ΣΥΝΤΟΜΟ ΟΝΟΜΑ ΣΥΝΔΕΣΜΟΥ. Ο τίτλος ήταν
 * `<span>`, οπότε η σελίδα είχε μόνο το H1 στο διάγραμμα επικεφαλίδων και ο
 * σύνδεσμος που τύλιγε όλη την κάρτα ανακοινωνόταν με σαράντα λέξεις. Ο τίτλος
 * (H3, κάτω από το H2 του θέματος) δίνει το όνομα του συνδέσμου· η ενέργεια
 * είναι οπτική ένδειξη στη βάση της κάρτας, στο ίδιο ύψος σε όλη τη σειρά.
 *
 * ΜΟΝΟΣ ΑΡΙΘΜΟΣ ΚΑΡΤΩΝ ΣΕ ΔΥΟ ΣΤΗΛΕΣ ΑΦΗΝΕΙ ΤΗΝ ΤΕΛΕΥΤΑΙΑ ΜΟΝΗ ΤΗΣ, με μισή
 * σειρά άδεια. Τότε η πρώτη του θέματος γίνεται προβεβλημένη, σε όλο το πλάτος,
 * και οι υπόλοιπες κλείνουν σε γεμάτες σειρές.
 */
export function HubCards({ items, cta }: { items: readonly HubItem[]; cta: string }) {
  return (
    <div className="og-grid">
      {items.map((g, i) => {
        const id = `kartela-${g.href.split('/').filter(Boolean).join('-')}`;
        const featured = i === 0 && items.length % 2 === 1;
        return (
          <Link key={g.href} href={g.href} aria-labelledby={id} className={featured ? 'og-card og-featured lp-link' : 'og-card lp-link'}
            style={{ padding: featured ? '26px 26px 22px' : '22px 22px 20px', borderRadius: T.radius.modal,
              border: featured ? '1px solid color-mix(in srgb, var(--accent) 35%, transparent)' : '1px solid var(--border-subtle)',
              background: featured ? 'color-mix(in srgb, var(--accent) 6%, var(--bg-surface))' : 'var(--bg-surface)', textDecoration: 'none' }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent)' }}>{g.kicker}</span>
            <h3 id={id} style={{ margin: 0, fontSize: featured ? 22 : 18, fontWeight: T.weight.bold, letterSpacing: '-0.02em', color: 'var(--text-primary)', lineHeight: 1.25 }}>{g.title}</h3>
            <span style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--text-secondary)', textWrap: 'pretty' }}>{g.desc}</span>
            <span aria-hidden="true" style={{ marginTop: 'auto', paddingTop: 4, fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{cta}</span>
          </Link>
        );
      })}
    </div>
  );
}

/** Ο σύνδεσμος μέσα σε εισαγωγή κόμβου, ίδιος στους δύο. */
export function HubLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="lp-link" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>{children}</Link>;
}
