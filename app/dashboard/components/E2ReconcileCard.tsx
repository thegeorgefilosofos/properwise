'use client';

// ═══════════════════════════════════════════════════════════════════════════
// «Η ΑΑΔΕ ΓΡΑΦΕΙ Χ. Η ΕΦΑΡΜΟΓΗ Υ. ΝΑ ΓΙΑΤΙ ΚΑΙ ΠΟΥ ΔΙΟΡΘΩΝΕΤΑΙ.»
//
// ΤΙ ΗΤΑΝ. Ενα πεδίο ανά ακίνητο, «Το έντυπο λέει», όπου ο χρήστης έγραφε ένα
// νούμερο από το myAADE. Αποθηκευόταν μόνο ο ΑΤΑΚ: το νούμερο χανόταν μόλις
// έκλεινε η οθόνη, η σύγκριση γινόταν ανά ακίνητο (όχι ανά μίσθωση) και ο
// λογιστής δεν την έβλεπε ποτέ.
//
// ΤΙ ΕΙΝΑΙ ΤΩΡΑ. Το προσυμπληρωμένο ανεβαίνει μία φορά (PDF, επικόλληση ή με το
// χέρι) και αποθηκεύεται ανά ΑΦΜ και έτος. Η σύγκριση γίνεται κάθε φορά με τα
// ΠΡΑΓΜΑΤΙΚΑ δεδομένα και των δύο πλευρών, μίσθωση προς μίσθωση. Κάθε διαφορά
// λέει τα δύο νούμερα και πού διορθώνεται. Το ίδιο προσυμπληρωμένο μπορεί να το
// ανεβάσει ο λογιστής από τον χώρο του· εδώ φαίνεται ποιος το ανέβασε.
//
// ΤΙ ΔΕΝ ΚΑΝΟΥΜΕ: δεν αποφασίζουμε μόνοι μας ποιο νούμερο είναι σωστό όπου τα
// στοιχεία δεν το λένε. Τότε η ενέργεια είναι «Έλεγξε με τον λογιστή».
// ═══════════════════════════════════════════════════════════════════════════

import { EditDetailsLink } from './EditDetailsLink';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { T, TT, EmptyState, Btn, ChipToggle, StatStrip, fe, fd } from '@/components/Theme';
import { loadE2Rows } from './sheets';
import { downloadFile } from '@/lib/core/download';
import { notify, notifyError } from '@/components/Toast';
import { hasFeature } from '@/lib/billing/entitlements';
import type { PlanId } from '@/lib/billing/plans';
import { FeatureBtn } from './FeatureLock';
import { ATAK_SOURCE, ATAK_DIGITS, atakDigits, isAtak } from '@/lib/property/atak';
import * as propertyStore from '@/lib/data/properties';
import { failed } from '@/lib/core/dbError';
import { listPrefilled, declRefsByProperty, savePackStatus, fileUrl, type StoredE2Row } from '@/lib/data/e2Prefilled';
import { afmGroups, compareGroup, type E2Loaded } from './e2Compare';
import type { ReconLine } from '@/lib/billing/e2Reconcile';
import E2PrefilledImport from './E2PrefilledImport';

// Χρώμα ΜΟΝΟ όπου υπάρχει κάτι να γίνει. Η συμφωνία είναι η αναμενόμενη
// κατάσταση και γράφεται με τον τόνο του κειμένου.
const STATUS: Record<ReconLine['status'], { color: string; label: string }> = {
  match: { color: 'var(--text-secondary)', label: 'Συμφωνεί' },
  differs: { color: 'var(--warning)', label: 'Διαφέρει' },
  missing_in_aade: { color: 'var(--warning)', label: 'Λείπει από την ΑΑΔΕ' },
  missing_in_app: { color: 'var(--negative)', label: 'Λείπει από την εφαρμογή' },
  vacant: { color: 'var(--text-tertiary)', label: 'Κενό ή χωρίς ποσό' },
};

const SOURCE_LABEL: Record<StoredE2Row['source'], string> = { pdf: 'από PDF', paste: 'με επικόλληση', manual: 'με το χέρι' };

