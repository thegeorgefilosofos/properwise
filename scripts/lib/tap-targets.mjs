// ═══════════════════════════════════════════════════════════════════════════
// Ο ΚΑΝΟΝΑΣ ΤΩΝ 44 ΕΙΚΟΝΟΣΤΟΙΧΕΙΩΝ, ΓΡΑΜΜΕΝΟΣ ΜΙΑ ΦΟΡΑ
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΒΓΗΚΕ ΕΔΩ. Ο έλεγχος στόχων αφής ζούσε μέσα στο `e2e-mobile.mjs` και
// έτρεχε ΜΟΝΟ στις οκτώ δημόσιες σελίδες. Καμία από τις τριάντα εννέα οθόνες
// του ταμπλό δεν τον είχε δει ποτέ — δηλαδή ο κανόνας ίσχυε ακριβώς εκεί που ο
// χρήστης δεν έχει ακόμη λογαριασμό — κι έπαυε να ισχύει εκεί που περνά όλον
// τον χρόνο του, καταχωρώντας δαπάνες με το δάχτυλο σε τηλέφωνο.
//
// Μετρημένο μόλις έτρεξε στις σκηνές του πάγκου: 27 διακριτοί στόχοι κάτω από
// τα 44, μερικοί στα 14 και 18 εικονοστοιχεία.
//
// ── ΤΙ ΜΕΤΡΙΕΤΑΙ ────────────────────────────────────────────────────────
// Το ΟΡΑΤΟ ορθογώνιο, μεγαλωμένο από όποιο ψευδοστοιχείο απλώνει τον στόχο
// («::before» με αρνητικό inset είναι το καθιερωμένο ιδίωμα για μικρό σήμα με
// μεγάλη περιοχή αφής). Ενα κουτάκι 18×18 με ζώνη αφής 44×44 περνά — σωστά.
//
// ΤΙ ΕΞΑΙΡΕΙΤΑΙ: οι σύνδεσμοι ΜΕΣΑ σε τρεχούμενο κείμενο. Ενας σύνδεσμος μέσα
// σε πρόταση έχει το ύψος της γραμμής του· να του δοθούν 44 εικονοστοιχεία
// σημαίνει να σπάσει η παράγραφος που τον περιέχει. Ο κανόνας αφορά
// χειριστήρια, όχι λέξεις.
//
// ΤΟ ΠΛΑΤΟΣ ΖΗΤΕΙΤΑΙ ΜΟΝΟ ΟΠΟΥ ΔΕΝ ΥΠΑΡΧΕΙ ΤΙ ΝΑ ΣΗΜΑΔΕΨΕΙΣ. Ο κίνδυνος που
// καλύπτει ο κανόνας είναι να πέσει το δάχτυλο στον διπλανό στόχο. Σε
// κατακόρυφη λίστα οι γείτονες είναι πάνω και κάτω, οπότε μετράει το ΥΨΟΣ. Το
// πλάτος απαιτείται εκεί που ο στόχος δεν έχει λέξη να σημαδέψεις: κουμπιά με
// ένα ή δύο σύμβολα, δηλαδή τα εικονίδια.
// ═══════════════════════════════════════════════════════════════════════════

/** Το ελάχιστο ύψος στόχου αφής. Ο κανόνας του έργου, όχι δικός μου. */
export const TAP = 44

/**
 * Τρέχει ΜΕΣΑ στη σελίδα. Επιστρέφει τα ονόματα των στόχων που δεν πιάνουν το
 * ελάχιστο, με τις διαστάσεις τους.
 */
export const tinyTargets = (MIN) => {
  const inProse = (el) => {
    const par = el.parentElement
    if (!par) return false
    if (!/^(P|LI|SPAN|EM|STRONG|SMALL|LABEL|DD|DT|TD)$/.test(par.tagName)) return false
    if (!/^inline/.test(getComputedStyle(el).display)) return false
    return (par.textContent || '').trim().length > (el.textContent || '').trim().length + 12
  }
  const out = []
  for (const el of document.querySelectorAll('a[href], button, [role="button"], input[type="checkbox"], input[type="radio"], summary, select')) {
    if (!el.checkVisibility || !el.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true })) continue
    if (inProse(el)) continue
    let r = el.getBoundingClientRect()
    let h = r.height, w = r.width
    // ΤΟ ΠΛΑΙΣΙΟ ΕΠΙΛΟΓΗΣ ΔΕΝ ΕΙΝΑΙ ΜΟΝΟ ΤΟΥ. Το πάτημα πάνω στην ετικέτα
    // του το εναλλάσσει κανονικά, οπότε ο στόχος είναι η ΕΝΩΣΗ των δύο.
    // Ένα κουτάκι 16 εικονοστοιχείων δίπλα σε ετικέτα δύο γραμμών είναι
    // στόχος 44 και το ξέρει και ο χρήστης που ακουμπά τη φράση.
    if (el.type === 'checkbox' || el.type === 'radio') {
      const lab = el.id ? document.querySelector('label[for="' + CSS.escape(el.id) + '"]') : el.closest('label')
      if (lab) {
        const lr = lab.getBoundingClientRect()
        h = Math.max(r.bottom, lr.bottom) - Math.min(r.top, lr.top)
        w = Math.max(r.right, lr.right) - Math.min(r.left, lr.left)
        r = { height: h, width: w }
      }
    }
    for (const pe of ['::before', '::after']) {
      const cs = getComputedStyle(el, pe)
      if (cs.content === 'none' || cs.position !== 'absolute') continue
      const grow = (a, b) => (parseFloat(a) < 0 ? -parseFloat(a) : 0) + (parseFloat(b) < 0 ? -parseFloat(b) : 0)
      h = Math.max(h, r.height + grow(cs.top, cs.bottom))
      w = Math.max(w, r.width + grow(cs.left, cs.right))
    }
    const iconOnly = ((el.textContent || '').trim().length <= 2)
    if (h < MIN || (iconOnly && w < MIN)) {
      const name = (el.getAttribute('aria-label') || (el.textContent || '').trim() || el.type || el.tagName).slice(0, 26)
      out.push(`${name} ${Math.round(w)}×${Math.round(h)}`)
    }
  }
  return out
}
