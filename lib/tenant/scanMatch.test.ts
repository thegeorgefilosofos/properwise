// Ταίριασμα σαρωμένου μισθωτηρίου και φρουρός «νεότερο χαρτί» (έλεγχος 18/10/2026,
// APP-3 και APP-4). Τρέξε: npx tsx lib/tenant/scanMatch.test.ts
import { nameKey, sameName, matchScannedTenant, leasePaperAge, leaseUpdate, changedTerms, type TenantOnFile } from './scanMatch';
import { instalmentRows } from '@/app/dashboard/components/rentInstalments';
import { leasesInYear } from '@/lib/data/tenants';
import type { Tenant } from '@/app/dashboard/components/TabTenantTypes';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n); } };

// ── Το όνομα ως σύνολο λέξεων ───────────────────────────────────────────────
ok('σειρά λέξεων, τόνοι, κεφαλαία', sameName('ΠΑΠΑΔΟΠΟΥΛΟΣ ΓΕΩΡΓΙΟΣ', 'Γεώργιος Παπαδόπουλος'));
ok('τελικό σίγμα', nameKey('ΠΑΠΑΔΟΠΟΥΛΟΣ') === nameKey('παπαδοπουλοσ'));
ok('τελείες και διπλά κενά', sameName('Παπαδόπουλος,  Γεώργιος.', 'γεωργιος παπαδοπουλος'));
ok('υποκοριστικό δεν είναι ίδιο όνομα (ρωτάμε, δεν μαντεύουμε)', !sameName('ΠΑΠΑΔΟΠΟΥΛΟΣ ΓΕΩΡΓΙΟΣ', 'Γιώργος Παπαδόπουλος'));
ok('κενό όνομα δεν ταιριάζει με κενό', !sameName('', ''));

// ── Ποιον αφορά ─────────────────────────────────────────────────────────────
const g: TenantOnFile = { id: 'g', full_name: 'Γιώργος Παπαδόπουλος', afm: null };
const m: TenantOnFile = { id: 'm', full_name: 'Μαρία Νικολάου', afm: '094014201' };
ok('κανένας τρέχων: νέος', matchScannedTenant({ full_name: 'Χ' }, []).kind === 'new');
const byAfm = matchScannedTenant({ full_name: 'Μ. ΝΙΚΟΛΑΟΥ-ΠΑΠΑ', afm: '094 014 201' }, [g, m]);
ok('πρώτα το ΑΦΜ, όποιο κι αν είναι το όνομα', byAfm.kind === 'same' && byAfm.tenant.id === 'm' && byAfm.by === 'afm');
const byName = matchScannedTenant({ full_name: 'ΝΙΚΟΛΑΟΥ ΜΑΡΙΑ' }, [g, m]);
ok('μετά το όνομα, σε όλους τους τρέχοντες (όχι μόνο στον πρώτο)', byName.kind === 'same' && byName.tenant.id === 'm');
ok('ίδιο όνομα, άλλο έγκυρο ΑΦΜ: ρωτά', matchScannedTenant({ full_name: 'Μαρία Νικολάου', afm: '090000045' }, [m]).kind === 'ask');
ok('άκυρο ΑΦΜ στο χαρτί δεν χαλά το ταίριασμα ονόματος', matchScannedTenant({ full_name: 'Μαρία Νικολάου', afm: '123' }, [m]).kind === 'same');
const ask = matchScannedTenant({ full_name: 'ΠΑΠΑΔΟΠΟΥΛΟΣ ΓΕΩΡΓΙΟΣ' }, [g]);
ok('δεν ταιριάζει με τον τρέχοντα: ερώτηση, όχι νέα γραμμή', ask.kind === 'ask' && ask.current[0].id === 'g');

// ── Η ηλικία του χαρτιού ───────────────────────────────────────────────────
const cur = { lease_start: '2026-01-01', lease_end: '2028-12-31' };
ok('παλαιότερη έναρξη: παλιό', leasePaperAge({ lease_start: '2023-01-01', lease_end: '2025-12-31' }, cur) === 'older');
ok('νεότερη έναρξη: νεότερο', leasePaperAge({ lease_start: '2029-01-01', lease_end: '2031-12-31' }, cur) === 'newer');
ok('ίδια έναρξη, μεταγενέστερη λήξη (παράταση): νεότερο', leasePaperAge({ lease_start: '2026-01-01', lease_end: '2029-12-31' }, cur) === 'newer');
ok('νεότερη έναρξη αλλά παλαιότερη λήξη: η αμφιβολία δεν αλλάζει όρους', leasePaperAge({ lease_start: '2026-06-01', lease_end: '2027-05-31' }, cur) === 'older');
ok('χωρίς ημερομηνίες να συγκριθούν: ίδιο', leasePaperAge({ lease_start: '2023-01-01' }, {}) === 'same');

