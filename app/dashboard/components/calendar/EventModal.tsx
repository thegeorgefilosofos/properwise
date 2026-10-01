'use client'
// ═══════════════════════════════════════════════════════════════════════════
// Η ΦΟΡΜΑ ΤΟΥ ΓΕΓΟΝΟΤΟΣ ΚΑΙ Η ΕΡΩΤΗΣΗ ΕΜΒΕΛΕΙΑΣ ΓΙΑ ΤΙΣ ΣΕΙΡΕΣ
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { T, Btn, ChipToggle, Modal, fe, localDay, pressable } from '@/components/Theme'
import { fixedCols } from '@/components/tokens'
import { AlertTriangle, FileText, Zap, ChevronDown, Clock, Info, CalendarPlus } from 'lucide-react'
import { DatePicker, CustomSelect, NumberInput } from '../UIComponents'
import { holidayName, isWeekend } from '@/lib/calendar/greekHolidays'
import { parseQuickAdd } from '@/lib/calendar/quickAdd'
import { buildInviteICS, inviteMailto, inviteWhatsApp, inviteViber, canInvite } from '@/lib/calendar/invite'
import { downloadFile } from '@/lib/core/download'
import {
  type EventCategory, type EventPriority, type EventStatus, type FormState, CATEGORIES,
  PRIORITIES, STATUSES, RECURRING_OPTIONS,
} from './model'

