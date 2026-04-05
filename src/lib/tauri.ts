/**
 * @file Tauri invoke ラッパー
 * Rust バックエンドの各コマンドを TypeScript の型付き関数として公開する。
 * カテゴリ（設定、レシピ、コネクション等）ごとにセクション分け。
 */

import { invoke } from "@tauri-apps/api/core";
import type {
  AppConfig,
  Profile,
  DifyProfile,
  GeminiProfile,
  WorkatoFileApiProfile,
  WorkatoApiPlatformProfile,
  DifyRunResult,
  DifyWorkflowParam,
  GeminiRunResult,
  WorkatoSpecResult,
  WorkatoSpecParam,
  SavedPrompt,
  Recipe,
  Job,
  Connection,
  Folder,
  Project,
  HistoryEntry,
  HistoryDetail,
} from "../types/workato";

// --- 設定 ---

export const loadConfig = (): Promise<AppConfig> => invoke("load_config");

export const saveConfig = (
  profiles: Profile[],
  activeProfile: string,
  difyProfiles: DifyProfile[],
  activeDifyProfile: string,
  geminiProfiles: GeminiProfile[],
  activeGeminiProfile: string,
  workatoFileApiProfiles: WorkatoFileApiProfile[],
  activeWorkatoFileApiProfile: string,
  workatoApiPlatformProfiles: WorkatoApiPlatformProfile[],
  activeWorkatoApiPlatformProfile: string,
  proxyUrl?: string,
): Promise<void> =>
  invoke("save_config", {
    profiles,
    activeProfile,
    difyProfiles,
    activeDifyProfile,
    geminiProfiles,
    activeGeminiProfile,
    workatoFileApiProfiles,
    activeWorkatoFileApiProfile,
    workatoApiPlatformProfiles,
    activeWorkatoApiPlatformProfile,
    proxyUrl: proxyUrl || null,
  });

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

export const saveMarkdownFile = (
  suggestedName: string,
  content: string,
): Promise<boolean> => invoke("save_markdown_file", { suggestedName, content });

export const saveDrawioFile = (
  suggestedName: string,
  content: string,
): Promise<boolean> => invoke("save_drawio_file", { suggestedName, content });

// --- パス取得 ---

export const getLogDir = (): Promise<string> => invoke("get_log_dir");
export const getConfigDir = (): Promise<string> => invoke("get_config_dir");

// エクスプローラーでフォルダを開く
export const openFolder = (path: string): Promise<void> =>
  invoke("open_folder", { path });

// --- Dify ---

export const difyRun = (jsonContent: string, user: string, responseMode: string): Promise<DifyRunResult> =>
  invoke("dify_run", { jsonContent, user, responseMode });

export const difyUploadOnly = (jsonContent: string, user: string): Promise<DifyRunResult> =>
  invoke("dify_upload_only", { jsonContent, user });

export const difyLoadResponse = (): Promise<DifyRunResult> =>
  invoke("dify_load_response");

// --- Dify ワークフローパラメータ ---

export const loadDifyWorkflowConfig = (profileName: string): Promise<DifyWorkflowParam> =>
  invoke("load_dify_workflow_config", { profileName });

export const saveDifyWorkflowConfig = (config: DifyWorkflowParam): Promise<void> =>
  invoke("save_dify_workflow_config", { config });

// --- Dify 履歴 ---

export const saveHistoryEntry = (params: {
  status: string;
  error?: string | null;
  elapsed_time?: number | null;
  total_tokens?: number | null;
  markdown?: string | null;
  drawio?: string | null;
  source?: string | null;
}): Promise<string> =>
  invoke("save_history_entry", {
    status: params.status,
    error: params.error ?? null,
    elapsedTime: params.elapsed_time ?? null,
    totalTokens: params.total_tokens ?? null,
    markdown: params.markdown ?? null,
    drawio: params.drawio ?? null,
    source: params.source ?? null,
  });

export const loadHistoryList = (): Promise<HistoryEntry[]> =>
  invoke("load_history_list");

export const loadHistoryDetail = (id: string): Promise<HistoryDetail> =>
  invoke("load_history_detail", { id });

export const deleteHistoryEntry = (id: string): Promise<void> =>
  invoke("delete_history_entry", { id });

// --- Gemini ---

export const geminiRun = (
  prompt: string,
  jsonContent: string,
): Promise<GeminiRunResult> =>
  invoke("gemini_run", { prompt, jsonContent });

export const loadGeminiPrompts = (): Promise<SavedPrompt[]> =>
  invoke("load_gemini_prompts");

export const saveGeminiPrompts = (prompts: SavedPrompt[]): Promise<void> =>
  invoke("save_gemini_prompts", { prompts });

// --- Workato 仕様書生成 ---

export const loadWorkatoSpecConfig = (profileName: string): Promise<WorkatoSpecParam> =>
  invoke("load_workato_spec_config", { profileName });

export const saveWorkatoSpecConfig = (config: WorkatoSpecParam): Promise<void> =>
  invoke("save_workato_spec_config", { config });

export const workatoSpecRun = (
  jsonContent: string,
  docType: string,
  workatoFlowType: string,
  addPrompt: string,
  user: string,
): Promise<WorkatoSpecResult> =>
  invoke("workato_spec_run", { jsonContent, docType, workatoFlowType, addPrompt, user });
