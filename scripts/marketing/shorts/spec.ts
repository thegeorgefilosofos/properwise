// ═══════════════════════════════════════════════════════════════════════════
// SHORTS · Η ΠΡΟΔΙΑΓΡΑΦΗ
// ─────────────────────────────────────────────────────────────────────────
// Ό,τι γράφει ο άνθρωπος για ένα short: ταυτότητα, σειρά, αγκίστρι, σκηνές με
// τη διάρκειά τους σε χτύπους και το πέρασμα που τις φέρνει, σύνδεσμος,
// καμπάνια και τα κείμενα των πλατφορμών. Τα γεγονότα είναι ΣΥΝΑΡΤΗΣΗ: τα
// διαβάζει από τον κώδικα τη στιγμή της παραγωγής, για τη μέρα του short.
// ═══════════════════════════════════════════════════════════════════════════
import type { Mix } from '../synth';
import type { Facts, Series, SeriesKey, Txt } from './kit';
import type { TransitionName } from './transitions';

/** Ό,τι ξέρει μια σκηνή όταν χτίζεται. Οι χρόνοι είναι απόλυτοι, σε δευτερόλεπτα. */
export interface SceneCtx {
  /** Η σκηνή ξεκινά (το κόψιμο του περάσματος) και τελειώνει. */
  t0: number;
  t1: number;
  /** Ένας χτύπος της μουσικής, σε δευτερόλεπτα. */
  beat: number;
  f: Facts;
  s: Series;
  /** Η θέση της σκηνής (0 = αγκίστρι). */
  k: number;
  /** Πόσες σκηνές έχει το short. */
  n: number;
}

export interface SceneOut {
  html: string;
  css?: string;
  /** Βήμα ανά καρέ για ό,τι δεν λέγεται με `data-a` (σώμα συνάρτησης με `t`). */
  js?: string;
  /** Ήχοι της σκηνής πάνω στο κοινό χαλί. */
  sfx?: (m: Mix) => void;
  /** Στιγμές κρούσης: ο αριθμός προσγειώνεται, η κάμερα τινάζεται, η μουσική χτυπά. */
  hits?: number[];
  /** Πότε έχουν κάτσει όλα (για τον έλεγχο στοίχισης και το στιγμιότυπο). Προεπιλογή: λίγο πριν το τέλος. */
  settle?: number;
  /** Παράθυρα (απόλυτα δευτερόλεπτα) όπου σωπαίνουν τύμπανα και μοτίβο και μένει μόνο το χαλί. */
  hush?: [number, number][];
  /**
   * Μόνο στην τελευταία σκηνή: ξαναστήνει ΑΚΡΙΒΩΣ το καρέ 0 (ίδια διάταξη, ίδιες θέσεις).
   * Τότε η ραφή του βρόχου είναι σκέτη διασταύρωση χωρίς θόλωμα και κλίμακα, η σκηνή
   * δεν έχει ώθηση κάμερας και η πρόοδος σβήνει αντί να γυρίζει πίσω.
   */
  loopExact?: boolean;
}

/** Ο ρόλος της σκηνής στην ιστορία: αγκίστρι, διακύβευμα, ανατροπή, ο αριθμός, τι κάνεις, βρόχος. */
export type Arc = 'hook' | 'stakes' | 'turn' | 'payoff' | 'action' | 'loop';
export const ARC_ORDER: Arc[] = ['hook', 'stakes', 'turn', 'payoff', 'action', 'loop'];
export const ARC_LABEL: Record<Arc, string> = { hook: 'Αγκίστρι', stakes: 'Διακύβευμα', turn: 'Ανατροπή', payoff: 'Ο αριθμός', action: 'Τι κάνεις', loop: 'Βρόχος' };

export interface SceneSpec<P = unknown> {
  kind: string;
  /** Ο ρόλος στην ιστορία. */
  arc?: Arc;
  /** Μία γραμμή για το σενάριο: τι βλέπει ο θεατής. */
  story: Txt;
  /** Ο ήχος της σκηνής, σε λίγες λέξεις, για το σενάριο. */
  cue: Txt;
  /** Διάρκεια σε χτύπους της μουσικής: κάθε κόψιμο πέφτει σε χτύπο. */
  beats: number;
  /** Το πέρασμα που φέρνει αυτή τη σκηνή (η πρώτη δεν έχει). */
  in?: TransitionName;
  /** Ρυθμίσεις του περάσματος: στόχος ζουμ, κλειδί αντιστοίχισης, λέξη, σχήμα. */
  inOpts?: Record<string, string>;
  params: P;
  build: (c: SceneCtx) => SceneOut;
}

