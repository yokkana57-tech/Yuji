// アカウントの削除（App Store の審査で、アプリ内から削除できることが求められる）。
// 進行中の注文がある間は削除できない。削除すると農園・畑だより・なかま市・写真が消え、
// 注文の記録だけは売上の記録として残る（お客さん・農家さんとの紐づけは外れる）。
import { admin, handler, HttpError, json, requireUser } from '../_shared/util.ts';

const ACTIVE = ['pending_payment', 'paid', 'ready', 'shipped'];

Deno.serve(handler(async (req) => {
  const user = await requireUser(req);

  const { count: asBuyer } = await admin.from('orders').select('id', { count: 'exact', head: true })
    .eq('buyer_id', user.id).in('status', ACTIVE);
  const { data: farm } = await admin.from('farms').select('id').eq('owner_id', user.id).maybeSingle();
  let asFarmer = 0;
  if (farm) {
    const { count } = await admin.from('orders').select('id', { count: 'exact', head: true })
      .eq('farm_id', farm.id).in('status', ACTIVE);
    asFarmer = count ?? 0;
  }
  if ((asBuyer ?? 0) + asFarmer > 0) {
    throw new HttpError(409, '進行中の注文があるため、まだ削除できません。注文が完了（またはキャンセル）してから、もう一度お試しください。');
  }

  // 写真を消す（ユーザーIDのフォルダの中身）
  const { data: files } = await admin.storage.from('photos').list(user.id, { limit: 1000 });
  if (files && files.length) await admin.storage.from('photos').remove(files.map((f) => `${user.id}/${f.name}`));

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) throw new Error(error.message);
  return json({ deleted: true });
}));
