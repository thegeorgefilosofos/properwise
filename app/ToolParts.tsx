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
import { useState, type CSSProperties, type ReactNode } from 'react';
import { T, fixedCols } from '@/components/tokens';
import { fn } from '@/lib/core/format';
import { parseAmount } from '@/lib/core/greek';
import { CustomSelect } from '@/app/dashboard/components/UIComponents';

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

const UNIT: CSSProperties = {
  position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
  color: 'var(--text-tertiary)', fontSize: 15, pointerEvents: 'none',
};

/**
 * Το ποσό με διαχωριστικό χιλιάδων, για όσο το πεδίο δεν έχει εστίαση.
 *
 * Το «200000» διαβάζεται λάθος κατά ένα μηδενικό πιο εύκολα από το «200.000».
 * Η τιμή που κρατά η φόρμα (και η διεύθυνση) μένει όπως την έγραψε ο χρήστης·
 * αλλάζει μόνο αυτό που βλέπει. Κάτω από το χίλια δεν υπάρχει τίποτα να
 * ομαδοποιηθεί και ό,τι δεν διαβάζεται ως ποσό μένει ως έχει.
 */
function grouped(raw: string): string {
  const n = parseAmount(raw);
  if (n === null || Math.abs(n) < 1000) return raw;
  return fn(n, Number.isInteger(n) ? 0 : 2);
}

/**
 * Αριθμητικό πεδίο με ετικέτα και μονάδα μέσα του.
 *
 * Όσο έχει εστίαση δείχνει ό,τι πληκτρολογείται, χωρίς διαχωριστικά: μια τελεία
 * που εμφανίζεται μόνη της κάτω από τον δρομέα μετακινεί τον δρομέα.
 */
export function ToolNumField({ id, label, value, onChange, unit, unitPad = 34, mode = 'decimal' }: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  unit?: string; unitPad?: number; mode?: 'decimal' | 'numeric';
}) {
  // ΟΣΟ ΓΡΑΦΕΙΣ, ΤΟ ΠΕΔΙΟ ΚΡΑΤΑ ΟΤΙ ΒΛΕΠΕΙΣ. Ηταν «1.400» εκτός εστίασης και
  // «1400» μέσα, δηλαδή με την εστίαση άλλαζε το κείμενο και ο περιηγητής έριχνε
  // την επιλογή. Οποιος έφτανε με Tab (που επιλέγει όλο το πεδίο) κι έγραφε
  // «3200» έπαιρνε «14003200»: ΕΝΦΙΑ χιλιάδων ευρώ. Τώρα η εστίαση δεν αλλάζει
  // ούτε χαρακτήρα και ο γονέας διαβάζει το κείμενο με το parseAmount, που
  // καταλαβαίνει τα ελληνικά χιλιάδες («1.400» = 1400).
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div>
      <label htmlFor={id} style={TOOL_LABEL}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input id={id} inputMode={mode} value={draft ?? grouped(value)}
          onFocus={() => setDraft(grouped(value))}
          onChange={e => { setDraft(e.target.value); onChange(e.target.value); }}
          onBlur={() => setDraft(null)}
          style={{ ...TOOL_FIELD, paddingRight: unit ? unitPad : 14 }}
          aria-describedby={unit ? `${id}-unit` : undefined}/>
        {unit && <span id={`${id}-unit`} aria-hidden style={UNIT}>{unit}</span>}
      </div>
    </div>
  );
}

/**
 * Επιλογέας με την ετικέτα των πεδίων από πάνω του.
 *
 * Η ΕΤΙΚΕΤΑ ΤΗΝ ΓΡΑΦΕΙ Η ΣΕΛΙΔΑ, ΟΧΙ ΤΟ ΧΕΙΡΙΣΤΗΡΙΟ. Το `CustomSelect` φέρνει
 * τη δική του ετικέτα, με το στιλ των φορμών της εφαρμογής: πεζά, μεγαλύτερα,
 * άλλο βάρος. Δίπλα στα πεδία κειμένου, που έχουν κεφαλαία ετικέτα, η ίδια
 * σειρά θα είχε δύο τυπογραφίες. Περνά μόνο `ariaLabel`, ώστε ο αναγνώστης
 * οθόνης να ακούει το ίδιο που διαβάζει το μάτι. (Ο εγγενής `<select>` δεν
 * επιτρέπεται: scripts/guard-native-fields.mjs.)
 */
export function ToolSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <div>
      <span style={TOOL_LABEL}>{label}</span>
      <CustomSelect ariaLabel={label} value={value} onChange={onChange} options={[...options]}/>
    </div>
  );
}

