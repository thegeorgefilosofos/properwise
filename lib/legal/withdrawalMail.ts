// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΑΠΟΔΕΙΚΤΙΚΟ ΤΗΣ ΥΠΑΝΑΧΩΡΗΣΗΣ ΚΑΙ Η ΔΙΑΒΙΒΑΣΗ ΤΗΣ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΑΠΟΔΕΙΚΤΙΚΟ. Το άρθ. 11α§4 της Οδηγίας 2011/83/ΕΕ (Οδηγία (ΕΕ)
// 2023/2673· στην Ελλάδα άρθ. 3ζα ν. 2251/1994, docs/legal/ypanaxorisi.md) ζητά
// επιβεβαίωση παραλαβής σε ΣΤΑΘΕΡΟ ΜΕΣΟ, χωρίς αδικαιολόγητη καθυστέρηση, με
// το ΠΕΡΙΕΧΟΜΕΝΟ της δήλωσης και την ΗΜΕΡΟΜΗΝΙΑ ΚΑΙ ΩΡΑ υποβολής. Το email
// είναι σταθερό μέσο (Οδηγία 2011/83/ΕΕ άρθ. 2 σημ. 10 και αιτιολογική
// σκέψη 23). Η επιστροφή οφείλεται μέσα σε 14 ημέρες από την ενημέρωση για
// την υπαναχώρηση (άρθ. 13§1 της ίδιας Οδηγίας). Πηγές και το τι δεν
// επαληθεύτηκε κατά λέξη: lib/legal/withdrawal.ts.
//
// ΠΟΙΟΣ ΕΠΙΣΤΡΕΦΕΙ ΤΑ ΧΡΗΜΑΤΑ, ΤΙΜΙΑ. Πωλητής της συνδρομής είναι ο έμπορος
// (merchant of record): εκείνος εισέπραξε και εκείνος εκτελεί την επιστροφή
// (lib/legal/billingWords.ts, `withdrawal`, `withdrawalVia`). Εμείς λαμβάνουμε
// τη δήλωση, σταματάμε την ανανέωση όταν ξέρουμε ποια συνδρομή είναι και τη
// διαβιβάζουμε. Η επιστροφή μέσω του API του εμπόρου ΔΕΝ γίνεται αυτόματα: το
// σχήμα των γεγονότων επιστροφής δεν έχει δοκιμαστεί με αληθινή επιστροφή
// (lib/billing/merchantAlert.ts) και δεν αποθηκεύουμε το αναγνωριστικό της
// συναλλαγής που θα χρειαζόταν. Ως τότε τη ζητά άνθρωπος, από το μήνυμα της
// υποστήριξης πιο κάτω.
//
// ΚΑΜΙΑ ΠΑΥΛΑ ΚΑΙ ΚΑΘΕ ΤΙΜΗ ΧΡΗΣΤΗ ΔΙΑΦΕΥΓΕΙ, όπως στο lib/email/ack.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { IDENTITY } from '@/lib/legal/identity';
import { merchant } from '@/lib/billing/merchant';
import { siteUrl } from '@/lib/core/site';
import { athensToday, athensTime } from '@/lib/core/time';
import { grDate } from '@/lib/core/format';
import { SEND_URL } from '@/lib/inbound/sendAck';
import { EMAIL_LIGHT as C, EMAIL_BRAND_INK } from '@/supabase/functions/_shared/emailPalette';
import { WITHDRAWAL_DAYS, WITHDRAWAL_PATH, withdrawalLastDay } from './withdrawal';

/** Τι ακολούθησε την ακύρωση της συνδρομής στον έμπορο. */
export type CancelOutcome = 'cancelled' | 'failed' | 'none' | 'not_signed_in';

/** Η δήλωση όπως καταγράφηκε, για το αποδεικτικό και για τη διαβίβαση. */
export interface WithdrawalRecord {
  reference: string;
  submittedAt: Date;
  name: string;
  email: string;
  contract: string;
  purchaseIso: string | null;
  within: boolean | null;
  cancel: CancelOutcome;
  /** Η συνδρομή στον έμπορο, όταν τη βρήκαμε από τον λογαριασμό. */
  subscriptionId: string | null;
}

