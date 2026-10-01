'use client';
// ═══════════════════════════════════════════════════════════════════════════
// ΚΑΘΑΡΗ ΑΠΟΔΟΣΗ ΑΚΙΝΗΤΟΥ — ο διαδραστικός πυρήνας
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΔΙΟΡΘΩΝΕΙ ΑΥΤΗ Η ΣΕΛΙΔΑ. Κάθε αγγελία και κάθε δωρεάν υπολογιστής δείχνει
// τη ΜΕΙΚΤΗ απόδοση: ενοίκιο επί δώδεκα, διά την αξία. Είναι τα χρήματα πριν
// τη ΔΟΥ, πριν τον ΕΝΦΙΑ και πριν τον θερμοσίφωνα. Ο ιδιοκτήτης το συγκρίνει
// με μια προθεσμιακή κατάθεση —όπου το 2% είναι 2% καθαρά— και παίρνει
// απόφαση δεκαετίας πάνω σε δύο νούμερα που δεν συγκρίνονται.
//
// ΤΑ ΔΥΟ ΝΟΥΜΕΡΑ ΜΠΑΙΝΟΥΝ ΔΙΠΛΑ ΔΙΠΛΑ, ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ ΟΛΗ Η ΣΕΛΙΔΑ. Δεν
// γράφεται πουθενά «προσοχή, η μεικτή παραπλανά»: φαίνεται.
//
// ΤΙΠΟΤΑ ΔΕΝ ΜΑΝΤΕΥΕΤΑΙ ΓΙΑ ΛΟΓΑΡΙΑΣΜΟ ΤΟΥ ΧΡΗΣΤΗ. Ο ΕΝΦΙΑ και οι δαπάνες
// ξεκινούν στο μηδέν και το αποτέλεσμα ΤΟ ΛΕΕΙ όσο μένουν εκεί. Μια
// προεπιλογή «τυπικού ΕΝΦΙΑ» θα ήταν νούμερο χωρίς πηγή, μέσα στο ίδιο
// αποτέλεσμα που υπόσχεται ακρίβεια.
//
// ΜΙΑ ΠΗΓΗ: ο υπολογισμός ζει στο lib/tools/apodosi.ts, που καλεί την ίδια
// φορολογική λογική με τον πίνακα ελέγχου. Η οθόνη δεν κάνει αριθμητική.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useId, useState } from 'react';
import Link from 'next/link';
import { T, feAuto } from '@/components/tokens';
import { fn, fp, fpRate, feSigned, fpSigned, feWhole } from '@/lib/core/format';
import { parseAmount } from '@/lib/core/greek';
import { propertyYield } from '@/lib/tools/apodosi';
import { FIRST_YEAR_NEW_BRACKETS } from '@/lib/billing/greekTax';
import { useToolState, ToolActions, ToolPaper, ToolPaperFoot } from '@/app/ToolShare';
import { ToolCta, EstimateNote, ToolClampNote } from '@/app/PublicChrome';
import { ToolNumField, ToolFields, ToolHero, ToolLedger, ToolStats, TOOL_LABEL, TOOL_FIELD } from '@/app/ToolParts';

import LiveResult from '@/components/LiveResult';
/** Τα πεδία όπως ταξιδεύουν στη διεύθυνση, με τις προεπιλογές τους. */
const SPEC = {
  axia: '200000', enoikio: '700', mines: '12',
  enfia: '0', dapanes: '0', alla: '0',
} as const;
const PATH = '/kathari-apodosi';

const amount = (s: string): number => Math.max(0, parseAmount(s) ?? 0);

/** Ακέραια ευρώ με τυπογραφικό μείον, όπως στη σύγκριση βραχυχρόνιας. */
const wholeSigned = (n: number) => (Math.round(n) < 0 ? `−${feWhole(-n)}` : feWhole(n));

