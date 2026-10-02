-- やまぐち畑のとなり：初期スキーマ
-- 農園・商品・畑だより・応援メッセージ・注文。
-- 注文の作成と状態変更はすべてサーバー側の関数で行い、ブラウザからは直接書き換えられないようにする。

create extension if not exists pgcrypto;

-- ---------- 農園 ----------
create table public.farms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade default auth.uid(),
  farm_name text not null check (char_length(farm_name) between 1 and 40),
  farmer text not null check (char_length(farmer) between 1 and 40),
  city text not null check (city in (
    '下関市','宇部市','山口市','萩市','防府市','下松市','岩国市','光市','長門市','柳井市','美祢市',
    '周南市','山陽小野田市','周防大島町','和木町','上関町','田布施町','平生町','阿武町')),
  lat double precision not null check (lat between 33.6 and 34.9),
  lng double precision not null check (lng between 130.7 and 132.6),
  lat_picked boolean not null default false,
  since int check (since between 1900 and 2100),
  area text not null default '' check (char_length(area) <= 20),
  emoji text not null default '🥬' check (char_length(emoji) <= 8),
  hue int not null default 0 check (hue between 0 and 31),
  catch text not null default '' check (char_length(catch) <= 50),
  story text not null default '' check (char_length(story) <= 1500),
  cover_url text check (cover_url is null or cover_url ~ '^https://'),
  methods jsonb not null default '{}'::jsonb,
  certs text[] not null default '{}',
  -- {"enabled":bool,"place":text,"days":[0-6],"from":int,"to":int,"note":text}
  pickup jsonb not null default '{"enabled":false,"place":"","days":[],"from":9,"to":16,"note":""}'::jsonb,
  -- お客さんが注文後に自分でキャンセルできる日数（1〜3日）
  cancel_days int not null default 2 check (cancel_days between 1 and 3),
  -- Stripe Connect（売上の受け取り口座）。サーバー側の関数だけが更新する
  stripe_account_id text unique,
  charges_enabled boolean not null default false,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- 商品 ----------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 30),
  cat text not null check (cat in ('veg','fruit','rice','other')),
  months int[] not null check (cardinality(months) between 1 and 12 and months <@ array[1,2,3,4,5,6,7,8,9,10,11,12]),
  note text not null default '' check (char_length(note) <= 40),
  unit text not null check (char_length(unit) between 1 and 30),
  ship_price int not null check (ship_price between 1 and 1000000),
  pickup_price int not null check (pickup_price between 1 and 1000000),
  stock int not null default 0 check (stock between 0 and 99999),
  sort int not null default 0,
  created_at timestamptz not null default now(),
  constraint pickup_not_above_ship check (pickup_price <= ship_price)
);
create index products_farm_idx on public.products(farm_id);

-- ---------- 畑だより ----------
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  emoji text not null default '🌱' check (char_length(emoji) <= 8),
  title text not null check (char_length(title) between 1 and 40),
  body text not null default '' check (char_length(body) <= 600),
  photo_url text check (photo_url is null or photo_url ~ '^https://'),
  created_at timestamptz not null default now()
);
create index posts_farm_idx on public.posts(farm_id, created_at desc);

-- ---------- 応援メッセージ ----------
create table public.cheers (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null default '' check (char_length(name) <= 30),
  text text not null check (char_length(text) between 1 and 400),
  created_at timestamptz not null default now()
);
create index cheers_farm_idx on public.cheers(farm_id, created_at desc);

-- ---------- 注文 ----------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  -- 農家さん・お客さんがアカウントを削除しても、売上の記録として注文は残す（参照だけ外す）
  farm_id uuid references public.farms(id) on delete set null,
  farm_name text not null default '',
  buyer_id uuid references auth.users(id) on delete set null,
  code text not null,
  method text not null check (method in ('ship','pickup')),
  -- [{"product_id","name","unit","qty","price"}]（注文時点の内容を保存）
  items jsonb not null,
  total int not null check (total > 0),
  pickup jsonb,
  ship jsonb,
  buyer_name text not null,
  buyer_tel text not null,
  status text not null default 'pending_payment'
    check (status in ('pending_payment','paid','ready','shipped','done','canceled','expired')),
  cancel_deadline timestamptz not null,
  stripe_session_id text unique,
  stripe_checkout_url text,
  stripe_payment_intent text,
  refund_status text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  canceled_at timestamptz,
  done_at timestamptz
);
create index orders_buyer_idx on public.orders(buyer_id, created_at desc);
create index orders_farm_idx on public.orders(farm_id, created_at desc);

