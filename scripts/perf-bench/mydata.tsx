// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΣΚΗΝΕΣ ΤΟΥ myDATA ΓΙΑ ΤΟΝ ΠΑΓΚΟ: ΚΑΘΕ ΟΨΗ, ΟΧΙ ΜΟΝΟ Η ΚΑΛΗ
// ─────────────────────────────────────────────────────────────────────────
// Η κάρτα του λογιστή (app/accountant/workspace/MydataCard.tsx) σε πέντε όψεις,
// η γραμμή του πελάτη στον Λογαριασμό (MydataConsent.tsx) σε τρεις και τα
// Εισερχόμενα «Από το myDATA» (MydataInbox.tsx). Οι σαρωτές διάταξης, κάθετου
// ρυθμού και Νόας τις περνούν όπως κάθε άλλη σκηνή (scripts/lib/scenes.mjs).
//
// Τα ονόματα είναι πλασματικά, όπως σε κάθε σκηνή του πάγκου. Οι ώρες της
// κάρτας είναι σταθερές, εκτός από τη μίσθωση της όψης «σε εξέλιξη», που
// πρέπει να είναι πρόσφατη για να διαβαστεί ως ζωντανή.
// ═══════════════════════════════════════════════════════════════════════════
import type React from 'react';
import MydataCard from '@/app/accountant/workspace/MydataCard';
import MydataConsent from '@/app/dashboard/components/MydataConsent';
import MydataInbox from '@/app/dashboard/components/MydataInbox';
import { SetList } from '@/app/dashboard/components/SettingsKit';
import { Card } from '@/components/Theme';
import { portalWrap } from '@/app/accountant/Chrome';
import { createClient } from '@/lib/supabase/client';

const SYNCED = '2026-11-23T01:10:00Z';
const LEASE = new Date(Date.now() - 60_000).toISOString();
const SURNAMES = ['Παπαδόπουλος', 'Γεωργίου', 'Νικολάου', 'Οικονόμου', 'Δημητρίου', 'Αλεξίου', 'Κωνσταντίνου', 'Ιωάννου', 'Μιχαήλ', 'Αθανασίου'];
const NAMES = ['Μαρία', 'Γιώργος', 'Ελένη', 'Νίκος', 'Κατερίνα', 'Δημήτρης', 'Σοφία', 'Κώστας', 'Άννα', 'Παναγιώτης'];

type Row = Record<string, unknown>;
const client = (i: number, p: Row): Row => ({
  ownerId: `o${i}`, name: `${SURNAMES[i % 10]} ${NAMES[(i * 3) % 10]}${i >= 10 ? ` ${Math.floor(i / 10)}` : ''}`,
  consent: true, status: 'ok', lastSyncAt: SYNCED, lastNew: (i * 7) % 13, error: null, nextRetryAt: null, pending: (i * 3) % 5,
  afmConfirmed: true, quarantined: 0, ...p,
});

const CLIENTS: Record<string, Row[]> = {
  mydataNone: [],
  mydataRejected: [client(0, {}), client(1, {})],
  mydataSyncing: Array.from({ length: 12 }, (_, i) => client(i, i < 2 ? { lastSyncAt: new Date(Date.now() - 30_000).toISOString(), lastNew: i ? 48 : 100 } : { lastSyncAt: SYNCED })),
  // 200 πελάτες: οι περισσότεροι εντάξει, μερικοί με άρνηση της ΑΑΔΕ, μερικοί
  // σε αναμονή νέας προσπάθειας, μερικοί χωρίς άδεια. Δοκιμάζει αναζήτηση,
  // ταξινόμηση και καρφωμένη κεφαλίδα. Και οι καταστάσεις της αξιολόγησης:
  // σε παύση, με καραντίνα, χωρίς επιβεβαιωμένο ΑΦΜ (κουμπί στη γραμμή).
  mydataReady: Array.from({ length: 200 }, (_, i) => client(i,
    i % 37 === 3 ? { status: 'forbidden', error: 'forbidden' }
    : i % 41 === 5 ? { status: 'error', error: 'server', nextRetryAt: '2026-11-23T12:05:00Z' }
    : i % 43 === 7 ? { status: 'paused' }
    : i % 47 === 11 ? { status: 'error', error: 'quarantine', quarantined: 2 }
    : i % 9 === 0 ? { consent: false, status: null, lastSyncAt: null, lastNew: 0, afmConfirmed: i % 18 === 0 }
    : {})),
  mydataDown: Array.from({ length: 6 }, (_, i) => client(i, { status: 'error', error: i % 2 ? 'rate' : 'server', nextRetryAt: i ? '2026-11-23T12:20:00Z' : '2026-11-23T12:05:00Z' })),
};