/**
 * ΟΜΑΔΑ ΠΕΔΙΩΝ ΜΕ ΤΙΤΛΟ ΠΟΥ ΞΕΧΩΡΙΖΕΙ ΑΠΟ ΤΙΣ ΕΤΙΚΕΤΕΣ.
 *
 * Ο τίτλος ήταν `<p>` σε μικρά κεφαλαία 11 εικονοστοιχείων, όπως οι ετικέτες
 * των πεδίων από κάτω του, με χρώμα που στο φωτεινό θέμα διαφέρει ελάχιστα:
 * «ΤΟ ΑΚΙΝΗΤΟ» ακριβώς πάνω από «ΑΞΙΑ ΑΚΙΝΗΤΟΥ» ήταν δύο ίδιες γραμμές. Ως
 * `<legend>` σε πεζά ο αναγνώστης οθόνης ακούει και την ομάδα κάθε πεδίου και
 * το μάτι βλέπει τίτλο πάνω από ετικέτες.
 */
function Group({ title, children, first }: { title: string; children: React.ReactNode; first?: boolean }) {
  return (
    <fieldset className="po-tool-controls" style={{ border: 0, padding: 0, margin: first ? 0 : `${T.sp.xl}px 0 0`, minWidth: 0 }}>
      <legend style={{ padding: 0, margin: '0 0 12px', fontSize: 14, fontWeight: 600,
        color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{title}</legend>
      {children}
    </fieldset>
  );
}

export function ApodosiCalculator({ year, today }: { year: number; today: string }) {
  const [v, set] = useToolState(SPEC, PATH);
  const ids = {
    axia: useId(), enoikio: useId(), mines: useId(),
    enfia: useId(), dapanes: useId(), alla: useId(), name: useId(),
  };
  // ΤΟ ΟΝΟΜΑ ΤΟΥ ΑΚΙΝΗΤΟΥ ΔΕΝ ΜΠΑΙΝΕΙ ΣΤΗ ΔΙΕΥΘΥΝΣΗ. Μια διεύθυνση σε
  // κοινοποιημένο σύνδεσμο ταξιδεύει σε ιστορικά περιήγησης και σε αρχεία
  // καταγραφής· η υπόσχεση «μένει στη συσκευή σου» θα έσπαγε για το μόνο πεδίο
  // που είναι πράγματι προσωπικό δεδομένο.
  const [name, setName] = useState('');

  const r = useMemo(() => propertyYield({
    value: amount(v.axia),
    monthlyRent: amount(v.enoikio),
    monthsRented: amount(v.mines),
    enfia: amount(v.enfia),
    expenses: amount(v.dapanes),
    otherRentalIncome: amount(v.alla),
    year,
    // Η ΤΡΑΠΕΖΙΚΗ ΕΙΣΠΡΑΞΗ ΔΕΝ ΕΙΝΑΙ ΕΡΩΤΗΣΗ ΕΔΩ. Από 1.7.2027 τα μισθώματα
    // κατοικίας θα εξοφλούνται με τραπεζικό ή ηλεκτρονικό μέσο (ν.5222/2025).
    // Ενας διακόπτης «μήπως εισπράττεις μετρητά;» θα ρωτούσε τον χρήστη αν θα
    // παρανομήσει, για να του δείξει χειρότερο νούμερο. Η υπόθεση γράφεται στην
    // επιφύλαξη, όπου ανήκει· και για 2025-2026 δεν αλλάζει τον φόρο.
    viaBank: true,
  }), [v.axia, v.enoikio, v.mines, v.enfia, v.dapanes, v.alla, year]);

  const hasValue = amount(v.axia) > 0;
  const noCosts = r.enfia === 0 && r.expenses === 0;
  const netLabel = noCosts ? 'Απόδοση μετά τον φόρο' : 'Καθαρή απόδοση';
  // Τα κομμάτια της μπάρας και του υπομνήματός της, με το μερίδιο του ενοικίου.
  const pct = (n: number) => `${fn(r.gross > 0 ? (n / r.gross) * 100 : 0)}%`;
  const split = ([
    { key: 'keep', name: 'Σου μένουν', n: Math.max(0, r.net), bg: 'var(--accent)', op: 1 },
    { key: 'tax', name: 'Φόρος', n: r.tax, bg: 'var(--text-tertiary)', op: 0.7 },
    { key: 'enfia', name: 'ΕΝΦΙΑ', n: r.enfia, bg: 'var(--text-tertiary)', op: 0.45 },
    { key: 'costs', name: 'Δαπάνες', n: r.expenses, bg: 'var(--text-tertiary)', op: 0.25 },
  ]).filter(p => p.n > 0).map(p => ({ ...p, pct: pct(p.n) }));

  return (
    <div style={{ fontFamily: T.font.sans }}>
      {/* ── ΤΟ ΑΚΙΝΗΤΟ: ΤΑ ΤΡΙΑ ΠΟΥ ΞΕΡΕΙ ΑΠΕΞΩ Ο ΚΑΘΕΝΑΣ ──────────────────
          Αξία, ενοίκιο, μήνες. Ό,τι άλλο θελήσουμε να ρωτήσουμε πρώτο είναι
          μια αφορμή να φύγει κάποιος που μόλις μας βρήκε. */}
      <Group title="Το ακίνητο" first>
        {/* ΣΤΟ ΚΟΙΝΟ ΠΛΕΓΜΑ ΤΩΝ ΤΕΣΣΑΡΩΝ (`ToolFields`): ίδια πλάτη πεδίων με τους
            άλλους τρεις υπολογιστές, όχι τρίτα της κάρτας. */}
        <ToolFields>
          <ToolNumField id={ids.axia} label="Αξία ακινήτου" value={v.axia} onChange={x => set('axia', x)} unit="€"/>
          <ToolNumField id={ids.enoikio} label="Μηνιαίο ενοίκιο" value={v.enoikio} onChange={x => set('enoikio', x)} unit="€"/>
          <ToolNumField id={ids.mines} label="Μήνες ενοικίασης" value={v.mines}
            onChange={x => set('mines', x)} mode="numeric" unit="μήνες" unitPad={64}/>
        </ToolFields>
        <ToolClampNote notes={[
          Math.round(amount(v.mines)) > 12 && 'Μέγιστο 12 μήνες· υπολογίστηκαν 12.',
        ]}/>
      </Group>

      {/* ── ΤΙ ΤΟ ΒΑΡΑΙΝΕΙ ────────────────────────────────────────────────
          Τρία πεδία που ξεκινούν στο μηδέν, με τη βοήθεια από κάτω τους. Το
          μηδέν δεν κρύβεται: το αποτέλεσμα λέει ρητά τι δεν περιλαμβάνει όσο
          μένουν άδεια. */}
      <Group title="Τι το βαραίνει">
        <ToolFields>
          {/* ΜΙΑ ΓΡΑΜΜΗ Η ΚΑΘΕ ΥΠΟΔΕΙΞΗ, ΚΑΙ Η ΦΡΑΣΗ-ΣΥΝΔΕΣΜΟΣ ΔΕΝ ΣΠΑΕΙ. Το γεγονός
              που κουβαλά: ο ΕΝΦΙΑ πληρώνεται και σε άδειο ακίνητο. */}
          <ToolNumField id={ids.enfia} label="ΕΝΦΙΑ τον χρόνο" value={v.enfia} onChange={x => set('enfia', x)} unit="€"
            hint={<>Τον πληρώνεις κι άδειο.{' '}
              <Link href="/ypologismos-enfia" className="lp-link"
                style={{ color: 'var(--accent)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                Υπολόγισέ τον
              </Link>.</>}/>
          {/* ΤΟ 5% ΔΕΝ ΣΥΜΠΛΗΡΩΝΕΤΑΙ ΕΔΩ: είναι η τεκμαρτή ΕΚΠΤΩΣΗ του φόρου, όχι
              εκτίμηση του τι ξοδεύεις. Η έκπτωση μπαίνει ήδη στον φόρο. */}
          <ToolNumField id={ids.dapanes} label="Δαπάνες τον χρόνο" value={v.dapanes} onChange={x => set('dapanes', x)} unit="€"
            hint="Συντήρηση, ασφάλιση, κοινόχρηστα που πληρώνεις εσύ."/>
          {/* Ακαθάριστα· και ανεβάζουν το κλιμάκιο ΑΥΤΟΥ του ακινήτου. */}
          <ToolNumField id={ids.alla} label="Άλλα ενοίκια" value={v.alla} onChange={x => set('alla', x)} unit="€"
            hint="Ακαθάριστα, από τα υπόλοιπα ακίνητά σου. Ανεβάζουν το κλιμάκιο αυτού εδώ."/>
        </ToolFields>
      </Group>

      <ToolPaper title={name.trim() ? `Καθαρή απόδοση · ${name.trim()}` : 'Καθαρή απόδοση ακινήτου'} on={today} inputs={[
        { k: 'Αξία', v: feAuto(amount(v.axia)) },
        { k: 'Μηνιαίο ενοίκιο', v: feAuto(amount(v.enoikio)) },
        { k: 'Μήνες', v: fn(Math.min(12, Math.round(amount(v.mines)))) },
        { k: 'ΕΝΦΙΑ', v: feAuto(r.enfia) },
        { k: 'Δαπάνες', v: feAuto(r.expenses) },
        { k: 'Άλλα ενοίκια', v: feAuto(amount(v.alla)) },
      ]}/>

      {/* ── Το αποτέλεσμα ─────────────────────────────────────────────── */}
      <div className="po-tool-result" style={{
        marginTop: 20, padding: 'clamp(18px, 4vw, 26px)', borderRadius: T.radius.card,
        background: 'var(--surface-raised)', border: '1px solid var(--border-raised)',
        boxShadow: 'var(--well-inset)',
      }}>
        {/* ΤΟ ΜΗΔΕΝ ΠΟΥ ΔΕΝ ΔΗΛΩΘΗΚΕ ΛΕΓΕΤΑΙ ΠΡΙΝ ΑΠΟ ΤΟ ΝΟΥΜΕΡΟ, ΚΑΙ ΤΟ ΝΟΥΜΕΡΟ ΔΕΝ
            ΛΕΓΕΤΑΙ «ΚΑΘΑΡΗ». Με ΕΝΦΙΑ και δαπάνες στο μηδέν (η προεπιλογή), το
            πρώτο νούμερο της οθόνης είναι η μεικτή μείον τον φόρο. Γραμμένο
            «Καθαρή απόδοση», με μια γκρίζα υποσημείωση στο τέλος της κάρτας,
            ήταν ακριβώς το λάθος που η σελίδα υπάρχει για να διορθώσει. Η
            ετικέτα λέει τι είναι και γίνεται «Καθαρή» μόλις μπει ένα από τα δύο. */}
        {/* Η ΚΑΘΑΡΗ ΟΔΗΓΕΙ, Η ΜΕΙΚΤΗ ΤΗΝ ΠΛΑΙΣΙΩΝΕΙ. Η μεικτή είναι το νούμερο που
            ήξερε ο επισκέπτης πριν έρθει· υπάρχει για τη σύγκριση, όχι ως
            δεύτερη απάντηση στο ίδιο μέγεθος. */}
        {hasValue ? (
          <>
            <ToolHero primary={{ label: netLabel, value: fpSigned((r.netYield ?? 0) * 100) }}
              secondary={[{ label: 'Μεικτή απόδοση', value: fp((r.grossYield ?? 0) * 100) }]}/>
            <LiveResult say={`${netLabel} ${fpSigned((r.netYield ?? 0) * 100)}. Μεικτή ${fp((r.grossYield ?? 0) * 100)}.`} />
            {/* ΤΟ ΜΗΔΕΝ ΠΟΥ ΔΕΝ ΔΗΛΩΘΗΚΕ ΛΕΓΕΤΑΙ ΚΑΤΩ ΑΠΟ ΤΟ ΝΟΥΜΕΡΟ, ΩΣ ΣΗΜΕΙΩΣΗ. Ηταν
                παράγραφος ΠΑΝΩ από τα νούμερα και η κάρτα άνοιγε με επιφύλαξη αντί
                για απάντηση. Η ετικέτα ήδη λέει «μετά τον φόρο» όσο λείπουν· η
                σημείωση εξηγεί γιατί, εκεί που το μάτι πάει μετά τον αριθμό. */}
            {noCosts && (
              <p style={{ margin: '12px 0 0', fontSize: 13, lineHeight: 1.55, color: 'var(--text-tertiary)', textWrap: 'pretty' }}>
                Δεν δηλώθηκε ΕΝΦΙΑ ούτε δαπάνες, οπότε η απόδοση κρατά μόνο τον φόρο. Με τα δύο
                πεδία συμπληρωμένα βγαίνει η καθαρή.
              </p>
            )}
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            Η απόδοση χρειάζεται αξία. Με το ποσό που αξίζει ή που θα δώσεις για το
            ακίνητο, τα υπόλοιπα βγαίνουν από μόνα τους.
          </p>
        )}

        <div style={{ height: 1, background: 'var(--border-subtle)', margin: '20px 0 16px' }}/>

        {/* ── ΠΟΥ ΠΑΕΙ ΤΟ ΕΝΟΙΚΙΟ ────────────────────────────────────────
            Μία γραμμή, τέσσερα κομμάτια. Δείχνει ΤΙ ΑΠΟΜΕΝΕΙ, που κανένας
            πίνακας αριθμών δεν δείχνει με μια ματιά.
            ΧΩΡΙΣ ΚΟΚΚΙΝΟ ΚΑΙ ΠΡΑΣΙΝΟ: το κρατούμενο παίρνει το χρώμα έμφασης,
            τα τρία βάρη διαβαθμίσεις του ίδιου ουδέτερου. Ο φόρος δεν είναι
            σφάλμα, είναι υποχρέωση που μετρήθηκε.
            ΜΕ ΥΠΟΜΝΗΜΑ. Τρεις αποχρώσεις του γκρι δεν ονομάζονται μόνες τους:
            κάθε κομμάτι γράφει δίπλα στο δείγμα του τι είναι και τι μερίδιο του
            ενοικίου παίρνει και η ίδια πρόταση είναι το όνομα της εικόνας για
            τον αναγνώστη οθόνης. */}
        {r.gross > 0 && (
          <div style={{ marginBottom: T.sp.lg }}>
            <div role="img" aria-label={`Πού πάει το ενοίκιο: ${split.map(p => `${p.name} ${p.pct}`).join(', ')}.`} style={{
              display: 'flex', gap: 2, height: 10, borderRadius: T.radius.pill, overflow: 'hidden',
              background: 'var(--bg-elevated)',
            }}>
              {split.map(p => (
                <span key={p.key} style={{ flex: p.n, background: p.bg, opacity: p.op, minWidth: 2 }}/>
              ))}
            </div>
            <ul aria-hidden style={{ listStyle: 'none', margin: '10px 0 0', padding: 0, display: 'flex', flexWrap: 'wrap',
              columnGap: T.sp.lg, rowGap: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
              {split.map(p => (
                <li key={p.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                  <span style={{ width: 10, height: 10, borderRadius: T.radius.pill, background: p.bg, opacity: p.op, flexShrink: 0 }}/>
                  {p.name} <span style={{ fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>{p.pct}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ΜΙΑ ΣΤΗΛΗ ΠΟΥ ΑΦΑΙΡΕΙ: ενοίκιο, μείον τα τρία βάρη, ίσον όσα μένουν.
            Τα λεπτά μένουν εδώ, γιατί ο φόρος είναι ποσό του νόμου και η στήλη
            πρέπει να κλείνει στο λεπτό. Τα καθαρά μπορεί να βγουν αρνητικά:
            τυπογραφικό μείον, σφιχτό. */}
        <ToolLedger rows={[
          { k: 'Ετήσιο ενοίκιο', v: feAuto(r.gross) },
          { k: 'Φόρος εισοδήματος', v: feSigned(-r.tax) },
          // ΟΣΑ ΔΕΝ ΔΗΛΩΘΗΚΑΝ ΔΕΝ ΓΡΑΦΟΝΤΑΙ «0,00€»: το μηδέν εκεί διαβαζόταν ως
          // ΕΝΦΙΑ που μετρήθηκε μηδέν. Η λέξη λέει ότι το πεδίο έμεινε κενό.
          r.enfia > 0 ? { k: 'ΕΝΦΙΑ', v: feSigned(-r.enfia) } : { k: 'ΕΝΦΙΑ', v: 'δεν δηλώθηκε', kind: 'param' },
          r.expenses > 0 ? { k: 'Δαπάνες', v: feSigned(-r.expenses) } : { k: 'Δαπάνες', v: 'δεν δηλώθηκε', kind: 'param' },
          { k: 'Σου μένουν τον χρόνο', v: feSigned(r.net), kind: 'total' },
        ]}/>
        {/* ΟΤΑΝ ΤΟ ΑΚΙΝΗΤΟ ΔΕΝ ΕΠΙΣΤΡΕΦΕΙ, ΔΕΝ ΓΡΑΦΕΤΑΙ ΑΡΙΘΜΟΣ. Η διαίρεση με
            αρνητικά καθαρά δίνει αρνητικά χρόνια, που τυπώνονται μια χαρά και
            διαβάζονται ως απάντηση. Χωρίς αξία όμως δεν υπάρχει τι να
            επιστρέψει: το `null` σημαίνει και τα δύο και η σειρά τα ξεχωρίζει. */}
        {/* Ετικέτες μιας γραμμής και στα 768, ακέραια ευρώ όπως στην κορυφή. */}
        <ToolStats items={[
          { k: 'Καθαρά τον μήνα', v: wholeSigned(r.netMonthly) },
          { k: 'Χρόνια απόσβεσης', v: !hasValue ? 'Χρειάζεται αξία'
            : r.paybackYears === null ? 'Δεν επιστρέφει' : fn(r.paybackYears, 1) },
          { k: 'Οριακός συντελεστής', v: fpRate(r.marginal * 100) },
        ]}/>
      </div>

      {/* ΤΟ ΟΝΟΜΑ ΤΟΥ ΑΚΙΝΗΤΟΥ, ΜΟΝΟ ΓΙΑ ΤΟ ΧΑΡΤΙ, ΠΑΝΩ ΑΠΟ ΤΟ «Εκτύπωση». Ηταν
          κάτω από τα κουμπιά, δηλαδή μετά την ενέργεια που επηρεάζει. */}
      <ToolActions path={PATH} spec={SPEC} values={v} lead={<>
        <label htmlFor={ids.name} style={{ ...TOOL_LABEL, marginBottom: 6 }}>Όνομα για την εκτύπωση</label>
        <input id={ids.name} value={name} onChange={e => setName(e.target.value)}
          placeholder="π.χ. Διαμέρισμα κέντρου, 3ος"
          style={{ ...TOOL_FIELD, fontFamily: T.font.sans }}/>
      </>}/>

      {/* ── Τι ΔΕΝ περιλαμβάνει ───────────────────────────────────────── */}
      <div className="po-tool-note" style={{
        marginTop: T.sp.xl, padding: 'clamp(14px,2.6vw,18px)', borderRadius: T.radius.inner,
        background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
      }}>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
          {/* ΤΟ ΚΟΥΤΙ ΛΕΓΟΤΑΝ «Τι δεν περιλαμβάνει» ΚΑΙ ΞΕΚΙΝΟΥΣΕ ΜΕ ΟΣΑ ΠΕΡΙΛΑΜΒΑΝΕΙ.
              Ο αναγνώστης καταλάβαινε ότι η κλίμακα και το 5% ΔΕΝ εφαρμόζονται.
              Δύο προτάσεις, με τη σειρά που τις ρωτά. */}
          <strong style={{ color: 'var(--text-primary)' }}>Τι περιλαμβάνει και τι όχι.</strong>{' '}
          Ο φόρος βγαίνει με την κλίμακα ενοικίων {year}
          {year >= FIRST_YEAR_NEW_BRACKETS ? ' (15 / 25 / 35 / 45%)' : ' (15 / 35 / 45%)'} και
          την τεκμαρτή έκπτωση 5%, που από 1.7.2027 θα θέλει είσπραξη μέσω τραπέζης
          (ν.5222/2025)· εδώ θεωρείται δεδομένη. Δεν περιλαμβάνει: μεταβολή της
          αξίας, δάνειο και τόκους, έξοδα αγοράς ή πώλησης, ανακαίνιση,
          ανείσπρακτα, βραχυχρόνια, νομικό πρόσωπο ούτε τα άλλα σου
          εισοδήματα. <EstimateNote investment />
        </p>
      </div>

      <ToolPaperFoot path={PATH} spec={SPEC} values={v}/>

      <ToolCta
        title="Για όλα σου τα ακίνητα, χωρίς να το ξαναϋπολογίσεις;"
        body="Το PROPERWISE κρατά ενοίκια, ΕΝΦΙΑ και δαπάνες ανά ακίνητο και δείχνει ποιο αποδίδει, ποιο σε βαραίνει."
      />
    </div>
  );
}
