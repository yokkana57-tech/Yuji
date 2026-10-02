// Stripe からの通知を受けて、注文の支払い状態と農家さんの口座状態を更新する。
// このエンドポイントは Stripe から直接呼ばれるので、JWT ではなく Stripe の署名で検証する（verify_jwt = false）。
import Stripe from 'npm:stripe@17';
import { admin, stripe } from '../_shared/util.ts';

const secrets = [Deno.env.get('STRIPE_WEBHOOK_SECRET'), Deno.env.get('STRIPE_CONNECT_WEBHOOK_SECRET')].filter(Boolean) as string[];
const crypto = Stripe.createSubtleCryptoProvider();

async function verify(body: string, sig: string): Promise<Stripe.Event> {
  let last: unknown;
  for (const secret of secrets) {
    try { return await stripe.webhooks.constructEventAsync(body, sig, secret, undefined, crypto); } catch (e) { last = e; }
  }
  throw last ?? new Error('no webhook secret configured');
}

Deno.serve(async (req) => {
  const sig = req.headers.get('Stripe-Signature');
  if (!sig) return new Response('missing signature', { status: 400 });
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await verify(body, sig);
  } catch (err) {
    console.error('bad signature', err);
    return new Response('bad signature', { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.payment_status !== 'paid') break; // コンビニ払いなどは入金後に async_payment_succeeded が来る
        const orderId = s.metadata?.order_id;
        const pi = typeof s.payment_intent === 'string' ? s.payment_intent : s.payment_intent?.id;
        const { data: ok } = await admin.rpc('mark_order_paid', { p_order: orderId, p_payment_intent: pi });
        if (!ok && pi) {
          // 期限切れで在庫を戻した後に支払いが完了した、まれなケース → 返金する
          const { data: o } = await admin.from('orders').select('status').eq('id', orderId).single();
          if (o?.status === 'expired') {
            await stripe.refunds.create({ payment_intent: pi, reverse_transfer: true, refund_application_fee: true });
            await admin.from('orders').update({ refund_status: 'refunded', stripe_payment_intent: pi }).eq('id', orderId);
          }
        }
        break;
      }
      case 'checkout.session.expired':
      case 'checkout.session.async_payment_failed': {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.metadata?.order_id) await admin.rpc('release_order', { p_order: s.metadata.order_id });
        break;
      }
      case 'account.updated': {
        const a = event.data.object as Stripe.Account;
        await admin.from('farms').update({ charges_enabled: !!a.charges_enabled }).eq('stripe_account_id', a.id);
        break;
      }
    }
  } catch (err) {
    console.error('webhook handling failed', event.type, err);
    return new Response('error', { status: 500 }); // Stripe が自動で再送してくれる
  }
  return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } });
});
