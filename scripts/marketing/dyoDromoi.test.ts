// npx tsx scripts/marketing/dyoDromoi.test.ts
//
// Το reel «Ίδιο διαμέρισμα, δύο δρόμοι» (scripts/marketing/reelDyoDromoi.ts): οι
// αυτοέλεγχοι των γεγονότων και τα κείμενα που βγαίνουν από αυτά, χωρίς περιηγητή
// και χωρίς βίντεο. Κάθε ενότητα είναι ένα εύρημα του ελέγχου της 09/10/2026.
import { dyoDromoiFacts } from './dyoDromoiFacts';
import { build } from './shorts/engine';
import { renderTexts } from './shorts/texts';
import { DYO_DROMOI } from './shorts/specs/ig-dyo-dromoi';
import { stories, assertDigitsFromFacts } from './storiesDyoDromoi';
import { fact, type Facts } from './shorts/kit';
import { svlInput } from './seiresData';
import { marginalRate, municipalAccommodationTax, isMunicipalTaxExempt, RENTAL_TAX_BRACKETS_2026 as B } from '../../lib/billing/greekTax';
import { PRESUMPTIVE_DEDUCTION_RATE as PRES } from '../../lib/billing/presumptive';
import { compareShortVsLong } from '../../lib/tools/shortVsLong';
import { fe } from '../../lib/core/format';

let pass = 0, fail = 0;
function ok(name: string, cond: boolean) { if (cond) { pass++; } else { fail++; console.error(`✗ ${name}`); } }
const throwsWith = (fn: () => unknown, re: RegExp) => { try { fn(); return false; } catch (e) { return re.test(e instanceof Error ? e.message : String(e)); } };

const DATE = DYO_DROMOI.date;
const f = dyoDromoiFacts(DATE);
const t = (id: string) => { const x = f[id]; if (!x) throw new Error(`λείπει το γεγονός ${id}`); return x.text; };

// ═══ 1 · ΤΟ ΝΕΟ ΕΝΟΙΚΙΟ ΜΠΑΙΝΕΙ ΠΑΝΩ ΣΤΑ ΑΛΛΑ, ΔΕΝ ΦΟΡΟΛΟΓΕΙΤΑΙ ΟΛΟ ΣΤΟΝ ΤΕΛΙΚΟ ΟΡΙΑΚΟ ═══
// Η λεζάντα έλεγε «σε έχουν ήδη ανεβάσει κλιμάκιο… κάθε νέο ευρώ του ενοικιαστή πάει στο
// 25%», ενώ τα άλλα ενοίκια του παραδείγματος μόνα τους μένουν στο πρώτο κλιμάκιο και
// από το νέο ενοίκιο μόνο ένα κομμάτι φτάνει στο 25%.
{
  const otherTaxable = Number(f['withEleni.otherGross'].value) * (1 - PRES);
  ok('τα άλλα ενοίκια μόνα τους μένουν κάτω από τον τελικό οριακό', marginalRate(otherTaxable) < Number(f['withEleni.margLong'].value));
  const caption = renderTexts(build(DYO_DROMOI)).igCaption;
  const para = caption.split('\n').find(l => l.includes(t('withEleni.otherGross')) && l.includes(t('withEleni.diff'))) ?? '';
  ok('η λεζάντα έχει παράγραφο για τα άλλα ενοίκια', para.length > 0);
  ok('η λεζάντα λέει τον φόρο που φέρνει ο ενοικιαστής', para.includes(t('withEleni.extra.long')));
  ok('η λεζάντα λέει τον φόρο που φέρνει το Airbnb', para.includes(t('withEleni.extra.short')));
  ok('η λεζάντα δεν βάζει κάθε νέο ευρώ στον τελικό οριακό', !/κάθε (νέο|επόμενο) ευρώ/u.test(para));
  ok('η λεζάντα δεν λέει ότι τα άλλα ενοίκια ανέβασαν ήδη κλιμάκιο', !/ήδη ανεβάσει/u.test(para));
  // Άλλα ενοίκια ήδη στο δεύτερο κλιμάκιο: ο ενοικιαστής δεν ανεβαίνει πια κλιμάκιο,
  // άρα το «ξεκινά… και ανεβαίνει» δεν στέκει και η παραγωγή πρέπει να σταματήσει.
  const inSecond = (B[1].from + 1) / (1 - PRES);
  ok('ο αυτοέλεγχος σταματά όταν το νέο ενοίκιο δεν ανεβαίνει κλιμάκιο',
    throwsWith(() => dyoDromoiFacts(DATE, { otherGross: inSecond }), /δεν ανεβαίνει κλιμάκιο/u));
}