/**
 * ΤΑ ΟΚΤΩ ΣΗΜΑΤΑ (ρουμπρίκα από ανοιχτό εργαλείο shorts που βρήκε ο ιδιοκτήτης). Κάθε
 * short δηλώνει ποια χρησιμοποιεί και σε ποια σκηνή. Είναι αυτοαξιολόγηση για την
 * επιμέλεια, όχι μέτρηση: το texts.md το γράφει έτσι.
 */
export type Signal = 'hook' | 'emotion' | 'opinion' | 'revelation' | 'conflict' | 'quotable' | 'story' | 'practical';
export const SIGNAL_LABEL: Record<Signal, string> = {
  hook: 'Στιγμή αγκιστριού', emotion: 'Συναισθηματική κορύφωση', opinion: 'Αντίθετη άποψη', revelation: 'Αποκάλυψη ή έκπληξη',
  conflict: 'Σύγκρουση ή ένταση', quotable: 'Φράση για παράθεση', story: 'Κορύφωση ιστορίας', practical: 'Πρακτική αξία',
};
export interface Rubric {
  /** Ποιο σήμα, σε ποια σκηνή (0 = αγκίστρι) και τι ακριβώς το κάνει. Ο χρόνος βγαίνει από τη σκηνή. */
  signals: { signal: Signal; scene: number; note: Txt }[];
  /** Βαθμός στα 100: εκτίμηση του γράφοντος, όχι πρόβλεψη. */
  score: number;
  /** Μία γραμμή: γιατί θα δουλέψει. */
  why: Txt;
}

export interface Texts {
  youtube: { title: Txt; description: Txt; tags: string[] };
  instagram: { caption: Txt; alt: Txt; hashtags: string[] };
  facebook?: { caption: Txt };
  tiktok: { caption: Txt; hashtags: string[] };
  pinned: Txt;
}

export interface ShortSpec {
  /** «2026-10-08-1230-prothesmia»: ημερομηνία, ώρα, θέμα. */
  id: string;
  /** Η μέρα δημοσίευσης (ISO) και η ώρα της (ΗΗ:ΛΛ, ώρα Ελλάδας). */
  date: string;
  slot: string;
  series: SeriesKey;
  title: Txt;
  /** Η πρώτη φράση: διαβάζεται στο πρώτο καρέ, χωρίς ήχο. */
  hook: Txt;
  cta: { path: string; label: Txt };
  utm: { campaign: string; /** utm_medium: «short» (προεπιλογή) ή «reel». */ medium?: string };
  /** Τα γεγονότα, από τον κώδικα, για τη μέρα του short. */
  facts: (date: string) => Facts;
  /**
   * Δύο (ή περισσότερα) αγκίστρια. Βγαίνουν ως στιγμιότυπα στα 0, 0,4 και 0,8″
   * και κρίνονται με ένα ερώτημα: σταματά ο αντίχειρας σε 0,8″; Το `pick` είναι
   * η απόφαση και το `why` ο λόγος, γραμμένα στο σενάριο του texts.md.
   */
  hooks: { name: string; scene: SceneSpec; why: string }[];
  pick: number;
  /** Οι σκηνές ΜΕΤΑ το αγκίστρι. */
  scenes: SceneSpec[];
  texts: Texts;
  /** Βρόχος χωρίς ραφή: το τελευταίο μισό δευτερόλεπτο ξαναστήνει το καρέ 0. Προεπιλογή ναι. */
  loop?: boolean;
  rubric: Rubric;
  /** Η κατάσταση-πρωταγωνιστής, σε μία πρόταση (παράδειγμα, ποτέ υπαρκτό πρόσωπο). */
  protagonist: Txt;
  /** Η σκηνή του εξωφύλλου. */
  cover: number;
  /** Ποιο γεγονός λέει «παράδειγμα» (υποσημείωση στις σκηνές με ποσά παραδείγματος). */
  note?: Txt;
}

/** Το short, έτοιμο: οι χρόνοι του, τα γεγονότα του, η σειρά του. */
export interface Built {
  spec: ShortSpec;
  /** Οι σκηνές με το αγκίστρι που διαλέχτηκε πρώτο. */
  scenes: SceneSpec[];
  f: Facts;
  s: Series;
  beat: number;
  /** Αρχή κάθε σκηνής (το κόψιμο) και τέλος του short. */
  at: number[];
  dur: number;
}
