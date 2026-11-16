-- ═══════════════════════════════════════════════════════════════════════════
-- ΠΟΙΟΣ ΒΛΕΠΕΙ ΤΙΣ ΦΩΤΟΓΡΑΦΙΕΣ ΑΠΟΓΡΑΦΗΣ ΚΑΙ ΠΑΡΑΔΟΣΗΣ
-- ─────────────────────────────────────────────────────────────────────────
-- Το bucket «inventory-photos» έγινε ιδιωτικό (20261110140000). Η πολιτική
-- inventory_photos_select_own κρίνει από το ακίνητο της διαδρομής
-- «<uid όποιου ανέβασε>/<ακίνητο>/…» μέσω της private.inventory_photo_visible.
-- Εδώ δοκιμάζονται, με πραγματικές γραμμές στο storage.objects:
--   ιδιοκτήτης · μέλος χωρίς scope · μέλος με scope σε ένα ακίνητο ·
--   προσκεκλημένο (όχι ενεργό) μέλος · άσχετος χρήστης · anon.
-- Τρέχει σε κλώνο (scripts/db-replay.sh), γιατί γράφει γραμμές.
-- ═══════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('probe.uid', true), '')::uuid $$;
create or replace function auth.jwt() returns jsonb language sql stable as
$$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
set session "request.jwt.claims" = '{"aal":"aal2"}';
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated, anon;
grant select on storage.objects to authenticated, anon;

do $seed$
declare
  o uuid := '0a0a0a0a-0000-4000-8000-000000000001';  -- ιδιοκτήτης
  m uuid := '0a0a0a0a-0000-4000-8000-000000000002';  -- μέλος χωρίς scope
  s uuid := '0a0a0a0a-0000-4000-8000-000000000003';  -- μέλος με scope = {P1}
  i uuid := '0a0a0a0a-0000-4000-8000-000000000004';  -- προσκεκλημένο, όχι ενεργό
  x uuid := '0a0a0a0a-0000-4000-8000-000000000005';  -- άσχετος
  p1 uuid := '0b0b0b0b-0000-4000-8000-000000000001';
  p2 uuid := '0b0b0b0b-0000-4000-8000-000000000002';
  px uuid := '0b0b0b0b-0000-4000-8000-000000000003';
  org uuid := '0c0c0c0c-0000-4000-8000-000000000001';
begin
  insert into auth.users(id, email) values
    (o, 'o@photo.test'), (m, 'm@photo.test'), (s, 's@photo.test'), (i, 'i@photo.test'), (x, 'x@photo.test');
  insert into public.user_properties(id, user_id, name) values (p1, o, 'Π1'), (p2, o, 'Π2'), (px, x, 'Του άσχετου');
  insert into public.organizations(id, owner_user_id, name) values (org, o, 'Οργανισμός Ο');
  insert into public.organization_members(org_id, user_id, email, role, status, property_scope) values
    (org, m, 'm@photo.test', 'member', 'active', null),
    (org, s, 's@photo.test', 'member', 'active', array[p1]),
    (org, i, 'i@photo.test', 'member', 'invited', null);
  insert into storage.buckets(id, name, public) values ('inventory-photos', 'inventory-photos', false)
    on conflict (id) do update set public = false;
  insert into storage.objects(bucket_id, name) values
    ('inventory-photos', o || '/' || p1 || '/a.jpg'),
    ('inventory-photos', o || '/' || p2 || '/b.jpg'),
    ('inventory-photos', m || '/' || p1 || '/handover/c.jpg'),   -- ανέβασμα μέλους
    ('inventory-photos', x || '/' || px || '/d.jpg'),
    ('inventory-photos', x || '/' || p1 || '/e.jpg');            -- ξένος γράφει «Π1» στη διαδρομή του
end $seed$;

create temp table seen_expected(who text, uid uuid, want text);
insert into seen_expected values
  ('ιδιοκτήτης',             '0a0a0a0a-0000-4000-8000-000000000001', 'a.jpg,b.jpg,c.jpg'),
  ('μέλος χωρίς scope',      '0a0a0a0a-0000-4000-8000-000000000002', 'a.jpg,b.jpg,c.jpg'),
  ('μέλος με scope Π1',      '0a0a0a0a-0000-4000-8000-000000000003', 'a.jpg,c.jpg'),
  ('προσκεκλημένο μέλος',    '0a0a0a0a-0000-4000-8000-000000000004', ''),
  ('άσχετος',                '0a0a0a0a-0000-4000-8000-000000000005', 'd.jpg,e.jpg');
grant select on seen_expected to authenticated, anon;

set role authenticated;
do $probe$
declare r record; got text;
begin
  for r in select * from seen_expected loop
    perform set_config('probe.uid', r.uid::text, false);
    select coalesce(string_agg(storage.filename(name), ',' order by storage.filename(name)), '') into got
      from storage.objects where bucket_id = 'inventory-photos';
    if got <> r.want then
      raise exception 'ΔΙΑΡΡΟΗ ΦΩΤΟΓΡΑΦΙΩΝ: % βλέπει «%», έπρεπε «%»', r.who, got, r.want;
    end if;
    raise notice 'probe: φωτογραφίες: % βλέπει %', r.who, coalesce(nullif(r.want, ''), 'τίποτα');
  end loop;
end $probe$;
reset role;

set session "probe.uid" = '';
set role anon;
do $probe$
declare n int;
begin
  select count(*) into n from storage.objects where bucket_id = 'inventory-photos';
  if n <> 0 then raise exception 'ΔΙΑΡΡΟΗ ΦΩΤΟΓΡΑΦΙΩΝ: ο anon βλέπει % φωτογραφίες', n; end if;
  raise notice 'probe: φωτογραφίες: ο anon δεν βλέπει τίποτα';
end $probe$;
reset role;
