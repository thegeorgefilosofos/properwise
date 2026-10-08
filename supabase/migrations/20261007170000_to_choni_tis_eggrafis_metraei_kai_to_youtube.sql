-- ═══════════════════════════════════════════════════════════════════════════
-- ΤΟ ΧΩΝΙ ΤΗΣ ΕΓΓΡΑΦΗΣ ΜΕΤΡΑΕΙ ΚΑΙ ΤΟ YOUTUBE
-- ─────────────────────────────────────────────────────────────────────────
-- ΓΙΑΤΙ ΑΓΓΙΖΕΤΑΙ ΠΡΟΣΤΑΤΕΥΜΕΝΗ ΔΙΑΔΡΟΜΗ. Από 07/10/2026 το PROPERWISE
-- ανεβάζει δύο Shorts την ημέρα στο YouTube (docs/marketing/shorts/). Ο
-- κλειστός κατάλογος πηγών της 20260930140000 δεν έχει «youtube»: όποιος
-- ερχόταν από εκεί γραφόταν «other» και το κανάλι δεν θα μετριόταν ποτέ.
-- Πηγή: ανάγνωση του lib/analytics/signupFunnel.ts· όχι νόμος ή ΦΕΚ.
--
-- ΤΙ ΑΛΛΑΖΕΙ. Μόνο ο κατάλογος: η στήλη `source` και ο έλεγχος της
-- `count_signup_step` δέχονται και «youtube». Τίποτα άλλο δεν αλλάζει: ίδιοι
-- μετρητές ανά ημέρα, κανένα αναγνωριστικό, ίδιο ταβάνι, ίδια δικαιώματα.
--
-- ΣΕΙΡΑ ΑΝΑΠΤΥΞΗΣ. Αν η εφαρμογή στείλει «youtube» πριν από αυτή τη
-- μετανάστευση, η συνάρτηση το απορρίπτει σιωπηλά (όπως κάθε άγνωστη πηγή):
-- χάνεται ένας μετρητής, τίποτα δεν σπάει.
--
-- ΙΔΙΟΔΥΝΑΜΗ. `drop constraint if exists` πριν από την προσθήκη και
-- `create or replace` για τη συνάρτηση.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.signup_funnel drop constraint if exists signup_funnel_source_check;
alter table public.signup_funnel add constraint signup_funnel_source_check check (source in (
            'instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'x', 'google', 'search',
            'internal', 'direct', 'other'));

create or replace function public.count_signup_step(
  p_step text, p_source text, p_in_app boolean, p_mobile boolean
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_step not in ('view', 'google', 'app_note', 'chrome', 'invalid', 'submit', 'sent', 'error')
     or p_source not in ('instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'x', 'google', 'search',
                         'internal', 'direct', 'other')
     or p_in_app is null or p_mobile is null then
    return;
  end if;

  insert into public.signup_funnel as f (day, step, source, in_app, mobile, n)
  values ((now() at time zone 'Europe/Athens')::date, p_step, p_source, p_in_app, p_mobile, 1)
  on conflict (day, step, source, in_app, mobile)
  -- Ταβάνι ανά γραμμή και ημέρα, όπως στην 20260930140000.
  do update set n = f.n + 1 where f.n < 1000;
end;
$$;

revoke execute on function public.count_signup_step(text, text, boolean, boolean) from public;
grant execute on function public.count_signup_step(text, text, boolean, boolean) to anon, authenticated, service_role;
