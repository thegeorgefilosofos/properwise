'use client';

// ═══════════════════════════════════════════════════════════════════════════
// ΤΙ ΑΛΛΑΞΕ ΑΠΟ ΤΟΝ ΠΡΟΗΓΟΥΜΕΝΟ ΜΗΝΑ — Η ΟΘΟΝΗ.
//
// Η μηχανή (lib/expenses/compare.ts) ξέρει ήδη να λέει την αλήθεια: σημειώνει τον
// ημιτελή μήνα, αρνείται να βγάλει ποσοστό πάνω στο μηδέν και ξεχωρίζει την
// έκτακτη δαπάνη από την υπέρβαση. Εδώ δεν υπολογίζεται ΤΙΠΟΤΑ ξανά — ό,τι
// δείχνει αυτή η οθόνη το είπε η μηχανή. Αν εκείνη δεν έχει κάτι να πει
// (`meaningful === false`), η κάρτα δεν εμφανίζεται· δεν εφευρίσκουμε νούμερα.
//
// Η ΚΑΤΕΥΘΥΝΣΗ ΛΕΓΕΤΑΙ ΤΡΙΣ ΦΟΡΕΣ ΣΤΙΣ ΡΑΒΔΟΥΣ ΤΗΣ ΔΙΑΦΟΡΑΣ: θέση γύρω από τον
// άξονα, πρόσημο και τόνος (`--negative` για ό,τι ανέβηκε, `--positive` για
// ό,τι έπεσε). Με ένα μελάνι και για τις δύο πλευρές, στον οπτικό έλεγχο οι
// δύο ράβδοι διαβάζονταν ως ίδιο πράγμα σε δύο μήκη. Ο τόνος μένει στη ράβδο·
// το ποσό γράφεται στο μελάνι του κειμένου, όπως σε κάθε άλλη στήλη ποσών.
// ═══════════════════════════════════════════════════════════════════════════

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { T, TT, Card, ChipToggle, fe } from '@/components/Theme';
import { feSigned, fpSigned } from '@/lib/core/format';
import { MONTHS_SHORT } from '@/lib/core/months';
import {
  compareMonth, history, lastCompleteMonth, monthPhrase,
  type Basis, type Comparison, type MonthPoint, type Spend,
} from '@/lib/expenses/compare';

interface Props {
  spends: readonly Spend[];
  /** Περνιέται ως όρισμα, δεν διαβάζεται από το ρολόι — ίδιος κανόνας με τη μηχανή. */
  today?: Date;
}

