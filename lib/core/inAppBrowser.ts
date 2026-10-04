// ═══════════════════════════════════════════════════════════════════════════
// Ο ΕΝΣΩΜΑΤΩΜΕΝΟΣ ΠΕΡΙΗΓΗΤΗΣ ΤΩΝ ΕΦΑΡΜΟΓΩΝ
// ─────────────────────────────────────────────────────────────────────────
// Οποιος πατά τον σύνδεσμο του bio στο Instagram δεν ανοίγει τον Safari ή τον
// Chrome: ανοίγει ένα webview μέσα στην εφαρμογή. Εκεί η Google αρνείται τη
// σύνδεση («403: disallowed_useragent», πολιτική της από το 2021) και ο
// επισκέπτης βλέπει σελίδα σφάλματος στα αγγλικά αμέσως μετά το «Συνέχισε με
// Google», που στην εγγραφή είναι το πρώτο κουμπί. Η πρώτη μέρα στην παραγωγή:
// οι μισοί επισκέπτες από κινητό, ένας στους έξι από το Instagram, καμία εγγραφή.
//
// Ο εντοπισμός γίνεται μόνο από το User-Agent, που οι εφαρμογές γράφουν ρητά.
// Ενα λάθος θετικό κοστίζει λίγο (ο επισκέπτης βλέπει οδηγία και συνεχίζει με
// email). Ενα λάθος αρνητικό κοστίζει όσο πριν. Γι' αυτό η λίστα είναι γενναιόδωρη.
// ═══════════════════════════════════════════════════════════════════════════

export interface InAppBrowser {
  /** Το όνομα της εφαρμογής όπως το ξέρει ο χρήστης· κενό για γενικό webview. */
  app: string | null;
  /** Με το άρθρο, για τη φράση «μέσα από το Instagram». */
  where: string;
  /** Στο Android υπάρχει σύνδεσμος που ανοίγει τη σελίδα στον Chrome. */
  android: boolean;
  /**
   * Στο iPhone με iOS 17 ή νεότερο υπάρχει σύνδεσμος που ανοίγει τη σελίδα στο
   * Safari (`safariLink`). Σε παλαιότερο iOS ο σύνδεσμος δεν κάνει τίποτα, οπότε
   * εκεί μένει μόνο η οδηγία με τις τρεις τελείες.
   */
  safari: boolean;
  /** iPhone ή iPad: η οδηγία με τις τρεις τελείες μιλά για Safari μόνο εδώ. */
  ios: boolean;
}

/** Η κύρια έκδοση του iOS από το «iPhone OS 18_0» ή το «CPU OS 17_5» του iPad. */
function iosMajor(ua: string): number | null {
  if (!/iPhone|iPad|iPod/.test(ua)) return null;
  const m = ua.match(/\bOS (\d+)_/);
  return m ? Number(m[1]) : null;
}

// Η σειρά μετρά: το Messenger γράφει και FBAN, το Threads και Instagram.
const APPS: [RegExp, string][] = [
  [/Barcelona/, 'Threads'],
  [/Instagram/, 'Instagram'],
  [/FBAN\/Messenger|MessengerForiOS|Orca-Android/, 'Messenger'],
  [/FBAN|FBAV|FB_IAB|FBIOS|FB4A/, 'Facebook'],
  [/LinkedInApp/, 'LinkedIn'],
  [/musical_ly|BytedanceWebview|TikTok/, 'TikTok'],
  [/Snapchat/, 'Snapchat'],
  [/Twitter/, 'X'],
  [/Pinterest/, 'Pinterest'],
  [/\bLine\//, 'LINE'],
  [/Viber/, 'Viber'],
];

export function inAppBrowser(ua: string | null | undefined): InAppBrowser | null {
  if (!ua) return null;
  const android = /Android/i.test(ua);
  const ios = !android && /iPhone|iPad|iPod/.test(ua);
  const safari = ios && (iosMajor(ua) ?? 0) >= 17;
  for (const [re, app] of APPS) if (re.test(ua)) return { app, where: `το ${app}`, android, safari, ios };
  // Γενικό webview του Android: το σημάδι «; wv)» το βάζει το ίδιο το σύστημα.
  if (android && /;\s*wv\)/.test(ua)) return { app: null, where: 'την εφαρμογή', android, safari: false, ios: false };
  return null;
}

/**
 * Σύνδεσμος που ανοίγει την ίδια σελίδα στον Chrome του Android. Αν ο Chrome
 * λείπει, το σύστημα πηγαίνει στο `browser_fallback_url`, δηλαδή στην ίδια
 * διεύθυνση: τίποτα δεν χάνεται. Στο iPhone δεν υπάρχει αντίστοιχος δρόμος.
 */
export function chromeIntent(href: string): string {
  const u = new URL(href);
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(href)};end`;
}

/**
 * Σύνδεσμος που ανοίγει την ίδια σελίδα στο Safari, από μέσα από τον
 * ενσωματωμένο περιηγητή του Instagram, του Facebook κ.ά. Το σχήμα
 * `x-safari-https` το αναγνωρίζει το iOS από την έκδοση 17. Σε παλαιότερο iOS
 * δεν κάνει τίποτα· γι' αυτό το κουμπί εμφανίζεται μόνο όταν `safari` ισχύει.
 */
export function safariLink(href: string): string {
  const u = new URL(href);
  return `x-safari-${u.protocol.replace(':', '')}://${u.host}${u.pathname}${u.search}`;
}
