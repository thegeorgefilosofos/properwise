'use client'
// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΠΡΟΧΩΡΗΜΕΝΑ ΕΡΓΑΛΕΙΑ ΤΗΣ ΛΟΓΙΣΤΙΚΗΣ
// ─────────────────────────────────────────────────────────────────────────
// Οι κάρτες που ζουν κάτω από το «Προχωρημένα εργαλεία»: φορολογική κλίμακα,
// ενοποίηση χαρτοφυλακίου, συμβουλές, αλλαγές της χρονιάς, κόστος αγοράς και
// πώλησης, ταμειακές ροές, ισοζύγιο. Παίρνουν ό,τι δείχνουν από την κατάσταση
// της καρτέλας (useAccounting) και δεν γράφουν τίποτα μόνες τους.
// ═══════════════════════════════════════════════════════════════════════════
import { T, fixedCols, Stat, widestOf, ChipToggle, fe } from '@/components/Theme'
import { card, cardTitle, Fold, OutLink, Check } from './Bits'
import type { AccountingProps, AccountingState } from './useAccounting'
import { Layers, ChevronRight, Lightbulb, Landmark } from 'lucide-react'
import { InfoHint } from '../InfoHint'
import { eur, pct, ADVISORY_TONE, TRIAL_W, trialCol, TRIAL_MIN } from './model'
import { hy } from '@/components/Hyphen'
import { referLabel } from '@/lib/accounting/advisory'
import type { RegulatoryUpdate } from '@/lib/accounting/updates2026'
import { MONTHS_NOM } from '@/lib/core/months'
import { AsOfNote } from '@/components/AsOfNote'
import { taxLimitAsOf } from '@/lib/facts/taxLimits'
import { firstHomeExemption } from '@/lib/accounting/transfer'
import { feWhole } from '@/lib/core/format'

export function TaxScaleCard({ businessMode, taxRows, statement, hoverBracket, setHoverBracket }: Pick<AccountingProps & AccountingState,
  'businessMode' | 'taxRows' | 'statement' | 'hoverBracket' | 'setHoverBracket'
>) {
  return (
    <div style={card}>
      <p style={cardTitle}>{businessMode ? 'Κλίμακα επιχειρηματικής δραστηριότητας 2026' : 'Φορολογική κλίμακα ενοικίων'}</p>
      {/* ΜΙΑ ΣΕΙΡΑ, ΟΣΑ ΚΙ ΑΝ ΕΙΝΑΙ ΤΑ ΚΛΙΜΑΚΙΑ. Το `auto-fit` έβγαζε πέντε
          κουτιά και ένα μόνο του από κάτω: η κλίμακα είναι ΜΙΑ κλίμακα και
          διαβάζεται ως σκάλα μόνο όταν τα σκαλιά είναι στην ίδια ευθεία.
          Το πλήθος στηλών είναι πλέον το πλήθος των κλιμακίων — έξι για την
          επιχειρηματική, τέσσερα για τα ενοίκια — και τα κουτιά στενεύουν
          αντί να τυλίγονται. Βλ. `fixedCols`: στα στενά σπάει σε τρία και
          δύο, όπου η μία σειρά δεν χωρά ούτως ή άλλως. */}
      {/* Ο ΠΙΝΑΚΑΣ ΑΚΟΛΟΥΘΕΙ ΤΟΝ ΕΠΙΛΟΓΕΑ ΕΤΟΥΣ, ΟΠΩΣ Ο ΥΠΟΛΟΓΙΣΜΟΣ. Με
          επιλεγμένο το 2025 η ίδια οθόνη έγραφε από πάνω «κλίμακα έως
          2025 (15/35/45)» και τύπωνε από κάτω τέσσερα κλιμάκια με το
          ενδιάμεσο 25%: το νούμερο σωστό, η εξήγησή του ψεύτικη. */}
      <div {...fixedCols(taxRows.length, 10, 'stretch')}>
        {taxRows.map((r,i)=>{ const active=statement.taxableIncome>r.from&&statement.taxableIncome<=r.to; const hot=hoverBracket===i; return (
          <div key={r.range} onMouseEnter={()=>setHoverBracket(i)} onMouseLeave={()=>setHoverBracket(null)}
            style={{ padding:'10px 12px', borderRadius: T.radius.popup, minWidth:0, border:`1px solid ${hot?'var(--accent)':active?'var(--border-default)':'var(--border-subtle)'}`, background:active?'var(--bg-elevated)':'var(--bg-surface)', transition:'border-color 0.15s, background 0.15s', cursor:'default' }}>
            {/* ΤΟ ΕΥΡΟΣ ΣΕ ΔΥΟ ΣΤΑΘΕΡΕΣ ΓΡΑΜΜΕΣ, ΣΕ ΚΑΘΕ ΚΟΥΤΙ. Ολόκληρο το
                «10.001,00 – 20.000,00€» σε κουτί ενός έκτου τύλιγε όπου
                έβρισκε: το πρώτο σκαλί σε μία γραμμή, τα άλλα σε δύο, με
                τον συντελεστή σε άλλο ύψος στο καθένα. Κάτω όριο πάνω,
                άνω όριο κάτω: όλα τα σκαλιά ίδιο σχήμα, ίδιο ύψος. */}
            <p style={{ fontSize:12, lineHeight:1.45, color:'var(--text-tertiary)', margin:0, fontFamily: T.font.sans, fontVariantNumeric:'tabular-nums' }}>
              {(() => { const k = r.range.indexOf(' – '); const [a, b] = k >= 0 ? [r.range.slice(0, k + 2), r.range.slice(k + 3)] : r.range.startsWith('Πάνω από ') ? ['Πάνω από', r.range.slice(9)] : [r.range, '']; return <><span style={{ display:'block', whiteSpace:'nowrap' }}>{a}</span><span style={{ display:'block', whiteSpace:'nowrap' }}>{b}</span></> })()}
            </p>
            <p style={{ fontSize:16, fontWeight:700, color:hot?'var(--accent)':'var(--text-primary)', margin:'6px 0 0', fontVariantNumeric:'tabular-nums', fontFamily: T.font.sans, transition:'color 0.16s ease' }}>{r.rate}</p>
          </div>
        )})}
      </div>
      {/* ΠΟΤΕ ΕΛΕΓΧΘΗΚΕ Η ΚΛΙΜΑΚΑ ΚΑΙ ΑΠΟ ΠΟΥ. Η κάρτα έδειχνε όρια και συντελεστές
          χωρίς ούτε ημερομηνία ούτε πηγή (lib/facts/taxLimits). */}
      <AsOfNote fact={taxLimitAsOf(businessMode ? 'business' : 'rent')} style={{ margin: '10px 0 0' }} />
    </div>
  )
}