// ── Ποσά ───────────────────────────────────────────────────────────────────
// ΤΑ ΛΕΠΤΑ ΓΡΑΦΟΝΤΑΙ ΟΠΩΣ ΣΕ ΚΑΘΕ ΑΛΛΗ ΟΘΟΝΗ. Εδώ ζούσαν λεπτά στο 52% του
// χρώματος, μόνο σε αυτή την κάρτα: το «+12,00€» διαβαζόταν «+12» με ένα
// σβησμένο υπόλειμμα και το ίδιο ποσό είχε άλλη όψη δυο κάρτες πιο κάτω. Ενα
// ποσό, μία όψη, από τον κοινό μορφοποιητή.
//
// Το πρόσημο: το `feSigned` γράφει το τυπογραφικό μείον· το συν μπαίνει εδώ,
// μόνο όπου η τιμή είναι διαφορά.
function Eur({ value, sign = false }: { value: number; sign?: boolean }) {
  const text = sign ? `${value > 0 ? '+' : ''}${feSigned(value)}` : fe(Math.abs(value));
  return (
    <span style={{ fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
      {text}
    </span>
  );
}

// ── Η εναλλαγή βάσης ───────────────────────────────────────────────────────
// Δύο επιλογές, όχι πέντε. Η βάση που δεν έχει δεδομένα μένει απενεργοποιημένη
// και το λέει στο tooltip: καλύτερα από μια καρτέλα που ανοίγει και είναι άδεια.
//
// ═══ ΤΑ ΠΛΗΚΤΡΑ ΟΝΟΜΑΖΟΥΝ ΤΟΝ ΜΗΝΑ ΚΑΙ ΕΤΣΙ Η ΣΕΙΡΑ ΛΕΓΕΤΑΙ ΜΙΑ ΦΟΡΑ ══════
// Ελεγαν «Προηγούμενος μήνας» και «Ίδιος μήνας πέρσι», δηλαδή ΤΟ ΙΔΙΟ ΓΕΓΟΝΟΣ
// με την επικεφαλίδα δίπλα τους: «Τον Αύγουστο σε σχέση με τον Ιούλιο» και,
// δώδεκα εικονοστοιχεία δεξιά, «Προηγούμενος μήνας». Ο χρήστης διάβαζε δύο
// φορές ποια είναι η βάση πριν φτάσει στο νούμερο. Στη δεύτερη κατάσταση ήταν
// χειρότερο: «σε σχέση με τον Αύγουστο 2025» δίπλα σε «Ίδιος μήνας πέρσι».
//
// Τώρα η επικεφαλίδα τελειώνει στο «ΣΕ ΣΧΕΣΗ ΜΕ» και τα πλήκτρα τη συμπληρώνουν.
// Ολη η σειρά διαβάζεται ως μία πρόταση, αριστερά προς τα δεξιά· το όνομα
// του μήνα βάσης γράφεται εκεί ακριβώς που ο χρήστης τον αλλάζει.
//
// ΤΟ ΥΨΟΣ ΕΡΧΕΤΑΙ ΑΠΟ ΤΗΝ ΚΟΙΝΗ ΚΛΙΜΑΚΑ. Ηταν `padding: 5px 12px`, δηλαδή
// μετρημένα 23 εικονοστοιχεία: μισός στόχος αφής. Το `T.h.sm` είναι 32 με
// ποντίκι και 44 με δάχτυλο, από το ίδιο σημείο που το ξέρει κάθε άλλο
// χειριστήριο της εφαρμογής.
function BasisSwitch({ value, onChange, enabled, labels }: {
  value: Basis; onChange: (b: Basis) => void;
  enabled: Record<Basis, boolean>; labels: Record<Basis, string>;
}) {
  const opts: Basis[] = ['previous_month', 'same_month_last_year'];
  return (
    <div style={{ display: 'inline-flex', gap: 2, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.pill, padding: 4 }}>
      {/* `seg` και όχι `chip`: η ράγα έχει ήδη δικό της περίγραμμα, οπότε ένα
          δεύτερο ανά πλακίδιο θα έδινε διπλή γραμμή. */}
      {opts.map(id => (
        <ChipToggle key={id} on={value === id} disabled={!enabled[id]} shape="seg"
          onClick={() => onChange(id)}
          title={enabled[id] ? undefined : 'Δεν υπάρχουν καταχωρημένες δαπάνες σε αυτή την περίοδο.'}>
          {labels[id]}
        </ChipToggle>
      ))}
    </div>
  );
}

// ── Πού πήγε η διαφορά ─────────────────────────────────────────────────────
// Άξονας στη μέση: δεξιά ό,τι ανέβηκε, αριστερά ό,τι έπεσε. Πάνω από τη στήλη
// των ράβδων, δύο ετικέτες λένε ποια πλευρά είναι ποια («− λιγότερα»,
// «+ περισσότερα»), στον τόνο της ράβδου τους.
//
// ═══ ΕΝΑ ΠΛΕΓΜΑ ΓΙΑ ΟΛΕΣ ΤΙΣ ΣΕΙΡΕΣ, ΟΧΙ ΕΝΑ ΑΝΑ ΣΕΙΡΑ ═════════════════════
// Κάθε οδηγός ήταν ΔΙΚΟ ΤΟΥ πλέγμα μέσα σε στήλη flex, με τρίτη στήλη `auto`.
// Το `auto` υπολογίζεται μέσα στο πλέγμα που το ορίζει, οπότε τρεις σειρές
// έβγαζαν τρία διαφορετικά πλάτη και τρία διαφορετικά δεξιά άκρα: το «€» της
// μιας σειράς δεν έπεφτε ποτέ πάνω στο «€» της επόμενης. Το `tabular-nums` του
// `Eur` υπάρχει ακριβώς για αυτή την κάθετη στοίχιση και ακυρωνόταν από τη
// δομή που το περιέβαλλε.
//
// ΚΑΙ ΤΟ ΣΗΜΑ ΕΦΥΓΕ ΑΠΟ ΤΟ ΚΕΛΙ ΤΟΥ ΠΟΣΟΥ. Το «σταμάτησε» πιάνει περίπου
// πενήντα οκτώ εικονοστοιχεία, το «νέο» είκοσι τέσσερα: όσο κάθονταν δίπλα
// στον αριθμό μέσα στο ίδιο κελί, το ποσό μετακινούνταν κατά τη διαφορά τους.
// Δική του στήλη, που υπάρχει μόνο όταν κάποιος οδηγός έχει κάτι να πει: αλλιώς
// θα άφηνε κενό διάστημα δεξιά από κάθε ποσό.
const UP = 'var(--negative)';
const DOWN = 'var(--positive)';

function Drivers({ c }: { c: Comparison }) {
  // ΟΙ ΓΡΑΜΜΕΣ ΑΘΡΟΙΖΟΥΝ ΣΤΟΝ ΤΙΤΛΟ. Ό,τι δεν εξηγούν οι κατηγορίες που
  // δείχνονται μπαίνει σε μία τελευταία γραμμή, με το ίδιο σχήμα.
  const rows = Math.abs(c.rest) >= 0.005
    ? [...c.drivers, { slug: '__rest', label: 'Λοιπά', diff: c.rest, current: 0, base: 0, isNew: false, vanished: false }]
    : c.drivers;
  const max = Math.max(...rows.map(d => Math.abs(d.diff)), 1);
  const anyFlag = c.drivers.some(d => d.isNew || d.vanished);
  const flag: React.CSSProperties = { fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: T.font.sans, fontWeight: 400, whiteSpace: 'nowrap' };
  const side: React.CSSProperties = { fontSize: 'var(--fs-xs)', fontFamily: T.font.sans, fontWeight: 600, whiteSpace: 'nowrap' };
  return (
    <div style={{
      display: 'grid', alignItems: 'center', columnGap: 12, rowGap: 10,
      // Η ΣΤΗΛΗ ΤΟΥ ΟΝΟΜΑΤΟΣ ΠΑΙΡΝΕΙ ΟΣΟ ΧΡΕΙΑΖΕΤΑΙ, ΩΣ ΤΟ 40%. Με σταθερό
      // `minmax(84px, 176px)` το «Ρεύμα» κρατούσε 176 εικονοστοιχεία στα 390
      // και η στήλη των ράβδων έμενε με εβδομήντα· το «Επισκευές και
      // συντήρηση» τυλίγει πια σε δεύτερη γραμμή αντί να κοπεί.
      gridTemplateColumns: `fit-content(40%) minmax(60px, 1fr) auto${anyFlag ? ' auto' : ''}`,
    }}>
      {/* Η ΚΕΦΑΛΙΔΑ ΤΩΝ ΡΑΒΔΩΝ: ποια πλευρά του άξονα είναι ποια. Πιάνει και
          τη στήλη των ποσών, ώστε οι δύο ετικέτες να χωρούν και στα 320. */}
      <span aria-hidden />
      <span aria-hidden style={{ gridColumn: anyFlag ? '2 / 5' : '2 / 4', display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: -4 }}>
        <span style={{ ...side, color: DOWN }}>− λιγότερα</span>
        <span style={{ ...side, color: UP }}>+ περισσότερα</span>
      </span>
      {rows.map(d => {
        const ratio = Math.min(Math.abs(d.diff) / max, 1);
        const up = d.diff > 0;
        return (
          <Fragment key={d.slug}>
            {/* Τυλίγει αντί να κόβεται: στα 320 η στήλη έχει 84 εικονοστοιχεία και
                το «Επισκευές και συντήρηση» έχανε τη μισή λέξη. */}
            <span style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.3, color: 'var(--text-secondary)', fontFamily: T.font.sans, minWidth: 0 }}>
              {d.label}
            </span>
            <span style={{ position: 'relative', display: 'block', height: 8 }}>
              <span aria-hidden style={{ position: 'absolute', left: '50%', top: -2, width: 1, height: 12, background: 'var(--series-axis)' }} />
              <span style={{
                position: 'absolute', top: 0, height: 8, borderRadius: T.radius.hair,
                width: `${ratio * 50}%`,
                left: up ? '50%' : `${50 - ratio * 50}%`,
                background: up ? UP : DOWN,
              }} />
            </span>
            <span style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-primary)', justifySelf: 'end' }}>
              <Eur value={d.diff} sign />
            </span>
            {anyFlag && <span style={flag}>{d.isNew ? 'νέο' : d.vanished ? 'σταμάτησε' : ''}</span>}
          </Fragment>
        );
      })}
    </div>
  );
}

