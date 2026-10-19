'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Καθολική σάρωση εγγράφου: μία φωτογραφία → σωστό tab, αυτόματα.
// Ο χρήστης ανεβάζει ΟΤΙΔΗΠΟΤΕ (λογαριασμό, πληρωμή, μισθωτήριο, τίτλο, ασφάλεια,
// ΕΝΦΙΑ, κρατικό έγγραφο). Το AI το αναγνωρίζει, εμείς το δρομολογούμε (καθαρή,
// δοκιμασμένη λογική στο lib/billing/documents.ts) και ενημερώνουμε τους σωστούς
// πίνακες. Ο χρήστης μπορεί να διορθώσει τύπο/πεδία και να προσθέσει δικά του.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useCallback, useEffect, useId, Fragment, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { trackOnboarding, PRODUCT_EVENTS } from '@/lib/analytics/events';
// Οι επαφές έχουν ένα σπίτι: lib/data/contacts.
import * as contacts from '@/lib/data/contacts';
import { BankLinkTile } from './BankLink';
import { bankLinkState } from '@/lib/bank/link';
import { T, TT, fe, fn, fixedCols, RuntimeImg, Btn, IconBtn, InfoBanner, Skeleton } from '@/components/Theme';
import { CustomSelect, DatePicker, TextInput, NumberInput, Textarea, LabelDot } from './UIComponents';
import {
  validateDoc, docSummaryLine, kindOf, applyKind, docForm, docTargets, fieldOptions, fieldValue, withField,
  withPropertyLine, isDocumentary, billCategoryLabel, archiveOptions, archiveCategoryFor, folderOf, compactRow,
  lineUnset, LINE_NONE, KIND_OPTIONS, DOC_FIELD_LABELS, type ScannedDoc, type DocField, type Choice,
} from '@/lib/billing/documents';
import { navLabel } from '@/lib/nav/labels';
import { athensToday } from '@/lib/core/time';
import {
  scanDocument, commitScannedDoc, MAX_SCAN_MB, SYSTEM_PROMPT as SCAN_SYSTEM_PROMPT,
  SCAN_ACCEPT, unreadableFormat, withAnswer, failedNotice, openQuestion,
  type ReconcileQuestion, type CommitAnswers,
} from './scanDoc';
import { inferRole } from '@/lib/contacts/roles';
import { ensureDpa } from '@/lib/legal/dpa';
import { SAY } from '@/lib/core/dbError';

// Το prompt ζει στο scanDoc.ts (μαζί με όλη τη μηχανή σάρωσης). Επανεξάγεται εδώ
// επειδή οθόνες που δεν ανήκουν σε αυτή τη ροή (Ενοικιαστής, Αρχείο) το εισάγουν
// ιστορικά από εδώ — η αλλαγή διαδρομής θα ήταν άσκοπη ρήξη.
export const SYSTEM_PROMPT = SCAN_SYSTEM_PROMPT;

interface Props {
  propertyId: string; userId?: string; onSaved?: () => void;
  /**
   * Τα ακίνητα του χρήστη. Από εδώ το παράθυρο δείχνει τον επιλογέα «Ακίνητο»
   * (όταν είναι περισσότερα από ένα), ξέρει τον ΑΤΑΚ του ακινήτου και διαλέγει
   * μόνο του τη γραμμή του σε Ε9 ή ΕΝΦΙΑ με πολλά ακίνητα.
   */
  properties?: { id: string; name: string; address?: string | null; atak?: string | null }[];
  /**
   * Ο ΤΕΤΑΡΤΟΣ ΔΡΟΜΟΣ: ΧΩΡΙΣ ΧΑΡΤΙ.
   *
   * Τα τρία πλακίδια απαντούν στο «πώς μπαίνει αυτό μέσα;» υποθέτοντας ότι
   * υπάρχει ένα «αυτό»: φωτογραφία, αρχείο ή κίνηση τράπεζας. Οποιος όμως
   * θυμήθηκε μια δαπάνη χωρίς να έχει παραστατικό μπροστά του δεν είχε εδώ
   * καμία απάντηση και έπρεπε να κλείσει το παράθυρο και να ψάξει αλλού.
   *
   * Οταν δίνεται, εμφανίζεται τέταρτο πλακίδιο που πάει στη χειροκίνητη
   * καταχώρηση. Ο καλών αποφασίζει τι σημαίνει αυτό: το παράθυρο δεν ξέρει
   * ούτε ποια καρτέλα είναι ανοιχτή ούτε πού ζει η φόρμα.
   */
  onManual?: () => void;
  /**
   * Λέει προς τα έξω αν η σάρωση ή η αποθήκευση τρέχει ΤΩΡΑ.
   *
   * ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΚΛΕΙΝΕΙ. Το παράθυρο που φιλοξενεί τη σάρωση ακούει πλέον
   * Escape (πριν δεν άκουγε τίποτα). Το κλείσιμό του καλεί `closeQuickAdd`,
   * που ΔΙΑΓΡΑΦΕΙ το κενό προσχέδιο ακινήτου. Δηλαδή ένα άστοχο Escape στη
   * μέση της αναγνώρισης έσβηνε το ακίνητο που μόλις δημιουργήθηκε — και ο
   * χρήστης δεν είχε κανέναν τρόπο να καταλάβει τι έγινε.
   *
   * Το component δεν μπορεί να το λύσει μόνο του: η απόφαση «τι σημαίνει
   * κλείσιμο» ανήκει σε αυτόν που το φιλοξενεί. Του λέμε μόνο αν δουλεύει.
   */
  onBusyChange?: (busy: boolean) => void;
  /**
   * Ανοίγει τη Λογιστική. Το Ε2 αρχειοθετείται εδώ, αλλά η σύγκρισή του με τα
   * μισθώματα ζει εκεί: η οθόνη επιτυχίας του Ε2 δίνει τον δρόμο με ένα
   * πάτημα αντί να τον περιγράφει.
   */
  onOpenAccounting?: () => void;
}

// ΚΑΤΩ ΑΠΟ ΑΥΤΟ Η ΣΑΡΩΣΗ ΔΕΝ ΕΙΝΑΙ ΣΙΓΟΥΡΗ ΓΙΑ ΤΟΝ ΤΥΠΟ. Η βεβαιότητα είναι
// αυτοαξιολόγηση του μοντέλου για τον τύπο και τον υποτύπο, χωρίς βαθμονόμηση:
// αξίζει ως κατώφλι, όχι ως ποσοστό στην οθόνη. Σταθερά της οθόνης, όχι κανόνας.
const TYPE_UNSURE_BELOW = 60;

// ΤΑ ΠΕΔΙΑ ΑΝΑ ΤΥΠΟ ΔΕΝ ΖΟΥΝ ΕΔΩ. Η φόρμα, ο έλεγχος, η αποθήκευση και η
// ανάγνωση διαβάζουν το ΙΔΙΟ σχήμα (lib/billing/documents.ts: DOC_KINDS και
// docForm). Ένας δεύτερος κατάλογος εδώ είχε ήδη αποκλίνει: ζητούσε «Κάλυψη»
// που κατέληγε μόνο σε σημείωση και δεν είχε καθόλου Ε9, Ε1 ή ΠΕΑ.

// ═══ ΔΥΟ ΕΝΔΕΙΞΕΙΣ, ΜΕΣΑ ΣΤΗΝ ΕΤΙΚΕΤΑ ═══════════════════════════════════════
// «λείπει» μόνο σε υποχρεωτικό πεδίο που είναι κενό· «άκυρο» σε τιμή που
// διαβάστηκε αλλά δεν περνά τον έλεγχό της (ΑΦΜ, ΑΤΑΚ, ΑΜΑ, ανάποδη περίοδος).
// Πριν, κάθε προαιρετικό πεδίο του μισθωτηρίου έγραφε «• ΛΕΙΠΕΙ» σε κίτρινα
// ΚΕΦΑΛΑΙΑ και τα πέντε πεδία φαίνονταν σφάλματα ενώ απαιτούνταν τα δύο. Η
// λέξη μπαίνει ΜΕΣΑ στο `<label>`, οπότε ο αναγνώστης οθόνης την ακούει μαζί με
// το όνομα του πεδίου· τα περιγράμματα δεν βάφονται.
type Flag = 'missing' | 'invalid';
const FLAG: Record<Flag, { word: string; color: string }> = {
  missing: { word: 'λείπει', color: 'var(--warning)' },
  invalid: { word: 'άκυρο', color: 'var(--negative)' },
};

const FlagWord = ({ flag }: { flag: Flag }) => (
  <span style={{ ...TT.caption, lineHeight: 1, color: FLAG[flag].color, letterSpacing: 0 }}>{FLAG[flag].word}</span>
);

