'use client'
// ═══════════════════════════════════════════════════════════════════════════
// Η ΚΑΤΑΣΤΑΣΗ ΤΟΥ ΠΕΛΑΤΟΛΟΓΙΟΥ: ΦΟΡΤΩΣΗ, ΦΟΡΜΕΣ, ΔΙΑΜΟΝΕΣ, ΕΓΓΡΑΦΑ, ΣΥΓΧΡΟΝΙΣΜΟΣ
// ─────────────────────────────────────────────────────────────────────────
// Ό,τι διαβάζει η καρτέλα από τη βάση, οι φόρμες και οι αποθηκεύσεις τους,
// η εισαγωγή από email και iCal, η εξαγωγή και οι μετρήσεις. Η οθόνη
// (TabClients) μόνο το αποδίδει.
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import * as properties from '@/lib/data/properties'
import * as stayStore from '@/lib/data/stays'
// Η απογραφή έχει ένα σπίτι: lib/data/inventory.
import * as inventory from '@/lib/data/inventory'
import { fe } from '@/components/Theme'
import { confirmDialog } from '@/components/confirmBus'
import { downloadTableXlsx } from '../exportCsv'
import * as checkinLink from '@/lib/data/checkinLink'
import { ensureDpa } from '@/lib/legal/dpa'
import { notifyError } from '@/components/Toast'
import { saved, savedData } from '@/components/dbWrite'
import { failed } from '@/lib/core/dbError'
import {
  stayNights, stayTotal, clientStats, normalizePhone, clientMatches, STAY_CHANNEL_LABELS,
} from '@/lib/clients/clients'
import {
  declarableGross, hostPayout, isDeclared, awaitsDeclaration, amountBasis, type AmountBasis,
} from '@/lib/clients/stayAmounts'
import { MSG_TEMPLATES } from '@/lib/clients/messages'
import { totals } from '@/lib/clients/reports'
import { climateLevyRates, isHighSeasonMonth } from '@/lib/billing/greekTax'
import { isHouseType } from '@/lib/tax/shortTermTax'
import { parseICal, guessChannel, icalToStayDrafts, stayKey, type ICalEvent } from '@/lib/clients/ical'
import { useLoad, type LoadTurn } from '@/app/hooks/useLoad'
import {
  type Client, type Stay, type Note, type PropRow, type InvItem, type ClientDoc, type IcalFeed,
  type Checkin, todayStr, isRecord, type FormState, emptyForm, type StayForm, emptyStay,
} from './model'

export type ClientsProps = { userId: string; onSelectProperty?: (id: string) => void }

