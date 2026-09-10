'use client';

// ═══════════════════════════════════════════════════════════════════════════
// OrgTeam, «Οργανισμός & Ομάδα» (tier Επαγγελματίας). Ο ιδιοκτήτης ονομάζει τον
// οργανισμό του και διαχειρίζεται μια λίστα μελών με ρόλους και προσκλήσεις με
// email. Αποδίδεται ΓΥΜΝΟ μέσα σε υπάρχουσα Card του γονέα (δεν τυλίγεται σε δική
// του Card, ο γονέας δίνει <Card><SecHdr label="Οργανισμός & Ομάδα" />…).
//
// Πηγή αλήθειας για χρώματα/κενά/ακτίνες: app/globals.css (μόνο CSS variables).
// Τα μέλη ξεκινούν με πρόσβαση ΑΝΑΓΝΩΣΗΣ στο χαρτοφυλάκιο. Ο ιδιοκτήτης μπορεί να
// τους δώσει και δικαιώματα ΕΠΕΞΕΡΓΑΣΙΑΣ, ανά μέλος, εγκρίνοντας το αίτημά τους.
//
// Το component εξυπηρετεί ΔΥΟ όψεις: του ΙΔΙΟΚΤΗΤΗ (διαχείριση οργανισμού, μελών
// και προσβάσεων) και του ΜΕΛΟΥΣ (προβολή του οργανισμού και αιτήματα προς τον
// ιδιοκτήτη). Η όψη επιλέγεται αυτόματα κατά τη φόρτωση.
// ═══════════════════════════════════════════════════════════════════════════

import { Fragment, useEffect, useState, type CSSProperties } from 'react';
import { createClient } from '@/lib/supabase/client';
import * as properties from '@/lib/data/properties';
import { T, Btn, ChipToggle, Chip, EmptyState, Skeleton, settingsField, ABSENT } from '@/components/Theme';
import { Users } from 'lucide-react';
import { logActivity } from '@/lib/activity';

// ═══════════════════════════════════════════════════════════════════════════
// Ο «ΔΙΑΧΕΙΡΙΣΤΗΣ» ΔΕΝ ΜΠΟΡΟΥΣΕ ΝΑ ΚΑΝΕΙ ΤΙΠΟΤΑ ΠΕΡΙΣΣΟΤΕΡΟ ΑΠΟ ΤΟ «ΜΕΛΟΣ»
//
// Εδώ ζούσε `ROLE_OPTIONS = [Διαχειριστής, Μέλος]`, σε δύο επιλογείς: έναν ανά
// μέλος και έναν στην πρόσκληση. Μετρημένο στη βάση, η διάκριση admin↔member
// ΔΕΝ κρίνει απολύτως τίποτα: καμία πολιτική RLS δεν διαβάζει τη στήλη `role`
// για διαβάθμιση και οι τρεις συναρτήσεις εξουσιοδότησης
// (`is_org_owner`, `org_owner_ids`, `org_editor_owner_ids`) την αγνοούν.
//
// Η τιμή `owner` ΕΙΝΑΙ φέρουσα, σε τέσσερις φρουρούς «role <> 'owner'» που
// εμποδίζουν τον ιδιοκτήτη να αφαιρεθεί ή να υποβαθμιστεί. Ο ρόλος μένει στη
// βάση γι' αυτό. Ο,τι έφυγε είναι η ΕΠΙΛΟΓΗ ανάμεσα σε δύο τιμές που
// συμπεριφέρονται ίδια, δίπλα σε στήλη «Πρόσβαση» που κρίνει αληθινά.
//
// Ο ιδιοκτήτης έβλεπε «Ρόλος: Διαχειριστής» και «Πρόσβαση: Ανάγνωση» στην ίδια
// γραμμή και δεν είχε τρόπο να ξέρει ποιο από τα δύο ισχύει. Ισχύει το δεύτερο.
// ═══════════════════════════════════════════════════════════════════════════

type Role = 'owner' | 'admin' | 'member';
type Status = 'invited' | 'active' | 'revoked';

interface Org {
  id: string;
  name: string;
  owner_user_id: string;
  upgrade_requested_at: string | null;
  created_at: string;
}
interface Member {
  email: string;
  role: Role;
  status: Status;
  joined_at: string | null;
  user_id: string | null;
  can_edit: boolean;
  edit_requested_at: string | null;
  property_scope: string[] | null;      // null/κενό = όλα τα ακίνητα
  can_view_financials: boolean;
}

// Η δική μου εγγραφή στον πίνακα μελών (για την ανίχνευση όψης).
interface MyRow {
  org_id: string;
  role: Role;
  can_edit: boolean;
  edit_requested_at: string | null;
  status: Status;
}
// Τα δεδομένα της όψης μέλους (read-only για το μέλος).
interface Membership {
  orgId: string;
  orgName: string;
  role: Role;
  canEdit: boolean;
  editRequestedAt: string | null;
}

