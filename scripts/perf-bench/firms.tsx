// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΣΚΗΝΕΣ ΤΩΝ ΛΟΓΙΣΤΙΚΩΝ ΓΡΑΦΕΙΩΝ ΓΙΑ ΤΟΝ ΠΑΓΚΟ
// ─────────────────────────────────────────────────────────────────────────
// Ο χώρος του γραφείου, η σελίδα των μελών, τα παράθυρα καταχώρησης και η
// πλευρά του ιδιοκτήτη, με απαντήσεις της βάσης σταθερές και ελληνικές, ώστε
// οι σαρωτές (layout, noa, align, labels, tilerow, vertical, hscroll, float,
// a11y, keyboard) να μετρούν ΓΕΜΑΤΗ οθόνη: τέσσερα μέλη, μία πρόσκληση σε
// αναμονή, πελάτες με και χωρίς ανάθεση, ιστορικό.
//
// Τα πρόσωπα είναι επινοημένα· το ΑΦΜ 000000012 είναι το δοκιμαστικό των
// fixtures (lib/myaade/myaade.test.ts).
// ═══════════════════════════════════════════════════════════════════════════
import type React from 'react';
import { useEffect } from 'react';
import FirmPage from '@/app/accountant/workspace/FirmView';
import AccountantWorkspace from '@/app/accountant/workspace/page';
import AccountantPortal from '@/app/accountant/[token]/page';
import FirmEntry, { type EntryKind } from '@/app/accountant/workspace/FirmEntry';
import { FirmAccess, FirmDaySummary } from '@/app/dashboard/components/FirmAccess';
import { SetList } from '@/app/dashboard/components/SettingsKit';
import { AccountantAccess } from '@/app/dashboard/components/TabSettings';
import { Card } from '@/components/Theme';
import { createClient } from '@/lib/supabase/client';
import { FIRM_TERMS_VERSION } from '@/lib/legal/firms';
import { athensDatePlus } from '@/lib/core/time';

const AT = '2026-09-01T09:00:00Z';
const member = (id: string, userId: string | null, email: string, role: string, name: string | null, clients: number, status = 'active') =>
  ({ id, userId, email, role, status, name, invitedAt: AT, joinedAt: status === 'active' ? AT : null, clients });

const firmOf = (role: 'manager' | 'accountant' | 'associate') => ({
  id: 'f1', name: 'Λογιστικό Γραφείο Παράδειγμα', afm: '000000012', kind: 'accounting',
  phone: '2100000000', address: 'Οδός Παραδείγματος 1, Αθήνα', role, firmOnly: true, termsVersion: FIRM_TERMS_VERSION, myTermsVersion: FIRM_TERMS_VERSION,
  members: [
    member('m1', 'u1', 'dokimi@example.com', role, 'Ελένη Παραδείγματος', 18),
    member('m2', 'u2', 'nikos@example.com', 'accountant', 'Νίκος Δοκιμής', 12),
    // ΧΩΡΙΣ ΟΝΟΜΑ ΣΤΟ ΠΡΟΦΙΛ, όπως τα περισσότερα μέλη στην παραγωγή: η βάση δίνει το email.
    member('m3', 'u3', 'maria.ypodeigmatos@example.com', 'associate', null, 5),
    member('m4', null, 'neo.melos@example.com', 'accountant', null, 0, 'invited'),
  ],
});

const HISTORY = [
  { at: '2026-11-04T10:12:00Z', action: 'open', ownerId: 'o1', member: 'Νίκος Δοκιμής', owner: 'Γιώργος Παραδείγματος' },
  { at: '2026-11-04T09:40:00Z', action: 'record', ownerId: 'o1', member: 'Νίκος Δοκιμής', owner: 'Γιώργος Παραδείγματος' },
  { at: '2026-11-03T16:05:00Z', action: 'upload', ownerId: 'o2', member: 'Ελένη Παραδείγματος', owner: 'Άννα Υποδείγματος' },
  { at: '2026-11-03T11:20:00Z', action: 'open', ownerId: 'o3', member: 'maria.ypodeigmatos@example.com', owner: 'Κώστας Δοκιμαστής' },
  { at: '2026-11-02T08:55:00Z', action: 'open', ownerId: 'o2', member: 'Ελένη Παραδείγματος', owner: 'Άννα Υποδείγματος' },
];

