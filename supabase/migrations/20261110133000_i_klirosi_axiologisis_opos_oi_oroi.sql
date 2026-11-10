-- ═══════════════════════════════════════════════════════════════════════════
-- Η ΚΛΗΡΩΣΗ ΑΞΙΟΛΟΓΗΣΗΣ ΚΑΝΕΙ ΟΣΑ ΓΡΑΦΟΥΝ ΟΙ ΟΡΟΙ
-- ─────────────────────────────────────────────────────────────────────────
-- ΠΗΓΗ: app/terms/page.tsx, ενότητα «Κλήρωση αξιολόγησης» (#klirosi) και η
-- αγγλική της (lib/i18n/en/legal/terms.ts). Οι Όροι ΔΕΝ αλλάζουν· αλλάζει ο
-- κώδικας ώστε να τους τηρεί (απόφαση ιδιοκτήτη 10/11/2026).
--
--   «Η κλήρωση διενεργείται στο τέλος κάθε ημερολογιακού μήνα: ο νικητής
--    επιλέγεται τυχαία ανάμεσα σε όλες τις συμμετοχές του μήνα και ειδοποιείται
--    με email στη διεύθυνση του λογαριασμού του. Αν δεν απαντήσει μέσα σε 14
--    ημέρες, το δώρο κληρώνεται εκ νέου.»
--   «… δώρο έναν χρόνο συνδρομής «Επαγγελματίας» … πιστώνεται στον λογαριασμό
--    του νικητή …»
--
-- ΤΙ ΕΚΑΝΕ Ο ΚΩΔΙΚΑΣ (τελευταίος ορισμός στο baseline, επιβεβαιωμένος στην
-- παραγωγή με pg_get_functiondef στις 10/11/2026):
--   · feedback_campaign: καμπάνιες τεσσάρων μηνών, με τρεις ενεργούς μήνες·
--   · draw_due_feedback_winners: κλήρωση μόνο στη «φάση 2», μία ανά τετράμηνο·
--   · draw_feedback_winner: πίστωνε αμέσως 12 μήνες agency, χωρίς email, χωρίς
--     προθεσμία και χωρίς νέα κλήρωση.
--
-- ΤΙ ΚΑΝΕΙ ΤΩΡΑ (απαντήσεις ιδιοκτήτη 10/11/2026):
--   1. Καμπάνια = ημερολογιακός μήνας (UTC, όπως το «μία συμμετοχή τον μήνα»
--      της submit_feedback). Τον νικητή του μήνα τον κληρώνει το cron την 1η
--      του επόμενου, 03:00 UTC.
--   2. Ο νικητής παίρνει email με σύνδεσμο αποδοχής. «Απάντηση» = πάτημα του
--      «Αποδέχομαι το δώρο», στο email ή μέσα στην εφαρμογή.
--   3. Η αποδοχή θέλει υποχρεωτικό «Είμαι άνω των 18» (οι Όροι: «κάθε κάτοχος
--      ενεργού λογαριασμού άνω των 18 ετών»). Η δήλωση γράφεται με ημερομηνία
--      και ώρα (`adult_confirmed_at`).
--   4. Ο χρόνος «Επαγγελματίας» πιστώνεται τη στιγμή της αποδοχής, όχι με την
--      κλήρωση.
--   5. Χωρίς αποδοχή σε 14 ημέρες, η πρόσκληση λήγει και γίνεται αυτόματα νέα
--      κλήρωση ανάμεσα στους ΥΠΟΛΟΙΠΟΥΣ συμμετέχοντες του ΙΔΙΟΥ μήνα. Αν δεν
--      μείνει κανείς, εκείνος ο μήνας δεν έχει νικητή (ερμηνεία των Όρων,
--      γραμμένη στην περιγραφή του PR).
--
-- Ο ΣΥΝΔΕΣΜΟΣ: διακριτικό 256 bit από `gen_random_bytes`, base64url 43
-- χαρακτήρων, μίας χρήσης, με λήξη μαζί με την πρόσκληση. Στη βάση γράφεται
-- ΜΟΝΟ το SHA-256 του, όπως στο «Πλήρωσα» (20261029120000). Το ίδιο το
-- διακριτικό ζει μόνο στις παραμέτρους του email στο `email_outbox`, πίνακα
-- μόνο της υπηρεσίας (20260808120000).
--
-- ΜΕΤΑΒΑΣΗ: στην παραγωγή, στις 10/11/2026, το `user_feedback` είχε 0 γραμμές
-- και το `feedback_campaign_winners` 0. Καμία συμμετοχή δεν χάνεται.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Η καμπάνια είναι ο ημερολογιακός μήνας ───────────────────────────────
-- Ίδια υπογραφή και ίδιο IMMUTABLE: το `timezone('UTC', …)` είναι IMMUTABLE,
-- σε αντίθεση με το `to_char`. Ενεργή πάντα: τη λήξη της κλήρωσης την
-- αποφασίζει ανακοίνωση μέσα στην εφαρμογή (Όροι), όχι το ημερολόγιο.
create or replace function public.feedback_campaign(p_ts timestamp with time zone default now())
 returns table(campaign_id text, active boolean)
 language sql
 immutable
 set search_path to 'public'
as $$
  select 'M' || extract(year from timezone('UTC', p_ts))::int::text
             || '-' || lpad(extract(month from timezone('UTC', p_ts))::int::text, 2, '0'),
         true;
$$;

-- ── 2. Οι προσκλήσεις αποδοχής ──────────────────────────────────────────────
create table if not exists public.feedback_prize_offers (
  id                  uuid primary key default gen_random_uuid(),
  campaign_id         text not null,
  user_id             uuid not null references auth.users(id) on delete cascade,
  token_hash          text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  drawn_at            timestamptz not null default now(),
  expires_at          timestamptz not null,
  status              text not null default 'pending' check (status in ('pending', 'accepted', 'expired')),
  accepted_at         timestamptz,
  accepted_via        text check (accepted_via in ('email', 'app')),
  adult_confirmed_at  timestamptz,
  -- Αποδοχή χωρίς δήλωση ηλικίας είναι αδύνατη και στη βάση, όχι μόνο στην οθόνη.
  check (status <> 'accepted' or (accepted_at is not null and adult_confirmed_at is not null and accepted_via is not null)),
  -- Ο ίδιος άνθρωπος δεν κληρώνεται δεύτερη φορά για τον ίδιο μήνα.
  unique (campaign_id, user_id)
);
-- Ένας ενεργός νικητής ανά μήνα: το πολύ μία πρόσκληση σε αναμονή ή αποδεκτή.
create unique index if not exists feedback_prize_offers_one_live
  on public.feedback_prize_offers (campaign_id) where status in ('pending', 'accepted');
create index if not exists feedback_prize_offers_user_idx on public.feedback_prize_offers (user_id);
create index if not exists feedback_prize_offers_expiry_idx on public.feedback_prize_offers (expires_at) where status = 'pending';

alter table public.feedback_prize_offers enable row level security;
revoke all on table public.feedback_prize_offers from public, anon, authenticated;
grant all on table public.feedback_prize_offers to service_role;
comment on table public.feedback_prize_offers is
  'Προσκλήσεις αποδοχής της κλήρωσης αξιολόγησης (Όροι, #klirosi): μόνο SHA-256 του διακριτικού, μίας χρήσης, λήξη 14 ημερών. Μόνο υπηρεσία· ο χρήστης περνά από τις accept_* / my_feedback_status.';

-- ── 3. Νέα πρόσκληση: κλήρωση, διακριτικό, email ───────────────────────────
-- Τυχαία ανάμεσα στους συμμετέχοντες του μήνα που δεν έχουν ήδη πάρει
-- πρόσκληση γι' αυτόν. Επιστρέφει τον νικητή ή null (κανείς δεν μένει).
create or replace function private.feedback_prize_offer_new(p_campaign text)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $$
declare
  v_winner  uuid;
  v_email   text;
  v_token   text;
  v_expires timestamptz := now() + interval '14 days';
begin
  select f.user_id into v_winner
    from public.user_feedback f
    join auth.users u on u.id = f.user_id
   where f.campaign_id = p_campaign and f.in_pool
     and coalesce(u.email, '') <> ''
     and not exists (select 1 from public.feedback_prize_offers o
                      where o.campaign_id = p_campaign and o.user_id = f.user_id)
   group by f.user_id
   order by random()
   limit 1;
  if v_winner is null then return null; end if;

  select email into v_email from auth.users where id = v_winner;
  v_token := rtrim(translate(encode(gen_random_bytes(32), 'base64'), '+/', '-_'), '=');

  insert into public.feedback_prize_offers (campaign_id, user_id, token_hash, expires_at)
  values (p_campaign, v_winner, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), v_expires);

  -- Συναλλακτικό: το ζητούν οι Όροι («ειδοποιείται με email»), άρα δεν
  -- περιμένει τον κεντρικό διακόπτη ούτε την απεγγραφή από τα ενημερωτικά.
  insert into public.email_outbox (copy_id, to_email, to_name, params, category, dedup_key, scheduled_for)
  values ('feedback_prize_won', v_email, null,
          jsonb_build_object(
            'token', v_token,
            -- Η λήξη σε dd/mm/yyyy, ώρα Αθήνας: τη διαβάζει άνθρωπος.
            'expiresOn', to_char(timezone('Europe/Athens', v_expires), 'DD/MM/YYYY')),
          'transactional',
          'feedback_prize_won:' || p_campaign || ':' || v_winner::text,
          now())
  on conflict (dedup_key) do nothing;

  return v_winner;
