'use client';

// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΔΩΔΕΚΑΜΗΝΟ ΓΡΑΦΗΜΑ, ΓΡΑΜΜΕΝΟ ΜΙΑ ΦΟΡΑ
// ─────────────────────────────────────────────────────────────────────────
// ΗΤΑΝ ΔΥΟ ΦΟΡΕΣ ΚΑΙ ΟΙ ΔΥΟ ΓΡΑΦΕΣ ΑΠΕΚΛΙΝΑΝ. Η κάρτα των δαπανών είχε στήλες
// που εστιάζονται με το πληκτρολόγιο, ανακοινώνουν το ποσό τους σε αναγνώστη
// οθόνης, ανάβουν στο πέρασμα του δείκτη και γράφουν τον μήνα και το ποσό σε
// γραμμή ανάγνωσης από πάνω. Η καρτέλα των επισκεπτών είχε δώδεκα ορθογώνια με
// `title`: κανένα όνομα, καμία εστίαση, καμία αντίδραση· και σε αφή το `title`
// δεν εμφανίζεται ΠΟΤΕ — δηλαδή στο κινητό το γράφημα δεν έλεγε κανένα νούμερο.
//
// Ιδιο ερώτημα, ίδιο σχήμα: δώδεκα μήνες, ένα ποσό ο καθένας. Μία γραφή.
//
// ── ΤΙ ΚΑΝΕΙ ΤΟ ΓΡΑΦΗΜΑ ΖΩΝΤΑΝΟ ΚΑΙ ΓΙΑΤΙ ΔΕΝ ΕΙΝΑΙ ΔΙΑΚΟΣΜΗΣΗ ──────────
// 1. ΓΡΑΜΜΗ ΑΝΑΓΝΩΣΗΣ. Το ποσό δεν χωρά μέσα σε στήλη 14 εικονοστοιχείων και
//    το βομβίδιο του περιηγητή αργεί μισό δευτερόλεπτο, δεν διαβάζεται από
//    αναγνώστη οθόνης και δεν υπάρχει σε αφή. Η κεφαλίδα του γραφήματος γίνεται
//    η οθόνη του: όπου κι αν σταθεί ο δείκτης, το νούμερο εμφανίζεται εκεί.
// 2. ΕΣΤΙΑΣΗ ΜΕ TAB. Κάθε στήλη είναι `tabIndex={0}` με `aria-label`: το
//    γράφημα διαβάζεται ολόκληρο χωρίς ποντίκι.
// 3. Ο ΤΡΕΧΩΝ ΜΗΝΑΣ ΞΕΧΩΡΙΖΕΙ ΜΟΝΟΣ ΤΟΥ, με το χρώμα της εφαρμογής. Κανένα
//    δεύτερο χρώμα: οι υπόλοιπες στήλες είναι το ίδιο μελάνι σε δύο εντάσεις.
// 4. ΟΙ ΜΗΝΕΣ ΧΩΡΙΣ ΠΟΣΟ ΚΡΑΤΟΥΝ ΤΗ ΘΕΣΗ ΤΟΥΣ. Μια λεπτή γραμμή βάσης λέει
//    «εδώ ήταν ο Μάρτιος και ήταν μηδέν», αντί για κενό που μοιάζει με σφάλμα.
//
// ── ΠΡΟΑΙΡΕΤΙΚΑ, ΑΠΟ ΤΟ ΙΣΤΟΡΙΚΟ ΤΩΝ ΔΑΠΑΝΩΝ (02.11.2026) ──────────────────
// Το `HistoryBars` του ExpenseCompare γράφτηκε χωριστά επειδή εδώ έλειπαν τρία
// πράγματα. Τώρα υπάρχουν, χωρίς να αλλάζει τίποτα για όποιον δεν τα ζητά:
//   · `avg`: διακεκομμένη γραμμή μέσου όρου, με το ποσό της στο υπόμνημα.
//   · `valueKeys`: το ποσό γραμμένο πάνω από τις ράβδους που ορίζεις (συνήθως η
//     ψηλότερη και ο τρέχων μήνας). Οχι πάνω από όλες: δώδεκα ποσά σε στήλες
//     των είκοσι εικονοστοιχείων στα 320 πέφτουν το ένα πάνω στο άλλο.
//   · `series`: ράβδοι στο `--series-out`, ο τρέχων μήνας στο `--series-in`,
//     βάση στο `--series-axis` (≥3:1 και στα δύο θέματα, WCAG 1.4.11).
// ═══════════════════════════════════════════════════════════════════════════
import { useState, type ReactNode } from 'react';
import { T, TT } from './tokens';
import { MONTHS_SHORT } from '../lib/core/months';