export function ConsolidationCard({
  elp, consolOpen, setConsolOpen, portfolio, year, propertyId, deductibleTotal, expensesTotal,
  inventoryDepr, loanInterestYear,
}: Pick<AccountingProps & AccountingState,
  'elp' | 'consolOpen' | 'setConsolOpen' | 'portfolio' | 'year' | 'propertyId' | 'deductibleTotal' |
  'expensesTotal' | 'inventoryDepr' | 'loanInterestYear'
>) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap:16 }}>
      {elp==='personal'&&(
      <Fold open={consolOpen} onToggle={()=>setConsolOpen(o=>!o)}
        title={<span style={{ display:'inline-flex', alignItems:'center', gap:8 }}><Layers size={15} style={{ color:'var(--text-secondary)' }}/>Ενοποίηση χαρτοφυλακίου</span>}>
        {!portfolio?(
          <p style={{ fontSize: 'var(--fs-base)', color:'var(--text-tertiary)', fontFamily: T.font.sans, padding:'8px 0' }}>Δεν υπάρχουν έσοδα σε άλλα ακίνητα για το {year}.</p>
        ):(<>
          <p style={{ fontSize:12, color:'var(--text-secondary)', margin:'0 0 12px', fontFamily: T.font.sans, lineHeight:1.5 }}>Ο φόρος φυσικού προσώπου είναι προοδευτικός στο <strong style={{ color:'var(--text-primary)' }}>σύνολο</strong> των ενοικίων (όπως στο Ε1), όχι ανά ακίνητο.</p>
          {/* ΤΡΙΑ ΝΟΥΜΕΡΑ ΓΡΑΜΜΕΝΑ ΜΕ ΤΟ ΧΕΡΙ, ΜΕ ΔΙΚΟ ΤΟΥΣ ΜΕΓΕΘΟΣ. Ετικέτα
              11 με 0,4px γράμμα και νούμερο σταθερά 16, ενώ η γραμμή
              στοιχείων του βιβλίου κλιμακώνεται με το πλάτος και κρατά ένα
              μέγεθος ανά σειρά. Και εδώ, ένα «Συνολικά έσοδα» που τυλίγει
              κατέβαζε το νούμερό του κάτω από τα διπλανά. */}
          <div {...fixedCols(3, 16, 'start')} style={{ ...fixedCols(3, 16, 'start').style, marginBottom:12 }}>
            {(() => { const row = [
              ['Συνολικά έσοδα', eur(portfolio.con.grossIncome)] as const,
              ['Συνολικός φόρος', eur(portfolio.con.incomeTax)] as const,
              ['Μέσος συντελεστής', pct(portfolio.con.effectiveRate)] as const,
            ]; const w = widestOf(...row.map(([, v]) => v));
              return row.map(([k, v]) => <Stat key={k} label={k} value={v} chars={w} />) })()}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {portfolio.con.perProperty.map(pp=>(
              <div key={pp.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:10, background:'var(--bg-surface)', border:`1px solid ${pp.id===propertyId?'var(--border-default)':'var(--border-subtle)'}` }}>
                <span className="po-elide" style={{ flex:1, fontSize: 'var(--fs-base)', color:'var(--text-primary)', fontFamily: T.font.sans }}>{portfolio.names[pp.id]}</span>
                <span style={{ fontSize:12, color:'var(--text-secondary)', fontVariantNumeric:'tabular-nums', fontFamily: T.font.sans }}>{eur(pp.statement.grossIncome)}</span>
                <span style={{ fontSize: 'var(--fs-base)', fontWeight:600, color:'var(--text-primary)', fontVariantNumeric:'tabular-nums', fontFamily: T.font.sans, minWidth:70, textAlign:'right' }}>φόρος {eur(pp.taxShare)}</span>
              </div>
            ))}
          </div>
        </>)}
      </Fold>
      )}

      <div style={card}>
        <p style={cardTitle}>Εκπιπτόμενα έξοδα</p>
        {/* ΤΟ ΖΕΥΓΟΣ ΠΟΥ ΠΡΕΠΕΙ ΝΑ ΔΙΑΒΑΖΕΤΑΙ ΜΑΖΙ. Δύο ποσά που αθροίζουν
            στο σύνολο των δαπανών, γραμμένα με το χέρι στα 16 και με
            ετικέτα άλλου ρυθμού από το βιβλίο. Ενα μέγεθος, από το
            μακρύτερο: αλλιώς το «1.152,00€» δίπλα στο «0,00€» φαίνεται
            σημαντικότερο επειδή είναι απλώς μακρύτερο. */}
        {(() => { const row = [
          ['Εκπιπτόμενα', eur(deductibleTotal)] as const,
          ['Μη εκπιπτόμενα', eur(expensesTotal - deductibleTotal)] as const,
        ]; const w = widestOf(...row.map(([, v]) => v))
          return (
            <div {...fixedCols(2, 16, 'start')} style={{ ...fixedCols(2, 16, 'start').style, marginBottom:12 }}>
              {row.map(([k, v]) => <Stat key={k} label={k} value={v} chars={w} />)}
            </div>
          ) })()}
        <p style={{ fontSize:12, color:'var(--text-secondary)', margin:0, fontFamily: T.font.sans, lineHeight:1.5 }}>Για ιδιώτη τα έξοδα δεν εκπίπτουν αναλυτικά. Στο καθεστώς <strong style={{ color:'var(--text-primary)' }}>Επιχείρηση (ΕΛΠ)</strong> εκπίπτουν πλήρως.<InfoHint>Για φυσικό πρόσωπο με μακροχρόνια μίσθωση κατοικίας ισχύει η τεκμαρτή έκπτωση 5% (όχι αναλυτικά έξοδα). Στο καθεστώς Επιχείρηση (ΕΛΠ) εκπίπτουν αναλυτικά, μαζί με αποσβέσεις εξοπλισμού ({eur(inventoryDepr)} τον χρόνο) και τόκους δανείων ({eur(loanInterestYear)} τον χρόνο).</InfoHint></p>
      </div>
    </div>
  )
}

