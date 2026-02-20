// プロジェクトページ用フック。3つの useQuery + アクション。

import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getConnections,
  getProjects,
  getProjectRecipes,
  saveJsonFile,
} from "../lib/tauri";
import { useConfig } from "../context/ConfigContext";
import { normalizeRecipeCode, applyMasks } from "../lib/json";
import { normalizeBaseUrl, openWorkatoUrl, workatoUrls } from "../lib/workato-url";
import { todayISO } from "../lib/format";
import type { Recipe, Connection } from "../types/workato";

export function useProjects() {
  const { activeProfile } = useConfig();
  const [selectedProjectId, setSelectedProjectId] = useState<number | "">(""),
    [previewOpen, setPreviewOpen] = useState(false),
    [maskedPaths, setMaskedPaths] = useState<Map<string, string>>(new Map());

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
    () => (projects ?? []).find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
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

  const exportPayload = useMemo(() => {
    if (!selectedProject) return null;
    const recipes = (projectRecipes ?? []).map((r) => ({
      ...r,
      code: normalizeRecipeCode(r.code),
    }));
    return {
      project: selectedProject,
      recipes,
      connections: filteredConnections,
    };
  }, [selectedProject, projectRecipes, filteredConnections]);

  const handleDownloadJson = useCallback(async () => {
    if (!exportPayload) return;
    const output =
      maskedPaths.size > 0
        ? applyMasks(exportPayload, maskedPaths)
        : exportPayload;
    const content = JSON.stringify(output, null, 2);
    const safeName = exportPayload.project.name
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
    selectedProjectId,
    setSelectedProjectId,
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
  } as const;
}
