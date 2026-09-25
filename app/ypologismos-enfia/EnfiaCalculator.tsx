'use client';
import { OBJECTIVE_VALUES } from '@/lib/tax/aade';
// ═══════════════════════════════════════════════════════════════════════════
// ΔΩΡΕΑΝ ΥΠΟΛΟΓΙΣΤΗΣ ΕΝΦΙΑ — ο διαδραστικός πυρήνας
// ─────────────────────────────────────────────────────────────────────────
// Ίδια αρχή με τον υπολογιστή φόρου ενοικίων: η λογική υπάρχει ήδη δοκιμασμένη
// στο lib/billing/enfia.ts, με νομική παραπομπή ανά συντελεστή. Εδώ απλώς
// γίνεται προσβάσιμη χωρίς εγγραφή.
//
// ΤΙ ΖΗΤΑΜΕ, ΚΑΙ ΓΙΑΤΙ ΤΟΣΟ ΛΙΓΑ
// Ο πλήρης ΕΝΦΙΑ θέλει δεκάδες πεδία. Ο επισκέπτης όμως δεν έχει λόγο να μας
// αφιερώσει δέκα λεπτά πριν μας ξέρει και τα τέσσερα πεδία εδώ καλύπτουν τη
// συντριπτική πλειονότητα των διαμερισμάτων: τετραγωνικά, τιμή ζώνης, όροφος,
// παλαιότητα. Το ποσοστό ιδιοκτησίας μπαίνει μόνο όταν δεν είναι 100%.
//
// Η ΤΙΜΗ ΖΩΝΗΣ ΕΙΝΑΙ ΤΟ ΜΟΝΟ ΔΥΣΚΟΛΟ. Δεν τη θυμάται κανείς απ' έξω, οπότε
// λέμε ΠΟΥ τη βρίσκει αντί να την απαιτήσουμε σιωπηλά.
//
// ΤΙ ΔΕΝ ΜΑΝΤΕΥΟΥΜΕ: η συνολική αξία της ακίνητης περιουσίας καθορίζει και τη
// μείωση και την προσαύξηση. Την υπολογίζουμε από το ΙΔΙΟ ακίνητο όταν ο
// χρήστης δεν πει άλλο — και το γράφουμε καθαρά, γιατί όποιος έχει και δεύτερο
// ακίνητο θα δει διαφορετικό ποσό στο εκκαθαριστικό.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useId, useState } from 'react';
import { T, feAuto, fixedCols } from '@/components/tokens';
import { fn, fpRate, feRate, feSigned, feWhole } from '@/lib/core/format';
import { parseAmount } from '@/lib/core/greek';
import { estimateENFIA, zoneKeyFromPricePerSqm, enfiaFloorCoef, enfiaAgeCoef, ENFIA_ZONE_TAX, ENFIA_FLOOR_COEF, ENFIA_AGE_BANDS } from '@/lib/billing/enfia';
import { ENFIA_FLOOR_LABEL } from '@/lib/billing/enfiaFloors';
import { enfiaInstalments, ENFIA_INSTALMENTS } from '@/lib/tools/enfiaSchedule';
import { smallSettlementRelief } from '@/lib/tools/enfiaRelief';
import { enfiaLedger, enfiaWealthBracketLimit } from '@/lib/tools/enfiaLedger';
import { useToolState, ToolActions, ToolPaper, ToolPaperFoot } from '@/app/ToolShare';
import { ToolCta, EstimateNote, ToolClampNote } from '@/app/PublicChrome';
import { ToolNumField, ToolSelect, ToolFigure, ToolLedger } from '@/app/ToolParts';
import { Btn } from '@/components/Theme';

import LiveResult from '@/components/LiveResult';
const amount = (s: string): number => Math.max(0, parseAmount(s) ?? 0);

/** Τα πεδία όπως ταξιδεύουν στη διεύθυνση, με τις προεπιλογές τους. */
const SPEC = { tm: '85', zoni: '1400', orofos: 'second', palaiotita: 'y26_plus', pososto: '100' } as const;
const PATH = '/ypologismos-enfia';

