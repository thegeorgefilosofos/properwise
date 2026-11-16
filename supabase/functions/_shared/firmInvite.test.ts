// npx tsx supabase/functions/_shared/firmInvite.test.ts
//
// Η πρόσκληση μέλους γραφείου: ποιος δικαιούται να στείλει σε ποια διεύθυνση
// και τι λέει το μήνυμα. Η συνάρτηση `send-firm-invite` τρέχει σε Deno· τα δύο
// κομμάτια που κρίνουν ζουν στο firmInvite.ts και δοκιμάζονται εδώ.
import { firmInviteEmail, firmInviteVerdict, FIRM_INVITE_ENTRY, type MyFirmRow } from './firmInvite.ts'
import { APP_URL } from './site.ts'
import { ROLE_LABEL } from '../../../lib/data/firmRoles.ts'
import { continuation } from '../../../lib/auth/continuation.ts'

let pass = 0, fail = 0
const ok = (name: string, cond: boolean) => { if (cond) pass++; else { fail++; console.error('✗ ' + name) } }

const ME = 'u-manager'
const firm = (role: string | null, extra: MyFirmRow['members'] = []): MyFirmRow => ({
  name: 'Παπαδόπουλος & Συνεργάτες', role,
  members: [
    { userId: ME, email: 'boss@grafeio.gr', role: 'manager', status: 'active', name: 'Νίκος Παπαδόπουλος' },
    { userId: null, email: 'new@grafeio.gr', role: 'associate', status: 'invited', name: null },
    { userId: 'u-2', email: 'old@grafeio.gr', role: 'accountant', status: 'active', name: 'Μαρία' },
    ...(extra ?? []),
  ],
})

// ── Η εξουσιοδότηση: μόνο ο Υπεύθυνος, μόνο σε εκκρεμή πρόσκληση του γραφείου του ──
const yes = firmInviteVerdict(firm('manager'), 'New@Grafeio.gr ', ME)
ok('ο Υπεύθυνος στέλνει σε εκκρεμή πρόσκληση (χωρίς διάκριση πεζών/κεφαλαίων)', yes.ok)
ok('ο ρόλος έρχεται από τη βάση, όχι από το αίτημα', yes.ok && yes.role === 'associate')
ok('το όνομα του γραφείου έρχεται από τη βάση', yes.ok && yes.firmName === 'Παπαδόπουλος & Συνεργάτες')
ok('το όνομα του αποστολέα είναι το δικό του, από τη γραμμή του', yes.ok && yes.inviterName === 'Νίκος Παπαδόπουλος')

for (const role of ['accountant', 'associate', null, '']) {
  const v = firmInviteVerdict(firm(role), 'new@grafeio.gr', ME)
  ok(`ρόλος «${role}»: 403 not_manager`, !v.ok && v.status === 403 && v.error === 'not_manager')
}
const none = firmInviteVerdict(null, 'new@grafeio.gr', ME)
ok('χωρίς γραφείο: 403', !none.ok && none.status === 403)
const notInFirm = firmInviteVerdict(firm('manager'), 'stranger@example.com', ME)
ok('διεύθυνση εκτός γραφείου: 404 not_invited', !notInFirm.ok && notInFirm.status === 404 && notInFirm.error === 'not_invited')
const active = firmInviteVerdict(firm('manager'), 'old@grafeio.gr', ME)
ok('ενεργό μέλος: δεν ξαναπαίρνει πρόσκληση', !active.ok && active.status === 404)
const removed = firmInviteVerdict(firm('manager', [{ email: 'gone@grafeio.gr', role: 'accountant', status: 'removed' }]), 'gone@grafeio.gr', ME)
ok('αφαιρεμένο μέλος: τίποτα', !removed.ok && removed.status === 404)
const empty = firmInviteVerdict(firm('manager'), '   ', ME)
ok('κενή διεύθυνση: τίποτα', !empty.ok)
const odd = firmInviteVerdict(firm('manager', [{ email: 'x@grafeio.gr', role: 'owner', status: 'invited' }]), 'x@grafeio.gr', ME)
ok('άγνωστος ρόλος γίνεται Λογιστής, ποτέ Υπεύθυνος', odd.ok && odd.role === 'accountant')
ok('οι αρνήσεις δεν λένε τίποτα για λογαριασμό', [none, notInFirm, active].every(v => !v.ok && !/account|user|exists/i.test(JSON.stringify(v))))

