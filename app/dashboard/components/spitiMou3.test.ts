// ═══════════════════════════════════════════════════════════════════════════
// «ΣΠΙΤΙ ΜΟΥ ΙΙΙ»: ΚΑΤΑΛΟΓΟΣ ΚΑΙ ΝΟΑ ΛΕΝΕ ΜΟΝΟ ΤΑ ΕΠΙΣΗΜΑ, ΑΠΟ ΜΙΑ ΣΤΑΘΕΡΑ
// ─────────────────────────────────────────────────────────────────────────
// Στις 18/10/2026 η κάρτα του καταλόγου (ελεγμένη 01/09, πριν από τη ΔΕΘ)
// έγραφε «παρουσίαση στη ΔΕΘ» σε μέλλοντα, «Δεν έχει ανακοινωθεί» για
// πρόγραμμα που ανακοινώθηκε στις 05/09, όρια από φήμες του καλοκαιριού και το
// «88,7%» του Μαΐου για το ΙΙ. Η Νόα είχε εντολή «λες μόνο ό,τι έχει ανακοινώσει
// επίσημα ο φορέας» χωρίς κανένα επίσημο στοιχείο.
// ═══════════════════════════════════════════════════════════════════════════
import { SPITI_MOU_3, spitiMou3Line } from '@/lib/loans/recommend';
import { programStatus } from '@/lib/loans/programStatus';
import { PROGRAMS_NORM } from './TabLoanData';
import { KNOWLEDGE_PACKS, NAV_MAP } from './assistantPersona';

let pass = 0; const fail: string[] = [];
const ok = (what: string, cond: boolean) => { if (cond) pass++; else fail.push(what); };

// ── Ο κατάλογος ──
const card = PROGRAMS_NORM.find(p => p.id === 'spiti_mou_3');
ok('ο κατάλογος έχει κάρτα για το ΙΙΙ', !!card);
if (card) {
  const text = [card.type, card.desc, card.howItWorks, card.extra, card.savingsExample, card.deadline,
    card.totalBudget, card.duration, ...card.criteria].join(' ');
  ok('όνομα «Σπίτι μου ΙΙΙ» από τη σταθερά', card.name === SPITI_MOU_3.name);
  ok('η περιγραφή είναι η πρόταση που λένε όλες οι οθόνες', card.desc === spitiMou3Line());
  ok('δεν λέει «δεν έχει ανακοινωθεί» για πρόγραμμα που ανακοινώθηκε', !/δεν έχει ανακοινωθεί επίσημα/i.test(text));
  ok('δεν λέει τη ΔΕΘ σε μέλλοντα', !/παρουσίαση στη ΔΕΘ/.test(text));
  ok('κανένα «88,7%» του Μαΐου', !/88,7/.test(text));
  ok('κανένα όριο από φήμες (εισόδημα, ηλικία 44–45, αξία)', !/20\.000|22\.000|44|180\.000|200\.000|230\.000|300\.000/.test(text));
  ok('κανένα όφελος (άτοκο, επιδότηση, %)', !/άτοκ|επιδότ|%/.test(text));
  ok('όλα τα αριθμητικά πεδία μένουν κενά: η μηχανή δεν κρίνει επιλεξιμότητα',
    [card.maxAmount, card.maxLtv, card.maxSqm, card.ageMin, card.ageMax].every(v => v === null));
  ok('επίσημη πηγή, όχι η γενική πύλη', card.url === SPITI_MOU_3.sources.hdb);
  ok('επερχόμενο, δεν δέχεται αιτήσεις', !programStatus(card, new Date('2026-10-18T12:00:00')).acceptsApplications);
}

// ── Η Νόα ──
const loans = KNOWLEDGE_PACKS.loans;
ok('η Νόα έχει τα επίσημα γεγονότα του ΙΙΙ', loans.includes(spitiMou3Line()));
ok('...και ρητή εντολή να μην κρίνει επιλεξιμότητα', /ΔΕΝ κρίνεις επιλεξιμότητα/.test(loans));
{
  const i = loans.indexOf(SPITI_MOU_3.name);
  const iii = i >= 0 ? loans.slice(i, loans.indexOf('\n', i)) : '';
  ok('η γραμμή του ΙΙΙ δεν δίνει όρια δανείου ή αξίας του Τύπου', iii !== '' && !/230\.000|300\.000|400\.000|€/.test(iii));
  ok('...ούτε όφελος', !/άτοκ|επιδότ/.test(iii));
}
ok('ο χάρτης της Νόας ξέρει ότι το ΙΙΙ είναι στο Δάνειο',
  /ΙΙΙ/.test(NAV_MAP.find(n => n.id === 'loan')?.what ?? ''));

if (fail.length) { console.error(`\n✗ spitiMou3: ${fail.length} αποτυχίες\n`); for (const f of fail) console.error('  ' + f); process.exit(1); }
console.log(`✓ spitiMou3: ${pass} έλεγχοι πέρασαν`);
