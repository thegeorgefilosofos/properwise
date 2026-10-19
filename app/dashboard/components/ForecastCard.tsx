'use client';

// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΕΠΟΜΕΝΟΙ 12 ΜΗΝΕΣ — Η ΚΑΡΤΑ
// ─────────────────────────────────────────────────────────────────────────
// Τα ποσά τα βγάζει το lib/home/forecast12.ts από τις μηχανές που ήδη υπάρχουν·
// εδώ ζει μόνο η εικόνα. Τρία πράγματα, με αυτή τη σειρά:
//
//   1. ΤΟ ΣΥΜΠΕΡΑΣΜΑ ΠΡΩΤΟ. Ο πιο σφιχτός μήνας, το καθαρό του και οι χρεώσεις
//      που πέφτουν μαζί. Αυτό ήρθε να μάθει ο ιδιοκτήτης· το γράφημα το
//      αποδεικνύει, δεν το αντικαθιστά.
//   2. ΤΟ ΓΡΑΦΗΜΑ. Δώδεκα στήλες σε κοινή κλίμακα, ο άξονας του μηδενός εκεί που
//      χωρίζονται εισροές και εκροές. Βέβαιο συμπαγές, αναμενόμενο διακεκομμένο,
//      η λήξη μίσθωσης ως άδειο πλαίσιο. Καμία χρωματική ετυμηγορία: μία
//      οικογένεια, δύο εντάσεις (`--series-in`, `--series-out`).
//   3. Ο ΜΗΝΑΣ ΑΝΑΛΥΤΙΚΑ. Κάθε γραμμή με την πηγή της· ο πίνακας των δώδεκα
//      μηνών ένα πάτημα πιο κάτω, για όποιον δεν βλέπει το γράφημα.
//
// ΓΙΑΤΙ ΟΙ ΣΤΗΛΕΣ ΔΕΝ ΠΑΤΙΟΥΝΤΑΙ. Στα 390 κάθε στήλη είναι 26 εικονοστοιχεία·
// ο κανόνας αφής θέλει 44 × 44 και θα έσπαγε το πλάτος. Ο μήνας αλλάζει με δύο
// κουμπιά των 44 κάτω από το γράφημα και η στήλη του φωτίζεται.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { T, Btn, IconBtn, LinkBtn, EmptyState, fe } from '@/components/Theme';
import { feSigned, grDate } from '@/lib/core/format';
import { monthNom, monthShort, monthAcc } from '@/lib/core/months';
import type { Forecast, ForecastGap, ForecastLine, ForecastMonth } from '@/lib/home/forecast12';
import { track, PRODUCT_EVENTS, forecastProps } from '@/lib/analytics/events';
import type { createClient } from '@/lib/supabase/client';

type SupaClient = ReturnType<typeof createClient>;

const monthTitle = (m: ForecastMonth) => `${monthNom(m.month - 1)} ${m.year}`;
const signed = (l: Pick<ForecastLine, 'amount' | 'dir'>) => (l.dir === 'in' ? `+${fe(l.amount)}` : feSigned(-l.amount));

/** Η λέξη στη θέση του ποσού, για ό,τι δεν ξέρουμε. Ποτέ μηδέν. */
const GAP_WORD: Record<ForecastGap['kind'], string> = { vacancy: 'κενό;', missing: 'λείπει', unrecorded: 'άγνωστο', owed: 'οφείλεται' };

// Οι ροές που θέλουν μήνυμα όταν η πρόβλεψη είναι κενή: πού γράφεται καθεμία.
const EMPTY_STEPS: { tab: string; label: string }[] = [
  { tab: 'tenant', label: 'Πρόσθεσε μίσθωση' },
  { tab: 'loan', label: 'Πρόσθεσε δάνειο' },
  { tab: 'accounting', label: 'Γράψε τον ΕΝΦΙΑ' },
];

