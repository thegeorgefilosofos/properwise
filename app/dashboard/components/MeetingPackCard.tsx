'use client';
// ═══════════════════════════════════════════════════════════════════════════
// Ο ΦΑΚΕΛΟΣ ΓΙΑ ΤΟΝ ΛΟΓΙΣΤΗ, ΕΝΑΣ ΑΝΑ ΑΦΜ
// ─────────────────────────────────────────────────────────────────────────
// Το κουμπί που ο ιδιοκτήτης πατά πριν από τη συνάντηση με τον λογιστή του.
// Ενας φάκελος ανά υπόχρεο: σύνοψη σε PDF, Ε2, σύγκριση με το προσυμπληρωμένο,
// ανά ακίνητο, βραχυχρόνια, τι λείπει και τα παραστατικά ανά ακίνητο.
//
// ΔΥΟ ΚΙΝΗΣΕΙΣ, ΟΧΙ ΜΙΑ. «Κατέβασε» για να τον έχει ο ίδιος ή να τον στείλει
// όπως θέλει. «Στείλε στον λογιστή» για να τον βρει ο συνδεδεμένος λογιστής
// στη λίστα του. Ο λογιστής δεν φτιάχνει ποτέ φάκελο από τα δεδομένα του
// ιδιοκτήτη· βλέπει ΜΟΝΟ ό,τι του έστειλε ο ίδιος, όσο ισχύει η σύνδεση.
// ═══════════════════════════════════════════════════════════════════════════
import { EditDetailsLink } from './EditDetailsLink';
import { useEffect, useMemo, useState } from 'react';
import { Download, Send } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { T, TT, Btn, fd } from '@/components/Theme';
import { notify, notifyError } from '@/components/Toast';
import { downloadFile } from '@/lib/core/download';
import { fmtBytes } from '@/lib/core/bytes';
import { packStatuses, sharePack, ownerAfms, type PackStatus } from '@/lib/data/e2Prefilled';
import type { DossierContext } from '@/lib/accounting/dossier';
import type { CompletenessProperty, YearData } from '@/lib/facts/completeness';

