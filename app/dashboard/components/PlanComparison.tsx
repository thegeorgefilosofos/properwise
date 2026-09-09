'use client';

// ═══════════════════════════════════════════════════════════════════════════
// PlanComparison — η «φιλόδοξη» επιφάνεια σύγκρισης πλάνων (ξεχωριστή από τη
// νηφάλια Χρέωση). Αποκαλύπτεται μέσα στη σελίδα «Λογαριασμός» όταν ο χρήστης
// πατήσει «Σύγκρινε πλάνα» / «Δες τα πλάνα». Στόχος: premium, καθαρή, ζωντανή,
// αξιόπιστη εμπειρία αναβάθμισης, στο ίδιο design system με όλη την εφαρμογή.
//
// Το «κόλπο N26»: φωτίζουμε ΜΟΝΟ τα κέρδη. Κάθε δυνατότητα που ξεκλειδώνει ένα
// ανώτερο πλάνο (και δεν την έχει το τρέχον) παίρνει διακριτική accent έμφαση,
// ώστε το «τι κερδίζεις αν αναβαθμίσεις» να ξεχωρίζει, χωρίς να φωνάζει.
// Καμία χρέωση εδώ: η σύγκριση ΔΙΑΛΕΓΕΙ πακέτο και το στέλνει στην κάρτα
// χρέωσης από κάτω, που ανοίγει το ταμείο του παρόχου πληρωμών.
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { PLANS, PLAN_ORDER, annualPerMonth, type PlanId } from '@/lib/billing/plans';
import { ASSISTANT_ACC } from '@/lib/assistant/identity';
import { isPlanAllowedForProfile } from '@/lib/billing/entitlements';
import { T, TT, Card, SecHdr, Btn, ChipToggle, Chip, feAuto, fixedCols } from '@/components/Theme';

// ── Ποια πλάνα συγκρίνονται εδώ ─────────────────────────────────────────────
// ΟΧΙ όλα. Το «Γραφείο» είναι πλάνο για χαρτοφυλάκια άνω των 40 ακινήτων και δεν
// αγοράζεται συγκρίνοντας γραμμές σε πίνακα — αγοράζεται με συνομιλία. Μπαίνοντάς
// το ως τέταρτη στήλη θα στρίμωχνε τις τρεις που ΠΡΑΓΜΑΤΙΚΑ επιλέγει ο χρήστης,
// ιδίως σε κινητό, για να διαφημίσει κάτι που αφορά ελάχιστους. Αναφέρεται με μία
// γραμμή κάτω από τον πίνακα, εκεί που ανήκει.
// ΟΙ ΣΤΗΛΕΣ ΕΙΝΑΙ ΤΑ ΠΛΑΝΑ ΠΟΥ ΜΠΟΡΕΙ ΝΑ ΑΓΟΡΑΣΕΙ ΚΑΠΟΙΟΣ — ΟΛΑ ΤΟΥΣ.
// Έλειπαν το «Ένα ακίνητο» (3,90€) και το «Γραφείο»: ο συνδρομητής του πρώτου
// άνοιγε τη σύγκριση πλάνων και δεν έβρισκε το δικό του πλάνο πουθενά.
// ═══ ΤΕΣΣΕΡΑ ΠΑΚΕΤΑ. ΤΟ «ΧΩΡΙΣ ΣΥΝΔΡΟΜΗ» ΔΕΝ ΕΙΝΑΙ ΠΑΚΕΤΟ ══════════════════
//
// Στεκόταν πρώτη στήλη στον τιμοκατάλογο, με τίτλο, ταγκλάιν, «Χωρίς χρέωση»
// και δικό της κουμπί — δηλαδή διαβαζόταν ως προσφορά. Δεν είναι: είναι η
// κατάσταση όπου ΔΕΝ έχεις πακέτο, ο σταθμός όπου κάθεται ο λογαριασμός ώσπου
// να διαλέξεις. Δωρεάν είναι μόνο η δοκιμαστική περίοδος και το λέει η
// υποδοχή, η αρχική σελίδα και οι Όροι.
//
// Μια στήλη με τιμή 0€ δίπλα σε τέσσερις με τιμή δεν είναι διαφάνεια — είναι
// πρόσκληση να μείνεις εκεί.
// ΟΙ ΣΤΗΛΕΣ ΟΡΙΖΟΝΤΑΙ ΜΙΑ ΦΟΡΑ, ΣΤΟΝ ΠΙΝΑΚΑ. Εδώ ήταν γραμμένες δεύτερη φορά,
// μαζί με ολόκληρο αντίγραφο του πίνακα των δεκαέξι γραμμών — που κανείς δεν
// ζωγράφιζε, αφού ο πίνακας μετακόμισε στο /paketa. Ενα αντίγραφο που δεν
// φαίνεται είναι χειρότερο από ένα που φαίνεται: όποιος διόρθωνε ΑΥΤΟ δεν θα
// έβλεπε καμία αλλαγή στην οθόνη και θα νόμιζε ότι διόρθωσε.
import { COMPARED } from '@/components/PlanMatrix';

