// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΣΚΗΝΕΣ ΤΟΥ myDATA ΓΙΑ ΤΟΝ ΠΑΓΚΟ: ΚΑΘΕ ΟΨΗ, ΟΧΙ ΜΟΝΟ Η ΚΑΛΗ
// ─────────────────────────────────────────────────────────────────────────
// Η κάρτα του λογιστή (app/accountant/workspace/MydataCard.tsx) σε έξι όψεις
// (και «θέλει δεύτερο βήμα»· `mydataNone` είναι η ρύθμιση άρθρου 26 πριν από
// την πρώτη άντληση, Ε-1), η γραμμή του πελάτη στον Λογαριασμό
// (MydataConsent.tsx) σε πέντε (και με το πλήρες κείμενο της συναίνεσης και με
// δύο λογιστές) και τα Εισερχόμενα «Από το myDATA» (MydataInbox.tsx): για
// έλεγχο (νέος ή ανεπιβεβαίωτος πάροχος, άγνωστος, πιστωτικό, «Πώς
// πληρώθηκε;», «Είναι η ίδια με …;»), καταχωρήθηκαν αυτόματα, δύο ακίνητα,
// ακύρωση με «Θέλει έλεγχο». Οι σαρωτές διάταξης, κάθετου
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
import { PROVIDERS } from '@/lib/mydata/providers';
import { MYDATA_JOINT_VERSION } from '@/lib/legal/mydataJoint';
import { PLANS } from '@/lib/billing/plans';
import { FEATURE_MIN_PLAN } from '@/lib/billing/entitlements';

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
  mydataRejected: { status: 'active', last_sync_at: SYNCED, last_sync_new: 4, last_error_code: 'auth', lease_id: null, lease_at: null, last_manual_at: null, joint_version: MYDATA_JOINT_VERSION, joint_at: '2026-11-24T08:00:00Z', last_partial: false },
  mydataSyncing: { status: 'active', last_sync_at: SYNCED, last_sync_new: 12, last_error_code: null, lease_id: 'l1', lease_at: LEASE, last_manual_at: LEASE, joint_version: MYDATA_JOINT_VERSION, joint_at: '2026-11-24T08:00:00Z', last_partial: false },
  mydataReady: { status: 'active', last_sync_at: new Date(Date.now() - 3600_000).toISOString(), last_sync_new: 148, last_error_code: null, lease_id: null, lease_at: null, last_manual_at: null, joint_version: MYDATA_JOINT_VERSION, joint_at: '2026-11-24T08:00:00Z', last_partial: false },
  mydataDown: { status: 'active', last_sync_at: new Date(Date.now() - 3600_000).toISOString(), last_sync_new: 0, last_error_code: null, lease_id: null, lease_at: null, last_manual_at: null, joint_version: MYDATA_JOINT_VERSION, joint_at: '2026-11-24T08:00:00Z', last_partial: false },
};

const CONSENT: Record<string, Row | null> = {
  mydataConsentNone: null,
  mydataConsentPlan: null,
  mydataConsent: { accountantId: 'a1', windowFrom: '2025-01-01', grantedAt: '2026-11-20T09:00:00Z', status: 'ok', lastSyncAt: SYNCED, lastNew: 12, error: null, nextRetryAt: null },
  mydataConsentDenied: { accountantId: 'a1', windowFrom: '2026-01-01', grantedAt: '2026-11-20T09:00:00Z', status: 'forbidden', lastSyncAt: '2026-11-22T01:10:00Z', lastNew: 0, error: 'forbidden', nextRetryAt: null },
  mydataConsentPaused: { accountantId: 'a1', windowFrom: '2025-01-01', grantedAt: '2026-05-20T09:00:00Z', status: 'paused', lastSyncAt: '2026-11-16T01:10:00Z', lastNew: 2, error: null, nextRetryAt: null },
  mydataConsentTwo: { accountantId: 'a1', windowFrom: '2025-01-01', grantedAt: '2026-11-20T09:00:00Z', status: 'ok', lastSyncAt: SYNCED, lastNew: 12, error: null, nextRetryAt: null },
};

