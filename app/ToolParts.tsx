'use client';
// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΚΟΜΜΑΤΙΑ ΤΩΝ ΤΕΣΣΑΡΩΝ ΔΗΜΟΣΙΩΝ ΥΠΟΛΟΓΙΣΤΩΝ, ΓΡΑΜΜΕΝΑ ΜΙΑ ΦΟΡΑ
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΒΡΕΘΗΚΕ. Κάθε υπολογιστής είχε δικό του πεδίο, δική του ετικέτα, δικό του
// μεγάλο νούμερο και δική του γραμμή ανάλυσης, αντιγραμμένα με μικροδιαφορές:
// πεδία 15 εικονοστοιχείων σε δύο σελίδες και 16 στις άλλες δύο (το iOS
// μεγεθύνει τη σελίδα σε κάθε εστίαση κάτω από τα 16), γέμισμα 12 ή 14, νούμερο
// βάρους 700 ή 680. Τέσσερις σελίδες που διαβάζονται ως ένα εργαλείο δεν
// επιτρέπεται να διαφέρουν σε τέτοια.
// ═══════════════════════════════════════════════════════════════════════════
import { useId, useState, type CSSProperties, type ReactNode } from 'react';
import { T } from '@/components/tokens';
import { ChipToggle } from '@/components/Theme';
import { fn, fmtFor } from '@/lib/core/format';
import { useLocale } from '@/lib/i18n/useLocale';
import { parseAmount } from '@/lib/core/greek';
// ΧΩΡΙΣ `CustomSelect` ΕΔΩ. Ο επιλογέας ζει στο app/ToolSelect.tsx: το
// UIComponents της εφαρμογής μπαίνει ολόκληρο στο πακέτο όποιου το εισάγει
// (ημερολόγιο, μαζικές ενέργειες, πεδία αριθμών), 7,2 KB gzip. Η καθαρή
// απόδοση και ο φόρος ενοικίων δεν έχουν κανέναν επιλογέα να το δικαιολογεί.

/** Η ετικέτα πεδίου: μικρά κεφαλαία, όπως σε όλες τις φόρμες του προϊόντος. */
export const TOOL_LABEL: CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
  textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 8,
};

/**
 * Το πεδίο. ΤΑ 16 ΕΙΚΟΝΟΣΤΟΙΧΕΙΑ ΔΕΝ ΕΙΝΑΙ ΓΟΥΣΤΟ: κάτω από αυτά το Safari του
 * iPhone μεγεθύνει τη σελίδα μόλις εστιάσει το πεδίο και στα 390 η διάταξη
 * γλιστρά πλάγια σε κάθε πάτημα.
 *
 * Χωρίς `outline: 'none'`: γραμμένο inline νικούσε το :focus-visible του
 * globals.css και ο χρήστης πληκτρολογίου δεν έβλεπε πού βρίσκεται.
 */
export const TOOL_FIELD: CSSProperties = {
  width: '100%', height: T.h.lg, padding: '0 14px', borderRadius: T.radius.btn,
  border: '1px solid var(--border-default)', background: 'var(--bg-surface)',
  color: 'var(--text-primary)', fontSize: 16, fontFamily: T.font.num,
  fontVariantNumeric: 'tabular-nums', boxSizing: 'border-box',
};

// Η ΜΟΝΑΔΑ ΣΕ ΔΙΚΟ ΤΗΣ ΚΟΥΤΙ, ΟΠΩΣ ΣΤΗΝ ΕΦΑΡΜΟΓΗ (02.11.2026). Ηταν γυμνό
// «€» μέσα στο πεδίο, ενώ ο πίνακας ελέγχου (NumberInput) τη βάζει σε κουτί με
// δεύτερη επιφάνεια και τρίχα αριστερά: ο ίδιος άνθρωπος έβλεπε δύο πεδία ποσού.
// Το κουτί κάθεται ΜΕΣΑ στο πεδίο, οπότε το δαχτυλίδι εστίασης του πεδίου τα
// περικλείει και τα δύο, όπως το περίβλημα της εφαρμογής.
const UNIT: CSSProperties = {
  position: 'absolute', top: 1, right: 1, bottom: 1,
  display: 'flex', alignItems: 'center', padding: '0 12px',
  background: 'var(--bg-elevated)', borderLeft: '1px solid var(--border-subtle)',
  borderRadius: `0 ${T.radius.btn - 1}px ${T.radius.btn - 1}px 0`,
  color: 'var(--text-secondary)', fontSize: 14, fontFamily: T.font.sans,
  whiteSpace: 'nowrap', pointerEvents: 'none',
};
/** Το κουτί της μονάδας πιάνει το γέμισμά του (2×12) πέρα από το κείμενο. */
const UNIT_BOX_EXTRA = 14;

