import { createClient, type User } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17';

export const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  httpClient: Stripe.createFetchHttpClient(),
});

// service_role で動くクライアント。RLS を通らないので、呼び出し元の検証を必ず先に行うこと。
export const admin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false } },
);

// 例: https://yokkana57-tech.github.io/Yuji/farm/
export const SITE_URL = (Deno.env.get('SITE_URL') ?? '').replace(/#.*$/, '');
// プラットフォーム手数料（%）。0 なら売上は全額農家さんへ（Stripe の決済手数料は別途かかる）
export const FEE_PERCENT = Math.max(0, Number(Deno.env.get('PLATFORM_FEE_PERCENT') ?? '0') || 0);

const allowOrigin = SITE_URL ? new URL(SITE_URL).origin : '*';
export const cors = {
  'Access-Control-Allow-Origin': allowOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

export async function requireUser(req: Request): Promise<User> {
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!jwt) throw new HttpError(401, 'login_required');
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data.user) throw new HttpError(401, 'login_required');
  return data.user;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

// Postgres の raise exception 'xxx' を、お客さんに見せる日本語に変換する
const MESSAGES: Record<string, string> = {
  farm_not_found: 'この農家さんは見つかりませんでした。',
  farm_not_ready: 'この農家さんは、まだオンライン注文の準備中です。',
  bad_method: '受け取り方法を選んでください。',
  bad_name: 'お名前を入力してください。',
  bad_tel: '電話番号を確認してください。',
  bad_items: '商品を選んでください。',
  pickup_not_available: 'この農家さんは畑での受け取りをしていません。',
  bad_pickup_date: '受け取り日を選び直してください。',
  bad_pickup_day: 'その曜日は受け取りできません。',
  bad_pickup_time: 'その時間は受け取りできません。',
  ship_outside_yamaguchi: '配送は山口県内（郵便番号 740〜759）のみです。',
  bad_address: '住所を入力してください。',
  bad_qty: '数量を確認してください。',
  product_not_found: '商品が見つかりませんでした。',
  out_of_season: 'いまはお届けできない時期の商品があります',
  out_of_stock: '在庫が足りない商品があります',
  cannot_cancel: 'この注文はキャンセルできません（期限切れ、または農家さんが準備を始めています）。',
  login_required: 'ログインしてください。',
};
export function friendly(err: unknown): { status: number; message: string } {
  if (err instanceof HttpError) return { status: err.status, message: MESSAGES[err.message] ?? err.message };
  const raw = (err as { message?: string })?.message ?? String(err);
  const [code, detail] = raw.split(':');
  if (MESSAGES[code]) return { status: 400, message: MESSAGES[code] + (detail ? `（${detail}）` : '') };
  console.error(err);
  return { status: 500, message: 'エラーが起きました。時間をおいてもう一度お試しください。' };
}

export function handler(fn: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
    try {
      return await fn(req);
    } catch (err) {
      const { status, message } = friendly(err);
      return json({ error: message }, status);
    }
  };
}
