// メニューのデータ（price は税抜の値段・円）
// allergens は特定原材料8品目のうち含むもの。isAlcohol はお酒かどうか
// dislikeTags は苦手な食材（ねぎ／内臓／魚介／トマト／わさび／梅）のうち含むもの。おすすめで使う
// yomi はひらがなのよみ、keywords は関係する言葉。どちらも検索で使う
const menu = [
  { id: 1, name: "枝豆", price: 350, category: "前菜", allergens: [], isAlcohol: false, dislikeTags: [],
    yomi: "えだまめ", keywords: ["豆", "塩", "さっぱり", "おつまみ", "野菜", "ヘルシー"] },
  { id: 2, name: "冷やしトマト", price: 380, category: "前菜", allergens: [], isAlcohol: false, dislikeTags: ["トマト"],
    yomi: "ひやしとまと", keywords: ["トマト", "野菜", "さっぱり", "冷たい", "つめたい", "ヘルシー"] },
  { id: 3, name: "冷奴", price: 380, category: "前菜", allergens: [], isAlcohol: false, dislikeTags: ["ねぎ"],
    yomi: "ひややっこ", keywords: ["豆腐", "とうふ", "さっぱり", "冷たい", "つめたい", "ヘルシー"] },
  { id: 4, name: "ポテトサラダ", price: 450, category: "前菜", allergens: ["卵"], isAlcohol: false, dislikeTags: [],
    yomi: "ぽてとさらだ", keywords: ["じゃがいも", "ポテサラ", "サラダ", "野菜", "マヨネーズ"] },
  { id: 5, name: "たこわさ", price: 400, category: "前菜", allergens: [], isAlcohol: false, dislikeTags: ["魚介", "わさび"],
    yomi: "たこわさ", keywords: ["たこ", "わさび", "魚介", "さっぱり", "おつまみ"] },
  { id: 6, name: "キャベツ盛り", price: 300, category: "前菜", allergens: [], isAlcohol: false, dislikeTags: [],
    yomi: "きゃべつもり", keywords: ["キャベツ", "野菜", "さっぱり", "ヘルシー"] },
  { id: 7, name: "鶏皮ポン酢", price: 420, category: "前菜", allergens: ["小麦"], isAlcohol: false, dislikeTags: ["ねぎ"],
    yomi: "とりかわぽんず", keywords: ["鶏", "とり", "皮", "ポン酢", "さっぱり", "おつまみ"] },

  { id: 8, name: "もも（タレ・1本）", price: 180, category: "焼き鳥", allergens: ["小麦"], isAlcohol: false, dislikeTags: [],
    yomi: "ももたれ", keywords: ["鶏", "とり", "焼き鳥", "やきとり", "タレ", "串", "定番"] },
  { id: 9, name: "ねぎま（タレ・1本）", price: 180, category: "焼き鳥", allergens: ["小麦"], isAlcohol: false, dislikeTags: ["ねぎ"],
    yomi: "ねぎまたれ", keywords: ["鶏", "とり", "ねぎ", "焼き鳥", "やきとり", "タレ", "串", "定番"] },
  { id: 10, name: "つくね（タレ・1本）", price: 200, category: "焼き鳥", allergens: ["卵", "小麦"], isAlcohol: false, dislikeTags: [],
    yomi: "つくねたれ", keywords: ["鶏", "とり", "ひき肉", "焼き鳥", "やきとり", "タレ", "串", "名物"] },
  { id: 11, name: "皮（塩・1本）", price: 160, category: "焼き鳥", allergens: [], isAlcohol: false, dislikeTags: [],
    yomi: "かわしお", keywords: ["鶏", "とり", "皮", "焼き鳥", "やきとり", "塩", "串", "こってり"] },
  { id: 12, name: "ぼんじり（塩・1本）", price: 180, category: "焼き鳥", allergens: [], isAlcohol: false, dislikeTags: ["内臓"],
    yomi: "ぼんじりしお", keywords: ["鶏", "とり", "焼き鳥", "やきとり", "塩", "串", "こってり"] },
  { id: 13, name: "ささみ梅しそ（1本）", price: 200, category: "焼き鳥", allergens: [], isAlcohol: false, dislikeTags: ["梅"],
    yomi: "ささみうめしそ", keywords: ["鶏", "とり", "ささみ", "梅", "しそ", "焼き鳥", "やきとり", "串", "さっぱり", "ヘルシー"] },
  { id: 14, name: "砂肝（塩・1本）", price: 180, category: "焼き鳥", allergens: [], isAlcohol: false, dislikeTags: ["内臓"],
    yomi: "すなぎもしお", keywords: ["鶏", "とり", "内臓", "焼き鳥", "やきとり", "塩", "串"] },
  { id: 15, name: "手羽先（塩・1本）", price: 220, category: "焼き鳥", allergens: [], isAlcohol: false, dislikeTags: [],
    yomi: "てばさきしお", keywords: ["鶏", "とり", "手羽", "焼き鳥", "やきとり", "塩", "串"] },
  { id: 16, name: "レバー（タレ・1本）", price: 180, category: "焼き鳥", allergens: ["小麦"], isAlcohol: false, dislikeTags: ["内臓"],
    yomi: "ればーたれ", keywords: ["鶏", "とり", "内臓", "焼き鳥", "やきとり", "タレ", "串"] },
  { id: 17, name: "うずら卵（塩・1本）", price: 150, category: "焼き鳥", allergens: ["卵"], isAlcohol: false, dislikeTags: [],
    yomi: "うずらたまごしお", keywords: ["卵", "たまご", "うずら", "焼き鳥", "やきとり", "塩", "串"] },

  { id: 18, name: "鶏の唐揚げ", price: 580, category: "一品料理", allergens: ["卵", "小麦"], isAlcohol: false, dislikeTags: [],
    yomi: "とりのからあげ", keywords: ["鶏", "とり", "揚げ物", "あげもの", "こってり", "からあげ"] },
  { id: 19, name: "だし巻き玉子", price: 520, category: "一品料理", allergens: ["卵", "小麦"], isAlcohol: false, dislikeTags: [],
    yomi: "だしまきたまご", keywords: ["卵", "たまご", "玉子", "だし", "和食"] },
  { id: 20, name: "焼きおにぎり", price: 300, category: "一品料理", allergens: ["小麦"], isAlcohol: false, dislikeTags: [],
    yomi: "やきおにぎり", keywords: ["ごはん", "ご飯", "おにぎり", "しめ", "醤油"] },
  { id: 21, name: "えびマヨ", price: 650, category: "一品料理", allergens: ["えび", "卵", "小麦"], isAlcohol: false, dislikeTags: ["魚介"],
    yomi: "えびまよ", keywords: ["えび", "海老", "魚介", "マヨネーズ", "揚げ物", "あげもの", "こってり"] },
  { id: 22, name: "鶏白湯ラーメン", price: 780, category: "一品料理", allergens: ["卵", "小麦"], isAlcohol: false, dislikeTags: ["ねぎ"],
    yomi: "とりぱいたんらーめん", keywords: ["鶏", "とり", "ラーメン", "麺", "めん", "しめ", "スープ", "がっつり"] },
  { id: 23, name: "チキン南蛮", price: 680, category: "一品料理", allergens: ["卵", "小麦"], isAlcohol: false, dislikeTags: [],
    yomi: "ちきんなんばん", keywords: ["鶏", "とり", "チキン", "揚げ物", "あげもの", "タルタル", "こってり"] },
  { id: 24, name: "フライドポテト", price: 400, category: "一品料理", allergens: [], isAlcohol: false, dislikeTags: [],
    yomi: "ふらいどぽてと", keywords: ["ポテト", "じゃがいも", "揚げ物", "あげもの", "こってり", "おつまみ"] },
  { id: 25, name: "親子丼", price: 750, category: "一品料理", allergens: ["卵", "小麦"], isAlcohol: false, dislikeTags: ["ねぎ"],
    yomi: "おやこどん", keywords: ["鶏", "とり", "卵", "たまご", "ごはん", "ご飯", "丼", "どんぶり", "しめ", "がっつり"] },
  { id: 26, name: "かにクリームコロッケ", price: 580, category: "一品料理", allergens: ["かに", "卵", "乳", "小麦"], isAlcohol: false, dislikeTags: ["魚介"],
    yomi: "かにくりーむころっけ", keywords: ["かに", "蟹", "魚介", "コロッケ", "揚げ物", "あげもの", "クリーム", "こってり"] },

  { id: 27, name: "生ビール", price: 550, category: "ドリンク", allergens: [], isAlcohol: true, dislikeTags: [],
    yomi: "なまびーる", keywords: ["ビール", "お酒", "おさけ", "アルコール", "乾杯", "かんぱい", "定番"] },
  { id: 28, name: "ハイボール", price: 450, category: "ドリンク", allergens: [], isAlcohol: true, dislikeTags: [],
    yomi: "はいぼーる", keywords: ["ウイスキー", "炭酸", "お酒", "おさけ", "アルコール", "さっぱり"] },
  { id: 29, name: "レモンサワー", price: 450, category: "ドリンク", allergens: [], isAlcohol: true, dislikeTags: [],
    yomi: "れもんさわー", keywords: ["レモン", "サワー", "炭酸", "お酒", "おさけ", "アルコール", "さっぱり"] },
  { id: 30, name: "日本酒", price: 600, category: "ドリンク", allergens: [], isAlcohol: true, dislikeTags: [],
    yomi: "にほんしゅ", keywords: ["酒", "お酒", "おさけ", "アルコール", "和"] },
  { id: 31, name: "梅酒ロック", price: 500, category: "ドリンク", allergens: [], isAlcohol: true, dislikeTags: ["梅"],
    yomi: "うめしゅろっく", keywords: ["梅", "梅酒", "お酒", "おさけ", "アルコール", "甘い", "あまい"] },
  { id: 32, name: "ウーロンハイ", price: 450, category: "ドリンク", allergens: [], isAlcohol: true, dislikeTags: [],
    yomi: "うーろんはい", keywords: ["ウーロン茶", "焼酎", "お酒", "おさけ", "アルコール", "さっぱり"] },
  { id: 33, name: "コカレロ（ショット）", price: 500, category: "ドリンク", allergens: [], isAlcohol: true, dislikeTags: [],
    yomi: "こかれろ", keywords: ["ショット", "リキュール", "お酒", "おさけ", "アルコール", "強い"] },
  { id: 34, name: "チャミスル（ボトル）", price: 1200, category: "ドリンク", allergens: [], isAlcohol: true, dislikeTags: [],
    yomi: "ちゃみする", keywords: ["韓国", "焼酎", "ボトル", "お酒", "おさけ", "アルコール"] },
  { id: 35, name: "クライナー（1本）", price: 450, category: "ドリンク", allergens: [], isAlcohol: true, dislikeTags: [],
    yomi: "くらいなー", keywords: ["ショット", "リキュール", "小瓶", "お酒", "おさけ", "アルコール", "甘い", "あまい"] },
  { id: 36, name: "ウーロン茶", price: 280, category: "ドリンク", allergens: [], isAlcohol: false, dislikeTags: [],
    yomi: "うーろんちゃ", keywords: ["お茶", "おちゃ", "ソフトドリンク", "ノンアルコール", "さっぱり"] },
  { id: 37, name: "オレンジジュース", price: 300, category: "ドリンク", allergens: [], isAlcohol: false, dislikeTags: [],
    yomi: "おれんじじゅーす", keywords: ["ジュース", "オレンジ", "ソフトドリンク", "ノンアルコール", "甘い", "あまい"] },
  { id: 38, name: "コーラ", price: 300, category: "ドリンク", allergens: [], isAlcohol: false, dislikeTags: [],
    yomi: "こーら", keywords: ["炭酸", "ソフトドリンク", "ノンアルコール", "甘い", "あまい"] },
  { id: 39, name: "ジンジャーエール", price: 300, category: "ドリンク", allergens: [], isAlcohol: false, dislikeTags: [],
    yomi: "じんじゃーえーる", keywords: ["炭酸", "しょうが", "ソフトドリンク", "ノンアルコール", "さっぱり"] },
  { id: 40, name: "カルピス", price: 300, category: "ドリンク", allergens: ["乳"], isAlcohol: false, dislikeTags: [],
    yomi: "かるぴす", keywords: ["乳酸菌", "ソフトドリンク", "ノンアルコール", "甘い", "あまい"] },

  { id: 41, name: "バニラアイス", price: 300, category: "デザート", allergens: ["卵", "乳"], isAlcohol: false, dislikeTags: [],
    yomi: "ばにらあいす", keywords: ["アイス", "アイスクリーム", "甘い", "あまい", "冷たい", "つめたい"] },
  { id: 42, name: "抹茶プリン", price: 380, category: "デザート", allergens: ["卵", "乳"], isAlcohol: false, dislikeTags: [],
    yomi: "まっちゃぷりん", keywords: ["抹茶", "プリン", "甘い", "あまい", "和"] },
  { id: 43, name: "わらび餅", price: 350, category: "デザート", allergens: [], isAlcohol: false, dislikeTags: [],
    yomi: "わらびもち", keywords: ["餅", "もち", "きなこ", "甘い", "あまい", "和"] },
  { id: 44, name: "黒ごまアイス", price: 320, category: "デザート", allergens: ["乳"], isAlcohol: false, dislikeTags: [],
    yomi: "くろごまあいす", keywords: ["ごま", "アイス", "甘い", "あまい", "冷たい", "つめたい", "和"] },
  { id: 45, name: "杏仁豆腐", price: 350, category: "デザート", allergens: ["乳"], isAlcohol: false, dislikeTags: [],
    yomi: "あんにんどうふ", keywords: ["杏仁", "甘い", "あまい", "中華"] },
];

