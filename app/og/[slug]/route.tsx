// Η μία διαδρομή που αποδίδει κάθε κάρτα κοινοποίησης (βλ. app/og/share.ts).
// Στατική: οι κάρτες χτίζονται στο build και σερβίρονται ως αρχεία.
import { ogFrame } from '../frame';
import { SHARE_CARDS } from '../share';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return Object.keys(SHARE_CARDS).map(slug => ({ slug }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = SHARE_CARDS[slug];
  if (!c) return new Response('Not found', { status: 404 });
  return ogFrame({ kicker: c.over, title: c.title, chips: c.chips, path: c.path });
}
