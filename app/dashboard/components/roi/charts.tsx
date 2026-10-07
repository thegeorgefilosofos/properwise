'use client';
// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΤΡΙΑ ΓΡΑΦΗΜΑΤΑ ΤΗΣ ΑΠΟΔΟΣΗΣ: ΑΝΑΤΟΚΙΣΜΟΣ ΑΝΑ ΕΤΟΣ, ΙΣΤΟΡΙΚΗ ΔΙΑΔΡΟΜΗ,
// ΠΡΟΒΟΛΗ ΑΚΙΝΗΤΟΥ ΑΠΕΝΑΝΤΙ ΣΤΗΝ ΚΟΡΥΦΑΙΑ ΕΝΑΛΛΑΚΤΙΚΗ
// ─────────────────────────────────────────────────────────────────────────
// Χειροποίητα SVG, χωρίς βιβλιοθήκη γραφημάτων. Ζούσαν στο TabRentROI.tsx·
// δεν διαβάζουν τίποτα από την καρτέλα πέρα από τα σημεία που τους δίνει.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from 'react';
import { useChartWidth } from '@/app/hooks/useChartWidth';
import { fe } from '@/components/Theme';
import { HISTORY_ANCHORS } from '@/lib/market/greekMarket';
import { feC, roiGrow, toolNote } from './Bits';

export function CompoundBars({ perYear }: { perYear: { year: number; value: number; contributed: number }[] }) {
  if (perYear.length === 0) return <div aria-hidden="true" style={roiGrow} />;
  const max = Math.max(...perYear.map(p => p.value), 1);
  const last = perYear[perYear.length - 1];
  const dot = (bg: string): React.CSSProperties => ({ width: 10, height: 10, background: bg, flexShrink: 0 });
  return (
    <figure style={{ flex: '1 1 96px', minHeight: 96, display: 'flex', flexDirection: 'column', margin: '16px 0 12px' }}
      aria-label={`Αξία ανά έτος, από ${fe(perYear[0].value)} ως ${fe(last.value)}`}>
      <div aria-hidden="true" style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: perYear.length > 12 ? 3 : 5, borderBottom: '1px solid var(--border-subtle)' }}>
        {perYear.map(p => {
          const growth = Math.max(0, p.value - p.contributed);
          return (
            <div key={p.year} style={{ flex: 1, height: `${(p.value / max) * 100}%`, display: 'flex', flexDirection: 'column' }}>
              <div style={{ flex: growth, background: 'var(--accent)', opacity: 0.85 }} />
              <div style={{ flex: p.contributed, background: 'color-mix(in srgb, var(--text-tertiary) 30%, transparent)' }} />
            </div>
          );
        })}
      </div>
      <figcaption style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 8, ...toolNote, fontVariantNumeric: 'tabular-nums' }}>
        <span style={{ display: 'inline-flex', gap: 14, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={dot('color-mix(in srgb, var(--text-tertiary) 30%, transparent)')} />Κεφάλαιο και εισφορές</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={dot('var(--accent)')} />Κέρδος ανατοκισμού</span>
        </span>
        <span>Έτος 1 ως {last.year}</span>
      </figcaption>
    </figure>
  );
}

