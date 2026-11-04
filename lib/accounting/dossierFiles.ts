// Τα χαρτιά του φακέλου του λογιστή: αριθμός, διαδρομή και γραμμή στο βιβλίο.
//
// ΧΩΡΙΣΤΑ ΑΠΟ ΤΟ dossier.ts ΓΙΑ ΤΟ ΒΑΡΟΣ. Το dossier.ts το διαβάζει και το
// lib/tax/greekTaxCalendar.ts, άρα και οι δημόσιοι υπολογιστές (ΕΝΦΙΑ). Οι
// κανόνες ονομάτων του Αρχείου (lib/archive/naming.ts) χρειάζονται μόνο στην
// εξαγωγή, οπότε μένουν εδώ και δεν φτάνουν ποτέ σε δημόσια σελίδα.

import { archiveFileName, archiveFolder, extOf as extOfName, firstDate, kindOfShelf, providerNames, resolveProvider, uniqueNames } from '@/lib/archive/naming';

// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΙΔΙΑ ΤΑ ΧΑΡΤΙΑ, ΜΕΣΑ ΣΤΟΝ ΦΑΚΕΛΟ
// ─────────────────────────────────────────────────────────────────────────
// Ο φάκελος έστελνε ΑΡΙΘΜΟΥΣ και έναν κατάλογο με το τι λείπει. Ό,τι υπήρχε —
// τα σαρωμένα τιμολόγια, οι αποδείξεις, τα συμβόλαια— έμενε στην εφαρμογή και
// ο λογιστής τα ζητούσε με δεύτερο μήνυμα, ένα ένα.
//
// Ο ΑΡΙΘΜΟΣ ΤΟΥ ΠΑΡΑΣΤΑΤΙΚΟΥ ΕΙΝΑΙ ΤΟ ΚΛΕΙΔΙ ΚΑΙ ΛΕΓΕΤΑΙ ΜΙΑ ΦΟΡΑ ΣΕ ΚΑΘΕ
// ΚΑΤΕΥΘΥΝΣΗ. Το φύλλο «Κινήσεις» γράφει δίπλα στη γραμμή «07»· ο φάκελος έχει
// ένα αρχείο που αρχίζει από «07»· και το ευρετήριο λέει σε ποια γραμμή ανήκει
// το 07. Τρεις όψεις, ένας αριθμός, καμία επανάληψη.
//
// ΤΑΥΤΙΣΗ ΜΟΝΟ ΟΤΑΝ ΕΙΝΑΙ ΒΕΒΑΙΗ. Το χαρτί δένει με κίνηση όταν συμφωνούν
// ημερομηνία ΚΑΙ ποσό και ταιριάζει ΑΚΡΙΒΩΣ ΜΙΑ κίνηση — αλλιώς η στήλη μένει
// κενή. Μια λάθος αντιστοίχιση είναι χειρότερη από καμία: ο λογιστής θα την
// πιστέψει και θα καταχωρήσει το τιμολόγιο του υδραυλικού στη δόση του δανείου.
// Όπου δύο κινήσεις έχουν την ίδια ημέρα και το ίδιο ποσό, το ΑΦΜ του εκδότη
// ξεχωρίζει· όπου ούτε αυτό δεν ξεχωρίζει, δεν αποφασίζουμε εμείς.

/** Ένα χαρτί όπως το ξέρει η εφαρμογή, πριν πάρει αριθμό. */
export interface DossierPaper {
  /** Το όνομα με το οποίο ανέβηκε. Δίνει μόνο την κατάληξη. */
  fileName: string;
  title?: string | null;
  category?: string | null;
  /** Ημερομηνία του παραστατικού (YYYY-MM-DD), όχι της μεταφόρτωσης. */
  docDate?: string | null;
  supplier?: string | null;
  afm?: string | null;
  amount?: number | null;
  /** Η περίοδος που αφορά: ο μήνας του τέλους της δίνει το όνομα (lib/archive/naming.ts). */
  periodFrom?: string | null;
  periodTo?: string | null;
  /** Πότε καταχωρήθηκε: λύνει τα διπλότυπα ονόματα (_2, _3) με σταθερή σειρά. */
  createdAt?: string | null;
}

/** Μια κίνηση, όσο χρειάζεται για να αναγνωριστεί το χαρτί της. */
export interface DossierEntry {
  date: string;
  amount?: number | null;
  afm?: string | null;
}

/**
 * Ένα χαρτί με τον αριθμό του, το όνομά του μέσα στον φάκελο και τη γραμμή του.
 *
 * Ο ΤΥΠΟΣ ΤΟΥ ΧΑΡΤΙΟΥ ΤΑΞΙΔΕΥΕΙ ΜΑΖΙ ΤΟΥ. Ο καλών που δίνει χαρτιά ΜΕ bytes
 * παίρνει πίσω χαρτιά με bytes· χωρίς αυτό θα χρειαζόταν μια μετατροπή τύπου
 * στη μία και μοναδική θέση όπου γράφονται τα αρχεία, δηλαδή ακριβώς εκεί που
 * ένα λάθος θα έβγαζε άδειο φάκελο.
 */
