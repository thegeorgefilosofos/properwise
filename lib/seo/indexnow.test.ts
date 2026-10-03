// npx tsx lib/seo/indexnow.test.ts
//
// ΤΟ IndexNow ΑΠΟΡΡΙΠΤΕΙ ΣΙΩΠΗΛΑ. Ένα κλειδί που δεν ταιριάζει με το αρχείο του
// δίνει 403, μία ξένη διεύθυνση ακυρώνει όλο το αίτημα με 422 και κανένα από
// τα δύο δεν φαίνεται στον ιστότοπο. Εδώ ελέγχονται χωρίς δίκτυο: το σώμα του
// αιτήματος, το αρχείο του κλειδιού στο public/ και ότι ο διαμεσολαβητής το
// αφήνει να σερβιριστεί όπως είναι.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { indexNowPayload, INDEXNOW_ENDPOINT } from './indexnow';
import { INDEXNOW_KEY, SITE } from '@/lib/core/site';
import sitemap from '@/app/sitemap';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n); } };
const throws = (f: () => unknown) => { try { f(); return false; } catch { return true; } };

const S = 'https://properwise.gr';
const K = '0123456789abcdef0123456789abcdef';

// ── ΤΟ ΣΩΜΑ ──────────────────────────────────────────────────────────────
const p = indexNowPayload([`${S}`, `${S}/paketa`, `${S}/logistes`], S, K);
ok('host χωρίς πρωτόκολλο', p.host === 'properwise.gr');
ok('το κλειδί περνά όπως δόθηκε', p.key === K);
ok('keyLocation στη ρίζα του τομέα', p.keyLocation === `${S}/${K}.txt`);
ok('οι διευθύνσεις μένουν με τη σειρά τους', JSON.stringify(p.urlList) === JSON.stringify([S, `${S}/paketa`, `${S}/logistes`]));
ok('μόνο τα τέσσερα πεδία του πρωτοκόλλου', JSON.stringify(Object.keys(p).sort()) === JSON.stringify(['host', 'key', 'keyLocation', 'urlList']));

// ── ΤΙ ΚΟΒΕΤΑΙ ───────────────────────────────────────────────────────────
const mixed = indexNowPayload([
  `${S}/odigos`, `${S}/odigos`, ` ${S}/terms `, `${S}/`,
  'https://example.com/ksenos', 'http://properwise.gr/xoris-https', 'όχι διεύθυνση', `${S}`,
], S, K);
ok('οι διπλές μένουν μία', mixed.urlList.filter(u => u === `${S}/odigos`).length === 1);
ok('τα κενά γύρω κόβονται', mixed.urlList.includes(`${S}/terms`));
ok('ξένος τομέας φεύγει: κάθε διεύθυνση έχει την προέλευση του site', mixed.urlList.every(u => new URL(u).origin === new URL(S).origin));
ok('http στον ίδιο τομέα φεύγει: άλλη προέλευση', !mixed.urlList.some(u => u.startsWith('http://')));
ok('η ρίζα με και χωρίς κάθετο είναι μία', mixed.urlList.filter(u => u === S || u === `${S}/`).length === 1);
ok('ό,τι δεν είναι διεύθυνση αγνοείται', mixed.urlList.length === 3);

// ── ΤΙ ΔΕΝ ΦΕΥΓΕΙ ΠΟΤΕ ───────────────────────────────────────────────────
ok('καμία διεύθυνση: σφάλμα πριν από το δίκτυο', throws(() => indexNowPayload([], S, K)));
ok('μόνο ξένες διευθύνσεις: σφάλμα', throws(() => indexNowPayload(['https://example.com/'], S, K)));
ok('κλειδί κάτω από 8 χαρακτήρες: σφάλμα', throws(() => indexNowPayload([S], S, 'abc')));
ok('κλειδί με άκυρο χαρακτήρα: σφάλμα', throws(() => indexNowPayload([S], S, 'abc/defgh')));
ok('πάνω από 10.000 διευθύνσεις: σφάλμα', throws(() => indexNowPayload(Array.from({ length: 10_001 }, (_, i) => `${S}/s${i}`), S, K)));
ok('ακριβώς 10.000 περνούν', indexNowPayload(Array.from({ length: 10_000 }, (_, i) => `${S}/s${i}`), S, K).urlList.length === 10_000);
ok('το σημείο αποστολής είναι το κοινό του πρωτοκόλλου', INDEXNOW_ENDPOINT === 'https://api.indexnow.org/indexnow');

// ── Ο ΧΑΡΤΗΣ ΠΕΡΝΑ ΟΛΟΚΛΗΡΟΣ ─────────────────────────────────────────────
// Αν μια γραμμή του χάρτη έπεφτε σε άλλον τομέα, θα έφευγε σιωπηλά από την ειδοποίηση.
const urls = sitemap().map(r => r.url);
const live = indexNowPayload(urls);
ok('κάθε σελίδα του χάρτη μπαίνει στην ειδοποίηση', live.urlList.length === urls.length);
ok('με το κλειδί της εφαρμογής', live.key === INDEXNOW_KEY && live.keyLocation === `${SITE}/${INDEXNOW_KEY}.txt`);

// ── ΤΟ ΑΡΧΕΙΟ ΤΟΥ ΚΛΕΙΔΙΟΥ ────────────────────────────────────────────────
// Ακριβώς το κλειδί, χωρίς αλλαγή γραμμής: το πρωτόκολλο συγκρίνει το περιεχόμενο.
const FILE = `public/${INDEXNOW_KEY}.txt`;
ok('το κλειδί είναι 32 δεκαεξαδικά ψηφία', /^[0-9a-f]{32}$/.test(INDEXNOW_KEY));
ok(`το ${FILE} υπάρχει`, existsSync(FILE));
ok(`το ${FILE} περιέχει ακριβώς το κλειδί`, existsSync(FILE) && readFileSync(FILE, 'utf8') === INDEXNOW_KEY);
// Ένα παλιό κλειδί που έμεινε στο public/ αποδεικνύει τον τομέα σε όποιον το ξέρει.
const keyFiles = readdirSync('public').filter(f => /^[0-9a-f]{32}\.txt$/.test(f));
ok(`ένα μόνο αρχείο κλειδιού στο public/ (βρέθηκαν: ${keyFiles.join(', ') || 'κανένα'})`, keyFiles.length === 1 && keyFiles[0] === `${INDEXNOW_KEY}.txt`);

// ── Ο ΔΙΑΜΕΣΟΛΑΒΗΤΗΣ ΤΟ ΑΦΗΝΕΙ ΣΤΗΝ ΗΣΥΧΙΑ ΤΟΥ ────────────────────────────
// Ίδια ανάγνωση με τον guard-security-txt: το `matcher` του proxy.ts ως RegExp.
const proxy = readFileSync('proxy.ts', 'utf8');
const matcher = /matcher:\s*\[[\s\S]*?"(\/\(\(\?![^"]+)"/.exec(proxy)?.[1];
const re = matcher ? new RegExp(`^${matcher.replace(/\\\\/g, '\\')}$`) : null;
ok('το matcher του proxy.ts διαβάζεται', !!re && re.test('/dashboard'));
ok('το αρχείο του κλειδιού δεν περνά από τον διαμεσολαβητή', !!re && !re.test(`/${INDEXNOW_KEY}.txt`));

console.log(fail === 0 ? `✓ indexnow: ${pass} έλεγχοι πέρασαν` : `✗ indexnow: ${fail} απέτυχαν από ${pass + fail}`);
if (fail > 0) process.exit(1);
