'use client';

// ═══════════════════════════════════════════════════════════════════════════
// DemoPreview — μια ολόκληρη χρονιά, χωρίς να γραφτεί τίποτα
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΑΝΤΙΚΑΘΙΣΤΑ. Το παλιό «demo» έφτιαχνε ΑΛΗΘΙΝΟ ακίνητο στον λογαριασμό του
// νέου χρήστη. Εδώ δεν γίνεται καμία εγγραφή: όλα τα δεδομένα ζουν στο
// lib/demo/sample.ts και οι αριθμοί βγαίνουν από τις ίδιες συναρτήσεις που
// υπολογίζουν τον φόρο του πληρωμένου χρήστη.
//
// ΓΙΑΤΙ ΑΥΤΕΣ ΟΙ ΤΡΕΙΣ ΕΝΟΤΗΤΕΣ ΚΑΙ ΟΧΙ ΠΕΡΙΣΣΟΤΕΡΕΣ. Το παράδειγμα δεν είναι
// ξενάγηση στα εργαλεία — είναι μία απάντηση: «τι μένει στην τσέπη και τι
// χρωστάω». Τα τρία ποσά της κορυφής το λένε, η κατάσταση αποτελεσμάτων δείχνει
// τον δρόμο ως εκεί και το ισοζύγιο δείχνει ότι κάθε δαπάνη ξέρει τον
// λογαριασμό της. Ό,τι άλλο θα ήταν επίδειξη, όχι απόδειξη.
//
// ΤΟ ΣΗΜΕΙΟ ΠΟΥ ΔΙΔΑΣΚΕΙ. Ο ιδιοκτήτης νομίζει ότι οι δαπάνες του μειώνουν τον
// φόρο. Σε φυσικό πρόσωπο με μακροχρόνια ΔΕΝ τον μειώνουν: εκπίπτει τεκμαρτά
// 5% και τίποτε άλλο. Η κατάσταση το δείχνει με τη σειρά των γραμμών, χωρίς να
// το εξηγεί με παράγραφο.
// ═══════════════════════════════════════════════════════════════════════════

import { Modal, Btn, T, TT, fe, fp, Stat } from '@/components/Theme';
import { DEMO_PROPERTY, demoLedger, demoSummary } from '@/lib/demo/sample';
import { isoDate } from '@/lib/core/time';

