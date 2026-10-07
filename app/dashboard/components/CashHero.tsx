'use client';

// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΤΑΜΕΙΟ — η πρώτη ματιά στην αρχική οθόνη του ακινήτου.
// ─────────────────────────────────────────────────────────────────────────
// Δύο αριθμοί, ίδιο μέγεθος, δίπλα-δίπλα: «σου οφείλουν» και «οφείλεις». Είναι ο
// λόγος που ο ιδιοκτήτης ανοίγει την εφαρμογή και μέχρι τώρα δεν υπήρχε πουθενά
// — η οθόνη άνοιγε με «Μεικτή απόδοση 4,2%», νούμερο που δεν αλλάζει και δεν
// ζητά τίποτα.
//
// ΓΙΑΤΙ ΚΑΝΕΝΑ ΧΡΩΜΑ
// Το «χρωστάω 400€» ΔΕΝ είναι κακό — είναι ο ΕΝΦΙΑ και πληρώνεται. Το κόκκινο
// θα το έκανε συναγερμό δώδεκα μήνες τον χρόνο, ώσπου να πάψει να σημαίνει
// οτιδήποτε. Η ιεραρχία εδώ είναι μέγεθος, θέση και κενό: ο αριθμός μεγάλος, η
// ετικέτα μικρή από πάνω, η εξήγηση μικρή από κάτω. Οι τόνοι μπαίνουν μόνο στην
// αλληλεπίδραση (hover), όπως παντού στο υπόλοιπο app.
//
// ΤΑ ΔΥΟ ΔΕΝ ΑΘΡΟΙΖΟΝΤΑΙ. Δεν υπάρχει «καθαρή θέση»: το ενοίκιο του Ιουλίου δεν
// πληρώνει τον ΕΝΦΙΑ και ένα ακίνητο με 700€ να μπαίνουν και 700€ να βγαίνουν
// δεν είναι «στο μηδέν» — έχει δύο ανοιχτά μέτωπα.
// ═══════════════════════════════════════════════════════════════════════════

import type { ReactNode } from 'react';
import { T, fe, Btn } from '@/components/Theme';
import { cashSideNote, type CashPosition, type CashSide } from '@/lib/home/cash';
import { navLabel } from '@/lib/nav/labels';

