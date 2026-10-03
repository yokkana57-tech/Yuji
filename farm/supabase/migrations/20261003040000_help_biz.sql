-- 援農（お手伝い）マッチングと、お店・飲食店からの「まとめ買い・仕入れの相談」。
-- 援農は無償のボランティア（お礼は収穫物のおすそわけ程度）に限る。
--   賃金を払う仕事の募集と応募者の情報を扱うと、職業安定法の「特定募集情報等提供事業」の届出が必要になるため。
-- 何度実行しても同じ結果になるように書いてある。

-- ---------- お店向けの受け付け（農家さんの設定） ----------
alter table public.farms add column if not exists biz_ok boolean not null default false;
alter table public.farms add column if not exists biz_note text not null default '' check (char_length(biz_note) <= 200);
grant insert (biz_ok, biz_note), update (biz_ok, biz_note) on public.farms to authenticated;

-- ---------- お手伝いの募集 ----------
create table if not exists public.helps (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 40),
  body text not null default '' check (char_length(body) <= 1000),
  work_date date not null,
  start_hour smallint not null check (start_hour between 0 and 23),
  end_hour smallint not null check (end_hour between 1 and 24),
  capacity smallint not null default 2 check (capacity between 1 and 50),
  filled smallint not null default 0,
  place text not null default '' check (char_length(place) <= 60),
  thanks text not null default '' check (char_length(thanks) <= 60),
  bring text not null default '' check (char_length(bring) <= 100),
  beginner boolean not null default true,
  meal boolean not null default false,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now(),
  constraint helps_hours check (end_hour > start_hour)
);
create index if not exists helps_date_idx on public.helps(work_date);
alter table public.helps enable row level security;
drop policy if exists helps_read on public.helps;
create policy helps_read on public.helps for select using (public.farm_visible(farm_id));
drop policy if exists helps_write on public.helps;
create policy helps_write on public.helps for all to authenticated using (public.owns_farm(farm_id)) with check (public.owns_farm(farm_id));
revoke all on public.helps from anon, authenticated;
grant select on public.helps to anon, authenticated;
grant insert (farm_id, title, body, work_date, start_hour, end_hour, capacity, place, thanks, bring, beginner, meal, status) on public.helps to authenticated;
grant update (title, body, work_date, start_hour, end_hour, capacity, place, thanks, bring, beginner, meal, status) on public.helps to authenticated;
grant delete on public.helps to authenticated;

