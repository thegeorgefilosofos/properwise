// ═══════════════════════════════════════════════════════════════════════════
// «ΖΗΤΗΣΕ ΤΟ»: ΤΟ ΜΗΝΥΜΑ ΚΑΙ ΤΑ ΚΑΝΑΛΙΑ ΤΟΥ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΑΙΤΗΜΑ ΓΡΑΦΕΤΑΙ ΠΑΝΤΑ ΣΤΗΝ ΕΦΑΡΜΟΓΗ. Ο ιδιοκτήτης το βλέπει στη Λογιστική
// του και το ιστορικό μένει, όποιο κανάλι κι αν διαλέξει ο λογιστής. Τα
// υπόλοιπα κανάλια είναι ΣΥΝΔΕΣΜΟΙ ΠΟΥ ΑΝΟΙΓΟΥΝ την εφαρμογή του λογιστή με
// έτοιμο κείμενο (mailto, wa.me, viber, sms): κανένα API τρίτου, καμία
// αποστολή από εμάς, καμία νέα εξάρτηση.
//
// ΚΑΝΑΛΙ ΧΩΡΙΣ ΣΤΟΙΧΕΙΟ ΔΕΝ ΠΡΟΣΦΕΡΕΤΑΙ. Email χωρίς διεύθυνση, WhatsApp χωρίς
// ελληνικό κινητό: το κουμπί δεν υπάρχει, αντί να ανοίγει κενή φόρμα.
//
// ΧΑΙΡΕΤΙΣΜΟΣ ΧΩΡΙΣ ΚΛΗΤΙΚΗ. «κ. Παπαδόπουλε» βγαίνει σωστά μόνο με κανόνες
// που δεν έχουμε για κάθε επώνυμο· ένα λάθος «κ. Παπαδόπουλος» στην αρχή
// μηνύματος διαβάζεται χειρότερα από ένα ουδέτερο «Καλημέρα,».
// ═══════════════════════════════════════════════════════════════════════════
import { siteUrl } from '@/lib/core/site';
import { grMobileDigits, grMobileE164 } from '@/lib/core/phone';
import { whatsappLink, viberLink } from '@/lib/clients/messages';

export type AskChannel = 'app' | 'email' | 'whatsapp' | 'viber' | 'sms';

export const ASK_CHANNEL_LABEL: Record<AskChannel, string> = {
  app: 'Στην εφαρμογή',
  email: 'Ηλεκτρονικό ταχυδρομείο',
  whatsapp: 'WhatsApp',
  viber: 'Viber',
  sms: 'SMS',
};

/** Τα στοιχεία επικοινωνίας του πελάτη, όσα επιτρέπεται να δει το γραφείο. */
export interface AskContact { email?: string | null; phone?: string | null }

/** Πού βλέπει ο ιδιοκτήτης τα αιτήματα του λογιστή του. */
export const OWNER_REQUESTS_PATH = '/dashboard?tab=accounting';

/**
 * Απλός έλεγχος μορφής email, χωρίς κανονική έκφραση: η `[^\s@]+\.[^\s@]+`
 * έχει πολυωνυμικό χρόνο σε μεγάλη είσοδο (CodeQL js/polynomial-redos).
 */
function looksLikeEmail(v: string): boolean {
  if (v.length > 254 || /\s/.test(v)) return false;
  const at = v.indexOf('@');
  if (at < 1 || at !== v.lastIndexOf('@')) return false;
  const domain = v.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  return dot > 0 && dot < domain.length - 1;
}

/** Ποια κανάλια έχουν το στοιχείο που χρειάζονται. Η εφαρμογή πάντα πρώτη. */
export function askChannels(c: AskContact | null | undefined): AskChannel[] {
  const out: AskChannel[] = ['app'];
  if (c?.email && looksLikeEmail(c.email.trim())) out.push('email');
  if (grMobileDigits(c?.phone)) out.push('whatsapp', 'viber', 'sms');
  return out;
}

/**
 * Τι ζητάμε, σε φράση που στέκεται μετά το «χρειάζομαι:».
 *
 * Η γραμμή της λίστας είναι γραμμένη για τον λογιστή, σε τρίτο πρόσωπο («Δεν
 * έχει συμπληρώσει ΑΦΜ»). Στο μήνυμα προς τον ίδιο τον πελάτη αυτό θα έλεγε
 * «χρειάζομαι: Δεν έχει συμπληρώσει ΑΦΜ». Οι γραμμές με πλήθος («3 δαπάνες
 * χωρίς κατηγορία») στέκονται όπως είναι.
 */