// ── Τι γράφεται (τα νούμερα του ελέγχου: 550€ από 01/2026, χαρτί 500€ 2023–2025) ──
const before = { id: 't1', full_name: 'Γιώργος Παπαδόπουλος', monthly_rent: 550, lease_start: '2026-01-01', lease_end: '2028-12-31', rent_due_day: 5, notes: 'κλειδιά: 2' };
const oldPaper = { full_name: 'Γιώργος Παπαδόπουλος', monthly_rent: 500, lease_start: '2023-01-01', lease_end: '2025-12-31', rent_due_day: 5, deposit_amount: null, afm: '094014201', notes: 'Από σάρωση' };
const older = leaseUpdate(oldPaper, before);
ok('παλιό χαρτί: ούτε ενοίκιο ούτε ημερομηνίες', !('monthly_rent' in older.patch) && !('lease_start' in older.patch) && !('lease_end' in older.patch));
ok('παλιό χαρτί: συμπληρώνει ό,τι λείπει (ΑΦΜ)', older.patch.afm === '094014201' && older.age === 'older');
ok('οι σημειώσεις του ιδιοκτήτη δεν σβήνουν', !('notes' in older.patch));
const rows = (t: object) => instalmentRows({ ...before, ...t } as unknown as Tenant, 'p', 'u');
ok(`οι δόσεις δεν γεννιούνται πριν από την έναρξη που ισχύει (${rows({}).length} → ${rows(older.patch).length})`, rows(older.patch).length === rows({}).length);
// Μίσθωση αορίστου (χωρίς λήξη): το αρχειοθετημένο μισθωτήριο 2023–2025 της
// έδινε λήξη 31/12/2025 και ο ενοικιαστής έβγαινε από το Ε2 του 2026.
const openEnded = { ...before, lease_end: null, rent_due_day: null };
const fromOld = leaseUpdate(oldPaper, openEnded);
ok(`παλιό χαρτί σε μίσθωση χωρίς λήξη: κανένας όρος (πήρα ${JSON.stringify(fromOld.patch)})`,
  !('lease_end' in fromOld.patch) && !('rent_due_day' in fromOld.patch) && fromOld.age === 'older');
ok('ο ενοικιαστής μένει στο Ε2 του 2026', leasesInYear([{ ...openEnded, ...fromOld.patch }], 2026).length === 1);
ok('παλιό χαρτί σε μίσθωση χωρίς λήξη: το ΑΦΜ συμπληρώνεται', fromOld.patch.afm === '094014201');
const newer = leaseUpdate({ ...oldPaper, full_name: 'ΠΑΠΑΔΟΠΟΥΛΟΣ ΓΙΩΡΓΟΣ', monthly_rent: 600, lease_start: '2029-01-01', lease_end: '2031-12-31' }, before);
ok('νεότερο χαρτί: νέοι όροι', newer.patch.monthly_rent === 600 && newer.patch.lease_start === '2029-01-01' && newer.patch.lease_end === '2031-12-31');
ok('νεότερο χαρτί: το όνομα μένει όπως το γράφει η εφαρμογή', !('full_name' in newer.patch));
ok('ίδια τιμή δεν ξαναγράφεται', !('rent_due_day' in newer.patch));
const same = leaseUpdate({ full_name: 'Γιώργος Παπαδόπουλος', monthly_rent: 500, lease_start: '2026-01-01', lease_end: '2028-12-31' }, before);
ok('ίδιες ημερομηνίες, άλλο ενοίκιο: δεν αλλάζει χωρίς νεότερο χαρτί', Object.keys(same.patch).length === 0 && same.age === 'same');

// ── Ποιες αλλαγές θέλουν ρητό «ναι» ───────────────────────────────────────
ok('νεότερο με άλλο ενοίκιο και έναρξη: δύο αλλαγές',
  JSON.stringify(changedTerms(newer.patch, before).map(c => c.key)) === JSON.stringify(['monthly_rent', 'lease_start']));
ok('η λήξη μόνη της δεν ρωτά (παράταση)', changedTerms(leaseUpdate({ lease_start: '2026-01-01', lease_end: '2030-12-31', monthly_rent: 550 }, before).patch, before).length === 0);
ok('συμπλήρωση κενού ενοικίου δεν είναι αλλαγή', changedTerms({ monthly_rent: 500 }, { monthly_rent: null }).length === 0);
const kept = leaseUpdate({ ...oldPaper, monthly_rent: 600, lease_start: '2029-01-01', lease_end: '2031-12-31' }, before, { keepTerms: true });
ok('«όχι»: οι όροι μένουν, το κενό ΑΦΜ συμπληρώνεται', !('monthly_rent' in kept.patch) && !('lease_start' in kept.patch) && kept.patch.afm === '094014201');

console.log(`scanMatch: ${pass} ✓ · ${fail} ✗`);
if (fail) process.exit(1);
