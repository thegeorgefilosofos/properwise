'use client'
// ═══════════════════════════════════════════════════════════════════════════
// ΤΙ ΠΑΕΙ ΣΤΟΝ ΛΟΓΙΣΤΗ.
//
// Η ΟΘΟΝΗ ΕΧΕΙ ΕΝΑ ΜΟΝΟ ΚΑΘΗΚΟΝ: να κάνει ορατό μέσα σε δύο δευτερόλεπτα ότι
// από τα έντεκα πράγματα, τα έξι τα βγάζει το εργαλείο, τα τρία τα κάνει ο
// λογιστής και μόνο δύο είναι δικά σου. Γι' αυτό η ομαδοποίηση είναι κατά
// ΠΟΙΟΝ και όχι κατά θέμα και γι' αυτό η ομάδα «Χρειάζεται από εσένα» είναι
// πρώτη: είναι η μόνη που ζητά ενέργεια.
//
// ΚΑΘΕ ΓΡΑΜΜΗ ΛΕΕΙ ΤΟ ΓΙΑΤΙ ΤΗΣ. Ο χρήστης που δεν καταλαβαίνει γιατί ζητάμε
// ένα χαρτί, δεν το φέρνει. Το `why` δεν είναι διακόσμηση, είναι ο λόγος που
// θα σηκωθεί να ψάξει στο myAADE.
//
// ΤΑ ΜΠΛΟΚΑΡΙΣΤΙΚΑ ΞΕΧΩΡΙΖΟΥΝ ΧΩΡΙΣ ΝΑ ΟΥΡΛΙΑΖΟΥΝ. Μια ήσυχη ετικέτα, όχι
// κόκκινο. Οι παγίδες είναι συμβουλή, όχι κατηγορία: ο χρήστης δεν έφταιξε που
// δεν ήξερε ότι το τέλος ανθεκτικότητας δεν είναι έσοδό του.
//
// Η ΛΟΓΙΚΗ ΔΕΝ ΖΕΙ ΕΔΩ. Ποιος φέρνει τι, τι μπλοκάρει, ποιος βλέπει ισολογισμό:
// όλα στο lib/accounting/dossier.ts, δοκιμασμένα. Εδώ μόνο η εικόνα τους.
// ═══════════════════════════════════════════════════════════════════════════

import dynamic from 'next/dynamic'
import { useState, useEffect, useMemo, useRef, useCallback, useId } from 'react'
import { createClient } from '@/lib/supabase/client'
import { T, TT, SelectBox, Bar, Btn, ChipToggle } from '@/components/Theme'
import { ActionMenu, type ActionMenuItem } from '@/components/ActionMenu'
import { ChevronDown, ChevronRight, Download } from 'lucide-react'
import { InfoHint } from './InfoHint'
import {
  groupByWho, traps, defaultBookkeeping, effectiveBookkeeping,
  yearStatusLabel, LEGAL_FORM_LABEL,
  type LegalForm, type BookKeeping, type Requirement,
} from '@/lib/accounting/dossier'
import { dossierCompleteness, type CompletenessProperty, type YearData } from '@/lib/facts/completeness'
import type { DossierAttachment } from './accountantExport';
import type { AccountantStatementLine, AccountantMovement } from './accountantTypes';
import { exportAccountantDossier } from './sheets';
import type { FixedAsset } from '@/lib/accounting/fixedAssets'
import type { VatDeduction } from '@/lib/tax/myData'
import { failed } from '@/lib/core/dbError';
import { openRequests, answerRequest, type OpenRequest } from '@/lib/data/accountant';
import { aadeTitle } from '@/components/AadeLink';
import { aadePath, AADE_DESTINATIONS } from '@/lib/tax/aade';
import MeetingPackCard from './MeetingPackCard';
import AccountantInvites from './AccountantInvites';

// Φαίνεται μόνο σε όποιον έχει δώσει πρόσβαση σε γραφείο· φορτώνεται στον περιηγητή.
const FirmDaySummary = dynamic(() => import('./FirmAccess').then(m => m.FirmDaySummary), { ssr: false })

// ── Οι παραδοχές που ορίζουν τη λίστα ──────────────────────────────────────
export interface DossierProfile {
  form: LegalForm
  books: BookKeeping
  hasRenovation: boolean
  hasLoan: boolean
  ownershipChanged: boolean
}

export interface DossierState {
  profile: DossierProfile
  setProfile: (patch: Partial<DossierProfile>) => void
  /** Τα δικαιολογητικά που ο χρήστης δήλωσε ότι έχει ήδη. */
  have: string[]
  toggle: (id: string) => void
  loaded: boolean
  /** Μήνυμα αποτυχίας αποθήκευσης — δεν κρύβεται, αλλά δεν σταματά τη δουλειά. */
  error: string | null
  /** Τι απέτυχε: η φόρτωση ή η αποθήκευση. Το «Δοκίμασε ξανά» κάνει το ίδιο. */
  errorKind: 'load' | 'save' | null
  /**
   * Ξαναδοκιμάζει ό,τι απέτυχε. ΜΕΤΑ ΑΠΟ ΑΠΟΤΥΧΗΜΕΝΗ ΦΟΡΤΩΣΗ ΞΑΝΑΔΙΑΒΑΖΕΙ, δεν
   * γράφει: η οθόνη κρατά τότε τις προεπιλογές και μια αποθήκευση θα τις έγραφε
   * πάνω στις σημειώσεις που ο χρήστης έχει ήδη στη βάση.
   */
  retry: () => void
}

const BOOKS_LABEL: Record<BookKeeping, string> = {
  none: 'Χωρίς βιβλία',
  single_entry: 'Απλογραφικά',
  double_entry: 'Διπλογραφικά',
}

const DEFAULTS: DossierProfile = { form: 'individual', books: 'none', hasRenovation: false, hasLoan: false, ownershipChanged: false }

/**
 * Η κατάσταση του φακέλου, μόνιμη ανά χρήστη και ΑΝΑ ΕΤΟΣ.
 *
 * Ζει σε hook και όχι μέσα στο component, γιατί την ίδια απάντηση («απλογραφικά
 * ή διπλογραφικά;») τη χρειάζεται και η καρτέλα Λογιστικής για να κρύψει τον
 * ισολογισμό από όποιον δεν τον έχει. Μία πηγή, δύο καταναλωτές.
 */
