// ═══════════════════════════════════════════════════════════════════════════
// ΜΑΖΙΚΗ ΛΗΨΗ ΑΡΧΕΙΩΝ, ΕΝΑ ΕΝΑ
// ─────────────────────────────────────────────────────────────────────────
// Η «Λήψη» του Φακέλου άνοιγε ένα παράθυρο ανά αρχείο. Ο φραγμός αναδυόμενων
// αφήνει να περάσει μόνο το πρώτο, οπότε από δέκα επιλεγμένα κατέβαινε ένα και
// τα εννιά χάνονταν χωρίς λέξη. Και αυτή είναι η διαδρομή που δείχνουν η
// εξαγωγή δεδομένων και η διαγραφή λογαριασμού για τα αρχεία.
//
// Τώρα: κάθε αρχείο κατεβαίνει με `fetch` από τον υπογεγραμμένο σύνδεσμο (η
// RLS ισχύει ήδη στην υπογραφή) και αποθηκεύεται ως blob με το όνομά του, με
// σειρά και μικρή παύση ανάμεσα. Χωρίς παράθυρο δεν υπάρχει τίποτα να
// μπλοκαριστεί και ένα αρχείο τη φορά δεν φορτώνει τη μνήμη. Ό,τι αποτύχει
// μετριέται και λέγεται με το όνομά του.
//
// Ο ΣΥΝΔΕΣΜΟΣ ΠΟΥ ΕΛΗΞΕ ΥΠΟΓΡΑΦΕΤΑΙ ΞΑΝΑ. Η καρτέλα μένει ανοιχτή ώρες και οι
// σύνδεσμοι έχουν λήξη. Οταν ο καλών δίνει `resign`, μια απάντηση που δεν
// είναι ok δοκιμάζεται ακόμη μία φορά με φρέσκια υπογραφή (η RLS ξανακρίνει).
// ═══════════════════════════════════════════════════════════════════════════
import { downloadFile } from '@/lib/core/download'

export interface InTurnIo {
  fetch: (url: string) => Promise<{ ok: boolean; blob: () => Promise<Blob> }>
  save: (blob: Blob, name: string) => boolean
  wait: (ms: number) => Promise<void>
}

/** Παύση ανάμεσα σε δύο λήψεις: ο περιηγητής προλαβαίνει να ξεκινήσει την προηγούμενη. */
const GAP_MS = 350

const browserIo: InTurnIo = {
  fetch: (url) => fetch(url),
  save: (blob, name) => downloadFile(blob, name),
  wait: (ms) => new Promise(r => setTimeout(r, ms)),
}

export interface InTurnFile {
  url: string
  name: string
  /** Νέος υπογεγραμμένος σύνδεσμος, όταν ο πρώτος απαντήσει με σφάλμα. */
  resign?: () => Promise<string | null>
}

export async function downloadInTurn(
  files: readonly InTurnFile[],
  io: InTurnIo = browserIo,
): Promise<{ ok: number; failed: string[] }> {
  let ok = 0
  const failed: string[] = []
  for (let i = 0; i < files.length; i++) {
    if (i > 0) await io.wait(GAP_MS)
    const f = files[i]
    try {
      let res = await io.fetch(f.url)
      if (!res.ok && f.resign) {
        const fresh = await f.resign()
        if (fresh) res = await io.fetch(fresh)
      }
      if (res.ok && io.save(await res.blob(), f.name)) ok++
      else failed.push(f.name)
    } catch {
      failed.push(f.name)
    }
  }
  return { ok, failed }
}
