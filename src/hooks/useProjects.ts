/**
 * プロジェクトページ用カスタムフック。
 *
 * 責務:
 *   1. プロジェクト一覧・コネクション一覧・レシピ一覧の3系統データ取得（useQuery）
 *   2. プロジェクト内レシピが参照する「外部依存」（他プロジェクトのレシピ・コネクション）の自動検出
 *   3. エクスポート対象の選択状態（チェックボックス）管理
 *   4. JSON エクスポート（プレビュー / ダウンロード / クリップボードコピー / クレンジング）
 *
 * データフロー概要:
 *   projects ─┐
 *   connections─┤── selectedProject ── projectRecipes ── 外部依存検出
 *              └── filteredConnections ─────────────────────┘
 */

import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getConnections,
  getProjects,
  getProjectRecipes,
  getRecipesByIds,
  saveJsonFile,
} from "../lib/tauri";
import { useConfig } from "../context/ConfigContext";
import { normalizeRecipeCode, applyMasks } from "../lib/json";
import { cleanseProjectJson } from "../lib/json-cleanse";
import { normalizeBaseUrl, openWorkatoUrl, workatoUrls } from "../lib/workato-url";
import { todayISO } from "../lib/format";
import {
  extractFlowIds,
  extractAccountIds,
  findExternalIds,
} from "../lib/dependency";
import type { Recipe, Connection } from "../types/workato";

