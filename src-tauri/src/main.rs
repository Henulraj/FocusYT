#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;
mod yt;
mod ad_block;

use std::sync::Mutex;
use rusqlite::Connection;
use tauri::{Manager, State};
use uuid::Uuid;

struct Db(Mutex<Connection>);

#[tauri::command]
async fn search_videos(app: tauri::AppHandle, query: String) -> Result<Vec<yt::SearchResult>, String> {
    yt::search(&app, &query, 20).await
}

#[tauri::command]
async fn fetch_comments(app: tauri::AppHandle, youtube_id: String) -> Result<Vec<yt::Comment>, String> {
    yt::get_comments(&app, &youtube_id, 30).await
}

#[tauri::command]
fn list_folders(db: State<Db>) -> Result<Vec<db::Folder>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::list_folders(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_folder(db: State<Db>, name: String) -> Result<String, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    db::create_folder(&conn, &id, &name).map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
fn list_videos_in_folder(db: State<Db>, folder_id: String) -> Result<Vec<db::Video>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::list_videos_in_folder(&conn, &folder_id).map_err(|e| e.to_string())
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
fn add_video_to_folder(
    db: State<Db>,
    youtube_id: String,
    folder_id: String,
    title: String,
    channel: Option<String>,
    thumbnail: Option<String>,
    duration: Option<String>,
) -> Result<String, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    db::add_video_to_folder(
        &conn, &id, &youtube_id, &folder_id, &title,
        channel.as_deref(), thumbnail.as_deref(), duration.as_deref(),
    ).map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
fn get_note(db: State<Db>, folder_id: String) -> Result<String, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::get_note(&conn, &folder_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_note(db: State<Db>, folder_id: String, body: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::save_note(&conn, &folder_id, &body).map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_dir = app.path().app_data_dir().expect("no app data dir");
            std::fs::create_dir_all(&app_dir).expect("failed to create app data dir");
            let db_path = app_dir.join("data.db");

            let conn = Connection::open(db_path).expect("failed to open db");
            db::init(&conn).expect("failed to init schema");

            app.manage(Db(Mutex::new(conn)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            search_videos,
            fetch_comments,
            list_folders,
            create_folder,
            list_videos_in_folder,
            add_video_to_folder,
            get_note,
            save_note,
        ])
        .run(tauri::generate_context!())
        .expect("error while running FocusYT");
}
