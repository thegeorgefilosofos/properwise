'use client'
// ═══════════════════════════════════════════════════════════════════════════
// Ο ΣΥΓΧΡΟΝΙΣΜΟΣ: ΤΙ ΤΡΑΒΑΕΙ ΤΟ ΗΜΕΡΟΛΟΓΙΟ ΑΠΟ ΤΙΣ ΑΛΛΕΣ ΚΑΡΤΕΛΕΣ
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect, useMemo } from 'react'
import { isoDate, athensToday } from '@/lib/core/time'
import { addMonths } from '@/lib/loans/progress'
import { createClient } from '@/lib/supabase/client'
import * as properties from '@/lib/data/properties'
import * as stayStore from '@/lib/data/stays'
import * as billStore from '@/lib/data/bills'
import * as tenantStore from '@/lib/data/tenants'
// Το Supabase δεν πετάει σε σφάλμα βάσης· η `must` το κάνει να πετάει.
import { must } from '@/lib/supabase/must'
// Ο πίνακας των γεγονότων έχει ένα σπίτι: lib/data/calendar.
import * as calendar from '@/lib/data/calendar'
// Ο πίνακας των δανείων έχει ένα σπίτι: lib/data/loans.
import * as loanStore from '@/lib/data/loans'
import type { BillsRow, ClientStaysRow, MaintenanceTasksRow } from '@/lib/supabase/tables'
import type { TenantScheduleInput } from '../TabTenantHelpers'
import { T, fe, CloseButton } from '@/components/Theme'
import { Check, FileText, User, Receipt, Euro, Wrench, RefreshCw, TrendingUp, Info } from 'lucide-react'
import { buildBookingEvents } from '@/lib/calendar/bookingEvents'
import {
  taxObligationsHorizon, taxObligationToEvent, taxProfileOf, AADE_CALENDAR_URL,
  TAXHEAVEN_CALENDAR_URL,
} from '@/lib/tax/greekTaxCalendar'
import { annuityMonthly } from '@/lib/loans/recommend'
import { syncTenantSchedule } from '../TabTenantHelpers'
import { notifyError } from '@/components/Toast'
import {
  type EventCategory, type EventPriority, type EventStatus, cleanBank, loanEventTitle, todayStr,
} from './model'
import { roundHalfUp } from '@/lib/core/money';

// Ό,τι διαβάζει ο συγχρονισμός από κάθε πίνακα, γραμμένο εδώ και μόνο εδώ.
type TenantScheduleRow = TenantScheduleInput & { rent_due_day?: number | null }
type StayWithGuest = Pick<ClientStaysRow, 'id'|'check_in'|'check_out'|'total'|'nights'|'guests'|'channel'> & { clients?: { full_name?: string | null } | null }

