// npx tsx app/dashboard/components/leaseFlow.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// Η ΔΙΑΔΡΟΜΗ ΤΗΣ ΜΙΣΘΩΣΗΣ: πέντε σφάλματα που κλειδώνουν εδώ.
//
//   1. Μισθωτήριο για νέο πρόσωπο ξανάγραφε τη γραμμή του τρέχοντος ενοικιαστή.
//   2. Το παράθυρο μισθωτηρίου κρατούσε το PDF του προηγούμενου ανοίγματος.
//   3. Η Δήλωση μίσθωσης έλεγε «καταγράφηκε» για πάντα ανά ακίνητο.
//   9. Ελληνικό όνομα αρχείου έμπαινε ωμό στο κλειδί αποθήκευσης.
//  10. Δύο γρήγορα πατήματα έγραφαν δύο ίδιους ενοικιαστές.
//
// Οι αποφάσεις δοκιμάζονται ως καθαρές συναρτήσεις (leaseFlow.ts). Η καλωδίωση
// στα συστατικά, που δεν τρέχει χωρίς περιηγητή, ελέγχεται στον πηγαίο κώδικα.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { samePerson, sameAfm, namesMatch, normName, leaseCategoryOf, declaredForLease, declRecordOf, dayBefore, tenantPatchFromLease, leaseDocKey, leaseDocPath } from './leaseFlow'
import { computeObligations } from './obligations'

let pass = 0, fail = 0
const fails: string[] = []
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; fails.push(n) } }

// ── 1. Ο ΙΔΙΟΣ ΑΝΘΡΩΠΟΣ ────────────────────────────────────────────────────
{
  const A = { name: 'Γιώργος Παπαδόπουλος', afm: '123456789' }
  ok('άλλο ΑΦΜ = άλλος άνθρωπος ακόμη και με ίδιο όνομα', !samePerson(A, { name: 'Γιώργος Παπαδόπουλος', afm: '987654321' }))
  ok('ίδιο ΑΦΜ = ίδιος άνθρωπος ακόμη και με άλλη ορθογραφία', samePerson(A, { name: 'Γ. Παπαδοπουλος', afm: ' 123 456 789 ' }))
  ok('άλλο όνομα χωρίς ΑΦΜ = άλλος άνθρωπος', !samePerson(A, { name: 'Μαρία Νικολάου', afm: '' }))
  ok('ίδιο όνομα χωρίς ΑΦΜ στη μία πλευρά = ίδιος', samePerson(A, { name: 'ΓΙΩΡΓΟΣ  ΠΑΠΑΔΟΠΟΥΛΟΣ', afm: null }))
  ok('τόνοι και τελικό σίγμα δεν μετρούν', normName('Νικόλαος  Δήμας') === normName('ΝΙΚΟΛΑΟΣ δημασ'))
  ok('κενό όνομα δεν ταιριάζει με κενό', !samePerson({ name: '', afm: '' }, { name: ' ', afm: null }))
  ok('Χρήση κατοικίας → residential', leaseCategoryOf('residence') === 'residential')
  ok('Επαγγελματική → commercial', leaseCategoryOf('professional') === 'commercial')

  // Η ΠΑΚΑΛΙΑ ΤΗΣ ΠΡΟΣΥΜΠΛΗΡΩΣΗΣ: το παράθυρο γεμίζει το ΑΦΜ του Α. Ο χρήστης
  // γράφει μόνο το όνομα του Β. Πριν, το ίδιο ΑΦΜ αποφάσιζε «ίδιος» και ο Α
  // γινόταν Β σιωπηλά.
  const prefilled = { name: 'Μαρία Νικολάου', afm: '123456789' }
  ok('ίδιο ΑΦΜ με σαφώς άλλο όνομα ΔΕΝ είναι ο ίδιος (ερώτηση)', !samePerson(A, prefilled))
  ok('…και σημειώνεται ως ίδιο ΑΦΜ για προειδοποίηση', sameAfm(A, prefilled))
  ok('αρχικό και επώνυμο: ίδιο όνομα', namesMatch('Γ. Παπαδόπουλος', 'Γιώργος Παπαδόπουλος'))
  ok('αρχικό και επώνυμο, αντίστροφα ορίσματα: ίδιο', namesMatch('Γιώργος Παπαδόπουλος', 'Γ. Παπαδόπουλος'))
  ok('αντίστροφη σειρά: ίδιο όνομα', namesMatch('Παπαδόπουλος Γιώργος', 'ΓΙΩΡΓΟΣ ΠΑΠΑΔΟΠΟΥΛΟΣ'))
  ok('αντίστροφη σειρά με αρχικό: ίδιο', namesMatch('Παπαδόπουλος Γ.', 'Γιώργος Παπαδόπουλος'))
  ok('άλλο όνομα και άλλο επώνυμο: όχι', !namesMatch('Μαρία Νικολάου', 'Γιώργος Παπαδόπουλος'))
  ok('κοινό μόνο το μικρό όνομα: όχι', !namesMatch('Μαρία Νικολάου', 'Μαρία Παπαδάκη'))
  ok('κοινό μόνο το επώνυμο: όχι', !namesMatch('Γιώργος Παπαδόπουλος', 'Νίκος Παπαδόπουλος'))
  ok('αρχικό άλλου γράμματος: όχι', !namesMatch('Ν. Παπαδόπουλος', 'Γιώργος Παπαδόπουλος'))
  ok('κενό όνομα δεν ταιριάζει', !namesMatch('', 'Γιώργος Παπαδόπουλος'))
  // Με το ίδιο (προσυμπληρωμένο) ΑΦΜ, κοινή λέξη δεν αρκεί πια: ρωτάμε.
  ok('ίδιο ΑΦΜ, κοινό μικρό όνομα: ερώτηση', !samePerson({ name: 'Μαρία Νικολάου', afm: '123456789' }, { name: 'Μαρία Παπαδάκη', afm: '123456789' }))
  ok('ίδιο ΑΦΜ, κοινό επώνυμο: ερώτηση', !samePerson(A, { name: 'Νίκος Παπαδόπουλος', afm: '123456789' }))
  ok('ίδιο ΑΦΜ, αρχικό: ο ίδιος', samePerson(A, { name: 'Γ. Παπαδόπουλος', afm: '123456789' }))
  ok('ίδιο ΑΦΜ, αντίστροφη σειρά: ο ίδιος', samePerson(A, { name: 'Παπαδόπουλος Γιώργος', afm: '123456789' }))
}

