const invoke = window.__TAURI__.core.invoke;

const params = new URLSearchParams(window.location.search);
let folderId = params.get("folder");
const incomingVideo = params.get("video");

const player = document.getElementById("player");
const noteBody = document.getElementById("note-body");
const folderNav = document.getElementById("folder-nav");
const videoList = document.getElementById("video-list");
const folderVideoCount = document.getElementById("folder-video-count");
const breadcrumb = document.getElementById("breadcrumb");
const addFolderBtn = document.getElementById("add-folder-btn");
const saveIndicator = document.getElementById("save-indicator");
const saveLabel = document.getElementById("save-label");
const thumbStripWrap = document.getElementById("thumb-strip-wrap");
const thumbStrip = document.getElementById("thumb-strip");

let currentVideoId = null;
let currentVideoMeta = null; // { youtube_id, title, channel, thumbnail, duration }
let currentPlaybackTime = 0;
let folderVideosCache = []; // videos in the active folder, kept for breadcrumb/strip/list

function loadEmbed(youtubeId, meta) {
  // youtube-nocookie.com: reduces (does not eliminate) tracking/ads.
  // enablejsapi=1 lets us postMessage for the current timestamp (used by the clip button).
  player.src = `https://www.youtube-nocookie.com/embed/${youtubeId}?enablejsapi=1&rel=0`;
  currentVideoId = youtubeId;
  currentVideoMeta = meta || currentVideoMeta;

  if (currentVideoMeta) {
    document.getElementById("video-title").textContent = currentVideoMeta.title || "";
    document.getElementById("video-meta").textContent = currentVideoMeta.channel || "";
  }
  addFolderBtn.style.display = "inline-block";
  updateBreadcrumb();
  highlightCurrentInList();
  renderThumbStrip();
}

function updateBreadcrumb() {
  if (!folderId) {
    breadcrumb.textContent = "";
    return;
  }
  const folderName = folderNameCache || "…";
  const idx = folderVideosCache.findIndex(v => v.youtube_id === currentVideoId);
  if (idx === -1 || folderVideosCache.length === 0) {
    breadcrumb.innerHTML = `Folder: <strong>${escapeHtml(folderName)}</strong>`;
  } else {
    breadcrumb.innerHTML = `Folder: <strong>${escapeHtml(folderName)}</strong> · clip ${idx + 1} of ${folderVideosCache.length}`;
  }
}

let folderNameCache = "";

// ---- Folder picker modal ----
// Native window.prompt() is unreliable inside Tauri's webview (WKWebView/
// WebView2 don't consistently support it, especially with a pre-filled
// default value), so folder creation/selection uses this in-page modal
// instead of prompt()/confirm().
const folderModalOverlay = document.getElementById("folder-modal-overlay");
const folderModalTitle = document.getElementById("folder-modal-title");
const folderModalInput = document.getElementById("folder-modal-input");
const folderModalExisting = document.getElementById("folder-modal-existing");
const folderModalCancel = document.getElementById("folder-modal-cancel");
const folderModalConfirm = document.getElementById("folder-modal-confirm");

let modalResolve = null;

function closeFolderModal(result) {
  folderModalOverlay.style.display = "none";
  const resolve = modalResolve;
  modalResolve = null;
  if (resolve) resolve(result);
}

async function pickOrCreateFolder({ title = "Add to folder", suggestedName = "" } = {}) {
  const folders = await invoke("list_folders");

  folderModalTitle.textContent = title;
  folderModalInput.value = suggestedName;
  folderModalExisting.innerHTML = "";
  for (const f of folders) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "modal-existing-chip";
    chip.innerHTML = `<span class="folder-dot" style="background:${colorForFolder(f.id)}"></span>${escapeHtml(f.name)}`;
    chip.addEventListener("click", () => closeFolderModal(f.id));
    folderModalExisting.appendChild(chip);
  }

  folderModalOverlay.style.display = "flex";
  folderModalInput.focus();
  folderModalInput.select();

  return new Promise((resolve) => {
    modalResolve = async (result) => {
      if (result === null || result === undefined) {
        resolve(null);
        return;
      }
      // Existing folder id was clicked directly.
      if (folders.some(f => f.id === result)) {
        resolve(result);
        return;
      }
      // Otherwise `result` is a typed name — reuse a matching folder or create one.
      const name = result.trim();
      if (!name) {
        resolve(null);
        return;
      }
      const existing = folders.find(f => f.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        resolve(existing.id);
        return;
      }
      const id = await invoke("create_folder", { name });
      resolve(id);
    };
  });
}

