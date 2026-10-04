import { test } from 'node:test';
import assert from 'node:assert/strict';
import { continuation, carried, loginSearch } from './continuation';
import { HOME } from './redirect';

const q = (s: string) => new URLSearchParams(s);

test('το «next» του χώρου του λογιστή κρατιέται', () => {
  // Το ακριβές σφάλμα: app/accountant/workspace στέλνει εδώ και η σύνδεση
  // κατέληγε στον πίνακα.
  assert.equal(continuation(q('next=/accountant/workspace')), '/accountant/workspace');
  assert.equal(continuation('?next=%2Faccountant%2Fworkspace'), '/accountant/workspace');
  assert.equal(continuation(q('next=/dashboard/properties?tab=a')), '/dashboard/properties?tab=a');
});

test('ξένος τόπος γυρίζει στον πίνακα', () => {
  for (const bad of [
    'https://kako.gr', 'http://kako.gr/accountant/workspace', '//kako.gr', '/\\kako.gr',
    'javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,x', 'kako.gr',
    ' //kako.gr', '/\t/kako.gr', '/\n/kako.gr',
  ]) {
    assert.equal(continuation(q(`next=${encodeURIComponent(bad)}`)), HOME, bad);
  }
});

test('κωδικοποιημένες μορφές δεν περνούν', () => {
  // Μία κωδικοποίηση: το URLSearchParams την αποκωδικοποιεί πριν από τον έλεγχο.
  assert.equal(continuation('next=%2F%2Fkako.gr'), HOME);
  assert.equal(continuation('next=%2F%5Ckako.gr'), HOME);
  assert.equal(continuation('next=https%3A%2F%2Fkako.gr'), HOME);
  // Διπλή: μένει «%2F…», που δεν ξεκινά με κάθετο.
  assert.equal(continuation('next=%252F%252Fkako.gr'), HOME);
  // Κάθετος και μετά κωδικοποιημένη δεύτερη: όποιος αποκωδικοποιήσει ξανά
  // κάτω από εμάς βρίσκει «//kako.gr».
  assert.equal(continuation('next=%2F%252Fkako.gr'), HOME);
  assert.equal(continuation('next=%2F%255Ckako.gr'), HOME);
  // Χαλασμένη κωδικοποίηση δεν ρίχνει τη σελίδα.
  assert.equal(continuation('next=%2F%25E0%25A4%25A'), HOME);
});

test('οι τελείες λύνονται πριν από τον έλεγχο', () => {
  for (const bad of [
    '/.//kako.gr', '/..//kako.gr', '/%2e%2e//kako.gr', '/%2E//kako.gr', '/./\\kako.gr', '/.\\/kako.gr',
    '/dashboard/../login', '/dashboard/../auth/callback?token_hash=X', '/dashboard/%2e%2e/signup',
    '/a/../../..//kako.gr',
  ]) {
    assert.equal(continuation(q(`next=${encodeURIComponent(bad)}`)), HOME, bad);
    assert.equal(carried(q(`next=${encodeURIComponent(bad)}`)), '', bad);
  }
  // Επιστρέφεται η λυμένη μορφή.
  assert.equal(continuation(q('next=/dashboard/../accountant/./workspace')), '/accountant/workspace');
  assert.equal(continuation(q('next=/dashboard?tab=calendar#x')), '/dashboard?tab=calendar#x');
});

test('οι σελίδες εισόδου δεν είναι προορισμός', () => {
  assert.equal(continuation(q('next=/login')), HOME);
  assert.equal(continuation(q('next=/signup?oauth=login')), HOME);
  assert.equal(continuation(q('next=/auth/callback?code=x')), HOME);
});

test('η αγορά προηγείται του «next»', () => {
  assert.equal(
    continuation(q('plan=owner&cycle=annual&next=/accountant/workspace')),
    '/tameio?plan=owner&cycle=annual',
  );
  assert.equal(continuation(q('plan=owner&cycle=monthly')), '/tameio?plan=owner&cycle=monthly');
});

test('άκυρο πακέτο αγνοείται, άκυρος κύκλος γίνεται μηνιαίος', () => {
  assert.equal(continuation(q('plan=kako&next=/accountant/workspace')), '/accountant/workspace');
  assert.equal(continuation(q('plan=free&cycle=annual')), HOME);
  assert.equal(continuation(q('plan=owner&cycle=weekly')), '/tameio?plan=owner&cycle=monthly');
});

