/**
 * @file レシピページ用カスタムフック
 * レシピ一覧の検索・ソート・起動/停止操作をまとめて管理する。
 */

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getRecipes, startRecipe, stopRecipe } from "../lib/tauri";
import { useConfig } from "../context/ConfigContext";
import { sortRows } from "../lib/sort";
import { useTableSort } from "./useTableSort";
import type { Recipe } from "../types/workato";

/**
 * ソート用のレシピカラム値を取得する。
 * - running: boolean を 1/0 に変換して数値ソート可能にする
 * - succeeded / failed: ジョブの成功・失敗回数
 * - last_run_at: 最終実行日時（ISO文字列で辞書順ソート）
 */
function getRecipeValue(
  r: Recipe,
  col: string,
): string | number | null | undefined {
  switch (col) {
    case "name":
      return r.name;
    case "running":
      // boolean → 数値変換（true=1, false=0）でソートできるようにする
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

/** レシピページのデータ取得・検索・ソート・起動停止を一括管理するフック */
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
