// npx tsx lib/property/peaExpiry.test.ts
//
// Οι υπενθυμίσεις λήξης του ΠΕΑ και η ειδοποίηση της μίσθωσης. Οι ημερομηνίες
// είναι γραμμένες με το χέρι επίτηδες: ο έλεγχος είναι ότι ο υπολογισμός δίνει
// αυτές τις ημέρες, όχι ότι ξαναϋπολογίζει τον εαυτό του.
import {
  PEA_EXPIRY_TITLE, PEA_REMINDER_DAYS, PEA_SOURCE_PREFIX, LEASE_PEA_TITLE, PEA_REGISTRY_URL,
  peaReminderDrafts, peaStateOn, peaDaysLeft, leasePeaNotice, isoDay, shiftIso, cleanPeaNumber, peaSource,
} from './peaExpiry';
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) pass++; else { fail++; console.error(`✗ ${name}\n   got  ${g}\n   want ${w}`); }
}
function ok(name: string, cond: boolean) { if (cond) pass++; else { fail++; console.error(`✗ ${name}`); } }

// ── Ημερομηνίες ─────────────────────────────────────────────────────────────
{
  eq('isoDay: κανονική', isoDay('2030-06-15'), '2030-06-15');
  eq('isoDay: σφραγίδα χρόνου', isoDay('2030-06-15T10:00:00Z'), '2030-06-15');
  eq('isoDay: ανύπαρκτη ημέρα', isoDay('2030-02-31'), '');
  eq('isoDay: 29 Φεβρουαρίου σε δίσεκτο', isoDay('2028-02-29'), '2028-02-29');
  eq('isoDay: 29 Φεβρουαρίου σε μη δίσεκτο', isoDay('2027-02-29'), '');
  eq('isoDay: κενό', isoDay(null), '');
  eq('shiftIso: 90 ημέρες πριν, πάνω από αλλαγή έτους', shiftIso('2030-03-01', -90), '2029-12-01');
  eq('shiftIso: 30 ημέρες πριν, σε δίσεκτο Φεβρουάριο', shiftIso('2028-03-15', -30), '2028-02-14');
  eq('shiftIso: πάνω από αλλαγή θερινής ώρας', shiftIso('2030-04-05', -30), '2030-03-06');
  eq('cleanPeaNumber: κενά', cleanPeaNumber('  123456/2021  '), '123456/2021');
  eq('cleanPeaNumber: κενό γίνεται null', cleanPeaNumber('   '), null);
  eq('cleanPeaNumber: όριο 40', cleanPeaNumber('x'.repeat(60))?.length, 40);
}

