// カテゴリの並び順
const categories = ["前菜", "焼き鳥", "一品料理", "ドリンク", "デザート"];

// 今表示しているカテゴリ
let currentCategory = "前菜";

// localStorage に保存するときの名前（キー）
const STORAGE_KEY = "torimaru-slips";

// ===== 時刻 =====

// 時刻をずらす分（確認用。飲み放題の「早送り」で使う）
let timeOffsetMinutes = 0;

// 今の時刻を返す。プログラムの中で「今」が必要なところは、すべてこの関数を使う
// 確認用の「時刻を指定する」にチェックがあれば、今日の日付＋指定した時刻を使う
// どちらの場合も、timeOffsetMinutes の分だけ先の時刻にする
function getNow() {
  let now = new Date();

  const useTestTime = document.getElementById("test-time-on");
  const errorText = document.getElementById("test-time-error");
  if (useTestTime && useTestTime.checked) {
    const value = document.getElementById("test-time").value; // 例："17:30"
    const parts = value.split(":");
    const hour = toInteger(parts[0]);
    const minute = toInteger(parts[1]);
    if (parts.length >= 2 && hour !== null && minute !== null && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      now.setHours(hour, minute, 0, 0);
      errorText.textContent = "";
    } else {
      // 時刻が空欄やおかしな値なら、本当の時刻を使う
      errorText.textContent = "時刻を正しく入力してください（今は本当の時刻を使っています）";
    }
  } else if (errorText) {
    errorText.textContent = "";
  }

  return new Date(now.getTime() + timeOffsetMinutes * 60 * 1000);
}

// ===== ハッピーアワー =====

const HAPPY_HOUR_START = 17; // 17:00 から
const HAPPY_HOUR_END = 19; // 19:00 ちょうどで終わり
const HAPPY_HOUR_DISCOUNT = 100; // お酒1杯あたりの割引額（円）

// 今がハッピーアワーかどうか
function isHappyHour() {
  const hour = getNow().getHours();
  return hour >= HAPPY_HOUR_START && hour < HAPPY_HOUR_END;
}

// 料理の、今のハッピーアワー割引額（1個あたり）。お酒で開催中なら100円、それ以外は0円
// 飲み放題で0円になるドリンクには、ハッピーアワー割引をかけない
function happyHourDiscountFor(item) {
  if (isNomihodaiCovered(item)) {
    return 0;
  }
  if (item.isAlcohol && isHappyHour()) {
    return HAPPY_HOUR_DISCOUNT;
  }
  return 0;
}

// 注文の、ハッピーアワー割引額（1個あたり）。古いデータにはないので、そのときは0円
function hhDiscountOf(order) {
  if (typeof order.hhDiscount === "number") {
    return order.hhDiscount;
  }
  return 0;
}

// 画面上部の「ハッピーアワー開催中！ 19:00まで（あと○分）」を表示し直す
// 開催中かどうかが変わったときは、メニューとカートの値段も表示し直す
let lastHappyHour = null;
function updateHappyHour() {
  const banner = document.getElementById("hh-banner");
  const now = getNow();
  const happy = isHappyHour();

  if (happy) {
    const end = new Date(now.getTime());
    end.setHours(HAPPY_HOUR_END, 0, 0, 0);
    const minutesLeft = Math.ceil((end.getTime() - now.getTime()) / 60000);
    banner.textContent = `🍺 ハッピーアワー開催中！ ${HAPPY_HOUR_END}:00まで（あと${minutesLeft}分）お酒が1杯${HAPPY_HOUR_DISCOUNT}円引き`;
    banner.hidden = false;
  } else {
    banner.hidden = true;
  }

  if (happy !== lastHappyHour) {
    lastHappyHour = happy;
    showMenu();
    showCart();
  }
}

// 確認用の時刻指定を変えたときの動き
function onTestTimeChange() {
  lastHappyHour = null; // 必ずメニューとカートを表示し直す
  lastNomihodaiState = null;
  updateHappyHour();
  updateNomihodai();
}

// 確認用の早送り：minutes 分だけ時刻を先に進める
function fastForward(minutes) {
  timeOffsetMinutes += minutes;
  showOffset();
  onTestTimeChange();
}

// 確認用の早送りを元に戻す
function resetOffset() {
  timeOffsetMinutes = 0;
  showOffset();
  onTestTimeChange();
}

// 早送りした分を表示する
function showOffset() {
  let text = "";
  if (timeOffsetMinutes > 0) {
    text = `（今は ${timeOffsetMinutes}分 進めています）`;
  }
  document.getElementById("offset-note").textContent = text;
}

// ===== 飲み放題 =====

// 料金（1人あたり・税抜）。NOMIHODAI_PRICES[時間][プラン]
const NOMIHODAI_PRICES = {
  90: { "通常": 1500, "プレミアム": 2000, "ソフトドリンク": 800 },
  120: { "通常": 2000, "プレミアム": 2500, "ソフトドリンク": 1000 },
};
const LAST_ORDER_BEFORE = 30; // 終了の30分前がラストオーダー

// 飲み放題の今の状態を返す
// "none"（申し込んでいない）／"active"（注文できる）／"lastorder"（ラストオーダー後）／"ended"（終了）
function nomihodaiState() {
  const n = slip.nomihodai;
  if (!n) {
    return "none";
  }
  const now = getNow().getTime();
  if (now >= n.endsAt) {
    return "ended";
  }
  if (now >= n.lastOrderAt) {
    return "lastorder";
  }
  return "active";
}

// 料理が、今の飲み放題で0円になるかどうか（ラストオーダーまでのあいだだけ）
// ソフトドリンクはどのプランでも対象。お酒は大人のプランの対象なら対象
function isNomihodaiCovered(item) {
  if (nomihodaiState() !== "active" || item.category !== "ドリンク") {
    return false;
  }
  if (!item.isAlcohol) {
    return true;
  }
  // 全員20歳未満のときは、お酒は対象にならない
  const n = slip.nomihodai;
  if (n.people - n.minors <= 0) {
    return false;
  }
  return n.plan === "プレミアム" || item.nomihodai === "通常";
}

