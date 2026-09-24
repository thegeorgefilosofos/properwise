// Η κάρτα κοινοποίησης αυτού του υπολογιστή: το ίδιο σχέδιο με της αρχικής
// (app/opengraph-image.tsx), με την επικεφαλίδα της σελίδας στη θέση της πρότασης.
import { shareCard } from '../opengraph-image';
import { SHARE_IMAGE } from '@/lib/core/site';

const TITLE = 'Υπολόγισε τον ΕΝΦΙΑ του ακινήτου σου';

export const alt = TITLE;
export const size = { width: SHARE_IMAGE.width, height: SHARE_IMAGE.height };
export const contentType = 'image/png';

export default function Image() {
  return shareCard({ over: 'Υπολογιστής', text: TITLE });
}
