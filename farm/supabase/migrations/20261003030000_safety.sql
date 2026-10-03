-- リスク対策：自動の後片付け・発送遅れの返金・お問い合わせ・注文ごとのメッセージ・エラー記録・連投の制限。
-- 何度実行しても同じ結果になるように書いてある。

-- ---------- 1. 支払われずに残った注文を自動で取り消し、在庫を戻す ----------
-- 通常は Stripe の「期限切れ」通知で戻るが、通知が届かなかったときの保険。
create extension if not exists pg_cron;
create or replace function public.release_stale_orders() returns int
language plpgsql security definer set search_path = public as $$
declare o public.orders; n int := 0;
begin
  for o in select * from public.orders where status = 'pending_payment' and created_at < now() - interval '45 minutes' for update skip locked loop
    if public.release_order(o.id) then n := n + 1; end if;
  end loop;
  return n;
end $$;
revoke execute on function public.release_stale_orders() from public, anon, authenticated;
select cron.unschedule(jobid) from cron.job where jobname = 'release-stale-orders';
select cron.schedule('release-stale-orders', '*/10 * * * *', 'select public.release_stale_orders()');

-- ---------- 2. 発送が遅れた注文は、期限を過ぎてもキャンセル（全額返金）できる ----------
-- 農家さんが「発送の目安」から3日過ぎても発送しない場合、お客さんを守るため。
create or replace function public.begin_cancel(p_order uuid, p_user uuid) returns public.orders
language plpgsql security definer set search_path = public as $$
declare o public.orders; sd int;
begin
  select coalesce(f.ship_days, 3) into sd from public.orders x left join public.farms f on f.id = x.farm_id where x.id = p_order;
  update public.orders set status = 'canceled', canceled_at = now(), refund_status = 'pending'
   where id = p_order and buyer_id = p_user and status = 'paid'
     and (now() < cancel_deadline or (method = 'ship' and now() > created_at + make_interval(days => coalesce(sd, 3) + 3)))
  returning * into o;
  if not found then raise exception 'cannot_cancel'; end if;
  perform public.restore_stock(o.items);
  return o;
end $$;
revoke execute on function public.begin_cancel(uuid, uuid) from public, anon, authenticated;
grant execute on function public.begin_cancel(uuid, uuid) to service_role;

-- ---------- 3. お問い合わせ ----------
create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  email text not null check (char_length(email) between 3 and 200),
  kind text not null check (kind in ('order','trouble','bug','farmer','request','other')),
  order_id uuid references public.orders(id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  status text not null default 'open' check (status in ('open','done')),
  created_at timestamptz not null default now()
);
alter table public.inquiries enable row level security;
drop policy if exists inquiries_insert on public.inquiries;
create policy inquiries_insert on public.inquiries for insert to anon, authenticated
  with check (status = 'open' and (user_id is null or user_id = auth.uid()));
drop policy if exists inquiries_read on public.inquiries;
create policy inquiries_read on public.inquiries for select to authenticated using (user_id = auth.uid());
revoke all on public.inquiries from anon, authenticated;
grant insert (email, kind, order_id, body) on public.inquiries to anon, authenticated;
grant select on public.inquiries to authenticated;

-- ---------- 4. 注文ごとのメッセージ（お客さん ⇔ 農家さん） ----------
create table if not exists public.order_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null default auth.uid(),
  from_farmer boolean not null default false,
  text text not null check (char_length(text) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists order_messages_order_idx on public.order_messages(order_id, created_at);
alter table public.order_messages enable row level security;
create or replace function public.order_party(p_order uuid) returns text
language sql stable security definer set search_path = public as $$
  select case when o.buyer_id = auth.uid() then 'buyer' when public.owns_farm(o.farm_id) then 'farmer' end
    from public.orders o where o.id = p_order;
$$;
drop policy if exists order_messages_read on public.order_messages;
create policy order_messages_read on public.order_messages for select to authenticated using (public.order_party(order_id) is not null);
drop policy if exists order_messages_insert on public.order_messages;
create policy order_messages_insert on public.order_messages for insert to authenticated
  with check (sender_id = auth.uid() and from_farmer = (public.order_party(order_id) = 'farmer') and public.order_party(order_id) is not null
    and exists (select 1 from public.orders o where o.id = order_id and o.status <> 'pending_payment' and o.created_at > now() - interval '60 days'));
revoke all on public.order_messages from anon, authenticated;
grant select on public.order_messages to authenticated;
grant insert (order_id, from_farmer, text) on public.order_messages to authenticated;

-- ---------- 5. アプリで起きたエラーの記録（運営が不具合に気づくため。個人情報は入れない） ----------
create table if not exists public.client_errors (
  id bigint generated always as identity primary key,
  message text not null check (char_length(message) <= 500),
  where_at text not null default '' check (char_length(where_at) <= 200),
  ua text not null default '' check (char_length(ua) <= 200),
  app_version text not null default '' check (char_length(app_version) <= 20),
  created_at timestamptz not null default now()
);
alter table public.client_errors enable row level security;
drop policy if exists client_errors_insert on public.client_errors;
create policy client_errors_insert on public.client_errors for insert to anon, authenticated with check (true);
revoke all on public.client_errors from anon, authenticated;
grant insert (message, where_at, ua, app_version) on public.client_errors to anon, authenticated;

-- ---------- 6. 連投・いたずらの制限 ----------
create or replace function public.rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int; lim int; win interval; uid uuid := auth.uid();
begin
  if TG_TABLE_NAME = 'client_errors' then
    select count(*) into n from public.client_errors where created_at > now() - interval '1 minute';
    if n >= 60 then return null; end if; -- エラー記録はあふれたら黙って捨てる
    return new;
  end if;
  lim := case TG_TABLE_NAME when 'cheers' then 20 when 'market_messages' then 100 when 'order_messages' then 60 when 'inquiries' then 5 else 1000 end;
  win := case TG_TABLE_NAME when 'inquiries' then interval '1 hour' else interval '1 day' end;
  if TG_TABLE_NAME = 'inquiries' then
    select count(*) into n from public.inquiries where created_at > now() - win and (user_id = uid or email = new.email);
  elsif TG_TABLE_NAME = 'cheers' then
    select count(*) into n from public.cheers where created_at > now() - win and user_id = uid;
  elsif TG_TABLE_NAME = 'market_messages' then
    select count(*) into n from public.market_messages where created_at > now() - win and sender_id = uid;
  else
    select count(*) into n from public.order_messages where created_at > now() - win and sender_id = uid;
  end if;
  if n >= lim then raise exception 'too_many_posts'; end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['cheers','market_messages','order_messages','inquiries','client_errors'] loop
    execute format('drop trigger if exists %I_rate_limit on public.%I', t, t);
    execute format('create trigger %I_rate_limit before insert on public.%I for each row execute function public.rate_limit()', t, t);
  end loop;
end $$;
