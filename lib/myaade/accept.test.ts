// npx tsx lib/myaade/accept.test.ts
//
// Μετά από αποτυχία, το «Δοκίμασε άλλο αρχείο» της μαζικής καταχώρησης άνοιγε
// επιλογέα μόνο για PDF, ενώ το μήνυμα (σαρωμένο PDF, λάθος έγγραφο) έλεγε
// «ανέβασε μια φωτογραφία». Εδώ κλειδώνει ότι κάθε πεδίο αρχείου της ροής
// δέχεται ό,τι δέχεται και η ανάγνωση, από μία σταθερά.
import { readFileSync } from 'node:fs';
import { MYAADE_ACCEPT, PHOTO_LIST_TYPES, PHOTO_LIST_EXT, isPhotoFile } from './accept';

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, detail?: unknown) {
  if (cond) pass++; else { fail++; console.error(`✗ ${name}${detail === undefined ? '' : `\n   ${JSON.stringify(detail)}`}`); }
}

const accepted = MYAADE_ACCEPT.split(',');

// 1. Το accept καλύπτει PDF και κάθε φωτογραφία που διαβάζεται.
ok('το accept δέχεται PDF', accepted.includes('application/pdf') && accepted.includes('.pdf'));
for (const t of PHOTO_LIST_TYPES) ok(`το accept δέχεται ${t}`, accepted.includes(t));
for (const e of PHOTO_LIST_EXT) ok(`το accept δέχεται .${e}`, accepted.includes(`.${e}`));
ok('JPG, PNG, WEBP, HEIC στη λίστα', ['image/jpeg', 'image/png', 'image/webp', 'image/heic'].every(t => (PHOTO_LIST_TYPES as readonly string[]).includes(t)));

// 2. Ό,τι προσφέρει ο επιλογέας ως εικόνα, η ροή το στέλνει στη διαδρομή της φωτογραφίας.
for (const a of accepted) {
  if (a === 'application/pdf' || a === '.pdf') continue;
  const f = a.startsWith('.') ? { type: '', name: `σελίδα${a.toUpperCase()}` } : { type: a, name: 'x' };
  ok(`isPhotoFile δέχεται ${a}`, isPhotoFile(f), f);
}
ok('το PDF δεν είναι φωτογραφία', !isPhotoFile({ type: 'application/pdf', name: 'e9.pdf' }) && !isPhotoFile({ type: '', name: 'e9.PDF' }));
ok('άλλη εικόνα δεν περνά', !isPhotoFile({ type: 'image/gif', name: 'a.gif' }) && !isPhotoFile({ type: '', name: 'a.tiff' }));

// 3. Τα πεδία αρχείου της ροής: κανένα accept γραμμένο με το χέρι, κανένα capture.
const src = (p: string) => readFileSync(p, 'utf8');
const imp = src('app/dashboard/components/MyaadeImport.tsx');
const steps = src('app/dashboard/components/MyaadeSteps.tsx');
const inputs = imp.match(/<input[^>]*type="file"[^>]*>/g) ?? [];
ok('το πεδίο του «Δοκίμασε άλλο αρχείο» υπάρχει', inputs.length >= 1, inputs.length);
for (const i of inputs) ok('το πεδίο μετά από αποτυχία παίρνει το MYAADE_ACCEPT', /accept=\{MYAADE_ACCEPT\}/.test(i), i);
ok('κανένα accept γραμμένο με το χέρι στη ροή', !/accept="/.test(imp) && !/accept="/.test(steps));
ok('το πλακίδιο παίρνει το MYAADE_ACCEPT', /accept=\{MYAADE_ACCEPT\}/.test(steps));
ok('χωρίς capture: η κάμερα δεν επιβάλλεται', !/\bcapture\b/.test(imp) && !/\bcapture=/.test(steps) && !/\bcapture=/.test(src('app/dashboard/components/DropZone.tsx')));

// 4. Το σαρωμένο PDF στέλνει σε φωτογραφία, που τώρα ο επιλογέας δέχεται.
ok('το σαρωμένο PDF προτείνει φωτογραφία', /no_text:[^\n]*φωτογραφία/.test(imp));

console.log(`accept: ${pass} πέρασαν, ${fail} απέτυχαν`);
if (fail) process.exit(1);
