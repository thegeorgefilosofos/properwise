// ═══════════════════════════════════════════════════════════════════════════
// PROPERWISE · Κοινή βιβλιοθήκη email templates (lifecycle + marketing).
//
// ΜΙΑ πηγή αλήθειας για ΟΛΑ τα emails: ένα branded κέλυφος (P-logo header, λευκή
// κάρτα, footer/απεγγραφή/colophon), τυποποιημένη τυπογραφία, καθαρό ασπρόμαυρο
// με μοναδικό accent το μπλε του brand. Καθένα επιστρέφει { subject, html }.
//
// Καθαρό & χωρίς εξαρτήσεις (ισχύει σε Deno edge functions και σε plain TS), ώστε
// να το χρησιμοποιούν όλες οι functions αποστολής και να μη διαφέρει ποτέ η εικόνα.
//
// Segmentation ανά πακέτο (free / individual / professional) + εποχικές καμπάνιες.
// Η εξατομίκευση γίνεται με παραμέτρους (όνομα, πακέτο, ποσά…). Για μαζικά batch
// (send-client-email) υποστηρίζονται και tokens {{name}} που γεμίζει η function.
// ═══════════════════════════════════════════════════════════════════════════

import { APP_URL } from './site.ts';
export type Plan = 'free' | 'individual' | 'professional';

// ═══ ΜΙΑ ΠΑΛΕΤΑ, ΔΥΟ ΘΕΜΑΤΑ ═══════════════════════════════════════════════
// Τα ονόματα είναι τα ίδια με τις κλάσεις που τυπώνει το κέλυφος: ό,τι γράφει
// `color:${INK}` παίρνει `class="ink"` — και η σκοτεινή εκδοχή του ορίζεται ΜΙΑ
// φορά στο <style>. Χωρίς αυτή τη σύμβαση, σκοτεινό θέμα σημαίνει να κυνηγάς
// 118 πρότυπα ένα ένα.
const ACCENT = '#1a73e8';
const INK = '#1d1d1f';
const TEXT = '#4a4f55';
const MUTE = '#6b7176';
const FAINT = '#8a9099';
const RULE = '#e8e8ed';
const DEFAULT_APP = APP_URL;

// Το πλάτος του μηνύματος. 560 για τα μηνύματα προϊόντος, που κουβαλούν
// πίνακες (καταστάσεις, υπενθυμίσεις, ημερολόγιο)· 480 για μονής πράξης.
const WIDTH = 560;

// ΤΟ ΣΥΝΘΗΜΑ ΕΦΥΓΕ ΑΠΟ ΤΟ ΥΠΟΣΕΛΙΔΟ. Τυπωνόταν σε καθένα από τα 118 μηνύματα,
// σε μπλε και έντονο, κάτω από κάθε ειδοποίηση λήξης ασφαλιστηρίου. Καμία από
// τις εταιρείες που στέλνουν τα καλύτερα email δεν επαναλαμβάνει σύνθημα σε
// συναλλακτικό μήνυμα: το υποσέλιδο λέει ΠΟΙΟΣ στέλνει και ΠΩΣ σταματάς να
// λαμβάνεις. Το σύνθημα ζει στην αρχική, όπου έχει λόγο.

const esc = (v: unknown): string =>
  String(v ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] || c));

// ═══ ΕΛΛΗΝΙΚΑ ΚΕΦΑΛΑΙΑ ΧΩΡΙΣ ΤΟΝΟ, ΜΕ ΤΗΝ ΙΔΙΑ ΤΕΧΝΙΚΗ ΜΕ ΤΗΝ ΕΦΑΡΜΟΓΗ ══════
// ΤΟ ΣΦΑΛΜΑ, ΜΕΤΡΗΜΕΝΟ. Η προηγούμενη γραφή έκανε ΠΡΩΤΑ `toUpperCase()` και
// μετά έψαχνε τα ΠΕΖΑ «ΐ» και «ΰ» — που δεν υπάρχουν πια εκείνη τη στιγμή. Η
// JavaScript αναλύει το «ΐ» σε «Ϊ» συν χωριστό τόνο όταν το κεφαλαιοποιεί,
// οπότε η αντικατάσταση δεν έπιανε ΠΟΤΕ και ο τόνος επιβίωνε:
//
//     «αΰλος»  →  «ΑΫ́ΛΟΣ»   αντί για   «ΑΫΛΟΣ»
//
// Σε email που φεύγει σε πελάτη. Ο φύλακας uppercase-tonos υπάρχει ακριβώς
// γι' αυτό — αλλά δεν σάρωνε τον φάκελο supabase/, οπότε δεν το είδε ποτέ.
//
// Η ΕΦΑΡΜΟΓΗ ΤΟ ΕΚΑΝΕ ΗΔΗ ΣΩΣΤΑ, ΜΕ ΑΛΛΗ ΤΕΧΝΙΚΗ. Το `grUpper` του
// lib/core/format.ts αποσυνθέτει (NFD), πετά τον συνδυαστικό τόνο U+0301 και
// ξανασυνθέτει: τα διαλυτικά μένουν, ο τόνος φεύγει, καμία λίστα γραμμάτων.
// Οι δύο συναρτήσεις δεν μπορούν να μοιραστούν αρχείο —το Deno δεν φτάνει στο
// lib/— αλλά μπορούν και οφείλουν να μοιράζονται ΤΕΧΝΙΚΗ.
export const grUp = (v: string): string =>
  String(v ?? '').toUpperCase().normalize('NFD').replace(/\u0301/g, '').normalize('NFC');

export const PLAN_LABEL: Record<Plan, string> = {
  free: 'Χωρίς συνδρομή', individual: 'Ιδιώτης', professional: 'Επαγγελματίας',
};

