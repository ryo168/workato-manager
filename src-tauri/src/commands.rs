use tauri::{AppHandle, Manager};

use crate::logger;

#[tauri::command]
pub fn get_log_dir(app: AppHandle) -> Result<String, String> {
    let dir = logger::log_dir(&app);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn get_config_dir(app: AppHandle) -> Result<String, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn open_folder(path: String) -> Result<(), String> {
    std::process::Command::new("explorer")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn save_csv_file(suggested_name: String, content: String) -> Result<bool, String> {
    let file = rfd::AsyncFileDialog::new()
        .set_file_name(&suggested_name)
        .add_filter("CSV", &["csv"])
        .save_file()
        .await;

    match file {
        Some(handle) => {
            std::fs::write(handle.path(), content.as_bytes()).map_err(|e| e.to_string())?;
            Ok(true)
        }
        None => Ok(false), // ユーザーがキャンセルした
    }
}

#[tauri::command]
pub async fn save_json_file(suggested_name: String, content: String) -> Result<bool, String> {
    let file = rfd::AsyncFileDialog::new()
        .set_file_name(&suggested_name)
        .add_filter("JSON", &["json"])
        .save_file()
        .await;

    match file {
        Some(handle) => {
            std::fs::write(handle.path(), content.as_bytes()).map_err(|e| e.to_string())?;
            Ok(true)
        }
        None => Ok(false), // ユーザーがキャンセルした
    }
}