const card: React.CSSProperties = { background: 'var(--surface-raised)', borderRadius: T.radius.card, padding: T.sp.lg, boxShadow: 'var(--elev-1)' };
const eyebrow: React.CSSProperties = { fontSize: 'var(--fs-xs)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontFamily: T.font.sans, margin: 0 };

export default function MeetingPackCard({ userId, year, ownerName, dossier, onEditProperty }: {
  userId: string;
  /** Ανοίγει τον οδηγό του ακινήτου στο ΑΦΜ του ιδιοκτήτη (EditDetailsLink). */
  onEditProperty?: (propertyId: string) => void;
  year: number;
  ownerName: string | null;
  dossier: Omit<DossierContext, 'statuses' | 'properties'> & { have: readonly string[]; properties: readonly CompletenessProperty[]; data?: YearData };
}) {
  const supabase = useMemo(() => createClient(), []);
  const [status, setStatus] = useState<PackStatus[]>([]);
  // Οι υπόχρεοι: null όσο φορτώνουν ή όταν η ανάγνωση απέτυχε. Ποτέ «κανένα ΑΦΜ»
  // από αποτυχία, γιατί η οθόνη θα έστελνε τον χρήστη να ορίσει ό,τι έχει ήδη.
  const [owners, setOwners] = useState<{ afm: string; properties: number }[] | null>(null);
  const [ownersFailed, setOwnersFailed] = useState(false);
  const [busy, setBusy] = useState<{ afm: string; kind: 'download' | 'share' } | null>(null);

  useEffect(() => {
    let alive = true;
    void packStatuses(supabase, userId, year).then(r => { if (alive && !r.failed) setStatus(r.rows); });
    void ownerAfms(supabase, userId).then(r => { if (!alive) return; setOwners(r); setOwnersFailed(r === null); });
    return () => { alive = false; };
  }, [supabase, userId, year]);

  const build = async (afm: string) => {
    const { buildMeetingPack } = await import('./meetingPackExport');
    return buildMeetingPack(supabase, { userId, year, ownerAfm: afm, ownerName, dossier });
  };

  const download = async (afm: string) => {
    if (busy) return;
    setBusy({ afm, kind: 'download' });
    try {
      const pack = await build(afm);
      if (!pack) { notifyError('Δεν βρέθηκαν ακίνητα για αυτό το ΑΦΜ.'); return; }
      downloadFile(new Blob([pack.zip], { type: 'application/zip' }), pack.fileName, 'application/zip');
      notify(`Ο φάκελος του ${year} κατέβηκε · ${pack.entries} αρχεία`);
    } catch (e) {
      console.error('[MeetingPackCard] λήψη:', e);
      notifyError('Ο φάκελος δεν ετοιμάστηκε. Δοκίμασε ξανά.');
    } finally { setBusy(null); }
  };

  const share = async (afm: string) => {
    if (busy) return;
    setBusy({ afm, kind: 'share' });
    try {
      const pack = await build(afm);
      if (!pack) { notifyError('Δεν βρέθηκαν ακίνητα για αυτό το ΑΦΜ.'); return; }
      const res = await sharePack(supabase, userId, year, afm, pack.zip, pack.status);
      if (!res.ok) { notifyError('Ο φάκελος δεν στάλθηκε. Δοκίμασε ξανά.'); return; }
      setStatus(s => [...s.filter(x => x.ownerAfm !== afm), {
        ownerAfm: afm, aadeDifferences: pack.status.aadeDifferences, aadeCheckedAt: res.sharedAt,
        missingCount: pack.status.missingCount, missingTop: pack.status.missingTop,
        filePath: `${userId}/accountant-pack/${year}/${afm}.zip`, sizeBytes: pack.zip.length, sharedAt: res.sharedAt,
      }]);
      notify('Ο φάκελος στάλθηκε. Ο λογιστής σου τον βρίσκει στη λίστα του.');
    } catch (e) {
      console.error('[MeetingPackCard] αποστολή:', e);
      notifyError('Ο φάκελος δεν στάλθηκε. Δοκίμασε ξανά.');
    } finally { setBusy(null); }
  };

  return (
    <div style={card}>
      <p style={eyebrow}>Ο φάκελος για τον λογιστή · {year}</p>
      <p style={{ ...TT.bodySm, margin: '8px 0 0' }}>
        Ένας φάκελος ανά ΑΦΜ: σύνοψη σε μία σελίδα, το Ε2, η σύγκριση με το προσυμπληρωμένο της ΑΑΔΕ, ανά ακίνητο, βραχυχρόνια, τι λείπει και τα παραστατικά ανά ακίνητο.
      </p>
      {ownersFailed ? (
        <p role="alert" style={{ ...TT.caption, color: 'var(--negative)', margin: '12px 0 0' }}>Τα ΑΦΜ των ακινήτων δεν διαβάστηκαν. Άνοιξε ξανά τη Λογιστική σε λίγο.</p>
      ) : owners === null ? null : owners.length === 0 ? (
        <p style={{ ...TT.caption, margin: '12px 0 0' }}>
          Ο φάκελος βγαίνει ανά ΑΦΜ υπόχρεου. Όρισε το ΑΦΜ του ιδιοκτήτη στην <EditDetailsLink properties={dossier.properties} onEdit={onEditProperty} />.
        </p>
      ) : (
        <div style={{ marginTop: 6 }}>
          {owners.map(o => {
            const st = status.find(s => s.ownerAfm === o.afm);
            const running = busy?.afm === o.afm;
            return (
              <div key={o.afm} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 0', borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ ...TT.body, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>ΑΦΜ {o.afm}</div>
                  <div style={{ ...TT.caption, marginTop: 4 }}>
                    {o.properties === 1 ? '1 ακίνητο' : `${o.properties} ακίνητα`}
                    {st?.sharedAt ? ` · στάλθηκε στον λογιστή ${fd(st.sharedAt)}${st.sizeBytes ? `, ${fmtBytes(st.sizeBytes)}` : ''}` : ' · δεν έχει σταλεί'}
                    {st && st.missingCount > 0 ? ` · λείπουν ${st.missingCount}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Btn variant="primary" onClick={() => void download(o.afm)} disabled={!!busy}>
                    <Download size={14} />{running && busy?.kind === 'download' ? 'Ετοιμάζεται' : 'Κατέβασε'}
                  </Btn>
                  <Btn variant="secondary" onClick={() => void share(o.afm)} disabled={!!busy}>
                    <Send size={14} />{running && busy?.kind === 'share' ? 'Αποστέλλεται' : st?.sharedAt ? 'Ξαναστείλε' : 'Στείλε στον λογιστή'}
                  </Btn>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
