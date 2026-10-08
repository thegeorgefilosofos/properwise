'use client'
// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΕΝΕΡΓΕΙΕΣ ΤΗΣ ΝΟΑΣ: Ο,ΤΙ ΓΡΑΦΕΙ ΣΤΗ ΒΑΣΗ ΟΤΑΝ ΤΗΣ ΤΟ ΖΗΤΗΣΕΙΣ
// ─────────────────────────────────────────────────────────────────────────
// Δαπάνη, πληρωμή λογαριασμού, εκκρεμότητα, πελάτης, επαφή, απογραφή,
// ραντεβού, σύνδεσμος check-in, επικοινωνία με επαφή. Παίρνουν ό,τι χρειάζονται
// από την κατάσταση (useAssistant) και δεν αποδίδουν τίποτα.
// ═══════════════════════════════════════════════════════════════════════════
import type { AssistantCore } from './useAssistant'
// Η απογραφή έχει ένα σπίτι: lib/data/inventory.
import * as inventory from '@/lib/data/inventory'
import * as billStore from '@/lib/data/bills'
import * as rentStore from '@/lib/data/rent'
import * as checklist from '@/lib/data/checklist'
import * as expenseStore from '@/lib/data/expenses'
import * as calendar from '@/lib/data/calendar'
import { CLIENT_TYPE_LABELS, type ClientType } from '@/lib/clients/clients'
import { ASSISTANT_NAME } from '@/lib/assistant/identity'
import { classifyExpense } from '@/lib/expenses/classify'
// Το Supabase δεν πετάει σε σφάλμα βάσης· η `must` το κάνει να πετάει, ώστε τα
// try/catch αυτού του αρχείου να λένε αλήθεια. Βλ. lib/supabase/must.ts.
import { must } from '@/lib/supabase/must'
import { failed } from '@/lib/core/dbError'
// Οι επαφές έχουν ένα σπίτι: lib/data/contacts.
import * as contactStore from '@/lib/data/contacts'
import { inferRole, roleLabel } from '@/lib/contacts/roles'
import { matchesNumber } from '@/lib/assistant/roster'
import { commitScannedDoc, type ReconcileQuestion } from '../scanDoc'
import { athensToday, isoMonth } from '@/lib/core/time'
import { MONTHS_GEN } from '@/lib/core/months'
import * as checkinLink from '@/lib/data/checkinLink'
import { ensureDpa } from '@/lib/legal/dpa'
import {
  type Props, type Action, type ClientLite, type ContactLite, eur, reconcilePrompt, navLabel,
  onlyDigits, CH_HUMAN,
} from './model'