// ── Υπενθυμίσεις: λήξη, 90 και 30 ημέρες πριν ───────────────────────────────
{
  eq('οι ημέρες υπενθύμισης', [...PEA_REMINDER_DAYS], [90, 30]);
  const d = peaReminderDrafts('2030-06-15', '2026-11-12');
  eq('τρία γεγονότα για μακρινή λήξη', d.length, 3);
  eq('πρώτο η ημέρα λήξης, με τον τίτλο του φρουρού', [d[0].title, d[0].event_date], [PEA_EXPIRY_TITLE, '2030-06-15']);
  eq('90 ημέρες πριν', d[1].event_date, '2030-03-17');
  eq('30 ημέρες πριν', d[2].event_date, '2030-05-16');
  eq('πηγές ανά υπενθύμιση', d.map(x => x.source), ['pea:expiry:0', 'pea:expiry:90', 'pea:expiry:30']);
  ok('όλες οι πηγές με το κοινό πρόθεμα', d.every(x => String(x.source).startsWith(PEA_SOURCE_PREFIX)));
  eq('peaSource', peaSource(90), 'pea:expiry:90');
  ok('κατηγορία σύμβασης', d.every(x => x.category === 'contract'));
  ok('τίτλος της υπενθύμισης λέει τις ημέρες', d[1].title.includes('90') && d[2].title.includes('30'));
  ok('η σημείωση έχει την ημερομηνία λήξης', d[1].notes!.includes('15/06/2030'));
  ok('καμία σημείωση δεν μιλά για πρόστιμο', d.every(x => !/πρόστιμ|€/.test(String(x.notes))));

  // Λήξη σε 60 ημέρες: η υπενθύμιση των 90 έχει ήδη περάσει.
  const near = peaReminderDrafts('2027-01-11', '2026-11-12');
  eq('λήξη σε 60 ημέρες: λήξη και 30', near.map(x => x.event_date), ['2027-01-11', '2026-12-12']);
  // Λήξη σε 10 ημέρες: μόνο η ίδια η λήξη.
  eq('λήξη σε 10 ημέρες: μόνο η λήξη', peaReminderDrafts('2026-11-22', '2026-11-12').map(x => x.event_date), ['2026-11-22']);
  // Υπενθύμιση ακριβώς σήμερα: μπαίνει (δεν έχει περάσει).
  eq('η υπενθύμιση των 30 σήμερα μπαίνει', peaReminderDrafts('2026-12-12', '2026-11-12').map(x => x.event_date), ['2026-12-12', '2026-11-12']);
  eq('λήξη σήμερα: μόνο η λήξη', peaReminderDrafts('2026-11-12', '2026-11-12').map(x => x.event_date), ['2026-11-12']);
  eq('ληγμένο: κανένα γεγονός', peaReminderDrafts('2026-11-11', '2026-11-12'), []);
  eq('χωρίς λήξη: κανένα γεγονός', peaReminderDrafts('', '2026-11-12'), []);
  eq('άκυρη λήξη: κανένα γεγονός', peaReminderDrafts('2030-02-30', '2026-11-12'), []);
  ok('η πρόσθετη σημείωση μπαίνει', peaReminderDrafts('2030-06-15', '2026-11-12', 'Από σάρωση.').every(x => String(x.notes).endsWith(' Από σάρωση.')));
}

// ── Κατάσταση ───────────────────────────────────────────────────────────────
{
  eq('χωρίς λήξη', peaStateOn(null, '2026-11-12'), 'missing');
  eq('ισχύει', peaStateOn('2030-01-01', '2026-11-12'), 'valid');
  eq('η ημέρα της λήξης ισχύει ακόμη', peaStateOn('2026-11-12', '2026-11-12'), 'valid');
  eq('την επομένη έχει λήξει', peaStateOn('2026-11-12', '2026-11-13'), 'expired');
  eq('ημέρες ως τη λήξη', peaDaysLeft('2026-12-12', '2026-11-12'), 30);
  eq('ημέρες μετά τη λήξη', peaDaysLeft('2026-11-02', '2026-11-12'), -10);
  eq('χωρίς λήξη, χωρίς ημέρες', peaDaysLeft(undefined, '2026-11-12'), null);
}

