-- ═══════════════════════════════════════════════════════════════════════════
--  Η ΚΛΗΡΩΣΗ ΑΞΙΟΛΟΓΗΣΗΣ ΚΑΝΕΙ ΟΣΑ ΓΡΑΦΟΥΝ ΟΙ ΟΡΟΙ (20261110133000)
-- ─────────────────────────────────────────────────────────────────────────
--  Σε συναλλαγή που αναιρείται πάντα:
--   · η κλήρωση στέλνει email με σύνδεσμο και ΔΕΝ πιστώνει τίποτα·
--   · η αποδοχή θέλει «Είμαι άνω των 18», πιστώνει έναν χρόνο agency και
--     γίνεται μία φορά· στη βάση μένει μόνο το SHA-256 του διακριτικού·
--   · μετά από 14 ημέρες χωρίς αποδοχή, νέα κλήρωση ανάμεσα στους υπόλοιπους
--     του ίδιου μήνα· αν δεν μείνει κανείς, ο μήνας μένει χωρίς νικητή·
--   · η αποδοχή μέσα από την εφαρμογή αφορά μόνο τον ίδιο τον νικητή·
--   · ο πίνακας και η αποδοχή με διακριτικό δεν φτάνουν σε anon/authenticated.
-- ═══════════════════════════════════════════════════════════════════════════
reset role;
begin;
select set_config('request.jwt.claims', '{"aal":"aal2"}', true);
do $probe$
declare
  u1 uuid := 'fb000000-0000-4000-8000-000000000001';
  u2 uuid := 'fb000000-0000-4000-8000-000000000002';
  u3 uuid := 'fb000000-0000-4000-8000-000000000003';
  c  text := 'M1999-01';
  c2 text := 'M1999-02';
  w uuid; w2 uuid; other uuid; tok text; tok2 text; r jsonb; n int;
  ux uuid := 'fb000000-0000-4000-8000-0000000000a1';  -- ενεργό «Επαγγελματίας+»
  ua uuid := 'fb000000-0000-4000-8000-0000000000a2';  -- ενεργό comp, επεκτείνεται
  ue uuid := 'fb000000-0000-4000-8000-0000000000a3';  -- ληγμένο comp, από σήμερα
  ud uuid := 'fb000000-0000-4000-8000-0000000000a4';  -- σβήνει τον λογαριασμό του
  uo uuid := 'fb000000-0000-4000-8000-0000000000a5';  -- δεύτερος του ίδιου μήνα
  c3 text := 'M1999-03'; c4 text := 'M1999-04'; c5 text := 'M1999-05'; c6 text := 'M1999-06';
  t3 text; t4 text; t5 text; before timestamptz; bp record;
