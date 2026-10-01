'use client'
// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΔΙΑΓΡΑΜΜΑΤΑ ΤΟΥ ΠΡΟΫΠΟΛΟΓΙΣΜΟΥ: ΓΡΑΜΜΗ ΤΑΣΗΣ, ΜΗΝΙΑΙΕΣ ΜΠΑΡΕΣ, ΔΑΚΤΥΛΙΟΣ
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from 'react'
import { T, feAuto, grUpper } from '@/components/Theme'

// Μικρογράφημα τάσης 12 μηνών ανά κατηγορία (από το φορτωμένο ιστορικό). Το σημείο
// του επιλεγμένου μήνα τονίζεται με γαλάζιο. Κρύβεται αν δεν υπάρχει καθόλου ιστορικό.
export function Sparkline({ values, activeIndex }: { values: number[]; activeIndex: number }) {
  const w = 54, h = 14, pad = 2;
  if (values.every(v => !v)) return <span style={{ width: w, flexShrink: 0 }} aria-hidden="true" />;
  const max = Math.max(1, ...values);
  const n = values.length;
  const x = (i: number) => n <= 1 ? pad : pad + (i * (w - 2 * pad)) / (n - 1);
  const y = (v: number) => h - pad - (Math.max(0, v) / max) * (h - 2 * pad);
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  // Καθαρή μονόχρωμη μικρογραφία τάσης — χωρίς έγχρωμη «κουκκίδα», ώστε οι γραμμές
  // των κατηγοριών να μένουν ομοιόμορφες και διακριτικές (καμία διακοσμητική χρώση).
  void activeIndex;
  return (
    <svg width={w} height={h} style={{ display: 'block', flexShrink: 0 }} aria-hidden="true">
      <polyline points={pts} fill="none" stroke="color-mix(in srgb, var(--text-primary) 26%, transparent)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Ράβδοι εξόδων ανά μήνα — premium, στο ΓΑΛΑΖΙΟ της παλέτας μας (accent): απαλή κάθετη
// διαβάθμιση, στρογγυλεμένη κορυφή, baseline· στο πέρασμα του κέρσορα φωτίζεται, σηκώνεται
// (3D lift + glow) και δείχνει το ποσό. Οι κενοί μήνες μένουν διακριτικά «σβηστοί».
export function MonthBars({ data, activeYm }: { data: { ym: string; label: string; value: number }[]; activeYm: string }) {
  const [hi, setHi] = useState<number | null>(null);
  const max = Math.max(1, ...data.map(d => d.value));
  const H = 84;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: H + 22, borderBottom: '1px solid var(--border-subtle)' }}>
      {data.map((d, i) => {
        const h = d.value > 0 ? Math.max(4, Math.round((d.value / max) * (H - 6))) : 0;
        const active = d.ym === activeYm, on = hi === i;
        const top = on ? 100 : active ? 92 : 62;
        const bot = on ? 66 : active ? 56 : 30;
        return (
          <div key={d.ym} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} onTouchStart={() => setHi(i)} onTouchEnd={() => setHi(null)}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: 0, cursor: 'default' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: 26, height: H, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
              {on && d.value > 0 && (
                <div style={{ position: 'absolute', bottom: h + 8, left: '50%', transform: 'translateX(-50%)', background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', borderRadius: T.radius.chip, padding: '3px 8px', fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--accent)', fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', zIndex: 3 }}>{feAuto(d.value)}</div>
              )}
              <div style={{ width: '100%', height: Math.max(h, 3), borderRadius: '6px 6px 2px 2px', background: d.value > 0 ? `linear-gradient(180deg, color-mix(in srgb, var(--accent) ${top}%, transparent), color-mix(in srgb, var(--accent) ${bot}%, transparent))` : 'color-mix(in srgb, var(--text-primary) 8%, transparent)', transition: 'height 0.5s cubic-bezier(0.22,1,0.36,1), background 0.18s ease' }} />
            </div>
            <span style={{ fontSize: 'var(--fs-xs)', color: on || active ? 'var(--accent)' : 'var(--text-tertiary)', fontFamily: T.font.sans, fontWeight: on || active ? 700 : 500, transition: 'color 0.15s' }}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// Δαχτυλίδι (donut) κατανομής — στο ΓΑΛΑΖΙΟ μας: πέντε αδιαφανή σκαλιά
// (--chart-cat-1…5, το «Λοιπά» στον ουδέτερο σχιστόλιθο), στρογγυλά άκρα και
// μικρά κενά, ζωντανή αντίδραση (το τόξο που δείχνει ο κέρσορας παχαίνει, η
// γραμμή του υπομνήματος φωτίζεται) και κέντρο με κατηγορία, ποσό και %.
// ΗΤΑΝ ΕΞΙ ΔΙΑΦΑΝΕΙΕΣ ΤΟΥ ACCENT: το τελευταίο τόξο 1,6:1 πάνω στην κάρτα.
// Τα ονόματα γράφονται ολόκληρα, όχι συναρμολογημένα: ο φύλακας των token
// (scripts/guard-tokens.mjs) ελέγχει ότι το καθένα ορίζεται.
const CHART_CAT = ['var(--chart-cat-1)', 'var(--chart-cat-2)', 'var(--chart-cat-3)', 'var(--chart-cat-4)', 'var(--chart-cat-5)'] as const;

export function Donut({ slices }: { slices: { label: string; value: number }[] }) {
  const [hi, setHi] = useState<number | null>(null);
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return null;
  const sorted = slices.filter(s => s.value > 0).sort((a, b) => b.value - a.value);
  const MAX = 5;
  let segs = sorted;
  if (sorted.length > MAX) {
    const head = sorted.slice(0, MAX - 1);
    const rest = sorted.slice(MAX - 1).reduce((s, x) => s + x.value, 0);
    segs = [...head, { label: 'Λοιπά', value: rest }];
  }
  const r = 56, sw = 14, C = 2 * Math.PI * r;
  const GAP = segs.length > 1 ? 6 : 0;   // κενό μεταξύ τόξων (σε μονάδες περιμέτρου)
  // Ενα σκαλί ανά τόξο, με τη σειρά του μεγέθους. Το «Λοιπά» είναι πάντα το
  // τελευταίο τόξο, άρα παίρνει πάντα το ουδέτερο πέμπτο.
  const shade = (i: number) => CHART_CAT[Math.min(i, CHART_CAT.length - 1)];
  const active = hi != null ? segs[hi] : null;
  // ΤΑ ΞΕΚΙΝΗΜΑΤΑ ΤΩΝ ΤΟΞΩΝ ΥΠΟΛΟΓΙΖΟΝΤΑΙ ΠΡΙΝ ΤΗΝ ΑΠΟΔΟΣΗ. Ήταν συσσωρευτής
  // `let off` που άλλαζε ΜΕΣΑ στο .map(): τιμή που γράφεται αφού έχει ξεκινήσει
  // η απόδοση, δηλαδή αν η React διακόψει και ξαναρχίσει τη λίστα, τα τόξα
  // ξεκινούν από λάθος γωνία και το δαχτυλίδι βγαίνει με κενά ή επικαλύψεις.
  const starts = segs.reduce<number[]>((acc, sgm, i) =>
    [...acc, i === 0 ? 0 : acc[i - 1] + (segs[i - 1].value / total) * C], []);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: T.sp.xxl, flexWrap: 'wrap' }}>
      <svg aria-hidden="true" width="152" height="152" viewBox="0 0 152 152" style={{ flexShrink: 0, overflow: 'visible' }}>
        {/* Κανάλι δαχτυλιδιού */}
        <circle cx="76" cy="76" r={r} fill="none" stroke="color-mix(in srgb, var(--accent) 10%, transparent)" strokeWidth={sw} />
        <g transform="rotate(-90 76 76)">
          {segs.map((s, i) => {
            const on = hi === i;
            const raw = (s.value / total) * C;
            const len = Math.max(0.5, raw - GAP);
            const el = (
              <circle key={i} cx="76" cy="76" r={r} fill="none" stroke={shade(i)} strokeWidth={on ? sw + 3 : sw} strokeLinecap="round"
                strokeDasharray={`${len.toFixed(2)} ${(C - len).toFixed(2)}`} strokeDashoffset={(-starts[i]).toFixed(2)}
                onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)}
                style={{ transition: 'stroke-width 0.18s ease', cursor: 'default' }} />
            );
            return el;
          })}
        </g>
        <text x="76" y="70" textAnchor="middle" style={{ fontSize: 'var(--fs-xs)', fill: 'var(--text-tertiary)', fontFamily: T.font.sans, letterSpacing: '0.04em', transition: 'fill 0.15s' }}>{active ? grUpper(active.label.slice(0, 16)) : 'ΣΥΝΟΛΟ'}</text>
        <text x="76" y="87" textAnchor="middle" style={{ fontSize: 16, fontWeight: 700, fill: active ? 'var(--accent)' : 'var(--text-primary)', fontFamily: T.font.num, transition: 'fill 0.15s' }}>{feAuto(active ? active.value : total)}</text>
        {active && <text x="76" y="101" textAnchor="middle" style={{ fontSize: 'var(--fs-xs)', fill: 'var(--text-tertiary)', fontFamily: T.font.num }}>{Math.round((active.value / total) * 100)}%</text>}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 150 }}>
        {segs.map((s, i) => {
          const on = hi === i;
          return (
            <div key={i} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontFamily: T.font.sans, padding: '4px 8px', margin: '0 -8px', borderRadius: T.radius.chip, background: on ? 'var(--bg-elevated)' : 'transparent', cursor: 'default', transition: 'background 0.15s' }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: shade(i), flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, color: on ? 'var(--text-primary)' : 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', transition: 'color 0.15s' }}>{s.label}</span>
              <span style={{ color: 'var(--text-tertiary)', fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums', fontSize: 'var(--fs-xs)' }}>{feAuto(s.value)}</span>
              <span style={{ width: 34, textAlign: 'right', color: on ? 'var(--accent)' : 'var(--text-secondary)', fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums', fontWeight: 700, transition: 'color 0.15s' }}>{Math.round((s.value / total) * 100)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
