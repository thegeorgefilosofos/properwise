// ═══════════════════════════════════════════════════════════════════════════
// Η ΕΤΙΚΕΤΑ ΑΝΟΙΓΜΑΤΟΣ ΕΝΟΣ ΣΤΟΙΧΕΙΟΥ JSX, ΟΣΕΣ ΓΡΑΜΜΕΣ ΚΙ ΑΝ ΠΙΑΝΕΙ
// ─────────────────────────────────────────────────────────────────────────
// Οι φύλακες που κοίταζαν μία γραμμή τη φορά ήταν τυφλοί σε κάθε στοιχείο
// γραμμένο σε πολλές: `<ChipToggle` στη μία και `on={v === k}` στην επόμενη,
// `<p` στη μία και `textWrap: 'balance'` τρεις πιο κάτω (έλεγχος του #581).
// Εδώ διαβάζεται όλη η ετικέτα ανοίγματος, από το `<` ως το `>` που την
// κλείνει, με επίγνωση των αγκίστρων και των εισαγωγικών (ένα `=>` μέσα σε
// `{…}` δεν την κλείνει).
// ═══════════════════════════════════════════════════════════════════════════

/** Το κείμενο της ετικέτας ανοίγματος που ξεκινά στη θέση `at` (στο `<`). */
export function openTag(src, at) {
  let depth = 0, str = null
  for (let i = at + 1; i < src.length; i++) {
    const c = src[i]
    if (str) { if (c === '\\') { i++; continue } if (c === str) str = null; continue }
    if (c === '"' || c === "'" || c === '`') { str = c; continue }
    if (c === '{') depth++
    else if (c === '}') depth--
    else if (c === '>' && depth === 0) return src.slice(at, i + 1)
  }
  return src.slice(at)
}

/** Κάθε ετικέτα ανοίγματος του `name` (κανονική έκφραση ονόματος) σε `src`, με τη γραμμή της. */
export function* openTags(src, name) {
  const re = new RegExp(`<(${name})(?=[\\s/>])`, 'g')
  const starts = [0]
  for (let i = 0; i < src.length; i++) if (src[i] === '\n') starts.push(i + 1)
  const lineOf = (pos) => { let lo = 0, hi = starts.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= pos) lo = mid; else hi = mid - 1 } return lo }
  for (const m of src.matchAll(re)) {
    const line = lineOf(m.index)
    const lineText = src.slice(starts[line], src.indexOf('\n', m.index) === -1 ? undefined : src.indexOf('\n', m.index)).trim()
    if (lineText.startsWith('//') || lineText.startsWith('*') || lineText.startsWith('/*')) continue
    yield { el: m[1], tag: openTag(src, m.index), line }
  }
}