/**
 * ΕΝΑ ΠΕΔΙΟ ΤΟΥ ΣΧΗΜΑΤΟΣ, ΜΕ ΤΟ ΧΕΙΡΙΣΤΗΡΙΟ ΤΗΣ ΕΦΑΡΜΟΓΗΣ.
 *
 * Δεν έχει δικό του στυλ: διαλέγει ανάμεσα στα πέντε κοινά πεδία (CustomSelect,
 * DatePicker, NumberInput, TextInput) ώστε όλα να έχουν ένα ύψος, μία γωνία,
 * ένα φόντο και το δαχτυλίδι εστίασης. Το τοπικό `Field` που αντικαθιστά έγραφε
 * ωμό `<input>` με άλλο φόντο, γωνία 6, τρία ύψη και `outline: none`.
 */
function ScanField({ f, doc, today, flag, hint, onChange, options }: {
  f: DocField; doc: ScannedDoc; today: string; flag?: Flag; hint?: string;
  onChange: (v: string) => void; options?: Choice[];
}) {
  const info: ReactNode = flag || hint ? (
    <>
      {/* Υψος γραμμής 1: η λεζάντα των 11 με το δικό της 1,45 ψήλωνε τη γραμμή
          της ετικέτας και την ανέβαζε δύο εικονοστοιχεία πάνω από τη διπλανή.
          Το κενό είναι ΧΑΡΑΚΤΗΡΑΣ, όχι περιθώριο: με περιθώριο ο αναγνώστης
          οθόνης διάβαζε «Τύπος εγγράφουλείπει», μία λέξη. */}
      {flag && <>{' '}<FlagWord flag={flag} /></>}
      {hint && <LabelDot text={hint} />}
    </>
  ) : undefined;
  const value = fieldValue(doc, f);
  switch (f.input) {
    case 'select':
      // Χωρίς δικό του placeholder: το «Επιλογή…» του επιλογέα, μία διατύπωση
      // για την κενή τιμή σε λίστες και ημερομηνίες. Ο επιλογέας γραμμής λέει τι
      // ζητά, γιατί εκεί το κενό είναι ερώτηση που περιμένει απάντηση.
      return <CustomSelect label={f.label} labelInfo={info} value={value}
        placeholder={f.options === 'line' ? 'Διάλεξε γραμμή' : undefined}
        onChange={onChange} options={options ?? fieldOptions(f, doc, today)} />;
    case 'date':
      // Το ημερολόγιο ονομάζεται από το `ariaLabel`, όχι από την ορατή ετικέτα:
      // η ένδειξη μπαίνει και εκεί, αλλιώς ο αναγνώστης οθόνης δεν θα την άκουγε.
      return <DatePicker label={f.label} labelInfo={info} ariaLabel={flag ? `${f.label}, ${FLAG[flag].word}` : undefined}
        value={value} onChange={onChange} />;
    case 'money':
    case 'number':
      // ΧΩΡΙΣ `min`: το NumberInput γράφει το κάτω όριο όταν αδειάζει το
      // πεδίο, οπότε η «Ημέρα πληρωμής» θα γινόταν 1 μόλις τη σβήσεις. Το όριο
      // το κόβει το σχήμα (withField) και το μηδέν σβήνει το κλειδί.
      return <NumberInput label={f.label} labelInfo={info} value={value} onChange={onChange} suffix={f.suffix} max={f.max} />;
    default:
      return <TextInput label={f.label} labelInfo={info} value={value} onChange={onChange}
        mono={f.input === 'code'} inputMode={f.numeric ? 'numeric' : undefined} />;
  }
}

// ΤΑ ΑΠΟΣΙΩΠΗΤΙΚΑ ΘΕΛΟΥΝ ΜΙΑ ΓΡΑΜΜΗ. Το `TT.bodySm` και το `TT.caption` φέρνουν
// `textWrap: pretty`, που ως ενσωματωμένο στυλ νικά το `nowrap` της `.po-elide`:
// το όνομα αρχείου και η σύνοψη της μπάρας τύλιγαν αντί να κόβονται.
const ELIDE = { textWrap: 'nowrap' } as const;
// Το οριζόντιο γέμισμα του Btn (Theme.tsx, `--btn-pad`). Το κουμπί-κείμενο
// στοιχίζεται οπτικά με την άκρη της στήλης, όχι με το αόρατο κουτί του.
const GHOST_INSET = 18;

