'use client';
// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΤΕΛΕΥΤΑΙΕΣ ΕΝΟΤΗΤΕΣ ΤΗΣ ΑΠΟΔΟΣΗΣ: ΤΕΛΗ ΚΑΙ ΦΟΡΟΛΟΓΙΑ, ΤΙ ΑΝΕΒΑΖΕΙ ΤΗΝ
// ΑΠΟΔΟΣΗ, ΠΗΓΕΣ
// ─────────────────────────────────────────────────────────────────────────
// Ο φόρος υπολογίζεται στην καρτέλα, πάνω στο χαρτοφυλάκιο του ίδιου
// φορολογούμενου (lib/accounting/taxpayerIncome)· εδώ λέγεται μόνο το «γιατί»
// και ζουν οι δύο διακόπτες παραδοχών που τον αλλάζουν.
// ═══════════════════════════════════════════════════════════════════════════
import { fe, fp, fixedCols } from '@/components/Theme';
import { Landmark, Wallet, Info } from 'lucide-react';
import type { ShortTermResult } from '@/lib/market/shortTerm';
import { YIELD_LEVERS, MARKET_DISCLAIMER, MARKET_SOURCES } from '@/lib/market/greekMarket';
import { CONSOLIDATION_NOTE, PRESUMPTIVE_RULE, type ConsolidatedRentTax } from '@/lib/billing/consolidate';
import { hy } from '@/components/Hyphen';
import { GLOSSARY as G } from '@/lib/market/glossary';
import { InfoHint } from '../InfoHint';
import { rentalBracketsForYear } from '@/lib/billing/greekTax';
import { bracketsSentence, taxLimitAsOf } from '@/lib/facts/taxLimits';
import { asOfLine } from '@/lib/facts/prices';
import { SANS, card, Section, TermInfo, LeverCard, Toggle, type SetState } from './Bits';

/* ═══ Η ΦΟΡΟΛΟΓΙΑ ΕΙΝΑΙ ΕΞΗΓΗΣΗ, ΟΧΙ ΠΡΟΫΠΟΘΕΣΗ ══════════════════════
    Δύο μπλοκ πυκνού κειμένου —τα τέλη της βραχυχρόνιας και οι φορολογικές
    παραδοχές— κάθονταν ΜΕΣΑ στην κάρτα των πεδίων, πάντα ανοιχτά, ανάμεσα
    στον χρήστη και στο αποτέλεσμα. Δηλαδή για να δεις την απόδοσή σου
    έπρεπε να προσπεράσεις δύο παραγράφους για το πώς φορολογείται.
    Τα νούμερα που περιέχουν είναι ήδη μέσα στα πλακίδια από πάνω· εδώ
    μένει το «γιατί», για όποιον το ζητήσει. Ο διακόπτης της είσπραξης
    μέσω τράπεζας μένει μαζί τους, γιατί είναι φορολογική παραδοχή. */
