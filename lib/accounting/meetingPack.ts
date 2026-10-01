// ═══════════════════════════════════════════════════════════════════════════
// Ο ΦΑΚΕΛΟΣ ΤΗΣ ΣΥΝΑΝΤΗΣΗΣ: ΕΝΑΣ ΑΝΑ ΑΦΜ ΚΑΙ ΕΤΟΣ
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΥΠΗΡΧΕ ΚΑΙ ΓΙΑΤΙ ΔΕΝ ΕΦΤΑΝΕ. Ο «φάκελος του λογιστή» της Λογιστικής ήταν
// ένα zip για το ΑΝΟΙΧΤΟ ακίνητο: τα νούμερα ενός διαμερίσματος δίπλα σε
// κατάλογο δικαιολογητικών όλου του χαρτοφυλακίου. Ο λογιστής όμως δουλεύει
// ανά ΦΟΡΟΛΟΓΟΥΜΕΝΟ: ένα Ε2 ανά ΑΦΜ, μία δήλωση ανά ΑΦΜ. Τρία διαμερίσματα του
// ίδιου ανθρώπου ήταν τρία zip που δεν έλεγαν πουθενά ότι ανήκουν μαζί. Και τα
// ακίνητα της συζύγου έμπαιναν στη λίστα του συζύγου.
//
// ΤΙ ΕΙΝΑΙ ΤΩΡΑ. Ενας φάκελος για ένα ΑΦΜ και ένα έτος, με όλα τα ακίνητα αυτού
// του ΑΦΜ και μόνο αυτά:
//
//   00 Σύνοψη.pdf                   μία σελίδα: ποιος, τι, πόσα, τι λείπει
//   01 Ε2 <έτος>.xlsx               το έντυπο, έτοιμο για το myAADE
//   02 Έλεγχος φακέλου.xlsx         σύγκριση με την ΑΑΔΕ, ανά ακίνητο,
//                                   βραχυχρόνια, τι λείπει (μία φορά)
//   03 Παραστατικά/<ακίνητο>/…      τα χαρτιά της χρήσης, ανά ακίνητο
//   04 ΑΑΔΕ/…                       το πρωτότυπο προσυμπληρωμένο, αν ανέβηκε
//
// ΕΔΩ ΖΕΙ Η ΛΟΓΙΚΗ, ΟΧΙ Η ΒΙΒΛΙΟΘΗΚΗ. Τι λείπει, τι γράφει η σύνοψη, πώς
// λέγονται τα αρχεία, ποια μπαίνουν στο zip: όλα καθαρές συναρτήσεις,
// δοκιμασμένες. Τα βιβλία εργασίας και το PDF τα γράφουν τα αρχεία της οθόνης
// (app/dashboard/components/meetingPackExport.ts) με το ίδιο οπτικό σύστημα
// που έχουν όλες οι εξαγωγές.
// ═══════════════════════════════════════════════════════════════════════════
import type { PrefilledReconciliation, FixIn } from '@/lib/billing/e2Reconcile';
import type { PdfReportModel, PdfSection } from '@/lib/pdf/pdfReport';
import type { ZipFile } from './zip';
import { fe, fp, grDate } from '@/lib/core/format';

/** Ενα ακίνητο του ΑΦΜ, όπως το χρειάζεται ο φάκελος. */
export interface PackProperty {
  id: string;
  name: string;
  address: string;
  atak: string | null;
  category: string;
  ownershipPct: number;
  /** Η χρήση μέσα στο έτος, στη γλώσσα του λογιστή («Εκμίσθωση», «Κενό»…). */
  yearStatus: string;
  months: number;
  /** Ακαθάριστο του Ε2 (μερίδιο του υπόχρεου). */
  gross: number;
  unpaid: number;
  servicesExcluded: number;
  /** Οι επισημάνσεις της γραμμής Ε2, όπως τις γράφει το `buildE2Row`. */
  flags: string[];
  /** Μισθωτής χωρίς ΑΦΜ σε κάποια μίσθωση του έτους. */
  tenantWithoutAfm: boolean;
  papers: number;
  shortTerm: PackShortTerm | null;
}

export interface PackShortTerm {
  ama: string | null;
  stays: number;
  nights: number;
  gross: number;
  platformFees: number;
  levyDue: number;
  levyCollected: number;
  /** Κρατήσεις πλατφόρμας χωρίς καταγεγραμμένη προμήθεια. */
  staysWithoutFee: number;
}