// ═══ ΤΑ ΟΝΟΜΑΤΑ ΤΩΝ ΠΑΚΕΤΩΝ ΧΡΕΩΣΗΣ ═══════════════════════════════════════
// ΤΟ «ΙΔΙΩΤΗΣ» ΔΕΝ ΑΓΟΡΑΖΕΤΑΙ. Είναι τρόπος χρήσης (το PLAN_LABEL παραπάνω)·
// τα πακέτα λέγονται όπως στο lib/billing/plans.ts. Το Deno δεν φτάνει στο
// lib/, οπότε τα ονόματα ζουν εδώ ως αντίγραφο και ο guard-email-audience
// ελέγχει ότι είναι ίδια με την πηγή τους.
export const PACKAGE_NAME = {
  solo: 'Ιδιοκτήτης', owner: 'Ιδιοκτήτης+', agency: 'Επαγγελματίας', office: 'Επαγγελματίας+',
} as const;

// ── Δομικά κομμάτια σώματος (τυποποιημένα) ───────────────────────────────────
export const p = (html: string): string =>
  `<p class="tx" style="margin:0 0 14px;font-size:15px;color:${TEXT};mso-line-height-rule:exactly;line-height:25px;">${html}</p>`;
export const h = (html: string): string =>
  `<h1 class="ink h1" style="margin:0 0 12px;font-size:22px;color:${INK};font-weight:600;letter-spacing:-0.2px;mso-line-height-rule:exactly;line-height:29px;">${html}</h1>`;
// ΤΟ ΔΑΠΕΔΟ ΤΩΝ 11px ΙΣΧΥΕΙ ΚΑΙ ΕΔΩ. Η εφαρμογή δεν τυπώνει κείμενο κάτω από 11
// εικονοστοιχεία και το επιβάλλει ο guard-type-floor. Το email είναι κι αυτό
// οθόνη και μάλιστα διαβάζεται σχεδόν πάντα σε κινητό: το 10,5 ήταν το
// μικρότερο κείμενο ολόκληρου του προϊόντος, σε μέγεθος που κανένας κανόνας
// δεν θα επέτρεπε αν ζούσε μέσα στην εφαρμογή.
// ΤΟ ΧΡΩΜΑ ΕΙΝΑΙ ΟΡΙΣΜΑ, ΩΣΤΕ ΝΑ ΜΗΝ ΞΑΝΑΓΡΑΦΕΤΑΙ Η ΕΤΙΚΕΤΑ. Εννέα edge
// functions έγραφαν δικό τους eyebrow με αντιγραμμένα στυλ· ο μόνος λόγος
// που δεν καλούσαν αυτό εδώ ήταν ότι μία από αυτές το θέλει κόκκινο. Το
// αποτέλεσμα: τρία διαφορετικά μεγέθη (10,5 · 11 · 11 με monospace) και ωμό
// ελληνικό λεκτικό κάτω από `text-transform:uppercase`, δηλαδή «ΛΗΞΙΠΡΌΘΕΣΜΟ
// ΕΝΟΊΚΙΟ» με τόνο, κάθε πρωί στις 06:00.
export const eyebrow = (text: string, color?: string): string =>
  `<p class="${color ? '' : 'ac'}" style="margin:0 0 7px;font-size:11px;color:${color || ACCENT};text-transform:uppercase;letter-spacing:0.09em;font-weight:700;mso-line-height-rule:exactly;line-height:16px;">${esc(grUp(text))}</p>`;
// Η ΚΟΥΚΙΔΑ ΚΑΘΕΤΑΙ ΣΤΗ ΜΕΣΗ ΤΗΣ ΠΡΩΤΗΣ ΣΕΙΡΑΣ, ΚΑΙ ΤΟ ΝΟΥΜΕΡΟ ΒΓΑΙΝΕΙ ΑΠΟ
// ΤΟ ΔΙΑΣΤΙΧΟ. Με ίδιο γέμισμα σε κουκκίδα και κείμενο, η κουκκίδα έπεφτε
// οκτώ εικονοστοιχεία ψηλότερα από τη γραμμή που σημαδεύει — φαινόταν να
// ανήκει στο κενό πάνω από αυτήν. Το κέντρο της πρώτης σειράς είναι
// 3 (γέμισμα) + 12 (μισό διάστιχο) = 15· μείον το μισό της κουκκίδας, 12.
export const bullets = (items: string[]): string =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 8px;">${items.map(it => `<tr><td style="vertical-align:top;padding:12px 12px 6px 0;width:6px;font-size:0;line-height:0;"><span class="dot" style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${ACCENT};"></span></td><td class="tx" style="font-size:15px;color:${TEXT};mso-line-height-rule:exactly;line-height:24px;padding:3px 0;">${it}</td></tr>`).join('')}</table>`;

// ═══ ΤΟ ΚΟΥΜΠΙ ΣΤΟ OUTLOOK ΗΤΑΝ ΟΡΘΟΓΩΝΙΟ ═════════════════════════════════
// Η μηχανή του Word αγνοεί `border-radius` και `padding` σε <a>: το κουμπί
// έβγαινε γωνιακό και με λάθος ύψος σε κάθε Outlook 2007–2021, δηλαδή στο
// μεγαλύτερο κομμάτι των επαγγελματικών παραληπτών. Το VML `roundrect`
// ζωγραφίζει το ίδιο σχήμα με τα δικά του εργαλεία και το βλέπει ΜΟΝΟ το
// Outlook· όλοι οι υπόλοιποι βλέπουν το <a> από κάτω.
export const button = (label: string, url: string): string =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 6px;"><tr><td>`
  + `<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${esc(url)}" style="height:46px;v-text-anchor:middle;width:220px;" arcsize="18%" stroke="f" fillcolor="${ACCENT}"><w:anchorlock/><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">${esc(label)}</center></v:roundrect><![endif]-->`
  + `<!--[if !mso]><!--><a class="btn" href="${esc(url)}" style="display:inline-block;background:${ACCENT};color:#ffffff;text-decoration:none;padding:13px 26px;border-radius:8px;font-weight:600;font-size:15px;mso-line-height-rule:exactly;line-height:20px;">${esc(label)}</a><!--<![endif]-->`
  + `</td></tr></table>`;
