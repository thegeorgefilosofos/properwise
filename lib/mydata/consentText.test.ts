// npx tsx lib/mydata/consentText.test.ts
//
// Η ΣΥΝΑΙΝΕΣΗ myDATA ΑΠΟΔΕΙΚΝΥΕΤΑΙ (θωράκιση 24/11/2026, Κ4 νομικού ελέγχου).
// Το κείμενο της οθόνης έχει έκδοση και αποτύπωμα· η βάση δέχεται «Επιτρέπω»
// μόνο με την έκδοση και το αποτύπωμα που ξέρει. Αλλαγή του κειμένου χωρίς νέο
// αποτύπωμα, ή αποτύπωμα που η βάση δεν ξέρει, κοκκινίζει εδώ.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import {
  MYDATA_CONSENT_VERSION, MYDATA_CONSENT_HASH, MYDATA_CONSENT_POINTS, MYDATA_HEALTH_CONSENT, MYDATA_CONSENT_TITLE,
  MYDATA_PRIVACY_HREF,
} from './consentText';
import { MYDATA_PENDING_DAYS, MYDATA_DECIDED_DAYS, MYDATA_REVOKED_YEARS } from './retention';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean) => { if (cond) pass++; else { fail++; console.error('✗ ' + name); } };

// Η μορφή που αποτυπώνεται, όπως τη γράφει το consentText.ts.
const canonical = [MYDATA_CONSENT_VERSION, MYDATA_CONSENT_TITLE, ...MYDATA_CONSENT_POINTS, MYDATA_HEALTH_CONSENT, MYDATA_PRIVACY_HREF].join('\n');
const sha = createHash('sha256').update(canonical, 'utf8').digest('hex');
ok('το αποτύπωμα είναι SHA-256 του κειμένου', sha === MYDATA_CONSENT_HASH);
ok('η έκδοση είναι ημερομηνία yyyy-mm-dd με προαιρετικό αύξοντα', /^\d{4}-\d{2}-\d{2}(\.\d{1,3})?$/.test(MYDATA_CONSENT_VERSION));
// Ε-4 / Κ-7 (νομικός έλεγχος 24/11/2026, μοντέλο Γ): νέα έκδοση του κειμένου.
ok('νέα έκδοση μετά την 2026-11-24', (MYDATA_CONSENT_VERSION as string) !== '2026-11-24' && (MYDATA_CONSENT_HASH as string) !== '0ae5ce6725e8c46752fd7004ba21dea8dd0340d139fcf1f1e8a71a9be858cba5');

const all = [MYDATA_CONSENT_TITLE, ...MYDATA_CONSENT_POINTS, MYDATA_HEALTH_CONSENT].join(' ');
// Το ελάχιστο περιεχόμενο (EDPB 05/2020 §64, άρθρο 13).
ok('Ε-4: ονομάζει τους δύο από κοινού υπευθύνους', /από κοινού/.test(all) && /PROPERWISE/.test(all) && /λογιστής που διαλέγεις/.test(all));
ok('Ε-4: η συναίνεση δίνεται και στους δύο', /και στους δύο/.test(all));
ok('Ε2: η λήψη γίνεται μόνο όταν την ξεκινά ο λογιστής', /μόνο όταν την ξεκινά/.test(all) && !/απόψε|κάθε νύχτα|αυτόματα κάθε/.test(all));
ok('Κ-7α: ο λογιστής βλέπει τις δαπάνες και με τη γενική πρόσβαση ακόμη και μετά την ανάκληση', /πρόσβαση που έχεις δώσει στο γραφείο/.test(all) && /μετά την ανάκληση/.test(all));
ok('Κ-7β: το τικ υγείας λέει ότι ό,τι καταχωρηθεί το βλέπει ο λογιστής', /καταχωρήσω ως δαπάνη τα βλέπει και ο λογιστής/.test(MYDATA_HEALTH_CONSENT) && !/μόνο για να τα δω εγώ/.test(MYDATA_HEALTH_CONSENT));
ok('Ε2: λέει τίμια ότι οι αποδείξεις λιανικής συνήθως δεν έρχονται', /αποδείξεις λιανικής/.test(all));
ok('λέει ότι έρχονται όλα μαζί με τα προσωπικά', /όλα τα παραστατικά εξόδων/.test(all) && /προσωπικά/.test(all));
ok('λέει ότι μπορεί να αφορούν υγεία', /υγεία/.test(all));
ok('λέει τι βλέπει ο λογιστής', /λογιστής σου βλέπει/.test(all));
ok('λέει ότι κάποια καταχωρούνται αυτόματα και αναιρούνται', /αυτόματα/.test(all) && /αναιρείς/.test(all));
ok('λέει τους χρόνους από τις σταθερές', all.includes(`${MYDATA_PENDING_DAYS} ημέρες`) && all.includes(`${MYDATA_DECIDED_DAYS} ημέρες`) && all.includes(`${MYDATA_REVOKED_YEARS} έτη`));
ok('λέει πώς ανακαλείς', /Ανακαλείς/.test(all));
ok('συνδέεται με την Πολιτική', MYDATA_PRIVACY_HREF === '/privacy#mydata');
ok('ρητή συγκατάθεση για υγεία', /ρητά/.test(MYDATA_HEALTH_CONSENT) && /υγείας/.test(MYDATA_HEALTH_CONSENT));
ok('χωρίς κόμμα πριν από «και»', !/,\sκαι\s/.test(all));
ok('χωρίς παύλα', !/[—–]/.test(all));
ok('χωρίς φορολογική κρίση', !/εκπίπτ/i.test(all));

// Η βάση ξέρει την ίδια έκδοση και το ίδιο αποτύπωμα (η τελευταία μετανάστευση που ορίζει τον έλεγχο).
const dir = 'supabase/migrations';
const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort().reverse();
const src = files.map(f => readFileSync(`${dir}/${f}`, 'utf8')).find(s => s.includes('function private.mydata_consent_text_ok')) ?? '';
ok('η βάση έχει έλεγχο κειμένου συναίνεσης', src.length > 0);
ok('η βάση δέχεται αυτή την έκδοση', src.includes(`'${MYDATA_CONSENT_VERSION}'`));
ok('η βάση δέχεται αυτό το αποτύπωμα', src.includes(`'${MYDATA_CONSENT_HASH}'`));

console.log(`mydata consent text: ${pass} ✓ · ${fail} ✗`);
if (fail) process.exit(1);