// ── Το μήνυμα ──────────────────────────────────────────────────────────────
const m = firmInviteEmail({ firmName: 'Παπαδόπουλος & Συνεργάτες', role: 'manager', inviterEmail: 'boss@grafeio.gr', inviterName: 'Νίκος <b>Π</b>', inviteeEmail: 'new@grafeio.gr' })
ok('θέμα: το γραφείο προσκαλεί στο PROPERWISE', m.subject === '«Παπαδόπουλος & Συνεργάτες» σε προσκαλεί στο PROPERWISE')
ok('θέμα: απλό κείμενο, χωρίς &amp;', !m.subject.includes('&amp;'))
ok('σώμα: το όνομα του γραφείου διαφεύγεται', m.html.includes('Παπαδόπουλος &amp; Συνεργάτες'))
ok('σώμα: λέει ποιος προσκάλεσε, με την επιβεβαιωμένη διεύθυνση', m.html.includes('<b>boss@grafeio.gr</b>'))
ok('σώμα: το δηλωμένο όνομα διαφεύγεται', m.html.includes('Νίκος &lt;b&gt;Π&lt;/b&gt;') && !m.html.includes('Νίκος <b>Π</b>'))
ok('σώμα: ο ρόλος με τη λέξη της εφαρμογής', m.html.includes(`<b>${ROLE_LABEL.manager}</b>`))
ok('σώμα: λέει τι είναι η πύλη', m.html.includes('Η πύλη του λογιστή είναι'))
ok('σώμα: λέει με ποια διεύθυνση μπαίνει', m.html.includes('<b>new@grafeio.gr</b>') && m.html.includes('με αυτή τη διεύθυνση'))
const href = `${APP_URL}${FIRM_INVITE_ENTRY}`
ok('κουμπί: η είσοδος του λογιστή', m.html.includes(`href="${href}"`))
ok('η είσοδος καταλήγει στον χώρο του γραφείου', continuation(FIRM_INVITE_ENTRY.slice(FIRM_INVITE_ENTRY.indexOf('?'))) === '/accountant/workspace')
ok('καμία τιμή ή «δωρεάν»', !/δωρε[άα]ν|€|ευρώ/i.test(m.html + m.subject))
ok('κανένα κόμμα πριν από «και»', !/,\s+και\s/.test(m.html.replace(/<[^>]+>/g, ' ')))

for (const role of ['manager', 'accountant', 'associate'] as const) {
  const r = firmInviteEmail({ firmName: 'Γ', role, inviterEmail: 'a@b.gr', inviteeEmail: 'c@d.gr' })
  ok(`ρόλος ${role}: γράφεται «${ROLE_LABEL[role]}»`, r.html.includes(ROLE_LABEL[role]))
}

const bare = firmInviteEmail({ firmName: '  ', role: 'accountant', inviterEmail: '', inviteeEmail: 'c@d.gr' })
ok('χωρίς όνομα γραφείου: γενικό θέμα', bare.subject === 'Πρόσκληση σε γραφείο στο PROPERWISE')
ok('χωρίς όνομα γραφείου: κανένα κενό ««»»', !bare.html.includes('«»') && !bare.subject.includes('«»'))
ok('χωρίς διεύθυνση αποστολέα: ουδέτερη διατύπωση', bare.html.includes('Ο Υπεύθυνος ενός γραφείου σε προσκάλεσε'))

console.log(fail ? `✗ firmInvite: ${fail} απέτυχαν από ${pass + fail}` : `✓ firmInvite: ${pass} έλεγχοι πέρασαν`)
if (fail) process.exit(1)
