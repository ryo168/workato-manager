// プロジェクトページ用フック。3つの useQuery + アクション。

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

  // チェック状態（未チェック ID を追跡。デフォルトは全チェックON）
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

  // --- 外部レシピ ID 算出 ---
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

  // --- 外部コネクション算出 ---
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

  const handleDownloadJson = useCallback(async () => {
    if (!exportPayload) return;
    const output =
      maskedPaths.size > 0
        ? applyMasks(exportPayload, maskedPaths)
        : exportPayload;
    const content = JSON.stringify(output, null, 2);
    const projectData = exportPayload.project as { name: string };
    const safeName = projectData.name
      .replace(/[^a-zA-Z0-9-]+/g, "_")
      .replace(/^_|_$/g, "");
    const name = `project_${safeName}_${todayISO()}.json`;
    await saveJsonFile(name, content);
  }, [exportPayload, maskedPaths]);

  const handleCopyJson = useCallback(async () => {
    if (!exportPayload) return;
    const output =
      maskedPaths.size > 0
        ? applyMasks(exportPayload, maskedPaths)
        : exportPayload;
    await navigator.clipboard.writeText(JSON.stringify(output, null, 2));
  }, [exportPayload, maskedPaths]);

  const openPreview = useCallback(() => setPreviewOpen(true), []);
  const closePreview = useCallback(() => {
    setPreviewOpen(false);
    setMaskedPaths(new Map());
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
