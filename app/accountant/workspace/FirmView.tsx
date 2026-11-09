'use client';
// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΓΡΑΦΕΙΟ: ΜΕΛΗ, ΣΤΟΙΧΕΙΑ, ΙΣΤΟΡΙΚΟ
// ─────────────────────────────────────────────────────────────────────────
// ΜΙΑ ΚΥΡΙΑ ΚΙΝΗΣΗ: «Πρόσκληση μέλους». Ο ρόλος αλλάζει στη γραμμή του μέλους,
// με το ίδιο dropdown της εφαρμογής· η αφαίρεση ζει στο «⋯» της γραμμής, γιατί
// γίνεται σπάνια και δεν πρέπει να πατιέται κατά λάθος.
//
// ΤΑ ΣΤΟΙΧΕΙΑ ΤΟΥ ΓΡΑΦΕΙΟΥ ΤΑ ΑΛΛΑΖΕΙ ΜΟΝΟ Ο ΥΠΕΥΘΥΝΟΣ. Οι άλλοι τα διαβάζουν.
// Η βάση το επιβάλλει (firm_save, firm_member_update)· εδώ απλώς δεν δείχνεται
// κουμπί που θα αρνιόταν.
//
// ΤΟ ΙΣΤΟΡΙΚΟ ΤΟ ΒΛΕΠΕΙ Ο ΥΠΕΥΘΥΝΟΣ: ποιος άνοιξε ποιον πελάτη και πότε. Ο
// ιδιοκτήτης βλέπει το ίδιο για τον εαυτό του στη Λογιστική του.
//
// ΖΕΙ ΜΕΣΑ ΣΤΗ ΔΙΑΔΡΟΜΗ ΤΟΥ ΧΩΡΟΥ (`/accountant/workspace?view=firm`), ΟΧΙ ΣΕ
// ΔΙΚΗ ΤΗΣ. Κάθε σελίδα του App Router γίνεται ξεχωριστή συνάρτηση διακομιστή
// με το δικό της αντίγραφο του Next (scripts/server-weight.mjs): μια οθόνη
// που τρέχει ολόκληρη στον περιηγητή δεν αξίζει 2,4 MB σε κάθε ανάπτυξη.
// Κληρονομεί και το `noindex` του χώρου (workspace/layout.tsx).
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { T, TT, Card, Btn, Modal, Skeleton, EmptyState, fd, ABSENT, fieldRow } from '@/components/Theme';
import { ActionMenu } from '@/components/ActionMenu';
import { TextInput, Textarea, CustomSelect } from '@/app/dashboard/components/UIComponents';
import { notify, notifyError } from '@/components/Toast';
import { confirmDialog } from '@/components/confirmBus';
import { isValidAfm } from '@/lib/core/greek';
import { PortalBar, PortalTitle, portalWrap } from '../Chrome';
import { History } from 'lucide-react';
import {
  myFirm, saveFirm, invite, setRole, removeMember, accessHistory, reasonText,
  ROLE_LABEL, ROLE_HINT, ROLES, KIND_LABEL, ACTION_LABEL, canManage,
  type Firm, type FirmFields, type FirmKind, type FirmRole, type AccessEntry,
} from '@/lib/data/firms';

const label: React.CSSProperties = { ...TT.label, color: 'var(--text-tertiary)', margin: 0 };
const note: React.CSSProperties = { fontSize: 'var(--fs-note)', color: 'var(--text-tertiary)', margin: 0, fontFamily: T.font.sans, lineHeight: 1.6 };
const num: React.CSSProperties = { fontVariantNumeric: 'tabular-nums' };
const HISTORY_SHOWN = 20;
/**
 * Η στήλη των ρόλων: χωρά το «Υπεύθυνος γραφείου» με το βέλος του και τίποτα
 * παραπάνω. Ηταν 236 και στον υπολογιστή το dropdown έμοιαζε με πεδίο φόρμας
 * σε μια λίστα ανθρώπων.
 */
