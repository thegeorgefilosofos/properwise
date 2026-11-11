-- ═══════════════════════════════════════════════════════════════════════════
--  ΣΕΙΡΑ ΔΙΑΘΕΣΗΣ ΚΑΙ ΥΠΟΣΤΗΡΙΞΗ, ΟΠΩΣ ΤΙΣ ΛΕΝΕ ΟΙ ΟΡΟΙ (20261110134000)
-- ─────────────────────────────────────────────────────────────────────────
--  Σε συναλλαγή που αναιρείται πάντα.
--   · κύματα της εφαρμογής κινητού: first («Επαγγελματίας+») → priority (από
--     «Ιδιοκτήτης+», με τη δοκιμή, office_lead_days() μετά) → everyone
--     (early_access_days() μετά)· κάθε κύμα πριν από την ώρα του αρνείται·
--   · δέσμευση: δεύτερη κλήση δεν ξαναπαίρνει τις ίδιες γραμμές· ληγμένη
--     δέσμευση ξαναβγαίνει·
--   · μόνιμη αποτυχία δεν ξαναβγαίνει· πέντε προσωρινές γίνονται μόνιμη·
--   · support_inbox, release_waves και οι συναρτήσεις: μόνο ο ρόλος υπηρεσίας.
-- ═══════════════════════════════════════════════════════════════════════════
reset role;
-- Ο συνδεδεμένος χρήστης, όπως στο rls-probe: από τη ρύθμιση probe.uid.
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('probe.uid', true), '')::uuid $$;
begin;
select set_config('request.jwt.claims', '{"aal":"aal2"}', true);
do $probe$
declare
  u_office uuid := 'e7000000-0000-4000-8000-000000000001';
  u_owner  uuid := 'e7000000-0000-4000-8000-000000000002';
  u_trial  uuid := 'e7000000-0000-4000-8000-000000000003';
  u_free   uuid := 'e7000000-0000-4000-8000-000000000004';
  got uuid[];
  n int;
  left_ int;
  i int;
  blocked boolean;
  leaked text;
  acc json;
  r_id uuid;
  st text;