create table if not exists public.help_entries (
  id uuid primary key default gen_random_uuid(),
  help_id uuid not null references public.helps(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null check (char_length(name) between 1 and 30),
  tel text not null check (tel ~ '^0\d{1,4}-?\d{1,4}-?\d{3,4}$'),
  people smallint not null default 1 check (people between 1 and 10),
  message text not null default '' check (char_length(message) <= 400),
  status text not null default 'applied' check (status in ('applied','accepted','declined','canceled')),
  created_at timestamptz not null default now(),
  unique (help_id, user_id)
);
alter table public.help_entries enable row level security;
create or replace function public.help_owner(p_help uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.helps h where h.id = p_help and public.owns_farm(h.farm_id));
$$;
drop policy if exists help_entries_read on public.help_entries;
create policy help_entries_read on public.help_entries for select to authenticated using (user_id = auth.uid() or public.help_owner(help_id));
revoke all on public.help_entries from anon, authenticated;
grant select on public.help_entries to authenticated;

-- 申し込み（ログインした人が呼ぶ）
create or replace function public.apply_help(p_help uuid, p_name text, p_tel text, p_people int, p_message text) returns public.help_entries
language plpgsql security definer set search_path = public as $$
declare h public.helps; e public.help_entries; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'login_required'; end if;
  select * into h from public.helps where id = p_help for update;
  if not found or not public.farm_visible(h.farm_id) then raise exception 'help_not_found'; end if;
  if h.status <> 'open' or h.work_date <= (now() at time zone 'Asia/Tokyo')::date then raise exception 'help_closed'; end if;
  if public.owns_farm(h.farm_id) then raise exception 'own_help'; end if;
  if h.filled >= h.capacity then raise exception 'help_full'; end if;
  if (select count(*) from public.help_entries where user_id = uid and created_at > now() - interval '1 day') >= 10 then raise exception 'too_many_posts'; end if;
  insert into public.help_entries (help_id, user_id, name, tel, people, message)
  values (p_help, uid, trim(p_name), trim(p_tel), greatest(1, least(10, coalesce(p_people, 1))), left(coalesce(p_message, ''), 400))
  on conflict (help_id, user_id) do update set name = excluded.name, tel = excluded.tel, people = excluded.people, message = excluded.message, status = 'applied', created_at = now()
    where public.help_entries.status in ('canceled')
  returning * into e;
  if e.id is null then raise exception 'already_applied'; end if;
  return e;
end $$;

-- 農家さんの返事（受け入れる・今回は見送る）
create or replace function public.respond_help(p_entry uuid, p_to text) returns public.help_entries
language plpgsql security definer set search_path = public as $$
declare e public.help_entries; h public.helps;
begin
  select * into e from public.help_entries where id = p_entry for update;
  if not found or not public.help_owner(e.help_id) then raise exception 'not_allowed'; end if;
  select * into h from public.helps where id = e.help_id for update;
  if p_to = 'accepted' and e.status = 'applied' then
    if h.filled + e.people > h.capacity then raise exception 'help_full'; end if;
    update public.helps set filled = filled + e.people where id = h.id;
  elsif p_to = 'declined' and e.status in ('applied','accepted') then
    if e.status = 'accepted' then update public.helps set filled = greatest(0, filled - e.people) where id = h.id; end if;
  else raise exception 'bad_transition'; end if;
  update public.help_entries set status = p_to where id = p_entry returning * into e;
  return e;
end $$;

-- 申し込んだ人の取り消し
create or replace function public.cancel_help_entry(p_entry uuid) returns public.help_entries
language plpgsql security definer set search_path = public as $$
declare e public.help_entries;
begin
  select * into e from public.help_entries where id = p_entry and user_id = auth.uid() for update;
  if not found or e.status not in ('applied','accepted') then raise exception 'cannot_cancel'; end if;
  if e.status = 'accepted' then update public.helps set filled = greatest(0, filled - e.people) where id = e.help_id; end if;
  update public.help_entries set status = 'canceled' where id = p_entry returning * into e;
  return e;
end $$;

revoke execute on function public.apply_help(uuid, text, text, int, text), public.respond_help(uuid, text), public.cancel_help_entry(uuid) from public, anon;
grant execute on function public.apply_help(uuid, text, text, int, text), public.respond_help(uuid, text), public.cancel_help_entry(uuid) to authenticated;

-- ---------- お店・飲食店からの相談 ----------
create table if not exists public.biz_requests (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  shop_name text not null check (char_length(shop_name) between 1 and 60),
  shop_kind text not null default '' check (char_length(shop_kind) <= 30),
  city text not null default '' check (char_length(city) <= 30),
  contact_name text not null check (char_length(contact_name) between 1 and 30),
  tel text not null check (tel ~ '^0\d{1,4}-?\d{1,4}-?\d{3,4}$'),
  items text not null check (char_length(items) between 1 and 300),
  quantity text not null default '' check (char_length(quantity) <= 200),
  frequency text not null default '' check (char_length(frequency) <= 60),
  delivery text not null default '' check (char_length(delivery) <= 100),
  note text not null default '' check (char_length(note) <= 600),
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now()
);
alter table public.biz_requests enable row level security;
drop policy if exists biz_read on public.biz_requests;
create policy biz_read on public.biz_requests for select to authenticated using (user_id = auth.uid() or public.owns_farm(farm_id));
drop policy if exists biz_insert on public.biz_requests;
create policy biz_insert on public.biz_requests for insert to authenticated
  with check (user_id = auth.uid() and status = 'open' and not public.owns_farm(farm_id)
    and exists (select 1 from public.farms f where f.id = farm_id and f.published and f.biz_ok));
drop policy if exists biz_update on public.biz_requests;
create policy biz_update on public.biz_requests for update to authenticated
  using (user_id = auth.uid() or public.owns_farm(farm_id)) with check (user_id = auth.uid() or public.owns_farm(farm_id));
revoke all on public.biz_requests from anon, authenticated;
grant select on public.biz_requests to authenticated;
grant insert (farm_id, shop_name, shop_kind, city, contact_name, tel, items, quantity, frequency, delivery, note) on public.biz_requests to authenticated;
grant update (status) on public.biz_requests to authenticated;

-- ---------- お手伝い・お店の相談のメッセージ（共通） ----------
create table if not exists public.talk_messages (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('help','biz')),
  ref_id uuid not null,
  sender_id uuid references auth.users(id) on delete set null default auth.uid(),
  from_farmer boolean not null default false,
  text text not null check (char_length(text) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists talk_messages_ref_idx on public.talk_messages(kind, ref_id, created_at);
alter table public.talk_messages enable row level security;
create or replace function public.talk_party(p_kind text, p_ref uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
    when p_kind = 'help' then (select case when e.user_id = auth.uid() then 'user' when public.help_owner(e.help_id) then 'farmer' end from public.help_entries e where e.id = p_ref)
    when p_kind = 'biz' then (select case when b.user_id = auth.uid() then 'user' when public.owns_farm(b.farm_id) then 'farmer' end from public.biz_requests b where b.id = p_ref)
  end;
$$;
drop policy if exists talk_read on public.talk_messages;
create policy talk_read on public.talk_messages for select to authenticated using (public.talk_party(kind, ref_id) is not null);
drop policy if exists talk_insert on public.talk_messages;
create policy talk_insert on public.talk_messages for insert to authenticated
  with check (sender_id = auth.uid() and public.talk_party(kind, ref_id) is not null and from_farmer = (public.talk_party(kind, ref_id) = 'farmer'));
revoke all on public.talk_messages from anon, authenticated;
grant select on public.talk_messages to authenticated;
grant insert (kind, ref_id, from_farmer, text) on public.talk_messages to authenticated;

-- 連投の制限（既存の rate_limit に追加）
create or replace function public.rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int; lim int; win interval; uid uuid := auth.uid();
begin
  if TG_TABLE_NAME = 'client_errors' then
    select count(*) into n from public.client_errors where created_at > now() - interval '1 minute';
    if n >= 60 then return null; end if;
    return new;
  end if;
  lim := case TG_TABLE_NAME when 'cheers' then 20 when 'market_messages' then 100 when 'order_messages' then 60
    when 'talk_messages' then 100 when 'biz_requests' then 10 when 'inquiries' then 5 else 1000 end;
  win := case TG_TABLE_NAME when 'inquiries' then interval '1 hour' else interval '1 day' end;
  if TG_TABLE_NAME = 'inquiries' then
    select count(*) into n from public.inquiries where created_at > now() - win and (user_id = uid or email = new.email);
  elsif TG_TABLE_NAME = 'cheers' then
    select count(*) into n from public.cheers where created_at > now() - win and user_id = uid;
  elsif TG_TABLE_NAME = 'market_messages' then
    select count(*) into n from public.market_messages where created_at > now() - win and sender_id = uid;
  elsif TG_TABLE_NAME = 'talk_messages' then
    select count(*) into n from public.talk_messages where created_at > now() - win and sender_id = uid;
  elsif TG_TABLE_NAME = 'biz_requests' then
    select count(*) into n from public.biz_requests where created_at > now() - win and user_id = uid;
  else
    select count(*) into n from public.order_messages where created_at > now() - win and sender_id = uid;
  end if;
  if n >= lim then raise exception 'too_many_posts'; end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['talk_messages','biz_requests'] loop
    execute format('drop trigger if exists %I_rate_limit on public.%I', t, t);
    execute format('create trigger %I_rate_limit before insert on public.%I for each row execute function public.rate_limit()', t, t);
  end loop;
end $$;
