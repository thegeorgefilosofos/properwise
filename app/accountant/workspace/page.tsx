'use client';
// ═══════════════════════════════════════════════════════════════════════════
// Ο ΧΩΡΟΣ ΤΟΥ ΛΟΓΙΣΤΗ: ΟΛΟΙ ΟΙ ΠΕΛΑΤΕΣ ΤΟΥ, ΣΕ ΜΙΑ ΛΙΣΤΑ
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΥΠΗΡΧΕ. Ένας σύνδεσμος ανά ιδιοκτήτη, μόνο για ανάγνωση, ένας πελάτης τη
// φορά. Ο λογιστής όμως δεν έχει έναν πελάτη, έχει ογδόντα: θα κρατούσε
// ογδόντα συνδέσμους σε σελιδοδείκτες.
//
// ΤΙ ΚΑΝΕΙ ΑΥΤΗ Η ΟΘΟΝΗ. Μία λίστα, μία στήλη που λέει τι λείπει από τον
// καθένα και ένα κουμπί που το ζητά. Ο ιδιοκτήτης το βλέπει στον πίνακά του.
// Δηλαδή το τηλεφώνημα «στείλε μου το εκκαθαριστικό» γίνεται γραμμή που
// κλείνει.
//
// ΤΙ ΔΕΝ ΔΕΙΧΝΕΙ. Ποσά. Ο λογιστής μπαίνει εδώ για να δει ΠΟΙΟΝ πρέπει να
// κυνηγήσει, όχι για να κάνει λογιστική· τη λογιστική τη διαβάζει στον φάκελο.
// Μια στήλη «έσοδα» θα γέμιζε την οθόνη με αριθμούς που δεν οδηγούν σε καμία
// ενέργεια και θα έκρυβε τον έναν αριθμό που οδηγεί.
//
// ΤΑ ΝΟΥΜΕΡΑ ΔΕΝ ΦΤΑΝΟΥΝ ΠΟΤΕ ΩΜΑ ΣΤΗΝ ΟΘΟΝΗ. Η βάση μετρά, το
// lib/data/accountant.ts κρίνει, εδώ μόνο στοιχίζεται. Ο ίδιος κανόνας για
// κάθε πελάτη, γραμμένος μία φορά και δοκιμασμένος χωριστά.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { createClient } from '@/lib/supabase/client';
import { T, TT, Card, Btn, Skeleton, Chip, EmptyState } from '@/components/Theme';
import { TextInput, CustomSelect } from '@/app/dashboard/components/UIComponents';
import { ActionMenu } from '@/components/ActionMenu';
import {
  myFirm, myFirmInvites, answerInvite, acceptFirmTerms, termsGap, clientLevels, assign, dropFirmClient, saveFirm,
  filterClients, entryKinds, canAct, canManage, reasonText, ENTRY_LABEL, ROLE_LABEL,
  type Firm, type FirmInvite, type ClientLevel, type Scope, type StatusFilter, type FirmKind,
} from '@/lib/data/firms';
import FirmEntry, { type EntryKind } from './FirmEntry';
import FirmTermsCheck, { FIRM_TERMS_NEEDED } from './FirmTerms';
import { FIRM_TERMS_VERSION } from '@/lib/legal/firms';
import FirmView from './FirmView';
import SecondStep from './SecondStep';
import RequestSheet, { type AskTarget } from './RequestSheet';
import { PortalBar, PortalTitle, portalWrap } from '../Chrome';
import { Users, Filter } from 'lucide-react';
import { claim, clients, clientData, request, withdrawRequest, dropClient, gapsOf, readinessOf, aadeStateOf, aadeStateLabel, joinRequests, type ClientCounts } from '@/lib/data/accountant';
import { fileBytes } from '@/lib/data/e2Prefilled';
import { PACK_FILES } from '@/lib/accounting/meetingPack';
import { downloadFile } from '@/lib/core/download';
import { fmtBytes } from '@/lib/core/bytes';
import { declarationYear } from '@/lib/core/declarationYear';
import { athensToday } from '@/lib/core/time';
import E2PrefilledImport, { type KnownProperty } from '@/app/dashboard/components/E2PrefilledImport';
import { loadStatements, downloadAll, downloadPacks, bundleMode, lastMove, type BulkClient, type ClientStatement, type PackRef } from '../bulk';
import { readZipEntry } from '@/lib/accounting/zip';
import BulkInvite from './BulkInvite';
import { foldName } from '@/lib/contacts/alpha';
import { notify, notifyError } from '@/components/Toast';
import { confirmDialog } from '@/components/confirmBus';
import { fe, fd } from '@/components/Theme';
import { useRememberedFlag } from '@/components/useRememberedFlag';

// ΤΑ ΤΟΥ ΓΡΑΦΕΙΟΥ ΦΟΡΤΩΝΟΝΤΑΙ ΜΟΝΟ ΣΤΟΝ ΠΕΡΙΗΓΗΤΗ. Η όψη του γραφείου ανοίγει
// από το `?view=firm` και η καταχώρηση από κλικ: ο διακομιστής δεν αποδίδει
// ποτέ κανένα από τα δύο, οπότε δεν χρειάζεται να κουβαλά τον κώδικά τους.

// Η διεύθυνση δεν αλλάζει χωρίς πλοήγηση: δεν υπάρχει τι να ακούσει η συνδρομή.
const SEARCH_NEVER_CHANGES = () => () => {};
const readView = () => new URLSearchParams(window.location.search).get('view');

/** Η προτίμηση «δείξε ποσά» ζει στον περιηγητή του λογιστή, όχι στη βάση. */
const MONEY_KEY = 'properwise.accountant.money';

/** Από πόσους πελάτες και πάνω εμφανίζεται η αναζήτηση: ένα κατέβασμα οθόνης. */
const SEARCH_FROM = 8;

/**
 * Η ΙΔΙΑ ΧΡΗΣΗ ΜΕ ΤΟΝ ΦΑΚΕΛΟ ΤΟΥ ΙΔΙΟΚΤΗΤΗ (`declarationYear`): η περσινή ως τον
 * Ιούλιο, όσο κλείνει η δήλωση, η τρέχουσα από τον Αύγουστο. Εδώ ήταν πάντα
 * «πέρυσι»: τον Οκτώβριο ο ιδιοκτήτης έβλεπε «λείπουν 3» για το 2026 και ο
 * λογιστής του «Έτοιμος» για το 2025, για τον ίδιο φάκελο.
 */
const defaultYear = () => declarationYear(athensToday());

/** Οι γραμμές κάτω από το όνομα του πελάτη. */
const metaLine: React.CSSProperties = { fontSize: 'var(--fs-note)', color: 'var(--text-tertiary)', margin: 0, lineHeight: 1.5, fontFamily: T.font.sans };

/** Μία ενότητα της κάρτας του πελάτη: ετικέτα και γραμμές, με διαχωριστικό από πάνω. */
function CardSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: T.sp.md, paddingTop: T.sp.md, borderTop: '1px solid var(--border-subtle)' }}>
      <h3 style={{ ...TT.label, color: 'var(--text-tertiary)', margin: 0 }}>{label}</h3>
      <ul className="po-item-rows" style={{ listStyle: 'none', padding: 0, margin: `${T.sp.xs}px 0 0` }}>{children}</ul>
    </section>
  );
}

/**
 * Μία γραμμή: τι, μια προαιρετική δεύτερη γραμμή (σημείωση, ημερομηνία) και
 * ΜΙΑ στήλη δεξιά για κατάσταση και κινήσεις. Ολα τα κουμπιά της κάρτας είναι
 * ίδιου ρόλου και ύψους (δευτερεύον, `Btn`)· το «Πάρ’ το πίσω» ήσυχο. Πριν
 * υπήρχαν κουμπιά με περίγραμμα, χωρίς περίγραμμα και ένα σβηστό «Ζητήθηκε»
 * που έμοιαζε χαλασμένο.
 */
function ItemRow({ text, note, children }: { text: React.ReactNode; note?: string; children?: React.ReactNode }) {
  const acts = (Array.isArray(children) ? children : [children]).some(Boolean);
  return (
    <li style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: T.sp.lg, rowGap: T.sp.xs, minHeight: T.h.md }}>
      <div style={{ minWidth: 0, flex: '1 1 240px' }}>
        <p style={{ fontSize: 'var(--fs-base)', fontFamily: T.font.sans, lineHeight: 1.5, color: 'var(--text-secondary)', margin: 0 }}>{text}</p>
        {note && <p style={{ ...metaLine, fontVariantNumeric: 'tabular-nums' }}>{note}</p>}
      </div>
      {acts && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: T.sp.sm, marginLeft: 'auto' }}>
          {children}
        </div>
      )}
    </li>
  );
}

