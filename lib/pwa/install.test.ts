// npx tsx lib/pwa/install.test.ts
import { isAppleMobile, holdPrompt, runPrompt, onHomeScreen, type BeforeInstallPromptEvent } from './install';

let p = 0, f = 0;
const ok = (c: boolean, m: string) => { if (c) p++; else { f++; console.error('✗', m); } };

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const IPAD_AS_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15';
const CHROME_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36';

ok(isAppleMobile({ userAgent: IPHONE, maxTouchPoints: 5, platform: 'iPhone' }), 'iPhone στο Safari');
ok(isAppleMobile({ userAgent: CHROME_IOS, maxTouchPoints: 5, platform: 'iPhone' }), 'Chrome στο iPhone: κι αυτό WebKit, εγκαθιστά από την Κοινή χρήση');
// Το iPad δηλώνει Mac: μόνο η αφή το προδίδει.
ok(isAppleMobile({ userAgent: IPAD_AS_MAC, maxTouchPoints: 5, platform: 'MacIntel' }), 'iPad που δηλώνει Mac');
ok(!isAppleMobile({ userAgent: IPAD_AS_MAC, maxTouchPoints: 0, platform: 'MacIntel' }), 'αληθινό Mac: χωρίς αφή, δεν είναι iPad');
ok(!isAppleMobile({ userAgent: ANDROID, maxTouchPoints: 5, platform: 'Linux armv8l' }), 'Android: έχει δικό του παράθυρο εγκατάστασης');

// Εγκατάσταση από την καρτέλα του περιηγητή: η σελίδα δεν γίνεται «standalone»,
// αλλά η εφαρμογή ΕΙΝΑΙ πλέον στην αρχική οθόνη και η κάρτα πρέπει να το ξέρει.
const fakePrompt = (outcome: 'accepted' | 'dismissed') =>
  ({ prompt: async () => {}, userChoice: Promise.resolve({ outcome }) }) as unknown as BeforeInstallPromptEvent;

(async () => {
  ok(!onHomeScreen(), 'πριν από οτιδήποτε: όχι στην αρχική οθόνη');
  holdPrompt(fakePrompt('dismissed'));
  await runPrompt();
  ok(!onHomeScreen(), '«Όχι» στο παράθυρο: δεν εγκαταστάθηκε');
  holdPrompt(fakePrompt('accepted'));
  ok(await runPrompt() === 'accepted', 'το runPrompt επιστρέφει την απάντηση');
  ok(onHomeScreen(), '«Εγκατάσταση» στο παράθυρο: στην αρχική οθόνη, χωρίς standalone');

  console.log(`pwa/install: ${p} ✓, ${f} ✗`);
  if (f) process.exit(1);
})();
