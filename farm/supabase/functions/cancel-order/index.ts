// お客さんによるキャンセル。
// - 支払い前（決済画面を閉じた等）: 決済画面を無効にして在庫を戻す
// - 支払い後: 期限内かつ農家さんが準備を始める前だけ。全額返金する
import { admin, handler, HttpError, json, requireUser, stripe } from '../_shared/util.ts';

Deno.serve(handler(async (req) => {
  const user = await requireUser(req);
  const { order_id } = (await req.json()) as { order_id: string };

  const { data: order } = await admin.from('orders').select('*').eq('id', order_id).single();
  if (!order || order.buyer_id !== user.id) throw new HttpError(404, 'cannot_cancel');

  if (order.status === 'pending_payment') {
    if (order.stripe_session_id) {
      try { await stripe.checkout.sessions.expire(order.stripe_session_id); } catch (_) { /* すでに期限切れ・完了済み */ }
    }
    const { data: released } = await admin.rpc('release_order', { p_order: order.id });
    if (!released) throw new HttpError(409, 'cannot_cancel');
    return json({ status: 'expired' });
  }

  // 期限・状態のチェックと在庫の戻しはデータベース側で一度に行う（農家さんの「準備OK」と競合しないように）
  const { data: canceled, error } = await admin.rpc('begin_cancel', { p_order: order.id, p_user: user.id });
  if (error) throw new Error(error.message);

  let refundStatus = 'refunded';
  try {
    await stripe.refunds.create({
      payment_intent: canceled.stripe_payment_intent,
      reverse_transfer: true, // 農家さんへ送金済みの分も取り戻す
      refund_application_fee: true,
      metadata: { order_id: order.id },
    });
  } catch (err) {
    console.error('refund failed', order.id, err);
    refundStatus = 'failed'; // 運営者が Stripe ダッシュボードで手動返金する
  }
  await admin.from('orders').update({ refund_status: refundStatus }).eq('id', order.id);
  return json({ status: 'canceled', refund_status: refundStatus });
}));
