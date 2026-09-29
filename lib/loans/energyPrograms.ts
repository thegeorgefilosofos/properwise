// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΠΡΟΓΡΑΜΜΑΤΑ ΕΝΕΡΓΕΙΑΚΗΣ ΑΝΑΒΑΘΜΙΣΗΣ: ΟΙ ΗΜΕΡΟΜΗΝΙΕΣ ΖΟΥΝ ΕΔΩ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΣΦΑΛΜΑ, ΜΕΤΡΗΜΕΝΟ ΣΤΙΣ 29/09/2026. Ο κατάλογος (STATE_PROGRAMS) έδειχνε
// το «Εξοικονομώ 2025» και το «Αναβαθμίζω» κλειστά, αλλά τρία άλλα σημεία
// έγραφαν δικές τους εκδοχές: η σημείωση της ενεργειακής αναβάθμισης στον
// υπολογιστή («προθεσμία 30/06/2026 … 31/08/2026»), ο σύμβουλος («Εξοικονομώ»
// και «Αναβαθμίζω» ανεβάζουν την αξία) και ο βοηθός («ολοκλήρωση 31/5/2026»,
// ημερομηνία που δεν υπάρχει στον κατάλογο). Κανένα δεν ρωτούσε το ημερολόγιο.
//
// Το ίδιο σχήμα με το `SPITI_MOU`: οι ημερομηνίες μία φορά, εδώ· ο κατάλογος
// τις διαβάζει και η κρίση γίνεται από την `programStatus`. Ό,τι ονομάζει
// πρόγραμμα ως διαθέσιμο ρωτά την `openEnergyPrograms`.
// ═══════════════════════════════════════════════════════════════════════════
import { programStatus, parseProgramDate, type ProgramDates, type ProgramStatus } from './programStatus'

export interface EnergyProgram extends ProgramDates {
  id: string
  name: string
}

export const EXOIKONOMO_2025: EnergyProgram = {
  id: 'exoikonomo_2025', name: 'Εξοικονομώ 2025',
  // Η αρχική προθεσμία· εκκρεμεί ανακοίνωση παράτασης. Όταν ανακοινωθεί,
  // αλλάζει εδώ και το πρόγραμμα ανοίγει μόνο του σε κάθε οθόνη.
  deadline: '2026-06-30',
}

export const ANAVATHMIZO: EnergyProgram = {
  id: 'anavathmizo', name: 'Αναβαθμίζω το Σπίτι μου',
  applicationDeadline: '2026-05-31',
  deadline: '2026-08-31',
}

export const EXOIKONOMO_2026: EnergyProgram = {
  id: 'exoikonomo_2026', name: 'Εξοικονομώ 2026',
  status: 'upcoming',
}

export const ENERGY_PROGRAMS: readonly EnergyProgram[] = [EXOIKONOMO_2025, ANAVATHMIZO, EXOIKONOMO_2026]
export const ENERGY_PROGRAM_IDS: readonly string[] = ENERGY_PROGRAMS.map(p => p.id)

/**
 * Η κατάσταση κάθε προγράμματος τη δεδομένη μέρα («ΕΕΕΕ-ΜΜ-ΗΗ», ώρα Αθήνας).
 * Μέρα που δεν διαβάζεται κρίνεται ως η πιο πρόσφατη δυνατή, όπως στο
 * `spitiMouStatus`: άκυρο όρισμα δεν ξανανοίγει κλειστό πρόγραμμα.
 */
export function energyProgramStates(today: string): (EnergyProgram & ProgramStatus)[] {
  const day = parseProgramDate(today) ?? new Date(8.64e15)
  return ENERGY_PROGRAMS.map(p => ({ ...p, ...programStatus(p, day) }))
}

/** Τα ονόματα όσων δέχονται αίτηση τη δεδομένη μέρα. */
export const openEnergyPrograms = (today: string): string[] =>
  energyProgramStates(today).filter(p => p.acceptsApplications).map(p => p.name)

/** «Α», «Α και Β», «Α, Β και Γ»: χωρίς κόμμα πριν από το «και». */
export const joinGreek = (names: string[]): string =>
  names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} και ${names[names.length - 1]}`
