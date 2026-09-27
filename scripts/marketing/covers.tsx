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

// Ο τίτλος της αρχικής σελίδας (app/page.tsx), σε δύο γραμμές όπως εκεί: το
// εξώφυλλο λέει το ίδιο με το site, όχι δεύτερη ατάκα που δεν υπάρχει πουθενά.
type Line = { text: string; accent?: string };
type OgBanner = { width: number; height: number; lines: Line[]; sub?: string; lift?: number };

/**
 * Το εξώφυλλο προφίλ (LinkedIn, Facebook, X, Creem): ίδιο φόντο και ίδια γραφή
 * με την κάρτα, χωρίς σήμα. Τη θέση του σήματος την παίρνει η εικόνα του
 * προφίλ, που κάθε πλατφόρμα κολλά πάνω στο εξώφυλλο· γι' αυτό το κείμενο
 * κάθεται στο κέντρο, εκεί που καμία πλατφόρμα δεν το κόβει στο κινητό.
 */
function ogBanner({ width, height, lines, sub, lift = 0 }: OgBanner) {
  const { fonts, c } = assets();
  const alpha = (hex: string, a: string) => `${hex}${a}`;
  // Η μακρύτερη γραμμή πιάνει περίπου το 70% του πλάτους (0,039 του πλάτους ανά
  // στιγμή γραμμάτων για ~33 χαρακτήρες) και οι δύο γραμμές μαζί με τον
  // υπότιτλο χωρούν στο ύψος, όσο στενό κι αν είναι το πλαίσιο.
  const size = Math.round(Math.min(height * 0.15, width * 0.039));
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', position: 'relative', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: Math.round(height * 0.05),
          // Το Creem κολλά την εικόνα του προφίλ κάτω ΣΤΟ ΚΕΝΤΡΟ, όχι αριστερά:
          // εκεί το κείμενο ανεβαίνει, για να μη σκεπαστεί ο υπότιτλος.
          paddingBottom: Math.round(height * lift),
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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: size, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.12 }}>
          {lines.map(l => (
            <div key={l.text + (l.accent ?? '')} style={{ display: 'flex', gap: Math.round(size * 0.26) }}>
              {l.text && <span>{l.text}</span>}
              {l.accent && <span style={{ color: c.accent }}>{l.accent}</span>}
            </div>
          ))}
        </div>
        {sub && <div style={{ display: 'flex', fontSize: Math.round(size * 0.4), fontWeight: 600, color: c.muted }}>{sub}</div>}
      </div>
    ),
    { width, height, fonts },
  );
}

/**
 * ΤΟ ΕΞΩΦΥΛΛΟ ΤΟΥ CREEM (Build in Public). Μία γραμμή, «φράση | διεύθυνση».
 *
 * Το Creem δεν δημοσιεύει διαστάσεις. Το πλαίσιο στον πίνακα ελέγχου μετρήθηκε
 * 4,6:1, με την εικόνα του προφίλ πάνω στο κάτω κέντρο (το κάτω 29%). Η εικόνα
 * φτιάχνεται στο κοινό 3:1 (1500×500) και το κείμενο κάθεται σε ζώνη που μένει
 * ορατή και στις δύο αναλογίες: αν το Creem την κόψει σε 4,6:1 μένει η λωρίδα
 * 88–412, και η εικόνα του προφίλ πιάνει το κάτω της κομμάτι. Η φράση κάθεται
 * στο 40% του ύψους, πάνω και από τα δύο.
 */
function creemBanner({ width, height }: { width: number; height: number }) {
  const { fonts, c } = assets();
  const alpha = (hex: string, a: string) => `${hex}${a}`;
  const size = Math.round(width * 0.036);
  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', position: 'relative', display: 'flex',
        fontFamily: 'Inter', color: c.text, backgroundColor: c.bg,
        backgroundImage: [
          `radial-gradient(${Math.round(width * 0.6)}px ${Math.round(height * 1.2)}px at 30% -20%, ${alpha(c.accent, '38')}, transparent 72%)`,
          `radial-gradient(${Math.round(width * 0.5)}px ${Math.round(height)}px at 100% 120%, ${alpha(c.accent, '22')}, transparent 70%)`,
          `linear-gradient(165deg, ${c.mid} 0%, ${c.bg} 100%)`,
        ].join(', '),
      }}>
        {/* Πιο αχνό από των άλλων εξωφύλλων: εδώ η γραμμή περνά από πάνω του και
            το «properwise.gr» πρέπει να διαβάζεται χωρίς τα τετράγωνα από πίσω. */}
        <div style={{ position: 'absolute', right: -Math.round(height * 0.25), bottom: -Math.round(height * 0.3), display: 'flex', opacity: 0.035 }}>
          {mark(Math.round(height * 1.25), BRAND_MARK_ON_DARK)}
        </div>
        <div style={{
          position: 'absolute', left: 0, right: 0, top: Math.round(height * 0.4 - size * 0.6),
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: Math.round(size * 0.55),
          fontSize: size, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.2,
        }}>
          <div style={{ display: 'flex', gap: Math.round(size * 0.26) }}>
            <span>Βάλε το ακίνητό σου</span>
            <span style={{ color: c.accent }}>σε τάξη</span>
          </div>
          <div style={{ display: 'flex', width: Math.max(2, Math.round(size * 0.05)), height: Math.round(size * 0.9), backgroundColor: alpha(c.muted, '80') }} />
          <div style={{ display: 'flex', fontSize: Math.round(size * 0.72), fontWeight: 600, color: c.muted, letterSpacing: '-0.01em' }}>properwise.gr</div>
        </div>
      </div>
    ),
    { width, height, fonts },
  );
}

const HEADLINE: Line[] = [
  { text: 'Φωτογραφίζεις', accent: 'τον λογαριασμό.' },
  { text: 'Το PROPERWISE κάνει τα υπόλοιπα.' },
];

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
    const img = ogBanner({ width: c.width, height: c.height, lines: HEADLINE, sub: 'Δωρεάν για ένα ακίνητο · properwise.gr' });
    writeFileSync(join(OUT, c.file), Buffer.from(await img.arrayBuffer()));
    console.log(`✓ ${c.file} ${c.width}×${c.height}`);
  }
  // Διπλάσια ανάλυση του 1500×500, για οθόνες υψηλής πυκνότητας.
  const creem = creemBanner({ width: 3000, height: 1000 });
  writeFileSync(join(OUT, 'creem-exofyllo.png'), Buffer.from(await creem.arrayBuffer()));
  console.log('✓ creem-exofyllo.png 3000×1000');
})().catch(e => { console.error(e); process.exit(1); });
