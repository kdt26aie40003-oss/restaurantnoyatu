// カテゴリの並び順
const categories = ["前菜", "焼き鳥", "一品料理", "ドリンク", "デザート"];

// 今表示しているカテゴリ
let currentCategory = "前菜";

// localStorage に保存するときの名前（キー）
const STORAGE_KEY = "torimaru-slips";

// これまでの全部の伝票（1回の来店＝1枚の伝票）
let slips = loadSlips();

// 今のお客さんの伝票
let slip = null;

// localStorage から伝票を読み込む。読めないときは空の配列を返す
function loadSlips() {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    if (text === null) {
      return [];
    }
    const data = JSON.parse(text);
    if (!Array.isArray(data)) {
      return [];
    }
    // 古いデータや壊れたデータでも止まらないように、足りない項目を補う
    for (const s of data) {
      if (!Array.isArray(s.orders)) {
        s.orders = [];
      }
      if (s.checkout === undefined) {
        s.checkout = null;
      }
      if (s.people === undefined) {
        s.people = null;
      }
      if (s.customer === undefined) {
        s.customer = null;
      }
    }
    return data;
  } catch (error) {
    showStorageError("保存されたデータを読み込めませんでした");
    return [];
  }
}

// 全部の伝票を localStorage に保存する
function saveSlips() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slips));
  } catch (error) {
    showStorageError("注文データを保存できませんでした");
  }
}

// 保存の失敗を画面に出す（画面は止めない）
function showStorageError(message) {
  const area = document.getElementById("storage-error");
  if (area) {
    area.textContent = message;
  }
}

// 新しい伝票を作り、今の伝票にする
function startNewSlip() {
  // 伝票番号は、今までの一番大きい番号 + 1
  let maxId = 0;
  for (const s of slips) {
    if (s.slipId > maxId) {
      maxId = s.slipId;
    }
  }

  slip = {
    slipId: maxId + 1,
    startedAt: new Date().toLocaleString("ja-JP"),
    people: null, // テーブルの人数（人数入力画面で決める）
    customer: null, // お客さんの年代と性別（「おすすめを見る」で記録する）
    orders: [],
    checkout: null,
  };
  slips.push(slip);
  saveSlips();
}

// ページを開いたときの伝票を決める
// 最後の伝票がまだ会計前なら続きから、そうでなければ新しい伝票を始める
function chooseSlip() {
  const last = slips[slips.length - 1];
  if (last && last.checkout === null) {
    slip = last;
  } else {
    startNewSlip();
  }
}

// 入力された文字を整数に直す。整数でなければ null を返す
// 例："３" → 3、"1.5" → null、"abc" → null、"" → null
function toInteger(text) {
  // 全角数字（０〜９）を半角数字（0〜9）に直す
  let half = "";
  for (const char of String(text)) {
    const code = char.charCodeAt(0);
    if (code >= 0xff10 && code <= 0xff19) {
      half += String.fromCharCode(code - 0xfee0);
    } else {
      half += char;
    }
  }
  half = half.trim();

  // 空欄は Number("") が 0 になってしまうので、先に null にする
  if (half === "") {
    return null;
  }

  const number = Number(half);
  if (!Number.isInteger(number)) {
    return null;
  }
  return number;
}

// 特定原材料8品目と、その絵文字
const ALLERGEN_EMOJI = {
  "えび": "🦐",
  "かに": "🦀",
  "くるみ": "🌰",
  "小麦": "🌾",
  "そば": "🍜",
  "卵": "🥚",
  "乳": "🥛",
  "落花生": "🥜",
};

// アレルギーを「🥚卵 🌾小麦」のような文字にする（絵文字だけだと伝わらないので、文字も一緒に出す）
function allergenLabel(allergens) {
  if (allergens.length === 0) {
    return "アレルギー表示対象なし";
  }
  const parts = [];
  for (const name of allergens) {
    parts.push(`${ALLERGEN_EMOJI[name] || ""}${name}`);
  }
  return parts.join(" ");
}

