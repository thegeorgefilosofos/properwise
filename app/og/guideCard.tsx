// Η κάρτα κοινοποίησης ενός οδηγού: σήμα και όνομα, θέμα με κεφαλαία, τίτλος.
// Την αποδίδει το app/og/[slug]/route.tsx.
import { ImageResponse } from 'next/og';
import { BRAND_PATHS, BRAND_VIEWBOX, BRAND_MARK_ON_DARK } from '@/components/BrandMark';
import { PRODUCT_NAME, SHARE_IMAGE } from '@/lib/core/site';

const SIZE = { width: SHARE_IMAGE.width, height: SHARE_IMAGE.height };

/** Η κάρτα ενός οδηγού: σήμα και όνομα, θέμα με κεφαλαία, τίτλος. */
export function guideCard(kicker: string, title: string) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', padding: '72px 88px',
          background: '#0f1115', color: '#e8eaed', fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <svg aria-hidden="true" width={56} height={56} viewBox={BRAND_VIEWBOX} fill={BRAND_MARK_ON_DARK} fillRule="nonzero">
            {BRAND_PATHS.shape.map((d: string) => <path key={d} d={d} />)}
          </svg>
          <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: '0.01em' }}>{PRODUCT_NAME}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9aa0a6' }}>
            {kicker}
          </div>
          <div style={{ marginTop: 20, fontSize: 68, fontWeight: 700, lineHeight: 1.12, letterSpacing: '-0.02em', maxWidth: 1000 }}>
            {title}
          </div>
        </div>
      </div>
    ),
    SIZE,
  );
}
