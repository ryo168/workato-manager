// Rust バックエンドの invoke ラッパー。
// 型付きで呼べるようにしてるだけ。

import { invoke } from "@tauri-apps/api/core";
import type {
  AppConfig,
  Profile,
  Recipe,
  Job,
  Connection,
  Folder,
  Project,
} from "../types/workato";

// --- 設定 ---

export const loadConfig = (): Promise<AppConfig> => invoke("load_config");

export const saveConfig = (
  profiles: Profile[],
  activeProfile: string,
): Promise<void> => invoke("save_config", { profiles, activeProfile });

// --- レシピ ---

export const getRecipes = (): Promise<Recipe[]> => invoke("get_recipes");

export const startRecipe = (id: number): Promise<void> =>
  invoke("start_recipe", { id });

export const stopRecipe = (id: number): Promise<void> =>
  invoke("stop_recipe", { id });

export const getRecipesByIds = (ids: number[]): Promise<Recipe[]> =>
  invoke("get_recipes_by_ids", { ids });

// --- ジョブ ---

export const getJobs = (recipe_id: number): Promise<Job[]> =>
  invoke("get_jobs", { recipeId: recipe_id });

// --- コネクション ---

export const getConnections = (): Promise<Connection[]> =>
  invoke("get_connections");

// --- フォルダ・プロジェクト ---

export const getFolders = (): Promise<Folder[]> => invoke("get_folders");
export const getProjects = (): Promise<Project[]> => invoke("get_projects");

// プロジェクト配下のレシピを再帰的に取得
export const getProjectRecipes = (rootFolderId: number): Promise<Recipe[]> =>
  invoke("get_project_recipes", { rootFolderId });

// --- ファイル保存 ---

export const saveJsonFile = (
  suggestedName: string,
  content: string,
): Promise<boolean> => invoke("save_json_file", { suggestedName, content });

// --- パス取得 ---

export const getLogDir = (): Promise<string> => invoke("get_log_dir");
export const getConfigDir = (): Promise<string> => invoke("get_config_dir");

// エクスプローラーでフォルダを開く
export const openFolder = (path: string): Promise<void> =>
  invoke("open_folder", { path });