/** Το μέγεθος του αρχείου, όπως το λέει ο άνθρωπος. */
const sizeLabel = (b: number) => (b >= 1048576 ? `${fn(b / 1048576, 1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
/** Τελεία στο τέλος της πρότασης, όταν δεν την έχει ήδη. */
const sentence = (s: string) => (/[.!;·…]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);

// Τι λέει το InfoBanner για κάθε τιμή που δεν περνά τον έλεγχό της.
const INVALID_SAY: Record<string, string> = {
  afm: 'Το ΑΦΜ δεν περνά τον έλεγχο.', provider_afm: 'Το ΑΦΜ δεν περνά τον έλεγχο.',
  atak: 'Ο ΑΤΑΚ δεν περνά τον έλεγχο.', ama: 'Ο ΑΜΑ δεν περνά τον έλεγχο.',
  period_from: 'Η περίοδος είναι ανάποδη: το «από» είναι μετά το «έως».',
};

const DocIcon = ({ size }: { size: number }) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
);

export default function DocumentScan({ propertyId, userId = '', onSaved, onBusyChange, onManual, onOpenAccounting, properties }: Props) {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  // Το ref διαβάζεται ΜΕΣΑ σε useCallback, όχι στην απόδοση. Ο κανόνας
  // `react-hooks/refs` δεν μπορεί να ξέρει ότι το `pressable` απλώς αποθηκεύει
  // τη συνάρτηση — και έχει δίκιο να μην το υποθέτει. Αυτή είναι η καθιερωμένη
  // μορφή και διαβάζεται καλύτερα: δύο ονομασμένες ενέργειες αντί για δύο
  // ανώνυμα βέλη μέσα στο JSX.
  const openCamera = useCallback(() => cameraRef.current?.click(), []);
  // Η σύνδεση με την τράπεζα φαίνεται ως επιλογή μόνο όταν δουλεύει (lib/bank/link).
  const bankOpen = bankLinkState() === 'open';
  const openFilePicker = useCallback(() => fileRef.current?.click(), []);

  // ΤΟ ΑΚΙΝΗΤΟ ΕΙΝΑΙ ΕΠΙΛΟΓΗ, ΟΧΙ ΥΠΟΘΕΣΗ. Ηταν σιωπηλά το ακίνητο που ήταν
  // ανοιχτό στο ταμπλό και δεν φαινόταν πουθενά στο παράθυρο: ο λογαριασμός
  // της Κυψέλης έμπαινε στο Κουκάκι επειδή εκεί ήταν ο χρήστης όταν πάτησε.
  const [targetId, setTargetId] = useState(propertyId);
  const atakOf = (id: string) => properties?.find(p => p.id === id)?.atak ?? null;
  const propertyAtak = atakOf(targetId);
  const targetName = properties?.find(p => p.id === targetId)?.name || '';

  const [file, setFile] = useState<File | null>(null);
  // Ο σύνδεσμος του αρχείου στη μνήμη του περιηγητή: δείχνει την εικόνα και
  // ανοίγει το πρωτότυπο σε νέα καρτέλα (ένα `data:` δεν ανοίγει πια εκεί).
  const [fileUrl, setFileUrl] = useState('');
  useEffect(() => () => { if (fileUrl) URL.revokeObjectURL(fileUrl); }, [fileUrl]);
  const [scanning, setScanning] = useState(false);
  const [edited, setEdited] = useState<ScannedDoc | null>(null);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<'upload' | 'review' | 'done'>('upload');
  const [error, setError] = useState('');
  const [errorText, setErrorText] = useState('');
  const [savedInfo, setSavedInfo] = useState<string[]>([]);
  // Ό,τι ΔΕΝ γράφτηκε. Η οθόνη επιτυχίας το λέει αντί να γράφει «ενημερώθηκαν
  // αυτόματα οι σχετικές καρτέλες» πάνω από ένα μισό αποτέλεσμα.
  const [failedInfo, setFailedInfo] = useState<string[]>([]);
  // Ο χρήστης άλλαξε τον τύπο: η αβεβαιότητα της σάρωσης δεν τον αφορά πια.
  const [typeTouched, setTypeTouched] = useState(false);
  // Το ράφι του Φακέλου. `null` = ακολουθεί την προεπιλογή του τύπου, ώσπου να
  // το αλλάξει ο χρήστης· μια νέα αλλαγή τύπου το επαναφέρει στην προεπιλογή.
  const [archiveCat, setArchiveCat] = useState<string | null>(null);

  const uid = useId();
  const reasonId = `${uid}-reason`;
  const formRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  // Η σειρά «δικό σου πεδίο» που μόλις προστέθηκε παίρνει την εστίαση.
  const focusCustom = useRef<number | null>(null);

  // Μία γραμμή, δύο καταστάσεις: όσο διαβάζεται το έγγραφο ή όσο γράφεται στη
  // βάση, το παράθυρο από πάνω δεν επιτρέπεται να κλείσει και να σβήσει το
  // προσχέδιο. Το effect τρέχει ΜΕΤΑ την απόδοση, οπότε ο γονέας μαθαίνει την
  // αλλαγή χωρίς να γράφει state μέσα σε render.
  const busy = scanning || saving;
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  useEffect(() => () => { onBusyChange?.(false); }, [onBusyChange]);
  // ΤΟ ΣΚΑΛΙ `scan_opened`: μία φορά ανά άνοιγμα του παραθύρου, χωρίς τίποτα
  // από το έγγραφο. Το παράθυρο φτιάχνει τη σάρωση από την αρχή κάθε φορά.
  useEffect(() => { void trackOnboarding(createClient(), { event: PRODUCT_EVENTS.scan_opened }); }, []);
  // Ερώτηση συμφωνίας: όταν η βεβαιότητα ταιριάσματος με εκκρεμή λογαριασμό είναι
  // χαμηλή, ΔΕΝ εξοφλούμε σιωπηλά — ρωτάμε ποιον (ή κανέναν).
  const [ask, setAsk] = useState<ReconcileQuestion | null>(null);
  const [duplicate, setDuplicate] = useState('');
  // Οι απαντήσεις ως τώρα. Η επόμενη ερώτηση ΔΕΝ σβήνει την προηγούμενη
  // απάντηση: «ούτως ή άλλως» και μετά «αυτόν τον λογαριασμό» στέλνονται μαζί.
  const [answers, setAnswers] = useState<CommitAnswers>({});
  // Πρόταση αποθήκευσης του εκδότη (προμηθευτή/επαγγελματία) στις Επαφές, μετά τη
  // σάρωση λογαριασμού/απόδειξης. Ποτέ αυτόματα — μόνο με ρητή επιβεβαίωση χρήστη.
  const [contactState, setContactState] =
    useState<'cta' | 'saving' | 'saved' | 'exists' | 'error' | 'dpa' | 'dismissed'>('cta');

  // ΟΙ ΚΑΡΤΕΣ ΕΡΩΤΗΣΗΣ ΕΜΦΑΝΙΖΟΝΤΑΙ ΚΑΤΩ ΑΠΟ ΤΗ ΦΟΡΜΑ, όπου ο χρήστης που μόλις
  // πάτησε «Καταχώρηση» δεν κοιτάζει. Ερχονται στο οπτικό πεδίο και η εστίαση
  // πάει στην πρώτη επιλογή, ώστε η απάντηση να είναι ένα πάτημα μακριά.
  useEffect(() => {
    if (!ask && !duplicate) return;
    const el = cardRef.current;
    if (!el) return;
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    el.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus({ preventScroll: true });
  }, [ask, duplicate]);

  const customCount = edited?.custom?.length ?? 0;
  useEffect(() => {
    const i = focusCustom.current;
    if (i == null) return;
    focusCustom.current = null;
    document.getElementById(`${uid}-cf-${i}`)?.focus();
  }, [customCount, uid]);

  // Η αλλαγή πεδίου περνά από το σχήμα: εκεί καθαρίζουν οι κωδικοί, γίνονται
  // αριθμοί τα ποσά και σβήνει το «Στο χαρτί» όταν αλλάζει η περίοδος.
  const setF = (f: DocField, raw: string) => setEdited(p => (p ? withField(p, f, raw) : p));

  const loadFile = useCallback(async (f: File) => {
    // Η ΙΔΙΑ ΛΙΣΤΑ ΜΕ ΤΟ `accept` (scanDoc.ts: SCAN_TYPES). Εδώ περνούσαν CSV και
    // Excel που ο πάροχος δεν διαβάζει και γύριζαν «η υπηρεσία δεν απαντά».
    const unreadable = unreadableFormat(f);
    if (unreadable) { setError(unreadable); return; }
    // Όριο μεγέθους: προστατεύει και την αποθήκευση και την πληρωμένη κλήση AI από
    // τεράστια αρχεία (το base64 φουσκώνει ~33%, οπότε 10MB ≈ 13MB payload).
    if (f.size > MAX_SCAN_MB * 1024 * 1024) {
      // Ο ίδιος μορφοποιητής με τη γραμμή του αρχείου: «9,5 MB», όχι «9.5MB».
      setError(`Το αρχείο είναι πολύ μεγάλο (${sizeLabel(f.size)}). Όριο ${MAX_SCAN_MB} MB.`); return;
    }
    // προεπισκόπηση-blob: δείχνει το αρχείο και το ανοίγει σε νέα καρτέλα, δεν κατεβάζει.
    setFile(f); setFileUrl(URL.createObjectURL(f)); setEdited(null); setError(''); setAsk(null); setDuplicate(''); setAnswers({});
    setTypeTouched(false); setArchiveCat(null); setStep('review');
    // Η ΑΝΑΓΝΩΣΗ γίνεται από τη ΜΙΑ μηχανή σάρωσης (scanDoc.ts) — καμία δεύτερη
    // υλοποίηση prompt/parse εδώ. Ό,τι διορθώσουμε εκεί, διορθώνεται παντού.
    setScanning(true);
    const r = await scanDocument(f);
    setScanning(false);
    // Χωρίς στοιχεία εγγράφου ο τύπος μένει κενός και τον διαλέγει ο χρήστης.
    // Σε Ε9 ή ΕΝΦΙΑ με πολλά ακίνητα, προεπιλογή η γραμμή με τον ΑΤΑΚ αυτού.
    // Οτι δεν είναι έγγραφο δεν κρατά ΚΑΝΕΝΑ κλειδί: η σημείωση «η εικόνα δεν
    // περιέχει…» θα γραφόταν στον Φάκελο μόλις ο χρήστης διάλεγε τύπο.
    if (r.doc) setEdited(isDocumentary(r.doc) ? withPropertyLine(r.doc, propertyAtak) : { doc_type: 'other', is_document: false });
    else { setError(r.error || 'unreadable'); setErrorText(r.errorText || ''); setEdited({ doc_type: 'other', is_document: false }); }
  }, [propertyAtak]);

  // Στρίψιμο null/undefined από payload (χρησιμοποιείται στις Επαφές παρακάτω).
  const nrm = (s?: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

  const kind = edited ? kindOf(edited) : null;
  const form = edited ? docForm(edited) : null;
  const fields = (form?.groups || []).flatMap(g => g.rows.flat());
  const shown = new Set<string>(fields.map(f => String(f.key)));
  const today = athensToday();
  // Με το σημερινό, όπως θα τρέξει η καταχώρηση: η λίστα είναι το ίδιο σχέδιο.
  const targets = edited ? docTargets(edited, !!file, today) : [];
  const v = edited ? validateDoc(edited) : { blocking: [], recommended: [], invalid: [] };
  // Μόνο ό,τι φαίνεται στη φόρμα: ένα άκυρο κλειδί χωρίς πεδίο δεν διορθώνεται.
  const invalid = v.invalid.filter(k => shown.has(k));
  const folder = archiveCat ?? (edited ? archiveCategoryFor(edited) : '');
  // Η ετικέτα όπως τη βλέπει ο χρήστης στη φόρμα, αλλιώς η γενική.
  const label = (k: string) => fields.find(f => f.key === k)?.label || DOC_FIELD_LABELS[k] || k;
  // Η γραμμή του Ε9 ή του ΕΝΦΙΑ που δεν διαλέχτηκε λέει «λείπει» χωρίς να
  // κρατά την καταχώρηση: το «Κανένα από αυτά» είναι κι αυτό απάντηση.
  const flagOf = (k: string): Flag | undefined =>
    invalid.includes(k) || (k === 'period_to' && invalid.includes('period_from')) ? 'invalid'
    : v.blocking.includes(k) || (k === 'line' && !!edited && lineUnset(edited)) ? 'missing' : undefined;
  const pending = !!ask || !!duplicate;
  const canSave = v.blocking.length === 0 && !pending;
  const reason = pending ? 'Απάντησε στην ερώτηση παραπάνω'
    : v.blocking.length ? `${v.blocking.length > 1 ? 'Λείπουν' : 'Λείπει'}: ${v.blocking.map(label).join(', ')}`
    : '';

  // Η ΚΑΤΑΧΩΡΗΣΗ. Όλη η εγγραφή (8 πίνακες + αρχειοθέτηση + συμφωνία) ζει στο
  // scanDoc.ts ώστε να είναι ΙΔΙΑ από κάθε οθόνη. Εδώ μένει μόνο η οθόνη.
  // `next`: οι απαντήσεις ως τώρα (κενό στο πρώτο «Καταχώρηση»), που η
  // μηχανή διαβάζει αντί να ξαναρωτήσει.
  const save = async (next: CommitAnswers = {}) => {
    if (!edited) return;
    setSaving(true); setError('');
    const r = await commitScannedDoc({
      doc: edited, file, propertyId: targetId, userId,
      // Το ράφι που ΒΛΕΠΕΙ ο χρήστης στο «Φάκελος», όχι ένα δεύτερο συμπέρασμα.
      ...(folder ? { archiveCategory: folder } : {}),
      ...next,
    });
    setSaving(false);
    setAnswers(next);
    // Ερώτηση (συμφωνία, ενοικιαστής) ή πιθανή διπλοεγγραφή: ΤΙΠΟΤΑ δεν
    // γράφτηκε. Μία κάρτα κάθε φορά, η απόφαση είναι του χρήστη.
    const q = openQuestion(r);
    setAsk(q.ask); setDuplicate(q.duplicate);
    if (q.ask || q.duplicate) return;
    if (r.error || !r.saved.length) { setError('save'); return; }
    setSavedInfo(r.saved);
    setFailedInfo(r.failed || []);
    setStep('done');
    onSaved?.();
  };

  // ΤΟ ΚΟΥΜΠΙ ΔΕΝ ΣΙΩΠΑ ΟΤΑΝ ΛΕΙΠΕΙ ΚΑΤΙ. Μένει πατήσιμο με σβηστή όψη και λέει
  // τον λόγο (`describedBy`)· το πάτημα πηγαίνει στο πρώτο πεδίο που λείπει.
  const submit = () => {
    if (saving) return;
    if (canSave) { void save(); return; }
    const k = pending ? null : v.blocking[0];
    const root = formRef.current;
    if (!k || !root) { cardRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; }
    const el = root.querySelector<HTMLElement>(`[data-scan-field="${k}"] input, [data-scan-field="${k}"] [role="combobox"]`);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el?.focus({ preventScroll: true });
  };

  // Κράτα μόνο ψηφία (για ΑΦΜ/τηλέφωνο) ώστε η σύγκριση/αποθήκευση να είναι καθαρή.
  const digits = (s?: string) => (s || '').replace(/\D/g, '');

  // Αποθήκευση του εκδότη στις Επαφές — dedup ΠΡΩΤΑ, μετά insert. Καμία αυτόματη
  // εγγραφή: καλείται μόνο από το κουμπί «Αποθήκευση στις Επαφές».
  const saveContact = async () => {
    if (!edited || !userId) return;
    const fullName = (edited.provider || '').trim();
    if (!fullName) return;
    setContactState('saving');
    try {
      // Ο εκδότης ενός λογαριασμού έχει το ΑΦΜ του στο provider_afm (το `afm` είναι
      // του αντισυμβαλλόμενου, π.χ. ενοικιαστή) — αλλιώς η επαφή έμπαινε χωρίς ΑΦΜ.
      const afm = digits(edited.provider_afm || edited.afm);
      // DEDUP: φέρνουμε τις επαφές του ακινήτου/χρήστη και ελέγχουμε στη JS (το
      // ΑΦΜ βρίσκεται μέσα στο JSON του notes, δεν κάνει εύκολα query).
      const existing = await contacts.ofProperty<{ full_name: string; notes: string | null }>(
        supabase, targetId, 'id,full_name,phone,notes', userId);
      const dup = existing.some(c => {
        const storedAfm = digits(String(contacts.decodeNotes(c.notes).extra.afm ?? ''));
        if (afm && storedAfm && afm === storedAfm) return true;
        if (nrm(fullName) && nrm(c.full_name) === nrm(fullName)) return true;
        return false;
      });
      if (dup) { setContactState('exists'); return; }
      // Σχηματισμός γραμμής επαφής (ίδιο schema με την καρτέλα Επαφές).
      const extra: Record<string, string> = {};
      if (afm) extra.afm = afm;
      const role = inferRole(`${fullName} ${billCategoryLabel(edited.category)}`) || 'other';
      // Τηλέφωνο και email από το ΙΔΙΟ χαρτί. Πριν έμπαιναν null και έβγαινε
      // επαφή που δεν μπορείς να καλέσεις — ο χρήστης έπρεπε να τα ξαναγράψει
      // με το χέρι, ενώ ήταν τυπωμένα μπροστά του.
      const phone = (edited.provider_phone || '').trim() || null;
      const email = (edited.provider_email || '').trim() || null;
      // Ο εκδότης μπαίνει στις Επαφές με όνομα, ΑΦΜ και τηλέφωνο: πρώτα η
      // σύμβαση επεξεργασίας, όπως σε κάθε στοιχείο τρίτου (lib/legal/dpa.ts).
      if (!(await ensureDpa(supabase))) { setContactState('dpa'); return; }
      const { error: insErr } = await contacts.add(supabase, targetId, userId, {
        role, full_name: fullName, phone, email,
        notes: contacts.encodeNotes(extra, ''),
      });
      if (insErr) { setContactState('error'); return; }
      setContactState('saved');
    } catch { setContactState('error'); }
  };

  const reset = () => {
    setStep('upload'); setFile(null); setFileUrl(''); setEdited(null);
    setSaving(false); setError(''); setSavedInfo([]); setFailedInfo([]); setArchiveCat(null);
    setContactState('cta'); setAsk(null); setDuplicate(''); setAnswers({}); setTypeTouched(false);
  };

  // ── Οθόνη επιτυχίας ─────────────────────────────────────────────────────────
  if (step === 'done' && edited) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 20px', fontFamily: T.font.sans }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--positive-soft)', border: '1px solid var(--positive-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <svg aria-hidden="true" width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="var(--positive)" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, letterSpacing: '-0.01em' }}>Καταχωρήθηκε</div>
        {/* Και ΠΟΥ: με περισσότερα ακίνητα, το όνομα του ακινήτου που διάλεξε. */}
        <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', marginBottom: T.sp.xl }}>
          {docSummaryLine(edited)}{targetName && (properties?.length ?? 0) > 1 ? ` · ${targetName}` : ''}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
          {savedInfo.map(s => (
            <span key={s} style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--positive)', background: 'var(--positive-soft)', border: '1px solid var(--positive-border)', borderRadius: T.radius.pill, padding: '4px 12px', fontFamily: T.font.sans }}>{s}</span>
          ))}
        </div>
        {/* ΧΩΡΙΣ «ΟΛΑ ΚΑΛΑ» ΠΑΝΩ ΑΠΟ ΜΙΣΟ ΑΠΟΤΕΛΕΣΜΑ. Αρκούσε να πετύχει ένα
            βήμα για να γραφτεί αυτή η πρόταση, ενώ ο Φάκελος ή οι δόσεις
            μπορεί να είχαν αποτύχει χωρίς λέξη. */}
        {failedInfo.length > 0 ? (
          <div style={{ maxWidth: 420, margin: `0 auto ${T.sp.xxl}px`, textAlign: 'left' }}>
            <InfoBanner tone="warning">{failedNotice(failedInfo)}</InfoBanner>
          </div>
        ) : (
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: T.sp.xxl }}>Ενημερώθηκαν αυτόματα οι σχετικές καρτέλες.</div>
        )}

        {/* Πρόταση αποθήκευσης εκδότη στις Επαφές (μόνο για λογαριασμό/απόδειξη με όνομα
            προμηθευτή και εφόσον ξέρουμε ποιος χρήστης — αλλιώς σιωπηλά παραλείπεται). */}
        {(() => {
          const supplierName = (edited.provider || '').trim();
          const isInvoiceLike = edited.doc_type === 'bill' || edited.doc_type === 'payment';
          if (!userId || !isInvoiceLike || !supplierName) return null;
          const afm = digits(edited.provider_afm || edited.afm);

          if (contactState === 'saved' || contactState === 'exists') {
            const okSaved = contactState === 'saved';
            return (
              <div style={{ maxWidth: 420, margin: '0 auto 22px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.inner, padding: '11px 16px' }}>
                {okSaved && <svg aria-hidden="true" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--positive)" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}
                <span style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: okSaved ? 'var(--positive)' : 'var(--text-secondary)' }}>
                  {okSaved ? 'Αποθηκεύτηκε στις Επαφές' : 'Υπάρχει ήδη στις Επαφές'}
                </span>
              </div>
            );
          }
          if (contactState === 'dismissed') return null;

          const saving = contactState === 'saving';
          return (
            <div style={{ maxWidth: 420, margin: '0 auto 22px', textAlign: 'left', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.card, padding: '16px 18px' }}>
              <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, letterSpacing: '-0.01em' }}>
                Να αποθηκεύσω τον προμηθευτή «{supplierName}» στις Επαφές;
              </div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', lineHeight: 1.45, marginBottom: 12 }}>
                Θα τον βρίσκεις εύκολα την επόμενη φορά.
              </div>
              <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.inner, padding: '10px 12px', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Όνομα</span>
                  <span style={{ fontSize: 'var(--fs-base)', color: 'var(--text-primary)', fontWeight: 600, textAlign: 'right', wordBreak: 'break-word' }}>{supplierName}</span>
                </div>
                {afm && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>ΑΦΜ</span>
                    <span style={{ fontSize: 'var(--fs-base)', color: 'var(--text-primary)', fontFamily: T.font.mono }}>{afm}</span>
                  </div>
                )}
              </div>
              {contactState === 'error' && (
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--warning)', marginBottom: 10 }}>Δεν αποθηκεύτηκε. Δοκίμασε ξανά.</div>
              )}
              {contactState === 'dpa' && (
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--warning)', marginBottom: 10 }}>Δεν αποθηκεύτηκε: χρειάζεται αποδοχή της σύμβασης επεξεργασίας.</div>
              )}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-start' }}>
                <Btn variant="primary" onClick={saveContact} disabled={saving}>
                  {saving ? 'Αποθήκευση…' : 'Αποθήκευση στις Επαφές'}
                </Btn>
                <Btn variant="secondary" onClick={() => setContactState('dismissed')} disabled={saving}>
                  Όχι τώρα
                </Btn>
              </div>
            </div>
          );
        })()}

        {/* ΤΟ Ε2 ΣΥΝΕΧΙΖΕΙ ΣΤΗ ΛΟΓΙΣΤΙΚΗ. Η σύγκριση με τα μισθώματα ζει εκεί·
            η οθόνη έλεγε «ανέβασέ το και εκεί» χωρίς δρόμο. Τώρα ο δρόμος είναι
            η κύρια ενέργεια και η νέα σάρωση η δεύτερη. */}
        {kindOf(edited)?.value === 'e2' && onOpenAccounting ? (
          <div className="act-center" style={{ display: 'flex', gap: T.sp.sm, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Btn variant="secondary" onClick={reset}>Σάρωσε νέο έγγραφο</Btn>
            <Btn variant="primary" onClick={onOpenAccounting}>Άνοιγμα στη {navLabel('accounting')}</Btn>
          </div>
        ) : (
          <Btn variant="primary" onClick={reset}>Σάρωσε νέο έγγραφο</Btn>
        )}
      </div>
    );
  }

  // ── Βήμα 1: πώς μπαίνει το έγγραφο ─────────────────────────────────────────
  if (step === 'upload') {
    return (
      <div style={{ fontFamily: T.font.sans, color: 'var(--text-primary)' }}>
        {/* ΤΟΝ ΤΙΤΛΟ ΤΟΝ ΔΙΝΕΙ ΤΟ ΠΑΡΑΘΥΡΟ. Εδώ γραφόταν δεύτερος, «Πρόσθεσε ένα
            έγγραφο», κάτω από το «Σάρωση εγγράφου» του κελύφους — και έμενε
            ορατός ΚΑΙ πάνω από την οθόνη επιτυχίας «Καταχωρήθηκε», όπου δεν
            σαρώνει πια τίποτα. Η εξήγηση για το τι δέχεται μένει: είναι
            πληροφορία, όχι επικεφαλίδα και είναι χρήσιμη ακριβώς πριν το
            πρώτο άγγιγμα. */}
        <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 20 }}>
          {/* ΥΠΟΣΧΟΤΑΝ «ΟΤΙΔΗΠΟΤΕ» ΚΑΙ ΚΑΤΑΧΩΡΙΣΗ ΧΩΡΙΣ ΤΟΝ ΧΡΗΣΤΗ. Η ροή όμως
              περνά πάντα από το βήμα ελέγχου, όπου ο χρήστης επιβεβαιώνει ή
              διορθώνει: η πρόταση λέει αυτό που γίνεται. */}
          Φωτογράφισε ή ανέβασε λογαριασμό, απόδειξη, μισθωτήριο, τίτλο, ασφάλεια ή <span title="Ενιαίος Φόρος Ιδιοκτησίας Ακινήτων">ΕΝΦΙΑ</span>. Προτείνουμε πού μπαίνει και το επιβεβαιώνεις εσύ.
        </div>

        {/* ΜΙΑ ΣΕΙΡΑ, ΟΣΑ ΚΙ ΑΝ ΕΙΝΑΙ. Το `auto-fit` με ελάχιστο 190 έβγαζε
            τρία πλακίδια πάνω και ένα μόνο του από κάτω: η τέταρτη επιλογή
            διαβαζόταν ως υποσημείωση των τριών, ενώ είναι ισότιμη απάντηση
            στην ίδια ερώτηση. Το πλήθος το ξέρει το ίδιο το component, οπότε
            το λέει ρητά στο πλέγμα αντί να το αφήνει στο πλάτος. */}
        <div className="scan-tiles" data-tiles={2 + (onManual ? 1 : 0) + (bankOpen ? 1 : 0)}>
          {/* ΓΡΑΜΜΕΝΟ ΡΗΤΑ, ΟΧΙ ΜΕ ΤΟΝ ΒΟΗΘΟ `pressable` ΚΑΙ ΕΧΕΙ ΛΟΓΟ.
              Το JSX spread κρύβει τις ιδιότητες από τη στατική ανάλυση: με
              `{...pressable(…)}` ο μεταγλωττιστής του React παύει να βλέπει τι
              δέχεται το στοιχείο και αρχίζει να αναφέρει τις μεταλλάξεις
              `currentTarget.style` των διπλανών χειριστών. Δοκιμάστηκε και
              μετρήθηκε: με spread +2 σφάλματα, χωρίς 0. Δύο ιδιότητες
              παραπάνω είναι φθηνότερες από έναν φύλακα που χαλαρώνει. */}
          <div role="button" tabIndex={0} onClick={openCamera} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openCamera()}}}
            className="pick-tile" style={{ border: '1px solid var(--border-default)', borderRadius: T.radius.card, minHeight: 172, cursor: 'pointer', background: 'var(--bg-elevated)', transition: 'background-color 0.2s, border-color 0.2s, color 0.2s, box-shadow 0.2s, transform 0.2s, opacity 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-dim)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.background = 'var(--bg-elevated)'; }}>
            <svg aria-hidden="true" width={30} height={30} viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12 }}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
            {/* Τρία πλακίδια, τρεις προστακτικές: «Φωτογράφισε», «Ανέβασε
                αρχείο», «Γράψε το χειροκίνητα». Ηταν ουσιαστικό, προστακτική
                και επίρρημα για τρεις απαντήσεις στην ίδια ερώτηση. */}
            <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, marginBottom: 4 }}>Φωτογράφισε</div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>Με την κάμερα της συσκευής</div>
          </div>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && loadFile(e.target.files[0])} />

          <div role="button" tabIndex={0} onClick={openFilePicker} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openFilePicker()}}}
            className="pick-tile" style={{ border: '1px solid var(--border-default)', borderRadius: T.radius.card, minHeight: 172, cursor: 'pointer', background: 'var(--bg-elevated)', transition: 'background-color 0.2s, border-color 0.2s, color 0.2s, box-shadow 0.2s, transform 0.2s, opacity 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-dim)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.background = 'var(--bg-elevated)'; }}>
            <svg aria-hidden="true" width={30} height={30} viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
            <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, marginBottom: 4 }}>Ανέβασε αρχείο</div>
            {/* ΜΟΝΟ Ο,ΤΙ ΔΙΑΒΑΖΕΤΑΙ. Υποσχόταν «Excel» και δεχόταν .csv/.xlsx/.ods
                που η ανάγνωση δεν διαβάζει: ο χρήστης έπαιρνε «η υπηρεσία δεν
                απαντά». Το `accept` έρχεται από την ίδια λίστα με τον έλεγχο. */}
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>JPG · PNG · PDF</div>
          </div>
          <input ref={fileRef} type="file" accept={SCAN_ACCEPT} style={{ display: 'none' }} onChange={e => e.target.files?.[0] && loadFile(e.target.files[0])} />

          {/* ΤΡΙΤΗ ΑΠΑΝΤΗΣΗ: ΔΕΝ ΕΧΩ ΧΑΡΤΙ. Οι δύο πρώτες υποθέτουν ότι
              υπάρχει παραστατικό. Χωρίς αυτό το πλακίδιο, ο χρήστης που
              θυμήθηκε μια δαπάνη έπρεπε να κλείσει το παράθυρο και να ψάξει
              κουμπί που δεν υπάρχει πια στην κενή λίστα. Ιδιο σχήμα και ίδιο
              ύψος με τα άλλα: τέσσερα πλακίδια, μία απόφαση. */}
          {onManual && (
            <div role="button" tabIndex={0} onClick={onManual} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onManual()}}}
              className="pick-tile" style={{ border: '1px solid var(--border-default)', borderRadius: T.radius.card, minHeight: 172, cursor: 'pointer', background: 'var(--bg-elevated)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 16, transition: 'border-color .15s, background .15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-dim)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.background = 'var(--bg-elevated)'; }}>
              {/* Ιδια κάθετη διάταξη με τα διπλανά: 12 κάτω από το εικονίδιο, 4 κάτω από τον τίτλο. Το `gap: 10` πρόσθετε κενό πάνω στο 4 και το πλακίδιο κατέβαινε. */}
              <svg aria-hidden="true" width={30} height={30} viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12 }}><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, marginBottom: 4 }}>Γράψε το χειροκίνητα</div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>Χωρίς παραστατικό</div>
            </div>
          )}

          {/* ΜΟΝΟ ΟΤΑΝ ΔΟΥΛΕΥΕΙ. Ενα «Σύντομα διαθέσιμο» μέσα στον διάλογο
              της σάρωσης ήταν υπόσχεση λειτουργίας εκεί όπου ο χρήστης
              διαλέγει τι θα κάνει ΤΩΡΑ. Οσο ετοιμάζεται, η τράπεζα λέγεται
              μόνο στη γραμμή των Δαπανών, με την εξήγησή της. Οταν ανοίξει,
              έρχεται τελευταία: οι άλλες τρεις είναι οι συνηθισμένες. */}
          {bankOpen && <BankLinkTile minHeight={172} />}
        </div>
        {/* Ενα αρχείο που δεν περνά (τύπος, μέγεθος) λέγεται εδώ, πριν φύγει τίποτα. */}
        {error && <div style={{ marginTop: T.sp.md }}><InfoBanner tone="warning">{error}</InfoBanner></div>}
        {/* ΤΟ AI ΛΕΓΟΤΑΝ ΜΟΝΟ ΑΦΟΥ ΕΙΧΕ ΦΥΓΕΙ ΤΟ ΕΓΓΡΑΦΟ. Το «Claude AI
            αναγνωρίζει» εμφανιζόταν στη μέση της σάρωσης· πριν από το
            ανέβασμα ο χρήστης δεν μάθαινε ότι ένα μισθωτήριο με ονόματα και
            ΑΦΜ διαβάζεται από πάροχο AI. Η δέσμευση για την εκπαίδευση είναι
            η ίδια που γράφει η Πολιτική απορρήτου. */}
        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', lineHeight: 1.55, margin: '12px 0 0' }}>
          Η ανάγνωση γίνεται με AI, σύμφωνα με την <a href="/privacy" target="_blank" rel="noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'none', borderBottom: '1px solid var(--border-default)' }}>πολιτική απορρήτου</a>· ο πάροχος AI δεσμεύεται με σύμβαση να μην εκπαιδεύει μοντέλα με τα έγγραφά σου.
        </p>
      </div>
    );
  }

  // ── Βήμα 2: έλεγχος ─────────────────────────────────────────────────────────
  const isPdf = file?.type === 'application/pdf';
  const isImage = !!file?.type.startsWith('image/');
  const fileName = file?.name || 'Έγγραφο';
  const fileMeta = file ? `${sizeLabel(file.size)}${isPdf ? ' · PDF' : ''}` : '';

  // ΕΝΑ ΜΗΝΥΜΑ, ΤΟ ΣΗΜΑΝΤΙΚΟΤΕΡΟ. Ηταν ως τρία πλαίσια στη σειρά, χειρόγραφα,
  // με το «Χρειάζονται τα βασικά» να επαναλαμβάνει ό,τι λένε ήδη οι ετικέτες
  // και η μπάρα. Τώρα: άκυρη τιμή, μετά σφάλμα ανάγνωσης, μετά «δεν είναι
  // έγγραφο», μετά «δεν είναι σίγουρη για τον τύπο», μετά η οδηγία του είδους.
  const banner: { tone: 'negative' | 'warning' | 'info'; body: ReactNode } | null = (() => {
    if (invalid.length) {
      const said = [...new Set(invalid.map(k => INVALID_SAY[k]).filter(Boolean))];
      const many = said.length > 1;
      return { tone: 'negative', body: `${said.join(' ')} ${many ? 'Διόρθωσέ τα ή άφησέ τα κενά· δεν θα αποθηκευτούν.' : 'Διόρθωσέ το ή άφησέ το κενό· δεν θα αποθηκευτεί.'}` };
    }
    if (error) {
      const title = error === 'unreadable' ? 'Δεν διάβασα καθαρά το έγγραφο'
        : error === 'quota' ? 'Οι σαρώσεις του μήνα τελείωσαν'
        : error === 'key_missing' ? 'Η αυτόματη ανάγνωση δεν είναι ενεργή ακόμη'
        : error === 'save' ? 'Κάτι πήγε στραβά στην αποθήκευση'
        : error === 'format' ? 'Αυτός ο τύπος αρχείου δεν διαβάζεται'
        : 'Η υπηρεσία ανάγνωσης δεν είναι διαθέσιμη τώρα';
      const tips = error === 'unreadable'
        ? ['Τράβα τη φωτογραφία με καλό φως, ίσια, να χωράει όλο το έγγραφο', 'Αν έχεις PDF από τον πάροχο/φορέα, ανέβασέ το, διαβάζεται καλύτερα']
        // Ρύθμιση «κλειδί AI» δεν υπάρχει στον λογαριασμό: την ανάγνωση την ενεργοποιούμε εμείς.
        : error === 'key_missing' ? ['Συμπλήρωσε τα πεδία χειροκίνητα και αποθήκευσε κανονικά', 'Η αυτόματη ανάγνωση ενεργοποιείται από εμάς· δεν χρειάζεται καμία ρύθμιση από εσένα']
        : error === 'save' ? ['Δοκίμασε ξανά, τα στοιχεία σου διατηρούνται']
        : error === 'quota' ? [errorText || SAY.scanQuotaSpent, 'Συμπλήρωσε τα πεδία χειροκίνητα και αποθήκευσε κανονικά']
        : error === 'format' ? [errorText || 'Διαβάζονται φωτογραφίες και αρχεία PDF', 'Συμπλήρωσε τα πεδία χειροκίνητα και αποθήκευσε κανονικά']
        : ['Δοκίμασε ξανά σε λίγο', 'Συμπλήρωσε τα πεδία χειροκίνητα'];
      return { tone: 'warning', body: <><strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{title}.</strong> {tips.map(sentence).join(' ')}</> };
    }
    if (!kind) return { tone: 'info', body: 'Δεν βρέθηκαν στοιχεία εγγράφου σε αυτή την εικόνα. Διάλεξε τύπο για να το καταχωρήσεις ή ανέβασε άλλο αρχείο.' };
    if (!typeTouched && edited?.confidence != null && edited.confidence < TYPE_UNSURE_BELOW) {
      return { tone: 'warning', body: 'Η σάρωση δεν είναι σίγουρη για τον τύπο. Έλεγξέ τον.' };
    }
    if (form?.info) return { tone: 'info', body: form.info };
    return null;
  })();

  // Η σύνοψη της μπάρας: «Λογαριασμός · 84,50€ · Κυψέλη». Το ποσό ΜΟΝΟ όταν
  // υπάρχει: η παλιά κάρτα έγραφε «Μισθωτήριο 0,00€» που δεν είπε κανείς.
  const amountKey = kind?.amountKey;
  const amountVal = amountKey && edited ? edited[amountKey] : undefined;
  const amountText = typeof amountVal === 'number' && amountVal > 0
    ? `${fe(amountVal)}${amountKey === 'monthly_rent' ? '/μήνα' : ''}` : '';
  const shortName = kind ? `${kind.short}${kind.doc_type === 'tax' && edited?.tax_year ? ` ${edited.tax_year}` : ''}` : 'Διάλεξε τύπο';

  const fileThumb = (
    <a href={fileUrl || undefined} target="_blank" rel="noopener noreferrer" aria-label="Άνοιγμα εγγράφου"
      // Μικρογραφία, όχι χειριστήριο: τετράγωνο 48 από την αναλογία, όχι από ύψος της κλίμακας πεδίων.
      style={{ width: 48, aspectRatio: '1', flexShrink: 0, borderRadius: T.radius.inner, overflow: 'hidden', border: '1px solid var(--border-subtle)', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {isImage && fileUrl
        ? <RuntimeImg src={fileUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        : <DocIcon size={22} />}
    </a>
  );

  return (
    <div style={{ fontFamily: T.font.sans, color: 'var(--text-primary)' }}>
      <div className="scan-review" data-preview={isImage && fileUrl ? '' : undefined}>
        {/* ── Αριστερά (≥821, μόνο εικόνα): το έγγραφο, όσο ψηλό χωράει ── */}
        {isImage && fileUrl && (
          <aside className="scan-preview" aria-label="Το έγγραφο">
            <a href={fileUrl} target="_blank" rel="noopener noreferrer" aria-label="Άνοιγμα εγγράφου"
              style={{ display: 'block', borderRadius: T.radius.card, overflow: 'hidden', border: '1px solid var(--border-subtle)', background: 'var(--bg-base)' }}>
              {/* Το ύψος του παραθύρου (92dvh) μείον κεφαλίδα, μπάρα και γέμισμα. */}
              <RuntimeImg src={fileUrl} alt="" style={{ display: 'block', width: '100%', maxHeight: 'calc(92dvh - 190px)', objectFit: 'contain', objectPosition: 'top' }} />
            </a>
            <div style={{ display: 'flex', alignItems: 'center', gap: T.sp.sm, minWidth: 0 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="po-elide" style={{ ...TT.bodySm, ...ELIDE }}>{fileName}</div>
                <div style={{ ...TT.caption }}>{fileMeta}</div>
              </div>
              <div style={{ marginRight: -GHOST_INSET }}>
                <Btn variant="ghost" onClick={reset} disabled={busy}>Άλλο αρχείο</Btn>
              </div>
            </div>
          </aside>
        )}

        {/* ── Η φόρμα ── */}
        <div ref={formRef} style={{ display: 'flex', flexDirection: 'column', gap: T.sp.lg, minWidth: 0 }}>
          {/* Κινητό και PDF: μία γραμμή αρχείου αντί για εικόνα 425 εικονοστοιχείων. */}
          <div className="scan-filebar">
            {fileThumb}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="po-elide" style={{ ...TT.bodySm, ...ELIDE, color: 'var(--text-primary)' }}>{fileName}</div>
              <div style={{ ...TT.caption }}>{fileMeta}</div>
            </div>
            <Btn variant="secondary" onClick={reset} disabled={busy}>Άλλο αρχείο</Btn>
          </div>

          {/* ΖΩΝΤΑΝΟ ΚΑΙ ΜΕ ΤΟ ΣΧΗΜΑ ΤΟΥ ΑΠΟΤΕΛΕΣΜΑΤΟΣ. Μια ακίνητη κουκκίδα με το
              «Διαβάζω…» έμοιαζε παγωμένη και το παράθυρο πηδούσε από 515 σε 828
              όταν ερχόταν η φόρμα. Ο παλμός (`live-dot`) και ο σκελετός σβήνουν
              μόνοι τους με τη μειωμένη κίνηση, του συστήματος ή της εφαρμογής. */}
          {scanning && (
            <>
              <div role="status" style={{ ...TT.bodySm, display: 'flex', alignItems: 'center', gap: T.sp.md, background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', borderRadius: T.radius.inner, padding: '12px 16px' }}>
                <span aria-hidden="true" className="live-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                Διαβάζω το έγγραφο…
              </div>
              <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: T.sp.md }}>
                {[96, 64, 120].map(w => (
                  <div key={w}>
                    <Skeleton w={w} h={10} r={T.radius.hair} style={{ marginBottom: 10 }} />
                    <Skeleton h={T.h.lg} r={T.radius.inner} />
                  </div>
                ))}
              </div>
            </>
          )}

          {edited && !scanning && (
            <>
              {/* ── Α. Τι είναι και πού μπαίνει ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: T.sp.md }}>
                {(properties?.length ?? 0) > 1 && (
                  <CustomSelect label="Ακίνητο" value={targetId}
                    onChange={id => {
                      setTargetId(id);
                      // ΟΙ ΕΡΩΤΗΣΕΙΣ ΑΦΟΡΟΥΣΑΝ ΤΟ ΑΛΛΟ ΑΚΙΝΗΤΟ. Η ερώτηση συμφωνίας
                      // έδειχνε λογαριασμούς του Α και η απάντηση θα εξοφλούσε
                      // λογαριασμό του Α με δαπάνη στο Β· το «ούτως ή άλλως» θα
                      // παρέκαμπτε τον έλεγχο διπλοεγγραφής του Β, που δεν έγινε
                      // ποτέ. Ο νέος έλεγχος γίνεται στο επόμενο «Καταχώρηση».
                      setAsk(null); setDuplicate(''); setAnswers({});
                      // Αλλο ακίνητο, άλλη γραμμή στο Ε9 ή στον ΕΝΦΙΑ με πολλά ακίνητα.
                      setEdited(p => (p && (p.lines?.length ?? 0) > 1 ? withPropertyLine({ ...p, line: undefined }, atakOf(id)) : p));
                    }}
                    options={(properties || []).map(p => ({ value: p.id, label: p.name, ...(p.address ? { description: p.address } : {}) }))} />
                )}
                {/* ΤΥΠΟΣ ΚΑΙ ΦΑΚΕΛΟΣ, ΔΥΟ ΕΠΙΛΟΓΕΙΣ ΠΟΥ ΦΑΙΝΟΝΤΑΙ ΠΑΝΤΑ. Ο ιδιοκτήτης
                    ζήτησε τον φάκελο ως επιλογέα (13/10/2026). Μια γραμμή «Φάκελος:
                    … · Αλλαγή» τον έκρυβε πίσω από ένα πάτημα. Το ράφι ξεκινά από τον
                    τύπο ή από την Κατηγορία του λογαριασμού και αλλάζει με μία
                    επιλογή. Δίπλα στον Τύπο όπου η φόρμα είναι μία φαρδιά στήλη·
                    δίπλα στην εικόνα και κάτω από τα 700 ο καθένας κρατά όλο το
                    πλάτος, γιατί εκεί το ζεύγος έκοβε το «Εκκαθαριστικό φόρου
                    εισοδήματος» (`.scan-head`). */}
                {(() => {
                  const typeField = (
                    <div data-scan-field="kind" style={{ minWidth: 0 }}>
                      <CustomSelect label="Τύπος εγγράφου" value={kind?.value ?? ''} placeholder="Διάλεξε τύπο"
                        labelInfo={v.blocking.includes('kind') ? <>{' '}<FlagWord flag="missing" /></> : undefined}
                        onChange={val => {
                          setTypeTouched(true); setArchiveCat(null);
                          setEdited(p => (p ? withPropertyLine(applyKind(p, val), propertyAtak) : p));
                        }}
                        options={KIND_OPTIONS} />
                    </div>
                  );
                  if (!kind) return typeField;
                  return (
                    <div {...fixedCols(2, 12, 'end', 'scan-head')}>
                      {typeField}
                      <div style={{ minWidth: 0 }}>
                        {/* Ο φάκελος στην ετικέτα, το ράφι στο κουμπί: η διαδρομή
                            ολόκληρη κοβόταν στο τηλέφωνο («Συμβόλαια › Μισθωτήριο ή σ…»). */}
                        <CustomSelect label="Φάκελος" value={folder} onChange={setArchiveCat} options={archiveOptions()}
                          labelInfo={folder ? <span style={{ color: 'var(--text-tertiary)' }}>{' · '}{folderOf(folder)}</span> : undefined} />
                      </div>
                    </div>
                  );
                })()}
                {targets.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: T.sp.xs, marginTop: -T.sp.xs }}>
                    {/* Από το ΙΔΙΟ σχέδιο που θα εκτελεστεί, όχι από στατική λίστα
                        ανά τύπο. Κάθε προορισμός σε ένα κομμάτι που δεν σπάει και
                        η τελεία κολλά στον προηγούμενο: στα 320 έπεφτε στην αρχή
                        της γραμμής και το «(μόνο κενά)» τυλιγόταν μόνο του. */}
                    {targets.length > 0 && (
                      <div aria-live="polite" style={{ ...TT.caption }}>
                        Θα ενημερωθούν:{' '}
                        <span style={{ color: 'var(--text-secondary)' }}>
                          {targets.map((t, i) => (
                            <Fragment key={t}>{i > 0 && '\u00a0· '}<span style={{ whiteSpace: 'nowrap' }}>{t}</span></Fragment>
                          ))}
                        </span>
                      </div>
                    )}
                  </div>
                ) : null}
                {/* Το InfoBanner φέρνει δικό του κάτω περιθώριο· σε στήλη με κενά θα
                    το διπλασίαζε πάνω από τη διαχωριστική γραμμή. */}
                {banner && <div style={{ marginBottom: -10 }}><InfoBanner tone={banner.tone}>{banner.body}</InfoBanner></div>}
              </div>

              {/* ── Β. Τα πεδία του τύπου ── */}
              {form && (
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: T.sp.lg, display: 'flex', flexDirection: 'column', gap: T.sp.lg }}>
                  {/* ΡΥΘΜΟΣ ΟΜΑΔΩΝ: 24 πάνω από τον υπότιτλο, 12 από κάτω. Με 16 και 12
                      το «ΧΡΕΩΣΗ» αιωρούνταν ανάμεσα σε σειρές αντί να ανοίγει ενότητα. */}
                  {form.groups.map((g, gi) => (
                    <div key={gi} style={{ display: 'flex', flexDirection: 'column', gap: T.sp.md, ...(gi > 0 && g.title ? { marginTop: T.sp.xxl - T.sp.lg } : {}) }}>
                      {g.title && <h3 style={{ ...TT.label, margin: 0 }}>{g.title}</h3>}
                      {g.rows.map((row, ri) => {
                        const cells = row.map(f => {
                          const k = String(f.key);
                          // Ο επιλογέας γραμμής Ε9/ΕΝΦΙΑ έχει και «κανένα»: το ακίνητο μπορεί να μην είναι στη λίστα.
                          const options = f.options === 'line' ? [...fieldOptions(f, edited, today), LINE_NONE] : undefined;
                          return (
                            <div key={k} data-scan-field={k} style={{ minWidth: 0 }}>
                              <ScanField f={f} doc={edited} today={today} flag={flagOf(k)} options={options}
                                hint={f.hint} onChange={val => setF(f, val)} />
                            </div>
                          );
                        });
                        // Δύο στήλες στο τηλέφωνο ΜΟΝΟ για σύντομες τιμές (documents.ts,
                        // `compactRow`): ποσό, αριθμός παροχής ή συμβολαίου κόβονταν.
                        const line = row.length > 1
                          ? <div {...fixedCols(row.length, 12, 'end', compactRow(row) ? 'fc-xs-2 fc-xxs-1' : '')}>{cells}</div>
                          : cells[0];
                        // Ό,τι έγραφε το χαρτί για την περίοδο, κάτω από το ζεύγος των ημερομηνιών.
                        const paper = edited.period && row.some(f => f.key === 'period_from');
                        return paper ? (
                          <div key={ri} style={{ display: 'flex', flexDirection: 'column', gap: T.sp.xs }}>
                            {line}
                            <div style={{ ...TT.caption }}>Στο χαρτί: {edited.period}</div>
                          </div>
                        ) : <Fragment key={ri}>{line}</Fragment>;
                      })}
                    </div>
                  ))}
                  {form.note && <div style={{ ...TT.caption, marginTop: -T.sp.sm }}>{form.note}</div>}

                  {/* ── Γ. Σημειώσεις ── */}
                  <Textarea label="Σημειώσεις" autoGrow rows={2} placeholder="Ό,τι άλλο γράφει το έγγραφο"
                    value={edited.notes || ''} onChange={val => setEdited(p => (p ? { ...p, notes: val } : p))} />

                  {/* ── Δ. Δικά σου πεδία: γράφονται στη σημείωση του Φακέλου ως «Όνομα: Τιμή» ── */}
                  {customCount > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: T.sp.md }}>
                      {(edited.custom || []).map((c, i) => (
                        <div key={i} className="scan-custom">
                          <div style={{ gridArea: 'name', minWidth: 0 }}>
                            <TextInput id={`${uid}-cf-${i}`} ariaLabel="Όνομα πεδίου" placeholder="π.χ. Αρ. πρωτοκόλλου" value={c.label}
                              onChange={val => setEdited(p => { if (!p) return p; const cs = [...(p.custom || [])]; cs[i] = { ...cs[i], label: val }; return { ...p, custom: cs }; })} />
                          </div>
                          <div style={{ gridArea: 'value', minWidth: 0 }}>
                            <TextInput ariaLabel="Τιμή" value={c.value}
                              onChange={val => setEdited(p => { if (!p) return p; const cs = [...(p.custom || [])]; cs[i] = { ...cs[i], value: val }; return { ...p, custom: cs }; })} />
                          </div>
                          <IconBtn label="Αφαίρεση πεδίου" title="Αφαίρεση πεδίου" style={{ gridArea: 'rm' }}
                            onClick={() => setEdited(p => (p ? { ...p, custom: (p.custom || []).filter((_, j) => j !== i) } : p))}>
                            <svg aria-hidden="true" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                          </IconBtn>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ marginTop: -T.sp.sm, marginLeft: -GHOST_INSET, alignSelf: 'flex-start' }}>
                    <Btn variant="ghost" onClick={() => {
                      focusCustom.current = customCount;
                      setEdited(p => (p ? { ...p, custom: [...(p.custom || []), { label: '', value: '' }] } : p));
                    }}>
                      <svg aria-hidden="true" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                      Πρόσθεσε πεδίο
                    </Btn>
                  </div>
                </div>
              )}

              {/* ── Ε. Ερωτήσεις πριν από την εγγραφή ── */}
              {/* Ερώτηση συμφωνίας. Εμφανίζεται ΠΡΙΝ γραφτεί οτιδήποτε: η μηχανή βρήκε
                  υποψηφίους αλλά δεν έχει αρκετή απόδειξη. Δίνουμε τους λόγους κάθε
                  υποψηφίου, ώστε η επιλογή του χρήστη να είναι τεκμηριωμένη. */}
              {/* ══════════════════════════════════════════════════════════════
                  ΠΙΘΑΝΗ ΔΙΠΛΟΕΓΓΡΑΦΗ
                  ────────────────────────────────────────────────────────────
                  Χωρίς κόκκινο και χωρίς θαυμαστικό: δεν είναι σφάλμα του
                  χρήστη, είναι πληροφορία που δεν είχε τη στιγμή που σάρωσε.
                  Και χωρίς αυτόματη διαγραφή: δύο λογαριασμοί ρεύματος του
                  ίδιου ποσού την ίδια εβδομάδα ΥΠΑΡΧΟΥΝ (δύο ακίνητα, δύο
                  παροχές, μια δόση και μια εξόφληση).
                  ══════════════════════════════════════════════════════════════ */}
              {pending && (
                <div ref={cardRef} style={{ scrollMarginBottom: 120 }}>
                  {duplicate && (
                    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.card, padding: '14px 16px' }}>
                      <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, marginBottom: 6 }}>Μήπως το έχεις ήδη καταχωρήσει;</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>{duplicate}</div>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {/* size="lg" γιατί και τα δύο ήταν καρφωμένα στο T.h.lg. */}
                        <Btn variant="primary" size="lg" onClick={() => save(withAnswer(answers, 'duplicate'))} disabled={saving}>
                          Καταχώρησέ το ούτως ή άλλως
                        </Btn>
                        <Btn variant="secondary" size="lg" onClick={() => { setDuplicate(''); setStep('upload'); }}>
                          Άκυρο
                        </Btn>
                      </div>
                    </div>
                  )}

                  {ask && (
                    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--accent-border)', borderRadius: T.radius.card, padding: '14px 16px' }}>
                      <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, marginBottom: 4 }}>{ask.question}</div>
                      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 12 }}>
                        {ask.note}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {ask.options.map(o => (
                          <button key={o.id} onClick={() => save(withAnswer(answers, ask, o.id))} disabled={saving}
                            style={{ textAlign: 'left', background: 'var(--bg-base)', border: '1px solid var(--border-default)', borderRadius: T.radius.inner, padding: '10px 14px', cursor: saving ? 'default' : 'pointer', fontFamily: T.font.sans }}>
                            <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-primary)' }}>{o.label}</div>
                            {o.reasons.length > 0 && (
                              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 4, lineHeight: 1.45 }}>{o.reasons.join(' · ')}</div>
                            )}
                          </button>
                        ))}
                        <button onClick={() => save(withAnswer(answers, ask, null))} disabled={saving}
                          style={{ textAlign: 'left', background: 'transparent', border: '1px dashed var(--border-default)', borderRadius: T.radius.inner, padding: '10px 14px', cursor: saving ? 'default' : 'pointer', fontFamily: T.font.sans }}>
                          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-secondary)' }}>{ask.none.label}</div>
                          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 4 }}>{ask.none.hint}</div>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ══ ΣΤ. Η ΜΠΑΡΑ ΕΝΕΡΓΕΙΩΝ, ΠΑΝΤΑ ΟΡΑΤΗ ═══════════════════════════════════
          Ιδια γεωμετρία με το υποσέλιδο του Modal (γέμισμα 14/24, γραμμή από
          πάνω, φόντο επιφάνειας): κολλά στο κάτω άκρο του παραθύρου όσο κυλά η
          φόρμα. Η παλιά κάτω κάρτα ήταν στο τέλος της κύλισης και έγραφε
          «Μισθωτήριο 0,00€» για ποσό που δεν είπε κανείς. */}
      {edited && !scanning && (
        <div className="scan-bar" data-reason={reason ? '' : undefined}>
          <div className="scan-bar-text" style={{ flex: '1 1 240px', minWidth: 0 }}>
            <div className="po-elide scan-bar-sum" style={{ ...TT.bodySm, ...ELIDE }}>
              {shortName}
              {amountText && <> · <span style={{ ...TT.figure, fontWeight: 600 }}>{amountText}</span></>}
              {targetName && ` · ${targetName}`}
            </div>
            {reason && <div id={reasonId} style={{ ...TT.caption, color: 'var(--warning)' }}>{reason}</div>}
          </div>
          <div className="scan-bar-act">
            {/* ΔΕΥΤΕΡΕΥΟΝ ΟΣΟ ΛΕΙΠΕΙ ΚΑΤΙ, ΚΥΡΙΟ ΟΤΑΝ ΕΙΝΑΙ ΕΤΟΙΜΟ. Η σβηστή όψη
                (`dimmed`, διαφάνεια 0,5) έδινε λευκό σε ανοιχτό μπλε, περίπου 2,4:1,
                σε κουμπί που ΔΕΝ είναι ανενεργό: μένει στη σειρά του Tab, λέει
                γιατί (`describedBy`) και το πάτημα πηγαίνει στο πρώτο πεδίο που
                λείπει. Το δευτερεύον έχει πλήρη αντίθεση και λέει «όχι ακόμη». */}
            <Btn variant={canSave ? 'primary' : 'secondary'} onClick={submit} disabled={saving}
              describedBy={reason ? reasonId : undefined}>
              {saving ? 'Καταχώρηση…' : 'Καταχώρηση'}
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}
