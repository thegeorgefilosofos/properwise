// Η ροή RSS των οδηγών. Το κείμενο το γράφει το lib/seo/feed.ts, από τον ίδιο
// κατάλογο με τον κόμβο /odigos και τον χάρτη.
import { guidesFeed } from '@/lib/seo/feed';

export const dynamic = 'force-static';

export function GET() {
  return new Response(guidesFeed(), {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
