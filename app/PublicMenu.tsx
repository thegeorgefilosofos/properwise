import Link from 'next/link'
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
// ΧΩΡΙΣ JAVASCRIPT, ΜΕ `<details>` (06/10/2026). Η πρώτη γραφή ήταν component
// πελάτη με state και ακροατές: πρόσθετε 1,2 KB στο κρίσιμο μονοπάτι κάθε
// δημόσιας σελίδας και η «Καθαρή απόδοση», που είχε μόλις 0,5 KB περιθώριο,
// πέρασε το όριο του `docs/perf/budget.json`. Η καστάνια δεν ανεβαίνει για
// ένα μενού που ο περιηγητής ξέρει να ανοιγοκλείνει μόνος του: το `<summary>`
// είναι κουμπί για το πληκτρολόγιο (Enter, Space) και τον αναγνώστη οθόνης,
// με κατάσταση ανοιχτό/κλειστό. Κάθε σελίδα φτιάχνει τη δική της κεφαλίδα,
// οπότε μετά από πλοήγηση το μενού ξεκινά πάντα κλειστό.
// ═══════════════════════════════════════════════════════════════════════════

export default function PublicMenu({ links, current }: {
  links: readonly (readonly [string, string])[]
  current?: string
}) {
  return (
    <details className="pub-menu lp-only-sm">
      <summary className="pub-menu-btn" aria-label="Μενού">
        <svg aria-hidden="true" className="pub-menu-ic-open" width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
        <svg aria-hidden="true" className="pub-menu-ic-close" width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </summary>
      <ul className="pub-menu-sheet" style={{ borderRadius: T.radius.popup }}>
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="lp-link pub-menu-link"
              aria-current={current && href === `/${current}` ? 'page' : undefined}>{label}</Link>
          </li>
        ))}
      </ul>
    </details>
  )
}
