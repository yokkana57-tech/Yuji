-- 特定商取引法の表示のための販売者情報。
-- 氏名と発送の目安は農園ページに表示する（farms）。電話番号と住所は公開せず、
-- お客さんから請求があったときに運営から開示する（farm_private：本人と運営だけが読める）。
-- 何度実行しても同じ結果になるように書いてある。
alter table public.farms add column if not exists seller_name text not null default '' check (char_length(seller_name) <= 60);
alter table public.farms add column if not exists ship_days smallint not null default 3 check (ship_days between 1 and 14);
grant insert (seller_name, ship_days), update (seller_name, ship_days) on public.farms to authenticated;

alter table public.farm_private add column if not exists seller_tel text not null default '' check (char_length(seller_tel) <= 20);
alter table public.farm_private add column if not exists seller_addr text not null default '' check (char_length(seller_addr) <= 120);