/** Ενα δικαιολογητικό που λείπει, από τον κατάλογο του lib/accounting/dossier.ts. */
export interface PackRequirement {
  title: string;
  who: string;
  source?: string;
  blocking: boolean;
  forProperties?: readonly string[];
}

export interface MeetingPackInput {
  year: number;
  ownerAfm: string;
  ownerName: string | null;
  properties: readonly PackProperty[];
  reconciliation: PrefilledReconciliation;
  /** Πότε και από ποιον ανέβηκε το προσυμπληρωμένο. */
  aade: { uploadedAt: string; by: 'owner' | 'accountant'; source: string } | null;
  /** Τα δικαιολογητικά του καταλόγου που ΔΕΝ έχουν σημειωθεί, μόνο για αυτά τα ακίνητα. */
  requirements: readonly PackRequirement[];
  /** Οσα παραστατικά δεν χώρεσαν ή δεν κατέβηκαν, με το όνομά τους. */
  paperNotes: readonly string[];
}

/** Μία γραμμή του «Τι λείπει». */
export interface MissingItem {
  what: string;
  /** Για ποιο ακίνητο ή «Ολο το ΑΦΜ». */
  scope: string;
  who: string;
  where: string;
  blocking: boolean;
}

const ALL = 'Όλο το ΑΦΜ';
const FIX_WHO: Record<FixIn, string> = { aade: 'Ο ιδιοκτήτης στο myAADE', app: 'Ο ιδιοκτήτης στην εφαρμογή', check: 'Ο λογιστής' };

/**
 * ΤΙ ΛΕΙΠΕΙ, ΜΙΑ ΦΟΡΑ. Πρώτα ό,τι μπλοκάρει, μετά τα υπόλοιπα. Κάθε γραμμή
 * λέει τι, για ποιο ακίνητο, ποιος το φέρνει και από πού: ο λογιστής το
 * διαβάζει χωρίς να σηκώσει τηλέφωνο.
 */
export function missingItems(input: MeetingPackInput): MissingItem[] {
  const out: MissingItem[] = [];
  const r = input.reconciliation;
  if (r.status === 'not_uploaded') {
    out.push({ what: `Το προσυμπληρωμένο Ε2 του ${input.year}`, scope: ALL, who: 'Ο ιδιοκτήτης ή ο λογιστής', where: 'myAADE, εφαρμογή Ε1 και Ε2', blocking: true });
  } else if (r.differences > 0) {
    out.push({
      what: `${r.differences === 1 ? 'Μία διαφορά' : `${r.differences} διαφορές`} με το προσυμπληρωμένο Ε2 (φύλλο «Σύγκριση με ΑΑΔΕ»)`,
      scope: ALL, who: 'Ο ιδιοκτήτης με τον λογιστή', where: 'myAADE ή εφαρμογή, όπως λέει κάθε γραμμή', blocking: true,
    });
  }
  for (const p of input.properties) {
    if (!p.atak) out.push({ what: 'ΑΤΑΚ του ακινήτου', scope: p.name, who: 'Ο ιδιοκτήτης', where: 'Ε9 (περιουσιολόγιο) στο myAADE', blocking: true });
    if (p.tenantWithoutAfm) out.push({ what: 'ΑΦΜ μισθωτή', scope: p.name, who: 'Ο ιδιοκτήτης', where: 'Μισθωτήριο ή δήλωση μίσθωσης', blocking: true });
    if (p.flags.some(f => /^Ακαθάριστο[^:]*: εκτίμηση/.test(f))) {
      out.push({ what: 'Καταχωρημένα μισθώματα ή διαμονές του έτους (το ποσό του Ε2 είναι εκτίμηση)', scope: p.name, who: 'Ο ιδιοκτήτης', where: 'Εφαρμογή, Ενοίκια ή Διαμονές', blocking: true });
    }
    if (p.flags.some(f => /χωρίς ρητή βάση ποσού/.test(f))) {
      out.push({ what: 'Βάση ποσού των διαμονών (ακαθάριστο ή ποσό λογαριασμού)', scope: p.name, who: 'Ο ιδιοκτήτης', where: 'Εφαρμογή, Διαμονές', blocking: false });
    }
    if (p.unpaid > 0) {
      out.push({ what: `Τεκμηρίωση για τα ανείσπρακτα ${fe(p.unpaid)} (διαταγή πληρωμής ή αγωγή)`, scope: p.name, who: 'Ο ιδιοκτήτης', where: 'Δικηγόρος ή δικαστήριο', blocking: false });
    }
    if (p.shortTerm && !p.shortTerm.ama) out.push({ what: 'ΑΜΑ (Αριθμός Μητρώου Ακινήτου βραχυχρόνιας)', scope: p.name, who: 'Ο ιδιοκτήτης', where: 'Μητρώο βραχυχρόνιας στο myAADE', blocking: true });
    if (p.shortTerm && p.shortTerm.staysWithoutFee > 0) {
      out.push({ what: `Προμήθεια πλατφόρμας σε ${p.shortTerm.staysWithoutFee === 1 ? 'μία κράτηση' : `${p.shortTerm.staysWithoutFee} κρατήσεις`}`, scope: p.name, who: 'Ο ιδιοκτήτης', where: 'Τιμολόγια της πλατφόρμας', blocking: false });
    }
  }
  for (const q of input.requirements) {
    out.push({ what: q.title, scope: q.forProperties?.length ? q.forProperties.join(', ') : ALL, who: q.who, where: q.source || '', blocking: q.blocking });
  }
  for (const n of input.paperNotes) out.push({ what: n, scope: ALL, who: 'Ο ιδιοκτήτης', where: 'Αρχείο της εφαρμογής', blocking: false });
  return [...out.filter(x => x.blocking), ...out.filter(x => !x.blocking)];
}

