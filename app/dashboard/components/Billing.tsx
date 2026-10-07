'use client';

// ═══════════════════════════════════════════════════════════════════════════
// ΣΥΝΔΡΟΜΗ ΚΑΙ ΣΤΟΙΧΕΙΑ ΤΙΜΟΛΟΓΗΣΗΣ
// ─────────────────────────────────────────────────────────────────────────
// ΠΟΙΟΣ ΠΟΥΛΑΕΙ, ΔΕΝ ΓΡΑΦΕΤΑΙ ΕΔΩ. Ο έμπορος είναι merchant of record: πουλά
// τη συνδρομή στο δικό του όνομα, εκδίδει το παραστατικό και αποδίδει τον ΦΠΑ
// (lib/billing/invoicing.ts). Εμείς παρέχουμε την Υπηρεσία. Η πρόταση έρχεται
// από τον διακομιστή (`billingWords().chargingToday`), ίδια με εκείνη των
// Ορων και της Πολιτικής απορρήτου, ώστε να μην αποκλίνει από το ταμείο.
//
// ΤΙ ΚΑΝΕΙ Η ΟΘΟΝΗ ΚΑΙ ΤΙ ΔΕΝ ΚΑΝΕΙ. Κρατά τα στοιχεία τιμολόγησης, δείχνει
// την κατάσταση της συνδρομής όπως την ξέρει ο πάροχος και ανοίγει δύο πόρτες
// του: το ταμείο για όποιον δεν έχει συνδρομή και τη διαχείριση συνδρομής για
// όποιον έχει. ΔΕΝ αγγίζει ποτέ το πακέτο: το `plan` γράφεται μόνο από τον
// webhook, με ρόλο υπηρεσίας, αφού η πληρωμή έχει γίνει.
//
// ΚΑΙ ΔΕΝ ΥΠΟΣΧΕΤΑΙ ΚΟΥΜΠΙ ΠΟΥ ΔΕΝ ΥΠΑΡΧΕΙ. Οσο δεν έχει ρυθμιστεί ο πάροχος,
// η κάρτα το λέει καθαρά αντί να δείχνει απενεργοποιημένο κουμπί.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import * as properties from '@/lib/data/properties';
// Το προφίλ χρέωσης έχει ένα σπίτι: lib/data/billing.
import * as billing from '@/lib/data/billing';
import { TextInput, CustomSelect, FIELD_LABEL_ROW } from './UIComponents';
import { T, Btn, LinkBtn, InfoBanner, Spinner, Card, SecHdr, ChipToggle, fixedCols, fe, fd } from '@/components/Theme';
import { PLANS, PLAN_ORDER, normalizePlan, annualPerMonth, type PlanId, type BillingCycle } from '@/lib/billing/plans';
// Η ΦΑΣΗ ΤΗΣ ΣΥΝΔΡΟΜΗΣ ΔΕΝ ΚΡΙΝΕΤΑΙ ΕΔΩ. Οι καταστάσεις τις ονομάζει ο
// έμπορος και τις γράφει ο webhook· η οθόνη τις διαβάζει από την ίδια πηγή.
import { subPhase, cardState } from '@/lib/billing/subscription';
import { ALLOWED_PLANS, planFromParam, cycleFromParam, type ProfileType } from '@/lib/billing/entitlements';
import { SegmentControl } from './UIComponents';
import { notifyError, notifyOk } from '@/components/Toast';
import { ALL_COUNTRIES, isEuCountry, isReverseCharge } from '@/lib/billing/invoiceProfile';
import { determineVat, vatTreatmentLabel } from '@/lib/billing/invoicing';
import { isReferralCode } from '@/lib/referral/referral';

interface BillingData {
  doc_type: string; full_name: string; company_name: string; afm: string; doy: string;
  profession: string; address: string; city: string; postal_code: string; country: string;
  vat_number: string; phone: string; plan: string; billing_cycle: string;
  /** Ο τύπος προφίλ κρίνει ΠΟΙΟ πακέτο αγοράζεται. */
  profile_type: string;
  /** Ο,τι ξέρει ο πάροχος για τη συνδρομή. Διαβάζεται, δεν γράφεται από εδώ. */
  subscription_status: string; mor_renews_at: string; mor_ends_at: string;
  /** Η συνδρομή στον έμπορο. Η ΥΠΑΡΞΗ της κρίνει αν υπάρχει πύλη διαχείρισης. */
  mor_subscription_id: string;
  /** Ο λογαριασμός δοκιμαστή. Οσο υπάρχει, δεν υπάρχει τίποτα να αγοραστεί. */
  tester_since: string;
  /** Υποβάθμιση που περιμένει την ανανέωση: τι κρατιέται και ως πότε. */
  hold_plan: string; hold_until: string;
}
/** Πεδία που δεν ζητούνται πια: σε κάθε αποθήκευση γράφονται κενά. */
const RETIRED_FIELDS = { doy: null, profession: null, address: null, city: null, postal_code: null } as const;

const INIT: BillingData = {
  doc_type: 'receipt', full_name: '', company_name: '', afm: '', doy: '', profession: '',
  address: '', city: '', postal_code: '', country: 'GR', vat_number: '', phone: '', plan: 'free', billing_cycle: 'monthly',
  profile_type: 'individual', subscription_status: '', mor_renews_at: '', mor_ends_at: '',
  mor_subscription_id: '', tester_since: '', hold_plan: '', hold_until: '',
};

