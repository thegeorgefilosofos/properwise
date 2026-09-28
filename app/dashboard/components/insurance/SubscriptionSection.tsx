'use client'
// ═══════════════════════════════════════════════════════════════════════════
// Η ΕΝΟΤΗΤΑ ΤΗΣ ΣΥΝΔΡΟΜΗΣ: ΠΑΡΟΧΟΣ, ΧΩΡΑ, ΔΙΑΜΟΙΡΑΣΜΟΣ ΚΑΙ ΠΟΣΟ
// ═══════════════════════════════════════════════════════════════════════════
import { NumberInput, CustomSelect, DatePicker } from '../UIComponents'
import { T, TT, fe, fieldRow, SecHdr, ABSENT_SHORT } from '@/components/Theme'
// Ο κατάλογος συνδρομών ζει στο lib: τον διαβάζει και ο Προϋπολογισμός.
import {
  SUB_INCLUDES, planMonthly, entryPlan, planNote, subShare, type SubService,
} from '@/lib/expenses/subscriptions'
import { DEFAULT_EXPENSE_PCT, expensePct, type BookableEntry } from '@/lib/expenses/subscriptionBooking'
import { EU_MEMBER_STATES, supplyOf, supplyLabel, supplyNote } from '@/lib/tax/placeOfSupply'

// ═══════════════════════════════════════════════════════════════════════════
// ΕΝΑΣ ΕΠΙΛΟΓΕΑΣ ΣΥΝΔΡΟΜΩΝ, ΓΙΑ ΟΛΕΣ ΤΙΣ ΣΥΝΔΡΟΜΕΣ
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΕΚΑΝΕ Η ΟΘΟΝΗ ΑΦΟΡΗΤΗ. Η φόρμα επεξεργασίας ζούσε ΜΕΣΑ στο κελί του
// επιλογέα. Σε πλέγμα, όλα τα κελιά μιας σειράς παίρνουν το ύψος του ψηλότερου:
// μόλις ο χρήστης άνοιγε μία συνδρομή, το κελί της φούσκωνε στα εξακόσια
// εικονοστοιχεία και οι τέσσερις διπλανές γίνονταν γιγάντια ΑΔΕΙΑ γκρίζα
// κουτιά. Μία επιλογή, μισή οθόνη κενό.
//
// Και μέσα σε κάθε κελί στριμώχνονταν: κουκκίδα-διακόπτης, όνομα, σύνδεσμος
// «Επίσημη σελίδα», κουμπί «✕», ετικέτα «+ Προσθήκη», επιλογέας πακέτου με
// κομμένο κείμενο («Βασικό, 8,…»), διακόπτης διαμοιρασμού, πεδίο αριθμού
// ατόμων, τιμή, ημερομηνία και ξανά το ποσό. Δώδεκα χειριστήρια σε πλάτος
// 150 εικονοστοιχείων, εννέα φορές στη σειρά.
//
// Η ΔΟΜΗ ΠΟΥ ΤΟ ΛΥΝΕΙ ΕΙΝΑΙ Η ΠΡΟΦΑΝΗΣ: ο επιλογέας διαλέγει, ο επεξεργαστής
// επεξεργάζεται και είναι δύο διαφορετικά πράγματα σε δύο διαφορετικά σημεία.
//
//   επάνω   πλακίδια ίδιου ύψους, ένα κλικ ανάβει ή σβήνει. Τίποτα άλλο.
//   κάτω    μία γραμμή ΑΝΑ ΕΝΕΡΓΗ συνδρομή, όλες στοιχισμένες στο ίδιο πλέγμα.
//
// ΤΙ ΣΒΗΣΤΗΚΕ. Το «+ Προσθήκη» σε κάθε ανενεργό πλακίδιο (το πλακίδιο ΕΙΝΑΙ το
// κουμπί), το «✕» σε κάθε ενεργό (το ίδιο πλακίδιο σβήνει), ο σύνδεσμος
// «Επίσημη σελίδα» σε κάθε κάρτα (κανείς δεν μπαίνει στη διαχείριση δαπανών
// για να επισκεφθεί το Netflix) και η ετικέτα «Μηνιαίο κόστος» που
// επαναλαμβανόταν σε κάθε ανοιχτή κάρτα ενώ η στήλη έχει ήδη επικεφαλίδα.
//
// Ο διαμοιρασμός ήταν ΔΥΟ χειριστήρια, διακόπτης και αριθμός ατόμων. Έγινε
// ένας επιλογέας που λέει την απάντηση με λέξεις: «Μόνος μου», «2 άτομα».
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ΟΙ ΕΠΙΛΟΓΕΣ ΧΩΡΑΣ ΤΟΥ ΠΑΡΟΧΟΥ.
 *
 * Τα είκοσι επτά κράτη μέλη ονομαστικά και ΜΙΑ γραμμή για όλες τις υπόλοιπες.
 * Δεν χρειάζεται να ξέρουμε αν ο πάροχος είναι στις Ηνωμένες Πολιτείες ή στην
 * Ελβετία: λογιστικά είναι το ίδιο πράγμα, λήψη από τρίτη χώρα. Ένας κατάλογος
 * με διακόσιες χώρες θα ζητούσε από τον χρήστη ακρίβεια που δεν αλλάζει τίποτα.
 *
 * Το «ZZ» δεν είναι χώρα, είναι ο κωδικός «εκτός Ένωσης»: το ISO 3166-1 κρατά
 * το εύρος ZZ για ιδιωτική χρήση ακριβώς γι' αυτό.
 */
