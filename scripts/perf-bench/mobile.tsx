import type React from 'react';
// ═══════════════════════════════════════════════════════════════════════════
// Ο ΠΑΓΚΟΣ ΚΙΝΗΤΟΥ — ΤΑ ΙΔΙΑ COMPONENTS, ΜΕΣΑ ΣΤΟ ΠΡΑΓΜΑΤΙΚΟ ΚΕΛΥΦΟΣ
// ─────────────────────────────────────────────────────────────────────────
// Διαφορές από το harness.tsx (και γιατί):
//  1. Φορτώνει ΟΛΟΚΛΗΡΟ το app/globals.css, όχι μόνο τις μεταβλητές του :root.
//     Χωρίς αυτό δεν υπάρχουν .card, .app-content, .kpi-row, ούτε κανένα
//     media query — δηλαδή η διάταξη που μετριέται δεν είναι η διάταξη που
//     βλέπει ο χρήστης.
//  2. Στήνει .app-shell > .app-main > .app-content, όπως το app/dashboard/page.tsx.
//  3. Δηλώνει `window.__respond`, όχι `window.__fake`. Το harness.tsx έγραφε
//     το δεύτερο, αλλά ο διπλός που πράγματι χρησιμοποιεί ο κώδικας φτιάχνεται
//     μέσα στο fakeClient.ts και ρωτά ΜΟΝΟ το `window.__respond`.
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import Typesetter from '@/components/Typesetter';
import JustifyPolish from '@/components/JustifyPolish';
import type { Responder } from '../e2e-money/fakeDb';
import { portfolio } from './data';
import { writeStatus } from '@/lib/property/status';
import PortfolioTab from '@/app/dashboard/components/PortfolioTab';
import CashHero from '@/app/dashboard/components/CashHero';
import RentReceived from '@/app/dashboard/components/RentReceived';
import InboundInbox from '@/app/dashboard/components/InboundInbox';
import { CustomSelect } from '@/app/dashboard/components/UIComponents';
import ExpenseLedger from '@/app/dashboard/components/ExpenseLedger';
import TabFinances from '@/app/dashboard/components/TabFinances';
import TabChecklist from '@/app/dashboard/components/TabChecklist';
// Η ΣΥΓΚΡΙΣΗ ΜΠΗΚΕ ΟΤΑΝ Ο ΠΙΝΑΚΑΣ ΤΗΣ ΕΚΑΝΕ ΤΗΝ ΟΘΟΝΗ ΝΑ ΠΑΕΙ ΠΕΡΑ ΔΩΘΕ. Η
// ταυτότητα κάθε στήλης («Βραχυχρόνια μίσθωση · 42 τ.μ. · 120.000,00 € · …»)
// είναι μία μακριά συμβολοσειρά χωρίς όριο πλάτους: τραβούσε τη στήλη όσο
// χρειαζόταν και ο πίνακας ξεπερνούσε κατά πολύ το πλάτος της οθόνης.
import TabComparison from '@/app/dashboard/components/TabComparison';
// ΟΙ ΟΘΟΝΕΣ ΠΟΥ ΦΩΤΟΓΡΑΦΙΣΕ Ο ΧΡΗΣΤΗΣ ΣΕ ΤΑΜΠΛΕΤΑ. Ο πάγκος έδειχνε εννιά
// οθόνες και καμία από αυτές: ο έλεγχος διάταξης έβγαινε πράσινος για κώδικα
// που κανείς δεν κοίταζε. Δάνειο, τιμολόγηση βραχυχρόνιας, λογαριασμοί, επαφές.
import TabLoan from '@/app/dashboard/components/TabLoan';
import TabLoanCalculator from '@/app/dashboard/components/TabLoanCalculator';
import { MARKET_FALLBACK, BANKS_NORM, BANKS_VERIFIED } from '@/app/dashboard/components/TabLoanData';
import { grDate } from '@/lib/core/format';
import TabPricing from '@/app/dashboard/components/TabPricing';
// Η ΑΠΟΓΡΑΦΗ ΔΕΝ ΕΙΧΕ ΣΚΗΝΗ. Δεκατρείς κάρτες σε πλέγμα, φίλτρα, μενού και δύο
// προβολές· καμία μέτρηση σε καμία συσκευή, ποτέ.
import TabInventory from '@/app/dashboard/components/TabInventory';
import TabContacts from '@/app/dashboard/components/TabContacts';
import TabBills from '@/app/dashboard/components/TabBills';
// Ο ΠΡΟΫΠΟΛΟΓΙΣΜΟΣ ΔΕΝ ΕΙΧΕ ΣΚΗΝΗ ΚΑΙ ΕΙΝΑΙ 2.005 ΓΡΑΜΜΕΣ. Εννιά γραμμές
// κατηγορίας με ποσό, στόχο, ποσοστό, μπάρα και αναλυτικές κινήσεις — καμία
// μέτρηση, ποτέ. Ο χρήστης φωτογράφισε εκεί ποσά που δεν στοιχίζονταν μεταξύ
// τους· ο σαρωτής δεν μπορούσε να το δει, γιατί η οθόνη δεν αποδιδόταν πουθενά.
import BillsBudget from '@/app/dashboard/components/BillsBudget';
// Η ΠΡΩΤΗ ΟΘΟΝΗ ΠΟΥ ΒΛΕΠΕΙ ΑΝΘΡΩΠΟΣ ΠΟΥ ΜΟΛΙΣ ΕΓΡΑΨΕ ΛΟΓΑΡΙΑΣΜΟ· ήταν επίσης η
// μόνη που κανένας έλεγχος δεν κοίταζε ποτέ: ζει μέσα σε παράθυρο που ανοίγει
// με πάτημα, οπότε καμία σκηνή του πάγκου δεν την αποδίδει.
import AddPropertyWizard from '@/app/dashboard/components/AddPropertyWizard';
// ΤΑ ΔΥΟ ΠΑΡΑΘΥΡΑ ΠΟΥ ΜΙΚΡΥΝΑΝ ΧΩΡΙΣ ΝΑ ΜΕΤΡΗΘΟΥΝ. Η φόρμα ενοικιαστή ήταν 860
// και η γρήγορη προσθήκη 820· η κλίμακα των τεσσάρων τα έφερε και τα δύο στα
// 760. Καμία σκηνή δεν τα απέδιδε, οπότε η αλλαγή ήταν απόφαση χωρίς μέτρηση.
import TabTenant from '@/app/dashboard/components/TabTenant';
import DocumentScan from '@/app/dashboard/components/DocumentScan';
// Η ΑΠΟΔΟΣΗ ΤΗΣ ΕΠΕΝΔΥΣΗΣ: πλακίδια, ιστορικό διάγραμμα, σύγκριση με
// εναλλακτικές και το πεδίο «Ετήσια ανατίμηση ακινήτου», όπου ο χρήστης
// φωτογράφησε κομμένο το «6,8» σε ταμπλέτα.
import TabRentROI from '@/app/dashboard/components/TabRentROI';
// ═══ ΟΙ ΤΕΣΣΕΡΙΣ ΜΕΓΑΛΥΤΕΡΕΣ ΚΑΡΤΕΛΕΣ ΠΟΥ ΔΕΝ ΕΙΧΕ ΔΕΙ ΠΟΤΕ ΚΑΜΙΑ ΜΕΤΡΗΣΗ ═══
//
// Ο πάγκος είχε δεκαεπτά σκηνές και ο σαρωτής έβγαινε πράσινος σε δώδεκα
// πλάτη. Το «πράσινο» όμως αφορούσε ΜΟΝΟ ό,τι αποδιδόταν εδώ. Εξω έμεναν οι
// τέσσερις μεγαλύτερες καρτέλες της εφαρμογής, 7.333 γραμμές διεπαφής:
//
//   TabCalendar    2.239 γραμμές   ημερολόγιο, πλέγμα μήνα, λίστα ημέρας
//   TabClients     1.838 γραμμές   πελατολόγιο, κάρτες, διαμονές
//   TabAccounting  1.805 γραμμές   λογιστική, πίνακες, φορολογικά
//   TabDocuments   1.451 γραμμές   έγγραφα, φάκελοι, προεπισκόπηση
//
// Ενα ημερολόγιο με πλέγμα επτά στηλών και μια λογιστική με πίνακες είναι
// ακριβώς οι δύο μορφές που σπάνε πρώτες σε στενή οθόνη. Το ότι δεν είχαν
// μετρηθεί ΔΕΝ σήμαινε ότι ήταν εντάξει· σήμαινε ότι δεν το ξέραμε.
import TabAccounting from '@/app/dashboard/components/TabAccounting';
import TabSettings from '@/app/dashboard/components/TabSettings';
import TabCalendar from '@/app/dashboard/components/TabCalendar';
import { DaySheet } from '@/app/dashboard/components/calendar/MonthView';
import type { CalEvent } from '@/app/dashboard/components/calendar/model';
import TabClients from '@/app/dashboard/components/TabClients';
import TabDocuments from '@/app/dashboard/components/TabDocuments';
import TabReferral from '@/app/dashboard/components/TabReferral';
import Billing from '@/app/dashboard/components/Billing';
import ReportBranding from '@/app/dashboard/components/ReportBranding';
import { OverviewTab } from '@/app/dashboard/components/OverviewTab';
// Η ΝΟΑ ΠΑΝΩ ΑΠΟ ΚΑΘΕ ΣΚΗΝΗ, ΟΤΑΝ ΖΗΤΗΘΕΙ. Το πλωτό κουμπί ζει σε κάθε καρτέλα
// της εφαρμογής και σε καμία σκηνή του πάγκου: ό,τι σκέπαζε δεν το μετρούσε
// κανείς. Με `?noa=1` αποδίδεται ΠΑΝΩ από τη σκηνή, όπως στο app/dashboard/page.tsx.
import PropertyAssistant from '@/app/dashboard/components/PropertyAssistant';
import TabPlan from '@/app/dashboard/components/TabPlan';
import PropertySwitcher from '@/app/dashboard/components/PropertySwitcher';
import { T, TT, Modal, Btn, PageTitle, InfoBanner, fieldRow } from '@/components/Theme';
import { ConfirmHost } from '@/components/ConfirmDialog';
import { createClient } from '@/lib/supabase/client';
import MyaadeImport from '@/app/dashboard/components/MyaadeImport';
import { CenterState, DoneView, MYAADE_CSS } from '@/app/dashboard/components/MyaadeSteps';
import { parseEnfiaAct } from '@/lib/myaade/enfiaAct';
import { fakeAtak } from '@/lib/myaade/fixtures';
import type { CashLine, CashPosition } from '@/lib/home/cash';