// Καθαρός επιλογέας ώρας — αντικαθιστά το άσχημο native <input type="time">.
// Κουμπί με ώρα → portal λίστα ανά 15΄ (κλιπ-άτρωτη, ίδια αισθητική με το app).
function TimeField({ value, onChange }: { value:string; onChange:(v:string)=>void }) {
  const [open,setOpen]=useState(false)
  const [rect,setRect]=useState<{left:number;top:number;width:number}|null>(null)
  const ref=useRef<HTMLButtonElement>(null)
  const listRef=useRef<HTMLDivElement>(null)
  const times=useMemo(()=>{ const t:string[]=[]; for(let h=0;h<24;h++)for(const m of [0,15,30,45])t.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`); return t },[])
  const openMenu=()=>{ const r=ref.current?.getBoundingClientRect(); if(r)setRect({left:r.left,top:r.bottom+6,width:Math.max(r.width,132)}); setOpen(o=>!o) }
  useEffect(()=>{ if(!open)return; const close=(e:MouseEvent)=>{ if(!ref.current?.contains(e.target as Node)&&!listRef.current?.contains(e.target as Node))setOpen(false) }; const esc=(e:KeyboardEvent)=>{ if(e.key==='Escape'){e.stopPropagation();setOpen(false)} }; document.addEventListener('mousedown',close); document.addEventListener('keydown',esc,true); return ()=>{ document.removeEventListener('mousedown',close); document.removeEventListener('keydown',esc,true) } },[open])
  useEffect(()=>{ if(open&&listRef.current){ let idx=times.indexOf(value); if(idx<0)idx=36; const el=listRef.current.children[idx+1] as HTMLElement; el?.scrollIntoView({block:'center'}) } },[open,value,times])
  return (
    <>
      <button ref={ref} type="button" onClick={openMenu} style={{ width:'100%', boxSizing:'border-box', height: T.h.lg, background:'var(--bg-surface)', border:'1px solid '+(open?'var(--accent)':'var(--border-subtle)'), borderRadius: T.radius.popup, padding:'0 12px', color:value?'var(--text-primary)':'var(--text-tertiary)', fontSize:14, fontFamily: T.font.sans, fontVariantNumeric:'tabular-nums', outline:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, transition:'border-color 0.15s' }}>
        <span>{value||'--:--'}</span><Clock size={15} style={{ color:'var(--text-tertiary)', flexShrink:0 }}/>
      </button>
      {open&&rect&&createPortal(
        <div ref={listRef} style={{ position:'fixed', left:rect.left, top:rect.top, width:rect.width, maxHeight:244, overflowY:'auto', background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius: T.radius.popup, boxShadow:'var(--elev-3)', padding: 4, zIndex:2000 }}>
          <button className="po-hov-fill" type="button" onClick={()=>{ onChange(''); setOpen(false) }} style={{ display:'block', width:'100%', textAlign:'left', padding:'8px 12px', border:'none', color:'var(--text-tertiary)', fontSize: 'var(--fs-base)', fontFamily: T.font.sans, borderRadius: T.radius.chip, cursor:'pointer' }} >Καμία ώρα</button>
          {times.map(t=>{ const active=t===value; return (
            <button key={t} type="button" onClick={()=>{ onChange(t); setOpen(false) }} style={{ display:'block', width:'100%', textAlign:'left', padding:'8px 12px', border:'none', background:active?'var(--accent-soft)':'transparent', color:active?'var(--accent)':'var(--text-primary)', fontSize:14, fontWeight:active?600:400, fontFamily: T.font.sans, fontVariantNumeric:'tabular-nums', borderRadius: T.radius.chip, cursor:'pointer' }} onMouseEnter={e=>{ if(!active)e.currentTarget.style.background='var(--bg-hover)' }} onMouseLeave={e=>{ if(!active)e.currentTarget.style.background='transparent' }}>{t}</button>
          )})}
        </div>,
        document.body
      )}
    </>
  )
}

export function EventModal({ form, setForm, onSave, onClose, editing, saving, conflicts }: {
  form:FormState; setForm:React.Dispatch<React.SetStateAction<FormState>>
  onSave:()=>void; onClose:()=>void; editing:boolean; saving:boolean; conflicts?:number
}) {
  const [showDetails,setShowDetails]=useState(editing)
  // Προσβασιμότητα: Cmd/Ctrl+Enter αποθηκεύει. Το Escape έφυγε από εδώ επειδή
  // το ίδιο το <Modal> το ακούει (useOverlayShell) — δύο listeners στο ίδιο
  // πλήκτρο σήμαινε δύο κλήσεις onClose στο ίδιο πάτημα.
  // Ο ΙΔΙΟΣ ΕΛΕΓΧΟΣ ΜΕ ΤΟ ΚΟΥΜΠΙ. Το κουμπί κλείδωνε όσο έτρεχε το αίτημα, η
  // συντόμευση όχι: δύο γρήγορα Cmd+Enter καταχωρούσαν δύο πανομοιότυπα γεγονότα,
  // και σε νέο γεγονός με ποσό γράφονταν ΚΑΙ δύο δαπάνες. Ο πραγματικός φρουρός
  // μπήκε μέσα στο ίδιο το `saveEvent`, ώστε να ισχύει για κάθε δρόμο εισόδου·
  // εδώ μένει ο ίδιος έλεγχος για να μη φαίνεται καν να δέχεται το πάτημα.
  useEffect(()=>{ const h=(e:KeyboardEvent)=>{ if((e.metaKey||e.ctrlKey)&&e.key==='Enter'&&!saving&&form.title.trim()&&form.event_date)onSave() }; document.addEventListener('keydown',h); return ()=>document.removeEventListener('keydown',h) },[onSave,saving,form.title,form.event_date])
  // ── Η ΕΣΤΙΑΣΗ ΣΤΟΝ ΤΙΤΛΟ, ΠΙΣΩ ────────────────────────────────────────────
  // Το `autoFocus` του πεδίου όντως δεν έκανε τίποτα μέσα στο <Modal>: το
  // πλαίσιο εστιάζει τον εαυτό του σε effect, που τρέχει ΜΕΤΑ το autoFocus.
  // Το συμπέρασμα όμως ήταν λάθος — δεν έφταιγε η εστίαση στον τίτλο, έφταιγε
  // ο ΤΡΟΠΟΣ. Χωρίς αυτήν, «Νέο γεγονός» ανοίγει με τον δρομέα πουθενά και ο
  // χρήστης πρέπει να πατήσει στο πεδίο πριν γράψει — και η γρήγορη καταχώρηση
  // (parseQuickAdd) στηρίζεται ακριβώς στο να αρχίσεις να πληκτρολογείς αμέσως.
  // Ως effect του ΓΟΝΕΑ τρέχει μετά τα effects του παιδιού <Modal>, οπότε
  // κερδίζει την εστίαση αντί να τη χάνει. Ο διάλογος έχει ούτως ή άλλως
  // role="dialog" + aria-label, άρα ο αναγνώστης οθόνης ανακοινώνει και τα δύο.
  const titleRef=useRef<HTMLInputElement>(null)
  useEffect(()=>{ titleRef.current?.focus() },[])
  // Ενιαία, καθαρά πεδία — ίδιο ύψος/καμπύλη/χρώμα παντού (Google λογική).
  const fld: React.CSSProperties = { width:'100%', boxSizing:'border-box', height:T.h.lg, background:'var(--bg-surface)', border:'1px solid var(--border-control)', borderRadius: T.radius.xs, padding:'0 16px', color:'var(--text-primary)', fontSize:14, fontFamily: T.font.sans, outline:'none', transition:'border-color 0.15s' }
  const focus=(e:React.FocusEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>)=>e.currentTarget.style.borderColor='var(--accent)'
  const blur=(e:React.FocusEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>)=>e.currentTarget.style.borderColor='var(--border-default)'
  // Το βέλος-εικόνα και το στυλ του ντόπιου <select> έφυγαν μαζί με τα ίδια τα
  // <select>: ήταν καρφωμένο γκρι που δεν άλλαζε ποτέ με το θέμα, δίπλα σε
  // λίστα επιλογών που τη ζωγράφιζε το λειτουργικό με δικά του χρώματα.
  const lbl: React.CSSProperties = { fontFamily: T.font.sans, fontSize: 'var(--fs-xs)', fontWeight:600, letterSpacing:'0.05em', textTransform:'uppercase', color:'var(--text-secondary)', display:'block', marginBottom:6 }
  const amt=parseFloat(form.amount)
  const canSave=!!form.title.trim()&&!!form.event_date
  return (
    <Modal open onClose={onClose} title={editing?'Επεξεργασία':'Νέο γεγονός'} size="sm" footer={<>
      <Btn size="lg" onClick={onClose}>Ακύρωση</Btn>
      {/* Τα γραμμένα γκρίζα χρώματα του «δεν μπορεί να αποθηκευτεί» είναι το `disabled` του Btn. */}
      <Btn variant="primary" size="lg" onClick={onSave} disabled={saving||!canSave}>
        {saving?'Αποθήκευση…':editing?'Αποθήκευση':'Προσθήκη'}
      </Btn>
    </>}>
      {/* Τίτλος + έξυπνη ανάγνωση φυσικής γλώσσας (quick-add) */}
      <div>
        {/* Ήταν το μόνο πεδίο ΧΩΡΙΣ ετικέτα: το τι ζητούσε το έλεγε μόνο το
            κείμενο-υπόδειγμα, που εξαφανίζεται με το πρώτο γράμμα. Και το
            υπόδειγμα έγραφε «Service λέβητα Παρασκευή 10πμ»: μία αγγλική
            λέξη και μία συντομογραφία ώρας, σε ελληνική εφαρμογή. */}
        <label style={lbl}>Τίτλος</label>
        {/* Η εστίαση με το άνοιγμα δίνεται από το effect του `titleRef` πιο πάνω,
            όχι με `autoFocus` (το <Modal> την έπαιρνε πίσω). Το ύψος 48 έγινε
            T.h.lg — ήταν το μοναδικό χειριστήριο του παραθύρου εκτός κλίμακας·
            η έμφαση του τίτλου μένει στα 16/500, δηλαδή σε μέγεθος και βάρος. */}
        <input ref={titleRef} value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} onFocus={focus} onBlur={blur} placeholder="Συντήρηση λέβητα, Παρασκευή 10:00" style={{...fld, fontSize:16, fontWeight:500}}/>
        {(()=>{ if(editing)return null; const qa=parseQuickAdd(form.title, new Date()); const hasExtra=!!(qa.date||qa.time)&&(qa.date!==form.event_date||qa.time!==(form.event_time||null)||qa.title!==form.title); if(!hasExtra)return null
          const dLbl=qa.date?localDay(qa.date).toLocaleDateString('el-GR',{weekday:'short',day:'numeric',month:'short'}):''
          return (
            <button onClick={()=>setForm(f=>({...f,title:qa.title,event_date:qa.date||f.event_date,event_time:qa.time||f.event_time}))} style={{ display:'flex', alignItems:'center', gap: 8, marginTop:8, padding:'7px 12px', borderRadius:10, border:'1px solid var(--accent-border)', background:'var(--accent-soft)', color:'var(--accent)', fontSize: 'var(--fs-base)', fontWeight:500, cursor:'pointer', fontFamily: T.font.sans, width:'100%', textAlign:'left' }}>
              <Zap size={13}/>Ορισμός: {[dLbl,qa.time].filter(Boolean).join(' · ')}, «{qa.title}»
            </button>
          )
        })()}
      </div>

      {/* Ημερομηνία + Ώρα */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 130px', gap:10 }}>
        <div>
          <label style={lbl}>Ημερομηνία</label>
          <DatePicker value={form.event_date} onChange={v=>setForm(f=>({...f,event_date:v}))}/>
        </div>
        <div>
          <label style={lbl}>Ώρα</label>
          <TimeField value={form.event_time} onChange={v=>setForm(f=>({...f,event_time:v}))}/>
        </div>
      </div>

      {/* Έξυπνες ενδείξεις: αργία/ΣΚ + σύγκρουση */}
      {form.event_date&&(holidayName(form.event_date)||isWeekend(form.event_date))&&(
        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--accent)', fontFamily: T.font.sans, marginTop:-4 }}>
          <Info size={13}/>{holidayName(form.event_date)?`Αργία: ${holidayName(form.event_date)}`:'Σαββατοκύριακο'}
        </div>
      )}
      {form.event_time&&!!conflicts&&conflicts>0&&(
        <div style={{ display:'flex', alignItems:'center', gap: 8, fontSize: 'var(--fs-base)', color:'var(--warning)', background:'var(--warning-dim)', border:'1px solid var(--warning-border)', borderRadius:10, padding:'8px 12px', fontFamily: T.font.sans }}>
          <AlertTriangle size={14}/>Έχεις ήδη {conflicts===1?'ένα γεγονός':`${conflicts} γεγονότα`} εκείνη την ώρα.
        </div>
      )}
      {/* Λεπτομέρειες (progressive) */}
      <button onClick={()=>setShowDetails(s=>!s)} style={{ display:'flex', alignItems:'center', gap:6, alignSelf:'flex-start', background:'none', border:'none', cursor:'pointer', color:'var(--text-secondary)', fontSize: 'var(--fs-base)', fontWeight:500, fontFamily: T.font.sans, padding:'2px 0' }}>
        <ChevronDown size={15} style={{ transform:showDetails?'rotate(180deg)':'none', transition:'transform 0.2s' }}/>{showDetails?'Λιγότερα':'Λεπτομέρειες'}
      </button>

      {showDetails&&(<>
        {/* ── ΜΙΑ ΣΕΙΡΑ, ΟΧΙ ΔΥΟ, ΚΑΙ ΜΙΑ ΕΤΙΚΕΤΑ, ΟΧΙ ΔΥΟ ──────────────────────
            Ηταν δύο πλέγματα των δύο στηλών, οπότε το «Ποσό» έπεφτε μόνο του σε
            δεύτερη σειρά ενώ δίπλα του έμενε κενό. Και οι ετικέτες ήταν σε δύο
            ιδιώματα, κολλητά η μία στην άλλη: «Κατηγορία» πεζά από το
            CustomSelect, «ΠΟΣΟ ΣΕ ΕΥΡΩ» κεφαλαία από τοπικό στιλ αυτού του
            αρχείου. Το πεδίο ποσού είναι πλέον το κοινό NumberInput, με το «€»
            μέσα του — άρα η ετικέτα δεν χρειάζεται να το πει.

            Το πλέγμα είναι το κοινό `fixedCols` των tokens, όχι δικό μου
            `minmax`: τρεις στήλες στο παράθυρο, μία σε κινητό, με τον ίδιο
            κανόνα που ακολουθεί κάθε άλλη φόρμα της εφαρμογής. */}
        <div {...fixedCols(3, 10)}>
          <CustomSelect label="Κατηγορία" value={form.category} onChange={v=>setForm(f=>({...f,category:v as EventCategory}))}
            options={Object.entries(CATEGORIES).map(([k,v])=>({ value:k, label:v.label }))}/>
          <CustomSelect label="Προτεραιότητα" value={form.priority} onChange={v=>setForm(f=>({...f,priority:v as EventPriority}))}
            options={Object.entries(PRIORITIES).map(([k,v])=>({ value:k, label:v.label }))}/>
          <NumberInput label="Ποσό" value={form.amount} onChange={v=>setForm(f=>({...f,amount:v}))} suffix="€"/>
          {form.event_time&&(
            <CustomSelect label="Διάρκεια" value={form.duration} onChange={v=>setForm(f=>({...f,duration:v}))} placeholder="Χωρίς διάρκεια"
              options={[{value:'',label:'Χωρίς διάρκεια'},{value:'30',label:'30 λεπτά'},{value:'60',label:'1 ώρα'},{value:'90',label:'1 ώρα 30 λεπτά'},{value:'120',label:'2 ώρες'},{value:'180',label:'3 ώρες'}]}/>
          )}
        </div>
        {/* Κύκλωμα: κόστος → δαπάνη */}
        {amt>0&&!editing&&(
          <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', padding:'10px 12px', borderRadius:10, background:form.add_expense?'var(--accent-soft)':'var(--bg-surface)', border:'1px solid '+(form.add_expense?'var(--accent-border)':'var(--border-subtle)'), transition: 'background-color 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s, transform 0.15s, opacity 0.15s' }}>
            <input type="checkbox" checked={form.add_expense} onChange={e=>setForm(f=>({...f,add_expense:e.target.checked}))} style={{ width:16, height:16, accentColor:'var(--accent)', cursor:'pointer' }}/>
            <span style={{ fontSize: 'var(--fs-base)', color:'var(--text-primary)', fontFamily: T.font.sans }}>Καταχώρησέ το και στις <strong>Δαπάνες</strong> και στον <strong>Προϋπολογισμό</strong> ({fe(amt)})</span>
          </label>
        )}
        {/* Επικοινωνία */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <div>
            <label style={lbl}>Τηλέφωνο</label>
            <input type="tel" style={fld} placeholder="6912345678" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} onFocus={focus} onBlur={blur}/>
          </div>
          <div>
            <label style={lbl}>Ηλεκτρονική διεύθυνση</label>
            <input type="email" style={fld} placeholder="onoma@etaireia.gr" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} onFocus={focus} onBlur={blur}/>
          </div>
        </div>
        {/* Πρόσκληση συμμετέχοντα — στέλνει invite (.ics/mailto/WhatsApp/Viber) στην επαφή */}
        {(()=>{ if(!form.title.trim()||!form.event_date)return null
          const inv={title:form.title,date:form.event_date,time:form.event_time||undefined,durationMinutes:form.duration?+form.duration:undefined,details:form.notes||undefined,attendeeEmail:form.email||undefined,attendeePhone:form.phone||undefined}
          const cap=canInvite(inv); if(!cap.email&&!cap.phone)return null
          return (
            <div>
              <label style={lbl}>Πρόσκληση</label>
              {/* Τα τρία πρώτα είναι προορισμοί, άρα `href` και όχι onClick: το Btn τα κάνει <a> με την ίδια όψη. */}
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {cap.email&&<Btn href={inviteMailto(inv)}><FileText size={13}/>Με μήνυμα</Btn>}
                {cap.phone&&<Btn href={inviteWhatsApp(inv)} newTab>WhatsApp</Btn>}
                {cap.phone&&<Btn href={inviteViber(inv)}>Viber</Btn>}
                <Btn onClick={()=>downloadFile(buildInviteICS(inv), 'πρόσκληση.ics', 'text/calendar;charset=utf-8')}><CalendarPlus size={13}/>Αρχείο ημερολογίου</Btn>
              </div>
            </div>
          )
        })()}
        <div>
          <label style={lbl}>Σύνδεσμος τιμολογίου ή σύμβασης</label>
          <input style={fld} placeholder="https://…" value={form.attachment_url} onChange={e=>setForm(f=>({...f,attachment_url:e.target.value}))} onFocus={focus} onBlur={blur}/>
        </div>
        {/* Κατάσταση */}
        <div>
          <label style={lbl}>Κατάσταση</label>
          {/* ΤΕΣΣΕΡΑ ΤΣΙΠΑΚΙΑ ΠΟΥ ΕΒΓΑΙΝΑΝ 3+1. Το «Ακυρώθηκε» έπεφτε μόνο του σε
              δεύτερη γραμμή με τρύπα δεξιά, σε ταμπλέτα και σε κινητό. Η σειρά
              απλώνεται τώρα ολόκληρη — μία επιλογή δεν διαβάζεται ως υποσύνολο
              άλλης επειδή έτυχε να τυλιχτεί. */}
          <div className="po-ctlrow ctl-2up">
            {/* Η επιλεγμένη κατάσταση βαφόταν με το ΣΗΜΑΣΙΟΛΟΓΙΚΟ χρώμα της:
                πορτοκαλί το «Εκκρεμεί», πράσινο το «Πληρώθηκε», κόκκινο το
                «Ακυρώθηκε». Δηλαδή η φόρμα έβγαζε ετυμηγορία για μια επιλογή
                που μόλις έκανε ο χρήστης και το «Εκκρεμεί» —η προεπιλογή
                κάθε νέου γεγονότος— άνοιγε πάντα με προειδοποιητικό χρώμα.
                Η επιλογή δείχνει ΕΠΙΛΟΓΗ, με το χρώμα της επιλογής. */}
            {Object.entries(STATUSES).map(([k,v])=>(
              <ChipToggle key={k} on={form.status===k} onClick={()=>setForm(f=>({...f,status:k as EventStatus}))}>{v.label}</ChipToggle>
            ))}
          </div>
        </div>
        {/* Επανάληψη */}
        <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', borderRadius:T.radius.card, padding:'12px 14px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontFamily: T.font.sans, fontSize:14, fontWeight:500, color:'var(--text-primary)' }}>Επαναλαμβανόμενο</span>
            <div {...pressable(()=>setForm(f=>({...f,recurring:!f.recurring})))} style={{ width:46, height:28, borderRadius: T.radius.card, background:form.recurring?'var(--accent)':'var(--border-default)', position:'relative', transition: 'background-color 0.2s, border-color 0.2s, color 0.2s, box-shadow 0.2s, transform 0.2s, opacity 0.2s', cursor:'pointer', flexShrink:0 }}>
              <span style={{ position:'absolute', top:2, left:form.recurring?'calc(100% - 26px)':2, width:24, height:24, borderRadius:'50%', background:'var(--bg-surface)', transition: 'background-color 0.2s, border-color 0.2s, color 0.2s, box-shadow 0.2s, transform 0.2s, opacity 0.2s', boxShadow:'var(--elev-1)' }}/>
            </div>
          </div>
          {form.recurring&&(
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:12 }}>
              <CustomSelect ariaLabel="Συχνότητα επανάληψης" value={form.recurring_interval} onChange={v=>setForm(f=>({...f,recurring_interval:v}))} options={RECURRING_OPTIONS.map(o=>({ value:o.value, label:o.label }))}/>
              <CustomSelect ariaLabel="Λήξη επανάληψης" value={form.recurrence_end_mode} onChange={v=>setForm(f=>({...f,recurrence_end_mode:v as FormState['recurrence_end_mode']}))}
                options={[{value:'none',label:'Χωρίς λήξη'},{value:'until',label:'Μέχρι ημερομηνία'},{value:'count',label:'Για πλήθος φορών'}]}/>
              {form.recurrence_end_mode==='until'&&<div style={{ gridColumn:'1 / -1' }}><DatePicker value={form.recurrence_until} onChange={v=>setForm(f=>({...f,recurrence_until:v}))}/></div>}
              {form.recurrence_end_mode==='count'&&<div style={{ gridColumn:'1 / -1' }}><input type="number" min="1" style={fld} placeholder="12 φορές" value={form.recurrence_count} onChange={e=>setForm(f=>({...f,recurrence_count:e.target.value}))} onFocus={focus} onBlur={blur}/></div>}
            </div>
          )}
        </div>
        {/* Σημειώσεις */}
        <div>
          <label style={lbl}>Σημειώσεις</label>
          <textarea style={{...fld, height:'auto', minHeight:60, padding:'10px 14px', resize:'vertical'}} placeholder="Οδηγίες, αριθμός λογαριασμού…" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} onFocus={focus} onBlur={blur}/>
        </div>
      </>)}
    </Modal>
  )
}

// Επιλογή εμβέλειας για επαναλαμβανόμενο (επεξεργασία ή διαγραφή).
//
// ΓΙΑΤΙ Modal ΚΑΙ ΟΧΙ confirmDialog: οι απαντήσεις είναι ΤΡΕΙΣ, όχι δύο —
// «μόνο αυτό», «αυτό και τα επόμενα», «όλη τη σειρά». Το confirmDialog ξέρει
// μόνο ναι/όχι· να το στριμώξουμε εδώ σημαίνει δύο διαδοχικές ερωτήσεις για
// μία απόφαση.
//
// ΤΟ zIndex 1100 ΕΦΥΓΕ ΚΑΙ ΔΕΝ ΛΕΙΠΕΙ — αλλά ούτε και η στοίβαξη χρειάζεται:
// τα δύο παράθυρα ΔΕΝ είναι πια ανοιχτά μαζί (δες τη συνθήκη `!scopePrompt`
// στο σημείο που αποδίδεται το EventModal). Το παράθυρο εμβέλειας ρωτά μία
// αυτοτελή ερώτηση για τις αλλαγές που μόλις έγιναν· η φόρμα από κάτω δεν
// προσθέτει τίποτα και δύο <Modal> μαζί έσπαγαν δύο πράγματα ταυτόχρονα:
// το Escape έκλεινε ΚΑΙ τα δύο (χαμένες αλλαγές) και το κλείδωμα κύλισης
// του useOverlayShell δεν είναι μετρημένο — στο κοινό ξεμοντάρισμα η σειρά
// επαναφοράς άφηνε `.app-content` και `body` κολλημένα σε overflow:hidden.
export function ScopeModal({ title, hint, danger, onPick, onClose }: { title:string; hint?:string; danger?:boolean; onPick:(s:'this'|'following'|'all')=>void; onClose:()=>void }) {
  const opts:[('this'|'following'|'all'),string][]=[['this','Μόνο αυτό το γεγονός'],['following','Αυτό και τα επόμενα'],['all','Όλη τη σειρά']]
  return (
    <Modal open onClose={onClose} title={title} subtitle={hint} size="sm"
      /* ghost και όχι secondary: αυτό το «Ακύρωση» ήταν εξαρχής χωρίς περίγραμμα. */
      footer={<Btn variant="ghost" size="lg" onClick={onClose}>Ακύρωση</Btn>}>
      <div style={{ display:'flex', flexDirection:'column', gap:T.sp.sm }}>
        {opts.map(([v,label])=>(
          <button key={v} onClick={()=>onPick(v)} style={{ display:'flex', alignItems:'center', gap:10, height:T.h.lg, padding:'0 16px', borderRadius:T.radius.btn, border:'1px solid var(--border-subtle)', background:'var(--bg-surface)', cursor:'pointer', fontSize:14, fontWeight:500, color:danger&&v==='all'?'var(--negative)':'var(--text-primary)', fontFamily: T.font.sans, textAlign:'left', transition: 'background-color 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s, transform 0.15s, opacity 0.15s' }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=danger&&v==='all'?'var(--negative)':'var(--accent)';e.currentTarget.style.background='var(--bg-elevated)'}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border-subtle)';e.currentTarget.style.background='var(--bg-surface)'}}>{label}</button>
        ))}
      </div>
    </Modal>
  )
}
