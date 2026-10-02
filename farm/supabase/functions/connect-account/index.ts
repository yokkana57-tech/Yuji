// 農家さんの売上受け取り口座（Stripe Connect Express）の登録と状態確認。
// body: { action: 'onboard' } → 登録画面の URL を返す
//       { action: 'status' }  → Stripe に問い合わせて、注文を受けられるかを更新して返す
import { admin, requireStripe, handler, HttpError, json, requireUser, SITE_URL, stripe } from '../_shared/util.ts';

Deno.serve(handler(async (req) => {
  requireStripe();
  const user = await requireUser(req);
  const { action } = (await req.json()) as { action: 'onboard' | 'status' };

  const { data: farm } = await admin.from('farms').select('id, stripe_account_id').eq('owner_id', user.id).single();
  if (!farm) throw new HttpError(404, '先に農園を登録してください。');

  let accountId = farm.stripe_account_id as string | null;

  if (action === 'status') {
    if (!accountId) return json({ connected: false, charges_enabled: false });
    const account = await stripe.accounts.retrieve(accountId);
    await admin.from('farms').update({ charges_enabled: !!account.charges_enabled }).eq('id', farm.id);
    return json({ connected: true, charges_enabled: !!account.charges_enabled, details_submitted: !!account.details_submitted });
  }

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'JP',
      email: user.email,
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      metadata: { farm_id: farm.id },
    });
    accountId = account.id;
    await admin.from('farms').update({ stripe_account_id: accountId }).eq('id', farm.id);
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    type: 'account_onboarding',
    refresh_url: `${SITE_URL}#/mine?connect=retry`,
    return_url: `${SITE_URL}#/mine?connect=done`,
  });
  return json({ url: link.url });
}));