// 検索で比べる前に、文字を同じ形にそろえる
// カタカナ → ひらがな、全角英数字 → 半角、大文字 → 小文字、前後の空白を消す
function normalize(text) {
  let result = "";
  for (const char of String(text)) {
    const code = char.charCodeAt(0);
    if (code >= 0x30a1 && code <= 0x30f6) {
      // カタカナ（ァ〜ヶ）は、ひらがなと文字コードが 0x60 ずれている
      result += String.fromCharCode(code - 0x60);
    } else if (code >= 0xff01 && code <= 0xff5e) {
      // 全角の英数字・記号（！〜～）は、半角と 0xfee0 ずれている
      result += String.fromCharCode(code - 0xfee0);
    } else if (code === 0x3000) {
      // 全角スペース → 半角スペース
      result += " ";
    } else {
      result += char;
    }
  }
  return result.toLowerCase().trim();
}

// 検索欄の言葉が、料理に当てはまるかどうか
// 言葉をスペースで区切り、どれか1つでも「料理名・よみ・キーワード・カテゴリ名」に含まれていれば true
function matchesSearch(item, query) {
  const words = normalize(query).split(" ");
  const targets = [item.name, item.yomi || "", item.category].concat(item.keywords || []);

  for (const word of words) {
    if (word === "") {
      continue;
    }
    for (const target of targets) {
      if (normalize(target).includes(word)) {
        return true;
      }
    }
  }
  return false;
}

// 絞り込みでチェックされているアレルギーの配列
function readAllergyFilter() {
  return readCheckboxes("allergy-filter");
}

// 料理が、絞り込みでチェックしたアレルギーを1つでも含むかどうか
function hasFilteredAllergen(item, filter) {
  for (const name of item.allergens) {
    if (filter.includes(name)) {
      return true;
    }
  }
  return false;
}

// アレルギーで絞り込むチェックボックスを並べる
function showAllergyFilter() {
  const area = document.getElementById("allergy-filter");
  for (const name in ALLERGEN_EMOJI) {
    const label = document.createElement("label");
    label.className = "allergy-option";
    label.innerHTML = `<input type="checkbox" name="allergy-filter" value="${name}"> ${ALLERGEN_EMOJI[name]}${name}`;
    label.querySelector("input").addEventListener("change", showMenu);
    area.appendChild(label);
  }
}

// アレルギーの絞り込みをすべて外す
function clearAllergyFilter() {
  for (const box of document.querySelectorAll('input[name="allergy-filter"]')) {
    box.checked = false;
  }
  showMenu();
}

// カテゴリタブを表示する
function showTabs() {
  const tabs = document.getElementById("tabs");
  tabs.innerHTML = "";

  // 検索中は、どのタブも選んでいない見た目にする
  const searching = document.getElementById("search").value.trim() !== "";

  for (const category of categories) {
    const button = document.createElement("button");
    button.textContent = category;
    button.className = "tab";
    if (category === currentCategory && !searching) {
      button.classList.add("active");
    }
    button.addEventListener("click", function () {
      // タブを押したら検索をやめて、そのカテゴリを出す
      document.getElementById("search").value = "";
      currentCategory = category;
      showTabs();
      showMenu();
    });
    tabs.appendChild(button);
  }
}