-- ---------- 更新日時 ----------
create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger farms_touch before update on public.farms for each row execute function public.touch_updated_at();

-- ---------- 行レベルセキュリティ ----------
alter table public.farms enable row level security;
alter table public.products enable row level security;
alter table public.posts enable row level security;
alter table public.cheers enable row level security;
alter table public.orders enable row level security;

create policy farms_read on public.farms for select using (published or owner_id = auth.uid());
create policy farms_insert on public.farms for insert to authenticated with check (owner_id = auth.uid());
create policy farms_update on public.farms for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy farms_delete on public.farms for delete to authenticated using (owner_id = auth.uid());

-- 農園の持ち主だけが、その農園の商品・畑だよりを書き換えられる
create function public.owns_farm(f uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.farms where id = f and owner_id = auth.uid());
$$;
create function public.farm_visible(f uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.farms where id = f and (published or owner_id = auth.uid()));
$$;

create policy products_read on public.products for select using (public.farm_visible(farm_id));
create policy products_write on public.products for all to authenticated using (public.owns_farm(farm_id)) with check (public.owns_farm(farm_id));

create policy posts_read on public.posts for select using (public.farm_visible(farm_id));
create policy posts_write on public.posts for all to authenticated using (public.owns_farm(farm_id)) with check (public.owns_farm(farm_id));

create policy cheers_read on public.cheers for select using (public.farm_visible(farm_id));
create policy cheers_insert on public.cheers for insert to authenticated with check (user_id = auth.uid() and public.farm_visible(farm_id));
create policy cheers_delete on public.cheers for delete to authenticated using (user_id = auth.uid() or public.owns_farm(farm_id));

-- 注文は「買った本人」と「その農園の持ち主」だけが見られる。書き込みは関数経由のみ
create policy orders_read on public.orders for select to authenticated using (buyer_id = auth.uid() or public.owns_farm(farm_id));

-- Stripe の口座情報など、農家さん本人にも書き換えさせない列を守る
revoke insert, update on public.farms from anon, authenticated;
grant insert (farm_name, farmer, city, lat, lng, lat_picked, since, area, emoji, hue, catch, story, cover_url, methods, certs, pickup, cancel_days, published)
  on public.farms to authenticated;
grant update (farm_name, farmer, city, lat, lng, lat_picked, since, area, emoji, hue, catch, story, cover_url, methods, certs, pickup, cancel_days, published)
  on public.farms to authenticated;
revoke insert, update, delete on public.orders from anon, authenticated;

-- ---------- 在庫の戻し ----------
create function public.restore_stock(p_items jsonb) returns void language plpgsql security definer set search_path = public as $$
declare it jsonb;
begin
  for it in select * from jsonb_array_elements(p_items) loop
    update public.products set stock = stock + (it->>'qty')::int where id = (it->>'product_id')::uuid;
  end loop;
end $$;

-- ---------- 注文の作成（Edge Function からのみ呼ぶ） ----------
-- 価格・在庫・旬・受け取り日時をすべてサーバー側で検証し、在庫を確保してから注文を作る。
create function public.create_order(
  p_buyer uuid, p_farm uuid, p_method text, p_items jsonb,
  p_pickup jsonb, p_ship jsonb, p_name text, p_tel text
) returns public.orders language plpgsql security definer set search_path = public as $$
declare
  f public.farms;
  p public.products;
  it jsonb;
  qty int;
  lines jsonb := '[]'::jsonb;
  total int := 0;
  jst_now timestamp := now() at time zone 'Asia/Tokyo';
  cur_month int := extract(month from now() at time zone 'Asia/Tokyo');
  pdate date;
  phour int;
  deadline timestamptz;
  o public.orders;
