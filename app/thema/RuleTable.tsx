// ═══════════════════════════════════════════════════════════════════════════
// Ο ΠΙΝΑΚΑΣ ΤΗΣ ΝΟΜΙΚΗΣ ΒΑΣΗΣ: ΚΑΝΟΝΑΣ, ΠΗΓΗ, ΕΛΕΓΧΟΣ (17/11/2026)
// ─────────────────────────────────────────────────────────────────────────
// Ίδιο σχήμα με τον πίνακα των προθεσμιών (app/prothesmies/MonthDeadlines.tsx):
// δύο στήλες που στοιβάζονται κάτω από τα 480 (`po-stack`), ο κανόνας με την
// πηγή του από κάτω και δεξιά η ημερομηνία. Τα στοιχεία από το μητρώο ισχύος
// (app/thema/rules.ts), τίποτα με το χέρι. Server Component.
// ═══════════════════════════════════════════════════════════════════════════
import { grDate } from '@/lib/core/format';
import type { RuleRow } from './rules';

/** Η στήλη της ημερομηνίας: ο ανθρώπινος έλεγχος ή, χωρίς αυτόν, η ανάγνωση εργαλείου ως τέτοια. */
function Checked({ r }: { r: RuleRow }) {
  if (r.checkedAt) return <time dateTime={r.checkedAt}>{grDate(r.checkedAt)}</time>;
  return <span style={{ color: 'var(--text-tertiary)' }}>Χωρίς ανθρώπινο έλεγχο</span>;
}

export function RuleTable({ caption, rows }: { caption: string; rows: readonly RuleRow[] }) {
  return (
    <div className="po-table-box gd-table">
      <div className="po-scroll-x" style={{ overflowX: 'auto' }}>
        <table className="po-table po-stack" style={{ ['--tbl-min' as string]: '420px' }}>
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">Κανόνας και πηγή</th>
              <th scope="col" className="num">Έλεγχος</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <th scope="row">
                  <span style={{ display: 'block', color: 'var(--text-primary)', fontWeight: 600, textWrap: 'pretty' }}>{r.label}</span>
                  <span style={{ display: 'block', marginTop: 2, fontSize: 12, color: 'var(--text-tertiary)' }}>
                    {'Πηγή: '}
                    <a href={r.href} target="_blank" rel="noopener noreferrer" className="lp-link po-tap-inline"
                      style={{ color: 'var(--accent)', textDecoration: 'none' }}>{r.source}</a>
                    {!r.checkedAt && r.toolReadAt && <>{' · ανάγνωση εργαλείου '}<time dateTime={r.toolReadAt}>{grDate(r.toolReadAt)}</time></>}
                  </span>
                </th>
                <td className="num gd-date po-stack-lead"><Checked r={r} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
