// Το κινητό σε διεθνή μορφή και τα κανάλια του «Ζήτησέ το».
// Τρέξε: npx tsx lib/core/phone.test.ts
import { grMobileDigits, grMobileE164 } from './phone';
import { askChannels, askHref, askText, askPhrase, greeting, askSentText } from '../accountant/ask';

let pass = 0, fail = 0;
const eq = (n: string, a: unknown, b: unknown) => { if (a === b) pass++; else { fail++; console.error(`✗ ${n}: πήρα ${JSON.stringify(a)}, ήθελα ${JSON.stringify(b)}`); } };

// ── Κινητά ──
eq('δέκα ψηφία', grMobileDigits('6941234567'), '306941234567');
eq('με κενά', grMobileDigits('694 123 4567'), '306941234567');
eq('με παύλες και παρενθέσεις', grMobileDigits('(694) 123-4567'), '306941234567');
eq('+30', grMobileDigits('+30 694 123 4567'), '306941234567');
eq('0030', grMobileDigits('0030 6941234567'), '306941234567');
eq('30 χωρίς +', grMobileDigits('306941234567'), '306941234567');
eq('E.164 με +', grMobileE164('694 123 4567'), '+306941234567');
// ── Ό,τι δεν είναι ελληνικό κινητό ──
eq('σταθερό Αθήνας: όχι WhatsApp', grMobileDigits('210 123 4567'), null);
eq('σταθερό με +30', grMobileDigits('+30 2310 123456'), null);
eq('λίγα ψηφία', grMobileDigits('69412345'), null);
eq('πολλά ψηφία', grMobileDigits('69412345678'), null);
eq('ξένο κινητό', grMobileDigits('+44 7700 900123'), null);
eq('κείμενο', grMobileDigits('καλέστε μετά τις 5'), null);
eq('κενό', grMobileDigits('   '), null);
eq('null', grMobileDigits(null), null);
eq('σύμβολα', grMobileDigits('69#1234567'), null);

// ── Κανάλια ──
eq('χωρίς στοιχεία: μόνο η εφαρμογή', askChannels(null).join(), 'app');
eq("μόνο email", askChannels({ email: 'a@b.gr' }).join(), 'app,email');
eq('άκυρο email', askChannels({ email: 'όχι-email' }).join(), 'app');
eq('κινητό: τρία κανάλια', askChannels({ phone: '6941234567' }).join(), 'app,whatsapp,viber,sms');
eq('σταθερό: κανένα κανάλι τηλεφώνου', askChannels({ phone: '2101234567' }).join(), 'app');
eq('όλα', askChannels({ email: 'a@b.gr', phone: '+306941234567' }).join(), 'app,email,whatsapp,viber,sms');

// ── Κείμενο ──
const morning = new Date('2026-11-09T07:00:00Z'); // 09:00 Αθήνα
const evening = new Date('2026-11-09T16:00:00Z'); // 18:00 Αθήνα
eq('Καλημέρα το πρωί', greeting(morning), 'Καλημέρα,');
eq('Καλησπέρα το απόγευμα', greeting(evening), 'Καλησπέρα,');
eq('φράση για ΑΦΜ', askPhrase('owner_afm', 'Δεν έχει συμπληρώσει ΑΦΜ'), 'να συμπληρώσετε τον ΑΦΜ σας');
eq('φράση με πλήθος', askPhrase('uncategorised', '3 δαπάνες χωρίς κατηγορία'), 'να βάλετε κατηγορία σε 3 δαπάνες');
eq('ανείσπρακτα: ζητά επιβεβαίωση, όχι «χρειάζομαι»', askPhrase('rents_unpaid', '2 ανείσπρακτα μισθώματα'), 'να επιβεβαιώσετε τα 2 μισθώματα που εμφανίζονται ανείσπρακτα');
eq('ανείσπρακτο: ενικός', askPhrase('rents_unpaid', '1 ανείσπρακτο μίσθωμα'), 'να επιβεβαιώσετε το 1 μίσθωμα που εμφανίζεται ανείσπρακτο');
eq('άγνωστο: ουδέτερο', askPhrase('x', 'Στείλε το συμβόλαιο'), 'να δείτε: στείλε το συμβόλαιο');
const t = askText({ key: 'uncategorised', item: '3 δαπάνες χωρίς κατηγορία', year: 2026, note: 'Κυρίως του Οκτωβρίου', from: 'Λογιστικό Γραφείο Παράδειγμα', now: morning });
eq('κείμενο: χαιρετισμός πρώτος', t.body.startsWith('Καλημέρα,\n'), true);
eq('κείμενο: τι λείπει', t.body.includes('για να κλείσουμε το Ε2 2026, σας παρακαλώ να βάλετε κατηγορία σε 3 δαπάνες.'), true);
eq('κείμενο: σημείωση με τελεία', t.body.includes('\nΚυρίως του Οκτωβρίου.\n'), true);
eq('κείμενο: σύνδεσμος στη Λογιστική', /https:\/\/\S+\/dashboard\?tab=accounting/.test(t.body), true);
eq('κείμενο: υπογραφή', t.body.endsWith('\n\nΛογιστικό Γραφείο Παράδειγμα'), true);
eq('κείμενο: χωρίς κλητική', /κ\.\s/.test(t.body), false);
eq('θέμα', t.subject, 'Ε2 2026: 3 δαπάνες χωρίς κατηγορία');
const bare = askText({ key: 'owner_afm', item: 'Δεν έχει συμπληρώσει ΑΦΜ', year: 2026, now: evening });
eq('χωρίς σημείωση και υπογραφή: τρεις γραμμές', bare.body.split('\n').length, 3);

// ── Σύνδεσμοι ──
const c = { email: 'pelatis@example.com', phone: '694 123 4567' };
eq('εφαρμογή: κανένας σύνδεσμος', askHref('app', c, t), null);
eq('mailto', askHref('email', c, t)?.startsWith('mailto:pelatis@example.com?subject='), true);
eq('mailto: κωδικοποιημένο σώμα', askHref('email', c, t)?.includes('%0A'), true);
eq('wa.me με ψηφία', askHref('whatsapp', c, t)?.startsWith('https://wa.me/306941234567?text='), true);
eq('viber forward', askHref('viber', c, t)?.startsWith('viber://forward?text='), true);
eq('sms με E.164', askHref('sms', c, t)?.startsWith('sms:+306941234567?&body='), true);
eq('WhatsApp χωρίς κινητό: τίποτα', askHref('whatsapp', { phone: '2101234567' }, t), null);
eq('επιβεβαίωση εφαρμογής', askSentText('app'), 'Στάλθηκε στην εφαρμογή.');
eq('επιβεβαίωση Viber λέει για την επαφή', askSentText('viber').includes('διάλεξε την επαφή'), true);

console.log(`phone/ask: ${pass} πέρασαν, ${fail} απέτυχαν`);
if (fail) process.exit(1);