export function useAccountantDossier(userId: string, year: number, seed?: Partial<DossierProfile>): DossierState {
  const supabase = useMemo(() => createClient(), [])
  const [profile, setProfileState] = useState<DossierProfile>({ ...DEFAULTS, ...seed })
  const [have, setHave] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorKind, setErrorKind] = useState<'load' | 'save' | null>(null)
  // Κάθε αύξηση ξαναδιαβάζει τον φάκελο (το «Δοκίμασε ξανά» μετά από φόρτωση).
  const [attempt, setAttempt] = useState(0)
  // Το seed αλλάζει ταυτότητα σε κάθε render· κρατιέται σε ref ώστε να μην
  // ξαναφορτώνει ο φάκελος σε κάθε πληκτρολόγηση αλλού στην οθόνη.
  const seedRef = useRef(seed)
  useEffect(() => { seedRef.current = seed })

  // Γράφουμε ΜΟΝΟ μετά από πραγματική ενέργεια του χρήστη: η φόρτωση δεν πρέπει
  // να δημιουργεί γραμμή, αλλιώς κάθε άνοιγμα της καρτέλας θα «αποφάσιζε» για
  // λογαριασμό του χρήστη ότι είναι φυσικό πρόσωπο χωρίς βιβλία.
  const dirty = useRef(false)

  useEffect(() => {
    let alive = true
    dirty.current = false
    ;(async () => {
      setLoaded(false)
      const { data, error: err } = await supabase
        .from('accountant_dossier')
        .select('have_ids,legal_form,bookkeeping,has_renovation,has_loan,ownership_changed')
        .eq('user_id', userId).eq('year', year).maybeSingle()
      if (!alive) return
      if (data) {
        const row = data as Record<string, unknown>
        const form = (row.legal_form as LegalForm) || 'individual'
        setProfileState({
          form,
          // Ο ιδιώτης δεν έχει βιβλία, όποια κι αν είναι η στήλη (lib/accounting/dossier.ts).
          books: effectiveBookkeeping(form, (row.bookkeeping as BookKeeping) || 'none'),
          hasRenovation: !!row.has_renovation,
          hasLoan: !!row.has_loan,
          ownershipChanged: !!row.ownership_changed,
        })
        setHave(Array.isArray(row.have_ids) ? (row.have_ids as string[]) : [])
      } else {
        // Καμία γραμμή ακόμη: ξεκινάμε από ό,τι ξέρει ήδη η εφαρμογή (π.χ. έχει
        // δάνειο), χωρίς να γράψουμε τίποτα πριν αγγίξει ο χρήστης κάτι.
        setProfileState({ ...DEFAULTS, ...seedRef.current })
        setHave([])
        if (err) console.warn('accountant_dossier: αν ο πίνακας λείπει, δεν έχει εφαρμοστεί το migration του', err)
      }
      setError(err ? failed('Οι σημειώσεις του φακέλου δεν φορτώθηκαν', err) : null)
      setErrorKind(err ? 'load' : null)
      setLoaded(true)
    })()
    return () => { alive = false }
  }, [supabase, userId, year, attempt])

  const persist = useCallback(async (next: DossierProfile, nextHave: string[]) => {
    const { error: err } = await supabase.from('accountant_dossier').upsert({
      user_id: userId, year,
      have_ids: nextHave,
      legal_form: next.form, bookkeeping: next.books,
      has_renovation: next.hasRenovation, has_loan: next.hasLoan, ownership_changed: next.ownershipChanged,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,year' })
    // ΤΟ ΡΗΜΑ ΕΙΝΑΙ ΤΟΥ ΣΦΑΛΜΑΤΟΣ. Η αποτυχία ΑΠΟΘΗΚΕΥΣΗΣ έγραφε «Τα στοιχεία
    // δεν φορτώθηκαν» και η οθόνη το κολλούσε πίσω από «Οι σημειώσεις δεν
    // αποθηκεύτηκαν:». Η ορολογία του προγραμματιστή (ποιο migration λείπει)
    // πηγαίνει στην κονσόλα, όχι στον ιδιοκτήτη.
    if (err) console.warn('accountant_dossier: αν ο πίνακας λείπει, δεν έχει εφαρμοστεί το migration του', err)
    // Η συνέπεια μπαίνει στην ίδια πρόταση, πριν από το «Δοκίμασε ξανά.» που
    // προσθέτει η `failed`: αλλιώς η οθόνη έγραφε δύο φορές την προτροπή.
    setError(err ? failed('Οι σημειώσεις δεν αποθηκεύτηκαν και θα χαθούν αν κλείσεις τη σελίδα', err) : null)
    setErrorKind(err ? 'save' : null)
  }, [supabase, userId, year])

  useEffect(() => {
    if (!loaded || !dirty.current) return
    void persist(profile, have)
  }, [loaded, profile, have, persist])

  const setProfile = useCallback((patch: Partial<DossierProfile>) => {
    dirty.current = true
    setProfileState(prev => {
      // Η αλλαγή νομικής μορφής παρασύρει τα βιβλία στην προεπιλογή της, εκτός
      // αν ο χρήστης δηλώνει ρητά βιβλία στην ίδια κίνηση.
      const next: DossierProfile = { ...prev, ...patch }
      if (patch.form && patch.books === undefined) next.books = defaultBookkeeping(patch.form)
      return next
    })
  }, [])

  const toggle = useCallback((id: string) => {
    dirty.current = true
    setHave(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }, [])

  const retry = useCallback(() => {
    if (errorKind === 'load') setAttempt(a => a + 1)
    else void persist(profile, have)
  }, [errorKind, persist, profile, have])

  return { profile, setProfile, have, toggle, loaded, error, errorKind, retry }
}

// ═══ Εικόνα ════════════════════════════════════════════════════════════════

const card: React.CSSProperties = { position: 'relative', background: 'var(--surface-raised)', border: 'none', borderRadius: T.radius.card, padding: T.sp.lg, boxShadow: 'var(--elev-1)' }
const eyebrow: React.CSSProperties = { fontSize: 'var(--fs-base)', fontWeight: 600, lineHeight: 1.3, color: 'var(--text-tertiary)', fontFamily: T.font.sans, margin: 0 }
const num: React.CSSProperties = { fontVariantNumeric: 'tabular-nums', fontFamily: T.font.sans }

/** Μία γραμμή καταλόγου: τι και γιατί· το πού και το από πού πίσω από ένα πάτημα. */
// ΧΩΡΙΣ `interactive`: ΔΕΝ ΥΠΑΡΧΕΙ ΠΙΑ ΜΗ ΠΑΤΗΣΙΜΗ ΓΡΑΜΜΗ. Η ιδιότητα υπήρχε
// για τη μία ομάδα που ετοίμαζε το ίδιο το εργαλείο, όπου το τετραγωνάκι ήταν
// σφραγίδα και όχι επιλογή. Εκείνη η ομάδα δεν αποδίδεται πλέον ως κάρτα, οπότε
// οι δύο κλάδοι έγιναν ένας.
// ΟΤΑΝ ΚΡΙΝΟΥΝ ΤΑ ΣΤΟΙΧΕΙΑ, ΤΟ ΚΟΥΤΑΚΙ ΔΕΝ ΠΑΤΙΕΤΑΙ ΚΑΙ ΤΟ ΛΕΕΙ. Το ΑΤΑΚ και ο ΑΜΑ
// είναι γραμμένα (ή όχι) στα στοιχεία κάθε ακινήτου· ένα τσεκ εδώ θα έλεγε
// «το έχω» ενώ ο λογιστής θα έβλεπε «Λείπει» στον πίνακα των ακινήτων.
//
// ΤΟ «ΑΠΑΡΑΙΤΗΤΟ» ΑΝΤΙΣΤΡΑΦΗΚΕ (14/11/2026). Η πιλούλα με κεφαλαία καθόταν σχεδόν
// σε κάθε γραμμή και στο κινητό έπεφτε μόνη της σε δική της σειρά: ένδειξη που
// είναι παντού δεν ξεχωρίζει τίποτα. Σημειώνεται πλέον μόνο η εξαίρεση, ως ήσυχο
// «Προαιρετικό» στη σειρά του τίτλου. Το πού (διαδρομή myAADE και σύνδεσμος), το
// για ποιο ακίνητο και τι λείπει από τα στοιχεία ανοίγουν κάτω από τη γραμμή.
function Row({ r, checked, onToggle, attribute, fromData }: {
  r: Requirement; checked: boolean; onToggle: () => void; attribute: boolean
  fromData?: { missingFor?: string[] }
}) {
  const [open, setOpen] = useState(false)
  const detailsId = useId()
  const hasDetails = !!fromData || (attribute && !!r.forProperties?.length) || !!(r.aade || r.source)
  return (
    <div className="acd-row">
      {fromData
        ? <span role="img" aria-label={checked ? 'Υπάρχει στα στοιχεία' : 'Λείπει από τα στοιχεία'} className="acd-row-box"
            style={{ width: 18, height: 18, flexShrink: 0, borderRadius: T.radius.xs, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              border: `1.5px dashed ${checked ? 'var(--accent)' : 'var(--border-control)'}`, background: checked ? 'var(--accent)' : 'transparent', color: 'var(--accent-text)' }}>
            {checked && <svg width={11} height={11} viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2.5 6.3l2.2 2.2L9.5 3.6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </span>
        : <span className="acd-row-box"><SelectBox checked={checked} onChange={onToggle} label={r.title} /></span>}
      <div className="acd-row-text">
        <p className="acd-row-title" style={{ color: checked ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
          {r.title}
          {!r.blocking && <span className="acd-row-opt"> · Προαιρετικό</span>}
        </p>
        <p className="acd-row-why">{r.why}</p>
        {open && (
          <div id={detailsId} className="acd-row-details">
            {/* ΑΠΟ ΠΟΙΟ ΑΚΙΝΗΤΟ. Ο φάκελος είναι ένας για όλο το χαρτοφυλάκιο και ζει
                στη σελίδα ενός ακινήτου· χωρίς το όνομα, η δήλωση μίσθωσης ενός
                άλλου διαμερίσματος διαβαζόταν ως δική του. */}
            {fromData && (
              <p>{checked
                ? 'Από τα στοιχεία των ακινήτων σου.'
                : `Λείπει από τα στοιχεία: ${(fromData.missingFor ?? []).join(', ')}. Συμπλήρωσέ το στα στοιχεία του ακινήτου.`}</p>
            )}
            {attribute && r.forProperties && r.forProperties.length > 0 && <p>Για: {r.forProperties.join(', ')}</p>}
            {/* ΤΟ «ΠΟΥ» ΕΙΝΑΙ ΔΡΟΜΟΣ ΚΑΙ ΓΡΑΦΕΤΑΙ ΙΔΙΑ ΠΑΝΤΟΥ: η διαδρομή ως κείμενο και
                ο σύνδεσμος ως ενέργεια στο τέλος της. */}
            {(r.aade || r.source) && (
              <p>
                Πού: {r.aade ? aadePath(r.aade) : r.source}
                {r.aade && (
                  <>{' · '}<a className="po-tap-inline" href={AADE_DESTINATIONS[r.aade].url} target="_blank" rel="noopener noreferrer" title={aadeTitle(r.aade)}
                    style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}>Άνοιξε στο myAADE</a></>
                )}
              </p>
            )}
          </div>
        )}
      </div>
      {hasDetails && (
        <button type="button" className="acd-row-more acc-toggle" aria-expanded={open} aria-controls={open ? detailsId : undefined}
          aria-label={`Λεπτομέρειες: ${r.title}`} onClick={() => setOpen(o => !o)}>
          <ChevronDown size={16} aria-hidden="true" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s' }} />
        </button>
      )}
    </div>
  )
}

// ═══ ΟΙ ΟΜΑΔΕΣ ΔΙΠΛΩΝΟΥΝ ΚΑΙ ΘΥΜΟΥΝΤΑΙ ═══════════════════════════════════════
// Ο ιδιοκτήτης (14/11/2026): «να κάνω minimise το "Το κάνει ο λογιστής", το
// "Χρειάζεται από εσένα"». Είκοσι γραμμές ανοιχτές η μία κάτω από την άλλη
// έκαναν την καρτέλα τοίχο. Κάθε ομάδα είναι πλέον μία σειρά: τίτλος, μετρητής,
// βέλος. Ανοιχτή εξ αρχής μόνο η ομάδα που ζητά ενέργεια από τον χρήστη· η
// επιλογή του μένει στον περιηγητή του, ανά χρήστη (όχι στη βάση: είναι
// προτίμηση προβολής, όχι δεδομένο του φακέλου).
const SECTIONS_KEY = (userId?: string) => `pw:acct-sections:${userId || 'anon'}`
const SECTION_DEFAULT: Record<string, boolean> = { owner: true, accountant: false, traps: false }

function readSections(userId?: string): Record<string, boolean> {
  try {
    const raw = typeof window === 'undefined' ? null : window.localStorage.getItem(SECTIONS_KEY(userId))
    const saved = raw ? JSON.parse(raw) as Record<string, unknown> : {}
    const out: Record<string, boolean> = { ...SECTION_DEFAULT }
    for (const [k, v] of Object.entries(saved)) if (typeof v === 'boolean') out[k] = v
    return out
  } catch { return { ...SECTION_DEFAULT } }
}

function useSections(userId?: string) {
  const [open, setOpen] = useState<Record<string, boolean>>(() => readSections(userId))
  const toggle = useCallback((key: string) => {
    setOpen(prev => {
      const next = { ...prev, [key]: !prev[key] }
      try { window.localStorage.setItem(SECTIONS_KEY(userId), JSON.stringify(next)) } catch { /* ιδιωτικό παράθυρο: μένει για τη συνεδρία */ }
      return next
    })
  }, [userId])
  return [open, toggle] as const
}

/** Η κάρτα μιας ομάδας: η κεφαλίδα είναι κουμπί, το σώμα φαίνεται όταν ανοίξει. */
function Section({ title, count, open, onToggle, children }: {
  title: string; count?: string; open: boolean; onToggle: () => void; children: React.ReactNode
}) {
  const bodyId = useId()
  return (
    <section className="acd-sec" style={card}>
      <h2 className="acd-sec-h">
        <button type="button" className="acd-sec-toggle acc-toggle" aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
          <span className="acd-sec-title">{title}</span>
          {count && <span className="acd-sec-count" style={num}>{count}</span>}
          <ChevronDown size={18} aria-hidden="true" className="acd-sec-chev" style={{ transform: open ? 'rotate(180deg)' : 'none' }} />
        </button>
      </h2>
      <div id={bodyId} hidden={!open}>{open && children}</div>
    </section>
  )
}

/**
 * Οι γραμμές μιας ομάδας: πρώτα όσα μένουν, τα ολοκληρωμένα διπλωμένα από κάτω.
 * Ενα τσεκαρισμένο κουτάκι δεν ζητά τίποτα πια· δεν χρειάζεται να το
 * προσπερνά το μάτι κάθε φορά που ανοίγει η ομάδα.
 */
function GroupRows({ items, isDone, render }: {
  items: readonly Requirement[]; isDone: (id: string) => boolean; render: (r: Requirement) => React.ReactNode
}) {
  const [doneOpen, setDoneOpen] = useState(false)
  const doneId = useId()
  const left = items.filter(r => !isDone(r.id))
  const done = items.filter(r => isDone(r.id))
  return (
    <>
      {left.map(render)}
      {done.length > 0 && (
        <div className="acd-done">
          <button type="button" className="acd-done-toggle acc-toggle" aria-expanded={doneOpen} aria-controls={doneId} onClick={() => setDoneOpen(o => !o)}>
            <span>Ολοκληρωμένα ({done.length})</span>
            <ChevronDown size={16} aria-hidden="true" style={{ transform: doneOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s' }} />
          </button>
          <div id={doneId} hidden={!doneOpen}>{doneOpen && done.map(render)}</div>
        </div>
      )}
    </>
  )
}

export interface DossierExportSource {
  propName: string
  /** Το ανοιχτό ακίνητο: ο φάκελός του κρατά μόνο τα δικά του δικαιολογητικά. */
  propertyId?: string
  /** Ο άνθρωπος, όχι το ακίνητο: το πεδίο «Φορολογούμενος» του φακέλου. */
  ownerName?: string
  ownerAfm?: string
  statementLines: AccountantStatementLine[]
  provisionMonthly: number
  book: AccountantMovement[]
  /** Παρόν μόνο για όποιον όντως χαρακτηρίζει έξοδα στο myDATA. */
  myData?: { vat: VatDeduction }
  /** Κενά στα δεδομένα, γραμμένα από την καρτέλα (π.χ. «καμία δαπάνη για το 2026»). */
  gaps?: string[]
  /** Το μητρώο παγίων — παρόν μόνο για όποιον τηρεί βιβλία. */
  assets?: readonly FixedAsset[]
  /** Η αναλογία της αξίας που αφορά το κτίσμα· το υπόλοιπο είναι το οικόπεδο. */
  buildingFraction?: number
  /**
   * ΤΑ ΙΔΙΑ ΤΑ ΧΑΡΤΙΑ, ΚΑΤΕΒΑΣΜΕΝΑ ΤΗ ΣΤΙΓΜΗ ΤΟΥ ΚΟΥΜΠΙΟΥ.
   *
   * Συνάρτηση και όχι πίνακας: τα αρχεία είναι μεγαβάιτ και δεν έχουν λόγο να
   * κατεβαίνουν όσο ο χρήστης απλώς κοιτάζει την οθόνη. Η καρτέλα ξέρει από πού
   * κατεβαίνουν· αυτό το αρχείο δεν πρέπει να μάθει ποτέ.
   *
   * Τα `notes` είναι όσα ΔΕΝ χώρεσαν ή δεν κατέβηκαν, με τον λόγο τους. Δεν
   * σιωπούμε ποτέ για χαρτί που έμεινε πίσω: γράφεται στο «05 Τι λείπει».
   */
  attachments?: () => Promise<{ files: DossierAttachment[]; notes: string[] }>
}

export default function AccountantDossier({
  state, year, properties, exportSource, actions, more = [], compact = false, yearData, userId, onEditProperty, canShareLink = true,
}: {
  /**
   * Το πακέτο επιτρέπει σύνδεσμο λογιστή (`e2_export`). Χωρίς αυτό, η πρόσκληση
   * λογιστή φαίνεται αλλά η αποδοχή περιμένει την αναβάθμιση: αλλιώς ο λογιστής
   * θα έβρισκε κλειδωμένο φάκελο και ο πελάτης θα το μάθαινε από εκείνον.
   */
  canShareLink?: boolean
  /** Ανοίγει τον οδηγό του ακινήτου στο ΑΦΜ του ιδιοκτήτη. */
  onEditProperty?: (propertyId: string) => void
  /** Ο ιδιοκτήτης: ο φάκελος ανά ΑΦΜ φορτώνεται με το δικό του αναγνωριστικό. */
  userId?: string
  state: DossierState
  year: number
  properties: readonly CompletenessProperty[]
  exportSource: DossierExportSource
  /**
   * ΟΣΑ ΑΛΛΑ ΦΕΥΓΟΥΝ ΠΡΟΣ ΤΟΝ ΛΟΓΙΣΤΗ, ΣΤΟ ΙΔΙΟ ΣΗΜΕΙΟ.
   *
   * Ζούσαν στο τέλος της Λογιστικής, μέσα σε διπλωμένα «Προχωρημένα εργαλεία»:
   * το Excel των κινήσεων και η ζωντανή πύλη. Δηλαδή η ίδια ερώτηση —«τι δίνω
   * στον λογιστή μου;»— απαντιόταν σε δύο σημεία της οθόνης, με τον φάκελο
   * πρώτο και το Excel του ΙΔΙΟΥ φακέλου εννιακόσια εικονοστοιχεία πιο κάτω.
   */
  actions?: React.ReactNode
  /**
   * ΟΙ ΔΕΥΤΕΡΕΥΟΥΣΕΣ ΕΞΑΓΩΓΕΣ, ΣΕ ΕΝΑ ΜΕΝΟΥ (14/11/2026). Ηταν τρία κουμπιά με
   * περίγραμμα, άνισου πλάτους, στοιβαγμένα κάτω από το κύριο: στο κινητό η
   * κάρτα είχε τέσσερις ενέργειες ίδιου βάρους. Μένει ένα κύριο κουμπί (ο
   * φάκελος) και ένα «Περισσότερα» για όσα δεν είναι ο φάκελος.
   */
  more?: ActionMenuItem[]
  /** Χωρίς καμία κίνηση στη χρονιά: μόνο η κάρτα, ο κατάλογος πίσω από ένα πάτημα. */
  compact?: boolean
  /** Τι κατέγραψε η χρήση: από αυτό κρίνονται οι γραμμές που βγάζει η εφαρμογή. */
  yearData?: YearData
}) {
  const { profile, setProfile, have, toggle, error, retry } = state
  const [assumptionsOpen, setAssumptionsOpen] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const [sections, toggleSection] = useSections(userId)
  const [downloaded, setDownloaded] = useState(false)

  // ══ ΕΝΑΣ ΜΕΤΡΗΤΗΣ, ΙΔΙΟΣ ΜΕ ΤΟ ΑΡΧΕΙΟ ΚΑΙ ΤΗ ΣΥΝΑΝΤΗΣΗ (lib/facts/completeness) ══
  // Το ΑΤΑΚ και ο ΑΜΑ κρίνονται από τα στοιχεία των ακινήτων, όχι από το κουτάκι·
  // ό,τι φτιάχνει η εφαρμογή μετράει έτοιμο ΜΟΝΟ όταν υπάρχουν τα δεδομένα του.
  // Πριν, χωρίς κανόνα δεδομένων, μετρούσε «έτοιμο» εξ ορισμού.
  const data = useMemo<YearData>(() => yearData ?? { rent: false, stays: false, costs: false }, [yearData])
  const comp = useMemo(() => dossierCompleteness({
    form: profile.form, books: profile.books, properties,
    hasRenovation: profile.hasRenovation, hasLoan: profile.hasLoan, ownershipChanged: profile.ownershipChanged,
    ticked: have, data, gaps: exportSource.gaps,
  }), [profile, properties, have, data, exportSource.gaps])
  const reqs = comp.items
  const ready = comp
  const byId = useMemo(() => new Map(comp.items.map(i => [i.id, i])), [comp])
  const appIds = useMemo(() => comp.items.filter(i => i.by === 'app').map(i => i.id), [comp])
  const appDone = useMemo(() => comp.items.filter(i => i.by === 'app' && i.done).map(i => i.id), [comp])
  const appWaiting = appIds.length - appDone.length
  const groups = useMemo(() => groupByWho(reqs), [reqs])
  const warnings = useMemo(() => traps(reqs), [reqs])

  // ΤΟ ΚΟΥΜΠΙ ΠΕΡΙΜΕΝΕΙ ΤΑ ΧΑΡΤΙΑ ΚΑΙ ΤΟ ΛΕΕΙ. Το κατέβασμα των παραστατικών
  // παίρνει δευτερόλεπτα· χωρίς ένδειξη ο χρήστης πατά δεύτερη φορά και παίρνει
  // δύο φακέλους. Το κουμπί κλειδώνει όσο ετοιμάζεται.
  const [preparing, setPreparing] = useState(false)

  async function download() {
    if (preparing) return
    let attachments: DossierAttachment[] = []
    let notes: string[] = []
    if (exportSource.attachments) {
      setPreparing(true)
      try {
        const got = await exportSource.attachments()
        attachments = got.files
        notes = got.notes
      } finally {
        setPreparing(false)
      }
    }
    // ══ Ο ΦΑΚΕΛΟΣ ΤΟΥ ΑΚΙΝΗΤΟΥ ΛΕΕΙ ΜΟΝΟ ΤΑ ΔΙΚΑ ΤΟΥ ═══════════════════════
    // Το βιβλίο έχει τα νούμερα ΤΟΥ ΑΝΟΙΧΤΟΥ ακινήτου. Ο κατάλογος όμως έβγαινε
    // από ΟΛΟ το χαρτοφυλάκιο: η δήλωση μίσθωσης και τα ΑΜΑ των άλλων ακινήτων
    // έμπαιναν στο «Τι λείπει» δίπλα σε ποσά που δεν τα αφορούν και ο λογιστής
    // διάβαζε έναν φάκελο που αυτοαναιρείται. Ο φάκελος ολόκληρου του ΑΦΜ είναι
    // πλέον ο φάκελος της συνάντησης (MeetingPackCard).
    const own = properties.filter(p => exportSource.propertyId && p.id === exportSource.propertyId)
    const ownProps = own.length ? own : properties.slice(0, 1)
    // Ο ΙΔΙΟΣ ΜΕΤΡΗΤΗΣ, για ένα ακίνητο και με τα κενά που βρήκε το κατέβασμα.
    // Η κεφαλίδα του αρχείου δεν λέει πια «πλήρης» πάνω από κενά δεδομένων.
    const ownComp = dossierCompleteness({
      form: profile.form, books: profile.books, properties: ownProps,
      hasRenovation: profile.hasRenovation, hasLoan: profile.hasLoan, ownershipChanged: profile.ownershipChanged,
      ticked: have, data, gaps: [...(exportSource.gaps || []), ...notes],
    })
    const ownReqs = ownComp.items
    const ownReady = ownComp
    exportAccountantDossier({
      year,
      propName: exportSource.propName,
      ownerName: exportSource.ownerName,
      ownerAfm: exportSource.ownerAfm,
      statementLines: exportSource.statementLines,
      provisionMonthly: exportSource.provisionMonthly,
      book: exportSource.book,
      myData: exportSource.myData,
      assets: exportSource.assets,
      buildingFraction: exportSource.buildingFraction,
      dossier: {
        requirements: ownReqs,
        haveIds: ownComp.doneIds,
        readinessMessage: ownReady.message,
        properties: ownProps.map(p => ({ name: p.name, status: yearStatusLabel(p) })),
        formLabel: LEGAL_FORM_LABEL[profile.form],
        booksLabel: BOOKS_LABEL[profile.books],
        gaps: [...(exportSource.gaps || []), ...notes],
      },
      attachments,
    })
    setDownloaded(true)
    setTimeout(() => setDownloaded(false), 2600)
  }

  const pct = ready.total > 0 ? Math.round((ready.done / ready.total) * 100) : 0

  // Η επικεφαλίδα βγαίνει από τη μηχανή (lib/accounting/dossier.ts), ίδια
  // στην οθόνη και στο αρχείο που κατεβαίνει.
  const headline = ready.message

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Ο αριθμός που ηρεμεί ─────────────────────────────────────────── */}
      {/* ΜΙΑ ΚΑΡΤΑ, ΜΙΑ ΚΥΡΙΑ ΕΝΕΡΓΕΙΑ (14/11/2026). Πριν: κουμπί όλου του πλάτους,
          πρόοδος, δύο παράγραφοι εξήγησης και τρία κουμπιά με περίγραμμα σε
          τρία πλάτη. Τώρα: τίτλος, πρόοδος, μία γραμμή με την εξήγηση πίσω από
          το ⓘ και από κάτω ο φάκελος δίπλα στο «Περισσότερα», ίδιο ύψος. */}
      <div className="acd-head" style={{ ...card, padding: '20px 22px' }}>
        {/* Ο ΦΑΚΕΛΟΣ ΕΙΝΑΙ ΟΛΟΥ ΤΟΥ ΧΑΡΤΟΦΥΛΑΚΙΟΥ ΚΑΙ ΤΟ ΛΕΕΙ. Στη σελίδα
            ενός ακινήτου, το «Λείπουν 6 πράγματα» διαβαζόταν ως δικό του. */}
        <p style={eyebrow}>Για τον λογιστή · {year}{properties.length > 1 ? ` · ${properties.length}\u00a0ακίνητα` : ''}</p>
        <p style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', fontFamily: T.font.sans, letterSpacing: '-0.01em', lineHeight: 1.45, margin: '10px 0 0' }}>
          {headline}
        </p>

        {/* Πρόοδος: μία λεπτή γραμμή, χωρίς ποσοστά σε μεγάλα γράμματα. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0 0' }}>
          <Bar pct={pct} height={4} track="var(--bg-elevated)" label="Πρόοδος φακέλου" style={{ flex: 1 }} />
          <span style={{ ...num, fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>{ready.done}/{ready.total}</span>
        </div>

        {/* ΠΟΙΟΣ ΚΑΝΕΙ ΤΙ: τα έτοιμα ΜΕΤΡΟΥΝ ήδη στο «x / y» από πάνω· όσα
            περιμένουν δεδομένα λένε τι περιμένουν. Και ΤΙ ΘΑ ΒΡΕΙ ΜΕΣΑ ο
            λογιστής, πίσω από το ⓘ: η περιγραφή του βιβλίου διαβάζεται μία
            φορά, δεν χρειάζεται δική της παράγραφο κάθε φορά. Το ⓘ κολλά στην
            τελευταία λέξη, για να μη μείνει μόνο του σε δική του σειρά. */}
        {(() => {
          const summary = [
            appDone.length > 0 ? `${appDone.length === 1 ? `Το ένα από τα ${ready.total} το βγάζουμε` : `Τα ${appDone.length} από τα ${ready.total} τα βγάζουμε`} ήδη από τα δεδομένα σου.` : '',
            appWaiting > 0 ? `${appDone.length > 0
              ? (appWaiting === 1 ? 'Ένα ακόμη θα βγει' : `Άλλα ${appWaiting} θα βγουν`)
              : (appWaiting === 1 ? `Το ένα από τα ${ready.total} θα το βγάλουμε` : `Τα ${appWaiting} από τα ${ready.total} θα τα βγάλουμε`)} μόλις καταχωρήσεις έσοδα και έξοδα.` : '',
          ].filter(Boolean).join(' ') || 'Τι περιέχει ο φάκελος.'
          const cut = summary.lastIndexOf(' ')
          return (
            <p className="acd-head-note">
              {summary.slice(0, cut + 1)}
              <span style={{ whiteSpace: 'nowrap' }}>{summary.slice(cut + 1)}{'\u00a0'}<InfoHint label="Τι περιέχει ο φάκελος">
                Φάκελος του ακινήτου: τα λογιστικά του ανοιχτού ακινήτου σε ένα βιβλίο εργασίας, με τα παραστατικά του αριθμημένα.
              </InfoHint></span>
            </p>
          )
        })()}

        <div className="acd-head-actions">
          <Btn variant="primary" onClick={download} disabled={preparing}>
            <Download size={14} aria-hidden="true" />{preparing ? 'Ετοιμάζεται' : downloaded ? 'Κατέβηκε' : 'Φάκελος του ακινήτου'}
          </Btn>
          {/* «⋯» ΚΑΙ ΟΧΙ ΛΕΞΗ: με λεκτικό τα δύο δεν χωρούσαν σε μία σειρά στα 375 και
              το «Περισσότερα» έπεφτε μόνο του από κάτω. Το όνομα το ακούει ο
              αναγνώστης οθόνης και το δείχνει το `title`. */}
          {more.length > 0 && <ActionMenu iconOnly label="Περισσότερα" title="Περισσότερα: άλλες εξαγωγές για τον λογιστή" items={more} align="right" />}
        </div>

        {/* Η κάρτα του συνδέσμου, όταν υπάρχει (TabAccounting). */}
        {actions && <div className="acd-actions">{actions}</div>}

        {/* ── ΤΙ ΣΟΥ ΖΗΤΗΣΕ Ο ΛΟΓΙΣΤΗΣ ────────────────────────────────────
            Η αντίστροφη κατεύθυνση. Μέχρι τώρα η πληροφορία πήγαινε μόνο προς
            τον λογιστή· η επιστροφή ήταν τηλεφώνημα. Κάθεται ΕΔΩ και όχι σε
            δική της καρτέλα, γιατί εδώ βρίσκεται ήδη ο χρήστης όταν σκέφτεται
            «τι θέλει από μένα ο λογιστής μου». */}
        {userId && <AccountantInvites userId={userId} canShare={canShareLink} />}
        <AccountantAsks />
        <FirmDaySummary />

        {error && (
          <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', margin: '12px 0 0' }}>
            <p style={{ flex: 1, minWidth: 220, fontSize: 'var(--fs-note)', color: 'var(--negative)', margin: 0, fontFamily: T.font.sans, lineHeight: 1.5 }}>
              {error}
            </p>
            <Btn variant="secondary" onClick={retry}>Δοκίμασε ξανά</Btn>
          </div>
        )}

        {/* ΧΩΡΙΣ ΚΙΝΗΣΗ ΣΤΗ ΧΡΟΝΙΑ, Ο ΚΑΤΑΛΟΓΟΣ ΠΕΡΙΜΕΝΕΙ. Είναι χρήσιμος για να
            ξέρει κανείς τι θα χρειαστεί, όχι για να τον διαβάσει πριν γράψει
            την πρώτη του καταχώρηση. */}
        {compact && (
          <div style={{ margin: '14px 0 0' }}>
            <Btn variant="ghost" onClick={() => setListOpen(o => !o)} expanded={listOpen}>
              <ChevronRight size={14} style={{ transform: listOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.18s' }} />
              {listOpen ? 'Κλείσε τον κατάλογο' : 'Δες τι θα χρειαστεί ο λογιστής'}
            </Btn>
          </div>
        )}
      </div>

      {/* Ο ΦΑΚΕΛΟΣ ΤΗΣ ΣΥΝΑΝΤΗΣΗΣ, ΑΝΑ ΑΦΜ: αυτό που πάει στον λογιστή. */}
      {userId && (
        <MeetingPackCard userId={userId} year={year} ownerName={exportSource.ownerName ?? null} onEditProperty={onEditProperty}
          dossier={{
            form: profile.form, books: profile.books, hasRenovation: profile.hasRenovation,
            hasLoan: profile.hasLoan, ownershipChanged: profile.ownershipChanged, have, properties, data,
          }} />
      )}

      {(!compact || listOpen) && (<>

      {/* ── Οι ομάδες: πρώτα τα δικά σου ──────────────────────────────────── */}
      {groups.filter(g => g.who !== 'app').map(g => {
        const done = g.items.filter(r => byId.get(r.id)?.done).length
        return (
          <Section key={g.who} title={g.label} count={`${done}/${g.items.length}`} open={!!sections[g.who]} onToggle={() => toggleSection(g.who)}>
            <p className="acd-sec-sub">
              {g.who === 'owner' ? 'Σημείωσε ό,τι έχεις ήδη βρει.' : 'Τα ετοιμάζει ο λογιστής από όσα του δίνεις. Σημείωσε ό,τι έχει ήδη γίνει.'}
            </p>
            <GroupRows items={g.items} isDone={id => !!byId.get(id)?.done} render={r => (
              <Row key={r.id} r={r} checked={!!byId.get(r.id)?.done} onToggle={() => toggle(r.id)} attribute={properties.length > 1}
                fromData={byId.get(r.id)?.by === 'data' ? { missingFor: byId.get(r.id)?.missingFor } : undefined} />
            )} />
          </Section>
        )
      })}

      {/* ── Παγίδες: συμβουλή, όχι κατηγορία ──────────────────────────────── */}
      {warnings.length > 0 && (
        <Section title="Πριν τον στείλεις" count={String(warnings.length)} open={!!sections.traps} onToggle={() => toggleSection('traps')}>
          <p className="acd-sec-sub">
            {warnings.length === 1 ? 'Ένα σημείο που κοστίζει όταν πάει στραβά.' : `${warnings.length} σημεία που κοστίζουν όταν πάνε στραβά.`}
          </p>
          {/* ΤΡΕΙΣ ΣΤΗΛΕΣ, ΣΤΑΘΕΡΑ. Το ελάχιστο 360 δίνει τρεις στήλες σε κάθε
              οθόνη υπολογιστή και μία σε στενή. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: '18px 24px', alignItems: 'start', marginTop: 12 }}>
            {warnings.map(t => (
              <div key={t.title} style={{ paddingLeft: 12, borderLeft: '2px solid var(--border-default)' }}>
                <p style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-primary)', margin: 0, fontFamily: T.font.sans, lineHeight: 1.4 }}>{t.title}</p>
                <p style={{ fontSize: 'var(--fs-note)', color: 'var(--text-secondary)', margin: '4px 0 0', fontFamily: T.font.sans, lineHeight: 1.55 }}>{t.trap}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Οι παραδοχές: κλειστές, γιατί σπάνια αλλάζουν ─────────────────── */}
      <div style={card}>
        <button onClick={() => setAssumptionsOpen(o => !o)} aria-expanded={assumptionsOpen} className="acc-toggle acc-row">
          <ChevronRight size={16} style={{ color: 'var(--text-tertiary)', flexShrink: 0, transform: assumptionsOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.18s' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={eyebrow}>Από τι βγαίνει αυτή η λίστα</p>
            <p style={{ fontSize: 'var(--fs-note)', color: 'var(--text-tertiary)', margin: '4px 0 0', fontFamily: T.font.sans }}>
              {LEGAL_FORM_LABEL[profile.form]} · {BOOKS_LABEL[profile.books]}
              {properties.length > 0 && ` · ${properties.length === 1 ? '1 ακίνητο' : `${properties.length} ακίνητα`}`}
            </p>
          </div>
        </button>

        {assumptionsOpen && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <p style={{ fontSize: 'var(--fs-note)', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px', fontFamily: T.font.sans }}>Νομική μορφή</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(Object.keys(LEGAL_FORM_LABEL) as LegalForm[]).map(f => (
                  <ChipToggle key={f} on={profile.form === f} onClick={() => setProfile({ form: f })}>{LEGAL_FORM_LABEL[f]}</ChipToggle>
                ))}
              </div>
            </div>

            {/* Τα βιβλία υπάρχουν μόνο όπου υπάρχουν. Ο ιδιώτης δεν βλέπει τη λέξη. */}
            {profile.form !== 'individual' && (
              <div>
                <p style={{ fontSize: 'var(--fs-note)', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px', fontFamily: T.font.sans }}>Βιβλία</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(['single_entry', 'double_entry'] as BookKeeping[]).map(b => (
                    <ChipToggle key={b} on={profile.books === b} onClick={() => setProfile({ books: b })}>{BOOKS_LABEL[b]}</ChipToggle>
                  ))}
                </div>
                <p style={{ fontSize: 'var(--fs-note)', color: 'var(--text-tertiary)', margin: '8px 0 0', fontFamily: T.font.sans, lineHeight: 1.5 }}>
                  Ο ισολογισμός και το προσάρτημα υπάρχουν μόνο στα διπλογραφικά. Οι ΟΕ/ΕΕ περνούν σε διπλογραφικά πάνω από όριο τζίρου.
                </p>
              </div>
            )}

            <div>
              <p style={{ fontSize: 'var(--fs-note)', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px', fontFamily: T.font.sans }}>Μέσα στο {year}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {([
                  ['hasRenovation', 'Έγιναν εργασίες ανακαίνισης ή βελτίωσης', 'Προσθέτει τα τιμολόγια και τις άδειες που ζητά ο λογιστής.'],
                  ['hasLoan', 'Υπάρχει δάνειο για το ακίνητο', 'Χρειάζεται η ετήσια βεβαίωση τόκων από την τράπεζα.'],
                  ['ownershipChanged', 'Άλλαξε κάτι στην ιδιοκτησία (αγορά, πώληση, κληρονομιά)', 'Τότε και μόνο τότε υποβάλλεται Ε9.'],
                ] as [keyof DossierProfile, string, string][]).map(([key, label, hint]) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <SelectBox checked={!!profile[key]} onChange={() => setProfile({ [key]: !profile[key] } as Partial<DossierProfile>)} label={label} />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-primary)', margin: 0, fontFamily: T.font.sans, lineHeight: 1.4 }}>{label}</p>
                      <p style={{ fontSize: 'var(--fs-note)', color: 'var(--text-tertiary)', margin: '2px 0 0', fontFamily: T.font.sans, lineHeight: 1.45 }}>{hint}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {properties.length > 0 && (
              <div>
                <p style={{ fontSize: 'var(--fs-note)', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px', fontFamily: T.font.sans }}>Τα ακίνητά σου</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {properties.map((p, i) => (
                    <div key={`${p.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 'var(--fs-base)', fontFamily: T.font.sans }}>
                      <span style={{ flex: 1, minWidth: 0, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                      <span style={{ color: 'var(--text-tertiary)' }}>{yearStatusLabel(p)}</span>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 'var(--fs-note)', color: 'var(--text-tertiary)', margin: '8px 0 0', fontFamily: T.font.sans, lineHeight: 1.5 }}>
                  Η κατάσταση κάθε ακινήτου ορίζει τι ζητά ο λογιστής. Αλλάζει από την Επισκόπηση του ακινήτου.
                </p>
              </div>
            )}

            <p style={{ ...TT.caption, margin: 0, lineHeight: 1.55 }}>
              Ο κατάλογος λέει ποια παραστατικά χρειάζονται και ποιος τα φέρνει. Δεν υποκαθιστά τη φορολογική συμβουλή του λογιστή σου.
            </p>
          </div>
        )}
      </div>
      </>)}
    </div>
  )
}

/**
 * ΟΣΑ ΖΗΤΗΣΕ Ο ΛΟΓΙΣΤΗΣ ΚΑΙ ΤΟ ΚΟΥΜΠΙ ΠΟΥ ΤΑ ΚΛΕΙΝΕΙ.
 *
 * ΔΕΝ ΚΑΤΑΛΑΜΒΑΝΕΙ ΧΩΡΟ ΟΤΑΝ ΔΕΝ ΕΧΕΙ ΝΑ ΠΕΙ ΤΙΠΟΤΑ. Μια ενότητα «Αιτήματα (0)»
 * είναι θόρυβος που ο χρήστης μαθαίνει να προσπερνά και μαζί της προσπερνά και
 * τη φορά που θα έχει περιεχόμενο.
 *
 * ΤΟ «ΔΕΝ ΙΣΧΥΕΙ» ΥΠΑΡΧΕΙ ΕΠΙΤΗΔΕΣ. Χωρίς αυτό, ένα αίτημα που δεν έχει νόημα
 * μένει ανοιχτό για πάντα και ο κατάλογος γεμίζει ψέματα.
 */
function AccountantAsks() {
  const supabase = useMemo(() => createClient(), [])
  const [asks, setAsks] = useState<OpenRequest[]>([])

  useEffect(() => { void openRequests(supabase).then(setAsks) }, [supabase])

  const answer = useCallback(async (id: string, status: 'done' | 'dismissed') => {
    if (await answerRequest(supabase, id, status)) setAsks(a => a.filter(x => x.id !== id))
  }, [supabase])

  if (asks.length === 0) return null

  return (
    <div style={{ margin: '16px 0 0', paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
      <p style={{ fontWeight: 600, fontSize: 'var(--fs-base)', lineHeight: 1.3, color: 'var(--text-tertiary)', margin: 0, fontFamily: T.font.sans }}>
        {asks.length === 1 ? 'Ο λογιστής σου ζήτησε' : `Ο λογιστής σου ζήτησε ${asks.length} πράγματα`}
      </p>
      <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0', display: 'grid', gap: 0 }}>
        {asks.map(a => (
          <li key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderTop: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: 'var(--fs-base)', color: 'var(--text-primary)', fontFamily: T.font.sans, lineHeight: 1.5 }}>
              {a.item}
              {a.note ? <span style={{ color: 'var(--text-tertiary)' }}>{` · ${a.note}`}</span> : null}
            </span>
            <span style={{ display: 'flex', gap: 8 }}>
              <Btn variant="secondary" onClick={() => void answer(a.id, 'done')}>Το έστειλα</Btn>
              {/* ghost για το «Δεν ισχύει»: ήταν επίτηδες πιο ήσυχο από το «Το έστειλα» δίπλα του */}
              <Btn variant="ghost" onClick={() => void answer(a.id, 'dismissed')}>Δεν ισχύει</Btn>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