declare global {
  interface Window { __t: Record<string, number>; __rows: () => number }
}

const params = new URLSearchParams(location.search);
const n = Number(params.get('n') || 200);
const which = params.get('c') || 'portfolio';
const bench = portfolio(n);

// Τα εισερχόμενα δεν βγαίνουν από το `portfolio()`: το InboundInbox διαβάζει
// τον δικό του πίνακα και χωρίς γραμμές δεν αποδίδει τίποτα (by design).
const inboundRows = Array.from({ length: 6 }, (_, i) => ({
  id: `m${i}`, from_address: `logariasmoi${i}@deh.gr`,
  subject: `Λογαριασμός ρεύματος Ιανουαρίου ${2026} · παροχή 1234567890`,
  vendor: 'ΔΕΗ', amount: i === 2 ? null : 84.5 + i * 13,
  due_date: '2026-09-10', issue_date: '2026-08-20',
  category: 'electricity', expense_group: 'utilities', attachments: 1,
}));

// ΤΑ ΦΙΛΤΡΑ ΤΗΡΟΥΝΤΑΙ. Ο διπλός του perf-bench επιστρέφει ΟΛΕΣ τις γραμμές του
// πίνακα, ό,τι κι αν ζήτησε η οθόνη — σωστό για το Χαρτοφυλάκιο, που όντως
// διαβάζει όλα τα ακίνητα, αλλά ψεύτικο για κάθε οθόνη ΕΝΟΣ ακινήτου: το
// Καθολικό Δαπανών θα έπαιρνε 2.000 λογαριασμούς αντί για 10 και η μέτρηση
// ύψους θα μετρούσε τον διπλό, όχι την εφαρμογή.
const applyEq = (rows: unknown[], filters: Array<[string, string, unknown]>) => {
  let out = rows;
  for (const [m, col, val] of filters) {
    if (m !== 'eq') continue;
    out = out.filter(r => {
      const v = (r as Record<string, unknown>)[col];
      return v === undefined || String(v) === String(val);
    });
  }
  return out;
};

// ── Η ΕΙΣΑΓΩΓΗ ΑΠΟ ΤΟ myAADE ────────────────────────────────────────────────
// Συνθετική πράξη (ψεύτικοι ΑΤΑΚ με το πρόθεμα 999, «Οδός Παραδείγματος»).
// Στην εφαρμογή υπάρχουν δύο ακίνητα: ένα με τον ΑΤΑΚ της πρώτης γραμμής, ένα
// χωρίς ΑΤΑΚ με τη διεύθυνση της δεύτερης, ώστε να φανούν όλες οι καταστάσεις.
// Και δύο «Ιδιοκτήτες» στο Πελατολόγιο, για την ερώτηση «Ποιου ιδιοκτήτη;».
const myaadeRow = (n: number, tax: string, kind = 'Διαμέρισμα') =>
  [fakeAtak(n), `Οδός Παραδείγματος ${10 + n}`, 'Δήμος Δοκιμής', kind, String(n), `${60 + n},00`, '100,00', tax].join('\t');
