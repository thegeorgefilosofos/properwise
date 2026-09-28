'use client'
// ═══════════════════════════════════════════════════════════════════════════
// Η ΖΩΝΤΑΝΗ ΣΥΝΔΡΟΜΗ: ΟΙ ΣΥΝΔΕΣΜΟΙ ΓΙΑ ΕΞΩΤΕΡΙΚΑ ΗΜΕΡΟΛΟΓΙΑ ΚΑΙ ΚΑΝΑΛΙΑ
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from 'react'
import { feedUrl } from '@/lib/data/calendarFeed'
import { T, Btn, Modal, Spinner } from '@/components/Theme'
import { Calendar, CalendarDays, Info, CalendarPlus } from 'lucide-react'

// ══ ΕΝΑ ΙΔΙΩΜΑ ΓΙΑ ΤΟΝ ΣΥΝΔΕΣΜΟ, ΚΑΙ ΦΑΙΝΕΤΑΙ ΟΛΟΚΛΗΡΟΣ ══════════════════════
// ΤΙ ΔΕΝ ΠΗΓΑΙΝΕ. Οι δύο σύνδεσμοι ζούσαν μέσα σε <input readOnly> πλάτους 280
// εικονοστοιχείων. Ο πρώτος έχει 62 χαρακτήρες και ο δεύτερος 118: φαινόταν
// περίπου το ένα τρίτο του καθενός, κομμένο στη μέση μιας λέξης. Ένα πεδίο
// εισόδου υπόσχεται ότι γράφεις μέσα του, εδώ όμως δεν γράφεις ποτέ — αντιγράφεις
// και επικολλάς αλλού. Και για να ΕΠΙΒΕΒΑΙΩΣΕΙΣ ότι αντέγραψες το σωστό (ο ένας
// σύνδεσμος φέρνει ονόματα επισκεπτών, ο άλλος όχι) πρέπει να τον δεις ολόκληρο.
//
// Τώρα είναι μπλοκ που αναδιπλώνεται: όλος ο σύνδεσμος ορατός, σε γραμματοσειρά
// σταθερού πλάτους όπως κάθε άλλο τεχνικό στοιχείο της εφαρμογής, με το κουμπί
// αντιγραφής στη γραμμή της ετικέτας αντί για κολλητά δεξιά. Το ίδιο στοιχείο
// και στις δύο θέσεις, ώστε οι δύο ενότητες να διαβάζονται ως ζευγάρι.
function FeedLink({ label, hint, url, onCopy, copied }: {
  label:string; hint:string; url:string; onCopy:()=>void; copied:boolean
}) {
  return (
    <div>
      <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:12, marginBottom:6 }}>
        <span style={{ fontSize: 'var(--fs-xs)', fontWeight:600, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.06em', fontFamily: T.font.sans }}>{label}</span>
        <Btn onClick={onCopy}>{copied?'Αντιγράφηκε':'Αντιγραφή'}</Btn>
      </div>
      <p style={{ fontSize:12, color:'var(--text-tertiary)', margin:'0 0 8px', lineHeight:1.5, fontFamily: T.font.sans }}>{hint}</p>
      {/* ΤΟ ΚΕΙΜΕΝΟ ΕΠΙΛΕΓΕΤΑΙ ΜΕ ΤΟ ΧΕΡΙ ΟΠΩΣ ΠΡΙΝ. Το `user-select: all` δίνει
          ολόκληρο τον σύνδεσμο με ένα κλικ, για όποιον δεν εμπιστεύεται το
          πρόχειρο ή δουλεύει σε περιηγητή που το αρνείται. */}
      <code style={{ display:'block', padding:'10px 12px', borderRadius:T.radius.btn, border:'1px solid var(--border-subtle)', background:'var(--bg-base)', color:'var(--text-secondary)', fontSize:12, lineHeight:1.6, fontFamily: T.font.num, wordBreak:'break-all', userSelect:'all' }}>{url}</code>
    </div>
  )
}

