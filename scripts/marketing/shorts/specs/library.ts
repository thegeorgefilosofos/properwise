// ═══════════════════════════════════════════════════════════════════════════
// Η ΒΙΒΛΙΟΘΗΚΗ ΣΕ ΜΙΑ ΣΕΛΙΔΑ (ΔΕΝ ΔΗΜΟΣΙΕΥΕΤΑΙ)
// ─────────────────────────────────────────────────────────────────────────
// Οι σκηνές που δεν χρησιμοποιούν τα δύο shorts της 08/10 (οι σκηνές του
// reelKathara γενικευμένες και ο χάρτης) περνούν από τους ίδιους ελέγχους
// με αυτή την προδιαγραφή:
//   npx tsx scripts/marketing/shorts/render.ts library --stills --audit --fast
// Τα ποσά είναι του ακινήτου επίδειξης (rentFacts.ts), όπως στο reelKathara.
// ═══════════════════════════════════════════════════════════════════════════
import type { ShortSpec } from '../spec';
import { fact, type Facts } from '../kit';
import { hookBar, tileGrid, waterfall, slab, calcCard, mapPins, endCard } from '../scenes';
import { GROSS, TAX, ENFIA, OTHER, NET, P_TAX, P_ENFIA, P_OTHER, P_NET, SEG, eur, S } from '../../rentFacts';
import { propertyYield } from '../../../../lib/tools/apodosi';
import { DEMO_PROPERTY } from '../../../../lib/demo/sample';
import { SHORT_TERM } from '../../../../lib/market/greekMarket';
import { fn } from '../../../../lib/core/format';

const SRC = 'scripts/marketing/rentFacts.ts (incomeStatement του ακινήτου επίδειξης)';
function libraryFacts(): Facts {
  const f: Facts = {};
  const put = (id: string, v: number, text: string, src = SRC) => { f[id] = fact(id, v, text, src, { kind: 'money' }); };
  put('gross', GROSS, eur(GROSS)); put('tax', TAX, eur(TAX)); put('enfia', ENFIA, eur(ENFIA)); put('other', OTHER, eur(OTHER)); put('net', NET, eur(NET));
  put('pTax', P_TAX, `${P_TAX}€`); put('pEnfia', P_ENFIA, `${P_ENFIA}€`); put('pOther', P_OTHER, `${P_OTHER}€`); put('pNet', P_NET, `${P_NET}€`);
  put('unit', P_TAX + P_ENFIA + P_OTHER + P_NET, `${P_TAX + P_ENFIA + P_OTHER + P_NET}€`);
  f.year = fact('year', S.year, String(S.year), SRC, { kind: 'date' });
  const monthly = DEMO_PROPERTY.monthlyRent, months = 12;
  const y = propertyYield({ value: 0, monthlyRent: monthly, monthsRented: months, enfia: ENFIA, expenses: OTHER, otherRentalIncome: 0, year: S.year, viaBank: true });
  const SY = 'lib/tools/apodosi.ts (propertyYield), ίδια με τον υπολογιστή του site';
  put('cMonthly', monthly, `${fn(monthly)}€`, SY); put('cMonths', months, fn(months), SY); put('cEnfia', ENFIA, eur(ENFIA), SY); put('cOther', OTHER, eur(OTHER), SY); put('cNet', y.net, eur(y.net), SY);
  return f;
}
const PIN: Record<string, string> = { ath_center: 'Αθήνα', thess: 'Θεσσαλονίκη', crete: 'Ηράκλειο', rhodes: 'Ρόδος', mykonos_santorini: 'Μύκονος', paros_naxos: 'Πάρος' };