begin
  insert into auth.users(id, email) values
    (u1, 'u1@prize.test'), (u2, 'u2@prize.test'), (u3, 'u3@prize.test');
  insert into public.user_feedback(user_id, email, body, word_count, target, campaign_id, in_pool) values
    (u1, 'u1@prize.test', 'Σχόλιο δοκιμής', 2, 'general', c, true),
    (u2, 'u2@prize.test', 'Σχόλιο δοκιμής', 2, 'general', c, true),
    (u3, 'u3@prize.test', 'Σχόλιο δοκιμής', 2, 'general', c2, true);

  -- ── 0. Η καμπάνια είναι ο ημερολογιακός μήνας ───────────────────────────
  if (select campaign_id from public.feedback_campaign('2026-11-10T12:00Z')) <> 'M2026-11'
     or (select campaign_id from public.feedback_campaign('2026-12-01T00:30Z')) <> 'M2026-12'
     or not (select active from public.feedback_campaign('2026-11-10T12:00Z')) then
    raise exception 'ΚΛΗΡΩΣΗ: η καμπάνια δεν είναι ο ημερολογιακός μήνας';
  end if;
  raise notice 'probe: η καμπάνια της κλήρωσης είναι ο ημερολογιακός μήνας';

  -- ── 1. Η κλήρωση: email, όχι πίστωση ──────────────────────────────────────
  w := public.draw_feedback_winner(c);
  if w is null or w not in (u1, u2) then raise exception 'ΚΛΗΡΩΣΗ: δεν κληρώθηκε συμμετέχων του μήνα (%)', w; end if;
  if exists (select 1 from public.billing_profiles where user_id = w and comp_plan = 'agency') then
    raise exception 'ΚΛΗΡΩΣΗ: η κλήρωση πίστωσε πριν από την αποδοχή';
  end if;
  select params->>'token' into tok from public.email_outbox
   where copy_id = 'feedback_prize_won' and category = 'transactional' and dedup_key = 'feedback_prize_won:' || c || ':' || w;
  if tok is null or tok !~ '^[A-Za-z0-9_-]{43}$' then raise exception 'ΚΛΗΡΩΣΗ: δεν μπήκε συναλλακτικό email με διακριτικό'; end if;
  if exists (select 1 from public.feedback_prize_offers where token_hash = tok)
     or not exists (select 1 from public.feedback_prize_offers where token_hash = encode(sha256(convert_to(tok, 'UTF8')), 'hex')) then
    raise exception 'ΚΛΗΡΩΣΗ: στη βάση δεν μένει μόνο το SHA-256 του διακριτικού';
  end if;
  if (select expires_at from public.feedback_prize_offers where campaign_id = c and user_id = w) not between now() + interval '13 days 23 hours' and now() + interval '14 days 1 hour' then
    raise exception 'ΚΛΗΡΩΣΗ: η λήξη δεν είναι 14 ημέρες';
  end if;
  if public.draw_feedback_winner(c) is not null then raise exception 'ΚΛΗΡΩΣΗ: δεύτερος νικητής ενώ ο πρώτος περιμένει'; end if;
  raise notice 'probe: η κλήρωση στέλνει email με σύνδεσμο 14 ημερών και δεν πιστώνει τίποτα';

  -- ── 2. Η αποδοχή: 18+, μία φορά, ένας χρόνος agency ──────────────────────
  if (public.peek_feedback_prize_token(tok)->>'ok')::boolean is not true then raise exception 'ΚΛΗΡΩΣΗ: η σελίδα δεν βλέπει την πρόσκληση'; end if;
  if public.accept_feedback_prize_token(tok, false)->>'kind' <> 'adult_required' then raise exception 'ΚΛΗΡΩΣΗ: αποδοχή χωρίς δήλωση ηλικίας'; end if;
  if public.accept_feedback_prize_token(tok, null)->>'kind' <> 'adult_required' then raise exception 'ΚΛΗΡΩΣΗ: αποδοχή με κενή δήλωση ηλικίας'; end if;
  if public.accept_feedback_prize_token(repeat('Z', 43), true)->>'kind' <> 'invalid' then raise exception 'ΚΛΗΡΩΣΗ: ξένο διακριτικό δεκτό'; end if;
  if public.accept_feedback_prize_token('../../x', true)->>'kind' <> 'invalid' then raise exception 'ΚΛΗΡΩΣΗ: λάθος σχήμα δεκτό'; end if;
  r := public.accept_feedback_prize_token(tok, true);
  if (r->>'ok')::boolean is not true then raise exception 'ΚΛΗΡΩΣΗ: η αποδοχή απέτυχε: %', r; end if;
  if public.accept_feedback_prize_token(tok, true)->>'kind' <> 'used' then raise exception 'ΚΛΗΡΩΣΗ: το διακριτικό δέχτηκε δεύτερη χρήση'; end if;
  if public.peek_feedback_prize_token(tok)->>'kind' <> 'used' then raise exception 'ΚΛΗΡΩΣΗ: η σελίδα δεν λέει ότι έγινε αποδεκτό'; end if;
  if not exists (select 1 from public.billing_profiles
                  where user_id = w and comp_plan = 'agency' and coalesce(comp_months_granted, 0) = 0 and comp_until > now() + interval '364 days') then
    raise exception 'ΚΛΗΡΩΣΗ: η αποδοχή δεν πίστωσε έναν χρόνο agency';
  end if;
  if not exists (select 1 from public.feedback_prize_offers
                  where campaign_id = c and user_id = w and status = 'accepted' and accepted_via = 'email' and adult_confirmed_at is not null) then
    raise exception 'ΚΛΗΡΩΣΗ: η δήλωση ηλικίας δεν γράφτηκε με ώρα';
  end if;
  if (select user_id from public.feedback_campaign_winners where campaign_id = c) is distinct from w then raise exception 'ΚΛΗΡΩΣΗ: ο νικητής δεν καταγράφηκε'; end if;
  if public.draw_feedback_winner(c) is not null then raise exception 'ΚΛΗΡΩΣΗ: νέα κλήρωση μετά την αποδοχή'; end if;
  begin
    update public.feedback_prize_offers set status = 'accepted', accepted_at = now(), accepted_via = 'app', adult_confirmed_at = null where campaign_id = c and user_id = w;
    raise exception 'ΚΛΗΡΩΣΗ: η βάση δέχτηκε αποδοχή χωρίς δήλωση ηλικίας';
  exception when check_violation then null;
  end;
  raise notice 'probe: η αποδοχή θέλει «άνω των 18», γίνεται μία φορά και πιστώνει έναν χρόνο agency';

  -- ── 3. Λήξη χωρίς άλλον συμμετέχοντα: ο μήνας μένει χωρίς νικητή ──────────
  w2 := public.draw_feedback_winner(c2);
  if w2 is distinct from u3 then raise exception 'ΚΛΗΡΩΣΗ: ο μόνος συμμετέχων δεν κληρώθηκε'; end if;
  select params->>'token' into tok2 from public.email_outbox where dedup_key = 'feedback_prize_won:' || c2 || ':' || w2;
  update public.feedback_prize_offers set expires_at = now() - interval '1 second' where campaign_id = c2;
  if public.accept_feedback_prize_token(tok2, true)->>'kind' <> 'expired' then raise exception 'ΚΛΗΡΩΣΗ: δεκτό μετά τη λήξη'; end if;
  perform public.draw_due_feedback_winners();
  if (select status from public.feedback_prize_offers where campaign_id = c2 and user_id = w2) <> 'expired' then raise exception 'ΚΛΗΡΩΣΗ: η λήξη δεν σημειώθηκε'; end if;
  select count(*) into n from public.feedback_prize_offers where campaign_id = c2;
  if n <> 1 then raise exception 'ΚΛΗΡΩΣΗ: νέα κλήρωση χωρίς συμμετέχοντα (% προσκλήσεις)', n; end if;
  if exists (select 1 from public.billing_profiles where user_id = w2 and comp_plan = 'agency') then raise exception 'ΚΛΗΡΩΣΗ: πίστωση χωρίς αποδοχή'; end if;
  raise notice 'probe: μετά τις 14 ημέρες, χωρίς άλλον συμμετέχοντα ο μήνας μένει χωρίς νικητή';

  -- ── 4. Λήξη με άλλον συμμετέχοντα: νέα κλήρωση στον ίδιο μήνα ─────────────
  delete from public.feedback_campaign_winners where campaign_id = c;
  update public.feedback_prize_offers
     set status = 'pending', accepted_at = null, accepted_via = null, adult_confirmed_at = null, expires_at = now() - interval '1 second'
   where campaign_id = c;
  perform public.draw_due_feedback_winners();
  other := case when w = u1 then u2 else u1 end;
  if (select user_id from public.feedback_prize_offers where campaign_id = c and status = 'pending') is distinct from other then
    raise exception 'ΚΛΗΡΩΣΗ: η νέα κλήρωση δεν πήγε στον άλλον συμμετέχοντα του ίδιου μήνα';
  end if;
  raise notice 'probe: μετά τις 14 ημέρες, νέα κλήρωση ανάμεσα στους υπόλοιπους του ίδιου μήνα';

  -- ── 5. Μέσα από την εφαρμογή: μόνο ο ίδιος ──────────────────────────────
  perform set_config('probe.uid', w::text, true);  -- ο προηγούμενος, χωρίς πρόσκληση σε αναμονή
  if public.accept_my_feedback_prize(true)->>'kind' <> 'invalid' then raise exception 'ΚΛΗΡΩΣΗ: άλλος αποδέχτηκε το δώρο του νικητή'; end if;
  perform set_config('probe.uid', other::text, true);
  if (public.my_feedback_status()->>'prize_expires_at') is null then raise exception 'ΚΛΗΡΩΣΗ: η εφαρμογή δεν βλέπει το δώρο που περιμένει'; end if;
  if public.accept_my_feedback_prize(false)->>'kind' <> 'adult_required' then raise exception 'ΚΛΗΡΩΣΗ: αποδοχή στην εφαρμογή χωρίς δήλωση ηλικίας'; end if;
  if (public.accept_my_feedback_prize(true)->>'ok')::boolean is not true then raise exception 'ΚΛΗΡΩΣΗ: η αποδοχή στην εφαρμογή απέτυχε'; end if;
  if (select accepted_via from public.feedback_prize_offers where campaign_id = c and user_id = other) <> 'app' then raise exception 'ΚΛΗΡΩΣΗ: δεν γράφτηκε ότι η αποδοχή έγινε στην εφαρμογή'; end if;
  perform set_config('probe.uid', '', true);
  raise notice 'probe: στην εφαρμογή ο νικητής αποδέχεται μόνο το δικό του δώρο';

  -- ── 5α. Η πίστωση ΠΡΟΣΤΙΘΕΤΑΙ και ΔΕΝ ΧΑΜΗΛΩΝΕΙ ───────────────────────────
  insert into auth.users(id, email) values
    (ux, 'ux@prize.test'), (ua, 'ua@prize.test'), (ue, 'ue@prize.test'), (ud, 'ud@prize.test'), (uo, 'uo@prize.test');
  insert into public.user_feedback(user_id, email, body, word_count, target, campaign_id, in_pool) values
    (ux, 'ux@prize.test', 'Σχόλιο δοκιμής', 2, 'general', c3, true),
    (ua, 'ua@prize.test', 'Σχόλιο δοκιμής', 2, 'general', c4, true),
    (ue, 'ue@prize.test', 'Σχόλιο δοκιμής', 2, 'general', c5, true),
    (ud, 'ud@prize.test', 'Σχόλιο δοκιμής', 2, 'general', c6, true),
    (uo, 'uo@prize.test', 'Σχόλιο δοκιμής', 2, 'general', c6, true);
  insert into public.billing_profiles(user_id, comp_plan, comp_until, comp_started_at, comp_months_granted) values
    (ux, 'office', now() + interval '3 months', now() - interval '1 month', 4),
    (ua, 'owner',  now() + interval '2 months', now() - interval '1 month', 3),
    (ue, 'owner',  now() - interval '1 month',  now() - interval '4 months', 3)
  on conflict (user_id) do update set comp_plan = excluded.comp_plan, comp_until = excluded.comp_until,
    comp_started_at = excluded.comp_started_at, comp_months_granted = excluded.comp_months_granted;

  perform public.draw_feedback_winner(c3); select params->>'token' into t3 from public.email_outbox where dedup_key = 'feedback_prize_won:' || c3 || ':' || ux;
  perform public.draw_feedback_winner(c4); select params->>'token' into t4 from public.email_outbox where dedup_key = 'feedback_prize_won:' || c4 || ':' || ua;
  perform public.draw_feedback_winner(c5); select params->>'token' into t5 from public.email_outbox where dedup_key = 'feedback_prize_won:' || c5 || ':' || ue;
  if t3 is null or t4 is null or t5 is null or (select params->>'acceptDays' from public.email_outbox where dedup_key = 'feedback_prize_won:' || c3 || ':' || ux) <> '14' then
    raise exception 'ΚΛΗΡΩΣΗ: λείπει πρόσκληση ή οι ημέρες στο email';
  end if;

  select comp_until into before from public.billing_profiles where user_id = ux;
  perform public.accept_feedback_prize_token(t3, true);
  select * into bp from public.billing_profiles where user_id = ux;
  if bp.comp_plan <> 'office' then raise exception 'ΚΛΗΡΩΣΗ: η αποδοχή χαμήλωσε «Επαγγελματίας+» σε %', bp.comp_plan; end if;
  if bp.comp_until <> before + interval '12 months' then raise exception 'ΚΛΗΡΩΣΗ: ο χρόνος δεν προστέθηκε στο ενεργό comp (%, ήταν %)', bp.comp_until, before; end if;
  if bp.comp_months_granted <> 4 then raise exception 'ΚΛΗΡΩΣΗ: η αποδοχή άγγιξε τον μετρητή του Προγράμματος Πρόσκλησης (%)', bp.comp_months_granted; end if;

  select comp_until into before from public.billing_profiles where user_id = ua;
  perform public.accept_feedback_prize_token(t4, true);
  select * into bp from public.billing_profiles where user_id = ua;
  if bp.comp_plan <> 'agency' or bp.comp_until <> before + interval '12 months' or bp.comp_months_granted <> 3 then
    raise exception 'ΚΛΗΡΩΣΗ: ενεργό comp δεν επεκτάθηκε κατά 12 μήνες «Επαγγελματίας»: % % %', bp.comp_plan, bp.comp_until, bp.comp_months_granted;
  end if;

  perform public.accept_feedback_prize_token(t5, true);
  select * into bp from public.billing_profiles where user_id = ue;
  if bp.comp_plan <> 'agency' or bp.comp_until not between now() + interval '12 months' - interval '1 minute' and now() + interval '12 months' + interval '1 minute'
     or bp.comp_started_at < now() - interval '1 minute' then
    raise exception 'ΚΛΗΡΩΣΗ: ληγμένο comp δεν ξεκίνησε από σήμερα: % % %', bp.comp_plan, bp.comp_until, bp.comp_started_at;
  end if;
  raise notice 'probe: η πίστωση προστίθεται στο comp, κρατά το ανώτερο πακέτο και δεν αγγίζει τον μετρητή της πρόσκλησης';

  -- ── 5β. Η sync της πρόσκλησης δεν χαμηλώνει το δώρο της κλήρωσης ─────────────
  -- Ο ua έχει «Επαγγελματίας» ως +14 μήνες· παίρνει 4 μήνες «Ιδιοκτήτης+» (3 είχε ήδη).
  select comp_until into before from public.billing_profiles where user_id = ua;
  insert into public.referral_rewards (user_id, kind, months, tier, reason, status) values
    (ua, 'months', 4, 'owner', 'pro_paid', 'pending');
  perform set_config('probe.uid', ua::text, true);
  perform public.sync_comp_from_referrals();
  perform set_config('probe.uid', '', true);
  select * into bp from public.billing_profiles where user_id = ua;
  if bp.comp_plan <> 'agency' then raise exception 'ΚΛΗΡΩΣΗ: η sync χαμήλωσε το δώρο της κλήρωσης σε %', bp.comp_plan; end if;
  if bp.comp_until < before then raise exception 'ΚΛΗΡΩΣΗ: η sync μίκρυνε το comp_until (%, ήταν %)', bp.comp_until, before; end if;
  if bp.comp_until <> before + interval '1 month' or bp.comp_months_granted <> 4 then
    raise exception 'ΚΛΗΡΩΣΗ: ο νέος μήνας πρόσκλησης δεν προστέθηκε μετά το δώρο: % %', bp.comp_until, bp.comp_months_granted;
  end if;
  raise notice 'probe: η sync της πρόσκλησης προσθέτει χωρίς να χαμηλώνει ή να μικραίνει το δώρο της κλήρωσης';

  -- ── 5γ. Σβησμένος λογαριασμός μετά την αποδοχή: ο μήνας μένει κλειστός ──────
  perform public.draw_feedback_winner(c6);
  select user_id into w from public.feedback_prize_offers where campaign_id = c6;
  perform set_config('probe.uid', w::text, true);
  perform public.accept_my_feedback_prize(true);
  perform set_config('probe.uid', '', true);
  delete from auth.users where id = w;
  if public.draw_feedback_winner(c6) is not null then raise exception 'ΚΛΗΡΩΣΗ: δεύτερη κλήρωση στον ίδιο μήνα επειδή ο νικητής έσβησε τον λογαριασμό του'; end if;
  perform public.draw_due_feedback_winners();
  if exists (select 1 from public.feedback_prize_offers where campaign_id = c6) then raise exception 'ΚΛΗΡΩΣΗ: νέα πρόσκληση σε κλειστό μήνα'; end if;
  raise notice 'probe: ο μήνας κλείνει με την αποδοχή, ακόμη κι αν ο νικητής σβήσει τον λογαριασμό του';

  -- ── 6. Δικαιώματα ────────────────────────────────────────────────────────
  -- Ο ΠΙΝΑΚΑΣ: εδώ το rls-probe έχει δώσει επίτηδες SELECT σε όλους τους πίνακες,
  -- οπότε το δικαίωμα δεν λέει τίποτα. Ρωτάμε τη βάση ως ο ίδιος ο νικητής:
  -- RLS χωρίς καμία πολιτική σημαίνει μηδέν γραμμές, ακόμη και τις δικές του.
  perform set_config('probe.uid', other::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into n from public.feedback_prize_offers;
  perform set_config('role', 'postgres', true);
  perform set_config('probe.uid', '', true);
  if n <> 0 then raise exception 'ΑΝΟΙΧΤΗ ΠΟΡΤΑ: ο συνδεδεμένος διαβάζει % γραμμές του πίνακα των προσκλήσεων', n; end if;
  if has_function_privilege('anon', 'public.accept_feedback_prize_token(text, boolean)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.accept_feedback_prize_token(text, boolean)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.peek_feedback_prize_token(text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.draw_feedback_winner(text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.draw_due_feedback_winners()', 'EXECUTE')
     or has_function_privilege('anon', 'public.accept_my_feedback_prize(boolean)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.accept_my_feedback_prize(boolean)', 'EXECUTE') then
    raise exception 'ΑΝΟΙΧΤΗ ΠΟΡΤΑ: τα δικαιώματα της κλήρωσης δεν είναι όπως πρέπει';
  end if;
  raise notice 'probe: ο πίνακας και η αποδοχή με διακριτικό μένουν στην υπηρεσία';
end $probe$;
rollback;
