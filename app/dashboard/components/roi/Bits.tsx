'use client';
// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΜΙΚΡΑ ΚΟΜΜΑΤΙΑ ΤΗΣ ΑΠΟΔΟΣΗΣ: ΣΤΥΛ, ΕΝΟΤΗΤΑ, ΕΠΕΞΗΓΗΣΗ ΟΡΟΥ, ΜΠΑΡΑ,
// ΒΑΘΜΟΣ, ΜΟΧΛΟΣ, ΔΙΑΚΟΠΤΗΣ ΠΑΡΑΔΟΧΗΣ
// ─────────────────────────────────────────────────────────────────────────
// Ζούσαν στην κορυφή του TabRentROI.tsx. Τα μοιράζονται η καρτέλα και οι
// ενότητες του φακέλου roi/, οπότε γράφονται μία φορά, εδώ.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from 'react';
import { feCompact, T, fixedCols, Bar, Stat } from '@/components/Theme';
import { Toggle as Switch, TOGGLE } from '../UIComponents';
import { ChevronRight, ArrowUpRight } from 'lucide-react';
import type { YieldGrade } from '@/lib/market/returns';
import type { YieldLever } from '@/lib/market/greekMarket';
import { GLOSSARY as G } from '@/lib/market/glossary';
import { InfoHint } from '../InfoHint';

/** Ο setter μιας `useState` της καρτέλας, όπως τον παίρνουν οι ενότητες του roi/. */
export type SetState<V> = React.Dispatch<React.SetStateAction<V>>;

