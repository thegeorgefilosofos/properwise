'use client';

// ═══════════════════════════════════════════════════════════════════════════
// Νόα — ορατή ΠΑΝΤΟΥ στην εφαρμογή.
// ─────────────────────────────────────────────────────────────────────────
// Πλωτό κουμπί σε κάθε καρτέλα → πάνελ συνομιλίας. Απαντά σε ΟΤΙΔΗΠΟΤΕ (χαλαρά
// ή σύνθετα ακινήτων), δίνει γνώμη, παραπέμπει στον σωστό επαγγελματία και
// καθοδηγεί μέσα στην εφαρμογή, πάντα με τα δεδομένα του χρήστη μπροστά της.
//
// ΤΟ ΟΝΟΜΑ ΔΕΝ ΕΙΝΑΙ ΡΥΘΜΙΣΗ. Μέχρι σήμερα ο χρήστης διάλεγε όνομα και φύλο:
// το αποτέλεσμα ήταν ότι το προϊόν δεν είχε πρόσωπο και κάθε οθόνη το έλεγε
// αλλιώς. Τώρα υπάρχει μία ταυτότητα, από το lib/assistant/identity.ts και οι
// ρυθμίσεις αφορούν μόνο ΣΥΜΠΕΡΙΦΟΡΑ (προσφώνηση, μνήμη, σύγκριση).
//
// ΤΟ ΥΦΟΣ: ήρεμη ιεραρχία, καθαρή τυπογραφία, βάθος από φωτεινότητα και όχι
// από χρώμα ή βαριές σκιές. Καμία διακόσμηση που δεν κουβαλάει πληροφορία.
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect } from 'react';
import { AssistantMark } from './AssistantMark';
import { T, TT, Modal, Btn, IconBtn, LinkBtn, fe } from '@/components/Theme';
import Feedback from './Feedback';
import {
  savePrefs,
  loadHistory, clearHistory,
  removeMemory, clearMemories, actionReachable,
} from './assistantPersona';
import {
  ASSISTANT_NAME, ASSISTANT_ACC, tagline, askCta, askPlaceholder, openAria, aiDisclosureLines, openersLabel,
  speakingLabel, settingsTitle, noKeyNotice,
} from '@/lib/assistant/identity';
import { aiLimitsFor } from '@/lib/billing/aiLimits';
import { PLANS } from '@/lib/billing/plans';

import { suggestedOpeners, greeting as buildGreeting } from '@/lib/assistant/openers';
import { hy } from '@/components/Hyphen';
import { RECONCILE_NONE_LABEL, RECONCILE_NONE_HINT } from './scanDoc';
import { remainingLine } from '@/lib/billing/aiLimits';
import {
  type Props,
  eur, navLabel, reachLabel, NO_MEMORIES, FAB_H,
  snapCorner,
} from './assistant/model'
import { AssistantSettings } from './assistant/AssistantSettings'
import { useAssistant } from './assistant/useAssistant'
import { useAssistantActions } from './assistant/useAssistantActions'
import { useAssistantChat } from './assistant/useAssistantChat'