end;
$$;
revoke all on function private.feedback_prize_offer_new(text) from public, anon, authenticated;

-- ── 4. Η κλήρωση ενός μήνα (ίδια υπογραφή με πριν) ─────────────────────────
-- Τίποτα αν ο μήνας έχει ήδη νικητή σε αναμονή ή αποδεκτό. Αλλιώς νέα
-- πρόσκληση, ανάμεσα σε όσους δεν έχουν κληρωθεί ήδη γι' αυτόν τον μήνα.
create or replace function public.draw_feedback_winner(p_campaign text)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $$
begin
  if p_campaign is null then return null; end if;
  if exists (select 1 from public.feedback_prize_offers
              where campaign_id = p_campaign and status in ('pending', 'accepted')) then
    return null;
  end if;
  return private.feedback_prize_offer_new(p_campaign);
end;
$$;
revoke all on function public.draw_feedback_winner(text) from public, anon, authenticated;

-- ── 5. Η καθημερινή δουλειά: λήξεις, νέες κληρώσεις, ο μήνας που έκλεισε ──
create or replace function public.draw_due_feedback_winners()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  r record;
  v_prev text;
begin
  -- Μία εκτέλεση τη φορά, ακόμη κι αν κάποιος την καλέσει με το χέρι.
  perform pg_advisory_xact_lock(hashtext('draw_due_feedback_winners'));

  -- Όσοι δεν αποδέχτηκαν σε 14 ημέρες: η πρόσκληση λήγει, ο μήνας ξανακληρώνεται.
  for r in
    update public.feedback_prize_offers
       set status = 'expired'
     where status = 'pending' and expires_at <= now()
    returning campaign_id
  loop
    perform public.draw_feedback_winner(r.campaign_id);
  end loop;

  -- Ο μήνας που μόλις έκλεισε. Ασφαλές κάθε μέρα: χωρίς συμμετοχές ή με
  -- νικητή ήδη, η draw_feedback_winner δεν κάνει τίποτα.
  select campaign_id into v_prev from public.feedback_campaign(date_trunc('month', now()) - interval '1 day');
  perform public.draw_feedback_winner(v_prev);
