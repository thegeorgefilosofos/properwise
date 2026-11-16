// Το /humans.txt. Το κείμενο το γράφει το lib/seo/humans.ts, από τις ίδιες
// πηγές με το site.
import { humansText } from '@/lib/seo/humans';

export const dynamic = 'force-static';

export function GET() {
  return new Response(humansText(), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
