'use client';
// ═══════════════════════════════════════════════════════════════════════════
// Η ΓΛΩΣΣΑ ΤΩΝ ΜΗΝΥΜΑΤΩΝ: EMAIL ΚΑΙ ΕΙΔΟΠΟΙΗΣΕΙΣ ΣΥΣΚΕΥΗΣ
// ─────────────────────────────────────────────────────────────────────────
// Δεύτερη γραμμή της «Εμφάνισης και γλώσσας», κάτω από τη γλώσσα της
// εφαρμογής (LanguageSetting.tsx). Γράφεται ΜΟΝΟ στο `user_metadata.msg_locale`
// του λογαριασμού: τη διαβάζουν οι αποστολείς στον διακομιστή (συναρτήσεις
// άκρης, app/api/push), όχι η σελίδα, οπότε δεν χρειάζεται cookie ούτε
// ξαναφόρτωμα. Οσο ο χρήστης δεν έχει διαλέξει, η τιμή που δείχνει είναι αυτή
// που ισχύει ήδη: η γλώσσα της εφαρμογής, αλλιώς ελληνικά (msgLocale).
//
// Η ΡΥΘΜΙΣΗ ΥΠΑΡΧΕΙ ΓΙΑΤΙ ΚΑΤΙ ΤΗΝ ΑΚΟΥΕΙ. Οι υπενθυμίσεις προθεσμιών με email
// (send-reminders) και οι ειδοποιήσεις συσκευής (app/api/push, public/sw.js)
// τη διαβάζουν πριν γράψουν. Η περιγραφή λέει μόνο ό,τι ισχύει.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { LOCALE_NAME, MSG_LOCALE_META_KEY, msgLocale, type Locale } from '@/lib/i18n/locale';
import { useLocale } from '@/lib/i18n/useLocale';
import { useAppEn } from '@/lib/i18n/appEn';
import { notifyError } from '@/components/Toast';
import { failed } from '@/lib/core/dbError';
import { CustomSelect } from './UIComponents';
import { SetRow } from './SettingsKit';

const ORDER: Locale[] = ['el', 'en'];

export default function MsgLanguageSetting() {
  const E = useAppEn('settings')?.msgLanguage;
  const appLang = useLocale();
  // Πριν διαβαστεί ο λογαριασμός, η γλώσσα της εφαρμογής: αυτή ισχύει και για
  // τα μηνύματα όσο ο χρήστης δεν έχει διαλέξει άλλη.
  const [value, setValue] = useState<Locale>(appLang);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void createClient().auth.getSession().then(({ data }) => {
      const meta = data.session?.user?.user_metadata;
      if (live && meta) setValue(msgLocale(meta));
    });
    return () => { live = false; };
  }, []);

  async function choose(next: Locale) {
    if (next === value || busy) return;
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ data: { [MSG_LOCALE_META_KEY]: next } });
    setBusy(false);
    if (error) {
      notifyError(E ? E.failed : failed('Η γλώσσα των μηνυμάτων δεν άλλαξε', error));
      return;
    }
    setValue(next);
  }

  return (
    <SetRow
      title={E ? E.title : 'Γλώσσα μηνυμάτων και email'}
      desc={E ? E.desc : 'Οι υπενθυμίσεις προθεσμιών με email και οι ειδοποιήσεις στις συσκευές σου. Τα έγγραφα για την ΑΑΔΕ και τον λογιστή μένουν στα ελληνικά.'}
      control={<div style={{ width: 200 }}>
        <CustomSelect ariaLabel={E ? E.title : 'Γλώσσα μηνυμάτων και email'} value={value} disabled={busy}
          onChange={v => { void choose(v === 'en' ? 'en' : 'el'); }}
          options={ORDER.map(l => ({ value: l, label: LOCALE_NAME[l] }))} />
      </div>} />
  );
}
