'use client'
// ═══════════════════════════════════════════════════════════════════════════
// ΠΡΟΣΤΑΣΙΑ ΙΔΙΟΚΤΗΤΗ · PHASE 1: ΠΛΗΡΟΦΟΡΙΕΣ, ΕΠΙΛΟΓΕΣ, ΧΕΙΡΟΚΙΝΗΤΗ ΚΑΤΑΧΩΡΙΣΗ
// ─────────────────────────────────────────────────────────────────────────
// Ο χρήστης γράφει τις ημερομηνίες των εγγράφων που έλαβε, η μηχανή
// (lib/legal/enforcement/engine.ts) βγάζει χρονοδιάγραμμα και εδώ φαίνεται.
//
// ΤΙΠΟΤΑ ΔΕΝ ΑΠΟΘΗΚΕΥΕΤΑΙ. Ούτε στη βάση, ούτε στον περιηγητή: τα στοιχεία ζουν
// στη μνήμη της σελίδας και χάνονται όταν κλείσει. Κανένα ημερολόγιο, καμία
// εξαγωγή, καμία Νόα, κανένα λογιστικό γραφείο δεν τα βλέπει, γιατί δεν
// υπάρχουν πουθενά για να τα δει. Η μόνη ανάγνωση από τη βάση είναι οι επαφές
// του ίδιου του χρήστη με ρόλο «Δικηγόρος».
//
// Φορτώνεται τεμπέλικα (ProstasiaEntry.tsx): δεν ταξιδεύει με τον Οδηγό δανείου.
// Κανένα κόκκινο, καμία αντίστροφη μέτρηση σε μεγάλα ψηφία (προδιαγραφή §4.2).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState } from 'react'
import { T, Btn, ChipToggle } from '@/components/Theme'
import { grDate } from '@/lib/core/format'
import { athensToday } from '@/lib/core/time'
import { calmAllowed, computeTimeline, type CaseFacts, type DateFact, type Item, type Received } from '@/lib/legal/enforcement/engine'
import { displayable } from '@/lib/legal/enforcement/gate'
import { rule, RULES_CHECKED_AT } from '@/lib/legal/enforcement/rules'
import {
  ANSWER, CHECKS_TITLE, FIELDS, INTRO, NEXT, REASONS, RECEIVED_OPTIONS, WHOSE,
  basisLine, cardBadge, itemBadge, checkText, footer, itemBody, itemTitle, longDate, optionCards, relDays,
} from '@/lib/legal/enforcement/copy'
import * as contactStore from '@/lib/data/contacts'
import { createClient } from '@/lib/supabase/client'
import { DatePicker, CustomSelect } from '../UIComponents'

type Mode = 'unset' | 'date' | 'unknown' | 'none'
type DateAnswer = { mode: Mode; date: string }
type DateKey = 'epitagi' | 'seizure' | 'auction' | 'continuation' | 'servicerRequest' | 'exodikastikos'
type Answers = {
  received: Received | ''
  dates: Record<DateKey, DateAnswer>
  auctionFirst: 'yes' | 'no' | 'unknown' | ''
  publicDebt: 'yes' | 'no' | 'unknown' | ''
}

const EMPTY: DateAnswer = { mode: 'unset', date: '' }
const START: Answers = {
  received: '',
  dates: { epitagi: EMPTY, seizure: EMPTY, auction: EMPTY, continuation: EMPTY, servicerRequest: EMPTY, exodikastikos: EMPTY },
  auctionFirst: '', publicDebt: '',
}

/** Ποια πεδία ημερομηνίας ρωτάμε, ανάλογα με το τι έλαβε. */
function visibleDates(a: Answers): DateKey[] {
  if (!a.received) return []
  if (a.received === 'diatagi') return []
  if (a.received === 'dimosio') return []
  const out: DateKey[] = ['epitagi', 'seizure', 'auction']
  if (a.received === 'synexisi') out.push('continuation')
  out.push('servicerRequest')
  if (a.dates.auction.mode === 'date') out.push('exodikastikos')
  return out
}
/** Τα προαιρετικά: χωρίς απάντηση υπολογίζουμε με σήμερα. */
const OPTIONAL: DateKey[] = ['exodikastikos']

