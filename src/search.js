const invoke = window.__TAURI__.core.invoke;

const params = new URLSearchParams(window.location.search);
const query = params.get("q") || "";

const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const resultsCount = document.getElementById("results-count");
const resultsList = document.getElementById("results-list");

searchInput.value = query;

searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const q = searchInput.value.trim();
  if (!q) return;
  window.location.href = `search.html?q=${encodeURIComponent(q)}`;
});

async function runSearch() {
  resultsCount.textContent = "";
  resultsList.innerHTML = `<div class="loading" style="grid-column:1/-1"><div class="spinner"></div><span>Searching...</span></div>`;
  try {
    const results = await invoke("search_videos", { query });
    resultsList.innerHTML = "";
    resultsCount.textContent = `${results.length} result${results.length === 1 ? "" : "s"}`;

    for (const r of results) {
      const div = document.createElement("div");
      div.className = "result-item";
      div.innerHTML = `
        <div class="result-thumb-wrap">
          <img class="result-thumb" src="${r.thumbnail}" alt="" loading="lazy"
               onerror="this.closest('.result-thumb-wrap').classList.add('thumb-fallback')" />
          <span class="result-duration">${escapeHtml(r.duration)}</span>
        </div>
        <p class="result-title">${escapeHtml(r.title)}</p>
        <p class="result-meta">${escapeHtml(r.channel)} · ${r.view_count ? r.view_count.toLocaleString() + " views" : "views n/a"}</p>
      `;
      div.addEventListener("click", () => {
        // Folder is chosen/created on the research page for now.
        window.location.href = `research.html?video=${r.youtube_id}&title=${encodeURIComponent(r.title)}&channel=${encodeURIComponent(r.channel)}&thumb=${encodeURIComponent(r.thumbnail)}&duration=${encodeURIComponent(r.duration)}&q=${encodeURIComponent(query)}`;
      });
      resultsList.appendChild(div);
    }

    if (results.length === 0) {
      resultsList.innerHTML = `<div class="empty-state" style="grid-column:1/-1">No results for "${escapeHtml(query)}".</div>`;
    }
  } catch (err) {
    resultsList.innerHTML = `<div class="empty-state" style="grid-column:1/-1">Search failed. Is yt-dlp available?</div>`;
    console.error(err);
  }
}

runSearch();
