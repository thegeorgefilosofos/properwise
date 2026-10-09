'use client'
// ═══════════════════════════════════════════════════════════════════════════
// Η ΣΥΝΟΜΙΛΙΑ ΜΕ ΤΗ ΝΟΑ: ΦΩΝΗ, ΕΡΩΤΗΣΗ, ΦΩΤΟΓΡΑΦΙΑ
// ─────────────────────────────────────────────────────────────────────────
// Υπαγόρευση και ανάγνωση φωναχτά, το όριο ερωτήσεων, η ερώτηση προς το
// μοντέλο και η ανάγνωση εικόνας. Παίρνουν την κατάσταση και τις ενέργειες
// από τα προηγούμενα hooks.
// ═══════════════════════════════════════════════════════════════════════════
import type { AssistantCore } from './useAssistant'
import type { AssistantActions } from './useAssistantActions'
import { SAY } from '@/lib/core/dbError'
import { useState, useRef, useEffect } from 'react'
import { track, PRODUCT_EVENTS } from '@/lib/analytics/events'
import {
  speechRecognizer, speechSupported, type SpeechEvent, type SpeechErrorEvent, type SpeechRecognizer,
} from '@/lib/core/speech'
import { fe } from '@/components/Theme'
import { NAV_MAP, buildPersonalPrompt, parseAction, cleanForSpeech, addMemory } from '../assistantPersona'
import { assistantLockedMessage } from '@/lib/billing/aiLimits'
import { modelFor } from '@/lib/assistant/model'
import { numberMatchLine } from '@/lib/assistant/roster'
import { scanFile } from '../scanDoc'
import { DOC_TYPE_LABELS } from '@/lib/billing/documents'
import { parseAmount } from '@/lib/core/greek'
import { athensToday, athensNowLabel } from '@/lib/core/time'
import { type Props, IMG_ITEM_SCAN_SYSTEM, eur, navLabel } from './model'