// ── Το ιστορικό ────────────────────────────────────────────────────────────
// ΕΝΑ ΓΡΑΜΜΑ ΔΕΝ ΕΙΝΑΙ ΜΗΝΑΣ. Οι ετικέτες είναι οι συντομογραφίες τριών
// γραμμάτων του lib/core/months· ράβδος και ετικέτα είναι μία στήλη, άρα και
// στοιχισμένες.
//
// ═══ ΤΟ ΓΡΑΦΗΜΑ ΕΛΕΓΕ ΜΟΝΟ ΣΧΗΜΑ ═══════════════════════════════════════════
// Δώδεκα γκρίζες ράβδοι στο 22% του μελανιού (κάτω από το 3:1 που ζητά το WCAG
// 1.4.11 για γραφικό με πληροφορία στο φωτεινό θέμα), χωρίς κανέναν αριθμό
// πάνω στο γράφημα και με τον μέσο όρο μόνο ως κείμενο στη γωνία. Ο χρήστης
// έβλεπε «ψηλή ράβδος τον Ιούλιο» αλλά όχι πόσο, ούτε πού κάθεται ο Οκτώβριος
// σε σχέση με το συνηθισμένο.
//
// Τώρα: ράβδοι στο `--series-out` (η εκροή, ≥3:1 και στα δύο θέματα), ο μήνας
// της κάρτας στο `--series-in`, γραμμή βάσης στο `--series-axis`, διακεκομμένη
// γραμμή μέσου όρου με το ποσό της και το ποσό γραμμένο πάνω από ΔΥΟ ράβδους:
// την ψηλότερη και τον μήνα της κάρτας. Οχι πάνω από όλες: δώδεκα ποσά σε
// στήλες των είκοσι εικονοστοιχείων στα 320 θα έπεφταν το ένα πάνω στο άλλο.
//
// ═══ Η ΓΡΑΜΜΗ ΑΝΑΓΝΩΣΗΣ ════════════════════════════════════════════════════
// Σε ηρεμία η σειρά από πάνω είναι η επικεφαλίδα του γραφήματος· με τον
// κέρσορα ή την εστίαση πάνω σε ράβδο γίνεται η ανάγνωσή της. Η θέση και το
// ύψος δεν αλλάζουν, οπότε τίποτα δεν αναπηδά. Κάθε στήλη εστιάζεται με Tab και
// έχει `aria-label`, όπως στο κοινό components/MonthBars.tsx.
//
// ΓΙΑΤΙ ΟΧΙ ΤΟ ΚΟΙΝΟ MonthBars: δεν ξέρει μέσο όρο, ετικέτες τιμών ούτε τα
// χρώματα σειρών. Η πρόταση να τα αποκτήσει, ώστε να τα πάρει και η καρτέλα
// των επισκεπτών, είναι γραμμένη στην αναφορά του ελέγχου ποιότητας.
const PLOT_H = 116;
const LABEL_H = 16;   // μία γραμμή ετικέτας τιμής, var(--fs-xs)
const HEAD_ROOM = 2 * LABEL_H + 4;