// ═══ 2 · ΤΟ ΟΡΙΟ ΤΩΝ ΑΚΙΝΗΤΩΝ ΕΙΝΑΙ ΑΛΛΑΓΗ ΚΑΘΕΣΤΩΤΟΣ, ΟΧΙ ΕΝΑ ΤΕΛΟΣ ═══════════════
// Η κάρτα αποθήκευσης έγραφε το τέλος παρεπιδημούντων στον τζίρο του παραδείγματος
// «από το 3ο ακίνητο», με χρώμα κόστους. Η εφαρμογή λέει «Αλλάζει το καθεστώς, όχι μόνο
// ο συντελεστής»: έναρξη εργασιών για όλη τη δραστηριότητα, ΦΠΑ, χωρίς τεκμαρτή έκπτωση.
{
  const b = build(DYO_DROMOI);
  const s6 = stories(b.f).find(s => s.n === 6);
  const n = Number(f['mun3.from'].value);
  const fee = municipalAccommodationTax(compareShortVsLong(svlInput).short.gross, { individual: true, propertyCount: n });
  const txt = s6 ? `${s6.html} ${s6.alt}` : '';
  ok('η κάρτα έχει story 6', !!s6);
  ok('το όριο είναι το πλήθος του isMunicipalTaxExempt', isMunicipalTaxExempt({ individual: true, propertyCount: n - 1 }) && !isMunicipalTaxExempt({ individual: true, propertyCount: n }));
  ok('η κάρτα δεν γράφει το τέλος ως κόστος του ορίου', fee > 0 && !txt.includes(fe(fee)));
  ok('κανένα γεγονός με το ποσό του τέλους', !f['mun3.amount']);
  ok('η κάρτα λέει «έναρξη εργασιών»', /έναρξη εργασιών/iu.test(s6?.html ?? '') && /έναρξη εργασιών/iu.test(s6?.alt ?? ''));
  ok('η κάρτα λέει ΦΠΑ και τεκμαρτή έκπτωση', /ΦΠΑ/u.test(txt) && /χωρίς τεκμαρτή έκπτωση/u.test(txt));
  ok('η κάρτα λέει ποιον βαραίνει το τέλος', /το βαραίνει ο επισκέπτης/u.test(txt));
  ok('η πηγή του ορίου δεν το λέει «πρώτο ακίνητο»', !/πρώτο ακίνητο/u.test(f['mun3.from'].source));
}

