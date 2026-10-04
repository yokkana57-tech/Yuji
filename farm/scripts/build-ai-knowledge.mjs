// 質問箱（AI）に渡す「アプリの説明書」を、使い方ガイドとよくある質問（help.js）から作る。
// help.js を直したら、このスクリプトを実行してから ask-ai を公開しなおす（setup-backend.mjs が自動で行う）。
//   node scripts/build-ai-knowledge.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = { window: {} };
vm.runInNewContext(readFileSync('help.js', 'utf8'), ctx);
const H = ctx.window.HATAKE_HELP;

const screens = `
# 画面の場所（スマホの下に並んでいるボタン＝タブ）
- 「さがす」（🗾）：住んでいる地域をえらぶと、近くの農家さんが並ぶ。地図もある。
- 「畑だより」（📰）：農家さんが書いた畑の様子。上の「フォロー中の農家さん」からフォローした農家さんの一覧を見られる。
- 「お手伝い」（🙌）：畑のお手伝い（ボランティア）の募集と、自分の申し込み。
- 「注文」（🧺）：自分が注文したもの。注文をタップすると、受け取りの番号・キャンセル・農家さんとのメッセージ・口コミ。いちばん下に「ログアウト」「アカウントを削除」。
- 「農家の方」（👩‍🌾）：農家さん用。上に「注文・畑だより・お手伝い・なかま市・プロフィール」の切りかえがある。
- 右上の「☰」：メニュー（使い方ガイド・よくある質問・お問い合わせ・利用規約・プライバシーポリシー・文字の大きさ）。
- 右上の「◐」：画面を暗い色／明るい色に切りかえる。
- 右下の「❓ しつもん」：この質問箱。

# 画面へのリンク（答えの中で使ってよいのはこれだけ）
- [使い方ガイド](#/guide) / [農家さん向けの使い方](#/guide/farmer) / [よくある質問](#/faq) / [お問い合わせ](#/contact)
- [さがす](#/) / [注文したもの](#/orders) / [お手伝い](#/help) / [農家の方](#/mine) / [農園の登録・プロフィール](#/mine/profile) / [利用規約](#/legal/terms) / [プライバシーポリシー](#/legal/privacy)

# 注文の流れ（くわしく）
1. 「さがす」で農家さんをえらぶ。
2. 農家さんのページの「買う」で、「畑で受け取る」か「家に届けてもらう」をえらび、「＋」で数を決める。
3. 下に出る「注文へ進む」を押す。はじめての人は、メールアドレスとパスワード（8文字以上）で「新しく登録する」。2回目からは「ログイン」。
4. 名前・電話番号（配送なら郵便番号と住所。山口県内 740〜759 のみ）を入れる。
5. 畑で受け取る場合は、受け取りの日と時間をえらぶ。農家さんによっては「受け取りのときに現金で払う」もえらべる。
6. カード払いは、次の画面（Stripe）でカード番号を入れて支払う。
7. 注文画面に4けたの番号が出る。受け取りのときに農家さんに伝える。
`;

const guide = (title, list) => `# ${title}\n` + list.map((x, i) => `${i + 1}. ${x.title}：${x.text}`).join('\n');
const faq = '# よくある質問\n' + H.faq.map(x => `Q（${x.cat}）${x.q}\nA ${x.a}`).join('\n\n');
const text = [screens.trim(), guide('使い方ガイド（買う方）', H.guide.buyer), guide('使い方ガイド（農家さん）', H.guide.farmer), faq].join('\n\n');

writeFileSync('supabase/functions/ask-ai/knowledge.ts',
  '// このファイルは scripts/build-ai-knowledge.mjs が help.js から自動で作る。直接直さないこと。\n' +
  `export const KNOWLEDGE = ${JSON.stringify(text)};\n`);
console.log(`knowledge.ts を作りました（${text.length}文字）`);