export interface PackTotals {
  properties: number;
  gross: number;
  unpaid: number;
  months: number;
  shortTermGross: number;
  nights: number;
  levyDue: number;
  levyCollected: number;
}

export function packTotals(props: readonly PackProperty[]): PackTotals {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    properties: props.length,
    gross: r2(props.reduce((s, p) => s + p.gross, 0)),
    unpaid: r2(props.reduce((s, p) => s + p.unpaid, 0)),
    months: props.reduce((s, p) => s + p.months, 0),
    shortTermGross: r2(props.reduce((s, p) => s + (p.shortTerm?.gross ?? 0), 0)),
    nights: props.reduce((s, p) => s + (p.shortTerm?.nights ?? 0), 0),
    levyDue: r2(props.reduce((s, p) => s + (p.shortTerm?.levyDue ?? 0), 0)),
    levyCollected: r2(props.reduce((s, p) => s + (p.shortTerm?.levyCollected ?? 0), 0)),
  };
}

/** Η κατάσταση της σύγκρισης σε μία φράση, ίδια στο PDF, στο φύλλο και στη λίστα του λογιστή. */
export function aadeStatusLine(r: PrefilledReconciliation): string {
  if (r.status === 'not_uploaded') return 'Το προσυμπληρωμένο δεν έχει ανέβει';
  if (r.status === 'matches') return r.matched === 1 ? 'Συμφωνεί στη μία γραμμή' : `Συμφωνεί και στις ${r.matched} γραμμές`;
  return r.differences === 1 ? 'Μία διαφορά' : `${r.differences} διαφορές`;
}

// ── ΤΑ ΟΝΟΜΑΤΑ ΤΩΝ ΑΡΧΕΙΩΝ ──────────────────────────────────────────────────
// Αριθμημένα, ώστε να διαβάζονται με τη σειρά σε κάθε σύστημα. Το ΑΦΜ μέσα στο
// όνομα του zip: δύο φάκελοι του ίδιου έτους δεν μπερδεύονται στα «Λήψεις».
export const PACK_FILES = {
  zip: (year: number, afm: string) => `Φάκελος λογιστή ${year} ΑΦΜ ${afm}.zip`,
  cover: '00 Σύνοψη.pdf',
  e2: (year: number) => `01 Ε2 ${year}.xlsx`,
  review: '02 Έλεγχος φακέλου.xlsx',
  papers: '03 Παραστατικά',
  aade: '04 ΑΑΔΕ',
} as const;

/** Ονομα φακέλου ακινήτου: χωρίς χαρακτήρες που δεν δέχονται τα Windows. */
export const folderName = (s: string): string =>
  (String(s || 'Ακίνητο').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)) || 'Ακίνητο';

export interface PackPaper { property: string; file: string; bytes: Uint8Array }

