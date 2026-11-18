// ═══════════════════════════════════════════════════════════════════════════
// Ο ΛΟΓΑΡΙΑΣΜΟΣ ΣΤΑ ΑΓΓΛΙΚΑ (app/dashboard/components/TabSettings.tsx)
// ─────────────────────────────────────────────────────────────────────────
// Πρώτη φάση: ο τίτλος, οι ενότητες, η «Εμφάνιση και γλώσσα» με τον επιλογέα
// γλώσσας. Το περιεχόμενο των άλλων ενοτήτων ακολουθεί σε επόμενη φάση.
// Φτάνει μόνο στα αγγλικά, με δυναμικό import() (lib/i18n/appEn.tsx).
// ═══════════════════════════════════════════════════════════════════════════

export const SETTINGS_EN = {
  title: 'Account',
  sub: 'Everything about you and your data',
  sections: {
    org: ['Organization and team', 'Members and permissions'],
    notifications: ['Notifications', 'Reminders and messages'],
    appearance: ['Appearance and language', 'Language, theme and deadlines'],
    a11y: ['Accessibility', 'Text, contrast, motion, voice'],
    security: ['Security', 'Password and two-step verification'],
    activity: ['Activity', 'The history of your actions'],
    data: ['Data and privacy', 'Import, export, accountant, deletion'],
  } as Record<string, readonly [string, string]>,
  language: {
    title: 'Language',
    desc: 'The language of the app on every device you use. Documents for AADE and your accountant stay in Greek.',
    saving: 'Switching…',
    failed: 'The language didn’t change. Try again.',
  },
  currency: 'Currency: euro (€)',
  theme: {
    title: 'Theme',
    desc: 'Dark or light, for the app. The website, login and checkout stay dark.',
    toLight: 'Switch to the light theme',
    toDark: 'Switch to the dark theme',
    toggle: 'Switch theme',
  },
  horizon: {
    title: 'Deadline horizon',
    desc: 'How far ahead the “What needs doing now” list looks. Anything further away lives in the Calendar; overdue items always show.',
    /** Το όνομα κάθε ορίζοντα· οι ημέρες έρχονται από την τιμή της επιλογής. */
    options: { 30: 'Next month', 60: 'Two months', 90: 'Three months', 180: 'Six months', 365: 'A full year' } as Record<string, string>,
    days: (name: string, n: number) => `${name} (${n} days)`,
  },
};

export type SettingsEn = typeof SETTINGS_EN;
