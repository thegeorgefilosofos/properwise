// ═══════════════════════════════════════════════════════════════════════════
// Η ΝΟΜΙΚΗ ΒΑΣΗ: ΚΑΝΟΝΑΣ, ΠΗΓΗ, ΕΛΕΓΧΟΣ (17/11/2026)
// ─────────────────────────────────────────────────────────────────────────
// Ο κανόνας με την πηγή του από κάτω και δεξιά η ημέρα του ελέγχου. Ήταν
// πίνακας μιας στήλης στα 720, με κάθε κανόνα σε τρεις γραμμές: έξι κανόνες
// έπιαναν μισή οθόνη ύψος. Τώρα λίστα σε δύο στήλες από τα 720 (`.th-rules`),
// μία στο κινητό. Τα στοιχεία από το μητρώο ισχύος (app/thema/rules.ts),
// τίποτα με το χέρι. Server Component.
// ═══════════════════════════════════════════════════════════════════════════
import { grDate } from '@/lib/core/format';
import type { RuleRow } from './rules';

/** Η ημερομηνία: ο ανθρώπινος έλεγχος ή, χωρίς αυτόν, η ανάγνωση εργαλείου ως τέτοια. */
function Checked({ r }: { r: RuleRow }) {
  if (r.checkedAt) return <>Έλεγχος <time dateTime={r.checkedAt}>{grDate(r.checkedAt)}</time></>;
  return <span>Χωρίς ανθρώπινο έλεγχο</span>;
}

export function RuleList({ label, rows }: { label: string; rows: readonly RuleRow[] }) {
  return (
    <ul className="th-rules" aria-label={label}>
      {rows.map(r => (
        <li key={r.id}>
          <span style={{ display: 'block', fontSize: 14, lineHeight: 1.4, color: 'var(--text-primary)', fontWeight: 600, textWrap: 'pretty' }}>{r.label}</span>
          <span style={{ display: 'block', marginTop: 4, fontSize: 13, lineHeight: 1.5, color: 'var(--text-tertiary)' }}>
            <a href={r.href} target="_blank" rel="noopener noreferrer" className="lp-link po-tap-inline"
              style={{ color: 'var(--accent)', textDecoration: 'none' }}>{r.source}</a>
            {' · '}
            <span style={{ whiteSpace: 'nowrap' }}><Checked r={r} /></span>
            {!r.checkedAt && r.toolReadAt && <>{' · ανάγνωση εργαλείου '}<time dateTime={r.toolReadAt}>{grDate(r.toolReadAt)}</time></>}
          </span>
        </li>
      ))}
    </ul>
  );
}