export function useAssistantActions({
  onScan, onNavigate, setFeedbackOpen, setOpen, clientsLite, contactsLite, setMsgs, pendingDoc,
  busy, setBusy, propertyId, userId, setReconcile, setPendingDoc, setCtxStr, loadContext, supabase,
  openBills, openRent, setClientsStr,
}: Pick<Props & AssistantCore,
  'onScan' | 'onNavigate' | 'setFeedbackOpen' | 'setOpen' | 'clientsLite' | 'contactsLite' |
  'setMsgs' | 'pendingDoc' | 'busy' | 'setBusy' | 'propertyId' | 'userId' | 'setReconcile' |
  'setPendingDoc' | 'setCtxStr' | 'loadContext' | 'supabase' | 'openBills' | 'openRent' |
  'setClientsStr'
>) {

  const runAction = (a?: Action, keepOpen = false) => {
    if (!a) return;
    if (a.type === 'scan') onScan();
    else if (a.type === 'go') onNavigate(a.tab);
    else if (a.type === 'book') { bookAppointment(a.title, a.date, a.time); return; } // κρατά ανοιχτό το πάνελ για την επιβεβαίωση
    else if (a.type === 'client') { registerClient(a); return; }
    else if (a.type === 'expense') { registerExpense(a.description, a.amount, a.date); return; }
    else if (a.type === 'checkin') { makeCheckinLink(a.who); return; }
    else if (a.type === 'contact') { registerContact(a.name, a.phone, a.role); return; }
    else if (a.type === 'reach') { reachContact(a); return; }
    else if (a.type === 'task') { addTask(a); return; }
    else if (a.type === 'paid') { markPaid(a.description, a.amount); return; }
    else if (a.type === 'inventory') { registerInventory(a); return; }
    else if (a.type === 'commit-doc') { commitPendingDoc(); return; }
    else if (a.type === 'feedback') { setFeedbackOpen(true); return; }
    if (!keepOpen) setOpen(false);
  };

  // Βρες πελάτη από όνομα/τηλέφωνο/ΑΦΜ (ανεκτικό: μερικό όνομα, ψηφία τηλεφώνου).
  const findClient = (who: string): ClientLite | null => {
    const q = (who || '').trim().toLowerCase();
    if (!q) return null;
    const digits = q.replace(/\D/g, '');
    const list = clientsLite;
    const byNum = list.find(c => matchesNumber(digits, c));
    if (byNum) return byNum;
    const exact = list.find(c => c.name.toLowerCase() === q);
    if (exact) return exact;
    const partial = list.filter(c => c.name.toLowerCase().includes(q));
    return partial.length === 1 ? partial[0] : null;   // αν είναι διφορούμενο, μη μαντεύεις
  };

  // Βρες επαφή (τεχνικό/πάροχο) από όνομα ή ρόλο. Ανεκτικό: ακριβές όνομα → μερικό
  // όνομα → ετικέτα ρόλου → συμπερασμένος ρόλος. Επιστρέφει την καλύτερη μοναδική.
  const findContact = (name: string): ContactLite | null => {
    const q = (name || '').trim().toLowerCase();
    if (!q) return null;
    const list = contactsLite;
    const exact = list.find(c => c.name.toLowerCase() === q);
    if (exact) return exact;
    const partial = list.filter(c => { const n = c.name.toLowerCase(); return !!n && (n.includes(q) || q.includes(n)); });
    if (partial.length) return partial[0];
    const byRoleLabel = list.filter(c => { const rl = roleLabel(c.role || 'other').toLowerCase(); return !!rl && (rl.includes(q) || q.includes(rl)); });
    if (byRoleLabel.length) return byRoleLabel[0];
    const inferred = inferRole(q);
    if (inferred && inferred !== 'other') {
      const byRole = list.filter(c => (c.role || 'other') === inferred);
      if (byRole.length) return byRole[0];
    }
    return null;
  };

  // Χτίζει «τίμιο» deep link προς την επαφή. Δεν στέλνει τίποτα — απλώς ανοίγει το μέσο.
  // Επιστρέφει είτε το url, είτε ποιο στοιχείο λείπει (τηλέφωνο ή email).
  const buildReachLink = (c: ContactLite, channel: 'whatsapp' | 'viber' | 'email' | 'call', text?: string): { url?: string; need?: 'phone' | 'email' } => {
    const t = (text || '').trim();
    if (channel === 'email') {
      if (!c.email) return { need: 'email' };
      const subject = encodeURIComponent('Επικοινωνία');
      return { url: `mailto:${c.email}?subject=${subject}${t ? `&body=${encodeURIComponent(t)}` : ''}` };
    }
    // whatsapp / viber / call: χρειάζονται τηλέφωνο
    if (!c.phone) return { need: 'phone' };
    let d = onlyDigits(c.phone);
    if (!d) return { need: 'phone' };
    if (d.length === 10) d = `30${d}`;   // ελληνικός αριθμός 10 ψηφίων → διεθνής με πρόθεμα 30
    if (channel === 'viber') return { url: `viber://chat?number=${d}` };   // το Viber δεν προ-συμπληρώνει κείμενο
    if (channel === 'call') return { url: `tel:+${d}` };
    return { url: `https://wa.me/${d}${t ? `?text=${encodeURIComponent(t)}` : ''}` };   // whatsapp
  };

  // Επικοινωνία με επαφή: αναλύει ποιον εννοεί ο χρήστης, χτίζει τον σύνδεσμο και
  // σπρώχνει μήνυμα με κουμπί που ΑΝΟΙΓΕΙ το μέσο όταν το πατήσει ο χρήστης (όχι αυτόματα).
  const reachContact = (a: { name: string; channel: 'whatsapp' | 'viber' | 'email' | 'call'; text?: string }) => {
    const c = findContact(a.name);
    if (!c) {
      setMsgs(m => [...m, { role: 'assistant', text: `Δεν βρήκα την επαφή «${a.name}». Ποιον εννοείς;`, action: { type: 'go', tab: 'contacts' } }]);
      return;
    }
    const link = buildReachLink(c, a.channel, a.text);
    if (link.url) {
      // ΚΑΝΕΝΑ «τον/την». Το φύλο της επαφής δεν το ξέρουμε· η διατύπωση
      // ονομάζει το κανάλι και την επαφή, όχι το άρθρο της.
      const how = a.channel === 'call' ? 'κλήση'
        : a.channel === 'email' ? 'email'
          : a.channel === 'viber' ? 'Viber' : 'WhatsApp';
      setMsgs(m => [...m, { role: 'assistant', text: a.channel === 'call' ? `Πάτησε για κλήση: «${c.name}».` : `Πάτησε για ${how}: «${c.name}». Το μήνυμα δεν φεύγει μόνο του, ανοίγει η εφαρμογή για να το στείλεις εσύ.`, action: { type: 'reach', name: c.name, channel: a.channel, text: a.text } }]);
      return;
    }
    // Λείπει το απαραίτητο στοιχείο για το κανάλι — πρότεινε διαθέσιμη εναλλακτική.
    if (link.need === 'phone') {
      if (c.email) setMsgs(m => [...m, { role: 'assistant', text: `Η επαφή «${c.name}» δεν έχει αποθηκευμένο τηλέφωνο για ${CH_HUMAN[a.channel]}. Έχει όμως email, να το ετοιμάσω;`, action: { type: 'reach', name: c.name, channel: 'email', text: a.text } }]);
      else setMsgs(m => [...m, { role: 'assistant', text: `Η επαφή «${c.name}» δεν έχει αποθηκευμένο τηλέφωνο ούτε email. Πρόσθεσε στοιχεία επικοινωνίας στις Επαφές.`, action: { type: 'go', tab: 'contacts' } }]);
    } else {
      if (c.phone) setMsgs(m => [...m, { role: 'assistant', text: `Η επαφή «${c.name}» δεν έχει αποθηκευμένο email. Έχει τηλέφωνο, να ανοίξω WhatsApp αντ’ αυτού;`, action: { type: 'reach', name: c.name, channel: 'whatsapp', text: a.text } }]);
      else setMsgs(m => [...m, { role: 'assistant', text: `Η επαφή «${c.name}» δεν έχει αποθηκευμένο email ούτε τηλέφωνο. Πρόσθεσε στοιχεία επικοινωνίας στις Επαφές.`, action: { type: 'go', tab: 'contacts' } }]);
    }
  };

  // Καταχώρηση δαπάνης με μία φράση: η κατηγορία/ομάδα προκύπτει αυτόματα.
  // ── Η ΚΑΤΑΧΩΡΗΣΗ ΤΟΥ ΣΑΡΩΜΕΝΟΥ ΠΑΡΑΣΤΑΤΙΚΟΥ ────────────────────────────────
  // Καμία λογική εδώ: όλα τα αποφασίζει το commitScannedDoc, που είναι η ίδια
  // συνάρτηση που καλεί και η οθόνη σάρωσης της εφαρμογής. Ο βοηθός μόνο ρωτά
  // και ανακοινώνει — και ανακοινώνει ΟΣΑ ΕΓΙΝΑΝ ΠΡΑΓΜΑΤΙΚΑ, γιατί το
  // αποτέλεσμα επιστρέφει τη λίστα των καρτελών που ενημερώθηκαν.
  const commitPendingDoc = async (choice?: string | null) => {
    const pending = pendingDoc;
    if (!pending || busy) return;
    setBusy(true);
    try {
      const r = await commitScannedDoc({
        doc: pending.doc, file: pending.file, propertyId, userId,
        ...(choice !== undefined ? { reconcileChoice: choice } : {}),
      });

      // ΟΤΑΝ ΔΕΝ ΕΙΝΑΙ ΣΙΓΟΥΡΗ, ΡΩΤΑ. Δεν έχει γραφτεί τίποτα ακόμη: η μηχανή
      // επιστρέφει την ερώτηση αντί να μαντέψει ποιον λογαριασμό εξοφλεί η
      // απόδειξη. Μια λάθος εικασία εδώ σημαίνει λογαριασμός σημειωμένος
      // πληρωμένος που δεν πληρώθηκε.
      if (r.ask) { setMsgs(m => [...m, { role: 'assistant', text: reconcilePrompt(r.ask as ReconcileQuestion) }]); setReconcile(r.ask); setBusy(false); return; }

      setPendingDoc(null);
      setReconcile(null);
      if (r.error || !r.saved.length) {
        setMsgs(m => [...m, { role: 'assistant', text: 'Δεν μπόρεσα να το καταχωρήσω τώρα. Δοκίμασε από τη σάρωση της εφαρμογής, όπου μπορείς και να διορθώσεις ό,τι διάβασα λάθος.', action: { type: 'scan' } }]);
        setBusy(false); return;
      }
      setCtxStr('');   // ξαναφόρτωσε το πλαίσιο ώστε να «ξέρει» τη νέα εγγραφή
      loadContext();
      // Ο ΚΩΔΙΚΟΣ ΗΤΑΝ 'expenses' — ΚΑΡΤΕΛΑ ΠΟΥ ΔΕΝ ΥΠΑΡΧΕΙ.
      // Οι Δαπάνες συγχωνεύτηκαν στο 'finances' και το 'expenses' έπαψε να είναι
      // προορισμός. Ο έλεγχος ορατότητας όμως έλεγε «ναι» σε κάθε άγνωστο
      // κωδικό, οπότε το κουμπί περνούσε και ο χρήστης έπεφτε σε ΛΕΥΚΗ ΟΘΟΝΗ:
      // κεφαλίδα, κουμπί «πίσω» και κανένα σώμα — καμία συνθήκη απόδοσης δεν
      // ταιριάζει με ανύπαρκτο κωδικό. Δύο απαντήσεις της Νόα, κάθε φορά που
      // κατέγραφε δαπάνη.
      setMsgs(m => [...m, { role: 'assistant', text: `Έγινε. Ενημερώθηκαν: ${r.saved.join(', ')}.`, action: { type: 'go', tab: 'finances' } }]);
    } catch {
      setMsgs(m => [...m, { role: 'assistant', text: 'Δεν μπόρεσα να το καταχωρήσω τώρα. Δοκίμασε ξανά.' }]);
    } finally { setBusy(false); }
  };

  const registerExpense = async (description: string, amount: number, date?: string) => {
    const { group, category, deductible } = classifyExpense(description);
    const today = athensToday();
    // Έγκυρη ISO ημερομηνία (καθορίζει τον ΜΗΝΑ στον προϋπολογισμό)· αλλιώς σήμερα.
    const useDate = date && !isNaN(new Date(date).getTime()) ? date : today;
    // Ο μήνας από το κείμενο της ημερομηνίας. Με `new Date(...).getMonth()` η
    // δαπάνη της 1ης Ιανουαρίου ονομαζόταν «Δεκεμβρίου» σε αρνητική ζώνη ώρας.
    const monthLbl = useDate !== today ? ` (${MONTHS_GEN[(isoMonth(useDate) ?? 1) - 1]})` : '';
    try {
      // ΤΟ «ΜΕΤΡΗΤΑ» ΔΕΝ ΤΟ ΕΙΠΕ ΚΑΝΕΙΣ. Ο τρόπος πληρωμής έχει φορολογική
      // σημασία στην εφαρμογή (τα ενοίκια κατοικίας θέλουν τράπεζα για την
      // τεκμαρτή έκπτωση) και εδώ γραφόταν σταθερά «μετρητά» επειδή έτσι
      // βολεύει τη φόρμα. Μένει κενό: ο χρήστης το συμπληρώνει αν χρειαστεί.
      await must(expenseStore.insert(supabase, [expenseStore.row({ propertyId, userId }, {
        description: description.slice(0, 120), amount,
        category, expense_group: group,
        date: useDate,
        paid: true,
      })]));
      setCtxStr('');   // ξαναφόρτωσε το πλαίσιο ώστε να «ξέρει» τη νέα δαπάνη
      loadContext();
      setMsgs(m => [...m, { role: 'assistant', text: `Το κατέγραψα. Πρόσθεσα δαπάνη «${description}» ${eur(amount)}${monthLbl} στην κατηγορία «${category}»${deductible ? ' (εκπεστέα σε καθεστώς επιχείρησης· ο ιδιώτης με εισόδημα από ακίνητα δεν εκπίπτει αναλυτικά έξοδα, ισχύει η τεκμαρτή έκπτωση 5%)' : ''}. Αν η κατηγορία ή ο μήνας δεν είναι σωστά, άλλαξέ τα στις Δαπάνες.`, action: { type: 'go', tab: 'finances' } }]);
    } catch {
      setMsgs(m => [...m, { role: 'assistant', text: 'Δεν μπόρεσα να αποθηκεύσω τη δαπάνη τώρα. Δοκίμασε ξανά ή πρόσθεσέ την από την καρτέλα Δαπάνες.' }]);
    }
  };

  // Σήμανση ΥΠΑΡΧΟΝΤΟΣ ανοιχτού στοιχείου (λογαριασμός ή δόση ενοικίου) ως πληρωμένου.
  // Ασφαλές: αν δεν υπάρχει ΜΟΝΑΔΙΚΗ σαφής αντιστοίχιση, ΔΕΝ μαντεύει — ζητά διευκρίνιση.
  const markPaid = async (description: string, amount?: number) => {
    const q = (description || '').trim().toLowerCase();
    const norm = (s: string) => s.toLowerCase();
    const amtOk = (a: number) => amount == null || (a > 0 && Math.abs(a - amount) / a <= 0.01);
    const bills = openBills;
    const rents = openRent;
    // Υποψήφια: λογαριασμοί (όνομα/κατηγορία ταιριάζει με το κείμενο) + δόσεις ενοικίου.
    // Προσοχή: ΠΟΤΕ να μη ταιριάζει με κενή κατηγορία (q.includes('') === true) — θα
    // σημείωνε λάθος λογαριασμό ως πληρωμένο.
    const textHit = (field: string) => { const f = norm(field).trim(); return !!f && f.length >= 2 && (f.includes(q) || q.includes(f)); };
    const billHits = bills.filter(b => (textHit(b.name) || textHit(b.category)) && amtOk(b.amount));
    const rentHits = /ενοικ|μισθωμ|δοση|δόση/.test(q) || rents.some(r => norm(r.label).includes(q))
      ? rents.filter(r => amtOk(r.amount) && (norm(r.label).includes(q) || /ενοικ|μισθωμ|δοση|δόση/.test(q)))
      : [];
    const totalHits = billHits.length + rentHits.length;
    if (totalHits === 0) {
      const opts = [...bills.map(b => `${b.name} ${eur(b.amount)}`), ...rents.map(r => `${r.label} ${eur(r.amount)}`)];
      setMsgs(m => [...m, { role: 'assistant', text: opts.length ? `Δεν βρήκα ανοιχτό στοιχείο που να ταιριάζει καθαρά με «${description}». Ποιο εννοείς; Ανοιχτά: ${opts.slice(0, 12).join('· ')}.` : `Δεν βλέπω ανοιχτούς λογαριασμούς ή δόσεις ενοικίου για αυτό το ακίνητο.` }]);
      return;
    }
    if (totalHits > 1) {
      const opts = [...billHits.map(b => `${b.name} ${eur(b.amount)}`), ...rentHits.map(r => `${r.label} ${eur(r.amount)}`)];
      setMsgs(m => [...m, { role: 'assistant', text: `Ταιριάζουν περισσότερα από ένα. Σε ποιο να το αντιστοιχίσω; ${opts.join('· ')}.` }]);
      return;
    }
    try {
      const today = athensToday();
      if (billHits.length === 1) {
        const b = billHits[0];
        await must(billStore.markPaid(supabase, b.id));
        await must(expenseStore.updateByBill(supabase, b.id, { paid: true }));
        setMsgs(m => [...m, { role: 'assistant', text: `Έγινε. Σημείωσα τον λογαριασμό «${b.name}» ${eur(b.amount)} ως πληρωμένο.`, action: { type: 'go', tab: 'finances' } }]);
      } else {
        const r = rentHits[0];
        // Δύο στήλες από τις τέσσερις γράφονταν εδώ: η μέθοδος έμενε κενή και οι
        // ημέρες καθυστέρησης μηδέν, ακόμη και σε δόση τριών μηνών πίσω.
        await must(rentStore.markPaid(supabase, r.id, r.due, today, null));
        setMsgs(m => [...m, { role: 'assistant', text: `Έγινε. Σημείωσα τη δόση «${r.label}» ${eur(r.amount)} ως πληρωμένη.`, action: { type: 'go', tab: 'tenant' } }]);
      }
      setCtxStr(''); loadContext();
    } catch {
      setMsgs(m => [...m, { role: 'assistant', text: 'Δεν μπόρεσα να το σημειώσω πληρωμένο τώρα. Δοκίμασε ξανά ή κάν’ το από την αντίστοιχη καρτέλα.' }]);
    }
  };


  // Δημιουργία/αντιγραφή συνδέσμου pre-check-in για πελάτη.
  const makeCheckinLink = async (who: string) => {
    const c = findClient(who);
    if (!c) { setMsgs(m => [...m, { role: 'assistant', text: `Δεν βρήκα ξεκάθαρα τον πελάτη «${who}». Πες μου ακριβές όνομα ή τηλέφωνο, ή άνοιξε τους ${navLabel('clients')}.`, action: { type: 'go', tab: 'clients' } }]); return; }
    if (!(await ensureDpa(supabase))) { setMsgs(m => [...m, { role: 'assistant', text: 'Δεν έφτιαξα τον σύνδεσμο: για στοιχεία τρίτων χρειάζεται πρώτα η αποδοχή της σύμβασης επεξεργασίας. Ζήτα μου ξανά τον σύνδεσμο και πάτησε «Αποδέχομαι».' }]); return; }
    try {
      // Το ίδιο ζευγάρι σφαλμάτων ήταν κι εδώ, αντιγραμμένο από την καρτέλα
      // Πελατών: διεύθυνση από τον περιηγητή κι κουπόνι που δεν ανανεωνόταν. Ο
      // κανόνας ζει πλέον σε ένα σημείο, στο `lib/data/checkinLink.ts`.
      const data = await must(checkinLink.issue(supabase, userId, c.id, propertyId, new Date()));
      if (data?.token) {
        const url = checkinLink.checkinUrl(data.token);
        // Λέμε «αντέγραψα» μόνο αν έγινε. Σε iOS χωρίς χειρονομία ή άδεια το
        // πρόχειρο μένει άδειο και ο σύνδεσμος πρέπει να αντιγραφεί από εδώ.
        let copied = false;
        try { await navigator.clipboard.writeText(url); copied = true; } catch { /* ο σύνδεσμος φαίνεται στο μήνυμα */ }
        const text = copied
          ? `Έτοιμο. Αντέγραψα τον σύνδεσμο check-in για «${c.name}». Στείλ’ τον στον επισκέπτη σε WhatsApp ή Viber:\n${url}`
          : `Ο σύνδεσμος check-in για «${c.name}» είναι έτοιμος. Αντέγραψέ τον από εδώ και στείλ’ τον στον επισκέπτη:\n${url}`;
        setMsgs(m => [...m, { role: 'assistant', text, action: { type: 'go', tab: 'clients' } }]);
      } else throw new Error('no token');
    } catch {
      setMsgs(m => [...m, { role: 'assistant', text: `Δεν μπόρεσα να φτιάξω τον σύνδεσμο τώρα. Δοκίμασε από την καρτέλα του πελάτη στους ${navLabel('clients')}.`, action: { type: 'go', tab: 'clients' } }]);
    }
  };

  // Προσθήκη επαφής (τεχνικός/πάροχος) στην καρτέλα Επαφές, με αυτόματο ρόλο.
  const registerContact = async (name: string, phone?: string, role?: string) => {
    const roleValue = inferRole(role || name);
    try {
      const { error } = await contactStore.add(supabase, propertyId, userId, {
        full_name: name.slice(0, 120), role: roleValue,
        phone: phone || null, email: null, notes: null,
      });
      if (error) throw error;
      setMsgs(m => [...m, { role: 'assistant', text: `Την κράτησα. Πρόσθεσα την επαφή «${name}»${phone ? ` (${phone})` : ''} στις Επαφές του ακινήτου. Θέλεις να ανοίξω τις Επαφές για να προσθέσεις κι άλλα;`, action: { type: 'go', tab: 'contacts' } }]);
    } catch (e) {
      setMsgs(m => [...m, { role: 'assistant', text: `${failed('Η επαφή δεν αποθηκεύτηκε', e)} Μπορείς να την προσθέσεις και από τις «${navLabel('contacts')}».` }]);
    }
  };

  // Καταχώρηση αντικειμένου στην Απογραφή (από τη συνομιλία, με φωνή/κείμενο ή φωτο).
  const registerInventory = async (a: { name: string; category?: string; value?: number; brand?: string; model?: string; room?: string }) => {
    try {
      const { error } = await inventory.add(supabase, propertyId, userId, [{
        name: a.name.slice(0, 120), category: a.category || 'Λοιπά',
        brand: a.brand || null, model: a.model || null, room: a.room || null,
        purchase_value: a.value || 0, condition: 'Καλή',
      }]);
      if (error) throw error;
      setMsgs(m => [...m, { role: 'assistant', text: `Το κατέγραψα στα «${navLabel('inventory')}»: «${a.name}»${a.value ? ` (αξία ${eur(a.value)})` : ''}. Θέλεις να ανοίξω την καρτέλα για να προσθέσεις φωτογραφία, εγγύηση ή άλλες λεπτομέρειες;`, action: { type: 'go', tab: 'inventory' } }]);
    } catch (e) {
      setMsgs(m => [...m, { role: 'assistant', text: `${failed('Το αντικείμενο δεν καταγράφηκε', e)} Μπορείς να το προσθέσεις και από την καρτέλα «${navLabel('inventory')}».` }]);
    }
  };


  // Προσθήκη νέας εκκρεμότητας — με προθεσμία/κόστος/προτεραιότητα & αυτόματο κύκλωμα.
  const addTask = async (a: { description: string; category?: string; due_date?: string; est_cost?: number; priority?: string }) => {
    const d = a.description.slice(0, 200);
    const category = a.category || (/φόρο|ενφια|ε2|ε1|δήλωσ|ααδε|μισθωτήρι|ασφαλιστ/i.test(d) ? 'legal'
      : /υδραυλικ|ηλεκτρολ|επισκευ|συντήρησ|βλάβη|βαφ|καθαρι|μάστορ/i.test(d) ? 'maintenance'
      : /πληρωμ|λογαριασμ|δόση|κόστος/i.test(d) ? 'financial' : 'other');
    const priority = a.priority || 'normal';
    const due = a.due_date || null;
    const est = a.est_cost || 0;
    try {
      const ins = await must(checklist.addReturning(supabase, {
        property_id: propertyId, user_id: userId, description: d,
        category, priority, recurring: 'none', due_date: due,
        status: 'pending', completed: false, note: null,
        estimated_cost: est, actual_cost: 0, sort_order: 0,
      }));
      const newId = (ins as { id?: string } | null)?.id;
      // Κύκλωμα: μόνο ημερολόγιο (email υπενθύμιση). Δαπάνη ΔΕΝ γράφεται — γιατί, πιο κάτω.
      let calId: string | null = null;
      if (newId && due) { const data = await must(calendar.add(supabase, { propertyId, userId }, 'checklist', { title: d, event_date: due, category: 'maintenance', amount: est, priority: priority === 'normal' ? 'medium' : priority as calendar.EventPriority })); calId = data?.id || null; }
      // ΜΙΑ ΕΚΤΙΜΗΣΗ ΔΕΝ ΓΙΝΕΤΑΙ ΔΑΠΑΝΗ. Εδώ γραφόταν γραμμή στον πίνακα
      // `expenses` με ποσό που είχε βγάλει το ΜΟΝΤΕΛΟ («θα κοστίσει γύρω στα
      // 150 ευρώ»). Στην επόμενη ερώτηση το ίδιο ποσό επέστρεφε στα συμφραζόμενα
      // ως «Δαπάνες φέτος: σύνολο X» και έμπαινε στην καθαρή απόδοση. Δηλαδή ο
      // βοηθός διάβαζε ως γεγονός ό,τι είχε μαντέψει δύο βήματα πριν.
      //
      // Η ίδια η καρτέλα Εκκρεμότητες έχει ήδη αυτόν τον κανόνα γραμμένο: δαπάνη
      // υπάρχει μόνο όταν υπάρχει παραστατικό. Η εκτίμηση ζει στο
      // `estimated_cost` της εκκρεμότητας, όπου ΕΙΝΑΙ εκτίμηση και το λέει.
      if (newId && calId) await must(checklist.linkEvent(supabase, newId, calId));
      const bits: string[] = [];
      if (due) bits.push('προθεσμία (υπενθύμιση με email αν είναι ενεργές οι ειδοποιήσεις)');
      if (est > 0) bits.push(`εκτίμηση ${eur(est)}`);
      setMsgs(m => [...m, { role: 'assistant', text: `Το πρόσθεσα στις Εκκρεμότητες: «${d}»${bits.length ? `, ${bits.join(', ')}` : ''}. Θέλεις να το δεις;`, action: { type: 'go', tab: 'checklist' } }]);
    } catch {
      setMsgs(m => [...m, { role: 'assistant', text: 'Δεν μπόρεσα να προσθέσω την εκκρεμότητα τώρα. Δοκίμασε από την καρτέλα Εκκρεμότητες.' }]);
    }
  };

  // Καταχώρηση νέου πελάτη στο Πελατολόγιο (από τη συνομιλία, με φωνή ή κείμενο).
  const registerClient = async (a: { name: string; phone?: string; afm?: string; ctype?: string }) => {
    const raw = (a.ctype || '').toLowerCase();
    const ctype: ClientType = /owner|ιδιοκτ/.test(raw) ? 'owner' : /client|πελατ/.test(raw) ? 'client' : 'lead';
    // Στοιχεία τρίτου (όνομα, τηλέφωνο, ΑΦΜ): πρώτα η σύμβαση επεξεργασίας. Το
    // παράθυρο αποδοχής ανοίγει πάνω από τη συνομιλία (ABOVE_ASSISTANT_Z).
    if (!(await ensureDpa(supabase))) { setMsgs(m => [...m, { role: 'assistant', text: 'Δεν το καταχώρησα: για στοιχεία τρίτων χρειάζεται πρώτα η αποδοχή της σύμβασης επεξεργασίας. Ζήτα μου ξανά την καταχώρηση και πάτησε «Αποδέχομαι» στο παράθυρο που θα ανοίξει.' }]); return; }
    try {
      await must(supabase.from('clients').insert({
        user_id: userId, full_name: a.name, type: ctype,
        phone: a.phone || null, afm: a.afm || null, stage: 'lead',
      }));
      setClientsStr('');
      loadContext();
      setMsgs(m => [...m, { role: 'assistant', text: `Έγινε η καταχώρηση. Πρόσθεσα «${a.name}»${a.phone ? ` (${a.phone})` : ''} στους ${navLabel('clients')} ως ${CLIENT_TYPE_LABELS[ctype]}. Θέλεις να ανοίξω την καρτέλα για να συμπληρώσεις κι άλλα στοιχεία;`, action: { type: 'go', tab: 'clients' } }]);
    } catch {
      setMsgs(m => [...m, { role: 'assistant', text: `Δεν μπόρεσα να αποθηκεύσω τον πελάτη τώρα. Δοκίμασε ξανά ή πρόσθεσέ τον από την καρτέλα ${navLabel('clients')}.` }]);
    }
  };

  // Κράτηση ραντεβού: γράφει γεγονός στο Ημερολόγιο. Η υπάρχουσα ροή υπενθυμίσεων
  // (send-reminders) στέλνει email 3 & 1 ημέρα πριν, αν ο χρήστης έχει ενεργές ειδοποιήσεις.
  const bookAppointment = async (title: string, date: string, time?: string) => {
    // Κατηγορία από τον τίτλο (ώστε π.χ. «check κλιματιστικό» να πάει σε Συντήρηση, όχι Οικονομικά).
    const t = (title || '').toLowerCase();
    const category = /service|συντήρησ|καθαρισ|κλιματ|κλίμα|clima|air ?cond|λέβητ|καυστήρ|θερμοσίφ|βλάβ|επισκευ|υδραυλ|ηλεκτρολ|ψυκτ|μάστορ|συνεργ|έλεγχ|check/.test(t) ? 'maintenance'
      : /τράπεζ|δάνει|χρηματοδ|λογιστ|φορο|ενφια|εφορ|πληρωμ|είσπραξ/.test(t) ? 'financial'
      : /ενοικιαστ|μισθωτ|tenant|συμβόλαι|μίσθωσ/.test(t) ? 'tenant'
      : 'reminder';
    try {
      // Αποφυγή διπλοεγγραφής: ίδιο ακίνητο + τίτλος + ημερομηνία υπάρχει ήδη.
      if (await calendar.exists(supabase, propertyId, { eventDate: date, title })) {
        setMsgs(m => [...m, { role: 'assistant', text: `Υπάρχει ήδη «${title}» για εκείνη την ημερομηνία στο Ημερολόγιο, δεν το ξαναπρόσθεσα. Θέλεις να το δεις;`, action: { type: 'go', tab: 'calendar' } }]);
        return;
      }
      await must(calendar.insert(supabase, [calendar.row({ propertyId, userId }, 'assistant', {
        title, category,
        event_date: date, event_time: time || null, duration_minutes: time ? 60 : null,
        priority: 'high',
        notes: `Ραντεβού που προγραμμάτισε η ${ASSISTANT_NAME}. Θα σταλεί υπενθύμιση πριν από το ραντεβού (email, εφόσον είναι ενεργές οι ειδοποιήσεις· με ένα άγγιγμα και σε Viber/WhatsApp).`,
      })]));
      const whenStr = `${new Date(date).toLocaleDateString('el-GR')}${time ? ` στις ${time}` : ''}`;
      setMsgs(m => [...m, { role: 'assistant', text: `Το έκλεισα. Πρόσθεσα το «${title}» για ${whenStr} στο Ημερολόγιο. Αν οι ειδοποιήσεις email είναι ενεργές, θα λάβεις υπενθύμιση πριν από το ραντεβού. Θέλεις να ανοίξω το Ημερολόγιο;`, action: { type: 'go', tab: 'calendar' } }]);
    } catch {
      setMsgs(m => [...m, { role: 'assistant', text: 'Δεν μπόρεσα να αποθηκεύσω το ραντεβού τώρα. Δοκίμασε ξανά ή πρόσθεσέ το χειροκίνητα στο Ημερολόγιο.' }]);
    }
  };

  return { runAction, findContact, buildReachLink, commitPendingDoc }
}

export type AssistantActions = ReturnType<typeof useAssistantActions>