const ROLE_COL = 220;

const emptyFields = (f?: Firm | null): FirmFields => ({
  name: f?.name ?? '', afm: f?.afm ?? '', kind: f?.kind ?? 'accounting', phone: f?.phone ?? '', address: f?.address ?? '',
});

export default function FirmView() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [firm, setFirm] = useState<Firm | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [fields, setFields] = useState<FirmFields>(emptyFields());
  const [saving, setSaving] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [sending, setSending] = useState(false);
  const [inv, setInv] = useState<{ email: string; role: FirmRole }>({ email: '', role: 'accountant' });
  const [invErr, setInvErr] = useState('');
  const [history, setHistory] = useState<AccessEntry[] | null>(null);
  const [allHistory, setAllHistory] = useState(false);
  // Ο συνδεδεμένος, για να δείχνεται η «Αποχώρηση» στη δική του γραμμή.
  const [me, setMe] = useState<string | null>(null);
  // ΤΟ ΟΝΟΜΑ ΤΟΥ ΛΟΓΑΡΙΑΣΜΟΥ ΜΟΥ, ΟΤΑΝ ΤΟ ΠΡΟΦΙΛ ΔΕΝ ΕΧΕΙ. Η βάση δίνει όνομα μόνο
  // από το προφίλ τιμολόγησης· ο λογαριασμός γραφείου συχνά δεν έχει. Η
  // δική μου γραμμή έδειχνε σκέτο email.
  const [myName, setMyName] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setMe(data.user?.id ?? null);
      const m = (data.user?.user_metadata ?? {}) as Record<string, unknown>;
      const n = [m.full_name, m.name].find(v => typeof v === 'string' && v.trim()) as string | undefined;
      setMyName(n?.trim() ?? null);
    });
  }, [supabase]);

  const load = useCallback(async () => {
    const r = await myFirm(supabase);
    if (!r.ok) { setFailed(true); return; }
    setFailed(false);
    setFirm(r.data);
    setFields(emptyFields(r.data));
    if (r.data && canManage(r.data.role)) {
      const h = await accessHistory(supabase);
      setHistory(h.ok ? h.data : []);
    }
  }, [supabase]);

  useEffect(() => {
    let alive = true;
    myFirm(supabase).then(async r => {
      if (!alive) return;
      if (!r.ok) { setFailed(true); return; }
      setFirm(r.data);
      setFields(emptyFields(r.data));
      if (r.data && canManage(r.data.role)) {
        const h = await accessHistory(supabase);
        if (alive) setHistory(h.ok ? h.data : []);
      }
    });
    return () => { alive = false; };
  }, [supabase]);

  const manager = canManage(firm?.role);
  const afmBad = fields.afm.trim() !== '' && !isValidAfm(fields.afm);
  const dirty = !!firm && JSON.stringify(emptyFields(firm)) !== JSON.stringify(fields);

  const save = async () => {
    if (afmBad || !fields.name.trim()) return;
    setSaving(true);
    const r = await saveFirm(supabase, { ...fields, name: fields.name.trim(), afm: fields.afm.trim() });
    setSaving(false);
    if (!r.ok) { notifyError(reasonText(r.reason)); return; }
    notify('Τα στοιχεία του γραφείου αποθηκεύτηκαν.');
    await load();
  };

  const sendInvite = async () => {
    // ΕΝΑ ΠΑΤΗΜΑ, ΜΙΑ ΠΡΟΣΚΛΗΣΗ. Το κουμπί έμενε ενεργό όσο έτρεχε η κλήση: το
    // διπλό πάτημα στο τηλέφωνο έβγαζε «Η πρόσκληση στάλθηκε.» και αμέσως
    // «Η διεύθυνση είχε ήδη πρόσκληση.», δύο αντιφατικά μηνύματα για μία πράξη.
    if (sending) return;
    setInvErr(''); setSending(true);
    const r = await invite(supabase, inv.email.trim(), inv.role);
    setSending(false);
    if (!r.ok) { setInvErr(reasonText(r.reason)); return; }
    setInviting(false);
    setInv({ email: '', role: 'accountant' });
    notify(r.data?.existing ? 'Η διεύθυνση είχε ήδη πρόσκληση.' : 'Η πρόσκληση στάλθηκε.');
    await load();
  };

  const changeRole = async (id: string, role: FirmRole) => {
    const r = await setRole(supabase, id, role);
    if (!r.ok) notifyError(reasonText(r.reason));
    await load();
  };

  const remove = async (id: string, who: string, invited: boolean, self: boolean) => {
    const ok = await confirmDialog({
      title: self ? 'Αποχώρηση από το γραφείο' : invited ? 'Ακύρωση πρόσκλησης' : `Αφαίρεση μέλους: ${who}`,
      message: self
        ? 'Δεν θα βλέπεις πια τους πελάτες του γραφείου.'
        : invited ? 'Η πρόσκληση παύει να ισχύει.' : 'Χάνει αμέσως την πρόσβαση στους πελάτες του γραφείου. Οι αναθέσεις του σβήνονται.',
      confirmLabel: self ? 'Αποχώρηση' : invited ? 'Ακύρωση πρόσκλησης' : 'Αφαίρεση',
      tone: 'negative',
    });
    if (!ok) return;
    const r = await removeMember(supabase, id);
    if (!r.ok) { notifyError(reasonText(r.reason)); return; }
    if (self) { router.push('/accountant/workspace'); return; }
    await load();
  };

  const wrap = portalWrap;

  return (
    <div className="po-floor" style={{ background: 'var(--bg-base)', minHeight: '100vh', paddingBottom: 72 }}>
      <PortalBar back={{ href: '/accountant/workspace', label: 'Οι πελάτες' }} firmOnly={firm?.firmOnly} />
      <main style={wrap}>
        {failed ? (
          <Card style={{ marginTop: T.sp.xl }}>
            <p style={{ ...note, color: 'var(--text-secondary)', marginBottom: T.sp.md }}>Δεν φόρτωσαν τα στοιχεία του γραφείου. Δεν σημαίνει ότι λείπουν· απλώς δεν πήραμε απάντηση.</p>
            <Btn onClick={() => void load()}>Δοκίμασε ξανά</Btn>
          </Card>
        ) : firm === undefined ? (
          <div style={{ marginTop: T.sp.xl, display: 'grid', gap: T.sp.md }} aria-busy="true">
            <Skeleton h={64} /><Card><Skeleton h={120} /></Card>
          </div>
        ) : firm === null ? (
          <>
            <PortalTitle over="Νέο γραφείο" title="Τα στοιχεία του γραφείου"
              meta="Η επωνυμία φαίνεται στους ιδιοκτήτες που σε εξουσιοδοτούν και στα μέλη που προσκαλείς." />
            <Card>
              <FirmForm fields={fields} onChange={setFields} afmBad={afmBad} disabled={saving} />
              <div style={{ marginTop: T.sp.xl }}>
                <Btn variant="primary" onClick={() => void save()} disabled={saving || afmBad || !fields.name.trim()}>
                  {saving ? 'Δημιουργία…' : 'Δημιουργία γραφείου'}
                </Btn>
              </div>
            </Card>
          </>
        ) : (
          <>
            <PortalTitle
              over={KIND_LABEL[firm.kind]}
              title={firm.name}
              meta={[firm.afm ? `ΑΦΜ ${firm.afm}` : '', ROLE_LABEL[firm.role]].filter(Boolean).join(' · ')}
              right={manager ? <Btn variant="primary" onClick={() => { setInvErr(''); setInviting(true); }}>Πρόσκληση μέλους</Btn> : undefined}
            />

            {/* ── ΜΕΛΗ ── */}
            {/* ΣΤΟ ΤΗΛΕΦΩΝΟ Ο ΡΟΛΟΣ ΠΙΑΝΕΙ ΤΗ ΣΕΙΡΑ ΤΟΥ (08/11/2026). Η στήλη των
                236 στοιχίζει τους ρόλους σε φαρδιά οθόνη· στα 390, όταν πέφτει
                κάτω από το όνομα, άφηνε ένα dropdown ως τη μέση και το «σε
                αναμονή» της πρόσκλησης 16 εικονοστοιχεία πιο μέσα από τα ονόματα. */}
            <style>{`@media (max-width:560px){.firm-role-side{flex:1 1 100%!important}.firm-role-col{flex:1 1 auto!important;width:auto!important;padding-left:0!important}}`}</style>
            <section aria-labelledby="firm-members">
              <h2 id="firm-members" style={{ ...label, margin: `0 0 ${T.sp.sm}px` }}>Μέλη</h2>
              <Card gap={false} style={{ padding: 0 }}>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {firm.members.map((m, i) => {
                    const self = m.status === 'active' && m.userId != null && m.userId === me;
                    const name = m.name || (self ? myName : null);
                    const who = name || m.email;
                    const invited = m.status === 'invited';
                    const menu = manager || self;
                    return (
                      <li key={m.id} style={{
                        display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
                        gap: T.sp.md, padding: `${T.sp.md}px ${T.sp.lg}px`,
                        borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)',
                      }}>
                        <div style={{ minWidth: 0, flex: '1 1 240px' }}>
                          <p style={{ fontSize: 'var(--fs-md)', fontWeight: 600, margin: 0, color: 'var(--text-primary)', fontFamily: T.font.sans, overflowWrap: 'anywhere' }}>{who}</p>
                          <p style={{ ...note, marginTop: 2 }}>
                            {name ? `${m.email} · ` : ''}
                            {invited
                              ? <span style={num}>{`Πρόσκληση στις ${fd(m.invitedAt)}`}</span>
                              : <span style={num}>{`${m.clients === 1 ? '1 πελάτης' : `${m.clients} πελάτες`}${m.joinedAt ? ` · από ${fd(m.joinedAt)}` : ''}`}</span>}
                          </p>
                        </div>
                        <div className="firm-role-side" style={{ display: 'flex', alignItems: 'center', gap: T.sp.sm, flex: '0 1 auto', minWidth: 0 }}>
                          {manager && !invited ? (
                            <div className="firm-role-col" style={{ width: ROLE_COL }}>
                              <CustomSelect ariaLabel={`Ρόλος: ${who}`} value={m.role}
                                onChange={v => void changeRole(m.id, v as FirmRole)}
                                options={ROLES.map(r => ({ value: r, label: ROLE_LABEL[r] }))} />
                            </div>
                          ) : (
                            /* Ίδιο πλάτος με το dropdown: η στήλη των ρόλων στοιχίζεται και χωρίς αυτό. */
                            <span className="firm-role-col" style={{ flex: '0 1 auto', width: manager ? ROLE_COL : undefined, paddingLeft: manager ? 16 : 0, boxSizing: 'border-box', fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', fontFamily: T.font.sans, whiteSpace: 'nowrap' }}>
                              {invited ? `${ROLE_LABEL[m.role]} · σε αναμονή` : ROLE_LABEL[m.role]}
                            </span>
                          )}
                          {menu && (
                            <ActionMenu iconOnly label={`Ενέργειες για ${who}`} title={`Ενέργειες για ${who}`} items={[{
                              key: 'remove',
                              label: self ? 'Αποχώρηση από το γραφείο' : invited ? 'Ακύρωση πρόσκλησης' : 'Αφαίρεση από το γραφείο',
                              danger: true,
                              onClick: () => void remove(m.id, who, invited, self),
                            }]} />
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </section>

            {/* ── ΣΤΟΙΧΕΙΑ ── */}
            <section aria-labelledby="firm-details" style={{ marginTop: T.sp.section }}>
              <h2 id="firm-details" style={{ ...label, margin: `0 0 ${T.sp.sm}px` }}>Στοιχεία γραφείου</h2>
              <Card gap={false}>
                {manager ? <FirmForm fields={fields} onChange={setFields} afmBad={afmBad} disabled={saving} /> : <FirmFacts firm={firm} />}
                {manager && (
                  <div style={{ marginTop: T.sp.xl }}>
                    <Btn variant="secondary" onClick={() => void save()} disabled={!dirty || saving || afmBad || !fields.name.trim()}>
                      {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
                    </Btn>
                  </div>
                )}
              </Card>
            </section>

            {/* ── ΙΣΤΟΡΙΚΟ ── */}
            {manager && (
              <section aria-labelledby="firm-history" style={{ marginTop: T.sp.section }}>
                <h2 id="firm-history" style={{ ...label, margin: `0 0 ${T.sp.sm}px` }}>Ιστορικό πρόσβασης</h2>
                {history !== null && history.length === 0 ? (
                  <EmptyState page icon={<History size={20} />} title="Κανένα άνοιγμα ακόμη"
                    hint="Εδώ φαίνεται ποιο μέλος άνοιξε ποιον πελάτη και πότε, μόλις ανοίξει ο πρώτος φάκελος." />
                ) : (
                <Card gap={false} style={history && history.length > 0 ? { padding: 0 } : undefined}>
                  {history === null ? <Skeleton h={48} /> : (
                    <>
                      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                        {(allHistory ? history : history.slice(0, HISTORY_SHOWN)).map((h, i) => (
                          <li key={`${h.at}-${i}`} style={{
                            display: 'grid', gridTemplateColumns: '96px minmax(0, 1fr)', gap: T.sp.md,
                            padding: `${T.sp.sm + 2}px ${T.sp.lg}px`, borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)',
                            fontSize: 'var(--fs-base)', fontFamily: T.font.sans, color: 'var(--text-secondary)', lineHeight: 1.5,
                          }}>
                            <span style={{ ...num, color: 'var(--text-tertiary)' }}>{fd(h.at)}</span>
                            <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                              <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{h.member}</strong>
                              {` · ${ACTION_LABEL[h.action] ?? h.action} · ${h.owner}`}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {history.length > HISTORY_SHOWN && !allHistory && (
                        <div style={{ padding: `${T.sp.sm}px ${T.sp.lg}px ${T.sp.md}px`, borderTop: '1px solid var(--border-subtle)' }}>
                          <Btn variant="ghost" onClick={() => setAllHistory(true)}>{`Όλο το ιστορικό (${history.length})`}</Btn>
                        </div>
                      )}
                    </>
                  )}
                </Card>
                )}
              </section>
            )}
          </>
        )}
      </main>

      <Modal open={inviting} onClose={() => setInviting(false)} title="Πρόσκληση μέλους" size="sm"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setInviting(false)}>Ακύρωση</Btn>
            <Btn variant="primary" onClick={() => void sendInvite()} disabled={sending || !inv.email.trim()}>Αποστολή</Btn>
          </>
        }>
        <div style={{ display: 'grid', gap: T.sp.lg }}>
          <TextInput label="Ηλεκτρονικό ταχυδρομείο" type="email" inputMode="email" value={inv.email}
            onChange={v => { setInv(s => ({ ...s, email: v })); setInvErr(''); }}
            onKeyDown={e => { if (e.key === 'Enter') void sendInvite(); }}
            placeholder="onoma@grafeio.gr" />
          <div>
            <CustomSelect label="Ρόλος" value={inv.role} onChange={v => setInv(s => ({ ...s, role: v as FirmRole }))}
              options={ROLES.map(r => ({ value: r, label: ROLE_LABEL[r] }))} />
            <p style={{ ...note, marginTop: T.sp.xs + 2 }}>{ROLE_HINT[inv.role]}</p>
          </div>
          {invErr && <p role="alert" style={{ ...note, color: 'var(--negative)' }}>{invErr}</p>}
        </div>
      </Modal>
    </div>
  );
}

/** Τα στοιχεία για όσους δεν τα αλλάζουν: κείμενο, όχι κλειδωμένα πεδία. */
function FirmFacts({ firm }: { firm: Firm }) {
  const rows: [string, string | null][] = [
    ['Επωνυμία', firm.name], ['ΑΦΜ', firm.afm], ['Είδος', KIND_LABEL[firm.kind]], ['Τηλέφωνο', firm.phone], ['Διεύθυνση', firm.address],
  ];
  return (
    <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(96px, auto) minmax(0, 1fr)', gap: `${T.sp.sm}px ${T.sp.lg}px`, margin: 0 }}>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'contents' }}>
          <dt style={{ ...note, color: 'var(--text-secondary)' }}>{k}</dt>
          <dd style={{ margin: 0, fontSize: 'var(--fs-md)', color: v ? 'var(--text-primary)' : 'var(--text-tertiary)', fontFamily: T.font.sans, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>{v || ABSENT}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Τα πέντε πεδία του γραφείου, ίδια στη δημιουργία και στην αλλαγή. */
export function FirmForm({ fields, onChange, afmBad, disabled }: {
  fields: FirmFields; onChange: (f: FirmFields) => void; afmBad: boolean; disabled?: boolean;
}) {
  const set = <K extends keyof FirmFields>(k: K) => (v: FirmFields[K]) => onChange({ ...fields, [k]: v });
  return (
    // ΣΕΙΡΑ ΠΕΔΙΩΝ ΠΟΥ ΓΕΜΙΖΕΙ ΤΟ ΠΛΑΤΟΣ (fieldRow), ΟΧΙ ΣΤΗΛΕΣ ΜΕ ΤΑΒΑΝΙ. Το
    // `formGrid(240, 380)` κρατούσε στήλες 380 το πολύ: στα 768 έβγαινε ΜΙΑ στήλη
    // 380 με τη μισή κάρτα άδεια δεξιά.
    <div {...fieldRow(240, T.sp.lg)}>
      {/* ΕΠΩΝΥΜΙΑ ΚΑΙ ΔΙΕΥΘΥΝΣΗ ΤΥΛΙΓΟΝΤΑΙ. Είναι μακριές στην πράξη και σε
          μονόγραμμο πεδίο κόβονταν στα 320 και στα 390. */}
      <div style={{ flexBasis: '100%' }}>
        <Textarea label="Επωνυμία" value={fields.name} onChange={set('name')} rows={1} autoGrow />
      </div>
      <div>
        <TextInput label="ΑΦΜ" value={fields.afm} onChange={v => set('afm')(v.replace(/\D/g, '').slice(0, 9))}
          inputMode="numeric" disabled={disabled} placeholder="123456789" />
        {afmBad && <p role="alert" style={{ ...note, color: 'var(--negative)', marginTop: T.sp.xs }}>Ο ΑΦΜ δεν είναι έγκυρος. Έλεγξε τα ψηφία.</p>}
      </div>
      <CustomSelect label="Είδος" value={fields.kind} onChange={v => set('kind')(v as FirmKind)} disabled={disabled}
        options={(Object.keys(KIND_LABEL) as FirmKind[]).map(k => ({ value: k, label: KIND_LABEL[k] }))} />
      <TextInput label="Τηλέφωνο" type="tel" inputMode="tel" value={fields.phone} onChange={set('phone')} disabled={disabled} />
      <div style={{ flexBasis: '100%' }}>
        <Textarea label="Διεύθυνση" value={fields.address} onChange={set('address')} rows={1} autoGrow />
      </div>
    </div>
  );
}