const CONNECTION: Record<string, Row | null> = {
  mydataNone: null,
  mydataRejected: { aade_user_id: 'grafeio.logistiko', has_key: true, status: 'invalid', last_sync_at: SYNCED, last_sync_new: 4, last_error_code: 'auth', lease_id: null, lease_at: null, last_manual_at: null },
  mydataSyncing: { aade_user_id: 'grafeio.logistiko', has_key: true, status: 'active', last_sync_at: SYNCED, last_sync_new: 12, last_error_code: null, lease_id: 'l1', lease_at: LEASE, last_manual_at: LEASE },
  mydataReady: { aade_user_id: 'grafeio.logistiko', has_key: true, status: 'active', last_sync_at: new Date(Date.now() - 3600_000).toISOString(), last_sync_new: 148, last_error_code: null, lease_id: null, lease_at: null, last_manual_at: null },
  mydataDown: { aade_user_id: 'grafeio.logistiko', has_key: true, status: 'active', last_sync_at: new Date(Date.now() - 3600_000).toISOString(), last_sync_new: 0, last_error_code: null, lease_id: null, lease_at: null, last_manual_at: null },
};

const CONSENT: Record<string, Row | null> = {
  mydataConsentNone: null,
  mydataConsent: { accountantId: 'a1', windowFrom: '2025-01-01', grantedAt: '2026-11-20T09:00:00Z', status: 'ok', lastSyncAt: SYNCED, lastNew: 12, error: null, nextRetryAt: null },
  mydataConsentDenied: { accountantId: 'a1', windowFrom: '2026-01-01', grantedAt: '2026-11-20T09:00:00Z', status: 'forbidden', lastSyncAt: '2026-11-22T01:10:00Z', lastNew: 0, error: 'forbidden', nextRetryAt: null },
  mydataConsentPaused: { accountantId: 'a1', windowFrom: '2025-01-01', grantedAt: '2026-05-20T09:00:00Z', status: 'paused', lastSyncAt: '2026-11-16T01:10:00Z', lastNew: 2, error: null, nextRetryAt: null },
};

const LOG = [
  { at: SYNCED, action: 'sync_fetch', n: 12 },
  { at: '2026-11-22T01:10:00Z', action: 'sync_fetch', n: 3 },
  { at: '2026-11-20T09:00:00Z', action: 'consent_granted', n: null },
];

const DOCS = [
  { id: 'd1', mark: 400001000000101, counterpart_afm: '099000037', counterpart_name: 'Ηλεκτρική Ενέργεια & Δίκτυα Α.Ε.', doc_type: '2.1', issue_date: '2026-11-02', title: 'Τιμολόγιο Παροχής Υπηρεσιών Α 101', net_cents: 10000, vat_cents: 2400, gross_cents: 12400, is_credit: false },
  { id: 'd2', mark: 400001000000102, counterpart_afm: '099000049', counterpart_name: null, doc_type: '1.1', issue_date: '2026-11-15', title: 'Τιμολόγιο Πώλησης ΤΠΥ 7', net_cents: 7137, vat_cents: 1713, gross_cents: 8850, is_credit: false },
  { id: 'd3', mark: 400001000000110, counterpart_afm: '099000037', counterpart_name: 'Ηλεκτρική Ενέργεια & Δίκτυα Α.Ε.', doc_type: '5.1', issue_date: '2026-11-20', title: 'Πιστωτικό Τιμολόγιο ΠΙΣ 3', net_cents: 1000, vat_cents: 240, gross_cents: 1240, is_credit: true },
  { id: 'd4', mark: 400001000000120, counterpart_afm: '990000014', counterpart_name: 'Ύδρευση Δήμου Παραδείγματος', doc_type: '11.2', issue_date: '2026-10-28', title: 'Απόδειξη Παροχής Υπηρεσιών Β 55', net_cents: 123450, vat_cents: 0, gross_cents: 123450, is_credit: false },
];