/**
 * Τα περιεχόμενα του zip, με τη σειρά τους. Δύο ακίνητα με το ίδιο όνομα
 * παίρνουν διαφορετικό φάκελο: αλλιώς τα χαρτιά του ενός θα έπεφταν πάνω στα
 * χαρτιά του άλλου.
 */
export function packEntries(o: {
  year: number;
  cover: Uint8Array;
  e2: Uint8Array;
  review: Uint8Array;
  papers: readonly PackPaper[];
  original?: { name: string; bytes: Uint8Array } | null;
}): ZipFile[] {
  const files: ZipFile[] = [
    { path: PACK_FILES.cover, data: o.cover },
    { path: PACK_FILES.e2(o.year), data: o.e2 },
    { path: PACK_FILES.review, data: o.review },
  ];
  const folders = new Map<string, string>();
  const used = new Set<string>();
  for (const p of o.papers) {
    let folder = folders.get(p.property);
    if (!folder) {
      const base = folderName(p.property);
      folder = base;
      for (let n = 2; used.has(folder); n++) folder = `${base} (${n})`;
      used.add(folder);
      folders.set(p.property, folder);
    }
    files.push({ path: `${PACK_FILES.papers}/${folder}/${p.file}`, data: p.bytes });
  }
  if (o.original) files.push({ path: `${PACK_FILES.aade}/${folderName(o.original.name)}`, data: o.original.bytes });
  return files;
}

// ── Η ΣΥΝΟΨΗ ΣΕ ΜΙΑ ΣΕΛΙΔΑ ─────────────────────────────────────────────────
/** Πόσες γραμμές χωράνε σε κάθε πίνακα ώστε η σύνοψη να μένει σε μία σελίδα Α4. */
const COVER_ROWS = 8;

/**
 * Το μοντέλο του PDF της σύνοψης, στο ίδιο σύστημα με κάθε επίσημο έγγραφο της
 * εφαρμογής (lib/pdf/pdfReport.ts): σήμα, αριθμός εγγράφου, υποσέλιδο σελίδας.
 */
