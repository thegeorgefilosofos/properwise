'use client';

// ═══════════════════════════════════════════════════════════════════════════
// ΕΠΙΣΚΕΠΤΕΣ ΒΡΑΧΥΧΡΟΝΙΑΣ ΜΙΣΘΩΣΗΣ — όχι CRM επαγγελματία σε ιδιώτη με ένα εξοχικό.
//
// ΤΙ ΕΦΥΓΕ ΚΑΙ ΓΙΑΤΙ
//
// 1. Η «ΜΑΥΡΗ ΛΙΣΤΑ» (`do_not_rent`) με ονοματεπώνυμο, ΑΦΜ και αριθμό
//    ταυτότητας. Είναι κατηγοριοποίηση προσώπου με νομικό βάρος (GDPR) για
//    μηδέν αντάλλαγμα — και εμφανιζόταν ως ετικέτα «Προσοχή» πάνω σε όνομα
//    ανθρώπου. Ό,τι χρειάζεται πραγματικά ο οικοδεσπότης χωρά σε μια ιδιωτική
//    σημείωση χωρίς ετικέτα κατηγορίας και αυτό μένει.
// 2. Εθνικότητα, αριθμός ταυτότητας, διεύθυνση, ΑΦΜ, πηγή γνωριμίας, ελεύθερες
//    ετικέτες, 5 αστέρια, VIP, τμηματοποίηση. Δεδομένα προσωπικού χαρακτήρα και
//    πεδία πωλήσεων που δεν προκαλούσαν ΚΑΜΙΑ ενέργεια στην εφαρμογή.
// 3. Το κατώφλι VIP στα 1.000€: επινοημένο και άσχετο με το μέγεθος του ακινήτου.
// 4. Το KPI «Επαναλαμβανόμενοι». Ο επισκέπτης του Airbnb έρχεται μία φορά· το
//    νούμερο θα έδειχνε 0 για πάντα, δηλαδή κατέλαβε μια θέση KPI για να πει
//    ψέματα για την αξία του προϊόντος.
// 5. Το drawer «Αναφορές». Τα δύο γραφήματα που είχαν νόημα (ανά κανάλι, ανά
//    μήνα) ανέβηκαν στην ΚΥΡΙΑ οθόνη — «η σύγκριση είναι η κεντρική οθόνη, όχι
//    λειτουργία σε υπομενού». Τα «Κορυφαίοι πελάτες» και «Ποιότητα φιλοξενίας»
//    έφυγαν.
//
// ΤΙ ΠΡΟΣΤΕΘΗΚΕ
//
// α) Η ΓΡΑΜΜΗ ΤΟΥ ΑΜΑ στην κορυφή — ποτέ πίσω από paywall.
// β) ΑΚΑΘΑΡΙΣΤΑ ΞΕΧΩΡΙΣΤΑ ΑΠΟ PAYOUT. Ο εισαγωγέας email ζητούσε ρητά «το ποσό
//    που εισπράττει ο οικοδεσπότης (payout)» και το έγραφε στο `total`, το οποίο
//    η φορολογική μηχανή διάβαζε ως `grossRevenue`. Πλέον καταγράφονται τρία
//    ξεχωριστά ποσά (τι πλήρωσε ο επισκέπτης, προμήθεια, τέλος ανθεκτικότητας)
//    και το ακαθάριστο ΥΠΟΛΟΓΙΖΕΤΑΙ. Οι ιστορικές γραμμές σημαίνονται ως
//    απροσδιόριστες και ζητείται επιβεβαίωση στην πρώτη επεξεργασία.
// γ) ΔΗΛΩΣΗ ΒΡΑΧΥΧΡΟΝΙΑΣ ΔΙΑΜΟΝΗΣ ανά κράτηση (`declared_at`), με σήμα
//    «αδήλωτη» και μετρητή στα KPI. ~2,47 εκατ. δηλώσεις πανελλαδικά το 2025,
//    μία ανά κράτηση — και το εργαλείο που είχε όλες τις κρατήσεις δεν
//    παρακολουθούσε καμία.
// δ) ΣΥΝΔΕΣΗ ΦΘΟΡΑΣ ΜΕ ΤΗΝ ΑΠΟΓΡΑΦΗ (`damage_item_id`), ώστε η φθορά να γίνεται
//    δαπάνη με παραστατικό για τον λογιστή, όχι ελεύθερο κείμενο.
//
// Μένουν: όνομα, τηλέφωνο/email, κανάλι, ημερομηνίες, ποσά, φθορές, δήλωση.
// Cross-property (ανά χρήστη). Χρώμα μόνο σε γνήσια σήματα.
// ═══════════════════════════════════════════════════════════════════════════
import { Users, SearchX } from 'lucide-react';
import { T, PageTitle, KPIGrid, Badge, InfoBanner, Btn, IconBtn, ChipToggle, LinkBtn, EmptyState, Skeleton, SkeletonKPIs, SecHdr, Modal, SideSheet, fe, fd, fp, ABSENT_DATE, fixedCols, RecordCard, StatStrip } from '@/components/Theme';
import { hy } from '@/components/Hyphen';
import { NumberInput, TextInput, CustomSelect, DatePicker, Textarea, Toggle } from './UIComponents';
import MonthBars from '@/components/MonthBars';

import ClientCompose from './ClientCompose';
import { ActionMenu } from '@/components/ActionMenu';
import {
  stayNights, stayTotal, clientStats,
  STAY_CHANNEL_LABELS, NOTE_KIND_LABELS,
} from '@/lib/clients/clients';
import {
  declarableGross, hostPayout, needsAmountReview, isDeclared, awaitsDeclaration,
  AMOUNT_BASIS_LABELS, type AmountBasis,
} from '@/lib/clients/stayAmounts';
import { MSG_TEMPLATES, buildMessage, whatsappLink, viberLink as viberTextLink } from '@/lib/clients/messages';
import { revenueByChannel, revenueByMonth, occupancyFromMonths, totals } from '@/lib/clients/reports';
import { nightsByMonthForYear } from '@/lib/tax/shortTermTax';
import { PLATFORM_FEE_NOTE } from '@/lib/billing/consolidate';
import { navLabel } from '@/lib/nav/labels';
import { isoYear } from '@/lib/core/time';
import { MONTHS_NOM } from '@/lib/core/months';
import { MONTHS_ACC } from '@/lib/core/months';
import {
  type Stay,
  DOC_KINDS, DOC_KIND_LABELS, fmtBytes, todayStr, undeclaredLabel,
  msgDigits, waLink, viberLink, channelOptions, noteKindOptions,
} from './clients/model'
import { avatar, statTile } from './clients/Bits'
import { useClients, type ClientsProps } from './clients/useClients'
import { EmailStayModal, IcalImportModal } from './clients/ImportModals'

