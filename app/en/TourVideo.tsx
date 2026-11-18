'use client';

import { useRef, useState } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// Η ΞΕΝΑΓΗΣΗ ΤΟΥ ΕΝΟΣ ΛΕΠΤΟΥ, ΧΩΡΙΣ ΝΑ ΒΑΡΑΙΝΕΙ ΤΗ ΣΕΛΙΔΑ
// ─────────────────────────────────────────────────────────────────────────
// `preload="none"`: πριν από το πάτημα κατεβαίνει μόνο το εξώφυλλο (~26 KB),
// όχι το βίντεο (~4 MB). Το βίντεο ζει στο δικό μας `public/video/`: καμία
// ενσωμάτωση YouTube, κανένα cookie τρίτου, καμία αλλαγή στην CSP (το
// `default-src 'self'` καλύπτει ήδη το `media-src`).
//
// Το κουμπί αναπαραγωγής είναι πραγματικό `<button>` με ετικέτα, ώστε να
// δουλεύει με πληκτρολόγιο και αναγνώστη οθόνης. Μετά το πάτημα φεύγει και
// μένουν τα εγγενή χειριστήρια του περιηγητή.
// ═══════════════════════════════════════════════════════════════════════════
export default function TourVideo({ src, poster, label, title }: { src: string; poster: string; label: string; title: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const start = () => {
    setPlaying(true);
    const v = ref.current;
    if (v) { v.controls = true; void v.play().catch(() => { /* ο περιηγητής κράτησε την αναπαραγωγή: μένουν τα χειριστήρια */ }); }
  };
  return (
    <div className="lp-tour-frame">
      <video
        ref={ref}
        className="lp-tour-video"
        src={src}
        poster={poster}
        preload="none"
        playsInline
        width={720}
        height={1280}
        title={title}
        aria-label={title}
      />
      {!playing && (
        <button type="button" className="lp-tour-play" aria-label={label} onClick={start}>
          <span className="lp-tour-play-dot" aria-hidden="true">
            <svg width={26} height={26} viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" /></svg>
          </span>
          <span className="lp-tour-play-label">{label}</span>
        </button>
      )}
    </div>
  );
}