// Οι ετικέτες αντλούνται από τα ΚΛΕΙΔΙΑ του lib, ώστε αν προστεθεί συντελεστής
// να μη μείνει η οθόνη πίσω σιωπηλά.
// Οι ετικέτες ζουν στο lib/billing/enfiaFloors.ts, κοινές με τον πίνακα ελέγχου.
const FLOORS: { key: keyof typeof ENFIA_FLOOR_COEF; label: string }[] =
  (Object.keys(ENFIA_FLOOR_COEF) as (keyof typeof ENFIA_FLOOR_COEF)[]).map(key => ({ key, label: ENFIA_FLOOR_LABEL[key] }));
// Τα κλιμάκια παλαιότητας ΔΕΝ ξαναγράφονται εδώ: έρχονται από το enfia.ts, μαζί
// με τις ετικέτες τους. Πριν, οι δύο οθόνες είχαν διαφορετικά λεκτικά για το
// ίδιο κλειδί — και καμία δεν είχε το κλιμάκιο 15-19 ετών.
const AGES = ENFIA_AGE_BANDS;

export function EnfiaCalculator({ year, today }: { year: number; today: string }) {
  const [v, set] = useToolState(SPEC, PATH);
  const sqm = v.tm, zonePrice = v.zoni, floor = v.orofos, age = v.palaiotita, ownership = v.pososto;
  const ids = { sqm: useId(), zone: useId(), floor: useId(), age: useId(), own: useId() };

  // Ο ΚΑΝΟΝΑΣ ΤΟΥ ΠΟΣΟΣΤΟΥ ΓΡΑΦΕΤΑΙ ΜΙΑ ΦΟΡΑ: τον διαβάζουν ο υπολογισμός, το
  // χαρτί και η σημείωση που λέει ότι η τιμή του πεδίου δεν πέρασε ως έχει.
  const own = Math.min(100, Math.max(1, amount(ownership) || 100));
  const smallRelief = smallSettlementRelief(year, true);

  const r = useMemo(() => {
    const m = amount(sqm);
    const price = amount(zonePrice);
    const zone = zoneKeyFromPricePerSqm(price);
    if (!m || !zone) return null;
    // Αντικειμενική αξία κατά προσέγγιση. Δεν είναι ο επίσημος τύπος (που έχει και
    // συντελεστές οικοπέδου/προσόψεων) — είναι η βάση που χρειάζεται ο υπολογισμός
    // για τη μείωση και την προσαύξηση και το λέμε στην οθόνη.
    // ══ ΤΟ ΠΟΣΟΣΤΟ ΙΔΙΟΚΤΗΣΙΑΣ ΕΦΑΡΜΟΖΟΤΑΝ ΔΥΟ ΦΟΡΕΣ ═══════════════════════════
    // Οι δύο τιμές που ζητά η μηχανή ΔΕΝ είναι η ίδια αξία:
    //
    //   `totalValue`     η συνολική περιουσία ΤΟΥ ΦΟΡΟΛΟΓΟΥΜΕΝΟΥ, άρα ΜΕΡΙΔΙΟ
    //   `propertyValue`  η αντικειμενική αξία ΤΟΥ ΑΚΙΝΗΤΟΥ, άρα ΟΛΟΚΛΗΡΗ
    //
    // Εδώ περνούσαν κι οι δύο ίσες με το μερίδιο. Η `enfiaExtraPropertyTax` της
    // Ενότητας Γ κόβει η ίδια στο ποσοστό —το γράφει στην υπογραφή της— οπότε το
    // 50% εφαρμοζόταν δεύτερη φορά — κι μαζί έπεφτε κι το κατώφλι των 400.000€
    // κάτω από το οποίο ο πρόσθετος φόρος δεν υπάρχει καθόλου.
    //
    // ΜΕΤΡΗΜΕΝΟ: 300 τ.μ. σε ζώνη 3.000€/τ.μ. με 50% ιδιοκτησία έβγαζε 731,75€
    // αντί για 1.681,75€. Λάθος 950,00€, ΠΑΝΤΑ προς τα κάτω. Σε δημόσια σελίδα
    // χωρίς εγγραφή αυτό δεν είναι σφάλμα αριθμού, είναι υπόσχεση: κάποιος
    // βάζει στην άκρη 732€ κι το εκκαθαριστικό του ζητά 1.682€.
    //
    // Η ΙΔΙΑ ΕΦΑΡΜΟΓΗ ΤΟ ΕΚΑΝΕ ΗΔΗ ΣΩΣΤΑ ΔΙΠΛΑ: `lib/billing/enfia.ts` γράφει
    // `totalValue: value * pct / 100, propertyValue: value`. Ο δημόσιος
    // υπολογιστής ήταν ο μόνος που διαφωνούσε με τη μηχανή του προϊόντος.
    //
    // Με ιδιοκτησία 100% τα δύο μονοπάτια είναι ταυτόσημα: καμία αλλαγή για τη
    // συντριπτική πλειοψηφία όσων ανοίγουν τη σελίδα.
    const value = m * price;
    const share = value * (own / 100);
    const res = estimateENFIA({
      sqm: m, zone, floor, age, ownership: own,
      totalValue: share, propertyValue: value,
    });
    return res ? { ...res, value, share, own, zone } : null;
  }, [sqm, zonePrice, floor, age, own]);

  // Ο ΚΥΡΙΟΣ ΦΟΡΟΣ, Η ΜΕΙΩΣΗ ΚΑΙ ΤΟ ΕΤΗΣΙΟ ΑΘΡΟΙΖΟΥΝ ΣΤΟ ΛΕΠΤΟ (lib/tools/enfiaLedger.ts).
  const ledger = r ? enfiaLedger(r) : null;
  const controls = fixedCols(5, 14, 'end', 'po-tool-controls fc-5-even fc-xs-2 fc-xxs-1', 6);
  const bracket = r ? enfiaWealthBracketLimit(r.share) : null;

  return (
    <div style={{ fontFamily: T.font.sans }}>
      {/* ΠΕΝΤΕ ΠΕΔΙΑ, ΜΙΑ ΣΕΙΡΑ — ΚΑΙ ΤΟ ΓΙΑΤΙ ΔΕΝ ΗΤΑΝ ΕΤΣΙ, ΜΕΤΡΗΜΕΝΟ.
          Πρώτα ήταν ρητές δύο στήλες (2+2+1: το ποσοστό μόνο του με τρύπα δίπλα
          του). Μετά έγινε σειρά πεδίων με flex-grow, ώστε το τελευταίο να
          απλώνεται αντί να αφήνει τρύπα. Και όντως δεν άφηνε — αλλά έμενε ΜΟΝΟ
          ΤΟΥ σε δεύτερη σειρά, πέρα πέρα, κάτω από τέσσερα κανονικά πεδία.

          ΤΟ ΝΟΥΜΕΡΟ: στα 1440 το δοχείο μετρά 1044 και η βάση του flex είναι
          200 ανά πεδίο· πέντε πεδία με τέσσερα κενά των 14 ζητούν 1056. Δώδεκα
          εικονοστοιχεία λιγότερα από όσα χρειάζονται, δηλαδή η δεύτερη σειρά
          γεννιόταν από δώδεκα εικονοστοιχεία.

          ΤΟ ΠΛΕΓΜΑ ΔΕΝ ΡΩΤΑΕΙ ΑΝ ΧΩΡΑΝΕ, ΤΙΣ ΜΟΙΡΑΖΕΙ. Πέντε στήλες `1fr`
          δίνουν πέντε ίσα πεδία σε ΚΑΘΕ πλάτος, χωρίς κατώφλι να περαστεί: στα
          1044 βγαίνουν 199 το καθένα. Πιο κάτω τα σπασίματα του `fixed-cols`
          κάνουν τη δουλειά τους — 3+2 στην ταμπλέτα, μία στήλη στο τηλέφωνο.

          Η ΣΤΟΙΧΙΣΗ ΕΙΝΑΙ ΣΤΟ ΚΑΤΩ ΑΚΡΟ, ΚΑΙ ΕΧΕΙ ΛΟΓΟ. Στη στενή ζώνη
          821–845 το πεδίο πέφτει στα 137 και η ετικέτα «Ποσοστό ιδιοκτησίας»
          τυλίγεται σε δεύτερη γραμμή. Με στοίχιση στην ΑΡΧΗ, αυτό κατέβαζε το
          κουτί του κατά μία γραμμή και τα πέντε κουτιά κάθονταν σε δύο
          στάθμες· με στοίχιση στο ΚΑΤΩ άκρο η ετικέτα μεγαλώνει προς τα πάνω
          και τα κουτιά μένουν σε μία. Καμία στήλη εδώ δεν κουβαλά σημείωση από
          κάτω, οπότε το κάτω άκρο είναι όντως το κουτί. */}
      {/* ΚΑΙ ΣΤΗΝ ΤΑΜΠΛΕΤΑ ΧΩΡΙΣ ΤΡΥΠΑ. Το 3+2 άφηνε κενό κελί κάτω από τον
          όροφο στα 820. Έξι λωρίδες κάνουν τα πέντε 3+2 ΖΥΓΙΣΜΕΝΑ (δύο λωρίδες
          το καθένα από πάνω, τρεις από κάτω). Στο τηλέφωνο τα δύο ποσά μένουν
          δίπλα δίπλα και οι επιλογείς με το ποσοστό παίρνουν όλο το πλάτος,
          γιατί στη μισή στήλη το «26 έτη και άνω» κοβόταν (`.fc-5-even` στο
          globals.css). Κάτω από τα 340 όλα γίνονται μία στήλη. */}
      <div {...controls} style={{ ...controls.style, '--fc-sm': 2 } as React.CSSProperties}>
        <ToolNumField id={ids.sqm} label="Τετραγωνικά" value={sqm} onChange={x => set('tm', x)}/>
        <ToolNumField id={ids.zone} label="Τιμή ζώνης" value={zonePrice} onChange={x => set('zoni', x)}
          unit="€/τ.μ." unitPad={52}/>
        <ToolSelect label="Όροφος" value={floor} onChange={x => set('orofos', x)}
          options={FLOORS.map(f => ({ value: f.key, label: f.label }))}/>
        <ToolSelect label="Παλαιότητα" value={age} onChange={x => set('palaiotita', x)}
          options={AGES.map(a => ({ value: a.key, label: a.label }))}/>
        <ToolNumField id={ids.own} label="Ποσοστό ιδιοκτησίας" value={ownership} onChange={x => set('pososto', x)}
          unit="%" mode="numeric"/>
      </div>

      <ToolClampNote notes={[
        own !== amount(ownership) && `Το ποσοστό ιδιοκτησίας μετρά από 1% έως 100%· υπολογίστηκε με ${fpRate(own)}.`,
      ]}/>

      <p className="po-tool-controls" style={{ margin: '10px 0 0', fontSize: 12, lineHeight: 1.7, color: 'var(--text-tertiary)' }}>
        Την τιμή ζώνης τη βρίσκεις στο συμβόλαιο, στο Ε9 ή στον{' '}
        <a href={OBJECTIVE_VALUES} target="_blank" rel="noopener noreferrer"
          style={{ color: 'var(--accent)' }}>χάρτη αντικειμενικών αξιών (valuemaps.gov.gr)</a>.
      </p>

      {/* ── Η κεφαλίδα του χαρτιού, πάνω από το αποτέλεσμα ─────────────── */}
      {r && <ToolPaper title={`Εκτίμηση ΕΝΦΙΑ ${year}`} on={today} inputs={[
        { k: 'Τετραγωνικά', v: fn(amount(sqm), 2) },
        { k: 'Τιμή ζώνης', v: `${feAuto(amount(zonePrice))}/τ.μ.` },
        { k: 'Όροφος', v: FLOORS.find(f => f.key === floor)?.label ?? floor },
        { k: 'Παλαιότητα', v: AGES.find(a => a.key === age)?.label ?? age },
        { k: 'Ποσοστό ιδιοκτησίας', v: fpRate(own) },
      ]}/>}

      {/* ── Το αποτέλεσμα ──────────────────────────────────────────────── */}
      <div className="po-tool-result" style={{
        marginTop: 20, padding: 'clamp(18px, 4vw, 26px)', borderRadius: T.radius.card,
        background: 'var(--surface-raised)', border: '1px solid var(--border-raised)',
        boxShadow: 'var(--well-inset)',
      }}>
        {!r || !ledger ? (
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)' }}>
            Συμπλήρωσε τετραγωνικά και τιμή ζώνης για να δεις την εκτίμηση.
          </p>
        ) : (
          <>
            {/* ΤΟ ΚΟΚΚΙΝΟ ΕΦΥΓΕ. Ο ΕΝΦΙΑ τυπωνόταν σε `--negative`, δηλαδή στο
                χρώμα που η εφαρμογή κρατά για σφάλμα. Ο φόρος δεν είναι σφάλμα
                ούτε κίνδυνος· είναι υποχρέωση που μετρήθηκε. Ο αδελφός
                υπολογιστής ενοικίων το είχε ήδη διορθώσει, αυτός όχι.

                ΔΥΟ ΝΟΥΜΕΡΑ, ΟΧΙ ΤΡΙΑ. Η αντικειμενική αξία ανέβαινε τρίτη στη
                σειρά των μεγάλων, ενώ είναι ΕΝΔΙΑΜΕΣΟ μέγεθος που βγαίνει από
                όσα μόλις πληκτρολόγησε ο χρήστης· κατεβαίνει στην ανάλυση, όπου
                ανήκει. Μένουν το ετήσιο και ο μήνας: αυτό που χρωστάς και αυτό
                που πρέπει να βρίσκεις κάθε μήνα. */}
            <div {...fixedCols(2, 24, 'start')}>
              <ToolFigure label="ΕΝΦΙΑ ετησίως" value={feAuto(r.annual)}/>
              {/* Το «σε 12 δόσεις» έφυγε από την ετικέτα: το λέει πλέον ο
                  πίνακας των δόσεων από κάτω, με ημερομηνίες. */}
              <ToolFigure label="Ανά μήνα" value={feAuto(r.annual / ENFIA_INSTALMENTS)}/>
            </div>
              <LiveResult say={`ΕΝΦΙΑ ${feAuto(r.annual)} τον χρόνο, ${feAuto(r.annual / ENFIA_INSTALMENTS)} τον μήνα.`} />

            <div style={{ height: 1, background: 'var(--border-subtle)', margin: '20px 0 16px' }}/>

            {/* Η ΑΝΑΛΥΣΗ ΔΕΙΧΝΕΙ ΤΩΡΑ ΑΠΟ ΠΟΥ ΒΓΗΚΕ Ο ΑΡΙΘΜΟΣ. Έδειχνε μόνο τον
                κύριο φόρο και τη μείωση: τρία νούμερα σε πλέγμα δύο στηλών, με
                ορφανό κελί και κανένα ίχνος των τριών συντελεστών που κάνουν
                όλη τη δουλειά. Ο αδελφός υπολογιστής ενοικίων τυπώνει ολόκληρη
                την κλίμακα ακριβώς γι' αυτόν τον λόγο: ο ιδιοκτήτης που βλέπει
                από πού βγαίνει το ποσό μπορεί να το ελέγξει.

                Το «Σύνολο πριν τη μείωση» δοκιμάστηκε και αφαιρέθηκε: χωρίς
                πρόσθετο φόρο και χωρίς προσαύξηση ισούται με τον κύριο φόρο,
                δηλαδή τύπωνε το ΙΔΙΟ νούμερο δύο σειρές πιο κάτω.

                Η ΔΟΣΗ ΕΔΕΙΧΝΕ 16,00€ ΔΙΠΛΑ ΣΕ 180,28€ ΕΤΗΣΙΩΣ. Το `installment`
                του lib είναι `ceil(ετήσιο/12)`, δηλαδή στρογγυλεμένο προς τα πάνω
                σε ακέραια ευρώ και υπάρχει για την πρόβλεψη ταμείου μέσα στην
                εφαρμογή. Εδώ όμως στεκόταν δίπλα στο ετήσιο και δώδεκα φορές το
                16 κάνει 192: ο επισκέπτης διάβαζε δύο νούμερα που δεν βγαίνουν
                μεταξύ τους. Σε σελίδα που ρωτά «πόσο θα πληρώσεις», η διαίρεση
                γίνεται ακριβής. */}
            {/* ΜΙΑ ΣΤΗΛΗ, ΜΕ ΤΗ ΣΕΙΡΑ ΤΟΥ ΥΠΟΛΟΓΙΣΜΟΥ, ΚΑΙ ΚΛΕΙΝΕΙ ΜΕ ΤΟ ΕΤΗΣΙΟ.
                Σε πλέγμα δύο στηλών η αλυσίδα διαβαζόταν ζιγκ-ζαγκ και καμία
                γραμμή δεν έλεγε «άρα». Πρώτα όσα μπαίνουν στον τύπο, με το
                γκρι των παραμέτρων· μετά τα ποσά, που αθροίζουν στο λεπτό
                (lib/tools/enfiaLedger.ts).

                Η ΑΞΙΑ ΠΟΥ ΓΡΑΦΕΤΑΙ ΕΙΝΑΙ ΤΟΥ ΑΚΙΝΗΤΟΥ, ΟΧΙ ΤΟΥ ΜΕΡΙΔΙΟΥ: ο
                πρόσθετος φόρος για αξία πάνω από 400.000€ κρίνεται πάνω σε
                αυτήν. Το μερίδιο μπαίνει δική του σειρά όταν υπάρχει, γιατί
                αυτό κρίνει τη μείωση και την προσαύξηση.

                ΑΚΕΡΑΙΑ ΕΥΡΩ ΓΙΑ ΤΗΝ ΑΞΙΑ. Είναι εκτίμηση από τετραγωνικά επί τιμή
                ζώνης· τα λεπτά της θα υπόσχονταν ακρίβεια που δεν έχει. Λεπτά
                κρατούν μόνο τα ποσά του φόρου. */}
            <ToolLedger rows={[
              { k: 'Αντικειμενική αξία ακινήτου (εκτίμηση)', v: feWhole(r.value), kind: 'param' },
              r.own < 100 && { k: `Το μερίδιό σου (${fpRate(r.own)})`, v: feWhole(r.share), kind: 'param' },
              { k: 'Βασικός φόρος ζώνης', v: `${feRate(ENFIA_ZONE_TAX[r.zone] ?? 0)}/τ.μ.`, kind: 'param' },
              { k: 'Συντελεστής ορόφου', v: fn(enfiaFloorCoef(floor), 2), kind: 'param' },
              { k: 'Συντελεστής παλαιότητας', v: fn(enfiaAgeCoef(age), 2), kind: 'param' },
              { k: 'Κύριος φόρος κτίσματος', v: feAuto(ledger.basic) },
              ledger.extra > 0 && { k: 'Πρόσθετος φόρος (αξία πάνω από 400.000€)', v: feAuto(ledger.extra) },
              ledger.supplementary > 0 && { k: 'Προσαύξηση (περιουσία πάνω από 500.000€)', v: feAuto(ledger.supplementary) },
              r.reductionPct > 0 && {
                k: `Αυτόματη μείωση ${fpRate(r.reductionPct)}${bracket ? ` (περιουσία έως ${feWhole(bracket)})` : ''}`,
                v: feSigned(-ledger.reduction),
              },
              { k: 'ΕΝΦΙΑ ετησίως', v: feAuto(r.annual), kind: 'total' },
            ]}/>
          </>
        )}
      </div>

      {r && <Instalments annual={r.annual} year={year} today={today}/>}

      <ToolActions path={PATH} spec={SPEC} values={v}/>

      {/* ── Τι ΔΕΝ περιλαμβάνει ──────────────────────────────────────────── */}
      <div className="po-tool-note" style={{
        marginTop: T.sp.xl, padding: '14px 16px', borderRadius: T.radius.inner,
        background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
      }}>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: 'var(--text-secondary)' }}>
          <strong style={{ color: 'var(--text-primary)' }}>Τι δεν περιλαμβάνει.</strong>{' '}
          Η εκτίμηση αφορά <strong>ένα κτίσμα</strong> και θεωρεί τη συνολική σου
          ακίνητη περιουσία <strong>ίση με αυτό</strong>. Αν έχεις κι άλλα ακίνητα, οικόπεδα
          ή αποθήκες, η μείωση και η προσαύξηση αλλάζουν, οπότε το ποσό στο εκκαθαριστικό
          θα διαφέρει. Δεν περιλαμβάνει τις νόμιμες εκπτώσεις και απαλλαγές που θέλουν
          κριτήρια (χαμηλό εισόδημα, τρίτεκνοι, αναπηρία), την έκπτωση για ασφαλισμένη
          κατοικία{smallRelief && <>, {smallRelief}</>} ούτε τους ειδικούς συντελεστές
          οικοπέδου και πρόσοψης. Αν δικαιούσαι κάποια έκπτωση ή απαλλαγή, έλεγξέ το με
          τον λογιστή σου. <EstimateNote />
        </p>
      </div>

      <ToolPaperFoot path={PATH} spec={SPEC} values={v}/>

      <ToolCta
        title="Έχεις περισσότερα από ένα ακίνητα;"
        body="Το PROPERWISE εκτιμά τον ΕΝΦΙΑ για όλα σου τα ακίνητα μαζί, με τη μείωση που αντιστοιχεί στη συνολική περιουσία και σου θυμίζει κάθε δόση πριν λήξει."
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΔΟΣΕΙΣ, ΜΕ ΗΜΕΡΟΜΗΝΙΑ Η ΚΑΘΕΜΙΑ
// ─────────────────────────────────────────────────────────────────────────
// Η σελίδα απαντούσε «πόσο» και σταματούσε. Ο ιδιοκτήτης όμως δεν πληρώνει ένα
// ποσό, πληρώνει δώδεκα — και η επόμενη ερώτησή του, μία ανάσα μετά το νούμερο,
// είναι «πότε». Χωρίς ημερομηνίες, το «ανά μήνα» είναι διαίρεση διά δώδεκα και
// τίποτα άλλο: δεν μπαίνει σε προϋπολογισμό, δεν μπαίνει σε ημερολόγιο.
//
// ΤΙ ΕΙΝΑΙ ΒΕΒΑΙΟ ΚΑΙ ΤΙ ΤΥΠΙΚΟ, ΓΡΑΜΜΕΝΟ ΧΩΡΙΣ ΩΡΑΙΟΠΟΙΗΣΗ. Ο ΚΑΝΟΝΑΣ (δώδεκα
// μηνιαίες δόσεις, τελευταία εργάσιμη κάθε μήνα, από τον Μάρτιο ώς τον
// Φεβρουάριο) είναι σταθερός τα τελευταία χρόνια· οι ΑΚΡΙΒΕΙΣ ημερομηνίες
// ανακοινώνονται κάθε χρόνο με απόφαση. Ο πίνακας το λέει από κάτω, με τα ίδια
// λόγια που το λέει και το φορολογικό ημερολόγιο μέσα στην εφαρμογή.
// ═══════════════════════════════════════════════════════════════════════════
// ── ΤΟΝ ΣΕΠΤΕΜΒΡΙΟ ΟΙ ΕΞΙ ΠΡΩΤΕΣ ΕΧΟΥΝ ΛΗΞΕΙ ──────────────────────────────
// Ο πίνακας έδειχνε τις δώδεκα ίδιες, ψηλότερος από την κάρτα του αποτελέσματος
// και τις συχνές ερωτήσεις μαζί, χωρίς να λέει ποιες πέρασαν. Ο επισκέπτης
// ρωτά «πότε πληρώνω την επόμενη», οπότε ανοίγει στις τρεις επόμενες και οι
// υπόλοιπες είναι ένα πάτημα μακριά. Οι ληγμένες γράφονται «έληξε» και όχι μόνο
// με χρώμα. Σε χαρτί τυπώνονται και οι δώδεκα.
function Instalments({ annual, year, today }: { annual: number; year: number; today: string }) {
  const [all, setAll] = useState(false);
  const rows = enfiaInstalments(annual, year);
  if (!rows.length) return null;

  const next = rows.findIndex(r => r.date >= today);
  const from = next < 0 ? Math.max(0, rows.length - 3) : Math.min(next, rows.length - 3);
  const shown = (i: number) => all || (i >= from && i < from + 3);

  return (
    <div style={{ marginTop: T.sp.xxl }}>
      <div className="po-table-box">
       <div className="po-scroll-x" style={{ overflowX: 'auto' }}>
        <table className="po-table" style={{ '--tbl-min': '300px' }}>
          {/* Ίδια τυπογραφία λεζάντας με τον πίνακα κλιμακίων του αδελφού
              υπολογιστή: οι δύο σελίδες διαβάζονται ως ένα εργαλείο. */}
          <caption>Οι {ENFIA_INSTALMENTS} δόσεις του {year}</caption>
          <thead>
            <tr>
              <th scope="col">Δόση</th>
              <th scope="col">Καταληκτική ημερομηνία</th>
              <th scope="col" className="num">Ποσό</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const past = row.date < today, isNext = i === next;
              const ink = past ? 'var(--text-tertiary)' : 'var(--text-primary)';
              return (
                <tr key={row.no} className={[isNext ? 'is-on' : '', shown(i) ? '' : 'po-row-more'].filter(Boolean).join(' ') || undefined}>
                  <td style={{ fontVariantNumeric: 'tabular-nums', width: '1%', whiteSpace: 'nowrap', color: ink }}>{row.no}</td>
                  <td style={{ whiteSpace: 'nowrap', color: ink }}>
                    {row.label}
                    {(past || isNext) && (
                      <span style={{ display: 'block', fontSize: 12, fontWeight: isNext ? 600 : 400,
                        color: isNext ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>
                        {past ? 'έληξε' : 'επόμενη'}
                      </span>
                    )}
                  </td>
                  <td className="num" style={{ color: ink, fontWeight: past ? 400 : 600 }}>{feAuto(row.amount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
       </div>
      </div>
      <div className="po-noprint" style={{ marginTop: 10 }}>
        <Btn onClick={() => setAll(a => !a)} expanded={all}>
          {all ? 'Μόνο οι επόμενες' : `Όλες οι ${ENFIA_INSTALMENTS} δόσεις`}
        </Btn>
      </div>
      {/* ΤΕΣΣΕΡΙΣ ΠΡΟΤΑΣΕΙΣ ΠΕΡΑ ΠΕΡΑ, ΜΕ ΤΟΝ ΑΕΡΑ ΤΟΥΣ. Μετρημένο στα 1.024, στα
          1.280 και στα 1.440: 134 χαρακτήρες ανά γραμμή. Το κείμενο δεν στενεύει,
          όπως πουθενά στην εφαρμογή — δοκιμάστηκε ταβάνι πλάτους και άφηνε τη
          μισή κάρτα λευκή. Παίρνει το 1,7 της `.po-prose`, που το γράφει μία
          φορά για κάθε τέτοια παράγραφο του προϊόντος. */}
      <p className="po-prose" style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>
        Οι ημερομηνίες είναι οι τυπικές των τελευταίων ετών, δηλαδή η τελευταία εργάσιμη
        κάθε μήνα· ανακοινώνονται κάθε χρόνο με απόφαση. Ο ΕΝΦΙΑ πληρώνεται εφάπαξ ή σε
        δόσεις. Η τελευταία δόση φέρει τη διαφορά της στρογγυλοποίησης, ώστε οι δώδεκα να
        δίνουν ακριβώς το ετήσιο.
      </p>
    </div>
  );
}
