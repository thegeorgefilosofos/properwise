'use client'
// ═══════════════════════════════════════════════════════════════════════════
// ΤΙ ΕΙΝΑΙ ΑΥΤΟ ΤΟ ΓΕΓΟΝΟΣ, ΣΕ ΓΡΑΜΜΕΣ ΜΕ ΟΝΟΜΑ
// ─────────────────────────────────────────────────────────────────────────
// Η επεξήγηση του ημερολογίου ήταν ένα κομμάτι κείμενο: τίτλος, ώρα, ποσό και η
// σημείωση όπως αποθηκεύτηκε, με τις διευθύνσεις της μέσα (21/10/2026). Εδώ η
// ίδια πληροφορία έχει σχήμα: κεφαλίδα (τίτλος, ημερομηνία, πόσο απέχει, ποσό,
// κατηγορία), μία ή δύο γραμμές περιγραφής· από κάτω «Ποιος», «Πού»,
// «Προθεσμία» και οι πηγές με το όνομά τους. Τη σημείωση τη χωρίζει το
// lib/calendar/noteParts.ts· για φορολογική προθεσμία ό,τι λείπει από τη
// σημείωση το συμπληρώνει η ίδια η υποχρέωση.
//
// ΔΥΟ ΧΡΗΣΕΙΣ. Στην αιώρηση του πλέγματος (`interactive` ψευδές) οι πηγές
// γράφονται ως ονόματα, γιατί η επεξήγηση δεν δέχεται πάτημα. Στο φύλλο της
// ημέρας είναι σύνδεσμοι που ανοίγουν σε νέα καρτέλα.
// ═══════════════════════════════════════════════════════════════════════════
import { T, fe } from '@/components/Theme'
import { grDate } from '@/lib/core/format'
import { noteParts } from '@/lib/calendar/noteParts'
import { taxKindOfEventSource, taxObligationOfEventSource, CONFIDENCE_LABEL } from '@/lib/tax/greekTaxCalendar'
import { AADE_DESTINATIONS, destinationForKind } from '@/lib/tax/aade'
import { WHO_LABEL } from '@/lib/accounting/dossier'
import { dueTextStart } from '@/lib/facts/deadlines'
import { type CalEvent, CATEGORIES, TAX_META, daysUntil } from './model'

export function eventDetailParts(ev: CalEvent) {
  const p = noteParts(ev.notes)
  const kind = taxKindOfEventSource(ev.source)
  if (kind) {
    const tax = taxObligationOfEventSource(ev.source) ?? TAX_META[kind]
    if (tax) {
      p.who = p.who ?? WHO_LABEL[tax.who]
      p.deadline = p.deadline ?? tax.confidence
    }
    const dest = AADE_DESTINATIONS[destinationForKind(kind)]
    if (p.where.length === 0) p.where = [dest.portal, ...dest.steps]
    if (!p.links.some(l => l.href === dest.url)) p.links.unshift({ label: dest.portal, href: dest.url })
  }
  return p
}

export function EventDetails({ event, interactive = false, header = true }: {
  event: CalEvent
  /** Οι πηγές ως σύνδεσμοι. Ψευδές στην επεξήγηση αιώρησης. */
  interactive?: boolean
  /** Χωρίς κεφαλίδα όταν ο τίτλος φαίνεται ήδη από πάνω (φύλλο ημέρας). */
  header?: boolean
}) {
  const p = eventDetailParts(event)
  const cat = CATEGORIES[event.category]
  const d = daysUntil(event.event_date)
  const rows: [string, string][] = []
  if (p.who) rows.push(['Ποιος', p.who])
  if (p.where.length) rows.push(['Πού', p.where.join(' › ')])
  if (p.deadline) rows.push(['Προθεσμία', CONFIDENCE_LABEL[p.deadline]])

  return (
    <div className="cal-det" style={{ display: 'flex', flexDirection: 'column', gap: 8, fontFamily: T.font.sans, minWidth: 0 }}>
      {header && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, lineHeight: 1.4, color: 'var(--text-primary)', textWrap: 'balance' }}>{event.title}</span>
            {event.amount != null && event.amount > 0 && (
              <span style={{ flexShrink: 0, fontSize: 14, fontWeight: 600, fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>{fe(event.amount)}</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-secondary)' }}>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{grDate(event.event_date)}{event.event_time ? ` · ${event.event_time}` : ''}</span>
            <span aria-hidden style={{ color: 'var(--text-tertiary)' }}>·</span>
            <span style={{ fontWeight: d <= 1 ? 600 : 400, color: d < 0 || d <= 1 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{dueTextStart(d)}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 'auto', color: 'var(--text-tertiary)' }}>
              <span aria-hidden style={{ width: 6, height: 6, borderRadius: T.radius.pill, background: cat.color }} />{cat.label}
            </span>
          </div>
        </div>
      )}
      {p.summary && (
        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textWrap: 'pretty' }}>{p.summary}</p>
      )}
      {rows.length > 0 && (
        <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', columnGap: 12, rowGap: 4, fontSize: 12, lineHeight: 1.5, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
          {rows.map(([k, v]) => (
            <div key={k} style={{ display: 'contents' }}>
              <dt style={{ color: 'var(--text-tertiary)' }}>{k}</dt>
              <dd style={{ margin: 0, color: 'var(--text-primary)', minWidth: 0, overflowWrap: 'anywhere' }}>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {p.links.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-tertiary)' }}>
          <span>Πηγές</span>
          {p.links.map(l => interactive
            ? <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="cal-det-link" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>{l.label}</a>
            : <span key={l.href} style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{l.label}</span>)}
        </div>
      )}
    </div>
  )
}