const ATTENTION = [
  { id: 'a1', mark: 400001000000090, counterpart_afm: '099000049', counterpart_name: 'Υδραυλικές Εργασίες Παραδείγματος', doc_type: '2.1', issue_date: '2026-10-30', title: 'Τιμολόγιο Παροχής Υπηρεσιών Γ 12', net_cents: 7137, vat_cents: 1713, gross_cents: 8850, is_credit: false },
];

/** Οι γραμμές των πινάκων myDATA ανά σκηνή. */
export function mydataRespond(which: string, table: string, filters: Array<[string, string, unknown]> = []): { data: unknown; error: null } | undefined {
  if (!which.startsWith('mydata')) return undefined;
  if (table === 'mydata_connections') return { data: CONNECTION[which] ?? null, error: null };
  if (table === 'mydata_access_log') return { data: which === 'mydataConsentNone' ? [] : LOG, error: null };
  // Η ακύρωση αφού καταχωρήθηκε: δική της σκηνή, χωρίς εκκρεμή από κάτω.
  if (table === 'mydata_docs' && filters.some(f => f[1] === 'needs_attention')) return { data: which === 'mydataInboxCancelled' ? ATTENTION : [], error: null };
  if (table === 'mydata_docs') return { data: which === 'mydataInbox' ? DOCS : [], error: null };
  return undefined;
}

/**
 * Οι συναρτήσεις της βάσης για τις σκηνές myDATA. Με `&mydata=1` απαντούν και
 * στις πλήρεις οθόνες (χώρος λογιστή, Λογαριασμός), για στιγμιότυπα με τη
 * σημαία ανοιχτή· χωρίς αυτό οι σκηνές τους μένουν ίδιες ως το byte.
 */
const WHOLE = typeof location !== 'undefined' && new URLSearchParams(location.search).get('mydata') === '1';
export function mydataRpc(which: string, fn: string): { data: unknown; error: null } | undefined {
  if (WHOLE && !which.startsWith('mydata') && (fn === 'my_accountants' || fn === 'mydata_my_consent')) return mydataRpc('mydataConsent', fn);
  if (!which.startsWith('mydata')) return undefined;
  const answers: Record<string, unknown> = {
    mydata_clients_status: CLIENTS[which] ?? [],
    mydata_my_consent: CONSENT[which] ?? null,
    my_accountants: [{ accountantId: 'a1', name: 'Λογιστικό Γραφείο Υπόδειγμα', linkedAt: '2026-10-01T09:00:00Z' }],
  };
  return fn in answers ? { data: answers[fn], error: null } : undefined;
}

const supabase = createClient();
const portal = (node: React.ReactNode) => <div style={{ ...portalWrap, paddingTop: 24, paddingBottom: 48 }}>{node}</div>;
const card = () => portal(<MydataCard db={supabase} userId="u1" />);
const consent = () => <Card><SetList><MydataConsent userId="u1" /></SetList></Card>;

export const MYDATA_VIEWS: Record<string, () => React.ReactElement> = {
  mydataNone: card,
  mydataRejected: card,
  mydataSyncing: card,
  mydataReady: card,
  mydataDown: card,
  mydataConsentNone: consent,
  mydataConsent: consent,
  mydataConsentDenied: consent,
  mydataConsentPaused: consent,
  mydataInboxCancelled: () => <MydataInbox propertyId="p0" userId="u1" />,
  mydataInbox: () => <MydataInbox propertyId="p0" userId="u1" properties={[{ id: 'p0', name: 'Διαμέρισμα Παραδείγματος' }, { id: 'p1', name: 'Στούντιο στο κέντρο' }]} />,
};