const client = (ownerId: string, name: string, canAct: boolean, assignees: { userId: string; name: string }[], gaps: Partial<Record<string, number>> = {}) => ({
  ownerId, name, afm: '000000012', linkedAt: AT, lastActivity: '2026-11-03T10:00:00Z',
  canAct, assignees, requests: [],
  properties: 2, expenses: 24, uncategorised: 0, noSupplierAfm: 0, rentsUnpaid: 0, stays: 0, staysNoFee: 0, openRequests: 0,
  ...gaps,
});

// ΤΑ ΣΤΟΙΧΕΙΑ ΕΠΙΚΟΙΝΩΝΙΑΣ ΔΕΝ ΤΑ ΣΤΕΛΝΕΙ ΣΗΜΕΡΑ Η ΒΑΣΗ. Η σκηνή `firmAskChannels`
// δείχνει το «Ζήτησέ το» όπως θα είναι όταν τα στείλει (lib/data/accountant.ts).
const CONTACT = { email: 'pelatis@example.com', phone: '694 000 0000' };
const CLIENTS = (canAct: boolean, contact = false) => [
  // Η ΚΑΡΤΑ ΠΟΥ ΕΙΔΕ Ο ΙΔΙΟΚΤΗΤΗΣ ΣΤΗΝ ΠΑΡΑΓΩΓΗ (09/11/2026): χωρίς προσυμπληρωμένο
  // και χωρίς φάκελο, με ένα αίτημα για τον φάκελο κι ένα για τις δαπάνες χωρίς
  // ΑΦΜ που στάλθηκε όταν ήταν 25 (τώρα 26).
  { ...client('o1', 'Γιώργος Παραδείγματος', canAct, [{ userId: 'u2', name: 'Νίκος Δοκιμής' }], { uncategorised: 3, noSupplierAfm: 26 }),
    e2: { aadeRows: 0, aadeChangedAt: null, packs: [] },
    requests: [
      { id: 'q1', item: '25 δαπάνες χωρίς ΑΦΜ προμηθευτή', note: null, createdAt: '2026-11-02T09:00:00Z' },
      { id: 'q2', item: 'Δεν έχει στείλει τον φάκελο για τον λογιστή', note: 'Τον θέλω πριν από τις 20/11.', createdAt: '2026-11-05T09:00:00Z' },
    ],
    ...(contact ? CONTACT : {}) },
  { ...client('o2', 'Άννα Υποδείγματος', canAct, [{ userId: 'u1', name: 'Ελένη Παραδείγματος' }, { userId: 'u3', name: 'maria.ypodeigmatos@example.com' }]),
    e2: { aadeRows: 14, aadeChangedAt: '2026-10-20T09:00:00Z', packs: [
      { ownerAfm: '000000012', differences: 0, checkedAt: '2026-10-21T09:00:00Z', missingCount: 0, missingTop: [], filePath: 'o2/2026/fakelos.zip', sizeBytes: 1843200, sharedAt: '2026-10-21T09:00:00Z' },
    ] } },
  client('o3', 'Κώστας Δοκιμαστής', canAct, [], { rentsUnpaid: 2 }),
];

const LEVELS = (role: string) => [
  { ownerId: 'o1', level: 'keep', mine: false, myLevel: role === 'associate' ? null : 'keep' },
  { ownerId: 'o2', level: 'upload', mine: true, myLevel: role === 'associate' ? null : 'upload' },
  { ownerId: 'o3', level: 'read', mine: false, myLevel: role === 'associate' ? null : 'read' },
];