// Έξυπνο γράφημα περιοχής — premium: ομαλή καμπύλη, βάθος, διαδραστικό tooltip ανά έτος.
export function AreaChart({ points }: { points: { year: number; value: number }[] }) {
  const [svgRef, W] = useChartWidth();
  const H = 196, padX = 18, padTop = 16, padBottom = 26;
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return null;
  const vals = points.map(p => p.value);
  const min = Math.min(...vals), max = Math.max(...vals), range = max - min || 1;
  const n = points.length;
  const baseY = H - padBottom;
  const X = (i: number) => padX + (i / (n - 1)) * (W - 2 * padX);
  const Y = (v: number) => padTop + (1 - (v - min) / range) * (baseY - padTop);
  const pts = points.map((p, i) => [X(i), Y(p.value)] as [number, number]);
  // Ομαλή καμπύλη (Catmull-Rom → κυβικές Bézier) — δίνει το «ζωντανό», premium αίσθημα.
  const smooth = (P: [number, number][]) => {
    let d = `M${P[0][0].toFixed(1)},${P[0][1].toFixed(1)}`;
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || p2, t = 0.16;
      const c1x = p1[0] + (p2[0] - p0[0]) * t, c1y = p1[1] + (p2[1] - p0[1]) * t;
      const c2x = p2[0] - (p3[0] - p1[0]) * t, c2y = p2[1] - (p3[1] - p1[1]) * t;
      d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
  };
  const line = smooth(pts);
  const area = `${line} L${X(n - 1).toFixed(1)},${baseY} L${X(0).toFixed(1)},${baseY} Z`;
  const marks = points.map((p, i) => ({ ...p, i, kind: p.year === HISTORY_ANCHORS.peakYear ? 'peak' : p.year === HISTORY_ANCHORS.troughYear ? 'trough' : i === n - 1 ? 'now' : '' })).filter(m => m.kind);
  const mColor: Record<string, string> = { peak: 'var(--text-tertiary)', trough: 'var(--text-tertiary)', now: 'var(--accent)' };
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const vx = ((e.clientX - r.left) / r.width) * W;
    let best = 0, bd = Infinity;
    for (let i = 0; i < n; i++) { const dx = Math.abs(X(i) - vx); if (dx < bd) { bd = dx; best = i; } }
    setHover(best);
  };
  const hp = hover != null ? points[hover] : null;
  const TW = 96, TH = 34;
  const tx = hp ? Math.max(2, Math.min(W - TW - 2, X(hover!) - TW / 2)) : 0;
  const belowTop = hp ? Y(hp.value) - TH - 12 : 0;
  const ty = belowTop < 2 ? (hp ? Y(hp.value) + 14 : 0) : belowTop;
  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block', touchAction: 'none' }} role="img" aria-label="Ιστορική διαδρομή αξίας"
      onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
      <defs>
        <linearGradient id="roiArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.34" />
          <stop offset="55%" stopColor="var(--accent)" stopOpacity="0.10" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
        <filter id="roiGlow" x="-10%" y="-30%" width="120%" height="170%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="var(--accent)" floodOpacity="0.30" />
        </filter>
      </defs>
      {/* Ελαφριά οριζόντια πλέγματα — «χρηματιστηριακό» look, χωρίς θόρυβο */}
      {[0, 0.25, 0.5, 0.75, 1].map(f => { const gy = padTop + f * (baseY - padTop); return <line key={f} x1={padX} y1={gy.toFixed(1)} x2={W - padX} y2={gy.toFixed(1)} stroke="var(--border-subtle)" strokeWidth="1" opacity="0.45" />; })}
      <path d={area} fill="url(#roiArea)" />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" filter="url(#roiGlow)" />
      {marks.map(m => (
        <circle key={m.year} cx={X(m.i)} cy={Y(m.value)} r={m.kind === 'now' ? 4.4 : 3.4} fill={mColor[m.kind]} stroke="var(--bg-surface)" strokeWidth="1.8" />
      ))}
      {points.map((p, i) => (i === 0 || i === n - 1 || i === Math.floor((n - 1) / 2)) ? (
        <text key={'t' + p.year} x={X(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} fontSize="11" fill="var(--text-tertiary)" fontFamily="Inter, sans-serif">{p.year}</text>
      ) : null)}
      {/* Διαδραστικός δείκτης: κάθετη γραμμή, φωτεινό σημείο, tooltip έτους/τιμής */}
      {hp && (
        <g pointerEvents="none">
          <line x1={X(hover!)} y1={padTop - 4} x2={X(hover!)} y2={baseY} stroke="var(--border-default)" strokeWidth="1" strokeDasharray="3 3" />
          <circle cx={X(hover!)} cy={Y(hp.value)} r="7" fill="var(--accent)" opacity="0.16" />
          <circle cx={X(hover!)} cy={Y(hp.value)} r="4" fill="var(--accent)" stroke="var(--bg-surface)" strokeWidth="2" />
          <g transform={`translate(${tx.toFixed(1)},${ty.toFixed(1)})`}>
            <rect width={TW} height={TH} rx="8" fill="var(--bg-elevated)" stroke="var(--border-subtle)" strokeWidth="1" style={{ filter: 'drop-shadow(0 6px 16px rgba(0,0,0,0.28))' }} />
            <text x="10" y="14" fontSize="11" fill="var(--text-tertiary)" fontFamily="Inter, sans-serif" letterSpacing="0.2">Έτος {hp.year}</text>
            <text x="10" y="28" fontSize="12" fontWeight="600" fill="var(--text-primary)" fontFamily="Inter, sans-serif" style={{ fontVariantNumeric: 'tabular-nums' }}>{feC(hp.value)}</text>
          </g>
        </g>
      )}
    </svg>
  );
}

