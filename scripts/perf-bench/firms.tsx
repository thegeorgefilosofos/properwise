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
import FirmEntry, { type EntryKind } from '@/app/accountant/workspace/FirmEntry';
import { FirmAccess, FirmDaySummary } from '@/app/dashboard/components/FirmAccess';
import { SetList } from '@/app/dashboard/components/SettingsKit';
import { Card } from '@/components/Theme';
import { createClient } from '@/lib/supabase/client';

const AT = '2026-09-01T09:00:00Z';
const member = (id: string, userId: string | null, email: string, role: string, name: string | null, clients: number, status = 'active') =>
  ({ id, userId, email, role, status, name, invitedAt: AT, joinedAt: status === 'active' ? AT : null, clients });

const firmOf = (role: 'manager' | 'accountant' | 'associate') => ({
  id: 'f1', name: 'Λογιστικό Γραφείο Παράδειγμα', afm: '000000012', kind: 'accounting',
  phone: '2100000000', address: 'Οδός Παραδείγματος 1, Αθήνα', role, firmOnly: true,
  members: [
    member('m1', 'u1', 'dokimi@example.com', role, 'Ελένη Παραδείγματος', 18),
    member('m2', 'u2', 'nikos@example.com', 'accountant', 'Νίκος Δοκιμής', 12),
    member('m3', 'u3', 'maria@example.com', 'associate', 'Μαρία Υποδείγματος', 5),
    member('m4', null, 'neo.melos@example.com', 'accountant', null, 0, 'invited'),
  ],
});

const HISTORY = [
  { at: '2026-11-04T10:12:00Z', action: 'open', ownerId: 'o1', member: 'Νίκος Δοκιμής', owner: 'Γιώργος Παραδείγματος' },
  { at: '2026-11-04T09:40:00Z', action: 'record', ownerId: 'o1', member: 'Νίκος Δοκιμής', owner: 'Γιώργος Παραδείγματος' },
  { at: '2026-11-03T16:05:00Z', action: 'upload', ownerId: 'o2', member: 'Ελένη Παραδείγματος', owner: 'Άννα Υποδείγματος' },
  { at: '2026-11-03T11:20:00Z', action: 'open', ownerId: 'o3', member: 'Μαρία Υποδείγματος', owner: 'Κώστας Δοκιμαστής' },
  { at: '2026-11-02T08:55:00Z', action: 'open', ownerId: 'o2', member: 'Ελένη Παραδείγματος', owner: 'Άννα Υποδείγματος' },
];

const client = (ownerId: string, name: string, canAct: boolean, assignees: { userId: string; name: string }[], gaps: Partial<Record<string, number>> = {}) => ({
  ownerId, name, afm: '000000012', linkedAt: AT, token: `tok-${ownerId}`, lastActivity: '2026-11-03T10:00:00Z',
  canAct, assignees, requests: [],
  properties: 2, expenses: 24, uncategorised: 0, noSupplierAfm: 0, rentsUnpaid: 0, stays: 0, staysNoFee: 0, openRequests: 0,
  ...gaps,
});

const CLIENTS = (canAct: boolean) => [
  client('o1', 'Γιώργος Παραδείγματος', canAct, [{ userId: 'u2', name: 'Νίκος Δοκιμής' }], { uncategorised: 3 }),
  client('o2', 'Άννα Υποδείγματος', canAct, [{ userId: 'u1', name: 'Ελένη Παραδείγματος' }, { userId: 'u3', name: 'Μαρία Υποδείγματος' }]),
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

/** Η απάντηση της βάσης ανά σκηνή και συνάρτηση. */
export function firmRpc(which: string, fn: string): { data: unknown; error: null } | undefined {
  const role = which === 'firmWorkspaceAssociate' ? 'associate' : 'manager';
  const answers: Record<string, unknown> = {
    my_firm: which === 'firmNew' ? null : firmOf(role),
    my_firm_invites: which === 'firmWorkspaceInvite' ? [{ id: 'i1', firmName: 'Φοροτεχνικό Γραφείο Υπόδειγμα', role: 'accountant', invitedAt: AT }] : [],
    firm_client_levels: LEVELS(role),
    firm_access_history: HISTORY,
    accountant_clients_overview: CLIENTS(role !== 'associate'),
    firm_client_properties: PROPERTIES,
    firm_open_items: OPEN_ITEMS,
    my_accountants: OWNER_FIRMS,
    owner_firm_day: FIRM_DAY,
  };
  return fn in answers ? { data: answers[fn], error: null } : undefined;
}

/** Ανοίγει το παράθυρο της πρόσκλησης όπως θα το άνοιγε ο υπεύθυνος. */
function InviteOpen() {
  useEffect(() => {
    const t = setInterval(() => {
      const b = [...document.querySelectorAll('button')].find(x => x.textContent?.trim() === 'Πρόσκληση μέλους');
      if (b) { b.click(); clearInterval(t); }
    }, 50);
    return () => clearInterval(t);
  }, []);
  return <FirmPage />;
}

const entry = (kind: EntryKind) => {
  const Scene = () => <FirmEntry db={createClient()} ownerId="o1" ownerName="Γιώργος Παραδείγματος" kind={kind} onClose={() => {}} />;
  Scene.displayName = `FirmEntry:${kind}`;
  return Scene;
};

export const FIRM_VIEWS: Record<string, () => React.ReactElement> = {
  firm: () => <FirmPage />,
  firmNew: () => <FirmPage />,
  firmInvite: () => <InviteOpen />,
  firmWorkspace: () => <AccountantWorkspace />,
  firmWorkspaceAssociate: () => <AccountantWorkspace />,
  firmWorkspaceInvite: () => <AccountantWorkspace />,
  firmEntryDocument: entry('document'),
  firmEntryBill: entry('bill'),
  firmEntryTax: entry('tax'),
  firmEntryLoan: entry('loan'),
  firmEntryRent: entry('rent'),
  firmEntryTenant: entry('tenant'),
  firmOwner: () => (
    <div style={{ display: 'grid', gap: 16 }}>
      <Card><SetList><FirmAccess /></SetList></Card>
      <Card><FirmDaySummary /></Card>
    </div>
  ),
};