const PROPERTIES = [
  { id: 'p0', name: 'Στούντιο Κουκάκι', hasLoan: true },
  { id: 'p1', name: 'Διαμέρισμα Παγκρατίου', hasLoan: false },
];
const OPEN_ITEMS = [
  { kind: 'bill', id: 'b1', propertyId: 'p0', property: 'Στούντιο Κουκάκι', name: 'ΔΕΗ Οκτωβρίου', amount: 84.5, due: '2026-11-10' },
  { kind: 'bill', id: 'b2', propertyId: 'p0', property: 'Στούντιο Κουκάκι', name: 'ΕΝΦΙΑ 9η δόση', amount: 70.27, due: '2026-11-30' },
  { kind: 'event', id: 'e1', propertyId: 'p0', property: 'Στούντιο Κουκάκι', name: 'Δόση δανείου', amount: 751.43, due: '2026-11-15' },
  { kind: 'rent', id: 'r1', propertyId: 'p1', property: 'Διαμέρισμα Παγκρατίου', name: '11/2026', amount: 620, due: '2026-11-05' },
];

const OWNER_FIRMS = [{
  accountantId: 'u9', name: 'Ελένη Παραδείγματος', linkedAt: AT, firmId: 'f1', firmName: 'Λογιστικό Γραφείο Παράδειγμα',
  firmKind: 'accounting', accessLevel: 'keep', lastOpenedAt: '2026-11-04T10:12:00Z',
  members: [{ userId: 'u9', name: 'Ελένη Παραδείγματος', role: 'manager' }, { userId: 'u2', name: 'Νίκος Δοκιμής', role: 'accountant' }],
}];
const FIRM_DAY = [{ firmId: 'f1', firmName: 'Λογιστικό Γραφείο Παράδειγμα', total: 4, counts: { bill: 2, event: 1, tenant: 1 } }];
// Το χθες (20261109100000): άλλο γραφείο, άλλα είδη, ώστε οι δύο μέρες να ξεχωρίζουν.
const FIRM_YESTERDAY = [
  { firmId: 'f1', firmName: 'Λογιστικό Γραφείο Παράδειγμα', total: 2, counts: { rent: 1, document: 1 } },
  { firmId: 'f2', firmName: 'Φοροτεχνικό Γραφείο Υπόδειγμα', total: 1, counts: { expense: 1 } },
];

// ΤΟ ΗΜΕΡΟΛΟΓΙΟ ΤΗΣ ΗΜΕΡΑΣ, ΟΠΩΣ ΤΟ ΚΡΑΤΑ Η ΒΑΣΗ (20261104150000): τι, ποια
// πεδία, ποιο μέλος. Οι ώρες είναι «σήμερα», όπως τις φιλτράρει η οθόνη.
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const FIRM_LOG = () => [
  { id: 'l1', kind: 'bill', action: 'insert', label: 'ΔΕΗ Οκτωβρίου', fields: null, member_name: 'Νίκος Δοκιμής', at: minutesAgo(12) },
  { id: 'l2', kind: 'bill', action: 'update', label: 'ΔΕΗ Οκτωβρίου', fields: ['amount', 'due_date'], member_name: 'Νίκος Δοκιμής', at: minutesAgo(10) },
  { id: 'l3', kind: 'event', action: 'mark_paid', label: 'ΕΝΦΙΑ 9η δόση', fields: ['status'], member_name: 'Ελένη Παραδείγματος', at: minutesAgo(8) },
  { id: 'l4', kind: 'tenant', action: 'insert', label: null, fields: null, member_name: 'Ελένη Παραδείγματος', at: minutesAgo(5) },
  { id: 'l5', kind: 'document', action: 'delete', label: null, fields: null, member_name: 'Νίκος Δοκιμής', at: minutesAgo(2) },
  // Χθες, μεσημέρι Αθήνας: η οθόνη τα δείχνει μόνο κάτω από το «Χθες».
  { id: 'l6', kind: 'rent', action: 'insert', label: '10/2026', fields: null, member_name: 'Ελένη Παραδείγματος', at: `${athensDatePlus(-1)}T10:15:00Z` },
  { id: 'l7', kind: 'document', action: 'insert', label: 'Τιμολόγιο ΔΕΗ', fields: null, member_name: 'Νίκος Δοκιμής', at: `${athensDatePlus(-1)}T09:40:00Z` },
];

