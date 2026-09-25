-- ═══════════════════════════════════════════════════════════════════════════
-- Η ΕΠΙΛΟΓΗ ΤΗΣ ΕΓΓΡΑΦΗΣ ΓΙΑ ΤΑ ΕΝΗΜΕΡΩΤΙΚΑ EMAIL
-- ─────────────────────────────────────────────────────────────────────────
-- ΠΗΓΗ ΤΗΣ ΑΛΛΑΓΗΣ. Απόφαση ιδιοκτήτη (25.09.2026): τα ενημερωτικά μένουν
-- ενεργά από προεπιλογή και ο χρήστης μπορεί να τα κλείσει ήδη στην εγγραφή.
-- Νομική βάση: άρθρο 11 παρ. 3 ν.3471/2006, που επιτρέπει μηνύματα για δικά
-- μας παρόμοια προϊόντα σε πελάτη ΜΟΝΟ αν του δοθεί η δυνατότητα να αρνηθεί
-- «κατά τη συλλογή» των στοιχείων και σε κάθε μήνυμα. Το δεύτερο το κάνει ήδη
-- ο σύνδεσμος απεγγραφής· το πρώτο έλειπε: η εγγραφή δεν ρωτούσε τίποτα.
--
-- ΠΩΣ ΦΤΑΝΕΙ Η ΑΡΝΗΣΗ ΣΤΗ ΒΑΣΗ. Η σελίδα εγγραφής γράφει στο προφίλ
-- `marketing_opt_out: true` όταν ο χρήστης ξετσεκάρει το κουτί. Η γραμμή των
-- προτιμήσεων δημιουργείται αργότερα, από τρία διαφορετικά σημεία (η
-- `marketing_prefs_for_email` και οι δύο συναρτήσεις αποστολής), όλα με
-- προεπιλογή «εγγεγραμμένος». Αντί να αλλάξουν και τα τρία, ο trigger εδώ
-- διαβάζει το προφίλ τη στιγμή της δημιουργίας της γραμμής, όποιος κι αν την
-- δημιουργεί. Γραμμή που υπάρχει ήδη δεν αγγίζεται: μετά την εγγραφή μιλά
-- μόνο ο χρήστης, από τη σελίδα απεγγραφής.
--
-- SECURITY DEFINER για να διαβάσει το `auth.users`· καρφωμένο `search_path`.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.marketing_prefs_from_signup()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
begin
  if exists (
    select 1 from auth.users u
     where u.id = new.user_id
       -- Σύγκριση κειμένου, όχι μετατροπή: μια άκυρη τιμή δεν ρίχνει την εγγραφή.
       and (u.raw_user_meta_data ->> 'marketing_opt_out') = 'true'
  ) then
    new.product_news := false;
    new.market_news := false;
  end if;
  return new;
end;
$$;

alter function public.marketing_prefs_from_signup() owner to postgres;
revoke all on function public.marketing_prefs_from_signup() from public, anon, authenticated;

drop trigger if exists marketing_prefs_from_signup on public.email_marketing_prefs;
create trigger marketing_prefs_from_signup
  before insert on public.email_marketing_prefs
  for each row execute function public.marketing_prefs_from_signup();

comment on function public.marketing_prefs_from_signup() is
  'Η άρνηση ενημερωτικών από την εγγραφή (marketing_opt_out στο προφίλ) γίνεται προτίμηση τη στιγμή που δημιουργείται η γραμμή.';