const MYAADE_ACT = parseEnfiaAct([
  'ΔΗΛΩΣΗ ΕΝΦΙΑ - ΠΡΑΞΗ ΠΡΟΣΔΙΟΡΙΣΜΟΥ ΦΟΡΟΥ ΕΤΟΥΣ 2026', 'Φορολογικό έτος:\t2026', 'Ημερομηνία έκδοσης:\t15/03/2026',
  ['Α.Τ.ΑΚ.', 'Διεύθυνση', 'Δήμος / Δ. Κοινότητα', 'Είδος', 'Όροφος', 'Επιφάνεια (τ.μ.)', 'Ποσοστό', 'Φόρος'].join('\t'),
  myaadeRow(1, '412,30'), myaadeRow(2, '210,40'), myaadeRow(3, '120,50'), myaadeRow(4, '100,00', 'Αποθήκη'),
  'Ποσό για καταβολή:\t843,20',
]);
const MYAADE_KNOWN = [
  { id: 'p0', name: 'Σπίτι Παραδείγματος', address: 'Οδός Παραδείγματος 11', atak: fakeAtak(1), sqm: 61, ownership: 100, floor: '1', user_id: 'u1' },
  { id: 'p1', name: 'Διαμέρισμα πάνω', address: 'Παραδείγματος 12', atak: null, sqm: 0, ownership: 100, floor: '', user_id: 'u1' },
];
const MYAADE_OWNERS = [{ id: 'o1', full_name: 'Ελένη Παραδείγματος', afm: null, type: 'owner' }, { id: 'o2', full_name: 'Νίκος Δοκιμής', afm: null, type: 'owner' }];

const respond: Responder = (call) => {
  if (call.op !== 'select') return { data: null, error: null };
  if (which.startsWith('myaade') && call.table === 'user_properties') return { data: MYAADE_KNOWN, error: null };
  if (which.startsWith('myaade') && call.table === 'clients') return { data: MYAADE_OWNERS, error: null };
  if (call.table === 'inbound_messages') return { data: inboundRows, error: null };
  const rows = bench.rows[call.table];
  if (!rows) return { data: call.single ? null : [], error: null };
  const kept = which === 'portfolio' ? rows : applyEq(rows, call.filters);
  return { data: call.single ? (kept[0] ?? null) : kept, error: null };
};
window.__respond = respond;
window.__t = {};
window.__rows = () => document.querySelectorAll('tbody tr').length;

const line = (i: number): CashLine => ({
  label: `Ακίνητο ${i + 1} · Ενοίκιο Ιανουαρίου 2026`,
  amount: 400 + i * 50,
  due: '2026-01-05',
  daysLeft: -20 - i,
  rent: { id: `r${i}`, year: 2026, month: 1, propertyId: `p${i}`, tenantId: `t${i}` },
});
const lines = Array.from({ length: 6 }, (_, i) => line(i));

const cash: CashPosition = {
  owedToMe: { total: 4350, count: 6, overdue: 4350, overdueCount: 6, lines },
  owedByMe: { total: 1287.4, count: 4, overdue: 620, overdueCount: 2, lines: lines.slice(0, 4).map(l => ({ ...l, rent: null, label: 'ΕΝΦΙΑ δόση Ιανουαρίου' })) },
};

// ΤΑ ΔΥΟ ΑΚΙΝΗΤΑ ΤΗΣ ΣΥΓΚΡΙΣΗΣ ΕΙΝΑΙ ΤΟΥ ΙΔΙΟΥ ΤΥΠΟΥ, ΑΛΛΙΩΣ Η ΟΘΟΝΗ ΔΕΙΧΝΕΙ
// ΚΕΝΗ ΚΑΤΑΣΤΑΣΗ. Ο πάγκος έδινε το χαρτοφυλάκιο όπως έρχεται και η καρτέλα
// απαντούσε, σωστά, «κανένα ζευγάρι ακινήτων ίδιου τύπου»: ο έλεγχος πλάτους
// θα μετρούσε άδεια οθόνη. Τα νούμερα είναι αυτά της αναφοράς του χρήστη.
const comparePair = [
  { id: 'c1', name: 'Στούντιο Κουκάκι', prop_type: 'apartment', sqm: 42, value: 120000, ...writeStatus('rent_short') },
  { id: 'c2', name: 'Διαμέρισμα Παγκράτι', prop_type: 'apartment', sqm: 78, value: 150000, ...writeStatus('rent_short') },
];

const OPTS = Array.from({ length: 14 }, (_, i) => ({ value: `v${i}`, label: `Κατηγορία δαπάνης πολύ μακρύ όνομα ${i + 1}` }));

// ΤΟ ΦΥΛΛΟ ΤΗΣ ΗΜΕΡΑΣ ΔΕΝ ΤΟ ΕΒΛΕΠΕ ΚΑΝΕΝΑΣ ΣΑΡΩΤΗΣ. Ανοίγει μόνο με πάτημα σε
// κελί του μήνα και μόνο με δάχτυλο, δηλαδή καμία σκηνή του πάγκου δεν το
// έφτανε. Εδώ στήνεται με τη ΔΥΣΚΟΛΗ μέρα: εφτά γεγονότα, τρία με ώρα, τίτλοι
// που ξεπερνούν το πλάτος, ποσά τεσσάρων ψηφίων, ένα πληρωμένο.
const DAY_EVENTS: CalEvent[] = ([
  ['Δόση δανείου', 'financial', '09:00', 435, 'pending'],
  ['ΕΝΦΙΑ, δεύτερη δόση έτους', 'tax', null, 1284.5, 'pending'],
  ['Λογαριασμός ΕΥΔΑΠ, δίμηνο Ιουλίου Αυγούστου', 'bills', null, 87.3, 'paid'],
  ['Έλεγχος υγρασίας στο υπόγειο, συνεργείο Παπαδόπουλος', 'maintenance', '11:30', null, 'pending'],
  ['Λήξη μίσθωσης', 'contract', null, null, 'pending'],
  ['Καθαρισμός μετά την αναχώρηση', 'maintenance', '14:00', 45, 'pending'],
  ['Ασφάλιστρα', 'financial', null, 312, 'pending'],
] as const).map(([title, category, event_time, amount, status], i) => ({
  id: 'd' + i, property_id: 'p0', user_id: 'u1', title,
  category: category as CalEvent['category'], event_date: '2026-09-15',
  event_time, amount, priority: 'medium' as CalEvent['priority'],
  status: status as CalEvent['status'], recurring: false, source: 'manual',
  created_at: '2026-09-01T00:00:00Z',
}));

function DaySheetDemo() {
  const [open, setOpen] = useState(true);
  return open
    ? <DaySheet date="2026-09-15" events={DAY_EVENTS} onClose={() => setOpen(false)} onPick={() => {}} onNew={() => {}} />
    : <PageTitle title="Φύλλο ημέρας" sub="κλειστό" right={<Btn variant="primary" onClick={() => setOpen(true)}>Άνοιγμα</Btn>} />;
}