const LOG = [
  { at: SYNCED, action: 'sync_fetch', n: 12 },
  { at: '2026-11-22T01:10:00Z', action: 'sync_fetch', n: 3 },
  { at: '2026-11-20T09:00:00Z', action: 'consent_granted', n: null },
];

// Α2: τα επίπεδα. Οι πάροχοι του μητρώου (lib/mydata/providers.ts) φαίνονται με
// το όνομά τους· ο άγνωστος με την επωνυμία του, ή «ΑΦΜ …» όταν δεν τη στέλνει.
const POWER = PROVIDERS.find(p => p.afm === '090000045')!;
const WATER = PROVIDERS.find(p => p.afm === '094079101')!;
const PHONE = PROVIDERS.find(p => p.afm === '094019245')!;
const DOCS = [
  { id: 'd1', mark: 400001000000101, counterpart_afm: POWER.afm, counterpart_name: null, doc_type: '2.1', issue_date: '2026-11-02', title: 'Τιμολόγιο Παροχής Υπηρεσιών Α 101', net_cents: 10000, vat_cents: 2400, gross_cents: 12400, is_credit: false,
    tier: 'review', category: 'electricity', review_reasons: ['new_provider', 'provider_unchecked'] },
  { id: 'd2', mark: 400001000000102, counterpart_afm: '099000049', counterpart_name: 'Υδραυλικές Εργασίες Παραδείγματος', doc_type: '1.1', issue_date: '2026-11-15', title: 'Τιμολόγιο Πώλησης ΤΠΥ 7', net_cents: 7137, vat_cents: 1713, gross_cents: 8850, is_credit: false,
    tier: 'review', category: 'plumber', review_reasons: ['unknown_provider'], fetched_at: new Date(Date.now() - 80 * 86_400_000).toISOString() },
  { id: 'd3', mark: 400001000000110, counterpart_afm: POWER.afm, counterpart_name: null, doc_type: '5.1', issue_date: '2026-11-20', title: 'Πιστωτικό Τιμολόγιο ΠΙΣ 3', net_cents: 1000, vat_cents: 240, gross_cents: 1240, is_credit: true,
    tier: 'review', category: 'electricity', review_reasons: ['credit', 'doc_type'] },
  { id: 'd4', mark: 400001000000120, counterpart_afm: WATER.afm, counterpart_name: null, doc_type: '11.2', issue_date: '2026-10-28', title: 'Απόδειξη Παροχής Υπηρεσιών Β 55', net_cents: 123450, vat_cents: 0, gross_cents: 123450, is_credit: false,
    tier: 'review', category: 'water', review_reasons: ['over_limit'] },
  { id: 'd5', mark: 400001000000121, counterpart_afm: '099000061', counterpart_name: null, doc_type: '11.1', issue_date: '2026-11-21', title: 'Απόδειξη Λιανικής Γ 9', net_cents: 2016, vat_cents: 484, gross_cents: 2500, is_credit: false,
    tier: 'review', category: null, review_reasons: ['new_provider', 'unknown_provider'] },
];

const AUTO = [
  { id: 'u1', mark: 400001000000090, counterpart_afm: POWER.afm, counterpart_name: null, doc_type: '2.1', issue_date: '2026-10-02', title: 'Τιμολόγιο Παροχής Υπηρεσιών Α 90', net_cents: 7137, vat_cents: 1713, gross_cents: 8850, is_credit: false, tier: 'auto', category: 'electricity', review_reasons: [] },
  { id: 'u2', mark: 400001000000091, counterpart_afm: WATER.afm, counterpart_name: null, doc_type: '11.2', issue_date: '2026-10-05', title: 'Απόδειξη Παροχής Υπηρεσιών Β 41', net_cents: 3120, vat_cents: 0, gross_cents: 3120, is_credit: false, tier: 'auto', category: 'water', review_reasons: [] },
  { id: 'u3', mark: 400001000000092, counterpart_afm: PHONE.afm, counterpart_name: null, doc_type: '2.1', issue_date: '2026-10-10', title: 'Τιμολόγιο Παροχής Υπηρεσιών Τ 7', net_cents: 2419, vat_cents: 581, gross_cents: 3000, is_credit: false, tier: 'auto', category: 'internet', review_reasons: [] },
];

