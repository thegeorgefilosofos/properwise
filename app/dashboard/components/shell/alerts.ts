'use client'
// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΕΙΔΟΠΟΙΗΣΕΙΣ ΤΟΥ ΜΕΝΟΥ: ΕΞΟΠΛΙΣΜΟΣ ΚΑΙ ΕΚΚΡΕΜΟΤΗΤΕΣ ΠΟΥ ΘΕΛΟΥΝ ΠΡΟΣΟΧΗ
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import * as checklist from '@/lib/data/checklist'
// Η απογραφή έχει ένα σπίτι: lib/data/inventory.
import * as inventory from '@/lib/data/inventory'

// MD3 form styles

// Επιστρέφει και το ΠΛΗΘΟΣ αντικειμένων, όχι μόνο τις ειδοποιήσεις: το ερώτημα
// τα φέρνει ούτως ή άλλως και χωρίς αυτό η καρτέλα «Έπιπλα και εξοπλισμός»
// κρύβεται με τα δεδομένα μέσα (βλ. σχόλιο στο tabDecision).
export function useInventoryAlerts(propertyId: string | null, userId: string | null) {
  const [alertCount, setAlertCount] = useState(0);
  const [itemCount, setItemCount] = useState(0);
  // Η ΤΡΙΤΗ ΚΑΤΑΣΤΑΣΗ ΤΟΥ ΜΕΤΡΗΤΗ: «δεν ξέρουμε». Χωρίς αυτήν είχε δύο · η
  // αποτυχία φορούσε τα ρούχα του μηδενός.
  const [alertsUnknown, setAlertsUnknown] = useState(false);
  const supabase = createClient();
  useEffect(() => {
    if (!propertyId || !userId) return;
    const check = async () => {
      // ΤΟ ΣΗΜΑ ΤΟΥ ΜΕΝΟΥ ΕΛΕΓΕ «ΚΑΜΙΑ ΕΚΚΡΕΜΟΤΗΤΑ» ΧΩΡΙΣ ΝΑ ΕΧΕΙ ΔΙΑΒΑΣΕΙ.
      // Και οι δύο αναγνώσεις πετούσαν το `error`: σε αποτυχία η λίστα γύριζε
      // άδεια, ο μετρητής έμενε μηδέν, η κουκκίδα δεν αποδιδόταν και ο
      // φωνητικός αναγνώστης άκουγε σκέτο «Μενού». Ο ιδιοκτήτης με ληγμένη
      // συντήρηση καυστήρα ή εγγύηση που τρέχει έβλεπε καθαρή μπάρα και δεν
      // άνοιγε την Απογραφή. Τώρα η αποτυχία δηλώνεται: κανένας αριθμός δεν
      // λέγεται όταν δεν μετρήθηκε.
      const { rows: items, error: itemsErr } = await inventory.ofPropertyWithError<{ warranty_expiry: string | null; condition: string | null; purchase_date: string | null }>(supabase, propertyId, 'warranty_expiry,condition,purchase_date', userId);
      const { data: schedules, error: schedErr } = await supabase.from('inventory_maintenance').select('next_due').eq('property_id', propertyId);
      setAlertsUnknown(!!itemsErr || !!schedErr);
      // Χωρίς τα αντικείμενα δεν μετριέται τίποτα: ούτε το πλήθος τους, ούτε οι
      // ειδοποιήσεις τους. Ο μετρητής μένει όπως ήταν, σημαδεμένος ως άγνωστος.
      if (itemsErr) return;
      setItemCount(items.length);
      let count = 0; const now = Date.now();
      items.forEach(item => {
        if (item.condition === 'Κακή' || item.condition === 'Εκτός Λειτουργίας') count++;
        if (item.warranty_expiry) { const days = Math.ceil((new Date(item.warranty_expiry).getTime() - now) / 86400000); if (days >= 0 && days <= 90) count++; }
        if (item.purchase_date) { const years = (now - new Date(item.purchase_date).getTime()) / (1000*60*60*24*365); if (years >= 10) count++; }
      });
      (schedules||[]).forEach(s => { const days = Math.ceil((new Date(s.next_due).getTime() - now) / 86400000); if (days < 0) count++; });
      setAlertCount(count);
    };
    check();
  }, [propertyId, supabase, userId]);
  return { alertCount, itemCount, alertsUnknown };
}

export function useChecklistAlerts(propertyId: string | null) {
  const [alertCount, setAlertCount] = useState(0);
  const supabase = createClient();
  useEffect(() => {
    if (!propertyId) return;
    const check = async () => {
      const data = await checklist.open<{ due_date: string | null; status: string | null; priority: string | null }>(
        supabase, propertyId, checklist.AGENDA_COLUMNS);
      const now = new Date(); let count = 0;
      data.forEach(item => {
        if (item.due_date && new Date(item.due_date) < now) count++;
        else if (item.priority === 'critical' && item.status === 'pending') count++;
      });
      setAlertCount(count);
    };
    check();
  }, [propertyId, supabase]);
  return alertCount;
}