export interface MonthPoint {
  /** «2026-07» */
  key: string;
  /** «Ιούλιος 2026» */
  label: string;
  total: number;
}

const LABEL_H = 16;   // μία γραμμή ετικέτας τιμής, var(--fs-xs)

export default function MonthBars({
  points, currentKey, restLabel, right, readout, format, height = 116,
  avg, avgLabel = 'μέσος όρος', valueKeys, series = false,
}: {
  points: readonly MonthPoint[];
  /** Ποιος μήνας φοράει το χρώμα της εφαρμογής. */
  currentKey?: string;
  /** Τι γράφει η γραμμή ανάγνωσης όσο δεν δείχνει κανείς τίποτα. */
  restLabel: string;
  /** Ο,τι κάθεται στο δεξί άκρο της κεφαλίδας: μέσος όρος, σύνολο, τίποτα. */
  right?: ReactNode;
  /** Τι γράφει η γραμμή ανάγνωσης πάνω από μια στήλη. Προεπιλογή: μήνας και ποσό. */
  readout?: (p: MonthPoint) => ReactNode;
  /** Πώς γράφεται το ποσό. Το ίδιο και στο `aria-label`. */
  format: (n: number) => string;
  height?: number;
  /** Μέσος όρος: διακεκομμένη γραμμή στο ύψος του και το ποσό στο υπόμνημα. */
  avg?: number;
  /** Τι λέει το υπόμνημα πριν από το ποσό, π.χ. «μέσος όρος σε 7 μήνες». */
  avgLabel?: ReactNode;
  /** Οι μήνες που γράφουν το ποσό τους πάνω από τη ράβδο. */
  valueKeys?: readonly string[];
  /** Χρώματα σειράς (εκροή/εισροή/άξονας) αντί για μελάνι σε δύο εντάσεις. */
  series?: boolean;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const sel = points.find(p => p.key === hover) ?? null;
  const max = Math.max(...points.map(p => p.total), avg ?? 0, 1);
  const showAvg = avg != null && avg > 0;
  const labelled = new Set((valueKeys ?? []).filter(k => (points.find(p => p.key === k)?.total ?? 0) > 0));
  // Χώρος πάνω από την ψηλότερη ράβδο για την ετικέτα της· μόνο όταν υπάρχει.
  const px = (v: number) => (v / max) * height;
  const n = points.length;
  // Δύο διπλανές ετικέτες σε κοντινό ύψος θα πατούσαν η μία την άλλη: η
  // ψηλότερη ανεβαίνει όσο χρειάζεται για να ελευθερωθεί.
  const lift = new Map<string, number>();
  const li = points.map((p, i) => (labelled.has(p.key) ? i : -1)).filter(i => i >= 0);
  for (let k = 1; k < li.length; k++) {
    const a = points[li[k - 1]], b = points[li[k]];
    if (li[k] - li[k - 1] !== 1) continue;
    const [hi, lo] = a.total >= b.total ? [a, b] : [b, a];
    const gap = px(hi.total) - px(lo.total);
    if (gap < LABEL_H) lift.set(hi.key, LABEL_H - gap);
  }
  const maxLift = Math.max(0, ...lift.values());
  const headRoom = labelled.size ? LABEL_H + 4 + maxLift : 0;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12, minHeight: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
          {sel
            ? (readout
              ? readout(sel)
              : <>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: T.font.sans, whiteSpace: 'nowrap' }}>{sel.label}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums' }}>{format(sel.total)}</span>
                </>)
            : <span style={TT.label}>{restLabel}</span>}
        </div>
        {(showAvg || right) && (
          <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            {showAvg && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: T.font.sans, whiteSpace: 'nowrap' }}>
                <span aria-hidden style={{ width: 16, borderTop: '1px dashed var(--text-tertiary)' }} />
                <span>{avgLabel} <span style={{ fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--text-secondary)' }}>{format(avg!)}</span></span>
              </span>
            )}
            {right}
          </span>
        )}
      </div>

      <div style={{ position: 'relative' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, alignItems: 'end' }}>
        {points.map((p, i) => {
          const isCur = p.key === currentKey;
          const isSel = p.key === hover;
          const h = p.total > 0 ? Math.max(px(p.total), 3) : 0;
          const m = Number(p.key.slice(5, 7)) - 1;
          // Η πρώτη και η τελευταία ετικέτα τιμής στοιχίζονται στο άκρο τους,
          // ώστε να μη βγουν από την κάρτα.
          const edge = i === 0 ? { left: 0 } : i === n - 1 ? { right: 0 } : { left: '50%', transform: 'translateX(-50%)' };
          return (
            /* Το `aria-label` δίνει όνομα σε εστιάσιμο στοιχείο που δεν είχε
               κανένα. Το `title` του περιηγητή ΔΕΝ χρησιμοποιείται: θα έγραφε
               δεύτερη φορά ό,τι λέει η γραμμή ανάγνωσης, με άλλη στίξη· και σε
               οθόνη αφής δεν εμφανίζεται ποτέ. */
            <div key={p.key}
              onMouseEnter={() => setHover(p.key)} onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(p.key)} onBlur={() => setHover(null)}
              tabIndex={0} aria-label={`${p.label}: ${format(p.total)}`}
              className="exp-bar" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'default', minWidth: 0 }}>
              <span style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', height: height + headRoom, width: '100%', justifyContent: 'center', borderBottom: `1px solid ${series ? 'var(--series-axis)' : 'var(--border-subtle)'}` }}>
                {labelled.has(p.key) && (
                  <span aria-hidden style={{
                    position: 'absolute', bottom: h + 4 + (lift.get(p.key) ?? 0), ...edge,
                    fontSize: 'var(--fs-xs)', lineHeight: `${LABEL_H - 2}px`, fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums',
                    fontWeight: isCur ? 700 : 600, color: isCur ? 'var(--text-primary)' : 'var(--text-secondary)', whiteSpace: 'nowrap',
                  }}>{format(p.total)}</span>
                )}
                <span style={{
                  display: 'block', width: series ? 'min(16px, 70%)' : 14, height: h,
                  borderRadius: '3px 3px 0 0',
                  background: series
                    ? (isCur ? 'var(--series-in)' : 'var(--series-out)')
                    : isCur ? 'var(--accent)'
                    : isSel ? 'color-mix(in srgb, var(--text-primary) 42%, transparent)'
                    : 'color-mix(in srgb, var(--text-primary) 22%, transparent)',
                  opacity: series && hover && !isSel ? 0.55 : 1,
                  transition: 'height 0.35s cubic-bezier(0.2,0,0,1), background 0.15s, opacity 0.15s',
                }} />
              </span>
              <span style={{
                marginTop: 6, textAlign: 'center', fontSize: 'var(--fs-xs)', fontFamily: T.font.sans,
                fontWeight: isSel ? 700 : 400,
                color: isSel ? 'var(--text-secondary)' : 'var(--text-tertiary)',
              }}>{MONTHS_SHORT[m]}</span>
            </div>
          );
        })}
      </div>
      {/* Η ΓΡΑΜΜΗ ΤΟΥ ΜΕΣΟΥ ΟΡΟΥ, πάνω από τις ράβδους, χωρίς να πιάνει τον
          κέρσορα. Μετριέται από πάνω: κάθε στήλη έχει το ίδιο ύψος σχεδίασης. */}
      {showAvg && (
        <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: height + headRoom - px(avg!), borderTop: '1px dashed var(--text-tertiary)', pointerEvents: 'none' }} />
      )}
      </div>
    </div>
  );
}