const toFact = (d: DateAnswer): DateFact => (d.mode === 'date' && d.date ? d.date : d.mode === 'unknown' ? 'unknown' : null)

function toFacts(a: Answers): CaseFacts {
  return {
    asset: 'property', received: a.received as Received,
    epitagi: toFact(a.dates.epitagi), seizure: toFact(a.dates.seizure), auction: toFact(a.dates.auction),
    continuation: toFact(a.dates.continuation), servicerRequest: toFact(a.dates.servicerRequest),
    exodikastikos: toFact(a.dates.exodikastikos),
    auctionFirst: (a.auctionFirst || 'unknown') as CaseFacts['auctionFirst'],
    publicDebt: (a.publicDebt || 'unknown') as CaseFacts['publicDebt'],
  }
}

/** Η πρώτη ερώτηση που λείπει, για να την ονομάσει το κουμπί που δεν πατιέται. */
function firstMissing(a: Answers): string | null {
  if (!a.received) return FIELDS.received.label
  for (const k of visibleDates(a)) {
    const d = a.dates[k]
    if (OPTIONAL.includes(k)) { if (d.mode === 'date' && !d.date) return FIELDS[k].label; continue }
    if (d.mode === 'unset' || (d.mode === 'date' && !d.date)) return FIELDS[k].label
  }
  if (a.dates.auction.mode === 'date' && !a.auctionFirst) return FIELDS.auctionFirst.label
  if (!a.publicDebt) return FIELDS.publicDebt.label
  return null
}

function complete(a: Answers): boolean {
  if (!a.received || !a.publicDebt) return false
  for (const k of visibleDates(a)) {
    const d = a.dates[k]
    if (OPTIONAL.includes(k)) { if (d.mode === 'date' && !d.date) return false; continue }
    if (d.mode === 'unset' || (d.mode === 'date' && !d.date)) return false
  }
  if (a.dates.auction.mode === 'date' && !a.auctionFirst) return false
  return true
}