begin
  select * into f from public.farms where id = p_farm and published;
  if not found then raise exception 'farm_not_found'; end if;
  if not f.charges_enabled or f.stripe_account_id is null then raise exception 'farm_not_ready'; end if;
  if p_method not in ('ship','pickup') then raise exception 'bad_method'; end if;
  if char_length(coalesce(p_name,'')) not between 1 and 40 then raise exception 'bad_name'; end if;
  if coalesce(p_tel,'') !~ '^0\d{1,4}-?\d{1,4}-?\d{3,4}$' then raise exception 'bad_tel'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 20 then raise exception 'bad_items'; end if;

  if p_method = 'pickup' then
    if not coalesce((f.pickup->>'enabled')::boolean, false) then raise exception 'pickup_not_available'; end if;
    pdate := (p_pickup->>'date')::date;
    phour := (p_pickup->>'hour')::int;
    if pdate is null or pdate <= jst_now::date or pdate > jst_now::date + 14 then raise exception 'bad_pickup_date'; end if;
    if not (f.pickup->'days') @> to_jsonb(extract(dow from pdate)::int) then raise exception 'bad_pickup_day'; end if;
    if phour is null or phour < (f.pickup->>'from')::int or phour >= (f.pickup->>'to')::int then raise exception 'bad_pickup_time'; end if;
  else
    -- 配送は山口県内（郵便番号 740〜759）のみ
    if coalesce(p_ship->>'zip','') !~ '^7[45]\d-?\d{4}$' then raise exception 'ship_outside_yamaguchi'; end if;
    if char_length(coalesce(p_ship->>'addr','')) not between 1 and 120 then raise exception 'bad_address'; end if;
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    qty := (it->>'qty')::int;
    if qty is null or qty < 1 or qty > 99 then raise exception 'bad_qty'; end if;
    select * into p from public.products where id = (it->>'product_id')::uuid and farm_id = p_farm for update;
    if not found then raise exception 'product_not_found'; end if;
    if not (cur_month = any(p.months)) then raise exception 'out_of_season:%', p.name; end if;
    if p.stock < qty then raise exception 'out_of_stock:%', p.name; end if;
    update public.products set stock = stock - qty where id = p.id;
    lines := lines || jsonb_build_object('product_id', p.id, 'name', p.name, 'unit', p.unit, 'qty', qty,
      'price', case when p_method = 'pickup' then p.pickup_price else p.ship_price end);
    total := total + qty * (case when p_method = 'pickup' then p.pickup_price else p.ship_price end);
  end loop;

  deadline := now() + make_interval(days => f.cancel_days);
  if p_method = 'pickup' then
    -- 受け取り日の前日いっぱいまで（日本時間）
    deadline := least(deadline, (pdate::timestamp) at time zone 'Asia/Tokyo');
  end if;

  insert into public.orders (farm_id, farm_name, buyer_id, code, method, items, total, pickup, ship, buyer_name, buyer_tel, cancel_deadline)
  values (
    p_farm, f.farm_name, p_buyer, lpad((floor(random() * 9000) + 1000)::int::text, 4, '0'), p_method, lines, total,
    case when p_method = 'pickup' then jsonb_build_object(
      'date', pdate, 'hour', phour, 'time', phour || ':00〜' || (phour + 1) || ':00',
      'place', coalesce(nullif(f.pickup->>'place',''), f.city), 'msg', left(coalesce(p_pickup->>'msg',''), 100)) end,
    case when p_method = 'ship' then jsonb_build_object('zip', p_ship->>'zip', 'pref', '山口県', 'addr', p_ship->>'addr') end,
    p_name, p_tel, deadline)
  returning * into o;
  return o;
end $$;

