'use client';
// ═══════════════════════════════════════════════════════════════════════════
// ΕΞΟΔΑ ΑΓΟΡΑΣ ΑΚΙΝΗΤΟΥ: ο διαδραστικός πυρήνας
// ─────────────────────────────────────────────────────────────────────────
// ΤΡΕΙΣ ΕΡΩΤΗΣΕΙΣ, ΜΕ ΤΗ ΣΕΙΡΑ ΠΟΥ ΤΙΣ ΚΑΝΕΙ ΚΑΝΕΙΣ. Πόσα πάνε σε φόρους και
// τέλη, από τι βγαίνει το καθένα και πόσα μετρητά θέλω αν πάρω δάνειο. Η
// αριθμητική ζει στο lib/tools/exodaAgoras.ts· η οθόνη δεν κάνει πράξεις.
//
// ΤΟ ΣΥΝΟΛΟ ΔΕΝ ΠΑΡΙΣΤΑΝΕΙ ΤΟ ΠΛΗΡΕΣ. Όσα δεν ορίζει επαληθευμένη επίσημη πηγή
// (Κτηματολόγιο, μεσίτης, συμβολαιογράφος, δικηγόρος) ξεκινούν από μηδέν και, όσο μένουν
// μηδέν, μια πρόταση κάτω από την ανάλυση λέει ότι δεν περιλαμβάνονται.
// ═══════════════════════════════════════════════════════════════════════════
import { useId, type ReactNode } from 'react';
import Link from 'next/link';
import { T } from '@/components/tokens';
import { fe, fp, feSigned } from '@/lib/core/format';
import { purchaseCosts } from '@/lib/tools/exodaAgoras';
import { useToolState, ToolActions, ToolPaper, ToolPaperFoot } from '@/app/ToolShare';
import { EstimateNote } from '@/app/ToolNotes';
import { ToolNumField, ToolFields, ToolSeg, ToolHero, ToolLedger } from '@/app/ToolParts';
import LiveResult from '@/components/LiveResult';
import { SPEC, PATH, purchaseInputOf } from './spec';
import { ledgerRows, missingSentence, VAT_PCT, SERVICES_VAT_PCT, CADASTRE_HOME } from './lines';

const MORTGAGE = '/ypologismos-stegastikou-daneiou';
const LINK = { color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 } as const;
const YES_NO = [{ value: 'nai', label: 'Ναι' }, { value: 'oxi', label: 'Όχι' }] as const;