export function coverModel(input: MeetingPackInput, meta: { id: string; issuedAt: string; verifyUrl: string }): PdfReportModel {
  const t = packTotals(input.properties);
  const r = input.reconciliation;
  const missing = missingItems(input);
  const blocking = missing.filter(m => m.blocking).length;
  const cut = <T,>(xs: readonly T[]) => xs.slice(0, COVER_ROWS);
  const more = (n: number, one: string, many: string) => (n > COVER_ROWS ? [[`Και ${n - COVER_ROWS === 1 ? one : `${n - COVER_ROWS} ${many}`} στο «02 Έλεγχος φακέλου».`, '', '', '']] : []);

  const sections: PdfSection[] = [
    { type: 'kpis', items: [
      { label: 'Ακίνητα', value: String(t.properties) },
      { label: 'Ακαθάριστο Ε2', value: fe(t.gross) },
      { label: 'Σύγκριση με ΑΑΔΕ', value: aadeStatusLine(r) },
      { label: 'Τι λείπει', value: missing.length === 0 ? 'Τίποτα' : blocking ? `${missing.length}, ${blocking} απαραίτητα` : String(missing.length) },
    ] },
    { type: 'rows', title: 'Υπόχρεος', rows: [
      { label: 'ΑΦΜ', value: input.ownerAfm },
      ...(input.ownerName ? [{ label: 'Ονοματεπώνυμο', value: input.ownerName }] : []),
      { label: 'Φορολογικό έτος', value: String(input.year) },
      { label: 'Προσυμπληρωμένο Ε2', value: input.aade ? `Ανέβηκε ${grDate(input.aade.uploadedAt)} από ${input.aade.by === 'accountant' ? 'τον λογιστή' : 'τον ιδιοκτήτη'}` : 'Δεν έχει ανέβει', kind: input.aade ? 'normal' : 'muted' },
    ] },
    { type: 'table', title: 'Ακίνητα', head: ['Ακίνητο', 'ΑΤΑΚ', 'Χρήση', 'Μήνες', 'Ακαθάριστο'], align: ['l', 'l', 'l', 'r', 'r'],
      rows: [
        ...cut(input.properties).map(p => [p.name, p.atak || 'Λείπει', p.yearStatus, String(p.months), fe(p.gross)]),
        ...(input.properties.length > COVER_ROWS ? [[`Και ${input.properties.length - COVER_ROWS} ακόμη στο «02 Έλεγχος φακέλου».`, '', '', '', '']] : []),
      ],
      result: ['Σύνολο', '', '', String(t.months), fe(t.gross)] },
  ];
  if (r.status === 'differences') {
    const diffs = r.lines.filter(l => l.findings.length);
    sections.push({ type: 'table', title: 'Διαφορές με το προσυμπληρωμένο', head: ['Ακίνητο', 'Εφαρμογή', 'ΑΑΔΕ', 'Διόρθωση'], align: ['l', 'r', 'r', 'l'],
      rows: [
        ...cut(diffs).map(l => [`${l.propertyName}${l.tenant ? ` · ${l.tenant}` : ''}`, l.app ? fe(l.app.gross) : 'Λείπει', l.aade ? fe(l.aade.gross) : 'Λείπει', FIX_WHO[l.findings[0].fixIn]]),
        ...more(diffs.length, 'μία ακόμη', 'ακόμη'),
      ],
      result: ['Σύνολο', fe(r.totalOurs), fe(r.totalTheirs), `Διαφορά ${fe(Math.abs(r.totalDiff))}`] });
  } else {
    sections.push({ type: 'note', title: 'Σύγκριση με το προσυμπληρωμένο', text: r.headline ?? 'Το προσυμπληρωμένο Ε2 δεν έχει ανέβει ακόμη. Η σύγκριση γίνεται μόλις ανέβει, από τον ιδιοκτήτη ή από τον λογιστή.' });
  }
  if (t.shortTermGross > 0) {
    sections.push({ type: 'rows', title: 'Βραχυχρόνια', rows: [
      { label: 'Διανυκτερεύσεις στο έτος', value: String(t.nights) },
      { label: 'Ακαθάριστο διαμονών', value: fe(t.shortTermGross) },
      { label: 'ΤΑΚΚ οφειλόμενο / εισπραγμένο', value: `${fe(t.levyDue)} / ${fe(t.levyCollected)}` },
    ] });
  }
  // Η στήλη «Για» δεν σπάει: το «Όλο το ΑΦΜ» τυλιγόταν σε δύο γραμμές, γιατί
  // η πρώτη στήλη (`*`) έπαιρνε όλο το πλάτος και η «Για» έμενε στο ελάχιστο.
  sections.push({ type: 'table', title: 'Τι λείπει', head: ['Τι', 'Για', 'Ποιος'], align: ['l', 'l', 'l'], noWrap: [1],
    rows: missing.length
      ? [...cut(missing).map(m => [m.blocking ? `${m.what} (απαραίτητο)` : m.what, m.scope, m.who]), ...(missing.length > COVER_ROWS ? [[`Και ${missing.length - COVER_ROWS} ακόμη στο «02 Έλεγχος φακέλου».`, '', '']] : [])]
      : [['Τίποτα. Ο φάκελος είναι πλήρης.', '', '']] });
  sections.push({ type: 'note', title: 'Περιεχόμενα', text: `${PACK_FILES.e2(input.year)}: το έντυπο Ε2 του ΑΦΜ. ${PACK_FILES.review}: σύγκριση με την ΑΑΔΕ, ανά ακίνητο, βραχυχρόνια και τι λείπει. ${PACK_FILES.papers}: τα παραστατικά της χρήσης ανά ακίνητο.${input.aade ? ` ${PACK_FILES.aade}: το πρωτότυπο προσυμπληρωμένο.` : ''}` });

  const share = input.properties.some(p => p.ownershipPct < 100)
    ? ` Τα ποσά είναι το μερίδιο του υπόχρεου (${input.properties.filter(p => p.ownershipPct < 100).map(p => `${p.name} ${fp(p.ownershipPct)}`).join(', ')}).`
    : '';
  return {
    docType: 'Φάκελος για τον λογιστή',
    title: `Φορολογικό έτος ${input.year} · ΑΦΜ ${input.ownerAfm}`,
    subtitle: input.ownerName ?? undefined,
    meta: { id: meta.id, issuedAt: meta.issuedAt, verifyUrl: meta.verifyUrl, note: `Χρήση ${input.year}` },
    sections,
    disclaimer: `Τα ποσά βγαίνουν από τις καταχωρήσεις της εφαρμογής και, για τη σύγκριση, από το προσυμπληρωμένο Ε2 όπως ανέβηκε.${share} Ο φάκελος δεν υποβάλλει τίποτα και δεν υπολογίζει φόρο.`,
  };
}
