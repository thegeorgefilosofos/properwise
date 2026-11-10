'use client';
// ═══════════════════════════════════════════════════════════════════════════
// «ΔΕΚΑ ΛΕΠΤΑ ΠΡΙΝ ΑΠΟ ΚΑΘΕ ΡΑΝΤΕΒΟΥ», ΟΣΟ ΕΙΝΑΙ ΑΝΟΙΧΤΗ Η ΕΦΑΡΜΟΓΗ
// ─────────────────────────────────────────────────────────────────────────
// Το υπόσχεται το DeviceNotifications. Ως τις 10/11/2026 ο χρονοδιακόπτης ζούσε
// μέσα στο TabCalendar: χτυπούσε μόνο με ανοιχτή την καρτέλα Ημερολόγιο, μόνο
// για το επιλεγμένο ακίνητο και ποτέ για εμφάνιση σειράς. Τώρα ζει στη σελίδα
// του πίνακα: όλα τα ακίνητα, με τις εμφανίσεις των σειρών, σε όποια καρτέλα
// κι αν είναι ο χρήστης. Ο κανόνας «ποιο χτυπά τώρα» είναι ο ίδιος (dueReminders).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useSyncExternalStore } from 'react';
import { createClient } from '@/lib/supabase/client';
import * as calendar from '@/lib/data/calendar';
import { deviceNotifyOn, NOTIFY_EVENT } from '@/lib/push/client';
import { dueReminders, notifyBody, type NotifiableEvent } from '@/lib/calendar/notify';
import { expandRecurring, type Recurrable } from '@/lib/calendar/recurrence';
import { athensToday } from '@/lib/core/time';

/** Ώρα Αθήνας ως τοπικό Date, όπως το `athensNow` του ημερολογίου. */
const athensNow = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Athens' }));

function subscribeNotify(onChange: () => void): () => void {
  window.addEventListener(NOTIFY_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => { window.removeEventListener(NOTIFY_EVENT, onChange); window.removeEventListener('storage', onChange); };
}

/** Πόσο συχνά ξαναδιαβάζονται τα γεγονότα της ημέρας (νέα ή αλλαγμένα ραντεβού). */
const RELOAD_MS = 5 * 60_000;

type Row = NotifiableEvent & Recurrable;

export function useAppointmentReminders(userId: string | null | undefined): void {
  const on = useSyncExternalStore(subscribeNotify, deviceNotifyOn, () => false);
  useEffect(() => {
    if (!on || !userId || typeof Notification === 'undefined') return;
    const supabase = createClient();
    // Ένα σύνολο ανά συνεδρία: η ίδια εμφάνιση δεν χτυπά δύο φορές. Το `tag`
    // κρατά και το λειτουργικό από το να δείξει διπλό αν ανοίξει δεύτερη καρτέλα.
    const notified = new Set<string>();
    let today: Row[] = [];
    let alive = true;
    const load = async () => {
      const day = athensToday();
      const { rows } = await calendar.ofUserWithSeries<Row>(supabase, userId, day, day,
        'id,title,event_date,event_time,status,recurring,recurring_interval,recurrence_until,recurrence_count,recurrence_exdates');
      if (alive) today = expandRecurring(rows, day, day);
    };
    const tick = () => {
      if (Notification.permission !== 'granted') return;
      const now = athensNow();
      for (const e of dueReminders(today, now, 10, notified)) {
        notified.add(e.id);
        try { new Notification(e.title, { body: notifyBody(e, now), tag: `cal_${e.id}` }); } catch { /* ο περιηγητής αρνήθηκε */ }
      }
    };
    void load().then(tick);
    const iv = setInterval(tick, 60_000);
    const rl = setInterval(() => { void load(); }, RELOAD_MS);
    return () => { alive = false; clearInterval(iv); clearInterval(rl); };
  }, [on, userId]);
}