export default function PropertyAssistant({ propertyId, userId, propContext, allProperties = [], onNavigate, onScan, canNavigate, planBrief, assistantLocked = false }: Props) {
  const {
    supabase, open, setOpen, fabPos, setFabPos, dragging, setDragging, scrolled, prefs, setPrefs,
    reconcile, setReconcile, editing, setEditing, msgs, setMsgs, input, setInput, busy, setBusy,
    consumedActions, setConsumedActions, feedbackOpen, setFeedbackOpen, answeredRef, nudgedRef,
    imgRef, err, setErr, limitMsg, setLimitMsg, errDetail, setErrDetail, quota, setQuota, ctxStr,
    setCtxStr, insightsStr, marketStr, clientsStr, setClientsStr, pricingStr, openerCtx, techStr,
    setMemories, memories, scrollRef, listeningRef, clientsLite, contactsLite, openBills, openRent,
    pendingDoc, setPendingDoc, askRef, allPropsContext, loadContext,
  } = useAssistant({ propertyId, userId, propContext, allProperties, onNavigate, onScan, canNavigate, planBrief, assistantLocked })
  const {
    runAction, findContact, buildReachLink, commitPendingDoc,
  } = useAssistantActions({
    onScan, onNavigate, setFeedbackOpen, setOpen, clientsLite, contactsLite, setMsgs, pendingDoc,
    busy, setBusy, propertyId, userId, setReconcile, setPendingDoc, setCtxStr, loadContext,
    supabase, openBills, openRent, setClientsStr,
  })
  const {
    listening, speaking, handsFree, setHandsFree, supportsSTT, supportsTTS, stopSpeaking,
    stopListening, startListening, toggleMic, ask, askImage,
  } = useAssistantChat({
    listeningRef, setInput, setOpen, setQuota, busy, setErr, setErrDetail, setLimitMsg,
    assistantLocked, setMsgs, msgs, setBusy, supabase, prefs, ctxStr, allPropsContext, insightsStr,
    marketStr, clientsStr, techStr, clientsLite, contactsLite, pricingStr, memories, planBrief,
    canNavigate, setMemories, userId, runAction, answeredRef, nudgedRef, setPendingDoc, askRef,
  })

  // Ο χαιρετισμός λέει ΤΙ ΒΛΕΠΕΙ, όχι τι είναι. Το «ρώτησέ με οτιδήποτε» δεν λέει
  // τίποτα· το «βλέπω τα ενοίκια και τις δαπάνες του Χ» λέει τα πάντα και είναι
  // ο λόγος που ο χρήστης θα ρωτήσει κάτι δικό του αντί για κάτι γενικό.
  const greeting = buildGreeting(ASSISTANT_NAME, openerCtx, prefs.formal);
  // Όλα τα σταθερά κείμενα βγαίνουν από την ταυτότητα — κανένα δεν γράφεται εδώ.
  const cta = askCta(prefs.formal);
  // Η ίδια προσφώνηση με την υπόλοιπη συνομιλία: ενικός, εκτός αν ο χρήστης
  // διάλεξε πληθυντικό ευγενείας.
  const dragHint = prefs.formal ? 'Σύρετε για να το μετακινήσετε' : 'Σύρε για να το μετακινήσεις';
  const placeholder = askPlaceholder(prefs.formal);

  // ── Μετακίνηση του κουμπιού (σύρσιμο) ώστε να μην εμποδίζει το περιεχόμενο ──
  // Το κουμπί δεν είναι πια κύκλος σταθερών 60px: είναι πλήκτρο με το όνομα και
  // στενεύει σε σήμα στο κινητό. Άρα ΜΕΤΡΑΜΕ το μέγεθός του αντί να το μαντεύουμε
  // — αλλιώς η μισή πρόσκληση θα κατέληγε έξω από την οθόνη μετά από σύρσιμο.
  const fabRef = useRef<HTMLButtonElement | null>(null);
  // ΤΟ ΠΑΝΕΛ ΠΑΙΡΝΕΙ ΤΗΝ ΕΣΤΙΑΣΗ ΚΑΙ ΤΗΝ ΕΠΙΣΤΡΕΦΕΙ. Με Ctrl+J ή με το πλωτό
  // κουμπί η εστίαση έμενε στη σελίδα από κάτω και ο χρήστης πληκτρολογίου
  // περνούσε όλη την Επισκόπηση με Tab για να φτάσει στο πεδίο. Σε αφή πάμε στο
  // πάνελ, όχι στο πεδίο: αλλιώς κάθε άνοιγμα θα σήκωνε το πληκτρολόγιο.
  const panelRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open) {
      const fine = typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches;
      (fine && inputRef.current && !inputRef.current.disabled ? inputRef.current : panelRef.current)?.focus({ preventScroll: true });
    } else if (wasOpenRef.current) fabRef.current?.focus({ preventScroll: true });
    wasOpenRef.current = open;
  }, [open]);

  // ═══ ΤΟ ΚΟΥΜΠΙ ΠΟΥ ΚΑΘΟΤΑΝ ΠΑΝΩ ΣΤΟ «ΑΠΟΘΗΚΕΥΣΗ» ════════════════════════
  // Το `.app-content` κρατά κάτω περιθώριο για το πλωτό κουμπί, οπότε στη σελίδα
  // δεν εμποδίζει. Σε παράθυρο όμως, που είναι `fixed` και ζωγραφίζεται από πάνω,
  // το περιθώριο δεν ισχύει: το κουμπί κάθεται ακριβώς πάνω στη δεξιά κάτω γωνία,
  // δηλαδή πάνω στο «Αποθήκευση» κάθε φόρμας της εφαρμογής.
  //
  // Το σήμα δεν το επινοούμε: κάθε παράθυρο δηλώνει `aria-modal="true"` — και
  // όσα δεν το δήλωναν, τώρα το δηλώνουν. Όσο υπάρχει ένα ανοιχτό, ο βοηθός
  // αποσύρεται. Μόλις κλείσει, επιστρέφει.
  const [overlayOpen, setOverlayOpen] = useState(false);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const check = () => setOverlayOpen(!!document.querySelector('[aria-modal="true"]'));
    check();
    const mo = new MutationObserver(check);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-modal'] });
    return () => mo.disconnect();
  }, []);
  const fabBox = () => {
    const r = fabRef.current?.getBoundingClientRect();
    return { w: r?.width || FAB_H, h: r?.height || FAB_H };
  };
  // ═══ ΤΟ ΠΛΩΤΟ ΚΟΥΜΠΙ ΕΜΕΝΕ ΟΠΟΥ ΤΟ ΑΦΗΝΕ ΤΟ ΔΑΧΤΥΛΟ ═══════════════════════
  // ΤΙ ΦΩΤΟΓΡΑΦΗΘΗΚΕ, ΣΕ ΤΑΜΠΛΕΤΑ: το «Ν» ψηλά δεξιά, στην ΙΔΙΑ θέση σε δέκα
  // διαφορετικές οθόνες, καθισμένο πάνω σε «Τράπεζα Πειραιώς 2,40%», πάνω στο
  // κουμπί «Δόση στις Δαπάνες», πάνω στη λεζάντα του γραφήματος απόσβεσης.
  //
  // ΓΙΑΤΙ. Η θέση θυμάται ένα σύρσιμο και δεν επιστρέφει πουθενά. Ομως χώρο
  // κρατά ΜΟΝΟ η κάτω άκρη: το `.app-content` έχει `padding-bottom` που
  // καθαρίζει το κουμπί. Κάθε άλλη θέση κάθεται πάνω σε στήλη περιεχομένου —
  // δεν είναι θέμα του πού το άφησε ο χρήστης, είναι ότι δεν υπάρχει άλλη
  // ασφαλής θέση να το αφήσει.
  //
  // Η ΔΙΟΡΘΩΣΗ ΕΙΝΑΙ ΤΟ ΚΟΥΜΠΩΜΑ, ΟΧΙ Η ΑΦΑΙΡΕΣΗ ΤΟΥ ΣΥΡΣΙΜΑΤΟΣ. Το σύρσιμο
  // υπάρχει για έναν πραγματικό λόγο: «το κουμπί μου κρύβει κάτι εδώ κάτω, θέλω
  // να το πάω αλλού». Κρατιέται ΟΛΟ, αλλά ο προορισμός είναι πάντα μία από τις
  // δύο ΚΑΤΩ γωνίες — οι μόνες δύο θέσεις που η διάταξη έχει κρατήσει άδειες.
  // Ιδιο ιδίωμα με κάθε καλοφτιαγμένο πλωτό κουμπί.
  // ═══ ΤΟ ΚΟΥΜΠΙ ΠΟΥ ΔΕΝ ΣΕΡΝΟΤΑΝ ΜΕ ΤΟ ΔΑΧΤΥΛΟ ══════════════════════════
  // Με ποντίκι το σύρσιμο δούλευε. Με δάχτυλο όχι· ο λόγος δεν ήταν ο
  // κώδικας εδώ: ο περιηγητής κρίνει μόνος του, στην πρώτη κίνηση, αν η
  // χειρονομία ανήκει στη σελίδα (κύλιση) ή στο στοιχείο. Οσο το κουμπί δεν
  // δήλωνε `touch-action:none`, την έπαιρνε η σελίδα: έστελνε `pointercancel`
  // και ΣΤΑΜΑΤΟΥΣΕ να στέλνει `pointermove`.
  //
  // ΜΕΤΡΗΜΕΝΟ, ΟΧΙ ΕΙΚΑΣΙΑ (scripts/e2e-touch.mjs, αληθινά αγγίγματα CDP):
  // σύρσιμο 220px μετακινούσε το κουμπί 18px και μετά κολλούσε. Και επειδή
  // κανείς δεν άκουγε το `pointercancel`, η κατάσταση «σέρνεται» έμενε ανοιχτή
  // για πάντα: το επόμενο δάχτυλο ΟΠΟΥΔΗΠΟΤΕ στην οθόνη τραβούσε το κουμπί
  // μαζί του, 403px σε τηλέφωνο και 1051px σε ταμπλέτα.
  //
  // Τρία πράγματα το κλείνουν: το `touch-action:none` στο ίδιο το κουμπί, η
  // σύλληψη του δείκτη (`setPointerCapture`) ώστε οι κινήσεις να έρχονται εδώ
  // ακόμη κι όταν το δάχτυλο βγει εκτός· τρίτο, ακροατής στο `pointercancel`.
  const fabDrag = useRef<{ id: number; sx: number; sy: number; ox: number; oy: number; slop: number; moved: boolean } | null>(null);
  const justDragged = useRef(false);
  useEffect(() => {
    // Φόρτωσε την αποθηκευμένη θέση, ΑΛΛΑ μόνο αν χωράει ολόκληρο το κουμπί μέσα
    // στην τρέχουσα οθόνη. Αλλιώς (άλλο μέγεθος παραθύρου/οθόνη, χαλασμένη τιμή)
    // αγνόησέ την ώστε το πλωτό να επιστρέψει στη σταθερή κάτω-δεξιά θέση.
    //
    // ΜΕΤΑ ΤΟ ΠΡΩΤΟ ΚΑΡΕ, ΓΙΑΤΙ ΕΙΝΑΙ ΜΕΤΡΗΣΗ. Το «χωράει;» απαντιέται από τις
    // διαστάσεις του παραθύρου και του ίδιου του κουμπιού, δηλαδή από το DOM.
    // Γραμμένο σύγχρονα μέσα στο effect ήταν γραφή κατάστασης πριν καν
    // ζωγραφιστεί το κουμπί που μετριέται.
    const frame = requestAnimationFrame(() => {
    try {
      const s = localStorage.getItem('pa_fab_pos');
      if (!s) return;
      const p = JSON.parse(s) as { x: number; y: number };
      const m = 8;
      const { w, h } = fabBox();
      const inView = typeof window !== 'undefined'
        && Number.isFinite(p?.x) && Number.isFinite(p?.y)
        && p.x >= m && p.y >= m
        && p.x <= window.innerWidth - w - m
        && p.y <= window.innerHeight - h - m;
      // Η αποθηκευμένη τιμή ΚΟΥΜΠΩΝΕΙ, δεν εφαρμόζεται όπως είναι: όποιος έχει
      // ήδη αφήσει το κουμπί πάνω σε περιεχόμενο το βρίσκει διορθωμένο στην
      // επόμενη φόρτωση, χωρίς να χρειαστεί να κάνει τίποτα.
      if (inView) setFabPos(snapCorner(p.x, w) ?? p);
      else localStorage.removeItem('pa_fab_pos');
    } catch { /* ignore */ }
    });
    return () => cancelAnimationFrame(frame);
  }, [setFabPos]);
  useEffect(() => {
    if (!fabPos || dragging) return;
    try { localStorage.setItem('pa_fab_pos', JSON.stringify(fabPos)); } catch { /* ignore */ }
  }, [fabPos, dragging]);
  // Η ΠΕΡΙΣΤΡΟΦΗ ΤΟΥ ΤΑΜΠΛΕΤ ΑΛΛΑΖΕΙ ΚΑΙ ΤΙΣ ΔΥΟ ΔΙΑΣΤΑΣΕΙΣ. Μια γωνία της
  // κατακόρυφης οθόνης δεν είναι γωνία της οριζόντιας: χωρίς αυτό, το κουμπί
  // βρίσκεται στη μέση της σελίδας μόλις γυρίσει η συσκευή.
  useEffect(() => {
    if (!fabPos) return;
    const onResize = () => setFabPos(prev => (prev ? snapCorner(prev.x, fabBox().w) ?? prev : prev));
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [fabPos, setFabPos]);
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = fabDrag.current; if (!d || e.pointerId !== d.id) return;
      const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
      if (!d.moved && Math.hypot(dx, dy) < d.slop) return;
      d.moved = true; if (!dragging) setDragging(true);
      if (e.cancelable) e.preventDefault();
      const m = 8;
      const { w, h } = fabBox();
      const x = Math.max(m, Math.min(d.ox + dx, window.innerWidth - w - m));
      const y = Math.max(m, Math.min(d.oy + dy, window.innerHeight - h - m));
      setFabPos({ x, y });
    };
    // ΤΟ ΤΕΛΟΣ ΕΙΝΑΙ ΤΟ ΙΔΙΟ ΕΙΤΕ ΣΗΚΩΘΗΚΕ ΤΟ ΔΑΧΤΥΛΟ ΕΙΤΕ ΤΟ ΠΗΡΕ ΤΟ ΣΥΣΤΗΜΑ.
    // Το `pointercancel` έρχεται σε εισερχόμενη κλήση, σε δεύτερο δάχτυλο, σε
    // αλλαγή εφαρμογής. Χωρίς αυτό, η κατάσταση «σέρνεται» δεν έκλεινε ποτέ.
    const end = (e: PointerEvent) => {
      const d = fabDrag.current;
      if (d && e.pointerId !== d.id) return;
      fabDrag.current = null;
      // Το πάτημα που γεννά ένα σύρσιμο με ΠΟΝΤΙΚΙ έρχεται αμέσως μετά το
      // `pointerup`: ο δείκτης του λέει «ήταν σύρσιμο, μην ανοίξεις». Με ΑΦΗ ο
      // περιηγητής δεν το στέλνει καν, οπότε ο δείκτης μένει σηκωμένος — και
      // τον κατεβάζει η ΕΠΟΜΕΝΗ χειρονομία, στο `pointerdown` της. Ετσι κανένα
      // αυθαίρετο χρονικό όριο δεν κρίνει πότε «τελείωσε» το σύρσιμο: ένα
      // άγγιγμα αμέσως μετά ανοίγει κανονικά τον βοηθό.
      if (d?.moved) {
        justDragged.current = true;
        // Το κουμπί πέφτει στην πλησιέστερη ΚΑΤΩ γωνία: εκεί — μόνο εκεί —
        // η διάταξη έχει κρατήσει χώρο γι' αυτό.
        setFabPos(prev => (prev ? snapCorner(prev.x, fabBox().w) ?? prev : prev));
      }
      setDragging(false);
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, [dragging, setDragging, setFabPos]);
  const startFabDrag = (e: React.PointerEvent) => {
    if (e.button && e.button !== 0) return;
    justDragged.current = false;
    const el = e.currentTarget as HTMLElement;
    const r = el.getBoundingClientRect();
    // Η ΣΥΛΛΗΨΗ ΤΟΥ ΔΕΙΚΤΗ. Χωρίς αυτήν, ένα γρήγορο σύρσιμο που προσπερνά το
    // κουμπί χάνει τις κινήσεις του σε όποιο στοιχείο βρεθεί από κάτω.
    try { el.setPointerCapture(e.pointerId); } catch { /* ο περιηγητής δεν το υποστηρίζει */ }
    // ΤΟ ΔΑΧΤΥΛΟ ΤΡΕΜΕΙ, ΤΟ ΠΟΝΤΙΚΙ ΟΧΙ. Με το ίδιο κατώφλι, ένα λίγο άτσαλο
    // άγγιγμα μετρούσε ως σύρσιμο και ο βοηθός δεν άνοιγε.
    const slop = e.pointerType === 'mouse' ? 5 : 11;
    fabDrag.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, slop, moved: false };
  };
  const fabToggle = (next: boolean) => () => { if (!justDragged.current) setOpen(next); };
  const fabFixed: React.CSSProperties = fabPos ? { left: fabPos.x, top: fabPos.y, right: 'auto', bottom: 'auto' } : {};
  // Θέση πάνελ: αν το κουμπί έχει μετακινηθεί, το πάνελ ανοίγει κοντά του (πάνω ή κάτω, με clamp).
  const panelFixed: React.CSSProperties = (() => {
    if (!fabPos || typeof window === 'undefined') return {};
    const vw = window.innerWidth, vh = window.innerHeight;
    const pw = Math.min(390, vw - 32), ph = Math.min(600, vh - 130);
    // Το ΥΨΟΣ του κουμπιού είναι σταθερό (FAB_H) — μόνο το πλάτος αλλάζει με τη
    // γλώσσα και την οθόνη. Άρα η θέση του πάνελ δεν χρειάζεται μέτρηση και δεν
    // διαβάζουμε ref μέσα στο render: στοιχίζουμε στην ΑΡΙΣΤΕΡΗ ακμή του κουμπιού.
    let top = fabPos.y - ph - 10;
    if (top < 12) top = Math.min(fabPos.y + FAB_H + 10, vh - ph - 12);
    let left = fabPos.x;
    left = Math.max(12, Math.min(left, vw - pw - 12));
    return { left, top, right: 'auto', bottom: 'auto' };
  })();

  return (
    <>
      {/* Το κουμπί που τη φέρνει μπροστά, σε κάθε καρτέλα.
          Ονομαστικό, όχι διακοσμητικό: λέει ΠΟΙΑ είναι και ΤΙ κάνεις μαζί της,
          γιατί ένα ανώνυμο πλωτό κουκκί δεν το πατά κανείς δεύτερη φορά. */}
      {!open && !overlayOpen && (
        <div className="pa-fab-wrap" style={fabFixed} data-scrolled={scrolled ? '1' : undefined}>
          <button ref={fabRef} className="pa-fab" onPointerDown={startFabDrag} onClick={fabToggle(true)}
            aria-label={openAria()} title={dragHint}
            style={{ cursor: dragging ? 'grabbing' : 'pointer' }}>
            <span className="pa-mark" aria-hidden><AssistantMark size={18} /></span>
            <span className="pa-fab-cta">{cta}</span>
            {(listening || speaking) && <span className="pa-fab-live" style={{ background: listening ? 'var(--negative)' : 'var(--accent)' }} />}
          </button>
        </div>
      )}
      {open && (
        <button ref={fabRef} className="pa-fab pa-fab-close" onPointerDown={startFabDrag} onClick={fabToggle(false)} aria-label="Κλείσιμο" title={dragHint} style={{ ...fabFixed, cursor: dragging ? 'grabbing' : 'pointer' }}>
          <svg aria-hidden="true" width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      )}

      {open && (
        <div ref={panelRef} tabIndex={-1} className="pa-panel" role="dialog" aria-modal="false" aria-label={`Συνομιλία με ${ASSISTANT_ACC}`} style={panelFixed}>
          {/* Κεφαλίδα */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
            {/* Το 15 δεν υπάρχει στην κλίμακα (…13, 14, 16, 18…) — ήταν ένα από
                τα δύο μεγέθη όλου του αρχείου εκτός κλίμακας. Στα 16 κρατά την
                ίδια αναλογία μέσα στον δίσκο των 34 (0,44 → 0,47). */}
            <div aria-hidden style={{ width: 34, height: 34, borderRadius: T.radius.inner, background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', flexShrink: 0 }}><AssistantMark size={17} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...TT.h2, fontSize: 14 }}>{ASSISTANT_NAME}</div>
              <div className="po-subline" style={{ ...TT.caption }}>{tagline(prefs.formal)}</div>
            </div>
            {(supportsSTT || supportsTTS) && (
              // Η αναμμένη κατάσταση περνά από γεμάτο πλακίδιο σε μελάνι accent: η `.po-ico` δεν έχει «πατημένο» και το κέρδος εδώ είναι ο στόχος αφής (ήταν 30)
              <IconBtn onClick={() => { const next = !handsFree; setHandsFree(next); if (next && supportsSTT) { setOpen(true); startListening(); } else { stopListening(); stopSpeaking(); } }}
                title={handsFree ? 'Κλείσε τη λειτουργία φωνής' : 'Λειτουργία φωνής (μίλα ελεύθερα)'} label="Λειτουργία φωνής"
                tone={handsFree ? 'accent' : undefined}>
                <svg aria-hidden="true" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 18 0" /><path d="M21 12v3a2 2 0 0 1-2 2h-1v-5h3z" /><path d="M3 12v3a2 2 0 0 0 2 2h1v-5H3z" /></svg>
              </IconBtn>
            )}
            <IconBtn onClick={() => setEditing(e => !e)} title={settingsTitle()} label={settingsTitle()}
              tone={editing ? 'accent' : undefined}>
              <svg aria-hidden="true" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
            </IconBtn>
          </div>
          {(listening || speaking) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: 'var(--accent-dim)', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: listening ? 'var(--negative)' : 'var(--accent)', animation: 'pa-pulse 1.1s infinite' }} />
              <span style={{ fontFamily: T.font.sans, fontSize: 12, color: 'var(--text-secondary)', flex: 1 }}>{listening ? 'Ακούω…' : speakingLabel()}</span>
              {/* Το περιτύλιγμα κρατά την τυπογραφία των 12/700: το LinkBtn κληρονομεί γραμματοσειρά από τον γονέα του */}
              {speaking && <span style={{ fontFamily: T.font.sans, fontSize: 12, fontWeight: 700 }}><LinkBtn onClick={stopSpeaking}>Σταμάτα</LinkBtn></span>}
            </div>
          )}

          {/* Ρυθμίσεις συμπεριφοράς — όχι ταυτότητας */}
          {editing ? (
            <AssistantSettings
              draft={prefs}
              hasMemory={msgs.length > 0 || loadHistory(propertyId).length > 0}
              facts={memories}
              onForgetFact={(id) => setMemories(removeMemory(userId, id))}
              onForgetAllFacts={() => { clearMemories(userId); setMemories(NO_MEMORIES); }}
              onCancel={() => setEditing(false)}
              onClearMemory={() => { clearHistory(propertyId); setMsgs([]); }}
              onSave={(next) => {
                // Αν έκλεισε τη μνήμη, σβήσε ό,τι έχει αποθηκευτεί (σεβασμός στην επιλογή).
                if (prefs.memory && !next.memory) { clearHistory(propertyId); clearMemories(userId); setMemories(NO_MEMORIES); }
                setPrefs(next); savePrefs(next); setEditing(false);
              }}
            />
          ) : (
            <>
              {/* Σώμα */}
              {/* ΖΩΝΤΑΝΗ ΠΕΡΙΟΧΗ. Χωρίς αυτήν, όποιος ακούει την οθόνη έστελνε
                  ερώτηση και δεν άκουγε ποτέ την απάντηση. Το `log` διαβάζει
                  μόνο ό,τι ΠΡΟΣΤΙΘΕΤΑΙ: κάθε νέο μήνυμα και την ένδειξη ότι
                  Νόα γράφει, όχι ξανά ολόκληρη τη συνομιλία. */}
              <div ref={scrollRef} role="log" aria-live="polite" aria-relevant="additions" aria-label={`Συνομιλία με ${ASSISTANT_ACC}`} style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Η ΠΡΩΤΗ ΟΘΟΝΗ. Ο χαιρετισμός ΔΕΝ είναι συννεφάκι συνομιλίας: είναι
                    δήλωση για το τι βλέπει αυτή τη στιγμή στο ακίνητό σου, άρα διαβάζεται
                    σαν κείμενο και όχι σαν μήνυμα. Από κάτω, οι ερωτήσεις-εκκίνησης σε
                    στήλη: τέσσερις γραμμές που πατιούνται, χωρίς να μοιάζουν με μενού. */}
                {msgs.length === 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: T.sp.lg }}>
                    {/* ΤΟ ΣΤΕΝΟΤΕΡΟ ΚΕΙΜΕΝΟ ΤΗΣ ΕΦΑΡΜΟΓΗΣ. Ο χαιρετισμός της κενής
                        κατάστασης είναι 159 χαρακτήρες σε μέτρο 36ch — μετρημένο,
                        τέσσερις γραμμές μέσα σε πάνελ 390 και πέντε στα 288 του
                        κινητού, με ριγμένη δεξιά άκρη. Η στοίχιση ΧΩΡΙΣ συλλαβισμό
                        τεντώνει τα κενά, γι' αυτό η po-just πάει πάντα μαζί με hy(). */}
                    {/* ΤΟ ΔΩΡΕΑΝ ΠΑΚΕΤΟ ΤΟ ΜΑΘΑΙΝΕΙ ΠΡΙΝ ΡΩΤΗΣΕΙ. Ο χρήστης του «Ιδιοκτήτη»
                        βλέπει τι είναι η Νόα, πόσο κοστίζει και πού ενεργοποιείται,
                        αντί να το ανακαλύψει γράφοντας μια ερώτηση που δεν θα απαντηθεί. */}
                    {assistantLocked && (
                      <div style={{ padding: '14px 16px', borderRadius: T.radius.inner, background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ ...TT.label, fontSize: 'var(--fs-xs)', color: 'var(--accent)' }}>{`Πακέτο «${PLANS.solo.name}»`}</div>
                        {/* Η ΤΙΜΗ ΣΕ ΔΙΚΗ ΤΗΣ ΓΡΑΜΜΗ. Μέσα στην πρόταση, «4,99€» και «30» είναι
                            λέξεις που δεν κόβονται και σε πάνελ 300 εικονοστοιχείων η στοίχιση
                            άνοιγε τρύπες γύρω τους. */}
                        <p style={{ ...TT.body, fontSize: 14, lineHeight: 1.55, margin: 0 }}>{hy(`${ASSISTANT_NAME} απαντά με τα δικά σου νούμερα, διαβάζει λογαριασμούς και σου θυμίζει προθεσμίες.`)}</p>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{`${fe(PLANS.solo.priceMonthly)} τον μήνα · ${aiLimitsFor('solo').perMonth} ερωτήσεις`}</div>
                        <div><Btn variant="primary" onClick={() => onNavigate('settings')}>Δες το πακέτο</Btn></div>
                      </div>
                    )}
                    <p className="po-just" style={{ ...TT.body, fontSize: 14, lineHeight: 1.6, margin: 0, maxWidth: '36ch' }}>{hy(greeting)}</p>
                    <div>
                      <div style={{ ...TT.label, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 6 }}>{openersLabel()}</div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {suggestedOpeners(openerCtx).map((s, i) => (
                          <button key={s} onClick={() => ask(s)}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '11px 2px', background: 'transparent', border: 'none', borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)', cursor: 'pointer', fontFamily: T.font.sans, fontSize: 'var(--fs-base)', lineHeight: 1.45, color: 'var(--text-secondary)', transition: 'color 0.15s' }}
                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}>
                            <span style={{ flex: 1, minWidth: 0 }}>{s}</span>
                            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.6 }} aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {msgs.map((m, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start', gap: 6 }}>
                    <div style={{ maxWidth: '90%', padding: '11px 14px', borderRadius: T.radius.card, fontFamily: T.font.sans, fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap',
                      background: m.role === 'user' ? 'var(--accent)' : 'var(--bg-elevated)', color: m.role === 'user' ? 'var(--accent-text)' : 'var(--text-primary)',
                      border: 'none', borderBottomRightRadius: m.role === 'user' ? 4 : 14, borderBottomLeftRadius: m.role === 'user' ? 14 : 4 }}>{m.text}</div>
                    {/* Καμία υπόσχεση που δεν μπορεί να τηρηθεί: αν η καρτέλα όπου
                        προσγειώνεται η ενέργεια δεν είναι προσβάσιμη για αυτό το
                        ακίνητο ή αυτό το πακέτο, το κουμπί δεν γράφεται καθόλου —
                        αντί να γκριζάρει, ή χειρότερα, να γράψει τα δεδομένα σε
                        οθόνη που ο χρήστης δεν πρόκειται να δει. */}
                    {m.action && actionReachable(m.action, canNavigate) && (m.action.type === 'reach' ? (() => {
                      // Κουμπί/σύνδεσμος επικοινωνίας: ανοίγει το μέσο ΜΟΝΟ με το άγγιγμα
                      // του χρήστη (ποτέ αυτόματα). Για tel:/mailto: ρεαλιστικό <a>, για
                      // WhatsApp/Viber άνοιγμα σε νέα καρτέλα.
                      const ract = m.action;
                      const c = findContact(ract.name);
                      const link = c ? buildReachLink(c, ract.channel, ract.text) : null;
                      if (!link?.url) return null;
                      // Ενα στοιχείο αντί για δύο: το `href` του Btn δίνει το <a> που ήθελε το tel:/mailto:
                      // και το `newTab` κάνει ό,τι έκανε το window.open για WhatsApp/Viber.
                      const sameTab = ract.channel === 'call' || ract.channel === 'email';
                      return (
                        <Btn variant="secondary" href={link.url} newTab={!sameTab}>
                          {reachLabel(ract.channel, ract.name)}
                          <svg aria-hidden="true" width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                        </Btn>
                      );
                    })() : (() => {
                      const used = consumedActions.has(i);
                      return (
                      <Btn variant="secondary" disabled={used} onClick={() => { if (used) return; setConsumedActions(s => new Set(s).add(i)); runAction(m.action); }}>
                        {m.action.type === 'scan' ? 'Σάρωσε έγγραφο'
                          : m.action.type === 'book' ? `Κλείσε ραντεβού: ${new Date(m.action.date).toLocaleDateString('el-GR')}`
                          : m.action.type === 'client' ? `Καταχώρησε: ${m.action.name}`
                          : m.action.type === 'expense' ? `Κατέγραψε δαπάνη: ${eur(m.action.amount)}`
                          : m.action.type === 'checkin' ? `Σύνδεσμος check-in: ${m.action.who}`
                          : m.action.type === 'contact' ? `Πρόσθεσε επαφή: ${m.action.name}`
                          : m.action.type === 'paid' ? `Σήμανση πληρωμένο: ${m.action.description}`
                          : m.action.type === 'task' ? `Νέα εκκρεμότητα`
                          : m.action.type === 'inventory' ? `Κατέγραψε: ${m.action.name}`
                          : m.action.type === 'commit-doc' ? `Καταχώρησε: ${m.action.label}`
                          : m.action.type === 'feedback' ? 'Γράψε την αξιολόγησή σου'
                          : `Πήγαινε: ${navLabel(m.action.tab)}`}
                        <svg aria-hidden="true" width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                      </Btn>
                      ); })()
                    )}
                  </div>
                ))}
                {/* ── Η ΑΠΑΝΤΗΣΗ ΣΤΗΝ ΕΡΩΤΗΣΗ ΣΥΜΦΩΝΙΑΣ ─────────────────────────
                    Μία στήλη επιλογών με τον λόγο κάθε μιας από κάτω και το
                    «Κανέναν από αυτούς» τελευταίο. Δεν χρωματίζεται καμία: η μηχανή έχει
                    ήδη πει ότι ΔΕΝ είναι σίγουρη και ένα τονισμένο κουμπί θα
                    ήταν ακριβώς η εικασία που απέφυγε. */}
                {reconcile && !busy && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2 }}>
                    {reconcile.options.map(o => (
                      <button key={o.id} type="button" onClick={() => commitPendingDoc(o.id)}
                        style={{ textAlign: 'left', padding: '10px 13px', borderRadius: T.radius.inner, border: '1px solid var(--border-default)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontFamily: T.font.sans, fontSize: 'var(--fs-base)', cursor: 'pointer', minHeight: T.h.md }}>
                        <span style={{ fontWeight: 600 }}>{o.label}</span>
                        {o.reasons.length > 0 && <span style={{ display: 'block', marginTop: 4, color: 'var(--text-tertiary)', fontSize: 12 }}>{o.reasons.join(' · ')}</span>}
                      </button>
                    ))}
                    <button type="button" onClick={() => commitPendingDoc(null)}
                      style={{ textAlign: 'left', padding: '10px 13px', borderRadius: T.radius.inner, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontFamily: T.font.sans, fontSize: 'var(--fs-base)', cursor: 'pointer', minHeight: T.h.md }}>
                      <span style={{ fontWeight: 600 }}>{RECONCILE_NONE_LABEL}</span>
                      <span style={{ display: 'block', marginTop: 4, color: 'var(--text-tertiary)', fontSize: 12 }}>{RECONCILE_NONE_HINT}</span>
                    </button>
                  </div>
                )}
                {busy && <div style={{ display: 'flex', gap: 4, padding: '4px 2px' }}><span className="sr-only">{ASSISTANT_NAME} γράφει…</span>{[0, 1, 2].map(i => <span key={i} aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-tertiary)', animation: `pa-bounce 1s ${i * 0.15}s infinite ease-in-out` }} />)}</div>}
                {/* Το κουτί του σφάλματος μετρά 332 εικονοστοιχεία: πάνελ 390,
                    μείον 32 το γέμισμα του σώματος, μείον 26 το δικό του. Το μήνυμα
                    του κλειδιού είναι 126 χαρακτήρες στα 12 — τρεις γραμμές με
                    ριγμένη δεξιά άκρη. Πάει πέρα πέρα με συλλαβισμό· τα μηνύματα
                    μιας γραμμής από κάτω δεν επηρεάζονται, αφού η τελευταία γραμμή
                    δεν τεντώνεται ποτέ. */}
                {err && (
                  <div className="po-just" style={{ background: err === 'key' ? 'var(--bg-elevated)' : 'var(--warning-soft)', border: `1px solid ${err === 'key' ? 'var(--border-subtle)' : 'var(--warning-border)'}`, borderRadius: T.radius.inner, padding: '10px 13px', fontFamily: T.font.sans, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {hy(err === 'key'
                      ? noKeyNotice(prefs.formal)
                      : err === 'limit'
                        ? (limitMsg || remainingLine(quota, prefs.formal) || (prefs.formal ? 'Φτάσατε το όριο ερωτήσεων.' : 'Έφτασες το όριο ερωτήσεων.'))
                        : (errDetail || (prefs.formal ? 'Δεν μπόρεσα να απαντήσω τώρα. Δοκιμάστε ξανά σε λίγο.' : 'Δεν μπόρεσα να απαντήσω τώρα. Δοκίμασε ξανά σε λίγο.')))}
                  </div>
                )}
              </div>

              {/* Είσοδος */}
              <div style={{ display: 'flex', gap: 8, padding: '10px 14px', borderTop: '1px solid var(--border-subtle)', alignItems: 'center' }}>
                <input ref={imgRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) askImage(f); e.currentTarget.value = ''; }} />
                <button onClick={() => { if (!busy) imgRef.current?.click(); }} disabled={busy} aria-label="Φωτογραφία απόδειξης, λογαριασμού ή αντικειμένου" title={`Φωτογράφισε απόδειξη ή λογαριασμό (καταχωρείται στις Δαπάνες) ή αντικείμενο (μπαίνει στα «${navLabel('inventory')}»)`}
                  style={{ width: 42, height: 42, flexShrink: 0, borderRadius: '50%', border: 'none', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', cursor: busy ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg aria-hidden="true" width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z" /><circle cx="12" cy="13" r="3.2" /></svg>
                </button>
                {supportsSTT && (
                  <button onClick={toggleMic} disabled={busy} className="po-box" aria-label={listening ? 'Σταμάτα' : 'Μίλα'} title={listening ? 'Σταμάτα' : 'Μίλα στα ελληνικά'}
                    style={{ width: 42, height: 42, flexShrink: 0, borderRadius: '50%', border: 'none', background: listening ? 'var(--negative)' : 'var(--bg-elevated)', color: listening ? 'var(--on-tone)' : 'var(--text-secondary)', cursor: busy ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: listening ? 'pa-pulse 1.1s infinite' : 'none' }}>
                    <svg aria-hidden="true" width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v4" /></svg>
                  </button>
                )}
                <input value={input} ref={inputRef} aria-label={prefs.formal ? `Η ερώτησή σας προς ${ASSISTANT_ACC}` : `Η ερώτησή σου προς ${ASSISTANT_ACC}`} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') ask(input); }} placeholder={listening ? 'Ακούω…' : placeholder} disabled={busy}
                  style={{ flex: 1, minWidth: 0, background: 'var(--bg-base)', border: '1px solid var(--border-default)', borderRadius: T.radius.pill, padding: '10px 15px', color: 'var(--text-primary)', fontSize: 'var(--fs-base)', fontFamily: T.font.sans, outline: 'none' }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-soft)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.boxShadow = 'none'; }} />
                <button onClick={() => ask(input)} disabled={busy || !input.trim()} aria-label="Αποστολή"
                  style={{ width: 42, height: 42, flexShrink: 0, borderRadius: '50%', border: 'none', background: input.trim() && !busy ? 'var(--accent)' : 'var(--bg-elevated)', color: input.trim() && !busy ? 'var(--accent-text)' : 'var(--text-tertiary)', cursor: input.trim() && !busy ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg aria-hidden="true" width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></svg>
                </button>
              </div>
              {/* ΤΟ ΥΠΟΛΟΙΠΟ, ΚΑΤΩ ΑΠΟ ΤΟ ΠΛΑΙΣΙΟ ΓΡΑΦΗΣ ΚΑΙ ΧΩΡΙΣ ΧΡΩΜΑ.
                  Δεν είναι προειδοποίηση και δεν γίνεται κόκκινο όσο μικραίνει:
                  είναι μέτρηση, όπως η μπάρα προόδου της Αξιοποίησης. Ο χρήστης
                  που θέλει να ξέρει, κοιτάζει· ο χρήστης που δεν θέλει, δεν το
                  προσέχει. Εμφανίζεται μόνο αφού απαντήσει η βάση: πριν από την
                  πρώτη ερώτηση το υπόλοιπο θα ήταν μαντεψιά. */}
              {/* ΜΙΑ ΠΡΟΤΑΣΗ ΑΝΑ ΓΡΑΜΜΗ. Ως ενιαίο κείμενο έσπαγε σε τρεις
                  κεντραρισμένες γραμμές στη μέση της φράσης. */}
              <p style={{ ...TT.caption, color: 'var(--text-tertiary)', textAlign: 'center', margin: '8px 14px 0', textWrap: 'balance' }}>
                {aiDisclosureLines(prefs.formal).map((l, i) => <span key={i} style={{ display: 'block' }}>{l}</span>)}
              </p>
              {remainingLine(quota, prefs.formal) && (
                <div style={{ ...TT.caption, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 4 }}>
                  {remainingLine(quota, prefs.formal)}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── ΤΟ ΠΑΡΑΘΥΡΟ ΑΞΙΟΛΟΓΗΣΗΣ ΕΓΙΝΕ <Modal> ─────────────────────────────
          Ήταν 11 γραμμές χειρόγραφου κελύφους που μιλούσαν δικό τους λεξιλόγιο:
          scrim `rgba(12,20,34,0.5)` αντί για το ένα T.scrim, radius γραμμένο ως
          σκέτο 18 αντί για T.radius.modal, σκιά `0 20px 60px rgba(0,0,0,0.32)`
          αντί για το --elev-3 του θέματος. Και του έλειπαν και τα τέσσερα που
          δίνει το κοινό παράθυρο: Escape, εστίαση μέσα και επιστροφή μετά,
          κλείδωμα κύλισης του φόντου, κουμπί «×». Ούτε όνομα είχε — role="dialog"
          χωρίς aria-label, δηλαδή σκέτος «διάλογος» για τον αναγνώστη οθόνης.

          ΤΟ ΠΕΡΙΤΥΛΙΓΜΑ ΜΕ z-index ΔΕΝ ΕΙΝΑΙ ΔΙΑΚΟΣΜΗΣΗ. Το <Modal> έχει σταθερό
          z-index 1000, ενώ το πάνελ της Νόας ζει στο 1200 και το πλωτό κουμπί
          στο 1201 (βλ. .pa-panel/.pa-fab πιο κάτω). Χωρίς δικό του πλαίσιο
          στοίβαξης, το παράθυρο θα άνοιγε ΠΙΣΩ από το πάνελ που το κάλεσε. Το
          1400 είναι ακριβώς η τιμή που είχε το χειρόγραφο overlay, ώστε η σειρά
          των επιπέδων να μείνει η ίδια (ίδιο μοτίβο με το ConfirmDialog).

          Ο τίτλος ΔΕΝ επαναλαμβάνει την κεφαλίδα του Feedback («Κάνε το Property
          OS καλύτερο»): κρατά το όνομα με το οποίο το ζητά ήδη η μηνιαία
          παρότρυνση. Για τον ίδιο λόγο δεν μπαίνει εικονίδιο — το Feedback έχει
          ήδη το δικό του δύο γραμμές πιο κάτω. Ούτε footer: τα κουμπιά
          («Αποστολή», «Άλλη φορά», «Κλείσιμο») τα δίνει το ίδιο το Feedback. */}
      {feedbackOpen && (
        <div style={{ position: 'relative', zIndex: 1400 }}>
          <Modal open onClose={() => setFeedbackOpen(false)} title="Η γνώμη σου" size="sm">
            <Feedback target="assistant" embedded onDone={() => setFeedbackOpen(false)} />
          </Modal>
        </div>
      )}

      <style>{`
        /* Το βάθος βγαίνει από φωτεινότητα και λεπτό περίγραμμα, όχι από έγχρωμο
           φωτοστέφανο. Οι σκιές είναι τα tokens του θέματος (--elev-*), ίδια με
           κάθε άλλη επιφάνεια που «πλέει» πάνω από το περιεχόμενο. */
        @keyframes pa-bounce{0%,80%,100%{transform:translateY(0);opacity:.4}40%{transform:translateY(-5px);opacity:1}}
        @keyframes pa-pulse{0%,100%{opacity:1}50%{opacity:.35}}
        .pa-fab-wrap{position:fixed;right:var(--fab-side);bottom:var(--fab-bottom);z-index:1200;display:flex;align-items:center}
        /* ΗΣΥΧΟ ΩΣ ΤΗ ΣΤΙΓΜΗ ΠΟΥ ΤΟ ΘΕΛΕΙΣ. Ήταν κορεσμένο γαλάζιο πλήκτρο με
           λευκό δίσκο, δηλαδή το πιο δυνατό στοιχείο κάθε οθόνης — πιο δυνατό
           από τα ποσά, τις προθεσμίες και το κύριο κουμπί της σελίδας. Ένας
           βοηθός δεν φωνάζει πάνω από αυτό που βοηθά. Τώρα είναι επιφάνεια της
           εφαρμογής με διακριτικό περίγραμμα· γεμίζει με το χρώμα του σήματος
           μόλις πλησιάσει ο κέρσορας ή πάρει εστίαση. */
        /* ΤΟ touch-action:none ΕΙΝΑΙ Ο ΛΟΓΟΣ ΠΟΥ ΣΕΡΝΕΤΑΙ ΜΕ ΤΟ ΔΑΧΤΥΛΟ.
           Καμία γραμμή JavaScript δεν μπορεί να το αντικαταστήσει: ο περιηγητής
           αποφασίζει ΠΡΙΝ στείλει την πρώτη κίνηση αν η χειρονομία ανήκει στη
           σελίδα ή στο στοιχείο· η μόνη δήλωση που διαβάζει τότε είναι αυτή.
           Χωρίς την ίδια δήλωση, σύρσιμο 220px μετακινούσε το κουμπί 18px
           (μετρημένο σε αληθινά αγγίγματα: scripts/e2e-touch.mjs).
           Το user-select και το -webkit-touch-callout κόβουν την επιλογή
           κειμένου και το μενού της παρατεταμένης πίεσης πάνω στην πρόσκληση. */
        .pa-fab{position:fixed;right:var(--fab-side);bottom:var(--fab-bottom);height:var(--fab-h);padding:0 20px 0 8px;border-radius:100px;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;border:1px solid var(--border-default);background:var(--bg-surface);color:var(--text-primary);cursor:pointer;display:flex;align-items:center;gap:10px;box-shadow:var(--highlight-inset),var(--elev-1);z-index:1201;transition:background .18s ${T.ease.standard},border-color .18s ${T.ease.standard},color .18s ${T.ease.standard},box-shadow .2s ${T.ease.standard},transform .14s cubic-bezier(.2,0,0,1)}
        .pa-fab-wrap .pa-fab{position:relative;right:auto;bottom:auto}
        .pa-fab:hover,.pa-fab:focus-visible{background:var(--accent);border-color:var(--accent);color:var(--accent-text);box-shadow:var(--highlight-inset),var(--elev-3);transform:translateY(-1px)}
        .pa-fab:hover .pa-mark,.pa-fab:focus-visible .pa-mark{background:var(--accent-text);color:var(--accent)}
        .pa-fab:active{transform:translateY(0)}
        .pa-fab:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
        /* Το σήμα: το αρχικό μέσα σε φωτεινό δίσκο. Καμία εικονογραφία, κανένα
           «σπινθήρισμα» — το όνομα είναι το σήμα.

           ΟΙ ΠΕΝΤΕ ΙΔΙΟΤΗΤΕΣ ΓΡΑΜΜΑΤΟΣΕΙΡΑΣ ΕΦΥΓΑΝ ΜΑΖΙ ΜΕ ΤΟ ΓΡΑΜΜΑ. Εδώ
           γράφονταν font-family, font-weight, font-size, line-height και
           letter-spacing για ένα «Ν» της Inter. Το σήμα είναι πλέον σχήμα
           (AssistantMark), οπότε καμία από τις πέντε δεν επηρεάζει τίποτα:
           μένουν μόνο ο δίσκος και το χρώμα, που το σχήμα κληρονομεί με
           currentColor. */
        .pa-mark{width:36px;height:36px;flex-shrink:0;border-radius:50%;background:var(--accent-soft);color:var(--accent);display:flex;align-items:center;justify-content:center;transition:background .18s ${T.ease.standard},color .18s ${T.ease.standard}}
        .pa-fab-cta{font-family:'Inter',sans-serif;font-size:14px;font-weight:600;letter-spacing:-.01em;white-space:nowrap}
        .pa-fab-close{padding:0;width:var(--fab-h);justify-content:center;background:var(--bg-surface);color:var(--text-secondary);border-color:var(--border-default)}
        .pa-fab-live{position:absolute;top:8px;left:34px;width:9px;height:9px;border-radius:50%;animation:pa-pulse 1.4s infinite}
        /* Ο ΑΝΙΧΝΕΥΤΗΣ ΤΗΣ ΘΕΣΗΣ ΑΝΑΠΑΥΣΗΣ. Δεν φαίνεται, δεν πιάνει άγγιγμα και
           δεν ζει πάνω από ένα καρέ: μπαίνει, μετριέται, φεύγει. Υπάρχει γιατί
           το calc() και το env() ΔΕΝ διαβάζονται από το getComputedStyle ως
           αριθμός — μόνο η γεωμετρία ενός αληθινού στοιχείου τα λύνει. */
        .pa-fab-home{position:fixed;right:var(--fab-side);bottom:var(--fab-bottom);width:0;height:0;visibility:hidden;pointer-events:none}
        /* ΔΕΝ ΕΙΝΑΙ ΠΑΡΑΘΥΡΟ ΚΑΙ ΔΕΝ ΓΙΝΕΤΑΙ Modal. Δεν έχει scrim, δεν
           μπλοκάρει την εφαρμογή και δεν κεντράρεται: αγκυρώνεται στο πλωτό
           κουμπί (και το ακολουθεί όταν ο χρήστης το σύρει αλλού — panelFixed),
           ώστε να μπορείς να ρωτήσεις τη Νόα ΚΟΙΤΑΖΟΝΤΑΣ την οθόνη για την
           οποία ρωτάς. Ένα κεντραρισμένο παράθυρο με σκοτεινό φόντο θα έκρυβε
           ακριβώς τα νούμερα που συζητάτε. Ευθυγραμμίζεται μόνο η ακτίνα με το
           token (ήταν καρφωμένο 18px, δηλαδή η ίδια τιμή γραμμένη δεύτερη φορά). */
        .pa-panel{position:fixed;right:24px;bottom:92px;width:390px;max-width:calc(100vw - 32px);height:min(600px,calc(100vh - 130px));background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:${T.radius.modal}px;box-shadow:var(--highlight-inset),var(--elev-3);z-index:1200;display:flex;flex-direction:column;overflow:hidden}
        .pa-panel:focus{outline:none}
        /* ΤΟ ΟΡΙΟ ΕΙΝΑΙ 768, ΟΣΟ ΚΑΙ ΤΗΣ ΚΑΤΩ ΠΛΟΗΓΗΣΗΣ.
           Ήταν 600 ενώ η κάτω πλοήγηση εμφανίζεται στα 768: στο ενδιάμεσο —
           iPad mini όρθιο, Galaxy Fold ανοιχτό, τα περισσότερα tablet Android —
           το κουμπί έμενε στα 24 από κάτω με z-index 1201 πάνω από το 900 της
           πλοήγησης και κάθιζε ακριβώς πάνω στα δύο δεξιά της στοιχεία.
           Δύο διαφορετικά όρια για το ίδιο γεγονός είναι πάντα σφάλμα. */
        @media (max-width:768px){
          /* Το ίδιο όριο ασφαλείας με την .app-content: η πλοήγηση από κάτω
             είναι ψηλότερη κατά τη μπάρα αφής του iPhone, οπότε το κουμπί
             καθόταν 34 εικονοστοιχεία χαμηλότερα απ' όσο νόμιζε — πάνω της.
             Οι δύο τιμές ζουν πλέον στα --fab-bottom και --fab-side του
             globals.css: τις ήθελε ΚΑΙ η JavaScript του κουμπώματος και δύο
             αντίγραφα θα απέκλιναν — απέκλιναν ήδη μία φορά. */
          /* ΤΟ ΠΑΝΕΛ ΚΑΘΕΤΑΙ ΠΑΝΩ ΑΠΟ ΤΟ ΚΟΥΜΠΙ, ΟΧΙ ΑΠΟ ΚΑΤΩ ΤΟΥ. Με σταθερό
             bottom:78px το κουμπί κλεισίματος (που κάθεται στο --fab-bottom,
             πάνω από την πλοήγηση) σκέπαζε την τελευταία γραμμή του πάνελ:
             τη γνωστοποίηση ότι Νόα είναι τεχνητή νοημοσύνη. */
          .pa-panel{right:8px;left:8px;bottom:calc(var(--fab-bottom) + var(--fab-h) + 10px);width:auto;max-width:none;height:min(560px,calc(100dvh - var(--fab-bottom) - var(--fab-h) - 34px))}
        }
        /* Η πρόσκληση μαζεύεται στο σήμα: μόλις κυλήσει η σελίδα και εξαρχής
           κάτω από τα 1.280, όπου το περιεχόμενο φτάνει ως την άκρη. Ο λόγος και
           η μέτρηση είναι γραμμένα πάνω από την κατάσταση scrolled πιο πάνω. */
        .pa-fab-wrap[data-scrolled] .pa-fab{padding:0 8px;gap:0}
        .pa-fab-wrap[data-scrolled] .pa-fab-cta{display:none}
        @media (max-width:1279px){
          .pa-fab{padding:0 8px;gap:0}
          .pa-fab-cta{display:none}
        }
        @media (prefers-reduced-motion:reduce){
          .pa-fab,.pa-fab:hover{transition:none;transform:none}
          .pa-fab-live{animation:none}
        }
      `}</style>
    </>
  );
}