export default function ForecastCard({ forecast, propertyId, onNavigate, tabVisible, supabase, notes }: {
  forecast: Forecast;
  /** Για να μετρηθεί μία φορά ανά ακίνητο. */
  propertyId: string;
  onNavigate: (tab: string) => void;
  tabVisible: (id: string) => boolean;
  supabase: SupaClient;
  /** Σημειώσεις της οθόνης: συνιδιοκτησία, βραχυχρόνια, φόρος εισοδήματος. */
  notes: string[];
}) {
  const { months, tightest } = forecast;
  const firstWithLines = Math.max(0, months.findIndex(m => m.lines.length > 0 || m.gaps.length > 0));
  const [sel, setSel] = useState<number>(tightest?.index ?? firstWithLines);
  const [table, setTable] = useState(false);
  const cardRef = useRef<HTMLElement>(null);

  // ── ΜΙΑ ΜΕΤΡΗΣΗ ΟΤΑΝ Η ΚΑΡΤΑ ΦΑΝΕΙ ─────────────────────────────────────
  // Όχι στη φόρτωση: η κάρτα είναι κάτω από το Ταμείο και την ατζέντα και
  // «φορτώθηκε» δεν σημαίνει «την είδε». Μία φορά ανά ακίνητο και άνοιγμα.
  const sent = useRef<string | null>(null);
  const { monthsWithLines, gapCount, empty } = forecast;
  useEffect(() => {
    const el = cardRef.current;
    if (!el || sent.current === propertyId || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(entries => {
      if (!entries.some(e => e.isIntersecting) || sent.current === propertyId) return;
      sent.current = propertyId;
      void track(supabase, PRODUCT_EVENTS.forecast_viewed, forecastProps({
        months: monthsWithLines, gaps: gapCount, state: empty ? 'empty' : 'filled',
      }));
      io.disconnect();
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [propertyId, supabase, monthsWithLines, gapCount, empty]);

  const head = (
    <div className="fc-head">
      <h2 className="fc-title">Οι επόμενοι 12 μήνες</h2>
      <span className="fc-sub">Από μισθώσεις, δόσεις και λογαριασμούς που ήδη υπάρχουν</span>
    </div>
  );


  // ── Η ΚΟΙΝΗ ΚΛΙΜΑΚΑ ─────────────────────────────────────────────────────
  // Το ύψος της εισροής και της εκροής μετριέται με τον ίδιο χάρακα: η πάνω
  // ζώνη παίρνει όσο ύψος χρειάζεται ο μεγαλύτερος μήνας εισροών, η κάτω όσο ο
  // μεγαλύτερος μήνας εκροών. Το «κενό;» μετράει με το ενοίκιο που λείπει.
  // Το ύψος του άδειου πλαισίου είναι ΕΝΑ μίσθωμα (`level` από τη μηχανή), όχι η
  // μεγαλύτερη γραμμή ενοικίου: μια τριμηνιαία δόση θα το έκανε τριπλάσιο.
  const vacancyOf = (m: ForecastMonth) => m.gaps.find(g => g.kind === 'vacancy');
  const vacLevel = (m: ForecastMonth) => vacancyOf(m)?.level ?? 0;
  const maxUp = Math.max(0, ...months.map(m => Math.max(m.inActual + m.inExpected, vacLevel(m))));
  const maxDown = Math.max(0, ...months.map(m => m.outActual + m.outExpected));
  const span = maxUp + maxDown || 1;
  // ΚΛΑΣΜΑ, ΟΧΙ ΠΟΣΟΣΤΟ ΣΕ ΚΕΙΜΕΝΟ. Το ύψος περνά ως μεταβλητή (`--fc-share`, 0 ως 1) και
  // το CSS το κάνει μήκος· έτσι κανένα «%» δεν γράφεται με το χέρι στο JSX.
  const frac = (v: number, of: number): CSSProperties => ({ ['--fc-share' as string]: of > 0 ? Math.max(0, Math.min(1, v / of)) : 0 });

  const m = months[Math.min(Math.max(0, sel), months.length - 1)];
  const tight = tightest ? months[tightest.index] : null;
  const tightVacant = tight ? !!vacancyOf(tight) : false;
  const summary = tight
    ? `Ο πιο σφιχτός μήνας είναι ο ${monthAcc(tight.month - 1)} ${tight.year}, με καθαρό ${feSigned(tight.net)}.`
    : 'Καμία εκροή μέσα στους επόμενους 12 μήνες.';

  const steps = EMPTY_STEPS.filter(s => tabVisible(s.tab));
  const isEmpty = forecast.empty || months.length === 0;
  return (
    <section ref={cardRef} className="fc" aria-label="Οι επόμενοι 12 μήνες">
      {head}
      {isEmpty ? (
      <div className="fc-body">
        <EmptyState title="Καμία προγραμματισμένη χρέωση ακόμη"
          hint="Με τη μίσθωση, το δάνειο και τον ΕΝΦΙΑ, εδώ φαίνεται από τώρα ποιος μήνας θα είναι ο πιο σφιχτός και γιατί."
          action={steps.length > 0 ? <div className="fc-empty-acts">{steps.map(s => <Btn key={s.tab} onClick={() => onNavigate(s.tab)}>{s.label}</Btn>)}</div> : undefined} />
      </div>
      ) : (
      <div className="fc-body">
        {/* ═══ ΤΟ ΣΥΜΠΕΡΑΣΜΑ ═══════════════════════════════════════════════ */}
        <div className="fc-top">
          <div className="fc-lead">
            <span className="fc-kicker">{tight ? 'Ο πιο σφιχτός μήνας' : 'Οι επόμενοι μήνες'}</span>
            {tight ? (
              <>
                <div className="fc-lead-row">
                  <span className="fc-month">{monthTitle(tight)}</span>
                  <span className="fc-net">{feSigned(tight.net)}</span>
                </div>
                <p className="fc-why">
                  {/* Κάθε χρέωση με το ποσό της κολλητά, σε μία ανάγνωση: στη
                      γραμμή που σπάει, το «1/8» και το «132,14€» διαβάζονταν
                      ως δύο αριθμοί χωρίς σχέση. */}
                  {tightest && tightest.drivers.length > 0 && <>Πέφτουν μαζί: {tightest.drivers.map((d, k, a) => (
                    <span key={`${d.kind}-${k}`}>
                      {k > 0 && (k === a.length - 1 ? ' και ' : ', ')}
                      {d.label} <span className="fc-why-amt">{fe(d.amount)}</span>
                    </span>
                  ))}.</>}
                  {tightVacant && <> Χωρίς ενοίκιο, αν το ακίνητο μείνει κενό μετά τη λήξη της μίσθωσης.</>}
                </p>
              </>
            ) : (
              <p className="fc-why">Μόνο εισροές μέσα στους επόμενους 12 μήνες.</p>
            )}
          </div>
          <ul className="fc-legend" aria-label="Υπόμνημα">
            <li><span className="sw sw-in" aria-hidden />Εισροές</li>
            <li><span className="sw sw-out" aria-hidden />Εκροές</li>
            <li><span className="sw sw-exp" aria-hidden />Αναμενόμενο</li>
            {months.some(x => vacancyOf(x)) && <li><span className="sw sw-vac" aria-hidden />κενό; μετά τη λήξη</li>}
            {/* Το σημάδι του «λείπει» κάτω από τις εκροές μοιάζει με αναμενόμενο ποσό·
                χωρίς δική του γραμμή στο υπόμνημα διαβαζόταν ως τέτοιο. */}
            {months.some(x => x.gaps.some(g => g.kind === 'missing' && g.flow !== 'rent')) && <li><span className="sw sw-miss" aria-hidden />λείπει ποσό</li>}
          </ul>
        </div>

        {/* ═══ ΤΟ ΓΡΑΦΗΜΑ ═══════════════════════════════════════════════════ */}
        <figure className="fc-chart" role="img" aria-label={`${summary} Ο πίνακας κάτω από το γράφημα έχει όλους τους μήνες.`}>
          <div className="fc-plot">
            <span className="fc-axis" style={frac(maxUp, span)} aria-hidden />
            {months.map((x, i) => {
              const vac = vacancyOf(x);
              const missing = x.gaps.some(g => g.kind === 'missing' && g.flow !== 'rent');
              return (
                <div key={x.ym} className="fc-col" data-sel={i === sel ? '' : undefined} data-tight={tightest?.index === i ? '' : undefined}
                  title={`${monthTitle(x)}: εισροές ${fe(x.inActual + x.inExpected)}, εκροές ${fe(x.outActual + x.outExpected)}`}>
                  <div className="fc-up" style={frac(maxUp, span)}>
                    {x.inActual > 0 && <span className="fc-bar in" style={frac(x.inActual, maxUp)} />}
                    {x.inExpected > 0 && <span className="fc-bar in exp" style={frac(x.inExpected, maxUp)} />}
                    {vac && x.inActual + x.inExpected === 0 && <span className="fc-vac" style={frac(vacLevel(x), maxUp)} />}
                  </div>
                  <div className="fc-down" style={frac(maxDown, span)}>
                    {x.outActual > 0 && <span className="fc-bar out" style={frac(x.outActual, maxDown)} />}
                    {x.outExpected > 0 && <span className="fc-bar out exp" style={frac(x.outExpected, maxDown)} />}
                    {missing && <span className="fc-miss" />}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="fc-labels" aria-hidden>
            {months.map((x, i) => (
              <span key={x.ym} className="fc-lab" data-sel={i === sel ? '' : undefined} data-odd={i % 2 ? '' : undefined}>
                <span className="fc-lab-m">{monthShort(x.month - 1)}</span>
                {(i === 0 || x.month === 1) && <span className="fc-year">{x.year}</span>}
              </span>
            ))}
          </div>
        </figure>

        {/* ═══ Ο ΜΗΝΑΣ ═══════════════════════════════════════════════════════ */}
        <div className="fc-step">
          <IconBtn label="Προηγούμενος μήνας" disabled={sel <= 0} onClick={() => setSel(s => Math.max(0, s - 1))}>
            <svg aria-hidden="true" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </IconBtn>
          <div className="fc-step-mid" aria-live="polite">
            <span className="fc-step-month">{monthTitle(m)}</span>
            <span className="fc-step-net">καθαρό {feSigned(m.net)}</span>
          </div>
          <IconBtn label="Επόμενος μήνας" disabled={sel >= months.length - 1} onClick={() => setSel(s => Math.min(months.length - 1, s + 1))}>
            <svg aria-hidden="true" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </IconBtn>
        </div>
        {m.lines.length === 0 && m.gaps.length === 0 ? (
          <p className="fc-none">Τίποτα προγραμματισμένο αυτόν τον μήνα.</p>
        ) : (
          <ul className="fc-lines">
            {m.lines.map((l, k) => (
              <li key={`${l.kind}-${k}`} className="fc-line">
                <span className={`sw ${l.dir === 'in' ? 'sw-in' : 'sw-out'}${l.certainty === 'expected' ? ' sw-exp-of' : ''}`} aria-hidden />
                <span className="fc-line-body">
                  <span className="fc-line-label">{l.label}</span>
                  <span className="fc-line-src">
                    {l.date ? `${grDate(l.date)} · ` : ''}{l.source}{l.certainty === 'expected' ? ', αναμενόμενο' : ''}
                  </span>
                </span>
                <span className="fc-line-amt">{signed(l)}</span>
              </li>
            ))}
            {m.gaps.map((g, k) => (
              <li key={`gap-${k}`} className="fc-line is-gap">
                <span className="sw sw-vac" aria-hidden />
                <span className="fc-line-body">
                  <span className="fc-line-label">{g.label}</span>
                  <span className="fc-line-src">{g.hint}</span>
                </span>
                <span className="fc-line-amt fc-line-word">{GAP_WORD[g.kind]}</span>
              </li>
            ))}
          </ul>
        )}

        {/* ═══ ΤΙ ΣΗΜΑΙΝΕΙ ΚΑΙ Ο ΠΙΝΑΚΑΣ ═════════════════════════════════ */}
        <div className="fc-foot">
          <p className="fc-note">
            Δεν ξέρουμε το υπόλοιπο της τράπεζας, οπότε κάθε μήνας μετρά από το μηδέν. Ό,τι έχει ήδη λήξει είναι στο Ταμείο, πιο πάνω.
            {notes.map(n => <span key={n}> {n}</span>)}
          </p>
          <LinkBtn onClick={() => setTable(t => !t)}>{table ? 'Κρύψε τον πίνακα' : 'Δες τον πίνακα'}</LinkBtn>
        </div>
        {table && (
          <div className="fc-table-wrap">
            <table className="fc-table">
              <caption className="sr-only">Οι επόμενοι 12 μήνες ανά μήνα</caption>
              <thead>
                <tr><th scope="col">Μήνας</th><th scope="col">Εισροές</th><th scope="col">Εκροές</th><th scope="col">Καθαρό</th><th scope="col">Σωρευτικά</th></tr>
              </thead>
              <tbody>
                {months.map(x => (
                  <tr key={x.ym} data-tight={tightest && months[tightest.index] === x ? '' : undefined}>
                    <th scope="row">{monthShort(x.month - 1)} {x.year}{x.gaps.length > 0 ? ' *' : ''}</th>
                    <td>{fe(x.inActual + x.inExpected)}</td>
                    <td>{fe(x.outActual + x.outExpected)}</td>
                    <td>{feSigned(x.net)}</td>
                    <td>{feSigned(x.cumulative)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {forecast.gapCount > 0 && <p className="fc-note">* Μήνας με «κενό;», ποσό που λείπει ή ενοίκιο που δεν έχει μπει ακόμη.</p>}
          </div>
        )}
      </div>
      )}
      {/* Η ΙΔΙΑ ΕΠΙΦΑΝΕΙΑ ΜΕ ΤΗΝ ΑΤΖΕΝΤΑ ΑΠΟ ΠΑΝΩ: ίδιο περίγραμμα, γωνία, φως
          και κεφαλίδα. Δύο κάρτες στη σειρά που διαβάζονται ως μία οικογένεια. */}
      <style jsx>{`
  .fc {
    border: 1px solid var(--border-subtle);
    border-radius: ${T.radius.card}px;
    background:
      radial-gradient(120% 100% at 50% -20%, color-mix(in srgb, var(--accent) 5%, transparent) 0%, transparent 62%),
      var(--surface-raised);
    box-shadow: var(--highlight-inset), var(--elev-1);
    margin-bottom: 20px;
    overflow: hidden;
  }
  .fc-head {
    display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap;
    gap: 4px 12px; padding: 14px 18px 12px; border-bottom: 1px solid var(--border-subtle);
  }
  .fc-title {
    margin: 0; font-family: ${T.font.sans}; font-size: 11px; font-weight: 700;
    letter-spacing: 0.07em; text-transform: uppercase; color: var(--text-secondary);
  }
  .fc-sub { font-family: ${T.font.sans}; font-size: 12px; color: var(--text-tertiary); min-width: 0; }
  .fc-body { padding: 16px 18px 12px; }
  /* Η συμπαγής EmptyState βάζει τη δράση σε σκέτο div: τρία κουμπιά κολλούσαν. */
  .fc-empty-acts { display: flex; flex-wrap: wrap; gap: 8px; }

  .fc-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .fc-lead { min-width: 0; flex: 1 1 320px; }
  .fc-kicker {
    display: block; font-family: ${T.font.sans}; font-size: 11px; font-weight: 700;
    letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-tertiary); margin-bottom: 4px;
  }
  .fc-lead-row { display: flex; align-items: baseline; gap: 4px 12px; flex-wrap: wrap; }
  .fc-month {
    font-family: ${T.font.sans}; font-size: 20px; font-weight: 700; letter-spacing: -0.01em;
    line-height: 1.25; color: var(--text-primary);
  }
  .fc-net {
    font-family: ${T.font.num}; font-size: 20px; font-weight: 600; letter-spacing: -0.01em;
    line-height: 1.25; color: var(--text-primary); font-variant-numeric: tabular-nums; white-space: nowrap;
  }
  .fc-why {
    margin: 6px 0 0; font-family: ${T.font.sans}; font-size: 13px; line-height: 1.55;
    color: var(--text-secondary); text-wrap: pretty; max-width: 62ch;
  }
  .fc-why-amt { font-family: ${T.font.num}; font-weight: 600; color: var(--text-primary); white-space: nowrap; font-variant-numeric: tabular-nums; }
  .fc-legend {
    list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px 16px;
    font-family: ${T.font.sans}; font-size: 12px; color: var(--text-secondary);
    flex: 0 1 auto; justify-content: flex-end;
  }
  .fc-legend li { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }

  .sw { display: inline-block; width: 10px; height: 10px; border-radius: ${T.radius.hair}px; flex-shrink: 0; }
  .sw-in { background: var(--series-in); }
  .sw-out { background: var(--series-out); }
  .sw-exp { background: color-mix(in srgb, var(--text-tertiary) 14%, transparent); border: 1px dashed var(--text-secondary); }
  .sw-vac { background: transparent; border: 1px dashed var(--text-tertiary); }
  .sw-miss { background: transparent; border: 1px dashed var(--text-tertiary); border-top: none; border-radius: ${T.radius.hair}px; }
  .sw-in.sw-exp-of { background: color-mix(in srgb, var(--series-in) 22%, transparent); border: 1px dashed var(--series-in); }
  .sw-out.sw-exp-of { background: color-mix(in srgb, var(--series-out) 22%, transparent); border: 1px dashed var(--series-out); }

  .fc-chart { margin: 20px 0 0; }
  .fc-plot {
    position: relative; height: 176px;
    display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); column-gap: 4px;
  }
  .fc-axis { position: absolute; left: 0; right: 0; top: calc(var(--fc-share, 0) * 100%); height: 1px; background: var(--series-axis); pointer-events: none; }
  .fc-col {
    position: relative; display: flex; flex-direction: column; min-width: 0;
    border-radius: ${T.radius.xs}px;
  }
  .fc-col[data-sel] { background: var(--bg-hover); }
  .fc-col[data-tight]::after {
    content: ''; position: absolute; inset: -4px -2px; border-radius: ${T.radius.chip}px;
    box-shadow: inset 0 0 0 2px var(--accent); pointer-events: none;
  }
  .fc-up { height: calc(var(--fc-share, 0) * 100%); display: flex; flex-direction: column-reverse; align-items: center; min-height: 0; }
  .fc-down { height: calc(var(--fc-share, 0) * 100%); display: flex; flex-direction: column; align-items: center; min-height: 0; }
  .fc-bar { display: block; height: calc(var(--fc-share, 0) * 100%); width: min(64%, 28px); flex-shrink: 0; min-height: 2px; }
  .fc-bar.in { background: var(--series-in); }
  .fc-bar.out { background: var(--series-out); }
  .fc-up .fc-bar:last-child { border-radius: ${T.radius.hair}px; }
  .fc-down .fc-bar:last-of-type { border-radius: ${T.radius.hair}px; }
  .fc-bar.exp { border-width: 1px; border-style: dashed; }
  .fc-bar.in.exp { background: color-mix(in srgb, var(--series-in) 22%, transparent); border-color: var(--series-in); }
  .fc-bar.out.exp { background: color-mix(in srgb, var(--series-out) 22%, transparent); border-color: var(--series-out); }
  .fc-vac {
    position: relative; display: block; height: calc(var(--fc-share, 0) * 100%); width: min(64%, 28px); flex-shrink: 0;
    border: 1px dashed var(--text-tertiary); border-bottom: none; border-radius: ${T.radius.hair}px;
  }
  .fc-miss {
    display: block; width: min(64%, 28px); height: 12px; margin-top: 2px; flex-shrink: 0;
    border: 1px dashed var(--text-tertiary); border-top: none; border-radius: ${T.radius.hair}px;
  }
  .fc-labels {
    display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); column-gap: 4px; margin-top: 8px;
  }
  .fc-lab {
    display: flex; flex-direction: column; align-items: center; min-width: 0;
    font-family: ${T.font.sans}; font-size: 11px; line-height: 1.3; color: var(--text-tertiary);
  }
  .fc-lab[data-sel] { color: var(--text-primary); font-weight: 700; }
  .fc-year { font-size: 11px; color: var(--text-tertiary); font-weight: 400; }

  .fc-step {
    display: grid; grid-template-columns: auto minmax(0, 240px) auto; justify-content: center; align-items: center; gap: 8px;
    margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border-subtle);
  }
  .fc-step-mid { display: flex; flex-direction: column; align-items: center; text-align: center; min-width: 0; }
  .fc-step-month { font-family: ${T.font.sans}; font-size: 14px; font-weight: 700; color: var(--text-primary); }
  .fc-step-net { font-family: ${T.font.num}; font-size: 12px; color: var(--text-secondary); font-variant-numeric: tabular-nums; }

  .fc-lines { list-style: none; margin: 8px 0 0; padding: 0; }
  .fc-line {
    display: grid; grid-template-columns: 10px minmax(0, 1fr) auto; align-items: baseline; gap: 12px;
    padding: 8px 0; border-top: 1px solid var(--border-subtle);
  }
  .fc-line:first-child { border-top: none; }
  .fc-line .sw { transform: translateY(1px); }
  .fc-line-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .fc-line-label { font-family: ${T.font.sans}; font-size: 14px; font-weight: 600; line-height: 1.4; color: var(--text-primary); }
  .fc-line-src { font-family: ${T.font.sans}; font-size: 12px; line-height: 1.5; color: var(--text-tertiary); text-wrap: pretty; }
  .fc-line-amt {
    font-family: ${T.font.num}; font-size: 14px; font-weight: 600; color: var(--text-primary);
    font-variant-numeric: tabular-nums; white-space: nowrap; text-align: right;
  }
  .fc-line-word { font-family: ${T.font.sans}; font-weight: 400; font-size: 12px; color: var(--text-tertiary); }
  .fc-none { margin: 8px 0 0; font-family: ${T.font.sans}; font-size: 13px; color: var(--text-tertiary); }

  .fc-foot {
    display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;
    margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border-subtle);
  }
  .fc-note {
    margin: 0; flex: 1 1 320px; min-width: 0; font-family: ${T.font.sans}; font-size: 12px;
    line-height: 1.55; color: var(--text-tertiary); text-wrap: pretty;
  }
  .fc-table-wrap { margin-top: 12px; overflow-x: auto; }
  .fc-table { width: 100%; border-collapse: collapse; font-family: ${T.font.sans}; font-size: 12px; }
  .fc-table th, .fc-table td { padding: 6px 8px; border-top: 1px solid var(--border-subtle); white-space: nowrap; }
  .fc-table thead th {
    border-top: none; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--text-tertiary); text-align: right;
  }
  .fc-table thead th:first-child, .fc-table tbody th { text-align: left; }
  .fc-table tbody th { font-weight: 600; color: var(--text-secondary); }
  .fc-table td { text-align: right; color: var(--text-primary); font-variant-numeric: tabular-nums; font-family: ${T.font.num}; }
  .fc-table tr[data-tight] th, .fc-table tr[data-tight] td { background: var(--accent-soft); }

  @media (max-width: 620px) {
    .fc-body { padding: 14px 14px 10px; }
    .fc-head { padding: 14px 14px 12px; }
    .fc-plot { height: 148px; column-gap: 2px; }
    .fc-labels { column-gap: 2px; }
    .fc-month, .fc-net { font-size: 18px; }
    .fc-legend { justify-content: flex-start; gap: 4px 12px; }
    .fc-col[data-tight]::after { inset: -4px -1px; }
  }
  /* ΣΤΑ 320 ΔΩΔΕΚΑ ΕΤΙΚΕΤΕΣ ΔΕΝ ΧΩΡΑΝΕ. Κάθε στήλη είναι 20 εικονοστοιχεία και
     «Μαΐ Ιουν Ιουλ» κολλούσαν σε μία λέξη. Μένει κάθε δεύτερος μήνας, ο
     επιλεγμένος πάντα (με κρυμμένους τους γείτονές του, γιατί είναι έντονος) και
     το έτος όπου αλλάζει. */
  @media (max-width: 360px) {
    .fc-lab[data-odd]:not([data-sel]) .fc-lab-m { visibility: hidden; }
    .fc-lab[data-sel] + .fc-lab .fc-lab-m, .fc-lab:has(+ .fc-lab[data-sel]) .fc-lab-m { visibility: hidden; }
  }
      `}</style>
    </section>
  );
}