// ── 4. Η ΓΡΑΜΜΗ ΑΠΟ ΤΟ ΜΙΣΘΩΤΗΡΙΟ ─────────────────────────────────────────
{
  const facts = { name: ' Μαρία Νικολάου ', afm: '', use: 'professional' as const, monthlyRent: 600, deposit: 0, start: '2026-12-01', end: '2029-11-30', paymentDay: 31 }
  const upd = tenantPatchFromLease(facts, 'update')
  ok('ενημέρωση: κενό ΑΦΜ δεν σβήνει το υπάρχον', !('afm' in upd))
  ok('ενημέρωση: μηδενική εγγύηση δεν σβήνει την υπάρχουσα', !('deposit_amount' in upd))
  const ins = tenantPatchFromLease(facts, 'insert')
  ok('νέος: ρητό null στο κενό ΑΦΜ', ins.afm === null && ins.deposit_amount === null)
  ok('ημέρα πληρωμής στο rent_due_day, με όριο 28 όπως στο TabTenant', ins.rent_due_day === 28)
  ok('ημέρα 0 γίνεται 1', tenantPatchFromLease({ ...facts, paymentDay: 0 }, 'insert').rent_due_day === 1)
  ok('τύπος μίσθωσης από τη Χρήση', ins.lease_category === 'commercial')
  ok('όνομα χωρίς κενά άκρων', ins.full_name === 'Μαρία Νικολάου')
  ok('ενημέρωση με ΑΦΜ το γράφει', tenantPatchFromLease({ ...facts, afm: '987654321', deposit: 1200 }, 'update').afm === '987654321')
  ok('αποχώρηση την παραμονή της νέας έναρξης', dayBefore('2026-12-01') === '2026-11-30' && dayBefore('2027-03-01') === '2027-02-28')
}

