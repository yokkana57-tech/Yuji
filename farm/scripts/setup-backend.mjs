// サーバー側（Supabase・Stripe・メール送信）の設定を、まとめて自動で行うスクリプト。
// 何度実行しても同じ結果になるように作ってある（途中で失敗しても、もう一度実行すればよい）。
//
// 使い方（farm/ フォルダで）:
//   SUPABASE_ACCESS_TOKEN=... node scripts/setup-backend.mjs
//
// 読む環境変数:
//   SUPABASE_ACCESS_TOKEN  必須。Supabase の Account → Access Tokens で作った作業用トークン
//   SUPABASE_PROJECT_REF   省略時 gjjenadfrmtwibvyrsdb（「山口畑」）
//   SITE_URL               省略時 https://yokkana57-tech.github.io/Yuji/farm/
//   STRIPE_SECRET_KEY      任意。あれば Stripe の通知先（Webhook）作成と、決済用の秘密キー登録まで行う
//   PLATFORM_FEE_PERCENT   任意。運営の手数料（%）。省略時 0
//   RESEND_API_KEY         任意。あればログイン用メールの送信（SMTP）を設定する
//   MAIL_FROM              RESEND_API_KEY を使うときの送信元（例: no-reply@example.jp）
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF || 'gjjenadfrmtwibvyrsdb';
const SITE_URL = process.env.SITE_URL || 'https://yokkana57-tech.github.io/Yuji/farm/';
const STRIPE = process.env.STRIPE_SECRET_KEY || '';
const FEE = process.env.PLATFORM_FEE_PERCENT || '0';
const RESEND = process.env.RESEND_API_KEY || '';
const MAIL_FROM = process.env.MAIL_FROM || '';
if (!TOKEN) { console.error('SUPABASE_ACCESS_TOKEN がありません'); process.exit(1); }

const API = `https://api.supabase.com/v1/projects/${REF}`;
async function sb(path, method = 'GET', body) {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}
const sql = query => sb('/database/query', 'POST', { query });
const step = msg => console.log(`\n▶ ${msg}`);

// ---- 1. データベース ----
step('データベースの設計図（テーブル・権限）');
const [{ exists }] = await sql("select to_regclass('public.market_messages') is not null as exists");
if (exists) {
  console.log('  すでに作成済みなので、そのままにします');
} else {
  await sql(readFileSync('supabase/migrations/20261002000000_init.sql', 'utf8'));
  console.log('  作成しました');
}

// ---- 2. 画面の接続設定（公開キー） ----
step('画面の接続設定（config.js）');
const keys = await sb('/api-keys');
const anon = (keys.find(k => k.name === 'anon') || {}).api_key;
if (!anon) throw new Error('anon キーが見つかりませんでした');
const cfgPath = 'config.js';
let cfg = readFileSync(cfgPath, 'utf8');
cfg = cfg.replace(/supabaseUrl: '[^']*'/, `supabaseUrl: 'https://${REF}.supabase.co'`)
  .replace(/supabaseAnonKey: '[^']*'/, `supabaseAnonKey: '${anon}'`)
  .replace(/siteUrl: '[^']*'/, `siteUrl: '${SITE_URL}'`);
writeFileSync(cfgPath, cfg);
console.log('  config.js に URL と公開キーを書き込みました（公開して問題ない値です）');

