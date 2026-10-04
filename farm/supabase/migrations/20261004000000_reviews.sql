-- 口コミ（農家さんごと）。
-- 書けるのは、その農家さんの注文を受け取った（status = done）本人だけ。1注文につき1件。
-- サクラ・なりすましを防ぐため、書き込みはすべて RPC を通す（ステルスマーケティング規制への配慮）。
-- 何度実行しても同じ結果になるように書いてある。
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  farm_id uuid not null references public.farms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  tags text[] not null default '{}' check (tags <@ array['おいしい','新鮮','ていねい','量がたっぷり','また買いたい','農家さんが親切']::text[]),
  comment text not null default '' check (char_length(comment) <= 400),
  name text not null default '' check (char_length(name) <= 30),
  items text not null default '' check (char_length(items) <= 200),
  reply text not null default '' check (char_length(reply) <= 400),
  reply_at timestamptz,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists reviews_farm_idx on public.reviews(farm_id, created_at desc);
alter table public.reviews enable row level security;
drop policy if exists reviews_read on public.reviews;
create policy reviews_read on public.reviews for select using ((not hidden and public.farm_visible(farm_id)) or user_id = auth.uid());
revoke all on public.reviews from anon, authenticated;
grant select on public.reviews to anon, authenticated;

-- 書く・直す（受け取りから60日以内）
create or replace function public.save_review(p_order uuid, p_rating int, p_tags text[], p_comment text, p_name text) returns public.reviews
language plpgsql security definer set search_path = public as $$
declare o public.orders; r public.reviews; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'login_required'; end if;
  select * into o from public.orders where id = p_order;
  if not found or o.buyer_id is distinct from uid or o.status <> 'done' or o.farm_id is null then raise exception 'review_not_allowed'; end if;
  if o.done_at < now() - interval '60 days' then raise exception 'review_too_late'; end if;
  insert into public.reviews (order_id, farm_id, user_id, rating, tags, comment, name, items)
  values (p_order, o.farm_id, uid, p_rating, coalesce(p_tags, '{}'), left(trim(coalesce(p_comment, '')), 400), left(trim(coalesce(p_name, '')), 30),
    left((select string_agg(i->>'name', '・') from jsonb_array_elements(o.items) i), 200))
  on conflict (order_id) do update set rating = excluded.rating, tags = excluded.tags, comment = excluded.comment, name = excluded.name, updated_at = now()
    where public.reviews.user_id = uid
  returning * into r;
  return r;
end $$;

create or replace function public.delete_review(p_review uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.reviews where id = p_review and user_id = auth.uid();
  if not found then raise exception 'not_allowed'; end if;
end $$;

-- 農家さんの返事
create or replace function public.reply_review(p_review uuid, p_reply text) returns public.reviews
language plpgsql security definer set search_path = public as $$
declare r public.reviews;
begin
  update public.reviews set reply = left(trim(coalesce(p_reply, '')), 400), reply_at = case when trim(coalesce(p_reply, '')) = '' then null else now() end
   where id = p_review and public.owns_farm(farm_id) returning * into r;
  if not found then raise exception 'not_allowed'; end if;
  return r;
end $$;

revoke execute on function public.save_review(uuid, int, text[], text, text), public.delete_review(uuid), public.reply_review(uuid, text) from public, anon;
grant execute on function public.save_review(uuid, int, text[], text, text), public.delete_review(uuid), public.reply_review(uuid, text) to authenticated;

-- 一覧に出す平均と件数（非表示の口コミは数えない）
create or replace view public.farm_ratings as
  select farm_id, round(avg(rating)::numeric, 1) as avg, count(*)::int as n
    from public.reviews where not hidden group by farm_id;
grant select on public.farm_ratings to anon, authenticated;
