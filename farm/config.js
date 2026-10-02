// 本番接続の設定。Supabase の「Project Settings → API」にある値を入れてください。
// どれも公開しても問題ない値です（秘密のキーは Supabase の Edge Functions 側にだけ置きます）。
// 空のままだと「お試し版」として、端末の中だけで動きます。
window.HATAKE_CONFIG = {
  supabaseUrl: '',      // 例: 'https://xxxxxxxx.supabase.co'
  supabaseAnonKey: '',  // 例: 'eyJhbGciOi...'（anon public キー）
  siteUrl: ''           // 公開する URL。例: 'https://yokkana57-tech.github.io/Yuji/farm/'
};