// メニューを表示する
// 検索欄に文字があれば全カテゴリから探し、なければ選んでいるタブのカテゴリを出す
// どちらの場合も、絞り込みでチェックしたアレルギーを含む料理は隠す
function showMenu() {
  const menuList = document.getElementById("menu-list");
  const filterNote = document.getElementById("filter-note");
  menuList.innerHTML = "";

  const query = document.getElementById("search").value;
  const searching = query.trim() !== "";
  const filter = readAllergyFilter();

  let matchCount = 0; // 検索やタブに当てはまった数
  let hiddenCount = 0; // そのうちアレルギーで隠した数

  for (const item of menu) {
    if (searching) {
      if (!matchesSearch(item, query)) {
        continue;
      }
    } else if (item.category !== currentCategory) {
      continue;
    }
    matchCount++;

    if (hasFilteredAllergen(item, filter)) {
      hiddenCount++;
      continue;
    }

    // お酒には「20歳以上」の印を付ける
    let alcoholMark = "";
    if (item.isAlcohol) {
      alcoholMark = '<p class="alcohol-mark">お酒（20歳以上）</p>';
    }

    // 検索中は、どのカテゴリの料理かわかるようにカテゴリ名を出す
    let categoryMark = "";
    if (searching) {
      categoryMark = `<p class="category-mark">${item.category}</p>`;
    }

    const card = document.createElement("div");
    card.className = "menu-item";
    card.innerHTML = `
      ${categoryMark}
      <h2>${item.name}</h2>
      <p class="allergen">${allergenLabel(item.allergens)}</p>
      ${alcoholMark}
      <p class="price">${item.price}円（税抜）</p>
      <div class="order-row">
        <label>数量 <input type="text" class="quantity" value="1" inputmode="numeric"></label>
        <button class="order-button">注文する</button>
      </div>
      <p class="error"></p>
    `;

    // 「注文する」ボタンを押したときの動き
    const quantityInput = card.querySelector(".quantity");
    const errorText = card.querySelector(".error");
    card.querySelector(".order-button").addEventListener("click", function () {
      const message = tryOrder(item, quantityInput.value);
      errorText.textContent = message;
      // 注文できたら数量を1に戻す
      if (message === "") {
        quantityInput.value = "1";
      }
    });

    menuList.appendChild(card);
  }

  // 検索で1件も見つからなかったとき
  if (searching && matchCount === 0) {
    menuList.innerHTML = '<p class="empty">見つかりませんでした。別の言葉で探してみてください</p>';
  }

  // アレルギーで隠した数を出す
  if (hiddenCount > 0) {
    filterNote.textContent = `${hiddenCount}品を非表示にしています`;
  } else {
    filterNote.textContent = "";
  }
}

// 検索欄に1文字打つごとに、タブとメニューを表示し直す
function onSearchInput() {
  showTabs();
  showMenu();
}

// 年齢の入力欄を読み取る
// 戻り値：{ age: 数値 または null, error: エラーメッセージ（なければ ""） }
function readAge() {
  const text = document.getElementById("age").value;

  // 空欄のときはエラーにせず、age を null にする
  if (text.trim() === "") {
    return { age: null, error: "" };
  }

  // 年齢は0〜120の整数だけ受け付ける
  const age = toInteger(text);
  if (age === null || age < 0 || age > 120) {
    return { age: null, error: "年齢は0〜120の整数で入力してください" };
  }
  return { age: age, error: "" };
}

// 年齢の入力欄が変わるたびにチェックして、おかしければ欄のすぐ下に出す
function checkAgeInput() {
  document.getElementById("age-error").textContent = readAge().error;
}

// id から料理を探す。見つからなければ null を返す
function findMenu(id) {
  for (const item of menu) {
    if (item.id === id) {
      return item;
    }
  }
  return null;
}

// ラジオボタンで選ばれている値を読み取る（name はラジオボタンのグループ名）
function readRadio(name) {
  const checked = document.querySelector(`input[name="${name}"]:checked`);
  if (checked === null) {
    return "";
  }
  return checked.value;
}

// チェックボックスで選ばれている値を、配列にして読み取る（name はグループ名）
function readCheckboxes(name) {
  const values = [];
  for (const box of document.querySelectorAll(`input[name="${name}"]:checked`)) {
    values.push(box.value);
  }
  return values;
}

// おすすめの候補リスト（数字は menu.js の id。上から順に見て、最初に選べた料理を出す）
const DRINK_CANDIDATES = {
  adult: [27, 28, 29, 31], // 20歳以上：生ビール、ハイボール、レモンサワー、梅酒ロック
  teen: [36, 39, 38], // 13〜19歳：ウーロン茶、ジンジャーエール、コーラ
  child: [37, 40, 38], // 12歳以下：オレンジジュース、カルピス、コーラ
};
const HUNGER_CANDIDATES = {
  "ぺこぺこ": [22, 25, 18], // 鶏白湯ラーメン、親子丼、鶏の唐揚げ
  "ふつう": [8, 9, 10, 11], // もも、ねぎま、つくね、皮
  "少しだけ": [1, 2, 3], // 枝豆、冷やしトマト、冷奴
};
const TASTE_CANDIDATES = {
  "さっぱり": [2, 13, 3, 5], // 冷やしトマト、ささみ梅しそ、冷奴、たこわさ
  "こってり": [18, 23, 26, 24], // 鶏の唐揚げ、チキン南蛮、かにクリームコロッケ、フライドポテト
  "甘いもの": [42, 43, 45, 41], // 抹茶プリン、わらび餅、杏仁豆腐、バニラアイス
};

