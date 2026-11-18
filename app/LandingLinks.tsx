// ═══════════════════════════════════════════════════════════════════════════
// «ΕΡΓΑΛΕΙΑ ΚΑΙ ΟΔΗΓΟΙ» ΣΤΗΝ ΑΡΧΙΚΗ (14/11/2026)
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΚΕΝΟ. Η αρχική έδειχνε τους υπολογιστές και τους οδηγούς μόνο από το μενού
// και το υποσέλιδο, δηλαδή από τα κοινά κομμάτια κάθε σελίδας. Η σελίδα με τη
// μεγαλύτερη βαρύτητα δεν έδινε κανέναν σύνδεσμο μέσα στο κείμενό της προς τις
// σελίδες που απαντούν σε ερώτηση πριν από την εγγραφή.
//
// ΑΠΟ ΤΟΥΣ ΚΑΤΑΛΟΓΟΥΣ, ΟΧΙ ΜΕ ΤΟ ΧΕΡΙ. Υπολογιστές από το PUBLIC_TOOLS και
// οδηγοί από το LISTED_GUIDES (κανένας οδηγός εκτός καταλόγου), με τη σειρά
// τους. Τα πλήθη στους συνδέσμους «όλα» από τα ίδια.
//
// ΛΙΣΤΑ ΠΟΥ ΔΙΑΒΑΖΕΤΑΙ ΩΣ ΣΥΝΔΕΣΜΟΙ (16/11/2026). Ηταν γυμνές γραμμές
// κειμένου με μια λεπτή γραμμή από κάτω: τίποτα δεν έλεγε ότι πατιούνται, το
// ύψος κάθε σειράς ήταν όσο το κείμενο (κάτω από 44 στο κινητό) και δεξιά
// έμενε άδειο το μισό πλάτος της κάρτας. Τώρα κάθε σειρά είναι ολόκληρη
// στόχος, ίδιου ύψους, με βέλος στη δεξιά άκρη που κλείνει τη στήλη, φόντο
// στην αιώρηση και δαχτυλίδι στην εστίαση (`.lp-list` στο app/globals.css).
//
// Server component, όπως η σελίδα.
// ═══════════════════════════════════════════════════════════════════════════
import Link from 'next/link'
import { T } from '@/components/tokens'
import { PUBLIC_TOOLS, TOOLS_HUB } from '@/lib/core/publicTools'
import { LISTED_GUIDES } from './odigos/guides'
import { PANEL, TEXT, LINE, CARD_GAP, ic } from './landingKit'

/** Πόσοι σύνδεσμοι ανά στήλη· οι υπόλοιποι είναι ένα κλικ πιο πέρα, στον κόμβο.
 *  ΤΡΕΙΣ ΚΑΙ ΟΧΙ ΕΞΙ (17/11/2026): οι ίδιοι υπολογισμοί και οδηγοί ζουν και στο
 *  υποσέλιδο και στους κόμβους· εδώ αρκεί μια γεύση και το «Όλοι οι…». */
const PER_COLUMN = 3

// Αριθμομηχανή και ανοιχτό βιβλίο, στο ίδιο κουτί με τα εικονίδια των Δυνατοτήτων.
const ICON_CALC = 'M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 7h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 18.5h.01M12 18.5h4'
const ICON_BOOK = 'M2 5h6a4 4 0 0 1 4 4v11a3 3 0 0 0-3-3H2zM22 5h-6a4 4 0 0 0-4 4v11a3 3 0 0 1 3-3h7z'

const Chevron = () => (
  <svg className="lp-list-chev" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
)

function Column({ id, icon, title, links, all }: {
  id: string; icon: string; title: string;
  links: readonly { href: string; text: string }[]; all: { href: string; text: string };
}) {
  return (
    <div className="lp-list" style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: T.radius.card }}>
      <div className="lp-list-head">
        <span className="lp-list-ico" aria-hidden="true">{ic(icon)}</span>
        <h3 id={id} style={{ fontSize: 16, fontWeight: 700, margin: 0, letterSpacing: '-0.02em', color: TEXT }}>{title}</h3>
      </div>
      <ul>
        {links.map(l => (
          <li key={l.href}>
            <Link href={l.href} className="lp-list-row"><span>{l.text}</span><Chevron /></Link>
          </li>
        ))}
      </ul>
      <Link href={all.href} className="lp-list-row lp-list-all"><span>{all.text}</span><Chevron /></Link>
    </div>
  )
}

export function ToolsAndGuides() {
  const tools = PUBLIC_TOOLS.slice(0, PER_COLUMN).map(t => ({ href: t.href, text: t.label }))
  const guides = LISTED_GUIDES.slice(0, PER_COLUMN).map(g => ({ href: g.href, text: g.title }))
  return (
    <div className="lp-lists" style={{ gap: CARD_GAP }}>
      <Column id="lp-list-tools" icon={ICON_CALC} title="Υπολογισμοί" links={tools}
        all={{ href: TOOLS_HUB.href, text: `Όλοι οι υπολογισμοί (${PUBLIC_TOOLS.length})` }} />
      <Column id="lp-list-guides" icon={ICON_BOOK} title="Οδηγοί" links={guides}
        all={{ href: '/odigos', text: `Όλοι οι οδηγοί (${LISTED_GUIDES.length})` }} />
    </div>
  )
}
