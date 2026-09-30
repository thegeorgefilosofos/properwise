'use client'
// ═══════════════════════════════════════════════════════════════════════════
// Η ΚΑΡΤΑ ΤΟΥ ΓΕΓΟΝΟΤΟΣ ΚΑΙ ΟΙ ΕΝΟΤΗΤΕΣ ΤΗΣ ΑΤΖΕΝΤΑΣ
// ─────────────────────────────────────────────────────────────────────────
// Η κάρτα ενός γεγονότος, το μενού «Πρόσθεσε στο ημερολόγιό σου», η κάρτα
// μιας επαναλαμβανόμενης σειράς και η ενότητα που τις ομαδοποιεί.
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { T, Chip, feAuto, fe } from '@/components/Theme'
import {
  Calendar, Check, Download, ChevronDown, Edit2, Trash2, RotateCcw, ArrowRight, MoreHorizontal,
  Share2, Repeat,
} from 'lucide-react'
import { allCalendarLinks, buildICS } from '@/lib/calendar/externalLinks'
import { groupSeries, rowCount, type SeriesRow } from '@/lib/calendar/series'
import { taxKindOfEventSource, taxObligationOfEventSource, CONFIDENCE_LABEL, CONFIDENCE_HINT } from '@/lib/tax/greekTaxCalendar'
import { WHO_LABEL } from '@/lib/accounting/dossier'
import { downloadFile } from '@/lib/core/download'
import { type CalEvent, CATEGORIES, TAX_META, fmt, fmtShort, daysUntil, isOverdue } from './model'
import { Tooltip, StatusDot } from './Bits'

// Μετατροπή γεγονότος σε είσοδο για τους συνδέσμους εξωτερικών ημερολογίων.
function toCalInput(e: CalEvent) {
  const cat = CATEGORIES[e.category]?.label || ''
  const details = [e.notes||'', e.amount?`Ποσό: ${fe(e.amount)}`:''].filter(Boolean).join(' · ')
  return { title: (cat?`${cat}: `:'')+e.title, date: e.event_date, time: e.event_time||undefined, durationMinutes: e.duration_minutes||undefined, details }
}
function downloadEventIcs(e: CalEvent) {
  downloadFile(buildICS(toCalInput(e)), `${e.title.slice(0,40)||'γεγονός'}.ics`, 'text/calendar;charset=utf-8')
}

