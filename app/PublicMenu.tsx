'use client'
import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import { T } from '@/components/tokens'

// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΜΕΝΟΥ ΤΗΣ ΔΗΜΟΣΙΑΣ ΚΕΦΑΛΙΔΑΣ ΣΤΟ ΤΗΛΕΦΩΝΟ
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΕΛΕΙΠΕ. Στο τηλέφωνο η κεφαλίδα έδειχνε μόνο «Σύνδεση» και «Ξεκίνα»· οι
// «Οδηγοί» και οι «Τιμές» ζούσαν μόνο στο υποσέλιδο, δηλαδή ο επισκέπτης που
// ήθελε να δει πόσο κοστίζει έπρεπε να κυλήσει ως το τέλος της σελίδας.
//
// ΓΙΑΤΙ ΚΟΥΜΠΙ ΚΑΙ ΟΧΙ ΔΥΟ ΣΥΝΔΕΣΜΟΙ. Μετρημένο στο PublicChrome.tsx: σήμα,
// τρεις σύνδεσμοι και κουμπί τελειώνουν στα 382 με το στενότερο γέμισμα ενώ η
// οθόνη των 390 σταματά στα 370. Δεν χωρούν. Ενα κουμπί 44 στη θέση του
// «Σύνδεση» χωρά από τα 320 ως τα 640· το «Σύνδεση» μπαίνει μέσα στο φύλλο,
// με τη σειρά που έχει στον υπολογιστή.
//
// ΠΛΗΚΤΡΟΛΟΓΙΟ. `aria-expanded` στο κουμπί, Esc κλείνει και γυρίζει την
// εστίαση στο κουμπί, το Tab έξω από το φύλλο το κλείνει, όπως και ένα
// πάτημα οπουδήποτε αλλού. Η κίνηση ανοίγματος υπάρχει μόνο όταν ο χρήστης
// δεν έχει ζητήσει λιγότερη κίνηση (globals.css, `.pub-menu-sheet`).
// ═══════════════════════════════════════════════════════════════════════════

export default function PublicMenu({ links, current }: {
  links: readonly (readonly [string, string])[]
  current?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      btnRef.current?.focus()
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className="pub-menu lp-only-sm"
      onBlur={e => { if (open && !rootRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false) }}>
      <button ref={btnRef} type="button" className="pub-menu-btn"
        aria-expanded={open} aria-controls={id} aria-label="Μενού"
        onClick={() => setOpen(v => !v)}>
        <svg aria-hidden="true" width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      {open && (
        <ul id={id} className="pub-menu-sheet" style={{ borderRadius: T.radius.popup }}>
          {links.map(([href, label]) => (
            <li key={href}>
              <Link href={href} className="lp-link pub-menu-link"
                aria-current={current && href === `/${current}` ? 'page' : undefined}
                onClick={() => setOpen(false)}>{label}</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