// Δύο ισότιμες πράξεις δίπλα δίπλα (π.χ. App Store · Google Play). Ξεχωριστή
// από το `button` γιατί το VML δεν στοιχίζει δύο roundrect σε μία σειρά χωρίς
// δικά τους κελιά — και επειδή εδώ καμία από τις δύο δεν είναι η κύρια.
export const buttonPair = (a: { label: string; url: string }, b: { label: string; url: string }): string => {
  const cell = (x: { label: string; url: string }, pad: string) =>
    `<td style="padding:${pad};">`
    + `<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${esc(x.url)}" style="height:46px;v-text-anchor:middle;width:150px;" arcsize="18%" stroke="f" fillcolor="${INK}"><w:anchorlock/><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">${esc(x.label)}</center></v:roundrect><![endif]-->`
    + `<!--[if !mso]><!--><a class="btn2" href="${esc(x.url)}" style="display:inline-block;background:${INK};color:#ffffff;text-decoration:none;padding:13px 22px;border-radius:8px;font-weight:600;font-size:15px;mso-line-height-rule:exactly;line-height:20px;">${esc(x.label)}</a><!--<![endif]-->`
    + `</td>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 6px;"><tr>${cell(a, '0 10px 0 0')}${cell(b, '0')}</tr></table>`;
};

// Δευτερεύουσα διαδρομή: κείμενο-σύνδεσμος κάτω από την κύρια πράξη.
export const linkLine = (label: string, url: string): string =>
  `<p style="margin:14px 0 0;"><a class="lnk" href="${esc(url)}" style="font-size:14px;color:${ACCENT};text-decoration:none;font-weight:600;">${esc(label)}</a></p>`;

export const note = (html: string): string =>
  `<p class="mu" style="margin:16px 0 0;font-size:13px;color:${MUTE};mso-line-height-rule:exactly;line-height:21px;">${html}</p>`;

// Λεπτή γραμμή. Την έγραφε καθεμία από τις εννέα functions με δικό της χρώμα.
export const divider = (margin = '22px 0'): string =>
  `<div class="rule" style="height:1px;background:${RULE};line-height:1px;font-size:0;margin:${margin};">&nbsp;</div>`;

