'use client';
// ═══════════════════════════════════════════════════════════════════════════
// «ΖΗΤΗΣΕ ΤΟ»: ΕΝΑ ΠΑΡΑΘΥΡΟ, ΟΧΙ ΔΥΟ ΠΑΤΗΜΑΤΑ ΣΤΗΝ ΙΔΙΑ ΓΡΑΜΜΗ
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΗΤΑΝ. Το πρώτο πάτημα άνοιγε πεδίο κάτω από τη γραμμή, το δεύτερο (ίδιο
// κουμπί, άλλο λεκτικό) έστελνε. Ο λογιστής δεν έβλεπε τι ακριβώς θα διάβαζε ο
// πελάτης ούτε μπορούσε να του το στείλει εκεί που απαντά, στο τηλέφωνό του.
//
// ΤΙ ΚΑΝΕΙ ΤΩΡΑ. Δείχνει τι ζητιέται, δέχεται σημείωση και ρωτά «Στείλε με».
// Το αίτημα γράφεται ΠΑΝΤΑ στην εφαρμογή (ο ιδιοκτήτης το βλέπει στη Λογιστική
// του, το ιστορικό μένει). Αν διαλέχτηκε email, WhatsApp, Viber ή SMS, μετά την
// καταγραφή το παράθυρο δίνει σύνδεσμο που ανοίγει την εφαρμογή με έτοιμο
// κείμενο. ΣΥΝΔΕΣΜΟ ΠΟΥ ΠΑΤΑ Ο ΑΝΘΡΩΠΟΣ, όχι αυτόματο άνοιγμα: μετά από
// αναμονή δικτύου ο περιηγητής μπλοκάρει κάθε παράθυρο που δεν άνοιξε από κλικ.
//
// ΤΑ ΚΑΝΑΛΙΑ ΒΓΑΙΝΟΥΝ ΑΠΟ ΤΑ ΣΤΟΙΧΕΙΑ (lib/accountant/ask.ts): χωρίς email ή
// ελληνικό κινητό του πελάτη μένει μόνο η εφαρμογή. Ονόματα σε κείμενο και
// ουδέτερα εικονίδια· κανένα σήμα τρίτου.
// ═══════════════════════════════════════════════════════════════════════════
import { useId, useMemo, useState } from 'react';
import { AppWindow, Mail, MessageCircle, MessageSquare, MessageSquareText, Check } from 'lucide-react';
import { T, TT, Btn, Modal, ChipToggle, fd } from '@/components/Theme';
import { Textarea } from '@/app/dashboard/components/UIComponents';
import {
  askChannels, askHref, askText, askSentText, ASK_CHANNEL_LABEL,
  type AskChannel, type AskContact,
} from '@/lib/accountant/ask';

const ICON: Record<AskChannel, typeof Mail> = {
  app: AppWindow, email: Mail, whatsapp: MessageCircle, viber: MessageSquare, sms: MessageSquareText,
};

const note: React.CSSProperties = { ...TT.bodySm, color: 'var(--text-tertiary)', margin: 0 };
const label: React.CSSProperties = { ...TT.label, color: 'var(--text-tertiary)', margin: 0 };

export interface AskTarget {
  ownerId: string;
  ownerName: string;
  key: string;
  item: string;
  contact?: AskContact | null;
}

export default function RequestSheet({ target, year, from, onClose, onSend }: {
  target: AskTarget;
  year: number;
  /** Η υπογραφή του μηνύματος: το όνομα του γραφείου, αν υπάρχει. */
  from?: string | null;
  onClose: () => void;
  /** Γράφει το αίτημα στην εφαρμογή. `true` όταν η βάση το δέχτηκε. */
  onSend: (note: string | undefined) => Promise<boolean>;
}) {
  const channels = useMemo(() => askChannels(target.contact), [target.contact]);
  const [ch, setCh] = useState<AskChannel>('app');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Μετά την καταγραφή, για εξωτερικό κανάλι: ο σύνδεσμος που ανοίγει την εφαρμογή του.
  const [sent, setSent] = useState<{ ch: AskChannel; href: string | null; at: Date } | null>(null);
  const hintId = useId();

  const message = askText({ key: target.key, item: target.item, year, note: text, from });
  const external = ch !== 'app';

  const send = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    const ok = await onSend(text.trim() || undefined);
    setBusy(false);
    if (!ok) { setError('Το αίτημα δεν στάλθηκε. Έλεγξε τη σύνδεση και δοκίμασε ξανά.'); return; }
    setSent({ ch, href: askHref(ch, target.contact, message), at: new Date() });
  };

  const openLabel = sent?.ch === 'email' ? 'Άνοιξε το email' : sent?.ch === 'sms' ? 'Άνοιξε το SMS' : sent ? `Άνοιξε το ${ASK_CHANNEL_LABEL[sent.ch]}` : '';

  return (
    <Modal open onClose={onClose} size="sm" title="Ζήτησέ το" subtitle={`${target.ownerName} · Χρήση ${year}`}
      footer={sent ? (
        <>
          <Btn variant={sent.href ? 'ghost' : 'primary'} onClick={onClose}>Κλείσιμο</Btn>
          {sent.href && (
            <Btn variant="primary" href={sent.href} newTab={sent.ch === 'whatsapp'} onClick={() => { setTimeout(onClose, 0); }}>{openLabel}</Btn>
          )}
        </>
      ) : (
        <>
          <Btn variant="ghost" onClick={onClose} disabled={busy}>Ακύρωση</Btn>
          <Btn variant="primary" onClick={() => void send()} disabled={busy} describedBy={external ? hintId : undefined}>
            {busy ? 'Αποστολή…' : ch === 'email' ? 'Στείλε με email' : external ? `Στείλε με ${ASK_CHANNEL_LABEL[ch]}` : 'Στείλε'}
          </Btn>
        </>
      )}>
      {sent ? (
        <div role="status" style={{ display: 'flex', gap: T.sp.md, alignItems: 'flex-start' }}>
          <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: T.h.sm, height: T.h.sm, borderRadius: T.radius.pill, background: 'var(--positive-dim)', color: 'var(--positive)', flexShrink: 0 }}>
            <Check size={16} />
          </span>
          <div style={{ minWidth: 0 }}>
            <p style={{ ...TT.body, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{`Στάλθηκε στην εφαρμογή στις ${fd(sent.at)}`}</p>
            <p style={{ ...note, marginTop: T.sp.xs }}>
              {sent.href
                ? askSentText(sent.ch).replace('Στάλθηκε στην εφαρμογή. ', '')
                : `Ο πελάτης το βλέπει στη Λογιστική του: «${target.item}».`}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div>
            <p style={label}>Τι ζητάς</p>
            <p style={{ ...TT.body, fontWeight: 600, color: 'var(--text-primary)', margin: `${T.sp.xs}px 0 0` }}>{target.item}</p>
          </div>

          <Textarea dictation label="Σημείωση, προαιρετικά" value={text} onChange={setText} rows={2} autoGrow
            placeholder="Π.χ. του Οκτωβρίου, με τις αποδείξεις" />

          {/* ΜΟΝΟ ΜΕ ΔΕΥΤΕΡΟ ΚΑΝΑΛΙ ΥΠΑΡΧΕΙ ΕΠΙΛΟΓΗ. Σήμερα το γραφείο δεν βλέπει
              email ή κινητό του πελάτη (lib/data/accountant.ts), οπότε το αίτημα
              φεύγει στην εφαρμογή και η ομάδα «Στείλε με» με ένα πλακίδιο θα ήταν
              επιλογή χωρίς επιλογές. */}
          {channels.length === 1 ? (
            <p style={note}>Ο πελάτης το βλέπει στη Λογιστική του, μαζί με τη σημείωσή σου.</p>
          ) : (
          <div role="group" aria-labelledby={`${hintId}-l`}>
            <p id={`${hintId}-l`} style={label}>Στείλε με</p>
            {/* ΚΑΘΕ ΣΕΙΡΑ ΓΕΜΙΖΕΙ ΤΟ ΠΛΑΤΟΣ: πέντε πλακίδια με πλάτος λεκτικού άφηναν
                τη δεύτερη γραμμή με δύο κοντά κουτιά και κενό δεξιά. Κάθε πλακίδιο
                ξεκινά από το λεκτικό του και μεγαλώνει ώσπου να κλείσει η σειρά. */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: T.sp.sm, marginTop: T.sp.sm }}>
              {channels.map(c => {
                const Icon = ICON[c];
                return (
                  <div key={c} style={{ display: 'flex', flex: '1 1 auto' }}>
                    <ChipToggle on={ch === c} onClick={() => setCh(c)} size="lg" grow>
                      <Icon size={16} aria-hidden="true" />{ASK_CHANNEL_LABEL[c]}
                    </ChipToggle>
                  </div>
                );
              })}
            </div>
            <p id={hintId} style={{ ...note, marginTop: T.sp.sm }}>
              {ch === 'viber'
                ? 'Καταγράφεται στην εφαρμογή και ανοίγει το Viber με το μήνυμα έτοιμο: διάλεξε την επαφή στο Viber.'
                : external
                  ? `Καταγράφεται στην εφαρμογή και ανοίγει ${ch === 'email' ? 'το email' : ch === 'sms' ? 'το SMS' : 'το WhatsApp'} με το μήνυμα έτοιμο.`
                  : 'Ο πελάτης το βλέπει στη Λογιστική του.'}
            </p>
          </div>
          )}

          {external && (
            <div>
              <p style={label}>Το μήνυμα</p>
              <p style={{ ...TT.bodySm, color: 'var(--text-secondary)', margin: `${T.sp.sm}px 0 0`, padding: `${T.sp.md}px ${T.sp.lg}px`, background: 'var(--bg-elevated)', borderRadius: T.radius.chip, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                {message.body}
              </p>
            </div>
          )}

          {error && <p role="alert" style={{ ...note, color: 'var(--negative)' }}>{error}</p>}
        </>
      )}
    </Modal>
  );
}