export default function TabClients({ userId, onSelectProperty }: ClientsProps) {
  const {
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
  } = useClients({ userId, onSelectProperty })

  // ── Κοινά inline styles ────────────────────────────────────────────────────
  const inp: React.CSSProperties = { background: 'var(--bg-base)', border: '1px solid var(--border-default)', borderRadius: T.radius.xs, padding: '10px 16px', color: 'var(--text-primary)', fontSize: 14, height: T.h.lg, width: '100%', outline: 'none', boxSizing: 'border-box', fontFamily: T.font.sans };
  const lbl: React.CSSProperties = { fontSize: 'var(--fs-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', display: 'block', marginBottom: 8, fontFamily: T.font.sans };
  const msgLink: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: T.h.sm, fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--accent)', textDecoration: 'none', padding: '3px 9px', borderRadius: T.radius.pill, border: '1px solid var(--border-subtle)', background: 'var(--accent-soft)', whiteSpace: 'nowrap' };
  // Chip επικοινωνίας (ίδιο ύφος με msgLink, με inline εικονίδιο).
  const contactChip: React.CSSProperties = { ...msgLink, display: 'inline-flex', alignItems: 'center', gap: 4, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' };
  const fGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 14 };
  // Επικεφαλίδα ενότητας φόρμας (καθαρή, με τελεία accent και λεπτή γραμμή). Απλή
  // συνάρτηση που επιστρέφει JSX (όχι component) ώστε να μη χάνουν focus τα πεδία.
  //
  // ΤΟ `top` ΥΠΑΡΧΕΙ ΓΙΑ ΕΝΑ ΣΗΜΕΙΟ: όταν η επικεφαλίδα είναι το ΠΡΩΤΟ στοιχείο
  // στο σώμα ενός Modal, το κενό το δίνει ήδη το padding του primitive (24) και
  // το περιθώριο 18 από πάνω γινόταν 42 εικονοστοιχεία λευκού πάνω από μια
  // ετικέτα ύψους 10. Παντού αλλού μένει 18, γιατί εκεί χωρίζει δύο ενότητες.
  const secHead = (t: string, top = 18) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: `${top}px 0 10px` }}>
      <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: T.font.sans, whiteSpace: 'nowrap' }}>{t}</span>
      <span style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
    </div>
  );
  const initials = (form.full_name.trim().split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('') || '+').toUpperCase();

  // Ο γυμνός Spinner δεν έλεγε τίποτα για το τι έρχεται και το ύψος του δεν είχε
  // σχέση με το τελικό περιεχόμενο — μόλις φόρτωναν τα δεδομένα η σελίδα πηδούσε.
  // Το σχήμα (4 KPIs + πλέγμα καρτών) είναι γνωστό, άρα ο σκελετός το προδιαγράφει.
  if (loading) return (
    <>
      <SkeletonKPIs n={4} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 14 }}>
        {[0, 1, 2].map(i => <Skeleton key={i} h={190} r={T.radius.card} />)}
      </div>
    </>
  );

  const unlinkedProps = props.filter(p => !p.client_id);
  const dc = openId ? clients.find(c => c.id === openId) || null : null;
  const dcStays = dc ? (staysByClient.get(dc.id) || []).slice().sort((a, b) => (b.check_in || '').localeCompare(a.check_in || '')) : [];
  const dcStats = dc ? clientStats(dcStays) : null;
  const dcUndeclared = dcStays.filter(s => awaitsDeclaration(s)).length;
  const dcTotals = totals(dcStays);
  // Η απογραφή του ακινήτου της διαμονής (ή όλη, αν δεν έχει επιλεγεί ακίνητο).
  const invForStay = stayForm.property_id ? inv.filter(i => i.property_id === stayForm.property_id) : inv;
  // Πλαίσιο για τα πρότυπα μηνυμάτων: πελάτης + πρώτο συνδεδεμένο ακίνητο + πιο
  // πρόσφατη διαμονή (τα dcStays είναι σε φθίνουσα σειρά, άρα [0] = πιο πρόσφατη).
  // Οι νύχτες, όταν και οι δύο ημερομηνίες υπάρχουν: αφαίρεση, όχι ερώτηση.
  const derivedNights = stayNights(stayForm.check_in, stayForm.check_out) || null;
  const dcFirstProp = dc ? (propsByClient.get(dc.id) || [])[0] : undefined;
  const msgCtx = dc ? { clientName: dc.full_name, propertyName: dcFirstProp?.name, address: undefined, checkIn: dcStays[0]?.check_in, checkOut: dcStays[0]?.check_out } : null;

  return (
    <div style={{ fontFamily: T.font.sans, color: 'var(--text-primary)' }}>
      {/* Η γραμμή του ΑΜΑ αποδίδεται από τη σελίδα, ΠΑΝΩ από αυτή την καρτέλα και
          δεμένη στο επιλεγμένο ακίνητο. Εδώ υπήρχε δεύτερο αντίγραφο χωρίς
          `propertyId`: ο χρήστης έβλεπε την ίδια προειδοποίηση δύο φορές, τη μία
          για όλα τα ακίνητα μαζί. Δύο φορές το ίδιο δεν είναι έμφαση. */}
      <PageTitle title={navLabel('clients')} sub="Κρατήσεις, δηλωτέα ποσά και εκκρεμείς δηλώσεις διαμονής"
        right={(
          // ΜΙΑ ΚΥΡΙΑ ΕΝΕΡΓΕΙΑ ΚΑΙ ΕΝΑ ΜΕΝΟΥ, ΟΠΩΣ ΣΤΙΣ ΕΠΑΦΕΣ ΚΑΙ ΣΤΗΝ ΑΠΟΓΡΑΦΗ.
          // Πέντε ισοβαρή κουμπιά τύλιγαν σε δύο σειρές στο κινητό, με το
          // «Σύνδεση ημερολογίου» και το «Εξαγωγή διαμονών» σπασμένα στη μέση.
          // Οι εισαγωγές, το μαζικό μήνυμα και η εξαγωγή πάνε στο «Περισσότερα»,
          // που υπάρχει πάντα: η κενή κατάσταση παραπέμπει σε αυτό.
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <ActionMenu label="Περισσότερα" items={[
              { key: 'email', label: 'Εισαγωγή από email', description: 'Επικόλλησε το email της κράτησης και διαβάζονται τα στοιχεία της.', onClick: () => { setEmailOpen(true); setEmailDraft(null); setEmailErr(''); } },
              ...(props.length > 0 ? [{ key: 'ical', label: 'Σύνδεση ημερολογίου', description: 'Οι κρατήσεις έρχονται από τον σύνδεσμο iCal του καναλιού σου.', onClick: openIcal }] : []),
              ...(clients.length > 0 ? [{ key: 'compose', label: 'Μαζικό μήνυμα', description: 'Ένα κείμενο σε πολλούς επισκέπτες μαζί.', onClick: () => setComposeOpen(true) }] : []),
              ...(allStays.length > 0 ? [{ key: 'export', label: 'Εξαγωγή διαμονών', description: 'Όλες οι διαμονές σε Excel, με τα ποσά χωριστά.', onClick: exportCsv }] : []),
            ]} />
            {/* Με μηδέν επισκέπτες, η κύρια ενέργεια λέγεται από την κενή κατάσταση
                λίγο πιο κάτω: δύο ίδια κουμπιά στην ίδια οθόνη δεν είναι έμφαση.
                Οι δύο εισαγωγές μένουν στο μενού: η κενή κατάσταση τις ονομάζει. */}
            {clients.length > 0 && <Btn variant="primary" onClick={openNew}>Νέος επισκέπτης</Btn>}
          </div>
        )} />

      <KPIGrid items={kpis} />

      <ClientCompose open={composeOpen} onClose={() => setComposeOpen(false)} clients={clients} supabase={supabase} />

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} className="po-field field-wide" aria-label="Αναζήτηση επισκέπτη" placeholder="Όνομα, τηλέφωνο ή email"
          /* ═══ Η ΒΑΣΗ ΕΙΝΑΙ 240 ΚΑΙ ΟΧΙ 220, ΓΙΑΤΙ ΤΟΣΟ ΘΕΛΕΙ ΤΟ ΚΕΙΜΕΝΟ ═══════
              Στο iPhone 16 Pro Max (440) το πεδίο και το κουμπί «Με αδήλωτες
              διαμονές» χωρούσαν ΟΡΙΑΚΑ στην ίδια σειρά, οπότε αντί να τυλιχτεί
              το κουμπί συρρικνωνόταν το πεδίο: 202 εικονοστοιχεία για ένα
              «Όνομα, τηλέφωνο ή email» που θέλει 208. Το παράδειγμα κοβόταν στη
              μέση — και το παράδειγμα ΕΙΝΑΙ η οδηγία: λέει τι μπορείς να
              γράψεις εκεί.
              Με βάση 240 το άθροισμα δεν χωρά, το κουμπί κατεβαίνει από κάτω και
              το πεδίο παίρνει όλο το πλάτος. Σε φαρδιά οθόνη δεν αλλάζει τίποτα:
              το ταβάνι των 280 κρατά το πεδίο στο ίδιο μέγεθος. */
          style={{ ...inp, maxWidth: 280, width: 'auto', flex: '1 1 240px' }} />
        {/* Ένα φίλτρο και είναι το χρήσιμο. Τα «VIP / Επαναλαμβανόμενοι /
            Με επισήμανση» έφυγαν: το πρώτο είχε επινοημένο κατώφλι 1.000€, το
            δεύτερο θα ήταν πάντα κενό, το τρίτο ήταν η μαύρη λίστα. */}
        {/* Το φίλτρο κάθεται στην ίδια σειρά με το πεδίο αναζήτησης, οπότε παίρνει το
            ύψος του πεδίου: το περιτύλιγμα δίνει T.h.lg και το πλακίδιο τεντώνεται σε
            αυτό. Με το φυσικό T.h.sm του πλακιδίου έβγαινε 32 δίπλα σε 40. */}
        <span style={{ display: 'inline-flex', height: T.h.lg }}>
          <ChipToggle on={undeclaredOnly} onClick={() => setUndeclaredOnly(v => !v)}>Με αδήλωτες διαμονές</ChipToggle>
        </span>
      </div>

      {clients.length === 0 ? (
        <EmptyState icon={<Users size={20} />} title="Κανένας επισκέπτης ακόμη" hint="Από το «Περισσότερα»: σύνδεσε το ημερολόγιο του καναλιού σου ή επικόλλησε ένα email κράτησης και οι διαμονές έρχονται μόνες τους, με τα ποσά χωριστά." action={<Btn variant="primary" onClick={openNew}>Νέος επισκέπτης</Btn>} />
      ) : filtered.length === 0 ? (
        // Ο έλεγχος από πάνω κοιτούσε τα `clients`, αλλά το πλέγμα αποδίδει τα
        // `filtered`: με αναζήτηση ή φίλτρο που δεν ταιριάζει σε κανέναν, ο χρήστης
        // έβλεπε ΛΕΥΚΟ ΧΩΡΟ και κανέναν τρόπο να καταλάβει ότι φταίει το φίλτρο.
        <EmptyState icon={<SearchX size={20} />} title="Δεν βρέθηκαν επισκέπτες" hint="Δοκίμασε διαφορετική αναζήτηση ή καθάρισε τα φίλτρα." action={<Btn variant="secondary" onClick={() => { setSearch(''); setUndeclaredOnly(false); }}>Καθαρισμός φίλτρων</Btn>} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 14 }}>
          {filtered.map(c => {
            const linked = propsByClient.get(c.id) || [];
            const st = statsByClient.get(c.id) || clientStats([]);
            const cStays = staysByClient.get(c.id) || [];
            const undeclared = undeclaredByClient.get(c.id) || 0;
            const unresolved = cStays.filter(needsAmountReview).length;
            return (
              <RecordCard key={c.id} onOpen={() => setOpenId(c.id)} openLabel={`Άνοιγμα καρτέλας: ${c.full_name}`}
                lead={avatar(c.full_name, 42)}
                title={c.full_name}
                sub={st.lastVisit ? <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>τελ. επίσκεψη {fd(st.lastVisit)}</span>
                  : st.nextArrival ? <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>επόμενη άφιξη {fd(st.nextArrival)}</span> : null}
                badges={<>
                  {undeclared > 0 && <Badge>{undeclaredLabel(undeclared)}</Badge>}
                  {unresolved > 0 && <Badge tone="warning">Ποσό προς επιβεβαίωση</Badge>}
                  {st.hasDamage && <Badge>Φθορές</Badge>}
                </>}
                actions={
                  // Το σταμάτημα της φυσαλίδας μένει στο περιτύλιγμα: το κλικ δεν
                  // πρέπει να φτάσει στην κάρτα, που ανοίγει το ντοσιέ.
                  <span onClick={e => e.stopPropagation()} style={{ display: 'inline-flex' }}>
                    <IconBtn label="Διαγραφή πελάτη" title="Διαγραφή" onClick={() => del(c)}>
                      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                    </IconBtn>
                  </span>
                }>

                {/* Λωρίδα στατιστικών: το βυθισμένο well του βιβλίου. Οι ετικέτες
                    ΔΕΝ κόβονται πια — η λωρίδα κρατά λιγότερες στήλες όταν στενεύει. */}
                {st.stayCount > 0 ? (
                  <StatStrip items={[
                    { label: 'Διαμονές', value: String(st.stayCount) },
                    { label: 'Νύχτες', value: String(st.nights) },
                    { label: 'Ακαθάριστα', value: fe(totals(cStays).revenue), strong: true, title: 'Δηλωτέο ακαθάριστο, χωρίς το τέλος ανθεκτικότητας' },
                    { label: 'Μέση νύχτα', value: fe(st.adr), title: 'Δηλωτέο ακαθάριστο διά τις νύχτες' },
                  ]} />
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Χωρίς καταγεγραμμένες διαμονές</div>
                )}
                {/* Επικοινωνία: compact chips */}
                {(c.phone || c.email) && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {c.phone && <a onClick={e => e.stopPropagation()} href={`tel:${c.phone}`} style={contactChip}>
                      <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z" /></svg>
                      {c.phone}
                    </a>}
                    {c.email && <a onClick={e => e.stopPropagation()} href={`mailto:${c.email}`} style={contactChip}>
                      <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
                      <span className="po-elide">{c.email}</span>
                    </a>}
                    {/* WhatsApp και Viber ΔΕΝ επαναλαμβάνονται εδώ. Ζουν στην
                        καρτέλα του επισκέπτη, μαζί με τα πρότυπα μηνυμάτων —
                        δηλαδή εκεί που ξέρεις ΤΙ θα στείλεις. Στο πλέγμα με
                        δώδεκα κάρτες ήταν σαράντα οκτώ σύνδεσμοι επικοινωνίας. */}
                  </div>
                )}

                {linked.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 2 }}>
                    {linked.map(p => (
                      <button key={p.id} onClick={e => { e.stopPropagation(); onSelectProperty?.(p.id); }} title={`Άνοιγμα: ${p.name}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-xs)', padding: '4px 9px', borderRadius: T.radius.chip, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--accent)', cursor: 'pointer', fontFamily: T.font.sans }}>
                        <svg aria-hidden="true" width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5 12 3l9 6.5" /><path d="M5 10v10h14V10" /></svg>{p.name}
                      </button>
                    ))}
                  </div>
                )}
              </RecordCard>
            );
          })}
        </div>
      )}

      {/* ── ΑΚΑΘΑΡΙΣΤΑ ΑΝΑ ΚΑΝΑΛΙ ΚΑΙ ΑΝΑ ΜΗΝΑ, ΣΤΗΝ ΚΥΡΙΑ ΟΘΟΝΗ ───────────
          Ήταν θαμμένα σε drawer «Αναφορές» μαζί με «Κορυφαίους πελάτες» και
          «Ποιότητα φιλοξενίας». Ο χρήστης δεν ρωτάει «πόσα έβγαλα» — ρωτάει
          «πόσα δηλώνω και από πού ήρθαν». Αυτό δεν είναι υπομενού. */}
      {allStays.length > 0 && (() => {
        // Κείμενο, όχι ρολόι: το `new Date(d).getFullYear()` έριχνε τη διαμονή
        // της Πρωτοχρονιάς στην προηγούμενη χρονιά σε κάθε αρνητική ζώνη ώρας.
        const yearOf = (s: Stay) => isoYear(s.check_in || s.check_out);
        const yearsAvail = Array.from(new Set(allStays.map(yearOf).filter((y): y is number => y != null)));
        if (!yearsAvail.includes(reportYear)) yearsAvail.push(reportYear);
        yearsAvail.sort((a, b) => b - a);
        const yStays = allStays.filter(s => yearOf(s) === reportYear);
        const tot = totals(yStays);
        const chRows = revenueByChannel(yStays);
        const maxCh = Math.max(1, ...chRows.map(r => r.revenue));
        const months = revenueByMonth(yStays, reportYear);
        // ═══ ΔΥΟ ΜΕΤΡΗΤΕΣ ΝΥΧΤΩΝ, ΔΙΠΛΑ ΔΙΠΛΑ, ΜΕ ΔΙΑΦΟΡΕΤΙΚΟ ΑΠΟΤΕΛΕΣΜΑ ══
        //
        // Το `yearOccupancy` μετρά με `nightsInRange`, που απαιτεί ΚΑΙ
        // αναχώρηση: διαμονή χωρίς καταχωρημένο check_out μετράει ΜΗΔΕΝ. Το
        // πλακίδιο «Νύχτες» από πάνω και οι μπάρες καναλιών από κάτω μετρούν με
        // `nightsOf`, που πέφτει πίσω στο `s.nights` που έγραψε ο χρήστης.
        //
        // Ακίνητο με 1 ως 11/7 (10 νύχτες) και μια διαμονή από 5/8 χωρίς
        // αναχώρηση αλλά με 6 νύχτες γραμμένες στο χέρι: η μπάρα έλεγε «16
        // νύχτες» και η πληρότητα υπολόγιζε 10 — δύο αριθμοί στην ίδια οθόνη
        // που αναιρούν ο ένας τον άλλον, χωρίς κανένα σφάλμα πουθενά.
        //
        // Το `occupancyFromMonths` γράφτηκε ακριβώς γι' αυτό: δέχεται ΕΤΟΙΜΟ
        // πίνακα νυχτών, ώστε η οθόνη να μετρά μία φορά. Ο μετρητής είναι ο
        // ίδιος που χρησιμοποιεί και η φορολογική σύνοψη.
        const occ = occupancyFromMonths(nightsByMonthForYear(yStays, reportYear), reportYear);
        return (
          <div style={{ marginTop: T.sp.xxl }}>
            <SecHdr label={`Ακαθάριστα ${reportYear}`} sub="Δηλωτέο ακαθάριστο ανά κανάλι και ανά μήνα, χωρίς το τέλος ανθεκτικότητας, χωρίς αφαίρεση προμήθειας"
              right={
                /* Το Escape κλείνει το popover και ο χρήστης πληκτρολογίου δεν
                   μένει παγιδευμένος μέσα σε τέσσερις χρονιές. Ο ακροατής κάθεται
                   στο περίβλημα και όχι στο `document`: το `useOverlayShell` του
                   Theme κρατά στοίβα για τα ΠΑΡΑΘΥΡΑ και ένα popover που θα
                   άκουγε καθολικά θα έκλεινε μαζί και το ντοσιέ από πίσω. */
                <div style={{ position: 'relative' }}
                  onKeyDown={e => { if (e.key === 'Escape' && reportYearMenu) { e.stopPropagation(); setReportYearMenu(false); } }}>
                  {/* ΜΕΝΕΙ ΧΕΙΡΟΠΟΙΗΤΟ. Ανοίγει λίστα, οπότε θέλει `aria-haspopup` και
                      `aria-expanded` που το `Btn` δεν δέχεται· χωρίς αυτά ο αναγνώστης
                      οθόνης δεν μαθαίνει ούτε ότι υπάρχουν χρονιές από κάτω.

                      Η ΧΡΟΝΙΑ ΕΙΝΑΙ ΕΤΙΚΕΤΑ ΧΕΙΡΙΣΤΗΡΙΟΥ, ΟΧΙ ΣΤΗΛΗ ΠΙΝΑΚΑ. Η
                      γραμματοσειρά πυκνών πινάκων βάζει πλατιά κενά γύρω από κάθε
                      ψηφίο: μέσα σε πλακίδιο δίπλα σε ελληνικά λεκτικά διαβάζεται
                      ως κώδικας. Η γραμματοσειρά αριθμών είναι το ΙΔΙΟ Inter με το
                      υπόλοιπο κείμενο και το `tabular-nums` κρατά τα ψηφία
                      στοιχισμένα όταν αλλάζει η χρονιά. */}
                  <button type="button" onClick={() => setReportYearMenu(m => !m)}
                    aria-haspopup="listbox" aria-expanded={reportYearMenu}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: T.h.sm, padding: '0 10px', borderRadius: T.radius.chip, border: '1px solid var(--border-default)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums', fontSize: 'var(--fs-base)', fontWeight: 700, cursor: 'pointer' }}>
                    {reportYear}
                    <svg aria-hidden="true" width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: reportYearMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', opacity: 0.7 }}><path d="m6 9 6 6 6-6" /></svg>
                  </button>
                  {/* ΔΕΝ ΕΙΝΑΙ ΠΑΡΑΘΥΡΟ, ΑΡΑ ΔΕΝ ΓΙΝΕΤΑΙ Modal. Είναι popover
                      αγκυρωμένο στο κουμπί του έτους: χωρίς τίτλο, χωρίς σώμα,
                      χωρίς ενέργειες — μία στήλη με τέσσερα χρόνια. Το `fixed
                      inset: 0` από κάτω είναι ΔΙΑΦΑΝΟ, μόνο για να πιάνει το
                      κλικ έξω· δεν παίρνει T.scrim, γιατί ένα σκοτείνιασμα
                      ολόκληρης της σελίδας για να διαλέξεις χρονιά θα διάβαζε
                      σαν «σταμάτησαν όλα». Ευθυγραμμίστηκε μόνο η ακτίνα με το
                      token (ίδια τιμή, μία πηγή). */}
                  {reportYearMenu && (
                    <>
                      {/* ΠΕΠΛΟ ΚΛΕΙΣΙΜΑΤΟΣ, ΟΧΙ ΚΟΥΜΠΙ. Πιάνει το κλικ έξω από το μενού
                          και δεν έχει καμία δική του σημασία. Ένα `role="button"` εδώ θα
                          ανακοίνωνε στον αναγνώστη οθόνης ένα κουμπί χωρίς όνομα και θα
                          έβαζε έναν επιπλέον σταθμό στο Tab, για το τίποτα: το πρότυπο
                          ζητά να είναι διάφανο και το κλείσιμο με πληκτρολόγιο να γίνεται
                          με Escape. Το `aria-hidden` το λέει ρητά. */}
                      <div aria-hidden onClick={() => setReportYearMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                      <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 50, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.inner, boxShadow: 'var(--elev-3)', padding: 6, minWidth: 96, maxHeight: 220, overflowY: 'auto' }}>
                        {yearsAvail.map(y => (
                          <button key={y} type="button" onClick={() => { setReportYear(y); setReportYearMenu(false); }}
                            style={{ display: 'block', width: '100%', padding: '7px 10px', borderRadius: T.radius.chip, border: 'none', background: y === reportYear ? 'var(--accent-dim)' : 'transparent', color: y === reportYear ? 'var(--accent)' : 'var(--text-primary)', fontFamily: T.font.mono, fontSize: 'var(--fs-base)', fontWeight: y === reportYear ? 700 : 500, cursor: 'pointer', textAlign: 'left' }}>{y}</button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              } />

            {tot.unresolved > 0 && (
              <InfoBanner tone="warning">
                {tot.unresolved} από τις {tot.count} διαμονές του {reportYear} έχουν <strong>απροσδιόριστο ποσό</strong> ({fe(tot.unresolvedAmount)}): καταγράφηκαν πριν η εφαρμογή ξεχωρίσει τα ακαθάριστα από την καθαρή είσπραξη και δεν μαντεύουμε ποιο από τα δύο είναι. Άνοιξε τη διαμονή και συμπλήρωσε τι πλήρωσε ο επισκέπτης. Χωρίς αυτό, τα ακαθάριστα εδώ είναι εκτίμηση.
              </InfoBanner>
            )}

            {/* Η ΠΛΗΡΟΤΗΤΑ ΜΕ ΣΩΣΤΟ ΠΑΡΟΝΟΜΑΣΤΗ και δεύτερο νούμερο για την
                υψηλή περίοδο. Πριν διαιρούσε με 365 και το εποχιακό εξοχικό
                εμφανιζόταν στο «16%». */}
            <div className="tile-row" style={{ marginBottom: 16 }}>
              {statTile(tot.unresolved > 0 ? 'Ακαθάριστα, ενδεικτικά' : 'Δηλωτέα ακαθάριστα', fe(tot.revenue))}
              {statTile('Τέλος ανθεκτικότητας', tot.climateLevy > 0 ? fe(tot.climateLevy) : fe(0), { title: 'Εισπράχθηκε από τους επισκέπτες για λογαριασμό του κράτους. Δεν είναι έσοδό σου.' })}
              {statTile('Προμήθειες πλατφορμών', tot.platformFees > 0 ? fe(tot.platformFees) : fe(0), { title: 'Δαπάνη που εκπίπτει. ΔΕΝ μειώνει το δηλωτέο έσοδο.' })}
              {/* ΤΟ ΠΟΣΟΣΤΟ ΠΕΡΝΑ ΑΠΟ ΤΟΝ ΜΟΡΦΟΠΟΙΗΤΗ. Γραφόταν `${occ.pct}%`,
                  δηλαδή ο ωμός αριθμός με τελεία: «87.5%» ακριβώς δίπλα σε
                  «1.234,56€» της ίδιας γραμμής — δύο συστήματα αρίθμησης σε
                  ένα πλαίσιο και στα ελληνικά η τελεία χωρίζει χιλιάδες. */}
              {statTile(
                'Πληρότητα',
                occ.availableDays > 0 ? fp(occ.pct) : 'Χωρίς κρατήσεις',
                { title: occ.openFromMonth != null
                    ? `${occ.bookedNights} νύχτες σε ${occ.availableDays} διαθέσιμες ημέρες, από ${MONTHS_ACC[occ.openFromMonth]} έως ${MONTHS_ACC[occ.openToMonth!]} ${reportYear}, όχι σε 365${occ.overbooked ? '. Οι νύχτες ξεπερνούν τις διαθέσιμες ημέρες: κάπου δύο κρατήσεις πέφτουν στην ίδια νύχτα.' : ''}`
                    : 'Χωρίς κρατήσεις' },
              )}
              {occ.peak && statTile(
                'Πληρότητα υψηλής περιόδου',
                fp(occ.peak.pct),
                { title: `Από ${MONTHS_ACC[occ.peak.fromMonth]} έως ${MONTHS_ACC[occ.peak.toMonth]}: ${occ.peak.bookedNights} νύχτες σε ${occ.peak.days} ημέρες. Η περίοδος βγαίνει από ΤΑ ΔΙΚΑ ΣΟΥ δεδομένα, δεν την αποφασίσαμε εμείς.` },
              )}
            </div>

            {/* ═══ ΤΑ ΔΥΟ ΓΡΑΦΗΜΑΤΑ ΑΠΑΝΤΟΥΝ, ΑΝΤΙ ΝΑ ΚΑΘΟΝΤΑΙ ══════════════════════
                ΤΙ ΗΤΑΝ. Δώδεκα ορθογώνια με `title` και τρεις μπάρες με σκέτο
                χρώμα. Κανένα από τα δύο δεν είχε όνομα για αναγνώστη οθόνης,
                κανένα δεν εστιαζόταν με πληκτρολόγιο, κανένα δεν αντιδρούσε στο
                πέρασμα του δείκτη — και το `title` του περιηγητή ΔΕΝ εμφανίζεται
                ποτέ σε οθόνη αφής, δηλαδή στο κινητό το γράφημα των μηνών δεν
                έλεγε ούτε έναν αριθμό.

                ΚΑΙ ΤΑ ΔΥΟ ΚΟΥΤΙΑ ΗΤΑΝ ΑΛΛΟ ΚΟΥΤΙ: αριστερά βαθούλωμα πάνω στη
                βάση, δεξιά ανασηκωμένη κάρτα με περίγραμμα. Δύο επιφάνειες για
                δύο γραφήματα που κάθονται δίπλα δίπλα, στην ίδια σειρά.

                Το δωδεκάμηνο είναι πλέον το ΙΔΙΟ component με την κάρτα των
                δαπανών (components/MonthBars.tsx) και οι μπάρες των καναλιών
                μιλούν την ίδια γλώσσα: ίδια πίστα, ίδιο μελάνι σε δύο εντάσεις,
                ίδιο δαχτυλίδι εστίασης. */}
            {/* ΤΑ ΔΥΟ ΚΟΥΤΙΑ ΕΧΟΥΝ ΤΟ ΙΔΙΟ ΥΨΟΣ. Με `align-items: start` κρατούσε
                το καθένα το φυσικό του ύψος: τρία κανάλια αριστερά, δωδεκάμηνο
                γράφημα δεξιά· και η αριστερή κάρτα τελείωνε εξήντα
                εικονοστοιχεία πιο ψηλά από τη δεξιά. Ο χρήστης το φωτογράφισε.
                Δύο κάρτες που κάθονται δίπλα δίπλα στην ίδια σειρά είναι ΜΙΑ
                σειρά: τεντώνονται μαζί και το κενό μένει μέσα τους, όχι κάτω
                από τη μία. */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 14, alignItems: 'stretch' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ ...lbl, marginBottom: 8 }}>Ανά κανάλι</div>
                <div style={{ flex: 1, background: 'var(--surface-raised)', border: '1px solid var(--border-raised)', borderRadius: T.radius.card, padding: 14, boxShadow: 'var(--highlight-inset), var(--elev-1)', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {chRows.map(r => {
                    const pct = Math.max(2, (r.revenue / maxCh) * 100);
                    return (
                      /* Η ΑΙΩΡΗΣΗ ΕΙΝΑΙ CSS, ΟΧΙ ΤΕΣΣΕΡΙΣ ΧΕΙΡΙΣΤΕΣ ΚΑΙ ΜΙΑ ΚΑΤΑΣΤΑΣΗ.
                         Πρώτη γραφή κρατούσε `chHover` σε `useState` με
                         onMouseEnter/Leave/Focus/Blur: πέντε γραμμές JavaScript
                         για να αλλάξει ένα χρώμα, που δεν ξέρουν τι είναι οθόνη
                         αφής (όπου το «hover» κολλάει μετά το πάτημα). Η κλάση
                         `.cl-ch` το κάνει με `:hover` μέσα σε `@media (hover:
                         hover)` και με `:focus-within` για το πληκτρολόγιο. */
                      <div key={r.channel} className="exp-bar cl-ch"
                        tabIndex={0}
                        aria-label={`${r.label}: ${fe(r.revenue)}, ${r.nights} νύχτες, ${r.count} ${r.count === 1 ? 'διαμονή' : 'διαμονές'}`}>
                        {/* ΤΡΕΙΣ ΣΤΗΛΕΣ, ΩΣΤΕ ΤΑ ΕΥΡΩ ΝΑ ΠΕΦΤΟΥΝ ΤΟ ΕΝΑ ΚΑΤΩ ΑΠΟ
                            ΤΟ ΑΛΛΟ. Ηταν ένα `span` με ποσό και μετρήσεις μαζί,
                            στοιχισμένο δεξιά: «3.400,00€ 20 νύχτες · 5 διαμονές»
                            και από κάτω «400,00€ 4 νύχτες · 1 διαμονές». Καμία
                            κάθετη δεν έπεφτε πάνω σε άλλη. */}
                        <div className="cl-ch-head">
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums', fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' }}>{fe(r.revenue)}</span>
                          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums', textAlign: 'right', whiteSpace: 'nowrap' }}>{r.nights} νύχτες · {r.count} {r.count === 1 ? 'διαμονή' : 'διαμονές'}</span>
                        </div>
                        <div style={{ height: 8, borderRadius: T.radius.xs, background: 'var(--ring-track)', overflow: 'hidden', marginTop: 6 }}>
                          <div className="cl-ch-fill" style={{ width: `${pct}%` }} />
                        </div>
                        {r.unresolved > 0 && <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 4 }}>{r.unresolved} με απροσδιόριστο ποσό</div>}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ ...lbl, marginBottom: 8 }}>Ανά μήνα</div>
                <div style={{ flex: 1, background: 'var(--surface-raised)', border: '1px solid var(--border-raised)', borderRadius: T.radius.card, padding: 14, boxShadow: 'var(--highlight-inset), var(--elev-1)' }}>
                  <MonthBars
                    points={months.map((v, i) => ({ key: `${reportYear}-${String(i + 1).padStart(2, '0')}`, label: `${MONTHS_NOM[i]} ${reportYear}`, total: v }))}
                    currentKey={`${reportYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}`}
                    restLabel={`Δηλωτέα ακαθάριστα ${reportYear}`}
                    format={fe}
                    height={104}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Ντοσιέ επισκέπτη ─────────────────────────────────────────────────
          ΗΤΑΝ ΤΟ ΤΡΙΤΟ ΧΕΙΡΟΓΡΑΦΟ ΠΛΑΪΝΟ ΦΥΛΛΟ ΤΗΣ ΕΦΑΡΜΟΓΗΣ: δικό του scrim,
          δικό του πλάτος 720, δικό του «×» — και τίποτα από όσα κάνουν ένα
          παράθυρο παράθυρο. Το Escape δεν το έκλεινε. Η εστίαση δεν έμπαινε
          μέσα, άρα ο χρήστης πληκτρολογίου συνέχιζε να διατρέχει τη λίστα από
          κάτω και όταν έκλεινε δεν γύριζε στην κάρτα από την οποία ήρθε. Και
          το σύρσιμο πάνω στο σκοτεινό φόντο κυλούσε τη σελίδα από πίσω: έκλεινε
          το ντοσιέ και έβρισκε άλλο σημείο της λίστας από αυτό που άφησε.
          Το SideSheet τα φέρνει και τα τέσσερα, με το ίδιο πλάτος 720.
          Το «×» το βάζει το ίδιο — εδώ μένει μόνο το περιεχόμενο της κεφαλίδας. */}
      {dc && dcStats && (
        // ΦΡΟΥΡΑ ΣΤΟ ΚΛΕΙΣΙΜΟ: το «Επεξεργασία στοιχείων» ανοίγει το παράθυρο
        // της φόρμας ΠΑΝΩ από αυτό το φύλλο, χωρίς να το κλείνει. Και τα δύο
        // primitives ακούν Escape στο `document`, άρα ΕΝΑ Escape έφτανε και στα
        // δύο: έκλεινε τη φόρμα ΚΑΙ το ντοσιέ από κάτω. Δύο συνέπειες, η
        // δεύτερη σοβαρή:
        //   • ο χρήστης έχανε το ντοσιέ ενώ ήθελε μόνο να ακυρώσει τη φόρμα·
        //   • αποπροσαρτώνται στην ΙΔΙΑ φάση, με το φύλλο πρώτο στο δέντρο, άρα
        //     πρώτα το φύλλο επαναφέρει το overflow σε «» και ΜΕΤΑ το παράθυρο
        //     το ξαναγράφει «hidden» (αυτό βρήκε όταν άνοιξε). Η σελίδα έμενε
        //     κλειδωμένη χωρίς καμία επικάλυψη ανοιχτή.
        // Όσο η φόρμα είναι ανοιχτή, το φύλλο αγνοεί το κλείσιμο· το scrim του
        // ούτως ή άλλως δεν είναι προσιτό, γιατί το παράθυρο το σκεπάζει.
        <SideSheet open onClose={() => { if (modalOpen) return; setOpenId(null); setStayFormOpen(false); }} ariaLabel="Καρτέλα επισκέπτη" size="lg"
          header={
            // Avatar + όνομα + σήματα συμμόρφωσης + ενέργεια.
            // Καμία βαθμολογία, κανένα VIP, καμία «μαύρη λίστα».
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              {avatar(dc.full_name, 52)}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 20, fontWeight: 700 }}>{dc.full_name}</span>
                  {dcUndeclared > 0 && <Badge>{undeclaredLabel(dcUndeclared)}</Badge>}
                </div>
              </div>
              <Btn variant="secondary" onClick={() => openEdit(dc)}>Επεξεργασία στοιχείων</Btn>
            </div>
          }>

            {/* Επικοινωνία. ΜΟΝΟ τηλέφωνο και email: διεύθυνση, ΑΦΜ, αριθμός
                ταυτότητας, εθνικότητα και «πηγή γνωριμίας» έφυγαν — δεδομένα
                προσωπικού χαρακτήρα που δεν προκαλούσαν καμία ενέργεια. Ό,τι
                χρειάζεται ο οικοδεσπότης μένει στην ιδιωτική σημείωση, χωρίς
                ετικέτα κατηγορίας. */}
            <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.inner, padding: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 10 }}>
                {([
                  ['Τηλέφωνο', dc.phone ? <a href={`tel:${dc.phone}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{dc.phone}</a> : null],
                  ['Ηλεκτρονικό ταχυδρομείο', dc.email ? <a href={`mailto:${dc.email}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{dc.email}</a> : null],
                ] as [string, React.ReactNode][]).filter(([, v]) => v != null).map(([k, v], i) => (
                  <div key={i}>
                    <div style={{ fontSize: 'var(--fs-xs)', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: 4 }}>{k}</div>
                    <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text-primary)' }}>{v}</div>
                  </div>
                ))}
              </div>
              {dc.phone && (
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <a href={waLink(dc.phone)} target="_blank" rel="noopener noreferrer" style={msgLink}>WhatsApp</a>
                  <a href={viberLink(dc.phone)} style={msgLink}>Viber</a>
                </div>
              )}
              {dc.notes && dc.notes.trim() && <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)', fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{dc.notes}</div>}
            </div>

            {/* Συνδεδεμένα ακίνητα (ο έλεγχος σύνδεσης ζει εδώ, όχι στην κάρτα) */}
            <div>
              <div style={{ ...lbl, marginBottom: 8 }}>Συνδεδεμένα ακίνητα</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {(propsByClient.get(dc.id) || []).map(p => (
                  <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '6px 11px', borderRadius: T.radius.chip, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                    <LinkBtn onClick={() => onSelectProperty?.(p.id)}>{p.name}</LinkBtn>
                    {/* Το αρνητικό περιθώριο είναι ΘΕΣΗ: το κουτί των 32 τραβιέται μέσα
                        στο γέμισμα του πλακιδίου, ώστε ο στόχος αφής να μεγαλώσει χωρίς
                        να ψηλώσει η σειρά των συνδεδεμένων ακινήτων. */}
                    <IconBtn label="Αποσύνδεση ακινήτου" title="Αποσύνδεση" onClick={() => unlinkProperty(p.id)} style={{ margin: -6 }}>
                      <span style={{ fontSize: 14, lineHeight: 1 }}>×</span>
                    </IconBtn>
                  </span>
                ))}
                {(propsByClient.get(dc.id) || []).length === 0 && unlinkedProps.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Κανένα ακίνητο</span>}
                {/* ΝΤΟΠΙΟ <select> ΜΕΣΑ ΣΕ ΟΘΟΝΗ ΜΕ ΔΙΚΟ ΤΗΣ ΣΥΣΤΗΜΑ ΠΕΔΙΩΝ.
                    Το λειτουργικό το σχεδίαζε μόνο του: άλλο βέλος, άλλη γωνία,
                    άλλη γραμματοσειρά, άλλο φόντο στη λίστα — και στο σκούρο θέμα
                    λευκό πλαίσιο σε σκούρα σελίδα. Ένα πεδίο, το ίδιο με τα άλλα. */}
                {unlinkedProps.length > 0 && (
                  <div style={{ flex: '1 1 220px', minWidth: 190 }}>
                    <CustomSelect ariaLabel="Σύνδεση ακινήτου" value="" onChange={v => { if (v) linkProperty(dc.id, v); }}
                      options={unlinkedProps.map(p => ({ value: p.id, label: p.name }))}
                      placeholder="Πρόσθεσε ακίνητο" />
                  </div>
                )}
              </div>
            </div>

            {/* Άφιξη επισκέπτη: σύνδεσμος για να συμπληρώσει τα στοιχεία του πριν φτάσει */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                <div style={lbl}>Στοιχεία άφιξης</div>
                <Btn variant="secondary" onClick={copyCheckinLink}>{checkinCopied ? 'Ο σύνδεσμος αντιγράφηκε' : 'Αντιγραφή συνδέσμου'}</Btn>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5, marginBottom: checkins.length ? 10 : 0 }}>
                Ο επισκέπτης συμπληρώνει μόνος του ταυτότητα, εθνικότητα και ώρα άφιξης πριν φτάσει.
              </div>
              {checkins.map(ci => (
                <div key={ci.id} style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.inner, padding: '10px 14px', marginTop: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-primary)' }}>{ci.full_name}</span>
                    {/* ΤΟ `any[]` ΕΚΡΥΒΕ ΟΤΙ ΤΟ `created_at` ΕΙΝΑΙ NULLABLE — μόλις
                        μπήκε ο τύπος `Checkin`, ο tsc το έσκασε (TS2345: το `fd`
                        δέχεται `string|Date`). ΛΑΝΘΑΝΟΝ, ΟΧΙ ΠΑΡΑΤΗΡΗΜΕΝΟ: η στήλη
                        έχει `DEFAULT now()` και η μόνη διαδρομή εγγραφής σήμερα
                        (η RPC public_submit_checkin) δεν τη γράφει ρητά, άρα δεν
                        βγαίνει null στην πράξη. Αν όμως έβγαινε, το `new Date(null)`
                        δίνει την εποχή Unix: «01 Ιαν 1970» δίπλα στο όνομα του
                        επισκέπτη. Το ABSENT_DATE είναι η καθιερωμένη ένδειξη. */}
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: T.font.mono }}>{ci.created_at ? fd(ci.created_at) : ABSENT_DATE}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>
                    {[ci.id_number && `Ταυτότητα ${ci.id_number}`, ci.nationality, ci.birth_date && `γεν. ${fd(ci.birth_date)}`, ci.phone, ci.arrival_date && `άφιξη ${fd(ci.arrival_date)}`, ci.guests_count && `${ci.guests_count} άτομα`, ci.accepts_rules && 'αποδοχή κανόνων'].filter(Boolean).join(' · ')}
                  </div>
                </div>
              ))}
            </div>

            {/* Αναλυτικά: μόνο όταν υπάρχουν διαμονές (αλλιώς περιττά μηδενικά).
                Τα ποσά είναι διακριτά: ακαθάριστο ≠ payout ≠ τι πλήρωσε ο επισκέπτης. */}
            {/* ═══ ΤΕΣΣΕΡΑ ΑΝΑ ΣΕΙΡΑ, ΜΕΤΡΗΜΕΝΑ ΣΤΟ ΠΛΑΤΟΣ ΤΟΥ ΦΥΛΛΟΥ ══════════════
                Εδώ ζούσε δικό του `auto-fit` με ελάχιστο 116: οκτώ πλακίδια
                έβγαιναν πέντε και τρία, με τη μισή δεύτερη σειρά άδεια· κάθε
                κουτί έμενε 108 εικονοστοιχεία σε ΚΑΘΕ πλάτος οθόνης.

                ΚΑΙ ΤΟ `.tile-row` ΔΕΝ ΕΙΝΑΙ Η ΑΠΑΝΤΗΣΗ ΕΔΩ, όσο κι αν είναι η
                κοινή κλάση: τα σπασίματά του κοιτούν το πλάτος της ΟΘΟΝΗΣ, ενώ
                αυτό το πλέγμα ζει μέσα σε πλαϊνό φύλλο σταθερού πλάτους. Στα
                1.440 έδινε πέντε στήλες των 108 και στα 1.024 τρεις των 204,
                δηλαδή όσο μεγάλωνε η οθόνη τόσο ΣΤΕΝΕΥΑΝ τα κουτιά.

                Το φύλλο δίνει 711 εικονοστοιχεία περιεχομένου, δηλαδή στήλες
                των 144: η μακρύτερη ετικέτα («Τελευταία επίσκεψη», 146) τυλίγει
                σε δεύτερη γραμμή και τα αδέλφια του πλέγματος ισοϋψώνονται μαζί
                της. Τέσσερις είναι ο αριθμός που ζητά η ίδια η οθόνη: οκτώ
                πλακέτες σε δύο γεμάτες σειρές. */}
            {dcStats.stayCount > 0 && (
              <div {...fixedCols(4, 10, 'stretch')}>
                {statTile('Ακαθάριστα', fe(dcTotals.revenue), { title: 'Δηλωτέο ακαθάριστο: τι πλήρωσε ο επισκέπτης μείον το τέλος ανθεκτικότητας. Η προμήθεια ΔΕΝ αφαιρείται.' })}
                {dcTotals.platformFees > 0 && statTile('Προμήθειες', fe(dcTotals.platformFees), { title: PLATFORM_FEE_NOTE })}
                {dcTotals.climateLevy > 0 && statTile('Τέλος ανθεκτικότητας', fe(dcTotals.climateLevy), { title: 'Εισπράχθηκε για λογαριασμό του κράτους. Δεν είναι έσοδό σου.' })}
                {statTile('Νύχτες', String(dcStats.nights))}
                {statTile('Διαμονές', String(dcStats.stayCount))}
                {/* «Μέση νύχτα», όπως ακριβώς γράφει η κάρτα του ίδιου επισκέπτη στη
                    λίστα από πίσω. Ηταν «Μέση τιμή νύχτας» εδώ: ίδιο νούμερο, δύο
                    ονόματα, σε δύο οθόνες που ανοίγουν η μία την άλλη. */}
                {statTile('Μέση νύχτα', fe(dcStats.adr), { title: 'Δηλωτέο ακαθάριστο διά τις νύχτες' })}
                {/* Η παύλα σε θέση τιμής δεν λέει «καμία»· λέει «κάτι έσπασε».
                    Η πλακέτα εμφανίζεται μόνο όταν υπάρχει ημερομηνία να δείξει. */}
                {dcStats.lastVisit && statTile('Τελευταία επίσκεψη', fd(dcStats.lastVisit))}
                {dcUndeclared > 0 && statTile('Αδήλωτες', String(dcUndeclared), { title: 'Διαμονές που τελείωσαν χωρίς δήλωση βραχυχρόνιας διαμονής στην ΑΑΔΕ' })}
                {dcStats.damageTotal > 0 && statTile('Φθορές', fe(dcStats.damageTotal))}
              </div>
            )}

            {/* Διαμονές */}
            <div>
              <SecHdr label="Διαμονές" right={!stayFormOpen ? <Btn variant="secondary" onClick={openStayNew}>Νέα διαμονή</Btn> : undefined} />
              {stayFormOpen && (
                <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.inner, padding: 16, marginBottom: 14, boxShadow: 'var(--well-inset)' }}>
                  {/* ═══ ΤΕΣΣΕΡΑ ΚΑΙ ΤΡΙΑ, ΣΕ ΔΥΟ ΣΕΙΡΕΣ ═════════════════════════════
                      Το `formGrid` κόβει κάθε στήλη στα 270 και γεμίζει με
                      `auto-fill`: επτά πεδία έβγαιναν ΤΕΣΣΕΡΙΣ σειρές (ένα, δύο,
                      δύο, δύο) με τη μισή κάρτα άδεια δεξιά. Οι στήλες
                      γράφονται πλέον ως απόφαση: ποιο ακίνητο, πότε ήρθε, πότε
                      έφυγε, πόσες νύχτες· και από κάτω πόσα άτομα, από πού
                      ήρθε, πόσο η νύχτα. Δύο σειρές, μία ερώτηση η καθεμιά. */}
                  <div {...fixedCols(4, 14, 'start')}>
                    <CustomSelect label="Ακίνητο" value={stayForm.property_id} onChange={v => setStayForm(f => ({ ...f, property_id: v }))} options={props.map(p => ({ value: p.id, label: p.name }))} placeholder="Χωρίς ακίνητο" />
                    <DatePicker label="Άφιξη" value={stayForm.check_in} onChange={v => onStayDates({ check_in: v })} />
                    <DatePicker label="Αναχώρηση" value={stayForm.check_out} onChange={v => onStayDates({ check_out: v })} />
                    {/* ΟΙ ΝΥΧΤΕΣ ΔΕΝ ΕΙΝΑΙ ΕΡΩΤΗΣΗ ΟΤΑΝ ΥΠΑΡΧΟΥΝ ΟΙ ΗΜΕΡΟΜΗΝΙΕΣ.
                        Ήταν πεδίο που γέμιζε μόνο του από τις δύο ημερομηνίες και
                        μετά επιτρεπόταν να το αλλάξεις: τρίτη πηγή αλήθειας για
                        κάτι που είναι αφαίρεση. Ο χρήστης που έγραφε άλλον αριθμό
                        δεν μάθαινε ποτέ ποιος από τους δύο μέτρησε. */}
                    {derivedNights != null ? (
                      <div>
                        <div style={{ ...lbl, marginBottom: 6 }}>Διανυκτερεύσεις</div>
                        <div style={{ height: T.h.lg, display: 'flex', alignItems: 'center', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums' }}>{derivedNights}</div>
                      </div>
                    ) : (
                      <NumberInput label="Διανυκτερεύσεις" value={stayForm.nights} onChange={v => setStayForm(f => ({ ...f, nights: v }))} />
                    )}
                    <NumberInput label="Άτομα" value={stayForm.guests} onChange={v => setStayForm(f => ({ ...f, guests: v }))} />
                    <CustomSelect label="Κανάλι" value={stayForm.channel} onChange={v => setStayForm(f => ({ ...f, channel: v }))} options={channelOptions} />
                    <NumberInput label="Τιμή ανά νύχτα" value={stayForm.nightly_rate} onChange={v => setStayForm(f => ({ ...f, nightly_rate: v }))} suffix="€" />
                  </div>

                  {/* ── ΤΑ ΤΡΙΑ ΠΟΣΑ ─────────────────────────────────────────
                      Δεν υπάρχει πεδίο «Σύνολο». Το `total` είναι ΠΑΡΑΓΩΓΟ, γιατί
                      «Σύνολο» δεν σήμαινε τίποτα συγκεκριμένο: ο εισαγωγέας το
                      γέμιζε με payout, η φορολογική μηχανή το διάβαζε ως
                      ακαθάριστο και ο φάκελος του λογιστή ζητούσε ακαθάριστο. */}
                  {secHead('Ποσά')}
                  {/* ΤΡΙΑ ΠΟΣΑ, ΜΙΑ ΣΕΙΡΑ. Το `auto-fill` των 270 έβγαζε δύο πάνω
                      και ένα κάτω, δηλαδή το τρίτο ποσό έμοιαζε με άλλη ενότητα. */}
                  <div {...fixedCols(3, 14, 'start')}>
                    {/* ΚΑΜΙΑ ΚΟΥΚΚΙΔΑ ΕΠΕΞΗΓΗΣΗΣ ΕΔΩ. Ήταν τρεις, μία σε κάθε
                        πεδίο και έλεγαν ακριβώς ό,τι λέει η σύνοψη δύο σειρές
                        πιο κάτω με πραγματικούς αριθμούς: τι πλήρωσε ο
                        επισκέπτης, τι πάει στο κράτος, τι εκπίπτει. Το ίδιο
                        πράγμα δύο φορές, τη μία με ποντίκι από πάνω. */}
                    <NumberInput label="Πλήρωσε ο επισκέπτης"
                      value={stayForm.gross_guest_paid} onChange={v => setStayForm(f => ({ ...f, gross_guest_paid: v }))} suffix="€" />
                    <NumberInput label="Τέλος ανθεκτικότητας"
                      value={stayForm.climate_levy} onChange={v => setStayForm(f => ({ ...f, climate_levy: v }))} suffix="€" />
                    <NumberInput label="Προμήθεια πλατφόρμας"
                      value={stayForm.platform_fee} onChange={v => setStayForm(f => ({ ...f, platform_fee: v }))} suffix="€" />
                  </div>

                  {/* Πρόταση τέλους από τους συντελεστές της ΑΑΔΕ και τον τύπο/
                      μέγεθος ΑΥΤΟΥ του ακινήτου. Ένα κλικ και διορθώσιμο. */}
                  {(() => {
                    const sug = suggestLevy(stayForm);
                    if (!sug || parseFloat(stayForm.climate_levy) > 0) return null;
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 10, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                        <span>Με βάση τους συντελεστές της ΑΑΔΕ και το ακίνητο, το τέλος για αυτή τη διαμονή βγαίνει <strong style={{ fontFamily: T.font.num, color: 'var(--text-secondary)' }}>{fe(sug)}</strong>. Επιβεβαίωσε το ακριβές ποσό στο myAADE.</span>
                        <Btn variant="secondary" onClick={() => setStayForm(f => ({ ...f, climate_levy: String(sug) }))}>Χρησιμοποίησέ το</Btn>
                      </div>
                    );
                  })()}

                  {/* Το αποτέλεσμα, ζωντανά: τι δηλώνεις και τι μένει σε εσένα. */}
                  {(() => {
                    const g = parseFloat(stayForm.gross_guest_paid) || 0;
                    if (g <= 0) {
                      // 281 χαρακτήρες σε μέτρο ~583 (φύλλο 720, μείον τα γεμίσματα
                      // του φύλλου και της ταινίας): τρεις γραμμές στα 11, με ριγμένη
                      // δεξιά άκρη μέσα σε πλαίσιο που έχει τη δική του. Το className
                      // του InfoBanner προσγειώνεται στο ΚΕΙΜΕΝΟ, όχι στο πλαίσιο,
                      // οπότε εκεί πάει η po-just· το hy() τυλίγει όλο το περιεχόμενο
                      // ώστε να πιάσει και τα λεκτικά μέσα στα έντονα.
                      return stayForm.basis === 'unknown' && (parseFloat(stayForm.legacyTotal) || 0) > 0 ? (
                        <InfoBanner tone="warning" className="po-just">
                          {hy(<>Αυτή η διαμονή έχει καταγεγραμμένο ποσό <strong>{fe(parseFloat(stayForm.legacyTotal))}</strong> αλλά <strong>δεν ξέρουμε τι είναι</strong>: ακαθάριστο ή καθαρή είσπραξη. Καταγράφηκε πριν η εφαρμογή τα ξεχωρίσει και δεν μαντεύουμε. Συμπλήρωσε «Πλήρωσε ο επισκέπτης» και το ακαθάριστο θα υπολογιστεί σωστά, ή δήλωσε παρακάτω τι σημαίνει το ποσό.</>)}
                        </InfoBanner>
                      ) : null;
                    }
                    const levy = parseFloat(stayForm.climate_levy) || 0;
                    const fee = parseFloat(stayForm.platform_fee) || 0;
                    const gross = Math.max(0, g - levy);
                    return (
                      <div style={{ marginTop: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.inner, padding: '10px 14px', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                        Πλήρωσε ο επισκέπτης <strong style={{ fontFamily: T.font.num }}>{fe(g)}</strong>
                        {' − '}τέλος <strong style={{ fontFamily: T.font.num }}>{fe(levy)}</strong>
                        {' = '}<strong style={{ fontFamily: T.font.num, color: 'var(--text-primary)' }}>δηλωτέο ακαθάριστο {fe(gross)}</strong>
                        <br />
                        {fe(gross)} − προμήθεια <strong style={{ fontFamily: T.font.num }}>{fe(fee)}</strong> (δαπάνη, <strong>όχι</strong> μείωση εσόδου) = μένει σε εσένα <strong style={{ fontFamily: T.font.num }}>{fe(Math.max(0, gross - fee))}</strong>
                      </div>
                    );
                  })()}

                  {/* Ρητή δήλωση βάσης για τις ιστορικές γραμμές που δεν έχουν ανάλυση. */}
                  {(parseFloat(stayForm.gross_guest_paid) || 0) <= 0 && (parseFloat(stayForm.legacyTotal) || 0) > 0 && (
                    <div style={{ marginTop: 12, maxWidth: 340 }}>
                      <CustomSelect label={`Τι σημαίνει το ποσό ${fe(parseFloat(stayForm.legacyTotal))};`}
                        value={stayForm.basis} onChange={v => setStayForm(f => ({ ...f, basis: v as AmountBasis }))}
                        options={[
                          { value: 'unknown', label: AMOUNT_BASIS_LABELS.unknown },
                          { value: 'gross', label: AMOUNT_BASIS_LABELS.gross },
                          { value: 'payout', label: AMOUNT_BASIS_LABELS.payout },
                        ]} />
                    </div>
                  )}

                  {/* ═══ ΔΥΟ ΔΙΑΚΟΠΤΕΣ, ΔΙΠΛΑ ΔΙΠΛΑ ═════════════════════════════════
                      Ηταν δύο ολόκληρες ενότητες, η μία κάτω από την άλλη, με
                      δική της γραμμή τίτλου η καθεμιά — για να δείξουν ΕΝΑΝ
                      διακόπτη η κάθε μία. Ογδόντα εικονοστοιχεία ύψους και δύο
                      οριζόντιες γραμμές, για δύο ναι/όχι. Πλέον στέκονται στην
                      ίδια ευθεία, χωρισμένες από μία κάθετη γραμμή· ό,τι ανοίγει
                      ο διακόπτης κατεβαίνει ΚΑΤΩ από αυτόν, μέσα στη στήλη του. */}
                  {secHead('Δήλωση και φθορές')}
                  <div {...fixedCols(2, 20, 'start', 'cl-split')}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <Toggle on={stayForm.declared}
                        onChange={v => setStayForm(f => ({ ...f, declared: v, declared_at: v ? (f.declared_at || todayStr()) : '' }))}
                        label="Δηλώθηκε στο myAADE" />
                      {stayForm.declared && <DatePicker label="Ημερομηνία δήλωσης" value={stayForm.declared_at} onChange={v => setStayForm(f => ({ ...f, declared_at: v }))} />}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <Toggle on={stayForm.damages} onChange={v => setStayForm(f => ({ ...f, damages: v }))} label="Καταγράφηκαν φθορές" />
                      {stayForm.damages && (
                        <>
                          <CustomSelect label="Ποιο αντικείμενο"
                            value={stayForm.damage_item_id} onChange={v => setStayForm(f => ({ ...f, damage_item_id: v }))}
                            placeholder={invForStay.length ? `Επίλεξε από «${navLabel('inventory')}»` : `Καμία καταχώρηση σε «${navLabel('inventory')}»`}
                            options={invForStay.map(i => ({ value: i.id, label: i.current_value != null ? `${i.name} · ${fe(i.current_value)}` : i.name }))} />
                          <NumberInput label="Κόστος φθοράς" value={stayForm.damage_cost} onChange={v => setStayForm(f => ({ ...f, damage_cost: v }))} suffix="€" />
                        </>
                      )}
                    </div>
                  </div>

                  {/* ═══ ΤΑ ΔΥΟ ΚΟΥΤΙΑ ΕΛΕΥΘΕΡΟΥ ΚΕΙΜΕΝΟΥ ΕΦΥΓΑΝ ═══════════════════
                      Η καρτέλα του επισκέπτη έχει ΗΔΗ «Χρονολόγιο» με σχόλια,
                      τηλεφωνήματα και επισκέψεις. Δύο ακόμη πεδία ελεύθερου
                      κειμένου μέσα στη φόρμα της διαμονής σήμαιναν ότι ο χρήστης
                      έπρεπε να θυμάται σε ΠΟΙΟ από τα τρία έγραψε.

                      Ο,τι έχει ήδη γραφτεί δεν εξαφανίζεται: το πεδίο
                      επανεμφανίζεται μόνο σε γραμμές που ΕΧΟΥΝ τιμή, ώστε να
                      διαβαστεί και να καθαριστεί, όχι για να ξαναγεμίσει. */}
                  {(stayForm.damage_note.trim() !== '' || stayForm.notes.trim() !== '') && (
                    <div {...fixedCols(2, 14, 'start', 'cl-notes-old')}>
                      {stayForm.damage_note.trim() !== '' && (
                        <TextInput label="Παλαιότερη σημείωση φθοράς" value={stayForm.damage_note} onChange={v => setStayForm(f => ({ ...f, damage_note: v }))} />
                      )}
                      {stayForm.notes.trim() !== '' && (
                        <TextInput label="Παλαιότερη σημείωση" value={stayForm.notes} onChange={v => setStayForm(f => ({ ...f, notes: v }))} />
                      )}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
                    <Btn variant="ghost" onClick={() => setStayFormOpen(false)}>Ακύρωση</Btn>
                    <Btn variant="primary" onClick={saveStay} disabled={savingStay}>{savingStay ? 'Αποθήκευση…' : 'Αποθήκευση'}</Btn>
                  </div>
                </div>
              )}
              {dcStays.length === 0 && !stayFormOpen ? (
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '8px 0' }}>Χωρίς καταγεγραμμένες διαμονές</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {dcStays.map(s => {
                    const n = s.nights ?? stayNights(s.check_in, s.check_out);
                    const gross = declarableGross(s);
                    const pay = hostPayout(s);
                    const review = needsAmountReview(s);
                    const declared = isDeclared(s);
                    const dmgItem = s.damage_item_id ? inv.find(i => i.id === s.damage_item_id) : undefined;
                    return (
                      /* ΤΟ ΚΟΚΚΙΝΟ ΠΕΡΙΓΡΑΜΜΑ ΕΦΥΓΕ, ΓΙΑΤΙ ΤΟ ΕΛΕΓΕ ΔΕΥΤΕΡΗ ΦΟΡΑ.
                         Η αδήλωτη διαμονή κουβαλά ήδη το σήμα «ΑΔΗΛΩΤΗ», με λέξη.
                         Το κόκκινο πλαίσιο γύρω από ολόκληρη την κάρτα πρόσθετε
                         μηδέν πληροφορία και έσπαγε την ομοιομορφία της λίστας: σε
                         δέκα διαμονές, άλλες με γκρι κορνίζα και άλλες με κόκκινη,
                         το μάτι διαβάζει «χάλασε κάτι» αντί για «λείπει μια
                         δήλωση». Ο χρήστης το φωτογράφισε.

                         Και δεν είναι γούστο: ο κανόνας του έργου λέει ότι η
                         κατάσταση γράφεται με λέξη, όχι με χρώμα — τον ίδιο λόγο
                         που έφυγε το κόκκινο από τα πλακίδια του Δανείου. */
                      <div key={s.id} style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-raised)', borderRadius: T.radius.card, padding: 12, boxShadow: 'var(--highlight-inset), var(--elev-1)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-primary)' }}>{s.property_id ? propName(s.property_id) : 'Χωρίς ακίνητο'}</span>
                              {/* ΤΟ ΣΗΜΑ ΠΟΥ ΕΛΕΙΠΕ: μία δήλωση ανά κράτηση και
                                  το app είχε όλες τις κρατήσεις χωρίς να
                                  παρακολουθεί καμία. */}
                              {!declared && (awaitsDeclaration(s) ? <Badge>Αδήλωτη</Badge> : <Badge>Επερχόμενη</Badge>)}
                              {review && <Badge tone="warning">Ποσό προς επιβεβαίωση</Badge>}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                              {s.check_in && <span>{fd(s.check_in)}{s.check_out ? ` - ${fd(s.check_out)}` : ''}</span>}
                              <span style={{ color: 'var(--text-tertiary)' }}>·</span><span>{n} νύχτες</span>
                              {s.guests != null && <><span style={{ color: 'var(--text-tertiary)' }}>·</span><span>{s.guests} άτομα</span></>}
                              {s.channel && <><span style={{ color: 'var(--text-tertiary)' }}>·</span><span>{STAY_CHANNEL_LABELS[s.channel as keyof typeof STAY_CHANNEL_LABELS] || s.channel}</span></>}
                              {declared && s.declared_at && <><span style={{ color: 'var(--text-tertiary)' }}>·</span><span style={{ color: 'var(--text-secondary)' }}>δηλώθηκε {fd(s.declared_at)}</span></>}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: T.font.num }}>{fe(gross ?? stayTotal(s))}</div>
                            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{gross != null ? 'δηλωτέο ακαθάριστο' : 'ποσό απροσδιόριστο'}</div>
                            {pay != null && pay !== gross && <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: T.font.num }}>{fe(pay)} σε εσένα</div>}
                          </div>
                        </div>
                        {/* Η ανάλυση, ρητά, όπου υπάρχει. */}
                        {(s.gross_guest_paid != null || s.climate_levy != null || s.platform_fee != null) && (
                          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 6, lineHeight: 1.6 }}>
                            {s.gross_guest_paid != null && <>πλήρωσε ο επισκέπτης {fe(s.gross_guest_paid)}</>}
                            {(s.climate_levy || 0) > 0 && <> · τέλος {fe(s.climate_levy || 0)} (όχι έσοδό σου)</>}
                            {(s.platform_fee || 0) > 0 && <> · προμήθεια {fe(s.platform_fee || 0)} (δαπάνη)</>}
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                            {/* Η λέξη «Φθορά» λέει ήδη ό,τι θα έλεγε το κόκκινο. */}
                            {s.damages && <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>Φθορά {fe(s.damage_cost || 0)}{dmgItem ? ` · ${dmgItem.name}` : s.damage_note ? ` · ${s.damage_note}` : ''}</span>}
                          </div>
                          {/* Το μέγεθος γράφεται ΜΙΑ φορά στη σειρά: το `LinkBtn` κληρονομεί
                              τη γραμματοσειρά του κειμένου μέσα στο οποίο κάθεται. */}
                          <div style={{ display: 'flex', gap: 10, fontSize: 12 }}>
                            {/* Ένα κλικ. Η προθεσμία της δήλωσης δεν περιμένει φόρμα. */}
                            {/* `quiet` όταν είναι ήδη δηλωμένη: η αναίρεση δεν διεκδικεί το μάτι. */}
                            <LinkBtn tone={declared ? 'quiet' : undefined} onClick={() => toggleDeclared(s)}>
                              {declared ? 'Αναίρεση δήλωσης' : 'Σημείωσε ως δηλωμένη'}
                            </LinkBtn>
                            <LinkBtn onClick={() => openStayEdit(s)}>Επεξεργασία</LinkBtn>
                            <LinkBtn tone="quiet" onClick={() => delStay(s)}>Διαγραφή</LinkBtn>
                          </div>
                        </div>
                        {s.notes && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>{s.notes}</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ═══ ΜΗΝΥΜΑΤΑ — ΕΝΑ ΚΕΙΜΕΝΟ ΤΗ ΦΟΡΑ, ΤΡΕΙΣ ΕΝΕΡΓΕΙΕΣ ═════════════
                Ήταν πέντε κάρτες με τρία κουμπιά η καθεμία: δεκαπέντε στόχους
                σε μία ενότητα και το κείμενο κομμένο στις δύο γραμμές, ώστε ο
                χρήστης να στέλνει κάτι που δεν έχει διαβάσει ολόκληρο.
                Τώρα: διαλέγεις πρότυπο, το βλέπεις όλο, το στέλνεις. */}
            <div>
              <SecHdr label="Μηνύματα" sub="Έτοιμα πρότυπα για WhatsApp, Viber ή αντιγραφή" />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                {MSG_TEMPLATES.map(t => (
                  <ChipToggle key={t.id} on={t.id === msgId}
                    onClick={() => { setMsgId(t.id); setMsgCopied(false); }}>{t.label}</ChipToggle>
                ))}
              </div>
              {(() => {
                const active = MSG_TEMPLATES.find(t => t.id === msgId) || MSG_TEMPLATES[0];
                const text = buildMessage(active.id, msgCtx!);
                return (
                  <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-raised)', borderRadius: T.radius.card, padding: 16, boxShadow: 'var(--highlight-inset), var(--elev-1)' }}>
                    <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{text}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
                      {/* Τα δύο πρώτα είναι ΠΡΟΟΡΙΣΜΟΣ, οπότε παίρνουν `href` και μένουν
                          σύνδεσμοι με την όψη του κουμπιού. Και τα τρία στον ίδιο ρόλο,
                          γιατί καμία από τις τρεις εξόδους δεν είναι πιο κύρια. */}
                      <Btn href={whatsappLink(dc.phone ? msgDigits(dc.phone) : '', text)} newTab>WhatsApp</Btn>
                      <Btn href={viberTextLink(text)}>Viber</Btn>
                      <Btn onClick={() => { navigator.clipboard?.writeText(text); setMsgCopied(true); }}>{msgCopied ? 'Αντιγράφηκε' : 'Αντιγραφή'}</Btn>
                      {!dc.phone && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>Χωρίς αποθηκευμένο τηλέφωνο θα διαλέξεις επαφή μέσα στην εφαρμογή.</span>}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Έγγραφα (ταυτότητα, συμβόλαιο, αποδείξεις) */}
            <div>
              <SecHdr label="Έγγραφα" sub="Ταυτότητα, συμβόλαιο, αποδείξεις, ασφαλής αποθήκευση" />
              {/* ═══ ΔΥΟ ΣΕΙΡΕΣ ΜΕ ΤΟΝ ΙΔΙΟ ΡΥΘΜΟ ══════════════════════════════════
                  Η σειρά των εγγράφων και η σειρά του χρονολογίου κάνουν την
                  ίδια δουλειά — διάλεξε είδος, δώσε κάτι, πάτα — και ήταν
                  γραμμένες με δύο γεωμετρίες: εδώ ο επιλογέας άπλωνε στα 441 με
                  ορατή ετικέτα, εκεί έμενε 150 χωρίς· εδώ το κουμπί κολλούσε
                  δίπλα του, εκεί έφτανε στο δεξί άκρο· και τα δύο κουμπιά ήταν 36
                  ψηλά δίπλα σε πεδία 40.

                  Ενας ρυθμός: επιλογέας 200, ό,τι μεσολαβεί, ενέργεια 176 στο
                  δεξί άκρο, όλα στο ύψος του πεδίου. */}
              <div className="cl-row">
                <div className="cl-row-kind">
                  <CustomSelect ariaLabel="Είδος εγγράφου" value={docKind} onChange={k => { if (openId) setDocKindOf({ clientId: openId, kind: k }) }} options={DOC_KINDS.map(k => ({ value: k, label: DOC_KIND_LABELS[k] }))} />
                </div>
                <input ref={docFileRef} type="file" style={{ display: 'none' }} onChange={e => onDocFile(e.target.files?.[0])} />
                <div className="cl-row-act">
                  <Btn variant="secondary" field onClick={() => docFileRef.current?.click()} disabled={docBusy}>{docBusy ? 'Ανέβασμα…' : 'Ανέβασμα αρχείου'}</Btn>
                </div>
              </div>
              {docMsg && <div style={{ fontSize: 12, color: docMsg.error ? 'var(--negative)' : 'var(--text-secondary)', marginBottom: 12 }}>{docMsg.text}</div>}
              {/* ΤΡΕΙΣ ΚΑΤΑΣΤΑΣΕΙΣ: έχει έγγραφα, δεν έχει, δεν ξέρουμε. Το «Δεν
                  έχουν αποθηκευτεί έγγραφα.» βγαίνει μόνο όταν το ξέρουμε. */}
              {docsFailed ? (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '8px 0', lineHeight: 1.6 }}>
                  Τα έγγραφα δεν διαβάστηκαν. Δεν σημαίνει ότι δεν υπάρχουν: δεν πήραμε απάντηση.{' '}
                  <LinkBtn onClick={() => { if (openId) loadDocs(openId); }}>Δοκίμασε ξανά</LinkBtn>
                </div>
              ) : docs.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '8px 0' }}>Δεν έχουν αποθηκευτεί έγγραφα.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {docs.map(d => (
                    <div key={d.id} style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-raised)', borderRadius: T.radius.card, padding: 12, boxShadow: 'var(--highlight-inset), var(--elev-1)', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', flexShrink: 0 }}>
                        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
                        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                          {DOC_KIND_LABELS[d.kind] || 'Άλλο'}{fmtBytes(d.size) ? ` · ${fmtBytes(d.size)}` : ''} · {fd(d.created_at)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center', fontSize: 12 }}>
                        {d.signedUrl && <a href={d.signedUrl} target="_blank" rel="noopener noreferrer" style={msgLink}>Άνοιγμα</a>}
                        <LinkBtn tone="quiet" onClick={() => delDoc(d)}>Διαγραφή</LinkBtn>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Χρονολόγιο (σχόλια) */}
            <div>
              <SecHdr label="Χρονολόγιο" sub="Σχόλια, τηλεφωνήματα, επισκέψεις" />
              <div className="cl-row">
                <div className="cl-row-kind">
                  <CustomSelect ariaLabel="Είδος σχολίου" value={noteForm.kind} onChange={v => setNoteForm(f => ({ ...f, kind: v }))} options={noteKindOptions} />
                </div>
                <div className="cl-row-main">
                  <TextInput ariaLabel="Νέο σχόλιο" value={noteForm.body} onChange={v => setNoteForm(f => ({ ...f, body: v }))} placeholder="Νέο σχόλιο…" />
                </div>
                <div className="cl-row-act">
                  <Btn variant="primary" field onClick={saveNote} disabled={!noteForm.body.trim()}>Προσθήκη</Btn>
                </div>
              </div>
              {/* Ιδιο τρίτο σκαλί με τα έγγραφα από πάνω: «κανένα σχόλιο» είναι
                  συμπέρασμα, όχι προεπιλογή για ό,τι δεν απάντησε. */}
              {notesFailed ? (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '4px 0', lineHeight: 1.6 }}>
                  Τα σχόλια δεν διαβάστηκαν. Δεν σημαίνει ότι δεν υπάρχουν: δεν πήραμε απάντηση.{' '}
                  <LinkBtn onClick={() => { if (openId) loadNotes(openId); }}>Δοκίμασε ξανά</LinkBtn>
                </div>
              ) : notes.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '4px 0' }}>Κανένα σχόλιο ακόμη</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {notes.map(nt => (
                    <div key={nt.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: nt.kind === 'damage' ? 'var(--negative)' : 'var(--accent)' }} />
                          <Badge tone={nt.kind === 'damage' ? 'negative' : 'neutral'}>{NOTE_KIND_LABELS[nt.kind as keyof typeof NOTE_KIND_LABELS] || nt.kind}</Badge>
                          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{fd(nt.created_at)}</span>
                        </div>
                        <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text-primary)', lineHeight: 1.5 }}>{nt.body}</div>
                      </div>
                      <IconBtn label="Διαγραφή σημείωσης" title="Διαγραφή" onClick={() => delNote(nt)}>
                        <span style={{ fontSize: 16, lineHeight: 1 }}>×</span>
                      </IconBtn>
                    </div>
                  ))}
                </div>
              )}
            </div>
        </SideSheet>
      )}

      {/* ── Εισαγωγή κράτησης από email (AI) ────────────────────────────────
          Χειρόγραφο παράθυρο με δικό του radius 18 (το token λέει
          T.radius.modal) και maxHeight '92vh' — που στο κινητό μετρά ΚΑΙ τη
          γραμμή διευθύνσεων του περιηγητή, άρα τα κουμπιά «Ακύρωση/Ανάλυση»
          κάθονταν κάτω από αυτήν. Το Modal μετρά σε 92dvh.
          Οι δύο ενέργειες ήταν μέσα στην περιοχή κύλισης, δηλαδή έφευγαν από το
          κάδρο όταν το επικολλημένο email ήταν μεγάλο· τώρα είναι υποσέλιδο. */}
      <EmailStayModal
        emailOpen={emailOpen} setEmailOpen={setEmailOpen} emailDraft={emailDraft} parseEmail={parseEmail}
        emailBusy={emailBusy} emailText={emailText} setEmailDraft={setEmailDraft}
        saveEmailStay={saveEmailStay} setEmailText={setEmailText} emailErr={emailErr} fGrid={fGrid}
      />

      {/* ── Εισαγωγή iCal (Airbnb/Booking) ──────────────────────────────────
          Ίδια ιστορία με το παράθυρο του email: χειρόγραφο κέλυφος με radius 18
          αντί για T.radius.modal και '92vh' αντί για '92dvh'. Το εικονίδιο του
          ημερολογίου ζούσε σε δικό του κουτί 44×44 — το Modal το τοποθετεί μόνο
          του, οπότε εδώ μένει σκέτο το SVG. */}
      <IcalImportModal
        icalOpen={icalOpen} setIcalOpen={setIcalOpen} icalEvents={icalEvents} importIcal={importIcal}
        icalBusy={icalBusy} icalPropertyId={icalPropertyId} setIcalPropertyId={setIcalPropertyId}
        props={props} icalChannel={icalChannel} setIcalChannel={setIcalChannel} secHead={secHead}
        icalUrl={icalUrl} setIcalUrl={setIcalUrl} fetchIcalFromUrl={fetchIcalFromUrl}
        saveIcalFeed={saveIcalFeed} icalFeedsFailed={icalFeedsFailed} loadIcalFeeds={loadIcalFeeds}
        icalFeeds={icalFeeds} syncIcalNow={syncIcalNow} delIcalFeed={delIcalFeed} icalText={icalText}
        setIcalText={setIcalText} parseIcalInput={parseIcalInput} icalIncludeBlocked={icalIncludeBlocked}
        setIcalIncludeBlocked={setIcalIncludeBlocked} icalMsg={icalMsg}
      />

      {/* ── Φόρμα νέου/επεξεργασίας πελάτη ───────────────────────────────────
          Το τέταρτο χειρόγραφο κέλυφος, με μία ακόμη παράβαση: τα αρχικά του
          ονόματος τυπώνονταν σε μέγεθος 15, που ΔΕΝ υπάρχει στην κλίμακα
          (…13, 14, 16…). Το κουτί του εικονιδίου το δίνει τώρα το Modal και τα
          αρχικά κάθονται στο 14. */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} size="lg"
        title={editing ? (form.full_name.trim() || 'Επεξεργασία επισκέπτη') : 'Νέος επισκέπτης'}
        ariaLabel="Στοιχεία επισκέπτη"
        subtitle={editing ? 'Επεξεργασία στοιχείων επισκέπτη' : 'Νέος επισκέπτης'}
        icon={<span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.02em', fontFamily: T.font.sans }}>{initials}</span>}
        footer={<>
          <Btn variant="ghost" onClick={() => setModalOpen(false)}>Ακύρωση</Btn>
          <Btn variant="primary" onClick={save} disabled={saving || !form.full_name.trim()}>{saving ? 'Αποθήκευση…' : 'Αποθήκευση'}</Btn>
        </>}>
      {/* Τέσσερα πεδία. Δεν ζητάμε ΑΦΜ, ταυτότητα, διεύθυνση, εθνικότητα
          ή «πηγή γνωριμίας» από κάποιον που θα μείνει τρεις νύχτες: είναι
          δεδομένα προσωπικού χαρακτήρα που δεν προκαλούσαν καμία ενέργεια. */}
      <div>
        {secHead('Στοιχεία επικοινωνίας', 0)}
        <div style={fGrid}>
          <div style={{ gridColumn: '1 / -1' }}><TextInput label="Ονοματεπώνυμο *" value={form.full_name} onChange={v => setForm(f => ({ ...f, full_name: v }))} /></div>
          <TextInput label="Τηλέφωνο" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} />
          <TextInput label="Ηλεκτρονικό ταχυδρομείο" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} type="email" />
        </div>
      </div>

      {/* Η «μαύρη λίστα» έγινε αυτό: ιδιωτική σημείωση, ΧΩΡΙΣ ετικέτα
          κατηγορίας. Ο διακόπτης `do_not_rent` κατηγοριοποιούσε πρόσωπο
          με νομικό βάρος (GDPR) και τύπωνε «Προσοχή» δίπλα σε όνομα. */}
      <Textarea label="Ιδιωτική σημείωση" value={form.notes} onChange={v => setForm(f => ({ ...f, notes: v }))} rows={3} placeholder="Ό,τι θέλεις να θυμάσαι για αυτή τη φιλοξενία. Δική σου σημείωση, χωρίς κατηγοριοποίηση." />
      </Modal>
    </div>
  );
}