const COUNTRY_OPTIONS = [
  { value: '', label: 'Δεν έχει δηλωθεί' },
  ...EU_MEMBER_STATES.map(c => ({ value: c.code, label: c.name })),
  { value: 'ZZ', label: 'Εκτός Ευρωπαϊκής Ένωσης' },
];

const SPLIT_OPTIONS = [
  { value: '1', label: 'Μόνος μου' },
  ...[2, 3, 4, 5, 6].map(n => ({ value: String(n), label: `${n} άτομα` })),
];



export function SubscriptionSection({ label, catalog, active, onToggle, onUpdate, total, business }: {
  label: string;
  catalog: readonly SubService[];
  active: BookableEntry[];
  onToggle: (svc: string) => void;
  onUpdate: <K extends keyof BookableEntry>(svc: string, field: K, val: BookableEntry[K]) => void;
  total: number;
  /**
   * Η ΧΩΡΑ ΤΟΥ ΠΑΡΟΧΟΥ ΡΩΤΙΕΤΑΙ ΜΟΝΟ ΟΠΟΥ ΕΧΕΙ ΝΟΗΜΑ. Για ιδιώτη ιδιοκτήτη ο
   * πάροχος χρεώνει ελληνικό ΦΠΑ και τελείωσε: δεν υπάρχει αντίστροφη χρέωση,
   * δεν υπάρχει ανακεφαλαιωτικός πίνακας και μια ερώτηση «σε ποια χώρα είναι
   * το Netflix;» θα ήταν καθαρός θόρυβος. Η υποχρέωση γεννιέται από την ιδιότητα
   * του ΛΗΠΤΗ (ν. 2859/2000, άρθρο 14 §2 περ. α΄), οπότε και η ερώτηση.
   */
  business: boolean;
}) {
  // ΓΕΜΑΤΕΣ ΣΕΙΡΕΣ, ΟΠΟΙΟ ΚΙ ΑΝ ΕΙΝΑΙ ΤΟ ΜΕΓΕΘΟΣ ΤΟΥ ΚΑΤΑΛΟΓΟΥ. Διαλέγεται το
  // ΜΕΓΑΛΥΤΕΡΟ πλήθος στηλών που χωρίζει ακριβώς τον κατάλογο: δέκα υπηρεσίες
  // γίνονται πέντε και πέντε, οκτώ τέσσερα και τέσσερα, έξι τρία και τρία.
  //
  // ΟΤΑΝ ΚΑΝΕΝΑ ΔΕΝ ΧΩΡΙΖΕΙ ΑΚΡΙΒΩΣ, ΔΕΝ ΠΕΦΤΟΥΜΕ ΣΤΟ ΠΕΝΤΕ. Με έντεκα
  // υπηρεσίες το πέντε άφηνε τελευταία σειρά με ΕΝΑ πλακίδιο και τέσσερα κενά·
  // το τέσσερα αφήνει ένα κενό. Διαλέγεται αυτό που αδειάζει τα λιγότερα και
  // σε ισοπαλία το φαρδύτερο — γιατί λιγότερες σειρές διαβάζονται πιο γρήγορα.
  const tileCols = [5, 4, 3]
    .map(n => ({ n, empty: (n - (catalog.length % n)) % n }))
    .sort((a, b) => a.empty - b.empty || b.n - a.n)[0].n;
  const isOn = (v: string) => active.some(a => a.service === v);
  return (
    /* Το `containerType` δίνει στα σπασίματα του `.tile-grid` κάτι να μετρήσουν:
       το πλάτος ΑΥΤΗΣ της κάρτας, όχι του παραθύρου. Βλ. app/globals.css. */
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.card, padding: 20, marginBottom: 16, containerType: 'inline-size' }}>
      <SecHdr label={label} sub={active.length === 0 ? 'Πάτησε ό,τι έχεις. Τα υπόλοιπα μένουν σβηστά.' : undefined}
        right={total > 0 ? <span style={{ ...TT.kpi, fontSize: 18 }}>{fe(total)}</span> : undefined}/>

      {/* ΤΟ ΠΛΑΚΙΔΙΟ ΕΙΝΑΙ ΠΕΔΙΟ ΤΗΣ ΦΟΡΜΑΣ, ΚΑΙ ΤΩΡΑ ΤΟ ΔΕΙΧΝΕΙ.
          Ίδιο ύψος, ίδια γωνία, ίδιο περιθώριο και ίδιο μέγεθος γραμμάτων με
          τον επιλογέα «Πάροχος» δίπλα του — ένα σχήμα σε όλη την εφαρμογή.

          ΤΟ ΚΕΙΜΕΝΟ ΗΤΑΝ ΨΗΛΑ ΜΕΣΑ ΣΤΟ ΚΟΥΤΙ. Η στοίχιση ήταν στη γραμμή βάσης
          (`baseline`): με δύο διαφορετικά μεγέθη γραμμάτων, το flex κρεμούσε
          ολόκληρη τη γραμμή από την κορυφή. Μετρήθηκε: σε κουτί 44 εικονοστοιχείων
          το κέντρο του ονόματος έπεφτε στο 28 αντί για το 42, δηλαδή δεκατέσσερα
          πιο ψηλά. Με `center` το όνομα και το ποσό κάθονται στον άξονα του
          κουτιού, ακριβώς όπως το κείμενο κάθε πεδίου.

          ΙΔΙΟ ΜΕΓΕΘΟΣ ΣΤΑ ΔΥΟ. Το ποσό ήταν έντεκα και το όνομα δώδεκα, δηλαδή
          δύο κλίμακες στην ίδια γραμμή· η διαφορά τους λέγεται με το χρώμα.

          ΚΑΙ ΤΟ ΠΟΣΟ ΜΠΑΙΝΕΙ ΣΕ ΟΛΑ: στα ενεργά η ΠΡΑΓΜΑΤΙΚΗ τιμή που πληρώνει ο
          χρήστης, στα υπόλοιπα η τιμή εισόδου.

          Το πλήθος στηλών είναι απόφαση και όχι αποτέλεσμα, γιατί το `auto-fit`
          έδινε άλλο πλήθος σε κάθε επίπεδο zoom του περιηγητή. Το κεντράρισμα
          της τελευταίας σειράς ζει στο `.tile-grid` (app/globals.css). */}
      <div className="tile-grid" style={{ '--tg-n': tileCols } as React.CSSProperties}>
        {catalog.map(svc => {
          const entry = active.find(a => a.service === svc.value);
          const on = !!entry;
          const amount = entry ? subShare(svc, entry) : planMonthly(entryPlan(svc));
          // ΤΟ ΜΗΔΕΝ ΔΕΝ ΕΙΝΑΙ ΤΙΜΗ. Ένα «0,00€» σε πλακίδιο υπηρεσίας λέει
          // «δεν πληρώνω γι' αυτό», ενώ σημαίνει «δεν ξέρουμε ακόμη πόσο».
          const priceLabel = amount > 0 ? fe(amount) : ABSENT_SHORT;
          return (
            <button key={svc.value} type="button" onClick={() => onToggle(svc.value)} aria-pressed={on}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                width: '100%', boxSizing: 'border-box',
                textAlign: 'left', cursor: 'pointer',
                height: T.h.lg, padding: '0 14px', borderRadius: T.radius.inner,
                background: on ? 'var(--accent-soft)' : 'var(--bg-elevated)',
                border: `1px solid ${on ? 'var(--accent)' : 'var(--border-subtle)'}`,
                transition: 'background-color .15s, border-color .15s',
              }}>
              {/* Το όνομα υποχωρεί, το ποσό ποτέ: σε πολύ στενό κουτί κόβεται η
                  τελευταία συλλαβή ενός ονόματος που ο χρήστης αναγνωρίζει ήδη,
                  αντί να σπάσει η σειρά ή να κρυφτεί η τιμή. */}
              <span style={{ fontFamily: T.font.sans, fontSize: 14, letterSpacing: 0, fontWeight: on ? 600 : 400,
                color: on ? 'var(--text-primary)' : 'var(--text-secondary)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{svc.label}</span>
              <span style={{ fontFamily: T.font.num, fontSize: 14, fontVariantNumeric: 'tabular-nums',
                color: on ? 'var(--text-secondary)' : 'var(--text-tertiary)', whiteSpace: 'nowrap', flexShrink: 0 }}>{priceLabel}</span>
            </button>
          );
        })}
      </div>

      {/* ΤΟ ΔΙΠΛΟΠΛΗΡΩΜΕΝΟ, ΤΗ ΣΤΙΓΜΗ ΠΟΥ ΓΙΝΕΤΑΙ ΟΡΑΤΟ. Χωρίς χρώμα και χωρίς
          εικονίδιο κινδύνου: δεν είναι σφάλμα του χρήστη, είναι πληροφορία που
          δεν είχε. */}
      {SUB_INCLUDES.filter(r => isOn(r.holder) && isOn(r.included)).map(r => (
        <p key={`${r.holder}-${r.included}`} style={{ ...TT.caption, color: 'var(--text-secondary)', margin: '12px 0 0', lineHeight: 1.55 }}>
          {r.note}
        </p>
      ))}

      {/* Ο ΕΠΕΞΕΡΓΑΣΤΗΣ: μία γραμμή ανά ενεργή, όλες στο ίδιο πλέγμα. */}
      {active.length > 0 && (
        <div style={{ marginTop: T.sp.lg, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {active.map(a => {
            const svc = catalog.find(x => x.value === a.service);
            if (!svc) return null;
            const note = planNote(svc.plans.find(p => p.id === a.planId));
            // Ο ΤΟΠΟΣ ΠΑΡΟΧΗΣ ΓΡΑΦΕΤΑΙ ΤΗ ΣΤΙΓΜΗ ΠΟΥ ΔΗΛΩΝΕΤΑΙ Η ΧΩΡΑ, στην ίδια
            // γραμμή με την υπόλοιπη εξήγηση: μία σειρά κάτω από τα πεδία, όχι
            // δεύτερο πλαίσιο. Χωρίς χώρα δεν γράφεται τίποτα — το άγνωστο δεν
            // παριστάνει τον κανόνα.
            const supply = business ? supplyOf(a.supplierCountry) : null;
            const supplyLine = supply ? `${supplyLabel(supply)}. ${supplyNote(supply)}` : '';
            return (
              /* Ο ΤΙΤΛΟΣ ΔΕΝ ΕΙΝΑΙ ΠΕΔΙΟ, ΚΑΙ ΟΣΟ ΗΤΑΝ ΜΕΣΑ ΣΤΟ ΠΛΕΓΜΑ ΤΟ ΧΑΛΟΥΣΕ.
                 Απλωνόταν σε όλες τις στήλες (`1 / -1`) και αυτό ακριβώς εμποδίζει
                 το `auto-fit` να μαζέψει τις κενές: το πλέγμα κρατούσε οκτώ στήλες
                 επειδή τόσες χωρούσαν, τα τέσσερα πεδία έπιαναν τις τέσσερις πρώτες
                 και η μισή σειρά έμενε άδεια δεξιά. Έξω από το πλέγμα, οι τέσσερις
                 στήλες μοιράζονται ολόκληρο το πλάτος. */
              <div key={a.service} style={{ paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                  <span style={{ ...TT.h2, fontSize: 15 }}>{svc.label}</span>
                  <span style={{ ...TT.kpi, fontSize: 18 }}>{fe(subShare(svc, a))}</span>
                </div>
                <div {...fieldRow(150, 12)}>
                <CustomSelect label="Πακέτο" value={a.planId} onChange={v => onUpdate(a.service, 'planId', v)}
                  options={svc.plans.map(p => ({ value: p.id, label: p.name }))}/>
                <CustomSelect label="Μοιράζεται" value={String(a.splitActive && a.splitPeople > 1 ? a.splitPeople : 1)}
                  onChange={v => { const n = parseInt(v) || 1; onUpdate(a.service, 'splitPeople', n); onUpdate(a.service, 'splitActive', n > 1); }}
                  options={SPLIT_OPTIONS}/>
                <NumberInput label="Τιμή αν διαφέρει" value={a.customPrice} onChange={v => onUpdate(a.service, 'customPrice', v)} suffix="€"/>
                {/* Το προεπιλεγμένο «Επιλογή ημερομηνίας» τσάκιζε σε δύο γραμμές και
                    έσπαγε τη στοίχιση της σειράς. Η ετικέτα λέει ήδη «Ανανέωση»·
                    το κενό λέει ότι είναι προαιρετικό. */}
                <DatePicker label="Ανανέωση" placeholder="Προαιρετικό" value={a.renewalDate} onChange={v => onUpdate(a.service, 'renewalDate', v)}/>
                {/* ΠΟΣΟ ΑΠΟ ΤΗ ΣΥΝΔΡΟΜΗ ΕΙΝΑΙ ΔΑΠΑΝΗ. Το Microsoft 365 ενός
                    διαχειριστή είναι εργαλείο δουλειάς, το Netflix του δεν
                    είναι και τα δύο χρεώνονται στην ίδια κάρτα. Προεπιλογή
                    ολόκληρη, γιατί αυτό ισχύει στις περισσότερες. */}
                <NumberInput label="Στις δαπάνες" value={String(a.expensePct ?? DEFAULT_EXPENSE_PCT)}
                  onChange={v => onUpdate(a.service, 'expensePct', expensePct(v))} suffix="%" max={100}/>
                {business && (
                  <CustomSelect label="Χώρα παρόχου" value={a.supplierCountry || ''}
                    onChange={v => onUpdate(a.service, 'supplierCountry', v)}
                    options={COUNTRY_OPTIONS}/>
                )}
                </div>
                {(note || supplyLine) && (
                  <p style={{ ...TT.caption, color: 'var(--text-tertiary)', margin: '10px 0 0', lineHeight: 1.55 }}>
                    {[note, supplyLine].filter(Boolean).join(' ')}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
