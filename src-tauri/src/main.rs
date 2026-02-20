// リリース時にコンソール窓が出ないようにするやつ。消しちゃダメ！
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    workato_manager_lib::run()
}
