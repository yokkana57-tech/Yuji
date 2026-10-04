import { createClient, type User } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17';

// Stripe のキーが未登録でも、決済を使わない機能（アカウント削除など）は動くようにする
export const STRIPE_READY = !!Deno.env.get('STRIPE_SECRET_KEY');
export const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || 'sk_not_configured', {
  httpClient: Stripe.createFetchHttpClient(),
});
export function requireStripe(): void {
  if (!STRIPE_READY) throw new HttpError(503, 'payments_not_ready');
}

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

// 呼び出しを許可する画面：公開サイトと、iPhone・Android アプリ（Capacitor）
const ALLOWED_ORIGINS = new Set([
  SITE_URL ? new URL(SITE_URL).origin : '',
  'capacitor://localhost', // iPhone アプリ
  'https://localhost',     // Android アプリ
].filter(Boolean));
function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : [...ALLOWED_ORIGINS][0] ?? '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
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
  payments_not_ready: 'オンライン決済の準備中です。もうしばらくお待ちください。',
  bad_question: '質問を入力してください。',
};
export function friendly(err: unknown): { status: number; message: string } {
  if (err instanceof HttpError) return { status: err.status, message: MESSAGES[err.message] ?? err.message };
  // Stripe のエラーは、原因が分かるように内容をそのまま伝える
  if ((err as { type?: string })?.type?.startsWith?.('Stripe')) {
    console.error(err);
    return { status: 502, message: '決済サービスでエラーが起きました：' + ((err as { message?: string }).message ?? '') };
  }
  const raw = (err as { message?: string })?.message ?? String(err);
  const [code, detail] = raw.split(':');
  if (MESSAGES[code]) return { status: 400, message: MESSAGES[code] + (detail ? `（${detail}）` : '') };
  console.error(err);
  return { status: 500, message: 'エラーが起きました。時間をおいてもう一度お試しください。' };
}

export function handler(fn: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    const cors = corsFor(req);
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
    let res: Response;
    try {
      res = await fn(req);
    } catch (err) {
      const { status, message } = friendly(err);
      res = json({ error: message }, status);
    }
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
    return res;
  };
}