export const LIBRARY: ShortSpec = {
  id: 'library-preview', date: '2026-10-07', slot: '00:00', series: 'makro',
  title: 'Η βιβλιοθήκη σκηνών', hook: 'Πού πήγαν τα ενοίκια;', protagonist: 'Το ακίνητο επίδειξης της εφαρμογής.',
  cta: { path: '/kathari-apodosi', label: 'Ο υπολογιστής καθαρής απόδοσης.' }, utm: { campaign: 'library-preview' },
  facts: () => libraryFacts(),
  note: 'Παράδειγμα με δεδομένα επίδειξης',
  hooks: [{ name: 'Μπάρα', why: 'Προεπισκόπηση της βιβλιοθήκης.', scene: hookBar({
    beats: 14, arc: 'hook', story: 'Η μπάρα του ενοικίου σπάει στα τέσσερα.', cue: 'Κλικ ανά κομμάτι.',
    eyebrow: 'ΠΑΡΑΔΕΙΓΜΑ', title: ['**{gross}** ενοίκια.', 'Πού πήγαν;'],
    parts: [{ label: 'Φόρος', value: 'tax', color: SEG.tax }, { label: 'ΕΝΦΙΑ', value: 'enfia', color: SEG.enfia }, { label: 'Έξοδα', value: 'other', color: SEG.other }, { label: 'Καθαρά', value: 'net', color: SEG.net }],
    question: 'Σου μένουν **{net}**.',
  }) }],
  pick: 0,
  rubric: { signals: [{ signal: 'hook', scene: 0, note: 'Η μπάρα.' }, { signal: 'revelation', scene: 3, note: 'Η πλάκα.' }, { signal: 'story', scene: 2, note: 'Ο καταρράκτης.' }, { signal: 'practical', scene: 4, note: 'Ο υπολογιστής.' }],
    score: 0, why: 'Προεπισκόπηση της βιβλιοθήκης, όχι short για δημοσίευση.' },
  scenes: [
    tileGrid({ beats: 12, arc: 'stakes', in: 'whip', story: 'Εκατό τετράγωνα.', cue: 'Κλικ.', eyebrow: 'ΑΠΟ ΚΑΘΕ {unit}', title: ['Εκατό τετράγωνα,', 'ένα για κάθε **ευρώ**.'],
      counts: [{ n: 'pTax', color: SEG.tax, label: 'Φόρος' }, { n: 'pEnfia', color: SEG.enfia, label: 'ΕΝΦΙΑ' }, { n: 'pOther', color: SEG.other, label: 'Έξοδα' }, { n: 'pNet', color: SEG.net, label: 'Καθαρά' }] }),
    waterfall({ beats: 12, arc: 'turn', in: 'rackFocus', story: 'Ο καταρράκτης.', cue: 'Νότες που κατεβαίνουν.', eyebrow: 'Ο ΛΟΓΑΡΙΑΣΜΟΣ', title: ['Από τα ενοίκια', '**στην τσέπη**.'],
      start: { label: 'Ενοίκια', value: 'gross' }, steps: [{ label: 'Φόρος', value: 'tax', color: SEG.tax }, { label: 'ΕΝΦΙΑ', value: 'enfia', color: SEG.enfia }, { label: 'Έξοδα', value: 'other', color: SEG.other }], end: { label: 'Καθαρά', value: 'net' } }),
    slab({ beats: 12, arc: 'payoff', in: 'cardFlip', story: 'Η πλάκα των εκατό.', cue: 'Κοφτές νότες.', eyebrow: 'ΤΟ ΑΠΟΤΕΛΕΣΜΑ', title: ['Από κάθε {unit},', 'σου μένουν **{pNet}**.'], unit: 'unit',
      parts: [{ label: 'Φόρος', value: 'pTax', color: SEG.tax }, { label: 'ΕΝΦΙΑ', value: 'pEnfia', color: SEG.enfia }, { label: 'Έξοδα', value: 'pOther', color: SEG.other }, { label: 'Σου μένουν', value: 'pNet', color: SEG.net }] }),
    calcCard({ beats: 12, arc: 'action', in: 'maskWipe', story: 'Ο υπολογιστής.', cue: 'Πλήκτρα.', eyebrow: 'ΤΟ ΔΙΚΟ ΣΟΥ ΑΚΙΝΗΤΟ', title: ['Τώρα με τα δικά', 'σου **νούμερα**.'], name: 'Υπολογιστής καθαρής απόδοσης',
      fields: [{ label: 'Μηνιαίο ενοίκιο', value: 'cMonthly' }, { label: 'Μήνες ενοικίασης', value: 'cMonths' }, { label: 'ΕΝΦΙΑ τον χρόνο', value: 'cEnfia' }, { label: 'Δαπάνες τον χρόνο', value: 'cOther' }],
      result: { label: 'Σου μένουν', value: 'cNet' }, path: '/kathari-apodosi' }),
    mapPins({ beats: 12, arc: 'action', in: 'splitSwap', story: 'Ο χάρτης.', cue: 'Νότες ανά πόλη.', eyebrow: 'ΒΡΑΧΥΧΡΟΝΙΑ', title: ['Πού δεν δίνεται', '**νέος ΑΜΑ**.'],
      pins: SHORT_TERM.filter(x => PIN[x.key]).map(x => ({ city: PIN[x.key], tag: x.redZone ? 'Χωρίς νέο ΑΜΑ' : undefined, hot: !!x.redZone })), caption: 'Κόκκινο: περιοχές χωρίς νέο ΑΜΑ για βραχυχρόνια.' }),
    endCard({ beats: 14, arc: 'loop', in: 'lightLeak', story: 'Τέλος.', cue: 'Καμπάνες.', title: ['Υπολόγισε τα', '**δικά σου**.'], path: '/kathari-apodosi', action: 'Ενοίκιο, μήνες, ΕΝΦΙΑ και δαπάνες.' }),
  ],
  cover: 0,
  texts: {
    youtube: { title: 'Βιβλιοθήκη σκηνών', description: 'Προεπισκόπηση.', tags: ['PROPERWISE'] },
    instagram: { caption: 'Προεπισκόπηση.', alt: 'Προεπισκόπηση της βιβλιοθήκης σκηνών.', hashtags: ['PROPERWISE'] },
    tiktok: { caption: 'Προεπισκόπηση.', hashtags: ['PROPERWISE'] },
    pinned: 'Προεπισκόπηση.',
  },
};
