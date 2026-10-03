-- 受け取り場所の住所。農家さんの自宅であることが多いので、farms（誰でも読める）とは別のテーブルに置き、
-- 本人と、畑で受け取る注文をした人（注文時に住所を写す）にだけ見えるようにする。
-- 何度実行しても同じ結果になるように書いてある。
create table if not exists public.farm_private (
  farm_id uuid primary key references public.farms(id) on delete cascade,
  pickup_addr text not null default '' check (char_length(pickup_addr) <= 120),
  updated_at timestamptz not null default now()
);
alter table public.farm_private enable row level security;
drop policy if exists farm_private_owner on public.farm_private;
create policy farm_private_owner on public.farm_private for all to authenticated
  using (public.owns_farm(farm_id)) with check (public.owns_farm(farm_id));
revoke all on public.farm_private from anon, authenticated;
grant select, insert, update on public.farm_private to authenticated;

-- 畑で受け取る注文ができたら、その時点の住所を注文に写す（あとで住所が変わっても、注文した人には当時の場所が残る）
create or replace function public.copy_pickup_addr() returns trigger
language plpgsql security definer set search_path = public as $$
declare a text;
begin
  if new.method = 'pickup' and new.pickup is not null then
    select pickup_addr into a from public.farm_private where farm_id = new.farm_id;
    new.pickup := new.pickup || jsonb_build_object('addr', coalesce(a, ''));
  end if;
  return new;
end $$;
revoke execute on function public.copy_pickup_addr() from public, anon, authenticated;
drop trigger if exists orders_copy_pickup_addr on public.orders;
create trigger orders_copy_pickup_addr before insert on public.orders
  for each row execute function public.copy_pickup_addr();