// トッピングのデータ（price は税抜の追加料金・円、allergens はトッピングに含まれるアレルギー）
// キーは料理の id。ここにない料理はトッピングなし
const toppingList = {
  // 鶏白湯ラーメン
  22: [
    { id: "ajitama", name: "味玉", price: 100, allergens: ["卵"] },
    { id: "negimashi", name: "ねぎ増し", price: 50, allergens: [] },
    { id: "nori", name: "のり", price: 50, allergens: [] },
  ],
  // 親子丼
  25: [
    { id: "ranou", name: "卵黄のせ", price: 50, allergens: ["卵"] },
    { id: "negimashi", name: "ねぎ増し", price: 50, allergens: [] },
  ],
  // 冷奴
  3: [
    { id: "negimashi", name: "ねぎ増し", price: 30, allergens: [] },
    { id: "katsuobushi", name: "かつお節", price: 0, allergens: [] },
  ],
  // 鶏の唐揚げ
  18: [
    { id: "tartar", name: "タルタルソース", price: 80, allergens: ["卵"] },
    { id: "lemon", name: "レモン", price: 0, allergens: [] },
  ],
  // フライドポテト
  24: [
    { id: "cheese", name: "チーズ", price: 100, allergens: ["乳"] },
  ],
  // バニラアイス
  41: [
    { id: "choco", name: "チョコソース", price: 50, allergens: ["乳"] },
  ],
};

// 焼き鳥（もも〜うずら卵の10品）は、どれも「ねぎ追加」と「七味」を選べる
for (let id = 8; id <= 17; id++) {
  toppingList[id] = [
    { id: "negi", name: "ねぎ追加", price: 30, allergens: [] },
    { id: "shichimi", name: "七味", price: 0, allergens: [] },
  ];
}

// 各料理に toppings（トッピングの配列）を付ける。ない料理は空の配列
// image は料理のイラストの場所（images/menu/料理のid.svg）
for (const item of menu) {
  item.toppings = toppingList[item.id] || [];
  item.image = `images/menu/${item.id}.svg`;
}

// 飲み放題の区分。プレミアムプランだけで飲み放題になるドリンクの id
// （日本酒・コカレロ・チャミスル・クライナー）
const premiumDrinkIds = [30, 33, 34, 35];

// ドリンクに nomihodai（"通常" か "プレミアム"）を付ける。ドリンク以外は付けない
for (const item of menu) {
  if (item.category === "ドリンク") {
    if (premiumDrinkIds.includes(item.id)) {
      item.nomihodai = "プレミアム";
    } else {
      item.nomihodai = "通常";
    }
  }
}