// ΚΑΘΕ ΦΡΑΣΗ ΛΕΕΙ ΤΙ ΝΑ ΚΑΝΕΙ Ο ΠΕΛΑΤΗΣ. Το «χρειάζομαι: 2 ανείσπρακτα
// μισθώματα» έλεγε το αντίθετο από αυτό που ζητούσε ο λογιστής (να επιβεβαιωθεί
// αν εισπράχθηκαν), γιατί έπαιρνε τη γραμμή της λίστας αυτούσια.
const one = (n: number, a: string, b: string) => (n === 1 ? a : b);
const PHRASE: Record<string, (n: number) => string> = {
  no_properties: () => 'να καταχωρήσετε τα ακίνητά σας',
  no_expenses: () => 'να καταχωρήσετε τις δαπάνες της χρήσης',
  uncategorised: n => `να βάλετε κατηγορία ${one(n, 'σε 1 δαπάνη', `σε ${n} δαπάνες`)}`,
  no_supplier_afm: n => `να συμπληρώσετε τον ΑΦΜ του προμηθευτή ${one(n, 'σε 1 δαπάνη', `σε ${n} δαπάνες`)}`,
  stays_no_fee: n => `να συμπληρώσετε την προμήθεια της πλατφόρμας ${one(n, 'σε 1 κράτηση', `σε ${n} κρατήσεις`)}`,
  rents_unpaid: n => one(n, 'να επιβεβαιώσετε το 1 μίσθωμα που εμφανίζεται ανείσπρακτο', `να επιβεβαιώσετε τα ${n} μισθώματα που εμφανίζονται ανείσπρακτα`),
  owner_afm: () => 'να συμπληρώσετε τον ΑΦΜ σας',
  aade_e2: () => 'να ανεβάσετε το προσυμπληρωμένο Ε2 από το Taxisnet',
  aade_diff: () => 'να δείτε τις διαφορές με το προσυμπληρωμένο Ε2',
  pack: () => 'να μου στείλετε τον φάκελο για τον λογιστή',
};

export function askPhrase(key: string, item: string): string {
  const n = Number(/^\d+/.exec(item.trim())?.[0] ?? 0);
  const f = PHRASE[key];
  return f ? f(n) : `να δείτε: ${item.charAt(0).toLocaleLowerCase('el-GR')}${item.slice(1)}`;
}

/** Καλημέρα ως τις 12:00 ώρα Ελλάδας, Καλησπέρα μετά. */
export function greeting(now: Date = new Date()): string {
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Athens' }).format(now));
  return h < 12 ? 'Καλημέρα,' : 'Καλησπέρα,';
}

export interface AskText { subject: string; body: string }

/** Το κείμενο που φεύγει από email, WhatsApp, Viber ή SMS. */
export function askText(o: { key: string; item: string; year: number; note?: string; from?: string | null; now?: Date }): AskText {
  const what = askPhrase(o.key, o.item);
  const note = o.note?.trim();
  const lines = [
    greeting(o.now),
    `για να κλείσουμε το Ε2 ${o.year}, σας παρακαλώ ${what}.`,
    ...(note ? [note.trimEnd().replace(/([^.!;…])$/, '$1.')] : []),
    `Μπορείτε να το συμπληρώσετε εδώ: ${siteUrl(OWNER_REQUESTS_PATH)}`,
  ];
  const sign = o.from?.trim();
  const body = `${lines.join('\n')}${sign ? `\n\n${sign}` : ''}`;
  return { subject: `Ε2 ${o.year}: ${o.item}`, body };
}

/** Ο σύνδεσμος που ανοίγει την εφαρμογή του καναλιού. `null` για την εφαρμογή ή χωρίς στοιχείο. */
export function askHref(ch: AskChannel, c: AskContact | null | undefined, t: AskText): string | null {
  switch (ch) {
    case 'email': {
      const to = c?.email?.trim();
      return to && looksLikeEmail(to) ? `mailto:${encodeURIComponent(to).replace(/%40/g, '@')}?subject=${encodeURIComponent(t.subject)}&body=${encodeURIComponent(t.body)}` : null;
    }
    case 'whatsapp': {
      const d = grMobileDigits(c?.phone);
      return d ? whatsappLink(d, t.body) : null;
    }
    case 'viber':
      return grMobileDigits(c?.phone) ? viberLink(t.body) : null;
    case 'sms': {
      const n = grMobileE164(c?.phone);
      // Το `?&body=` το διαβάζουν και το iOS και το Android.
      return n ? `sms:${n}?&body=${encodeURIComponent(t.body)}` : null;
    }
    default:
      return null;
  }
}

/** Τι λέει η επιβεβαίωση μετά την αποστολή. */
export function askSentText(ch: AskChannel): string {
  if (ch === 'app') return 'Στάλθηκε στην εφαρμογή.';
  if (ch === 'viber') return 'Στάλθηκε στην εφαρμογή. Άνοιξε το Viber: διάλεξε την επαφή και πάτα αποστολή.';
  return `Στάλθηκε στην εφαρμογή. Άνοιξε ${ch === 'email' ? 'το email' : ch === 'sms' ? 'το SMS' : 'το WhatsApp'} με το μήνυμα έτοιμο.`;
}
