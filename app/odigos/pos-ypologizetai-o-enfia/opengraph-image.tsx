// Η κάρτα κοινοποίησης του οδηγού: θέμα και τίτλος από τον κατάλογο (βλ. ../opengraph-image.tsx).
import { guideAt } from '../guides';
import { guideCard, size as SIZE } from '../opengraph-image';

const GUIDE = guideAt('/odigos/pos-ypologizetai-o-enfia');

export const alt = GUIDE.title;
export const size = SIZE;
export const contentType = 'image/png';

export default function Image() {
  return guideCard(GUIDE.kicker, GUIDE.title);
}