// 年齢から年代を決める（年齢そのものは保存せず、年代だけを記録に使う）
function toAgeGroup(age) {
  if (age <= 12) {
    return "12歳以下";
  }
  if (age <= 19) {
    return "10代";
  }
  if (age >= 60) {
    return "60代以上";
  }
  // 20〜59歳は「20代」「30代」…にする（例：34 → 30代）
  return `${Math.floor(age / 10) * 10}代`;
}

// おすすめで「選べない料理」かどうかを調べる
// アレルギーの絞り込みでチェックしたものを含む料理、苦手な食材を含む料理、
// 20歳未満のときのお酒は選べない
function isUnavailable(item, age, dislikes) {
  if (hasFilteredAllergen(item, readAllergyFilter())) {
    return true;
  }
  if (item.isAlcohol && age < 20) {
    return true;
  }
  for (const tag of item.dislikeTags) {
    if (dislikes.includes(tag)) {
      return true;
    }
  }
  return false;
}

// 候補リストを上から順に見て、最初に選べた料理を返す。1つもなければ null
// usedIds は、すでにおすすめに出した料理の id（同じ料理を2回出さないため）
function pickFirst(candidateIds, age, dislikes, usedIds) {
  for (const id of candidateIds) {
    const item = findMenu(id);
    if (item === null || usedIds.includes(id) || isUnavailable(item, age, dislikes)) {
      continue;
    }
    usedIds.push(id);
    return item;
  }
  return null;
}

// おすすめの料理を1枚のカードにする（「注文する」ボタン付き）
// item が null のときは「条件に合う料理がありません」のカードにする
function makeRecommendCard(item, reason) {
  const card = document.createElement("div");
  card.className = "recommend-item";

  if (item === null) {
    card.innerHTML = `
      <p class="recommend-reason">${reason}</p>
      <p class="empty">条件に合う料理がありません</p>
    `;
    return card;
  }

  card.innerHTML = `
    <p class="recommend-reason">${reason}</p>
    <h3>${item.name}</h3>
    <p class="price">${item.price}円（税抜）</p>
    <button class="order-button">注文する</button>
    <p class="error"></p>
  `;

  // おすすめからは数量1で注文する（年齢確認などは tryOrder の中で行う）
  const cardError = card.querySelector(".error");
  card.querySelector(".order-button").addEventListener("click", function () {
    cardError.textContent = tryOrder(item, "1");
  });
  return card;
}

// 伝票の注文数を料理ごとに合計して、多い順に並べた配列を返す
// 戻り値の例：[{ item: つくね, count: 12 }, ...]（同じ数なら id の小さい順）
// slipFilter は、集計に使う伝票を選ぶ関数
function countOrders(slipFilter) {
  const counts = {}; // { menuId: 合計数量 }
  for (const s of slips) {
    if (!slipFilter(s)) {
      continue;
    }
    for (const order of s.orders) {
      if (order.status !== "注文済み") {
        continue;
      }
      if (counts[order.menuId] === undefined) {
        counts[order.menuId] = 0;
      }
      counts[order.menuId] += order.quantity;
    }
  }

  const ranking = [];
  for (const id in counts) {
    const item = findMenu(Number(id));
    if (item !== null) {
      ranking.push({ item: item, count: counts[id] });
    }
  }
  ranking.sort(function (a, b) {
    if (b.count !== a.count) {
      return b.count - a.count; // 数が多い順
    }
    return a.item.id - b.item.id; // 同じ数なら id の小さい順
  });
  return ranking;
}

// ランキングから、選べない料理を飛ばして上位3品を取り出す
function topThree(ranking, age, dislikes) {
  const result = [];
  for (const entry of ranking) {
    if (result.length >= 3) {
      break;
    }
    if (!isUnavailable(entry.item, age, dislikes)) {
      result.push(entry);
    }
  }
  return result;
}