/**
 * Το ποσό με διαχωριστικό χιλιάδων, για όσο το πεδίο δεν έχει εστίαση.
 *
 * Το «200000» διαβάζεται λάθος κατά ένα μηδενικό πιο εύκολα από το «200.000».
 * Η τιμή που κρατά η φόρμα (και η διεύθυνση) μένει όπως την έγραψε ο χρήστης·
 * αλλάζει μόνο αυτό που βλέπει. Κάτω από το χίλια δεν υπάρχει τίποτα να
 * ομαδοποιηθεί και ό,τι δεν διαβάζεται ως ποσό μένει ως έχει.
 */
// ΣΤΑ ΑΓΓΛΙΚΑ ΤΟ ΙΔΙΟ ΠΟΣΟ ΓΡΑΦΕΤΑΙ «200,000» (fmtFor('en')): η τελεία θα
// διαβαζόταν δεκαδικό. Το `parseAmount` διαβάζει και τις δύο γραφές.
function grouped(raw: string, num: (n: number, d?: number) => string = fn): string {
  const n = parseAmount(raw);
  if (n === null || Math.abs(n) < 1000) return raw;
  return num(n, Number.isInteger(n) ? 0 : 2);
}

/**
 * Αριθμητικό πεδίο με ετικέτα και μονάδα μέσα του.
 *
 * Όσο έχει εστίαση δείχνει ό,τι πληκτρολογείται, χωρίς διαχωριστικά: μια τελεία
 * που εμφανίζεται μόνη της κάτω από τον δρομέα μετακινεί τον δρομέα.
 */