// 「1:23:45」のように、ミリ秒を 時:分:秒 の文字にする
function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// 画面上部の「飲み放題（通常・90分）残り 1:23:45」を表示し直す（1秒ごとに呼ぶ）
// 状態が変わったとき（ラストオーダーや終了）は、メニューとカートの値段も表示し直す
let lastNomihodaiState = null;
function updateNomihodai() {
  const banner = document.getElementById("nh-banner");
  const state = nomihodaiState();
  const n = slip.nomihodai;

  if (state === "none") {
    banner.hidden = true;
  } else {
    const left = n.endsAt - getNow().getTime();
    let text = `🍻 飲み放題（${n.plan}・${n.course}分）残り ${formatDuration(left)}`;
    if (state === "lastorder") {
      text += "　ラストオーダーの時間を過ぎました";
    } else if (state === "ended") {
      text = "🍻 飲み放題は終了しました";
    }
    banner.textContent = text;
    banner.hidden = false;
  }

  // 申し込みボタンは、1つの伝票で1回だけ
  const applyButton = document.getElementById("nomihodai-apply");
  applyButton.disabled = state !== "none";
  if (state === "none") {
    applyButton.textContent = "🍻 飲み放題を申し込む";
  } else {
    applyButton.textContent = "🍻 飲み放題 申し込み済み";
  }

  // 飲み放題を申し込んだら、人数は変えられない
  document.getElementById("people-change").disabled = state !== "none";

  if (state !== lastNomihodaiState) {
    lastNomihodaiState = state;
    showMenu();
    showCart();
  }
}

// 申し込み画面の入力を読み取って、料金を計算する
// 戻り値：{ error: エラーメッセージ（なければ ""）, ...申し込みの内容 }
function readNomihodaiForm() {
  const course = Number(readRadio("nh-course"));
  const people = toInteger(document.getElementById("nh-people").value);
  const minors = toInteger(document.getElementById("nh-minors").value);

  if (people === null || people < 1 || people > 20) {
    return { error: "人数は1〜20の整数で入力してください" };
  }
  if (minors === null || minors < 0 || minors > people) {
    return { error: `20歳未満の人数は0〜${people}の整数で入力してください` };
  }

  const adults = people - minors;
  const plan = readRadio("nh-plan");
  // 全員20歳未満なら、大人のプランは使わない
  let adultPrice = 0;
  if (adults > 0) {
    adultPrice = NOMIHODAI_PRICES[course][plan];
  }
  const minorPrice = NOMIHODAI_PRICES[course]["ソフトドリンク"];
  return {
    error: "",
    course: course,
    plan: plan,
    people: people,
    minors: minors,
    adultPrice: adultPrice,
    minorPrice: minorPrice,
    total: adultPrice * adults + minorPrice * minors,
  };
}

// 申し込み画面の「大人○人×○円＋20歳未満○人×○円＝○円」を表示し直す
function updateNomihodaiForm() {
  const errorText = document.getElementById("nh-error");
  const priceText = document.getElementById("nh-price");
  const okButton = document.getElementById("nh-ok");
  const form = readNomihodaiForm();

  // 全員20歳未満ならプランは選べない（ソフトドリンク飲み放題だけ）
  const people = toInteger(document.getElementById("nh-people").value);
  const minors = toInteger(document.getElementById("nh-minors").value);
  const allMinors = people !== null && minors !== null && people === minors;
  for (const radio of document.querySelectorAll('input[name="nh-plan"]')) {
    radio.disabled = allMinors;
  }

  if (form.error !== "") {
    errorText.textContent = form.error;
    priceText.textContent = "";
    okButton.disabled = true;
    return;
  }
  errorText.textContent = "";
  okButton.disabled = false;

  const adults = form.people - form.minors;
  const parts = [];
  if (adults > 0) {
    parts.push(`大人${adults}人×${form.adultPrice.toLocaleString()}円（${form.plan}）`);
  }
  if (form.minors > 0) {
    parts.push(`20歳未満${form.minors}人×${form.minorPrice.toLocaleString()}円（ソフトドリンク）`);
  }
  priceText.textContent = `${parts.join("＋")}＝${form.total.toLocaleString()}円（税抜）`;
}

// 申し込み画面を開く
function openNomihodai() {
  if (slip.nomihodai || slip.checkout !== null) {
    return;
  }
  // 人数は、最初に決めたテーブルの人数を入れておく
  document.getElementById("nh-people").value = slip.people === null ? "" : String(slip.people);
  document.getElementById("nh-minors").value = "0";
  updateNomihodaiForm();
  document.getElementById("nomihodai").hidden = false;
}

// 申し込み画面を閉じる（何も変えない）
function closeNomihodai() {
  document.getElementById("nomihodai").hidden = true;
}

