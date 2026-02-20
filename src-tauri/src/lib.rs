mod commands;
mod config;
mod logger;
mod workato;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            logger::cleanup_old_logs(&app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            config::save_config,
            config::load_config,
            workato::recipes::get_recipes,
            workato::recipes::get_recipes_by_ids,
            workato::recipes::start_recipe,
            workato::recipes::stop_recipe,
            workato::jobs::get_jobs,
            workato::connections::get_connections,
            workato::folders::get_folders,
            workato::folders::get_projects,
            workato::folders::get_project_recipes,
            commands::save_csv_file,
            commands::save_json_file,
            commands::get_log_dir,
            commands::get_config_dir,
            commands::open_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
