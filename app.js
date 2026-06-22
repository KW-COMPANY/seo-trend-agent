const WORKER_URL = "https://seo-trend-agent.gmo-k-watanabe.workers.dev";

// ============================================
// DOM要素
// ============================================
const runBtn        = document.getElementById("runAgent");
const keywordInput  = document.getElementById("keyword");
const categorySelect = document.getElementById("category");

const progressEl    = document.getElementById("progress");
const progressList  = document.getElementById("progressList");

const summaryEl     = document.getElementById("summary");
const summaryMeta   = document.getElementById("summaryMeta");
const summaryContent = document.getElementById("summaryContent");

const newsSection   = document.getElementById("newsSection");
const newsList      = document.getElementById("newsList");
const newsCountEl   = document.getElementById("newsCount");
const cacheLabel    = document.getElementById("cacheLabel");

const actionsEl     = document.getElementById("actions");
const actionsList   = document.getElementById("actionsList");

const errorBox      = document.getElementById("errorBox");
const errorMessage  = document.getElementById("errorMessage");

// ============================================
// 実行状態管理
// ============================================
let isRunning = false;
let currentController = null;

// ============================================
// AIエージェント処理ステップ
// ============================================
const STEPS = [
  { id: "fetch",    label: "Step1: 外部ニュースソースから情報収集中..." },
  { id: "dedup",    label: "Step2: 重複除去・ルールベース分類中..." },
  { id: "classify", label: "Step3: カテゴリ判定・重要度スコアリング中..." },
  { id: "analyze",  label: "Step4: Gemini AIによるSEOトレンド分析中..." },
  { id: "compose",  label: "Step5: 推奨アクションプランを生成中..." }
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

  if (isRunning) return;

  const keyword  = keywordInput.value.trim();
  const category = categorySelect.value;

  // UI初期化
  resetResultSections();

  // 実行状態
  isRunning = true;
  runBtn.disabled  = true;
  runBtn.textContent = "🤖 AIエージェント実行中...";

  progressEl.classList.remove("hidden");

  // AbortController
  currentController = new AbortController();

  // 疑似進捗開始
  const progressPromise = startProgressAnimation();

  try {

    // ============================================
    // fetch timeout（55秒）
    // ============================================
    const timeoutId = setTimeout(() => {
      if (currentController) currentController.abort();
    }, 55000);

    const response = await fetch(WORKER_URL, {
      method: "POST",
      signal: currentController.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword, category })
    });

    clearTimeout(timeoutId);

    // ============================================
    // HTTPエラー確認
    // ============================================
    const contentType = response.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");

    if (!response.ok && !isJson) {
      let errorText = "";
      try {
        errorText = await response.text();
      } catch {
        errorText = `HTTP Error ${response.status}`;
      }
      throw new Error(`サーバーエラー (${response.status})\n${errorText.slice(0, 200)}`);
    }

    if (!isJson) {
      const text = await response.text();
      throw new Error("JSON形式ではないレスポンスが返されました。\n" + text.slice(0, 300));
    }

    // ============================================
    // JSON解析
    // ============================================
    let data;
    try {
      data = await response.json();
    } catch (jsonError) {
      throw new Error("JSON解析に失敗しました。\n" + jsonError.message);
    }

    // ============================================
    // データ正常化
    // ============================================
    const summary =
      typeof data.summary === "string" && data.summary.length > 0
        ? data.summary
        : (data.error ? `エラー: ${data.error}` : "分析結果を取得できませんでした。");

    const news    = Array.isArray(data.news)    ? data.news    : [];
    const actions = Array.isArray(data.actions) ? data.actions : [];
    const isCached = data.cached === true;

    // ============================================
    // 進捗を完了状態に確定
    // ============================================
    renderProgress(STEPS.length);

    // ============================================
    // サマリー表示
    // ============================================
    renderSummary(summary, isCached, data.generatedAt);

    // ============================================
    // ニュース表示
    // ============================================
    renderNews(news, isCached);

    // ============================================
    // アクション表示
    // ============================================
    renderActions(actions);

    // ============================================
    // 全データ空の場合のみ警告
    // ============================================
    if (news.length === 0 && actions.length === 0 && (!summary || summary.length < 5)) {
      throw new Error("データが空でした。RSSまたはAI生成に失敗した可能性があります。");
    }

  } catch (error) {

    console.error("Agent Error:", error);
    handleError(error);

  } finally {

    isRunning = false;
    runBtn.disabled    = false;
    runBtn.textContent = "🤖 エージェント実行";
    currentController  = null;
  }
}