export default function Billing({ userId, wantPlan = null, wantCycle = null }: {
  userId: string;
  /** Το πακέτο που διάλεξε ο χρήστης στη σύγκριση από πάνω. */
  wantPlan?: PlanId | null;
  /** Ο κύκλος που είχε η σύγκριση τη στιγμή της επιλογής. */
  wantCycle?: BillingCycle | null;
}) {
  const supabase = createClient();
  const [d, setD] = useState<BillingData>(INIT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveErr, setSaveErr] = useState(false);
  const [prefilled, setPrefilled] = useState(false);
  // Ζωντανή χρέωση; Το λέει ο ίδιος έλεγχος που δείχνει το κουμπί του ταμείου.
  const [billingLive, setBillingLive] = useState<boolean | null>(null);
  const set = (k: keyof BillingData, v: string) => setD(p => ({ ...p, [k]: v }));
  // Η κάρτα ξαναδιαβάζει το προφίλ όταν κάτι το άλλαξε στον διακομιστή — η
  // αλλαγή πακέτου δοκιμαστή γράφεται με ρόλο υπηρεσίας, οπότε η οθόνη δεν
  // μπορεί να τη μαντέψει.
  const [reloads, setReloads] = useState(0);
  const reload = () => setReloads(n => n + 1);

  // ── Η ΕΠΙΛΟΓΗ ΤΗΣ ΕΓΓΡΑΦΗΣ ΕΠΙΖΕΙ ΤΗΣ ΕΓΚΑΤΑΛΕΙΨΗΣ ΤΟΥ ΤΑΜΕΙΟΥ ────────
  // Πακέτο και κύκλος διαλέγονται στον τιμοκατάλογο και γράφονται στο προφίλ
  // με την εγγραφή. Οποιος όμως έκλεισε το ταμείο για να το ξανασκεφτεί
  // έβρισκε εδώ το ΦΘΗΝΟΤΕΡΟ πακέτο, μηνιαίο: η κάρτα δεν θυμόταν τίποτα και
  // η επιλογή του έπρεπε να ξαναγίνει από την αρχή. Δείχνεται μόνο όσο δεν
  // υπάρχει συνδρομή — ό,τι πληρώνεται ήδη είναι ισχυρότερο από μια επιθυμία.
  const [wishPlan, setWishPlan] = useState<PlanId | null>(null);
  const [wishCycle, setWishCycle] = useState<BillingCycle>('monthly');

  useEffect(() => {
    (async () => {
      const [data, { data: u }] = await Promise.all([
        billing.profile<Partial<BillingData>>(supabase, userId, '*'),
        supabase.auth.getUser(),
      ]);
      const meta = (u.user?.user_metadata as Record<string, string> | undefined) || {};
      setWishPlan(planFromParam(meta.chosen_plan));
      setWishCycle(cycleFromParam(meta.chosen_cycle));
      const base: BillingData = { ...INIT, ...(data || {}) };

      // Έξυπνη προσυμπλήρωση: αντλούμε ό,τι ήδη ξέρουμε από το ακίνητο και τις
      // ρυθμίσεις του, ώστε ο χρήστης να μη βρίσκει άδεια φόρμα (αλλιώς δεν τη
      // συμπληρώνει ποτέ). Γεμίζουμε ΜΟΝΟ τα κενά· δεν πατάμε ό,τι υπάρχει ήδη.
      let did = false;
      const fill = (k: keyof BillingData, v?: string | null) => {
        if (!String(base[k] || '').trim() && v && String(v).trim()) { base[k] = String(v).trim(); did = true; }
      };
      try {
        const prop = (await properties.list<{ id: string }>(
          supabase, userId, { columns: 'id', orderBy: 'created_at' }))[0] || null;
        let ps: { owner_name?: string; owner_afm?: string; owner_phone?: string } | null = null;
        if (prop?.id) {
          const { data: s } = await supabase
            .from('property_settings').select('owner_name, owner_afm, owner_phone')
            .eq('property_id', prop.id).maybeSingle();
          ps = s;
        }
        fill('full_name', meta.full_name || ps?.owner_name);
        fill('afm', ps?.owner_afm);
        fill('phone', ps?.owner_phone);
      } catch { /* σιωπηλά: η προσυμπλήρωση είναι bonus, δεν μπλοκάρει */ }
      fill('full_name', meta.full_name);

      setD(base);
      setPrefilled(did);
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, reloads]);

  const save = async () => {
    setSaving(true); setSaved(false); setSaveErr(false);
    // Το πλάνο και ο κύκλος χρέωσης ορίζονται ΜΟΝΟ από τη χρέωση, όχι από τον
    // πελάτη· το στρώμα τα αφαιρεί από κάθε εγγραφή, για όλες τις οθόνες.
    //
    // ΤΑ ΠΕΔΙΑ ΠΟΥ ΕΦΥΓΑΝ ΑΠΟ ΤΗ ΦΟΡΜΑ ΔΕΝ ΞΑΝΑΓΡΑΦΟΝΤΑΙ ΚΡΥΦΑ. Η φόρμα στέλνει
    // ολόκληρο το προφίλ που διάβασε· χωρίς αυτή τη γραμμή, ΔΟΥ, δραστηριότητα
    // και διεύθυνση που ο χρήστης δεν βλέπει πια θα ξαναγράφονταν σε κάθε
    // αποθήκευση. Τώρα σβήνουν την επόμενη φορά που αποθηκεύει (ελαχιστοποίηση,
    // άρθρο 5§1 στοιχείο γ΄ GDPR). Οι στήλες μένουν· κανείς άλλος δεν τις διαβάζει.
    const { error } = await billing.save(supabase, userId, { ...d, ...RETIRED_FIELDS } as billing.BillingPatch);
    setSaving(false);
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
    else setSaveErr(true);
  };

  if (loading) return <Spinner label="Φόρτωση…" />;
  const isInvoice = d.doc_type === 'invoice';
  const country = (d.country || 'GR').toUpperCase();
  const isGr = country === 'GR';
  const reverseCharge = isReverseCharge(d);
  const vatLabel = isEuCountry(country) ? 'VAT (VIES)' : 'Φορολογικό μητρώο';
  const vatSummary = vatTreatmentLabel(determineVat(d));

  return (
    <div>
      {/* ═══ Η ΣΥΝΔΡΟΜΗ ΠΡΩΤΗ, ΓΙΑΤΙ ΓΙ' ΑΥΤΗΝ ΑΝΟΙΓΕΙ ΚΑΝΕΙΣ ΤΗΝ ΟΘΟΝΗ ════════
          ΗΤΑΝ ΔΕΥΤΕΡΗ, ΚΑΤΩ ΑΠΟ ΜΙΑ ΦΟΡΜΑ ΕΝΤΕΚΑ ΠΕΔΙΩΝ. Μετρημένο στα 375: τα
          «Στοιχεία τιμολόγησης» έπιαναν 760 εικονοστοιχεία και η «Συνδρομή»
          ξεκινούσε στα 790 — δηλαδή το πρώτο ευρώ της οθόνης φαινόταν στα 1.029,
          μιάμιση οθόνη κάτω. Η καρτέλα λέγεται «Συνδρομή» στο μενού και ο λόγος
          που την ανοίγει κανείς είναι ένας: τι πληρώνω και τι αλλάζει αν αλλάξω
          πακέτο. Η φόρμα τιμολόγησης συμπληρώνεται ΜΙΑ φορά στη ζωή του
          λογαριασμού· δεν δικαιούται να στέκεται μπροστά σε κάθε επίσκεψη.

          ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΠΡΟΑΠΑΙΤΟΥΜΕΝΟ. Το ταμείο δεν ζει σε αυτή τη σελίδα: ο
          διακομιστής βγάζει σύνδεσμο μιας χρήσης προς τον έμπορο, που ζητά ο
          ίδιος ό,τι του λείπει. Η σειρά δεν ήταν ροή — ήταν συνήθεια. */}
      <Subscription d={d} wantPlan={wantPlan} wantCycle={wantCycle} wishPlan={wishPlan} wishCycle={wishCycle} onChanged={reload} onLive={setBillingLive} />

      {/* ΧΩΡΙΣ ΤΑΜΕΙΟ, ΧΩΡΙΣ ΦΟΡΜΑ. Η οθόνη ζητούσε ΑΦΜ, ΔΟΥ, διεύθυνση και
          τηλέφωνο «για να μη σου ζητηθεί τίποτα στην ενεργοποίηση», ενώ το
          ταμείο δεν τα διαβάζει και το παραστατικό το εκδίδει ο έμπορος.
          Δεδομένα που μαζεύονται χωρίς χρήση παραβιάζουν την ελαχιστοποίηση
          του άρθρου 5§1 στοιχείο γ΄ GDPR. Η φόρμα εμφανίζεται μόνο με ζωντανή
          χρέωση.

          ΚΑΙ ΜΕ ΖΩΝΤΑΝΗ ΧΡΕΩΣΗ ΤΟ ΤΑΜΕΙΟ ΔΕΝ ΤΗ ΔΙΑΒΑΖΕΙ. Στον έμπορο φεύγει
          μόνο το email (lib/billing/merchant/creem.ts) και τα στοιχεία του
          παραστατικού τα δίνει ο πελάτης στο ταμείο του. Η κάρτα έλεγε «για
          σωστό τιμολόγιο, συμπλήρωσε ακόμη…» και ζητούσε ΔΟΥ, δραστηριότητα,
          διεύθυνση, πόλη και κώδικα, που δεν διαβάζει κανείς. Μένουν τα πεδία
          που χρησιμοποιούνται: τύπος, χώρα και VAT για το καθεστώς ΦΠΑ από
          κάτω και όνομα, επωνυμία, ΑΦΜ και τηλέφωνο για την προσυμπλήρωση των
          στοιχείων ιδιοκτήτη σε νέο ακίνητο (AddPropertyWizard). Οι στήλες
          μένουν στη βάση· απλώς δεν ζητούνται. */}
      {billingLive === true && <Card>
        <SecHdr label="Στοιχεία τιμολόγησης" />
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: T.font.sans, lineHeight: 1.5, marginTop: -6, marginBottom: 14 }}>
          Τα στοιχεία του παραστατικού τα δίνεις στο ταμείο, όταν πληρώνεις. Εδώ κρατάμε μόνο όσα δείχνουν το καθεστώς ΦΠΑ και συμπληρώνουν τα στοιχεία ιδιοκτήτη σε νέο ακίνητο.{prefilled ? ' Προσυμπληρωμένα από το ακίνητό σου.' : ''}
        </div>
        {/* ΤΕΣΣΕΡΙΣ ΣΤΗΛΕΣ, ΓΡΑΜΜΕΝΕΣ ΩΣ ΑΠΟΦΑΣΗ. Το `formGrid` κόβει κάθε στήλη
            σε σταθερό μέγιστο, οπότε στην κάρτα των ρυθμίσεων έβγαζε δύο πεδία
            ανά σειρά και μισή κάρτα άδεια δεξιά: έντεκα πεδία σε έξι σειρές.
            Με τέσσερις στήλες και χωρίς τα πεδία που δεν διαβάζει κανείς, ο
            ιδιώτης γεμίζει μία σειρά (τύπος, χώρα, όνομα, τηλέφωνο) και η
            επιχείρηση δύο, μαζί με την αποθήκευση.

            Κανένα πεδίο δεν μένει μόνο του σε μισή σειρά: το τέσσερα σπάει σε
            δύο και μετά σε ένα, ποτέ σε τρία.

            Η στοίχιση είναι στην ΚΟΡΥΦΗ: μια ετικέτα δύο γραμμών δεν σπρώχνει
            το διπλανό πεδίο πιο κάτω από τα υπόλοιπα της σειράς. */}
        <div {...fixedCols(4, 14, 'start', 'fc-roomy')}>
          <CustomSelect label="Τύπος παραστατικού" value={d.doc_type} onChange={v => set('doc_type', v)}
            options={[{ value: 'receipt', label: 'Απόδειξη (ιδιώτης)' }, { value: 'invoice', label: 'Τιμολόγιο (επιχείρηση)' }]} />
          <CustomSelect label="Χώρα" value={country} onChange={v => set('country', v)}
            options={ALL_COUNTRIES.map(c => ({ value: c.code, label: c.name }))} />
          <TextInput label="Ονοματεπώνυμο" value={d.full_name} onChange={v => set('full_name', v)} placeholder="Όνομα και επώνυμο" />
          {isInvoice && <TextInput label="Επωνυμία εταιρείας" value={d.company_name} onChange={v => set('company_name', v)} placeholder="Παράδειγμα Ε.Ε." />}
          {/* Φορολογικό αναγνωριστικό: ΑΦΜ για Ελλάδα, κοινοτικό VAT (VIES) για ΕΕ, μητρώο για εκτός ΕΕ */}
          {isInvoice && isGr && <TextInput label="ΑΦΜ" value={d.afm} onChange={v => set('afm', v)} placeholder="123456789" />}
          {isInvoice && !isGr && <TextInput label={vatLabel} value={d.vat_number} onChange={v => set('vat_number', v)} placeholder={isEuCountry(country) ? `${country}XXXXXXXXX` : 'Αριθμός μητρώου'} />}
          <TextInput label="Τηλέφωνο" value={d.phone} onChange={v => set('phone', v)} placeholder="69XXXXXXXX" />
          {/* ═══ Η ΑΠΟΘΗΚΕΥΣΗ ΕΙΝΑΙ ΤΟ ΤΕΛΕΥΤΑΙΟ ΚΟΥΤΙ ΤΗΣ ΦΟΡΜΑΣ ═══════════════════
              Καθόταν σε δική της σειρά από κάτω, δηλαδή μια ολόκληρη γραμμή για
              ένα κουμπί, ενώ η σειρά ακριβώς από πάνω τελείωνε με άδειο κελί.
              Το κουμπί είναι το τέλος της φόρμας και το άδειο κελί είναι το
              τέλος της σειράς: μπαίνουν μαζί.

              ΚΑΙ ΠΑΙΡΝΕΙ ΤΟ ΜΕΓΕΘΟΣ ΤΟΥ ΠΕΔΙΟΥ, ΟΧΙ ΤΟΥ ΛΕΚΤΙΚΟΥ ΤΟΥ. Μετρημένο
              στο κελί δίπλα στο «Τηλέφωνο»: 152 × 36 δίπλα σε πεδίο 296 × 40,
              δηλαδή μισό κουτί σε λάθος ύψος. Με `field` γίνεται ακριβώς 296 × 40
              και στέκεται στη σειρά σαν πεδίο.

              Το κενό από πάνω είναι η ΕΤΙΚΕΤΑ που δεν έχει: χωρίς αυτό το κουμπί
              θα ξεκινούσε ψηλότερα από τα πεδία της σειράς του.

              Η ΑΠΑΝΤΗΣΗ ΤΗΣ ΑΠΟΘΗΚΕΥΣΗΣ ΜΠΗΚΕ ΜΕΣΑ ΣΤΟ ΚΟΥΜΠΙ. Ηταν δεύτερη
              λέξη δίπλα του, που σε τέσσερις στήλες τύλιγε σε τρίτη σειρά: η
              επιβεβαίωση χαλούσε τη διάταξη που επιβεβαίωνε. */}
          <div style={{ paddingTop: FIELD_LABEL_ROW }}>
            <Btn variant="primary" field onClick={save} disabled={saving}>
              {saving ? 'Αποθήκευση…' : saved ? 'Αποθηκεύτηκε' : 'Αποθήκευση στοιχείων'}
            </Btn>
          </div>
        </div>

        {saveErr && (
          <div style={{ fontSize: 12, color: 'var(--negative)', fontFamily: T.font.sans, lineHeight: 1.55, marginTop: 10 }}>
            Δεν αποθηκεύτηκε. Δοκίμασε ξανά.
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 12, fontSize: 12, color: 'var(--text-tertiary)', fontFamily: T.font.sans, lineHeight: 1.55 }}>
          <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>Καθεστώς ΦΠΑ</span>
          <span>{vatSummary}{reverseCharge ? '. Χρειάζεται έγκυρος κοινοτικός VAT (VIES).' : ''}</span>
        </div>
      </Card>}
    </div>
  );
}