// ═══ 3 · ΚΑΘΕ ΑΡΙΘΜΟΣ ΕΙΝΑΙ ΟΛΟΚΛΗΡΟ ΚΟΜΜΑΤΙ ΓΕΓΟΝΟΤΟΣ, ΟΧΙ ΥΠΟΣΥΜΒΟΛΟΣΕΙΡΑ ════════
// Η πύλη ρωτούσε `includes`: ένα «8€» γραμμένο με το χέρι περνούσε επειδή υπήρχε το
// γεγονός «1.318€». Τα γεγονότα εδώ είναι μικρά και πλαστά· οι αληθινές σελίδες
// περνούν από την ίδια πύλη μέσα στο stories() της ενότητας 2.
{
  const F: Facts = Object.fromEntries(([['a', '1.318€'], ['b', '25%'], ['c', '3ο'], ['d', '600,25€'], ['e', '37,55€'], ['g', '31/12/2026']] as const)
    .map(([id, text]) => [id, fact(id, text, text, 'δοκιμή')]));
  const gate = (html: string) => { try { assertDigitsFromFacts('δοκιμή', html, F); return true; } catch { return false; } };
  ok('«8€» δεν περνά επειδή υπάρχει «1.318€»', !gate('<p>ΤΑΚΚ 8€ τη νύχτα</p>'));
  ok('«1.31» δεν περνά επειδή υπάρχει «1.318€»', !gate('<p>1.31 τη νύχτα</p>'));
  ok('«5%» δεν περνά επειδή υπάρχει «25%»', !gate('<p>τεκμαρτή έκπτωση 5%</p>'));
  ok('«3» δεν περνά επειδή υπάρχει «3ο»', !gate('<p>από 3 ακίνητα</p>'));
  ok('«60» δεν περνά επειδή υπάρχει «600,25€»', !gate('<p>έως 60 ημέρες</p>'));
  ok('«0€» δεν περνά μέσα σε data-of άλλου ποσού', !gate('<p><b data-of="e">0€</b></p>'));
  ok('«7,55€» δεν περνά μέσα σε data-of του «37,55€»', !gate('<p><b data-of="e">7,55€</b></p>'));
  ok('ολόκληρο ποσό περνά', gate('<p>1.318€ και 25% και το 3ο</p>'));
  ok('ποσό χωρισμένο από το € σε δύο στοιχεία περνά', gate('<p><b>37,55</b><small>€</small></p>'));
  ok('ολόκληρο ποσό μέσα στο δικό του data-of περνά', gate('<p><b data-of="e">37,55€</b></p>'));
  ok('ημερομηνία γεγονότος με τελεία στο τέλος περνά', gate('<p>Λήγει 31/12/2026.</p>'));
}

// ═══ 4 · Η ΑΝΟΧΗ ΤΩΝ ΑΥΤΟΕΛΕΓΧΩΝ ΚΑΛΥΠΤΕΙ ΤΙΣ ΣΤΡΟΓΓΥΛΕΥΣΕΙΣ ΠΟΥ ΣΥΓΚΡΙΝΕΙ ═══════════
// Δώδεκα μήνες στρογγυλεμένοι σε λεπτά απέχουν ως 0,06€ από το σύνολο· η ανοχή ήταν
// 0,02€ και μια προμήθεια 3% ή 17% (όλα τα άλλα όπως στον υπολογιστή) σταματούσε την
// παραγωγή με «Οι μήνες δεν αθροίζουν», ενώ αθροίζουν ακριβώς. Και ένα ποσό
// στρογγυλεμένο σε λεπτά απέναντι στο ακριβές του έπεφτε στο 0,005000000000109 με τιμή
// νύχτας 70€: η παραγωγή σταματούσε με λάθος διάγνωση πριν φτάσει στον αληθινό έλεγχο.
{
  const facts = (o: Partial<typeof svlInput>) => () => dyoDromoiFacts(DATE, { input: { ...svlInput, ...o } });
  const passes = (fn: () => unknown) => { try { fn(); return true; } catch (e) { console.error(`   ${e instanceof Error ? e.message : e}`); return false; } };
  for (const fee of [3, 17]) {
    ok(`προμήθεια ${fee}%: οι αυτοέλεγχοι περνούν`, passes(facts({ platformFeePct: fee })));
    const g = (() => { try { return facts({ platformFeePct: fee })(); } catch { return null; } })();
    const S = compareShortVsLong({ ...svlInput, platformFeePct: fee }).short;
    ok(`προμήθεια ${fee}%: το σύνολο της χρονιάς είναι της shortTermSide`, !!g && Number(g['cumCross.decShort'].value) === Math.round((S.gross - S.platformFee - S.running) * 100) / 100);
  }
  ok('τιμή νύχτας 70€: σταματά στον αληθινό έλεγχο, όχι στη στρογγύλευση',
    throwsWith(facts({ nightlyPrice: 70 }), /δεν μικραίνει/u));
}

console.log(`dyoDromoi: ${pass} πέρασαν, ${fail} απέτυχαν`);
if (fail) process.exit(1);