-- 支払い完了（Stripe webhook から）
create function public.mark_order_paid(p_order uuid, p_payment_intent text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update public.orders set status = 'paid', paid_at = now(), stripe_payment_intent = p_payment_intent
   where id = p_order and status = 'pending_payment';
  return found;
end $$;

-- 支払いされずに期限切れ／途中でやめた → 在庫を戻す
create function public.release_order(p_order uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  update public.orders set status = 'expired', canceled_at = now()
   where id = p_order and status = 'pending_payment' returning * into o;
  if not found then return false; end if;
  perform public.restore_stock(o.items);
  return true;
end $$;

-- お客さんによるキャンセル（期限内・農家さんが準備を始める前だけ）
create function public.begin_cancel(p_order uuid, p_user uuid) returns public.orders
language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  update public.orders set status = 'canceled', canceled_at = now(), refund_status = 'pending'
   where id = p_order and buyer_id = p_user and status = 'paid' and now() < cancel_deadline
  returning * into o;
  if not found then raise exception 'cannot_cancel'; end if;
  perform public.restore_stock(o.items);
  return o;
end $$;

-- 農家さんによる状態変更（準備OK・発送済み・受け渡し完了）
create function public.farmer_update_order(p_order uuid, p_to text, p_code text default null) returns public.orders
language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order for update;
  if not found or not public.owns_farm(o.farm_id) then raise exception 'not_allowed'; end if;
  if o.method = 'pickup' and o.status = 'paid' and p_to = 'ready' then null;
  elsif o.method = 'ship' and o.status = 'paid' and p_to = 'shipped' then null;
  elsif o.method = 'pickup' and o.status = 'ready' and p_to = 'done' then
    if coalesce(p_code, '') <> o.code then raise exception 'wrong_code'; end if;
  elsif o.method = 'ship' and o.status = 'shipped' and p_to = 'done' then null;
  else raise exception 'bad_transition'; end if;
  update public.orders set status = p_to, done_at = case when p_to = 'done' then now() end
   where id = p_order returning * into o;
  return o;
end $$;

revoke execute on function public.restore_stock(jsonb) from public, anon, authenticated;
revoke execute on function public.create_order(uuid, uuid, text, jsonb, jsonb, jsonb, text, text) from public, anon, authenticated;
revoke execute on function public.mark_order_paid(uuid, text) from public, anon, authenticated;
revoke execute on function public.release_order(uuid) from public, anon, authenticated;
revoke execute on function public.begin_cancel(uuid, uuid) from public, anon, authenticated;
grant execute on function public.restore_stock(jsonb), public.create_order(uuid, uuid, text, jsonb, jsonb, jsonb, text, text),
  public.mark_order_paid(uuid, text), public.release_order(uuid), public.begin_cancel(uuid, uuid) to service_role;
revoke execute on function public.farmer_update_order(uuid, text, text) from public, anon;
grant execute on function public.farmer_update_order(uuid, text, text) to authenticated;

-- ======================================================================
--  なかま市（農家どうしの譲り合い・売買）
--  農園を登録した人だけが見られる。お金のやりとりはアプリの外（受け渡し時に直接）。
-- ======================================================================
create function public.is_farmer() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.farms where owner_id = auth.uid());
$$;

create table public.market_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  kind text not null check (kind in ('give','sell','want')),
  cat text not null check (cat in ('tool','machine','material','seed','other')),
  title text not null check (char_length(title) between 1 and 40),
  body text not null default '' check (char_length(body) <= 800),
  price int check (price is null or price between 0 and 10000000),
  condition text not null default '' check (char_length(condition) <= 30),
  photos text[] not null default '{}' check (cardinality(photos) <= 3),
  status text not null default 'open' check (status in ('open','reserved','closed')),
  created_at timestamptz not null default now(),
  constraint price_matches_kind check (
    (kind = 'sell' and price > 0) or (kind = 'give' and coalesce(price, 0) = 0) or (kind = 'want' and price is null))
);
create index market_items_created_idx on public.market_items(created_at desc);

create table public.market_messages (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.market_items(id) on delete cascade,
  -- 出品者とやりとりしている相手（スレッドの単位）
  buyer_id uuid not null references auth.users(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  text text not null check (char_length(text) between 1 and 500),
  created_at timestamptz not null default now()
);
create index market_messages_item_idx on public.market_messages(item_id, created_at);

create function public.item_owner(i uuid) returns uuid language sql stable security definer set search_path = public as $$
  select owner_id from public.market_items where id = i;
$$;

alter table public.market_items enable row level security;
alter table public.market_messages enable row level security;

create policy market_items_read on public.market_items for select to authenticated using (public.is_farmer());
create policy market_items_insert on public.market_items for insert to authenticated
  with check (owner_id = auth.uid() and public.owns_farm(farm_id));
create policy market_items_update on public.market_items for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy market_items_delete on public.market_items for delete to authenticated using (owner_id = auth.uid());

-- メッセージは、出品者とその相手だけが読める
create policy market_messages_read on public.market_messages for select to authenticated
  using (buyer_id = auth.uid() or public.item_owner(item_id) = auth.uid());
-- 相手は自分のスレッドにだけ、出品者はどのスレッドにも書ける（自分の出品に自分で問い合わせはできない）
create policy market_messages_insert on public.market_messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_farmer() and (
    (buyer_id = auth.uid() and public.item_owner(item_id) <> auth.uid()) or
    (public.item_owner(item_id) = auth.uid() and buyer_id <> auth.uid())));

revoke update on public.market_items from authenticated;
grant update (kind, cat, title, body, price, condition, photos, status) on public.market_items to authenticated;
revoke update on public.market_messages from authenticated;

-- ======================================================================
--  写真の保存場所（Supabase Storage）
--  だれでも見られる。アップロード・削除は本人のフォルダ（ユーザーID/…）だけ。
-- ======================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy photos_read on storage.objects for select using (bucket_id = 'photos');
create policy photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