export function useProjects(projectId?: number) {
  const { activeProfile } = useConfig();
  const [previewOpen, setPreviewOpen] = useState(false),
    [maskedPaths, setMaskedPaths] = useState<Map<string, string>>(new Map());
  const [cleansedPayload, setCleansedPayload] = useState<unknown | null>(null);

  // ---------- チェック状態管理 ----------
  // 「未チェック ID の Set」で管理する（否定論理）。
  // 理由: デフォルトを「全選択ON」にするため。
  //   - 空 Set = 全てチェック済み → 新規データ追加時も自動的に選択状態になる
  //   - チェックを外した ID だけ Set に追加する
  // 4つの Set はそれぞれ独立したカテゴリに対応:
  //   projectRecipe / projectConnection = プロジェクト内のリソース
  //   recipe / connection = 外部依存として検出されたリソース
  const [uncheckedProjectRecipeIds, setUncheckedProjectRecipeIds] = useState<Set<number>>(new Set());
  const [uncheckedProjectConnectionIds, setUncheckedProjectConnectionIds] = useState<Set<number>>(new Set());
  const [uncheckedRecipeIds, setUncheckedRecipeIds] = useState<Set<number>>(new Set());
  const [uncheckedConnectionIds, setUncheckedConnectionIds] = useState<Set<number>>(new Set());

  const hasToken = !!activeProfile?.api_token;

  const {
    data: projects,
    isLoading: projectsLoading,
    error: projectsError,
    refetch: refetchProjects,
    isFetching: projectsFetching,
  } = useQuery({
    queryKey: ["projects"],
    queryFn: getProjects,
    enabled: hasToken,
  });

  const {
    data: connections,
    isLoading: connectionsLoading,
    refetch: refetchConnections,
  } = useQuery({
    queryKey: ["connections"],
    queryFn: getConnections,
    enabled: hasToken,
  });

  const selectedProject = useMemo(
    () => (projects ?? []).find((p) => p.id === projectId) ?? null,
    [projects, projectId],
  );

  const {
    data: projectRecipes,
    isLoading: recipesLoading,
    refetch: refetchRecipes,
  } = useQuery({
    queryKey: ["projectRecipes", selectedProject?.folder_id],
    queryFn: () => getProjectRecipes(selectedProject!.folder_id),
    enabled: hasToken && !!selectedProject,
  });

  const filteredConnections = useMemo(() => {
    if (!selectedProject) return [];
    return (connections ?? []).filter(
      (c) => c.project_id === selectedProject.id,
    );
  }, [connections, selectedProject]);

  // --- 外部依存レシピ ID 算出 ---
  // 検出フロー（レシピ）:
  //   1. extractFlowIds: 全レシピの code 内から参照先フロー ID を抽出
  //   2. findExternalIds: プロジェクト内レシピ ID を除外し、外部参照だけ残す
  // → 他プロジェクトのレシピを呼び出している場合にここで検出される
  const externalRecipeIds = useMemo(() => {
    if (!projectRecipes || projectRecipes.length === 0) return [];
    const allFlowIds = extractFlowIds(projectRecipes);
    const projectRecipeIds = new Set(projectRecipes.map((r) => r.id));
    return findExternalIds(allFlowIds, projectRecipeIds);
  }, [projectRecipes]);

  // --- 外部レシピ取得 ---
  const {
    data: externalRecipes,
    isLoading: externalRecipesLoading,
  } = useQuery({
    queryKey: ["externalRecipes", externalRecipeIds],
    queryFn: () => getRecipesByIds(externalRecipeIds),
    enabled: hasToken && externalRecipeIds.length > 0,
  });

  // --- 外部依存コネクション算出 ---
  // 検出フロー（コネクション）:
  //   1. extractAccountIds: 全レシピの code 内から参照先アカウント ID を抽出
  //   2. findExternalIds: プロジェクト内コネクション ID を除外し、外部参照だけ残す
  //   3. 全コネクション一覧から外部 ID に該当するものをフィルタして返す
  // → レシピが別プロジェクトのコネクションを使っている場合にここで検出される
  const externalConnections = useMemo(() => {
    if (!projectRecipes || projectRecipes.length === 0) return [];
    const allAccountIds = extractAccountIds(projectRecipes);
    const projectConnectionIds = new Set(filteredConnections.map((c) => c.id));
    const externalIds = findExternalIds(allAccountIds, projectConnectionIds);
    if (externalIds.length === 0) return [];
    const externalIdSet = new Set(externalIds);
    return (connections ?? []).filter((c) => externalIdSet.has(c.id));
  }, [projectRecipes, filteredConnections, connections]);

  // --- プロジェクト内チェック状態 ---
  // 以下の checked / setChecked ペアは4カテゴリ共通のパターン:
  //   checked (useMemo): unchecked Set を反転し「現在チェックされている ID の Set」を導出
  //   setChecked (useCallback): UI から受け取った「チェック済み Set」を反転して unchecked Set に変換・保存
  // この反転変換により、UI 側は正論理（チェック済み Set）で扱え、内部状態は否定論理を維持できる
  const projectRecipeChecked = useMemo(() => {
    return new Set(
      (projectRecipes ?? []).filter((r) => !uncheckedProjectRecipeIds.has(r.id)).map((r) => r.id),
    );
  }, [projectRecipes, uncheckedProjectRecipeIds]);

  const setProjectRecipeChecked = useCallback(
    (nextChecked: Set<number>) => {
      const unchecked = new Set<number>();
      for (const r of projectRecipes ?? []) {
        if (!nextChecked.has(r.id)) unchecked.add(r.id);
      }
      setUncheckedProjectRecipeIds(unchecked);
    },
    [projectRecipes],
  );

  const projectConnectionChecked = useMemo(() => {
    return new Set(
      filteredConnections.filter((c) => !uncheckedProjectConnectionIds.has(c.id)).map((c) => c.id),
    );
  }, [filteredConnections, uncheckedProjectConnectionIds]);

  const setProjectConnectionChecked = useCallback(
    (nextChecked: Set<number>) => {
      const unchecked = new Set<number>();
      for (const c of filteredConnections) {
        if (!nextChecked.has(c.id)) unchecked.add(c.id);
      }
      setUncheckedProjectConnectionIds(unchecked);
    },
    [filteredConnections],
  );

  // --- 外部依存チェック状態（デフォルト全ON、未チェックIDで制御） ---
  const externalRecipeChecked = useMemo(() => {
    return new Set(
      (externalRecipes ?? []).filter((r) => !uncheckedRecipeIds.has(r.id)).map((r) => r.id),
    );
  }, [externalRecipes, uncheckedRecipeIds]);

  const setExternalRecipeChecked = useCallback(
    (nextChecked: Set<number>) => {
      const unchecked = new Set<number>();
      for (const r of externalRecipes ?? []) {
        if (!nextChecked.has(r.id)) unchecked.add(r.id);
      }
      setUncheckedRecipeIds(unchecked);
    },
    [externalRecipes],
  );

  const externalConnectionChecked = useMemo(() => {
    return new Set(
      externalConnections.filter((c) => !uncheckedConnectionIds.has(c.id)).map((c) => c.id),
    );
  }, [externalConnections, uncheckedConnectionIds]);

  const setExternalConnectionChecked = useCallback(
    (nextChecked: Set<number>) => {
      const unchecked = new Set<number>();
      for (const c of externalConnections) {
        if (!nextChecked.has(c.id)) unchecked.add(c.id);
      }
      setUncheckedConnectionIds(unchecked);
    },
    [externalConnections],
  );

  const isFetching = projectsFetching;
  const isLoading = projectsLoading || connectionsLoading;
  const isRecipesLoading = recipesLoading && !!selectedProject;

  const refetchAll = useCallback(() => {
    refetchProjects();
    refetchConnections();
    refetchRecipes();
  }, [refetchProjects, refetchConnections, refetchRecipes]);

  const baseUrl = normalizeBaseUrl(activeProfile?.base_url);

  const handleOpenProject = useCallback(() => {
    if (selectedProject && baseUrl) {
      openWorkatoUrl(baseUrl, workatoUrls.folder(selectedProject.folder_id));
    }
  }, [selectedProject, baseUrl]);

  const handleOpenRecipe = useCallback(
    (recipe: Recipe) => {
      openWorkatoUrl(baseUrl, workatoUrls.recipe(recipe.id));
    },
    [baseUrl],
  );

  const handleOpenConnection = useCallback(
    (conn: Connection) => {
      openWorkatoUrl(baseUrl, workatoUrls.connection(conn.id));
    },
    [baseUrl],
  );

  // --- プロジェクト名逆引きマップ ---
  const projectNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const p of projects ?? []) map.set(p.id, p.name);
    return map;
  }, [projects]);

  // --- エクスポート用ペイロード構築 ---
  // プロジェクト内リソースと外部依存リソースをマージして1つの JSON にまとめる。
  // マージ順序:
  //   recipes     = プロジェクト内レシピ（チェック済み） + 外部レシピ（チェック済み）
  //   connections = プロジェクト内コネクション（チェック済み） + 外部コネクション（チェック済み）
  // 各レシピは normalizeRecipeCode で code フィールドを正規化してから格納する
  const exportPayload = useMemo(() => {
    if (!selectedProject) return null;
    const normalize = (r: Recipe) => ({ ...r, code: normalizeRecipeCode(r.code) });

    const recipes = (projectRecipes ?? [])
      .filter((r) => projectRecipeChecked.has(r.id))
      .map(normalize);

    const checkedExtRecipes = (externalRecipes ?? [])
      .filter((r) => externalRecipeChecked.has(r.id))
      .map(normalize);

    const baseConnections = filteredConnections.filter((c) =>
      projectConnectionChecked.has(c.id),
    );

    const checkedExtConnections = externalConnections.filter((c) =>
      externalConnectionChecked.has(c.id),
    );

    return {
      project: selectedProject,
      recipes: [...recipes, ...checkedExtRecipes],
      connections: [...baseConnections, ...checkedExtConnections],
    };
  }, [
    selectedProject,
    projectRecipes,
    projectRecipeChecked,
    filteredConnections,
    projectConnectionChecked,
    externalRecipes,
    externalRecipeChecked,
    externalConnections,
    externalConnectionChecked,
  ]);

  // --- クレンジング ---
  const isCleansed = cleansedPayload !== null;
  const handleCleanse = useCallback(() => {
    if (!exportPayload) return;
    setCleansedPayload(cleanseProjectJson(exportPayload));
  }, [exportPayload]);
  const handleUncleanse = useCallback(() => setCleansedPayload(null), []);

  /** プレビュー / ダウンロード / コピーで使う実データ */
  const activePayload = isCleansed ? cleansedPayload : exportPayload;

  /** 削減率の統計情報 */
  const cleanseStats = useMemo(() => {
    if (!isCleansed || !exportPayload || !cleansedPayload) return null;
    const originalStr = JSON.stringify(exportPayload);
    const cleansedStr = JSON.stringify(cleansedPayload);
    const originalSize = originalStr.length;
    const cleansedSize = cleansedStr.length;
    const reduced = originalSize - cleansedSize;
    const percent = originalSize > 0 ? Math.round((reduced / originalSize) * 100) : 0;
    // 文字数
    const originalChars = originalStr.length;
    const cleansedChars = cleansedStr.length;
    const reducedChars = originalChars - cleansedChars;
    return { originalSize, cleansedSize, reduced, percent, originalChars, cleansedChars, reducedChars };
  }, [isCleansed, exportPayload, cleansedPayload]);

  const handleDownloadJson = useCallback(async () => {
    if (!activePayload || !exportPayload) return;
    const output =
      maskedPaths.size > 0
        ? applyMasks(activePayload, maskedPaths)
        : activePayload;
    const content = JSON.stringify(output, null, 2);
    const projectData = exportPayload.project as { name: string };
    const safeName = projectData.name
      .replace(/[^a-zA-Z0-9-]+/g, "_")
      .replace(/^_|_$/g, "");
    const suffix = isCleansed ? "_cleansed" : "";
    const name = `project_${safeName}${suffix}_${todayISO()}.json`;
    await saveJsonFile(name, content);
  }, [activePayload, exportPayload, maskedPaths, isCleansed]);

  const handleCopyJson = useCallback(async () => {
    if (!activePayload) return;
    const output =
      maskedPaths.size > 0
        ? applyMasks(activePayload, maskedPaths)
        : activePayload;
    await navigator.clipboard.writeText(JSON.stringify(output, null, 2));
  }, [activePayload, maskedPaths]);

  const openPreview = useCallback(() => setPreviewOpen(true), []);
  const closePreview = useCallback(() => {
    setPreviewOpen(false);
    setMaskedPaths(new Map());
    setCleansedPayload(null);
  }, []);

  return {
    hasToken,
    projects,
    projectsLoading,
    projectsError,
    isFetching,
    isLoading,
    isRecipesLoading,
    selectedProject,
    projectRecipes,
    filteredConnections,
    baseUrl,
    refetchAll,
    handleOpenProject,
    handleOpenRecipe,
    handleOpenConnection,
    exportPayload,
    handleDownloadJson,
    handleCopyJson,
    previewOpen,
    openPreview,
    closePreview,
    maskedPaths,
    setMaskedPaths,
    // クレンジング
    activePayload,
    isCleansed,
    handleCleanse,
    handleUncleanse,
    cleanseStats,
    // プロジェクト内チェック
    projectRecipeChecked,
    setProjectRecipeChecked,
    projectConnectionChecked,
    setProjectConnectionChecked,
    // 外部依存
    externalRecipes: externalRecipes ?? [],
    externalRecipesLoading: externalRecipesLoading && externalRecipeIds.length > 0,
    externalConnections,
    externalRecipeChecked,
    setExternalRecipeChecked,
    externalConnectionChecked,
    setExternalConnectionChecked,
    // プロジェクト名逆引き
    projectNameById,
  } as const;
}