/** Ομάδα πεδίων με τίτλο, όπως στους άλλους υπολογιστές. */
function Group({ title, children, first }: { title: string; children: ReactNode; first?: boolean }) {
  return (
    <fieldset className="po-tool-controls" style={{ border: 0, padding: 0, margin: first ? 0 : `${T.sp.xl}px 0 0`, minWidth: 0 }}>
      <legend style={{ padding: 0, margin: '0 0 12px', fontSize: 14, fontWeight: 600,
        color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{title}</legend>
      {children}
    </fieldset>
  );
}

/** Η κάρτα του αποτελέσματος, ίδια γεωμετρία με τους άλλους υπολογιστές. */
function ResultCard({ children, label }: { children: ReactNode; label: string }) {
  return (
    <section aria-label={label} className="po-tool-result" style={{
      marginTop: 20, padding: 'clamp(18px, 4vw, 26px)', borderRadius: T.radius.card,
      background: 'var(--surface-raised)', border: '1px solid var(--border-raised)',
      boxShadow: 'var(--well-inset)',
    }}>{children}</section>
  );
}

const NOTE = { margin: '14px 0 0', fontSize: 'var(--fs-base)', lineHeight: 1.6, color: 'var(--text-secondary)', textWrap: 'pretty' } as const;

export function PurchaseCostsCalculator({ today, vatUntil, cta }: {
  today: string;
  /** Ως πότε ισχύει η αναστολή του ΦΠΑ, από το μητρώο ισχύος (μέσω της σελίδας). */
  vatUntil: string;
  /** Η πρόσκληση του τέλους, αποδομένη στη σελίδα (`ToolCta`). */
  cta: ReactNode;
}) {
  const [v, set] = useToolState(SPEC, PATH);
  const ids = {
    timi: useId(), antikeimeniki: useId(), paidia: useId(), ktimatologio: useId(), mesitis: useId(),
    symvolaiografos: useId(), dikigoros: useId(), alla: useId(), daneio: useId(),
  };

  const input = purchaseInputOf(v);
  const r = purchaseCosts(input);
  const newBuild = v.neodmito === 'nai';
  const missing = missingSentence(r);
  const mortgageHref = `${MORTGAGE}?poso=${Math.round(r.loan)}`;

  return (
    <div style={{ fontFamily: T.font.sans }}>
      {/* ── ΤΟ ΑΚΙΝΗΤΟ ───────────────────────────────────────────────────── */}
      <Group title="Το ακίνητο" first>
        <ToolFields>
          <ToolNumField id={ids.timi} label="Τίμημα" value={v.timi} onChange={x => set('timi', x)} unit="€"
            hint="Το ποσό του συμβολαίου."/>
          <ToolNumField id={ids.antikeimeniki} label="Αντικειμενική αξία" value={v.antikeimeniki}
            onChange={x => set('antikeimeniki', x)} unit="€"
            hint="Αν είναι μεγαλύτερη από το τίμημα, ο φόρος βγαίνει σε αυτήν. Κενό: ίδια με το τίμημα."/>
          <ToolSeg label="Νεόδμητο από κατασκευαστή;" value={v.neodmito} onChange={x => set('neodmito', x)}
            options={YES_NO}/>
        </ToolFields>
        {newBuild && (
          <div style={{ marginTop: T.sp.lg }}>
            <ToolFields>
              <ToolSeg label="Ο κατασκευαστής είναι σε αναστολή ΦΠΑ;" value={v.anastoli} onChange={x => set('anastoli', x)}
                options={YES_NO} span="row"
                hint={`Η αναστολή δίνεται με αίτηση του κατασκευαστή και ισχύει έως ${vatUntil}: τότε πληρώνεις φόρο μεταβίβασης. Χωρίς αναστολή πληρώνεις ΦΠΑ ${VAT_PCT} στο τίμημα. Ρώτα τον πωλητή τι ισχύει.`}/>
            </ToolFields>
          </div>
        )}
      </Group>

      {/* ── ΠΡΩΤΗ ΚΑΤΟΙΚΙΑ ──────────────────────────────────────────────────
          Μόνο όπου υπάρχει φόρος μεταβίβασης: ο ΦΠΑ δεν έχει αυτή την απαλλαγή. */}
      {r.transferTaxApplies && (
        <Group title="Πρώτη κατοικία">
          <ToolFields>
            <ToolSeg label="Απαλλαγή πρώτης κατοικίας;" value={v.proti} onChange={x => set('proti', x)}
              options={YES_NO}
              hint="Έχει προϋποθέσεις, ανάμεσά τους να μην έχεις ήδη κατοικία που καλύπτει τις ανάγκες σου και να κρατήσεις το ακίνητο πέντε χρόνια."/>
            {v.proti === 'nai' && (<>
              <ToolSeg label="Έγγαμος ή σύμφωνο συμβίωσης;" value={v.gamos} onChange={x => set('gamos', x)}
                options={YES_NO}/>
              <ToolNumField id={ids.paidia} label="Τέκνα" value={v.paidia} onChange={x => set('paidia', x)}
                mode="numeric"/>
            </>)}
          </ToolFields>
        </Group>
      )}

      {/* ── ΟΣΑ ΣΥΜΦΩΝΕΙΣ ΕΣΥ ─────────────────────────────────────────────── */}
      <Group title="Τέλη και αμοιβές">
        <ToolFields>
          <ToolNumField id={ids.ktimatologio} label="Κτηματολόγιο" value={v.ktimatologio}
            onChange={x => set('ktimatologio', x)} unit="€"
            hint={<>Το ποσό που δίνει το{' '}
              <a href={CADASTRE_HOME} target="_blank" rel="noopener noreferrer" className="lp-link" style={LINK}>Κτηματολόγιο</a>
              {' '}ή ο συμβολαιογράφος. Ο υπολογιστής δεν βάζει δικό του ποσό.</>}/>
          <ToolNumField id={ids.mesitis} label="Μεσιτική αμοιβή" value={v.mesitis} onChange={x => set('mesitis', x)}
            unit="%" hint={`Ποσοστό του τιμήματος χωρίς ΦΠΑ· προστίθεται ΦΠΑ ${SERVICES_VAT_PCT}. Μηδέν χωρίς μεσίτη.`}/>
          <ToolNumField id={ids.symvolaiografos} label="Συμβολαιογράφος" value={v.symvolaiografos}
            onChange={x => set('symvolaiografos', x)} unit="€"
            hint="Το ποσό της προσφοράς χωρίς ΦΠΑ. Ο υπολογιστής δεν βάζει δικό του ποσό."/>
          <ToolNumField id={ids.dikigoros} label="Δικηγόρος" value={v.dikigoros} onChange={x => set('dikigoros', x)}
            unit="€" hint="Χωρίς ΦΠΑ. Μηδέν αν δεν πάρεις δικηγόρο."/>
          <ToolNumField id={ids.alla} label="Λοιπά έξοδα" value={v.alla} onChange={x => set('alla', x)} unit="€"
            hint="Πιστοποιητικά, μηχανικός, εκτίμηση, όπως τα πληρώνεις."/>
        </ToolFields>
      </Group>

      {/* ── ΧΡΗΜΑΤΟΔΟΤΗΣΗ ───────────────────────────────────────────────── */}
      <Group title="Χρηματοδότηση">
        <ToolFields>
          <ToolNumField id={ids.daneio} label="Δάνειο" value={v.daneio} onChange={x => set('daneio', x)} unit="€"
            hint="Μηδέν αν αγοράζεις με μετρητά."/>
        </ToolFields>
      </Group>

      <ToolPaper title="Έξοδα αγοράς ακινήτου" on={today} inputs={[
        { k: 'Τίμημα', v: fe(r.price) },
        { k: 'Βάση φόρου', v: fe(r.taxBase) },
        { k: 'Είδος', v: !newBuild ? 'Μεταχειρισμένο' : r.transferTaxApplies ? 'Νεόδμητο, σε αναστολή ΦΠΑ' : 'Νεόδμητο, με ΦΠΑ' },
        { k: 'Δάνειο', v: fe(r.loan) },
      ]}/>

      {/* ── ΤΑ ΕΞΟΔΑ ──────────────────────────────────────────────────────── */}
      <ResultCard label="Έξοδα αγοράς">
        {r.price <= 0 ? (
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            Γράψε το τίμημα για να βγουν τα έξοδα.
          </p>
        ) : (<>
          <ToolHero primary={{ label: 'Έξοδα αγοράς', value: fe(r.total) }}
            secondary={[
              { label: 'Επί του τιμήματος', value: fp(r.costShare * 100) },
              { label: 'Μετρητά εκτός δανείου', value: fe(r.cashNeeded) },
            ]}/>
          <LiveResult say={`Έξοδα αγοράς ${fe(r.total)}. Μετρητά εκτός δανείου ${fe(r.cashNeeded)}.`}/>
          <div style={{ height: 1, background: 'var(--border-subtle)', margin: '20px 0 16px' }}/>
          <ToolLedger rows={ledgerRows(r, input.agentPct ?? 0)}/>
          {missing && <p style={NOTE}>{missing}</p>}
        </>)}
      </ResultCard>

      {/* ── ΤΑ ΜΕΤΡΗΤΑ ───────────────────────────────────────────────────────
          Η ερώτηση που φέρνει τον αγοραστή εδώ από τον υπολογιστή δόσης: πόσα
          χρήματα πρέπει να έχω, πέρα από όσα δίνει η τράπεζα. */}
      {r.price > 0 && (
        <ResultCard label="Μετρητά εκτός δανείου">
          <ToolLedger rows={[
            { k: 'Τίμημα', v: fe(r.price) },
            { k: 'Δάνειο', v: feSigned(-r.loan) },
            { k: 'Ίδια συμμετοχή', v: fe(r.downPayment), kind: 'param' },
            { k: 'Έξοδα αγοράς', v: fe(r.total) },
            { k: 'Μετρητά που χρειάζεσαι', v: fe(r.cashNeeded), kind: 'total' },
          ]}/>
          <p style={NOTE}>
            Ο υπολογισμός υποθέτει ότι το δάνειο πηγαίνει μόνο στο τίμημα και ότι τα έξοδα πληρώνονται από
            τα δικά σου χρήματα. Δεν περιλαμβάνει έξοδα του δανείου (φάκελος, εκτίμηση, προσημείωση).
            {r.loan > 0 && <>{' '}Τη μηνιαία δόση για τα {fe(r.loan)} τη δείχνει ο{' '}
              <Link href={mortgageHref} className="lp-link" style={LINK}>υπολογισμός στεγαστικού δανείου</Link>.</>}
          </p>
        </ResultCard>
      )}

      <ToolActions path={PATH} spec={SPEC} values={v}/>

      <div className="po-tool-note" style={{
        marginTop: T.sp.xl, padding: 'clamp(14px,2.6vw,18px)', borderRadius: T.radius.inner,
        background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
      }}>
        <p style={{ margin: 0, fontSize: 'var(--fs-base)', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
          <strong style={{ color: 'var(--text-primary)' }}>Τι περιλαμβάνει και τι όχι.</strong>{' '}
          Ο φόρος μεταβίβασης και ο ΦΠΑ του νεόδμητου βγαίνουν από τους συντελεστές του νόμου, με
          την πηγή κάτω από κάθε γραμμή. Τα τέλη του Κτηματολογίου και οι αμοιβές μεσίτη,
          συμβολαιογράφου και δικηγόρου μπαίνουν όπως τις γράφεις. Δεν περιλαμβάνονται τα όρια απαλλαγής για αναπηρία
          ούτε η αγορά οικοπέδου. <EstimateNote />
        </p>
      </div>

      <ToolPaperFoot path={PATH} spec={SPEC} values={v}/>

      {cta}
    </div>
  );
}