export function TaxSection({
  term, empty, st, levyToGuest, setLevyToGuest, individualPerson, rentsBank, setRentsBank,
  consolidated, portfolioTax, annualTax, propertyId, taxYear,
}: {
  term: 'long' | 'short'; empty: boolean; st: ShortTermResult; levyToGuest: boolean; setLevyToGuest: SetState<boolean>;
  individualPerson: boolean; rentsBank: boolean; setRentsBank: SetState<boolean>; consolidated: boolean;
  portfolioTax: ConsolidatedRentTax; annualTax: number; propertyId: string; taxYear: number;
}) {
  return (
    <Section icon={<Landmark size={15} />} title="Τέλη και φορολογία" sub={term === 'short' ? 'Τέλος ανθεκτικότητας, παρεπιδημούντων και πώς προκύπτει ο φόρος' : 'Πώς προκύπτει ο φόρος και τι τον αλλάζει'}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {term === 'short' && (<>
        {!empty && (
          <div style={{ marginTop: 0, padding: '12px 14px', borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: SANS }}>Τέλη βραχυχρόνιας, τον χρόνο</span>
            </div>
            <div {...fixedCols(2, 16, 'start')}>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: SANS, display: 'inline-flex', alignItems: 'center' }}>Τέλος ανθεκτικότητας (ΤΑΚΚ)<TermInfo term="ΤΑΚΚ" text={G.takk} /></span>
                <p className="po-fig" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '3px 0 0', fontFamily: SANS, fontVariantNumeric: 'tabular-nums' }}>{fe(st.climateLevy)}</p>
                {/* ΤΟ ΠΟΣΟ ΕΙΝΑΙ ΤΟ ΙΔΙΟ, Η ΤΣΕΠΗ ΟΧΙ. Χωρίς αυτή τη γραμμή
                    ο ίδιος αριθμός διαβαζόταν ως κόστος του ιδιοκτήτη ακόμη
                    και όταν τον πληρώνει ο επισκέπτης. */}
                <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', margin: '2px 0 0', fontFamily: SANS, lineHeight: 1.45 }}>
                  {levyToGuest ? 'Το εισπράττεις και το αποδίδεις· δεν βαραίνει τα καθαρά σου.' : 'Δεν το χρεώνεις στον επισκέπτη, οπότε μετρά ως δικό σου κόστος.'}
                </p>
              </div>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: SANS, display: 'inline-flex', alignItems: 'center' }}>Τέλος παρεπιδημούντων<TermInfo term="Τέλος παρεπιδημούντων" text={G.transient_tax} /></span>
                <p className="po-fig" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '3px 0 0', fontFamily: SANS, fontVariantNumeric: 'tabular-nums' }}>{st.municipalTax > 0 ? fe(st.municipalTax) : 'Εξαιρείται'}</p>
              </div>
            </div>
            {/* ═══ ΔΥΟ ΑΠΟ ΤΙΣ ΠΕΝΤΕ ΠΡΟΤΑΣΕΙΣ ΗΤΑΝ ΑΝΤΙΓΡΑΦΑ ΤΩΝ ΚΥΚΛΑΚΙΩΝ
                ΠΟΥ ΚΑΘΟΝΤΑΙ ΑΚΡΙΒΩΣ ΑΠΟ ΠΑΝΩ ΤΟΥΣ ═══════════════════════
                Η παράγραφος ξεκινούσε λέγοντας ότι το Τέλος Ανθεκτικότητας
                χρεώνεται ανά διανυκτέρευση με υψηλότερη τιμή στην υψηλή
                περίοδο. Το κυκλάκι δίπλα στην ίδια την ετικέτα το λέει ήδη
                και ΚΑΛΥΤΕΡΑ: δίνει τα ποσά (2€ και 8€ για διαμερίσματα,
                4€ και 15€ για μονοκατοικίες άνω των 80 τετραγωνικών) και
                τους μήνες κάθε περιόδου.

                Η δεύτερη πρόταση έλεγε ότι το τέλος παρεπιδημούντων 0,5%
                εξαιρεί όσους έχουν έως δύο ακίνητα. Το διπλανό κυκλάκι λέει
                ακριβώς αυτό, με το ίδιο ποσοστό και το ίδιο όριο.

                Μετρημένο στην οθόνη του χρήστη: το ανοιχτό κυκλάκι έπεφτε
                ΠΑΝΩ στην παράγραφο, οπότε οι δύο διατυπώσεις της ίδιας
                πληροφορίας διαβάζονταν κυριολεκτικά η μία δίπλα στην άλλη.

                Μένουν οι τρεις προτάσεις που δεν λέγονται πουθενά αλλού: το
                κατώφλι της επιχειρηματικής δραστηριότητας, ο Αριθμός
                Μητρώου Ακινήτων και το ποιος επιβεβαιώνει τα τελικά. */}
            <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--text-secondary)', fontFamily: SANS, lineHeight: 1.6 }}>
              {individualPerson ? 'Όταν η δραστηριότητα ξεπεράσει τα όρια (πολλά ακίνητα ή παροχή υπηρεσιών ξενοδοχειακού τύπου), θεωρείται επιχειρηματική και υπάγεται σε ΦΠΑ και στην κλίμακα του άρθρου 15· είναι θέμα του λογιστή.' : 'Ως νομικό πρόσωπο, τα έσοδα υπάγονται σε ΦΠΑ και εταιρική φορολογία, ενώ τα τέλη εκπίπτουν ως δαπάνες.'} Κάθε ακίνητο χρειάζεται Αριθμό Μητρώου Ακινήτων σε κάθε αγγελία. Οι τελικές υποχρεώσεις επιβεβαιώνονται με τον λογιστή ή την ΑΑΔΕ.
            </p>
          </div>
        )}
        </>)}
        {/* ΦΟΡΟΛΟΓΙΚΕΣ ΠΑΡΑΔΟΧΕΣ ─────────────────────────────────
        Η είσπραξη μέσω τράπεζας ήταν καρφωμένη σε `true` μέσα στον κώδικα και
        η έκπτωση 5% παρουσιαζόταν αλλού ως «αυτόματη». Είναι απόφαση του
        χρήστη με μετρήσιμη συνέπεια στον φόρο του, άρα ζει στην οθόνη. */}
    {/* Η ΠΑΡΑΔΟΧΗ ΚΑΤΑΓΡΑΦΕΤΑΙ ΓΙΑ ΤΟΝ ΦΑΚΕΛΟ, ΑΛΛΑ Η ΚΥΡΩΣΗ ΔΕΝ ΙΣΧΥΕΙ ΑΚΟΜΗ.
        Το `rentsBank` δηλώνει τον τρόπο είσπραξης· η προϋπόθεση της τράπεζας
        (ν.5222/2025) θα κόβει την έκπτωση 5% από 1.7.2027 (Α.1187/2026). Για
        τις χρήσεις 2025-2026 η έκπτωση δίνεται ανεξάρτητα, οπότε ο φόρος εδώ
        δεν μεταβάλλεται με τον διακόπτη — η υπόθεση μένει ορατή και ειλικρινής
        αντί να δείχνει απώλεια που δεν συμβαίνει ακόμη. */}
    {!empty && (
      <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
        <span style={{ display: 'block', fontSize: 'var(--fs-xs)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: SANS, marginBottom: 10 }}>Φορολογικές παραδοχές</span>
        <Toggle checked={rentsBank} onChange={setRentsBank}
          label="Τα ενοίκια εισπράττονται μέσω τράπεζας"
          note={PRESUMPTIVE_RULE} />
        {/* Η ΔΕΥΤΕΡΗ ΠΑΡΑΔΟΧΗ ΗΤΑΝ ΚΑΡΦΩΜΕΝΗ ΚΑΙ ΑΟΡΑΤΗ, ΟΠΩΣ ΗΤΑΝ ΚΑΙ Η
            ΠΡΩΤΗ. Η οθόνη αφαιρούσε ολόκληρο το ΤΑΚΚ από τα καθαρά, ενώ η
            Λογιστική αφαιρεί μόνο όσο δεν εισπράχθηκε: δύο αλήθειες για το
            ίδιο τέλος, με διαφορά ως 1.500€ τον χρόνο. Τώρα το λέει ο
            ιδιοκτήτης μία φορά· το ακολουθούν και οι δύο. */}
        {term === 'short' && (
          <div style={{ marginTop: 10 }}>
            <Toggle checked={levyToGuest} onChange={setLevyToGuest}
              label="Χρεώνω το τέλος ανθεκτικότητας στον επισκέπτη"
              note="Ο νόμος το βάζει στον επισκέπτη και ο ιδιοκτήτης το αποδίδει. Οι πλατφόρμες όμως δεν έχουν πεδίο γι᾽ αυτό στην Ελλάδα: αν δεν το ζητήσεις ρητά, βγαίνει από την τσέπη σου." />
          </div>
        )}
        <p className="po-prose po-just" style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--text-secondary)', fontFamily: SANS }}>
          {hy(<>{consolidated
            ? <>{CONSOLIDATION_NOTE} Το χαρτοφυλάκιό σου: <strong style={{ color: 'var(--text-primary)' }}>{portfolioTax.count} ακίνητα</strong> με ενοίκια {fe(portfolioTax.totalAnnualRent)} και συνολικό φόρο {fe(portfolioTax.totalTax)} (μέσος συντελεστής {fp(portfolioTax.effectiveRate * 100)}, οριακός {fp(portfolioTax.marginalRate * 100)}). Το μερίδιο αυτού του ακινήτου είναι <strong style={{ color: 'var(--text-primary)' }}>{fe(annualTax)}</strong>. Αν υπολογιζόταν μόνο του, θα έδειχνε {fe(portfolioTax.perProperty.find(p => p.id === propertyId)?.standaloneTax ?? 0)}, δηλαδή λιγότερα από την πραγματικότητα.</>
            : <>{/* Μένει ο ΔΙΚΟΣ ΣΟΥ συντελεστής, που είναι το νούμερο της
                   απόφασης. Η κλίμακα είναι πίνακας αναφοράς: τη βλέπεις
                   μία φορά και μετά σε ενδιαφέρει μόνο πού πέφτεις. */}
                Έχεις ένα ακίνητο με εισόδημα, οπότε ο φόρος του είναι όλος ο φόρος σου. Οριακός συντελεστής <strong style={{ color: 'var(--text-primary)' }}>{fp(portfolioTax.marginalRate * 100)}</strong>.{' '}
                {/* Η ΚΛΙΜΑΚΑ ΑΠΟ ΤΑ ΚΛΙΜΑΚΙΑ ΠΟΥ ΥΠΟΛΟΓΙΖΟΥΝ ΤΟΝ ΦΟΡΟ ΚΑΙ ΟΧΙ ΑΠΟ ΤΟ
                    ΧΕΡΙ, με το πότε ελέγχθηκε (lib/facts/taxLimits). */}
                <InfoHint label={`Η κλίμακα ενοικίων ${taxYear}`}>
                  <span style={{ display: 'block' }}>Ο φόρος υπολογίζεται με την προοδευτική κλίμακα ενοικίων {taxYear}, στο σύνολο των ενοικίων σου: {bracketsSentence(rentalBracketsForYear(taxYear))}.</span>
                  <span style={{ display: 'block', marginTop: 6, color: 'var(--text-tertiary)' }}>{asOfLine(taxLimitAsOf('rent'))}</span>
                </InfoHint></>}</>)}
        </p>
      </div>
    )}
      </div>
    </Section>
  );
}

