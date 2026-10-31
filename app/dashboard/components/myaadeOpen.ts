// Το παράθυρο «Εισαγωγή από το myAADE» ζει στη σελίδα του πίνακα (page.tsx),
// που ξέρει το όριο του πακέτου και ξαναφορτώνει τα ακίνητα. Όποια καρτέλα
// θέλει να το ανοίξει στέλνει αυτό το γεγονός, αντί να περάσουν όλα αυτά από
// πέντε επίπεδα props. Ίδιο σχήμα με το «pos:ask» της Νόας.
export const MYAADE_OPEN_EVENT = 'pos:myaade';

/** Ανοίγει το παράθυρο εισαγωγής από οπουδήποτε μέσα στον πίνακα. */
export const openMyaadeImport = (): void => { window.dispatchEvent(new CustomEvent(MYAADE_OPEN_EVENT)); };
