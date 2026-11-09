// ═══════════════════════════════════════════════════════════════════════════
// Ο ΚΑΤΑΛΟΓΟΣ ΤΩΝ ΣΚΗΝΩΝ, ΜΙΑ ΦΟΡΑ
// ─────────────────────────────────────────────────────────────────────────
// ΗΤΑΝ ΓΡΑΜΜΕΝΟΣ ΤΕΣΣΕΡΙΣ ΦΟΡΕΣ, μία σε κάθε σάρωση· και οι τέσσερις γραφές
// είχαν ήδη αποκλίνει: η στοίχιση χειριστηρίων και οι ετικέτες δεν έβλεπαν τα
// `roi-pro`, `accounting-pro`, `planReno`, `planSale` και `referralPro`.
//
// ΚΑΙ ΟΙ ΡΥΘΜΙΣΕΙΣ ΔΕΝ ΗΤΑΝ ΣΕ ΚΑΜΙΑ. Η καρτέλα με τα περισσότερα πεδία και
// τους περισσότερους διακόπτες της εφαρμογής δεν είχε δει σαρωτή ποτέ, γιατί
// δεν υπήρχε σκηνή γι' αυτήν. Οσο ο κατάλογος ζει σε τέσσερα σημεία, το
// επόμενο κενό μπαίνει την επόμενη φορά και δεν το βλέπει κανείς.
//
// Μία λίστα: ό,τι προστεθεί εδώ, το βλέπουν και οι τέσσερις σαρώσεις.
// ═══════════════════════════════════════════════════════════════════════════
export const SCENES = [
  'overview', 'portfolio', 'cash', 'rent', 'inbox', 'ledger', 'finances', 'checklist',
  'modal', 'select', 'compare', 'loan', 'loanAdvisor', 'pricing', 'bills', 'contacts',
  'wizard', 'roi', 'roi-pro', 'tenant', 'scan', 'scanReview', 'accounting', 'accounting-pro',
  'budget', 'budgetPro',
  'calendar', 'calendarDay', 'clients', 'documents', 'inventory', 'settings', 'settingsPro',
  'billing', 'branding', 'referral', 'referralPro', 'plan', 'planReno', 'planSale',
  'myaade', 'myaadeReview', 'myaadeDone', 'myaadeError',
  // Τα λογιστικά γραφεία (scripts/perf-bench/firms.tsx).
  'firm', 'firmNew', 'firmInvite', 'firmWorkspace', 'firmWorkspaceAssociate', 'firmWorkspaceInvite',
  'firmEntryDocument', 'firmEntryBill', 'firmEntryTax', 'firmEntryLoan', 'firmEntryRent', 'firmEntryTenant', 'firmOwner',
  'firmSecondStep', 'firmOwnerDay', 'firmOwnerLink', 'firmOwnerUndo', 'firmOwnerRevoke', 'firmClientGone', 'firmClientSecondStep',
  // Η άδεια λίστα, το γραφείο χωρίς ιστορικό και το «Ζήτησέ το» (RequestSheet.tsx).
  'firmWorkspaceEmpty', 'firmQuiet', 'firmAsk', 'firmAskChannels', 'firmAskSent',
];

// ═══ ΟΙ ΣΚΗΝΕΣ ΤΗΣ ΠΥΛΗΣ ΤΟΥ ΛΟΓΙΣΤΗ ════════════════════════════════════════
// Ο χώρος του λογιστή (/accountant/…) είναι δική του διαδρομή: δική του μπάρα
// (PortalBar), χωρίς την μπάρα ακινήτου, χωρίς κάτω πλοήγηση ΚΑΙ ΧΩΡΙΣ ΤΗ ΝΟΑ.
// Ο πάγκος τις αποδίδει γυμνές (perf-bench/mobile.tsx) και ο έλεγχος της Νόας
// δεν τις μετρά: δεν υπάρχει κουμπί να σκεπάσει κάτι.
export const PORTAL_SCENES = new Set([
  'firm', 'firmNew', 'firmInvite', 'firmWorkspace', 'firmWorkspaceAssociate', 'firmWorkspaceInvite',
  'firmEntryDocument', 'firmEntryBill', 'firmEntryTax', 'firmEntryLoan', 'firmEntryRent', 'firmEntryTenant',
  'firmSecondStep', 'firmClientGone', 'firmClientSecondStep',
  'firmWorkspaceEmpty', 'firmQuiet', 'firmAsk', 'firmAskChannels', 'firmAskSent',
]);

/** Οι σκηνές που ζητά η `E2E_ONLY`, αλλιώς όλες. */
export const scenesToRun = () => {
  const only = process.env.E2E_ONLY ? process.env.E2E_ONLY.split(',') : null;
  return only ? SCENES.filter(s => only.includes(s)) : SCENES;
};