function HistoryBars({ points, currentKey }: { points: MonthPoint[]; currentKey: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const sel = points.find(p => p.key === hover) ?? null;
  const months = points.filter(p => p.total > 0).length;
  const avg = months > 0 ? points.reduce((s, p) => s + p.total, 0) / months : 0;
  // Χρειάζονται δύο τιμές για να υπάρχει μέση τιμή· με μία, ο «μέσος όρος»
  // ΕΙΝΑΙ το ποσό του μήνα, γραμμένο δεύτερη φορά.
  const showAvg = avg > 0 && months >= 2;
  const max = Math.max(...points.map(p => p.total), 1);
  const px = (v: number) => (v / max) * PLOT_H;

  // ΠΟΙΕΣ ΡΑΒΔΟΙ ΓΡΑΦΟΥΝ ΤΟ ΠΟΣΟ ΤΟΥΣ: η ψηλότερη και ο μήνας της κάρτας.
  const peakIdx = points.reduce((b, p, i) => (p.total > points[b].total ? i : b), 0);
  const curIdx = points.findIndex(p => p.key === currentKey);
  const labelled = new Set<number>([peakIdx, ...(curIdx >= 0 && points[curIdx].total > 0 ? [curIdx] : [])]);
  if (points[peakIdx].total <= 0) labelled.delete(peakIdx);
  // Δύο διπλανές ετικέτες σε κοντινό ύψος θα πατούσαν η μία την άλλη: η
  // ψηλότερη ανεβαίνει όσο χρειάζεται για να ελευθερωθεί.
  const lift = new Map<number, number>();
  if (labelled.size === 2 && curIdx >= 0 && Math.abs(curIdx - peakIdx) <= 1) {
    const gap = px(points[peakIdx].total) - px(points[curIdx].total);
    if (gap < LABEL_H) lift.set(peakIdx, LABEL_H - gap);
  }
  const n = points.length;

  // ΤΟ ΠΟΣΟ ΤΟΥ ΜΕΣΟΥ ΟΡΟΥ: στο δεξί περιθώριο όταν υπάρχει χώρος, αλλιώς στο
  // υπόμνημα. Στα 390 το περιθώριο έκλεβε πενήντα εικονοστοιχεία από δώδεκα
  // στήλες και οι ετικέτες των μηνών έπεφταν η μία πάνω στην άλλη
  // («ΦεβΜαρΑπρ»). Μετριέται το πλάτος, δεν μαντεύεται από τη συσκευή.
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const el = boxRef.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setWide(e.contentRect.width / n >= 44));
    ro.observe(el);
    return () => ro.disconnect();
  }, [n]);
  const gutter = showAvg && wide;

  return (
    <div ref={boxRef}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8, minHeight: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
          {sel ? (
            <>
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', fontFamily: T.font.sans, whiteSpace: 'nowrap' }}>{sel.label}</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}><Eur value={sel.total} /></span>
              {sel.yoy !== null && Math.abs(sel.yoy) >= 1 && (
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                  <Eur value={sel.yoy} sign /> από πέρσι
                </span>
              )}
            </>
          ) : <span style={TT.label}>Δώδεκα μήνες</span>}
        </div>
        {/* ΤΟ ΥΠΟΜΝΗΜΑ ΤΗΣ ΔΙΑΚΕΚΟΜΜΕΝΗΣ. Ο μέσος όρος διαιρεί με τους μήνες
            που ΕΧΟΥΝ δαπάνες, όχι με τους δώδεκα: οι μήνες πριν από την πρώτη
            καταχώρηση είναι μήνες χωρίς στοιχεία, όχι μήνες με μηδέν. Κάτω από
            την επικεφαλίδα «Δώδεκα μήνες» αυτό λέγεται, αλλιώς διαβάζεται ως
            δωδεκάμηνος. */}
        {showAvg && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: T.font.sans, whiteSpace: 'nowrap' }}>
            <span aria-hidden style={{ width: 16, borderTop: '1px dashed var(--text-tertiary)' }} />
            <span>μέσος όρος{!gutter && <> <span style={{ fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--text-secondary)' }}>{fe(avg)}</span></>}{months < n ? ` σε ${months} μήνες με δαπάνες` : ''}</span>
          </span>
        )}
      </div>

      {/* ΔΥΟ ΣΤΗΛΕΣ: το γράφημα και, δεξιά του, το ποσό του μέσου όρου στο ύψος
          της γραμμής του. Στο περιθώριο και όχι πάνω στις ράβδους, ώστε να μην
          κρύβει καμία και να μη συγκρούεται με τις ετικέτες τιμών. */}
      <div style={{ display: 'grid', gridTemplateColumns: gutter ? 'minmax(0, 1fr) auto' : 'minmax(0, 1fr)', columnGap: 8 }}>
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, alignItems: 'end' }}>
          {points.map((p, i) => {
            const isCur = i === curIdx;
            const isSel = p.key === hover;
            const h = p.total > 0 ? Math.max(px(p.total), 3) : 0;
            const m = Number(p.key.slice(5, 7)) - 1;
            // Η πρώτη και η τελευταία ετικέτα στοιχίζονται στο άκρο τους, ώστε
            // να μη βγουν από την κάρτα.
            const edge = i === 0 ? { left: 0 } : i === n - 1 ? { right: 0 } : { left: '50%', transform: 'translateX(-50%)' };
            return (
              <div key={p.key}
                onMouseEnter={() => setHover(p.key)} onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(p.key)} onBlur={() => setHover(null)}
                tabIndex={0} aria-label={`${p.label}: ${fe(p.total)}`}
                className="exp-bar" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'default', minWidth: 0 }}>
                <span style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', width: '100%', height: PLOT_H + HEAD_ROOM, borderBottom: '1px solid var(--series-axis)' }}>
                  {labelled.has(i) && (
                    <span aria-hidden style={{
                      position: 'absolute', bottom: h + 4 + (lift.get(i) ?? 0), ...edge,
                      fontSize: 'var(--fs-xs)', lineHeight: `${LABEL_H - 2}px`, fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums',
                      fontWeight: isCur ? 700 : 600, color: isCur ? 'var(--text-primary)' : 'var(--text-secondary)', whiteSpace: 'nowrap',
                    }}>{fe(p.total)}</span>
                  )}
                  <span style={{
                    display: 'block', width: 'min(16px, 70%)', height: h,
                    borderRadius: '3px 3px 0 0',
                    background: isCur ? 'var(--series-in)' : 'var(--series-out)',
                    opacity: hover && !isSel ? 0.55 : 1,
                    transition: 'height 0.35s cubic-bezier(0.2,0,0,1), opacity 0.15s',
                  }} />
                </span>
                <span style={{
                  marginTop: 6, textAlign: 'center', fontSize: 'var(--fs-xs)', fontFamily: T.font.sans,
                  fontWeight: isSel || isCur ? 700 : 400,
                  color: isSel || isCur ? 'var(--text-primary)' : 'var(--text-tertiary)',
                }}>{MONTHS_SHORT[m]}</span>
              </div>
            );
          })}
        </div>
        {/* Η ΓΡΑΜΜΗ ΤΟΥ ΜΕΣΟΥ ΟΡΟΥ. Κάθεται πάνω από τις ράβδους χωρίς να
            πιάνει τον κέρσορα. Μετριέται από πάνω: όλες οι στήλες έχουν το ίδιο
            ύψος περιοχής σχεδίασης, οπότε η κορυφή είναι κοινή. */}
        {showAvg && (
          <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: PLOT_H + HEAD_ROOM - px(avg), borderTop: '1px dashed var(--text-tertiary)', pointerEvents: 'none' }} />
        )}
      </div>
      {gutter && (
        <div aria-hidden style={{ position: 'relative', height: PLOT_H + HEAD_ROOM }}>
          <span style={{ position: 'relative', top: PLOT_H + HEAD_ROOM - px(avg) - 7, display: 'block', fontSize: 'var(--fs-xs)', lineHeight: '14px', fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
            {fe(avg)}
          </span>
        </div>
      )}
      </div>
    </div>
  );
}