/**
 * Το μεγάλο νούμερο με την ετικέτα του. ΧΩΡΙΣ ΠΑΡΑΜΕΤΡΟ ΧΡΩΜΑΤΟΣ: η έμφαση
 * δίνεται με μέγεθος και σειρά, που δουλεύουν και σε ασπρόμαυρη εκτύπωση και σε
 * κάθε μορφή αχρωματοψίας. Ο φόρος δεν είναι σφάλμα, είναι υποχρέωση.
 */
export function ToolFigure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ ...TOOL_LABEL, display: 'block' }}>{label}</div>
      <div className="po-fig" style={{
        fontFamily: T.font.num, fontSize: 'clamp(24px, 4.4vw, 32px)', fontWeight: 680,
        letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1,
        color: 'var(--text-primary)',
      }}>{value}</div>
    </div>
  );
}

/** Μία γραμμή της ανάλυσης. `param` για συντελεστή, `total` για το σύνολο. */
export interface LedgerRow { k: ReactNode; v: string; kind?: 'param' | 'total'; sub?: ReactNode }

/**
 * ΜΙΑ ΣΤΗΛΗ, ΜΕ ΤΗ ΣΕΙΡΑ ΤΟΥ ΥΠΟΛΟΓΙΣΜΟΥ, ΚΑΙ ΚΛΕΙΝΕΙ ΜΕ ΣΥΝΟΛΟ.
 *
 * Η ανάλυση ήταν πλέγμα δύο στηλών: διαβαζόταν ζιγκ-ζαγκ («Ετήσιο ενοίκιο |
 * Τεκμαρτή έκπτωση / Φορολογητέο | Καθαρά ανά μήνα») και καμία γραμμή δεν
 * έλεγε «άρα». Εδώ η αριθμητική τρέχει προς τα κάτω, όπως σε απόδειξη· η
 * τελευταία γραμμή είναι το αποτέλεσμα, με γραμμή από πάνω της.
 *
 * ΟΛΟ ΤΟ ΠΛΑΤΟΣ, ΜΕ ΟΔΗΓΟ ΑΠΟ ΤΗΝ ΕΤΙΚΕΤΑ ΣΤΟ ΠΟΣΟ. Ηταν κλεισμένη στα 520,
 * για να μη χάνεται το ποσό μακριά από την ετικέτα του: σε κάρτα 1.000 όμως
 * άφηνε το δεξί μισό άδειο, κάτω από το «Ανά μήνα». Τώρα κλείνει στην άκρη της
 * κάρτας, όπως κάθε άλλο στοιχείο της, και μια αχνή διάστικτη γραμμή δένει
 * ετικέτα και ποσό, όπως στην εκκαθάριση και στην απόδειξη.
 */
export function ToolLedger({ rows }: { rows: readonly (LedgerRow | false | null | undefined)[] }) {
  return (
    <dl style={{ margin: 0, display: 'grid', rowGap: 10 }}>
      {rows.filter((r): r is LedgerRow => !!r).map((r, i) => {
        const total = r.kind === 'total', param = r.kind === 'param';
        return (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline',
            ...(total ? { borderTop: '1px solid var(--border-default)', paddingTop: 10, marginTop: 2 } : null),
          }}>
            <dt style={{ fontSize: total ? 14 : 13, fontWeight: total ? 600 : 400,
              color: total ? 'var(--text-primary)' : param ? 'var(--text-tertiary)' : 'var(--text-secondary)' }}>
              {r.k}
              {r.sub && <span style={{ display: 'block', marginTop: 2, fontSize: 12, color: 'var(--text-tertiary)', textWrap: 'pretty' }}>{r.sub}</span>}
            </dt>
            {!total && <span aria-hidden="true" className="po-ledger-lead" />}
            <dd style={{ margin: 0, whiteSpace: 'nowrap', fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums',
              fontSize: total ? 16 : param ? 13 : 14, fontWeight: total ? 700 : param ? 500 : 600,
              color: param ? 'var(--text-secondary)' : 'var(--text-primary)' }}>{r.v}</dd>
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
  // Στοίχιση στο κάτω άκρο: μια ετικέτα δύο γραμμών δεν κατεβάζει το νούμερό της.
  const cols = fixedCols(items.length, 16, 'end');
  return (
    <dl {...cols} style={{ ...cols.style, margin: `${T.sp.lg}px 0 0`, paddingTop: 14,
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