export function AdvisoryCard({
  advisoryRef, setAdvisoryOpen, setOpenAdvisory, advisoryOpen, advisory, openAdvisory,
}: Pick<AccountingProps & AccountingState,
  'advisoryRef' | 'setAdvisoryOpen' | 'setOpenAdvisory' | 'advisoryOpen' | 'advisory' |
  'openAdvisory'
>) {
  return (
    <div ref={advisoryRef} style={card}>
      <button onClick={()=>{ setAdvisoryOpen(o=>!o); setOpenAdvisory(null) }} aria-expanded={advisoryOpen} className="acc-toggle acc-row">
        <span style={{ display:'flex', alignItems:'center', justifyContent:'center', width:30, height:30, borderRadius: T.radius.chip, background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', color:'var(--text-secondary)', flexShrink:0 }}><Lightbulb size={15}/></span>
        <div style={{ flex:1, minWidth:0 }}>
          <p style={{ ...cardTitle, margin:0 }}>Συμβουλευτική</p>
          <p style={{ fontSize:12, color:'var(--text-tertiary)', margin:'2px 0 0', fontFamily: T.font.sans }}>{advisory.length} ιδέες φορολογίας, χρηματοδότησης και αξιοποίησης, από τα δικά σου δεδομένα.</p>
        </div>
        <ChevronRight size={17} style={{ color:'var(--text-tertiary)', flexShrink:0, transform:advisoryOpen?'rotate(90deg)':'none', transition:'transform 0.18s' }}/>
      </button>
      {advisoryOpen && (<>
      <div className="card-row" style={{ marginTop:16 }}>
        {advisory.map(a=>{
          const open = openAdvisory===a.id
          return (
            <div key={a.id} data-open={open} style={{ display:'flex', flexDirection:'column', borderRadius: T.radius.popup, background:'var(--bg-surface)', border:`1px solid ${open?'var(--border-default)':'var(--border-subtle)'}`, overflow:'hidden', transition:'border-color 0.15s' }}>
              {/* ΜΕΝΕΙ ΧΕΙΡΟΠΟΙΗΤΟ: κεφαλίδα σε ΟΛΟ το πλάτος της κάρτας. Το Btn
                  είναι inline-flex κεντραρισμένο, χωρίς πλήρες πλάτος. */}
              <button onClick={()=>setOpenAdvisory(open?null:a.id)} aria-expanded={open} className="acc-toggle po-hov-fill" style={{ width:'100%', flex: open ? 'none' : 1, display:'flex', alignItems:'flex-start', gap:12, padding:'14px 16px', border:'none', cursor:'pointer', textAlign:'left', fontFamily: T.font.sans }} >
                <div style={{ flex:1, minWidth:0 }}>
                  <span style={{ display:'inline-flex', alignItems:'center', height:20, padding:'0 9px', borderRadius: T.radius.xs, background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', fontSize: 'var(--fs-xs)', fontWeight:600, letterSpacing:'0.5px', textTransform:'uppercase', color:'var(--text-tertiary)' }}>{ADVISORY_TONE[a.tone]}</span>
                  <p style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)', margin:'7px 0 0', lineHeight:1.35 }}>{a.title}</p>
                </div>
                {/* Η ΕΤΙΚΕΤΑ ΚΑΙ Ο ΤΙΤΛΟΣ ΞΕΚΙΝΟΥΝ ΠΑΝΩ, ΤΟ ΒΕΛΟΣ ΜΕΝΕΙ ΣΤΟ ΚΕΝΤΡΟ. Με όλα
                    κεντραρισμένα, στην ίδια σειρά η ετικέτα μιας κάρτας με τίτλο μίας
                    γραμμής καθόταν 9px χαμηλότερα από της διπλανής με τίτλο δύο. */}
                <ChevronRight size={16} style={{ color:'var(--text-tertiary)', flexShrink:0, alignSelf:'center', transform:open?'rotate(90deg)':'none', transition:'transform 0.18s' }}/>
              </button>
              {open&&(
                <div style={{ padding:'0 16px 15px' }}>
                  {/* ΤΟ ΣΩΜΑ ΤΗΣ ΙΔΕΑΣ ΕΙΝΑΙ ΤΟ ΜΟΝΟ ΠΡΑΓΜΑΤΙΚΟ ΚΕΙΜΕΝΟ ΤΗΣ ΚΑΡΤΑΣ.
                      Κάθεται σε κελί του `.card-row`, που είναι τρεις στήλες με κενό 12
                      (globals.css:1975) κι πέφτει σε δύο κάτω από τα 900 — δηλαδή στήλη
                      ~450 στο επιτραπέζιο, μείον 16+16 γέμισμα της κάρτας: ~418. Οι
                      προτάσεις είναι 250 ως 450 χαρακτήρες, δηλαδή έξι ως δέκα γραμμές.
                      Ριγμένες, κάθε μία τελείωνε αλλού κι η κάρτα δεν έκλεινε πουθενά.
                      Ο συλλαβισμός πάει μαζί: χωρίς αυτόν, δέκα γραμμές κλείνουν
                      τεντώνοντας τα κενά κι βγαίνουν ποτάμια λευκού. */}
                  <p className="po-just" style={{ fontSize: 'var(--fs-base)', color:'var(--text-secondary)', margin:0, fontFamily: T.font.sans, lineHeight:1.6 }}>{hy(a.body)}</p>
                  {(a.refer||a.linkHref)&&(
                    <div style={{ display:'flex', alignItems:'center', gap:14, marginTop: 12, flexWrap:'wrap' }}>
                      {a.refer&&<span style={{ fontSize:12, color:'var(--text-tertiary)', fontFamily: T.font.sans }}>{referLabel(a.refer)}</span>}
                      {a.linkHref&&<OutLink href={a.linkHref} label={a.linkLabel||'Περισσότερα'}/>}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div style={{ marginTop:14, paddingTop:12, borderTop:'1px solid var(--border-subtle)' }}>
        <p style={{ fontSize:12, color:'var(--text-tertiary)', margin:0, fontFamily: T.font.sans, lineHeight:1.55 }}>Ενημερωτικές προτάσεις, όχι επίσημη συμβουλή.<InfoHint>Οι προτάσεις δεν υποκαθιστούν τον λογιστή, τον δικηγόρο ή τον συμβολαιογράφο σου. Για την επίσημη εξαγωγή συμπερασμάτων και δηλώσεων απευθύνσου σε πιστοποιημένο επαγγελματία.</InfoHint></p>
      </div>
      </>)}
    </div>
  )
}

export function ChangesCard({
  changesRef, setChangesOpen, setOpenChange, changesOpen, relevantChanges, openChange,
}: Pick<AccountingProps & AccountingState,
  'changesRef' | 'setChangesOpen' | 'setOpenChange' | 'changesOpen' | 'relevantChanges' |
  'openChange'
>) {
  return (
    <div ref={changesRef} style={card}>
      <button onClick={()=>{ setChangesOpen(o=>!o); setOpenChange(null) }} aria-expanded={changesOpen} className="acc-toggle acc-row">
        <span style={{ display:'flex', alignItems:'center', justifyContent:'center', width:30, height:30, borderRadius: T.radius.chip, background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', color:'var(--text-secondary)', flexShrink:0 }}><Landmark size={15}/></span>
        <div style={{ flex:1, minWidth:0 }}>
          <p style={{ ...cardTitle, margin:0 }}>Τι άλλαξε το 2026</p>
          <p style={{ fontSize:12, color:'var(--text-tertiary)', margin:'2px 0 0', fontFamily: T.font.sans }}>{relevantChanges.length} επίκαιροι κανόνες για το προφίλ σου.</p>
        </div>
        <ChevronRight size={17} style={{ color:'var(--text-tertiary)', flexShrink:0, transform:changesOpen?'rotate(90deg)':'none', transition:'transform 0.18s' }}/>
      </button>
      {changesOpen && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap:12, marginTop:16, alignItems:'stretch' }}>
          {relevantChanges.map((u:RegulatoryUpdate, i:number)=>{
            const uo = openChange===u.id
            // ΚΑΝΕΝΑ ΟΡΦΑΝΟ ΠΛΑΚΙΔΙΟ. Το πλέγμα είναι `auto-fit`, οπότε μονός
            // αριθμός καρτών αφήνει την τελευταία μόνη της στη σειρά σε φαρδιά
            // οθόνη (4+4+1). Οταν το πλήθος είναι μονό, η τελευταία απλώνεται σε
            // όλο το πλάτος: γεμάτη σειρά, ποτέ ορφανό. Ισχύει για κάθε πλήθος.
            const lastAlone = i === relevantChanges.length - 1 && relevantChanges.length % 2 === 1
            return (
              <div key={u.id} style={{ display:'flex', flexDirection:'column', borderRadius: T.radius.popup, background:'var(--bg-surface)', border:`1px solid ${uo?'var(--border-default)':'var(--border-subtle)'}`, overflow:'hidden', transition:'border-color 0.15s', ...(lastAlone || uo ? { gridColumn:'1 / -1' } : {}) }}>
                {/* ΜΕΝΕΙ ΧΕΙΡΟΠΟΙΗΤΟ: η αιώρηση γεμίσματος έρχεται από την κλάση
                    `po-hov-fill` · κανένα πρωτογενές δεν δέχεται className. */}
                <button onClick={()=>setOpenChange(uo?null:u.id)} aria-expanded={uo} className="acc-toggle po-hov-fill" style={{ width:'100%', flex: uo ? 'none' : 1, display:'flex', alignItems:'center', gap:10, padding:'13px 15px', border:'none', cursor:'pointer', textAlign:'left', fontFamily: T.font.sans }} >
                  <p style={{ flex:1, minWidth:0, fontSize: 'var(--fs-base)', fontWeight:600, color:'var(--text-primary)', margin:0, lineHeight:1.35, fontFamily: T.font.sans }}>{u.title}</p>
                  <ChevronRight size={16} style={{ color:'var(--text-tertiary)', flexShrink:0, transform:uo?'rotate(90deg)':'none', transition:'transform 0.18s' }}/>
                </button>
                {uo && (
                  <div className="po-just-box" style={{ padding:'0 15px 14px' }}>
                    {/* ΙΔΙΟ ΣΧΗΜΑ, ΙΔΙΑ ΑΠΑΝΤΗΣΗ. Η περίληψη του κανόνα κάθεται σε
                        `auto-fit, minmax(min(100%, 300px), 1fr)` με κενό 12, δηλαδή στήλη
                        300 ως ~450 ανάλογα με το πλάτος, μείον 15+15 γέμισμα. Οι
                        περιλήψεις είναι νομικό κείμενο με άρθρα κι ποσά — η «Εκπτωση
                        φόρου ανακαίνισης» πιάνει οκτώ γραμμές. Οι δύο κάρτες είναι
                        δίπλα δίπλα στην ίδια οθόνη: αν στοιχιστεί μόνο η μία, η
                        διαφορά φαίνεται με μια ματιά. */}
                    {/* ΜΕΤΡΟ ΑΝΑΓΝΩΣΗΣ: όταν η κάρτα απλώνεται σε όλο το πλάτος
                        (μονός αριθμός καρτών), η περίληψη χωρίς όριο θα έφτανε
                        120 χαρακτήρες ανά γραμμή. Το `maxWidth` κρατά τη γραμμή
                        σε αναγνώσιμο μέτρο· στις στενές κάρτες δεν αλλάζει τίποτα. */}
                    <p className="po-just" style={{ fontSize: 'var(--fs-base)', color:'var(--text-secondary)', margin:0, lineHeight:1.6, fontFamily: T.font.sans, maxWidth: '62ch' }}>{hy(u.summary)}</p>
                    <div style={{ display:'flex', alignItems:'center', gap:12, marginTop: 12, flexWrap:'wrap' }}>
                      <span style={{ fontSize: 'var(--fs-xs)', color:'var(--text-tertiary)', fontFamily: T.font.sans, letterSpacing:'0.3px' }}>Ισχύς: {u.effective} · {u.legalBasis}</span>
                      {u.sourceHref && <OutLink href={u.sourceHref} label={u.sourceLabel||'Πηγή'}/>}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      {changesOpen && (
      <div style={{ marginTop:14, paddingTop:12, borderTop:'1px solid var(--border-subtle)' }}>
        {/* ΙΔΙΟ ΣΧΗΜΑ ΜΕ ΤΗ ΔΙΠΛΑΝΗ ΚΑΡΤΑ, ΠΟΥ ΤΟ ΕΚΑΝΕ ΗΔΗ ΣΩΣΤΑ. Η
            Συμβουλευτική γράφει «Ενημερωτικές προτάσεις, όχι επίσημη
            συμβουλή.» και βάζει τα υπόλοιπα σε κυκλάκι· εδώ η ίδια
            αποποίηση ήταν απλωμένη σε δύο σειρές ψιλών γραμμάτων. */}
        <p style={{ fontSize:12, color:'var(--text-tertiary)', margin:0, fontFamily: T.font.sans, lineHeight:1.55 }}>Ενημερωτικά, με επίσημες πηγές.<InfoHint>Οι κανόνες αλλάζουν. Επιβεβαίωσε στο myAADE ή στο gov.gr, ή με τον λογιστή σου.</InfoHint></p>
      </div>
      )}
    </div>
  )
}

export function TransferCostCard({
  xferOpen, setXferOpen, xferSide, setXferSide, xferPrice, setXferPrice, prop, xferFirstHome,
  setXferFirstHome, xferAgent, setXferAgent, xferEffectivePrice, xfer,
  xferMarried, setXferMarried, xferChildren, setXferChildren,
}: Pick<AccountingProps & AccountingState,
  'xferOpen' | 'setXferOpen' | 'xferSide' | 'setXferSide' | 'xferPrice' | 'setXferPrice' | 'prop' |
  'xferFirstHome' | 'setXferFirstHome' | 'xferAgent' | 'setXferAgent' | 'xferEffectivePrice' |
  'xfer' | 'xferMarried' | 'setXferMarried' | 'xferChildren' | 'setXferChildren'
>) {
  // Το όριο που ΕΦΑΡΜΟΖΕΤΑΙ, με τα στοιχεία που έδωσες. Η υπόδειξη έγραφε δύο
  // όρια με το χέρι ενώ ο υπολογισμός εφάρμοζε πάντα του άγαμου.
  const exemption = firstHomeExemption({ married: xferMarried, children: xferChildren })
  return (
    <div style={card}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, flexWrap:'wrap', marginBottom:xferOpen?16:0 }}>
        {/* ΜΕΝΕΙ ΧΕΙΡΟΠΟΙΗΤΟ: μοιράζεται τη σειρά με τον επιλογέα Αγορά/Πώληση
            (flex:1 · minWidth:0). Το Btn δεν δέχεται style θέσης, όπως το IconBtn. */}
        <button onClick={()=>setXferOpen(o=>!o)} aria-expanded={xferOpen} className="acc-toggle" style={{ display:'flex', alignItems:'center', gap: 8, background:'none', border:'none', padding:0, cursor:'pointer', textAlign:'left', flex:1, minWidth:0 }}>
          <ChevronRight size={16} style={{ color:'var(--text-tertiary)', flexShrink:0, transform:xferOpen?'rotate(90deg)':'none', transition:'transform 0.18s' }}/>
          <div>
            <p style={{ ...cardTitle, margin:0 }}>Κόστος αγοράς και πώλησης</p>
            {xferOpen&&<p style={{ fontSize:12, color:'var(--text-tertiary)', margin:'3px 0 0', fontFamily: T.font.sans, fontWeight:400 }}>Φόροι, συμβολαιογραφικά και μεσιτικά. Εκτίμηση πριν τη μεταβίβαση.</p>}
          </div>
        </button>
        {xferOpen&&(
        <div style={{ display:'flex', background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:10, padding:2, gap:2 }}>
          {/* `seg` και όχι `chip`: το πλαίσιο γύρω τους έχει ήδη περίγραμμα. */}
          {([['buy','Αγορά'],['sell','Πώληση']] as ['buy'|'sell',string][]).map(([s,label])=>(
            <ChipToggle key={s} on={xferSide===s} shape="seg" onClick={()=>setXferSide(s)}>{label}</ChipToggle>
          ))}
        </div>
        )}
      </div>
      {xferOpen&&(<>
      <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap', marginBottom:14 }}>
        <label style={{ display:'flex', alignItems:'center', gap:8, fontSize: 'var(--fs-base)', color:'var(--text-secondary)', fontFamily: T.font.sans }}>
          <span style={{ minWidth:96 }}>{xferSide==='buy'?'Τιμή αγοράς':'Τιμή πώλησης'}</span>
          <input type="number" inputMode="numeric" min={0} value={xferPrice} onKeyDown={e=>{ if(e.key==='-'||e.key==='e'||e.key==='+') e.preventDefault() }} onChange={e=>setXferPrice(e.target.value===''?'':Math.max(0,Number(e.target.value)))} placeholder={(Number(prop?.value)||0)?String(Math.round(Number(prop?.value))):'0'}
            onFocus={e=>e.currentTarget.style.borderColor='var(--accent)'} onBlur={e=>e.currentTarget.style.borderColor='var(--border-default)'}
            style={{ width:104, height:T.h.lg, padding:'10px 16px', borderRadius:10, border:'1px solid var(--border-default)', background:'var(--bg-surface)', color:'var(--text-primary)', fontSize:14, fontFamily: T.font.sans, fontVariantNumeric:'tabular-nums', textAlign:'right', outline:'none', transition:'border-color 0.14s' }}/>
          <span style={{ color:'var(--text-tertiary)' }}>€</span>
        </label>
        {xferSide==='buy'&&(
          <Check checked={xferFirstHome} onChange={setXferFirstHome} label="Πρώτη κατοικία" hint={`Απαλλαγή φόρου μεταβίβασης ως ${feWhole(exemption)}: φόρος μόνο για ό,τι ξεπερνά το όριο.`} />
        )}
        {xferSide==='buy'&&xferFirstHome&&(
          <>
            <div role="group" aria-label="Οικογενειακή κατάσταση" style={{ display:'flex', background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:T.radius.inner, padding:2, gap:2 }}>
              {([[false,'Άγαμος'],[true,'Έγγαμος']] as [boolean,string][]).map(([m,label])=>(
                <ChipToggle key={label} on={xferMarried===m} shape="seg" onClick={()=>setXferMarried(m)}>{label}</ChipToggle>
              ))}
            </div>
            <label style={{ display:'flex', alignItems:'center', gap:8, fontSize: 'var(--fs-base)', color:'var(--text-secondary)', fontFamily: T.font.sans }}>
              <span>Τέκνα</span>
              <input id="xfer-children" type="number" inputMode="numeric" min={0} max={20} value={xferChildren} onKeyDown={e=>{ if(e.key==='-'||e.key==='e'||e.key==='+'||e.key==='.'||e.key===',') e.preventDefault() }} onChange={e=>setXferChildren(Math.min(20,Math.max(0,Math.floor(Number(e.target.value)||0))))}
                onFocus={e=>e.currentTarget.style.borderColor='var(--accent)'} onBlur={e=>e.currentTarget.style.borderColor='var(--border-default)'}
                style={{ width:64, height:T.h.lg, padding:'10px 12px', borderRadius:T.radius.inner, border:'1px solid var(--border-default)', background:'var(--bg-surface)', color:'var(--text-primary)', fontSize:14, fontFamily: T.font.sans, fontVariantNumeric:'tabular-nums', textAlign:'right', outline:'none', transition:'border-color 0.14s' }}/>
            </label>
            <span style={{ fontSize:12, color:'var(--text-tertiary)', fontFamily: T.font.sans }}>Όριο απαλλαγής {feWhole(exemption)}</span>
          </>
        )}
        <Check checked={xferAgent} onChange={setXferAgent} label="Μεσίτης" hint="Μεσιτική αμοιβή ~2% + ΦΠΑ." />
      </div>
      {xferEffectivePrice>0?(<>
        <div style={{ display:'flex', flexDirection:'column' }}>
          {xfer.lines.map(l=>(
            <div key={l.key} title={l.note} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0' }}>
              <span style={{ flex:1, fontSize: 'var(--fs-base)', color:'var(--text-secondary)', fontFamily: T.font.sans }}>{l.label}</span>
              <span style={{ fontSize: 'var(--fs-base)', color:l.amount===0?'var(--text-tertiary)':'var(--text-primary)', fontVariantNumeric:'tabular-nums', fontFamily: T.font.sans, fontWeight:500 }}>{eur(l.amount)}</span>
            </div>
          ))}
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0 0', marginTop:4, borderTop:'1px solid var(--border-subtle)' }}>
            <span style={{ flex:1, fontSize:14, fontWeight:600, color:'var(--text-primary)', fontFamily: T.font.sans }}>Σύνολο εξόδων &amp; φόρων</span>
            <span style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', fontVariantNumeric:'tabular-nums', fontFamily: T.font.sans }}>{eur(xfer.totalCosts)} <span style={{ fontSize:12, fontWeight:500, color:'var(--text-tertiary)' }}>({pct(xfer.costPct)})</span></span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0 0' }}>
            <span style={{ flex:1, fontSize:14, fontWeight:600, color:'var(--text-primary)', fontFamily: T.font.sans }}>{xferSide==='buy'?'Συνολική εκταμίευση':'Καθαρό έσοδο πώλησης'}</span>
            <span style={{ fontSize:16, fontWeight:700, color:'var(--text-primary)', fontVariantNumeric:'tabular-nums', fontFamily: T.font.sans }}>{eur(xferSide==='buy'?(xfer.cashOut||0):(xfer.netProceeds||0))}</span>
          </div>
        </div>
        <p style={{ fontSize:12, color:'var(--text-tertiary)', margin:'14px 0 0', paddingTop:12, borderTop:'1px solid var(--border-subtle)', fontFamily: T.font.sans, lineHeight:1.55 }}>Ενδεικτική εκτίμηση. Τα ακριβή ποσά ορίζονται από συμβολαιογράφο ή την ΑΑΔΕ.<InfoHint>Τα ποσοστά είναι τα ισχύοντα. Τα κλιμακωτά συμβολαιογραφικά, η αντικειμενική αξία και οι απαλλαγές οριστικοποιούνται από συμβολαιογράφο, δικηγόρο ή την ΑΑΔΕ. Ο φόρος υπεραξίας 15% τελεί σε αναστολή.</InfoHint></p>
      </>):(
        <p style={{ fontSize: 'var(--fs-base)', color:'var(--text-tertiary)', fontFamily: T.font.sans, padding:'4px 0' }}>Δώσε τιμή για να δεις την ανάλυση κόστους.</p>
      )}
      </>)}
    </div>
  )
}

export function CashFlowFold({ cashOpen, setCashOpen, cash, year, maxCash }: Pick<AccountingProps & AccountingState,
  'cashOpen' | 'setCashOpen' | 'cash' | 'year' | 'maxCash'
>) {
  return (
    <Fold open={cashOpen} onToggle={()=>setCashOpen(o=>!o)} title="Ταμειακές ροές">
      {/* ═══ ΤΟ ΓΡΑΦΗΜΑ ΠΟΥ ΞΕΚΙΝΑ ΑΠΟ ΤΟ ΜΗΔΕΝ ══════════════════════════
          Ήταν δύο λωρίδες των έξι εικονοστοιχείων, στοιβαγμένες και οι δύο
          να ξεκινούν από την ίδια αριστερή άκρη: για να καταλάβεις αν ο
          μήνας ήταν θετικός έπρεπε να συγκρίνεις μήκη με το μάτι. Και ήταν
          πράσινη και κόκκινη, δηλαδή κάθε μήνας με έξοδα διαβαζόταν σαν
          προειδοποίηση.

          Τώρα ένας άξονας στο μηδέν, εκροή αριστερά, εισροή δεξιά. Το
          πρόσημο του μήνα φαίνεται από την πλευρά που βαραίνει, πριν
          διαβαστεί οποιοσδήποτε αριθμός. Οι επικεφαλίδες πάνω από τον
          άξονα ΕΙΝΑΙ το υπόμνημα — δεν ξαναγράφεται από κάτω. */}
      {cashOpen&&(cash.every(c=>!c.income&&!c.expense)?(
        <p style={{ fontSize: 'var(--fs-base)', color:'var(--text-tertiary)', fontFamily: T.font.sans, padding:'4px 0' }}>Καμία κίνηση για το {year}.</p>
      ):(<>
      <div style={{ display:'flex', alignItems:'center', gap:14, paddingBottom:8, marginBottom:4, borderBottom:'1px solid var(--border-subtle)' }}>
        <span style={{ width:104, flexShrink:0 }}/>
        <div style={{ flex:1, display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
          <span style={{ flex:1, textAlign:'right', display:'inline-flex', alignItems:'center', justifyContent:'flex-end', gap:6, fontSize: 'var(--fs-xs)', fontWeight:600, letterSpacing:'0.05em', textTransform:'uppercase', color:'var(--text-tertiary)', fontFamily: T.font.sans }}>
            <span style={{ width:8, height:8, borderRadius: T.radius.hair, background:'var(--series-out)' }}/>Έξοδα
          </span>
          <span style={{ width:1, flexShrink:0 }}/>
          <span style={{ flex:1, display:'inline-flex', alignItems:'center', gap:6, fontSize: 'var(--fs-xs)', fontWeight:600, letterSpacing:'0.05em', textTransform:'uppercase', color:'var(--text-tertiary)', fontFamily: T.font.sans }}>
            <span style={{ width:8, height:8, borderRadius: T.radius.hair, background:'var(--series-in)' }}/>Έσοδα
          </span>
        </div>
        <span style={{ width:110, flexShrink:0, textAlign:'right', fontSize: 'var(--fs-xs)', fontWeight:600, letterSpacing:'0.05em', textTransform:'uppercase', color:'var(--text-tertiary)', fontFamily: T.font.sans }}>Καθαρή ροή</span>
      </div>
      <div style={{ display:'flex', flexDirection:'column' }}>
        {cash.map((c,i)=>{ const net=c.income-c.expense; const empty=!c.income&&!c.expense; return (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:14, height:26 }}>
            <span style={{ width:104, flexShrink:0, fontSize:12, color:empty?'var(--text-tertiary)':'var(--text-secondary)', fontFamily: T.font.sans }}>{MONTHS_NOM[i]}</span>
            <div style={{ flex:1, display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
              <div style={{ flex:1, display:'flex', justifyContent:'flex-end', minWidth:0 }}>
                {c.expense>0&&<div title={`Έξοδα ${eur(c.expense)}`} style={{ height:11, borderRadius:'3px 1px 1px 3px', width:`${Math.max(1.5, c.expense/maxCash*100)}%`, background:'var(--series-out)' }}/>}
              </div>
              {/* Ο άξονας του μηδενός: μία γραμμή, σε κάθε σειρά, ώστε οι
                  δώδεκα μήνες να μετριούνται από το ίδιο σημείο. */}
              <span style={{ width:1, height:16, flexShrink:0, background:'var(--series-axis)' }}/>
              <div style={{ flex:1, minWidth:0 }}>
                {c.income>0&&<div title={`Έσοδα ${eur(c.income)}`} style={{ height:11, borderRadius:'1px 3px 3px 1px', width:`${Math.max(1.5, c.income/maxCash*100)}%`, background:'var(--series-in)' }}/>}
              </div>
            </div>
            <span style={{ width:110, flexShrink:0, textAlign:'right', fontSize:12, fontWeight:empty?400:600, color:empty?'var(--text-tertiary)':'var(--text-primary)', fontVariantNumeric:'tabular-nums', fontFamily: T.font.sans }}>{empty?'':eur(net)}</span>
          </div>
        )})}
      </div>
      {/* Το σύνολο της χρονιάς, μία φορά, στο ίδιο πλάτος με τη στήλη του. */}
      <div style={{ display:'flex', alignItems:'center', gap:14, marginTop:6, paddingTop:10, borderTop:'1px solid var(--border-default)' }}>
        <span style={{ flex:1, fontSize:12, fontWeight:600, color:'var(--text-secondary)', fontFamily: T.font.sans }}>Σύνολο</span>
        <span style={{ width:110, flexShrink:0, textAlign:'right', fontSize: 'var(--fs-base)', fontWeight:700, color:'var(--text-primary)', fontVariantNumeric:'tabular-nums', fontFamily: T.font.sans }}>
          {eur(cash.reduce((s,c)=>s+c.income-c.expense,0))}
        </span>
      </div>
      </>))}
    </Fold>
  )
}

export function TrialBalanceFold({ balanceOpen, setBalanceOpen, trial, year, jTotals }: Pick<AccountingProps & AccountingState,
  'balanceOpen' | 'setBalanceOpen' | 'trial' | 'year' | 'jTotals'
>) {
  return (
    <Fold open={balanceOpen} onToggle={()=>setBalanceOpen(o=>!o)} title="Ισοζύγιο διπλογραφικής">
      {trial.length===0?(
        <p style={{ fontSize: 'var(--fs-base)', color:'var(--text-tertiary)', fontFamily: T.font.sans, padding:'2px 0' }}>Δεν υπάρχουν εισπράξεις ή πληρωμές για το {year} ώστε να σχηματιστεί ισοζύγιο.</p>
      ):(
        /* ΤΟ ΙΣΟΖΥΓΙΟ ΗΤΑΝ ΠΙΝΑΚΑΣ ΓΡΑΜΜΕΝΟΣ ΜΕ divs. Πέντε στήλες ανά σειρά,
           κεφαλίδα από `span` κι ένα πλέγμα που κρατούσε τα πλάτη: για τον
           αναγνώστη οθόνης, εξήντα ασύνδετα κείμενα χωρίς κανένα να λέει σε
           ποια στήλη ανήκει ή σε ποιον λογαριασμό. Ιδιες στήλες, ίδια σειρά,
           ίδια λεκτικά — αλλάζει ΜΟΝΟ η δομή: thead/tbody/tfoot, ο κωδικός
           ΕΛΠ κλειδί της γραμμής (th scope="row"), τα ποσά `.num`. Το
           χειροποίητο overflowX+minWidth έγινε `.po-scroll-x` + `--tbl-min`
           κι το κουτί `.po-table-box` (radius 14 αντί 12, όπως οι άλλοι
           εννιά πίνακες). Το `--tbl-fs` δένεται στο `--fs-base` επειδή οι
           σειρές έγραφαν `var(--fs-base)`: σκέτη η κλάση θα τις κάρφωνε στα
           13 κι η αφή χάνει το εικονοστοιχείο που της δίνει το
           `pointer: coarse`. */
        <div className="po-table-box">
          <div className="po-scroll-x" style={{ WebkitOverflowScrolling:'touch' }}>
          <table className="po-table tbl-fixed" style={{ '--tbl-min': `${TRIAL_MIN}px`, '--tbl-fs': 'var(--fs-base)' }}>
            <caption>Ισοζύγιο διπλογραφικής</caption>
            <colgroup>
              <col style={{ width: trialCol(TRIAL_W.code) }}/>
              {/* Ο λογαριασμός παίρνει ό,τι περισσεύει, όπως το `1fr` του πλέγματος. */}
              <col/>
              <col style={{ width: trialCol(TRIAL_W.debit) }}/>
              <col style={{ width: trialCol(TRIAL_W.credit) }}/>
              <col style={{ width: trialCol(TRIAL_W.balance) }}/>
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Κωδικός ΕΛΠ</th>
                <th scope="col">Λογαριασμός</th>
                <th scope="col" className="num">Χρέωση</th>
                <th scope="col" className="num">Πίστωση</th>
                <th scope="col" className="num">Υπόλοιπο</th>
              </tr>
            </thead>
            <tbody>
              {trial.map(r=>(
                <tr key={r.code}>
                  <th scope="row">{r.code}</th>
                  <td className="po-elide" style={{ color:'var(--text-primary)' }} title={r.account}>{r.account}</td>
                  <td className="num" style={{ color:r.debit?'var(--text-secondary)':'var(--text-tertiary)' }}>{r.debit?eur(r.debit):fe(0)}</td>
                  <td className="num" style={{ color:r.credit?'var(--text-secondary)':'var(--text-tertiary)' }}>{r.credit?eur(r.credit):fe(0)}</td>
                  <td className="num" style={{ fontWeight:600, color:'var(--text-primary)' }}>{eur(r.balance)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {/* Η σειρά των συνόλων κρατά το φόντο που είχε· τη σκουρότερη
                  γραμμή από πάνω τη δίνει πλέον η `is-total`. Το «Σύνολα»
                  κάθεται στη στήλη του λογαριασμού, όπως πριν, οπότε το
                  πρώτο κελί μένει κενό αντί για colSpan που θα το μετακινούσε.
                  ΤΑ ΔΥΟ ΕΝΣΩΜΑΤΩΜΕΝΑ ΣΤΟ «Σύνολα» ΕΙΝΑΙ ΑΝΑΓΚΗ, ΟΧΙ ΓΟΥΣΤΟ:
                  η `.is-total` ζωγραφίζει τη γραμμή μόνο σε `td`, οπότε χωρίς
                  το `borderTop` η σκούρα γραμμή θα έσπαγε στη μέση της σειράς
                  — κι ένα `th` εκτός `thead`/`tbody` το κεντράρει ο περιηγητής
                  από μόνος του, ενώ στο πλέγμα η ετικέτα ήταν αριστερά. */}
              <tr className="is-total" style={{ background:'var(--bg-elevated)' }}>
                <td/>
                <th scope="row" style={{ textAlign:'left', borderTop:'1px solid var(--border-default)', fontSize: 'var(--fs-xs)', fontWeight:700, color:'var(--text-primary)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Σύνολα</th>
                <td className="num" style={{ fontWeight:700 }}>{eur(jTotals.debit)}</td>
                <td className="num" style={{ fontWeight:700 }}>{eur(jTotals.credit)}</td>
                <td className="num" style={{ fontSize: 'var(--fs-xs)', fontWeight:600, color:jTotals.balanced?'var(--text-tertiary)':'var(--negative)' }}>
                  {/* Το εικονίδιο με το λεκτικό του μένουν σε μία γραμμή: το
                      flex μπαίνει σε span μέσα στο κελί, γιατί `display:flex`
                      πάνω στο `<td>` σβήνει το κελί από τη διάταξη πίνακα. */}
                  <span style={{ display:'inline-flex', alignItems:'center', gap: 4, whiteSpace:'nowrap' }}>
                    {jTotals.balanced?<><svg aria-hidden="true" width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="var(--positive)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}><path d="M20 6 9 17l-5-5"/></svg>Ισοσκελισμένο</>:<>Διαφορά {eur(jTotals.debit-jTotals.credit)}</>}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
          </div>
        </div>
        )}
      {/* ΤΡΕΙΣ ΠΡΟΤΑΣΕΙΣ ΟΡΙΣΜΟΥ ΚΑΤΩ ΑΠΟ ΠΙΝΑΚΑ ΠΟΥ ΛΕΕΙ ΗΔΗ «ΙΣΟΣΚΕΛΙΣΜΕΝΟ».
          Απαντούσαν ερώτηση που δεν είχε κάνει κανείς: ποιο πρότυπο, ποιο
          έντυπο, ποια αντιστοιχία με το παλιό ΕΓΛΣ. Μένει η μία φράση που
          λέει ΤΙ κοιτάς· ο ορισμός και η νομική βάση ανοίγουν με πάτημα. */}
      <p style={{ fontSize: 'var(--fs-xs)', color:'var(--text-tertiary)', margin:'12px 0 0', fontFamily: T.font.sans, lineHeight:1.55 }}>Ταμειακή βάση, κατά τα Ελληνικά Λογιστικά Πρότυπα.<InfoHint>Σχέδιο λογαριασμών του ν. 4308/2014, αυτό που τροφοδοτεί το έντυπο Ε3. Κάθε άρθρο ισοσκελισμένο (χρέωση ίση με πίστωση), έτοιμο για καταχώρηση από τον λογιστή σου. Η αντιστοιχία με το παλιό ΕΓΛΣ, για όποιο λογιστήριο τη χρειάζεται, ταξιδεύει στο Excel.</InfoHint></p>
    </Fold>
  )
}
