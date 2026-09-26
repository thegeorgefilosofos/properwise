// Τα εξώφυλλα των προφίλ, από την ίδια σχεδίαση με τις κάρτες κοινοποίησης
// (app/og/frame.tsx). Τρέξε: npx tsx scripts/marketing/covers.tsx
// Γράφει στο docs/marketing/profil/, που ΜΠΑΙΝΕΙ στο αποθετήριο: τα εξώφυλλα
// δεν γερνούν όπως οι αναρτήσεις, αφού δεν γράφουν ψηφίο.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { ImageResponse } from 'next/og';
import { BRAND_PATHS, BRAND_VIEWBOX, BRAND_MARK_ON_DARK } from '../../components/BrandMark';

// Ιδια γραμματοσειρά και ίδια παλέτα με τις κάρτες (app/og/frame.tsx), από τα
// ίδια αρχεία: τα Inter του app/og/fonts και τα --mkt-* του app/globals.css.
function assets() {
  const root = process.cwd();
  const css = readFileSync(join(root, 'app/globals.css'), 'utf8');
  const token = (name: string) => {
    const m = css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
    if (!m) throw new Error(`Δεν βρέθηκε το ${name} στο app/globals.css`);
    return m[1];
  };
  const fonts = ([500, 700, 800] as const).map(weight => ({
    name: 'Inter', weight, style: 'normal' as const, data: readFileSync(join(root, `app/og/fonts/inter-${weight}.ttf`)),
  }));
  return {
    fonts,
    c: { bg: token('--mkt-bg-base'), mid: token('--mkt-space-mid'), text: token('--mkt-text-primary'), muted: token('--mkt-text-secondary'), accent: token('--mkt-accent') },
  };
}

const mark = (size: number, fill: string) => (
  <svg aria-hidden="true" width={size} height={size} viewBox={BRAND_VIEWBOX} fill={fill} fillRule="nonzero">
    {BRAND_PATHS.shape.map((d: string) => <path key={d} d={d} />)}
  </svg>
);

type OgBanner = { width: number; height: number; title: string; accent?: string; sub?: string };

/**
 * Το εξώφυλλο προφίλ (LinkedIn, Facebook, X): ίδιο φόντο και ίδια γραφή με την
 * κάρτα, χωρίς σήμα. Τη θέση του σήματος την παίρνει η εικόνα του προφίλ, που
 * κάθε πλατφόρμα κολλά πάνω στο εξώφυλλο κάτω αριστερά· γι' αυτό το κείμενο
 * κάθεται στο κέντρο, εκεί που καμία πλατφόρμα δεν το κόβει στο κινητό.
 */
function ogBanner({ width, height, title, accent, sub }: OgBanner) {
  const { fonts, c } = assets();
  const alpha = (hex: string, a: string) => `${hex}${a}`;
  // Από το ύψος ΚΑΙ από το πλάτος: το Facebook κόβει τα πλάγια στο κινητό, οπότε
  // σε ψηλό εξώφυλλο η φράση πρέπει να μένει στο μεσαίο μισό.
  const stacked = width / height < 3.5;
  const size = Math.round(Math.min(height * (stacked ? 0.15 : 0.2), width * (stacked ? 0.055 : 0.042)));
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', position: 'relative', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: Math.round(height * 0.05),
          fontFamily: 'Inter', color: c.text, backgroundColor: c.bg,
          backgroundImage: [
            `radial-gradient(${Math.round(width * 0.6)}px ${Math.round(height * 1.2)}px at 30% -20%, ${alpha(c.accent, '38')}, transparent 72%)`,
            `radial-gradient(${Math.round(width * 0.5)}px ${Math.round(height)}px at 100% 120%, ${alpha(c.accent, '22')}, transparent 70%)`,
            `linear-gradient(165deg, ${c.mid} 0%, ${c.bg} 100%)`,
          ].join(', '),
        }}
      >
        <div style={{ position: 'absolute', right: -Math.round(height * 0.2), bottom: -Math.round(height * 0.35), display: 'flex', opacity: 0.07 }}>
          {mark(Math.round(height * 1.4), BRAND_MARK_ON_DARK)}
        </div>
        {/* Σε ψηλό εξώφυλλο (Facebook, X) η φράση σε δύο γραμμές, ώστε να χωρά στο
            μεσαίο κομμάτι που δείχνει το κινητό· στο στενό του LinkedIn σε μία. */}
        <div style={{ display: 'flex', flexDirection: stacked ? 'column' : 'row', alignItems: 'center', gap: stacked ? 0 : Math.round(size * 0.28), fontSize: size, fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.1 }}>
          <div style={{ display: 'flex' }}>{title}</div>
          {accent && <div style={{ display: 'flex', color: c.accent }}>{accent}</div>}
        </div>
        {sub && <div style={{ display: 'flex', fontSize: Math.round(size * 0.42), fontWeight: 600, color: c.muted }}>{sub}</div>}
      </div>
    ),
    { width, height, fonts },
  );
}

const OUT = join(process.cwd(), 'docs/marketing/profil');

// Διπλάσια ανάλυση από το ελάχιστο κάθε πλατφόρμας, για οθόνες υψηλής πυκνότητας.
const COVERS = [
  { file: 'linkedin-exofyllo.png', width: 2256, height: 382 },
  { file: 'facebook-exofyllo.png', width: 1640, height: 624 },
  { file: 'x-exofyllo.png', width: 1500, height: 500 },
] as const;

(async () => {
  mkdirSync(OUT, { recursive: true });
  for (const c of COVERS) {
    const img = ogBanner({ width: c.width, height: c.height, title: 'Το ακίνητό σου,', accent: 'χωρίς χαρτιά στο συρτάρι.', sub: 'Δωρεάν για ένα ακίνητο · properwise.gr' });
    writeFileSync(join(OUT, c.file), Buffer.from(await img.arrayBuffer()));
    console.log(`✓ ${c.file} ${c.width}×${c.height}`);
  }
})().catch(e => { console.error(e); process.exit(1); });
