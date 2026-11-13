'use client';

// ═══════════════════════════════════════════════════════════════════════════
// StartPanel — «Από πού ξεκινάς», στην κορυφή της αρχικής, όσο κρατά η δοκιμή
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΔΕΙΧΝΕΙ ΚΑΙ ΤΙ ΟΧΙ. Τρία βήματα, οι ημέρες που απομένουν και οι πόρτες:
// το παράδειγμα (χωρίς ακίνητο) και η σύντομη περιήγηση. Η Νόα έχει το δικό
// της κουμπί σε κάθε οθόνη. Καμία διαφήμιση πακέτου, κανένα «αναβάθμισε τώρα»:
// η συνδρομή ζει στον «Λογαριασμό».
//
// ΓΙΑΤΙ ΔΕΝ ΕΙΝΑΙ Card. Το `Card` είναι δοχείο περιεχομένου μέσα στη σελίδα·
// αυτό είναι η κορυφή της σελίδας και πρέπει να διαβάζεται ως πλαίσιο, όχι ως
// άλλη μια κάρτα ανάμεσα σε επτά. Κρατά τα ίδια tokens (ίδια ακτίνα, ίδιο
// περίγραμμα, ίδια ανύψωση) αλλά με τον τόνο του accent στο περίγραμμα.
//
// Η ΛΟΓΙΚΗ ΔΕΝ ΕΙΝΑΙ ΕΔΩ. Ποια βήματα, ποια κλειστά, πότε φεύγει ο πίνακας:
// lib/home/start.ts, με δικές του δοκιμές. Εδώ μένει μόνο η απόδοση.
// ═══════════════════════════════════════════════════════════════════════════

import { T, TT, Btn, IconBtn } from '@/components/Theme';
import { daysLabel, stepsLabel, type StartPanelState } from '@/lib/home/start';
import { useBillingWords } from './useBillingWords';

/** «Έγιναν 2 από τα 3 βήματα.» — για τον αναγνώστη οθόνης. */
const doneLine = (done: number, total: number): string =>
  `${done === 1 ? 'Έγινε' : 'Έγιναν'} ${done} από τα ${total} βήματα.`;

const Tick = ({ state }: { state: 'done' | 'now' | 'todo' }) => {
  if (state === 'done') return (
    <span aria-hidden style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--accent)', color: 'var(--accent-text)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
      <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
    </span>
  );
  return (
    <span aria-hidden style={{
      width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 2, boxSizing: 'border-box',
      border: `2px solid ${state === 'now' ? 'var(--accent)' : 'var(--border-default)'}`,
      background: state === 'now' ? 'var(--accent-soft)' : 'transparent',
    }} />
  );
};