// Μοχλοί μεγιστοποίησης — επαγγελματίας (πλήρες) / ιδιώτης (μόνο βασικά)
export function LeversSection({ pro }: { pro: boolean }) {
  return (
    <Section icon={<Wallet size={15} />} title="Τι ανεβάζει την απόδοση" sub={pro ? 'Συγκεκριμένες κινήσεις με μετρήσιμη επίδραση και κίνδυνο' : 'Απλές κινήσεις με μετρήσιμο αποτέλεσμα'}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {YIELD_LEVERS.filter(l => pro || l.audience === 'all').map(l => (
          <LeverCard key={l.key} lever={l} />
        ))}
      </div>
      {/* ΑΦΑΙΡΕΘΗΚΕ ΤΟ ΚΟΥΤΙ «ΗΛΕΚΤΡΟΝΙΚΟΣ ΠΛΕΙΣΤΗΡΙΑΣΜΟΣ». Καθόταν δέκα
          εικονοστοιχεία κάτω από τον πρώτο μοχλό, που λέγεται «Αγορά κάτω από
          την αγορά (ηλεκτρονικός πλειστηριασμός)» και επαναλάμβανε τα ίδια
          ακριβώς νούμερα: δύο άγονοι στο 80%, ο τρίτος στο 65%, ένας στους
          επτά βρίσκει αγοραστή. Ό,τι είχε παραπάνω —η εγγύηση, το τέλος
          συστήματος και η προειδοποίηση ότι η μείωση είναι νομικό κατώφλι και
          όχι εγγυημένη έκπτωση— μετακόμισε ΜΕΣΑ στον μοχλό, εκεί που το
          διαβάζει όποιος ενδιαφέρεται. */}
    </Section>
  );
}

