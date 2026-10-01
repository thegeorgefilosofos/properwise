'use client';

import { useEffect, useRef } from 'react';

/**
 * ΤΟ ΕΥΡΕΤΗΡΙΟ ΞΕΡΕΙ ΠΟΥ ΒΡΙΣΚΕΣΑΙ. Στην πλαϊνή στήλη της μεγάλης οθόνης ο
 * κατάλογος μένει καρφωμένος όσο κυλάς· χωρίς ένδειξη θέσης ήταν απλώς μια
 * λίστα που δεν άλλαζε ποτέ. Σημειώνει με `aria-current` την ενότητα της
 * οποίας ο τίτλος πέρασε τελευταίος το πάνω τρίτο της οθόνης.
 *
 * Κανένα κείμενο, κανένα κουμπί: μόνο ιδιότητα στους υπάρχοντες συνδέσμους.
 * Μπαίνει μέσα στο `<nav>` του καταλόγου και βρίσκει μόνο του τους στόχους.
 */
export function TocSpy() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const nav = ref.current?.closest('nav');
    if (!nav) return;
    const links = [...nav.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')];
    const pairs = links
      .map(a => ({ a, el: document.getElementById(decodeURIComponent(a.hash.slice(1))) }))
      .filter((p): p is { a: HTMLAnchorElement; el: HTMLElement } => !!p.el);
    if (!pairs.length) return;
    // ΤΟ ΕΥΡΕΤΗΡΙΟ ΤΕΛΕΙΩΝΕΙ ΕΚΕΙ ΠΟΥ ΤΕΛΕΙΩΝΟΥΝ ΟΙ ΕΝΟΤΗΤΕΣ ΤΟΥ. Η τελευταία
    // αριθμημένη ενότητα έμενε σημειωμένη ενώ ο αναγνώστης διάβαζε τις συχνές
    // ερωτήσεις, τον υπολογισμό και τους σχετικούς οδηγούς, που δεν είναι στον
    // κατάλογο. Το όριο είναι το πρώτο `.po-tool-more` (ή `[data-toc-end]`)
    // μετά την τελευταία ενότητα: μόλις περάσει τη γραμμή, τίποτα δεν σημειώνεται.
    const last = pairs[pairs.length - 1].el;
    const end = [...document.querySelectorAll<HTMLElement>('.po-tool-more, [data-toc-end]')]
      .find(el => last.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) ?? null;
    let frame = 0;
    const mark = () => {
      frame = 0;
      const line = window.innerHeight * 0.33;
      let on = -1;
      pairs.forEach((p, i) => { if (p.el.getBoundingClientRect().top <= line) on = i; });
      if (end && end.getBoundingClientRect().top <= line) on = -1;
      pairs.forEach((p, i) => {
        if (i === on) p.a.setAttribute('aria-current', 'true');
        else p.a.removeAttribute('aria-current');
      });
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(mark); };
    mark();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return <span ref={ref} hidden />;
}