export default function E2ReconcileCard({ userId, year, plan = 'free', onUpgrade, onEditProperty }: {
  /** Ανοίγει τον οδηγό του ακινήτου στο ΑΦΜ του ιδιοκτήτη (EditDetailsLink). */
  onEditProperty?: (propertyId: string) => void;
  userId: string; year: number; plan?: PlanId; onUpgrade?: () => void;
}) {
  // Η εξαγωγή ξεκλειδώνει από το «Ένα ακίνητο» και πάνω. Η σύγκριση μένει
  // ανοιχτή σε όλους: είναι ο λόγος που ο δοκιμαστής καταλαβαίνει τι αγοράζει.
  const canExport = hasFeature({ plan }, 'e2_export');
  const supabase = useMemo(() => createClient(), []);
  const [loaded, setLoaded] = useState<E2Loaded | null>(null);
  const [aade, setAade] = useState<StoredE2Row[]>([]);
  const [readFailed, setReadFailed] = useState(false);
  // Τα ΔΙΚΑ σου στοιχεία δεν διαβάστηκαν (ακίνητα, μισθώσεις, δόσεις, ΑΦΜ).
  // Χωριστά από το `readFailed`, που αφορά μόνο το ανεβασμένο της ΑΑΔΕ.
  const [loadFailed, setLoadFailed] = useState(false);
  const [declRefs, setDeclRefs] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  // Για ποιο έτος ήρθαν τα δεδομένα που φαίνονται: η ανανέωση του ίδιου έτους
  // (αποθήκευση ΑΤΑΚ, εισαγωγή) κρατά την κάρτα στη θέση της αντί να την
  // εξαφανίζει και να πηδά η σελίδα· η αλλαγή έτους την κρύβει ώσπου να έρθουν.
  const [loadedFor, setLoadedFor] = useState<number | null>(null);
  const [afm, setAfm] = useState('');
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [atakDraft, setAtakDraft] = useState<Record<string, string>>({});
  const [savingAtak, setSavingAtak] = useState('');
  const [reload, setReload] = useState(0);

  // ── ΤΟ ΑΡΧΕΙΟ ΠΟΥ ΠΟΥΛΙΕΤΑΙ ──────────────────────────────────────────────
  // Παράγεται στον server, πίσω από την πύλη πακέτου· ο browser το κατεβάζει.
  const exportE2 = async () => {
    if (!canExport) return;
    setExporting(true);
    try {
      const res = await fetch('/api/e2/export', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ year }),
      });
      const isJson = (res.headers.get('content-type') || '').includes('application/json');
      if (!res.ok) {
        const msg = isJson ? (await res.json().catch(() => null))?.error : null;
        notifyError(msg || 'Η εξαγωγή δεν ολοκληρώθηκε. Δοκίμασε ξανά.');
        return;
      }
      if (isJson) { notifyError('Δεν υπάρχει ακίνητο για εξαγωγή.'); return; }
      const n = Number(res.headers.get('X-Property-Count')) || 0;
      downloadFile(await res.blob(), `Έντυπο Ε2 ${year}.xlsx`);
      notify(`Το Ε2 ${year} κατέβηκε · ${n} ${n === 1 ? 'ακίνητο' : 'ακίνητα'}`);
    } catch {
      notifyError('Η εξαγωγή δεν ολοκληρώθηκε. Δοκίμασε ξανά.');
    } finally { setExporting(false); }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [l, pre, refs] = await Promise.all([
          loadE2Rows(supabase, userId, year),
          listPrefilled(supabase, userId, year),
          declRefsByProperty(supabase, userId),
        ]);
        if (!alive) return;
        setLoaded(l);
        setAade(pre.rows);
        setReadFailed(pre.failed);
        setDeclRefs(refs);
        setLoadFailed(false);
        setLoadedFor(year);
      } catch (e) {
        // Πριν από αυτό η απόρριψη έμενε χωρίς χειρισμό και η κάρτα έδειχνε την
        // κενή κατάσταση, σαν να μην είχες ακίνητο με ΑΤΑΚ. Το `setLoaded(null)`
        // σβήνει παλιό `result`, ώστε να μη γραφτεί κατάσταση στον λογιστή από
        // στοιχεία που δεν ξαναδιαβάστηκαν· το `setLoadedFor` περνά την πρόωρη
        // επιστροφή της φόρτωσης για να φανεί το μήνυμα.
        if (!alive) return;
        console.error('[E2ReconcileCard] φόρτωση:', e);
        setLoaded(null);
        setLoadFailed(true);
        setLoadedFor(year);
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [supabase, userId, year, reload]);

  const groups = useMemo(() => (loaded ? afmGroups(loaded) : []), [loaded]);
  const withAfm = useMemo(() => groups.filter(g => g.afm), [groups]);
  const current = useMemo(() => withAfm.find(g => g.afm === afm) ?? withAfm[0] ?? null, [withAfm, afm]);
  const rows = useMemo(() => aade.filter(r => r.ownerAfm === current?.afm), [aade, current]);
  const result = useMemo(
    () => (loaded && current ? compareGroup(loaded, current, aade, year, declRefs) : null),
    [loaded, current, aade, year, declRefs],
  );

  // ── Η ΚΑΤΑΣΤΑΣΗ ΦΤΑΝΕΙ ΣΤΟΝ ΛΟΓΙΣΤΗ ──────────────────────────────────────
  // Πλήθος διαφορών και ημερομηνία, τίποτα άλλο. Γράφεται μόνο όταν αλλάξει,
  // ώστε το άνοιγμα της οθόνης να μη γράφει στη βάση κάθε φορά.
  const written = useRef('');
  useEffect(() => {
    if (!current || !result || result.status === 'not_uploaded' || readFailed) return;
    const key = `${current.afm}:${year}:${result.differences}:${rows.length}`;
    if (written.current === key) return;
    written.current = key;
    void savePackStatus(supabase, userId, year, current.afm, { aadeDifferences: result.differences });
  }, [supabase, userId, year, current, result, rows.length, readFailed]);

  const saveAtak = useCallback(async (propertyId: string) => {
    const value = atakDigits(atakDraft[propertyId]);
    if (!isAtak(value)) return;
    setSavingAtak(propertyId);
    const { error } = await propertyStore.update(supabase, propertyId, { atak: value }, userId);
    setSavingAtak('');
    if (error) { notifyError(failed('Ο ΑΤΑΚ δεν αποθηκεύτηκε', error)); return; }
    notify('Ο ΑΤΑΚ καταχωρήθηκε');
    setAtakDraft(d => { const n = { ...d }; delete n[propertyId]; return n; });
    setReload(n => n + 1);
  }, [atakDraft, supabase, userId]);

  const openOriginal = async (path: string) => {
    const url = await fileUrl(supabase, path);
    if (url) window.open(url, '_blank', 'noopener');
    else notifyError('Το πρωτότυπο δεν ανοίγει αυτή τη στιγμή. Δοκίμασε ξανά.');
  };

  const card: React.CSSProperties = {
    background: 'var(--surface-raised)', border: '1px solid var(--border-raised)',
    borderRadius: T.radius.card, padding: T.sp.lg,
    boxShadow: 'var(--highlight-inset), var(--elev-1)', marginBottom: 16,
  };
  const inp: React.CSSProperties = {
    background: 'var(--bg-base)', border: '1px solid var(--border-control)',
    borderRadius: T.radius.inner, height: T.h.lg, padding: '0 12px', width: 150,
    color: 'var(--text-primary)', fontFamily: T.font.num, fontSize: 14,
    fontVariantNumeric: 'tabular-nums', boxSizing: 'border-box',
  };

  if (loading && loadedFor !== year) return null;

  if (loadFailed) {
    return (
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <p role="alert" style={{ ...TT.bodySm, color: 'var(--negative)', margin: 0, flex: 1, minWidth: 220 }}>
            Τα στοιχεία σου για το Ε2 {year} δεν διαβάστηκαν. Δεν σημαίνει ότι λείπουν.
          </p>
          <Btn variant="secondary" onClick={() => setReload(n => n + 1)}>Δοκίμασε ξανά</Btn>
        </div>
      </div>
    );
  }

  if (!loaded || !loaded.properties.length) {
    return (
      <div style={card}>
        <EmptyState
          title="Σύγκριση με το προσυμπληρωμένο Ε2"
          hint="Με ένα ακίνητο που έχει ΑΤΑΚ και καταχωρημένα μισθώματα, η σύγκριση με το προσυμπληρωμένο έντυπο γίνεται εδώ, πριν υπογράψεις."
        />
      </div>
    );
  }

  const noAtak = loaded.properties.filter(p => !(p.atak || '').trim());
  const noAfmGroup = groups.find(g => !g.afm);
  const lastUpload = rows.reduce<StoredE2Row | null>((a, r) => (!a || r.updatedAt > a.updatedAt ? r : a), null);
  const known = current ? current.idx.map(i => ({ atak: loaded.properties[i].atak, name: loaded.properties[i].name || loaded.properties[i].address || 'Ακίνητο' })) : [];

  return (
    <div style={card}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <p style={{ ...TT.h2 }}>Σύγκριση με το προσυμπληρωμένο Ε2 · {year}</p>
          <FeatureBtn locked={!canExport} onUpgrade={() => onUpgrade?.()} onClick={exportE2} disabled={exporting}>
            {exporting ? 'Σε εξέλιξη…' : 'Λήψη Ε2 σε Excel'}
          </FeatureBtn>
        </div>
        <p style={{ ...TT.bodySm, marginTop: 4 }}>
          Η ΑΑΔΕ στέλνει το Ε2 προσυμπληρωμένο, συχνά με λάθη. Ανέβασέ το μία φορά και η εφαρμογή το συγκρίνει μίσθωση προς μίσθωση με τα δικά σου στοιχεία.
        </p>
      </div>

      {withAfm.length > 1 && (
        <div role="group" aria-label="ΑΦΜ υπόχρεου" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {withAfm.map(g => (
            <ChipToggle key={g.afm} on={g.afm === current?.afm} onClick={() => setAfm(g.afm)}>
              {`ΑΦΜ ${g.afm} · ${g.idx.length === 1 ? '1 ακίνητο' : `${g.idx.length} ακίνητα`}`}
            </ChipToggle>
          ))}
        </div>
      )}

      {readFailed ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <p role="alert" style={{ ...TT.bodySm, color: 'var(--negative)', margin: 0, flex: 1, minWidth: 220 }}>
            Το αποθηκευμένο προσυμπληρωμένο δεν διαβάστηκε. Δεν σημαίνει ότι δεν ανέβηκε.
          </p>
          <Btn variant="secondary" onClick={() => setReload(n => n + 1)}>Δοκίμασε ξανά</Btn>
        </div>
      ) : !current ? (
        <p style={{ ...TT.bodySm, margin: 0 }}>
          Το Ε2 υποβάλλεται ανά ΑΦΜ και η σύγκριση ανοίγει εδώ μόλις οριστεί. Όρισε το ΑΦΜ του ιδιοκτήτη στην <EditDetailsLink properties={loaded?.properties ?? []} onEdit={onEditProperty} />.
        </p>
      ) : !result || result.status === 'not_uploaded' ? (
        <div style={{ padding: '14px 16px', background: 'var(--bg-elevated)', borderRadius: T.radius.inner }}>
          <p style={{ ...TT.body, fontWeight: 600, margin: 0 }}>Δεν έχει ανέβει ακόμη το προσυμπληρωμένο για το ΑΦΜ {current.afm}.</p>
          <p style={{ ...TT.caption, margin: '4px 0 12px' }}>
            {`Η εφαρμογή έχει ${result ? fe(result.totalOurs) : fe(0)} σε ${current.idx.length === 1 ? '1 ακίνητο' : `${current.idx.length} ακίνητα`}. Το ανεβάζεις εσύ ή ο λογιστής σου.`}
          </p>
          {/* Στα 320 το κουμπί έσπαγε σε δύο γραμμές (234×50). */}
          <Btn variant="primary" onClick={() => setImporting(true)}><FileUp size={15} /><span className="lp-hide-xxs">Ανέβασε το προσυμπληρωμένο</span><span className="lp-only-xxs">Ανέβασε το Ε2</span></Btn>
        </div>
      ) : (
        <>
          {result.headline && (
            <div style={{
              padding: '12px 14px', marginBottom: 14, background: 'var(--bg-elevated)', borderRadius: T.radius.inner,
              borderLeft: `2px solid ${result.differences === 0 ? 'var(--border-default)' : 'var(--warning)'}`,
            }}>
              <span style={{ ...TT.body, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{result.headline}</span>
            </div>
          )}
          <StatStrip items={[
            { label: 'Η ΑΑΔΕ γράφει', value: fe(result.totalTheirs) },
            { label: 'Η εφαρμογή', value: fe(result.totalOurs), strong: true },
            { label: 'Διαφορά', value: fe(Math.abs(result.totalDiff)), tone: Math.abs(result.totalDiff) > 1 ? 'warning' : undefined },
          ]} />

          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
            {result.lines.map((l, i) => {
              const tone = STATUS[l.status];
              return (
                <div key={l.key} style={{ padding: '14px 2px', borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ ...TT.body, fontWeight: 600 }}>{l.propertyName}{l.tenant ? ` · ${l.tenant}` : ''}</div>
                      <div style={{ ...TT.caption, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                        {l.atak ? `ΑΤΑΚ ${l.atak} · ` : ''}
                        {l.app ? `Εφαρμογή ${fe(l.app.gross)}` : 'Δεν υπάρχει στην εφαρμογή'}
                        {' · '}
                        {l.aade ? `ΑΑΔΕ ${fe(l.aade.gross)}` : 'δεν υπάρχει στην ΑΑΔΕ'}
                      </div>
                    </div>
                    <span style={{ ...TT.bodySm, fontWeight: 600, color: tone.color }}>{tone.label}</span>
                  </div>
                  {l.findings.length > 0 && (
                    <div style={{ marginTop: 10, paddingLeft: 12, borderLeft: `2px solid ${tone.color}`, display: 'grid', gap: 10 }}>
                      {l.findings.map(f => (
                        <div key={f.kind}>
                          <p style={{ ...TT.bodySm, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{f.text}</p>
                          {f.reasons?.map(r => <p key={r.code} style={{ ...TT.caption, margin: '3px 0 0' }}>{r.text}</p>)}
                          <p style={{ ...TT.caption, margin: '4px 0 0', color: 'var(--text-primary)', fontWeight: 600 }}>{f.action}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
            <p style={{ ...TT.caption, margin: 0, flex: 1, minWidth: 220 }}>
              {lastUpload
                ? `${rows.length === 1 ? '1 γραμμή' : `${rows.length} γραμμές`} της ΑΑΔΕ · ανέβηκαν ${SOURCE_LABEL[lastUpload.source]} ${lastUpload.uploadedBy === 'accountant' ? 'από τον λογιστή σου' : 'από εσένα'} στις ${fd(lastUpload.updatedAt)}`
                : ''}
            </p>
            {lastUpload?.sourceFile && <Btn variant="ghost" onClick={() => void openOriginal(lastUpload.sourceFile!)}>Το πρωτότυπο</Btn>}
            <Btn variant="secondary" onClick={() => setImporting(true)}>Αντικατάσταση</Btn>
          </div>
        </>
      )}

      {noAfmGroup && current && (
        <p style={{ ...TT.caption, margin: '12px 0 0' }}>
          {noAfmGroup.idx.length === 1 ? 'Ένα ακίνητο δεν έχει' : `${noAfmGroup.idx.length} ακίνητα δεν έχουν`} ΑΦΜ ιδιοκτήτη και μένουν εκτός σύγκρισης. Όρισέ το στην <EditDetailsLink properties={noAfmGroup.idx.map(i => loaded?.properties[i] ?? {})} onEdit={onEditProperty} />.
        </p>
      )}

      {/* Ο ΑΤΑΚ ΓΡΑΦΕΤΑΙ ΕΔΩ, ΟΧΙ ΤΕΣΣΕΡΑ ΠΑΤΗΜΑΤΑ ΜΑΚΡΙΑ. Χωρίς αυτόν, η μίσθωση
          ταιριάζει μόνο με ΑΦΜ μισθωτή ή αριθμό δήλωσης. */}
      {noAtak.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
          <p style={{ ...TT.caption, margin: '0 0 8px' }}>Χωρίς ΑΤΑΚ η ταύτιση με την ΑΑΔΕ γίνεται μόνο με ΑΦΜ μισθωτή. {ATAK_SOURCE}</p>
          {noAtak.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '6px 0' }}>
              <label htmlFor={`atak-${p.id}`} style={{ ...TT.bodySm, flex: 1, minWidth: 160 }}>{p.name || p.address || 'Ακίνητο'}</label>
              <input id={`atak-${p.id}`} inputMode="numeric" autoComplete="off" style={inp}
                placeholder={`${ATAK_DIGITS} ψηφία`} value={atakDraft[p.id] ?? ''}
                onChange={e => setAtakDraft(d => ({ ...d, [p.id]: atakDigits(e.target.value) }))}
                onKeyDown={e => { if (e.key === 'Enter') void saveAtak(p.id); }} />
              <Btn size="lg" onClick={() => void saveAtak(p.id)} disabled={!isAtak(atakDraft[p.id]) || savingAtak === p.id}>
                {savingAtak === p.id ? 'Καταχώρηση…' : 'Καταχώρηση'}
              </Btn>
            </div>
          ))}
        </div>
      )}

      <p style={{ ...TT.caption, marginTop: 14 }}>
        Όπου τα στοιχεία δεν λένε ποιο νούμερο είναι σωστό, το αποφασίζεις με τον λογιστή σου. Εδώ φαίνεται πού διαφέρουν, γιατί και πού διορθώνεται.
      </p>

      {importing && current && (
        <E2PrefilledImport
          ownerId={userId} year={year} afms={withAfm.map(g => g.afm)} initialAfm={current.afm}
          known={known} existing={rows}
          onClose={() => setImporting(false)}
          onSaved={(_, savedAfm) => { setImporting(false); setAfm(savedAfm); setReload(n => n + 1); }}
        />
      )}
    </div>
  );
}