// Ζωντανή συνδρομή: το εξωτερικό ημερολόγιο διαβάζει το feed και ενημερώνεται μόνο του.
// ── ΜΙΑ ΣΥΝΔΡΟΜΗ, ΟΧΙ ΔΥΟ ────────────────────────────────────────────────────
// Ο σύνδεσμος έδειχνε σε συνάρτηση άκρου (`/functions/v1/calendar-feed`) που
// έγραφε ΔΙΚΟ ΤΗΣ .ics: τρίτο αντίγραφο της διαφυγής του προτύπου και
// αναδίπλωση γραμμής μετρημένη σε ΧΑΡΑΚΤΗΡΕΣ αντί για οκτάδες — δηλαδή κάθε
// ελληνικός τίτλος πάνω από 37 γράμματα έσπαγε εκτός προτύπου. Εδειχνε επίσης
// ΜΟΝΟ τα γεγονότα του ημερολογίου: ούτε λογαριασμός που λήγει, ούτε δόση
// ενοικίου, ούτε εκκρεμότητα με προθεσμία.
//
// Δείχνει πλέον στη διαδρομή της εφαρμογής (`/imerologio/<κουπόνι>.ics`), που
// είναι δοκιμασμένη, τυλίγει σωστά και κουβαλά και τις τέσσερις πηγές. Το
// κουπόνι είναι ΤΟ ΙΔΙΟ — ίδιος πίνακας, ίδια γραμμή — οπότε καμία υπάρχουσα
// συνδρομή δεν χάνεται· αλλάζει μόνο η διεύθυνση που προτείνουμε.
export function SubscribeModal({ token, propertyId, onClose }: { token:string|null; propertyId:string; onClose:()=>void }) {
  const [copied,setCopied]=useState(false)
  const [copiedBusy,setCopiedBusy]=useState(false)
  const base=(process.env.NEXT_PUBLIC_SUPABASE_URL||'').replace(/\/$/,'')
  const httpsUrl=feedUrl(token)
  const busyUrl=token?`${base}/functions/v1/bookings-feed?token=${token}&property=${propertyId}`:''
  const copyBusy=async()=>{ try{ await navigator.clipboard.writeText(busyUrl); setCopiedBusy(true); setTimeout(()=>setCopiedBusy(false),1800) }catch{} }
  const webcalUrl=httpsUrl.replace(/^https?:\/\//,'webcal://')
  const googleUrl=`https://calendar.google.com/calendar/r/settings/addbyurl?url=${encodeURIComponent(httpsUrl)}`
  const copy=async()=>{ try{ await navigator.clipboard.writeText(httpsUrl); setCopied(true); setTimeout(()=>setCopied(false),1800) }catch{} }
  return (
    <Modal open onClose={onClose} size="md" icon={<CalendarPlus size={19}/>}
      title="Ζωντανή συνδρομή"
      subtitle="Σύνδεσε μία φορά και το ημερολόγιό σου ενημερώνεται μόνο του, σε Google, Apple ή Outlook. Κουβαλά όλα σου τα ακίνητα: γεγονότα, λογαριασμούς που λήγουν, δόσεις ενοικίου και εκκρεμότητες με προθεσμία.">
      {!token?(
        <Spinner size={20} label="Δημιουργία συνδέσμου…" />
      ):(<>
        <FeedLink label="Σύνδεσμος συνδρομής" url={httpsUrl} onCopy={copy} copied={copied}
          hint="Προσωπικός σύνδεσμος: δείχνει όλα τα ακίνητά σου, με τα ονόματα των γεγονότων. Μην τον μοιράζεσαι." />
        {/* Τα δύο κουμπιά κάνουν τη δουλειά χωρίς αντιγραφή: το πρώτο ανοίγει
            κατευθείαν την οθόνη προσθήκης του Google, το δεύτερο παραδίδει τον
            σύνδεσμο στην εφαρμογή ημερολογίου του λειτουργικού. */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          {/* `field` γιατί καθένα γεμίζει το κελί του πλέγματος, με το ύψος πεδίου που είχε το τοπικό `linkBtn`. */}
          <Btn href={googleUrl} newTab field><Calendar size={16}/>Google Calendar</Btn>
          <Btn href={webcalUrl} field><CalendarDays size={16}/>Apple / Outlook</Btn>
        </div>
        {/* Η ΠΡΟΕΙΔΟΠΟΙΗΣΗ ΓΙΑ ΤΟΝ ΠΡΟΣΩΠΙΚΟ ΣΥΝΔΕΣΜΟ ΕΦΥΓΕ ΑΠΟ ΕΔΩ: λέγεται
            πλέον δίπλα στον ίδιο τον σύνδεσμο, όπου την αφορά. Εδώ μένουν μόνο
            οι οδηγίες για όποιον προτιμά τη χειροκίνητη διαδρομή. */}
        <div style={{ display:'flex', gap:8, padding:'10px 12px', background:'var(--accent-soft)', border:'1px solid var(--accent-border)', borderRadius:T.radius.inner }}>
          <Info size={15} color="var(--accent)" className="po-lead-ico"/>
          <p style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.5, margin:0, fontFamily: T.font.sans }}>Με το χέρι στο Google Calendar: «Άλλα ημερολόγια», μετά «Από URL» και επικόλλησε τον σύνδεσμο.</p>
        </div>
        {/* Αμφίδρομος συγχρονισμός καναλιών (Airbnb/Booking auto-block) */}
        <div style={{ paddingTop:16, borderTop:'1px solid var(--border-subtle)' }}>
          <FeedLink label="Μπλοκάρισμα σε Airbnb ή Booking" url={busyUrl} onCopy={copyBusy} copied={copiedBusy}
            hint="Επικόλλησέ τον στο «Import calendar» κάθε καναλιού. Κάθε κράτηση μπλοκάρει τις ημερομηνίες παντού, χωρίς να ταξιδεύει το όνομα του επισκέπτη." />
        </div>
      </>)}
    </Modal>
  )
}