// ── 3. ΔΗΛΩΣΗ ΓΙΑ ΤΗΝ ΤΡΕΧΟΥΣΑ ΜΙΣΘΩΣΗ ────────────────────────────────────
{
  const lease = { tenantId: 't-new', leaseStart: '2026-07-10' }
  // Το σενάριο του αδιεξόδου: δήλωση του προηγούμενου ενοικιαστή, νέα μίσθωση.
  // Πριν, η Δήλωση μίσθωσης έλεγε «Καταγράφηκε» και η Επισκόπηση «εκκρεμεί».
  ok('καταγραφή πριν την έναρξη δεν αφορά την τρέχουσα', !declaredForLease({ at: '2026-05-01T09:00:00Z' }, lease))
  ok('καταγραφή μετά την έναρξη αφορά την τρέχουσα', declaredForLease({ at: '2026-07-20T09:00:00Z' }, lease))
  ok('ίδια μέρα με την έναρξη μετράει', declaredForLease({ at: '2026-07-10T18:00:00Z' }, lease))
  ok('καταγραφή για άλλον ενοικιαστή δεν μετρά', !declaredForLease({ at: '2026-07-20T09:00:00Z', tenantId: 't-old' }, lease))
  ok('χωρίς καταγραφή, τίποτα', !declaredForLease(null, lease))
  ok('χωρίς έναρξη, μετρά μόνο καταγραφή για τον ίδιο', declaredForLease({ at: '2026-01-01', tenantId: 't-new' }, { tenantId: 't-new' }))
  ok('χωρίς έναρξη και χωρίς αναγνωριστικό, τίποτα', !declaredForLease({ at: '2026-01-01' }, { tenantId: 't-new' }))

  // ΔΗΛΩΣΗ ΣΤΗΝ ΥΠΟΓΡΑΦΗ, ΠΡΙΝ ΤΗΝ ΕΝΑΡΞΗ. Πριν: «δεν καταγράφηκε», ξανά
  // καταγραφή, διπλές γραμμές και στο επόμενο άνοιγμα «αφορά προηγούμενη».
  ok('ίδιος ενοικιαστής πριν την έναρξη μετρά', declaredForLease({ at: '2026-06-20T09:00:00Z', tenantId: 't-new', leaseStart: '2026-07-10' }, lease))
  ok('ίδιος ενοικιαστής χωρίς αποθηκευμένη έναρξη μετρά', declaredForLease({ at: '2026-06-20T09:00:00Z', tenantId: 't-new' }, lease))
  ok('ίδιος ενοικιαστής με άλλη έναρξη (ανανέωση) θέλει νέα', !declaredForLease({ at: '2026-06-20T09:00:00Z', tenantId: 't-new', leaseStart: '2023-07-10' }, lease))
  // ΗΜΕΡΑ ΑΘΗΝΑΣ: 01:30 Αθήνας στις 10/07 είναι 22:30 UTC στις 09/07.
  ok('παλιά καταγραφή 01:30 Αθήνας την ημέρα έναρξης μετρά', declaredForLease({ at: '2026-07-09T22:30:00Z' }, lease))
  ok('παλιά καταγραφή 23:30 Αθήνας την παραμονή δεν μετρά', !declaredForLease({ at: '2026-07-09T20:30:00Z' }, lease))
  const rec = declRecordOf({ created_at: '2026-06-20T09:00:00Z', metadata: { tenant_id: 't-new', lease_start: '2026-07-10', reference: '1' } })
  ok('η γραμμή του ιστορικού διαβάζεται με ενοικιαστή και έναρξη', rec?.tenantId === 't-new' && rec?.leaseStart === '2026-07-10')
  ok('γραμμή χωρίς ημερομηνία δεν είναι καταγραφή', declRecordOf({ metadata: {} }) === null)

  // Η Επισκόπηση και η Δήλωση μίσθωσης απαντούν το ίδιο για τις ίδιες ημερομηνίες.
  const NOW = new Date('2026-07-25T09:00:00Z')
  const prop = { id: 'p1', name: 'Σπίτι', prop_type: 'apartment', status_detail: 'rented', rental_mode: 'long_term' }
  const tenant = { id: 't-new', lease_start: '2026-07-10', lease_end: '2029-07-09' }
  for (const at of ['2026-05-01T09:00:00Z', '2026-07-10T18:00:00Z', '2026-07-20T09:00:00Z']) {
    const open = computeObligations(prop as never, tenant as never, [], NOW, 'long_term', { leaseDeclaredAt: at }).some(o => o.id === 'lease_decl')
    ok(`ίδια απάντηση Επισκόπησης και Δήλωσης για ${at.slice(0, 10)}`, open === !declaredForLease({ at }, lease))
  }
  // Η Επισκόπηση περνά πλέον το αναγνωριστικό: δήλωση στην υπογραφή την κλείνει.
  const early = computeObligations(prop as never, tenant as never, [], NOW, 'long_term',
    { leaseDeclaredAt: '2026-06-20T09:00:00Z', leaseDeclTenantId: 't-new', leaseDeclLeaseStart: '2026-07-10' }).some(o => o.id === 'lease_decl')
  ok('Επισκόπηση: δήλωση στην υπογραφή για τον ίδιο κλείνει την υπενθύμιση', !early)
  const other = computeObligations(prop as never, tenant as never, [], NOW, 'long_term',
    { leaseDeclaredAt: '2026-07-20T09:00:00Z', leaseDeclTenantId: 't-old' }).some(o => o.id === 'lease_decl')
  ok('Επισκόπηση: δήλωση άλλου ενοικιαστή δεν την κλείνει', other)
}