// ---- 3. ログイン（メール）の設定 ----
step('ログインの設定');
const codeMail = `<h2>やまぐち畑のとなり ログインコード</h2>
<p>アプリに、次の6桁のコードを入力してください。</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
<p style="color:#888">このメールに心当たりがない場合は、何もしなくて大丈夫です。</p>`;
const auth = {
  site_url: SITE_URL,
  uri_allow_list: [SITE_URL, 'capacitor://localhost', 'https://localhost'].join(','),
  mailer_subjects_magic_link: '【やまぐち畑のとなり】ログインコード',
  mailer_templates_magic_link_content: codeMail,
  mailer_subjects_confirmation: '【やまぐち畑のとなり】ログインコード',
  mailer_templates_confirmation_content: codeMail,
};
if (RESEND) {
  if (!MAIL_FROM) throw new Error('RESEND_API_KEY を使うときは MAIL_FROM（送信元アドレス）も必要です');
  Object.assign(auth, {
    smtp_host: 'smtp.resend.com', smtp_port: '465', smtp_user: 'resend', smtp_pass: RESEND,
    smtp_admin_email: MAIL_FROM, smtp_sender_name: 'やまぐち畑のとなり',
  });
}
await sb('/config/auth', 'PATCH', auth);
console.log(`  ログインコードのメール文面と公開URLを設定しました${RESEND ? '。メール送信は Resend を使います' : '（メール送信サービスは未設定）'}`);

// ---- 4. Stripe ----
const secrets = [
  { name: 'SITE_URL', value: SITE_URL },
  { name: 'PLATFORM_FEE_PERCENT', value: FEE },
];
if (STRIPE) {
  step('Stripe の通知先（Webhook）');
  const stripe = async (path, method = 'GET', form) => {
    const res = await fetch('https://api.stripe.com/v1' + path, {
      method,
      headers: { Authorization: `Bearer ${STRIPE}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form ? new URLSearchParams(form).toString() : undefined,
    });
    const j = await res.json();
    if (!res.ok) throw new Error(`Stripe ${method} ${path} → ${res.status}: ${JSON.stringify(j.error || j).slice(0, 400)}`);
    return j;
  };
  const hookUrl = `https://${REF}.supabase.co/functions/v1/stripe-webhook`;
  // 署名シークレットは作成時にしか取得できないので、同じ URL の古いものは作り直す
  const existing = await stripe('/webhook_endpoints?limit=100');
  for (const w of existing.data.filter(w => w.url === hookUrl)) await stripe(`/webhook_endpoints/${w.id}`, 'DELETE');
  const form = (events, connect) => {
    const f = [['url', hookUrl], ['description', 'やまぐち畑のとなり']];
    events.forEach(e => f.push(['enabled_events[]', e]));
    if (connect) f.push(['connect', 'true']);
    return f;
  };
  const main = await stripe('/webhook_endpoints', 'POST', form([
    'checkout.session.completed', 'checkout.session.async_payment_succeeded',
    'checkout.session.async_payment_failed', 'checkout.session.expired'], false));
  const conn = await stripe('/webhook_endpoints', 'POST', form(['account.updated'], true));
  secrets.push(
    { name: 'STRIPE_SECRET_KEY', value: STRIPE },
    { name: 'STRIPE_WEBHOOK_SECRET', value: main.secret },
    { name: 'STRIPE_CONNECT_WEBHOOK_SECRET', value: conn.secret },
  );
  console.log(`  通知先を2つ作りました（${STRIPE.startsWith('sk_live') ? '本番' : 'テスト'}モード）`);
}

// ---- 5. 秘密のキーを Supabase に預ける ----
step('秘密のキーの登録');
await sb('/secrets', 'POST', secrets);
console.log('  ' + secrets.map(s => s.name).join(', '));

// ---- 6. サーバーの処理（Edge Functions）の公開 ----
step('サーバーの処理（Edge Functions）の公開');
for (const fn of ['create-checkout', 'cancel-order', 'connect-account', 'delete-account', 'stripe-webhook']) {
  const args = ['--yes', 'supabase@latest', 'functions', 'deploy', fn, '--project-ref', REF, '--use-api'];
  if (fn === 'stripe-webhook') args.push('--no-verify-jwt');
  execFileSync('npx', args, { stdio: 'inherit', env: { ...process.env, SUPABASE_ACCESS_TOKEN: TOKEN } });
}

console.log('\n✅ 完了しました。');
if (!STRIPE) console.log('   ※ Stripe はまだ設定していません。STRIPE_SECRET_KEY を用意して、もう一度実行してください。');
if (!RESEND) console.log('   ※ メール送信サービスは未設定です。プロジェクトのメンバー以外にはログインのメールが届きません。');