function ModalDemo() {
  const [open, setOpen] = useState(true);
  const [v, setV] = useState('v0');
  return (
    <div>
      <PageTitle title="Δοκιμή παραθύρου" sub="Modal στα 375" right={<Btn variant="primary" onClick={() => setOpen(true)}>Άνοιγμα</Btn>} />
      <Modal open={open} onClose={() => setOpen(false)} title="Καταστάσεις ιδιοκτήτη"
        subtitle="Ανά ακίνητο, για την περίοδο που θα επιλέξεις"
        footer={<><Btn variant="ghost" onClick={() => setOpen(false)}>Άκυρο</Btn><Btn variant="primary" onClick={() => {}}>Έκδοση</Btn></>}
        footerInfo="Η κατάσταση εκδίδεται σε PDF">
        <InfoBanner tone="warning">Ένα μήνυμα που εξηγεί τι θα γίνει, αρκετά μακρύ ώστε να τυλιχτεί σε στενή οθόνη κινητού.</InfoBanner>
        <div {...fieldRow(170)}>
          <CustomSelect label="Κατηγορία" value={v} onChange={setV} options={OPTS} />
          <CustomSelect label="Δεύτερη κατηγορία" value={v} onChange={setV} options={OPTS} />
        </div>
        {Array.from({ length: 24 }, (_, i) => (
          <p key={i} style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
            Γραμμή {i + 1}: κείμενο γεμίσματος ώστε το περιεχόμενο του παραθύρου να ξεπερνά το ύψος της οθόνης και να φανεί ποιος κυλά.
          </p>
        ))}
      </Modal>
    </div>
  );
}

function SelectDemo() {
  const [v, setV] = useState('v0');
  return (
    <div>
      {/* Ο ΥΠΟΤΙΤΛΟΣ ΕΛΕΓΕ ΠΛΑΤΟΣ ΠΟΥ ΔΕΝ ΙΣΧΥΕΙ. Ηταν καρφωμένο «στα 375» και ο
          πάγκος τρέχει σε δώδεκα πλάτη: σε κάθε ένα από τα άλλα έντεκα, η οθόνη
          έγραφε λάθος νούμερο. Και ήταν το μοναδικό λατινικό κείμενο της
          σκηνής, δηλαδή έμοιαζε με προϊόν χωρίς να είναι. */}
      <PageTitle title="Επιλογείς" sub="Τρεις επιλογείς με μακρύ λεκτικό, για να φανεί πού κόβεται" />
      <div className="card">
        <div {...fieldRow(160)}>
          <CustomSelect label="Κατηγορία" value={v} onChange={setV} options={OPTS} />
          <CustomSelect label="Ακίνητο" value={v} onChange={setV} options={OPTS} />
          <CustomSelect label="Τρόπος" value={v} onChange={setV} options={OPTS} />
        </div>
      </div>
    </div>
  );
}

// ΤΟ «lens» ΗΤΑΝ ΚΑΡΦΩΜΕΝΟ ΣΤΟ ΚΕΝΟ ΚΑΙ Ο ΔΙΑΚΟΠΤΗΣ ΤΟΥ ΑΝΕΝΕΡΓΟΣ. Ο πάγκος
// έδινε `lens=""` και `onLens={() => {}}`, δηλαδή ΚΑΝΕΝΑ από τα πέντε πάνελ του
// δανείου δεν αποδιδόταν ποτέ: ούτε το γράφημα απόσβεσης, ούτε η σύγκριση
// τόκων, ούτε η αντοχή δόσης, ούτε ο πίνακας. Πέντε οθόνες που ο χρήστης
// βλέπει και κανένας έλεγχος διάταξης δεν τις είχε δει.
function LoanScene() {
  const [lens, setLens] = useState('amort');
  return <TabLoanCalculator propertyId="p0" userId="u1" market={MARKET_FALLBACK}
    onSaveLoan={async () => {}} onSaveToCalendar={async () => {}} onSaveToExpenses={async () => {}}
    lens={lens} onLens={setLens} banks={BANKS_NORM} banksVerified={grDate(BANKS_VERIFIED)} />;
}

const supabase = createClient();

// Το ακίνητο της Αξιοποίησης: παλιό αρκετά ώστε να ενεργοποιεί τα βήματα που
// εξαρτώνται από το έτος κατασκευής (γείωση, θερμομόνωση) και με αξία, ώστε ο
// πίνακας «τι μένει καθαρό» της πώλησης να έχει νούμερα να δείξει.
const PLAN_PROPERTY = {
  id: 'p0', name: 'Στούντιο Κουκάκι', address: 'Δημητρακοπούλου 12, Αθήνα',
  sqm: 42, value: 185000, year_built: 1972, postal_code: '11741', prop_type: 'Διαμέρισμα',
};

// ═══ Η ΟΘΟΝΗ ΠΟΥ ΒΛΕΠΟΥΝ ΟΛΟΙ ΚΑΙ ΔΕΝ ΕΙΧΕ ΔΕΙ ΠΟΤΕ ΚΑΝΕΙΣ ═══════════════════
// Τριάντα δύο σκηνές, δώδεκα πλάτη, δύο σαρωτές — και η Επισκόπηση έλειπε από
// τον κατάλογο. Είναι η πρώτη οθόνη κάθε συνεδρίας: το ταμείο, τα πρώτα βήματα,
// οι προθεσμίες, η κατάσταση του ακινήτου. Κάθε εύρημα διάταξης ή προσβασιμότητας
// εκεί το έβλεπε ο χρήστης πριν από εμάς.
//
// ΤΟ ΑΚΙΝΗΤΟ ΕΙΝΑΙ ΠΛΗΡΕΣ, ΟΧΙ ΣΚΙΤΣΟ: η οθόνη διαβάζει αντικειμενική αξία,
// παλαιότητα, ΑΤΑΚ, ασφάλιση και ενεργειακή κλάση για να χτίσει τον φόρο, τον
// ΕΝΦΙΑ και τις εκκρεμότητες. Με μισό ακίνητο θα μετρούσαμε μισή οθόνη.
const OVERVIEW_PROPERTY = {
  id: 'p0', user_id: 'u1', name: 'Στούντιο Κουκάκι', prop_type: 'Διαμέρισμα',
  address: 'Δημητρακοπούλου 12, Αθήνα', postal_code: '11741', sqm: 42, ownership: '100',
  value: 185000, obj_value: 96000, purchase_price: 148000, purchase_date: '2019-04-18',
  target_rent: 620, enfia: 214, insurance_amount: 180, insurance_company: 'Παράδειγμα ΑΕ',
  insurance_expiry: '2027-03-31', pea_class: 'D', year_built: 1972, atak: '01234567890123',
  floor: 3, heating: 'Αυτόνομη', parking_spaces: 0, storage_sqm: 5, bedrooms: 1,
  rental_mode: 'long_term', client_id: null, co_owners: null, notes: null,
  status_detail: 'rented', created_at: '2019-04-18T00:00:00Z',
};

