//! フォルダ・プロジェクトの取得と、プロジェクト配下レシピの再帰取得。
//!
//! Workato ではレシピやコネクションはフォルダ内に整理される。
//! プロジェクトはフォルダのルートに紐づく管理単位で、
//! 1 つのプロジェクトが 1 つのルートフォルダを持つ。
//!
//! ## プロジェクト配下レシピの取得フロー
//!
//! [`get_project_recipes`] は以下の手順でレシピを収集する:
//!
//! 1. ルートフォルダから BFS で全子孫フォルダを探索（[`fetch_descendants`]）
//! 2. 各フォルダ内のレシピをページングで取得
//! 3. `description` が空のレシピは個別 API で補完（最大 5 並列）

use std::collections::VecDeque;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use super::client::{self, WorkatoClient};
use super::recipes::{Recipe, RecipeListResponse, fetch_recipe_detail};

/// Workato フォルダ。
///
/// レシピやコネクションを整理するためのディレクトリ構造。
/// `parent_id` による親子関係でツリーを形成する。
#[derive(Serialize, Deserialize, Clone)]
pub struct Folder {
    /// フォルダ ID。
    pub id: i64,
    /// フォルダ名。
    pub name: String,
    /// 親フォルダの ID。ルートフォルダの場合は `None`。
    pub parent_id: Option<i64>,
    /// 作成日時。
    pub created_at: Option<String>,
    /// 更新日時。
    pub updated_at: Option<String>,
}

/// Workato プロジェクト。
///
/// プロジェクトは 1 つのルートフォルダ（`folder_id`）に紐づく管理単位。
/// プロジェクト配下の全リソースはそのフォルダツリー内に存在する。
#[derive(Serialize, Deserialize, Clone)]
pub struct Project {
    /// プロジェクト ID。
    pub id: i64,
    /// プロジェクト名。
    pub name: String,
    /// プロジェクトの説明文。
    pub description: Option<String>,
    /// ルートフォルダの ID。
    pub folder_id: i64,
}

/// 指定した親フォルダ直下の子フォルダをページングで全取得する。
///
/// [`fetch_descendants`] から呼び出される内部関数。
/// 100 件ずつ取得し、全件を結合して返す。
async fn fetch_children(client: &WorkatoClient, parent_id: i64) -> Result<Vec<Folder>, String> {
    let mut all = Vec::new();
    let per_page: usize = 100;
    let mut page = 1usize;

    loop {
        let response = client
            .get(&format!(
                "/api/folders?parent_id={}&page={}&per_page={}",
                parent_id, page, per_page
            ))
            .await?;

        if !response.is_success() {
            return Err(format!("API エラー {}: {}", response.status, response.body));
        }

        let data: Vec<Folder> = response.json()?;
        let fetched = data.len();
        all.extend(data);

        if fetched < per_page {
            break;
        }
        page += 1;
    }

    Ok(all)
}

/// ルートフォルダから BFS で全子孫フォルダを探索する。
///
/// [`get_project_recipes`] から呼び出される内部関数。
/// キューを使った幅優先探索で、指定フォルダ配下の全フォルダを再帰的に取得する。
/// ルートフォルダ自身は結果に含まれない。
async fn fetch_descendants(client: &WorkatoClient, root_folder_id: i64) -> Result<Vec<Folder>, String> {
    let mut all = Vec::new();
    let mut queue = VecDeque::new();
    queue.push_back(root_folder_id);

    while let Some(parent_id) = queue.pop_front() {
        let children = fetch_children(client, parent_id).await?;
        for child in &children {
            queue.push_back(child.id);
        }
        all.extend(children);
    }

    Ok(all)
}

/// 全プロジェクトをページングで取得する Tauri コマンド。
///
/// `invoke("get_projects")` で呼び出される。
/// `/api/projects` を 100 件ずつページングして全プロジェクトを取得する。
///
/// # エラー
///
/// API トークン未設定、ネットワークエラー、またはレスポンスのパース失敗。
#[tauri::command]
pub async fn get_projects(app: AppHandle) -> Result<Vec<Project>, String> {
    let client = client::make_client(&app)?;
    let mut all = Vec::new();
    let per_page: usize = 100;
    let mut page = 1usize;

    loop {
        let response = client
            .get(&format!("/api/projects?page={}&per_page={}", page, per_page))
            .await?;

        if !response.is_success() {
            return Err(format!("API エラー {}: {}", response.status, response.body));
        }

        let data: Vec<Project> = response.json()?;
        let fetched = data.len();
        all.extend(data);

        if fetched < per_page {
            break;
        }
        page += 1;
    }

    Ok(all)
}