function Side({ label, side, kind, onOpen, actionLabel, action, compact }: {
  label: string; side: CashSide; kind: 'in' | 'out';
  onOpen: () => void; actionLabel: string;
  /**
   * ΗΣΥΧΗ ΜΟΡΦΗ: ΕΤΙΚΕΤΑ ΚΑΙ ΛΕΞΕΙΣ ΣΕ ΜΙΑ ΣΕΙΡΑ. Μόνο όταν ΟΛΟ το ταμείο είναι
   * ήσυχο (βλ. `quiet` πιο κάτω): τότε η κάρτα είναι μία γραμμή.
   */
  compact?: boolean;
  /**
   * Η ΕΝΕΡΓΕΙΑ ΕΙΝΑΙ ΑΔΕΛΦΟΣ ΤΟΥ ΑΡΙΘΜΟΥ, ΟΧΙ ΠΑΙΔΙ ΤΟΥ. Ολόκληρη η πλευρά
   * ήταν ένα κουμπί που πλοηγούσε· ένα δεύτερο κουμπί μέσα του δεν είναι
   * έγκυρο HTML και δίνει δύο ενέργειες στο ίδιο πάτημα. Ο αριθμός κρατά τη
   * δική του επιφάνεια, η ενέργεια παίρνει τη δική της από κάτω.
   */
  action?: ReactNode;
}) {
  const note = cashSideNote(side, kind);
  // ΤΟ ΜΗΔΕΝ ΛΕΓΕΤΑΙ ΜΕ ΛΕΞΕΙΣ, ΣΤΗ ΘΕΣΗ ΤΟΥ ΠΟΣΟΥ. Ενα «0,00€» στα σαράντα
  // εικονοστοιχεία, δίπλα στο ποσό της άλλης πλευράς, διεκδικεί την ίδια
  // προσοχή για την απουσία είδησης. Η πλευρά κρατά την ίδια δομή με την
  // απέναντι (ετικέτα από πάνω, απάντηση από κάτω)· απλώς η απάντηση είναι φράση.
  const empty = side.count === 0;
  return (
    <div className="cash-side">
    <button
      type="button"
      onClick={onOpen}
      title={actionLabel}
      style={compact ? {
        display: 'flex', flexDirection: 'row', gap: 10, alignItems: 'center',
        width: '100%', minWidth: 0, minHeight: T.h.lg, padding: '0 18px',
        background: 'transparent', border: 'none', borderRadius: T.radius.inner,
        textAlign: 'left', cursor: 'pointer', transition: 'background 0.15s',
      } : {
        display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start',
        width: '100%', minWidth: 0, padding: action ? '18px 20px 12px' : '18px 20px',
        background: 'transparent', border: 'none', borderRadius: T.radius.inner,
        textAlign: 'left', cursor: 'pointer', transition: 'background 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{
        fontFamily: T.font.sans, fontSize: 'var(--fs-xs)', fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: 'var(--text-tertiary)',
      }}>{label}</span>
      {/* Ο αριθμός κλιμακώνεται με το πλάτος του ΠΛΑΙΣΙΟΥ (container query), ώστε
          σε στενή οθόνη να μη σπάει σε δεύτερη γραμμή ούτε να ξεχειλίζει.

          ΧΩΡΙΣ Math.round. Είχε μείνει από τότε που τα ακέραια ποσά γράφονταν
          χωρίς υποδιαστολή. Από τη στιγμή που το `fe` βάζει πάντα δύο δεκαδικά,
          το στρογγυλεμένο ποσό τυπωνόταν σαν να ήταν ακριβές: 97,45€ γινόταν
          «97,00€», ενώ η γραμμή ακριβώς από κάτω έλεγε «84,55€ ληξιπρόθεσμα».
          Δύο ασυμβίβαστα νούμερα, στο ΠΡΩΤΟ πράγμα που βλέπει ο ιδιοκτήτης. */}
      {!compact && !empty && (
        <span className="cash-figure" style={{
          fontFamily: T.font.num, fontWeight: 700, color: 'var(--text-primary)',
          fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1.05,
          maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{fe(side.total)}</span>
      )}
      <span style={{
        fontFamily: T.font.sans, fontSize: compact || empty ? 'var(--fs-md)' : 12,
        color: 'var(--text-secondary)', lineHeight: 1.45,
      }}>{note}</span>
    </button>
    {action && <div style={{ padding: '0 20px 18px' }}>{action}</div>}
    </div>
  );
}

export default function CashHero({ cash, showIncome, onNavigate, onRecordRent }: {
  cash: CashPosition;
  /**
   * Εκμισθώνεται το ακίνητο; ΣΕ ΚΕΝΟ Ή ΙΔΙΟΧΡΗΣΙΑ ΔΕΝ ΥΠΑΡΧΕΙ «ΣΟΥ ΟΦΕΙΛΟΥΝ».
   * Το «0€ · τίποτα σε καθυστέρηση» δεν είναι πληροφορία εκεί: είναι μια
   * ερώτηση που δεν τίθεται, να καταλαμβάνει τη μισή κορυφή της οθόνης. Όταν
   * λείπει, το «Οφείλεις» παίρνει όλο το πλάτος — που είναι και η αλήθεια:
   * ένα ακίνητο χωρίς έσοδο έχει μόνο κόστη.
   */
  showIncome: boolean;
  onNavigate: (tab: string) => void;
  /**
   * Η ΕΙΣΠΡΑΞΗ ΓΙΝΕΤΑΙ ΕΔΩ, ΟΧΙ ΤΡΕΙΣ ΟΘΟΝΕΣ ΠΙΟ ΠΕΡΑ. Η κάρτα ήξερε ήδη ποια
   * δόση χρωστιέται και το έλεγε με ποσό και ημέρες· η μόνη ενέργεια που
   * πρόσφερε ήταν να στείλει τον ιδιοκτήτη να την ξαναβρεί μόνος του.
   * `null` όταν καμία ληξιπρόθεσμη γραμμή δεν αντιστοιχεί σε δόση: κουμπί που
   * δεν έχει τι να γράψει δεν εμφανίζεται.
   */
  onRecordRent: (() => void) | null;
}) {
  // ═══ ΟΤΑΝ ΔΕΝ ΤΡΕΧΕΙ ΤΙΠΟΤΑ, ΤΟ ΤΑΜΕΙΟ ΕΙΝΑΙ ΜΙΑ ΓΡΑΜΜΗ ══════════════════
  //
  // Σε ακίνητο χωρίς έσοδο και χωρίς ανοιχτή οφειλή, η κορυφή της οθόνης έπιανε
  // εκατόν είκοσι εικονοστοιχεία για να πει «0,00€» και «τίποτα σε
  // εκκρεμότητα». Το μεγαλύτερο νούμερο της οθόνης ήταν το μηδέν: ένα κουτί στο
  // μέγεθος της είδησης, για την απουσία είδησης.
  //
  // Η ΑΠΟΥΣΙΑ ΝΕΩΝ ΕΙΝΑΙ ΚΑΛΗ ΕΙΔΗΣΗ ΚΑΙ ΛΕΓΕΤΑΙ ΗΣΥΧΑ. Η κάρτα δεν εξαφανίζεται
  // — μένει ο δρόμος προς τις Δαπάνες, στο ίδιο σημείο που τον έμαθε ο χρήστης —
  // αλλά συρρικνώνεται σε μία σειρά. Μόλις υπάρξει έστω μία εκκρεμότητα, ο
  // αριθμός ξαναπαίρνει το μέγεθος που του αξίζει.
  const quiet = cash.owedByMe.count === 0 && (!showIncome || cash.owedToMe.count === 0);
  if (quiet) {
    return (
      <div className="card cash-hero" style={{ padding: 0, marginBottom: 20 }}>
        <Side compact label="Ταμείο" side={cash.owedByMe} kind="out"
              actionLabel={`Άνοιγμα στις ${navLabel('finances')}`} onOpen={() => onNavigate('finances')} />
      </div>
    );
  }

  // ═══ ΔΥΟ ΠΛΕΥΡΕΣ, ΙΔΙΑ ΔΟΜΗ, ΚΑΜΙΑ ΚΕΦΑΛΙΔΑ ═════════════════════════════
  //
  // ΤΙ ΔΙΑΒΑΖΟΤΑΝ ΛΑΘΟΣ. Οταν κινούνταν μόνο η μία πλευρά, η άλλη γινόταν μία
  // σειρά («ΜΟΥ ΟΦΕΙΛΟΥΝ · Τίποτα σε καθυστέρηση») και καθόταν ΠΑΝΩ από το
  // «ΟΦΕΙΛΩ 342,00€». Η σειρά διαβαζόταν ως κεφαλίδα της κάρτας και η κάρτα ως
  // μία πρόταση που αντιφάσκει: «μου οφείλουν, τίποτα, οφείλω 342».
  //
  // ΤΩΡΑ οι δύο πλευρές έχουν πάντα την ίδια δομή (ετικέτα από πάνω, απάντηση
  // από κάτω) και την ίδια θέση: δίπλα δίπλα όταν η κάρτα έχει πλάτος, η μία
  // κάτω από την άλλη με διαχωριστή όταν δεν έχει. Ο κανόνας ζει στην
  // `.cash-sides` του globals.css και μετρά το πλάτος της ΚΑΡΤΑΣ, όχι της
  // οθόνης.
  //
  // ΚΑΙ ΜΙΛΑΝΕ ΣΤΟ «ΕΣΥ», όπως όλη η εφαρμογή. Ηταν «Μου οφείλουν» και
  // «Οφείλω»: η μόνη ετικέτα της οθόνης σε πρώτο πρόσωπο, δίπλα σε κουμπιά που
  // λένε «Σάρωσε» και «Πρόσθεσε».
  return (
    <div className="card cash-hero" style={{ padding: 0, marginBottom: 20 }}>
      <div className="cash-sides" data-pair={showIncome ? '' : undefined}>
        {showIncome && (
          <>
            <Side label="Σου οφείλουν" side={cash.owedToMe} kind="in"
                  actionLabel={`Άνοιγμα στους ${navLabel('tenant')}`} onOpen={() => onNavigate('tenant')}
                  action={onRecordRent && <Btn onClick={onRecordRent}>Μπήκε το ενοίκιο</Btn>} />
            {/* Ο διαχωριστής είναι η δήλωση ότι τα δύο ΔΕΝ αθροίζονται. */}
            <div aria-hidden className="cash-divider" />
          </>
        )}
        <Side label="Οφείλεις" side={cash.owedByMe} kind="out"
              actionLabel={`Άνοιγμα στις ${navLabel('finances')}`} onOpen={() => onNavigate('finances')} />
      </div>
    </div>
  );
}