// «Πρόσθεσε σε ημερολόγιο» + «Κοινοποίηση» — ένα διακριτικό μενού, portal ώστε να
// μη κόβεται. Καλύπτει Google / Outlook / Office 365 / Apple(.ics) / Yahoo και
// κοινοποίηση σε WhatsApp / Viber. Καθαροί σύνδεσμοι, χωρίς backend.
function AddToCalendarMenu({ event, onEdit, onDelete, onOpenChange }: { event: CalEvent; onEdit?:(e:CalEvent)=>void; onDelete?:(id:string)=>void; onOpenChange?:(open:boolean)=>void }) {
  const [open,setOpen]=useState(false)
  const btnRef=useRef<HTMLButtonElement>(null)
  const popRef=useRef<HTMLDivElement>(null)
  const [pos,setPos]=useState({top:0,left:0,maxH:440,up:false})
  const setOpenX=setOpen
  // Ειδοποίηση γονέα εκτός φάσης render (όχι μέσα στον updater) — αποφυγή warning/StrictMode διπλο-κλήσης.
  useEffect(()=>{ onOpenChange?.(open) },[open,onOpenChange])
  // Τοποθέτηση με επίγνωση viewport: διάλεξε την πλευρά (κάτω/πάνω) με τον
  // περισσότερο χώρο και όρισε maxHeight ίσο με τον διαθέσιμο χώρο, ώστε το μενού
  // να ΧΩΡΑΕΙ ΠΑΝΤΑ στην οθόνη και να κάνει εσωτερικό scroll αν δεν φτάνει.
  const reposition=()=>{
    if(!btnRef.current)return;
    const r=btnRef.current.getBoundingClientRect();
    const W=232, M=8, GAP=6, DESIRED=440;
    const left=Math.max(M, Math.min(r.left, window.innerWidth-W-M));
    const spaceBelow=window.innerHeight - r.bottom - M;
    const spaceAbove=r.top - M;
    const up = spaceBelow < DESIRED && spaceAbove > spaceBelow;
    const avail = up ? spaceAbove : spaceBelow;
    const maxH = Math.max(140, Math.min(avail - GAP, DESIRED));
    setPos({ top: up ? r.top - GAP : r.bottom + GAP, left, maxH, up });
  }
  useEffect(()=>{ if(!open)return; reposition(); const h=(ev:MouseEvent)=>{const t=ev.target as Node; if(btnRef.current&&!btnRef.current.contains(t)&&popRef.current&&!popRef.current.contains(t))setOpenX(false)}; const s=()=>reposition(); document.addEventListener('mousedown',h); window.addEventListener('scroll',s,true); window.addEventListener('resize',s); return ()=>{document.removeEventListener('mousedown',h); window.removeEventListener('scroll',s,true); window.removeEventListener('resize',s)} },[open,setOpenX])
  const links=allCalendarLinks(toCalInput(event))
  const row=(label:string,onClick:()=>void,icon:React.ReactNode,danger?:boolean)=>(
    <button key={label} type="button" onClick={()=>{onClick();setOpenX(false)}} style={{ display:'flex',alignItems:'center',gap:10,width:'100%',padding:'9px 12px',border:'none',background:'transparent',cursor:'pointer',textAlign:'left',color:'var(--text-primary)',fontSize: 'var(--fs-base)',fontFamily: T.font.sans,borderRadius: T.radius.chip,transition:'background 0.12s, color 0.12s' }} onMouseEnter={e=>{e.currentTarget.style.background=danger?'var(--negative-dim)':'var(--bg-hover)';if(danger)e.currentTarget.style.color='var(--negative)'}} onMouseLeave={e=>{e.currentTarget.style.background='transparent';if(danger)e.currentTarget.style.color='var(--text-primary)'}}>
      <span style={{ color:danger?'inherit':'var(--text-tertiary)',display:'flex',flexShrink:0 }}>{icon}</span>{label}
    </button>
  )
  const openExt=(href:string)=>window.open(href,'_blank','noopener,noreferrer')
  return (
    <>
      <button ref={btnRef} type="button" aria-label="Ενέργειες" title="Ενέργειες" onClick={e=>{e.stopPropagation();setOpenX(o=>!o)}}
        style={{ display:'flex',alignItems:'center',justifyContent:'center',width:30,height:30,borderRadius:'50%',border:'1px solid '+(open?'var(--border-default)':'transparent'),background:open?'var(--bg-elevated)':'transparent',cursor:'pointer',color:'var(--text-secondary)',flexShrink:0,transition: 'background-color 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s, transform 0.15s, opacity 0.15s' }}>
        <MoreHorizontal size={16}/>
      </button>
      {open&&createPortal(
        <div ref={popRef} style={{ position:'fixed',top:pos.top,left:pos.left,transform:pos.up?'translateY(-100%)':'none',width:232,maxHeight:pos.maxH,overflowY:'auto',overscrollBehavior:'contain',background:'var(--bg-elevated)',border:'1px solid var(--border-subtle)',borderRadius: T.radius.popup,boxShadow:'var(--elev-3)',padding:6,zIndex:2000 }}>
          <div style={{ fontSize: 'var(--fs-xs)',fontWeight:700,letterSpacing:'0.07em',textTransform:'uppercase',color:'var(--text-tertiary)',padding:'6px 12px 4px',fontFamily: T.font.sans }}>Πρόσθεσε σε ημερολόγιο</div>
          {row('Google Calendar',()=>openExt(links.google),<Calendar size={15}/>)}
          {row('Outlook',()=>openExt(links.outlook),<Calendar size={15}/>)}
          {row('Office 365',()=>openExt(links.office),<Calendar size={15}/>)}
          {row('Apple / λήψη .ics',()=>downloadEventIcs(event),<Download size={15}/>)}
          {row('Yahoo',()=>openExt(links.yahoo),<Calendar size={15}/>)}
          <div style={{ height:1,background:'var(--border-subtle)',margin:'6px 8px' }}/>
          <div style={{ fontSize: 'var(--fs-xs)',fontWeight:700,letterSpacing:'0.07em',textTransform:'uppercase',color:'var(--text-tertiary)',padding:'2px 12px 4px',fontFamily: T.font.sans }}>Κοινοποίηση</div>
          {row('WhatsApp',()=>openExt(links.whatsapp),<Share2 size={15}/>)}
          {row('Viber',()=>openExt(links.viber),<Share2 size={15}/>)}
          {(onEdit||onDelete)&&<div style={{ height:1,background:'var(--border-subtle)',margin:'6px 8px' }}/>}
          {onEdit&&row('Επεξεργασία',()=>onEdit(event),<Edit2 size={15}/>)}
          {onDelete&&row('Διαγραφή',()=>onDelete(event.id),<Trash2 size={15}/>,true)}
        </div>, document.body)}
    </>
  )
}

