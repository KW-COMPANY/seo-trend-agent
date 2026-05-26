const WORKER_URL = "https://seo-trend-agent.gmo-k-watanabe.workers.dev";

// ============================================
// DOM要素
// ============================================
const runBtn = document.getElementById("runAgent");
const keywordInput = document.getElementById("keyword");
const categorySelect = document.getElementById("category");

const progressEl = document.getElementById("progress");
const progressList = document.getElementById("progressList");

const summaryEl = document.getElementById("summary");
const summaryContent = document.getElementById("summaryContent");

const newsSection = document.getElementById("newsSection");
const newsList = document.getElementById("newsList");

const actionsEl = document.getElementById("actions");
const actionsList = document.getElementById("actionsList");

// ============================================
// 実行状態管理
// ============================================
let isRunning = false;
let currentController = null;

// ============================================
// AIエージェント処理ステップ
// ============================================
const STEPS = [
  {
    id: "fetch",
    label: "Step1: 外部ニュースソースから情報収集中..."
  },
  {
    id: "cache",
    label: "Step2: キャッシュ・過去分析データ確認中..."
  },
  {
    id: "classify",
    label: "Step3: AIによるカテゴリ分類・重要度分析中..."
  },
  {
    id: "analyze",
    label: "Step4: SEOトレンドの統合分析中..."
  },
  {
    id: "compose",
    label: "Step5: 実行アクションプラン生成中..."
  }
];

// ============================================
// 初期化
// ============================================
resetUI();

// ============================================
// イベント
// ============================================
runBtn.addEventListener("click", runAgent);

// ============================================
// メイン実行
// ============================================
async function runAgent() {

  if (isRunning) {
    return;
  }

  const keyword = keywordInput.value.trim();
  const category = categorySelect.value;

  // UI初期化
  resetResultSections();

  // 実行状態
  isRunning = true;

  runBtn.disabled = true;
  runBtn.textContent = "🤖 AIエージェント実行中...";

  progressEl.classList.remove("hidden");

  // AbortController
  currentController = new AbortController();

  // 疑似進捗開始
  startProgressAnimation();

  try {

    // ============================================
    // fetch timeout
    // ============================================
    const timeoutId = setTimeout(() => {
      currentController.abort();
    }, 45000);

    const response = await fetch(WORKER_URL, {
      method: "POST",
      signal: currentController.signal,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        keyword,
        category
      })
    });

    clearTimeout(timeoutId);

    // ============================================
    // HTTPエラー
    // ============================================
    if (!response.ok) {

      let errorText = "";

      try {
        errorText = await response.text();
      } catch {
        errorText = `HTTP Error ${response.status}`;
      }

      throw new Error(
        `サーバーエラー (${response.status})\n${errorText.slice(0, 200)}`
      );
    }

    // ============================================
    // JSON安全確認
    // ============================================
    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {

      const text = await response.text();

      throw new Error(
        "JSON形式ではないレスポンスが返されました。\n" +
        text.slice(0, 300)
      );
    }

    // ============================================
    // JSON解析
    // ============================================
    let data;

    try {
      data = await response.json();
    } catch (jsonError) {
      throw new Error(
        "JSON解析に失敗しました。\n" + jsonError.message
      );
    }

    // ============================================
    // Workerエラー
    // ============================================
    if (data.error) {
      throw new Error(data.error);
    }

    // ============================================
    // データ正常化
    // ============================================
    const summary =
      typeof data.summary === "string"
        ? data.summary
        : "分析結果を取得できませんでした。";

    const news =
      Array.isArray(data.news)
        ? data.news
        : [];

    const actions =
      Array.isArray(data.actions)
        ? data.actions
        : [];

    // ============================================
    // 完了表示
    // ============================================
    renderProgress(STEPS.length);

    // ============================================
    // サマリー表示
    // ============================================
    summaryContent.textContent = summary;

    summaryEl.classList.remove("hidden");

    // ============================================
    // ニュース表示
    // ============================================
    renderNews(news);

    // ============================================
    // アクション表示
    // ============================================
    renderActions(actions);

    // ============================================
    // 空データ対策
    // ============================================
    if (
      news.length === 0 &&
      actions.length === 0 &&
      !summary
    ) {
      throw new Error(
        "データが空でした。RSSまたはAI生成に失敗した可能性があります。"
      );
    }

  } catch (error) {

    console.error("Agent Error:", error);

    handleError(error);

  } finally {

    isRunning = false;

    runBtn.disabled = false;
    runBtn.textContent = "🤖 エージェント実行";

    currentController = null;
  }
}

