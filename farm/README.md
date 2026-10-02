# やまぐち畑のとなり

山口県の農家さんと、山口県に住む人を直接つなぐスマホアプリです。

| フォルダ・ファイル | 中身 |
| --- | --- |
| `index.html` `app.js` `app.css` `geo.js` | アプリの画面（Web・iPhone・Android で共通） |
| `config.js` | 本番接続の設定。**空のままだと「お試し版」**として端末の中だけで動きます |
| `manifest.webmanifest` `sw.js` `icons/` | ホーム画面に追加したときのアイコンと、オフライン対応 |
| `ios/` `android/` | App Store・Google Play に出すためのアプリのプロジェクト（Capacitor） |
| `supabase/` | サーバー側（データベース・写真の保存・決済の処理） |

## しくみ

- データとログイン：Supabase（メールに届く6桁のコードでログイン）
- 決済：Stripe。**Stripe Connect で、売上は農家さんの口座に直接入ります**
- 価格・在庫・旬・受け取り日時・配送先（山口県内）は、すべてサーバー側で確認します
- なかま市（農家どうしの譲り合い・売買）は、農園を登録した人だけが見られます。お金のやりとりはアプリの外で直接行います

---

# 本番につなぐ手順

上から順番に進めてください。**最初はすべて「テストモード」**で行い、実際のお金は動かしません。

## 0. 先に用意するもの

| 必要なもの | 費用 | 使う場面 |
| --- | --- | --- |
| メールアドレス | 無料 | 各サービスの登録 |
| Supabase のアカウント | 無料プランで開始できます | データベース・ログイン |
| Stripe のアカウント | 登録は無料（決済ごとに手数料） | 決済・農家さんへの入金 |
| Resend のアカウント | 無料プランあり | ログイン用メールの送信 |
| Mac（または Mac のクラウドビルド） | ― | App Store に出すとき |
| Apple Developer Program | 年 12,980円 | App Store に出すとき |
| Google Play デベロッパー | 初回 25ドル | Google Play に出すとき |

## 1. Supabase（データベース）

1. https://supabase.com で「Start your project」→ GitHub かメールで登録
2. 「New project」を作る
   - Name：`yamaguchi-hatake`
   - Database Password：**長いパスワードを作って、自分だけが見られる場所に保管**
   - Region：**Northeast Asia (Tokyo)**
3. 左メニュー **SQL Editor** →「New query」に、`supabase/migrations/20261002000000_init.sql` の中身を全部貼り付けて「Run」
   - 「Success」と出れば OK
4. 左メニュー **Project Settings → API** を開き、次の2つを控える
   - Project URL（`https://xxxx.supabase.co`）
   - Project API keys の **anon public**
   - ※ **service_role** は秘密のキーです。どこにも貼らないでください

## 2. ログイン用メールの送信（Resend）

Supabase 標準のメール送信は、プロジェクトのメンバー以外に届きません。一般のお客さんがログインできるように、メール送信サービスをつなぎます。

1. https://resend.com で登録 → **Domains** で、お持ちのドメイン（例：`hatake-tonari.jp`）を追加し、表示された DNS 設定をドメインの管理画面に入れる
   - ドメインを持っていなければ、お名前.com などで取得してください（年 1,000〜3,000円ほど）
2. Resend の **API Keys** で API キーを作る
3. Supabase の **Authentication → Emails → SMTP Settings** で「Enable Custom SMTP」をオン
   - Host：`smtp.resend.com`　Port：`465`　Username：`resend`　Password：Resend の API キー
   - Sender email：`no-reply@（あなたのドメイン）`　Sender name：`やまぐち畑のとなり`
4. **Authentication → Emails → Templates → Magic Link** の本文を、次のように変える（6桁のコードが届くようにする）
   ```html
   <h2>やまぐち畑のとなり ログインコード</h2>
   <p>アプリに、次の6桁のコードを入力してください。</p>
   <p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
   ```
5. **Authentication → URL Configuration**
   - Site URL：`https://yokkana57-tech.github.io/Yuji/farm/`
   - Redirect URLs：同じ URL を追加

## 3. Stripe（決済）

1. https://stripe.com/jp で登録（最初はテストモードのままで OK）
2. 左メニュー **Connect** →「始める」→ プラットフォームとして設定。アカウントの種類は **Express**
3. **設定 → 決済手段** で、使う支払い方法を有効にする（カード、Apple Pay、Google Pay など）
4. **開発者 → API キー** の「シークレットキー」（`sk_test_...`）を控える（**秘密のキーです**）

## 4. サーバーの処理（Edge Functions）を公開する

ここだけパソコンの「ターミナル」を使います。Mac なら「ターミナル」アプリ、Windows なら「PowerShell」です。

