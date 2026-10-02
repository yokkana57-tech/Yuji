// 注文を作って在庫を確保し、Stripe Checkout（決済画面）の URL を返す。
// 価格はブラウザから受け取らず、必ずデータベースの値で計算する。
import { admin, requireStripe, FEE_PERCENT, handler, HttpError, json, requireUser, SITE_URL, stripe } from '../_shared/util.ts';

type Body = {
  farm_id: string;
  method: 'ship' | 'pickup';
  items: { product_id: string; qty: number }[];
  pickup?: { date: string; hour: number; msg?: string };
  ship?: { zip: string; addr: string };
  buyer: { name: string; tel: string };
};

Deno.serve(handler(async (req) => {
  requireStripe();
  const user = await requireUser(req);
  const body = (await req.json()) as Body;
  if (!SITE_URL) throw new Error('SITE_URL is not set');

  const { data: farm, error: farmErr } = await admin
    .from('farms').select('id, farm_name, stripe_account_id, charges_enabled').eq('id', body.farm_id).single();
  if (farmErr || !farm) throw new HttpError(404, 'farm_not_found');
  if (!farm.charges_enabled || !farm.stripe_account_id) throw new HttpError(400, 'farm_not_ready');

  const { data: order, error } = await admin.rpc('create_order', {
    p_buyer: user.id,
    p_farm: body.farm_id,
    p_method: body.method,
    p_items: body.items,
    p_pickup: body.pickup ?? {},
    p_ship: body.ship ?? {},
    p_name: (body.buyer?.name ?? '').trim(),
    p_tel: (body.buyer?.tel ?? '').trim(),
  });
  if (error) throw new Error(error.message);

  const items = order.items as { name: string; unit: string; qty: number; price: number }[];
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale: 'ja',
      currency: 'jpy',
      customer_email: user.email,
      line_items: items.map((i) => ({
        quantity: i.qty,
        price_data: {
          currency: 'jpy',
          unit_amount: i.price, // 円は小数なしの通貨なので、そのままの金額
          product_data: { name: `${i.name}（${i.unit}）${body.method === 'pickup' ? '・畑で受け取り' : '・県内配送 送料込み'}` },
        },
      })),
      payment_intent_data: {
        // 売上は農家さんの Stripe 口座へ直接入る（Stripe Connect のデスティネーション支払い）
        transfer_data: { destination: farm.stripe_account_id },
        application_fee_amount: Math.floor((order.total * FEE_PERCENT) / 100),
        metadata: { order_id: order.id },
      },
      metadata: { order_id: order.id },
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      success_url: `${SITE_URL}#/order/${order.id}?new=1`,
      cancel_url: `${SITE_URL}#/order/${order.id}`,
    });
    await admin.from('orders').update({ stripe_session_id: session.id, stripe_checkout_url: session.url }).eq('id', order.id);
    return json({ order_id: order.id, url: session.url });
  } catch (err) {
    // 決済画面を作れなかったら、確保した在庫をすぐ戻す
    await admin.rpc('release_order', { p_order: order.id });
    throw err;
  }
}));
