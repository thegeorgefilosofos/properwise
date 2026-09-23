// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΤΗΛΕΦΩΝΑ ΚΑΙ ΤΑ ΑΦΜ ΜΕΝΟΥΝ ΣΤΗ ΣΥΣΚΕΥΗ
//
// ΤΙ ΕΦΕΥΓΕ. Σε κάθε ερώτηση προς τη Νόα, το πλαίσιο που πήγαινε στον πάροχο AI
// είχε έως πενήντα πελάτες με ονοματεπώνυμο, τηλέφωνο και ΑΦΜ. Είχε ακόμη έως
// εξήντα επαφές τεχνικών με τηλέφωνο. Τρίτα πρόσωπα, που δεν έχουν ιδέα ότι υπάρχουμε,
// ταξίδευαν στις ΗΠΑ για να ρωτήσει ο ιδιοκτήτης «πόσο έφερε ο Γιάννης φέτος».
//
// ΓΙΑΤΙ ΔΕΝ ΧΡΕΙΑΖΟΝΤΑΝ. Κάθε ενέργεια που θέλει αριθμό (WhatsApp, κλήση,
// σύνδεσμος προ-άφιξης, εύρεση πελάτη) λύνεται ΗΔΗ τοπικά, από τα ευρετήρια
// `clientsLite`/`contactsLite` του βοηθού: το μοντέλο γράφει όνομα, η συσκευή
// βρίσκει τον αριθμό. Το μοντέλο χρειάζεται μόνο να ξέρει ΑΝ υπάρχει τηλέφωνο,
// για να προτείνει WhatsApp αντί για email. Αυτό λένε οι ενδείξεις παρακάτω.
//
// Η ΜΙΑ ΠΕΡΙΠΤΩΣΗ ΠΟΥ Ο ΑΡΙΘΜΟΣ ΕΙΝΑΙ Η ΕΡΩΤΗΣΗ. «Ποιος είναι ο 6912345678;»
// Ο αριθμός τον έγραψε ο ίδιος ο χρήστης, οπότε φεύγει έτσι κι αλλιώς. Η
// συσκευή τον ψάχνει τοπικά και στέλνει ΜΟΝΟ το όνομα που ταιριάζει. Ο κανόνας
// ταιριάσματος είναι ένας, εδώ: τον μοιράζονται η εύρεση του βοηθού και αυτή
// η γραμμή.
// ═══════════════════════════════════════════════════════════════════════════

export type NumberedPerson = { name: string; phone?: string; afm?: string };

const digitsOf = (s?: string) => (s || '').replace(/\D/g, '');

/**
 * Ταιριάζει ένας αριθμός (μόνο ψηφία, 6 και πάνω) με αυτό το πρόσωπο;
 * ΑΦΜ: ακριβώς ίδιο. Τηλέφωνο: τα τελευταία ψηφία, ώστε το «345678» να βρίσκει
 * το 6912345678, ή ο αριθμός με πρόθεμα (+30, 0030) να βρίσκει το αποθηκευμένο
 * χωρίς πρόθεμα.
 */
export function matchesNumber(digits: string, p: NumberedPerson): boolean {
  if (digits.length < 6) return false;
  const afm = digitsOf(p.afm);
  if (afm && afm === digits) return true;
  const phone = digitsOf(p.phone);
  if (!phone) return false;
  return phone.endsWith(digits) || (phone.length >= 10 && digits.endsWith(phone));
}

/**
 * Οι αριθμοί μιας ερώτησης: ακολουθίες ψηφίων με έναν το πολύ χαρακτήρα
 * (κενό, τελεία, παύλα) ανάμεσα, όπως γράφονται τα τηλέφωνα («69 1234 5678»),
 * που βγάζουν 6+ ψηφία. Ποσά («8.400€») και έτη μένουν κάτω από το όριο.
 */
export function numbersIn(question: string): string[] {
  const runs = (question || '').match(/\+?\d(?:[\s.\-]?\d)+/g) || [];
  return runs.map(digitsOf).filter(d => d.length >= 6);
}

/**
 * Η γραμμή που παίρνει το μοντέλο όταν η ερώτηση έχει αριθμό που ανήκει σε
 * πελάτη ή επαφή: μόνο ονόματα, κανένας αριθμός. Κενό αν δεν ταιριάζει τίποτα.
 */
export function numberMatchLine(question: string, clients: NumberedPerson[], contacts: NumberedPerson[]): string {
  const nums = numbersIn(question);
  if (!nums.length) return '';
  const hit = (list: NumberedPerson[]) =>
    list.filter(p => p.name && nums.some(d => matchesNumber(d, p))).map(p => `«${p.name}»`);
  const c = hit(clients).slice(0, 3);
  const t = hit(contacts).slice(0, 3);
  const parts = [c.length ? `πελάτης ${c.join(', ')}` : '', t.length ? `επαφή ${t.join(', ')}` : ''].filter(Boolean);
  return parts.length ? `Ο αριθμός της ερώτησης αντιστοιχεί σε: ${parts.join(' · ')}.` : '';
}

/** Τι στοιχεία επικοινωνίας υπάρχουν, χωρίς τα ίδια τα στοιχεία. */
export function contactFlags(p: { phone?: string; afm?: string; email?: string }): string[] {
  const f: string[] = [];
  if (digitsOf(p.phone)) f.push('έχει τηλέφωνο');
  if (p.email && p.email.trim()) f.push('έχει email');
  if (digitsOf(p.afm)) f.push('έχει ΑΦΜ');
  return f;
}
