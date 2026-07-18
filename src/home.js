const invoke = window.__TAURI__.core.invoke;

const folderList = document.getElementById("folder-list");
const foldersSection = document.getElementById("folders-section");
const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");

async function loadFolders() {
  try {
    const folders = await invoke("list_folders");

    if (folders.length === 0) {
      foldersSection.style.display = "none";
      return;
    }
    foldersSection.style.display = "";

    // Video count per folder isn't returned by list_folders, so fetch it
    // alongside. Fine at this scale; revisit if folder counts grow large.
    const withCounts = await Promise.all(
      folders.map(async (f) => {
        let count = 0;
        try {
          const videos = await invoke("list_videos_in_folder", { folderId: f.id });
          count = videos.length;
        } catch { /* leave count at 0 */ }
        return { ...f, count };
      })
    );

    folderList.innerHTML = "";
    withCounts.forEach((f) => {
      const li = document.createElement("li");
      li.className = "folder-item";
      li.style.borderLeftColor = colorForFolder(f.id);
      li.innerHTML = `
        <span class="folder-name">${escapeHtml(f.name)}</span>
        <span class="folder-meta">${f.count} video${f.count === 1 ? "" : "s"} · ${timeAgo(f.created_at)}</span>
      `;
      li.addEventListener("click", () => {
        window.location.href = `research.html?folder=${f.id}`;
      });
      folderList.appendChild(li);
    });
  } catch (err) {
    console.error("Failed to load folders:", err);
  }
}

searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const q = searchInput.value.trim();
  if (!q) return;
  window.location.href = `search.html?q=${encodeURIComponent(q)}`;
});

// "/" focuses the search box, unless the user is already typing somewhere.
document.addEventListener("keydown", (e) => {
  if (e.key === "/" && document.activeElement !== searchInput) {
    e.preventDefault();
    searchInput.focus();
  }
});

loadFolders();
