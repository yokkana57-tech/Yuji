// 質問箱：アプリの使い方を、AI（Claude）がやさしく答える。
// body: { messages: [{ role: 'user' | 'assistant', text: string }, ...] }（最後は user）
// 返り値: { answer } / { limited: true }（回数の上限） / { fallback: true }（AI が使えない → 画面側でよくある質問から探す）
// 質問の中身は保存しない。回数だけ ai_usage に数える。
import Anthropic from 'npm:@anthropic-ai/sdk';
import { admin, handler, HttpError, json } from '../_shared/util.ts';
import { KNOWLEDGE } from './knowledge.ts';

const API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const client = API_KEY ? new Anthropic({ apiKey: API_KEY }) : null;

// 説明書は毎回同じ文章なので、キャッシュしておく（2回目以降の料金が約10分の1になる）
const SYSTEM = `あなたは、スマホのアプリ「やまぐち畑のとなり」の案内係です。山口県の農家さんと、山口に住む人をつなぐアプリです。
使う人の多くは、お年寄りや、スマホに慣れていない人です。

答え方のきまり：
- やさしい日本語で、短く答える。むずかしい言葉・カタカナ語・英語はできるだけ使わない（使うときは言いかえる）。
- 操作は「1.」「2.」…の手順で書き、1つの手順には1つの操作だけ書く。ボタンの名前は「」でかこみ、画面のどこにあるか（下・右上など）も言う。
- 答えは、下の<説明書>に書いてあることだけをもとにする。書いていない機能・ボタン・画面をつくらない。わからないときは正直に「わかりません」と言い、[お問い合わせ](#/contact)をすすめる。
- リンクは、<説明書>の「画面へのリンク」にあるものだけを、[名前](#/...) の形で使ってよい。
- 1つ1つの注文のこと（届かない・傷んでいた・返金はいつ など）は、あなたには確認できない。注文画面のメッセージで農家さんに聞くか、[お問い合わせ](#/contact)で運営に聞くよう案内する。
- 電話番号・住所・カード番号・パスワードなどは、ここに書かないよう伝える。あなたからたずねない。
- アプリの使い方と関係ない質問（健康・お金・法律の相談、ほかのアプリのことなど）には、「この質問箱は、アプリの使い方についてお答えしています」とやさしく伝える。
- 見出し・表・太字・絵文字は使わない。改行と「1.」の番号だけ使う。長くても10行くらいまで。

<説明書>
${KNOWLEDGE}
</説明書>`;

type Turn = { role: 'user' | 'assistant'; text: string };

async function whoKey(req: Request): Promise<string> {
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (jwt) {
    const { data } = await admin.auth.getUser(jwt).catch(() => ({ data: { user: null } }));
    if (data?.user) return 'u:' + data.user.id;
  }
  // ログインしていない人は、通信元を数える（そのままは保存せず、ハッシュにする）
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('hatake-ai:' + ip));
  return 'ip:' + Array.from(new Uint8Array(buf)).slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(handler(async (req) => {
  const body = (await req.json().catch(() => ({}))) as { messages?: Turn[] };
  const turns = (Array.isArray(body.messages) ? body.messages : [])
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string' && m.text.trim())
    .slice(-8)
    .map(m => ({ role: m.role, content: m.text.trim().slice(0, 800) }));
  while (turns.length && turns[0].role !== 'user') turns.shift();
  if (!turns.length || turns[turns.length - 1].role !== 'user') throw new HttpError(400, 'bad_question');

  if (!client) return json({ fallback: true });

  const { data: allowed } = await admin.rpc('ai_take', { p_key: await whoKey(req) });
  if (!allowed) return json({ limited: true });

  try {
    const params = {
      model: 'claude-opus-5-5',
      max_tokens: 2000,
      output_config: { effort: 'low' },
      // 安全のための判定で答えられなかったときは、Anthropic がすすめる別のモデルで答えなおす
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: turns,
    };
    const res = await client.beta.messages.create(params as unknown as Parameters<typeof client.beta.messages.create>[0]) as Anthropic.Beta.BetaMessage;
    if (res.stop_reason === 'refusal') {
      return json({ answer: 'ごめんなさい、その質問にはお答えできません。アプリの使い方について、もう一度聞いてみてください。' });
    }
    const answer = res.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join('\n').trim();
    console.log('ask-ai usage', JSON.stringify({ in: res.usage.input_tokens, cache_read: res.usage.cache_read_input_tokens, cache_write: res.usage.cache_creation_input_tokens, out: res.usage.output_tokens }));
    return json({ answer: answer || 'ごめんなさい、うまく答えられませんでした。もう一度聞いてみてください。' });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) console.error('ask-ai rate limited');
    else if (err instanceof Anthropic.AuthenticationError) console.error('ask-ai: ANTHROPIC_API_KEY が正しくありません');
    else if (err instanceof Anthropic.APIError) console.error('ask-ai api error', err.status, err.message);
    else console.error('ask-ai error', err);
    // AI が使えないときは、画面側で「よくある質問」から探して答える
    return json({ fallback: true });
  }
}));