// Πηγές & disclaimer
export function SourcesCard() {
  return (
    <div style={{ ...card, padding: '13px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <Info size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0, marginTop: 2 }} />
        <div>
          {/* ΤΟ ΟΡΙΟ ΤΩΝ 74 ΧΑΡΑΚΤΗΡΩΝ ΕΚΟΒΕ ΤΟ ΚΕΙΜΕΝΟ ΚΑΙ ΑΦΗΝΕ ΤΗ ΜΙΣΗ
              ΚΑΡΤΑ ΑΔΕΙΑ. Μετρημένο στα 1440: το κείμενο έπιανε 498
              εικονοστοιχεία μέσα σε κάρτα 1.358, δηλαδή 860 κενά δεξιά του.
              Το `fineprint` το αφήνει να πιάσει ολόκληρο το μέτρο της
              κάρτας, σε μία στήλη, όπως κάθε άλλο κείμενο της οθόνης. */}
          <p className="fineprint" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', margin: 0, fontFamily: SANS }}>{MARKET_DISCLAIMER}</p>
          {/* Μία σειρά. Το `flexWrap` μένει ως δίχτυ για πολύ στενή οθόνη ή
              για τη ρύθμιση «μεγαλύτερο κείμενο» — δεν είναι η κανονική
              κατάσταση, είναι η υποχώρηση. */}
          <div style={{ display: 'flex', columnGap: 14, rowGap: 0, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
            {/* ΜΕΤΡΗΜΕΝΟΙ ΣΤΑ 17. Τέσσερις σύνδεσμοι σε γραμμή 11 στιγμών,
                δηλαδή τέσσερις στόχοι αφής στο 39% του ορίου των 44. Η
                κλάση δίνει το ύψος ΜΟΝΟ στο δάχτυλο· στο ποντίκι η γραμμή
                μένει όσο ήταν. */}
            {MARKET_SOURCES.map(s => <a key={s.href} href={s.href} target="_blank" rel="noreferrer" className="tap-link" style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent)', textDecoration: 'none', fontFamily: SANS }}>{s.label}</a>)}
          </div>
        </div>
      </div>
    </div>
  );
}