begin
  -- ── 0. Μόνο ο ρόλος υπηρεσίας ─────────────────────────────────────────
  select string_agg(what, ', ') into leaked from (values
      ('mobile_launch_claim', has_function_privilege('authenticated', 'public.mobile_launch_claim(text,integer)', 'execute')),
      ('mobile_launch_settle', has_function_privilege('anon', 'public.mobile_launch_settle(uuid[],uuid[],uuid[],uuid[])', 'execute')),
      ('support_rank_for_email', has_function_privilege('authenticated', 'public.support_rank_for_email(text)', 'execute')),
      ('support_inbox_owner', has_function_privilege('authenticated', 'public.support_inbox_owner()', 'execute')),
      ('mobile_access(anon)', has_function_privilege('anon', 'public.mobile_access()', 'execute')),
      ('support_submit', has_function_privilege('authenticated', 'public.support_submit(uuid,text,text)', 'execute')),
      ('support_withdraw', has_function_privilege('authenticated', 'public.support_withdraw(uuid,uuid)', 'execute')),
      ('support_forward_claim', has_function_privilege('authenticated', 'public.support_forward_claim(integer,text)', 'execute')),
      ('support_forward_settle', has_function_privilege('authenticated', 'public.support_forward_settle(uuid,text,text,boolean)', 'execute')),
      ('support_forward_expire', has_function_privilege('anon', 'public.support_forward_expire()', 'execute')),
      ('support_inbox_health', has_function_privilege('authenticated', 'public.support_inbox_health()', 'execute'))
    ) t(what, ok) where ok;
  if leaked is not null then
    raise exception 'ΠΑΡΑΒΙΑΣΗ: ο χρήστης φτάνει %', leaked;
  end if;
  -- Οι πίνακες: RLS χωρίς πολιτική. Γραμμή του ρόλου υπηρεσίας δεν φαίνεται στον χρήστη.
  insert into public.support_inbox(provider_id, from_email) values ('em_rls', 'x@probe.test');
  insert into public.release_waves(feature, wave) values ('probe_rls', 'first');
  set local role authenticated;
  if (select count(*) from public.support_inbox) + (select count(*) from public.release_waves) <> 0 then
    reset role;
    raise exception 'ΠΑΡΑΒΙΑΣΗ: ο χρήστης βλέπει το support_inbox ή τα κύματα';
  end if;
  reset role;
  delete from public.support_inbox where provider_id = 'em_rls';
  delete from public.release_waves where feature = 'probe_rls';

  if public.support_rank_for_email('kanenas@example.invalid') <> 0 then
    raise exception 'ΥΠΟΣΤΗΡΙΞΗ: άγνωστος αποστολέας με επίπεδο';
  end if;
  raise notice 'probe: σειρά διάθεσης και support_inbox μόνο για τον ρόλο υπηρεσίας';
  -- Τα μηνύματα υποστήριξης φεύγουν με τον λογαριασμό.
  insert into auth.users(id, email, email_confirmed_at) values ('e7000000-0000-4000-8000-0000000000aa', 'gone@probe.test', now());
  insert into public.support_inbox(provider_id, from_email) values ('em_probe', 'GONE@probe.test ');
  if (select user_id from public.support_inbox where provider_id = 'em_probe') is distinct from 'e7000000-0000-4000-8000-0000000000aa'::uuid then
    raise exception 'ΥΠΟΣΤΗΡΙΞΗ: το μήνυμα δεν δέθηκε με τον λογαριασμό του αποστολέα';
  end if;
  delete from auth.users where id = 'e7000000-0000-4000-8000-0000000000aa';
  if exists (select 1 from public.support_inbox where provider_id = 'em_probe') then
    raise exception 'ΥΠΟΣΤΗΡΙΞΗ: το email έμεινε μετά τη διαγραφή του λογαριασμού';
  end if;
  raise notice 'probe: τα μηνύματα υποστήριξης φεύγουν με τον λογαριασμό';

  -- Τέσσερις χρήστες: Επαγγελματίας+, Ιδιοκτήτης+, σε δοκιμή, χωρίς πακέτο.
  insert into auth.users(id, email, email_confirmed_at, created_at) values
    (u_office, 'office@probe.test', now(), now() - interval '400 days'),
    (u_owner,  'owner@probe.test',  now(), now() - interval '400 days'),
    (u_trial,  'trial@probe.test',  now(), now() - interval '2 days'),
    (u_free,   'free@probe.test',   now(), now() - interval '400 days');
  insert into public.billing_profiles(user_id, plan, subscription_status) values
    (u_office, 'office', 'active'), (u_owner, 'owner', 'active'),
    (u_trial, 'free', null), (u_free, 'free', null)
    on conflict (user_id) do update set plan = excluded.plan, subscription_status = excluded.subscription_status;
  insert into public.mobile_waitlist(user_id, email) values
    (u_office, 'office@probe.test'), (u_owner, 'owner@probe.test'),
    (u_trial, 'trial@probe.test'), (u_free, 'free@probe.test')
    on conflict (user_id) do nothing;

  -- ── 0β. Το κλείδωμα της εφαρμογής πριν από κάθε κύμα: κλειστό, χωρίς μέρα
  perform set_config('probe.uid', u_office::text, true);
  acc := public.mobile_access();
  if (acc->>'open')::boolean or acc->>'wave' <> 'first' or acc->>'opens_at' is not null then
    raise exception 'ΚΛΕΙΔΩΜΑ: το «Επαγγελματίας+» πριν από κάθε κύμα: %', acc;
  end if;
  perform set_config('probe.uid', '', true);
  blocked := false;
  begin perform public.mobile_access();
  exception when others then blocked := sqlerrm = 'not_authenticated'; end;
  if not blocked then raise exception 'ΚΛΕΙΔΩΜΑ: χωρίς συνεδρία απάντησε'; end if;

  -- ── 1. Κανένα κύμα πριν από την ώρα του ───────────────────────────────
  blocked := false;
  begin perform * from public.mobile_launch_claim('priority', 50);
  exception when others then blocked := sqlerrm = 'early_access_window'; end;
  if not blocked then raise exception 'ΣΕΙΡΑ: το priority έφυγε πριν από το first'; end if;

  select array_agg(user_id) into got from public.mobile_launch_claim('first', 50);
  if got is distinct from array[u_office] then
    raise exception 'ΣΕΙΡΑ: το first δεν είναι μόνο το «Επαγγελματίας+» (%)', got;
  end if;
  raise notice 'probe: πρώτο κύμα μόνο το «Επαγγελματίας+»';
  -- Το κύμα first άνοιξε: ανοιχτή για το office, κλειστή για τον owner με μέρα.
  perform set_config('probe.uid', u_office::text, true);
  if not (public.mobile_access()->>'open')::boolean then raise exception 'ΚΛΕΙΔΩΜΑ: το office δεν μπαίνει μετά το first'; end if;
  perform set_config('probe.uid', u_owner::text, true);
  acc := public.mobile_access();
  if (acc->>'open')::boolean or acc->>'wave' <> 'priority' or acc->>'opens_at' is null then
    raise exception 'ΚΛΕΙΔΩΜΑ: ο «Ιδιοκτήτης+» μπαίνει μαζί με το office ή χωρίς μέρα: %', acc;
  end if;
  perform set_config('probe.uid', u_trial::text, true);
  if public.mobile_access()->>'wave' <> 'priority' then raise exception 'ΚΛΕΙΔΩΜΑ: η δοκιμή δεν είναι στο κύμα του «Ιδιοκτήτης+»'; end if;
  perform set_config('probe.uid', u_free::text, true);
  acc := public.mobile_access();
  if (acc->>'open')::boolean or acc->>'opens_at' is not null then
    raise exception 'ΚΛΕΙΔΩΜΑ: χωρίς πακέτο ανοιχτή ή με μέρα πριν από το priority: %', acc;
  end if;
  perform set_config('probe.uid', '', true);
  raise notice 'probe: η εφαρμογή ανοίγει με το κύμα του πακέτου';

  -- ── 2. Δέσμευση: η δεύτερη ταυτόχρονη κλήση δεν ξαναπαίρνει τίποτα ────
  select count(*) into n from public.mobile_launch_claim('first', 50);
  if n <> 0 then raise exception 'ΔΙΠΛΗ ΑΠΟΣΤΟΛΗ: η δεσμευμένη γραμμή ξαναβγήκε'; end if;
  update public.mobile_waitlist set notifying_at = now() - interval '16 minutes' where user_id = u_office;
  select count(*) into n from public.mobile_launch_claim('first', 50);
  if n <> 1 then raise exception 'ΧΑΜΕΝΗ ΑΠΟΣΤΟΛΗ: η ληγμένη δέσμευση δεν ξαναβγαίνει'; end if;
  raise notice 'probe: δέσμευση πριν από την αποστολή, με λήξη';

  -- ── 3. priority: office_lead_days() μετά, από «Ιδιοκτήτης+» με τη δοκιμή
  blocked := false;
  begin perform * from public.mobile_launch_claim('priority', 50);
  exception when others then blocked := sqlerrm = 'early_access_window'; end;
  if not blocked then raise exception 'ΣΕΙΡΑ: το priority έφυγε μαζί με το first'; end if;
  update public.release_waves set started_at = now() - (public.office_lead_days() || ' days')::interval - interval '1 minute'
   where feature = 'mobile_app' and wave = 'first';
  select array_agg(user_id order by user_id) into got from public.mobile_launch_claim('priority', 50);
  if got is distinct from array[u_owner, u_trial] then
    raise exception 'ΣΕΙΡΑ: το priority δεν είναι «Ιδιοκτήτης+» και δοκιμή (%)', got;
  end if;
  raise notice 'probe: δεύτερο κύμα από «Ιδιοκτήτης+», με τη δοκιμή';

  -- ── 4. Αποτελέσματα: μόνιμη αποτυχία δεν ξαναβγαίνει, πέντε προσωρινές ─
  left_ := public.mobile_launch_settle(array[u_office], array[u_owner], array[u_trial], null);
  if left_ <> 2 then raise exception 'ΣΗΜΕΙΩΣΗ: περιμένουν % αντί για 2', left_; end if;
  for i in 1..4 loop
    update public.mobile_waitlist set notifying_at = null where user_id = u_trial;
    perform public.mobile_launch_settle(null, null, array[u_trial], null);
  end loop;
  if (select failed_at from public.mobile_waitlist where user_id = u_trial) is null then
    raise exception 'ΑΤΕΛΕΙΩΤΗ ΕΠΑΝΑΛΗΨΗ: πέντε προσωρινές αποτυχίες δεν έγιναν μόνιμη';
  end if;
  select count(*) into n from public.mobile_launch_claim('priority', 50);
  if n <> 0 then raise exception 'ΜΟΝΙΜΗ ΑΠΟΤΥΧΙΑ: ξαναβγήκε στο κύμα'; end if;
  raise notice 'probe: οι αποτυχίες σημειώνονται και η επανάληψη τελειώνει';

  -- Λάθος ρύθμισης δικό μας: η δέσμευση λύνεται χωρίς χρέωση στον παραλήπτη.
  update public.mobile_waitlist set notifying_at = now() where user_id = u_free;
  perform public.mobile_launch_settle(null, null, null, array[u_free]);
  if (select notifying_at is not null or fail_count <> 0 or failed_at is not null
        from public.mobile_waitlist where user_id = u_free) then
    raise exception 'ΜΟΝΙΜΗ ΑΠΟΤΥΧΙΑ: λάθος ρύθμισης χρεώθηκε στον παραλήπτη';
  end if;
  -- Όποιος ξαναμπαίνει στη λίστα ξεκινά καθαρά.
  perform set_config('probe.uid', u_owner::text, true);
  perform public.join_mobile_waitlist();
  perform set_config('probe.uid', '', true);
  if (select failed_at is not null or fail_count <> 0 from public.mobile_waitlist where user_id = u_owner) then
    raise exception 'ΜΟΝΙΜΗ ΑΠΟΤΥΧΙΑ: το ξαναμπαίνω δεν καθάρισε την παλιά αποτυχία';
  end if;
  update public.mobile_waitlist set failed_at = now() where user_id = u_owner;
  raise notice 'probe: λάθος ρύθμισης χωρίς χρέωση, ξαναμπαίνω καθαρά';

  -- ── 5. everyone: early_access_days() μετά το priority ─────────────────
  blocked := false;
  begin perform * from public.mobile_launch_claim('everyone', 50);
  exception when others then blocked := sqlerrm = 'early_access_window'; end;
  if not blocked then raise exception 'ΣΕΙΡΑ: όλοι ειδοποιήθηκαν πριν από τις % ημέρες', public.early_access_days(); end if;
  update public.release_waves set started_at = now() - (public.early_access_days() || ' days')::interval - interval '1 minute'
   where feature = 'mobile_app' and wave = 'priority';
  select array_agg(user_id) into got from public.mobile_launch_claim('everyone', 50);
  if got is distinct from array[u_free] then
    raise exception 'ΣΕΙΡΑ: το everyone δεν είναι μόνο όσοι περιμένουν (%)', got;
  end if;
  raise notice 'probe: τρίτο κύμα % ημέρες μετά, μόνο όσοι περιμένουν', public.early_access_days();
  perform set_config('probe.uid', u_free::text, true);
  if not (public.mobile_access()->>'open')::boolean then raise exception 'ΚΛΕΙΔΩΜΑ: χωρίς πακέτο κλειστή μετά το everyone'; end if;
  perform set_config('probe.uid', '', true);

  -- ── 6. Η φόρμα υποστήριξης: ρητός χρήστης, όριο ρυθμού χωρίς αγώνα ─────
  if (select position('pg_advisory_xact_lock' in prosrc) = 0
          or position('pg_advisory_xact_lock' in prosrc) > position('count(*)' in prosrc)
        from pg_proc where proname = 'support_submit') then
    raise exception 'ΥΠΟΣΤΗΡΙΞΗ: η μέτρηση του ορίου γίνεται χωρίς κλείδωμα ανά χρήστη (αγώνας)';
  end if;
  acc := public.support_submit(u_office, 'Θέμα', 'k0');
  if (select (sender_verified and priority_claimed and kind = 'form' and user_id = u_office and from_email = 'office@probe.test')
        from public.support_inbox where id = (acc->>'id')::uuid) is not true then
    raise exception 'ΥΠΟΣΤΗΡΙΞΗ: η φόρμα δεν γράφει επαληθευμένο αποστολέα με την προτεραιότητά του';
  end if;
  if not (public.support_submit(u_office, 'Θέμα', 'k0')->>'duplicate')::boolean
     or (select count(*) from public.support_inbox where user_id = u_office and kind = 'form') <> 1 then
    raise exception 'ΥΠΟΣΤΗΡΙΞΗ: το ίδιο μήνυμα έγραψε δεύτερη γραμμή';
  end if;
  for i in 1..4 loop perform public.support_submit(u_office, 'x', 'k' || i); end loop;
  blocked := false;
  begin perform public.support_submit(u_office, 'έκτο', 'k6');
  exception when others then blocked := sqlerrm = 'rate_limited'; end;
  if not blocked then raise exception 'ΥΠΟΣΤΗΡΙΞΗ: έκτο μήνυμα μέσα στην ώρα πέρασε'; end if;
  perform public.support_withdraw(u_owner, (acc->>'id')::uuid);
  if not exists (select 1 from public.support_inbox where id = (acc->>'id')::uuid) then
    raise exception 'ΥΠΟΣΤΗΡΙΞΗ: ο χρήστης απέσυρε μήνυμα άλλου';
  end if;
  perform public.support_withdraw(u_office, (acc->>'id')::uuid);
  if exists (select 1 from public.support_inbox where id = (acc->>'id')::uuid) then
    raise exception 'ΥΠΟΣΤΗΡΙΞΗ: το μη προωθημένο μήνυμα δεν αποσύρθηκε';
  end if;
  acc := public.support_submit(u_owner, 'Θέμα', 'k0');
  if (select priority_claimed from public.support_inbox where id = (acc->>'id')::uuid) then
    raise exception 'ΥΠΟΣΤΗΡΙΞΗ: προτεραιότητα κάτω από το «Επαγγελματίας+»';
  end if;

  -- privacy@ και security@: η γραμμή μένει ως ίχνος, χωρίς σύνδεση με τον λογαριασμό.
  insert into auth.users(id, email, email_confirmed_at) values ('e7000000-0000-4000-8000-0000000000bb', 'priv@probe.test', now());
  insert into public.support_inbox(provider_id, from_email, kind) values ('em_priv', 'priv@probe.test', 'privacy');
  if (select user_id is not null or kept_for is distinct from 'e7000000-0000-4000-8000-0000000000bb'::uuid
        from public.support_inbox where provider_id = 'em_priv') then
    raise exception 'ΥΠΟΣΤΗΡΙΞΗ: αίτημα privacy@ δεμένο για διαγραφή μαζί με τον λογαριασμό';
  end if;
  delete from auth.users where id = 'e7000000-0000-4000-8000-0000000000bb';
  if (select kept_for from public.support_inbox where provider_id = 'em_priv') is not null
     or not exists (select 1 from public.support_inbox where provider_id = 'em_priv') then
    raise exception 'ΥΠΟΣΤΗΡΙΞΗ: το ίχνος του αιτήματος privacy@ χάθηκε ή έμεινε συνδεδεμένο';
  end if;
  raise notice 'probe: φόρμα με ρητό χρήστη, όριο χωρίς αγώνα, ένα μήνυμα ανά κείμενο, ίχνος privacy@';

  -- ── 7. Η προώθηση των email: δέσμευση, γενιές, προσπάθειες, λήξη ───────
  insert into public.support_inbox(provider_id, from_email, kind, forward_subject, reply_to)
    values ('em_f1', 'x@probe.test', 'support', 'Θ', 'X <x@probe.test>') returning id into r_id;
  -- Δέσμευση: η δεύτερη κλήση δεν ξαναπαίρνει την ίδια γραμμή.
  if (select count(*) from public.support_forward_claim(5, 'em_f1')) <> 1
     or (select count(*) from public.support_forward_claim(5, 'em_f1')) <> 0 then
    raise exception 'ΠΡΟΩΘΗΣΗ: η γραμμή δεν δεσμεύεται ή δεσμεύεται δύο φορές';
  end if;
  -- Λάθος ρύθμισης: δεν μετρά, ίδια γενιά, ξανά αργότερα.
  st := public.support_forward_settle(r_id, 'config', 'config:401', false);
  if st <> 'pending' or (select forward_attempts <> 0 or forward_gen <> 0 or next_attempt_at <= now()
                           from public.support_inbox where id = r_id) then
    raise exception 'ΠΡΟΩΘΗΣΗ: λάθος ρύθμισης χρεώθηκε στο μήνυμα ή ξαναδοκιμάζεται αμέσως';
  end if;
  -- Σίγουρη αποτυχία μηνύματος: +1 και νέα γενιά.
  st := public.support_forward_settle(r_id, 'message', 'message:400', false);
  if (select forward_attempts <> 1 or forward_gen <> 1 from public.support_inbox where id = r_id) then
    raise exception 'ΠΡΟΩΘΗΣΗ: σίγουρη αποτυχία χωρίς νέα γενιά κλειδιού';
  end if;
  -- Αβέβαιη προσπάθεια: η γενιά ΔΕΝ αλλάζει μετά, ούτε σε σίγουρη αποτυχία.
  st := public.support_forward_settle(r_id, 'retry', '503', true);
  st := public.support_forward_settle(r_id, 'message', 'message:409', true);
  if (select forward_gen <> 1 or forward_attempts <> 2 from public.support_inbox where id = r_id) then
    raise exception 'ΠΡΟΩΘΗΣΗ: νέα γενιά μετά από αβέβαιη προσπάθεια (δεύτερο μήνυμα)';
  end if;
  st := public.support_forward_settle(r_id, 'message', 'message:400', false);
  if st <> 'failed' then raise exception 'ΠΡΟΩΘΗΣΗ: τρίτη αποτυχία μηνύματος χωρίς failed'; end if;
  update public.support_inbox set next_attempt_at = now() - interval '1 minute' where id = r_id;
  if (select count(*) from public.support_forward_claim(5, 'em_f1')) <> 0 then
    raise exception 'ΠΡΟΩΘΗΣΗ: η οριστική αποτυχία ξαναβγαίνει στην ουρά';
  end if;
  -- Η ουρά προχωρά με next_attempt_at: ό,τι δεν είναι ώρα του δεν μπλοκάρει.
  insert into public.support_inbox(provider_id, from_email, kind, next_attempt_at) values
    ('em_f2', 'x@probe.test', 'support', now() + interval '1 hour'),
    ('em_f3', 'x@probe.test', 'support', now() - interval '5 minutes');
  if (select array_agg(provider_id) from public.support_forward_claim(5) where provider_id like 'em_f%') is distinct from array['em_f3'] then
    raise exception 'ΠΡΟΩΘΗΣΗ: η ουρά δεν σέβεται το next_attempt_at';
  end if;
  -- Λήξη μετά από 7 ημέρες: failed, μετρημένη, ποτέ σιωπηλά.
  insert into public.support_inbox(provider_id, from_email, kind, received_at) values
    ('em_old', 'x@probe.test', 'support', now() - interval '8 days');
  -- Δύο εντολές: η ανάγνωση στην ίδια εντολή με τη λήξη θα έβλεπε τα πριν.
  if public.support_forward_expire() < 1 then raise exception 'ΠΡΟΩΘΗΣΗ: η λήξη δεν μέτρησε το μήνυμα 8 ημερών'; end if;
  if (select forward_state <> 'failed' or forward_error <> 'expired' from public.support_inbox where provider_id = 'em_old') then
    raise exception 'ΠΡΟΩΘΗΣΗ: μήνυμα 8 ημερών δεν έγινε failed';
  end if;
  -- Health: όσα περιμένουν πάνω από μία ώρα.
  insert into public.support_inbox(provider_id, from_email, kind, received_at) values
    ('em_stale', 'x@probe.test', 'support', now() - interval '2 hours');
  if (public.support_inbox_health()->>'stale_pending')::int < 1 or (public.support_inbox_health()->>'failed_24h')::int < 1 then
    raise exception 'ΠΡΟΩΘΗΣΗ: το health δεν βλέπει τις εκκρεμότητες';
  end if;
  raise notice 'probe: προώθηση με δέσμευση, γενιές, τρεις προσπάθειες, λήξη 7 ημερών και health';
end
$probe$;
rollback;
