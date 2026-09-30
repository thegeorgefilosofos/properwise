-- ═══════════════════════════════════════════════════════════════════════════
-- ΤΟ ΧΩΝΙ ΤΗΣ ΕΓΓΡΑΦΗΣ ΜΕΤΡΙΕΤΑΙ, ΑΝΩΝΥΜΑ
-- ─────────────────────────────────────────────────────────────────────────
-- ΤΙ ΔΕΝ ΞΕΡΑΜΕ (27–30/09/2026). Έξι επισκέπτες άνοιξαν τη σελίδα εγγραφής και
-- κανείς δεν έγινε χρήστης. Το `product_events` γράφει μόνο συνδεδεμένους
-- (log_event: «ανώνυμος καλών δεν καταγράφεται»), οπότε δεν υπήρχε τρόπος να
-- δούμε αν σταμάτησαν πριν από τη φόρμα, στη φόρμα ή στο κουμπί της Google.
--
-- ΤΙ ΚΡΑΤΙΕΤΑΙ. Μόνο ΜΕΤΡΗΤΕΣ ανά ημέρα: πόσες φορές έγινε ένα βήμα, από ποια
-- κατηγορία πηγής, μέσα σε εφαρμογή ή όχι, από κινητό ή όχι. Καμία γραμμή ανά
-- επισκέπτη, κανένα αναγνωριστικό, καμία διεύθυνση IP, κανένα User-Agent,
-- κανένα cookie. Δύο επισκέψεις δεν μπορούν να συνδεθούν μεταξύ τους ούτε από
-- εμάς: ο αριθμός 3 σε μια γραμμή δεν λέει ποιοι ήταν οι τρεις.
--
-- ΓΙΑΤΙ ΚΛΕΙΣΤΟΙ ΚΑΤΑΛΟΓΟΙ ΚΑΙ ΣΤΗ ΒΑΣΗ. Η συνάρτηση είναι ανοιχτή στον
-- ανώνυμο (αλλιώς η σελίδα εγγραφής δεν μπορεί να μετρήσει). Άρα δεν
-- επιτρέπεται να δέχεται ελεύθερο κείμενο: άγνωστο βήμα ή πηγή απορρίπτεται
-- σιωπηλά. Δεν διαβάζει τίποτα, δεν επιστρέφει τίποτα και δεν μπορεί να
-- γράψει τίποτα άλλο από +1 σε έναν μετρητή.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.signup_funnel (
  day     date    not null,
  step    text    not null check (step in (
            'view', 'google', 'app_note', 'chrome', 'invalid', 'submit', 'sent', 'error')),
  source  text    not null check (source in (
            'instagram', 'facebook', 'linkedin', 'tiktok', 'x', 'google', 'search',
            'internal', 'direct', 'other')),
  in_app  boolean not null,
  mobile  boolean not null,
  n       integer not null default 0 check (n >= 0),
  primary key (day, step, source, in_app, mobile)
);

comment on table public.signup_funnel is
  'Ανώνυμοι μετρητές του χωνιού εγγραφής ανά ημέρα. Καμία γραμμή ανά επισκέπτη, κανένα αναγνωριστικό.';

-- Τη διαβάζει μόνο ο διακομιστής (service_role παρακάμπτει την RLS).
alter table public.signup_funnel enable row level security;
revoke all on table public.signup_funnel from public, anon, authenticated;

create or replace function public.count_signup_step(
  p_step text, p_source text, p_in_app boolean, p_mobile boolean
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_step not in ('view', 'google', 'app_note', 'chrome', 'invalid', 'submit', 'sent', 'error')
     or p_source not in ('instagram', 'facebook', 'linkedin', 'tiktok', 'x', 'google', 'search',
                         'internal', 'direct', 'other')
     or p_in_app is null or p_mobile is null then
    return;
  end if;

  insert into public.signup_funnel as f (day, step, source, in_app, mobile, n)
  values ((now() at time zone 'Europe/Athens')::date, p_step, p_source, p_in_app, p_mobile, 1)
  on conflict (day, step, source, in_app, mobile)
  -- Ταβάνι ανά γραμμή και ημέρα: ένα script που βαράει τη συνάρτηση δεν
  -- φουσκώνει τον μετρητή επ' άπειρο. Χίλιες φορές ένα βήμα από την ίδια
  -- κατηγορία σε μία μέρα είναι πολύ πάνω από κάθε πραγματική κίνηση σήμερα.
  do update set n = f.n + 1 where f.n < 1000;
end;
$$;

revoke execute on function public.count_signup_step(text, text, boolean, boolean) from public;
grant execute on function public.count_signup_step(text, text, boolean, boolean) to anon, authenticated, service_role;