// Η συμπαγής μορφή ζει στο lib/core/format.ts, μαζί με όλες τις άλλες.
export const feC = feCompact;
export const SANS = T.font.sans;
export const card: React.CSSProperties = { position: 'relative', background: 'linear-gradient(180deg, var(--bg-elevated) 0%, var(--bg-surface) 100%)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.card, padding: '18px 20px', boxShadow: 'var(--highlight-inset), var(--elev-2)' };
export const titleStyle: React.CSSProperties = { fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontFamily: SANS, letterSpacing: '0.1px' };
export const subStyle: React.CSSProperties = { fontSize: 12, color: 'var(--text-tertiary)', margin: '2px 0 0', fontFamily: SANS };
/** Οι δύο κάρτες των «Εργαλείων απόδοσης»: ίδιο κουτί, ίδια σημείωση, ίδιο ύψος. */
export const toolCard: React.CSSProperties = { padding: 14, borderRadius: T.radius.popup, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column' };
export const toolNote: React.CSSProperties = { fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', margin: 0, fontFamily: SANS, lineHeight: 1.5 };
// Το κάτω άκρο των καρτών εργαλείων: οι παραδοχές, κολλημένες στη βάση
// (ο `roiGrow` από πάνω τους τρώει ό,τι περισσεύει στη στήλη flex), ώστε δύο κάρτες δίπλα
// δίπλα να κλείνουν στην ίδια γραμμή όσο κι αν διαφέρει το περιεχόμενό τους.
export const roiFoot: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1.7fr) minmax(0, 1fr)', gap: '6px 20px', paddingTop: 10, borderTop: '1px solid var(--border-subtle)' };
export const roiGrow: React.CSSProperties = { flex: '1 0 12px' };
// Η κεφαλίδα της κάρτας έχει το ύψος του κουμπιού που μπορεί να κάθεται δίπλα
// της, ώστε οι τίτλοι δύο καρτών να είναι στην ίδια γραμμή με ή χωρίς αυτό.
export const roiHead: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12, flexWrap: 'wrap', minHeight: T.h.md };

export const roiFootLabel: React.CSSProperties = { ...toolNote, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 };
export const roiFootValue: React.CSSProperties = { fontSize: 12, fontFamily: SANS, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums', margin: '2px 0 0' };

// ── Επεξήγηση όρου (διακριτικό εικονίδιο· επαγγελματικός ορισμός) ─────────────
// Προσβάσιμο: πραγματικό κουμπί (πληκτρολόγιο + αφή), ανοίγει σε hover, εστίαση ή άγγιγμα,
// κλείνει σε Escape/έξοδο. Portal-based popover ώστε να μην «κόβεται» από scroll containers.
// ═══════════════════════════════════════════════════════════════════════════
// ΔΥΟ ΥΛΟΠΟΙΗΣΕΙΣ ΤΟΥ ΙΔΙΟΥ ΚΥΚΛΑΚΙΟΥ· ΜΟΝΟ Η ΜΙΑ ΕΙΧΕ ΔΙΟΡΘΩΘΕΙ
// ─────────────────────────────────────────────────────────────────────────
// Εδώ ζούσαν τριάντα γραμμές popover με portal, δικό τους εικονίδιο 12,5 και
// δικό τους περιθώριο: αντίγραφο του `InfoHint`, γραμμένο ξεχωριστά. Ο σαρωτής
// το έπιασε από τον νέο έλεγχο πλάτους: στόχος αφής 16 εικονοστοιχείων, ενώ το
// αδελφάκι του είχε ήδη πάρει τη ζώνη των 24. Κάθε διόρθωση στο ένα άφηνε το
// άλλο πίσω· δεν το έβλεπε κανείς γιατί έμοιαζαν ίδια στην οθόνη.
//
// Το `TermInfo` κρατά το όνομά του και τα δεκαοκτώ σημεία που το καλούν, αλλά
// είναι πλέον ο ίδιος `InfoHint` με άλλη ετικέτα: ένα σχήμα, μία συμπεριφορά,
// μία ζώνη αφής, μία σύνδεση με τον αναγνώστη οθόνης.
// ═══════════════════════════════════════════════════════════════════════════
//
// ΚΑΙ ΚΑΘΕ ΚΟΥΚΚΙΔΑ ΛΕΕΙ ΠΟΙΟΝ ΟΡΟ ΕΞΗΓΕΙ. Ο αναγνώστης οθόνης άκουγε επτά
// φορές «Επεξήγηση όρου» και δεν μάθαινε ποτέ ποιου.
export function TermInfo({ term, text }: { term: string; text: string }) {
  return <InfoHint label={`Τι σημαίνει: ${term}`}>{text}</InfoHint>;
}

// ── Πτυσσόμενη ενότητα (ομοιόμορφη, χωρίς μπλε πλαίσιο) ─────────────────────
// ═══════════════════════════════════════════════════════════════════════════
// ΚΟΥΜΠΙ ΜΕΣΑ ΣΕ ΚΟΥΜΠΙ: Η ΚΕΦΑΛΙΔΑ ΠΟΥ ΕΣΠΑΓΕ ΣΕ ΤΡΕΙΣ ΕΝΟΤΗΤΕΣ
// ─────────────────────────────────────────────────────────────────────────
// Η κουκκίδα επεξήγησης (`TermInfo`) αποδίδει `<button>` και καθόταν ΜΕΣΑ στο
// `<button>` που ανοίγει την ενότητα. Η HTML δεν επιτρέπει διαδραστικό στοιχείο
// μέσα σε κουμπί: ο αναλυτής του περιηγητή ΚΛΕΙΝΕΙ το εξωτερικό κουμπί μόλις
// συναντήσει το εσωτερικό. Ό,τι ερχόταν μετά —ο υπότιτλος και το βελάκι—
// έβγαινε έξω από τη σειρά και η κεφαλίδα διαβαζόταν σε τέσσερις γραμμές με
// ένα ορφανό «›» στα αριστερά. Έσπαγαν και οι τρεις ενότητες που έχουν
// επεξήγηση: Ιστορική διαδρομή, Σύγκριση με εναλλακτικές, Ανάλυση ευαισθησίας.
//
// Το κουμπί της ενότητας γίνεται στρώση από κάτω που πιάνει όλη τη σειρά· το
// εικονίδιο και το κείμενο αφήνουν το πάτημα να περάσει σε αυτό και η κουκκίδα
// μένει το μόνο στοιχείο που κρατά το δικό της. Ένα κουμπί για την ενότητα, ένα
// για την επεξήγηση, κανένα μέσα στο άλλο.
// ═══════════════════════════════════════════════════════════════════════════
export function Section({ icon, title, sub, info, children, defaultOpen = false }: { icon: React.ReactNode; title: string; sub?: string; info?: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={card}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label={title} className="acc-toggle"
          style={{ position: 'absolute', inset: 0, width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }} />
        <span style={{ position: 'relative', pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: T.radius.chip, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', flexShrink: 0 }}>{icon}</span>
        <div style={{ position: 'relative', pointerEvents: 'none', flex: 1, minWidth: 0 }}>
          <p style={titleStyle}>{title}</p>
          {sub && <p style={subStyle}>{sub}</p>}
        </div>
        {info && <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}><TermInfo term={title} text={info} /></span>}
        <ChevronRight size={17} style={{ position: 'relative', pointerEvents: 'none', color: 'var(--text-tertiary)', flexShrink: 0, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.18s' }} />
      </div>
      {open && <div style={{ marginTop: 16 }}>{children}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΤΡΙΤΟ ΠΛΑΚΙΔΙΟ ΕΦΥΓΕ ΑΠΟ ΕΔΩ
// ─────────────────────────────────────────────────────────────────────────
// Ηταν το πιο αποκλίνον από τα τρία: δική του βαθμίδα, δικό του περίγραμμα και
// δική του σκιά γραμμένα inline, ανύψωση με κατάσταση React και δύο ακροατές
// ποντικιού· και σταθερός αριθμός 24 εικονοστοιχείων που κοβόταν σε στενή
// στήλη. Η `.kpi-card` κάνει και τα τρία χωρίς JavaScript, ίδια με τις
// υπόλοιπες δεκατέσσερις καρτέλες.
//
// Το `accent` γίνεται τόνος: το χρώμα αποκαλύπτεται στο hover και στο άγγιγμα,
// από το φύλλο στυλ, με τον ίδιο κανόνα παντού. Το `info` ταξιδεύει ως κόμβος,
// γιατί το `TermInfo` ζει εδώ και το πλακίδιο στο Theme.
// ═══════════════════════════════════════════════════════════════════════════

// ── Κάρτα βαθμού απόδοσης (A–F) — μονόχρωμη· ο βαθμός, ο αριθμός και το μήκος
//    της μπάρας μεταφέρουν την ποιότητα, χωρίς περιττά χρώματα. ────────────────
export function GradeCard({ grade, note }: { grade: YieldGrade; note: string }) {
  const strong = grade.grade === 'A' || grade.grade === 'B';
  return (
    <div style={{ ...card, display: 'flex', alignItems: 'center', gap: T.sp.lg }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: T.radius.card, background: 'var(--bg-elevated)', border: `1px solid ${strong ? 'var(--border-accent)' : 'var(--border-subtle)'}`, flexShrink: 0 }}>
        <span style={{ fontSize: 28, fontWeight: 700, color: strong ? 'var(--accent)' : 'var(--text-primary)', fontFamily: SANS, lineHeight: 1 }}>{grade.grade}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontFamily: SANS, display: 'flex', alignItems: 'center' }}>Βαθμός απόδοσης<TermInfo term="Βαθμός απόδοσης" text={G.grade} /></p>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: SANS, fontVariantNumeric: 'tabular-nums' }}>{grade.label} · {grade.score} / 100</span>
        </div>
        <Bar pct={Math.max(3, grade.score)} track="var(--bg-elevated)" label="Βαθμός απόδοσης" style={{ marginTop: 8 }} />
        <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-tertiary)', fontFamily: SANS, lineHeight: 1.5 }}>{note}</p>
      </div>
    </div>
  );
}

// ── Μίνι μπάρα-γράφημα (ιστορικό / σύγκριση) ─────────────────────────────────
export function BarRow({ label, value, max, valueLabel, tone = 'neutral', hint, sub, valueSub }: { label: string; value: number; max: number; valueLabel: string; tone?: 'accent' | 'neutral' | 'muted'; hint?: string; sub?: string; valueSub?: string }) {
  const pct = max > 0 ? Math.max(2, Math.min(100, (value / max) * 100)) : 0;
  // ΕΝΑΣ ΤΟΝΟΣ ΑΝΑ ΡΟΛΟ. Η αναφορά ήταν `--border-default` και στο φωτεινό θέμα
  // χανόταν πάνω στη ράγα (κάτω από 3:1), ενώ η διπλανή της ήταν σκούρα· στο
  // σκοτεινό ίσχυε το ανάποδο. Κάθε αναφορά παίρνει τον ίδιο ορατό τόνο και το
  // ακίνητο το accent: η σύγκριση διαβάζεται από το μήκος, όχι από το χρώμα.
  const bg = tone === 'accent' ? 'var(--accent)' : 'var(--text-tertiary)';
  return (
    /* ═══ ΤΡΕΙΣ ΣΤΗΛΕΣ ΣΕ ΦΑΡΔΙΑ ΟΘΟΝΗ, ΔΥΟ ΣΕΙΡΕΣ ΣΕ ΣΤΕΝΗ ══════════════════
       Ονομα 168, ράβδος, τιμή 92 και δύο κενά των 12: μαζί 284 ΠΡΙΝ πάρει η
       ράβδος ούτε ένα εικονοστοιχείο. ΜΕΤΡΗΜΕΝΟ ΣΕ 320 (One UI με μεγάλη
       γραμματοσειρά), η κάρτα δίνει 258, οπότε κάθε μία από τις τέσσερις
       γραμμές σύγκρισης έβγαινε 26 έξω από την κάρτα και το ποσοστό, που είναι
       ΟΛΟ το νόημα της γραμμής, έπεφτε πάνω στο περίγραμμα.

       ΤΙ ΑΛΛΑΖΕΙ ΣΕ ΣΤΕΝΗ ΟΘΟΝΗ: το όνομα και το ποσοστό κρατούν τη σειρά
       τους, αριστερά και δεξιά· η ράβδος κατεβαίνει από κάτω σε ΟΛΟ το
       πλάτος. Κερδίζει και η ράβδος: από 64 εικονοστοιχεία που θα της έμεναν,
       πηγαίνει στα 258. Το πλέγμα το κάνει το globals.css· εδώ μένει η δομή.

       Ο ΛΟΓΟΣ ΠΟΥ ΤΑ ΠΛΑΤΗ ΕΙΝΑΙ ΣΤΑΘΕΡΑ ΚΑΙ ΟΧΙ `auto`: κάθε γραμμή είναι δικό
       της πλέγμα, οπότε μια στήλη `auto` θα μετρούσε ΜΟΝΟ το δικό της
       περιεχόμενο. Το «5,40%» και το «10,00%» θα έπαιρναν άλλο πλάτος και οι
       τέσσερις τιμές δεν θα στοίχιζαν μεταξύ τους.

       ΤΟ ΟΝΟΜΑ ΤΗΣ ΓΡΑΜΜΗΣ ΔΕΝ ΚΟΒΕΤΑΙ. «Μακροχρόνια στην ίδια περιοχή» γινόταν
       «Μακροχρόνια στην ίδια π…», δηλαδή ο χρήστης δεν μάθαινε με τι
       συγκρίνεται. Δύο λέξεις σε δεύτερη σειρά κοστίζουν δεκαέξι
       εικονοστοιχεία ύψους· η μισή πρόταση κοστίζει το νόημα. */
    <div className="bar-row" style={{ display: 'grid', alignItems: 'center', columnGap: 12, rowGap: 6, padding: '5px 0' }} title={hint}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: SANS, lineHeight: 1.35, minWidth: 0 }}>
        {label}
        {/* Η ΔΕΥΤΕΡΗ ΓΡΑΜΜΗ ΕΙΝΑΙ ΠΑΝΤΑ ΕΚΕΙ, ΟΧΙ ΟΠΟΥ ΤΥΧΕΙ. Το «S&P 500 (σε
            ευρώ, κεφαλαιοποιητικό)» τύλιγε σε δύο σειρές ενώ οι διπλανές έμεναν σε
            μία: η γραμμή του έβγαινε ψηλότερη και η ράβδος του σε άλλο ύψος. Το
            όνομα μένει μόνο του, η λεπτομέρεια πάει από κάτω και η ετήσια
            απόδοση κάτω από το ποσό, σε κάθε γραμμή: όλες έχουν το ίδιο σχήμα. */}
        {sub && <span style={{ display: 'block', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{sub}</span>}
      </span>
      <Bar pct={pct} tone={bg} height={8} track="var(--bg-elevated)" label={label} />
      <span style={{ textAlign: 'right', fontSize: 12, fontWeight: 600, color: tone === 'accent' ? 'var(--accent)' : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', fontFamily: SANS }}>
        {valueLabel}
        {valueSub && <span style={{ display: 'block', fontSize: 'var(--fs-xs)', fontWeight: 500, color: 'var(--text-tertiary)', marginTop: 2, whiteSpace: 'nowrap' }}>{valueSub}</span>}
      </span>
    </div>
  );
}

// ═══ Ο ΕΠΙΛΟΓΕΑΣ ΕΙΝΑΙ Ο ΚΟΙΝΟΣ ΕΠΙΛΟΓΕΑΣ ══════════════════════════════════════
// ΗΤΑΝ ΤΕΤΑΡΤΟ ΑΝΤΙΓΡΑΦΟ ΚΑΙ ΦΑΙΝΟΤΑΝ. Το `SegmentControl` των κοινών
// στοιχείων υπάρχει και το χρησιμοποιούν οι Ρυθμίσεις· εδώ ζούσε δικό του
// `Seg` με τρεις αποκλίσεις: τα τμήματα έπαιρναν πλάτος από το ΚΕΙΜΕΝΟ τους
// («10 έτη» στενό, «20 έτη» πλατύ, δηλαδή δύο επιλογές σε άνισα κουτιά), το
// επιλεγμένο γέμιζε ΣΥΜΠΑΓΕΣ γαλάζιο αντί για το ανασηκωμένο πλακίδιο που
// χρησιμοποιεί κάθε άλλος επιλογέας· και δεν δήλωνε `aria-pressed`.
//
// Ο κοινός δίνει `flex: 1` σε κάθε τμήμα: δύο επιλογές γίνονται δύο ίσα μισά,
// τρεις γίνονται τρία ίσα τρίτα, όποιο κι αν είναι το λεκτικό τους.
export const yearOpts = (...years: number[]) => years.map(y => ({ value: String(y), label: `${y} έτη` }));

/**
 * ΝΟΥΜΕΡΟ ΜΕ ΕΤΙΚΕΤΑ ΑΠΟ ΠΑΝΩ — ΜΙΑ ΦΟΡΑ, ΓΙΑ ΟΛΗ ΤΗΝ ΟΘΟΝΗ.
 *
 * Το ίδιο ζευγάρι ήταν γραμμένο οκτώ φορές μέσα στο αρχείο, με δύο διαφορετικά
 * μεγέθη (15 και 16) και τρία διαφορετικά κενά. Οκτώ αντίγραφα σημαίνει ότι
 * κάθε διόρθωση γινόταν σε ένα και ξεχνιόταν στα υπόλοιπα επτά — γι' αυτό η
 * «Ιστορική διαδρομή» είχε άλλο μέγεθος νούμερου από τα «Εργαλεία απόδοσης».
 */
// ═══════════════════════════════════════════════════════════════════════════
// ΑΚΟΜΗ ΜΙΑ ΓΡΑΜΜΗ ΣΤΟΙΧΕΙΩΝ ΠΟΥ ΕΦΥΓΕ
// ─────────────────────────────────────────────────────────────────────────
// Ετικέτα 11 με 0,4px γράμμα και νούμερο ΣΤΑΘΕΡΟ στα 16, δίπλα σε γραμμές του
// βιβλίου που κλιμακώνονται με το πλάτος και το μήκος τους. Δύο ρυθμοί στην
// ίδια οθόνη· και μια ετικέτα δύο γραμμών κατέβαζε το νούμερό της κάτω από τα
// διπλανά. Το `Stat` κρατά ένα μέγεθος ανά σειρά, από το μακρύτερο.
//
// ΚΑΙ Ο ΤΟΝΟΣ ΕΦΥΓΕ ΜΑΖΙ. Το `accent` στην «Τελική αξία» δεν έλεγε τίποτα που
// δεν λέει ο αριθμός: ήταν έμφαση χωρίς σημασία, ακριβώς αυτό που η εφαρμογή
// έβγαλε από τα πλακίδια του Δανείου. Το `negative` στην αρνητική ροή το λέει
// ήδη το πρόσημο, που είναι πιο ακριβές από ένα χρώμα.
export const Figure = ({ label, value, chars }: { label: string; value: string; chars?: number }) => (
  <Stat label={label} value={value} chars={chars} />
);

// Κάρτα μοχλού — στο hover γίνεται accent ΜΟΝΟ ο τίτλος (καθαρή, διακριτική ένδειξη).
/* ── Ο ΜΟΧΛΟΣ ΛΕΕΙ ΤΟ ΠΟΣΟ ΚΑΙ ΚΡΥΒΕΙ ΤΑ ΨΙΛΑ ────────────────────────────
   ΤΕΣΣΕΡΑ ΜΠΛΟΚ ΚΕΙΜΕΝΟΥ ΑΝΑ ΚΑΡΤΑ, ΕΠΙ ΤΕΣΣΕΡΙΣ ΚΑΡΤΕΣ. Η κάρτα έγραφε
   μονίμως ορατά: τίτλο, τη γραμμή του ποσού, ολόκληρη την παράγραφο των
   προϋποθέσεων και από κάτω το «Προσοχή». Δεκαέξι μπλοκ σε μια ενότητα που
   απαντά ΕΝΑ ερώτημα: αξίζει να το κοιτάξω;

   ΚΑΙ ΤΟ ΜΙΣΟ ΠΛΑΤΟΣ ΤΗΣ ΚΑΡΤΑΣ ΕΜΕΝΕ ΑΔΕΙΟ. Μετρημένο στον πάγκο, στη σκηνή
   roi-pro: η παράγραφος του «Άρθρου 39Β» έπιανε 552 εικονοστοιχεία μέσα σε
   κάρτα 1.350, δηλαδή άφηνε 798 κενά δεξιά της· στα 1920 άφηνε 1.126. Αιτία ένα
   όριο 74 χαρακτήρων που έμπαινε τότε σε κάθε σημείωση: σωστός κανόνας για
   σελίδα βιβλίου, λάθος σχήμα για σημείωση μέσα σε φαρδιά κάρτα.

   ΤΩΡΑ ΜΕΝΕΙ ΟΡΑΤΟ ΜΟΝΟ ΟΤΙ ΚΡΙΝΕΙ ΤΗΝ ΑΠΟΦΑΣΗ: ο τίτλος και το ποσό. Οι
   προϋποθέσεις και ο κίνδυνος μπαίνουν πίσω από το κυκλάκι, μαζί, γιατί
   διαβάζονται μαζί από όποιον αποφάσισε ότι τον ενδιαφέρει.

   ΤΙΠΟΤΑ ΔΕΝ ΥΠΟΒΑΘΜΙΖΕΤΑΙ. Το `InfoHint` γράφει το κείμενό του σε κρυφό κόμβο
   με `aria-describedby`, οπότε ο αναγνώστης οθόνης το ανακοινώνει είτε είναι
   ανοιχτό είτε όχι. Η ετικέτα του κυκλακιού ονομάζει ρητά τι κρύβει, ώστε να
   μην είναι ένα ⓘ που δεν λέει τίποτα. */
export function LeverCard({ lever }: { lever: YieldLever }) {
  const [hot, setHot] = useState(false);
  return (
    <div onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
      style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--bg-surface)', border: `1px solid ${hot ? 'var(--border-default)' : 'var(--border-subtle)'}`, transition: 'border-color 0.15s' }}>
      {/* ══ ΕΞΙ ΚΑΡΤΕΣ ΜΕ ΤΟ ΙΔΙΟ ΣΧΗΜΑ ΚΑΙ ΚΑΝΕΝΑ ΣΗΜΕΙΟ ΣΑΡΩΣΗΣ ═══════════
          Ο τίτλος ήταν έντονος και μπλε· και από κάτω μία ΕΝΤΟΝΗ πρόταση σε
          πλήρες πλάτος. Δύο έντονα μπλοκ ανά κάρτα, επί έξι κάρτες: τίποτα δεν
          ξεχώριζε, γιατί όλα ήταν εξίσου τονισμένα. Και το μέγεθος που κρίνει
          την απόφαση καθόταν μέσα στην πρόταση, σε άλλη θέση κάθε φορά.

          Τώρα κάθε κάρτα έχει τρία επίπεδα και μία ανάγνωση: το ΠΟΣΟ δεξιά,
          στην ίδια θέση σε κάθε γραμμή, ώστε τα έξι να συγκρίνονται κάθετα· ο
          τίτλος αριστερά, που λέει τι είναι· η πρόταση από κάτω σε κανονικό
          βάρος, που λέει πώς βγαίνει. Οι προϋποθέσεις και ο κίνδυνος μένουν
          πίσω από το κυκλάκι, όπως ήταν. */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
        <p style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: hot ? 'var(--accent)' : 'var(--text-primary)', margin: 0, fontFamily: SANS, transition: 'color 0.15s', minWidth: 0 }}>{lever.title}</p>
        <InfoHint label={`Προϋποθέσεις και κίνδυνος: ${lever.title}`}>
          <span style={{ display: 'block' }}>{lever.detail}</span>
          <span style={{ display: 'block', marginTop: 8 }}><strong>Προσοχή:</strong> {lever.risk}</span>
        </InfoHint>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'baseline', gap: 8, whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', fontFamily: SANS, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{lever.gain}</span>
          {/* ΤΟ ΥΨΟΣ ΔΕΝ ΕΙΝΑΙ ΣΤΟΧΟΣ ΑΦΗΣ ΑΝ ΛΕΙΠΕΙ ΤΟ ΠΛΑΤΟΣ. Εδώ μπήκε
              `minHeight` και το κουτί έμεινε 14 εικονοστοιχεία φαρδύ, όσο το
              βελάκι: ο σαρωτής το βρήκε σε πέντε κάρτες επί έξι σκηνές. Ο
              στόχος θέλει ΚΑΙ τις δύο διαστάσεις· και το εικονίδιο κεντράρεται
              μέσα του. */}
          {/* ═══ Η ΘΕΣΗ ΤΟΥ ΒΕΛΑΚΙΟΥ ΚΡΑΤΙΕΤΑΙ ΚΑΙ ΟΤΑΝ ΔΕΝ ΥΠΑΡΧΕΙ ΒΕΛΑΚΙ ══════
              ΦΩΤΟΓΡΑΦΗΘΗΚΕ: «20% λιγότερος ΕΝΦΙΑ» τελειώνει σε άλλη κατακόρυφο
              από «φόρος στο 95%», επειδή ο πρώτος μοχλός έχει πηγή και ο
              δεύτερος όχι. Ο σύνδεσμος πιάνει 44 πλάτος με −8 περιθώριο,
              δηλαδή 36 πραγματικά: όταν λείπει, η τιμή γλιστράει 36 δεξιότερα
              και οι έξι μοχλοί παύουν να συγκρίνονται με μια κατακόρυφη ματιά.

              Το κενό δεν είναι διακόσμηση, είναι ΣΤΗΛΗ. Ενα αόρατο κουτί ίδιου
              πλάτους την κρατά, ώστε κάθε τιμή να τελειώνει στο ίδιο σημείο
              ανεξάρτητα από το αν ο μοχλός παραπέμπει κάπου. Το `aria-hidden`
              το κρύβει από τον αναγνώστη οθόνης: δεν είναι πληροφορία. */}
          {lever.href
            ? <a href={lever.href} target="_blank" rel="noreferrer" aria-label={`Πηγή: ${lever.title}`} style={{ color: 'var(--text-tertiary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: T.h.md, minHeight: T.h.md, marginRight: -8 }}><ArrowUpRight size={14} /></a>
            : <span aria-hidden style={{ display: 'inline-block', minWidth: T.h.md, marginRight: -8 }} />}
        </span>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, fontFamily: SANS, lineHeight: 1.6 }}>{lever.impact}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ΚΑΙ ΤΟ ΤΕΤΑΡΤΟ ΠΛΑΚΙΔΙΟ ΕΦΥΓΕ ΑΠΟ ΕΔΩ
// ─────────────────────────────────────────────────────────────────────────
// Το `MetricTile` (IRR, ΚΠΑ, DSCR, πολλαπλασιαστής) ήταν η τέταρτη γραφή του
// ίδιου σχήματος, με πέμπτο κουτί: `.po-fig-card` αντί για `.kpi-card`, γωνία
// 12 αντί 14, περιθώριο 12/14 αντί 14/16, αριθμός σταθερά 20. Το ίδιο πράγμα,
// με τέσσερις τιμές που δεν διάλεξε κανείς.
//
// Ζει τώρα ως `Tile` με `nested`: μέσα σε κάρτα που έχει ήδη περίγραμμα, το
// βάθος το δίνει η σκιά και όχι δεύτερη κορνίζα. Ο τόνος `negative` κρατά τη
// συμπεριφορά του `po-fig` — ουδέτερος αριθμός, χρώμα μόνο στο άγγιγμα.
// ═══════════════════════════════════════════════════════════════════════════

// ΤΟ ΣΤΑΘΕΡΟ ΜΕΓΙΣΤΟ ΣΤΗΛΗΣ ΕΚΟΒΕ ΤΟ ΤΕΤΑΡΤΟ ΠΕΔΙΟ ΚΑΤΩ. Τρία πάνω, ένα από
// κάτω μόνο του και μισή κάρτα άδεια δεξιά. Τα τέσσερα στοιχεία είναι ΕΝΑ
// ερώτημα — τι αξίζει, τι αποδίδει, τι κοστίζει, πού είναι — και διαβάζονται
// σε μία ευθεία.
/**
 * Οι σειρές των τεσσάρων. ΔΥΟ, ΟΧΙ ΜΙΑ.
 *
 * Το ίδιο `g4` σέρβιρε και τα πεδία εισόδου και τα πλακίδια KPI και η
 * στοίχιση που θέλει το ένα είναι λάθος για το άλλο:
 *
 *   ΠΕΔΙΟ έχει ετικέτα ΠΑΝΩ από το κουτί του. Στοίχιση στο κάτω άκρο, ώστε μια
 *   ετικέτα δύο γραμμών να μη σπρώχνει το πεδίο της πιο χαμηλά από τα διπλανά.
 *
 *   ΚΑΡΤΑ ΕΙΝΑΙ η ίδια το κουτί, με περίγραμμα και σκιά. Στοίχιση στο κάτω
 *   άκρο σημαίνει ότι η ψηλότερη κάρτα προεξέχει προς τα ΠΑΝΩ: τέσσερα κουτιά
 *   που αρχίζουν σε τρία διαφορετικά ύψη διαβάζονται ως λάθος, γιατί είναι.
 *   Ο «Τυπική βραχυχρόνια απόδοση» τυλιγόταν σε δύο γραμμές και η κάρτα του
 *   ξεχώριζε από τις άλλες τρεις.
 *
 * Η στοίχιση διορθώνει το σύμπτωμα ΚΑΙ ΟΤΑΝ η ετικέτα τυλιχτεί έτσι κι αλλιώς
 * — με τη ρύθμιση «μεγαλύτερο κείμενο», σε στενή οθόνη, σε μεγάλο zoom. Την
 * αιτία τη διόρθωσε η ίδια η ετικέτα: η λέξη «απόδοση» υπήρχε και στις
 * τέσσερις κάρτες μιας σειράς που ΟΛΗ μιλά για αποδόσεις, δηλαδή λεγόταν
 * τέσσερις φορές χωρίς να προσθέτει τίποτα την τέταρτη.
 */
export const g4 = fixedCols(4, 12);
// `fc-xs-2`: τέσσερα ποσοστά στο τηλέφωνο χωράνε δύο ανά σειρά, όπως οι δείκτες
// της Βραχυχρόνιας· μία στήλη τα άπλωνε σε ολόκληρη οθόνη.
export const g4box = fixedCols(4, 12, 'stretch', 'fc-xs-2');

// ── Διακόπτης παραδοχής (ναι/όχι), με το κείμενο του κανόνα από κάτω ─────────
// ═══ ΔΕΥΤΕΡΟΣ ΔΙΑΚΟΠΤΗΣ ΓΙΑ ΤΗΝ ΙΔΙΑ ΔΟΥΛΕΙΑ ═══════════════════════════════
//
// Εδώ ζούσε δικό του χειριστήριο: γυμνό `input type="checkbox"` 15×15. Δύο
// προβλήματα και κανένα δεν είναι στιλιστικό.
//
// ΤΟ ΙΔΙΟ ΕΡΩΤΗΜΑ, ΑΛΛΟ ΣΧΗΜΑ. Το «εισπράττονται μέσω τράπεζας» είναι διακόπτης
// ναι/όχι, ακριβώς όπως οι δεκάδες άλλοι της εφαρμογής — που είναι ελατήρια. Ο
// χρήστης μάθαινε δύο σχήματα για το ίδιο νόημα και το ένα εμφανιζόταν σε μία
// μόνο οθόνη.
//
// ΚΑΙ ΣΤΟΧΟΣ ΑΦΗΣ 15 ΕΙΚΟΝΟΣΤΟΙΧΕΙΩΝ, όταν το ελάχιστο αξιόπιστο με δάχτυλο
// είναι 44. Το κοινό `Toggle` δίνει 44 χωρίς να μεγαλώσει η εικόνα.
//
// Η ΠΕΡΙΓΡΑΦΗ ΜΕΝΕΙ, γιατί εδώ ο διακόπτης αλλάζει ΦΟΡΟ: χωρίς την επεξήγηση
// του κανόνα, ο χρήστης πατά κάτι που μετακινεί νούμερα και δεν ξέρει γιατί.
// Η εσοχή είναι το πλάτος του διακόπτη συν το κενό του, ΔΙΑΒΑΣΜΕΝΑ από το
// TOGGLE: ήταν καρφωμένα 48 (36 + 12) από όταν ο διακόπτης είχε πλάτος 36 και
// μετά που μεγάλωσε στα 52 η σημείωση ξεκινούσε 16px αριστερότερα από την
// ετικέτα της (φωτογραφημένο, 26.09.2026).
export function Toggle({ checked, onChange, label, note }: { checked: boolean; onChange: (v: boolean) => void; label: string; note: string }) {
  return (
    <div>
      <Switch on={checked} onChange={onChange} label={label} />
      {/* ΜΑΚΡΙΑ ΓΡΑΜΜΗ, ΠΕΡΙΣΣΟΤΕΡΟΣ ΑΕΡΑΣ. Χωρίς όριο πλάτους η σημείωση πιάνει
          όλη την κάρτα και φτάνει τους 103 χαρακτήρες ανά γραμμή στα 820: το
          1,5 του ύψους γραμμής άφηνε το μάτι να χάνει τη σειρά στην επιστροφή. */}
      <p style={{ margin: `4px 0 0 ${TOGGLE.w + 12}px`, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: SANS, lineHeight: 1.7 }}>{note}</p>
    </div>
  );
}
