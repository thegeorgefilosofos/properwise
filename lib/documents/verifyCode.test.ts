// npx tsx lib/documents/verifyCode.test.ts
// Ο κωδικός που γράφει ο άνθρωπος πρέπει να βρίσκει το έγγραφο που τυπώθηκε.
import { normalizeVerifyCode as n } from './verifyCode';

let pass = 0, fail = 0;
const fails: string[] = [];
const eq = (name: string, got: string, want: string) => { if (got === want) pass++; else { fail++; fails.push(`${name}: «${got}» αντί για «${want}»`); } };

const REAL = 'PO-260924-ABCD2345';
eq('ο σωστός κωδικός μένει ίδιος', n(REAL), REAL);
eq('πεζά και κενά', n(' po-260924-abcd 2345 '), REAL);
eq('ελληνικό ΡΟ', n('ΡΟ-260924-ABCD2345'), REAL);
eq('ελληνικά πεζά ρο', n('ρο-260924-abcd2345'), REAL);
eq('P0 με μηδέν', n('P0-260924-ABCD2345'), REAL);
eq('O στην ημερομηνία', n('PO-26O924-ABCD2345'), REAL);
eq('χωρίς παύλες', n('PO260924ABCD2345'), REAL);
eq('ελληνικά γράμματα και στο τυχαίο τμήμα', n('PO-260924-ΑΒCΕ2345'), 'PO-260924-ABCE2345');
eq('ό,τι δεν μοιάζει με κωδικό μένει όπως γράφτηκε', n('xyz'), 'XYZ');

console.log(fail === 0 ? `✓ verifyCode: ${pass} έλεγχοι πέρασαν` : `✗ verifyCode: ${fail} απέτυχαν από ${pass + fail}\n  ${fails.join('\n  ')}`);
if (fail > 0) process.exit(1);
