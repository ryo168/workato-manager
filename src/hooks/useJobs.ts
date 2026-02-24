// ジョブページ用フック。レシピ選択、ジョブ取得、ソートをまとめてる。

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getJobs, getRecipes } from "../lib/tauri";
import { useConfig } from "../context/ConfigContext";
import { sortRows } from "../lib/sort";
import { useTableSort } from "./useTableSort";
import type { Job } from "../types/workato";

function getJobValue(j: Job, col: string): string | number | null | undefined {
  switch (col) {
    case "id":
      return j.id;
    case "status":
      return j.is_error == null ? null : j.is_error ? 1 : 0;
    case "started_at":
      return j.started_at ?? null;
    case "completed_at":
      return j.completed_at ?? null;
    default:
      return null;
  }
}

export function useJobs() {
  const { activeProfile } = useConfig();
  const [selectedRecipeId, setSelectedRecipeId] = useState<number | null>(null);
  const { sort, onSort } = useTableSort();

  const hasToken = !!activeProfile?.api_token;

  const recipesQuery = useQuery({
    queryKey: ["recipes"],
    queryFn: getRecipes,
    enabled: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const jobsQuery = useQuery({
    queryKey: ["jobs", selectedRecipeId],
    queryFn: () => getJobs(selectedRecipeId!),
    enabled: hasToken && selectedRecipeId !== null,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const sortedJobs = useMemo(
    () => sortRows(jobsQuery.data ?? [], sort.col, sort.dir, getJobValue),
    [jobsQuery.data, sort],
  );

  return {
    hasToken,
    selectedRecipeId,
    setSelectedRecipeId,
    sort,
    onSort,
    recipesQuery,
    jobsQuery,
    sortedJobs,
  } as const;
}