// Γράφημα πολλαπλών γραμμών (forward προβολή) — premium, ομαλό, με διαδραστικό tooltip.
export function LineChart({ series }: { series: { label: string; color: string; points: { year: number; value: number }[] }[] }) {
  const [svgRef, W] = useChartWidth();
  const H = 200, padX = 18, padTop = 16, padBottom = 26;
  const [hover, setHover] = useState<number | null>(null);
  const all = series.flatMap(s => s.points.map(p => p.value));
  if (!all.length) return null;
  const max = Math.max(...all) || 1;
  const years = Math.max(1, series[0].points.length - 1);
  const baseY = H - padBottom;
  const X = (t: number) => padX + (t / years) * (W - 2 * padX);
  const Y = (v: number) => padTop + (1 - v / max) * (baseY - padTop);
  const smooth = (P: [number, number][]) => {
    let d = `M${P[0][0].toFixed(1)},${P[0][1].toFixed(1)}`;
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || p2, t = 0.16;
      d += ` C${(p1[0] + (p2[0] - p0[0]) * t).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) * t).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) * t).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) * t).toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
  };
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const vx = ((e.clientX - r.left) / r.width) * W;
    setHover(Math.max(0, Math.min(years, Math.round(((vx - padX) / (W - 2 * padX)) * years))));
  };
  const th = hover != null ? hover : null;
  // Πλαίσιο διαστασιολογημένο στο περιεχόμενο: πλήρεις ονομασίες (χωρίς συντομογραφίες),
  // η τιμή δεξιά, με σταθερό κενό ώστε να μην ακουμπούν ποτέ ετικέτα και ποσό.
  const rows = th != null ? series.map(s => ({ label: s.label, color: s.color, value: feC(s.points[th].value) })) : [];
  const rowW = (r: { label: string; value: string }) => 11 + 8 + 7 + r.label.length * 5.7 + 14 + r.value.length * 6.2 + 11;
  const TW = rows.length ? Math.min(200, Math.max(120, Math.ceil(Math.max(...rows.map(rowW))))) : 148;
  const TH = 16 + rows.length * 16 + 8;
  const tx = th != null ? (X(th) + 12 + TW > W - 2 ? Math.max(2, X(th) - TW - 12) : X(th) + 12) : 0;
  const ty = th != null ? padTop : 0;
  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block', touchAction: 'none' }} role="img" aria-label="Προβολή απόδοσης"
      onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
      {[0, 0.25, 0.5, 0.75, 1].map(f => { const gy = padTop + f * (baseY - padTop); return <line key={f} x1={padX} y1={gy.toFixed(1)} x2={W - padX} y2={gy.toFixed(1)} stroke="var(--border-subtle)" strokeWidth="1" opacity="0.45" />; })}
      {series.map(s => (
        <path key={s.label} d={smooth(s.points.map(p => [X(p.year), Y(p.value)] as [number, number]))} fill="none" stroke={s.color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {series.map(s => { const last = s.points[s.points.length - 1]; return (<circle key={s.label + 'c'} cx={X(last.year)} cy={Y(last.value)} r="4" fill={s.color} stroke="var(--bg-surface)" strokeWidth="1.6" />); })}
      {[0, Math.round(years / 2), years].map(t => <text key={t} x={X(t)} y={H - 6} textAnchor={t === 0 ? 'start' : t === years ? 'end' : 'middle'} fontSize="11" fill="var(--text-tertiary)" fontFamily="Inter, sans-serif">{`Έτος ${t}`}</text>)}
      {th != null && (
        <g pointerEvents="none">
          <line x1={X(th)} y1={padTop - 4} x2={X(th)} y2={baseY} stroke="var(--border-default)" strokeWidth="1" strokeDasharray="3 3" />
          {series.map(s => <circle key={s.label + 'h'} cx={X(th)} cy={Y(s.points[th].value)} r="4" fill={s.color} stroke="var(--bg-surface)" strokeWidth="2" />)}
          <g transform={`translate(${tx.toFixed(1)},${ty.toFixed(1)})`}>
            <rect width={TW} height={TH} rx="8" fill="var(--bg-elevated)" stroke="var(--border-subtle)" strokeWidth="1" style={{ filter: 'drop-shadow(0 6px 16px rgba(0,0,0,0.28))' }} />
            <text x="11" y="13" fontSize="11" fill="var(--text-tertiary)" fontFamily="Inter, sans-serif" letterSpacing="0.2">Έτος {th}</text>
            {rows.map((r, i) => (
              <g key={r.label + 'r'} transform={`translate(11,${27 + i * 16})`}>
                <rect x="0" y="-6.5" width="8" height="3" rx="1.5" fill={r.color} />
                <text x="15" y="0" fontSize="11" fill="var(--text-secondary)" fontFamily="Inter, sans-serif">{r.label}</text>
                <text x={TW - 22} y="0" textAnchor="end" fontSize="11" fontWeight="600" fill="var(--text-primary)" fontFamily="Inter, sans-serif" style={{ fontVariantNumeric: 'tabular-nums' }}>{r.value}</text>
              </g>
            ))}
          </g>
        </g>
      )}
    </svg>
  );
}