export default function AccountantWorkspace() {
  const supabase = useMemo(() => createClient(), []);
  const view = useSyncExternalStore(SEARCH_NEVER_CHANGES, readView, () => null);
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [year, setYear] = useState(defaultYear);
  const [rows, setRows] = useState<ClientCounts[] | null>(null);
  // «Δεν διαβάστηκε» δεν είναι «δεν υπάρχουν». Δες lib/data/accountant.ts.
  const [readFailed, setReadFailed] = useState(false);
  const [token, setToken] = useState('');
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState('');
  // ── ΤΑ ΠΟΣΑ ΕΙΝΑΙ ΕΠΙΛΟΓΗ, ΟΧΙ ΠΡΟΕΠΙΛΟΓΗ ──────────────────────────────
  // Η λίστα υπάρχει για να δει ο λογιστής ΠΟΙΟΝ να κυνηγήσει· μια μόνιμη στήλη
  // αριθμών δίπλα στα κενά τραβά το μάτι από αυτά. Με ογδόντα πελάτες όμως
  // θέλει και να ξεχωρίσει τον μεγάλο από τον μικρό, οπότε τα ποσά ανοίγουν με
  // ένα πάτημα και η επιλογή του θυμάται.
  const [showMoney, setShowMoney] = useRememberedFlag(MONEY_KEY);
  // ΤΑ ΠΟΣΑ ΚΟΥΒΑΛΟΥΝ ΤΗ ΧΡΗΣΗ ΤΟΥΣ. Χωρίς αυτό χρειαζόταν ένα «σβήσε τα» σε
  // effect κάθε φορά που άλλαζε η χρονιά — δηλαδή δεύτερη απόδοση — και υπήρχε
  // στιγμή όπου ο λογιστής διάβαζε τα ποσά του 2024 κάτω από τον τίτλο του 2025.
  const [cash, setCash] = useState<{ year: number; map: Map<string, ClientStatement> } | null>(null);
  const money = cash && cash.year === year ? cash.map : null;
  const [busy, setBusy] = useState<'money' | 'zip' | 'packs' | null>(null);
  // Πόσοι φάκελοι κατέβηκαν ως τώρα στη μαζική λήψη: με ογδόντα πελάτες
  // ένα «Ετοιμάζεται…» χωρίς αριθμό μοιάζει με κόλλημα.
  const [packProgress, setPackProgress] = useState('');
  // ΜΕ ΟΓΔΟΝΤΑ ΠΕΛΑΤΕΣ, Η ΣΕΙΡΑ ΛΥΝΕΙ ΤΗ ΜΙΑ ΧΡΗΣΗ ΚΑΙ Η ΑΝΑΖΗΤΗΣΗ ΤΗΝ ΑΛΛΗ.
  // «Ποιος δεν κλείνει» το απαντά η σειρά· «θέλω τον Παπαδόπουλο τώρα» το
  // απαντούσε μόνο το Ctrl+F του περιηγητή.
  const [find, setFind] = useState('');
  // Το «Ζήτησέ το» που είναι ανοιχτό (RequestSheet.tsx): τι, από ποιον, πού.
  const [askFor, setAskFor] = useState<AskTarget | null>(null);
  // Ο συνδεδεμένος και το όνομα του λογαριασμού του, για τη γραμμή «Υπεύθυνος»
  // όταν η βάση δεν έχει όνομα στο προφίλ τιμολόγησης.
  const [me, setMe] = useState<{ id: string; name: string | null } | null>(null);
  // Το προσυμπληρωμένο που ανεβάζει ο λογιστής για λογαριασμό του πελάτη.
  const [importFor, setImportFor] = useState<{ owner: ClientCounts; known: KnownProperty[] } | null>(null);
  const [packBusy, setPackBusy] = useState('');
  // ── ΤΟ ΓΡΑΦΕΙΟ ──────────────────────────────────────────────────────────
  // Ο μεμονωμένος λογιστής είναι γραφείο ενός μέλους (20261104120000): τα
  // φίλτρα και οι αναθέσεις εμφανίζονται μόνο όταν υπάρχει δεύτερο μέλος.
  const [firm, setFirm] = useState<Firm | null>(null);
  const [invites, setInvites] = useState<FirmInvite[]>([]);
  const [levels, setLevels] = useState<Map<string, ClientLevel>>(new Map());
  const [scope, setScope] = useState<Scope>('all');
  const [assignee, setAssignee] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [assignTo, setAssignTo] = useState('');
  const [entry, setEntry] = useState<{ c: ClientCounts; kind: EntryKind } | null>(null);
  // ── ΤΟ ΔΕΥΤΕΡΟ ΒΗΜΑ ────────────────────────────────────────────────────
  // Το κρίνει η βάση (20261104150000): ενεργό μέλος γραφείου χωρίς `aal2`
  // παίρνει `mfa_required` σε κάθε κλήση. `null` όσο δεν έχει απαντήσει.
  const [secondStep, setSecondStep] = useState<boolean | null>(null);
  // ── Η ΑΠΟΔΟΧΗ ΤΩΝ ΟΡΩΝ ΕΠΕΞΕΡΓΑΣΙΑΣ (20261108090000) ────────────────────
  // Ενα τικ ανά πρόσκληση και ένα για την ανανέωση. Χωρίς αποδοχή του μέλους
  // και του γραφείου η βάση δεν δείχνει κανέναν πελάτη.
  const [inviteTerms, setInviteTerms] = useState<Record<string, boolean>>({});
  const [termsTick, setTermsTick] = useState(false);
  const [termsBusy, setTermsBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      const m = (data.user?.user_metadata ?? {}) as Record<string, unknown>;
      const n = [m.full_name, m.name].find(v => typeof v === 'string' && v.trim()) as string | undefined;
      if (data.user) setMe({ id: data.user.id, name: n?.trim() ?? null });
    });
  }, [supabase]);

  const loadFirm = useCallback(async () => {
    const [f, inv, lv] = await Promise.all([myFirm(supabase), myFirmInvites(supabase), clientLevels(supabase)]);
    if (!f.ok && f.secondStep) { setSecondStep(true); return; }
    let current = f.ok ? f.data : null;
    // Η ΕΓΓΡΑΦΗ ΩΣ ΓΡΑΦΕΙΟ ΟΛΟΚΛΗΡΩΝΕΤΑΙ ΕΔΩ. Η φόρμα της εγγραφής κρατά τα
    // στοιχεία στο προφίλ (δεν υπάρχει ακόμη συνεδρία για να γραφτεί γραφείο)·
    // η πρώτη συνδεδεμένη επίσκεψη τα κάνει γραφείο, μία φορά.
    if (f.ok && !current && inv.length === 0) {
      const { data, error } = await supabase.auth.getUser();
      // Χωρίς χρήστη δεν στήνεται γραφείο: δοκιμάζει ξανά στην επόμενη επίσκεψη.
      const m = (error ? {} : data.user?.user_metadata ?? {}) as Record<string, unknown>;
      if (m.account_kind === 'firm' && typeof m.firm_name === 'string' && m.firm_name.trim()) {
        const r = await saveFirm(supabase, {
          name: m.firm_name, afm: String(m.firm_afm ?? ''), kind: (m.firm_kind === 'tax' ? 'tax' : 'accounting') as FirmKind,
          phone: String(m.firm_phone ?? ''), address: String(m.firm_address ?? ''),
        });
        if (r.ok) {
          // ΤΟ ΤΙΚ ΤΗΣ ΕΓΓΡΑΦΗΣ ΓΙΝΕΤΑΙ ΑΠΟΔΟΧΗ ΤΟΥ ΓΡΑΦΕΙΟΥ, μόνο αν είναι η
          // έκδοση που ισχύει τώρα. Αλλιώς τη ζητά η κάρτα των όρων πιο κάτω.
          if (m.firm_terms_version === FIRM_TERMS_VERSION) await acceptFirmTerms(supabase);
          // ΤΟ ΝΕΟ ΓΡΑΦΕΙΟ ΕΧΕΙ ΗΔΗ ΕΝΕΡΓΟ ΜΕΛΟΣ: από εδώ η βάση ζητά δεύτερο βήμα.
          const again = await myFirm(supabase);
          if (!again.ok && again.secondStep) { setSecondStep(true); return; }
          current = again.ok ? again.data : null;
        }
      }
    }
    setSecondStep(false);
    setFirm(current);
    setInvites(inv);
    setLevels(new Map((lv.ok ? lv.data : []).map(l => [l.ownerId, l])));
  }, [supabase]);

  useEffect(() => {
    if (!email) return;
    let alive = true;
    // Η κλήση φεύγει από το σώμα του effect: το setState γίνεται στο then.
    Promise.resolve().then(() => { if (alive) void loadFirm(); });
    return () => { alive = false; };
  }, [email, loadFirm]);

  const load = useCallback(async (y: number) => {
    const r = await clients(supabase, y);
    if (r.secondStep) { setSecondStep(true); return; }
    setReadFailed(r.failed);
    if (!r.failed) setRows(r.rows);
  }, [supabase]);

  // ΤΟ ΑΠΟΤΕΛΕΣΜΑ ΓΡΑΦΕΤΑΙ ΜΟΝΟ ΑΝ Η ΟΘΟΝΗ ΤΟ ΠΕΡΙΜΕΝΕΙ ΑΚΟΜΗ. Χωρίς το `alive`,
  // δύο γρήγορες αλλαγές έτους αφήνουν το ΑΡΓΟΤΕΡΟ ερώτημα να απαντήσει πρώτο:
  // ο λογιστής διαλέγει 2025 και βλέπει τους πελάτες του 2024. Και η κλήση
  // φεύγει από το σώμα του effect, όπου ένα σύγχρονο setState προκαλεί
  // αλυσιδωτές αποδόσεις.
  useEffect(() => {
    if (!email) return;
    let alive = true;
    if (secondStep) return;
    clients(supabase, year).then(r => {
      if (!alive) return;
      if (r.secondStep) { setSecondStep(true); return; }
      setReadFailed(r.failed);
      if (!r.failed) setRows(r.rows);
    });
    return () => { alive = false; };
  }, [supabase, email, year, secondStep]);

  // ΑΠΟ ΤΟΝ ΣΥΝΔΕΣΜΟ, ΟΧΙ ΜΟΝΟ ΑΠΟ ΤΟ TOKEN. Ο ιδιοκτήτης στέλνει ολόκληρη τη
  // διεύθυνση· το να ζητάμε από τον λογιστή να ψαλιδίσει το τελευταίο κομμάτι
  // είναι δουλειά που μπορούμε να κάνουμε εμείς.
  const addClient = async () => {
    const raw = token.trim();
    if (!raw) return;
    setAdding(true);
    const t = raw.includes('/') ? raw.replace(/[?#].*$/, '').split('/').filter(Boolean).pop() ?? raw : raw;
    const res = await claim(supabase, t);
    setAdding(false);
    if (res.ok) {
      setToken('');
      setNotice(`Προστέθηκε: ${res.owner}`);
      await load(year);
    } else {
      setNotice(res.reason === 'self'
        ? 'Αυτός ο σύνδεσμος είναι δικός σου.'
        : 'Ο σύνδεσμος δεν ισχύει. Ζήτησε καινούριο από τον ιδιοκτήτη.');
    }
  };

  // Η ΣΗΜΕΙΩΣΗ ΤΑΞΙΔΕΥΕΙ ΜΕ ΤΟ ΑΙΤΗΜΑ. Χωρίς αυτήν, το εργαλείο έλεγε στον
  // ιδιοκτήτη «λείπει δαπάνη» και τον λογιστή τον έστελνε στο τηλέφωνο για να
  // πει ποια, από πότε και γιατί τη θέλει τώρα. Το αίτημα γράφεται ΠΑΝΤΑ στην
  // εφαρμογή, όποιο κανάλι κι αν διαλέξει ο λογιστής στο παράθυρο.
  const ask = async (t: AskTarget, note: string | undefined): Promise<boolean> => {
    if (!await request(supabase, t.ownerId, t.item, note)) return false;
    await load(year);
    return true;
  };

  /** Το όνομα ενός μέλους: του προφίλ, αλλιώς του λογαριασμού μου, αλλιώς ό,τι έδωσε η βάση. */
  const memberName = (userId: string, fallback: string) =>
    firm?.members.find(m => m.userId === userId)?.name || (me && me.id === userId && me.name) || fallback;

  /** Παίρνει πίσω αίτημα που στάλθηκε κατά λάθος. */
  const unask = async (ids: string[]) => {
    const done = await Promise.all(ids.map(id => withdrawRequest(supabase, id)));
    await load(year);
    if (done.some(d => !d)) notifyError('Το αίτημα δεν αποσύρθηκε');
  };

  // ── ΤΟ ΠΡΟΣΥΜΠΛΗΡΩΜΕΝΟ ΚΑΙ Ο ΦΑΚΕΛΟΣ ──────────────────────────────────────
  // Ο φάκελος είναι αυτός που ΕΣΤΕΙΛΕ ο ιδιοκτήτης: η βάση τον δίνει μόνο όσο
  // ισχύει η σύνδεση. Ο λογιστής δεν φτιάχνει φάκελο από τα δεδομένα του πελάτη.
  const downloadPack = async (c: ClientCounts, afm: string, path: string) => {
    setPackBusy(path);
    const bytes = await fileBytes(supabase, path);
    setPackBusy('');
    if (!bytes) { notifyError('Ο φάκελος δεν κατέβηκε. Αν ο πελάτης ανακάλεσε την πρόσβαση, δεν είναι πια διαθέσιμος· αλλιώς δοκίμασε ξανά.'); return; }
    downloadFile(new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'application/zip' }), `${c.name} · ${PACK_FILES.zip(year, afm)}`, 'application/zip');
  };

  // ── ΤΟ ΦΥΛΛΟ ΚΩΔΙΚΩΝ, ΧΩΡΙΣ ΤΟΝ ΥΠΟΛΟΙΠΟ ΦΑΚΕΛΟ ───────────────────────────
  // Βγαίνει από το ίδιο zip που έστειλε ο πελάτης (`readZipEntry`): ο λογιστής
  // δεν φτιάχνει δικό του από τα δεδομένα του πελάτη. Φάκελος που στάλθηκε πριν
  // μπει το φύλλο δεν το έχει· τότε το λέμε, με το τι να κάνει.
  const downloadCodes = async (c: ClientCounts, afm: string, path: string) => {
    const k = `${path}#codes`;
    setPackBusy(k);
    const bytes = await fileBytes(supabase, path);
    setPackBusy('');
    if (!bytes) { notifyError('Ο φάκελος δεν κατέβηκε. Αν ο πελάτης ανακάλεσε την πρόσβαση, δεν είναι πια διαθέσιμος· αλλιώς δοκίμασε ξανά.'); return; }
    const sheet = readZipEntry(bytes, PACK_FILES.codes);
    if (!sheet) { notifyError('Ο φάκελος στάλθηκε πριν μπει το φύλλο κωδικών. Ζήτησε από τον πελάτη να τον ξαναστείλει.'); return; }
    downloadFile(new Blob([sheet.slice().buffer as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `${c.name} · ${PACK_FILES.codesFile(year, afm)}`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  };

  // Οι ΑΤΑΚ των ακινήτων του πελάτη, από την ίδια ανάγνωση που ανοίγει την
  // κατάστασή του, για να ξεκινά η καταχώρηση με το χέρι από αυτούς.
  const openImport = async (c: ClientCounts) => {
    // Η αποτυχία εδώ δεν γίνεται ποσό: απλώς η καταχώρηση με το χέρι ξεκινά
    // χωρίς έτοιμους ΑΤΑΚ. Και το λέμε. Ο φάκελος έρχεται με το πρόσωπο, όχι
    // με token (20261104150000).
    const got = await clientData<{ properties?: { name?: string | null; atak?: string | null }[] }>(supabase, c.ownerId, year);
    if (!got.data) notifyError('Οι ΑΤΑΚ του πελάτη δεν διαβάστηκαν· η καταχώρηση με το χέρι ξεκινά κενή.');
    const known: KnownProperty[] = (got.data?.properties ?? []).map(p => ({ atak: p.atak ?? null, name: p.name || 'Ακίνητο' }));
    setImportFor({ owner: c, known });
  };

  const removeClient = async (ownerId: string, name: string) => {
    if (!await confirmDialog({
      title: `Αφαίρεση του ${name};`,
      message: 'Φεύγει από τη λίστα σου. Δεν σβήνει τίποτα δικό του και μπορεί να ξαναμπεί με τον σύνδεσμό του.',
      confirmLabel: 'Αφαίρεση', tone: 'negative',
    })) return;
    const ok = firm && canManage(firm.role) ? (await dropFirmClient(supabase, ownerId)).ok : await dropClient(supabase, ownerId);
    if (ok) { await load(year); notify('Ο πελάτης αφαιρέθηκε'); }
    else notifyError('Ο πελάτης δεν αφαιρέθηκε');
  };

  // ── ΟΙ ΚΙΝΗΣΕΙΣ ΤΟΥ ΓΡΑΦΕΙΟΥ ────────────────────────────────────────────
  const reply = async (id: string, accept: boolean) => {
    if (accept && !inviteTerms[id]) { notifyError(FIRM_TERMS_NEEDED); return; }
    const r = await answerInvite(supabase, id, accept);
    if (!r.ok) { notifyError(reasonText(r.reason)); return; }
    // Αν η αποδοχή των όρων δεν γραφτεί, η κάρτα των όρων τη ζητά ξανά.
    if (accept) await acceptFirmTerms(supabase);
    notify(accept ? 'Μπήκες στο γραφείο.' : 'Η πρόσκληση απορρίφθηκε.');
    await Promise.all([loadFirm(), load(year)]);
  };

  const acceptTerms = async () => {
    if (!termsTick) { notifyError(FIRM_TERMS_NEEDED); return; }
    setTermsBusy(true);
    const r = await acceptFirmTerms(supabase);
    setTermsBusy(false);
    if (!r.ok) { notifyError(reasonText(r.reason)); return; }
    setTermsTick(false);
    await Promise.all([loadFirm(), load(year)]);
  };
  const gap = termsGap(firm);

  const assignPicked = async (on: boolean) => {
    if (!assignTo || picked.size === 0) return;
    const r = await assign(supabase, [...picked], assignTo, on);
    if (!r.ok) { notifyError(reasonText(r.reason)); return; }
    const n = Number(r.data?.changed ?? 0);
    notify(on ? (n === 1 ? 'Ανατέθηκε 1 πελάτης.' : `Ανατέθηκαν ${n} πελάτες.`) : (n === 1 ? 'Αφαιρέθηκε 1 ανάθεση.' : `Αφαιρέθηκαν ${n} αναθέσεις.`));
    setPicked(new Set());
    await Promise.all([load(year), loadFirm()]);
  };

  // ΟΠΟΙΟΣ ΔΕΝ ΚΛΕΙΝΕΙ, ΠΡΩΤΟΣ. Η λίστα ερχόταν αλφαβητικά και ο λογιστής με
  // ογδόντα πελάτες κατέβαινε ολόκληρη για να βρει τους τρεις που τον
  // εμποδίζουν. Μέσα στην ίδια κατηγορία μένει το αλφαβητικό της βάσης, ώστε η
  // σειρά να μην αλλάζει από φόρτωση σε φόρτωση.
  const ordered = useMemo(() => (rows ?? []).map(c => {
    const gaps = gapsOf(c);
    return { c, gaps, ready: readinessOf(gaps) };
  }).sort((a, b) => (b.ready.blocking - a.ready.blocking) || (b.gaps.length - a.gaps.length)), [rows]);

  // ΤΟ ΦΙΛΤΡΟ ΔΕΝ ΚΑΝΕΙ ΔΙΑΚΡΙΣΗ ΣΕ ΤΟΝΟ ΚΑΙ ΣΕ ΚΕΦΑΛΑΙΟ. Ο λογιστής γράφει
  // «παπαδοπουλος» βιαστικά και το ζητούμενο είναι να τον βρει, όχι να τον
  // διορθώσει. Ψάχνει και στο ΑΦΜ, που είναι ο τρόπος που τον ξέρει το σύστημά του.
  const shown = useMemo(() => {
    const q = foldName(find);
    if (!q) return ordered;
    return ordered.filter(x => foldName(x.c.name).includes(q) || (x.c.afm || '').includes(q));
  }, [ordered, find]);

  const team = !!firm && firm.members.filter(m => m.status === 'active').length > 1;
  const manager = canManage(firm?.role);
  const actor = !firm || canAct(firm.role);
  const listed = useMemo(() => {
    if (!team) return shown;
    const keyed = shown.map(x => ({ ...x, ownerId: x.c.ownerId, assignees: x.c.assignees, blocking: x.ready.blocking > 0, complete: x.gaps.length === 0 }));
    return filterClients(keyed, levels, { scope, assignee, status });
  }, [team, shown, levels, scope, assignee, status]);
  const activeMembers = firm?.members.filter(m => m.status === 'active' && m.userId) ?? [];
  // ΤΑ ΦΙΛΤΡΑ: ΟΛΑ ΣΤΗ ΣΕΙΡΑ Ή ΕΝΑ ΑΝΑ ΣΕΙΡΑ, ΠΟΤΕ ΔΥΟ ΚΑΙ ΕΝΑ ΜΟΝΟ ΤΟΥ.

  const stuck = ordered.filter(x => x.ready.blocking > 0).length;
  const done = ordered.filter(x => x.gaps.length === 0).length;

  const bulk = useCallback((): BulkClient[] =>
    (rows ?? []).map(c => ({ ownerId: c.ownerId, name: c.name })), [rows]);

  const fetchMoney = useCallback(async () => {
    if (money || !rows?.length) return money;
    setBusy('money');
    const map = await loadStatements(supabase, bulk(), year);
    setCash({ year, map });
    setBusy(null);
    return map;
  }, [money, rows, supabase, bulk, year]);

  const toggleMoney = async () => {
    const next = !showMoney;
    setShowMoney(next);
    if (next) await fetchMoney();
  };

  // ΕΝΑ ΒΙΒΛΙΟ ΑΝΑ ΠΕΛΑΤΗ, ΟΛΑ ΣΕ ΕΝΑΝ ΦΑΚΕΛΟ. Ο λογιστής αρχειοθετεί ανά
  // πελάτη: ένα βιβλίο με ογδόντα φύλλα θα έπρεπε να το σπάσει μόνος του.
  const downloadEverything = async () => {
    setBusy('zip');
    const m = (await fetchMoney()) ?? money;
    setBusy('zip');
    const ready = Array.from(m?.values() ?? []);
    const n = await downloadAll(ready, year, new Date().toLocaleDateString('el-GR'));
    setBusy(null);
    setNotice(n === 0
      ? 'Κανένα βιβλίο δεν είναι διαθέσιμο για αυτή τη χρήση.'
      : n === 1 ? 'Κατέβηκε ένα βιβλίο.' : `Κατέβηκαν ${n} βιβλία.`);
  };

  // ── ΟΛΟΙ ΟΙ ΦΑΚΕΛΟΙ ΤΗΣ ΧΡΗΣΗΣ ───────────────────────────────────────────
  // Μόνο όσοι έχουν σταλεί: ο φάκελος είναι του πελάτη και δεν χτίζεται εδώ.
  // Με τη σειρά της λίστας (όποιος δεν κλείνει πρώτος), ώστε ο κατάλογος του zip
  // να διαβάζεται όπως η οθόνη.
  const packRefs = useMemo((): PackRef[] => ordered.flatMap(({ c, ready }) =>
    (c.e2?.packs ?? []).filter(p => p.filePath).map(p => ({
      ownerId: c.ownerId, name: c.name, afm: p.ownerAfm, path: p.filePath as string, sizeBytes: p.sizeBytes,
      readiness: ready.label, aade: aadeStateLabel(aadeStateOf(c.e2)), missingCount: p.missingCount, sharedAt: p.sharedAt,
    }))), [ordered]);

  const downloadAllPacks = async () => {
    if (!packRefs.length) return;
    setBusy('packs');
    setPackProgress('');
    const r = await downloadPacks(packRefs, year, path => fileBytes(supabase, path), (d, t) => setPackProgress(`${d}/${t}`));
    setBusy(null);
    setPackProgress('');
    const how = r.mode === 'one' ? 'σε ένα zip' : 'ένας ένας, γιατί μαζί ξεπερνούν το όριο του ενός αρχείου';
    const lost = r.failed.length ? ` Δεν κατέβηκαν: ${r.failed.join(', ')}.` : '';
    setNotice(r.done === 0
      ? `Κανένας φάκελος δεν κατέβηκε.${lost}`
      : `${r.done === 1 ? 'Κατέβηκε 1 φάκελος' : `Κατέβηκαν ${r.done} φάκελοι`} ${how}.${lost}`);
  };

  const wrap = portalWrap;
  // Η ΕΤΙΚΕΤΑ ΕΝΟΤΗΤΑΣ ΤΗΣ ΕΦΑΡΜΟΓΗΣ (TT.label), όχι δική της: ήταν 11 με κανονικό
  // βάρος και άλλο διάστιχο από κάθε «ΝΕΟΣ ΠΕΛΑΤΗΣ» του πίνακα.
  const label: React.CSSProperties = { ...TT.label, color: 'var(--text-tertiary)', margin: 0 };

  // Το δεύτερο βήμα πριν από οτιδήποτε του γραφείου: η βάση δεν απαντά χωρίς αυτό.
  if (secondStep) return <SecondStep onDone={() => { setSecondStep(null); void loadFirm(); }} />;

  // Το γραφείο, τα μέλη και το ιστορικό: ίδια διαδρομή, άλλη όψη (FirmView.tsx).
  // Μόνο αφού η βάση πει ότι δεν λείπει δεύτερο βήμα.
  if (view === 'firm') return secondStep === false || email === null ? <FirmView /> : <main style={{ ...wrap, padding: '64px 24px' }} />;

  if (email === undefined) return <main style={{ ...wrap, padding: '64px 24px' }} />;

  if (email === null) {
    return (
      <div className="po-floor" style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
        <PortalBar />
        {/* ΤΟ ΙΔΙΟ ΠΕΡΙΓΡΑΜΜΑ ΜΕ ΤΗ ΣΥΝΔΕΔΕΜΕΝΗ ΟΘΟΝΗ. Ο τίτλος ήταν γραμμένος με
            το χέρι, με άλλο μέγεθος και χωρίς την υπερκείμενη γραμμή: ο ίδιος
            άνθρωπος, δύο δευτερόλεπτα απόσταση, δύο σχέδια. */}
        <main style={wrap}>
          <PortalTitle
            over="Χωρίς λογαριασμό"
            title="Όλοι οι πελάτες σου σε μία λίστα"
            meta="Με λογαριασμό βλέπεις μαζί κάθε ιδιοκτήτη που σε εξουσιοδότησε και τι λείπει από τον καθένα, χωρίς να κρατάς έναν σύνδεσμο ανά πελάτη."
          />
          <Btn variant="primary" href="/login?next=/accountant/workspace">Σύνδεση</Btn>
        </main>
      </div>
    );
  }

  return (
    <div className="po-floor" style={{ background: 'var(--bg-base)', minHeight: '100vh', paddingBottom: 72 }}>
      <PortalBar year={year} onYear={setYear} firmOnly={firm?.firmOnly} />
      <main style={wrap}>
        {/* Η ΣΥΝΟΨΗ ΛΕΕΙ ΤΙ ΑΞΙΖΕΙ ΝΑ ΚΟΙΤΑΞΕΙΣ ΠΡΩΤΑ. Ο τίτλος έλεγε μόνο πόσοι
            είναι: με ογδόντα πελάτες, ο αριθμός «80» δεν οδηγεί σε καμία κίνηση,
            ενώ το «3 δεν κλείνουν» οδηγεί κατευθείαν στις τρεις πρώτες κάρτες. */}
        <PortalTitle over={`${rows?.length ?? 0} ${(rows?.length ?? 0) === 1 ? 'πελάτης' : 'πελάτες'}`}
          title="Οι πελάτες σου"
          meta={
            /* ΔΥΟ ΓΡΑΜΜΕΣ ΑΠΟ ΠΡΟΘΕΣΗ, ΟΧΙ ΑΠΟ ΤΥΧΗ. Σε μία γραμμή, δίπλα σε τέσσερα
               κουμπιά, το meta έσπαγε όπου τύχαινε και το «·» έμενε μόνο του στο
               τέλος της σειράς. Η χρήση πάνω, η εικόνα της λίστας από κάτω. */
            <>
              <span style={{ display: 'block' }}>Χρήση 01/01/{year} έως 31/12/{year}</span>
              {ordered.length > 0 && (
                <span style={{ display: 'block' }}>
                  <strong style={{ color: stuck > 0 ? 'var(--text-primary)' : 'inherit' }}>
                    {stuck === 0 ? 'Κανένας με εκκρεμότητες' : stuck === 1 ? '1\u00a0με\u00a0εκκρεμότητες' : `${stuck}\u00a0με\u00a0εκκρεμότητες`}
                  </strong>{` · ${done === 1 ? '1\u00a0έτοιμος' : `${done}\u00a0έτοιμοι`}`}
                </span>
              )}
            </>
          }
          right={ordered.length > 0 || firm ? (
            <>
              {/* ΙΔΙΟ ΣΧΗΜΑ ΓΙΑ ΤΙΣ ΙΣΟΤΙΜΕΣ ΕΝΕΡΓΕΙΕΣ. Τα δύο πρώτα ήταν «ghost»,
                  χωρίς περίγραμμα, δίπλα σε δύο με περίγραμμα: στο τηλέφωνο
                  έμοιαζαν με λεζάντες που αιωρούνται πάνω από τα κουμπιά. */}
              {firm && <Btn variant="secondary" href="/accountant/workspace?view=firm">{team ? 'Το γραφείο' : 'Το γραφείο μου'}</Btn>}
              {ordered.length > 0 && actor && <>
              <Btn variant="secondary" onClick={() => void toggleMoney()} disabled={busy === 'money'}>
                {busy === 'money' ? 'Φόρτωση…' : showMoney ? 'Κρύψε ποσά' : 'Δείξε ποσά'}
              </Btn>
              <Btn variant="secondary" onClick={() => void downloadEverything()} disabled={busy !== null}>
                {busy === 'zip' ? 'Ετοιμάζεται…' : 'Κατέβασε τα βιβλία'}
              </Btn>
              {/* ΟΙ ΦΑΚΕΛΟΙ ΚΑΙ ΟΧΙ ΤΑ ΒΙΒΛΙΑ. Το «Κατέβασε τα όλα» δίνει τις
                  καταστάσεις εσόδων και δαπανών· αυτό δίνει ό,τι έστειλε κάθε
                  πελάτης: Ε2, έλεγχο, παραστατικά και κωδικούς. */}
              {packRefs.length > 0 && (
                <Btn variant="secondary" onClick={() => void downloadAllPacks()} disabled={busy !== null}
                  title={bundleMode(packRefs) === 'one' ? undefined : 'Πολλοί ή βαριοί φάκελοι: κατεβαίνουν ένας ένας'}>
                  {busy === 'packs' ? `Κατεβαίνουν${packProgress ? ` ${packProgress}` : '…'}` : packRefs.length === 1 ? 'Ο φάκελος' : `Οι ${packRefs.length} φάκελοι`}
                </Btn>
              )}
              </>}
            </>
          ) : undefined} />

      {/* ΜΙΑ ΣΤΗΛΗ, ΕΝΑ ΚΕΝΟ. Κάθε κάρτα είχε δικό της `marginTop` (20, 16, 12, 10)
          και πάνω του το κάτω περιθώριο της `Card`: τα κενά ανάμεσα στα μπλοκ
          έβγαιναν 26, 32 ή 36 ανάλογα με το ποιο τύχαινε να είναι πρώτο. */}
      <div style={{ display: 'grid', gap: T.sp.lg }}>
      {/* Η ΠΡΟΣΘΗΚΗ ΚΑΘΕΤΑΙ ΠΑΝΩ, ΓΙΑΤΙ ΕΙΝΑΙ Η ΠΡΩΤΗ ΚΙΝΗΣΗ ΠΟΥ ΚΑΝΕΙΣ ΕΔΩ.
          Όταν η λίστα γεμίσει, παύει να είναι η πρώτη — αλλά ούτε ενοχλεί, γιατί
          είναι μία γραμμή. */}
      {/* ΟΣΑ ΔΕΝ ΠΑΤΙΟΥΝΤΑΙ, ΔΕΝ ΤΥΠΩΝΟΝΤΑΙ. Ο λογιστής τυπώνει τη λίστα για να
          την πάρει μαζί του: η προσθήκη πελάτη, η αναζήτηση και τα κουμπιά είναι
          χειριστήρια, όχι πληροφορία. */}
      {invites.map(i => (
        <Card key={i.id} gap={false} className="po-noprint">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: T.sp.md, flexWrap: 'wrap' }}>
            <p style={{ fontSize: 'var(--fs-md)', margin: 0, color: 'var(--text-primary)', fontFamily: T.font.sans, lineHeight: 1.5 }}>
              <strong>{i.firmName}</strong>{` σε προσκαλεί στο γραφείο. Ρόλος: ${ROLE_LABEL[i.role]}.`}
            </p>
            <div className="act-row" style={{ display: 'flex', gap: T.sp.sm }}>
              <Btn variant="secondary" onClick={() => void reply(i.id, false)}>Απόρριψη</Btn>
              <Btn variant="primary" onClick={() => void reply(i.id, true)} disabled={!inviteTerms[i.id]}>Αποδοχή</Btn>
            </div>
          </div>
          <div style={{ marginTop: T.sp.md }}>
            <FirmTermsCheck id={`firm-terms-${i.id}`} checked={!!inviteTerms[i.id]} onChange={on => setInviteTerms(t => ({ ...t, [i.id]: on }))} />
          </div>
        </Card>
      ))}

      {/* ΧΩΡΙΣ ΑΠΟΔΟΧΗ ΤΩΝ ΟΡΩΝ, ΚΑΝΕΝΑΣ ΠΕΛΑΤΗΣ. Η βάση τους κρύβει· εδώ λέμε
          γιατί και τι κάνεις. Το μέλος δέχεται για τον εαυτό του, ο Υπεύθυνος
          και για το γραφείο. */}
      {gap && (
        <Card gap={false} className="po-noprint">
          <p style={label}>Όροι επεξεργασίας</p>
          <p style={{ fontSize: 'var(--fs-md)', margin: `${T.sp.sm}px 0 ${T.sp.md}px`, color: 'var(--text-primary)', fontFamily: T.font.sans, lineHeight: 1.5 }}>
            {gap === 'mine'
              ? 'Οι πελάτες του γραφείου εμφανίζονται αφού αποδεχτείς τους όρους επεξεργασίας για λογαριασμό τους.'
              : canManage(firm?.role)
                ? 'Οι πελάτες του γραφείου εμφανίζονται αφού αποδεχτείς τους όρους επεξεργασίας για λογαριασμό του γραφείου.'
                : 'Οι πελάτες του γραφείου εμφανίζονται αφού ο Υπεύθυνος του γραφείου αποδεχτεί τους όρους επεξεργασίας.'}
          </p>
          {(gap === 'mine' || canManage(firm?.role)) && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: T.sp.md, flexWrap: 'wrap' }}>
              <FirmTermsCheck id="firm-terms-renew" checked={termsTick} onChange={setTermsTick} />
              <Btn variant="primary" onClick={() => void acceptTerms()} disabled={!termsTick || termsBusy}>Αποδοχή</Btn>
            </div>
          )}
        </Card>
      )}

      {actor && <>
      <Card gap={false} className="po-noprint">
        <p style={label}>Νέος πελάτης</p>
        {/* ΤΟ ΠΕΔΙΟ ΚΑΙ ΤΟ ΚΟΥΜΠΙ ΕΙΝΑΙ ΤΑ ΚΟΙΝΑ ΤΗΣ ΕΦΑΡΜΟΓΗΣ. Ηταν ζωγραφισμένα
            εδώ, με δικό τους ύψος, δικό τους περίγραμμα και δική τους
            απενεργοποίηση: η μία οθόνη που βλέπει ο λογιστής πρώτη έμοιαζε με
            άλλο προϊόν από τις υπόλοιπες. */}
        <div style={{ display: 'flex', gap: T.sp.sm, marginTop: T.sp.sm, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1 1 340px' }}>
            <TextInput
              ariaLabel="Σύνδεσμος που σου έστειλε ο ιδιοκτήτης"
              value={token}
              onChange={v => { setToken(v); setNotice(''); }}
              onKeyDown={e => { if (e.key === 'Enter') void addClient(); }}
              placeholder="Ο σύνδεσμος του ιδιοκτήτη"
            />
          </div>
          {/* Στο τηλέφωνο, όταν πέφτει κάτω από το πεδίο, πιάνει όλο το πλάτος του. */}
          <style>{`@media (max-width:560px){.np-add{flex:1 1 100%;display:grid}}`}</style>
          <div className="np-add">
            <Btn variant="primary" size="lg" onClick={() => void addClient()} disabled={adding || !token.trim()}>
              {adding ? 'Προσθήκη…' : 'Πρόσθεσε'}
            </Btn>
          </div>
        </div>
        {notice && (
          <p style={{ fontSize: 'var(--fs-note)', color: 'var(--text-secondary)', margin: '10px 0 0', fontFamily: T.font.sans }}>{notice}</p>
        )}
      </Card>

      {/* Η ΠΡΟΣΚΛΗΣΗ ΜΕ EMAIL ΖΗΤΑ ΠΑΚΕΤΟ (20261021120000)· ο λογαριασμός
          γραφείου δεν έχει πακέτο ούτε βλέπει οθόνη αγοράς. Μένει για όσους
          λογιστές την είχαν πριν από τα γραφεία. */}
      {!firm?.firmOnly && <BulkInvite db={supabase} label={label} />}
      </>}

      {/* ΤΑ ΦΙΛΤΡΑ ΤΟΥ ΓΡΑΦΕΙΟΥ. Τρία dropdown σε μία γραμμή, ίδια με της
          υπόλοιπης εφαρμογής· εμφανίζονται μόνο όταν το γραφείο έχει δεύτερο μέλος. */}
      {team && (rows?.length ?? 0) > 0 && (
        <div className={`form-row form-row-${manager ? 3 : 2} po-noprint`} style={{ gap: T.sp.sm }}>
          <CustomSelect ariaLabel="Ποιοι πελάτες" value={scope} onChange={v => setScope(v as Scope)}
            options={[{ value: 'all', label: 'Όλοι οι πελάτες' }, { value: 'mine', label: 'Οι πελάτες μου' }]} />
          {manager && (
            <CustomSelect ariaLabel="Υπεύθυνος" value={assignee || 'any'} onChange={v => setAssignee(v === 'any' ? '' : v)}
              options={[{ value: 'any', label: 'Κάθε υπεύθυνος' },
                ...activeMembers.map(m => ({ value: m.userId as string, label: memberName(m.userId as string, m.email) })),
                { value: '-', label: 'Χωρίς υπεύθυνο' }]} />
          )}
          <CustomSelect ariaLabel="Κατάσταση" value={status} onChange={v => setStatus(v as StatusFilter)}
            options={[{ value: 'all', label: 'Κάθε κατάσταση' }, { value: 'blocked', label: 'Με εκκρεμότητες' }, { value: 'ready', label: 'Έτοιμοι' }]} />
        </div>
      )}

      {/* Η ΜΑΖΙΚΗ ΑΝΑΘΕΣΗ. Εμφανίζεται μόλις επιλεγεί πελάτης, στη θέση της, όχι
          σε δεύτερη οθόνη. */}
      {team && manager && picked.size > 0 && (
        <Card gap={false} className="po-noprint">
          {/* ΜΙΑ ΟΜΑΔΑ ΚΙΝΗΣΕΩΝ, ΟΧΙ ΤΡΙΑ ΣΧΗΜΑΤΑ. Ηταν «Ανάθεση» με περίγραμμα,
              «Αφαίρεση ανάθεσης» σβηστό κείμενο και «Ακύρωση επιλογής» έντονο
              κείμενο. Τώρα: κύριο (ανοίγει μόλις διαλεχτεί μέλος), δευτερεύον,
              ήσυχο στο τέλος, ίδιο ύψος με τον επιλογέα. Στο τηλέφωνο πλήθος και
              επιλογέας σε μία σειρά, οι κινήσεις από κάτω σε όλο το πλάτος. */}
          <style>{`.bulk-bar{display:flex;flex-wrap:wrap;align-items:center;gap:${T.sp.sm}px ${T.sp.lg}px}
.bulk-pick{display:flex;align-items:center;gap:${T.sp.md}px;flex:1 1 320px;min-width:0}
.bulk-acts{display:flex;align-items:center;gap:${T.sp.sm}px;margin-left:auto}
@media (max-width:560px){.bulk-acts{width:100%;margin-left:0}.bulk-acts>*{flex:1 1 auto}}`}</style>
          <div className="bulk-bar">
            <div className="bulk-pick">
              <span style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-primary)', fontFamily: T.font.sans, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {picked.size === 1 ? '1\u00a0επιλεγμένος' : `${picked.size}\u00a0επιλεγμένοι`}
              </span>
              <div style={{ flex: '1 1 auto', minWidth: 0, maxWidth: 320 }}>
                {/* ΤΟ ΟΝΟΜΑ ΠΡΩΤΟ, Ο ΡΟΛΟΣ ΑΠΟ ΚΑΤΩ. Το «email · ρόλος» σε μία γραμμή
                    ήταν πλατύτερο από τη λίστα και κοβόταν. */}
                <CustomSelect ariaLabel="Ανάθεση σε" value={assignTo} onChange={setAssignTo} placeholder="Ανάθεση σε…"
                  options={activeMembers.map(m => {
                    const name = memberName(m.userId as string, m.email);
                    return { value: m.userId as string, label: name, description: name === m.email ? ROLE_LABEL[m.role] : `${ROLE_LABEL[m.role]} · ${m.email}` };
                  })} />
              </div>
            </div>
            <div className="bulk-acts">
              <Btn size="lg" variant="primary" onClick={() => void assignPicked(true)} disabled={!assignTo}>Ανάθεση</Btn>
              <Btn size="lg" variant="secondary" onClick={() => void assignPicked(false)} disabled={!assignTo}>Αφαίρεση ανάθεσης</Btn>
              <Btn size="lg" variant="ghost" onClick={() => setPicked(new Set())}>Ακύρωση επιλογής</Btn>
            </div>
          </div>
        </Card>
      )}

      {/* Η ΑΝΑΖΗΤΗΣΗ ΕΜΦΑΝΙΖΕΤΑΙ ΟΤΑΝ ΑΡΧΙΖΕΙ ΝΑ ΕΧΕΙ ΝΟΗΜΑ. Πάνω από ένα
          κατέβασμα οθόνης, το μάτι δεν σαρώνει πια: ψάχνει. Κάτω από αυτό,
          ένα πεδίο αναζήτησης πάνω από τρεις κάρτες είναι θόρυβος. */}
      {(rows?.length ?? 0) >= SEARCH_FROM && (
        <div className="po-noprint">
          <TextInput
            ariaLabel="Αναζήτηση πελάτη"
            value={find}
            onChange={setFind}
            placeholder="Όνομα ή ΑΦΜ"
          />
          {find.trim() && (
            <p style={{ fontSize: 'var(--fs-note)', color: 'var(--text-tertiary)', margin: '8px 0 0', fontFamily: T.font.sans }}>
              {shown.length === 0 ? 'Κανένας πελάτης με αυτό το όνομα ή ΑΦΜ.'
                : shown.length === 1 ? '1 πελάτης' : `${shown.length} πελάτες`}
            </p>
          )}
        </div>
      )}

      {readFailed ? (
        /* Η ΛΙΣΤΑ ΔΕΝ ΔΙΑΒΑΣΤΗΚΕ, ΔΕΝ ΑΔΕΙΑΣΕ. Η οθόνη έλεγε «Κανένας πελάτης»
           και έστελνε τον λογιστή να ζητήσει σύνδεσμο από ιδιοκτήτες που τον
           έχουν ήδη εξουσιοδοτήσει. */
        <Card gap={false}>
          <p style={{ fontSize: 'var(--fs-md)', color: 'var(--text-secondary)', margin: `0 0 ${T.sp.md}px`, lineHeight: 1.7, fontFamily: T.font.sans }}>
            Δεν φόρτωσε η λίστα των πελατών σου. Δεν σημαίνει ότι είναι άδεια· απλώς δεν πήραμε απάντηση.
          </p>
          <Btn onClick={() => void load(year)}>Δοκίμασε ξανά</Btn>
        </Card>
      ) : rows === null ? (
        /* ΤΟ ΛΕΥΚΟ ΔΕΝ ΕΙΝΑΙ ΚΑΤΑΣΤΑΣΗ. Οσο τα δεδομένα έρχονταν, η οθόνη δεν
           έδειχνε τίποτα: ο λογιστής δεν ήξερε αν φορτώνει ή αν δεν έχει
           πελάτες. Τρεις σκιές λένε «έρχονται» χωρίς να υποσχεθούν πόσοι. */
        <div style={{ display: 'grid', gap: T.sp.md }} aria-busy="true">
          {[0, 1, 2].map(i => (
            <Card key={i} gap={false}><Skeleton h={54} /></Card>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState page icon={<Users size={20} />} title="Κανένας πελάτης στη λίστα"
          hint="Ο ιδιοκτήτης σού στέλνει τον σύνδεσμο που βγάζει από τη Λογιστική του, στον φάκελο για τον λογιστή. Τον επικολλάς στο «Νέος πελάτης»." />
      ) : (
        <div style={{ display: 'grid', gap: T.sp.md }}>
          {listed.length === 0 && (
            <EmptyState page icon={<Filter size={20} />} title="Κανένας πελάτης με αυτά τα φίλτρα" hint="Άλλαξε τον υπεύθυνο ή την κατάσταση για να δεις περισσότερους." />
          )}
          {listed.map(({ c, gaps, ready }) => {
            // Ο ΣΥΝΕΡΓΑΤΗΣ ΔΙΑΒΑΖΕΙ: χωρίς αιτήματα, ανεβάσματα και εξαγωγές.
            const act = actor && c.canAct !== false;
            const kinds = entryKinds(levels.get(c.ownerId)?.myLevel);
            return (
              <Card key={c.ownerId} gap={false}>
                {/* ΤΟ ΟΝΟΜΑ ΚΑΙ ΤΑ ΚΟΥΜΠΙΑ ΣΤΗΝ ΙΔΙΑ ΝΟΗΤΗ ΓΡΑΜΜΗ. Με `baseline` η κατάσταση
                    στοιχιζόταν στη βασική γραμμή του ονόματος και τα κουμπιά 36
                    κρέμονταν από κάτω της· τώρα η πρώτη γραμμή έχει το ύψος του
                    κουμπιού (T.h.md) και όλα κάθονται στο κέντρο της. */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: `${T.sp.sm}px ${T.sp.lg}px`, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: T.sp.md, alignItems: 'flex-start', minWidth: 0, flex: '1 1 260px' }}>
                  {team && manager && (
                    /* Ο ΣΤΟΧΟΣ ΕΙΝΑΙ 44, ΤΟ ΚΟΥΤΙ 18. Η ετικέτα γύρω του δίνει το
                       δάπεδο αφής χωρίς να σπρώχνει το όνομα. */
                    <label className="po-noprint" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: T.h.lg, height: T.h.lg, margin: `calc((${T.h.md} - ${T.h.lg}) / 2) calc((18px - ${T.h.lg}) / 2)`, flexShrink: 0, cursor: 'pointer' }}>
                      <input type="checkbox" aria-label={`Επιλογή: ${c.name}`}
                        checked={picked.has(c.ownerId)}
                        onChange={e => setPicked(s => { const n = new Set(s); if (e.target.checked) n.add(c.ownerId); else n.delete(c.ownerId); return n; })}
                        style={{ width: 18, height: 18, margin: 0, accentColor: 'var(--accent)' }} />
                    </label>
                  )}
                  <div style={{ minWidth: 0 }}>
                    {/* ΤΟ ΟΝΟΜΑ ΑΝΟΙΓΕΙ ΤΟΝ ΠΕΛΑΤΗ. Η λίστα έλεγε ποιος δεν
                        κλείνει και δεν είχε κανέναν δρόμο προς τα ποσά του: ο
                        λογιστής γύριζε στο μήνυμα με τον σύνδεσμο. Δηλαδή στους
                        ογδόντα σελιδοδείκτες που αυτή η οθόνη ήρθε να καταργήσει. */}
                    {/* Η ΚΑΤΑΣΤΑΣΗ ΔΙΠΛΑ ΣΤΟ ΟΝΟΜΑ, ΩΣ ΕΤΙΚΕΤΑ. Ηταν σκέτο κείμενο αριστερά
                        από το «Καταχώρηση» και, όταν το κουμπί έλειπε, έμενε να
                        αιωρείται. Η λέξη μένει (όχι μόνο χρώμα)· ο τόνος βοηθά τη σάρωση. */}
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: T.sp.sm, minHeight: T.h.md }}>
                    <h2 style={{ fontSize: 'var(--fs-md)', fontWeight: 700, margin: 0, lineHeight: 1.4, color: 'var(--text-primary)', fontFamily: T.font.sans }}>
                      {/* Η ΔΙΕΥΘΥΝΣΗ ΕΙΝΑΙ ΤΟΥ ΠΕΛΑΤΗ, ΟΧΙ ΤΟΥ ΣΥΝΔΕΣΜΟΥ ΤΟΥ. Ανοίγει
                          μόνο σε όποιον η βάση κρίνει ότι τον βλέπει ακόμη
                          (`firm_client_data`)· αντιγραμμένη αλλού δεν ανοίγει τίποτα. */}
                      <a href={`/accountant/${c.ownerId}?year=${year}`} className="po-tap-inline" style={{ color: 'inherit', textDecoration: 'none', borderBottom: '1px solid var(--border-default)' }}>
                        {c.name}
                      </a>
                    </h2>
                    <Chip tone={ready.blocking > 0 ? 'warning' : gaps.length === 0 ? 'positive' : 'neutral'}>{ready.label}</Chip>
                    </div>
                    <p style={metaLine}>
                      {c.properties === 1 ? '1\u00a0ακίνητο' : `${c.properties}\u00a0ακίνητα`}
                      {c.afm ? ` · ΑΦΜ ${c.afm}` : ''}
                    </p>
                    {/* ΠΟΤΕ ΚΙΝΗΘΗΚΕ ΤΕΛΕΥΤΑΙΑ ΦΟΡΑ. Δύο πελάτες με τα ίδια κενά
                        είναι εντελώς διαφορετική δουλειά όταν ο ένας καταχώρησε
                        χθες και ο άλλος τον Μάρτιο. */}
                    <p style={metaLine}>{lastMove(c.lastActivity)}</p>
                    {/* Ο ΥΠΕΥΘΥΝΟΣ ΣΕ ΔΙΚΗ ΤΟΥ ΓΡΑΜΜΗ. Κολλημένος πίσω από την
                        «Τελευταία καταχώρηση» τύλιγε και το email του έπεφτε
                        μόνο του στην επόμενη σειρά. */}
                    {team && (
                      <p style={{ ...metaLine, overflowWrap: 'anywhere' }}>
                        {(c.assignees ?? []).length === 0 ? 'Χωρίς υπεύθυνο'
                          : `${(c.assignees ?? []).length === 1 ? 'Υπεύθυνος' : 'Υπεύθυνοι'}: ${(c.assignees ?? []).map(a => memberName(a.userId, a.name)).join(', ')}`}
                      </p>
                    )}
                    {/* ΤΟ ΜΗΔΕΝ ΔΕΝ ΓΡΑΦΕΤΑΙ ΩΣ ΠΟΣΟ. Πελάτης χωρίς καμία
                        καταχώρηση δεν έχει έσοδα «0,00€»: δεν έχει μέτρηση. Και
                        όποιος δεν απάντησε λείπει, δεν μηδενίζεται. Η ετικέτα
                        πριν από το ποσό και με απαλό χρώμα: ο αριθμός διαβάζεται
                        πρώτος, η λέξη τον εξηγεί. */}
                    {showMoney && money && (
                      <p style={{ ...metaLine, marginTop: T.sp.xs, fontSize: 'var(--fs-base)', color: 'var(--text-secondary)' }}>
                        {(() => {
                          const m = money.get(c.ownerId);
                          if (!m) return 'Τα ποσά δεν διαβάστηκαν';
                          if (!m.hasEntries) return 'Καμία καταχώρηση στη χρήση';
                          const fig: React.CSSProperties = { fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--text-primary)' };
                          return <>
                            <span style={{ whiteSpace: 'nowrap' }}>Έσοδα <span style={fig}>{fe(m.income)}</span></span>
                            <span aria-hidden="true" style={{ color: 'var(--text-tertiary)' }}>{'  ·  '}</span>
                            <span style={{ whiteSpace: 'nowrap' }}>Δαπάνες <span style={fig}>{fe(m.expenses)}</span></span>
                          </>;
                        })()}
                      </p>
                    )}
                  </div>
                  </div>
                  {/* Η ΑΦΑΙΡΕΣΗ ΔΕΝ ΕΙΝΑΙ ΑΝΑΚΛΗΣΗ. Η ανάκληση ανήκει στον
                      ιδιοκτήτη και μένει δική του· εδώ ο λογιστής απλώς
                      τακτοποιεί τη ΔΙΚΗ ΤΟΥ λίστα. ΛΕΞΗ ΚΑΙ ΟΧΙ ΕΙΚΟΝΙΔΙΟ: ενα «Χ»
                      δίπλα σε πελάτη διαβάζεται και ως «κόψε του την πρόσβαση». */}
                  {((kinds.length > 0 && act) || (firm ? manager : true)) && (
                    <div className="po-noprint" style={{ display: 'flex', alignItems: 'center', gap: T.sp.sm, minHeight: T.h.md }}>
                      {kinds.length > 0 && act && (
                        <ActionMenu label="Καταχώρηση" title={`Καταχώρηση για ${c.name}`}
                          items={kinds.map(k => ({ key: k, label: ENTRY_LABEL[k], onClick: () => setEntry({ c, kind: k }) }))} />
                      )}
                      {(firm ? manager : true) && (
                        <ActionMenu iconOnly label={`Ενέργειες για ${c.name}`} title={`Ενέργειες για ${c.name}`}
                          items={[{ key: 'remove', label: 'Αφαίρεση από τη λίστα', danger: true, onClick: () => void removeClient(c.ownerId, c.name) }]} />
                      )}
                    </div>
                  )}
                </div>

                {/* ══ ΕΝΑ ΓΕΓΟΝΟΣ, ΜΙΑ ΓΡΑΜΜΗ (09/11/2026) ══════════════════════
                    Η κάρτα έλεγε το ίδιο πράγμα δύο φορές: «Το προσυμπληρωμένο Ε2
                    δεν έχει ανέβει» στην ενότητα του Ε2 ΚΑΙ «Δεν έχει ανέβει το
                    προσυμπληρωμένο Ε2» στη λίστα· «Δεν έχει στείλει τον φάκελο» στη
                    λίστα ΚΑΙ στο «Σε εκκρεμότητα». Τώρα κάθε εκκρεμότητα είναι μία
                    γραμμή με την κατάστασή της (ζητήθηκε πότε) και τις κινήσεις της
                    σε μία στήλη δεξιά· τα αιτήματα έρχονται από τη βάση μόνο
                    (joinRequests), όχι από μνήμη της οθόνης. */}
                {(() => {
                  const { rows: gapRows, other } = joinRequests(gaps, c.requests);
                  const st = aadeStateOf(c.e2);
                  const packs = c.e2?.packs.filter(p => p.filePath) ?? [];
                  // Η κατάσταση της σύγκρισης λέγεται εδώ μόνο όταν ΔΕΝ είναι ήδη εκκρεμότητα.
                  const aadeLine = !!c.e2 && (st.kind === 'matches' || st.kind === 'pending');
                  const upload = (label: string) => (
                    <Btn className="po-noprint" variant="secondary" onClick={() => void openImport(c)}>{label}</Btn>
                  );
                  const withdraw = (ids: string[]) => (
                    <Btn className="po-noprint" variant="ghost" onClick={() => void unask(ids)}>Πάρ’ το πίσω</Btn>
                  );
                  const asked = (at: string) => (
                    <Chip>{`Ζητήθηκε ${fd(at)}`}</Chip>
                  );
                  return <>
                    {gapRows.length > 0 && (
                      <CardSection label="Τι λείπει">
                        {gapRows.map(({ gap: g, requests: rq }) => (
                          <ItemRow key={g.key}
                            text={<span style={{ color: g.blocking ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: g.blocking ? 600 : 400 }}>{g.item}</span>}
                            note={rq[0]?.note ? `«${rq[0].note}»` : undefined}>
                            {rq.length > 0 && asked(rq[0].createdAt)}
                            {act && rq.length > 0 && withdraw(rq.map(r => r.id))}
                            {act && rq.length === 0 && (
                              <Btn className="po-noprint" variant="secondary" haspopup="dialog"
                                onClick={() => setAskFor({ ownerId: c.ownerId, ownerName: c.name, key: g.key, item: g.item, contact: { email: c.email, phone: c.phone } })}>
                                Ζήτησέ το
                              </Btn>
                            )}
                            {/* Το προσυμπληρωμένο μπορεί να το ανεβάσει και ο ίδιος ο λογιστής. */}
                            {act && g.key === 'aade_e2' && upload('Ανέβασέ το')}
                            {act && g.key === 'aade_diff' && upload('Ανέβασε νέο')}
                          </ItemRow>
                        ))}
                      </CardSection>
                    )}

                    {/* Ο ΠΕΛΑΤΗΣ ΠΟΥ ΕΡΧΕΤΑΙ ΕΤΟΙΜΟΣ: σύγκριση με την ΑΑΔΕ και φάκελος. */}
                    {(aadeLine || packs.length > 0) && (
                      <CardSection label={`Ε2 ${year} και φάκελος`}>
                        {aadeLine && (
                          <ItemRow text={aadeStateLabel(st)}>
                            {act && upload('Αντικατάστησέ το')}
                          </ItemRow>
                        )}
                        {packs.map(p => (
                          <ItemRow key={p.ownerAfm}
                            text={`Φάκελος ΑΦΜ ${p.ownerAfm}${p.missingCount ? ` · λείπουν ${p.missingCount}` : ' · πλήρης'}`}
                            note={[p.sharedAt ? `στάλθηκε ${fd(p.sharedAt)}` : '', p.sizeBytes ? fmtBytes(p.sizeBytes) : ''].filter(Boolean).join(' · ') || undefined}>
                            {/* ΤΟ ΦΥΛΛΟ ΠΟΥ ΑΝΟΙΓΕΙ ΔΙΠΛΑ ΣΤΟ TAXISNET. Οι κωδικοί του Ε1
                                και οι γραμμές του Ε2, χωρίς να ανοίξει όλος ο φάκελος. */}
                            {act && (
                              <Btn className="po-noprint" variant="secondary" onClick={() => void downloadCodes(c, p.ownerAfm, p.filePath!)} disabled={packBusy === `${p.filePath}#codes`}>
                                {packBusy === `${p.filePath}#codes` ? 'Κατεβαίνει…' : 'Κωδικοί Ε1 και Ε2'}
                              </Btn>
                            )}
                            {act && (
                              <Btn className="po-noprint" variant="secondary" onClick={() => void downloadPack(c, p.ownerAfm, p.filePath!)} disabled={packBusy === p.filePath}>
                                {packBusy === p.filePath ? 'Κατεβαίνει…' : 'Κατέβασε τον φάκελο'}
                              </Btn>
                            )}
                          </ItemRow>
                        ))}
                      </CardSection>
                    )}

                    {/* ΤΑ ΑΙΤΗΜΑΤΑ ΧΩΡΙΣ ΣΗΜΕΡΙΝΗ ΓΡΑΜΜΗ: ελεύθερα, ή για κάτι που
                        έκλεισε στο μεταξύ. Με ημερομηνία και τρόπο να παρθούν πίσω. */}
                    {other.length > 0 && (
                      <CardSection label="Άλλα αιτήματα">
                        {other.map(r => (
                          <ItemRow key={r.id} text={r.item} note={r.note ? `«${r.note}»` : undefined}>
                            {asked(r.createdAt)}
                            {act && withdraw([r.id])}
                          </ItemRow>
                        ))}
                      </CardSection>
                    )}
                  </>;
                })()}
              </Card>
            );
          })}
        </div>
      )}

      </div>

      {askFor && (
        <RequestSheet target={askFor} year={year} from={firm?.name} onClose={() => setAskFor(null)}
          onSend={note => ask(askFor, note)} />
      )}

      {entry && (
        <FirmEntry db={supabase} ownerId={entry.c.ownerId} ownerName={entry.c.name} kind={entry.kind}
          onClose={() => { setEntry(null); void load(year); }} onUndone={() => void load(year)} />
      )}

      {importFor && (
        <E2PrefilledImport
          ownerId={importFor.owner.ownerId} year={year}
          // ΤΑ ΑΦΜ ΤΩΝ ΑΚΙΝΗΤΩΝ ΠΡΩΤΑ. Το ΑΦΜ τιμολόγησης του πελάτη μπαίνει μόνο
          // όταν δεν υπάρχει κανένας φάκελος: αλλιώς ένα ανέβασμα σε ΑΦΜ που
          // διαφέρει από τον υπόχρεο των ακινήτων δεν το έβρισκε ποτέ η σύγκριση.
          afms={(() => {
            const packs = [...new Set(importFor.owner.e2?.packs.map(p => p.ownerAfm).filter(Boolean) ?? [])];
            return packs.length ? packs : importFor.owner.afm ? [importFor.owner.afm] : [];
          })()}
          known={importFor.known}
          onClose={() => setImportFor(null)}
          onSaved={() => { setImportFor(null); void load(year); }}
        />
      )}

      {/* ΜΙΑ ΠΑΡΑΓΡΑΦΟΣ, ΟΧΙ ΜΙΑ ΓΡΑΜΜΗ ΣΕ ΟΛΟ ΤΟ ΠΛΑΤΟΣ. Στα 1440 διαβαζόταν
          σαν υποσέλιδο που κανείς δεν κοιτά· με όριο ~65 χαρακτήρων και μικρή
          ετικέτα από πάνω διαβάζεται ως αυτό που είναι: ο κανόνας της πρόσβασης. */}
      <div style={{ margin: `${T.sp.section}px 0 0`, maxWidth: '65ch' }}>
        <p style={{ ...TT.label, color: 'var(--text-tertiary)', margin: 0 }}>Ποιους βλέπεις</p>
      <p style={{ fontSize: 'var(--fs-note)', color: 'var(--text-secondary)', margin: `${T.sp.xs}px 0 0`, lineHeight: 1.6, fontFamily: T.font.sans }}>
          Βλέπεις μόνο όσους σε εξουσιοδότησαν. Όταν ο ιδιοκτήτης ανακαλέσει την πρόσβαση ή φύγεις από το γραφείο, ο φάκελός του κλείνει αμέσως.
        </p>
      </div>
      </main>
    </div>
  );
}
