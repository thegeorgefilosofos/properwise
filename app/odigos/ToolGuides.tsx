// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΟΔΗΓΟΙ ΤΟΥ ΕΡΓΑΛΕΙΟΥ, ΣΤΟ ΤΕΛΟΣ ΤΗΣ ΣΕΛΙΔΑΣ ΤΟΥ
// ─────────────────────────────────────────────────────────────────────────
// Ο υπολογιστής απαντά «πόσο»· οι οδηγοί του απαντούν «γιατί» και «τι κάνω».
// Ως τις 05/10/2026 κάθε εργαλείο είχε γραμμένο με το χέρι έναν σύνδεσμο το
// πολύ και η καθαρή απόδοση και η σύγκριση ρεύματος κανέναν. Τώρα η λίστα
// βγαίνει από τον κατάλογο (`tools` κάθε οδηγού στο guides.ts): ένας νέος
// οδηγός εμφανίζεται μόνος του σε κάθε εργαλείο που δηλώνει.
// ═══════════════════════════════════════════════════════════════════════════
import Link from 'next/link';
import { SectionHead } from '../PublicChrome';
import { GUIDES, guidesForTool } from './guides';

export function ToolGuides({ tool }: { tool: string }) {
  const guides = guidesForTool(tool);
  if (!guides.length) throw new Error(`Το εργαλείο ${tool} δεν έχει οδηγό στον κατάλογο.`);
  return (
    <section className="po-tool-more" style={{ marginTop: 'clamp(40px,5vw,60px)' }}>
      <SectionHead over="Οδηγοί" title={guides.length === 1 ? 'Διάβασε για το θέμα' : `${guides.length} οδηγοί για το θέμα`} />
      <ul className="gd-related">
        {guides.map(g => (
          <li key={g.href}>
            <Link href={g.href} className="og-card gd-related-card">
              <span className="gd-related-k">{g.kicker}</span>
              <span className="gd-related-t">{g.title}</span>
              <span className="gd-related-d">{g.desc}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="lg-p" style={{ marginTop: 12 }}>
        <Link href="/odigos" className="lp-link po-tap" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>{`Όλοι οι οδηγοί (${GUIDES.length})`}</Link>
      </p>
    </section>
  );
}