export function useAssistantChat({
  listeningRef, setInput, setOpen, setQuota, busy, setErr, setErrDetail, setLimitMsg,
  assistantLocked, setMsgs, msgs, setBusy, supabase, prefs, ctxStr, allPropsContext, insightsStr,
  marketStr, clientsStr, techStr, clientsLite, contactsLite, pricingStr, memories, planBrief,
  canNavigate, setMemories, userId, runAction, answeredRef, nudgedRef, setPendingDoc, askRef,
}: Pick<Props & AssistantCore & AssistantActions,
  'listeningRef' | 'setInput' | 'setOpen' | 'setQuota' | 'busy' | 'setErr' | 'setErrDetail' |
  'setLimitMsg' | 'assistantLocked' | 'setMsgs' | 'msgs' | 'setBusy' | 'supabase' | 'prefs' |
  'ctxStr' | 'allPropsContext' | 'insightsStr' | 'marketStr' | 'clientsStr' | 'techStr' |
  'clientsLite' | 'contactsLite' | 'pricingStr' | 'memories' | 'planBrief' | 'canNavigate' |
  'setMemories' | 'userId' | 'runAction' | 'answeredRef' | 'nudgedRef' | 'setPendingDoc' |
  'askRef'
>) {

  // ── Φωνή: ομιλία στα ελληνικά (hands-free) ─────────────────────────────────
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [handsFree, setHandsFree] = useState(false);
  useEffect(() => { listeningRef.current = listening; }, [listening, listeningRef]);
  const recRef = useRef<SpeechRecognizer | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const handsFreeRef = useRef(false);
  const supportsSTT = speechSupported();
  const supportsTTS = typeof window !== 'undefined' && 'speechSynthesis' in window;
  useEffect(() => { handsFreeRef.current = handsFree; }, [handsFree]);

  useEffect(() => {
    if (!supportsTTS) return;
    const load = () => { voicesRef.current = window.speechSynthesis.getVoices(); };
    load(); window.speechSynthesis.onvoiceschanged = load;
    return () => { try { window.speechSynthesis.onvoiceschanged = null; window.speechSynthesis.cancel(); } catch { /* ignore */ } };
  }, [supportsTTS]);

  // Μία φωνή, χωρίς φύλο: διαλέγουμε την πιο ουδέτερη και ευκρινή ελληνική που
  // δίνει το σύστημα, χωρίς να ψάχνουμε «αντρική» ή «γυναικεία».
  const pickVoice = (): SpeechSynthesisVoice | null => {
    const el = voicesRef.current.filter(v => v.lang && v.lang.toLowerCase().startsWith('el'));
    if (!el.length) return null;
    return el.find(v => /Google/i.test(v.name)) || el[0];
  };

  const speak = (text: string, after?: () => void) => {
    const spoken = cleanForSpeech(text);
    if (!supportsTTS || !spoken) { after?.(); return; }
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(spoken);
      const v = pickVoice(); if (v) u.voice = v;
      u.lang = 'el-GR'; u.rate = 1.0; u.pitch = 1.0;
      u.onstart = () => setSpeaking(true);
      u.onend = () => { setSpeaking(false); after?.(); };
      u.onerror = () => { setSpeaking(false); after?.(); };
      window.speechSynthesis.speak(u);
    } catch { after?.(); }
  };
  const stopSpeaking = () => { try { window.speechSynthesis?.cancel(); } catch { /* ignore */ } setSpeaking(false); };

  const stopListening = () => { try { recRef.current?.stop(); } catch { /* ignore */ } setListening(false); };
  const startListening = () => {
    const SR = speechRecognizer();
    if (!SR) return;
    stopSpeaking();
    const rec = new SR();
    rec.lang = 'el-GR'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
    let finalText = '';
    rec.onresult = (e: SpeechEvent) => {
      let interim = '';
      const res = e.results;
      if (!res) return;
      for (let i = e.resultIndex ?? 0; i < res.length; i++) {
        const tr = res[i][0]?.transcript || '';
        if (res[i].isFinal) finalText += tr; else interim += tr;
      }
      setInput((finalText + interim).trim());
    };
    rec.onerror = (ev: SpeechErrorEvent) => { setListening(false); if ((ev?.error || '') === 'not-allowed' || (ev?.error || '') === 'service-not-allowed') { setHandsFree(false); handsFreeRef.current = false; } };
    rec.onend = () => {
      setListening(false);
      const t = finalText.trim();
      if (t) { setInput(''); ask(t, true); }
      // Hands-free: αν δεν πιάστηκε ομιλία (παύση/θόρυβος), ξανάνοιξε το μικρόφωνο
      // ώστε ο κύκλος να μη «σπάει». Δεν ξεκινά όσο εκφωνείται απάντηση ή ήδη ακούει.
      else if (handsFreeRef.current) setTimeout(() => { if (handsFreeRef.current && !listeningRef.current && !(supportsTTS && window.speechSynthesis.speaking)) startListening(); }, 500);
    };
    recRef.current = rec; setInput(''); setListening(true);
    try { rec.start(); } catch { setListening(false); }
  };
  const toggleMic = () => { if (listening) stopListening(); else { setOpen(true); startListening(); } };

  /**
   * Διαβάζει το υπόλοιπο από τις κεφαλίδες της απάντησης.
   *
   * Καλείται και στις ΔΥΟ διαδρομές που ξοδεύουν ερώτηση, τη συνομιλία και τη
   * σάρωση φωτογραφίας: αλλιώς ο μετρητής θα έδειχνε λιγότερα από όσα όντως
   * ξόδεψε ο χρήστης, που είναι χειρότερο από το να μην υπάρχει.
   *
   * Αν οι κεφαλίδες λείπουν —παλιά έκδοση της βάσης— δεν αγγίζει τίποτα: η
   * γραμμή απλώς δεν εμφανίζεται.
   */
  const readQuota = (res: Response) => {
    // ΚΑΙ ΤΑ ΔΥΟ ΟΡΙΑ, ΟΧΙ ΜΟΝΟ ΤΟΥ ΜΗΝΑ. Μέσα σε ένα απόγευμα δεσμεύει σχεδόν
    // πάντα το ημερήσιο: ο συνδρομητής «Ιδιοκτήτης» σταματούσε στην 8η ερώτηση
    // ενώ η γραμμή μπροστά του έγραφε ότι του απομένουν 15 του μήνα.
    const n = (h: string) => Number(res.headers.get(h));
    const q = { month: n('x-ai-month'), monthLimit: n('x-ai-month-limit'), day: n('x-ai-day'), dayLimit: n('x-ai-day-limit') };
    if (Object.values(q).every(Number.isFinite) && q.monthLimit > 0) setQuota(q);
  };

  const ask = async (question: string, viaVoice = false) => {
    const q = question.trim();
    if (!q || busy) return;
    setErr(''); setErrDetail(''); setLimitMsg(''); setInput('');
    if (assistantLocked) {
      // Η ΟΥΔΕΤΕΡΗ ΔΙΑΤΥΠΩΣΗ, ΟΧΙ ΤΗΣ ΑΓΟΡΑΣ. Το `billingWords` τραβά μαζί του
      // τον έμπορο (node:crypto) και δεν ανήκει σε bundle του περιηγητή· το
      // «υπάρχει στο πακέτο…» ισχύει είτε η χρέωση είναι ανοιχτή είτε όχι.
      setMsgs([...msgs, { role: 'user', text: q },
        { role: 'assistant', text: assistantLockedMessage(false), action: { type: 'go', tab: 'settings' } }]);
      return;
    }
    const history = [...msgs, { role: 'user' as const, text: q }];
    setMsgs(history); setBusy(true);
    // Το σκαλί της εμπιστοσύνης: ο χρήστης έδωσε ερώτηση στο προϊόν. Μετριέται
    // ο ΤΡΟΠΟΣ, όχι η ερώτηση: το κείμενο δεν φεύγει ποτέ από εδώ.
    void track(supabase, PRODUCT_EVENTS.assistant_asked, { source: viaVoice ? 'voice' : 'typed' });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      // ΜΟΝΟ ΤΟ ΠΡΟΣΩΠΙΚΟ ΚΕΙΜΕΝΟ ΦΕΥΓΕΙ ΑΠΟ ΕΔΩ. Τη γνώση (το πρώτο, κοινό μπλοκ)
      // τη φτιάχνει ο διακομιστής από τα ίδια μηνύματα (`noaSystemBlocks`), οπότε
      // δεν ταξιδεύουν πια ~145 KB από το κινητό σε κάθε ερώτηση.
      const personal = buildPersonalPrompt(prefs, ctxStr || 'Τα δεδομένα φορτώνονται.', allPropsContext, {
        insights: insightsStr || undefined,
        market: marketStr || undefined,
        clients: clientsStr || undefined,
        contactsPro: techStr || undefined,
        // Ο αριθμός της ερώτησης λύνεται εδώ: φεύγει μόνο το όνομα που ταιριάζει.
        numberMatch: numberMatchLine(q, clientsLite, contactsLite) || undefined,
        pricing: pricingStr || undefined,
        memories: prefs.memory ? memories.map(m => m.text) : undefined,
        // ΤΟ ΠΑΚΕΤΟ ΜΑΖΙ ΜΕ ΤΑ ΟΡΙΑ ΤΟΥ. Σκέτο το όνομα δεν έφτανε: στη δοκιμή
        // το όνομα είναι «Ιδιοκτήτης+» και η Νόα έλεγε τις ερωτήσεις ΕΚΕΙΝΟΥ
        // του πακέτου ενώ ο μετρητής έδινε το δοκιμαστικό. Το `planBrief`
        // φτιάχνεται από το `planBriefing`, που ξέρει και τα δύο.
        plan: planBrief,
        // ΤΙ ΔΕΝ ΒΛΕΠΕΙ, ΑΠΟ ΤΗΝ ΙΔΙΑ ΠΗΓΗ ΠΟΥ ΤΟ ΑΠΟΦΑΣΙΖΕΙ Η ΜΠΑΡΑ. Το κουμπί
        // της ενέργειας κρύβεται ήδη αν η καρτέλα είναι κλειστή, αλλά αυτό είναι
        // φράχτης στο τέλος: η γραμμή ΠΡΙΝ έχει ήδη γραφτεί στη βάση και ο
        // χρήστης έχει ήδη διαβάσει «τον καταχώρησα». Ο βοηθός πρέπει να μην το
        // προτείνει καθόλου και το ξέρει μόνο αν του το πούμε.
        lockedTabs: canNavigate
          ? NAV_MAP.filter(n => !canNavigate(n.id)).map(n => `«${navLabel(n.id)}»`).join(', ') || undefined
          : undefined,
        // ΩΡΑ ΕΛΛΑΔΑΣ, ΟΧΙ ΤΗΣ ΣΥΣΚΕΥΗΣ. Το toLocaleDateString χωρίς timeZone
        // ακολουθεί το ρολόι του browser: ο ιδιοκτήτης που ταξιδεύει θα έπαιρνε
        // λάθος μέρα και μαζί λάθος απάντηση σε κάθε «προλαβαίνω;».
        //
        // Δίνουμε ΚΑΙ την ώρα: χωρίς αυτήν ο βοηθός δεν μπορεί να ξεχωρίσει το
        // «σήμερα το πρωί» από το «απόψε», ούτε να πει αν προλαβαίνεις να
        // πληρώσεις κάτι που λήγει σήμερα. Και το ISO δίπλα, ώστε να μη χρειάζεται
        // να μεταφράσει ελληνικό μήνα σε αριθμό όταν υπολογίζει προθεσμίες.
        today: `${athensNowLabel()} (ISO: ${athensToday()}, ώρα Ελλάδας)`,
      });
      const res = await fetch('/api/anthropic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        // ΗΤΑΝ 900, ΜΕ ΤΟ ΤΑΒΑΝΙ ΤΟΥ ΔΙΑΚΟΜΙΣΤΗ ΣΤΑ 2000. Μια ανάλυση δανείου ή ένας
        // πίνακας τιμών ανά μήνα κοβόταν στη μέση και ο χρήστης διάβαζε μισό
        // συλλογισμό χωρίς να ξέρει ότι λείπει κάτι.
        // ΤΟ ΜΟΝΤΕΛΟ ΔΙΑΛΕΓΕΤΑΙ ΑΠΟ ΤΗΝ ΕΡΩΤΗΣΗ, ΟΧΙ ΑΠΟ ΣΥΝΗΘΕΙΑ. Κάθε ερώτηση
        // πήγαινε στο ακριβό μοντέλο, από το «καλημέρα» ως τον υπολογισμό ΣΕΠΠΕ,
        // και επειδή το πακέτο ερωτήσεων κάθε συνδρομής βγαίνει από διαίρεση,
        // αυτό σήμαινε λιγότερες ερωτήσεις για τον συνδρομητή (βλ. lib/assistant/model.ts).
        body: JSON.stringify({ persona: 'noa', personal, model: modelFor(q), max_tokens: 1800, messages: history.map(m => ({ role: m.role, content: m.text })) }),
      });
      readQuota(res);
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429) { setLimitMsg(String(data?.error || '')); setErr('limit'); }
        else if (String(data?.error || '').includes('ANTHROPIC_API_KEY')) setErr('key');
        else {
          // 400/413: ο διακομιστής λέει ΤΙ να αλλάξει ο χρήστης· το γενικό
          // «δοκίμασε ξανά» θα τον έβαζε να ξαναστείλει το ίδιο πράγμα.
          setErrDetail(res.status === 400 || res.status === 413 ? String(data?.error || '') : '');
          setErr('service');
        }
        // Η ΕΡΩΤΗΣΗ ΓΥΡΝΑ ΣΤΟ ΠΕΔΙΟ. Το συννεφάκι φεύγει, οι λέξεις του χρήστη όχι.
        setMsgs(m => m.slice(0, -1)); setInput(q);
        return;
      }
      const raw: string = data?.content?.find((c: { type: string }) => c.type === 'text')?.text || 'Δεν έχω απάντηση αυτή τη στιγμή.';
      const { clean, action, remember } = parseAction(raw);
      // Μόνιμη μνήμη: κράτησε το γεγονός που ζητήθηκε (μόνο αν το επιτρέπει η ρύθμιση).
      if (remember && prefs.memory) setMemories(addMemory(userId, remember));
      // Η «επικοινωνία με επαφή» δεν εμφανίζεται ως κουμπί στο πρώτο μήνυμα· την
      // «εκτελούμε» αμέσως (ανάλυση επαφής) ώστε να προκύψει είτε κουμπί-σύνδεσμος
      // που ανοίγει το μέσο με ένα άγγιγμα, είτε ερώτηση/εναλλακτική αν λείπει κάτι.
      const isReach = action?.type === 'reach';
      // Στη φωνή/hands-free η ενέργεια εκτελείται αυτόματα παρακάτω — μην αφήσεις και
      // κουμπί (θα προκαλούσε διπλή καταχώρηση αν το πατούσε κι ο χρήστης).
      const willAutoRun = !!action && !isReach && (viaVoice || handsFreeRef.current);
      setMsgs(m => [...m, { role: 'assistant', text: clean, action: (isReach || willAutoRun) ? undefined : action }]);
      if (isReach) runAction(action, true);
      // Μετά τις ~12 πρώτες απαντήσεις, πρότεινε (μία φορά) αξιολόγηση του PROPERWISE.
      answeredRef.current += 1;
      if (answeredRef.current >= 12 && !nudgedRef.current && !action) {
        nudgedRef.current = true;
        setMsgs(m => [...m, {
          role: 'assistant',
          text: prefs.formal
            ? 'Θέλετε να μου πείτε τι σας άρεσε και τι σας δυσκόλεψε; Κάθε σχόλιο το διαβάζει άνθρωπος.'
            : 'Θέλεις να μου πεις τι σου άρεσε και τι σε δυσκόλεψε; Κάθε σχόλιο το διαβάζει άνθρωπος.',
          action: { type: 'feedback' },
        }]);
      }
      // Φωνητική απάντηση + εκτέλεση ενέργειας / συνέχιση συνομιλίας.
      if (viaVoice || handsFreeRef.current) {
        speak(clean, () => {
          if (action && !isReach) runAction(action, true);
          if (handsFreeRef.current) setTimeout(() => startListening(), 350);
        });
      }
    } catch { setErrDetail(''); setErr('service'); setMsgs(m => m.slice(0, -1)); setInput(q); }
    finally { setBusy(false); }
  };

  // ── ΤΟ ΠΑΡΑΣΤΑΤΙΚΟ ΠΕΡΝΑΕΙ ΑΠΟ ΤΗ ΜΙΑ ΜΗΧΑΝΗ, ΟΧΙ ΑΠΟ ΔΕΥΤΕΡΗ ──────────────
  //
  // ΤΙ ΓΙΝΟΤΑΝ. Ο βοηθός είχε δικό του διάβασμα απόδειξης: ένα ελαφρύ prompt που
  // έβγαζε περιγραφή, ποσό και ημερομηνία και μετά έγραφε ΜΙΑ γραμμή στις
  // δαπάνες. Η εφαρμογή όμως έχει ήδη ολόκληρη μηχανή γι' αυτό (scanDoc) και
  // κάνει τρία πράγματα που ο βοηθός δεν έκανε κανένα:
  //   · ΣΥΜΦΩΝΙΑ: αν η απόδειξη εξοφλεί εκκρεμή λογαριασμό, τον σημαίνει
  //     πληρωμένο αντί να φτιάξει δεύτερη εγγραφή για το ίδιο ευρώ.
  //   · ΔΙΠΛΟΕΓΓΡΑΦΗ: αν η ίδια δαπάνη υπάρχει ήδη, δεν την ξαναγράφει.
  //   · ΑΡΧΕΙΟ: ανεβάζει το πρωτότυπο, ώστε το χαρτί να υπάρχει στον έλεγχο.
  // Ο ιδιοκτήτης που φωτογράφιζε τον λογαριασμό ΔΕΗ αφού τον είχε ήδη
  // καταχωρήσει, τον μετρούσε δύο φορές — και το διπλό ποσό ταξίδευε στη
  // Λογιστική και στην πρόβλεψη φόρου.
  //
  // Η ΦΩΤΟΓΡΑΦΙΑ ΑΝΤΙΚΕΙΜΕΝΟΥ ΜΕΝΕΙ ΕΔΩ. Το scanFile κρίνει ντετερμινιστικά: αν
  // δεν βρει ΚΑΝΕΝΑ στοιχείο παραστατικού, δεν είναι χαρτί. Τότε — και μόνο
  // τότε — τρέχει η αναγνώριση συσκευής, που η μηχανή του Αρχείου δεν κάνει.
  const askImage = async (file: File) => {
    if (!file.type.startsWith('image/') || busy) return;
    if (file.size > 10 * 1024 * 1024) { setMsgs(m => [...m, { role: 'assistant', text: 'Η φωτογραφία είναι πάνω από 10 MB. Δοκίμασε μικρότερη.' }]); return; }
    setErr('');
    setMsgs(m => [...m, { role: 'user', text: 'Φωτογραφία για ανάγνωση' }]);
    setBusy(true);

    // ── 1) Είναι παραστατικό; Το απαντά η ίδια σάρωση με το Αρχείο ──────────
    try {
      const scan = await scanFile(file);
      if (scan.kind === 'document' && scan.doc) {
        setPendingDoc({ doc: scan.doc, file });
        const d = scan.doc;
        const bits = [d.provider, d.amount != null ? eur(d.amount) : null, d.period || d.issue_date].filter(Boolean).join(' · ');
        setMsgs(m => [...m, { role: 'assistant',
          text: `Διάβασα ${DOC_TYPE_LABELS[d.doc_type] || 'παραστατικό'}${bits ? `: ${bits}` : ''}. Να το καταχωρήσω; Θα ελέγξω πρώτα αν εξοφλεί κάτι που ήδη περιμένει και θα κρατήσω το πρωτότυπο στο Αρχείο.`,
          action: { type: 'commit-doc', label: d.title || d.provider || 'παραστατικό' } }]);
        setBusy(false); return;
      }
      // Το όριο των σαρώσεων δεν λύνεται με δεύτερη κλήση: λέγεται και σταματά εδώ.
      if (scan.error === 'quota') {
        setMsgs(m => [...m, { role: 'assistant', text: scan.errorText || SAY.scanQuotaSpent }]);
        setBusy(false); return;
      }
    } catch { /* πέφτουμε στην αναγνώριση αντικειμένου παρακάτω */ }

    // ── 2) Δεν είναι χαρτί: τι αντικείμενο δείχνει; ────────────────────────
    try {
      const b64: string | null = await new Promise(res => { const r = new FileReader(); r.onload = () => res((r.result as string).split(',')[1] || null); r.onerror = () => res(null); r.readAsDataURL(file); });
      if (!b64) { setBusy(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 30000);
      const res = await fetch('/api/anthropic', {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        // ΣΑΡΩΣΗ, ΟΧΙ ΕΡΩΤΗΣΗ: η ίδια φωτογραφία με το βήμα 1, άρα ο διακομιστής
        // τη μετρά μία φορά (route.tsx, scanKey) και δεν τρώει ερώτηση της Νόας.
        body: JSON.stringify({ kind: 'scan', model: 'claude-sonnet-5', max_tokens: 500, system: IMG_ITEM_SCAN_SYSTEM,
          messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: file.type || 'image/jpeg', data: b64 } }, { type: 'text', text: 'Διάβασε το αντικείμενο/συσκευή από τη φωτογραφία.' }] }] }),
      });
      clearTimeout(timer);
      readQuota(res);
      const data = await res.json();
      if (!res.ok || data?.error) { setMsgs(m => [...m, { role: 'assistant', text: res.status === 429 && typeof data?.error === 'string' ? data.error : 'Δεν μπόρεσα να διαβάσω τη φωτογραφία τώρα. Δοκίμασε ξανά ή πες μου τα στοιχεία.' }]); setBusy(false); return; }
      const txt: string = data?.content?.find((c: { type: string }) => c.type === 'text')?.text || '{}';
      let d: Record<string, string> = {};
      try { d = JSON.parse(txt.replace(/```json?|```/g, '').trim()); } catch { /* ignore */ }

      const CATS = ['Έπιπλα', 'Ηλεκτρικές Συσκευές', 'Ηλεκτρονικά', 'Υδραυλικά', 'Θέρμανση & Ψύξη', 'Φωτιστικά', 'Διακόσμηση', 'Λοιπά'];
      const name = (d.name || [d.brand, d.model].filter(Boolean).join(' ') || '').slice(0, 120);
      if (!name) { setMsgs(m => [...m, { role: 'assistant', text: 'Δεν κατάλαβα καθαρά τι δείχνει η φωτογραφία. Δοκίμασε πιο κοντινή και καθαρή λήψη ή πες μου τι είναι.' }]); setBusy(false); return; }
      // ΕΝΑΣ ΑΝΑΛΥΤΗΣ ΠΟΣΩΝ. Το μοντέλο γράφει συχνά «449,99» ή «1.299,00» παρά την
      // οδηγία· το παλιό replace(/[^\d.]/) τα έκανε 44.999€ και 1€ στην απογραφή.
      const val = Math.round(parseAmount(String(d.price ?? '')) ?? 0);
      const category = d.category && CATS.includes(d.category) ? d.category : undefined;
      // Τα κλειδιά μένουν όπως στη βάση· στον χρήστη δείχνουμε πεζά (sentence case).
      const categoryLabel = category && ({ 'Ηλεκτρικές Συσκευές': 'Ηλεκτρικές συσκευές', 'Θέρμανση & Ψύξη': 'Θέρμανση και ψύξη' } as Record<string, string>)[category] || category;
      const action = { type: 'inventory' as const, name, category, value: val > 0 ? val : undefined, brand: d.brand || undefined, model: d.model || undefined };
      const bits = [d.brand, d.model && `μοντέλο ${d.model}`, val > 0 && `~${fe(val)}`, categoryLabel].filter(Boolean).join(' · ');
      setMsgs(m => [...m, { role: 'assistant', text: `Διάβασα: ${name}${bits ? ` (${bits})` : ''}. Να το καταγράψω στα «${navLabel('inventory')}»;`, action }]);
    } catch { setMsgs(m => [...m, { role: 'assistant', text: 'Δεν μπόρεσα να διαβάσω τη φωτογραφία τώρα. Δοκίμασε ξανά.' }]); }
    finally { setBusy(false); }
  };

  // Η τρέχουσα εκδοχή του `ask` για τον ακροατή του `pos:ask`.
  useEffect(() => { askRef.current = ask; });

  return {
    listening, speaking, handsFree, setHandsFree, supportsSTT, supportsTTS, stopSpeaking,
    stopListening, startListening, toggleMic, ask, askImage,
  }
}

export type AssistantChat = ReturnType<typeof useAssistantChat>