/** Οι αναγνώσεις πινάκων των σκηνών του ιδιοκτήτη: ημερολόγιο και σύνδεσμος. */
export function firmRespond(which: string, table: string): { data: unknown; error: null } | undefined {
  if (!which.startsWith('firmOwner')) return undefined;
  if (table === 'firm_record_log') return { data: FIRM_LOG(), error: null };
  if (table === 'accountant_links') {
    return { data: { token: '0123456789abcdef0123456789abcdef', active: true, expires_at: '2027-05-03T09:00:00Z',
      rotated_at: '2026-11-04T09:30:00Z', rotated_reason: 'member_left' }, error: null };
  }
  return undefined;
}

/** Η απάντηση της βάσης ανά σκηνή και συνάρτηση. */
export function firmRpc(which: string, fn: string, args?: unknown): { data: unknown; error: { message: string } | null } | undefined {
  // ΜΟΝΟ ΟΙ ΣΚΗΝΕΣ ΤΟΥ ΓΡΑΦΕΙΟΥ ΕΧΟΥΝ ΓΡΑΦΕΙΟ. Αν απαντούσαμε παντού, ο φάκελος
  // λογιστή όλων των άλλων σκηνών θα έδειχνε σύνοψη γραφείου και οι σαρωτές θα
  // μετρούσαν άλλη οθόνη από εκείνη που έχει καταγράψει η βάση τους.
  if (!which.startsWith('firm')) return undefined;
  // ΜΕΛΟΣ ΓΡΑΦΕΙΟΥ ΧΩΡΙΣ ΔΕΥΤΕΡΟ ΒΗΜΑ: η βάση αρνείται με `mfa_required`.
  if ((which === 'firmSecondStep' && fn !== 'my_firm_invites') || (which === 'firmClientSecondStep' && fn === 'firm_client_data')) {
    return { data: null, error: { message: 'mfa_required' } };
  }
  // Ο ΙΔΙΟΚΤΗΤΗΣ ΑΝΑΚΑΛΕΣΕ: η βάση απαντά κενό στην επόμενη κλήση.
  if (which === 'firmClientGone' && fn === 'firm_client_data') return { data: null, error: null };
  const role = which === 'firmWorkspaceAssociate' ? 'associate' : 'manager';
  const answers: Record<string, unknown> = {
    // Ο προσκεκλημένος δεν έχει ακόμη γραφείο: η βάση κρατά ένα ενεργό γραφείο
    // ανά χρήστη (firm_members_one_active_firm), οπότε πρόσκληση σε μέλος άλλου
    // γραφείου δεν θα έφτανε ποτέ στην οθόνη του.
    my_firm: which === 'firmNew' || which === 'firmWorkspaceInvite' ? null : firmOf(role),
    my_firm_invites: which === 'firmWorkspaceInvite' ? [{ id: 'i1', firmName: 'Φοροτεχνικό Γραφείο Υπόδειγμα', role: 'accountant', invitedAt: AT }] : [],
    firm_client_levels: which === 'firmWorkspaceInvite' ? [] : LEVELS(role),
    firm_access_history: which === 'firmQuiet' ? [] : HISTORY,
    accountant_clients_overview: which === 'firmWorkspaceEmpty' ? [] : CLIENTS(role !== 'associate', which === 'firmAskChannels' || which === 'firmAskSent'),
    accountant_request_item: { ok: true },
    firm_client_properties: PROPERTIES,
    firm_open_items: OPEN_ITEMS,
    my_accountants: OWNER_FIRMS,
    owner_firm_day: (args as { p_day?: string } | undefined)?.p_day === athensDatePlus(-1) ? FIRM_YESTERDAY : FIRM_DAY,
  };
  return fn in answers ? { data: answers[fn], error: null } : undefined;
}

/** Πατά το κουμπί με αυτό το κείμενο μόλις εμφανιστεί, όπως θα το πατούσε άνθρωπος. */
function useClickWhenReady(text: string) {
  useEffect(() => {
    const t = setInterval(() => {
      const b = [...document.querySelectorAll('button')].find(x => x.textContent?.trim() === text);
      if (b) { b.click(); clearInterval(t); }
    }, 50);
    return () => clearInterval(t);
  }, [text]);
}