const numStyle = { fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums' as const };

export default function DemoPreview({ open, onClose, onAddProperty }: {
  open: boolean;
  onClose: () => void;
  /** «Πρόσθεσε το ακίνητό σου»: κλείνει την προεπισκόπηση και ανοίγει τον οδηγό. */
  onAddProperty: () => void;
}) {
  const today = isoDate(new Date());
  const s = demoSummary(today);
  const ledger = demoLedger(s.year);

  // Οι γραμμές της κατάστασης έρχονται έτοιμες από το incomeStatement, με τη
  // σειρά και τα λεκτικά του νόμου. Δεν ξαναγράφονται εδώ — αλλιώς θα υπήρχαν
  // δύο εκδοχές της ίδιας κατάστασης, μία για την προεπισκόπηση και μία αληθινή.
  const lines = s.statement.lines;

  return (
    <Modal open={open} onClose={onClose} size="lg"
      title="Παράδειγμα μιας ολόκληρης χρονιάς"
      subtitle={`${DEMO_PROPERTY.name} · ${DEMO_PROPERTY.sqm} τ.μ. · μακροχρόνια μίσθωση · ${s.year}`}
      footerInfo="Το παράδειγμα δεν αποθηκεύεται στον λογαριασμό σου."
      footer={<>
        <Btn onClick={onClose}>Κλείσιμο</Btn>
        <Btn variant="primary" onClick={onAddProperty}>Πρόσθεσε το ακίνητό σου</Btn>
      </>}>

      {/* ── ΤΑ ΤΡΙΑ ΠΟΣΑ ─────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: T.sp.lg }}>
        <Stat label="Εισπράχθηκαν" value={fe(s.collected)}
          sub={`${fe(DEMO_PROPERTY.monthlyRent)} τον μήνα, έντεκα μήνες μέσα στη χρονιά`} />
        <Stat label="Δαπάνες" value={fe(s.expenses)}
          sub={`${ledger.length} κατηγορίες, μαζί με τον ΕΝΦΙΑ`} />
        <Stat label="Στο ταμείο" value={fe(s.statement.netCash)}
          sub={`μετά από φόρο, ΕΝΦΙΑ και δαπάνες`} />
      </div>

      {/* ── Η ΚΑΤΑΣΤΑΣΗ ──────────────────────────────────────────────────── */}
      <div>
        <div style={{ ...TT.label, fontSize: 'var(--fs-xs)', marginBottom: 10 }}>ΑΠΟ ΤΟ ΕΝΟΙΚΙΟ ΣΤΟ ΤΑΜΕΙΟ</div>
        <div style={{ border: '1px solid var(--border-subtle)', borderRadius: T.radius.inner, overflow: 'hidden' }}>
          {lines.map((l, i) => {
            const strong = l.kind === 'subtotal' || l.kind === 'result';
            return (
              <div key={l.key} style={{
                display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: T.sp.md,
                padding: '10px 14px',
                borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)',
                background: strong ? 'var(--bg-elevated)' : 'transparent',
              }}>
                <span style={{ ...TT.bodySm, color: strong ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: strong ? 700 : 400 }}>{l.label}</span>
                <span style={{ ...numStyle, fontSize: 'var(--fs-base)', fontWeight: strong ? 700 : 500, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                  {l.negative ? `− ${fe(l.amount)}` : fe(l.amount)}
                </span>
              </div>
            );
          })}
        </div>
        {/* ΔΥΟ ΑΛΗΘΕΙΕΣ ΠΟΥ ΔΕΝ ΦΑΙΝΟΝΤΑΙ ΣΤΟΥΣ ΑΡΙΘΜΟΥΣ, ΚΑΙ ΜΙΑ ΓΡΑΜΜΗ ΓΙΑ
            ΚΑΘΕ ΜΙΑ: ποιας χρονιάς κλίμακα εφαρμόστηκε και πού πήγε ο
            δωδέκατος μήνας. Χωρίς τη δεύτερη, ο αναγνώστης μετρά έντεκα ενοίκια
            και υποθέτει ότι λείπει ένα. */}
        <div style={{ ...TT.caption, marginTop: 10 }}>
          Φόρος με {s.bracketsLabel}. Πραγματικός συντελεστής {fp(s.statement.effectiveRate * 100)}.
        </div>
        <div style={{ ...TT.caption, marginTop: 4 }}>
          Το ενοίκιο Δεκεμβρίου εισπράχθηκε στις 8 Ιανουαρίου, οπότε ανήκει στη χρήση {s.year + 1}: {fe(s.carriedOver)}.
        </div>
      </div>

      {/* ── ΤΟ ΙΣΟΖΥΓΙΟ ──────────────────────────────────────────────────── */}
      <div>
        {/* ═══ ΠΙΝΑΚΑΣ, ΟΧΙ ΣΤΟΙΒΑ ΑΠΟ divs ═══════════════════════════════════
            ΤΙ ΗΤΑΝ. Εντεκα σειρές επί τρεις στήλες με `display: flex`: τριάντα
            τρία κελιά που ΜΟΙΑΖΑΝ πίνακας. Ο αναγνώστης οθόνης άκουγε τριάντα
            τρία ασύνδετα κείμενα — ποτέ «Βαφή, λογαριασμός 62.98, 640,00€».
            Η ενότητα όμως διαβάζεται ΣΤΑΥΡΩΤΑ: ποια δαπάνη, σε ποιον
            λογαριασμό, πόσο.

            ΚΑΙ Η ΜΕΣΑΙΑ ΣΤΗΛΗ ΔΕΝ ΕΛΕΓΕ ΤΙ ΕΙΝΑΙ. Γυμνοί κωδικοί ΕΛΠ, χωρίς
            ούτε ένα λεκτικό πουθενά: η κεφαλίδα στηλών —που δεν υπήρχε— τους
            ονομάζει τώρα μία φορά για όλες τις σειρές. Η ετικέτα της ενότητας
            έγινε `caption`, δηλαδή ταινία τίτλου ΤΟΥ ΠΙΝΑΚΑ αντί για ελεύθερο
            κείμενο από πάνω του. */}
        <div className="po-table-box">
          {/* ΤΟ ΕΛΑΧΙΣΤΟ ΠΛΑΤΟΣ ΒΓΑΙΝΕΙ ΑΠΟ ΤΙΣ ΔΥΟ ΣΤΗΛΕΣ ΠΟΥ ΔΕΝ ΤΥΛΙΓΟΝΤΑΙ.
              Το ποσό κρατούσε ήδη 84 γραμμένα στο χέρι· με τα 14+14 του κελιού
              της `.po-table` θέλει 112. Ο κωδικός ΕΛΠ σε mono θέλει 76. Μένουν
              152 για το όνομα της δαπάνης, δηλαδή 340 συνολικά. Κάτω από αυτό
              ο πίνακας κυλά — αλλιώς το `overflow-wrap: anywhere` του κελιού θα
              έσπαγε το «1.234,56€» στη μέση. */}
          <div className="po-scroll-x">
            <table className="po-table" style={{ ['--tbl-min' as string]: '340px' }}>
              <caption>ΟΙ ΔΑΠΑΝΕΣ ΚΑΙ Ο ΛΟΓΑΡΙΑΣΜΟΣ ΤΟΥΣ</caption>
              <thead>
                <tr>
                  <th scope="col">Δαπάνη</th>
                  <th scope="col">Λογαριασμός ΕΛΠ</th>
                  <th scope="col" className="num">Ποσό</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map(r => (
                  <tr key={r.category}>
                    <th scope="row" style={{ ...TT.bodySm, color: 'var(--text-primary)' }}>{r.label}</th>
                    <td style={{ ...TT.caption, fontFamily: T.font.mono, whiteSpace: 'nowrap' }}>{r.account}</td>
                    {/* Καμία δήλωση γραμματοσειράς αριθμών: η `.num` δίνει ήδη
                        δεξιά στοίχιση και `tabular-nums`, το `T.font.num` είναι
                        το ίδιο Inter με το κείμενο. */}
                    <td className="num" style={{ fontSize: 'var(--fs-base)', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{fe(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div style={{ ...TT.caption, marginTop: 10 }}>
          Οι λογαριασμοί είναι του σχεδίου των ΕΛΠ, ν.4308/2014. Ο φάκελος του λογιστή βγαίνει με αυτούς.
        </div>
      </div>
    </Modal>
  );
}
