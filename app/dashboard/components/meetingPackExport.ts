// ΧΩΡΙΣ 'use client': το φορτώνει δυναμικά η οθόνη (MeetingPackCard), μόνο
// όταν πατηθεί το κουμπί. Φέρνει τη βιβλιοθήκη του Excel και του PDF.
// ═══════════════════════════════════════════════════════════════════════════
// Ο ΦΑΚΕΛΟΣ ΤΗΣ ΣΥΝΑΝΤΗΣΗΣ, ΑΠΟ ΤΗ ΒΑΣΗ ΣΤΟ ZIP
// ─────────────────────────────────────────────────────────────────────────
// Η λογική ζει στο lib/accounting/meetingPack.ts (τι λείπει, η σύνοψη, τα
// ονόματα, τα περιεχόμενα). Εδώ μόνο φορτώνεται ό,τι χρειάζεται και γράφεται
// με το ίδιο οπτικό σύστημα που έχουν όλες οι εξαγωγές: ίδιες μορφές αριθμών
// (sheetFormat.ts), ίδια ζώνη τίτλου με το σήμα, ίδιο υποσέλιδο PDF.
//
// ΜΙΑ ΦΟΡΤΩΣΗ, ΟΠΩΣ ΣΤΟ Ε2. Το ακαθάριστο, οι μήνες και η σύγκριση βγαίνουν
// από την ίδια `loadE2Rows` και την ίδια `compareGroup` που δείχνει η κάρτα
// της Λογιστικής. Δεύτερη φόρτωση θα σήμαινε δύο σύνολα που μπορούν να
// διαφωνήσουν, το ένα στην οθόνη και το άλλο στον φάκελο του λογιστή.
// ═══════════════════════════════════════════════════════════════════════════
import type { SupabaseClient } from '@supabase/supabase-js';
import { XLSX, sectionSheet, workbookBytes } from './xlsxStyle';
import { FMT } from './sheetFormat';
import { loadE2Rows, buildE2Workbook } from './e2Export';
import { afmGroups, compareGroup } from './e2Compare';
import { fetchDossierPapers } from './dossierPapers';
import { listPrefilled, declRefsByProperty, fileBytes } from '@/lib/data/e2Prefilled';
import { buildZip } from '@/lib/accounting/zip';
import {
  missingItems, packTotals, aadeStatusLine, packEntries, coverModel, PACK_FILES,
  type MeetingPackInput, type PackProperty, type PackPaper, type PackRequirement,
} from '@/lib/accounting/meetingPack';
import { requirementsFor, filePapers, WHO_LABEL, type DossierContext, type DossierProperty } from '@/lib/accounting/dossier';
import { FIX_LABEL } from '@/lib/billing/e2Reconcile';
import { e2CategoryLabel } from '@/lib/billing/e2';
import { readStatus } from '@/lib/property/status';
import { shortTermYearSummary, staysMissingPlatformFee, isHouseType } from '@/lib/tax/shortTermTax';
import { reportPdfBlob } from '@/lib/pdf/pdfReport';
import { issueDocument } from '@/lib/documents/issue';
import { grDate } from '@/lib/core/format';