/**
 * «Ζήτησέ το» για την πρώτη εκκρεμότητα· με `channel`, διαλέγει κανάλι και
 * στέλνει, για να φανεί η επιβεβαίωση μετά την αποστολή.
 */
function AskOpen({ channel }: { channel?: string }) {
  useEffect(() => {
    const press = (text: string, inDialog: boolean) => {
      const b = [...document.querySelectorAll('button')].find(x => x.textContent?.trim() === text && !!x.closest('[role="dialog"]') === inDialog);
      if (b) b.click();
      return !!b;
    };
    let step = 0;
    const t = setInterval(() => {
      if (step === 0 && press('Ζήτησέ το', false)) step = channel ? 1 : 9;
      else if (step === 1 && press(channel as string, true)) step = 2;
      else if (step === 2 && press(`Στείλε με ${channel}`, true)) step = 9;
      if (step === 9) clearInterval(t);
    }, 50);
    return () => clearInterval(t);
  }, [channel]);
  return <AccountantWorkspace />;
}

/** Ο υπεύθυνος επιλέγει τον πρώτο πελάτη και ανοίγει το «Ανάθεση σε…». */
function BulkOpen() {
  useEffect(() => {
    let step = 0;
    const t = setInterval(() => {
      if (step === 0) {
        const box = document.querySelector<HTMLInputElement>('input[type="checkbox"][aria-label^="Επιλογή"]');
        if (box) { box.click(); step = 1; }
      } else {
        // Η ΛΙΣΤΑ ΑΝΟΙΓΕΙ ΜΟΝΟ ΜΕ `open=1` (στιγμιότυπα). Ο σαρωτής αντίθεσης δεν
        // συνθέτει το ημιδιάφανο φόντο της φωτισμένης επιλογής (rgba 8%) και
        // μετρά 1,1:1 για κείμενο που στην οθόνη είναι λευκό σε σκούρο.
        if (new URLSearchParams(location.search).get('open') !== '1') { clearInterval(t); return; }
        const sel = document.querySelector<HTMLElement>('[role="combobox"][aria-label="Ανάθεση σε"]');
        if (sel) { sel.click(); clearInterval(t); }
      }
    }, 50);
    return () => clearInterval(t);
  }, []);
  return <AccountantWorkspace />;
}

/** Ανοίγει το μενού «Λογαριασμός» της μπάρας. */
function AccountOpen() {
  useClickWhenReadyLabel('Λογαριασμός');
  return <AccountantWorkspace />;
}

function useClickWhenReadyLabel(label: string) {
  useEffect(() => {
    const t = setInterval(() => {
      const b = document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
      if (b) { b.click(); clearInterval(t); }
    }, 50);
    return () => clearInterval(t);
  }, [label]);
}

/** Ανοίγει το παράθυρο της πρόσκλησης όπως θα το άνοιγε ο υπεύθυνος. */
function InviteOpen() {
  useClickWhenReady('Πρόσκληση μέλους');
  return <FirmPage />;
}

/** Η πύλη του λογιστή για πελάτη από τη λίστα (αναγνωριστικό ιδιοκτήτη, όχι token). */
function ClientByOwner() {
  // Πριν από την πρώτη απόδοση: το `useParams` του πάγκου διαβάζει τη διεύθυνση.
  const u = new URL(location.href);
  if (!u.searchParams.get('token')) { u.searchParams.set('token', 'f1000000-0000-4000-8000-000000000001'); history.replaceState(null, '', u); }
  return <AccountantPortal />;
}

/** Ο ιδιοκτήτης πάτησε «Αναίρεση όλων» και βλέπει την επιβεβαίωση. */
function OwnerUndoAsk() {
  useClickWhenReady('Αναίρεση όλων');
  return <Card><FirmDaySummary /></Card>;
}

/** Ο ιδιοκτήτης πάτησε «Ανάκληση πρόσβασης» και βλέπει την επιβεβαίωση. */
function OwnerRevokeAsk() {
  useEffect(() => {
    const t = setInterval(() => {
      const b = [...document.querySelectorAll('button')].find(x => x.textContent?.trim() === 'Ανάκληση του γραφείου' && !x.closest('[role="dialog"]'));
      if (b) { b.click(); clearInterval(t); }
    }, 50);
    return () => clearInterval(t);
  }, []);
  return <Card><SetList><FirmAccess /></SetList></Card>;
}