// ── 9. ΤΟ PDF ΤΟΥ ΜΙΣΘΩΤΗΡΙΟΥ ──────────────────────────────────────────────
{
  const key = leaseDocKey('u1', 't1', 'Μισθωτήριο Παπαδόπουλος.pdf', new Date(2026, 10, 12))
  ok(`το κλειδί μένει στον φάκελο του ενοικιαστή (${key})`, key.startsWith('u1/t1/'))
  ok('χωρίς ελληνικά στο κλειδί', !/[\u0370-\u03FF\u1F00-\u1FFF]/.test(key))
  ok('μόνο ασφαλείς χαρακτήρες', /^[\w./-]+$/.test(key))
  ok('κρατά την επέκταση', key.endsWith('.pdf'))
  ok('νέο αρχείο: ανοίγει από το lease_doc_url', leaseDocPath('u1', { id: 't1', lease_doc_name: 'Μισθωτήριο.pdf', lease_doc_url: key }) === key)
  ok('παλιό αρχείο: ανοίγει όπως πριν, φάκελος + όνομα', leaseDocPath('u1', { id: 't1', lease_doc_name: 'old.pdf', lease_doc_url: null }) === 'u1/t1/old.pdf')
  ok('κλειδί έξω από τον φάκελο δεν γίνεται δεκτό', leaseDocPath('u1', { id: 't1', lease_doc_name: 'old.pdf', lease_doc_url: 'u2/t9/x.pdf' }) === 'u1/t1/old.pdf')
  ok('χωρίς αρχείο, καμία διαδρομή', leaseDocPath('u1', { id: 't1' }) === null)
}