const esc = (v: string): string =>
  String(v ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

/** Η ημερομηνία και ώρα υποβολής, ώρα Ελλάδας: «20/10/2026, 14:05 (ώρα Ελλάδας)». */
export const submittedLabel = (at: Date): string =>
  `${grDate(athensToday(at))}, ${athensTime(at)} (ώρα Ελλάδας)`;

/** Τι γίνεται με τα χρήματα, σε μία πρόταση, όποια κι αν είναι η περίπτωση. */
function moneySentence(r: WithdrawalRecord): string {
  const mor = merchant().name;
  return `Αν πλήρωσες συνδρομή, την επιστροφή ολόκληρου του ποσού την εκτελεί η ${mor}, που σου πούλησε τη συνδρομή και εξέδωσε το παραστατικό. Της διαβιβάζουμε τη δήλωσή σου και η επιστροφή γίνεται με τον ίδιο τρόπο πληρωμής, μέσα σε ${WITHDRAWAL_DAYS} ημέρες από σήμερα.`
    + (r.within === false ? ' Η ημερομηνία αγοράς που έγραψες είναι πέρα από την προθεσμία· η δήλωση καταγράφηκε κανονικά και την εξετάζουμε με το παραστατικό.' : '');
}

/** Τι έγινε με την ανανέωση, σε μία πρόταση, ή κενό όταν δεν αφορά. */
function renewalSentence(r: WithdrawalRecord): string {
  if (r.cancel === 'cancelled') return 'Η συνδρομή σου ακυρώθηκε στον έμπορο και δεν θα ανανεωθεί.';
  if (r.cancel === 'failed') return 'Η αυτόματη ακύρωση της ανανέωσης δεν ολοκληρώθηκε· την ακυρώνουμε εμείς χειροκίνητα και θα σου γράψουμε όταν γίνει.';
  if (r.cancel === 'not_signed_in') return 'Επειδή η δήλωση έγινε χωρίς σύνδεση, βρίσκουμε τη συνδρομή από τα στοιχεία που έγραψες και ακυρώνουμε την ανανέωσή της.';
  return '';
}

/** Οι γραμμές της δήλωσης, ίδιες στο αποδεικτικό, στην οθόνη και στη διαβίβαση. */
export function declarationLines(r: WithdrawalRecord): [string, string][] {
  return [
    ['Κωδικός', r.reference],
    ['Υποβλήθηκε', submittedLabel(r.submittedAt)],
    ['Δήλωση', `Υπαναχωρώ από τη σύμβαση με το ${IDENTITY.tradeName}.`],
    ['Ονοματεπώνυμο', r.name],
    ['Ηλεκτρονικό ταχυδρομείο', r.email],
    ['Σύμβαση', r.contract],
    ['Ημερομηνία αγοράς', r.purchaseIso ? grDate(r.purchaseIso) : 'δεν δηλώθηκε'],
    ...(r.purchaseIso ? [['Τελευταία ημέρα προθεσμίας', grDate(withdrawalLastDay(r.purchaseIso))] as [string, string]] : []),
  ];
}

/** Το αποδεικτικό σε σταθερό μέσο: θέμα, HTML και απλό κείμενο. */
export function withdrawalAckEmail(r: WithdrawalRecord): { subject: string; html: string; text: string } {
  const subject = `PROPERWISE | Λάβαμε τη δήλωση υπαναχώρησης (${r.reference})`;
  const lines = declarationLines(r);
  const after = [renewalSentence(r), moneySentence(r)].filter(Boolean);
  const intro = `Λάβαμε τη δήλωση υπαναχώρησής σου στις ${submittedLabel(r.submittedAt)}. Κράτησε αυτό το μήνυμα: είναι το αποδεικτικό σου.`;

  const text = [
    `Γεια σου ${r.name},`, '', intro, '',
    ...lines.map(([k, v]) => `${k}: ${v}`), '',
    ...after, '',
    `Για οτιδήποτε απάντησε σε αυτό το email ή γράψε στο ${IDENTITY.supportEmail}.`,
    `Η ομάδα του ${IDENTITY.tradeName}`,
  ].join('\n');

  const P = (h: string) => `<p style="margin:0 0 16px;font-size:15px;color:${C.text};line-height:25px;">${h}</p>`;
  const rows = lines.map(([k, v]) =>
    `<tr><td style="padding:6px 12px 6px 0;font-size:13px;color:${C.mute};vertical-align:top;white-space:nowrap;">${esc(k)}</td><td style="padding:6px 0;font-size:14px;color:${C.ink};">${esc(v)}</td></tr>`).join('');
  const html = `<!DOCTYPE html>
<html lang="el"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${C.canvas};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:${C.canvas};"><tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;max-width:600px;background:${C.page};border:1px solid ${C.rule};border-radius:12px;">
<tr><td style="padding:24px 32px;border-bottom:1px solid ${C.rule};"><a href="${esc(siteUrl(''))}" style="text-decoration:none;color:${EMAIL_BRAND_INK};font-size:20px;font-weight:700;letter-spacing:0.14em;">${esc(IDENTITY.tradeName)}</a></td></tr>
<tr><td style="padding:32px;">
<p style="margin:0 0 18px;font-size:17px;color:${C.ink};font-weight:600;line-height:24px;">Γεια σου <b>${esc(r.name)}</b>,</p>
${P(esc(intro))}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 18px;">${rows}</table>
${after.map(a => P(esc(a))).join('\n')}
${P(`Για οτιδήποτε απάντησε σε αυτό το email ή γράψε στο <a href="mailto:${esc(IDENTITY.supportEmail)}" style="color:${C.accent};text-decoration:none;">${esc(IDENTITY.supportEmail)}</a>.`)}
<p style="margin:24px 0 0;font-size:15px;color:${C.text};line-height:25px;">Η ομάδα του <b style="color:${C.ink};">${esc(IDENTITY.tradeName)}</b></p>
</td></tr></table></td></tr></table>
</body></html>`;
  return { subject, html, text };
}

/**
 * Το μήνυμα προς την υποστήριξη: τι να ζητήσει από τον έμπορο.
 *
 * ΜΕ ΤΟ EMAIL ΤΟΥ ΚΑΤΑΝΑΛΩΤΗ, σε αντίθεση με τις ειδοποιήσεις του webhook
 * (lib/billing/merchantAlert.ts, μόνο αναγνωριστικά). Εδώ ο άνθρωπος πρέπει να
 * βρει τη συνδρομή και όταν η δήλωση ήρθε χωρίς σύνδεση το email είναι το
 * μόνο κλειδί. Μένει στο ίδιο γραμματοκιβώτιο που δέχεται ήδη τις δηλώσεις.
 */
export function withdrawalAlert(r: WithdrawalRecord): { subject: string; text: string } {
  const mor = merchant().name;
  return {
    subject: `PROPERWISE | Δήλωση υπαναχώρησης ${r.reference}: διαβίβαση στην ${mor}`,
    text: [
      `Νέα δήλωση υπαναχώρησης από τη λειτουργία της εφαρμογής (${siteUrl(WITHDRAWAL_PATH)}).`,
      '',
      ...declarationLines(r).map(([k, v]) => `${k}: ${v}`),
      `Συνδρομή στον έμπορο: ${r.subscriptionId || 'δεν βρέθηκε από λογαριασμό'}`,
      `Εμπρόθεσμη κατά τη δηλωμένη ημερομηνία: ${r.within === null ? 'άγνωστο' : r.within ? 'ναι' : 'όχι'}`,
      `Ακύρωση ανανέωσης: ${r.cancel}`,
      '',
      `Τι κάνεις: ${mor} · Transactions · η πληρωμή του πελάτη · Refund, ολόκληρο το ποσό, μέσα σε ${WITHDRAWAL_DAYS} ημέρες από την υποβολή.`,
      r.cancel === 'cancelled' ? 'Η ανανέωση ακυρώθηκε ήδη αυτόματα.' : `Και ακύρωση: ${mor} · Subscriptions · η συνδρομή · Cancel.`,
      'Αν δεν βρεθεί πληρωμή (δωρεάν πακέτο ή δοκιμή), απάντησε στον πελάτη ότι δεν υπάρχει ποσό να επιστραφεί.',
    ].join('\n'),
  };
}

/**
 * Στέλνει ένα μήνυμα από την υποστήριξη. Δεν πετά ποτέ: απαντά αν έφυγε.
 *
 * @param fetcher Δίνεται ως όρισμα ώστε ο έλεγχος να μη χτυπά δίκτυο.
 */
export async function sendWithdrawalMail(
  msg: { to: string; subject: string; html?: string; text: string },
  apiKey: string | undefined, fetcher: typeof fetch = fetch,
): Promise<boolean> {
  const key = (apiKey || '').trim();
  if (!key || !msg.to) return false;
  try {
    const res = await fetcher(SEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${IDENTITY.tradeName} Support <${IDENTITY.supportEmail}>`,
        reply_to: IDENTITY.supportEmail,
        to: msg.to, subject: msg.subject, text: msg.text,
        ...(msg.html ? { html: msg.html } : {}),
      }),
      signal: AbortSignal.timeout(5_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