// 「おすすめを見る」を押したときの動き
// ① ルールで選ぶ「あなたへのおすすめ」と、② 注文データで選ぶ「同じ年代・性別のお客さんに人気」を出す
function showRecommend() {
  const errorText = document.getElementById("recommend-error");
  const resultArea = document.getElementById("recommend-result");
  errorText.textContent = "";
  resultArea.hidden = true;

  // 年齢は必ず入れてもらう（おかしな値ならエラーを出して、おすすめは出さない）
  const ageResult = readAge();
  if (ageResult.error !== "") {
    errorText.textContent = ageResult.error;
    return;
  }
  if (ageResult.age === null) {
    errorText.textContent = "おすすめを見るには、年齢を入力してください";
    return;
  }
  const age = ageResult.age;
  const gender = readRadio("gender");
  const hunger = readRadio("hunger");
  const tastes = readCheckboxes("taste");
  const dislikes = readCheckboxes("dislike");

  // 今の伝票に、お客さんの年代と性別だけを記録する（年齢そのものは保存しない）
  const ageGroup = toAgeGroup(age);
  slip.customer = { ageGroup: ageGroup, gender: gender };
  saveSlips();

  // ① あなたへのおすすめ：ドリンク1品＋料理1品＋好みの数だけ1品ずつ（最大5品）
  const usedIds = [];
  const list = document.getElementById("recommend-list");
  list.innerHTML = "";

  let drinkCandidates = DRINK_CANDIDATES.child;
  if (age >= 20) {
    drinkCandidates = DRINK_CANDIDATES.adult;
  } else if (age >= 13) {
    drinkCandidates = DRINK_CANDIDATES.teen;
  }
  const drink = pickFirst(drinkCandidates, age, dislikes, usedIds);
  list.appendChild(makeRecommendCard(drink, `${age}歳のあなたにドリンク`));

  const food = pickFirst(HUNGER_CANDIDATES[hunger] || [], age, dislikes, usedIds);
  list.appendChild(makeRecommendCard(food, `お腹の空き具合「${hunger}」に`));

  for (const taste of tastes) {
    const tasteItem = pickFirst(TASTE_CANDIDATES[taste] || [], age, dislikes, usedIds);
    list.appendChild(makeRecommendCard(tasteItem, `「${taste}」が好きなあなたに`));
  }

  // ② 同じ年代・性別のお客さんに人気
  // 性別が「答えない」なら、同じ年代だけで集計する
  let heading = `${ageGroup}・${gender}のお客さんに人気`;
  if (gender === "答えない") {
    heading = `${ageGroup}のお客さんに人気`;
  }
  const groupRanking = countOrders(function (s) {
    // customer がない古い伝票は使わない
    if (!s.customer) {
      return false;
    }
    if (s.customer.ageGroup !== ageGroup) {
      return false;
    }
    return gender === "答えない" || s.customer.gender === gender;
  });
  let popular = topThree(groupRanking, age, dislikes);

  // まだ3品分のデータがなければ、お店全体のランキングを出す
  const note = document.getElementById("popular-note");
  note.textContent = "";
  if (popular.length < 3) {
    note.textContent = "まだデータが少ないので、お店全体の人気を表示します";
    popular = topThree(countOrders(function () { return true; }), age, dislikes);
  }

  document.getElementById("popular-heading").textContent = heading;
  const popularList = document.getElementById("popular-list");
  popularList.innerHTML = "";
  if (popular.length === 0) {
    popularList.innerHTML = '<p class="empty">まだ注文がありません</p>';
  }
  for (let i = 0; i < popular.length; i++) {
    const entry = popular[i];
    popularList.appendChild(makeRecommendCard(entry.item, `${i + 1}位（${entry.count}個）`));
  }

  resultArea.hidden = false;
}