const ATTENTION = [
  { id: 'a1', mark: 400001000000090, counterpart_afm: '099000049', counterpart_name: 'Υδραυλικές Εργασίες Παραδείγματος', doc_type: '2.1', issue_date: '2026-10-30', title: 'Τιμολόγιο Παροχής Υπηρεσιών Γ 12', net_cents: 7137, vat_cents: 1713, gross_cents: 8850, is_credit: false, needs_attention: 'cancelled_after_filing' },
  // Θωράκιση: δεμένο με δαπάνη που πέρασε ο ίδιος, ο εκδότης το ακύρωσε.
  { id: 'a2', mark: 400001000000093, counterpart_afm: WATER.afm, counterpart_name: null, doc_type: '11.2', issue_date: '2026-10-12', title: 'Απόδειξη Παροχής Υπηρεσιών Β 38', net_cents: 3120, vat_cents: 0, gross_cents: 3120, is_credit: false, needs_attention: 'cancelled_linked' },
];

// Θωράκιση: η κάρτα με το «Πώς πληρώθηκε;» (καθαρή αξία πάνω από το όριο) και
// με δαπάνη που ο χρήστης έχει ήδη περάσει («Είναι η ίδια με …;»).
const PAY_DOCS = [DOCS[3], DOCS[0], DOCS[1]];
const TWIN = { expenseId: 'e9', description: 'Λογαριασμός νερού', amount: 1234.5, date: '2026-11-06', vendor: 'ΕΥΔΑΠ' };

/** Οι γραμμές των πινάκων myDATA ανά σκηνή. */
export function mydataRespond(which: string, table: string, filters: Array<[string, string, unknown]> = []): { data: unknown; error: null } | undefined {
  if (!which.startsWith('mydata')) return undefined;
  if (table === 'mydata_connections') return { data: CONNECTION[which] ?? null, error: null };
  if (table === 'mydata_access_log') return { data: which === 'mydataConsentNone' ? [] : LOG, error: null };
  // Η ακύρωση αφού καταχωρήθηκε: δική της σκηνή, χωρίς εκκρεμή από κάτω.
  if (table === 'mydata_docs' && filters.some(f => f[1] === 'needs_attention')) return { data: which === 'mydataInboxCancelled' ? ATTENTION : [], error: null };
  // Α2: ό,τι μπήκε μόνο του και το πλήθος όσων δεν αφορούσαν ακίνητα.
  if (table === 'mydata_docs' && filters.some(f => f[1] === 'filed_by')) return { data: which === 'mydataInbox' || which === 'mydataInboxAuto' ? AUTO : [], error: null };
  if (table === 'mydata_consents') return { data: which.startsWith('mydataInbox') ? { not_property: 4 } : null, error: null };
  if (table === 'mydata_docs') return { data: which === 'mydataInbox' || which === 'mydataInboxTwo' ? DOCS : which === 'mydataInboxPay' ? PAY_DOCS : [], error: null };
  return undefined;
}

/**
 * Οι συναρτήσεις της βάσης για τις σκηνές myDATA. Με `&mydata=1` απαντούν και
 * στις πλήρεις οθόνες (χώρος λογιστή, Λογαριασμός), για στιγμιότυπα με τη
 * σημαία ανοιχτή· χωρίς αυτό οι σκηνές τους μένουν ίδιες ως το byte.
 */
const WHOLE = typeof location !== 'undefined' && new URLSearchParams(location.search).get('mydata') === '1';
export function mydataRpc(which: string, fn: string): { data: unknown; error: { code: string; message: string } | null } | undefined {
  if (WHOLE && !which.startsWith('mydata') && (fn === 'my_accountants' || fn === 'mydata_my_consent')) return mydataRpc('mydataConsent', fn);
  if (!which.startsWith('mydata')) return undefined;
  // Θωράκιση: ο λογιστής χωρίς δεύτερο βήμα. Η βάση απαντά `mfa_required`.
  if (which === 'mydataSecondStep' && fn === 'mydata_clients_status') return { data: null, error: { code: '42501', message: 'mfa_required' } };
  const answers: Record<string, unknown> = {
    mydata_clients_status: CLIENTS[which] ?? [],
    mydata_my_consent: CONSENT[which] ?? null,
    my_accountants: which === 'mydataConsentTwo'
      ? [{ accountantId: 'a1', name: 'Λογιστικό Γραφείο Υπόδειγμα', linkedAt: '2026-10-01T09:00:00Z' }, { accountantId: 'a2', name: 'Φοροτεχνικό Γραφείο Παράδειγμα', linkedAt: '2026-11-01T09:00:00Z' }]
      : [{ accountantId: 'a1', name: 'Λογιστικό Γραφείο Υπόδειγμα', linkedAt: '2026-10-01T09:00:00Z' }],
    mydata_doc_match: which === 'mydataInboxPay' ? TWIN : null,
  };
  return fn in answers ? { data: answers[fn], error: null } : undefined;
}

