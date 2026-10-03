// Το /llms.txt. Το κείμενο το γράφει το lib/seo/llms.ts, από τις ίδιες πηγές
// με το site.
import { llmsText } from '@/lib/seo/llms';

export const dynamic = 'force-static';

export function GET() {
  return new Response(llmsText(), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
