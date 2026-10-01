'use client'
// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΔΥΟ ΕΙΣΑΓΩΓΕΣ ΔΙΑΜΟΝΩΝ: ΑΠΟ EMAIL ΚΡΑΤΗΣΗΣ ΚΑΙ ΑΠΟ ΗΜΕΡΟΛΟΓΙΟ iCal
// ═══════════════════════════════════════════════════════════════════════════
import { T, Btn, Modal, fe, InfoBanner, LinkBtn, fd, formGrid } from '@/components/Theme'
import { NumberInput, TextInput, CustomSelect, DatePicker, Textarea, Toggle } from '../UIComponents'
import { channelOptions } from './model'
import type { ClientsProps, ClientsState } from './useClients'
import { icalToStayDrafts } from '@/lib/clients/ical'
import { statTile } from './Bits'

export function EmailStayModal({
  emailOpen, setEmailOpen, emailDraft, parseEmail, emailBusy, emailText, setEmailDraft,
  saveEmailStay, setEmailText, emailErr, fGrid,
}: Pick<ClientsProps & ClientsState,
  'emailOpen' | 'setEmailOpen' | 'emailDraft' | 'parseEmail' | 'emailBusy' | 'emailText' |
  'setEmailDraft' | 'saveEmailStay' | 'setEmailText' | 'emailErr'
> & { fGrid: React.CSSProperties }) {
  return (
    <Modal open={emailOpen} onClose={() => setEmailOpen(false)} size="md"
      title="Εισαγωγή από email" ariaLabel="Εισαγωγή κράτησης από μήνυμα"
      subtitle="Επικόλλησε το email κράτησης (Airbnb/Booking) και το AI βρίσκει όνομα, ημερομηνίες και ποσό"
      footer={!emailDraft ? (
        <>
          <Btn variant="ghost" onClick={() => setEmailOpen(false)}>Ακύρωση</Btn>
          <Btn variant="primary" onClick={parseEmail} disabled={emailBusy || emailText.trim().length < 20}>{emailBusy ? 'Ανάλυση…' : 'Ανάλυση'}</Btn>
        </>
      ) : (
        <>
          <Btn variant="ghost" onClick={() => setEmailDraft(null)}>Πίσω</Btn>
          <Btn variant="primary" onClick={saveEmailStay} disabled={emailBusy || !emailDraft.name.trim()}>{emailBusy ? 'Αποθήκευση…' : 'Αποθήκευση διαμονής'}</Btn>
        </>
      )}>
    {!emailDraft ? (
      <>
        <Textarea label="Κείμενο email" value={emailText} onChange={setEmailText} rows={8} placeholder="Επικόλλησε εδώ το περιεχόμενο του email κράτησης…" />
        {emailErr && <div style={{ background: 'var(--negative-soft)', border: '1px solid var(--negative-border)', borderRadius: T.radius.inner, padding: '10px 14px', fontSize: 'var(--fs-base)', color: 'var(--negative)' }}>{emailErr}</div>}
      </>
    ) : (
      <>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Έλεγξε και διόρθωσε αν χρειάζεται, μετά αποθήκευσε. Θα δημιουργηθεί ο επισκέπτης (αν δεν υπάρχει) και η διαμονή.</div>
        <div style={fGrid}>
          <div style={{ gridColumn: '1 / -1' }}><TextInput label="Όνομα επισκέπτη" value={emailDraft.name} onChange={v => setEmailDraft(d => d && { ...d, name: v })} /></div>
          <DatePicker label="Άφιξη" value={emailDraft.check_in} onChange={v => setEmailDraft(d => d && { ...d, check_in: v })} />
          <DatePicker label="Αναχώρηση" value={emailDraft.check_out} onChange={v => setEmailDraft(d => d && { ...d, check_out: v })} />
          {/* Το ένα, διφορούμενο «Ποσό (payout)» έγινε τρία ξεχωριστά.
              Εκεί γεννιόταν η αντίφαση: ό,τι μπαινε εδώ ως payout
              διαβαζόταν αλλού ως ακαθάριστο και φορολογούνταν. */}
          <NumberInput label="Πλήρωσε ο επισκέπτης" labelInfo="Το σύνολο που πλήρωσε ο επισκέπτης, πριν την προμήθεια." value={emailDraft.gross} onChange={v => setEmailDraft(d => d && { ...d, gross: v })} suffix="€" />
          <NumberInput label="Τέλος ανθεκτικότητας" labelInfo="Δεν είναι έσοδό σου· αφαιρείται από το δηλωτέο ακαθάριστο." value={emailDraft.levy} onChange={v => setEmailDraft(d => d && { ...d, levy: v })} suffix="€" />
          <NumberInput label="Προμήθεια πλατφόρμας" labelInfo="Δαπάνη που εκπίπτει· ΔΕΝ μειώνει το δηλωτέο ακαθάριστο." value={emailDraft.fee} onChange={v => setEmailDraft(d => d && { ...d, fee: v })} suffix="€" />
          <CustomSelect label="Κανάλι" value={emailDraft.channel} onChange={v => setEmailDraft(d => d && { ...d, channel: v })} options={channelOptions} />
        </div>
        {(parseFloat(emailDraft.gross) || 0) > 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Δηλωτέο ακαθάριστο: <strong style={{ fontFamily: T.font.num, color: 'var(--text-primary)' }}>{fe(Math.max(0, (parseFloat(emailDraft.gross) || 0) - (parseFloat(emailDraft.levy) || 0)))}</strong>
          </div>
        )}
      </>
    )}
    </Modal>
  )
}

