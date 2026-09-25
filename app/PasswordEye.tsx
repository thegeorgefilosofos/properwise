'use client'

// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΜΑΤΙ ΤΟΥ ΚΩΔΙΚΟΥ, ΜΙΑ ΦΟΡΑ ΓΙΑ ΣΥΝΔΕΣΗ, ΕΓΓΡΑΦΗ ΚΑΙ ΕΠΑΝΑΦΟΡΑ
// ─────────────────────────────────────────────────────────────────────────
// Ηταν τρία αντίγραφα και τα τρία έκαναν το ίδιο διπλό λάθος:
//
// 1. Το εικονίδιο έδειχνε ΚΑΤΑΣΤΑΣΗ, όχι ΕΝΕΡΓΕΙΑ. Με κρυμμένο κωδικό φαινόταν
//    το διαγραμμένο μάτι, ενώ το κουμπί έγραφε «Εμφάνιση κωδικού»: ο βλέπων
//    διάβαζε «κρυφό», ο αναγνώστης οθόνης «εμφάνισε». Τώρα το μάτι λέει τι θα
//    γίνει με το πάτημα, όπως στα κουμπιά του λειτουργικού.
// 2. Η ετικέτα άλλαζε ΜΑΖΙ με το `aria-pressed`. Σε διακόπτη η ετικέτα μένει
//    σταθερή και την κατάσταση τη λέει μόνο το `aria-pressed`· αλλιώς ακούγεται
//    «Απόκρυψη κωδικού, πατημένο», που δεν λέει αν ο κωδικός φαίνεται.
//
// ΜΕΝΕΙ ΧΕΙΡΟΠΟΙΗΤΟ: το IconBtn δεν προωθεί `aria-pressed` και το μάτι είναι
// διακόπτης· ο στόχος αφής είναι ήδη 44×44.
// ═══════════════════════════════════════════════════════════════════════════

export default function PasswordEye({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} aria-label="Εμφάνιση κωδικού" aria-pressed={show}
      style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', width: 44, height: 44, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {show
        ? <svg aria-hidden="true" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.9 17.9A10.7 10.7 0 0 1 12 19c-6.5 0-10-7-10-7a19 19 0 0 1 5.1-5.9M9.9 4.2A10.9 10.9 0 0 1 12 4c6.5 0 10 7 10 7a19 19 0 0 1-2.2 3.2M1 1l22 22M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
        : <svg aria-hidden="true" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>}
    </button>
  )
}
