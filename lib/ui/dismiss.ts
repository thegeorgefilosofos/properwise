// ═══════════════════════════════════════════════════════════════════════════
// ΕΝΑ ΠΑΡΑΘΥΡΟ ΔΕΝ ΧΑΝΕΙ Ο,ΤΙ ΓΡΑΦΤΗΚΕ ΜΕΣΑ ΤΟΥ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ (έλεγχος 19/10/2026). Ο οδηγός ακινήτου και ο έλεγχος της
// σάρωσης έκλειναν με κλικ στο φόντο ή με Escape και έσβηναν πέντε βήματα και
// δεκάδες πεδία, ή μια σάρωση που είχε ήδη μετρήσει στο όριο του μήνα.
// Αναπαράχθηκε στο Chromium: πάτημα μέσα στο «Όνομα», σύρσιμο επιλογής κειμένου
// έξω από το πλαίσιο, άφημα. Ο κοινός πρόγονος του πατήματος και του αφήματος
// είναι το φόντο, οπότε το `click` πέφτει εκεί και το παράθυρο κλείνει.
//
// ΤΡΙΑ ΜΕΤΡΑ, ΟΛΑ ΕΔΩ ΩΣΤΕ ΝΑ ΔΟΚΙΜΑΖΟΝΤΑΙ ΧΩΡΙΣ ΠΕΡΙΗΓΗΤΗ:
//   1. `backdropDismiss`: το φόντο κλείνει μόνο όταν ΚΑΙ το pointerdown ΚΑΙ το
//      click έγιναν πάνω του.
//   2. `sameDraft`: «υπάρχουν αλλαγές;» με μία σύγκριση, ανεξάρτητη από τη
//      σειρά των κλειδιών. Η επιβεβαίωση ζει στο components/confirmBus.ts.
//   3. `readDraft` / `writeDraft` / `clearDraft`: πρόχειρο στο sessionStorage,
//      πάντα μέσα σε try/catch. Σε ιδιωτική περιήγηση ή με κλειδωμένο χώρο ο
//      οδηγός δουλεύει όπως πριν, απλώς χωρίς πρόχειρο.
// ═══════════════════════════════════════════════════════════════════════════

/** Ό,τι χρειάζεται από ένα γεγονός δείκτη: πού έγινε και ποιος το ακούει. */
export interface BackdropEvent { target: unknown; currentTarget: unknown }

/**
 * Ο φύλακας του φόντου. Ένας ανά παράθυρο: θυμάται αν το τελευταίο πάτημα
 * ξεκίνησε πάνω στο ίδιο το φόντο και όχι μέσα στο πλαίσιο.
 *
 * Το `click` κλείνει μόνο αν ΚΑΙ το `pointerdown` έγινε στο φόντο. Μετά από
 * κάθε `click` η μνήμη σβήνει, ώστε ένα παλιό πάτημα να μη μετρά σε επόμενο.
 */
export function backdropDismiss() {
  let downOnBackdrop = false
  return {
    down(e: BackdropEvent): void { downOnBackdrop = e.target === e.currentTarget },
    /** `true` όταν το παράθυρο πρέπει να κλείσει. */
    click(e: BackdropEvent): boolean {
      const close = downOnBackdrop && e.target === e.currentTarget
      downOnBackdrop = false
      return close
    },
  }
}

// ── ΠΡΟΧΕΙΡΟ ─────────────────────────────────────────────────────────────────

/**
 * Το πρόθεμα των κλειδιών. Το πρόχειρο κρατά ονόματα και ΑΦΜ, οπότε σβήνεται
 * και στην αποσύνδεση (lib/localPrivacy.ts, `PERSONAL_KEY_PREFIXES`).
 */
export const DRAFT_PREFIX = 'po_draft_'
/** Η μορφή του προχείρου. Αλλάζει όταν αλλάζουν τα πεδία, ώστε παλιό πρόχειρο να αγνοείται. */
const DRAFT_VERSION = 1

export type DraftStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const sessionStore = (): DraftStore | null => {
  try { return typeof sessionStorage === 'undefined' ? null : sessionStorage } catch { return null }
}

export const draftKey = (name: string, userId: string): string => `${DRAFT_PREFIX}${name}_${userId}`

/** Το πρόχειρο ή `null`: όταν λείπει, όταν είναι άλλης μορφής ή όταν ο χώρος δεν ανοίγει. */
export function readDraft<T extends object>(key: string, store: DraftStore | null = sessionStore()): T | null {
  if (!store) return null
  try {
    const raw = store.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { v?: unknown; data?: unknown }
    if (parsed?.v !== DRAFT_VERSION || !parsed.data || typeof parsed.data !== 'object' || Array.isArray(parsed.data)) return null
    return parsed.data as T
  } catch {
    return null
  }
}

/** Γράφει το πρόχειρο. `false` όταν ο χώρος δεν δέχεται (γεμάτος, κλειδωμένος). */
export function writeDraft(key: string, data: object, store: DraftStore | null = sessionStore()): boolean {
  if (!store) return false
  try { store.setItem(key, JSON.stringify({ v: DRAFT_VERSION, data })); return true } catch { return false }
}

export function clearDraft(key: string, store: DraftStore | null = sessionStore()): void {
  if (!store) return
  try { store.removeItem(key) } catch { /* κλειδωμένος χώρος */ }
}

/** Ίδιο περιεχόμενο, όποια κι αν είναι η σειρά των κλειδιών. */
export function sameDraft(a: unknown, b: unknown): boolean {
  return stable(a) === stable(b)
}

function stable(x: unknown): string {
  if (Array.isArray(x)) return `[${x.map(stable).join(',')}]`
  if (x && typeof x === 'object') {
    return `{${Object.keys(x as Record<string, unknown>).sort()
      .map(k => `${JSON.stringify(k)}:${stable((x as Record<string, unknown>)[k])}`).join(',')}}`
  }
  return JSON.stringify(x ?? null)
}

/**
 * Κρατά από ένα πρόχειρο μόνο ό,τι έχει τον ίδιο τύπο με την προεπιλογή. Ένα
 * πρόχειρο έρχεται από τον περιηγητή, άρα δεν εμπιστευόμαστε το σχήμα του: ένα
 * πεδίο με αριθμό αντί για κείμενο θα έσπαγε τη φόρμα.
 */
export function restoreDraft<T extends Record<string, unknown>>(base: T, draft: Partial<Record<keyof T, unknown>> | null): T {
  if (!draft) return base
  const out = { ...base }
  for (const k of Object.keys(base) as (keyof T)[]) {
    const d = draft[k]
    const b = base[k]
    if (d === undefined) continue
    if (Array.isArray(b)) {
      if (Array.isArray(d) && d.every(x => typeof x === 'string')) out[k] = d as T[keyof T]
    } else if (b && typeof b === 'object') {
      if (d && typeof d === 'object' && !Array.isArray(d)) out[k] = restoreDraft(b as Record<string, unknown>, d as Record<string, unknown>) as T[keyof T]
    } else if (b === null) {
      if (d === null || typeof d === 'string') out[k] = d as T[keyof T]
    } else if (typeof d === typeof b) {
      out[k] = d as T[keyof T]
    }
  }
  return out
}
