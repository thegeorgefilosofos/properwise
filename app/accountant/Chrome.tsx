'use client';
// ═══════════════════════════════════════════════════════════════════════════
// Η ΠΥΛΗ ΤΟΥ ΛΟΓΙΣΤΗ ΕΧΕΙ ΕΝΑ ΠΕΡΙΓΡΑΜΜΑ, ΟΧΙ ΔΥΟ
// ─────────────────────────────────────────────────────────────────────────
// ΔΥΟ ΟΘΟΝΕΣ, ΕΝΑΣ ΑΝΘΡΩΠΟΣ, ΔΥΟ ΣΧΕΔΙΑ. Η κατάσταση ενός πελάτη
// (/accountant/[token]) είχε μπάρα με σήμα και τίτλο, πλάτος 760 και επιλογέα
// που έγραφε σκέτο «2025». Ο χώρος με όλους τους πελάτες (/accountant/workspace)
// δεν είχε μπάρα καθόλου, είχε πλάτος 960 και ο ίδιος επιλογέας έγραφε
// «Χρήση 2025». Ο λογιστής πηγαίνει από τη μία στην άλλη με ένα κλικ και
// νομίζει ότι άλλαξε προϊόν.
//
// ΚΑΙ ΔΥΟ ΟΝΟΜΑΤΑ: «Πύλη λογιστή» εδώ, «Χώρος λογιστή» εκεί. Το προϊόν έχει
// ΕΝΑ όνομα για αυτόν τον χώρο και είναι «Πύλη λογιστή». Ο,τι αλλάζει από
// σελίδα σε σελίδα είναι ο τίτλος του εγγράφου, όχι το όνομα του σπιτιού.
// ═══════════════════════════════════════════════════════════════════════════
import type { ReactNode } from 'react';
import BrandMark from '@/components/BrandMark';
import { T, TT } from '@/components/Theme';
import { CustomSelect } from '@/app/dashboard/components/UIComponents';

/** Ενα πλάτος για τις δύο οθόνες του λογιστή. */
export const portalWrap: React.CSSProperties = {
  maxWidth: 880, margin: '0 auto', padding: '0 clamp(16px,5vw,24px)',
};

export const PORTAL_NAME = 'Πύλη λογιστή';

/** Πόσες χρήσεις πίσω προσφέρονται. Η φορολογική παραγραφή είναι πενταετής. */
const YEARS_BACK = 5;

export function portalYears(): number[] {
  const now = new Date().getFullYear();
  return Array.from({ length: YEARS_BACK }, (_, i) => now - i);
}

/**
 * Η μπάρα και των δύο οθόνων: σήμα, όνομα χώρου, επιλογή χρήσης.
 *
 * Ο ΕΠΙΛΟΓΕΑΣ ΛΕΕΙ «ΧΡΗΣΗ». Σκέτο «2025» δίπλα σε έγγραφο που έχει κι άλλες
 * χρονολογίες επάνω του (ημερομηνία έκδοσης, ημερομηνίες δαπανών) δεν λέει τι
 * αλλάζει αν το πειράξεις.
 */
export function PortalBar({ year, onYear, back }: {
  year?: number;
  onYear?: (y: number) => void;
  /** Πού γυρνά ο άνθρωπος από εδώ. Λείπει όταν δεν υπάρχει πουθενά να γυρίσει. */
  back?: { href: string; label: string };
}) {
  return (
    <header style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
      <div style={{ ...portalWrap, minHeight: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        {/* ΣΤΟ ΚΙΝΗΤΟ ΔΕΝ ΧΩΡΑΝΕ ΤΕΣΣΕΡΑ ΠΡΑΓΜΑΤΑ ΣΕ ΜΙΑ ΓΡΑΜΜΗ. Επιστροφή, σήμα,
            όνομα και επιλογέας έπεφταν το ένα πάνω στο άλλο στα 390: το όνομα
            κοβόταν κάτω από τον επιλογέα και ο επιλογέας έγραφε «Χρήση …».
            Κάτω από 560 μένει το βέλος της επιστροφής (με το όνομά του για τον
            αναγνώστη οθόνης) και το σήμα· ο επιλογέας κρατά ολόκληρο το πλάτος του. */}
        {/* ΤΟ ΒΕΛΟΣ ΜΟΝΟ ΤΟΥ ΕΙΝΑΙ ΤΕΤΡΑΓΩΝΟ 44 × 44 (08/11/2026): χωρίς το λεκτικό
            το γέμισμα 8/12 το άφηνε 37 φαρδύ και ζυγισμένο προς τα δεξιά. */}
        <style>{`@media (max-width:560px){.pb-label{display:none}.pb-back{padding:0!important}}`}</style>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: '1 1 auto', overflow: 'hidden' }}>
          {/* Η ΕΞΟΔΟΣ ΠΡΩΤΗ, ΑΡΙΣΤΕΡΑ ΤΟΥ ΣΗΜΑΤΟΣ. Η κατάσταση ενός πελάτη
              ανοίγει σε δική της διεύθυνση και δεν είχε ΚΑΜΙΑ επιστροφή: ο
              λογιστής που ερχόταν από τη λίστα των πελατών του έμενε εκεί, με
              μόνο δρόμο το βελάκι του περιηγητή ή έναν σύνδεσμο θαμμένο στο
              υποσέλιδο. Το ύψος είναι 44, όσο θέλει ένα δάχτυλο. */}
          {back && (
            <a href={back.href} aria-label={back.label} className="pb-back" style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: T.h.lg, minWidth: T.h.lg, padding: '0 12px 0 8px',
              marginLeft: -8, borderRadius: T.radius.btn, color: 'var(--text-secondary)', boxSizing: 'border-box',
              textDecoration: 'none', fontSize: 'var(--fs-base)', fontWeight: 600, fontFamily: T.font.sans, whiteSpace: 'nowrap',
            }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
              </svg>
              <span className="pb-label">{back.label}</span>
            </a>
          )}
          <BrandMark />
          <span className="pb-label" style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text-primary)', fontFamily: T.font.sans, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {PORTAL_NAME}
          </span>
        </div>
        {year !== undefined && onYear && (
          <div style={{ minWidth: 152, flex: '0 0 auto' }}>
            <CustomSelect ariaLabel="Χρήση" value={String(year)} onChange={v => onYear(parseInt(v, 10))}
              options={portalYears().map(y => ({ value: String(y), label: `Χρήση ${y}` }))} />
          </div>
        )}
      </div>
    </header>
  );
}

