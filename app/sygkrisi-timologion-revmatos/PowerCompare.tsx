'use client';
// ═══════════════════════════════════════════════════════════════════════════
// ΣΥΓΚΡΙΣΗ ΤΙΜΟΛΟΓΙΩΝ ΡΕΥΜΑΤΟΣ: ο διαδραστικός πυρήνας
// ─────────────────────────────────────────────────────────────────────────
// Η ΟΘΟΝΗ ΔΕΝ ΚΑΝΕΙ ΑΡΙΘΜΗΤΙΚΗ. Το κόστος, η σειρά και η πύλη παλαιότητας
// βγαίνουν από το lib/tools/revma.ts, που καλεί τον ίδιο κατάλογο και τον ίδιο
// τύπο με την καρτέλα «Ρεύμα» του πίνακα ελέγχου. Εδώ μόνο λέγονται.
//
// Η ΗΜΕΡΑ ΚΡΙΝΕΤΑΙ ΚΑΙ ΣΤΗ ΣΥΣΚΕΥΗ. Ο διακομιστής δίνει τη δική του μέρα για
// την πρώτη απόδοση (`serverToday`). Μια απόδοση που κρατήθηκε σε μνήμη
// (στατική σελίδα, CDN, παλιά καρτέλα) κουβαλά όμως τη μέρα που φτιάχτηκε και θα
// πάγωνε μαζί της την απόφαση «κατατάσσω ή όχι». Ο περιηγητής την ξανακρίνει
// με τη σημερινή, χωρίς σφάλμα ενυδάτωσης (`useSyncExternalStore`): αν ο
// κατάλογος έχει παλιώσει στο μεταξύ, η σειρά και το «φθηνότερο» φεύγουν μόλις
// φορτώσει η σελίδα.
// ═══════════════════════════════════════════════════════════════════════════
import { Fragment, useId, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { T, fdLong } from '@/components/tokens';
import { Btn } from '@/components/Theme';
import { fe, feRate, fn } from '@/lib/core/format';
import { parseAmount } from '@/lib/core/greek';
import { athensToday } from '@/lib/core/time';
import { comparePower, POWER_COLOURS, UNRANKED_WHY, type PowerColour, type PowerRow } from '@/lib/tools/revma';
import { PROVIDERS, TARIFFS_VERIFIED, CATALOGUE_MONTH_GEN, BADGE_MEANING, PRICES_SOURCE, PRICES_UPDATED_LINE, priceMonthNote, conditionNote } from '@/lib/energy/catalogue';
import { ETMEAR } from '@/lib/energy/tariff';
import { RAAEY_COMPARE, RAAEY_NAME } from '@/lib/energy/freshness';
import { useToolState, ToolActions, ToolPaper, ToolPaperFoot } from '@/app/ToolShare';
import { ToolNumField, ToolFields, ToolHero, ToolSeg } from '@/app/ToolParts';
import { ToolSelect } from '@/app/ToolSelect';
import LiveResult from '@/components/LiveResult';

/** Τα πεδία όπως ταξιδεύουν στη διεύθυνση, με τις προεπιλογές τους. */
const SPEC = { kwh: '300', periodos: 'mina', nychta: '0', ebill: 'nai', xroma: 'ola' } as const;
const PATH = '/sygkrisi-timologion-revmatos';

/** Πόσα τιμολόγια φαίνονται πριν ζητηθούν τα υπόλοιπα, όπως στον πίνακα ελέγχου. */
const VISIBLE = 12;

const amount = (s: string): number => Math.max(0, parseAmount(s) ?? 0);
const noSubscribe = () => () => {};

/** Τα μικρά γεγονότα κάτω από το όνομα: τιμή, μήνας της τιμής, πάγιο, δέσμευση. */
function facts(t: PowerRow['t'], ebill: boolean): string[] {
  const out: string[] = [];
  if (t.type === 'fixed_monthly') {
    out.push(t.flat_annual_kwh ? `Πακέτο ${fn(t.flat_annual_kwh)} κιλοβατώρες τον χρόνο` : 'Χωρίς δημοσιευμένο όριο κιλοβατωρών');
  } else {
    // Στα αναδρομικά ο αριθμός του καταλόγου είναι η ΒΑΣΙΚΗ τιμή, όχι η τελική.
    out.push(t.kwh_day == null ? (t.priceUnsupported ? 'Κλιμακωτό σε περισσότερες από δύο κλίμακες' : 'Χωρίς γνωστή τιμή')
      : t.priceStatus !== 'retro' ? `${feRate(t.kwh_day)} ανά κιλοβατώρα${t.kwh_tier2 != null && t.tier2_threshold != null ? (t.tier2_scope === 'all' ? `, ${feRate(t.kwh_tier2)} για όλες πάνω από ${fn(t.tier2_threshold)} kWh` : `, ${feRate(t.kwh_tier2)} από την ${fn(t.tier2_threshold + 1)}η`) : ''}`
      : t.kwh_day > 0 ? `${feRate(t.kwh_day)} βασική τιμή, κλείνει αναδρομικά`
      : 'Η τιμή του μήνα ανακοινώνεται τον επόμενο');
    if (t.kwh_night) out.push(`Νυχτερινή ${feRate(t.kwh_night)}`);
    out.push(t.no_fixed ? 'Χωρίς πάγιο' : `Πάγιο ${fe(ebill && t.fixed_ebill != null ? t.fixed_ebill : t.fixed)}`);
  }
  // Κάθε τιμή λέει τον μήνα της: τα «πράσινα» αλλάζουν την πρώτη κάθε μήνα.
  out.push(priceMonthNote(t));
  const cond = conditionNote(t);
  if (cond) out.push(cond);
  out.push(t.contract_months ? `Δέσμευση ${t.contract_months} μήνες` : 'Χωρίς δέσμευση');
  return out;
}

export function PowerCompare({ serverToday, cta }: {
  serverToday: string;
  /** Η πρόσκληση του τέλους, αποδομένη στη σελίδα: βλ. `ToolCta` στο app/PublicChrome.tsx. */
  cta: ReactNode;
}) {
  const [v, set] = useToolState(SPEC, PATH);
  const ids = { kwh: useId(), night: useId() };
  const [all, setAll] = useState(false);

  // Η μέρα του διακομιστή στην πρώτη απόδοση, η σημερινή μόλις φορτώσει η σελίδα.
  const today = useSyncExternalStore(noSubscribe, athensToday, () => serverToday);

  const period = v.periodos === 'xronos' ? 'year' : 'month';
  const colour = (POWER_COLOURS.some(c => c.value === v.xroma) ? v.xroma : 'ola') as PowerColour;
  const ebill = v.ebill !== 'oxi';
  const nightIn = amount(v.nychta);
  const r = useMemo(() => comparePower(
    { kwh: amount(v.kwh), period, nightPct: nightIn, ebill, colour },
    new Date(`${today}T12:00:00`),
  ), [v.kwh, period, nightIn, ebill, colour, today]);

  const hasUsage = r.kwhMonthly > 0;
  const kwhLine = period === 'year'
    ? `${fn(r.kwhMonthly)} κιλοβατώρες τον μήνα (${fn(amount(v.kwh))} τον χρόνο)`
    : `${fn(r.kwhMonthly)} κιλοβατώρες τον μήνα`;
  const priced = r.rows.filter(x => x.monthly !== null).map(x => x.monthly as number);
  const low = priced.length ? Math.min(...priced) : 0;
  const high = priced.length ? Math.max(...priced) : 0;
  const shown = all ? r.rows : r.rows.slice(0, VISIBLE);
  const best = r.cheapest;
  const colourLabel = POWER_COLOURS.find(c => c.value === colour)?.label ?? '';

  return (
    <div style={{ fontFamily: T.font.sans }}>
      {/* ── ΤΑ ΠΕΝΤΕ ΠΟΥ ΧΡΕΙΑΖΕΤΑΙ Η ΣΥΓΚΡΙΣΗ ──────────────────────────────
          Κατανάλωση, περίοδος, νυχτερινή, ηλεκτρονικός λογαριασμός, χρώμα.
          Πρώτη σειρά η κατανάλωση, που αλλάζει το αποτέλεσμα· δεύτερη οι
          επιλογές, που το περιορίζουν. */}
      <ToolFields>
        <ToolNumField id={ids.kwh} label={period === 'year' ? 'Κατανάλωση τον χρόνο' : 'Κατανάλωση τον μήνα'}
          value={v.kwh} onChange={x => set('kwh', x)} unit="kWh" unitPad={52}
          hint="Από τον λογαριασμό σου, στις κιλοβατώρες της περιόδου."/>
        <ToolSeg label="Ο αριθμός είναι" value={period === 'year' ? 'xronos' : 'mina'}
          onChange={x => set('periodos', x)}
          options={[{ value: 'mina', label: 'Τον μήνα' }, { value: 'xronos', label: 'Τον χρόνο' }]}
          hint={period === 'year' ? 'Μοιράζεται ισόποσα στους δώδεκα μήνες.' : undefined}/>
        <ToolNumField id={ids.night} label="Νυχτερινή κατανάλωση" value={v.nychta}
          onChange={x => set('nychta', x)} unit="%" hint="Μόνο με νυχτερινό μετρητή. Αλλιώς 0."/>
        <ToolSeg label="Ηλεκτρονικός λογαριασμός" value={ebill ? 'nai' : 'oxi'}
          onChange={x => set('ebill', x)}
          options={[{ value: 'nai', label: 'Ναι' }, { value: 'oxi', label: 'Όχι' }]}
          hint="Μαζί με πάγια εντολή, σε κάποια τιμολόγια το πάγιο πέφτει."/>
        <ToolSelect label="Είδος τιμολογίου" value={colour} onChange={x => set('xroma', x)}
          options={POWER_COLOURS} span={2}/>
      </ToolFields>

      <ToolPaper title="Σύγκριση τιμολογίων ρεύματος" on={today} inputs={[
        { k: 'Κατανάλωση', v: kwhLine },
        { k: 'Νυχτερινή', v: `${fn(Math.min(100, nightIn))}%` },
        { k: 'Ηλεκτρονικός λογαριασμός', v: ebill ? 'Ναι' : 'Όχι' },
        { k: 'Είδος', v: colourLabel },
        { k: 'Έλεγχος τιμών', v: fdLong(TARIFFS_VERIFIED) },
      ]}/>

      <div className="po-tool-result" style={{
        marginTop: 20, padding: 'clamp(18px, 4vw, 26px)', borderRadius: T.radius.card,
        background: 'var(--surface-raised)', border: '1px solid var(--border-raised)',
        boxShadow: 'var(--well-inset)',
      }}>
        {/* ΜΙΑ ΗΜΕΡΟΜΗΝΙΑ ΠΑΝΩ ΑΠΟ ΚΑΘΕ ΑΡΙΘΜΟ. Χωρίς αυτήν, μια τιμή που ήταν
            σωστή τον Αύγουστο διαβάζεται ως σωστή και τον Δεκέμβριο. */}
        <p style={{ margin: '0 0 16px', fontSize: 13, lineHeight: 1.55, color: 'var(--text-secondary)', textWrap: 'pretty' }}>
          <strong style={{ color: 'var(--text-primary)' }}>{PRICES_UPDATED_LINE}</strong>. Πηγή: {PRICES_SOURCE}.
          Τιμές {CATALOGUE_MONTH_GEN}, εκτός όπου γράφεται άλλος μήνας· μόνο αυτές μπαίνουν στη σειρά.
          {r.recommend && <> Η σειρά ισχύει έως τις {fdLong(r.rankUntil)}· μετά, αν δεν ενημερωθούν οι τιμές, ο πίνακας μένει ενδεικτικός.</>}
        </p>

        {!hasUsage ? (
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            Γράψε την κατανάλωσή σου για να δεις τι θα πλήρωνες με κάθε τιμολόγιο.
          </p>
        ) : r.recommend && !(best && best.monthly !== null) ? (
          <>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
              Σε αυτό το είδος κανένα τιμολόγιο δεν έχει ποσό που κλείνει για {kwhLine}. Ο λόγος
              γράφεται κάτω από το καθένα.
            </p>
            <LiveResult say="Κανένα τιμολόγιο αυτού του είδους δεν μπαίνει σε σειρά."/>
          </>
        ) : best && best.monthly !== null ? (
          <>
            {/* ΤΟ «ΦΘΗΝΟΤΕΡΟ» ΛΕΕΙ ΜΟΝΟ ΟΣΑ ΔΕΙΧΝΟΥΝ ΤΑ ΝΟΥΜΕΡΑ: για αυτή την
                κατανάλωση, σε αυτό το είδος, με αυτές τις τιμές. Ούτε «καλύτερο»
                ούτε «προτείνουμε». */}
            <ToolHero primary={{ label: 'Φθηνότερο τον μήνα', value: fe(best.monthly) }}
              secondary={[{ label: 'Τον χρόνο', value: fe(best.annual ?? 0) }]}/>
            <p style={{ margin: '12px 0 0', fontSize: 14, lineHeight: 1.55, color: 'var(--text-secondary)', textWrap: 'pretty' }}>
              <strong style={{ color: 'var(--text-primary)' }}>{best.t.providerLabel} {best.t.name}</strong>
              {' '}για {kwhLine}. {BADGE_MEANING[best.t.badge] ?? ''}.
            </p>
            <LiveResult say={`Φθηνότερο τον μήνα ${fe(best.monthly)}, με ${best.t.providerLabel} ${best.t.name}. Τον χρόνο ${fe(best.annual ?? 0)}.`}/>
          </>
        ) : (
          <>
            {/* ΠΑΛΙΟΣ ΚΑΤΑΛΟΓΟΣ: ΚΑΜΙΑ ΣΕΙΡΑ, ΚΑΝΕΝΑ ΟΝΟΜΑ. Το εύρος των ποσών μένει,
                γιατί λέει την τάξη μεγέθους χωρίς να διαλέγει τιμολόγιο. */}
            <div role="note" style={{
              padding: 'clamp(14px,2.6vw,18px)', borderRadius: T.radius.inner,
              background: 'color-mix(in srgb, var(--warning) 6%, transparent)',
              border: '1px solid color-mix(in srgb, var(--warning) 30%, transparent)',
            }}>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: 'var(--text-primary)', textWrap: 'pretty' }}>
                <strong>Οι τιμές μπορεί να έχουν αλλάξει.</strong>{' '}
                Ελέγχθηκαν πριν από {fn(r.fresh.ageDays)} ημέρες και οι πάροχοι ανακοινώνουν νέες τιμές
                κάθε μήνα. Γι’ αυτό ο πίνακας μένει ενδεικτικός: σε αλφαβητική σειρά, χωρίς κατάταξη και
                χωρίς φθηνότερο. Τις τρέχουσες τιμές τις δημοσιεύει η{' '}
                <a href={RAAEY_COMPARE} target="_blank" rel="noopener noreferrer" title={RAAEY_NAME}
                  className="lp-link" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
                  ΡΑΑΕΥ στο επίσημο εργαλείο σύγκρισης
                </a>.
              </p>
            </div>
            {priced.length > 0 && (
              <p style={{ margin: '14px 0 0', fontSize: 14, lineHeight: 1.55, color: 'var(--text-secondary)' }}>
                Ενδεικτικά, από <strong style={{ fontFamily: T.font.num, color: 'var(--text-primary)' }}>{fe(low)}</strong> έως{' '}
                <strong style={{ fontFamily: T.font.num, color: 'var(--text-primary)' }}>{fe(high)}</strong> τον μήνα για {kwhLine}.
              </p>
            )}
            <LiveResult say={priced.length > 0
              ? `Ενδεικτικά, χωρίς κατάταξη: από ${fe(low)} έως ${fe(high)} τον μήνα.`
              : 'Ενδεικτικά, χωρίς κατάταξη.'}/>
          </>
        )}

        {hasUsage && (
          <>
            <div style={{ height: 1, background: 'var(--border-subtle)', margin: '20px 0 8px' }}/>
            <p style={{ margin: '0 0 4px', fontSize: 13, color: 'var(--text-tertiary)' }}>
              {r.rows.length} τιμολόγια για {kwhLine}
              {r.recommend ? ', από το φθηνότερο.' : ', αλφαβητικά κατά πάροχο.'}
            </p>
            {/* ΜΙΑ ΓΡΑΜΜΗ ΑΝΑ ΤΙΜΟΛΟΓΙΟ, ΤΟ ΠΟΣΟ ΔΕΞΙΑ. Ιδια διάταξη με την
                κατάταξη του πίνακα ελέγχου (`.tariff-row`): στο κινητό οι δύο
                στήλες στοιβάζονται και καμία πληροφορία δεν κρύβεται πίσω από
                οριζόντια κύλιση. */}
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {shown.map((x, i) => (
                <li key={x.t.id} className="tariff-row" style={{
                  borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)',
                  background: x.rank === 1 ? 'var(--bg-elevated)' : 'transparent',
                  borderRadius: x.rank === 1 ? T.radius.inner : 0,
                }}>
                  <span style={{ fontSize: 12, fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums',
                    color: 'var(--text-tertiary)', minWidth: 18, textAlign: 'right' }}>
                    {x.rank ?? ''}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {x.t.providerLabel}
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>{' '}{x.t.name}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4, lineHeight: 1.5 }}>
                      <span title={BADGE_MEANING[x.t.badge]} style={{ color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.05em' }}>{x.t.badge}</span>
                      {' · '}{facts(x.t, ebill).join(' · ')}
                    </div>
                    {x.unranked && (
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>
                        {UNRANKED_WHY[x.unranked]}.
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 15, fontWeight: x.rank === 1 ? 700 : 600, fontFamily: T.font.num,
                      fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)', lineHeight: 1.2 }}>
                      {x.monthly !== null ? fe(x.monthly) : 'Χωρίς ποσό'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4, fontFamily: T.font.num,
                      fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {x.annual !== null ? `${fe(x.annual)} τον χρόνο` : 'Εκτός σειράς'}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {/* ΟΙ ΣΕΛΙΔΕΣ ΤΩΝ ΠΑΡΟΧΩΝ ΣΕ ΜΙΑ ΠΡΟΤΑΣΗ, ΟΧΙ ΣΕ ΚΑΘΕ ΓΡΑΜΜΗ. Ενας
                σύνδεσμος ανά γραμμή ήταν στόχος αφής 20 εικονοστοιχείων μέσα σε
                πυκνή λίστα (scripts/e2e-mobile.mjs): το δάχτυλο έπεφτε στον
                γείτονα. Μέσα σε πρόταση ο σύνδεσμος είναι κείμενο που διαβάζεται
                και η οδηγία «επιβεβαίωσε στον πάροχο» έχει από πού. */}
            <p style={{ margin: '14px 0 0', fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)', textWrap: 'pretty' }}>
              Πριν υπογράψεις, επιβεβαίωσε την τιμή στη σελίδα του παρόχου:{' '}
              {PROVIDERS.map((pr, i) => (
                <Fragment key={pr.value}>
                  {i > 0 && ', '}
                  <a href={pr.url} target="_blank" rel="noopener noreferrer" className="lp-link"
                    title={`Οι τιμές του παρόχου ${pr.label}, στη σελίδα του`}
                    style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>{pr.label}</a>
                </Fragment>
              ))}.
            </p>
            {r.rows.length > VISIBLE && (
              <div className="po-noprint" style={{ marginTop: 12 }}>
                <Btn field onClick={() => setAll(s => !s)} expanded={all}>
                  {all ? `Δείξε μόνο τα πρώτα ${VISIBLE}` : `Δείξε και τα υπόλοιπα ${r.rows.length - VISIBLE} τιμολόγια`}
                </Btn>
              </div>
            )}
          </>
        )}
      </div>

      <ToolActions path={PATH} spec={SPEC} values={v}/>

      {/* ── ΤΙ ΜΕΤΡΑΕΙ ΤΟ ΠΟΣΟ ΚΑΙ ΤΙ ΟΧΙ ─────────────────────────────────────
          Γράφει ΑΚΡΙΒΩΣ ό,τι κάνει ο τύπος του lib/energy/tariff.ts: προμήθεια,
          ΕΤΜΕΑΡ, ΦΠΑ 6%. Οτιδήποτε άλλο θα ήταν υπόσχεση που ο υπολογισμός δεν
          τηρεί. */}
      <div className="po-tool-note" style={{
        marginTop: T.sp.xl, padding: 'clamp(14px,2.6vw,18px)', borderRadius: T.radius.inner,
        background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
      }}>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
          <strong style={{ color: 'var(--text-primary)' }}>Τι περιλαμβάνει και τι όχι.</strong>{' '}
          Το ποσό είναι η χρέωση του προμηθευτή (πάγιο και ενέργεια) μαζί με το ΕΤΜΕΑΡ
          ({feRate(ETMEAR)} ανά κιλοβατώρα) και ΦΠΑ 6% και στα δύο. Στα πακέτα σταθερού ποσού
          μετρά το ποσό του πακέτου με ΦΠΑ 6% και η χρέωση υπέρβασης όπου είναι καταγεγραμμένη.
          Δεν περιλαμβάνει χρεώσεις δικτύου (ΔΕΔΔΗΕ, ΑΔΜΗΕ), ΥΚΩ, ΕΦΚ, δημοτικά τέλη ούτε τέλος
          ΕΡΤ: είναι ίδια σε όποιον πάροχο κι αν διαλέξεις, οπότε δεν αλλάζουν τη σειρά, αλλά ο
          λογαριασμός σου θα βγει μεγαλύτερος. Οι τιμές ανά κιλοβατώρα και τα πάγια στις γραμμές
          είναι χωρίς ΦΠΑ. Όπου υπάρχει έκπτωση συνέπειας, μετρά η τιμή με την έκπτωση· οι
          προωθητικές τιμές δεν μετρούν. Δεν συγκρίνονται τα δυναμικά τιμολόγια, τα φοιτητικά
          και όσα εκκαθαρίζονται δύο φορές τον χρόνο. Είναι <strong>εκτίμηση</strong> για να ξέρεις
          την τάξη μεγέθους· πριν υπογράψεις, επιβεβαίωσε την τιμή στη σελίδα του παρόχου.
        </p>
      </div>

      <ToolPaperFoot path={PATH} spec={SPEC} values={v}/>

      {cta}
    </div>
  );
}