// ═══ ΤΟ ΒΗΜΑ ΕΛΕΓΧΟΥ ΤΗΣ ΣΑΡΩΣΗΣ ΔΕΝ ΤΟ ΕΙΧΕ ΔΕΙ ΚΑΝΕΝΑΣ ΣΑΡΩΤΗΣ ════════════
// Η σκηνή «scan» αποδίδει μόνο τα πλακίδια: το βήμα ελέγχου εμφανίζεται ΑΦΟΥ
// ανέβει αρχείο και απαντήσει η ανάγνωση, οπότε κανένας από τους σαρωτές
// διάταξης και προσβασιμότητας δεν το είχε μετρήσει ποτέ. Εκεί ακριβώς ήταν η
// οριζόντια υπερχείλιση, τα τρία ύψη πεδίων και το «0,00€» που φωτογράφισε ο
// ιδιοκτήτης.
//
// Η σκηνή κάνει ό,τι ο χρήστης: ζωγραφίζει μια σελίδα, την περνά στο κρυφό
// πεδίο αρχείου και απαντά στην ανάγνωση με έτοιμο έγγραφο (`?doc=`), χωρίς
// δίκτυο. Η προεπιλογή είναι ο λογαριασμός ρεύματος: έχει τα περισσότερα πεδία.
const SCAN_REVIEW_DOCS: Record<string, Record<string, unknown>> = {
  bill: {
    doc_type: 'bill', title: 'Λογαριασμός ρεύματος', provider: 'Πάροχος Ενέργειας Α.Ε.', provider_afm: '090000045',
    category: 'electricity', amount: 84.5, issue_date: '2026-09-20', due_date: '2026-10-10',
    period: 'Αύγουστος 2026', kwh: 312, account_num: '123456789',
    notes: 'Λογαριασμός έναντι, περιλαμβάνει ΕΡΤ και δημοτικά τέλη.', confidence: 92,
  },
  lease: { doc_type: 'lease', title: 'Μισθωτήριο κατοικίας', tenant_name: 'Γ. Παραδειγματίδης', lease_start: '2026-10-01', lease_end: '2029-09-30', deposit: 1300, confidence: 88 },
  enfia: { doc_type: 'tax', subtype: 'enfia', title: 'Εκκαθαριστικό ΕΝΦΙΑ', provider: 'ΑΑΔΕ', tax_year: 2026, confidence: 84 },
  e2: { doc_type: 'tax', subtype: 'e2', title: 'Αναλυτική κατάσταση μισθωμάτων (Ε2)', tax_year: 2025, issue_date: '2026-06-12', confidence: 90 },
  payment: { doc_type: 'payment', title: 'Απόδειξη πληρωμής', provider: 'Πάροχος Ενέργειας Α.Ε.', category: 'electricity', amount: 84.5, issue_date: '2026-10-02', confidence: 86 },
};

function ScanReviewScene() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const doc = SCAN_REVIEW_DOCS[params.get('doc') || 'bill'] || SCAN_REVIEW_DOCS.bill;
    const orig = window.fetch.bind(window);
    window.fetch = async (url, init) => (String(url).includes('/api/anthropic')
      ? new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(doc) }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      : orig(url, init));
    // Μια σελίδα εγγράφου, σε καμβά: λευκό χαρτί, επικεφαλίδα, γραμμές χρεώσεων.
    const c = document.createElement('canvas');
    c.width = 620; c.height = 860;
    const g = c.getContext('2d');
    if (!g) return;
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#111111'; g.font = 'bold 26px sans-serif'; g.fillText('Λογαριασμός', 40, 70);
    g.font = '16px sans-serif';
    for (let i = 0; i < 14; i++) g.fillRect(40, 120 + i * 44, 300 + (i * 37) % 200, 10);
    c.toBlob(b => {
      const input = [...(ref.current?.querySelectorAll<HTMLInputElement>('input[type=file]') || [])].pop();
      if (!b || !input) return;
      const dt = new DataTransfer();
      dt.items.add(new File([b], 'logariasmos-revmatos-avgoustos-2026.png', { type: 'image/png' }));
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, 'image/png');
    return () => { window.fetch = orig; };
  }, []);
  return (
    <div ref={ref}>
      <Modal open onClose={() => {}} size="lg" title="Σάρωση εγγράφου">
        <DocumentScan propertyId="p0" userId="u1" properties={BENCH_PROPS} onSaved={async () => {}} onBusyChange={() => {}} onManual={() => {}} />
      </Modal>
    </div>
  );
}