// ── Μικρά δομικά ─────────────────────────────────────────────────────────
const muted = { fontSize: 'var(--fs-note)', color: 'var(--text-secondary)', lineHeight: 1.6, fontFamily: T.font.sans } as const
const small = { fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', lineHeight: 1.55, fontFamily: T.font.sans } as const
const card = { background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.inner, padding: 14 } as const
const h3 = { fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-primary)', fontFamily: T.font.sans, lineHeight: 1.4, margin: 0 } as const

function Badge({ text }: { text: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid var(--border-subtle)', borderRadius: T.radius.pill, padding: '4px 10px', ...small, color: 'var(--text-secondary)' }}>
      <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      {text}
    </span>
  )
}

/**
 * Ημερομηνία με πλήρη ανάγνωση για αναγνώστες οθόνης. Κρυφό κείμενο, όχι
 * `aria-label`: σε `<time>` χωρίς ρόλο πολλοί αναγνώστες αγνοούν το label.
 */
function D({ iso, strong }: { iso: string; strong?: boolean }) {
  return (
    <time dateTime={iso} style={{ fontWeight: strong ? 600 : 500, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
      <span aria-hidden="true">{grDate(iso)}</span><span className="sr-only">{longDate(iso)}</span>
    </time>
  )
}

/** Οι δύο πηγές του κανόνα διαφωνούν στη διατύπωση (π.χ. ΦΕΚ και κωδικοποίηση). */
const discrepancies = (ruleIds: string[]): string[] =>
  ruleIds.map(rule).map(r => r.discrepancy).filter((d): d is string => !!d)

function Sources({ ruleIds }: { ruleIds: string[] }) {
  const rules = ruleIds.map(rule).filter(r => r.status === 'verified')
  if (!rules.length) return null
  return (
    <details style={{ marginTop: 8 }}>
      <summary style={{ ...small, cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center' }}>Γιατί: διάταξη και πηγές</summary>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6 }}>
        {rules.map(r => (
          <div key={r.id}>
            <p style={{ ...muted, margin: 0, fontWeight: 500 }}>{r.provision} · {r.amendedBy}</p>
            {r.sources.map((s, i) => (
              <div key={i} style={{ marginTop: 6 }}>
                <blockquote style={{ ...small, margin: '0 0 2px', paddingLeft: 10, borderLeft: '2px solid var(--border-default)' }}>«{s.excerpt.join(' … ')}»</blockquote>
                <a href={s.url} target="_blank" rel="noreferrer" style={{ ...small, color: 'var(--text-secondary)' }}>{s.title}</a>
              </div>
            ))}
            {r.ambiguities.length > 0 && (
              <ul style={{ ...small, margin: '6px 0 0', paddingLeft: 16 }}>{r.ambiguities.map((x, i) => <li key={i}>{x}</li>)}</ul>
            )}
          </div>
        ))}
      </div>
    </details>
  )
}

function DateField({ k, value, onChange, allowNone }: { k: DateKey; value: DateAnswer; onChange: (v: DateAnswer) => void; allowNone: boolean }) {
  const f = FIELDS[k]
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <legend style={{ ...h3, marginBottom: 4 }}>{f.label}</legend>
      <p style={{ ...small, margin: 0 }}>{f.where}{'why' in f ? ` ${f.why()}` : ''}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <div style={{ minWidth: 200, flex: '1 1 200px' }}>
          <DatePicker ariaLabel={f.label} value={value.mode === 'date' ? value.date : ''} onChange={v => onChange({ mode: 'date', date: v })}/>
        </div>
        <ChipToggle size="lg" on={value.mode === 'unknown'} onClick={() => onChange({ mode: 'unknown', date: '' })}>{ANSWER.unknown}</ChipToggle>
        {allowNone && <ChipToggle size="lg" on={value.mode === 'none'} onClick={() => onChange({ mode: 'none', date: '' })}>{ANSWER.none}</ChipToggle>}
      </div>
    </fieldset>
  )
}

function Choice<V extends string>({ label, where, value, options, onChange }: { label: string; where: string; value: V | ''; options: { value: V; label: string }[]; onChange: (v: V) => void }) {
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <legend style={{ ...h3, marginBottom: 4 }}>{label}</legend>
      <p style={{ ...small, margin: 0 }}>{where}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {options.map(o => <ChipToggle key={o.value} size="lg" on={value === o.value} onClick={() => onChange(o.value)}>{o.label}</ChipToggle>)}
      </div>
    </fieldset>
  )
}

function SpanLine({ i, today }: { i: Item; today: string }) {
  const s = i.span
  if (!s) return null
  if (s.earliest === s.latest) {
    const lead = i.kind === 'expected' ? 'Περίπου έως ' : i.kind === 'upcoming' ? 'Κατά τον υπολογισμό μας: ' : ''
    const past = s.safe < today
    return <p style={{ ...muted, margin: '6px 0 0' }}>{lead}<D iso={s.safe} strong/> · {relDays(s.safe, today)}{past && i.kind !== 'fixed' ? '. Η ημερομηνία αυτή έχει περάσει.' : ''}</p>
  }
  if (i.kind === 'cutoff') {
    if (i.past) return <p style={{ ...muted, margin: '6px 0 0' }}>Η τελευταία ημέρα για να μείνει ο πλειστηριασμός έξω από το διάστημα ήταν η <D iso={s.earliest}/> και έχει περάσει.</p>
    return <p style={{ ...muted, margin: '6px 0 0' }}>Οριστική υποβολή έως <D iso={s.earliest} strong/>· η <D iso={s.latest}/> είναι οριακή.</p>
  }
  if (i.kind === 'window') {
    return <p style={{ ...muted, margin: '6px 0 0' }}>Συνήθως από <D iso={s.earliest}/> έως <D iso={s.latest}/>.</p>
  }
  const forUser = i.kind === 'deadline'
  return (
    <div style={{ marginTop: 6 }}>
      <p style={{ ...muted, margin: 0 }}>Κατά τον υπολογισμό μας, από <D iso={s.earliest}/> έως <D iso={s.latest}/>.</p>
      {forUser
        ? (i.past
          ? <p style={{ ...muted, margin: '4px 0 0' }}>Η ασφαλής ημερομηνία (<D iso={s.safe} strong/>) έχει περάσει. Μίλησε με δικηγόρο σήμερα για το τι ισχύει.</p>
          : <p style={{ ...muted, margin: '4px 0 0' }}>Για ασφάλεια: <D iso={s.safe} strong/>, {relDays(s.safe, today)}. Μίλα με δικηγόρο αρκετές ημέρες πριν.</p>)
        : <p style={{ ...muted, margin: '4px 0 0' }}>Όχι πριν από <D iso={s.safe} strong/>.</p>}
    </div>
  )
}

function TimelineItem({ i, today, current }: { i: Item; today: string; current: boolean }) {
  const diffs = discrepancies(i.ruleIds)
  const badge = itemBadge(i.kind, i.tier, diffs.length > 0)
  const basis = basisLine(i)
  return (
    <li aria-current={current ? 'step' : undefined} style={{ ...card, listStyle: 'none', borderLeft: `3px solid ${current ? 'var(--accent)' : 'var(--border-default)'}` }}>
      <p style={{ ...small, margin: '0 0 4px', textTransform: 'none' }}>{current ? 'Πού βρίσκεσαι · ' : ''}{WHOSE[i.kind]}</p>
      <h5 style={h3}>{itemTitle(i)}</h5>
      <p style={{ ...muted, margin: '6px 0 0' }}>{itemBody(i)}</p>
      <SpanLine i={i} today={today}/>
      {basis && <p style={{ ...small, margin: '6px 0 0' }}>{basis}</p>}
      {i.kind !== 'ask-lawyer' && i.reasons.filter(r => REASONS[r]).length > 0 && (
        <ul style={{ ...small, margin: '6px 0 0', paddingLeft: 16 }}>{i.reasons.filter(r => REASONS[r]).map(r => <li key={r}>{REASONS[r]}</li>)}</ul>
      )}
      {diffs.map(d => <p key={d} style={{ ...small, margin: '6px 0 0' }}>Οι πηγές διαφέρουν: {d}</p>)}
      <div style={{ marginTop: 8 }}><Badge text={badge}/></div>
      <Sources ruleIds={i.ruleIds}/>
    </li>
  )
}

type Lawyer = { full_name: string | null; phone: string | null; email: string | null; role: string | null }

function useLawyers(userId: string): Lawyer[] | null {
  const [rows, setRows] = useState<Lawyer[] | null>(null)
  useEffect(() => {
    let alive = true
    const db = createClient()
    contactStore.ofUser<Lawyer>(db, userId, 'full_name, phone, email, role')
      .then(r => { if (alive) setRows(r.filter(c => c.role === 'lawyer')) })
      .catch(() => { if (alive) setRows([]) })
    return () => { alive = false }
  }, [userId])
  return rows
}

export default function Prostasia({ userId }: { userId: string }) {
  const [started, setStarted] = useState(false)
  const [answers, setAnswers] = useState<Answers>(START)
  const [shown, setShown] = useState(false)
  const resultRef = useRef<HTMLHeadingElement>(null)
  const today = athensToday()
  const lawyers = useLawyers(userId)

  const facts = useMemo(() => (shown ? toFacts(answers) : null), [shown, answers])
  const timeline = useMemo(() => (facts ? computeTimeline(facts, today) : null), [facts, today])
  const cards = useMemo(() => {
    const showDebt = answers.publicDebt !== 'no' || answers.received === 'dimosio'
    return optionCards().filter(c => c.when !== 'public-debt' || showDebt)
  }, [answers.publicDebt, answers.received])

  useEffect(() => { if (shown) resultRef.current?.focus() }, [shown])

  const setDate = (k: DateKey, v: DateAnswer) => setAnswers(a => ({ ...a, dates: { ...a.dates, [k]: v } }))

  const dated = timeline?.items.filter(i => i.kind !== 'ask-lawyer') ?? []
  const ask = timeline?.items.filter(i => i.kind === 'ask-lawyer') ?? []
  const currentKey = dated.find(i => i.kind === 'deadline' && !i.past)?.key
  // «Υπάρχει χρόνος» μόνο όταν η μηχανή μπορεί να το στηρίξει (calmAllowed).
  const urgent = !!timeline && !!facts && !calmAllowed(timeline, facts, today)
  const done = (['epitagi', 'seizure', 'continuation', 'servicerRequest'] as const)
    .filter(k => answers.dates[k].mode === 'date' && answers.dates[k].date)

  return (
    <section aria-labelledby="prostasia-title" style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: T.font.sans }}>
      <h3 id="prostasia-title" style={{ ...h3, fontSize: 18 }}>{INTRO.title}</h3>

      {!started && (
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <ul style={{ ...muted, margin: 0, paddingLeft: 16 }}>{INTRO.lines.map(l => <li key={l}>{l}</li>)}</ul>
          <div><Btn variant="primary" onClick={() => setStarted(true)}>Καταχώρηση με το χέρι</Btn></div>
        </div>
      )}

      {started && !shown && (
        <form onSubmit={e => { e.preventDefault(); if (complete(answers)) setShown(true) }} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ maxWidth: 420 }}>
            <CustomSelect label={FIELDS.received.label} value={answers.received} placeholder="Διάλεξε"
              options={RECEIVED_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
              onChange={v => setAnswers(a => ({ ...a, received: v as Received }))}/>
            <p style={{ ...small, margin: '6px 0 0' }}>{FIELDS.received.where}</p>
          </div>
          {visibleDates(answers).map(k => (
            <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <DateField k={k} value={answers.dates[k]} onChange={v => setDate(k, v)} allowNone={k !== 'auction' || answers.received !== 'perilipsi'}/>
              {k === 'auction' && answers.dates.auction.mode === 'date' && (
                <Choice label={FIELDS.auctionFirst.label} where={FIELDS.auctionFirst.where} value={answers.auctionFirst}
                  options={[{ value: 'yes', label: ANSWER.yes }, { value: 'no', label: ANSWER.no }, { value: 'unknown', label: ANSWER.unknown }]}
                  onChange={v => setAnswers(a => ({ ...a, auctionFirst: v }))}/>
              )}
            </div>
          ))}
          {answers.received && (
            <Choice label={FIELDS.publicDebt.label} where={FIELDS.publicDebt.where} value={answers.publicDebt}
              options={[{ value: 'yes', label: ANSWER.yes }, { value: 'no', label: ANSWER.no }, { value: 'unknown', label: ANSWER.unknown }]}
              onChange={v => setAnswers(a => ({ ...a, publicDebt: v }))}/>
          )}
          <div style={{ position: 'sticky', bottom: 'env(safe-area-inset-bottom, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)', background: 'var(--bg-surface)' }}>
            <Btn variant="primary" type="submit" disabled={!complete(answers)} describedBy={complete(answers) ? undefined : 'prostasia-missing'}>Δες το χρονοδιάγραμμα</Btn>
            {!complete(answers) && <p id="prostasia-missing" style={{ ...small, margin: '6px 0 0' }}>Λείπει απάντηση: «{firstMissing(answers)}». Το «{ANSWER.unknown}» είναι απάντηση.</p>}
          </div>
        </form>
      )}

      {shown && timeline && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h4 ref={resultRef} tabIndex={-1} style={{ ...h3, fontSize: 18, outline: 'none' }}>Το χρονοδιάγραμμά σου</h4>
          <p style={{ ...muted, margin: 0 }}>{urgent ? INTRO.urgent : INTRO.calm}</p>
          <div><Btn variant="secondary" onClick={() => setShown(false)}>Κάτι δεν ταιριάζει; Διόρθωσε τα στοιχεία</Btn></div>

          {done.length > 0 && (
            <div>
              <h4 style={{ ...h3, marginBottom: 6 }}>Τι έχει γίνει</h4>
              <ul style={{ ...muted, margin: 0, paddingLeft: 16 }}>
                {done.map(k => <li key={k}>{FIELDS[k].label.replace(/;$/, '')}: <D iso={answers.dates[k].date}/></li>)}
              </ul>
            </div>
          )}

          {timeline.checks.length > 0 && (
            <div role="note" style={{ ...card, borderLeft: '3px solid var(--border-default)' }}>
              <h4 style={h3}>{CHECKS_TITLE}</h4>
              <ul style={{ ...muted, margin: '6px 0 0', paddingLeft: 16 }}>{timeline.checks.map((c, n) => <li key={n}>{checkText(c)}</li>)}</ul>
            </div>
          )}

          {dated.length > 0 && (
            <div>
              <h4 style={{ ...h3, marginBottom: 8 }}>Τι ακολουθεί</h4>
              <ol style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {dated.map(i => <TimelineItem key={i.key} i={i} today={today} current={i.key === currentKey}/>)}
              </ol>
            </div>
          )}

          {ask.length > 0 && (
            <div>
              <h4 style={{ ...h3, marginBottom: 8 }}>Ρώτα δικηγόρο για αυτά</h4>
              <ul style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {ask.map(i => <TimelineItem key={i.key} i={i} today={today} current={false}/>)}
              </ul>
            </div>
          )}

          <div>
            <h4 style={{ ...h3, marginBottom: 8 }}>Οι επιλογές σου</h4>
            <p style={{ ...small, margin: '0 0 8px' }}>Με σταθερή σειρά. Καμία δεν είναι «η καλύτερη»· εξαρτάται από την περίπτωσή σου.</p>
            <ul style={{ margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: 10 }}>
              {cards.map(c => {
                const gates = c.ruleIds.map(id => { const g = displayable(rule(id), today); return g.ok ? g : displayable({ ...rule(id), validFrom: today }, today) })
                return (
                  <li key={c.id} style={{ ...card, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <h5 style={h3}>{c.title}</h5>
                    <p style={{ ...muted, margin: 0 }}>{c.what}</p>
                    <p style={{ ...small, margin: 0 }}><strong>Σε ποιον ταιριάζει:</strong> {c.fits}</p>
                    <p style={{ ...small, margin: 0 }}><strong>Για τον πλειστηριασμό:</strong> {c.auction}</p>
                    <p style={{ ...small, margin: 0 }}><strong>Πρώτο βήμα:</strong> {c.first}</p>
                    {discrepancies(c.ruleIds).map(d => <p key={d} style={{ ...small, margin: 0 }}>Οι πηγές διαφέρουν: {d}</p>)}
                    <div><Badge text={cardBadge(gates, discrepancies(c.ruleIds).length > 0)}/></div>
                    <Sources ruleIds={c.ruleIds}/>
                  </li>
                )
              })}
            </ul>
          </div>

          <div>
            <h4 style={{ ...h3, marginBottom: 6 }}>{NEXT.title}</h4>
            <p style={{ ...muted, margin: '0 0 6px' }}>{NEXT.lawyer}</p>
            <ul style={{ ...muted, margin: 0, paddingLeft: 16 }}>{NEXT.docs.map(d => <li key={d}>{d}</li>)}</ul>
            {lawyers && lawyers.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <p style={{ ...small, margin: '0 0 4px' }}>{NEXT.myLawyers}</p>
                <ul style={{ ...muted, margin: 0, paddingLeft: 16 }}>
                  {lawyers.map((l, n) => (
                    <li key={n}>{l.full_name ?? ''}{l.phone ? <> · <a href={`tel:${l.phone}`} style={{ color: 'var(--text-secondary)' }}>{l.phone}</a></> : null}{l.email ? <> · <a href={`mailto:${l.email}`} style={{ color: 'var(--text-secondary)' }}>{l.email}</a></> : null}</li>
                  ))}
                </ul>
              </div>
            )}
            {lawyers && lawyers.length === 0 && <p style={{ ...small, margin: '8px 0 0' }}>{NEXT.noLawyer}</p>}
          </div>
        </div>
      )}

      <p style={{ ...small, margin: 0, borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>{footer(RULES_CHECKED_AT)}</p>
    </section>
  )
}
