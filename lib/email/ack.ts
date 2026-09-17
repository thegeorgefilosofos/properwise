// ═══════════════════════════════════════════════════════════════════════════
// Η ΕΠΩΝΥΜΗ ΕΠΙΒΕΒΑΙΩΣΗ ΠΑΡΑΛΑΒΗΣ (reply_ack)
// ─────────────────────────────────────────────────────────────────────────
// Ενα συναλλακτικό μήνυμα, όχι marketing: «το λάβαμε, θα σου απαντήσουμε». Δεν
// έχει απεγγραφή γιατί δεν είναι καμπάνια — είναι απάντηση σε δικό σου μήνυμα.
//
// ── ΤΡΕΙΣ ΑΠΟΦΑΣΕΙΣ ───────────────────────────────────────────────────────
//
// ΤΟ ΟΝΟΜΑ ΔΙΑΦΕΥΓΕΙ ΠΑΝΤΑ. Μπαίνει από λογαριασμό χρήστη, δηλαδή από δεδομένο
// που κάποιος έγραψε: χωρίς escape, ένα όνομα με «<» θα άνοιγε ετικέτα μέσα στο
// μήνυμα. Οταν λείπει, η προσφώνηση γίνεται «Γεια σου,» — ποτέ ψεύτικο όνομα.
//
// ΚΑΜΙΑ ΠΑΥΛΑ, ΠΟΥΘΕΝΑ. Το κείμενο γράφεται με τελείες και άνω τελείες, όπως
// κάθε ελληνικό κείμενο του προϊόντος· η μεγάλη παύλα είναι υπογραφή μηχανής.
//
// ΠΙΝΑΚΕΣ ΚΑΙ INLINE STYLES. Οι πελάτες αλληλογραφίας αγνοούν <style> και
// σύγχρονη διάταξη. Το κέλυφος είναι πίνακας, τα χρώματα inline, το πλάτος
// κλειδωμένο στα 600 ώστε να διαβάζεται και σε κινητό.
// ═══════════════════════════════════════════════════════════════════════════

// Τα σημάδια του brand, όπως στην υπόλοιπη επικοινωνία: navy κεφαλής, μπλε
// accent, μελάνι για τους τίτλους, γκρι για το σώμα, αχνό για τη γραμμή.
import { IDENTITY } from '@/lib/legal/identity';
import { siteUrl } from '@/lib/core/site';

const NAVY = '#0b1b33';
const ACCENT = '#1a73e8';
const INK = '#1d1d1f';
const TEXT = '#454a51';
const MUTE = '#8a9099';
const RULE = '#e9eaee';

// Το λογότυπο είναι στατικό αρχείο της ίδιας εφαρμογής (public/brand), οπότε η
// διεύθυνσή του βγαίνει από τη μία πηγή του site — σε παραγωγή δίνει το
// φιλοξενούμενο properwise.gr/brand/…, χωρίς δεύτερη γραφή του domain.
const WORDMARK = siteUrl('/brand/properwise-logotypo-skouro.png');

/** Σβήνει τους χαρακτήρες που θα σήμαιναν σήμανση μέσα στο μήνυμα. */
const esc = (v: string): string =>
  String(v ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

/** Μια παράγραφος σώματος, τυποποιημένη. */
const para = (html: string): string =>
  `<p style="margin:0 0 16px;font-size:15px;color:${TEXT};mso-line-height-rule:exactly;line-height:25px;">${html}</p>`;

/**
 * Το θέμα και το HTML της επιβεβαίωσης παραλαβής.
 *
 * @param name Το όνομα του παραλήπτη, ήδη σε καθαρή μορφή· κενό όταν άγνωστο.
 */
export function replyAckEmail(name: string): { subject: string; html: string } {
  const subject = 'PROPERWISE | Λάβαμε το μήνυμά σου';

  const clean = (name || '').trim();
  const greeting = clean
    ? `Γεια σου <b>${esc(clean)}</b>,`
    : 'Γεια σου,';

  const preheader = 'Λάβαμε το μήνυμά σου και θα σου απαντήσουμε το συντομότερο.';

  const html = `<!DOCTYPE html>
<html lang="el">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;color:#f4f5f7;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:#f4f5f7;">
<tr>
<td align="center" style="padding:24px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;max-width:600px;background:#ffffff;border:1px solid ${RULE};border-radius:12px;overflow:hidden;">
<tr>
<td style="padding:24px 32px;border-bottom:1px solid ${RULE};">
<a href="${esc(siteUrl(''))}" style="text-decoration:none;color:${NAVY};font-size:20px;font-weight:700;letter-spacing:0.14em;">
<img src="${WORDMARK}" alt="PROPERWISE" height="26" style="display:block;border:0;outline:none;text-decoration:none;height:26px;">
</a>
</td>
</tr>
<tr>
<td style="padding:32px 32px 28px;">
<p style="margin:0 0 18px;font-size:17px;color:${INK};font-weight:600;mso-line-height-rule:exactly;line-height:24px;">${greeting}</p>
${para('Λάβαμε το μήνυμά σου και σε ευχαριστούμε που επικοινώνησες μαζί μας.')}
${para('Ένα μέλος της ομάδας μας θα το εξετάσει προσεκτικά και θα σου απαντήσει το συντομότερο δυνατό. Δεν χρειάζεται να κάνεις κάτι άλλο· θα επικοινωνήσουμε εμείς μαζί σου.')}
${para('Σε ευχαριστούμε που εμπιστεύεσαι το PROPERWISE για τη διαχείριση των ακινήτων σου.')}
<p style="margin:24px 0 0;font-size:15px;color:${TEXT};mso-line-height-rule:exactly;line-height:25px;">Με εκτίμηση,<br><b style="color:${INK};">Η ομάδα του PROPERWISE</b></p>
</td>
</tr>
<tr>
<td style="padding:18px 32px 24px;border-top:1px solid ${RULE};">
<p style="margin:0;font-size:12px;color:${MUTE};mso-line-height-rule:exactly;line-height:18px;">Αυτοματοποιημένη επιβεβαίωση παραλαβής. Μπορείς να απαντήσεις σε αυτό το email και θα φτάσει στην ομάδα μας.</p>
<p style="margin:8px 0 0;font-size:12px;color:${MUTE};mso-line-height-rule:exactly;line-height:18px;"><a href="mailto:${esc(IDENTITY.supportEmail)}" style="color:${ACCENT};text-decoration:none;">${esc(IDENTITY.supportEmail)}</a></p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;

  return { subject, html };
}
