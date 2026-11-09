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
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { LogOut, Repeat, LayoutDashboard } from 'lucide-react';
import BrandMark from '@/components/BrandMark';
import { T, TT } from '@/components/Theme';
import { ActionMenu } from '@/components/ActionMenu';
import { notifyError } from '@/components/Toast';
import { CustomSelect } from '@/app/dashboard/components/UIComponents';
import { createClient } from '@/lib/supabase/client';
import { endSession, SIGN_OUT_FAILED } from '@/lib/auth/endSession';
import { hardNavigate } from '@/lib/core/navigate';

/** Ενα πλάτος για τις δύο οθόνες του λογιστή. */
export const portalWrap: React.CSSProperties = {
  maxWidth: 880, margin: '0 auto', padding: '0 clamp(16px,5vw,24px)',
};

export const PORTAL_NAME = 'Πύλη λογιστή';

/** Η αρχή της πύλης: η λίστα των πελατών. */
export const PORTAL_HOME = '/accountant/workspace';

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
export function PortalBar({ year, onYear, back, home = PORTAL_HOME, firmOnly }: {
  year?: number;
  onYear?: (y: number) => void;
  /** Πού γυρνά ο άνθρωπος από εδώ. Λείπει όταν δεν υπάρχει πουθενά να γυρίσει. */
  back?: { href: string; label: string };
  /** Πού οδηγεί το σήμα. Η λίστα των πελατών, εκτός αν ο θεατής είναι ο ιδιοκτήτης. */
  home?: string;
  /** Λογαριασμός μόνο για το γραφείο (my_firm.firmOnly): χωρίς πίνακα ιδιοκτήτη. */
  firmOnly?: boolean;
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
        <style>{`@media (max-width:560px){.pb-label{display:none}.pb-back{padding:0!important}}
@media (hover:hover){.pb-home:hover{background:var(--bg-hover)}}`}</style>
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
          {/* ΤΟ ΣΗΜΑ ΓΥΡΙΖΕΙ ΣΤΗΝ ΑΡΧΗ (09/11/2026). Ηταν εικόνα και λέξη χωρίς
              προορισμό· σε κάθε εφαρμογή το σήμα πάνω αριστερά είναι ο δρόμος για
              το σπίτι. Σύνδεσμος, όχι κουμπί: ανοίγει και σε νέα καρτέλα. */}
          <a href={home} aria-label={`${PORTAL_NAME}: αρχή`} className="pb-home" style={{
            display: 'inline-flex', alignItems: 'center', gap: T.sp.sm + 2, minWidth: 0, minHeight: T.h.lg,
            padding: `0 ${T.sp.sm}px`, margin: `0 -${T.sp.sm}px`, borderRadius: T.radius.btn, textDecoration: 'none', color: 'inherit',
          }}>
            <BrandMark />
            <span className="pb-label" style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text-primary)', fontFamily: T.font.sans, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {PORTAL_NAME}
            </span>
          </a>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: T.sp.sm, flex: '0 0 auto' }}>
          {year !== undefined && onYear && (
            <div style={{ minWidth: 152 }}>
              <CustomSelect ariaLabel="Χρήση" value={String(year)} onChange={v => onYear(parseInt(v, 10))}
                options={portalYears().map(y => ({ value: String(y), label: `Χρήση ${y}` }))} />
            </div>
          )}
          <AccountMenu firmOnly={firmOnly} />
        </div>
      </div>
    </header>
  );
}

/**
 * Ο ΛΟΓΑΡΙΑΣΜΟΣ, ΔΕΞΙΑ ΣΤΗΝ ΜΠΑΡΑ. Η πύλη δεν είχε καμία έξοδο: ο λογιστής που
 * ήθελε να μπει ως ιδιοκτήτης ή απλώς να φύγει δεν είχε πού να πατήσει.
 *
 * ΤΟ «ΠΙΝΑΚΑΣ ΙΔΙΟΚΤΗΤΗ» ΜΟΝΟ ΟΤΑΝ ΑΝΟΙΓΕΙ. Ο λογαριασμός γραφείου
 * (`account_kind: firm`) γυρίζει από το /dashboard πίσω εδώ (useDashboard)· το
 * μέλος «μόνο για το γραφείο» δεν έχει ακίνητα. Σε αυτούς ο σύνδεσμος θα ήταν
 * νεκρός, οπότε δεν υπάρχει.
 *
 * Χωρίς συνδεδεμένο χρήστη (π.χ. ιδιοκτήτης με σύνδεσμο) δεν αποδίδεται τίποτα.
 */
