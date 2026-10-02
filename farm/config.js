// 本番接続の設定。Supabase の「Project Settings → API」にある値を入れてください。
// どれも公開しても問題ない値です（秘密のキーは Supabase の Edge Functions 側にだけ置きます）。
// 空のままだと「お試し版」として、端末の中だけで動きます。
window.HATAKE_CONFIG = {
  supabaseUrl: 'https://gjjenadfrmtwibvyrsdb.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqamVuYWRmcm10d2lidnlyc2RiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5NDg0NzUsImV4cCI6MjEwNjUyNDQ3NX0.Ey2PRvrTOmM-67JpZRfMT-dRuzp9NB5t-rtsr0kHyv0',  // 例: 'eyJhbGciOi...'（anon public キー）
  siteUrl: 'https://yokkana57-tech.github.io/Yuji/farm/'
};
