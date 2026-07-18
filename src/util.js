// Shared helpers used across home.js / research.js.
// Folder colors aren't stored in the DB, so we derive a stable color per
// folder id (same folder always gets the same color, independent of list order).
const FOLDER_COLORS = ["#5ecdaa", "#e8a33d", "#ea6178", "#7c93e8", "#a481e8"];

function colorForFolder(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return FOLDER_COLORS[hash % FOLDER_COLORS.length];
}

// sqlite datetime('now') returns UTC "YYYY-MM-DD HH:MM:SS" with no offset marker.
function parseSqliteUtc(s) {
  return new Date(s.replace(" ", "T") + "Z");
}

function timeAgo(sqliteDateStr) {
  const then = parseSqliteUtc(sqliteDateStr).getTime();
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return months < 1 ? "1mo ago" : `${months}mo ago`;
}

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s ?? "";
  return div.innerHTML;
}
