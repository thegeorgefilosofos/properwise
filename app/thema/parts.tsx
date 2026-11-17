// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΚΟΙΝΑ ΚΟΜΜΑΤΙΑ ΤΩΝ ΚΟΜΒΩΝ ΘΕΜΑΤΟΣ ΚΑΙ ΤΗΣ ΜΕΘΟΔΟΛΟΓΙΑΣ (17/11/2026)
// ─────────────────────────────────────────────────────────────────────────
// Η ορατή διαδρομή, η γραμμή της υπογραφής, η ενότητα με εισαγωγή και η
// διάταξη σε δύο στήλες. Ίδια μεγέθη και αποστάσεις με τους δύο κόμβους
// (app/HubParts.tsx) και τους οδηγούς (`GuideUpdated`), ώστε οι νέες σελίδες
// να μη φαίνονται άλλο είδος. Server Components.
//
// ΤΟ ΠΛΑΤΟΣ ΔΟΥΛΕΥΕΙ (17/11/2026, απόφαση ιδιοκτήτη). Ως τότε όλο το
// περιεχόμενο καθόταν σε μία στήλη 720 αριστερά και τα 1440 είχαν τη δεξιά
// μισή οθόνη άδεια· η σελίδα ήταν διπλάσια σε μήκος. Τώρα η κορυφή είναι δύο
// στήλες (κείμενο αριστερά, σύνοψη και σύνδεσμοι δεξιά), οι κάρτες είναι
// πλέγμα τριών στηλών και οι ερωτήσεις δύο. Τα πλέγματα ζουν στο globals.css
// (`.th-*`).
// ═══════════════════════════════════════════════════════════════════════════
import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import { T } from '@/components/tokens';
import { grDate } from '@/lib/core/format';
import { bindRefs } from '@/lib/core/hyphenate';
import { refsOnly } from '@/components/Hyphen';
import { SectionHead, READING } from '../PublicChrome';
import { FaqPlus } from '../FaqPlus';
import { LINK_STYLE } from '../linkStyle';

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

/** Η απόσταση ανάμεσα στις ενότητες, η ίδια με το `HubSection` των δύο κόμβων. */
const SECTION_GAP = 'clamp(32px,4.4vw,48px)';

