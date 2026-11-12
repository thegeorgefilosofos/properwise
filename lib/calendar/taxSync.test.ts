// npx tsx lib/calendar/taxSync.test.ts
//
// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΠΡΟΘΕΣΜΙΕΣ ΜΠΑΙΝΟΥΝ ΜΟΝΕΣ ΤΟΥΣ: ΧΩΡΙΣ ΔΙΠΛΑ, ΧΩΡΙΣ ΝΑ ΣΒΗΝΟΥΝ ΤΟΝ ΧΡΗΣΤΗ
// ─────────────────────────────────────────────────────────────────────────
// «Σήμερα» είναι 05.10.2026. Ο συγχρονισμός τρέχει πάνω σε βάση στη μνήμη που
// κρατά και το μοναδικό κλειδί `calendar_events_tax_once`, όπως η αληθινή.
// Ρωτά: τρέχει δύο φορές και δεν αλλάζει τίποτα; δύο μαζί και δεν διπλογράφει;
// κρατά ό,τι μετακίνησε ή πλήρωσε ο χρήστης; φέρνει τις μηνιαίες της
// βραχυχρόνιας και τις παίρνει πίσω όταν το ακίνητο αλλάξει; κλείνει τον ΕΝΦΙΑ
// σε όλα τα ακίνητα του ίδιου ανθρώπου και φτάνει μία φορά στις ειδοποιήσεις;
// ═══════════════════════════════════════════════════════════════════════════
import type { SupabaseClient } from '@supabase/supabase-js';
import { syncOwnerTaxDeadlines, syncAllTaxDeadlines, planTaxSync, contentHash, contentEdited, isPersonLevel } from './taxSync';
import { oneTaxCopy } from './taxOnce';
import { deadlineItems } from './deadlines';
import { taxEventsToWrite } from '@/lib/facts/deadlines';
import { ENFIA_FEWER_HINT } from '@/lib/tax/greekTaxCalendar';
import { applyKind, normalizeScannedDoc, planDocSave, amountFromInput, kindOf, type ScannedDoc } from '@/lib/billing/documents';
import { archiveInputFrom, archivePayload } from '@/app/dashboard/components/scanDoc';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra?: unknown) => {
  if (cond) pass++;
  else { fail++; console.error(`✗ ${name}`, extra ?? ''); }
};

// ── Η ΒΑΣΗ ΣΤΗ ΜΝΗΜΗ ───────────────────────────────────────────────────────
type Row = Record<string, unknown>;
interface Tables { [t: string]: Row[] }

function fakeDb(tables: Tables) {
  let seq = 0;
  const uniqueTax = (t: string, r: Row, rows: Row[]) =>
    t === 'calendar_events' && String(r.source ?? '').startsWith('tax:')
    && rows.some(x => x.property_id === r.property_id && x.source === r.source);

  function from(t: string) {
    const rows = (tables[t] ||= []);
    const filters: ((r: Row) => boolean)[] = [];
    let op: 'select' | 'insert' | 'update' | 'delete' = 'select';
    let payload: Row | Row[] | null = null;
    let single = false;
    const q = {
      select() { return q; },
      eq(c: string, v: unknown) { filters.push(r => r[c] === v); return q; },
      in(c: string, v: unknown[]) { filters.push(r => v.includes(r[c])); return q; },
      like(c: string, p: string) { const pre = p.replace(/%$/, ''); filters.push(r => String(r[c] ?? '').startsWith(pre)); return q; },
      ilike(c: string, p: string) { const pre = p.replace(/%$/, '').toLowerCase(); filters.push(r => String(r[c] ?? '').toLowerCase().startsWith(pre)); return q; },
      maybeSingle() { single = true; return q; },
      gt(c: string, v: string) { filters.push(r => String(r[c]) > v); return q; },
      order() { return q; },
      limit() { return q; },
      insert(v: Row | Row[]) { op = 'insert'; payload = v; return q; },
      update(v: Row) { op = 'update'; payload = v; return q; },
      delete() { op = 'delete'; return q; },
      then(res: (v: { data: unknown; error: { code?: string; message?: string } | null }) => unknown) {
        return Promise.resolve().then(() => {
          // Πίνακας στο `__fail`: η ανάγνωση αποτυγχάνει, όπως ένα 500 του PostgREST.
          if ((tables.__fail as unknown as string[] | undefined)?.includes(t)) return res({ data: null, error: { code: '500', message: 'boom' } });
          const match = (r: Row) => filters.every(f => f(r));
          if (op === 'insert') {
            const list = Array.isArray(payload) ? payload : [payload as Row];
            // Ολη η παρτίδα ή τίποτα, όπως μία εντολή INSERT.
            const staged: Row[] = [];
            for (const r of list) {
              if (uniqueTax(t, r, [...rows, ...staged])) return res({ data: null, error: { code: '23505', message: 'duplicate key' } });
              staged.push({ id: `e${String(++seq).padStart(4, '0')}`, ...r });
            }
            rows.push(...staged);
            return res({ data: null, error: null });
          }
          if (op === 'update') { for (const r of rows.filter(match)) Object.assign(r, payload); return res({ data: null, error: null }); }
          if (op === 'delete') { tables[t] = rows.filter(r => !match(r)); return res({ data: null, error: null }); }
          const found = rows.filter(match).map(r => ({ ...r }));
          return res({ data: single ? (found[0] ?? null) : found, error: null });
        });
      },
    };
    return q;
  }
  // ΣΗΜ.: το `delete` αντικαθιστά τον πίνακα· το `from` τον ξαναδιαβάζει κάθε φορά.
  return { db: { from: (t: string) => from(t) } as unknown as SupabaseClient, tables };
}