/**
 * Ο τίτλος του εγγράφου: πού είσαι, τι κοιτάς, από πότε ισχύει.
 *
 * ΕΝΑ ΣΧΗΜΑ ΣΕ ΚΑΘΕ ΟΨΗ ΤΗΣ ΠΥΛΗΣ (09/11/2026). Με `flex-wrap` και
 * `align-items: flex-end` το ίδιο component έβγαζε τρεις διατάξεις: στο γραφείο
 * το «Πρόσκληση μέλους» κρεμόταν δεξιά στο κέντρο όλου του μπλοκ, στη λίστα με
 * δύο κουμπιά κάθονταν δεξιά, με τέσσερα έπεφταν κάτω από το meta. Δηλαδή η
 * θέση των ενεργειών εξαρτιόταν από το πόσο μακρύ ήταν το κείμενο.
 *
 * ΤΩΡΑ: η υπερκείμενη γραμμή μόνη της, από κάτω πλέγμα δύο στηλών. Στον
 * υπολογιστή οι ενέργειες ξεκινούν στην ίδια ευθεία με την κορυφή του τίτλου
 * και το meta τυλίγει στον χώρο που μένει. Κάτω από 720 οι ενέργειες πέφτουν
 * ΠΑΝΤΑ κάτω από το meta, αριστερά.
 */
export function PortalTitle({ over, title, meta, right }: {
  over: string; title: string; meta?: ReactNode; right?: ReactNode;
}) {
  return (
    <div style={{ margin: `${T.sp.section}px 0 ${T.sp.xxl}px` }}>
      {/* ΟΙ ΕΝΕΡΓΕΙΕΣ ΚΛΕΙΝΟΥΝ ΤΗ ΓΡΑΜΜΗ ΤΟΥΣ ΣΤΟ ΤΗΛΕΦΩΝΟ. Κάθε κουμπί ξεκινά
          από το πλάτος του λεκτικού του και μεγαλώνει ώσπου η σειρά να γεμίσει·
          όποιο δεν χωρά, πέφτει ολόκληρο στην επόμενη. Οχι η `.act-row`: εκεί τα
          ίσα μερίδια στένευαν το «Κατέβασε τα βιβλία» κάτω από το λεκτικό του. */}
      <style>{`.pb-head{display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:${T.sp.xxl}px;row-gap:${T.sp.lg}px;align-items:start;margin-top:${T.sp.xs + 2}px}
.pb-acts{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:${T.sp.sm}px;max-width:min(560px,60vw)}
@media (max-width:720px){.pb-head{grid-template-columns:minmax(0,1fr)}.pb-acts{justify-content:flex-start;max-width:none}}
@media (max-width:560px){.pb-acts>*{flex:1 1 auto;white-space:nowrap}}`}</style>
      <p style={{ ...TT.label, color: 'var(--text-tertiary)', margin: 0 }}>
        {over}
      </p>
      <div className="pb-head">
        <div style={{ minWidth: 0 }}>
          <h1 style={{ ...TT.displaySm, margin: 0 }}>
            {title}
          </h1>
          {meta && (
            <p style={{ ...TT.bodySm, color: 'var(--text-tertiary)', margin: `${T.sp.sm}px 0 0`, fontVariantNumeric: 'tabular-nums' }}>
              {meta}
            </p>
          )}
        </div>
        {right && <div className="pb-acts po-noprint">{right}</div>}
      </div>
    </div>
  );
}

/**
 * Η ΑΔΕΙΑ ΚΑΤΑΣΤΑΣΗ ΤΗΣ ΠΥΛΗΣ, ΜΙΑ ΦΟΡΑ. Το «Ιστορικό πρόσβασης» έδειχνε τη
 * φράση του σε κάρτα ΧΩΡΙΣ γέμισμα (`padding: undefined` στο style έσβηνε το
 * εσωτερικό περιθώριο της `Card`): ένα λεπτό χάπι με το κείμενο κολλημένο στο
 * περίγραμμα. Η λίστα των πελατών είχε άλλη γραφή, με άλλο μέγεθος.
 */
export function PortalEmpty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div style={{
      padding: T.sp.lg, borderRadius: T.radius.card, background: 'var(--surface-raised)',
      border: '1px solid var(--border-raised)', boxShadow: 'var(--highlight-inset), var(--elev-1)',
    }}>
      <p style={{ ...TT.body, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{title}</p>
      {hint && <p style={{ ...TT.bodySm, color: 'var(--text-tertiary)', margin: `${T.sp.xs}px 0 0`, maxWidth: 560 }}>{hint}</p>}
      {action && <div style={{ marginTop: T.sp.md }}>{action}</div>}
    </div>
  );
}
