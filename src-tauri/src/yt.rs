use serde::{Serialize, Deserialize};
use tauri_plugin_shell::ShellExt;
use tauri::AppHandle;

#[derive(Serialize, Deserialize, Debug)]
pub struct SearchResult {
    pub youtube_id: String,
    pub title: String,
    pub channel: String,
    pub duration: String,
    pub view_count: Option<i64>,
    pub thumbnail: String,
    pub upload_date: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Comment {
    pub author: String,
    pub text: String,
    pub like_count: Option<i64>,
}

/// Runs the bundled yt-dlp sidecar with `--dump-json` and parses one JSON
/// object per line (yt-dlp's flat-playlist / search output format).
pub async fn search(app: &AppHandle, query: &str, limit: u32) -> Result<Vec<SearchResult>, String> {
    let search_spec = format!("ytsearch{}:{}", limit, query);

    let output = app
        .shell()
        .sidecar("yt-dlp")
        .map_err(|e| e.to_string())?
        .args(["--dump-json", "--flat-playlist", "--no-warnings", &search_spec])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut results = Vec::new();

    for line in stdout.lines() {
        if line.trim().is_empty() {
            continue;
        }
        let v: serde_json::Value = serde_json::from_str(line).map_err(|e| e.to_string())?;
        let id = v["id"].as_str().unwrap_or_default().to_string();
        results.push(SearchResult {
            youtube_id: id.clone(),
            title: v["title"].as_str().unwrap_or_default().to_string(),
            channel: v["channel"].as_str().unwrap_or_default().to_string(),
            duration: format_duration(v["duration"].as_f64()),
            view_count: v["view_count"].as_i64(),
            thumbnail: format!("https://i.ytimg.com/vi/{}/hqdefault.jpg", id),
            upload_date: v["upload_date"].as_str().map(|s| s.to_string()),
        });
    }

    Ok(results)
}

/// Fetches top-level comments for a video via yt-dlp's comment extractor.
pub async fn get_comments(app: &AppHandle, youtube_id: &str, limit: u32) -> Result<Vec<Comment>, String> {
    let url = format!("https://www.youtube.com/watch?v={}", youtube_id);

    let output = app
        .shell()
        .sidecar("yt-dlp")
        .map_err(|e| e.to_string())?
        .args([
            "--skip-download",
            "--write-comments",
            "--extractor-args",
            &format!("youtube:max_comments={}", limit),
            "--dump-json",
            "--no-warnings",
            &url,
        ])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let v: serde_json::Value = serde_json::from_str(stdout.lines().next().unwrap_or("{}"))
        .map_err(|e| e.to_string())?;

    let comments = v["comments"]
        .as_array()
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .take(limit as usize)
        .map(|c| Comment {
            author: c["author"].as_str().unwrap_or("unknown").to_string(),
            text: c["text"].as_str().unwrap_or_default().to_string(),
            like_count: c["like_count"].as_i64(),
        })
        .collect();

    Ok(comments)
}

fn format_duration(seconds: Option<f64>) -> String {
    match seconds {
        Some(s) => {
            let total = s as u64;
            let h = total / 3600;
            let m = (total % 3600) / 60;
            let sec = total % 60;
            if h > 0 {
                format!("{}:{:02}:{:02}", h, m, sec)
            } else {
                format!("{}:{:02}", m, sec)
            }
        }
        None => "--:--".to_string(),
    }
}
