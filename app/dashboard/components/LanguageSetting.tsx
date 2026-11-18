'use client';
// ═══════════════════════════════════════════════════════════════════════════
// Η ΓΛΩΣΣΑ ΤΗΣ ΕΦΑΡΜΟΓΗΣ, ΣΤΟΝ ΛΟΓΑΡΙΑΣΜΟ
// ─────────────────────────────────────────────────────────────────────────
// Η επιλογή γράφεται σε ΔΥΟ σημεία, για δύο διαφορετικές δουλειές:
//   1. στο `user_metadata.app_locale` του λογαριασμού, ώστε να ακολουθεί τον
//      χρήστη σε κάθε συσκευή (shell/useAccountLocale.ts)·
//   2. στο cookie `pw_lang`, που διαβάζει το proxy.ts ΠΡΙΝ από την απόδοση
//      και γράφει το `<html lang>`.
// Μετά η σελίδα ξαναφορτώνει ολόκληρη: η γλώσσα αποφασίζεται στον
// διακομιστή, όπως στον επιλογέα των δημόσιων σελίδων (app/LangSwitcher.tsx).
//
// Αν ο λογαριασμός δεν γραφτεί, ΔΕΝ αλλάζει ούτε το cookie: αλλιώς η επόμενη
// φόρτωση θα έβρισκε συσκευή και λογαριασμό να διαφωνούν και θα γύριζε
// μόνη της πίσω, σαν να μην πάτησε τίποτα ο χρήστης.
//
// ΤΑ ΟΝΟΜΑΤΑ ΤΩΝ ΓΛΩΣΣΩΝ ΓΡΑΦΟΝΤΑΙ ΣΤΗ ΔΙΚΗ ΤΟΥΣ ΓΛΩΣΣΑ («Ελληνικά»,
// «English»): όποιος άλλαξε κατά λάθος βρίσκει τον δρόμο πίσω χωρίς να
// διαβάζει τη γλώσσα που διάλεξε.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { LOCALE_META_KEY, LOCALE_NAME, type Locale } from '@/lib/i18n/locale';
import { useLocale } from '@/lib/i18n/useLocale';
import { rememberAppLocale, useAppEn } from '@/lib/i18n/appEn';
import { notifyError } from '@/components/Toast';
import { failed } from '@/lib/core/dbError';
import { CustomSelect } from './UIComponents';
import { SetRow } from './SettingsKit';

const ORDER: Locale[] = ['el', 'en'];

export default function LanguageSetting() {
  const E = useAppEn('settings')?.language;
  // Το σφάλμα στα αγγλικά με τον λόγο του (lib/i18n/en/app/errors.ts), όπως το `failed` στα ελληνικά.
  const X = useAppEn('errors');
  const current = useLocale();
  const [busy, setBusy] = useState(false);

  async function choose(next: Locale) {
    if (next === current || busy) return;
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ data: { [LOCALE_META_KEY]: next } });
    if (error) {
      setBusy(false);
      notifyError(X ? X.failed('The language didn’t change', error) : E ? E.failed : failed('Η γλώσσα δεν άλλαξε', error));
      return;
    }
    rememberAppLocale(next);
    window.location.reload();
  }

  return (
    <SetRow
      title={E ? E.title : 'Γλώσσα'}
      desc={E ? E.desc : 'Η γλώσσα της εφαρμογής σε κάθε συσκευή σου. Τα έγγραφα για την ΑΑΔΕ και τον λογιστή μένουν στα ελληνικά.'}
      control={<div style={{ width: 200 }}>
        <CustomSelect ariaLabel={E ? E.title : 'Γλώσσα'} value={current} disabled={busy}
          onChange={v => { void choose(v === 'en' ? 'en' : 'el'); }}
          options={ORDER.map(l => ({ value: l, label: LOCALE_NAME[l] }))} />
      </div>} />
  );
}