// ============================================
// 疑似進捗アニメーション
// ============================================
async function startProgressAnimation() {

  for (let i = 0; i < STEPS.length; i++) {

    if (!isRunning) {
      return;
    }

    renderProgress(i);

    await sleep(500);
  }
}

// ============================================
// 進捗描画
// ============================================
function renderProgress(activeIndex) {

  progressList.innerHTML = "";

  STEPS.forEach((step, index) => {

    const li = document.createElement("li");

    li.textContent = step.label;

    if (index < activeIndex) {
      li.classList.add("done");
    } else if (index === activeIndex) {
      li.classList.add("running");
    }

    progressList.appendChild(li);
  });
}

// ============================================
// ニュース描画
// ============================================
function renderNews(news) {

  newsList.innerHTML = "";

  if (!Array.isArray(news) || news.length === 0) {

    const empty = document.createElement("div");

    empty.className = "news-item";

    empty.innerHTML = `
      <p class="news-summary">
        関連ニュースが見つかりませんでした。
      </p>
    `;

    newsList.appendChild(empty);

    newsSection.classList.remove("hidden");

    return;
  }

  news.forEach(item => {

    const div = document.createElement("div");

    div.className = "news-item";

    const safeTitle = escapeHtml(item.title || "タイトルなし");

    const safeLink = safeUrl(item.link);

    const safeCategory = escapeHtml(
      item.category || "general"
    );

    const safeSource = escapeHtml(
      item.source || "Unknown"
    );

    const safeDate = escapeHtml(
      item.pubDate || ""
    );

    const safeSummary = escapeHtml(
      item.summary || ""
    );

    const importance =
      typeof item.importance === "number"
        ? Math.min(Math.max(item.importance, 1), 5)
        : null;

    div.innerHTML = `
      <h3>
        <a href="${safeLink}"
           target="_blank"
           rel="noopener noreferrer">
          ${safeTitle}
        </a>
      </h3>

      <div class="news-meta">
        <span class="news-tag">${safeCategory}</span>
        <span>${safeSource}</span>
        <span>${safeDate}</span>
      </div>

      ${
        importance
          ? `
          <div class="news-meta">
            重要度:
            ${"⭐".repeat(importance)}
          </div>
        `
          : ""
      }

      <p class="news-summary">
        ${safeSummary}
      </p>
    `;

    newsList.appendChild(div);
  });

  newsSection.classList.remove("hidden");
}

// ============================================
// アクション描画
// ============================================
function renderActions(actions) {

  actionsList.innerHTML = "";

  if (!Array.isArray(actions) || actions.length === 0) {

    const li = document.createElement("li");

    li.textContent =
      "推奨アクションを生成できませんでした。";

    actionsList.appendChild(li);

  } else {

    actions.forEach(action => {

      if (!action || typeof action !== "string") {
        return;
      }

      const li = document.createElement("li");

      li.textContent = action.trim();

      actionsList.appendChild(li);
    });
  }

  actionsEl.classList.remove("hidden");
}

// ============================================
// エラー処理
// ============================================
function handleError(error) {

  let message = "不明なエラーが発生しました。";

  // Abort
  if (error.name === "AbortError") {

    message =
      "通信がタイムアウトしました。\n" +
      "しばらく待ってから再実行してください。";

  } else if (error.message) {

    message = error.message;
  }

  summaryContent.textContent = message;

  summaryEl.classList.remove("hidden");

  newsSection.classList.add("hidden");

  actionsEl.classList.add("hidden");

  alert(message);
}

// ============================================
// UIリセット
// ============================================
function resetUI() {

  progressEl.classList.add("hidden");

  summaryEl.classList.add("hidden");

  newsSection.classList.add("hidden");

  actionsEl.classList.add("hidden");
}

// ============================================
// 結果セクションリセット
// ============================================
function resetResultSections() {

  summaryContent.textContent = "";

  newsList.innerHTML = "";

  actionsList.innerHTML = "";

  summaryEl.classList.add("hidden");

  newsSection.classList.add("hidden");

  actionsEl.classList.add("hidden");
}

// ============================================
// HTMLエスケープ
// ============================================
function escapeHtml(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ============================================
// URL安全化
// ============================================
function safeUrl(url) {

  try {

    const parsed = new URL(url);

    if (
      parsed.protocol === "http:" ||
      parsed.protocol === "https:"
    ) {
      return parsed.href;
    }

    return "#";

  } catch {

    return "#";
  }
}

// ============================================
// sleep
// ============================================
function sleep(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}