export interface FiledPaper<P extends DossierPaper = DossierPaper> {
  /** 1, 2, 3… με τη σειρά που διαβάζονται. */
  no: number;
  /** Ο αριθμός με τα μηδενικά μπροστά, όπως γράφεται παντού: «07». */
  label: string;
  /**
   * Η διαδρομή του αρχείου: Είδος/Πάροχος/Έτος/Είδος_Πάροχος_ΕΕΕΕ_ΜΜ_Ποσό.ext.
   * ΙΔΙΟ ΟΝΟΜΑ ΚΑΙ ΙΔΙΟΙ ΦΑΚΕΛΟΙ ΜΕ ΤΟ ΑΡΧΕΙΟ ΤΗΣ ΕΦΑΡΜΟΓΗΣ (04/11/2026): ο
   * λογιστής βλέπει στον δίσκο του ό,τι βλέπει ο ιδιοκτήτης στην οθόνη. Ο
   * αριθμός (`label`) μένει στο φύλλο, όπου δένει το χαρτί με την κίνησή του.
   */
  file: string;
  /** Η γραμμή στο φύλλο «Κινήσεις», ή null όταν δεν ταυτίζεται μία μόνο. */
  row: number | null;
  paper: P;
}

// Ό,τι δεν δέχονται τα Windows σε όνομα αρχείου. Οι χαρακτήρες ελέγχου φεύγουν
// με σύγκριση και όχι με κανονική έκφραση: ένα `[\u0000-\u001f]` γράφεται μέσα
// στον κώδικα ως αόρατα bytes και κανένας δεν το ξαναδιαβάζει.
const FORBIDDEN = new Set(['\\', '/', ':', '*', '?', '"', '<', '>', '|']);

/** Καθαρό, μονής γραμμής, κομμένο στο μήκος που διαβάζεται. */
const clean = (s: string, max: number): string =>
  [...String(s)].map(ch => (ch < ' ' || FORBIDDEN.has(ch) ? ' ' : ch)).join('')
    .replace(/\s+/g, ' ').trim().slice(0, max).trim();


/** Με τι λέγεται το χαρτί: ο εκδότης του, αλλιώς ο τίτλος, αλλιώς το όνομά του. */
const nameOf = (p: DossierPaper): string => {
  const base = String(p.fileName || '').replace(/\.[A-Za-z0-9]{1,8}$/, '');
  return clean(String(p.supplier || '').trim() || String(p.title || '').trim() || base, 48) || 'παραστατικό';
};

/**
 * Τα χαρτιά, αριθμημένα και δεμένα με τις κινήσεις τους.
 *
 * Η ΣΕΙΡΑ ΕΙΝΑΙ ΧΡΟΝΟΛΟΓΙΚΗ, ΟΠΩΣ ΚΑΙ ΤΟ ΒΙΒΛΙΟ. Έτσι ο υποφάκελος διαβάζεται
 * από πάνω προς τα κάτω παράλληλα με το φύλλο των κινήσεων. Όσα δεν έχουν
 * ημερομηνία πάνε στο τέλος: δεν υπάρχει σημείο της χρονιάς που να τους ανήκει.
 * Ισοπαλίες λύνονται με το όνομα, ώστε δύο εξαγωγές των ίδιων δεδομένων να
 * δίνουν τον ίδιο φάκελο.
 */
export function filePapers<P extends DossierPaper>(
  papers: readonly P[],
  book: readonly DossierEntry[],
): FiledPaper<P>[] {
  const rows = [...book]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e, i) => ({ ...e, no: i + 1 }));

  const sorted = [...papers].sort((a, b) =>
    (a.docDate || '9999-12-31').localeCompare(b.docDate || '9999-12-31')
    || nameOf(a).localeCompare(nameOf(b), 'el')
    || String(a.fileName).localeCompare(String(b.fileName), 'el'));

  const width = Math.max(2, String(sorted.length).length);

  // Το κοινό όνομα, με τις ίδιες συναρτήσεις με το Αρχείο: είδος από το ράφι,
  // πάροχος από το ΑΦΜ όπου υπάρχει, μήνας της περιόδου, ποσό με κόμμα.
  const names = providerNames(sorted.map(p => ({ provider: p.supplier, afm: p.afm, createdAt: p.createdAt })));
  const placed = sorted.map((p, i) => {
    const kind = kindOfShelf(p.category, p.title, p.supplier);
    const provider = resolveProvider(names, p.supplier, p.afm, kind);
    const date = firstDate(p.periodTo, p.periodFrom, p.docDate);
    const dir = archiveFolder(kind, provider, date).join('/');
    const name = archiveFileName({ kind, provider, date, amount: p.amount, ext: extOfName(null, p.fileName) });
    return { id: String(i), dir, name: `${dir}/${name}`, createdAt: p.createdAt || p.docDate || String(i).padStart(6, '0') };
  });
  const unique = uniqueNames(placed);

  return sorted.map((p, i) => {
    const amount = Number(p.amount);
    const date = String(p.docDate || '');
    // Ημερομηνία και ποσό μαζί. Χωρίς ποσό δεν υπάρχει ταύτιση: μια ημερομηνία
    // με τρεις δαπάνες πάνω της δεν λέει ποια είναι.
    let hits = date && Number.isFinite(amount) && amount !== 0
      ? rows.filter(r => r.date === date && Math.abs((Number(r.amount) || 0) - amount) < 0.005)
      : [];
    // Ίδια μέρα, ίδιο ποσό, δύο κινήσεις: ο εκδότης ξεχωρίζει.
    if (hits.length > 1 && p.afm) {
      const byAfm = hits.filter(r => r.afm === p.afm);
      if (byAfm.length) hits = byAfm;
    }
    const no = i + 1;
    const label = String(no).padStart(width, '0');
    return {
      no,
      label,
      file: unique.get(String(i)) ?? placed[i].name,
      row: hits.length === 1 ? hits[0].no : null,
      paper: p,
    };
  });
}