/** Ο ιδιοκτήτης πάτησε «Δες» στη σύνοψη της ημέρας. */
function OwnerDayOpen() {
  useClickWhenReady('Δες');
  return <Card><FirmDaySummary /></Card>;
}

// ΤΟ ΠΑΡΑΘΥΡΟ ΑΝΟΙΓΕΙ ΠΑΝΩ ΑΠΟ ΤΗ ΛΙΣΤΑ ΤΩΝ ΠΕΛΑΤΩΝ, ΟΠΩΣ ΣΤΗΝ ΕΦΑΡΜΟΓΗ. Μόνο
// του, πάνω από τον πίνακα του ιδιοκτήτη, έδειχνε στο στιγμιότυπο φόντο που ο
// λογιστής δεν βλέπει ποτέ.
const entry = (kind: EntryKind) => {
  const Scene = () => <><AccountantWorkspace /><FirmEntry db={createClient()} ownerId="o1" ownerName="Γιώργος Παραδείγματος" kind={kind} onClose={() => {}} /></>;
  Scene.displayName = `FirmEntry:${kind}`;
  return Scene;
};

// ═══ ΟΙ ΣΚΗΝΕΣ ΤΗΣ ΠΥΛΗΣ ΤΟΥ ΛΟΓΙΣΤΗ ΔΕΝ ΕΧΟΥΝ ΤΟ ΠΕΡΙΓΡΑΜΜΑ ΤΟΥ ΙΔΙΟΚΤΗΤΗ ═══
// Ο πάγκος τις τύλιγε στην μπάρα ακινήτου και στην κάτω πλοήγηση του πίνακα:
// στο στιγμιότυπο φαίνονταν δύο μπάρες η μία κάτω από την άλλη και μια
// πλοήγηση που ο λογιστής δεν έχει. Ο κατάλογος ζει στο scripts/lib/scenes.mjs,
// όπου τον διαβάζουν και οι σαρωτές. Οι σκηνές του ιδιοκτήτη (firmOwner*) μένουν
// μέσα στον πίνακα, όπου ζουν.
export { PORTAL_SCENES as FIRM_PORTAL_SCENES } from '../lib/scenes.mjs';

export const FIRM_VIEWS: Record<string, () => React.ReactElement> = {
  firm: () => <FirmPage />,
  firmNew: () => <FirmPage />,
  firmInvite: () => <InviteOpen />,
  firmWorkspace: () => <AccountantWorkspace />,
  firmWorkspaceAssociate: () => <AccountantWorkspace />,
  firmWorkspaceInvite: () => <AccountantWorkspace />,
  firmWorkspaceEmpty: () => <AccountantWorkspace />,
  firmQuiet: () => <FirmPage />,
  firmAsk: () => <AskOpen />,
  firmAskChannels: () => <AskOpen />,
  firmAskSent: () => <AskOpen channel="WhatsApp" />,
  firmBulkPick: () => <BulkOpen />,
  firmAccount: () => <AccountOpen />,
  firmEntryDocument: entry('document'),
  firmEntryBill: entry('bill'),
  firmEntryTax: entry('tax'),
  firmEntryLoan: entry('loan'),
  firmEntryRent: entry('rent'),
  firmEntryTenant: entry('tenant'),
  firmSecondStep: () => <AccountantWorkspace />,
  firmOwnerDay: () => <OwnerDayOpen />,
  firmOwnerUndo: () => <OwnerUndoAsk />,
  firmOwnerRevoke: () => <OwnerRevokeAsk />,
  firmClientGone: () => <ClientByOwner />,
  firmClientSecondStep: () => <ClientByOwner />,
  firmOwnerLink: () => <Card><SetList><AccountantAccess userId="u1" /><FirmAccess /></SetList></Card>,
  firmOwner: () => (
    <div style={{ display: 'grid', gap: 16 }}>
      <Card><SetList><FirmAccess /></SetList></Card>
      <Card><FirmDaySummary /></Card>
    </div>
  ),
};
