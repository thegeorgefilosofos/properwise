// ═══════════════════════════════════════════════════════════════════════════
// ΟΔΗΓΟΣ: «ΣΠΙΤΙ ΜΟΥ ΙΙΙ: ΤΙ ΙΣΧΥΕ ΣΤΑ ΠΡΟΗΓΟΥΜΕΝΑ ΚΑΙ ΤΙ ΑΛΛΑΖΕΙ»
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Μετά τη ΔΕΘ (05/09/2026) ο κόσμος ψάχνει «Σπίτι μου 3» και
// βρίσκει όρια σε δημοσιεύματα σαν να ήταν κλειδωμένα. Ο οδηγός βάζει δίπλα
// δίπλα τι ίσχυε στο Ι και στο ΙΙ, τι είναι επίσημο για το ΙΙΙ και τι έχει
// μόνο ειπωθεί, σε χωριστό πλαίσιο με την πηγή του.
//
// ΚΑΘΕ ΑΡΙΘΜΟΣ ΑΠΟ ΣΤΑΘΕΡΑ. Ο πίνακας, οι ερωτήσεις και οι γραμμές ζουν στο
// ./content.ts και διαβάζουν το lib/loans/recommend.ts. Όταν βγει η ΚΥΑ του ΙΙΙ,
// αλλάζει το SPITI_MOU_3 και ο οδηγός ακολουθεί· εδώ αλλάζει μόνο το `updated`
// στο guides.ts.
//
// ΣΤΑΤΙΚΗ ΣΕΛΙΔΑ, ΧΩΡΙΣ `revalidate`. Το ΙΙ έχει κλείσει οριστικά (υπογραφές ως
// 31/08/2026) και η κατάσταση του ΙΙΙ αλλάζει μόνο με αλλαγή στο SPITI_MOU_3, που
// ξαναχτίζει τη σελίδα. Με `revalidate` θα γινόταν μία ακόμη συνάρτηση διακομιστή
// και το βάρος ανά ανάπτυξη θα περνούσε το όριο του docs/perf/server.json.
// ═══════════════════════════════════════════════════════════════════════════
import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import { T } from '@/components/tokens';
import { siteUrl } from '@/lib/core/site';
import { athensToday } from '@/lib/core/time';
import { feWhole, fn, fpRate, grDate } from '@/lib/core/format';
import {
  SPITI_MOU, SPITI_MOU_1, SPITI_MOU_3, SPITI_MOU_3_REPORTED, SPITI_MOU_LEGAL,
  spitiMou3Line, spitiMou3ReportedLines, spitiMou3ReportedCaveat, spitiMouClosedSentence,
} from '@/lib/loans/recommend';
import { programDateLabel } from '@/lib/loans/programStatus';
import { PublicHeader, PublicFooter, JsonLd } from '../../PublicChrome';
import { shareImage } from '../../og/share';
import { publicMetadata } from '../../publicMetadata';
import { guideAt } from '../guides';
import {
  GuideMain, GuideUpdated, GuideH2 as H2, GuideToc, GuideSources, GuideCta, GuideFaq,
  RelatedGuides, guideJsonLd, LINK_STYLE,
} from '../GuideParts';
import { COMPARISON, NAME_2, PROGRAM_NAMES, checkedLine, dstiLine, faq, incomeChangeLine, type Cell } from './content';

const GUIDE = guideAt('/odigos/spiti-mou-3-ti-allazei');
const H1 = `${SPITI_MOU_3.name}: τι ίσχυε στα προηγούμενα και τι αλλάζει`;
const TITLE = H1;
// Κάτω από 160 χαρακτήρες.
const DESC = `${SPITI_MOU_1.name} και ${NAME_2}: τα όρια δίπλα σε ό,τι είναι επίσημο για το ${SPITI_MOU_3.name}. `
  + 'Τι έχει μόνο ειπωθεί και τι κάνεις ως την ΚΥΑ.';
