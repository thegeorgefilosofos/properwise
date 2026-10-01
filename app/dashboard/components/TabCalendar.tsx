'use client'
import { navLabel } from '@/lib/nav/labels';
import { useState, useEffect, useRef, useMemo, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { deviceNotifyOn, NOTIFY_EVENT } from '@/lib/push/client'
import { createClient } from '@/lib/supabase/client'
import * as stayStore from '@/lib/data/stays';
import * as expenses from '@/lib/data/expenses'
// Ο πίνακας των γεγονότων έχει ένα σπίτι: lib/data/calendar.
import * as calendar from '@/lib/data/calendar'
import * as feedStore from '@/lib/data/calendarFeed'
import type { ClientStaysRow } from '@/lib/supabase/tables'
// Οι μπάρες διαμονής της προβολής Μήνα ζητούν ΛΙΓΟΤΕΡΕΣ στήλες από τον συγχρονισμό
// κρατήσεων (χωρίς nights/guests). Δηλώνονται ξεχωριστά, ακριβώς όσες λέει το
// select(), ώστε στήλη που δεν ζητήθηκε να μη διαβάζεται κατά λάθος ως υπαρκτή.
//
// ΤΟ `clients(full_name)` ΜΕΝΕΙ `unknown` ΚΑΙ ΟΧΙ ΑΠΟ ΤΕΜΠΕΛΙΑ. Το σχήμα του
// συνδεδεμένου πίνακα δεν είναι στήλη: το `client_stays.client_id` δείχνει σε ΕΝΑΝ
// πελάτη, άρα το PostgREST επιστρέφει αντικείμενο — αλλά ο τύπος που συμπεραίνει το
// postgrest-js χωρίς γεννημένους τύπους βάσης υποθέτει ΠΙΝΑΚΑ (`{full_name}[]`).
// Οι δύο διαφωνούν και κανείς δεν μπορεί να αποδειχθεί εδώ, οπότε το διαβάζουμε με
// φύλακα που δέχεται και τα δύο — αντί να δηλώσουμε τη μία εκδοχή και, αν είναι η
// λάθος, το `?.full_name` να δίνει σιωπηλά undefined σε ΚΑΘΕ κράτηση.
type StayBarRow = Pick<ClientStaysRow, 'id'|'check_in'|'check_out'|'total'|'channel'> & { clients?: unknown }
const joinedFullName = (v: unknown): string | null => {
  const one: unknown = Array.isArray(v) ? v[0] : v
  if (!one || typeof one !== 'object' || !('full_name' in one)) return null
  return typeof one.full_name === 'string' ? one.full_name : null
}
import { T, Btn, IconBtn, ChipToggle, LinkBtn, Skeleton, EmptyState, PageTitle, fe, localDay } from '@/components/Theme'
import type { XlsxSheet, XlsxCol } from './exportXlsx';
import { downloadXlsx } from './sheets';
import {
  AlertTriangle, Plus, X, ChevronLeft, ChevronRight,
  Calendar, List, FileText,
  Shield, Filter, Download,
  ChevronDown, RotateCcw,
  RefreshCw,
  Printer, CheckSquare, CalendarDays, ArrowRight,
  MoreHorizontal, CalendarPlus, Search,
} from 'lucide-react'
import { DatePicker } from './UIComponents'
import { expandRecurring } from '@/lib/calendar/recurrence'
import { findConflicts } from '@/lib/calendar/availability'
import { parseICS } from '@/lib/calendar/icsImport'
import { dueReminders, notifyBody } from '@/lib/calendar/notify'
import { toStaySpan, type StaySpan } from '@/lib/calendar/stayBars'
import {
  taxKindOfEventSource,
  TAX_EVENT_CATEGORY,
} from '@/lib/tax/greekTaxCalendar'
import { notify, notifyOk, notifyError } from '@/components/Toast';
import { saved } from '@/components/dbWrite';
import { confirmDialog } from '@/components/confirmBus';
import { MONTHS_NOM } from '@/lib/core/months';
import { INK, INK_MUTED } from '@/lib/print/ink';
import { reportHead, reportHeader, reportDisclaimer, openReport, rEsc, rEur } from './reportPdf';
import { downloadFile } from '@/lib/core/download'
import { toggleIn } from '@/lib/core/toggleSet'
import {
  type EventCategory, type EventStatus, type ViewMode, type CalEvent,
  type FormState, CATEGORIES, STATUSES, canonicalCategory,
  EMPTY_FORM, fmt, fmtShort,
  athensNow, daysUntil, isOverdue, isThisWeek, isThisMonth, isExpiring, todayStr, addDaysStr,
} from './calendar/model'
import { EventCard, Section } from './calendar/EventCard'
import { usePointerDrag, DaySheet, MonthView } from './calendar/MonthView'
import { AutoPullPanel } from './calendar/AutoPullPanel'
import { EventModal, ScopeModal } from './calendar/EventModal'
import { SubscribeModal } from './calendar/SubscribeModal'

// Οποιος αλλάξει τον διακόπτη σε ΑΛΛΗ καρτέλα ή σε άλλη οθόνη, φτάνει εδώ.
function subscribeNotify(onChange: () => void): () => void {
  window.addEventListener(NOTIFY_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => { window.removeEventListener(NOTIFY_EVENT, onChange); window.removeEventListener('storage', onChange) }
}

export default function TabCalendar({ propertyId, userId, openTasks = 0, onOpenTasks }: {
  propertyId:string; userId:string;
  /** Πόσες εκκρεμότητες είναι ανοιχτές. Δείχνεται δίπλα στον σύνδεσμο, όχι ως σήμα. */
  openTasks?: number;
  /** Άνοιγμα των Εκκρεμοτήτων. Έφυγαν από την πλαϊνή μπάρα και ανοίγουν από εδώ. */
  onOpenTasks?: () => void;
}) {
  const supabase=createClient()
  const [events,setEvents]=useState<CalEvent[]>([])
  const [loading,setLoading]=useState(true)
  const [viewMode,setViewMode]=useState<ViewMode>('month')
  // Η ημέρα που άνοιξε με δάχτυλο από το πλέγμα· κενή με ποντίκι.
  const [sheetDate,setSheetDate]=useState<string>('')
  const [currentDate,setCurrentDate]=useState(athensNow())
  const [selectedDate,setSelectedDate]=useState<string>(todayStr())
  const [showModal,setShowModal]=useState(false)
  const [editingEvent,setEditingEvent]=useState<CalEvent|null>(null)
  const [editOccDate,setEditOccDate]=useState<string|null>(null)   // ημερομηνία της συγκεκριμένης εμφάνισης
  const [scopePrompt,setScopePrompt]=useState(false)                // επιλογή εμβέλειας επεξεργασίας
  const [deleteScope,setDeleteScope]=useState<{seriesId:string;occ:string}|null>(null)
  const [form,setForm]=useState<FormState>(EMPTY_FORM)
  const [saving,setSaving]=useState(false)
  const [filterCat,setFilterCat]=useState<EventCategory|'all'>('all')
  const [filterStatus,setFilterStatus]=useState<EventStatus|'all'>('all')
  const [dateFrom,setDateFrom]=useState('')
  const [dateTo,setDateTo]=useState('')
  const [showFilters,setShowFilters]=useState(false)
  const [showOverdue,setShowOverdue]=useState(false)
  const [showAutoPull,setShowAutoPull]=useState(false)
  const [searchQ,setSearchQ]=useState('')
  const [bulkMode,setBulkMode]=useState(false)
  const [selectedIds,setSelectedIds]=useState<Set<string>>(new Set())
  const [showMenu,setShowMenu]=useState(false)
  const [showSubscribe,setShowSubscribe]=useState(false)
  const [feedToken,setFeedToken]=useState<string|null>(null)
  const menuRef=useRef<HTMLDivElement>(null)
  const menuBtnRef=useRef<HTMLButtonElement>(null)
  const menuPopRef=useRef<HTMLDivElement>(null)
  const [menuCoords,setMenuCoords]=useState<{top:number;left:number;up:boolean}>({top:0,left:0,up:false})
  // Θέση του μενού «⋯»: portal + fixed, δεξιά-στοιχισμένο στο κουμπί αλλά πάντα
  // πλήρως ορατό (clamp στα άκρα της οθόνης), προς τα κάτω· πάνω μόνο αν δεν χωράει.
  const positionMenu=()=>{ const el=menuBtnRef.current; if(!el)return; const r=el.getBoundingClientRect(); const W=248, PANEL_H=392, M=8; const below=window.innerHeight-r.bottom-M; const up=below<PANEL_H && r.top-M>below; const left=Math.max(M,Math.min(r.right-W,window.innerWidth-W-M)); setMenuCoords({top:up?r.top-6:r.bottom+6,left,up}) }
  const importRef=useRef<HTMLInputElement>(null)
  // Ο ΔΙΑΚΟΠΤΗΣ ΕΙΝΑΙ ΤΟΥ ΠΕΡΙΗΓΗΤΗ, ΟΧΙ ΤΗΣ REACT. Ηταν `useState(false)` και
  // `if(deviceNotifyOn())setNotifyOn(true)` μέσα στο effect που στήνει τον
  // ακροατή: σύγχρονη γραφή κατάστασης, δηλαδή δεύτερη απόδοση σε κάθε φόρτωση
  // του ημερολογίου. Το `useSyncExternalStore` δίνει ΞΕΧΩΡΙΣΤΗ απάντηση στον
  // διακομιστή («όχι», γιατί εκεί δεν υπάρχουν ειδοποιήσεις), οπότε δεν υπάρχει
  // ούτε ασυμφωνία ενυδάτωσης ούτε δεύτερη απόδοση.
  const notifyOn = useSyncExternalStore(subscribeNotify, deviceNotifyOn, () => false)
  const [stays,setStays]=useState<StaySpan[]>([])
  const notifiedRef=useRef<Set<string>>(new Set())
  // Ενιαίο drag (ποντίκι + αφή) — μετακίνηση γεγονότος με σύρσιμο στο πλέγμα του μήνα.
  const drag=usePointerDrag((id,date,time)=>moveEvent(id,date,time))
  // Εισαγωγή γεγονότων από αρχείο .ics (Google/Apple/Outlook export).
  async function importIcs(file:File){
    setShowMenu(false)
    try{
      const text=await file.text()
      const evs=parseICS(text)
      if(!evs.length){ notify('Δεν βρέθηκαν γεγονότα στο αρχείο.',{tone:'warning'}); return }
      const rows=evs.map(ev=>calendar.row({propertyId,userId},'import',{title:ev.title,category:'reminder',event_date:ev.date,event_time:ev.time,duration_minutes:ev.durationMinutes,notes:ev.notes}))
      // ΤΟ «ΕΙΣΗΧΘΗΣΑΝ N ΓΕΓΟΝΟΤΑ» ΛΕΓΟΤΑΝ ΚΑΙ ΟΤΑΝ ΔΕΝ ΕΙΣΗΧΘΗ ΚΑΝΕΝΑ. Η
      // απάντηση του γραψίματος πεταγόταν, οπότε ο χρήστης έβλεπε κόκκινο «Τα
      // γεγονότα δεν εισήχθησαν» και από πάνω πράσινο με νούμερο. Πιστεύει το
      // νούμερο: είναι συγκεκριμένο.
      if(!await saved('Τα γεγονότα δεν εισήχθησαν', calendar.insert(supabase,rows))) return
      await load()
      notifyOk(`Εισήχθησαν ${rows.length} γεγονότα.`)
    }catch{ notifyError('Το αρχείο δεν διαβάστηκε.') }
  }
  // Η ΓΡΑΜΜΗ ΓΕΝΝΙΕΤΑΙ ΠΛΕΟΝ ΜΕ ΤΟΝ ΛΟΓΑΡΙΑΣΜΟ (20260821160000), ΟΠΟΤΕ ΕΔΩ
  // ΜΕΝΕΙ ΜΟΝΟ ΑΝΑΓΝΩΣΗ. Πριν, το κουπόνι δημιουργούνταν ΤΕΜΠΕΛΙΚΑ την πρώτη
  // φορά που άνοιγε αυτό το παράθυρο: όποιος δεν περνούσε από εδώ δεν είχε
  // διεύθυνση ημερολογίου και οι Ρυθμίσεις δεν είχαν τι να του δείξουν.
  async function openSubscribe(){
    setShowMenu(false)
    if(!feedToken){
      const { row } = await feedStore.feed(supabase, userId)
      setFeedToken(row?.token || null)
    }
    setShowSubscribe(true)
  }
  useEffect(()=>{ if(!showMenu)return; positionMenu(); const h=(ev:MouseEvent)=>{ const t=ev.target as Node; if((menuRef.current?.contains(t))||(menuPopRef.current?.contains(t)))return; setShowMenu(false) }; const rp=()=>positionMenu(); document.addEventListener('mousedown',h); window.addEventListener('scroll',rp,true); window.addEventListener('resize',rp); return ()=>{document.removeEventListener('mousedown',h); window.removeEventListener('scroll',rp,true); window.removeEventListener('resize',rp)} },[showMenu])

  // ΟΙ ΕΙΔΟΠΟΙΗΣΕΙΣ ΣΥΣΚΕΥΗΣ ΕΧΟΥΝ ΕΝΑΝ ΔΙΑΚΟΠΤΗ ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΕΔΩ. Ζει στις
  // Ρυθμίσεις → Ειδοποιήσεις (DeviceNotifications.tsx) και ανάβει ΚΑΙ την πρωινή
  // ειδοποίηση με την εφαρμογή κλειστή ΚΑΙ αυτή εδώ την τοπική, ~10' πριν από
  // κάθε ραντεβού, όσο η εφαρμογή είναι ανοιχτή. Το ημερολόγιο ΑΚΟΥΕΙ: όποιος
  // αλλάξει τον διακόπτη σε άλλη καρτέλα δεν χρειάζεται να ανανεώσει σελίδα.
  useEffect(()=>{
    if(!notifyOn||typeof Notification==='undefined')return
    const tick=()=>{
      if(Notification.permission!=='granted')return
      const due=dueReminders(events.filter(e=>!e._virtual),athensNow(),10,notifiedRef.current)
      for(const e of due){
        notifiedRef.current.add(e.id)
        try{ new Notification(e.title,{ body:notifyBody(e,athensNow()), tag:`cal_${e.id}` }) }catch{}
      }
    }
    tick()
    const iv=setInterval(tick,60000)
    return ()=>clearInterval(iv)
  },[notifyOn,events])
  useEffect(()=>{
    load()
    // Ζωντανό: κάθε αλλαγή στα γεγονότα (π.χ. συμφωνία πληρωμής, sync υποχρεώσεων
    // από άλλα tabs) ενημερώνει αμέσως το ημερολόγιο, χωρίς refresh.
    const ch=supabase.channel(`calendar_${propertyId}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'calendar_events',filter:`property_id=eq.${propertyId}`},()=>silentReload())
      .subscribe()
    return ()=>{ supabase.removeChannel(ch) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[propertyId])

  // Κάθε γεγονός περνά από ΜΙΑ κανονικοποίηση κατηγορίας: άλλες καρτέλες γράφουν
  // τιμές που το ημερολόγιο δεν γνώριζε ('rent_due', 'insurance_renewal', …) και
  // έσπαγαν την απόδοση. Μεταφράζονται εδώ, μία φορά, για όλες τις χρήσεις.
  // ΟΤΑΝ ΞΕΡΟΥΜΕ ΟΤΙ ΕΙΝΑΙ ΦΟΡΟΛΟΓΙΚΗ ΠΡΟΘΕΣΜΙΑ, ΤΟ ΛΕΜΕ. Παλιές εγγραφές
  // συγχρονισμού έχουν αποθηκευμένη κατηγορία «contract», οπότε το «Ε9, δήλωση
  // μεταβολών ακινήτων» και ο ΕΝΦΙΑ εμφανίζονταν ως «Συμβόλαιο» — ενώ η ίδια
  // κάρτα από δίπλα έδειχνε στοιχεία ΑΑΔΕ. Η πηγή του γεγονότος τα αναγνωρίζει
  // με βεβαιότητα (γι' αυτό εμφανίζονται τα στοιχεία), άρα η κατηγορία
  // διορθώνεται στην ανάγνωση και για τα παλιά δεδομένα, μία φορά, εδώ.
  const normalize=(rows:CalEvent[]|null)=>(rows||[]).map(e=>({
    ...e,
    category: taxKindOfEventSource(e.source) ? TAX_EVENT_CATEGORY : canonicalCategory(e.category),
  }))
  async function load() {
    setLoading(true)
    setEvents(normalize(await calendar.all(supabase,propertyId) as CalEvent[])); setLoading(false)
    loadStays()
  }
  // Επαναφόρτωση χωρίς spinner (για live ενημερώσεις)
  async function silentReload() {
    setEvents(normalize(await calendar.all(supabase,propertyId) as CalEvent[]))
  }
  // Κρατήσεις βραχυχρόνιας (client_stays) → μπάρες διαμονής στην προβολή Μήνα.
  async function loadStays() {
    const data=await stayStore.withClientName<StayBarRow>(supabase,propertyId,'id,check_in,check_out,total,channel',userId)
    // ΤΟ check_in ΤΩΝ ΚΡΑΤΗΣΕΩΝ ΔΕΧΕΤΑΙ NULL. Το `(s:any)` το έκρυβε: η κράτηση χωρίς
    // άφιξη έμπαινε ολόκληρη στο `toStaySpan`, όπου το `regex.test(null)` δοκίμαζε τη
    // λέξη "null" και γύριζε null — σωστό αποτέλεσμα, αλλά κατά τύχη. Ο συγχρονισμός
    // κρατήσεων παραπάνω κόβει ήδη ρητά τις ίδιες γραμμές· εδώ γίνεται το ίδιο.
    const rows:StayBarRow[]=data??[]
    const spans=rows
      .filter((s):s is StayBarRow&{check_in:string}=>!!s.check_in)
      .map(s=>toStaySpan({id:s.id,check_in:s.check_in,check_out:s.check_out,total:s.total,channel:s.channel,guest_name:joinedFullName(s.clients)}))
      .filter((s):s is StaySpan=>s!==null)
    setStays(spans)
  }

  const filtered=useMemo(()=>events.filter(e=>{
    // Οι κρατήσεις εμφανίζονται ΜΟΝΟ ως ενιαία μπάρα διαμονής (από τα ζωντανά
    // client_stays) — κρύβουμε παντού τα booking:* events ώστε να μη διπλοφαίνονται
    // σε λίστες/ατζέντα/ημέρα/αναζήτηση. (Παραμένουν στη βάση για feed/υπενθυμίσεις.)
    if((e.source||'').startsWith('booking:'))return false
    if(filterCat!=='all'&&e.category!==filterCat)return false
    if(filterStatus!=='all'&&e.status!==filterStatus)return false
    if(dateFrom&&e.event_date<dateFrom)return false
    if(dateTo&&e.event_date>dateTo)return false
    if(searchQ){
      // Αναζήτηση σε τίτλο, σημειώσεις, ποσό και κατηγορία (όχι μόνο τίτλο).
      const q=searchQ.toLowerCase()
      const hay=[e.title,e.notes||'',e.amount!=null?String(e.amount):'',CATEGORIES[e.category]?.label||e.category].join(' ').toLowerCase()
      if(!hay.includes(q))return false
    }
    return true
  }),[events,filterCat,filterStatus,searchQ,dateFrom,dateTo])

  const overdue=filtered.filter(isOverdue)
  const thisWeek=filtered.filter(isThisWeek)
  const thisMonth=filtered.filter(isThisMonth)
  const expiring=filtered.filter(isExpiring)
  const later=filtered.filter(e=>{const d=daysUntil(e.event_date);return e.status==='pending'&&d>29})
  const done=filtered.filter(e=>e.status==='paid'||e.status==='cancelled')
  // Το εύρος της προβολής: ο μήνας, με επέκταση των επαναλαμβανόμενων ώστε να
  // φαίνονται σε ΟΛΕΣ τις εμφανίσεις τους.
  const monthEvents = useMemo(()=>{
    const p2=(n:number)=>String(n).padStart(2,'0')
    const _y=currentDate.getFullYear(), _mo=currentDate.getMonth()
    const monthStart=`${_y}-${p2(_mo+1)}-01`, monthEnd=`${_y}-${p2(_mo+1)}-${p2(new Date(_y,_mo+1,0).getDate())}`
    return expandRecurring(filtered, monthStart, monthEnd)
  },[filtered,currentDate])
  // Ζωντανός έλεγχος σύγκρουσης ώρας για τη φόρμα («έχεις ήδη κάτι τότε»).
  const formConflicts=useMemo(()=> (showModal&&form.event_time&&form.event_date)
    ? findConflicts({id:editingEvent?.id,date:form.event_date,time:form.event_time,durationMinutes:form.duration?parseInt(form.duration):60,status:form.status}, events.map(e=>({id:e.id,date:e.event_date,time:e.event_time,durationMinutes:e.duration_minutes,status:e.status}))).length
    : 0, [showModal,form.event_time,form.event_date,form.duration,form.status,editingEvent,events])

  // Το κλικ σε μέρα/ώρα ΜΟΝΟ επιλέγει (δεν ανοίγει φόρμα). Η φόρμα ανοίγει με «Νέο»,
  // προσυμπληρωμένη με την επιλεγμένη μέρα και (αν υπάρχει) την επιλεγμένη ώρα.
  function openNew(date?:string){setEditingEvent(null);setForm({...EMPTY_FORM,event_date:date||selectedDate||todayStr()});setShowModal(true)}
  function openEdit(ev:CalEvent){
    // Εικονική εμφάνιση επαναλαμβανόμενου → φόρτωσε τη ΣΕΙΡΑ (base) αλλά κράτα ποια μέρα άνοιξε.
    const e=ev._virtual&&ev._seriesId?(events.find(x=>x.id===ev._seriesId)||ev):ev
    setEditingEvent(e); setEditOccDate(ev.event_date)
    const endMode:FormState['recurrence_end_mode']=e.recurrence_until?'until':e.recurrence_count?'count':'none'
    setForm({title:e.title,category:e.category,event_date:e.event_date,event_time:e.event_time||'',duration:e.duration_minutes?String(e.duration_minutes):'',amount:e.amount?.toString()||'',priority:e.priority,status:e.status,recurring:e.recurring,recurring_interval:e.recurring_interval||'monthly',recurrence_end_mode:endMode,recurrence_until:e.recurrence_until||'',recurrence_count:e.recurrence_count?String(e.recurrence_count):'',notes:e.notes||'',attachment_url:e.attachment_url||'',phone:e.contact_phone||'',email:e.contact_email||'',add_expense:false});setShowModal(true)
  }
  function buildPayload():calendar.EventRow{
    return calendar.row({propertyId,userId},'manual',{title:form.title,category:form.category,event_date:form.event_date,event_time:form.event_time||null,duration_minutes:form.duration?parseInt(form.duration):null,amount:form.amount?parseFloat(form.amount):null,priority:form.priority,status:form.status,recurring:form.recurring,recurring_interval:form.recurring?form.recurring_interval:null,recurrence_until:form.recurring&&form.recurrence_end_mode==='until'&&form.recurrence_until?form.recurrence_until:null,recurrence_count:form.recurring&&form.recurrence_end_mode==='count'&&form.recurrence_count?parseInt(form.recurrence_count):null,notes:form.notes||null,attachment_url:form.attachment_url||null,contact_phone:form.phone||null,contact_email:form.email||null})
  }
  // Κύκλωμα: το κόστος ενός γεγονότος μπορεί να γίνει και εκκρεμής δαπάνη (προϋπολογισμός/δαπάνες).
  async function maybeCreateExpense(){
    const amt=parseFloat(form.amount)
    if(!form.add_expense||!(amt>0))return
    const catMap:Record<string,string>={maintenance:'Συντήρηση & Επισκευές',bills:'Λογαριασμοί',contract:'Ασφάλιση και Νομικά',financial:'Λοιπά έξοδα',tenant:'Λοιπά έξοδα',reminder:'Λοιπά έξοδα'}
    // ΤΟ `try{}catch{}` ΕΔΩ ΗΤΑΝ ΔΙΠΛΑ ΑΟΡΑΤΟ: ο Supabase δεν πετά, οπότε δεν
    // έπιανε τίποτα· και το κενό `catch` θα κατάπινε ό,τι έπιανε. Ο χρήστης
    // τσέκαρε ρητά «καταχώρησέ το και στις Δαπάνες» και δεν μάθαινε ποτέ αν έγινε.
    // Η ΟΜΑΔΑ ΠΑΡΑΓΟΤΑΝ ΑΠΟ ΤΗΝ ΚΑΤΗΓΟΡΙΑ ΤΟΥ ΓΕΓΟΝΟΤΟΣ, ΟΧΙ ΤΗΣ ΔΑΠΑΝΗΣ και
    // η τιμή 'general' δεν υπάρχει καν στην ταξινομία: ασφάλιστρο καταχωρημένο
    // από εδώ έπαυε να εκπίπτει. Την παράγει πλέον το στρώμα, από την κατηγορία.
    await saved('Η δαπάνη δεν καταχωρήθηκε στα έξοδα',
      expenses.insert(supabase,[expenses.row({propertyId,userId},{amount:amt,description:form.title,date:form.event_date,category:catMap[form.category]||'Λοιπά έξοδα',paid:form.status==='paid'})]))
  }
  // Μετακίνηση με σύρσιμο (drag): αλλάζει ημερομηνία (και ώρα σε προβολή ωρών). Οι
  // εικονικές εμφανίσεις σειράς ΔΕΝ σύρονται (θα άλλαζαν όλη τη σειρά αμφίσημα).
  async function moveEvent(id:string, newDate:string, newTime?:string|null){
    if(id.includes('__'))return
    const patch:{event_date:string;event_time?:string|null}={event_date:newDate}
    if(newTime!==undefined)patch.event_time=newTime
    setEvents(prev=>prev.map(e=>e.id===id?{...e,...patch}:e))
    // Αισιόδοξη μετακίνηση: η κάρτα πηγαίνει στη νέα ημέρα αμέσως. Αν η αποθήκευση
    // αποτύχει, ΠΡΕΠΕΙ να γυρίσει πίσω — αλλιώς ο χρήστης βλέπει το γεγονός στη
    // νέα θέση, κλείνει και το βρίσκει στην παλιά χωρίς να έχει καταλάβει γιατί.
    if(!await saved('Η μετακίνηση δεν αποθηκεύτηκε', calendar.update(supabase,id,patch))) await load()
  }
  async function saveEvent(){
    // ΕΝΑ ΓΕΓΟΝΟΣ ΑΝΑ ΠΑΤΗΜΑ, ΑΠΟ ΟΠΟΥ ΚΙ ΑΝ ΕΡΘΕΙ. Το κλείδωμα ζούσε μόνο στο
    // `disabled` του κουμπιού, οπότε η συντόμευση πληκτρολογίου το παρέκαμπτε.
    if(saving)return
    if(!form.title||!form.event_date)return
    // Επεξεργασία υπάρχουσας ΣΕΙΡΑΣ → ρώτα εμβέλεια (μόνο αυτό / επόμενα / όλα).
    if(editingEvent&&editingEvent.recurring){ setScopePrompt(true); return }
    setSaving(true)
    const payload=buildPayload()
    // Το παράθυρο ΔΕΝ κλείνει αν δεν αποθηκεύτηκε. Πριν, το σφάλμα του Supabase
    // αγνοούνταν (δεν πετάει, επιστρέφει { error }) και το modal έκλεινε σαν να
    // πέτυχε — ο χρήστης έχανε τίτλο, ημερομηνία, ώρα, ποσό, επανάληψη και
    // σημειώσεις, χωρίς να του πει κανείς τίποτα.
    const { error } = editingEvent
      ? await calendar.update(supabase,editingEvent.id,payload)
      : await calendar.insert(supabase,[payload])
    if(error){ notifyError('Το γεγονός δεν αποθηκεύτηκε. Δοκίμασε ξανά.'); setSaving(false); return }
    if(!editingEvent) await maybeCreateExpense()
    await load(); setShowModal(false); setSaving(false)
  }
  // Εφαρμογή εμβέλειας επεξεργασίας σε επαναλαμβανόμενο.
  async function applyEditScope(scope:'this'|'following'|'all'){
    if(!editingEvent)return; setSaving(true)
    const base=editingEvent; const occ=editOccDate||base.event_date; const payload=buildPayload()
    try{
      if(scope==='all'){
        await saved('Η σειρά δεν ενημερώθηκε', calendar.update(supabase,base.id,payload))
      }else if(scope==='this'){
        // Απόσπαση μόνο αυτής: νέο μεμονωμένο με τις αλλαγές + εξαίρεση της ημέρας από τη σειρά.
        // Η ΣΕΙΡΑ ΤΩΝ ΔΥΟ ΕΧΕΙ ΣΗΜΑΣΙΑ: αν μπει η εξαίρεση χωρίς να έχει
        // δημιουργηθεί το μεμονωμένο, η εμφάνιση εξαφανίζεται εντελώς.
        if(await saved('Η εξαίρεση της ημέρας δεν αποθηκεύτηκε', calendar.insert(supabase,[{...payload,event_date:occ,recurring:false,recurring_interval:null,recurrence_until:null,recurrence_count:null}]))){
          const ex=Array.from(new Set([...(base.recurrence_exdates||[]),occ]))
          await saved('Η ημέρα δεν αφαιρέθηκε από τη σειρά', calendar.update(supabase,base.id,{recurrence_exdates:ex}))
        }
      }else{
        // Αυτό και τα επόμενα: κόψε τη σειρά την προηγούμενη μέρα + νέα σειρά από την occ.
        if(await saved('Η σειρά δεν κόπηκε στη σωστή ημερομηνία', calendar.update(supabase,base.id,{recurrence_until:addDaysStr(occ,-1),recurrence_count:null}))){
          await saved('Η νέα σειρά δεν δημιουργήθηκε', calendar.insert(supabase,[{...payload,event_date:occ}]))
        }
      }
    }catch{}
    await load(); setScopePrompt(false); setShowModal(false); setEditOccDate(null); setSaving(false)
  }

  async function toggleStatus(e:CalEvent){
    // Ολοκλήρωση εικονικής εμφάνισης → απόσπασέ την ως «πληρωμένη» + εξαίρεσέ την από τη σειρά.
    if(e._virtual&&e._seriesId){
      const base=events.find(x=>x.id===e._seriesId); if(!base)return
      if(!await saved('Η ολοκλήρωση δεν αποθηκεύτηκε', calendar.insert(supabase,[calendar.row({propertyId:base.property_id,userId:base.user_id},base.source||'manual',{title:base.title,category:base.category,event_date:e.event_date,event_time:base.event_time||null,duration_minutes:base.duration_minutes||null,amount:base.amount??null,priority:base.priority,status:'paid',notes:base.notes||null,attachment_url:base.attachment_url||null})]))) return
      const ex=Array.from(new Set([...(base.recurrence_exdates||[]),e.event_date]))
      await saved('Η ημέρα δεν αφαιρέθηκε από τη σειρά', calendar.update(supabase,base.id,{recurrence_exdates:ex}))
      await load(); return
    }
    const ns:EventStatus=e.status==='paid'?'pending':'paid'
    if(!await saved('Η κατάσταση δεν αποθηκεύτηκε', calendar.update(supabase,e.id,{status:ns}))) return
    setEvents(prev=>prev.map(ev=>ev.id===e.id?{...ev,status:ns}:ev))
  }
  // Έγινε async επειδή ο διάλογος επιβεβαίωσης δεν παγώνει πια τη σελίδα όπως το
  // native confirm. Διπλό κλικ στην ίδια κάρτα ΔΕΝ διπλοδιαγράφει: ο δίαυλος
  // κρατά έναν μόνο διάλογο ανοιχτό και απαντά «όχι» σε κάθε δεύτερη ερώτηση.
  // Οι δύο έλεγχοι επανάληψης μένουν ΠΑΝΩ από το await, ώστε το επαναλαμβανόμενο
  // γεγονός να ανοίγει το δικό του παράθυρο εμβέλειας χωρίς καμία αναμονή.
  async function deleteEvent(id:string){
    if(id.includes('__')){ const i=id.indexOf('__'); setDeleteScope({seriesId:id.slice(0,i),occ:id.slice(i+2)}); return }
    const ev=events.find(e=>e.id===id)
    if(ev?.recurring){ setDeleteScope({seriesId:id,occ:ev.event_date}); return }
    if(!(await confirmDialog('Διαγραφή γεγονότος;',{tone:'negative',confirmLabel:'Διαγραφή'})))return
    // Ήταν `.then(()=>{})`: η διαγραφή ξεκινούσε και κανείς δεν περίμενε ούτε
    // κοιτούσε το αποτέλεσμα, ενώ η γραμμή έφευγε ήδη από την οθόνη.
    if(!await saved('Το γεγονός δεν διαγράφηκε', calendar.remove(supabase,id))) return
    setEvents(prev=>prev.filter(e=>e.id!==id))
  }
  async function applyDeleteScope(scope:'this'|'following'|'all'){
    if(!deleteScope)return; const {seriesId,occ}=deleteScope
    const base=events.find(e=>e.id===seriesId); if(!base){setDeleteScope(null);return}
    if(scope==='all'){await saved('Η σειρά δεν διαγράφηκε', calendar.remove(supabase,seriesId))}
    else if(scope==='this'){const ex=Array.from(new Set([...(base.recurrence_exdates||[]),occ]));await saved('Η ημέρα δεν αφαιρέθηκε από τη σειρά', calendar.update(supabase,seriesId,{recurrence_exdates:ex}))}
    else{await saved('Η σειρά δεν κόπηκε', calendar.update(supabase,seriesId,{recurrence_until:addDaysStr(occ,-1),recurrence_count:null}))}
    await load(); setDeleteScope(null)
  }

  function toggleSelect(id:string){setSelectedIds(prev=>{return toggleIn(prev, id)})}
  async function bulkMarkPaid(){
    if(!selectedIds.size)return
    await saved('Τα γεγονότα δεν σημειώθηκαν ως πληρωμένα', calendar.updateMany(supabase,[...selectedIds],{status:'paid'}))
    await load(); setSelectedIds(new Set()); setBulkMode(false)
  }
  async function bulkDelete(){
    // Ρητό στιγμιότυπο ΠΡΙΝ την ερώτηση: ο διάλογος δεν παγώνει πια τη σελίδα, άρα η
    // επιλογή μπορεί να αλλάξει όσο περιμένουμε απάντηση. Το πλήθος στο μήνυμα και
    // τα γεγονότα που σβήνουν προέρχονται πλέον από την ίδια, μία λίστα.
    const ids=[...selectedIds]
    if(!ids.length||!(await confirmDialog(ids.length===1?'Διαγραφή 1 γεγονότος;':`Διαγραφή ${ids.length} γεγονότων;`,{tone:'negative',confirmLabel:'Διαγραφή'})))return
    await saved('Τα γεγονότα δεν διαγράφηκαν', calendar.remove(supabase,ids))
    await load(); setSelectedIds(new Set()); setBulkMode(false)
  }

  // Escaping κατά RFC 5545 + αναδίπλωση γραμμών στους 75 χαρακτήρες.
  function icsEsc(s:string){ return String(s||'').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n') }
  function icsFold(line:string){ if(line.length<=75)return line; const out:string[]=[]; let s=line; while(s.length>75){ out.push(s.slice(0,75)); s=' '+s.slice(75) } out.push(s); return out.join('\r\n') }
  function exportICal(){
    const now=new Date(); const stamp=now.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')
    const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//PROPERWISE//Calendar 1.0//EL','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:PROPERWISE, Ημερολόγιο','X-WR-TIMEZONE:Europe/Athens']
    filtered.forEach(e=>{
      const d=e.event_date.replace(/-/g,''); const cat=CATEGORIES[e.category]
      const descParts=[e.notes||'', e.amount?`Ποσό: ${fe(e.amount)}`:''].filter(Boolean)
      lines.push('BEGIN:VEVENT',
        // ΤΟ ΕΠΙΘΕΜΑ ΤΟΥ UID ΕΙΝΑΙ ΑΝΑΓΝΩΡΙΣΤΙΚΟ, ΟΧΙ ΕΠΩΝΥΜΙΑ ΚΑΙ ΜΕΝΕΙ.
        // Το Google και το Apple ταυτίζουν τα γεγονότα του ημερολογίου με το
        // UID. Αν αλλάξει, κάθε ήδη κατεβασμένο γεγονός γίνεται ΞΕΝΟ: μένει ως
        // φάντασμα και δίπλα του εμφανίζεται διπλότυπο. Η μετονομασία δεν
        // επιτρέπεται να διπλασιάσει τις προθεσμίες κανενός.
        `UID:${e.id}@properwise`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${d}`,
        `DTEND;VALUE=DATE:${d}`,
        icsFold(`SUMMARY:${icsEsc((cat?`${cat.label}: `:'')+e.title)}`),
        descParts.length?icsFold(`DESCRIPTION:${icsEsc(descParts.join(', '))}`):'',
        `CATEGORIES:${icsEsc(cat?.label||'')}`,
        `STATUS:${e.status==='paid'?'CONFIRMED':'TENTATIVE'}`,
        `PRIORITY:${e.priority==='critical'||e.priority==='high'?1:e.priority==='medium'?5:9}`,
        'BEGIN:VALARM','TRIGGER:-P1D','ACTION:DISPLAY',icsFold(`DESCRIPTION:${icsEsc(e.title)}`),'END:VALARM',
        'END:VEVENT')
    })
    lines.push('END:VCALENDAR')
    downloadFile(lines.filter(Boolean).join('\r\n'), 'properwise.ics', 'text/calendar;charset=utf-8')
  }

  // ΕΚΤΥΠΩΣΗ ΕΠΕΡΧΟΜΕΝΩΝ. Ήταν χειρόγραφο έγγραφο δίπλα σε επτά που περνούν από
  // το `reportPdf.ts`: δική του επικεφαλίδα, δική του τυπογραφία, δικό του
  // γαλάζιο περίγραμμα, δικά του γκρι. Και μια γραμμή που δεν δούλευε καθόλου:
  //
  //     const col = d<0 ? '#c5221f' : d<=7 ? '#e37400' : '${INK_MUTED}'
  //
  // Το τρίτο σκέλος ήταν μέσα σε ΜΟΝΑ εισαγωγικά, δηλαδή η κυριολεκτική
  // συμβολοσειρά «${INK_MUTED}» και όχι η τιμή της: το CSS έβγαινε άκυρο και το
  // χρώμα έπεφτε σιωπηλά στο κληρονομημένο. Δηλαδή δύο από τις τρεις καταστάσεις
  // βάφονταν κόκκινη και πορτοκαλί και η τρίτη δεν βαφόταν καθόλου.
  //
  // ΚΑΙ Η ΣΤΗΛΗ ΕΧΕΙ ΑΦΕΤΗΡΙΑ, ΓΙΑΤΙ ΤΟ ΧΑΡΤΙ ΔΕΝ ΞΕΡΕΙ ΠΟΤΕ ΔΙΑΒΑΖΕΤΑΙ.
  // Ελεγε «Πότε» και από κάτω «σε 5 ημέρες»: σωστό τη στιγμή της εκτύπωσης,
  // λάθος από την επομένη, ενώ η διπλανή ημερομηνία μένει σωστή για πάντα. Η
  // κεφαλίδα του εγγράφου τυπώνει ήδη «Ημερομηνία έκδοσης»· η στήλη δείχνει
  // πλέον σε αυτήν και το νούμερο ξαναγίνεται αληθές όσο υπάρχει το χαρτί.
  //
  // Η ΕΠΕΙΓΟΥΣΑ ΚΑΤΑΣΤΑΣΗ ΔΕΝ ΛΕΓΕΤΑΙ ΜΕ ΧΡΩΜΑ. Η στήλη γράφει ήδη «3 ημέρες
  // πριν», «Σήμερα», «σε 5 ημέρες» — η πληροφορία είναι εκεί, σε λέξεις. Το
  // ληξιπρόθεσμο παίρνει βάρος, όχι κόκκινο: σε ασπρόμαυρη εκτύπωση το κόκκινο
  // γίνεται ούτως ή άλλως γκρι και σε έγχρωμη είναι σήμα που δεν έχει μάθει
  // κανείς. Καμία συντομογραφία: «ημ.» → «ημέρες».
  function printCalendar(){
    const up=[...filtered].filter(e=>e.status!=='paid').sort((a,b)=>a.event_date.localeCompare(b.event_date))
    const fmtD=(s:string)=>localDay(s).toLocaleDateString('el-GR',{weekday:'short',day:'2-digit',month:'long',year:'numeric'})
    const whenText=(d:number)=>d<0?`${Math.abs(d)} ${Math.abs(d)===1?'ημέρα':'ημέρες'} πριν`:d===0?'Σήμερα':`σε ${d} ${d===1?'ημέρα':'ημέρες'}`
    const rows=up.length?up.map(e=>{
      const cat=CATEGORIES[e.category]; const d=daysUntil(e.event_date)
      // Ληξιπρόθεσμο και σημερινό: έντονα. Τα υπόλοιπα: κανονικό βάρος.
      const weight=d<=0?700:400
      return `<tr>
      <td style="white-space:nowrap">${rEsc(fmtD(e.event_date))}</td>
      <td style="font-weight:600;color:${INK}">${rEsc(e.title)}${e.amount?` <span class="tnum" style="color:${INK_MUTED}">${rEsc(rEur(e.amount))}</span>`:''}</td>
      <td style="font-size:11px">${rEsc(cat?.label||'')}</td>
      <td class="n" style="font-weight:${weight};font-size:12px;white-space:nowrap">${rEsc(whenText(d))}</td></tr>`}).join('')
      :`<tr><td colspan="4" class="empty" style="text-align:center">Καμία εκκρεμότητα.</td></tr>`
    const html=reportHead('Ημερολόγιο, PROPERWISE')
      + `<body><div class="page">`
      + reportHeader(null, 'Επερχόμενα γεγονότα και προθεσμίες')
      + `
      <table style="margin-top:22px">
        <thead><tr><th>Ημερομηνία</th><th>Γεγονός</th><th>Κατηγορία</th><th class="n">Από την έκδοση</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${reportDisclaimer('Κατάσταση επερχόμενων γεγονότων και προθεσμιών, όπως καταγράφονται στο ημερολόγιο του ακινήτου.')}
      </div></body></html>`
    openReport(html)
  }

  const prevPeriod=()=>setCurrentDate(d=>new Date(d.getFullYear(),d.getMonth()-1,1))
  const nextPeriod=()=>setCurrentDate(d=>new Date(d.getFullYear(),d.getMonth()+1,1))
  const periodLabel=()=>`${MONTHS_NOM[currentDate.getMonth()]} ${currentDate.getFullYear()}`

  // Βάση κουμπιού σε ύφος Google

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* ── Η ΟΘΟΝΗ ΕΧΕΙ ΟΝΟΜΑ, ΟΠΩΣ ΚΑΘΕ ΑΛΛΗ ΚΑΡΤΕΛΑ ────────────────────────
          Ηταν `h1` κρυφό οπτικά: ο αναγνώστης οθόνης είχε κορυφή, το μάτι όχι·
          το Ημερολόγιο ήταν η μόνη καρτέλα χωρίς ορατό τίτλο δίπλα στον
          Ενοικιαστή, τις Επαφές και τους Επισκέπτες. Το όνομα έρχεται από το
          `lib/nav/labels.ts`, την ίδια πηγή με το μενού και τη Νόα.

          ΟΙ ΕΚΚΡΕΜΟΤΗΤΕΣ ΑΝΟΙΓΟΥΝ ΑΠΟ ΕΔΩ. Ηταν δική τους γραμμή στην πλαϊνή
          μπάρα, στα «Εργαλεία». Είναι όμως προθεσμίες και τις προθεσμίες τις
          ψάχνει κανείς στο ημερολόγιο: μία λέξη με τον αριθμό των ανοιχτών,
          στη θέση της ενέργειας του τίτλου. Σύνδεσμος και όχι κουμπί: κάθεται
          ως λέξη, χωρίς κουτί. */}
      <PageTitle title={navLabel('calendar')} sub="Προθεσμίες, πληρωμές και ραντεβού"
        right={onOpenTasks ? (
          <LinkBtn onClick={onOpenTasks}>
            Εκκρεμότητες{openTasks > 0 && <span style={{ fontFamily: T.font.num, fontVariantNumeric:'tabular-nums', color:'var(--text-tertiary)', fontWeight:500, marginLeft:6 }}>{openTasks}</span>}
          </LinkBtn>
        ) : undefined} />

      {/* Εκπρόθεσμα — ΜΙΑ γραμμή, ίδια γλώσσα με το μπάνερ των λήξεων.
          Η γραμμή KPI έφυγε: επαναλάμβανε τα ίδια τρία νούμερα μέσα σε 40px (το
          μπάνερ λήξεων έλεγε τον ίδιο αριθμό, η ράγα «Επόμενα» τα ίδια γεγονότα)
          και το «Εκκρεμή ποσά» της ήταν το ΤΡΙΤΟ διαφορετικό νούμερο με την ίδια
          ετικέτα. Έμεινε μία εμβέλεια, δηλωμένη στην οθόνη: του μήνα. */}
      {/* ═══ ΤΟ ΙΔΙΟ ΤΕΣΣΕΡΑ, ΤΡΕΙΣ ΦΟΡΕΣ ═══════════════════════════════════
          Ήταν ΔΥΟ ζώνες: μια γραμμή «4 εκπρόθεσμα · Εμφάνιση» και από κάτω μια
          κάρτα που ΞΑΝΑΕΓΡΑΦΕ «ΕΚΠΡΟΘΕΣΜΑ · 4» ως δική της επικεφαλίδα, με δικό
          της κουμπί κλεισίματος δίπλα στο βέλος που μόλις είχε πατηθεί. Δύο
          επικεφαλίδες, δύο μετρητές, δύο τρόποι να κλείσει το ίδιο πράγμα.

          Και ΤΡΙΤΗ φορά στην «Ατζέντα»: εκεί η λίστα έχει ήδη δική της ενότητα
          «Εκπρόθεσμα» με τα ίδια τέσσερα, αναλυτικά. Οι δύο ζώνες αποδίδονταν
          από πάνω ούτως ή άλλως, οπότε ο χρήστης έβλεπε τα τέσσερα εκπρόθεσμα
          τρεις φορές στην ίδια οθόνη.

          Τώρα: μία κάρτα, η επικεφαλίδα της είναι το κουμπί και μόνο στην όψη
          «Μήνας» — γιατί μόνο εκεί λείπει. */}
      {viewMode==='month'&&overdue.length>0&&(
        <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', borderLeft:'3px solid var(--negative)', borderRadius:T.radius.card, overflow:'hidden' }}>
          <button onClick={()=>setShowOverdue(o=>!o)} aria-expanded={showOverdue} className="acc-toggle acc-row"
            style={{ '--acc-pad': '12px 16px', borderBottom: showOverdue ? '1px solid var(--border-subtle)' : 'none' }}>
            <AlertTriangle size={14} color="var(--negative)"/>
            <p style={{ fontSize:14, color:'var(--text-secondary)', fontFamily: T.font.sans, letterSpacing:'0.1px', margin:0, flex:1 }}>
              {overdue.length===1?'1 εκπρόθεσμο':`${overdue.length} εκπρόθεσμα`} · <span style={{ color:'var(--text-primary)' }}>{showOverdue?'Απόκρυψη':'Εμφάνιση'}</span>
            </p>
            <ChevronDown size={15} style={{ color:'var(--text-tertiary)', transform:showOverdue?'rotate(180deg)':'none', transition:'transform 0.15s' }}/>
          </button>
          {showOverdue&&(
            <div>
              {[...overdue].sort((a,b)=>a.event_date.localeCompare(b.event_date)).map((e,i,arr)=>{ const late=Math.abs(daysUntil(e.event_date)); const cat=CATEGORIES[e.category]; return (
                <button className="po-hov-fill" key={e.id} onClick={()=>openEdit(e)} style={{ display:'flex', alignItems:'center', gap:12, width:'100%', textAlign:'left', padding:'11px 16px', border:'none', borderBottom:i<arr.length-1?'1px solid var(--border-subtle)':'none', cursor:'pointer', transition:'background 0.12s' }} >
                  <span style={{ width:7, height:7, borderRadius:3, background:cat.color, flexShrink:0 }}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:14, fontFamily: T.font.sans, color:'var(--text-primary)', margin:0, letterSpacing:'0.1px' }}>{e.title}</p>
                    <p style={{ fontSize:12, fontFamily: T.font.sans, color:'var(--text-tertiary)', margin:'2px 0 0' }}>{fmt(e.event_date)}{e.event_time?` · ${e.event_time}`:''}</p>
                  </div>
                  {e.amount!=null&&<span style={{ fontSize: 'var(--fs-base)', fontFamily: T.font.sans, fontVariantNumeric:'tabular-nums', color:'var(--text-secondary)' }}>{fe(e.amount)}</span>}
                  <span style={{ fontSize:12, fontFamily: T.font.sans, color:'var(--text-tertiary)', flexShrink:0 }}>πριν {late===1?'1 ημέρα':`${late} ημέρες`}</span>
                </button>
              )})}
            </div>
          )}
        </div>
      )}

      {/* Smart Alerts — μόνο η λήξη συμβολαίων· τα εκπρόθεσμα ανοίγουν από το KPI (χωρίς διπλό κόκκινο) */}
      {expiring.length>0&&(
        <div style={{ display:'flex', alignItems:'center', gap: 12, background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', borderLeft:'3px solid var(--warning)', borderRadius:10, padding:'10px 16px' }}>
          <Shield size={14} color="var(--warning)"/>
          <p style={{ fontSize:14, color:'var(--text-secondary)', fontFamily: T.font.sans, letterSpacing:'0.1px', margin:0 }}>
            {expiring.length} συμβόλαι{expiring.length===1?'ο λήγει':'α λήγουν'} εντός 60 ημερών · <span style={{ color:'var(--text-primary)' }}>{expiring.map(e=>`${e.title} (${fmtShort(e.event_date)})`).join(', ')}</span>
          </p>
        </div>
      )}

      {/* Toolbar — καθαρή, ένα πρωτεύον κουμπί· τα δευτερεύοντα σε ένα ήσυχο μενού */}
      <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
        {/* Το κουτί της ομάδας παίρνει το ύψος από τα κουμπιά της: 32 συν 3
            γέμισμα και 1 περίγραμμα πάνω κάτω, δηλαδή 40, όσο και τα υπόλοιπα
            χειριστήρια της γραμμής. Με γέμισμα 2 έβγαινε 38. */}
        <div style={{ display:'flex', background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:10, padding: 4, gap:2 }}>
          {/* shape="seg" και όχι "chip": το κουτί από πάνω έχει ήδη δικό του περίγραμμα. */}
          {([['month','Μήνας',Calendar],['agenda','Ατζέντα',List]] as [ViewMode,string,typeof Calendar][]).map(([v,label,Icon])=>(
            <ChipToggle key={v} on={viewMode===v} shape="seg" onClick={()=>setViewMode(v)}>
              <Icon size={13}/>{label}
            </ChipToggle>
          ))}
        </div>

        {viewMode!=='agenda'&&(
          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
            <IconBtn label="Προηγούμενο" title="Προηγούμενο" size="md" round onClick={prevPeriod}><ChevronLeft size={18}/></IconBtn>
            <span aria-live="polite" style={{ fontSize:15, fontWeight:600, fontFamily: T.font.sans, color:'var(--text-primary)', minWidth:150, textAlign:'center', letterSpacing:'0.1px' }}>{periodLabel()}</span>
            <IconBtn label="Επόμενο" title="Επόμενο" size="md" round onClick={nextPeriod}><ChevronRight size={18}/></IconBtn>
            {/* size="lg" γιατί η γραμμή εργαλείων είναι όλη στα 40, μαζί με το πεδίο αναζήτησης δίπλα. */}
            <Btn size="lg" onClick={()=>setCurrentDate(athensNow())}>Σήμερα</Btn>
          </div>
        )}

        <div style={{ flex:1, minWidth:100, position:'relative' }}>
          {/* Το «Τίτλος γεγονότος» ζητούσε 143 εικονοστοιχεία και το πεδίο δίνει
              116 στα 320: κοβόταν στο «Τίτλος γεγον…». Το σκέτο «Τίτλος» όμως,
              χωρίς φακό και δίπλα στο «+ Νέο», διαβαζόταν ως πεδίο γρήγορης
              προσθήκης. Ο φακός και η λέξη «Αναζήτηση» λένε τι είναι το πεδίο,
              όπως στην αναζήτηση του Φακέλου· το πλήρες νόημα το έχει η ετικέτα.
              Η λέξη είναι «Εύρεση» και όχι «Αναζήτηση»: στα 360 το πεδίο δίνει 82
              και η «Αναζήτηση» θέλει 89. */}
          <Search size={15} aria-hidden="true" style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-tertiary)', pointerEvents:'none' }}/>
          <input className="po-field" aria-label="Αναζήτηση γεγονότος με τον τίτλο του" placeholder="Εύρεση" value={searchQ} onChange={e=>setSearchQ(e.target.value)}
            style={{ width:'100%', height:T.h.lg, background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', borderRadius: T.radius.modal, padding:'0 10px 0 34px', color:'var(--text-primary)', fontSize:14, fontFamily: T.font.sans, outline:'none' }}
            onFocus={e=>e.currentTarget.style.borderColor='var(--accent)'} onBlur={e=>e.currentTarget.style.borderColor='var(--border-subtle)'}/>
        </div>

        <Btn variant="primary" size="lg" onClick={()=>openNew()} title="Νέο γεγονός">
          <Plus size={15}/>Νέο
        </Btn>

        {/* Ένα ήσυχο μενού για όλα τα δευτερεύοντα */}
        <div ref={menuRef} style={{ position:'relative' }}>
          <button ref={menuBtnRef} aria-label="Περισσότερα" aria-haspopup="menu" aria-expanded={showMenu} title="Περισσότερα" onClick={()=>setShowMenu(m=>!m)} style={{ width:T.h.md, height:T.h.md, borderRadius:'50%', border:'1px solid '+(showMenu?'var(--border-default)':'var(--border-subtle)'), background:showMenu?'var(--bg-elevated)':'var(--bg-surface)', cursor:'pointer', color:'var(--text-secondary)', display:'flex', alignItems:'center', justifyContent:'center' }}><MoreHorizontal size={18}/></button>
          {showMenu&&createPortal(
            <div ref={menuPopRef} role="menu" style={{ position:'fixed', top:menuCoords.top, left:menuCoords.left, transform:menuCoords.up?'translateY(-100%)':'none', width:248, maxHeight:'min(392px, 80vh)', overflowY:'auto', background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius: T.radius.popup, boxShadow:'var(--elev-3)', padding:6, zIndex:3000 }}>
              {([
                {label: bulkMode?'Τέλος επιλογής':'Μαζική επιλογή', icon:<CheckSquare size={15}/>, on:()=>{setBulkMode(b=>!b);setSelectedIds(new Set());setShowMenu(false)}},
                {label: showFilters?'Απόκρυψη φίλτρων':'Φίλτρα', icon:<Filter size={15}/>, on:()=>{setShowFilters(f=>!f);setShowMenu(false)}},
                {label:'Συγχρονισμός δεδομένων', icon:<RefreshCw size={15}/>, on:()=>{setShowAutoPull(f=>!f);setShowMenu(false)}},
                {label:'Συνδρομή σε ζωντανό ημερολόγιο', icon:<CalendarPlus size={15}/>, on:openSubscribe},
                {label:'Λήψη αρχείου .ics', icon:<Download size={15}/>, on:()=>{exportICal();setShowMenu(false)}},
                {label:'Εισαγωγή από .ics', icon:<CalendarDays size={15}/>, on:()=>{importRef.current?.click()}},
                {label:'Εξαγωγή σε Excel', icon:<FileText size={15}/>, on:()=>{
                  // Καθαρός, φιλτραρίσιμος πίνακας: κάθε πεδίο σε δικό του κελί, αριθμοί
                  // ως αριθμοί (2 δεκαδικά), στήλες Έτος/Μήνας/Προθεσμία για φιλτράρισμα,
                  // και ξεχωριστά φύλλα «Εκπρόθεσμα»/«Επερχόμενα».
                  const prothesmia=(e:CalEvent)=> (e.status==='paid'||e.status==='cancelled')?'Ολοκληρωμένο':isOverdue(e)?'Εκπρόθεσμο':'Εντός προθεσμίας'
                  const cols:XlsxCol[]=[
                    {header:'Ημερομηνία',kind:'date',width:13},
                    {header:'Ημέρα',width:11},
                    {header:'Μήνας',width:12},
                    {header:'Έτος',kind:'year',width:8},
                    {header:'Κατηγορία',width:18},
                    {header:'Τίτλος',width:44},
                    {header:'Ποσό',kind:'eur',width:14},
                    {header:'Κατάσταση',width:13},
                    {header:'Προθεσμία',width:16},
                  ]
                  const WD=['Κυριακή','Δευτέρα','Τρίτη','Τετάρτη','Πέμπτη','Παρασκευή','Σάββατο']
                  const toRow=(e:CalEvent)=>{ const d=new Date(e.event_date+'T00:00:00'); return [d,WD[d.getDay()],MONTHS_NOM[d.getMonth()],d.getFullYear(),CATEGORIES[e.category]?.label||e.category,e.title,(e.amount||null),STATUSES[e.status]?.label||e.status,prothesmia(e)] }
                  // Ταξινόμηση: χρονολογικά (κύριο) και δευτερευόντως με τη λογική σειρά
                  // κατηγοριών της εφαρμογής — καθαρή, προβλέψιμη ακολουθία.
                  const CAT_ORDER=Object.keys(CATEGORIES)
                  const catRank=(e:CalEvent)=>{ const i=CAT_ORDER.indexOf(e.category); return i<0?99:i }
                  const all=[...filtered].sort((a,b)=> a.event_date.localeCompare(b.event_date) || catRank(a)-catRank(b))
                  const curYear=athensNow().getFullYear()
                  const cur=all.filter(e=>new Date(e.event_date+'T00:00:00').getFullYear()===curYear)
                  const overdue=all.filter(e=>prothesmia(e)==='Εκπρόθεσμο'), upcoming=all.filter(e=>prothesmia(e)==='Εντός προθεσμίας')
                  // Πρώτο (προεπιλεγμένο) φύλλο: μόνο το τρέχον έτος. Ακολουθεί το πλήρες
                  // αρχείο και τα φύλλα εκπρόθεσμων/επερχόμενων.
                  const issued=athensNow().toLocaleDateString('el-GR')
                  const subFor=(scope:string)=>`${scope} · Έκδοση ${issued} · PROPERWISE`
                  const TOT=[6] // στήλη «Ποσό» → γραμμή ΣΥΝΟΛΟ
                  const sheets:XlsxSheet[]=[{name:`Ατζέντα ${curYear}`,title:`ΑΤΖΕΝΤΑ ΥΠΟΧΡΕΩΣΕΩΝ ${curYear}`,subtitle:subFor(`Έτος ${curYear}`),columns:cols,rows:cur.map(toRow),totalCols:TOT}]
                  if(all.length>cur.length) sheets.push({name:'Όλα τα έτη',title:'ΑΤΖΕΝΤΑ ΥΠΟΧΡΕΩΣΕΩΝ · ΟΛΑ ΤΑ ΕΤΗ',subtitle:subFor('Όλα τα έτη'),columns:cols,rows:all.map(toRow),totalCols:TOT})
                  if(overdue.length) sheets.push({name:'Εκπρόθεσμα',title:'ΕΚΠΡΟΘΕΣΜΕΣ ΥΠΟΧΡΕΩΣΕΙΣ',subtitle:subFor('Εκπρόθεσμες υποχρεώσεις'),columns:cols,rows:overdue.map(toRow),totalCols:TOT})
                  if(upcoming.length) sheets.push({name:'Επερχόμενα',title:'ΕΠΕΡΧΟΜΕΝΕΣ ΥΠΟΧΡΕΩΣΕΙΣ',subtitle:subFor('Επερχόμενες υποχρεώσεις'),columns:cols,rows:upcoming.map(toRow),totalCols:TOT})
                  downloadXlsx(`Ατζέντα υποχρεώσεων ${curYear}`,sheets)
                  setShowMenu(false)
                }},
                {label:'Εκτύπωση', icon:<Printer size={15}/>, on:()=>{printCalendar();setShowMenu(false)}},
              ] as {label:string;icon:React.ReactNode;on:()=>void}[]).map(it=>(
                <button className="po-hov-fill" key={it.label} onClick={it.on} style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'9px 12px', border:'none', cursor:'pointer', textAlign:'left', color:'var(--text-primary)', fontSize: 'var(--fs-base)', fontFamily: T.font.sans, borderRadius: T.radius.chip, transition:'background 0.12s' }} >
                  <span style={{ color:'var(--text-tertiary)', display:'flex', flexShrink:0 }}>{it.icon}</span>{it.label}
                </button>
              ))}
            </div>,
            document.body
          )}
        </div>
      </div>

      {bulkMode&&selectedIds.size>0&&(
        <div style={{ display:'flex', alignItems:'center', gap:12, background:'var(--accent-dim)', border:'1px solid var(--border-accent)', borderRadius: T.radius.chip, padding:'10px 16px' }}>
          <span style={{ fontSize:14, fontFamily: T.font.sans, fontWeight:500, color:'var(--accent)' }}>{selectedIds.size} επιλεγμένα</span>
          <button onClick={bulkMarkPaid} style={{ height:T.h.sm, padding:'0 16px', background:'var(--accent-dim)', border:'1px solid var(--accent)', borderRadius: T.radius.card, cursor:'pointer', fontSize: 'var(--fs-base)', color:'var(--accent)', fontFamily: T.font.sans, fontWeight:500 }}>Πληρωμένα</button>
          <button onClick={bulkDelete} style={{ height:T.h.sm, padding:'0 16px', background:'var(--negative-dim)', border:'1px solid var(--negative)', borderRadius: T.radius.card, cursor:'pointer', fontSize: 'var(--fs-base)', color:'var(--negative)', fontFamily: T.font.sans, fontWeight:500 }}>Διαγραφή</button>
          <button onClick={()=>setSelectedIds(new Set(filtered.map(e=>e.id)))} style={{ height:T.h.sm, padding:'0 16px', background:'transparent', border:'1px solid var(--border-default)', borderRadius: T.radius.card, cursor:'pointer', fontSize: 'var(--fs-base)', color:'var(--text-secondary)', fontFamily: T.font.sans }}>Επιλογή όλων</button>
        </div>
      )}

      {/* Filters Panel — ζωντανά πλήθη ανά φίλτρο, χρωματικές τελείες, καθάρισμα */}
      {showFilters&&(()=>{
        const anyActive=filterCat!=='all'||filterStatus!=='all'||!!searchQ||!!dateFrom||!!dateTo
        const inRange=(e:CalEvent)=>(!dateFrom||e.event_date>=dateFrom)&&(!dateTo||e.event_date<=dateTo)
        const matchSearch=(e:CalEvent)=>{ if(!searchQ)return true; const q=searchQ.toLowerCase(); return [e.title,e.notes||'',e.amount!=null?String(e.amount):'',CATEGORIES[e.category]?.label||e.category].join(' ').toLowerCase().includes(q) }
        const base=events.filter(e=>!(e.source||'').startsWith('booking:'))
        const catBase=base.filter(e=>(filterStatus==='all'||e.status===filterStatus)&&matchSearch(e)&&inRange(e))
        const statBase=base.filter(e=>(filterCat==='all'||e.category===filterCat)&&matchSearch(e)&&inRange(e))
        const catCount=(k:string)=>catBase.filter(e=>e.category===k).length
        const statCount=(k:string)=>statBase.filter(e=>e.status===k).length
        // Σταθερές διαστάσεις σε active/inactive (ίδιο fontWeight & ίδιο badge box)
        // ώστε η επιλογή να ΜΗΝ αλλάζει το μέγεθος του chip και να μη «χοροπηδά» το κουτί.
        const Chip=({active,color,onClick,dot,label,count}:{active:boolean;color:string;onClick:()=>void;dot?:string;label:string;count:number})=>(
          <button onClick={onClick} style={{ display:'inline-flex', alignItems:'center', gap: 8, height:T.h.sm, padding:'0 13px', borderRadius: T.radius.modal, fontSize: 'var(--fs-base)', cursor:'pointer', border:`1px solid ${active?color:'var(--border-subtle)'}`, background:active?`color-mix(in srgb, ${color} 15%, var(--bg-surface))`:'var(--bg-surface)', color:active?color:'var(--text-secondary)', fontFamily: T.font.sans, fontWeight:600, opacity:count===0&&!active?0.5:1, transition:'background 0.13s, border-color 0.13s, color 0.13s' }} onMouseEnter={e=>{if(!active)e.currentTarget.style.borderColor='var(--border-default)'}} onMouseLeave={e=>{if(!active)e.currentTarget.style.borderColor='var(--border-subtle)'}}>
            {dot&&<span style={{ width:8, height:8, borderRadius:3, background:dot, flexShrink:0 }}/>}
            {label}
            <span style={{ fontSize: 'var(--fs-xs)', fontVariantNumeric:'tabular-nums', color:active?color:'var(--text-tertiary)', background:'var(--bg-elevated)', borderRadius: T.radius.chip, padding:'1px 6px', minWidth:16, boxSizing:'border-box', textAlign:'center' }}>{count}</span>
          </button>
        )
        const activeCount=(filterCat!=='all'?1:0)+(filterStatus!=='all'?1:0)+(searchQ?1:0)+((dateFrom||dateTo)?1:0)
        return (
        <div style={{ position:'relative', background:'linear-gradient(180deg, var(--bg-elevated) 0%, var(--bg-surface) 100%)', border:'1px solid var(--border-subtle)', borderRadius: T.radius.card, padding:'16px 18px', boxShadow:'var(--highlight-inset), var(--elev-2)', display:'flex', flexDirection:'column', gap:16 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <Filter size={14} style={{ color:'var(--accent)' }}/>
              <p style={{ fontSize: 'var(--fs-base)', fontFamily: T.font.sans, fontWeight:600, color:'var(--text-primary)', margin:0, letterSpacing:'0.1px' }}>Φίλτρα</p>
              {activeCount>0&&<span style={{ fontSize: 'var(--fs-xs)', fontWeight:700, color:'var(--accent)', background:'var(--accent-soft)', border:'1px solid var(--accent-border)', borderRadius: T.radius.modal, padding:'1px 8px', fontFamily: T.font.sans }}>{activeCount} ενεργά</span>}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              {/* Το κόκκινο της αιώρησης ήταν χειρόγραφο και δεν ήξερε ούτε εστίαση ούτε αφή. Το `disabled` λέει πλέον μόνο του ότι δεν υπάρχει ενεργό φίλτρο. */}
              <Btn onClick={()=>{setFilterCat('all');setFilterStatus('all');setSearchQ('');setDateFrom('');setDateTo('')}} disabled={!anyActive}><RotateCcw size={12}/>Καθάρισε</Btn>
              <IconBtn label="Κλείσιμο φίλτρων" onClick={()=>setShowFilters(false)}><X size={16}/></IconBtn>
            </div>
          </div>
          <div>
            <p style={{ fontSize: 'var(--fs-xs)', fontFamily: T.font.sans, fontWeight:600, color:'var(--text-secondary)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom: 8 }}>Κατηγορία</p>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              <Chip active={filterCat==='all'} color="var(--accent)" onClick={()=>setFilterCat('all')} label="Όλες" count={catBase.length}/>
              {Object.entries(CATEGORIES).map(([k,v])=>(
                <Chip key={k} active={filterCat===k} color={v.color==='var(--text-secondary)'?'var(--accent)':v.color} onClick={()=>setFilterCat(filterCat===k?'all':k as EventCategory)} dot={v.color} label={v.label} count={catCount(k)}/>
              ))}
            </div>
          </div>
          <div>
            <p style={{ fontSize: 'var(--fs-xs)', fontFamily: T.font.sans, fontWeight:600, color:'var(--text-secondary)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom: 8 }}>Κατάσταση</p>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              <Chip active={filterStatus==='all'} color="var(--accent)" onClick={()=>setFilterStatus('all')} label="Όλες" count={statBase.length}/>
              {Object.entries(STATUSES).map(([k,v])=>(
                <Chip key={k} active={filterStatus===k} color={v.color} onClick={()=>setFilterStatus(filterStatus===k?'all':k as EventStatus)} dot={v.color} label={v.label} count={statCount(k)}/>
              ))}
            </div>
          </div>
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, marginBottom:10 }}>
              <p style={{ fontSize: 'var(--fs-xs)', fontFamily: T.font.sans, fontWeight:600, color:'var(--text-secondary)', letterSpacing:'0.06em', textTransform:'uppercase', margin:0 }}>Εύρος ημερομηνιών</p>
              {(dateFrom||dateTo)&&(()=>{ const f=(d:string)=>d?new Date(d+'T00:00:00').toLocaleDateString('el-GR',{day:'2-digit',month:'2-digit',year:'numeric'}):'…'; return (
                <span style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:12, fontFamily: T.font.sans, fontVariantNumeric:'tabular-nums', color:'var(--accent)', background:'var(--accent-soft)', border:'1px solid var(--accent-border)', borderRadius: T.radius.modal, padding:'2px 10px' }}>{f(dateFrom)}<ArrowRight size={11}/>{f(dateTo)}</span>
              )})()}
            </div>
            <div style={{ display:'flex', gap: 8, alignItems:'center' }}>
              <div style={{ flex:1, minWidth:0 }}><DatePicker value={dateFrom} onChange={setDateFrom} placeholder="Από"/></div>
              <ArrowRight size={14} style={{ color:'var(--text-tertiary)', flexShrink:0 }}/>
              <div style={{ flex:1, minWidth:0 }}><DatePicker value={dateTo} onChange={setDateTo} placeholder="Έως"/></div>
            </div>
            {(()=>{ const pad2=(n:number)=>String(n).padStart(2,'0'); const iso=(d:Date)=>`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; const an=athensNow(); const presets=[
              {label:'Αυτός ο μήνας', from:iso(new Date(an.getFullYear(),an.getMonth(),1)), to:iso(new Date(an.getFullYear(),an.getMonth()+1,0))},
              {label:'Επόμενες 30 ημέρες', from:todayStr(), to:iso(new Date(an.getFullYear(),an.getMonth(),an.getDate()+30))},
              {label:'Φέτος', from:`${an.getFullYear()}-01-01`, to:`${an.getFullYear()}-12-31`},
            ]; return (
              <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap', marginTop:10 }}>
                {/* Προεπιλογή εύρους: ξαναπατιέται για ακύρωση, άρα κατάσταση και όχι ενέργεια. */}
                {presets.map(p=>{ const on=dateFrom===p.from&&dateTo===p.to; return (
                  <ChipToggle key={p.label} on={on} onClick={()=>{setDateFrom(on?'':p.from);setDateTo(on?'':p.to)}}>{p.label}</ChipToggle>
                )})}
                {(dateFrom||dateTo)&&<Btn variant="ghost" onClick={()=>{setDateFrom('');setDateTo('')}}><X size={12}/>Καθαρισμός</Btn>}
              </div>
            )})()}
          </div>
        </div>
        )
      })()}

      {/* Το φύλλο της ημέρας ζει δίπλα στα υπόλοιπα παράθυρα, όχι μέσα στο
          πλέγμα: το πλέγμα ξαναζωγραφίζεται σε κάθε σύρσιμο και το παράθυρο
          δεν έχει λόγο να ακολουθεί. */}
      {sheetDate&&(
        <DaySheet date={sheetDate} events={monthEvents.filter(e=>e.event_date===sheetDate&&!(e.source||'').startsWith('booking:'))}
          onClose={()=>setSheetDate('')}
          onPick={e=>{setSheetDate('');openEdit(e)}}
          onNew={()=>{const d=sheetDate;setSheetDate('');openNew(d)}}/>
      )}

      {showAutoPull&&<AutoPullPanel propertyId={propertyId} userId={userId} onRefresh={load} onClose={()=>setShowAutoPull(false)}/>}

      {/* Σκελετός στο σχήμα του πλέγματος του μήνα: ο δείκτης φόρτωσης άφηνε τη
          σελίδα να «πηδά» σε ύψος μόλις έφταναν τα γεγονότα. */}
      {loading&&<Skeleton h={420} r={14} />}

      {!loading&&viewMode==='month'&&(
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <MonthView events={monthEvents} currentDate={currentDate} selectedDate={selectedDate} onDayClick={d=>{setSelectedDate(d);setCurrentDate(new Date(d+'T00:00:00'))}} onDayOpen={d=>{setSelectedDate(d);setSheetDate(d)}} onEventClick={openEdit} upcomingAll={filtered} drag={drag} stays={stays}/>
          {monthEvents.length>0&&(
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {/* Ο μήνας τον λέει ο επιλογέας από πάνω, μαζί με τη χρονιά του. */}
              <p style={{ fontSize:12, fontFamily: T.font.sans, fontWeight:500, color:'var(--text-secondary)', letterSpacing:'0.5px', textTransform:'uppercase' }}>Γεγονότα</p>
              {monthEvents.map(e=>(<EventCard key={e.id} event={e} onToggleStatus={toggleStatus} onEdit={openEdit} onDelete={deleteEvent} selected={selectedIds.has(e.id)} onSelect={toggleSelect} bulkMode={bulkMode} sameMonth/>))}
            </div>
          )}
          {/* ═══ ΤΟ ΑΔΕΙΟ ΠΛΕΓΜΑ ΕΙΝΑΙ Η ΚΕΝΗ ΚΑΤΑΣΤΑΣΗ ══════════════════════
              Από κάτω του καθόταν ολόκληρο EmptyState με εικονίδιο, τίτλο «Δεν
              βρέθηκαν γεγονότα αυτόν τον μήνα» και υπόδειξη «Πάτησε σε μια ημέρα
              για να προσθέσεις». Το πλέγμα από πάνω είναι ήδη ολοφάνερα άδειο και
              ΗΔΗ δέχεται πάτημα σε μέρα: το μπλοκ περιέγραφε το κενό που φαίνεται
              και δίδασκε κίνηση που είναι ήδη διαθέσιμη.
              Και ανακάτευε δύο καταστάσεις σε μία: ο τίτλος είχε τη μορφή του
              φίλτρου («δεν βρέθηκαν») και η υπόδειξη τη μορφή της πρώτης
              καταχώρησης. Στην Ατζέντα, δώδεκα γραμμές πιο κάτω, οι δύο είναι
              σωστά χωρισμένες και εκεί χρειάζονται, γιατί εκεί δεν υπάρχει πλέγμα. */}
        </div>
      )}

      {!loading&&viewMode==='agenda'&&(
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          {overdue.length>0&&<Section title="Εκπρόθεσμα" color="var(--negative)" events={overdue} onToggle={toggleStatus} onEdit={openEdit} onDelete={deleteEvent} bulkMode={bulkMode} selectedIds={selectedIds} onSelect={toggleSelect}/>}
          {thisWeek.length>0&&<Section title="Επόμενες 7 ημέρες" color="var(--accent)" events={thisWeek} onToggle={toggleStatus} onEdit={openEdit} onDelete={deleteEvent} bulkMode={bulkMode} selectedIds={selectedIds} onSelect={toggleSelect}/>}
          {thisMonth.length>0&&<Section title="Σε 8 ως 30 ημέρες" color="var(--text-secondary)" events={thisMonth} onToggle={toggleStatus} onEdit={openEdit} onDelete={deleteEvent} bulkMode={bulkMode} selectedIds={selectedIds} onSelect={toggleSelect}/>}
          {later.length>0&&<Section title="Αργότερα" color="var(--text-secondary)" events={later} onToggle={toggleStatus} onEdit={openEdit} onDelete={deleteEvent} bulkMode={bulkMode} selectedIds={selectedIds} onSelect={toggleSelect}/>}
          {done.length>0&&<Section title="Ολοκληρωμένα και ακυρωμένα" color="var(--text-tertiary)" events={done} onToggle={toggleStatus} onEdit={openEdit} onDelete={deleteEvent} collapsed desc bulkMode={bulkMode} selectedIds={selectedIds} onSelect={toggleSelect}/>}
          {/* ΔΥΟ ΔΙΑΦΟΡΕΤΙΚΕΣ ΚΕΝΕΣ ΚΑΤΑΣΤΑΣΕΙΣ, ΟΧΙ ΜΙΑ. Το «άλλαξε φίλτρο» σε
              λογαριασμό χωρίς ούτε ένα γεγονός στέλνει τον χρήστη να ψάξει
              ρύθμιση που δεν φταίει· το «πρόσθεσε γεγονός» σε φιλτραρισμένη όψη
              κρύβει ότι τα γεγονότα υπάρχουν και απλώς δεν ταιριάζουν. */}
          {filtered.length===0&&(events.length===0
            ? <EmptyState icon={<CalendarDays size={20}/>} title="Κανένα γεγονός ακόμη" hint="Πάτησε σε μια ημέρα για να προσθέσεις ραντεβού, πληρωμή ή υπενθύμιση." />
            : <EmptyState icon={<CalendarDays size={20}/>} title="Δεν βρέθηκαν γεγονότα" hint="Άλλαξε φίλτρο ή περίοδο για να δεις τα υπόλοιπα." />)}
        </div>
      )}

      <input ref={importRef} type="file" accept=".ics,text/calendar" style={{ display:'none' }} onChange={e=>{const f=e.target.files?.[0]; if(f)importIcs(f); e.currentTarget.value=''}}/>
      {/* Ένα παράθυρο κάθε φορά: όσο ρωτάμε εμβέλεια, η φόρμα παραμερίζεται
          (τα δεδομένα της ζουν στο `form` εδώ, δεν χάνεται τίποτα — με
          «Ακύρωση» στην εμβέλεια η φόρμα επιστρέφει συμπληρωμένη). */}
      {showModal&&!scopePrompt&&<EventModal form={form} setForm={setForm} onSave={saveEvent} onClose={()=>setShowModal(false)} editing={!!editingEvent} saving={saving} conflicts={formConflicts}/>}
      {showSubscribe&&<SubscribeModal token={feedToken} propertyId={propertyId} onClose={()=>setShowSubscribe(false)}/>}
      {scopePrompt&&<ScopeModal title="Επεξεργασία επαναλαμβανόμενου" hint="Σε ποιες εμφανίσεις να εφαρμοστούν οι αλλαγές;" onPick={applyEditScope} onClose={()=>setScopePrompt(false)}/>}
      {deleteScope&&<ScopeModal title="Διαγραφή επαναλαμβανόμενου" hint="Τι θέλεις να διαγράψεις;" danger onPick={applyDeleteScope} onClose={()=>setDeleteScope(null)}/>}
      {drag.ghost&&createPortal(
        <div style={{ position:'fixed', left:drag.ghost.x+14, top:drag.ghost.y+14, pointerEvents:'none', zIndex:3000, background:'var(--accent)', color:'var(--accent-text)', fontSize:12, fontWeight:600, padding:'5px 11px', borderRadius: T.radius.chip, boxShadow:'var(--elev-2)', maxWidth:220, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily: T.font.sans }}>{drag.ghost.label}</div>,
        document.body
      )}
    </div>
  )
}