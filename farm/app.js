(() => {
  'use strict';

  // ---------- 地図データ（geo.js） ----------
  const GEO = window.YGEO;
  if (!GEO) throw new Error('地図データ（geo.js）を読み込めませんでした');

  // ---------- 実行環境 ----------
  const APP_VERSION = '1.5.0';
  const NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const STANDALONE = NATIVE || (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  const IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  // ---------- 定数 ----------
  const MONTHS = [1,2,3,4,5,6,7,8,9,10,11,12];
  const NOW_MONTH = new Date().getMonth() + 1;
  const WEEK = ['日','月','火','水','木','金','土'];
  const CATS = { veg: '野菜', fruit: '果物', rice: 'お米', other: 'その他' };
  const CAT_COLOR = { veg: '', fruit: 'carrot', rice: 'corn', other: 'eggplant' };
  // 表示は農林水産省「特別栽培農産物に係る表示ガイドライン」に沿った言い回しにする（「無農薬」等の表示は不可）
  const PESTICIDE = {
    none: { label: '栽培期間中 不使用', short: '農薬不使用' },
    reduced: { label: '節減対象農薬を地域慣行の5割以上減', short: '農薬節減' },
    conventional: { label: '地域の慣行基準に沿って使用', short: '' }
  };
  const FERTILIZER = {
    none: '化学肥料 栽培期間中 不使用',
    reduced: '化学肥料（窒素成分）を地域慣行の5割以上減',
    conventional: '地域の慣行基準に沿って使用'
  };
  const STYLES = ['露地', 'ハウス', '露地＋ハウス', '水田', '果樹園', 'れんこん田'];
  const REGION_OF = {
    '下関市': 'west', '宇部市': 'west', '山陽小野田市': 'west', '美祢市': 'west',
    '山口市': 'central', '防府市': 'central',
    '萩市': 'north', '長門市': 'north', '阿武町': 'north',
    '周南市': 'east', '下松市': 'east', '光市': 'east', '岩国市': 'east', '柳井市': 'east', '和木町': 'east',
    '周防大島町': 'east', '上関町': 'east', '田布施町': 'east', '平生町': 'east'
  };
  const REGIONS = { west: '西部', central: '中部', north: '北部', east: '東部' };
  const CITY_NAMES = Object.keys(REGION_OF);
  const EMOJIS = ['🥬','🥕','🍅','🥒','🌽','🍆','🫑','🥔','🧅','🍠','🌾','🍚','🍎','🍊','🍋','🍓','🍇','🍑','🍐','🍈','🫚','🪷','🥦','🌻'];
  const HUES = ['#B9E4A6','#FFC98F','#FFB3A7','#FFE38A','#D7BCEB','#A9E0D3','#FFD1E0','#CDE7A0'];
  const ZIP_RE = /^7[45]\d-?\d{4}$/;           // 山口県の郵便番号（740〜759）
  const TEL_RE = /^0\d{1,4}-?\d{1,4}-?\d{3,4}$/;
  // 利用規約・プライバシーポリシーへのリンク（App Store の審査でも、アプリ内から見られることが必要）
  const legalFoot = extra => `<p class="legal-foot">${extra || ''}<a href="#/legal/terms">利用規約</a> ・ <a href="#/legal/privacy">プライバシーポリシー</a></p>`;
  const sellerOf = f => f.sellerName || f.farmer;
  // 保管・鮮度（農家さんの申告）
  const FRESH = { same_day: '収穫したその日に発送・お渡し', next_day: '収穫の翌日までに発送・お渡し', few_days: '収穫から2〜3日以内に発送・お渡し', stored: '貯蔵して出荷する品目（お米・いも・玉ねぎなど）' };
  const FRESH_SHORT = { same_day: '🌅 朝どれ当日', next_day: '🌱 収穫翌日まで', few_days: '🗓 収穫2〜3日', stored: '🏠 貯蔵品' };
  const STORE_WAYS = { cold_room: '予冷庫（冷蔵室）で保管', fridge: '業務用の冷蔵庫で保管', shade: '風通しのよい日陰で常温保管', dry_store: '乾燥・追熟させてから保管', rice_cold: '玄米を低温倉庫で保管', none: '保管せず、収穫してすぐお渡し' };
  const SHIP_TEMP = { normal: '常温便', cool: 'クール便（冷蔵）', depends: '品目によって常温便・クール便' };
  const hasStorage = f => !!(f.storage && (f.storage.fresh || (f.storage.ways || []).length || f.storage.note));
  const shipDaysOf = f => f.shipDays || 3;
  const FEE_PERCENT = Number((window.HATAKE_CONFIG || {}).feePercent) || 0;
  const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
  // なかま市（農家どうしの譲り合い・売買）
  const MK_KIND = { give: '譲ります', sell: '売ります', want: 'さがしてます' };
  const MK_CAT = { tool: '農具', machine: '農機', material: '資材', seed: '種・苗', other: 'その他' };
  const MK_EMOJI = { tool: '🔧', machine: '🚜', material: '📦', seed: '🌱', other: '🧺' };
  const MK_STATUS = { open: '受付中', reserved: '取引中', closed: '終了' };

  // ---------- 投影（緯度経度 ⇔ 地図上の座標） ----------
  const PJ = GEO.proj;
  const toXY = (lat, lng) => [(lng - PJ.lng0) * PJ.cos * PJ.k, (PJ.lat1 - lat) * PJ.k];
  const toLL = (x, y) => [PJ.lat1 - y / PJ.k, x / (PJ.cos * PJ.k) + PJ.lng0];
  const KM = PJ.k / 111.0; // 1km あたりの地図上の長さ
  const CITY_CENTER = {};
  CITY_NAMES.forEach(c => { const l = GEO.cities[c].l; CITY_CENTER[c] = toLL(l[0], l[1]).map(v => Math.round(v * 1000) / 1000); });
  const PLACES = GEO.places.map(([ci, name, lat, lng]) => ({ city: GEO.cityOrder[ci], name, lat, lng }));
  PLACES.forEach(p => { const [x, y] = toXY(p.lat, p.lng); p.x = x; p.y = y; });
  const inYamaguchi = (lat, lng) => lat > 33.6 && lat < 34.9 && lng > 130.7 && lng < 132.6;

  // ---------- サンプルデータ（お試し版のみ。山口の特産品をもとにした架空の農家です） ----------
  const SAMPLE_FARMS = [
    {
      id: 's1', farmName: 'たまげ農園', farmer: '藤井 正明', city: '萩市', lat: 34.40, lng: 131.43,
      since: 1988, area: '1.2ha', emoji: '🍆', hue: 4, cancelDays: 2,
      catch: 'ひとつでたまげる、萩の大きななす。',
      story: '「たまげなす」っちゅう名前は、あんまり大きゅうて、みんなが「たまげた！」って言うたのが始まりなんよ。\n\nひとつ500gから、大きいのは1kg近くになる。皮がやわらかくて、焼くととろっとする。この味を絶やしたくなくて、30年以上つくり続けちょります。\n\n夏の朝は4時から畑。なすは水が大好きじゃけえ、毎日の水やりが勝負です。一回、焼きなすで食べてみてほしいっちゃ。',
      methods: { pesticide: 'reduced', fertilizer: 'reduced', style: '露地', soil: '牛ふん堆肥と稲わらで土づくり。なすの間にマリーゴールドを植えて虫よけに。' },
      storage: { fresh: 'same_day', ways: ['cold_room'], temp: '10℃前後', ship: 'cool', note: '朝4時から収穫して、すぐ予冷庫へ。皮がやわらかいので、冷やしすぎないようにしています。' },
      certs: ['やまぐちブランド'],
      pickup: { enabled: true, place: '萩市内・畑の横の直売小屋', days: [2, 4, 6], from: 9, to: 16, note: '軍手を持ってきてくれたら、収穫体験もできます！' },
      products: [
        { id: 'p1', name: '萩たまげなす', cat: 'veg', months: [6,7,8,9,10], note: '焼きなすにすると絶品', unit: '3本入り（約2kg）', shipPrice: 2200, pickupPrice: 1800, stock: 12 },
        { id: 'p2', name: '夏秋野菜おまかせセット', cat: 'veg', months: [7,8,9,10], note: 'なす・ピーマン・オクラなど', unit: '5〜6品', shipPrice: 2500, pickupPrice: 2000, stock: 8 }
      ],
      posts: [{ id: 's1p1', date: '2026-09-29', emoji: '🍆', title: 'たまげなす、秋なすシーズン！', body: '朝晩が涼しゅうなって、なすの皮がいちだんとやわらかくなりました。今年最後のたまげなす、ぜひ。' }]
    },
    {
      id: 's2', farmName: 'しまのみかん畑 かわむら', farmer: '河村 千春', city: '周防大島町', lat: 33.93, lng: 132.25,
      since: 1972, area: '1.6ha', emoji: '🍊', hue: 1, cancelDays: 3,
      catch: '瀬戸内の島で、海風にあたって育つみかん。',
      story: '周防大島は「みかんの島」。祖父母の代から、海を見下ろす段々畑でみかんを育てています。\n\n大阪で働いていたけど、帰省のたびに荒れていく畑を見るのがつらくて、8年前にUターンしました。\n\n島のみかんは、海からの照り返しと潮風で、甘みと酸味のバランスがいいんです。収穫の時期は、畑で採れたてを食べてもらうのが一番。島まで遊びにきてください！',
      methods: { pesticide: 'reduced', fertilizer: 'reduced', style: '果樹園', soil: '草生栽培（下草を刈って土に還す）。有機質肥料が中心。' },
      certs: ['エコやまぐち'],
      pickup: { enabled: true, place: '周防大島町・みかん畑の作業小屋', days: [0, 6], from: 10, to: 15, note: '週末だけ受け取りできます。橋をわたって島ドライブがてらどうぞ。' },
      products: [
        { id: 'p1', name: '大島みかん（早生）', cat: 'fruit', months: [10,11,12], note: 'さっぱり甘い', unit: '5kg箱', shipPrice: 3200, pickupPrice: 2500, stock: 20 },
        { id: 'p2', name: '大島みかん（訳あり）', cat: 'fruit', months: [10,11,12,1], note: 'キズあり・味は同じ', unit: '5kg箱', shipPrice: 2400, pickupPrice: 1700, stock: 3 },
        { id: 'p3', name: '伊予柑', cat: 'fruit', months: [1,2,3], note: '', unit: '5kg箱', shipPrice: 3400, pickupPrice: 2700, stock: 15 }
      ],
      posts: [{ id: 's2p1', date: '2026-10-01', emoji: '🍊', title: '早生みかん、収穫はじめました！', body: '今年は夏が暑くて心配したけど、味のりは上々。島の秋の味、お届けします。' }]
    },
    {
      id: 's3', farmName: '尾津れんこん 西村農園', farmer: '西村 浩二', city: '岩国市', lat: 34.15, lng: 132.21,
      since: 1960, area: '2ha', emoji: '🪷', hue: 6, cancelDays: 1,
      catch: '穴が9つ。岩国れんこんは縁起もの。',
      story: '岩国れんこんは、穴が9つあるのが特徴なんです。お殿様の家紋に似ちょるっちゅうて、昔から大事にされてきました。\n\nれんこん掘りは、冬の冷たい泥の中に胸まで浸かっての作業。正直きついです。でも、もっちりして粘りのある岩国れんこんを「おいしい」と言ってもらえると、全部報われます。\n\n直売所に来てくれたら、泥つきのまま掘りたてを渡しますよ。',
      methods: { pesticide: 'conventional', fertilizer: 'reduced', style: 'れんこん田', soil: '冬の間に田んぼを休ませ、有機質肥料で土を肥やす。' },
      certs: [],
      pickup: { enabled: true, place: '岩国市尾津町・れんこん田そばの作業場', days: [1, 3, 5, 6], from: 8, to: 12, note: '午前中だけです。泥つきなので袋をご用意ください。' },
      products: [
        { id: 'p1', name: '岩国れんこん（泥つき）', cat: 'veg', months: [9,10,11,12,1,2,3], note: 'もっちり粘りが強い', unit: '2kg', shipPrice: 2800, pickupPrice: 2200, stock: 25 },
        { id: 'p2', name: '岩国れんこん（洗い・お料理用）', cat: 'veg', months: [9,10,11,12,1,2,3], note: '', unit: '1kg', shipPrice: 1800, pickupPrice: 1300, stock: 18 }
      ],
      posts: [{ id: 's3p1', date: '2026-09-22', emoji: '🪷', title: '今年のれんこん掘り、スタート', body: 'まだ暑さが残っちょるけど、早掘りのれんこんはみずみずしくてシャキシャキ。きんぴらにどうぞ。' }]
    },
    {
      id: 's4', farmName: '徳佐りんご園 まつもと', farmer: '松本 恵子', city: '山口市', lat: 34.36, lng: 131.73,
      since: 1958, area: '3ha', emoji: '🍎', hue: 2, cancelDays: 2,
      catch: '西日本でりんご？ 阿東の寒さがつくる甘さです。',
      story: '「山口でりんご？」ってよく驚かれます。阿東徳佐は標高が高くて、冬は雪も積もる寒い土地。だから、りんごが育つんです。\n\n義父が植えたふじの木は、もう60年選手。1本1本クセがあって、毎年話しかけながら剪定しています。\n\n秋はりんご狩りもしているので、注文したりんごを受け取りに来たついでに、木からもいでいってくださいね。',
      methods: { pesticide: 'reduced', fertilizer: 'reduced', style: '果樹園', soil: '剪定した枝をチップにして畑に還す。葉とらずで樹上完熟。' },
      storage: { fresh: 'next_day', ways: ['cold_room', 'shade'], temp: '5℃前後', ship: 'normal', note: '収穫したりんごは予冷庫で休ませてから、1つずつ手で選んで箱詰めします。' },
      certs: [],
      pickup: { enabled: true, place: '山口市阿東徳佐・りんご園の受付', days: [0, 1, 3, 5, 6], from: 9, to: 16, note: '9〜11月はりんご狩りも営業中。' },
      products: [
        { id: 'p1', name: '秋映（あきばえ）', cat: 'fruit', months: [9,10], note: '濃い赤で甘酸っぱい', unit: '3kg箱', shipPrice: 3000, pickupPrice: 2400, stock: 10 },
        { id: 'p2', name: 'サンふじ', cat: 'fruit', months: [11,12], note: '蜜入り', unit: '3kg箱', shipPrice: 3300, pickupPrice: 2700, stock: 30 },
        { id: 'p3', name: 'りんごジュース（ストレート）', cat: 'other', months: MONTHS.slice(), note: '', unit: '1L×2本', shipPrice: 2100, pickupPrice: 1600, stock: 40 }
      ],
      posts: [{ id: 's4p1', date: '2026-09-30', emoji: '🍎', title: '秋映が真っ赤に色づきました', body: 'この週末からりんご狩りもスタート！ 受け取りついでにぜひ。' }]
    },
    {
      id: 's5', farmName: 'ゆずきちの里 おおた', farmer: '太田 翔', city: '長門市', lat: 34.37, lng: 131.17,
      since: 2018, area: '80a', emoji: '🍋', hue: 7, cancelDays: 3,
      catch: '長門にしかない香り「ゆずきち」を、全国へ。',
      story: 'ゆずきちは、長門で昔から育てられてきた香酸かんきつ。すだちよりまろやかで、ゆずよりさわやか。焼き魚にしぼると、もう戻れません。\n\nでも、つくる人はどんどん減っています。28歳で地域おこし協力隊として長門に来て、おじいちゃんたちから園地を引き継ぎました。\n\nゆずきちを知ってもらうことが、この里を残すことにつながると信じています。',
      methods: { pesticide: 'none', fertilizer: 'none', style: '果樹園', soil: '剪定枝と落ち葉のたい肥のみ。草刈りは手作業。' },
      certs: [],
      pickup: { enabled: true, place: '長門市・園地入口の倉庫', days: [6], from: 10, to: 14, note: '土曜日のみ。お会いできるのを楽しみにしています！' },
      products: [
        { id: 'p1', name: '長門ゆずきち（青玉）', cat: 'fruit', months: [8,9,10], note: '焼き魚・鍋・お酒に', unit: '1kg', shipPrice: 1600, pickupPrice: 1200, stock: 6 },
        { id: 'p2', name: 'ゆずきち果汁 100%', cat: 'other', months: MONTHS.slice(), note: '', unit: '300ml', shipPrice: 1400, pickupPrice: 1000, stock: 24 }
      ],
      posts: [{ id: 's5p1', date: '2026-09-26', emoji: '🍋', title: '青玉の収穫、ラストスパート', body: '10月いっぱいで青玉は終わり。そのあとは果汁にしてお届けします。' }]
    },
    {
      id: 's6', farmName: '秋吉台ファーム', farmer: '原田 勝', city: '美祢市', lat: 34.24, lng: 131.32,
      since: 1979, area: '2.4ha', emoji: '🥕', hue: 0, cancelDays: 2,
      catch: 'カルスト台地のふもと、石灰質の土で育つごぼう。',
      story: '秋吉台のふもと、美東の赤土は石灰岩が風化したもの。この土で育つごぼうは、やわらかくて香りがええ、と昔から評判なんです。\n\n「美東ごぼう」は、何代にもわたって種を採り継いできた地域の宝もの。ぼくもその一人として、毎年種をつないでいます。\n\n長いごぼうを折らずに掘るのは、なかなかの技術。冬に来てくれたら、掘るところも見せますよ。',
      methods: { pesticide: 'reduced', fertilizer: 'conventional', style: '露地', soil: '1m以上深く耕す。自家採種で在来の美東ごぼうを守る。' },
      certs: ['やまぐちブランド'],
      pickup: { enabled: false, place: '', days: [], from: 9, to: 16, note: '' },
      products: [
        { id: 'p1', name: '美東ごぼう', cat: 'veg', months: [11,12,1,2,3], note: 'やわらかく香り高い', unit: '2kg（泥つき）', shipPrice: 2900, pickupPrice: 2900, stock: 30 },
        { id: 'p2', name: '里いも', cat: 'veg', months: [9,10,11], note: 'ねっとり', unit: '2kg', shipPrice: 2100, pickupPrice: 2100, stock: 9 }
      ],
      posts: [{ id: 's6p1', date: '2026-09-18', emoji: '🥔', title: '里いも、掘りはじめ', body: 'ごぼうはもう少し先。まずは里いもから。煮っころがしにしてみてください。' }]
    },
    {
      id: 's7', farmName: 'こめと野菜の よしだ家', farmer: '吉田 健太・美咲', city: '山口市', lat: 34.12, lng: 131.40,
      since: 2015, area: '4ha', emoji: '🌾', hue: 3, cancelDays: 2,
      catch: '山口生まれのお米と、山口生まれの野菜を。',
      story: '夫婦で脱サラして、美咲の実家の田んぼを継ぎました。\n\n育てているのは、山口県で生まれたお米「恋の予感」と、山口県オリジナル野菜の「はなっこりー」。せっかく山口で農業をやるなら、山口生まれのものを育てたかったんです。\n\n子どもたちも田んぼが遊び場。家族みんなでつくっています。受け取りに来てくれたら、子どもたちが元気にお出迎えします（笑）',
      methods: { pesticide: 'reduced', fertilizer: 'reduced', style: '露地＋ハウス', soil: '稲わらとたい肥で土づくり。田んぼにはメダカやカエルもいます。' },
      certs: ['特別栽培（県認証）'],
      pickup: { enabled: true, place: '山口市・自宅横の農機具小屋', days: [0, 2, 4, 6], from: 9, to: 18, note: '' },
      products: [
        { id: 'p1', name: '新米 恋の予感', cat: 'rice', months: [10,11,12], note: '粒が大きくもちもち', unit: '5kg（白米）', shipPrice: 3500, pickupPrice: 2900, stock: 40 },
        { id: 'p2', name: 'はなっこりー', cat: 'veg', months: [12,1,2,3], note: '山口生まれの緑黄色野菜', unit: '300g×3袋', shipPrice: 1500, pickupPrice: 1000, stock: 0 },
        { id: 'p3', name: '季節の野菜セット', cat: 'veg', months: MONTHS.slice(), note: '旬を5〜7品', unit: '5〜7品', shipPrice: 2500, pickupPrice: 2000, stock: 10 }
      ],
      posts: [
        { id: 's7p1', date: '2026-09-27', emoji: '🌾', title: '稲刈り終わりました！', body: '家族総出で稲刈り完了。乾燥・もみすりが終わったら新米お届けです。' },
        { id: 's7p2', date: '2026-09-10', emoji: '🥦', title: 'はなっこりーの種まき', body: '12月の収穫に向けて、今年も種まき。山口だけの野菜、もっと知ってほしいな。' }
      ]
    },
    {
      id: 's8', farmName: '豊田の梨園 たなか', farmer: '田中 由美', city: '下関市', lat: 34.18, lng: 131.03,
      since: 1983, area: '1.5ha', emoji: '🍐', hue: 5, cancelDays: 1,
      catch: 'ほたるの里で育つ、みずみずしい梨。',
      story: '下関の豊田町は、初夏になるとほたるが飛びかう、水のきれいな町。その水と、昼と夜の寒暖差が、梨を甘くしてくれます。\n\n梨は、一つひとつ袋をかけて大事に育てます。春の花粉つけから秋の収穫まで、ずっと手しごと。\n\n父から受け継いだ梨園を、今は母と二人で守っています。梨のシーズンは直売所を開けていますので、ぜひ会いに来てください。',
      methods: { pesticide: 'reduced', fertilizer: 'reduced', style: '果樹園', soil: '有機質肥料中心。一果ずつ袋かけ。' },
      certs: [],
      pickup: { enabled: true, place: '下関市豊田町・梨園の直売所', days: [0, 1, 2, 3, 4, 5, 6], from: 9, to: 17, note: '梨のシーズン中は毎日営業しています。' },
      products: [
        { id: 'p1', name: '新高（にいたか）梨', cat: 'fruit', months: [9,10], note: '大玉で日持ちがいい', unit: '5kg箱', shipPrice: 3700, pickupPrice: 3000, stock: 7 },
        { id: 'p2', name: '豊水梨', cat: 'fruit', months: [8,9], note: '', unit: '5kg箱', shipPrice: 3500, pickupPrice: 2800, stock: 0 }
      ],
      posts: [{ id: 's8p1', date: '2026-09-24', emoji: '🍐', title: '新高、今年は大玉です', body: '一つで1kg近いのもあります。今年の梨は豊作！' }]
    }
  ];
  // お試し版の、お手伝い募集の見本（架空）
  const SAMPLE_HELPS = (() => {
    const d = n => { const t = new Date(); t.setDate(t.getDate() + n); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };
    return [
      { id: 'sh1', farmId: 's1', title: 'ミニトマトの収穫', body: '朝のうちに収穫して、パック詰めまで一緒にやりましょう。はじめての方も大歓迎です。', date: d(6), from: 8, to: 11, capacity: 3, filled: 0, place: '萩市・畑の横の直売小屋', thanks: '収穫したトマトのおすそわけ', bring: '軍手・帽子・飲み物', beginner: true, meal: false, status: 'open' },
      { id: 'sh2', farmId: 's4', title: 'りんごの葉摘み', body: '実に日が当たるように、まわりの葉を摘む作業です。脚立は使いません。', date: d(9), from: 9, to: 15, capacity: 5, filled: 0, place: '山口市阿東徳佐・りんご園の受付', thanks: 'りんご1袋', bring: '軍手・汚れてもいい服', beginner: true, meal: true, status: 'open' }
    ];
  })();
  // お試し版の口コミの見本（架空）
  const SAMPLE_REVIEWS = [
    { id: 'sr1', farmId: 's1', rating: 5, tags: ['おいしい', '新鮮'], comment: '皮がやわらかくて、焼きなすが最高でした。また買います！', name: '萩のみちこ', items: '千両なす', reply: 'ありがとうございます！焼きなす、うちでも毎晩です。', date: '2026-08-21T10:00:00Z' },
    { id: 'sr2', farmId: 's4', rating: 4, tags: ['おいしい', '農家さんが親切'], comment: '受け取りのときに、りんごの見分け方を教えてもらいました。', name: 'あとうっ子', items: '秋映', reply: '', date: '2026-09-28T10:00:00Z' }
  ];
  const SAMPLE_MARKET = [
    { id: 'm1', farmId: 's7', kind: 'give', cat: 'material', title: '育苗トレイ（128穴）30枚', body: '新しいのを買ったので、前のを譲ります。少し日焼けしていますが、まだまだ使えます。取りに来てもらえる方。', price: 0, condition: 'やや使用感あり', status: 'open', date: '2026-09-28', photos: [] },
    { id: 'm2', farmId: 's1', kind: 'sell', cat: 'machine', title: '管理機（ミニ耕うん機）', body: '畝立てに使っていました。エンジンは快調で、春にメンテナンス済みです。軽トラで運べます。', price: 35000, condition: '中古・動作良好', status: 'open', date: '2026-09-25', photos: [] },
    { id: 'm3', farmId: 's4', kind: 'want', cat: 'tool', title: '太い枝も切れる剪定ばさみ', body: 'りんごの剪定用に、太めの枝も切れるものを探しています。中古で大丈夫です。', price: null, condition: '', status: 'open', date: '2026-09-30', photos: [] },
    { id: 'm4', farmId: 's3', kind: 'sell', cat: 'material', title: '防草シート 1m×50m 2本', body: '買いすぎてしまいました。未開封です。', price: 4000, condition: '未使用', status: 'open', date: '2026-09-20', photos: [] },
    { id: 'm5', farmId: 's2', kind: 'give', cat: 'material', title: 'みかんコンテナ 20個', body: '古くなったコンテナです。収穫や片付けにどうぞ。', price: 0, condition: '使用感あり', status: 'reserved', date: '2026-09-15', photos: [] }
  ];

  // ---------- 端末内の保存 ----------
  const KEY = {
    mine: 'yamahata.myfarm', follows: 'yamahata.follows', cheers: 'yamahata.cheers', theme: 'yamahata.theme',
    orders: 'yamahata.orders', stock: 'yamahata.stock', buyer: 'yamahata.buyer', home: 'yamahata.home',
    cart: 'yamahata.cart', next: 'yamahata.next', market: 'yamahata.market', mkmsg: 'yamahata.mkmsg', install: 'yamahata.install',
    intro: 'yamahata.intro', inquiries: 'yamahata.inquiries', omsg: 'yamahata.omsg',
    helps: 'yamahata.helps', entries: 'yamahata.entries', biz: 'yamahata.biz', talk: 'yamahata.talk', reviews: 'yamahata.reviews', textSize: 'yamahata.textsize'
  };
  const store = {
    get(k, fallback) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { toast('保存できませんでした（端末の保存領域がいっぱいか、使えません）'); return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* noop */ } }
  };

  // ---------- ユーティリティ ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // 画像の URL は https か、端末内で作った data:image だけを使う
  const safeUrl = u => (/^(https:\/\/|data:image\/(jpeg|png|webp);base64,)/.test(String(u || '')) ? String(u).replace(/["'\\\s()]/g, encodeURIComponent) : '');
  const yen = n => '¥' + Number(n || 0).toLocaleString('ja-JP');
  const hue = f => HUES[(f.hue || 0) % HUES.length];
  function fmtDate(d) { const t = new Date(String(d).length <= 10 ? d + 'T00:00:00' : d); return isNaN(t) ? esc(d) : `${t.getFullYear()}年${t.getMonth() + 1}月${t.getDate()}日`; }
  function fmtDay(d) { const t = new Date(d + 'T00:00:00'); return isNaN(t) ? esc(d) : `${t.getMonth() + 1}月${t.getDate()}日（${WEEK[t.getDay()]}）`; }
  function fmtDateTime(iso) { const t = new Date(iso); return isNaN(t) ? '' : `${t.getMonth() + 1}月${t.getDate()}日（${WEEK[t.getDay()]}）${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}`; }
  const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const today = () => ymd(new Date());
  const uid = () => Math.random().toString(36).slice(2, 10);
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
  }

  // アプリ内の確認ダイアログ（ブラウザ標準の確認ダイアログは、アプリや一部の画面では表示されないため）
  function ask(message, okLabel = 'はい', danger = false) {
    return new Promise(resolve => {
      const wrap = document.createElement('div');
      wrap.className = 'modal';
      wrap.innerHTML = `<div class="modal-card" role="alertdialog" aria-modal="true" aria-labelledby="askMsg">
        <p id="askMsg">${esc(message).replace(/\n/g, '<br>')}</p>
        <div class="modal-actions"><button type="button" class="btn ghost" data-a="no">やめる</button><button type="button" class="btn ${danger ? '' : 'leaf'}" data-a="yes">${esc(okLabel)}</button></div>
      </div>`;
      const done = v => { wrap.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
      const onKey = e => { if (e.key === 'Escape') done(false); };
      wrap.addEventListener('click', e => { if (e.target === wrap) done(false); const a = e.target.closest && e.target.closest('[data-a]'); if (a) done(a.dataset.a === 'yes'); });
      document.addEventListener('keydown', onKey);
      document.body.appendChild(wrap);
      $('[data-a=yes]', wrap).focus();
    });
  }
  const inSeason = p => (p.months || []).includes(NOW_MONTH);
  const inSeasonNow = f => (f.products || []).some(inSeason);
  const seasonalNames = f => (f.products || []).filter(inSeason).map(p => p.name);
  const cats = f => [...new Set((f.products || []).map(p => p.cat))];
  const yearsFarming = f => f.since ? Math.max(0, new Date().getFullYear() - Number(f.since)) : null;
  const canPickup = f => !!(f.pickup && f.pickup.enabled && (f.pickup.days || []).length);
  // 畑で受け取るときの現金払い（手数料ゼロ）。カード払いの口座がなくても予約を受けられる
  const canCash = f => canPickup(f) && !!f.pickup.cash;
  const canOrder = f => !!f.chargesEnabled || canCash(f);
  // サーバー（Postgres）のエラーコードを、お客さんに見せる日本語にする
  const RPC_MSG = {
    login_required: 'ログインしてください。', farm_not_found: 'この農家さんは見つかりませんでした。',
    cash_not_available: 'この農家さんは現金払いを受け付けていません。',
    cash_blocked: '受け取りに来られなかった予約が続いたため、現金払いの予約はできません。カード払いをご利用ください。',
    too_many_reserved: '現金払いの予約は、同時に3件までです。',
    bad_name: 'お名前を入力してください。', bad_tel: '電話番号を確認してください。', bad_items: '商品を選んでください。',
    pickup_not_available: 'この農家さんは畑での受け取りをしていません。', bad_pickup_date: '受け取り日を選び直してください。',
    bad_pickup_day: 'その曜日は受け取りできません。', bad_pickup_time: 'その時間は受け取りできません。', bad_qty: '数量を確認してください。',
    product_not_found: '商品が見つかりませんでした。', out_of_season: 'いまはお届けできない時期の商品があります', out_of_stock: '在庫が足りない商品があります',
    cannot_cancel: 'この予約は取り消せません（期限切れ、または農家さんが準備を始めています）。',
    too_early: '受け取りの時間が過ぎてから押してください。',
    review_not_allowed: '口コミは、受け取りが完了した注文だけ書けます。', review_too_late: '口コミは、受け取りから60日以内に書いてください。',
    help_not_found: 'このお手伝いの募集は見つかりませんでした。', help_closed: 'この募集は締め切られました。',
    own_help: '自分の募集には申し込めません。', already_applied: 'すでに申し込んでいます。', help_full: '募集人数がいっぱいです。',
    not_allowed: 'この操作はできません。', bad_transition: 'この申し込みはもう変更できません。',
    too_many_posts: '短い時間にたくさん送られたため、いったん止めています。時間をおいてお試しください。'
  };
  const rpcError = e => { const [code, detail] = String(e.message || '').split(':'); return new Error(RPC_MSG[code] ? RPC_MSG[code] + (detail ? `（${detail}）` : '') : (e.message || 'エラーが起きました')); };
  function nextMonthOf(p) {
    for (let i = 1; i <= 12; i++) { const m = ((NOW_MONTH - 1 + i) % 12) + 1; if ((p.months || []).includes(m)) return m; }
    return null;
  }
  function km(a, b) {
    const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(h));
  }
  const fmtKm = d => d < 1 ? '1km以内' : `約${Math.round(d)}km`;
  const gmapUrl = f => `https://www.google.com/maps/search/?api=1&query=${f.lat},${f.lng}`;
  // 住所が分かるときは住所で、分からないときは地図で選んだ位置で Google マップを開く
  const fullAddr = a => (/^山口県/.test(a) ? a : '山口県' + a);
  const gmapAddrUrl = (addr, ll) => addr ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddr(addr))}` : gmapUrl(ll);
  function loadScript(src) {
    return new Promise((ok, ng) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => ng(new Error('読み込めませんでした: ' + src)); document.head.appendChild(s); });
  }

  // 外部の画面（Stripe の決済・口座登録）を開く。アプリ版ではアプリ内ブラウザで開き、閉じたら戻ってくる
  function openExternal(url, onClose) {
    const Browser = NATIVE && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser;
    if (Browser) {
      Browser.addListener('browserFinished', () => { Browser.removeAllListeners(); if (onClose) onClose(); });
      Browser.open({ url, presentationStyle: 'popover' });
    } else {
      location.href = url;
    }
  }

  // 写真を縮小して JPEG にする（通信量と保存容量を節約）
  function compressImage(file, maxSize, quality) {
    return new Promise((ok, ng) => {
      const img = new Image();
      const src = URL.createObjectURL(file);
      img.onload = () => {
        const s = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * s);
        c.height = Math.round(img.naturalHeight * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(src);
        c.toBlob(b => b ? ok(b) : ng(new Error('写真を変換できませんでした')), 'image/jpeg', quality);
      };
      img.onerror = () => { URL.revokeObjectURL(src); ng(new Error('この写真は読み込めませんでした')); };
      img.src = src;
    });
  }
  const blobToDataUrl = b => new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(b); });

  // 写真えらび（複数枚まで）。返り値の get() で URL の配列を取り出す
  function photoPicker(el, initial, max, label) {
    let urls = (initial || []).filter(safeUrl);
    let busy = false;
    function draw() {
      el.innerHTML = `<div class="photo-pick">
        ${urls.map((u, i) => `<div class="ph"><img src="${esc(safeUrl(u))}" alt=""><button type="button" data-rm="${i}" aria-label="写真を外す">×</button></div>`).join('')}
        ${urls.length < max ? `<label class="add"><span>📷</span>${busy ? 'アップ中…' : esc(label)}<input type="file" accept="image/*" hidden></label>` : ''}
      </div>`;
      $$('[data-rm]', el).forEach(b => b.addEventListener('click', () => { urls.splice(Number(b.dataset.rm), 1); draw(); }));
      const input = $('input[type=file]', el);
      if (input) input.addEventListener('change', async () => {
        const file = input.files && input.files[0];
        if (!file) return;
        busy = true; draw();
        try { urls.push(await api.uploadPhoto(file)); } catch (err) { toast(err.message || '写真を追加できませんでした'); }
        busy = false; draw();
      });
    }
    draw();
    return { get: () => urls.slice(), busy: () => busy };
  }

  // ---------- お住まいの地域 ----------
  const getHome = () => store.get(KEY.home, null);
  function setHome(h) { store.set(KEY.home, h); state.rad = state.rad || 20; }

  // 「山口市仁保」「徳地」「萩 須佐」などを、町名データから探す
  function searchPlaces(raw) {
    let q = String(raw || '').replace(/[\s　]/g, '').replace(/^山口県/, '').replace(/ケ/g, 'ヶ');
    if (!q) return [];
    let city = null;
    for (const c of CITY_NAMES) {
      const short = c.replace(/[市町]$/, '');
      if (q.startsWith(c)) { city = c; q = q.slice(c.length); break; }
      if (q.startsWith(short) && short.length >= 2 && (q === short || !PLACES.some(p => p.name.startsWith(q)))) { city = c; q = q.slice(short.length); break; }
    }
    const out = [];
    if (city && !q) {
      const [lat, lng] = CITY_CENTER[city];
      out.push({ label: city, sub: '市町の中心あたり', lat, lng, city });
    }
    if (q) {
      const pool = PLACES.filter(p => !city || p.city === city);
      const starts = pool.filter(p => p.name.startsWith(q));
      const incl = pool.filter(p => !p.name.startsWith(q) && p.name.includes(q));
      // 同じ市町で「徳地◯◯」のように複数ある → 「徳地」一帯としてまとめる
      const byCity = {};
      starts.forEach(p => { (byCity[p.city] = byCity[p.city] || []).push(p); });
      Object.entries(byCity).forEach(([c, list]) => {
        if (list.length > 1 && !list.some(p => p.name === q)) {
          out.push({ label: `${c} ${q}`, sub: `${list.length}地区のあたり`, lat: list.reduce((s, p) => s + p.lat, 0) / list.length, lng: list.reduce((s, p) => s + p.lng, 0) / list.length, city: c });
        }
      });
      starts.concat(incl).forEach(p => out.push({ label: `${p.city} ${p.name}`, sub: '', lat: p.lat, lng: p.lng, city: p.city }));
    }
    return out.slice(0, 8);
  }
  function nearestPlace(lat, lng) {
    let best = null, bd = Infinity;
    PLACES.forEach(p => { const d = km({ lat, lng }, p); if (d < bd) { bd = d; best = p; } });
    return best;
  }

  // ======================================================================
  //  データの読み書き（お試し版：端末内 ／ 本番：Supabase + Stripe）
  // ======================================================================
  const CFG = window.HATAKE_CONFIG || {};
  const WANT_LIVE = !!(CFG.supabaseUrl && CFG.supabaseAnonKey);

  // ---- 本番 ----
  const live = {
    mode: 'live', sb: null, user: null,
    async init() {
      await loadScript(SUPABASE_JS);
      this.sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
        auth: { flowType: 'pkce', detectSessionInUrl: !NATIVE, persistSession: true }
      });
      const { data } = await this.sb.auth.getSession();
      this.user = data.session?.user || null;
      this.sb.auth.onAuthStateChange((_ev, session) => { this.user = session?.user || null; });
      // ログインのリンクから戻ってきたら、URL の ?code=… を消して元の画面へ
      if (/[?&]code=/.test(location.search)) {
        const next = store.get(KEY.next, '#/');
        store.del(KEY.next);
        history.replaceState(null, '', location.pathname + next);
      }
    },
    async signIn(email) {
      const redirect = (CFG.siteUrl || (location.origin + location.pathname));
      const { error } = await this.sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } });
      if (error) throw new Error('メールを送れませんでした：' + error.message);
    },
    async verify(email, token) {
      const { data, error } = await this.sb.auth.verifyOtp({ email, token, type: 'email' });
      if (error) throw new Error('コードが正しくないか、期限が切れています。');
      this.user = data.user;
    },
    async passwordLogin(email, password) {
      const { data, error } = await this.sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error(/invalid login/i.test(error.message) ? 'メールアドレスかパスワードがちがいます。はじめての方は「新しく登録する」を押してください。' : 'ログインできませんでした：' + error.message);
      this.user = data.user;
    },
    async register(email, password) {
      const { data, error } = await this.sb.auth.signUp({ email, password });
      if (error) throw new Error(/already registered|already exists/i.test(error.message) ? 'このメールアドレスは登録済みです。「ログイン」を押してください。' : '登録できませんでした：' + error.message);
      if (!data.session) throw new Error('このメールアドレスは登録済みか、確認待ちです。「ログイン」を押してください。');
      this.user = data.user;
    },
    async signOut() { await this.sb.auth.signOut(); this.user = null; },
    farmFrom(r) {
      return {
        id: r.id, ownerId: r.owner_id, farmName: r.farm_name, farmer: r.farmer, city: r.city, lat: r.lat, lng: r.lng,
        latPicked: r.lat_picked, since: r.since || '', area: r.area, emoji: r.emoji, hue: r.hue, catch: r.catch, story: r.story,
        coverUrl: r.cover_url || '',
        methods: Object.assign({ pesticide: 'conventional', fertilizer: 'conventional', style: '露地', soil: '' }, r.methods || {}),
        certs: r.certs || [], pickup: r.pickup || {}, cancelDays: r.cancel_days, published: r.published,
        sellerName: r.seller_name || '', shipDays: r.ship_days || 3, bizOk: !!r.biz_ok, bizNote: r.biz_note || '', storage: r.storage || {},
        chargesEnabled: r.charges_enabled, stripeLinked: !!r.stripe_account_id,
        products: (r.products || []).slice().sort((a, b) => a.sort - b.sort).map(p => ({
          id: p.id, name: p.name, cat: p.cat, months: p.months, note: p.note, unit: p.unit,
          shipPrice: p.ship_price, pickupPrice: p.pickup_price, stock: p.stock
        })),
        posts: (r.posts || []).map(p => ({ id: p.id, date: p.created_at.slice(0, 10), emoji: p.emoji, title: p.title, body: p.body, photoUrl: p.photo_url || '' }))
      };
    },
    orderFrom(r) {
      const f = r.farms || {};
      return {
        id: r.id, code: r.code, farmId: r.farm_id, farmName: f.farm_name || r.farm_name || '', farmEmoji: f.emoji || '🧺', farmCity: f.city || '',
        farmLat: f.lat, farmLng: f.lng, items: r.items, method: r.method, total: r.total, pickup: r.pickup, ship: r.ship,
        buyer: { name: r.buyer_name, tel: r.buyer_tel }, status: r.status, cancelDeadline: r.cancel_deadline,
        createdAt: r.created_at, checkoutUrl: r.stripe_checkout_url, refundStatus: r.refund_status, payment: r.payment || 'card'
      };
    },
    async loadFarms() {
      const [{ data, error }, rt] = await Promise.all([
        this.sb.from('farms').select('*, products(*), posts(*)').eq('published', true),
        this.sb.from('farm_ratings').select('*')
      ]);
      if (error) throw error;
      const rating = {};
      (rt.data || []).forEach(x => { rating[x.farm_id] = { avg: Number(x.avg), n: x.n }; });
      return data.map(r => Object.assign(this.farmFrom(r), { rating: rating[r.id] || null }));
    },
    async myFarm() {
      if (!this.user) return null;
      const { data } = await this.sb.from('farms').select('*, products(*), posts(*), farm_private(pickup_addr, seller_tel, seller_addr)').eq('owner_id', this.user.id).maybeSingle();
      if (!data) return null;
      const priv = Array.isArray(data.farm_private) ? data.farm_private[0] : data.farm_private;
      return Object.assign(this.farmFrom(data), { pickupAddr: (priv && priv.pickup_addr) || '', sellerTel: (priv && priv.seller_tel) || '', sellerAddr: (priv && priv.seller_addr) || '' });
    },
    async saveFarm(f) {
      const row = {
        farm_name: f.farmName, farmer: f.farmer, city: f.city, lat: f.lat, lng: f.lng, lat_picked: f.latPicked,
        since: f.since || null, area: f.area, emoji: f.emoji, hue: f.hue, catch: f.catch, story: f.story, cover_url: f.coverUrl || null,
        methods: f.methods, certs: f.certs, pickup: f.pickup, cancel_days: f.cancelDays, published: true,
        seller_name: f.sellerName || '', ship_days: f.shipDays || 3, biz_ok: !!f.bizOk, biz_note: f.bizNote || '', storage: f.storage || {}
      };
      let farmId = f.ownerId ? f.id : null;
      if (farmId) {
        const { error } = await this.sb.from('farms').update(row).eq('id', farmId);
        if (error) throw error;
      } else {
        const { data, error } = await this.sb.from('farms').insert(row).select('id').single();
        if (error) throw error;
        farmId = data.id;
      }
      {
        const { error } = await this.sb.from('farm_private').upsert({ farm_id: farmId, pickup_addr: f.pickupAddr || '', seller_tel: f.sellerTel || '', seller_addr: f.sellerAddr || '', updated_at: new Date().toISOString() });
        if (error) throw error;
      }
      const { data: existing } = await this.sb.from('products').select('id').eq('farm_id', farmId);
      const keep = new Set(f.products.filter(p => !String(p.id).startsWith('new-')).map(p => p.id));
      const removed = (existing || []).map(p => p.id).filter(id => !keep.has(id));
      if (removed.length) {
        const { error } = await this.sb.from('products').delete().in('id', removed);
        if (error) throw error;
      }
      for (const [i, p] of f.products.entries()) {
        const prow = { farm_id: farmId, name: p.name, cat: p.cat, months: p.months, note: p.note, unit: p.unit, ship_price: p.shipPrice, pickup_price: p.pickupPrice, stock: p.stock, sort: i };
        const q = String(p.id).startsWith('new-') ? this.sb.from('products').insert(prow) : this.sb.from('products').update(prow).eq('id', p.id);
        const { error } = await q;
        if (error) throw error;
      }
      return farmId;
    },
    async deleteFarm(f) {
      const { error } = await this.sb.from('farms').delete().eq('id', f.id);
      if (error) {
        // 注文の記録がある農園は消せないので、非公開にする
        await this.sb.from('farms').update({ published: false }).eq('id', f.id);
        return 'hidden';
      }
      return 'deleted';
    },
    async uploadPhoto(file) {
      if (!this.user) throw new Error('ログインしてください');
      const blob = await compressImage(file, 1280, 0.8);
      const path = `${this.user.id}/${Date.now()}-${uid()}.jpg`;
      const { error } = await this.sb.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
      if (error) throw new Error('写真をアップロードできませんでした：' + error.message);
      return this.sb.storage.from('photos').getPublicUrl(path).data.publicUrl;
    },
    async addPost(farmId, p) {
      const { error } = await this.sb.from('posts').insert({ farm_id: farmId, emoji: p.emoji, title: p.title, body: p.body, photo_url: p.photoUrl || null });
      if (error) throw error;
    },
    async deletePost(id) { await this.sb.from('posts').delete().eq('id', id); },
    async cheers(farmId) {
      const { data } = await this.sb.from('cheers').select('*').eq('farm_id', farmId).order('created_at', { ascending: false }).limit(50);
      return (data || []).map(c => ({ name: c.name, text: c.text, date: c.created_at }));
    },
    async addCheer(farmId, c) {
      const { error } = await this.sb.from('cheers').insert({ farm_id: farmId, name: c.name, text: c.text });
      if (error) throw error;
    },
    async invoke(name, body) {
      const { data, error } = await this.sb.functions.invoke(name, { body });
      if (error) {
        let msg = 'エラーが起きました。時間をおいてもう一度お試しください。';
        try { const j = await error.context.json(); if (j && j.error) msg = j.error; } catch (e) { /* noop */ }
        throw new Error(msg);
      }
      return data;
    },
    async placeOrder(payload) {
      const data = await this.invoke('create-checkout', payload);
      return { redirect: data.url, orderId: data.order_id };
    },
    async myOrders() {
      if (!this.user) return [];
      const { data } = await this.sb.from('orders').select('*, farms(farm_name, emoji, city, lat, lng)').eq('buyer_id', this.user.id).order('created_at', { ascending: false });
      return (data || []).map(r => this.orderFrom(r));
    },
    async order(id) {
      const { data } = await this.sb.from('orders').select('*, farms(farm_name, emoji, city, lat, lng)').eq('id', id).maybeSingle();
      return data ? this.orderFrom(data) : null;
    },
    async placeCashOrder(pl) {
      const { data, error } = await this.sb.rpc('create_cash_order', { p_farm: pl.farm_id, p_items: pl.items, p_pickup: pl.pickup, p_name: pl.buyer.name, p_tel: pl.buyer.tel });
      if (error) throw rpcError(error);
      return { orderId: data.id };
    },
    async cancelOrder(id, payment) {
      if (payment === 'cash') {
        const { error } = await this.sb.rpc('cancel_cash_order', { p_order: id });
        if (error) throw rpcError(error);
        return { status: 'canceled' };
      }
      return this.invoke('cancel-order', { order_id: id });
    },
    async farmOrders(farmId) {
      const { data } = await this.sb.from('orders').select('*').eq('farm_id', farmId).neq('status', 'pending_payment').order('created_at', { ascending: false });
      return (data || []).map(r => this.orderFrom(r));
    },
    async updateOrder(id, to, code) {
      const { error } = await this.sb.rpc('farmer_update_order', { p_order: id, p_to: to, p_code: code || null });
      if (error) throw new Error({ wrong_code: '受け取りコードがちがいます', bad_transition: 'この注文はもう更新できません（キャンセルされた可能性があります）', too_early: RPC_MSG.too_early }[error.message] || error.message);
    },
    async connect(action) { return this.invoke('connect-account', { action }); },
    // お問い合わせ（運営に届く）
    async contact(c) {
      const { error } = await this.sb.from('inquiries').insert({ email: c.email, kind: c.kind, order_id: c.orderId || null, body: c.body });
      if (error) throw rpcError(error);
    },
    // 注文ごとのメッセージ（お客さん ⇔ 農家さん）
    async orderMessages(orderId) {
      const { data, error } = await this.sb.from('order_messages').select('*').eq('order_id', orderId).order('created_at');
      if (error) throw error;
      return data.map(m => ({ id: m.id, fromFarmer: m.from_farmer, text: m.text, date: m.created_at }));
    },
    async sendOrderMessage(orderId, text, asFarmer) {
      const { error } = await this.sb.from('order_messages').insert({ order_id: orderId, text, from_farmer: !!asFarmer });
      if (error) throw rpcError(error);
    },
    // 質問箱（AI）。AI が使えないときは { fallback: true }
    async askAI(turns) {
      const { data, error } = await this.sb.functions.invoke('ask-ai', { body: { messages: turns } });
      if (error) return { fallback: true };
      return data || { fallback: true };
    },
    // ---- 口コミ ----
    reviewFrom(r) {
      return { id: r.id, orderId: r.order_id, farmId: r.farm_id, mine: !!(this.user && r.user_id === this.user.id), rating: r.rating, tags: r.tags || [],
        comment: r.comment, name: r.name, items: r.items, reply: r.reply, replyAt: r.reply_at, hidden: r.hidden, date: r.created_at };
    },
    async reviews(farmId) {
      const { data, error } = await this.sb.from('reviews').select('*').eq('farm_id', farmId).eq('hidden', false).order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return data.map(r => this.reviewFrom(r));
    },
    async orderReview(orderId) { const { data } = await this.sb.from('reviews').select('*').eq('order_id', orderId).maybeSingle(); return data ? this.reviewFrom(data) : null; },
    async saveReview(orderId, v) {
      const { error } = await this.sb.rpc('save_review', { p_order: orderId, p_rating: v.rating, p_tags: v.tags, p_comment: v.comment, p_name: v.name });
      if (error) throw rpcError(error);
    },
    async deleteReview(id) { const { error } = await this.sb.rpc('delete_review', { p_review: id }); if (error) throw rpcError(error); },
    async replyReview(id, text) { const { error } = await this.sb.rpc('reply_review', { p_review: id, p_reply: text }); if (error) throw rpcError(error); },
    // ---- 援農（お手伝い） ----
    helpFrom(r) {
      return { id: r.id, farmId: r.farm_id, title: r.title, body: r.body, date: r.work_date, from: r.start_hour, to: r.end_hour, capacity: r.capacity,
        filled: r.filled, place: r.place, thanks: r.thanks, bring: r.bring, beginner: r.beginner, meal: r.meal, status: r.status };
    },
    entryFrom(r) {
      return { id: r.id, helpId: r.help_id, name: r.name, tel: r.tel, people: r.people, message: r.message, status: r.status, date: r.created_at,
        help: r.helps ? this.helpFrom(r.helps) : null };
    },
    async helps(farmId) {
      let qb = this.sb.from('helps').select('*').order('work_date');
      qb = farmId ? qb.eq('farm_id', farmId) : qb.eq('status', 'open').gt('work_date', today());
      const { data, error } = await qb;
      if (error) throw error;
      return data.map(r => this.helpFrom(r));
    },
    async help(id) { const { data } = await this.sb.from('helps').select('*').eq('id', id).maybeSingle(); return data ? this.helpFrom(data) : null; },
    async helpSave(farmId, h) {
      const row = { title: h.title, body: h.body, work_date: h.date, start_hour: h.from, end_hour: h.to, capacity: h.capacity, place: h.place,
        thanks: h.thanks, bring: h.bring, beginner: h.beginner, meal: h.meal, status: h.status || 'open' };
      const { error } = h.id ? await this.sb.from('helps').update(row).eq('id', h.id) : await this.sb.from('helps').insert(Object.assign({ farm_id: farmId }, row));
      if (error) throw rpcError(error);
    },
    async helpStatus(id, status) { const { error } = await this.sb.from('helps').update({ status }).eq('id', id); if (error) throw rpcError(error); },
    async helpDelete(id) { const { error } = await this.sb.from('helps').delete().eq('id', id); if (error) throw rpcError(error); },
    async helpEntries(helpId) {
      const { data, error } = await this.sb.from('help_entries').select('*').eq('help_id', helpId).order('created_at');
      if (error) throw error;
      return data.map(r => this.entryFrom(r));
    },
    async myEntries() {
      if (!this.user) return [];
      const { data, error } = await this.sb.from('help_entries').select('*, helps(*)').eq('user_id', this.user.id).order('created_at', { ascending: false });
      if (error) throw error;
      return data.map(r => this.entryFrom(r));
    },
    async applyHelp(helpId, a) {
      const { error } = await this.sb.rpc('apply_help', { p_help: helpId, p_name: a.name, p_tel: a.tel, p_people: a.people, p_message: a.message });
      if (error) throw rpcError(error);
    },
    async respondHelp(id, to) { const { error } = await this.sb.rpc('respond_help', { p_entry: id, p_to: to }); if (error) throw rpcError(error); },
    async cancelHelpEntry(id) { const { error } = await this.sb.rpc('cancel_help_entry', { p_entry: id }); if (error) throw rpcError(error); },
    // ---- お店・飲食店からの相談 ----
    bizFrom(r) {
      return { id: r.id, farmId: r.farm_id, shopName: r.shop_name, shopKind: r.shop_kind, city: r.city, contactName: r.contact_name, tel: r.tel,
        items: r.items, quantity: r.quantity, frequency: r.frequency, delivery: r.delivery, note: r.note, status: r.status, date: r.created_at };
    },
    async bizSend(farmId, b) {
      const { error } = await this.sb.from('biz_requests').insert({ farm_id: farmId, shop_name: b.shopName, shop_kind: b.shopKind, city: b.city, contact_name: b.contactName,
        tel: b.tel, items: b.items, quantity: b.quantity, frequency: b.frequency, delivery: b.delivery, note: b.note });
      if (error) throw rpcError(error);
    },
    async bizMine() {
      if (!this.user) return [];
      const { data, error } = await this.sb.from('biz_requests').select('*').eq('user_id', this.user.id).order('created_at', { ascending: false });
      if (error) throw error;
      return data.map(r => this.bizFrom(r));
    },
    async bizForFarm(farmId) {
      const { data, error } = await this.sb.from('biz_requests').select('*').eq('farm_id', farmId).order('created_at', { ascending: false });
      if (error) throw error;
      return data.map(r => this.bizFrom(r));
    },
    async bizClose(id) { const { error } = await this.sb.from('biz_requests').update({ status: 'closed' }).eq('id', id); if (error) throw rpcError(error); },
    // ---- お手伝い・お店の相談のメッセージ ----
    async talk(kind, ref) {
      const { data, error } = await this.sb.from('talk_messages').select('*').eq('kind', kind).eq('ref_id', ref).order('created_at');
      if (error) throw error;
      return data.map(m => ({ id: m.id, fromFarmer: m.from_farmer, text: m.text, date: m.created_at }));
    },
    async talkSend(kind, ref, text, asFarmer) {
      const { error } = await this.sb.from('talk_messages').insert({ kind, ref_id: ref, text, from_farmer: !!asFarmer });
      if (error) throw rpcError(error);
    },
    // 画面で起きたエラーを運営に知らせる（個人情報は送らない）
    logError(message, where) {
      try { this.sb.from('client_errors').insert({ message: String(message).slice(0, 500), where_at: String(where || '').slice(0, 200), ua: navigator.userAgent.slice(0, 200), app_version: APP_VERSION }).then(() => {}, () => {}); } catch (e) { /* noop */ }
    },
    // なかま市
    itemFrom(r) {
      return { id: r.id, ownerId: r.owner_id, farmId: r.farm_id, kind: r.kind, cat: r.cat, title: r.title, body: r.body, price: r.price,
        condition: r.condition, photos: r.photos || [], status: r.status, date: r.created_at };
    },
    async marketList() {
      const { data, error } = await this.sb.from('market_items').select('*').order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      return data.map(r => this.itemFrom(r));
    },
    async marketItem(id) {
      const { data } = await this.sb.from('market_items').select('*').eq('id', id).maybeSingle();
      return data ? this.itemFrom(data) : null;
    },
    async marketSave(farmId, it) {
      const { data, error } = await this.sb.from('market_items').insert({ farm_id: farmId, kind: it.kind, cat: it.cat, title: it.title, body: it.body,
        price: it.price, condition: it.condition, photos: it.photos }).select('id').single();
      if (error) throw error;
      return data.id;
    },
    async marketStatus(id, status) { const { error } = await this.sb.from('market_items').update({ status }).eq('id', id); if (error) throw error; },
    async marketDelete(id) { const { error } = await this.sb.from('market_items').delete().eq('id', id); if (error) throw error; },
    async marketMessages(itemId) {
      const { data } = await this.sb.from('market_messages').select('*').eq('item_id', itemId).order('created_at');
      return (data || []).map(m => ({ buyerId: m.buyer_id, mine: m.sender_id === this.user.id, text: m.text, date: m.created_at }));
    },
    async marketSend(itemId, buyerId, text) {
      const { error } = await this.sb.from('market_messages').insert({ item_id: itemId, buyer_id: buyerId, text });
      if (error) throw error;
    },
    meId() { return this.user && this.user.id; },
    async deleteAccount() { await this.invoke('delete-account', {}); await this.signOut(); }
  };

  // ---- お試し版（端末内のみ） ----
  const demo = {
    mode: 'demo', user: { id: 'demo', email: 'お試し版' },
    async init() {},
    async signIn() {}, async verify() {}, async passwordLogin() {}, async register() {}, async signOut() {},
    stockOverrides() { return store.get(KEY.stock, {}); },
    async loadFarms() {
      const ov = this.stockOverrides();
      const samples = SAMPLE_FARMS.map(f => Object.assign({}, f, {
        chargesEnabled: true, ownerId: 'sample-' + f.id,
        products: f.products.map(p => Object.assign({}, p, { stock: typeof ov[`${f.id}:${p.id}`] === 'number' ? ov[`${f.id}:${p.id}`] : p.stock }))
      }));
      const m = await this.myFarm();
      const all = m ? [m, ...samples] : samples;
      all.forEach(f => { const rs = this.allReviews().filter(r => r.farmId === f.id && !r.hidden); f.rating = rs.length ? { avg: Math.round(rs.reduce((s, r) => s + r.rating, 0) / rs.length * 10) / 10, n: rs.length } : null; });
      return all;
    },
    async myFarm() { const m = store.get(KEY.mine, null); return m && m.farmName ? Object.assign({}, m, { chargesEnabled: true, ownerId: 'demo' }) : null; },
    async saveFarm(f) {
      const id = f.id && String(f.id).startsWith('mine-') ? f.id : 'mine-' + uid();
      const saved = Object.assign({}, f, { id, ownerId: 'demo', products: f.products.map(p => Object.assign({}, p, { id: String(p.id).replace(/^new-/, 'p') })) });
      if (!store.set(KEY.mine, saved)) throw new Error('保存できませんでした');
      return id;
    },
    async deleteFarm() { store.del(KEY.mine); return 'deleted'; },
    async uploadPhoto(file) {
      // お試し版は端末内に保存するので、小さめにする
      return blobToDataUrl(await compressImage(file, 720, 0.7));
    },
    async addPost(farmId, p) {
      const m = store.get(KEY.mine, null);
      m.posts = m.posts || [];
      m.posts.push({ id: uid(), date: today(), emoji: p.emoji, title: p.title, body: p.body, photoUrl: p.photoUrl || '' });
      if (!store.set(KEY.mine, m)) throw new Error('保存できませんでした');
    },
    async deletePost(id) { const m = store.get(KEY.mine, null); m.posts = (m.posts || []).filter(p => p.id !== id); store.set(KEY.mine, m); },
    async cheers(farmId) { return store.get(KEY.cheers, {})[farmId] || []; },
    async addCheer(farmId, c) { const all = store.get(KEY.cheers, {}); (all[farmId] = all[farmId] || []).unshift(Object.assign({ date: new Date().toISOString() }, c)); store.set(KEY.cheers, all); },
    changeStock(f, items, sign) {
      const m = store.get(KEY.mine, null);
      if (m && m.id === f.id) {
        m.products.forEach(p => { const it = items.find(i => i.product_id === p.id); if (it) p.stock = Math.max(0, (Number(p.stock) || 0) + sign * it.qty); });
        store.set(KEY.mine, m);
        return;
      }
      const ov = this.stockOverrides();
      f.products.forEach(p => { const it = items.find(i => i.product_id === p.id); if (it) ov[`${f.id}:${p.id}`] = Math.max(0, p.stock + sign * it.qty); });
      store.set(KEY.stock, ov);
    },
    // サーバー側（create_order）と同じルールで検証する
    async placeOrder(pl) {
      const f = DATA.farms.find(x => x.id === pl.farm_id);
      if (!f) throw new Error('この農家さんは見つかりませんでした。');
      if (!(pl.buyer.name || '').trim()) throw new Error('お名前を入力してください。');
      if (!TEL_RE.test(pl.buyer.tel)) throw new Error('電話番号を確認してください。');
      if (pl.method === 'ship' && !ZIP_RE.test(pl.ship.zip)) throw new Error('配送は山口県内（郵便番号 740〜759）のみです。');
      const lines = pl.items.map(it => {
        const p = f.products.find(x => x.id === it.product_id);
        if (!p || !inSeason(p)) throw new Error('いまはお届けできない時期の商品があります');
        if (p.stock < it.qty) throw new Error(`在庫が足りない商品があります（${p.name}）`);
        return { product_id: p.id, name: p.name, unit: p.unit, qty: it.qty, price: pl.method === 'pickup' ? p.pickupPrice : p.shipPrice };
      });
      let deadline = Date.now() + (f.cancelDays || 2) * 86400000;
      if (pl.method === 'pickup') deadline = Math.min(deadline, new Date(pl.pickup.date + 'T00:00:00').getTime());
      const order = {
        id: 'o' + Date.now().toString(36) + uid().slice(0, 3),
        code: String(Math.floor(1000 + Math.random() * 9000)),
        farmId: f.id, farmName: f.farmName, farmEmoji: f.emoji, farmCity: f.city, farmLat: f.lat, farmLng: f.lng,
        items: lines, method: pl.method, total: lines.reduce((s, l) => s + l.qty * l.price, 0),
        pickup: pl.method === 'pickup' ? { date: pl.pickup.date, hour: pl.pickup.hour, time: `${pl.pickup.hour}:00〜${pl.pickup.hour + 1}:00`, place: f.pickup.place || f.city, addr: f.pickupAddr || f.pickup.addr || '', msg: pl.pickup.msg } : null,
        ship: pl.method === 'ship' ? { zip: pl.ship.zip, pref: '山口県', addr: pl.ship.addr } : null,
        buyer: pl.buyer, status: pl.payment === 'cash' ? 'reserved' : 'paid', payment: pl.payment === 'cash' ? 'cash' : 'card', cancelDeadline: new Date(deadline).toISOString(), createdAt: new Date().toISOString()
      };
      const list = store.get(KEY.orders, []);
      list.unshift(order);
      if (!store.set(KEY.orders, list)) throw new Error('保存できませんでした');
      this.changeStock(f, lines, -1);
      return { orderId: order.id };
    },
    async placeCashOrder(pl) {
      const f = DATA.farms.find(x => x.id === pl.farm_id);
      if (!f || !canCash(f)) throw new Error(RPC_MSG.cash_not_available);
      return this.placeOrder(Object.assign({}, pl, { payment: 'cash' }));
    },
    async myOrders() { return store.get(KEY.orders, []); },
    async order(id) { return store.get(KEY.orders, []).find(o => o.id === id) || null; },
    async cancelOrder(id) {
      const list = store.get(KEY.orders, []);
      const o = list.find(x => x.id === id);
      if (!o || !canCancel(o)) throw new Error('この注文はキャンセルできません（期限切れ、または農家さんが準備を始めています）。');
      o.refundStatus = o.status === 'paid' ? 'refunded' : null; o.status = 'canceled';
      store.set(KEY.orders, list);
      const f = DATA.farms.find(x => x.id === o.farmId);
      if (f) this.changeStock(f, o.items, +1);
      return { status: 'canceled' };
    },
    async farmOrders(farmId) { return store.get(KEY.orders, []).filter(o => o.farmId === farmId); },
    async updateOrder(id, to, code) {
      const list = store.get(KEY.orders, []);
      const o = list.find(x => x.id === id);
      const ok = o && ((o.method === 'pickup' && ['paid', 'reserved'].includes(o.status) && to === 'ready') ||
        (o.payment === 'cash' && ['reserved', 'ready'].includes(o.status) && to === 'noshow') || (o.method === 'ship' && o.status === 'paid' && to === 'shipped') ||
        (o.method === 'pickup' && o.status === 'ready' && to === 'done') || (o.method === 'ship' && o.status === 'shipped' && to === 'done'));
      if (!ok) throw new Error('この注文はもう更新できません（キャンセルされた可能性があります）');
      if (o.method === 'pickup' && to === 'done' && code !== o.code) throw new Error('受け取りコードがちがいます');
      if (to === 'noshow') { const f = DATA.farms.find(x => x.id === o.farmId); if (f) this.changeStock(f, o.items, +1); }
      o.status = to;
      store.set(KEY.orders, list);
    },
    async connect() { return { connected: true, charges_enabled: true }; },
    async contact(c) { const l = store.get(KEY.inquiries, []); l.unshift(Object.assign({ date: new Date().toISOString() }, c)); store.set(KEY.inquiries, l); },
    async orderMessages(orderId) { return (store.get(KEY.omsg, {})[orderId] || []); },
    async sendOrderMessage(orderId, text, asFarmer) { const all = store.get(KEY.omsg, {}); (all[orderId] = all[orderId] || []).push({ id: uid(), fromFarmer: !!asFarmer, text, date: new Date().toISOString() }); store.set(KEY.omsg, all); },
    logError() {},
    async askAI() { return { fallback: true }; },
    // ---- 口コミ（お試し版は端末の中だけ。見本の農家さんには見本の口コミ） ----
    allReviews() { return SAMPLE_REVIEWS.concat(store.get(KEY.reviews, [])); },
    async reviews(farmId) { return this.allReviews().filter(r => r.farmId === farmId && !r.hidden).sort((a, b) => String(b.date).localeCompare(String(a.date))); },
    async orderReview(orderId) { return store.get(KEY.reviews, []).find(r => r.orderId === orderId) || null; },
    async saveReview(orderId, v) {
      const o = store.get(KEY.orders, []).find(x => x.id === orderId);
      if (!o || o.status !== 'done') throw new Error(RPC_MSG.review_not_allowed);
      const l = store.get(KEY.reviews, []);
      const i = l.findIndex(r => r.orderId === orderId);
      const r = Object.assign(i >= 0 ? l[i] : { id: 'r' + uid(), orderId, farmId: o.farmId, mine: true, reply: '', date: new Date().toISOString(), items: o.items.map(x => x.name).join('・') }, v);
      if (i >= 0) l[i] = r; else l.push(r);
      store.set(KEY.reviews, l);
    },
    async deleteReview(id) { store.set(KEY.reviews, store.get(KEY.reviews, []).filter(r => r.id !== id)); },
    async replyReview(id, text) { const l = store.get(KEY.reviews, []); const r = l.find(x => x.id === id); if (r) { r.reply = text; r.replyAt = new Date().toISOString(); } store.set(KEY.reviews, l); },
    // ---- 援農（お手伝い）・お店の相談：お試し版は端末の中だけ ----
    allHelps() { return SAMPLE_HELPS.concat(store.get(KEY.helps, [])); },
    async helps(farmId) {
      const l = this.allHelps().map(h => Object.assign({}, h, { filled: this.allEntries().filter(e => e.helpId === h.id && e.status === 'accepted').reduce((s, e) => s + e.people, 0) }));
      return (farmId ? l.filter(h => h.farmId === farmId) : l.filter(h => h.status === 'open' && h.date > today())).sort((a, b) => a.date.localeCompare(b.date));
    },
    async help(id) { return (await this.helps()).concat(store.get(KEY.helps, [])).find(h => h.id === id) || null; },
    async helpSave(farmId, h) {
      const l = store.get(KEY.helps, []);
      const i = l.findIndex(x => x.id === h.id);
      const v = Object.assign({ id: 'h' + uid(), filled: 0, status: 'open' }, h, { farmId });
      if (i >= 0) l[i] = v; else l.push(v);
      store.set(KEY.helps, l);
    },
    async helpStatus(id, status) { const l = store.get(KEY.helps, []); const h = l.find(x => x.id === id); if (h) h.status = status; store.set(KEY.helps, l); },
    async helpDelete(id) { store.set(KEY.helps, store.get(KEY.helps, []).filter(x => x.id !== id)); },
    allEntries() { return store.get(KEY.entries, []); },
    async helpEntries(helpId) { return this.allEntries().filter(e => e.helpId === helpId); },
    async myEntries() { const hs = this.allHelps(); return this.allEntries().filter(e => e.mine).map(e => Object.assign({}, e, { help: hs.find(h => h.id === e.helpId) || null })); },
    async applyHelp(helpId, a) {
      const l = this.allEntries();
      if (l.some(e => e.helpId === helpId && e.mine && e.status !== 'canceled')) throw new Error(RPC_MSG.already_applied);
      l.push(Object.assign({ id: 'e' + uid(), helpId, status: 'applied', mine: true, date: new Date().toISOString() }, a));
      store.set(KEY.entries, l);
    },
    async respondHelp(id, to) { const l = this.allEntries(); const e = l.find(x => x.id === id); if (e) e.status = to; store.set(KEY.entries, l); },
    async cancelHelpEntry(id) { const l = this.allEntries(); const e = l.find(x => x.id === id); if (e) e.status = 'canceled'; store.set(KEY.entries, l); },
    async bizSend(farmId, b) { const l = store.get(KEY.biz, []); l.unshift(Object.assign({ id: 'b' + uid(), farmId, status: 'open', date: new Date().toISOString() }, b)); store.set(KEY.biz, l); },
    async bizMine() { return store.get(KEY.biz, []); },
    async bizForFarm(farmId) { return store.get(KEY.biz, []).filter(b => b.farmId === farmId); },
    async bizClose(id) { const l = store.get(KEY.biz, []); const b = l.find(x => x.id === id); if (b) b.status = 'closed'; store.set(KEY.biz, l); },
    async talk(kind, ref) { return store.get(KEY.talk, {})[kind + ':' + ref] || []; },
    async talkSend(kind, ref, text, asFarmer) { const all = store.get(KEY.talk, {}); (all[kind + ':' + ref] = all[kind + ':' + ref] || []).push({ id: uid(), fromFarmer: !!asFarmer, text, date: new Date().toISOString() }); store.set(KEY.talk, all); },
    // なかま市
    marketMine() { return store.get(KEY.market, []); },
    async marketList() {
      const st = store.get(KEY.market + '.status', {});
      return this.marketMine().concat(SAMPLE_MARKET.map(m => Object.assign({}, m, { ownerId: 'sample-' + m.farmId, status: st[m.id] || m.status })))
        .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    },
    async marketItem(id) { return (await this.marketList()).find(m => m.id === id) || null; },
    async marketSave(farmId, it) {
      const list = this.marketMine();
      const id = 'mm' + uid();
      list.unshift(Object.assign({}, it, { id, farmId, ownerId: 'demo', status: 'open', date: new Date().toISOString() }));
      if (!store.set(KEY.market, list)) throw new Error('保存できませんでした（写真が多すぎるかもしれません）');
      return id;
    },
    async marketStatus(id, status) {
      const list = this.marketMine();
      const it = list.find(m => m.id === id);
      if (it) { it.status = status; store.set(KEY.market, list); }
    },
    async marketDelete(id) { store.set(KEY.market, this.marketMine().filter(m => m.id !== id)); },
    async marketMessages(itemId) { return (store.get(KEY.mkmsg, {})[itemId] || []); },
    async marketSend(itemId, buyerId, text) {
      const all = store.get(KEY.mkmsg, {});
      const list = all[itemId] = all[itemId] || [];
      list.push({ buyerId, mine: true, text, date: new Date().toISOString() });
      if (list.filter(m => !m.mine).length === 0) {
        list.push({ buyerId, mine: false, text: '（お試し版の自動返信）メッセージありがとうございます！受け渡しの日時を相談しましょう。', date: new Date().toISOString() });
      }
      store.set(KEY.mkmsg, all);
    },
    meId() { return 'demo'; },
    async deleteAccount() { Object.values(KEY).forEach(k => store.del(k)); store.del(KEY.market + '.status'); }
  };

  let api = demo;
  const DATA = { farms: [], mine: null };
  async function reload() {
    DATA.farms = await api.loadFarms();
    DATA.mine = await api.myFarm();
    if (DATA.mine && !DATA.farms.some(f => f.id === DATA.mine.id)) DATA.farms.unshift(DATA.mine);
  }
  const findFarm = id => DATA.farms.find(f => f.id === id);
  const isMine = f => !!(DATA.mine && f && DATA.mine.id === f.id);

  // ---------- フォロー（端末ごとの好みなので、どちらのモードでも端末内に保存） ----------
  const follows = () => store.get(KEY.follows, []);
  const isFollowing = id => follows().includes(id);
  function toggleFollow(id) { const f = follows(); const i = f.indexOf(id); if (i >= 0) f.splice(i, 1); else f.push(id); store.set(KEY.follows, f); return i < 0; }

  // ---------- カート（1回の注文は1軒の農家さんずつ） ----------
  let cart = store.get(KEY.cart, { farmId: null, items: {} });
  const saveCart = () => store.set(KEY.cart, cart);
  function cartTotals(f) {
    let count = 0, ship = 0, pick = 0;
    (f.products || []).forEach(p => {
      const q = cart.farmId === f.id ? (cart.items[p.id] || 0) : 0;
      count += q; ship += q * p.shipPrice; pick += q * p.pickupPrice;
    });
    return { count, ship, pick };
  }

  const state = { q: '', cat: 'all', pest: 'all', inSeason: false, pickupOnly: false, feedMode: 'all', rad: 20, mapSel: null, changingHome: false, mkKind: 'all', mkCat: 'all' };

  // ======================================================================
  //  山口県マップ
  //  県全体は自前の SVG（どこでも必ず表示できる）。ズームすると国土地理院の地図（道路・地名入り）に切り替わる。
  //  地理院の地図が読み込めない環境では、町名を表示して代わりにする。
  // ======================================================================
  const TILE_URL = 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png';
  const DETAIL_W = 260;   // 地図の幅（約40km）より拡大したら詳しい地図にする
  const tileState = { ok: 0, fail: 0, broken: false };
  const lng2tx = (lng, z) => (lng + 180) / 360 * 2 ** z;
  const lat2ty = (lat, z) => { const r = lat * Math.PI / 180; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** z; };
  const tx2lng = (x, z) => x / 2 ** z * 360 - 180;
  const ty2lat = (y, z) => { const n = Math.PI - 2 * Math.PI * y / 2 ** z; return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))); };

  function YMap(el, opts) {
    const V = GEO.view;
    const small = !!opts.small;
    el.innerHTML = `
      <div class="ymap ${small ? 'small' : ''} ${opts.pickable ? 'pick' : ''}">
        <svg role="img" aria-label="山口県の地図">
          <g class="tiles"></g>
          <g class="land">${CITY_NAMES.map(c => `<path class="city ${REGION_OF[c]} ${opts.focusCity === c ? 'focus' : ''}" data-city="${c}" d="${GEO.cities[c].d}" fill-rule="evenodd"/>`).join('')}</g>
          <g class="over"></g>
        </svg>
        <div class="ymap-ctrl"><button type="button" data-z="in" aria-label="拡大">＋</button><button type="button" data-z="out" aria-label="縮小">－</button><button type="button" class="all" data-z="all" aria-label="県全体を表示">全体</button></div>
        <div class="ymap-credit">国土数値情報（行政区域）を加工</div>
        <div class="ymap-tile-credit" hidden><a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a></div>
      </div>`;
    const wrap = el.firstElementChild, svg = $('svg', wrap), over = $('.over', svg), tilesG = $('.tiles', svg);
    const tiles = new Map(); // "z/x/y" → <image>
    let tileNeed = null;
    function sweepTiles() { // 新しい段階のタイルがそろったら、下敷きにしていた前の段階のタイルを片付ける
      if (!tileNeed || [...tileNeed].some(k => tiles.has(k) && !tiles.get(k).__done)) return;
      tiles.forEach((img, key) => { if (!tileNeed.has(key)) { img.remove(); tiles.delete(key); } });
    }
    let vb = null;
    const size = () => [svg.clientWidth || 300, svg.clientHeight || 300];

    function fit(box) { // box: [x0, y0, x1, y1]
      const [cw, ch] = size();
      let w = box[2] - box[0], h = box[3] - box[1];
      const cx = (box[0] + box[2]) / 2, cy = (box[1] + box[3]) / 2;
      if (w / h > cw / ch) h = w * ch / cw; else w = h * cw / ch;
      stopAnim();
      vb = [cx - w / 2, cy - h / 2, w, h];
      clamp(); draw();
    }
    function boxAround(lat, lng, radiusKm) {
      const [x, y] = toXY(lat, lng), r = radiusKm * KM;
      return [x - r, y - r, x + r, y + r];
    }
    function fitAll() { fit([V[0], V[1], V[0] + V[2], V[1] + V[3]]); }
    function clamp(b = vb) {
      const [cw, ch] = size();
      const maxW = V[2] * 1.15, minW = 4; // 最大で幅600mほどまで拡大できる
      if (b[2] > maxW) { const s = maxW / b[2]; b[0] += b[2] * (1 - s) / 2; b[1] += b[3] * (1 - s) / 2; b[2] = maxW; b[3] = maxW * ch / cw; }
      if (b[2] < minW) { const s = minW / b[2]; b[0] -= b[2] * (s - 1) / 2; b[1] -= b[3] * (s - 1) / 2; b[2] = minW; b[3] = minW * ch / cw; }
      const cx = Math.min(Math.max(b[0] + b[2] / 2, V[0]), V[0] + V[2]);
      const cy = Math.min(Math.max(b[1] + b[3] / 2, V[1]), V[1] + V[3]);
      b[0] = cx - b[2] / 2; b[1] = cy - b[3] / 2;
      return b;
    }

    // ---- 国土地理院の地図タイル ----
    function drawTiles(show) {
      if (!show) { if (tiles.size) { tiles.forEach(img => img.remove()); tiles.clear(); } return; }
      const [cw] = size();
      const degPerPx = vb[2] / cw / (PJ.cos * PJ.k);
      let z = Math.max(8, Math.min(17, Math.round(Math.log2(360 / (256 * degPerPx)))));
      const [latT, lngL] = toLL(vb[0], vb[1]), [latB, lngR] = toLL(vb[0] + vb[2], vb[1] + vb[3]);
      let xs, xe, ys, ye;
      for (;;) {
        xs = Math.floor(lng2tx(lngL, z)); xe = Math.floor(lng2tx(lngR, z));
        ys = Math.floor(lat2ty(latT, z)); ye = Math.floor(lat2ty(latB, z));
        if ((xe - xs + 1) * (ye - ys + 1) <= 48 || z <= 8) break;
        z--;
      }
      const need = new Set();
      let pending = 0;
      for (let x = xs; x <= xe; x++) for (let y = ys; y <= ye; y++) {
        const key = `${z}/${x}/${y}`;
        need.add(key);
        if (tiles.has(key)) { if (!tiles.get(key).__done) pending++; continue; }
        pending++;
        const [x0, y0] = toXY(ty2lat(y, z), tx2lng(x, z)), [x1, y1] = toXY(ty2lat(y + 1, z), tx2lng(x + 1, z));
        const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        img.setAttribute('x', x0); img.setAttribute('y', y0);
        img.setAttribute('width', (x1 - x0) * 1.004); img.setAttribute('height', (y1 - y0) * 1.004);
        img.setAttribute('preserveAspectRatio', 'none');
        img.addEventListener('load', () => { tileState.ok++; img.__done = true; sweepTiles(); });
        img.addEventListener('error', () => {
          tileState.fail++;
          img.__done = true;
          img.remove(); tiles.delete(key);
          sweepTiles();
          if (!tileState.ok && tileState.fail >= 3 && !tileState.broken) { tileState.broken = true; draw(); }
        });
        img.setAttribute('href', TILE_URL.replace('{z}', z).replace('{x}', x).replace('{y}', y));
        tilesG.appendChild(img);
        tiles.set(key, img);
      }
      tileNeed = need;
      // 同じ段階で画面外になったものはすぐ消す。違う段階のものは、新しいタイルが届くまで下敷きとして残す
      tiles.forEach((img, key) => { if (!need.has(key) && (key.startsWith(z + '/') || !pending)) { img.remove(); tiles.delete(key); } });
      if (tiles.size > 160) tiles.forEach((img, key) => { if (!need.has(key)) { img.remove(); tiles.delete(key); } });
    }

    function draw() {
      if (!vb) return; // 表示位置が決まる前
      svg.setAttribute('viewBox', vb.map(v => v.toFixed(3)).join(' '));
      const s = vb[2] / size()[0]; // 1px あたりの地図上の長さ
      const detail = vb[2] < DETAIL_W;
      const useTiles = detail && !tileState.broken;
      wrap.classList.toggle('detail', useTiles);
      $('.ymap-tile-credit', wrap).hidden = !useTiles;
      $('.ymap-credit', wrap).hidden = useTiles;
      drawTiles(useTiles);
      let h = '';
      if (!useTiles) {
        // 市町名（画面上で十分な大きさがあるときだけ）
        CITY_NAMES.forEach(c => {
          const b = GEO.cities[c].b, l = GEO.cities[c].l;
          if ((b[2] - b[0]) / s > 70 && (b[2] - b[0]) / s < 1400) h += `<text class="lbl" data-p="${l[0]} ${l[1]} 1" transform="translate(${l[0]} ${l[1]}) scale(${s})" font-size="12" stroke-width="3" text-anchor="middle">${c}</text>`;
        });
        // 詳しい地図が使えないときは、拡大したら町名を出す
        if (vb[2] < 180) {
          let n = 0;
          for (const p of PLACES) {
            if (p.x < vb[0] || p.x > vb[0] + vb[2] || p.y < vb[1] || p.y > vb[1] + vb[3]) continue;
            if (++n > 70) break;
            h += `<g data-p="${p.x} ${p.y} 1" transform="translate(${p.x} ${p.y}) scale(${s})"><circle class="town-dot" r="2"/><text class="town" y="-4" font-size="10" stroke-width="2.5" text-anchor="middle">${esc(p.name)}</text></g>`;
          }
        }
      }
      if (opts.home) {
        const [hx, hy] = toXY(opts.home.lat, opts.home.lng);
        if (opts.radius) h += `<circle class="radius" cx="${hx}" cy="${hy}" r="${opts.radius * KM}" stroke-width="${2 * s}" style="stroke-dasharray:${6 * s} ${5 * s}"/>`;
        h += `<g data-p="${hx} ${hy} 1" transform="translate(${hx} ${hy}) scale(${s})" pointer-events="none"><circle r="15" fill="var(--tomato)" stroke="#2E2A24" stroke-width="2.5"/><text y="6" font-size="16" text-anchor="middle">🏠</text></g>`;
      }
      (opts.farms || []).forEach(f => {
        if (typeof f.lat !== 'number') return;
        const [x, y] = toXY(f.lat, f.lng);
        const sel = opts.selected === f.id;
        h += `<g class="mpin ${sel ? 'sel' : ''} ${opts.dim && opts.dim(f) ? 'far' : ''}" data-id="${esc(f.id)}" data-p="${x} ${y} ${sel ? 1.25 : 1}" transform="translate(${x} ${y}) scale(${s * (sel ? 1.25 : 1)})">
          <circle r="17" cx="2" cy="2" fill="#2E2A24"/><circle class="bg" r="17" stroke-width="2.5"/><text y="7" font-size="19" text-anchor="middle">${esc(f.emoji)}</text></g>`;
      });
      if (opts.picked) {
        const [x, y] = toXY(opts.picked[0], opts.picked[1]);
        h += `<g data-p="${x} ${y} 1" transform="translate(${x} ${y}) scale(${s})" pointer-events="none"><path d="M0 0 L-11 -20 A13 13 0 1 1 11 -20 Z" fill="var(--tomato)" stroke="#2E2A24" stroke-width="2.5"/><circle cy="-26" r="5" fill="#fff"/></g>`;
      }
      over.innerHTML = h;
      scaled = $$('[data-p]', over).map(n => [n, ...n.dataset.p.split(' ').map(Number)]);
      lastFull = performance.now();
    }
    // 動かしている途中は、表示範囲とピンの大きさだけを変える（軽い）。
    // 地図タイルや町名の作り直しは、少し間をあけて行い、動きが止まったら必ず行う。
    let scaled = [], lastFull = 0, settle = 0;
    function drawLight() {
      if (!vb) return;
      if (performance.now() - lastFull > 220) { draw(); return; }
      svg.setAttribute('viewBox', vb.map(v => v.toFixed(3)).join(' '));
      const s = vb[2] / size()[0];
      for (const [n, x, y, k] of scaled) n.setAttribute('transform', `translate(${x} ${y}) scale(${s * k})`);
      clearTimeout(settle);
      settle = setTimeout(draw, 120);
    }
    // なめらかなズーム：目標の表示範囲に向かって、毎フレーム少しずつ近づける
    let target = null, anim = 0;
    function stopAnim() { if (anim) cancelAnimationFrame(anim); anim = 0; target = null; }
    function step() {
      anim = 0;
      if (!target) return;
      let done = true;
      for (let i = 0; i < 4; i++) {
        const d = target[i] - vb[i];
        if (Math.abs(d) > target[2] * 0.0015) done = false;
        vb[i] += d * 0.28;
      }
      if (done) { vb = target; target = null; draw(); return; }
      drawLight();
      anim = requestAnimationFrame(step);
    }
    function zoom(factor, cx, cy) {
      if (!vb) return;
      const b = target || vb;
      if (cx === undefined) { cx = b[0] + b[2] / 2; cy = b[1] + b[3] / 2; }
      target = clamp([cx - (cx - b[0]) * factor, cy - (cy - b[1]) * factor, b[2] * factor, b[3] * factor]);
      if (!anim) anim = requestAnimationFrame(step);
    }
    function svgPoint(evt) {
      const r = svg.getBoundingClientRect();
      return [vb[0] + (evt.clientX - r.left) / r.width * vb[2], vb[1] + (evt.clientY - r.top) / r.height * vb[3]];
    }

    // ドラッグで移動・2本指で拡大縮小・ダブルタップで拡大・タップで選択
    const pts = new Map();
    let start = null, moved = false, pinch = null, lastTap = 0, raf = 0;
    const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; clamp(); drawLight(); }); };
    svg.addEventListener('pointerdown', e => {
      if (!vb) return;
      stopAnim();
      svg.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 1) { start = { x: e.clientX, y: e.clientY, vb: vb.slice() }; moved = false; }
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), vb: vb.slice() }; moved = true; }
    });
    svg.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      const r = svg.getBoundingClientRect();
      if (pts.size === 2 && pinch) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        const cx = pinch.vb[0] + (mx - r.left) / r.width * pinch.vb[2], cy = pinch.vb[1] + (my - r.top) / r.height * pinch.vb[3];
        const f = pinch.d / Math.max(d, 1);
        vb = [cx - (cx - pinch.vb[0]) * f, cy - (cy - pinch.vb[1]) * f, pinch.vb[2] * f, pinch.vb[3] * f];
        schedule();
        return;
      }
      if (!start) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
      if (moved) {
        vb = [start.vb[0] - dx / r.width * start.vb[2], start.vb[1] - dy / r.height * start.vb[3], start.vb[2], start.vb[3]];
        schedule();
      }
    });
    const end = e => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      // 2本指のうち1本を離したら、残った指でそのまま移動できるようにする
      if (pts.size === 1 && e.type !== 'pointerdown') { const [p] = [...pts.values()]; start = { x: p[0], y: p[1], vb: vb.slice() }; }
      if (pts.size === 0 && start) {
        if (!moved && e.type === 'pointerup') {
          const hit = document.elementFromPoint(e.clientX, e.clientY);
          const pin = hit && hit.closest && hit.closest('.mpin');
          const now = Date.now();
          if (pin && opts.onSelect) opts.onSelect(pin.dataset.id);
          else if (opts.pickable && opts.onPick) {
            const [x, y] = svgPoint(e);
            const [lat, lng] = toLL(x, y);
            if (inYamaguchi(lat, lng)) { opts.picked = [Math.round(lat * 10000) / 10000, Math.round(lng * 10000) / 10000]; draw(); opts.onPick(opts.picked); }
          } else if (now - lastTap < 320) {
            const [x, y] = svgPoint(e);
            zoom(0.5, x, y);
          } else if (opts.onSelect) opts.onSelect(null);
          lastTap = now;
        }
        start = null;
      }
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    // パソコンではホイール（またはトラックパッド）で拡大縮小
    svg.addEventListener('wheel', e => {
      if (!vb) return;
      e.preventDefault();
      const [x, y] = svgPoint(e);
      // トラックパッドのピンチ（ctrlKey）は細かく、マウスのホイールは1目盛りで大きく動く
      const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
      zoom(Math.exp(Math.max(-300, Math.min(300, dy)) * (e.ctrlKey ? 0.01 : 0.002)), x, y);
    }, { passive: false });
    $$('[data-z]', wrap).forEach(b => b.addEventListener('click', () => {
      if (b.dataset.z === 'in') zoom(0.5); else if (b.dataset.z === 'out') zoom(2); else fitAll();
    }));

    const ctl = {
      update(o) { Object.assign(opts, o); draw(); },
      animateTo(lat, lng, radiusKm) {
        if (!vb) return;
        const bx = boxAround(lat, lng, radiusKm), [cw, ch] = size();
        let w = bx[2] - bx[0], h = bx[3] - bx[1];
        if (w / h > cw / ch) h = w * ch / cw; else w = h * cw / ch;
        target = clamp([(bx[0] + bx[2] - w) / 2, (bx[1] + bx[3] - h) / 2, w, h]);
        if (!anim) anim = requestAnimationFrame(step);
      },
      showAround(lat, lng, radiusKm) { fit(boxAround(lat, lng, radiusKm)); },
      showCity(c) { const b = GEO.cities[c].b; fit([b[0] - 10, b[1] - 10, b[2] + 10, b[3] + 10]); },
      showAll: fitAll,
      highlightCity(c) { $$('.city', svg).forEach(p => p.classList.toggle('focus', p.dataset.city === c)); }
    };
    // 表示サイズが決まってから位置合わせする
    requestAnimationFrame(() => { if (opts.initial) opts.initial(ctl); else fitAll(); });
    return ctl;
  }

  // ======================================================================
  //  画面
  // ======================================================================
  const app = $('#app');

  function loginPanel(reason) {
    return `
      <div class="panel" id="loginPanel">
        <h3 style="font-size:1.05rem">🔑 ログイン</h3>
        <p class="small dim" style="margin:4px 0 12px">${esc(reason)}はじめての方は「新しく登録する」、2回目からは「ログイン」を押してください。</p>
        <form id="loginForm" style="margin:0">
          <div class="field"><label for="lgEmail">メールアドレス</label>
            <input id="lgEmail" type="email" autocomplete="email" required placeholder="you@example.com"></div>
          <div class="field"><label for="lgPass">パスワード（8文字以上）</label>
            <input id="lgPass" type="password" autocomplete="current-password" minlength="8" required></div>
          <div class="actions" style="margin-top:4px">
            <button class="btn leaf" type="submit" data-mode="login">ログイン</button>
            <button class="btn ghost" type="submit" data-mode="register">新しく登録する</button>
          </div>
          <p class="small dim" style="margin:10px 0 0">登録すると、<a href="#/legal/terms" data-sheet>利用規約</a>と<a href="#/legal/privacy" data-sheet>プライバシーポリシー</a>に同意したものとみなします。</p>
        </form>
      </div>`;
  }
  function bindLogin(nextHash, after) {
    let mode = 'login';
    $$('#loginForm [data-mode]').forEach(b => b.addEventListener('click', () => { mode = b.dataset.mode; }));
    $('#loginForm').addEventListener('submit', async e => {
      e.preventDefault();
      const email = $('#lgEmail').value.trim(), pass = $('#lgPass').value;
      if (!email) { toast('メールアドレスを入力してください'); return; }
      if (pass.length < 8) { toast('パスワードは8文字以上にしてください'); $('#lgPass').focus(); return; }
      $$('#loginForm button').forEach(b => { b.disabled = true; });
      try {
        if (mode === 'register') await api.register(email, pass); else await api.passwordLogin(email, pass);
        await reload();
        toast(mode === 'register' ? '登録しました' : 'ログインしました');
        after();
      } catch (err) { toast(err.message); $$('#loginForm button').forEach(b => { b.disabled = false; }); }
    });
  }
  const needLogin = () => api.mode === 'live' && !api.user;

  // ---------- ホーム画面に追加（アプリとして使う） ----------
  let installEvt = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
  function installBanner() {
    if (STANDALONE || CFG.preview || store.get(KEY.install, false)) return '';
    if (IOS) return `<div class="install" id="installBar"><img src="icons/icon-192.png" alt=""><span class="tx">ホーム画面に追加すると、アプリとして使えます。<br>Safari の共有ボタン <b>□↑</b> →「<b>ホーム画面に追加</b>」</span><button class="x" aria-label="閉じる">×</button></div>`;
    if (installEvt) return `<div class="install" id="installBar"><img src="icons/icon-192.png" alt=""><span class="tx">アプリとしてホーム画面に追加できます。</span><button class="btn small leaf" id="installBtn">追加</button><button class="x" aria-label="閉じる">×</button></div>`;
    return '';
  }
  function bindInstall() {
    const bar = $('#installBar');
    if (!bar) return;
    $('.x', bar).addEventListener('click', () => { store.set(KEY.install, true); bar.remove(); });
    const b = $('#installBtn');
    if (b) b.addEventListener('click', async () => { installEvt.prompt(); await installEvt.userChoice; installEvt = null; bar.remove(); });
  }

  // ---------- 画面: 地域えらび ----------
  function renderWelcome() {
    const groups = Object.entries(REGIONS).map(([rk, rv]) => `
      <div class="grp"><b>${rv}</b>${CITY_NAMES.filter(c => REGION_OF[c] === rk).map(c => `<button class="chip sm" type="button" data-city="${c}">${c}</button>`).join('')}</div>`).join('');
    app.innerHTML = `
      ${installBanner()}
      <section class="hero-intro welcome">
        <span class="float a">🏡</span>
        <h1>どこに<span class="hl">住んで</span>る？</h1>
        <p>近くの農家さんから順番に紹介します。<br>地区の名前まで入れると、もっと近くが分かります。</p>
        <div class="place-search">
          <input id="placeQ" type="search" placeholder="例：山口市仁保、徳地、萩市須佐" autocomplete="off" enterkeyhint="search" aria-label="住んでいる地域">
          <div class="suggest" id="suggest"></div>
        </div>
        <div class="or">または</div>
        <button class="btn leaf" type="button" id="geoBtn">📍 いまいる場所を使う</button>
        <div class="or">市町からえらぶ</div>
        <div class="city-groups">${groups}</div>
        <div style="margin-top:16px;text-align:center">
          ${getHome() ? '<button class="linkbtn" type="button" id="cancelHome">変更しないでもどる</button>' : '<button class="linkbtn" type="button" id="skipHome">あとで決める（県内ぜんぶ見る）</button>'}
        </div>
        <div class="first-help">
          <b>はじめての方へ</b>
          <div class="actions" style="margin-top:6px"><a class="btn small leaf" href="#/guide">📖 使い方ガイド</a><button class="btn small corn" type="button" data-open-ask>${ASK_LABEL}</button></div>
        </div>
        <p class="small dim" style="margin:14px 0 0;font-size:.68rem">地名データ：Geolonia 住所データ（CC BY 4.0）／ 地図：国土数値情報（行政区域データ）を加工</p>
      </section>
      ${legalFoot()}`;
    bindInstall();
    let results = [];
    const draw = () => {
      results = searchPlaces($('#placeQ').value);
      $('#suggest').innerHTML = results.map((r, i) => `<button type="button" data-i="${i}">📍 ${esc(r.label)}${r.sub ? `<small>${esc(r.sub)}</small>` : ''}</button>`).join('')
        || ($('#placeQ').value.trim() ? '<div class="small dim">見つかりませんでした。市町の名前や、漢字の地区名で入れてみてください。</div>' : '');
      $$('#suggest [data-i]').forEach(b => b.addEventListener('click', () => choose(results[Number(b.dataset.i)])));
    };
    function choose(r) {
      setHome({ label: r.label, lat: r.lat, lng: r.lng, city: r.city });
      state.changingHome = false;
      toast(`「${r.label}」の近くの農家さんを表示します`);
      renderExplore();
      window.scrollTo(0, 0);
    }
    $('#placeQ').addEventListener('input', draw);
    $('#placeQ').addEventListener('keydown', e => { if (e.key === 'Enter' && results[0]) { e.preventDefault(); choose(results[0]); } });
    $$('[data-city]').forEach(b => b.addEventListener('click', () => {
      const [lat, lng] = CITY_CENTER[b.dataset.city];
      choose({ label: b.dataset.city, lat, lng, city: b.dataset.city });
    }));
    $('#geoBtn').addEventListener('click', () => {
      if (!navigator.geolocation) { toast('この端末では現在地を使えません'); return; }
      toast('現在地をさがしています…');
      navigator.geolocation.getCurrentPosition(pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        if (!inYamaguchi(lat, lng)) { toast('山口県の外にいるようです。地域を入力してください'); return; }
        const p = nearestPlace(lat, lng);
        choose({ label: p ? `${p.city} ${p.name}付近` : '現在地', lat, lng, city: p && p.city });
      }, () => toast('現在地を取得できませんでした。地域を入力してください'), { timeout: 10000, maximumAge: 600000 });
    });
    const skip = $('#skipHome');
    if (skip) skip.addEventListener('click', () => { state.changingHome = false; state.skipHome = true; renderExplore(); });
    const cancel = $('#cancelHome');
    if (cancel) cancel.addEventListener('click', () => { state.changingHome = false; renderExplore(); });
  }

  // ---------- 画面: さがす ----------
  function thumbStyle(f) {
    const u = safeUrl(f.coverUrl);
    return u ? `background-color:${hue(f)};background-image:url(${u})` : `background:${hue(f)}`;
  }
  function farmCard(f, dist) {
    const pest = PESTICIDE[f.methods?.pesticide];
    const season = seasonalNames(f);
    const buyable = canOrder(f) ? (f.products || []).filter(p => inSeason(p) && p.stock > 0) : [];
    const minPrice = buyable.length ? Math.min(...buyable.map(p => canPickup(f) ? p.pickupPrice : p.shipPrice)) : null;
    return `
      <a class="card" href="#/farm/${esc(f.id)}">
        <div class="thumb ${safeUrl(f.coverUrl) ? 'has-photo' : ''}" style="${thumbStyle(f)}"><span class="em">${esc(f.emoji)}</span><span class="loc">📍 ${esc(f.city)}</span>${typeof dist === 'number' ? `<span class="dist">🚗 ${fmtKm(dist)}</span>` : ''}${canPickup(f) ? '<span class="meet">会いに行ける</span>' : ''}</div>
        <div class="card-body">
          <h3>${esc(f.farmName)}${isMine(f) ? ' <span class="tag corn">あなたの農園</span>' : ''}</h3>
          <div class="small dim">${esc(f.farmer)}${yearsFarming(f) !== null ? `・農業${yearsFarming(f)}年目` : ''}</div>
          ${f.rating ? `<div class="small">${stars(f.rating.avg)} <b>${f.rating.avg.toFixed(1)}</b> <span class="dim">（${f.rating.n}件）</span></div>` : ''}
          <div class="catch">${esc(f.catch)}</div>
          <div class="tags">
            ${season.length ? `<span class="tag tomato">いま旬：${esc(season.slice(0, 2).join('・'))}</span>` : ''}
            ${f.storage && f.storage.fresh === 'same_day' ? '<span class="tag leaf">🌅 朝どれ</span>' : ''}
            ${pest && pest.short ? `<span class="tag">${esc(pest.short)}</span>` : ''}
            ${(f.certs || []).map(c => `<span class="tag eggplant">${esc(c)}</span>`).join('')}
          </div>
          <div class="price-from">${minPrice !== null ? `いま買える：<b>${yen(minPrice)}</b>〜${canPickup(f) ? '（畑で受け取り）' : '（送料込み）'}` : (canOrder(f) ? 'いま買えるものは準備中' : 'オンライン注文の準備中')}</div>
        </div>
      </a>`;
  }

  function filteredFarms() {
    const q = state.q.trim().toLowerCase();
    return DATA.farms.filter(f => {
      if (state.cat !== 'all' && !cats(f).includes(state.cat)) return false;
      if (state.pest !== 'all' && f.methods?.pesticide !== state.pest) return false;
      if (state.inSeason && !inSeasonNow(f)) return false;
      if (state.pickupOnly && !canPickup(f)) return false;
      if (q) {
        const hay = [f.farmName, f.farmer, f.city, f.catch, f.story, ...(f.products || []).map(p => p.name)].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function renderExplore() {
    const home = getHome();
    if (state.changingHome || (!home && !state.skipHome)) { renderWelcome(); return; }
    app.innerHTML = `
      ${installBanner()}
      <div class="home-bar">
        <span class="where">${home ? `📍 <b>${esc(home.label)}</b> の近く` : '📍 地域を決めると、近くの農家さんが分かります'}</span>
        <button class="btn small corn" type="button" id="changeHome">${home ? '変更' : '地域を決める'}</button>
      </div>
      ${home ? `<div class="chips" id="radChips">
        ${[10, 20, 30].map(r => `<button class="chip leaf ${state.rad === r ? 'on' : ''}" data-rad="${r}">${r}km以内</button>`).join('')}
        <button class="chip leaf ${state.rad === 0 ? 'on' : ''}" data-rad="0">県内ぜんぶ</button>
      </div>` : ''}
      <div class="filters">
        <input type="search" id="q" placeholder="れんこん、みかん、お米…" value="${esc(state.q)}" enterkeyhint="search" aria-label="キーワード検索">
        <select id="pest" aria-label="育て方">
          <option value="all">育て方：すべて</option>
          <option value="none" ${state.pest === 'none' ? 'selected' : ''}>農薬 栽培期間中不使用</option>
          <option value="reduced" ${state.pest === 'reduced' ? 'selected' : ''}>農薬節減</option>
        </select>
      </div>
      <div class="chips" id="catChips">
        <button class="chip ${state.cat === 'all' ? 'on' : ''}" data-cat="all">すべて</button>
        ${Object.entries(CATS).map(([k, v]) => `<button class="chip ${state.cat === k ? 'on' : ''}" data-cat="${k}">${v}</button>`).join('')}
        <button class="chip corn ${state.inSeason ? 'on' : ''}" id="seasonChip">🌟 ${NOW_MONTH}月が旬</button>
        <button class="chip corn ${state.pickupOnly ? 'on' : ''}" id="pickupChip">🚗 畑で受け取りOK</button>
      </div>
      <h2 class="sec"><span class="ic">🗺️</span>山口の畑マップ</h2>
      <div id="map"></div>
      <div class="map-pick" id="mapPick"></div>
      <h2 class="sec"><span class="ic">🧑‍🌾</span><span id="listTitle">農家さん</span> <span class="dim small" id="count"></span></h2>
      <div class="grid" id="list"></div>
      <div id="farWrap" hidden>
        <h2 class="sec"><span class="ic">🚙</span>もう少し遠くの農家さん <span class="dim small" id="farCount"></span></h2>
        <div class="grid" id="farList"></div>
      </div>
      ${api.mode === 'demo' ? '<p class="notice">※ お試し版です。掲載している農家さんは、山口の特産品をもとにした架空のデータです。</p>' : ''}
      ${legalFoot()}
    `;
    bindInstall();

    const withDist = () => filteredFarms().map(f => ({ f, d: home ? km(home, f) : null }))
      .sort((a, b) => (a.d ?? 0) - (b.d ?? 0));
    const ymap = YMap($('#map'), {
      home, radius: home ? state.rad : 0, farms: [],
      initial: m => { if (home && state.rad) m.showAround(home.lat, home.lng, state.rad * 1.25); else m.showAll(); },
      onSelect: id => { state.mapSel = id; ymap.update({ selected: id }); drawPick(); }
    });
    function drawPick() {
      const f = state.mapSel && findFarm(state.mapSel);
      $('#mapPick').innerHTML = f ? `
        <a class="mini" href="#/farm/${esc(f.id)}"><span class="em" style="background:${hue(f)}">${esc(f.emoji)}</span>
          <span class="tx"><b>${esc(f.farmName)}</b><br><span class="small dim">${esc(f.city)}${home ? ` ・ 🚗 ${fmtKm(km(home, f))}` : ''}${canPickup(f) ? ' ・ 受け取りOK' : ''}</span></span>
          <span class="go">見る →</span></a>` : '<p class="small dim" style="margin:0">ピンをタップすると農家さんが表示されます。2本指やダブルタップで拡大すると、道や地名まで見られます。</p>';
    }

    function update() {
      const all = withDist();
      const near = home && state.rad ? all.filter(x => x.d <= state.rad) : all;
      const far = home && state.rad ? all.filter(x => x.d > state.rad) : [];
      $('#listTitle').textContent = home && state.rad ? `${state.rad}km以内の農家さん` : (home ? '近い順' : '農家さん');
      $('#count').textContent = `${near.length}件`;
      $('#list').innerHTML = near.length ? near.map(x => farmCard(x.f, x.d)).join('')
        : !DATA.farms.length ? '<div class="empty">まだ農家さんの登録がありません。<br>農家の方は、下の「農家の方」タブから登録できます。</div>'
        : `<div class="empty">${home && state.rad ? `${state.rad}km以内には、条件に合う農家さんがまだいません。<br>範囲を広げるか、下の農家さんも見てみてください。` : '条件に合う農家さんが見つかりませんでした。'}</div>`;
      $('#farWrap').hidden = !far.length;
      $('#farCount').textContent = `${far.length}件`;
      $('#farList').innerHTML = far.map(x => farmCard(x.f, x.d)).join('');
      if (state.mapSel && !all.some(x => x.f.id === state.mapSel)) state.mapSel = null;
      ymap.update({ farms: all.map(x => x.f), selected: state.mapSel, dim: f => home && state.rad && km(home, f) > state.rad });
      drawPick();
    }

    $('#changeHome').addEventListener('click', () => { state.changingHome = true; renderWelcome(); window.scrollTo(0, 0); });
    $$('#radChips [data-rad]').forEach(b => b.addEventListener('click', () => {
      state.rad = Number(b.dataset.rad);
      $$('#radChips [data-rad]').forEach(x => x.classList.toggle('on', x === b));
      ymap.update({ radius: state.rad });
      if (state.rad) ymap.showAround(home.lat, home.lng, state.rad * 1.25); else ymap.showAll();
      update();
    }));
    $('#q').addEventListener('input', e => { state.q = e.target.value; update(); });
    $('#pest').addEventListener('change', e => { state.pest = e.target.value; update(); });
    $$('#catChips [data-cat]').forEach(b => b.addEventListener('click', () => {
      state.cat = b.dataset.cat;
      $$('#catChips [data-cat]').forEach(x => x.classList.toggle('on', x === b));
      update();
    }));
    $('#seasonChip').addEventListener('click', e => { state.inSeason = !state.inSeason; e.currentTarget.classList.toggle('on', state.inSeason); update(); });
    $('#pickupChip').addEventListener('click', e => { state.pickupOnly = !state.pickupOnly; e.currentTarget.classList.toggle('on', state.pickupOnly); update(); });
    update();
  }

  // ---------- 画面: 農家さん詳細 ----------
  function seasonCalendar(products) {
    if (!products || !products.length) return '<div class="empty">まだ登録がありません。</div>';
    return `
      <div class="cal box">
        <table>
          <thead><tr><th></th>${MONTHS.map(m => `<th class="${m === NOW_MONTH ? 'now' : ''}">${m}月</th>`).join('')}</tr></thead>
          <tbody>${products.map(p => `
            <tr><td class="name">${esc(p.name)}</td>${MONTHS.map(m => {
              const on = (p.months || []).includes(m);
              return `<td class="${m === NOW_MONTH ? 'cur' : ''}"><div class="bar ${on ? 'on' : ''} ${on && m === NOW_MONTH ? 'now' : ''}"></div></td>`;
            }).join('')}</tr>`).join('')}
          </tbody>
        </table>
        <div class="legend"><span><i style="background:var(--leaf)"></i>お届けできる時期</span><span><i style="background:var(--tomato)"></i>いま（${NOW_MONTH}月）</span></div>
      </div>`;
  }
  function postItem(p, f, opts = {}) {
    const photo = safeUrl(p.photoUrl);
    return `
      <article class="post">
        <div class="pic" style="background:${hue(f)}">${esc(p.emoji || f.emoji)}</div>
        <div>
          <div class="meta">${fmtDate(p.date)}${opts.showFarm ? ` ・ <a href="#/farm/${esc(f.id)}">${esc(f.farmName)}</a>（${esc(f.city)}）` : ''}</div>
          <h3>${esc(p.title)}</h3>
          <p>${esc(p.body)}</p>
          ${photo ? `<img class="photo" src="${esc(photo)}" alt="" loading="lazy">` : ''}
          ${opts.deletable ? `<button class="btn danger small del" data-del-post="${esc(p.id)}">削除</button>` : ''}
        </div>
      </article>`;
  }
  function pickupInfo(f) {
    if (!canPickup(f)) return '<div class="small dim" style="padding:14px 16px">この農家さんは現在、畑での受け取りをしていません（配送のみ）。</div>';
    const pk = f.pickup;
    return `
      <div class="method"><dl>
        <div class="row"><dt>場所</dt><dd>${esc(pk.place || f.city)}</dd></div>
        <div class="row"><dt>住所</dt><dd>${pk.addr
          ? `${esc(fullAddr(pk.addr))}<br><a class="small" href="${gmapAddrUrl(pk.addr, f)}" target="_blank" rel="noopener">Googleマップで道順を見る</a>`
          : '<span class="dim">ご注文後に、注文画面でお知らせします</span>'}</dd></div>
        <div class="row"><dt>受け取り日</dt><dd>${pk.days.slice().sort().map(d => WEEK[d]).join('・')}曜日</dd></div>
        <div class="row"><dt>時間</dt><dd>${pk.from}:00〜${pk.to}:00</dd></div>
        <div class="row"><dt>お支払い</dt><dd>${[f.chargesEnabled ? 'カード（アプリで前払い）' : '', pk.cash ? '現金（受け取りのときに）' : ''].filter(Boolean).join('・') || '―'}</dd></div>
        ${pk.note ? `<div class="row"><dt>ひとこと</dt><dd>${esc(pk.note)}</dd></div>` : ''}
      </dl></div>`;
  }
  // 受け取り方法（発送 / 畑で受け取り）。カートと一緒に覚えておき、注文手続きでも最初から選ばれた状態にする
  // 農家さんに会いに行くのがこのアプリの良さなので、受け取りができる農家さんでは「畑で受け取る」を最初に選んでおく
  const howOf = f => {
    if (!canPickup(f)) return 'ship';
    if (!f.chargesEnabled) return 'pickup'; // 口座の登録前は、現金払いの受け取りだけ
    if (cart.farmId === f.id && cart.method) return cart.method;
    return pickupDates(f).length ? 'pickup' : 'ship';
  };
  function storageSection(f) {
    if (!hasStorage(f)) return '';
    const st = f.storage, photo = safeUrl(st.photo);
    const row = (k, v) => v ? `<div class="row"><dt>${k}</dt><dd>${v}</dd></div>` : '';
    return `
      <h2 class="sec" id="storageSec"><span class="ic">🧊</span>保管と鮮度のこと</h2>
      <div class="method box">
        ${photo ? `<img class="storage-photo" src="${photo}" alt="保管している場所の写真" loading="lazy">` : ''}
        <dl>
          ${row('収穫からお届けまで', esc(FRESH[st.fresh] || ''))}
          ${row('保管のしかた', (st.ways || []).filter(w => STORE_WAYS[w]).map(w => esc(STORE_WAYS[w])).join('<br>'))}
          ${row('温度', esc(st.temp || ''))}
          ${row('配送のとき', esc(SHIP_TEMP[st.ship] || ''))}
          ${row('ひとこと', esc(st.note || '').replace(/\n/g, '<br>'))}
        </dl>
      </div>
      <p class="small dim" style="margin-top:8px">保管と鮮度の表記は、農家さん本人の申告です。届いたらなるべく早く、冷蔵庫など涼しい場所に入れてください。</p>`;
  }
  function productCard(f, p, how = howOf(f)) {
    const season = inSeason(p);
    const qty = cart.farmId === f.id ? (cart.items[p.id] || 0) : 0;
    const next = nextMonthOf(p);
    const pick = canPickup(f);
    let foot;
    if (!canOrder(f)) foot = '<div class="small dim">🛠 オンライン注文の準備中です</div>';
    else if (!season) foot = `<div class="small dim">🌱 ${next ? `${next}月ごろから` : ''}お届け予定</div>`;
    else if (p.stock <= 0) foot = '<div class="small" style="color:var(--tomato);font-weight:900">今季は売り切れました</div>';
    else foot = `
      <div class="stepper">
        <button type="button" data-dec="${esc(p.id)}" aria-label="${esc(p.name)}を減らす" ${qty <= 0 ? 'disabled' : ''}>−</button>
        <span class="qty" aria-live="polite">${qty}</span>
        <button type="button" data-inc="${esc(p.id)}" aria-label="${esc(p.name)}を増やす" ${qty >= p.stock ? 'disabled' : ''}>＋</button>
        <span class="stock ${p.stock <= 5 ? 'low' : ''}">${p.stock <= 5 ? `のこり${p.stock}` : `在庫${p.stock}`}</span>
      </div>`;
    return `
      <div class="prod ${season && p.stock > 0 && canOrder(f) ? '' : 'off'}">
        <div><span class="tag ${CAT_COLOR[p.cat] || ''}">${CATS[p.cat] || ''}</span> ${season ? '<span class="tag tomato">いま旬</span>' : ''}</div>
        <h3>${esc(p.name)}</h3>
        <div class="unit">${esc(p.unit)}${p.note ? ` ・ ${esc(p.note)}` : ''}</div>
        <div class="origin">原産地：山口県${esc(f.city)}${f.storage && FRESH_SHORT[f.storage.fresh] ? ` ・ <a href="#storageSec" data-jump="storageSec">${FRESH_SHORT[f.storage.fresh]}</a>` : ''}${f.storage && f.storage.ship === 'cool' ? ' ・ 🧊 クール便' : ''}</div>
        <div class="prices" style="${pick ? '' : 'grid-template-columns:1fr'}">
          ${pick ? `
          <button type="button" class="price ship ${how === 'ship' ? 'on' : ''}" data-how="ship" aria-pressed="${how === 'ship'}" ${f.chargesEnabled ? '' : 'disabled'}><small>📦 県内配送（送料込み）</small><b>${yen(p.shipPrice)}</b></button>
          <button type="button" class="price pick ${how === 'pickup' ? 'on' : ''}" data-how="pickup" aria-pressed="${how === 'pickup'}"><small>🚗 畑で受け取り</small><b>${yen(p.pickupPrice)}</b></button>`
          : `<div class="price ship"><small>📦 県内配送（送料込み）</small><b>${yen(p.shipPrice)}</b></div>`}
        </div>
        ${foot}
      </div>`;
  }
  function renderCartbar(f) {
    const slot = $('#cartbarSlot');
    if (!f || cart.farmId !== f.id) { slot.innerHTML = ''; return; }
    const t = cartTotals(f);
    if (!t.count) { slot.innerHTML = ''; return; }
    const pickup = howOf(f) === 'pickup';
    slot.innerHTML = `
      <div class="cartbar">
        <div class="sum">${t.count}点 ${yen(pickup ? t.pick : t.ship)}<small>${pickup ? '🚗 畑で受け取り・送料なし' : '📦 県内配送・送料込み'}</small></div>
        <a class="btn" href="#/checkout/${esc(f.id)}">注文へ進む →</a>
      </div>`;
  }

  async function renderFarm(id) {
    const f = findFarm(id);
    if (!f) { app.innerHTML = '<a class="back" href="#/">← もどる</a><div class="empty">この農家さんは見つかりませんでした。</div>'; return; }
    const m = f.methods || {};
    const pest = PESTICIDE[m.pesticide];
    const years = yearsFarming(f);
    const mine = isMine(f);
    const home = getHome();
    const cover = safeUrl(f.coverUrl);
    const posts = (f.posts || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const products = (f.products || []).slice().sort((a, b) => (inSeason(b) - inSeason(a)));

    app.innerHTML = `
      <a class="back" href="#/">← 農家さん一覧へ</a>
      <section class="farm-hero ${cover ? 'has-photo' : ''}" style="${cover ? `background:linear-gradient(rgba(0,0,0,0) 30%, rgba(0,0,0,.6)), url(${cover}) center/cover` : `background:${hue(f)}`}">
        <span class="big-emoji">${esc(f.emoji)}</span>
        <span class="pref" style="color:#2E2A24">📍 ${esc(f.city)}${home ? ` ・ 🚗 ${fmtKm(km(home, f))}` : ''}</span>
        <h1>${esc(f.farmName)}</h1>
        <div class="who">${esc(f.farmer)}</div>
        ${f.rating ? `<a class="hero-rating" href="#reviewSec" data-jump="reviewSec">${stars(f.rating.avg)} ${f.rating.avg.toFixed(1)}（${f.rating.n}件）</a>` : ''}
        <div class="actions">
          <a class="btn" href="#buy" data-jump="buy">🧺 買う</a>
          ${mine ? '<a class="btn ghost" href="#/mine/profile">農園ページを編集</a>' : `
            <button class="btn ${isFollowing(f.id) ? 'ghost' : 'leaf'}" id="followBtn">${isFollowing(f.id) ? '✓ フォロー中' : '＋ フォロー'}</button>
            <a class="btn ghost" href="#cheerSec" data-jump="cheerSec">💌 声を届ける</a>`}
        </div>
      </section>

      <h2 class="sec"><span class="ic">💬</span>つくる人の想い</h2>
      <div class="bubble">${esc(f.story)}</div>
      <div class="bubble-sign">${esc(f.farmer)}<span class="face">🧑‍🌾</span></div>

      <div class="facts">
        <div class="fact"><b>${years !== null ? years + '年' : '―'}</b><span>農業歴</span></div>
        <div class="fact"><b>${esc(f.area || '―')}</b><span>畑の広さ</span></div>
        <div class="fact"><b>${(f.products || []).length}品目</b><span>育てているもの</span></div>
      </div>

      <h2 class="sec" id="buy"><span class="ic">🧺</span>買う</h2>
      <p class="small dim" style="margin:-4px 0 12px">配送は山口県内のみ・送料込みの価格です。${canPickup(f) ? '畑まで受け取りに行くと送料がかからず、農家さんに直接会えます。' : ''}<br>注文から${f.cancelDays || 2}日以内なら、農家さんが準備を始める前までキャンセルできます（全額返金）。</p>
      ${canPickup(f) && products.length ? `
      <div class="howbuy" role="radiogroup" aria-label="受け取り方法">
        <button type="button" role="radio" data-how="ship" ${f.chargesEnabled ? '' : 'disabled'}><b>📦 家に届けてもらう</b><small>${f.chargesEnabled ? '山口県内・送料込み' : 'いまは準備中です'}</small></button>
        <button type="button" role="radio" data-how="pickup"><b>🚗 畑で受け取る</b><small>${pickupDates(f).length ? `送料なし・農家さんに会える${canCash(f) ? '・現金OK' : ''}` : '2週間以内に受け取り日がありません'}</small></button>
      </div>` : ''}
      <div class="products">${products.length ? products.map(p => productCard(f, p)).join('') : '<div class="empty">まだ商品がありません。</div>'}</div>

      <div class="two-col">
        <div>
          <h2 class="sec"><span class="ic">🌱</span>どんなふうに育てているか</h2>
          <div class="method box"><dl>
            <div class="row"><dt>農薬</dt><dd>${esc(pest ? pest.label : '―')}</dd></div>
            <div class="row"><dt>化学肥料</dt><dd>${esc(FERTILIZER[m.fertilizer] || '―')}</dd></div>
            <div class="row"><dt>栽培方式</dt><dd>${esc(m.style || '―')}</dd></div>
            <div class="row"><dt>こだわり</dt><dd>${esc(m.soil || '―')}</dd></div>
            ${(f.certs || []).length ? `<div class="row"><dt>認証など</dt><dd><div class="tags">${f.certs.map(c => `<span class="tag eggplant">${esc(c)}</span>`).join('')}</div></dd></div>` : ''}
          </dl></div>
          <p class="small dim" style="margin-top:8px">農薬・化学肥料の表記は、農家さん本人の申告です。</p>
        </div>
        <div>
          <h2 class="sec"><span class="ic">📍</span>畑はここ</h2>
          <div id="farmMap"></div>
          ${canPickup(f) && f.pickup.addr
            ? `<p class="small" style="margin-top:8px">🚗 受け取り場所：<b>${esc(fullAddr(f.pickup.addr))}</b>${f.pickup.place ? `（${esc(f.pickup.place)}）` : ''}<br><a href="${gmapAddrUrl(f.pickup.addr, f)}" target="_blank" rel="noopener">Googleマップで道順を見る</a></p>`
            : `<p class="small dim" style="margin-top:8px">${esc(f.city)}（位置はおおよそです）・<a href="${gmapUrl(f)}" target="_blank" rel="noopener">Googleマップで開く</a>${canPickup(f) ? '<br>🚗 受け取り場所のくわしい住所は、ご注文後にお知らせします。' : ''}</p>`}
        </div>
      </div>
      ${storageSection(f)}

      <h2 class="sec"><span class="ic">🚗</span>畑での受け取り</h2>
      <div class="box">${pickupInfo(f)}</div>

      <div id="farmHelps"></div>
      ${f.bizOk && !mine ? `
      <h2 class="sec"><span class="ic">🏪</span>お店・飲食店の方へ</h2>
      <div class="box" style="padding:14px 16px">
        <p class="small" style="margin:0 0 10px">${f.bizNote ? esc(f.bizNote) : 'まとめ買い・定期的な仕入れの相談を受け付けています。'}</p>
        <a class="btn small leaf" href="#/biz/${esc(f.id)}">まとめ買い・仕入れの相談をする</a>
      </div>` : ''}

      <h2 class="sec"><span class="ic">📅</span>旬カレンダー</h2>
      ${seasonCalendar(f.products)}

      <h2 class="sec"><span class="ic">📰</span>畑だより</h2>
      <div class="posts">${posts.length ? posts.map(p => postItem(p, f)).join('') : '<div class="empty">まだ投稿がありません。</div>'}</div>

      <h2 class="sec" id="reviewSec"><span class="ic">⭐</span>口コミ</h2>
      <div id="reviewList"><div class="small dim">よみこみ中…</div></div>

      <h2 class="sec" id="cheerSec"><span class="ic">💌</span>届いた声</h2>
      <div class="cheers" id="cheerList"><div class="small dim">よみこみ中…</div></div>
      <div id="cheerFormSlot" style="margin-top:14px"></div>
      ${legalFoot(`<a href="#/law/${esc(f.id)}">特定商取引法に基づく表記</a> ・ `)}
    `;

    const cal = $('.cal'), nowTh = $('.cal th.now');
    if (cal && nowTh && cal.scrollWidth > cal.clientWidth) cal.scrollLeft = nowTh.offsetLeft - cal.clientWidth / 2;

    YMap($('#farmMap'), {
      small: true, farms: [f], home, focusCity: f.city, selected: f.id,
      initial: mp => mp.showAround(f.lat, f.lng, 4)
    });

    $$('[data-jump]').forEach(a => a.addEventListener('click', e => {
      e.preventDefault();
      const t = document.getElementById(a.dataset.jump);
      if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));

    async function changeQty(pid, d) {
      const p = f.products.find(x => x.id === pid);
      if (!p) return;
      if (cart.farmId !== f.id) {
        if (cart.farmId && Object.values(cart.items).some(Boolean)) {
          const other = findFarm(cart.farmId);
          if (!(await ask(`カートに「${other ? other.farmName : '別の農家さん'}」の商品があります。\n注文は1回につき1軒の農家さんずつです。カートを入れ替えますか？`, '入れ替える'))) return;
        }
        cart = { farmId: f.id, items: {}, method: how };
      }
      cart.items[pid] = Math.max(0, Math.min(p.stock, (cart.items[pid] || 0) + d));
      saveCart();
      redrawProducts();
    }
    // 受け取り方法は、カートが空でもこの画面では覚えておく（商品を選ぶ前に切り替える人が多いため）
    let how = howOf(f);
    function setHow(v) {
      if (!canPickup(f) || how === v) return;
      how = v;
      if (cart.farmId === f.id) { cart.method = v; saveCart(); }
      redrawProducts();
    }
    function redrawProducts() {
      const y = window.scrollY;
      $('.products').innerHTML = products.map(x => productCard(f, x, how)).join('');
      $$('.howbuy [data-how]').forEach(b => { const on = b.dataset.how === how; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
      bindSteppers();
      window.scrollTo(0, y);
      renderCartbar(f);
    }
    function bindSteppers() {
      $$('[data-inc]').forEach(b => b.addEventListener('click', () => changeQty(b.dataset.inc, 1)));
      $$('[data-dec]').forEach(b => b.addEventListener('click', () => changeQty(b.dataset.dec, -1)));
      $$('.products [data-how]').forEach(b => b.addEventListener('click', () => setHow(b.dataset.how)));
    }
    $$('.howbuy [data-how]').forEach(b => b.addEventListener('click', () => setHow(b.dataset.how)));
    redrawProducts();

    const fb = $('#followBtn');
    if (fb) fb.addEventListener('click', () => {
      const now = toggleFollow(f.id);
      fb.textContent = now ? '✓ フォロー中' : '＋ フォロー';
      fb.classList.toggle('ghost', now);
      fb.classList.toggle('leaf', !now);
      toast(now ? `${f.farmName}をフォローしました` : 'フォローを外しました');
    });

    async function drawCheers() {
      const cheers = await api.cheers(f.id);
      $('#cheerList').innerHTML = cheers.length
        ? cheers.map(c => `<div class="cheer"><div class="meta">${esc(c.name || '匿名')} ・ ${fmtDate(c.date)}</div><p>${esc(c.text)}</p></div>`).join('')
        : '<div class="small dim">まだ声は届いていません。最初のひとことを送ってみませんか。</div>';
    }
    function drawCheerForm() {
      const slot = $('#cheerFormSlot');
      if (mine) { slot.innerHTML = ''; return; }
      if (needLogin()) {
        slot.innerHTML = loginPanel('声を届けるには、ログインが必要です。');
        bindLogin(location.hash, drawCheerForm);
        return;
      }
      slot.innerHTML = `
        <form class="panel" id="cheerForm">
          <div class="field"><label for="cName">お名前（ニックネーム可）</label><input id="cName" maxlength="30" placeholder="例：仁保のはなこ"></div>
          <div class="field"><label for="cText">${esc(f.farmer)}さんへのメッセージ</label><textarea id="cText" maxlength="400" required placeholder="食べた感想、応援のことば、育て方についての質問など"></textarea></div>
          <button class="btn" type="submit">送る</button>
          ${api.mode === 'demo' ? '<p class="small dim" style="margin:8px 0 0">お試し版のため、メッセージはこの端末の中にだけ保存されます。</p>' : ''}
        </form>`;
      $('#cheerForm').addEventListener('submit', async e => {
        e.preventDefault();
        const text = $('#cText').value.trim();
        if (!text) return;
        try {
          await api.addCheer(f.id, { name: $('#cName').value.trim(), text });
          toast('声を届けました');
          $('#cText').value = '';
          await drawCheers();
        } catch (err) { toast('送れませんでした：' + (err.message || '')); }
      });
    }
    drawCheerForm();
    drawReviews($('#reviewList'), f);
    api.helps(f.id).then(hs => {
      const open = hs.filter(h => h.status === 'open' && h.date > today());
      const slot = $('#farmHelps');
      if (slot && open.length) slot.innerHTML = `<h2 class="sec"><span class="ic">🙌</span>お手伝い募集中</h2><div class="help-list">${open.map(helpCard).join('')}</div>`;
    }).catch(() => {});
    await drawCheers();
  }

  // ---------- 画面: 注文手続き ----------
  function pickupDates(f) {
    const out = [];
    const d = new Date();
    for (let i = 1; i <= 14; i++) {
      const t = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i);
      if ((f.pickup.days || []).includes(t.getDay())) out.push(ymd(t));
    }
    return out;
  }

  function renderCheckout(id) {
    const f = findFarm(id);
    if (!f || !cartTotals(f).count) {
      app.innerHTML = `<a class="back" href="#/${f ? 'farm/' + esc(id) : ''}">← もどる</a><div class="empty">カートが空です。<br>農家さんのページで商品を選んでください。</div>`;
      return;
    }
    if (needLogin()) {
      app.innerHTML = `<a class="back" href="#/farm/${esc(f.id)}">← ${esc(f.farmName)}にもどる</a>
        <section class="hero-intro simple"><h1>ご注文手続き</h1></section><div style="margin-top:16px">${loginPanel('注文の状況をお知らせするため、ログインが必要です。')}</div>`;
      bindLogin(location.hash, () => renderCheckout(id));
      return;
    }
    const lines = f.products.filter(p => cart.items[p.id]).map(p => ({ p, q: Math.min(cart.items[p.id], p.stock) })).filter(l => l.q > 0);
    const t = cartTotals(f);
    const pick = canPickup(f);
    const dates = pick ? pickupDates(f) : [];
    const buyer = store.get(KEY.buyer, {});
    const startPick = pick && dates.length > 0 && (howOf(f) === 'pickup' || !f.chargesEnabled);
    const cashOk = canCash(f) && dates.length > 0;
    const hours = pick ? Array.from({ length: Math.max(0, f.pickup.to - f.pickup.from) }, (_, i) => f.pickup.from + i) : [];

    app.innerHTML = `
      <a class="back" href="#/farm/${esc(f.id)}">← ${esc(f.farmName)}にもどる</a>
      <section class="hero-intro simple"><h1>ご注文手続き</h1><p>${esc(f.farmName)}（${esc(f.city)}）への注文です。</p></section>

      <form id="coForm" novalidate>
        <h2 class="sec"><span class="ic">🚚</span>受け取り方法</h2>
        <div class="choice">
          <label><input type="radio" name="method" value="ship" ${startPick ? '' : 'checked'} ${f.chargesEnabled ? '' : 'disabled'}>
            <span class="t">📦 家に届けてもらう<small>${f.chargesEnabled ? '山口県内のみ・送料込み' : 'この農家さんは、いまは配送の準備中です'}</small></span>
            <span class="p">${yen(t.ship)}</span></label>
          ${pick ? `<label class="pickup"><input type="radio" name="method" value="pickup" ${dates.length ? '' : 'disabled'} ${startPick ? 'checked' : ''}>
            <span class="t">🚗 畑まで受け取りに行く<small>${dates.length ? '送料なし・農家さんに直接会えます' : '2週間以内に受け取れる日がありません'}</small></span>
            <span class="p">${yen(t.pick)}</span></label>` : ''}
        </div>

        <h2 class="sec"><span class="ic">🧾</span>ご注文内容</h2>
        <div class="panel">
          <table class="lines">
            ${lines.map(({ p, q }) => `<tr><td>${esc(p.name)}<br><span class="small dim">${esc(p.unit)} × ${q}</span></td><td class="r" data-line="${esc(p.id)}"></td></tr>`).join('')}
            <tr class="total"><td>合計 <span class="small dim" id="taxNote"></span></td><td class="r" id="total"></td></tr>
          </table>
          <div id="saveNote" style="margin-top:6px"></div>
        </div>

        <div id="pickupFields" hidden>
          ${cashOk ? `
          <h2 class="sec"><span class="ic">👛</span>お支払いの方法</h2>
          <div class="choice">
            <label><input type="radio" name="pay" value="card" ${f.chargesEnabled ? 'checked' : 'disabled'}>
              <span class="t">💳 いまカードで払う<small>${f.chargesEnabled ? 'アプリで前払い。受け取りは番号を伝えるだけ' : 'この農家さんは、いまは現金払いのみです'}</small></span></label>
            <label class="pickup"><input type="radio" name="pay" value="cash" ${f.chargesEnabled ? '' : 'checked'}>
              <span class="t">💴 受け取りのときに現金で払う<small>手数料がかからず、売上がまるごと農家さんに届きます</small></span></label>
          </div>` : ''}
          <h2 class="sec"><span class="ic">📅</span>受け取り日時</h2>
          <div class="panel">
            <div class="row2">
              <div class="field"><label for="pDate">日にち</label><select id="pDate">${dates.map(d => `<option value="${d}">${fmtDay(d)}</option>`).join('')}</select></div>
              <div class="field"><label for="pTime">時間</label><select id="pTime">${hours.map(h => `<option value="${h}">${h}:00〜${h + 1}:00</option>`).join('')}</select></div>
            </div>
            <div class="small"><b>📍 ${esc(pick ? (f.pickup.place || f.city) : '')}</b>${pick && f.pickup.addr ? `<br>${esc(fullAddr(f.pickup.addr))}` : '<br><span class="dim">くわしい住所は、ご注文後の画面でお知らせします。</span>'}</div>
            ${pick && f.pickup.note ? `<div class="small dim">${esc(f.pickup.note)}</div>` : ''}
            <div class="field" style="margin:12px 0 0"><label for="pMsg">農家さんへひとこと（任意）</label><input id="pMsg" maxlength="100" placeholder="例：子どもと一緒に行きます！"></div>
          </div>
        </div>

        <div id="shipFields">
          <h2 class="sec"><span class="ic">🏠</span>お届け先（山口県内）</h2>
          <div class="panel">
            <div class="row2">
              <div class="field"><label for="sZip">郵便番号</label><input id="sZip" inputmode="numeric" maxlength="8" placeholder="753-0000" autocomplete="postal-code" value="${esc(buyer.zip || '')}"></div>
              <div class="field"><label for="sPref">都道府県</label><input id="sPref" value="山口県" readonly></div>
            </div>
            <div class="field"><label for="sAddr">市町・番地・建物名</label><input id="sAddr" maxlength="120" autocomplete="street-address" placeholder="山口市仁保中郷 1-2-3" value="${esc(buyer.addr || '')}"></div>
          </div>
        </div>

        <h2 class="sec"><span class="ic">🙋</span>ご連絡先</h2>
        <div class="panel">
          <div class="row2">
            <div class="field"><label for="bName">お名前</label><input id="bName" maxlength="40" autocomplete="name" value="${esc(buyer.name || '')}"></div>
            <div class="field"><label for="bTel">電話番号</label><input id="bTel" type="tel" maxlength="13" autocomplete="tel" placeholder="090-0000-0000" value="${esc(buyer.tel || '')}"></div>
          </div>
        </div>

        <h2 class="sec"><span class="ic">✅</span>ご注文前にご確認ください</h2>
        <div class="panel confirm small">
          <ul>
            <li>販売者：${esc(sellerOf(f))}（${esc(f.farmName)}）・<a href="#/law/${esc(f.id)}" data-sheet>特定商取引法に基づく表記</a></li>
            <li id="payNote"></li>
            <li id="whenNote"></li>
            <li id="cancelNote"></li>
            <li>返品：生鮮食品のため、お客さまのご都合による返品はできません。傷みなどがあった場合は、受け取りから2日以内にご連絡ください。</li>
            <li>お名前・電話番号・お届け先は、ご注文の準備のため農家さんにお伝えします（<a href="#/legal/privacy" data-sheet>プライバシーポリシー</a>）。</li>
          </ul>
        </div>
        ${api.mode === 'demo'
          ? '<p class="notice">🧪 お試し版です。ボタンを押しても<b>実際の請求は発生しません</b>（支払ったことにして注文が入ります）。</p>'
          : '<p class="notice" id="stripeNote">💳 次の画面（Stripe）で、クレジットカードなどでお支払いいただきます。カード情報はこのアプリには保存されません。</p>'}
        <button class="btn block" type="submit" style="margin-top:16px;font-size:1.05rem;padding:12px" id="payBtn"></button>
      </form>
    `;

    const method = () => ($('input[name=method]:checked') || {}).value || 'ship';
    const payBy = () => method() === 'pickup' && cashOk && (($('input[name=pay]:checked') || {}).value === 'cash' || !f.chargesEnabled) ? 'cash' : 'card';
    function refresh() {
      const mtd = method();
      let total = 0;
      lines.forEach(({ p, q }) => { const v = q * (mtd === 'pickup' ? p.pickupPrice : p.shipPrice); total += v; $(`[data-line="${CSS.escape(p.id)}"]`).textContent = yen(v); });
      const other = lines.reduce((s, { p, q }) => s + q * p.shipPrice, 0);
      $('#total').textContent = yen(total);
      $('#taxNote').textContent = mtd === 'pickup' ? '（税込・送料なし）' : '（税込・送料込み）';
      $('#saveNote').innerHTML = mtd === 'pickup' && other > total ? `<span class="save">🚗 受け取りで ${yen(other - total)} おトク</span>` : '';
      $('#pickupFields').hidden = mtd !== 'pickup';
      $('#shipFields').hidden = mtd === 'pickup';
      const cash = payBy() === 'cash';
      $('#payNote').innerHTML = cash
        ? 'お支払い：<b>受け取りのときに現金で</b>お支払いください。連絡なく来られなかった予約が2回になると、現金払いの予約ができなくなります。'
        : 'お支払い：クレジットカードなど・ご注文時にお支払い（決済画面を開いてから30分以内）';
      if ($('#stripeNote')) $('#stripeNote').hidden = cash;
      $('#cancelNote').innerHTML = cash ? `予約の取り消し：注文から<b>${f.cancelDays || 2}日以内</b>（受け取り日の前日まで）、農家さんが準備を始める前までできます。` : `キャンセル：注文から<b>${f.cancelDays || 2}日以内</b>${mtd === 'pickup' ? '（受け取り日の前日まで）' : ''}、農家さんが準備を始める前までできます。全額返金します。`;
      $('#whenNote').innerHTML = mtd === 'pickup' ? 'お渡し：上で選んだ受け取り日時に、畑でお渡しします。' : `お届け：ご注文から<b>${shipDaysOf(f)}日以内</b>に発送します。${f.storage && SHIP_TEMP[f.storage.ship] ? `（${esc(SHIP_TEMP[f.storage.ship])}）` : ''}`;
      $('#payBtn').textContent = cash ? `${yen(total)} で予約する（受け取りのときに現金払い）` : api.mode === 'demo' ? `${yen(total)} で注文する（お試し）` : `${yen(total)} のお支払いへ進む`;
    }
    $$('input[name=method]').forEach(r => r.addEventListener('change', () => { cart.method = method(); saveCart(); refresh(); }));
    $$('input[name=pay]').forEach(r => r.addEventListener('change', refresh));
    refresh();

    $('#coForm').addEventListener('submit', async e => {
      e.preventDefault();
      const mtd = method();
      const name = $('#bName').value.trim(), tel = $('#bTel').value.trim();
      const zip = $('#sZip').value.trim(), addr = $('#sAddr').value.trim();
      if (mtd === 'ship') {
        if (!ZIP_RE.test(zip)) { toast('配送は山口県内（郵便番号 740〜759）のみです'); $('#sZip').focus(); return; }
        if (!addr) { toast('住所を入力してください'); $('#sAddr').focus(); return; }
      }
      if (!name) { toast('お名前を入力してください'); $('#bName').focus(); return; }
      if (!TEL_RE.test(tel)) { toast('電話番号を確認してください'); $('#bTel').focus(); return; }
      store.set(KEY.buyer, { name, tel, zip, addr });
      const payload = {
        farm_id: f.id, method: mtd,
        items: lines.map(({ p, q }) => ({ product_id: p.id, qty: q })),
        pickup: mtd === 'pickup' ? { date: $('#pDate').value, hour: Number($('#pTime').value), msg: $('#pMsg').value.trim() } : undefined,
        ship: mtd === 'ship' ? { zip, addr } : undefined,
        buyer: { name, tel }
      };
      const btn = $('#payBtn');
      btn.disabled = true;
      btn.textContent = '手続き中…';
      try {
        if (payBy() === 'cash') {
          const res = await api.placeCashOrder(payload);
          cart = { farmId: null, items: {} };
          saveCart();
          await reload();
          location.hash = `#/order/${res.orderId}?new=1`;
          return;
        }
        const res = await api.placeOrder(payload);
        cart = { farmId: null, items: {} };
        saveCart();
        if (res.redirect) {
          // アプリ版：決済画面をアプリ内で開き、閉じたら注文画面で結果を確認する
          if (NATIVE) { location.hash = `#/order/${res.orderId}?new=1`; openExternal(res.redirect, () => renderOrder(res.orderId, true)); }
          else openExternal(res.redirect);
          return;
        }
        await reload();
        location.hash = `#/order/${res.orderId}?new=1`;
      } catch (err) {
        toast(err.message || '注文できませんでした');
        btn.disabled = false;
        refresh();
      }
    });
  }

  // ---------- 画面: 注文 ----------
  const STATUS = {
    ship: [['paid', 'お支払い済み'], ['shipped', '発送済み'], ['done', 'お届け完了']],
    pickup: [['paid', 'お支払い済み'], ['ready', '準備OK'], ['done', '受け取り完了']],
    cash: [['reserved', '予約済み'], ['ready', '準備OK'], ['done', '受け取り完了']]
  };
  const stepsOf = o => STATUS[o.payment === 'cash' ? 'cash' : o.method];
  function statusLabel(o) {
    if (o.status === 'pending_payment') return 'お支払い待ち';
    if (o.status === 'canceled') return 'キャンセル済み';
    if (o.status === 'expired') return '取り消し';
    if (o.status === 'noshow') return '受け取りなし';
    return (stepsOf(o).find(s => s[0] === o.status) || [, ''])[1];
  }
  function statusSteps(o) {
    if (['pending_payment', 'canceled', 'expired', 'noshow'].includes(o.status)) return '';
    const st = stepsOf(o);
    const idx = st.findIndex(s => s[0] === o.status);
    return `<div class="steps">${st.map((s, i) => `<div class="${i <= idx ? 'on' : ''}">${s[1]}</div>`).join('')}</div>`;
  }
  // 発送が「発送の目安」より3日以上遅れた配送の注文は、期限を過ぎてもキャンセル（全額返金）できる（サーバーの begin_cancel と同じ条件）
  const shipLate = o => {
    if (o.method !== 'ship' || o.status !== 'paid') return false;
    const f = findFarm(o.farmId);
    return Date.now() > new Date(o.createdAt).getTime() + ((f ? shipDaysOf(f) : 3) + 3) * 86400000;
  };
  const canCancel = o => (['paid', 'reserved'].includes(o.status) && Date.now() < new Date(o.cancelDeadline).getTime()) || shipLate(o);
  function orderCard(o) {
    return `
      <a class="order box" href="#/order/${esc(o.id)}">
        <div class="head"><b>${esc(o.farmEmoji)} ${esc(o.farmName)}</b><span class="status ${esc(o.status)}">${esc(statusLabel(o))}</span></div>
        <div class="small dim">${fmtDate(o.createdAt)} 注文 ・ ${o.method === 'pickup' ? `🚗 ${fmtDay(o.pickup.date)} ${esc(o.pickup.time)} 受け取り` : '📦 配送'}</div>
        <div class="small">${o.items.map(i => `${esc(i.name)}×${i.qty}`).join('、')}</div>
        <div><b>${yen(o.total)}</b>${o.payment === 'cash' ? ' <span class="small">💴 受け取りのときに現金で</span>' : ''}${canCancel(o) ? ` <span class="small dim">・${fmtDateTime(o.cancelDeadline)}までキャンセルできます</span>` : ''}</div>
      </a>`;
  }
  function accountFooter() {
    return api.mode === 'live'
      ? `<p class="small dim" style="margin-top:24px">${esc(api.user.email)} でログイン中 ・ <button class="linkbtn" data-logout>ログアウト</button> ・ <button class="linkbtn" data-delacct style="color:var(--tomato)">アカウントを削除</button></p>`
      : '<p class="small dim" style="margin-top:24px"><button class="linkbtn" data-delacct style="color:var(--tomato)">お試し版のデータをすべて消す</button></p>';
  }
  const accountFooterWithLegal = () => accountFooter() + legalFoot();
  function bindAccount(after) {
    $$('[data-logout]').forEach(b => b.addEventListener('click', async () => { await api.signOut(); await reload(); draftProducts = null; toast('ログアウトしました'); after(); }));
    $$('[data-delacct]').forEach(b => b.addEventListener('click', async () => {
      const msg = api.mode === 'live'
        ? 'アカウントを削除すると、農園・畑だより・なかま市の出品もすべて消え、元に戻せません。\n（進行中の注文がある場合は削除できません）\n本当に削除しますか？'
        : 'この端末に保存したお試し版のデータ（農園・注文・メッセージなど）をすべて消します。よろしいですか？';
      if (!(await ask(msg, api.mode === 'live' ? '削除する' : '消す', true))) return;
      try { await api.deleteAccount(); cart = { farmId: null, items: {} }; await reload(); draftProducts = null; toast(api.mode === 'live' ? 'アカウントを削除しました' : 'データを消しました'); go('#/'); }
      catch (err) { toast(err.message); }
    }));
  }

  async function renderOrders() {
    if (needLogin()) {
      app.innerHTML = `<section class="hero-intro simple"><h1>注文したもの</h1></section><div style="margin-top:16px">${loginPanel('注文履歴を見るには、ログインが必要です。')}</div>`;
      bindLogin('#/orders', renderOrders);
      return;
    }
    const list = await api.myOrders();
    const bizMine = await api.bizMine().catch(() => []);
    app.innerHTML = `
      <section class="hero-intro simple"><h1>注文したもの</h1><p>注文の状況・受け取りコード・キャンセルはここから。</p></section>
      <div class="order-list" style="margin-top:18px">${list.length ? list.map(orderCard).join('') : '<div class="empty">まだ注文はありません。<br><a href="#/">農家さんをさがす →</a></div>'}</div>
      ${bizMine.length ? `<p style="margin-top:16px"><a class="btn ghost small" href="#/biz">🏪 お店として送った相談（${bizMine.length}件）</a></p>` : ''}
      ${accountFooterWithLegal()}`;
    bindAccount(renderOrders);
  }

  async function renderOrder(id, isNew) {
    if (needLogin()) {
      app.innerHTML = `<div style="margin-top:16px">${loginPanel('注文を見るには、ログインが必要です。')}</div>`;
      bindLogin(location.hash, () => renderOrder(id, isNew));
      return;
    }
    let o = await api.order(id);
    // Stripe から戻った直後は、支払い完了の通知が少し遅れて届くことがある
    for (let i = 0; o && isNew && o.status === 'pending_payment' && i < 5; i++) {
      await new Promise(r => setTimeout(r, 1500));
      o = await api.order(id);
    }
    if (!o) { app.innerHTML = '<a class="back" href="#/orders">← 注文一覧へ</a><div class="empty">注文が見つかりませんでした。</div>'; return; }
    const pickup = o.method === 'pickup';
    const f = findFarm(o.farmId);
    const loc = { lat: o.farmLat ?? f?.lat, lng: o.farmLng ?? f?.lng };
    let cancelHtml = '';
    if (o.status === 'pending_payment') cancelHtml = `
      <div class="cancel-box">お支払いがまだ完了していません。30分以内にお支払いがないと、自動で取り消されます。
        <div class="actions" style="margin-top:10px">${o.checkoutUrl ? '<button class="btn" id="payAgain">お支払いへ進む</button>' : ''}<button class="btn danger" id="cancelBtn">注文をやめる</button></div></div>`;
    else if (canCancel(o) && o.payment === 'cash') cancelHtml = `
      <div class="cancel-box">↩️ <b>${fmtDateTime(o.cancelDeadline)}</b> まで、予約を取り消せます。行けなくなったときは、必ず取り消してください。
        <div style="margin-top:10px"><button class="btn danger small" id="cancelBtn">この予約を取り消す</button></div></div>`;
    else if (shipLate(o)) cancelHtml = `
      <div class="cancel-box">⚠️ 発送の目安を過ぎています。まずは下のメッセージで農家さんに確認してみてください。待てない場合は、キャンセル（全額返金）できます。
        <div style="margin-top:10px"><button class="btn danger small" id="cancelBtn">この注文をキャンセルする</button></div></div>`;
    else if (canCancel(o)) cancelHtml = `
      <div class="cancel-box">↩️ <b>${fmtDateTime(o.cancelDeadline)}</b> まで、キャンセルできます（全額返金）。
        <div style="margin-top:10px"><button class="btn danger small" id="cancelBtn">この注文をキャンセルする</button></div></div>`;
    else if (o.status === 'reserved') cancelHtml = '<div class="cancel-box">取り消しの期限を過ぎました。行けなくなった場合は、農家さんにお電話でご連絡ください。</div>';
    else if (o.status === 'noshow') cancelHtml = '<div class="cancel-box">受け取りの時間にお越しがなかったため、この予約は終了しました。</div>';
    else if (o.status === 'canceled' && o.payment === 'cash') cancelHtml = '<div class="cancel-box">この予約は取り消しました。</div>';
    else if (o.status === 'paid') cancelHtml = '<div class="cancel-box">キャンセルの期限を過ぎました。ご都合が悪くなった場合は、農家さんにお電話でご相談ください。</div>';
    else if (o.status === 'ready' || o.status === 'shipped') cancelHtml = '<div class="cancel-box">農家さんが準備を始めたため、キャンセルはできません。</div>';
    else if (o.status === 'canceled') cancelHtml = `<div class="cancel-box">この注文はキャンセルしました。${o.refundStatus === 'failed' ? '返金の手続きでエラーが起きたため、運営からご連絡します。' : '代金は全額返金されます（カード会社によって反映まで数日かかります）。'}</div>`;
    else if (o.status === 'expired') cancelHtml = '<div class="cancel-box">お支払いが完了しなかったため、この注文は取り消されました。</div>';

    app.innerHTML = `
      <a class="back" href="#/orders">← 注文一覧へ</a>
      ${isNew && ['paid', 'reserved'].includes(o.status) ? `<section class="hero-intro"><span class="float a">🎉</span><h1>${o.status === 'reserved' ? 'ご予約ありがとうございます！' : 'ご注文ありがとうございます！'}</h1><p>${esc(o.farmName)}さんに${o.status === 'reserved' ? '予約' : '注文'}が届きました。</p></section>` : ''}
      <h2 class="sec"><span class="ic">${pickup ? '🚗' : '📦'}</span>${pickup ? '畑での受け取り' : '配送'} <span class="status ${esc(o.status)}">${esc(statusLabel(o))}</span></h2>
      <div class="panel">
        ${statusSteps(o)}
        ${pickup ? `
          <p style="margin:8px 0 4px"><b>${fmtDay(o.pickup.date)} ${esc(o.pickup.time)}</b></p>
          <p class="small" style="margin:0">📍 ${esc(o.pickup.place)}${o.pickup.addr ? `<br>${esc(fullAddr(o.pickup.addr))}` : ''}${o.pickup.addr || typeof loc.lat === 'number' ? `<br><a href="${gmapAddrUrl(o.pickup.addr, loc)}" target="_blank" rel="noopener">Googleマップで道順を見る</a>` : ''}</p>
          ${o.payment === 'cash' && ['reserved', 'ready'].includes(o.status) ? `<p class="cash-note">💴 受け取りのときに、<b>現金で ${yen(o.total)}</b> をお支払いください（おつりのないようご用意いただけると助かります）。</p>` : ''}
          ${['paid', 'reserved', 'ready'].includes(o.status) ? `<p class="small dim" style="margin:12px 0 6px">受け取りのときに、この番号を農家さんに伝えてください。</p><div class="code" aria-label="受け取りコード">${esc(o.code)}</div>` : ''}`
        : `<p class="small" style="margin:8px 0 0">お届け先：〒${esc(o.ship.zip)} ${esc(o.ship.pref)} ${esc(o.ship.addr)}</p>
           <p class="small dim" style="margin:4px 0 0">${f ? `ご注文から${shipDaysOf(f)}日以内に発送します。` : ''}発送されたら、ここの状況が「発送済み」に変わります。</p>`}
        ${cancelHtml}
      </div>
      <h2 class="sec"><span class="ic">🧾</span>ご注文内容</h2>
      <div class="panel">
        <table class="lines">
          ${o.items.map(i => `<tr><td>${esc(i.name)}<br><span class="small dim">${esc(i.unit)} × ${i.qty}</span></td><td class="r">${yen(i.price * i.qty)}</td></tr>`).join('')}
          <tr class="total"><td>合計 <span class="small dim">${pickup ? '（送料なし）' : '（送料込み）'}</span></td><td class="r">${yen(o.total)}</td></tr>
        </table>
        <p class="small dim" style="margin:8px 0 0">注文番号 ${esc(String(o.id).slice(0, 8))} ・ ${fmtDateTime(o.createdAt)} 注文 ・ 販売者 ${esc(f ? `${sellerOf(f)}（${o.farmName}）` : o.farmName)}${o.farmCity || (f && f.city) ? ` ・ 原産地 山口県${esc(o.farmCity || f.city)}` : ''}${api.mode === 'demo' ? '（お試し版）' : ''}</p>
      </div>
      ${o.status === 'done' && o.farmId ? `
      <h2 class="sec"><span class="ic">⭐</span>口コミ</h2>
      <div class="panel" id="reviewSlot"><div class="small dim">よみこみ中…</div></div>` : ''}
      ${o.status !== 'pending_payment' && o.status !== 'expired' ? `
      <h2 class="sec"><span class="ic">💬</span>農家さんとのメッセージ</h2>
      <div class="panel" id="chatSlot"><div class="small dim">よみこみ中…</div></div>` : ''}
      <p class="small dim" style="margin-top:12px">解決しないときは <a href="#/contact?kind=order&order=${esc(o.id)}">運営へのお問い合わせ</a> へ。</p>
      <div class="actions">${o.farmId ? `<a class="btn leaf" href="#/farm/${esc(o.farmId)}">${esc(o.farmName)}のページへ</a>` : ''}
      </div>
    `;
    if ($('#chatSlot')) chatBox($('#chatSlot'), o, false);
    if ($('#reviewSlot')) reviewBox($('#reviewSlot'), o);
    const pa = $('#payAgain');
    if (pa) pa.addEventListener('click', () => openExternal(o.checkoutUrl, () => renderOrder(o.id, true)));
    const cb = $('#cancelBtn');
    if (cb) cb.addEventListener('click', async () => {
      const cash = o.payment === 'cash';
      if (!(await ask(o.status === 'pending_payment' ? 'この注文をやめますか？' : cash ? 'この予約を取り消しますか？' : 'この注文をキャンセルしますか？\n代金は全額返金されます。', cash ? '取り消す' : 'キャンセルする', true))) return;
      cb.disabled = true;
      try {
        await api.cancelOrder(o.id, o.payment);
        await reload();
        toast(o.status === 'pending_payment' ? '注文をやめました' : cash ? '予約を取り消しました' : 'キャンセルしました');
        renderOrder(o.id, false);
        updateBadge();
      } catch (err) { toast(err.message); cb.disabled = false; }
    });
  }

  // ---------- 画面: 畑だより ----------
  function renderFeed() {
    const fl = follows();
    const items = [];
    DATA.farms.forEach(f => (f.posts || []).forEach(p => items.push({ p, f })));
    const shown = items.filter(x => state.feedMode === 'all' || fl.includes(x.f.id)).sort((a, b) => String(b.p.date).localeCompare(String(a.p.date)));
    app.innerHTML = `
      <section class="hero-intro"><span class="float a">📰</span><h1>畑だより</h1><p>いま、山口の畑で起きていること。</p></section>
      <div style="margin:16px 0">
        <div class="seg" id="feedSeg">
          <button data-mode="all" class="${state.feedMode === 'all' ? 'on' : ''}">すべて</button>
          <button data-mode="follow" class="${state.feedMode === 'follow' ? 'on' : ''}">フォロー中</button>
        </div>
        <a class="small" href="#/follows" style="margin-left:10px">💚 フォロー中の農家さん →</a>
      </div>
      <div class="posts">
        ${shown.length ? shown.map(x => postItem(x.p, x.f, { showFarm: true })).join('')
          : `<div class="empty">${state.feedMode === 'follow' ? 'フォロー中の農家さんの便りはまだありません。<br><a href="#/">農家さんをさがす →</a>' : 'まだ便りがありません。'}</div>`}
      </div>`;
    $$('#feedSeg button').forEach(b => b.addEventListener('click', () => { state.feedMode = b.dataset.mode; renderFeed(); }));
  }

  // ---------- 画面: フォロー ----------
  function renderFollows() {
    const home = getHome();
    const list = follows().map(findFarm).filter(Boolean);
    app.innerHTML = `
      <section class="hero-intro"><span class="float a">💚</span><h1>フォロー中の農家さん</h1><p>フォローすると、畑だよりで近況を追いかけられます。</p></section>
      <div class="grid">${list.length ? list.map(f => farmCard(f, home ? km(home, f) : null)).join('') : '<div class="empty">まだフォローしている農家さんはいません。<br><a href="#/">さがしにいく →</a></div>'}</div>`;
  }

  // ======================================================================
  //  農家の方（注文 ／ 畑だより ／ なかま市 ／ プロフィール）
  // ======================================================================
  let draftProducts = null;
  let editingIdx = -1;

  function blankFarm() {
    return {
      id: null, farmName: '', farmer: '', city: '', lat: null, lng: null, latPicked: false, coverUrl: '',
      since: '', area: '', emoji: '🥬', hue: 0, catch: '', story: '', cancelDays: 2,
      methods: { pesticide: 'conventional', fertilizer: 'conventional', style: '露地', soil: '' },
      certs: [], products: [], posts: [],
      pickup: { enabled: true, place: '', days: [6], from: 9, to: 16, note: '' },
      storage: {}
    };
  }
  function subnav(cur, pending) {
    const items = [['orders', '🧾 注文', '#/mine'], ['posts', '✏️ 畑だより', '#/mine/posts'], ['help', '🙌 お手伝い', '#/mine/help'], ['market', '🤝 なかま市', '#/mine/market'], ['profile', '🏡 プロフィール', '#/mine/profile']];
    return `<nav class="subnav" aria-label="農家の方のメニュー">${items.map(([k, label, href]) => `<a href="${href}" class="${cur === k ? 'on' : ''}">${label}${k === 'orders' && pending ? `<span class="n">${pending}</span>` : ''}</a>`).join('')}</nav>`;
  }

  async function renderMine(sub, rest, query) {
    if (needLogin()) {
      app.innerHTML = `<section class="hero-intro"><span class="float a">👩‍🌾</span><h1>農家の方へ</h1><p>農園の登録・注文の管理・畑だより・農家どうしの「なかま市」が使えます。</p></section><div style="margin-top:16px">${loginPanel('')}</div>`;
      bindLogin(location.hash, () => route());
      return;
    }
    // Stripe の口座登録から戻ってきたとき
    if (api.mode === 'live' && /connect=/.test(query || '') && DATA.mine) {
      try { const st = await api.connect('status'); await reload(); toast(st.charges_enabled ? '受け取り口座の登録が完了しました！注文を受けられます' : '口座の登録がまだ途中です'); } catch (err) { toast(err.message); }
      history.replaceState(null, '', location.pathname + location.search + '#/mine');
    }
    if (!DATA.mine) { await renderProfile(true); return; }
    const pending = (await api.farmOrders(DATA.mine.id)).filter(o => ['paid', 'reserved', 'ready', 'shipped'].includes(o.status)).length;
    const head = subnav(sub || 'orders', pending);
    if (sub === 'posts') return renderMyPosts(head);
    if (sub === 'market') {
      if (rest[0] === 'new') return renderMarketNew(head);
      if (rest[0]) return renderMarketItem(head, decodeURIComponent(rest[0]));
      return renderMarket(head);
    }
    if (sub === 'profile') return renderProfile(false, head);
    if (sub === 'help') return renderMyHelps(head, rest);
    return renderFarmerOrders(head);
  }

  // ---- 注文の管理 ----
  function farmerOrderCards(list) {
    if (!list.length) return '<div class="empty">まだ注文はありません。</div>';
    return list.map(o => {
      const pickup = o.method === 'pickup';
      let act = '';
      const cash = o.payment === 'cash';
      const late = pickup && Date.now() >= new Date(`${o.pickup.date}T${String(o.pickup.hour + 1).padStart(2, '0')}:00:00+09:00`).getTime();
      const noshowBtn = cash && late && ['reserved', 'ready'].includes(o.status) ? ` <button class="btn ghost small" data-adv="${esc(o.id)}" data-to="noshow">来なかった</button>` : '';
      if (o.status === 'paid' || o.status === 'reserved') act = `
        <div class="small dim">お客さんは ${fmtDateTime(o.cancelDeadline)} までキャンセルできます。準備を始めると、キャンセルできなくなります。</div>
        <div><button class="btn corn small" data-adv="${esc(o.id)}" data-to="${pickup ? 'ready' : 'shipped'}">${pickup ? '準備できた' : '発送した'}</button>${noshowBtn}</div>`;
      else if (o.status === 'ready') act = `
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
          <input data-code-for="${esc(o.id)}" inputmode="numeric" maxlength="4" placeholder="受け取りコード" aria-label="受け取りコード" style="width:150px;padding:6px 12px;border:2px solid var(--ink);border-radius:999px;background:var(--surface-2)">
          <button class="btn leaf small" data-done="${esc(o.id)}">受け渡し完了</button>${noshowBtn}</div>`;
      else if (o.status === 'shipped') act = `<div><button class="btn leaf small" data-adv="${esc(o.id)}" data-to="done">お届け完了にする</button></div>`;
      return `
        <div class="order box">
          <div class="head"><b>${esc(o.buyer.name)} さん</b><span class="status ${esc(o.status)}">${esc(statusLabel(o))}</span></div>
          <div class="small">${pickup ? `🚗 <b>${fmtDay(o.pickup.date)} ${esc(o.pickup.time)}</b> に受け取り` : `📦 配送：〒${esc(o.ship.zip)} ${esc(o.ship.pref)} ${esc(o.ship.addr)}`}</div>
          <div class="small">${o.items.map(i => `${esc(i.name)}（${esc(i.unit)}）×${i.qty}`).join('、')}</div>
          ${pickup && o.pickup.msg ? `<div class="cheer small">💬 ${esc(o.pickup.msg)}</div>` : ''}
          <div class="small dim">📞 <a href="tel:${esc(String(o.buyer.tel).replace(/[^\d]/g, ''))}">${esc(o.buyer.tel)}</a> ・ ${yen(o.total)}${cash
            ? (o.status === 'canceled' ? '（予約取り消し）' : o.status === 'noshow' ? '（受け取りなし）' : o.status === 'done' ? '（現金で受け取り済み）' : ' <b>💴 受け取りのときに現金で</b>')
            : (o.status === 'canceled' ? '（キャンセル・返金済み）' : '（支払い済み）')}</div>
          ${act}
          ${o.status !== 'pending_payment' ? `<details class="chat-toggle" data-chat="${esc(o.id)}"><summary>💬 お客さんとのメッセージ</summary><div class="chat-slot"><div class="small dim">よみこみ中…</div></div></details>` : ''}
        </div>`;
    }).join('');
  }
  let farmerOrderList = [];
  async function renderFarmerOrders(head) {
    const f = DATA.mine;
    const list = await api.farmOrders(f.id);
    farmerOrderList = list;
    const bizList = await api.bizForFarm(f.id).catch(() => []);
    app.innerHTML = `
      ${head}
      ${api.mode === 'live' && !f.chargesEnabled ? `
        <div class="panel" style="margin:8px 0 16px">
          <h3 style="font-size:1rem">🏦 売上の受け取り口座を登録してください</h3>
          <p class="small" style="margin:6px 0 10px">${canCash(f) ? '畑での受け取り（現金払い）の予約は、いまでも受けられます。' : ''}カード払い・配送の注文を受けるには、売上を受け取る銀行口座の登録が必要です（Stripe という決済サービスの画面で、本人確認と口座を登録します）。</p>
          <button class="btn leaf" id="connectBtn">${f.stripeLinked ? '口座登録のつづきをする' : '受け取り口座を登録する'}</button>
        </div>` : ''}
      ${(() => {
        const missing = [];
        if (!f.sellerName || !f.sellerTel || !f.sellerAddr) missing.push('🧾 販売者情報（特定商取引法の表示に必要です）');
        if (canPickup(f) && !f.pickupAddr && !f.pickup.addr) missing.push('📍 受け取り場所の住所（受け取りのお客さんにお知らせします）');
        return missing.length ? `
        <div class="panel" style="margin:8px 0 16px">
          <h3 style="font-size:1rem">農園の情報を追加してください</h3>
          <ul class="small" style="margin:6px 0 10px;padding-left:1.2em">${missing.map(m => `<li>${m}</li>`).join('')}</ul>
          <a class="btn leaf" href="#/mine/profile">登録する</a>
        </div>` : '';
      })()}
      <h2 class="sec" style="margin-top:12px"><span class="ic">🧾</span>届いた注文</h2>
      <div class="order-list" id="farmerOrders">${farmerOrderCards(list)}</div>
      ${bizList.length ? `<h2 class="sec"><span class="ic">🏪</span>お店からの相談</h2><div class="order-list">${bizList.map(b => bizCard(b, true)).join('')}</div>` : ''}
      <p class="small dim" style="margin-top:16px"><a href="#/farm/${esc(f.id)}">お客さんから見た農園ページ →</a></p>`;
    const cn = $('#connectBtn');
    if (cn) cn.addEventListener('click', async () => {
      cn.disabled = true;
      try { const r = await api.connect('onboard'); openExternal(r.url, async () => { const st = await api.connect('status'); await reload(); toast(st.charges_enabled ? '口座の登録が完了しました！' : '口座の登録がまだ途中です'); route(); }); }
      catch (err) { toast(err.message); cn.disabled = false; }
    });
    bindBizCards(true, () => route());
    function bindOrders() {
      $$('[data-chat]').forEach(d => d.addEventListener('toggle', () => {
        if (!d.open) return;
        const o = farmerOrderList.find(x => x.id === d.dataset.chat);
        if (o) chatBox($('.chat-slot', d), o, true);
      }));
      $$('[data-adv]').forEach(b => b.addEventListener('click', async () => {
        if (b.dataset.to === 'noshow') { if (!(await ask('このお客さんは来なかったことにしますか？\n在庫は元に戻ります。来なかった予約が2回になると、その人は現金払いの予約ができなくなります。', '来なかった', true))) return; }
        else if (b.dataset.to !== 'done' && !(await ask('準備を始めると、お客さんはキャンセルできなくなります。よろしいですか？', b.dataset.to === 'ready' ? '準備できた' : '発送した'))) return;
        try { await api.updateOrder(b.dataset.adv, b.dataset.to); toast('更新しました'); } catch (err) { toast(err.message); }
        farmerOrderList = await api.farmOrders(f.id); $('#farmerOrders').innerHTML = farmerOrderCards(farmerOrderList); bindOrders(); updateBadge();
      }));
      $$('[data-done]').forEach(b => b.addEventListener('click', async () => {
        const input = $(`[data-code-for="${CSS.escape(b.dataset.done)}"]`);
        try { await api.updateOrder(b.dataset.done, 'done', input.value.trim()); toast('受け渡し完了！ありがとうございました'); }
        catch (err) { toast(err.message); input.focus(); return; }
        farmerOrderList = await api.farmOrders(f.id); $('#farmerOrders').innerHTML = farmerOrderCards(farmerOrderList); bindOrders(); updateBadge();
      }));
    }
    bindOrders();
  }

  // ---- 畑だより ----
  async function renderMyPosts(head) {
    const f = DATA.mine;
    const posts = (f.posts || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const cheers = await api.cheers(f.id);
    app.innerHTML = `
      ${head}
      <h2 class="sec" style="margin-top:12px"><span class="ic">✏️</span>畑だよりを書く</h2>
      <form class="panel" id="postForm">
        <div class="field"><label for="pTitle">ひとこと（タイトル）</label><input id="pTitle" maxlength="40" required placeholder="例：きゅうりの初収穫！"></div>
        <div class="field"><label for="pBody">本文</label><textarea id="pBody" maxlength="600" placeholder="今日の畑のようす、作業のこと、天気のこと…"></textarea></div>
        <div class="field"><span class="field-label">写真（1枚）</span><div id="postPhoto"></div></div>
        <div class="field"><span class="field-label">アイコン</span>
          <div class="emoji-pick">${EMOJIS.map(e => `<label><input type="radio" name="pEmoji" value="${e}" ${e === (EMOJIS.includes(f.emoji) ? f.emoji : EMOJIS[0]) ? 'checked' : ''}>${e}</label>`).join('')}</div>
        </div>
        <button class="btn" type="submit">投稿する</button>
      </form>
      <div class="posts" style="margin-top:12px">${posts.map(p => postItem(p, f, { deletable: true })).join('')}</div>
      <h2 class="sec"><span class="ic">💌</span>届いた声（${cheers.length}件）</h2>
      <div class="cheers">${cheers.length ? cheers.map(c => `<div class="cheer"><div class="meta">${esc(c.name || '匿名')} ・ ${fmtDate(c.date)}</div><p>${esc(c.text)}</p></div>`).join('') : '<div class="small dim">まだ届いていません。</div>'}</div>`;
    const photo = photoPicker($('#postPhoto'), [], 1, '写真を追加');
    $('#postForm').addEventListener('submit', async e => {
      e.preventDefault();
      const title = $('#pTitle').value.trim();
      if (!title) return;
      if (photo.busy()) { toast('写真のアップロード中です'); return; }
      try {
        await api.addPost(f.id, { emoji: ($('input[name=pEmoji]:checked') || {}).value || f.emoji, title, body: $('#pBody').value.trim(), photoUrl: photo.get()[0] || '' });
        await reload();
        toast('畑だよりを投稿しました');
        route();
      } catch (err) { toast('投稿できませんでした：' + (err.message || '')); }
    });
    $$('[data-del-post]').forEach(b => b.addEventListener('click', async () => {
      if (!(await ask('この投稿を削除しますか？', '削除する', true))) return;
      await api.deletePost(b.dataset.delPost);
      await reload();
      route();
    }));
  }

  // ---- なかま市（農家どうしの譲り合い・売買） ----
  function mkPrice(it) {
    if (it.kind === 'want') return 'さがしてます';
    if (it.kind === 'give' || !it.price) return '0円・ゆずります';
    return yen(it.price);
  }
  function mkCard(it, from) {
    const f = findFarm(it.farmId);
    const photo = safeUrl((it.photos || [])[0]);
    const d = from && f ? km(from, f) : null;
    return `
      <a class="card mk-card" href="#/mine/market/${esc(it.id)}">
        <div class="thumb ${photo ? 'has-photo' : ''}" style="${photo ? `background-image:url(${photo})` : 'background:var(--corn-soft)'}"><span class="em">${MK_EMOJI[it.cat] || '🧺'}</span>
          ${f ? `<span class="loc">📍 ${esc(f.city)}</span>` : ''}${typeof d === 'number' ? `<span class="dist">🚗 ${fmtKm(d)}</span>` : ''}${it.status !== 'open' ? `<span class="meet">${MK_STATUS[it.status]}</span>` : ''}</div>
        <div class="card-body">
          <div><span class="kind ${esc(it.kind)}">${MK_KIND[it.kind]}</span> <span class="tag plain">${MK_CAT[it.cat] || ''}</span></div>
          <h3>${esc(it.title)}</h3>
          <div class="mk-price">${esc(mkPrice(it))}</div>
          <div class="small dim">${f ? esc(f.farmName) : ''} ・ ${fmtDate(it.date)}</div>
        </div>
      </a>`;
  }
  async function renderMarket(head) {
    const me = DATA.mine;
    const list = await api.marketList();
    app.innerHTML = `
      ${head}
      <section class="hero-intro" style="margin-top:8px"><span class="float a">🤝</span>
        <h1>なかま市</h1>
        <p>農具・農機・資材・種や苗を、山口の農家どうしで譲り合ったり売り買いしたりできます。登録した農家さんだけが見られます。</p>
      </section>
      <div class="actions"><a class="btn" href="#/mine/market/new">＋ 出品する／さがしてる物を出す</a></div>
      <div class="chips" id="mkKind" style="margin-top:14px">
        <button class="chip ${state.mkKind === 'all' ? 'on' : ''}" data-k="all">すべて</button>
        ${Object.entries(MK_KIND).map(([k, v]) => `<button class="chip ${state.mkKind === k ? 'on' : ''}" data-k="${k}">${v}</button>`).join('')}
        <button class="chip ${state.mkKind === 'mine' ? 'on' : ''}" data-k="mine">自分の出品</button>
      </div>
      <div class="chips" id="mkCat">
        <button class="chip leaf ${state.mkCat === 'all' ? 'on' : ''}" data-c="all">ぜんぶ</button>
        ${Object.entries(MK_CAT).map(([k, v]) => `<button class="chip leaf ${state.mkCat === k ? 'on' : ''}" data-c="${k}">${MK_EMOJI[k]} ${v}</button>`).join('')}
      </div>
      <div class="grid" id="mkList"></div>
      <p class="notice">お金のやりとりと受け渡しは、当事者どうしで直接行ってください。農機などは、受け渡しのときに動作を確かめてから支払うと安心です。</p>`;
    function draw() {
      const shown = list.filter(it =>
        (state.mkKind === 'all' || (state.mkKind === 'mine' ? it.ownerId === api.meId() : it.kind === state.mkKind)) &&
        (state.mkCat === 'all' || it.cat === state.mkCat))
        .map(it => ({ it, d: (findFarm(it.farmId) ? km(me, findFarm(it.farmId)) : 9999) }))
        .sort((a, b) => (a.it.status === 'closed') - (b.it.status === 'closed') || a.d - b.d);
      $('#mkList').innerHTML = shown.length ? shown.map(x => mkCard(x.it, me)).join('') : '<div class="empty">まだありません。最初の出品をしてみませんか？</div>';
    }
    $$('#mkKind [data-k]').forEach(b => b.addEventListener('click', () => { state.mkKind = b.dataset.k; $$('#mkKind [data-k]').forEach(x => x.classList.toggle('on', x === b)); draw(); }));
    $$('#mkCat [data-c]').forEach(b => b.addEventListener('click', () => { state.mkCat = b.dataset.c; $$('#mkCat [data-c]').forEach(x => x.classList.toggle('on', x === b)); draw(); }));
    draw();
  }
  function renderMarketNew(head) {
    app.innerHTML = `
      ${head}
      <a class="back" href="#/mine/market">← なかま市へ</a>
      <h2 class="sec"><span class="ic">📝</span>出品する</h2>
      <form class="panel" id="mkForm" novalidate>
        <div class="field"><span class="field-label">種類</span>
          <div class="choice">
            ${Object.entries(MK_KIND).map(([k, v], i) => `<label><input type="radio" name="mkKind" value="${k}" ${i === 0 ? 'checked' : ''}><span class="t">${v}<small>${{ give: '無料でゆずる', sell: '値段をつけて売る', want: 'ほしい物を伝える' }[k]}</small></span><span></span></label>`).join('')}
          </div></div>
        <div class="field"><label for="mkCatSel">分類</label><select id="mkCatSel">${Object.entries(MK_CAT).map(([k, v]) => `<option value="${k}">${MK_EMOJI[k]} ${v}</option>`).join('')}</select></div>
        <div class="field"><label for="mkTitle">タイトル *</label><input id="mkTitle" maxlength="40" placeholder="例：管理機（ミニ耕うん機）"></div>
        <div class="field" id="mkPriceField" hidden><label for="mkPrice">値段（円）*</label><input id="mkPrice" type="number" inputmode="numeric" min="1" max="10000000" step="100" placeholder="例：30000"></div>
        <div class="field"><label for="mkCond">状態</label><input id="mkCond" maxlength="30" placeholder="例：中古・動作良好 ／ 未使用"></div>
        <div class="field"><label for="mkBody">くわしく</label><textarea id="mkBody" maxlength="800" placeholder="使っていた年数、サイズ、受け渡しできる場所や日時など"></textarea></div>
        <div class="field"><span class="field-label">写真（3枚まで）</span><div id="mkPhotos"></div></div>
        <div class="notice small">
          <b>出品できないもの</b>
          <ul style="margin:4px 0 0;padding-left:1.2em">
            <li>農薬（無料でゆずるのもできません）</li>
            <li>肥料を値段をつけて売ること（ゆずるのは可）</li>
            <li>登録品種の種・苗を自分で増やしたもの</li>
            <li>盗品、危ない物、法律で許可が必要な物（許可がない場合）</li>
          </ul>
          <div style="margin-top:4px">中古品をくり返し仕入れて売る場合は、古物商の許可が必要です。</div>
        </div>
        <label style="display:flex;gap:8px;align-items:center;margin:10px 0;font-weight:700"><input type="checkbox" id="mkAgree" style="width:auto"> 出品できないものではないことを確認しました</label>
        <button class="btn" type="submit" id="mkSave">出品する</button>
      </form>`;
    const photos = photoPicker($('#mkPhotos'), [], 3, '写真を追加');
    const kind = () => ($('input[name=mkKind]:checked') || {}).value;
    const sync = () => { $('#mkPriceField').hidden = kind() !== 'sell'; $('#mkCond').closest('.field').hidden = kind() === 'want'; };
    $$('input[name=mkKind]').forEach(r => r.addEventListener('change', sync));
    sync();
    $('#mkForm').addEventListener('submit', async e => {
      e.preventDefault();
      const title = $('#mkTitle').value.trim();
      const k = kind();
      if (k !== 'want' && !$('#mkAgree').checked) { toast('出品できないものではないことを確認して、チェックを入れてください'); $('#mkAgree').focus(); return; }
      const price = k === 'sell' ? Number($('#mkPrice').value) : (k === 'give' ? 0 : null);
      if (!title) { toast('タイトルを入力してください'); $('#mkTitle').focus(); return; }
      if (k === 'sell' && !(price > 0)) { toast('値段を入力してください'); $('#mkPrice').focus(); return; }
      if (photos.busy()) { toast('写真のアップロード中です'); return; }
      $('#mkSave').disabled = true;
      try {
        const id = await api.marketSave(DATA.mine.id, { kind: k, cat: $('#mkCatSel').value, title, body: $('#mkBody').value.trim(), price, condition: k === 'want' ? '' : $('#mkCond').value.trim(), photos: photos.get() });
        toast('出品しました');
        location.hash = `#/mine/market/${id}`;
      } catch (err) { toast('出品できませんでした：' + (err.message || '')); $('#mkSave').disabled = false; }
    });
  }
  async function renderMarketItem(head, id) {
    const it = await api.marketItem(id);
    if (!it) { app.innerHTML = `${head}<a class="back" href="#/mine/market">← なかま市へ</a><div class="empty">見つかりませんでした（削除された可能性があります）。</div>`; return; }
    const f = findFarm(it.farmId);
    const mine = it.ownerId === api.meId();
    const msgs = await api.marketMessages(it.id);
    const photos = (it.photos || []).map(safeUrl).filter(Boolean);
    const nameOf = buyerId => { const bf = DATA.farms.find(x => x.ownerId === buyerId); return bf ? bf.farmName : '農家さん'; };
    let threadHtml;
    if (mine) {
      const byBuyer = {};
      msgs.forEach(m => { (byBuyer[m.buyerId] = byBuyer[m.buyerId] || []).push(m); });
      const ids = Object.keys(byBuyer);
      threadHtml = ids.length ? ids.map(b => `
        <div class="panel" style="margin-bottom:12px">
          <b>${esc(nameOf(b))}</b>
          <div class="thread" style="margin-top:8px">${byBuyer[b].map(m => `<div class="msg ${m.mine ? 'me' : ''}"><div class="meta">${m.mine ? 'あなた' : esc(nameOf(b))} ・ ${fmtDateTime(m.date)}</div>${esc(m.text)}</div>`).join('')}</div>
          <form class="msg-form" data-buyer="${esc(b)}"><input maxlength="500" placeholder="返信する" aria-label="返信"><button class="btn small" type="submit">送る</button></form>
        </div>`).join('') : '<div class="small dim">まだメッセージは届いていません。</div>';
    } else {
      threadHtml = `
        <div class="panel">
          <div class="thread">${msgs.length ? msgs.map(m => `<div class="msg ${m.mine ? 'me' : ''}"><div class="meta">${m.mine ? 'あなた' : esc(f ? f.farmName : '出品者')} ・ ${fmtDateTime(m.date)}</div>${esc(m.text)}</div>`).join('') : `<div class="small dim">${it.kind === 'want' ? '持っていたら、声をかけてみましょう。' : '気になったら、メッセージを送ってみましょう。'}</div>`}</div>
          ${it.status === 'closed' ? '<p class="small dim">この取引は終了しました。</p>' : `<form class="msg-form" data-buyer="${esc(api.meId())}"><input maxlength="500" placeholder="${it.kind === 'want' ? '例：うちに使ってないのがありますよ' : '例：まだありますか？ ○日に取りに行けます'}" aria-label="メッセージ"><button class="btn small" type="submit">送る</button></form>`}
        </div>`;
    }
    app.innerHTML = `
      ${head}
      <a class="back" href="#/mine/market">← なかま市へ</a>
      ${photos.length ? `<div class="mk-photos">${photos.map(u => `<img src="${esc(u)}" alt="">`).join('')}</div>` : ''}
      <div class="panel" style="margin-top:12px">
        <div><span class="kind ${esc(it.kind)}">${MK_KIND[it.kind]}</span> <span class="tag plain">${MK_EMOJI[it.cat]} ${MK_CAT[it.cat] || ''}</span> ${it.status !== 'open' ? `<span class="status ${it.status === 'closed' ? 'canceled' : 'ready'}">${MK_STATUS[it.status]}</span>` : ''}</div>
        <h1 style="font-size:1.3rem;margin-top:8px">${esc(it.title)}</h1>
        <div class="mk-price" style="margin:4px 0">${esc(mkPrice(it))}</div>
        ${it.condition ? `<div class="small"><b>状態：</b>${esc(it.condition)}</div>` : ''}
        ${it.body ? `<p style="white-space:pre-wrap">${esc(it.body)}</p>` : ''}
        <div class="small dim">${f ? `<a href="#/farm/${esc(f.id)}">${esc(f.farmName)}</a>（${esc(f.city)}${DATA.mine && f.id !== DATA.mine.id ? ` ・ 🚗 ${fmtKm(km(DATA.mine, f))}` : ''}）` : ''} ・ ${fmtDate(it.date)}</div>
        ${mine ? `<div class="actions">
          ${Object.entries(MK_STATUS).map(([k, v]) => `<button class="btn small ${it.status === k ? 'leaf' : 'ghost'}" data-st="${k}">${v}</button>`).join('')}
          <button class="btn small danger" id="mkDel">削除</button></div>` : ''}
      </div>
      <h2 class="sec"><span class="ic">💬</span>${mine ? '届いたメッセージ' : (f ? `${esc(f.farmName)}さんとのメッセージ` : 'メッセージ')}</h2>
      ${threadHtml}
      ${api.mode === 'demo' ? '<p class="notice">お試し版のため、メッセージはこの端末の中にだけ保存されます。</p>' : '<p class="small dim" style="margin-top:12px">電話番号や住所は、相手を確かめてから伝えるようにしましょう。</p>'}`;
    $$('.msg-form').forEach(fm => fm.addEventListener('submit', async e => {
      e.preventDefault();
      const input = $('input', fm);
      const text = input.value.trim();
      if (!text) return;
      try { await api.marketSend(it.id, fm.dataset.buyer, text); renderMarketItem(head, id); }
      catch (err) { toast('送れませんでした：' + (err.message || '')); }
    }));
    $$('[data-st]').forEach(b => b.addEventListener('click', async () => {
      try { await api.marketStatus(it.id, b.dataset.st); toast('更新しました'); renderMarketItem(head, id); } catch (err) { toast(err.message); }
    }));
    const del = $('#mkDel');
    if (del) del.addEventListener('click', async () => {
      if (!(await ask('この出品を削除しますか？メッセージも消えます。', '削除する', true))) return;
      try { await api.marketDelete(it.id); toast('削除しました'); go('#/mine/market'); } catch (err) { toast(err.message); }
    });
  }

  // ---- プロフィール（農園の登録・編集） ----
  async function renderProfile(isNew, head) {
    const existing = DATA.mine;
    const f = existing ? JSON.parse(JSON.stringify(existing)) : blankFarm();
    if (!f.pickup || !('enabled' in f.pickup)) f.pickup = blankFarm().pickup;
    if (!draftProducts) draftProducts = (f.products || []).map(p => Object.assign({}, p));
    const hours = Array.from({ length: 17 }, (_, i) => i + 5);

    app.innerHTML = `
      ${head || ''}
      ${isNew ? `<section class="hero-intro"><span class="float a">👩‍🌾</span><span class="float b">🌱</span>
        <h1>農園を登録しよう</h1>
        <p>畑の場所、育てているもの、そしてあなたの想いを書いてください。上手な文章じゃなくて大丈夫です。登録すると、注文の受け付け・畑だより・なかま市が使えます。</p>
      </section>` : ''}

      <h2 class="sec"><span class="ic">🏡</span>${existing ? 'プロフィールを編集' : '基本情報'}</h2>
      <form class="panel" id="farmForm" novalidate>
        <div class="row2">
          <div class="field"><label for="fName">農園名 *</label><input id="fName" maxlength="40" value="${esc(f.farmName)}" placeholder="例：さとう農園"></div>
          <div class="field"><label for="fFarmer">お名前 *</label><input id="fFarmer" maxlength="40" value="${esc(f.farmer)}" placeholder="例：佐藤 太郎"></div>
        </div>
        <div class="field"><span class="field-label">畑の写真（農園ページのトップに出ます）</span><div id="coverPick"></div></div>
        <div class="field"><label for="fCity">市町 *</label>
          <select id="fCity"><option value="">えらんでください</option>
            ${Object.entries(REGIONS).map(([rk, rv]) => `<optgroup label="${rv}">${CITY_NAMES.filter(c => REGION_OF[c] === rk).map(c => `<option ${f.city === c ? 'selected' : ''}>${c}</option>`).join('')}</optgroup>`).join('')}
          </select></div>
        <div class="field">
          <span class="field-label">畑の位置</span>
          <span class="hint">地図をタップして、畑のだいたいの位置を指定してください。2本指やダブルタップで拡大すると、道や地名が見えます。指定しない場合は市町の中心あたりに表示されます。</span>
          <div id="pickMap"></div>
          <span class="hint" id="pickInfo">${f.latPicked ? '📍 指定済み' : 'まだ指定されていません'}</span>
        </div>
        <div class="row2">
          <div class="field"><label for="fSince">農業を始めた年</label><input id="fSince" type="number" inputmode="numeric" min="1900" max="${new Date().getFullYear()}" value="${esc(f.since)}" placeholder="例：2015"></div>
          <div class="field"><label for="fArea">畑の広さ</label><input id="fArea" maxlength="20" value="${esc(f.area)}" placeholder="例：1.5ha / 30a"></div>
        </div>
        <div class="field"><span class="field-label">農園のアイコン</span>
          <div class="emoji-pick">${EMOJIS.map(e => `<label><input type="radio" name="fEmoji" value="${e}" ${f.emoji === e ? 'checked' : ''}>${e}</label>`).join('')}</div>
        </div>

        <h3 style="margin:20px 0 8px;font-size:1rem">💬 あなたの想い</h3>
        <div class="field"><label for="fCatch">ひとことで言うと？ *</label><input id="fCatch" maxlength="50" value="${esc(f.catch)}" placeholder="例：完熟まで待つ。それだけは譲れません。"></div>
        <div class="field"><label for="fStory">どんな想いで作っていますか？ *</label>
          <span class="hint">農業を始めたきっかけ、大切にしていること、食べる人に伝えたいこと。山口弁のままでOK！</span>
          <textarea id="fStory" maxlength="1500" style="min-height:160px">${esc(f.story)}</textarea></div>

        <h3 style="margin:20px 0 8px;font-size:1rem">🌱 育て方</h3>
        <div class="row2">
          <div class="field"><label for="fPest">農薬</label>
            <select id="fPest">${Object.entries(PESTICIDE).map(([k, v]) => `<option value="${k}" ${f.methods.pesticide === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></div>
          <div class="field"><label for="fFert">化学肥料</label>
            <select id="fFert">${Object.entries(FERTILIZER).map(([k, v]) => `<option value="${k}" ${f.methods.fertilizer === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        </div>
        <div class="row2">
          <div class="field"><label for="fStyle">栽培方式</label>
            <select id="fStyle">${STYLES.map(s => `<option ${f.methods.style === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
          <div class="field"><label for="fCerts">認証など（カンマ区切り）</label><input id="fCerts" maxlength="80" value="${esc((f.certs || []).join(', '))}" placeholder="例：有機JAS, エコやまぐち"></div>
        </div>
        <div class="field"><label for="fSoil">こだわり</label><textarea id="fSoil" maxlength="400" placeholder="例：落ち葉堆肥で土づくり。">${esc(f.methods.soil)}</textarea></div>

        <h3 style="margin:20px 0 8px;font-size:1rem">🧊 保管と鮮度</h3>
        <p class="small dim" style="margin:0 0 10px">収穫してからどう保管しているかを書くと、お客さんが安心して買えます。農園ページに表示します。</p>
        ${(() => { const st = f.storage || {}; return `
        <div class="field"><label for="stFresh">収穫からお届けまで</label>
          <select id="stFresh"><option value="">えらばない</option>${Object.entries(FRESH).map(([k, v]) => `<option value="${k}" ${st.fresh === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div class="field"><span class="field-label">保管のしかた（いくつでも）</span>
          <div class="checks">${Object.entries(STORE_WAYS).map(([k, v]) => `<label><input type="checkbox" name="stWay" value="${k}" ${(st.ways || []).includes(k) ? 'checked' : ''}> ${v}</label>`).join('')}</div></div>
        <div class="row2">
          <div class="field"><label for="stTemp">温度（わかれば）</label><input id="stTemp" maxlength="30" value="${esc(st.temp || '')}" placeholder="例：5℃前後"></div>
          <div class="field"><label for="stShip">配送のとき</label><select id="stShip"><option value="">えらばない</option>${Object.entries(SHIP_TEMP).map(([k, v]) => `<option value="${k}" ${st.ship === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
            <span class="hint">クール便にする場合は、その送料も配送の価格に含めてください。</span></div>
        </div>
        <div class="field"><span class="field-label">保管している場所の写真（あれば）</span><div id="stPhotoPick"></div></div>
        <div class="field"><label for="stNote">ひとこと</label><textarea id="stNote" maxlength="300" placeholder="例：朝どれを予冷庫で冷やしてから、その日のうちに発送します。">${esc(st.note || '')}</textarea></div>`; })()}

        <h3 style="margin:20px 0 8px;font-size:1rem">🚗 畑での受け取り</h3>
        <div class="field"><label style="display:flex;gap:8px;align-items:center;font-weight:900"><input type="checkbox" id="pkOn" style="width:auto" ${f.pickup.enabled ? 'checked' : ''}> 畑での受け取りを受け付ける</label>
          <span class="hint">お客さんが畑まで取りに来ます。送料がかからない分、配送より安い価格を設定できます。</span></div>
        <div id="pkFields">
          <div class="field"><label for="pkAddr">受け取り場所の住所 *</label><input id="pkAddr" maxlength="120" autocomplete="street-address" value="${esc(f.pickupAddr || f.pickup.addr || '')}" placeholder="例：山口市徳地堀 1234">
            <span class="hint">畑で受け取る注文をしたお客さんにだけ、注文画面でお知らせします。</span>
            <label style="display:flex;gap:8px;align-items:center;margin-top:8px;font-weight:700"><input type="checkbox" id="pkAddrPublic" style="width:auto" ${f.pickup.addr ? 'checked' : ''}> 農園ページにも住所をのせる（誰でも見られます）</label>
            <span class="hint">ご自宅の場合は、のせないことをおすすめします。のせると、注文前のお客さんにも場所が分かります。</span></div>
          <div class="field"><label for="pkPlace">場所の目印</label><input id="pkPlace" maxlength="80" value="${esc(f.pickup.place)}" placeholder="例：畑の横の直売小屋（青い屋根）"></div>
          <div class="field"><span class="field-label">受け取りできる曜日</span>
            <div class="weekdays">${WEEK.map((w, i) => `<label><input type="checkbox" name="pkDay" value="${i}" ${(f.pickup.days || []).includes(i) ? 'checked' : ''}>${w}</label>`).join('')}</div></div>
          <div class="row2">
            <div class="field"><label for="pkFrom">何時から</label><select id="pkFrom">${hours.map(h => `<option value="${h}" ${f.pickup.from === h ? 'selected' : ''}>${h}:00</option>`).join('')}</select></div>
            <div class="field"><label for="pkTo">何時まで</label><select id="pkTo">${hours.map(h => `<option value="${h}" ${f.pickup.to === h ? 'selected' : ''}>${h}:00</option>`).join('')}</select></div>
          </div>
          <div class="field"><label style="display:flex;gap:8px;align-items:center;font-weight:900"><input type="checkbox" id="pkCash" style="width:auto" ${f.pickup.cash ? 'checked' : ''}> 受け取りのときの現金払いも受け付ける</label>
            <span class="hint">手数料がかからず、売上がまるごと手元に残ります。前払いではないので、来ない人がいるかもしれません（連絡なく来なかったら「来なかった」を押してください。2回でその人は現金払いの予約ができなくなります）。口座の登録前でも、現金払いの予約は受けられます。</span></div>
          <div class="field"><label for="pkNote">お客さんへひとこと</label><input id="pkNote" maxlength="80" value="${esc(f.pickup.note)}" placeholder="例：収穫体験もできます！"></div>
        </div>

        <h3 style="margin:20px 0 8px;font-size:1rem">📦 配送</h3>
        <div class="field"><label for="fShipDays">注文から発送までの目安</label>
          <select id="fShipDays">${[1, 2, 3, 4, 5, 7, 10, 14].map(d => `<option value="${d}" ${shipDaysOf(f) === d ? 'selected' : ''}>注文から${d}日以内に発送</option>`).join('')}</select>
          <span class="hint">注文手続きの画面と「特定商取引法に基づく表記」に表示します。</span></div>

        <h3 style="margin:20px 0 8px;font-size:1rem">🧾 販売者情報（特定商取引法の表示） *</h3>
        <p class="small dim" style="margin:0 0 10px">ネットで販売するときに法律で必要な情報です。<b>氏名だけ</b>農園ページに表示します。住所・電話番号は公開せず、お客さんから請求があったときに運営からお伝えします。</p>
        <div class="field"><label for="sName">販売者の氏名（法人の場合は法人名）</label><input id="sName" maxlength="60" autocomplete="name" value="${esc(f.sellerName || '')}" placeholder="例：山口 太郎"></div>
        <div class="row2">
          <div class="field"><label for="sTel">電話番号</label><input id="sTel" type="tel" maxlength="13" autocomplete="tel" value="${esc(f.sellerTel || '')}" placeholder="090-0000-0000"></div>
          <div class="field"><label for="sAddr">住所</label><input id="sAddr" maxlength="120" autocomplete="street-address" value="${esc(f.sellerAddr || '')}" placeholder="山口市徳地堀 1234"></div>
        </div>
        <p class="small dim" style="margin:0 0 6px">運営の手数料は<b>0円</b>です。カード払いで売れたときだけ、カード会社などに払う決済手数料（売上の${FEE_PERCENT}%）が差し引かれ、残りが Stripe を通じて登録した口座に振り込まれます。現金払いの受け取りには、手数料はかかりません。</p>

        <h3 style="margin:20px 0 8px;font-size:1rem">🏪 お店・飲食店からの相談</h3>
        <div class="field"><label style="display:flex;gap:8px;align-items:center;font-weight:900"><input type="checkbox" id="fBiz" style="width:auto" ${f.bizOk ? 'checked' : ''}> まとめ買い・仕入れの相談を受け付ける</label>
          <input id="fBizNote" maxlength="200" value="${esc(f.bizNote || '')}" placeholder="例：規格外品のまとめ売りもできます。週1回までお店に届けられます" style="margin-top:6px">
          <span class="hint">お店からの相談がアプリに届きます。値段・お支払い・届け方は、お店と直接決めてください（手数料はかかりません）。</span></div>

        <h3 style="margin:20px 0 8px;font-size:1rem">↩️ キャンセルの受け付け</h3>
        <div class="field"><label for="fCancel">お客さんが自分でキャンセルできる期間</label>
          <select id="fCancel">${[1, 2, 3].map(d => `<option value="${d}" ${Number(f.cancelDays || 2) === d ? 'selected' : ''}>注文から${d}日以内</option>`).join('')}</select>
          <span class="hint">期間内でも、あなたが「準備できた」「発送した」を押した後はキャンセルできません。畑で受け取りの場合は、受け取り日の前日までです。</span></div>

        <h3 style="margin:20px 0 8px;font-size:1rem">🧺 売るもの *</h3>
        <div class="prod-list" id="prodList"></div>
        <div class="panel soft" id="prodEditor">
          <div class="row2">
            <div class="field"><label for="nName">品目名</label><input id="nName" maxlength="30" placeholder="例：ミニトマト"></div>
            <div class="field"><label for="nCat">種類</label><select id="nCat">${Object.entries(CATS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
          </div>
          <div class="row2">
            <div class="field"><label for="nUnit">1セットの量</label><input id="nUnit" maxlength="30" placeholder="例：2kg箱 / 3本入り"></div>
            <div class="field"><label for="nStock">在庫（セット数）</label><input id="nStock" type="number" inputmode="numeric" min="0" max="9999" value="10"></div>
          </div>
          <div class="row2">
            <div class="field"><label for="nShip">県内配送の価格（送料込み・税込）</label><input id="nShip" type="number" inputmode="numeric" min="0" step="10" placeholder="例：2500"><span class="hint">山口県内への送料を含めた金額にしてください。</span></div>
            <div class="field"><label for="nPick">畑で受け取りの価格（税込）</label><input id="nPick" type="number" inputmode="numeric" min="0" step="10" placeholder="例：2000"></div>
          </div>
          <div class="field"><span class="field-label">お届けできる月</span>
            <div class="months" id="nMonths">${MONTHS.map(mm => `<label><input type="checkbox" value="${mm}">${mm}月</label>`).join('')}</div></div>
          <div class="field"><label for="nNote">ひとことメモ</label><input id="nNote" maxlength="40" placeholder="例：皮ごと食べられます"></div>
          <p class="small dim" style="margin:0 0 10px">⚠️ 漬物・ジャム・干し柿・もちなどの<b>加工品</b>は、保健所の営業許可と食品表示が必要です。許可を持っている場合だけ登録してください。お米は、産地・品種・産年・精米した日をメモに書いてください。</p>
          <button class="btn corn small" type="button" id="addProd">＋ この品目を追加</button>
          <button class="btn ghost small" type="button" id="cancelEdit" hidden>編集をやめる</button>
        </div>

        <div class="actions">
          <button class="btn" type="submit" id="saveFarm">${existing ? '変更を保存' : '登録して公開する'}</button>
          ${existing ? '<button class="btn danger" type="button" id="deleteFarm">農園の登録を削除</button>' : ''}
        </div>
      </form>
      ${api.mode === 'demo' ? '<p class="notice">お試し版のため、登録内容と注文はこの端末のブラウザ内にだけ保存されます。</p>' : ''}
      ${accountFooterWithLegal()}
    `;
    bindAccount(() => route());
    const cover = photoPicker($('#coverPick'), f.coverUrl ? [f.coverUrl] : [], 1, '畑の写真');
    const stPhoto = photoPicker($('#stPhotoPick'), f.storage && f.storage.photo ? [f.storage.photo] : [], 1, '保管場所の写真');

    // 位置
    let picked = f.latPicked && typeof f.lat === 'number' ? [f.lat, f.lng] : null;
    const pm = YMap($('#pickMap'), {
      small: true, pickable: true, picked, focusCity: f.city,
      initial: m => { if (picked) m.showAround(picked[0], picked[1], 3); else if (f.city) m.showCity(f.city); else m.showAll(); },
      onPick: p => { picked = p; $('#pickInfo').textContent = '📍 指定しました'; }
    });
    $('#fCity').addEventListener('change', e => {
      if (!CITY_CENTER[e.target.value]) return;
      pm.highlightCity(e.target.value);
      if (!picked) pm.showCity(e.target.value);
    });

    const togglePk = () => { $('#pkFields').hidden = !$('#pkOn').checked; $('#nPick').disabled = !$('#pkOn').checked; };
    $('#pkOn').addEventListener('change', togglePk);
    togglePk();

    function drawProducts() {
      const pkOn = $('#pkOn').checked;
      $('#prodList').innerHTML = draftProducts.length ? draftProducts.map((p, i) => `
        <div class="prod-item"><span><b>${esc(p.name)}</b>（${esc(p.unit)}）<br><span class="dim small">${p.months.length === 12 ? '通年' : p.months.map(mm => mm + '月').join(' ')} ・ 配送${yen(p.shipPrice)}${pkOn ? ` / 受取${yen(p.pickupPrice)}` : ''} ・ 在庫${Number(p.stock) || 0}</span></span>
        <button class="btn ghost small" type="button" data-ed="${i}">編集</button>
        <button class="btn danger small" type="button" data-rm="${i}">削除</button></div>`).join('')
        : '<div class="small dim">まだ品目がありません。下のフォームから追加してください。</div>';
      $$('#prodList [data-rm]').forEach(b => b.addEventListener('click', () => { draftProducts.splice(Number(b.dataset.rm), 1); resetEditor(); drawProducts(); }));
      $$('#prodList [data-ed]').forEach(b => b.addEventListener('click', () => loadEditor(Number(b.dataset.ed))));
    }
    $('#pkOn').addEventListener('change', drawProducts);
    function resetEditor() {
      editingIdx = -1;
      ['#nName', '#nUnit', '#nShip', '#nPick', '#nNote'].forEach(s => { $(s).value = ''; });
      $('#nStock').value = 10;
      $$('#nMonths input').forEach(i => { i.checked = false; });
      $('#addProd').textContent = '＋ この品目を追加';
      $('#cancelEdit').hidden = true;
    }
    function loadEditor(i) {
      const p = draftProducts[i];
      editingIdx = i;
      $('#nName').value = p.name; $('#nCat').value = p.cat; $('#nUnit').value = p.unit || '';
      $('#nStock').value = Number(p.stock) || 0; $('#nShip').value = p.shipPrice; $('#nPick').value = p.pickupPrice; $('#nNote').value = p.note || '';
      $$('#nMonths input').forEach(x => { x.checked = p.months.includes(Number(x.value)); });
      $('#addProd').textContent = '✓ この内容で更新';
      $('#cancelEdit').hidden = false;
      $('#prodEditor').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    $('#cancelEdit').addEventListener('click', resetEditor);
    drawProducts();

    // 品目を追加する（成功したら true）。「登録」ボタンからも呼ぶ
    function addProductFromEditor(quiet) {
      const name = $('#nName').value.trim();
      const months = $$('#nMonths input:checked').map(i => Number(i.value));
      const ship = Number($('#nShip').value);
      const pickOn = $('#pkOn').checked;
      const pick = pickOn ? Number($('#nPick').value) : ship;
      const fail = (msg, el) => { toast(msg); if (el) { el.focus(); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } else $('#nMonths').scrollIntoView({ behavior: 'smooth', block: 'center' }); return false; };
      if (!name) return fail('品目名を入力してください', $('#nName'));
      if (!$('#nUnit').value.trim()) return fail('1セットの量を入力してください', $('#nUnit'));
      if (!(ship > 0)) return fail('県内配送の価格（送料込み）を入力してください', $('#nShip'));
      if (pickOn && !(pick > 0)) return fail('畑で受け取りの価格を入力してください', $('#nPick'));
      if (pick > ship) return fail('受け取りの価格は、配送の価格以下にしてください', $('#nPick'));
      if (!months.length) return fail('お届けできる月を1つ以上選んでください');
      const prev = editingIdx >= 0 ? draftProducts[editingIdx] : null;
      const p = { id: prev ? prev.id : 'new-' + uid(), name, cat: $('#nCat').value, months, note: $('#nNote').value.trim(), unit: $('#nUnit').value.trim(), shipPrice: ship, pickupPrice: pick, stock: Math.max(0, Number($('#nStock').value) || 0) };
      if (prev) draftProducts[editingIdx] = p; else draftProducts.push(p);
      resetEditor();
      drawProducts();
      if (!quiet) toast(prev ? '品目を更新しました（保存ボタンで確定）' : '品目を追加しました（保存ボタンで確定）');
      return true;
    }
    $('#addProd').addEventListener('click', () => addProductFromEditor(false));

    $('#farmForm').addEventListener('submit', async e => {
      e.preventDefault();
      const need = [['#fName', '農園名'], ['#fFarmer', 'お名前'], ['#fCity', '市町'], ['#fCatch', 'ひとこと'], ['#fStory', '想い']];
      const miss = need.find(([s]) => !$(s).value.trim());
      if (miss) { toast(`${miss[1]}を入力してください`); $(miss[0]).focus(); return; }
      // 品目を入力したまま「＋ この品目を追加」を押し忘れていたら、ここで追加する
      if ($('#nName').value.trim() && !addProductFromEditor(true)) return;
      if (!draftProducts.length) { toast('売るものを1つ以上追加してください'); $('#nName').focus(); return; }
      if (cover.busy()) { toast('写真のアップロード中です'); return; }
      const pkOn = $('#pkOn').checked;
      const pkDays = $$('input[name=pkDay]:checked').map(i => Number(i.value));
      const from = Number($('#pkFrom').value), to = Number($('#pkTo').value);
      const sellerName = $('#sName').value.trim(), sellerTel = $('#sTel').value.trim(), sellerAddr = $('#sAddr').value.trim();
      if (!sellerName) { toast('販売者の氏名を入力してください'); $('#sName').focus(); return; }
      if (!TEL_RE.test(sellerTel)) { toast('販売者の電話番号を確認してください'); $('#sTel').focus(); return; }
      if (!sellerAddr) { toast('販売者の住所を入力してください'); $('#sAddr').focus(); return; }
      const pkAddr = $('#pkAddr').value.trim();
      if (pkOn && !pkAddr) { toast('受け取り場所の住所を入力してください'); $('#pkAddr').focus(); return; }
      if (pkOn && !pkDays.length) { toast('受け取りできる曜日を選んでください'); return; }
      if (pkOn && to <= from) { toast('受け取り時間の「まで」は「から」より後にしてください'); $('#pkTo').focus(); return; }
      if (pkOn && draftProducts.some(p => !(p.pickupPrice > 0) || p.pickupPrice > p.shipPrice)) { toast('畑で受け取りの価格が未設定の品目があります。「編集」から設定してください'); return; }
      const city = $('#fCity').value;
      const pos = picked || CITY_CENTER[city];
      const emoji = ($('input[name=fEmoji]:checked') || {}).value || '🥬';
      const saved = Object.assign({}, f, {
        farmName: $('#fName').value.trim(), farmer: $('#fFarmer').value.trim(), city,
        lat: pos[0], lng: pos[1], latPicked: !!picked, coverUrl: cover.get()[0] || '',
        since: $('#fSince').value ? Number($('#fSince').value) : '', area: $('#fArea').value.trim(),
        emoji, hue: Math.max(0, EMOJIS.indexOf(emoji)) % HUES.length,
        catch: $('#fCatch').value.trim(), story: $('#fStory').value.trim(),
        methods: { pesticide: $('#fPest').value, fertilizer: $('#fFert').value, style: $('#fStyle').value, soil: $('#fSoil').value.trim() },
        storage: { fresh: $('#stFresh').value, ways: $$('input[name=stWay]:checked').map(i => i.value), temp: $('#stTemp').value.trim(), ship: $('#stShip').value, photo: stPhoto.get()[0] || '', note: $('#stNote').value.trim() },
        certs: $('#fCerts').value.split(/[,、，]/).map(s => s.trim()).filter(Boolean),
        pickup: { enabled: pkOn, place: $('#pkPlace').value.trim(), addr: $('#pkAddrPublic').checked ? pkAddr : '', cash: $('#pkCash').checked, days: pkDays, from, to, note: $('#pkNote').value.trim() },
        pickupAddr: pkAddr, sellerName, sellerTel, sellerAddr, shipDays: Number($('#fShipDays').value),
        bizOk: $('#fBiz').checked, bizNote: $('#fBizNote').value.trim(),
        cancelDays: Number($('#fCancel').value),
        products: draftProducts.map(p => Object.assign({}, p, pkOn ? {} : { pickupPrice: p.shipPrice }))
      });
      const btn = $('#saveFarm');
      btn.disabled = true;
      try {
        await api.saveFarm(saved);
        draftProducts = null;
        await reload();
        toast(existing ? '保存しました' : (api.mode === 'live' ? '登録しました！次に、売上の受け取り口座を登録してください' : '登録しました！'));
        if (existing) route(); else go('#/mine');
        window.scrollTo(0, 0);
      } catch (err) { toast('保存できませんでした：' + (err.message || '')); btn.disabled = false; }
    });

    const del = $('#deleteFarm');
    if (del) del.addEventListener('click', async () => {
      if (!(await ask('農園の登録と、畑だよりをすべて削除します。よろしいですか？', '削除する', true))) return;
      const r = await api.deleteFarm(f);
      draftProducts = null;
      await reload();
      toast(r === 'hidden' ? '注文の記録があるため、削除ではなく非公開にしました' : '削除しました');
      go('#/mine');
    });
  }

  // ---------- ルーティング ----------
  async function updateBadge() {
    let n = 0;
    try { if (!needLogin()) n = (await api.myOrders()).filter(o => ['paid', 'reserved', 'ready', 'shipped'].includes(o.status)).length; } catch (e) { /* noop */ }
    const a = $('#tabs a[data-tab=orders]');
    const b = a.querySelector('.badge');
    if (n && !b) a.insertAdjacentHTML('beforeend', `<span class="badge">${n}</span>`);
    else if (n && b) b.textContent = n;
    else if (!n && b) b.remove();
  }
  // 同じ画面への移動でも描き直す（hashchange が起きないため）
  function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
  let routeSeq = 0;
  // ---------- 画面: 利用規約・プライバシーポリシー・特定商取引法に基づく表記 ----------
  function renderLegal(kind) {
    const L = window.HATAKE_LEGAL;
    if (!L) { app.innerHTML = '<div class="empty">読み込めませんでした。アプリを開きなおしてください。</div>'; return; }
    const body = kind === 'privacy' ? L.privacy() : L.terms();
    app.innerHTML = `<a class="back" href="#/">← もどる</a><article class="legal panel">${body}</article>
      ${legalFoot()}`;
  }
  function renderLaw(id) {
    const f = findFarm(id);
    if (!f) { app.innerHTML = '<a class="back" href="#/">← もどる</a><div class="empty">この農家さんは見つかりませんでした。</div>'; return; }
    app.innerHTML = `
      <a class="back" href="#/farm/${esc(f.id)}">← ${esc(f.farmName)}にもどる</a>
      <article class="legal panel">${lawHtml(f)}</article>
      ${legalFoot()}`;
  }
  function lawHtml(f) {
    const o = window.HATAKE_LEGAL ? window.HATAKE_LEGAL.operator() : { name: '運営者', contact: '' };
    const row = (k, v) => `<div class="row"><dt>${k}</dt><dd>${v}</dd></div>`;
    return `
        <h1>特定商取引法に基づく表記</h1>
        <p class="dim">${esc(f.farmName)}（やまぐち畑のとなり 出店者）</p>
        <div class="method"><dl>
          ${row('販売業者', `${esc(sellerOf(f))}（${esc(f.farmName)}）`)}
          ${row('所在地・電話番号', `ご請求があれば、遅滞なくお知らせします。<br>運営窓口（${o.contact}）までご連絡ください。`)}
          ${row('販売価格', '各商品に表示しています（税込）。')}
          ${row('商品代金以外の費用', `配送：送料込みの価格です（山口県内のみ）。<br>畑で受け取り：送料はかかりません。${canPickup(f) ? '' : '<br>（この農家さんは現在、受け取りをしていません）'}`)}
          ${row('お支払い方法', `${f.chargesEnabled ? 'クレジットカードなど（Stripe の決済画面でお支払い）' : ''}${f.chargesEnabled && canCash(f) ? '<br>' : ''}${canCash(f) ? '現金（畑で受け取りの場合、受け取りのときにお支払い）' : ''}`)}
          ${row('お支払いの時期', `${f.chargesEnabled ? 'カード：ご注文時にお支払いいただきます。' : ''}${f.chargesEnabled && canCash(f) ? '<br>' : ''}${canCash(f) ? '現金：受け取りのときにお支払いいただきます。' : ''}`)}
          ${row('お届けの時期', `配送：ご注文から${shipDaysOf(f)}日以内に発送します。${canPickup(f) ? '<br>畑で受け取り：ご注文時に選んだ日時にお渡しします。' : ''}`)}
          ${f.chargesEnabled ? row('お申し込みの有効期限', 'カード払いは、決済画面を開いてから30分以内にお支払いください。') : ''}
          ${row('キャンセル', `ご注文から${f.cancelDays || 2}日以内（畑で受け取りの場合は受け取り日の前日まで）で、農家が準備を始める前であれば、アプリからキャンセルできます。カード払いの代金は全額返金します。`)}
          ${row('返品・交換', '生鮮食品のため、お客さまのご都合による返品・交換はできません。<br>傷み・破損・品違いがあった場合は、受け取りから2日以内に運営窓口までご連絡ください。返金または交換で対応します。')}
        </dl></div>
        <p class="small dim" style="margin-top:12px">このアプリの運営者：${o.name}。売買契約は、上記の販売業者とお客さまの間で成立します。</p>`;
  }
  // 入力中の画面（注文手続きなど）を離れずに読めるよう、規約などは重ねて表示する
  function openSheet(html) {
    const wrap = document.createElement('div');
    wrap.className = 'modal sheet';
    wrap.innerHTML = `<div class="modal-card sheet-card" role="dialog" aria-modal="true"><button type="button" class="sheet-close" aria-label="閉じる">✕</button><article class="legal">${html}</article>
      <div class="modal-actions"><button type="button" class="btn leaf" data-close>閉じる</button></div></div>`;
    const done = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape') done(); };
    wrap.addEventListener('click', e => {
      if (e.target === wrap || e.target.closest('.sheet-close, [data-close]')) done();
      else if (e.target.closest('a[href^="#/legal/"]')) { e.preventDefault(); e.stopPropagation(); const k = e.target.closest('a').getAttribute('href').split('/')[2]; $('.legal', wrap).innerHTML = k === 'privacy' ? window.HATAKE_LEGAL.privacy() : window.HATAKE_LEGAL.terms(); $('.sheet-card', wrap).scrollTop = 0; }
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(wrap);
  }
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[data-sheet]');
    if (!a || !window.HATAKE_LEGAL) return;
    e.preventDefault();
    const [, kind, id] = a.getAttribute('href').replace(/^#/, '').split('/');
    const f = kind === 'law' ? findFarm(decodeURIComponent(id)) : null;
    openSheet(kind === 'law' ? (f ? lawHtml(f) : '') : kind === 'privacy' ? window.HATAKE_LEGAL.privacy() : window.HATAKE_LEGAL.terms());
  });

  // ======================================================================
  //  質問箱：アプリの使い方を AI がやさしく答える（AI が使えないときは、よくある質問から探す）
  //  スマホに慣れていない人向けに、声で入力・答えの読み上げもできる
  // ======================================================================
  const AI_ON = !!(window.HATAKE_CONFIG || {}).aiEnabled;
  const ASK_LABEL = AI_ON ? '🤖 質問箱でAIに聞く' : '❓ 質問箱で調べる';
  const ASK_SAMPLES = ['注文のしかたを教えて', '畑で受け取るには？', '注文をキャンセルしたい', '農家として登録したい', '文字を大きくしたい'];
  // よくある質問と使い方ガイドから、質問に近いものを探す（2文字ずつの一致で点数をつける）
  function searchHelp(question) {
    const norm = t => String(t).toLowerCase().replace(/[\s、。？！?!「」（）()・]/g, '');
    const grams = t => { const n = norm(t), g = new Set(); for (let i = 0; i < n.length - 1; i++) g.add(n.slice(i, i + 2)); return g; };
    const q = grams(question);
    if (!q.size) return [];
    const docs = HELP.faq.map(x => ({ title: x.q, text: x.a, href: '#/faq' }))
      .concat(HELP.guide.buyer.map(x => ({ title: x.title, text: x.text, href: '#/guide' })))
      .concat(HELP.guide.farmer.map(x => ({ title: x.title, text: x.text, href: '#/guide/farmer' })));
    return docs.map(d => {
      const tg = grams(d.title), bg = grams(d.text);
      let sc = 0;
      q.forEach(g => { if (tg.has(g)) sc += 3; else if (bg.has(g)) sc += 1; });
      return { d, sc: sc / Math.sqrt(q.size) };
    }).filter(x => x.sc >= 1.2).sort((a, b) => b.sc - a.sc).slice(0, 3).map(x => x.d);
  }
  // 答えの中の [名前](#/...) だけをリンクにする（ほかの書式は文字のまま）
  const answerHtml = t => esc(t).replace(/\[([^\]]{1,30})\]\((#\/[a-z/]*)\)/g, '<a href="$2" data-close-ask>$1</a>').replace(/\n/g, '<br>');
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let askLog = []; // { role, text }（この起動のあいだだけ覚えておく）
  function speak(text) {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1'));
    u.lang = 'ja-JP'; u.rate = 0.95;
    speechSynthesis.speak(u);
  }
  function openAsk(prefill) {
    if ($('.modal.ask')) return;
    const wrap = document.createElement('div');
    wrap.className = 'modal sheet ask';
    wrap.innerHTML = `<div class="modal-card sheet-card ask-card" role="dialog" aria-modal="true" aria-label="質問箱">
      <button type="button" class="sheet-close" aria-label="閉じる">✕</button>
      <h2 style="margin:0 0 4px;font-size:1.15rem">${AI_ON ? '🤖' : '❓'} なんでも質問箱</h2>
      <p class="small dim" style="margin:0 0 10px">${AI_ON ? 'アプリの使い方を、AIがお答えします。ふだんの言葉で聞いてください。' : '知りたいことを書くと、使い方の説明から近い答えをさがします。'}</p>
      <div class="ask-log" id="askLog"></div>
      <div class="chips" id="askSamples">${ASK_SAMPLES.map(t => `<button type="button" class="chip leaf" data-sample="${esc(t)}">${esc(t)}</button>`).join('')}</div>
      <form class="ask-form" id="askForm">
        <textarea id="askText" rows="2" maxlength="400" placeholder="例：注文のしかたを教えて" aria-label="質問"></textarea>
        <div class="ask-btns">
          ${SR ? '<button type="button" class="btn ghost" id="askMic" aria-label="声で入力">🎤 声で</button>' : ''}
          <button type="submit" class="btn leaf" id="askSend">送る</button>
        </div>
      </form>
      <p class="small dim" style="margin:8px 0 0">${AI_ON ? 'AIの答えは、まちがうことがあります。' : ''}注文のことは注文画面のメッセージか、<a href="#/contact" data-close-ask>お問い合わせ</a>へ。電話番号や住所は書かないでください。</p>
    </div>`;
    const done = () => { wrap.remove(); document.removeEventListener('keydown', onKey); if ('speechSynthesis' in window) speechSynthesis.cancel(); };
    const onKey = e => { if (e.key === 'Escape') done(); };
    wrap.addEventListener('click', e => {
      if (e.target === wrap || e.target.closest('.sheet-close, [data-close-ask]')) done();
      const sp = e.target.closest('[data-speak]');
      if (sp) speak(askLog[Number(sp.dataset.speak)].text);
      const sm = e.target.closest('[data-sample]');
      if (sm) send(sm.dataset.sample);
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(wrap);
    const log = $('#askLog', wrap);
    const draw = (thinking) => {
      log.innerHTML = askLog.map((m, i) => m.role === 'user'
        ? `<div class="msg me">${esc(m.text)}</div>`
        : `<div class="msg them">${m.html || answerHtml(m.text)}${m.text ? `<div><button type="button" class="linkbtn small" data-speak="${i}">🔊 読み上げる</button></div>` : ''}</div>`).join('')
        + (thinking ? '<div class="msg them dim">考えています…</div>' : '');
      $('#askSamples', wrap).hidden = askLog.length > 0;
      log.scrollTop = log.scrollHeight;
      $('.ask-card', wrap).scrollTop = $('.ask-card', wrap).scrollHeight;
    };
    async function send(text) {
      text = String(text || '').trim();
      if (!text) return;
      $('#askText', wrap).value = '';
      askLog.push({ role: 'user', text });
      draw(true);
      $('#askSend', wrap).disabled = true;
      let res;
      try { res = AI_ON ? await api.askAI(askLog.filter(m => !m.local).slice(-8).map(m => ({ role: m.role, text: m.text }))) : { fallback: true }; } catch (e) { res = { fallback: true }; }
      if (res && res.answer) askLog.push({ role: 'assistant', text: res.answer });
      else {
        const hits = searchHelp(text);
        const head = res && res.limited ? '今日は質問の回数が多いため、AIはお休みしています。かわりに、近い説明をさがしました。\n' : '';
        const body = hits.length
          ? hits.map(h => `「${h.title}」\n${h.text}`).join('\n\n')
          : 'ぴったりの説明が見つかりませんでした。';
        const html = esc(head).replace(/\n/g, '<br>') + (hits.length
          ? hits.map(h => `<div class="ask-hit"><b>${esc(h.title)}</b><br>${esc(h.text).replace(/\n/g, '<br>')}<br><a href="${h.href}" data-close-ask>くわしく見る →</a></div>`).join('')
          : 'ぴったりの説明が見つかりませんでした。<a href="#/faq" data-close-ask>よくある質問</a>を見るか、<a href="#/contact" data-close-ask>お問い合わせ</a>から運営に聞いてください。');
        askLog.push({ role: 'assistant', text: head + body, html, local: true });
        if (askLog.length >= 2) askLog[askLog.length - 2].local = true; // AI に答えられなかった質問は、次の会話に含めない
      }
      draw(false);
      $('#askSend', wrap).disabled = false;
    }
    $('#askForm', wrap).addEventListener('submit', e => { e.preventDefault(); send($('#askText', wrap).value); });
    $('#askText', wrap).addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send($('#askText', wrap).value); } });
    const mic = $('#askMic', wrap);
    if (mic) mic.addEventListener('click', () => {
      try {
        const rec = new SR();
        rec.lang = 'ja-JP'; rec.interimResults = true;
        mic.disabled = true; mic.textContent = '🎤 話してください…';
        rec.onresult = ev => { $('#askText', wrap).value = Array.from(ev.results).map(r => r[0].transcript).join(''); };
        rec.onend = () => { mic.disabled = false; mic.textContent = '🎤 声で'; if ($('#askText', wrap).value.trim()) send($('#askText', wrap).value); };
        rec.onerror = () => { toast('声を聞き取れませんでした。マイクの使用を許可してください'); };
        rec.start();
      } catch (e) { toast('この端末では声の入力が使えません'); }
    });
    draw(false);
    if (prefill) send(prefill); else setTimeout(() => $('#askText', wrap).focus(), 100);
  }
  const fab = document.createElement('button');
  fab.type = 'button'; fab.className = 'ask-fab'; fab.id = 'askFab';
  fab.innerHTML = '<span class="q">❓</span><span>しつもん</span>';
  fab.setAttribute('aria-label', '質問箱をひらく');
  fab.addEventListener('click', () => openAsk());
  document.body.appendChild(fab);
  // どの画面の「質問箱」ボタンからも開けるように
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-open-ask]'); if (b && !b.closest('.modal')) openAsk(); });

  // 文字の大きさ（スマホの文字が小さく感じる人向け）
  const TEXT_SIZES = { normal: 'ふつう', lg: '大きい', xl: 'とても大きい' };
  function applyTextSize(v) { if (v && v !== 'normal') document.documentElement.setAttribute('data-size', v); else document.documentElement.removeAttribute('data-size'); }
  applyTextSize(store.get(KEY.textSize, 'normal'));

  // ---------- メニュー（使い方・よくある質問・お問い合わせ・規約・スポンサー） ----------
  const HELP = window.HATAKE_HELP || { intro: [], guide: { buyer: [], farmer: [] }, faq: [] };
  function sponsorsHtml() {
    const list = ((window.HATAKE_CONFIG || {}).sponsors || []).filter(x => x && x.name);
    return list.length
      ? `<div class="sponsors"><div class="small dim">このアプリは、次のみなさんの応援で運営しています</div>${list.map(x => `<div class="sponsor">${safeUrl(x.url) ? `<a href="${safeUrl(x.url)}" target="_blank" rel="noopener">` : ''}<b>🌱 ${esc(x.name)}</b>${safeUrl(x.url) ? '</a>' : ''}${x.text ? `<div class="small">${esc(x.text)}</div>` : ''}</div>`).join('')}</div>`
      : `<div class="sponsors"><div class="small"><b>🌱 応援してくれる企業・団体を募集しています</b></div><div class="small dim">このアプリは、運営の手数料をいただかずに続けています。地域の農業を一緒に応援してくださる方は、<a href="#/contact?kind=request" data-close-menu>お問い合わせ</a>からご連絡ください。</div></div>`;
  }
  function openMenu() {
    const wrap = document.createElement('div');
    wrap.className = 'modal sheet';
    const item = (href, ic, t, sub) => `<a class="menu-item" href="${href}" data-close-menu><span class="ic">${ic}</span><span>${t}${sub ? `<small>${sub}</small>` : ''}</span><span class="arr">›</span></a>`;
    wrap.innerHTML = `<div class="modal-card sheet-card" role="dialog" aria-modal="true" aria-label="メニュー"><button type="button" class="sheet-close" aria-label="閉じる">✕</button>
      <h2 style="margin:0 0 12px;font-size:1.1rem">メニュー</h2>
      <nav class="menu-list">
        <button type="button" class="menu-item" data-open-ask><span class="ic">${AI_ON ? '🤖' : '❓'}</span><span>${AI_ON ? '質問箱（AIに聞く）' : '質問箱'}<small>使い方がわからないときに</small></span><span class="arr">›</span></button>
        ${item('#/guide', '📖', '使い方ガイド', 'はじめての方はこちら')}
        ${item('#/faq', '❓', 'よくある質問', '送料・キャンセル・手数料など')}
        ${item('#/contact', '✉️', 'お問い合わせ', '困ったこと・ご意見・不具合')}
        ${item('#/legal/terms', '📄', '利用規約')}
        ${item('#/legal/privacy', '🔒', 'プライバシーポリシー')}
      </nav>
      <div class="text-size"><b>🔠 文字の大きさ</b>
        <div class="seg" style="margin-top:6px">${Object.entries(TEXT_SIZES).map(([k, v]) => `<button type="button" data-size="${k}" class="${(store.get(KEY.textSize, 'normal')) === k ? 'on' : ''}">${v}</button>`).join('')}</div></div>
      ${sponsorsHtml()}
      <p class="small dim" style="text-align:center;margin:14px 0 0">やまぐち畑のとなり ver.${APP_VERSION}</p></div>`;
    const done = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape') done(); };
    wrap.addEventListener('click', e => {
      if (e.target === wrap || e.target.closest('.sheet-close, [data-close-menu]')) done();
      if (e.target.closest('[data-open-ask]')) { done(); openAsk(); }
      const sz = e.target.closest('[data-size]');
      if (sz) { store.set(KEY.textSize, sz.dataset.size); applyTextSize(sz.dataset.size); $$('[data-size]', wrap).forEach(b => b.classList.toggle('on', b === sz)); }
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(wrap);
  }
  $('#menuBtn').addEventListener('click', openMenu);

  function stepsHtml(list) {
    return `<ol class="guide-steps">${list.map((x, i) => `<li><span class="num">${i + 1}</span><span class="em">${x.emoji}</span><div><b>${esc(x.title)}</b><p>${esc(x.text)}</p></div></li>`).join('')}</ol>`;
  }
  function renderGuide(who) {
    const farmer = who === 'farmer';
    app.innerHTML = `
      <section class="hero-intro simple"><h1>📖 使い方ガイド</h1><p>はじめての方でも、かんたんに使えます。</p></section>
      <div class="seg" style="margin:16px 0 4px" role="tablist">
        <a href="#/guide" class="${farmer ? '' : 'on'}" role="tab" aria-selected="${!farmer}">🧺 買う方</a>
        <a href="#/guide/farmer" class="${farmer ? 'on' : ''}" role="tab" aria-selected="${farmer}">👩‍🌾 農家さん</a>
      </div>
      ${stepsHtml(HELP.guide[farmer ? 'farmer' : 'buyer'])}
      <div class="panel soft" style="margin-top:16px">
        <p style="margin:0 0 10px"><b>わからないことがあったら</b></p>
        <div class="actions"><button class="btn corn small" type="button" data-open-ask>${ASK_LABEL}</button><a class="btn leaf small" href="#/faq">❓ よくある質問</a><a class="btn ghost small" href="#/contact">✉️ お問い合わせ</a>
        ${farmer ? '' : '<button class="btn ghost small" type="button" id="replayIntro">🎬 はじめての案内をもう一度見る</button>'}</div>
      </div>
      ${legalFoot()}`;
    const r = $('#replayIntro');
    if (r) r.addEventListener('click', () => showIntro(true));

  }
  function renderFaq() {
    const cats = [...new Set(HELP.faq.map(x => x.cat))];
    app.innerHTML = `
      <section class="hero-intro simple"><h1>❓ よくある質問</h1><p>見つからないときは、お気軽にお問い合わせください。</p></section>
      ${cats.map(c => `<h2 class="sec">${esc(c)}</h2><div class="faq">${HELP.faq.filter(x => x.cat === c).map(x => `<details><summary>${esc(x.q)}</summary><p>${esc(x.a).replace(/\n/g, '<br>')}</p></details>`).join('')}</div>`).join('')}
      <div class="panel soft" style="margin-top:18px;text-align:center"><p style="margin:0 0 10px">解決しないときは</p><a class="btn leaf" href="#/contact">✉️ お問い合わせ</a></div>
      ${legalFoot()}`;
  }
  const INQ_KIND = { order: 'ご注文について', trouble: '農家さん・お客さんとのトラブル', bug: 'アプリの不具合', farmer: '農家さんの登録・出品について', request: 'ご意見・ご要望・スポンサーのご相談', other: 'その他' };
  async function renderContact(query) {
    const pre = new URLSearchParams(query || '');
    const loggedIn = !needLogin();
    const orders = loggedIn ? (await api.myOrders().catch(() => [])).slice(0, 20) : [];
    const email = api.mode === 'live' && api.user ? api.user.email : '';
    app.innerHTML = `
      <section class="hero-intro simple"><h1>✉️ お問い合わせ</h1><p>運営にメッセージが届きます。返信は、入力したメールアドレスにお送りします。</p></section>
      <p class="small" style="margin:12px 0">ご注文の内容は、まず<b>注文画面のメッセージ</b>で農家さんに聞くと早く解決します。<a href="#/faq">よくある質問</a>もご覧ください。</p>
      <form class="panel" id="inqForm" novalidate>
        <div class="field"><label for="iKind">お問い合わせの種類</label>
          <select id="iKind">${Object.entries(INQ_KIND).map(([k, v]) => `<option value="${k}" ${pre.get('kind') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        ${orders.length ? `<div class="field"><label for="iOrder">関係する注文（あれば）</label>
          <select id="iOrder"><option value="">えらばない</option>${orders.map(o => `<option value="${esc(o.id)}" ${pre.get('order') === o.id ? 'selected' : ''}>${fmtDate(o.createdAt)} ${esc(o.farmName)}（${yen(o.total)}）</option>`).join('')}</select></div>` : ''}
        <div class="field"><label for="iEmail">返信先のメールアドレス</label><input id="iEmail" type="email" autocomplete="email" maxlength="200" value="${esc(email)}" placeholder="you@example.com"></div>
        <div class="field"><label for="iBody">内容</label><textarea id="iBody" maxlength="2000" rows="7" placeholder="どの画面で、何をしたら、どうなったかを教えてください。">${pre.get('review') ? esc(`口コミの報告（番号：${pre.get('review')}）\n理由：`) : ''}</textarea></div>
        <p class="small dim">送信すると、<a href="#/legal/privacy" data-sheet>プライバシーポリシー</a>に同意したものとみなします。</p>
        <button class="btn block" type="submit" id="iSend">送信する</button>
        ${api.mode === 'demo' ? '<p class="small dim" style="margin:8px 0 0">お試し版のため、この端末の中にだけ保存されます。</p>' : ''}
      </form>
      ${legalFoot()}`;
    $('#inqForm').addEventListener('submit', async e => {
      e.preventDefault();
      const em = $('#iEmail').value.trim(), body = $('#iBody').value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { toast('メールアドレスを確認してください'); $('#iEmail').focus(); return; }
      if (!body) { toast('内容を入力してください'); $('#iBody').focus(); return; }
      const btn = $('#iSend'); btn.disabled = true; btn.textContent = '送信中…';
      try {
        await api.contact({ email: em, kind: $('#iKind').value, orderId: $('#iOrder') ? $('#iOrder').value : '', body });
        app.innerHTML = `<section class="hero-intro"><span class="float a">📮</span><h1>送信しました</h1><p>お問い合わせありがとうございます。内容を確認して、${esc(em)} にご連絡します。</p></section>
          <div style="text-align:center;margin-top:16px"><a class="btn leaf" href="#/">トップへもどる</a></div>`;
      } catch (err) { toast(err.message || '送信できませんでした'); btn.disabled = false; btn.textContent = '送信する'; }
    });
  }

  // はじめて開いたときの案内（3枚）。メニューの「使い方ガイド」からもう一度見られる
  function showIntro(force) {
    if (!force && store.get(KEY.intro, false)) return;
    const slides = HELP.intro;
    if (!slides.length) return;
    let i = 0;
    const wrap = document.createElement('div');
    wrap.className = 'modal intro';
    const draw = () => {
      const x = slides[i], last = i === slides.length - 1;
      wrap.innerHTML = `<div class="modal-card intro-card" role="dialog" aria-modal="true">
        <button type="button" class="intro-skip" data-skip>スキップ</button>
        <div class="intro-em">${x.emoji}</div>
        <h2>${esc(x.title).replace(/\n/g, '<br>')}</h2>
        <p>${esc(x.text).replace(/\n/g, '<br>')}</p>
        <div class="dots">${slides.map((_, k) => `<span class="${k === i ? 'on' : ''}"></span>`).join('')}</div>
        <button type="button" class="btn block ${last ? 'leaf' : ''}" data-next>${last ? 'はじめる' : 'つぎへ'}</button></div>`;
    };
    const done = () => { wrap.remove(); store.set(KEY.intro, true); };
    wrap.addEventListener('click', e => {
      if (e.target.closest('[data-skip]')) done();
      else if (e.target.closest('[data-next]')) { if (i < slides.length - 1) { i++; draw(); } else done(); }
    });
    draw();
    document.body.appendChild(wrap);
  }

  // 注文ごとのメッセージ（お客さん ⇔ 農家さん）
  // メッセージのやりとり（注文・お手伝い・お店の相談で共通）
  async function threadBox(slot, t) {
    const list = await t.load().catch(() => []);
    slot.innerHTML = `
      <div class="chat">
        ${list.length ? list.map(m => `<div class="msg ${m.fromFarmer === !!t.asFarmer ? 'me' : 'them'}"><div class="who">${m.fromFarmer ? '🧑‍🌾 農家さん' : t.otherLabel} ・ ${fmtDateTime(m.date)}</div>${esc(m.text).replace(/\n/g, '<br>')}</div>`).join('')
          : `<div class="small dim">${esc(t.hint)}</div>`}
      </div>
      ${t.open ? `<form class="chat-form"><textarea maxlength="500" rows="2" placeholder="${t.asFarmer ? `${t.otherLabel.replace(/^\S+\s/, '')}へメッセージ` : '農家さんへメッセージ'}" aria-label="メッセージ"></textarea><button class="btn small leaf" type="submit">送る</button></form>` : ''}`;
    const form = $('.chat-form', slot);
    if (form) form.addEventListener('submit', async e => {
      e.preventDefault();
      const text = $('textarea', form).value.trim();
      if (!text) return;
      $('button', form).disabled = true;
      try { await t.send(text); await threadBox(slot, t); }
      catch (err) { toast(err.message || '送れませんでした'); $('button', form).disabled = false; }
    });
  }
  function chatBox(slot, o, asFarmer) {
    return threadBox(slot, {
      load: () => api.orderMessages(o.id), send: text => api.sendOrderMessage(o.id, text, asFarmer), asFarmer, open: o.status !== 'pending_payment',
      otherLabel: '🙋 お客さん', hint: asFarmer ? 'お客さんへの連絡（発送が遅れる・受け取りの時間の相談など）に使えます。' : '受け取りの時間の相談や、届いたものについての連絡に使えます。'
    });
  }
  const talkBox = (slot, kind, ref, asFarmer, open = true) => threadBox(slot, {
    load: () => api.talk(kind, ref), send: text => api.talkSend(kind, ref, text, asFarmer), asFarmer, open,
    otherLabel: kind === 'biz' ? '🏪 お店' : '🙋 お手伝いの方',
    hint: kind === 'biz' ? (asFarmer ? '値段・量・届け方などを相談してください。' : '農家さんからの返事がここに届きます。') : (asFarmer ? '集合場所や当日の流れを伝えるのに使えます。' : '農家さんからの連絡がここに届きます。')
  });

  // ======================================================================
  //  口コミ：受け取りが完了した注文の本人だけが書ける。農家さんは返事を書ける。
  // ======================================================================
  const REVIEW_TAGS = ['おいしい', '新鮮', 'ていねい', '量がたっぷり', 'また買いたい', '農家さんが親切'];
  const stars = (n, cls = '') => `<span class="stars ${cls}" aria-label="5点中${n}点">${'★'.repeat(Math.round(n))}<span class="off">${'★'.repeat(5 - Math.round(n))}</span></span>`;
  function reviewItem(r, own) {
    return `
      <div class="review" data-rid="${esc(r.id)}">
        <div class="head">${stars(r.rating)} <b>${esc(r.name || '購入した人')}</b> <span class="small dim">・ ${fmtDate(r.date)}${r.items ? ` ・ ${esc(r.items)}` : ''}</span></div>
        ${r.tags && r.tags.length ? `<div class="tags">${r.tags.map(t => `<span class="tag leaf">${esc(t)}</span>`).join('')}</div>` : ''}
        ${r.comment ? `<p>${esc(r.comment).replace(/\n/g, '<br>')}</p>` : ''}
        ${r.reply ? `<div class="reply"><b>🧑‍🌾 農家さんから</b><p>${esc(r.reply).replace(/\n/g, '<br>')}</p></div>` : ''}
        ${own ? `<form class="reply-form"><textarea maxlength="400" rows="2" placeholder="口コミへの返事（みんなに表示されます）">${esc(r.reply || '')}</textarea><button class="btn small leaf" type="submit">${r.reply ? '返事を直す' : '返事を書く'}</button></form>`
          : `<button class="linkbtn small dim" type="button" data-report="${esc(r.id)}">不適切な口コミを報告</button>`}
      </div>`;
  }
  async function drawReviews(slot, f) {
    const list = await api.reviews(f.id).catch(() => []);
    const own = isMine(f);
    const avg = list.length ? Math.round(list.reduce((s, r) => s + r.rating, 0) / list.length * 10) / 10 : 0;
    const tagCount = {};
    list.forEach(r => (r.tags || []).forEach(t => { tagCount[t] = (tagCount[t] || 0) + 1; }));
    const topTags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 4);
    slot.innerHTML = list.length ? `
      <div class="review-sum box">
        <div class="big">${avg.toFixed(1)}</div>
        <div>${stars(avg, 'lg')}<div class="small dim">${list.length}件の口コミ（買った人だけが書けます）</div>
          ${topTags.length ? `<div class="tags" style="margin-top:6px">${topTags.map(([t, n]) => `<span class="tag leaf">${esc(t)} ${n}</span>`).join('')}</div>` : ''}</div>
      </div>
      <div class="reviews">${list.map(r => reviewItem(r, own)).join('')}</div>`
      : '<div class="small dim">まだ口コミはありません。この農家さんから買って受け取ると、注文画面から口コミを書けます。</div>';
    $$('.reply-form', slot).forEach(form => form.addEventListener('submit', async e => {
      e.preventDefault();
      const id = form.closest('[data-rid]').dataset.rid;
      try { await api.replyReview(id, $('textarea', form).value.trim()); toast('返事を保存しました'); drawReviews(slot, f); } catch (err) { toast(err.message); }
    }));
    $$('[data-report]', slot).forEach(b => b.addEventListener('click', () => go(`#/contact?kind=trouble&review=${encodeURIComponent(b.dataset.report)}`)));
  }
  // 注文画面：受け取りが完了したら口コミを書ける
  async function reviewBox(slot, o) {
    const r = await api.orderReview(o.id).catch(() => null);
    const draw = (editing) => {
      if (r && !editing) {
        slot.innerHTML = `<div class="small dim" style="margin-bottom:6px">あなたの口コミ（農家さんのページに表示されています）</div>${reviewItem(r, false).replace(/<button class="linkbtn[^>]*data-report[^>]*>.*?<\/button>/, '')}
          <div class="actions" style="margin-top:8px"><button class="btn ghost small" id="rvEdit">直す</button><button class="btn ghost small" id="rvDel" style="color:var(--tomato)">消す</button></div>`;
        $('#rvEdit').addEventListener('click', () => draw(true));
        $('#rvDel').addEventListener('click', async () => {
          if (!(await ask('口コミを消しますか？', '消す', true))) return;
          try { await api.deleteReview(r.id); toast('消しました'); reviewBox(slot, o); } catch (err) { toast(err.message); }
        });
        return;
      }
      const v = r || { rating: 0, tags: [], comment: '', name: '' };
      slot.innerHTML = `
        <form id="rvForm" novalidate>
          <div class="field"><span class="field-label">評価</span>
            <div class="star-pick" role="radiogroup" aria-label="評価">${[1, 2, 3, 4, 5].map(n => `<button type="button" role="radio" data-star="${n}" aria-label="${n}点" class="${n <= v.rating ? 'on' : ''}">★</button>`).join('')}</div></div>
          <div class="field"><span class="field-label">良かったところ（いくつでも）</span>
            <div class="chips">${REVIEW_TAGS.map(t => `<button type="button" class="chip leaf ${v.tags.includes(t) ? 'on' : ''}" data-rtag="${esc(t)}">${esc(t)}</button>`).join('')}</div></div>
          <div class="field"><label for="rvText">ひとこと</label><textarea id="rvText" maxlength="400" placeholder="味・鮮度・受け取りのときのことなど">${esc(v.comment)}</textarea></div>
          <div class="field"><label for="rvName">表示する名前（ニックネーム）</label><input id="rvName" maxlength="30" value="${esc(v.name)}" placeholder="例：仁保のはなこ"><span class="hint">本名や住所・電話番号は書かないでください。</span></div>
          <button class="btn block leaf" type="submit">${r ? '口コミを直す' : '口コミを投稿する'}</button>
        </form>`;
      let rating = v.rating;
      const tags = new Set(v.tags);
      $$('[data-star]', slot).forEach(b => b.addEventListener('click', () => { rating = Number(b.dataset.star); $$('[data-star]', slot).forEach(x => x.classList.toggle('on', Number(x.dataset.star) <= rating)); }));
      $$('[data-rtag]', slot).forEach(b => b.addEventListener('click', () => { const t = b.dataset.rtag; if (tags.has(t)) tags.delete(t); else tags.add(t); b.classList.toggle('on', tags.has(t)); }));
      $('#rvForm').addEventListener('submit', async e => {
        e.preventDefault();
        if (!rating) { toast('★の数をえらんでください'); return; }
        try {
          await api.saveReview(o.id, { rating, tags: [...tags], comment: $('#rvText').value.trim(), name: $('#rvName').value.trim() });
          toast('口コミを投稿しました。ありがとうございます！');
          reviewBox(slot, o);
          reload().catch(() => {});
        } catch (err) { toast(err.message); }
      });
    };
    draw(false);
  }

  // ======================================================================
  //  援農（お手伝い）
  //  無償のボランティアに限る（お礼は収穫物のおすそわけ程度）。賃金のある仕事の募集は扱わない。
  // ======================================================================
  const ENTRY_LABEL = { applied: '返事待ち', accepted: '参加決定', declined: '今回は見送り', canceled: '取り消し' };
  const helpLeft = h => Math.max(0, h.capacity - (h.filled || 0));
  function helpCard(h) {
    const f = findFarm(h.farmId), home = getHome(), left = helpLeft(h);
    return `
      <a class="help-card box" href="#/help/${esc(h.id)}">
        <div class="when">📅 ${fmtDay(h.date)} ${h.from}:00〜${h.to}:00</div>
        <h3>${esc(h.title)}</h3>
        <div class="small">${f ? `${esc(f.emoji)} ${esc(f.farmName)} ・ ` : ''}📍 ${esc(h.place || (f ? f.city : ''))}${home && f ? ` ・ 🚗 ${fmtKm(km(home, f))}` : ''}</div>
        <div class="tags" style="margin-top:6px">
          ${h.beginner ? '<span class="tag">はじめてOK</span>' : ''}${h.meal ? '<span class="tag corn">お昼つき</span>' : ''}
          ${h.thanks ? `<span class="tag carrot">🎁 ${esc(h.thanks)}</span>` : ''}
          <span class="tag ${left ? 'eggplant' : 'tomato'}">${h.status !== 'open' ? '締め切り' : left ? `あと${left}人` : '満員'}</span>
        </div>
      </a>`;
  }
  const HELP_NOTE = `<div class="notice small">🙌 <b>お手伝いは、お金のやりとりのないボランティアです</b>（お礼は収穫物のおすそわけなど）。
    けがに備えて、お住まいの市町の社会福祉協議会の「ボランティア活動保険」（年数百円）への加入をおすすめします。未成年の方は、保護者の同意を得てください。</div>`;
  async function renderHelpList() {
    const home = getHome();
    let list = await api.helps();
    if (home) list = list.slice().sort((a, b) => a.date.localeCompare(b.date) || (km(home, findFarm(a.farmId) || home) - km(home, findFarm(b.farmId) || home)));
    const mine = needLogin() ? [] : await api.myEntries().catch(() => []);
    const active = mine.filter(e => e.status !== 'canceled' && e.help && e.help.date >= today());
    app.innerHTML = `
      <section class="hero-intro"><span class="float a">🙌</span><h1>畑のお手伝い</h1><p>収穫や草取りを手伝って、農家さんと仲良くなろう。はじめての人も大歓迎です。</p></section>
      ${active.length ? `<h2 class="sec"><span class="ic">📝</span>申し込んだお手伝い</h2><div class="order-list">${active.map(e => `
        <a class="order box" href="#/help/${esc(e.helpId)}"><div class="head"><b>${esc(e.help.title)}</b><span class="status ${e.status === 'accepted' ? 'done' : e.status === 'declined' ? 'canceled' : 'paid'}">${ENTRY_LABEL[e.status]}</span></div>
          <div class="small dim">📅 ${fmtDay(e.help.date)} ${e.help.from}:00〜${e.help.to}:00 ・ ${e.people}人</div></a>`).join('')}</div>` : ''}
      <h2 class="sec"><span class="ic">📅</span>募集中のお手伝い <span class="dim small">${list.length}件</span></h2>
      <div class="help-list">${list.length ? list.map(helpCard).join('') : '<div class="empty">いま募集中のお手伝いはありません。<br>農家さんをフォローしておくと、畑だよりで様子がわかります。</div>'}</div>
      ${HELP_NOTE}
      <p class="small dim" style="margin-top:12px">農家さんへ：お手伝いの募集は「<a href="#/mine/help">農家の方 → お手伝い</a>」から出せます。</p>
      ${legalFoot()}`;
  }
  async function renderHelp(id) {
    const h = await api.help(id);
    if (!h) { app.innerHTML = '<a class="back" href="#/help">← もどる</a><div class="empty">この募集は見つかりませんでした。</div>'; return; }
    const f = findFarm(h.farmId);
    const own = f && isMine(f);
    const entry = needLogin() || own ? null : (await api.myEntries().catch(() => [])).find(e => e.helpId === id && e.status !== 'canceled');
    const future = h.date > today();
    const left = helpLeft(h);
    const row = (k, v) => v ? `<div class="row"><dt>${k}</dt><dd>${v}</dd></div>` : '';
    app.innerHTML = `
      <a class="back" href="#/help">← お手伝い一覧へ</a>
      <section class="hero-intro simple"><h1>🙌 ${esc(h.title)}</h1><p>${f ? `<a href="#/farm/${esc(f.id)}">${esc(f.emoji)} ${esc(f.farmName)}</a>（${esc(f.city)}）` : ''}</p></section>
      <div class="box" style="margin-top:14px"><div class="method"><dl>
        ${row('日にち', `<b>${fmtDay(h.date)}</b>`)}
        ${row('時間', `${h.from}:00〜${h.to}:00`)}
        ${row('集まる場所', `${esc(h.place || (f ? f.city : ''))}<br><span class="small dim">くわしい場所は、参加が決まったらメッセージでお知らせします。</span>`)}
        ${row('募集', `${h.capacity}人（${h.status !== 'open' ? '締め切り' : left ? `あと${left}人` : '満員'}）`)}
        ${row('やること', esc(h.body).replace(/\n/g, '<br>'))}
        ${row('お礼', esc(h.thanks))}
        ${row('持ち物', esc(h.bring))}
        ${row('お昼', h.meal ? 'あり' : 'なし（各自でご用意ください）')}
        ${row('はじめての方', h.beginner ? '大歓迎です' : '経験のある方向けです')}
      </dl></div></div>
      ${HELP_NOTE}
      <div id="helpAct" style="margin-top:16px"></div>`;
    const act = $('#helpAct');
    if (own) { act.innerHTML = '<p class="small">あなたの募集です。<a href="#/mine/help">申し込みの確認はこちら →</a></p>'; return; }
    if (entry) {
      act.innerHTML = `
        <div class="panel">
          <h3 style="font-size:1rem;margin:0 0 6px">申し込み状況：<span class="status ${entry.status === 'accepted' ? 'done' : entry.status === 'declined' ? 'canceled' : 'paid'}">${ENTRY_LABEL[entry.status]}</span></h3>
          <p class="small" style="margin:0 0 8px">${entry.status === 'accepted' ? '参加が決まりました！集合場所などは、下のメッセージを確認してください。' : entry.status === 'declined' ? '今回は見送りになりました。またの機会にぜひ。' : '農家さんの返事をお待ちください。'}</p>
          ${future && ['applied', 'accepted'].includes(entry.status) ? '<button class="btn danger small" id="cancelEntry">申し込みを取り消す</button>' : ''}
        </div>
        <h2 class="sec"><span class="ic">💬</span>農家さんとのメッセージ</h2>
        <div class="panel" id="helpTalk"></div>`;
      talkBox($('#helpTalk'), 'help', entry.id, false, entry.status !== 'declined');
      const c = $('#cancelEntry');
      if (c) c.addEventListener('click', async () => {
        if (!(await ask('申し込みを取り消しますか？', '取り消す', true))) return;
        try { await api.cancelHelpEntry(entry.id); toast('取り消しました'); renderHelp(id); } catch (err) { toast(err.message); }
      });
      return;
    }
    if (h.status !== 'open' || !future || !left) { act.innerHTML = '<div class="empty">この募集は締め切られました。</div>'; return; }
    if (needLogin()) { act.innerHTML = loginPanel('申し込むには、ログインが必要です。'); bindLogin(location.hash, () => renderHelp(id)); return; }
    const buyer = store.get(KEY.buyer, {});
    act.innerHTML = `
      <form class="panel" id="helpForm" novalidate>
        <h3 style="font-size:1rem;margin:0 0 10px">✋ 申し込む</h3>
        <div class="row2">
          <div class="field"><label for="hName">お名前</label><input id="hName" maxlength="30" autocomplete="name" value="${esc(buyer.name || '')}"></div>
          <div class="field"><label for="hTel">電話番号</label><input id="hTel" type="tel" maxlength="13" autocomplete="tel" value="${esc(buyer.tel || '')}" placeholder="090-0000-0000"></div>
        </div>
        <div class="field"><label for="hPeople">人数</label><select id="hPeople">${[1, 2, 3, 4, 5].filter(n => n <= left).map(n => `<option value="${n}">${n}人</option>`).join('')}</select></div>
        <div class="field"><label for="hMsg">農家さんへひとこと</label><textarea id="hMsg" maxlength="400" placeholder="例：はじめてですが、体力には自信があります！"></textarea></div>
        <p class="small dim">お名前と電話番号は、この農家さんにだけ伝わります。</p>
        <button class="btn block leaf" type="submit" id="hSend">申し込む</button>
      </form>`;
    $('#helpForm').addEventListener('submit', async e => {
      e.preventDefault();
      const name = $('#hName').value.trim(), tel = $('#hTel').value.trim();
      if (!name) { toast('お名前を入力してください'); $('#hName').focus(); return; }
      if (!TEL_RE.test(tel)) { toast('電話番号を確認してください'); $('#hTel').focus(); return; }
      $('#hSend').disabled = true;
      try {
        await api.applyHelp(id, { name, tel, people: Number($('#hPeople').value), message: $('#hMsg').value.trim() });
        store.set(KEY.buyer, Object.assign(store.get(KEY.buyer, {}), { name, tel }));
        toast('申し込みました！農家さんの返事をお待ちください');
        renderHelp(id);
      } catch (err) { toast(err.message); $('#hSend').disabled = false; }
    });
  }
  // 農家さん：お手伝いの募集と申し込みの管理
  async function renderMyHelps(head, rest) {
    const f = DATA.mine;
    if (rest[0] === 'new') return renderHelpNew(head);
    const list = await api.helps(f.id);
    const entries = {};
    await Promise.all(list.map(async h => { entries[h.id] = await api.helpEntries(h.id).catch(() => []); }));
    app.innerHTML = `
      ${head}
      <div style="display:flex;justify-content:space-between;align-items:center;margin:12px 0">
        <h2 class="sec" style="margin:0"><span class="ic">🙌</span>お手伝いの募集</h2>
        <a class="btn small leaf" href="#/mine/help/new">＋ 募集する</a>
      </div>
      <p class="small dim" style="margin:0 0 12px">収穫や草取りなどを、ボランティアで手伝ってくれる人を募集できます。<b>お金（日当・時給）は払えません</b>（お礼は収穫物のおすそわけ程度）。賃金を払う場合は雇用になり、労働基準法などのルールが適用されます。</p>
      <div class="order-list">${list.length ? list.map(h => {
        const es = entries[h.id] || [];
        return `
        <div class="order box">
          <div class="head"><b>${esc(h.title)}</b><span class="status ${h.status === 'open' ? 'paid' : 'canceled'}">${h.status === 'open' ? '募集中' : '締め切り'}</span></div>
          <div class="small">📅 ${fmtDay(h.date)} ${h.from}:00〜${h.to}:00 ・ 参加決定 ${h.filled || 0}/${h.capacity}人</div>
          ${es.filter(e => e.status !== 'canceled').map(e => `
            <div class="entry">
              <div><b>${esc(e.name)} さん</b>（${e.people}人） <span class="status ${e.status === 'accepted' ? 'done' : e.status === 'declined' ? 'canceled' : 'paid'}">${ENTRY_LABEL[e.status]}</span></div>
              <div class="small dim">📞 <a href="tel:${esc(String(e.tel).replace(/[^\d]/g, ''))}">${esc(e.tel)}</a>${e.message ? ` ・ 💬 ${esc(e.message)}` : ''}</div>
              <div class="actions" style="margin-top:6px">
                ${e.status === 'applied' ? `<button class="btn leaf small" data-resp="${esc(e.id)}" data-to="accepted">受け入れる</button><button class="btn ghost small" data-resp="${esc(e.id)}" data-to="declined">今回は見送る</button>` : ''}
                ${e.status === 'accepted' ? `<button class="btn ghost small" data-resp="${esc(e.id)}" data-to="declined">取り消す</button>` : ''}
              </div>
              <details class="chat-toggle" data-talk="${esc(e.id)}"><summary>💬 メッセージ</summary><div class="chat-slot"></div></details>
            </div>`).join('') || '<div class="small dim" style="margin-top:6px">まだ申し込みはありません。</div>'}
          <div class="actions" style="margin-top:8px">
            <button class="btn ghost small" data-hstatus="${esc(h.id)}" data-to="${h.status === 'open' ? 'closed' : 'open'}">${h.status === 'open' ? '締め切る' : '募集を再開する'}</button>
            ${es.some(e => ['applied', 'accepted'].includes(e.status)) ? '' : `<button class="btn ghost small" data-hdel="${esc(h.id)}" style="color:var(--tomato)">削除</button>`}
          </div>
        </div>`;
      }).join('') : '<div class="empty">まだ募集はありません。<br>「＋ 募集する」から始められます。</div>'}</div>`;
    const again = () => renderMyHelps(head, []);
    $$('[data-resp]').forEach(b => b.addEventListener('click', async () => {
      if (b.dataset.to === 'declined' && !(await ask('見送りますか？\n相手には「今回は見送り」と表示されます。', '見送る'))) return;
      try { await api.respondHelp(b.dataset.resp, b.dataset.to); toast(b.dataset.to === 'accepted' ? '受け入れました。メッセージで集合場所を伝えましょう' : '更新しました'); again(); } catch (err) { toast(err.message); }
    }));
    $$('[data-hstatus]').forEach(b => b.addEventListener('click', async () => { try { await api.helpStatus(b.dataset.hstatus, b.dataset.to); again(); } catch (err) { toast(err.message); } }));
    $$('[data-hdel]').forEach(b => b.addEventListener('click', async () => {
      if (!(await ask('この募集を削除しますか？', '削除する', true))) return;
      try { await api.helpDelete(b.dataset.hdel); again(); } catch (err) { toast(err.message); }
    }));
    $$('[data-talk]').forEach(d => d.addEventListener('toggle', () => { if (d.open) talkBox($('.chat-slot', d), 'help', d.dataset.talk, true); }));
  }
  function renderHelpNew(head) {
    const f = DATA.mine;
    const min = (() => { const t = new Date(); t.setDate(t.getDate() + 1); return ymd(t); })();
    const hours = Array.from({ length: 19 }, (_, i) => i + 5);
    app.innerHTML = `
      ${head}
      <a class="back" href="#/mine/help">← お手伝いの募集へ</a>
      <h2 class="sec"><span class="ic">📝</span>お手伝いを募集する</h2>
      <form class="panel" id="hnForm" novalidate>
        <div class="field"><label for="hnTitle">やること（タイトル）*</label><input id="hnTitle" maxlength="40" placeholder="例：ミニトマトの収穫"></div>
        <div class="row2">
          <div class="field"><label for="hnDate">日にち *</label><input id="hnDate" type="date" min="${min}"></div>
          <div class="field"><label for="hnCap">募集人数</label><select id="hnCap">${[1, 2, 3, 4, 5, 6, 8, 10].map(n => `<option value="${n}" ${n === 2 ? 'selected' : ''}>${n}人</option>`).join('')}</select></div>
        </div>
        <div class="row2">
          <div class="field"><label for="hnFrom">何時から</label><select id="hnFrom">${hours.map(h => `<option value="${h}" ${h === 9 ? 'selected' : ''}>${h}:00</option>`).join('')}</select></div>
          <div class="field"><label for="hnTo">何時まで</label><select id="hnTo">${hours.map(h => `<option value="${h}" ${h === 12 ? 'selected' : ''}>${h}:00</option>`).join('')}</select></div>
        </div>
        <div class="field"><label for="hnPlace">集まる場所（おおまかに）</label><input id="hnPlace" maxlength="60" value="${esc(f.city)}" placeholder="例：徳地三谷の畑"><span class="hint">くわしい住所は、参加が決まった人にメッセージで伝えてください。</span></div>
        <div class="field"><label for="hnBody">くわしく</label><textarea id="hnBody" maxlength="1000" placeholder="作業の内容、体力の目安、雨の場合など"></textarea></div>
        <div class="field"><label for="hnThanks">お礼</label><input id="hnThanks" maxlength="60" placeholder="例：収穫した野菜のおすそわけ"><span class="hint">お金（日当・時給・交通費以上の支払い）は出せません。</span></div>
        <div class="field"><label for="hnBring">持ち物</label><input id="hnBring" maxlength="100" placeholder="例：軍手・帽子・飲み物"></div>
        <label style="display:flex;gap:8px;align-items:center;margin:4px 0;font-weight:700"><input type="checkbox" id="hnBeginner" style="width:auto" checked> はじめての方も歓迎</label>
        <label style="display:flex;gap:8px;align-items:center;margin:4px 0 12px;font-weight:700"><input type="checkbox" id="hnMeal" style="width:auto"> お昼ごはんあり</label>
        <label style="display:flex;gap:8px;align-items:center;margin:0 0 12px;font-weight:700"><input type="checkbox" id="hnAgree" style="width:auto"> お金を払う仕事ではなく、ボランティアの募集です。作業中の安全に気を配ります。</label>
        <button class="btn block leaf" type="submit" id="hnSave">募集する</button>
      </form>`;
    $('#hnForm').addEventListener('submit', async e => {
      e.preventDefault();
      const title = $('#hnTitle').value.trim(), date = $('#hnDate').value;
      const from = Number($('#hnFrom').value), to = Number($('#hnTo').value);
      if (!title) { toast('やることを入力してください'); $('#hnTitle').focus(); return; }
      if (!date || date < min) { toast('日にちは明日以降をえらんでください'); $('#hnDate').focus(); return; }
      if (to <= from) { toast('「何時まで」は「何時から」より後にしてください'); return; }
      if (!$('#hnAgree').checked) { toast('ボランティアの募集であることを確認して、チェックを入れてください'); return; }
      $('#hnSave').disabled = true;
      try {
        await api.helpSave(f.id, { title, date, from, to, capacity: Number($('#hnCap').value), place: $('#hnPlace').value.trim(), body: $('#hnBody').value.trim(),
          thanks: $('#hnThanks').value.trim(), bring: $('#hnBring').value.trim(), beginner: $('#hnBeginner').checked, meal: $('#hnMeal').checked });
        toast('募集しました！');
        go('#/mine/help');
      } catch (err) { toast(err.message); $('#hnSave').disabled = false; }
    });
  }

  // ======================================================================
  //  お店・飲食店からの「まとめ買い・仕入れの相談」
  //  取引（値段・請求・お届け）は、お店と農家さんが直接決める。アプリはきっかけとやりとりの場だけ。
  // ======================================================================
  function bizCard(b, asFarmer) {
    const f = findFarm(b.farmId);
    const row = (k, v) => v ? `<div class="small"><b>${k}</b>：${esc(v)}</div>` : '';
    return `
      <div class="order box">
        <div class="head"><b>🏪 ${esc(asFarmer ? b.shopName : (f ? f.farmName : '農家さん'))}</b><span class="status ${b.status === 'open' ? 'paid' : 'canceled'}">${b.status === 'open' ? '相談中' : '終了'}</span></div>
        <div class="small dim">${fmtDateTime(b.date)}${asFarmer ? ` ・ ${esc(b.shopKind)}${b.city ? ` ・ ${esc(b.city)}` : ''}` : ''}</div>
        ${row('ほしいもの', b.items)}${row('量', b.quantity)}${row('頻度', b.frequency)}${row('届け方', b.delivery)}${row('そのほか', b.note)}
        ${asFarmer ? `<div class="small dim">担当：${esc(b.contactName)} ・ 📞 <a href="tel:${esc(String(b.tel).replace(/[^\d]/g, ''))}">${esc(b.tel)}</a></div>` : ''}
        <details class="chat-toggle" data-biz="${esc(b.id)}" ${asFarmer ? '' : 'open'}><summary>💬 メッセージ</summary><div class="chat-slot"></div></details>
        ${b.status === 'open' ? `<div style="margin-top:6px"><button class="btn ghost small" data-bizclose="${esc(b.id)}">この相談を終える</button></div>` : ''}
      </div>`;
  }
  function bindBizCards(asFarmer, again) {
    $$('[data-biz]').forEach(d => {
      const load = () => talkBox($('.chat-slot', d), 'biz', d.dataset.biz, asFarmer, true);
      if (d.open) load();
      d.addEventListener('toggle', () => { if (d.open) load(); });
    });
    $$('[data-bizclose]').forEach(b => b.addEventListener('click', async () => {
      if (!(await ask('この相談を終えますか？', '終える'))) return;
      try { await api.bizClose(b.dataset.bizclose); again(); } catch (err) { toast(err.message); }
    }));
  }
  async function renderBiz(farmId) {
    const f = farmId ? findFarm(farmId) : null;
    if (needLogin()) {
      app.innerHTML = `<section class="hero-intro simple"><h1>🏪 お店・飲食店の方へ</h1></section><div style="margin-top:16px">${loginPanel('仕入れの相談をするには、ログインが必要です。')}</div>`;
      bindLogin(location.hash, () => renderBiz(farmId));
      return;
    }
    const mine = (await api.bizMine().catch(() => [])).filter(b => !f || b.farmId === f.id);
    const canSend = f && f.bizOk && !isMine(f);
    app.innerHTML = `
      ${f ? `<a class="back" href="#/farm/${esc(f.id)}">← ${esc(f.farmName)}にもどる</a>` : '<a class="back" href="#/orders">← 注文へもどる</a>'}
      <section class="hero-intro simple"><h1>🏪 まとめ買い・仕入れの相談</h1><p>${f ? `${esc(f.farmName)}さんに、お店・飲食店として相談できます。` : 'これまでに送った相談です。'}</p></section>
      ${f && f.bizNote ? `<div class="bubble" style="margin-top:12px">${esc(f.bizNote)}</div>` : ''}
      ${mine.length ? `<h2 class="sec"><span class="ic">💬</span>送った相談</h2><div class="order-list">${mine.map(b => bizCard(b, false)).join('')}</div>` : ''}
      ${canSend ? `
      <h2 class="sec"><span class="ic">📝</span>${mine.length ? '新しく相談する' : '相談する'}</h2>
      <form class="panel" id="bizForm" novalidate>
        <div class="row2">
          <div class="field"><label for="bzShop">お店の名前 *</label><input id="bzShop" maxlength="60" placeholder="例：レストラン仁保"></div>
          <div class="field"><label for="bzKind">業種</label><select id="bzKind">${['飲食店', '小売店・直売所', '旅館・ホテル', '給食・福祉施設', '加工業者', 'その他'].map(k => `<option>${k}</option>`).join('')}</select></div>
        </div>
        <div class="row2">
          <div class="field"><label for="bzCity">お店の市町</label><input id="bzCity" maxlength="30" placeholder="例：山口市"></div>
          <div class="field"><label for="bzName">担当の方のお名前 *</label><input id="bzName" maxlength="30"></div>
        </div>
        <div class="field"><label for="bzTel">電話番号 *</label><input id="bzTel" type="tel" maxlength="13" placeholder="083-000-0000"></div>
        <div class="field"><label for="bzItems">ほしいもの *</label><input id="bzItems" maxlength="300" placeholder="例：ミニトマト、規格外でもOK"></div>
        <div class="row2">
          <div class="field"><label for="bzQty">量</label><input id="bzQty" maxlength="200" placeholder="例：毎回5kgくらい"></div>
          <div class="field"><label for="bzFreq">頻度</label><select id="bzFreq">${['1回だけ', '週1回', '週2回以上', '月1〜2回', '旬の時期だけ', '相談したい'].map(k => `<option>${k}</option>`).join('')}</select></div>
        </div>
        <div class="field"><label for="bzDeliv">届け方</label><select id="bzDeliv">${['お店まで届けてほしい', '畑まで取りに行く', '配送でほしい', '相談したい'].map(k => `<option>${k}</option>`).join('')}</select></div>
        <div class="field"><label for="bzNote">そのほか</label><textarea id="bzNote" maxlength="600" placeholder="希望の値段、始めたい時期、請求書払いの希望など"></textarea></div>
        <p class="small dim">値段・お支払い（請求書など）・お届けは、農家さんと直接決めてください。このアプリは手数料をいただきません。</p>
        <button class="btn block leaf" type="submit" id="bzSend">相談を送る</button>
      </form>` : (f && !f.bizOk ? '<div class="empty">この農家さんは、いまお店からの相談を受け付けていません。</div>' : '')}`;
    bindBizCards(false, () => renderBiz(farmId));
    const form = $('#bizForm');
    if (form) form.addEventListener('submit', async e => {
      e.preventDefault();
      const b = { shopName: $('#bzShop').value.trim(), shopKind: $('#bzKind').value, city: $('#bzCity').value.trim(), contactName: $('#bzName').value.trim(),
        tel: $('#bzTel').value.trim(), items: $('#bzItems').value.trim(), quantity: $('#bzQty').value.trim(), frequency: $('#bzFreq').value, delivery: $('#bzDeliv').value, note: $('#bzNote').value.trim() };
      if (!b.shopName) { toast('お店の名前を入力してください'); $('#bzShop').focus(); return; }
      if (!b.contactName) { toast('担当の方のお名前を入力してください'); $('#bzName').focus(); return; }
      if (!TEL_RE.test(b.tel)) { toast('電話番号を確認してください'); $('#bzTel').focus(); return; }
      if (!b.items) { toast('ほしいものを入力してください'); $('#bzItems').focus(); return; }
      $('#bzSend').disabled = true;
      try { await api.bizSend(f.id, b); toast('相談を送りました！返事はここに届きます'); renderBiz(farmId); }
      catch (err) { toast(err.message); $('#bzSend').disabled = false; }
    });
  }

  // 画面で起きたエラーを運営に知らせる（1回の起動で5件まで）
  let errCount = 0;
  const reportError = (msg, where) => { if (errCount++ < 5 && api && api.logError) api.logError(msg, where || location.hash); };
  window.addEventListener('error', e => reportError(e.message, (e.filename || '').split('/').pop() + ':' + e.lineno));
  window.addEventListener('unhandledrejection', e => reportError('unhandled: ' + ((e.reason && e.reason.message) || e.reason)));

  async function route() {
    const seq = ++routeSeq;
    $('#cartbarSlot').innerHTML = '';
    const raw = location.hash.replace(/^#/, '') || '/';
    const [path, query] = raw.split('?');
    const parts = path.split('/').filter(Boolean);
    if (parts[0] !== 'mine' || parts[1] !== 'profile') { draftProducts = null; editingIdx = -1; }
    if (parts[0]) state.changingHome = false;
    const tab = ['farm', 'checkout', 'legal', 'law', 'guide', 'faq', 'contact', 'biz'].includes(parts[0]) ? '' : parts[0] === 'order' ? 'orders' : parts[0] === 'follows' ? 'feed' : (parts[0] || 'explore');
    $$('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
    window.scrollTo(0, 0);
    try {
      if (parts[0] === 'farm' && parts[1]) await renderFarm(decodeURIComponent(parts[1]));
      else if (parts[0] === 'checkout' && parts[1]) renderCheckout(decodeURIComponent(parts[1]));
      else if (parts[0] === 'order' && parts[1]) await renderOrder(decodeURIComponent(parts[1]), /(^|&)new=1/.test(query || ''));
      else if (parts[0] === 'orders') await renderOrders();
      else if (parts[0] === 'feed') renderFeed();
      else if (parts[0] === 'follows') renderFollows();
      else if (parts[0] === 'mine') await renderMine(parts[1], parts.slice(2), query);
      else if (parts[0] === 'legal') renderLegal(parts[1]);
      else if (parts[0] === 'help') { if (parts[1]) await renderHelp(decodeURIComponent(parts[1])); else await renderHelpList(); }
      else if (parts[0] === 'biz') await renderBiz(parts[1] ? decodeURIComponent(parts[1]) : null);
      else if (parts[0] === 'guide') renderGuide(parts[1]);
      else if (parts[0] === 'faq') renderFaq();
      else if (parts[0] === 'contact') await renderContact(query);
      else if (parts[0] === 'law' && parts[1]) renderLaw(decodeURIComponent(parts[1]));
      else renderExplore();
    } catch (err) {
      console.error(err);
      reportError('route: ' + (err.message || err), location.hash);
      if (seq === routeSeq) app.innerHTML = `<div class="empty">読み込みに失敗しました。通信状況を確認して、もう一度お試しください。<br><small>${esc(err.message || '')}</small></div>`;
    }
    window.__booted = true;
    if (seq === routeSeq) updateBadge();
  }
  window.addEventListener('hashchange', route);

  // ---------- テーマ ----------
  function applyTheme(t) { if (t) document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme'); }
  applyTheme(store.get(KEY.theme, null));
  $('#themeBtn').addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    store.set(KEY.theme, next);
  });

  // ---------- 起動 ----------
  (async () => {
    if (WANT_LIVE) {
      try { await live.init(); api = live; } catch (err) {
        console.error(err);
        app.innerHTML = '<div class="empty">サーバーに接続できませんでした。通信状況を確認して、アプリを開きなおしてください。</div>';
        window.__booted = true;
        return;
      }
    }
    $('#modeTag').hidden = api.mode !== 'demo';
    try { await reload(); } catch (err) {
      console.error(err);
      app.innerHTML = '<div class="empty">農家さんの情報を読み込めませんでした。アプリを開きなおしてください。</div>';
      window.__booted = true;
      return;
    }
    route();
    setTimeout(() => showIntro(false), 1000);
    // オフラインでも開けるように、画面のファイルを端末に保存しておく
    if ('serviceWorker' in navigator && location.protocol === 'https:' && !NATIVE) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  })();
})();
