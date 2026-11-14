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
// τους. Τα πλήθη στους συνδέσμους «όλα» από τα ίδια. Ήρεμο: δύο στήλες απλών
// συνδέσμων, χωρίς κάρτες που σηκώνονται.
//
// Server component, όπως η σελίδα.
// ═══════════════════════════════════════════════════════════════════════════
import Link from 'next/link'
import { T } from '@/components/tokens'
import { PUBLIC_TOOLS, TOOLS_HUB } from '@/lib/core/publicTools'
import { LISTED_GUIDES } from './odigos/guides'
import { ACCENT, PANEL, TEXT, LINE, CARD_GAP } from './landingKit'

/** Πόσοι σύνδεσμοι ανά στήλη· οι υπόλοιποι είναι ένα κλικ πιο πέρα, στον κόμβο. */
const PER_COLUMN = 6

const COL: React.CSSProperties = {
  background: PANEL, border: `1px solid ${LINE}`, borderRadius: T.radius.card,
  padding: 'clamp(18px, 2.2vw, 24px)',
}
const H3: React.CSSProperties = { fontSize: 16, fontWeight: 700, margin: '0 0 6px', letterSpacing: '-0.02em', color: TEXT }
const ITEM: React.CSSProperties = { color: TEXT, textDecoration: 'none', fontSize: 15, fontWeight: 500 }
const ALL: React.CSSProperties = { color: ACCENT, textDecoration: 'none', fontSize: 15, fontWeight: 600 }

function Column({ title, links, all }: {
  title: string; links: readonly { href: string; text: string }[]; all: { href: string; text: string };
}) {
  return (
    <div style={COL}>
      <h3 style={H3}>{title}</h3>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {links.map(l => (
          <li key={l.href} style={{ borderBottom: `1px solid ${LINE}` }}>
            <Link href={l.href} className="lp-link po-tap" style={ITEM}>{l.text}</Link>
          </li>
        ))}
      </ul>
      <div style={{ marginTop: 6 }}>
        <Link href={all.href} className="lp-link po-tap" style={ALL}>{all.text}</Link>
      </div>
    </div>
  )
}

export function ToolsAndGuides() {
  const tools = PUBLIC_TOOLS.slice(0, PER_COLUMN).map(t => ({ href: t.href, text: t.label }))
  const guides = LISTED_GUIDES.slice(0, PER_COLUMN).map(g => ({ href: g.href, text: g.title }))
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: CARD_GAP }}>
      <Column title="Υπολογισμοί χωρίς εγγραφή" links={tools}
        all={{ href: TOOLS_HUB.href, text: `Όλοι οι υπολογισμοί (${PUBLIC_TOOLS.length})` }} />
      <Column title="Οδηγοί" links={guides}
        all={{ href: '/odigos', text: `Όλοι οι οδηγοί (${LISTED_GUIDES.length})` }} />
    </div>
  )
}
