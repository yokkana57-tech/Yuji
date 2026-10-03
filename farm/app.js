(() => {
  'use strict';

  // ---------- 地図データ（geo.js） ----------
  const GEO = window.YGEO;
  if (!GEO) throw new Error('地図データ（geo.js）を読み込めませんでした');

  // ---------- 実行環境 ----------
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
    cart: 'yamahata.cart', next: 'yamahata.next', market: 'yamahata.market', mkmsg: 'yamahata.mkmsg', install: 'yamahata.install'
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
        createdAt: r.created_at, checkoutUrl: r.stripe_checkout_url, refundStatus: r.refund_status
      };
    },
    async loadFarms() {
      const { data, error } = await this.sb.from('farms').select('*, products(*), posts(*)').eq('published', true);
      if (error) throw error;
      return data.map(r => this.farmFrom(r));
    },
    async myFarm() {
      if (!this.user) return null;
      const { data } = await this.sb.from('farms').select('*, products(*), posts(*)').eq('owner_id', this.user.id).maybeSingle();
      return data ? this.farmFrom(data) : null;
    },
    async saveFarm(f) {
      const row = {
        farm_name: f.farmName, farmer: f.farmer, city: f.city, lat: f.lat, lng: f.lng, lat_picked: f.latPicked,
        since: f.since || null, area: f.area, emoji: f.emoji, hue: f.hue, catch: f.catch, story: f.story, cover_url: f.coverUrl || null,
        methods: f.methods, certs: f.certs, pickup: f.pickup, cancel_days: f.cancelDays, published: true
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
    async cancelOrder(id) { return this.invoke('cancel-order', { order_id: id }); },
    async farmOrders(farmId) {
      const { data } = await this.sb.from('orders').select('*').eq('farm_id', farmId).neq('status', 'pending_payment').order('created_at', { ascending: false });
      return (data || []).map(r => this.orderFrom(r));
    },
    async updateOrder(id, to, code) {
      const { error } = await this.sb.rpc('farmer_update_order', { p_order: id, p_to: to, p_code: code || null });
      if (error) throw new Error({ wrong_code: '受け取りコードがちがいます', bad_transition: 'この注文はもう更新できません（キャンセルされた可能性があります）' }[error.message] || error.message);
    },
    async connect(action) { return this.invoke('connect-account', { action }); },
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
      return m ? [m, ...samples] : samples;
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
        pickup: pl.method === 'pickup' ? { date: pl.pickup.date, hour: pl.pickup.hour, time: `${pl.pickup.hour}:00〜${pl.pickup.hour + 1}:00`, place: f.pickup.place || f.city, msg: pl.pickup.msg } : null,
        ship: pl.method === 'ship' ? { zip: pl.ship.zip, pref: '山口県', addr: pl.ship.addr } : null,
        buyer: pl.buyer, status: 'paid', cancelDeadline: new Date(deadline).toISOString(), createdAt: new Date().toISOString()
      };
      const list = store.get(KEY.orders, []);
      list.unshift(order);
      if (!store.set(KEY.orders, list)) throw new Error('保存できませんでした');
      this.changeStock(f, lines, -1);
      return { orderId: order.id };
    },
    async myOrders() { return store.get(KEY.orders, []); },
    async order(id) { return store.get(KEY.orders, []).find(o => o.id === id) || null; },
    async cancelOrder(id) {
      const list = store.get(KEY.orders, []);
      const o = list.find(x => x.id === id);
      if (!o || o.status !== 'paid' || Date.now() >= new Date(o.cancelDeadline).getTime()) throw new Error('この注文はキャンセルできません（期限切れ、または農家さんが準備を始めています）。');
      o.status = 'canceled'; o.refundStatus = 'refunded';
      store.set(KEY.orders, list);
      const f = DATA.farms.find(x => x.id === o.farmId);
      if (f) this.changeStock(f, o.items, +1);
      return { status: 'canceled' };
    },
    async farmOrders(farmId) { return store.get(KEY.orders, []).filter(o => o.farmId === farmId); },
    async updateOrder(id, to, code) {
      const list = store.get(KEY.orders, []);
      const o = list.find(x => x.id === id);
      const ok = o && ((o.method === 'pickup' && o.status === 'paid' && to === 'ready') || (o.method === 'ship' && o.status === 'paid' && to === 'shipped') ||
        (o.method === 'pickup' && o.status === 'ready' && to === 'done') || (o.method === 'ship' && o.status === 'shipped' && to === 'done'));
      if (!ok) throw new Error('この注文はもう更新できません（キャンセルされた可能性があります）');
      if (o.method === 'pickup' && to === 'done' && code !== o.code) throw new Error('受け取りコードがちがいます');
      o.status = to;
      store.set(KEY.orders, list);
    },
    async connect() { return { connected: true, charges_enabled: true }; },
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
        <p class="small dim" style="margin:14px 0 0;font-size:.68rem">地名データ：Geolonia 住所データ（CC BY 4.0）／ 地図：国土数値情報（行政区域データ）を加工</p>
      </section>`;
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
    const buyable = f.chargesEnabled ? (f.products || []).filter(p => inSeason(p) && p.stock > 0) : [];
    const minPrice = buyable.length ? Math.min(...buyable.map(p => canPickup(f) ? p.pickupPrice : p.shipPrice)) : null;
    return `
      <a class="card" href="#/farm/${esc(f.id)}">
        <div class="thumb ${safeUrl(f.coverUrl) ? 'has-photo' : ''}" style="${thumbStyle(f)}"><span class="em">${esc(f.emoji)}</span><span class="loc">📍 ${esc(f.city)}</span>${typeof dist === 'number' ? `<span class="dist">🚗 ${fmtKm(dist)}</span>` : ''}${canPickup(f) ? '<span class="meet">会いに行ける</span>' : ''}</div>
        <div class="card-body">
          <h3>${esc(f.farmName)}${isMine(f) ? ' <span class="tag corn">あなたの農園</span>' : ''}</h3>
          <div class="small dim">${esc(f.farmer)}${yearsFarming(f) !== null ? `・農業${yearsFarming(f)}年目` : ''}</div>
          <div class="catch">${esc(f.catch)}</div>
          <div class="tags">
            ${season.length ? `<span class="tag tomato">いま旬：${esc(season.slice(0, 2).join('・'))}</span>` : ''}
            ${pest && pest.short ? `<span class="tag">${esc(pest.short)}</span>` : ''}
            ${(f.certs || []).map(c => `<span class="tag eggplant">${esc(c)}</span>`).join('')}
          </div>
          <div class="price-from">${minPrice !== null ? `いま買える：<b>${yen(minPrice)}</b>〜${canPickup(f) ? '（畑で受け取り）' : '（送料込み）'}` : (f.chargesEnabled ? 'いま買えるものは準備中' : 'オンライン注文の準備中')}</div>
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
        <div class="row"><dt>受け取り日</dt><dd>${pk.days.slice().sort().map(d => WEEK[d]).join('・')}曜日</dd></div>
        <div class="row"><dt>時間</dt><dd>${pk.from}:00〜${pk.to}:00</dd></div>
        ${pk.note ? `<div class="row"><dt>ひとこと</dt><dd>${esc(pk.note)}</dd></div>` : ''}
      </dl></div>`;
  }
  // 受け取り方法（発送 / 畑で受け取り）。カートと一緒に覚えておき、注文手続きでも最初から選ばれた状態にする
  const howOf = f => (canPickup(f) && cart.farmId === f.id && cart.method === 'pickup') ? 'pickup' : 'ship';
  function productCard(f, p, how = howOf(f)) {
    const season = inSeason(p);
    const qty = cart.farmId === f.id ? (cart.items[p.id] || 0) : 0;
    const next = nextMonthOf(p);
    const pick = canPickup(f);
    let foot;
    if (!f.chargesEnabled) foot = '<div class="small dim">🛠 オンライン注文の準備中です</div>';
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
      <div class="prod ${season && p.stock > 0 && f.chargesEnabled ? '' : 'off'}">
        <div><span class="tag ${CAT_COLOR[p.cat] || ''}">${CATS[p.cat] || ''}</span> ${season ? '<span class="tag tomato">いま旬</span>' : ''}</div>
        <h3>${esc(p.name)}</h3>
        <div class="unit">${esc(p.unit)}${p.note ? ` ・ ${esc(p.note)}` : ''}</div>
        <div class="prices" style="${pick ? '' : 'grid-template-columns:1fr'}">
          ${pick ? `
          <button type="button" class="price ship ${how === 'ship' ? 'on' : ''}" data-how="ship" aria-pressed="${how === 'ship'}"><small>📦 県内配送（送料込み）</small><b>${yen(p.shipPrice)}</b></button>
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
        <button type="button" role="radio" data-how="ship"><b>📦 家に届けてもらう</b><small>山口県内・送料込み</small></button>
        <button type="button" role="radio" data-how="pickup"><b>🚗 畑で受け取る</b><small>${pickupDates(f).length ? '送料なし・農家さんに会える' : '2週間以内に受け取り日がありません'}</small></button>
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
          <p class="small dim" style="margin-top:8px">${esc(f.city)}（位置はおおよそです）・<a href="${gmapUrl(f)}" target="_blank" rel="noopener">Googleマップで開く</a></p>
        </div>
      </div>

      <h2 class="sec"><span class="ic">🚗</span>畑での受け取り</h2>
      <div class="box">${pickupInfo(f)}</div>

      <h2 class="sec"><span class="ic">📅</span>旬カレンダー</h2>
      ${seasonCalendar(f.products)}

      <h2 class="sec"><span class="ic">📰</span>畑だより</h2>
      <div class="posts">${posts.length ? posts.map(p => postItem(p, f)).join('') : '<div class="empty">まだ投稿がありません。</div>'}</div>

      <h2 class="sec" id="cheerSec"><span class="ic">💌</span>届いた声</h2>
      <div class="cheers" id="cheerList"><div class="small dim">よみこみ中…</div></div>
      <div id="cheerFormSlot" style="margin-top:14px"></div>
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
    const startPick = pick && dates.length > 0 && howOf(f) === 'pickup';
    const hours = pick ? Array.from({ length: Math.max(0, f.pickup.to - f.pickup.from) }, (_, i) => f.pickup.from + i) : [];

    app.innerHTML = `
      <a class="back" href="#/farm/${esc(f.id)}">← ${esc(f.farmName)}にもどる</a>
      <section class="hero-intro simple"><h1>ご注文手続き</h1><p>${esc(f.farmName)}（${esc(f.city)}）への注文です。</p></section>

      <form id="coForm" novalidate>
        <h2 class="sec"><span class="ic">🚚</span>受け取り方法</h2>
        <div class="choice">
          <label><input type="radio" name="method" value="ship" ${startPick ? '' : 'checked'}>
            <span class="t">📦 家に届けてもらう<small>山口県内のみ・送料込み</small></span>
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
          <h2 class="sec"><span class="ic">📅</span>受け取り日時</h2>
          <div class="panel">
            <div class="row2">
              <div class="field"><label for="pDate">日にち</label><select id="pDate">${dates.map(d => `<option value="${d}">${fmtDay(d)}</option>`).join('')}</select></div>
              <div class="field"><label for="pTime">時間</label><select id="pTime">${hours.map(h => `<option value="${h}">${h}:00〜${h + 1}:00</option>`).join('')}</select></div>
            </div>
            <div class="small"><b>📍 ${esc(pick ? (f.pickup.place || f.city) : '')}</b></div>
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

        <div class="notice" id="cancelNote"></div>
        ${api.mode === 'demo'
          ? '<p class="notice">🧪 お試し版です。ボタンを押しても<b>実際の請求は発生しません</b>（支払ったことにして注文が入ります）。</p>'
          : '<p class="notice">💳 次の画面（Stripe）で、クレジットカードなどでお支払いいただきます。カード情報はこのアプリには保存されません。</p>'}
        <button class="btn block" type="submit" style="margin-top:16px;font-size:1.05rem;padding:12px" id="payBtn"></button>
      </form>
    `;

    const method = () => ($('input[name=method]:checked') || {}).value || 'ship';
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
      $('#cancelNote').innerHTML = `↩️ キャンセルは、注文から<b>${f.cancelDays || 2}日以内</b>${mtd === 'pickup' ? '（受け取り日の前日まで）' : ''}、農家さんが準備を始める前までできます。全額返金します。`;
      $('#payBtn').textContent = api.mode === 'demo' ? `${yen(total)} で注文する（お試し）` : `${yen(total)} のお支払いへ進む`;
    }
    $$('input[name=method]').forEach(r => r.addEventListener('change', () => { cart.method = method(); saveCart(); refresh(); }));
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
    pickup: [['paid', 'お支払い済み'], ['ready', '準備OK'], ['done', '受け取り完了']]
  };
  function statusLabel(o) {
    if (o.status === 'pending_payment') return 'お支払い待ち';
    if (o.status === 'canceled') return 'キャンセル済み';
    if (o.status === 'expired') return '取り消し';
    return (STATUS[o.method].find(s => s[0] === o.status) || [, ''])[1];
  }
  function statusSteps(o) {
    if (['pending_payment', 'canceled', 'expired'].includes(o.status)) return '';
    const st = STATUS[o.method];
    const idx = st.findIndex(s => s[0] === o.status);
    return `<div class="steps">${st.map((s, i) => `<div class="${i <= idx ? 'on' : ''}">${s[1]}</div>`).join('')}</div>`;
  }
  const canCancel = o => o.status === 'paid' && Date.now() < new Date(o.cancelDeadline).getTime();
  function orderCard(o) {
    return `
      <a class="order box" href="#/order/${esc(o.id)}">
        <div class="head"><b>${esc(o.farmEmoji)} ${esc(o.farmName)}</b><span class="status ${esc(o.status)}">${esc(statusLabel(o))}</span></div>
        <div class="small dim">${fmtDate(o.createdAt)} 注文 ・ ${o.method === 'pickup' ? `🚗 ${fmtDay(o.pickup.date)} ${esc(o.pickup.time)} 受け取り` : '📦 配送'}</div>
        <div class="small">${o.items.map(i => `${esc(i.name)}×${i.qty}`).join('、')}</div>
        <div><b>${yen(o.total)}</b>${canCancel(o) ? ` <span class="small dim">・${fmtDateTime(o.cancelDeadline)}までキャンセルできます</span>` : ''}</div>
      </a>`;
  }
  function accountFooter() {
    return api.mode === 'live'
      ? `<p class="small dim" style="margin-top:24px">${esc(api.user.email)} でログイン中 ・ <button class="linkbtn" data-logout>ログアウト</button> ・ <button class="linkbtn" data-delacct style="color:var(--tomato)">アカウントを削除</button></p>`
      : '<p class="small dim" style="margin-top:24px"><button class="linkbtn" data-delacct style="color:var(--tomato)">お試し版のデータをすべて消す</button></p>';
  }
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
    app.innerHTML = `
      <section class="hero-intro simple"><h1>注文したもの</h1><p>注文の状況・受け取りコード・キャンセルはここから。</p></section>
      <div class="order-list" style="margin-top:18px">${list.length ? list.map(orderCard).join('') : '<div class="empty">まだ注文はありません。<br><a href="#/">農家さんをさがす →</a></div>'}</div>
      ${accountFooter()}`;
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
    else if (canCancel(o)) cancelHtml = `
      <div class="cancel-box">↩️ <b>${fmtDateTime(o.cancelDeadline)}</b> まで、キャンセルできます（全額返金）。
        <div style="margin-top:10px"><button class="btn danger small" id="cancelBtn">この注文をキャンセルする</button></div></div>`;
    else if (o.status === 'paid') cancelHtml = '<div class="cancel-box">キャンセルの期限を過ぎました。ご都合が悪くなった場合は、農家さんにお電話でご相談ください。</div>';
    else if (o.status === 'ready' || o.status === 'shipped') cancelHtml = '<div class="cancel-box">農家さんが準備を始めたため、キャンセルはできません。</div>';
    else if (o.status === 'canceled') cancelHtml = `<div class="cancel-box">この注文はキャンセルしました。${o.refundStatus === 'failed' ? '返金の手続きでエラーが起きたため、運営からご連絡します。' : '代金は全額返金されます（カード会社によって反映まで数日かかります）。'}</div>`;
    else if (o.status === 'expired') cancelHtml = '<div class="cancel-box">お支払いが完了しなかったため、この注文は取り消されました。</div>';

    app.innerHTML = `
      <a class="back" href="#/orders">← 注文一覧へ</a>
      ${isNew && o.status === 'paid' ? `<section class="hero-intro"><span class="float a">🎉</span><h1>ご注文ありがとうございます！</h1><p>${esc(o.farmName)}さんに注文が届きました。</p></section>` : ''}
      <h2 class="sec"><span class="ic">${pickup ? '🚗' : '📦'}</span>${pickup ? '畑での受け取り' : '配送'} <span class="status ${esc(o.status)}">${esc(statusLabel(o))}</span></h2>
      <div class="panel">
        ${statusSteps(o)}
        ${pickup ? `
          <p style="margin:8px 0 4px"><b>${fmtDay(o.pickup.date)} ${esc(o.pickup.time)}</b></p>
          <p class="small" style="margin:0">📍 ${esc(o.pickup.place)}${typeof loc.lat === 'number' ? ` ・ <a href="${gmapUrl(loc)}" target="_blank" rel="noopener">Googleマップで道順を見る</a>` : ''}</p>
          ${['paid', 'ready'].includes(o.status) ? `<p class="small dim" style="margin:12px 0 6px">受け取りのときに、この番号を農家さんに伝えてください。</p><div class="code" aria-label="受け取りコード">${esc(o.code)}</div>` : ''}`
        : `<p class="small" style="margin:8px 0 0">お届け先：〒${esc(o.ship.zip)} ${esc(o.ship.pref)} ${esc(o.ship.addr)}</p>
           <p class="small dim" style="margin:4px 0 0">発送されたら、ここの状況が「発送済み」に変わります。</p>`}
        ${cancelHtml}
      </div>
      <h2 class="sec"><span class="ic">🧾</span>ご注文内容</h2>
      <div class="panel">
        <table class="lines">
          ${o.items.map(i => `<tr><td>${esc(i.name)}<br><span class="small dim">${esc(i.unit)} × ${i.qty}</span></td><td class="r">${yen(i.price * i.qty)}</td></tr>`).join('')}
          <tr class="total"><td>合計 <span class="small dim">${pickup ? '（送料なし）' : '（送料込み）'}</span></td><td class="r">${yen(o.total)}</td></tr>
        </table>
        <p class="small dim" style="margin:8px 0 0">注文番号 ${esc(String(o.id).slice(0, 8))}${api.mode === 'demo' ? '（お試し版）' : ''}</p>
      </div>
      <div class="actions">${o.farmId ? `<a class="btn leaf" href="#/farm/${esc(o.farmId)}">${esc(o.farmName)}のページへ</a>` : ''}
      ${o.status === 'done' && o.farmId ? `<a class="btn corn" href="#/farm/${esc(o.farmId)}">💌 感想を届ける</a>` : ''}</div>
    `;
    const pa = $('#payAgain');
    if (pa) pa.addEventListener('click', () => openExternal(o.checkoutUrl, () => renderOrder(o.id, true)));
    const cb = $('#cancelBtn');
    if (cb) cb.addEventListener('click', async () => {
      if (!(await ask(o.status === 'pending_payment' ? 'この注文をやめますか？' : 'この注文をキャンセルしますか？\n代金は全額返金されます。', 'キャンセルする', true))) return;
      cb.disabled = true;
      try {
        await api.cancelOrder(o.id);
        await reload();
        toast(o.status === 'pending_payment' ? '注文をやめました' : 'キャンセルしました');
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
      pickup: { enabled: true, place: '', days: [6], from: 9, to: 16, note: '' }
    };
  }
  function subnav(cur, pending) {
    const items = [['orders', '🧾 注文', '#/mine'], ['posts', '✏️ 畑だより', '#/mine/posts'], ['market', '🤝 なかま市', '#/mine/market'], ['profile', '🏡 プロフィール', '#/mine/profile']];
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
    const pending = (await api.farmOrders(DATA.mine.id)).filter(o => ['paid', 'ready', 'shipped'].includes(o.status)).length;
    const head = subnav(sub || 'orders', pending);
    if (sub === 'posts') return renderMyPosts(head);
    if (sub === 'market') {
      if (rest[0] === 'new') return renderMarketNew(head);
      if (rest[0]) return renderMarketItem(head, decodeURIComponent(rest[0]));
      return renderMarket(head);
    }
    if (sub === 'profile') return renderProfile(false, head);
    return renderFarmerOrders(head);
  }

  // ---- 注文の管理 ----
  function farmerOrderCards(list) {
    if (!list.length) return '<div class="empty">まだ注文はありません。</div>';
    return list.map(o => {
      const pickup = o.method === 'pickup';
      let act = '';
      if (o.status === 'paid') act = `
        <div class="small dim">お客さんは ${fmtDateTime(o.cancelDeadline)} までキャンセルできます。準備を始めると、キャンセルできなくなります。</div>
        <div><button class="btn corn small" data-adv="${esc(o.id)}" data-to="${pickup ? 'ready' : 'shipped'}">${pickup ? '準備できた' : '発送した'}</button></div>`;
      else if (o.status === 'ready') act = `
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
          <input data-code-for="${esc(o.id)}" inputmode="numeric" maxlength="4" placeholder="受け取りコード" aria-label="受け取りコード" style="width:150px;padding:6px 12px;border:2px solid var(--ink);border-radius:999px;background:var(--surface-2)">
          <button class="btn leaf small" data-done="${esc(o.id)}">受け渡し完了</button></div>`;
      else if (o.status === 'shipped') act = `<div><button class="btn leaf small" data-adv="${esc(o.id)}" data-to="done">お届け完了にする</button></div>`;
      return `
        <div class="order box">
          <div class="head"><b>${esc(o.buyer.name)} さん</b><span class="status ${esc(o.status)}">${esc(statusLabel(o))}</span></div>
          <div class="small">${pickup ? `🚗 <b>${fmtDay(o.pickup.date)} ${esc(o.pickup.time)}</b> に受け取り` : `📦 配送：〒${esc(o.ship.zip)} ${esc(o.ship.pref)} ${esc(o.ship.addr)}`}</div>
          <div class="small">${o.items.map(i => `${esc(i.name)}（${esc(i.unit)}）×${i.qty}`).join('、')}</div>
          ${pickup && o.pickup.msg ? `<div class="cheer small">💬 ${esc(o.pickup.msg)}</div>` : ''}
          <div class="small dim">📞 <a href="tel:${esc(String(o.buyer.tel).replace(/[^\d]/g, ''))}">${esc(o.buyer.tel)}</a> ・ ${yen(o.total)}${o.status === 'canceled' ? '（キャンセル・返金済み）' : '（支払い済み）'}</div>
          ${act}
        </div>`;
    }).join('');
  }
  async function renderFarmerOrders(head) {
    const f = DATA.mine;
    const list = await api.farmOrders(f.id);
    app.innerHTML = `
      ${head}
      ${api.mode === 'live' && !f.chargesEnabled ? `
        <div class="panel" style="margin:8px 0 16px">
          <h3 style="font-size:1rem">🏦 売上の受け取り口座を登録してください</h3>
          <p class="small" style="margin:6px 0 10px">注文を受けるには、売上を受け取る銀行口座の登録が必要です（Stripe という決済サービスの画面で、本人確認と口座を登録します）。</p>
          <button class="btn leaf" id="connectBtn">${f.stripeLinked ? '口座登録のつづきをする' : '受け取り口座を登録する'}</button>
        </div>` : ''}
      <h2 class="sec" style="margin-top:12px"><span class="ic">🧾</span>届いた注文</h2>
      <div class="order-list" id="farmerOrders">${farmerOrderCards(list)}</div>
      <p class="small dim" style="margin-top:16px"><a href="#/farm/${esc(f.id)}">お客さんから見た農園ページ →</a></p>`;
    const cn = $('#connectBtn');
    if (cn) cn.addEventListener('click', async () => {
      cn.disabled = true;
      try { const r = await api.connect('onboard'); openExternal(r.url, async () => { const st = await api.connect('status'); await reload(); toast(st.charges_enabled ? '口座の登録が完了しました！' : '口座の登録がまだ途中です'); route(); }); }
      catch (err) { toast(err.message); cn.disabled = false; }
    });
    function bindOrders() {
      $$('[data-adv]').forEach(b => b.addEventListener('click', async () => {
        if (b.dataset.to !== 'done' && !(await ask('準備を始めると、お客さんはキャンセルできなくなります。よろしいですか？', b.dataset.to === 'ready' ? '準備できた' : '発送した'))) return;
        try { await api.updateOrder(b.dataset.adv, b.dataset.to); toast('更新しました'); } catch (err) { toast(err.message); }
        $('#farmerOrders').innerHTML = farmerOrderCards(await api.farmOrders(f.id)); bindOrders(); updateBadge();
      }));
      $$('[data-done]').forEach(b => b.addEventListener('click', async () => {
        const input = $(`[data-code-for="${CSS.escape(b.dataset.done)}"]`);
        try { await api.updateOrder(b.dataset.done, 'done', input.value.trim()); toast('受け渡し完了！ありがとうございました'); }
        catch (err) { toast(err.message); input.focus(); return; }
        $('#farmerOrders').innerHTML = farmerOrderCards(await api.farmOrders(f.id)); bindOrders(); updateBadge();
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

        <h3 style="margin:20px 0 8px;font-size:1rem">🚗 畑での受け取り</h3>
        <div class="field"><label style="display:flex;gap:8px;align-items:center;font-weight:900"><input type="checkbox" id="pkOn" style="width:auto" ${f.pickup.enabled ? 'checked' : ''}> 畑での受け取りを受け付ける</label>
          <span class="hint">お客さんが畑まで取りに来ます。送料がかからない分、配送より安い価格を設定できます。</span></div>
        <div id="pkFields">
          <div class="field"><label for="pkPlace">受け取り場所</label><input id="pkPlace" maxlength="80" value="${esc(f.pickup.place)}" placeholder="例：畑の横の直売小屋"><span class="hint">ご自宅の住所は書かなくて大丈夫です。</span></div>
          <div class="field"><span class="field-label">受け取りできる曜日</span>
            <div class="weekdays">${WEEK.map((w, i) => `<label><input type="checkbox" name="pkDay" value="${i}" ${(f.pickup.days || []).includes(i) ? 'checked' : ''}>${w}</label>`).join('')}</div></div>
          <div class="row2">
            <div class="field"><label for="pkFrom">何時から</label><select id="pkFrom">${hours.map(h => `<option value="${h}" ${f.pickup.from === h ? 'selected' : ''}>${h}:00</option>`).join('')}</select></div>
            <div class="field"><label for="pkTo">何時まで</label><select id="pkTo">${hours.map(h => `<option value="${h}" ${f.pickup.to === h ? 'selected' : ''}>${h}:00</option>`).join('')}</select></div>
          </div>
          <div class="field"><label for="pkNote">お客さんへひとこと</label><input id="pkNote" maxlength="80" value="${esc(f.pickup.note)}" placeholder="例：収穫体験もできます！"></div>
        </div>

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
          <button class="btn corn small" type="button" id="addProd">＋ この品目を追加</button>
          <button class="btn ghost small" type="button" id="cancelEdit" hidden>編集をやめる</button>
        </div>

        <div class="actions">
          <button class="btn" type="submit" id="saveFarm">${existing ? '変更を保存' : '登録して公開する'}</button>
          ${existing ? '<button class="btn danger" type="button" id="deleteFarm">農園の登録を削除</button>' : ''}
        </div>
      </form>
      ${api.mode === 'demo' ? '<p class="notice">お試し版のため、登録内容と注文はこの端末のブラウザ内にだけ保存されます。</p>' : ''}
      ${accountFooter()}
    `;
    bindAccount(() => route());
    const cover = photoPicker($('#coverPick'), f.coverUrl ? [f.coverUrl] : [], 1, '畑の写真');

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
        certs: $('#fCerts').value.split(/[,、，]/).map(s => s.trim()).filter(Boolean),
        pickup: { enabled: pkOn, place: $('#pkPlace').value.trim(), days: pkDays, from, to, note: $('#pkNote').value.trim() },
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
    try { if (!needLogin()) n = (await api.myOrders()).filter(o => ['paid', 'ready', 'shipped'].includes(o.status)).length; } catch (e) { /* noop */ }
    const a = $('#tabs a[data-tab=orders]');
    const b = a.querySelector('.badge');
    if (n && !b) a.insertAdjacentHTML('beforeend', `<span class="badge">${n}</span>`);
    else if (n && b) b.textContent = n;
    else if (!n && b) b.remove();
  }
  // 同じ画面への移動でも描き直す（hashchange が起きないため）
  function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
  let routeSeq = 0;
  async function route() {
    const seq = ++routeSeq;
    $('#cartbarSlot').innerHTML = '';
    const raw = location.hash.replace(/^#/, '') || '/';
    const [path, query] = raw.split('?');
    const parts = path.split('/').filter(Boolean);
    if (parts[0] !== 'mine' || parts[1] !== 'profile') { draftProducts = null; editingIdx = -1; }
    if (parts[0]) state.changingHome = false;
    const tab = parts[0] === 'farm' || parts[0] === 'checkout' ? '' : (parts[0] === 'order' ? 'orders' : (parts[0] || 'explore'));
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
      else renderExplore();
    } catch (err) {
      console.error(err);
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
    // オフラインでも開けるように、画面のファイルを端末に保存しておく
    if ('serviceWorker' in navigator && location.protocol === 'https:' && !NATIVE) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  })();
})();