export default function StartPanel({ state, collapsed, onToggle, onNavigate, onPreview, onTour }: {
  state: StartPanelState;
  collapsed: boolean;
  onToggle: (next: boolean) => void;
  onNavigate: (tab: string) => void;
  onPreview: () => void;
  /** Η σύντομη περιήγηση, όσο δεν έχει γίνει και υπάρχει ακίνητο να δείξει. */
  onTour?: () => void;
}) {
  // Η γραμμή της δοκιμής, στις λέξεις του lib/legal/billingWords.ts. Χωρίς
  // απάντηση του διακομιστή δεν λέγεται τίποτα για τη δοκιμή.
  const words = useBillingWords();
  if (!state.visible) return null;
  const days = Math.max(0, Math.round(state.daysLeft));
  const trialLine = words?.trialLine ? (days === 1 ? words.trialLine.one : words.trialLine.many).replace('{n}', String(days)) : null;

  const shell: React.CSSProperties = {
    border: '1px solid var(--accent-border)', borderRadius: T.radius.card,
    background: 'var(--surface-raised)', boxShadow: 'var(--highlight-inset), var(--elev-1)',
    marginBottom: T.sp.lg,
    // Η εσωτερική ακτίνα της κλίμακας, για την επιφάνεια του ενεργού βήματος (`.sp-row`).
    ['--radius-inner' as string]: `${T.radius.inner}px`,
  };

  // ── ΣΥΜΠΤΥΓΜΕΝΟΣ ────────────────────────────────────────────────────────
  // Μία γραμμή, με τα δύο μεγέθη που ενδιαφέρουν: πόσα μένουν και πόσος καιρός.
  if (collapsed) return (
    <div style={{ ...shell, display: 'flex', alignItems: 'center', gap: T.sp.md, padding: '12px 16px', flexWrap: 'wrap' }}>
      <span style={{ ...TT.bodySm, color: 'var(--text-primary)', fontWeight: 700 }}>Από πού ξεκινάς</span>
      <span style={{ ...TT.caption, flex: 1, minWidth: 0 }}>
        {stepsLabel(state.open)}, απομένουν <span style={{ fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums' }}>{daysLabel(state.daysLeft)}</span>
      </span>
      <Btn variant="ghost" onClick={() => onToggle(false)}>Άνοιγμα</Btn>
    </div>
  );

  return (
    <div style={{ ...shell, padding: '18px 20px 16px' }}>
      {/* ΤΟ ΜΕΓΑΛΥΤΕΡΟ ΝΟΥΜΕΡΟ ΤΗΣ ΟΘΟΝΗΣ ΗΤΑΝ ΟΙ ΗΜΕΡΕΣ ΤΗΣ ΔΟΚΙΜΗΣ. Τώρα μία
          ήσυχη γραμμή κάτω από τον τίτλο· το μεγάλο νούμερο ανήκει στον φόρο
          του χρήστη, λίγο πιο κάτω (OverviewTab). */}
      {/* Η ΣΥΜΠΤΥΞΗ ΣΤΗΝ ΚΕΦΑΛΙΔΑ, ΩΣ ΕΙΚΟΝΙΔΙΟ (κριτική σχεδίασης r2). Ηταν
          λεκτικό στο υποσέλιδο δίπλα σε δύο πόρτες· στο τηλέφωνο έπεφτε κάτω από
          το κουμπί της Νόας. Τώρα ένα ήσυχο βέλος στη δεξιά άκρη του τίτλου: ο
          στόχος αφής είναι το κουτί του `IconBtn`, το αρνητικό περιθώριο
          κρατά τη γραμμή στο ύψος του τίτλου. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: T.sp.md }}>
        <div style={{ ...TT.h2 }}>Από πού ξεκινάς</div>
        <IconBtn label="Σύμπτυξη" size="md" expanded onClick={() => onToggle(true)} style={{ margin: '-8px -8px -8px 0' }}>
          <svg aria-hidden="true" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6" /></svg>
        </IconBtn>
      </div>
      {trialLine && <div style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.4, color: 'var(--text-tertiary)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{trialLine}</div>}

      {/* Το τσεκάρισμα ακούγεται κιόλας: τα βήματα ξαναμετρώνται όταν ο χρήστης
          γυρίζει στην Επισκόπηση (useDashboard, `refreshStartSignals`). */}
      <p role="status" className="sr-only">{doneLine(state.steps.length - state.open, state.steps.length)}</p>
      <ul style={{ listStyle: 'none', margin: '16px 0 0', padding: 0 }}>
        {state.steps.map((s, i) => {
          // ΜΟΝΟ ΕΝΑ ΒΗΜΑ ΕΙΝΑΙ «ΤΩΡΑ»: το πρώτο ανοιχτό. Δύο ταυτόχρονα
          // τονισμένα βήματα δεν είναι ιεραρχία, είναι δύο κουμπιά που
          // διεκδικούν το ίδιο κλικ.
          const isNow = !s.done && state.steps.slice(0, i).every(p => p.done);
            // ΤΟ ΕΠΟΜΕΝΟ ΒΗΜΑ ΦΑΙΝΕΤΑΙ ΟΤΙ ΕΙΝΑΙ ΤΟ ΕΠΟΜΕΝΟ. Ο κύκλος του ήταν η
            // μόνη διαφορά από τα υπόλοιπα: 18 εικονοστοιχεία περίγραμμα σε
            // άλλο χρώμα, μέσα σε λίστα με ίδιο βάρος παντού. Η λίστα ξεκινά
            // την περιήγηση ενός καινούργιου χρήστη και δεν έδειχνε πού να
            // πατήσει. Τώρα το ενεργό βήμα παίρνει ράγα, απαλή επιφάνεια και
            // κουμπί με περίγραμμα. Τα υπόλοιπα μένουν ήσυχα: μία έμφαση, μία φορά.
            //
            // ΜΙΑ ΕΥΘΕΙΑ ΔΕΞΙΑ, ΜΙΑ ΑΡΙΣΤΕΡΑ (κριτική σχεδίασης r2). Οι γραμμές
            // απλώνουν 12 έξω από το περιεχόμενο (για την απαλή επιφάνεια του
            // ενεργού βήματος) και η διαχωριστική έπεφτε μαζί τους 12 πιο φαρδιά
            // από τον τίτλο και το υποσέλιδο. Τώρα τη ζωγραφίζει το `.sp-row`
            // στο πλάτος του περιεχομένου. Και τα ήσυχα κουμπιά τραβιούνται δεξιά
            // όσο το γέμισμά τους, ώστε το λεκτικό τους να τελειώνει στην ίδια
            // ευθεία με το περίγραμμα του ενεργού.
            return (
            <li key={s.key} className="sp-row" data-now={isNow ? '' : undefined} data-first={i === 0 ? '' : undefined}>
              {isNow && <span aria-hidden className="sp-row-bar" />}
              <Tick state={s.done ? 'done' : isNow ? 'now' : 'todo'} />
              <div className="sp-text" style={{ flex: 1, minWidth: 0 }}>
                {/* ΤΟ ΤΕΛΕΙΩΜΕΝΟ ΒΗΜΑ ΔΕΝ ΔΙΑΓΡΑΦΕΤΑΙ: τριτεύον γκρι και το γεμάτο
                    σημάδι αρκούν. Η γραμμή από πάνω του ήταν θόρυβος. */}
                <div style={{ ...TT.bodySm, color: s.done ? 'var(--text-tertiary)' : 'var(--text-primary)', fontWeight: s.done ? 500 : 700 }}>{s.title}</div>
                {!s.done && <div style={{ ...TT.caption, marginTop: 2 }}>{s.hint}</div>}
              </div>
              {/* ΕΝΑ ΚΟΥΜΠΙ, ΔΥΟ ΟΨΕΙΣ. Το ενεργό βήμα το περιγράφει, τα υπόλοιπα
                  το αφήνουν ήσυχο. ΚΑΝΕΝΑ ΓΕΜΑΤΟ ΕΔΩ (κριτική σχεδίασης r2): το
                  γεμάτο κουμπί της οθόνης είναι η «Σάρωση» της πλαϊνής μπάρας ή,
                  χωρίς αυτήν, της κορυφής. Το ενεργό βήμα έχει ήδη ράγα, τόνο και
                  κύκλο· ένα τρίτο γεμάτο κουμπί διεκδικούσε το ίδιο βλέμμα. */}
              {!s.done && !s.blocked && (
                // ΤΟ flexShrink ΖΕΙ ΣΤΟ ΔΟΧΕΙΟ. Το κείμενο δίπλα έχει `flex: 1`, δηλαδή
                // βάση μηδέν: σε στενή οθόνη όλη η συρρίκνωση θα έπεφτε στο κουμπί.
                // ΤΟ ΡΗΜΑ ΛΕΕΙ ΤΙ ΘΑ ΓΙΝΕΙ («Σάρωση», «Σύνδεση»), όχι ένα κοινό
                // «Άνοιγμα» που δεν έλεγε τίποτα για κανένα βήμα.
                <div className="sp-cta" data-ghost={isNow ? undefined : ''}>
                  <Btn variant={isNow ? 'secondary' : 'ghost'} onClick={() => onNavigate(s.nav)}>{s.cta}</Btn>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* ΤΟ ΥΠΟΣΕΛΙΔΟ ΚΡΑΤΑ ΜΟΝΟ ΤΙΣ ΠΟΡΤΕΣ, ΑΡΙΣΤΕΡΑ (κριτική σχεδίασης r2). Το
          «Ρώτα τη Νόα» έφυγε: το ίδιο κουμπί πλέει ήδη σε κάθε πλάτος και στο
          τηλέφωνο το σκέπαζε. Η σύμπτυξη ανέβηκε στην κεφαλίδα. Ο,τι μένει
          στέκει αριστερά, μακριά από τη λωρίδα του κουμπιού της Νόας. */}
      {(!state.hasProperty || onTour) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: T.sp.sm, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
          {/* ΤΟ ΠΑΡΑΔΕΙΓΜΑ ΦΕΥΓΕΙ ΜΟΛΙΣ ΥΠΑΡΧΕΙ ΑΛΗΘΙΝΟ ΑΚΙΝΗΤΟ. Ο χρήστης βλέπει πια
              τα δικά του ποσά· ένα φανταστικό ακίνητο δίπλα τους μπερδεύει. */}
          {!state.hasProperty && <Btn variant="secondary" onClick={onPreview}>Δες ένα παράδειγμα</Btn>}
          {onTour && <Btn variant="secondary" onClick={onTour}>Σύντομη περιήγηση</Btn>}
        </div>
      )}
      {!state.hasProperty && (
        <div style={{ ...TT.caption, marginTop: 10 }}>
          Το παράδειγμα είναι ένα ακίνητο με μία ολόκληρη χρονιά στο PROPERWISE, για να δεις τι κάνει η εφαρμογή.
        </div>
      )}
    </div>
  );
}
