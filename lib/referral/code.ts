// ═══════════════════════════════════════════════════════════════════════════
// Ο ΚΩΔΙΚΟΣ ΠΡΟΣΚΛΗΣΗΣ: ΓΕΝΝΗΤΡΙΑ ΚΑΙ ΕΛΕΓΧΟΣ ΜΟΡΦΗΣ, ΔΙΠΛΑ-ΔΙΠΛΑ
// ─────────────────────────────────────────────────────────────────────────
// Χωρίστηκε από το referral.ts (07.10.2026) για το βάρος της εγγραφής, που
// θέλει μόνο το `isReferralCode`. Καμία εισαγωγή, ώστε να μη σέρνει τίποτα
// μαζί του. Το referral.ts τα επανεξάγει: οι καλούντες δεν άλλαξαν.
// ═══════════════════════════════════════════════════════════════════════════

function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

export function referralCode(userId: string): string {
  // 32-bit hash → base36 χωρίς απώλεια ψηφίων (max 4.294.967.295 = 7 ψηφία base36).
  // ΔΕΝ κόβουμε ουρά (θα προκαλούσε συγκρούσεις — δύο χρήστες, ίδιος κωδικός).
  const base = fnv1a(userId).toString(36).toUpperCase().padStart(7, '0');
  return 'PO' + base;
}

export function referralLink(origin: string, userId: string): string {
  return `${origin.replace(/\/+$/, '')}/signup?ref=${referralCode(userId)}`;
}

/**
 * Εχει ο κωδικός τη μορφή που παράγει η `referralCode`;
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ: ο κωδικός φτάνει στην εγγραφή ως `?ref=`, δηλαδή ως κείμενο
 * που γράφει ο καθένας. Οποια οθόνη τον ΔΕΙΧΝΕΙ, δείχνει περιεχόμενο της
 * διεύθυνσης. Ο έλεγχος ζει δίπλα στη γεννήτρια, ώστε η μορφή να μην αντιγραφεί
 * σε δεύτερο σημείο και να αποκλίνει σιωπηλά.
 */
export function isReferralCode(code: string | null | undefined): boolean {
  return /^PO[0-9A-Z]{7}$/.test((code || '').trim());
}