// ── Η κάρτα ────────────────────────────────────────────────────────────────
export default function ExpenseCompare({ spends, today }: Props) {
  const now = useMemo(() => today ?? new Date(), [today]);
  const [basis, setBasis] = useState<Basis>('previous_month');

  // ═══ Ο ΜΗΝΑΣ ΤΗΣ ΚΑΡΤΑΣ ΕΧΕΙ ΤΕΛΕΙΩΣΕΙ ══════════════════════════════════════
  // Η κάρτα έδειχνε τον μήνα ΠΟΥ ΤΡΕΧΕΙ και ο πυρήνας τον έκοβε στη σημερινή
  // ημέρα για να μη συγκρίνει μισό μήνα με ολόκληρο. Σωστός αριθμός, λάθος
  // ερώτηση: κανείς δεν σκέφτεται τα έξοδά του σε παράθυρα τριάντα ημερών και
  // το ίδιο παράθυρο άλλαζε κάθε μέρα. Πλέον η κάρτα απαντά για δύο ΟΛΟΚΛΗΡΟΥΣ
  // μήνες· ο μήνας που τρέχει ζει στο πλακίδιο «Δαπάνες μήνα» από πάνω.
  const currentKey = lastCompleteMonth(now);
  const prev = useMemo(() => compareMonth(spends, currentKey, { today: now, basis: 'previous_month' }), [spends, currentKey, now]);
  const year = useMemo(() => compareMonth(spends, currentKey, { today: now, basis: 'same_month_last_year' }), [spends, currentKey, now]);
  const points = useMemo(() => history(spends, now, 12), [spends, now]);

  // Αιτιατική, γιατί συνεχίζουν την επικεφαλίδα «Τον Αύγουστο σε σχέση με…».
  // Ο χρόνος μπαίνει μόνο όταν διαφέρει από τον τρέχοντα, όπως παντού αλλού.
  const basisLabels: Record<Basis, string> = {
    previous_month: `τον ${monthPhrase(prev.baseKey, Number(currentKey.slice(0, 4)))}`,
    same_month_last_year: `τον ${monthPhrase(year.baseKey, Number(currentKey.slice(0, 4)))}`,
  };

  const enabled: Record<Basis, boolean> = { previous_month: prev.meaningful, same_month_last_year: year.meaningful };
  const anyBasis = prev.meaningful || year.meaningful;
  // Η προεπιλογή πέφτει στη βάση που ΕΧΕΙ δεδομένα, χωρίς να το ζητήσει ο χρήστης.
  const active: Basis = enabled[basis] ? basis : (prev.meaningful ? 'previous_month' : 'same_month_last_year');
  const c = active === 'previous_month' ? prev : year;
  const hasHistory = points.some(p => p.total > 0);

  // Καμία μέτρηση, καμία κάρτα. Ο ιδιοκτήτης δεν χρειάζεται ένα πλαίσιο που του
  // λέει ότι δεν ξέρουμε τίποτα — η κενή κατάσταση των Δαπανών το λέει ήδη.
  if (!anyBasis && !hasHistory) return null;

  return (
    // Γέμισμα 16 όπως κάθε άλλη κάρτα των Δαπανών· ήταν 20 και η σύγκριση
    // διαβαζόταν ως άλλου είδους επιφάνεια ανάμεσα σε δύο κάρτες των 16.
    <Card style={{ marginBottom: 16 }}>
      {anyBasis && (
        <>
          {/* ΜΙΑ ΠΡΟΤΑΣΗ, ΟΧΙ ΔΥΟ ΑΚΡΑ. Με `space-between` η ετικέτα καθόταν
              αριστερά και τα πλήκτρα που τη συμπληρώνουν χίλια εκατό
              εικονοστοιχεία δεξιά, σαν άλλη σειρά. Κολλημένα δίπλα της
              διαβάζονται ως συνέχεια της φράσης. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            <span style={TT.label}>Τον {monthPhrase(currentKey)} σε σχέση με</span>
            <BasisSwitch value={active} onChange={setBasis} enabled={enabled} labels={basisLabels} />
          </div>

          {/* ═══ Η ΚΑΡΤΑ ΤΗΣ ΣΥΓΚΡΙΣΗΣ ΟΔΗΓΟΥΣΕ ΜΕ ΝΟΥΜΕΡΟ ΠΟΥ ΔΕΝ ΕΙΝΑΙ ΣΥΓΚΡΙΣΗ
              Στα 28 εικονοστοιχεία, δηλαδή στο μεγαλύτερο νούμερο της κάρτας,
              καθόταν το ΣΥΝΟΛΟ του μήνα. Δύο πράγματα ταυτόχρονα λάθος:

              ΠΡΩΤΟ, δεν απαντά στην ερώτηση του τίτλου. Ο τίτλος ρωτά «τον
              Αύγουστο σε σχέση με τον Ιούλιο» και η απάντηση σε αυτό είναι η
              ΔΙΑΦΟΡΑ. Το σύνολο του Αυγούστου είναι η απάντηση σε άλλη ερώτηση.

              ΔΕΥΤΕΡΟ, ήταν ήδη γραμμένο δύο φορές πιο κάτω, στην ΙΔΙΑ οθόνη:
              μετρημένο στον πάγκο, «273,00€» στα 28 εδώ, «273,00€» στα 24 στο
              πλακίδιο «Μηνιαίες δαπάνες» τετρακόσια εξήντα εικονοστοιχεία πιο
              κάτω, «273,00€» στα 13 στην κεφαλίδα «ΑΥΓΟΥΣΤΟΣ 2026» της λίστας.
              Τρεις φορές το ίδιο ποσό, σε τρία μεγέθη, σε μία οθόνη.

              Μένει η διαφορά, μόνη της, στο μέγεθος που της αξίζει. Το σύνολο το
              λέει το πλακίδιο που υπάρχει ακριβώς γι' αυτό. */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              <Eur value={c.diff} sign />
            </span>
            {/* Ποσοστό ΜΟΝΟ όταν ορίζεται. Στο μηδέν δεν υπάρχει «+∞%».
                ΚΑΙ ΓΡΑΦΕΤΑΙ ΟΠΩΣ ΚΑΘΕ ΠΟΣΟΣΤΟ ΤΗΣ ΕΦΑΡΜΟΓΗΣ. Εδώ ζούσε ο
                μοναδικός χειροποίητος μορφοποιητής ποσοστού του κώδικα:
                `Math.round` σε ακέραιο και σκέτο «%», δηλαδή «−76%» δίπλα σε
                «−99,20€». Δύο συμβάσεις αριθμού σε απόσταση οκτώ
                εικονοστοιχείων. Το `fpSigned` δίνει δύο δεκαδικά με ελληνικό
                κόμμα και τυπογραφικό μείον, όπως παντού αλλού. */}
            {c.pct !== null && Math.abs(c.pct) >= 1 && (
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-tertiary)', fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums' }}>
                {/* Ίδια σύμβαση προσήμου με το ποσό δίπλα: «+12,00€ +21,05%», όχι
                    «+12,00€ 21,05%». */}
                {c.pct > 0 ? '+' : ''}{fpSigned(c.pct)}
              </span>
            )}
          </div>

          {/* ═══ Η ΓΡΑΜΜΗ ΚΑΤΩ ΑΠΟ ΤΟΝ ΑΡΙΘΜΟ ΛΕΕΙ ΜΟΝΟ Ο,ΤΙ ΔΕΝ ΦΑΙΝΕΤΑΙ ΑΛΛΟΥ
              Εδώ αποδιδόταν η φράση της μηχανής, «Ξόδεψες 99,20€ λιγότερα από
              τον Ιούλιο», πίσω από τον φύλακα `drivers.length === 0`. Και ο
              φύλακας ήταν ακριβώς αυτό που την άδειαζε: χωρίς οδηγούς, η
              `buildSentence` δεν έχει ουρά να προσθέσει («Κυρίως από…»), οπότε
              έμενε η κεφαλή της. Ποσό, κατεύθυνση και μήνας βάσης, δηλαδή τρία
              πράγματα που κάθονται ήδη μέσα σε τριάντα εικονοστοιχεία από πάνω.

              Ο ΦΥΛΑΚΑΣ ΕΚΡΥΒΕ ΚΑΙ ΔΥΟ ΔΙΑΦΟΡΕΤΙΚΕΣ ΚΑΤΑΣΤΑΣΕΙΣ ΣΕ ΜΙΑ. Το
              «καμία κατηγορία δεν ξεχωρίζει» σημαίνει είτε «δεν άλλαξε τίποτα»
              είτε «άλλαξαν πολλά, από λίγο το καθένα»: δύο εντελώς άλλα
              μηνύματα για τον ιδιοκτήτη. Τα ξεχωρίζει το `flat` της μηχανής.

              Η πλήρης φράση ΔΕΝ σβήνεται: ζει για τη μηνιαία ειδοποίηση, που
              φτάνει χωρίς κάρτα, χωρίς ράβδους και χωρίς επικεφαλίδα. */}
          {c.drivers.length === 0 && (
            <p style={{ fontSize: 'var(--fs-base)', lineHeight: 1.55, color: 'var(--text-secondary)', fontFamily: T.font.sans, margin: '0 0 12px' }}>
              {c.flat
                ? 'Χωρίς ουσιαστική αλλαγή.'
                : 'Η διαφορά είναι μοιρασμένη: καμία κατηγορία δεν ξεχωρίζει.'}
            </p>
          )}

          {c.caveats.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: c.drivers.length > 0 ? 16 : 0 }}>
              {c.caveats.map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span aria-hidden style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--text-tertiary)', flexShrink: 0, marginTop: 8 }} />
                  <span style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-tertiary)', fontFamily: T.font.sans }}>{t}</span>
                </div>
              ))}
            </div>
          )}

          {c.drivers.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ ...TT.label, marginBottom: 10 }}>Πού πήγε η διαφορά</div>
              <Drivers c={c} />
            </div>
          )}
        </>
      )}

      {anyBasis && hasHistory && (
        <div style={{ height: 1, background: 'var(--border-subtle)', margin: '20px 0' }} />
      )}

      {hasHistory && <HistoryBars points={points} currentKey={currentKey} />}
    </Card>
  );
}
