// ═══════════════════════════════════════════════════════════════════════════
// ΠΟΙΑ ΜΗΧΑΝΗ ΖΩΓΡΑΦΙΖΕΙ, ΚΑΙ ΓΙΑΤΙ ΔΕΝ ΕΙΝΑΙ ΠΑΝΤΑ Ο CHROMIUM
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΚΕΝΟ ΠΟΥ ΚΛΕΙΝΕΙ. Είκοσι δύο πλάτη, εικοσιτέσσερις σκηνές, μηδέν
// ευρήματα — και ο ιδιοκτήτης της εφαρμογής έβρισκε λάθη στο δικό του iPhone.
// Δεν ήταν αντίφαση: ΟΛΕΣ οι μετρήσεις έτρεχαν σε Chromium.
//
// ΣΤΟ iOS ΔΕΝ ΥΠΑΡΧΕΙ CHROMIUM. Ο κανόνας της Apple λέει ότι κάθε περιηγητής
// του iPhone και του iPad — Safari, Chrome, Firefox, Edge, όλοι — υποχρεούται
// να ζωγραφίζει με WebKit. Οπότε στα πλάτη του τηλεφώνου και της ταμπλέτας ο
// Chromium δεν είναι «άλλη μια μηχανή» που ελέγχουμε συμπληρωματικά: είναι η
// ΠΡΟΣΕΓΓΙΣΗ· το WebKit είναι το πραγματικό.
//
// ΤΙ ΔΙΑΦΕΡΕΙ ΣΤΗΝ ΠΡΑΞΗ. Δεν είναι θεωρία: το WebKit μετρά αλλιώς το ύψος
// γραμμής, εφαρμόζει αλλιώς το `-webkit-line-clamp`, χειρίζεται αλλιώς το
// `position: sticky` μέσα σε δοχείο που κυλάει· τα `env(safe-area-inset-*)`
// έχουν τιμή μόνο εκεί. Ο,τι από αυτά σπάει, σπάει ΜΟΝΟ σε iPhone.
//
// ΓΙΑΤΙ ΕΠΙΛΟΓΕΑΣ ΚΑΙ ΟΧΙ ΔΕΥΤΕΡΟ ΣΕΝΑΡΙΟ. Ο σαρωτής διάταξης είναι εννιακόσιες
// γραμμές μετρήσεων. Αντιγραμμένος για δεύτερη μηχανή θα απέκλινε από την
// πρώτη μέσα σε έναν μήνα· θα είχαμε δύο ορισμούς του «σπασμένο».
// ═══════════════════════════════════════════════════════════════════════════
import { chromePath, CHROME_ARGS } from './chrome.mjs';

/** Το όνομα της μηχανής που ζητήθηκε. Προεπιλογή ο Chromium. */
export const engineName = () =>
  (process.env.E2E_ENGINE || 'chromium').trim().toLowerCase();

/**
 * Ανοίγει τη ζητούμενη μηχανή.
 *
 * ΤΟ WEBKIT ΔΕΝ ΠΑΙΡΝΕΙ ΟΥΤΕ ΔΙΑΔΡΟΜΗ ΟΥΤΕ `--no-sandbox`. Η διαδρομή του
 * Chromium λύνεται με το χέρι επειδή το container της ανάπτυξης έχει δικό του
 * φάκελο· το WebKit το βρίσκει μόνο του το playwright· τα ορίσματα του
 * Chrome δεν τα καταλαβαίνει — περασμένα, σκάει στο άνοιγμα.
 */
export async function launchEngine() {
  const name = engineName();
  const pw = await import('playwright-core');
  if (name === 'webkit') {
    if (!pw.webkit) throw new Error('Το playwright-core δεν έχει webkit.');
    return pw.webkit.launch();
  }
  // Ο Firefox (Gecko) είναι η ΤΡΙΤΗ μηχανή του κόσμου, στον υπολογιστή. Στο iOS
  // ζωγραφίζει με WebKit (τον καλύπτει η webkit), αλλά στον υπολογιστή έχει
  // δικά του: αλλιώς σπάει τη γραμματοσειρά, αλλιώς το `text-wrap`, αλλιώς τα
  // πλέγματα. Δεν παίρνει διαδρομή ούτε ορίσματα Chrome, όπως και το WebKit.
  if (name === 'firefox') {
    if (!pw.firefox) throw new Error('Το playwright-core δεν έχει firefox.');
    return pw.firefox.launch();
  }
  if (name !== 'chromium') {
    throw new Error(`Άγνωστη μηχανή «${name}». Δεκτά: chromium, webkit, firefox.`);
  }
  return pw.chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || chromePath(),
    args: CHROME_ARGS,
  });
}

/** Πώς λέγεται η μηχανή στα ελληνικά, για τις επικεφαλίδες των αναφορών. */
export const engineLabel = () => {
  const n = engineName();
  if (n === 'webkit') return 'WebKit · Safari';
  if (n === 'firefox') return 'Gecko · Firefox';
  return 'Chromium';
};