const supabase = createClient();
const portal = (node: React.ReactNode) => <div style={{ ...portalWrap, paddingTop: 24, paddingBottom: 48 }}>{node}</div>;
const card = () => portal(<MydataCard db={supabase} userId="u1" />);
const consent = () => <Card><SetList><MydataConsent userId="u1" allowed /></SetList></Card>;
// Πακέτο χωρίς τη Σύνδεση myDATA (από το «Ιδιοκτήτης+», 24/11/2026). Ο πάγκος
// δεν έχει διακομιστή, οπότε το app/api/billing/words απαντά εδώ. Το
// `lib/legal/billingWords.ts` δεν χτίζεται για τον περιηγητή (τραβά node:crypto
// μέσω του merchant): η πρόταση στήνεται από τα ίδια PLANS και
// FEATURE_MIN_PLAN με το `MYDATA_ACCESS`, αλλιώς η σκηνή μένει χωρίς αυτήν.
function wordsStub() {
  if (typeof window === 'undefined' || (window as { __mydataWords?: boolean }).__mydataWords) return;
  (window as { __mydataWords?: boolean }).__mydataWords = true;
  const orig = window.fetch.bind(window);
  window.fetch = async (url, init) => (String(url).includes('/api/billing/words')
    ? new Response(JSON.stringify({ live: false, afterTrialShort: '', partnerTarget: null, mydataAccess: `Η Σύνδεση myDATA περιλαμβάνεται από το πακέτο «${PLANS[FEATURE_MIN_PLAN.mydata_sync].name}» και πάνω.` }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    : orig(url, init));
}
const consentLocked = () => { wordsStub(); return <Card><SetList><MydataConsent userId="u1" /></SetList></Card>; };

export const MYDATA_VIEWS: Record<string, () => React.ReactElement> = {
  mydataNone: card,
  mydataRejected: card,
  mydataSyncing: card,
  mydataReady: card,
  mydataDown: card,
  // Στην εφαρμογή το κουμπί ανοίγει το «Δεύτερο βήμα» του χώρου (SecondStep.tsx).
  mydataSecondStep: () => portal(<MydataCard db={supabase} userId="u1" onSecondStep={() => undefined} />),
  mydataConsentNone: consent,
  mydataConsent: consent,
  mydataConsentDenied: consent,
  mydataConsentPaused: consent,
  // Θωράκιση: με δύο λογιστές φαίνεται η «Αλλαγή λογιστή».
  mydataConsentTwo: consent,
  mydataConsentPlan: consentLocked,
  mydataInboxCancelled: () => <MydataInbox propertyId="p0" userId="u1" />,
  mydataInbox: () => <MydataInbox propertyId="p0" userId="u1" />,
  // Α2: δύο ακίνητα, άρα και επιλογή ακινήτου στην κάρτα.
  mydataInboxTwo: () => <MydataInbox propertyId="p0" userId="u1" properties={[{ id: 'p0', name: 'Διαμέρισμα Παραδείγματος' }, { id: 'p1', name: 'Στούντιο στο κέντρο' }]} />,
  // Α2: όλα μπήκαν μόνα τους· τίποτα για έλεγχο.
  mydataInboxAuto: () => <MydataInbox propertyId="p0" userId="u1" />,
  // Θωράκιση: «Πώς πληρώθηκε;» και «Είναι η ίδια με …;» στην ανοιχτή κάρτα.
  mydataInboxPay: () => <MydataInbox propertyId="p0" userId="u1" />,
};