export function ToolNumField({ id, label, value, onChange, unit, unitPad = 34, mode = 'decimal', hint, span }: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  unit?: string; unitPad?: number; mode?: 'decimal' | 'numeric';
  /** Η βοήθεια του πεδίου, ΠΑΝΤΑ κάτω από το κουτί του (`ToolHint`). */
  hint?: ReactNode;
  /** Πόσες στήλες του `ToolFields` πιάνει: 1 (προεπιλογή), 2 ή όλη τη σειρά. */
  span?: ToolSpan;
}) {
  // ΟΣΟ ΓΡΑΦΕΙΣ, ΤΟ ΠΕΔΙΟ ΚΡΑΤΑ ΟΤΙ ΒΛΕΠΕΙΣ. Ηταν «1.400» εκτός εστίασης και
  // «1400» μέσα, δηλαδή με την εστίαση άλλαζε το κείμενο και ο περιηγητής έριχνε
  // την επιλογή. Οποιος έφτανε με Tab (που επιλέγει όλο το πεδίο) κι έγραφε
  // «3200» έπαιρνε «14003200»: ΕΝΦΙΑ χιλιάδων ευρώ. Τώρα η εστίαση δεν αλλάζει
  // ούτε χαρακτήρα και ο γονέας διαβάζει το κείμενο με το parseAmount, που
  // καταλαβαίνει τα ελληνικά χιλιάδες («1.400» = 1400).
  const [draft, setDraft] = useState<string | null>(null);
  const num = fmtFor(useLocale()).fn;
  const described = [unit && `${id}-unit`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={spanClass(span)}>
      <label htmlFor={id} style={TOOL_LABEL}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input id={id} inputMode={mode} value={draft ?? grouped(value, num)}
          onFocus={() => setDraft(grouped(value, num))}
          onChange={e => { setDraft(e.target.value); onChange(e.target.value); }}
          onBlur={() => setDraft(null)}
          style={{ ...TOOL_FIELD, paddingRight: unit ? unitPad + UNIT_BOX_EXTRA : 14 }}
          aria-describedby={described}/>
        {unit && <span id={`${id}-unit`} aria-hidden style={UNIT}>{unit}</span>}
      </div>
      {hint && <ToolHint id={`${id}-hint`}>{hint}</ToolHint>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ΕΝΑ ΠΛΕΓΜΑ ΠΕΔΙΩΝ ΓΙΑ ΤΟΥΣ ΤΕΣΣΕΡΙΣ, ΜΕ ΚΑΝΟΝΕΣ ΕΚΤΑΣΗΣ
// ─────────────────────────────────────────────────────────────────────────
// Κάθε υπολογιστής έστηνε το δικό του: δύο στήλες στον φόρο ενοικίων (πεδία
// των 515 για ένα «600» και ένα «12»), τρεις στην απόδοση, τέσσερις στη
// βραχυχρόνια, πέντε με έξι λωρίδες στον ΕΝΦΙΑ (3+2 στα 768, με τις κάτω
// στήλες να μην πέφτουν κάτω από τις πάνω). Τώρα όλοι μοιράζουν το ΙΔΙΟ
// πλέγμα: τέσσερις στήλες στον υπολογιστή, δύο στην ταμπλέτα, μία στο
// τηλέφωνο (δύο με `xs2`, για σειρές μικρών αριθμών). Ενα πεδίο που θέλει
// χώρο το ζητά με `span`· όλα τα κουτιά της σελίδας έχουν τις ίδιες
// αφετηρίες και τα ίδια πλάτη από υπολογιστή σε υπολογιστή.
// Η στοίχιση είναι στην ΑΡΧΗ: η βοήθεια ζει κάτω από κάθε πεδίο, οπότε το
// κάτω άκρο δεν είναι το κουτί. Οι ετικέτες κρατιούνται σε μία γραμμή.
// ═══════════════════════════════════════════════════════════════════════════
export type ToolSpan = 1 | 2 | 'row';
export const spanClass = (span?: ToolSpan) =>
  span === 2 ? 'po-tf-span2' : span === 'row' ? 'po-tf-row' : undefined;

export function ToolFields({ children, xs2, className }: { children: ReactNode; xs2?: boolean; className?: string }) {
  const cls = ['po-tool-fields', 'po-tool-controls', xs2 && 'po-tf-xs2', className].filter(Boolean).join(' ');
  return <div className={cls}>{children}</div>;
}

/** Η βοήθεια κάτω από ένα πεδίο: ίδιο μέγεθος, ίδιο χρώμα, ίδια απόσταση παντού. */
export function ToolHint({ id, children, span, flush }: {
  id?: string; children: ReactNode; span?: ToolSpan;
  /** Κελί του πλέγματος από μόνο του: ξεκινά στο ύψος των ετικετών, όχι 8 πιο κάτω. */
  flush?: boolean;
}) {
  return (
    // 1,65 και όχι 1,55: στα 768 ένα κελί δύο στηλών βγάζει γραμμές 96 χαρακτήρων
    // (σαρωτής διάταξης, /vraxyxronia-i-makroxronia) και θέλουν τον αέρα του. Ηταν
    // 1,6 ακριβώς στο όριο: με 14 στο δάχτυλο τα 22,4 εικονοστοιχεία διαιρούνται
    // σε 1,5999 και ο σαρωτής το έκρινε στριμωγμένο (12/10/2026).
    // 14 ΣΤΟ ΤΗΛΕΦΩΝΟ, 13 ΣΤΟ ΠΟΝΤΙΚΙ (ζήτημα 290, 12/10/2026). Ηταν 13 παντού: στα 390
    // οι υποδείξεις, οι σημειώσεις «τι υποθέτει» και οι πηγές έπεφταν από 12 ως
    // 13, κάτω από το σώμα των 14. Το `--fs-base` δίνει 14 στο δάχτυλο και κρατά
    // την πυκνότητα του υπολογιστή (globals.css, «ΓΙΑΤΙ ΜΟΝΟ ΣΤΟ ΔΑΧΤΥΛΟ»).
    <p id={id} className={spanClass(span)} style={{ margin: flush ? 0 : '8px 0 0', fontSize: 'var(--fs-base)', lineHeight: 1.65,
      color: 'var(--text-tertiary)', textWrap: 'pretty' }}>{children}</p>
  );
}

/**
 * ΕΝΑΣ ΕΠΙΛΟΓΕΑΣ ΔΥΟ ΕΠΙΛΟΓΩΝ, ΜΕ ΜΙΑ ΠΡΟΔΙΑΓΡΑΦΗ.
 *
 * Το «Πότε γεμίζει» ήταν κουτί με εξήγηση αριστερά και ράγα δεξιά, το
 * «Εισόδημα ποιας χρονιάς» ετικέτα με ράγα σε όλο το πλάτος και δεύτερη σειρά
 * μέσα σε κάθε κουμπί: δύο ύψη, δύο διατάξεις για το ίδιο στοιχείο. Και το
 * επιλεγμένο τμήμα ξεχώριζε από τη ράγα μόνο με μια σκιά, που στο ναυτικό
 * φόντο δεν φαίνεται. Τώρα και τα δύο είναι πεδίο του πλέγματος: ετικέτα από
 * πάνω, ράγα στο ύψος των πεδίων, βοήθεια από κάτω. Το επιλεγμένο τμήμα
 * γεμιζόταν με το χρώμα έμφασης· από 02.11.2026 έχει την όψη του τμηματικού
 * επιλογέα της εφαρμογής (επιφάνεια, σκιά, γράμματα έμφασης), βλ. παρακάτω.
 */
export function ToolSeg<V extends string>({ label, value, onChange, options, hint, span = 2 }: {
  label: string; value: V; onChange: (v: V) => void;
  options: readonly { value: V; label: string }[];
  hint?: ReactNode; span?: ToolSpan;
}) {
  const id = useId();
  return (
    <div className={spanClass(span)} role="group" aria-labelledby={`${id}-l`}
      aria-describedby={hint ? `${id}-h` : undefined}>
      <span id={`${id}-l`} style={TOOL_LABEL}>{label}</span>
      {/* Η ΡΑΓΑ ΤΗΣ ΕΦΑΡΜΟΓΗΣ, ΟΧΙ ΓΕΜΑΤΟ ΧΑΠΙ (02.11.2026). Η κλάση
          `.po-tool-seg` γέμιζε το επιλεγμένο τμήμα με το χρώμα έμφασης, ενώ σε
          κάθε τμηματικό επιλογέα του πίνακα ελέγχου (LeaseModal, Αναπροσαρμογή)
          το ενεργό ανασηκώνεται με επιφάνεια, σκιά και γράμματα έμφασης
          (`.po-chip[data-shape="seg"]`). Ιδια ράγα εδώ: ύψος των πεδίων
          (3 γέμισμα + 1 περίγραμμα γύρω από το πλακίδιο) και το περίγραμμά τους. */}
      <div style={{
        display: 'flex', gap: 4, padding: 3, background: 'var(--bg-base)',
        border: '1px solid var(--border-default)', borderRadius: T.radius.btn,
      }}>
        {options.map(o => (
          <ChipToggle key={o.value} shape="seg" grow on={value === o.value} onClick={() => onChange(o.value)}>
            {o.label}
          </ChipToggle>
        ))}
      </div>
      {hint && <ToolHint id={`${id}-h`}>{hint}</ToolHint>}
    </div>
  );
}

/**
 * Το μεγάλο νούμερο με την ετικέτα του. ΧΩΡΙΣ ΠΑΡΑΜΕΤΡΟ ΧΡΩΜΑΤΟΣ: η έμφαση
 * δίνεται με μέγεθος και σειρά, που δουλεύουν και σε ασπρόμαυρη εκτύπωση και σε
 * κάθε μορφή αχρωματοψίας. Ο φόρος δεν είναι σφάλμα, είναι υποχρέωση.
 */
function ToolFigure({ label, value, variant = 'primary' }: {
  label: string; value: string;
  /**
   * ΕΝΑ ΝΟΥΜΕΡΟ ΟΔΗΓΕΙ. Δύο ισομεγέθη νούμερα δίπλα δίπλα άφηναν τον
   * επισκέπτη να διαλέξει μόνος του ποιο απαντά στην ερώτηση της σελίδας. Το
   * `primary` είναι η απάντηση· το `secondary` το πλαίσιό της.
   */
  variant?: 'primary' | 'secondary';
}) {
  const primary = variant === 'primary';
  return (
    <div className={primary ? 'po-tool-fig-primary' : undefined}>
      <div style={{ ...TOOL_LABEL, display: 'block' }}>{label}</div>
      <div className="po-fig" style={{
        fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1,
        fontSize: primary ? 'clamp(34px, 6vw, 44px)' : 'clamp(20px, 3vw, 24px)',
        fontWeight: primary ? 700 : 600, letterSpacing: primary ? '-0.035em' : '-0.02em',
        color: primary ? 'var(--text-primary)' : 'var(--text-secondary)',
      }}>{value}</div>
    </div>
  );
}

/**
 * Η ΚΟΡΥΦΗ ΤΗΣ ΚΑΡΤΑΣ: το νούμερο που απαντά και ως δύο που το πλαισιώνουν.
 *
 * ΣΤΟ ΙΔΙΟ ΠΛΕΓΜΑ ΜΕ ΤΑ `ToolStats`. Οι μεγάλοι αριθμοί κάθονταν σε δύο μισά
 * και τα στατιστικά από κάτω σε τρία τρίτα: καμία κάθετη της κάρτας δεν
 * συνέχιζε. Τώρα και τα δύο μοιράζονται τις ίδιες τρεις στήλες (`.po-tool-grid3`).
 * Ο κύριος αριθμός πιάνει την πρώτη και οι δευτερεύοντες κάθονται στη βάση
 * του, στις άλλες δύο. Στο τηλέφωνο ο κύριος παίρνει όλη τη σειρά.
 */
export function ToolHero({ primary, secondary = [] }: {
  primary: { label: string; value: string };
  secondary?: readonly { label: string; value: string }[];
}) {
  // ΜΑΚΡΥΣ ΑΡΙΘΜΟΣ, ΔΙΚΗ ΤΟΥ ΣΕΙΡΑ. Στο ένα τρίτο της κάρτας χωρούν ως δέκα
  // χαρακτήρες στα 44px· το «1.202.125,00€» του στεγαστικού δεν χωρά ποτέ.
  const wide = primary.value.length > 10;
  return (
    <div className={`po-tool-grid3 po-tool-hero${wide ? ' po-tool-hero-wide' : ''}`}>
      <ToolFigure {...primary}/>
      {secondary.map(s => <ToolFigure key={s.label} {...s} variant="secondary"/>)}
    </div>
  );
}

/** Μία γραμμή της ανάλυσης. `param` για συντελεστή, `total` για το σύνολο. */
export interface LedgerRow { k: ReactNode; v: string; kind?: 'param' | 'total'; sub?: ReactNode }

/**
 * ΜΙΑ ΣΤΗΛΗ, ΜΕ ΤΗ ΣΕΙΡΑ ΤΟΥ ΥΠΟΛΟΓΙΣΜΟΥ ΚΑΙ ΚΛΕΙΝΕΙ ΜΕ ΣΥΝΟΛΟ.
 *
 * Η ανάλυση ήταν πλέγμα δύο στηλών: διαβαζόταν ζιγκ-ζαγκ («Ετήσιο ενοίκιο |
 * Τεκμαρτή έκπτωση / Φορολογητέο | Καθαρά ανά μήνα») και καμία γραμμή δεν
 * έλεγε «άρα». Εδώ η αριθμητική τρέχει προς τα κάτω, όπως σε απόδειξη· η
 * τελευταία γραμμή είναι το αποτέλεσμα, με γραμμή από πάνω της.
 *
 * ΟΛΟ ΤΟ ΠΛΑΤΟΣ, ΜΕ ΟΔΗΓΟ ΑΠΟ ΤΗΝ ΕΤΙΚΕΤΑ ΣΤΟ ΠΟΣΟ. Ηταν κλεισμένη στα 520,
 * για να μη χάνεται το ποσό μακριά από την ετικέτα του: σε κάρτα 1.000 όμως
 * άφηνε το δεξί μισό άδειο, κάτω από το «Ανά μήνα». Τώρα κλείνει στην άκρη της
 * κάρτας, όπως κάθε άλλο στοιχείο της. Μια αχνή διάστικτη γραμμή δένει
 * ετικέτα και ποσό, όπως στην εκκαθάριση και στην απόδειξη.
 */
// ΤΟ ΣΧΟΛΙΟ ΕΣΠΑΓΕ ΤΟΝ ΟΔΗΓΟ. Η υποσημείωση ζούσε μέσα στο `<dt>` της σειράς
// flex, οπότε η ετικέτα έπιανε όσο πλάτος ζητούσε η πρόταση από κάτω της: στον
// «Φόρο εισοδήματος» του φόρου ενοικίων η διάστικτη γραμμή στένευε σε μια
// κουκκίδα και το ποσό κολλούσε δεξιά χωρίς τίποτα να το δένει με την ετικέτα.
// Τώρα η σειρά είναι πλέγμα τριών στηλών (ετικέτα, οδηγός, ποσό) και η
// υποσημείωση πιάνει ολόκληρη τη δεύτερη σειρά του, κάτω από όλα.
export function ToolLedger({ rows }: { rows: readonly (LedgerRow | false | null | undefined)[] }) {
  return (
    <dl style={{ margin: 0, display: 'grid', rowGap: 10 }}>
      {rows.filter((r): r is LedgerRow => !!r).map((r, i) => {
        const total = r.kind === 'total', param = r.kind === 'param';
        return (
          <div key={i} className="po-ledger-row" style={total
            ? { borderTop: '1px solid var(--border-default)', paddingTop: 10, marginTop: 2 } : undefined}>
            <dt style={{ fontSize: total ? 14 : 13, fontWeight: total ? 600 : 400,
              color: total ? 'var(--text-primary)' : param ? 'var(--text-tertiary)' : 'var(--text-secondary)' }}>
              {r.k}
            </dt>
            <span aria-hidden="true" className={total ? 'po-ledger-lead po-ledger-lead-none' : 'po-ledger-lead'} />
            <dd style={{ margin: 0, whiteSpace: 'nowrap', fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums',
              fontSize: total ? 16 : param ? 13 : 14, fontWeight: total ? 700 : param ? 500 : 600,
              color: param ? 'var(--text-secondary)' : 'var(--text-primary)' }}>{r.v}</dd>
            {r.sub && <dd className="po-ledger-sub" style={{ margin: '2px 0 0', fontSize: 12, lineHeight: 1.5,
              color: 'var(--text-tertiary)', textWrap: 'pretty' }}>{r.sub}</dd>}
          </div>
        );
      })}
    </dl>
  );
}

/**
 * Τα δευτερεύοντα νούμερα κάτω από την ανάλυση (ανά μήνα, οριακός συντελεστής):
 * δεν είναι βήματα της αφαίρεσης, οπότε δεν μπαίνουν μέσα της.
 */
export function ToolStats({ items }: { items: readonly { k: string; v: string }[] }) {
  // Στο ίδιο πλέγμα τριών στηλών με την κορυφή της κάρτας (`ToolHero`), ώστε οι
  // κάθετες να συνεχίζουν από τα μεγάλα νούμερα στα μικρά.
  return (
    <dl className="po-tool-grid3 po-tool-stats" style={{ margin: `${T.sp.lg}px 0 0`, paddingTop: 14,
      borderTop: '1px solid var(--border-subtle)' }}>
      {items.map(s => (
        <div key={s.k}>
          <dt style={{ ...TOOL_LABEL, marginBottom: 4 }}>{s.k}</dt>
          <dd style={{ margin: 0, fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums',
            fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{s.v}</dd>
        </div>
      ))}
    </dl>
  );
}
