-- ═══════════════════════════════════════════════════════════════════════════
-- ΤΟ 2FA ΦΥΛΑΕΙ ΤΗ ΔΙΑΓΡΑΦΗ ΚΑΙ ΜΕΣΑ ΑΠΟ ΤΗ ΒΑΣΗ
-- ─────────────────────────────────────────────────────────────────────────
-- ΤΙ ΕΜΕΝΕ ΑΝΟΙΧΤΟ. Ο διαμεσολαβητής (proxy.ts) γυρίζει πίσω στη σύνδεση τη
-- «μισή» συνεδρία —επαληθευμένη συσκευή αλλά διακριτικό «aal1»— για κάθε
-- σελίδα. Το ίδιο το αρχείο του το γράφει: το /api/** ΔΕΝ κρίνεται εκεί, οπότε
-- ένα διακριτικό «aal1» μπορεί ακόμη να καλέσει τις διαδρομές που γράφουν. Η
-- πιο καταστρεπτική από αυτές είναι η διαγραφή λογαριασμού.
--
-- ΓΙΑΤΙ Η ΒΑΣΗ ΚΑΙ ΟΧΙ ΜΟΝΟ ΤΟ ROUTE. Οι πολιτικές RLS δεν κοιτούν το «aal»,
-- οπότε το ίδιο διακριτικό μιλά κατευθείαν στο PostgREST του παρόχου. Η
-- οριστική άμυνα ζει εδώ: όποιος κι αν καλέσει τη `delete_my_account` —route,
-- κονσόλα περιηγητή, εργαλείο— περνά πρώτα από αυτόν τον έλεγχο.
--
-- ΤΟ ΣΩΜΑ ΜΕΝΕΙ ΑΥΤΟΥΣΙΟ. Είναι εκείνο του 20260823140000 (ποιος είμαι, σβήσε
-- με μέσω erase_account). Η μόνη προσθήκη είναι η πύλη, αμέσως μετά τον έλεγχο
-- του `uid`. Η `erase_account` δεν αλλάζει: ο αυτόματος καθαρισμός λήξης δεν
-- έχει συνεδρία ούτε «aal», οπότε ο έλεγχος ανήκει στην αυτοδιαγραφή μόνο.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.delete_my_account() returns json
    language plpgsql security definer
    set search_path to 'public'
    as $$
declare uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Δεν υπάρχει συνδεδεμένος χρήστης';
  end if;

  -- Αν ο χρήστης έχει ενεργό δεύτερο παράγοντα αλλά η συνεδρία δεν τον πέρασε
  -- (aal1 αντί aal2), η διαγραφή ΔΕΝ προχωρά: μια κλεμμένη συνεδρία χωρίς τον
  -- δεύτερο παράγοντα δεν σβήνει έναν λογαριασμό. Ο έλεγχος ζει ΚΑΙ στη βάση,
  -- όχι μόνο στο UI ή στο route, ώστε να ισχύει όποιος κι αν καλέσει τη συνάρτηση.
  if (auth.jwt()->>'aal') is distinct from 'aal2'
     and exists (select 1 from auth.mfa_factors f
                  where f.user_id = uid and f.status = 'verified') then
    raise exception 'Η διαγραφή απαιτεί δεύτερο παράγοντα (2FA)'
      using errcode = '42501';
  end if;

  return public.erase_account(uid);
end;
$$;

alter function public.delete_my_account() owner to postgres;
revoke all     on function public.delete_my_account() from public, anon;
grant  execute on function public.delete_my_account() to authenticated, service_role;
