-- 質問箱（AI）の使いすぎ防止。1人（ログインしていなければ通信元ごと）1日20回まで、アプリ全体で1日2000回まで。
-- 質問の中身は保存しない（回数だけ数える）。
create table if not exists public.ai_usage (
  key text not null,
  day date not null default (now() at time zone 'Asia/Tokyo')::date,
  n int not null default 0,
  primary key (key, day)
);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;

create or replace function public.ai_take(p_key text, p_limit int default 20, p_total int default 2000) returns boolean
language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'Asia/Tokyo')::date; mine int; total int;
begin
  select coalesce(sum(n), 0) into total from public.ai_usage where day = d;
  if total >= p_total then return false; end if;
  insert into public.ai_usage (key, day, n) values (p_key, d, 1)
  on conflict (key, day) do update set n = public.ai_usage.n + 1
  returning n into mine;
  if mine > p_limit then return false; end if;
  delete from public.ai_usage where day < d - 7;
  return true;
end $$;
revoke execute on function public.ai_take(text, int, int) from public, anon, authenticated;
grant execute on function public.ai_take(text, int, int) to service_role;
