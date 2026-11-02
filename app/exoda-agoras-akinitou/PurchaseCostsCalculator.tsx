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
import { fmtFor } from '@/lib/core/format';
import { purchaseCosts } from '@/lib/tools/exodaAgoras';
import { useToolState, ToolActions, ToolPaper, ToolPaperFoot } from '@/app/ToolShare';
import { EstimateNote } from '@/app/ToolNotes';
import { ToolNumField, ToolFields, ToolSeg, ToolHero, ToolLedger } from '@/app/ToolParts';
import LiveResult from '@/components/LiveResult';
import { SPEC, PATH, purchaseInputOf } from './spec';
import { ledgerRows, missingSentence, VAT_PCT, SERVICES_VAT_PCT, CADASTRE_HOME } from './lines';
import { useToolDict, type ToolEn, NO_EN } from '@/lib/i18n/toolEn';
import { localHref } from '@/lib/i18n/paths';

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
  // ── Η ΙΔΙΑ ΟΘΟΝΗ ΣΤΑ ΑΓΓΛΙΚΑ (/en/property-purchase-costs) ─────────────────
  // Τα αγγλικά έρχονται από τον πάροχο του /en (lib/i18n/toolEn.ts)· εδώ δεν
  // εισάγεται κανένα αγγλικό λεξικό, ώστε να μην κατεβαίνει στα ελληνικά.
  const { en: X, locale } = useToolDict('buy'), en = X !== undefined, E = (X?.E ?? NO_EN) as NonNullable<ToolEn['buy']>['E'], path = localHref(locale, PATH);
  const { fe, fp, feSigned } = fmtFor(locale);
  const yesNo = en ? [{ value: 'nai', label: E.yes }, { value: 'oxi', label: E.no }] : YES_NO;
  const [v, set] = useToolState(SPEC, path);
  const ids = {
    timi: useId(), antikeimeniki: useId(), paidia: useId(), ktimatologio: useId(), mesitis: useId(),
    symvolaiografos: useId(), dikigoros: useId(), alla: useId(), daneio: useId(),
  };

  const input = purchaseInputOf(v);
  const r = purchaseCosts(input);
  const newBuild = v.neodmito === 'nai';
  const missing = X ? X.missing(r) : missingSentence(r);
  const mortgageHref = `${localHref(locale, MORTGAGE)}?poso=${Math.round(r.loan)}`;

  return (
    <div style={{ fontFamily: T.font.sans }}>
      {/* ── ΤΟ ΑΚΙΝΗΤΟ ───────────────────────────────────────────────────── */}
      <Group title={en ? E.property : 'Το ακίνητο'} first>
        <ToolFields>
          <ToolNumField id={ids.timi} label={en ? E.price : 'Τίμημα'} value={v.timi} onChange={x => set('timi', x)} unit="€"
            hint={en ? E.priceHint : 'Το ποσό του συμβολαίου.'}/>
          <ToolNumField id={ids.antikeimeniki} label={en ? E.objective : 'Αντικειμενική αξία'} value={v.antikeimeniki}
            onChange={x => set('antikeimeniki', x)} unit="€"
            hint={en ? E.objectiveHint : 'Αν είναι μεγαλύτερη από το τίμημα, ο φόρος βγαίνει σε αυτήν. Κενό: ίδια με το τίμημα.'}/>
          <ToolSeg label={en ? E.newBuild : 'Νεόδμητο από κατασκευαστή;'} value={v.neodmito} onChange={x => set('neodmito', x)}
            options={yesNo}/>
        </ToolFields>
        {newBuild && (
          <div style={{ marginTop: T.sp.lg }}>
            <ToolFields>
              <ToolSeg label={en ? E.suspended : 'Ο κατασκευαστής είναι σε αναστολή ΦΠΑ;'} value={v.anastoli} onChange={x => set('anastoli', x)}
                options={yesNo} span="row"
                hint={en ? E.suspendedHint(vatUntil) : `Η αναστολή δίνεται με αίτηση του κατασκευαστή και ισχύει έως ${vatUntil}: τότε πληρώνεις φόρο μεταβίβασης. Χωρίς αναστολή πληρώνεις ΦΠΑ ${VAT_PCT} στο τίμημα. Ρώτα τον πωλητή τι ισχύει.`}/>
            </ToolFields>
          </div>
        )}
      </Group>

      {/* ── ΠΡΩΤΗ ΚΑΤΟΙΚΙΑ ──────────────────────────────────────────────────
          Μόνο όπου υπάρχει φόρος μεταβίβασης: ο ΦΠΑ δεν έχει αυτή την απαλλαγή. */}
      {r.transferTaxApplies && (
        <Group title={en ? E.firstHome : 'Πρώτη κατοικία'}>
          <ToolFields>
            <ToolSeg label={en ? E.exemption : 'Απαλλαγή πρώτης κατοικίας;'} value={v.proti} onChange={x => set('proti', x)}
              options={yesNo}
              hint={en ? E.exemptionHint : "Έχει προϋποθέσεις, ανάμεσά τους να μην έχεις ήδη κατοικία που καλύπτει τις ανάγκες σου και να κρατήσεις το ακίνητο πέντε χρόνια."}/>
            {v.proti === 'nai' && (<>
              <ToolSeg label={en ? E.married : 'Έγγαμος ή σύμφωνο συμβίωσης;'} value={v.gamos} onChange={x => set('gamos', x)}
                options={yesNo}/>
              <ToolNumField id={ids.paidia} label={en ? E.children : 'Τέκνα'} value={v.paidia} onChange={x => set('paidia', x)}
                mode="numeric"/>
            </>)}
          </ToolFields>
        </Group>
      )}

      {/* ── ΟΣΑ ΣΥΜΦΩΝΕΙΣ ΕΣΥ ─────────────────────────────────────────────── */}
      <Group title={en ? E.fees : 'Τέλη και αμοιβές'}>
        <ToolFields>
          <ToolNumField id={ids.ktimatologio} label={en ? E.cadastre : 'Κτηματολόγιο'} value={v.ktimatologio}
            onChange={x => set('ktimatologio', x)} unit="€"
            hint={en ? <>{E.cadastreHint[0]}<a href={CADASTRE_HOME} target="_blank" rel="noopener noreferrer" hrefLang="el" className="lp-link" style={LINK}>{E.cadastreHint[1]}</a>{E.cadastreHint[2]}</> : <>Το ποσό που δίνει το{' '}
              <a href={CADASTRE_HOME} target="_blank" rel="noopener noreferrer" className="lp-link" style={LINK}>Κτηματολόγιο</a>
              {' '}ή ο συμβολαιογράφος. Ο υπολογιστής δεν βάζει δικό του ποσό.</>}/>
          <ToolNumField id={ids.mesitis} label={en ? E.agent : 'Μεσιτική αμοιβή'} value={v.mesitis} onChange={x => set('mesitis', x)}
            unit="%" hint={en ? E.agentHint : `Ποσοστό του τιμήματος χωρίς ΦΠΑ· προστίθεται ΦΠΑ ${SERVICES_VAT_PCT}. Μηδέν χωρίς μεσίτη.`}/>
          <ToolNumField id={ids.symvolaiografos} label={en ? E.notary : 'Συμβολαιογράφος'} value={v.symvolaiografos}
            onChange={x => set('symvolaiografos', x)} unit="€"
            hint={en ? E.notaryHint : 'Το ποσό της προσφοράς χωρίς ΦΠΑ. Ο υπολογιστής δεν βάζει δικό του ποσό.'}/>
          <ToolNumField id={ids.dikigoros} label={en ? E.lawyer : 'Δικηγόρος'} value={v.dikigoros} onChange={x => set('dikigoros', x)}
            unit="€" hint={en ? E.lawyerHint : 'Χωρίς ΦΠΑ. Μηδέν αν δεν πάρεις δικηγόρο.'}/>
          <ToolNumField id={ids.alla} label={en ? E.other : 'Λοιπά έξοδα'} value={v.alla} onChange={x => set('alla', x)} unit="€"
            hint={en ? E.otherHint : 'Πιστοποιητικά, μηχανικός, εκτίμηση, όπως τα πληρώνεις.'}/>
        </ToolFields>
      </Group>

      {/* ── ΧΡΗΜΑΤΟΔΟΤΗΣΗ ───────────────────────────────────────────────── */}
      <Group title={en ? E.finance : 'Χρηματοδότηση'}>
        <ToolFields>
          <ToolNumField id={ids.daneio} label={en ? E.loan : 'Δάνειο'} value={v.daneio} onChange={x => set('daneio', x)} unit="€"
            hint={en ? E.loanHint : 'Μηδέν αν αγοράζεις με μετρητά.'}/>
        </ToolFields>
      </Group>

      <ToolPaper title={en ? E.paper : 'Έξοδα αγοράς ακινήτου'} on={today} inputs={en ? [
        { k: E.price, v: fe(r.price) },
        { k: E.pBase, v: fe(r.taxBase) },
        { k: E.pKind, v: !newBuild ? E.used : r.transferTaxApplies ? E.newSuspended : E.newVat },
        { k: E.loan, v: fe(r.loan) },
      ] : [
        { k: 'Τίμημα', v: fe(r.price) },
        { k: 'Βάση φόρου', v: fe(r.taxBase) },
        { k: 'Είδος', v: !newBuild ? 'Μεταχειρισμένο' : r.transferTaxApplies ? 'Νεόδμητο, σε αναστολή ΦΠΑ' : 'Νεόδμητο, με ΦΠΑ' },
        { k: 'Δάνειο', v: fe(r.loan) },
      ]}/>

      {/* ── ΤΑ ΕΞΟΔΑ ──────────────────────────────────────────────────────── */}
      <ResultCard label={en ? E.costs : 'Έξοδα αγοράς'}>
        {r.price <= 0 ? (
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            {en ? E.needPrice : 'Γράψε το τίμημα για να βγουν τα έξοδα.'}
          </p>
        ) : (<>
          <ToolHero primary={{ label: en ? E.costs : 'Έξοδα αγοράς', value: fe(r.total) }}
            secondary={[
              { label: en ? E.share : 'Επί του τιμήματος', value: fp(r.costShare * 100) },
              { label: en ? E.cash : 'Μετρητά εκτός δανείου', value: fe(r.cashNeeded) },
            ]}/>
          <LiveResult say={en ? E.say(fe(r.total), fe(r.cashNeeded)) : `Έξοδα αγοράς ${fe(r.total)}. Μετρητά εκτός δανείου ${fe(r.cashNeeded)}.`}/>
          <div style={{ height: 1, background: 'var(--border-subtle)', margin: '20px 0 16px' }}/>
          <ToolLedger rows={(X ? X.ledgerRows : ledgerRows)(r, input.agentPct ?? 0)}/>
          {missing && <p style={NOTE}>{missing}</p>}
        </>)}
      </ResultCard>

      {/* ── ΤΑ ΜΕΤΡΗΤΑ ───────────────────────────────────────────────────────
          Η ερώτηση που φέρνει τον αγοραστή εδώ από τον υπολογιστή δόσης: πόσα
          χρήματα πρέπει να έχω, πέρα από όσα δίνει η τράπεζα. */}
      {r.price > 0 && (
        <ResultCard label={en ? E.cash : 'Μετρητά εκτός δανείου'}>
          <ToolLedger rows={en ? [
            { k: E.price, v: fe(r.price) },
            { k: E.loan, v: feSigned(-r.loan) },
            { k: E.downPayment, v: fe(r.downPayment), kind: 'param' },
            { k: E.costs, v: fe(r.total) },
            { k: E.cashNeeded, v: fe(r.cashNeeded), kind: 'total' },
          ] : [
            { k: 'Τίμημα', v: fe(r.price) },
            { k: 'Δάνειο', v: feSigned(-r.loan) },
            { k: 'Ίδια συμμετοχή', v: fe(r.downPayment), kind: 'param' },
            { k: 'Έξοδα αγοράς', v: fe(r.total) },
            { k: 'Μετρητά που χρειάζεσαι', v: fe(r.cashNeeded), kind: 'total' },
          ]}/>
          {en ? <p style={NOTE}>{E.cashNote}
            {r.loan > 0 && <>{' '}{E.cashMortgage(fe(r.loan))[0]}<a href={mortgageHref} className="lp-link" style={LINK}>{E.cashMortgage(fe(r.loan))[1]}</a>{E.cashMortgage(fe(r.loan))[2]}</>}
          </p> : <p style={NOTE}>
            Ο υπολογισμός υποθέτει ότι το δάνειο πηγαίνει μόνο στο τίμημα και ότι τα έξοδα πληρώνονται από
            τα δικά σου χρήματα. Δεν περιλαμβάνει έξοδα του δανείου (φάκελος, εκτίμηση, προσημείωση).
            {r.loan > 0 && <>{' '}Τη μηνιαία δόση για τα {fe(r.loan)} τη δείχνει ο{' '}
              <Link href={mortgageHref} className="lp-link" style={LINK}>υπολογισμός στεγαστικού δανείου</Link>.</>}
          </p>}
        </ResultCard>
      )}

      <ToolActions path={path} spec={SPEC} values={v}/>

      <div className="po-tool-note" style={{
        marginTop: T.sp.xl, padding: 'clamp(14px,2.6vw,18px)', borderRadius: T.radius.inner,
        background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
      }}>
        <p style={{ margin: 0, fontSize: 'var(--fs-base)', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
          {en ? <><strong style={{ color: 'var(--text-primary)' }}>{E.notLead}</strong>{' '}{E.not} <EstimateNote en /></> : <>
          <strong style={{ color: 'var(--text-primary)' }}>Τι περιλαμβάνει και τι όχι.</strong>{' '}
          Ο φόρος μεταβίβασης και ο ΦΠΑ του νεόδμητου βγαίνουν από τους συντελεστές του νόμου, με
          την πηγή κάτω από κάθε γραμμή. Τα τέλη του Κτηματολογίου και οι αμοιβές μεσίτη,
          συμβολαιογράφου και δικηγόρου μπαίνουν όπως τις γράφεις. Δεν περιλαμβάνονται τα όρια απαλλαγής για αναπηρία
          ούτε η αγορά οικοπέδου. <EstimateNote /></>}
        </p>
      </div>

      <ToolPaperFoot path={path} spec={SPEC} values={v}/>

      {cta}
    </div>
  );
}
