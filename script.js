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

// カテゴリタブを表示する
function showTabs() {
  const tabs = document.getElementById("tabs");
  tabs.innerHTML = "";

  for (const category of categories) {
    const button = document.createElement("button");
    button.textContent = category;
    button.className = "tab";
    if (category === currentCategory) {
      button.classList.add("active");
    }
    button.addEventListener("click", function () {
      currentCategory = category;
      showTabs();
      showMenu();
    });
    tabs.appendChild(button);
  }
}

// 今のカテゴリのメニューを表示する
function showMenu() {
  const menuList = document.getElementById("menu-list");
  menuList.innerHTML = "";

  for (const item of menu) {
    if (item.category !== currentCategory) {
      continue;
    }

    let allergenText = "なし";
    if (item.allergens.length > 0) {
      allergenText = item.allergens.join("・");
    }

    // お酒には「20歳以上」の印を付ける
    let alcoholMark = "";
    if (item.isAlcohol) {
      alcoholMark = '<p class="alcohol-mark">お酒（20歳以上）</p>';
    }

    const card = document.createElement("div");
    card.className = "menu-item";
    card.innerHTML = `
      <h2>${item.name}</h2>
      ${alcoholMark}
      <p class="price">${item.price}円（税抜）</p>
      <p class="allergen">アレルギー：${allergenText}</p>
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

// 「おすすめを見る」を押したときの動き
// 年齢・お腹の空き具合・好みから、ドリンク1品・料理1品・もう1品の3品を選んで表示する
function showRecommend() {
  const errorText = document.getElementById("recommend-error");
  const list = document.getElementById("recommend-list");
  errorText.textContent = "";
  list.innerHTML = "";

  // 年齢は必ず入れてもらう（おかしな値ならエラーを出して、おすすめは出さない）
  const result = readAge();
  if (result.error !== "") {
    errorText.textContent = result.error;
    return;
  }
  if (result.age === null) {
    errorText.textContent = "おすすめを見るには、年齢を入力してください";
    return;
  }
  const age = result.age;

  // ① 年齢からドリンクを選ぶ（数字は menu.js の id）
  let drinkId = 37; // 12歳以下：オレンジジュース
  if (age >= 20) {
    drinkId = 27; // 20歳以上：生ビール
  } else if (age >= 13) {
    drinkId = 36; // 13〜19歳：ウーロン茶
  }

  // ② お腹の空き具合から料理を選ぶ
  const hunger = readRadio("hunger");
  let foodId = 8; // ふつう：もも（タレ）
  if (hunger === "ぺこぺこ") {
    foodId = 22; // 鶏白湯ラーメン
  } else if (hunger === "少しだけ") {
    foodId = 1; // 枝豆
  }

  // ③ 好みからもう1品を選ぶ
  const taste = readRadio("taste");
  let tasteId = 2; // さっぱり：冷やしトマト
  if (taste === "こってり") {
    tasteId = 18; // 鶏の唐揚げ
  } else if (taste === "甘いもの") {
    tasteId = 42; // 抹茶プリン
  }

  // 3品をカードにして並べる
  const picks = [
    { id: drinkId, reason: `${age}歳のあなたに` },
    { id: foodId, reason: `お腹の空き具合「${hunger}」に` },
    { id: tasteId, reason: `「${taste}」が好きなあなたに` },
  ];

  for (const pick of picks) {
    const item = findMenu(pick.id);
    if (item === null) {
      continue;
    }

    const card = document.createElement("div");
    card.className = "recommend-item";
    card.innerHTML = `
      <p class="recommend-reason">${pick.reason}</p>
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

    list.appendChild(card);
  }
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
  document.getElementById("subtotal").textContent = `小計（税抜）：${calcSubtotal().toLocaleString()}円`;
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
  document.querySelector('input[name="hunger"][value="ふつう"]').checked = true;
  document.querySelector('input[name="taste"][value="さっぱり"]').checked = true;
  document.getElementById("recommend-list").innerHTML = "";
  document.getElementById("recommend-error").textContent = "";
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
document.getElementById("checkout-button").addEventListener("click", checkout);
document.getElementById("receipt-close").addEventListener("click", closeReceipt);
document.getElementById("history-button").addEventListener("click", openHistory);
document.getElementById("history-close").addEventListener("click", closeHistory);
document.getElementById("history-clear").addEventListener("click", clearHistory);

showWelcome();
