'use client';
// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΣΤΗΛΕΣ ΤΟΥ ΥΠΟΣΕΛΙΔΟΥ ΓΙΝΟΝΤΑΙ ΑΚΟΡΝΤΕΟΝ ΣΤΟ ΤΗΛΕΦΩΝΟ (04/11/2026)
// ─────────────────────────────────────────────────────────────────────────
// Ως τα 1024 οι τέσσερις στήλες έμπαιναν δύο-δύο: στα 390 τα μισά λεκτικά
// έσπαγαν σε δύο γραμμές και στα 820 μια ανοιχτή λίστα άφηνε κενό μισής
// οθόνης δίπλα της. Στο τηλέφωνο και στην ταμπλέτα κάθε στήλη είναι μια σειρά
// με τίτλο που ανοίγει· μέσα της φαίνονται ΟΛΟΙ οι σύνδεσμοί της.
//
// Η σελίδα έρχεται με όλες τις στήλες ανοιχτές: χωρίς JavaScript, στον
// υπολογιστή και για τη μηχανή αναζήτησης όλα φαίνονται. Εδώ, μόνο ως
// τα 1024, κλείνουν οι στήλες και ανοίγει το «Επιπλέον» μέσα τους. Τα παιδιά
// έρχονται έτοιμα από τον διακομιστή: ο κώδικας του πελάτη είναι μόνο αυτός.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, type ReactNode } from 'react';

export const FOOT_PHONE = '(max-width: 1024px)';

export function FootAccordion({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const mq = matchMedia(FOOT_PHONE);
    const apply = () => {
      const phone = mq.matches;
      el.querySelectorAll<HTMLDetailsElement>('details.lp-footcol').forEach(d => {
        d.open = !phone;
        // Ο τίτλος δεν είναι στάση του Tab όταν δεν ανοιγοκλείνει.
        const s = d.querySelector(':scope > summary') as HTMLElement | null;
        if (s) s.tabIndex = phone ? 0 : -1;
      });
      el.querySelectorAll<HTMLDetailsElement>('details.lp-footmore').forEach(d => { if (phone) d.open = true; });
    };
    // Στον υπολογιστή ο τίτλος της στήλης είναι τίτλος, όχι κουμπί.
    const keep = (e: Event) => {
      if (mq.matches) return;
      const s = (e.target as Element).closest('summary');
      if (s?.parentElement?.classList.contains('lp-footcol')) e.preventDefault();
    };
    apply();
    mq.addEventListener('change', apply);
    el.addEventListener('click', keep);
    return () => { mq.removeEventListener('change', apply); el.removeEventListener('click', keep); };
  }, []);
  return <div ref={box} className="lp-foot">{children}</div>;
}
