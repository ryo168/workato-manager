use std::collections::VecDeque;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::config::load_config_internal;
use super::client::WorkatoClient;
use super::recipes::{Recipe, RecipeListResponse, fetch_recipe_detail};

#[derive(Serialize, Deserialize, Clone)]
pub struct Folder {
    pub id: i64,
    pub name: String,
    pub parent_id: Option<i64>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Project {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub folder_id: i64,
}

fn make_client(app: &AppHandle) -> Result<WorkatoClient, String> {
    let config = load_config_internal(app)?;
    if config.api_token.is_empty() {
        return Err("API トークンが設定されていません。設定ページで入力してください。".to_string());
    }
    Ok(WorkatoClient::new(config.api_token, config.base_url, config.proxy_url, app.clone()))
}

// 指定した parent_id 直下のフォルダをページング込みで全取得
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

// BFS で全子孫フォルダを掘る
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

#[tauri::command]
pub async fn get_projects(app: AppHandle) -> Result<Vec<Project>, String> {
    let client = make_client(&app)?;
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

#[tauri::command]
pub async fn get_folders(app: AppHandle) -> Result<Vec<Folder>, String> {
    let client = make_client(&app)?;
    // parent_id 指定なし → Home 直下だけ
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

// プロジェクトフォルダを再帰的に辿って、全レシピをかき集める
#[tauri::command]
pub async fn get_project_recipes(app: AppHandle, root_folder_id: i64) -> Result<Vec<Recipe>, String> {
    let client = make_client(&app)?;

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
            .buffer_unordered(5) // 最大5並列でAPI負荷を抑制
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