/** Μια ενότητα με «πάνω», τίτλο H2 και εισαγωγή στο μέτρο ανάγνωσης, όπως το `HubSection`. */
export function Section({ id, over, title, lede, children }: {
  id: string; over: string; title: string; lede?: ReactNode; children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-h`} id={id} style={{ marginTop: SECTION_GAP, scrollMarginTop: 80 }}>
      {/* `.th-head`: από τα 1024 ο τίτλος αριστερά και η εισαγωγή δεξιά, σε μία σειρά. */}
      <div className="th-head">
        <div id={`${id}-h`}><SectionHead over={over} title={title} /></div>
        {lede && (
          <p style={{ fontSize: 15, lineHeight: 1.65, color: 'var(--text-secondary)', maxWidth: READING, textWrap: 'pretty' }}>
            {lede}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

// ── Η ΚΟΡΥΦΗ ΣΕ ΔΥΟ ΣΤΗΛΕΣ ─────────────────────────────────────────────────────

/**
 * Κείμενο αριστερά, πλαϊνή στήλη δεξιά από τα 1024 και πάνω. Στο κινητό η
 * πλαϊνή πέφτει κάτω από το κείμενο, πριν από τις κάρτες: η σύνοψη διαβάζεται
 * αμέσως μετά τη σύντομη απάντηση.
 */
export function TwoCol({ main, aside, asideLabel }: { main: ReactNode; aside: ReactNode; asideLabel: string }) {
  return (
    <div className="th-hero">
      <div style={{ minWidth: 0 }}>{main}</div>
      <aside className="th-aside" aria-label={asideLabel}>{aside}</aside>
    </div>
  );
}

/** Ο τίτλος ενός κουτιού της πλαϊνής στήλης. */
function BoxTitle({ children }: { children: ReactNode }) {
  return <h2 style={{ margin: `0 0 ${T.sp.sm}px`, fontSize: 15, fontWeight: T.weight.bold, color: 'var(--text-primary)' }}>{children}</h2>;
}

/** Ένα ζεύγος της σύνοψης: τι μετριέται και η τιμή του, από τη μηχανή. */
export interface Fact { k: string; v: string }

/**
 * Η ΣΥΝΟΨΗ ΜΕ ΜΙΑ ΜΑΤΙΑ: οι αριθμοί του θέματος σε στήλη, ετικέτα αριστερά και
 * τιμή δεξιά. Κάθε τιμή έρχεται έτοιμη από τη σελίδα, που την παίρνει από τις
 * σταθερές της μηχανής· εδώ δεν γράφεται κανένας αριθμός.
 */
export function FactCard({ title, scale, facts, note }: {
  title: string;
  /** Μια κλίμακα σε μία σειρά κελιών: η τιμή μεγάλη, η ετικέτα από κάτω. */
  scale?: readonly Fact[];
  facts: readonly Fact[];
  note?: ReactNode;
}) {
  return (
    <section className="th-box th-box-accent" aria-label={title}>
      <BoxTitle>{title}</BoxTitle>
      {scale && (
        <dl className="th-scale">
          {scale.map(f => (
            <div key={f.k}>
              <dt>{f.k}</dt>
              <dd>{f.v}</dd>
            </div>
          ))}
        </dl>
      )}
      <dl className="th-facts">
        {facts.map(f => (
          <Fragment key={f.k}>
            <dt>{f.k}</dt>
            <dd>{f.v}</dd>
          </Fragment>
        ))}
      </dl>
      {note && <p style={{ margin: `${T.sp.sm}px 0 0`, fontSize: 13, lineHeight: 1.5, color: 'var(--text-tertiary)', textWrap: 'pretty' }}>{note}</p>}
    </section>
  );
}

/** Οι σύνδεσμοι της πλαϊνής στήλης: άλλα θέματα, οδηγοί, μεθοδολογία. */
export function LinkBox({ title, links }: { title: string; links: readonly { href: string; label: string }[] }) {
  return (
    <nav className="th-box" aria-label={title}>
      <BoxTitle>{title}</BoxTitle>
      <ul className="th-links">
        {links.map(l => (
          <li key={l.href}>
            <Link href={l.href} className="lp-link po-tap th-link">
              <span>{l.label}</span>
              <svg aria-hidden="true" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="m9 18 6-6-6-6" /></svg>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// ── ΟΙ ΚΑΡΤΕΣ ──────────────────────────────────────────────────────────────

/** Τα δύο εικονίδια των καρτών: βιβλίο για οδηγό, αριθμομηχανή για υπολογιστή. */
const ICON = {
  guide: 'M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
  tool: 'M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM8 6h8M16 14v4M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M8 18h.01M12 18h.01',
} as const;

export interface CardItem { href: string; title: string; desc: string; kind: keyof typeof ICON; cta: string }

/** Πόσες στήλες στον υπολογιστή: τρεις, εκτός από τέσσερις κάρτες (μία σειρά, όχι 3+1) ή λιγότερες από τρεις. */
const desktopCols = (n: number) => (n === 4 ? 4 : Math.min(n, 3));

/**
 * ΤΟ ΠΛΕΓΜΑ ΤΩΝ ΚΑΡΤΩΝ: οδηγοί και υπολογιστές μαζί, ο καθένας με το
 * εικονίδιο και την ενέργειά του. Τρεις στήλες στον υπολογιστή, δύο στην ταμπλέτα, μία
 * στο κινητό, ίσο ύψος σε κάθε σειρά. Εικονίδιο, τίτλος, περιγραφή σε δύο
 * γραμμές και η ενέργεια στη βάση. Στο κινητό η ενέργεια γίνεται βέλος δεξιά,
 * ώστε η κάρτα να πιάνει μισό ύψος. Ο τίτλος (H3) δίνει το όνομα του
 * συνδέσμου, όπως στο `HubCards`· η περιγραφή μένει ολόκληρη στη σελίδα.
 */
export function CardGrid({ items }: { items: readonly CardItem[] }) {
  return (
    <ul className="th-grid" data-n={desktopCols(items.length)}>
      {items.map(g => {
        const id = `kartela-${g.href.split('/').filter(Boolean).join('-')}`;
        return (
          <li key={g.href}>
            <Link href={g.href} aria-labelledby={id} className="og-card th-card lp-link">
              <svg className="th-card-icon" aria-hidden="true" width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                {ICON[g.kind].split('M').filter(Boolean).map((d, i) => <path key={i} d={'M' + d} />)}
              </svg>
              <h3 id={id} className="th-card-title">{g.title}</h3>
              <span className="th-card-desc">{bindRefs(g.desc)}</span>
              <span aria-hidden="true" className="th-card-cta">{g.cta}</span>
              <svg className="th-card-chev" aria-hidden="true" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// ── ΟΙ ΣΥΧΝΕΣ ΕΡΩΤΗΣΕΙΣ ─────────────────────────────────────────────────────

export interface FaqItem { q: string; a: string; link?: { href: string; label: string } }

/** Η γραμμή που ανοίγει: ίδια με των οδηγών (`GuideFaq`) και της αρχικής. */
const SUMMARY = {
  cursor: 'pointer', listStyle: 'none', padding: '16px 0', fontSize: 15, fontWeight: T.weight.emphasis,
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: T.sp.lg,
} as const;

/**
 * ΟΙ ΕΡΩΤΗΣΕΙΣ ΣΕ ΔΥΟ ΣΤΗΛΕΣ, ΚΛΕΙΣΤΕΣ ΕΚΤΟΣ ΑΠΟ ΤΗΝ ΠΡΩΤΗ. Το `details` είναι
 * προσβάσιμο χωρίς JavaScript και το κείμενο της απάντησης μένει στη σελίδα:
 * το `FAQPage` του σχήματος έχει ακριβώς αυτές τις ερωτήσεις.
 */
export function FaqGrid({ id, title, faq }: { id: string; title: string; faq: readonly FaqItem[] }) {
  return (
    <section aria-labelledby={`${id}-h`} id={id} style={{ marginTop: SECTION_GAP, scrollMarginTop: 80 }}>
      <div id={`${id}-h`}><SectionHead over="Συχνές ερωτήσεις" title={title} /></div>
      <div className="th-faq">
        {faq.map((f, i) => (
          <details key={f.q} className="lp-faq" open={i === 0}>
            <summary style={SUMMARY}>
              {f.q}
              <FaqPlus style={{ color: 'var(--accent)' }} />
            </summary>
            <p style={{ margin: '0 0 16px', fontSize: 15, lineHeight: 1.65, color: 'var(--text-secondary)' }}>{refsOnly(f.a)}</p>
            {f.link && (
              <p style={{ margin: '-4px 0 12px', fontSize: 14 }}>
                {/* `po-tap`: μόνος του σε γραμμή, 44 ύψος στην αφή (e2e:rendered). */}
                <Link href={f.link.href} className="lp-link po-tap" style={LINK_STYLE}>{f.link.label}</Link>
              </p>
            )}
          </details>
        ))}
      </div>
    </section>
  );
}

/** «6 κανόνες · όλοι με έλεγχο από άνθρωπο»: η γραμμή μιας ομάδας του μητρώου. */
export function rulesMeta(rows: readonly { checkedAt: string | null }[]): string {
  const n = rows.length;
  const checked = rows.filter(r => r.checkedAt).length;
  const all = n === 1 ? 'με έλεγχο από άνθρωπο' : 'όλοι με έλεγχο από άνθρωπο';
  const some = checked === 0 ? 'χωρίς ανθρώπινο έλεγχο' : `${checked} με έλεγχο από άνθρωπο`;
  return `${n} ${n === 1 ? 'κανόνας' : 'κανόνες'} · ${checked === n ? all : some}`;
}

/** Μια ομάδα που ανοίγει, με τίτλο και σύνοψη στη γραμμή της (το μητρώο της μεθοδολογίας). */
export function Fold({ title, meta, open, children }: { title: string; meta: string; open?: boolean; children: ReactNode }) {
  return (
    <details className="lp-faq" open={open}>
      <summary style={SUMMARY}>
        <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: T.sp.md, rowGap: 2 }}>
          <span>{title}</span>
          <span style={{ fontSize: 13, fontWeight: T.weight.body, color: 'var(--text-tertiary)' }}>{meta}</span>
        </span>
        <FaqPlus style={{ color: 'var(--accent)' }} />
      </summary>
      <div style={{ paddingBottom: T.sp.lg }}>{children}</div>
    </details>
  );
}
