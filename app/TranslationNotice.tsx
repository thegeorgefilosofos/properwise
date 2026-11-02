import { LEGAL_UI_EN } from '@/lib/i18n/en/legal/ui';
import { LocaleLink } from './LangSwitcher';

// ═══════════════════════════════════════════════════════════════════════════
// Η ΣΗΜΕΙΩΣΗ ΣΤΗΝ ΚΟΡΥΦΗ ΚΑΘΕ ΑΓΓΛΙΚΗΣ ΝΟΜΙΚΗΣ ΣΕΛΙΔΑΣ
// ─────────────────────────────────────────────────────────────────────────
// Η αγγλική εκδοχή είναι μετάφραση για διευκόλυνση· δεσμευτικό είναι το
// ελληνικό κείμενο. Το λέμε πριν από τον τίτλο, με σύνδεσμο στο πρωτότυπο.
// ═══════════════════════════════════════════════════════════════════════════
export function TranslationNotice({ greekHref }: { greekHref: string }) {
  return (
    <p role="note" className="lg-translation" style={{
      margin: '0 0 18px', padding: '10px 14px', borderRadius: 10, fontSize: 14, lineHeight: 1.55,
      color: 'var(--text-secondary)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
    }}>
      {LEGAL_UI_EN.notice}{' '}
      <LocaleLink to="el" href={greekHref} className="lp-link po-tap-inline">
        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{LEGAL_UI_EN.greekLink}</span>
      </LocaleLink>
    </p>
  );
}