const VIEWS: Record<string, () => React.ReactElement> = {
  // Η εισαγωγή από το myAADE, σε όλες τις καταστάσεις της. Το ίδιο το
  // παράθυρο για την επιλογή αρχείου και την προεπισκόπηση· για το «Έτοιμο» και
  // το σφάλμα αρχείου οι ίδιες οθόνες του MyaadeSteps, με σταθερά δεδομένα.
  myaade: () => <MyaadeImport userId="u1" limit={3} onUpgrade={() => {}} onClose={() => {}} onSaved={() => {}} />,
  myaadeReview: () => <MyaadeImport userId="u1" limit={3} onUpgrade={() => {}} onClose={() => {}} onSaved={() => {}}
    initialDoc={MYAADE_ACT.status === 'ok' ? MYAADE_ACT.doc : undefined} />,
  myaadeDone: () => (
    <Modal open onClose={() => {}} size="md" title="Εισαγωγή από το myAADE" footerInfo="Αναίρεση έως 31/10/2026 12:15"
      footer={<><Btn variant="ghost">Αναίρεση</Btn><Btn variant="secondary">Τέλος</Btn><Btn variant="primary">Δες τις δόσεις</Btn></>}>
      <style>{MYAADE_CSS}</style>
      <DoneView s={{ created: 1, filled: 2, enfia: { year: 2026, total: 843.2, instalments: 12 }, leftOut: 1 }} onUpgrade={() => {}} />
    </Modal>
  ),
  myaadeError: () => (
    <Modal open onClose={() => {}} size="md" title="Εισαγωγή από το myAADE">
      <style>{MYAADE_CSS}</style>
      <CenterState tone="negative" title="Δεν το αναγνωρίσαμε" info="Δεν το αναγνωρίσαμε ως πράξη ΕΝΦΙΑ του myAADE."
        action={{ label: 'Δοκίμασε άλλο αρχείο', onClick: () => {} }}>
        <span style={{ ...TT.body, color: 'var(--text-secondary)' }}>Χρειαζόμαστε την πράξη ΕΝΦΙΑ, όπως την αποθηκεύεις από το myAADE.</span>
      </CenterState>
    </Modal>
  ),
  overview: () => <OverviewTab prop={OVERVIEW_PROPERTY as never} properties={[OVERVIEW_PROPERTY] as never} userId="u1" onNavigate={() => {}} tabVisible={() => true} />,
  portfolio: () => <PortfolioTab properties={bench.properties} userId="u1" onSelectProperty={() => {}} />,
  cash: () => <CashHero cash={cash} showIncome onNavigate={() => {}} onRecordRent={() => {}} />,
  rent: () => <RentReceived onClose={() => {}} lines={lines} supabase={supabase} propertyId={null} tenantId={null} leaseViaBank today="2026-08-23" onSaved={() => {}} />,
  inbox: () => <InboundInbox propertyId="p0" userId="u1" propertyName="Ακίνητο 1" onFiled={() => {}} />,
  ledger: () => <ExpenseLedger propertyId="p0" userId="u1" />,
  // Η ΚΑΡΤΕΛΑ ΟΛΟΚΛΗΡΗ, ΟΧΙ ΜΟΝΟ ΤΟ ΒΙΒΛΙΟ. Η σκηνή «ledger» αποδίδει σκέτο το
  // ExpenseLedger, οπότε η σειρά καρτελών, η γραμμή τράπεζας και η κύρια
  // ενέργεια δεν μετρήθηκαν ποτέ από κανέναν έλεγχο: ό,τι ζει στο TabFinances
  // ήταν αόρατο στον πάγκο. Εδώ μπαίνει το πραγματικό κέλυφος.
  finances: () => <TabFinances propertyId="p0" userId="u1" propertyName="Στούντιο Κουκάκι" onScan={() => {}} />,
  checklist: () => <TabChecklist propertyId="p0" userId="u1" />,
  compare: () => <TabComparison properties={comparePair as never} userId="u1" />,
  loan: () => <LoanScene />,
  // ══ Η ΣΥΜΒΟΥΛΕΥΤΙΚΗ ΔΑΝΕΙΟΥ ΔΕΝ ΕΙΧΕ ΜΕΤΡΗΘΕΙ ΠΟΤΕ ══════════════════════
  // Η σκηνή «loan» στήνει ΜΟΝΟ τον υπολογιστή. Ολο το υπόλοιπο της καρτέλας —
  // η ανάλυση σεναρίου, η πιθανότητα έγκρισης, η σύγκριση τραπεζών, τα κρατικά
  // προγράμματα, ο οδηγός — δηλαδή το μεγαλύτερο και πιο σύνθετο κομμάτι της
  // εφαρμογής, δεν το άνοιγε καμία σάρωση: ούτε η διάταξη, ούτε ο κάθετος
  // χώρος, ούτε η στοίχιση χειριστηρίων, ούτε η προσβασιμότητα.
  loanAdvisor: () => <TabLoan propertyId="p0" userId="u1" propertyValue={185000} propertySqm={78} propertyYearBuilt={1998} />,
  pricing: () => <TabPricing propertyId="p0" userId="u1" propertyName="Στούντιο Κουκάκι" propertySqm={42} />,
  bills: () => <TabBills propertyId="p0" userId="u1" />,
  budget: () => <BillsBudget propertyId="p0" userId="u1" />,
  budgetPro: () => <BillsBudget propertyId="p0" userId="u1" profileType="professional" />,
  contacts: () => <TabContacts propertyId="p0" userId="u1" />,
  wizard: () => <AddPropertyWizard userId="u1" onClose={() => {}} onSaved={() => {}} />,
  roi: () => <TabRentROI propertyId="p0" userId="u1" propertyValue={185000} />,
  // ═══ ΟΙ ΚΛΕΙΔΩΜΕΝΕΣ ΕΝΟΤΗΤΕΣ ΔΕΝ ΜΕΤΡΗΘΗΚΑΝ ΠΟΤΕ ═══════════════════════════
  // Ολες οι σκηνές τρέχουν με τις προεπιλογές των στηριγμάτων, δηλαδή
  // `plan = 'free'` και `profileType = 'individual'`. Στην Αποδοση αυτό κόβει
  // δύο ολόκληρες ενότητες, την Επενδυτική ανάλυση και την Αναλυση
  // ευαισθησίας, μαζί με τα χειριστήρια «Ορίζοντας ανατοκισμού» και «Ορίζοντας
  // κατοχής», τα τέσσερα MetricTile του IRR και τον πίνακα παραδοχών. Καμία
  // σάρωση δεν τα είχε δει ΠΟΤΕ: μετρούσαμε τη μισή καρτέλα και το λέγαμε
  // «καθαρή». Το ίδιο ισχύει για τη Λογιστική με το ημερολόγιο άρθρων.
  //
  // Οι δύο σκηνές δεν αντικαθιστούν τις ελεύθερες: ΚΑΙ ΟΙ ΔΥΟ καταστάσεις
  // υπάρχουν σε πραγματικούς χρήστες, οπότε και οι δύο μετριούνται.
  'roi-pro': () => <TabRentROI propertyId="p0" userId="u1" propertyValue={185000} profileType="professional" legalForm="company" plan="agency" />,
  'accounting-pro': () => <TabAccounting propertyId="p0" userId="u1" profileType="professional" legalForm="company" plan="agency" />,
  // ΣΤΟ p1, ΟΧΙ ΣΤΟ p0. Το p0 είναι βραχυχρόνιο (`short = i % 4 === 0`) και δεν
  // έχει μισθωτή: η σκηνή απέδιδε την ΚΕΝΗ κατάσταση και η κάρτα ενοικιαστή —
  // με τη λωρίδα μεγεθών και τις κομμένες ετικέτες της — δεν είχε δει σαρωτή ποτέ.
  tenant: () => <TabTenant propertyId="p1" userId="u1" onStartHandover={() => {}} />,
  scan: () => (
    <Modal open onClose={() => {}} size="lg" title="Σάρωση εγγράφου">
      <DocumentScan propertyId="p0" userId="u1" properties={BENCH_PROPS} onSaved={async () => {}} onBusyChange={() => {}} onManual={() => {}} />
    </Modal>
  ),
  scanReview: () => <ScanReviewScene />,
  inventory: () => <TabInventory propertyId="p0" userId="u1" />,
  // ═══ ΟΙ ΡΥΘΜΙΣΕΙΣ ΔΕΝ ΕΙΧΑΝ ΔΕΙ ΠΟΤΕ ΣΑΡΩΤΗ ══════════════════════════════
  // Καμία από τις πέντε σαρώσεις δεν τις απέδιδε, γιατί δεν υπήρχαν εδώ. Είναι
  // η καρτέλα με τα περισσότερα πεδία και τους περισσότερους διακόπτες της
  // εφαρμογής, δηλαδή ακριβώς εκεί που η στοίχιση σπάει πρώτη. Και οι δύο
  // μορφές του χρήστη, γιατί η επαγγελματική δείχνει επιπλέον ενότητες.
  settings: () => <TabSettings propertyId="p0" userId="u1" />,
  settingsPro: () => <TabSettings propertyId="p0" userId="u1" profileType="professional" />,
  accounting: () => <TabAccounting propertyId="p0" userId="u1" />,
  // Η ΚΕΝΗ ΟΘΟΝΗ ΤΗΣ ΛΟΓΙΣΤΙΚΗΣ, ΣΤΙΣ ΔΥΟ ΑΚΡΕΣ ΤΗΣ. Το κύριο κουμπί της έστελνε
  // πάντα στον Ενοικιαστή, καρτέλα αόρατη σε έξι από τις επτά καταστάσεις: ο
  // χρήστης προσγειωνόταν σιωπηλά στην Επισκόπηση. Καμία σκηνή δεν την απέδιδε,
  // οπότε το λάθος δεν φαινόταν πουθενά. Το ακίνητο «p9» δεν υπάρχει στα
  // πλαστά δεδομένα, άρα η καρτέλα μένει κενή — που είναι ακριβώς το ζητούμενο.
  accountingEmpty: () => <TabAccounting propertyId="p9" userId="u1" status="vacant" />,
  accountingShort: () => <TabAccounting propertyId="p9" userId="u1" status="rent_short" />,
  calendar: () => <TabCalendar propertyId="p0" userId="u1" openTasks={3} />,
  clients: () => <TabClients userId="u1" />,
  documents: () => <TabDocuments propertyId="p0" userId="u1" />,
  // Οι κάρτες ανταμοιβής δεν είχαν ΚΑΜΙΑ κάλυψη: η καρτέλα ζει πίσω από
  // λογαριασμό, οπότε ούτε ο σαρωτής διάταξης ούτε ο έλεγχος προσβασιμότητας
  // την είχαν δει ποτέ.
  // Η ΑΞΙΟΠΟΙΗΣΗ ΔΕΝ ΕΙΧΕ ΣΚΗΝΗ. Τέσσερις καταστάσεις ακινήτου, τέσσερις
  // διαφορετικές οθόνες· καμία δεν είχε περάσει ποτέ από σαρωτή διάταξης ή
  // από έλεγχο προσβασιμότητας: η καρτέλα ζει πίσω από λογαριασμό ΚΑΙ πίσω από
  // συγκεκριμένη κατάσταση. Μπαίνουν οι δύο πιο πλούσιες (κενό: σύγκριση επτά
  // επιλογών· ανακαίνιση: ομάδες βημάτων και προγράμματα χρηματοδότησης) και η
  // πώληση, που είναι η μόνη με πίνακα ποσών.
  plan: () => <TabPlan propertyId="p0" userId="u1" status="vacant" property={PLAN_PROPERTY} />,
  planReno: () => <TabPlan propertyId="p0" userId="u1" status="renovation" property={PLAN_PROPERTY} />,
  planSale: () => <TabPlan propertyId="p0" userId="u1" status="for_sale" property={PLAN_PROPERTY} />,
  // ═══ ΟΙ ΡΥΘΜΙΣΕΙΣ ΔΕΝ ΕΙΧΑΝ ΠΟΤΕ ΣΚΗΝΗ ══════════════════════════════════════
  // Τα «Στοιχεία τιμολόγησης» είναι η πυκνότερη φόρμα της εφαρμογής (έντεκα
  // πεδία σε τέσσερις στήλες) και η «Επωνυμία στις αναφορές» η μόνη με ανέβασμα
  // αρχείου δίπλα σε πεδία. Καμία από τις δύο δεν είχε περάσει ποτέ από σαρωτή
  // διάταξης ή από έλεγχο προσβασιμότητας: ζουν πίσω από λογαριασμό, οπότε ούτε
  // ο πάγκος ούτε οι δημόσιες σελίδες τις έβλεπαν. Ο χρήστης τις είδε.
  billing: () => <Billing userId="u1" />,
  branding: () => <ReportBranding userId="u1" plan="agency" onUpgrade={() => {}} />,
  referral: () => <TabReferral userId="u1" plan="solo" profileType="individual" />,
  referralPro: () => <TabReferral userId="u1" plan="agency" profileType="professional" />,
  modal: () => <ModalDemo />,
  calendarDay: () => <DaySheetDemo />,
  select: () => <SelectDemo />,
};

