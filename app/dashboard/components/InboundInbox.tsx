'use client';

// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΕΙΣΕΡΧΟΜΕΝΑ: ΑΠΟ ΤΟ ΠΡΟΩΘΗΜΕΝΟ EMAIL ΣΤΗ ΔΑΠΑΝΗ, ΜΕ ΕΝΑ ΠΑΤΗΜΑ
// ─────────────────────────────────────────────────────────────────────────
// ΟΤΑΝ ΔΕΝ ΥΠΑΡΧΕΙ ΤΙΠΟΤΑ, ΔΕΝ ΥΠΑΡΧΕΙ ΤΙΠΟΤΑ. Καμία κάρτα «δεν έχεις
// εισερχόμενα», κανένα άδειο πλαίσιο. Η οθόνη των Δαπανών είναι για τις
// δαπάνες· αυτό εδώ εμφανίζεται μόνο όταν έχει κάτι να πει.
//
// ΤΟ ΠΟΣΟ ΠΟΥ ΔΕΝ ΔΙΑΒΑΣΤΗΚΕ ΖΗΤΙΕΤΑΙ, ΔΕΝ ΜΑΝΤΕΥΕΤΑΙ. Οταν το κείμενο του
// λογαριασμού δεν έλεγε καθαρά ποιο είναι το ποσό, το πεδίο είναι κενό και το
// κουμπί κλειστό μέχρι να γραφτεί. Ενα προσυμπληρωμένο μηδέν ή ένα «περίπου»
// θα ήταν λάθος αριθμός σε φορολογικά βιβλία, γραμμένος με βεβαιότητα.
//
// ΛΕΕΙ ΣΕ ΠΟΙΟ ΑΚΙΝΗΤΟ ΠΑΕΙ, ΚΑΙ ΑΦΗΝΕΙ ΝΑ ΑΛΛΑΞΕΙ. Το μήνυμα ήρθε στον
// ΛΟΓΑΡΙΑΣΜΟ, όχι σε ακίνητο: η ουρά φέρνει τα εκκρεμή ΟΛΩΝ των ακινήτων. Η
// καταχώρηση γραφόταν πάντα στο ακίνητο που ήταν ανοιχτό, χωρίς επιλογή: ο
// λογαριασμός ρεύματος του δεύτερου ακινήτου, ανοιγμένος από το πρώτο, έπεφτε
// στο λάθος ακίνητο και στη λάθος φορολογική εικόνα. Με περισσότερα από ένα
// ακίνητα, κάθε γραμμή λέει πού πάει και η φόρμα έχει επιλογή «Ακίνητο».
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import * as inbound from '@/lib/data/inbound';
import { T, TT, Card, SecHdr, Btn, fe, fieldRow } from '@/components/Theme';
import { NumberInput, DatePicker, CustomSelect } from './UIComponents';
import { expenseTitle } from '@/lib/inbound/parse';
import { CATEGORIES, BY_SLUG, resolveCategory } from '@/lib/expenses/taxonomy';
import { groupForCategory } from '@/lib/expenses/groups';
import { hintAction, hintFor, type Hint } from '@/lib/expenses/hints';
import * as hintStore from '@/lib/data/categoryHints';
import { notify, notifyError } from '@/components/Toast';
import { athensToday } from '@/lib/core/time';

interface Props {
  propertyId: string;
  userId: string;
  /** Το όνομα του ακινήτου όπου θα γραφτεί η δαπάνη. */
  propertyName?: string;
  /** Όλα τα ακίνητα του χρήστη, για την επιλογή «Ακίνητο». */
  properties?: { id: string; name: string }[];
  /** Ειδοποιεί το καθολικό ότι μπήκε γραμμή, ώστε να ξαναδιαβάσει. */
  onFiled?: () => void;
}

/** Η γραμμή όπως τη διορθώνει ο άνθρωπος πριν την καταχωρήσει. */
interface Draft { amount: string; date: string; slug: string; propertyId: string }

