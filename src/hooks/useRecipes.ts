// レシピページ用フック。検索、ソート、起動/停止をまとめてる。

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getRecipes, startRecipe, stopRecipe } from "../lib/tauri";
import { useConfig } from "../context/ConfigContext";
import { sortRows } from "../lib/sort";
import { useTableSort } from "./useTableSort";
import type { Recipe } from "../types/workato";

function getRecipeValue(
  r: Recipe,
  col: string,
): string | number | null | undefined {
  switch (col) {
    case "name":
      return r.name;
    case "running":
      return r.running == null ? null : r.running ? 1 : 0;
    case "succeeded":
      return r.job_succeeded_count ?? null;
    case "failed":
      return r.job_failed_count ?? null;
    case "last_run_at":
      return r.last_run_at ?? null;
    default:
      return null;
  }
}

export function useRecipes() {
  const { activeProfile } = useConfig();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const { sort, onSort } = useTableSort();

  const hasToken = !!activeProfile?.api_token;

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["recipes"],
    queryFn: getRecipes,
    enabled: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const startMut = useMutation({
    mutationFn: (id: number) => startRecipe(id),
    onSuccess: () => {
      setActionError(null);
      qc.invalidateQueries({ queryKey: ["recipes"] });
    },
    onError: (e: unknown) => setActionError(String(e)),
  });

  const stopMut = useMutation({
    mutationFn: (id: number) => stopRecipe(id),
    onSuccess: () => {
      setActionError(null);
      qc.invalidateQueries({ queryKey: ["recipes"] });
    },
    onError: (e: unknown) => setActionError(String(e)),
  });

  const filtered = useMemo(() => {
    const searched = (data ?? []).filter((r) =>
      r.name.toLowerCase().includes(search.toLowerCase()),
    );
    return sortRows(searched, sort.col, sort.dir, getRecipeValue);
  }, [data, search, sort]);

  const isPending = useCallback(
    (id: number) =>
      (startMut.isPending && startMut.variables === id) ||
      (stopMut.isPending && stopMut.variables === id),
    [
      startMut.isPending,
      startMut.variables,
      stopMut.isPending,
      stopMut.variables,
    ],
  );

  return {
    hasToken,
    data,
    isLoading,
    isFetching,
    error,
    actionError,
    search,
    setSearch,
    sort,
    onSort,
    filtered,
    refetch,
    startMut,
    stopMut,
    isPending,
  } as const;
}
