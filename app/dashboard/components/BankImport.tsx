'use client'
import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import * as expenseStore from '@/lib/data/expenses'
import * as rentStore from '@/lib/data/rent'
import { Check, ArrowRight, Landmark, SearchX } from 'lucide-react'
import { readBankCsv, planImport, legacyKeyOf, findKnownKeys, type BankTxn, type ExpectedRent, type RentMatch, type ExpenseSuggestion } from '@/lib/accounting/bankImport'
import { feAuto, T, ABSENT_DATE, Btn, EmptyState, Modal, Spinner } from '@/components/Theme'
import { athensToday } from '@/lib/core/time';
import { grDate } from '@/lib/core/format';
import { MONTHS_NOM } from '@/lib/core/months';
import type { RentPaymentsRow, BankTransactionsRow } from '@/lib/supabase/tables';
import { notify, notifyError } from '@/components/Toast';
import { failed } from '@/lib/core/dbError';

// ΤΟ ΑΠΟΤΥΠΩΜΑ ΕΦΥΓΕ ΣΤΗ ΜΗΧΑΝΗ, ΔΙΠΛΑ ΣΤΗΝ ΑΝΑΓΝΩΣΗ ΤΟΥ ΑΡΧΕΙΟΥ. Ηταν εδώ
// `${date}|${amount}|${description}`: δύο αναλήψεις 50,00 από το ίδιο ΑΤΜ την
// ίδια ημέρα έδιναν ένα κλειδί και η δεύτερη χανόταν στο ignoreDuplicates,
// δηλαδή 50,00 λιγότερα έξοδα στο Ε2. Μόνο η `readBankCsv` βλέπει ολόκληρη τη
// γραμμή του αρχείου και τη σειρά της, οπότε μόνο εκείνη μπορεί να ξεχωρίσει
// δύο πραγματικά διαφορετικές κινήσεις. Εδώ διαβάζεται έτοιμο: `t.key`.

// Εισαγωγή τραπεζικής κίνησης (CSV) και αντιστοίχιση σε ενοίκια/έξοδα. Καθαρό,
// minimal modal: επικόλληση ή αρχείο → ανάλυση → «Καταχώρηση όλων (N)».
//
// Η ΣΥΝΤΟΜΟΤΕΡΗ ΡΟΗ (απόφαση ιδιοκτήτη 24/11/2026, εισαγωγή από «Ιδιοκτήτης+»).
// Ο ιδιώτης δεν έχει διπλογραφία και δεν θέλει να τσεκάρει γραμμές: όσα
// ταίριαξαν με βεβαιότητα (ίδιο ποσό, έως πέντε ημέρες από την προθεσμία,
// `planImport`) είναι ήδη επιλεγμένα και μπαίνουν με ένα πάτημα, με αναίρεση
// στο μήνυμα που ακολουθεί. Ό,τι άλλο μένει στο παράθυρο για απόφαση.

/** Πόσο μένει διαθέσιμη η αναίρεση: όσο και στις άλλες μαζικές ενέργειες. */
const UNDO_MS = 6000

/** Ό,τι έγραψε μία καταχώρηση, ώστε η αναίρεση να σβήσει ακριβώς αυτό. */
interface Receipt { rentIds: string[]; expenseKeys: string[]; bankKeys: string[] }

