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
// 進捗表示ヘルパー
// ============================================
const STEPS = [
  { id: "fetch",    label: "Step1: 外部ニュースソースから情報収集中..." },
  { id: "cache",    label: "Step2: Workers KVでキャッシュ確認中..." },
  { id: "classify", label: "Step3: Workers AIで分類・要約中..." },
  { id: "analyze",  label: "Step4: Gemini APIでトレンド分析中..." },
  { id: "compose",  label: "Step5: アクションプラン生成中..." }
];

function renderProgress(activeIndex) {
  progressList.innerHTML = "";
  STEPS.forEach((step, i) => {
    const li = document.createElement("li");
    li.textContent = step.label;
    if (i < activeIndex) li.classList.add("done");
    else if (i === activeIndex) li.classList.add("running");
    progressList.appendChild(li);
  });
}

// ============================================
// メイン: エージェント実行
// ============================================
runBtn.addEventListener("click", async () => {
  const keyword = keywordInput.value.trim();
  const category = categorySelect.value;

  // UIリセット
  runBtn.disabled = true;
  runBtn.textContent = "🤖 実行中...";
  progressEl.classList.remove("hidden");
  summaryEl.classList.add("hidden");
  newsSection.classList.add("hidden");
  actionsEl.classList.add("hidden");

  // 進捗を順次表示(視覚演出)
  for (let i = 0; i < STEPS.length; i++) {
    renderProgress(i);
    await new Promise(r => setTimeout(r, 400));
  }

  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword, category })
    });

    if (!res.ok) throw new Error(`Worker error: ${res.status}`);
    const data = await res.json();

    // 全Step完了表示
    renderProgress(STEPS.length);

    // サマリー表示
    summaryContent.textContent = data.summary || "サマリーがありません。";
    summaryEl.classList.remove("hidden");

    // ニュース一覧表示
    newsList.innerHTML = "";
    (data.news || []).forEach(item => {
      const div = document.createElement("div");
      div.className = "news-item";
      div.innerHTML = `
        <h3><a href="${item.link}" target="_blank" rel="noopener">${escapeHtml(item.title)}</a></h3>
        <div class="news-meta">
          <span class="news-tag">${escapeHtml(item.category || "general")}</span>
          <span>${escapeHtml(item.source || "")} ・ ${escapeHtml(item.pubDate || "")}</span>
        </div>
        <p class="news-summary">${escapeHtml(item.summary || "")}</p>
      `;
      newsList.appendChild(div);
    });
    newsSection.classList.remove("hidden");

    // 推奨アクション表示
    actionsList.innerHTML = "";
    (data.actions || []).forEach(act => {
      const li = document.createElement("li");
      li.textContent = act;
      actionsList.appendChild(li);
    });
    actionsEl.classList.remove("hidden");

  } catch (err) {
    alert("エラーが発生しました: " + err.message);
    console.error(err);
  } finally {
    runBtn.disabled = false;
    runBtn.textContent = "🤖 エージェント実行";
  }
});

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