// Το κέλυφος, όπως ακριβώς το γράφει το app/dashboard/page.tsx.
//
// ΚΑΙ Η ΜΠΑΡΑ ΜΕΣΑ, ΓΙΑΤΙ ΕΚΕΙ ΗΤΑΝ ΤΟ ΣΦΑΛΜΑ. Ο πάγκος έστηνε μόνο
// «.app-shell > .app-main > .app-content», οπότε η μπάρα δεν αποδιδόταν ποτέ
// και κανένας έλεγχος δεν την είδε. Ο χρήστης την είδε: με δεύτερη γραμμή
// (κατοικία, τετραγωνικά, διεύθυνση) το περιεχόμενό της ξεχείλιζε κάτω από το
// καρφωμένο ύψος των 64 και το κυλιόμενο περιεχόμενο περνούσε από κάτω του.
// Οι δύο γραμμές γράφονται εδώ με το ΙΔΙΟ σχήμα που γράφει η σελίδα.
// ═══════════════════════════════════════════════════════════════════════════
// Η ΜΠΑΡΑ ΕΙΝΑΙ Η ΠΡΑΓΜΑΤΙΚΗ ΜΠΑΡΑ, ΟΧΙ ΣΚΙΤΣΟ ΤΗΣ
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΗΤΑΝ ΚΑΙ ΤΙ ΚΟΣΤΙΣΕ. Η μπάρα γραφόταν εδώ ως ωμό `innerHTML`, με ένα
// `<button style="font-size:16px;font-weight:700">` στη θέση του επιλογέα
// ακινήτου. Το πραγματικό `PropertySwitcher` όμως φοράει την κλάση
// `.topbar-switch-name`, που έχει `white-space: nowrap` και αποσιωπητικά.
//
// Αποτέλεσμα: στα 360 ο πάγκος έδειχνε έναν μακρύ τίτλο διαμερίσματος με
// διεύθυνση, όροφο και περιοχή σπασμένο σε ΠΕΝΤΕ σειρές και τη
// μπάρα να πιάνει 420 από τα 800 εικονοστοιχεία της οθόνης. Στην εφαρμογή ο
// ίδιος τίτλος κόβεται σε ΜΙΑ σειρά. Ο πάγκος δεν έδειχνε σφάλμα του προϊόντος·
// έδειχνε σφάλμα του πάγκου· θα με είχε στείλει να «διορθώσω» κάτι που
// δούλευε.
//
// ΤΩΡΑ Η ΜΠΑΡΑ ΑΠΟΔΙΔΕΤΑΙ ΜΕ REACT, ΜΕ ΤΟ ΙΔΙΟ COMPONENT. Οτι αλλάζει στο
// PropertySwitcher αλλάζει και εδώ, χωρίς να το θυμηθεί κανείς.
// Οι διευθύνσεις είναι προφανώς πλασματικές, όπως κάθε παράδειγμα του έργου·
// το μήκος του πρώτου τίτλου μένει, γιατί αυτό δοκιμάζει την αποκοπή.
const BENCH_PROPS = [
  { id: 'p0', name: 'Διαμέρισμα Οδός Παραδείγματος 12, τρίτος όροφος, κέντρο Αθήνας', status: 'Βραχυχρόνια μίσθωση', address: 'Οδός Παραδείγματος 12, Αθήνα' },
  { id: 'p1', name: 'Στούντιο στο κέντρο', status: 'Μακροχρόνια μίσθωση', address: 'Οδός Παραδείγματος 14, Αθήνα' },
];