/// 全フォルダを取得する Tauri コマンド。
///
/// `invoke("get_folders")` で呼び出される。
/// `parent_id` 指定なしで `/api/folders` を呼ぶため、Home 直下のフォルダのみ返す。
///
/// # エラー
///
/// API トークン未設定、ネットワークエラー、またはレスポンスのパース失敗。
#[tauri::command]
pub async fn get_folders(app: AppHandle) -> Result<Vec<Folder>, String> {
    let client = client::make_client(&app)?;
    let mut all = Vec::new();
    let per_page: usize = 100;
    let mut page = 1usize;

    loop {
        let response = client
            .get(&format!("/api/folders?page={}&per_page={}", page, per_page))
            .await?;

        if !response.is_success() {
            return Err(format!("API エラー {}: {}", response.status, response.body));
        }

        let data: Vec<Folder> = response.json()?;
        let fetched = data.len();
        all.extend(data);

        if fetched < per_page {
            break;
        }
        page += 1;
    }

    Ok(all)
}

/// プロジェクト配下の全レシピを再帰的に取得する Tauri コマンド。
///
/// `invoke("get_project_recipes", { rootFolderId })` で呼び出される。
///
/// 処理の流れ:
/// 1. ルートフォルダから BFS で全子孫フォルダの ID を収集
/// 2. 各フォルダ内のレシピをページングで取得
/// 3. リスト API で `description` が省略されたレシピは個別 API で補完（最大 5 並列）
///
/// # エラー
///
/// API トークン未設定、ネットワークエラー、またはレスポンスのパース失敗。
#[tauri::command]
pub async fn get_project_recipes(app: AppHandle, root_folder_id: i64) -> Result<Vec<Recipe>, String> {
    let client = client::make_client(&app)?;

    // 全子孫フォルダ ID を集める
    let descendants = fetch_descendants(&client, root_folder_id).await?;
    let mut folder_ids: Vec<i64> = vec![root_folder_id];
    for f in &descendants {
        folder_ids.push(f.id);
    }

    // フォルダごとにレシピ取得
    let mut all_recipes: Vec<Recipe> = Vec::new();
    let per_page: usize = 100;

    for fid in folder_ids {
        let mut page = 1usize;
        loop {
            let response = client
                .get(&format!(
                    "/api/recipes?folder_id={}&page={}&per_page={}",
                    fid, page, per_page
                ))
                .await?;

            if !response.is_success() {
                return Err(format!("API エラー {}: {}", response.status, response.body));
            }

            let data: RecipeListResponse = response.json()?;
            let fetched = data.items.len();
            all_recipes.extend(data.items);

            if fetched < per_page {
                break;
            }
            page += 1;
        }
    }

    // リスト API では description が空のため、個別 API で並列取得して補完する
    let ids_to_fetch: Vec<i64> = all_recipes
        .iter()
        .filter(|r| r.description.as_deref().unwrap_or("").is_empty())
        .map(|r| r.id)
        .collect();

    if !ids_to_fetch.is_empty() {
        use futures::stream::{self, StreamExt};

        let results: Vec<_> = stream::iter(ids_to_fetch)
            .map(|id| fetch_recipe_detail(&client, id))
            .buffer_unordered(10)
            .collect()
            .await;

        let mut desc_map = std::collections::HashMap::new();
        for result in results {
            if let Ok(detail) = result {
                if let Some(desc) = detail.description {
                    if !desc.is_empty() {
                        desc_map.insert(detail.id, desc);
                    }
                }
            }
        }

        for recipe in &mut all_recipes {
            if let Some(desc) = desc_map.remove(&recipe.id) {
                recipe.description = Some(desc);
            }
        }
    }

    Ok(all_recipes)
}