/** Πόση ώρα μένει ανοιχτή η αναίρεση, ίδια με τον Προϋπολογισμό. */
const UNDO_MS = 6000;

/** «10/09» για φέτος, «10/09/25» για παλιότερα: ίδιο ιδίωμα με το καθολικό. */
const dayMonth = (iso: string): string => {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y === athensToday().slice(0, 4) ? `${d}/${m}` : `${d}/${m}/${y.slice(2)}`;
};

export default function InboundInbox({ propertyId, userId, propertyName, properties = [], onFiled }: Props) {
  const supabase = createClient();
  const [rows, setRows] = useState<inbound.MessageRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [hints, setHints] = useState<Hint[]>([]);
  // ═══ ΜΙΑ ΑΝΟΙΧΤΗ ΤΗ ΦΟΡΑ. ΤΟ ΓΙΑΤΙ ΕΙΝΑΙ ΜΕΤΡΗΜΕΝΟ ══════════════════════
  // Η ουρά αποδιδόταν με `rows.map` και ΚΑΘΕ εισερχόμενο έβγαινε ως πλήρης
  // φόρμα: κατηγορία, ποσό, ημερομηνία, δύο κουμπιά. Χωρίς όριο.
  //
  // ΤΙ ΚΟΣΤΙΖΕ, ΣΤΑ 375 ΜΕ ΕΞΙ ΕΚΚΡΕΜΗ ΜΗΝΥΜΑΤΑ:
  //
  //     το πρώτο ποσό του ΧΡΗΣΤΗ εμφανιζόταν στα   3.897 px
  //     χειριστήρια που περνούσε πριν από αυτό         35
  //
  // Είναι σχεδόν πέντε οθόνες τηλεφώνου. Καμία άλλη καρτέλα δεν πλησιάζει: η
  // δεύτερη χειρότερη είναι στα 1.798 και η διάμεσος κάτω από 500. Σε καρτέλα
  // που λέγεται «Δαπάνες», ο ιδιοκτήτης ταξινομούσε το ταχυδρομείο του πριν
  // δει έστω ένα ευρώ από τα δικά του.
  //
  // ΚΑΙ ΔΕΝ ΕΙΧΕ ΤΑΒΑΝΙ. Είκοσι εκκρεμείς λογαριασμοί σημαίνουν εκατό
  // χειριστήρια στη σειρά. Το κόστος μεγαλώνει με ό,τι ΔΕΝ έχει προλάβει ο
  // χρήστης, δηλαδή χτυπά χειρότερα όποιον έχει μείνει πίσω.
  //
  // ΤΙΠΟΤΑ ΔΕΝ ΚΡΥΒΕΤΑΙ ΚΑΙ ΤΙΠΟΤΑ ΔΕΝ ΦΕΥΓΕΙ. Ολα τα μηνύματα μένουν στη
  // λίστα και με τη σειρά τους· τα κλειστά γίνονται μία γραμμή που ανοίγει με
  // ένα πάτημα. Το προσχέδιο κάθε γραμμής ζει ήδη στο `drafts` με κλειδί το
  // id, οπότε ό,τι έχει πληκτρολογηθεί δεν χάνεται όταν κλείσει.
  const [anoixto, setAnoixto] = useState<string | null>(null);

  // Η ΑΝΑΓΝΩΣΗ ΕΙΝΑΙ ΣΥΝΔΡΟΜΗ ΣΕ ΕΞΩΤΕΡΙΚΟ ΣΥΣΤΗΜΑ, ΟΧΙ ΥΠΟΛΟΓΙΣΜΟΣ: η
  // κατάσταση γράφεται μέσα στην απάντηση και ο διακόπτης `live` σταματά τη
  // γραφή αν η οθόνη έφυγε πριν απαντήσει η βάση.
  // Η ΑΝΑΙΡΕΣΗ ΞΑΝΑΔΙΑΒΑΖΕΙ ΤΗΝ ΟΥΡΑ ΑΠΟ ΤΗ ΒΑΣΗ. Το προσχέδιο όποιας γραμμής
  // υπάρχει ήδη μένει όπως το άφησε ο άνθρωπος· μόνο οι νέες παίρνουν αρχικό.
  const [reloadNonce, setReloadNonce] = useState(0);
  useEffect(() => {
    let live = true;
    inbound.pending(supabase, userId).then(({ rows: found }) => {
      if (!live) return;
      setRows(found);
      setDrafts(prev => Object.fromEntries(found.map(r => [r.id, prev[r.id] ?? {
        amount: r.amount === null ? '' : String(r.amount),
        date: r.due_date || r.issue_date || athensToday(),
        slug: resolveCategory(r.category) || '',
        propertyId,
      }])));
    });
    // ΟΙ ΚΑΝΟΝΕΣ ΤΟΥ ΙΔΙΟΚΤΗΤΗ ΔΙΑΒΑΖΟΝΤΑΙ ΓΙΑ ΔΥΟ ΛΟΓΟΥΣ: για να ξέρει η οθόνη
    // ΓΙΑΤΙ μια κατηγορία ήρθε έτσι και για να μη γραφτεί ξανά κανόνας που
    // υπάρχει ήδη. Η αποτυχία δεν έχει μήνυμα: τα εισερχόμενα δουλεύουν και
    // χωρίς αυτούς, όπως δούλευαν πάντα.
    hintStore.forUser(supabase, userId).then(({ rows: found }) => {
      if (live) setHints(hintStore.asHints(found));
    });
    return () => { live = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, reloadNonce]);

  if (!rows.length) return null;

  const patch = (id: string, part: Partial<Draft>) =>
    setDrafts(d => ({ ...d, [id]: { ...d[id], ...part } }));

  const file = async (r: inbound.MessageRow) => {
    const draft = drafts[r.id];
    const amount = parseFloat((draft?.amount || '').replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0 || !draft?.date) return;
    // Η ΚΑΤΗΓΟΡΙΑ ΤΗΣ ΟΘΟΝΗΣ ΕΙΝΑΙ Η ΚΑΤΗΓΟΡΙΑ ΠΟΥ ΓΡΑΦΕΤΑΙ. Πριν, ό,τι κι αν
    // έδειχνε η γραμμή, καταχωρούνταν η πρόταση της βάσης.
    const cat = draft.slug ? BY_SLUG[draft.slug] : null;
    const label = cat ? cat.label : (r.category || 'Άλλο');
    setBusy(r.id);
    const res = await inbound.fileAsExpense(supabase, r.id, {
      propertyId: draft.propertyId || propertyId, userId,
      description: expenseTitle(r.vendor, r.subject || '', label),
      amount,
      date: draft.date,
      category: label,
      expenseGroup: cat ? groupForCategory(cat) : (r.expense_group || undefined),
      vendor: r.vendor,
    });
    // Η ΔΙΟΡΘΩΣΗ ΜΑΘΑΙΝΕΤΑΙ ΜΟΝΟ ΟΤΑΝ ΕΓΙΝΕ. Οποιος δέχτηκε την πρόταση δεν
    // δίδαξε τίποτα και δεν πρέπει να γραφτεί κανόνας στο όνομά του.
    if (cat && draft.slug !== (resolveCategory(r.category) || '')) {
      const action = hintAction(r.vendor, r.subject || '', cat.label);
      if (action && 'forget' in action) await hintStore.forget(supabase, userId, action.key);
      else if (action) await hintStore.learn(supabase, userId, action.key, action.category);
    }
    setBusy(null);
    if (!res.expenseId) { notifyError('Η δαπάνη δεν καταχωρήθηκε'); return; }
    // Η ΔΑΠΑΝΗ ΥΠΑΡΧΕΙ ΚΑΙ ΤΟ ΛΕΜΕ, ακόμη κι όταν το σημάδι δεν γράφτηκε. Η
    // εναλλακτική —«κάτι πήγε στραβά»— θα έκανε τον ιδιοκτήτη να την ξαναγράψει.
    if (res.orphaned) notifyError('Η δαπάνη καταχωρήθηκε. Το εισερχόμενο θα ξαναφανεί.');
    setRows(list => list.filter(x => x.id !== r.id));
    onFiled?.();
  };

  const drop = async (id: string) => {
    setBusy(id);
    const { error } = await inbound.dismiss(supabase, id);
    setBusy(null);
    if (error) { notifyError('Το εισερχόμενο δεν απορρίφθηκε'); return; }
    setRows(list => list.filter(x => x.id !== id));
    notify('Αφαιρέθηκε από τα εισερχόμενα', {
      duration: UNDO_MS,
      action: {
        label: 'Αναίρεση',
        onClick: () => {
          inbound.restore(supabase, id).then(({ error: e }) => {
            if (e) notifyError('Το εισερχόμενο δεν επανήλθε');
            else setReloadNonce(n => n + 1);
          });
        },
      },
    });
  };

  // Πολλά ακίνητα: κάθε γραμμή λέει πού πάει. Ένα: το λέει η κεφαλίδα.
  const many = properties.length > 1;
  const nameOf = (id: string): string =>
    properties.find(p => p.id === id)?.name || (id === propertyId ? propertyName || '' : '');

  // Αν το ανοιχτό καταχωρήθηκε ή απορρίφθηκε, ανοίγει το επόμενο της ουράς.
  const anoixtoId = rows.some(x => x.id === anoixto) ? anoixto : rows[0]?.id;

  return (
    <Card style={{ marginBottom: T.sp.lg }}>
      {/* Στο τηλέφωνο το θέμα κρύβεται στην κλειστή γραμμή: αποστολέας,
          ημερομηνία και ποσό ξεχωρίζουν πέντε ίδια θέματα, το θέμα όχι. */}
      <style>{`@media (max-width: 480px) { .inbound-row > .inbound-what { display: none; } .inbound-row > .inbound-prop { flex: 1 1 0; } }`}</style>
      <SecHdr label="Ήρθαν με email"
        sub={many
          ? 'Κάθε γραμμή λέει σε ποιο ακίνητο γράφεται· το αλλάζεις στη φόρμα.'
          : propertyName ? `Η καταχώρηση γράφεται στο ακίνητο «${propertyName}»` : 'Η καταχώρηση γράφεται στο ακίνητο που βλέπεις'} />
      <div style={{ display: 'grid', gap: 10 }}>
        {rows.map(r => {
          const draft = drafts[r.id] || { amount: '', date: '', slug: '', propertyId };
          const amount = parseFloat((draft.amount || '').replace(',', '.'));
          const ready = Number.isFinite(amount) && amount > 0 && !!draft.date;
          const known = r.amount !== null;
          const learned = hintFor(hints, r.vendor) === r.category;
          const stamp = r.due_date || r.issue_date;
          // Η ΕΤΙΚΕΤΑ ΚΟΥΒΑΛΑΕΙ ΤΗΝ ΠΡΟΕΛΕΥΣΗ. «Ημερομηνία λήξης» και
          // «Ημερομηνία έκδοσης» δεν είναι το ίδιο πράγμα για τα βιβλία και
          // πριν η διάκριση ζούσε σε ξεχωριστή γραμμή κειμένου.
          const dateLabel = r.due_date ? 'Ημερομηνία λήξης'
            : r.issue_date ? 'Ημερομηνία έκδοσης'
            : 'Ημερομηνία';
          // ΤΙ ΔΙΑΒΑΣΤΗΚΕ, ΟΤΑΝ Ο ΑΝΘΡΩΠΟΣ ΤΟ ΑΛΛΑΞΕ. Χωρίς αυτό, η διόρθωση
          // σβήνει το μόνο ίχνος του τι έλεγε το μήνυμα.
          const readAmount = r.amount === null ? null : Number(r.amount);
          const amountChanged = readAmount != null && Number.isFinite(amount)
            && Math.abs(amount - readAmount) > 0.005;

          // ── ΚΛΕΙΣΤΟ: ΜΙΑ ΓΡΑΜΜΗ ΠΟΥ ΛΕΕΙ ΤΑ ΤΡΙΑ ΠΟΥ ΧΡΕΙΑΖΟΝΤΑΙ ──────────
          // Ποιος το έστειλε, τι λέει το θέμα, τι ποσό διαβάστηκε. Ο ιδιοκτήτης
          // βλέπει ΟΛΗ την ουρά με μια ματιά και ανοίγει όποιο θέλει, με τη
          // σειρά που θέλει. Ενα `<button>` και όχι `div`, ώστε να ανακοινώνεται
          // ως κουμπί και να πατιέται με πληκτρολόγιο.
          if (r.id !== anoixtoId) return (
            <button key={r.id} type="button" className="inbound-row" onClick={() => setAnoixto(r.id)}
              aria-expanded={false}
              aria-label={`Άνοιγμα: ${r.vendor || r.from_address || 'άγνωστος αποστολέας'}${known ? `, ${fe(readAmount!)}` : ''}`}>
              {/* Το `textWrap: undefined` κρατά ζωντανό το `white-space: nowrap`
                  της κλάσης: το `text-wrap` του `TT.*` είναι συντομογραφία και
                  ξαναγράφει το `text-wrap-mode`, οπότε ενσωματωμένο νικούσε την
                  κλάση και η γραμμή τύλιγε σε τέσσερις σειρές στα 320. */}
              <span className="inbound-who po-elide" style={{ ...TT.body, textWrap: undefined, fontWeight: 600, color: 'var(--text-primary)' }}>
                {r.vendor || r.from_address || 'Άγνωστος αποστολέας'}
              </span>
              {/* Το θέμα παίρνει ό,τι περισσεύει και αποσιωπάται· δεν σπρώχνει
                  ποτέ το ποσό έξω από τη γραμμή. Το πώς ζει στην `.inbound-row`
                  του globals.css, μαζί με την αιώρηση και την εστίαση. */}
              <span className="inbound-what po-elide" style={{ ...TT.bodySm, textWrap: undefined, color: 'var(--text-secondary)' }}>
                {r.subject || 'Χωρίς θέμα'}
              </span>
              {many && (
                <span className="inbound-prop po-elide" style={{ ...TT.bodySm, textWrap: undefined, color: 'var(--text-tertiary)', flex: '0 1 auto', minWidth: 0, maxWidth: '30%' }}>
                  {nameOf(draft.propertyId)}
                </span>
              )}
              {/* ΠΕΝΤΕ ΙΔΙΑ ΘΕΜΑΤΑ ΞΕΧΩΡΙΖΟΥΝ ΑΠΟ ΤΗΝ ΗΜΕΡΟΜΗΝΙΑ. Πέντε «ΔΕΗ
                  Λογαριασμός ρεύματος…» διέφεραν μόνο στο ποσό. */}
              {stamp && (
                <span style={{ ...TT.bodySm, textWrap: undefined, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', flex: '0 0 auto', marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>
                  {dayMonth(stamp)}
                </span>
              )}
              {/* Το ποσό που ΔΕΝ διαβάστηκε το λέει με λέξεις, όχι με παύλα: η
                  παύλα διαβάζεται ως μηδέν. */}
              <span className="inbound-sum" style={{ ...TT.bodySm, textWrap: undefined, fontWeight: 600,
                color: known ? 'var(--text-primary)' : 'var(--text-tertiary)', marginLeft: stamp ? undefined : 'auto' }}>
                {known ? fe(readAmount!) : 'χωρίς ποσό'}
              </span>
            </button>
          );

          return (
            /* ΤΟ `minWidth: 0` ΔΕΝ ΕΙΝΑΙ ΔΙΑΚΟΣΜΗΤΙΚΟ. Η γραμμή είναι στοιχείο
               πλέγματος και τα στοιχεία πλέγματος ξεκινούν με `min-width: auto`,
               δηλαδή αρνούνται να γίνουν στενότερα από το ελάχιστο περιεχόμενό
               τους. ΜΕΤΡΗΜΕΝΟ ΣΕ 320 (One UI με μεγάλη γραμματοσειρά): η κάρτα
               δίνει 266 και η γραμμή έπαιρνε 304, δηλαδή έβγαινε 38 έξω από τη
               δεξιά της άκρη, με το «€» του ποσού πάνω από το περίγραμμα. Με το
               μηδέν, η γραμμή δέχεται το πλάτος που της δίνεται και τα πεδία
               μέσα της στριμώχνονται κανονικά, όπως κάνουν σε κάθε άλλη οθόνη. */
            <div key={r.id} style={{
              display: 'grid', gap: 10, padding: '12px 14px', minWidth: 0,
              borderRadius: T.radius.card, background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span style={{ ...TT.body, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {r.vendor || r.from_address || 'Άγνωστος αποστολέας'}
                </span>
              </div>

              <div style={{ ...TT.bodySm, color: 'var(--text-secondary)' }}>
                {r.subject || 'Χωρίς θέμα'}
              </div>

              {/* Η ΚΑΤΗΓΟΡΙΑ ΕΦΥΓΕ ΑΠΟ ΕΔΩ ΚΑΙ ΕΓΙΝΕ ΕΠΙΛΟΓΗ. Γραμμένη ως κείμενο,
                  ήταν πρόταση που για να διορθωθεί ήθελε καταχώρηση, άνοιγμα του
                  καθολικού και δεύτερη φόρμα. Τώρα διορθώνεται εκεί που
                  φαίνεται και η διόρθωση κρατιέται για την επόμενη φορά. */}
              {/* Η ΗΜΕΡΟΜΗΝΙΑ ΕΦΥΓΕ ΑΠΟ ΕΔΩ ΚΑΙ ΜΠΗΚΕ ΣΤΗΝ ΕΤΙΚΕΤΑ ΤΟΥ ΠΕΔΙΟΥ.
                  Γραμμένη και στις δύο θέσεις, το ίδιο νούμερο λεγόταν δύο
                  φορές· η ετικέτα λέει ΤΙ διάβασε το μήνυμα («λήξης» ή
                  «έκδοσης») και το πεδίο ΤΙ θα γραφτεί. */}
              {/* Το συνημμένο ΔΕΝ αποθηκεύεται (μόνο το πλήθος του), οπότε δεν
                  ανοίγει από εδώ· η φράση λέει πού βρίσκεται. */}
              {(!stamp || r.attachments > 0) && (
                <div style={{ ...TT.bodySm, color: 'var(--text-tertiary)' }}>
                  {[
                    stamp ? '' : 'Χωρίς ημερομηνία στο μήνυμα',
                    r.attachments > 0 ? (r.attachments === 1 ? 'Ένα συνημμένο, στο αρχικό email' : `${r.attachments} συνημμένα, στο αρχικό email`) : '',
                  ].filter(Boolean).join(' · ')}
                </div>
              )}

              <div {...fieldRow(180)}>
                {many && (
                  <CustomSelect label="Ακίνητο" value={draft.propertyId} onChange={v => patch(r.id, { propertyId: v })}
                    options={properties.map(p => ({ value: p.id, label: p.name }))} />
                )}
                <div style={{ minWidth: 0 }}>
                  <span style={{ ...TT.bodySm, display: 'block', marginBottom: 6, color: 'var(--text-secondary)' }}>Κατηγορία</span>
                  <CustomSelect ariaLabel="Κατηγορία δαπάνης" value={draft.slug} onChange={v => patch(r.id, { slug: v })}
                    placeholder="Χωρίς κατηγορία"
                    options={CATEGORIES.map(c => ({ value: c.slug, label: c.label }))} />
                </div>
                {/* ══════════════════════════════════════════════════════════
                    ΤΟ ΔΙΑΒΑΣΜΕΝΟ ΠΟΣΟ ΔΕΝ ΕΙΝΑΙ ΟΡΙΣΤΙΚΟ

                    Οταν ο αναγνώστης έβγαζε ποσό, το πεδίο ΔΕΝ αποδιδόταν
                    καθόλου: το νούμερο τυπωνόταν ως κείμενο στην κεφαλίδα και
                    δεν υπήρχε τρόπος να διορθωθεί. Ο ιδιοκτήτης που έβλεπε
                    λάθος ποσό είχε ΜΟΝΟ μία έξοδο, το «Δεν είναι δαπάνη» και
                    μετά χειροκίνητη καταχώρηση από την αρχή.

                    Και το λάθος ποσό είναι υπαρκτό, όχι θεωρητικό: το ίδιο
                    αρχείο του αναγνώστη κρατά τέσσερα σχήματα λογαριασμού που
                    έβγαζαν ημερομηνία, χιλιάδες ή αριθμό λογαριασμού στη θέση
                    του ποσού. Ο,τι διαβάζει μηχανή, ο άνθρωπος το διορθώνει.
                    ══════════════════════════════════════════════════════════ */}
                <NumberInput label="Ποσό" value={draft.amount} suffix="€"
                  onChange={v => patch(r.id, { amount: v })} placeholder="" />
                <DatePicker label={dateLabel} value={draft.date} onChange={v => patch(r.id, { date: v })} />
              </div>

              {/* ΤΟ ΓΙΑΤΙ, ΟΤΑΝ Η ΚΑΤΗΓΟΡΙΑ ΔΕΝ ΒΓΗΚΕ ΑΠΟ ΤΟ ΚΕΙΜΕΝΟ. Μια
                  κατηγορία που εμφανίζεται χωρίς εξήγηση είναι μαντεψιά· αυτή
                  εδώ την έγραψε ο ίδιος ο ιδιοκτήτης και το λέμε μία φορά. */}
              {learned && draft.slug === (resolveCategory(r.category) || '') && (
                <div style={{ ...TT.bodySm, color: 'var(--text-tertiary)' }}>
                  Η κατηγορία ήρθε από προηγούμενη διόρθωσή σου για αυτόν τον πάροχο.
                </div>
              )}

              {!known && (
                <div style={{ ...TT.bodySm, color: 'var(--text-tertiary)' }}>
                  Το ποσό δεν διαβάστηκε από το μήνυμα. Συμπλήρωσέ το από τον λογαριασμό στο αρχικό email.
                </div>
              )}

              {amountChanged && (
                <div style={{ ...TT.bodySm, color: 'var(--text-tertiary)' }}>
                  Από το μήνυμα διαβάστηκε {fe(readAmount!)}. Καταχωρείται ό,τι γράφει το πεδίο.
                </div>
              )}

              {/* Δύο ενέργειες, ίδιο πλάτος σε τηλέφωνο: ο κανόνας ζει στην
                  `.act-row` του globals.css. Χωρίς αυτόν, το «Καταχώρηση» και
                  το «Δεν είναι δαπάνη» έπεφταν σε δύο σειρές διαφορετικού
                  πλάτους μέσα στην ίδια κάρτα. */}
              <div className="act-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Btn variant="primary" onClick={() => file(r)} disabled={!ready || busy === r.id}>
                  {busy === r.id ? 'Καταχώρηση…' : 'Καταχώρηση'}
                </Btn>
                <Btn variant="secondary" onClick={() => drop(r.id)} disabled={busy === r.id}>Δεν είναι δαπάνη</Btn>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