folderModalCancel.addEventListener("click", () => closeFolderModal(null));
folderModalOverlay.addEventListener("click", (e) => {
  if (e.target === folderModalOverlay) closeFolderModal(null);
});
folderModalConfirm.addEventListener("click", () => closeFolderModal(folderModalInput.value));
folderModalInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); closeFolderModal(folderModalInput.value); }
  if (e.key === "Escape") { e.preventDefault(); closeFolderModal(null); }
});

async function ensureFolder() {
  if (folderId) return folderId;
  // Came straight from search with no folder chosen yet — ask for one,
  // pre-filled with the search query as a starting point for the name.
  const searchQuery = params.get("q") || "";
  const suggestedName = searchQuery.trim().slice(0, 20);
  return pickOrCreateFolder({ title: "Name this folder", suggestedName });
}

async function loadFolderNav() {
  const folders = await invoke("list_folders");
  folderNav.innerHTML = "";

  const withCounts = await Promise.all(
    folders.map(async (f) => {
      let count = 0;
      try {
        const videos = await invoke("list_videos_in_folder", { folderId: f.id });
        count = videos.length;
      } catch { /* ignore */ }
      return { ...f, count };
    })
  );

  for (const f of withCounts) {
    if (f.id === folderId) folderNameCache = f.name;
    const li = document.createElement("li");
    li.className = "folder-nav-item" + (f.id === folderId ? " active" : "");
    li.innerHTML = `
      <span class="folder-dot" style="background:${colorForFolder(f.id)}"></span>
      <span class="fname">${escapeHtml(f.name)}</span>
      <span class="fcount">${f.count}</span>
    `;
    li.addEventListener("click", () => {
      window.location.href = `research.html?folder=${f.id}`;
    });
    folderNav.appendChild(li);
  }
  updateBreadcrumb();
}

document.getElementById("new-folder-btn").addEventListener("click", async () => {
  const id = await pickOrCreateFolder({ title: "New folder" });
  if (!id) return;
  window.location.href = `research.html?folder=${id}`;
});

async function loadVideosInFolder() {
  if (!folderId) return;
  const videos = await invoke("list_videos_in_folder", { folderId });
  folderVideosCache = videos;
  folderVideoCount.textContent = `${videos.length} video${videos.length === 1 ? "" : "s"} in this folder`;

  videoList.innerHTML = "";
  videos.forEach((v, i) => {
    const li = document.createElement("li");
    li.className = "video-list-item" + (v.youtube_id === currentVideoId ? " current" : "");
    li.innerHTML = `<span class="idx">${i + 1}</span><span>${escapeHtml(v.title)}</span>`;
    li.addEventListener("click", () => loadEmbed(v.youtube_id, v));
    videoList.appendChild(li);
  });

  updateBreadcrumb();
  renderThumbStrip();
}

function highlightCurrentInList() {
  document.querySelectorAll(".video-list-item").forEach((li, i) => {
    const v = folderVideosCache[i];
    li.classList.toggle("current", v && v.youtube_id === currentVideoId);
  });
}

function renderThumbStrip() {
  const others = folderVideosCache.filter(v => v.youtube_id !== currentVideoId);
  if (others.length === 0) {
    thumbStripWrap.style.display = "none";
    return;
  }
  thumbStripWrap.style.display = "block";
  thumbStrip.innerHTML = "";
  for (const v of others) {
    const div = document.createElement("div");
    div.className = "strip-item";
    div.innerHTML = `
      <div class="strip-thumb-wrap">
        <img class="strip-thumb" src="${v.thumbnail || ""}" alt=""
             onerror="this.closest('.strip-thumb-wrap').classList.add('thumb-fallback')" />
        ${v.duration ? `<span class="strip-duration">${escapeHtml(v.duration)}</span>` : ""}
      </div>
      <p class="strip-item-title">${escapeHtml(v.title)}</p>
    `;
    div.addEventListener("click", () => loadEmbed(v.youtube_id, v));
    thumbStrip.appendChild(div);
  }
}

async function loadNote() {
  if (!folderId) return;
  try {
    noteBody.value = await invoke("get_note", { folderId });
  } catch (err) {
    console.error("Failed to load note:", err);
  }
}

let saveTimeout;
function setSaveState(state) {
  // state: "idle" | "saving" | "saved"
  saveIndicator.classList.toggle("saved", state === "saved");
  saveLabel.textContent = state === "saving" ? "saving…" : state === "saved" ? "saved" : "idle";
}

