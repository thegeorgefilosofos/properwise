// ═══════════════════════════════════════════════════════════════════════════
// Η ΖΩΝΤΑΝΗ ΓΡΑΜΜΗ ΣΥΜΠΛΗΡΩΝΕΙ, ΔΕΝ ΣΒΗΝΕΙ
// ─────────────────────────────────────────────────────────────────────────
// Η καρτέλα έγραφε «ζωντανά ή εφεδρικά», δηλαδή ΟΛΟ ή ΤΙΠΟΤΑ. Η γραμμή της
// βάσης για το «Σπίτι μου ΙΙ» δεν είχε `application_deadline`, οπότε το
// ζωντανό αντίγραφο έσβηνε την 31/05/2026 που ο κατάλογος γνώριζε — και η
// μηχανή πήρε την προθεσμία ΥΠΟΓΡΑΦΗΣ (31/08) στη θέση της προθεσμίας
// ΑΙΤΗΣΗΣ. Στις 31/08/2026 ο χρήστης διάβαζε «οι αιτήσεις κλείνουν σε
// λιγότερο από μία μέρα» για κάτι που είχε κλείσει τρεις μήνες πριν.
// ═══════════════════════════════════════════════════════════════════════════
import { mergePrograms, mergeBanks, programsWithLive, PROGRAMS_NORM, BANKS_NORM } from '@/app/dashboard/components/TabLoanData';
import { programStatus } from '@/lib/loans/programStatus';
import { ANAK_ELIGIBILITY_OPEN_TO, ANAK_ELIGIBILITY_CLOSED_TO } from '@/lib/accounting/anakainisi2026';

let pass = 0; const fail: string[] = [];
const eq = (what: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass++; return; }
  fail.push(`${what}\n    περίμενα: ${JSON.stringify(want)}\n    πήρα:     ${JSON.stringify(got)}`);
};

const staticSpiti = PROGRAMS_NORM.find(p => p.id === 'spiti_mou_2')!;

eq('ο κατάλογος έχει την προθεσμία αίτησης', staticSpiti.applicationDeadline, '31/05/2026');

// Γραμμή βάσης χωρίς `application_deadline`, όπως η πραγματική.
const [merged] = mergePrograms([{ id: 'spiti_mou_2', name: 'Σπίτι μου ΙΙ', deadline: '31/08/2026' }]);
eq('η ζωντανή γραμμή δανείζεται την προθεσμία αίτησης', merged.applicationDeadline, '31/05/2026');
eq('και κρατά τη δική της προθεσμία υπογραφής', merged.deadline, '31/08/2026');
eq('και τα κριτήρια που δεν έστειλε', merged.criteria.length > 0, true);

// Οπου η βάση ΕΧΕΙ τιμή, αυτή νικά: η ενημέρωση πρέπει να φτάνει στην οθόνη.
const [fresh] = mergePrograms([{ id: 'spiti_mou_2', name: 'Σπίτι μου ΙΙ',
  application_deadline: '30/09/2026', deadline: '31/12/2026' }]);
eq('νέα προθεσμία αίτησης από τη βάση νικά', fresh.applicationDeadline, '30/09/2026');
eq('νέα προθεσμία υπογραφής από τη βάση νικά', fresh.deadline, '31/12/2026');

// Πρόγραμμα που ο κατάλογος δεν ξέρει περνά ως έχει, χωρίς εφεύρεση.
const [unknown] = mergePrograms([{ id: 'kainourgio', name: 'Νέο πρόγραμμα' }]);
eq('άγνωστο πρόγραμμα δεν δανείζεται από κανέναν', unknown.applicationDeadline, '');

// Η ΛΙΣΤΑ: η πραγματική γραμμή της παραγωγής στις 08/10/2026, μόνη στην όψη,
// έκρυβε όλο τον κατάλογο. Μία ζωντανή γραμμή δεν σβήνει τα υπόλοιπα προγράμματα.
const prodRow = { program_id: 'anakainizo_noikazo', name: 'Ανακαινίζω και Νοικιάζω', status: 'active',
  description: '40% επιδότηση ανακαίνισης συν εγγυημένο ενοίκιο για 5 έτη μέσω ΟΠΕΚΑ.', max_amount: 15000 };
const list = programsWithLive([prodRow]);
eq('μία ζωντανή γραμμή δεν κρύβει τον κατάλογο', list.length, PROGRAMS_NORM.length);
eq('η ζωντανή γραμμή μπαίνει μία φορά', list.filter(p => p.id === 'anakainizo_noikazo').length, 1);
eq('και πρώτη', list[0].id, 'anakainizo_noikazo');
eq('τα προγράμματα που δεν ξέρει η βάση έρχονται από τον κατάλογο', list.some(p => p.id === 'spiti_mou_2'), true);
eq('άδεια βάση: όλος ο κατάλογος', programsWithLive([]).length, PROGRAMS_NORM.length);

// Με τον κατάλογο ορατό στην παραγωγή, κανένα πρόγραμμα δεν φαίνεται «Ενεργό»
// χωρίς ημερομηνία: η «Γέφυρα 3» έγραφε «Χωρίς ανακοινωμένη λήξη» και η μηχανή
// την έκρινε ανοιχτή τρία χρόνια αφότου έκλεισαν οι αιτήσεις (31/07/2023).
const oct8 = new Date(2026, 9, 8);
const stateOn = (id: string) => { const p = PROGRAMS_NORM.find(x => x.id === id)!;
  return programStatus({ applicationDeadline: p.applicationDeadline, deadline: p.deadline, status: p.status }, oct8); };
eq('η Γέφυρα 3 είναι κλειστή στις 08/10/2026', stateOn('gefyra_3').state, 'closed');
eq('κανένα πρόγραμμα του καταλόγου δεν δέχεται αιτήσεις στις 08/10/2026',
  PROGRAMS_NORM.filter(p => programStatus({ applicationDeadline: p.applicationDeadline, deadline: p.deadline, status: p.status }, oct8).acceptsApplications).map(p => p.id), []);

// Το «Ανακαινίζω 2026» κλείνει με δικό του σημείωμα: δύο ημερομηνίες, όχι «Τυχόν νέος κύκλος».
const anak = PROGRAMS_NORM.find(p => p.id === 'anakainizo_noikazo')!;
eq('το Ανακαινίζω είναι κλειστό για νέους στις 08/10/2026', stateOn('anakainizo_noikazo').state, 'closed');
eq('το σημείωμά του έχει και τις δύο ημερομηνίες', anak.closedNote.includes(ANAK_ELIGIBILITY_OPEN_TO) && anak.closedNote.includes(ANAK_ELIGIBILITY_CLOSED_TO), true);
eq('και δεν λέει «Τυχόν νέος κύκλος»', /Τυχόν νέος κύκλος/.test(anak.closedNote), false);
eq('η ζωντανή γραμμή χωρίς σημείωμα το παίρνει από τον κατάλογο', mergePrograms([prodRow])[0].closedNote, anak.closedNote);

// Το ίδιο για τις τράπεζες.
const staticBank = BANKS_NORM[0];
const [b] = mergeBanks([{ id: staticBank.id, name: staticBank.name }]);
eq('η ζωντανή τράπεζα κρατά ό,τι ξέρει ο κατάλογος', b.name, staticBank.name);
eq('και δεν χάνει το επιτόκιό της', b.fixed_5yr, staticBank.fixed_5yr);

if (fail.length) { console.error(`\n✗ merge: ${fail.length} αποτυχίες\n`); for (const f of fail) console.error('  ' + f); process.exit(1); }
console.log(`✓ merge: ${pass} έλεγχοι πέρασαν`);
