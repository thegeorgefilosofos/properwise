'use client'
// ═══════════════════════════════════════════════════════════════════════════
// Η ΠΡΟΒΟΛΗ ΜΗΝΑ: ΠΛΕΓΜΑ, ΔΙΑΔΡΟΜΟΣ ΚΡΑΤΗΣΕΩΝ, ΦΥΛΛΟ ΗΜΕΡΑΣ, ΜΕΤΑΦΟΡΑ
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect, useRef } from 'react'
import { T, Btn, Modal, fe, fn, pressable } from '@/components/Theme'
import { useCoarsePointer } from '@/components/useCoarsePointer'
import { User, RotateCcw } from 'lucide-react'
import { holidayName, isWeekend } from '@/lib/calendar/greekHolidays'
import { groupSeries } from '@/lib/calendar/series'
import { staysOnDay, weekSegments, channelColor, type StaySpan } from '@/lib/calendar/stayBars'
import { MONTHS_NOM, mondayFirst, monthGen } from '@/lib/core/months'
import { type CalEvent, CATEGORIES, DAY_NAMES_GR, daysUntil, isOverdue, todayStr } from './model'
import { Tooltip } from './Bits'

// Ενιαίο drag με pointer events — δουλεύει σε ΠΟΝΤΙΚΙ ΚΑΙ ΑΦΗ (κινητό/tablet).
// Στόχοι drop φέρουν data-drop-date (και προαιρετικά data-drop-time: «HH:00» για ώρα,
// «» για ολοήμερο, απόν = κράτα ώρα). Η μεταφορά ξεκινά μετά από κατώφλι 6px ώστε το
// απλό «κλικ» να ανοίγει κανονικά το γεγονός.
type DragCtl = { onDown:(id:string,label:string)=>(e:React.PointerEvent)=>void; ghost:{label:string;x:number;y:number}|null }
export function usePointerDrag(onMove:(id:string,date:string,time?:string|null)=>void): DragCtl {
  const [ghost,setGhost]=useState<{label:string;x:number;y:number}|null>(null)
  const st=useRef<{id:string;label:string;active:boolean;sx:number;sy:number}|null>(null)
  const clearHot=()=>document.querySelectorAll('[data-drop-hot]').forEach(n=>{const el=n as HTMLElement; el.style.background=el.dataset.dropBg||''; el.removeAttribute('data-drop-hot'); delete el.dataset.dropBg})
  useEffect(()=>{
    const move=(e:PointerEvent)=>{
      const s=st.current; if(!s)return
      if(!s.active){ if(Math.hypot(e.clientX-s.sx,e.clientY-s.sy)<6)return; s.active=true }
      e.preventDefault()
      setGhost({label:s.label,x:e.clientX,y:e.clientY})
      clearHot()
      const el=(document.elementFromPoint(e.clientX,e.clientY) as HTMLElement|null)?.closest('[data-drop-date]') as HTMLElement|null
      if(el){ el.dataset.dropBg=el.style.background; el.setAttribute('data-drop-hot','1'); el.style.background='var(--accent-dim)' }
    }
    const up=(e:PointerEvent)=>{
      const s=st.current; st.current=null; setGhost(null)
      if(!s||!s.active){ clearHot(); return }
      const el=(document.elementFromPoint(e.clientX,e.clientY) as HTMLElement|null)?.closest('[data-drop-date]') as HTMLElement|null
      clearHot()
      if(el&&el.dataset.dropDate){ const t=el.dataset.dropTime; onMove(s.id, el.dataset.dropDate, t===undefined?undefined:(t===''?null:t)) }
      // κατάπιε το επόμενο click ώστε να μην ανοίξει «νέο γεγονός» στο cell
      const kill=(ev:Event)=>{ ev.stopPropagation(); ev.preventDefault(); window.removeEventListener('click',kill,true) }
      window.addEventListener('click',kill,true); setTimeout(()=>window.removeEventListener('click',kill,true),350)
    }
    window.addEventListener('pointermove',move,{passive:false})
    window.addEventListener('pointerup',up)
    return ()=>{ window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',up) }
  },[onMove])
  const onDown=(id:string,label:string)=>(e:React.PointerEvent)=>{ if(e.button&&e.button!==0)return; st.current={id,label,active:false,sx:e.clientX,sy:e.clientY} }
  return { onDown, ghost }
}

// ═══ Η ΓΕΩΜΕΤΡΙΑ ΤΟΥ ΔΙΑΔΡΟΜΟΥ ΚΡΑΤΗΣΕΩΝ, ΣΕ ΕΝΑ ΣΗΜΕΙΟ ══════════════════
// Τα ίδια νούμερα τα χρειάζονται δύο ανεξάρτητα σημεία: το κελί, που κρατά τον
// χώρο και η επικάλυψη, που τοποθετεί τη μπάρα. Αν αποκλίνουν έστω κατά ένα
// εικονοστοιχείο, η μπάρα κάθεται πάνω στο κείμενο ή αφήνει κενή λωρίδα.
const BAR_H = 18            // ύψος μπάρας
const BAR_GAP = 3           // απόσταση μεταξύ σειρών
const BAR_INSET = 3         // πόσο μαζεύει το κλειστό άκρο, ώστε δύο κρατήσεις να μην ακουμπούν
const MAX_LANES = 3         // πάνω από τρεις, η ημέρα γράφει «+N κρατήσεις»
const CELL_PAD = 6          // το padding του κελιού
const DAY_HEAD_H = 27       // ύψος της γραμμής με τον αριθμό της ημέρας (24 + 3 κενό)
// Η ΑΡΓΙΑ ΑΝΗΚΕΙ ΣΤΗΝ ΗΜΕΡΑ, Ο ΔΙΑΔΡΟΜΟΣ ΣΤΗΝ ΕΒΔΟΜΑΔΑ. Με τον διάδρομο από
// πάνω, το «Κοίμηση της Θεοτόκου» έπεφτε σαράντα εικονοστοιχεία κάτω από το 15
// και διαβαζόταν σαν να ανήκει σε άλλο πράγμα. Η αργία γράφεται τώρα ΠΡΙΝ τον
// διάδρομο και ο χώρος της κρατιέται σε ΟΛΑ τα κελιά της εβδομάδας που έχει
// έστω μία — αλλιώς οι μπάρες της εβδομάδας θα κάθονταν σε δύο ύψη.
const HOL_H = 16          // μία γραμμή αργίας
const HOL_H2 = 30         // δύο γραμμές, όταν το όνομα δεν χωράει σε μία

// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΚΕΛΙ ΜΕ ΤΗΝ ΑΡΓΙΑ ΜΕΓΑΛΩΝΕ ΚΑΙ ΕΣΠΡΩΧΝΕ ΤΑ ΥΠΟΛΟΙΠΑ
// ─────────────────────────────────────────────────────────────────────────
// Το πλέγμα έγραφε `repeat(7, 1fr)`. Το `1fr` σημαίνει `minmax(auto, 1fr)`,
// και το `auto` ως ΕΛΑΧΙΣΤΟ είναι το min-content: με `white-space: nowrap`,
// ολόκληρο το κείμενο. Αρα η στήλη που είχε αργία φούσκωνε όσο χρειαζόταν το
// «Εθνική εορτή 25ης Μαρτίου» και έκλεβε πλάτος από τις άλλες έξι.
//
// Και επειδή κάθε εβδομάδα είναι ΔΙΚΟ ΤΗΣ πλέγμα, το φούσκωμα ήταν τοπικό:
// στον Μάρτιο 2027 η γραμμή με την Καθαρά Δευτέρα και η γραμμή με την 25η
// Μαρτίου είχαν διαφορετικά όρια στηλών από τις υπόλοιπες. Το ημερολόγιο
// έπαυε να είναι πλέγμα. Με `minmax(0, 1fr)` οι εφτά στήλες είναι ίσες πάντα.
//
// ΤΟ ΔΕΥΤΕΡΟ ΜΙΣΟ: με ίσες στήλες, το μακρύ όνομα κόβεται. Μετρημένο σε
// πραγματικό φυλλομετρητή, στήλη 79 εικονοστοιχείων έναντι κειμένου 138.
// Τυλίγεται πια σε δεύτερη γραμμή και ο χώρος κρατιέται σε ΟΛΑ τα κελιά της
// εβδομάδας ώστε ο διάδρομος των κρατήσεων να ξεκινά στο ίδιο ύψος.
//
// ΠΟΣΕΣ ΓΡΑΜΜΕΣ ΧΡΕΙΑΖΟΝΤΑΙ: μετριέται, δεν μαντεύεται. Ο καμβάς δίνει το
// ακριβές πλάτος του κειμένου στη γραμματοσειρά που θα αποδοθεί, οπότε η
// δεύτερη γραμμή κρατιέται μόνο όταν η πρώτη δεν φτάνει. Χωρίς μέτρηση θα
// έπρεπε είτε να κρατιέται πάντα (χαμένος χώρος σε κάθε αργία) είτε να
// μαντεύεται με χαρακτήρες (και να κόβεται όταν η εικασία πέσει έξω).
let holCanvas: CanvasRenderingContext2D | null = null
function textWidth(text: string, font: string): number {
  if (typeof document === 'undefined') return 0
  if (!holCanvas) holCanvas = document.createElement('canvas').getContext('2d')
  if (!holCanvas) return 0
  holCanvas.font = font
  return holCanvas.measureText(text).width
}

// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΦΥΛΛΟ ΤΗΣ ΗΜΕΡΑΣ: ΟΠΟΥ ΤΑ ΓΕΓΟΝΟΤΑ ΕΧΟΥΝ ΕΠΙΤΕΛΟΥΣ ΥΨΟΣ
// ─────────────────────────────────────────────────────────────────────────
// Στο πλέγμα του μήνα ένα γεγονός είναι μια λωρίδα 20 εικονοστοιχείων: αρκετή
// για να ΔΕΙΣ τι τρέχει, πολύ λίγη για να την ΠΑΤΗΣΕΙΣ με δάχτυλο. Εδώ η ίδια
// μέρα ανοίγει σε γραμμές των 48, με την ώρα, την κατηγορία και το ποσό στη
// θέση τους. Ενα πάτημα ανοίγει τη σύνταξη, όπως και στο πλέγμα με ποντίκι.
//
// Δεν είναι νέα «οθόνη»: είναι η ίδια πληροφορία του κελιού, ξεδιπλωμένη όταν
// το χέρι το χρειάζεται. Γι' αυτό δεν έχει φίλτρα, ταξινομήσεις ούτε δεύτερο
// επίπεδο — μόνο τη λίστα και το «Νέο».
// ═══════════════════════════════════════════════════════════════════════════
export function DaySheet({ date, events, onClose, onPick, onNew }: {
  date: string; events: CalEvent[]; onClose: () => void; onPick: (e: CalEvent) => void; onNew: () => void
}) {
  const d = new Date(date + 'T00:00:00')
  const title = `${d.getDate()} ${monthGen(d.getMonth())}`
  const sorted = [...events].sort((a, b) => (a.event_time || '99').localeCompare(b.event_time || '99'))
  // Η ΣΤΗΛΗ ΤΗΣ ΩΡΑΣ ΚΡΑΤΙΕΤΑΙ ΜΟΝΟ ΟΤΑΝ ΥΠΑΡΧΕΙ ΩΡΑ. Οι περισσότερες
  // υποχρεώσεις ενός ακινήτου — ΕΝΦΙΑ, δόση, λογαριασμός — είναι ΗΜΕΡΕΣ, όχι
  // ραντεβού. Δεσμευμένη στήλη πέντε χαρακτήρων για όλες τους αφήνει μια τρύπα
  // αριστερά από κάθε τίτλο και δεν λέει τίποτα.
  const anyTime = sorted.some(e => !!e.event_time)
  return (
    <Modal open onClose={onClose} title={title} subtitle={`${events.length} ${events.length === 1 ? 'γεγονός' : 'γεγονότα'}`} size="sm"
      // Η μόνη ενέργεια του φύλλου είναι η κύρια: στο τηλέφωνο πιάνει όλο το
      // πλάτος (`.act-fill`), αντί να κάθεται μικρή αριστερά.
      footer={<Btn variant="primary" onClick={onNew} className="act-fill">Νέο γεγονός</Btn>}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {sorted.map((ev, i) => (
          <button key={ev.id} onClick={() => onPick(ev)} className="po-hov-row cal-day-row" data-last={i === sorted.length - 1}>
            {/* Η ώρα κρατά σταθερή στήλη ώστε οι τίτλοι να ξεκινούν όλοι από το
                ίδιο σημείο· χωρίς ώρα μένει κενή αντί να μετακινήσει τη γραμμή. */}
            {anyTime && <span style={{ width: '5ch', flexShrink: 0, fontSize: 'var(--fs-sm)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>{ev.event_time || ''}</span>}
            <span style={{ flexShrink: 0, display: 'flex', color: CATEGORIES[ev.category].color }}>{CATEGORIES[ev.category].icon}</span>
            {/* ΤΟ ΠΛΗΡΩΜΕΝΟ ΔΕΝ ΓΙΝΕΤΑΙ ΑΔΙΑΒΑΣΤΟ. Με `opacity: 0.55` ο τίτλος
              έβγαινε 3,69:1 στο φωτεινό θέμα, κάτω από το 4,5. Δηλαδή ο
              ιδιοκτήτης δεν μπορούσε να διαβάσει ΤΙ πλήρωσε — και η διαγραφή
              από πάνω το λέει ήδη ότι έγινε. Το `--text-tertiary` κρατά την
              υποχώρηση ως ΧΡΩΜΑ, με μετρήσιμη αντίθεση σε κάθε θέμα. */}
          <span className="po-elide" style={{ flex: 1, minWidth: '6ch', fontSize: 'var(--fs-base)', fontWeight: 500, color: ev.status === 'paid' ? 'var(--text-tertiary)' : 'var(--text-primary)', textDecoration: ev.status === 'paid' ? 'line-through' : 'none' }}>{ev.title}</span>
            {ev.amount ? <span style={{ flexShrink: 0, fontSize: 'var(--fs-base)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>{fe(ev.amount)}</span> : null}
          </button>
        ))}
      </div>
    </Modal>
  )
}

export function MonthView({ events, currentDate, selectedDate, onDayClick, onDayOpen, onEventClick, upcomingAll, drag, stays=[] }: {
  events: CalEvent[]; currentDate: Date; selectedDate?:string; onDayClick:(date:string)=>void; onDayOpen:(date:string)=>void; onEventClick:(e:CalEvent)=>void; upcomingAll:CalEvent[]; drag?:DragCtl; stays?:StaySpan[]
}) {
  // ═══ ΔΥΟ ΣΤΟΧΟΙ ΟΝΤΑΣ Ο ΕΝΑΣ ΜΕΣΑ ΣΤΟΝ ΑΛΛΟ, ΚΑΙ Ο ΕΣΩΤΕΡΙΚΟΣ 20 ΨΗΛΟΣ ═══
  // Το τσιπάκι του γεγονότος είχε δικό του `role="button"` μέσα σε κελί που
  // είναι κι αυτό πατήσιμο. Μετρημένο στα 390: 39×20 το τσιπάκι, 43×80 το
  // κελί. Με δάχτυλο, ένα πάτημα πάνω στο τσιπάκι πετυχαίνει το κελί τις πιο
  // πολλές φορές — δηλαδή ο χρήστης πατάει ένα γεγονός και ανοίγει η μέρα, ή
  // πατάει τη μέρα και ανοίγει λάθος γεγονός. Δώδεκα ευρήματα «στόχος < 44»
  // στη σάρωση ήταν ΟΛΑ αυτό το τσιπάκι.
  //
  // Το ύψος δεν λύνεται: εφτά στήλες σε 320 δίνουν 43 πλάτος · τρία
  // τσιπάκια των 44 θα ζητούσαν κελί 190 — δηλαδή έναν μήνα έξι οθονών.
  // Η λύση είναι η ίδια που έχει κάθε ημερολόγιο κινητού: με δάχτυλο το
  // ΚΕΛΙ είναι ο στόχος και ανοίγει το φύλλο της ημέρας, όπου τα γεγονότα
  // κάθονται σε γραμμές πλήρους ύψους. Με ποντίκι δεν αλλάζει τίποτα: το
  // τσιπάκι μένει πατήσιμο και συρόμενο, γιατί εκεί ο δείκτης είναι ακριβής.
  const coarse = useCoarsePointer()

  // ═══ ΤΡΙΑΝΤΑ ΤΕΣΣΕΡΙΣ ΣΤΑΣΕΙΣ TAB ΓΙΑ ΝΑ ΠΕΡΑΣΕΙΣ ΕΝΑΝ ΜΗΝΑ ═══════════════
  // ΜΕΤΡΗΜΕΝΟ ΣΤΑ 1280: η καρτέλα έχει 54 στάσεις πληκτρολογίου συνολικά και οι
  // 34 είναι ΜΕΣΑ στο πλέγμα — 30 ημέρες συν τα τσιπάκια. Οποιος δουλεύει με
  // πληκτρολόγιο και θέλει τη λίστα από κάτω πατά Tab τριάντα τέσσερις φορές,
  // ακούγοντας «κουμπί, 1 Σεπτεμβρίου… κουμπί, 2 Σεπτεμβρίου…».
  //
  // Το πρότυπο για πλέγμα ημερομηνιών λέει άλλο πράγμα: ΜΙΑ στάση για όλο το
  // πλέγμα · μέσα του κινείσαι με βελάκια. Είναι ο ίδιος τρόπος που έχει
  // κάθε ημερολόγιο — και ο τρόπος που ήδη περιμένει όποιος έχει ξαναδεί ένα.
  // Home και End πάνε στην αρχή και στο τέλος της εβδομάδας.
  //
  // Τα βελάκια ΔΕΝ βγαίνουν από τον μήνα: η μετακίνηση γίνεται μόνο αν υπάρχει
  // κελί για την ημερομηνία. Σιωπηλό πήδημα σε άλλον μήνα θα άλλαζε ό,τι
  // βλέπει η οθόνη χωρίς να το ζητήσει κανείς.
  const [focusKey, setFocusKey] = useState('')
  const p2 = (n: number) => String(n).padStart(2, '0')
  const shift = (from: string, days: number) => {
    const d = new Date(from + 'T00:00:00')
    d.setDate(d.getDate() + days)
    return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
  }
  // ΤΟ ΚΕΛΙ ΒΡΙΣΚΕΤΑΙ ΑΠΟ ΤΟ DOM, ΟΧΙ ΑΠΟ ΜΗΤΡΩΟ REF. Ενα `ref` που γεμίζει
  // μέσα στο δέντρο απόδοσης είναι πρόσβαση σε ref την ώρα του render — ο
  // κανόνας `react-hooks/refs` το κόβει — σωστά. Η ημερομηνία υπάρχει ήδη
  // πάνω στο κελί ως `data-drop-date` (τη βάζει η μεταφορά γεγονότος) και είναι
  // μοναδική στη σελίδα· η αναζήτηση τρέχει ΜΟΝΟ μέσα σε χειριστή πλήκτρου,
  // όπου το DOM είναι ήδη ζωγραφισμένο.
  const moveTo = (next: string) => {
    const el = document.querySelector<HTMLElement>(`[data-drop-date="${next}"]`)
    if (!el) return
    setFocusKey(next)
    el.focus()
  }
  const gridKeys = (e: React.KeyboardEvent, dateStr: string) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key]
    if (step != null) { e.preventDefault(); moveTo(shift(dateStr, step)); return }
    // Δευτέρα πρώτη, όπως και το πλέγμα: 0 η Δευτέρα, 6 η Κυριακή.
    const wd = (new Date(dateStr + 'T00:00:00').getDay() + 6) % 7
    if (e.key === 'Home') { e.preventDefault(); moveTo(shift(dateStr, -wd)) }
    else if (e.key === 'End') { e.preventDefault(); moveTo(shift(dateStr, 6 - wd)) }
  }

  // Το πλάτος του πλέγματος, μετρημένο. Χρειάζεται για να κριθεί αν το όνομα
  // της αργίας χωράει σε μία γραμμή. Μηδέν στην πρώτη απόδοση και στον
  // διακομιστή: τότε κρατιέται μία γραμμή και η δεύτερη μπαίνει μόλις γίνει η
  // μέτρηση, χωρίς να κοπεί ποτέ κείμενο στο ενδιάμεσο.
  const gridRef=useRef<HTMLDivElement|null>(null)
  const [gridW,setGridW]=useState(0)
  useEffect(()=>{
    const el=gridRef.current; if(!el) return
    // Ο παρατηρητής πυροδοτεί ΜΙΑ φορά μόλις ξεκινήσει, οπότε δεν χρειάζεται
    // δεύτερη μέτρηση εδώ. Μια κλήση `setGridW` κατευθείαν μέσα στο effect θα
    // ήταν και περιττή και δεύτερη απόδοση.
    const ro=new ResizeObserver(([e])=>setGridW(e.contentRect.width))
    ro.observe(el)
    return ()=>ro.disconnect()
  },[])

  const year=currentDate.getFullYear(); const month=currentDate.getMonth()
  // Η ΜΙΑ ΣΤΑΣΗ ΤΟΥ ΠΛΕΓΜΑΤΟΣ. Προτεραιότητα στην ημέρα που κρατά ήδη την
  // εστίαση· αλλιώς στην επιλεγμένη· αλλιώς στην πρώτη του μήνα. Ο έλεγχος
  // προθέματος κόβει τιμές από άλλον μήνα, ώστε η αλλαγή μήνα να μην αφήνει
  // το πλέγμα ΧΩΡΙΣ καμία εστιάσιμη ημέρα — που θα το έβγαζε τελείως από τη
  // σειρά του Tab.
  const monthPrefix=`${year}-${p2(month+1)}`
  const rovingKey=[focusKey, selectedDate].find(k=>k?.startsWith(monthPrefix)) ?? `${monthPrefix}-01`
  const firstDay=mondayFirst(new Date(year,month,1).getDay())
  const daysInMonth=new Date(year,month+1,0).getDate()
  const today=todayStr()
  const cells:(number|null)[] = []
  for(let i=0;i<firstDay;i++) cells.push(null)
  for(let i=1;i<=daysInMonth;i++) cells.push(i)
  while(cells.length%7!==0) cells.push(null)
  // Το πλέγμα δεν είναι πια σαράντα δύο αδερφά κελιά αλλά έξι γραμμές των επτά:
  // η μπάρα της κράτησης χρειάζεται ΓΡΑΜΜΗ για να τοποθετηθεί απόλυτα επάνω της.
  const weeks:(number|null)[][]=[]
  for(let i=0;i<cells.length;i+=7) weeks.push(cells.slice(i,i+7))
  // Οι κρατήσεις φαίνονται ως ενιαία μπάρα διαμονής — κρύβουμε τα booking: chips
  // ώστε να μη διπλογράφονται.
  const eventsForDay=(day:number)=>{ const ds=`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`; return events.filter(e=>e.event_date===ds&&!(e.source||'').startsWith('booking:')) }
  // Έπαιρνε τα ΕΠΤΑ ΠΡΩΤΑ εκκρεμή. Με δάνειο εικοσαετίας και τα επτά ήταν δόσεις
  // του ίδιου δανείου: η ράγα «Επόμενα» έγραφε επτά φορές «Δόση δανείου 751,00€»
  // και δεν έδειχνε ΠΟΤΕ τίποτε άλλο — ούτε λήξη μίσθωσης, ούτε φορολογική
  // προθεσμία. Τώρα μαζεύεται πρώτα η σειρά και μετά κρατιούνται επτά ΘΕΣΕΙΣ.
  const upcomingRows=groupSeries(
    upcomingAll.filter(e=>e.status==='pending'&&daysUntil(e.event_date)>=0)
               .sort((a,b)=>a.event_date.localeCompare(b.event_date))
  ).slice(0,7)
  const monthPendingAmt=events.filter(e=>e.status==='pending').reduce((s,e)=>s+(e.amount||0),0)
  const monthPaid=events.filter(e=>e.status==='paid')

  return (
    <div className="cal-layout" style={{ display:'flex', gap:12 }}>
      <div style={{ flex:1, minWidth:0 }}>
        <div className="cal-bleed" style={{ background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', borderRadius:T.radius.card, overflow:'hidden', boxShadow:'var(--shadow-sm)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:16, padding:'8px 16px', borderBottom:'1px solid var(--border-subtle)', background:'var(--bg-elevated)' }}>
            {/* ═══ ΕΠΤΑ ΚΟΥΚΚΙΔΕΣ ΣΤΟ ΙΔΙΟ ΓΚΡΙ ══════════════════════════════
                Ο υπόμνημα κατηγοριών έπιανε όλη τη δεξιά πλευρά της γραμμής:
                επτά τετραγωνάκια δίπλα σε επτά λέξεις. ΚΑΙ ΤΑ ΕΠΤΑ έχουν
                `color: var(--text-secondary)` — το ίδιο ακριβώς γκρι. Ένα
                υπόμνημα του οποίου όλα τα δείγματα είναι ίδια δεν ξεχωρίζει
                τίποτα: είναι διακόσμηση με το σχήμα της πληροφορίας και
                μάλιστα η μεγαλύτερη σε έκταση στην οθόνη. Η κατηγορία λέγεται
                με λέξεις πάνω σε κάθε γεγονός, εκεί που χρειάζεται.

                Και «1 γεγονότα». Ο πληθυντικός ήταν σταθερός. */}
            {/* ΤΟ «0 ΓΕΓΟΝΟΤΑ» ΠΑΝΩ ΑΠΟ ΑΔΕΙΟ ΠΛΕΓΜΑ. Σε μήνα χωρίς τίποτα, η ίδια
                απουσία λεγόταν ΤΡΕΙΣ φορές: εδώ ως αριθμός, μετά με το κενό πλέγμα
                και από κάτω με ολόκληρη κενή κατάσταση. Ο ίδιος συλλογισμός που
                έβγαλε το «0 πληρωμένα» δίπλα του — η μέτρηση έχει νόημα όταν
                υπάρχει κάτι να μετρηθεί. */}
            {events.length>0&&<span style={{ fontSize:12, fontFamily: T.font.sans, color:'var(--text-secondary)', letterSpacing:'0.4px' }}>{events.length===1?'1 γεγονός':`${events.length} γεγονότα`}</span>}
            {monthPendingAmt>0&&<span title="Άθροισμα των εκκρεμών ποσών, μόνο αυτού του μήνα" style={{ fontSize:12, fontFamily: T.font.sans, fontVariantNumeric:'tabular-nums', color:'var(--accent)' }}>{fe(monthPendingAmt)} εκκρεμή</span>}
            {/* ΤΟ «0 ΠΛΗΡΩΜΕΝΑ» ΔΙΠΛΑ ΣΤΟ «0 ΓΕΓΟΝΟΤΑ» ΔΕΝ ΛΕΕΙ ΤΙΠΟΤΑ. Σε άδειο
                μήνα η γραμμή έγραφε δύο μηδενικά στη σειρά — δύο μετρήσεις για το
                ίδιο κενό. Ο αριθμός των πληρωμένων έχει νόημα μόνο όταν υπάρχει
                κάτι πληρωμένο· αλλιώς μιλά η κενή κατάσταση από κάτω. */}
            {monthPaid.length>0&&<span style={{ fontSize:12, fontFamily: T.font.sans, color:'var(--text-secondary)' }}>{monthPaid.length===1?'1 πληρωμένο':`${monthPaid.length} πληρωμένα`}</span>}
          </div>
          {/* ═══ ΤΟ ΠΛΕΓΜΑ ΕΙΝΑΙ ΠΛΕΓΜΑ, ΟΧΙ ΤΡΙΑΝΤΑ ΚΟΥΜΠΙΑ ΣΤΗ ΣΕΙΡΑ ═══════════
              Με μία μόνο στάση Tab, ο ρόλος πρέπει να το ΛΕΕΙ. Ενα `role="button"`
              που δεν δέχεται Tab είναι χειρότερο από πριν: ο αναγνώστης οθόνης
              ανακοινώνει κουμπί, ο χρήστης δεν φτάνει σε αυτό και τίποτα δεν του
              λέει ότι δουλεύουν τα βελάκια. Με `grid` / `row` / `gridcell` η
              πλοήγηση με βελάκια είναι η ΑΝΑΜΕΝΟΜΕΝΗ, όχι κρυφή — και οι
              κεφαλίδες των ημερών γίνονται επιτέλους κεφαλίδες στηλών, ώστε η
              «Τρίτη» να ακούγεται μαζί με την ημερομηνία. */}
          <div role="grid" aria-label={`${MONTHS_NOM[month]} ${year}`} aria-rowcount={weeks.length + 1} aria-colcount={7}>
          <div ref={gridRef} role="row" style={{ display:'grid', gridTemplateColumns:'repeat(7, minmax(0, 1fr))', borderBottom:'1px solid var(--border-subtle)' }}>
            {DAY_NAMES_GR.map(d=>(
              <div key={d} role="columnheader" style={{ padding:'8px 0', textAlign:'center', fontSize:12, fontFamily: T.font.sans, fontWeight:500, color:'var(--text-secondary)', letterSpacing:'0.5px', textTransform:'uppercase' }}>{d}</div>
            ))}
          </div>
          {weeks.map((week,wIdx)=>{
            const weekDates=week.map(day=>day?`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`:null)
            const { segments, lanes }=weekSegments(stays,weekDates)
            const weekHasHoliday=weekDates.some(d=>!!d&&!!holidayName(d))
            // Χωράει το μακρύτερο όνομα της εβδομάδας σε μία γραμμή; Το πλάτος
            // της στήλης είναι το πλάτος του πλέγματος διά εφτά, μείον το
            // εσωτερικό περιθώριο του κελιού από τις δύο πλευρές.
            const colInner=Math.max(0,(gridW/7)-CELL_PAD*2)
            // ═══ ΚΑΙ ΑΝ ΔΕΝ ΧΩΡΑΕΙ ΟΥΤΕ ΣΕ ΔΥΟ, ΔΕΝ ΓΡΑΦΕΤΑΙ ΚΑΘΟΛΟΥ ═══════════
            //
            // ΜΕΤΡΗΜΕΝΟ ΣΤΟΝ ΠΑΓΚΟ, ΣΤΑ 320 ΚΑΙ 360: η στήλη είναι 33
            // εικονοστοιχεία και το «Κοίμηση της Θεοτόκου» έσπαγε σε ΕΠΤΑ
            // σειρές. Με ψαλίδι στις δύο, ο χρήστης έβλεπε «Κοί» και «μησ»:
            // συλλαβές, όχι όνομα. Η αργία φαίνεται ήδη από τον τόνο του κελιού
            // και γράφεται ολόκληρη στο πλαίσιο της ημέρας από κάτω.
            //
            // ΚΑΙ Η ΜΕΤΡΗΣΗ ΓΙΝΟΤΑΝ ΜΕ ΛΑΘΟΣ ΓΡΑΜΜΑΤΟΣΕΙΡΑ. Ζητούσε πλάτος για
            // «600 10px», ενώ το κελί αποδίδει 11: κάθε όνομα υπολογιζόταν
            // περίπου δέκα τοις εκατό στενότερο απ' ό,τι είναι, δηλαδή η
            // απόφαση «μία ή δύο γραμμές» έπαιρνε στενά μηνύματα για φαρδιά.
            const holFont='600 11px '+T.font.sans
            const widestHol=weekDates.reduce((mx,d)=>{
              const n=d?holidayName(d):null
              return n?Math.max(mx,textWidth(n,holFont)):mx
            },0)
            const holLines=colInner>0?Math.ceil(widestHol/colInner):1
            const weekHolH=!weekHasHoliday||holLines>2?0:(holLines>1?HOL_H2:HOL_H)
            const shownLanes=Math.min(lanes,MAX_LANES)
            const railH=shownLanes*(BAR_H+BAR_GAP)
            return (
            <div key={wIdx} role="row" style={{ position:'relative', display:'grid', gridTemplateColumns:'repeat(7, minmax(0, 1fr))' }}>
            {week.map((day,col)=>{
              const idx=wIdx*7+col
              const dateStr=day?`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`:''
              const dayEvents=day?eventsForDay(day):[]
              const isToday=dateStr===today
              const isSelected=!!day&&!!selectedDate&&dateStr===selectedDate
              const hasOverdue=dayEvents.some(isOverdue)
              const dayAmt=dayEvents.filter(e=>e.amount&&e.status==='pending').reduce((s,e)=>s+(e.amount||0),0)
              const hol=day?holidayName(dateStr):null
              const wknd=day?isWeekend(dateStr):false
              // ═══ ΤΟ «ΣΗΜΕΡΑ» ΛΕΓΟΤΑΝ ΔΥΟ ΦΟΡΕΣ ═════════════════════════════
              // Ολόκληρο το κελί έπαιρνε `--accent-dim` ΚΑΙ ο αριθμός έπαιρνε
              // κύκλο με το ίδιο ακριβώς χρώμα. Δύο σήματα για ένα γεγονός και
              // το ένα από αυτά είναι ένα γεμάτο ορθογώνιο ενενήντα επί εκατόν
              // σαράντα εικονοστοιχείων: σε γραμμή που δεν έχει τίποτα άλλο, το
              // κελί διαβάζεται ως κουτί που κάθεται πάνω στο πλέγμα και η
              // διπλανή ημέρα μοιάζει να ξεφεύγει από αυτό.
              //
              // Το σήμερα είναι ΜΙΑ ημέρα, όχι μια περιοχή. Το λέει ο αριθμός
              // της, με γεμάτο κύκλο — όπως σε κάθε ημερολόγιο που δουλεύει.
              // Η επιλεγμένη ημέρα κρατά το δαχτυλίδι της: είναι άλλο πράγμα
              // (τι κοιτάς) και πρέπει να ξεχωρίζει από το σήμερα (τι μέρα είναι).
              const cellBg=isSelected?'color-mix(in srgb, var(--accent) 12%, transparent)':hol?'color-mix(in srgb, var(--accent) 5%, transparent)':wknd?'color-mix(in srgb, var(--text-tertiary) 5%, transparent)':'transparent'
              return (
                /* ΤΑ ΑΔΕΙΑ ΚΕΛΙΑ ΕΙΝΑΙ ΚΕΛΙΑ, ΟΧΙ ΚΟΥΜΠΙΑ. Κρατούν `gridcell`
                   ώστε η σειρά να έχει και τις εφτά στήλες της — αλλιώς το
                   `aria-colcount` λέει εφτά και ο αναγνώστης βρίσκει τέσσερις.
                   Χωρίς tabIndex και χωρίς ενέργεια. Ο μήνας ξεκινά και τελειώνει
                   στη μέση της εβδομάδας, οπότε το πλέγμα έχει ως έντεκα κελιά
                   χωρίς ημέρα. Επαιρναν κι αυτά `role="button"` και `tabIndex`:
                   μετρημένο στο δέντρο προσβασιμότητας του Chrome, έντεκα
                   ανώνυμα κουμπιά που ο χρήστης του πληκτρολογίου διέσχιζε ένα
                   ένα πριν φτάσει στην πρώτη πραγματική ημέρα, ακούγοντας
                   «κουμπί» χωρίς τίποτε άλλο. Το `onDayClick` είχε ήδη φρένο
                   (`day&&`), δηλαδή το πάτημα δεν έκανε ποτέ τίποτα. */
                <div key={idx} className="cal-cell"
                  {...(day!=null ? (()=>{ const pr = pressable(()=>{ if(coarse&&dayEvents.length) onDayOpen(dateStr); else onDayClick(dateStr) }, `${day} ${monthGen(month)}${coarse&&dayEvents.length?`, ${dayEvents.length} ${dayEvents.length===1?'γεγονός':'γεγονότα'}`:''}`)
                    // Το `pressable` δίνει tabIndex 0 σε ΚΑΘΕ κελί. Εδώ μένει μία
                    // στάση για όλο το πλέγμα και τα υπόλοιπα κελιά βγαίνουν από
                    // τη σειρά του Tab χωρίς να χάσουν το Enter και το κενό.
                    return { ...pr, role: 'gridcell' as const, tabIndex: dateStr===rovingKey ? 0 : -1,
                      onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => { gridKeys(e, dateStr); if(!e.defaultPrevented) pr.onKeyDown(e) } }
                  })() : { role: 'gridcell' as const })} title={hol||undefined} data-drop-date={day?dateStr:undefined} style={{ minHeight:80, padding:'6px', borderRight:(idx+1)%7===0?'none':'1px solid var(--border-subtle)', borderBottom:idx<cells.length-7?'1px solid var(--border-subtle)':'none', background:cellBg, boxShadow:isSelected&&!isToday?'inset 0 0 0 2px var(--accent)':'none', cursor:day?'pointer':'default', transition:'background 0.1s' }}
                  onMouseEnter={e=>{if(day)(e.currentTarget as HTMLElement).style.background='var(--bg-hover)'}}
                  onMouseLeave={e=>{if(day)(e.currentTarget as HTMLElement).style.background=cellBg}}
                >
                  {day!=null&&(
                    <>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 4 }}>
                        <span aria-current={isToday?'date':undefined} style={{ fontSize: 'var(--fs-base)', fontFamily: T.font.sans, fontVariantNumeric:'tabular-nums', fontWeight:isToday||isSelected?700:400, color:isToday?'var(--accent-text)':isSelected?'var(--accent)':wknd||hol?'var(--text-tertiary)':'var(--text-secondary)', width:24, height:24, borderRadius:'50%', background:isToday?'var(--accent)':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{day}</span>
                        {hasOverdue&&<span style={{ width:6, height:6, borderRadius:'50%', background:'var(--negative)' }}/>}
                      </div>
                      {/* Η αργία, κολλητά στην ημερομηνία της. Ο χώρος κρατιέται
                          και στα κελιά χωρίς αργία, ώστε ο διάδρομος από κάτω να
                          ξεκινά στο ίδιο ύψος σε όλη την εβδομάδα. */}
                      {weekHasHoliday&&weekHolH>0&&(
                        <div title={hol||undefined} style={{ height:weekHolH, fontSize: 'var(--fs-xs)', lineHeight:'14px', color:'var(--accent)', fontWeight:600, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', textWrap:'balance', wordBreak:'break-word', fontFamily: T.font.sans }}>{hol||''}</div>
                      )}
                      {/* Ο ΔΙΑΔΡΟΜΟΣ ΤΩΝ ΚΡΑΤΗΣΕΩΝ. Το κελί δεν ζωγραφίζει πια
                          κομμάτια μπάρας — κρατά μόνο το ύψος τους, ώστε ό,τι
                          έρχεται από κάτω να μη γράφεται επάνω τους. Οι μπάρες
                          ζωγραφίζονται ΜΙΑ φορά, πάνω από ολόκληρη την εβδομάδα. */}
                      {railH>0&&<div aria-hidden style={{ height:railH, marginBottom: 4 }}/>}
                      {(()=>{ const extra=staysOnDay(stays,dateStr).length-shownLanes; return extra>0
                        ? <div style={{ fontSize: 'var(--fs-xs)', color:'var(--text-tertiary)', fontFamily: T.font.sans, marginBottom:2 }}>+{extra} {extra===1?'κράτηση':'κρατήσεις'}</div>
                        : null })()}
                      <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                        {dayEvents.slice(0,3).map(ev=>(
                          <Tooltip key={ev.id} text={`${ev.title}${ev.event_time?` · ${ev.event_time}`:''}${ev.amount?` · ${fe(ev.amount)}` :''}${ev._virtual?'\n(επαναλαμβανόμενο)':''}${ev.notes?`\n${ev.notes}`:''}`}>
                            <div {...(coarse ? {} : { onPointerDown: !ev._virtual&&drag?drag.onDown(ev.id,ev.title):undefined, role:'button', tabIndex:0, 'aria-label':`Άνοιγμα: ${ev.title}`, onKeyDown:(e:React.KeyboardEvent)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();onEventClick(ev)}}, onClick:(e:React.MouseEvent)=>{e.stopPropagation();onEventClick(ev)} })} className="po-elide cal-chip" style={{ touchAction:'none', padding:'1px 4px', borderRadius: T.radius.xs, backgroundColor:CATEGORIES[ev.category].bg, color:CATEGORIES[ev.category].color, cursor:coarse?'inherit':ev._virtual?'pointer':'grab', width:'100%', opacity:ev.status==='paid'?0.4:ev._virtual?0.72:1, textDecoration:ev.status==='paid'?'line-through':'none', fontFamily: T.font.sans, letterSpacing:'0.25px' }}>
                              {(ev.recurring||ev._virtual)&&<RotateCcw size={9} style={{ marginRight: 4, verticalAlign:'middle', opacity:0.7 }}/>}{ev.event_time?ev.event_time+' ':''}{ev.title}
                            </div>
                          </Tooltip>
                        ))}
                        {dayEvents.length>3&&<span style={{ fontSize: 'var(--fs-xs)', color:'var(--text-tertiary)', paddingLeft: 4, fontFamily: T.font.sans }}>+{dayEvents.length-3} ακόμη</span>}
                      </div>
                      {/* ══ ΤΟ ΠΟΣΟ ΤΗΣ ΗΜΕΡΑΣ ΓΡΑΦΟΤΑΝ ΠΑΝΩ ΣΤΗΝ ΕΠΟΜΕΝΗ ══
                          Μετρημένο σε 360: το κελί δίνει 36,28 εικονοστοιχεία
                          ωφέλιμα και το «751,00€» θέλει 44,47 — κάθε ενοίκιο,
                          δόση, λογαριασμός και ΕΝΦΙΑ έβγαινε από το κελί του.
                          Οταν είχαν ποσό δύο διαδοχικές ημέρες, τα ψηφία
                          επικαλύπτονταν και τα δύο ποσά διαβάζονταν ως ένας
                          ανύπαρκτος αριθμός· την Κυριακή το ποσό ψαλιδιζόταν
                          από το overflow της κάρτας χωρίς κανένα σημάδι.

                          Ιδιο ιδίωμα με το κελί του ημερολογίου τιμών: ακέραια
                          ευρώ εδώ, πλήρες ποσό στην ημέρα που ανοίγει με το
                          πάτημα. Το μέγεθος βγαίνει από το μήκος και το
                          δοχείο κόβει ως έσχατο δίχτυ ώστε τίποτα να μη
                          μπορεί ποτέ να πέσει στο διπλανό κελί. */}
                      {/* ═══ Η ΣΜΙΚΡΥΝΣΗ ΕΦΥΓΕ, ΤΟ ΔΟΧΕΙΟ ΜΕΝΕΙ ΤΟ ΔΙΧΤΥ ═══════════
                          Το μέγεθος έβγαινε από το ΜΗΚΟΣ του ποσού: 10 και 8 για
                          τρία ψηφία, 9 και 7 για πέντε, 8 και 7 για περισσότερα.
                          Δηλαδή όσο μεγαλύτερο το ποσό, τόσο πιο δυσανάγνωστο —
                          και το «€» έπεφτε στα ΕΠΤΑ, κάτω από το δάπεδο των 11.
                          Η σάρωση το βρήκε σε δώδεκα οθόνες.

                          Ο κανόνας του έργου το λέει ήδη για τα μεγέθη: όταν ένα
                          κείμενο δεν χωρά, απαντά η διάταξη, όχι η σμίκρυνση. Το
                          δοχείο κόβει ήδη με αποσιωπητικά και η ημέρα ανοίγει με
                          πάτημα δείχνοντας το πλήρες ποσό, οπότε το δίχτυ
                          υπάρχει. Ενα μέγεθος, το ελάχιστο επιτρεπτό. */}
                      {dayAmt>0&&(
                        <div className="cal-day-amt po-elide" style={{ marginTop:2 }}>
                          {/* ΔΥΟ ΘΑΜΠΑΔΕΣ ΠΟΥ ΠΟΛΛΑΠΛΑΣΙΑΖΟΝΤΑΝ. Το ποσό έγραφε
                              `opacity: 0.8` και το ευρώ από μέσα του άλλο 0,82:
                              το σύμβολο έβγαινε στο 0,656 του χρώματός του.
                              Μετρημένο στο φωτεινό θέμα, 3,92:1 ο αριθμός και
                              4,07:1 το ευρώ, με όριο 4,5. Είναι ΠΟΣΟ — το μόνο
                              νούμερο του κελιού — και δεν διαβαζόταν. Το
                              `--accent` σκέτο δίνει 6,4:1 στο φωτεινό, χωρίς
                              καμία θαμπάδα να το μεταφράζει διαφορετικά σε κάθε
                              θέμα. */}
                          <span style={{ fontSize: 'var(--fs-xs)', fontFamily: T.font.sans, fontVariantNumeric:'tabular-nums', color:'var(--accent)' }}>
                            {fn(dayAmt)}<span style={{ marginLeft:1.5 }}>€</span>
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
            {/* ═══ ΟΙ ΜΠΑΡΕΣ, ΠΑΝΩ ΑΠΟ ΤΑ ΚΕΛΙΑ ═══════════════════════════
                Μία ανά κράτηση και ανά εβδομάδα, με το όνομα γραμμένο μία φορά
                μέσα σε ΟΛΟ το πλάτος της. Το `pointerEvents:'none'` στο στρώμα
                αφήνει το κλικ να περάσει στο κελί από κάτω· η ίδια η μπάρα το
                ξαναπιάνει, ώστε το tooltip να δουλεύει και το κλικ επάνω της να
                μην αλλάζει ημέρα. */}
            {shownLanes>0&&(
              <div aria-hidden={false} style={{ position:'absolute', left:0, right:0, top:CELL_PAD+DAY_HEAD_H+weekHolH, height:railH, pointerEvents:'none' }}>
                {segments.filter(g=>g.lane<MAX_LANES).map(g=>{
                  const cc=channelColor(g.stay.channel)
                  const L=g.openLeft?0:BAR_INSET, R=g.openRight?0:BAR_INSET
                  return (
                    <div key={g.stay.id} style={{ position:'absolute', top:g.lane*(BAR_H+BAR_GAP), left:`calc(${(g.startCol/7)*100}% + ${L}px)`, width:`calc(${(g.span/7)*100}% - ${L+R}px)`, height:BAR_H, pointerEvents:'auto' }}>
                      {/* ΤΟ ΑΓΝΩΣΤΟ ΓΡΑΦΕΤΑΙ ΩΣ ΑΓΝΩΣΤΟ. Οταν λείπει η αναχώρηση, το
                          `end` της μπάρας είναι γέμισμα και το «έως» θα έδειχνε την
                          ημέρα άφιξης· μαζί με το παλιό ταβάνι, η υπόδειξη έλεγε
                          «1 Αυγ έως 1 Αυγ · 1 νύχτα» για κράτηση που δεν ξέρουμε
                          πόσο κράτησε. Τώρα λέει τι λείπει και ποιος το συμπληρώνει. */}
                      <Tooltip fill text={g.nights === null
                        ? `${g.stay.guest} · ${cc.label}\nΑφιξη ${g.stay.start} · χωρίς καταχωρημένη αναχώρηση${g.stay.total?`\n${fe(g.stay.total)}`:''}`
                        : `${g.stay.guest} · ${cc.label}\n${g.stay.start} έως ${g.stay.end} · ${g.nights} ${g.nights===1?'νύχτα':'νύχτες'}${g.stay.total?`\n${fe(g.stay.total)}`:''}`}>
                        <div onClick={e=>e.stopPropagation()} style={{ width:'100%', height:BAR_H, boxSizing:'border-box', display:'flex', alignItems:'center', gap:4, padding:`0 ${g.openRight?4:8}px 0 ${g.openLeft?4:9}px`, background:cc.solid, color:'var(--on-tone)', fontSize: 'var(--fs-xs)', fontWeight:600, fontFamily: T.font.sans, letterSpacing:'0.1px', borderTopLeftRadius:g.openLeft?2:BAR_H/2, borderBottomLeftRadius:g.openLeft?2:BAR_H/2, borderTopRightRadius:g.openRight?2:BAR_H/2, borderBottomRightRadius:g.openRight?2:BAR_H/2, overflow:'hidden', whiteSpace:'nowrap', cursor:'default' }}>
                          {!g.openLeft&&<User size={10} style={{ flexShrink:0, opacity:0.9 }}/>}
                          <span style={{ minWidth:0, overflow:'hidden', textOverflow:'ellipsis' }}>{g.stay.guest}{!g.openLeft&&g.nights!==null&&g.nights>1?` · ${g.nights} ν.`:''}</span>
                        </div>
                      </Tooltip>
                    </div>
                  )
                })}
              </div>
            )}
            </div>
            )
          })}
          </div>
        </div>
      </div>
      {/* ═══ ΚΑΜΙΑ ΛΩΡΙΔΑ ΓΙΑ ΤΟ ΤΙΠΟΤΑ ═══════════════════════════════════════
          Η ράγα τύπωνε «Καμία εκκρεμότητα» μέσα σε κάρτα με περίγραμμα και σκιά,
          δηλαδή ολόκληρη κάρτα για να πει ότι δεν έχει τίποτα. Σε ταμπλέτα και
          κινητό (globals.css: .cal-rail γίνεται 100% κάτω από τα 768) αυτό
          κατέβαινε ΚΑΤΩ από το πλέγμα σε πλήρες πλάτος, οπότε ο χρήστης κυλούσε
          και διάβαζε δύο μπλοκ στη σειρά που και τα δύο έλεγαν «άδειο».

          ΦΕΥΓΕΙ Ο ΠΕΡΙΕΚΤΗΣ, ΟΧΙ ΜΟΝΟ Η ΚΑΡΤΑ. Το `width:200` με `flexShrink:0`
          θα άφηνε κενή λωρίδα 212 εικονοστοιχείων δίπλα στο πλέγμα σε επιτραπέζιο,
          δηλαδή θα αντικαθιστούσε ένα ορατό κενό με ένα αόρατο. */}
      {upcomingRows.length>0&&(
      <div className="cal-rail" style={{ width:200, flexShrink:0, display:'flex', flexDirection:'column', gap:10 }}>
        {/* Εδώ ζούσε ΤΡΙΤΗ εκδοχή του ίδιου υπομνήματος: κάρτα με τον μήνα
            ως τίτλο και μία σειρά ανά κατηγορία με το πλήθος της. Με ένα
            γεγονός στον μήνα, έγραφε «Αύγουστος / Οικονομικά 1» — δηλαδή
            κατέλαβε μια ολόκληρη κάρτα για να πει «ένα», τη στιγμή που η
            γραμμή σύνοψης το έλεγε ήδη και το ίδιο το γεγονός φαινόταν από
            κάτω. */}
        <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', borderRadius:T.radius.card, padding:12, boxShadow:'var(--shadow-sm)' }}>
          {/* «ΑΠΟ ΣΗΜΕΡΑ», ΓΙΑΤΙ Η ΡΑΓΑ ΔΕΝ ΑΚΟΛΟΥΘΕΙ ΤΟΝ ΕΠΙΛΟΓΕΑ ΜΗΝΑ. Το πλέγμα
              δίπλα της αλλάζει μήνα με τα βελάκια· η ράγα μετρά πάντα από
              σήμερα και δεν κουνιέται. Δύο μονάδες χρόνου κολλητά, με τον
              επιλογέα να κυβερνά μόνο τη μία: αυτό λέγεται, δεν μαντεύεται. */}
          <p style={{ fontSize:12, fontFamily: T.font.sans, fontWeight:500, color:'var(--accent)', letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:10 }}>Επόμενα από σήμερα</p>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {upcomingRows.map(row=>{
              const ev=row.kind==='series'?row.lead:row.event
              const d=daysUntil(ev.event_date); const cat=CATEGORIES[ev.category]
              const when=d===0?'Σήμερα':d===1?'Αύριο':`σε ${d} ημέρες`
              const soon=d<=1
              const more=row.kind==='series'?row.count-1:0
              return (
                <div key={row.kind==='series'?row.key:ev.id} title={`${ev.title}${ev.event_time?`, ${ev.event_time}`:''} ${when}`} style={{ display:'flex', gap: 8, alignItems:'flex-start' }}>
                  <div style={{ width:3, borderRadius:3, background:cat.color, alignSelf:'stretch', flexShrink:0, minHeight:30, opacity:0.85 }}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize: 'var(--fs-base)', fontFamily: T.font.sans, color:'var(--text-primary)', lineHeight:1.35, marginBottom: 4, letterSpacing:'0.1px' }}>{ev.title}</p>
                    <div style={{ display:'flex', gap:8, alignItems:'baseline', flexWrap:'wrap' }}>
                      <span style={{ fontSize:12, fontFamily: T.font.sans, fontWeight:soon?600:400, color:soon?'var(--text-primary)':'var(--text-tertiary)' }}>{when}</span>
                      {ev.amount!=null&&<span style={{ fontSize:12, fontFamily: T.font.sans, fontVariantNumeric:'tabular-nums', color:'var(--text-secondary)' }}>{fe(ev.amount)}</span>}
                    </div>
                    {more>0&&<p style={{ fontSize: 'var(--fs-xs)', fontFamily: T.font.sans, color:'var(--text-tertiary)', margin:'3px 0 0' }}>{[row.kind==='series'?row.cadence:null, more===1?'άλλη 1 φορά':`άλλες ${more} φορές`].filter(Boolean).join(' · ')}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      )}
    </div>
  )
}
