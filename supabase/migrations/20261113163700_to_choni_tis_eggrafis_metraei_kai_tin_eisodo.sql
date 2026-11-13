-- ═══════════════════════════════════════════════════════════════════════════
-- ΤΟ ΧΩΝΙ ΤΗΣ ΕΓΓΡΑΦΗΣ ΜΕΤΡΑΕΙ ΚΑΙ ΤΟ ΣΗΜΕΙΟ ΕΙΣΟΔΟΥ
-- ─────────────────────────────────────────────────────────────────────────
-- ΠΗΓΗ: η πρόταση του PR #567 (ενότητα «Σημείο εισόδου»), για να μετρηθούν
-- οι εγγραφές ανά επισκέπτη ανά σημείο εισόδου. Μέτρηση 06/11 έως 13/11/2026:
-- 22 προβολές του /signup, 0 υποβολές, 1 νέος λογαριασμός σε 123 επισκέπτες,
-- και καμία ένδειξη από ποια σελίδα ξεκίνησε η εγγραφή.
--
-- ΤΙ ΔΕΝ ΞΕΡΑΜΕ. Το χωνί μετρά βήμα και ΠΗΓΗ ΚΙΝΗΣΗΣ (κοινωνικό δίκτυο,
-- αναζήτηση, direct, internal). Δεν μετρά από ποια σελίδα του site ξεκίνησε η
-- εγγραφή: αρχική, οδηγός, υπολογιστής ή πακέτα. Η `count_signup_step` δέχεται
-- κλειστό κατάλογο στο `p_source` και απορρίπτει σιωπηλά κάθε άλλη τιμή, οπότε
-- το «home» ή το «guide» εκεί δεν θα μετρούσε και θα αλλοίωνε τη μέτρηση πηγής.
--
-- ΤΙ ΑΛΛΑΖΕΙ. Μία νέα διάσταση `entry` με κλειστό κατάλογο
-- (home, guide, calculator, pricing, other), μέσα στο πρωτεύον κλειδί. Η
-- συνάρτηση παίρνει πέμπτη παράμετρο `p_entry` με προεπιλογή 'other', ώστε ο
-- σημερινός κώδικας που στέλνει τέσσερις να συνεχίζει να μετρά. Ό,τι υπάρχει
-- ήδη στον πίνακα γίνεται 'other'.
--
-- ΤΙ ΔΕΝ ΑΛΛΑΖΕΙ. Μόνο μετρητές ανά ημέρα· κανένα αναγνωριστικό, καμία IP,
-- κανένα User-Agent. Η λέξη της εισόδου είναι λέξη καταλόγου, όχι διεύθυνση.
-- Ίδιο ταβάνι 1.000 ανά γραμμή και ημέρα, ίδιο όριο 600 κλήσεων το λεπτό
-- (20261110152000), ίδια RLS χωρίς πολιτική, ίδια δικαιώματα.
--
-- ΓΙΑΤΙ ΣΒΗΝΕΤΑΙ Η ΠΑΛΙΑ ΥΠΟΓΡΑΦΗ. Με δύο συναρτήσεις, μία με τέσσερις και
-- μία με πέντε παραμέτρους και προεπιλογή, η κλήση με τέσσερις θα ήταν διφορούμενη
-- («function is not unique»). Μένει μόνο η νέα· η κλήση με τέσσερις επιλύεται
-- σε αυτήν με `p_entry = 'other'`.
--
-- ΣΕΙΡΑ ΑΝΑΠΤΥΞΗΣ. Αν η εφαρμογή στείλει `p_entry` πριν από αυτή τη
-- μετανάστευση, το PostgREST δεν βρίσκει συνάρτηση και ο πελάτης καταπίνει το
-- σφάλμα (lib/analytics/signupFunnel.ts): χάνεται ένας μετρητής, η εγγραφή δεν
-- επηρεάζεται. Ο παλιός πελάτης μετά από αυτήν μετρά κανονικά ('other'). Άρα
-- πρώτα η μετανάστευση, μετά η εφαρμογή. Η supabase-deploy.yml την εφαρμόζει
-- με το push στο main.
--
-- ΙΔΙΟΔΥΝΑΜΗ. `add column if not exists`, `drop constraint if exists` πριν
-- από κάθε προσθήκη, `drop function if exists` για την παλιά υπογραφή και
-- `create or replace` για τη νέα.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.signup_funnel add column if not exists entry text not null default 'other';

alter table public.signup_funnel drop constraint if exists signup_funnel_entry_check;
alter table public.signup_funnel add constraint signup_funnel_entry_check check (entry in (
            'home', 'guide', 'calculator', 'pricing', 'other'));

alter table public.signup_funnel drop constraint if exists signup_funnel_pkey;
alter table public.signup_funnel add constraint signup_funnel_pkey
  primary key (day, step, source, in_app, mobile, entry);

comment on column public.signup_funnel.entry is
  'Σημείο εισόδου της εγγραφής, από κλειστό κατάλογο (το ?from= του συνδέσμου). Λέξη καταλόγου, όχι διεύθυνση.';

-- Ίδια κλειδαριά με την 20260930140000: RLS χωρίς πολιτική, κανένα δικαίωμα
-- για τους ρόλους του πελάτη. Ο διακομιστής διαβάζει με service_role.
alter table public.signup_funnel enable row level security;
revoke all on table public.signup_funnel from public, anon, authenticated;

drop function if exists public.count_signup_step(text, text, boolean, boolean);

create or replace function public.count_signup_step(
  p_step text, p_source text, p_in_app boolean, p_mobile boolean, p_entry text default 'other'
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_minute timestamptz := date_trunc('minute', now());
  v_n integer;
begin
  if p_step not in ('view', 'google', 'app_note', 'chrome', 'invalid', 'submit', 'sent', 'error')
     or p_source not in ('instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'x', 'google', 'search',
                         'internal', 'direct', 'other')
     or p_entry is null
     or p_entry not in ('home', 'guide', 'calculator', 'pricing', 'other')
     or p_in_app is null or p_mobile is null then
    return;
  end if;

  -- Όριο ρυθμού: πάνω από 600 κλήσεις το λεπτό, για όλους μαζί, δεν μετρούν.
  insert into private.signup_funnel_minute as m (minute, n) values (v_minute, 1)
  on conflict (minute) do update set n = m.n + 1
  returning n into v_n;
  if v_n > 600 then
    return;
  end if;
  delete from private.signup_funnel_minute where minute < v_minute - interval '1 hour';

  insert into public.signup_funnel as f (day, step, source, in_app, mobile, entry, n)
  values ((now() at time zone 'Europe/Athens')::date, p_step, p_source, p_in_app, p_mobile, p_entry, 1)
  on conflict (day, step, source, in_app, mobile, entry)
  -- Ταβάνι ανά γραμμή και ημέρα, όπως στην 20260930140000.
  do update set n = f.n + 1 where f.n < 1000;
end;
$function$;

-- Ίδια δικαιώματα με την 20261110152000, στη νέα υπογραφή.
revoke execute on function public.count_signup_step(text, text, boolean, boolean, text) from public;
grant execute on function public.count_signup_step(text, text, boolean, boolean, text) to anon, authenticated, service_role;