// ── Η ΚΑΛΩΔΙΩΣΗ ΣΤΑ ΣΥΣΤΑΤΙΚΑ ──────────────────────────────────────────────
{
  const here = join(process.cwd(), 'app/dashboard/components')
  const src = (f: string) => readFileSync(join(here, f), 'utf8')
    .split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')
  const TAB = src('TabTenant.tsx'), MODAL = src('LeaseModal.tsx'), DECL = src('LeaseDeclaration.tsx'), DOC = src('docUtils.ts')

  // 1. Καμία ενημέρωση του τρέχοντος χωρίς απόφαση «ίδιος» ή «αντικατάσταση».
  ok('1: το μισθωτήριο δεν ενημερώνει πια το cur.id χωρίς έλεγχο', !/updateReturning\(supabase,\s*cur\.id/.test(MODAL))
  ok('1: η απόφαση περνά από το samePerson', MODAL.includes('samePerson('))
  ok('1: η γραμμή βγαίνει από το tenantPatchFromLease', MODAL.includes("tenantPatchFromLease(facts, updateId ? 'update' : 'insert')"))
  ok('1: ίδιο ΑΦΜ με άλλο όνομα προειδοποιεί', MODAL.includes('sameAfm(curPerson, newPerson)'))
  // 3 (αναθεώρηση). Ο προηγούμενος αποχωρεί με markPast, προεπιλογή ναι.
  ok('3: «Νέος ενοικιαστής» σημειώνει αποχώρηση με markPast', /tenantStore\.markPast\(supabase, m\.id/.test(MODAL) && /markPrevLeft\(\{ id: cur\.id/.test(MODAL))
  ok('3: η αποχώρηση είναι προεπιλογή', MODAL.includes('useState(true)') && MODAL.includes('setPrevLeft'))
  // 4. Ημερολόγιο όπως στο TabTenant.
  ok('4: syncTenantSchedule μετά την εγγραφή', /syncTenantSchedule\(supabase, savedRow/.test(MODAL))
  // Αποτυχία αποχώρησης: το παράθυρο μένει ανοιχτό με επανάληψη.
  ok('3: αποτυχημένη αποχώρηση δεν κλείνει το παράθυρο', MODAL.includes('if (left) closeTimer.current = setTimeout(onClose'))
  ok('3: υπάρχει «Δοκίμασε ξανά την αποχώρηση»', MODAL.includes('Δοκίμασε ξανά την αποχώρηση') && MODAL.includes('onClick={retryMoveOut}'))
  ok('1: χωρίς γραμμή, καμία επιτυχία', /if \(!row\) \{ setErr\(/.test(MODAL))
  // 2. Προσαρτάται μόνο ανοιχτό.
  ok('2: το LeaseModal προσαρτάται μόνο ανοιχτό', /\{leaseOpen && <LeaseModal\b/.test(TAB))
  // 3. Η ένδειξη «Καταγράφηκε» περνά από τον κοινό κανόνα.
  ok('3: η Δήλωση μίσθωσης κρίνει με το declaredForLease', DECL.includes('declaredForLease(submitted'))
  ok('3: η καταγραφή κρατά τον ενοικιαστή', /tenant_id:\s*tenantId/.test(DECL))
  ok('3: υπάρχει διόρθωση της καταγραφής', DECL.includes('setEditing(true)'))
  // 9. Κανένα ωμό όνομα στο κλειδί.
  ok('9: το PDF του ενοικιαστή δεν έχει file.name στο κλειδί', !/`\$\{userId\}\/\$\{t\.id\}\/\$\{file\.name\}`/.test(TAB))
  ok('9: το κλειδί βγαίνει από το leaseDocKey', TAB.includes('leaseDocKey(userId,t.id,file.name)'))
  ok('9: η αρχειοθέτηση PDF περνά από το uploadPath', /uploadPath\(`\$\{i\.fileName\}\.pdf`/.test(DOC))
  // 10. Η κλειδαριά πριν από κάθε await.
  const iLock = TAB.indexOf('if(saveLock.current) return;')
  const iDpa = TAB.indexOf('await ensureDpa(supabase))){setError(\'Τα στοιχεία δεν αποθηκεύτηκαν')
  ok('10: η κλειδαριά μπαίνει πριν τη σύμβαση επεξεργασίας', iLock > 0 && iDpa > iLock)
}

console.log(fail === 0 ? `✓ leaseFlow: ${pass} έλεγχοι πέρασαν` : `✗ leaseFlow: ${fail} απέτυχαν από ${pass + fail}`)
if (fail) { for (const f of fails) console.log('  ✗ ' + f); process.exit(1) }