export default function BankImport({ propertyId, userId, year, onClose, onDone }:{ propertyId:string; userId:string; year:number; onClose:()=>void; onDone:()=>void }) {
  const supabase = createClient()
  const [text,setText] = useState('')
  const [step,setStep] = useState<'input'|'review'|'saving'>('input')
  // `sure`: ταίριαξε με βεβαιότητα και ξεκινά επιλεγμένο. Τα υπόλοιπα
  // ενοίκια ξεκινούν ανεπίλεκτα, για απόφαση.
  const [rentMatches,setRentMatches] = useState<(RentMatch&{label:string;due:string|null;confirm:boolean;sure:boolean})[]>([])
  const [expenses,setExpenses] = useState<(ExpenseSuggestion&{confirm:boolean})[]>([])
  // ΤΡΙΑ ΣΥΝΟΛΑ ΕΠΙΣΤΡΕΦΕΙ Η ΜΗΧΑΝΗ, ΔΥΟ ΔΙΑΒΑΖΕ Η ΟΘΟΝΗ. Οι πιστώσεις που δεν
  // δέσμευσαν ανεξόφλητο ενοίκιο έφταναν ως εδώ και πέθαιναν: καμία μεταβλητή,
  // κανένα JSX, κανένας μετρητής. Στο αντίγραφο που μετρήθηκε (μερική πληρωμή
  // 750,00, ενοίκιο ήδη σημειωμένο 800,00, εγγύηση 1.600,00) η matchTransactions
  // γύριζε τρεις αταίριαστες κινήσεις, 3.150,00 ευρώ και η οθόνη έγραφε «Δεν
  // βρέθηκαν νέες αντιστοιχίσεις» στέλνοντας τον χρήστη να ελέγξει την περίοδο
  // του αρχείου: το λάθος δεν ήταν έλλειψη πληροφορίας, ήταν λάθος πληροφορία.
  const [unmatched,setUnmatched] = useState<BankTxn[]>([])
  const [unreadable,setUnreadable] = useState(0)
  const [skipped,setSkipped] = useState(0)
  const [error,setError] = useState('')
  // Μετά την πρώτη καταχώρηση το «Πίσω» δεν έχει νόημα: το αρχείο πέρασε.
  const [done,setDone] = useState(false)
  // ΤΑ ΒΙΒΛΙΑ ΑΝΑΝΕΩΝΟΝΤΑΙ ΟΤΑΝ ΚΛΕΙΣΕΙ ΤΟ ΠΑΡΑΘΥΡΟ. Το `onDone` ξαναφορτώνει
  // τη λογιστική και, όσο φορτώνει, η καρτέλα δεν αποδίδει το παράθυρο: μια
  // ανανέωση με ανοιχτό παράθυρο το ξαναστήνει άδειο και τα «για απόφαση»
  // χάνονται. Όσο μένει ανοιχτό, κρατάμε μόνο ότι κάτι άλλαξε.
  const changed = useRef(false)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const close = () => { if (changed.current) onDone(); onClose() }

  async function analyze(raw:string){
    setError(''); setUnmatched([]); setUnreadable(0)
    const { txns, unreadable:lost } = readBankCsv(raw)
    setUnreadable(lost)
    if(!txns.length){ setError(lost>0?`Δεν διαβάστηκε καμία κίνηση: ${lost} ${lost===1?'γραμμή δεν είχε':'γραμμές δεν είχαν'} αναγνωρίσιμο ποσό.`:'Δεν βρέθηκαν κινήσεις. Έλεγξε ότι το αρχείο έχει στήλες ημερομηνία, περιγραφή και ποσό.'); return }
    // Dedup: πέτα ό,τι έχει ξαναμπεί.
    // ΚΑΘΕ ΠΑΛΙΟ ΑΠΟΤΥΠΩΜΑ ΚΑΤΑΝΑΛΩΝΕΤΑΙ ΜΙΑ ΦΟΡΑ. Το uq_bank_txn_dedup αφήνει
    // το πολύ μία γραμμή ανά παλιό κλειδί, οπότε από δύο πανομοιότυπες γραμμές
    // του αρχείου η πρώτη μετρά ως ήδη εισαγμένη και η δεύτερη, που παλιότερα
    // χανόταν, περνά. Χωρίς την κατανάλωση θα έμενε χαμένη για πάντα.
    // ΤΟ ΣΦΑΛΜΑ ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΠΕΡΑΣΕΙ ΣΙΩΠΗΛΑ. Το `error` αγνοούνταν: μια
    // αποτυχία του ερωτήματος έδινε `existing = null`, άρα ΚΕΝΟ σύνολο
    // αποτυπωμάτων, άρα κάθε γραμμή του αρχείου περνούσε ως καινούρια. Ο
    // χρήστης δεν έβλεπε λάθος — έβλεπε διπλές κινήσεις στα βιβλία του.
    // ΜΟΝΟ ΤΑ ΑΠΟΤΥΠΩΜΑΤΑ ΤΟΥ ΑΡΧΕΙΟΥ, ΣΕ ΟΜΑΔΕΣ. Το ερώτημα διάβαζε όλα τα
    // αποτυπώματα του χρήστη και το PostgREST έκοβε στις 1.000 γραμμές: οι
    // παλιότερες κινήσεις ξαναγύριζαν για έλεγχο. Δες `findKnownKeys`.
    const { seen, error: dedupErr } = await findKnownKeys(txns, keys => supabase.from('bank_transactions').select('dedup_hash').eq('user_id',userId).in('dedup_hash',keys))
    if (dedupErr) { notifyError(failed('Ο έλεγχος για διπλές κινήσεις δεν ολοκληρώθηκε', dedupErr)); return }
    const fresh = txns.filter(t=>!(seen.has(t.key) || seen.delete(legacyKeyOf(t))))
    setSkipped(txns.length - fresh.length)
    // Αναμενόμενα ενοίκια (ανεξόφλητα) του έτους.
    const rp = await rentStore.ofProperty(supabase,propertyId,`id,${rentStore.LEDGER_COLUMNS}`,userId,{ year })
    // ΟΙ ΤΥΠΟΙ ΤΩΝ ΓΡΑΜΜΩΝ ΥΠΑΡΧΟΥΝ ΗΔΗ, ΠΑΡΑΓΟΜΕΝΟΙ ΑΠΟ ΤΑ MIGRATIONS. Ήταν
    // γραμμένο `(p:any)` τρεις φορές: ένα ορθογραφικό σε όνομα στήλης θα περνούσε
    // μέχρι την οθόνη και το `period_month` θα γινόταν σιωπηλά «undefined» μέσα
    // στην ετικέτα του μήνα.
    type Row = Pick<RentPaymentsRow, 'id' | 'period_year' | 'period_month' | 'amount' | 'due_date' | 'paid'>
    const expected:ExpectedRent[] = ((rp||[]) as Row[]).filter(p=>!p.paid).map(p=>({ id:p.id, label:`${MONTHS_NOM[(p.period_month||1)-1]} ${p.period_year}`, amount:p.amount||0, dueDate:p.due_date||`${p.period_year}-${String(p.period_month).padStart(2,'0')}-01` }))
    const res = planImport(fresh, expected)
    // Η ΠΡΟΘΕΣΜΙΑ ΤΑΞΙΔΕΥΕΙ ΜΑΖΙ ΜΕ ΤΗΝ ΑΝΤΙΣΤΟΙΧΙΣΗ: χωρίς αυτήν, η καταχώρηση
    // της είσπραξης δεν μπορεί να πει πόσο άργησε ο μισθωτής.
    const byId = new Map(expected.map(e=>[e.id,e]))
    const view = (m:RentMatch, sure:boolean) => ({ ...m, label:byId.get(m.rentId)?.label||'Ενοίκιο', due:byId.get(m.rentId)?.dueDate||null, confirm:sure, sure })
    setRentMatches([...res.sure.map(m=>view(m,true)), ...res.decide.map(m=>view(m,false))])
    setExpenses(res.expenses.map(e=>({ ...e, confirm:false })))
    setUnmatched(res.unmatched)
    setStep('review')
  }

  // ── Η ΑΝΑΙΡΕΣΗ ΣΒΗΝΕΙ ΜΟΝΟ Ο,ΤΙ ΕΓΡΑΨΕ Η ΚΑΤΑΧΩΡΗΣΗ ───────────────────────
  // Τα ενοίκια ήταν ανεξόφλητα πριν (μόνο αυτά αντιστοιχίζονται), οπότε
  // γυρίζουν στο ανεξόφλητο· οι δαπάνες και οι κινήσεις σβήνουν με το
  // αποτύπωμά τους. Μετά την αναίρεση, η επόμενη εισαγωγή του ίδιου αρχείου
  // τα ξαναβρίσκει όλα, γιατί ο έλεγχος διπλών διαβάζει το bank_transactions.
  async function undo(r:Receipt){
    for(const id of r.rentIds){ const { error } = await rentStore.markUnpaid(supabase, id); if(error) throw error }
    for(const key of r.expenseKeys){ const { error } = await expenseStore.removeByDedup(supabase, userId, key); if(error) throw error }
    if(r.bankKeys.length){ const { error } = await supabase.from('bank_transactions').delete().eq('user_id',userId).in('dedup_hash',r.bankKeys); if(error) throw error }
  }

  async function save(){
    setStep('saving')
    const receipt:Receipt = { rentIds:[], expenseKeys:[], bankKeys:[] }
    const chosenRents = rentMatches.filter(m=>m.confirm)
    const toAdd = expenses.filter(e=>e.confirm)
    try{
      // Η γραμμή που γράφεται στον πίνακα κινήσεων, με τον τύπο του πίνακα.
      const rows: Pick<BankTransactionsRow, 'user_id'|'property_id'|'txn_date'|'description'|'amount'|'dedup_hash'>[] = []
      for(const m of chosenRents){
        // Η ΕΙΣΠΡΑΞΗ ΠΕΡΝΑ ΑΠΟ ΤΟ ΣΤΡΩΜΑ, που γράφει ΚΑΙ τις ημέρες καθυστέρησης.
        // Εδώ γράφονταν τρεις στήλες από τις τέσσερις: μια δόση που εισπράχθηκε
        // δύο μήνες αργότερα καταγραφόταν με μηδέν ημέρες καθυστέρησης και ο
        // λογιστής διάβαζε συνεπή μισθωτή που δεν ήταν.
        const { error } = await rentStore.markPaid(supabase, m.rentId, m.due, m.txn.date || athensToday(), 'Τραπεζική κατάθεση')
        if(error) throw error
        receipt.rentIds.push(m.rentId)
        rows.push({ user_id:userId, property_id:propertyId, txn_date:m.txn.date||null, description:m.txn.description, amount:m.txn.amount, dedup_hash:m.txn.key })
      }
      if(toAdd.length){
        const { error } = await expenseStore.insertFromBank(supabase, toAdd.map(e=>({
          ...expenseStore.row({ propertyId, userId }, { amount:e.amount, description:e.description.slice(0,120), date:e.txn.date||athensToday(), category:'Τραπεζική κίνηση' }),
          dedup_hash: e.txn.key,
        })))
        if(error) throw error
        receipt.expenseKeys.push(...toAdd.map(e=>e.txn.key))
        for(const e of toAdd) rows.push({ user_id:userId, property_id:propertyId, txn_date:e.txn.date||null, description:e.txn.description, amount:e.txn.amount, dedup_hash:e.txn.key })
      }
      if(rows.length){ const { error } = await supabase.from('bank_transactions').upsert(rows,{ onConflict:'user_id,dedup_hash', ignoreDuplicates:true }); if(error) throw error; receipt.bankKeys.push(...rows.map(r=>r.dedup_hash)) }
    }catch(e){
      // Ό,τι πρόλαβε να γραφτεί αναιρείται: αλλιώς ενοίκια θα έμεναν πληρωμένα
      // χωρίς κίνηση και η επόμενη εισαγωγή θα τα πρότεινε ξανά.
      try { await undo(receipt) } catch { /* το αρχικό σφάλμα είναι αυτό που λέγεται */ }
      setError(failed('Οι κινήσεις δεν καταχωρήθηκαν', e)); setStep('review'); return
    }
    const nR = chosenRents.length, nE = toAdd.length
    const parts = [nR ? `${nR} ${nR===1?'ενοίκιο':'ενοίκια'}` : '', nE ? `${nE} ${nE===1?'δαπάνη':'δαπάνες'}` : ''].filter(Boolean)
    notify(`Καταχωρήθηκαν ${parts.join(' και ')}.`, {
      tone:'positive', duration:UNDO_MS,
      action:{ label:'Αναίρεση', onClick:()=>{
        void undo(receipt).then(()=>{
          notify('Η εισαγωγή αναιρέθηκε.')
          // Με το παράθυρο ακόμη ανοιχτό, οι γραμμές ξαναγυρίζουν στη λίστα.
          if(alive.current){ setRentMatches(a=>[...chosenRents, ...a]); setExpenses(a=>[...toAdd, ...a]); changed.current = true }
          else onDone()
        }).catch(e=>notifyError(failed('Η αναίρεση δεν έγινε', e)))
      } },
    })
    // ΟΣΑ ΔΕΝ ΚΑΤΑΧΩΡΗΘΗΚΑΝ ΜΕΝΟΥΝ ΓΙΑ ΑΠΟΦΑΣΗ. Το παράθυρο κλείνει μόνο όταν
    // δεν έχει τίποτα άλλο να δείξει.
    const leftRents = rentMatches.filter(m=>!m.confirm), leftExp = expenses.filter(e=>!e.confirm)
    if(!leftRents.length && !leftExp.length && !unmatched.length){ onDone(); onClose(); return }
    changed.current = true
    setRentMatches(leftRents); setExpenses(leftExp); setSkipped(0)
    setDone(true); setStep('review')
  }

  const field:React.CSSProperties = { width:'100%', minHeight:104, padding:'11px 14px', borderRadius:T.radius.inner, border:'1px solid var(--border-control)', background:'var(--bg-surface)', color:'var(--text-primary)', fontSize: 'var(--fs-base)', fontFamily:T.font.mono, lineHeight:'19px', resize:'vertical', outline:'none', transition:'border-color 0.14s' }
  const row:React.CSSProperties = { display:'flex', alignItems:'center', gap:12, padding:'10px 12px', borderRadius:T.radius.inner, background:'var(--bg-surface)', border:'1px solid var(--border-subtle)' }

  function Box({ checked, onClick }:{ checked:boolean; onClick:()=>void }){
    return <button type="button" role="checkbox" aria-checked={checked} onClick={onClick} style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:18, height:18, borderRadius: T.radius.xs, border:`1.5px solid ${checked?'var(--accent)':'var(--border-default)'}`, background:checked?'var(--accent)':'var(--bg-elevated)', cursor:'pointer', flexShrink:0, padding:0 }}>{checked&&<Check size={12} style={{ color:'var(--accent-text)' }}/>}</button>
  }

  // Η ίδια συνθήκη ήταν γραμμένη ΤΡΕΙΣ φορές στο κουμπί «Καταχώρηση» (disabled,
  // φόντο, χρώμα κειμένου) — τρία αντίγραφα που μπορούσαν να διαφωνήσουν.
  // Ο ΑΡΙΘΜΟΣ ΣΤΟ ΚΟΥΜΠΙ ΕΙΝΑΙ ΟΣΑ ΘΑ ΓΡΑΦΤΟΥΝ. Στην αρχή είναι τα βέβαια·
  // ό,τι τσεκάρει ο χρήστης από τα «για απόφαση» προστίθεται.
  const chosen = rentMatches.filter(m=>m.confirm).length + expenses.filter(e=>e.confirm).length
  const canSave = chosen > 0
  const sureRents = rentMatches.filter(m=>m.sure)
  const openRents = rentMatches.filter(m=>!m.sure)
  const toggleRent = (id:string) => setRentMatches(a=>a.map(x=>x.rentId===id?{...x,confirm:!x.confirm}:x))
  const hasDecide = openRents.length>0 || expenses.length>0 || unmatched.length>0
  const head:React.CSSProperties = { fontSize: 'var(--fs-base)', fontWeight: 600, lineHeight: 1.3, color:'var(--text-secondary)', margin:'0 0 8px', fontFamily: T.font.sans }
  const sub:React.CSSProperties = { fontSize: 'var(--fs-xs)', color:'var(--text-tertiary)', margin:'1px 0 0', fontFamily: T.font.sans, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }
  const rentRow = (m:typeof rentMatches[number]) => (
    <div key={m.rentId} style={row}>
      <Box checked={m.confirm} onClick={()=>toggleRent(m.rentId)}/>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontSize: 'var(--fs-base)', color:'var(--text-primary)', margin:0, fontFamily: T.font.sans }}>{m.label}</p>
        <p style={sub}>{grDate(m.txn.date)} · {m.txn.description}</p>
      </div>
      <span style={{ fontSize: 'var(--fs-base)', fontWeight:600, color:'var(--positive)', fontVariantNumeric:'tabular-nums', fontFamily: T.font.sans }}>{feAuto(m.txn.amount)}</span>
    </div>
  )
  // ── ΔΕΝ ΚΛΕΙΝΕΙ ΟΣΟ ΚΑΤΑΧΩΡΕΙ ────────────────────────────────────────────
  // Το χειρόγραφο κέλυφος δεν άκουγε Escape· το Modal ακούει. Η `save()` γράφει
  // σε ΤΡΕΙΣ πίνακες στη σειρά (rent_payments, expenses, bank_transactions) και
  // μόνο στο τέλος λέει τι πέρασε. Ένα Escape στη μέση κλείνει το παράθυρο ενώ
  // οι εγγραφές τρέχουν: ο χρήστης δεν μαθαίνει ούτε πόσα καταχωρήθηκαν ούτε αν
  // κάτι απέτυχε και ξαναδοκιμάζει στα τυφλά. Το κανονικό αυτόματο κλείσιμο
  // μετά την επιτυχία περνά κατευθείαν από το `onClose`, οπότε δεν εμποδίζεται.
  const requestClose = () => { if (step !== 'saving') close() }
  // Το αρχείο ανοίγει από <label>: το ίδιο το <input type="file"> είναι κρυμμένο.
  const filePicker = (
    <label style={{ fontSize: 'var(--fs-base)', color:'var(--accent)', cursor:'pointer', fontFamily: T.font.sans }}>
      Άνοιγμα αρχείου CSV
      <input type="file" accept=".csv,text/csv,text/plain" style={{ display:'none' }} onChange={e=>{ const f=e.target.files?.[0]; if(f){ const r=new FileReader(); r.onload=()=>{ const v=String(r.result||''); setText(v); analyze(v) }; r.readAsText(f) } }}/>
    </label>
  )

  return (
    // ΤΟ ΠΑΡΑΘΥΡΟ ΗΤΑΝ ΧΕΙΡΟΓΡΑΦΟ: δικό του overlay με στοίχιση στην κορυφή
    // (padding 6vh) και δική του κεφαλίδα, χωρίς Escape, χωρίς επιστροφή
    // εστίασης, χωρίς κλείδωμα κύλισης — το φόντο κυλούσε κάτω από το παράθυρο.
    // Οι ενέργειες κάθε βήματος πέρασαν στο υποσέλιδο: ίδια θέση και στα δύο
    // βήματα και δεν κυλούν μαζί με τη λίστα των κινήσεων.
    <Modal open onClose={requestClose} size="md"
      icon={<Landmark size={19}/>}
      title="Εισαγωγή τραπεζικής κίνησης"
      subtitle="Αντιστοίχισε αυτόματα τις κινήσεις σε ενοίκια και δαπάνες, με τη δική σου έγκριση"
      footerInfo={step==='input' ? filePicker : undefined}
      footer={
        step==='input' ? (
          <Btn variant="primary" disabled={!text.trim()} onClick={()=>analyze(text)}>Ανάλυση<ArrowRight size={15}/></Btn>
        ) : step==='review' ? (<>
          {done
            ? <Btn variant="secondary" onClick={close}>Κλείσιμο</Btn>
            : <Btn variant="secondary" onClick={()=>setStep('input')}>Πίσω</Btn>}
          <Btn variant="primary" disabled={!canSave} onClick={save}>Καταχώρηση όλων ({chosen})</Btn>
        </>) : undefined
      }>
      {step==='input'&&(<div>
        <p style={{ fontSize: 'var(--fs-base)', color:'var(--text-secondary)', margin:'0 0 10px', fontFamily: T.font.sans, lineHeight:1.55 }}>Επικόλλησε την κίνηση από το e-banking (CSV) ή ανέβασε αρχείο. Αναγνωρίζονται στήλες ημερομηνία, περιγραφή και ποσό (ή χρέωση/πίστωση).</p>
        <textarea aria-label="Κινήσεις λογαριασμού, επικολλημένες από το e-banking" value={text} onChange={e=>setText(e.target.value)} placeholder={'Ημερομηνία;Περιγραφή;Ποσό\n05/03/2026;Κατάθεση ενοικίου;800,00'} style={field}
          onFocus={e=>e.currentTarget.style.borderColor='var(--accent)'} onBlur={e=>e.currentTarget.style.borderColor='var(--border-default)'}/>
        {error&&<p style={{ fontSize: 'var(--fs-base)', color:'var(--negative)', margin:'12px 0 0', fontFamily: T.font.sans }}>{error}</p>}
      </div>)}

      {step==='review'&&(<div>
        {/* Η ΥΠΟΔΕΙΞΗ ΤΗΣ ΚΕΝΗΣ ΚΑΤΑΣΤΑΣΗΣ ΕΛΕΓΕ ΨΕΜΑΤΑ. Οσο οι αταίριαστες
            πιστώσεις ήταν αόρατες, η κατάσταση αυτή έβγαινε ΚΑΙ με γεμάτο
            αρχείο και έστελνε τον χρήστη να ελέγξει την περίοδο. Με το τρίτο
            τμήμα στη θέση του, βγαίνει μόνο όταν κάθε κίνηση είχε ήδη εισαχθεί,
            οπότε λέει ακριβώς αυτό. */}
        {rentMatches.length===0&&expenses.length===0&&unmatched.length===0?(
          <EmptyState icon={<SearchX size={20}/>} title="Δεν βρέθηκαν νέες αντιστοιχίσεις" hint={skipped>0?`${skipped} ${skipped===1?'κίνηση είχε':'κινήσεις είχαν'} ήδη εισαχθεί.`:'Καμία νέα κίνηση στο αρχείο.'}/>
        ):(<>
          {sureRents.length>0&&(<>
            <p style={head}>Ενοίκια που εισπράχθηκαν</p>
            <div style={{ display:'flex', flexDirection:'column', gap: 8, marginBottom:16 }}>
              {sureRents.map(rentRow)}
            </div>
          </>)}
          {/* ΓΙΑ ΑΠΟΦΑΣΗ: ίδιο ποσό με ενοίκιο αλλά μακριά από την προθεσμία,
              χρεώσεις και πιστώσεις χωρίς αντιστοίχιση. Ξεκινούν ανεπίλεκτα. */}
          {hasDecide&&<p style={{ ...head, margin: sureRents.length>0 ? '8px 0 8px' : '0 0 8px', color:'var(--text-primary)' }}>Για απόφαση</p>}
          {openRents.length>0&&(<>
            <p style={head}>Ίδιο ποσό με ενοίκιο, άλλη ημερομηνία</p>
            <div style={{ display:'flex', flexDirection:'column', gap: 8, marginBottom:16 }}>
              {openRents.map(rentRow)}
            </div>
          </>)}
          {expenses.length>0&&(<>
            <p style={head}>Πιθανές δαπάνες</p>
            <div style={{ display:'flex', flexDirection:'column', gap: 8 }}>
              {expenses.map((e,i)=>(
                <div key={i} style={row}>
                  <Box checked={e.confirm} onClick={()=>setExpenses(a=>a.map((x,j)=>j===i?{...x,confirm:!x.confirm}:x))}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize: 'var(--fs-base)', color:'var(--text-primary)', margin:0, fontFamily: T.font.sans, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.description}</p>
                    <p style={sub}>{grDate(e.txn.date)}</p>
                  </div>
                  <span style={{ fontSize: 'var(--fs-base)', fontWeight:600, color:'var(--text-primary)', fontVariantNumeric:'tabular-nums', fontFamily: T.font.sans }}>{feAuto(e.amount)}</span>
                </div>
              ))}
            </div>
          </>)}
          {/* ΜΟΝΟ ΑΝΑΓΝΩΣΗ, ΧΩΡΙΣ ΚΟΥΤΑΚΙ: δεν υπάρχει ενέργεια να προσφερθεί.
              Οι γραμμές αυτές ΔΕΝ γράφονται στο bank_transactions ούτε όταν ο
              χρήστης πατήσει «Καταχώρηση»: το dedup της ανάλυσης θα τις έκρυβε
              στην επόμενη εισαγωγή, δηλαδή το ίδιο σφάλμα με άλλο τρόπο. */}
          {unmatched.length>0&&(<>
            <p style={{ fontSize: 'var(--fs-base)', fontWeight: 600, lineHeight: 1.3, color:'var(--text-secondary)', margin:'16px 0 8px', fontFamily: T.font.sans }}>Κινήσεις χωρίς αντιστοίχιση</p>
            <p style={{ fontSize: 'var(--fs-xs)', color:'var(--text-tertiary)', margin:'0 0 8px', fontFamily: T.font.sans, lineHeight:1.5 }}>Δεν ταιριάζουν σε ανεξόφλητο ενοίκιο του {year} και δεν καταχωρούνται από εδώ. Επανεμφανίζονται σε κάθε εισαγωγή, μέχρι να τακτοποιηθούν.</p>
            <div style={{ display:'flex', flexDirection:'column', gap: 8 }}>
              {unmatched.map((t,i)=>(
                <div key={i} style={row}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize: 'var(--fs-base)', color:'var(--text-primary)', margin:0, fontFamily: T.font.sans, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.description||'Χωρίς περιγραφή'}</p>
                    <p style={{ fontSize: 'var(--fs-xs)', color:'var(--text-tertiary)', margin:'1px 0 0', fontFamily: T.font.sans }}>{t.date?grDate(t.date):ABSENT_DATE}</p>
                  </div>
                  <span style={{ fontSize: 'var(--fs-base)', fontWeight:600, color:'var(--text-primary)', fontVariantNumeric:'tabular-nums', fontFamily: T.font.sans }}>{feAuto(t.amount)}</span>
                </div>
              ))}
            </div>
          </>)}
          {skipped>0&&<p style={{ fontSize: 'var(--fs-xs)', color:'var(--text-tertiary)', margin:'12px 0 0', fontFamily: T.font.sans }}>{skipped} {skipped===1?'κίνηση παραλείφθηκε: είχε':'κινήσεις παραλείφθηκαν: είχαν'} ήδη εισαχθεί.</p>}
        </>)}
        {unreadable>0&&<p style={{ fontSize: 'var(--fs-xs)', color:'var(--text-tertiary)', margin:'12px 0 0', fontFamily: T.font.sans }}>{unreadable} {unreadable===1?'γραμμή του αρχείου δεν διαβάστηκε':'γραμμές του αρχείου δεν διαβάστηκαν'}: χωρίς αναγνωρίσιμο ποσό.</p>}
        {error&&<p style={{ fontSize: 'var(--fs-base)', color:'var(--negative)', margin:'12px 0 0', fontFamily: T.font.sans }}>{error}</p>}
      </div>)}

      {step==='saving'&&(
        <Spinner size={20} label="Καταχώρηση…"/>
      )}
    </Modal>
  )
}