export function IcalImportModal({
  icalOpen, setIcalOpen, icalEvents, importIcal, icalBusy, icalPropertyId, setIcalPropertyId, props,
  icalChannel, setIcalChannel, secHead, icalUrl, setIcalUrl, fetchIcalFromUrl, saveIcalFeed,
  icalFeedsFailed, loadIcalFeeds, icalFeeds, syncIcalNow, delIcalFeed, icalText, setIcalText,
  parseIcalInput, icalIncludeBlocked, setIcalIncludeBlocked, icalMsg,
}: Pick<ClientsProps & ClientsState,
  'icalOpen' | 'setIcalOpen' | 'icalEvents' | 'importIcal' | 'icalBusy' | 'icalPropertyId' |
  'setIcalPropertyId' | 'props' | 'icalChannel' | 'setIcalChannel' | 'icalUrl' | 'setIcalUrl' |
  'fetchIcalFromUrl' | 'saveIcalFeed' | 'icalFeedsFailed' | 'loadIcalFeeds' | 'icalFeeds' |
  'syncIcalNow' | 'delIcalFeed' | 'icalText' | 'setIcalText' | 'parseIcalInput' |
  'icalIncludeBlocked' | 'setIcalIncludeBlocked' | 'icalMsg'
> & { secHead: (t: string, top?: number) => React.ReactNode }) {
  return (
    <Modal open={icalOpen} onClose={() => setIcalOpen(false)} size="lg"
      title="Εισαγωγή iCal" subtitle="Συγχρονισμός κρατήσεων από Airbnb ή Booking"
      icon={<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>}
      footer={icalEvents ? (
        <>
          <Btn variant="ghost" onClick={() => setIcalOpen(false)}>Κλείσιμο</Btn>
          <Btn variant="primary" onClick={importIcal} disabled={icalBusy || !icalPropertyId}>{icalBusy ? 'Εισαγωγή…' : 'Εισαγωγή κρατήσεων'}</Btn>
        </>
      ) : undefined}>
    {/* Ήταν τέσσερις γραμμές κειμένου πριν από το πρώτο πεδίο και οι τρεις
        εξηγούσαν πράγματα που φαίνονται μόνα τους μόλις γίνει η εισαγωγή.
        Έμεινε το ένα που πρέπει να ξέρεις ΠΡΙΝ: τι δεν θα έρθει. */}
    <InfoBanner tone="info">Το iCal φέρνει μόνο ημερομηνίες, χωρίς όνομα επισκέπτη ή ποσό.</InfoBanner>
    <div style={{ ...formGrid(220, 297), gap: 14 }}>
      <CustomSelect label="Ακίνητο" value={icalPropertyId} onChange={setIcalPropertyId} options={props.map(p => ({ value: p.id, label: p.name }))} placeholder="Επίλεξε ακίνητο" />
      <CustomSelect label="Κανάλι" value={icalChannel} onChange={v => setIcalChannel(v as 'airbnb' | 'booking' | 'other')} options={[{ value: 'airbnb', label: 'Airbnb' }, { value: 'booking', label: 'Booking' }, { value: 'other', label: 'Άλλο' }]} />
    </div>

    {/* Αυτόματος συγχρονισμός μέσω συνδέσμου (server-side, χωρίς CORS)
        ΓΙΑΤΙ ΤΥΛΙΓΜΑ ΚΑΙ ΟΧΙ ΕΠΙΠΕΔΑ ΑΔΕΛΦΙΑ: το σώμα του Modal είναι flex
        στήλη με gap 20. Μια επικεφαλίδα με δικό της περιθώριο 18 από πάνω
        γινόταν 38 εικονοστοιχεία και τα 10 από κάτω γίνονταν 30 — δηλαδή η
        ετικέτα καθόταν πιο κοντά στην προηγούμενη ενότητα παρά στα δικά της
        πεδία. Κάθε ενότητα είναι ΕΝΑ παιδί: το gap χωρίζει ενότητες, το
        εσωτερικό gap 12 χωρίζει πεδία. */}
    <div>
      {secHead('Αυτόματος συγχρονισμός', 0)}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <TextInput label="Σύνδεσμος iCal" value={icalUrl} onChange={setIcalUrl} placeholder="https://www.airbnb.com/calendar/ical/....ics" />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Btn variant="secondary" onClick={fetchIcalFromUrl} disabled={icalBusy || !icalUrl.trim()}>{icalBusy ? 'Ανάκτηση…' : 'Ανάκτηση και προεπισκόπηση'}</Btn>
          <Btn variant="primary" onClick={saveIcalFeed} disabled={icalBusy || !icalUrl.trim() || !icalPropertyId}>Αποθήκευση και αυτόματος συγχρονισμός</Btn>
        </div>

        {/* ΤΟ ΚΕΝΟ ΕΔΩ ΔΙΑΒΑΖΟΤΑΝ «ΔΕΝ ΕΧΕΙΣ ΑΥΤΟΜΑΤΟ ΣΥΓΧΡΟΝΙΣΜΟ». Οταν οι
            ροές δεν διαβάζονταν, το κουτί απλώς δεν εμφανιζόταν: ο οικοδεσπότης
            δεν έβλεπε ούτε ότι μια ροή είχε σταματήσει με σφάλμα ούτε ότι ο
            σύνδεσμος υπάρχει ήδη, οπότε τον αποθήκευε ξανά γράφοντας από πάνω
            κανάλι κι επιλογή μπλοκαρισμάτων. Η άγνοια λέγεται πλέον ρητά. */}
        {icalPropertyId && icalFeedsFailed && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Οι αποθηκευμένοι σύνδεσμοι δεν διαβάστηκαν. Δεν ξέρουμε αν υπάρχει ήδη σύνδεσμος για αυτό το ακίνητο ούτε αν πέτυχε ο τελευταίος συγχρονισμός.{' '}
            <LinkBtn onClick={() => { void loadIcalFeeds(); }}>Δοκίμασε ξανά</LinkBtn>
          </div>
        )}
        {/* Αποθηκευμένοι σύνδεσμοι (ανά επιλεγμένο ακίνητο) */}
        {icalPropertyId && icalFeeds.filter(f => f.property_id === icalPropertyId).length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {icalFeeds.filter(f => f.property_id === icalPropertyId).map(f => (
              <div key={f.id} style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-raised)', borderRadius: T.radius.card, padding: 12, boxShadow: 'var(--highlight-inset), var(--elev-1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0, flex: '1 1 220px' }}>
                    <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-primary)' }}>{f.channel === 'airbnb' ? 'Airbnb' : f.channel === 'booking' ? 'Booking' : 'Άλλο'}</div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.url}</div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: f.last_status?.startsWith('error') ? 'var(--negative)' : 'var(--text-secondary)', marginTop: 4 }}>
                      {f.last_synced_at ? `Τελευταίος συγχρονισμός: ${fd(f.last_synced_at)}${f.last_status ? ` · ${f.last_status}` : ''}` : 'Δεν έχει συγχρονιστεί ακόμη'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center', fontSize: 12 }}>
                    <Btn onClick={() => syncIcalNow(f.property_id)} disabled={icalBusy}>Συγχρονισμός τώρα</Btn>
                    <LinkBtn tone="quiet" onClick={() => delIcalFeed(f)}>Αφαίρεση</LinkBtn>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>

    {/* Χειροκίνητη εισαγωγή με επικόλληση. Ίδια δομή ενότητας με την από
        πάνω: η επικεφαλίδα δεν είναι αδελφός του gap του Modal. */}
    <div>
      {secHead('Χειροκίνητη επικόλληση', 0)}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Textarea label="Περιεχόμενο .ics" value={icalText} onChange={setIcalText} rows={5} placeholder="BEGIN:VCALENDAR ..." />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Btn variant="secondary" onClick={parseIcalInput} disabled={icalBusy}>Ανάλυση επικόλλησης</Btn>
          {icalEvents && <Toggle on={icalIncludeBlocked} onChange={setIcalIncludeBlocked} label="Και τα μπλοκαρίσματα ημερομηνιών" />}
        </div>
        {icalMsg && <div style={{ fontSize: 12, color: icalMsg.error ? 'var(--negative)' : 'var(--text-secondary)', lineHeight: 1.5 }}>{icalMsg.text}</div>}
        {/* Η προεπισκόπηση υπολογίζεται ΜΟΝΟ με ανοιχτό το παράθυρο: το
            `icalEvents` δεν καθαρίζεται στο κλείσιμο, οπότε χωρίς τον έλεγχο
            `icalOpen` το `icalToStayDrafts` ξανάτρεχε σε κάθε απόδοση της
            καρτέλας — το παράθυρο δεν αποπροσαρτάται πια, μόνο κρύβεται. */}
        {icalOpen && icalEvents && (() => {
          // Η ΠΡΟΕΠΙΣΚΟΠΗΣΗ ΔΕΙΧΝΕΙ ΟΣΑ ΘΑ ΜΠΟΥΝ, ΟΧΙ ΟΣΑ ΔΙΑΒΑΣΤΗΚΑΝ. Οι
          // ακυρωμένες μετριούνται χωριστά και φαίνονται: ο ιδιοκτήτης που
          // βλέπει «τρεις κρατήσεις» στο Airbnb και «δύο» εδώ πρέπει να
          // καταλάβει γιατί, αλλιώς νομίζει ότι χάθηκε μία.
          const oles = icalToStayDrafts(icalEvents, { propertyId: icalPropertyId || 'x', channel: icalChannel });
          const akyromenes = oles.filter(d => d.cancelled);
          const drafts = oles.filter(d => !d.cancelled);
          const bookings = drafts.filter(d => !d.blocked);
          const blocks = drafts.filter(d => d.blocked);
          const toImport = icalIncludeBlocked ? drafts : bookings;
          const nights = toImport.reduce((s, d) => s + d.nights, 0);
          return (
            <div style={{ background: 'var(--bg-base)', boxShadow: 'var(--well-inset)', borderRadius: T.radius.inner, padding: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 120px), 1fr))', gap: 10, marginBottom: 12 }}>
                {statTile('Κρατήσεις', String(bookings.length))}
                {statTile('Μπλοκαρίσματα', String(blocks.length))}
                {statTile('Νύχτες προς εισαγωγή', String(nights))}
                {akyromenes.length > 0 && statTile('Ακυρωμένες', String(akyromenes.length))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                {toImport.slice(0, 40).map((d, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12, color: 'var(--text-secondary)', padding: '6px 10px', background: 'var(--surface-raised)', border: '1px solid var(--border-raised)', borderRadius: T.radius.chip }}>
                    <span>{fd(d.check_in)} έως {fd(d.check_out)}</span>
                    <span style={{ color: 'var(--text-tertiary)' }}>{d.nights} νύχτες{d.blocked ? ' · μπλοκάρισμα' : ''}</span>
                  </div>
                ))}
                {toImport.length > 40 && <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textAlign: 'center', padding: 4 }}>και άλλες {toImport.length - 40}…</div>}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
    </Modal>
  )
}
