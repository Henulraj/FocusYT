use rusqlite::{Connection, Result, params};
use serde::{Serialize, Deserialize};

pub fn init(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS folders (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS videos (
            id TEXT PRIMARY KEY,
            youtube_id TEXT NOT NULL,
            folder_id TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            channel TEXT,
            thumbnail TEXT,
            duration TEXT,
            added_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY,
            folder_id TEXT NOT NULL UNIQUE REFERENCES folders(id) ON DELETE CASCADE,
            body TEXT NOT NULL DEFAULT '',
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS clip_refs (
            id TEXT PRIMARY KEY,
            note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
            video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
            timestamp_start INTEGER,
            timestamp_end INTEGER,
            label TEXT
        );
        ",
    )?;
    Ok(())
}

#[derive(Serialize, Deserialize)]
pub struct Folder {
    pub id: String,
    pub name: String,
    pub created_at: String,
}

#[derive(Serialize, Deserialize)]
pub struct Video {
    pub id: String,
    pub youtube_id: String,
    pub folder_id: String,
    pub title: String,
    pub channel: Option<String>,
    pub thumbnail: Option<String>,
    pub duration: Option<String>,
}

pub fn list_folders(conn: &Connection) -> Result<Vec<Folder>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, created_at FROM folders ORDER BY created_at DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Folder {
            id: row.get(0)?,
            name: row.get(1)?,
            created_at: row.get(2)?,
        })
    })?;
    rows.collect()
}

pub fn create_folder(conn: &Connection, id: &str, name: &str) -> Result<()> {
    conn.execute(
        "INSERT INTO folders (id, name) VALUES (?1, ?2)",
        params![id, name],
    )?;
    conn.execute(
        "INSERT INTO notes (id, folder_id, body) VALUES (?1, ?2, '')",
        params![uuid::Uuid::new_v4().to_string(), id],
    )?;
    Ok(())
}

pub fn add_video_to_folder(
    conn: &Connection,
    id: &str,
    youtube_id: &str,
    folder_id: &str,
    title: &str,
    channel: Option<&str>,
    thumbnail: Option<&str>,
    duration: Option<&str>,
) -> Result<()> {
    conn.execute(
        "INSERT INTO videos (id, youtube_id, folder_id, title, channel, thumbnail, duration)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![id, youtube_id, folder_id, title, channel, thumbnail, duration],
    )?;
    Ok(())
}

pub fn list_videos_in_folder(conn: &Connection, folder_id: &str) -> Result<Vec<Video>> {
    let mut stmt = conn.prepare(
        "SELECT id, youtube_id, folder_id, title, channel, thumbnail, duration
         FROM videos WHERE folder_id = ?1 ORDER BY added_at ASC",
    )?;
    let rows = stmt.query_map(params![folder_id], |row| {
        Ok(Video {
            id: row.get(0)?,
            youtube_id: row.get(1)?,
            folder_id: row.get(2)?,
            title: row.get(3)?,
            channel: row.get(4)?,
            thumbnail: row.get(5)?,
            duration: row.get(6)?,
        })
    })?;
    rows.collect()
}

pub fn get_note(conn: &Connection, folder_id: &str) -> Result<String> {
    conn.query_row(
        "SELECT body FROM notes WHERE folder_id = ?1",
        params![folder_id],
        |row| row.get(0),
    )
}

pub fn save_note(conn: &Connection, folder_id: &str, body: &str) -> Result<()> {
    conn.execute(
        "UPDATE notes SET body = ?1, updated_at = datetime('now') WHERE folder_id = ?2",
        params![body, folder_id],
    )?;
    Ok(())
}

pub fn add_clip_ref(
    conn: &Connection,
    id: &str,
    note_id: &str,
    video_id: &str,
    start: i64,
    end: Option<i64>,
    label: &str,
) -> Result<()> {
    conn.execute(
        "INSERT INTO clip_refs (id, note_id, video_id, timestamp_start, timestamp_end, label)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, note_id, video_id, start, end, label],
    )?;
    Ok(())
}