// ═══ Η ΧΡΟΝΙΑ ΓΡΑΦΕΤΑΙ ΜΙΑ ΦΟΡΑ, ΟΧΙ ΔΕΚΑΕΞΙ ══════════════════════════════════
// Στην προβολή Μήνα ο επιλογέας από πάνω γράφει «Αύγουστος 2026» και κάθε κάρτα
// από κάτω ξανάγραφε ολόκληρη την ημερομηνία, «12/08/2026». Με δεκαπέντε
// γεγονότα, το «2026» εμφανιζόταν δεκαέξι φορές στην ίδια οθόνη — και ήταν
// ΕΓΓΥΗΜΕΝΑ το ίδιο, γιατί το `monthEvents` κόβεται στα όρια του μήνα που
// δείχνει ο επιλογέας.
//
// Στην Ατζέντα η ίδια κάρτα ΧΡΕΙΑΖΕΤΑΙ τη χρονιά: εκεί δεν υπάρχει επιλογέας
// και ο κατάλογος περνά από μήνα σε μήνα. Γι' αυτό το κρίνει ο καλών, με το
// `sameMonth`· δεν το κρίνει η κάρτα μόνη της.
export function EventCard({ event, onToggleStatus, onEdit, onDelete, selected, onSelect, bulkMode, sameMonth }: {
  event: CalEvent; onToggleStatus:(e:CalEvent)=>void; onEdit:(e:CalEvent)=>void
  onDelete:(id:string)=>void; selected?:boolean; onSelect?:(id:string)=>void; bulkMode?:boolean
  /** Ο κατάλογος είναι ήδη κλεισμένος σε έναν μήνα, οπότε η χρονιά περισσεύει. */
  sameMonth?:boolean
}) {
  const overdue = isOverdue(event)
  const done    = event.status==='paid'||event.status==='cancelled'
  const cat     = CATEGORIES[event.category]
  const isAuto  = event.source!=='manual'
  // Φορολογική προθεσμία: το ημερολόγιο ξέρει ΠΟΙΟΣ την κάνει και ΠΟΣΟ σίγουρη
  // είναι η ημερομηνία. Δεν τα κρατά για τον εαυτό του.
  const taxKind = taxKindOfEventSource(event.source)
  // Το έτος του γεγονότος, όχι το τρέχον: η δόση ενός εκδοθέντος ΕΝΦΙΑ είναι «του νόμου».
  const taxInfo = taxKind ? (taxObligationOfEventSource(event.source) ?? TAX_META[taxKind]) : null
  const due     = daysUntil(event.event_date)
  const relLbl = (n:number) => { const a=Math.abs(n); return a===1?'1 ημέρα':`${a} ημέρες` }
  const [menuOpen,setMenuOpen]=useState(false)
  // ═══ ΤΟ ΕΚΠΡΟΘΕΣΜΟ ΔΕΝ ΧΡΕΙΑΖΕΤΑΙ ΚΟΚΚΙΝΟ ══════════════════════════════════
  // Η κάρτα βαφόταν κόκκινη σε περίγραμμα και σε λωρίδα. Με τέσσερα εκπρόθεσμα
  // στη σειρά, η οθόνη γινόταν ένα κόκκινο μπλοκ όπου τίποτα δεν ξεχωρίζει από
  // τίποτα — και το κόκκινο σταματά να σημαίνει κάτι όταν το φοράνε όλοι.
  // Η ίδια οθόνη το λύνει ήδη αλλού με ιεραρχία: πιο έντονη λωρίδα και πιο βαρύ
  // νούμερο ημερών. Ίδια γλώσσα με τη λίστα «τι χρειάζεται τώρα» της Επισκόπησης.
  const accentBar = overdue?'var(--accent)':`color-mix(in srgb, ${cat.color} 50%, transparent)`

  return (
    <div className="cal-ev" style={{ display:'flex', alignItems:'flex-start', gap: 12, padding:'12px 15px',
      background: selected?'var(--accent-dim)':done?'var(--bg-elevated)':'var(--bg-surface)',
      border:`1px solid ${selected?'var(--border-accent)':'var(--border-subtle)'}`,
      borderLeft:`${overdue?4:3}px solid ${accentBar}`,
      borderRadius:10, opacity:done?0.62:1, transition: 'background-color 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s, transform 0.15s, opacity 0.15s', boxShadow:'var(--shadow-sm)',
    }}>
      {bulkMode&&onSelect&&(
        <button aria-label="Επιλογή" aria-pressed={selected} onClick={()=>onSelect(event.id)} style={{ background:'none', border:'none', cursor:'pointer', padding:0, display:'flex', flexShrink:0, marginTop:2 }}>
          <span style={{ width:18, height:18, borderRadius: T.radius.xs, border:`2px solid ${selected?'var(--accent)':'var(--border-default)'}`, background:selected?'var(--accent)':'transparent', display:'flex', alignItems:'center', justifyContent:'center', transition: 'background-color 0.13s, border-color 0.13s, color 0.13s, box-shadow 0.13s, transform 0.13s, opacity 0.13s' }}>
            {selected&&<Check size={12} color="var(--accent-text)" strokeWidth={3}/>}
          </span>
        </button>
      )}
      {/* ΤΟ ΙΔΙΟ ΣΤΡΟΓΓΥΛΟ ΚΟΥΤΑΚΙ, ΔΥΟ ΧΡΩΜΑΤΑ, ΔΥΟ ΚΑΡΤΕΛΕΣ. Στις Εκκρεμότητες
          το κουμπί ολοκλήρωσης άλλαξε από πράσινο σε μπλε, με τον λόγο γραμμένο
          δίπλα του: το πράσινο γινόταν το πιο δυνατό χρώμα της οθόνης και
          μετέτρεπε μια μέτρηση σε επιβράβευση. Το ημερολόγιο δεν πήρε ποτέ την
          ίδια διόρθωση. Το μπλε μένει το χρώμα της πράξης, εδώ και εκεί. */}
      {!bulkMode&&(
        <button className="po-box po-lead-ico" aria-label={done?'Αναίρεση':'Ολοκλήρωση'} onClick={()=>onToggleStatus(event)} style={{ width:18, height:18, borderRadius:'50%', border:`2px solid ${done?'var(--accent)':'var(--border-default)'}`, background:done?'var(--accent)':'transparent', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', transition: 'background-color 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s, transform 0.15s, opacity 0.15s' }}>
          {done&&<Check size={9} color="var(--accent-text)"/>}
        </button>
      )}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap: 8, marginBottom: 4 }}>
          {/* Η ΑΠΟΚΟΠΗ ΕΙΝΑΙ ΑΠΟΦΑΣΗ ΚΑΙ ΓΡΑΦΕΤΑΙ ΩΣ ΤΕΤΟΙΑ. Οι τέσσερις ιδιότητες
              ήταν γραμμένες στο χέρι και έκαναν ΑΚΡΙΒΩΣ ό,τι κάνει το `.po-elide`,
              χωρίς όμως να το δηλώνουν: ο σαρωτής διάταξης ανέφερε στα 320 το
              «Λογαριασμός ΕΥΔΑΠ» ως κομμένο κείμενο, γιατί δεν έχει τρόπο να
              ξεχωρίσει το όνομα που ΔΕΝ έχει ταβάνι μήκους από την ετικέτα που
              απλώς δεν χώρεσε. Η κλάση είναι η δήλωση· οι ιδιότητες ζουν σε
              ένα σημείο (globals.css) αντί για δύο. */}
          <span className="po-elide" style={{ fontFamily: T.font.sans, fontSize:14, fontWeight:500, color:done?'var(--text-tertiary)':'var(--text-primary)', textDecoration:done?'line-through':'none', letterSpacing:'0.1px' }}>
            {event.title}
          </span>
          {event.recurring&&<Tooltip text="Επαναλαμβανόμενο"><RotateCcw size={11} color="var(--text-tertiary)" style={{ flexShrink:0 }}/></Tooltip>}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap: 8, flexWrap:'wrap' }}>
          <span style={{ display:'inline-flex', alignItems:'center', gap: 4 }}>
            <span style={{ width:7, height:7, borderRadius:3, background:cat.color, flexShrink:0 }}/>
            <span style={{ fontSize:12, fontFamily: T.font.sans, color:'var(--text-tertiary)', letterSpacing:'0.3px' }}>{cat.label}</span>
          </span>
          {event.status!=='pending'&&<StatusDot status={event.status}/>}
          {event.amount!=null&&(
            <span style={{ fontSize: 'var(--fs-base)', fontFamily: T.font.sans, fontVariantNumeric:'tabular-nums', color:'var(--text-secondary)', fontWeight:500 }}>
              {feAuto(event.amount)}
            </span>
          )}
          {event.attachment_url&&(
            <a href={event.attachment_url} target="_blank" rel="noreferrer" style={{ fontSize:12, color:'var(--accent)', display:'flex', alignItems:'center', gap:2, fontFamily: T.font.sans }}>
              Σύνδεσμος <ArrowRight size={9}/>
            </a>
          )}
        </div>
        {/* ═══ ΤΡΙΑ ΠΡΑΓΜΑΤΑ, ΤΑ ΔΥΟ ΙΔΙΑ ΣΕ ΚΑΘΕ ΚΑΡΤΑ ══════════════════════
            Κάθε φορολογική προθεσμία κουβαλούσε τρεις ενδείξεις. Η μία —ποιος
            την κάνει— αλλάζει ανά υποχρέωση και μένει. Οι άλλες δύο ήταν οι
            ίδιες σε όλες: μια ολόκληρη προτροπή σε ετικέτα και ένας σύνδεσμος
            προς την ΙΔΙΑ σελίδα της ΑΑΔΕ. Με τέσσερα εκπρόθεσμα στη σειρά, ο
            χρήστης διάβαζε τέσσερις φορές την ίδια πρόταση και έβλεπε τέσσερις
            φορές τον ίδιο σύνδεσμο — που υπάρχει ούτως ή άλλως, μία φορά, στην
            κορδέλα των φορολογικών προθεσμιών πάνω από τη λίστα. */}
        {taxInfo&&(
          <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', marginTop: 8 }}>
            <Chip tone="neutral" title="Ποιος κάνει αυτή τη δουλειά">{WHO_LABEL[taxInfo.who]}</Chip>
            <Chip tone="neutral" title={CONFIDENCE_HINT[taxInfo.confidence]}>
              {CONFIDENCE_LABEL[taxInfo.confidence]}
            </Chip>
          </div>
        )}
      </div>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap: 4, flexShrink:0 }}>
        {/* Το βάρος κάνει τη δουλειά που έκανε το χρώμα: εκπρόθεσμο και σημερινό
            διαβάζονται πιο έντονα, τα υπόλοιπα υποχωρούν. */}
        {/* ΤΟ ΕΚΠΡΟΘΕΣΜΟ ΛΕΓΕΤΑΙ ΜΕ ΤΗ ΛΕΞΗ ΤΟΥ. Εγραφε μόνο «πριν 7 ημέρες»,
            που διαβάζεται και ως απλή ημερομηνία. Η λέξη πάνω, η απόσταση από
            κάτω: σε μία σειρά έκοβε τον τίτλο του γεγονότος στα 390. */}
        {overdue && <span style={{ fontSize:12, fontFamily: T.font.sans, fontWeight:600, color:'var(--text-primary)' }}>Εκπρόθεσμο</span>}
        <span style={{ fontSize:12, fontFamily: T.font.sans, fontVariantNumeric:'tabular-nums', fontWeight:due===0?600:400, color:due===0?'var(--text-primary)':'var(--text-secondary)' }}>
          {overdue?`πριν ${relLbl(due)}`:due===0?'Σήμερα':due===1?'Αύριο':(sameMonth?fmtShort:fmt)(event.event_date)}{event.event_time?` · ${event.event_time}`:''}
        </span>
        {!bulkMode&&(
          /* ΚΡΥΒΕΤΑΙ Η ΟΨΗ, ΟΧΙ Η ΕΝΕΡΓΕΙΑ. Με `opacity: 0` από αιώρηση σε
             JavaScript το κουμπί έπαιρνε Tab και έμενε αόρατο· στην αφή δεν
             φαινόταν ποτέ. Ο κανόνας ζει στην `.cal-ev-act` (globals.css):
             αιώρηση, εστίαση πληκτρολογίου, ανοιχτό μενού, πάντα σε αφή. */
          <div className="cal-ev-act" data-open={menuOpen||undefined} style={{ display:'flex', gap:2, alignItems:'center' }}>
            <AddToCalendarMenu event={event} onEdit={isAuto?undefined:onEdit} onDelete={onDelete} onOpenChange={setMenuOpen}/>
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ΜΙΑ ΣΕΙΡΑ, ΜΙΑ ΓΡΑΜΜΗ
// ─────────────────────────────────────────────────────────────────────────
// Η καρτέλα που εκπροσωπεί ολόκληρο πρόγραμμα δόσεων. Λέει ό,τι θέλει να ξέρει
// κανείς με μια ματιά — τι είναι, πότε είναι η επόμενη, με τι ρυθμό, πόσες
// μένουν και πόσο κάνουν συνολικά — και ανοίγει σε πλήρη ανάλυση με ένα κλικ.
//
// Το ποσό στα δεξιά είναι της ΕΠΟΜΕΝΗΣ δόσης, όχι το σύνολο: αυτό είναι που θα
// φύγει από τον λογαριασμό. Το σύνολο λέγεται με λέξεις από κάτω, ώστε να μη
// μπερδεύεται με το ποσό της γραμμής.
function SeriesCard({ group, onToggle, onEdit, onDelete, bulkMode, selectedIds, onSelect }: {
  group: SeriesRow<CalEvent> & { kind:'series' }
  onToggle:(e:CalEvent)=>void; onEdit:(e:CalEvent)=>void; onDelete:(id:string)=>void
  bulkMode?:boolean; selectedIds?:Set<string>; onSelect?:(id:string)=>void
}) {
  const [open,setOpen]=useState(false)
  const { lead, rest, count, cadence, lastDate, totalAmount } = group
  const cat = CATEGORIES[lead.category]
  return (
    <div style={{ display:'flex', flexDirection:'column', gap: 8 }}>
      <div style={{ display:'flex', alignItems:'center', gap: 12, padding:'12px 15px', background:'var(--bg-surface)',
        border:'1px solid var(--border-subtle)', borderLeft:`3px solid color-mix(in srgb, ${cat.color} 50%, transparent)`,
        borderRadius:10, boxShadow:'var(--shadow-sm)' }}>
        <span title="Επαναλαμβανόμενη σειρά" style={{ flexShrink:0, width:18, height:18, borderRadius:'50%', border:'2px solid var(--border-default)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-tertiary)' }}>
          <Repeat size={9}/>
        </span>
        <div style={{ flex:1, minWidth:0 }}>
          {/* ΙΔΙΑ ΑΠΟΦΑΣΗ ΜΕ ΤΗΝ EventCard, ΓΡΑΜΜΕΝΗ ΟΠΩΣ ΕΚΕΙ. Οι τρεις ιδιότητες
              αποκοπής ήταν στο χέρι: ο σαρωτής διάταξης δεν έχει τρόπο να ξεχωρίσει
              τον τίτλο που ΔΕΝ έχει ταβάνι μήκους από την ετικέτα που απλώς δεν
              χώρεσε, οπότε ανέφερε στα 320 τη «Συντήρηση καυστήρα» ως κομμένη. Η
              κλάση ΕΙΝΑΙ η δήλωση. Η αδελφή κάρτα το είχε ήδη διορθώσει· αυτή εδώ
              έμεινε πίσω, γιατί η διόρθωση έγινε σε ένα σημείο αντί για δύο. */}
          <p className="po-elide" style={{ fontSize:14, fontFamily: T.font.sans, color:'var(--text-primary)', margin:0, letterSpacing:'0.1px' }}>{lead.title}</p>
          <p style={{ fontSize:12, fontFamily: T.font.sans, color:'var(--text-tertiary)', margin:'3px 0 0' }}>
            {[cadence, `επόμενη ${fmt(lead.event_date)}`, `${count} συνολικά έως ${fmt(lastDate)}`].filter(Boolean).join(' · ')}
            {totalAmount!=null&&<> · σύνολο <span style={{ fontVariantNumeric:'tabular-nums' }}>{fe(totalAmount)}</span></>}
          </p>
        </div>
        {lead.amount!=null&&(
          <span style={{ fontSize: 'var(--fs-base)', fontFamily: T.font.sans, fontVariantNumeric:'tabular-nums', color:'var(--text-secondary)', flexShrink:0 }}>{fe(lead.amount)}</span>
        )}
        <button onClick={()=>setOpen(o=>!o)} aria-expanded={open}
          style={{ flexShrink:0, display:'flex', alignItems:'center', gap:6, height:T.h.sm, padding:'0 11px', borderRadius:T.radius.pill, border:'1px solid var(--border-subtle)', background:'var(--bg-elevated)', color:'var(--text-secondary)', fontSize:12, fontFamily: T.font.sans, cursor:'pointer', whiteSpace:'nowrap' }}>
          {open?'Σύμπτυξη':'Ανάλυση'}
          <ChevronDown size={12} style={{ transform:open?'rotate(180deg)':'none', transition:'transform 0.2s' }}/>
        </button>
      </div>
      {open&&(
        <div style={{ display:'flex', flexDirection:'column', gap: 8, paddingLeft: T.sp.lg, borderLeft:'1px solid var(--border-subtle)', marginLeft: 8 }}>
          {[lead,...rest].map(e=>(
            <EventCard key={e.id} event={e} onToggleStatus={onToggle} onEdit={onEdit} onDelete={onDelete}
              selected={selectedIds?.has(e.id)} onSelect={onSelect} bulkMode={bulkMode}/>
          ))}
        </div>
      )}
    </div>
  )
}

export function Section({ title, color, events, onToggle, onEdit, onDelete, collapsed=false, desc=false, bulkMode, selectedIds, onSelect }: {
  title:string; color:string; events:CalEvent[]; onToggle:(e:CalEvent)=>void; onEdit:(e:CalEvent)=>void; onDelete:(id:string)=>void
  collapsed?:boolean; desc?:boolean; bulkMode?:boolean; selectedIds?:Set<string>; onSelect?:(id:string)=>void
}) {
  const [open,setOpen]=useState(!collapsed)
  const sorted=[...events].sort((a,b)=>desc?b.event_date.localeCompare(a.event_date):a.event_date.localeCompare(b.event_date))
  // ═══ ΕΚΑΤΟΝ ΔΕΚΑΕΝΝΕΑ ΓΡΑΜΜΕΣ ΠΟΥ ΕΛΕΓΑΝ ΤΟ ΙΔΙΟ ══════════════════════════
  // Ένα δάνειο εικοσαετίας γράφει μία εγγραφή ανά δόση. Στην «Αργότερα» αυτό
  // γινόταν εκατόν δεκαεννέα διαδοχικές, πανομοιότυπες γραμμές «Δόση δανείου ·
  // 751,00€» και ό,τι άλλο είχε το ημερολόγιο —μια λήξη μίσθωσης, ένας
  // έλεγχος λέβητα— θαβόταν από κάτω. Στη μαζική επιλογή, το πρώτο πράγμα που
  // έβλεπε ο χρήστης ήταν εκατό κουτάκια για το ίδιο δάνειο.
  //
  // Οι εγγραφές μένουν στη βάση μία-μία, γιατί καθεμιά πληρώνεται χωριστά. Εδώ
  // εμφανίζονται σαν αυτό που είναι: μία σειρά, με «Ανάλυση» για όποιον τη θέλει.
  const rows=groupSeries(sorted)
  const shown=rows.reduce((n,r)=>n+rowCount(r),0)
  return (
    <div>
      <button onClick={()=>setOpen(o=>!o)} style={{ display:'flex', alignItems:'center', gap:8, background:'none', border:'none', cursor:'pointer', marginBottom:open?11:0, padding:0 }}>
        <span style={{ width:6, height:6, borderRadius:3, background:color, flexShrink:0, opacity:0.9 }}/>
        <span style={{ fontSize:12, fontFamily: T.font.sans, fontWeight:600, color:'var(--text-primary)', letterSpacing:'0.06em', textTransform:'uppercase' }}>{title}</span>
        <span style={{ fontSize:12, fontFamily: T.font.sans, fontVariantNumeric:'tabular-nums', color:'var(--text-tertiary)', background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:10, padding:'0 7px', lineHeight:'17px' }}>{shown}</span>
        <ChevronDown size={13} color="var(--text-tertiary)" style={{ transform:open?'rotate(180deg)':'none', transition:'transform 0.2s' }}/>
      </button>
      {open&&(
        <div style={{ display:'flex', flexDirection:'column', gap: 8 }}>
          {rows.map(r=>r.kind==='series'
            ?<SeriesCard key={r.key} group={r} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete}
               bulkMode={bulkMode} selectedIds={selectedIds} onSelect={onSelect}/>
            :<EventCard key={r.event.id} event={r.event} onToggleStatus={onToggle} onEdit={onEdit} onDelete={onDelete}
               selected={selectedIds?.has(r.event.id)} onSelect={onSelect} bulkMode={bulkMode}/>
          )}
        </div>
      )}
    </div>
  )
}