const URL = siteUrl(GUIDE.href);
const CALC = { href: '/ypologismos-stegastikou-daneiou', action: 'Υπολόγισε τη δόση του στεγαστικού σου' } as const;

export const metadata: Metadata = publicMetadata({
  title: TITLE, description: DESC, url: URL, type: 'article', image: shareImage('odigos-spiti-mou-3-ti-allazei'),
});

const S = {
  one: { id: 'spiti-mou-1', over: '1. Το πρώτο', title: `${SPITI_MOU_1.name}: τι ίσχυε` },
  two: { id: 'spiti-mou-2', over: '2. Το δεύτερο', title: `${NAME_2}: τι ίσχυε` },
  three: { id: 'spiti-mou-3', over: '3. Το νέο', title: `${SPITI_MOU_3.name}: τι είναι επίσημο` },
  compare: { id: 'sygkrisi', over: '4. Σύγκριση', title: 'Ι, ΙΙ και ΙΙΙ ανά κριτήριο' },
  now: { id: 'apo-simera', over: '5. Από σήμερα', title: 'Τι κάνεις μέχρι την ΚΥΑ' },
} as const;

const STRONG = { color: 'var(--text-primary)' } as const;
const MARK_STYLE: CSSProperties = {
  display: 'block', marginTop: 4, fontSize: 11, fontWeight: 650, letterSpacing: '0.02em',
  color: 'var(--warning)', textTransform: 'none',
};

/** Ένα κελί του πίνακα: τα «όχι ακόμη επίσημο» με σήμα, τα κενά αχνά. */
function CellView({ c }: { c: Cell }) {
  if (c.kind === 'reported') return <td>{c.text}<span style={MARK_STYLE}>όχι ακόμη επίσημο</span></td>;
  if (c.kind === 'none' || c.kind === 'notfound') return <td style={{ color: 'var(--text-tertiary)' }}>{c.text}</td>;
  return <td>{c.text}</td>;
}

function ExtLink({ href, children }: { href: string; children: string }) {
  return <a href={href} rel="noopener noreferrer" className="lp-link" style={LINK_STYLE}>{children}</a>;
}