// ── Κοινά στυλ πεδίων: ίδιο primitive με όλες τις Ρυθμίσεις (focus με .po-field).
const fieldStyle: CSSProperties = settingsField;
const subLabel: CSSProperties = { fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-primary)', fontFamily: T.font.sans };
const descStyle: CSSProperties = { fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5, fontFamily: T.font.sans, marginTop: 4 };
const errStyle: CSSProperties = { fontSize: 12, color: 'var(--negative)', fontFamily: T.font.sans, marginTop: 8 };

// Chips μητρώου: ουδέτερα (η ετικέτα λέει τα πάντα). Κρατάμε το χρώμα μόνο για
// ό,τι είναι πραγματικά actionable (π.χ. εκκρεμές αίτημα), όχι για διακόσμηση.
function RoleChip({ role }: { role: Role }) {
  // Δύο τιμές, όσες κρίνει και η βάση. Ο «Διαχειριστής» έδειχνε διαβάθμιση που
  // δεν υπάρχει· ό,τι ξεχωρίζει τα μέλη είναι η στήλη «Πρόσβαση».
  return <Chip tone="neutral">{role === 'owner' ? 'Ιδιοκτήτης' : 'Μέλος'}</Chip>;
}

function StatusChip({ status }: { status: Status }) {
  const label = status === 'active' ? 'Ενεργό' : status === 'invited' ? 'Προσκεκλημένο' : 'Ανακλήθηκε';
  return <Chip tone="neutral">{label}</Chip>;
}

function AccessChip({ canEdit }: { canEdit: boolean }) {
  return <Chip tone="neutral">{canEdit ? 'Επεξεργασία' : 'Ανάγνωση'}</Chip>;
}