// ── Μικρά εικονίδια ────────────────────────────────────────────────────────
function LockGlyph() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

// Η δωρεάν δοκιμή ΔΕΝ ανακοινώνεται εδώ. Όσο τρέχει, ανεβάζει το ενεργό πλάνο
// σε «Ιδιοκτήτης», οπότε αυτή η στήλη είναι ήδη «το τρέχον πλάνο σου» — ένα τσιπ
// «30 ημέρες δωρεάν» δεν θα εμφανιζόταν ποτέ. Η κατάσταση της δοκιμής λέγεται
// μία φορά, στο πλαίσιο των Ρυθμίσεων, με τις ημέρες που απομένουν.
export default function PlanComparison({ profileType, currentPlan, onUpgrade }: {
  profileType: 'individual' | 'professional';
  currentPlan: PlanId;
  /** Ποιο πακέτο διάλεξε. Η χρέωση από κάτω αγοράζει ΑΥΤΟ, όχι μια προεπιλογή. */
  onUpgrade?: (plan: PlanId) => void;
}) {
  // ΞΕΚΙΝΑ ΣΤΗΝ ΕΤΗΣΙΑ, ΚΑΙ ΕΙΝΑΙ ΤΙΜΙΟ ΕΠΕΙΔΗ ΦΑΙΝΟΝΤΑΙ ΚΑΙ ΤΑ ΔΥΟ ΝΟΥΜΕΡΑ.
  // Η κάρτα δείχνει το μηνιαίο ισοδύναμο ΚΑΙ το ετήσιο σύνολο δίπλα του, οπότε
  // κανείς δεν μπορεί να νομίσει ότι πληρώνει 3,58€ τον μήνα χωρίς δέσμευση
  // έτους. Χωρίς το ετήσιο σύνολο ορατό, η προεπιλογή θα ήταν παραπλάνηση.
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('annual');

  const rankOf = (id: PlanId) => PLAN_ORDER.indexOf(id);
  const curRank = rankOf(currentPlan);
  const recommended: PlanId = profileType === 'professional' ? 'agency' : 'owner';
  const lockHint = profileType === 'professional'
    ? 'Διαθέσιμο στον τρόπο «Ιδιώτης»'
    : 'Διαθέσιμο στον τρόπο «Επαγγελματίας»';

  return (
    <div>
      {/* ── 1+2. Κεφαλίδα με διακόπτη κύκλου + στήλες πλάνων ───────────────── */}
      <Card className="acc-section" style={{ animationDelay: '0ms' }}>
        <SecHdr label="Σύγκριση πακέτων" right={
          <div style={{ display: 'inline-flex', padding: 4, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.pill }}>
            {/* shape="seg" και όχι "chip": η ράγα από πάνω έχει ήδη δικό της περίγραμμα,
                οπότε δεύτερο περίγραμμα ανά πλακίδιο θα έδινε διπλή γραμμή. */}
            {(['monthly', 'annual'] as const).map(c => (
              <ChipToggle key={c} on={cycle === c} onClick={() => setCycle(c)} shape="seg">
                {c === 'monthly' ? 'Μηνιαία' : 'Ετήσια'}
              </ChipToggle>
            ))}
          </div>
        } />

        {/* ═══ Ο ΒΟΗΘΟΣ ΔΕΝ ΕΙΝΑΙ ΠΡΟΝΟΜΙΟ ΤΩΝ ΑΚΡΙΒΩΝ ΠΑΚΕΤΩΝ ═══════════════
            Η αρχική σελίδα το λέει πριν από τη σκάλα των τιμών· ο συνδρομητής
            που άνοιγε τη σύγκριση ΜΕΣΑ στην εφαρμογή δεν το ξανάβλεπε πουθενά
            και ο πίνακας από κάτω έδειχνε τον βοηθό ως μία ακόμη γραμμή. Όποιος
            κοιτούσε το φθηνότερο πακέτο έβγαζε το αντίθετο συμπέρασμα από την
            αλήθεια: ότι δεν τον έχει. Λέγεται μία φορά, πάνω από τη σκάλα,
            γιατί αφορά ΟΛΗ τη σκάλα. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '11px 14px', marginBottom: 14, borderRadius: T.radius.inner, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: T.radius.chip, background: 'var(--accent-dim)', color: 'var(--accent)', flexShrink: 0 }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-8 8H8l-5 3 1.4-4.2A8 8 0 1 1 21 12" /><path d="M8.5 12h.01M12 12h.01M15.5 12h.01" /></svg>
          </span>
          {/* Η αρχική σελίδα γράφει «ο βοηθός», γιατί ο επισκέπτης δεν ξέρει
              ακόμη το όνομα. Μέσα στην εφαρμογή το ξέρει και ο βοηθός έχει
              όνομα αντί για γένος (lib/assistant/identity.ts). */}
          <span style={{ ...TT.bodySm, color: 'var(--text-primary)', fontWeight: 700 }}>Κάθε πακέτο περιλαμβάνει {ASSISTANT_ACC}</span>
          <span style={{ ...TT.bodySm, color: 'var(--text-tertiary)' }}>Αλλάζει μόνο πόσες ερωτήσεις έχει το καθένα τον μήνα.</span>
        </div>

        {/* ΠΕΝΤΕ ΓΝΩΣΤΕΣ ΣΤΗΛΕΣ, ΟΧΙ «ΟΣΕΣ ΧΩΡΑΝΕ». Με ελάχιστο 220 το auto-fit
            έβγαζε τέσσερις κάρτες και μία μόνη της από κάτω στα συνηθισμένα
            πλάτη — δηλαδή ο τιμοκατάλογος διαβαζόταν σαν «τέσσερα πακέτα και
            κάτι άλλο». Το πλήθος είναι απόφαση, άρα γράφεται. */}
        <div {...fixedCols(COMPARED.length, 12, 'stretch')}>
          {COMPARED.map(id => {
            const p = PLANS[id];
            const isCurrent = id === currentPlan;
            const allowed = isPlanAllowedForProfile(profileType, id);
            const locked = !allowed && !isCurrent;
            const popular = !locked && !isCurrent && id === recommended;
            const colRank = rankOf(id);

            // Κάθε στήλη έχει τιμή, οπότε δεν υπάρχει «χωρίς χρέωση» να
            // ξεχωρίσει. Το ποσό περνά πάντα από τον μορφοποιητή.
            const priceMain = cycle === 'annual' ? feAuto(annualPerMonth(id)) : feAuto(p.priceMonthly);
            // ΤΟ ΚΕΡΔΟΣ ΛΕΓΕΤΑΙ ΩΣ ΚΕΡΔΟΣ, ΜΕ ΤΑ ΙΔΙΑ ΛΟΓΙΑ ΜΕ ΤΗΝ ΑΡΧΙΚΗ. Το
            // «12 μήνες στην τιμή των 11» ζητά από τον αναγνώστη να κάνει την
            // αφαίρεση για να καταλάβει τι παίρνει — και η αρχική σελίδα, δύο
            // κλικ πιο πριν, του έλεγε ήδη «1 μήνας δωρεάν». Δύο διατυπώσεις για
            // την ίδια έκπτωση, στην ίδια αγορά.
            const paidMonths = p.priceAnnual > 0 && p.priceMonthly > 0 ? Math.round(p.priceAnnual / p.priceMonthly) : 0;
            const freeMonths = paidMonths > 0 ? 12 - paidMonths : 0;

            // Ένα και μόνο «ήρωας»: η προτεινόμενη στήλη (βάθος με surface-hero).
            const heroBg = popular ? 'var(--surface-hero)' : 'var(--bg-surface)';
            const borderColor = isCurrent ? 'var(--accent)' : popular ? 'var(--accent-border)' : 'var(--border-subtle)';
            const boxShadow = popular ? 'var(--highlight-inset), var(--elev-2)' : isCurrent ? '0 0 0 3px var(--accent-dim)' : 'none';

            // ΤΟ ΚΟΥΜΠΙ ΕΛΕΓΕ Ο,ΤΙ ΚΑΙ Η ΚΟΝΚΑΡΔΑ ΤΗΣ ΙΔΙΑΣ ΚΑΡΤΑΣ. Πάνω δεξιά
            // «Το πλάνο σου» με ζωντανή τελεία και εκατόν πενήντα εικονοστοιχεία
            // πιο κάτω ένα ανενεργό κουμπί «Το τρέχον πλάνο σου». Η κονκάρδα το
            // λέει καλύτερα, γιατί είναι κατάσταση και όχι ενέργεια.
            // ═══ ΕΝΑ ΚΟΥΜΠΙ, ΚΑΙ ΜΟΝΟ ΠΡΟΣ ΤΑ ΠΑΝΩ ═══════════════════════════
            //
            // Υπήρχαν τρία λεκτικά: «Αναβάθμιση», «Υποβάθμιση» και «Διακοπή
            // συνδρομής». Τα δύο τελευταία έφυγαν, για διαφορετικό λόγο το
            // καθένα.
            //
            // Η ΥΠΟΒΑΘΜΙΣΗ δεν χρειάζεται όνομα. Ολόκληρη η κάρτα είναι ήδη
            // πατήσιμη: όποιος θέλει φθηνότερο πακέτο πατά εκείνο το πακέτο.
            // Μια ετικέτα «Υποβάθμιση» κάτω από κάθε φθηνότερη στήλη είναι μια
            // λέξη που δεν ζήτησε κανείς, τυπωμένη τρεις φορές στην ίδια σειρά.
            //
            // Η ΔΙΑΚΟΠΗ έφυγε μαζί με τη στήλη της. Δεν είναι πακέτο και ένας
            // τιμοκατάλογος δεν είναι το σημείο όπου προτείνεις στον συνδρομητή
            // να σταματήσει. Γίνεται από τις Ρυθμίσεις της χρέωσης, όπου
            // ανήκει.
            //
            // ΚΑΙ ΤΟ ΤΡΙΤΟ ΑΛΛΑΞΕ ΛΕΚΤΙΚΟ, ΓΙΑΤΙ ΕΛΕΓΕ ΚΑΤΙ ΠΟΥ ΔΕΝ ΕΚΑΝΕ.
            // ΤΟ ΚΟΥΜΠΙ ΚΟΥΒΑΛΑ ΤΗΝ ΕΠΙΛΟΓΗ. Καλούσε τον χειριστή που ΑΝΟΙΓΕΙ αυτή
            // τη σύγκριση, η οποία —για να διαβαστεί το κουμπί— είναι ήδη
            // ανοιχτή: το μόνο ορατό αποτέλεσμα ήταν κύλιση. Ύστερα έγινε «Στη
            // χρέωση», που ήταν τίμιο όσο δεν υπήρχε πληρωμή, αλλά έστελνε τον
            // χρήστη σε κάρτα που μάντευε μόνη της πακέτο. Τώρα στέλνει ΠΟΙΟ.
            // Το λεκτικό μένει κοντό: στα 360 εικονοστοιχεία η σειρά σπάει σε
            // δύο στήλες και το κουμπί έχει περίπου 124 να χωρέσει, όχι 160.
            const cta = isCurrent || locked || colRank <= curRank
              ? null
              : <Btn variant="primary" onClick={() => onUpgrade?.(id)}>Αναβάθμιση</Btn>;

            return (
              <div key={id} className={locked ? undefined : 'acc-choice'} title={locked ? lockHint : undefined}
                style={{ position: 'relative', display: 'flex', flexDirection: 'column', opacity: locked ? 0.55 : 1, background: heroBg, border: `1.5px solid ${borderColor}`, borderRadius: T.radius.card, boxShadow, padding: 18 }}>

                {/* ══ Η ΚΑΤΑΣΤΑΣΗ ΤΗΣ ΣΤΗΛΗΣ ΕΧΕΙ ΜΙΑ ΘΕΣΗ, ΚΑΙ ΕΙΝΑΙ ΑΥΤΗ ══════
                    Το «Πιο δημοφιλές» καθόταν ως κορδέλα πάνω από την κάρτα και
                    το «Το πακέτο σου» ως κονκάρδα ΜΕΣΑ στη σειρά του τίτλου. Δύο
                    γλώσσες για το ίδιο πράγμα — και η δεύτερη δεν χωρούσε:
                    «Επαγγελματίας» στα 14 έντονα, συν μετάλλιο 22, συν κονκάρδα
                    με ζωντανή τελεία, μέσα σε στήλη διακοσίων τριάντα
                    εικονοστοιχείων. Η κονκάρδα ΠΑΤΟΥΣΕ πάνω στο όνομα, γιατί
                    κανένα από τα δύο δεν είχε άδεια να συρρικνωθεί.
                    Οι τρεις καταστάσεις αποκλείουν η μία την άλλη (`popular`
                    ορίζεται ως «ούτε τρέχον ούτε κλειδωμένο»), οπότε μοιράζονται
                    την ίδια κορδέλα και η σειρά του τίτλου μένει στο όνομα. */}
                {(popular || isCurrent) && (
                  <span style={{ position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%)', display: 'inline-flex', alignItems: 'center', gap: 6, background: isCurrent ? 'var(--bg-surface)' : 'var(--accent)', color: isCurrent ? 'var(--accent)' : 'var(--accent-text)', border: isCurrent ? '1px solid var(--accent-border)' : 'none', borderRadius: T.radius.pill, padding: '2px 10px', fontSize: 'var(--fs-xs)', fontWeight: 700, fontFamily: T.font.sans, letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>
                    {isCurrent && <span className="acc-live-dot accent" style={{ width: 6, height: 6, background: 'var(--accent)' }} />}
                    {isCurrent ? 'Το πακέτο σου' : 'Πιο δημοφιλές'}
                  </span>
                )}

                {/* Όνομα + μετάλλιο. Το όνομα κόβεται με αποσιωπητικά αντί να
                    σπρώξει ό,τι έχει δίπλα του: σε στενή στήλη, ένα «…» είναι
                    πληροφορία· δύο στοιχεία το ένα πάνω στο άλλο δεν είναι. */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 22 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: T.font.sans, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  </span>
                  {locked && (
                    <span style={{ color: 'var(--text-tertiary)', display: 'inline-flex', flexShrink: 0 }}><LockGlyph /></span>
                  )}
                </div>

                {/* Ταγκλάιν πλάνου */}
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: T.font.sans, lineHeight: 1.5, marginTop: 6, minHeight: 34 }}>{p.tagline}</div>

                {/* Τιμή */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 12 }}>
                  <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', color: isCurrent ? 'var(--accent)' : 'var(--text-primary)', fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums' }}>{priceMain}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: T.font.sans }}>τον μήνα</span>
                </div>

                {cycle === 'annual' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums' }}>{feAuto(p.priceAnnual)}/χρόνο</span>
                    {freeMonths > 0 && (
                      <Chip>{freeMonths === 1 ? '1 μήνας δωρεάν' : `${freeMonths} μήνες δωρεάν`}</Chip>
                    )}
                  </div>
                )}

                {/* Το κόστος ανά ακίνητο βγαίνει από τα PLANS: όποτε αλλάξει τιμή ή
                    όριο, η γραμμή ακολουθεί χωρίς να ξεχαστεί.

                    ΚΑΙ ΑΚΟΛΟΥΘΕΙ ΤΟΝ ΚΥΚΛΟ ΠΟΥ ΒΛΕΠΕΙ Ο ΧΡΗΣΤΗΣ. Διαιρούσε πάντα
                    τη ΜΗΝΙΑΙΑ τιμή, ακόμη και στην ετήσια καρτέλα: η κάρτα έδειχνε
                    από πάνω το μηνιαίο ισοδύναμο της ετήσιας και από κάτω κόστος
                    ανά ακίνητο βγαλμένο από άλλη τιμή. Δύο νούμερα που δεν
                    διαιρούνται μεταξύ τους, στην ίδια κάρτα. */}
                {Number.isFinite(p.maxProperties) && p.maxProperties > 1 && (
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: T.font.sans, lineHeight: 1.5, marginTop: 8 }}>
                    {p.maxProperties} ακίνητα, {feAuto(Math.round(((cycle === 'annual' ? annualPerMonth(id) : p.priceMonthly) / p.maxProperties) * 100) / 100)} το καθένα τον μήνα.
                  </div>
                )}


                {/* CTA, καρφωμένο στη βάση ώστε οι στήλες να ισοϋψούνται */}
                {cta && <div style={{ marginTop: 'auto', paddingTop: 16 }}>{cta}</div>}
              </div>
            );
          })}
        </div>
      </Card>

      {/* ═══ Ο ΠΙΝΑΚΑΣ ΤΩΝ ΔΕΚΑΕΞΙ ΓΡΑΜΜΩΝ ΕΦΥΓΕ ΑΠΟ ΤΙΣ ΡΥΘΜΙΣΕΙΣ ═══════════
          Δεκαέξι γραμμές επί τέσσερις στήλες, δηλαδή εξήντα τέσσερα κελιά,
          κάθονταν μόνιμα ανοιχτά κάτω από τον τιμοκατάλογο. Ο συνδρομητής που
          μπήκε στις Ρυθμίσεις για να αλλάξει τη διεύθυνση τιμολόγησής του
          κυλούσε από πάνω τους κάθε φορά.

          Ενας πίνακας δυνατοτήτων διαβάζεται ΜΙΑ φορά στη ζωή του λογαριασμού,
          τη στιγμή που διαλέγεις πακέτο. Ζει πλέον στη δική του σελίδα, που
          ανοίγει και χωρίς λογαριασμό: την ίδια ερώτηση την κάνει και ο
          επισκέπτης, οπότε η απάντηση δεν έπρεπε να είναι κλειδωμένη. */}
      <Card className="acc-section" style={{ animationDelay: '80ms' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <span style={{ ...TT.bodySm, minWidth: 0 }}>Όλες οι δυνατότητες, γραμμή προς γραμμή.</span>
          <Btn variant="secondary" href="/paketa" newTab>
            Τι περιλαμβάνει κάθε πακέτο
          </Btn>
        </div>
      </Card>
    </div>
  );
}
