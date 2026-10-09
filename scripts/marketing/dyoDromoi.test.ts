// npx tsx scripts/marketing/dyoDromoi.test.ts
//
// Το reel «Ίδιο διαμέρισμα, δύο δρόμοι» (scripts/marketing/reelDyoDromoi.ts): οι
// αυτοέλεγχοι των γεγονότων και τα κείμενα που βγαίνουν από αυτά, χωρίς περιηγητή
// και χωρίς βίντεο. Κάθε ενότητα είναι ένα εύρημα του ελέγχου της 09/10/2026.
import { dyoDromoiFacts } from './dyoDromoiFacts';
import { build } from './shorts/engine';
import { renderTexts } from './shorts/texts';
import { DYO_DROMOI } from './shorts/specs/ig-dyo-dromoi';
import { stories } from './storiesDyoDromoi';
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

console.log(`dyoDromoi: ${pass} πέρασαν, ${fail} απέτυχαν`);
if (fail) process.exit(1);