end;
$$;
revoke all on function public.draw_due_feedback_winners() from public, anon, authenticated;

-- ── 6. Η αποδοχή: δήλωση ηλικίας, πίστωση, καταγραφή νικητή ────────────────
create or replace function private.feedback_prize_accept(p_offer uuid, p_adult boolean, p_via text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  o public.feedback_prize_offers;
begin
  select * into o from public.feedback_prize_offers where id = p_offer for update;
  if not found then return jsonb_build_object('ok', false, 'kind', 'invalid'); end if;
  if o.status = 'accepted' then return jsonb_build_object('ok', false, 'kind', 'used'); end if;
  if o.status = 'expired' or o.expires_at <= now() then return jsonb_build_object('ok', false, 'kind', 'expired'); end if;
  if p_adult is distinct from true then return jsonb_build_object('ok', false, 'kind', 'adult_required'); end if;

  update public.feedback_prize_offers
     set status = 'accepted', accepted_at = now(), accepted_via = p_via, adult_confirmed_at = now()
   where id = o.id;

  -- Ο νικητής του μήνα, για το αρχείο (Όροι: «επιβεβαίωση της διεξαγωγής»).
  insert into public.feedback_campaign_winners (campaign_id, user_id, drawn_at)
  values (o.campaign_id, o.user_id, o.drawn_at)
  on conflict (campaign_id) do nothing;

  -- Ο χρόνος «Επαγγελματίας», με την ίδια πίστωση που έκανε ως τώρα η
  -- draw_feedback_winner (baseline): το definer παρακάμπτει το lock_billing_plan.
  insert into public.billing_profiles (user_id, comp_plan, comp_until, comp_started_at, comp_months_granted)
  values (o.user_id, 'agency', now() + interval '12 months', now(), 12)
  on conflict (user_id) do update set
    comp_plan           = 'agency',
    comp_until          = greatest(coalesce(billing_profiles.comp_until, now()), now() + interval '12 months'),
    comp_started_at     = coalesce(billing_profiles.comp_started_at, now()),
    comp_months_granted = coalesce(billing_profiles.comp_months_granted, 0) + 12;

  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function private.feedback_prize_accept(uuid, boolean, text) from public, anon, authenticated;

-- Από τον σύνδεσμο του email (app/api/doro, με πελάτη υπηρεσίας).
create or replace function public.accept_feedback_prize_token(p_token text, p_adult boolean)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare v_id uuid;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then
    return jsonb_build_object('ok', false, 'kind', 'invalid');
  end if;
  select id into v_id from public.feedback_prize_offers
   where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
  if v_id is null then return jsonb_build_object('ok', false, 'kind', 'invalid'); end if;
  return private.feedback_prize_accept(v_id, p_adult, 'email');
end;
$$;
revoke all on function public.accept_feedback_prize_token(text, boolean) from public, anon, authenticated;
grant execute on function public.accept_feedback_prize_token(text, boolean) to service_role;

-- Τι δείχνει η σελίδα του συνδέσμου, χωρίς να αλλάζει τίποτα.
create or replace function public.peek_feedback_prize_token(p_token text)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $$
declare o public.feedback_prize_offers;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then
    return jsonb_build_object('ok', false, 'kind', 'invalid');
  end if;
  select * into o from public.feedback_prize_offers
   where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
  if not found then return jsonb_build_object('ok', false, 'kind', 'invalid'); end if;
  if o.status = 'accepted' then return jsonb_build_object('ok', false, 'kind', 'used'); end if;
  if o.status = 'expired' or o.expires_at <= now() then return jsonb_build_object('ok', false, 'kind', 'expired'); end if;
  return jsonb_build_object('ok', true, 'expires_at', o.expires_at);
end;
$$;
revoke all on function public.peek_feedback_prize_token(text) from public, anon, authenticated;
grant execute on function public.peek_feedback_prize_token(text) to service_role;

-- Από μέσα στην εφαρμογή, για τον συνδεδεμένο νικητή.
create or replace function public.accept_my_feedback_prize(p_adult boolean)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare v_uid uuid := auth.uid(); v_id uuid;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_uid is null then return jsonb_build_object('ok', false, 'kind', 'invalid'); end if;
  select id into v_id from public.feedback_prize_offers
   where user_id = v_uid and status = 'pending' and expires_at > now()
   order by drawn_at desc limit 1;
  if v_id is null then return jsonb_build_object('ok', false, 'kind', 'invalid'); end if;
  return private.feedback_prize_accept(v_id, p_adult, 'app');
end;
$$;
revoke all on function public.accept_my_feedback_prize(boolean) from public, anon;
grant execute on function public.accept_my_feedback_prize(boolean) to authenticated;

-- ── 7. Η κατάσταση στο Feedback.tsx λέει και αν περιμένει δώρο ─────────────
create or replace function public.my_feedback_status()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare v_uid uuid := auth.uid(); v_has boolean; v_active boolean; v_camp text; v_prize timestamptz;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_uid is null then return jsonb_build_object('status', 'error'); end if;
  select exists(
    select 1 from user_feedback
     where user_id = v_uid and date_trunc('month', created_at) = date_trunc('month', now())
  ) into v_has;
  select campaign_id, active into v_camp, v_active from public.feedback_campaign(now());
  select expires_at into v_prize from public.feedback_prize_offers
   where user_id = v_uid and status = 'pending' and expires_at > now()
   order by drawn_at desc limit 1;
  return jsonb_build_object('submitted_this_month', v_has, 'campaign_active', v_active, 'campaign', v_camp,
                            'prize_expires_at', v_prize);
end;
$$;

-- ── 8. Το cron τρέχει κάθε μέρα: οι 14 ημέρες λήγουν όποια μέρα πέσουν ─────
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron δεν είναι ενεργό: η κλήρωση αξιολόγησης δεν προγραμματίζεται';
    return;
  end if;
  if exists (select 1 from cron.job where jobname = 'feedback-draw-monthly') then
    perform cron.unschedule('feedback-draw-monthly');
  end if;
  if exists (select 1 from cron.job where jobname = 'feedback-draw-daily') then
    perform cron.unschedule('feedback-draw-daily');
  end if;
  -- 03:00 UTC: την 1η του μήνα κληρώνει τον μήνα που έκλεισε, κάθε μέρα
  -- ελέγχει τις λήξεις των 14 ημερών.
  perform cron.schedule('feedback-draw-daily', '0 3 * * *', 'select public.draw_due_feedback_winners()');
end $$;
