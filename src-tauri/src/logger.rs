use std::fs;
use std::path::PathBuf;
use chrono::Local;
use tauri::{AppHandle, Manager};

pub fn log_dir(app: &AppHandle) -> PathBuf {
    app.path().app_data_dir().unwrap().join("logs")
}

pub fn write_log(app: &AppHandle, line: &str) {
    let dir = log_dir(app);
    let _ = fs::create_dir_all(&dir);
    let now = Local::now();
    let file_name = now.format("%Y-%m-%d").to_string() + ".log";
    let path = dir.join(file_name);
    let entry = format!("[{}] {}\n", now.format("%H:%M:%S"), line);
    let _ = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .and_then(|mut f| std::io::Write::write_all(&mut f, entry.as_bytes()));
}

pub fn cleanup_old_logs(app: &AppHandle) {
    let dir = log_dir(app);
    if !dir.exists() {
        return;
    }
    let today = Local::now().date_naive();
    let yesterday = today - chrono::Duration::days(1);

    let entries = match fs::read_dir(&dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let name = entry.file_name();
        let name_str = name.to_string_lossy();
        if !name_str.ends_with(".log") {
            continue;
        }
        let date_part = &name_str[..name_str.len() - 4]; // strip ".log"
        if let Ok(file_date) = chrono::NaiveDate::parse_from_str(date_part, "%Y-%m-%d") {
            if file_date < yesterday {
                let _ = fs::remove_file(entry.path());
            }
        }
    }
}