export function useClients({ userId }: ClientsProps) {
  const supabase = createClient();
  const [clients, setClients] = useState<Client[]>([]);
  const [props, setProps] = useState<PropRow[]>([]);
  const [stays, setStays] = useState<Stay[]>([]);
  const [notesOf, setNotesOf] = useState<{ clientId: string; rows: Note[]; failed: boolean } | null>(null);
  const [inv, setInv] = useState<InvItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [undeclaredOnly, setUndeclaredOnly] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [reportYearMenu, setReportYearMenu] = useState(false);
  // ΟΙ ΥΠΟΒΟΛΕΣ ΚΟΥΒΑΛΟΥΝ ΤΟΝ ΠΕΛΑΤΗ ΤΟΥΣ. Πριν κρατούσαμε σκέτη λίστα και ένα
  // effect την άδειαζε σε κάθε αλλαγή πελάτη — δηλαδή το «άδειο» ήταν
  // αποθηκευμένη κατάσταση αντί για συμπέρασμα και μια αργοπορημένη απάντηση
  // του ΠΡΟΗΓΟΥΜΕΝΟΥ πελάτη προλάβαινε να γραφτεί πάνω στον νέο: ο ιδιοκτήτης
  // έβλεπε στοιχεία ταυτότητας άλλου επισκέπτη κάτω από άλλο όνομα.
  const [checkinsOf, setCheckinsOf] = useState<{ clientId: string; rows: Checkin[] } | null>(null);
  const [copiedFor, setCopiedFor] = useState<string | null>(null);
  // Ποιο πρότυπο μηνύματος είναι επιλεγμένο. Πέντε πρότυπα επί τρία κουμπιά το
  // καθένα έκαναν δεκαπέντε κουμπιά σε μία ενότητα — και μόνο τρία από αυτά
  // χρησίμευαν κάθε φορά. Τώρα διαλέγεις πρότυπο, βλέπεις ΟΛΟ το κείμενο και
  // οι τρεις ενέργειες είναι μία φορά, κάτω από αυτό.
  const [msgId, setMsgId] = useState<string>(MSG_TEMPLATES[0].id);
  const [msgCopied, setMsgCopied] = useState(false);
  // Εισαγωγή κράτησης από email (Airbnb/Booking) με τη βοήθεια του AI
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailText, setEmailText] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailErr, setEmailErr] = useState('');
  const [emailDraft, setEmailDraft] = useState<{ name: string; check_in: string; check_out: string; gross: string; fee: string; levy: string; channel: string } | null>(null);

  // Εισαγωγή iCal (Airbnb/Booking): συγχρονισμός κρατήσεων/διαμονών ανά ακίνητο.
  const [icalOpen, setIcalOpen] = useState(false);
  const [icalText, setIcalText] = useState('');
  const [icalUrl, setIcalUrl] = useState('');
  const [icalPropertyId, setIcalPropertyId] = useState('');
  const [icalChannel, setIcalChannel] = useState<'airbnb' | 'booking' | 'other'>('airbnb');
  const [icalIncludeBlocked, setIcalIncludeBlocked] = useState(false);
  const [icalEvents, setIcalEvents] = useState<ICalEvent[] | null>(null);
  const [icalBusy, setIcalBusy] = useState(false);
  const [icalMsg, setIcalMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [icalFeeds, setIcalFeeds] = useState<IcalFeed[]>([]);
  const [icalFeedsFailed, setIcalFeedsFailed] = useState(false);

  // Φόρμα νέου/επεξεργασίας πελάτη
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  // Ντοσιέ (drawer)
  const [openId, setOpenId] = useState<string | null>(null);
  const openIdRef = useRef<string | null>(null);
  useEffect(() => { openIdRef.current = openId; }, [openId]);

  // Φόρμα διαμονής
  const [stayForm, setStayForm] = useState<StayForm>(emptyStay());
  const [stayFormOpen, setStayFormOpen] = useState(false);
  const [savingStay, setSavingStay] = useState(false);

  // Φόρμα σχολίου
  const [noteForm, setNoteForm] = useState<{ kind: string; body: string }>({ kind: 'note', body: '' });

  // Έγγραφα πελάτη (ταυτότητα, συμβόλαιο, αποδείξεις)
  const [docsOf, setDocsOf] = useState<{ clientId: string; rows: ClientDoc[]; failed: boolean } | null>(null);
  const [docKindOf, setDocKindOf] = useState<{ clientId: string; kind: string } | null>(null);
  const [docBusy, setDocBusy] = useState(false);
  const [docMsgOf, setDocMsgOf] = useState<{ clientId: string; msg: { text: string; error?: boolean } | null } | null>(null);
  const docFileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (turn: LoadTurn) => {
    const [{ data: cl }, pr, it] = await Promise.all([
      supabase.from('clients').select('id,user_id,type,full_name,phone,email,notes,created_at,updated_at').eq('user_id', userId).order('created_at', { ascending: false }),
      properties.list<PropRow>(supabase, userId, { columns: 'id,name,prop_type,status_detail,client_id,sqm', orderBy: 'created_at' }),
      // Η απογραφή, για να δείχνει η φθορά σε ΑΝΤΙΚΕΙΜΕΝΟ και όχι σε κείμενο:
      // ο λογιστής χρειάζεται δαπάνη με παραστατικό, όχι «έσπασε κάτι».
      inventory.ofUser<InvItem>(supabase, userId, 'id,name,property_id,current_value'),
    ]);
    if (!turn.isLatest()) return;
    setClients((cl || []) as Client[]);
    setProps(pr);
    setInv(it);
    setLoading(false);
  }, [userId, supabase]);

  const loadStays = useCallback(async (turn: LoadTurn) => {
    const data = await stayStore.ofUser<Stay>(supabase, userId, '*');
    if (!turn.isLatest()) return;
    setStays((data || []) as Stay[]);
  }, [userId, supabase]);

  // ΤΟ «ΚΑΝΕΝΑ ΣΧΟΛΙΟ ΑΚΟΜΗ» ΗΤΑΝ ΒΕΒΑΙΩΣΗ ΠΟΥ ΔΕΝ ΕΙΧΑΜΕ ΔΙΚΑΙΩΜΑ ΝΑ ΠΟΥΜΕ.
  // Οταν η ανάγνωση αποτύγχανε το `data` γύριζε null, το χρονολόγιο άδειαζε κι ο
  // οικοδεσπότης διάβαζε «Κανένα σχόλιο ακόμη»: ίδια ακριβώς εικόνα με επισκέπτη
  // που όντως δεν έχει ιστορικό, ενώ εκεί μπορεί να κάθεται καταγραμμένη μια
  // φθορά ή μια συνεννόηση για την επόμενη διαμονή. Πλέον η αποτυχία ταξιδεύει
  // μαζί με τη λίστα κι η οθόνη λέει ότι δεν πήραμε απάντηση.
  const loadNotes = useCallback(async (clientId: string) => {
    const { data, error } = await supabase.from('client_notes').select('*').eq('user_id', userId).eq('client_id', clientId).order('created_at', { ascending: false });
    setNotesOf({ clientId, rows: (data || []) as Note[], failed: !!error });
  }, [userId, supabase]);

  // «ΔΕΝ ΕΧΟΥΝ ΑΠΟΘΗΚΕΥΤΕΙ ΕΓΓΡΑΦΑ»: το έλεγε η οθόνη κι όταν απλώς δεν
  // διαβάστηκε ο φάκελος του επισκέπτη. Ο οικοδεσπότης που ψάχνει το διαβατήριο
  // ή το υπογεγραμμένο συμβόλαιο συμπέραινε ότι δεν το ανέβασε ποτέ, οπότε ή το
  // ξαναζητούσε από τον άνθρωπο ή προχωρούσε χωρίς αυτό. Η αποτυχία ανάγνωσης
  // φτάνει τώρα στην οθόνη ως τρίτη κατάσταση, ξεχωριστή από το άδειο.
  const loadDocs = useCallback(async (clientId: string) => {
    const { data, error } = await supabase.from('client_documents').select('*').eq('user_id', userId).eq('client_id', clientId).order('created_at', { ascending: false });
    const list = (data || []) as ClientDoc[];
    const paths = list.map(d => d.file_path);
    if (paths.length) {
      const { data: signed } = await supabase.storage.from('property-files').createSignedUrls(paths, 60 * 60 * 24);
      if (signed) list.forEach((d, i) => { d.signedUrl = signed[i]?.signedUrl ?? undefined; });
    }
    setDocsOf({ clientId, rows: list, failed: !!error });
  }, [userId, supabase]);

  // ΟΙ ΑΠΟΘΗΚΕΥΜΕΝΟΙ ΣΥΝΔΕΣΜΟΙ ΚΡΥΒΟΝΤΑΝ ΑΘΟΡΥΒΑ. Σε αποτυχία η λίστα άδειαζε,
  // οπότε το κουτί των ροών εξαφανιζόταν ολόκληρο μαζί με την κατάσταση του
  // τελευταίου συγχρονισμού: ο οικοδεσπότης δεν έβλεπε ούτε τη ροή που έχει
  // σταματήσει να φέρνει κρατήσεις ούτε ότι υπάρχει ήδη σύνδεσμος για το
  // ακίνητο, οπότε αποθήκευε δεύτερο σύνδεσμο στα τυφλά. Τώρα κρατάμε ό,τι
  // διαβάστηκε από πριν και σημαδεύουμε την αποτυχία, ώστε να τη δει.
  const loadIcalFeeds = useCallback(async () => {
    const { data, error } = await supabase.from('ical_feeds').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    setIcalFeedsFailed(!!error);
    if (error) return;
    setIcalFeeds((data || []) as IcalFeed[]);
  }, [userId, supabase]);

  // Τρεις φορτώσεις που ξεκινούν μαζί, δηλωμένες ως μία.
  const loadAll = useCallback((turn: LoadTurn) => Promise.all([load(turn), loadStays(turn), loadIcalFeeds()]), [load, loadStays, loadIcalFeeds]);
  // ΜΙΑ ΡΙΠΗ, ΜΙΑ ΦΟΡΤΩΣΗ. Η εισαγωγή iCal γράφει τις κρατήσεις σε παρτίδες και
  // κάθε γραμμή φέρνει δικό της συμβάν `client_stays`: εκατό κρατήσεις ήταν
  // εκατό φορτώσεις διαμονών, με όποια απαντούσε τελευταία να γράφει. Τώρα τα
  // συμβάντα συγχωνεύονται (useLoad, ~300ms) και η παλιά απάντηση δεν γράφει.
  const reloadAll = useLoad(loadAll);
  // Μετά από ενέργεια του χρήστη: αμέσως, μέσα στην ίδια αρίθμηση.
  const refresh = useCallback(() => { void reloadAll({ immediate: true }); }, [reloadAll]);

  // Ζωντανή σύνδεση: πελάτες, διαμονές, σημειώσεις
  useEffect(() => {
    const ch = supabase.channel('clients-crm-' + userId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients', filter: `user_id=eq.${userId}` }, () => { void reloadAll(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_stays', filter: `user_id=eq.${userId}` }, () => { void reloadAll(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_notes', filter: `user_id=eq.${userId}` }, () => { if (openIdRef.current) loadNotes(openIdRef.current); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_documents', filter: `user_id=eq.${userId}` }, () => { if (openIdRef.current) loadDocs(openIdRef.current); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ical_feeds', filter: `user_id=eq.${userId}` }, () => loadIcalFeeds())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_properties', filter: `user_id=eq.${userId}` }, () => { void reloadAll(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, reloadAll, loadNotes, loadDocs, loadIcalFeeds, supabase]);

  // ΤΟ ΑΔΕΙΟ ΔΕΝ ΑΠΟΘΗΚΕΥΕΤΑΙ, ΠΡΟΚΥΠΤΕΙ. Εδώ ένα effect άδειαζε τέσσερις
  // καταστάσεις σε κάθε αλλαγή πελάτη — και δεν προλάβαινε: μια αργοπορημένη
  // απάντηση για τον ΠΡΟΗΓΟΥΜΕΝΟ πελάτη γραφόταν πάνω στον νέο, δηλαδή οι
  // σημειώσεις και τα έγγραφα ενός επισκέπτη εμφανίζονταν κάτω από το όνομα
  // άλλου. Τώρα κάθε λίστα κουβαλά τον πελάτη της και ταιριάζει ή αγνοείται.
  const notes = notesOf?.clientId === openId ? notesOf.rows : [];
  const docs  = docsOf?.clientId  === openId ? docsOf.rows  : [];
  const docMsg = docMsgOf?.clientId === openId ? docMsgOf.msg : null;
  // «Δεν ξέρουμε»: η ανάγνωση του ανοιχτού επισκέπτη απάντησε με σφάλμα.
  const notesFailed = notesOf?.clientId === openId && notesOf?.failed === true;
  const docsFailed  = docsOf?.clientId  === openId && docsOf?.failed  === true;
  const docKind = docKindOf?.clientId === openId ? docKindOf.kind : 'other';
  // Οι σημειώσεις και τα έγγραφα του ανοιχτού πελάτη. Χωρίς ανοιχτό πελάτη δεν
  // υπάρχει τι να φορτωθεί και η υπόσχεση λύνεται αμέσως.
  const loadOpen = useCallback(() => (openId ? Promise.all([loadNotes(openId), loadDocs(openId)]) : Promise.resolve()), [openId, loadNotes, loadDocs]);
  useLoad(loadOpen);

  const propsByClient = useMemo(() => {
    const m = new Map<string, PropRow[]>();
    props.forEach(p => { if (p.client_id) { const a = m.get(p.client_id) || []; a.push(p); m.set(p.client_id, a); } });
    return m;
  }, [props]);
  const propName = useCallback((id: string | null) => (id ? (props.find(p => p.id === id)?.name || id) : ''), [props]);

  const staysByClient = useMemo(() => {
    const m = new Map<string, Stay[]>();
    stays.forEach(s => { const a = m.get(s.client_id) || []; a.push(s); m.set(s.client_id, a); });
    return m;
  }, [stays]);
  const statsByClient = useMemo(() => {
    const m = new Map<string, ReturnType<typeof clientStats>>();
    staysByClient.forEach((arr, id) => m.set(id, clientStats(arr)));
    return m;
  }, [staysByClient]);
  // Όλες οι διαμονές του χρήστη, υπολογισμένες μία φορά.
  const allStays = useMemo(() => [...staysByClient.values()].flat(), [staysByClient]);

  // Αδήλωτες διαμονές ανά επισκέπτη, το μόνο σήμα που αξίζει θέση στην κάρτα.
  // Μόνο όσες τελείωσαν: η κράτηση του Δεκεμβρίου δεν δηλώνεται τον Σεπτέμβριο.
  const undeclaredByClient = useMemo(() => {
    const m = new Map<string, number>();
    stays.forEach(s => { if (awaitsDeclaration(s)) m.set(s.client_id, (m.get(s.client_id) || 0) + 1); });
    return m;
  }, [stays]);

  const filtered = useMemo(() => clients.filter(c => {
    if (!clientMatches(c, search)) return false;
    if (undeclaredOnly && !(undeclaredByClient.get(c.id) || 0)) return false;
    return true;
  }), [clients, search, undeclaredOnly, undeclaredByClient]);

  // ΤΑ KPI. Δεν υπάρχει «Επαναλαμβανόμενοι» (ο επισκέπτης του Airbnb έρχεται μία
  // φορά, το νούμερο θα ήταν 0 για πάντα) ούτε «Επισήμανση/μαύρη λίστα».
  // Υπάρχει το μόνο που κοστίζει χρήματα σήμερα: οι αδήλωτες διαμονές.
  // ΤΟ ΜΗΔΕΝ ΔΕΝ ΕΙΝΑΙ ΕΠΙΤΕΥΓΜΑ. Οι αδήλωτες διαμονές έβγαιναν πράσινες όταν
  // ήταν μηδέν — δηλαδή η οθόνη επιβράβευε τον χρήστη που δεν έχει καταχωρήσει
  // ακόμη καμία κράτηση. Χρώμα μπαίνει μόνο όταν υπάρχει κάτι να γίνει.
  // Και καμία πλακέτα δεν λέει το ίδιο μηδενικό δύο φορές: το «Νύχτες 0» με
  // υπότιτλο «0 διαμονές» ήταν η ίδια πληροφορία, γραμμένη δύο φορές.
  const kpis = useMemo(() => {
    const tot = totals(stays);
    const plural = (n: number) => (n === 1 ? 'διαμονή' : 'διαμονές');
    return [
      {
        label: 'Επισκέπτες',
        value: String(clients.length),
        sub: tot.count > 0 ? `${tot.count} ${plural(tot.count)} συνολικά` : 'Καμία καταχωρημένη κράτηση',
      },
      {
        // ΕΚΤΙΜΗΣΗ ΔΕΝ ΛΕΓΕΤΑΙ «ΔΗΛΩΤΕΑ». Με διαμονές χωρίς οριστικό ποσό το
        // σύνολο περιέχει ποσά που δεν ξέρουμε αν είναι ακαθάριστα ή καθαρά
        // (το λέει και η προειδοποίηση πιο κάτω), άρα δεν είναι ποσό προς δήλωση.
        label: tot.unresolved > 0 ? 'Ακαθάριστα, ενδεικτικά' : 'Δηλωτέα ακαθάριστα',
        value: fe(tot.revenue),
        sub: tot.unresolved > 0 ? `${tot.unresolved} ${plural(tot.unresolved)} με απροσδιόριστο ποσό` : 'Χωρίς το τέλος ανθεκτικότητας',
        tone: (tot.unresolved > 0 ? 'warning' : 'neutral') as 'warning' | 'neutral',
      },
      {
        label: 'Αδήλωτες διαμονές',
        value: String(tot.undeclared),
        // Μετρά όσες τελείωσαν· οι επερχόμενες λέγονται δίπλα, όχι μέσα στο νούμερο.
        sub: tot.upcoming > 0
          ? `Χωρίς δήλωση στην ΑΑΔΕ · +${tot.upcoming} ${tot.upcoming === 1 ? 'επερχόμενη' : 'επερχόμενες'}`
          : 'Χωρίς δήλωση στο μητρώο της ΑΑΔΕ',
        // ═══ ΟΥΤΕ ΚΟΚΚΙΝΟ ΟΥΤΕ ΚΙΤΡΙΝΟ: ΤΟ ΓΚΡΙ ΤΗΣ ΕΦΑΡΜΟΓΗΣ ═══════════════
        // Πρώτα ήταν κόκκινο, δηλαδή «κάτι έσπασε» με το χρώμα που αλλού
        // σημαίνει ακριβώς αυτό. Μετά κίτρινο, που δεν έσπαγε τίποτα αλλά
        // έβαζε τρίτο χρώμα σε μια οθόνη χτισμένη σε ένα μελάνι και ένα
        // γαλάζιο: το πλακίδιο τραβούσε το μάτι περισσότερο από τα «Δηλωτέα
        // ακαθάριστα» δίπλα του, που είναι το νούμερο της χρονιάς.
        //
        // Η ΠΛΗΡΟΦΟΡΙΑ ΕΙΝΑΙ Ο ΑΡΙΘΜΟΣ, ΟΧΙ Ο ΤΟΝΟΣ. «8 αδήλωτες διαμονές» με
        // υπότιτλο για τη δήλωση στην ΑΑΔΕ λέει τα πάντα· ένα οκτώ δεν
        // γίνεται πιο επείγον επειδή είναι πορτοκαλί. Το χρώμα φυλάγεται για
        // την προθεσμία που ΤΡΕΧΕΙ, όχι για το πλήθος που στέκει.
        tone: 'neutral' as const,
      },
      {
        label: 'Νύχτες',
        value: String(tot.nights),
        sub: tot.count > 0 ? `Μέση διάρκεια ${(tot.nights / tot.count).toFixed(1).replace('.', ',')} νύχτες` : 'Χωρίς νύχτες ακόμη',
      },
    ];
  }, [clients, stays]);

  // ── Φόρμα πελάτη ──────────────────────────────────────────────────────────
  const openNew = () => { setEditing(null); setForm(emptyForm()); setModalOpen(true); };
  const openEdit = (c: Client) => {
    setEditing(c);
    setForm({ full_name: c.full_name, phone: c.phone || '', email: c.email || '', notes: c.notes || '' });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.full_name.trim()) return;
    // Στιγμιότυπο της φόρμας ΠΡΙΝ από οποιοδήποτε await. Το native confirm πάγωνε
    // τη σελίδα, άρα η φόρμα ΔΕΝ μπορούσε να αλλάξει όσο ρωτούσαμε. Ο δικός μας
    // διάλογος δεν παγώνει τίποτα: χωρίς στιγμιότυπο θα αποθηκευόταν ό,τι έγραψε
    // ο χρήστης ΜΕΤΑ τον έλεγχο διπλότυπου, δηλαδή άλλη εγγραφή από αυτή που
    // εγκρίθηκε. Και το setSaving μπαίνει ΠΡΙΝ την ερώτηση, ώστε το κουμπί
    // «Αποθήκευση» (disabled={saving}) να μη δέχεται δεύτερο πάτημα όσο περιμένει.
    const f = form;
    // Εντοπισμός διπλότυπου σε νέα εγγραφή: ίδιο τηλέφωνο. (Το ΑΦΜ έφυγε ως
    // κριτήριο μαζί με το πεδίο: δεν ζητάμε ΑΦΜ από επισκέπτη Airbnb.)
    if (!editing) {
      const np = normalizePhone(f.phone);
      const dup = np.length >= 8 ? clients.find(c => normalizePhone(c.phone) === np) : undefined;
      if (dup) {
        setSaving(true);
        const ok = await confirmDialog(`Υπάρχει ήδη επισκέπτης με αυτό το τηλέφωνο: «${dup.full_name}». Θέλεις σίγουρα να δημιουργήσεις νέα εγγραφή;`);
        if (!ok) { setSaving(false); return; }
      }
    }
    setSaving(true);
    // Νέος επισκέπτης: πρώτα η σύμβαση επεξεργασίας (lib/legal/dpa.ts). Οι Όροι
    // λένε «χωρίς αποδοχή τα στοιχεία δεν αποθηκεύονται» και εδώ αποθηκεύονταν.
    // Η σύμβαση των Όρων δεν ονομάζει ακόμη τους επισκέπτες στις κατηγορίες
    // υποκειμένων: η πύλη μένει, η επέκταση της σύμβασης είναι απόφαση του
    // ιδιοκτήτη του έργου (βλ. DpaModal.tsx).
    if (!editing && !(await ensureDpa(supabase))) { setSaving(false); notifyError('Η καταχώρηση δεν αποθηκεύτηκε: χρειάζεται αποδοχή της σύμβασης επεξεργασίας.'); return; }
    const payload = {
      user_id: userId, type: 'client', full_name: f.full_name.trim(),
      phone: f.phone.trim() || null, email: f.email.trim() || null,
      notes: f.notes.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const ok = await saved('Η καταχώρηση δεν αποθηκεύτηκε', editing
      ? supabase.from('clients').update(payload).eq('id', editing.id)
      : supabase.from('clients').insert(payload));
    setSaving(false);
    if (!ok) return;
    setModalOpen(false); refresh();
  };

  const del = async (c: Client) => {
    // ΤΟ ΜΗΝΥΜΑ ΛΕΕΙ ΤΙ ΧΑΝΕΤΑΙ. Η διαγραφή παίρνει μαζί της τις διαμονές
    // (δηλαδή έσοδα που μετρούν στα σύνολα) και τα έγγραφα. Το «Να διαγραφεί
    // η καταχώρηση;» δεν το έλεγε.
    if (!(await confirmDialog(`Οριστική διαγραφή «${c.full_name}»; Διαγράφονται μαζί οι διαμονές του με τα έσοδά τους και τα έγγραφά του, όπως ταυτότητα ή διαβατήριο.`, { tone: 'negative', confirmLabel: 'Οριστική διαγραφή' }))) return;
    // ΠΡΩΤΑ ΤΑ ΑΡΧΕΙΑ. Οι εγγραφές των εγγράφων σβήνονται με τον πελάτη, τα
    // αρχεία όμως ζουν στον χώρο αποθήκευσης και έμεναν εκεί για πάντα: ένα
    // διαβατήριο χωρίς κάτοχο στην οθόνη, που κανείς δεν μπορούσε να βρει.
    const folder = `${userId}/clients/${c.id}`;
    const { data: files, error: lsErr } = await supabase.storage.from('property-files').list(folder, { limit: 1000 });
    // Αν δεν ξέρουμε ποια αρχεία υπάρχουν, δεν διαγράφουμε τον πελάτη: θα
    // έμεναν ακριβώς τα αρχεία που αυτή η σειρά υπάρχει για να σβήσει.
    if (lsErr) { notifyError(failed('Τα έγγραφα του επισκέπτη δεν βρέθηκαν, η διαγραφή σταμάτησε', lsErr)); return; }
    if (files && files.length > 0) {
      const { error: rmErr } = await supabase.storage.from('property-files').remove(files.map(x => `${folder}/${x.name}`));
      if (rmErr) { notifyError(failed('Τα έγγραφα του επισκέπτη δεν διαγράφηκαν', rmErr)); return; }
    }
    if (!await saved('Η καταχώρηση δεν διαγράφηκε', supabase.from('clients').delete().eq('id', c.id))) return;
    if (openId === c.id) setOpenId(null);
    refresh();
  };

  // Pre-check-in: φόρτωση υποβολών του ανοιχτού πελάτη + δημιουργία/αντιγραφή συνδέσμου
  const checkins = checkinsOf?.clientId === openId ? checkinsOf.rows : [];
  const checkinCopied = copiedFor !== null && copiedFor === openId;
  useEffect(() => {
    if (!openId) return;
    supabase.from('guest_checkins').select('id,full_name,created_at,id_number,nationality,birth_date,phone,arrival_date,guests_count,accepts_rules').eq('client_id', openId).order('created_at', { ascending: false }).then(({ data }) => setCheckinsOf({ clientId: openId, rows: (data || []) as Checkin[] }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);
  // Ο ΣΥΝΔΕΣΜΟΣ ΚΙ Η ΛΗΞΗ ΤΟΥ ΖΟΥΝ ΣΤΟ lib/data/checkinLink.ts, ΜΑΖΙ. Εδώ ήταν
  // γραμμένο το `upsert` με το χέρι κι η διεύθυνση από τον περιηγητή· ο βοηθός
  // είχε το ΙΔΙΟ ζευγάρι σφαλμάτων, αντιγραμμένο. Το γιατί είναι εκεί.
  const copyCheckinLink = async () => {
    if (!openId) return;
    // Ο σύνδεσμος ζητά από τον επισκέπτη αριθμό ταυτότητας και ημερομηνία γέννησης.
    if (!(await ensureDpa(supabase))) { notifyError('Ο σύνδεσμος προ-άφιξης δεν δημιουργήθηκε: χρειάζεται αποδοχή της σύμβασης επεξεργασίας.'); return; }
    const propId = (propsByClient.get(openId) || [])[0]?.id || null;
    const data = await savedData<{ token: string }>('Ο σύνδεσμος προ-άφιξης δεν δημιουργήθηκε',
      checkinLink.issue(supabase, userId, openId, propId, new Date()));
    if (!data?.token) return;
    // «ΑΝΤΙΓΡΑΦΗΚΕ» ΜΟΝΟ ΟΤΑΝ ΑΝΤΙΓΡΑΦΤΗΚΕ. Το `catch` κατάπινε την αποτυχία
    // του προχείρου κι το κουμπί έλεγε «Ο σύνδεσμος αντιγράφηκε» με άδειο
    // πρόχειρο — σε Safari χωρίς άδεια, ή σε σελίδα χωρίς ασφαλές πλαίσιο, ο
    // ιδιοκτήτης πήγαινε να επικολλήσει στο WhatsApp κι δεν είχε τίποτα.
    try {
      await navigator.clipboard.writeText(checkinLink.checkinUrl(data.token));
    } catch {
      notifyError('Ο σύνδεσμος δεν μπήκε στο πρόχειρο. Άνοιξε την καρτέλα του πελάτη κι αντίγραψέ τον από εκεί.');
      return;
    }
    setCopiedFor(openId); setTimeout(() => setCopiedFor(null), 2600);
  };

  // Εισαγωγή κράτησης από email: ανάλυση με AI → πρόχειρη διαμονή προς αποθήκευση.
  const parseEmail = async () => {
    const text = emailText.trim();
    if (text.length < 20) { setEmailErr('Επικόλλησε το κείμενο του email κράτησης.'); return; }
    setEmailBusy(true); setEmailErr('');
    try {
      const res = await fetch('/api/anthropic', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-5', max_tokens: 500,
          // Ο ΕΙΣΑΓΩΓΕΑΣ ΖΗΤΑ ΠΛΕΟΝ ΤΡΙΑ ΞΕΧΩΡΙΣΤΑ ΠΟΣΑ. Πριν ζητούσε ένα
          // («το ποσό που εισπράττει ο οικοδεσπότης — payout») και το έγραφε στο
          // `total`, το οποίο η φορολογική μηχανή διάβαζε ως ακαθάριστο. Το ίδιο
          // πεδίο σήμαινε δύο πράγματα και η διαφορά ήταν ~15% του φόρου.
          system: `Από αυτό το email κράτησης (Airbnb/Booking/άλλο) εξάγαγε τα στοιχεία. Επέστρεψε ΜΟΝΟ valid JSON χωρίς markdown:
{"guest_name":"","check_in":"YYYY-MM-DD","check_out":"YYYY-MM-DD","gross_guest_paid":0,"platform_fee":0,"climate_levy":0,"channel":"airbnb|booking|direct|other"}
Κανόνες ποσών, ΜΗΝ τα μπερδέψεις:
- gross_guest_paid = το ΣΥΝΟΛΟ που πλήρωσε ο επισκέπτης (guest total / "Σύνολο επισκέπτη"), πριν αφαιρεθεί οποιαδήποτε προμήθεια.
- platform_fee = η προμήθεια/service fee που κράτησε η πλατφόρμα από τον οικοδεσπότη.
- climate_levy = τέλος ανθεκτικότητας στην κλιματική κρίση / climate crisis resilience fee, αν αναφέρεται ξεχωριστά.
Αν κάποιο ποσό ΔΕΝ φαίνεται καθαρά στο email, βάλε 0 — ΜΗΝ το υπολογίσεις και μην το μαντέψεις.
Αν λείπει κείμενο, βάλε "".`,
          messages: [{ role: 'user', content: [{ type: 'text', text: text.slice(0, 8000) }] }],
        }),
      });
      // ΤΙ ΕΚΡΥΒΕ ΤΟ `(c: any)`: το `res.json()` δίνει `any`, οπότε ΟΛΗ η αλυσίδα
      // από κάτω ήταν ανέλεγκτη — και το `p` που έβγαινε από το `JSON.parse` μαζί.
      // Το `p.guest_name` και τα τρία ποσά είναι κείμενο που έγραψε ΤΟ ΜΟΝΤΕΛΟ:
      // κανένα δεν είναι εγγυημένο ούτε στον τύπο ούτε στην ύπαρξη. Αν το μοντέλο
      // επέστρεφε π.χ. `{"gross_guest_paid": {"amount": 420}}`, το `String(...)`
      // έγραφε «[object Object]» στο πεδίο ποσού και από εκεί σε `parseFloat` → 0,
      // δηλαδή κράτηση με μηδενικό ακαθάριστο μέσα στη φορολογική βάση.
      const data: unknown = await res.json();
      if (!res.ok) {
        const msg = isRecord(data) ? data.error : undefined;
        setEmailErr(typeof msg === 'string' && msg ? msg : 'Η ανάλυση του email δεν ολοκληρώθηκε. Δοκίμασε ξανά.'); setEmailBusy(false); return;
      }
      const content: unknown = isRecord(data) ? data.content : undefined;
      const blocks: readonly unknown[] = Array.isArray(content) ? content : [];
      const textBlock = blocks.find((c): c is { type: string; text?: string } => isRecord(c) && c.type === 'text');
      const raw = (typeof textBlock?.text === 'string' ? textBlock.text : '{}').replace(/```json?|```/g, '').trim();
      const parsed: unknown = JSON.parse(raw);
      const p: Record<string, unknown> = isRecord(parsed) ? parsed : {};
      // Κείμενο μόνο αν είναι όντως κείμενο· ποσό μόνο αν είναι αριθμός ή κείμενο.
      const str = (k: string): string => { const v = p[k]; return typeof v === 'string' ? v : ''; };
      const amt = (k: string): string => { const v = p[k]; return (typeof v === 'number' || typeof v === 'string') && v ? String(v) : ''; };
      setEmailDraft({
        name: str('guest_name'), check_in: str('check_in'), check_out: str('check_out'),
        gross: amt('gross_guest_paid'), fee: amt('platform_fee'), levy: amt('climate_levy'),
        channel: str('channel') || 'other',
      });
    } catch { setEmailErr('Δεν ήταν δυνατή η ανάλυση. Δοκίμασε ξανά ή καταχώρησε χειροκίνητα.'); }
    setEmailBusy(false);
  };
  const saveEmailStay = async () => {
    if (!emailDraft || !emailDraft.name.trim()) return;
    setEmailBusy(true);
    const name = emailDraft.name.trim();
    let clientId = clients.find(c => c.full_name.trim().toLowerCase() === name.toLowerCase())?.id || null;
    if (!clientId) {
      if (!(await ensureDpa(supabase))) { setEmailErr('Η κράτηση δεν αποθηκεύτηκε: χρειάζεται αποδοχή της σύμβασης επεξεργασίας.'); setEmailBusy(false); return; }
      const data = await savedData<{ id?: string }>('Ο επισκέπτης δεν δημιουργήθηκε',
        supabase.from('clients').insert({ user_id: userId, type: 'client', full_name: name }).select('id').maybeSingle());
      clientId = data?.id || null;
    }
    if (clientId) {
      const nights = stayNights(emailDraft.check_in, emailDraft.check_out) || null;
      const gross = parseFloat(emailDraft.gross) || 0;
      const fee = parseFloat(emailDraft.fee) || 0;
      const levy = parseFloat(emailDraft.levy) || 0;
      await saved('Η κράτηση δεν αποθηκεύτηκε', stayStore.add(supabase, [{
        user_id: userId, client_id: clientId, check_in: emailDraft.check_in || null, check_out: emailDraft.check_out || null,
        nights, channel: emailDraft.channel || null,
        gross_guest_paid: gross || null, platform_fee: fee || null, climate_levy: levy || null,
        // Το `total` είναι ΠΑΡΑΓΩΓΟ: το δηλωτέο ακαθάριστο (τι πλήρωσε ο
        // επισκέπτης μείον το τέλος, που δεν είναι έσοδο του ιδιοκτήτη).
        total: gross ? Math.max(0, gross - levy) : null,
        amount_basis: gross ? 'gross' : 'unknown',
      }]));
    }
    setEmailBusy(false); setEmailOpen(false); setEmailText(''); setEmailDraft(null);
    refresh();
  };

  const linkProperty = async (clientId: string, propId: string) => {
    if (await saved('Το ακίνητο δεν συνδέθηκε',
      properties.update(supabase, propId, { client_id: propId ? clientId : null }, userId))) refresh();
  };
  const unlinkProperty = async (propId: string) => {
    if (await saved('Το ακίνητο δεν αποσυνδέθηκε',
      properties.update(supabase, propId, { client_id: null }, userId))) refresh();
  };

  // ── Διαμονές ──────────────────────────────────────────────────────────────
  const openStayNew = () => { setStayForm(emptyStay()); setStayFormOpen(true); };
  const openStayEdit = (s: Stay) => {
    setStayForm({
      id: s.id, property_id: s.property_id || '', check_in: s.check_in || '', check_out: s.check_out || '',
      nights: s.nights != null ? String(s.nights) : '', guests: s.guests != null ? String(s.guests) : '',
      nightly_rate: s.nightly_rate != null ? String(s.nightly_rate) : '',
      channel: s.channel || 'direct',
      gross_guest_paid: s.gross_guest_paid != null ? String(s.gross_guest_paid) : '',
      platform_fee: s.platform_fee != null ? String(s.platform_fee) : '',
      climate_levy: s.climate_levy != null ? String(s.climate_levy) : '',
      legacyTotal: s.total != null ? String(s.total) : '',
      basis: amountBasis(s),
      declared: isDeclared(s), declared_at: (s.declared_at || '').slice(0, 10),
      damages: !!s.damages,
      damage_cost: s.damage_cost != null ? String(s.damage_cost) : '',
      damage_note: s.damage_note || '', damage_item_id: s.damage_item_id || '',
      notes: s.notes || '',
    });
    setStayFormOpen(true);
  };
  const onStayDates = (patch: Partial<StayForm>) => setStayForm(f => {
    const nf = { ...f, ...patch };
    const n = stayNights(nf.check_in, nf.check_out);
    return { ...nf, nights: n ? String(n) : nf.nights };
  });

  // Το τέλος ανθεκτικότητας ανά διανυκτέρευση, από τους συντελεστές της ΑΑΔΕ και
  // τον τύπο/μέγεθος του ΣΥΓΚΕΚΡΙΜΕΝΟΥ ακινήτου. Πρόταση, όχι επιβολή: ο χρήστης
  // το διορθώνει, γιατί τα ακριβή ποσά και οι μήνες ορίζονται από την ΑΑΔΕ.
  const suggestLevy = useCallback((f: StayForm): number => {
    const nights = parseInt(f.nights, 10) || stayNights(f.check_in, f.check_out);
    if (!nights || !f.check_in) return 0;
    const p = props.find(x => x.id === f.property_id);
    const isHouse = isHouseType(p?.prop_type);
    const r = climateLevyRates(p?.sqm ?? null, isHouse);
    // Ανά νύχτα, με τον μήνα της κάθε νύχτας (μια διαμονή μπορεί να αλλάζει περίοδο).
    let sum = 0;
    const d = new Date(f.check_in + 'T00:00:00Z');
    for (let i = 0; i < nights; i++) {
      sum += isHighSeasonMonth(d.getUTCMonth()) ? r.high : r.low;
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return sum;
  }, [props]);

  const saveStay = async () => {
    if (!openId) return;
    setSavingStay(true);
    const num = (s: string) => { const n = parseFloat(s); return isNaN(n) ? null : n; };
    const nights = parseInt(stayForm.nights, 10) || stayNights(stayForm.check_in, stayForm.check_out) || null;
    const rate = num(stayForm.nightly_rate);
    const gross = num(stayForm.gross_guest_paid);
    const levy = num(stayForm.climate_levy);
    const fee = num(stayForm.platform_fee);
    // ΤΟ `total` ΕΙΝΑΙ ΠΑΡΑΓΩΓΟ, ΔΕΝ ΤΟ ΠΛΗΚΤΡΟΛΟΓΕΙ ΚΑΝΕΙΣ ΠΙΑ.
    // Όταν ξέρουμε τι πλήρωσε ο επισκέπτης, το `total` γίνεται το δηλωτέο
    // ακαθάριστο (χωρίς το τέλος ανθεκτικότητας, που δεν είναι έσοδο του
    // ιδιοκτήτη) και σημαίνεται ρητά ως 'gross'. Αν δεν το ξέρουμε, κρατάμε ό,τι
    // υπήρχε με τη βάση που δήλωσε ο χρήστης — κανένα ποσό δεν χάνεται.
    const derivedTotal = gross != null && gross > 0
      ? Math.max(0, gross - (levy || 0))
      : (num(stayForm.legacyTotal) ?? ((nights || 0) * (rate || 0) || null));
    const basis: AmountBasis = gross != null && gross > 0 ? 'gross' : stayForm.basis;
    const payload = {
      user_id: userId, client_id: openId, property_id: stayForm.property_id || null,
      check_in: stayForm.check_in || null, check_out: stayForm.check_out || null, nights,
      guests: parseInt(stayForm.guests, 10) || null, nightly_rate: rate,
      total: derivedTotal, amount_basis: basis,
      gross_guest_paid: gross, platform_fee: fee, climate_levy: levy,
      declared_at: stayForm.declared
        ? new Date((stayForm.declared_at || todayStr()) + 'T12:00:00Z').toISOString()
        : null,
      channel: stayForm.channel || null, damages: stayForm.damages,
      damage_cost: stayForm.damages ? num(stayForm.damage_cost) : null,
      damage_note: stayForm.damages ? (stayForm.damage_note.trim() || null) : null,
      damage_item_id: stayForm.damages ? (stayForm.damage_item_id || null) : null,
      notes: stayForm.notes.trim() || null,
    };
    const ok = await saved('Η διαμονή δεν αποθηκεύτηκε', stayForm.id
      ? stayStore.update(supabase, stayForm.id, payload)
      : stayStore.add(supabase, [payload]));
    setSavingStay(false);
    if (!ok) return;
    setStayFormOpen(false); refresh();
  };
  const delStay = async (s: Stay) => {
    if (!(await confirmDialog('Να διαγραφεί η διαμονή;', { tone: 'negative', confirmLabel: 'Διαγραφή' }))) return;
    if (await saved('Η διαμονή δεν διαγράφηκε', stayStore.remove(supabase, s.id))) refresh();
  };
  // Ένα κλικ από τη λίστα: δηλώθηκε / δεν δηλώθηκε. Η δήλωση βραχυχρόνιας
  // διαμονής είναι μία ανά κράτηση και η προθεσμία τρέχει — δεν πρέπει να
  // απαιτεί άνοιγμα φόρμας.
  const toggleDeclared = async (s: Stay) => {
    if (await saved('Η δήλωση της διαμονής δεν άλλαξε',
      stayStore.update(supabase, s.id, { declared_at: isDeclared(s) ? null : new Date().toISOString() }))) refresh();
  };

  // ── Σχόλια ────────────────────────────────────────────────────────────────
  const saveNote = async () => {
    if (!openId || !noteForm.body.trim()) return;
    if (!await saved('Το σχόλιο δεν αποθηκεύτηκε',
      supabase.from('client_notes').insert({ user_id: userId, client_id: openId, kind: noteForm.kind, body: noteForm.body.trim() }))) return;
    setNoteForm({ kind: 'note', body: '' }); loadNotes(openId);
  };
  const delNote = async (n: Note) => {
    if (await saved('Το σχόλιο δεν διαγράφηκε', supabase.from('client_notes').delete().eq('id', n.id)) && openId) loadNotes(openId);
  };

  // ── Έγγραφα πελάτη ────────────────────────────────────────────────────────
  const onDocFile = async (file: File | null | undefined) => {
    if (!file || !openId) return;
    // Ταυτότητα ή διαβατήριο επισκέπτη: στοιχεία τρίτου, άρα πρώτα η σύμβαση. Το
    // πεδίο αρχείου αδειάζει, ώστε το ίδιο αρχείο να ξαναδιαλέγεται μετά το «Όχι τώρα».
    const cid = openId;
    if (!(await ensureDpa(supabase))) { setDocMsgOf({ clientId: cid, msg: { text: 'Το έγγραφο δεν ανέβηκε: χρειάζεται αποδοχή της σύμβασης επεξεργασίας.', error: true } }); if (docFileRef.current) docFileRef.current.value = ''; return; }
    setDocBusy(true); setDocMsgOf(null);
    const safe = file.name.replace(/[^\w.\-]+/g, '_');
    const path = `${userId}/clients/${openId}/${Date.now()}_${safe}`;
    const { error: upErr } = await supabase.storage.from('property-files').upload(path, file, { upsert: false, contentType: file.type || undefined });
    if (upErr) { setDocMsgOf({ clientId: openId, msg: { text: failed('Το έγγραφο δεν ανέβηκε', upErr), error: true } }); setDocBusy(false); return; }
    const { error: insErr } = await supabase.from('client_documents').insert({
      user_id: userId, client_id: openId, name: file.name, file_path: path,
      mime: file.type || null, size: file.size, kind: docKind,
    });
    if (insErr) {
      await supabase.storage.from('property-files').remove([path]);
      setDocMsgOf({ clientId: openId, msg: { text: failed('Το έγγραφο δεν αποθηκεύτηκε', insErr), error: true } }); setDocBusy(false); return;
    }
    setDocBusy(false); setDocMsgOf({ clientId: openId, msg: { text: 'Το έγγραφο προστέθηκε' } });
    setTimeout(() => setDocMsgOf(null), 3000);
    if (docFileRef.current) docFileRef.current.value = '';
    loadDocs(openId);
  };
  const delDoc = async (d: ClientDoc) => {
    if (!(await confirmDialog('Να διαγραφεί οριστικά το έγγραφο;', { tone: 'negative', confirmLabel: 'Διαγραφή' }))) return;
    await supabase.storage.from('property-files').remove([d.file_path]);
    if (await saved('Το έγγραφο δεν διαγράφηκε', supabase.from('client_documents').delete().eq('id', d.id)) && openId) loadDocs(openId);
  };

  // ── Εισαγωγή iCal ─────────────────────────────────────────────────────────
  const openIcal = () => {
    setIcalText(''); setIcalUrl(''); setIcalEvents(null); setIcalMsg(null);
    setIcalChannel('airbnb'); setIcalIncludeBlocked(false);
    setIcalPropertyId(props[0]?.id || '');
    setIcalOpen(true);
  };
  // Χειροκίνητη ανάλυση επικολλημένου .ics (τοπικά, χωρίς δίκτυο).
  const parseIcalInput = () => {
    setIcalMsg(null); setIcalEvents(null);
    const text = icalText.trim();
    if (!text) { setIcalMsg({ text: 'Επικόλλησε το περιεχόμενο του .ics ή χρησιμοποίησε τον σύνδεσμο παραπάνω.', error: true }); return; }
    const evs = parseICal(text);
    if (evs.length === 0) { setIcalMsg({ text: 'Δεν βρέθηκαν εγγραφές ημερολογίου στο κείμενο.', error: true }); return; }
    setIcalEvents(evs);
  };
  // Ανάκτηση από URL μέσω edge function (server-side fetch, παρακάμπτει το CORS).
  const fetchIcalFromUrl = async () => {
    const url = icalUrl.trim();
    if (!url) { setIcalMsg({ text: 'Δώσε τον σύνδεσμο iCal (URL).', error: true }); return; }
    setIcalBusy(true); setIcalMsg(null); setIcalEvents(null);
    const ch = guessChannel(url);
    if (ch !== 'other') setIcalChannel(ch);
    try {
      const { data, error } = await supabase.functions.invoke('ical-sync', { body: { action: 'preview', url } });
      if (error || !data?.ok) {
        // Το κείμενο του διακομιστή περνά μόνο όταν είναι ελληνικό· το αγγλικό
        // «non-2xx status code» της βιβλιοθήκης δεν φτάνει στον χρήστη.
        const detail = typeof data?.error === 'string' && /[Α-ώ]/.test(data.error) ? data.error : '';
        setIcalMsg({ text: `Το ημερολόγιο δεν ανακτήθηκε από τον σύνδεσμο${detail ? `: ${detail}` : ''}. Αν δεν έχει ενεργοποιηθεί ο αυτόματος συγχρονισμός, άνοιξε τον σύνδεσμο, αντίγραψε το .ics και επικόλλησέ το κάτω.`, error: true });
        setIcalBusy(false); return;
      }
      setIcalEvents((data.events || []) as ICalEvent[]);
      if (!data.events?.length) setIcalMsg({ text: 'Δεν βρέθηκαν κρατήσεις στο ημερολόγιο.', error: true });
    } catch (e) {
      setIcalMsg({ text: failed('Το ημερολόγιο δεν ανακτήθηκε', e), error: true });
    } finally { setIcalBusy(false); }
  };
  // Αποθήκευση συνδέσμου για αυτόματο συγχρονισμό + άμεσος πρώτος συγχρονισμός.
  const saveIcalFeed = async () => {
    const url = icalUrl.trim();
    if (!url || !icalPropertyId) { setIcalMsg({ text: 'Επίλεξε ακίνητο και δώσε τον σύνδεσμο iCal.', error: true }); return; }
    setIcalBusy(true); setIcalMsg(null);
    const { error } = await supabase.from('ical_feeds').upsert({
      user_id: userId, property_id: icalPropertyId, channel: icalChannel, url, include_blocked: icalIncludeBlocked, active: true,
    }, { onConflict: 'user_id,property_id,url' });
    if (error) { setIcalMsg({ text: failed('Ο σύνδεσμος δεν αποθηκεύτηκε', error), error: true }); setIcalBusy(false); return; }
    await loadIcalFeeds();
    setIcalBusy(false);
    setIcalMsg({ text: 'Ο σύνδεσμος αποθηκεύτηκε. Ο συγχρονισμός θα τρέχει αυτόματα· μπορείς και χειροκίνητα με «Συγχρονισμός τώρα».' });
    syncIcalNow(icalPropertyId);
  };
  // Άμεσος συγχρονισμός των αποθηκευμένων συνδέσμων (όλων ή ενός ακινήτου).
  const syncIcalNow = async (propertyId?: string) => {
    setIcalBusy(true); setIcalMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke('ical-sync', { body: { action: 'sync', propertyId } });
      if (error || !data?.ok) {
        setIcalMsg({ text: failed('Ο συγχρονισμός δεν ολοκληρώθηκε', error ?? undefined), error: true });
      } else {
        const failed = (data.results || []).filter((r: { ok: boolean }) => !r.ok).length;
        setIcalMsg({ text: `Συγχρονισμός ολοκληρώθηκε: ${data.inserted || 0} νέες κρατήσεις από ${data.feeds || 0} συνδέσμους${failed ? ` (${failed} με σφάλμα)` : ''}.`, error: failed > 0 });
        refresh();
      }
      loadIcalFeeds();
    } catch (e) {
      setIcalMsg({ text: failed('Ο συγχρονισμός δεν ολοκληρώθηκε', e), error: true });
    } finally { setIcalBusy(false); }
  };
  const delIcalFeed = async (f: IcalFeed) => {
    if (!(await confirmDialog('Να αφαιρεθεί ο σύνδεσμος αυτόματου συγχρονισμού; Οι ήδη εισαγμένες κρατήσεις παραμένουν.', { tone: 'negative', confirmLabel: 'Αφαίρεση' }))) return;
    if (await saved('Ο σύνδεσμος συγχρονισμού δεν αφαιρέθηκε',
      supabase.from('ical_feeds').delete().eq('id', f.id))) loadIcalFeeds();
  };
  // Συνθετικός πελάτης ανά κανάλι για τις εισαγόμενες κρατήσεις (το iCal δεν
  // περιέχει ταυτότητα επισκέπτη). Δημιουργείται μία φορά, με σαφή ονομασία.
  const ensureChannelClient = async (channel: 'airbnb' | 'booking' | 'other'): Promise<string | null> => {
    const name = channel === 'airbnb' ? 'Κρατήσεις Airbnb' : channel === 'booking' ? 'Κρατήσεις Booking' : 'Κρατήσεις καναλιού';
    const existing = clients.find(c => c.full_name === name && c.type === 'client');
    if (existing) return existing.id;
    // dpa-exempt: συγκεντρωτικός επισκέπτης καναλιού, χωρίς στοιχεία προσώπου
    const { data, error } = await supabase.from('clients').insert({
      user_id: userId, type: 'client', full_name: name,
      notes: 'Συγκεντρωτικός επισκέπτης για κρατήσεις που εισάγονται από iCal (χωρίς στοιχεία επισκέπτη).',
    }).select('id').single();
    if (error || !data) return null;
    return (data as { id: string }).id;
  };
  const importIcal = async () => {
    if (!icalEvents || !icalPropertyId) return;
    setIcalBusy(true); setIcalMsg(null);
    // ΙΔΙΟ ΦΙΛΤΡΟ ΜΕ ΤΟΝ ΣΥΓΧΡΟΝΙΣΜΟ, ΓΡΑΜΜΕΝΟ ΜΕ ΤΗΝ ΙΔΙΑ ΣΕΙΡΑ. Το
    // supabase/functions/ical-sync φιλτράρει `!d.cancelled && (include_blocked
    // || !d.blocked)`. Εδώ έλειπε το πρώτο σκέλος: το ίδιο ημερολόγιο έδινε
    // δύο εισαγωγές από επικόλληση και μία από συγχρονισμό.
    const drafts = icalToStayDrafts(icalEvents, { propertyId: icalPropertyId, channel: icalChannel })
      .filter(d => !d.cancelled && (icalIncludeBlocked || !d.blocked));
    if (drafts.length === 0) { setIcalMsg({ text: 'Δεν υπάρχουν κρατήσεις προς εισαγωγή (μόνο μπλοκαρίσματα ημερομηνιών).', error: true }); setIcalBusy(false); return; }
    const clientId = await ensureChannelClient(icalChannel);
    if (!clientId) { setIcalMsg({ text: failed('Ο επισκέπτης του καναλιού δεν δημιουργήθηκε'), error: true }); setIcalBusy(false); return; }
    // Αποφυγή διπλοεγγραφών: κλειδί ακίνητο+άφιξη+αναχώρηση απέναντι στις υπάρχουσες.
    const existingKeys = new Set(stays.map(s => stayKey(s.property_id || '', s.check_in || '', s.check_out || '')));
    const fresh = drafts.filter(d => !existingKeys.has(stayKey(d.property_id, d.check_in, d.check_out)));
    const skipped = drafts.length - fresh.length;
    if (fresh.length === 0) { setIcalMsg({ text: `Όλες οι ${drafts.length} κρατήσεις υπάρχουν ήδη. Καμία νέα εισαγωγή.` }); setIcalBusy(false); refresh(); return; }
    const rows = fresh.map(d => ({
      user_id: userId, client_id: clientId, property_id: d.property_id,
      check_in: d.check_in, check_out: d.check_out, nights: d.nights, channel: d.channel,
      notes: `Εισαγωγή iCal · ${d.uid}`,
    }));
    // Η παρτίδα των πενήντα ήταν γραμμένη εδώ· είναι κανόνας του πίνακα, όχι
    // της οθόνης και ζει πλέον στο στρώμα μαζί με τη διακοπή στο πρώτο σφάλμα.
    const { error } = await stayStore.addBatched(supabase, rows);
    if (error) { setIcalMsg({ text: failed('Οι κρατήσεις δεν αποθηκεύτηκαν', error), error: true }); setIcalBusy(false); refresh(); return; }
    const inserted = rows.length;
    setIcalBusy(false);
    setIcalMsg({ text: `Εισήχθησαν ${inserted} κρατήσεις${skipped > 0 ? ` · ${skipped} υπήρχαν ήδη` : ''}.` });
    setIcalEvents(null); setIcalText(''); setIcalUrl('');
    refresh();
  };

  // ── Εξαγωγή σε φύλλο Excel ─────────────────────────────────────────────────────────────
  // ΑΝΑ ΔΙΑΜΟΝΗ, όχι ανά πρόσωπο. Αυτό ζητά ο λογιστής: μία γραμμή ανά κράτηση,
  // με τα τρία ποσά χωριστά και ρητή ένδειξη πού το ποσό είναι απροσδιόριστο.
  // Ένα CSV προσώπων με εθνικότητες, ΑΦΜ και «μαύρη λίστα» δεν έλυνε τίποτα και
  // ήταν προσωπικά δεδομένα σε αρχείο που ταξιδεύει με email.
  const exportCsv = () => {
    const byId = new Map(clients.map(c => [c.id, c]));
    const rows = allStays
      .slice()
      .sort((a, b) => (b.check_in || '').localeCompare(a.check_in || ''))
      .map(s => {
        const g = declarableGross(s);
        const pay = hostPayout(s);
        const it = s.damage_item_id ? inv.find(i => i.id === s.damage_item_id) : undefined;
        return [
          byId.get(s.client_id)?.full_name || '', propName(s.property_id),
          s.check_in || '', s.check_out || '',
          s.nights ?? stayNights(s.check_in, s.check_out),
          s.channel ? (STAY_CHANNEL_LABELS[s.channel as keyof typeof STAY_CHANNEL_LABELS] || s.channel) : '',
          s.gross_guest_paid ?? '',
          s.climate_levy ?? '',
          s.platform_fee ?? '',
          g ?? stayTotal(s),
          g != null ? '' : 'ΑΠΡΟΣΔΙΟΡΙΣΤΟ, χρειάζεται επιβεβαίωση',
          pay ?? '',
          isDeclared(s) ? (s.declared_at || '').slice(0, 10) : 'ΑΔΗΛΩΤΗ',
          s.damages ? (s.damage_cost || 0) : '',
          it?.name || s.damage_note || '',
        ];
      });
    downloadTableXlsx(`Διαμονές ${todayStr()}`, {
      title: 'Διαμονές επισκεπτών',
      // Οι επικεφαλίδες φέρουν το «(€)» ώστε ο κοινός exporter να δώσει στη
      // στήλη μορφή νομίσματος και ζωντανό άθροισμα. Πριν, τα ποσά γράφονταν ως
      // κείμενο «1.234,56€» και το φύλλο των βραχυχρόνιων διαμονών — αυτό
      // ακριβώς που πάει στον λογιστή για τη δήλωση — δεν αθροιζόταν πουθενά.
      headers: [
        'Επισκέπτης', 'Ακίνητο', 'Άφιξη', 'Αναχώρηση', 'Νύχτες', 'Κανάλι',
        'Πληρωμή επισκέπτη (€)', 'Τέλος ανθεκτικότητας (€)', 'Προμήθεια πλατφόρμας (€)',
        'Δηλωτέο ακαθάριστο (€)', 'Σημείωση ποσού', 'Καθαρή είσπραξη (€)',
        'Δήλωση βραχυχρόνιας διαμονής', 'Κόστος φθοράς (€)', 'Αντικείμενο ή σημείωση φθοράς',
      ],
      rows,
    });
  };

  return {
    supabase, clients, props, inv, loading, search, setSearch, undeclaredOnly, setUndeclaredOnly,
    composeOpen, setComposeOpen, reportYear, setReportYear, reportYearMenu, setReportYearMenu,
    msgId, setMsgId, msgCopied, setMsgCopied, emailOpen, setEmailOpen, emailText, setEmailText,
    emailBusy, emailErr, setEmailErr, emailDraft, setEmailDraft, icalOpen, setIcalOpen, icalText,
    setIcalText, icalUrl, setIcalUrl, icalPropertyId, setIcalPropertyId, icalChannel,
    setIcalChannel, icalIncludeBlocked, setIcalIncludeBlocked, icalEvents, icalBusy, icalMsg,
    icalFeeds, icalFeedsFailed, modalOpen, setModalOpen, editing, form, setForm, saving, openId,
    setOpenId, stayForm, setStayForm, stayFormOpen, setStayFormOpen, savingStay, noteForm,
    setNoteForm, setDocKindOf, docBusy, docFileRef, loadNotes, loadDocs, loadIcalFeeds, notes, docs,
    docMsg, notesFailed, docsFailed, docKind, propsByClient, propName, staysByClient, statsByClient,
    allStays, undeclaredByClient, filtered, kpis, openNew, openEdit, save, del, checkins,
    checkinCopied, copyCheckinLink, parseEmail, saveEmailStay, linkProperty, unlinkProperty,
    openStayNew, openStayEdit, onStayDates, suggestLevy, saveStay, delStay, toggleDeclared,
    saveNote, delNote, onDocFile, delDoc, openIcal, parseIcalInput, fetchIcalFromUrl, saveIcalFeed,
    syncIcalNow, delIcalFeed, importIcal, exportCsv,
  }
}

export type ClientsState = ReturnType<typeof useClients>