export default function Page() {
  const today = athensToday();
  const FAQ = faq(today);
  const closed = spitiMouClosedSentence(today);
  const jsonLd = guideJsonLd({
    guide: GUIDE, headline: H1, description: DESC, faq: FAQ,
    about: `Στεγαστικά προγράμματα ${SPITI_MOU_1.name}, ${NAME_2} και ${SPITI_MOU_3.name}`,
  });
  const P1 = SPITI_MOU_1;
  const P3 = SPITI_MOU_3;
  const R = SPITI_MOU_3_REPORTED;

  const SOURCES = [
    <>{`${P1.name}: ${P1.legalBasis}. `}<ExtLink href={P1.sources.portal}>stegasi.gov.gr</ExtLink>{' · '}<ExtLink href={P1.sources.qa}>ερωτήσεις και απαντήσεις της ΕΑΤ</ExtLink>{' · '}<ExtLink href={P1.sources.terms}>ανακοίνωση της ΔΥΠΑ για τους όρους</ExtLink>{' · '}<ExtLink href={P1.sources.opening}>έναρξη αιτήσεων</ExtLink>{' · '}<ExtLink href={P1.sources.closing}>λήξη αιτήσεων</ExtLink>.</>,
    <>{`${NAME_2}: ${SPITI_MOU_LEGAL.kya}, όπως τροποποιήθηκε, τελευταία για το εισόδημα και τις προθεσμίες με την ${SPITI_MOU_LEGAL.incomeAmendment}. `}<ExtLink href={SPITI_MOU_LEGAL.sources.kya}>ΚΥΑ στην ΕΑΤ</ExtLink>{' · '}<ExtLink href={SPITI_MOU_LEGAL.sources.incomeAmendment}>ανακοίνωση των υπουργείων για τη διεύρυνση</ExtLink>{' · '}<ExtLink href={SPITI_MOU_LEGAL.sources.portal}>stegasi.gov.gr</ExtLink>{' · '}<ExtLink href={SPITI_MOU_LEGAL.sources.certificate}>βεβαίωση επιλεξιμότητας στο gov.gr</ExtLink>.</>,
    <>{`${P3.name}: `}<ExtLink href={P3.sources.announcement}>ομιλία του πρωθυπουργού στη ΔΕΘ</ExtLink>{' · '}<ExtLink href={P3.sources.pressConference}>συνέντευξη Τύπου</ExtLink>{' · '}<ExtLink href={P3.sources.hdb}>δελτίο Τύπου της ΕΑΤ</ExtLink>{' · '}<ExtLink href={P3.sources.measures}>εξειδίκευση των μέτρων</ExtLink>.</>,
    <>{'Όχι ακόμη επίσημο: '}<ExtLink href={R.source.url}>{R.source.label}</ExtLink>{' · '}<ExtLink href={R.beneficiariesSource}>δήλωση της υπουργού Κοινωνικής Συνοχής</ExtLink>.</>,
    'Όριο δόσης: ΠΕΕ 227/1/08.03.2024 της Τράπεζας της Ελλάδος, ισχύει από 01/01/2025.',
  ];

  return (
    <div className="po-tool-page" data-mode="dark" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', minHeight: '100vh', fontFamily: T.font.sans }}>
      <JsonLd data={jsonLd} />
      <PublicHeader current="odigos" />

      <GuideMain rail={{ sections: Object.values(S), cta: CALC }}>
        <div className="lp-eyebrow">Οδηγός</div>
        <h1 style={{ fontSize: 'clamp(28px,4.4vw,42px)', fontWeight: 680, letterSpacing: '-0.035em',
          lineHeight: 1.1, margin: '0 0 14px', textWrap: 'balance' }}>
          {H1}
        </h1>
        <GuideUpdated guide={GUIDE} />
        <GuideToc sections={Object.values(S)} />

        <p className="lg-p">{spitiMou3Line()}</p>
        {closed && <p className="lg-p">{closed}</p>}
        <p className="lg-p">
          {'Ο οδηγός βάζει δίπλα δίπλα τι ίσχυε στα δύο προηγούμενα προγράμματα, τι έχει πει επίσημα ο φορέας για το νέο και τι έχει μόνο ειπωθεί. Δεν κρίνει αν είσαι επιλέξιμος: αυτό θα γίνει μόνο με τους όρους της ΚΥΑ.'}
        </p>
        <div className="lg-note lg-note-tip" style={{ marginTop: 16 }}>{checkedLine()}</div>

        {/* 1. Σπίτι μου Ι */}
        <H2 {...S.one} />
        <p className="lg-p">
          {`Το πρώτο πρόγραμμα το έτρεχε η ${P1.agency} (${P1.legalBasis}). Αιτήσεις έγιναν από ${programDateLabel(P1.applicationsFrom)} έως ${programDateLabel(P1.applicationsTo)}. Ήταν για νέους και ζευγάρια ${P1.ageMin} έως ${P1.ageMax} ετών, για πρώτη κατοικία έως ${feWhole(P1.maxPropertyValue)} και ${P1.maxSqm} τ.μ., σε κτίριο τουλάχιστον ${P1.minBuildingAgeYears} ετών.`}
        </p>
        <p className="lg-p">
          {`Το δάνειο έφτανε τα ${feWhole(P1.maxAmount)}. Το ${fpRate(P1.interestFreeShare * 100)} το έδινε η ${P1.agency} χωρίς τόκο και το υπόλοιπο η τράπεζα με το επιτόκιό της. Πόσα δάνεια υπογράφηκαν τελικά δεν βρέθηκε σε επίσημο απολογισμό.`}
        </p>

        {/* 2. Σπίτι μου ΙΙ */}
        <H2 {...S.two} />
        <p className="lg-p">
          {`Το δεύτερο το διαχειριζόταν η Ελληνική Αναπτυξιακή Τράπεζα με πόρους του Ταμείου Ανάκαμψης (${SPITI_MOU_LEGAL.kya}). Ανέβασε την ηλικία στα ${SPITI_MOU.ageMax}, το δάνειο στα ${feWhole(SPITI_MOU.maxAmount)} και την αξία στα ${feWhole(SPITI_MOU.maxPropertyValue)}. Οι αιτήσεις έκλεισαν στις ${programDateLabel(SPITI_MOU.applicationDeadline)} και οι υπογραφές στις ${programDateLabel(SPITI_MOU.contractDeadline)}.`}
        </p>
        <p className="lg-p">{incomeChangeLine()}</p>
        <p className="lg-p">
          {'Τα όρια που κυκλοφορούν ακόμη σε παλιά άρθρα είναι συχνά αυτά πριν από την τροποποίηση. Ο πίνακας πιο κάτω γράφει τα τελευταία.'}
        </p>

        {/* 3. Σπίτι μου ΙΙΙ */}
        <H2 {...S.three} />
        <ul className="lg-ul">
          <li><strong style={STRONG}>{'Ανακοίνωση:'}</strong>{` στη ΔΕΘ, ${grDate(P3.announcedOn)}.`}</li>
          <li><strong style={STRONG}>{'Φορέας:'}</strong>{` ${P3.channel}.`}</li>
          <li><strong style={STRONG}>{'Προϋπολογισμός:'}</strong>{` ${fn(P3.budgetEur / 1e9)} δισ. ευρώ, κατά την ΕΑΤ.`}</li>
          <li><strong style={STRONG}>{'Έναρξη:'}</strong>{` ${P3.startLabel}, κατά την ΕΑΤ. Δεν είναι ημερομηνία αιτήσεων.`}</li>
          <li><strong style={STRONG}>{'Ηλικία:'}</strong>{` έως ${P3.ageMax} ετών, κατά την κυβερνητική εξειδίκευση των μέτρων.`}</li>
        </ul>
        <p className="lg-p">
          {'Κανένα άλλο κριτήριο δεν έχει δημοσιευτεί σε επίσημο κείμενο: ούτε εισόδημα, ούτε αξία, ούτε ποιες τράπεζες συμμετέχουν.'}
        </p>

        {/* ΤΟ ΠΛΑΙΣΙΟ «ΟΧΙ ΑΚΟΜΗ ΕΠΙΣΗΜΟ». Μόνο από τις δύο συναρτήσεις του
            recommend.ts, με την πηγή τους από κάτω (απόφαση 19/10/2026). */}
        <aside aria-label="Τι έχει ειπωθεί, όχι ακόμη επίσημο" className="lg-note lg-note-tip" style={{ marginTop: 16, borderLeftColor: 'var(--warning)',
          background: 'color-mix(in srgb, var(--warning) 7%, var(--bg-elevated))' }}>
          <strong style={{ ...STRONG, display: 'block', marginBottom: 8 }}>{'Τι έχει ειπωθεί, όχι ακόμη επίσημο'}</strong>
          <ul className="lg-ul" style={{ marginBottom: 10 }}>
            {spitiMou3ReportedLines().map(l => <li key={l}>{l}</li>)}
          </ul>
          <span>{`${spitiMou3ReportedCaveat()} `}</span>
          <span>{'Πηγές: '}<ExtLink href={R.source.url}>{R.source.label}</ExtLink>{' · '}<ExtLink href={R.beneficiariesSource}>υπουργείο Κοινωνικής Συνοχής</ExtLink>.</span>
        </aside>

        {/* 4. Σύγκριση */}
        <H2 {...S.compare} />
        <p className="lg-p">
          {'Στη στήλη του ΙΙΙ, ό,τι έχει σήμα «όχι ακόμη επίσημο» έρχεται από δηλώσεις και δημοσιεύματα, όχι από την ΚΥΑ.'}
        </p>
        <div className="po-table-box" style={{ marginTop: 14 }}>
          <div className="po-scroll-x" style={{ overflowX: 'auto' }}>
            {/* Τέσσερις στήλες με κείμενο δεν χωρούν στα 390: ο πίνακας κυλά
                οριζόντια, με καρφωμένη την πρώτη στήλη όπως κάθε .po-table. */}
            <table className="po-table tbl-fixed" style={{ '--tbl-min': '680px' } as CSSProperties}>
              <caption>{`${PROGRAM_NAMES.join(', ')}: τα κριτήρια ένα προς ένα`}</caption>
              {/* Ίσες στήλες για τα τρία προγράμματα: με αυτόματο πλάτος το ΙΙΙ, με
                  τα πιο σύντομα κελιά, στένευε και έσπαγε κάθε δεύτερη λέξη. */}
              <colgroup><col style={{ width: '19%' }} />{PROGRAM_NAMES.map(n => <col key={n} style={{ width: '27%' }} />)}</colgroup>
              <thead>
                <tr>
                  <th scope="col">Κριτήριο</th>
                  {PROGRAM_NAMES.map(n => <th key={n} scope="col">{n}</th>)}
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map(row => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    {row.cells.map((c, i) => <CellView key={i} c={c} />)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 5. Από σήμερα */}
        <H2 {...S.now} />
        <ul className="lg-ul">
          <li><strong style={STRONG}>{'Μέτρα τη δόση, όχι το πρόγραμμα.'}</strong>{` ${dstiLine()}`}</li>
          <li><strong style={STRONG}>{'Κράτα ενεργούς τους κωδικούς σου στο gov.gr.'}</strong>{` Στο ${NAME_2} η βεβαίωση επιλεξιμότητας έβγαινε ηλεκτρονικά στο gov.gr και την πήγαινες στην τράπεζα. Για το ${P3.name} δεν έχει δημοσιευτεί ακόμη λίστα δικαιολογητικών.`}</li>
          <li><strong style={STRONG}>{'Μη δεσμευτείς με όρια που δεν έχουν γραφτεί.'}</strong>{' Προκαταβολή ή προσύμφωνο με την προσδοκία ενός ορίου εισοδήματος ή αξίας είναι ρίσκο ώσπου να δημοσιευτεί η ΚΥΑ.'}</li>
        </ul>
        <p className="lg-p">
          {'Ο '}
          <Link href={CALC.href} className="lp-link" style={LINK_STYLE}>υπολογιστής στεγαστικού</Link>
          {' δείχνει τη δόση με τα σημερινά επιτόκια των τραπεζών, χωρίς κρατικό πρόγραμμα.'}
        </p>

        <GuideSources over="6. Τεκμηρίωση" sources={SOURCES} />

        <GuideCta title="Η δόση του δικού σου δανείου" href={CALC.href} action={CALC.action}>
          {'Βάλε ποσό, διάρκεια και εισόδημα. Ο υπολογιστής δείχνει τη δόση, τους τόκους κάθε χρονιάς και πόσο δάνειο αντιστοιχεί στο όριο της Τράπεζας της Ελλάδος.'}
        </GuideCta>

        <GuideFaq title={`Ό,τι ρωτούν για το ${P3.name}`} faq={FAQ} />

        <RelatedGuides current={GUIDE} />

        <div className="lg-note lg-note-fine" style={{ marginTop: 'clamp(40px,5vw,60px)' }}>
          {'Ο οδηγός είναι ενημερωτικός. Δεν κρίνει επιλεξιμότητα και δεν αντικαθιστά τους όρους της ΚΥΑ ή της τράπεζας. Ομάδα Properwise.'}
        </div>
      </GuideMain>

      <PublicFooter />
    </div>
  );
}