// Τονισμένο κουτί (υπενθύμιση, προειδοποίηση, σύνοψη). Εννέα αντίγραφα του
// ίδιου σχήματος ζούσαν μέσα στις functions, με τρία διαφορετικά ραδιόσχημα.
export const callout = (html: string, tone: 'accent' | 'alert' = 'accent'): string => {
  const alert = tone === 'alert';
  const fill = alert ? 'rgba(217,48,37,.06)' : 'rgba(26,115,232,.06)';
  const edge = alert ? 'rgba(217,48,37,.24)' : 'rgba(26,115,232,.22)';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="${alert ? 'box-alert' : 'box'}" style="border-collapse:separate;background:${fill};border:1px solid ${edge};border-radius:10px;margin:0 0 18px;"><tr><td style="padding:15px 17px;">${html}</td></tr></table>`;
};

// Σειρά πίνακα: τίτλος + δεύτερη γραμμή αριστερά, ποσό δεξιά. Το ίδιο σχήμα
// χρησιμοποιούν υπενθυμίσεις, καταστάσεις, ημερολόγιο και ειδοποιήσεις.
// ΤΟ ΠΟΣΟ ΣΤΟΙΧΙΖΕΤΑΙ ΜΕ ΤΟΝ ΤΙΤΛΟ, ΟΧΙ ΜΕ ΤΟ ΚΕΝΤΡΟ ΤΗΣ ΣΕΙΡΑΣ. Με
// `vertical-align:middle` το ποσό έπεφτε ανάμεσα στις δύο αριστερές γραμμές,
// δηλαδή σε καμία από τις δύο: η στήλη των αριθμών διαβαζόταν μισή σειρά πιο
// χαμηλά από τη στήλη των ονομάτων. Πάνω, με το ΙΔΙΟ διάστιχο, οι δύο βάσεις
// πέφτουν η μία στην άλλη και η σειρά διαβάζεται σαν γραμμή λογαριασμού.
export const dataRow = (title: string, meta: string, right: string): string =>
  `<tr>`
  + `<td class="rule-b" style="padding:11px 0;border-bottom:1px solid ${RULE};vertical-align:top;">`
  + `<span class="ink" style="display:block;font-size:14px;color:${INK};font-weight:600;mso-line-height-rule:exactly;line-height:20px;">${esc(title)}</span>`
  + (meta ? `<span class="fa" style="display:block;font-size:12px;color:${FAINT};mso-line-height-rule:exactly;line-height:18px;">${esc(meta)}</span>` : '')
  + `</td>`
  + `<td class="rule-b" style="padding:11px 0;border-bottom:1px solid ${RULE};text-align:right;vertical-align:top;">`
  + `<span class="ink" style="font-size:14px;color:${INK};font-weight:600;mso-line-height-rule:exactly;line-height:20px;">${right}</span>`
  + `</td></tr>`;
export const dataTable = (rows: string): string =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 6px;">${rows}</table>`;
// Οπτικό «ήρωας»: ένα μεγάλο νούμερο (ποσό, ποσοστό, πληρότητα). Email-safe (table +
// inline styles, χωρίς εικόνες/SVG), δουλεύει παντού, με premium fintech αίσθηση.
export const heroStat = (value: string, label: string): string =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:2px 0 22px;">`
  + `<tr><td style="padding:2px 0 0;">`
  + `<div class="ink" style="font-size:40px;mso-line-height-rule:exactly;line-height:44px;font-weight:700;color:${INK};letter-spacing:-1.2px;">${esc(value)}</div>`
  + `<div class="fa" style="font-size:11px;color:${FAINT};text-transform:uppercase;letter-spacing:.1em;margin-top:7px;font-weight:700;mso-line-height-rule:exactly;line-height:16px;">${esc(grUp(label))}</div>`
  + `</td></tr></table>`;
// Μόνο το μικρό όνομα (πιο ζεστό): «Μαρία Παπαδοπούλου» → «Μαρία».
export const firstNameOf = (name?: string): string => (name || '').trim().split(/\s+/)[0] || '';
export const greeting = (name?: string): string => {
  const f = firstNameOf(name);
  return p(`Γεια σου${f ? ` <b>${esc(f)}</b>` : ''},`);
};

/**
 * Η ΚΕΦΑΛΙΔΑ ΤΟΥ ΜΗΝΥΜΑΤΟΣ, ΜΙΑ ΦΟΡΑ.
 *
 * Ηταν γραμμένη δέκα φορές: εδώ και σε εννέα συναρτήσεις άκρης που φτιάχνουν
 * δικό τους HTML αντί να καλέσουν το κέλυφος. Και τα δέκα αντίγραφα είχαν
 * ξεφύγει μεταξύ τους σε μέγεθος πλακιδίου (34 ή 36), σε χρώμα κειμένου (#111
 * ή #202124) και στον τρόπο που άφηναν το κενό (gap ή margin-left).
 *
 * Στη μετονομασία σε PROPERWISE φάνηκε τι κοστίζει: το παλιό σήμα έμεινε και
 * στα δέκα, δηλαδή κάθε email έφευγε με το προηγούμενο λογότυπο δίπλα στο
 * καινούριο όνομα και χρειάστηκε να βρεθούν ένα ένα.
 */
export const emailHeader = (): string =>
  `<a href="${APP_URL}" style="text-decoration:none;display:inline-block;line-height:1;">`
  + `<img class="logo-light" src="${APP_URL}/brand/properwise-logotypo-skouro.png" alt="PROPERWISE" height="26" style="display:block;border:0;outline:none;text-decoration:none;height:26px;width:auto;">`
  + `<img class="logo-dark" src="${APP_URL}/brand/properwise-logotypo-lefko.png" alt="PROPERWISE" height="26" style="display:none;border:0;outline:none;text-decoration:none;height:26px;width:auto;">`
  + `</a>`
  + divider('20px 0 0');

// ── ΤΟ ΣΗΜΑ ΣΤΟ EMAIL: ΤΟ ΛΟΓΟΤΥΠΟ ΩΣ ΕΙΚΟΝΑ ─────────────────────────────────
// Επί μήνες εδώ ζούσε ΜΟΝΟ η λέξη «PROPERWISE» — όχι από τεμπελιά. Το
// ενσωματωμένο SVG το αφαιρεί το Gmail· μια εικόνα πάλι θέλει διεύθυνση που
// απαντά, τομέας όμως δεν είχε αγοραστεί ακόμη. Τώρα υπάρχει (properwise.gr),
// οπότε το λογότυπο επιστρέφει ΩΣ ΕΙΚΟΝΑ, φιλοξενούμενη στο ίδιο site
// (public/brand), όπως ήδη κάνει το email επιβεβαίωσης παραλαβής.
//
// ΔΥΟ ΕΚΔΟΧΕΣ, ΓΙΑ ΦΩΤΕΙΝΟ ΚΑΙ ΓΙΑ ΣΚΟΤΕΙΝΟ. Το κέλυφος γυρίζει σε σκούρο φόντο
// στο dark mode («.bg»), οπότε ένα σκούρο σήμα θα χανόταν. Η «logo-light» (σκούρο
// λογότυπο) δείχνει στο φωτεινό· η «logo-dark» (λευκό) στο σκοτεινό — με τον ΙΔΙΟ
// μηχανισμό (prefers-color-scheme + [data-ogsc]) που αλλάζει ήδη τα χρώματα. Το
// alt=«PROPERWISE» μένει ως εφεδρεία όταν ο παραλήπτης μπλοκάρει τις εικόνες.
// ── Το ΜΟΝΑΔΙΚΟ branded κέλυφος ──────────────────────────────────────────────
export function emailShell(opts: {
  bodyHtml: string; preheader?: string; unsubUrl?: string; footerNote?: string; hero?: string; width?: number;
}): string {
  const w = opts.width || WIDTH;
  // ΤΟ ΠΡΟΘΕΜΑ ΕΙΝΑΙ Η ΔΕΥΤΕΡΗ ΓΡΑΜΜΗ ΣΤΗ ΛΙΣΤΑ, ΚΑΙ ΗΤΑΝ ΑΓΕΜΙΣΤΗ. Χωρίς
  // γέμισμα, ο πελάτης αλληλογραφίας τραβά ό,τι βρει μετά — δηλαδή τη λέξη
  // PROPERWISE και το κείμενο του υποσέλιδου — και τα κολλά στην προεπισκόπηση.
  const pre = opts.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${esc(opts.preheader)}${'&#847;&zwnj;&nbsp;'.repeat(10)}</div>`
    : '';
  const foot = opts.unsubUrl
    ? `Λαμβάνεις αυτό το email ως χρήστης του PROPERWISE. <a class="lnk" href="${esc(opts.unsubUrl)}" style="color:${MUTE};text-decoration:underline;">Απεγγραφή</a>`
    : (opts.footerNote || 'properwise.gr');
  return `<!DOCTYPE html>
<html lang="el" dir="ltr" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<!--[if gte mso 9]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
<!--[if mso]><style type="text/css">body,table,td,a,p,div,span{font-family:Arial,Helvetica,sans-serif !important;}</style><![endif]-->
<style type="text/css">
:root{color-scheme:light dark;supported-color-schemes:light dark;}
body{margin:0;padding:0;width:100% !important;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
table{border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;}
a{text-decoration:none;}
img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;}
.logo-dark{display:none;}
@media (prefers-color-scheme:dark){
 .logo-light{display:none !important;}
 .logo-dark{display:block !important;}
 .bg{background:#16181c !important;}
 .ink{color:#f2f3f5 !important;}
 .tx{color:#c2c7cd !important;}
 .mu{color:#9aa1a9 !important;}
 .fa{color:#767c84 !important;}
 .ac,.lnk{color:#6ba6f5 !important;}
 .rule{background:#2b2f35 !important;}
 .rule-b{border-bottom-color:#2b2f35 !important;}
 .rule-t{border-top-color:#2b2f35 !important;}
 .btn{background:#2f80ed !important;color:#ffffff !important;}
 .btn2{background:#f2f3f5 !important;color:#16181c !important;}
 .neg{color:#f28b82 !important;}
 .pos{color:#81c995 !important;}
 .box{background:rgba(107,166,245,.10) !important;border-color:rgba(107,166,245,.26) !important;}
 .box-alert{background:rgba(242,139,130,.10) !important;border-color:rgba(242,139,130,.28) !important;}
}
[data-ogsc] .logo-light{display:none !important;}
[data-ogsc] .logo-dark{display:block !important;}
[data-ogsc] .ink{color:#f2f3f5 !important;}
[data-ogsc] .tx{color:#c2c7cd !important;}
[data-ogsc] .mu{color:#9aa1a9 !important;}
[data-ogsc] .fa{color:#767c84 !important;}
[data-ogsc] .ac,[data-ogsc] .lnk{color:#6ba6f5 !important;}
[data-ogsc] .neg{color:#f28b82 !important;}
[data-ogsc] .pos{color:#81c995 !important;}
[data-ogsb] .bg{background:#16181c !important;}
[data-ogsb] .rule{background:#2b2f35 !important;}
[data-ogsb] .btn{background:#2f80ed !important;}
[data-ogsb] .btn2{background:#f2f3f5 !important;}
[data-ogsc] .btn2{color:#16181c !important;}
@media only screen and (max-width:480px){
 .pad{padding-left:20px !important;padding-right:20px !important;}
 .h1{font-size:20px !important;line-height:27px !important;}
}
</style>
</head>
<body class="bg" style="margin:0;padding:0;background:#ffffff;">${pre}
<table role="presentation" class="bg" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;">
<tr><td align="center" class="pad" style="padding:44px 24px 52px;">
<!--[if mso]><table role="presentation" width="${w}" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:${w}px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<tr><td>${emailHeader()}</td></tr>
<tr><td style="padding:30px 0 0;">${opts.hero || ''}${opts.bodyHtml}</td></tr>
<tr><td style="padding:28px 0 0;">${divider('0 0 14px')}<p class="fa" style="margin:0;font-size:12px;color:${FAINT};mso-line-height-rule:exactly;line-height:19px;">${foot}</p></td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table>
</body></html>`;
}

export interface Ctx { name?: string; appUrl?: string; unsubUrl?: string }

// Πλούσιο πλαίσιο εξατομίκευσης: ό,τι μοναδικό δεδομένο του χρήστη μπορεί να
// μπει ζωντανά στο κείμενο (το γεμίζει η send-lifecycle-email ανά χρήστη).
export interface Personal extends Ctx {
  plan?: Plan;
  properties?: number;       // πλήθος ακινήτων
  propertyName?: string;     // όνομα ακινήτου
  period?: string;           // ετικέτα περιόδου, π.χ. «Ιούλιος 2026»
  collected?: number;        // εισπράξεις περιόδου, σε EUR
  expected?: number;         // αναμενόμενα περιόδου, σε EUR
  outstanding?: number;      // ανείσπρακτα, σε EUR
  net?: number;              // καθαρό αποτέλεσμα, σε EUR
  amount?: number;           // ποσό μεμονωμένης δόσης, σε EUR
  tenantName?: string;       // όνομα ενοικιαστή
  daysOverdue?: number;      // μέρες καθυστέρησης
  deadlineDate?: string;     // ημερομηνία προθεσμίας, π.χ. «31/08»
  installmentNo?: number;    // αριθμός τρέχουσας δόσης (π.χ. ΕΝΦΙΑ 4/12)
  installmentsTotal?: number;// συνολικός αριθμός δόσεων
  portfolioValue?: number;   // αξία χαρτοφυλακίου, σε EUR
  occupancy?: number;        // πληρότητα, %
  days?: number;             // μέρες από την εγγραφή
  assistantName?: string;    // όνομα βοηθού, αν έχει οριστεί
  // Upsell / εποχικά / lifecycle
  discountPct?: number;      // ποσοστό έκπτωσης· γράφεται ΜΟΝΟ μαζί με `discountCode`
  discountCode?: string;     // ο κωδικός που εφαρμόζει την έκπτωση στο ταμείο
  trialDaysLeft?: number;    // μέρες που απομένουν στη δοκιμή
  daysLeft?: number;         // μέρες που απομένουν σε προθεσμία (π.χ. πριν τη διαγραφή λογαριασμού)
  invoiceAmount?: number;    // ποσό παραστατικού, σε EUR
  invoiceNumber?: string;    // αριθμός παραστατικού
  referralCode?: string;     // κωδικός σύστασης
  rewardLabel?: string;      // ετικέτα ανταμοιβής
  friendName?: string;       // όνομα προσκεκλημένου
  device?: string;           // συσκευή σύνδεσης
  location?: string;         // τοποθεσία σύνδεσης
  headline?: string;         // τίτλος (π.χ. νομοθεσία)
  summaryText?: string;      // περίληψη (π.χ. νομοθεσία, changelog, roadmap)
  // Λειτουργικά ακινήτου (operations)
  leaseEndDate?: string;     // λήξη μίσθωσης
  insurerName?: string;      // ασφαλιστική εταιρεία
  policyEndDate?: string;    // λήξη ασφαλιστηρίου
  certificateName?: string;  // όνομα πιστοποιητικού (π.χ. ΠΕΑ)
  certificateEndDate?: string; // λήξη πιστοποιητικού
  appointmentTitle?: string; // τίτλος ραντεβού/εκδήλωσης
  appointmentDate?: string;  // ημερομηνία ραντεβού
  appointmentTime?: string;  // ώρα ραντεβού
  maintenanceTitle?: string; // περιγραφή εργασίας συντήρησης
  maintenanceDate?: string;  // ημερομηνία συντήρησης
  contractorName?: string;   // όνομα συνεργάτη/συνεργείου
  billType?: string;         // είδος λογαριασμού (π.χ. ΔΕΗ, νερό)
  billDueDate?: string;      // προθεσμία λογαριασμού
  // Βραχυχρόνια μίσθωση (short-term operations)
  guestName?: string;        // όνομα επισκέπτη
  checkinDate?: string;      // ημερομηνία άφιξης
  checkoutDate?: string;     // ημερομηνία αναχώρησης
  cleaningDate?: string;     // ημερομηνία καθαρισμού
  gapNights?: number;        // κενές νύχτες
  gapFrom?: string;          // αρχή κενού διαστήματος
  gapTo?: string;            // τέλος κενού διαστήματος
  reviewsCount?: number;     // πλήθος αξιολογήσεων
  rating?: number;           // μέση βαθμολογία
  // Προϊόν / εξέλιξη / αξία (product, evolution, value)
  featureName?: string;      // όνομα νέας δυνατότητας
  featureBenefit?: string;   // όφελος νέας δυνατότητας
  assistantSkill?: string;   // νέα ικανότητα του βοηθού
  anniversaryYears?: number; // χρόνια συνεργασίας
  hoursSaved?: number;       // ώρες που εξοικονομήθηκαν
  // Πύλη λογιστή: ο πελάτης απάντησε σε αίτημα του λογιστή του
  clientName?: string;       // όνομα του ιδιοκτήτη, όπως τον ξέρει ο λογιστής
  requestItem?: string;      // τι ακριβώς είχε ζητηθεί
  // Συνδρομή / σχέσεις / benchmarking
  cardLast4?: string;        // τελευταία ψηφία κάρτας
  marketRent?: number;       // μέσο ενοίκιο αγοράς, σε EUR
  sharePct?: number;         // ποσοστό συνιδιοκτησίας
  // Ενοποιημένα (digests): όταν πολλά μηνύματα της ίδιας μέρας συγχωνεύονται σε ένα,
  // ο scheduler περνά εδώ τη λίστα των θεμάτων (τίτλος + σύντομη λεπτομέρεια).
  digestItems?: Array<{ title: string; detail?: string }>;
  // Φύλο παραλήπτη/ενοικιαστή (από το όνομα, βλ. gender.ts) ώστε το κείμενο να
  // απευθύνεται σωστά· 'unknown' → ουδέτερη, πάντα ασφαλής διατύπωση.
  gender?: 'male' | 'female' | 'unknown';
  tenantGender?: 'male' | 'female' | 'unknown';
}

// Επιλογή σωστού τύπου ανά φύλο· άγνωστο → ουδέτερο (ασφαλές).
export const gv = (g: 'male' | 'female' | 'unknown' | undefined, forms: { m: string; f: string; n: string }): string =>
  g === 'male' ? forms.m : g === 'female' ? forms.f : forms.n;
type Out = { subject: string; html: string };
const app = (c: Ctx) => c.appUrl || DEFAULT_APP;

// ── LIFECYCLE ────────────────────────────────────────────────────────────────

/** Καλωσόρισμα μετά την εγγραφή · segmented ανά πακέτο. */
export function welcomeEmail(c: Ctx & { plan?: Plan }): Out {
  const plan = c.plan || 'free';
  const next: Record<Plan, string[]> = {
    free: ['Πρόσθεσε το πρώτο σου ακίνητο σε 2 λεπτά.', 'Δες αυτόματα έσοδα, έξοδα και φόρους.', 'Ρώτα τη Νόα για τα ακίνητά σου.'],
    individual: ['Κατέγραψε ακίνητα, ενοικιαστές και εισπράξεις.', 'Βγάλε επίσημες καταστάσεις και βεβαιώσεις ενοικίου.', 'Άφησε τις υπενθυμίσεις να τρέχουν μόνες τους.'],
    professional: ['Διαχειρίσου χαρτοφυλάκιο πολλών ακινήτων.', 'Branded αναφορές και μαζική επικοινωνία πελατών.', 'Λογιστικά, φόροι και ροές εργασίας για όλο το χαρτοφυλάκιο.'],
  };
  const body = eyebrow('Καλωσόρισες') + h('Ξεκίνα με το PROPERWISE')
    + greeting(c.name)
    + p('Χαιρόμαστε που είσαι μαζί μας. Να τα πρώτα βήματα για να πάρεις αξία από την πρώτη μέρα:')
    + bullets(next[plan])
    + button('Άνοιξε τον πίνακα', `${app(c)}/dashboard`)
    + note('Είμαστε εδώ για ό,τι χρειαστείς. Απάντησε απευθείας σε αυτό το email.');
  return { subject: 'Καλωσόρισες στο PROPERWISE', html: emailShell({ bodyHtml: body, preheader: 'Τα πρώτα βήματα για να ξεκινήσεις.' }) };
}

/** Αναβάθμιση συνδρομής · ευχαριστία + τι ξεκλείδωσε. */
export function planUpgradedEmail(c: Ctx & { plan: Plan }): Out {
  const perks: Record<Plan, string[]> = {
    free: ['Πρόσβαση στις βασικές λειτουργίες.'],
    individual: ['Απεριόριστες καταστάσεις και βεβαιώσεις ενοικίου.', 'Αυτόματες υπενθυμίσεις και ειδοποιήσεις.', 'Επίσημες, επαληθεύσιμες αναφορές PDF.'],
    professional: ['Χαρτοφυλάκιο πολλών ακινήτων χωρίς όριο.', 'Branded αναφορές και μαζικό email πελατών.', 'Προτεραιότητα στην υποστήριξη.'],
  };
  const body = eyebrow('Αναβάθμιση') + h(`Είσαι πλέον ${PLAN_LABEL[c.plan]}`)
    + greeting(c.name)
    + p('Ευχαριστούμε για την εμπιστοσύνη. Μόλις ξεκλείδωσες:')
    + bullets(perks[c.plan])
    + button('Δες τι νέο έχεις', `${app(c)}/dashboard`)
    + note('Η απόδειξη της συνδρομής σου είναι διαθέσιμη στις Ρυθμίσεις, στη Συνδρομή.');
  return { subject: `Καλωσόρισες στο πακέτο ${PLAN_LABEL[c.plan]}`, html: emailShell({ bodyHtml: body, preheader: 'Ευχαριστούμε · να τι ξεκλείδωσες.' }) };
}

/** Υποβάθμιση/λήξη συνδρομής · ευγενικό, χωρίς πίεση, με πόρτα επιστροφής. */
export function planDowngradedEmail(c: Ctx & { plan: Plan }): Out {
  const body = eyebrow('Αλλαγή πακέτου') + h(`Το πακέτο σου είναι τώρα ${PLAN_LABEL[c.plan]}`)
    + greeting(c.name)
    + p('Καταγράψαμε την αλλαγή στο πακέτο σου. Τα δεδομένα σου παραμένουν ασφαλή και δικά σου · τίποτα δεν χάνεται.')
    + p('Αν κάτι δεν πήγε όπως περίμενες ή θέλεις να επιστρέψεις σε περισσότερες δυνατότητες, είμαστε ένα κλικ μακριά.')
    + button('Διαχείριση συνδρομής', `${app(c)}/dashboard`)
    + note('Θα χαρούμε πολύ να ακούσουμε τη γνώμη σου · απάντησε και πες μας τι θα σε βοηθούσε.');
  return { subject: 'Ενημέρωση για τη συνδρομή σου', html: emailShell({ bodyHtml: body, preheader: 'Τα δεδομένα σου παραμένουν ασφαλή.' }) };
}

/** Προστέθηκε νέο ακίνητο · επιβεβαίωση + επόμενες κινήσεις. */
export function newPropertyEmail(c: Ctx & { propertyName: string }): Out {
  const body = eyebrow('Νέο ακίνητο') + h('Το ακίνητο προστέθηκε')
    + greeting(c.name)
    + p(`Το <b>${esc(c.propertyName)}</b> είναι πλέον στο χαρτοφυλάκιό σου. Για να δουλέψει «μόνο του», ολοκλήρωσε:`)
    + bullets(['Στοιχεία μίσθωσης και ενοικιαστή.', 'Έσοδα/έξοδα για αυτόματη λογιστική.', 'Υπενθυμίσεις για πληρωμές και λήξεις.'])
    + button('Άνοιξε το ακίνητο', `${app(c)}/dashboard`);
  return { subject: `Προστέθηκε: ${c.propertyName}`, html: emailShell({ bodyHtml: body, preheader: 'Ολοκλήρωσε τις ρυθμίσεις του ακινήτου.' }) };
}

/** Feedback μετά ~1 εβδομάδα χρήσης · ζεστό, σύντομο, χωρίς πίεση. */
export function feedbackRequestEmail(c: Ctx): Out {
  const body = eyebrow('Η γνώμη σου μετράει') + h('Πώς πάει μέχρι τώρα;')
    + greeting(c.name)
    + p('Πέρασε περίπου μία εβδομάδα με το PROPERWISE. Θα εκτιμούσαμε πολύ 30 δευτερόλεπτα από τον χρόνο σου: τι σου άρεσε, τι σε δυσκόλεψε, τι λείπει;')
    + p('Διαβάζουμε <b>κάθε</b> απάντηση · και χτίζουμε το προϊόν με βάση αυτά που μας λες.')
    + button('Πες μας τη γνώμη σου', `${app(c)}/dashboard`)
    + note('Απλώς απάντησε σε αυτό το email · φτάνει κατευθείαν σε εμάς.');
  return { subject: 'Πώς σου φαίνεται το PROPERWISE;', html: emailShell({ bodyHtml: body, preheader: '30 δευτερόλεπτα που μας βοηθούν πολύ.' }) };
}

/** Ανακοίνωση mobile app. */
export function mobileLaunchEmail(c: Ctx): Out {
  const body = eyebrow('Έρχεται') + h('Το PROPERWISE στο κινητό σου')
    + greeting(c.name)
    + p('Ετοιμάζουμε την εφαρμογή για κινητά · τα ακίνητά σου, οι εισπράξεις και οι ειδοποιήσεις στην τσέπη σου, όπου κι αν είσαι.')
    + bullets(['Ειδοποιήσεις σε πραγματικό χρόνο.', 'Γρήγορη καταχώρηση εσόδων/εξόδων.', 'Σάρωση εγγράφων με ένα tap.'])
    + button('Μπες στη λίστα αναμονής', `${app(c)}/dashboard`)
    + note('Θα είσαι από τους πρώτους που θα ειδοποιήσουμε μόλις είναι έτοιμη.');
  return { subject: 'Το PROPERWISE έρχεται στο κινητό', html: emailShell({ bodyHtml: body, preheader: 'Μπες νωρίς στη λίστα αναμονής.' }) };
}

/** Πρόσκληση στο Referral program. */
export function referralInviteEmail(c: Ctx): Out {
  const body = eyebrow('Referral') + h('Κέρδισε προτείνοντας το PROPERWISE')
    + greeting(c.name)
    + p('Ξέρεις κάποιον με ακίνητα; Πρότεινέ του το PROPERWISE και <b>κερδίζεις με κάθε ενεργή σύσταση</b>.')
    + bullets(['Μοναδικός σύνδεσμος πρόσκλησης, δικός σου.', 'Ανταμοιβή για κάθε ενεργό φίλο που φέρνεις.', 'Παρακολούθηση προσκλήσεων και ανταμοιβών live.'])
    + button('Δες το πρόγραμμα', `${app(c)}/dashboard`);
  return { subject: 'Πρότεινε το PROPERWISE και κέρδισε', html: emailShell({ bodyHtml: body, preheader: 'Με κάθε ενεργή σύσταση κερδίζεις.' }) };
}

/** Upsell δωρεάν → paid, με προαιρετική έκπτωση/εποχή. */
export function upsellEmail(c: Ctx & { toPlan?: Plan; discountPct?: number; discountCode?: string; seasonLabel?: string }): Out {
  const to = c.toPlan || 'individual';
  // ΕΚΠΤΩΣΗ ΧΩΡΙΣ ΚΩΔΙΚΟ ΔΕΝ ΥΠΑΡΧΕΙ. Το ταμείο εφαρμόζει έκπτωση μόνο με
  // κωδικό· ένα ποσοστό χωρίς αυτόν ήταν υπόσχεση που κανένα κουμπί δεν τηρούσε.
  const code = (c.discountCode || '').trim();
  const disc = code && c.discountPct && c.discountPct > 0 ? c.discountPct : 0;
  const seasonLine = c.seasonLabel ? ` <b>${esc(c.seasonLabel)}</b>` : '';
  const body = eyebrow(disc ? `Προσφορά${seasonLine ? ' ·' : ''}${seasonLine}` : 'Αναβάθμιση')
    + h(disc ? `${disc}% έκπτωση στο πακέτο ${PLAN_LABEL[to]}` : `Ξεκλείδωσε το πακέτο ${PLAN_LABEL[to]}`)
    + greeting(c.name)
    + p(`Κάνεις ήδη ωραία δουλειά στη δωρεάν δοκιμή. Με το <b>${PLAN_LABEL[to]}</b> κερδίζεις χρόνο και σιγουριά:`)
    + bullets(to === 'professional'
        ? ['Απεριόριστα ακίνητα και branded αναφορές.', 'Μαζική επικοινωνία πελατών.', 'Προτεραιότητα στην υποστήριξη.']
        : ['Απεριόριστες καταστάσεις και βεβαιώσεις.', 'Αυτόματες υπενθυμίσεις πληρωμών.', 'Επίσημες αναφορές PDF με QR επαλήθευσης.'])
    + (disc ? p(`Γράψε τον κωδικό <b>${esc(code)}</b> στο ταμείο και η έκπτωση εφαρμόζεται στη χρέωση.`) : '')
    + button(disc ? `Κλείσε το ${disc}%` : 'Αναβάθμισε τώρα', `${app(c)}/dashboard`)
    + note('Ακύρωση όποτε θες · χωρίς δεσμεύσεις.');
  const subj = disc ? `${disc}% έκπτωση${c.seasonLabel ? ` · ${c.seasonLabel}` : ''} στο PROPERWISE` : `Αναβάθμισε στο πακέτο ${PLAN_LABEL[to]}`;
  return { subject: subj, html: emailShell({ bodyHtml: body, preheader: disc ? `Ξεκλείδωσε το ${PLAN_LABEL[to]} με έκπτωση.` : 'Περισσότερος χρόνος, λιγότερος κόπος.' }) };
}

/** Ενημέρωση αλλαγής νομοθεσίας ακινήτων · brand awareness + χρησιμότητα. */
export function legislationUpdateEmail(c: Ctx & { headline: string; summaryHtml: string }): Out {
  const body = eyebrow('Νομοθεσία ακινήτων') + h(esc(c.headline))
    + greeting(c.name)
    + p(c.summaryHtml)
    + p('Το PROPERWISE ενημερώνεται συνεχώς ώστε τα ακίνητά σου να είναι <b>πάντα σε τάξη</b> · εύκολα, γρήγορα, σωστά. Τώρα είναι η καλύτερη στιγμή να το ελέγξεις.')
    + button('Βάλε το ακίνητό σου σε τάξη', `${app(c)}/dashboard`)
    + note('Ενημερωτικό, με επίσημες πηγές. Για την τελική εφαρμογή, επιβεβαίωσε με τον λογιστή σου ή στο myAADE/gov.gr.');
  return { subject: `PROPERWISE · ${c.headline}`, html: emailShell({ bodyHtml: body, preheader: 'Τι αλλάζει και τι πρέπει να κάνεις.' }) };
}

// ── ΕΠΟΧΙΚΕΣ ΚΑΜΠΑΝΙΕΣ ────────────────────────────────────────────────────────
export type Season = 'black_friday' | 'cyber_monday' | 'christmas' | 'new_year';
export const SEASONS: Record<Season, { label: string; hook: string }> = {
  black_friday: { label: 'Black Friday', hook: 'Η μεγαλύτερη προσφορά της χρονιάς.' },
  cyber_monday: { label: 'Cyber Monday', hook: 'Μια μέρα, μια ευκαιρία.' },
  christmas:    { label: 'Χριστούγεννα', hook: 'Κλείσε τη χρονιά με τα ακίνητά σου σε τάξη.' },
  new_year:     { label: 'Πρωτοχρονιά',  hook: 'Νέα χρονιά, καθαρά βιβλία.' },
};

/** Εποχική καμπάνια (τυποποιημένη) · χτίζει πάνω στο upsell με εποχικό πλαίσιο. */
export function seasonalCampaignEmail(c: Ctx & { season: Season; toPlan?: Plan; discountPct?: number; discountCode?: string }): Out {
  const s = SEASONS[c.season];
  return upsellEmail({ ...c, seasonLabel: s.label, toPlan: c.toPlan });
}