// おすすめ欄の入力と結果を、最初の状態に戻す（会計のあとに使う）
function resetRecommend() {
  document.querySelector('input[name="gender"][value="答えない"]').checked = true;
  document.querySelector('input[name="hunger"][value="ふつう"]').checked = true;
  for (const box of document.querySelectorAll('input[name="taste"], input[name="dislike"]')) {
    box.checked = false;
  }
  document.getElementById("recommend-error").textContent = "";
  document.getElementById("recommend-result").hidden = true;
}

// 注文してよいか確かめてから、注文する
// quantityText は数量の入力欄の文字。戻り値は、注文できなかったときのエラーメッセージ（できたら ""）
function tryOrder(item, quantityText) {
  // 数量は1〜10の整数だけ受け付ける
  const quantity = toInteger(quantityText);
  if (quantity === null || quantity < 1 || quantity > 10) {
    return "数量は1〜10の整数で入力してください";
  }

  // お酒のときは年齢を確かめる（20歳未満の飲酒は法律で禁止）
  if (item.isAlcohol) {
    const result = readAge();
    if (result.error !== "") {
      return result.error;
    }
    if (result.age === null) {
      return "お酒の注文には、先に年齢を入力してください";
    }
    if (result.age < 20) {
      return "20歳未満の方はお酒を注文できません";
    }
  }

  addOrder(item, quantity);
  return "";
}

// 伝票に注文を1件追加する
function addOrder(item, quantity) {
  const order = {
    orderId: slip.orders.length + 1,
    menuId: item.id,
    name: item.name,
    price: item.price,
    quantity: quantity,
    orderedAt: new Date().toLocaleString("ja-JP"),
    status: "注文済み",
  };
  slip.orders.push(order);
  saveSlips();
  showOrders();
}

// 注文を取り消す（データからは消さず、status を「取消」にする）
function cancelOrder(orderId) {
  for (const order of slip.orders) {
    if (order.orderId === orderId) {
      order.status = "取消";
    }
  }
  saveSlips();
  showOrders();
}

// 注文一覧を表示する（取り消した注文は出さない）
function showOrders() {
  const orderList = document.getElementById("order-list");
  orderList.innerHTML = "";

  let count = 0;
  for (const order of slip.orders) {
    if (order.status !== "注文済み") {
      continue;
    }
    count++;

    const row = document.createElement("li");
    row.className = "order-item";
    row.innerHTML = `
      <span class="order-name">${order.name}</span>
      <span>× ${order.quantity}</span>
      <span class="order-price">${order.price * order.quantity}円</span>
      <button class="cancel-button">取消</button>
    `;
    row.querySelector(".cancel-button").addEventListener("click", function () {
      cancelOrder(order.orderId);
    });
    orderList.appendChild(row);
  }

  if (count === 0) {
    orderList.innerHTML = '<li class="empty">まだ注文はありません</li>';
  }

  // 今の小計（税抜）も表示する
  const subtotal = calcSubtotal();
  document.getElementById("subtotal").textContent = `小計（税抜）：${subtotal.toLocaleString()}円`;

  // スマホの画面下の固定バー：「注文 ○品・小計 ○円」（○品は数量の合計）
  let itemCount = 0;
  for (const order of slip.orders) {
    if (order.status === "注文済み") {
      itemCount += order.quantity;
    }
  }
  document.getElementById("mobile-bar").textContent = `注文 ${itemCount}品・小計 ${subtotal.toLocaleString()}円 ▶ 注文一覧へ`;
}

// スマホの固定バーを押したら、注文一覧までスクロールする
function scrollToOrders() {
  document.getElementById("order-section").scrollIntoView({ behavior: "smooth" });
}

// 小計（取り消していない注文の「価格 × 数量」の合計）を計算する
function calcSubtotal() {
  let subtotal = 0;
  for (const order of slip.orders) {
    if (order.status === "注文済み") {
      subtotal += order.price * order.quantity;
    }
  }
  return subtotal;
}