// 「申し込む」：飲み放題を確定して、伝票に記録する
function applyNomihodai() {
  const form = readNomihodaiForm();
  if (form.error !== "" || slip.nomihodai || slip.checkout !== null) {
    return;
  }

  // 時刻はすべて getNow() から取る。あとで計算しやすいように、ミリ秒の数で記録する
  const start = getNow().getTime();
  slip.nomihodai = {
    course: form.course,
    plan: form.plan,
    people: form.people,
    minors: form.minors,
    startedAt: start,
    lastOrderAt: start + (form.course - LAST_ORDER_BEFORE) * 60 * 1000,
    endsAt: start + form.course * 60 * 1000,
    adultPrice: form.adultPrice,
    minorPrice: form.minorPrice,
    total: form.total,
  };
  // 会計の人数は、飲み放題の人数にそろえる
  slip.people = form.people;
  document.getElementById("people-display").textContent = `${slip.people}人`;
  saveSlips();

  closeNomihodai();
  showToast("飲み放題を申し込みました！");
  lastNomihodaiState = null;
  updateNomihodai();
}

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
      if (!Array.isArray(s.cart)) {
        s.cart = [];
      }
      if (s.nomihodai === undefined) {
        s.nomihodai = null;
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
    startedAt: getNow().toLocaleString("ja-JP"),
    people: null, // テーブルの人数（人数入力画面で決める）
    customer: null, // お客さんの年代と性別（「おすすめを見る」で記録する）
    cart: [], // カート（「注文する」を押す前の料理）
    nomihodai: null, // 飲み放題の申し込み（申し込みがなければ null）
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

    // トッピングのチェックボックス
    // 絞り込みでチェックしたアレルギーを含むトッピングは、選べないようにする（グレー表示）
    let toppingHtml = "";
    if (item.toppings.length > 0) {
      toppingHtml = '<div class="topping-area"><p class="topping-title">トッピング</p>';
      for (const topping of item.toppings) {
        let disabled = "";
        let labelClass = "topping-option";
        if (hasFilteredAllergen(topping, filter)) {
          disabled = "disabled";
          labelClass += " topping-disabled";
        }
        let toppingAllergen = "";
        if (topping.allergens.length > 0) {
          toppingAllergen = ` <span class="topping-allergen">${allergenLabel(topping.allergens)}</span>`;
        }
        toppingHtml += `
          <label class="${labelClass}">
            <input type="checkbox" class="topping" value="${topping.id}" ${disabled}>
            ${topping.name} +${topping.price}円${toppingAllergen}
          </label>
        `;
      }
      toppingHtml += "</div>";
    }

    // ハッピーアワー中のお酒は、元の値段に取り消し線を付けて、割引後の値段を横に出す
    // 飲み放題の対象なら、0円で頼めることを出す
    let discount = happyHourDiscountFor(item);
    let priceHtml = `<p class="price">${item.price}円（税抜）</p>`;
    if (isNomihodaiCovered(item)) {
      discount = item.price;
      priceHtml = `<p class="price"><s class="old-price">${item.price}円</s> <span class="nh-tag">飲み放題 0円</span></p>`;
    } else if (discount > 0) {
      priceHtml = `<p class="price"><s class="old-price">${item.price}円</s> <span class="hh-price">${item.price - discount}円</span>（税抜）</p>`;
    }

    const card = document.createElement("div");
    card.className = "menu-item";
    card.innerHTML = `
      ${categoryMark}
      <h2>${item.name}</h2>
      <p class="allergen">${allergenLabel(item.allergens)}</p>
      ${alcoholMark}
      ${priceHtml}
      ${toppingHtml}
      <div class="order-row">
        <label>数量 <input type="text" class="quantity" value="1" inputmode="numeric"></label>
        <button class="order-button">カートに入れる</button>
      </div>
      <p class="card-total"></p>
      <p class="error"></p>
    `;

    const quantityInput = card.querySelector(".quantity");
    const errorText = card.querySelector(".error");
    const totalText = card.querySelector(".card-total");

    // カードで選んでいるトッピングを、配列にして返す
    function selectedToppings() {
      const result = [];
      for (const box of card.querySelectorAll(".topping:checked")) {
        for (const topping of item.toppings) {
          if (topping.id === box.value) {
            result.push(topping);
          }
        }
      }
      return result;
    }

    // カードの金額「（料理の価格＋トッピング）× 数量」を表示し直す
    function updateCardTotal() {
      const unitPrice = item.price + toppingTotal(selectedToppings()) - discount;
      const quantity = toInteger(quantityInput.value);
      if (quantity === null || quantity < 1 || quantity > 10) {
        totalText.textContent = `${unitPrice}円 × 数量`;
        return;
      }
      totalText.textContent = `${unitPrice}円 × ${quantity} ＝ ${(unitPrice * quantity).toLocaleString()}円`;
    }

    // トッピングや数量が変わったら、金額を表示し直す
    for (const box of card.querySelectorAll(".topping")) {
      box.addEventListener("change", updateCardTotal);
    }
    quantityInput.addEventListener("input", updateCardTotal);
    updateCardTotal();

    // 「カートに入れる」ボタンを押したときの動き
    card.querySelector(".order-button").addEventListener("click", function () {
      const message = tryOrder(item, quantityInput.value, selectedToppings());
      errorText.textContent = message;
      // 注文できたら数量を1に戻し、トッピングの選択も外す
      if (message === "") {
        quantityInput.value = "1";
        for (const box of card.querySelectorAll(".topping")) {
          box.checked = false;
        }
        updateCardTotal();
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

  // 閉じていても絞り込み中だとわかるように、見出しにチェックした数を出す
  if (filter.length > 0) {
    document.getElementById("allergy-count").textContent = `（${filter.length}つ選択中）`;
  } else {
    document.getElementById("allergy-count").textContent = "";
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

// おすすめの料理を1枚のカードにする（「カートに入れる」ボタン付き）
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

  // ハッピーアワー中のお酒には「ハッピーアワーで100円引き」と出す
  let hhNote = "";
  // 飲み放題の対象なら「飲み放題対象」と出す
  if (isNomihodaiCovered(item)) {
    hhNote = '<p class="nh-tag">飲み放題対象</p>';
  } else if (happyHourDiscountFor(item) > 0) {
    hhNote = `<p class="hh-tag">ハッピーアワーで${HAPPY_HOUR_DISCOUNT}円引き</p>`;
  }

  card.innerHTML = `
    <p class="recommend-reason">${reason}</p>
    <h3>${item.name}</h3>
    <p class="price">${item.price}円（税抜）</p>
    ${hhNote}
    <button class="order-button">カートに入れる</button>
    <p class="error"></p>
  `;

  // おすすめからは数量1でカートに入れる（年齢確認などは tryOrder の中で行う）
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
  // 飲み放題の時間内は、飲み放題の対象のドリンクを先に見る（順番はそのまま、対象を前に寄せる）
  const covered = [];
  const notCovered = [];
  for (const id of drinkCandidates) {
    const item = findMenu(id);
    if (item !== null && isNomihodaiCovered(item)) {
      covered.push(id);
    } else {
      notCovered.push(id);
    }
  }
  drinkCandidates = covered.concat(notCovered);
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

// お酒のときに年齢を確かめる（20歳未満の飲酒は法律で禁止）
// 戻り値は、注文できないときのエラーメッセージ（お酒でないときや、問題ないときは ""）
function checkAlcohol(item) {
  if (!item.isAlcohol) {
    return "";
  }
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
  return "";
}

// 注文してよいか確かめてから、カートに入れる
// quantityText は数量の入力欄の文字、toppings は選んだトッピングの配列（なければ省略できる）
// 戻り値は、カートに入れられなかったときのエラーメッセージ（入れられたら ""）
function tryOrder(item, quantityText, toppings) {
  if (toppings === undefined) {
    toppings = [];
  }

  // 数量は1〜10の整数だけ受け付ける
  const quantity = toInteger(quantityText);
  if (quantity === null || quantity < 1 || quantity > 10) {
    return "数量は1〜10の整数で入力してください";
  }

  const alcoholError = checkAlcohol(item);
  if (alcoholError !== "") {
    return alcoholError;
  }

  addToCart(item, quantity, toppings);
  return "";
}

// トッピングを、記録用に id・名前・値段だけの形にする
function saveToppings(toppings) {
  const saved = [];
  for (const topping of toppings) {
    saved.push({ id: topping.id, name: topping.name, price: topping.price });
  }
  return saved;
}

// 2つのトッピングの配列が、同じトッピングの組み合わせかどうか
function sameToppings(a, b) {
  const idsA = [];
  for (const topping of a) {
    idsA.push(topping.id);
  }
  const idsB = [];
  for (const topping of b) {
    idsB.push(topping.id);
  }
  return idsA.sort().join(",") === idsB.sort().join(",");
}

// カートに料理を入れる
// 同じ料理・同じトッピングがもうカートにあれば、数量を足す（合わせて10個まで）
function addToCart(item, quantity, toppings) {
  const savedToppings = saveToppings(toppings);

  let merged = false;
  for (const entry of slip.cart) {
    if (entry.menuId === item.id && sameToppings(entry.toppings, savedToppings) && entry.quantity + quantity <= 10) {
      entry.quantity += quantity;
      merged = true;
      break;
    }
  }

  if (!merged) {
    // カートの番号は、今までの一番大きい番号 + 1
    let maxId = 0;
    for (const entry of slip.cart) {
      if (entry.cartId > maxId) {
        maxId = entry.cartId;
      }
    }
    slip.cart.push({
      cartId: maxId + 1,
      menuId: item.id,
      name: item.name,
      price: item.price,
      toppings: savedToppings,
      unitPrice: item.price + toppingTotal(savedToppings),
      quantity: quantity,
    });
  }

  saveSlips();
  showCart();
  showToast(`${item.name}を${quantity}個カートに入れました`);
}

// カートの「−」「＋」で数量を変える（change は -1 か +1。1〜10の範囲だけ）
function changeCartQuantity(cartId, change) {
  for (const entry of slip.cart) {
    if (entry.cartId === cartId) {
      const next = entry.quantity + change;
      if (next >= 1 && next <= 10) {
        entry.quantity = next;
      }
    }
  }
  saveSlips();
  showCart();
}

// カートから料理を外す（まだ注文していないので、記録には残さない）
function removeFromCart(cartId) {
  const rest = [];
  for (const entry of slip.cart) {
    if (entry.cartId !== cartId) {
      rest.push(entry);
    }
  }
  slip.cart = rest;
  saveSlips();
  showCart();
}

// カートのページを表示する
function showCart() {
  const list = document.getElementById("cart-list");
  list.innerHTML = "";

  for (const entry of slip.cart) {
    let minusDisabled = "";
    if (entry.quantity <= 1) {
      minusDisabled = "disabled";
    }
    let plusDisabled = "";
    if (entry.quantity >= 10) {
      plusDisabled = "disabled";
    }

    // 今ハッピーアワーなら、お酒は割引した値段で出す。飲み放題の対象なら0円で出す
    // （本当の値段は「注文する」を押した時刻で決まる）
    const discount = cartDiscountOf(entry);
    let hhTag = "";
    const item = findMenu(entry.menuId);
    if (item !== null && isNomihodaiCovered(item)) {
      hhTag = '<span class="nh-tag">飲み放題</span>';
    } else if (discount > 0) {
      hhTag = `<span class="hh-tag">ハッピーアワー −${discount * entry.quantity}円</span>`;
    }

    const row = document.createElement("li");
    row.className = "order-item";
    row.innerHTML = `
      <span class="order-name">${orderLabel(entry)}${hhTag}</span>
      <span class="quantity-control">
        <button class="minus-button" ${minusDisabled}>−</button>
        <span class="order-quantity">${entry.quantity}</span>
        <button class="plus-button" ${plusDisabled}>＋</button>
      </span>
      <span class="order-price">${((entry.unitPrice - discount) * entry.quantity).toLocaleString()}円</span>
      <button class="cancel-button">削除</button>
    `;
    row.querySelector(".minus-button").addEventListener("click", function () {
      changeCartQuantity(entry.cartId, -1);
    });
    row.querySelector(".plus-button").addEventListener("click", function () {
      changeCartQuantity(entry.cartId, 1);
    });
    row.querySelector(".cancel-button").addEventListener("click", function () {
      removeFromCart(entry.cartId);
    });
    list.appendChild(row);
  }

  if (slip.cart.length === 0) {
    list.innerHTML = '<li class="empty">カートは空です。メニューから料理を選んでください</li>';
  }

  document.getElementById("cart-subtotal").textContent = `カートの合計（税抜）：${cartTotal().toLocaleString()}円`;
  document.getElementById("cart-error").textContent = "";
  updateCartBadge();
}

// カートの1行の、今の値引き額（1個あたり）
// 飲み放題の対象なら全額（0円になる）、ハッピーアワーなら100円
function cartDiscountOf(entry) {
  const item = findMenu(entry.menuId);
  if (item === null) {
    return 0;
  }
  if (isNomihodaiCovered(item)) {
    return entry.unitPrice;
  }
  return happyHourDiscountFor(item);
}

// カートの合計金額（今ハッピーアワーなら、お酒の割引を引いた金額）
function cartTotal() {
  let total = 0;
  for (const entry of slip.cart) {
    total += (entry.unitPrice - cartDiscountOf(entry)) * entry.quantity;
  }
  return total;
}

// タブの「カート(○)」と、スマホの固定バーを表示し直す（○はカートの数量の合計）
function updateCartBadge() {
  let count = 0;
  for (const entry of slip.cart) {
    count += entry.quantity;
  }
  const badge = document.getElementById("cart-badge");
  if (count > 0) {
    badge.textContent = String(count);
  } else {
    badge.textContent = "";
  }
  document.getElementById("mobile-bar").textContent = `カート ${count}品・${cartTotal().toLocaleString()}円 ▶ カートを見る`;
}

// カートの「注文する」：カートの中身を注文として記録し、注文済みのページに移る
function placeOrder() {
  const errorText = document.getElementById("cart-error");
  errorText.textContent = "";

  if (slip.cart.length === 0) {
    errorText.textContent = "カートが空です。メニューから料理を選んでください";
    return;
  }

  // カートに入れたあとで年齢を変えたときのために、お酒の年齢確認をもう一度する
  // あわせて、飲み放題で頼むドリンクの数を数える
  let nomihodaiCount = 0; // 飲み放題のドリンクの数
  let nomihodaiAlcohol = 0; // そのうちお酒の数
  for (const entry of slip.cart) {
    const item = findMenu(entry.menuId);
    if (item === null) {
      continue;
    }
    const alcoholError = checkAlcohol(item);
    if (alcoholError !== "") {
      errorText.textContent = `${item.name}：${alcoholError}`;
      return;
    }
    if (isNomihodaiCovered(item)) {
      nomihodaiCount += entry.quantity;
      if (item.isAlcohol) {
        nomihodaiAlcohol += entry.quantity;
      }
    }
  }

  // 1回の注文で頼める飲み放題のドリンクは人数分まで。そのうちお酒は20歳以上の人数分まで
  if (slip.nomihodai) {
    const adults = slip.nomihodai.people - slip.nomihodai.minors;
    if (nomihodaiCount > slip.nomihodai.people) {
      errorText.textContent = `飲み放題のドリンクは、1回の注文で${slip.nomihodai.people}杯（人数分）までです`;
      return;
    }
    if (nomihodaiAlcohol > adults) {
      errorText.textContent = `飲み放題のお酒は、1回の注文で${adults}杯（20歳以上の人数分）までです`;
      return;
    }
  }

  for (const entry of slip.cart) {
    const item = findMenu(entry.menuId);
    if (item !== null) {
      addOrder(item, entry.quantity, entry.toppings);
    }
  }
  slip.cart = [];
  saveSlips();
  showCart();
  showOrders();
  showToast("ご注文ありがとうございます！お料理をお待ちください");
  showPage("orders");
}

// 画面の下に、お知らせを数秒だけ出す
let toastTimer = null;
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () {
    toast.hidden = true;
  }, 2500);
}

// ページを切り替える（name は "guest" "menu" "cart" "orders" のどれか）
let currentPage = "guest";
function showPage(name) {
  currentPage = name;
  for (const page of document.querySelectorAll(".page")) {
    page.hidden = page.id !== `page-${name}`;
  }
  for (const tab of document.querySelectorAll(".page-tab")) {
    if (tab.dataset.page === name) {
      tab.classList.add("active");
    } else {
      tab.classList.remove("active");
    }
  }
  window.scrollTo(0, 0);
}

// トッピングの値段の合計を計算する
function toppingTotal(toppings) {
  let total = 0;
  for (const topping of toppings) {
    total += topping.price;
  }
  return total;
}

// 注文の1個あたりの値段（料理＋トッピング）
// トッピングを追加する前の古いデータには unitPrice がないので、price を使う
function unitPriceOf(order) {
  if (typeof order.unitPrice === "number") {
    return order.unitPrice;
  }
  return order.price;
}

// 注文のトッピング（古いデータにはないので、そのときは空の配列）
function toppingsOf(order) {
  if (Array.isArray(order.toppings)) {
    return order.toppings;
  }
  return [];
}

// 「鶏の唐揚げ（タルタルソース・レモン）」のように、料理名にトッピングを付けた文字にする
function orderLabel(order) {
  const toppings = toppingsOf(order);
  if (toppings.length === 0) {
    return order.name;
  }
  const names = [];
  for (const topping of toppings) {
    names.push(topping.name);
  }
  return `${order.name}（${names.join("・")}）`;
}

// 伝票に注文を1件追加する
function addOrder(item, quantity, toppings) {
  // 記録するトッピングは、id・名前・値段だけにする
  const savedToppings = saveToppings(toppings);

  // 飲み放題の対象なら0円にする（注文した時刻で決める）
  const nomihodai = isNomihodaiCovered(item);
  let unitPrice = item.price + toppingTotal(savedToppings); // 料理＋トッピングの1個あたりの値段
  if (nomihodai) {
    unitPrice = 0;
  }

  const order = {
    orderId: slip.orders.length + 1,
    menuId: item.id,
    name: item.name,
    price: item.price,
    toppings: savedToppings,
    unitPrice: unitPrice,
    nomihodai: nomihodai, // 飲み放題で頼んだドリンクなら true
    // ハッピーアワー割引（1個あたり）。注文した時刻で決め、あとで時間が過ぎても変えない
    hhDiscount: happyHourDiscountFor(item),
    quantity: quantity,
    orderedAt: getNow().toLocaleString("ja-JP"),
    status: "注文済み",
  };
  slip.orders.push(order);
  saveSlips();
  showOrders();
}

// 注文一覧の「−」「＋」で数量を変える（change は -1 か +1）
function changeQuantity(orderId, change) {
  // 会計後の伝票は変えられない
  if (slip.checkout !== null) {
    return;
  }
  for (const order of slip.orders) {
    if (order.orderId === orderId && order.status === "注文済み") {
      // 飲み放題のドリンクは増やせない（減らすのはよい）
      if (order.nomihodai === true && change > 0) {
        continue;
      }
      const next = order.quantity + change;
      // 数量は1〜10の範囲だけ
      if (next >= 1 && next <= 10) {
        order.quantity = next;
      }
    }
  }
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

    // 数量が1なら「−」、10なら「＋」を押せなくする
    let minusDisabled = "";
    if (order.quantity <= 1) {
      minusDisabled = "disabled";
    }
    // 飲み放題のドリンクは、人数分までの決まりを守るため「＋」で増やせないようにする
    let plusDisabled = "";
    if (order.quantity >= 10 || order.nomihodai === true) {
      plusDisabled = "disabled";
    }

    // ハッピーアワーで注文したお酒には割引の印、飲み放題のドリンクには「飲み放題」の印を付ける
    let hhTag = "";
    if (order.nomihodai === true) {
      hhTag = '<span class="nh-tag">飲み放題</span>';
    } else if (hhDiscountOf(order) > 0) {
      hhTag = `<span class="hh-tag">ハッピーアワー −${hhDiscountOf(order) * order.quantity}円</span>`;
    }

    const row = document.createElement("li");
    row.className = "order-item";
    row.innerHTML = `
      <span class="order-name">${orderLabel(order)}${hhTag}</span>
      <span class="quantity-control">
        <button class="minus-button" ${minusDisabled}>−</button>
        <span class="order-quantity">${order.quantity}</span>
        <button class="plus-button" ${plusDisabled}>＋</button>
      </span>
      <span class="order-price">${(unitPriceOf(order) * order.quantity).toLocaleString()}円</span>
      <button class="cancel-button">取消</button>
    `;
    row.querySelector(".minus-button").addEventListener("click", function () {
      changeQuantity(order.orderId, -1);
    });
    row.querySelector(".plus-button").addEventListener("click", function () {
      changeQuantity(order.orderId, 1);
    });
    row.querySelector(".cancel-button").addEventListener("click", function () {
      cancelOrder(order.orderId);
    });
    orderList.appendChild(row);
  }

  if (count === 0) {
    orderList.innerHTML = '<li class="empty">まだ注文はありません。カートから「注文する」を押すとここに出ます</li>';
  }

  // 今の小計（税抜）も表示する。ハッピーアワーの割引があれば、その行も出す
  let subtotalHtml = `小計（税抜）：${calcSubtotal().toLocaleString()}円`;
  if (slip.nomihodai) {
    subtotalHtml += `<br>飲み放題（${slip.nomihodai.plan}・${slip.nomihodai.course}分）：${slip.nomihodai.total.toLocaleString()}円`;
  }
  const discount = calcHappyHourDiscount();
  if (discount > 0) {
    subtotalHtml += `<br><span class="discount-text">ハッピーアワー割引：−${discount.toLocaleString()}円</span>`;
  }
  document.getElementById("subtotal").innerHTML = subtotalHtml;

  // 注文・取消・数量変更をしたら、すぐにランキングも更新する
  showRanking();
}

// ===== 人気ランキング =====

// 人気ランキングを表示する
// 全部の伝票から、取消を除いた注文の数量を料理ごとに合計し、多い順に上位3品を出す
// （トッピングの違いは区別しない。飲み放題の0円のドリンクも数に入れる。同じ数なら id の小さい順）
function showRanking() {
  const list = document.getElementById("ranking-list");
  list.innerHTML = "";

  const ranking = countOrders(function () {
    return true;
  }).slice(0, 3);

  if (ranking.length === 0) {
    list.innerHTML = '<li class="empty">まだ注文がありません</li>';
    return;
  }

  const medals = ["🥇", "🥈", "🥉"];
  for (let i = 0; i < ranking.length; i++) {
    const entry = ranking[i];
    const row = document.createElement("li");
    row.className = "ranking-item";
    row.innerHTML = `
      <span class="ranking-name">${medals[i]} ${i + 1}位 ${entry.item.name}（${entry.count}個）</span>
      <button class="order-button">カートに入れる</button>
      <p class="error"></p>
    `;
    // ランキングからは数量1・トッピングなしでカートに入れる
    const errorText = row.querySelector(".error");
    row.querySelector(".order-button").addEventListener("click", function () {
      errorText.textContent = tryOrder(entry.item, "1");
    });
    list.appendChild(row);
  }
}

// ===== 広告スライド =====

const AD_COUNT = 4; // 広告の枚数
const AD_INTERVAL = 5000; // 5秒ごとに切り替える
let adIndex = 0; // 今表示している広告の番号（0〜3。4 は1枚目の写し）
let adTimer = null;

// 4枚の広告の中身を、今の状態から作る（切り替わるたびに呼んで、最新にする）
function adContents() {
  // 1枚目：人気No.1（まだ注文がなければ、名物のつくね）
  const ranking = countOrders(function () {
    return true;
  });
  let popularText = "名物 つくね、ぜひどうぞ！";
  if (ranking.length > 0) {
    popularText = `人気No.1は${ranking[0].item.name}！`;
  }

  // 2枚目：ハッピーアワー（getNow() で開催中かどうかを見る）
  let hhText = `毎日${HAPPY_HOUR_START}:00〜${HAPPY_HOUR_END}:00はお酒が${HAPPY_HOUR_DISCOUNT}円引き`;
  if (isHappyHour()) {
    hhText = `ハッピーアワー開催中！ お酒${HAPPY_HOUR_DISCOUNT}円引き ${HAPPY_HOUR_END}:00まで`;
  }

  return [
    { icon: "🏆", text: popularText, className: "ad-popular" },
    { icon: "🍺", text: hhText, className: "ad-hh" },
    { icon: "🍻", text: "飲み放題 90分1,500円から。プレミアムなら全ドリンクOK", className: "ad-nomihodai" },
    { icon: "✨", text: "年齢と気分を入れると、おすすめが見られます", className: "ad-recommend" },
  ];
}

// 広告のスライドと●を作る（最初に1回だけ）
// ループさせるために、4枚の後ろに1枚目の写しを置く（4枚目 → 写し → すぐ本物の1枚目に戻す）
function buildAds() {
  const track = document.getElementById("ad-track");
  const dots = document.getElementById("ad-dots");
  for (let i = 0; i <= AD_COUNT; i++) {
    const slide = document.createElement("button");
    slide.className = "ad-slide";
    slide.addEventListener("click", function () {
      onAdClick(i % AD_COUNT);
    });
    track.appendChild(slide);
  }
  for (let i = 0; i < AD_COUNT; i++) {
    const dot = document.createElement("button");
    dot.className = "ad-dot";
    dot.setAttribute("aria-label", `${i + 1}枚目の広告`);
    dot.addEventListener("click", function () {
      refreshAds();
      goToAd(i, true);
      restartAdTimer();
    });
    dots.appendChild(dot);
  }
  // 写しまでスライドし終わったら、アニメーションなしで本物の1枚目に戻す
  track.addEventListener("transitionend", function () {
    if (adIndex >= AD_COUNT) {
      goToAd(0, false);
    }
  });
  refreshAds();
  goToAd(0, false);
}

// 広告の中身を最新にする
function refreshAds() {
  const contents = adContents();
  const slides = document.querySelectorAll(".ad-slide");
  for (let i = 0; i < slides.length; i++) {
    const ad = contents[i % AD_COUNT];
    slides[i].className = `ad-slide ${ad.className}`;
    slides[i].innerHTML = `<span class="ad-icon">${ad.icon}</span><span class="ad-text">${ad.text}</span>`;
  }
}

// index 番目の広告を出す。animate が true なら横にスライドする
function goToAd(index, animate) {
  const track = document.getElementById("ad-track");
  if (animate) {
    track.style.transition = "transform 0.6s ease";
  } else {
    track.style.transition = "none";
  }
  track.style.transform = `translateX(-${index * 100}%)`;
  adIndex = index;

  // ●は、今の広告のところだけ色を付ける
  const dots = document.querySelectorAll(".ad-dot");
  for (let i = 0; i < dots.length; i++) {
    if (i === index % AD_COUNT) {
      dots[i].classList.add("active");
    } else {
      dots[i].classList.remove("active");
    }
  }
}

// 次の広告へ（4枚目の次は1枚目の写しへ進み、そのあと本物の1枚目に戻る）
function nextAd() {
  const track = document.getElementById("ad-track");
  // 画面が隠れていてアニメーションが終わらなかったときのために、写しにいたら先に1枚目へ戻す
  if (adIndex >= AD_COUNT) {
    goToAd(0, false);
    void track.offsetWidth; // 戻したことをブラウザにすぐ反映させる
  }
  refreshAds();
  goToAd(adIndex + 1, true);
}

// 自動で切り替えるタイマーを、最初から数え直す
function restartAdTimer() {
  clearInterval(adTimer);
  adTimer = setInterval(nextAd, AD_INTERVAL);
}

// 広告を押したら、関係する場所へ移ってスクロールする
function onAdClick(index) {
  if (index === 0) {
    // 人気No.1 → ランキング
    showPage("menu");
    document.getElementById("ranking-section").scrollIntoView({ behavior: "smooth" });
  } else if (index === 1) {
    // ハッピーアワー → ドリンクのタブ
    document.getElementById("search").value = "";
    currentCategory = "ドリンク";
    showTabs();
    showMenu();
    showPage("menu");
    document.getElementById("tabs").scrollIntoView({ behavior: "smooth" });
  } else if (index === 2) {
    // 飲み放題 → 申し込みボタン
    showPage("menu");
    document.getElementById("nomihodai-apply").scrollIntoView({ behavior: "smooth" });
  } else {
    // おすすめ → おすすめ欄
    showPage("guest");
    document.getElementById("recommend-button").scrollIntoView({ behavior: "smooth" });
  }
}

// ハッピーアワー割引の合計（取り消していない注文の「1個あたりの割引 × 数量」の合計）
// targetSlip を省略すると、今の伝票で計算する
function calcHappyHourDiscount(targetSlip) {
  if (targetSlip === undefined) {
    targetSlip = slip;
  }
  let discount = 0;
  for (const order of targetSlip.orders) {
    if (order.status === "注文済み") {
      discount += hhDiscountOf(order) * order.quantity;
    }
  }
  return discount;
}

// 小計（取り消していない注文の「1個あたりの値段 × 数量」の合計）を計算する
// targetSlip を省略すると、今の伝票で計算する
function calcSubtotal(targetSlip) {
  if (targetSlip === undefined) {
    targetSlip = slip;
  }
  let subtotal = 0;
  for (const order of targetSlip.orders) {
    if (order.status === "注文済み") {
      subtotal += unitPriceOf(order) * order.quantity;
    }
  }
  return subtotal;
}

// 会計の金額を計算する（README の「会計」の順番どおり）
function calcCheckout(people) {
  const orderSubtotal = calcSubtotal(); // 料理・ドリンクの合計
  // 飲み放題の料金は小計に足す（申し込みがなければ0円）
  let nomihodai = null;
  let nomihodaiTotal = 0;
  if (slip.nomihodai) {
    nomihodai = slip.nomihodai;
    nomihodaiTotal = slip.nomihodai.total;
  }
  const subtotal = orderSubtotal + nomihodaiTotal;
  const hhDiscount = calcHappyHourDiscount(); // ハッピーアワー割引
  const otoshi = 300 * people; // お通し代：1人300円
  // 消費税：割引したあとの金額にかける。10%で1円未満は切り捨て（小数の計算誤差が出ないよう、10で割って切り捨てる）
  const tax = Math.floor((subtotal - hhDiscount + otoshi) / 10);
  const total = subtotal - hhDiscount + otoshi + tax; // 税込合計
  const perPerson = Math.ceil(total / people); // 1人あたり：1円未満は切り上げ
  return {
    people: people,
    orderSubtotal: orderSubtotal,
    nomihodai: nomihodai,
    subtotal: subtotal,
    hhDiscount: hhDiscount,
    otoshi: otoshi,
    tax: tax,
    total: total,
    perPerson: perPerson,
  };
}

// 会計の内訳の表（HTML）を作る。確認画面と会計の結果の両方で使う
function checkoutTable(c) {
  // 飲み放題を申し込んだ会計だけ、料理・ドリンクの合計と飲み放題の行を出す
  let nomihodaiRows = "";
  if (c.nomihodai) {
    const n = c.nomihodai;
    const adults = n.people - n.minors;
    nomihodaiRows = `<tr><td>料理・ドリンク</td><td>${c.orderSubtotal.toLocaleString()}円</td></tr>`;
    if (adults > 0) {
      nomihodaiRows += `<tr><td>飲み放題（${n.plan}・${n.course}分）大人 ${adults}人 × ${n.adultPrice.toLocaleString()}円</td><td>${(adults * n.adultPrice).toLocaleString()}円</td></tr>`;
    }
    if (n.minors > 0) {
      nomihodaiRows += `<tr><td>ソフトドリンク飲み放題 ${n.minors}人 × ${n.minorPrice.toLocaleString()}円</td><td>${(n.minors * n.minorPrice).toLocaleString()}円</td></tr>`;
    }
  }
  // ハッピーアワー割引がある会計だけ、その行を出す（古いデータには hhDiscount がない）
  let discountRow = "";
  if (c.hhDiscount > 0) {
    discountRow = `<tr class="discount-row"><td>ハッピーアワー割引</td><td>−${c.hhDiscount.toLocaleString()}円</td></tr>`;
  }
  return `
    <table class="receipt-table">
      ${nomihodaiRows}
      <tr><td>小計</td><td>${c.subtotal.toLocaleString()}円</td></tr>
      ${discountRow}
      <tr><td>お通し代（300円 × ${c.people}人）</td><td>${c.otoshi.toLocaleString()}円</td></tr>
      <tr><td>消費税（10%）</td><td>${c.tax.toLocaleString()}円</td></tr>
      <tr class="receipt-total"><td>税込合計</td><td>${c.total.toLocaleString()}円</td></tr>
      <tr><td>1人あたり（${c.people}人）</td><td>${c.perPerson.toLocaleString()}円</td></tr>
    </table>
  `;
}

// 「会計する」を押したときの動き：チェックしてから確認画面を出す（まだ会計は確定しない）
function checkout() {
  const errorText = document.getElementById("checkout-error");
  errorText.textContent = "";

  // 人数は最初の人数入力画面で決めたものを使う
  if (slip.people === null) {
    errorText.textContent = "人数が決まっていません。「人数を変える」から入力してください";
    return;
  }

  // 注文が1件もなければ会計しない
  let activeCount = 0;
  for (const order of slip.orders) {
    if (order.status === "注文済み") {
      activeCount++;
    }
  }
  // 飲み放題だけ申し込んで何も頼んでいないときは、飲み放題の料金だけで会計できる
  if (activeCount === 0 && !slip.nomihodai) {
    errorText.textContent = "注文がありません";
    return;
  }

  // カートにまだ注文していない料理が残っていたら、先に注文か削除をしてもらう
  if (slip.cart.length > 0) {
    errorText.textContent = "カートにまだ注文していない料理があります。カートで「注文する」か「削除」をしてください";
    return;
  }

  // 確認画面に、注文内容と会計の内訳を出す
  let rows = "";
  for (const order of slip.orders) {
    if (order.status !== "注文済み") {
      continue;
    }
    rows += `
      <tr>
        <td>${orderLabel(order)}</td>
        <td>× ${order.quantity}</td>
        <td>${(unitPriceOf(order) * order.quantity).toLocaleString()}円</td>
      </tr>
    `;
  }
  document.getElementById("confirm-detail").innerHTML = `
    <table class="confirm-orders">${rows}</table>
    ${checkoutTable(calcCheckout(slip.people))}
  `;
  document.getElementById("confirm").hidden = false;
}

// 確認画面の「戻る」：何も変えずに閉じる
function closeConfirm() {
  document.getElementById("confirm").hidden = true;
}

// 確認画面の「この内容で会計する」：会計を確定する
function confirmCheckout() {
  closeConfirm();

  // 会計情報を伝票に記録して保存する（データは店側に残る）
  slip.checkout = calcCheckout(slip.people);
  slip.checkout.paidAt = getNow().toLocaleString("ja-JP");
  saveSlips();

  // 会計の結果を画面に出す（「注文まとめ」で見られるように、会計した伝票を覚えておく）
  paidSlip = slip;
  showReceipt(slip.checkout);

  // 画面はリセット：次のお客さん用に新しい伝票を始める
  startNewSlip();
  showOrders();
  showCart();
  updateNomihodai();
  // 前のお客さんの年齢・おすすめも消しておく
  document.getElementById("age").value = "";
  checkAgeInput();
  resetRecommend();
  // 次のお客さんは、お客さま情報のページから始める
  showPage("guest");
}

// 最後に会計した伝票（会計の結果の窓から「注文まとめ」を見るときに使う）
let paidSlip = null;

// 会計の結果（内訳・税込合計・1人あたり）を窓に出す
function showReceipt(c) {
  document.getElementById("receipt-detail").innerHTML = checkoutTable(c);
  document.getElementById("receipt").hidden = false;
}

// 会計の窓を閉じて、ようこそ画面に戻る（次のお客さんを迎える）
function closeReceipt() {
  document.getElementById("receipt").hidden = true;
  showWelcome();
}

// 注文まとめの窓を開く：伝票の注文を、取消を除いて「料理」と「ドリンク」に分けてまとめる
// 同じ料理で同じトッピングのものは1行にまとめる
function openSummary(targetSlip) {
  const groups = {}; // キー：料理の id とトッピングの id を並べた文字
  const keys = []; // まとめた行の順番（最初に注文した順）

  for (const order of targetSlip.orders) {
    if (order.status !== "注文済み") {
      continue;
    }
    const toppingIds = [];
    for (const topping of toppingsOf(order)) {
      toppingIds.push(topping.id);
    }
    toppingIds.sort();
    // 飲み放題（0円）で頼んだものと、ふつうに頼んだものは別の行にする
    const key = `${order.menuId}|${toppingIds.join(",")}|${order.nomihodai === true}`;

    if (groups[key] === undefined) {
      const item = findMenu(order.menuId);
      groups[key] = {
        order: order,
        isDrink: item !== null && item.category === "ドリンク",
        quantity: 0,
        amount: 0,
      };
      keys.push(key);
    }
    groups[key].quantity += order.quantity;
    groups[key].amount += unitPriceOf(order) * order.quantity;
  }

  // 「料理」と「ドリンク」の表をそれぞれ作る
  function makeTable(isDrink) {
    let rows = "";
    for (const key of keys) {
      const g = groups[key];
      if (g.isDrink !== isDrink) {
        continue;
      }
      const names = [];
      for (const topping of toppingsOf(g.order)) {
        names.push(topping.name);
      }
      let toppingText = "なし";
      if (names.length > 0) {
        toppingText = names.join("・");
      }
      rows += `
        <tr>
          <td>${g.order.name}${g.order.nomihodai === true ? "（飲み放題）" : ""}</td>
          <td>${toppingText}</td>
          <td>${g.quantity}</td>
          <td>${g.amount.toLocaleString()}円</td>
        </tr>
      `;
    }
    if (rows === "") {
      return '<p class="empty">ありません</p>';
    }
    return `
      <table class="summary-table">
        <tr><th>品名</th><th>トッピング</th><th>数量</th><th>金額</th></tr>
        ${rows}
      </table>
    `;
  }

  let totalCount = 0;
  for (const key of keys) {
    totalCount += groups[key].quantity;
  }

  // ハッピーアワー割引があれば、小計の下に出す
  let summaryDiscount = "";
  const discount = calcHappyHourDiscount(targetSlip);
  if (discount > 0) {
    summaryDiscount = `<p class="summary-total">ハッピーアワー割引 −${discount.toLocaleString()}円</p>`;
  }

  document.getElementById("summary-detail").innerHTML = `
    <h3>料理</h3>
    ${makeTable(false)}
    <h3>ドリンク</h3>
    ${makeTable(true)}
    <p class="summary-total">合計 ${totalCount}品・小計（税抜）${calcSubtotal(targetSlip).toLocaleString()}円</p>
    ${summaryDiscount}
  `;
  document.getElementById("summary").hidden = false;
}

// 注文まとめの窓を閉じる
function closeSummary() {
  document.getElementById("summary").hidden = true;
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
          <td>${orderLabel(order)}</td>
          <td>${order.quantity}</td>
          <td>${(unitPriceOf(order) * order.quantity).toLocaleString()}円</td>
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
  showCart();
  updateNomihodai();
  showPage("guest");
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

// メニュー画面を出す（ページは、最後に見ていたページのまま）
function showApp() {
  document.getElementById("people-screen").hidden = true;
  document.getElementById("app").hidden = false;
  document.getElementById("people-display").textContent = `${slip.people}人`;
  showPage(currentPage);
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
showCart();
showPeopleButtons();
showPage("guest");
updateHappyHour();
updateNomihodai();
buildAds();
restartAdTimer();

// ハッピーアワーの表示（あと○分）は1分ごと、飲み放題の残り時間は1秒ごとに更新する
setInterval(updateHappyHour, 60 * 1000);
setInterval(updateNomihodai, 1000);

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
document.getElementById("mobile-bar").addEventListener("click", function () {
  showPage("cart");
});
for (const tab of document.querySelectorAll(".page-tab")) {
  tab.addEventListener("click", function () {
    showPage(tab.dataset.page);
  });
}
document.getElementById("go-menu").addEventListener("click", function () {
  showPage("menu");
});
document.getElementById("cart-more").addEventListener("click", function () {
  showPage("menu");
});
document.getElementById("place-order").addEventListener("click", placeOrder);
document.getElementById("test-time-on").addEventListener("change", onTestTimeChange);
document.getElementById("test-time").addEventListener("input", onTestTimeChange);
document.getElementById("forward-10").addEventListener("click", function () {
  fastForward(10);
});
document.getElementById("forward-30").addEventListener("click", function () {
  fastForward(30);
});
document.getElementById("forward-reset").addEventListener("click", resetOffset);
document.getElementById("nomihodai-apply").addEventListener("click", openNomihodai);
document.getElementById("nh-cancel").addEventListener("click", closeNomihodai);
document.getElementById("nh-ok").addEventListener("click", applyNomihodai);
for (const input of document.querySelectorAll("#nomihodai input")) {
  input.addEventListener("input", updateNomihodaiForm);
  input.addEventListener("change", updateNomihodaiForm);
}
document.getElementById("checkout-button").addEventListener("click", checkout);
document.getElementById("confirm-back").addEventListener("click", closeConfirm);
document.getElementById("confirm-ok").addEventListener("click", confirmCheckout);
document.getElementById("summary-button").addEventListener("click", function () {
  openSummary(slip);
});
document.getElementById("receipt-summary").addEventListener("click", function () {
  if (paidSlip !== null) {
    openSummary(paidSlip);
  }
});
document.getElementById("summary-close").addEventListener("click", closeSummary);
document.getElementById("receipt-close").addEventListener("click", closeReceipt);
document.getElementById("history-button").addEventListener("click", openHistory);
document.getElementById("history-close").addEventListener("click", closeHistory);
document.getElementById("history-clear").addEventListener("click", clearHistory);

showWelcome();
