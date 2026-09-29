// npx tsx lib/pwa/update.test.ts
import { decideUpdate, AWAY_MS } from './update';

let p = 0, f = 0;
const eq = (a: unknown, b: unknown, m: string) => { if (a === b) p++; else { f++; console.error('✗', m, '\n   πήρα:', a, '\n   περίμενα:', b); } };

eq(decideUpdate('a1b2c3d', 'a1b2c3d', AWAY_MS * 3, false), 'none', 'ίδιο build: τίποτα');
eq(decideUpdate('a1b2c3d', null, AWAY_MS * 3, false), 'none', 'χωρίς απάντηση (εκτός δικτύου): τίποτα, καμία ανανέωση στα τυφλά');
eq(decideUpdate('dev', 'e4f5a6b', AWAY_MS * 3, false), 'none', 'τοπική ανάπτυξη: τίποτα');
eq(decideUpdate('a1b2c3d', 'dev', AWAY_MS * 3, false), 'none', 'διακομιστής χωρίς build: τίποτα');
eq(decideUpdate('a1b2c3d', 'e4f5a6b', AWAY_MS, false), 'reload', 'γύρισε μετά από ώρα, δεν γράφει: ανανέωση μόνη της');
// Το κρίσιμο: τίποτα αυτόματο πάνω σε δουλειά που δεν έχει αποθηκευτεί.
eq(decideUpdate('a1b2c3d', 'e4f5a6b', AWAY_MS * 3, true), 'offer', 'γύρισε μετά από ώρα, αλλά έχει ανοιχτή φόρμα: ρωτά');
eq(decideUpdate('a1b2c3d', 'e4f5a6b', 0, false), 'offer', 'δουλεύει τώρα μέσα: ρωτά, δεν διακόπτει');
eq(decideUpdate('a1b2c3d', 'e4f5a6b', AWAY_MS - 1, false), 'offer', 'λίγα λεπτά έξω: ρωτά');

console.log(`pwa/update: ${p} ✓, ${f} ✗`);
if (f) process.exit(1);