// 「会計する」を押したときの動き
function checkout() {
  const errorText = document.getElementById("checkout-error");
  errorText.textContent = "";

  // 人数は最初の人数入力画面で決めたものを使う
  const people = slip.people;
  if (people === null) {
    errorText.textContent = "人数が決まっていません。「人数を変える」から入力してください";
    return;
  }

  // 注文が1件もなければ会計しない
  const subtotal = calcSubtotal();
  let activeCount = 0;
  for (const order of slip.orders) {
    if (order.status === "注文済み") {
      activeCount++;
    }
  }
  if (activeCount === 0) {
    errorText.textContent = "注文がありません";
    return;
  }

  // README の「会計」の順番どおりに計算する
  const otoshi = 300 * people; // お通し代：1人300円
  // 消費税：10%で1円未満は切り捨て（小数の計算誤差が出ないよう、10で割って切り捨てる）
  const tax = Math.floor((subtotal + otoshi) / 10);
  const total = subtotal + otoshi + tax; // 税込合計
  const perPerson = Math.ceil(total / people); // 1人あたり：1円未満は切り上げ

  // 会計情報を伝票に記録して保存する（データは店側に残る）
  slip.checkout = {
    people: people,
    subtotal: subtotal,
    otoshi: otoshi,
    tax: tax,
    total: total,
    perPerson: perPerson,
    paidAt: new Date().toLocaleString("ja-JP"),
  };
  saveSlips();

  // 会計の結果を画面に出す
  showReceipt(slip.checkout);

  // 画面はリセット：次のお客さん用に新しい伝票を始める
  startNewSlip();
  showOrders();
  // 前のお客さんの年齢・おすすめも消しておく
  document.getElementById("age").value = "";
  checkAgeInput();
  resetRecommend();
}

// 会計の結果（内訳・税込合計・1人あたり）を窓に出す
function showReceipt(c) {
  document.getElementById("receipt-detail").innerHTML = `
    <table class="receipt-table">
      <tr><td>小計</td><td>${c.subtotal.toLocaleString()}円</td></tr>
      <tr><td>お通し代（300円 × ${c.people}人）</td><td>${c.otoshi.toLocaleString()}円</td></tr>
      <tr><td>消費税（10%）</td><td>${c.tax.toLocaleString()}円</td></tr>
      <tr class="receipt-total"><td>税込合計</td><td>${c.total.toLocaleString()}円</td></tr>
      <tr><td>1人あたり（${c.people}人）</td><td>${c.perPerson.toLocaleString()}円</td></tr>
    </table>
  `;
  document.getElementById("receipt").hidden = false;
}

// 会計の窓を閉じて、ようこそ画面に戻る（次のお客さんを迎える）
function closeReceipt() {
  document.getElementById("receipt").hidden = true;
  showWelcome();
}

// 注文履歴の画面を開く
function openHistory() {
  const list = document.getElementById("history-list");
  list.innerHTML = "";

  // 注文が1件もない伝票は出さない
  const shown = [];
  for (const s of slips) {
    if (s.orders.length > 0) {
      shown.push(s);
    }
  }

  if (shown.length === 0) {
    list.innerHTML = '<p class="empty">まだ注文の記録はありません</p>';
  }

  // 新しい伝票が上に来るように、後ろから順に並べる
  for (let i = shown.length - 1; i >= 0; i--) {
    const s = shown[i];
    const box = document.createElement("div");
    box.className = "history-slip";

    let status = "会計前";
    let checkoutText = "";
    if (s.checkout !== null) {
      status = "会計済み";
      checkoutText = `
        <p class="history-checkout">
          会計：${s.checkout.paidAt}／${s.checkout.people}人／税込合計 ${s.checkout.total.toLocaleString()}円（1人 ${s.checkout.perPerson.toLocaleString()}円）
        </p>
      `;
    }

    let rows = "";
    for (const order of s.orders) {
      let rowClass = "";
      if (order.status === "取消") {
        rowClass = "cancelled";
      }
      rows += `
        <tr class="${rowClass}">
          <td>${order.orderedAt}</td>
          <td>${order.name}</td>
          <td>${order.quantity}</td>
          <td>${order.price * order.quantity}円</td>
          <td>${order.status}</td>
        </tr>
      `;
    }

    box.innerHTML = `
      <h3>伝票 No.${s.slipId}（${status}）</h3>
      <p class="history-date">来店：${s.startedAt}</p>
      <table>
        <tr><th>注文日時</th><th>料理</th><th>数量</th><th>金額</th><th>状態</th></tr>
        ${rows}
      </table>
      ${checkoutText}
    `;
    list.appendChild(box);
  }

  document.getElementById("history").hidden = false;
}

