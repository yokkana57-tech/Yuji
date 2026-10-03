-- 畑で受け取るときの「現地で現金払い」。手数料ゼロで売れるようにする。
-- 前払いでないぶん、来なかった人（noshow）が2回以上いると現金払いの予約をできなくする。
-- 何度実行しても同じ結果になるように書いてある。
alter table public.orders add column if not exists payment text not null default 'card';
alter table public.orders drop constraint if exists orders_payment_check;
alter table public.orders add constraint orders_payment_check check (payment in ('card','cash'));
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending_payment','paid','reserved','ready','shipped','done','canceled','expired','noshow'));

-- ---------- 注文の作成（口座の確認を Edge Function 側に移した版） ----------
create or replace function public.create_order(
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
  -- カード払いの口座確認は create-checkout（Edge Function）で行う。現地払いでは口座がなくても予約できる
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

-- ---------- 現金払いの予約（ログインしたお客さんがアプリから直接呼ぶ） ----------
create or replace function public.create_cash_order(
  p_farm uuid, p_items jsonb, p_pickup jsonb, p_name text, p_tel text
) returns public.orders language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  f public.farms;
  o public.orders;
begin
  if uid is null then raise exception 'login_required'; end if;
  select * into f from public.farms where id = p_farm and published;
  if not found then raise exception 'farm_not_found'; end if;
  if not coalesce((f.pickup->>'cash')::boolean, false) then raise exception 'cash_not_available'; end if;
  if (select count(*) from public.orders where buyer_id = uid and status = 'noshow') >= 2 then raise exception 'cash_blocked'; end if;
  if (select count(*) from public.orders where buyer_id = uid and payment = 'cash' and status in ('reserved','ready')) >= 3 then raise exception 'too_many_reserved'; end if;
  o := public.create_order(uid, p_farm, 'pickup', p_items, p_pickup, '{}'::jsonb, p_name, p_tel);
  update public.orders set status = 'reserved', payment = 'cash' where id = o.id returning * into o;
  return o;
end $$;

-- 現金払いの予約の取り消し（期限内・農家さんが準備を始める前だけ。お金は動いていないので返金はない）
create or replace function public.cancel_cash_order(p_order uuid) returns public.orders
language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  update public.orders set status = 'canceled', canceled_at = now()
   where id = p_order and buyer_id = auth.uid() and payment = 'cash' and status = 'reserved' and now() < cancel_deadline
  returning * into o;
  if not found then raise exception 'cannot_cancel'; end if;
  perform public.restore_stock(o.items);
  return o;
end $$;

-- ---------- 農家さんによる状態変更（現金払い・来なかった を追加） ----------
create or replace function public.farmer_update_order(p_order uuid, p_to text, p_code text default null) returns public.orders
language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order for update;
  if not found or not public.owns_farm(o.farm_id) then raise exception 'not_allowed'; end if;
  if o.method = 'pickup' and o.status in ('paid','reserved') and p_to = 'ready' then null;
  elsif o.method = 'ship' and o.status = 'paid' and p_to = 'shipped' then null;
  elsif o.method = 'pickup' and o.status = 'ready' and p_to = 'done' then
    if coalesce(p_code, '') <> o.code then raise exception 'wrong_code'; end if;
  elsif o.method = 'ship' and o.status = 'shipped' and p_to = 'done' then null;
  elsif o.payment = 'cash' and o.status in ('reserved','ready') and p_to = 'noshow' then
    -- 受け取りの時間が過ぎてから押せる
    if now() < ((o.pickup->>'date')::date + make_interval(hours => (o.pickup->>'hour')::int + 1)) at time zone 'Asia/Tokyo' then
      raise exception 'too_early';
    end if;
    perform public.restore_stock(o.items);
  else raise exception 'bad_transition'; end if;
  update public.orders set status = p_to, done_at = case when p_to in ('done','noshow') then now() end
   where id = p_order returning * into o;
  return o;
end $$;

revoke execute on function public.create_order(uuid, uuid, text, jsonb, jsonb, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.create_order(uuid, uuid, text, jsonb, jsonb, jsonb, text, text) to service_role;
revoke execute on function public.create_cash_order(uuid, jsonb, jsonb, text, text) from public, anon;
grant execute on function public.create_cash_order(uuid, jsonb, jsonb, text, text) to authenticated;
revoke execute on function public.cancel_cash_order(uuid) from public, anon;
grant execute on function public.cancel_cash_order(uuid) to authenticated;
revoke execute on function public.farmer_update_order(uuid, text, text) from public, anon;
grant execute on function public.farmer_update_order(uuid, text, text) to authenticated;
