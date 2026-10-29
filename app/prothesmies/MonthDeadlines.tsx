// ═══════════════════════════════════════════════════════════════════════════
// Ο ΠΙΝΑΚΑΣ ΕΝΟΣ ΜΗΝΑ — κοινός για το /prothesmies και το /prothesmies/yyyy-mm
// ─────────────────────────────────────────────────────────────────────────
// Ημερομηνία, υποχρέωση, ποιον αφορά, πόσο σίγουρη είναι η ημερομηνία και η
// επίσημη πηγή της. Όλα από το lib/seo/prothesmies.ts, δηλαδή από το
// φορολογικό ημερολόγιο της εφαρμογής.
// ═══════════════════════════════════════════════════════════════════════════
import Link from 'next/link';
import { grDate } from '@/lib/core/format';
import { deadlinesOfMonth, monthLabel, monthPath, type MonthDeadline } from '@/lib/seo/prothesmies';

/** Δόση ΕΝΦΙΑ: εκεί ισχύει η σημείωση για τις λιγότερες δόσεις. */
export const isEnfiaInstalment = (d: MonthDeadline) => /^enfia-(first|instalment|last)$/.test(d.obligation.kind);

/** Οι προθεσμίες ενός μήνα ως πίνακας που στοιβάζεται κάτω από τα 480. */
export function MonthDeadlines({ month, heading = 'h2', linkTitle = false }: {
  month: string; heading?: 'h2' | 'h3'; linkTitle?: boolean;
}) {
  const rows = deadlinesOfMonth(month);
  const H = heading;
  const label = monthLabel(month);
  return (
    <section aria-labelledby={`m-${month}`} style={{ marginTop: 'clamp(28px,4vw,40px)' }}>
      <H id={`m-${month}`} style={{ fontSize: 'clamp(20px,2.4vw,24px)', fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 12px' }}>
        {linkTitle
          ? <Link href={monthPath(month)} className="lp-link" style={{ color: 'inherit', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', minHeight: 44 }}>{label}</Link>
          : label}
      </H>
      {rows.length === 0 ? (
        <p style={{ margin: 0, fontSize: 15, color: 'var(--text-secondary)' }}>Το ημερολόγιο δεν έχει προθεσμία ιδιοκτήτη αυτόν τον μήνα.</p>
      ) : (
        <div className="po-table-box gd-table">
          <div className="po-scroll-x" style={{ overflowX: 'auto' }}>
            <table className="po-table po-stack" style={{ ['--tbl-min' as string]: '420px' }}>
              <caption>{`Προθεσμίες ${label}`}</caption>
              <thead>
                <tr>
                  <th scope="col">Υποχρέωση</th>
                  <th scope="col" className="num">Ως</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(d => (
                  <tr key={d.obligation.id}>
                    <th scope="row">
                      <span style={{ display: 'block', color: 'var(--text-primary)', fontWeight: 600 }}>{d.obligation.title}</span>
                      <span style={{ display: 'block', marginTop: 2, fontSize: 12, color: 'var(--text-tertiary)' }}>
                        {d.shortTermOnly ? 'Μόνο για βραχυχρόνια μίσθωση' : 'Για κάθε ιδιοκτήτη'} · {d.confidenceLabel} ·{' '}
                        <a href={d.obligation.official_url} target="_blank" rel="noopener noreferrer" className="lp-link po-tap-inline"
                          style={{ color: 'var(--accent)', textDecoration: 'none' }}>Επίσημη πηγή</a>
                      </span>
                    </th>
                    <td className="num gd-date po-stack-lead">{grDate(d.obligation.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