noteBody.addEventListener("input", () => {
  setSaveState("saving");
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    if (!folderId) return;
    await invoke("save_note", { folderId, body: noteBody.value });
    setSaveState("saved");
  }, 500);
});

document.getElementById("clip-btn").addEventListener("click", () => {
  if (!currentVideoId) return;
  const mins = Math.floor(currentPlaybackTime / 60);
  const secs = Math.floor(currentPlaybackTime % 60).toString().padStart(2, "0");
  const tag = `\n[clip ${mins}:${secs}] `;
  noteBody.value += tag;
  noteBody.dispatchEvent(new Event("input"));
  noteBody.focus();
});

addFolderBtn.addEventListener("click", async () => {
  if (!currentVideoMeta) return;
  const targetId = await pickOrCreateFolder({
    title: "Add this video to a folder",
    suggestedName: (currentVideoMeta.title || "").slice(0, 20),
  });
  if (!targetId) return;

  await invoke("add_video_to_folder", {
    youtubeId: currentVideoMeta.youtube_id || currentVideoId,
    folderId: targetId,
    title: currentVideoMeta.title || "",
    channel: currentVideoMeta.channel || null,
    thumbnail: currentVideoMeta.thumbnail || null,
    duration: currentVideoMeta.duration || null,
  });

  if (targetId === folderId) {
    await loadVideosInFolder();
  } else {
    window.location.href = `research.html?folder=${targetId}`;
  }
});

// Top search bar just jumps to the search results page like the home one.
document.getElementById("top-search-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const q = document.getElementById("top-search-input").value.trim();
  if (!q) return;
  window.location.href = `search.html?q=${encodeURIComponent(q)}`;
});

// YouTube IFrame postMessage API: poll current time so the clip button
// can tag the note with a real timestamp.
window.addEventListener("message", (event) => {
  if (!event.origin.includes("youtube")) return;
  try {
    const data = JSON.parse(event.data);
    if (data.info && typeof data.info.currentTime === "number") {
      currentPlaybackTime = data.info.currentTime;
    }
  } catch { /* not a JSON message we care about, ignore */ }
});

setInterval(() => {
  if (player.contentWindow) {
    player.contentWindow.postMessage('{"event":"listening","id":1}', "*");
  }
}, 1000);

// Tab switching
document.querySelectorAll(".tab").forEach((tab) => {
  if (tab.disabled) return;
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById("tab-description").style.display = tab.dataset.tab === "description" ? "block" : "none";
    document.getElementById("tab-comments").style.display = tab.dataset.tab === "comments" ? "block" : "none";
    if (tab.dataset.tab === "comments" && currentVideoId) loadComments(currentVideoId);
  });
});

async function loadComments(youtubeId) {
  const el = document.getElementById("tab-comments");
  el.innerHTML = `<div class="loading"><div class="spinner"></div><span>Loading comments...</span></div>`;
  try {
    const comments = await invoke("fetch_comments", { youtubeId });
    el.innerHTML = comments.map(c => `
      <div class="comment-item">
        <div class="comment-author">${escapeHtml(c.author)}</div>
        <p class="comment-text">${escapeHtml(c.text)}</p>
      </div>
    `).join("") || `<div class="empty-state">No comments.</div>`;
  } catch (err) {
    el.innerHTML = `<div class="empty-state">Failed to load comments.</div>`;
    console.error(err);
  }
}

async function init() {
  if (incomingVideo) {
    const resolvedFolder = await ensureFolder();
    const meta = {
      youtube_id: incomingVideo,
      title: params.get("title") || incomingVideo,
      channel: params.get("channel"),
      thumbnail: params.get("thumb"),
      duration: params.get("duration"),
    };
    if (resolvedFolder) {
      folderId = resolvedFolder;
      await invoke("add_video_to_folder", {
        youtubeId: meta.youtube_id,
        folderId,
        title: meta.title,
        channel: meta.channel,
        thumbnail: meta.thumbnail,
        duration: meta.duration,
      });
    }
    loadEmbed(incomingVideo, meta);
  }

  await loadFolderNav();
  await loadVideosInFolder();
  await loadNote();

  if (!currentVideoId && folderVideosCache.length > 0) {
    loadEmbed(folderVideosCache[0].youtube_id, folderVideosCache[0]);
  }
  updateBreadcrumb();
}

document.getElementById("tab-description").className = "tab-panel muted";
document.getElementById("tab-description").textContent = "Description isn't pulled by the backend yet — only search metadata is stored per video.";

init();