const TODAY = '2026-10-05';
const OWNER = 'owner-1';
const prop = (id: string, status_detail: string, rental_mode: string | null, extra: Row = {}) =>
  ({ id, user_id: OWNER, status_detail, rental_mode, ...extra });
const taxRows = (tables: Tables, propertyId?: string) =>
  (tables.calendar_events || []).filter(r => String(r.source).startsWith('tax:') && (!propertyId || r.property_id === propertyId));
const bySrc = (tables: Tables, propertyId: string, src: string) =>
  taxRows(tables, propertyId).find(r => r.source === src) as Row | undefined;

const EIGHTH = 'tax:enfia-instalment-2026-8';
const INCOME_2026 = 'tax:income-decl-2026'; // 15.07.2026: πέρασε
const STR_NOV = 'tax:str-registry-2026-11';

(async () => {
  // ── 1. ΜΙΑ ΦΟΡΑ ΓΡΑΦΕΙ, ΤΗ ΔΕΥΤΕΡΗ ΔΕΝ ΑΛΛΑΖΕΙ ΤΙΠΟΤΑ ───────────────────────
  {
    const { db, tables } = fakeDb({ user_properties: [prop('p1', 'rented', 'long_term')], calendar_events: [] });
    const first = await syncOwnerTaxDeadlines(db, OWNER, { today: TODAY });
    const expected = taxEventsToWrite(TODAY, 'long_term', []).length;
    ok('πρώτο πέρασμα: χωρίς σφάλμα', first.error === null, first.error);
    ok('πρώτο πέρασμα: γράφει όσα λέει η μηχανή', first.inserted === expected && taxRows(tables).length === expected, { got: first.inserted, expected });
    ok('η 8η δόση ΕΝΦΙΑ μπαίνει χωρίς κουμπί', !!bySrc(tables, 'p1', EIGHTH));
    ok('περασμένη προθεσμία δεν γεννιέται', !bySrc(tables, 'p1', INCOME_2026));
    ok('όλες εκκρεμείς, με αποτύπωμα', taxRows(tables).every(r => r.status === 'pending' && /^[0-9a-f]{8}\.pending$/.test(String(r.auto_hash))));
    ok('οι γραμμές ανήκουν στον ιδιοκτήτη', taxRows(tables).every(r => r.user_id === OWNER));
    ok('το ακίνητο έχει τόσες προθεσμίες', first.totals.p1 === expected);

    const again = await syncOwnerTaxDeadlines(db, OWNER, { today: TODAY });
    ok('δεύτερο πέρασμα: μηδέν αλλαγές', again.inserted === 0 && again.updated === 0 && again.removed === 0, again);
    ok('δεύτερο πέρασμα: ίδιο πλήθος', taxRows(tables).length === expected);
  }

  // ── 2. ΔΥΟ ΓΡΑΦΕΙΣ ΜΑΖΙ (καρτέλα + πρωινό πρόγραμμα): ΚΑΝΕΝΑ ΔΙΠΛΟ ──────────
  {
    const { db, tables } = fakeDb({ user_properties: [prop('p1', 'rented', 'long_term')], calendar_events: [] });
    const [a, b] = await Promise.all([
      syncOwnerTaxDeadlines(db, OWNER, { today: TODAY }),
      syncOwnerTaxDeadlines(db, OWNER, { today: TODAY }),
    ]);
    const sources = taxRows(tables).map(r => r.source);
    ok('ταυτόχρονα: κανένα σφάλμα', a.error === null && b.error === null, [a.error, b.error]);
    ok('ταυτόχρονα: καμία προθεσμία δύο φορές', new Set(sources).size === sources.length, sources.length);
    ok('ταυτόχρονα: καμία δεν λείπει', sources.length === taxEventsToWrite(TODAY, 'long_term', []).length);
  }

  // ── 3. Ο,ΤΙ ΑΛΛΑΞΕ Ο ΧΡΗΣΤΗΣ ΜΕΝΕΙ ─────────────────────────────────────────
  {
    const { db, tables } = fakeDb({ user_properties: [prop('p1', 'rented', 'long_term')], calendar_events: [] });
    await syncOwnerTaxDeadlines(db, OWNER, { today: TODAY });
    const moved = bySrc(tables, 'p1', EIGHTH)!;
    moved.event_date = '2026-10-20'; moved.notes = 'Πληρώνω με πάγια εντολή.';
    const paid = bySrc(tables, 'p1', 'tax:enfia-instalment-2026-9')!;
    paid.status = 'paid';
    const res = await syncOwnerTaxDeadlines(db, OWNER, { today: TODAY });
    const m2 = bySrc(tables, 'p1', EIGHTH)!;
    ok('μετακινημένη προθεσμία: η ημερομηνία του χρήστη μένει', m2.event_date === '2026-10-20');
    ok('μετακινημένη προθεσμία: η σημείωση του χρήστη μένει', m2.notes === 'Πληρώνω με πάγια εντολή.');
    ok('μετακινημένη προθεσμία: διαβάζεται ως αλλαγή χρήστη', contentEdited(m2 as never));
    ok('πληρωμένη μένει πληρωμένη', bySrc(tables, 'p1', 'tax:enfia-instalment-2026-9')!.status === 'paid');
    ok('καμία διαγραφή, κανένα διπλό', res.removed === 0 && res.inserted === 0);

    // Η μηχανή άλλαξε ημερομηνία (π.χ. βγήκε η απόφαση του έτους): ανέγγιχτη
    // γραμμή ακολουθεί. Προσομοίωση: η γραμμή έχει την ΠΑΛΙΑ τιμή της μηχανής.
    const tenth = bySrc(tables, 'p1', 'tax:enfia-instalment-2026-10')!;
    const engineDate = tenth.event_date;
    tenth.event_date = '2026-12-01';
    tenth.auto_hash = `${contentHash(tenth as never)}.pending`;
    await syncOwnerTaxDeadlines(db, OWNER, { today: TODAY });
    ok('αλλαγή της μηχανής φτάνει σε ανέγγιχτη γραμμή', bySrc(tables, 'p1', 'tax:enfia-instalment-2026-10')!.event_date === engineDate);
  }

  // ── 4. ΓΡΑΜΜΕΣ ΤΟΥ ΠΑΛΙΟΥ ΣΥΓΧΡΟΝΙΣΜΟΥ: ΥΙΟΘΕΤΟΥΝΤΑΙ, ΔΕΝ ΔΙΠΛΑΣΙΑΖΟΝΤΑΙ ──────
  {
    const legacy = taxEventsToWrite(TODAY, 'long_term', []).slice(0, 3).map((d, i) => ({
      id: `old${i}`, property_id: 'p1', user_id: OWNER, ...d, category: 'contract', auto_hash: null,
    }));
    const { db, tables } = fakeDb({ user_properties: [prop('p1', 'rented', 'long_term')], calendar_events: legacy as Row[] });
    const res = await syncOwnerTaxDeadlines(db, OWNER, { today: TODAY });
    const sources = taxRows(tables).map(r => r.source);
    ok('παλιές γραμμές: καμία δεύτερη φορά', new Set(sources).size === sources.length);
    ok('παλιές γραμμές: ενημερώθηκαν στη σωστή κατηγορία', taxRows(tables).filter(r => String(r.id).startsWith('old')).every(r => r.category === 'tax' && !!r.auto_hash));
    ok('παλιές γραμμές: κρατούν το αναγνωριστικό τους', res.updated === 3 && taxRows(tables).filter(r => String(r.id).startsWith('old')).length === 3);
  }

  // ── 5. ΒΡΑΧΥΧΡΟΝΙΑ: ΟΙ ΜΗΝΙΑΙΕΣ ΜΠΑΙΝΟΥΝ ΚΑΙ ΦΕΥΓΟΥΝ ΜΕ ΤΗΝ ΚΑΤΑΣΤΑΣΗ ────────
  {
    const { db, tables } = fakeDb({ user_properties: [prop('p1', 'seasonal', 'short_term')], calendar_events: [] });
    await syncOwnerTaxDeadlines(db, OWNER, { today: TODAY });
    const monthly = taxRows(tables, 'p1').filter(r => /^tax:str-/.test(String(r.source)));
    ok('βραχυχρόνια: μηνιαία δήλωση Νοεμβρίου', !!bySrc(tables, 'p1', STR_NOV));
    ok('βραχυχρόνια: δήλωση και τέλος κλιματικής κάθε μήνα ως τον Μάρτιο', monthly.length >= 12, monthly.length);
    ok('βραχυχρόνια: καμία μηνιαία στο παρελθόν', monthly.every(r => String(r.event_date) >= TODAY));

    // Ο χρήστης σημείωσε μία πληρωμένη και μετακίνησε μία άλλη· μετά το ακίνητο
    // γίνεται μακροχρόνιο.
    bySrc(tables, 'p1', 'tax:str-climate-fee-2026-10')!.status = 'paid';
    bySrc(tables, 'p1', 'tax:str-registry-2026-12')!.notes = 'Μαζί με τον λογιστή.';
    tables.user_properties[0].status_detail = 'rented'; tables.user_properties[0].rental_mode = 'long_term';
    const res = await syncOwnerTaxDeadlines(db, OWNER, { today: TODAY });
    const left = taxRows(tables, 'p1').filter(r => /^tax:str-/.test(String(r.source))).map(r => r.source).sort();
    ok('μακροχρόνια πλέον: οι ανέγγιχτες μηνιαίες φεύγουν', res.removed === monthly.length - 2, { removed: res.removed, monthly: monthly.length });
    ok('μακροχρόνια πλέον: πληρωμένη και πειραγμένη μένουν', left.join() === ['tax:str-climate-fee-2026-10', 'tax:str-registry-2026-12'].join(), left);
    ok('μακροχρόνια πλέον: ο ΕΝΦΙΑ μένει', !!bySrc(tables, 'p1', EIGHTH));
  }

  // ── 6. ΔΥΟ ΑΚΙΝΗΤΑ, ΕΝΑΣ ΑΝΘΡΩΠΟΣ (και συνιδιοκτησία 50%) ───────────────────
  {
    const { db, tables } = fakeDb({
      user_properties: [
        prop('pA', 'seasonal', 'short_term', { ownership: 100 }),
        prop('pB', 'seasonal', 'short_term', { ownership: 50, co_owners: [{ name: 'Αδελφή', pct: 50 }] }),
      ],
      calendar_events: [],
    });
    await syncOwnerTaxDeadlines(db, OWNER, { today: TODAY });
    ok('συνιδιοκτησία 50%: ίδιες προθεσμίες με το 100%', taxRows(tables, 'pA').length === taxRows(tables, 'pB').length);
    ok('οι συνιδιοκτήτες της καρτέλας δεν παίρνουν γραμμές', taxRows(tables).every(r => r.user_id === OWNER));
    ok('ο ΕΝΦΙΑ είναι του ανθρώπου, όχι του ακινήτου', isPersonLevel(EIGHTH) && !isPersonLevel(STR_NOV));
    // Ο φόρος εισοδήματος είναι ένας ανά ΑΦΜ, ας βγαίνει μόνο σε νοικιασμένο ακίνητο.
    ok('η δόση φόρου εισοδήματος είναι του ανθρώπου', isPersonLevel('tax:income-instalment-2026-5'));

    // Πλήρωσε την 8η δόση από το ακίνητο Α και τη δήλωση Νοεμβρίου του Α.
    bySrc(tables, 'pA', EIGHTH)!.status = 'paid';
    bySrc(tables, 'pA', STR_NOV)!.status = 'paid';
    await syncOwnerTaxDeadlines(db, OWNER, { today: TODAY });
    ok('ΕΝΦΙΑ πληρωμένος στο Α κλείνει και στο Β', bySrc(tables, 'pB', EIGHTH)!.status === 'paid');
    ok('η μηνιαία του Α δεν κλείνει τη μηνιαία του Β', bySrc(tables, 'pB', STR_NOV)!.status === 'pending');

    // Ο χρήστης ξανανοίγει τη δόση στο Β: δεν ξανακλείνει μόνη της.
    bySrc(tables, 'pB', EIGHTH)!.status = 'pending';
    await syncOwnerTaxDeadlines(db, OWNER, { today: TODAY });
    ok('ξανανοιγμένη από τον χρήστη μένει ανοιχτή', bySrc(tables, 'pB', EIGHTH)!.status === 'pending');

    // ΜΙΑ φορά στις ειδοποιήσεις: συνδρομή/push και email.
    const events = taxRows(tables).map(r => ({ ...r, id: String(r.id) })) as never[];
    const items = deadlineItems({
      properties: [{ id: 'pA', name: 'Πλάκα' }, { id: 'pB', name: 'Νάξος' }],
      events, tasks: [], bills: [], rent: [], from: TODAY, to: '2027-04-01',
    });
    const ninth = items.filter(i => i.title.startsWith('ΕΝΦΙΑ, 9η δόση'));
    ok('συνδρομή: η 9η δόση μία φορά', ninth.length === 1, ninth);
    ok('συνδρομή: χωρίς όνομα ακινήτου, γιατί είναι ενός εκκαθαριστικού', ninth[0]?.title === 'ΕΝΦΙΑ, 9η δόση');
    const eighth = items.filter(i => i.title.startsWith('ΕΝΦΙΑ, 8η δόση'));
    ok('συνδρομή: η 8η (ανοιχτή μόνο στο Β) μία φορά', eighth.length === 1);
    const pending = taxRows(tables).filter(r => r.status === 'pending').map(r => ({ id: String(r.id), source: String(r.source) }));
    const mail = oneTaxCopy(pending).kept;
    ok('email: μία γραμμή ανά προθεσμία', new Set(mail.map(e => e.source)).size === mail.length);
  }

  // ── 7. ΤΟ ΠΡΩΙΝΟ ΠΕΡΑΣΜΑ: ΚΑΘΕ ΙΔΙΟΚΤΗΤΗΣ ΣΤΑ ΔΙΚΑ ΤΟΥ ──────────────────────
  {
    const { db, tables } = fakeDb({
      user_properties: [
        prop('p1', 'rented', 'long_term'),
        { id: 'q1', user_id: 'owner-2', status_detail: 'seasonal', rental_mode: 'short_term' },
      ],
      calendar_events: [],
    });
    const sweep = await syncAllTaxDeadlines(db, TODAY);
    ok('πρωί: δύο ιδιοκτήτες, κανένα σφάλμα', sweep.owners === 2 && sweep.failed === 0 && sweep.readError === null, sweep);
    ok('πρωί: κάθε γραμμή στον ιδιοκτήτη του ακινήτου της',
      taxRows(tables, 'p1').every(r => r.user_id === OWNER) && taxRows(tables, 'q1').every(r => r.user_id === 'owner-2'));
    const again = await syncAllTaxDeadlines(db, TODAY);
    ok('πρωί, δεύτερη φορά: τίποτα νέο', again.inserted === 0 && again.updated === 0 && again.removed === 0, again);
    // Τον Ιανουάριο μπαίνουν οι προθεσμίες του νέου ορίζοντα, χωρίς κουμπί.
    const jan = await syncAllTaxDeadlines(db, '2027-01-04');
    ok('Ιανουάριος: έρχονται οι νέες ημερομηνίες', jan.inserted > 0 && !!bySrc(tables, 'p1', 'tax:income-decl-2027'));
    ok('Ιανουάριος: οι περσινές μένουν ως ιστορικό', !!bySrc(tables, 'p1', EIGHTH));
  }

  // ── 7β. ΟΙ ΔΟΣΕΙΣ ΕΝΦΙΑ ΑΚΟΛΟΥΘΟΥΝ ΤΟ ΣΥΝΟΛΟ ΤΟΥ ΕΚΚΑΘΑΡΙΣΤΙΚΟΥ ─────────────
  // Ο κανόνας των 10€ (lib/tools/enfiaSchedule.ts). «Σήμερα» 1η Μαρτίου 2026,
  // πριν από την 1η δόση, ώστε να μετρηθούν ΟΛΕΣ οι υπενθυμίσεις του έτους.
  {
    const MARCH = '2026-03-01';
    const enfia2026 = (rows: Row[], pid = 'p1') => rows.filter(r => r.property_id === pid && /^tax:enfia-(first|instalment|last)-2026/.test(String(r.source)));
    const stmt = (pid: string, amount: number, year = 2026) =>
      ({ id: `d-${pid}-${amount}`, property_id: pid, user_id: OWNER, title: `ΕΝΦΙΑ ${year}`, amount, statement_total: true });

    const run = async (docs: Row[], extra: Tables = {}) => {
      const { db, tables } = fakeDb({
        user_properties: [prop('p1', 'rented', 'long_term'), prop('p2', 'rented', 'long_term')],
        billing_profiles: [{ user_id: OWNER, profile_type: 'individual' }],
        property_documents: docs, ...extra,
      });
      const r = await syncOwnerTaxDeadlines(db, OWNER, { today: MARCH });
      return { r, tables, db };
    };

    const a = await run([stmt('p1', 27.44)]);
    ok('ΕΝΦΙΑ 27,44€: δύο υπενθυμίσεις', enfia2026(a.tables.calendar_events).length === 2, enfia2026(a.tables.calendar_events).map(r => r.source));
    ok('ΕΝΦΙΑ 27,44€: η 2η λέγεται τελευταία', enfia2026(a.tables.calendar_events).some(r => r.title === 'ΕΝΦΙΑ, 2η και τελευταία δόση'));
    ok('ΕΝΦΙΑ 27,44€: ίδιο εκκαθαριστικό, ίδιο πλήθος και στο άλλο ακίνητο', enfia2026(a.tables.calendar_events, 'p2').length === 2);
    ok('ΕΝΦΙΑ γνωστό σύνολο: χωρίς τη σημείωση «λιγότερες»', enfia2026(a.tables.calendar_events).every(r => !String(r.notes).includes(ENFIA_FEWER_HINT)));

    const b = await run([stmt('p2', 67.2)]);
    ok('ΕΝΦΙΑ 67,20€: έξι υπενθυμίσεις', enfia2026(b.tables.calendar_events).length === 6, enfia2026(b.tables.calendar_events).length);

    // ΜΟΝΟ ΤΟ ΣΗΜΑΔΕΜΕΝΟ ΑΠΟ ΤΗ ΣΑΡΩΣΗ ΜΕΤΡΑ (έλεγχος 21/10/2026, εύρημα E). Ενα
    // έγγραφο που μετονομάστηκε «ΕΝΦΙΑ 2026» με ποσό γραμμένο στο χέρι (π.χ.
    // το μερίδιο ενός ακινήτου) δεν είναι σύνολο εκκαθαριστικού.
    const manual = await run([{ ...stmt('p1', 27.44), statement_total: false }]);
    ok('ΕΝΦΙΑ έγγραφο χωρίς σήμα συνόλου: δεν μετρά, δώδεκα', enfia2026(manual.tables.calendar_events).length === 12, enfia2026(manual.tables.calendar_events).length);

    const c = await run([]);
    const unknown = enfia2026(c.tables.calendar_events);
    ok('ΕΝΦΙΑ άγνωστο σύνολο: δώδεκα υπενθυμίσεις', unknown.length === 12, unknown.length);
    ok('ΕΝΦΙΑ άγνωστο σύνολο: η σημείωση το λέει', unknown.every(r => String(r.notes).includes(ENFIA_FEWER_HINT)));

    // Το σύνολο που έγραψε ο χρήστης μετρά όπως το σαρωμένο· δύο πηγές → το μεγαλύτερο.
    const typed = await run([], { bills_settings: [{ property_id: 'p2', user_id: OWNER, section: 'services', data: { enfiaStatementTotal: '27,44', enfiaStatementYear: '2026' } }] });
    ok('ΕΝΦΙΑ σύνολο από τον χρήστη: δύο υπενθυμίσεις', enfia2026(typed.tables.calendar_events).length === 2);
    const both = await run([stmt('p1', 67.2)], { bills_settings: [{ property_id: 'p2', user_id: OWNER, section: 'services', data: { enfiaStatementTotal: '27,44', enfiaStatementYear: '2026' } }] });
    ok('ΕΝΦΙΑ δύο σύνολα που διαφωνούν: μετρά το μεγαλύτερο', enfia2026(both.tables.calendar_events).length === 6);
    // ── ΕΚΚΑΘΑΡΙΣΤΙΚΟ ΦΟΡΟΥ ΕΙΣΟΔΗΜΑΤΟΣ ΧΩΡΙΣ ΦΟΡΟ: ΚΑΜΙΑ ΔΟΣΗ (12.11.2026) ──
    // Το σαρωμένο «Φόρος εισοδήματος 2025» με μηδέν (ή επιστροφή) σημαίνει ότι η
    // δήλωση 2026 δεν έχει δόσεις. Ο ίδιος φορολογούμενος σε όλα του τα ακίνητα.
    {
      const inc2026 = (rows: Row[], pid = 'p1') => rows.filter(r => r.property_id === pid && String(r.source).startsWith('tax:income-instalment-2026-'));
      const itx = (pid: string, amount: number | null, year = 2025) =>
        ({ id: `i-${pid}-${amount}-${year}`, property_id: pid, user_id: OWNER, title: `Φόρος εισοδήματος ${year}`, amount });
      const none = await run([]);
      ok('εισόδημα: χωρίς εκκαθαριστικό, οκτώ δόσεις', inc2026(none.tables.calendar_events).length === 8, inc2026(none.tables.calendar_events).length);
      const zero = await run([itx('p1', 0)]);
      ok('εισόδημα: εκκαθαριστικό με μηδέν, καμία δόση', inc2026(zero.tables.calendar_events).length === 0, inc2026(zero.tables.calendar_events).map(r => r.source));
      ok('εισόδημα: μηδέν, ούτε στο άλλο ακίνητο του ίδιου ΑΦΜ', inc2026(zero.tables.calendar_events, 'p2').length === 0);
      const refund = await run([itx('p2', -120)]);
      ok('εισόδημα: επιστροφή, καμία δόση', inc2026(refund.tables.calendar_events).length === 0);
      const owes = await run([itx('p1', 900)]);
      ok('εισόδημα: εκκαθαριστικό με φόρο, οκτώ δόσεις', inc2026(owes.tables.calendar_events).length === 8);
      const blank = await run([itx('p1', null)]);
      ok('εισόδημα: κενό ποσό δεν είναι μηδέν, οκτώ δόσεις', inc2026(blank.tables.calendar_events).length === 8);
      const other = await run([itx('p1', 0, 2024)]);
      ok('εισόδημα: μηδέν άλλου έτους δεν αγγίζει τη δήλωση 2026', inc2026(other.tables.calendar_events).length === 8);
      // Η ΠΡΑΓΜΑΤΙΚΗ ΔΙΑΔΡΟΜΗ ΤΗΣ ΣΑΡΩΣΗΣ, όχι γραμμή γραμμένη με το χέρι: ο
      // χρήστης γράφει «0» στη φόρμα, το σχέδιο αποθήκευσης και η γραμμή του
      // Αρχείου βγαίνουν από τις ίδιες συναρτήσεις με την εφαρμογή.
      const scanned = (typed: string) => {
        const base = applyKind({ doc_type: 'tax', tax_year: 2025, due_date: '2026-07-31' } as ScannedDoc, 'income_tax');
        const doc = normalizeScannedDoc({ ...base, amount: amountFromInput(typed, kindOf(base)) });
        const plan = planDocSave(doc, MARCH, { incomeSeries: true });
        const file = { name: 'ekkatharistiko.pdf', type: 'application/pdf', size: 1 } as File;
        return { id: `scan-${typed}`, ...archivePayload(archiveInputFrom(plan.archive!, file, 'p1', OWNER, plan.archive!.title), 'p/x.pdf') };
      };
      const scanZero = await run([scanned('0')]);
      ok('σάρωση με «0»: καμία δόση της δήλωσης 2026', inc2026(scanZero.tables.calendar_events).length === 0, inc2026(scanZero.tables.calendar_events).length);
      const scanRefund = await run([scanned('-75')]);
      ok('σάρωση με επιστροφή: καμία δόση', inc2026(scanRefund.tables.calendar_events).length === 0);
      const scanOwes = await run([scanned('640')]);
      ok('σάρωση με φόρο: οκτώ δόσεις', inc2026(scanOwes.tables.calendar_events).length === 8);
      ok('σάρωση σε νοικιασμένο: καμία δεύτερη «1η δόση» από τη σάρωση', !scanOwes.tables.calendar_events.some(r => String(r.title).includes('1η δόση') && !String(r.source).startsWith('tax:')));

      const mixed = await run([itx('p1', 0), itx('p2', 900)]);
      ok('εισόδημα: μηδέν και φόρος στον ίδιο ΑΦΜ, μένουν οι δόσεις', inc2026(mixed.tables.calendar_events).length === 8);
      // Γραμμένες ήδη, μετά σαρώνεται μηδέν: φεύγουν οι ανέγγιχτες, μένει η πληρωμένη.
      const later = await run([]);
      const paidOne = inc2026(later.tables.calendar_events).find(r => r.source === 'tax:income-instalment-2026-3')!;
      paidOne.status = 'paid';
      later.tables.property_documents.push(itx('p1', 0));
      await syncOwnerTaxDeadlines(later.db, OWNER, { today: MARCH });
      ok('εισόδημα: σαρώθηκε μηδέν, φεύγουν οι ανέγγιχτες, μένει η πληρωμένη',
        inc2026(later.tables.calendar_events).map(r => r.source).join() === 'tax:income-instalment-2026-3', inc2026(later.tables.calendar_events).map(r => r.source));
    }

    const stale = await run([], { bills_settings: [{ property_id: 'p1', user_id: OWNER, section: 'services', data: { enfiaStatementTotal: '27,44', enfiaStatementYear: '2025' } }] });
    ok('ΕΝΦΙΑ σύνολο άλλου έτους: δεν μετρά', enfia2026(stale.tables.calendar_events).length === 12);

    // ΣΥΜΦΙΛΙΩΣΗ. Δώδεκα γραμμένες, ο χρήστης άλλαξε την 5η και πλήρωσε την 9η·
    // μετά σαρώνει εκκαθαριστικό 27,44€ και ο συγχρονισμός τρέχει τον Οκτώβριο.
    const fifth = enfia2026(c.tables.calendar_events).find(r => r.source === 'tax:enfia-instalment-2026-5')!;
    fifth.title = 'ΕΝΦΙΑ 5η, από τον λογαριασμό της Ελένης';
    const ninth = enfia2026(c.tables.calendar_events).find(r => r.source === 'tax:enfia-instalment-2026-9')!;
    ninth.status = 'paid';
    c.tables.property_documents.push(stmt('p1', 27.44));
    const r1 = await syncOwnerTaxDeadlines(c.db, OWNER, { today: TODAY });
    const left = enfia2026(c.tables.calendar_events).map(r => String(r.source)).sort();
    // ΟΙ ΠΕΡΑΣΜΕΝΕΣ ΜΕΝΟΥΝ (εύρημα E). Φεύγουν μόνο οι μελλοντικές που περισσεύουν
    // (8η, 10η, 11η, τελευταία)· η 3η ως 7η έχουν περάσει στις 05/10/2026 και
    // ένα λάθος πλήθος δεν επιτρέπεται να σβήσει αληθινή απλήρωτη δόση.
    ok('συμφιλίωση: φεύγουν μόνο οι μελλοντικές που δεν υπάρχουν, ποτέ οι περασμένες', r1.error === null && left.join() === [
      'tax:enfia-first-2026', 'tax:enfia-instalment-2026-2', 'tax:enfia-instalment-2026-3', 'tax:enfia-instalment-2026-4',
      'tax:enfia-instalment-2026-5', 'tax:enfia-instalment-2026-6', 'tax:enfia-instalment-2026-7', 'tax:enfia-instalment-2026-9',
    ].join(), left);
    ok('συμφιλίωση: η γραμμή που άλλαξε ο χρήστης μένει ανέγγιχτη', fifth.title === 'ΕΝΦΙΑ 5η, από τον λογαριασμό της Ελένης');
    ok('συμφιλίωση: η πληρωμένη μένει πληρωμένη', ninth.status === 'paid');
    ok('συμφιλίωση: στο άλλο ακίνητο μένουν οι περασμένες, φεύγουν οι μελλοντικές', enfia2026(c.tables.calendar_events, 'p2').length === 7, enfia2026(c.tables.calendar_events, 'p2').length);
    const r2 = await syncOwnerTaxDeadlines(c.db, OWNER, { today: TODAY });
    ok('συμφιλίωση: δεύτερο πέρασμα δεν αλλάζει τίποτα και δεν ξαναγεννά', r2.inserted === 0 && r2.updated === 0 && r2.removed === 0
      && enfia2026(c.tables.calendar_events).length === 8, r2);
    const r3 = await syncOwnerTaxDeadlines(c.db, OWNER, { today: '2026-03-01' });
    // Καμία νέα γραμμή ΕΝΦΙΑ. Οι μόνες εισαγωγές είναι οι δόσεις φόρου
    // εισοδήματος Ιουλίου ως Σεπτεμβρίου: σβήστηκαν ως περασμένες στις 05/10 και
    // με «σήμερα» τον Μάρτιο είναι πάλι μελλοντικές (3 δόσεις × 2 ακίνητα).
    ok('συμφιλίωση: ούτε με «σήμερα» πριν από αυτές', r3.inserted === c.tables.calendar_events.filter(r => /^tax:income-instalment-2026-[123]$/.test(String(r.source))).length, r3);

    // Η ΔΟΣΗ ΠΟΥ ΛΗΓΕΙ ΣΗΜΕΡΑ ΜΕΝΕΙ (2ος έλεγχος, 21/10/2026). Δώδεκα γραμμένες,
    // μετά σύνολο 27,44€ (δύο δόσεις) και συγχρονισμός την ημέρα της 8ης.
    {
      const d = await run([]);
      const eighth = enfia2026(d.tables.calendar_events).find(r => r.source === 'tax:enfia-instalment-2026-8')!;
      const day8 = String(eighth.event_date).slice(0, 10);
      d.tables.property_documents.push(stmt('p1', 27.44));
      await syncOwnerTaxDeadlines(d.db, OWNER, { today: day8 });
      const kept = enfia2026(d.tables.calendar_events).map(r => String(r.source));
      ok('η δόση με ημερομηνία σήμερα δεν σβήνεται', kept.includes('tax:enfia-instalment-2026-8'), { day8, kept });
      ok('η επόμενη μελλοντική που περισσεύει σβήνεται', !kept.includes('tax:enfia-instalment-2026-9'), kept);
    }

    // ΑΝΑΓΝΩΣΗ ΠΟΥ ΑΠΕΤΥΧΕ: καμία γραφή, αλλιώς οι δώδεκα θα ξαναγεννιούνταν.
    (c.tables as Record<string, unknown>).__fail = ['property_documents'];
    const before = c.tables.calendar_events.length;
    const r4 = await syncOwnerTaxDeadlines(c.db, OWNER, { today: '2026-03-01' });
    ok('σφάλμα στο σύνολο: κανένα γράψιμο', r4.error !== null && r4.inserted === 0 && c.tables.calendar_events.length === before, r4);
    (c.tables as Record<string, unknown>).__fail = [];

    // Επαγγελματίας: κάθε καρτέλα «Ιδιοκτήτης» είναι άλλο εκκαθαριστικό.
    const pro = fakeDb({
      user_properties: [prop('p1', 'rented', 'long_term', { client_id: 'c1' }), prop('p2', 'rented', 'long_term', { client_id: 'c2' })],
      billing_profiles: [{ user_id: OWNER, profile_type: 'professional' }],
      clients: [{ id: 'c1', user_id: OWNER, type: 'owner' }, { id: 'c2', user_id: OWNER, type: 'owner' }],
      property_documents: [stmt('p1', 27.44)],
    });
    await syncOwnerTaxDeadlines(pro.db, OWNER, { today: '2026-03-01' });
    ok('επαγγελματίας: το σύνολο του ενός ιδιοκτήτη δεν αγγίζει τον άλλον',
      enfia2026(pro.tables.calendar_events, 'p1').length === 2 && enfia2026(pro.tables.calendar_events, 'p2').length === 12);

    // Χωρίς προφίλ (π.χ. μέλος ομάδας που δεν το βλέπει): κάθε ακίνητο μόνο του.
    const noProfile = await run([stmt('p1', 27.44)], { billing_profiles: [] });
    ok('χωρίς προφίλ: το σύνολο μένει στο ακίνητό του', enfia2026(noProfile.tables.calendar_events, 'p1').length === 2
      && enfia2026(noProfile.tables.calendar_events, 'p2').length === 12);
  }

  // ── 7β. ΠΕΡΑΣΜΕΝΗ ΔΟΣΗ ΦΟΡΟΥ ΕΙΣΟΔΗΜΑΤΟΣ ΔΕΝ ΜΕΝΕΙ ΑΝΟΙΧΤΗ (12.11.2026) ─────
  // Η εφαρμογή δεν ξέρει αν οφειλόταν· ανοιχτή θα γινόταν «Ληξιπρόθεσμο».
  {
    const NOV = '2026-11-12';
    const fresh = planTaxSync('2026-07-01', 'long_term', []);
    const rows = fresh.insert.map((d, i) => ({ id: `r${i}`, property_id: 'p1', ...d })) as unknown as Parameters<typeof planTaxSync>[2];
    const byId = new Map(rows.map(r => [r.id, r]));
    const idOf = (src: string) => rows.find(r => r.source === src)!.id;
    // Η 2η πληρωμένη από τον χρήστη (κατάσταση που άλλαξε μετά το αποτύπωμα).
    (byId.get(idOf('tax:income-instalment-2026-2')) as { status: string }).status = 'paid';
    const plan = planTaxSync(NOV, 'long_term', rows);
    const removed = new Set(plan.remove.map(id => byId.get(id)!.source));
    ok('περασμένες ανοιχτές δόσεις 1, 3, 4: σβήνονται', ['1', '3', '4'].every(k => removed.has(`tax:income-instalment-2026-${k}`)), [...removed]);
    ok('η πληρωμένη 2η μένει', !removed.has('tax:income-instalment-2026-2'));
    ok('οι μελλοντικές 5 ως 8 μένουν', ['5', '6', '7', '8'].every(k => !removed.has(`tax:income-instalment-2026-${k}`)));
    ok('περασμένη ΕΝΦΙΑ δεν σβήνεται (ιστορικό)', ![...removed].some(s => String(s).startsWith('tax:enfia-')));
    // Με εκκαθαριστικό χωρίς φόρο για το 2025: φεύγουν και οι μελλοντικές.
    const nil = planTaxSync(NOV, 'long_term', rows, new Map(), {}, {}, [2025]);
    const nilRemoved = new Set(nil.remove.map(id => byId.get(id)!.source));
    ok('εκκαθαριστικό χωρίς φόρο: φεύγουν και οι 5 ως 8', ['5', '6', '7', '8'].every(k => nilRemoved.has(`tax:income-instalment-2026-${k}`)));
    ok('εκκαθαριστικό χωρίς φόρο: καμία νέα δόση', !nil.insert.some(d => String(d.source).startsWith('tax:income-instalment-')));
  }

  // ── 8. ΤΟ ΣΧΕΔΙΟ ΧΩΡΙΣ ΒΑΣΗ ─────────────────────────────────────────────────
  {
    const plan = planTaxSync(TODAY, 'owner', []);
    ok('σχέδιο: άδειο ακίνητο, μόνο εισαγωγές', plan.update.length === 0 && plan.remove.length === 0 && plan.insert.length === plan.total);
    ok('σχέδιο: ιδιοχρησία χωρίς μηνιαίες', plan.insert.every(d => !String(d.source).startsWith('tax:str-')));
  }

  // ── 9. ΤΟ ΙΔΙΟ ΣΤΗΝ ΕΞΟΔΟ: oneTaxCopy ──────────────────────────────────────
  {
    const r = oneTaxCopy([
      { id: 'b', source: EIGHTH }, { id: 'x', source: 'manual' }, { id: 'a', source: EIGHTH }, { id: 'c', source: null },
    ]);
    ok('oneTaxCopy: μένει το μικρότερο αναγνωριστικό', r.kept.map(e => e.id).join() === 'x,a,c', r.kept);
    ok('oneTaxCopy: ξέρει ποια ήταν κοινά', r.shared.has(EIGHTH) && r.shared.size === 1);
  }

  console.log(`\ntaxSync: ${pass} ✓ · ${fail} ✗`);
  if (fail) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
