# やまぐち畑のとなり

山口県の農家さんと、山口県に住む人を直接つなぐアプリです。

- `index.html` … アプリ本体（画面はこの1ファイル）
- `config.js` … 本番接続の設定。**空のままだと「お試し版」**として、端末の中だけで動きます
- `supabase/` … サーバー側（データベースと決済の処理）

## しくみ

```
お客さん ─┬─ 画面（GitHub Pages）── Supabase（データベース・ログイン）
          │                             └─ Edge Functions ─── Stripe（決済・返金・農家さんへの入金）
          └─ Stripe の決済画面でお支払い ──────────────┘ （支払い完了は Stripe → stripe-webhook で通知）
```

- 売上は **Stripe Connect** で、農家さんの口座に直接入ります（運営の手数料は `PLATFORM_FEE_PERCENT` で設定。初期値 0%）
- 価格・在庫・旬・受け取り日時・配送先（山口県内）は、すべてサーバー側で確認します。画面から送られた金額は使いません
- キャンセルの期限（注文から1〜3日・受け取り日の前日まで）は、農家さんが設定できます。農家さんが「準備できた」「発送した」を押した後はキャンセルできません

## 本番につなぐ手順

以下は運営者が一度だけ行う作業です。最初は **Stripe のテストモード** で試してください。

### 1. Supabase のプロジェクトを作る

1. https://supabase.com でプロジェクトを新しく作る（三日月オーダーとは別のプロジェクトにすると、データと権限が混ざらず安全です）
2. **SQL Editor** を開き、`supabase/migrations/20261002000000_init.sql` の中身を貼り付けて実行する
3. **Authentication → URL Configuration**
   - Site URL：公開する URL（例：`https://yokkana57-tech.github.io/Yuji/farm/`）
   - Redirect URLs：同じ URL を追加
4. **Authentication → Emails → SMTP Settings** で、メール送信サービス（Resend など）を設定する
   - Supabase 標準のメール送信は、プロジェクトのメンバー以外に送れず、送れる数も少ないため、一般の利用者がログインできません
5. **Authentication → Emails → Templates → Magic Link** の本文に、6桁のコードを入れる
   ```html
   <p>ログイン用のコード：<b>{{ .Token }}</b></p>
   <p>または <a href="{{ .ConfirmationURL }}">こちらのリンク</a> を開いてください。</p>
   ```

### 2. Stripe を準備する

1. https://stripe.com でアカウントを作り、**Connect** を有効にする（アカウントの種類は Express）
2. **設定 → 決済手段** で、使う支払い方法（カード、Apple Pay、Google Pay など）を有効にする
3. **開発者 → API キー** のシークレットキー（`sk_test_...`）を控える

### 3. Edge Functions を公開する

[Supabase CLI](https://supabase.com/docs/guides/cli) を入れて、このフォルダ（`farm/`）で実行します。

```sh
supabase login
supabase link --project-ref <プロジェクトID>

supabase secrets set \
  STRIPE_SECRET_KEY=sk_test_xxx \
  SITE_URL=https://yokkana57-tech.github.io/Yuji/farm/ \
  PLATFORM_FEE_PERCENT=0

supabase functions deploy create-checkout
supabase functions deploy cancel-order
supabase functions deploy connect-account
supabase functions deploy stripe-webhook --no-verify-jwt
```

### 4. Stripe からの通知（Webhook）を設定する

Stripe の **開発者 → Webhook** で、送信先を2つ作ります。URL はどちらも
`https://<プロジェクトID>.supabase.co/functions/v1/stripe-webhook` です。

| 送信先 | 受け取るイベント | 署名シークレットの保存先 |
| --- | --- | --- |
| あなたのアカウント | `checkout.session.completed` `checkout.session.async_payment_succeeded` `checkout.session.async_payment_failed` `checkout.session.expired` | `STRIPE_WEBHOOK_SECRET` |
| 連結アカウント（Connect） | `account.updated` | `STRIPE_CONNECT_WEBHOOK_SECRET` |

```sh
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx STRIPE_CONNECT_WEBHOOK_SECRET=whsec_yyy
```

### 5. 画面をつなぐ

`config.js` に、Supabase の **Project Settings → API** にある値を入れます（公開して問題ない値です）。

```js
window.HATAKE_CONFIG = {
  supabaseUrl: 'https://<プロジェクトID>.supabase.co',
  supabaseAnonKey: '<anon public キー>'
};
```

`main` ブランチに入ると GitHub Pages に公開され、`/farm/` で開けます。

### 6. テストする

1. 「農家の方」タブでログインして農園を登録し、「受け取り口座を登録する」から Stripe のテスト情報で口座を登録する
2. 別のメールアドレスでログインし、商品を注文する。テスト用カード `4242 4242 4242 4242`（有効期限は未来の日付、CVC は任意の3桁）で支払う
3. 注文画面が「お支払い済み」になること、キャンセルで Stripe 上に返金が作られることを確認する

**秘密のキー（`sk_...`、`whsec_...`、Supabase の service_role キー）は、`config.js` やチャットには絶対に書かず、`supabase secrets set` だけで設定してください。**

## 地図・地名データの出典

- 市町の境界：国土交通省「国土数値情報（行政区域データ）」を加工して作成
- 町名と位置：Geolonia「Japanese Addresses」（CC BY 4.0。国土交通省「位置参照情報」などをもとにしたデータ）