/** Το βιβλίο «02 Έλεγχος φακέλου»: σύνοψη, σύγκριση, ακίνητα, βραχυχρόνια, τι λείπει. */
export function buildReviewWorkbook(input: MeetingPackInput, issuedAt: Date = new Date()): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const t = packTotals(input.properties);
  const r = input.reconciliation;
  const missing = missingItems(input);
  const who = `ΑΦΜ ${input.ownerAfm}${input.ownerName ? ` · ${input.ownerName}` : ''}`;
  const sub = `${who} · Φορολογικό έτος ${input.year} · Εκδόθηκε ${grDate(issuedAt.toISOString())}`;
  const shortTerm = input.properties.filter(p => p.shortTerm);

  // ── Σύνοψη ────────────────────────────────────────────────────────────
  {
    const { ws } = sectionSheet({
      title: `ΦΑΚΕΛΟΣ ΓΙΑ ΤΟΝ ΛΟΓΙΣΤΗ · ${input.year}`, sub,
      blocks: [
        { title: 'ΥΠΟΧΡΕΟΣ', head: ['Στοιχείο', 'Τιμή'], rows: [
          ['ΑΦΜ', input.ownerAfm],
          ['Ονοματεπώνυμο', input.ownerName || 'Δεν έχει δηλωθεί'],
          ['Φορολογικό έτος', String(input.year)],
          ['Ακίνητα', String(t.properties)],
          ['Προσυμπληρωμένο Ε2', input.aade ? `Ανέβηκε ${grDate(input.aade.uploadedAt)} από ${input.aade.by === 'accountant' ? 'τον λογιστή' : 'τον ιδιοκτήτη'}` : 'Δεν έχει ανέβει'],
          ['Σύγκριση με ΑΑΔΕ', aadeStatusLine(r)],
          ['Τι λείπει', missing.length ? `${missing.length}, ${missing.filter(m => m.blocking).length} απαραίτητα` : 'Τίποτα'],
        ] },
        { title: 'ΠΟΣΑ', head: ['Μέγεθος', 'Ποσό'], numeric: [1], formats: { 1: FMT.eur }, rows: [
          ['Ακαθάριστο Ε2 (εφαρμογή)', t.gross],
          ...(r.status !== 'not_uploaded' ? [['Ακαθάριστο προσυμπληρωμένου (ΑΑΔΕ)', r.totalTheirs], ['Διαφορά εφαρμογής και ΑΑΔΕ', r.totalDiff]] as (string | number)[][] : []),
          ['Ανείσπρακτα, μέσα στο ακαθάριστο', t.unpaid],
          ...(t.shortTermGross > 0 ? [['Ακαθάριστο βραχυχρόνιας, μέσα στο ακαθάριστο', t.shortTermGross]] as (string | number)[][] : []),
        ] },
        { title: 'ΤΑ ΦΥΛΛΑ', head: ['Φύλλο', 'Τι απαντά'], rows: [
          ['Σύγκριση με ΑΑΔΕ', 'Ποια γραμμή διαφέρει από το προσυμπληρωμένο, πόσο και πού διορθώνεται.'],
          ['Ανά ακίνητο', 'Ακαθάριστο, μήνες, ανείσπρακτα και επισημάνσεις κάθε ακινήτου.'],
          ...(shortTerm.length ? [['Βραχυχρόνια', 'ΑΜΑ, νύχτες, ακαθάριστο, προμήθεια και ΤΑΚΚ ανά ακίνητο.']] : []),
          ['Τι λείπει', 'Ό,τι δεν βρέθηκε, ποιος το φέρνει και από πού. Διαβάζεται πρώτο.'],
        ] },
      ],
    });
    XLSX.utils.book_append_sheet(wb, ws, 'Σύνοψη');
  }

  // ── Σύγκριση με ΑΑΔΕ ──────────────────────────────────────────────────
  {
    const rows: (string | number)[][] = r.lines.map(l => [
      l.propertyName, l.atak || '', l.tenant || '',
      l.app ? l.app.gross : '', l.aade ? l.aade.gross : '',
      Math.round(((l.app?.gross ?? 0) - (l.aade?.gross ?? 0)) * 100) / 100,
      l.app?.months ?? '', l.aade?.months ?? '',
      l.status === 'match' ? 'Συμφωνεί' : l.status === 'vacant' ? 'Κενό' : l.status === 'missing_in_aade' ? 'Λείπει από την ΑΑΔΕ' : l.status === 'missing_in_app' ? 'Λείπει από την εφαρμογή' : 'Διαφέρει',
      l.findings.map(f => f.text).join(' '),
      l.findings.length ? FIX_LABEL[l.findings[0].fixIn] : '',
      l.findings.map(f => f.action).join(' '),
    ]);
    const { ws } = sectionSheet({
      title: `ΣΥΓΚΡΙΣΗ ΜΕ ΤΟ ΠΡΟΣΥΜΠΛΗΡΩΜΕΝΟ Ε2 · ${input.year}`, sub,
      maxWidth: 60,
      blocks: [{
        lead: r.headline ?? 'Το προσυμπληρωμένο Ε2 δεν έχει ανέβει: η σύγκριση γίνεται μόλις ανέβει.',
        head: ['Ακίνητο', 'ΑΤΑΚ', 'Μισθωτής', 'Εφαρμογή', 'ΑΑΔΕ', 'Διαφορά', 'Μήνες εφαρμογής', 'Μήνες ΑΑΔΕ', 'Κατάσταση', 'Τι διαφέρει', 'Πού διορθώνεται', 'Επόμενη κίνηση'],
        numeric: [3, 4, 5, 6, 7],
        formats: { 3: FMT.eur, 4: FMT.eur, 5: FMT.eur, 6: FMT.int, 7: FMT.int },
        rows: rows.length ? [...rows, ['Σύνολο', '', '', r.totalOurs, r.totalTheirs, r.totalDiff, '', '', '', '', '', '']] : [],
        totals: rows.length ? [rows.length] : [],
        sum: [3, 4, 5],
        empty: 'Δεν υπάρχουν γραμμές για σύγκριση.',
        notes: ['Διαφορά = εφαρμογή μείον ΑΑΔΕ. Η ταύτιση γίνεται με ΑΤΑΚ και ΑΦΜ μισθωτή, με αριθμό δήλωσης μίσθωσης ή με επικάλυψη διαστημάτων, ποτέ με διεύθυνση.'],
      }],
    });
    XLSX.utils.book_append_sheet(wb, ws, 'Σύγκριση με ΑΑΔΕ');
  }

  // ── Ανά ακίνητο ───────────────────────────────────────────────────────
  {
    const rows: (string | number)[][] = input.properties.map(p => [
      p.name, p.address, p.atak || 'Λείπει', p.category, p.ownershipPct, p.yearStatus, p.months,
      p.gross, p.unpaid, p.servicesExcluded, p.papers, p.flags.join(' '),
    ]);
    const { ws } = sectionSheet({
      title: `ΑΝΑ ΑΚΙΝΗΤΟ · ${input.year}`, sub, maxWidth: 60,
      blocks: [{
        head: ['Ακίνητο', 'Διεύθυνση', 'ΑΤΑΚ', 'Κατηγορία', 'Ποσοστό', 'Χρήση στο έτος', 'Μήνες', 'Ακαθάριστο', 'Ανείσπρακτα', 'Υπηρεσίες εκτός Ε2', 'Παραστατικά', 'Επισημάνσεις'],
        numeric: [4, 6, 7, 8, 9, 10],
        formats: { 4: FMT.pct, 6: FMT.int, 7: FMT.eur, 8: FMT.eur, 9: FMT.eur, 10: FMT.int },
        rows: [...rows, ['Σύνολο', '', '', '', '', '', t.months, t.gross, t.unpaid, input.properties.reduce((s, p) => s + p.servicesExcluded, 0), input.properties.reduce((s, p) => s + p.papers, 0), '']],
        totals: [rows.length],
        sum: [7, 8, 9, 10],
        notes: ['Ακαθάριστο: το μερίδιο του υπόχρεου, δεδουλευμένο, όπως στο Ε2. Τα ανείσπρακτα είναι μέσα σε αυτό· οι υπηρεσίες (ίντερνετ, καθαρισμός, στάθμευση) δεν είναι μίσθωμα και μένουν έξω.'],
      }],
    });
    XLSX.utils.book_append_sheet(wb, ws, 'Ανά ακίνητο');
  }

  // ── Βραχυχρόνια ───────────────────────────────────────────────────────
  if (shortTerm.length) {
    const rows: (string | number)[][] = shortTerm.map(p => {
      const s = p.shortTerm!;
      return [p.name, s.ama || 'Λείπει', s.stays, s.nights, s.gross, s.platformFees, s.levyDue, s.levyCollected, Math.round((s.levyDue - s.levyCollected) * 100) / 100];
    });
    const sumOf = (k: keyof NonNullable<PackProperty['shortTerm']>) => shortTerm.reduce((a, p) => a + (Number(p.shortTerm![k]) || 0), 0);
    const { ws } = sectionSheet({
      title: `ΒΡΑΧΥΧΡΟΝΙΑ ΜΙΣΘΩΣΗ · ${input.year}`, sub,
      blocks: [{
        head: ['Ακίνητο', 'ΑΜΑ', 'Διαμονές', 'Νύχτες στο έτος', 'Ακαθάριστο', 'Προμήθεια πλατφόρμας', 'ΤΑΚΚ οφειλόμενο', 'ΤΑΚΚ εισπραγμένο', 'ΤΑΚΚ που λείπει'],
        numeric: [2, 3, 4, 5, 6, 7, 8],
        formats: { 2: FMT.int, 3: FMT.int, 4: FMT.eur, 5: FMT.eur, 6: FMT.eur, 7: FMT.eur, 8: FMT.eur },
        rows: [...rows, ['Σύνολο', '', sumOf('stays'), sumOf('nights'), t.shortTermGross, sumOf('platformFees'), t.levyDue, t.levyCollected, Math.round((t.levyDue - t.levyCollected) * 100) / 100]],
        totals: [rows.length],
        sum: [2, 3, 4, 5, 6, 7, 8],
        notes: ['Ακαθάριστο: ό,τι πλήρωσε ο επισκέπτης μείον το τέλος ανθεκτικότητας, με τις διαμονές που περνούν την αλλαγή του χρόνου μοιρασμένες με τις νύχτες. Η προμήθεια της πλατφόρμας δεν μειώνει το ακαθάριστο.'],
      }],
    });
    XLSX.utils.book_append_sheet(wb, ws, 'Βραχυχρόνια');
  }

  // ── Τι λείπει, μία φορά ───────────────────────────────────────────────
  {
    const block = (xs: typeof missing, offset: number) => xs.map((m, i) => [offset + i + 1, m.what, m.scope, m.who, m.where]);
    const blocking = missing.filter(m => m.blocking), rest = missing.filter(m => !m.blocking);
    const { ws } = sectionSheet({
      title: `ΤΙ ΛΕΙΠΕΙ · ${input.year}`, sub, maxWidth: 60,
      blocks: [
        { title: `ΧΩΡΙΣ ΑΥΤΑ ΔΕΝ ΚΛΕΙΝΕΙ Η ΔΗΛΩΣΗ (${blocking.length})`, head: ['#', 'Τι', 'Για', 'Ποιος το φέρνει', 'Πού'], numeric: [0], formats: { 0: FMT.int }, rows: block(blocking, 0), empty: 'Κανένα. Όλα τα απαραίτητα υπάρχουν.' },
        ...(rest.length ? [{ title: `ΚΑΛΟ ΝΑ ΥΠΑΡΧΟΥΝ (${rest.length})`, head: ['#', 'Τι', 'Για', 'Ποιος το φέρνει', 'Πού'], numeric: [0], formats: { 0: FMT.int }, rows: block(rest, blocking.length) }] : []),
      ],
    });
    XLSX.utils.book_append_sheet(wb, ws, 'Τι λείπει');
  }
  return wb;
}