// ── Η ειδοποίηση της μίσθωσης ──────────────────────────────────────────────
{
  const today = '2026-11-12';
  eq('ΠΕΑ σε ισχύ στην έναρξη: καμία ειδοποίηση', leasePeaNotice({ pea_expiry: '2030-01-01' }, '2026-12-01', today), null);
  eq('λήξη την ημέρα της έναρξης: καμία ειδοποίηση', leasePeaNotice({ pea_expiry: '2026-12-01' }, '2026-12-01', today), null);

  const missing = leasePeaNotice({ pea_expiry: null }, '2026-12-01', today);
  eq('χωρίς ΠΕΑ: missing', missing?.kind, 'missing');
  eq('ο τίτλος', missing?.title, 'Χρειάζεται ΠΕΑ σε ισχύ');
  eq('ο τίτλος ως σταθερά', LEASE_PEA_TITLE, 'Χρειάζεται ΠΕΑ σε ισχύ');
  ok('χωρίς ακίνητο: missing', leasePeaNotice(null, '2026-12-01', today)?.kind === 'missing');

  const expired = leasePeaNotice({ pea_expiry: '2026-11-30' }, '2026-12-01', today);
  eq('λήγει πριν από την έναρξη: expired', expired?.kind, 'expired');
  ok('λέει την ημερομηνία λήξης', !!expired?.body.includes('30/11/2026'));
  ok('και ότι είναι πριν από την έναρξη', !!expired?.body.includes('πριν από την έναρξη'));

  // Χωρίς έναρξη κρίνεται με τη σημερινή ημέρα.
  eq('χωρίς έναρξη, ΠΕΑ σε ισχύ σήμερα', leasePeaNotice({ pea_expiry: '2027-01-01' }, '', today), null);
  const pastNoStart = leasePeaNotice({ pea_expiry: '2026-01-01' }, null, today);
  ok('χωρίς έναρξη, έληξε', pastNoStart?.kind === 'expired' && pastNoStart.body.includes('έληξε στις 01/01/2026'));
  // Ισχύει σήμερα αλλά λήγει πριν από μελλοντική έναρξη.
  eq('ισχύει σήμερα, όχι στην έναρξη', leasePeaNotice({ pea_expiry: '2026-12-31' }, '2027-02-01', today)?.kind, 'expired');

  // Ηπιο κείμενο: πηγή ναι, πρόστιμο ή ποσό όχι.
  for (const n of [missing!, expired!, pastNoStart!]) {
    const all = `${n.title} ${n.body} ${n.why} ${n.action}`;
    ok(`[${n.kind}] αναφέρει τον νόμο`, all.includes('ν. 4122/2013, άρθρο 12'));
    ok(`[${n.kind}] χωρίς πρόστιμο ή ποσό`, !/πρόστιμ|ποιν|κυρώσ|€|\d+\s?ευρώ/i.test(all));
    ok(`[${n.kind}] χωρίς κόμμα πριν από «και»`, !all.includes(', ' + 'και '));
    ok(`[${n.kind}] χωρίς μεγάλη παύλα`, !all.includes('—'));
  }
  ok('το μητρώο του ΥΠΕΝ μόνο ως διεύθυνση αναφοράς', PEA_REGISTRY_URL === 'https://www.buildingcert.gr/');
}

// ── Η ειδοποίηση φαίνεται στη ροή της μίσθωσης ─────────────────────────────
{
  const read = (p: string) => readFileSync(p, 'utf8');
  const tab = read('app/dashboard/components/TabTenant.tsx');
  ok('η φόρμα ενοικιαστή δείχνει την ειδοποίηση μόνο σε νέα μίσθωση', /!editId&&<div[^\n]*<PeaLeaseNotice peaExpiry=\{propPeaExpiry\} leaseStart=\{form\.lease_start\}/.test(tab));
  ok('και διαβάζει τη λήξη του ακινήτου', tab.includes("'sqm,pea_expiry'"));
  const decl = read('app/dashboard/components/LeaseDeclaration.tsx');
  ok('η δήλωση μίσθωσης δείχνει την ειδοποίηση', decl.includes('<PeaLeaseNotice peaExpiry={pea.expiry} leaseStart={input.lease?.start} />'));
  ok('και τον αριθμό ΠΕΑ', decl.includes('pea_number,pea_expiry') && decl.includes('{row(peaField)}'));
  const notice = read('app/dashboard/components/PeaLeaseNotice.tsx');
  ok('η ειδοποίηση είναι πληροφορία, όχι σφάλμα', notice.includes('<InfoBanner tone="info">'));
}

console.log(fail === 0 ? `✓ peaExpiry: ${pass} έλεγχοι πέρασαν` : `✗ peaExpiry: ${fail} απέτυχαν από ${pass + fail}`);
if (fail > 0) process.exit(1);