function AccountMenu({ firmOnly }: { firmOnly?: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [who, setWho] = useState<{ name: string | null; email: string; firm: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data, error }) => {
      if (!alive || error || !data.user) return;
      const m = (data.user.user_metadata ?? {}) as Record<string, unknown>;
      const name = [m.full_name, m.name].find(v => typeof v === 'string' && v.trim()) as string | undefined;
      setWho({ name: name?.trim() ?? null, email: data.user.email ?? '', firm: m.account_kind === 'firm' });
    });
    return () => { alive = false; };
  }, [supabase]);
  if (!who) return null;

  const leave = async (to: string) => {
    if (busy) return;
    setBusy(true);
    const ok = await endSession(supabase);
    setBusy(false);
    if (!ok) { notifyError(SIGN_OUT_FAILED, { duration: 0 }); return; }
    // Πλήρης φόρτωση: μετά την αποσύνδεση δεν μένει τίποτα ζωντανό στη μνήμη.
    hardNavigate(to);
  };
  const owner = !who.firm && !firmOnly;
  const initials = (who.name || who.email).split(/[\s@._-]+/).filter(Boolean).slice(0, who.name ? 2 : 1)
    .map(w => w[0]?.toLocaleUpperCase('el-GR')).join('');

  return (
    <ActionMenu iconOnly size="lg" label="Λογαριασμός" title="Λογαριασμός"
      glyph={<span aria-hidden="true" style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, letterSpacing: '0.02em', color: 'var(--text-primary)' }}>{initials || '?'}</span>}
      heading={<>
        {who.name && <span style={{ display: 'block', fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.35 }}>{who.name}</span>}
        <span style={{ display: 'block', fontSize: 'var(--fs-note)', color: 'var(--text-tertiary)', lineHeight: 1.35 }}>{who.email}</span>
      </>}
      items={[
        ...(owner ? [{ key: 'owner', label: 'Μετάβαση στον πίνακα ιδιοκτήτη', icon: <LayoutDashboard size={16} />, onClick: () => hardNavigate('/dashboard') }] : []),
        { key: 'switch', label: 'Σύνδεση με άλλο λογαριασμό', icon: <Repeat size={16} />, busy, busyLabel: 'Αποσύνδεση…', onClick: () => void leave('/login') },
        { key: 'out', label: 'Αποσύνδεση', icon: <LogOut size={16} />, busy, busyLabel: 'Αποσύνδεση…', onClick: () => void leave('/') },
      ]} />
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
 * και το meta τυλίγει στον χώρο που μένει. Κάτω από 960 οι ενέργειες πέφτουν
 * ΠΑΝΤΑ κάτω από το meta, αριστερά (στα 768 τα τέσσερα κουμπιά δεν χωρούσαν
 * δεξιά και το τέταρτο έπεφτε μόνο του σε δεύτερη σειρά).
 */
export function PortalTitle({ over, title, meta, right }: {
  over: string; title: string; meta?: ReactNode; right?: ReactNode;
}) {
  return (
    <div style={{ margin: `${T.sp.section}px 0 ${T.sp.xxl}px` }}>
      {/* ΟΙ ΕΝΕΡΓΕΙΕΣ ΚΛΕΙΝΟΥΝ ΤΗ ΓΡΑΜΜΗ ΤΟΥΣ ΣΤΟ ΤΗΛΕΦΩΝΟ. Κάθε κουμπί ξεκινά
          από το πλάτος του λεκτικού του και μεγαλώνει ώσπου η σειρά να γεμίσει·
          όποιο δεν χωρά, πέφτει ολόκληρο στην επόμενη. Στο τηλέφωνο πλέγμα με
          στήλες τουλάχιστον 140: τέσσερα κουμπιά γίνονται 2 × 2 ίσα, ένα πιάνει
          όλο το πλάτος (με «flex: auto» η δεύτερη σειρά είχε άλλα πλάτη).
          ΠΑΝΤΑ ΔΥΟ ΣΤΗΛΕΣ ΚΑΙ ΤΟ ΜΟΝΟ ΤΕΛΕΥΤΑΙΟ ΑΠΛΩΝΕΤΑΙ. Με «auto-fit» τρία
          κουμπιά έβγαιναν 2 + 1, με το τρίτο μόνο του και κενό δεξιά του
          (σαρωτής διάταξης, 375 έως 440). */}
      <style>{`.pb-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:${T.sp.xl}px;align-items:start;margin-top:${T.sp.xs + 2}px}
.pb-acts{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:${T.sp.sm}px;max-width:min(560px,60vw)}
@media (max-width:960px){.pb-head{grid-template-columns:minmax(0,1fr)}.pb-acts{justify-content:flex-start;max-width:none}}
@media (max-width:560px){.pb-acts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.pb-acts>*{white-space:nowrap}.pb-acts>:last-child:nth-child(odd){grid-column:1/-1}}`}</style>
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