/**
 * Οταν ο διακομιστής δεν απάντησε καθόλου. Δεν λέει τίποτα για το αν η χρέωση
 * είναι ενεργή: αυτό το ξέρει μόνο ο διακομιστής και λέγεται με τις λέξεις
 * των Ορων. Λέει μόνο τι ισχύει στην οθόνη και ότι τίποτα δεν άλλαξε.
 */
const CHECKOUT_UNREACHABLE = 'Η πληρωμή με κάρτα δεν είναι διαθέσιμη αυτή τη στιγμή. Η συνδρομή σου δεν αλλάζει.';

// ─── Η ΣΥΝΔΡΟΜΗ ─────────────────────────────────────────────────────────────
//
// ΜΙΑ ΚΑΡΤΑ, ΜΙΑ ΠΡΑΞΗ ΤΗ ΦΟΡΑ. Οποιος δεν έχει συνδρομή βλέπει το ταμείο·
// όποιος έχει, βλέπει τη διαχείρισή της. ΠΟΤΕ ΚΑΙ ΤΑ ΔΥΟ: ένα ταμείο πάνω σε
// ενεργή συνδρομή δεν την αλλάζει, φτιάχνει ΔΕΥΤΕΡΗ και ο πελάτης πληρώνει
// δύο φορές το ίδιο πράγμα.
//
// Το ταμείο εμφανίζεται μόνο όταν ο πάροχος είναι ρυθμισμένος — αυτό το ξέρει
// ο διακομιστής, όχι η οθόνη, γιατί το κλειδί ζει σε μεταβλητή περιβάλλοντος.
function Subscription({ d, wantPlan = null, wantCycle = null, wishPlan = null, wishCycle = 'monthly', onChanged, onLive }: {
  d: BillingData;
  wantPlan?: PlanId | null;
  wantCycle?: BillingCycle | null;
  /** Ο,τι διάλεξε στην εγγραφή, όσο δεν έχει συνδρομή. */
  wishPlan?: PlanId | null;
  wishCycle?: BillingCycle;
  onChanged: () => void;
  onLive?: (live: boolean) => void;
}) {
  /**
   * Υπάρχει πύλη διαχείρισης;
   *
   * ΚΡΙΝΕΤΑΙ ΑΠΟ ΔΕΔΟΜΕΝΟ ΠΟΥ ΕΧΟΥΜΕ ΗΔΗ, ΟΧΙ ΑΠΟ ΕΡΩΤΗΣΗ. Μια προκαταρκτική
   * κλήση θα ρωτούσε τον έμπορο σε ΚΑΘΕ φόρτωση της οθόνης, ακόμη και για
   * όποιον δεν πατήσει ποτέ το κουμπί. Η συνδρομή γράφεται από τον webhook· αν
   * υπάρχει, υπάρχει και πύλη.
   */
  const hasCustomer = !!(d.mor_subscription_id || '').trim();
  // Ο κύκλος του επιλογέα: πρώτα εκείνος που ΠΛΗΡΩΝΕΤΑΙ ήδη και μόνο όταν δεν
  // υπάρχει συνδρομή, εκείνος που διάλεξε στην εγγραφή. Χωρίς τη δεύτερη
  // γραμμή, όποιος πάτησε «ετήσια» στον τιμοκατάλογο έβρισκε εδώ «μηνιαία»,
  // γιατί αυτή είναι η προεπιλογή της στήλης πριν γραφτεί καμία συνδρομή.
  const [cycle, setCycle] = useState<BillingCycle>(
    hasCustomer ? (d.billing_cycle === 'annual' ? 'annual' : 'monthly') : wishCycle);
  const [busy, setBusy] = useState(false);

  const type: ProfileType = d.profile_type === 'professional' ? 'professional' : 'individual';
  const current = normalizePlan(d.plan);
  // ── ΠΟΙΟ ΠΑΚΕΤΟ ΔΕΙΧΝΕΙ Η ΚΑΡΤΑ ───────────────────────────────────────
  // Πρώτα ό,τι διάλεξε ο ΙΔΙΟΣ στη σύγκριση από πάνω. Μετά ό,τι ήδη πληρώνει,
  // δηλαδή η ανανέωσή του. Και μόνο αν δεν υπάρχει τίποτα από τα δύο, το
  // ΦΘΗΝΟΤΕΡΟ πακέτο που επιτρέπει το προφίλ του.
  //
  // ΟΧΙ ΤΟ ΑΚΡΙΒΟΤΕΡΟ. Η πρώτη γραφή έδειχνε το ανώτατο επιτρεπτό: ένας ιδιώτης
  // χωρίς συνδρομή έβλεπε «Ιδιοκτήτης+ · 9,90€» ενώ η είσοδος είναι
  // «Ιδιοκτήτης με Νόα · 4,99€» (ο «Ιδιοκτήτης» χωρίς Νόα είναι δωρεάν). Μια προεπιλογή που τυχαίνει να είναι η κερδοφόρα δεν
  // είναι προεπιλογή, είναι πώληση με το ζόρι.
  const entry = ALLOWED_PLANS[type].find(p => PLANS[p].priceMonthly > 0) ?? ALLOWED_PLANS[type][0];
  // Η επιθυμία της εγγραφής μπαίνει όπως ήρθε: από 28.09.2026 κάθε πακέτο
  // αγοράζεται από κάθε λογαριασμό (το ταμείο δεν απαντά πια 403).
  const wished = wishPlan && PLANS[wishPlan].priceMonthly > 0 ? wishPlan : null;
  // ΟΛΑ ΤΑ ΠΛΗΡΩΜΕΝΑ ΠΑΚΕΤΑ, ΟΧΙ ΜΟΝΟ ΤΟΥ ΤΡΟΠΟΥ ΧΡΗΣΗΣ. Με τα τρία του
  // ιδιώτη ή τα δύο του επαγγελματία, ο λογαριασμός που ο τρόπος του δεν
  // ταίριαζε με ό,τι έβλεπε στην οθόνη δεν έβρισκε εδώ το πακέτο που ήθελε.
  const choices = PLAN_ORDER.filter(id => PLANS[id].priceMonthly > 0);
  // Η ΕΠΙΛΟΓΗ ΤΟΥ ΧΡΗΣΤΗ ΜΕΣΑ ΣΤΗΝ ΙΔΙΑ ΚΑΡΤΑ. Ο συνδρομητής έβλεπε τον
  // διακόπτη κύκλου να αλλάζει την τιμή και κανένα κουμπί να την εφαρμόζει:
  // ένα χειριστήριο που δεν κάνει τίποτα. Και το πακέτο δεν άλλαζε καθόλου
  // από εδώ — έπρεπε να κατέβει στη σύγκριση, να διαλέξει και να ανέβει πάλι.
  const [pick, setPick] = useState<PlanId | null>(null);
  // Η ΕΠΙΛΟΓΗ ΤΗΣ ΣΥΓΚΡΙΣΗΣ ΝΙΚΑ ΤΗΝ ΠΑΛΙΑ ΕΠΙΛΟΓΗ ΤΗΣ ΚΑΡΤΑΣ. Χωρίς αυτό, ένα
  // πακέτο που είχε πατηθεί εδώ νωρίτερα έμενε επιλεγμένο και η «Αλλαγή» της
  // σύγκρισης κατέληγε σε άλλο πακέτο από αυτό που διάλεξε ο χρήστης. Ο κύκλος
  // ταξιδεύει μαζί: η σύγκριση ανοίγει στην ετήσια, η κάρτα στη μηνιαία.
  // Ρυθμίζεται κατά την απόδοση, όπως προτείνει το React για τιμή που
  // εξαρτάται από ιδιότητα — όχι σε effect που θα ζωγράφιζε πρώτα την παλιά.
  const [seenWant, setSeenWant] = useState<string>('');
  const wantKey = `${wantPlan ?? ''}:${wantCycle ?? ''}`;
  if (wantKey !== seenWant) {
    setSeenWant(wantKey);
    if (wantPlan) setPick(wantPlan);
    if (wantCycle) setCycle(wantCycle);
  }
  const target: PlanId = pick ?? wantPlan ?? (current !== 'free' ? current : (wished ?? entry));
  const plan = PLANS[target];
  const price = cycle === 'annual' ? annualPerMonth(target) : plan.priceMonthly;

  const status = (d.subscription_status || '').trim();
  const phase = subPhase(status);
  const endsAt = (d.mor_ends_at || '').trim();
  const renewsAt = (d.mor_renews_at || '').trim();
  // Ο κανόνας ζει στο lib/billing/subscription.ts, όπου τον φτάνει δοκιμή.
  const { tone, running } = cardState({ status, endsAt }, new Date().toISOString());

  // ── ΤΟ ΚΟΥΜΠΙ ΡΩΤΑΕΙ ΠΡΙΝ ΕΜΦΑΝΙΣΤΕΙ ────────────────────────────────────
  // Οι σύνδεσμοι αγοράς ζουν σε μεταβλητή περιβάλλοντος, δηλαδή ο περιηγητής
  // ΔΕΝ μπορεί να ξέρει αν υπάρχει ταμείο. Χωρίς αυτή την ερώτηση, το κουμπί
  // εμφανιζόταν πάντα και απαντούσε «δοκίμασε ξανά σε λίγο» — μήνυμα που
  // υπόσχεται ότι το πρόβλημα είναι προσωρινό ενώ δεν είναι.
  //
  // `null` = δεν ξέρουμε ακόμη. Ούτε κουμπί ούτε άρνηση: τα δύο ψέματα είναι
  // συμμετρικά και η απάντηση έρχεται σε ένα αίτημα.
  //
  // ΚΑΙ Η ΦΡΑΣΗ ΕΡΧΕΤΑΙ ΜΑΖΙ. Η οθόνη δεν κρίνει μόνη της τι ισχύει: παίρνει
  // την ίδια διατύπωση που διαβάζουν οι Οροι και η Πολιτική απορρήτου.
  const [live, setLive] = useState<boolean | null>(null);
  const [note, setNote] = useState('');
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/billing/checkout?plan=${target}&cycle=${cycle}&probe=1`);
        const body = await res.json() as { available?: boolean; note?: string; error?: string };
        // ΧΩΡΙΣ ΦΡΑΣΗ ΔΕΝ ΜΕΝΕΙ ΑΔΕΙΟ ΠΛΑΙΣΙΟ. Οι απαντήσεις 401/403/409
        // φέρνουν `error` αντί για `note` και το μπάνερ από κάτω έβγαινε κουτί
        // με μια τελεία. Πρώτα η φράση των Ορων, μετά ο λόγος του διακομιστή.
        if (alive) { setLive(!!body.available); setNote(body.note || body.error || ''); onLive?.(!!body.available); }
      } catch { if (alive) { setLive(false); setNote(''); onLive?.(false); } }
    })();
    return () => { alive = false; };
  // Το `onLive` είναι σταθερός setter του γονέα· δεν ξαναρωτά το ταμείο.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, cycle]);

  // ΤΟ ΣΦΑΛΜΑ ΛΕΓΕΤΑΙ. Ενα κουμπί που δεν κάνει τίποτα όταν πατηθεί είναι
  // χειρότερο από κουμπί που λείπει: ο χρήστης το ξαναπατά και θεωρεί ότι
  // χρεώθηκε δύο φορές. Και οι δύο πόρτες του παρόχου ανοίγουν με τον ίδιο
  // τρόπο — σύνδεσμος μιας χρήσης από τον διακομιστή — οπότε και η μία μόνο
  // διαδικασία, με το όνομα της πόρτας μέσα στο μήνυμα.
  const open = async (url: string, what: string) => {
    setBusy(true);
    try {
      const res = await fetch(url);
      const body = await res.json() as { url?: string | null };
      if (!body.url) { notifyError(`${what} δεν άνοιξε. Δοκίμασε ξανά σε λίγο.`); setBusy(false); return; }
      window.location.href = body.url;
    } catch {
      notifyError(`${what} δεν άνοιξε. Έλεγξε τη σύνδεσή σου και δοκίμασε ξανά.`);
      setBusy(false);
    }
  };
  const go = () => open(`/api/billing/checkout?plan=${target}&cycle=${cycle}`, 'Το ταμείο');
  const manage = () => open('/api/billing/portal', 'Η διαχείριση συνδρομής');

  // ── Ο ΔΟΚΙΜΑΣΤΗΣ ΔΕΝ ΕΧΕΙ ΣΥΝΔΡΟΜΗ ────────────────────────────────────
  // Δεν πληρώνει, δεν έχει πελάτη στον έμπορο, δεν υπάρχει πύλη διαχείρισης.
  // Ολα τα κουμπιά της κάρτας αφορούν κάτι που δεν τον αφορά — και ένα κουμπί
  // «Πληρωμή με κάρτα» σε άνθρωπο που του υποσχεθήκαμε δωρεάν χρήση είναι το
  // χειρότερο μήνυμα που μπορεί να δει.
  const isTester = !!(d.tester_since || '').trim();

  // ── Η ΥΠΟΒΑΘΜΙΣΗ ΠΟΥ ΠΕΡΙΜΕΝΕΙ ────────────────────────────────────────
  // Ο,τι κρατιέται ως την ανανέωση. Το `plan` δείχνει ήδη το ΝΕΟ πακέτο (ο
  // webhook το έγραψε τη στιγμή της αλλαγής): χωρίς αυτή τη γραμμή, ο πελάτης
  // θα διάβαζε ότι έχει ήδη κατέβει ενώ κρατά ακόμη ό,τι πλήρωσε.
  const heldPlan = normalizePlan(d.hold_plan);
  const heldUntil = (d.hold_until || '').trim();
  const holding = heldPlan !== 'free' && !!heldUntil && current !== 'free';

  /** Ο κύκλος που πληρώνεται τώρα, για να ξέρουμε αν η επιλογή τον αλλάζει. */
  const paidCycle: BillingCycle = d.billing_cycle === 'annual' ? 'annual' : 'monthly';
  /** Διαφέρει η επιλογή από ό,τι τρέχει; Μόνο τότε υπάρχει κάτι να πατηθεί. */
  const moves = running && (target !== current || cycle !== paidCycle);
  const goingDown = moves && PLAN_ORDER.indexOf(target) < PLAN_ORDER.indexOf(current);

  // ── Ο ΚΩΔΙΚΟΣ ΔΟΚΙΜΑΣΤΗ ──────────────────────────────────────────────
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState('');

  /**
   * Η εξαργύρωση.
   *
   * ΤΟ ΙΔΙΟ ΜΗΝΥΜΑ ΓΙΑ ΚΑΘΕ ΑΠΟΤΥΧΙΑ, όπως και στον διακομιστή: η διαφορά
   * ανάμεσα σε «λάθος κωδικός» και «δεν υπάρχει πρόγραμμα» θα άξιζε τον κόπο
   * να δοκιμάσει κανείς δεύτερο.
   */
  const redeem = async () => {
    // Ο ΚΩΔΙΚΟΣ ΠΡΟΣΚΛΗΣΗΣ ΔΕΝ ΕΙΝΑΙ ΚΩΔΙΚΟΣ ΔΟΚΙΜΑΣΤΗ. Η οθόνη των Προσκλήσεων
    // δείχνει «Κωδικός POxxxxxxx» και ο φίλος που τον πληκτρολογούσε εδώ
    // έπαιρνε «δεν αναγνωρίζεται», καίγοντας μία από τις πέντε προσπάθειες
    // του εικοσιτετραώρου. Η μορφή του είναι γνωστή, οπότε απαντιέται εδώ,
    // χωρίς κλήση και χωρίς να μετρήσει στο όριο.
    if (isReferralCode(code.trim().toUpperCase())) {
      notifyError('Αυτός είναι κωδικός πρόσκλησης. Ισχύει μόνο μέσα από τον σύνδεσμο εγγραφής.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/billing/tester', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) { notifyError('Ο κωδικός δεν αναγνωρίζεται.'); setBusy(false); return; }
      notifyOk('Ο κωδικός εξαργυρώθηκε');
      setCode(''); setCodeOpen(false);
      onChanged();
    } catch {
      notifyError('Η εξαργύρωση δεν ολοκληρώθηκε. Έλεγξε τη σύνδεσή σου.');
    }
    setBusy(false);
  };

  /**
   * Η αλλαγή πακέτου. Ενα κουμπί, τρεις καταλήξεις και ο διακομιστής ξέρει
   * ποια ισχύει: ο δοκιμαστής γράφεται επιτόπου, ο συνδρομητής που ανεβαίνει
   * χρεώνεται τη διαφορά, ο συνδρομητής που κατεβαίνει κρατά ως την ανανέωση.
   *
   * ΤΟ ΜΗΝΥΜΑ ΛΕΕΙ ΤΙ ΕΓΙΝΕ ΠΡΑΓΜΑΤΙΚΑ, όχι τι ζητήθηκε: ένα «το πακέτο έγινε
   * Ιδιοκτήτης» μετά από υποβάθμιση θα ήταν ψέμα ως την ανανέωση.
   */
  const switchPlan = async (id: PlanId) => {
    setBusy(true);
    try {
      const res = await fetch('/api/billing/plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: id, cycle }),
      });
      const body = await res.json().catch(() => ({})) as {
        kind?: string; holdPlan?: string | null; holdUntil?: string | null; error?: string;
      };
      if (!res.ok) {
        notifyError(typeof body.error === 'string' && body.error ? body.error : 'Το πακέτο δεν άλλαξε. Δοκίμασε ξανά.');
        setBusy(false); return;
      }
      if (body.kind === 'downgrade' && body.holdPlan && body.holdUntil) {
        notifyOk(`Κρατάς το «${PLANS[normalizePlan(body.holdPlan)].name}» ως τις ${fd(body.holdUntil)}`);
      } else {
        notifyOk(`Το πακέτο έγινε «${PLANS[id].name}»`);
      }
      setPick(null);
      onChanged();
    } catch {
      notifyError('Το πακέτο δεν άλλαξε. Έλεγξε τη σύνδεσή σου.');
    }
    setBusy(false);
  };

  if (isTester) return (
    <Card>
      <SecHdr label="Συνδρομή" />
      <InfoBanner tone="info">
        Λογαριασμός δοκιμαστή. Όλα τα πακέτα είναι ανοιχτά χωρίς χρέωση και αλλάζεις πακέτο όποτε θέλεις.
      </InfoBanner>
      {/* ΟΛΑ ΤΑ ΠΑΚΕΤΑ, ΧΩΡΙΣ ΦΡΑΓΜΟ ΤΥΠΟΥ ΠΡΟΦΙΛ. Ο δοκιμαστής δεν αγοράζει:
          δοκιμάζει. Το να του κλείσουμε τα μισά θα ακύρωνε τον λόγο που του
          δώσαμε τον κωδικό. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
        {PLAN_ORDER.filter(id => PLANS[id].priceMonthly > 0).map(id => (
          <Btn key={id} variant={current === id ? 'primary' : 'secondary'}
            onClick={() => switchPlan(id)} disabled={busy || current === id}>
            {PLANS[id].name}
          </Btn>
        ))}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: T.font.sans, lineHeight: 1.55, marginTop: 14 }}>
        Η ιδιότητα δόθηκε στις {fd(d.tester_since)}. Όταν τελειώσει η δοκιμή θα σου το πούμε πριν αλλάξει οτιδήποτε.
      </div>
    </Card>
  );

  return (
    <Card>
      <SecHdr label="Συνδρομή" />
      {/* Η ΑΚΥΡΩΣΗ ΕΙΝΑΙ ΔΕΔΟΜΕΝΟ, ΟΧΙ ΚΑΤΑΣΤΑΣΗ. Οσο τρέχει η πληρωμένη περίοδος
          η συνδρομή μένει ενεργή στον πάροχο· εκείνο που αλλάζει είναι ότι
          υπάρχει ημερομηνία λήξης αντί για ημερομηνία ανανέωσης. */}
      {tone === 'cancelled-running' ? (
        <InfoBanner tone="warning">Η συνδρομή έχει ακυρωθεί και ισχύει ως τις <strong>{fd(endsAt)}</strong>. Μετά την ημερομηνία αυτή ο λογαριασμός συνεχίζει στο δωρεάν πακέτο «{PLANS.free.name}».</InfoBanner>
      ) : tone === 'cancelled-over' ? (
        <InfoBanner tone="warning">Η συνδρομή έληξε στις <strong>{fd(endsAt)}</strong>. Ο λογαριασμός συνεχίζει στο δωρεάν πακέτο «{PLANS.free.name}»· διάλεξε πακέτο για να ξαναπάρεις ό,τι είχες.</InfoBanner>
      ) : tone === 'trial' || tone === 'active' ? (
        <InfoBanner tone="info">
          {tone === 'trial' ? 'Σε δοκιμή' : `Ενεργή συνδρομή, ${plan.name}`}
          {renewsAt ? `. Ανανέωση στις ${fd(renewsAt)}.` : '.'}
        </InfoBanner>
      ) : tone === 'retrying' ? (
        <InfoBanner tone="warning">Η τελευταία χρέωση δεν ολοκληρώθηκε. Ο λογαριασμός παραμένει ανοιχτός όσο ο έμπορος ξαναδοκιμάζει την κάρτα. Ενημέρωσε την κάρτα σου από τη διαχείριση συνδρομής.</InfoBanner>
      ) : null}

      {/* ── Η ΥΠΟΒΑΘΜΙΣΗ ΠΟΥ ΠΕΡΙΜΕΝΕΙ, ΓΡΑΜΜΕΝΗ ────────────────────────────
          Ο έμπορος έχει ήδη αλλάξει την παραλλαγή, οπότε το `plan` δείχνει το
          ΝΕΟ πακέτο. Χωρίς αυτή τη γραμμή ο πελάτης θα διάβαζε ότι έχει ήδη
          κατέβει, ενώ κρατά ως την ανανέωση ό,τι πλήρωσε — και θα ρωτούσε
          γιατί «δεν εφαρμόστηκε» κάτι που εφαρμόστηκε σωστά. */}
      {holding && (
        <InfoBanner tone="info">
          Ζήτησες αλλαγή σε <strong>{plan.name}</strong>. Κρατάς το <strong>{PLANS[heldPlan].name}</strong> ως τις <strong>{fd(heldUntil)}</strong>, γιατί το έχεις ήδη πληρώσει.
        </InfoBanner>
      )}

      {/* ── ΤΟ ΠΑΚΕΤΟ ΑΛΛΑΖΕΙ ΑΠΟ ΕΔΩ ─────────────────────────────────────
          Ο συνδρομητής δεν είχε κανέναν τρόπο να αλλάξει πακέτο μέσα σε αυτή
          την κάρτα: έβλεπε την τιμή του δικού του και ένα κουμπί «Διαχείριση
          συνδρομής» που ανοίγει την πύλη του εμπόρου — όπου η αλλαγή πακέτου
          δεν υπάρχει καν. Οι επιλογές είναι όλα τα πληρωμένα πακέτα, όσα
          δέχεται και το ταμείο. */}
      {/* ΚΟΥΜΠΙΑ ΜΟΝΟ ΟΤΑΝ ΟΔΗΓΟΥΝ ΣΕ ΑΛΛΑΓΗ. Χωρίς ζωντανό ταμείο το κουμπί
          εφαρμογής δεν εμφανίζεται, οπότε τα «κουμπιά πακέτου» άλλαζαν μόνο την
          τιμή από κάτω. Τότε η επιλογή είναι ό,τι πράγματι κάνει: διακόπτης
          που δείχνει την τιμή κάθε πακέτου. */}
      {running && (live === true ? (
        <div className="bill-plans">
          {choices.map(id => (
            <Btn key={id} variant={target === id ? 'primary' : 'secondary'}
              onClick={() => setPick(id)} disabled={busy}>
              {PLANS[id].name}
            </Btn>
          ))}
        </div>
      ) : (
        // ΠΛΑΚΙΔΙΑ ΠΟΥ ΑΝΑΔΙΠΛΩΝΟΝΤΑΙ, ΟΧΙ ΤΜΗΜΑΤΙΚΟΣ ΔΙΑΚΟΠΤΗΣ. Με τέσσερα πακέτα
        // ο διακόπτης δεν χωρούσε σε τηλέφωνο: στα 320-440 οι ετικέτες έπεφταν η
        // μία πάνω στην άλλη (σαρωτής διάταξης, 28.09.2026).
        <div className="bill-plans">
          {choices.map(id => (
            <ChipToggle key={id} on={target === id} onClick={() => setPick(id)}>{PLANS[id].name}</ChipToggle>
          ))}
        </div>
      ))}

      {/* Ο ΔΙΑΚΟΠΤΗΣ ΠΑΝΩ ΑΠΟ ΤΗΝ ΤΙΜΗ: πρώτα η αιτία, μετά το αποτέλεσμα. Δίπλα
          στον μεγάλο αριθμό διαβαζόταν ως διακόσμηση και δεν φαινόταν ότι είναι
          αυτός που τον αλλάζει. */}
      {/* Το πλάτος δένεται: ο διακόπτης απλώνεται στο 100% του γονέα και δύο
          επιλογές έπιαναν ολόκληρη την κάρτα, βαραίνοντας περισσότερο από την
          τιμή που ρυθμίζουν.
          ΣΤΟ ΤΗΛΕΦΩΝΟ ΟΙ ΑΚΡΕΣ ΣΤΟΙΧΙΖΟΝΤΑΙ (07.10.2026). Στα 390 τα πακέτα
          αναδιπλώνονταν ως τη δεξιά άκρη της κάρτας και ο διακόπτης σταματούσε
          στα 260 του, περίπου 30 εικονοστοιχεία πιο μέσα: δύο χειριστήρια
          της ίδιας απόφασης με διαφορετική δεξιά άκρη. Κάτω από 560 κάθε σειρά
          πακέτων γεμίζει το πλάτος και ο διακόπτης το ίδιο (`.bill-plans`,
          `.bill-cycle` στο globals.css). */}
      <div className="bill-cycle">
        <SegmentControl value={cycle} onChange={v => setCycle(v as BillingCycle)} ariaLabel="Κύκλος χρέωσης"
          options={[{ value: 'monthly', label: 'Μηνιαία' }, { value: 'annual', label: 'Ετήσια' }]} />
      </div>

      {/* Η ΤΙΜΗ ΛΕΕΙ ΤΗ ΜΟΝΑΔΑ ΤΗΣ. Το ετήσιο δείχνεται ανά μήνα, όπως και στη
          σύγκριση πακέτων, ώστε τα δύο νούμερα να συγκρίνονται μεταξύ τους. */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontFamily: T.font.sans }}>{plan.name}</div>
        <div style={{ fontFamily: T.font.num, fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1.1, marginTop: 4 }}>{fe(price)}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: T.font.sans, marginTop: 2 }}>
          {/* ΜΕ ΦΠΑ ΜΟΝΟ ΟΠΟΥ ΙΣΧΥΕΙ. Οι τιμές του τιμοκαταλόγου είναι για
              καταναλωτή στην Ελλάδα, με ΦΠΑ (σελίδα «Πακέτα»)· για άλλη χώρα ο
              ΦΠΑ κρίνεται αλλιώς και το ποσό το λέει το ταμείο. */}
          τον μήνα{determineVat(d).treatment === 'domestic' ? ', με ΦΠΑ' : ''}{cycle === 'annual' ? `, με ετήσια χρέωση ${fe(plan.priceAnnual)}` : ''}
        </div>
      </div>

      {/* ΤΟ ΤΑΜΕΙΟ ΜΟΝΟ ΟΤΑΝ ΔΕΝ ΤΡΕΧΕΙ ΣΥΝΔΡΟΜΗ. Η αλλαγή πακέτου σε ενεργή
          συνδρομή γίνεται από την πύλη, που την τροποποιεί· το ταμείο θα
          έφτιαχνε δεύτερη συνδρομή δίπλα στην πρώτη. */}
      {(live === true && !running) || hasCustomer ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: T.sp.lg }}>
          {live === true && !running && (
            <Btn variant="primary" onClick={go} disabled={busy}>{busy ? 'Ανοίγει…' : 'Πληρωμή με κάρτα'}</Btn>
          )}
          {/* ΕΜΦΑΝΙΖΕΤΑΙ ΜΟΝΟ ΟΤΑΝ Η ΕΠΙΛΟΓΗ ΔΙΑΦΕΡΕΙ. Ενα μόνιμο «Αλλαγή
              πακέτου» που δεν αλλάζει τίποτα όταν πατηθεί είναι χειρότερο από
              κουμπί που λείπει. */}
          {moves && live === true && (
            <Btn variant="primary" onClick={() => switchPlan(target)} disabled={busy}>
              {busy ? 'Αλλαγή…'
                : target === current
                  ? `Αλλαγή σε ${cycle === 'annual' ? 'ετήσια' : 'μηνιαία'} χρέωση`
                  : `Αλλαγή σε ${plan.name}`}
            </Btn>
          )}
          {/* ΟΙ ΤΡΕΙΣ ΥΠΟΣΧΕΣΕΙΣ ΤΩΝ ΟΡΩΝ ΕΧΟΥΝ ΚΟΥΜΠΙ: ακύρωση, παραστατικά,
              αλλαγή κάρτας. Χωρίς αυτό, οι Οροι δέσμευαν σε κάτι που δεν
              υπήρχε πουθενά στην εφαρμογή. */}
          {hasCustomer && (
            <Btn variant={running ? 'primary' : 'secondary'} onClick={manage} disabled={busy}>
              {busy ? 'Ανοίγει…' : 'Διαχείριση συνδρομής'}
            </Btn>
          )}
        </div>
      ) : null}
      {/* ΤΙ ΘΑ ΓΙΝΕΙ ΜΕ ΤΑ ΧΡΗΜΑΤΑ, ΠΡΙΝ ΠΑΤΗΘΕΙ ΤΟ ΚΟΥΜΠΙ ──────────────────
          Οι τρεις καταλήξεις είναι εντελώς διαφορετικές και καμία δεν είναι
          προφανής: αναβάθμιση χρεώνει σήμερα, υποβάθμιση δεν επιστρέφει και
          μέσα στη δοκιμή δεν κινείται τίποτα. Οποιος πατά χωρίς να το ξέρει,
          το μαθαίνει από την κίνηση της κάρτας του. */}
      {moves && live === true && (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: T.font.sans, lineHeight: 1.55, marginTop: 12 }}>
          {phase === 'trial'
            ? `Δεν χρεώνεσαι σήμερα. Η πρώτη χρέωση γίνεται ${renewsAt ? `στις ${fd(renewsAt)}` : 'στη λήξη της δοκιμής'}, στη νέα τιμή.`
            : goingDown
              ? `Δεν επιστρέφονται χρήματα. Κρατάς το «${PLANS[current].name}» ${renewsAt ? `ως τις ${fd(renewsAt)}` : 'ως την ανανέωση'} και από εκεί χρεώνεσαι στη νέα τιμή.`
              : 'Χρεώνεται σήμερα μόνο η διαφορά, για τις ημέρες που απομένουν ως την ανανέωση.'}
        </div>
      )}

      {/* ΟΤΑΝ ΔΕΝ ΥΠΑΡΧΕΙ ΤΑΜΕΙΟ, ΤΟ ΛΕΜΕ. Απενεργοποιημένο κουμπί θα ήταν
          υπόσχεση που δεν τηρείται με το πάτημα· η πρόταση λέει το ίδιο πράγμα
          με τους Ορους και την Πολιτική απορρήτου, από την ίδια πηγή. */}
      {live === false && (
        <div style={{ marginTop: T.sp.lg }}>
          <InfoBanner tone="info">{note || CHECKOUT_UNREACHABLE}</InfoBanner>
        </div>
      )}

      {/* ΠΟΙΟΣ ΧΡΕΩΝΕΙ, ΓΡΑΜΜΕΝΟ ΠΡΙΝ ΤΗ ΧΡΕΩΣΗ. Στην κίνηση της κάρτας φαίνεται
          το όνομα του παρόχου· ένας πελάτης που δεν το περίμενε το καταγγέλλει
          ως απάτη. Η ΔΙΑΤΥΠΩΣΗ ΕΡΧΕΤΑΙ ΑΠΟ ΤΟΝ ΔΙΑΚΟΜΙΣΤΗ, ίδια με των Ορων:
          η προηγούμενη, γραμμένη εδώ με το χέρι, έλεγε ότι ο πάροχος αποδίδει
          τον ΦΠΑ — και δεν τον αποδίδει αυτός. */}
      {live === true && note && (
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: T.font.sans, lineHeight: 1.55, marginTop: 14 }}>
          {note} Σταματάς όποτε θέλεις και η συνδρομή τρέχει ως το τέλος της περιόδου που έχεις πληρώσει.
        </div>
      )}

      {/* ── Ο ΚΩΔΙΚΟΣ ΔΟΚΙΜΑΣΤΗ ──────────────────────────────────────────
          ΚΛΕΙΣΤΟΣ ΩΣΠΟΥ ΝΑ ΖΗΤΗΘΕΙ. Ενα ορθάνοιχτο πεδίο «κωδικός» δίπλα στην
          τιμή λέει σε κάθε επισκέπτη ότι κάπου υπάρχει έκπτωση που δεν του
          δόθηκε και τον στέλνει να τη ψάξει αντί να πληρώσει. Οποιος έχει
          κωδικό ξέρει ότι τον έχει. */}
      <div style={{ marginTop: T.sp.lg, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
        {!codeOpen ? (
          /* `quiet` γιατί ο σύνδεσμος ήταν ήδη σβησμένος: το accent θα τον έκανε
             πιο δυνατό από την τιμή δίπλα του. */
          <LinkBtn tone="quiet" onClick={() => setCodeOpen(true)}>Έχω κωδικό δοκιμαστή</LinkBtn>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            {/* ΤΟ `placeholder` ΔΕΝ ΟΝΟΜΑΖΕΙ: σβήνεται με τον πρώτο χαρακτήρα και
                το πεδίο ξαναμένει ανώνυμο για τον αναγνώστη οθόνης. */}
            <input value={code} onChange={e => setCode(e.target.value)} placeholder="Κωδικός"
              aria-label="Κωδικός δοκιμαστή"
              autoComplete="off" spellCheck={false} onKeyDown={e => { if (e.key === 'Enter') redeem(); }}
              style={{ height: T.h.md, padding: '0 12px', borderRadius: T.radius.inner, border: '1px solid var(--border-default)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 14, fontFamily: T.font.sans, outline: 'none', minWidth: 180 }} />
            <Btn variant="secondary" onClick={redeem} disabled={busy || !code.trim()}>Εξαργύρωση</Btn>
          </div>
        )}
      </div>
    </Card>
  );
}