export interface MeetingPackRequest {
  userId: string;
  year: number;
  ownerAfm: string;
  ownerName: string | null;
  /** Οι παραδοχές του καταλόγου και ό,τι έχει ήδη σημειώσει ο χρήστης. */
  dossier: Omit<DossierContext, 'statuses' | 'properties'> & { have: readonly string[]; properties: readonly DossierProperty[] };
}

export interface MeetingPack {
  zip: Uint8Array<ArrayBuffer>;
  fileName: string;
  /** Οσα βλέπει ο λογιστής στη λίστα του, χωρίς να ανοίξει τον φάκελο. */
  status: { aadeDifferences: number | null; missingCount: number; missingTop: string[] };
  entries: number;
}

/**
 * Ο φάκελος ενός ΑΦΜ για ένα έτος. Φορτώνει, γράφει και συμπιέζει· επιστρέφει
 * τα bytes, το όνομα και την κατάσταση. Ο καλών αποφασίζει αν θα κατέβει ή αν
 * θα σταλεί στον λογιστή.
 */
export async function buildMeetingPack(db: SupabaseClient, req: MeetingPackRequest): Promise<MeetingPack | null> {
  const { userId, year, ownerAfm } = req;
  const [loaded, prefilled, refs] = await Promise.all([
    loadE2Rows(db, userId, year),
    listPrefilled(db, userId, year),
    declRefsByProperty(db, userId),
  ]);
  const group = afmGroups(loaded).find(g => g.afm === ownerAfm);
  if (!group) return null;
  const reconciliation = compareGroup(loaded, group, prefilled.rows, year, refs);
  const ids = new Set(group.idx.map(i => loaded.properties[i].id));

  // Τα χαρτιά ανά ακίνητο, με την αρίθμηση που έχουν και στον φάκελο του ακινήτου.
  const papers: PackPaper[] = [];
  const paperNotes: string[] = [];
  const paperCount = new Map<string, number>();
  for (const i of group.idx) {
    const p = loaded.properties[i];
    const got = await fetchDossierPapers(db, p.id, userId, year);
    const name = (p.name || '').trim() || p.address || 'Ακίνητο';
    paperNotes.push(...got.notes.map(n => `${name}: ${n}`));
    const filed = filePapers(got.files, []);
    paperCount.set(p.id, filed.length);
    for (const f of filed) papers.push({ property: name, file: f.file, bytes: f.paper.bytes });
  }

  const properties: PackProperty[] = group.idx.map(i => {
    const p = loaded.properties[i];
    const row = loaded.rows[i];
    const shortTerm = readStatus(p) === 'rent_short';
    const stays = loaded.staysByProp.get(p.id) || [];
    const s = shortTerm ? shortTermYearSummary(stays, year, { sqm: p.sqm ?? null, isHouse: isHouseType(p.prop_type) }) : null;
    const kinds = [...new Set(row.lines.map(l => l.use).filter(Boolean))];
    return {
      id: p.id,
      name: (p.name || '').trim() || p.address || 'Ακίνητο',
      address: row.address,
      atak: (p.atak || '').trim() || null,
      category: e2CategoryLabel(p.prop_type) || row.incomeCategory,
      ownershipPct: row.ownershipPct,
      yearStatus: kinds.join(' · ') || 'Χωρίς είδος μίσθωσης',
      months: row.months,
      gross: row.grossIncome,
      unpaid: row.unpaidRent,
      servicesExcluded: row.servicesExcluded,
      flags: row.flags,
      tenantWithoutAfm: row.lines.some(l => !!l.tenantName && !l.tenantAfm),
      papers: paperCount.get(p.id) ?? 0,
      shortTerm: s ? {
        ama: (p.ama || '').trim() || null, stays: s.stayCount, nights: s.totalNights, gross: s.grossRevenue,
        platformFees: s.platformFees, levyDue: s.levy, levyCollected: s.collectedLevy,
        staysWithoutFee: staysMissingPlatformFee(stays, year),
      } : null,
    };
  });

  // ΤΟ «ΤΙ ΛΕΙΠΕΙ» ΕΙΝΑΙ ΤΟΥ ΑΦΜ, ΟΧΙ ΤΟΥ ΧΑΡΤΟΦΥΛΑΚΙΟΥ. Ο κατάλογος βγαίνει
  // από τα ακίνητα ΑΥΤΟΥ του υπόχρεου· η δήλωση μίσθωσης του διαμερίσματος της
  // συζύγου δεν ανήκει στον φάκελο του συζύγου.
  const own = req.dossier.properties.filter(p => p.id && ids.has(p.id));
  const reqs = requirementsFor({ ...req.dossier, statuses: own.map(p => p.status), properties: own });
  const have = new Set(req.dossier.have);
  const requirements: PackRequirement[] = reqs.filter(q => !have.has(q.id) && q.who !== 'app').map(q => ({
    title: q.title, who: WHO_LABEL[q.who], source: q.source, blocking: !!q.blocking, forProperties: q.forProperties,
  }));

  const mine = prefilled.rows.filter(x => x.ownerAfm === ownerAfm);
  const last = mine.reduce<(typeof mine)[number] | null>((a, x) => (!a || x.updatedAt > a.updatedAt ? x : a), null);
  const input: MeetingPackInput = {
    year, ownerAfm, ownerName: req.ownerName, properties, reconciliation,
    aade: last ? { uploadedAt: last.updatedAt, by: last.uploadedBy, source: last.source } : null,
    requirements, paperNotes,
  };

  // Η σύνοψη μπαίνει στο μητρώο εγγράφων, όπως κάθε επίσημο PDF της εφαρμογής.
  // Το «αντικείμενο» είναι δημόσιο στη σελίδα επαλήθευσης: χωρίς ΑΦΜ και ονόματα.
  const missing = missingItems(input);
  const t = packTotals(properties);
  const issued = await issueDocument(db, {
    userId, docType: 'Φάκελος για τον λογιστή', subject: `Φάκελος ${year}`, period: `Χρήση ${year}`,
    summary: { properties: t.properties, gross: t.gross, differences: reconciliation.differences, missing: missing.length },
  });
  const cover = new Uint8Array(await (await reportPdfBlob(coverModel(input, issued))).arrayBuffer());

  // Το Ε2 ΜΟΝΟ αυτού του ΑΦΜ: ίδιο βιβλίο με την εξαγωγή, χωρίς τα άλλα ακίνητα.
  const only = { ...loaded, properties: group.idx.map(i => loaded.properties[i]), rows: group.idx.map(i => loaded.rows[i]) };
  const e2wb = buildE2Workbook(only, year);
  if (!e2wb) return null;

  let original: { name: string; bytes: Uint8Array } | null = null;
  const file = mine.find(x => x.sourceFile)?.sourceFile;
  if (file) {
    const bytes = await fileBytes(db, file);
    if (bytes) original = { name: file.split('/').pop()?.replace(/^\d+-/, '') || 'Προσυμπληρωμένο Ε2.pdf', bytes };
    else paperNotes.push('Το πρωτότυπο προσυμπληρωμένο δεν κατέβηκε και δεν συνοδεύει αυτόν τον φάκελο.');
  }

  const entries = packEntries({
    year, cover, e2: workbookBytes(e2wb), review: workbookBytes(buildReviewWorkbook(input)), papers, original,
  });
  return {
    zip: buildZip(entries),
    fileName: PACK_FILES.zip(year, ownerAfm),
    status: {
      aadeDifferences: reconciliation.status === 'not_uploaded' ? null : reconciliation.differences,
      missingCount: missing.length,
      missingTop: missing.slice(0, 5).map(m => (m.scope === 'Όλο το ΑΦΜ' ? m.what : `${m.what} (${m.scope})`)),
    },
    entries: entries.length,
  };
}
