// npx tsx lib/core/inAppBrowser.test.ts
//
// Ο ΕΝΣΩΜΑΤΩΜΕΝΟΣ ΠΕΡΙΗΓΗΤΗΣ ΚΡΥΒΕΙ ΤΟ ΚΟΥΜΠΙ ΤΗΣ GOOGLE. Αν ο εντοπισμός
// χάσει το Instagram, ο επισκέπτης του bio ξαναβλέπει «403: disallowed_useragent».
// Αν πιάσει τον κανονικό Safari ή Chrome, χάνεται η πιο γρήγορη εγγραφή.
import { inAppBrowser, chromeIntent } from './inAppBrowser'

let pass = 0, fail = 0
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n) } }

// Πραγματικά User-Agent, όπως τα στέλνουν οι εφαρμογές.
const IG_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.30.94 (iPhone15,2; iOS 18_0; el_GR; el; scale=3.00; 1179x2556; 646425040)';
const IG_ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-S911B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.100 Mobile Safari/537.36 Instagram 350.0.0.43.109 Android (34/14; 480dpi; 1080x2340; samsung; SM-S911B; dm1q; qcom; el_GR; 652346789)';
const FB_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.40.109;FBBV/612345678;FBDV/iPhone14,5;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBID/phone;FBLC/el_GR;FBOP/5]';
const MESSENGER = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/Messenger;FBAV/460.0.0.34.108;FBBV/600000000;FBDV/iPhone14,5]';
const LINKEDIN_ANDROID = 'Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A.230901.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0.6613.127 Mobile Safari/537.36 [LinkedInApp]/9.30.1';
const TIKTOK = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_35.1.0 JsSdk/2.0 NetType/WIFI Channel/App Store ByteLocale/el Region/GR';
const THREADS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Barcelona 350.0.0.20.107 (iPhone15,2; iOS 18_0; el_GR; el)';
const WEBVIEW = 'Mozilla/5.0 (Linux; Android 12; M2101K6G Build/SKQ1.210908.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.230 Mobile Safari/537.36';

const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const CHROME_ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const CHROME_DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36 Edg/153.0.0.0';
const CHROME_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.6668.69 Mobile/15E148 Safari/604.1';

ok('Instagram στο iPhone', inAppBrowser(IG_IOS)?.app === 'Instagram' && inAppBrowser(IG_IOS)?.android === false);
ok('Instagram στο Android, με σύνδεσμο για Chrome', inAppBrowser(IG_ANDROID)?.app === 'Instagram' && inAppBrowser(IG_ANDROID)?.android === true);
ok('Facebook', inAppBrowser(FB_IOS)?.app === 'Facebook');
ok('το Messenger δεν λέγεται Facebook', inAppBrowser(MESSENGER)?.app === 'Messenger');
ok('LinkedIn', inAppBrowser(LINKEDIN_ANDROID)?.app === 'LinkedIn');
ok('TikTok', inAppBrowser(TIKTOK)?.app === 'TikTok');
ok('το Threads δεν λέγεται Instagram', inAppBrowser(THREADS)?.app === 'Threads');
ok('γενικό webview του Android', inAppBrowser(WEBVIEW)?.where === 'την εφαρμογή');
ok('η φράση έχει άρθρο', inAppBrowser(IG_IOS)?.where === 'το Instagram');

ok('ο Safari δεν είναι ενσωματωμένος', inAppBrowser(SAFARI) === null);
ok('ο Chrome του Android δεν είναι', inAppBrowser(CHROME_ANDROID) === null);
ok('ο Chrome του iPhone δεν είναι', inAppBrowser(CHROME_IOS) === null);
ok('ο Edge στον υπολογιστή δεν είναι', inAppBrowser(CHROME_DESKTOP) === null);
ok('κενό User-Agent', inAppBrowser('') === null && inAppBrowser(undefined) === null);

const intent = chromeIntent('https://properwise.gr/signup?plan=owner&cycle=annual');
ok('ο σύνδεσμος ανοίγει την ίδια διαδρομή με τα ίδια ερωτήματα', intent.startsWith('intent://properwise.gr/signup?plan=owner&cycle=annual#Intent;'));
ok('στον Chrome, με https', intent.includes('scheme=https;') && intent.includes('package=com.android.chrome;'));
ok('χωρίς Chrome γυρίζει στην ίδια διεύθυνση', intent.includes(`S.browser_fallback_url=${encodeURIComponent('https://properwise.gr/signup?plan=owner&cycle=annual')};`));

console.log(`${fail ? '✗' : '✓'} ενσωματωμένος περιηγητής: ${pass} περνούν${fail ? `, ${fail} αποτυγχάνουν` : ''}`);
if (fail) process.exit(1);