// Έξυπνος συγχρονισμός: αναγνωρίζει τον τύπο μίσθωσης του ακινήτου και τραβά ΜΟΝΟ
// ό,τι έχει νόημα — μακροχρόνια → ενοίκιο & λήξεις μίσθωσης· βραχυχρόνια → κρατήσεις
// με το όνομα του επισκέπτη. Δείχνει ζωντανά πλήθη ανά πηγή πριν τραβήξει.
type SyncKey='bills'|'maintenance'|'leases'|'bookings'|'tax'|'loans'
export function AutoPullPanel({ propertyId, userId, onRefresh, onClose }: { propertyId:string; userId:string; onRefresh:()=>void; onClose?:()=>void }) {
  const supabase=createClient()
  const scope=useMemo(()=>({propertyId,userId}),[propertyId,userId])
  const [busy,setBusy]=useState<SyncKey|null>(null)
  const [mode,setMode]=useState<'long_term'|'short_term'|null>(null)
  const [counts,setCounts]=useState<Record<SyncKey,number>|null>(null)
  const [done,setDone]=useState<Record<string,{n:number;at:string}>>({})
  const [lastSync,setLastSync]=useState<string|null>(null)
  // Το φορολογικό προφίλ βγαίνει από την ΜΙΑ κατάσταση του ακινήτου (taxProfileOf),
  // τον ίδιο κανόνα που χρησιμοποιεί και η Επισκόπηση.
  const taxProfile=(mode==='short_term'?'short_term':mode==='long_term'?'long_term':'owner')

  // Ο τύπος του ερωτήματος καταμέτρησης δεν γράφεται με το χέρι — τον δίνει το ίδιο
  // το Supabase. Με `(q:any)=>any` το `extra` μπορούσε να καλέσει οτιδήποτε πάνω στο
  // ερώτημα (ακόμη και μέθοδο που δεν υπάρχει) ή να επιστρέψει κάτι που δεν είναι
  // καν ερώτημα και το `await q` παρακάτω θα έσκαγε μόνο στον browser.
  const countQuery=(table:string)=>supabase.from(table).select('*',{count:'exact',head:true}).eq('property_id',propertyId)
  type CountQuery=ReturnType<typeof countQuery>
  const cnt=async(table:string,extra?:(q:CountQuery)=>CountQuery)=>{ let q=countQuery(table); if(extra)q=extra(q); const{count}=await q; return count||0 }
  useEffect(()=>{
    (async()=>{
      const[prop,bills,maintenance,leases,bookings,loans]=await Promise.all([
        properties.one<{ status_detail: string | null; rental_mode: string | null }>(supabase, propertyId, 'status_detail,rental_mode', userId),
        cnt('bills'), cnt('maintenance_tasks'),
        cnt('tenants',q=>q.neq('status','past')), cnt('client_stays'), cnt('loans'),
      ])
      const prof=taxProfileOf(prop)
      const m=prof==='short_term'?'short_term':prof==='long_term'?'long_term':null
      const tax=taxObligationsHorizon(todayStr(),prof).length
      setMode(m); setCounts({bills,maintenance,leases,bookings,tax,loans})
      try{ const ls=localStorage.getItem(`cal_sync_${propertyId}`); if(ls)setLastSync(ls) }catch{}
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[propertyId])

  // Ποιες πηγές δείχνουμε: ανά τύπο μίσθωσης (η «διαφορά» του AI — σωστά φίλτρα).
  // Τα Φορολογικά αφορούν ΚΑΘΕ ιδιοκτήτη, οπότε εμφανίζονται πάντα.
  const visible:SyncKey[]=useMemo(()=>{
    if(mode==='short_term')return['bookings','tax','loans','bills','maintenance']
    if(mode==='long_term')return['leases','tax','loans','bills','maintenance']
    return['leases','bookings','tax','loans','bills','maintenance']
  },[mode])

  // ══ ΤΟ «ΤΙΠΟΤΑ ΑΚΟΜΗ» ΔΙΑΒΑΖΟΤΑΝ ΩΣ ΒΛΑΒΗ ══════════════════════════════════
  // Τρία πλακίδια θαμπά, με την ίδια τρίλεξη φράση κάτω από τρεις διαφορετικές
  // ετικέτες: ο χρήστης δεν μπορούσε να ξεχωρίσει «ο συγχρονισμός χάλασε» από
  // «δεν υπάρχει τίποτα να τραβηχτεί». Και τα δύο δείχνουν ίδια, μόνο που το
  // πρώτο θέλει διόρθωση και το δεύτερο δεν θέλει τίποτα.
  //
  // Κάθε πηγή λέει τώρα ΤΙ ΤΗΣ ΛΕΙΠΕΙ, με το όνομα του πράγματος. «Δεν έχεις
  // καταχωρήσει δάνειο» δεν είναι σφάλμα, είναι κατάσταση και ο χρήστης ξέρει
  // αμέσως ότι η αιτία είναι στα δικά του δεδομένα και όχι στη σύνδεση.
  const META:Record<SyncKey,{label:string;icon:React.ReactNode;unit:(n:number)=>string;empty:string}>={
    leases:     {label:'Ενοίκιο και μισθώσεις', icon:<Euro size={15}/>,     unit:n=>n===1?'1 ενοικιαστής':`${n} ενοικιαστές`, empty:'Κανένας ενοικιαστής ακόμη'},
    bookings:   {label:'Κρατήσεις',            icon:<User size={15}/>,     unit:n=>n===1?'1 κράτηση':`${n} κρατήσεις`,       empty:'Καμία κράτηση ακόμη'},
    tax:        {label:'Φορολογικά (ΑΑΔΕ)',    icon:<FileText size={15}/>, unit:n=>n===1?'1 προθεσμία':`${n} προθεσμίες`,    empty:'Καμία προθεσμία στο επόμενο διάστημα'},
    loans:      {label:'Δόσεις δανείου',        icon:<TrendingUp size={15}/>,unit:n=>n===1?'1 δάνειο':`${n} δάνεια`,          empty:'Δεν έχεις καταχωρήσει δάνειο'},
    bills:      {label:'Λογαριασμοί',          icon:<Receipt size={15}/>,      unit:n=>n===1?'1 λογαριασμός':`${n} λογαριασμοί`, empty:'Δεν έχεις καταχωρήσει λογαριασμό'},
    maintenance:{label:'Συντήρηση',            icon:<Wrench size={15}/>,   unit:n=>n===1?'1 εργασία':`${n} εργασίες`,        empty:'Καμία εργασία συντήρησης'},
  }

  // Συγχρονισμός ΜΙΑΣ πηγής — το ίδιο το κουτάκι είναι το κουμπί. Χωρίς on/off,
  // χωρίς ξεχωριστό «Συγχρονισμός τώρα»: πατάς π.χ. «Φορολογικά (ΑΑΔΕ)» και
  // τραβιούνται ΟΛΕΣ οι καταληκτικές αλλά και οι πρώτες ημερομηνίες.
  async function syncOne(k:SyncKey):Promise<number> {
    // ── Λογαριασμοί ──
    if(k==='bills'){
      const bills=await billStore.ofProperty(supabase,propertyId,'*',userId)
      const todayIso=athensToday()
      // ΔΥΟ ΝΕΚΡΑ ΕΝΑΛΛΑΚΤΙΚΑ ΠΕΔΙΑ. Το `next_due_date` δεν υπάρχει σε κανέναν
      // από τους πίνακες και το `provider` υπάρχει μόνο στα τιμολόγια ρεύματος.
      // Το `(b:any)` τα έκρυβε από τον μεταγλωττιστή, όπως το `as any` στα δάνεια.
      // Αποτέλεσμα: λογαριασμός χωρίς όνομα γινόταν γεγονός με τίτλο
      // «Λογαριασμός» — πέντε πανομοιότυπες γραμμές στο ημερολόγιο, χωρίς να
      // ξεχωρίζει ποια είναι το ρεύμα και ποια το νερό. Ο τύπος του λογαριασμού
      // υπάρχει και είναι ήδη ο τίτλος του στην Επισκόπηση.
      // ── Η ΠΡΟΘΕΣΜΙΑ ΓΡΑΦΟΤΑΝ ΜΙΑ ΜΕΡΑ ΝΩΡΙΤΕΡΑ, ΣΤΟ 27% ΤΩΝ ΠΕΡΙΠΤΩΣΕΩΝ ──
      // Η παλιά γραμμή έφτιαχνε `new Date('2026-03-10')` — μεσάνυχτα UTC — και
      // μετά την πείραζε με ΤΟΠΙΚΟΥΣ setters (`setMonth`, `setFullYear`) για να
      // τη φέρει στον τρέχοντα μήνα και τη διάβαζε πίσω με `toISOString()`,
      // δηλαδή ξανά σε UTC. Όταν η αφετηρία είναι χειμερινή ώρα (UTC+2) και ο
      // προορισμός θερινή (UTC+3), χάνεται μία ώρα πάνω από τα μεσάνυχτα και
      // πέφτει μία μέρα. Μετρημένο σε 222 μετακινήσεις: 60 έπεφταν λάθος.
      //
      // Χειρότερα, το αποτέλεσμα ΓΡΑΦΕΤΑΙ στη βάση: κάθε επαναλαμβανόμενος
      // λογαριασμός καθόταν στο ημερολόγιο μια μέρα πριν από την πραγματική του
      // προθεσμία, σιωπηλά.
      //
      // Η αριθμητική γίνεται τώρα σε ημερολογιακούς μήνες πάνω σε κείμενο, με
      // την `addMonths` που ήδη προστατεύει και από την υπερχείλιση (31 Ιανουαρίου
      // συν έναν μήνα δεν είναι 31 Φεβρουαρίου). Καμία ζώνη ώρας δεν συμμετέχει.
      const rows=((bills||[]) as BillsRow[]).filter(b=>b.due_date).map(b=>{
        let dueDate=b.due_date
        if(dueDate<todayIso){
          const monthsApart=(Number(todayIso.slice(0,4))-Number(dueDate.slice(0,4)))*12
            +(Number(todayIso.slice(5,7))-Number(dueDate.slice(5,7)))
          const moved=addMonths(dueDate,monthsApart)??dueDate
          dueDate=moved<todayIso?(addMonths(moved,1)??moved):moved
        }
        return{title:b.name||b.type||'Λογαριασμός',category:'bills' as EventCategory,event_date:dueDate,amount:b.amount||null,status:(b.paid?'paid':'pending') as EventStatus,recurring:true,recurring_interval:'monthly',notes:b.category?`Κατηγορία: ${b.category}`:null}
      })
      await must(calendar.replaceSource(supabase,scope,{source:'bills'},rows))
      // ΤΟ ΣΚΑΝΑΡΙΣΜΕΝΟ ΔΙΑΓΡΑΦΕΤΑΙ ΜΕΤΑ ΚΑΙ ΜΟΝΟ ΑΝ ΠΕΤΥΧΕ Η ΕΓΓΡΑΦΗ.
      //
      // Αυτή η γραμμή ήταν πριν από την εισαγωγή. Τα υπόλοιπα γεγονότα εδώ είναι
      // ΠΑΡΑΓΩΓΑ — ξαναφτιάχνονται από τον πίνακα λογαριασμών σε κάθε συγχρονισμό,
      // οπότε μια αποτυχία απλώς απαιτεί δεύτερο πάτημα. Οι υπενθυμίσεις από
      // ΣΑΡΩΣΗ όμως δεν παράγονται από πουθενά: αν σβήνονταν πρώτες και η
      // εισαγωγή αποτύγχανε, χάνονταν οριστικά, χωρίς μήνυμα.
      await must(calendar.clearSource(supabase,scope,{source:'scan',category:'bills'}))
      return rows.length
    }
    // ── Συντήρηση ──
    if(k==='maintenance'){
      // ΤΟ ΕΡΩΤΗΜΑ ΚΑΙ Η ΜΕΤΑΤΡΟΠΗ ΗΤΑΝ ΣΤΗΝ ΙΔΙΑ ΓΡΑΜΜΗ ΤΩΝ 200 ΧΑΡΑΚΤΗΡΩΝ.
      // Ο φύλακας σχήματος διάβαζε το κλειδί `status:` του αντικειμένου ως
      // φίλτρο πάνω στον πίνακα `maintenance_tasks` — που δεν έχει τέτοια στήλη —
      // και κοκκίνιζε το CI για ερώτημα που είναι σωστό. Δεν χαλαρώνει ο
      // φύλακας: χωρίζεται η γραμμή, γιατί το ερώτημα και η μετατροπή του είναι
      // δύο πράγματα και έτσι διαβάζονται και από άνθρωπο.
      const tasks: MaintenanceTasksRow[] =
        await must(supabase.from('maintenance_tasks').select('*').eq('property_id', propertyId)) ?? []
      const rows = tasks.filter(t => t.due_date).map(t => ({
        title: t.title || 'Εργασία συντήρησης',
        category: 'maintenance' as EventCategory,
        event_date: t.due_date,
        priority: (t.priority || 'medium') as EventPriority,
        status: (t.completed ? 'paid' : 'pending') as EventStatus,
        notes: t.description || null,
      }))
      await must(calendar.replaceSource(supabase,scope,{sources:['loan','maintenance']},rows))
      return rows.length
    }
    // ── Ενοίκιο & μισθώσεις (πραγματικά δεδομένα ενοικιαστή, idempotent) ──
    if(k==='leases'){
      // Το παλιό φίλτρο κοίταζε μόνο αν η κατάσταση του μισθωτή ήταν
      // «παρελθοντική» και άφηνε μέσα όποιον είχε ημερομηνία αποχώρησης χωρίς
      // αλλαγή κατάστασης — δηλαδή δημιουργούσε δόσεις ενοικίου για μισθωτή που
      // έχει ήδη φύγει. Ο κανόνας ζει πλέον σε ένα σημείο, στο tenantStore.
      //
      // Η ΠΕΡΙΓΡΑΦΗ ΕΙΝΑΙ ΣΕ ΛΕΞΕΙΣ ΚΑΙ ΟΧΙ ΣΕ ΚΩΔΙΚΑ, ΣΚΟΠΙΜΑ. Το σχόλιο
      // παρέθετε την παλιά κλήση αυτούσια και ο φύλακας σχήματος τη διάβαζε ως
      // ζωντανό φίλτρο πάνω στο προηγούμενο ερώτημα της ίδιας αλυσίδας: το CI
      // κοκκίνιζε για στήλη που κανείς δεν ζητούσε. Κώδικας μέσα σε σχόλιο δεν
      // εκτελείται, αλλά διαβάζεται από τα εργαλεία.
      const tenants=await tenantStore.currentAll<TenantScheduleRow>(supabase,propertyId,'*',userId)
      let n=0
      for(const t of ((tenants||[]) as TenantScheduleRow[])){
        await syncTenantSchedule(supabase,t,propertyId,userId,'save',{rentDueDay:t.rent_due_day??1})
        if(t.monthly_rent)n++
      }
      return n
    }
    // ── Κρατήσεις (με όνομα επισκέπτη) ──
    if(k==='bookings'){
      const stays=await stayStore.withClientName(supabase,propertyId,'id,check_in,check_out,total,nights,guests,channel',userId)
      // Κράτηση χωρίς ημερομηνία άφιξης δεν γίνεται γεγονός: δεν υπάρχει μέρα να μπει.
      const rows=buildBookingEvents(((stays||[]) as StayWithGuest[]).filter((s):s is StayWithGuest&{check_in:string}=>!!s.check_in).map(s=>({id:s.id,check_in:s.check_in,check_out:s.check_out,total:s.total,nights:s.nights,guests:s.guests,channel:s.channel,guest_name:s.clients?.full_name??null})))
      await must(calendar.replaceSource(supabase,scope,{prefix:'booking:'},rows))
      return rows.length
    }
    // ── Φορολογικά (ΑΑΔΕ): πραγματικές, θεσμοθετημένες προθεσμίες ──
    // Ο ορίζοντας και οι ημερομηνίες ορίζονται ΜΟΝΟ στο greekTaxCalendar. Το κλειδί
    // `tax:<id>` είναι το ίδιο που γράφει και η κάρτα «Υποχρεώσεις & Προθεσμίες»
    // της Επισκόπησης, άρα το δεύτερο πάτημα αντικαθιστά — δεν διπλογράφει.
    if(k==='tax'){
      const obs=taxObligationsHorizon(todayStr(),taxProfile)
      const rows=obs.map(o=>taxObligationToEvent(o))
      await must(calendar.replaceSource(supabase,scope,{prefix:'tax:'},rows))
      return rows.length
    }
    // ── Δόσεις δανείου: ίδιο source με το κουμπί των Δανείων → idempotent, χωρίς διπλά ──
    if(k==='loans'){
      // ΤΟ ΠΟΣΟ ΤΟΥ ΔΑΝΕΙΟΥ ΔΕΝ ΛΕΓΕΤΑΙ `amount` ΚΑΙ ΤΟ ΕΠΙΤΟΚΙΟ ΔΕΝ ΕΙΝΑΙ ΣΤΗΛΗ.
      // Εδώ διαβαζόταν `(l as any).amount` και `(l as any).rate`. Η στήλη λέγεται
      // `loan_amount` και το επιτόκιο προκύπτει από `fixed_rate` ή από
      // `euribor + spread` ανάλογα με τον τύπο. Δηλαδή και τα δύο έβγαιναν
      // undefined, το `Number(undefined)||0` τα έκανε μηδέν και το `if(!amount)`
      // παρακάτω πετούσε ΚΑΘΕ δάνειο: ο συγχρονισμός δόσεων απαντούσε πάντα
      // «μηδέν» και κανείς δεν καταλάβαινε γιατί το ημερολόγιο έμενε άδειο.
      //
      // Η μετατροπή και το φίλτρο του «ενεργού» ζουν πλέον στο στρώμα: εδώ
      // ζητούνται ΜΟΝΟ τα ενεργά δάνεια του χρήστη και η αποτυχία πετάει.
      const loans=await loanStore.ofProperty(supabase,propertyId,userId,{activeOnly:true,strict:true})
      let n=0
      for(const l of loans){
        const amount=l.amount, rate=l.rate, years=Number(l.years)||0
        const start=l.start_date||todayStr(); const bank=cleanBank(l.bank)
        if(!amount||!years)continue
        const monthly=annuityMonthly(amount,rate,years); if(!monthly)continue
        const src='loan_schedule:'+(bank||'γενικό').toLowerCase().replace(/\s+/g,'_').slice(0,40)
        const d=new Date(start); const cnt2=Math.min(years*12,60); const rows:calendar.EventDraft[]=[]
                // ΤΟ ΠΟΣΟ ΚΡΑΤΑΕΙ ΤΑ ΛΕΠΤΑ ΤΟΥ. Ήταν `Math.round(monthly)`: μια δόση
        // 751,43€ αποθηκευόταν ως 751 και το ημερολόγιο διαφωνούσε με την
        // τράπεζα κατά 43 λεπτά τον μήνα, δηλαδή πάνω από πέντε ευρώ τον χρόνο.
        const monthlyExact=roundHalfUp(monthly, 2)
        // Τοπικά μεσάνυχτα σε UTC = χθες: οι δόσεις έμπαιναν μία μέρα νωρίτερα.
        for(let i=0;i<cnt2;i++){ const ev=new Date(d.getFullYear(),d.getMonth()+i+1,d.getDate()); rows.push({title:loanEventTitle(bank),category:'financial',event_date:isoDate(ev),amount:monthlyExact,priority:'high',notes:`${fe(monthlyExact)} ανά μήνα`}) }
        await must(calendar.replaceSource(supabase,scope,{source:src},rows))
        n+=rows.length
      }
      return n
    }
    return 0
  }

  async function runOne(k:SyncKey) {
    if(busy) return
    setBusy(k)
    // Η ΑΠΟΤΥΧΙΑ ΔΕΝ ΓΡΑΦΕΤΑΙ ΩΣ ΕΠΙΤΥΧΙΑ.
    //
    // Εδώ υπήρχε `try { n = await syncOne(k) } finally { … }` — χωρίς catch. Το
    // `finally` έτρεχε ούτως ή άλλως και έγραφε σφραγίδα «συγχρονίστηκε τώρα» με
    // n=0. Ο χρήστης διάβαζε «0» και καταλάβαινε «δεν υπήρχε τίποτα να τραβήξω»,
    // ενώ η αλήθεια ήταν «απέτυχε». Η σφραγίδα κρατιόταν και στο localStorage,
    // οπότε το ψέμα επιβίωνε και μετά την ανανέωση της σελίδας.
    let n=0, failed=false
    try{ n=await syncOne(k) }
    catch{
      failed=true
      notifyError('Ο συγχρονισμός δεν ολοκληρώθηκε. Δοκίμασε ξανά· τα στοιχεία ξαναχτίζονται από την πηγή τους.')
    }
    finally{
      if(!failed){
        const stamp=new Date().toLocaleString('el-GR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})
        setDone(d=>({...d,[k]:{n,at:stamp}}))
        setLastSync(stamp); try{ localStorage.setItem(`cal_sync_${propertyId}`,stamp) }catch{}
      }
      setBusy(null); onRefresh()
    }
  }

  const modeHint=mode==='short_term'?'Βραχυχρόνια μίσθωση, τραβάω τις κρατήσεις με το όνομα του επισκέπτη.'
    :mode==='long_term'?'Μακροχρόνια μίσθωση, τραβάω την είσπραξη ενοικίου και τις λήξεις.'
    :'Τραβάω αυτόματα ό,τι αφορά αυτό το ακίνητο.'

  const hasTax=(counts?.tax||0)>0
  return (
    <div style={{ position:'relative', background:'linear-gradient(180deg, var(--bg-elevated) 0%, var(--bg-surface) 100%)', border:'1px solid var(--border-subtle)', borderRadius: T.radius.modal, padding:'20px 22px', boxShadow:'var(--highlight-inset), var(--elev-3)', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:0, left:24, right:24, height:1, background:'linear-gradient(90deg, transparent, var(--accent-border), transparent)', opacity:0.7 }}/>
      {onClose&&<CloseButton onClose={onClose} style={{ position:'absolute', top:14, right:14, border:'1px solid var(--border-subtle)', background:'var(--bg-surface)', zIndex:2 }} />}
      <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:16, paddingRight:38 }}>
        <span style={{ display:'flex', alignItems:'center', justifyContent:'center', width:38, height:38, borderRadius:10, flexShrink:0, background:'linear-gradient(135deg, var(--accent), var(--accent-hover))', color:'var(--accent-text)', boxShadow:'0 6px 16px -6px var(--accent)' }}><RefreshCw size={17}/></span>
        <div style={{ minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <p style={{ fontSize:16, fontFamily: T.font.sans, fontWeight:700, color:'var(--text-primary)', letterSpacing:'0.1px' }}>Έξυπνος συγχρονισμός</p>
            {mode&&<span style={{ fontSize: 'var(--fs-xs)', fontWeight:700, letterSpacing:'0.05em', textTransform:'uppercase', color:'var(--accent)', background:'var(--accent-soft)', border:'1px solid var(--accent-border)', borderRadius: T.radius.modal, padding:'2px 9px', fontFamily: T.font.sans }}>{mode==='short_term'?'Βραχυχρόνια':'Μακροχρόνια'}</span>}
          </div>
          <p style={{ fontSize: 'var(--fs-base)', color:'var(--text-secondary)', fontFamily: T.font.sans, marginTop:4, lineHeight:1.45 }}>{modeHint} Πάτησε μια πηγή για να την τραβήξεις.</p>
          {lastSync&&<p style={{ fontSize:12, color:'var(--text-tertiary)', fontFamily: T.font.sans, marginTop:4 }}>Τελευταίος συγχρονισμός: {lastSync}</p>}
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(min(100%, 210px), 1fr))', gap:10 }}>
        {visible.map(k=>{
          const c=counts?.[k]; const has=(c||0)>0; const meta=META[k]
          const isBusy=busy===k; const d=done[k]; const disabled=!has||(busy!==null&&!isBusy)
          return (
            <button key={k} onClick={()=>has&&runOne(k)} disabled={disabled} style={{ display:'flex', alignItems:'center', gap: 12, padding:'13px 15px', background:isBusy?'color-mix(in srgb, var(--accent) 9%, var(--bg-surface))':'var(--bg-surface)', border:`1px solid ${isBusy?'var(--accent-border)':'var(--border-subtle)'}`, borderRadius: T.radius.popup, cursor:has&&!disabled?'pointer':'default', opacity:has?(disabled&&!isBusy?0.6:1):0.5, textAlign:'left', boxShadow:isBusy?'0 6px 18px -12px var(--accent)':'var(--elev-1)', transition:'transform 0.14s, box-shadow 0.14s, border-color 0.14s, background 0.14s' }} onMouseEnter={e=>{if(has&&!disabled){e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='var(--elev-2)';e.currentTarget.style.borderColor='var(--accent-border)'}}} onMouseLeave={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow=isBusy?'0 6px 18px -12px var(--accent)':'var(--elev-1)';e.currentTarget.style.borderColor=isBusy?'var(--accent-border)':'var(--border-subtle)'}}>
              <span style={{ display:'flex', alignItems:'center', justifyContent:'center', width:36, height:36, borderRadius:10, flexShrink:0, background:isBusy?'linear-gradient(135deg, var(--accent), var(--accent-hover))':'var(--bg-elevated)', color:isBusy?'var(--accent-text)':'var(--text-tertiary)', border:isBusy?'none':'1px solid var(--border-subtle)', boxShadow:isBusy?'0 4px 12px -6px var(--accent)':'none' }}>{isBusy?<RefreshCw size={16} style={{ animation:'spin 1s linear infinite' }}/>:meta.icon}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ fontSize:14, fontFamily: T.font.sans, fontWeight:600, color:isBusy?'var(--accent)':'var(--text-primary)' }}>{meta.label}</p>
                <p className="po-subline" style={{ fontSize:12, color:d?'var(--positive)':'var(--text-tertiary)', fontFamily: T.font.sans }}>{isBusy?'Συγχρονισμός…':d?`Ενημερώθηκε · ${d.n}`:counts===null?'…':has?meta.unit(c!):meta.empty}</p>
              </div>
              {has&&!isBusy&&(d?<Check size={17} style={{ color:'var(--positive)', flexShrink:0 }}/>:<RefreshCw size={15} style={{ color:'var(--text-tertiary)', flexShrink:0 }}/>)}
            </button>
          )
        })}
      </div>
      {/* ΜΙΑ ΓΡΑΜΜΗ ΠΟΥ ΑΠΑΝΤΑ ΣΤΗΝ ΕΡΩΤΗΣΗ ΠΡΙΝ ΓΙΝΕΙ. Το θαμπό πλακίδιο είναι
          σύμβαση διεπαφής («δεν πατιέται»), όχι εξήγηση. Χωρίς αυτήν τη γραμμή ο
          χρήστης βλέπει τρία σβηστά κουτιά και συμπεραίνει ότι κάτι έσπασε. */}
      {counts!==null&&visible.some(k=>(counts[k]||0)===0)&&(
        <p style={{ marginTop:12, fontSize:12, color:'var(--text-tertiary)', fontFamily: T.font.sans, lineHeight:1.5 }}>
          Οι θαμπές πηγές δεν έχουν ακόμη δεδομένα να τραβήξουν. Μόλις καταχωρήσεις την πρώτη εγγραφή, ανάβουν μόνες τους.
        </p>
      )}
      {hasTax&&(
        <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', marginTop:12, fontSize:12, color:'var(--text-tertiary)', fontFamily: T.font.sans }}>
          <Info size={13} style={{ color:'var(--accent)' }}/>
          Οι φορολογικές προθεσμίες βασίζονται στο πλαίσιο της ΑΑΔΕ (έκδοση, πρώτη και τελευταία δόση). Διπλός έλεγχος:
          <a href={AADE_CALENDAR_URL} target="_blank" rel="noreferrer" style={{ color:'var(--accent)', textDecoration:'none' }}>myAADE</a>·
          <a href={TAXHEAVEN_CALENDAR_URL} target="_blank" rel="noreferrer" style={{ color:'var(--accent)', textDecoration:'none' }}>taxheaven</a>
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