function BenchTopbar() {
  const [id, setId] = useState('p0');
  return (
    <header className="app-topbar">
      <button className="nav-toggle" aria-label="Μενού">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
      </button>
      <div className="topbar-main">
        <div className="topbar-row">
          <PropertySwitcher items={BENCH_PROPS} activeId={id} onSelect={setId} onAdd={() => {}} canAdd />
          <div className="topbar-status-wrap" style={{ position: 'relative', minWidth: 0 }}>
            <button className="topbar-status" style={{ display: 'flex', alignItems: 'center', gap: 7, minHeight: T.h.sm, padding: '0 10px 0 12px', borderRadius: 8, border: '1px solid var(--border-default)', background: 'transparent', cursor: 'pointer', fontFamily: T.font.sans, fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
              <span className="topbar-status-label">Βραχυχρόνια μίσθωση</span>
              <svg aria-hidden="true" width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.65, marginLeft: 1, flexShrink: 0 }}><path d="m6 9 6 6 6-6" /></svg>
            </button>
          </div>
        </div>
        {/* Η ΔΕΥΤΕΡΗ ΣΕΙΡΑ («Κατοικία · 42 τ.μ. · διεύθυνση») ΕΦΥΓΕ ΚΑΙ ΑΠΟ ΕΔΩ.
            Η σελίδα τη σβήνει εδώ και καιρό· ο πάγκος την κρατούσε, οπότε κάθε
            μέτρηση έβλεπε μπάρα 151 αντί για 113 και μια διεύθυνση που έσπαγε
            «Οδός Παραδείγματος / 12» σε στοιχείο που η εφαρμογή δεν έχει. */}
      </div>
      {/* ΑΝΤΙΓΡΑΦΟ ΤΟΥ ΠΡΑΓΜΑΤΙΚΟΥ ΚΟΥΜΠΙΟΥ, ΟΧΙ ΔΙΚΗ ΜΟΥ ΕΚΔΟΧΗ. Ηταν πλατιά
          πιλούλα με τη λέξη «Αναζήτηση» μέσα, δηλαδή 200 από τα 360 της μπάρας:
          ο πάγκος έδειχνε το όνομα του ακινήτου κομμένο στα 124 και το πρόβλημα
          ΔΕΝ ΥΠΗΡΧΕ στην εφαρμογή, όπου η λέξη δεν γράφεται ποτέ και το κουμπί
          είναι φακός με τη συντόμευση δίπλα, κρυμμένη σε κινητό. Ενας πάγκος
          που γράφει δικό του σήμα μετράει τον εαυτό του. */}
      <button aria-label="Αναζήτηση" className="topbar-search" style={{ display: 'flex', alignItems: 'center', gap: 8, height: T.h.md, padding: '0 10px 0 12px', borderRadius: T.radius.modal, border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0 }}>
        <svg aria-hidden="true" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
        <span className="desktop-only" style={{ fontSize: 11, fontFamily: T.font.mono, color: 'var(--text-tertiary)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '1px 5px' }}>Ctrl K</span>
      </button>
    </header>
  );
}

const shell = document.createElement('div');
shell.className = 'app-shell';
shell.innerHTML = '<main class="app-main"><div class="bench-topbar"></div><div class="app-content"></div></main>';
document.body.appendChild(shell);
createRoot(shell.querySelector('.bench-topbar') as HTMLElement).render(<BenchTopbar />);
const host = shell.querySelector('.app-content') as HTMLElement;

// ═══ ΑΓΝΩΣΤΗ ΣΚΗΝΗ: ΦΩΝΑΖΕΙ, ΔΕΝ ΓΥΡΝΑΕΙ ΣΙΩΠΗΛΑ ΣΤΟ ΧΑΡΤΟΦΥΛΑΚΙΟ ═══════════
//
// Εγραφε `VIEWS[which] || VIEWS.portfolio`. Μια σκηνή γραμμένη λάθος στον
// σαρωτή, ή γραμμένη εκεί πριν προστεθεί εδώ, απέδιδε ΤΟ ΧΑΡΤΟΦΥΛΑΚΙΟ: ο
// σαρωτής μετρούσε την ίδια οθόνη ξανά και ξανά και έβγαινε πράσινος για
// καρτέλες που δεν είχε ανοίξει ποτέ. Το ίδιο αρχείο κρατάει ήδη σημείωση για
// σκηνή που έβγαινε ΚΕΝΗ και έδινε «πράσινο» επειδή σε κενή σελίδα δεν υπάρχει
// τίποτα κομμένο. Η σιωπηλή επιστροφή είναι η ίδια παγίδα με άλλο ρούχο.
const View: () => React.ReactElement = VIEWS[which] || (() => (
  <div data-bench-unknown={which} style={{ padding: 24, fontFamily: T.font.sans, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
    ΑΓΝΩΣΤΗ ΣΚΗΝΗ «{which}». Πρόσθεσέ την στο VIEWS του scripts/perf-bench/mobile.tsx.
  </div>
));
window.__t.start = performance.now();
const withNoa = params.get('noa') === '1';
// Ο ΣΤΟΙΧΕΙΟΘΕΤΗΣ ΤΗΣ ΕΦΑΡΜΟΓΗΣ ΜΠΑΙΝΕΙ ΚΑΙ ΕΔΩ, όπως στο app/dashboard/page.tsx:
// αλλιώς οι σαρωτές θα μετρούσαν κείμενο που ο χρήστης δεν βλέπει ποτέ έτσι.
// Και ο υποδοχέας επιβεβαίωσης, όπως στο app/layout.tsx: χωρίς αυτόν το «Να
// φύγουν οι αλλαγές;» του οδηγού (19/10/2026) δεν θα εμφανιζόταν ποτέ εδώ.
createRoot(host).render(withNoa
  ? <><Typesetter /><JustifyPolish /><View /><ConfirmHost /><PropertyAssistant propertyId="p1" userId="u1" propContext={{ name: 'Ακίνητο 2' }} onNavigate={() => {}} onScan={() => {}} assistantLocked={params.get('locked') === '1'} /></>
  : <><Typesetter /><JustifyPolish /><View /><ConfirmHost /></>);
requestAnimationFrame(() => { window.__t.firstPaint = performance.now(); });
