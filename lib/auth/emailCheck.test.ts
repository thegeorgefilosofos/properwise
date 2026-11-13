// npx tsx lib/auth/emailCheck.test.ts
//
// ΤΟ EMAIL ΤΗΣ ΕΓΓΡΑΦΗΣ. Ο έλεγχος δεν απορρίπτει πραγματική διεύθυνση, πιάνει
// το προφανές λάθος και προτείνει τον πάροχο μόνο όταν το τυπογραφικό είναι
// σαφές. Και η σειρά της φόρμας μέσα σε εφαρμογή: πρώτα το email.
import { emailProblem, suggestEmail, EMAIL_MSG } from './emailCheck'
import { inAppBrowser, emailFirst } from '../core/inAppBrowser'

let pass = 0, fail = 0
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n) } }

ok('κενό', emailProblem('') === 'empty' && emailProblem('   ') === 'empty')
ok('χωρίς @', emailProblem('onoma.gmail.com') === 'invalid')
ok('χωρίς κατάληξη', emailProblem('onoma@gmail') === 'invalid')
ok('με κενό μέσα', emailProblem('ono ma@gmail.com') === 'invalid')
ok('δύο @', emailProblem('a@b@c.gr') === 'invalid')
ok('τελεία στο τέλος', emailProblem('onoma@gmail.') === 'invalid')
ok('απλό σωστό', emailProblem('onoma@gmail.com') === null)
ok('κενά γύρω δεν μετρούν', emailProblem('  onoma@gmail.com ') === null)
ok('υποτομέας και συν', emailProblem('a.b+tag@mail.example.co.uk') === null)
ok('ελληνικός τομέας', emailProblem('grafeio@otenet.gr') === null)

ok('gmail.con → gmail.com', suggestEmail('onoma@gmail.con') === 'onoma@gmail.com')
ok('gmial.com → gmail.com', suggestEmail('onoma@gmial.com') === 'onoma@gmail.com')
ok('hotmial.com → hotmail.com', suggestEmail('onoma@hotmial.com') === 'onoma@hotmail.com')
ok('yaho.gr → yahoo.gr', suggestEmail('onoma@yaho.gr') === 'onoma@yahoo.gr')
ok('το τοπικό μέρος μένει όπως γράφτηκε', suggestEmail('Onoma.X@gmail.con') === 'Onoma.X@gmail.com')
ok('σωστός πάροχος: τίποτα', suggestEmail('onoma@gmail.com') === null)
ok('άγνωστος τομέας: τίποτα', suggestEmail('grafeio@properwise.gr') === null)
ok('μικρός τομέας με δύο αλλαγές: τίποτα', suggestEmail('a@aol.com') === null)
ok('χωρίς @: τίποτα', suggestEmail('onoma') === null)

ok('ελληνικά μηνύματα χωρίς παύλα', Object.values(EMAIL_MSG).every(m => !/[—–]/.test(m)))

const IG = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.30.94'
const FB_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 Chrome/128 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/470.0.0.0;]'
const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
ok('Instagram σε iOS 18 (με κουμπί Safari): email πρώτο', emailFirst(inAppBrowser(IG)))
ok('Facebook σε Android (με κουμπί Chrome): email πρώτο', emailFirst(inAppBrowser(FB_ANDROID)))
ok('κανονικός Safari: Google πρώτη', !emailFirst(inAppBrowser(SAFARI)))

console.log(`${fail ? '✗' : '✓'} email εγγραφής: ${pass} περνούν${fail ? `, ${fail} αποτυγχάνουν` : ''}`)
if (fail) process.exit(1)