// 注文履歴の画面を閉じる
function closeHistory() {
  document.getElementById("history").hidden = true;
}

// 注文履歴をすべて消して、新しい伝票から始める（ようこそ画面に戻る）
function clearHistory() {
  const ok = confirm("注文履歴をすべて消します。よろしいですか？");
  if (!ok) {
    return;
  }
  slips = [];
  startNewSlip();
  showOrders();
  closeHistory();
  showWelcome();
}

// ようこそ画面を消して、次の画面に進む
// 人数がまだ決まっていなければ人数入力画面、決まっていればメニュー画面を出す
function startMenu() {
  const welcome = document.getElementById("welcome");
  // タップで先に進んだあとに3秒のタイマーが来たときは、何もしない
  if (welcome.hidden) {
    return;
  }
  welcome.hidden = true;

  if (slip.people === null) {
    showPeopleScreen();
  } else {
    showApp();
  }
}

// ようこそ画面を出す。タップするか3秒（3000ミリ秒）たつと次の画面に進む
function showWelcome() {
  document.getElementById("app").hidden = true;
  document.getElementById("people-screen").hidden = true;
  document.getElementById("welcome").hidden = false;
  window.scrollTo(0, 0);
  setTimeout(startMenu, 3000);
}

// 人数入力画面を出す
function showPeopleScreen() {
  document.getElementById("app").hidden = true;
  document.getElementById("people-screen").hidden = false;
  document.getElementById("people-error").textContent = "";

  // 人数を変えるときは、今の人数を入れておく
  const input = document.getElementById("people-input");
  if (slip.people === null) {
    input.value = "";
  } else {
    input.value = String(slip.people);
  }
  window.scrollTo(0, 0);
}

// メニュー画面を出す
function showApp() {
  document.getElementById("people-screen").hidden = true;
  document.getElementById("app").hidden = false;
  document.getElementById("people-display").textContent = `${slip.people}人`;
  window.scrollTo(0, 0);
}

// 人数を決める。text は入力欄の文字や、押したボタンの数字
function decidePeople(text) {
  const errorText = document.getElementById("people-error");
  errorText.textContent = "";

  // 人数は1〜20の整数だけ受け付ける
  const people = toInteger(text);
  if (people === null || people < 1 || people > 20) {
    errorText.textContent = "人数は1〜20の整数で入力してください";
    return;
  }

  slip.people = people;
  saveSlips();
  showApp();
}

// 人数入力画面の 1〜6 のボタンを作る（押すとその人数ですぐ決まる）
function showPeopleButtons() {
  const area = document.getElementById("people-buttons");
  for (let n = 1; n <= 6; n++) {
    const button = document.createElement("button");
    button.className = "people-button";
    button.textContent = `${n}人`;
    button.addEventListener("click", function () {
      decidePeople(String(n));
    });
    area.appendChild(button);
  }
}

// ページを開いたときに1回だけ行う準備
chooseSlip();
showAllergyFilter();
showTabs();
showMenu();
showOrders();
showPeopleButtons();

// ボタンを押したときの動きを登録する
document.getElementById("welcome").addEventListener("click", startMenu);
document.getElementById("people-ok").addEventListener("click", function () {
  decidePeople(document.getElementById("people-input").value);
});
document.getElementById("people-change").addEventListener("click", showPeopleScreen);
document.getElementById("age").addEventListener("input", checkAgeInput);
document.getElementById("recommend-button").addEventListener("click", showRecommend);
document.getElementById("search").addEventListener("input", onSearchInput);
document.getElementById("allergy-clear").addEventListener("click", clearAllergyFilter);
document.getElementById("mobile-bar").addEventListener("click", scrollToOrders);
document.getElementById("checkout-button").addEventListener("click", checkout);
document.getElementById("receipt-close").addEventListener("click", closeReceipt);
document.getElementById("history-button").addEventListener("click", openHistory);
document.getElementById("history-close").addEventListener("click", closeHistory);
document.getElementById("history-clear").addEventListener("click", clearHistory);

showWelcome();