// ============================================
// 疑似進捗アニメーション
// ============================================
async function startProgressAnimation() {
  const intervals = [1000, 1200, 1500, 4000, 6000];
  for (let i = 0; i < STEPS.length; i++) {
    if (!isRunning) return;
    renderProgress(i);
    await sleep(intervals[i] || 1000);
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
// サマリー描画（改行・キャッシュバッジ対応）
// ============================================
function renderSummary(summary, isCached, generatedAt) {

  // summaryContent をテキストノードで安全に描画
  summaryContent.textContent = "";
  const lines = summary.split("\n");
  lines.forEach((line, i) => {
    summaryContent.appendChild(document.createTextNode(line));
    if (i < lines.length - 1) {
      summaryContent.appendChild(document.createElement("br"));
    }
  });

  // メタ情報
  let metaText = "";
  if (generatedAt) {
    try {
      const dt = new Date(generatedAt);
      metaText = `生成日時: ${dt.toLocaleString("ja-JP")}`;
    } catch {}
  }
  if (isCached) metaText += (metaText ? " ／ " : "") + "⚡ キャッシュから高速表示";
  summaryMeta.textContent = metaText;

  summaryEl.classList.remove("hidden");
}

// ============================================
// ニュース描画
// ============================================
function renderNews(news, isCached) {

  newsList.innerHTML = "";

  // 件数表示
  if (newsCountEl) {
    newsCountEl.textContent = String(Array.isArray(news) ? news.length : 0);
  }

  // キャッシュバッジ
  if (cacheLabel) {
    if (isCached) {
      cacheLabel.classList.remove("hidden");
    } else {
      cacheLabel.classList.add("hidden");
    }
  }

  if (!Array.isArray(news) || news.length === 0) {
    const empty = document.createElement("div");
    empty.className = "news-item";
    empty.innerHTML = `
      <p class="news-summary">
        関連ニュースが見つかりませんでした。キーワードやカテゴリを変更して再実行してください。
      </p>
    `;
    newsList.appendChild(empty);
    newsSection.classList.remove("hidden");
    return;
  }

  news.forEach(item => {
    const div = document.createElement("div");

    const importance =
      typeof item.importance === "number"
        ? Math.min(Math.max(item.importance, 1), 5)
        : null;

    let priorityClass = "";
    if (importance !== null) {
      if (importance >= 4) priorityClass = "high-priority";
      else if (importance === 3) priorityClass = "medium-priority";
      else priorityClass = "low-priority";
    }

    div.className = `news-item ${priorityClass}`.trim();

    const safeTitle    = escapeHtml(item.title   || "タイトルなし");
    const safeLink     = safeUrl(item.link);
    const safeCategory = escapeHtml(item.category || "general");
    const safeSource   = escapeHtml(item.source   || "Unknown");
    const safeDate     = escapeHtml(item.pubDate  || "");
    const safeSummary  = escapeHtml(item.summary  || "");

    div.innerHTML = `
      <h3>
        <a href="${safeLink}" target="_blank" rel="noopener noreferrer">
          ${safeTitle}
        </a>
      </h3>

      <div class="news-meta">
        <span class="news-tag">${safeCategory}</span>
        <span>${safeSource}</span>
        <span>${safeDate}</span>
      </div>

      ${importance ? `
        <div class="news-meta">
          重要度: ${"⭐".repeat(importance)}
        </div>
      ` : ""}

      <p class="news-summary">${safeSummary}</p>
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
    li.textContent = "推奨アクションを生成できませんでした。";
    actionsList.appendChild(li);
  } else {
    actions.forEach(action => {
      if (!action || typeof action !== "string") return;
      const li = document.createElement("li");
      li.textContent = action.trim();
      actionsList.appendChild(li);
    });
  }

  actionsEl.classList.remove("hidden");
}

// ============================================
// エラー処理（専用エラーボックスへ表示）
// ============================================
function handleError(error) {

  let message = "不明なエラーが発生しました。";

  if (error.name === "AbortError") {
    message =
      "通信がタイムアウトしました。\n" +
      "しばらく待ってから再実行してください。";
  } else if (error.message) {
    message = error.message;
  }

  // 専用エラーボックスに表示
  if (errorMessage) errorMessage.textContent = message;
  if (errorBox)     errorBox.classList.remove("hidden");

  // summaryへのエラー表示は行わない（既に描画済みのデータは保持）
  if (!summaryContent.textContent) {
    summaryEl.classList.add("hidden");
  }

  if (!newsList.hasChildNodes())    newsSection.classList.add("hidden");
  if (!actionsList.hasChildNodes()) actionsEl.classList.add("hidden");
}

// ============================================
// UIリセット
// ============================================
function resetUI() {
  progressEl.classList.add("hidden");
  summaryEl.classList.add("hidden");
  newsSection.classList.add("hidden");
  actionsEl.classList.add("hidden");
  if (errorBox) errorBox.classList.add("hidden");
}

// ============================================
// 結果セクションリセット
// ============================================
function resetResultSections() {
  summaryContent.textContent = "";
  if (summaryMeta)   summaryMeta.textContent  = "";
  newsList.innerHTML    = "";
  actionsList.innerHTML = "";

  summaryEl.classList.add("hidden");
  newsSection.classList.add("hidden");
  actionsEl.classList.add("hidden");
  if (errorBox)    errorBox.classList.add("hidden");
  if (errorMessage) errorMessage.textContent = "";
}

// ============================================
// HTMLエスケープ
// ============================================
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&#039;");
}

// ============================================
// URL安全化
// ============================================
function safeUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
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
  return new Promise(resolve => setTimeout(resolve, ms));
}
