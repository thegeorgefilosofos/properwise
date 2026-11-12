-- ═══════════════════════════════════════════════════════════════════════════
-- ΤΟ ΔΩΡΟ ΤΟΥ ΣΥΝΕΡΓΑΤΗ ΜΕ ΤΗΝ ΑΠΟΚΤΗΣΗ ΤΗΣ ΙΔΙΟΤΗΤΑΣ ΠΙΣΤΩΝΕΤΑΙ
-- ─────────────────────────────────────────────────────────────────────────
-- ΠΗΓΗ. Όροι χρήσης, ενότητα «Πρόγραμμα πρόσκλησης και συνεργατών»
-- (app/terms/page.tsx:191): «Με την απόκτησή της κερδίζεις 1 μήνα
-- "Επαγγελματίας" αν έχεις "Ιδιοκτήτης με Νόα" ή "Ιδιοκτήτης+", αλλιώς 1 μήνα
-- "Επαγγελματίας+"». Το ίδιο υπόσχεται η οθόνη (TabReferral.tsx, «… δώρο,
-- μόλις την αποκτήσεις»). Οι αριθμοί είναι του κώδικα: PARTNER_WELCOME_MONTHS
-- = 1 και partnerWelcomeTier() στο lib/referral/referral.ts· η δοκιμή στο
-- lib/referral/referral.test.ts κρατά το SQL ίδιο με αυτά.
--
-- ΤΙ ΕΛΕΙΠΕ. Η ιδιότητα γραφόταν στο referral_partners (get_referral_overview)
-- και ανέβαζε μόνο το επίπεδο πρόσβασης. Δώρο δεν γραφόταν πουθενά:
-- εγγραφές στο referral_rewards έκαναν μόνο η claim_referral_bonus και η
-- reconcile_referral_rewards. Στις 10/11/2026 η παραγωγή έχει 0 συνεργάτες και
-- 0 ανταμοιβές, οπότε δεν χρειάζεται αναδρομική πίστωση.
--
-- ΠΩΣ. Ίδιο μοτίβο με τις υπόλοιπες ανταμοιβές: μία γραμμή στο referral_rewards
-- (kind 'months', status 'pending'), που την εφαρμόζει η
-- sync_comp_from_referrals όπως κάθε άλλο δώρο, με το ίδιο όριο μηνών και την
-- ένωση στο καλύτερο πακέτο. Το πακέτο κρίνεται από το billing_profiles.plan
-- τη στιγμή της απόκτησης.
--
-- ΜΙΑ ΦΟΡΑ ΣΕ ΟΛΗ ΤΗ ΖΩΗ ΤΟΥ ΛΟΓΑΡΙΑΣΜΟΥ: μοναδικό ευρετήριο ανά χρήστη για
-- reason = 'partner_welcome' και `on conflict do nothing`. Η ιδιότητα γράφεται
-- με `on conflict (user_id) do nothing`, άρα ο trigger τρέχει μόνο στην πρώτη
-- εγγραφή· το ευρετήριο είναι η δεύτερη φύλαξη.
-- ═══════════════════════════════════════════════════════════════════════════

create unique index if not exists referral_rewards_partner_welcome_uidx
  on public.referral_rewards (user_id)
  where reason = 'partner_welcome';

create or replace function private.referral_partner_welcome()
returns trigger
language plpgsql security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_plan text;
begin
  select bp.plan into v_plan from public.billing_profiles bp where bp.user_id = new.user_id;
  insert into public.referral_rewards (user_id, kind, months, tier, reason, status)
  values (
    new.user_id, 'months', 1,
    case when coalesce(v_plan, '') in ('solo', 'owner') then 'agency' else 'office' end,
    'partner_welcome', 'pending'
  )
  on conflict (user_id) where reason = 'partner_welcome' do nothing;
  return null;
end $$;

revoke all on function private.referral_partner_welcome() from public, anon, authenticated;

drop trigger if exists referral_partner_welcome on public.referral_partners;
create trigger referral_partner_welcome
  after insert on public.referral_partners
  for each row execute function private.referral_partner_welcome();