export default function OrgTeam({ userId }: { userId: string }) {
  const supabase = createClient();

  const [org, setOrg] = useState<Org | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  // Ακίνητα του οργανισμού, για τον ορισμό εύρους πρόσβασης ανά μέλος.
  const [orgProps, setOrgProps] = useState<{ id: string; name: string }[]>([]);
  const [openPerms, setOpenPerms] = useState<string | null>(null);   // email γραμμής με ανοιχτά δικαιώματα
  const [loading, setLoading] = useState(true);
  // Η τρίτη κατάσταση της φόρτωσης: «δεν ξέρουμε» (η ανάγνωση δεν έγινε).
  const [loadError, setLoadError] = useState(false);

  // Όψη: ιδιοκτήτης (διαχείριση) ή μέλος (προβολή + αιτήματα)
  const [mode, setMode] = useState<'owner' | 'member' | null>(null);
  const [me, setMe] = useState<Membership | null>(null);
  const [memberBusy, setMemberBusy] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [editSent, setEditSent] = useState(false);
  const [upgradeSent, setUpgradeSent] = useState(false);

  // Όνομα οργανισμού (inline-editable)
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  // Πρόσκληση μέλους
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteNote, setInviteNote] = useState<string | null>(null);

  // Ενέργειες ανά γραμμή
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  useEffect(() => {
    properties.list<{ id: string; name: string }>(supabase, userId, { columns: 'id,name', orderBy: 'name' })
      .then(setOrgProps);
  }, [userId, supabase]);

  // ΤΟ ΣΧΗΜΑ ΤΩΝ ΔΥΟ ΕΡΩΤΗΜΑΤΩΝ, ΓΡΑΜΜΕΝΟ ΜΙΑ ΦΟΡΑ.
  // Το δεύτερο ερώτημα ζητά ΛΙΓΟΤΕΡΕΣ στήλες, οπότε ο τύπος του διαφέρει — και
  // το `as unknown as { data: typeof data }` έσβηνε τη διαφορά αντί να τη
  // δηλώσει. Δηλαδή αν κάποιος πρόσθετε στήλη στο πρώτο ερώτημα και ξεχνούσε το
  // δεύτερο, η εφεδρική διαδρομή θα γύριζε αντικείμενα χωρίς αυτή τη στήλη και
  // η οθόνη θα διάβαζε `undefined` χωρίς κανένα ίχνος.
  type MemberRow = Pick<Member, 'email'|'role'|'status'|'joined_at'|'user_id'|'can_edit'|'edit_requested_at'>
    & Partial<Pick<Member, 'property_scope'|'can_view_financials'>>;

  const loadMembers = async (orgId: string) => {
    const cols = 'email, role, status, joined_at, user_id, can_edit, edit_requested_at';
    const q = (sel: string) =>
      supabase.from('organization_members').select(sel).eq('org_id', orgId).order('invited_at');
    const first = await q(`${cols}, property_scope, can_view_financials`);
    // Βάση χωρίς τις νέες στήλες: γύρνα στο βασικό σχήμα αντί να μείνει κενή η λίστα.
    const rows = (first.error ? (await q(cols)).data : first.data) as MemberRow[] | null;
    setMembers((rows ?? []).map(m => ({
      ...m,
      // Οι δύο στήλες ΛΕΙΠΟΥΝ στην εφεδρική διαδρομή. Οι προεπιλογές λένε
      // «όλα τα ακίνητα» και «βλέπει οικονομικά», δηλαδή ό,τι ίσχυε πριν
      // υπάρξουν οι στήλες — καμία σιωπηλή αφαίρεση δικαιώματος.
      property_scope: m.property_scope ?? null,
      can_view_financials: m.can_view_financials !== false,
    })));
  };

  // Ενημέρωση δικαιωμάτων μέλους (εύρος ακινήτων / ορατότητα οικονομικών).
  const setMemberScope = async (email: string, patch: { property_scope?: string[] | null; can_view_financials?: boolean }) => {
    if (!org) return;
    setRowBusy(email); setMemberError(null);
    const { error } = await supabase.from('organization_members').update(patch).eq('org_id', org.id).eq('email', email);
    setRowBusy(null);
    if (error) setMemberError('Η αλλαγή δεν αποθηκεύτηκε.');
    else await loadMembers(org.id);
  };

  useEffect(() => {
    let active = true;
    (async () => {
      // 1) Είμαι ήδη μέλος ενεργού οργανισμού κάποιου άλλου;
      const { data: mine, error: mineError } = await supabase
        .from('organization_members')
        .select('org_id, role, can_edit, edit_requested_at, status')
        .eq('user_id', userId)
        .eq('status', 'active');
      if (!active) return;
      // ΤΟ ΜΕΛΟΣ ΕΒΛΕΠΕ ΤΗΝ ΟΨΗ ΤΟΥ ΙΔΙΟΚΤΗΤΗ ΟΤΑΝ Η ΑΝΑΓΝΩΣΗ ΑΠΕΤΥΧΕ.
      // Η αποτυχία γύριζε κενό, δηλαδή ό,τι ακριβώς και το «δεν ανήκω πουθενά»:
      // η οθόνη περνούσε στο ensure_organization κι έστηνε ΝΕΟ οργανισμό με
      // ιδιοκτήτη τον ίδιο τον χρήστη, με ενεργά «Πρόσκληση» και «Αλλαγή»
      // ονόματος, ενώ ο άνθρωπος ήταν ήδη μέλος της ομάδας κάποιου άλλου.
      // Τώρα η άγνωστη κατάσταση λέγεται καθαρά και δεν εμφανίζεται κουμπί.
      if (mineError) { setLoadError(true); setLoading(false); return; }

      const memberRow = (mine as MyRow[] | null)?.find(r => r.role !== 'owner');
      if (memberRow) {
        // ── ΟΨΗ ΜΕΛΟΥΣ: χωρίς ensure_organization (δεν δημιουργούμε φανταστικό οργανισμό)
        const { data: orgRow } = await supabase
          .from('organizations')
          .select('name, owner_user_id')
          .eq('id', memberRow.org_id)
          .maybeSingle();
        if (!active) return;
        setMe({
          orgId: memberRow.org_id,
          orgName: ((orgRow?.name as string | null) ?? '').trim(),
          role: memberRow.role,
          canEdit: !!memberRow.can_edit,
          editRequestedAt: memberRow.edit_requested_at,
        });
        setMode('member');
        setLoading(false);
        return;
      }

      // 2) ── ΟΨΗ ΙΔΙΟΚΤΗΤΗ
      const { data, error } = await supabase.rpc('ensure_organization');
      if (!active) return;
      if (error || !data) { setLoading(false); return; }
      const o = (Array.isArray(data) ? data[0] : data) as Org;
      setOrg(o);
      setNameDraft(o?.name ?? '');
      await loadMembers(o.id);
      if (active) { setMode('owner'); setLoading(false); }
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startEditName = () => { setNameDraft(org?.name ?? ''); setNameError(null); setNameSaved(false); setEditingName(true); };
  const cancelEditName = () => { setEditingName(false); setNameError(null); };

  const saveName = async () => {
    if (!org) return;
    const p_name = nameDraft.trim();
    setNameSaving(true); setNameError(null);
    const { error } = await supabase.rpc('rename_organization', { p_name });
    setNameSaving(false);
    if (error) { setNameError('Η αποθήκευση δεν ολοκληρώθηκε.'); return; }
    setOrg(prev => (prev ? { ...prev, name: p_name } : prev));
    void logActivity(supabase, 'org_renamed', 'organization', org.id, { name: p_name });
    setEditingName(false);
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2500);
  };

  const invite = async () => {
    if (!org) return;
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) { setInviteError('Δώσε ένα έγκυρο email.'); return; }
    setInviting(true); setInviteError(null); setInviteNote(null);
    const { error } = await supabase.rpc('invite_org_member', { p_email: email, p_role: 'member' });
    if (error) { setInviteError('Η πρόσκληση δεν στάλθηκε.'); setInviting(false); return; }
    void logActivity(supabase, 'member_invited', 'organization', org.id, { email });
    // Πραγματικό email πρόσκλησης (best-effort): η εγγραφή στη βάση είναι η πηγή
    // αλήθειας· αν το email δεν σταλεί, το μέλος αποκτά πρόσβαση συνδεόμενο κανονικά.
    let mailed = false;
    try {
      const { data } = await supabase.functions.invoke('send-org-invite', { body: { email } });
      mailed = !!(data as { sent?: boolean } | null)?.sent;
    } catch { /* σιωπηλά */ }
    setInviteNote(mailed
      ? `Στάλθηκε πρόσκληση με email στο ${email}.`
      : `Ο ${email} προστέθηκε. Θα αποκτήσει πρόσβαση μόλις συνδεθεί με αυτό το email.`);
    setInviteEmail('');
    await loadMembers(org.id);
    setInviting(false);
    setTimeout(() => setInviteNote(null), 6000);
  };

  const revoke = async (email: string) => {
    if (!org) return;
    setRowBusy(email); setRowError(null);
    const { error } = await supabase.rpc('revoke_org_member', { p_email: email });
    if (error) setRowError('Η αφαίρεση δεν ολοκληρώθηκε.');
    else { void logActivity(supabase, 'member_revoked', 'organization', org.id, { email }); await loadMembers(org.id); }
    setRowBusy(null);
  };

  // Ιδιοκτήτης: ορίζει/εγκρίνει δικαιώματα επεξεργασίας ανά μέλος
  const setMemberEdit = async (email: string, can: boolean) => {
    if (!org) return;
    setRowBusy(email); setRowError(null);
    const { error } = await supabase.rpc('set_member_edit', { p_email: email, p_can: can });
    if (error) setRowError('Η αλλαγή πρόσβασης δεν ολοκληρώθηκε.');
    else { void logActivity(supabase, can ? 'member_edit_granted' : 'member_edit_revoked', 'organization', org.id, { email }); await loadMembers(org.id); }
    setRowBusy(null);
  };

  // Ιδιοκτήτης: σβήνει το αίτημα αναβάθμισης αφού το δει
  const clearUpgrade = async () => {
    const { error } = await supabase.rpc('clear_org_upgrade_request');
    if (error) return;
    setOrg(prev => (prev ? { ...prev, upgrade_requested_at: null } : prev));
  };

  // Μέλος: ζητά δικαιώματα επεξεργασίας
  const requestEdit = async () => {
    setMemberBusy(true); setMemberError(null);
    const { error } = await supabase.rpc('request_member_edit');
    setMemberBusy(false);
    if (error) { setMemberError('Το αίτημα δεν στάλθηκε.'); return; }
    setEditSent(true);
  };

  // Μέλος: ζητά αναβάθμιση συνδρομής
  const requestUpgrade = async () => {
    setMemberBusy(true); setMemberError(null);
    const { error } = await supabase.rpc('request_org_upgrade');
    setMemberBusy(false);
    if (error) { setMemberError('Το αίτημα δεν στάλθηκε.'); return; }
    setUpgradeSent(true);
  };

  // Σκελετός στη θέση του γυμνού «Φόρτωση…»: το σχήμα της λίστας μελών είναι
  // γνωστό, οπότε η σελίδα δεν αναδιατάσσεται μόλις φτάσουν τα δεδομένα.
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '20px 0' }}>
        <Skeleton w={120} h={11} />
        {[0, 1, 2].map(i => <Skeleton key={i} h={48} r={10} />)}
      </div>
    );
  }

  // Ούτε όψη ιδιοκτήτη ούτε όψη μέλους: δεν διαβάστηκε η ιδιότητα του χρήστη.
  if (loadError) {
    return (
      <EmptyState
        icon={<Users size={20} />}
        title="Δεν φορτώθηκαν τα στοιχεία της ομάδας"
        hint="Δεν καταφέραμε να διαβάσουμε αν ανήκεις σε οργανισμό. Ανανέωσε τη σελίδα και δοκίμασε ξανά σε λίγο."
      />
    );
  }

  // ═══ ΟΨΗ ΜΕΛΟΥΣ ═══════════════════════════════════════════════════════════
  if (mode === 'member' && me) {
    const editPending = !me.canEdit && (me.editRequestedAt != null || editSent);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── Ο οργανισμός σου ─────────────────────────────────────────── */}
        <section className="acc-section">
          <div style={subLabel}>Ο οργανισμός σου</div>
          <div style={{
            marginTop: 12, fontSize: 15, fontWeight: 600, fontFamily: T.font.sans, color: 'var(--text-primary)',
          }}>
            {me.orgName ? `Είσαι μέλος του οργανισμού: ${me.orgName}` : 'Είσαι μέλος ενός οργανισμού.'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <RoleChip role={me.role} />
            <AccessChip canEdit={me.canEdit} />
          </div>
        </section>

        {/* ── Δικαιώματα επεξεργασίας ──────────────────────────────────── */}
        <section className="acc-section" style={{ animationDelay: '60ms' }}>
          <div style={subLabel}>Δικαιώματα επεξεργασίας</div>
          <div style={descStyle}>Η πρόσβασή σου στο χαρτοφυλάκιο του οργανισμού.</div>
          <div style={{ marginTop: 12 }}>
            {me.canEdit ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--positive)', fontFamily: T.font.sans }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--positive)', flexShrink: 0 }} />
                Έχεις δικαιώματα επεξεργασίας στο χαρτοφυλάκιο.
              </div>
            ) : editPending ? (
              <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text-tertiary)', fontFamily: T.font.sans }}>
                Το αίτημα επεξεργασίας στάλθηκε στον ιδιοκτήτη.
              </div>
            ) : (
              <Btn variant="secondary" onClick={requestEdit} disabled={memberBusy}>Ζήτησε δικαιώματα επεξεργασίας</Btn>
            )}
          </div>
        </section>

        {/* ── Αναβάθμιση συνδρομής ─────────────────────────────────────── */}
        <section className="acc-section" style={{ animationDelay: '120ms' }}>
          <div style={subLabel}>Αναβάθμιση συνδρομής</div>
          <div style={descStyle}>Ζήτησε από τον ιδιοκτήτη να αναβαθμίσει τη συνδρομή του οργανισμού.</div>
          <div style={{ marginTop: 12 }}>
            {upgradeSent ? (
              <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text-tertiary)', fontFamily: T.font.sans }}>
                Το αίτημα στάλθηκε στον ιδιοκτήτη.
              </div>
            ) : (
              <Btn variant="secondary" onClick={requestUpgrade} disabled={memberBusy}>Ζήτησε αναβάθμιση συνδρομής</Btn>
            )}
          </div>
        </section>

        {memberError && <div style={errStyle}>{memberError}</div>}

        {/* ── Ειλικρινής σημείωση (μία γραμμή) ─────────────────────────── */}
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5, fontFamily: T.font.sans, paddingTop: 2 }}>
          Η επεξεργασία ενεργοποιείται μόνο αφού ο ιδιοκτήτης εγκρίνει το αίτημά σου.
        </div>
      </div>
    );
  }

  const nameEmpty = !org?.name?.trim();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Αίτημα αναβάθμισης από μέλος ──────────────────────────────── */}
      {org?.upgrade_requested_at && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
          borderRadius: T.radius.inner, padding: '10px 16px',
        }}>
          <span style={{ flex: 1, minWidth: 200, fontSize: 12, color: 'var(--text-secondary)', fontFamily: T.font.sans, lineHeight: 1.5 }}>
            Ένα μέλος σου ζήτησε αναβάθμιση συνδρομής.
          </span>
          <Btn variant="secondary" onClick={clearUpgrade}>Το είδα</Btn>
        </div>
      )}

      {/* ── Όνομα οργανισμού ─────────────────────────────────────────── */}
      <section className="acc-section">
        <div style={subLabel}>Όνομα οργανισμού</div>
        <div style={descStyle}>Η ονομασία που βλέπει η ομάδα σου.</div>

        {editingName ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            <input
              type="text"
              aria-label="Ονομασία ομάδας"
              className="po-field"
              value={nameDraft}
              onChange={e => setNameDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void saveName(); if (e.key === 'Escape') cancelEditName(); }}
              placeholder="Η επωνυμία του γραφείου σου"
              autoFocus
              style={{ ...fieldStyle, flex: 1, minWidth: 220 }}
            />
            <Btn variant="primary" onClick={saveName} disabled={nameSaving}>
              {nameSaving ? 'Αποθήκευση…' : 'Αποθήκευση'}
            </Btn>
            <Btn variant="secondary" onClick={cancelEditName} disabled={nameSaving}>Ακύρωση</Btn>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
            <span style={{
              flex: 1, minWidth: 200, fontSize: 15, fontWeight: 600, fontFamily: T.font.sans,
              color: nameEmpty ? 'var(--text-tertiary)' : 'var(--text-primary)',
            }}>
              {nameEmpty ? 'Η επωνυμία του γραφείου σου' : org?.name}
            </span>
            {nameSaved && (
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--positive)', fontFamily: T.font.sans }}>Αποθηκεύτηκε ✓</span>
            )}
            <Btn variant="secondary" onClick={startEditName}>Αλλαγή</Btn>
          </div>
        )}
        {nameError && <div style={errStyle}>{nameError}</div>}
      </section>

      {/* ── Μέλη ─────────────────────────────────────────────────────── */}
      <section className="acc-section" style={{ animationDelay: '60ms' }}>
        <div style={subLabel}>Μέλη</div>
        <div style={descStyle}>Η ομάδα του οργανισμού σου.</div>

        {members.length === 0 ? (
          <EmptyState
            icon={<Users size={20} />}
            title="Κανένα μέλος ακόμη"
            hint="Πρόσκαλεσε συνεργάτες και δώσε τους πρόσβαση σε συγκεκριμένα ακίνητα."
          />
        ) : (
          /* ΤΟ ΜΗΤΡΩΟ ΗΤΑΝ ΠΛΕΓΜΑ ΑΠΟ divs ΜΕ ΤΙΣ ΣΤΗΛΕΣ ΓΡΑΜΜΕΝΕΣ ΔΥΟ ΦΟΡΕΣ.
             Η κεφαλίδα κι η γραμμή δεδομένων μοιράζονταν τη σταθερά ROW_COLS —
             πέντε στήλες που έμεναν ευθυγραμμισμένες μόνο όσο κανείς δεν ξεχνούσε
             το ένα από τα δύο σημεία. Και καμία σχέση κελιού-κεφαλίδας δεν έφτανε
             στον αναγνώστη οθόνης: πέντε ανώνυμα divs ανά μέλος.

             Τώρα το `<th scope>` λέει ποια στήλη κρατά το κελί, τα πλάτη γράφονται
             ΜΙΑ φορά στο `<colgroup>`. Το ελάχιστο πλάτος ξαναμετρήθηκε, γιατί το
             πλέγμα χώριζε τις στήλες με κενά 16 ενώ ο πίνακας τις χωρίζει με το
             γέμισμα των κελιών (14 εκατέρωθεν): 882 περιεχόμενο + 112 στα τέσσερα
             εσωτερικά όρια + 28 στις δύο άκρες = 1.022, στη θέση των 960. */
          <div className="po-table-box" style={{ marginTop: 12 }}>
            <div className="po-scroll-x">
              <table className="po-table tbl-fixed" style={{ ['--tbl-min' as string]: '1022px' } as CSSProperties}>
                <caption>Μέλη του οργανισμού</caption>
                {/* Τα πλάτη του παλιού gridTemplateColumns, με το γέμισμα του κελιού
                    μέσα τους. Η πρώτη στήλη μένει αδήλωτη: παίρνει ό,τι περισσεύει,
                    όπως έκανε το minmax(180px, 1fr). */}
                <colgroup>
                  <col />
                  <col style={{ width: 132 }} />
                  <col style={{ width: 144 }} />
                  <col style={{ width: 278 }} />
                  <col style={{ width: 260 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col">Μέλος</th>
                    <th scope="col">Ρόλος</th>
                    <th scope="col">Κατάσταση</th>
                    <th scope="col">Πρόσβαση</th>
                    {/* Η στήλη των ενεργειών ήταν κενό div: για το μάτι μένει κενή,
                        ο αναγνώστης οθόνης όμως χρειάζεται όνομα στη στήλη. */}
                    <th scope="col"><span className="sr-only">Ενέργειες</span></th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m, i) => {
                    const isOwner = m.role === 'owner';
                    const isYou = m.user_id != null && m.user_id === userId;
                    const canAct = !isOwner && m.status !== 'revoked';
                    const busy = rowBusy === m.email;
                    const permsOpen = openPerms === m.email;
                    const scoped = (m.property_scope?.length ?? 0) > 0;
                    // Η ΤΡΙΧΑ ΧΩΡΙΣΜΟΥ ΑΝΗΚΕΙ ΣΤΟ ΜΕΛΟΣ, ΟΧΙ ΣΤΗ ΣΕΙΡΑ. Το πλαίσιο
                    // δικαιωμάτων είναι δεύτερο <tr> του ΙΔΙΟΥ μέλους, οπότε η γραμμή
                    // του πίνακα σβήνει από την πρώτη σειρά κι πέφτει κάτω από τη
                    // δεύτερη — αλλιώς κάθε μέλος θα φαινόταν σαν δύο.
                    // Κατακόρυφα στο κέντρο: ο πίνακας κρεμά τα κελιά από πάνω, όμως
                    // το κουμπί της σειράς είναι 36 ψηλό δίπλα σε γραμμή email 20,
                    // δηλαδή το email έπεφτε 8 πάνω από το κέντρο του.
                    const cell: CSSProperties = { verticalAlign: 'middle', ...(canAct ? { borderBottom: 'none' } : null) };
                    return (
                      <Fragment key={m.email || `row-${i}`}>
                      <tr style={{ opacity: m.status === 'revoked' ? 0.55 : 1 }}>
                        {/* Μέλος (email + «Εσύ») */}
                        <th scope="row" style={cell}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            <span style={{
                              fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-primary)', fontFamily: T.font.sans,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>{m.email || ABSENT}</span>
                            {isYou && <Chip tone="neutral">Εσύ</Chip>}
                          </div>
                        </th>

                        {/* Ρόλος */}
                        <td style={cell}><RoleChip role={m.role} /></td>

                        {/* Κατάσταση */}
                        <td style={cell}><StatusChip status={m.status} /></td>

                        {/* Πρόσβαση: έγκριση αιτήματος ή τμηματικός έλεγχος Ανάγνωση/Επεξεργασία */}
                        <td style={cell}>
                          {canAct && (
                            m.edit_requested_at && !m.can_edit ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <Chip tone="accent">Ζητά επεξεργασία</Chip>
                                <Btn variant="primary" onClick={() => setMemberEdit(m.email, true)} disabled={busy}>Έγκριση</Btn>
                                <Btn variant="secondary" onClick={() => setMemberEdit(m.email, false)} disabled={busy}>Όχι</Btn>
                              </div>
                            ) : (
                              // seg επειδή η ράγα έχει ήδη δικό της περίγραμμα με ακτίνα: το ενεργό ξεχωρίζει με επιφάνεια αντί για δεύτερη γραμμή
                              <div style={{ display: 'inline-flex', border: '1px solid var(--border-default)', borderRadius: T.radius.chip, overflow: 'hidden', opacity: busy ? 0.6 : 1 }}>
                                <ChipToggle on={!m.can_edit} disabled={busy} shape="seg" onClick={() => { if (m.can_edit) void setMemberEdit(m.email, false); }}>Ανάγνωση</ChipToggle>
                                <ChipToggle on={m.can_edit} disabled={busy} shape="seg" onClick={() => { if (!m.can_edit) void setMemberEdit(m.email, true); }}>Επεξεργασία</ChipToggle>
                              </div>
                            )
                          )}
                        </td>

                        {/* Ενέργειες */}
                        <td style={cell}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {canAct && (
                              <Btn variant="secondary" onClick={() => revoke(m.email)} disabled={busy}>Αφαίρεση</Btn>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Δικαιώματα ανά μέλος: εύρος ακινήτων και ορατότητα οικονομικών.
                          Μαζεμένα by default — η γραμμή μένει καθαρή, οι λεπτομέρειες on demand.
                          Δεύτερη σειρά με colSpan: το πλαίσιο κάθεται κάτω από το μέλος του,
                          μέσα στον ίδιο πίνακα, χωρίς να σπάει τις πέντε στήλες. */}
                      {canAct && (
                        <tr>
                          <td colSpan={5} style={{ paddingTop: 0, paddingBottom: 12 }}>
                            <button onClick={() => setOpenPerms(permsOpen ? null : m.email)} aria-expanded={!!permsOpen}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: T.font.sans }}>
                              <svg aria-hidden="true" width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-tertiary)', transform: permsOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}><path d="M9 6l6 6-6 6" /></svg>
                              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Δικαιώματα</span>
                              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                                {scoped ? `${m.property_scope!.length} ακίνητα` : 'Όλα τα ακίνητα'} · {m.can_view_financials ? 'με οικονομικά' : 'χωρίς οικονομικά'}
                              </span>
                            </button>

                            {permsOpen && (
                              <div style={{ marginTop: 12, padding: 14, borderRadius: T.radius.popup, background: 'var(--bg-base)', display: 'flex', flexDirection: 'column', gap: 14 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                  <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-primary)', fontFamily: T.font.sans }}>Οικονομικά στοιχεία</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: T.font.sans, marginTop: 2 }}>Ενοίκια, δαπάνες, λογαριασμοί, δάνεια και λογιστική.</div>
                                  </div>
                                  <div style={{ display: 'inline-flex', border: '1px solid var(--border-default)', borderRadius: T.radius.chip, overflow: 'hidden', opacity: busy ? 0.6 : 1 }}>
                                    <ChipToggle on={m.can_view_financials} disabled={busy} shape="seg" onClick={() => { if (!m.can_view_financials) void setMemberScope(m.email, { can_view_financials: true }); }}>Ορατά</ChipToggle>
                                    <ChipToggle on={!m.can_view_financials} disabled={busy} shape="seg" onClick={() => { if (m.can_view_financials) void setMemberScope(m.email, { can_view_financials: false }); }}>Κρυφά</ChipToggle>
                                  </div>
                                </div>

                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: scoped ? 10 : 0 }}>
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                      <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-primary)', fontFamily: T.font.sans }}>Ακίνητα</div>
                                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: T.font.sans, marginTop: 2 }}>Σε ποια ακίνητα έχει πρόσβαση το μέλος.</div>
                                    </div>
                                    <div style={{ display: 'inline-flex', border: '1px solid var(--border-default)', borderRadius: T.radius.chip, overflow: 'hidden', opacity: busy ? 0.6 : 1 }}>
                                      <ChipToggle on={!scoped} disabled={busy} shape="seg" onClick={() => { if (scoped) void setMemberScope(m.email, { property_scope: null }); }}>Όλα</ChipToggle>
                                      <ChipToggle on={scoped} disabled={busy} shape="seg" onClick={() => { if (!scoped && orgProps[0]) void setMemberScope(m.email, { property_scope: [orgProps[0].id] }); }}>Επιλεγμένα</ChipToggle>
                                    </div>
                                  </div>
                                  {scoped && (
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                      {orgProps.map(p => {
                                        const on = m.property_scope!.includes(p.id);
                                        return (
                                          <ChipToggle key={p.id} on={on} disabled={busy}
                                            onClick={() => {
                                              const next = on ? m.property_scope!.filter(x => x !== p.id) : [...m.property_scope!, p.id];
                                              // Ποτέ κενή λίστα: κενό θα σήμαινε «όλα» και θα άνοιγε σιωπηλά την πρόσβαση.
                                              void setMemberScope(m.email, { property_scope: next.length ? next : [p.id] });
                                            }}>
                                            {on && <svg aria-hidden="true" width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
                                            {p.name}
                                          </ChipToggle>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {rowError && <div style={errStyle}>{rowError}</div>}
      </section>

      {/* ── Πρόσκληση μέλους ─────────────────────────────────────────── */}
      <section className="acc-section" style={{ animationDelay: '120ms' }}>
        <div style={subLabel}>Πρόσκληση μέλους</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          <input
            type="email"
            aria-label="Διεύθυνση ηλεκτρονικού ταχυδρομείου για πρόσκληση"
            className="po-field"
            value={inviteEmail}
            onChange={e => { setInviteEmail(e.target.value); if (inviteError) setInviteError(null); if (inviteNote) setInviteNote(null); }}
            onKeyDown={e => { if (e.key === 'Enter') void invite(); }}
            placeholder="Ηλεκτρονικό ταχυδρομείο του μέλους"
            style={{ ...fieldStyle, flex: 1, minWidth: 220 }}
          />
          <Btn variant="primary" onClick={invite} disabled={inviting || !inviteEmail.trim()}>
            {inviting ? 'Πρόσκληση…' : 'Πρόσκληση'}
          </Btn>
        </div>
        {inviteError && <div style={errStyle}>{inviteError}</div>}
        {inviteNote && (
          <div style={{ fontSize: 12, color: 'var(--positive)', fontFamily: T.font.sans, marginTop: 10, lineHeight: 1.5 }}>
            {inviteNote}
          </div>
        )}
        <div style={{ ...descStyle, marginTop: 10 }}>
          Στέλνουμε πρόσκληση με email. Το μέλος αποκτά πρόσβαση μόλις δημιουργήσει λογαριασμό με το ίδιο email και ξεκινά με δικαίωμα ανάγνωσης. Την επεξεργασία επιτρέπει ο ιδιοκτήτης από τη στήλη «Πρόσβαση».
        </div>
      </section>

      {/* ── Επεξήγηση ρόλων (μία γραμμή) ─────────────────────────────── */}
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5, fontFamily: T.font.sans, paddingTop: 2 }}>
Ο ιδιοκτήτης έχει την πλήρη διαχείριση. Κάθε μέλος κρίνεται από δύο πράγματα και μόνο από αυτά: την «Πρόσβαση», που επιτρέπει την επεξεργασία και τη διαγραφή και τα «Οικονομικά», που δείχνουν ενοίκια, δαπάνες, δάνεια και μισθωτές. Και τα δύο τα δίνεις εσύ.
      </div>
    </div>
  );
}
