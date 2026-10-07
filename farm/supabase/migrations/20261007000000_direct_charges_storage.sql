-- 1) 【準備】決済を「農家さん自身の Stripe アカウントで受ける」方式（ダイレクト支払い）に変えるときのための列。
--    どの Stripe アカウントで決済したかを注文に残す（返金・期限切れの処理で使う。空なら今の方式）。
--    2026-10-07 時点では、決済の仕組みはまだ変えていない（この列は使われていない）。
alter table public.orders add column if not exists stripe_account text;

-- 2) 保管・鮮度の情報（農家さんの申告）
--    {"fresh":"same_day|next_day|few_days|stored","ways":["cold_room","fridge","shade","dry_store","rice_cold"],
--     "temp":"5℃前後など","ship":"normal|cool|depends","photo":"URL","note":"ひとこと"}
alter table public.farms add column if not exists storage jsonb not null default '{}'::jsonb;
grant insert (storage), update (storage) on public.farms to authenticated;