```sh
# 1回だけ：Supabase CLI を入れる（Mac の場合）
brew install supabase/tap/supabase
# Windows の場合は https://supabase.com/docs/guides/cli の手順で入れる

# このリポジトリをダウンロードして、farm フォルダに移動
git clone https://github.com/yokkana57-tech/Yuji.git
cd Yuji/farm

supabase login                                  # ブラウザが開くのでログイン
supabase link --project-ref <Project URL の xxxx の部分>

# 秘密のキーを Supabase に預ける（コードやチャットには書かない）
supabase secrets set STRIPE_SECRET_KEY=sk_test_xxx SITE_URL=https://yokkana57-tech.github.io/Yuji/farm/ PLATFORM_FEE_PERCENT=0

supabase functions deploy create-checkout
supabase functions deploy cancel-order
supabase functions deploy connect-account
supabase functions deploy delete-account
supabase functions deploy stripe-webhook --no-verify-jwt
```

`PLATFORM_FEE_PERCENT` は運営の手数料（%）です。0 なら売上は全額農家さんへ（Stripe の決済手数料は別）。

## 5. Stripe からの通知（Webhook）

Stripe の **開発者 → Webhook →「エンドポイントを追加」** を2回行います。URL はどちらも
`https://<xxxx>.supabase.co/functions/v1/stripe-webhook` です。

| 1つ目：「アカウント」のイベント | 2つ目：「連結アカウント」のイベント |
| --- | --- |
| `checkout.session.completed`<br>`checkout.session.async_payment_succeeded`<br>`checkout.session.async_payment_failed`<br>`checkout.session.expired` | `account.updated` |

それぞれの「署名シークレット」（`whsec_...`）を控えて、ターミナルで：

```sh
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_1つ目 STRIPE_CONNECT_WEBHOOK_SECRET=whsec_2つ目
```

## 6. 画面をつなぐ

`config.js` を GitHub 上で編集します（公開して問題ない値だけです）。

```js
window.HATAKE_CONFIG = {
  supabaseUrl: 'https://xxxx.supabase.co',
  supabaseAnonKey: '（anon public キー）',
  siteUrl: 'https://yokkana57-tech.github.io/Yuji/farm/'
};
```

このブランチを `main` に取り込むと、GitHub Pages で `https://yokkana57-tech.github.io/Yuji/farm/` が公開されます。

## 7. テストする（スマホで）

1. スマホで上の URL を開く → Safari の共有ボタン →「ホーム画面に追加」
2. 「農家の方」でログインして農園を登録 →「受け取り口座を登録する」で、Stripe のテスト用の情報を入れる
3. 別のメールアドレスでログインし直して注文 → テスト用カード `4242 4242 4242 4242`（有効期限は未来の日付、セキュリティコードは好きな3桁）
4. 注文が「お支払い済み」になる／キャンセルで返金される／農家側で「準備できた」→ 受け取りコードで完了、を確かめる

うまくいったら、Stripe を「本番モード」に切り替え、本番のシークレットキーと Webhook で手順 3〜5 をやり直します。

---

# App Store・Google Play に出す

`ios/` と `android/` に、アプリのプロジェクトができています（アイコン設定済み・位置情報とカメラの利用目的も記入済み）。

## iPhone（App Store）

1. https://developer.apple.com/programs/ で Apple Developer Program に登録（年 12,980円・審査に数日かかることがあります）
2. Mac に **Xcode**（App Store から無料）と **Node.js**（https://nodejs.org の LTS 版）を入れる
3. ターミナルで：
   ```sh
   cd Yuji/farm
   npm install
   npm run ios        # Xcode が開きます
   ```
4. Xcode で「App」→ **Signing & Capabilities** → Team に自分の Apple Developer を選ぶ
   - Bundle Identifier は `jp.yamaguchi.hatakenotonari`（使えない場合は自分のドメインに合わせて変更）
5. iPhone をつないで ▶ で実機テスト
6. メニュー **Product → Archive** →「Distribute App」→ App Store Connect にアップロード
7. https://appstoreconnect.apple.com でアプリ情報（説明文・スクリーンショット・プライバシーポリシーの URL・サポート URL）を入れて「審査に提出」

Mac が無い場合は、Codemagic などのクラウドビルドサービスで同じことができます。

## Android（Google Play）

1. https://play.google.com/console でデベロッパー登録（初回 25ドル）
2. **Android Studio**（https://developer.android.com/studio）を入れて、ターミナルで `npm install` → `npm run android`
3. Android Studio の **Build → Generate Signed App Bundle** で `.aab` を作る（署名用の鍵は**なくさないように保管**）
4. Play Console でアプリを作り、`.aab` をアップロードして審査に提出
   - 個人の開発者アカウントは、公開前に「12人以上で14日間のクローズドテスト」が必要です

## 審査の前に用意するもの

- **プライバシーポリシー**と**利用規約**のページ（URL が必要）
- **特定商取引法に基づく表記**（お客さんにものを売るため）
- アプリの説明文と、スマホのスクリーンショット

---

## 地図・地名データの出典

- 県全体の地図：国土交通省「国土数値情報（行政区域データ）」を加工
- 拡大したときの地図：国土地理院「地理院タイル（標準地図）」
- 町名と位置：Geolonia「Japanese Addresses」（CC BY 4.0）