test('χωρίς παραμέτρους, ο πίνακας', () => {
  assert.equal(continuation(q('')), HOME);
  assert.equal(continuation(''), HOME);
  assert.equal(continuation(q('next=')), HOME);
  assert.equal(continuation(q('cycle=annual')), HOME);
});

test('οι σύνδεσμοι ανάμεσα σε σύνδεση και εγγραφή κουβαλούν μόνο τη συνέχεια', () => {
  assert.equal(carried(q('next=/accountant/workspace')), '?next=%2Faccountant%2Fworkspace');
  assert.equal(carried(q('plan=owner&cycle=annual&next=/x&code=SECRET&ref=abc')), '?plan=owner&cycle=annual');
  assert.equal(carried(q('plan=owner')), '?plan=owner&cycle=monthly');
  assert.equal(carried(q('next=//kako.gr')), '');
  assert.equal(carried(q('next=/login')), '');
  assert.equal(carried(q('code=SECRET&access_token=x')), '');
  assert.equal(carried(q('')), '');
  // Ο γύρος κλείνει: ό,τι κουβαλήθηκε δίνει τον ίδιο προορισμό απέναντι.
  for (const s of ['next=/accountant/workspace', 'plan=owner&cycle=annual', 'next=/dashboard?x=1&y=2']) {
    assert.equal(continuation(carried(q(s))), continuation(q(s)), s);
  }
});

test('ο διαμεσολαβητής στέλνει στη σύνδεση με τη σελίδα που ζητήθηκε', () => {
  assert.equal(loginSearch('/accountant/workspace', ''), '?next=%2Faccountant%2Fworkspace');
  assert.equal(loginSearch('/dashboard/properties', '?tab=a'), '?next=%2Fdashboard%2Fproperties%3Ftab%3Da');
  // Ο σκέτος πίνακας είναι ήδη ο προορισμός.
  assert.equal(loginSearch('/dashboard', ''), '');
  assert.equal(loginSearch('/dashboard', '?x=1'), '');
  // Με γνωστή παράμετρο όμως χρειάζεται: ο σύνδεσμος του ημερολογίου, του
  // λογιστή και οι συντομεύσεις του manifest.
  assert.equal(loginSearch('/dashboard', '?tab=calendar'), '?next=%2Fdashboard%3Ftab%3Dcalendar');
  assert.equal(loginSearch('/dashboard', '?action=scan&x=1'), '?next=%2Fdashboard%3Faction%3Dscan');
  assert.equal(continuation(loginSearch('/dashboard', '?tab=accounting')), '/dashboard?tab=accounting');
  // Το «checkout=ok» δεν ξαναπαίζεται μετά τη σύνδεση.
  assert.equal(loginSearch('/dashboard', '?checkout=ok'), '');
  // Ό,τι δεν είναι στον κατάλογο φεύγει, όποιο κι αν είναι το όνομά του.
  assert.equal(
    loginSearch('/dashboard/x', '?state=s&session_id=i&t=1&s=2&jwt=j&key=k&sig=g&otp=o&nonce=n&tab=a'),
    '?next=%2Fdashboard%2Fx%3Ftab%3Da',
  );
  // Διακριτικά δεν μπαίνουν στο «next».
  assert.equal(
    loginSearch('/dashboard/x', '?code=SECRET&access_token=a&token_hash=b&refresh_token=c&error_description=d&tab=a'),
    '?next=%2Fdashboard%2Fx%3Ftab%3Da',
  );
  assert.equal(loginSearch('/dashboard', '?code=SECRET'), '');
  // Σελίδες εισόδου δεν γίνονται προορισμός.
  assert.equal(loginSearch('/login', ''), '');
  assert.equal(loginSearch('/auth/callback', '?code=x'), '');
  // Το πακέτο κρατιέται όπως πριν και προηγείται.
  assert.equal(loginSearch('/dashboard', '?plan=owner&cycle=annual'), '?plan=owner&cycle=annual');
  assert.equal(loginSearch('/dashboard/x', '?plan=kako'), '?next=%2Fdashboard%2Fx');
  // Και η διαδρομή του αιτήματος λύνεται: τελείες προς σελίδα εισόδου ή ξένο τόπο.
  assert.equal(loginSearch('/dashboard/../login', ''), '');
  assert.equal(loginSearch('/.//kako.gr', ''), '');
  // Ξένη μορφή διαδρομής δεν περνά.
  assert.equal(loginSearch('//kako.gr', ''), '');
  // Ο γύρος κλείνει: η σύνδεση διαβάζει ακριβώς τη σελίδα που ζητήθηκε.
  assert.equal(continuation(loginSearch('/accountant/workspace', '')), '/accountant/workspace');
});
